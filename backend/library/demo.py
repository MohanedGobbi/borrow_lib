"""The hosted demo (settings.DEMO_MODE): fictional people on a portion of the real catalogue.

Visitors share the demo accounts, so a few things are refused in demo mode: maintenance actions,
changes to the shared accounts, and uploads (the demo host keeps no files). Every night, and from
/api/demo/reset, reset() wipes accounts and circulation and builds them again.
"""
from __future__ import annotations

import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import F
from django.utils import timezone

from . import services
from .catalogue import inventory_rows
from .errors import BusinessRuleError
from .importing import run_import
from .models import (
    ActivityLog, Book, BorrowRecord, Category, LibrarySettings, MemberType, Notification, Reservation, Role,
    SiteImage, UserProfile,
)

# The accounts offered on the sign-in page: (key, email, name, role, member type).
DEMO_ACCOUNTS = [
    ("reader", "reader@demo.example", "أمينة بن عيسى", Role.MEMBER, MemberType.STUDENT),
    ("overdue", "late.reader@demo.example", "إسماعيل شريفي", Role.MEMBER, MemberType.STUDENT),
    ("librarian", "librarian@demo.example", "فاطمة الزهراء حاج", Role.STAFF, MemberType.STUDENT),
    ("admin", "admin@demo.example", "مسؤول المكتبة", Role.ADMIN, MemberType.STUDENT),
]
DEMO_EMAILS = {a[1] for a in DEMO_ACCOUNTS}
# More readers, so the lists, the waiting list and the statistics look like a library.
OTHER_READERS = [
    ("يوسف حمادي", MemberType.STUDENT), ("سارة بلقاسم", MemberType.STUDENT), ("محمد الأمين قاسمي", MemberType.STUDENT),
    ("خديجة بوعلام", MemberType.STUDENT), ("عبد الرحمن زروقي", MemberType.STUDENT), ("نور الهدى بن سالم", MemberType.STUDENT),
    ("مريم دحمان", MemberType.STUDENT), ("رياض عمراني", MemberType.STUDENT), ("كمال بوزيد", MemberType.PROFESSOR),
    ("سميرة لعرج", MemberType.ADMINISTRATIVE), ("طارق منصوري", MemberType.EXTERNAL),
]


# ------------------------------------------------------------------ guards

def refuse_maintenance() -> None:
    if settings.DEMO_MODE:
        raise BusinessRuleError("demo_locked", "This is turned off in the demo, so the next visitor finds it intact.")


def protect_account(profile: UserProfile) -> None:
    if settings.DEMO_MODE and profile.user.email in DEMO_EMAILS:
        raise BusinessRuleError("demo_locked", "The shared demo accounts cannot be changed.")


def refuse_uploads() -> None:
    if settings.DEMO_MODE:
        raise BusinessRuleError("demo_uploads_off", "Uploads are turned off in the demo.")


# ------------------------------------------------------------------ what the site shows

def info() -> dict:
    accounts = {p.user.email: p for p in UserProfile.objects.select_related("user").filter(user__email__in=DEMO_EMAILS)}
    from .serializers import account_type_of
    return {
        "password": settings.DEMO_PASSWORD,
        "accounts": [
            {"key": key, "email": email, "name": name,
             "accountType": account_type_of(accounts[email]) if email in accounts else None}
            for key, email, name, _role, _type in DEMO_ACCOUNTS
        ],
    }


# ------------------------------------------------------------------ the nightly reset

def portion() -> list[dict]:
    """settings.DEMO_TITLES rows spread evenly over the inventory, so every subject is represented."""
    rows = inventory_rows()
    n = max(1, min(settings.DEMO_TITLES, len(rows)))
    step = len(rows) / n
    return [rows[int(i * step)] for i in range(n)]


def _account(email: str, name: str, role: str, member_type: str) -> User:
    first, _, last = name.partition(" ")
    user = User.objects.create_user(username=email, email=email, password=settings.DEMO_PASSWORD,
                                    first_name=first, last_name=last, is_staff=role != Role.MEMBER)
    UserProfile.objects.create(user=user, role=role, member_type=member_type, language="ar", email_verified=True)
    return user


