"""Phase 0 circulation-rule regressions (docs/rework/WP-02.md).

1. The scheduled jobs must run outside a request/test transaction on PostgreSQL.
2. A returned copy goes to the head of the reservation queue, not to whoever asks first.
3. A deactivated member can neither sign in nor borrow.
4. Staff cannot approve more requests than there are free copies.

"Free copies" = available_copies minus copies held for pickup (READY records).
available_copies itself still changes only at pickup (-1) and return (+1).
"""
from contextlib import contextmanager
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.db import connection
from django.db.transaction import TransactionManagementError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import services
from .models import ActivityLog, BorrowRecord, Notification, Reservation, Role, Status
from .tests import make_book, make_user

PASSWORD = "x" * 10  # make_user's password


@contextmanager
def postgres_row_locking():
    """Make SQLite enforce select_for_update's transaction rule the way PostgreSQL does.

    SQLite has no row locks, so Django silently ignores select_for_update() there and
    a lock taken outside a transaction goes unnoticed. With has_select_for_update on,
    Django raises TransactionManagementError exactly as it would on PostgreSQL; the
    FOR UPDATE clause itself is blanked so SQLite can still run the query.
    """
    with mock.patch.object(connection.features, "has_select_for_update", True), \
            mock.patch.object(connection.ops, "for_update_sql", return_value=""):
        yield


def borrow(member, staff, book):
    record = services.create_request(member, book)
    services.approve(staff, record)
    services.confirm_pickup(staff, record)
    return record


# --------------------------------------------------------------- 1. jobs on PostgreSQL

class JobsOutsideTransactionTests(TransactionTestCase):
    """TransactionTestCase: no wrapping transaction, so this is how cron runs the jobs."""

    def setUp(self):
        self.member = make_user("m@x.com")
        self.waiter = make_user("w@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        now = timezone.now()
        # An expired hold on a book with a waiting list...
        self.held_book = make_book(copies=1)
        self.expired = BorrowRecord.objects.create(
            user=self.member, book=self.held_book, status=Status.READY,
            approved_at=now - timedelta(hours=50), pickup_deadline=now - timedelta(hours=2))
        services.create_reservation(self.waiter, self.held_book)
        # ...and a loan past its due date.
        self.late = BorrowRecord.objects.create(
            user=self.member, book=make_book(), status=Status.BORROWED,
            borrowed_at=now - timedelta(days=20), due_date=now - timedelta(days=6))

    def test_harness_reproduces_postgres_behaviour(self):
        with postgres_row_locking(), self.assertRaises(TransactionManagementError):
            list(BorrowRecord.objects.select_for_update())

    def test_hourly_cancellation(self):
        with postgres_row_locking():
            self.assertEqual(services.run_hourly_cancellation(), 1)
        self.expired.refresh_from_db()
        self.assertEqual(self.expired.status, Status.CANCELLED)
        self.assertEqual(BorrowRecord.objects.get(user=self.waiter).status, Status.READY)

    def test_nightly_overdue(self):
        with postgres_row_locking():
            self.assertEqual(services.run_nightly_overdue(), 1)
        self.late.refresh_from_db()
        self.assertEqual(self.late.status, Status.OVERDUE)

    def test_management_commands(self):
        with postgres_row_locking():
            call_command("cancel_expired_pickups", stdout=StringIO())
            call_command("mark_overdue", stdout=StringIO())
        self.assertEqual(BorrowRecord.objects.filter(status=Status.CANCELLED).count(), 1)
        self.assertEqual(BorrowRecord.objects.filter(status=Status.OVERDUE).count(), 1)

    def test_run_jobs_endpoint(self):
        client = APIClient()
        client.force_authenticate(self.staff)
        with postgres_row_locking():
            res = client.post("/api/jobs/run")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"cancelled": 1, "flaggedOverdue": 1, "remindersSent": 0})


# ------------------------------------------------------- 2. returns serve the queue first

class ReturnServesQueueTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.reader = make_user("reader@x.com")
        self.first = make_user("first@x.com")
        self.second = make_user("second@x.com")
        self.book = make_book(copies=1)
        self.loan = borrow(self.reader, self.staff, self.book)
        self.book.refresh_from_db()  # pickup updated stock on a locked copy of the row
        services.create_reservation(self.first, self.book)
        services.create_reservation(self.second, self.book)

    def test_returned_copy_is_held_for_first_in_queue(self):
        notified_before = Notification.objects.filter(user=self.first).count()
        services.confirm_return(self.staff, self.loan)

        hold = BorrowRecord.objects.get(user=self.first, book=self.book)
        self.assertEqual(hold.status, Status.READY)
        self.assertAlmostEqual((hold.pickup_deadline - hold.approved_at).total_seconds(),
                               48 * 3600, delta=2)
        self.assertGreater(hold.pickup_deadline, timezone.now() + timedelta(hours=47))
        self.assertFalse(Reservation.objects.get(user=self.first, book=self.book).is_active)
        self.assertTrue(Reservation.objects.get(user=self.second, book=self.book).is_active)
        self.assertEqual(Notification.objects.filter(user=self.first).count(), notified_before + 1)
        self.assertTrue(ActivityLog.objects.filter(action="QUEUE_HANDOFF").exists())
        # Stock only moves at pickup and return; the hold does not touch it.
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)

    def test_held_copy_cannot_be_taken_by_someone_else(self):
        services.confirm_return(self.staff, self.loan)
        self.book.refresh_from_db()
        latecomer = make_user("late@x.com")
        with self.assertRaises(services.BusinessRuleError):
            services.create_request(latecomer, self.book)
        services.create_reservation(latecomer, self.book)  # the queue is open instead

    def test_queue_holder_can_pick_up(self):
        services.confirm_return(self.staff, self.loan)
        hold = BorrowRecord.objects.get(user=self.first, book=self.book)
        services.confirm_pickup(self.staff, hold)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 0)

    def test_deactivated_members_are_skipped(self):
        self.first.profile.active = False
        self.first.profile.save()
        services.confirm_return(self.staff, self.loan)
        self.assertFalse(BorrowRecord.objects.filter(user=self.first, book=self.book).exists())
        self.assertFalse(Reservation.objects.get(user=self.first, book=self.book).is_active)
        self.assertEqual(BorrowRecord.objects.get(user=self.second, book=self.book).status, Status.READY)

    def test_return_without_queue_frees_the_copy(self):
        Reservation.objects.filter(book=self.book).update(is_active=False)
        services.confirm_return(self.staff, self.loan)
        self.assertFalse(BorrowRecord.objects.filter(book=self.book, status=Status.READY).exists())
        self.book.refresh_from_db()
        services.create_request(make_user("next@x.com"), self.book)

    def test_return_through_the_api(self):
        client = APIClient()
        client.force_authenticate(self.staff)
        res = client.post(f"/api/borrow-records/{self.loan.pk}/confirm-return")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(BorrowRecord.objects.get(user=self.first, book=self.book).status, Status.READY)


