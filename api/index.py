"""Vercel entry point: the whole Django API as one Python function.

vercel.json sends every /api/* request here (Django sees the original path) and bundles backend/
with it. The library's own server does not use this file; it runs gunicorn (deploy/).
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from config.wsgi import application  # noqa: E402

# Only the demo migrates itself; the library's own server migrates when its administrator updates it.
if os.environ.get("DEMO_MODE") == "1":
    try:
        from library.demo import ensure_migrated
        ensure_migrated()
    except Exception as exc:  # a racing cold start, or the database waking up: the next start retries
        print(f"demo: could not check migrations: {exc!r}", file=sys.stderr)

app = application
