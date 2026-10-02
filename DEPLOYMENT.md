# Deployment checklist

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
   | `LIBRARY_NAME` | printed on ID cards and in emails | University Library |
   | `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `EMAIL_USE_TLS` | SMTP server for password-reset, verification and invite emails (outside debug mode; debug prints them to the console) | none / `587` / none / none / `1` |
   | `DEFAULT_FROM_EMAIL` | sender of those emails | `LibBorrow <no-reply@localhost>` |
   | `DJANGO_SSL_REDIRECT` | redirect HTTP → HTTPS | `1` |
   | `DJANGO_HSTS_SECONDS` | HSTS max-age; raise to `31536000` once HTTPS is confirmed | `3600` |

   Generate a secret key with
   `python -c "import secrets; print(secrets.token_urlsafe(64))"`.

2. **Install & migrate**

   ```bash
   pip install -r backend/requirements.txt   # pinned versions, includes gunicorn on Linux
   export DJANGO_DEBUG=0   # plus the variables above
   python backend/manage.py migrate
   python backend/manage.py collectstatic --noinput   # admin site assets
   python backend/manage.py createsuperuser   # then set role=ADMIN in /admin if desired
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
   There is no shared staff code: the first admin comes from `createsuperuser`, and admins invite
   staff or other admins from Staff desk → Users → Invite staff. An invite is an emailed,
   single-use link bound to one address and valid for 7 days; the admin also sees the link once,
   in case the email bounces.

5. **Serve** — `gunicorn config.wsgi -b 0.0.0.0:8000` (from `backend/`), behind
   nginx/Cloudflare/etc. terminating TLS.

6. **Schedule the background jobs** (idempotent, so overlap is safe):

   ```cron
   # the crontab needs the same environment variables (DJANGO_DEBUG=0 etc.)
   7 * * * *  /path/to/.venv/bin/python /path/to/backend/manage.py cancel_expired_pickups
   11 0 * * * /path/to/.venv/bin/python /path/to/backend/manage.py mark_overdue
   ```

   Or Celery Beat calling the same two commands. `POST /api/jobs/run` remains
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

### Vercel

The repo is Vercel-ready: `vercel.json` sets the Vite build, the SPA fallback
and long-lived caching for `/assets/*`; `.vercelignore` keeps `backend/` out of
the upload.

**Default: standalone demo.** `vercel.json` runs `npm run build:demo`, which
loads `.env.demo` (`VITE_DEMO=true`). In that build `src/api/demo.ts` answers
every `/api/...` call inside the browser — same routes, JSON shapes, seed data
and business rules as the Django app — so the site works with no server. Data
is kept in the visitor's localStorage; the "Reset demo data" link in the header
reseeds it. The login page offers one-click demo accounts. Receipts and ID
cards are simple browser-generated PDFs. Try it locally with `npm run dev:demo`.

**Real backend.** Vercel hosts only the frontend, so deploy Django elsewhere
(Render, Railway, Fly.io, a VPS) with PostgreSQL and persistent media storage, and have Vercel
proxy `/api` to it so the browser sees one origin (see "Same-site requirement" for why):

1. In `vercel.json`, change `buildCommand` back to `npm run build` and add these rewrites to
   the *top* of the `rewrites` array, then import the repo in Vercel (framework preset:
   **Vite**, root: repo root). Leave `VITE_API_URL` unset.

   ```json
   { "source": "/api/:path*", "destination": "https://<your-backend-host>/api/:path*" },
   { "source": "/media/:path*", "destination": "https://<your-backend-host>/media/:path*" }
   ```

2. On the backend set:
   - `DJANGO_ALLOWED_HOSTS=<your-backend-host>`, `DJANGO_DEBUG=0`, a real `DJANGO_SECRET_KEY`
   - `FRONTEND_URL=https://<project>.vercel.app` so ID-card QR codes open the deployed app
   - `DJANGO_NUM_PROXIES=<n>`, the number of proxies between the browser and Django that append
     to `X-Forwarded-For` (Vercel plus your backend host's own proxy, if it has one)
   - no `CORS_*` settings are needed, and the cookie stays `SameSite=Strict`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:
frontend lint and both builds (real backend and Vercel demo), Django system check,
a missing-migrations check, the test suite, and `check --deploy` with production
settings.

## Smoke test after deploy

- `GET /api/books` → 200 without auth.
- Register a member → login → request a book; reload the page and confirm you are still signed in
  (a `POST /api/auth/refresh` returns 200) and that `localStorage` holds no tokens.
- Staff: approve → confirm pickup (stock −1) → confirm return (stock +1).
- `GET /api/users/me/id-card` downloads a PDF whose QR opens `/scan/<uuid>` as staff.
