# LibBorrow — Library Borrowing Platform

A full-stack library management system: members browse the catalog and request books;
staff approve requests, confirm pickups and returns on a live operations dashboard.
Built for the University of Ghardaia library: a serious, trilingual (French / Arabic / English)
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

Every account below is created by the seed data (`python manage.py seed_demo`, or automatically in the
no-server demo) and uses the same password: **`password123`**.

| Role | Name | Email | Good for trying |
|---|---|---|---|
| Admin | Eleanor Vance | `admin@libborrow.dev` | Library rules, Site photos, invite staff, import students, everything staff can do |
| Staff | Marcus Holloway | `staff@libborrow.dev` | The desk: approvals, pickups, returns, desk search (press `/`) |
| Staff | Greta Weiss | `gweiss@libborrow.dev` | A second staff account |
| Student | Priya Sharma | `priya@example.com` | A ready hold, a loan, a pending request, a waiting list, the library card |
| Student (overdue) | Daniel Okafor | `daniel@example.com` | An overdue loan: requests and pickups are blocked until it is returned |
| Student (overdue) | Tomás Rivera | `tomas@example.com` | Another overdue loan |

More students, all `…@example.com` with the same password: `sofia`, `hana`, `youssef`, `amira`,
`lucas`, `ines`, `karim`, `lea`, `omar`, `sara`.

- **No-server demo** (the Vercel site, or `npm run dev:demo` then http://localhost:3000): the sign-in page
  has one-click buttons for the first accounts. Data lives in your browser; "Reset demo data" in the top
  bar starts over. Emails (password reset, verification, invites) appear at `/demo/mailbox`.
- **Real backend:** run `seed_demo` once, then sign in with the same accounts. In development, emails are
  printed to the Django server's console.
- **Real accounts:** students register at `/signup` and must verify their email before they can borrow.
  Staff and admins join through single-use invites (Staff desk → Members → Invite staff). The very first
  admin comes from `python manage.py createsuperuser`.

> **Never run `seed_demo` on a real server.** These accounts and their shared password are public. For a
> real deployment, create the first admin with `createsuperuser` and import the real catalogue and
> students instead (see `DEPLOYMENT.md`).

## Run locally

**Backend** (port 8000):

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate        # Windows; source .venv/bin/activate on Unix
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo                             # optional demo dataset
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

**Tests:** `cd backend && python manage.py test library` runs the backend suite (state machine, stock rules, queue handoff, jobs, permissions, auth, imports and exports, PDFs). `npm run e2e` runs the Playwright browser tests against both the demo API and a fresh Django.

**No-server demo:** `npm run dev:demo` (or the Vercel deployment) runs the whole API
in the browser from `src/api/demo.ts`, with one-click demo accounts on the sign-in page.

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
| User management | `/api/users` list/detail, admin-only `DELETE /api/users/<id>/delete` |
| Analytics | `GET /api/analytics` → charts page (recharts) |
| API surface | `backend/library/urls.py` |
| Tests | `backend/library/test_*.py` and `tests.py` (backend), `e2e/` (Playwright, demo API and real Django) |
| Landing page | `src/pages/LandingPage.tsx` (catalog search, borrowing rules, books on the shelf) |
| Login / signup | `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx` — staff accounts come from admin invites |
| i18n (EN / FR / AR with RTL) | `src/i18n/index.tsx` + header switcher |
| Request list | `src/cart/CartContext.tsx` + `/cart` page (students send several requests at once) |
| Staff desk (sidebar, live queue counts) | `src/pages/staff/` — Overview · Approvals · Pickups · Loans · Inventory · Waiting lists · Members · Analytics · Activity log |
| Mobile layout | responsive grids + hamburger sheet menu (works RTL too) |

## Design system

A standard university-portal look, executed with care: white pages, one deep university green (`#0E6B3C`)
for primary actions, red (`#B42318`) only for overdue, rejection and destructive actions. Source Serif 4
(Noto Naskh Arabic) for headlines and the wordmark, Public Sans (Noto Sans Arabic) for the interface,
hairline borders, black-and-white photography that admins can replace, and the University of Ghardaia seal
next to the wordmark. Tokens: `tailwind.config.js` and `src/index.css`; full spec in `DESIGN.md`.
