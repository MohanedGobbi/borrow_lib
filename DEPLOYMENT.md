# Deployment checklist

> **On a Linux server or PC?** [`INSTALL-LINUX.md`](INSTALL-LINUX.md) is a step-by-step tutorial and
> `deploy/install.sh` does everything below for you (nginx, gunicorn under systemd, PostgreSQL, cron,
> backups). This file is the reference for the settings, the public demo on Vercel, and other
> hosting set-ups.

## Backend (Django)

1. **Environment variables**

   Production is the default: with `DJANGO_DEBUG` unset, the server refuses to
   start unless the three required variables are set. `manage.py` defaults to
   debug mode for local development, so export `DJANGO_DEBUG=0` (plus the real
   settings) when running management commands or cron jobs on the server.

   | Var | Purpose | Default |
   |---|---|---|
   | `DJANGO_SECRET_KEY` | random value, 50+ characters | **required in production** |
   | `DJANGO_ALLOWED_HOSTS` | comma-separated API host names (no `*`) | **required in production** |
   | `DJANGO_DEBUG` | `1` for local development only | `0` (`1` via `manage.py`) |
   | `DB_ENGINE` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | point at PostgreSQL | SQLite file |
   | `CORS_ALLOWED_ORIGINS` | frontend origin(s); only needed when the API is on a different subdomain (see "Same-site requirement") | `http://localhost:3000` in debug, none in production |
   | `AUTH_COOKIE_SAMESITE` | `Strict` (same origin) or `Lax` (API on a sibling subdomain). `None` is refused in production | `Strict` |
   | `AUTH_COOKIE_DOMAIN` | parent domain for the refresh cookie (e.g. `library.example.edu`); only for the subdomain setup | host-only cookie |
   | `DJANGO_NUM_PROXIES` | number of reverse proxies in front of Django, so login/register rate limits key on the real client IP (`X-Forwarded-For`) | `0` |
   | `CSRF_TRUSTED_ORIGINS` | origins allowed to post to the Django admin | none |
   | `FRONTEND_URL` | base URL embedded in ID-card QR codes and in the links of password-reset, verification and invite emails | `http://localhost:3000` |
   | `LIBRARY_NAME` | printed on ID cards and in emails; when set, it replaces the French and Arabic names in emails too | Faculty of Law and Political Sciences Library |
   | `REGISTRATION_EMAIL_DOMAINS` | comma-separated email domains open sign-up accepts (subdomains included, e.g. `etu.univ-ghardaia.dz`); empty accepts any address. Staff invites and accounts made by an admin are not limited | `univ-ghardaia.dz` (none in the demo) |
   | `LIBRARY_TIME_ZONE` | IANA time zone (e.g. `Africa/Algiers`) that dates and times inside emails are written in; stored times stay UTC | `UTC` |
   | `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `EMAIL_USE_TLS` | SMTP server for password-reset, verification and invite emails (outside debug mode; debug prints them to the console) | none / `587` / none / none / `1` |
   | `DEFAULT_FROM_EMAIL` | sender of those emails | `Faculty Library <no-reply@localhost>` |
   | `DJANGO_SSL_REDIRECT` | redirect HTTP → HTTPS | `1` |
   | `DJANGO_ALLOW_HTTP` | `1` serves plain HTTP: turns off the redirect, HSTS and the `Secure` flag on cookies (browsers drop those over `http://`, which would sign everyone out on reload). For a trial on a private network only | `0` |
   | `DJANGO_MEDIA_ROOT` / `DJANGO_STATIC_ROOT` | where uploads and `collectstatic` output live; the reverse proxy must serve them at `/media/` and `/static/` (Django only does so in debug mode) | `backend/media`, `backend/staticfiles` |
   | `DJANGO_HSTS_SECONDS` | HSTS max-age; raise to `31536000` once HTTPS is confirmed | `3600` |

   Generate a secret key with
   `python -c "import secrets; print(secrets.token_urlsafe(64))"`.

