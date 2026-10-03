from django.contrib import admin

from .models import ActivityLog, Book, BorrowRecord, LibrarySettings, Notification, Reservation, StaffInvite, UserProfile

admin.site.register([Book, UserProfile, BorrowRecord, Reservation, ActivityLog, Notification])


@admin.register(StaffInvite)
class StaffInviteAdmin(admin.ModelAdmin):
    list_display = ["email", "role", "created_by", "created_at", "expires_at", "used_at", "revoked_at"]
    list_filter = ["role"]
    search_fields = ["email"]
    readonly_fields = ["token_hash", "created_at"]


@admin.register(LibrarySettings)
class LibrarySettingsAdmin(admin.ModelAdmin):
    readonly_fields = ["updated_at", "updated_by"]

    def has_add_permission(self, request):
        return not LibrarySettings.objects.exists()  # a singleton: edit the one row

    def has_delete_permission(self, request, obj=None):
        return False
