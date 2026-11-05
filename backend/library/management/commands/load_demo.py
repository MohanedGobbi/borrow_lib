"""Build the hosted demo's data: fictional people and circulation on a portion of the inventory.

    DEMO_MODE=1 python manage.py load_demo

Deletes every account except superusers, and all circulation. Refuses to run outside demo mode,
so it can never wipe a real library.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from library import demo


class Command(BaseCommand):
    help = "Reset the demo: wipe accounts and circulation, then build fictional ones (DEMO_MODE only)."

    def handle(self, **options):
        if not settings.DEMO_MODE:
            raise CommandError("This deletes every account. It only runs with DEMO_MODE=1.")
        s = demo.reset()
        self.stdout.write(self.style.SUCCESS(
            f"Demo ready: {s['books']} books, {s['accounts']} accounts, {s['records']} requests and loans."))
