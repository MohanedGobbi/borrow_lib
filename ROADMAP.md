# Roadmap to delivery

Status as of September 2026. Groups 1 and 2 are done; the rest is ordered by priority.

## 1. Must-do before delivery — done

- All work committed and pushed; Vercel redeploys the demo from `main`.
- Backend runs again (fresh venv), all backend tests pass (33 after the import work), including the book-copies endpoint, PDFs and password rules.
- Production-safe settings: the server refuses to start without a real secret key, host list and staff invite code; HTTPS redirect, secure cookies and HSTS in production; stronger password rules at registration.
- Exact dependency versions in `backend/requirements.txt` (gunicorn included for Linux hosts).
- GitHub Actions CI (`.github/workflows/ci.yml`): lint, both frontend builds, Django checks, missing-migration check, tests, `check --deploy`.

## 2. Bulk import of the library's books — done

A librarian loads the existing collection from an Excel sheet, a CSV export or a JSON file instead of typing each book.

- **Where:** Staff desk → Inventory → **Import books**. Drop a file, review the preview, choose whether books already in the catalogue (same ISBN) are left alone or updated, then import. A CSV template and a JSON example can be downloaded from the same screen.
- **Columns:** `isbn`, `title`, `author` are required; `category`, `publisher`, `year`, `total_copies`, `shelf_location`, `description` are optional. Headers are recognized in English, French or Arabic (`titre`, `auteur`, `cote`, `exemplaires`, `العنوان`…); other columns are ignored and listed.
- **Checks, per row, in plain language (FR / AR / EN):** missing ISBN, title or author; ISBN with a wrong check digit; the same ISBN twice in the file; a year that isn't a year; copies outside 1–1,000 or below the copies currently on loan. Hyphenated and plain ISBNs, and ISBNs Excel stored as numbers, all match.
- **Saving:** nothing is written during the preview. Valid rows are saved in one transaction; rows with errors are skipped and can be downloaded as a CSV to fix and re-import. New categories are created; available copies are recalculated from loans; one activity-log entry records who imported what from which file.
- **Limits:** 5,000 rows per file.
- **Command line** for the first big load: `python manage.py import_books catalogue.xlsx [--update] [--dry-run]`.
- **Code:** rules in `backend/library/importing.py` (mirrored in `src/api/demo.ts` so it works on the Vercel demo), `POST /api/books/import`, screen in `src/pages/staff/ImportBooksPage.tsx`; 6 backend tests.

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
