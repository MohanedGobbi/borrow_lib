from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import services
from .models import Book, BorrowRecord, Category, Reservation, Role, Status, UserProfile


def make_user(email, role=Role.MEMBER, limit=5):
    user = User.objects.create_user(username=email, email=email, password="x" * 10)
    UserProfile.objects.create(user=user, student_or_staff_id=email.split("@")[0].upper(),
                               role=role, max_borrow_limit=limit)
    return user


def make_book(copies=2):
    isbn = f"978-{Book.objects.count():010d}"[:20]
    category, _ = Category.objects.get_or_create(name="Fiction", defaults={"color": "#C55221"})
    return Book.objects.create(title=f"Book {Book.objects.count()}", author="A", isbn=isbn,
                               category=category, total_copies=copies, available_copies=copies)


class StateMachineTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        self.book = make_book()

    def test_request_creates_pending_without_touching_stock(self):
        r = services.create_request(self.member, self.book)
        self.assertEqual(r.status, Status.PENDING)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 2)

    def test_approve_sets_48h_deadline_without_touching_stock(self):
        r = services.create_request(self.member, self.book)
        services.approve(self.staff, r)
        r.refresh_from_db()
        self.assertEqual(r.status, Status.READY)
        self.assertIsNotNone(r.approved_at)
        self.assertAlmostEqual((r.pickup_deadline - r.approved_at).total_seconds(), 48 * 3600, delta=2)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 2)

    def test_pickup_decrements_stock_and_sets_14_day_due(self):
        r = services.create_request(self.member, self.book)
        services.approve(self.staff, r)
        services.confirm_pickup(self.staff, r)
        r.refresh_from_db()
        self.assertEqual(r.status, Status.BORROWED)
        self.assertAlmostEqual((r.due_date - r.borrowed_at).total_seconds(), 14 * 86400, delta=2)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)

    def test_return_increments_stock(self):
        r = services.create_request(self.member, self.book)
        services.approve(self.staff, r)
        services.confirm_pickup(self.staff, r)
        services.confirm_return(self.staff, r)
        r.refresh_from_db()
        self.assertEqual(r.status, Status.RETURNED)
        self.assertIsNotNone(r.returned_at)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 2)

    def test_reject_is_terminal(self):
        r = services.create_request(self.member, self.book)
        services.reject(self.staff, r)
        r.refresh_from_db()
        self.assertEqual(r.status, Status.REJECTED)
        with self.assertRaises(services.StateMachineError):
            services.confirm_pickup(self.staff, r)

    def test_invalid_transitions_rejected(self):
        r = services.create_request(self.member, self.book)
        with self.assertRaises(services.StateMachineError):
            services.confirm_pickup(self.staff, r)   # PENDING -> pickup
        with self.assertRaises(services.StateMachineError):
            services.confirm_return(self.staff, r)   # PENDING -> return

    def test_overdue_blocks_new_requests(self):
        r = services.create_request(self.member, self.book)
        services.approve(self.staff, r)
        services.confirm_pickup(self.staff, r)
        BorrowRecord.objects.filter(pk=r.pk).update(due_date=timezone.now() - timedelta(days=1))
        r.refresh_from_db()
        self.assertEqual(services.run_nightly_overdue(), 1)
        with self.assertRaises(services.BusinessRuleError):
            services.create_request(self.member, self.book)
        # resolving the overdue loan unblocks the member
        r.refresh_from_db()
        services.confirm_return(self.staff, r)
        self.book.refresh_from_db()
        if self.book.available_copies > 0:
            services.create_request(self.member, self.book)

    def test_borrow_limit_enforced(self):
        member = make_user("lim@x.com", limit=1)
        services.create_request(member, self.book)
        book2 = make_book()
        with self.assertRaises(services.BusinessRuleError):
            services.create_request(member, book2)

    def test_expired_ready_auto_cancels_and_hands_to_queue(self):
        r = services.create_request(self.member, self.book)
        services.approve(self.staff, r)
        # drain stock so a queue forms on a second zero-stock book scenario
        zero = make_book(copies=1)
        zero.available_copies = 0
        zero.save()
        waiter = make_user("w@x.com")
        q = services.create_reservation(waiter, zero)
        # simulate: a READY record for the zero-stock book expires
        rr = BorrowRecord.objects.create(user=self.member, book=zero, status=Status.READY,
                                         approved_at=timezone.now() - timedelta(hours=50),
                                         pickup_deadline=timezone.now() - timedelta(hours=2))
        self.assertEqual(services.run_hourly_cancellation(), 1)
        rr.refresh_from_db()
        self.assertEqual(rr.status, Status.CANCELLED)
        q.refresh_from_db()
        self.assertFalse(q.is_active)
        fresh = BorrowRecord.objects.get(user=waiter, book=zero)
        self.assertEqual(fresh.status, Status.READY)
        self.assertGreater(fresh.pickup_deadline, timezone.now())

    def test_jobs_are_idempotent(self):
        r = services.create_request(self.member, self.book)
        services.approve(self.staff, r)
        BorrowRecord.objects.filter(pk=r.pk).update(pickup_deadline=timezone.now() - timedelta(hours=1))
        self.assertEqual(services.run_hourly_cancellation(), 1)
        self.assertEqual(services.run_hourly_cancellation(), 0)


