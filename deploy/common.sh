# Shared by the scripts in deploy/. Sourced, never run on its own.

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="libborrow"
SERVICE="lib-borrow"
DATA_DIR="/var/lib/lib-borrow"      # uploads, admin assets and (with SQLite) the database
ENV_DIR="/etc/lib-borrow"
ENV_FILE="${LIB_BORROW_ENV:-$ENV_DIR/lib-borrow.env}"
BACKUP_DIR="/var/backups/lib-borrow"
VENV="$APP_DIR/backend/.venv"

log()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "Run this as root: sudo bash $0 $*"
}

# Run a command as the service user, from a directory it can read.
as_app() {
  (cd / && runuser -u "$APP_USER" -- "$@")
}

# Build the site into dist/ (needs Node 22+).
build_frontend() {
  command -v node >/dev/null || die "Node.js is not installed (need 22+)."
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || die "Node.js $(node -v) is too old (need 22+)."
  (cd "$APP_DIR" && npm ci --no-audit --no-fund && npm run build)
  chmod -R a+rX "$APP_DIR/dist"
}
