"""Publish the built monitor to GitHub Pages.

Copies reports/india_banking_monitor.html into a throwaway folder as index.html (plus 404.html and .nojekyll),
commits it as a single-commit `gh-pages` branch and force-pushes it to the repo's origin. Only one commit ever
exists on gh-pages, so nightly updates never grow the repository's history. Skips the push when the page is
unchanged since the last publish.

Site: https://<github user>.github.io/<repo>/ (GitHub Pages must be set to serve the gh-pages branch, once).
"""
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "reports" / "india_banking_monitor.html"
STAMP = ROOT / "logs" / "site_published.sha256"


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def main():
    force = "--force" in sys.argv
    if not PAGE.exists():
        sys.exit(f"missing {PAGE}; run build_report.py first")
    # the report is written without a document wrapper (for the claude.ai artifact); a public page needs one
    body = PAGE.read_text(encoding="utf-8").replace('<meta charset="utf-8">', "", 1)
    head = ('<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
    data = (head + body).encode("utf-8")
    digest = hashlib.sha256(data).hexdigest()
    if not force and STAMP.exists() and STAMP.read_text().strip() == digest:
        print("site unchanged since last publish; nothing to push")
        return
    origin = git("remote", "get-url", "origin", cwd=ROOT)
    name = git("config", "user.name", cwd=ROOT) or "Bankanalysis"
    email = git("config", "user.email", cwd=ROOT) or "noreply@example.com"
    tmp = Path(tempfile.mkdtemp(prefix="ibm-site-"))
    try:
        (tmp / "index.html").write_bytes(data)
        (tmp / "404.html").write_bytes(data)
        (tmp / ".nojekyll").write_text("")
        git("init", "-q", "-b", "gh-pages", cwd=tmp)
        git("-c", f"user.name={name}", "-c", f"user.email={email}", "add", "-A", cwd=tmp)
        git("-c", f"user.name={name}", "-c", f"user.email={email}", "commit", "-q", "-m", "Publish India Banking Monitor", cwd=tmp)
        git("push", "-q", "--force", origin, "gh-pages:gh-pages", cwd=tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    STAMP.parent.mkdir(exist_ok=True)
    STAMP.write_text(digest)
    user, repo = origin.rstrip("/").removesuffix(".git").split("/")[-2:]
    print(f"published to https://{user.lower()}.github.io/{repo}/")


if __name__ == "__main__":
    main()