def _move_back(record: BorrowRecord, now, days_ago: int, loan_days: int) -> None:
    """Move a returned loan into the past, so the statistics have months of history."""
    req = now - timedelta(days=days_ago, hours=random.randint(0, 8))
    picked = req + timedelta(hours=random.randint(3, 40))
    BorrowRecord.objects.filter(pk=record.pk).update(
        requested_at=req, approved_at=req + timedelta(hours=2), pickup_deadline=req + timedelta(hours=50),
        borrowed_at=picked, due_date=picked + timedelta(days=loan_days),
        returned_at=picked + timedelta(days=random.randint(4, loan_days)))


def reset() -> dict:
    random.seed(2026)
    now = timezone.now()

    # People and circulation go; so do the rules and photographs visitors changed.
    User.objects.filter(is_superuser=False).delete()
    BorrowRecord.objects.all().delete()
    Reservation.objects.all().delete()
    Notification.objects.all().delete()
    ActivityLog.objects.all().delete()
    LibrarySettings.objects.all().delete()
    SiteImage.objects.all().delete()

    # The catalogue is reloaded only when visitors added or removed books (it is the slow part).
    rows = portion()
    if Book.objects.count() != len(rows):
        Book.objects.all().delete()
        Category.objects.all().delete()
        run_import(rows, mode="update", dry_run=False, actor_name="Demo", source="جرد المكتبة")
    Book.objects.update(available_copies=F("total_copies"))

    users = {key: _account(email, name, role, mt) for key, email, name, role, mt in DEMO_ACCOUNTS}
    others = [_account(f"reader{i + 1}@demo.example", name, Role.MEMBER, mt) for i, (name, mt) in enumerate(OTHER_READERS)]
    readers = [users["reader"], users["overdue"], *others]
    lib = users["librarian"]
    rules = LibrarySettings.get()
    books = list(Book.objects.filter(total_copies__gte=3).order_by("id"))
    random.shuffle(books)
    pool = iter(books)

    # Months of returned loans, for the statistics.
    for _ in range(40):
        r = services.create_request(random.choice(others), random.choice(books[:120]))
        services.confirm_return(lib, services.confirm_pickup(lib, services.approve(lib, r)))
        _move_back(r, now, random.randint(18, 170), rules.loan_days)
    services.reject(lib, services.create_request(others[3], next(pool)), "نسخة مرجعية للمطالعة داخل المكتبة فقط")

    # Today: requests to approve, books on the hold shelf, loans (one due soon, one overdue), a waiting list.
    for who in (users["reader"], others[0], others[8], others[1]):
        services.create_request(who, next(pool))
    soon = services.approve(lib, services.create_request(others[2], next(pool)))
    BorrowRecord.objects.filter(pk=soon.pk).update(pickup_deadline=now + timedelta(hours=3))
    services.approve(lib, services.create_request(others[4], next(pool)))
    for who, due_in in ((others[5], 9), (others[6], 2), (others[10], 12), (others[9], 5)):
        r = services.confirm_pickup(lib, services.approve(lib, services.create_request(who, next(pool))))
        BorrowRecord.objects.filter(pk=r.pk).update(due_date=now + timedelta(days=due_in),
                                                    borrowed_at=now + timedelta(days=due_in - rules.loan_days))
    late = services.confirm_pickup(lib, services.approve(lib, services.create_request(users["overdue"], next(pool))))
    BorrowRecord.objects.filter(pk=late.pk).update(borrowed_at=now - timedelta(days=20), due_date=now - timedelta(days=6))
    services.run_nightly_overdue(now)

    single = Book.objects.filter(total_copies=1).order_by("id").first()
    if single:
        services.confirm_pickup(lib, services.approve(lib, services.create_request(others[7], single)))
        single.refresh_from_db()
        services.create_reservation(users["reader"], single)
        services.create_reservation(others[0], single)

    return {"books": Book.objects.count(), "accounts": User.objects.count(), "records": BorrowRecord.objects.count()}
