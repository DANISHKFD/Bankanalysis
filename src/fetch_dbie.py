"""Export tables from RBI's DBIE portal (data.rbi.org.in) to Excel.

DBIE publications open as SAP BusinessObjects (Web Intelligence) reports through a
session-specific link, so there is no plain file URL. This drives the portal in headless
Chromium: open the publication page, click through to the table by the start of each
title (section names such as '... - March 2026' change every year), and use the report's
own 'Export -> Excel' button. Files land in raw/rbi/dbie/<key>.xlsx and are re-exported
when more than a week old.

Tables:
  spatial_s1    Quarterly Spatial Distribution of Deposits and Credit (excl. RRBs),
                Statement 1 'Commercial Banks at a Glance': offices and growth rates by
                population group and bank group, credit-deposit ratio
  spatial_s3a   Statement 3A: offices, deposits and credit by population group (rural /
                semi-urban / urban / metropolitan) x region x state, Mar-2023 onward
                (the earlier 2004-2022 series includes RRBs, so it is not spliced on)
  bsr2_t2_1, bsr2_t2_2, bsr2_t2_10
                Annual BSR-2 deposits by population group, bank group, and both, by type of
                deposit (current / saving / term), March 2019 onward (all years selected)
  volumes       'Basic Statistical Returns of SCBs - Vol NN' zips, March 2015 onward: every
                BSR-1 table as Excel, downloaded directly (no report viewer)
  bsr1_t1_1 .. bsr1_t1_11
                Annual BSR-1 summary tables for the latest March: bank group, population
                group, state, size of credit limit, interest rate range, type of account,
                organisation of borrower

Usage:  python src/fetch_dbie.py [key ...]
"""
import sys
import time
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "raw" / "rbi" / "dbie"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")
BASE = "https://data.rbi.org.in/DBIE/#/dbie/reports/Publication/Time-Series%20Publications/"
SPATIAL = "Quarterly Spatial Distribution of Deposits and Credit"
BSR1 = "Annual Basic Statistical Return (BSR)-1 on Credit by Scheduled Commercial Banks - (Including Regional Rural Banks)"
BSR1_YEAR = "Basic Statistical Returns of Scheduled Commercial Banks in India - March"   # + year
SUMMARY = "Section 1 : Summary Tables"
BSR2 = "Annual Basic Statistical Return (BSR)-2 on Deposits with Scheduled Commercial Banks - (Including Regional Rural Banks)"
BSR2_DEP = ["Basic Statistical Return (BSR)- 2 - Deposits with SCBs", "Section 2: Deposits"]
# key: (publication, [titles to click in order; the last one opens the report])
TABLES = {
    "spatial_s1": (SPATIAL, ["Spatial Distribution of Deposits and Credit - (Excluding",
                             "Statement No. 1 : Commercial Banks at a Glance"]),
    "spatial_s3a": (SPATIAL, ["Spatial Distribution of Deposits and Credit - (Excluding", "Statement No. 3A"]),
    "bsr1_t1_1": (BSR1, [BSR1_YEAR, SUMMARY, "Table No 1.1 Bank Group-wise"]),
    "bsr1_t1_2": (BSR1, [BSR1_YEAR, SUMMARY, "Table No 1.2 Population Group-wise"]),
    "bsr1_t1_3": (BSR1, [BSR1_YEAR, SUMMARY, "Table No 1.3 State-wise"]),
    "bsr1_t1_8": (BSR1, [BSR1_YEAR, SUMMARY, "Table No 1.8 Outstanding Credit of SCBs According to Size"]),
    "bsr1_t1_9": (BSR1, [BSR1_YEAR, SUMMARY, "Table No 1.9 Outstanding Credit of SCBs According to Interest"]),
    "bsr1_t1_10": (BSR1, [BSR1_YEAR, SUMMARY, "Table No 1.10 Outstanding Credit of SCBs According to Type"]),
    "bsr1_t1_11": (BSR1, [BSR1_YEAR, SUMMARY, "Table No 1.11 Outstanding Credit of SCBs According to Organisation"]),
    "bsr1_t2_11": (BSR1, [BSR1_YEAR, "Section 2 : Credit", "Table No 2.11 Population Group and Bank Group"]),
    # BSR-2 deposits, March 2019 onward (earlier years are in the annual volume zips)
    "bsr2_t2_1": (BSR2, BSR2_DEP + ["Table No. 2.1 - Deposits of Scheduled Commercial Banks According to Population"]),
    "bsr2_t2_2": (BSR2, BSR2_DEP + ["Table No. 2.2 - Deposits of Scheduled Commercial Banks According to Bank Group"]),
    "bsr2_t2_10": (BSR2, BSR2_DEP + ["Table No. 2.10 - Population Group and Bank Group-Wise Deposits"]),
}
ALL_PERIODS = {"bsr2_t2_1", "bsr2_t2_2", "bsr2_t2_10"}   # reports that open on the latest year only
MAX_AGE_DAYS = 7   # quarterly/annual data; re-export at most weekly
# exported only when named on the command line: RBI's server has timed out on this
# export, and the same table arrives a year later in the annual volume zip
ON_REQUEST = {"bsr1_t2_11"}


