"""Borrow lifecycle state machine + background jobs.

The spine of the system: a loan starts at physical pickup, never at approval.
READY records expire `hold_hours` (default 48) after approval; the slot then goes to the next
member in the reservation queue. A loan is due `loan_days` (default 14) after pickup. Both come from
LibrarySettings and apply to the next approval or pickup: existing deadlines never move.
available_copies changes ONLY at pickup (-1) and return (+1). Free copies = available_copies minus the copies held (READY)
on the pickup shelf; approvals, requests and queue handoffs all use that count.
"""
from datetime import timedelta
from django.db import transaction
from django.utils import timezone

from .models import (
    Book,
    BorrowRecord,
    LibrarySettings,
    Reservation,
    Role,
    Status,
    User,
    UserProfile,
    display_name,
    log_activity,
    notify,
)
from .errors import BusinessRuleError, Forbidden, NotFoundError, StateMachineError  # noqa: F401  (re-exported for callers and tests)

# A loan can be renewed only this close to its due date. A fixed rule, not an admin setting.
RENEW_WINDOW_DAYS = 3
REJECTION_REASON_MAX = 300

ACTIVE_STATUSES = [Status.PENDING, Status.READY, Status.BORROWED, Status.OVERDUE]

# Explicit transition table: operation -> allowed source statuses.
TRANSITIONS = {
    "approve": [Status.PENDING],
    "reject": [Status.PENDING],
    "pickup": [Status.READY],
    "return": [Status.BORROWED, Status.OVERDUE],
    "cancel": [Status.READY],
    "withdraw": [Status.PENDING, Status.READY],
    "overdue": [Status.BORROWED],
    "renew": [Status.BORROWED],
}


UNVERIFIED_MESSAGE = "Confirm your email address first: check your inbox for the verification link."


def _assert_transition(op: str, record: BorrowRecord):
    if record.status not in TRANSITIONS[op]:
        raise StateMachineError(
            "invalid_transition",
            f"Invalid transition: cannot {op} a record in status {record.status}.",
            action=op, status=record.status,
        )


def has_overdue(user: User) -> bool:
    return user.borrow_records.filter(status=Status.OVERDUE).exists()


def active_loan_count(user: User) -> int:
    return user.borrow_records.filter(status__in=ACTIVE_STATUSES).count()


def queue_for_book(book: Book):
    return book.reservations.filter(is_active=True).order_by("reserved_at")


def has_waiting_list(book: Book) -> bool:
    """Someone with an active account is waiting for this book (a renewal would keep it from them)."""
    return queue_for_book(book).filter(user__profile__active=True).exists()


def free_copies(book: Book) -> int:
    """Copies on the shelf that are not already held for a READY pickup."""
    held = book.borrow_records.filter(status=Status.READY).count()
    return max(0, book.available_copies - held)


def _hand_to_queue(book: Book, now) -> BorrowRecord | None:
    """Give a free copy to the first eligible member of the reservation queue.

    Inactive members are dropped from the queue. The new READY record gets a
    fresh pickup window; stock is not touched. Call with the book row locked.
    """
    if free_copies(book) <= 0:
        return None
    hours = LibrarySettings.get().hold_hours
    for reservation in queue_for_book(book).select_related("user__profile"):
        reservation.is_active = False
        reservation.save(update_fields=["is_active"])
        if not reservation.user.profile.active:
            continue
        record = BorrowRecord.objects.create(
            user=reservation.user, book=book, requested_at=reservation.reserved_at,
            status=Status.READY, approved_at=now, pickup_deadline=now + timedelta(hours=hours),
        )
        log_activity("System", "QUEUE_HANDOFF",
                     f"Reservation queue: “{book.title}” is now held for {display_name(reservation.user)} (fresh {hours}h window).",
                     member=display_name(reservation.user), title=book.title, hours=hours)
        notify(reservation.user, "queue_handoff",
               f"Good news — “{book.title}” is now held for you. Pick it up within {hours} hours.",
               title=book.title, hours=hours)
        return record
    return None


