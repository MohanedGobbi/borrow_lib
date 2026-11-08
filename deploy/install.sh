#!/usr/bin/env bash
# Installs the library borrowing system on Ubuntu or Debian: PostgreSQL, gunicorn under systemd,
# nginx, the scheduled jobs and a nightly backup. Safe to run again (it keeps your settings file).
#
#   sudo bash deploy/install.sh --domain library.univ-ghardaia.dz --certbot-email it@univ-ghardaia.dz
#   sudo bash deploy/install.sh --domain 192.168.1.50 --http-only        # network trial, no certificate
#
# Options
#   --domain A[,B…]        host names or IP addresses the site answers to; the first one is the
#                          address printed in emails and on library cards (required)
#   --http-only            serve plain HTTP (no certificate). For a trial on a private network only
#   --certbot-email EMAIL  also get a free Let's Encrypt certificate (the domain must point here)
#   --sqlite               use SQLite instead of PostgreSQL (small trials; PostgreSQL is advised)
#   --timezone ZONE        IANA zone for dates in emails        (default Africa/Algiers)
#   --workers N            gunicorn workers                     (default 2 x CPUs + 1, at most 5)
#   --skip-build           do not build the site (dist/ is already there)
#   --no-inventory         do not load the library's catalogue
#   --auto-update OWNER/REPO  install new releases of that GitHub repository every night on their
#                          own (deploy/auto-update.sh); kept when the installer runs again
#   --no-auto-update       switch automatic updates off
#   --yes                  never ask questions (no first administrator is created)
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

DOMAINS=""; HTTP_ONLY=0; CERTBOT_EMAIL=""; USE_SQLITE=0; TIMEZONE="Africa/Algiers"
WORKERS=""; SKIP_BUILD=0; LOAD_INVENTORY=1; ASSUME_YES=0; AUTO_UPDATE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --domain)         DOMAINS="${2:?--domain needs a value}"; shift 2 ;;
    --http-only)      HTTP_ONLY=1; shift ;;
    --certbot-email)  CERTBOT_EMAIL="${2:?--certbot-email needs a value}"; shift 2 ;;
    --sqlite)         USE_SQLITE=1; shift ;;
    --timezone)       TIMEZONE="${2:?--timezone needs a value}"; shift 2 ;;
    --workers)        WORKERS="${2:?--workers needs a value}"; shift 2 ;;
    --skip-build)     SKIP_BUILD=1; shift ;;
    --no-inventory)   LOAD_INVENTORY=0; shift ;;
    --auto-update)    AUTO_UPDATE="${2:?--auto-update needs OWNER/REPO}"; shift 2 ;;
    --no-auto-update) AUTO_UPDATE="off"; shift ;;
    --yes|-y)         ASSUME_YES=1; shift ;;
    -h|--help)        sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)                die "Unknown option: $1 (see --help)" ;;
  esac
done

require_root "$@"

# The questions read the terminal through fd 3; everything else reads nothing, so apt, pip
# and npm cannot swallow answers typed ahead.
exec 3<&0 </dev/null

interactive() { [ "$ASSUME_YES" -eq 0 ] && [ -t 3 ]; }
ask_yes() {  # ask_yes "question" → true when the answer is yes (default yes)
  interactive || return 0
  local a; read -r -p "$1 [Y/n] " a <&3; [[ ! "$a" =~ ^[Nn] ]]
}

