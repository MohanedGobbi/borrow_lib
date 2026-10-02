from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status as http
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .filters import BookFilter, BorrowRecordFilter, UserFilter
from .idcard import id_card_response
from .models import (
    ActivityLog,
    Book,
    BorrowRecord,
    Category,
    Notification,
    Reservation,
    Role,
    Status,
    UserProfile,
    display_name,
    log_activity,
)
from .pagination import StandardPagination
from .permissions import IsAdmin, IsStaffOrAdmin
from .serializers import (
    ActivitySerializer,
    BookSerializer,
    BorrowRecordSerializer,
    CategorySerializer,
    NotificationSerializer,
    ProfileSerializer,
    RegisterSerializer,
    ReservationSerializer,
)


def business_errors(fn):
    """Map service-layer errors to HTTP responses."""
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except services.StateMachineError as e:
            return Response({"detail": str(e)}, status=http.HTTP_409_CONFLICT)
        except services.BusinessRuleError as e:
            return Response({"detail": str(e)}, status=http.HTTP_400_BAD_REQUEST)
    return wrapper


# ------------------------------- auth -------------------------------

class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_register"  # also limits guesses at the staff invite code

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        role = Role.MEMBER
        if d["staffInviteCode"]:
            if d["staffInviteCode"] != settings.STAFF_INVITE_CODE:
                return Response({"detail": "Invalid staff invite code."}, status=http.HTTP_403_FORBIDDEN)
            role = Role.STAFF
        first, _, last = d["name"].strip().partition(" ")
        user = User.objects.create_user(
            username=d["email"].lower(), email=d["email"].lower(),
            password=d["password"], first_name=first, last_name=last,
        )
        UserProfile.objects.create(
            user=user, student_or_staff_id=d["studentId"],
            phone_number=d["phoneNumber"], address=d["address"], role=role,
            max_borrow_limit=10 if role == Role.STAFF else 5,
        )
        log_activity("System", "REGISTERED", f"{display_name(user)} registered as {role.lower()}.")
        return Response(ProfileSerializer(user.profile).data, status=http.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        return Response(ProfileSerializer(request.user.profile).data)

    def patch(self, request):
        profile = request.user.profile
        s = ProfileSerializer(profile, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(ProfileSerializer(profile).data)


class MyIdCardView(APIView):
    def get(self, request):
        return id_card_response(request.user)


class ScanLookupView(APIView):
    """Staff-facing lookup hit by scanning a member ID card QR code."""
    permission_classes = [IsStaffOrAdmin]

    def get(self, request, uuid):
        profile = get_object_or_404(UserProfile, uuid=uuid)
        records = profile.user.borrow_records.filter(status__in=services.ACTIVE_STATUSES)
        return Response({
            "member": ProfileSerializer(profile).data,
            "activeRecords": BorrowRecordSerializer(records, many=True).data,
        })


# ------------------------------- books -------------------------------

def with_ready_count(qs):
    """Annotate each book with the copies held for pickup (READY), for freeCopies."""
    return qs.annotate(ready_count=Count("borrow_records", filter=Q(borrow_records__status=Status.READY)))


class BookListCreateView(generics.ListCreateAPIView):
    serializer_class = BookSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = BookFilter

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOrAdmin()]
        return [AllowAny()]

    def get_queryset(self):
        categories = Category.objects.annotate(book_count=Count("books"))
        return (with_ready_count(Book.objects.all())
                .prefetch_related(Prefetch("category", queryset=categories)).order_by("title"))

    def perform_create(self, serializer):
        book = serializer.save(available_copies=serializer.validated_data["total_copies"])
        log_activity(display_name(self.request.user), "BOOK_ADDED",
                     f"Added “{book.title}” ({book.total_copies} copies) to the catalog.")


class BookDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BookSerializer
    queryset = with_ready_count(Book.objects.all())

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsStaffOrAdmin()]

    def perform_update(self, serializer):
        book = self.get_object()
        new_total = serializer.validated_data.get("total_copies", book.total_copies)
        on_loan = book.total_copies - book.available_copies
        if new_total < on_loan:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": f"Cannot set total below {on_loan} — that many copies are on loan."})
        serializer.save(available_copies=new_total - on_loan)
        log_activity(display_name(self.request.user), "BOOK_UPDATED", f"Updated “{book.title}”.")

    def destroy(self, request, *args, **kwargs):
        book = self.get_object()
        if book.available_copies != book.total_copies:
            return Response({"detail": "Cannot delete: copies are currently on loan."},
                            status=http.HTTP_400_BAD_REQUEST)
        log_activity(display_name(request.user), "BOOK_DELETED", f"Removed “{book.title}” from the catalog.")
        return super().destroy(request, *args, **kwargs)


