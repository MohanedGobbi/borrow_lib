"""The hosted demo: off by default, the reset it runs nightly, and what it refuses to visitors."""
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import demo
from .models import Book, BorrowRecord, Role, UserProfile
from .tests import make_user

DEMO = {"DEMO_MODE": True, "DEMO_TITLES": 60, "CRON_SECRET": "a-long-test-cron-secret", "DEMO_PASSWORD": "Demo-Test-2026"}


class DatabaseUrlTests(TestCase):
    def test_a_neon_style_url_becomes_django_settings(self):
        from config.settings import database_from_url
        d = database_from_url("postgresql://owner:p%40ss@ep-x-pooler.eu-central-1.aws.neon.tech/neondb"
                              "?sslmode=require&channel_binding=require")
        self.assertEqual((d["ENGINE"], d["NAME"], d["USER"], d["PASSWORD"], d["HOST"]),
                         ("django.db.backends.postgresql", "neondb", "owner", "p@ss", "ep-x-pooler.eu-central-1.aws.neon.tech"))
        self.assertEqual(d["OPTIONS"], {"sslmode": "require", "channel_binding": "require"})


class DemoOffTests(TestCase):
    def test_endpoints_do_not_exist_outside_demo_mode(self):
        c = APIClient()
        self.assertEqual(c.get("/api/demo").status_code, 404)
        self.assertEqual(c.get("/api/demo/reset", {"token": "anything"}).status_code, 404)

    def test_load_demo_refuses_outside_demo_mode(self):
        make_user("real.reader@univ.test")
        with self.assertRaises(CommandError):
            call_command("load_demo")
        self.assertTrue(UserProfile.objects.filter(user__email="real.reader@univ.test").exists())


@override_settings(**DEMO)
class DemoResetTests(TestCase):
    def test_reset_builds_accounts_circulation_and_a_portion_of_the_catalogue(self):
        make_user("visitor@demo.example")
        summary = demo.reset()
        self.assertEqual(summary["books"], 60)
        self.assertFalse(UserProfile.objects.filter(user__email="visitor@demo.example").exists())
        for _key, email, *_ in demo.DEMO_ACCOUNTS:
            self.assertTrue(APIClient().post("/api/auth/login", {"username": email, "password": "Demo-Test-2026"},
                                             format="json").status_code == 200, email)
        statuses = set(BorrowRecord.objects.values_list("status", flat=True))
        self.assertTrue({"PENDING", "READY", "BORROWED", "OVERDUE", "RETURNED"} <= statuses)

    def test_reset_twice_keeps_the_catalogue_and_rebuilds_the_rest(self):
        demo.reset()
        first_ids = set(Book.objects.values_list("id", flat=True))
        demo.reset()
        self.assertEqual(set(Book.objects.values_list("id", flat=True)), first_ids)
        self.assertEqual(UserProfile.objects.filter(user__email="admin@demo.example").count(), 1)

    def test_reset_endpoint_needs_the_cron_secret(self):
        c = APIClient()
        self.assertEqual(c.get("/api/demo/reset").status_code, 403)
        self.assertEqual(c.get("/api/demo/reset", {"token": "wrong"}).status_code, 403)
        res = c.get("/api/demo/reset", HTTP_AUTHORIZATION="Bearer a-long-test-cron-secret")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["books"], 60)

    def test_info_lists_the_shared_accounts(self):
        demo.reset()
        res = APIClient().get("/api/demo")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["password"], "Demo-Test-2026")
        self.assertEqual([a["key"] for a in res.json()["accounts"]], ["reader", "overdue", "librarian", "admin"])


@override_settings(**DEMO)
class DemoGuardTests(TestCase):
    def setUp(self):
        demo.reset()
        self.admin = UserProfile.objects.get(user__email="admin@demo.example").user
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_shared_accounts_cannot_be_deactivated_or_changed(self):
        librarian = UserProfile.objects.get(user__email="librarian@demo.example")
        res = self.client.patch(f"/api/users/{librarian.pk}/active", {"active": False}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "demo_locked")
        librarian.refresh_from_db()
        self.assertTrue(librarian.active)

    def test_other_accounts_can_still_be_managed(self):
        other = make_user("someone@demo.example", Role.MEMBER).profile
        self.assertEqual(self.client.patch(f"/api/users/{other.pk}/active", {"active": False}, format="json").status_code, 200)

    def test_maintenance_actions_are_refused(self):
        res = self.client.post("/api/maintenance/delete-catalogue", {"password": "Demo-Test-2026"}, format="json")
        self.assertEqual(res.json()["code"], "demo_locked")
        self.assertEqual(Book.objects.count(), 60)

    def test_sign_up_is_confirmed_without_email(self):
        res = APIClient().post("/api/auth/register", {"name": "Test Visitor", "email": "new.visitor@demo.example",
                                                      "password": "Visitor-pass-2026", "phoneNumber": "0661000000"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(UserProfile.objects.get(user__email="new.visitor@demo.example").email_verified)
