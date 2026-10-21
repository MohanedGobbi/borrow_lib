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
