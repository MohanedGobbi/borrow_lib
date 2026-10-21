"""Account types, admin-created accounts, notification choices, announcements, maintenance and the inventory."""
import json

from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from . import services
from .catalogue import inventory_rows, subject_of
from .models import ActivityLog, Book, BorrowRecord, Category, Notification, Role, UserProfile
from .tests import make_book, make_user

PASSWORD = "x" * 10


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class SignupTests(TestCase):
    def test_signup_needs_name_email_phone_and_password_and_gets_a_card_number(self):
        res = APIClient().post("/api/auth/register", {
            "name": "Amina Bouaziz", "email": "amina@x.dz", "password": "shelf-mark-FIC-7",
            "phoneNumber": "0661 22 33 44", "memberType": "PROFESSOR"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        p = UserProfile.objects.get(user__email="amina@x.dz")
        self.assertEqual((p.role, p.member_type, p.language, p.phone_number), (Role.MEMBER, "PROFESSOR", "ar", "0661 22 33 44"))
        self.assertEqual(p.student_or_staff_id, f"GH-{p.pk:06d}")
        self.assertEqual(res.data["accountType"], "PROFESSOR")

    def test_phone_is_required_and_signup_cannot_choose_a_staff_type(self):
        base = {"name": "A B", "email": "a@x.dz", "password": "shelf-mark-FIC-7"}
        self.assertEqual(APIClient().post("/api/auth/register", base, format="json").status_code, 400)
        res = APIClient().post("/api/auth/register", {**base, "phoneNumber": "1", "memberType": "ADMIN"}, format="json")
        self.assertEqual(res.status_code, 400)


class AdminAccountTests(TestCase):
    def setUp(self):
        self.admin = make_user("admin@x.dz", Role.ADMIN)
        self.admin.set_password(PASSWORD)
        self.admin.save()
        self.c = client_for(self.admin)

    def test_admin_creates_any_type_with_a_password(self):
        for i, kind in enumerate(["STUDENT", "PROFESSOR", "ADMINISTRATIVE", "EXTERNAL", "LIBRARIAN", "ADMIN"]):
            res = self.c.post("/api/users", {"name": f"User {i}", "email": f"u{i}@x.dz", "phoneNumber": "0661",
                                             "password": "shelf-mark-FIC-7", "accountType": kind}, format="json")
            self.assertEqual(res.status_code, 201, res.data)
            self.assertEqual(res.data["accountType"], kind)
            self.assertTrue(res.data["emailVerified"])
        self.assertEqual(UserProfile.objects.get(user__email="u5@x.dz").role, Role.ADMIN)
        self.assertEqual(UserProfile.objects.get(user__email="u4@x.dz").role, Role.STAFF)
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(APIClient().post("/api/auth/login", {"username": "u1@x.dz", "password": "shelf-mark-FIC-7"},
                                         format="json").status_code == 200)

    def test_without_a_password_a_welcome_email_goes_out(self):
        res = self.c.post("/api/users", {"name": "Reader", "email": "r@x.dz", "phoneNumber": "0661",
                                         "accountType": "EXTERNAL"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertFalse(User.objects.get(email="r@x.dz").has_usable_password())
        self.assertEqual(len(mail.outbox), 1)

    def test_staff_cannot_create_accounts(self):
        staff = make_user("staff@x.dz", Role.STAFF)
        res = client_for(staff).post("/api/users", {"name": "R", "email": "r@x.dz", "phoneNumber": "1",
                                                    "accountType": "ADMIN"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_change_account_type_and_filter_by_it(self):
        member = make_user("m@x.dz")
        res = self.c.patch(f"/api/users/{member.profile.pk}/role", {"accountType": "PROFESSOR"}, format="json")
        self.assertEqual(res.data["accountType"], "PROFESSOR")
        res = self.c.patch(f"/api/users/{member.profile.pk}/role", {"accountType": "LIBRARIAN"}, format="json")
        self.assertEqual((res.data["role"], res.data["accountType"]), ("STAFF", "LIBRARIAN"))
        listed = self.c.get("/api/users", {"accountType": "LIBRARIAN"}).data["results"]
        self.assertEqual([u["email"] for u in listed], ["m@x.dz"])
        res = self.c.patch(f"/api/users/{self.admin.profile.pk}/role", {"accountType": "STUDENT"}, format="json")
        self.assertEqual(res.data["code"], "cannot_demote_self")


class NotificationChoiceTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.dz")
        self.staff = make_user("s@x.dz", Role.STAFF)

    def test_a_group_switched_off_is_not_stored(self):
        c = client_for(self.member)
        res = c.patch("/api/users/me", {"notificationPrefs": {"inApp": {"requests": False}}}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["notificationPrefs"]["inApp"], {"requests": False})
        record = services.create_request(self.member, make_book())
        services.approve(self.staff, record)
        self.assertFalse(Notification.objects.filter(user=self.member, code="request_approved").exists())

    def test_unknown_keys_are_refused(self):
        res = client_for(self.member).patch("/api/users/me", {"notificationPrefs": {"inApp": {"spam": True}}},
                                            format="json")
        self.assertEqual(res.status_code, 400)

    def test_staff_send_to_selected_types_and_people(self):
        prof = make_user("p@x.dz")
        prof.profile.member_type = "PROFESSOR"
        prof.profile.save()
        other = make_user("o@x.dz")
        off = make_user("off@x.dz")
        off.profile.notification_prefs = {"inApp": {"announcements": False}}
        off.profile.save()
        res = client_for(self.staff).post("/api/notifications/send", {
            "message": "المكتبة مغلقة يوم الخميس", "accountTypes": ["PROFESSOR"],
            "userIds": [other.profile.pk, off.profile.pk]}, format="json")
        self.assertEqual(res.data, {"sent": 2})
        self.assertEqual(set(Notification.objects.filter(code="announcement").values_list("user__email", flat=True)),
                         {"p@x.dz", "o@x.dz"})
        res = client_for(self.member).post("/api/notifications/send", {"message": "x", "userIds": [1]}, format="json")
        self.assertEqual(res.status_code, 403)


class MaintenanceTests(TestCase):
    def setUp(self):
        self.admin = make_user("admin@x.dz", Role.ADMIN)
        self.admin.set_password(PASSWORD)
        self.admin.save()
        self.c = client_for(self.admin)
        self.member = make_user("m@x.dz")
        self.book = make_book(copies=2)
        record = services.create_request(self.member, self.book)
        services.approve(self.admin, record)
        services.confirm_pickup(self.admin, record)

    def test_actions_need_the_password(self):
        res = self.c.post("/api/maintenance/reset-circulation", {"password": "wrong"}, format="json")
        self.assertEqual(res.data["code"], "password_incorrect")
        self.assertEqual(BorrowRecord.objects.count(), 1)

    def test_reset_circulation_puts_every_copy_back(self):
        res = self.c.post("/api/maintenance/reset-circulation", {"password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.book.refresh_from_db()
        self.assertEqual((BorrowRecord.objects.count(), self.book.available_copies), (0, 2))

    def test_delete_members_keeps_staff(self):
        self.c.post("/api/maintenance/delete-members", {"password": PASSWORD}, format="json")
        self.assertEqual(list(UserProfile.objects.values_list("role", flat=True)), [Role.ADMIN])

    def test_backup_then_restore_brings_everything_back(self):
        res = self.c.get("/api/maintenance/backup")
        self.assertEqual(res.status_code, 200)
        backup = b"".join(res.streaming_content) if res.streaming else res.content
        self.c.post("/api/maintenance/delete-catalogue", {"password": PASSWORD}, format="json")
        self.assertEqual(Book.objects.count(), 0)
        res = self.c.post("/api/maintenance/restore", {"password": PASSWORD,
                                                       "file": SimpleUploadedFile("b.json", backup)}, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((Book.objects.count(), BorrowRecord.objects.count(), res.data["accounts"]), (1, 1, 2))
        self.assertTrue(ActivityLog.objects.filter(action="BACKUP_RESTORED").exists())

    def test_a_file_that_is_not_a_backup_changes_nothing(self):
        res = self.c.post("/api/maintenance/restore", {"password": PASSWORD,
                                                       "file": SimpleUploadedFile("b.json", json.dumps([1]).encode())},
                          format="multipart")
        self.assertEqual(res.data["code"], "backup_invalid")
        self.assertEqual(Book.objects.count(), 1)

    def test_staff_cannot_use_maintenance(self):
        res = client_for(make_user("s@x.dz", Role.STAFF)).get("/api/maintenance/backup")
        self.assertEqual(res.status_code, 403)


class InventoryTests(TestCase):
    def test_the_inventory_loads_once_with_subjects_from_the_call_number(self):
        rows = inventory_rows()
        self.assertGreater(len(rows), 4000)
        from django.core.management import call_command
        call_command("load_inventory", stdout=open("/dev/null", "w"))
        self.assertEqual(Book.objects.count(), len(rows))
        call_command("load_inventory", stdout=open("/dev/null", "w"))  # again: nothing duplicated
        self.assertEqual(Book.objects.count(), len(rows))
        book = Book.objects.get(shelf_location="320.2", title="العولمة وانعكاساتها على المجتمع المسلم")
        self.assertEqual((book.total_copies, book.available_copies, book.isbn), (3, 3, None))
        self.assertEqual(book.category.name, subject_of("320.2")[0])
        self.assertTrue(Category.objects.filter(name="القانون الجنائي").exists())

    def test_an_inventory_spreadsheet_imports_without_isbn(self):
        staff = make_user("s@x.dz", Role.STAFF)
        res = client_for(staff).post("/api/books/import", {"mode": "skip", "dryRun": False, "rows": [
            {"الشفرة": "345.1.1", "الـعنـوان": "جرائم النصب", "الـمؤلـف": "", "عدد النسخ": 2, "__row": 2},
            {"الشفرة": "", "الـعنـوان": "بلا شفرة", "عدد النسخ": 1, "__row": 3},
        ]}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["summary"]["create"], 2, res.data)
        self.assertEqual(Book.objects.get(shelf_location="345.1.1").category.name, "القانون الجنائي")
        self.assertEqual(Book.objects.get(shelf_location="").category.name, "عام")


class CreateAdminCommandTests(TestCase):
    def test_creates_an_admin_who_can_sign_in(self):
        from django.core.management import call_command
        call_command("create_admin", email="Boss@X.dz", name="مدير المكتبة", phone="0661",
                     password="shelf-mark-FIC-7", stdout=open("/dev/null", "w"))
        p = UserProfile.objects.get(user__email="boss@x.dz")
        self.assertEqual(p.role, Role.ADMIN)
        res = APIClient().post("/api/auth/login", {"username": "boss@x.dz", "password": "shelf-mark-FIC-7"}, format="json")
        self.assertEqual(res.status_code, 200)
