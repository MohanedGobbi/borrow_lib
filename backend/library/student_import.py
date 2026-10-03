"""Bulk import of student accounts (docs/rework/F3.md): POST /api/users/import and `manage.py import_students`.

Same shape and rules as the book import (importing.py), for the library's yearly enrolment list:

- Headers are matched against English, French and Arabic aliases; unknown columns are ignored.
- Rows with errors are reported and skipped; a row whose email already has an account is `exists` and
  skipped without being an error. Valid rows are saved in one transaction.
- `dry_run` validates and reports without writing (the preview).
- Each new student gets a MEMBER account with no usable password and an unverified email, and, after
  the commit, one welcome email with a link to choose a password (emails.send_welcome_batch).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction

from . import emails
from .importing import MAX_ROWS, ImportError_, _key, _text
from .models import Language, Role, UserProfile, log_activity

ERROR_TEXT = {
    "name_missing": "Name is missing.",
    "name_too_long": "Name is too long (150 characters at most for each part).",
    "email_missing": "Email is missing.",
    "email_invalid": "Email is not valid.",
    "email_duplicate": "Same email as row {row}.",
    "student_id_missing": "Student ID is missing.",
    "student_id_too_long": "Student ID is longer than 30 characters.",
    "student_id_duplicate": "Same student ID as row {row}.",
    "student_id_taken": "This student ID belongs to another account.",
    "phone_invalid": "Phone number is longer than 40 characters.",
    "language_invalid": "Language must be en, fr or ar.",
}


def error_text(error: dict) -> str:
    """English wording for an error code (used by the management command)."""
    return ERROR_TEXT[error["code"]].format(**error)


FIELDS = ["name", "firstName", "lastName", "email", "studentId", "phone", "language"]

_ALIASES = {
    "name": ["name", "full name", "fullname", "student name", "student", "nom", "nom complet", "nom et prenom",
             "nom prenom", "etudiant", "الاسم", "الاسم الكامل", "اسم الطالب"],
    "firstName": ["first name", "firstname", "given name", "forename", "prenom", "الاسم الاول", "الاسم الأول"],
    "lastName": ["last name", "lastname", "surname", "family name", "nom de famille", "اللقب", "اسم العائلة"],
    "email": ["email", "e mail", "email address", "mail", "courriel", "adresse email", "adresse e mail",
              "adresse mail", "البريد", "البريد الالكتروني", "البريد الإلكتروني"],
    "studentId": ["student id", "studentid", "id", "student number", "student no", "member id", "matricule",
                  "numero etudiant", "numero d etudiant", "n etudiant", "code etudiant", "الرقم الجامعي",
                  "رقم الطالب", "رقم التسجيل", "رقم الطالب الجامعي"],
    "phone": ["phone", "phone number", "telephone", "tel", "mobile", "portable", "الهاتف", "رقم الهاتف"],
    "language": ["language", "lang", "langue", "اللغة"],
}
_LOOKUP = {_key(alias): name for name, aliases in _ALIASES.items() for alias in aliases}

_LANGUAGES = {
    "en": "en", "english": "en", "anglais": "en", "الانجليزية": "en", "الإنجليزية": "en",
    "fr": "fr", "french": "fr", "francais": "fr", "français": "fr", "الفرنسية": "fr",
    "ar": "ar", "arabic": "ar", "arabe": "ar", "العربية": "ar",
}
DEFAULT_LANGUAGE = Language.EN  # as UserProfile


def map_columns(headers) -> dict[str, str | None]:
    return {h: _LOOKUP.get(_key(h)) for h in headers}


@dataclass
class RowResult:
    row: int
    status: str  # create | exists | error
    name: str = ""
    email: str = ""
    studentId: str = ""
    language: str = ""
    errors: list[dict] = field(default_factory=list)


def _summary(results: list[RowResult]) -> dict:
    counts = {s: 0 for s in ("create", "exists", "error")}
    for r in results:
        counts[r.status] += 1
    return {"total": len(results), **counts}


def run_student_import(rows: list[dict], *, dry_run: bool = True, actor_name: str = "System",
                       source: str = "") -> dict:
    """Validate (and unless dry_run, apply) an import. `rows` are dicts keyed by raw headers."""
    if len(rows) > MAX_ROWS:
        raise ImportError_("import_too_many_rows", f"A single import is limited to {MAX_ROWS} rows; split the file.",
                           max=MAX_ROWS)

    headers = list(dict.fromkeys(h for r in rows for h in r.keys() if not str(h).startswith("__")))
    columns = map_columns(headers)
    mapped = set(columns.values())
    missing = [f for f, ok in (("name", bool(mapped & {"name", "firstName", "lastName"})),
                               ("email", "email" in mapped), ("studentId", "studentId" in mapped)) if not ok]
    if rows and missing:
        return {"dryRun": dry_run, "columns": columns, "missingColumns": missing, "rows": [],
                "summary": _summary([]), "emailsSent": 0}

    existing_emails = {e.lower() for e in User.objects.exclude(email="").values_list("email", flat=True)}
    existing_emails |= {u.lower() for u in User.objects.values_list("username", flat=True)}
    taken_ids = set(UserProfile.objects.values_list("student_or_staff_id", flat=True))
    seen_emails: dict[str, int] = {}
    seen_ids: dict[str, int] = {}
    results: list[RowResult] = []
    plans: list[tuple[RowResult, dict]] = []

    for index, raw in enumerate(rows):
        data = {f: None for f in FIELDS}
        for header, value in raw.items():
            name = columns.get(header)
            if name and data[name] in (None, ""):
                data[name] = value
        row_no = raw.get("__row") or index + 1

        # blank lines in a spreadsheet are ignored, not reported
        if not any(_text(v) for v in data.values()):
            continue

        first, last = _text(data["firstName"]), _text(data["lastName"])
        if first and not last:
            last = _text(data["name"])  # "Nom" next to "Prénom" is the family name, not the full name
        elif not first and not last:
            first, _, last = _text(data["name"]).partition(" ")
            last = last.strip()
        email = _text(data["email"]).lower()
        student_id = _text(data["studentId"])
        phone = _text(data["phone"])
        lang_text = _text(data["language"])
        res = RowResult(row=row_no, status="error", name=f"{first} {last}".strip(), email=email,
                        studentId=student_id)

        if not first and not last:
            res.errors.append({"code": "name_missing"})
        elif len(first) > 150 or len(last) > 150:
            res.errors.append({"code": "name_too_long"})

        email_ok = False
        if not email:
            res.errors.append({"code": "email_missing"})
        else:
            try:
                validate_email(email)
                email_ok = len(email) <= 150  # the email is the username
            except ValidationError:
                pass
            if not email_ok:
                res.errors.append({"code": "email_invalid"})
        if email_ok:
            if email in seen_emails:
                res.errors.append({"code": "email_duplicate", "row": seen_emails[email]})
            seen_emails.setdefault(email, row_no)

        if not student_id:
            res.errors.append({"code": "student_id_missing"})
        elif len(student_id) > 30:
            res.errors.append({"code": "student_id_too_long"})
        else:
            if student_id.lower() in seen_ids:
                res.errors.append({"code": "student_id_duplicate", "row": seen_ids[student_id.lower()]})
            seen_ids.setdefault(student_id.lower(), row_no)

        if len(phone) > 40:
            res.errors.append({"code": "phone_invalid"})

        if not lang_text:
            language = DEFAULT_LANGUAGE.value
        else:
            language = _LANGUAGES.get(lang_text.lower())
            if language is None:
                res.errors.append({"code": "language_invalid"})
        res.language = language or lang_text

        if not res.errors and email in existing_emails:
            res.status = "exists"  # already has an account: left alone, not an error
        elif not res.errors and student_id in taken_ids:
            res.errors.append({"code": "student_id_taken"})
        if res.errors:
            results.append(res)
            continue
        if res.status != "exists":
            res.status = "create"
            plans.append((res, {"first_name": first, "last_name": last, "email": email, "student_id": student_id,
                                "phone": phone, "language": language}))
        results.append(res)

    sent = 0
    if not dry_run and plans:
        created: list[User] = []
        with transaction.atomic():
            for res, v in plans:
                try:
                    with transaction.atomic():  # a savepoint: an account made since the preview only fails its own row
                        user = User.objects.create_user(username=v["email"], email=v["email"],
                                                        first_name=v["first_name"], last_name=v["last_name"])
                        user.set_unusable_password()
                        user.save(update_fields=["password"])
                        UserProfile.objects.create(user=user, student_or_staff_id=v["student_id"],
                                                   phone_number=v["phone"], role=Role.MEMBER,
                                                   language=v["language"], email_verified=False)
                except IntegrityError:
                    exists = User.objects.filter(username=v["email"]).exists()
                    res.status = "exists" if exists else "error"
                    if not exists:
                        res.errors.append({"code": "student_id_taken"})
                    continue
                created.append(user)
            where = f" from {source}" if source else ""
            skipped = sum(1 for r in results if r.status == "exists")
            log_activity(actor_name, "STUDENTS_IMPORTED",
                         f"Imported {len(created)} students{where} ({skipped} already had an account).",
                         created=len(created), existing=skipped, source=source)
        # After the commit: a mail outage cannot undo the accounts, and a student can always use "Forgot password?".
        sent = emails.send_welcome_batch(created)

    return {
        "dryRun": dry_run,
        "columns": columns,
        "missingColumns": [],
        "rows": [r.__dict__ for r in results],
        "summary": _summary(results),
        "emailsSent": sent,
    }
