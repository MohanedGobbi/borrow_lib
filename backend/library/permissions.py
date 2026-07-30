from rest_framework.permissions import BasePermission

from .models import Role


def role_of(user) -> str | None:
    if not user or not user.is_authenticated:
        return None
    profile = getattr(user, "profile", None)
    if profile is None or not profile.active:
        return None
    if user.is_superuser:
        return Role.ADMIN
    return profile.role


class IsStaffOrAdmin(BasePermission):
    message = "Forbidden: staff or admin role required."

    def has_permission(self, request, view):
        return role_of(request.user) in (Role.STAFF, Role.ADMIN)


class IsAdmin(BasePermission):
    message = "Forbidden: admin role required."

    def has_permission(self, request, view):
        return role_of(request.user) == Role.ADMIN
