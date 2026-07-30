# DECISIONS.md

Where this build deviates from — or fills gaps in — `library_platform_agent_prompt.md`,
plus decisions behind the feature-set added in later iterations (cover uploads, request
receipts, analytics, staff UX split, Konami-hidden staff auth, i18n, cart, category
theming).

## Iteration 3 additions (owner-requested)

12. **Categories are a model, not an enum.** `Category(name, color)` with staff CRUD.
    Colors drive the catalog theme when filtering (`useCategoryAccent`) and the
    category dots across the UI. Deleting a category is blocked while books use it.
    The existing DB was reset (dev data) to switch from the enum — re-run
    `migrate` + `seed_demo` when pulling this change.

13. **Request receipts.** `GET /api/borrow-records/<id>/document` renders a
    ReportLab PDF modeled on the REQ-210 reference (receipt no., member info,
    requested-book table with status pill, official processing, signature lines).
    Access: the owning member or staff/admin (tested both ways). The UI exposes it
    via a modal ("Receipt" button) next to approve/reject and on each record row.
    `BorrowRecord.approved_by` was added to name the processing staff member.

14. **Staff borrowing removed.** Per the new rule, only MEMBER accounts can create
    borrow requests or reservations — staff/admin get 403 (spec originally let staff
    do everything a member can; owner override wins).

15. **Hidden staff auth.** Staff sign-in credentials work on the normal login form,
    but the staff signup tab and staff hints are only revealed after the Konami code
    (↑↑↓↓←→←→ B A) on the login/signup pages (persisted per tab via sessionStorage).

16. **Cart is client-side.** Members collect books in a localStorage cart and submit
    one request per book; per-book failures are reported without losing the rest.
    The backend intentionally stays one-request-per-call.

17. **User management.** Staff can list/search users and open any profile with full
    borrowing history; only ADMIN can delete accounts (`DELETE /api/users/<id>/delete`),
    with guards against self-deletion and staff deleting admins.

18. **i18n coverage.** EN/FR/AR dictionaries cover the app chrome and main flows
    (landing, auth, catalog, cart, requests, profile, staff pages). Backend-generated
    messages (toasts from API errors, notifications, PDF contents) remain in English —
    full server-side i18n is a future step. Arabic switches the document to RTL.

19. **Analytics are computed on demand** (`/api/analytics`): status distribution,
    category loan share, 6-month loans/returns/new-members series, top-5 books,
    fulfillment rate. No materialized stats tables yet — fine at this scale.

## Resolved since the first (demo) iteration

The earlier in-browser mock backend has been fully replaced by the spec's real stack:
Django 6 + DRF + SimpleJWT + SQLite/Postgres + ReportLab + qrcode. The mock layer was
deleted; the frontend now talks to `/api` exclusively.

## Remaining deviations

1. **Celery/Redis → management commands.** Per the spec's own fallback clause, the
   hourly and nightly jobs are Django management commands
   (`cancel_expired_pickups`, `mark_overdue`) designed for cron. Both are idempotent
   and log every action. `POST /api/jobs/run` additionally lets staff trigger them
   from the dashboard. Swap to Celery Beat later without changing business logic —
   the jobs live in `library/services.py`.

2. **JWT username = email.** Registration uses the email as the Django username;
   `POST /api/auth/login` accepts `{username: <email>, password}`.

3. **Staff self-registration via invite code.** The spec defines roles but no staff
   onboarding flow. Signup offers Member / Staff tabs; the Staff tab requires
   `STAFF_INVITE_CODE` (env-configurable). Admins are created via `createsuperuser`
   or promoted through `PATCH /api/users/<id>/role` (admin-only).

4. **Book covers are color tokens, not images.** `cover_image` is optional in the
   spec; `Book.cover_color` drives generated editorial-style covers in the UI.

5. **Polling instead of websockets.** The spec allows polling every 30–60s; the
   dashboard, records and notifications poll on a 30–45s cadence.

## Gap-fills (spec was silent)

6. **Duplicate-request guard.** A member cannot file a second open request (PENDING or
   READY) for the same title, nor join the same reservation queue twice.

7. **Return of an OVERDUE loan** uses the same confirm-return action
   (`OVERDUE → RETURNED`); this is how staff resolve an overdue record and unblock
   the member. The transition table admits `return` from BORROWED and OVERDUE only.

8. **`total_copies` edits are constrained**: staff cannot set total below the number
   on loan; `available_copies` is recomputed as `total − on_loan`.

9. **Borrow-limit accounting** counts PENDING, READY, BORROWED and OVERDUE records
   against `max_borrow_limit` (5 for members, 10 for staff/admin).

10. **Scan lookup uses a per-member UUID** (`UserProfile.uuid`) rather than the
    numeric PK, so ID-card QRs do not leak sequential user IDs.

11. **Superusers are treated as ADMIN** in permission checks even before a profile
    role is set, so a fresh `createsuperuser` is never locked out.

## Verification

- `backend/library/tests.py` — 16 tests: every transition, invalid transitions,
  stock only moving at pickup/return, borrow limit, overdue block + unblock, the
  cancellation→reservation handoff, job idempotency, 403 boundaries for member vs
  staff on every staff endpoint, and a full register→request→approve→pickup→return
  integration flow. All passing.
- The ID-card PDF endpoint and QR scan lookup were smoke-tested against a running
  server (`/api/users/me/id-card` → 9KB PDF; `/api/users/<uuid>/scan` → member loans).
