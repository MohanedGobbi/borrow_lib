"""Nightly overdue check. Schedule with cron / Celery Beat at midnight:

    0 0 * * * python manage.py mark_overdue

Idempotent: safe to run repeatedly.
"""
from django.core.management.base import BaseCommand

from library.services import run_nightly_overdue


class Command(BaseCommand):
    help = "Mark BORROWED records past their due date as OVERDUE."

    def handle(self, *args, **options):
        flagged = run_nightly_overdue()
        self.stdout.write(self.style.SUCCESS(f"mark_overdue: {flagged} record(s) flagged overdue"))
