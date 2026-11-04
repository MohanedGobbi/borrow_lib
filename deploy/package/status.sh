#!/usr/bin/env bash
# Health check of the library platform:  sudo bash status.sh
# Shows the version, whether every part is running, whether the site answers, the last backup
# and the last scheduled jobs. Send its output to whoever supports the platform.
set -uo pipefail

APP_DIR=/opt/lib-borrow
ENV_FILE=/etc/lib-borrow/lib-borrow.env
ok()   { printf '  \033[1;32mOK\033[0m    %s\n' "$*"; }
bad()  { printf '  \033[1;31mFAIL\033[0m  %s\n' "$*"; }
info() { printf '        %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run it as root:  sudo bash $0"; exit 1; }
[ -r "$ENV_FILE" ] || { echo "The library is not installed on this server."; exit 1; }

echo "Version"
sed 's/^/        /' "$APP_DIR/RELEASE" 2>/dev/null || info "unknown"
URL="$(grep -oP '^FRONTEND_URL=\K.*' "$ENV_FILE")"
info "address: $URL"

echo "Services"
for s in lib-borrow nginx postgresql cron; do
  if ! systemctl list-unit-files "$s.service" >/dev/null 2>&1; then continue; fi
  if [ "$s" = postgresql ] && ! grep -q '^DB_ENGINE=.*postgresql' "$ENV_FILE"; then continue; fi
  if systemctl is-active --quiet "$s"; then ok "$s running"; else bad "$s is not running  (sudo systemctl restart $s)"; fi
done

echo "Website"
HOST="${URL#*://}"
code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" -H 'X-Forwarded-Proto: https' http://127.0.0.1:8000/api/books || true)"
[ "$code" = 200 ] && ok "application answers" || bad "application answered $code  (journalctl -u lib-borrow -n 50)"
code="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$HOST:443:127.0.0.1" --resolve "$HOST:80:127.0.0.1" "$URL/" || true)"
[ "$code" = 200 ] && ok "web page $URL answers" || bad "web page $URL answered $code"
if command -v certbot >/dev/null && certbot certificates 2>/dev/null | grep -q 'Expiry Date'; then
  info "certificate: $(certbot certificates 2>/dev/null | grep -m1 -oP 'Expiry Date: \K.*')"
fi

echo "Backups"
last="$(ls -1t /var/backups/lib-borrow/lib-borrow-*.tar.gz 2>/dev/null | head -1)"
if [ -n "$last" ]; then
  age=$(( ( $(date +%s) - $(stat -c %Y "$last") ) / 3600 ))
  [ "$age" -le 30 ] && ok "last backup ${age} h ago: $last" || bad "last backup is ${age} h old: $last"
else
  bad "no backup yet (the first one runs tonight at 02:30, or: sudo bash $APP_DIR/deploy/backup.sh)"
fi

echo "Disk"
df -h / /var/lib/lib-borrow 2>/dev/null | awk 'NR==1 || !seen[$1]++' | sed 's/^/        /'

echo "Last scheduled jobs"
journalctl -t lib-borrow-jobs --no-pager -n 4 -o short 2>/dev/null | sed 's/^/        /' || true
