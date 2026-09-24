# Roadmap to delivery

Status as of September 2026. Group 1 is done; the rest is ordered by priority.

## 1. Must-do before delivery — done

- All work committed and pushed; Vercel redeploys the demo from `main`.
- Backend runs again (fresh venv), 27 tests pass, including the book-copies endpoint, PDFs and password rules.
- Production-safe settings: the server refuses to start without a real secret key, host list and staff invite code; HTTPS redirect, secure cookies and HSTS in production; stronger password rules at registration.
- Exact dependency versions in `backend/requirements.txt` (gunicorn included for Linux hosts).
- GitHub Actions CI (`.github/workflows/ci.yml`): lint, both frontend builds, Django checks, missing-migration check, tests, `check --deploy`.

## 2. Bulk import of the library's books (new, ~2 days)

Goal: a librarian loads the existing collection (hundreds or thousands of books) from an Excel sheet, a CSV export or a JSON file, instead of typing each book.

**File formats and columns**
- `.xlsx`, `.csv` and `.json` (an array of objects), all with the same fields:
  `isbn` (required, used to match existing books), `title` (required), `author` (required), `category`, `publisher`, `year`, `total_copies` (default 1), `shelf_location`, `description`.
- Column headers are accepted in English or French (e.g. `titre`, `auteur`, `cote`, `exemplaires`); unknown columns are ignored.
- A downloadable template (`.xlsx` and `.csv`) with the headers and two example rows, linked from the import screen.

**Staff desk → Inventory → "Import books"**
1. **Upload:** drop a file. It is read in the browser (Excel via SheetJS), so nothing is saved until the librarian confirms.
2. **Preview:** a table of every row, marked *new*, *updates an existing book* (same ISBN) or *error*, with the reason in plain language (missing title, invalid ISBN, duplicate ISBN in the file, year not a number, copies below the number currently on loan). Unknown categories are listed and created on import.
3. **Choose:** skip or update books that already exist.
4. **Import:** one request; a summary shows created / updated / skipped / failed, with a downloadable report of failed rows to fix and re-upload.

**Backend**
- `POST /api/books/import` (staff only): takes the parsed rows, a mode (`skip` / `update`) and `dry_run`. It validates each row with the same rules as the book form, runs in one database transaction (all or nothing), caps a single upload at 5,000 rows, and writes one activity-log entry ("Imported 1,240 books from catalogue-2026.xlsx").
- ISBNs are normalized (hyphens and spaces stripped, ISBN-10/13 checksums verified).
- Updating copies never drops `total_copies` below the copies on loan; available copies are recalculated from loans.
- A management command, `python manage.py import_books catalogue.xlsx [--update] [--dry-run]`, for the first big load done by IT, with the same validation.
- Same endpoint in the in-browser demo API (`src/api/demo.ts`), so the feature can be shown on Vercel.
- Tests: valid file, mixed errors, duplicate ISBNs, update mode, the copies-on-loan rule, the permission check, and dry run changing nothing.

Later, if useful: export the catalogue to Excel from the same screen, and bulk-import students from the registrar's list.

## 3. Robustness

- Rate-limit sign-in and registration (DRF throttling).
- Ship the scheduled jobs ready to run (cron file or a scheduler container), not only documented.
- Store cover uploads in object storage (S3-compatible); local disk is wiped on most hosts' redeploys.
- Concurrency and edge cases: two staff confirming the last copy at once, one timezone for all due dates.
- Error monitoring (Sentry or similar).

## 4. Quality and trust

- End-to-end browser tests (Playwright): request → approve → pickup → return, the overdue block, the waiting-list handoff, Arabic layout.
- Lazy-load the staff pages and charts; the main bundle is about 980 KB.
- Accessibility pass (axe, keyboard-only, screen reader), especially dialogs and staff tables.
- Native-speaker review of the French and Arabic text.

## 5. Hand-over

- One-page admin guide: setup, environment variables, first admin account, backups, changing the 48-hour and 14-day rules.
- Replace demo data with the real catalogue (via the import above), the university's name and logo.
- Smaller improvements: catalog sort control, `/` to focus search, staff actions from the member lookup page.
