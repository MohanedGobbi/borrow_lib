"""Session endpoints.

The access token is returned in the body and kept in the page's memory. The refresh token
only ever travels in an httpOnly cookie scoped to /api/auth, so scripts cannot read it.
"""
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import status as http
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .errors import Forbidden, Unauthorized, error_response


def set_refresh_cookie(response, token):
    cfg = settings.AUTH_REFRESH_COOKIE
    response.set_cookie(
        cfg["name"], str(token),
        max_age=int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        path=cfg["path"], domain=cfg["domain"], secure=cfg["secure"],
        httponly=True, samesite=cfg["samesite"],
    )


def delete_refresh_cookie(response):
    cfg = settings.AUTH_REFRESH_COOKIE
    response.delete_cookie(cfg["name"], path=cfg["path"], domain=cfg["domain"], samesite=cfg["samesite"])


def csrf_header_missing(request):
    """Cookie-authenticated endpoints need a header a cross-site form or image cannot send."""
    return not request.META.get(settings.AUTH_CSRF_HEADER)


class SessionView(APIView):
    authentication_classes = ()
    permission_classes = ()

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'  # makes failed sign-ins 401 instead of 403


class LoginView(SessionView):
    throttle_scope = "auth_login"
    # JSON only: a cross-site HTML form cannot send it, so another site cannot sign a visitor
    # into an attacker's account (login CSRF) now that the session lives in a cookie.
    parser_classes = [JSONParser]

    def post(self, request):
        s = TokenObtainPairSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        res = Response({"access": s.validated_data["access"]})
        set_refresh_cookie(res, s.validated_data["refresh"])
        return res


class RefreshView(SessionView):
    throttle_scope = "auth_refresh"

    def post(self, request):
        if csrf_header_missing(request):
            raise Forbidden("csrf_missing", "Missing CSRF header.")
        token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE["name"])
        if not token:
            raise Unauthorized("no_session", "No active session.")
        s = TokenRefreshSerializer(data={"refresh": token})
        try:
            s.is_valid(raise_exception=True)
            data = s.validated_data
        except (TokenError, AuthenticationFailed, ObjectDoesNotExist):
            res = error_response(Unauthorized("session_expired", "Session expired."))
            delete_refresh_cookie(res)
            return res
        res = Response({"access": data["access"]})
        set_refresh_cookie(res, data["refresh"])
        return res


class LogoutView(SessionView):
    def post(self, request):
        if csrf_header_missing(request):
            raise Forbidden("csrf_missing", "Missing CSRF header.")
        token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE["name"])
        if token:
            try:
                RefreshToken(token).blacklist()
            except Exception:  # already expired, blacklisted or malformed: the cookie goes either way
                pass
        res = Response(status=http.HTTP_204_NO_CONTENT)
        delete_refresh_cookie(res)
        return res
