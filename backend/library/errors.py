"""API errors with machine-readable codes.

Services and views raise; `exception_handler` formats every error response as
{detail, code, params} (or {detail, code, fields, fieldCodes} for validation errors).
`detail` is English for API clients; the UI translates `code` + `params`.
"""
import math

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework.exceptions import APIException, Throttled, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class AppError(Exception):
    """A rule violation with a stable code the UI can translate."""
    status = 400

    def __init__(self, code: str, message: str, **params):
        super().__init__(message)
        self.code = code
        self.message = message
        self.params = params


class BusinessRuleError(AppError):
    """Business rule violation: HTTP 400."""


class StateMachineError(AppError):
    """Invalid transition: HTTP 409."""
    status = 409


class Forbidden(AppError):
    status = 403


class NotFoundError(AppError):
    status = 404


class Unauthorized(AppError):
    status = 401


def error_response(exc: AppError) -> Response:
    return Response({"detail": exc.message, "code": exc.code, "params": exc.params}, status=exc.status)


def exception_handler(exc, context):
    if isinstance(exc, AppError):
        return error_response(exc)
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError) and isinstance(exc.detail, dict):
        fields = dict(response.data)
        response.data = {**fields, "detail": "Invalid input.", "code": "invalid",
                         "fields": fields, "fieldCodes": exc.get_codes()}
    elif not isinstance(response.data, dict):
        pass
    elif isinstance(exc, Http404):
        response.data["code"] = "not_found"
    elif isinstance(exc, PermissionDenied):
        response.data["code"] = "permission_denied"
    elif isinstance(exc, APIException):
        codes = exc.get_codes()
        if isinstance(codes, dict):  # SimpleJWT puts the code under "detail"
            codes = codes.get("detail")
        response.data["code"] = codes if isinstance(codes, str) else exc.default_code
        if isinstance(exc, Throttled) and exc.wait is not None:
            response.data["params"] = {"wait": math.ceil(exc.wait)}
    return response
