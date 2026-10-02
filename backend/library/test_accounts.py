"""Password reset, email verification and staff invites (docs/rework/WP-08.md)."""
import re
from datetime import timedelta

from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Role, StaffInvite, UserProfile
from .tests import make_book, make_user

PASSWORD = "x" * 10
NEW_PASSWORD = "shelf-mark-HIS-42"
CSRF = {"HTTP_X_LIBBORROW_CSRF": "1"}


def link_params(pattern, message):
    match = re.search(pattern, message.body)
    assert match, f"no link matching {pattern!r} in:\n{message.body}"
    return match.groups()


def reset_link(message):
    return link_params(r"/reset-password\?uid=([\w-]+)&token=([\w-]+)", message)


def verify_link(message):
    return link_params(r"/verify-email\?uid=([\w-]+)&token=([\w-]+)", message)


def invite_link(message):
    return link_params(r"/signup\?invite=([\w-]+)", message)[0]


def login(client, email, password=PASSWORD):
    return client.post("/api/auth/login", {"username": email, "password": password}, format="json")


def register(client, email, **extra):
    payload = {"name": "Nadia Salem", "email": email, "password": "shelf-mark-FIC-7", "studentId": email[:8].upper()}
    return client.post("/api/auth/register", {**payload, **extra}, format="json")


# ------------------------------------------------------------------- password reset

class PasswordResetTests(TestCase):
    def setUp(self):
        self.member = make_user("m@x.com")
        self.client = APIClient()

    def request_reset(self, email):
        return self.client.post("/api/auth/password-reset", {"email": email}, format="json")

    def confirm(self, uid, token, password=NEW_PASSWORD):
        return self.client.post("/api/auth/password-reset/confirm",
                                {"uid": uid, "token": token, "password": password}, format="json")

    def test_same_answer_whether_or_not_the_account_exists(self):
        self.assertEqual(self.request_reset("nobody@x.com").status_code, 202)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(self.request_reset("M@x.com").status_code, 202)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["m@x.com"])

    def test_deactivated_accounts_get_no_email(self):
        self.member.profile.active = False
        self.member.profile.save()
        self.assertEqual(self.request_reset("m@x.com").status_code, 202)
        self.assertEqual(len(mail.outbox), 0)

    def test_reset_sets_the_new_password_once(self):
        self.request_reset("m@x.com")
        uid, token = reset_link(mail.outbox[0])
        self.assertEqual(self.confirm(uid, token).status_code, 204)
        self.assertEqual(login(APIClient(), "m@x.com", NEW_PASSWORD).status_code, 200)
        self.assertEqual(login(APIClient(), "m@x.com", PASSWORD).status_code, 401)
        self.assertEqual(self.confirm(uid, token, "another-Shelf-77").status_code, 400)  # single use

    def test_weak_password_is_refused(self):
        self.request_reset("m@x.com")
        uid, token = reset_link(mail.outbox[0])
        self.assertEqual(self.confirm(uid, token, "12345678").status_code, 400)
        self.assertEqual(login(APIClient(), "m@x.com", PASSWORD).status_code, 200)

    def test_tampered_token_is_refused(self):
        self.request_reset("m@x.com")
        uid, token = reset_link(mail.outbox[0])
        self.assertEqual(self.confirm(uid, token[:-2] + "zz").status_code, 400)
        self.assertEqual(self.confirm("bm9wZQ", token).status_code, 400)

    def test_reset_signs_out_every_session(self):
        session = APIClient()
        login(session, "m@x.com")
        self.request_reset("m@x.com")
        uid, token = reset_link(mail.outbox[0])
        self.confirm(uid, token)
        self.assertEqual(session.post("/api/auth/refresh", {}, format="json", **CSRF).status_code, 401)

    def test_email_follows_the_member_language(self):
        UserProfile.objects.filter(user=self.member).update(language="fr")
        make_user("e@x.com")
        self.request_reset("m@x.com")
        self.request_reset("e@x.com")
        self.assertNotEqual(mail.outbox[0].subject, mail.outbox[1].subject)


