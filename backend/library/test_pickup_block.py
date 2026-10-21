"""An overdue loan also blocks picking up an approved hold (owner rule).

The hold keeps its deadline: it can still expire and pass to the next member in the queue while the
member is blocked.
"""
from datetime import timedelta

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from . import services
from .models import BorrowRecord, Reservation, Role, Status
from .tests import make_book, make_user


class PickupBlockTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        self.overdue_book = make_book(copies=1)
        self.overdue_book.available_copies = 0  # the late copy is out
        self.overdue_book.save()
        self.late = BorrowRecord.objects.create(
            user=self.member, book=self.overdue_book, status=Status.OVERDUE,
            borrowed_at=timezone.now() - timedelta(days=20), due_date=timezone.now() - timedelta(days=6))
        self.book = make_book(copies=2)
        self.hold = self.ready_hold(self.member, self.book)

    def ready_hold(self, user, book, **extra):
        return BorrowRecord.objects.create(
            user=user, book=book, status=Status.READY,
            approved_at=timezone.now(), pickup_deadline=timezone.now() + timedelta(hours=40), **extra)

    def pickup(self, record=None):
        return self.client.post(f"/api/borrow-records/{(record or self.hold).id}/confirm-pickup")

    def test_overdue_member_gets_a_400_with_the_code_and_the_title_and_stock_is_unchanged(self):
        res = self.pickup()
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data["code"], "pickup_blocked_overdue")
        self.assertEqual(res.data["params"], {"title": self.overdue_book.title})
        self.book.refresh_from_db()
        self.hold.refresh_from_db()
        self.assertEqual(self.book.available_copies, 2)
        self.assertEqual(self.hold.status, Status.READY)
        self.assertIsNone(self.hold.borrowed_at)

    def test_pickup_succeeds_once_the_overdue_book_is_returned(self):
        self.assertEqual(self.pickup().status_code, 400)
        self.assertEqual(self.client.post(f"/api/borrow-records/{self.late.id}/confirm-return").status_code, 200)
        res = self.pickup()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "BORROWED")
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)

    def test_a_member_without_overdue_loans_is_unaffected(self):
        other = make_user("o@x.com")
        BorrowRecord.objects.create(user=other, book=self.overdue_book, status=Status.BORROWED,
                                    borrowed_at=timezone.now(), due_date=timezone.now() + timedelta(days=10))
        res = self.pickup(self.ready_hold(other, self.book))
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "BORROWED")

    def test_a_status_error_still_wins_over_the_block(self):
        # The transition check comes first: a record that is not READY is a 409, not a 400.
        pending = BorrowRecord.objects.create(user=self.member, book=self.book, status=Status.PENDING)
        res = self.pickup(pending)
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.data["code"], "invalid_transition")

    def test_the_hold_still_expires_normally_while_blocked(self):
        waiting = make_user("w@x.com")
        full = make_book(copies=1)
        hold = BorrowRecord.objects.create(user=self.member, book=full, status=Status.READY,
                                           approved_at=timezone.now() - timedelta(hours=49),
                                           pickup_deadline=timezone.now() - timedelta(hours=1))
        Reservation.objects.create(user=waiting, book=full)
        before = hold.pickup_deadline
        self.assertEqual(self.pickup(hold).status_code, 400)
        hold.refresh_from_db()
        self.assertEqual(hold.pickup_deadline, before, "being blocked must not extend the hold")
        self.assertEqual(services.run_hourly_cancellation(), 1)
        hold.refresh_from_db()
        self.assertEqual(hold.status, Status.CANCELLED)
        handoff = BorrowRecord.objects.get(user=waiting, book=full)
        self.assertEqual(handoff.status, Status.READY)
        self.assertGreater(handoff.pickup_deadline, timezone.now() + timedelta(hours=47))

    def test_desk_records_carry_the_title_to_return_first(self):
        rows = self.client.get("/api/borrow-records?status=READY").json()["results"]
        mine = next(r for r in rows if r["id"] == self.hold.id)
        self.assertTrue(mine["memberHasOverdue"])
        self.assertEqual(mine["memberOverdueTitle"], self.overdue_book.title)
        clean = self.ready_hold(make_user("o@x.com"), self.book)
        rows = self.client.get("/api/borrow-records?status=READY").json()["results"]
        self.assertIsNone(next(r for r in rows if r["id"] == clean.id)["memberOverdueTitle"])

    def test_the_title_comes_without_a_query_per_row(self):
        def queries(url):
            with CaptureQueriesContext(connection) as ctx:
                self.client.get(url)
            return len(ctx)

        baseline = queries("/api/borrow-records?status=READY")
        for i in range(4):
            member = make_user(f"x{i}@x.com")
            BorrowRecord.objects.create(user=member, book=self.overdue_book, status=Status.OVERDUE,
                                        borrowed_at=timezone.now() - timedelta(days=20),
                                        due_date=timezone.now() - timedelta(days=1))
            self.ready_hold(member, self.book)
        self.assertEqual(queries("/api/borrow-records?status=READY"), baseline)

    def test_due_before_filters_the_loans(self):
        soon = BorrowRecord.objects.create(
            user=self.member, book=self.book, status=Status.BORROWED,
            borrowed_at=timezone.now() - timedelta(days=12), due_date=timezone.now() + timedelta(days=2))
        later = BorrowRecord.objects.create(
            user=self.member, book=self.book, status=Status.BORROWED,
            borrowed_at=timezone.now(), due_date=timezone.now() + timedelta(days=12))
        cutoff = (timezone.now() + timedelta(days=3)).isoformat()
        res = self.client.get("/api/borrow-records", {"status": "BORROWED", "due_before": cutoff}).json()
        ids = [r["id"] for r in res["results"]]
        self.assertEqual(ids, [soon.id])
        self.assertNotIn(later.id, ids)

    def test_the_book_carries_the_one_active_loan_for_staff_only(self):
        res = self.client.get(f"/api/books/{self.overdue_book.id}").json()
        self.assertEqual(res["activeLoanId"], self.late.id)
        self.assertEqual(res["activeLoanMember"], "m@x.com")
        listed = self.client.get("/api/books", {"search": self.overdue_book.title}).json()["results"]
        self.assertEqual(listed[0]["activeLoanId"], self.late.id)
        # two active loans: there is no single loan to return from the search
        BorrowRecord.objects.create(user=make_user("o@x.com"), book=self.overdue_book, status=Status.BORROWED,
                                    borrowed_at=timezone.now(), due_date=timezone.now() + timedelta(days=5))
        self.assertIsNone(self.client.get(f"/api/books/{self.overdue_book.id}").json()["activeLoanId"])
        # students and visitors never see borrower data
        self.client.force_authenticate(self.member)
        self.assertIsNone(self.client.get(f"/api/books/{self.overdue_book.id}").json()["activeLoanId"])
        self.client.force_authenticate(None)
        self.assertIsNone(self.client.get(f"/api/books/{self.overdue_book.id}").json()["activeLoanId"])


class OverdueBlocksWaitingListTests(TestCase):
    """The overdue rule covers every new request, waiting lists included."""

    def test_overdue_member_cannot_join_a_waiting_list(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import BorrowRecord, Role, Status
        from .tests import make_book, make_user
        staff, member = make_user("s2@x.com", Role.STAFF), make_user("late@x.com")
        loan = services.create_request(member, make_book())
        services.approve(staff, loan)
        services.confirm_pickup(staff, loan)
        BorrowRecord.objects.filter(pk=loan.pk).update(due_date=timezone.now() - timedelta(days=1))
        services.run_nightly_overdue()
        full = make_book(copies=1)
        full.available_copies = 0
        full.save()
        with self.assertRaises(services.BusinessRuleError) as ctx:
            services.create_reservation(member, full)
        self.assertEqual(ctx.exception.code, "overdue_block")

