import django_filters as df
from django.db.models import F, Q

from .models import Book, BorrowRecord, UserProfile


class CharInFilter(df.BaseInFilter, df.CharFilter):
    """A single value or a comma-separated list."""


class NumberInFilter(df.BaseInFilter, df.NumberFilter):
    pass


class StableOrderingMixin:
    """Add the primary key as the last sort key so pages never overlap or skip rows."""

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        return qs.order_by(*qs.query.order_by, "pk")


def truthy(value):
    return str(value).lower() in ("1", "true", "yes")


class BookFilter(StableOrderingMixin, df.FilterSet):
    search = df.CharFilter(method="filter_search")
    category = df.CharFilter(field_name="category__name", lookup_expr="exact")
    author = df.CharFilter(lookup_expr="icontains")
    isbn = df.CharFilter(lookup_expr="icontains")
    available = df.CharFilter(method="filter_available")
    ids = NumberInFilter(field_name="pk", lookup_expr="in")
    ordering = df.OrderingFilter(fields=(("title", "title"), ("year", "year"), ("author", "author")))

    class Meta:
        model = Book
        fields = []

    def filter_search(self, qs, name, value):
        return qs.filter(Q(title__icontains=value) | Q(author__icontains=value) | Q(isbn__icontains=value)
                         | Q(shelf_location__icontains=value))

    def filter_available(self, qs, name, value):
        # Free copies > 0: copies on the shelf minus those held for pickup (ready_count annotation).
        return qs.filter(available_copies__gt=F("ready_count")) if truthy(value) else qs


class BorrowRecordFilter(StableOrderingMixin, df.FilterSet):
    status = CharInFilter(field_name="status", lookup_expr="in")
    book = df.NumberFilter(field_name="book_id")
    user = df.NumberFilter(field_name="user_id")
    ordering = df.OrderingFilter(fields=(
        ("requested_at", "requested_at"), ("due_date", "due_date"), ("pickup_deadline", "pickup_deadline"),
    ))

    class Meta:
        model = BorrowRecord
        fields = []


class UserFilter(StableOrderingMixin, df.FilterSet):
    search = df.CharFilter(method="filter_search")
    role = df.CharFilter(field_name="role", lookup_expr="exact")

    class Meta:
        model = UserProfile
        fields = []

    def filter_search(self, qs, name, value):
        return qs.filter(
            Q(user__first_name__icontains=value) | Q(user__last_name__icontains=value)
            | Q(user__email__icontains=value) | Q(student_or_staff_id__icontains=value)
        )
