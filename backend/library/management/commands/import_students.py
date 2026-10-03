"""Import student accounts from an Excel, CSV or JSON file (the yearly enrolment list).

    python manage.py import_students students.xlsx --dry-run
    python manage.py import_students students.xlsx

Each new student gets an account with no password and a welcome email with a link to choose one.
Students who already have an account (same email) are left alone.
"""
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from library.importing import read_rows
from library.student_import import error_text, run_student_import


class Command(BaseCommand):
    help = "Create student accounts from an .xlsx, .csv or .json file. Rows with errors are reported and skipped."

    def add_arguments(self, parser):
        parser.add_argument("path")
        parser.add_argument("--dry-run", action="store_true", help="Validate and report without saving or emailing.")

    def handle(self, path, dry_run, **options):
        file = Path(path)
        if not file.is_file():
            raise CommandError(f"File not found: {file}")
        try:
            rows = read_rows(file.name, file.read_bytes())
            report = run_student_import(rows, dry_run=dry_run, actor_name="Import (command line)", source=file.name)
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
        verb = "Would create" if dry_run else "Created"
        sent = "" if dry_run else f" {report['emailsSent']} welcome email(s) sent."
        self.stdout.write(self.style.SUCCESS(
            f"{verb}: {s['create']} accounts, {s['exists']} already had one, {s['error']} with errors.{sent}"
        ))
