from django.contrib import admin

from .models import ActivityLog, Book, BorrowRecord, Notification, Reservation, UserProfile

admin.site.register([Book, UserProfile, BorrowRecord, Reservation, ActivityLog, Notification])
