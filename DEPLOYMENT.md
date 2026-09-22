# Deployment checklist

## Backend (Django)

1. **Environment variables**

   | Var | Purpose | Default (dev) |
   |---|---|---|
   | `DJANGO_SECRET_KEY` | crypto key — **must set in prod** | insecure dev key |
   | `DJANGO_DEBUG` | `0` in production | `1` |
   | `DJANGO_ALLOWED_HOSTS` | comma-separated hosts | `*` |
   | `DB_ENGINE` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | point at PostgreSQL | SQLite file |
   | `CORS_ALLOWED_ORIGINS` | your frontend origin(s) | localhost |
   | `FRONTEND_URL` | base URL embedded in ID-card QR codes | `http://localhost:3000` |
   | `STAFF_INVITE_CODE` | staff self-registration gate | `LIB-STAFF-2024` |
   | `LIBRARY_NAME` | printed on ID cards | City Central Library |

2. **Install & migrate**

   ```bash
   pip install -r backend/requirements.txt gunicorn
   python backend/manage.py migrate
   python backend/manage.py createsuperuser   # then set role=ADMIN in /admin if desired
   ```

3. **Serve** — `gunicorn config.wsgi -b 0.0.0.0:8000` (from `backend/`), behind
   nginx/Cloudflare/etc. terminating TLS.

4. **Schedule the background jobs** (idempotent, so overlap is safe):

   ```cron
   7 * * * *  /path/to/.venv/bin/python /path/to/backend/manage.py cancel_expired_pickups
   11 0 * * * /path/to/.venv/bin/python /path/to/backend/manage.py mark_overdue
   ```

   Or Celery Beat calling the same two commands. `POST /api/jobs/run` remains
   available as a staff-triggered manual run.

## Frontend (Vite/React)

1. `npm ci && npm run build` → static site in `dist/`.
2. Host `dist/` on any static host / CDN (Netlify, Vercel, S3+CloudFront, nginx).
3. The app calls `${VITE_API_URL}/api/...` — either:
   - leave `VITE_API_URL` empty and serve the SPA and the API from the **same
     origin** (reverse-proxy `/api` → Django, e.g. nginx
     `location /api/ { proxy_pass http://127.0.0.1:8000; }`), or
   - run the API on a separate origin, set `VITE_API_URL=https://api.example.com`
     at build time, and add the frontend origin to `CORS_ALLOWED_ORIGINS`.
4. SPA fallback: configure the host to serve `index.html` for unknown paths
   (client-side routing).

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
(Render, Railway, Fly.io, a VPS) with PostgreSQL and persistent media storage:

1. In `vercel.json`, change `buildCommand` back to `npm run build`, then import
   the repo in Vercel (framework preset: **Vite**, root: repo root).
2. Environment variable (Production + Preview):
   `VITE_API_URL=https://<your-backend-host>` — no trailing slash, no `/api`.
3. On the backend set:
   - `CORS_ALLOWED_ORIGINS=https://<project>.vercel.app` (plus any custom domain)
   - `CORS_ALLOWED_ORIGIN_REGEXES=^https://<project>-.*\.vercel\.app$` for preview URLs
   - `FRONTEND_URL=https://<project>.vercel.app` so ID-card QR codes open the deployed app
   - `DJANGO_ALLOWED_HOSTS=<your-backend-host>`, `DJANGO_DEBUG=0`, a real `DJANGO_SECRET_KEY`

**Alternative — same-origin proxy (no CORS):** leave `VITE_API_URL` empty and
add these rewrites to the *top* of the `rewrites` array in `vercel.json`:

```json
{ "source": "/api/:path*", "destination": "https://<your-backend-host>/api/:path*" },
{ "source": "/media/:path*", "destination": "https://<your-backend-host>/media/:path*" }
```

## Smoke test after deploy

- `GET /api/books` → 200 without auth.
- Register a member → login → request a book.
- Staff: approve → confirm pickup (stock −1) → confirm return (stock +1).
- `GET /api/users/me/id-card` downloads a PDF whose QR opens `/scan/<uuid>` as staff.
