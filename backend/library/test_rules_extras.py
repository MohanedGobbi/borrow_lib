"""Checks around circulation rules and renewals that the contract file (test_rules_and_renewals.py) leaves out:
the data migration, the borrow-limit fields, the waiting-list flag, the PDFs and the audit trail."""
from datetime import timedelta

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from reportlab import rl_config

from . import services
from .documents import build_request_document_pdf
from .models import ActivityLog, BorrowRecord, LibrarySettings, Role, UserProfile
from .test_rules_and_renewals import borrow, client_for, due_in
from .tests import make_book, make_user


class BorrowLimitMigrationTests(TransactionTestCase):
    """0007 sets limits equal to the old role default to null (follow the settings) and keeps the others."""

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([("library", target)])
        return executor.loader.project_state([("library", target)]).apps

    def test_old_defaults_become_null_and_overrides_stay(self):
        before = self.migrate("0006_student_control_activity_codes")
        try:
            def profile(email, role, limit):
                user = before.get_model("auth", "User").objects.create(username=email, email=email)
                before.get_model("library", "UserProfile").objects.create(
                    user=user, student_or_staff_id=email, role=role, max_borrow_limit=limit)

            profile("default-member", "MEMBER", 5)
            profile("custom-member", "MEMBER", 7)
            profile("default-staff", "STAFF", 10)
            profile("default-admin", "ADMIN", 10)
            profile("custom-staff", "STAFF", 5)  # 5 is the member default, not the staff one: a choice

            after = self.migrate("0007_library_settings_and_renewals")
            limits = dict(after.get_model("library", "UserProfile").objects.values_list("student_or_staff_id", "max_borrow_limit"))
            self.assertEqual(limits, {"default-member": None, "custom-member": 7, "default-staff": None,
                                      "default-admin": None, "custom-staff": 5})
            self.assertTrue(after.get_model("library", "LibrarySettings").objects.filter(pk=1).exists())
        finally:
            self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes("library")[0][1])


class BorrowLimitFieldTests(TestCase):
    def test_default_and_personal_limits_are_reported(self):
        admin = make_user("a@x.com", Role.ADMIN)
        follower, custom = make_user("f@x.com"), make_user("c@x.com")
        UserProfile.objects.filter(user=follower).update(max_borrow_limit=None)
        UserProfile.objects.filter(user=custom).update(max_borrow_limit=7)
        client_for(admin).patch("/api/settings", {"memberBorrowLimit": 4}, format="json")
        rows = {r["email"]: r for r in client_for(admin).get("/api/users").json()["results"]}
        self.assertEqual((rows["f@x.com"]["maxBorrowLimit"], rows["f@x.com"]["borrowLimitIsDefault"]), (4, True))
        self.assertEqual((rows["c@x.com"]["maxBorrowLimit"], rows["c@x.com"]["borrowLimitIsDefault"]), (7, False))

    def test_staff_follow_the_staff_default(self):
        staff = make_user("s@x.com", Role.STAFF)
        UserProfile.objects.filter(user=staff).update(max_borrow_limit=None)
        self.assertEqual(UserProfile.objects.get(user=staff).effective_borrow_limit, 10)
        LibrarySettings.objects.filter(pk=1).update(staff_borrow_limit=12)
        self.assertEqual(UserProfile.objects.get(user=staff).effective_borrow_limit, 12)


class RenewalDetailTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.member = make_user("m@x.com")
        self.book = make_book(copies=2)
        self.loan = due_in(borrow(self.member, self.staff, self.book), 1)

    def test_loans_flag_a_waiting_list_and_ignore_inactive_ones(self):
        mine = lambda: next(r for r in client_for(self.member).get("/api/borrow-records/mine").json()
                            if r["id"] == self.loan.pk)
        self.assertFalse(mine()["bookHasQueue"])
        other = make_user("o@x.com")
        services.approve(self.staff, services.create_request(other, self.book))
        waiter = make_user("w@x.com")
        self.book.refresh_from_db()
        reservation = services.create_reservation(waiter, self.book)
        self.assertTrue(mine()["bookHasQueue"])
        services.leave_reservation(waiter, reservation)
        self.assertFalse(mine()["bookHasQueue"])

    def test_the_trail_names_the_member_and_the_new_due_date(self):
        services.renew(self.member, self.loan)
        row = ActivityLog.objects.get(code="loan_renewed")
        self.assertEqual(row.actor_name, "m@x.com")
        self.assertEqual(set(row.params), {"member", "title", "dueDate"})
        self.loan.refresh_from_db()
        self.assertEqual(row.params["dueDate"], self.loan.due_date.isoformat())

    def test_a_member_renewing_their_own_loan_notifies_nobody(self):
        services.renew(self.member, self.loan)
        self.assertEqual(self.member.notifications.filter(code="loan_renewed").count(), 0)

    def test_the_window_edge(self):
        due_in(self.loan, 3)  # exactly three days out is still inside the window
        BorrowRecord.objects.filter(pk=self.loan.pk).update(due_date=timezone.now() + timedelta(days=3, minutes=-1))
        self.loan.refresh_from_db()
        self.assertEqual(services.renew(self.member, self.loan).renewal_count, 1)


class DocumentTests(TestCase):
    def test_the_receipt_quotes_the_current_rules(self):
        staff, member = make_user("s@x.com", Role.STAFF), make_user("m@x.com")
        LibrarySettings.objects.filter(pk=1).update(hold_hours=24, loan_days=7)
        record = borrow(member, staff, make_book())
        record = BorrowRecord.objects.select_related("user__profile", "book").get(pk=record.pk)
        rl_config.pageCompression = 0  # keep the page text readable
        try:
            pdf = build_request_document_pdf(record)
        finally:
            rl_config.pageCompression = 1
        self.assertIn(b"24-hour pickup window", pdf)
        self.assertIn(b"7-day loan from pickup", pdf)
