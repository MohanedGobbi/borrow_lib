from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

urlpatterns = [
    # auth
    path("auth/register", views.RegisterView.as_view()),
    path("auth/login", TokenObtainPairView.as_view()),
    path("auth/refresh", TokenRefreshView.as_view()),
    path("users/me", views.MeView.as_view()),
    path("users/me/id-card", views.MyIdCardView.as_view()),
    path("users/<uuid:uuid>/scan", views.ScanLookupView.as_view()),
    path("users/<int:pk>/role", views.UserRoleView.as_view()),
    path("users/<int:pk>/active", views.UserActiveView.as_view()),
    # books
    path("books", views.BookListCreateView.as_view()),
    path("books/<int:pk>", views.BookDetailView.as_view()),
    path("books/<int:pk>/reservations", views.BookReservationsView.as_view()),
    # categories
    path("categories", views.CategoryListCreateView.as_view()),
    path("categories/<int:pk>", views.CategoryDetailView.as_view()),
    # borrow records
    path("borrow-records", views.BorrowRecordListCreateView.as_view()),
    path("borrow-records/mine", views.MyBorrowRecordsView.as_view()),
    path("borrow-records/<int:pk>/approve", views.ApproveView.as_view()),
    path("borrow-records/<int:pk>/reject", views.RejectView.as_view()),
    path("borrow-records/<int:pk>/confirm-pickup", views.ConfirmPickupView.as_view()),
    path("borrow-records/<int:pk>/confirm-return", views.ConfirmReturnView.as_view()),
    path("borrow-records/<int:pk>/document", views.BorrowDocumentView.as_view()),
    # reservations
    path("reservations", views.ReservationListCreateView.as_view()),
    path("reservations/all", views.AllReservationsView.as_view()),
    # users (staff/admin)
    path("users", views.UserListView.as_view()),
    path("users/<int:pk>", views.UserDetailView.as_view()),
    path("users/<int:pk>/delete", views.UserDeleteView.as_view()),
    # dashboard / misc
    path("dashboard/stats", views.DashboardStatsView.as_view()),
    path("analytics", views.AnalyticsView.as_view()),
    path("activity", views.ActivityListView.as_view()),
    path("notifications/mine", views.NotificationListView.as_view()),
    path("notifications/read", views.MarkNotificationsReadView.as_view()),
    path("jobs/run", views.RunJobsView.as_view()),
]
