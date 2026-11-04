#!/usr/bin/env bash
# Backs up the database, the uploaded files and the settings file into one archive in
# /var/backups/lib-borrow (the last 14 are kept). Cron runs it every night; run it by hand
# before an upgrade:  sudo bash deploy/backup.sh
# The archive contains the secret key and the whole member list: keep it private.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_root "$@"

KEEP=14
stamp="$(date +%Y%m%d-%H%M%S)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

mkdir -p "$work/lib-borrow-$stamp"
snap="$work/lib-borrow-$stamp"

case "${DB_ENGINE:-sqlite}" in
  *postgresql*)
    as_app pg_dump --format=custom --no-owner "$DB_NAME" > "$snap/database.dump"
    ;;
  *)
    # A consistent copy even while the site is writing to it.
    "$VENV/bin/python" - "${DB_NAME:-$APP_DIR/backend/db.sqlite3}" "$snap/db.sqlite3" <<'PY'
import sqlite3, sys
src, dst = (sqlite3.connect(p) for p in sys.argv[1:3])
src.backup(dst)
PY
    ;;
esac

cp "$ENV_FILE" "$snap/lib-borrow.env"
if [ -d "$DATA_DIR/media" ]; then cp -a "$DATA_DIR/media" "$snap/media"; fi

install -d -m 700 "$BACKUP_DIR"
out="$BACKUP_DIR/lib-borrow-$stamp.tar.gz"
tar -C "$work" -czf "$out" "lib-borrow-$stamp"
chmod 600 "$out"

# Keep the newest $KEEP archives.
ls -1t "$BACKUP_DIR"/lib-borrow-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f --

log "Backup written to $out ($(du -h "$out" | cut -f1))"
