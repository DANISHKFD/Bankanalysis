"""Download RBI banking data releases into raw/rbi/<dataset>/.

Each listing page shows the current year's releases; each release page links
to an .xlsx (preferred) or PDF on rbidocs.rbi.org.in. Files already on disk
are skipped, so re-running only fetches new months.

rbidocs.rbi.org.in answers plain scripts with a JavaScript bot check. Blocked
files are retried through a headless Chromium (Playwright), which runs the
check like a normal browser. Anything still blocked is listed in
raw/rbi/pending_downloads.tsv.

Usage:
    python src/fetch_rbi.py              # all datasets, every release on page 1
    python src/fetch_rbi.py --latest     # only the newest release per dataset
    python src/fetch_rbi.py sibc rates   # selected datasets
"""
import argparse
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from lxml import html

BASE = "https://rbi.org.in/scripts/"
ROOT = Path(__file__).resolve().parent.parent / "raw" / "rbi"
PENDING = ROOT / "pending_downloads.tsv"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")

# key: (listing page, regex the release title must match)
DATASETS = {
    "sibc": ("Data_Sectoral_Deployment.aspx", r"Sectoral Deployment of Bank Credit"),
    "rates": ("Pr_DataRelease.aspx?SectionID=369&DateFilter=Year",
              r"Lending and Deposit Rates of Scheduled Commercial Banks"),
    "cards": ("ATMView.aspx", r"Bank-wise ATM/POS/Card Statistics"),
    "bsr1": ("Pr_DataRelease.aspx?SectionID=354&DateFilter=YearMonth_PR",
             r"Basic Statistical Return \(BSR\)-1"),
    "bsr2": ("Pr_DataRelease.aspx?SectionID=382&DateFilter=Year",
             r"Basic Statistical Return \(BSR\)-2"),
    # fortnightly press release; only month-end editions are kept
    "sop": ("BS_PressReleaseDisplay.aspx",
            r"Scheduled Banks.{1,3}Statement of Position in India as on "
            r"(?:January 31|February 2[89]|March 31|April 30|May 31|June 30|July 31|"
            r"August 31|September 30|October 31|November 30|December 31), \d{4}"),
}

session = requests.Session()
session.headers.update(HEADERS)


def get(url):
    for attempt in range(3):
        try:
            r = session.get(url, timeout=60)
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(3)


def list_releases(listing, title_re):
    """Return [(title, url)] for releases on the listing page, newest first."""
    doc = html.fromstring(get(urljoin(BASE, listing)).content)
    out, seen = [], set()
    for a in doc.xpath("//a[@class='link2'] | //a[contains(@href, 'BS_PressReleaseDisplay.aspx?prid=')]"):
        title = " ".join(a.text_content().split())
        href = a.get("href")
        if href and re.search(title_re, title) and href not in seen:
            seen.add(href)
            out.append((title, urljoin(BASE, href)))
    return out


def file_links(release_url):
    """Data files linked from a release page: Excel first, then PDF."""
    links = re.findall(r"https?://rbidocs\.rbi\.org\.in/[^\"'\s<>]+?\.(?:xlsx?|pdf)",
                       get(release_url).text, flags=re.I)
    links = [u for u in dict.fromkeys(links)
             if not re.search(r"Utkarsh|Accessibility", u, re.I)]
    excel = [u for u in links if re.search(r"\.xlsx?$", u, re.I)]
    return excel or links[:1]


def safe_name(title, url):
    title = re.sub(r"\s*\(Revised\)\s*$", "", title, flags=re.I)
    sop = re.search(r"as on ([A-Z][a-z]+) (\d{1,2}), (\d{4})", title)
    if sop:  # 'as on September 30, 2026' -> 2026-September-30
        return f"{sop.group(3)}-{sop.group(1)}-{int(sop.group(2))}{Path(url).suffix.lower()}"
    period = re.search(r"([A-Z][a-z]+)\s+(\d{4})\W*$", title)
    stem = f"{period.group(2)}-{period.group(1)}" if period else re.sub(r"\W+", "_", title)[-60:]
    if "Annual" in title:
        stem += "-annual"
    return f"{stem}{Path(url).suffix.lower()}"


class Browser:
    """Headless Chromium, started on first use, for files behind the bot check."""

    def __init__(self):
        self.pw = self.browser = self.ctx = None

    def get(self, url):
        if self.ctx is None:
            from playwright.sync_api import sync_playwright
            self.pw = sync_playwright().start()
            self.browser = self.pw.chromium.launch()
            # the check rejects the default 'HeadlessChrome' agent and a bare one
            self.ctx = self.browser.new_context(user_agent=BROWSER_UA)
            self.page = self.ctx.new_page()
            self.warm_up()
        for attempt in range(3):
            r = self.ctx.request.get(url, timeout=120000)
            data = r.body() if r.ok else b""
            if is_data_file(data):
                return data
            self.warm_up()                # cookie expired or check re-armed
        return data

    def warm_up(self):
        self.page.goto("https://rbidocs.rbi.org.in/rdocs/", wait_until="load", timeout=90000)
        self.page.wait_for_timeout(4000)  # let the bot-check script set its cookie

    def close(self):
        if self.browser:
            self.browser.close()
            self.pw.stop()


browser = Browser()


def is_data_file(data):
    return data[:2] == b"PK" or data[:4] in (b"%PDF", b"\xd0\xcf\x11\xe0")  # xlsx, pdf, xls


def fetch(key, latest_only):
    listing, title_re = DATASETS[key]
    dest = ROOT / key
    dest.mkdir(parents=True, exist_ok=True)
    releases = list_releases(listing, title_re)
    if latest_only:
        releases = releases[:1]
    print(f"[{key}] {len(releases)} release(s) on listing page")
    for title, url in releases:
        for f in file_links(url):
            target = dest / safe_name(title, f)
            if target.exists():
                print(f"  skip  {target.name}")
                continue
            data = get(f).content
            if not is_data_file(data):
                try:
                    data = browser.get(f)
                except Exception as e:
                    print(f"  headless browser failed: {e}")
                    data = b""
            if not is_data_file(data):
                print(f"  BLOCKED {target.name}  (bot check) -> logged to {PENDING.name}")
                with PENDING.open("a", encoding="utf-8") as fh:
                    fh.write(f"{target.relative_to(ROOT)}\t{f}\n")
                continue
            target.write_bytes(data)
            print(f"  saved {target.name}  ({len(data)//1024} KB)  <- {title}")
        time.sleep(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("datasets", nargs="*", choices=list(DATASETS), default=[])
    ap.add_argument("--latest", action="store_true")
    args = ap.parse_args()
    ROOT.mkdir(parents=True, exist_ok=True)
    PENDING.write_text("", encoding="utf-8")
    for key in args.datasets or DATASETS:
        try:
            fetch(key, args.latest)
        except Exception as e:  # keep going if one source fails
            print(f"[{key}] FAILED: {e}", file=sys.stderr)
    browser.close()


if __name__ == "__main__":
    main()