2. **Install & migrate**

   ```bash
   pip install -r backend/requirements.txt   # pinned versions, includes gunicorn on Linux
   export DJANGO_DEBUG=0   # plus the variables above
   python backend/manage.py migrate
   python backend/manage.py collectstatic --noinput   # admin site assets
   python backend/manage.py load_inventory    # the library's catalogue (safe to repeat)
   python backend/manage.py create_admin --email admin@univ-ghardaia.dz --name "…" --phone …
   ```

   **Loading the existing catalogue:** librarians can use Staff desk → Inventory →
   Import books (Excel, CSV or JSON, up to 5,000 rows per file). For a first big load
   from the command line:

   ```bash
   python backend/manage.py import_books catalogue.xlsx --dry-run   # report only
   python backend/manage.py import_books catalogue.xlsx             # import new books
   python backend/manage.py import_books catalogue.xlsx --update    # also update existing ISBNs
   ```

3. **Sessions and rate limits.** The access token (10 minutes) lives only in the
   page's memory; the 7-day refresh token is an httpOnly cookie named `lb_refresh` scoped to
   `/api/auth`, rotated on every use and blacklisted when rotated or on sign-out (the
   `token_blacklist` tables come with `migrate`). Rotated tokens pile up in the database;
   prune expired ones now and then with `python backend/manage.py flushexpiredtokens`.
   Sign-in is limited to 10/min per client, registration and password-reset or verification
   emails to 5/hour each, and refresh to 30/min. Throttle counters use Django's default cache (per
   process); configure a shared cache such as Redis if you run several workers and want exact
   limits. Set `DJANGO_NUM_PROXIES` to the number of proxies in front of Django, otherwise
   every client shares the proxy's address.

4. **Email and staff accounts.** Members must confirm their email address before they can
   borrow, and anyone can reset a forgotten password; both send an email, so configure SMTP
   (`EMAIL_*` above) before launch. Password-reset and verification links are valid for one hour.
   There is no shared staff code: the first admin comes from `create_admin`, and admins create
   accounts of any type (Staff desk → Readers → Create account) or invite staff or other admins (Invite staff). An invite is an emailed,
   single-use link bound to one address and valid for 7 days; the admin also sees the link once,
   in case the email bounces.

5. **Serve** — `gunicorn config.wsgi -b 0.0.0.0:8000` (from `backend/`), behind
   nginx/Cloudflare/etc. terminating TLS.

6. **Schedule the background jobs** (idempotent, so overlap is safe):

   ```cron
   # the crontab needs the same environment variables (DJANGO_DEBUG=0 etc.)
   7 * * * *  /path/to/.venv/bin/python /path/to/backend/manage.py cancel_expired_pickups
   11 0 * * * /path/to/.venv/bin/python /path/to/backend/manage.py mark_overdue
   0 8 * * *  /path/to/.venv/bin/python /path/to/backend/manage.py send_reminders
   ```

   `send_reminders` emails members whose loan is due within the reminder window (Staff desk →
   Library rules; 0 turns it off) and retries overdue emails that failed to send. Each email goes
   out once per loan, so overlap is safe. Pick a morning hour in `LIBRARY_TIME_ZONE`'s day. The
   "ready for pickup" email needs no job: it goes out when staff approve a request or the
   waiting list hands over a copy, and the overdue email goes out when `mark_overdue` flags
   the loan.

   Or Celery Beat calling the same three commands. `POST /api/jobs/run` remains
   available as a staff-triggered manual run.

## Frontend (Vite/React)

1. `npm ci && npm run build` → static site in `dist/`.
2. Host `dist/` on any static host / CDN (Netlify, Vercel, S3+CloudFront, nginx).
3. The app calls `${VITE_API_URL}/api/...`. Serve the SPA and the API from the **same
   origin** and leave `VITE_API_URL` empty (reverse-proxy `/api` → Django, e.g. nginx
   `location /api/ { proxy_pass http://127.0.0.1:8000; }`; on Vercel use the rewrite below).
   See "Same-site requirement".
4. SPA fallback: configure the host to serve `index.html` for unknown paths
   (client-side routing).

### Same-site requirement

The refresh token is an httpOnly cookie, and Safari and Firefox block cookies that belong to a
different site (third-party cookies). `*.vercel.app` and `*.onrender.com` are public suffixes,
so `app.vercel.app` → `api.onrender.com` is cross-site and sign-in would not survive a reload.
The API must therefore be **same-site** with the frontend:

1. **Same origin (recommended):** the frontend's host proxies `/api` (and `/media`) to Django
   (nginx `location /api/`, or the Vercel rewrite below). No CORS, cookie `SameSite=Strict`.
