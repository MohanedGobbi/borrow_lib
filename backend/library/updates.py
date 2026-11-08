"""The platform's version and the server's automatic updates, for the admin settings page.

deploy/auto-update.sh runs as root, nightly or on request, and writes its progress to UPDATE_STATUS_FILE.
The site cannot update itself: it only creates UPDATE_REQUEST_FILE, which the lib-borrow-update.path
systemd unit turns into a run of that script. Neither exists outside a server installed with
`install.sh --auto-update`, and then the page says updates are not set up.
"""
import json
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .errors import BusinessRuleError

ROOT = Path(settings.BASE_DIR).parent
STATES = {"checking", "up_to_date", "downloading", "installing", "updated", "failed", "skipped", "error"}


def installed_version() -> str:
    """From RELEASE (written into server packages by scripts/make_release.py), else package.json."""
    try:
        for line in (ROOT / "RELEASE").read_text(encoding="utf-8").splitlines():
            if line.startswith("version="):
                return line.split("=", 1)[1].strip()
    except OSError:
        pass
    try:
        return str(json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"])
    except (OSError, ValueError, KeyError):
        return ""


def _request_file() -> Path | None:
    return Path(settings.UPDATE_REQUEST_FILE) if settings.UPDATE_REQUEST_FILE else None


def available() -> bool:
    """install.sh creates the request folder when it switches automatic updates on, and removes it when off."""
    request = _request_file()
    return bool(request and request.parent.is_dir()) and not settings.DEMO_MODE


def _report() -> dict:
    try:
        data = json.loads(Path(settings.UPDATE_STATUS_FILE).read_text(encoding="utf-8"))
    except (OSError, TypeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def status() -> dict:
    report = _report()
    request = _request_file()
    state = report.get("state") if report.get("state") in STATES else ""
    return {
        "version": installed_version(),
        "available": available(),
        "requested": bool(available() and request and request.exists()),
        "state": state,
        "latest": str(report.get("latest") or ""),
        "checkedAt": report.get("at") or None,
        "message": str(report.get("message") or "")[:300],
        "repo": str(report.get("repo") or ""),
    }


def request_update() -> None:
    if not available():
        raise BusinessRuleError("update_unavailable", "Automatic updates are not set up on this server.")
    request = _request_file()
    try:
        request.write_text(timezone.now().isoformat(), encoding="utf-8")
    except OSError as e:
        raise BusinessRuleError("update_unavailable", "The update request could not be saved.") from e
