"""The faculty library's own catalogue: subject categories from the call number, and the bundled inventory.

Call numbers follow the Dewey classes the library shelves by (320.2, 349.4.105, …): the first three digits
name the subject. `data/inventory.csv` is the library's inventory (جرد المكتبة), one row per title.
"""
from __future__ import annotations

import csv
from pathlib import Path

INVENTORY_FILE = Path(__file__).resolve().parent / "data" / "inventory.csv"

# Dewey class (first three digits of the call number) → (category name, colour).
SUBJECTS = {
    "320": ("العلوم السياسية", "#2B3F52"),
    "340": ("المدخل إلى القانون وفلسفته", "#4A4E45"),
    "341": ("القانون الدولي", "#29463F"),
    "342": ("القانون الدستوري والإداري", "#1F4D3A"),
    "343": ("القانون الاقتصادي والمالي", "#5C4630"),
    "344": ("قانون العمل والضمان الاجتماعي", "#6E2A2A"),
    "345": ("القانون الجنائي", "#6E2A2A"),
    "346": ("القانون الخاص والأسرة", "#1F4D3A"),
    "347": ("الإجراءات والتنظيم القضائي", "#2B3F52"),
    "348": ("القضاء والتشريعات", "#4A4E45"),
    "349": ("دراسات قانونية متخصصة", "#5C4630"),
}
GENERAL = ("عام", "#4A5560")


def subject_of(call_number: str) -> tuple[str, str]:
    """(category name, colour) for a call number; the general shelf when the class is unknown."""
    return SUBJECTS.get(str(call_number or "").strip()[:3], GENERAL)


def inventory_rows() -> list[dict]:
    """The bundled inventory as import rows (the same shape as an uploaded spreadsheet)."""
    with INVENTORY_FILE.open(encoding="utf-8", newline="") as f:
        return [{"shelfLocation": r["call_number"], "title": r["title"], "author": r["author"],
                 "totalCopies": r["copies"], "__row": i}
                for i, r in enumerate(csv.DictReader(f), start=2)]
