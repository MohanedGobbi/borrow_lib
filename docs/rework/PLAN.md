# LibBorrow rework plan

Goal: take LibBorrow from a polished demo to a system a university library can run.
Work is split into numbered work packages (WP). Each WP runs in **its own fresh session**
on the model named below, starting from its spec file in this folder.

## How to run a work package

1. Open a new session and pick the model and effort from the table in the app's picker.
2. Prompt: `Read docs/rework/PLAN.md and docs/rework/WP-NN.md, then do WP-NN.`
   If the WP has no spec file yet, the spec is the row in this plan.
3. Done means: the WP's acceptance checks pass, plus `npm run lint`, `npm run build`,
   `npm run build:demo` and `python manage.py test library` (see `AGENTS.md`).
4. Tick the WP below and add a one-line note (commit hash, anything the next WP must know).

Model roles: **Opus** writes specs and failing tests, does risky logic, reviews diffs.
**Sonnet** implements against a spec or tests. **Haiku** does mechanical chores.
**Fable** is reserved for the copy-level data model design (WP-18).
Never switch models mid-WP: the prompt cache is per model.

## Sprint 1: Correctness

| WP | Task | Model · effort | Status |
|---|---|---|---|
| 01 | Failing tests for the four Phase 0 bugs + WP-02 spec | Opus · high | done (`library/test_circulation_rules.py`) |
| 02 | Fix the Phase 0 bugs in Django and `src/api/demo.ts` ([spec](WP-02.md)) | Sonnet · high | done, Opus-reviewed: lock order book→record in hourly job; queue handoff always needs a free copy; UI shows free copies + "held for pickup". Open: Django-admin deactivation doesn't sync `User.is_active`; demo has no `PATCH /users/:id/active` route |
| 03 | PostgreSQL service in CI; run the test suite on it | Haiku | done (inline, too small to delegate): `backend-postgres` CI job, `psycopg[binary]` pinned; 53/53 pass on Postgres 17 locally |
| 04 | Pagination + `django-filter` on list endpoints, N+1 fix in `ProfileSerializer` (`annotate`), frontend lists read paginated responses ([spec](WP-04.md)) | Sonnet · high | done, Opus-reviewed (restored shelf-mark search). Open: `/api/categories` still counts books per row |
| R1 | `/code-review` of the sprint diff | Opus · high | done |

## Sprint 2: Security

| WP | Task | Model · effort | Status |
|---|---|---|---|
| 05 | Auth design spec + contract tests ([spec](WP-05.md), `test_auth_cookies.py`) | Opus · xhigh | done: API must be same-site (third-party cookies are blocked) |
| 06 | Implement WP-05 (includes WP-07) | Sonnet · high | done, Opus-reviewed. Open: throttle counters are per process (LocMem); use a shared cache when WP-15 adds Redis |
| 07 | DRF throttling on login, register, refresh, invite code | folded into WP-06 (same views; a cold Haiku start cost more) | |
| 08 | Password reset + email verification; admin-issued single-use expiring staff invites replacing the shared invite code ([spec](WP-08.md), contract `test_accounts.py` by Opus) | Sonnet · high | done, Opus-reviewed. Agent found and fixed a privilege escalation (`PATCH /users/me` could set `role`), hotfix branch off main. Open: verification links last 1 h (shared `PASSWORD_RESET_TIMEOUT`); dev `FRONTEND_URL` is :3000 while `frontend-dev` serves :3001 |
| 09 | Error + notification codes translated in the UI ([spec](WP-09.md)) | Opus spec → Sonnet · high (translations in the same pass; a separate Haiku pass cost more) | done, Opus-reviewed. `scripts/check-i18n.mjs` in CI keeps EN/FR/AR key sets equal |
| R2 | `/security-review` | Opus · high | done: no high/medium findings; fixed both lows (login is JSON-only against login CSRF; invites are revoked when their creator loses admin, is deactivated or deleted) |

## Sprint 3: Frontend and tests

| WP | Task | Model · effort | Status |
|---|---|---|---|
| 10 | Dead code: unused `src/components/ui/*`, unused Radix deps, `kimi-plugin-inspect-react`, `template-info.md`, package name `my-app` ([spec](WP-10-11.md)) | Haiku | done: 38 components, 26 packages removed |
| 11 | Route-level code splitting (`React.lazy`) for staff pages, charts, import; target < 250 KB gz for the student entry | Haiku | done: eager JS ≈ 188 KB gz (was ≈ 322); entry is now Radix + i18n dictionaries; lazy-loading FR/AR dictionaries is a possible later win |
| 12 | Replace `useApi` with TanStack Query: 2 pages to set the pattern (high), the rest (low). Runs **after** WP-13 so the E2E suite guards it | Sonnet | |
| 13 | Playwright E2E against both the demo and Django ([spec](WP-13.md)); axe checks | Sonnet · high | |
| 14 | Contract tests run against both Django and `demo.ts` | merged into WP-13: the same E2E suite runs on both backends | |

## Sprint 4: Operations

| WP | Task | Model · effort | Status |
|---|---|---|---|
| 15 | Dockerfile, docker-compose (Django, Postgres, scheduler), `/healthz` | Sonnet · medium | |
| 16 | S3-compatible media (`django-storages`), Sentry front + back, JSON logs | Sonnet · low | |
| 17 | Dependabot, backup script, one-page admin guide | Haiku | |

## Sprint 5: Copy-level tracking

| WP | Task | Model · effort | Status |
|---|---|---|---|
| 18 | Design `Item` (barcode, condition, status): migration from counts, state machine, import, demo | Fable 5.1 (or Opus · max) | |
| 19 | Migration + service layer | Opus · high | |
| 20 | Serializers, scan-the-book staff UI, per-copy history | Sonnet · medium | |
| 21 | Loan renewal (one, blocked by a queue); email notifications (ready, due in 2 days, overdue) | Sonnet · medium | |

## Sprint 6: Polish

| WP | Task | Model · effort | Status |
|---|---|---|---|
| 22 | Circulation rules (hold hours, loan days, limits) editable by admin in the DB | Sonnet · medium | |
| 23 | Catalogue/loan export to Excel/CSV; bulk student import | Sonnet · low | |
| 24 | Accessibility pass (focus traps, live regions, table semantics) | Sonnet · medium | |
| 25 | FR/AR copy cleanup (Haiku drafts; a native speaker reviews) | Haiku | |
| 26 | README, fresh screenshots, `AGENTS.md` update | Haiku | |

## Keeping usage down

- Start from the spec file, not from exploring. Point at files and functions, not "look around".
- `src/api/demo.ts` is ~1,100 lines: name the function to change.
- Keep `AGENTS.md` current after each sprint; every session reads it.
- Batch the Haiku chores (07, 10, 11, 17) into one session where possible.
