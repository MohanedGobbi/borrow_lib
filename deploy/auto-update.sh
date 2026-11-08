#!/usr/bin/env bash
# Installs a newer release of the library platform from GitHub, if there is one, so the server
# stays up to date without anyone logging in to it. The lib-borrow-update timer runs it every
# night; to check now:  sudo systemctl start lib-borrow-update   (log: journalctl -u lib-borrow-update)
#
# Only published releases are installed: a tag vX.Y.Z pushed to GitHub, built and published by
# .github/workflows/release.yml after the tests pass. Ordinary pushes to main are never installed.
#
# Settings, in /etc/lib-borrow/auto-update.env (written by install.sh --auto-update OWNER/REPO):
#   UPDATE_REPO=owner/name   the GitHub repository whose releases to follow
#   GITHUB_TOKEN=...         only for a private repository: a read-only token
#
# It takes a backup, then switches to the new version. If the new version does not start, it puts
# the previous version and the database back, and skips that release until a newer one appears.
#
# The admin settings page shows the progress written to $STATE_DIR/status.json. Its "Check now" button
# creates $REQUEST_FILE, and the lib-borrow-update.path unit starts this script when that file appears:
# the site itself never runs anything as root.
set -euo pipefail

STATE_DIR=/var/lib/lib-borrow-update
REQUEST_FILE=/var/lib/lib-borrow/update-request/requested
INSTALLED=""; LATEST=""

write_status() {  # write_status STATE MESSAGE: what the admin page shows
  [ -d "$STATE_DIR" ] || return 0
  local tmp
  tmp="$(mktemp "$STATE_DIR/.status.XXXXXX")" || return 0
  if STATE="$1" MESSAGE="$2" INSTALLED="$INSTALLED" LATEST="$LATEST" REPO="${UPDATE_REPO:-}" python3 -c '
import json, os
from datetime import datetime, timezone
print(json.dumps({k.lower(): os.environ[k] for k in ("STATE", "MESSAGE", "INSTALLED", "LATEST", "REPO")}
                 | {"at": datetime.now(timezone.utc).isoformat(timespec="seconds")}))' > "$tmp"; then
    chmod 644 "$tmp" && mv -f "$tmp" "$STATE_DIR/status.json"
  else
    rm -f "$tmp"
  fi
}

newer() {  # newer A B: version A is greater than version B
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]
}

installed_version() {
  if [ -r "$APP_DIR/RELEASE" ]; then
    sed -n 's/^version=//p' "$APP_DIR/RELEASE" | head -1
  else  # installed from a git checkout
    python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' "$APP_DIR/package.json"
  fi
}

site_answers() {
  local code
  for _ in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Proto: https' -H 'Host: localhost' \
      http://127.0.0.1:8000/api/books || true)"
    [ "$code" = 200 ] && return 0
    sleep 1
  done
  return 1
}

fetch() {  # fetch URL FILE: download a release asset
  curl -fsSL --max-time 900 --retry 3 -H 'Accept: application/octet-stream' "${AUTH[@]}" -o "$2" "$1"
}

restore_database() {  # restore_database BACKUP: put the database of a backup.sh archive back
  local dir snap
  dir="$(mktemp -d)"
  tar -xzf "$1" -C "$dir"
  snap="$(echo "$dir"/lib-borrow-*)"
  (
    set -a; . "$ENV_FILE"; set +a
    case "${DB_ENGINE:-sqlite}" in
      *postgresql*)
        (cd / && runuser -u postgres -- dropdb --if-exists --force "$DB_NAME")
        (cd / && runuser -u postgres -- createdb -O "$APP_USER" -E UTF8 "$DB_NAME")
        as_app pg_restore --no-owner -d "$DB_NAME" < "$snap/database.dump"
        ;;
      *)
        install -m 600 -o "$APP_USER" -g "$APP_USER" "$snap/db.sqlite3" "$DB_NAME"
        ;;
    esac
  )
  rm -rf "$dir"
}

rollback() {  # rollback BACKUP: the new version is in APP_DIR, the old one in PREV
  local failed="$APP_DIR.failed"
  systemctl stop "$SERVICE" || true
  rm -rf "$failed"
  mv "$APP_DIR/backend/.venv" "$PREV/backend/.venv"
  mv "$APP_DIR" "$failed"
  mv "$PREV" "$APP_DIR"
  log "Restoring the database from $1"
  restore_database "$1" || warn "The database could not be restored from $1 (see INSTALL-LINUX.md, section 10)."
  bash "$APP_DIR/deploy/update.sh" --skip-build || warn "The previous version did not restart cleanly either."
}

reapply_templates() {  # the new version may have changed the service or nginx templates
  local domain mode=()
  domain="$(grep -oP '^DJANGO_ALLOWED_HOSTS=\K.*' "$ENV_FILE" \
    | tr ',' '\n' | grep -vxE 'localhost|127\.0\.0\.1' | paste -sd, - || true)"
  [ -n "$domain" ] || return 0
  grep -q '^DJANGO_ALLOW_HTTP=1' "$ENV_FILE" && mode=(--http-only)
  bash "$APP_DIR/deploy/install.sh" --skip-build --no-inventory --yes --domain "$domain" "${mode[@]}" >/dev/null \
    || warn "Re-applying the service files reported a problem."
}

