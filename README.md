# مكتبة كلية الحقوق والعلوم السياسية — جامعة غرداية

**Library of the Faculty of Law and Political Sciences, University of Ghardaia**

The library's online borrowing system. Readers search the catalogue and request books online, then collect
them at the circulation desk. Librarians approve requests, confirm pickups and returns, and manage the
collection. Administrators also manage accounts, the borrowing rules and the library's data.

The interface is in **Arabic (default, right to left)**, French and English.

> **بالعربية باختصار:** نظام إعارة مكتبة كلية الحقوق والعلوم السياسية بجامعة غرداية. يبحث القارئ في الفهرس
> ويطلب الكتاب عبر الموقع ثم يستلمه من مكتب الإعارة. يوافق المكتبي على الطلبات ويسجل الاستلام والإرجاع،
> ويدير الموظف المسؤول الحسابات وقواعد الإعارة والنسخ الاحتياطية. الواجهة بالعربية افتراضيًا، مع الفرنسية والإنجليزية.

---

## Contents

1. [Features](#features)
2. [Accounts and roles](#accounts-and-roles)
3. [How borrowing works](#how-borrowing-works)
4. [Tech stack](#tech-stack)
5. [Run it locally](#run-it-locally)
6. [Management commands](#management-commands)
7. [Configuration](#configuration)
8. [Deployment](#deployment)
9. [Backups and maintenance](#backups-and-maintenance)
10. [Project structure](#project-structure)
11. [Tests and checks](#tests-and-checks)
12. [Troubleshooting](#troubleshooting)

---

## Features

**For readers**
- Search the catalogue by title, author or call number, filtered by subject.
- Request a book, or several at once from a request list. Join a waiting list when every copy is out.
- Follow each request from approval to return under *My loans*, with countdowns for pickup and due dates.
- Renew a loan near its due date (when nobody is waiting for the book).
- A digital library card with a QR code, also downloadable as a PDF.
- Choose which notifications to receive, in the site and by email.

**For librarians (staff desk)**
- Overview of the day: requests to approve, books to hand over, loans due and overdue.
- Approve or reject requests (with a reason), confirm pickups and returns, renew loans.
- Scan a reader's card QR code, or press `/`, to open their record at the desk.
- Manage the catalogue: add, edit and delete books, import a spreadsheet (Excel, CSV, JSON), export to CSV or Excel.
- Waiting lists, reader records and history, statistics, activity log.
- Send a notification to readers, chosen by account type and/or person by person.
- Printable PDF receipts for each request (Arabic text supported).

**For administrators**
- Create accounts of any type, other administrators included; change an account's type; deactivate or delete it.
- Import reader accounts from a spreadsheet; invite staff by email.
- Edit the borrowing rules (pickup window, loan length, renewals, borrow limits, reminder timing).
- Replace the site's photographs.
- **Data and maintenance:** download a backup, restore one, reload the catalogue, run the scheduled checks,
  reset all circulation, clear the activity log, delete all reader accounts or the whole catalogue.
  Every change asks for the administrator's password again.

**The catalogue.** The library's inventory (جرد المكتبة) ships with the project in
`backend/library/data/inventory.csv`: **4,487 titles and 19,243 copies**, each with its call number, title,
author and number of copies. Subjects come from the Dewey class of the call number (320 political science,
341 international law, 342 constitutional and administrative law, 345 criminal law, 346 private law, …).
Books do not need an ISBN: without one, the call number and the title identify a book.

---

## Accounts and roles

Everyone signs in with **email and password**.

| Account type | Arabic | Role in the system | What they can do |
|---|---|---|---|
| Student | طالب | `MEMBER` | borrow, waiting lists, library card |
| Professor | أستاذ | `MEMBER` | the same |
| Administrative staff | إداري مسير | `MEMBER` | the same |
| External reader | خارجي | `MEMBER` | the same |
| Librarian | مكتبي | `STAFF` | the staff desk |
| Administrator | موظف مسؤول | `ADMIN` | everything, including accounts, rules and maintenance |

- **Self sign-up** (`/signup`): full name, email, phone number, password and the reader type. The reader confirms
  their email address (a link is emailed) before they can borrow.
- **Accounts created by an administrator** (Staff desk → Readers → Create account): with a password, the account
  works immediately; without one, the person receives an email to choose their password.
- Every account gets a library card number such as `GH-000123`.
- The **first administrator** is created from the command line (see [Run it locally](#run-it-locally)).
- Librarians and administrators do not borrow; their accounts are for running the library.

---

## How borrowing works

```
PENDING --(librarian approves)--> READY --(pickup confirmed)--> BORROWED --(return confirmed)--> RETURNED
PENDING --(librarian rejects)--> REJECTED
READY   --(pickup window passes)--> CANCELLED --> the copy goes to the next reader on the waiting list
BORROWED --(past the due date)--> OVERDUE
```

- A loan starts at **pickup**, not at approval. Available copies change only at pickup (−1) and return (+1).
- An approved request waits on the hold shelf for **48 hours** by default. If it is not collected, it is
  cancelled and the copy goes to the next reader on the waiting list, with a fresh window.
- Loans run **14 days** from pickup by default and can be renewed once, in the last 3 days, if nobody is waiting.
- An **overdue** loan blocks new requests and pickups until the book is returned.
- Default borrow limits: 5 books for readers, 10 for staff. An administrator can set a personal limit for anyone.
- All of these numbers are editable in **Staff desk → Library rules**. A change never moves a deadline already set.

---

## Tech stack

| Part | Technology |
|---|---|
| Backend | Python 3.12+, Django 6, Django REST Framework, SimpleJWT, django-filter |
| Database | SQLite in development, PostgreSQL in production |
| PDFs | ReportLab + QR codes; Arabic via Noto Naskh Arabic, `arabic-reshaper` and `python-bidi` |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3, shadcn/ui, TanStack Query, React Router 7 |
| Charts | Recharts |

Sessions: a short-lived access token kept in memory, and a refresh token in an httpOnly cookie.

---

## Run it locally

You need **Python 3.12+** and **Node.js 22+**.

### 1. Backend (port 8000)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py load_inventory    # loads the 4,487 titles of the library inventory
python manage.py create_admin --email admin@univ-ghardaia.dz --name "الاسم الكامل" --phone 0661000000
python manage.py runserver 8000
```

`create_admin` asks for the password (at least 8 characters, not too common).

### 2. Frontend (port 3000)

In a second terminal, from the repository root:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The dev server forwards `/api` and `/media` to Django on port 8000.

### 3. First steps

1. Sign in with the administrator account.
2. Staff desk → **Readers** → *Create account* to add librarians and readers, or let readers sign up at `/signup`.
3. Staff desk → **Library rules** to check the pickup window, loan length and limits.

In development, emails (verification, password reset, welcome, reminders) are printed in the Django terminal
instead of being sent.

---

## Management commands

Run from `backend/` (with the virtual environment active).

| Command | What it does |
|---|---|
| `python manage.py create_admin --email … --name "…" [--phone …]` | creates an administrator account |
| `python manage.py load_inventory` | loads `library/data/inventory.csv` into the catalogue; safe to run again (updates, never duplicates) |
| `python manage.py import_books file.xlsx [--update] [--dry-run]` | imports books from an Excel, CSV or JSON file |
| `python manage.py import_students file.xlsx [--dry-run]` | creates reader accounts from a spreadsheet and emails each a link to set a password |
| `python manage.py cancel_expired_pickups` | cancels holds not collected in time and serves the waiting list (run **hourly**) |
| `python manage.py mark_overdue` | marks loans past their due date as overdue (run **nightly**) |
| `python manage.py send_reminders` | emails readers whose loans are due soon (run **every morning**) |
| `python manage.py test library` | runs the backend test suite |

The three scheduled jobs are safe to run more than once. Librarians can also run them on demand from the
staff desk overview, and administrators from Settings → Data and maintenance.

**Spreadsheet imports** recognise Arabic, French and English column names. For books, only the title is
required; the usual columns are `الشفرة` (call number), `الـعنـوان` (title), `الـمؤلـف` (author) and
`عدد النسخ` (copies), exactly as in the library's inventory file.

---

## Configuration

**Frontend:** copy `.env.example` to `.env` only if the API is not served from the same origin. Leave
`VITE_API_URL` empty in the usual setup.

**Backend:** environment variables, all optional in development. The important ones in production:

| Variable | Purpose |
|---|---|
| `DJANGO_DEBUG` | `1` only for local development (`manage.py` defaults to it) |
| `DJANGO_SECRET_KEY` | long random value, **required in production** |
| `DJANGO_ALLOWED_HOSTS` | the API's host names, **required in production** |
| `DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | PostgreSQL connection |
| `FRONTEND_URL` | the site's address, used in email links and card QR codes |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` | SMTP for verification, password reset and reminder emails |
| `LIBRARY_TIME_ZONE` | e.g. `Africa/Algiers`, for dates written in emails |
| `LIBRARY_NAME` | overrides the library's name in emails and PDFs |

The complete list, with defaults, is in [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Deployment

Short version (details in [`DEPLOYMENT.md`](DEPLOYMENT.md)):

1. **Backend:** set the environment variables above, then
   ```bash
   pip install -r backend/requirements.txt
   python backend/manage.py migrate
   python backend/manage.py collectstatic --noinput
   python backend/manage.py load_inventory
   python backend/manage.py create_admin --email … --name "…"
   ```
   Serve with `gunicorn config.wsgi -b 0.0.0.0:8000` (from `backend/`) behind a reverse proxy with HTTPS,
   with PostgreSQL and a persistent `backend/media/` folder.
2. **Scheduled jobs:** add the three commands to cron (hourly, nightly, morning).
3. **Frontend:** `npm ci && npm run build`, then serve `dist/` from the **same origin** as the API, with
   `/api` and `/media` proxied to Django and unknown paths served `index.html`. On Vercel, add the `/api` and
   `/media` rewrites described in `DEPLOYMENT.md` to `vercel.json`.
4. **Email:** configure SMTP before launch; readers cannot borrow until they confirm their email address.

---

## Backups and maintenance

- **Settings → Data and maintenance → Download a backup** saves one JSON file with every account, the
  catalogue, all requests and loans, the rules and the activity log. *Restore a backup* replaces everything
  with such a file (it must contain an active administrator).
- Book covers and site photographs are **not** in that file: back up `backend/media/` too, and take regular
  database dumps on the server (`pg_dump`).
- *Reload the catalogue* re-applies the inventory file: new titles are added and existing ones updated.
- *Reset circulation*, *Clear the activity log*, *Delete all reader accounts* and *Delete the whole catalogue*
  cannot be undone; download a backup first.

---

## Project structure

```
backend/
  config/                      Django settings and URLs
  library/
    models.py                  books, categories, profiles, requests, waiting lists, notifications, settings
    services.py                the borrowing state machine and the scheduled jobs
    views.py, urls.py          the REST API (/api/...)
    serializers.py, filters.py API shapes and list filters
    permissions.py             role checks
    importing.py               book import rules; catalogue.py  subjects from call numbers, the inventory file
    student_import.py          reader import; exports.py  CSV / Excel exports
    maintenance.py             backup, restore, resets and deletions
    emails.py                  all emails, in Arabic, French and English
    documents.py, idcard.py    receipt and library card PDFs; pdftext.py  Arabic text in PDFs
    data/inventory.csv         the library inventory
    assets/                    seals and fonts used in the PDFs
    management/commands/       the commands listed above
    test_*.py, tests.py        backend tests
src/
  pages/                       landing, sign-in, sign-up, catalogue, book, my loans, profile
  pages/staff/                 the staff desk (one page per function)
  components/                  shared components (ui/ holds the shadcn/ui primitives)
  api/                         API client, endpoints and query keys
  i18n/index.tsx               Arabic, French and English texts
  lib/                         dates, errors, imports, photographs
public/brand/, public/images/  the seals and the building photographs
```

More for developers: [`AGENTS.md`](AGENTS.md) (conventions and business rules) and
[`DESIGN.md`](DESIGN.md) (colours, type, seals, layout).

---

## Tests and checks

```bash
# backend
cd backend && python manage.py test library

# frontend (from the repository root)
npm run lint
node scripts/check-i18n.mjs     # the three languages have the same keys
npm run build
```

Continuous integration (`.github/workflows/ci.yml`) runs all of these, the backend tests also on PostgreSQL,
plus a missing-migrations check and Django's production `check --deploy`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| The site loads but nothing appears / sign-in fails | Django is not running on port 8000, or `/api` is not proxied to it in production. |
| "Sign-in failed" for a correct password | The account is deactivated, or it was created without a password and the person has not set one yet ("Forgot password?" sends a new link). |
| A reader cannot request books | They have not confirmed their email, they have an overdue loan, or they reached their borrow limit. |
| The catalogue is empty | Run `python manage.py load_inventory`, or Settings → Data and maintenance → Reload the catalogue. |
| No emails arrive | In development they are printed in the Django terminal; in production set the `EMAIL_*` variables. |
| Holds never expire / no overdue marks | The scheduled jobs are not in cron; run them or use *Run the scheduled checks*. |
