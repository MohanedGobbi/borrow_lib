import io
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import services
from .models import ActivityLog, Book, BorrowRecord, Category, Reservation, Role, Status, UserProfile


def make_user(email, role=Role.MEMBER, limit=5):
    user = User.objects.create_user(username=email, email=email, password="x" * 10)
    UserProfile.objects.create(user=user, student_or_staff_id=email.split("@")[0].upper(),
                               role=role, max_borrow_limit=limit)
    return user


def make_book(copies=2):
    isbn = f"978-{Book.objects.count():010d}"[:20]
    category, _ = Category.objects.get_or_create(name="Fiction", defaults={"color": "#1F6E43"})
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
        # simulate: the only copy is held (READY) and the hold expires; a member is queued
        rr = BorrowRecord.objects.create(user=self.member, book=zero, status=Status.READY,
                                         approved_at=timezone.now() - timedelta(hours=50),
                                         pickup_deadline=timezone.now() - timedelta(hours=2))
        waiter = make_user("w@x.com")
        q = services.create_reservation(waiter, zero)
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


class BookCopiesTests(TestCase):
    """GET /api/books/<id>/copies: one row per physical copy, names only for staff."""

    def setUp(self):
        self.member = make_user("m@x.com")
        self.other = make_user("o@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        self.book = make_book(copies=3)
        self.client = APIClient()
        # copy 1 on loan to member, copy 2 held for other, copy 3 on the shelf
        loan = services.create_request(self.member, self.book)
        services.approve(self.staff, loan)
        services.confirm_pickup(self.staff, loan)
        held = services.create_request(self.other, self.book)
        services.approve(self.staff, held)

    def get(self, user=None):
        self.client.force_authenticate(user)
        return self.client.get(f"/api/books/{self.book.id}/copies")

    def test_every_copy_is_accounted_for(self):
        res = self.get()
        self.assertEqual(res.status_code, 200)
        self.assertEqual([c["state"] for c in res.data], ["BORROWED", "HELD", "ON_SHELF"])
        self.assertEqual([c["copy"] for c in res.data], [1, 2, 3])
        self.assertIsNotNone(res.data[0]["dueDate"])

    def test_borrower_names_hidden_from_public_and_members(self):
        for user in (None, self.member):
            for copy in self.get(user).data:
                self.assertNotIn("userName", copy)

    def test_staff_see_who_has_each_copy(self):
        data = self.get(self.staff).data
        self.assertEqual(data[0]["userName"], "m@x.com")
        self.assertEqual(data[1]["userName"], "o@x.com")
        self.assertNotIn("userName", data[2])

    def test_overdue_copy_is_reported(self):
        BorrowRecord.objects.filter(book=self.book, status=Status.BORROWED).update(
            due_date=timezone.now() - timedelta(days=1))
        services.run_nightly_overdue()
        self.assertEqual(self.get().data[0]["state"], "OVERDUE")


class PdfTests(TestCase):
    def test_id_card_and_receipt_render(self):
        from .documents import request_document_response
        from .idcard import build_id_card_pdf
        member, staff, book = make_user("m@x.com"), make_user("s@x.com", Role.STAFF), make_book()
        record = services.create_request(member, book)
        services.approve(staff, record)
        self.assertTrue(build_id_card_pdf(member).startswith(b"%PDF"))
        self.assertTrue(request_document_response(record).content.startswith(b"%PDF"))


class RegistrationTests(TestCase):
    def test_weak_passwords_rejected(self):
        client = APIClient()
        base = {"name": "Nadia Salem", "email": "nadia@x.com", "studentId": "STU-1"}
        for weak in ("password", "12345678", "nadia@x.com"):
            res = client.post("/api/auth/register", {**base, "password": weak}, format="json")
            self.assertEqual(res.status_code, 400, weak)
        res = client.post("/api/auth/register", {**base, "password": "shelf-mark-FIC-7"}, format="json")
        self.assertEqual(res.status_code, 201)


class BookImportTests(TestCase):
    """Bulk import: POST /api/books/import and the import_books command."""

    def setUp(self):
        self.staff = make_user("s@x.com", Role.STAFF)
        self.member = make_user("m@x.com")
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        self.existing = make_book(copies=2)
        self.existing.isbn = "978-0441172719"   # hyphenated, as typed by staff
        self.existing.save()

    def post(self, rows, **body):
        return self.client.post("/api/books/import", {"rows": rows, **body}, format="json")

    def test_dry_run_previews_without_writing(self):
        rows = [
            {"ISBN": "9780062316097", "Titre": "Sapiens", "Auteur": "Harari", "Exemplaires": "3", "Cote": "HIS-B-11"},
            {"ISBN": "9780441172719", "Titre": "Dune", "Auteur": "Herbert"},  # existing, no hyphens
            {"ISBN": "123", "Titre": "Bad", "Auteur": "X"},
            {"ISBN": "", "Titre": "", "Auteur": ""},  # blank line: ignored
        ]
        res = self.post(rows)
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r["status"] for r in res.data["rows"]], ["create", "skip", "error"])
        self.assertEqual(res.data["rows"][2]["errors"], [{"code": "isbn_invalid"}])
        self.assertEqual(res.data["columns"]["Cote"], "shelfLocation")
        self.assertEqual(Book.objects.count(), 1)

    def test_import_creates_valid_rows_and_skips_errors(self):
        rows = [
            {"isbn": "978-0-06-231609-7", "title": "Sapiens", "author": "Harari", "copies": 3,
             "category": "History", "year": 2015},
            {"isbn": "9780062316097", "title": "Sapiens again", "author": "Harari"},  # duplicate in file
            {"isbn": "0-201-89683-4", "title": "TAOCP", "author": "Knuth", "year": "not a year"},
        ]
        res = self.post(rows, dryRun=False, filename="catalogue.csv")
        self.assertEqual(res.data["summary"]["create"], 1)
        self.assertEqual(res.data["summary"]["error"], 2)
        self.assertEqual(res.data["rows"][1]["errors"], [{"code": "isbn_duplicate", "row": 1}])
        book = Book.objects.get(isbn="9780062316097")
        self.assertEqual((book.total_copies, book.available_copies, book.year), (3, 3, 2015))
        self.assertEqual(book.category.name, "History")
        self.assertTrue(ActivityLog.objects.filter(action="BOOKS_IMPORTED").exists())

    def test_update_mode_respects_copies_on_loan(self):
        loan = services.create_request(self.member, self.existing)
        services.approve(self.staff, loan)
        services.confirm_pickup(self.staff, loan)
        row = {"isbn": "9780441172719", "title": "Dune (revised)", "author": "Herbert"}
        res = self.post([{**row, "copies": 0}], mode="update", dryRun=False)
        self.assertEqual(res.data["rows"][0]["errors"], [{"code": "copies_invalid", "max": 1000}])
        res = self.post([{**row, "copies": 0.5}], mode="update")
        self.assertEqual(res.data["rows"][0]["status"], "error")
        res = self.post([{**row, "copies": 5}], mode="update", dryRun=False)
        self.assertEqual(res.data["rows"][0]["status"], "update")
        self.assertIn("title", res.data["rows"][0]["changes"])
        self.existing.refresh_from_db()
        self.assertEqual((self.existing.title, self.existing.total_copies, self.existing.available_copies),
                         ("Dune (revised)", 5, 4))

    def test_missing_required_columns_reported(self):
        res = self.post([{"Name": "Dune", "Writer": "Herbert"}])
        self.assertEqual(res.data["missingColumns"], ["isbn", "title"])

    def test_members_cannot_import(self):
        client = APIClient()
        client.force_authenticate(self.member)
        res = client.post("/api/books/import", {"rows": []}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_command_reads_xlsx_csv_and_json(self):
        import json as jsonlib
        import tempfile
        from pathlib import Path
        from django.core.management import call_command
        from openpyxl import Workbook

        with tempfile.TemporaryDirectory() as tmp:
            wb = Workbook()
            wb.active.append(["ISBN", "Title", "Author", "Copies"])
            wb.active.append([9780062316097, "Sapiens", "Harari", 2])  # ISBN stored as a number
            wb.save(Path(tmp, "books.xlsx"))
            Path(tmp, "books.csv").write_text("titre;auteur;isbn\nDune;Herbert;9780441172719\n"
                                              "Meditations;Aurelius;9780812968255\n", encoding="utf-8-sig")
            Path(tmp, "books.json").write_text(jsonlib.dumps({"books": [
                {"isbn": "9781476733524", "title": "The Gene", "author": "Mukherjee"}]}))
            for name in ("books.xlsx", "books.csv", "books.json"):
                call_command("import_books", str(Path(tmp, name)), stdout=io.StringIO())

        titles = set(Book.objects.values_list("title", flat=True))
        self.assertTrue({"Sapiens", "Meditations", "The Gene"} <= titles)
        self.assertEqual(Book.objects.filter(title="Dune").count(), 0)  # existing one kept (skip mode)


class ProfileUpdateTests(TestCase):
    def test_members_cannot_change_their_own_role_or_active_flag(self):
        member = make_user("m@x.com")
        client = APIClient()
        client.force_authenticate(member)
        res = client.patch("/api/users/me", {"role": "ADMIN", "active": False, "phoneNumber": "123"}, format="json")
        self.assertEqual(res.status_code, 200)
        member.profile.refresh_from_db()
        self.assertEqual((member.profile.role, member.profile.active, member.profile.phone_number),
                         (Role.MEMBER, True, "123"))
