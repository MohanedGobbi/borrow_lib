# Installing the library system on a Linux server or PC

A step-by-step guide, from an empty machine to a working site. It uses the scripts in
[`deploy/`](deploy/); [`DEPLOYMENT.md`](DEPLOYMENT.md) is the reference for every setting.

**Contents**

1. [What you get](#1-what-you-get)
2. [What you need](#2-what-you-need)
3. [Install on a server with a domain name (HTTPS)](#3-install-on-a-server-with-a-domain-name-https)
4. [Install on a PC or a private network (no domain, no certificate)](#4-install-on-a-pc-or-a-private-network-no-domain-no-certificate)
5. [Only trying it out on a Linux PC (no install)](#5-only-trying-it-out-on-a-linux-pc-no-install)
6. [First steps in the site](#6-first-steps-in-the-site)
7. [Email](#7-email)
8. [Everyday operation](#8-everyday-operation)
9. [Updating to a new version](#9-updating-to-a-new-version)
10. [Backups and restoring](#10-backups-and-restoring)
11. [Moving an existing installation (from Windows, say)](#11-moving-an-existing-installation-from-windows-say)
12. [Installing by hand (other distributions)](#12-installing-by-hand-other-distributions)
13. [Security checklist](#13-security-checklist)
14. [Troubleshooting](#14-troubleshooting)

---

> **Installing at an institution without Git or Node.js?** Build the installation folder on your own
> computer with `python scripts/make_release.py` (it runs `npm run build` first). It writes
> `university-package/1-Installation/`: the code with the site already built, a checksum, and the
> scripts from `deploy/package/`: `install.sh` (asks a few questions, including whether to update itself from GitHub, and runs `deploy/install.sh --skip-build`),
> `update.sh` (installs a newer archive over the running one and keeps `/opt/lib-borrow.previous`),
> `status.sh` (health check) and `send-to-server.bat` (copies the folder from Windows over SSH and runs
> one of them). Copy that folder to the server and run `sudo bash install.sh`. The rest of this guide
> still applies.

## 1. What you get

```
 browser ──► nginx (port 80/443)
               ├── /            the built React site (dist/)
               ├── /media/      uploaded covers and site photographs
               ├── /static/     admin-site assets
               └── /api/, /admin/ ──► gunicorn (127.0.0.1:8000) ──► PostgreSQL
 cron: hourly / nightly / morning library jobs, weekly token cleanup, nightly backup
```

Everything is one origin (one address), which the sign-in cookie needs. The installer sets up:

| What | Where |
|---|---|
| The code (this repository) | wherever you cloned it, e.g. `/opt/lib-borrow` |
| Settings and secrets | `/etc/lib-borrow/lib-borrow.env` |
| Uploads, admin assets (and the SQLite file, if you chose SQLite) | `/var/lib/lib-borrow/` |
| The website process | systemd service `lib-borrow`, running as the unprivileged user `libborrow` |
| The web server | nginx site `/etc/nginx/sites-available/lib-borrow` |
| Scheduled jobs | `/etc/cron.d/lib-borrow` |
| Backups | `/var/backups/lib-borrow/` (nightly, last 14 kept) |
| Database | PostgreSQL database `library`, owned by the `libborrow` user (no password: local socket) |

## 2. What you need

- **Ubuntu 24.04 LTS** (recommended), Ubuntu 22.04 with Python 3.12 added, or **Debian 13**. The
  installer uses `apt`. (Other systems: [section 12](#12-installing-by-hand-other-distributions).)
- **Python 3.12 or newer.** Ubuntu 24.04 and Debian 13 have it. Ubuntu 22.04 and Debian 12 do not.
- **2 GB of RAM** (1 GB works if you add swap, or build the site on another machine and copy `dist/`).
  About 5 GB of disk.
- Root access (`sudo`) and internet access during the install.
- For HTTPS: a **domain name** (e.g. `library.univ-ghardaia.dz`) pointing at the server's public IP, and
  ports **80 and 443** reachable from the internet. If the faculty's IT department manages the network,
  ask them for the domain and these two open ports.

## 3. Install on a server with a domain name (HTTPS)

### 3.1 Prepare the server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git rsync
sudo timedatectl set-timezone Africa/Algiers     # the scheduled jobs run on the server's clock
```

### 3.2 Get the code

The project must live outside `/home` and `/root` (the web server cannot read those). Use `/opt`:

```bash
sudo git clone <your-repository-url> /opt/lib-borrow
cd /opt/lib-borrow
```

No Git hosting? Copy the folder from your computer instead, leaving out `node_modules`, `dist`,
`backend/.venv`, `backend/db.sqlite3` and `backend/media`:

```bash
# from your computer
rsync -av --exclude node_modules --exclude dist --exclude .venv --exclude db.sqlite3 \
      --exclude backend/media --exclude .git  ./  you@server:/tmp/lib-borrow/
# then on the server
sudo mv /tmp/lib-borrow /opt/lib-borrow
```

### 3.3 Run the installer

```bash
cd /opt/lib-borrow
sudo bash deploy/install.sh --domain library.univ-ghardaia.dz --certbot-email it@univ-ghardaia.dz
```

What it does, in order (about 5–10 minutes, mostly the site build):

1. installs Python tooling, nginx, PostgreSQL, certbot and (if needed) Node.js 22;
2. creates the `libborrow` user and the data directories;
3. creates the Python environment and installs the pinned dependencies;
4. writes `/etc/lib-borrow/lib-borrow.env` with a **freshly generated secret key** (an existing file is never touched);
5. creates the PostgreSQL database;
6. builds the website, creates the tables, collects static files, loads the library's catalogue (4,487 titles);
7. installs the systemd service, the nginx site and the cron jobs, and opens ports 80/443 if `ufw` is active;
8. requests the certificate, then checks that the site answers;
9. offers to create the first administrator (asks for email, name, phone and a password).

Useful options (`sudo bash deploy/install.sh --help` lists them all):

| Option | Meaning |
|---|---|
| `--domain a.edu,b.edu` | every name the site answers to; the **first** is the address in emails and card QR codes |
| `--certbot-email EMAIL` | get a Let's Encrypt certificate (renews itself) |
| `--sqlite` | SQLite instead of PostgreSQL. Fine for a trial; for real use prefer PostgreSQL, which enforces the row locks the borrowing rules rely on |
| `--skip-build` | use an existing `dist/` (built elsewhere) |
| `--no-inventory` | do not load the bundled catalogue |
| `--timezone Africa/Algiers` | time zone for dates written in emails |
| `--yes` | no questions (the administrator is then created by hand, see below) |

The installer is **safe to run again** if something failed halfway.

### 3.4 Create the administrator (if the installer did not)

```bash
sudo -u libborrow /opt/lib-borrow/deploy/manage.sh create_admin \
     --email admin@univ-ghardaia.dz --name "Full Name" --phone 0661000000
```

It asks for the password (8+ characters, not too common).

### 3.5 Open the site

Go to `https://library.univ-ghardaia.dz` and sign in. Then continue with
[First steps](#6-first-steps-in-the-site) and set up [email](#7-email).

If the certificate step failed (the domain did not point at the server yet), fix DNS and run:

```bash
sudo certbot --nginx -d library.univ-ghardaia.dz
```

When HTTPS works, you can raise the browser-enforced HTTPS period: in
`/etc/lib-borrow/lib-borrow.env` uncomment `DJANGO_HSTS_SECONDS=31536000`, then
`sudo systemctl restart lib-borrow`.

## 4. Install on a PC or a private network (no domain, no certificate)

For a trial on the faculty network, or a PC at the circulation desk. Find the machine's address:

```bash
hostname -I          # e.g. 192.168.1.50
```

Install with `--http-only`, giving that address (and `localhost` if you also browse from the machine itself):

```bash
cd /opt/lib-borrow
sudo bash deploy/install.sh --domain 192.168.1.50,localhost --http-only
```

Other computers on the network open `http://192.168.1.50`. Notes:

- The **first** name in `--domain` is what library cards' QR codes point to, so put the address
  people will really use first. Give the PC a fixed IP address (or a name in your local DNS), otherwise
  the cards break when the address changes.
- `--http-only` turns off the HTTPS-only protections (secure cookies, the redirect). Use it **only on a
  private network**, never on a public site. Passwords travel unencrypted.
- To move to HTTPS later: get a domain, run `sudo certbot --nginx -d your.domain`, delete the
  `DJANGO_ALLOW_HTTP=1` line from `/etc/lib-borrow/lib-borrow.env`, set `FRONTEND_URL` and
  `CSRF_TRUSTED_ORIGINS` to the `https://` address, add the domain to `DJANGO_ALLOWED_HOSTS`, and restart.

## 5. Only trying it out on a Linux PC (no install)

For development or a quick look, nothing needs installing system-wide. You need Python 3.12+ and Node.js 22+.

```bash
# terminal 1: the API on port 8000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py load_inventory
python manage.py create_admin --email admin@example.edu --name "Test Admin"
python manage.py runserver 8000

# terminal 2: the site on port 3000
npm install
npm run dev
```

Open <http://localhost:3000>. Emails are printed in terminal 1 instead of being sent.

## 6. First steps in the site

1. Sign in with the administrator account.
2. **Staff desk → Readers → Create account** to add librarians (`Librarian`) and readers. Readers can also
   register themselves at `/signup`, but must confirm their email address before borrowing, so set up
   [email](#7-email) first. Accounts you create with a password work immediately.
3. **Staff desk → Library rules**: pickup window (48 h), loan length (14 days), renewals, borrow limits.
4. Books: the catalogue is already loaded. Add or import more under **Inventory**
   (Excel, CSV or JSON), or from the command line (below).

From the command line, as the service user:

```bash
M="sudo -u libborrow /opt/lib-borrow/deploy/manage.sh"
$M import_books /tmp/catalogue.xlsx --dry-run        # report only
$M import_books /tmp/catalogue.xlsx                  # add new books
$M import_students /tmp/students.xlsx --dry-run      # reader accounts, each gets a welcome email
```

(The file must be readable by the `libborrow` user: put it in `/tmp` and `chmod a+r` it.)

## 7. Email

Self-registered readers confirm their address by email, and anyone can reset a forgotten password by email.
Without SMTP those emails cannot be sent; accounts created by staff still work.

Edit `/etc/lib-borrow/lib-borrow.env` (`sudo nano …`), uncomment and fill the `EMAIL_*` lines:

```ini
EMAIL_HOST=smtp.univ-ghardaia.dz
EMAIL_PORT=587
EMAIL_HOST_USER=library@univ-ghardaia.dz
EMAIL_HOST_PASSWORD=the-password
EMAIL_USE_TLS=1
DEFAULT_FROM_EMAIL="Faculty Library <library@univ-ghardaia.dz>"
```

Then restart and send a test message:

```bash
sudo systemctl restart lib-borrow
sudo -u libborrow /opt/lib-borrow/deploy/manage.sh sendtestemail you@example.com
```

(With Gmail: host `smtp.gmail.com`, port 587, and an *app password*, not the account password.)
Quote any value that contains spaces with double quotes.

## 8. Everyday operation

```bash
sudo systemctl status lib-borrow            # is it running?
sudo systemctl restart lib-borrow           # after editing /etc/lib-borrow/lib-borrow.env
journalctl -u lib-borrow -f                 # live website log (Ctrl-C to leave)
journalctl -t lib-borrow-jobs --since today # the scheduled jobs
sudo systemctl reload nginx                 # after editing the nginx site
sudo nginx -t                               # check an nginx edit before reloading
```

Run any management command with the production settings:

```bash
sudo -u libborrow /opt/lib-borrow/deploy/manage.sh <command>
#   create_admin, load_inventory, import_books, import_students, mark_overdue, shell, …
```

The scheduled jobs (in `/etc/cron.d/lib-borrow`): `cancel_expired_pickups` hourly, `mark_overdue` at 00:11,
`send_reminders` at 08:00, `flushexpiredtokens` weekly, `backup.sh` at 02:30. Librarians can also run the
three library jobs by hand from the staff desk.

Server reboot: PostgreSQL, the `lib-borrow` service, nginx and cron all start on their own.

## 9. Updating to a new version

```bash
cd /opt/lib-borrow
git pull
sudo bash deploy/update.sh
```

`update.sh` takes a backup first, updates the dependencies, rebuilds the site, applies database
migrations and restarts the service. If the nginx or systemd templates in `deploy/` changed, run
`sudo bash deploy/install.sh --domain <same domain> [same options]` again; it keeps your settings.

### Automatic updates from GitHub

For a server nobody can log in to after the installation: it checks GitHub for a new **release**
every night (03:30, after the backup) and installs it on its own. Switch it on during the installation
(the offline installer asks; otherwise add `--auto-update MohanedGobbi/borrow_lib` to `install.sh`).
The server needs outgoing HTTPS to `api.github.com`, `github.com` and `*.githubusercontent.com`, and
to PyPI for the Python packages.

**Publishing a version** (from the development machine). Only releases are installed, never ordinary
pushes, so work in progress on `main` stays on GitHub until you release it:

```bash
npm version patch        # or minor / major: bumps package.json, commits, tags v1.0.1
git push --follow-tags
```

The tag starts `.github/workflows/release.yml`: it runs the tests, builds the server package and
publishes it as a GitHub release. If the tests fail, nothing is published.

**On the server, each night** `deploy/auto-update.sh`:

1. compares the latest release with the installed version and stops if it is not newer;
2. downloads the package and checks its SHA-256 checksum;
3. takes a backup, switches to the new version (the old one stays in `/opt/lib-borrow.previous`),
   installs dependencies, migrates the database and restarts;
4. if the new version does not start, puts the previous version **and the database from that backup**
   back, keeps the broken copy in `/opt/lib-borrow.failed`, and skips that release until a newer one
   is published. Fix the problem and publish the next version.

**From the site.** Administrators see the installed version, the latest release and the result of the last
check under Settings → **Software updates**, with a **Check for updates now** button (it asks for their
password). The site never runs anything as root: the button only creates
`/var/lib/lib-borrow/update-request/requested`, and the `lib-borrow-update.path` unit starts the update
script when that file appears. The script reports its progress in `/var/lib/lib-borrow-update/status.json`,
which the page reads.

| | |
|---|---|
| Check now | Settings → Software updates → Check for updates now, or `sudo systemctl start lib-borrow-update` |
| What it did | `journalctl -u lib-borrow-update`, and `/var/lib/lib-borrow-update/history` |
| When it next runs | `systemctl list-timers lib-borrow-update.timer` |
| Switch off | `sudo bash deploy/install.sh --domain <same domain> --no-auto-update` (or delete `/etc/lib-borrow/auto-update.env`) |
| Private repository | add a read-only token (`GITHUB_TOKEN=`) to `/etc/lib-borrow/auto-update.env` |

Whoever can publish a release on that GitHub repository can change what runs on this server: keep
two-factor authentication on the GitHub account.

## 10. Backups and restoring

**Automatic.** Every night at 02:30 `deploy/backup.sh` writes
`/var/backups/lib-borrow/lib-borrow-YYYYMMDD-HHMMSS.tar.gz` containing the database, the uploaded
files and the settings file; the 14 newest are kept. Run it by hand any time with
`sudo bash /opt/lib-borrow/deploy/backup.sh`.

**Copy them off the machine.** A backup on the same disk does not survive a dead disk. From another computer:

```bash
rsync -av root@server:/var/backups/lib-borrow/ ~/library-backups/
```

The archives contain the secret key and every member's data: store them privately.

**The site's own backup** (Settings → Data and maintenance → Download a backup) is a JSON file you can
restore from the same page. It does not include uploaded photographs; the archive above does.

**Restore a server backup** (PostgreSQL):

```bash
sudo systemctl stop lib-borrow
sudo mkdir /tmp/restore && sudo tar -xzf /var/backups/lib-borrow/lib-borrow-XXXX.tar.gz -C /tmp/restore
cd /tmp/restore/lib-borrow-XXXX
sudo -u postgres dropdb library
sudo -u postgres createdb -O libborrow -E UTF8 library
sudo -u libborrow pg_restore --no-owner -d library database.dump
sudo rsync -a --delete media/ /var/lib/lib-borrow/media/
sudo chown -R libborrow:libborrow /var/lib/lib-borrow/media
sudo systemctl start lib-borrow
```

With SQLite instead: copy `db.sqlite3` from the archive to `/var/lib/lib-borrow/db/db.sqlite3` and
`sudo chown libborrow:libborrow` it. To rebuild a lost server, install first (section 3), then restore
into it; copy the old `lib-borrow.env` back too if you want people to stay signed in.

## 11. Moving an existing installation (from Windows, say)

1. On the **old** site, as an administrator: Settings → Data and maintenance → **Download a backup**.
2. Copy the old `backend/media/` folder (book covers, site photographs) to the new server:
   `rsync -av backend/media/ you@server:/tmp/media/`.
3. Install on the new server (section 3) with `--no-inventory` (the catalogue comes with the backup) and
   create a temporary administrator when the installer asks.
4. Move the files into place:
   `sudo rsync -a /tmp/media/ /var/lib/lib-borrow/media/ && sudo chown -R libborrow:libborrow /var/lib/lib-borrow/media`.
5. Sign in, Settings → Data and maintenance → **Restore a backup**, upload the JSON file. Everything,
   accounts included, is replaced by the old site's data; sign in again with your old administrator account.

## 12. Installing by hand (other distributions)

`deploy/install.sh` is a plain script; read it as the checklist. On Fedora, Rocky, Arch and so on, do
the same steps with your package manager:

1. Install Python 3.12+, Node.js 22+, nginx, PostgreSQL (and `certbot` for HTTPS).
2. Create a system user `libborrow`, and the directories `/var/lib/lib-borrow/{media,static,db}`.
3. `python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt`
4. Write `/etc/lib-borrow/lib-borrow.env` (mode 640, group `libborrow`) with at least
   `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` (`python -c "import secrets; print(secrets.token_urlsafe(64))"`),
   `DJANGO_ALLOWED_HOSTS`, `DJANGO_NUM_PROXIES=1`, `FRONTEND_URL`, `CSRF_TRUSTED_ORIGINS`,
   `DJANGO_MEDIA_ROOT`, `DJANGO_STATIC_ROOT`, and the `DB_*` variables.
5. As `libborrow`: `deploy/manage.sh migrate`, `collectstatic --noinput`, `load_inventory`, `create_admin …`.
6. `npm ci && npm run build`.
7. Copy `deploy/lib-borrow.service`, `deploy/nginx.conf` and `deploy/lib-borrow.cron` into place,
   replacing the `@APP_DIR@`, `@DATA_DIR@`, `@WORKERS@` and `@SERVER_NAMES@` markers. On distributions
   without `sites-available`, put the nginx file in `/etc/nginx/conf.d/lib-borrow.conf`. On SELinux
   systems, allow nginx to read the project (`httpd_sys_content_t`) and to connect to gunicorn.
8. `systemctl enable --now lib-borrow nginx`.

## 13. Security checklist

- [ ] HTTPS works and `DJANGO_ALLOW_HTTP` is **not** set (public sites).
- [ ] `/etc/lib-borrow/lib-borrow.env` is readable only by root and `libborrow` (the installer does this); never commit it.
- [ ] The administrator's password is long and unique.
- [ ] Only ports 22, 80 and 443 are open (`sudo ufw allow OpenSSH && sudo ufw enable`, *then* the installer opens 80/443).
      PostgreSQL listens on the local socket only; gunicorn on `127.0.0.1:8000` only.
- [ ] SSH keys instead of passwords, and automatic security updates: `sudo apt install unattended-upgrades`.
- [ ] Backups are copied off the machine, and you have tried restoring one.
- [ ] Behind Cloudflare or another proxy in front of nginx? Set `DJANGO_NUM_PROXIES=2` so rate limits see the real visitor.

## 14. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Installer: "Python 3.12 or newer is required" | Older distribution. Use Ubuntu 24.04, or add Python 3.12 (Ubuntu 22.04: the `deadsnakes` PPA, `python3.12 python3.12-venv`). |
| Installer: "under /home" | Move the project to `/opt/lib-borrow` and run again. |
| Site build is killed / "Killed" | Out of memory. Add swap (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) and run `sudo bash deploy/update.sh`, or build on another machine and copy `dist/` over with `--skip-build`. |
| Browser shows "502 Bad Gateway" | gunicorn is not running: `journalctl -u lib-borrow -n 50`. Usually a bad value in `/etc/lib-borrow/lib-borrow.env`; the message names it. |
| "Bad Request (400)" | The address you typed is not in `DJANGO_ALLOWED_HOSTS`. Add it and restart. |
| Signed out on every reload | You are on plain HTTP without `DJANGO_ALLOW_HTTP=1`, or the site is reached through two different addresses. Use HTTPS, or the `--http-only` install on a private network. |
| Admin site (`/admin/`) form says "CSRF verification failed" | Put the exact `https://domain` in `CSRF_TRUSTED_ORIGINS`. |
| Port 80 already in use | Another web server (Apache) is running: `sudo systemctl disable --now apache2`, then `sudo systemctl restart nginx`. |
| Pages load but covers or photos are missing | `sudo ls -l /var/lib/lib-borrow/media` should be owned by `libborrow` and world-readable; `sudo nginx -t`. |
| Certificate step failed | The domain must resolve to this server and port 80 must be reachable. Then `sudo certbot --nginx -d your.domain`. |
| Verification / reset emails never arrive | [Section 7](#7-email); check `journalctl -u lib-borrow` for the SMTP error. |
| Holds never expire, loans never become overdue | `cat /etc/cron.d/lib-borrow`, `systemctl status cron`, `journalctl -t lib-borrow-jobs`. |
| Everything was fine, now "database does not exist" | PostgreSQL was reinstalled or data removed. Restore a backup ([section 10](#10-backups-and-restoring)). |
