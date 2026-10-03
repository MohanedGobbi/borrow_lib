"""Password reset, email verification and staff invites (docs/rework/WP-08.md)."""
import secrets

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import status as http
from rest_framework.exceptions import ValidationError
from rest_framework.fields import get_error_detail
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from . import emails
from .auth_views import SessionView
from .errors import BusinessRuleError, NotFoundError
from .models import StaffInvite, display_name, log_activity
from .permissions import IsAdmin
from .serializers import StaffInviteSerializer

def bad_link():
    return BusinessRuleError("link_invalid", "This link is invalid or has expired.")


def user_from_uid(uid):
    try:
        return User.objects.select_related("profile").get(pk=int(force_str(urlsafe_base64_decode(uid))))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


# ------------------------------- password reset -------------------------------

class PasswordResetView(SessionView):
    throttle_scope = "auth_reset"

    def post(self, request):
        email = str(request.data.get("email", "")).strip()
        user = User.objects.filter(email__iexact=email, profile__active=True).first() if email else None
        if user:
            emails.send_password_reset(user)
        return Response(status=http.HTTP_202_ACCEPTED)  # the same answer whether or not the account exists


class PasswordResetConfirmView(SessionView):
    def post(self, request):
        user = user_from_uid(str(request.data.get("uid", "")))
        token = str(request.data.get("token", ""))
        if not user or not user.profile.active or not default_token_generator.check_token(user, token):
            raise bad_link()
        password = str(request.data.get("password", ""))
        try:
            validate_password(password, user)
        except DjangoValidationError as e:
            raise ValidationError({"password": get_error_detail(e)})
        user.set_password(password)  # also what makes the token single-use
        user.save(update_fields=["password"])
        # A reset is how people recover from a stolen password: end every session.
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        log_activity(display_name(user), "PASSWORD_RESET", f"{display_name(user)} reset their password.", member=display_name(user))
        return Response(status=http.HTTP_204_NO_CONTENT)


# ------------------------------- email verification -------------------------------

class VerifyEmailView(SessionView):
    def post(self, request):
        user = user_from_uid(str(request.data.get("uid", "")))
        if not user or not emails.email_verification_token.check_token(user, str(request.data.get("token", ""))):
            raise bad_link()
        user.profile.email_verified = True
        user.profile.save(update_fields=["email_verified"])
        return Response(status=http.HTTP_204_NO_CONTENT)


class ResendVerificationView(APIView):
    throttle_scope = "auth_reset"

    def post(self, request):
        if request.user.profile.email_verified:
            raise BusinessRuleError("already_verified", "Your email address is already verified.")
        emails.send_verification(request.user)
        return Response(status=http.HTTP_202_ACCEPTED)


# ------------------------------- staff invites -------------------------------

def pending_invites():
    return StaffInvite.objects.filter(used_at__isnull=True, revoked_at__isnull=True,
                                      expires_at__gt=timezone.now()).select_related("created_by")


class InviteListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(StaffInviteSerializer(pending_invites(), many=True).data)

    def post(self, request):
        s = StaffInviteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        email = s.validated_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise BusinessRuleError("account_exists", "An account with this email already exists.")
        token = secrets.token_urlsafe(32)
        invite = s.save(email=email, token_hash=StaffInvite.hash_token(token), created_by=request.user)
        emails.send_staff_invite(invite, token)  # a failed send is logged; the admin can copy the link below
        log_activity(display_name(request.user), "INVITE_SENT", f"Invited {email} as {invite.role.lower()}.",
                     email=email, role=invite.role)
        return Response({**StaffInviteSerializer(invite).data, "link": emails.invite_link(token)},
                        status=http.HTTP_201_CREATED)


class InviteDetailView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        invite = get_object_or_404(StaffInvite, pk=pk)
        if invite.revoked_at is None:
            invite.revoked_at = timezone.now()
            invite.save(update_fields=["revoked_at"])
        return Response(status=http.HTTP_204_NO_CONTENT)


class InviteLookupView(SessionView):
    throttle_scope = "auth_login"  # shares the sign-in limit, so tokens cannot be brute-forced

    def get(self, request):
        invite = StaffInvite.objects.filter(
            token_hash=StaffInvite.hash_token(request.query_params.get("token", ""))).first()
        if not invite or not invite.is_pending:
            raise NotFoundError("invite_not_found", "Invitation not found.")
        return Response({"email": invite.email, "role": invite.role})
