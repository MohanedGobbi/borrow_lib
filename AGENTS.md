# LibBorrow — Agent Guide

This file is for AI coding agents working on LibBorrow. It assumes you know nothing about the codebase.

## Project overview

LibBorrow is the borrowing system of a university library. Students browse the catalog and request books; library staff approve requests, confirm pickups and returns, manage inventory, and monitor loans from the staff desk. The UI is trilingual (French, Arabic with RTL, English).

It is a full-stack app:

- **Backend:** Django + Django REST Framework + SimpleJWT in `backend/` (SQLite in dev, PostgreSQL-ready). ReportLab generates receipt and library-card PDFs.
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 3 + shadcn/ui in `src/`.
- **Demo mode:** `npm run dev:demo` / `npm run build:demo` (Vite mode `demo`, `.env.demo` sets `VITE_DEMO=true`) swaps every API call for an in-browser port of the Django API in `src/api/demo.ts`, so the site runs with no server. The Vercel deployment uses this build.

Key business rules (enforced in `backend/library/services.py` and mirrored in `src/api/demo.ts`):

- A loan starts at **pickup**, not approval. `availableCopies` changes only at pickup (−1) and return (+1).
- **Free copies** = `availableCopies` minus the book's `READY` records (copies on the hold shelf). Staff can approve only while a book has a free copy; new requests and queue joins use the same count (`freeCopies` in the API, `free_copies()` in `services.py`).
- Approved requests are `READY` for **48 hours**. A missed pickup auto-cancels and the copy goes to the next student in the FIFO reservation queue with a fresh 48-hour window. A returned copy serves the queue the same way (`_hand_to_queue`), skipping deactivated members.
- Loans run **14 days from pickup**. An `OVERDUE` loan blocks the student from new requests until it is returned. It also blocks **picking up** an already-approved hold (`confirm_pickup` raises `pickup_blocked_overdue` with the title to return first); the hold keeps its deadline and can still expire to the queue. The desk shows the block on Confirm pickup, and students are stopped before a request that would fail (`useRequestGuard`).
- The 48 hours, the 14 days, the renewal count and the borrow limits are **defaults of `LibrarySettings`** (one row, pk=1), editable by admins at `/staff/settings` (`GET/PATCH /api/settings`). Changing them never moves a deadline already set. Copy that quotes them takes `{hours}` / `{days}` from `useLibrarySettings()` / `useRuleVars()`; notifications and activity rows carry `hours` / `days` params. `UserProfile.max_borrow_limit` is a personal override, `null` meaning "the default for my role": read `effective_borrow_limit`.
- **Renewal** (`services.renew`, `POST /api/borrow-records/<id>/renew`): a BORROWED loan only, by the borrower or staff, within `RENEW_WINDOW_DAYS` (3) of the due date, up to `max_renewals` times, never while someone waits for the book or the member has another overdue loan. It adds `loan_days` to the due date.
- Deactivating a member (`PATCH /api/users/<id>/active`) also sets `User.is_active`, so sign-in and token refresh fail; services refuse requests and reservations from inactive profiles.
- The hourly and nightly jobs run one `transaction.atomic()` per record (lock, re-check status, transition) so `select_for_update` works outside a request.

```
PENDING --(staff approves)--> READY --(staff confirms pickup)--> BORROWED --(staff confirms return)--> RETURNED
PENDING --(staff rejects)--> REJECTED
READY --(48h deadline passes)--> CANCELLED --(queue non-empty)--> new READY for next student
BORROWED --(past due date)--> OVERDUE
```

## Commands

```bash
npm install
npm run dev          # frontend on :3000, proxies /api and /media to Django on :8000
npm run dev:demo     # frontend only, in-browser demo API
npm run build        # tsc -b && vite build (real backend)
npm run build:demo   # static demo build (used by vercel.json)
npm run lint
npm run e2e          # Playwright against the demo API and a fresh Django (e2e/, ~4 min)
npm run e2e:demo     # demo project only (~1-2 min)
```

Backend: see `README.md` (venv, `migrate`, `seed_demo`, `runserver 8000`, `python manage.py test library`).

## Project structure