def open_report(ctx, pub, steps):
    page = ctx.new_page()
    page.goto("https://data.rbi.org.in/DBIE/#/dbie/home", wait_until="load", timeout=90000)
    page.wait_for_timeout(5000)
    page.goto(BASE + quote(pub), wait_until="load", timeout=90000)
    for i, title in enumerate(steps):
        link = page.get_by_text(title, exact=False).first
        link.wait_for(timeout=60000)
        page.wait_for_timeout(800)
        if i < len(steps) - 1:
            link.click()
            page.wait_for_timeout(2500)
        else:
            with ctx.expect_page(timeout=60000) as pi:
                link.click()
            return page, pi.value


def export(ctx, key, pub, steps):
    """Open one table and save its Excel export."""
    target = OUT / f"{key}.xlsx"
    if target.exists() and time.time() - target.stat().st_mtime < MAX_AGE_DAYS * 86400:
        print(f"[{key}] exported less than {MAX_AGE_DAYS} days ago, skipped")
        return
    page, rep = open_report(ctx, pub, steps)
    frame = None
    for _ in range(90):                       # the Webi viewer loads inside an iframe
        rep.wait_for_timeout(2000)
        for f in rep.frames:
            if f == rep.main_frame:
                continue
            try:
                if f.locator("[title^='Export']").count():
                    frame = f
            except Exception:
                pass
        if frame:
            break
    if frame is None:
        raise RuntimeError(f"{key}: report viewer did not load")
    if key in ALL_PERIODS:
        # these reports open on the latest year only: tick 'All' in the Quarter filter first
        frame.get_by_text("Quarter", exact=True).first.click()
        frame.get_by_text("All", exact=True).first.click()
        frame.get_by_role("button", name="OK", exact=True).click()
        rep.wait_for_timeout(4000)
        for _ in range(60):                   # wait for the refresh dialog to close
            if not frame.get_by_text("Refresh Document").count():
                break
            rep.wait_for_timeout(2000)
    frame.locator("[title^='Export']").first.click()
    frame.get_by_role("button", name="Export", exact=True).wait_for(timeout=30000)
    with rep.expect_download(timeout=600000) as di:
        frame.get_by_role("button", name="Export", exact=True).click()
    di.value.save_as(target)
    print(f"[{key}] saved {target.relative_to(ROOT)} ({target.stat().st_size // 1024} KB)")
    rep.close()
    page.close()


VOLS = OUT / "bsr_vol"
FIRST_VOL = 44          # Vol 44 = March 2015; Vol N = March (1971 + N)


def fetch_volumes(ctx):
    """Annual 'Basic Statistical Returns of SCBs - Vol NN' zips (every BSR-1 table as Excel).

    These come as plain file downloads, not through the report viewer, so they are light.
    Already-downloaded volumes are skipped; a new one appears each year.
    """
    VOLS.mkdir(parents=True, exist_ok=True)
    page = ctx.new_page()
    page.goto("https://data.rbi.org.in/DBIE/#/dbie/home", wait_until="load", timeout=90000)
    page.wait_for_timeout(5000)
    page.goto(BASE + quote(BSR1), wait_until="load", timeout=90000)
    for t in ("BSR 1&2 - Historical Data", "From 2002 to"):
        page.get_by_text(t, exact=False).first.wait_for(timeout=60000)
        page.wait_for_timeout(800)
        page.get_by_text(t, exact=False).first.click()
        page.wait_for_timeout(2500)
    page.get_by_text("Basic Statistical Returns of SCBs - Vol", exact=False).first.wait_for(timeout=60000)
    links = page.get_by_text("Basic Statistical Returns of SCBs - Vol", exact=False)
    titles = [links.nth(i).inner_text().strip() for i in range(links.count())]
    for title in titles:
        vol = int(title.split()[-1])           # some titles use non-breaking spaces
        target = VOLS / f"vol{vol}_{1971 + vol}-03.zip"
        if vol < FIRST_VOL or target.exists():
            continue
        got = []
        handler = lambda pg: pg.on("download", lambda d: got.append(d))
        ctx.on("page", handler)
        links.nth(titles.index(title)).click()
        for _ in range(60):
            page.wait_for_timeout(1000)
            if got:
                break
        ctx.remove_listener("page", handler)
        if not got:
            print(f"[{title}] no download")
            continue
        got[0].save_as(target)
        for pg in ctx.pages:
            if pg is not page:
                pg.close()
        print(f"[{title}] saved {target.relative_to(ROOT)} ({target.stat().st_size // 1024} KB)")
    page.close()


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    keys = sys.argv[1:] or [k for k in TABLES if k not in ON_REQUEST] + ["volumes"]
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(user_agent=UA, accept_downloads=True)
        for k in keys:
            try:
                fetch_volumes(ctx) if k == "volumes" else export(ctx, k, *TABLES[k])
            except Exception as e:      # keep going if one table fails
                print(f"[{k}] FAILED: {str(e).splitlines()[0]}")
        b.close()


if __name__ == "__main__":
    main()
