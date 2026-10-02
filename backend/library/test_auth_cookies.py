"""Session tokens (docs/rework/WP-05.md).

The access token is short-lived and lives only in the page's memory. The refresh token is
an httpOnly cookie scoped to /api/auth, rotated on every use and blacklisted when it is
rotated or the user signs out. Cookie-authenticated endpoints (refresh, logout) also
require the X-LibBorrow-CSRF header, which a cross-site form or image cannot send.
"""
from datetime import timedelta

from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Role
from .tests import make_book, make_user

PASSWORD = "x" * 10
COOKIE = "lb_refresh"
CSRF = {"HTTP_X_LIBBORROW_CSRF": "1"}


class CookieSessionTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.com")
        self.client = APIClient()

    def login(self, password=PASSWORD):
        return self.client.post("/api/auth/login", {"username": "m@x.com", "password": password}, format="json")

    def refresh(self, **extra):
        return self.client.post("/api/auth/refresh", {}, format="json", **{**CSRF, **extra})

    # ------------------------------------------------------------- sign in

    def test_login_returns_access_only_and_sets_refresh_cookie(self):
        res = self.login()
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("access", body)
        self.assertNotIn("refresh", body)
        cookie = res.cookies[COOKIE]
        self.assertTrue(cookie.value)
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], "/api/auth")
        self.assertEqual(cookie["samesite"].lower(), settings.AUTH_REFRESH_COOKIE["samesite"].lower())
        self.assertGreater(int(cookie["max-age"]), 0)

    def test_bad_password_sets_no_cookie(self):
        res = self.login(password="wrong-password")
        self.assertEqual(res.status_code, 401)
        self.assertNotIn(COOKIE, res.cookies)

    def test_access_token_is_short_lived(self):
        self.assertLessEqual(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"], timedelta(minutes=15))

    def test_access_token_authorizes_api_calls(self):
        access = self.login().json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get("/api/users/me").status_code, 200)

    def test_cookie_is_secure_when_configured(self):
        with override_settings(AUTH_REFRESH_COOKIE={**settings.AUTH_REFRESH_COOKIE, "secure": True}):
            self.assertTrue(self.login().cookies[COOKIE]["secure"])

    # ------------------------------------------------------------- refresh

    def test_refresh_rotates_the_cookie(self):
        first = self.login().cookies[COOKIE].value
        res = self.refresh()
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.json())
        self.assertNotIn("refresh", res.json())
        second = res.cookies[COOKIE].value
        self.assertNotEqual(first, second)

    def test_rotated_refresh_token_is_dead(self):
        old = self.login().cookies[COOKIE].value
        self.assertEqual(self.refresh().status_code, 200)
        self.client.cookies[COOKIE] = old
        self.assertEqual(self.refresh().status_code, 401)

    def test_refresh_requires_the_csrf_header(self):
        self.login()
        res = self.client.post("/api/auth/refresh", {}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_refresh_without_cookie_is_401(self):
        self.assertEqual(self.refresh().status_code, 401)

    def test_refresh_token_in_body_is_not_accepted(self):
        token = self.login().cookies[COOKIE].value
        del self.client.cookies[COOKIE]
        res = self.client.post("/api/auth/refresh", {"refresh": token}, format="json", **CSRF)
        self.assertEqual(res.status_code, 401)

    def test_refresh_token_cannot_be_used_as_bearer(self):
        token = self.login().cookies[COOKIE].value
        other = APIClient()
        other.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(other.get("/api/users/me").status_code, 401)

    # ------------------------------------------------------------- sign out

    def test_logout_clears_cookie_and_kills_the_token(self):
        token = self.login().cookies[COOKIE].value
        res = self.client.post("/api/auth/logout", {}, format="json", **CSRF)
        self.assertEqual(res.status_code, 204)
        self.assertEqual(res.cookies[COOKIE].value, "")
        self.assertEqual(int(res.cookies[COOKIE]["max-age"]), 0)
        self.client.cookies[COOKIE] = token
        self.assertEqual(self.refresh().status_code, 401)

    def test_logout_requires_the_csrf_header(self):
        self.login()
        self.assertEqual(self.client.post("/api/auth/logout", {}, format="json").status_code, 403)

    def test_logout_without_session_still_succeeds(self):
        self.assertEqual(self.client.post("/api/auth/logout", {}, format="json", **CSRF).status_code, 204)

    # ------------------------------------------------------------- accounts

    def test_deactivated_user_cannot_refresh(self):
        self.login()
        admin = APIClient()
        admin.force_authenticate(make_user("admin@x.com", Role.ADMIN))
        admin.patch(f"/api/users/{self.member.profile.pk}/active", {"active": False}, format="json")
        self.assertEqual(self.refresh().status_code, 401)

    def test_member_flow_works_end_to_end(self):
        book = make_book()
        access = self.login().json()["access"]
        access = self.refresh().json()["access"]  # e.g. after a page reload
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        res = self.client.post("/api/borrow-records", {"bookId": book.pk}, format="json")
        self.assertEqual(res.status_code, 201)