```
backend/library/        models, services (state machine), views, serializers, PDFs, tests, management commands
src/api/client.ts       fetch wrapper, JWT tokens, API_ROOT (VITE_API_URL), DEMO flag, demo accounts
src/api/index.ts        typed endpoint functions
src/api/demo.ts         in-browser API used by demo builds (seed data persisted in localStorage)
src/i18n/index.tsx      EN / FR / AR dictionaries, t(key, vars), RTL switching
src/components/Layout.tsx   header, user menu, demo notice, footer, Container
src/components/Page.tsx     PageHeader, Panel, EmptyState, ErrorState
src/components/             BookCover, BookActions (+ Availability), StatusBadge, MemberStanding, Countdown, dialogs
src/lib/time.ts         localized dates, relative times, countdown formatting
src/lib/table.ts        shared table classes for staff lists
src/lib/importFile.ts   reads .xlsx / .csv / .json for the bulk imports (validation is server-side)
src/hooks/useImportFlow.ts + src/components/ImportParts.tsx   the shared flow and pieces of the book and student import pages
src/components/ExportControls.tsx   inventory export menu and loans export dialog
backend/library/importing.py  bulk import rules (header aliases, ISBN checks, dry run); mirrored in demo.ts
backend/library/student_import.py  bulk student import (admin; accounts + welcome emails); exports.py  CSV/XLSX exports (formula-injection guard)
src/pages/              landing, auth, catalog, book, request list, my loans, profile, scan lookup
src/pages/staff/        staff desk: StaffLayout (sidebar + counts) and one page per function
src/components/ui/      shadcn/ui (generated; excluded from lint)
```

## Code style

- Double quotes, semicolons, 2-space indentation. `@/` alias for `src` imports.
- Pages are default exports; shared components and hooks are named exports. A `.tsx` file exports only components (react-refresh lint rule); put helpers in `src/lib/` or a `.ts` module.
- All user-visible text goes through `t()` with keys in all three languages. Use logical properties (`ms-`, `pe-`, `start-`, `text-start`) so layouts mirror in Arabic; wrap Latin data (IDs, ISBNs, shelf marks, emails) in `dir="ltr"`.
- `GET /books`, `/users` and `/borrow-records` are paginated: they return `Page<T>` (`{count, page, pageSize, results}`, 25 per page, `pageSize` up to 100) with server-side filters in `backend/library/filters.py`. Never fetch a whole list to filter it in the browser. `src/api/demo.ts` mirrors the same shape and filters.
- Data loading uses TanStack Query (`src/lib/queryClient.ts`). Build query keys with `qk` from `src/api/queryKeys.ts`; after a write, call the matching `invalidate*` helper there so every page that shows the changed data refreshes. Don't add hand-rolled fetch hooks.
- Timestamps are ISO strings from the API; format them with `src/lib/time.ts`, never with raw `toLocale*` calls.

## Design system

See `DESIGN.md` (the source of truth) and `PRODUCT.md` (product context). In short: white pages, one deep university green (`brand`, `#0E6B3C`) for primary actions and selection, red (`danger`, `#B42318`) only for overdue, rejection and destructive actions, neutral surfaces (`surface`). Source Serif 4 (Noto Naskh Arabic) speaks in headlines, the wordmark and large figures; Public Sans (Noto Sans Arabic) works in the UI; JetBrains Mono only for identifiers; tabular figures everywhere. Hairline-first and flat (4px radius on controls and panels, glass sticky header), black-and-white photography read through `src/lib/siteImages.ts` (admin-replaceable), wordmark logo with the University of Ghardaia seal beside it (`public/brand/`, keeps its own colours, 28 to 72px), Lucide icons. Lenis and GSAP run on the landing page only. Status is never shown by color alone (badges carry icons). `design/DESIGN.md` is the archived spec of the retired orange/cream design; do not follow it.

## Verifying changes

1. `npm run lint` and `npm run build` must pass.
2. Exercise flows with `npm run dev:demo` and the one-click demo accounts on the sign-in page: Priya Sharma (student), Daniel Okafor (student with an overdue loan), Marcus Holloway (staff), Eleanor Vance (admin). Password for every demo account: `password123`.
3. Check at 390px and 1440px, and in Arabic.

Flows to sanity-check: request a book / join a waiting list; approve → confirm pickup (stock −1) → confirm return (stock +1); overdue student cannot request; staff edit and delete books.

## Security

Role checks live in the Django views and `permissions.py`; the frontend guards are UX only. The demo build has no real authentication. Never commit real secrets. Staff accounts are created through single-use, expiring invites issued by admins (`StaffInvite`); students must verify their email before borrowing.

## Deployment

See `DEPLOYMENT.md` (Django env vars, cron jobs, Vercel demo vs. real-backend setup).