@transaction.atomic
def create_request(user: User, book: Book) -> BorrowRecord:
    """Member creates a PENDING request. Stock is NOT touched."""
    profile = UserProfile.objects.get(user_id=user.id)  # fresh: the limit or flags may have changed since sign-in
    if not profile.active:
        raise BusinessRuleError("account_inactive", "Your account is deactivated.")
    if not profile.email_verified:
        raise BusinessRuleError("email_unverified", UNVERIFIED_MESSAGE)
    if has_overdue(user):
        raise BusinessRuleError("overdue_block", "You have an overdue loan. Resolve it before requesting new books.")
    limit = profile.effective_borrow_limit
    if active_loan_count(user) >= limit:
        raise BusinessRuleError("borrow_limit", f"Borrow limit reached ({limit}). Return a book first.", limit=limit)
    if free_copies(book) <= 0:
        raise BusinessRuleError("no_free_copy", "No copies available — join the reservation queue instead.")
    if user.borrow_records.filter(book=book, status__in=[Status.PENDING, Status.READY]).exists():
        raise BusinessRuleError("already_requested", "You already have an open request for this book.")
    record = BorrowRecord.objects.create(user=user, book=book)
    log_activity(display_name(user), "REQUEST_CREATED", f"{display_name(user)} requested “{book.title}”.",
                 member=display_name(user), title=book.title)
    return record


@transaction.atomic
def approve(staff: User, record: BorrowRecord) -> BorrowRecord:
    """PENDING -> READY. Sets approved_at and the pickup deadline (`hold_hours` from now)."""
    _assert_transition("approve", record)
    book = Book.objects.select_for_update().get(pk=record.book_id)
    if free_copies(book) <= 0:
        raise BusinessRuleError("approve_no_free_copy",
                                "No free copy to hold — every copy is on loan or already held for pickup.")
    now = timezone.now()
    hours = LibrarySettings.get().hold_hours
    record.status = Status.READY
    record.approved_at = now
    record.pickup_deadline = now + timedelta(hours=hours)
    record.approved_by = staff
    record.save(update_fields=["status", "approved_at", "pickup_deadline", "approved_by"])
    log_activity(display_name(staff), "APPROVED",
                 f"Approved {display_name(record.user)}'s request for “{record.book.title}”. Pickup within {hours}h.",
                 member=display_name(record.user), title=record.book.title, hours=hours)
    notify(record.user, "request_approved",
           f"Your request for “{record.book.title}” was approved. Pick it up within {hours} hours.",
           title=record.book.title, hours=hours)
    return record


@transaction.atomic
def reject(staff: User, record: BorrowRecord, reason: str = "") -> BorrowRecord:
    """PENDING -> REJECTED (terminal). An optional reason (max 300 characters) is shown to the member."""
    _assert_transition("reject", record)
    reason = (reason or "").strip()[:REJECTION_REASON_MAX]
    record.status = Status.REJECTED
    record.rejection_reason = reason
    record.save(update_fields=["status", "rejection_reason"])
    log_activity(display_name(staff), "REJECTED",
                 f"Rejected {display_name(record.user)}'s request for “{record.book.title}”.",
                 member=display_name(record.user), title=record.book.title)
    if reason:
        notify(record.user, "request_rejected",
               f"Your request for “{record.book.title}” was rejected by staff. Reason: {reason}",
               title=record.book.title, reason=reason)
    else:
        notify(record.user, "request_rejected",
               f"Your request for “{record.book.title}” was rejected by staff.", title=record.book.title)
    return record


@transaction.atomic
def confirm_pickup(staff: User, record: BorrowRecord) -> BorrowRecord:
    """READY -> BORROWED. The ONLY place stock is decremented."""
    _assert_transition("pickup", record)
    book = Book.objects.select_for_update().get(pk=record.book_id)
    if book.available_copies <= 0:
        raise BusinessRuleError("pickup_no_copy", "No physical copy on the shelf to hand out.")
    now = timezone.now()
    days = LibrarySettings.get().loan_days
    record.status = Status.BORROWED
    record.borrowed_at = now
    record.due_date = now + timedelta(days=days)
    record.save(update_fields=["status", "borrowed_at", "due_date"])
    book.available_copies -= 1
    book.save(update_fields=["available_copies"])
    log_activity(display_name(staff), "PICKUP_CONFIRMED",
                 f"{display_name(record.user)} picked up “{book.title}”. Due in {days} days.",
                 member=display_name(record.user), title=book.title, days=days)
    notify(record.user, "picked_up", f"You picked up “{book.title}”. Due back on {record.due_date:%b %d, %Y}.",
           title=book.title, dueDate=record.due_date.isoformat())
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
                 f"{display_name(record.user)} returned “{book.title}”.",
                 member=display_name(record.user), title=book.title)
    _hand_to_queue(book, timezone.now())
    return record


