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
3. The app calls `/api/...` — either:
   - serve the SPA and the API from the **same origin** (reverse-proxy `/api` →
     Django, e.g. nginx `location /api/ { proxy_pass http://127.0.0.1:8000; }`), or
   - run the API on a separate origin and add it to `CORS_ALLOWED_ORIGINS`, then
     change `BASE` in `src/api/client.ts` to the absolute API URL before building.
4. SPA fallback: configure the host to serve `index.html` for unknown paths
   (client-side routing).

## Smoke test after deploy

- `GET /api/books` → 200 without auth.
- Register a member → login → request a book.
- Staff: approve → confirm pickup (stock −1) → confirm return (stock +1).
- `GET /api/users/me/id-card` downloads a PDF whose QR opens `/scan/<uuid>` as staff.
