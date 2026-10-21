# مكتبة كلية الحقوق والعلوم السياسية — Library Borrowing Platform

A full-stack library management system: members browse the catalog and request books;
staff approve requests, confirm pickups and returns on a live operations dashboard.
Built for the library of the Faculty of Law and Political Sciences, University of Ghardaia: a serious, trilingual (French / Arabic / English)
interface in green, white and red. Design system: `DESIGN.md`.

- **Backend:** Django 6 + Django REST Framework + JWT (SimpleJWT), SQLite dev database
  (PostgreSQL-ready), ReportLab + QR digital ID cards, cron-ready management commands.
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui.


## The spine of the system

A loan does **not** start at approval. It starts only when the member physically picks
up the book and staff confirm it. If pickup does not happen within **48 hours** of
approval, the request auto-cancels and the reservation queue hands the slot to the next
member with a fresh 48-hour window. Loans run **14 days from pickup**.

```
PENDING --(staff approves)--> READY --(staff confirms pickup)--> BORROWED --(staff confirms return)--> RETURNED
PENDING --(staff rejects)--> REJECTED
READY --(48h deadline passes)--> CANCELLED --(queue non-empty)--> new READY for next member
BORROWED --(past due date)--> OVERDUE   (blocks new requests until resolved)
```

`available_copies` changes at exactly two moments: **pickup (−1)** and **return (+1)**.
A copy waiting on the hold shelf (a `READY` record) is not free: **free copies** =
`available_copies` minus the book's `READY` records.

- A returned copy serves the reservation queue first: the first active member in the queue
  gets a `READY` hold with a fresh 48-hour window (members deactivated in the meantime are skipped).
- Staff can approve a request only while the book has a free copy; new requests and queue
  joins follow the same count, so a held copy cannot be taken by someone else.
- Deactivating a member blocks sign-in (login, access and refresh tokens) and any new request or reservation.

## Accounts and sign-in

Everyone signs in with **email and password**. Account types:

| Type | Arabic | Role | Can |
|---|---|---|---|
| Student | طالب | MEMBER | borrow, waiting lists, library card |
| Professor | أستاذ | MEMBER | the same |
| Administrative staff | إداري مسير | MEMBER | the same |
| External reader | خارجي | MEMBER | the same |
| Librarian | مكتبي | STAFF | the staff desk: approvals, pickups, returns, inventory, notifications |
| Administrator | موظف مسؤول | ADMIN | everything: create accounts of any type (other admins included), library rules, maintenance |

- **Sign-up** (`/signup`) asks for full name, email, phone number, password and the reader type. New
  readers confirm their email before borrowing. Every account gets a library card number (`GH-000123`).
- **Admins** create accounts of any type from Staff desk → Readers → Create account (with a password to hand
  over, or without one so the person gets an email to choose it), change an account's type and deactivate it.
- **The first administrator** comes from the command line:
  `python manage.py create_admin --email … --name "…" --phone …` (asks for the password).

## The catalogue

`backend/library/data/inventory.csv` is the library's inventory (جرد المكتبة): 4,487 titles, 19,243
copies, with call number, title, author and number of copies. Load it with `python manage.py load_inventory`
(safe to repeat) or from Settings → Data and maintenance → Reload the catalogue. Categories come from the
Dewey class of the call number (320 political science, 341 international law, 345 criminal law, …; see
`backend/library/catalogue.py`). Books need no ISBN: without one, the call number and the title identify a book.

## Notifications

Readers choose in their profile which in-app notifications they get (requests, waiting lists, loans,
overdue, library announcements) and which emails (ready for pickup, due soon, overdue). Staff send
announcements from Staff desk → Readers → Send a notification, to whole account types and/or chosen people.

## Maintenance (admins, Settings)

Download a backup (one JSON file: accounts, catalogue, circulation, settings, activity), restore one, reload
the catalogue from the inventory, run the scheduled checks, reset circulation, clear the activity log, delete
all reader accounts or the whole catalogue. Everything that changes data asks for the admin's password again.
Uploaded covers and photographs are not in the backup; keep the media folder backed up separately.

## Run locally

