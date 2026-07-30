"""Borrow lifecycle state machine + background jobs.

The spine of the system: a loan starts at physical pickup, never at approval.
READY records expire 48h after approval; the slot then goes to the next
member in the reservation queue. available_copies changes ONLY at pickup (-1)
and return (+1).
"""
from datetime import timedelta
from django.db import transaction
from django.utils import timezone

from .models import (
    Book,
    BorrowRecord,
    Reservation,
    Role,
    Status,
    User,
    display_name,
    log_activity,
    notify,
)

PICKUP_WINDOW = timedelta(hours=48)
LOAN_PERIOD = timedelta(days=14)

ACTIVE_STATUSES = [Status.PENDING, Status.READY, Status.BORROWED, Status.OVERDUE]

# Explicit transition table: operation -> allowed source statuses.
TRANSITIONS = {
    "approve": [Status.PENDING],
    "reject": [Status.PENDING],
    "pickup": [Status.READY],
    "return": [Status.BORROWED, Status.OVERDUE],
    "cancel": [Status.READY],
    "overdue": [Status.BORROWED],
}


class StateMachineError(Exception):
    """Invalid transition — maps to HTTP 409."""


class BusinessRuleError(Exception):
    """Business rule violation — maps to HTTP 400."""


def _assert_transition(op: str, record: BorrowRecord):
    if record.status not in TRANSITIONS[op]:
        raise StateMachineError(
            f"Invalid transition: cannot {op} a record in status {record.status}."
        )


def has_overdue(user: User) -> bool:
    return user.borrow_records.filter(status=Status.OVERDUE).exists()


def active_loan_count(user: User) -> int:
    return user.borrow_records.filter(status__in=ACTIVE_STATUSES).count()


def queue_for_book(book: Book):
    return book.reservations.filter(is_active=True).order_by("reserved_at")


@transaction.atomic
def create_request(user: User, book: Book) -> BorrowRecord:
    """Member creates a PENDING request. Stock is NOT touched."""
    if has_overdue(user):
        raise BusinessRuleError("You have an overdue loan. Resolve it before requesting new books.")
    if active_loan_count(user) >= user.profile.max_borrow_limit:
        raise BusinessRuleError(f"Borrow limit reached ({user.profile.max_borrow_limit}). Return a book first.")
    if book.available_copies <= 0:
        raise BusinessRuleError("No copies available — join the reservation queue instead.")
    if user.borrow_records.filter(book=book, status__in=[Status.PENDING, Status.READY]).exists():
        raise BusinessRuleError("You already have an open request for this book.")
    record = BorrowRecord.objects.create(user=user, book=book)
    log_activity("System", "REQUEST_CREATED", f"{display_name(user)} requested “{book.title}”.")
    return record


@transaction.atomic
def approve(staff: User, record: BorrowRecord) -> BorrowRecord:
    """PENDING -> READY. Sets approved_at and the 48h pickup deadline."""
    _assert_transition("approve", record)
    now = timezone.now()
    record.status = Status.READY
    record.approved_at = now
    record.pickup_deadline = now + PICKUP_WINDOW
    record.approved_by = staff
    record.save(update_fields=["status", "approved_at", "pickup_deadline", "approved_by"])
    log_activity(display_name(staff), "APPROVED",
                 f"Approved {display_name(record.user)}'s request for “{record.book.title}”. Pickup within 48h.")
    notify(record.user, f"Your request for “{record.book.title}” was approved. Pick it up within 48 hours.")
    return record


@transaction.atomic
def reject(staff: User, record: BorrowRecord) -> BorrowRecord:
    """PENDING -> REJECTED (terminal)."""
    _assert_transition("reject", record)
    record.status = Status.REJECTED
    record.save(update_fields=["status"])
    log_activity(display_name(staff), "REJECTED",
                 f"Rejected {display_name(record.user)}'s request for “{record.book.title}”.")
    notify(record.user, f"Your request for “{record.book.title}” was rejected by staff.")
    return record


