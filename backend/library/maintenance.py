"""Admin maintenance from Settings: backup and restore, resets, deletions and reloading the catalogue.

Every destructive action asks for the admin's password again (views.MaintenanceActionView) and runs in one
transaction, so a failure leaves the data as it was. A backup is a JSON list in Django's serialization format:
accounts, profiles, catalogue, circulation, settings and the activity log. Uploaded files (book covers and
site photographs) are not included; they stay on the server's media storage.
"""
from __future__ import annotations

import json

from django.contrib.auth.models import User
from django.core import serializers
from django.core.management.color import no_style
from django.db import connection, transaction
from django.db.models import F
from django.utils import timezone

from .catalogue import inventory_rows
from .errors import BusinessRuleError
from .importing import run_import
from .models import (
    ActivityLog,
    Book,
    BorrowRecord,
    Category,
    LibrarySettings,
    Notification,
    Reservation,
    Role,
    StaffInvite,
    Status,
    UserProfile,
    log_activity,
)

# In dependency order: a model comes after the ones it points to.
BACKUP_MODELS = [User, UserProfile, LibrarySettings, Category, Book, BorrowRecord, Reservation, Notification,
                 ActivityLog, StaffInvite]
BACKUP_LABELS = {m._meta.label_lower for m in BACKUP_MODELS}
BACKUP_FORMAT = 1


def counts() -> dict:
    return {
        "books": Book.objects.count(),
        "copies": sum(Book.objects.values_list("total_copies", flat=True)),
        "categories": Category.objects.count(),
        "accounts": UserProfile.objects.count(),
        "members": UserProfile.objects.filter(role=Role.MEMBER).count(),
        "records": BorrowRecord.objects.count(),
        "activeLoans": BorrowRecord.objects.filter(status__in=[Status.BORROWED, Status.OVERDUE]).count(),
        "reservations": Reservation.objects.filter(is_active=True).count(),
        "notifications": Notification.objects.count(),
        "activity": ActivityLog.objects.count(),
    }


def backup_json() -> str:
    objects = []
    for model in BACKUP_MODELS:
        objects.extend(model.objects.order_by("pk"))
    data = json.loads(serializers.serialize("json", objects))
    return json.dumps({"format": BACKUP_FORMAT, "createdAt": timezone.now().isoformat(), "objects": data},
                      ensure_ascii=False)


def _reset_sequences():
    """PostgreSQL keeps id counters apart from the rows: move them past the restored ids."""
    sql = connection.ops.sequence_reset_sql(no_style(), BACKUP_MODELS)
    if sql:
        with connection.cursor() as cursor:
            for statement in sql:
                cursor.execute(statement)


def restore(content: bytes, actor_name: str) -> dict:
    try:
        payload = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, ValueError):
        raise BusinessRuleError("backup_invalid", "This file is not a library backup.")
    objects = payload.get("objects") if isinstance(payload, dict) else None
    if (not isinstance(objects, list) or payload.get("format") != BACKUP_FORMAT
            or not all(isinstance(o, dict) and o.get("model") in BACKUP_LABELS for o in objects)):
        raise BusinessRuleError("backup_invalid", "This file is not a library backup.")
    if not any(o["model"] == "library.userprofile" and o.get("fields", {}).get("role") == Role.ADMIN
               and o.get("fields", {}).get("active", True) for o in objects):
        raise BusinessRuleError("backup_no_admin", "The backup has no active administrator account.")
    try:
        with transaction.atomic():
            _wipe()
            for obj in serializers.deserialize("json", json.dumps(objects)):
                obj.save()
            _reset_sequences()
            log_activity(actor_name, "BACKUP_RESTORED", "Restored the library from a backup.",
                         createdAt=str(payload.get("createdAt", "")))
    except BusinessRuleError:
        raise
    except Exception as e:  # a malformed or inconsistent file: nothing was changed
        raise BusinessRuleError("backup_invalid", f"The backup could not be restored: {e}")
    return counts()


def _wipe():
    for model in reversed(BACKUP_MODELS):
        model.objects.all().delete()


@transaction.atomic
def reset_circulation(actor_name: str) -> None:
    """Every request, loan, hold, waiting list and notification goes; every copy is back on the shelf."""
    BorrowRecord.objects.all().delete()
    Reservation.objects.all().delete()
    Notification.objects.all().delete()
    Book.objects.update(available_copies=F("total_copies"))
    log_activity(actor_name, "CIRCULATION_RESET", "Reset all circulation: requests, loans and waiting lists.")


@transaction.atomic
def delete_catalogue(actor_name: str) -> None:
    """All books and categories, with their circulation history."""
    Book.objects.all().delete()
    Category.objects.all().delete()
    log_activity(actor_name, "CATALOGUE_DELETED", "Deleted the whole catalogue.")


@transaction.atomic
def delete_members(actor_name: str) -> int:
    """Every reader account (students, professors, administrative staff, external readers). Library staff stay."""
    users = User.objects.filter(profile__role=Role.MEMBER, is_superuser=False)
    n = users.count()
    users.delete()
    log_activity(actor_name, "MEMBERS_DELETED", f"Deleted {n} reader accounts.", count=n)
    return n


@transaction.atomic
def clear_activity(actor_name: str) -> None:
    ActivityLog.objects.all().delete()
    log_activity(actor_name, "ACTIVITY_CLEARED", "Cleared the activity log.")


def reload_catalogue(actor_name: str) -> dict:
    """Load the bundled inventory: new titles are added, known ones (same call number and title) updated."""
    report = run_import(inventory_rows(), mode="update", dry_run=False, actor_name=actor_name,
                        source="جرد المكتبة")
    return report["summary"]


ACTIONS = {
    "reset-circulation": reset_circulation,
    "delete-catalogue": delete_catalogue,
    "delete-members": delete_members,
    "clear-activity": clear_activity,
    "reload-catalogue": reload_catalogue,
}
