from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import (
    ActivityLog,
    Book,
    BorrowRecord,
    Category,
    Language,
    Notification,
    Reservation,
    Role,
    StaffInvite,
    Status,
    UserProfile,
    display_name,
)


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
    category = CategorySerializer(read_only=True)
    categoryId = serializers.PrimaryKeyRelatedField(
        source="category", queryset=Category.objects.all(), write_only=True
    )

    class Meta:
        model = Book
        fields = ["id", "title", "author", "isbn", "category", "categoryId", "publisher", "year",
                  "totalCopies", "availableCopies", "freeCopies", "shelfLocation", "coverColor", "coverImage",
                  "description"]

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
    maxBorrowLimit = serializers.IntegerField(source="max_borrow_limit", read_only=True)
    emailVerified = serializers.BooleanField(source="email_verified", read_only=True)
    activeLoans = serializers.SerializerMethodField()
    hasOverdue = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ["id", "uuid", "name", "email", "studentOrStaffId", "phoneNumber", "address",
                  "role", "membershipStartDate", "maxBorrowLimit", "active", "language", "emailVerified",
                  "activeLoans", "hasOverdue"]
        # PATCH /users/me must not let anyone promote or reactivate themselves.
        read_only_fields = ["role", "active"]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

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

    class Meta:
        model = BorrowRecord
        fields = ["id", "userId", "userProfileId", "bookId", "userName", "userIdNumber", "bookTitle", "bookShelf",
                  "requestedAt", "approvedAt", "pickupDeadline", "borrowedAt", "dueDate",
                  "returnedAt", "status"]

    def get_userName(self, obj):
        return obj.user.get_full_name() or obj.user.username


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
        fields = ["id", "at", "actorName", "action", "detail"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "at", "message", "read"]


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    studentId = serializers.CharField(max_length=30)
    phoneNumber = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    address = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    language = serializers.ChoiceField(choices=Language.choices, required=False, default=Language.EN)
    inviteToken = serializers.CharField(required=False, allow_blank=True, default="", write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        # Django's validators: minimum length, common passwords, all-numeric, similarity.
        validate_password(value, User(username=self.initial_data.get("email", ""),
                                      email=self.initial_data.get("email", ""),
                                      first_name=self.initial_data.get("name", "")))
        return value

    def validate_studentId(self, value):
        if UserProfile.objects.filter(student_or_staff_id__iexact=value).exists():
            raise serializers.ValidationError("This ID is already registered.")
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
