"""Download companies' quarterly investor presentations from NSE announcements.

NSE's corporate-announcements feed lists each filing with a category; 'Investor Presentation'
filings link a PDF on nsearchives.nseindia.com. For every bank and NBFC/HFC in
raw/manual/{banks,nbfcs}.csv the latest presentations are saved to
raw/presentations/<SYMBOL>/<announcement date>.pdf (existing files are skipped).

Usage:  python src/fetch_presentations.py [--keep N] [SYMBOL ...]
"""
import argparse
import csv
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_results import API, get  # noqa: E402  (shares NSE session and retry logic)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "raw" / "presentations"
MANUAL = ROOT / "raw" / "manual"


def has_text(path, min_chars=2000):
    import pdfplumber
    try:
        with pdfplumber.open(path) as pdf:
            return sum(len(p.extract_text() or "") for p in pdf.pages[:10]) >= min_chars
    except Exception:
        return False


def announcements(symbol, months):
    to = date.today()
    frm = to - timedelta(days=months * 31)
    return get(API + "corporate-announcements",
               params={"index": "equities", "symbol": symbol,
                       "from_date": frm.strftime("%d-%m-%Y"), "to_date": to.strftime("%d-%m-%Y")}).json()


def press_release(rows, near):
    """A results press release (or the results filing that carries it) filed within 3 days of
    `near`: the fallback when the presentation filing is only a cover letter pointing at the
    company website."""
    best = None
    for r in rows:
        url = r.get("attchmntFile") or ""
        text = (r.get("desc") or "") + " " + (r.get("attchmntText") or "")
        # a separate press release, or the results filing (which usually carries the press release)
        if url.lower().endswith(".pdf") and re.search(r"press release|outcome of board meeting.*financial results", text, re.I):
            when = datetime.strptime(r["an_dt"], "%d-%b-%Y %H:%M:%S")
            if abs((when - near).days) <= 3 and (best is None or abs((when - near).days) < abs((best[0] - near).days)):
                best = (when, url)
    return best


def presentations(symbol, months=18, rows=None):
    rows = rows if rows is not None else announcements(symbol, months)
    out = []
    for r in rows:
        desc, text, url = r.get("desc") or "", r.get("attchmntText") or "", r.get("attchmntFile") or ""
        if not url.lower().endswith(".pdf"):
            continue
        if desc.strip().lower() == "investor presentation" or re.search(r"investor presentation", text, re.I):
            when = datetime.strptime(r["an_dt"], "%d-%b-%Y %H:%M:%S")
            out.append((when, url))
    # one per results season: drop re-filings within 20 days of a later one
    out.sort(reverse=True)
    kept = []
    for when, url in out:
        if all(abs((when - k[0]).days) > 20 for k in kept):
            kept.append((when, url))
    return kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--keep", type=int, default=5, help="latest presentations to keep per company")
    args = ap.parse_args()
    syms = args.symbols
    if not syms:
        for f in ("banks", "nbfcs"):
            with (MANUAL / f"{f}.csv").open(encoding="utf-8") as fh:
                syms += [r["symbol"] for r in csv.DictReader(fh)]
    for sym in syms:
        try:
            rows = announcements(sym, 18)
            found = presentations(sym, rows=rows)[: args.keep]
        except Exception as e:
            print(f"{sym:11s} FAILED listing: {e}")
            continue
        dest = OUT / sym
        dest.mkdir(parents=True, exist_ok=True)
        new = 0
        for when, url in found:
            target = dest / f"{when:%Y-%m-%d}.pdf"
            if target.exists():
                continue
            try:
                data = get(url).content
            except Exception as e:
                print(f"  {sym} {when:%Y-%m-%d}: {e}")
                continue
            if data[:4] != b"%PDF":
                print(f"  {sym} {when:%Y-%m-%d}: not a PDF, skipped")
                continue
            target.write_bytes(data)
            new += 1
            if not has_text(target):             # cover letter only: use the results press release
                pr = press_release(rows, when)
                if pr:
                    data = get(pr[1]).content
                    if data[:4] == b"%PDF":
                        target.write_bytes(data)
                        print(f"  {sym} {when:%Y-%m-%d}: presentation is a cover letter; used press release")
            time.sleep(0.8)
        print(f"{sym:11s} {len(found)} presentations, {new} new")
        time.sleep(1)


if __name__ == "__main__":
    main()
