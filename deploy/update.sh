#!/usr/bin/env bash
# Applies a new version of the code. After `git pull`:
#   sudo bash deploy/update.sh              # dependencies, site rebuild, migrations, restart
#   sudo bash deploy/update.sh --skip-build # when dist/ was built elsewhere and copied over
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_root "$@"

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    *) die "Unknown option: $arg" ;;
  esac
done

[ -x "$VENV/bin/python" ] || die "No installation found in $APP_DIR (run deploy/install.sh first)."
[ -r "$ENV_FILE" ] || die "$ENV_FILE is missing (run deploy/install.sh first)."

log "Backing up before the upgrade"
bash "$APP_DIR/deploy/backup.sh"

log "Python dependencies"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"
"$VENV/bin/python" -m compileall -q "$APP_DIR/backend/config" "$APP_DIR/backend/library"

if [ "$SKIP_BUILD" -eq 0 ]; then
  log "Building the site"
  build_frontend
fi

log "Database migrations and static files"
as_app "$APP_DIR/deploy/manage.sh" migrate --noinput
as_app "$APP_DIR/deploy/manage.sh" collectstatic --noinput

log "Restarting"
systemctl restart "$SERVICE"
for _ in $(seq 1 30); do
  curl -s -o /dev/null -H 'X-Forwarded-Proto: https' -H 'Host: localhost' http://127.0.0.1:8000/api/books && break
  sleep 1
done
systemctl is-active --quiet "$SERVICE" || die "The service did not start: journalctl -u $SERVICE -n 50"
log "Updated."
