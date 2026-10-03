"""Admin-editable circulation rules and loan renewals (docs/rework/F1.md)."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import services
from .models import ActivityLog, BorrowRecord, LibrarySettings, Notification, Role, Status, UserProfile
from .tests import make_book, make_user


def client_for(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def borrow(member, staff, book):
    record = services.create_request(member, book)
    services.approve(staff, record)
    services.confirm_pickup(staff, record)
    record.refresh_from_db()
    return record


def due_in(record, days):
    BorrowRecord.objects.filter(pk=record.pk).update(due_date=timezone.now() + timedelta(days=days))
    record.refresh_from_db()
    return record


# ------------------------------------------------------------------------ settings

class SettingsTests(TestCase):
    def setUp(self):
        self.admin = make_user("admin@x.com", Role.ADMIN)
        self.staff = make_user("staff@x.com", Role.STAFF)
        self.member = make_user("m@x.com")

    def test_defaults_match_the_original_rules(self):
        s = LibrarySettings.get()
        self.assertEqual((s.hold_hours, s.loan_days, s.max_renewals), (48, 14, 1))
        self.assertEqual((s.member_borrow_limit, s.staff_borrow_limit, s.reminder_days_before_due), (5, 10, 2))

    def test_anyone_reads_the_public_rules(self):
        data = client_for().get("/api/settings").json()
        self.assertEqual(data["holdHours"], 48)
        self.assertEqual(data["loanDays"], 14)
        self.assertEqual(data["maxRenewals"], 1)
        self.assertEqual(data["renewWindowDays"], 3)
        self.assertNotIn("staffBorrowLimit", data)  # admin-only fields stay private

    def test_admin_sees_and_changes_everything(self):
        admin = client_for(self.admin)
        self.assertIn("staffBorrowLimit", admin.get("/api/settings").json())
        res = admin.patch("/api/settings", {"holdHours": 24, "loanDays": 21}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual((res.json()["holdHours"], res.json()["loanDays"]), (24, 21))
        self.assertTrue(ActivityLog.objects.filter(code="settings_changed").exists())

    def test_only_admins_change_rules(self):
        for user in (self.staff, self.member):
            res = client_for(user).patch("/api/settings", {"loanDays": 30}, format="json")
            self.assertEqual(res.status_code, 403)
        self.assertEqual(LibrarySettings.get().loan_days, 14)

    def test_values_are_bounded(self):
        admin = client_for(self.admin)
        for field, value in (("holdHours", 0), ("holdHours", 169), ("loanDays", 0), ("loanDays", 91),
                             ("maxRenewals", -1), ("maxRenewals", 6), ("memberBorrowLimit", 0),
                             ("memberBorrowLimit", 51), ("reminderDaysBeforeDue", 15)):
            res = admin.patch("/api/settings", {field: value}, format="json")
            self.assertEqual(res.status_code, 400, (field, value))
            self.assertEqual(res.json()["code"], "invalid")

    def test_new_holds_and_loans_use_the_current_rules(self):
        book = make_book(copies=2)
        before = services.create_request(self.member, book)
        services.approve(self.staff, before)
        before.refresh_from_db()
        old_deadline = before.pickup_deadline

        client_for(self.admin).patch("/api/settings", {"holdHours": 24, "loanDays": 7}, format="json")
        other = make_user("o@x.com")
        record = services.create_request(other, book)
        services.approve(self.staff, record)
        record.refresh_from_db()
        self.assertAlmostEqual((record.pickup_deadline - record.approved_at).total_seconds(), 24 * 3600, delta=2)
        services.confirm_pickup(self.staff, record)
        record.refresh_from_db()
        self.assertAlmostEqual((record.due_date - record.borrowed_at).total_seconds(), 7 * 86400, delta=2)

        before.refresh_from_db()
        self.assertEqual(before.pickup_deadline, old_deadline)  # existing deadlines never move

    def test_queue_handoff_uses_the_current_hold_window(self):
        LibrarySettings.objects.filter(pk=LibrarySettings.get().pk).update(hold_hours=12)
        book = make_book(copies=1)
        loan = borrow(self.member, self.staff, book)
        waiter = make_user("w@x.com")
        book.refresh_from_db()
        services.create_reservation(waiter, book)
        services.confirm_return(self.staff, loan)
        hold = BorrowRecord.objects.get(user=waiter, book=book)
        self.assertAlmostEqual((hold.pickup_deadline - hold.approved_at).total_seconds(), 12 * 3600, delta=2)


class BorrowLimitTests(TestCase):
    def setUp(self):
        self.admin = make_user("admin@x.com", Role.ADMIN)
        self.member = make_user("m@x.com")
        UserProfile.objects.filter(user=self.member).update(max_borrow_limit=None)  # follow the default

    def test_members_follow_the_default_limit(self):
        client_for(self.admin).patch("/api/settings", {"memberBorrowLimit": 1}, format="json")
        services.create_request(self.member, make_book())
        with self.assertRaises(services.BusinessRuleError) as ctx:
            services.create_request(self.member, make_book())
        self.assertEqual(ctx.exception.code, "borrow_limit")
        self.assertEqual(ctx.exception.params, {"limit": 1})
        self.assertEqual(client_for(self.member).get("/api/users/me").json()["maxBorrowLimit"], 1)

    def test_a_personal_limit_overrides_the_default(self):
        UserProfile.objects.filter(user=self.member).update(max_borrow_limit=3)
        client_for(self.admin).patch("/api/settings", {"memberBorrowLimit": 1}, format="json")
        for _ in range(3):
            services.create_request(self.member, make_book())
        with self.assertRaises(services.BusinessRuleError):
            services.create_request(self.member, make_book())


# ------------------------------------------------------------------------ renewals

class RenewalTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.member = make_user("m@x.com")
        self.book = make_book(copies=2)
        self.loan = due_in(borrow(self.member, self.staff, self.book), 2)  # inside the 3-day window

    def renew(self, user=None, record=None):
        record = record or self.loan
        return client_for(user or self.member).post(f"/api/borrow-records/{record.pk}/renew")

    def test_member_renews_within_the_window(self):
        old_due = self.loan.due_date
        res = self.renew()
        self.assertEqual(res.status_code, 200)
        self.loan.refresh_from_db()
        self.assertAlmostEqual((self.loan.due_date - old_due).total_seconds(), 14 * 86400, delta=2)
        self.assertEqual(self.loan.renewal_count, 1)
        self.assertEqual(self.loan.status, Status.BORROWED)
        self.assertEqual(res.json()["renewalCount"], 1)
        self.assertTrue(ActivityLog.objects.filter(code="loan_renewed").exists())

    def test_renewal_uses_the_current_loan_length(self):
        LibrarySettings.objects.filter(pk=LibrarySettings.get().pk).update(loan_days=7)
        old_due = self.loan.due_date
        self.renew()
        self.loan.refresh_from_db()
        self.assertAlmostEqual((self.loan.due_date - old_due).total_seconds(), 7 * 86400, delta=2)

    def test_too_early(self):
        due_in(self.loan, 10)
        res = self.renew()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "renew_too_early")
        self.assertEqual(res.json()["params"], {"days": 3})

    def test_renewal_limit(self):
        self.assertEqual(self.renew().status_code, 200)
        due_in(self.loan, 1)
        res = self.renew()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "renew_limit")
        self.assertEqual(res.json()["params"], {"max": 1})

    def test_no_renewals_when_the_limit_is_zero(self):
        LibrarySettings.objects.filter(pk=LibrarySettings.get().pk).update(max_renewals=0)
        self.assertEqual(self.renew().json()["code"], "renew_limit")

    def test_someone_waiting_blocks_renewal(self):
        other = make_user("o@x.com")
        services.approve(self.staff, services.create_request(other, self.book))  # last free copy now held
        waiter = make_user("w@x.com")
        self.book.refresh_from_db()
        services.create_reservation(waiter, self.book)
        res = self.renew()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "renew_queue")

    def test_overdue_loans_must_be_returned(self):
        BorrowRecord.objects.filter(pk=self.loan.pk).update(due_date=timezone.now() - timedelta(days=1))
        services.run_nightly_overdue()
        res = self.renew()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()["code"], "invalid_transition")

    def test_another_overdue_loan_blocks_renewal(self):
        other_loan = borrow(self.member, self.staff, make_book())
        BorrowRecord.objects.filter(pk=other_loan.pk).update(due_date=timezone.now() - timedelta(days=1))
        services.run_nightly_overdue()
        self.assertEqual(self.renew().json()["code"], "overdue_block")

    def test_only_the_borrower_or_staff(self):
        self.assertEqual(self.renew(make_user("o@x.com")).status_code, 403)
        before = Notification.objects.filter(user=self.member).count()
        self.assertEqual(self.renew(self.staff).status_code, 200)  # at the desk, on the member's behalf
        note = Notification.objects.filter(user=self.member).order_by("-at").first()
        self.assertEqual(Notification.objects.filter(user=self.member).count(), before + 1)
        self.assertEqual(note.code, "loan_renewed")
        self.assertIn("dueDate", note.params)

    def test_pending_and_ready_records_cannot_be_renewed(self):
        pending = services.create_request(make_user("p@x.com"), self.book)
        self.assertEqual(self.renew(pending.user, pending).status_code, 409)

    def test_records_expose_the_renewal_count(self):
        data = client_for(self.member).get("/api/borrow-records/mine").json()
        row = next(r for r in data if r["id"] == self.loan.pk)
        self.assertEqual(row["renewalCount"], 0)
