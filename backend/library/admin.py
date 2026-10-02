from django.contrib import admin

from .models import ActivityLog, Book, BorrowRecord, Notification, Reservation, StaffInvite, UserProfile

admin.site.register([Book, UserProfile, BorrowRecord, Reservation, ActivityLog, Notification])


@admin.register(StaffInvite)
class StaffInviteAdmin(admin.ModelAdmin):
    list_display = ["email", "role", "created_by", "created_at", "expires_at", "used_at", "revoked_at"]
    list_filter = ["role"]
    search_fields = ["email"]
    readonly_fields = ["token_hash", "created_at"]