@transaction.atomic
def create_reservation(user: User, book: Book) -> Reservation:
    """Member joins the FIFO queue for a book with no free copy."""
    if not user.profile.active:
        raise BusinessRuleError("account_inactive", "Your account is deactivated.")
    if not user.profile.email_verified:
        raise BusinessRuleError("email_unverified", UNVERIFIED_MESSAGE)
    if free_copies(book) > 0:
        raise BusinessRuleError("copies_available", "Copies are available — submit a borrow request instead.")
    if queue_for_book(book).filter(user=user).exists():
        raise BusinessRuleError("already_queued", "You are already in the reservation queue for this book.")
    reservation = Reservation.objects.create(user=user, book=book)
    position = list(queue_for_book(book).values_list("id", flat=True)).index(reservation.id) + 1
    log_activity(display_name(user), "RESERVED",
                 f"{display_name(user)} joined the queue for “{book.title}” (position {position}).",
                 member=display_name(user), title=book.title, position=position)
    notify(user, "queue_joined", f"You joined the reservation queue for “{book.title}” at position {position}.",
           title=book.title, position=position)
    return reservation


@transaction.atomic
def withdraw(user: User, record: BorrowRecord) -> BorrowRecord:
    """PENDING/READY -> CANCELLED by the record's owner. Stock never changes.

    A READY hold never took a copy off the shelf, so withdrawing it frees the copy for the
    next member in the queue (same handoff as the expiry job). Staff use reject instead.
    """
    if record.user_id != user.id:
        raise Forbidden("forbidden", "Only the member who made the request can withdraw it.")
    # Lock the book before the record, the same order as approve/pickup/return and the hourly job.
    book = Book.objects.select_for_update().get(pk=record.book_id)
    record = BorrowRecord.objects.select_for_update().select_related("user", "book").get(pk=record.pk)
    _assert_transition("withdraw", record)
    was_ready = record.status == Status.READY
    record.status = Status.CANCELLED
    record.cancelled_by_member = True
    record.save(update_fields=["status", "cancelled_by_member"])
    log_activity(display_name(user), "REQUEST_WITHDRAWN",
                 f"{display_name(user)} withdrew their request for “{book.title}”.",
                 member=display_name(user), title=book.title)
    if was_ready:
        _hand_to_queue(book, timezone.now())
    return record


@transaction.atomic
def leave_reservation(user: User, reservation: Reservation) -> None:
    """The owner leaves a waiting list. Everyone behind moves up; positions are computed, not stored."""
    if reservation.user_id != user.id:
        raise Forbidden("forbidden", "Only the member on the waiting list can leave it.")
    reservation = Reservation.objects.select_for_update().get(pk=reservation.pk)
    if not reservation.is_active:
        raise NotFoundError("not_found", "You are no longer on this waiting list.")
    reservation.is_active = False
    reservation.save(update_fields=["is_active"])


