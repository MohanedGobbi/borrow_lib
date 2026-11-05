#!/usr/bin/env bash
# Installs the Faculty of Law and Political Sciences library platform on this server
# (Ubuntu 24.04 LTS or Debian 13). Run it from the folder it came in, next to lib-borrow-*.tar.gz:
#
#     sudo bash install.sh
#
# It asks how people will reach the site, then installs everything. To answer on the command line
# instead, pass the options of deploy/install.sh, for example:
#     sudo bash install.sh --domain library.univ-ghardaia.dz --certbot-email it@univ-ghardaia.dz
#     sudo bash install.sh --domain 192.168.1.50 --http-only
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=/opt/lib-borrow
ENV_FILE=/etc/lib-borrow/lib-borrow.env

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }
ask_yes() { local a; read -r -p "$1 [Y/n] " a; [[ ! "$a" =~ ^[Nn] ]]; }

[ "$(id -u)" -eq 0 ] || die "Run it as root:  sudo bash $0"
command -v apt-get >/dev/null || die "This installer needs Ubuntu 24.04 or Debian 13."

TARBALL="$(ls -1 "$HERE"/lib-borrow-*.tar.gz 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$TARBALL" ] || die "lib-borrow-*.tar.gz is not in $HERE. Copy the whole installation folder."
if [ -f "$HERE/SHA256SUMS.txt" ]; then
  (cd "$HERE" && sha256sum --check --quiet SHA256SUMS.txt) \
    || die "The archive is damaged (checksum mismatch). Copy the folder to the server again."
fi

if [ -e "$ENV_FILE" ]; then
  die "The library is already installed here. To install a newer version:  sudo bash update.sh"
fi

say "Unpacking $(basename "$TARBALL") into $APP_DIR"
mkdir -p "$APP_DIR"
tar -xzf "$TARBALL" -C "$APP_DIR" --strip-components=1
sed 's/^/    /' "$APP_DIR/RELEASE"

# Options given: no questions.
if [ $# -gt 0 ]; then
  exec bash "$APP_DIR/deploy/install.sh" --skip-build "$@"
fi

[ -t 0 ] || die "No terminal to ask questions. Pass the options instead (see the top of this file)."

cat <<'EOF'

  Faculty of Law and Political Sciences Library - University of Ghardaia
  مكتبة كلية الحقوق والعلوم السياسية - جامعة غرداية
  Developed by ROWD Tech, in partnership with AFAK (University of Ghardaia)

  How will people open the library website?
    1) From the internet, with a domain name and HTTPS (recommended)
       for example  library.univ-ghardaia.dz
    2) Only inside the faculty network, by this server's IP address (no certificate)

EOF
read -r -p "Choose 1 or 2: " MODE
ARGS=()
case "$MODE" in
  1)
    read -r -p "Domain name (it must already point at this server): " DOMAIN
    [ -n "$DOMAIN" ] || die "A domain name is required for option 1."
    read -r -p "Email for the free HTTPS certificate (Enter to add the certificate later): " CERT_EMAIL
    ARGS=(--domain "$DOMAIN")
    [ -z "$CERT_EMAIL" ] || ARGS+=(--certbot-email "$CERT_EMAIL")
    URL="https://$DOMAIN"
    ;;
  2)
    IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    read -r -p "Address people will type [${IP:-none found}]: " ADDR
    ADDR="${ADDR:-$IP}"
    [ -n "$ADDR" ] || die "An address is required."
    ARGS=(--domain "$ADDR" --http-only)
    URL="http://$ADDR"
    ;;
  *) die "Answer 1 or 2." ;;
esac

if [ "$(timedatectl show -p Timezone --value 2>/dev/null || true)" != "Africa/Algiers" ]; then
  if ask_yes "Set the server clock to Algeria time (Africa/Algiers)? The daily jobs run on it."; then
    timedatectl set-timezone Africa/Algiers || true
  fi
fi

echo
echo "  The site will be at:  $URL"
echo "  Database: PostgreSQL. Takes about 5 minutes."
echo
ask_yes "Start the installation?" || exit 0
exec bash "$APP_DIR/deploy/install.sh" --skip-build "${ARGS[@]}"
