"""Borrow-request receipt PDF — mirrors the REQ-210 reference layout:
header with library branding, receipt number + issue date, colored side-bar
sections for member info / requested book / official processing, signature lines.
"""
import io

from django.conf import settings
from django.http import HttpResponse
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .models import BorrowRecord, display_name

INK = HexColor("#121A16")
GREEN = HexColor("#0E6B3C")
BLUE = HexColor("#2B3F52")
MUTED = HexColor("#5B6660")
LIGHT = HexColor("#F5F7F6")
BURNT = HexColor("#0E6B3C")  # header mark
BRAND = HexColor("#0A5230")

W, H = A4


def _section_header(c, x, y, label, color):
    c.setFillColor(color)
    c.roundRect(x, y - 5 * mm, 1.6 * mm, 7.5 * mm, 0.8 * mm, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 4 * mm, y - 3 * mm, label)


def _field(c, x, y, label, value):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.5)
    c.drawString(x, y, label.upper())
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(x, y - 4.5 * mm, str(value or "—"))


def build_request_document_pdf(record: BorrowRecord) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    m = 18 * mm
    member = record.user
    profile = member.profile
    book = record.book

    # ---------- header ----------
    c.setFillColor(BURNT)
    c.circle(m + 6 * mm, H - 22 * mm, 6 * mm, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(m + 6 * mm, H - 23 * mm, "LB")
    c.setFillColor(BRAND)
    c.circle(W - m - 6 * mm, H - 22 * mm, 6 * mm, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(W - m - 6 * mm, H - 23 * mm, "QR")

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(W / 2, H - 20 * mm, "LIBBORROW")
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(W / 2, H - 27 * mm, "BOOK BORROWING RECEIPT")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawCentredString(W / 2, H - 33 * mm, settings.LIBRARY_NAME)
    c.setStrokeColor(INK)
    c.setLineWidth(1.4)
    c.line(m, H - 38 * mm, W - m, H - 38 * mm)

    # ---------- receipt no + date ----------
    y = H - 52 * mm
    c.setFillColor(LIGHT)
    c.roundRect(m, y - 6 * mm, 46 * mm, 14 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.5)
    c.drawString(m + 4 * mm, y + 3 * mm, "RECEIPT NO.")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(m + 4 * mm, y - 3 * mm, f"REQ-{record.pk:03d}")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.5)
    c.drawRightString(W - m, y + 3 * mm, "DATE ISSUED")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(W - m, y - 3 * mm, f"{record.requested_at:%d %B %Y}")

    # ---------- member information ----------
    y -= 22 * mm
    _section_header(c, m, y, "MEMBER INFORMATION", GREEN)
    col2 = W / 2 + 6 * mm
    rows = [
        ("Full name", display_name(member), "Member ID", profile.student_or_staff_id),
        ("Email", member.email, "Phone", profile.phone_number),
        ("Member since", f"{profile.membership_start_date:%d %B %Y}",
         "Borrow limit", f"{profile.max_borrow_limit} books"),
    ]
    for i, (l1, v1, l2, v2) in enumerate(rows):
        ry = y - 10 * mm - i * 13 * mm
        _field(c, m + 4 * mm, ry, l1, v1)
        _field(c, col2, ry, l2, v2)

    # ---------- requested book ----------
    y -= 22 * mm + 3 * 13 * mm
    _section_header(c, m, y, "REQUESTED BOOK", BLUE)
    ty = y - 10 * mm
    c.setFillColor(LIGHT)
    c.roundRect(m, ty - 22 * mm, W - 2 * m, 26 * mm, 2 * mm, stroke=0, fill=1)
    headers = ["#", "BOOK", "STATUS", "APPROVED", "DUE DATE"]
    xs = [m + 5 * mm, m + 22 * mm, m + 95 * mm, m + 125 * mm, m + 158 * mm]
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 6.5)
    for h, x in zip(headers, xs):
        c.drawString(x, ty, h)
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    c.drawString(xs[0], ty - 9 * mm, f"#{record.pk:03d}")
    c.setFont("Helvetica-Bold", 9)
    title = book.title if len(book.title) < 42 else book.title[:41] + "…"
    c.drawString(xs[1], ty - 9 * mm, title)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(xs[1], ty - 13.5 * mm, f"{book.author} · ISBN {book.isbn} · Shelf {book.shelf_location}")
    # status pill
    pill_color = GREEN if record.status in ("READY", "BORROWED", "RETURNED") else (
        HexColor("#B42318") if record.status in ("REJECTED", "OVERDUE", "CANCELLED") else BRAND)
    c.setFillColor(pill_color)
    c.roundRect(xs[2], ty - 12 * mm, 24 * mm, 6.5 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(xs[2] + 12 * mm, ty - 10 * mm, record.status)
    c.setFillColor(INK)
    c.setFont("Helvetica", 7.5)
    c.drawString(xs[3], ty - 9 * mm, f"{record.approved_at:%d %b %Y %H:%M}" if record.approved_at else "—")
    c.drawString(xs[4], ty - 9 * mm, f"{record.due_date:%d %b %Y}" if record.due_date else "—")

    # ---------- official processing ----------
    y = ty - 40 * mm
    _section_header(c, m, y, "OFFICIAL PROCESSING", GREEN)
    staff = record.approved_by
    c.setFillColor(LIGHT)
    c.roundRect(m, y - 40 * mm, W - 2 * m, 34 * mm, 2 * mm, stroke=0, fill=1)
    prows = [
        ("Processed by", display_name(staff) if staff else "Pending approval",
         "Staff ID", staff.profile.student_or_staff_id if staff else "—"),
        ("Email", staff.email if staff else "—",
         "Processed date", f"{record.approved_at:%d %B %Y at %H:%M}" if record.approved_at else "—"),
        ("Pickup deadline", f"{record.pickup_deadline:%d %B %Y %H:%M}" if record.pickup_deadline else "—",
         "Returned", f"{record.returned_at:%d %B %Y}" if record.returned_at else "—"),
    ]
    for i, (l1, v1, l2, v2) in enumerate(prows):
        ry = y - 12 * mm - i * 10 * mm
        _field(c, m + 5 * mm, ry, l1, v1)
        _field(c, col2, ry, l2, v2)

    # ---------- signature lines ----------
    sy = 42 * mm
    c.setStrokeColor(MUTED)
    c.setDash(3, 3)
    c.line(m, sy, m + 65 * mm, sy)
    c.line(W - m - 65 * mm, sy, W - m, sy)
    c.setDash()
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawCentredString(m + 32.5 * mm, sy - 5 * mm, "Member signature")
    c.drawCentredString(W - m - 32.5 * mm, sy - 5 * mm, "Staff signature")

    c.setFont("Helvetica", 6.5)
    c.drawCentredString(W / 2, 24 * mm,
                        f"{settings.LIBRARY_NAME} · 48-hour pickup window · 14-day loan from pickup · REQ-{record.pk:03d}")

    c.showPage()
    c.save()
    return buf.getvalue()


def request_document_response(record: BorrowRecord) -> HttpResponse:
    pdf = build_request_document_pdf(record)
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="REQ-{record.pk:03d}-receipt.pdf"'
    return resp
