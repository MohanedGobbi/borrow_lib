"""Import books from an Excel, CSV or JSON file (first big load of the catalogue).

    python manage.py import_books catalogue.xlsx --dry-run
    python manage.py import_books catalogue.xlsx            # skip books already in the catalogue
    python manage.py import_books catalogue.xlsx --update   # update books with the same ISBN
"""
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from library.importing import error_text, read_rows, run_import


class Command(BaseCommand):
    help = "Import books from an .xlsx, .csv or .json file. Rows with errors are reported and skipped."

    def add_arguments(self, parser):
        parser.add_argument("path")
        parser.add_argument("--update", action="store_true", help="Update books that already exist (matched by ISBN).")
        parser.add_argument("--dry-run", action="store_true", help="Validate and report without saving.")

    def handle(self, path, update, dry_run, **options):
        file = Path(path)
        if not file.is_file():
            raise CommandError(f"File not found: {file}")
        try:
            rows = read_rows(file.name, file.read_bytes())
            report = run_import(rows, mode="update" if update else "skip", dry_run=dry_run,
                                actor_name="Import (command line)", source=file.name)
        except ValueError as e:
            raise CommandError(str(e)) from e

        if report["missingColumns"]:
            raise CommandError(f"Missing required columns: {', '.join(report['missingColumns'])}.")
        ignored = [h for h, f in report["columns"].items() if f is None]
        if ignored:
            self.stdout.write(self.style.WARNING(f"Ignored columns: {', '.join(ignored)}"))
        for row in report["rows"]:
            if row["status"] == "error":
                self.stdout.write(self.style.ERROR(f"Row {row['row']}: {' '.join(error_text(e) for e in row['errors'])}"))

        s = report["summary"]
        verb = "Would import" if dry_run else "Imported"
        self.stdout.write(self.style.SUCCESS(
            f"{verb}: {s['create']} new, {s['update']} updated, {s['unchanged'] + s['skip']} unchanged or skipped, "
            f"{s['error']} with errors. New categories: {', '.join(report['newCategories']) or 'none'}."
        ))
