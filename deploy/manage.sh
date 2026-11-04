#!/usr/bin/env bash
# Runs manage.py with the production settings from /etc/lib-borrow/lib-borrow.env.
# Run it as the service user, e.g.
#   sudo -u libborrow /opt/lib-borrow/deploy/manage.sh create_admin --email … --name "…"
# Cron uses it too, so the jobs see the same environment as the website.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${LIB_BORROW_ENV:-/etc/lib-borrow/lib-borrow.env}"

[ -r "$ENV_FILE" ] || { echo "Cannot read $ENV_FILE (run as the libborrow user: sudo -u libborrow $0 …)" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

cd "$APP_DIR/backend"
exec "$APP_DIR/backend/.venv/bin/python" manage.py "$@"