**Backend** (port 8000):

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate        # Windows; source .venv/bin/activate on Unix
pip install -r requirements.txt
python manage.py migrate
python manage.py load_inventory                        # the library's catalogue
python manage.py create_admin --email you@univ-ghardaia.dz --name "Your Name"
python manage.py runserver 8000
```

**Frontend** (port 3000, proxies `/api` → 8000):

```bash
npm install
npm run dev
```

**Accounts:** see *Accounts and sign-in* above.

**Background jobs** (idempotent; wire to cron/Celery Beat in production):

```bash
python manage.py cancel_expired_pickups   # hourly
python manage.py mark_overdue             # nightly
python manage.py send_reminders           # daily, in the morning
```

`send_reminders` emails members about loans due soon (and retries failed overdue emails); the
"ready for pickup" and "overdue" emails go out when those events happen. Members can switch the
emails off in their profile; in-app notifications always stay on. Staff can also trigger all
three on demand from the staff desk ("Run scheduled checks" → `POST /api/jobs/run`).

**Tests:** `cd backend && python manage.py test library` runs the backend suite (state machine, stock rules, queue handoff, jobs, permissions, auth, account types, imports and exports, maintenance, PDFs).

## Hosting

See `DEPLOYMENT.md` for a production checklist (env vars, Postgres, static build,
cron schedule). Short version: serve `dist/` from any static host, run Django via
gunicorn/uvicorn behind a reverse proxy, set `DJANGO_SECRET_KEY`, `FRONTEND_URL`,
`CORS_ALLOWED_ORIGINS`, and schedule the two management commands.

## Feature map

| Area | Where |
|---|---|
| Borrow state machine | `backend/library/services.py` (explicit transition table) |
| Role permissions (403s) | `backend/library/permissions.py` + per-view guards; only MEMBER accounts can borrow/reserve |
| Categories (staff-managed, colored) | `backend/library/models.py Category` + `/api/categories` CRUD |
| Bulk book import (Excel / CSV / JSON) | Staff desk → Inventory → Import books (`src/pages/staff/ImportBooksPage.tsx`) → `POST /api/books/import` (dry-run preview, then import); `python manage.py import_books file.xlsx [--update] [--dry-run]`; rules in `backend/library/importing.py` |
| Book cover uploads | `Book.cover_image` → `/media/covers/`; staff editor in the UI |
| Request receipts (REQ-xxx PDF) | `backend/library/documents.py` → `GET /api/borrow-records/<id>/document` (owner or staff) |
| Background jobs | `backend/library/management/commands/` + `services.run_hourly_cancellation / run_nightly_overdue / run_daily_reminders` |
| ID card PDF + QR | `backend/library/idcard.py` → `GET /api/users/me/id-card` |
| Staff QR scan lookup | `GET /api/users/<uuid>/scan` → `/scan/:uuid` page |
| User management | `/api/users` list/detail, admin-only `POST /api/users` (create), `PATCH /api/users/<id>/role` (account type), `/active`, `DELETE /api/users/<id>/delete` |
| Analytics | `GET /api/analytics` → charts page (recharts) |
| API surface | `backend/library/urls.py` |
| Tests | `backend/library/test_*.py` and `tests.py` |
| Landing page | `src/pages/LandingPage.tsx` (both seals, the faculty building, catalogue search, sign in) |
| Login / signup | `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx` — staff accounts come from admins (create account or invite) |
| Maintenance | `backend/library/maintenance.py` → `/api/maintenance/*`; `src/components/MaintenanceSection.tsx` |
| Notification choices and announcements | `UserProfile.notification_prefs`, `models.notify`; `POST /api/notifications/send`; `src/components/NotificationSettings.tsx`, `SendNotificationDialog.tsx` |
| i18n (EN / FR / AR with RTL) | `src/i18n/index.tsx` + header switcher |
| Request list | `src/cart/CartContext.tsx` + `/cart` page (students send several requests at once) |
| Staff desk (sidebar, live queue counts) | `src/pages/staff/` — Overview · Approvals · Pickups · Loans · Inventory · Waiting lists · Members · Analytics · Activity log |
| Mobile layout | responsive grids + hamburger sheet menu (works RTL too) |

## Design system

A standard university-portal look, executed with care: white pages, one deep university green (`#0E6B3C`)
for primary actions, red (`#B42318`) only for overdue, rejection and destructive actions. Source Serif 4
(Noto Naskh Arabic) for headlines and the wordmark, Public Sans (Noto Sans Arabic) for the interface,
hairline borders, the faculty's own photographs (admins can replace them), and the seals of the University
of Ghardaia and of the Faculty of Law and Political Sciences beside the library's name. Arabic is the default language. Tokens: `tailwind.config.js` and `src/index.css`; full spec in `DESIGN.md`.
