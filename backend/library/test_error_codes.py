"""Error and notification codes (docs/rework/WP-09.md).

Every error response carries a machine-readable `code` (and `params`) next to the English `detail`,
and every code the backend can raise has an `err.<code>` translation in all three UI languages.
"""
import re
from pathlib import Path

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import BorrowRecord, Category, Role, Status
from .tests import make_book, make_user

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
BACKEND = Path(__file__).resolve().parent
I18N = BACKEND.parents[1] / "src" / "i18n" / "index.tsx"

# Raised by DRF and SimpleJWT rather than by our own code.
FRAMEWORK_CODES = [
    "not_authenticated", "authentication_failed", "permission_denied", "not_found", "throttled",
    "method_not_allowed", "parse_error", "no_active_account", "token_not_valid", "invalid",
]


class ErrorCodeTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.com")
        self.staff = make_user("s@x.com", Role.STAFF)
        self.book = make_book()
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)

    def request_book(self, book=None):
        return self.client.post("/api/borrow-records", {"bookId": (book or self.book).id}, format="json")

    def assertError(self, res, expected, code, **params):
        self.assertEqual(res.status_code, expected, res.data)
        self.assertEqual(res.data["code"], code)
        self.assertIn("detail", res.data)
        if params:
            self.assertEqual(res.data["params"], params)

    def test_borrow_limit_carries_the_limit(self):
        limited = make_user("l@x.com", limit=1)
        BorrowRecord.objects.create(user=limited, book=make_book())
        self.as_user(limited)
        self.assertError(self.request_book(), 400, "borrow_limit", limit=1)

    def test_overdue_block(self):
        BorrowRecord.objects.create(user=self.member, book=make_book(), status=Status.OVERDUE)
        self.as_user(self.member)
        self.assertError(self.request_book(), 400, "overdue_block")

    def test_no_free_copy(self):
        book = make_book(copies=1)
        book.available_copies = 0
        book.save()
        self.as_user(self.member)
        self.assertError(self.request_book(book), 400, "no_free_copy")

    def test_invalid_transition_is_a_409_with_the_action_and_status(self):
        record = BorrowRecord.objects.create(user=self.member, book=self.book, status=Status.REJECTED)
        self.as_user(self.staff)
        res = self.client.post(f"/api/borrow-records/{record.id}/approve")
        self.assertError(res, 409, "invalid_transition", action="approve", status="REJECTED")

    def test_members_only_is_a_403(self):
        self.as_user(self.staff)
        self.assertError(self.request_book(), 403, "members_only")

    def test_book_on_loan(self):
        self.book.available_copies = 1
        self.book.save()
        self.as_user(self.staff)
        self.assertError(self.client.delete(f"/api/books/{self.book.id}"), 400, "book_on_loan")

    def test_total_below_on_loan_carries_the_count(self):
        self.book.available_copies = 0  # both copies out
        self.book.save()
        self.as_user(self.staff)
        res = self.client.patch(f"/api/books/{self.book.id}", {"totalCopies": 1}, format="json")
        self.assertError(res, 400, "total_below_on_loan", onLoan=2)

    def test_category_has_books(self):
        self.as_user(self.staff)
        category = Category.objects.get(name="Fiction")
        self.assertError(self.client.delete(f"/api/categories/{category.id}"), 400, "category_has_books")

    def test_receipt_for_someone_else_is_forbidden(self):
        record = BorrowRecord.objects.create(user=self.member, book=self.book)
        self.as_user(make_user("o@x.com"))
        self.assertError(self.client.get(f"/api/borrow-records/{record.id}/document"), 403, "forbidden")

    def test_import_codes(self):
        self.as_user(self.staff)
        res = self.client.post("/api/books/import", {"rows": "nope"}, format="json")
        self.assertError(res, 400, "import_bad_rows")
        res = self.client.post("/api/books/import", {"rows": [], "mode": "merge"}, format="json")
        self.assertError(res, 400, "import_bad_mode")
        res = self.client.post("/api/books/import", {"rows": [{}] * 5001}, format="json")
        self.assertError(res, 400, "import_too_many_rows", max=5000)

    def test_not_found_has_a_code(self):
        self.as_user(self.staff)
        self.assertError(self.client.get("/api/books/9999"), 404, "not_found")

    def test_bad_password_is_no_active_account(self):
        res = self.client.post("/api/auth/login", {"username": "m@x.com", "password": "wrong-password"}, format="json")
        self.assertError(res, 401, "no_active_account")

    def test_unauthenticated_is_not_authenticated(self):
        self.assertError(self.client.get("/api/users/me"), 401, "not_authenticated")

    def test_refresh_without_a_cookie_is_no_session(self):
        res = self.client.post("/api/auth/refresh", {}, format="json", HTTP_X_LIBBORROW_CSRF="1")
        self.assertError(res, 401, "no_session")
        self.assertError(self.client.post("/api/auth/refresh", {}, format="json"), 403, "csrf_missing")

    def test_validation_errors_keep_field_messages_and_add_codes(self):
        res = self.client.post("/api/auth/register", {
            "name": "Nadia Salem", "email": "n@x.com", "studentId": "N1", "password": "password123",
        }, format="json")
        self.assertError(res, 400, "invalid")
        self.assertEqual(res.data["fieldCodes"]["password"], ["password_too_common"])
        self.assertIn("password", res.data["fields"])
        self.assertIn("password", res.data)  # DRF's own top-level keys stay

    def test_duplicate_email_is_unique(self):
        res = self.client.post("/api/auth/register", {
            "name": "Nadia Salem", "email": "m@x.com", "studentId": "N1", "password": "shelf-mark-FIC-7",
        }, format="json")
        self.assertEqual(res.data["fieldCodes"]["email"], ["unique"])