class PermissionTests(TestCase):
    def setUp(self):
        self.member = make_user("pm@x.com")
        self.staff = make_user("ps@x.com", Role.STAFF)
        self.book = make_book()
        self.mc, self.sc, self.anon = APIClient(), APIClient(), APIClient()
        self.mc.force_authenticate(self.member)
        self.sc.force_authenticate(self.staff)

    def test_catalog_is_public(self):
        self.assertEqual(self.anon.get("/api/books").status_code, 200)

    def test_member_cannot_approve(self):
        r = services.create_request(self.member, self.book)
        self.assertEqual(self.mc.post(f"/api/borrow-records/{r.pk}/approve").status_code, 403)
        self.assertEqual(self.sc.post(f"/api/borrow-records/{r.pk}/approve").status_code, 200)

    def test_member_cannot_list_all_records_or_stats(self):
        self.assertEqual(self.mc.get("/api/borrow-records").status_code, 403)
        self.assertEqual(self.mc.get("/api/dashboard/stats").status_code, 403)
        self.assertEqual(self.sc.get("/api/dashboard/stats").status_code, 200)

    def test_member_cannot_add_books(self):
        cat_id = Category.objects.get(name="Fiction").pk
        payload = {"title": "N", "author": "A", "isbn": "x-1", "categoryId": cat_id, "totalCopies": 1}
        self.assertEqual(self.mc.post("/api/books", payload, format="json").status_code, 403)
        self.assertEqual(self.sc.post("/api/books", payload, format="json").status_code, 201)

    def test_scan_lookup_is_staff_only(self):
        uuid = self.member.profile.uuid
        self.assertEqual(self.mc.get(f"/api/users/{uuid}/scan").status_code, 403)
        self.assertEqual(self.sc.get(f"/api/users/{uuid}/scan").status_code, 200)

    def test_staff_cannot_request_books(self):
        self.assertEqual(self.sc.post("/api/borrow-records", {"bookId": self.book.pk}, format="json").status_code, 403)
        self.assertEqual(self.mc.post("/api/borrow-records", {"bookId": self.book.pk}, format="json").status_code, 201)

    def test_request_document_access(self):
        r = services.create_request(self.member, self.book)
        self.assertEqual(self.mc.get(f"/api/borrow-records/{r.pk}/document").status_code, 200)
        self.assertEqual(self.sc.get(f"/api/borrow-records/{r.pk}/document").status_code, 200)
        other = make_user("other@x.com")
        oc = APIClient()
        oc.force_authenticate(other)
        self.assertEqual(oc.get(f"/api/borrow-records/{r.pk}/document").status_code, 403)

    def test_users_endpoints_and_admin_delete(self):
        self.assertEqual(self.mc.get("/api/users").status_code, 403)
        self.assertEqual(self.sc.get("/api/users").status_code, 200)
        self.assertEqual(self.sc.get(f"/api/users/{self.member.profile.pk}").status_code, 200)
        # staff cannot delete accounts; admin can
        self.assertEqual(self.sc.delete(f"/api/users/{self.member.profile.pk}/delete").status_code, 403)
        admin = make_user("adm@x.com", Role.ADMIN)
        admin.is_superuser = True
        admin.save()
        ac = APIClient()
        ac.force_authenticate(admin)
        self.assertEqual(ac.delete(f"/api/users/{self.member.profile.pk}/delete").status_code, 204)

    def test_analytics_staff_only(self):
        self.assertEqual(self.mc.get("/api/analytics").status_code, 403)
        res = self.sc.get("/api/analytics")
        self.assertEqual(res.status_code, 200)
        self.assertIn("monthly", res.json())

    def test_categories_crud(self):
        self.assertEqual(self.anon.get("/api/categories").status_code, 200)
        res = self.sc.post("/api/categories", {"name": "Poetry", "color": "#7A4E2D"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.mc.post("/api/categories", {"name": "X"}, format="json").status_code, 403)

    def test_end_to_end_flow(self):
        self.assertEqual(self.mc.post("/api/borrow-records", {"bookId": self.book.pk}, format="json").status_code, 201)
        r = BorrowRecord.objects.get(user=self.member)
        self.sc.post(f"/api/borrow-records/{r.pk}/approve")
        self.sc.post(f"/api/borrow-records/{r.pk}/confirm-pickup")
        self.sc.post(f"/api/borrow-records/{r.pk}/confirm-return")
        r.refresh_from_db()
        self.assertEqual(r.status, Status.RETURNED)
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 2)
