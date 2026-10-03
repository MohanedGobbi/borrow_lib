"""Student control and copy privacy (docs/rework/D2b.md): withdraw a request or hold, leave a waiting list,
overdue copies shown as plain "on loan" to the public, and activity codes."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from . import services
from .models import ActivityLog, BorrowRecord, Notification, Reservation, Role, Status
from .test_lists import client_for
from .tests import make_book, make_user


class WithdrawTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.com")
        self.next_member = make_user("n@x.com")
        self.third = make_user("t@x.com")
        self.other = make_user("o@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        self.book = make_book(copies=1)

    def withdraw(self, user, record):
        return client_for(user).post(f"/api/borrow-records/{record.pk}/withdraw")

    def hold(self, user):
        record = services.create_request(user, self.book)
        services.approve(self.staff, record)
        return record

    def test_withdraw_from_pending(self):
        record = services.create_request(self.member, self.book)
        res = self.withdraw(self.member, record)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "CANCELLED")
        self.assertTrue(res.data["cancelledByMember"])
        record.refresh_from_db()
        self.assertEqual(record.status, Status.CANCELLED)
        self.assertTrue(record.cancelled_by_member)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)
        self.assertEqual(services.free_copies(self.book), 1)
        log = ActivityLog.objects.get(action="REQUEST_WITHDRAWN")
        self.assertEqual((log.code, log.params), ("request_withdrawn", {"member": "m@x.com", "title": self.book.title}))

    def test_withdrawing_a_ready_hold_hands_the_copy_to_the_next_in_line(self):
        record = self.hold(self.member)
        services.create_reservation(self.next_member, self.book)
        services.create_reservation(self.third, self.book)
        res = self.withdraw(self.member, record)
        self.assertEqual(res.status_code, 200, res.data)
        record.refresh_from_db()
        self.assertEqual(record.status, Status.CANCELLED)
        self.assertTrue(record.cancelled_by_member)
        handed = BorrowRecord.objects.get(user=self.next_member, book=self.book)
        self.assertEqual(handed.status, Status.READY)
        self.assertAlmostEqual((handed.pickup_deadline - timezone.now()).total_seconds(), 48 * 3600, delta=10)
        self.assertTrue(Notification.objects.filter(user=self.next_member, code="queue_handoff").exists())
        self.assertFalse(Reservation.objects.get(user=self.next_member).is_active)
        self.assertTrue(Reservation.objects.get(user=self.third).is_active)  # still waiting
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)  # stock never changes
        self.assertEqual(services.free_copies(self.book), 0)  # held for the next student
        self.assertFalse(Notification.objects.filter(user=self.member).exclude(code="request_approved").exists())

    def test_withdrawing_a_ready_hold_without_a_queue_frees_the_copy(self):
        record = self.hold(self.member)
        self.assertEqual(services.free_copies(self.book), 0)
        self.assertEqual(self.withdraw(self.member, record).status_code, 200)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)
        self.assertEqual(services.free_copies(self.book), 1)
        self.assertEqual(BorrowRecord.objects.filter(status=Status.READY).count(), 0)

    def test_someone_else_gets_a_403_and_staff_must_use_reject(self):
        record = services.create_request(self.member, self.book)
        for user in (self.other, self.staff):
            res = self.withdraw(user, record)
            self.assertEqual(res.status_code, 403, res.data)
            self.assertEqual(res.data["code"], "forbidden")
        record.refresh_from_db()
        self.assertEqual(record.status, Status.PENDING)

    def test_anonymous_is_refused(self):
        record = services.create_request(self.member, self.book)
        self.assertIn(client_for().post(f"/api/borrow-records/{record.pk}/withdraw").status_code, (401, 403))

    def test_other_states_are_a_409(self):
        record = self.hold(self.member)
        services.confirm_pickup(self.staff, record)
        res = self.withdraw(self.member, record)
        self.assertEqual(res.status_code, 409, res.data)
        self.assertEqual(res.data["code"], "invalid_transition")
        self.assertEqual(res.data["params"], {"action": "withdraw", "status": "BORROWED"})
        record.refresh_from_db()
        self.assertEqual(record.status, Status.BORROWED)
        services.confirm_return(self.staff, record)
        self.assertEqual(self.withdraw(self.member, record).status_code, 409)

    def test_withdrawing_twice_is_a_409(self):
        record = services.create_request(self.member, self.book)
        self.assertEqual(self.withdraw(self.member, record).status_code, 200)
        self.assertEqual(self.withdraw(self.member, record).status_code, 409)

    def test_withdrawn_member_can_request_again(self):
        record = services.create_request(self.member, self.book)
        self.withdraw(self.member, record)
        self.assertEqual(services.create_request(self.member, self.book).status, Status.PENDING)


class LeaveWaitingListTests(TestCase):
    def setUp(self):
        self.first = make_user("a@x.com")
        self.second = make_user("b@x.com")
        self.third = make_user("c@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        self.book = make_book(copies=1)
        holder = services.create_request(make_user("h@x.com"), self.book)
        services.approve(self.staff, holder)  # the only copy is held, so the queue is the only way in
        self.res = {u.email: services.create_reservation(u, self.book) for u in (self.first, self.second, self.third)}

    def mine(self, user):
        return {r["id"]: r["position"] for r in client_for(user).get("/api/reservations").data}

    def test_leaving_removes_you_and_moves_the_next_member_up(self):
        self.assertEqual(self.mine(self.second), {self.res["b@x.com"].pk: 2})
        res = client_for(self.first).delete(f"/api/reservations/{self.res['a@x.com'].pk}")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.mine(self.first), {})
        self.assertEqual(self.mine(self.second), {self.res["b@x.com"].pk: 1})
        self.assertEqual(self.mine(self.third), {self.res["c@x.com"].pk: 2})
        self.assertFalse(Reservation.objects.get(pk=self.res["a@x.com"].pk).is_active)

    def test_another_member_cannot_remove_you(self):
        res = client_for(self.second).delete(f"/api/reservations/{self.res['a@x.com'].pk}")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data["code"], "forbidden")
        self.assertTrue(Reservation.objects.get(pk=self.res["a@x.com"].pk).is_active)
        self.assertEqual(client_for(self.staff).delete(f"/api/reservations/{self.res['a@x.com'].pk}").status_code, 403)

    def test_leaving_twice_and_unknown_ids_are_404(self):
        url = f"/api/reservations/{self.res['a@x.com'].pk}"
        self.assertEqual(client_for(self.first).delete(url).status_code, 204)
        self.assertEqual(client_for(self.first).delete(url).status_code, 404)
        self.assertEqual(client_for(self.first).delete("/api/reservations/99999").status_code, 404)

    def test_a_member_who_left_can_join_again(self):
        client_for(self.first).delete(f"/api/reservations/{self.res['a@x.com'].pk}")
        again = services.create_reservation(self.first, self.book)
        self.assertEqual(self.mine(self.first), {again.pk: 3})


class PublicCopyPrivacyTests(TestCase):
    def setUp(self):
        self.late = make_user("late@x.com")
        self.member = make_user("m@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        self.book = make_book(copies=2)
        loan = services.create_request(self.late, self.book)
        services.approve(self.staff, loan)
        services.confirm_pickup(self.staff, loan)
        BorrowRecord.objects.filter(pk=loan.pk).update(due_date=timezone.now() - timedelta(days=3))
        services.run_nightly_overdue()
        self.assertEqual(BorrowRecord.objects.get(pk=loan.pk).status, Status.OVERDUE)

    def copies(self, user=None):
        return client_for(user).get(f"/api/books/{self.book.pk}/copies").data

    def test_public_and_members_see_an_overdue_copy_as_plain_on_loan(self):
        for user in (None, self.member, self.late):
            copies = self.copies(user)
            self.assertEqual(copies[0]["state"], "BORROWED", user)
            self.assertNotIn("dueDate", copies[0])
            self.assertNotIn("userName", copies[0])
            self.assertNotIn("OVERDUE", str(copies))

    def test_staff_still_see_overdue_with_dates_and_names(self):
        first = self.copies(self.staff)[0]
        self.assertEqual(first["state"], "OVERDUE")
        self.assertIsNotNone(first["dueDate"])
        self.assertEqual(first["userName"], "late@x.com")

    def test_a_loan_that_is_not_late_keeps_its_due_date_for_everyone(self):
        other = make_user("ok@x.com")
        record = services.create_request(other, self.book)
        services.approve(self.staff, record)
        services.confirm_pickup(self.staff, record)
        for user in (None, self.member):
            copies = self.copies(user)
            self.assertEqual([c["state"] for c in copies], ["BORROWED", "BORROWED"])
            self.assertEqual([bool(c.get("dueDate")) for c in copies], [False, True])


class ActivityCodeTests(TestCase):
    def test_activity_rows_carry_a_code_and_params(self):
        member, staff, book = make_user("m@x.com"), make_user("s@x.com", Role.STAFF), make_book()
        record = services.create_request(member, book)
        services.approve(staff, record)
        rows = {a["code"]: a for a in client_for(staff).get("/api/activity").data}
        self.assertEqual(rows["request_created"]["params"], {"member": "m@x.com", "title": book.title})
        self.assertEqual(rows["approved"]["actorName"], "s@x.com")
        self.assertEqual(rows["approved"]["params"], {"member": "m@x.com", "title": book.title})
        self.assertIn(book.title, rows["approved"]["detail"])  # the English sentence is still written