@transaction.atomic
def confirm_pickup(staff: User, record: BorrowRecord) -> BorrowRecord:
    """READY -> BORROWED. The ONLY place stock is decremented."""
    _assert_transition("pickup", record)
    book = Book.objects.select_for_update().get(pk=record.book_id)
    if book.available_copies <= 0:
        raise BusinessRuleError("No physical copy on the shelf to hand out.")
    now = timezone.now()
    record.status = Status.BORROWED
    record.borrowed_at = now
    record.due_date = now + LOAN_PERIOD
    record.save(update_fields=["status", "borrowed_at", "due_date"])
    book.available_copies -= 1
    book.save(update_fields=["available_copies"])
    log_activity(display_name(staff), "PICKUP_CONFIRMED",
                 f"{display_name(record.user)} picked up “{book.title}”. Due in 14 days.")
    notify(record.user, f"You picked up “{book.title}”. Due back on {record.due_date:%b %d, %Y}.")
    return record


@transaction.atomic
def confirm_return(staff: User, record: BorrowRecord) -> BorrowRecord:
    """BORROWED/OVERDUE -> RETURNED. Stock +1."""
    _assert_transition("return", record)
    book = Book.objects.select_for_update().get(pk=record.book_id)
    record.status = Status.RETURNED
    record.returned_at = timezone.now()
    record.save(update_fields=["status", "returned_at"])
    book.available_copies = min(book.total_copies, book.available_copies + 1)
    book.save(update_fields=["available_copies"])
    log_activity(display_name(staff), "RETURN_CONFIRMED",
                 f"{display_name(record.user)} returned “{book.title}”.")
    return record


@transaction.atomic
def create_reservation(user: User, book: Book) -> Reservation:
    """Member joins the FIFO queue for a zero-stock book."""
    if book.available_copies > 0:
        raise BusinessRuleError("Copies are available — submit a borrow request instead.")
    if queue_for_book(book).filter(user=user).exists():
        raise BusinessRuleError("You are already in the reservation queue for this book.")
    reservation = Reservation.objects.create(user=user, book=book)
    position = list(queue_for_book(book).values_list("id", flat=True)).index(reservation.id) + 1
    log_activity("System", "RESERVED",
                 f"{display_name(user)} joined the queue for “{book.title}” (position {position}).")
    notify(user, f"You joined the reservation queue for “{book.title}” at position {position}.")
    return reservation


def run_hourly_cancellation(now=None) -> int:
    """Idempotent hourly job: expire READY records past pickup_deadline.

    Each expired record becomes CANCELLED; the first active reservation for
    that book is then promoted to a fresh READY record with a new 48h window.
    Safe to run repeatedly — already-cancelled records are never re-touched.
    """
    now = now or timezone.now()
    cancelled = 0
    expired = BorrowRecord.objects.select_for_update().filter(
        status=Status.READY, pickup_deadline__lt=now
    ).select_related("book", "user")
    for record in expired:
        with transaction.atomic():
            _assert_transition("cancel", record)
            record.status = Status.CANCELLED
            record.save(update_fields=["status"])
            cancelled += 1
            book = record.book
            log_activity("System", "AUTO_CANCELLED",
                         f"{display_name(record.user)} missed the 48h pickup window for “{book.title}”. Request auto-cancelled.")
            notify(record.user, f"Your request for “{book.title}” was auto-cancelled after the 48h pickup window expired.")

            nxt = queue_for_book(book).first()
            if nxt:
                nxt.is_active = False
                nxt.save(update_fields=["is_active"])
                BorrowRecord.objects.create(
                    user=nxt.user, book=book, requested_at=nxt.reserved_at,
                    status=Status.READY, approved_at=now, pickup_deadline=now + PICKUP_WINDOW,
                )
                log_activity("System", "QUEUE_HANDOFF",
                             f"Reservation queue: “{book.title}” is now held for {display_name(nxt.user)} (fresh 48h window).")
                notify(nxt.user, f"Good news — “{book.title}” is now held for you. Pick it up within 48 hours.")
    return cancelled


def run_nightly_overdue(now=None) -> int:
    """Idempotent nightly job: BORROWED past due_date -> OVERDUE."""
    now = now or timezone.now()
    flagged = 0
    late = BorrowRecord.objects.select_for_update().filter(
        status=Status.BORROWED, due_date__lt=now
    ).select_related("book", "user")
    for record in late:
        with transaction.atomic():
            _assert_transition("overdue", record)
            record.status = Status.OVERDUE
            record.save(update_fields=["status"])
            flagged += 1
            log_activity("System", "MARKED_OVERDUE",
                         f"{display_name(record.user)}'s loan of “{record.book.title}” is now overdue.")
            notify(record.user, f"“{record.book.title}” is overdue. Please return it — new requests are blocked until resolved.")
    return flagged
