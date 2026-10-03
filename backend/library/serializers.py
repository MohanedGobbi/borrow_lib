from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import (
    ActivityLog,
    Book,
    BorrowRecord,
    Category,
    Language,
    LibrarySettings,
    Notification,
    Reservation,
    Role,
    StaffInvite,
    Status,
    UserProfile,
    display_name,
)


def library_rules(serializer):
    """The circulation settings, read once per response however many rows the serializer renders."""
    root = serializer.root
    if not hasattr(root, "_library_rules"):
        root._library_rules = LibrarySettings.get()
    return root._library_rules


class CategorySerializer(serializers.ModelSerializer):
    bookCount = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "color", "bookCount"]

    def get_bookCount(self, obj):
        # Annotated by the book list so each nested category costs no query; fall back otherwise.
        count = getattr(obj, "book_count", None)
        return obj.books.count() if count is None else count


class BookSerializer(serializers.ModelSerializer):
    totalCopies = serializers.IntegerField(source="total_copies", min_value=1)
    availableCopies = serializers.IntegerField(source="available_copies", read_only=True)
    freeCopies = serializers.SerializerMethodField()
    shelfLocation = serializers.CharField(source="shelf_location", required=False, allow_blank=True)
    coverColor = serializers.CharField(source="cover_color", required=False)
    coverImage = serializers.ImageField(source="cover_image", required=False, allow_null=True)
    # Staff only: the one loan to return from the desk search, when the book has exactly one active loan.
    activeLoanId = serializers.SerializerMethodField()
    activeLoanMember = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    categoryId = serializers.PrimaryKeyRelatedField(
        source="category", queryset=Category.objects.all(), write_only=True
    )

    class Meta:
        model = Book
        fields = ["id", "title", "author", "isbn", "category", "categoryId", "publisher", "year",
                  "totalCopies", "availableCopies", "freeCopies", "shelfLocation", "coverColor", "coverImage",
                  "description", "activeLoanId", "activeLoanMember"]

    def _single_loan(self, obj):
        from .permissions import role_of
        request = self.context.get("request")
        if request is None or role_of(request.user) not in (Role.STAFF, Role.ADMIN):
            return None
        if getattr(obj, "active_loan_n", None) != 1:  # the views annotate it; bare instances have no answer
            return None
        return obj

    def get_activeLoanId(self, obj):
        loan = self._single_loan(obj)
        return loan.first_loan_id if loan else None

    def get_activeLoanMember(self, obj):
        loan = self._single_loan(obj)
        if not loan:
            return None
        return f"{loan.first_loan_first} {loan.first_loan_last}".strip() or loan.first_loan_username

    def get_freeCopies(self, obj):
        # Views annotate ready_count to avoid a query per book; fall back for bare instances.
        ready = getattr(obj, "ready_count", None)
        if ready is None:
            ready = obj.borrow_records.filter(status=Status.READY).count()
        return max(0, obj.available_copies - ready)


class ProfileSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="user.email", read_only=True)
    studentOrStaffId = serializers.CharField(source="student_or_staff_id", read_only=True)
    phoneNumber = serializers.CharField(source="phone_number")
    membershipStartDate = serializers.DateField(source="membership_start_date", read_only=True)
    # The limit that applies: a personal override, or the default for the role from the settings.
    maxBorrowLimit = serializers.SerializerMethodField()
    borrowLimitIsDefault = serializers.SerializerMethodField()
    emailVerified = serializers.BooleanField(source="email_verified", read_only=True)
    emailReminders = serializers.BooleanField(source="email_reminders", required=False)
    activeLoans = serializers.SerializerMethodField()
    hasOverdue = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ["id", "uuid", "name", "email", "studentOrStaffId", "phoneNumber", "address",
                  "role", "membershipStartDate", "maxBorrowLimit", "borrowLimitIsDefault", "active", "language", "emailVerified",
                  "emailReminders", "activeLoans", "hasOverdue"]
        # PATCH /users/me must not let anyone promote or reactivate themselves.
        read_only_fields = ["role", "active"]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_maxBorrowLimit(self, obj):
        return obj.borrow_limit_with(library_rules(self))

    def get_borrowLimitIsDefault(self, obj):
        return obj.max_borrow_limit is None

    def get_activeLoans(self, obj):
        # UserListView annotates this; fall back to a query for bare instances.
        count = getattr(obj, "active_loans_count", None)
        if count is None:
            from .services import active_loan_count
            count = active_loan_count(obj.user)
        return count

    def get_hasOverdue(self, obj):
        flag = getattr(obj, "has_overdue_flag", None)
        if flag is None:
            from .services import has_overdue
            flag = has_overdue(obj.user)
        return flag


class BorrowRecordSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="user_id", read_only=True)
    userProfileId = serializers.IntegerField(source="user.profile.id", read_only=True)
    bookId = serializers.IntegerField(source="book_id", read_only=True)
    userName = serializers.SerializerMethodField()
    userIdNumber = serializers.CharField(source="user.profile.student_or_staff_id", read_only=True)
    bookTitle = serializers.CharField(source="book.title", read_only=True)
    bookShelf = serializers.CharField(source="book.shelf_location", read_only=True)
    requestedAt = serializers.DateTimeField(source="requested_at", read_only=True)
    approvedAt = serializers.DateTimeField(source="approved_at", read_only=True)
    pickupDeadline = serializers.DateTimeField(source="pickup_deadline", read_only=True)
    borrowedAt = serializers.DateTimeField(source="borrowed_at", read_only=True)
    dueDate = serializers.DateTimeField(source="due_date", read_only=True)
    returnedAt = serializers.DateTimeField(source="returned_at", read_only=True)
    rejectionReason = serializers.CharField(source="rejection_reason", read_only=True)
    cancelledByMember = serializers.BooleanField(source="cancelled_by_member", read_only=True)
    bookFreeCopies = serializers.SerializerMethodField()
    memberHasOverdue = serializers.SerializerMethodField()
    memberOverdueTitle = serializers.SerializerMethodField()
    memberActiveLoans = serializers.SerializerMethodField()
    memberMaxBorrowLimit = serializers.SerializerMethodField()
    renewalCount = serializers.IntegerField(source="renewal_count", read_only=True)
    bookHasQueue = serializers.SerializerMethodField()

    class Meta:
        model = BorrowRecord
        fields = ["id", "userId", "userProfileId", "bookId", "userName", "userIdNumber", "bookTitle", "bookShelf",
                  "requestedAt", "approvedAt", "pickupDeadline", "borrowedAt", "dueDate",
                  "returnedAt", "status", "rejectionReason", "cancelledByMember", "bookFreeCopies", "memberHasOverdue",
                  "memberOverdueTitle", "memberActiveLoans", "memberMaxBorrowLimit", "renewalCount", "bookHasQueue"]

    # The desk lists annotate these (views.with_desk_annotations); other callers fall back to a query.
    def get_bookFreeCopies(self, obj):
        ready = getattr(obj, "book_ready_count", None)
        if ready is None:
            ready = obj.book.borrow_records.filter(status=Status.READY).count()
        return max(0, obj.book.available_copies - ready)

    def get_memberHasOverdue(self, obj):
        flag = getattr(obj, "member_overdue_flag", None)
        if flag is None:
            from .services import has_overdue
            flag = has_overdue(obj.user)
        return flag

    def get_memberOverdueTitle(self, obj):
        # Only the title of the book to return first; null when the member has no overdue loan.
        if hasattr(obj, "member_overdue_title"):
            return obj.member_overdue_title
        from .services import overdue_title
        return overdue_title(obj.user)

    def get_memberActiveLoans(self, obj):
        count = getattr(obj, "member_active_loans", None)
        if count is None:
            from .services import active_loan_count
            count = active_loan_count(obj.user)
        return count

    def get_memberMaxBorrowLimit(self, obj):
        return obj.user.profile.borrow_limit_with(library_rules(self))

    def get_bookHasQueue(self, obj):
        flag = getattr(obj, "book_has_queue", None)
        if flag is None:
            from .services import has_waiting_list
            flag = has_waiting_list(obj.book)
        return flag

    def get_userName(self, obj):
        return obj.user.get_full_name() or obj.user.username


