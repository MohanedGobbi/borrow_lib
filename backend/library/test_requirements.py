"""The two dependency lists (the server's and Vercel's) pin the same versions."""
from pathlib import Path

from django.test import SimpleTestCase

ROOT = Path(__file__).resolve().parents[2]


def pins(path: Path) -> set[str]:
    lines = (line.split("#")[0].strip() for line in path.read_text(encoding="utf-8").splitlines())
    return {line for line in lines if line}


class RequirementsTests(SimpleTestCase):
    def test_vercel_list_matches_the_backend_list_except_gunicorn(self):
        backend = {p for p in pins(ROOT / "backend" / "requirements.txt") if not p.startswith("gunicorn")}
        self.assertEqual(pins(ROOT / "requirements.txt"), backend)
