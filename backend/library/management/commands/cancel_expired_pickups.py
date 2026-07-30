"""Hourly pickup-cancellation task. Schedule with cron / Celery Beat:

    * * * * * python manage.py cancel_expired_pickups   (run hourly)

Idempotent: safe to run repeatedly.
"""
from django.core.management.base import BaseCommand

from library.services import run_hourly_cancellation


class Command(BaseCommand):
    help = "Cancel READY records past their 48h pickup deadline and hand slots to the reservation queue."

    def handle(self, *args, **options):
        cancelled = run_hourly_cancellation()
        self.stdout.write(self.style.SUCCESS(f"cancel_expired_pickups: {cancelled} record(s) cancelled"))
