"""Text in the PDFs, Arabic included.

ReportLab draws glyphs one by one, left to right, with no shaping. Arabic text therefore goes through
arabic_reshaper (each letter becomes its joined form) and python-bidi (the line is put in display order),
and is set in Noto Naskh Arabic. That font has no Latin letters, so a line is split into runs: Arabic letters,
digits and spaces in Noto Naskh, everything else in Helvetica. Text without Arabic is drawn as before.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_DIR = Path(__file__).resolve().parent / "assets" / "fonts"
ARABIC = {False: "NotoNaskhArabic", True: "NotoNaskhArabic-Bold"}
LATIN = {False: "Helvetica", True: "Helvetica-Bold"}


@lru_cache(maxsize=1)
def _arabic_glyphs() -> frozenset[int]:
    """Register the Arabic fonts (once) and return the characters they can draw."""
    for bold, name in ARABIC.items():
        file = "NotoNaskhArabic-Bold.ttf" if bold else "NotoNaskhArabic-Regular.ttf"
        pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
    return frozenset(pdfmetrics.getFont(ARABIC[False]).face.charToGlyph)


def is_arabic(ch: str) -> bool:
    o = ord(ch)
    return 0x0600 <= o <= 0x06FF or 0x0750 <= o <= 0x077F or 0xFB50 <= o <= 0xFDFF or 0xFE70 <= o <= 0xFEFF


def has_arabic(text: str) -> bool:
    return any(is_arabic(ch) for ch in text)


def _runs(text: str, bold: bool) -> list[tuple[str, str]]:
    """(font, text) runs in display order, left to right."""
    if not has_arabic(text):
        return [(LATIN[bold], text)]
    glyphs = _arabic_glyphs()
    visual = get_display(arabic_reshaper.reshape(text))
    runs: list[tuple[str, str]] = []
    for ch in visual:
        # Letters decide the font; spaces, digits and marks the Arabic font has follow the run they sit in.
        arabic_font = is_arabic(ch) or (ord(ch) in glyphs and not ch.isalpha() and runs and runs[-1][0] == ARABIC[bold])
        font = ARABIC[bold] if arabic_font else LATIN[bold]
        if runs and runs[-1][0] == font:
            runs[-1] = (font, runs[-1][1] + ch)
        else:
            runs.append((font, ch))
    return runs


def text_width(text: str, size: float, bold: bool = False) -> float:
    return sum(pdfmetrics.stringWidth(t, font, size) for font, t in _runs(text, bold))


def draw(c, x: float, y: float, text: str, size: float, bold: bool = False, align: str = "left") -> None:
    """Draw `text` at (x, y): `align` says whether x is the left edge, the right edge or the centre."""
    text = str(text)
    runs = _runs(text, bold)
    width = sum(pdfmetrics.stringWidth(t, font, size) for font, t in runs)
    if align == "right":
        x -= width
    elif align == "center":
        x -= width / 2
    for font, t in runs:
        c.setFont(font, size)
        c.drawString(x, y, t)
        x += pdfmetrics.stringWidth(t, font, size)


def fit(text: str, max_width: float, size: float, bold: bool = False) -> str:
    """`text`, shortened with an ellipsis (in reading order) until it fits in `max_width`."""
    text = str(text)
    if text_width(text, size, bold) <= max_width:
        return text
    while text and text_width(text + "…", size, bold) > max_width:
        text = text[:-1]
    return text.rstrip() + "…"
