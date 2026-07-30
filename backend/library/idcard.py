import io

import qrcode
from django.conf import settings
from django.contrib.auth.models import User
from django.http import HttpResponse
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .models import display_name
from .services import active_loan_count

CARD_W, CARD_H = 148 * mm, 105 * mm  # credit-card-like


def build_id_card_pdf(user: User) -> bytes:
    profile = user.profile
    scan_url = f"{settings.FRONTEND_URL}/scan/{profile.uuid}"

    qr_img = qrcode.make(scan_url, box_size=8, border=1)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(CARD_W, CARD_H))

    ink = HexColor("#111827")
    burnt = HexColor("#C55221")
    brand = HexColor("#CC8800")
    cream = HexColor("#FAF3E3")

    # background + poster accents
    c.setFillColor(ink)
    c.rect(0, 0, CARD_W, CARD_H, stroke=0, fill=1)
    c.setFillColor(burnt)
    c.circle(CARD_W - 6 * mm, CARD_H - 6 * mm, 26 * mm, stroke=0, fill=1)
    c.setFillColor(brand)
    c.circle(4 * mm, 2 * mm, 18 * mm, stroke=0, fill=1)
    c.setFillColor(cream)
    c.rect(0, CARD_H - 8 * mm, CARD_W, 3 * mm, stroke=0, fill=1)

    # header
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 15)
    c.drawString(10 * mm, CARD_H - 18 * mm, settings.LIBRARY_NAME)
    c.setFont("Helvetica", 7)
    c.drawString(10 * mm, CARD_H - 23 * mm, "L I B B O R O W   M E M B E R   C A R D")
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(CARD_W - 12 * mm, CARD_H - 18 * mm, profile.role)

    # member block
    c.setFont("Helvetica-Bold", 13)
    c.drawString(10 * mm, 30 * mm, display_name(user))
    c.setFont("Courier-Bold", 10)
    c.drawString(10 * mm, 24 * mm, profile.student_or_staff_id)
    c.setFont("Courier", 7.5)
    c.drawString(10 * mm, 18 * mm, f"MEMBER SINCE {profile.membership_start_date:%Y-%m-%d}")
    c.drawString(10 * mm, 13 * mm,
                 f"LOANS {active_loan_count(user)}/{profile.max_borrow_limit}")

    # QR
    c.drawImage(ImageReader(qr_buf), CARD_W - 38 * mm, 8 * mm, 26 * mm, 26 * mm)
    c.setFont("Courier", 6)
    c.drawCentredString(CARD_W - 25 * mm, 5 * mm, "STAFF SCAN-IN")

    c.showPage()
    c.save()
    return buf.getvalue()


def id_card_response(user: User) -> HttpResponse:
    pdf = build_id_card_pdf(user)
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="libborrow-id-{user.profile.student_or_staff_id}.pdf"'
    return resp