2. **Sibling subdomain** (`library.example.edu` + `api.library.example.edu`): set
   `AUTH_COOKIE_SAMESITE=Lax`, `AUTH_COOKIE_DOMAIN=library.example.edu`,
   `CORS_ALLOWED_ORIGINS=https://library.example.edu`, and build the frontend with
   `VITE_API_URL=https://api.library.example.edu`.

A `VITE_API_URL` on another registrable domain is not supported.

### Vercel: the public demo (frontend and API in one project)

The repository deploys to Vercel as a working, testable demo: the Vite site plus the Django API
as one Python function (`api/index.py`, routed by `vercel.json`), on one domain, so sign-in works
with no CORS setup. `DEMO_MODE=1` turns it into a demo:

- fictional readers, a librarian and an administrator on a portion of the real inventory
  (`DEMO_TITLES`, 800 titles), with requests, holds, loans, an overdue loan and a waiting list;
- the sign-in page offers the shared accounts in one click, and a banner on every page says it is a demo;
- every night at 03:00 UTC Vercel Cron calls `/api/demo/reset`, which rebuilds all of it;
- no email is sent (self sign-ups are confirmed at once), uploads are off (Vercel keeps no files), and
  maintenance actions and changes to the shared accounts are refused, so one visitor cannot spoil it
  for the next.

The library's own installation never sets `DEMO_MODE`; `load_demo` and `/api/demo/*` refuse to run without it.

**Set it up (once):**

1. **Import the repository** in Vercel (Add New → Project → the GitHub repository). Keep the root
   directory and the detected settings: `vercel.json` already sets the Vite build, the API function,
   the Frankfurt region (`fra1`, closest to Algeria) and the nightly cron.
2. **Add the database:** in the project, Storage → Create Database → **Neon** (free plan). Pick the
   region **AWS eu-central-1 (Frankfurt)**, the same as the function: a reset makes about 2,800
   queries, so a database on another continent would make it slow. Connect it to the project; Neon
   sets `DATABASE_URL`.
3. **Environment variables** (Settings → Environment Variables, for Production and Preview):

   | Name | Value |
   |---|---|
   | `DEMO_MODE` | `1` |
   | `DJANGO_SECRET_KEY` | a random value: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
   | `CRON_SECRET` | another random value (at least 16 characters); Vercel sends it to the nightly reset |
   | `DEMO_PASSWORD` | optional: the shared accounts' password (default `Library-Demo-2026`) |

   Nothing else is needed: the Vercel host names, `FRONTEND_URL` and the proxy count come from the
   platform. Add `DJANGO_ALLOWED_HOSTS` only for a custom domain.
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables apply.
5. **Load the demo data once:** open
   `https://<your-project>.vercel.app/api/demo/reset?token=<CRON_SECRET>`. It creates the tables and
   the demo, and answers with something like `{"books": 800, "accounts": 15, "records": 53}` after
   about a minute. From then on the cron does it every night.
6. Open the site, sign in with one of the demo accounts, and share the address.

**If something is wrong:** the function's log is under Deployments → the deployment → Functions.
A 500 on every API call before step 5 is expected (no tables yet). `DisallowedHost` means a custom
domain is missing from `DJANGO_ALLOWED_HOSTS`. Vercel installs the function's packages from the root
`requirements.txt`, a flat copy of `backend/requirements.txt` without gunicorn (Vercel cannot follow
`-r` includes); when you change a pin, change both, and `test_requirements.py` checks they agree.

**Limits of the free plans:** the first request after a quiet period starts the function (1–3 s);
Vercel's Hobby plan runs crons once a day; Neon's free plan sleeps the database when idle and wakes it
on the next request.

## Backups

Admins download a full backup (accounts, catalogue, circulation, settings, activity) from
Settings → Data and maintenance, and can restore it there. Uploaded files (book covers, site
photographs) are not in that file: back up `backend/media/` as well, and take regular database
dumps (`pg_dump`) on the server.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:
frontend lint, the translation check and the build, Django system check,
a missing-migrations check, the test suite, and `check --deploy` with production
settings.

## Smoke test after deploy

- `GET /api/books` → 200 without auth.
- Register a member → login → request a book; reload the page and confirm you are still signed in
  (a `POST /api/auth/refresh` returns 200) and that `localStorage` holds no tokens.
- Staff: approve → confirm pickup (stock −1) → confirm return (stock +1).
- `GET /api/users/me/id-card` downloads a PDF whose QR opens `/scan/<uuid>` as staff.
