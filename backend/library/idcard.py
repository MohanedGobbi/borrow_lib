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

    ink = HexColor("#121A16")
    green = HexColor("#0E6B3C")
    muted = HexColor("#5B6660")
    border = HexColor("#DCE2DE")

    # white card, green header band and foot rule (matches the on-screen card)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setStrokeColor(border)
    c.rect(0, 0, CARD_W, CARD_H, stroke=1, fill=1)
    c.setFillColor(green)
    c.rect(0, CARD_H - 15 * mm, CARD_W, 15 * mm, stroke=0, fill=1)
    c.setFillColor(green)
    c.rect(0, 0, CARD_W, 2 * mm, stroke=0, fill=1)

    # header
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(6 * mm, CARD_H - 7.5 * mm, settings.LIBRARY_NAME)
    c.setFont("Helvetica", 7)
    c.drawString(6 * mm, CARD_H - 11.5 * mm, "LibBorrow library card")
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(CARD_W - 6 * mm, CARD_H - 9 * mm, profile.role.title())

    # member block
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(6 * mm, 30 * mm, display_name(user))
    c.setFont("Courier-Bold", 10)
    c.drawString(6 * mm, 24 * mm, profile.student_or_staff_id)
    c.setFillColor(muted)
    c.setFont("Helvetica", 7.5)
    c.drawString(6 * mm, 16 * mm, f"Member since {profile.membership_start_date:%d %b %Y}")
    c.drawString(6 * mm, 11 * mm, f"Loans {active_loan_count(user)} / {profile.max_borrow_limit}")

    # QR
    c.drawImage(ImageReader(qr_buf), CARD_W - 30 * mm, 6 * mm, 24 * mm, 24 * mm)

    c.showPage()
    c.save()
    return buf.getvalue()


def id_card_response(user: User) -> HttpResponse:
    pdf = build_id_card_pdf(user)
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="libborrow-id-{user.profile.student_or_staff_id}.pdf"'
    return resp
