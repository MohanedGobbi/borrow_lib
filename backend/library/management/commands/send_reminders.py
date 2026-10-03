"""Daily loan reminders. Schedule with cron / Celery Beat in the morning:

    0 8 * * * python manage.py send_reminders

Emails members whose loan is due within the reminder window (Library rules) and retries overdue emails that
failed to send. Idempotent: every email goes out once per loan, so running it again sends nothing new.
"""
from django.core.management.base import BaseCommand

from library.services import run_daily_reminders


class Command(BaseCommand):
    help = "Email members about loans that are due soon, and retry overdue emails that failed."

    def handle(self, *args, **options):
        sent = run_daily_reminders()
        self.stdout.write(self.style.SUCCESS(f"send_reminders: {sent} email(s) sent"))