class PublicRulesSerializer(serializers.Serializer):
    """What every visitor may see: the rules that show up in the interface copy."""
    holdHours = serializers.IntegerField(source="hold_hours")
    loanDays = serializers.IntegerField(source="loan_days")
    maxRenewals = serializers.IntegerField(source="max_renewals")


class LibrarySettingsSerializer(serializers.ModelSerializer):
    """The admin view and the PATCH body of /api/settings. The bounds are the contract in docs/rework/F1.md."""
    holdHours = serializers.IntegerField(source="hold_hours", min_value=1, max_value=168)
    loanDays = serializers.IntegerField(source="loan_days", min_value=1, max_value=90)
    maxRenewals = serializers.IntegerField(source="max_renewals", min_value=0, max_value=5)
    memberBorrowLimit = serializers.IntegerField(source="member_borrow_limit", min_value=1, max_value=50)
    staffBorrowLimit = serializers.IntegerField(source="staff_borrow_limit", min_value=1, max_value=50)
    reminderDaysBeforeDue = serializers.IntegerField(source="reminder_days_before_due", min_value=0, max_value=14)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    updatedBy = serializers.SerializerMethodField()

    class Meta:
        model = LibrarySettings
        fields = ["holdHours", "loanDays", "maxRenewals", "memberBorrowLimit", "staffBorrowLimit",
                  "reminderDaysBeforeDue", "updatedAt", "updatedBy"]

    def get_updatedBy(self, obj):
        return display_name(obj.updated_by) if obj.updated_by else None


class ReservationSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="user_id", read_only=True)
    userProfileId = serializers.IntegerField(source="user.profile.id", read_only=True)
    bookId = serializers.IntegerField(source="book_id", read_only=True)
    userName = serializers.SerializerMethodField()
    bookTitle = serializers.CharField(source="book.title", read_only=True)
    reservedAt = serializers.DateTimeField(source="reserved_at", read_only=True)
    isActive = serializers.BooleanField(source="is_active", read_only=True)
    position = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ["id", "userId", "userProfileId", "bookId", "userName", "bookTitle", "reservedAt", "isActive", "position"]

    def get_userName(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_position(self, obj):
        queue = list(obj.book.reservations.filter(is_active=True).order_by("reserved_at").values_list("id", flat=True))
        try:
            return queue.index(obj.id) + 1
        except ValueError:
            return None


class ActivitySerializer(serializers.ModelSerializer):
    actorName = serializers.CharField(source="actor_name", read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "at", "actorName", "action", "detail", "code", "params"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "at", "code", "params", "message", "read"]


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)  # length and strength: Django's validators, below
    studentId = serializers.CharField(max_length=30)
    phoneNumber = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    address = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    language = serializers.ChoiceField(choices=Language.choices, required=False, default=Language.EN)
    inviteToken = serializers.CharField(required=False, allow_blank=True, default="", write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.", code="unique")
        return value

    def validate_password(self, value):
        # Django's validators: minimum length, common passwords, all-numeric, similarity.
        validate_password(value, User(username=self.initial_data.get("email", ""),
                                      email=self.initial_data.get("email", ""),
                                      first_name=self.initial_data.get("name", "")))
        return value

    def validate_studentId(self, value):
        if UserProfile.objects.filter(student_or_staff_id__iexact=value).exists():
            raise serializers.ValidationError("This ID is already registered.", code="unique")
        return value


class StaffInviteSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=[Role.STAFF, Role.ADMIN])
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    expiresAt = serializers.DateTimeField(source="expires_at", read_only=True)
    createdBy = serializers.SerializerMethodField()

    class Meta:
        model = StaffInvite
        fields = ["id", "email", "role", "createdAt", "expiresAt", "createdBy"]

    def get_createdBy(self, obj):
        return display_name(obj.created_by) if obj.created_by else None
