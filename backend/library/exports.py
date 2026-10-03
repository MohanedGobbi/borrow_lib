"""Catalogue and loan exports (docs/rework/F3.md): GET /api/exports/books and /api/exports/loans.

- The book columns are the import format, so an export can be edited and imported again; the two
  read-only stock columns at the end are ignored by the import.
- CSV is UTF-8 with a BOM (Excel then opens Arabic correctly) and streamed row by row; XLSX is written
  with openpyxl's write-only mode.
- Formula injection: a text cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return would be
  run as a formula by Excel or Sheets, so it gets a leading apostrophe in both formats.
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, time
from typing import Iterable, Iterator
from zoneinfo import ZoneInfo

from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone

from .errors import BusinessRuleError
from .models import display_name

BOOK_COLUMNS = ["isbn", "title", "author", "category", "publisher", "year", "total_copies", "shelf_location",
                "description", "available_copies", "free_copies"]
LOAN_COLUMNS = ["member", "student_id", "email", "title", "isbn", "shelf_location", "status", "requested_at",
                "borrowed_at", "due_date", "returned_at", "renewals"]

FORMATS = ("csv", "xlsx")
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value):
    """Defuse a text cell that a spreadsheet would read as a formula. Numbers and blanks pass through."""
    if isinstance(value, str) and value.startswith(FORMULA_STARTS):
        return "'" + value
    return value


def library_zone() -> ZoneInfo:
    return ZoneInfo(settings.LIBRARY_TIME_ZONE)


def local_stamp(value: datetime | None) -> str:
    """ISO `YYYY-MM-DD HH:MM` in the library's time zone, or blank."""
    return timezone.localtime(value, library_zone()).strftime("%Y-%m-%d %H:%M") if value else ""


def today_local() -> date:
    return timezone.localtime(timezone.now(), library_zone()).date()


def parse_format(raw) -> str:
    fmt = str(raw or "csv").lower()
    if fmt not in FORMATS:
        raise BusinessRuleError("export_bad_format", "format must be 'csv' or 'xlsx'.")
    return fmt


def parse_day(raw, name: str) -> date | None:
    """`YYYY-MM-DD` or nothing."""
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw))
    except ValueError:
        raise BusinessRuleError("export_bad_date", f"'{name}' must be a date like 2026-10-03.", field=name) from None


def day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=library_zone())


def book_rows(books: Iterable) -> Iterator[list]:
    for b in books:
        free = max(0, b.available_copies - getattr(b, "ready_count", 0))
        yield [b.isbn, b.title, b.author, b.category.name, b.publisher, b.year, b.total_copies, b.shelf_location,
               b.description, b.available_copies, free]


def loan_rows(records: Iterable) -> Iterator[list]:
    for r in records:
        yield [display_name(r.user), r.user.profile.student_or_staff_id, r.user.email, r.book.title, r.book.isbn,
               r.book.shelf_location, r.status, local_stamp(r.requested_at), local_stamp(r.borrowed_at),
               local_stamp(r.due_date), local_stamp(r.returned_at), r.renewal_count]


class _Echo:
    def write(self, value):
        return value


def _csv_stream(columns: list[str], rows: Iterable[list]) -> Iterator[str]:
    writer = csv.writer(_Echo())
    yield "\ufeff" + writer.writerow(columns)
    for row in rows:
        yield writer.writerow([safe_cell("" if v is None else v) for v in row])


def export_response(kind: str, fmt: str, columns: list[str], rows: Iterable[list]):
    """A download named libborrow-<kind>-<today>.<fmt>."""
    filename = f"libborrow-{kind}-{today_local().isoformat()}.{fmt}"
    if fmt == "csv":
        response = StreamingHttpResponse(_csv_stream(columns, rows), content_type="text/csv; charset=utf-8")
    else:
        from openpyxl import Workbook
        wb = Workbook(write_only=True)
        sheet = wb.create_sheet(kind)
        sheet.append(columns)
        for row in rows:
            sheet.append([safe_cell(v) for v in row])
        buffer = io.BytesIO()
        wb.save(buffer)
        response = HttpResponse(buffer.getvalue(), content_type=XLSX_TYPE)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