# -------------------------------------------------------------- email verification

class EmailVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.book = make_book()

    def sign_up(self):
        self.assertEqual(register(self.client, "new@x.com").status_code, 201)
        access = login(self.client, "new@x.com", "shelf-mark-FIC-7").json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    def test_registration_sends_a_verification_email(self):
        self.sign_up()
        self.assertEqual(len(mail.outbox), 1)
        verify_link(mail.outbox[0])
        self.assertFalse(self.client.get("/api/users/me").json()["emailVerified"])

    def test_unverified_member_cannot_borrow_until_verified(self):
        self.sign_up()
        self.assertEqual(self.client.post("/api/borrow-records", {"bookId": self.book.pk}, format="json").status_code, 400)
        uid, token = verify_link(mail.outbox[0])
        res = APIClient().post("/api/auth/verify-email", {"uid": uid, "token": token}, format="json")
        self.assertEqual(res.status_code, 204)
        self.assertTrue(self.client.get("/api/users/me").json()["emailVerified"])
        self.assertEqual(self.client.post("/api/borrow-records", {"bookId": self.book.pk}, format="json").status_code, 201)

    def test_unverified_member_cannot_join_a_queue(self):
        self.sign_up()
        self.book.available_copies = 0
        self.book.save()
        self.assertEqual(self.client.post("/api/reservations", {"bookId": self.book.pk}, format="json").status_code, 400)

    def test_a_token_only_verifies_its_own_account(self):
        self.sign_up()
        _, token = verify_link(mail.outbox[0])
        other = make_user("other@x.com")
        UserProfile.objects.filter(user=other).update(email_verified=False)
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        other_uid = urlsafe_base64_encode(force_bytes(other.pk))
        res = APIClient().post("/api/auth/verify-email", {"uid": other_uid, "token": token}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_resend(self):
        self.sign_up()
        self.assertEqual(self.client.post("/api/auth/verify-email/resend").status_code, 202)
        self.assertEqual(len(mail.outbox), 2)

    def test_resend_needs_a_session(self):
        self.assertEqual(APIClient().post("/api/auth/verify-email/resend").status_code, 401)

    def test_accounts_created_before_verification_existed_stay_verified(self):
        self.assertTrue(make_user("old@x.com").profile.email_verified)


# -------------------------------------------------------------------- staff invites

class StaffInviteTests(TestCase):
    def setUp(self):
        self.admin = APIClient()
        self.admin.force_authenticate(make_user("admin@x.com", Role.ADMIN))

    def invite(self, email="librarian@x.com", role=Role.STAFF):
        res = self.admin.post("/api/invites", {"email": email, "role": role}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return res

    def test_only_admins_can_invite_or_list(self):
        for role in (Role.MEMBER, Role.STAFF):
            client = APIClient()
            client.force_authenticate(make_user(f"{role.lower()}@x.com", role))
            self.assertEqual(client.post("/api/invites", {"email": "a@x.com", "role": "STAFF"}, format="json").status_code, 403)
            self.assertEqual(client.get("/api/invites").status_code, 403)

    def test_invite_emails_a_single_use_link(self):
        res = self.invite()
        self.assertEqual(mail.outbox[0].to, ["librarian@x.com"])
        token = invite_link(mail.outbox[0])
        self.assertIn(token, res.json()["link"])  # admins can copy it if the email bounces
        self.assertNotEqual(StaffInvite.objects.get().token_hash, token)  # only a hash is stored
        lookup = APIClient().get("/api/invites/lookup", {"token": token})
        self.assertEqual(lookup.status_code, 200)
        self.assertEqual(lookup.json(), {"email": "librarian@x.com", "role": "STAFF"})

    def test_signing_up_with_the_invite_makes_a_verified_staff_account(self):
        self.invite()
        token = invite_link(mail.outbox[0])
        res = register(APIClient(), "Librarian@x.com", inviteToken=token)
        self.assertEqual(res.status_code, 201)
        profile = UserProfile.objects.get(user__email="librarian@x.com")
        self.assertEqual(profile.role, Role.STAFF)
        self.assertTrue(profile.email_verified)
        self.assertEqual(register(APIClient(), "librarian2@x.com", inviteToken=token).status_code, 400)
        self.assertEqual(self.admin.get("/api/invites").json(), [])  # no longer pending

    def test_invite_is_bound_to_its_email(self):
        self.invite()
        token = invite_link(mail.outbox[0])
        self.assertEqual(register(APIClient(), "someone-else@x.com", inviteToken=token).status_code, 400)
        self.assertFalse(UserProfile.objects.filter(user__email="someone-else@x.com").exists())

    def test_expired_and_revoked_invites_are_refused(self):
        self.invite("late@x.com")
        late = invite_link(mail.outbox[0])
        StaffInvite.objects.filter(email="late@x.com").update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(register(APIClient(), "late@x.com", inviteToken=late).status_code, 400)

        invite_id = self.invite("gone@x.com").json()["id"]
        gone = invite_link(mail.outbox[1])
        self.assertEqual(self.admin.delete(f"/api/invites/{invite_id}").status_code, 204)
        self.assertEqual(register(APIClient(), "gone@x.com", inviteToken=gone).status_code, 400)
        self.assertEqual(APIClient().get("/api/invites/lookup", {"token": gone}).status_code, 404)

    def test_the_shared_invite_code_no_longer_grants_staff(self):
        res = register(APIClient(), "sneaky@x.com", staffInviteCode="LIB-STAFF-2024")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(UserProfile.objects.get(user__email="sneaky@x.com").role, Role.MEMBER)

    def test_admins_can_invite_admins(self):
        self.invite("chief@x.com", Role.ADMIN)
        register(APIClient(), "chief@x.com", inviteToken=invite_link(mail.outbox[0]))
        self.assertEqual(UserProfile.objects.get(user__email="chief@x.com").role, Role.ADMIN)

    def test_members_cannot_be_invited(self):
        res = self.admin.post("/api/invites", {"email": "a@x.com", "role": "MEMBER"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_invites_die_with_their_creators_authority(self):
        creator = make_user("second-admin@x.com", Role.ADMIN)
        client = APIClient()
        client.force_authenticate(creator)
        for email in ("a1@x.com", "a2@x.com", "a3@x.com"):
            self.assertEqual(client.post("/api/invites", {"email": email, "role": "ADMIN"}, format="json").status_code, 201)
        tokens = [invite_link(m) for m in mail.outbox]
        creator.profile.role = Role.STAFF  # demoted
        creator.profile.save()
        self.assertEqual(register(APIClient(), "a1@x.com", inviteToken=tokens[0]).status_code, 400)
        self.assertEqual(self.admin.get("/api/invites").json(), [])


class InviteRevocationOnDeleteTests(TestCase):
    def test_deleting_the_admin_revokes_their_invites(self):
        creator = make_user("gone-admin@x.com", Role.ADMIN)
        client = APIClient()
        client.force_authenticate(creator)
        client.post("/api/invites", {"email": "late@x.com", "role": "STAFF"}, format="json")
        token = invite_link(mail.outbox[0])
        creator.delete()
        self.assertEqual(register(APIClient(), "late@x.com", inviteToken=token).status_code, 400)


class LoginCsrfTests(TestCase):
    def test_login_refuses_form_posts(self):
        make_user("m@x.com")
        res = APIClient().post("/api/auth/login", {"username": "m@x.com", "password": PASSWORD})  # multipart
        self.assertEqual(res.status_code, 415)
        self.assertNotIn("lb_refresh", res.cookies)