main() {
  . "$(dirname "${BASH_SOURCE[0]}")/common.sh"
  require_root "$@"
  rm -f "$REQUEST_FILE"   # the request, if this run came from the admin page, is being answered
  die() { write_status error "$*"; printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }
  [ "$APP_DIR" = /opt/lib-borrow ] || die "Automatic updates expect the installation in /opt/lib-borrow (it is in $APP_DIR)."
  local conf="$ENV_DIR/auto-update.env"
  [ -r "$conf" ] || die "$conf is missing: automatic updates are off (install.sh --auto-update OWNER/REPO)."
  UPDATE_REPO=""; GITHUB_TOKEN=""; UPDATE_API="https://api.github.com"
  # shellcheck disable=SC1090
  . "$conf"
  [[ "$UPDATE_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "UPDATE_REPO in $conf must look like owner/name."
  AUTH=(); [ -z "$GITHUB_TOKEN" ] || AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")
  NEW="$APP_DIR.new"; PREV="$APP_DIR.previous"

  exec 9>/run/lib-borrow-update.lock
  flock -n 9 || { warn "Another update is already running."; return 0; }
  install -d -m 755 "$STATE_DIR"

  local installed release tag tar_name tar_url sums_url version
  installed="$(installed_version)"; INSTALLED="$installed"
  write_status checking "Checking github.com/$UPDATE_REPO"
  log "Installed: $installed. Checking github.com/$UPDATE_REPO for a newer release"
  release="$(curl -fsS --max-time 60 -H 'Accept: application/vnd.github+json' "${AUTH[@]}" \
    "$UPDATE_API/repos/$UPDATE_REPO/releases/latest")" \
    || die "Could not read the latest release (no internet access, or nothing published yet)."
  read -r tag tar_name tar_url sums_url < <(printf '%s' "$release" | python3 -c '
import json, sys
r = json.load(sys.stdin)
assets = {a["name"]: a["url"] for a in r.get("assets", [])}
tars = sorted(n for n in assets if n.startswith("lib-borrow-") and n.endswith(".tar.gz"))
if not tars or "SHA256SUMS.txt" not in assets:
    sys.exit("The release has no lib-borrow-*.tar.gz or SHA256SUMS.txt.")
print(r["tag_name"], tars[-1], assets[tars[-1]], assets["SHA256SUMS.txt"])
') || die "The latest release on GitHub is incomplete."
  version="${tag#v}"
  [[ "$version" =~ ^[0-9]+(\.[0-9]+)*$ ]] || die "Release tag $tag is not a version number (vX.Y.Z)."
  LATEST="$version"

  if ! newer "$version" "$installed"; then
    write_status up_to_date "Up to date."
    log "Up to date (latest release: $version)."
    return 0
  fi
  if [ "$(cat "$STATE_DIR/failed" 2>/dev/null || true)" = "$version" ]; then
    write_status skipped "Version $version failed to install before; waiting for a newer release."
    warn "Version $version failed to install before; waiting for a newer release."
    return 0
  fi

  write_status downloading "Downloading version $version."
  log "Downloading version $version"
  WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
  fetch "$tar_url" "$WORK/$tar_name"
  fetch "$sums_url" "$WORK/SHA256SUMS.txt"
  (cd "$WORK" && sha256sum --check --quiet SHA256SUMS.txt) || die "The download is damaged (checksum mismatch)."
  tar -xzOf "$WORK/$tar_name" lib-borrow/RELEASE | grep -qx "version=$version" \
    || die "The archive in release $tag is not version $version."

  write_status installing "Installing version $version."
  log "Backing up before the update"
  bash "$APP_DIR/deploy/backup.sh"
  local backup
  backup="$(ls -1t "$BACKUP_DIR"/lib-borrow-*.tar.gz | head -1)"

  log "Switching from $installed to $version"
  rm -rf "$NEW"; mkdir -p "$NEW"
  tar -xzf "$WORK/$tar_name" -C "$NEW" --strip-components=1
  mv "$APP_DIR/backend/.venv" "$NEW/backend/.venv"   # the Python environment moves along
  rm -rf "$PREV"
  mv "$APP_DIR" "$PREV"
  mv "$NEW" "$APP_DIR"

  if bash "$APP_DIR/deploy/update.sh" --skip-build && site_answers; then
    reapply_templates
    rm -f "$STATE_DIR/failed"
    echo "$(date -Is) $installed -> $version ok" >> "$STATE_DIR/history"
    INSTALLED="$version"
    write_status updated "Updated from $installed to $version."
    log "Updated to $version. The previous version stays in $PREV until the next update."
  else
    warn "Version $version did not start. Going back to $installed."
    rollback "$backup"
    echo "$version" > "$STATE_DIR/failed"
    echo "$(date -Is) $installed -> $version FAILED, rolled back" >> "$STATE_DIR/history"
    write_status failed "Version $version did not start; $installed is running again."
    printf '\033[1;31mxx\033[0m  %s\n' "The update to $version failed and $installed is running again. The failed copy is in $APP_DIR.failed." >&2
    exit 1
  fi
}

# Everything above is only definitions, read in full before anything runs: the update moves this
# very file to $APP_DIR.previous while it runs.
main "$@"; exit $?
