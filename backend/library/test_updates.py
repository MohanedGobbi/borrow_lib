"""The admin page's view of automatic updates: the installed version, the server's report, "check now"."""
import json
import tempfile
from pathlib import Path

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import ActivityLog, Role
from .tests import make_user

PASSWORD = "x" * 10
URL = "/api/maintenance/update"


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class UpdateTests(TestCase):
    def setUp(self):
        self.admin = client_for(make_user("admin@x.dz", Role.ADMIN))
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        self.status_file = self.dir / "status.json"
        self.request_dir = self.dir / "update-request"
        self.request_file = self.request_dir / "requested"
        paths = override_settings(UPDATE_STATUS_FILE=str(self.status_file), UPDATE_REQUEST_FILE=str(self.request_file))
        paths.enable()
        self.addCleanup(paths.disable)

    def switch_on(self):
        self.request_dir.mkdir()  # what install.sh --auto-update does

    def test_off_when_the_server_was_not_set_up_for_it(self):
        res = self.admin.get(URL)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["available"])
        self.assertTrue(res.data["version"])  # from package.json in a checkout
        res = self.admin.post(URL, {"password": PASSWORD}, format="json")
        self.assertEqual((res.status_code, res.data["code"]), (400, "update_unavailable"))
        self.assertFalse(self.request_file.exists())

    def test_shows_the_report_of_the_last_run(self):
        self.switch_on()
        self.status_file.write_text(json.dumps({
            "state": "failed", "message": "Version 1.0.2 did not start.", "installed": "1.0.1", "latest": "1.0.2",
            "repo": "o/r", "at": "2026-11-08T03:41:00+00:00"}), encoding="utf-8")
        res = self.admin.get(URL)
        self.assertTrue(res.data["available"])
        self.assertEqual((res.data["state"], res.data["latest"], res.data["checkedAt"]),
                         ("failed", "1.0.2", "2026-11-08T03:41:00+00:00"))

    def test_a_report_it_cannot_read_is_ignored(self):
        self.switch_on()
        self.status_file.write_text("{not json", encoding="utf-8")
        self.assertEqual(self.admin.get(URL).data["state"], "")
        self.status_file.write_text(json.dumps({"state": "rm -rf"}), encoding="utf-8")
        self.assertEqual(self.admin.get(URL).data["state"], "")

    def test_check_now_needs_the_password_and_leaves_a_request_for_the_server(self):
        self.switch_on()
        res = self.admin.post(URL, {"password": "wrong"}, format="json")
        self.assertEqual(res.data["code"], "password_incorrect")
        self.assertFalse(self.request_file.exists())
        res = self.admin.post(URL, {"password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 202, res.data)
        self.assertTrue(self.request_file.exists())
        self.assertTrue(res.data["requested"])
        self.assertTrue(ActivityLog.objects.filter(action="UPDATE_REQUESTED").exists())

    def test_admins_only(self):
        self.switch_on()
        librarian = client_for(make_user("lib@x.dz", Role.STAFF))
        self.assertEqual(librarian.get(URL).status_code, 403)
        self.assertEqual(librarian.post(URL, {"password": PASSWORD}, format="json").status_code, 403)
        self.assertFalse(self.request_file.exists())

    def test_refused_in_the_demo(self):
        self.switch_on()
        with override_settings(DEMO_MODE=True):
            self.assertFalse(self.admin.get(URL).data["available"])
            res = self.admin.post(URL, {"password": PASSWORD}, format="json")
        self.assertEqual(res.data["code"], "demo_locked")
        self.assertFalse(self.request_file.exists())
