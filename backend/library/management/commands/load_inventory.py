"""Load the faculty library's inventory (library/data/inventory.csv) into the catalogue.

    python manage.py load_inventory

Safe to run again: titles already in the catalogue (same call number and title) are updated, not duplicated.
Admins can do the same from Settings → Maintenance → Reload the catalogue.
"""
from django.core.management.base import BaseCommand

from library.maintenance import reload_catalogue


class Command(BaseCommand):
    help = "Load the bundled library inventory into the catalogue."

    def handle(self, **options):
        s = reload_catalogue("Inventory (command line)")
        self.stdout.write(self.style.SUCCESS(
            f"Catalogue loaded: {s['create']} new, {s['update']} updated, {s['unchanged']} unchanged, "
            f"{s['error']} with errors."))
