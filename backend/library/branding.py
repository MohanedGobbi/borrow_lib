"""The University of Ghardaia and Faculty of Law seals in the PDFs.

The seal keeps its official colours: draw it on white or light grey only, never on a green or red fill,
never recoloured, outlined, shadowed, stretched or cropped. Its source is 160px wide, so keep it small
(16-18 mm on A4 or a card prints at about 230-250 dpi).
"""
from pathlib import Path

from reportlab.lib.units import mm

SEAL_PATH = Path(__file__).resolve().parent / "assets" / "ghardaia-seal.png"
SEAL_ASPECT = 157 / 148  # width / height of the artwork
FACULTY_SEAL_PATH = Path(__file__).resolve().parent / "assets" / "faculty-seal.png"  # round, 444px square


def draw_seal(c, x: float, y: float, height: float = 17 * mm) -> float:
    """Draw the seal with its bottom-left corner at (x, y). Returns the width drawn, in points."""
    width = height * SEAL_ASPECT
    c.drawImage(str(SEAL_PATH), x, y, width=width, height=height, mask="auto")
    return width


def draw_faculty_seal(c, x: float, y: float, height: float = 17 * mm) -> float:
    """The Faculty of Law and Political Sciences seal, same rules as the university's. Returns its width."""
    c.drawImage(str(FACULTY_SEAL_PATH), x, y, width=height, height=height, mask="auto")
    return height


# The platform's makers, credited in the fine print of every printable.
ROWD_PATH = Path(__file__).resolve().parent / "assets" / "rowd.png"
ROWD_ASPECT = 740 / 170
AFAK_PATH = Path(__file__).resolve().parent / "assets" / "afak.png"
AFAK_ASPECT = 977 / 222
CREDIT_TEXT = "تطوير ROWD Tech · بالشراكة مع مؤسسة آفاق · Developed by ROWD Tech in partnership with AFAK"


def draw_partner_credit(c, x: float, y: float, size: float = 6.5, logo_h: float = 4 * mm, align: str = "center") -> None:
    """ROWD Tech's logo, the credit line and AFAK's logo on one line; y is the text baseline.
    With align="center", x is the middle of the line; with "left", its start."""
    from . import pdftext
    gap = 1.6 * mm
    rowd_w, afak_w = logo_h * ROWD_ASPECT * 0.55, logo_h * 1.25 * AFAK_ASPECT
    text_w = pdftext.text_width(CREDIT_TEXT, size)
    start = x - (rowd_w + text_w + afak_w + 2 * gap) / 2 if align == "center" else x
    c.drawImage(str(ROWD_PATH), start, y - logo_h * 0.18, width=rowd_w, height=rowd_w / ROWD_ASPECT, mask="auto")
    pdftext.draw(c, start + rowd_w + gap, y, CREDIT_TEXT, size)
    afak_h = logo_h * 1.25
    c.drawImage(str(AFAK_PATH), start + rowd_w + text_w + 2 * gap, y - afak_h * 0.3, width=afak_w, height=afak_h, mask="auto")