# ----------------------------- categories -----------------------------

class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOrAdmin()]
        return [AllowAny()]


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsStaffOrAdmin()]

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.books.exists():
            return Response({"detail": "Cannot delete a category that still has books."},
                            status=http.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


# --------------------------- borrow records ---------------------------

class BorrowRecordListCreateView(generics.ListCreateAPIView):
    serializer_class = BorrowRecordSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = BorrowRecordFilter

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsStaffOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return BorrowRecord.objects.select_related("user", "user__profile", "book").order_by("-requested_at")

    @business_errors
    def post(self, request):
        if request.user.profile.role != Role.MEMBER:
            return Response({"detail": "Only member accounts can request books."},
                            status=http.HTTP_403_FORBIDDEN)
        book = get_object_or_404(Book, pk=request.data.get("bookId"))
        record = services.create_request(request.user, book)
        return Response(BorrowRecordSerializer(record).data, status=http.HTTP_201_CREATED)


class MyBorrowRecordsView(generics.ListAPIView):
    serializer_class = BorrowRecordSerializer

    def get_queryset(self):
        return self.request.user.borrow_records.select_related("book")


class _TransitionView(APIView):
    permission_classes = [IsStaffOrAdmin]
    op = None

    @business_errors
    def post(self, request, pk):
        record = get_object_or_404(BorrowRecord, pk=pk)
        result = getattr(services, self.op)(request.user, record)
        return Response(BorrowRecordSerializer(result).data)


class ApproveView(_TransitionView):
    op = "approve"


class RejectView(_TransitionView):
    op = "reject"


class ConfirmPickupView(_TransitionView):
    op = "confirm_pickup"


class ConfirmReturnView(_TransitionView):
    op = "confirm_return"


class BorrowDocumentView(APIView):
    """Request receipt PDF — the owning member or any staff/admin."""
    def get(self, request, pk):
        record = get_object_or_404(BorrowRecord, pk=pk)
        from .permissions import role_of
        if record.user != request.user and role_of(request.user) not in (Role.STAFF, Role.ADMIN):
            return Response({"detail": "Forbidden."}, status=http.HTTP_403_FORBIDDEN)
        from .documents import request_document_response
        return request_document_response(record)


# ---------------------------- reservations ----------------------------

class ReservationListCreateView(APIView):
    def get(self, request):
        qs = request.user.reservations.filter(is_active=True).select_related("book")
        return Response(ReservationSerializer(qs, many=True).data)

    @business_errors
    def post(self, request):
        if request.user.profile.role != Role.MEMBER:
            return Response({"detail": "Only member accounts can reserve books."},
                            status=http.HTTP_403_FORBIDDEN)
        book = get_object_or_404(Book, pk=request.data.get("bookId"))
        reservation = services.create_reservation(request.user, book)
        return Response(ReservationSerializer(reservation).data, status=http.HTTP_201_CREATED)


class BookImportView(APIView):
    """Staff-only bulk import. Body: {rows: [{header: value, "__row": n}], mode: "skip"|"update",
    dryRun: bool, filename: str}. A dry run returns the preview; nothing is written."""
    permission_classes = [IsStaffOrAdmin]

    def post(self, request):
        from .importing import run_import
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
            return Response({"detail": "Expected a list of rows."}, status=http.HTTP_400_BAD_REQUEST)
        try:
            report = run_import(
                rows,
                mode=request.data.get("mode", "skip"),
                dry_run=bool(request.data.get("dryRun", True)),
                actor_name=display_name(request.user),
                source=str(request.data.get("filename", ""))[:120],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=http.HTTP_400_BAD_REQUEST)
        return Response(report)


class BookCopiesView(APIView):
    """Where every copy of a book is: on loan (with due date), held for pickup, or on the shelf.

    Public, so students can see when a copy is expected back; borrower names are
    only included for staff.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from .permissions import role_of
        book = get_object_or_404(Book, pk=pk)
        is_staff = role_of(request.user) in (Role.STAFF, Role.ADMIN)
        out = list(book.borrow_records.filter(status__in=[Status.BORROWED, Status.OVERDUE])
                   .select_related("user__profile").order_by("due_date"))
        held = list(book.borrow_records.filter(status=Status.READY)
                    .select_related("user__profile").order_by("pickup_deadline"))

        def who(r):
            if not is_staff:
                return {}
            return {"recordId": r.id, "userName": display_name(r.user), "userProfileId": r.user.profile.id}

        copies = [{"state": r.status, "dueDate": r.due_date, "since": r.borrowed_at, **who(r)} for r in out]
        on_shelf = max(0, book.total_copies - len(out))
        # READY holds sit on the hold shelf: they are physically in the library but set aside.
        for r in held[:on_shelf]:
            copies.append({"state": "HELD", "heldUntil": r.pickup_deadline, **who(r)})
        copies += [{"state": "ON_SHELF", "shelf": book.shelf_location}
                   for _ in range(on_shelf - min(len(held), on_shelf))]
        for i, c in enumerate(copies, start=1):
            c["copy"] = i
        return Response(copies)


class BookReservationsView(generics.ListAPIView):
    """Staff-only: ordered FIFO queue for one book."""
    permission_classes = [IsStaffOrAdmin]
    serializer_class = ReservationSerializer

    def get_queryset(self):
        return Reservation.objects.filter(
            book_id=self.kwargs["pk"], is_active=True
        ).select_related("user", "book").order_by("reserved_at")


class AllReservationsView(generics.ListAPIView):
    """Staff-only: every active reservation across all books."""
    permission_classes = [IsStaffOrAdmin]
    serializer_class = ReservationSerializer

    def get_queryset(self):
        return Reservation.objects.filter(is_active=True).select_related("user", "book").order_by("reserved_at")


# ---------------------------- dashboard etc ----------------------------

class DashboardStatsView(APIView):
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        return Response({
            "totalBooks": sum(Book.objects.values_list("total_copies", flat=True)),
            "totalBorrowed": BorrowRecord.objects.filter(status=Status.BORROWED).count(),
            "totalReady": BorrowRecord.objects.filter(status=Status.READY).count(),
            "totalOverdue": BorrowRecord.objects.filter(status=Status.OVERDUE).count(),
            "totalMembers": UserProfile.objects.filter(role=Role.MEMBER, active=True).count(),
        })


class ActivityListView(generics.ListAPIView):
    permission_classes = [IsStaffOrAdmin]
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return ActivityLog.objects.all()[:50]


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return self.request.user.notifications.all()[:20]


class MarkNotificationsReadView(APIView):
    def post(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({"ok": True})


# ------------------------------- admin -------------------------------

class UserListView(generics.ListAPIView):
    """Staff-only: all user profiles (search by name/email/ID)."""
    permission_classes = [IsStaffOrAdmin]
    serializer_class = ProfileSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = UserFilter

    def get_queryset(self):
        # Annotated so ProfileSerializer needs no per-row queries (same pattern as ready_count).
        return UserProfile.objects.select_related("user").annotate(
            active_loans_count=Count("user__borrow_records",
                                     filter=Q(user__borrow_records__status__in=services.ACTIVE_STATUSES)),
            has_overdue_flag=Exists(BorrowRecord.objects.filter(user=OuterRef("user"), status=Status.OVERDUE)),
        ).order_by("user__first_name")


class UserDetailView(APIView):
    """Staff-only: one member's profile + full borrowing history."""
    permission_classes = [IsStaffOrAdmin]

    def get(self, request, pk):
        profile = get_object_or_404(UserProfile.objects.select_related("user"), pk=pk)
        records = profile.user.borrow_records.select_related("book")
        return Response({
            "member": ProfileSerializer(profile).data,
            "records": BorrowRecordSerializer(records, many=True).data,
        })


class UserDeleteView(APIView):
    """Admin-only: permanently delete a user account."""
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        profile = get_object_or_404(UserProfile, pk=pk)
        if profile.user == request.user:
            return Response({"detail": "You cannot delete your own account."},
                            status=http.HTTP_400_BAD_REQUEST)
        if profile.role == Role.ADMIN and not profile.user.is_superuser:
            return Response({"detail": "Only superusers can delete admin accounts."},
                            status=http.HTTP_400_BAD_REQUEST)
        name = display_name(profile.user)
        profile.user.delete()
        log_activity(display_name(request.user), "ACCOUNT_DELETED", f"Deleted {name}'s account.")
        return Response(status=http.HTTP_204_NO_CONTENT)


class UserRoleView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        profile = get_object_or_404(UserProfile, pk=pk)
        role = request.data.get("role")
        if role not in Role.values:
            return Response({"detail": "Invalid role."}, status=http.HTTP_400_BAD_REQUEST)
        profile.role = role
        profile.save(update_fields=["role"])
        log_activity(display_name(request.user), "ROLE_CHANGED",
                     f"Changed {display_name(profile.user)}'s role to {role}.")
        return Response(ProfileSerializer(profile).data)


class UserActiveView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        profile = get_object_or_404(UserProfile, pk=pk)
        profile.active = bool(request.data.get("active"))
        profile.save(update_fields=["active"])
        # signals.py mirrors this onto User.is_active, which SimpleJWT checks.
        log_activity(display_name(request.user), "ACCOUNT_TOGGLED",
                     f"{'Reactivated' if profile.active else 'Deactivated'} {display_name(profile.user)}'s account.")
        return Response(ProfileSerializer(profile).data)


# ------------------------------- jobs -------------------------------

class RunJobsView(APIView):
    """Ops helper: run the hourly + nightly jobs on demand (idempotent)."""
    permission_classes = [IsStaffOrAdmin]

    def post(self, request):
        cancelled = services.run_hourly_cancellation()
        overdue = services.run_nightly_overdue()
        return Response({"cancelled": cancelled, "flaggedOverdue": overdue})


# ------------------------------ analytics ------------------------------

class AnalyticsView(APIView):
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        from datetime import timedelta
        from django.db.models import Count
        from django.utils import timezone

        now = timezone.now()

        # status distribution (all records ever)
        status_dist = {
            row["status"]: row["n"]
            for row in BorrowRecord.objects.values("status").annotate(n=Count("id"))
        }

        # category distribution: loans per category
        cat_loans = list(
            BorrowRecord.objects.values("book__category__name", "book__category__color")
            .annotate(n=Count("id"))
            .order_by("-n")
        )
        category_loans = [
            {"name": r["book__category__name"] or "Uncategorized",
             "color": r["book__category__color"] or "#4A5560", "loans": r["n"]}
            for r in cat_loans
        ]

        # monthly loans (picked up) for the last 6 months
        monthly = []
        for i in range(5, -1, -1):
            start = (now - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end = (start + timedelta(days=32)).replace(day=1)
            monthly.append({
                "month": f"{start:%b %Y}",
                "loans": BorrowRecord.objects.filter(borrowed_at__gte=start, borrowed_at__lt=end).count(),
                "returns": BorrowRecord.objects.filter(returned_at__gte=start, returned_at__lt=end).count(),
                "newMembers": UserProfile.objects.filter(
                    membership_start_date__gte=start.date(), membership_start_date__lt=end.date()
                ).count(),
            })

        # top books by number of records
        top = list(
            BorrowRecord.objects.values("book__title")
            .annotate(n=Count("id")).order_by("-n")[:5]
        )
        top_books = [{"title": t["book__title"], "requests": t["n"]} for t in top]

        active_reservations = Reservation.objects.filter(is_active=True).count()

        return Response({
            "statusDistribution": status_dist,
            "categoryLoans": category_loans,
            "monthly": monthly,
            "topBooks": top_books,
            "activeReservations": active_reservations,
            "fulfillmentRate": round(
                100 * BorrowRecord.objects.filter(status__in=[Status.RETURNED, Status.BORROWED, Status.OVERDUE]).count()
                / max(1, BorrowRecord.objects.count()), 1),
        })
