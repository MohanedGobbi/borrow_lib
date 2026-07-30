# LibBorrow — Library Borrowing Platform

A full-stack library management system: members browse the catalog and request books;
staff approve requests, confirm pickups and returns on a live operations dashboard.
Built end-to-end to the spec in `library_platform_agent_prompt.md`, styled with the
**Impeccable** design system (`design/DESIGN.md`).

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

**Demo accounts** (password `password123`): `admin@libborrow.dev` ·
`staff@libborrow.dev` · `priya@example.com` (member). Staff self-registration uses
invite code `LIB-STAFF-2024` (env `STAFF_INVITE_CODE`).

**Background jobs** (idempotent; wire to cron/Celery Beat in production):

```bash
python manage.py cancel_expired_pickups   # hourly
python manage.py mark_overdue             # nightly
```

Staff can also trigger both on demand from the dashboard ("Run jobs now" →
`POST /api/jobs/run`).

**Tests:** `cd backend && python manage.py test library` — 21 tests covering every
state transition, invalid transitions, stock rules, queue handoff, job idempotency,
permission boundaries (incl. staff-cannot-borrow), receipt access rules, user
management, categories CRUD, analytics and an end-to-end flow.

**Staff entrance is hidden by design:** on the sign-in / sign-up pages, type the
Konami code (↑ ↑ ↓ ↓ ← → ← → B A) to reveal the staff section.

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
| Book cover uploads | `Book.cover_image` → `/media/covers/`; staff editor in the UI |
| Request receipts (REQ-xxx PDF) | `backend/library/documents.py` → `GET /api/borrow-records/<id>/document` (owner or staff) |
| Background jobs | `backend/library/management/commands/` + `services.run_hourly_cancellation / run_nightly_overdue` |
| ID card PDF + QR | `backend/library/idcard.py` → `GET /api/users/me/id-card` |
| Staff QR scan lookup | `GET /api/users/<uuid>/scan` → `/scan/:uuid` page |
| User management | `/api/users` list/detail, admin-only `DELETE /api/users/<id>/delete` |
| Analytics | `GET /api/analytics` → charts page (recharts) |
| API surface | `backend/library/urls.py` |
| Tests | `backend/library/tests.py` — 21 tests |
| Landing page | `src/pages/LandingPage.tsx` (animated hero, book marquee) |
| Login / signup (Konami-hidden staff) | `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx` — staff tab/section appears only after ↑↑↓↓←→←→ B A |
| i18n (EN / FR / AR with RTL) | `src/i18n/index.tsx` + header switcher |
| Borrowing cart | `src/cart/CartContext.tsx` + `/cart` page (members) |
| Category color theming | `src/hooks/useCategoryAccent.ts` — catalog follows the active category color |
| Staff area (one page per function) | `src/pages/staff/` — Overview · Approvals · Pickups · Loans · Inventory · Reservations · Users · Analytics · Activity |
| Mobile layout | responsive grids + hamburger sheet menu (works RTL too) |

## Design system

Impeccable — editorial-poster aesthetic: cream (`#FAF3E3`) / burnt-orange (`#C55221`)
bands, amber brand (`#CC8800`), Chakra Petch + JetBrains Mono, 4/8px radii, 4–32px
spacing. Tokens: `tailwind.config.js`, `src/index.css`, source spec at `design/DESIGN.md`.
