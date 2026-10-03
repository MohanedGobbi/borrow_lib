import hashlib
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class Category(models.Model):
    """Book categories are staff-managed: name + display color (used to theme the UI)."""
    name = models.CharField(max_length=60, unique=True)
    color = models.CharField(max_length=9, default="#4A5560")

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Role(models.TextChoices):
    MEMBER = "MEMBER"
    STAFF = "STAFF"
    ADMIN = "ADMIN"


class Language(models.TextChoices):
    EN = "en", "English"
    FR = "fr", "Français"
    AR = "ar", "العربية"


class Status(models.TextChoices):
    PENDING = "PENDING"
    READY = "READY"
    BORROWED = "BORROWED"
    RETURNED = "RETURNED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"


class LibrarySettings(models.Model):
    """The circulation rules an admin can change. A singleton: the row with pk=1.

    Changing a value never moves a deadline that was already set; it applies to the next
    approval, pickup or renewal.
    """
    hold_hours = models.PositiveIntegerField(default=48, validators=[MinValueValidator(1), MaxValueValidator(168)])
    loan_days = models.PositiveIntegerField(default=14, validators=[MinValueValidator(1), MaxValueValidator(90)])
    max_renewals = models.PositiveIntegerField(default=1, validators=[MaxValueValidator(5)])
    member_borrow_limit = models.PositiveIntegerField(default=5, validators=[MinValueValidator(1), MaxValueValidator(50)])
    staff_borrow_limit = models.PositiveIntegerField(default=10, validators=[MinValueValidator(1), MaxValueValidator(50)])
    reminder_days_before_due = models.PositiveIntegerField(default=2, validators=[MaxValueValidator(14)])
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        verbose_name_plural = "library settings"

    @classmethod
    def get(cls) -> "LibrarySettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Library settings"


class Book(models.Model):
    title = models.CharField(max_length=300)
    author = models.CharField(max_length=300)
    isbn = models.CharField(max_length=20, unique=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="books")
    publisher = models.CharField(max_length=200, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    shelf_location = models.CharField(max_length=50, blank=True)
    cover_color = models.CharField(max_length=9, default="#1F4D3A")
    cover_image = models.ImageField(upload_to="covers/", null=True, blank=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.title} — {self.author}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    student_or_staff_id = models.CharField(max_length=30, unique=True)
    phone_number = models.CharField(max_length=40, blank=True)
    address = models.CharField(max_length=300, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    membership_start_date = models.DateField(auto_now_add=True)
    # None means "use the default for my role" (LibrarySettings); a number is a personal override.
    max_borrow_limit = models.PositiveIntegerField(null=True, blank=True, default=None)
    active = models.BooleanField(default=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.EN)
    # True by default so existing accounts stay verified; self-registration sets it to False.
    email_verified = models.BooleanField(default=True)
    # Opt-out of the ready / due-soon / overdue reminder emails. In-app notifications always stay on.
    email_reminders = models.BooleanField(default=True)

    def borrow_limit_with(self, rules: "LibrarySettings") -> int:
        """The limit given already-loaded settings (lists pass one copy instead of a query per row)."""
        if self.max_borrow_limit is not None:
            return self.max_borrow_limit
        return rules.member_borrow_limit if self.role == Role.MEMBER else rules.staff_borrow_limit

    @property
    def effective_borrow_limit(self) -> int:
        """A personal override if there is one, else the default for the role from the settings."""
        return self.borrow_limit_with(LibrarySettings.get())

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.role})"


INVITE_LIFETIME = timedelta(days=7)


def invite_expiry():
    return timezone.now() + INVITE_LIFETIME


class StaffInvite(models.Model):
    """An admin-issued, single-use, expiring link that creates a staff or admin account."""
    email = models.EmailField()
    role = models.CharField(max_length=10, choices=[(Role.STAFF, "Staff"), (Role.ADMIN, "Admin")])
    token_hash = models.CharField(max_length=64, unique=True)  # sha256 hex; the token itself is never stored
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=invite_expiry)
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @property
    def is_pending(self) -> bool:
        return self.used_at is None and self.revoked_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.email} ({self.role})"


class BorrowRecord(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="borrow_records")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="borrow_records")
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    pickup_deadline = models.DateTimeField(null=True, blank=True)
    borrowed_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    approved_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_records"
    )
    rejection_reason = models.CharField(max_length=300, blank=True)
    # True when the member withdrew the request or hold themselves (not staff, not the hold expiring).
    cancelled_by_member = models.BooleanField(default=False)
    renewal_count = models.PositiveIntegerField(default=0)
    # One reminder email per event per record: each is set only after a successful send (see reminders in services.py).
    ready_email_sent_at = models.DateTimeField(null=True, blank=True)
    due_reminder_sent_at = models.DateTimeField(null=True, blank=True)  # cleared by a renewal
    overdue_email_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"{self.user} · {self.book} · {self.status}"


class Reservation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reservations")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reservations")
    reserved_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["reserved_at"]


class ActivityLog(models.Model):
    at = models.DateTimeField(auto_now_add=True)
    actor_name = models.CharField(max_length=150)
    action = models.CharField(max_length=40)
    detail = models.CharField(max_length=500)
    code = models.CharField(max_length=40, blank=True)
    params = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-at"]


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    at = models.DateTimeField(auto_now_add=True)
    message = models.CharField(max_length=500)
    code = models.CharField(max_length=40, blank=True)
    params = models.JSONField(default=dict, blank=True)
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-at"]


def log_activity(actor_name: str, action: str, detail: str, **params) -> ActivityLog:
    """`detail` is the English sentence (old rows, the admin, API clients). The UI translates
    `activity.<code>` with `params`; the code is the action in lower case ("PICKUP_CONFIRMED" -> "pickup_confirmed")."""
    return ActivityLog.objects.create(actor_name=actor_name, action=action, detail=detail,
                                      code=action.lower(), params=params)


def notify(user: User, code: str, message: str, **params) -> Notification:
    """`message` is the English text (old rows, the admin, API clients); the UI translates `code` + `params`."""
    return Notification.objects.create(user=user, code=code, message=message, params=params)


def display_name(user: User) -> str:
    return user.get_full_name() or user.username