@transaction.atomic
def renew(actor: User, record: BorrowRecord) -> BorrowRecord:
    """BORROWED -> BORROWED with the due date pushed back by `loan_days`.

    The borrower renews their own loan; staff may renew on a member's behalf at the desk.
    Blocked when the loan is not BORROWED, the member has another overdue loan, the renewals are
    used up, someone is waiting for the book, or the due date is still more than RENEW_WINDOW_DAYS away.
    """
    from .permissions import role_of
    if record.user_id != actor.id and role_of(actor) not in (Role.STAFF, Role.ADMIN):
        raise Forbidden("forbidden", "Only the borrower or library staff can renew this loan.")
    # Lock the book before the record, the same order as approve/pickup/return and the hourly job.
    book = Book.objects.select_for_update().get(pk=record.book_id)
    record = BorrowRecord.objects.select_for_update().select_related("user", "book").get(pk=record.pk)
    _assert_transition("renew", record)
    if has_overdue(record.user):
        raise BusinessRuleError("overdue_block", "You have an overdue loan. Resolve it before renewing.")
    rules = LibrarySettings.get()
    if record.renewal_count >= rules.max_renewals:
        raise BusinessRuleError("renew_limit", f"This loan cannot be renewed again (limit {rules.max_renewals}).",
                                max=rules.max_renewals)
    if has_waiting_list(book):
        raise BusinessRuleError("renew_queue", "Someone is waiting for this book, so it cannot be renewed.")
    now = timezone.now()
    if record.due_date - now > timedelta(days=RENEW_WINDOW_DAYS):
        raise BusinessRuleError("renew_too_early",
                                f"A loan can be renewed in the last {RENEW_WINDOW_DAYS} days before it is due.",
                                days=RENEW_WINDOW_DAYS)
    record.due_date = record.due_date + timedelta(days=rules.loan_days)
    record.renewal_count += 1
    record.save(update_fields=["due_date", "renewal_count"])
    on_behalf = record.user_id != actor.id
    detail = f"{display_name(actor)} renewed “{book.title}”"
    if on_behalf:
        detail += f" for {display_name(record.user)}"
    log_activity(display_name(actor), "LOAN_RENEWED", f"{detail}. New due date {record.due_date:%b %d, %Y}.",
                 member=display_name(record.user), title=book.title, dueDate=record.due_date.isoformat())
    if on_behalf:
        notify(record.user, "loan_renewed",
               f"Staff renewed “{book.title}” for you. New due date {record.due_date:%b %d, %Y}.",
               title=book.title, dueDate=record.due_date.isoformat())
    return record


def run_hourly_cancellation(now=None) -> int:
    """Idempotent hourly job: expire READY records past pickup_deadline.

    Each expired record becomes CANCELLED; the first eligible active reservation
    for that book is then promoted to a fresh READY record with a new hold window.
    Safe to run repeatedly — already-cancelled records are never re-touched.
    Each record gets its own transaction, so row locks work outside a request.
    """
    now = now or timezone.now()
    cancelled = 0
    expired_ids = list(BorrowRecord.objects.filter(
        status=Status.READY, pickup_deadline__lt=now
    ).values_list("pk", flat=True))
    for pk in expired_ids:
        with transaction.atomic():
            # Lock the book before the record, the same order as approve/pickup/return.
            book_id = BorrowRecord.objects.values_list("book_id", flat=True).get(pk=pk)
            book = Book.objects.select_for_update().get(pk=book_id)
            record = BorrowRecord.objects.select_for_update().get(pk=pk)
            if record.status != Status.READY:
                continue
            _assert_transition("cancel", record)
            record.status = Status.CANCELLED
            record.save(update_fields=["status"])
            cancelled += 1
            # The window this hold actually had (the setting may have changed since it was approved).
            hours = (round((record.pickup_deadline - record.approved_at).total_seconds() / 3600)
                     if record.approved_at else LibrarySettings.get().hold_hours)
            log_activity("System", "AUTO_CANCELLED",
                         f"{display_name(record.user)} missed the {hours}h pickup window for “{book.title}”. Request auto-cancelled.",
                         member=display_name(record.user), title=book.title, hours=hours)
            notify(record.user, "hold_expired",
                   f"Your request for “{book.title}” was auto-cancelled after the {hours}h pickup window expired.",
                   title=book.title, hours=hours)
            _hand_to_queue(book, now)
    return cancelled


def run_nightly_overdue(now=None) -> int:
    """Idempotent nightly job: BORROWED past due_date -> OVERDUE."""
    now = now or timezone.now()
    flagged = 0
    late_ids = list(BorrowRecord.objects.filter(
        status=Status.BORROWED, due_date__lt=now
    ).values_list("pk", flat=True))
    for pk in late_ids:
        with transaction.atomic():
            record = BorrowRecord.objects.select_for_update().get(pk=pk)
            if record.status != Status.BORROWED:
                continue
            _assert_transition("overdue", record)
            record.status = Status.OVERDUE
            record.save(update_fields=["status"])
            flagged += 1
            log_activity("System", "MARKED_OVERDUE",
                         f"{display_name(record.user)}'s loan of “{record.book.title}” is now overdue.",
                         member=display_name(record.user), title=record.book.title)
            notify(record.user, "overdue",
                   f"“{record.book.title}” is overdue. Please return it — new requests are blocked until resolved.",
                   title=record.book.title)
    return flagged
