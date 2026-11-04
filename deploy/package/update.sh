#!/usr/bin/env bash
# Installs a newer version of the library platform over the running one. Copy the new
# installation folder to the server, then from inside it:
#
#     sudo bash update.sh
#
# Accounts, books, loans, settings and uploaded photographs are kept. A backup is taken first,
# and the previous version is kept in /opt/lib-borrow.previous.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=/opt/lib-borrow
NEW=/opt/lib-borrow.new
PREV=/opt/lib-borrow.previous

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run it as root:  sudo bash $0"
TARBALL="$(ls -1 "$HERE"/lib-borrow-*.tar.gz 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$TARBALL" ] || die "lib-borrow-*.tar.gz is not in $HERE."
if [ -f "$HERE/SHA256SUMS.txt" ]; then
  (cd "$HERE" && sha256sum --check --quiet SHA256SUMS.txt) || die "The archive is damaged (checksum mismatch)."
fi
[ -x "$APP_DIR/backend/.venv/bin/python" ] && [ -e /etc/lib-borrow/lib-borrow.env ] \
  || die "The library is not installed yet. Use:  sudo bash install.sh"

echo "Installed now:"; sed 's/^/    /' "$APP_DIR/RELEASE" 2>/dev/null || echo "    (unknown)"
echo "This folder:";   tar -xzOf "$TARBALL" lib-borrow/RELEASE | sed 's/^/    /'
if [ -t 0 ]; then
  read -r -p "Install this version? [Y/n] " a; [[ ! "$a" =~ ^[Nn] ]] || exit 0
fi

say "Unpacking the new version"
rm -rf "$NEW"; mkdir -p "$NEW"
tar -xzf "$TARBALL" -C "$NEW" --strip-components=1

say "Switching to it (the Python environment moves along; its paths stay the same)"
mv "$APP_DIR/backend/.venv" "$NEW/backend/.venv"
rm -rf "$PREV"
mv "$APP_DIR" "$PREV"
mv "$NEW" "$APP_DIR"

if ! bash "$APP_DIR/deploy/update.sh" --skip-build; then
  cat >&2 <<EOF

The update did not finish. The previous version is in $PREV, and a backup taken just before
the update is the newest file in /var/backups/lib-borrow. See the installation guide,
"Going back to the previous version".
EOF
  exit 1
fi

# Re-apply the service and web server templates in case this version changed them.
DOMAIN="$(grep -oP '^DJANGO_ALLOWED_HOSTS=\K.*' /etc/lib-borrow/lib-borrow.env \
  | tr ',' '\n' | grep -vxE 'localhost|127\.0\.0\.1' | paste -sd, - || true)"
if [ -n "$DOMAIN" ]; then
  MODE=(); grep -q '^DJANGO_ALLOW_HTTP=1' /etc/lib-borrow/lib-borrow.env && MODE=(--http-only)
  bash "$APP_DIR/deploy/install.sh" --skip-build --no-inventory --yes --domain "$DOMAIN" "${MODE[@]}" >/dev/null \
    || echo "Note: re-applying the service files reported a problem; run  sudo bash status.sh"
fi

say "Updated to: $(head -1 "$APP_DIR/RELEASE")"
echo "The previous version stays in $PREV until the next update."