@override_settings(CACHES=LOCMEM)
class ThrottledCodeTests(TestCase):
    def test_throttled_carries_the_wait(self):
        cache.clear()
        client = APIClient()
        for _ in range(10):
            client.post("/api/auth/login", {"username": "m@x.com", "password": "wrong-password"}, format="json")
        res = client.post("/api/auth/login", {"username": "m@x.com", "password": "wrong-password"}, format="json")
        self.assertEqual(res.status_code, 429)
        self.assertEqual(res.data["code"], "throttled")
        self.assertGreater(res.data["params"]["wait"], 0)


class NotificationCodeTests(TestCase):
    def test_approval_notification_has_a_code_and_the_title(self):
        member, staff, book = make_user("m@x.com"), make_user("s@x.com", Role.STAFF), make_book()
        record = BorrowRecord.objects.create(user=member, book=book)
        client = APIClient()
        client.force_authenticate(staff)
        self.assertEqual(client.post(f"/api/borrow-records/{record.id}/approve").status_code, 200)
        client.force_authenticate(member)
        note = client.get("/api/notifications/mine").data[0]
        self.assertEqual(note["code"], "request_approved")
        self.assertEqual(note["params"], {"title": book.title})
        self.assertIn(book.title, note["message"])  # the English text is still written


class TranslationCoverageTests(TestCase):
    """Every code the backend can raise has a translation in EN, FR and AR (three occurrences of its key)."""

    def source_files(self):
        return [p for p in BACKEND.glob("*.py") if not p.name.startswith("test") and p.name != "__init__.py"]

    def scan(self, pattern):
        found = set()
        for path in self.source_files():
            found.update(re.findall(pattern, path.read_text(encoding="utf-8")))
        return found

    def assertTranslated(self, prefix, codes):
        text = I18N.read_text(encoding="utf-8")
        missing = {c: text.count(f'"{prefix}.{c}"') for c in sorted(codes) if text.count(f'"{prefix}.{c}"') < 3}
        self.assertEqual(missing, {}, f"{prefix}.<code> keys missing from some of EN / FR / AR (occurrences shown)")

    def test_error_codes_are_translated(self):
        codes = self.scan(r'\w*(?:Error_?|Forbidden|Unauthorized)\(\s*"([a-z_]+)"')
        self.assertGreaterEqual(len(codes), 28, "the scan stopped finding the backend's error codes")
        self.assertTranslated("err", codes | set(FRAMEWORK_CODES))

    def test_notification_codes_are_translated(self):
        codes = self.scan(r'notify\(\s*[\w.]+,\s*"([a-z_]+)"')
        self.assertEqual(len(codes), 7)
        self.assertTranslated("notif", codes)