# ------------------------------------------------------------------ checks
[ -f "$APP_DIR/backend/manage.py" ] || die "Run this from a checkout of the project (backend/manage.py not found)."
command -v apt-get >/dev/null || die "This installer supports Ubuntu and Debian (apt). See INSTALL-LINUX.md for other systems."
case "$APP_DIR" in
  *" "*)         die "The project path ($APP_DIR) must not contain spaces." ;;
  /home/*|/root/*) die "The project is under $(echo "$APP_DIR" | cut -d/ -f2): the web server cannot read it there. Move it, e.g. to /opt/lib-borrow, and run again." ;;
esac
if [ -z "$DOMAINS" ]; then
  interactive || die "--domain is required (the host name or IP address people will type in the browser)."
  read -r -p "Host name or IP address of this server (e.g. library.univ-ghardaia.dz): " DOMAINS <&3
  [ -n "$DOMAINS" ] || die "A domain or IP address is required."
fi
if [ -n "$CERTBOT_EMAIL" ] && [ "$HTTP_ONLY" -eq 1 ]; then die "--certbot-email and --http-only exclude each other."; fi
if [ -n "$AUTO_UPDATE" ] && [ "$AUTO_UPDATE" != off ]; then
  [[ "$AUTO_UPDATE" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "--auto-update takes the GitHub repository as OWNER/NAME."
  [ "$APP_DIR" = /opt/lib-borrow ] || die "Automatic updates need the installation in /opt/lib-borrow (it is in $APP_DIR)."
fi
if [ -z "$WORKERS" ]; then
  WORKERS=$(( 2 * $(nproc) + 1 )); [ "$WORKERS" -le 5 ] || WORKERS=5
fi
IFS=',' read -r -a DOMAIN_LIST <<< "$DOMAINS"
FIRST_DOMAIN="${DOMAIN_LIST[0]}"
SERVER_NAMES="${DOMAINS//,/ }"
SCHEME=https; [ "$HTTP_ONLY" -eq 1 ] && SCHEME=http
SITE_URL="$SCHEME://$FIRST_DOMAIN"

chmod +x "$APP_DIR"/deploy/*.sh
export DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------------ system packages
log "Installing system packages"
PACKAGES=(python3 python3-venv python3-pip nginx cron curl ca-certificates rsync)
[ "$USE_SQLITE" -eq 1 ] || PACKAGES+=(postgresql)
[ -z "$CERTBOT_EMAIL" ] || PACKAGES+=(certbot python3-certbot-nginx)
apt-get update -qq
apt-get install -y -qq "${PACKAGES[@]}"

PY=""
for candidate in python3.13 python3.12 python3; do
  if command -v "$candidate" >/dev/null && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 12))'; then
    PY="$(command -v "$candidate")"; break
  fi
done
[ -n "$PY" ] || die "Python 3.12 or newer is required (found $(python3 -V 2>&1)). Use Ubuntu 24.04 / Debian 13, or install Python 3.12 (INSTALL-LINUX.md)."

node_ok() { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; }
if [ "$SKIP_BUILD" -eq 0 ] && ! node_ok; then
  log "Node.js 22 is needed to build the site; adding the NodeSource repository"
  ask_yes "Install Node.js 22 from deb.nodesource.com?" || die "Install Node.js 22 yourself, or build elsewhere and use --skip-build."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

# ------------------------------------------------------------------ user and directories
log "Preparing the service user and data directories"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$DATA_DIR" "$DATA_DIR/media" "$DATA_DIR/static"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$DATA_DIR/db"
install -d -m 750 -o root -g "$APP_USER" "$ENV_DIR"
install -d -m 700 "$BACKUP_DIR"

# ------------------------------------------------------------------ python environment
log "Creating the Python environment (this takes a minute)"
[ -x "$VENV/bin/python" ] || "$PY" -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"
"$VENV/bin/python" -m compileall -q "$APP_DIR/backend/config" "$APP_DIR/backend/library"
chmod -R a+rX "$APP_DIR/backend" "$APP_DIR/deploy"

# ------------------------------------------------------------------ settings file
if [ -e "$ENV_FILE" ]; then
  log "Keeping the existing settings in $ENV_FILE"
else
  log "Writing $ENV_FILE"
  SECRET="$("$PY" -c 'import secrets; print(secrets.token_urlsafe(64))')"
  ORIGINS=""; HOSTS=""
  for d in "${DOMAIN_LIST[@]}" localhost 127.0.0.1; do
    case ",$HOSTS," in *",$d,"*) continue ;; esac   # each name once
    HOSTS+="${HOSTS:+,}$d"
  done
  for d in "${DOMAIN_LIST[@]}"; do ORIGINS+="${ORIGINS:+,}$SCHEME://$d"; done
  install -m 640 -o root -g "$APP_USER" /dev/null "$ENV_FILE"   # permissions first, secrets after
  {
    cat <<EOF
# Library borrowing system: production settings, read by systemd and deploy/manage.sh.
# Values with spaces need double quotes. After editing: sudo systemctl restart $SERVICE
# Every variable is explained in DEPLOYMENT.md.
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=$SECRET
DJANGO_ALLOWED_HOSTS=$HOSTS
DJANGO_NUM_PROXIES=1
FRONTEND_URL=$SITE_URL
CSRF_TRUSTED_ORIGINS=$ORIGINS
DJANGO_MEDIA_ROOT=$DATA_DIR/media
DJANGO_STATIC_ROOT=$DATA_DIR/static
LIBRARY_TIME_ZONE=$TIMEZONE
#LIBRARY_NAME="Faculty of Law and Political Sciences Library"
# Open sign-up accepts only these email domains (and their subdomains); empty accepts any address.
#REGISTRATION_EMAIL_DOMAINS=univ-ghardaia.dz

EOF
    if [ "$USE_SQLITE" -eq 1 ]; then
      echo "# Database: SQLite file (switch to PostgreSQL later by setting the DB_* variables)"
      echo "DB_NAME=$DATA_DIR/db/db.sqlite3"
    else
      echo "# Database: PostgreSQL over the local socket; the $APP_USER system user is the database user (no password)"
      echo "DB_ENGINE=django.db.backends.postgresql"
      echo "DB_NAME=library"
      echo "DB_USER=$APP_USER"
    fi
    echo
    if [ "$HTTP_ONLY" -eq 1 ]; then
      cat <<'EOF'
# Plain HTTP (no certificate): for a trial on a private network only.
# Remove this line once the site has a certificate, then restart.
DJANGO_ALLOW_HTTP=1
EOF
    else
      echo "# HTTPS. Once the certificate works, raise this to 31536000 (one year)."
      echo "#DJANGO_HSTS_SECONDS=31536000"
    fi
    cat <<EOF

# Email (verification, password reset, invitations, reminders). Without this, self-registered
# readers cannot confirm their address; accounts created at the desk still work.
#EMAIL_HOST=smtp.example.edu
#EMAIL_PORT=587
#EMAIL_HOST_USER=
#EMAIL_HOST_PASSWORD=
#EMAIL_USE_TLS=1
#DEFAULT_FROM_EMAIL="Faculty Library <library@example.edu>"
EOF
  } > "$ENV_FILE"
fi

# ------------------------------------------------------------------ database
if [ "$USE_SQLITE" -eq 0 ]; then
  log "Preparing PostgreSQL"
  systemctl enable --now postgresql >/dev/null 2>&1 || true
  pg() { (cd / && runuser -u postgres -- "$@"); }
  [ "$(pg psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$APP_USER'")" = 1 ] || pg createuser "$APP_USER"
  [ "$(pg psql -tAc "SELECT 1 FROM pg_database WHERE datname='library'")" = 1 ] || pg createdb -O "$APP_USER" -E UTF8 library
fi

# ------------------------------------------------------------------ the site
if [ "$SKIP_BUILD" -eq 0 ]; then
  log "Building the site (a few minutes)"
  build_frontend
else
  [ -f "$APP_DIR/dist/index.html" ] || die "--skip-build was given but $APP_DIR/dist/index.html does not exist."
  chmod -R a+rX "$APP_DIR/dist"
fi

log "Creating the database tables and collecting static files"
as_app "$APP_DIR/deploy/manage.sh" migrate --noinput
as_app "$APP_DIR/deploy/manage.sh" collectstatic --noinput
if [ "$LOAD_INVENTORY" -eq 1 ]; then
  log "Loading the library's catalogue"
  as_app "$APP_DIR/deploy/manage.sh" load_inventory
fi

# ------------------------------------------------------------------ services
render() {
  sed -e "s|@APP_DIR@|$APP_DIR|g" -e "s|@DATA_DIR@|$DATA_DIR|g" \
      -e "s|@WORKERS@|$WORKERS|g" -e "s|@SERVER_NAMES@|$SERVER_NAMES|g" "$1"
}

log "Installing the service, the web server configuration and the scheduled jobs"
render "$APP_DIR/deploy/lib-borrow.service" > "/etc/systemd/system/$SERVICE.service"
render "$APP_DIR/deploy/lib-borrow.cron"    > /etc/cron.d/lib-borrow
chmod 644 /etc/cron.d/lib-borrow
render "$APP_DIR/deploy/lib-borrow-update.service" > /etc/systemd/system/lib-borrow-update.service
render "$APP_DIR/deploy/lib-borrow-update.timer"   > /etc/systemd/system/lib-borrow-update.timer
render "$APP_DIR/deploy/lib-borrow-update.path"    > /etc/systemd/system/lib-borrow-update.path
UPDATE_CONF="$ENV_DIR/auto-update.env"
UPDATE_REQUEST_DIR="$DATA_DIR/update-request"   # the admin page's "Check now" drops a file here
if [ "$AUTO_UPDATE" = off ]; then
  rm -f "$UPDATE_CONF"
elif [ -n "$AUTO_UPDATE" ] && [ -e "$UPDATE_CONF" ]; then
  sed -i "s|^UPDATE_REPO=.*|UPDATE_REPO=$AUTO_UPDATE|" "$UPDATE_CONF"   # keeps a token, if one was added
elif [ -n "$AUTO_UPDATE" ]; then
  install -m 600 -o root -g root /dev/null "$UPDATE_CONF"
  cat > "$UPDATE_CONF" <<EOF
# Automatic updates (deploy/auto-update.sh): every night the server installs the newest release
# of this GitHub repository, if it is newer than the one running. Remove this file to stop them.
UPDATE_REPO=$AUTO_UPDATE
# Only for a private repository: a read-only token (fine-grained, "Contents: read").
#GITHUB_TOKEN=
EOF
fi
if [ ! -e /etc/nginx/sites-available/lib-borrow ] || ! grep -q 'listen 443' /etc/nginx/sites-available/lib-borrow; then
  # Not yet touched by certbot: safe to (re)write.
  render "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/lib-borrow
else
  warn "nginx site already has TLS from certbot: left unchanged."
fi
ln -sf /etc/nginx/sites-available/lib-borrow /etc/nginx/sites-enabled/lib-borrow
rm -f /etc/nginx/sites-enabled/default      # it would also claim port 80 as the default server

systemctl daemon-reload
systemctl enable --now cron >/dev/null 2>&1 || warn "Could not start cron: the scheduled jobs will not run (systemctl status cron)."
systemctl enable "$SERVICE" >/dev/null
if [ -e "$UPDATE_CONF" ]; then
  install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$UPDATE_REQUEST_DIR"
  systemctl enable --now lib-borrow-update.timer lib-borrow-update.path >/dev/null 2>&1 \
    || warn "Could not start the automatic updates (systemctl status lib-borrow-update.timer lib-borrow-update.path)."
else
  systemctl disable --now lib-borrow-update.timer lib-borrow-update.path >/dev/null 2>&1 || true
  rm -rf "$UPDATE_REQUEST_DIR"   # the admin page then shows that updates are off
fi
systemctl restart "$SERVICE"
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload-or-restart nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  log "Opening ports 80 and 443 in the firewall (ufw)"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

if [ -n "$CERTBOT_EMAIL" ]; then
  log "Requesting a certificate"
  CERT_ARGS=(); for d in "${DOMAIN_LIST[@]}"; do CERT_ARGS+=(-d "$d"); done
  certbot --nginx --non-interactive --agree-tos --redirect -m "$CERTBOT_EMAIL" "${CERT_ARGS[@]}" \
    || warn "certbot failed (does $FIRST_DOMAIN point at this server, and is port 80 reachable?). Fix that and run: sudo certbot --nginx -d $FIRST_DOMAIN"
fi

# ------------------------------------------------------------------ check
log "Checking that it answers"
api=000
for _ in $(seq 1 20); do
  api="$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Proto: https' -H "Host: $FIRST_DOMAIN" http://127.0.0.1:8000/api/books || true)"
  [ "$api" = 200 ] && break; sleep 1
done
page="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $FIRST_DOMAIN" http://127.0.0.1/ || true)"
[ "$api" = 200 ] || warn "The API answered $api (expected 200): journalctl -u $SERVICE -n 50"
[ "$page" = 200 ] || [ "$page" = 301 ] || warn "nginx answered $page for the home page (expected 200)."
[ "$api" = 200 ] && log "The API and the web server are up."

# ------------------------------------------------------------------ first administrator
if interactive; then
  if ask_yes "Create the first administrator account now?"; then
    read -r -p "  Email: " ADMIN_EMAIL <&3
    read -r -p "  Full name: " ADMIN_NAME <&3
    read -r -p "  Phone (optional): " ADMIN_PHONE <&3
    as_app "$APP_DIR/deploy/manage.sh" create_admin --email "$ADMIN_EMAIL" --name "$ADMIN_NAME" --phone "$ADMIN_PHONE" <&3 \
      || warn "No account was created. Try again with: sudo -u $APP_USER $APP_DIR/deploy/manage.sh create_admin --email … --name \"…\""
  fi
fi

cat <<EOF

$(printf '\033[1;32mDone.\033[0m') The library is at $SITE_URL

Still to do:
  1. Create the administrator, if you have not yet:
       sudo -u $APP_USER $APP_DIR/deploy/manage.sh create_admin --email you@example.edu --name "Full Name"
  2. Set up email in $ENV_FILE (the EMAIL_* lines), then: sudo systemctl restart $SERVICE
$( [ "$HTTP_ONLY" -eq 1 ] && echo "  3. This is plain HTTP: do not expose it to the internet. For HTTPS: sudo certbot --nginx -d $FIRST_DOMAIN, then remove DJANGO_ALLOW_HTTP from the settings file." )
$( [ "$HTTP_ONLY" -eq 0 ] && ! grep -q 'listen 443' /etc/nginx/sites-available/lib-borrow && echo "  3. HTTPS: sudo certbot --nginx -d $FIRST_DOMAIN   (or put your own certificate in the nginx site)" )
  Set the server clock to the library's time zone (jobs run on it):  sudo timedatectl set-timezone $TIMEZONE

Logs:      journalctl -u $SERVICE -f
Jobs:      journalctl -t lib-borrow-jobs
Upgrade:   git pull && sudo bash deploy/update.sh
$( [ -e "$UPDATE_CONF" ] && echo "Updates:   automatic, nightly from github.com/$(sed -n 's/^UPDATE_REPO=//p' "$UPDATE_CONF") (journalctl -u lib-borrow-update)" )
Backups:   $BACKUP_DIR (nightly, and: sudo bash deploy/backup.sh)
EOF
