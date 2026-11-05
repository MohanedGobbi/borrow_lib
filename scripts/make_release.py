"""Build the offline installation folder for a library server.

    python scripts/make_release.py [--out university-package/1-Installation] [--no-build]

Writes lib-borrow-<version>.tar.gz (the code plus the pre-built site, so the server needs no
Node.js), SHA256SUMS.txt and the installer scripts from deploy/package/. Text files get Unix line
endings whatever the checkout uses, files belong to root, and shell scripts are executable.
"""
import argparse
import hashlib
import io
import json
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Not needed on a server: design-tool files, CI configuration, the scripts shipped beside the archive,
# and the hosted demo's Vercel files.
EXCLUDE = (".impeccable/", ".github/", "deploy/package/", "api/", "vercel.json", ".vercelignore",
           "requirements.txt", ".python-version")
BINARY = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".glb", ".ttf", ".otf", ".woff",
          ".woff2", ".pdf", ".xlsx", ".zip", ".gz"}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def files_to_ship() -> list[str]:
    tracked_and_new = git("ls-files", "--cached", "--others", "--exclude-standard").splitlines()
    # Zip archives lying in the checkout are copies of a package, never part of the platform.
    paths = [p for p in tracked_and_new
             if not p.startswith(EXCLUDE) and not p.endswith(".zip") and (ROOT / p).is_file()]
    paths += [p.relative_to(ROOT).as_posix() for p in (ROOT / "dist").rglob("*") if p.is_file()]
    return sorted(set(paths))


def content(path: str) -> bytes:
    data = (ROOT / path).read_bytes()
    if Path(path).suffix.lower() in BINARY or b"\0" in data[:8192]:
        return data
    return data.replace(b"\r\n", b"\n")


def add(tar: tarfile.TarFile, name: str, data: bytes, mode: int) -> None:
    info = tarfile.TarInfo(name)
    info.size, info.mode, info.mtime = len(data), mode, int(time.time())
    info.uid = info.gid = 0
    info.uname = info.gname = "root"
    tar.addfile(info, io.BytesIO(data))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default="university-package/1-Installation")
    ap.add_argument("--no-build", action="store_true", help="use the existing dist/")
    args = ap.parse_args()

    if not args.no_build:
        subprocess.run("npm run build", cwd=ROOT, shell=True, check=True)
    if not (ROOT / "dist" / "index.html").is_file():
        sys.exit("dist/index.html is missing: run npm run build (or drop --no-build).")

    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    commit = git("rev-parse", "--short", "HEAD").strip()
    dirty = " (with uncommitted changes)" if git("status", "--porcelain", "--untracked-files=no").strip() else ""
    out = (ROOT / args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("lib-borrow-*.tar.gz"):
        old.unlink()
    tarball = out / f"lib-borrow-{version}.tar.gz"

    paths = files_to_ship()
    release = (f"version={version}\ncommit={commit}{dirty}\n"
               f"built={datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC\n").encode()
    with tarfile.open(tarball, "w:gz") as tar:
        add(tar, "lib-borrow/RELEASE", release, 0o644)
        for p in paths:
            add(tar, f"lib-borrow/{p}", content(p), 0o755 if p.endswith(".sh") else 0o644)

    # The scripts that sit next to the archive: Unix endings, except the Windows .bat.
    for script in sorted((ROOT / "deploy" / "package").iterdir()):
        data = script.read_bytes().replace(b"\r\n", b"\n")
        if script.suffix == ".bat":
            data = data.replace(b"\n", b"\r\n")
        (out / script.name).write_bytes(data)

    digest = hashlib.sha256(tarball.read_bytes()).hexdigest()
    (out / "SHA256SUMS.txt").write_text(f"{digest}  {tarball.name}\n", encoding="ascii", newline="\n")
    size = tarball.stat().st_size / 2**20
    print(f"{tarball.relative_to(ROOT)}  {size:.1f} MB, {len(paths)} files, version {version}, commit {commit}{dirty}")


if __name__ == "__main__":
    main()
