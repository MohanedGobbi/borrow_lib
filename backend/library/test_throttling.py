"""Rate limits on the sign-in endpoints (docs/rework/WP-05.md, WP-07).

The test settings use a dummy cache so counters never leak between tests; these tests switch a
real in-memory cache on and clear it first.
"""
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .tests import make_user

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CSRF = {"HTTP_X_LIBBORROW_CSRF": "1"}


@override_settings(CACHES=LOCMEM)
class ThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def login(self, password="wrong-password"):
        return self.client.post("/api/auth/login", {"username": "m@x.com", "password": password}, format="json")

    def register(self, n):
        return self.client.post("/api/auth/register", {
            "name": "Nadia Salem", "email": f"n{n}@x.com", "studentId": f"STU-{n}",
            "password": "shelf-mark-FIC-7",
        }, format="json")

    def test_eleventh_login_in_a_minute_is_throttled(self):
        make_user("m@x.com")
        for _ in range(10):
            self.assertEqual(self.login().status_code, 401)
        res = self.login()
        self.assertEqual(res.status_code, 429)
        self.assertIn("Retry-After", res)

    def test_correct_password_is_throttled_too(self):
        make_user("m@x.com")
        for _ in range(10):
            self.login()
        self.assertEqual(self.login(password="x" * 10).status_code, 429)

    def test_register_has_its_own_limit(self):
        for n in range(5):
            self.assertEqual(self.register(n).status_code, 201)
        self.assertEqual(self.register(5).status_code, 429)
        # Login uses a separate scope and is unaffected.
        make_user("m@x.com")
        self.assertEqual(self.login(password="x" * 10).status_code, 200)

    def test_login_limit_does_not_block_register(self):
        for _ in range(11):
            self.login()
        self.assertEqual(self.register(0).status_code, 201)

    def test_refresh_is_limited_to_thirty_a_minute(self):
        for _ in range(30):
            self.assertEqual(self.client.post("/api/auth/refresh", {}, format="json", **CSRF).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/refresh", {}, format="json", **CSRF).status_code, 429)