# ------------------------------------------------------------ 3. deactivated members

class DeactivatedMemberTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.com")
        self.book = make_book()
        admin = make_user("admin@x.com", Role.ADMIN)
        self.admin = APIClient()
        self.admin.force_authenticate(admin)
        self.client = APIClient()

    def login(self):
        return self.client.post("/api/auth/login",
                                {"username": "m@x.com", "password": PASSWORD}, format="json")

    def set_active(self, active):
        res = self.admin.patch(f"/api/users/{self.member.profile.pk}/active",
                               {"active": active}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_cannot_sign_in(self):
        self.assertEqual(self.login().status_code, 200)
        self.set_active(False)
        self.assertEqual(self.login().status_code, 401)

    def test_existing_tokens_stop_working(self):
        tokens = self.login().json()
        self.set_active(False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.get("/api/users/me").status_code, 401)
        res = self.client.post("/api/borrow-records", {"bookId": self.book.pk}, format="json")
        self.assertEqual(res.status_code, 401)
        self.client.credentials()
        # The refresh token travels in the httpOnly cookie set at login (WP-05).
        res = self.client.post("/api/auth/refresh", {}, format="json", HTTP_X_LIBBORROW_CSRF="1")
        self.assertEqual(res.status_code, 401)

    def test_reactivation_restores_access(self):
        self.set_active(False)
        self.set_active(True)
        self.assertEqual(self.login().status_code, 200)

    def test_services_refuse_inactive_profiles(self):
        """Defence in depth: a profile switched off outside the API (e.g. Django admin)."""
        self.member.profile.active = False
        self.member.profile.save()
        with self.assertRaises(services.BusinessRuleError):
            services.create_request(self.member, self.book)
        self.book.available_copies = 0
        self.book.save()
        with self.assertRaises(services.BusinessRuleError):
            services.create_reservation(self.member, self.book)


# ------------------------------------------------------- 4. approvals respect free copies

class ApprovalStockTests(TestCase):
    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.a = make_user("a@x.com")
        self.b = make_user("b@x.com")
        self.book = make_book(copies=1)

    def test_cannot_approve_more_requests_than_free_copies(self):
        ra = services.create_request(self.a, self.book)
        rb = services.create_request(self.b, self.book)
        services.approve(self.staff, ra)
        with self.assertRaises(services.BusinessRuleError):
            services.approve(self.staff, rb)
        rb.refresh_from_db()
        self.assertEqual(rb.status, Status.PENDING)

    def test_api_returns_400(self):
        ra = services.create_request(self.a, self.book)
        rb = services.create_request(self.b, self.book)
        services.approve(self.staff, ra)
        client = APIClient()
        client.force_authenticate(self.staff)
        self.assertEqual(client.post(f"/api/borrow-records/{rb.pk}/approve").status_code, 400)

    def test_pending_request_can_be_approved_once_a_copy_is_free(self):
        ra = services.create_request(self.a, self.book)
        rb = services.create_request(self.b, self.book)
        services.approve(self.staff, ra)
        services.confirm_pickup(self.staff, ra)
        services.confirm_return(self.staff, ra)
        services.approve(self.staff, rb)
        rb.refresh_from_db()
        self.assertEqual(rb.status, Status.READY)

    def test_new_requests_go_to_the_queue_while_every_copy_is_held(self):
        services.approve(self.staff, services.create_request(self.a, self.book))
        with self.assertRaises(services.BusinessRuleError):
            services.create_request(self.b, self.book)
        services.create_reservation(self.b, self.book)

    def test_book_api_reports_free_copies(self):
        services.approve(self.staff, services.create_request(self.a, self.book))
        data = APIClient().get(f"/api/books/{self.book.pk}").json()
        self.assertEqual(data["availableCopies"], 1)
        self.assertEqual(data["freeCopies"], 0)
        listed = APIClient().get("/api/books").json()["results"]
        self.assertEqual(listed[0]["freeCopies"], 0)

