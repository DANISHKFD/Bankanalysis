"""Download banks' quarterly financial-result XBRL filings from NSE.

Two NSE listings cover the history:
  - corporates-financial-results  : old-format filings, up to Dec-2024
  - integrated-filing-results     : SEBI 'Integrated Filing - Financials', Mar-2025 on
Standalone filings only; when a period was filed more than once, the latest wins.
Files land in raw/nse/<SYMBOL>/<period-end>.xml; existing files are skipped unless
the bank has since filed a newer version (tracked in _fetched.json).

Usage:
    python src/fetch_results.py                       # all banks in raw/manual/banks.csv
    python src/fetch_results.py --universe nbfcs      # NBFCs/HFCs in raw/manual/nbfcs.csv
    python src/fetch_results.py HDFCBANK SBIN         # selected symbols
    python src/fetch_results.py --since 2020-06-30
"""
import argparse
import csv
import json
import time
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "raw" / "nse"
MANUAL = ROOT / "raw" / "manual"
API = "https://www.nseindia.com/api/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36",
    "Referer": "https://www.nseindia.com/",
    "Accept": "application/json, text/plain, */*",
}
session = requests.Session()
session.headers.update(HEADERS)


def get(url, **kw):
    for attempt in range(4):
        try:
            r = session.get(url, timeout=60, **kw)
            if r.status_code == 200:
                return r
            if r.status_code in (401, 403, 429, 503):
                time.sleep(5 * (attempt + 1))
                continue
            r.raise_for_status()
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(3)
    raise RuntimeError(f"{url}: failed after retries")


def parse_dt(*vals):
    """First parseable NSE timestamp among vals (fields are sometimes null)."""
    for v in vals:
        for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M", "%d-%b-%Y"):
            try:
                return datetime.strptime(str(v).title(), fmt)
            except (TypeError, ValueError):
                pass
    return datetime.min


def listings(symbol):
    """[(period_end, broadcast_datetime, xbrl_url, source)] for standalone filings."""
    out = []
    old = get(API + "corporates-financial-results",
              params={"index": "equities", "symbol": symbol, "period": "Quarterly"}).json()
    for r in old:
        if r.get("consolidated") != "Non-Consolidated" or not str(r.get("xbrl", "")).endswith(".xml"):
            continue
        pe = parse_dt(r.get("toDate")).date()
        bc = parse_dt(r.get("broadCastDate"), r.get("filingDate"), r.get("exchdisstime"))
        if pe.year > 1900:
            out.append((pe, bc, r["xbrl"], "old"))
    new = get(API + "integrated-filing-results",
              params={"index": "equities", "symbol": symbol,
                      "type": "Integrated Filing- Financials"}).json().get("data", [])
    for r in new:
        if r.get("consolidated") != "Standalone" or not str(r.get("xbrl", "")).endswith(".xml"):
            continue
        pe = parse_dt(r.get("qe_Date")).date()
        bc = parse_dt(r.get("broadcast_Date"), r.get("creation_Date"))
        if pe.year > 1900:
            out.append((pe, bc, r["xbrl"], "integrated"))
    return out, {"old": old, "integrated": new}


def fetch(symbol, since):
    dest = OUT / symbol
    dest.mkdir(parents=True, exist_ok=True)
    rows, raw = listings(symbol)
    (dest / "_index.json").write_text(json.dumps(raw, indent=1), encoding="utf-8")
    latest = {}
    for pe, bc, url, src in rows:
        if pe >= since and (pe not in latest or bc > latest[pe][0]):
            latest[pe] = (bc, url, src)
    got = skipped = 0
    missing = []
    log = dest / "_fetched.json"
    fetched = json.loads(log.read_text(encoding="utf-8")) if log.exists() else {}
    for pe in sorted(latest):
        target = dest / f"{pe.isoformat()}.xml"
        url = latest[pe][1]
        if target.exists() and fetched.setdefault(pe.isoformat(), url) == url:
            skipped += 1
            continue
        if target.exists():
            print(f"  {symbol} {pe}: revised filing, replacing")
        try:
            data = get(latest[pe][1]).content
        except requests.HTTPError as e:  # NSE's archive lacks some older files (404)
            missing.append(f"{pe}\t{latest[pe][1]}\t{e.response.status_code if e.response is not None else ''}")
            continue
        if b"<xbrli:xbrl" not in data[:4000] and b"xbrl" not in data[:400].lower():
            print(f"  {symbol} {pe}: not an XBRL document, skipped")
            continue
        target.write_bytes(data)
        fetched[pe.isoformat()] = url
        got += 1
        time.sleep(0.6)
    log.write_text(json.dumps(fetched, indent=1, sort_keys=True), encoding="utf-8")
    (dest / "_missing.tsv").write_text("\n".join(missing), encoding="utf-8")
    periods = sorted(latest)
    print(f"{symbol:11s} {len(periods):3d} quarters {periods[0] if periods else '-'} .. "
          f"{periods[-1] if periods else '-'}  new={got} cached={skipped} missing={len(missing)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--since", default="2020-06-30")
    ap.add_argument("--universe", default="banks", choices=["banks", "nbfcs"])
    args = ap.parse_args()
    since = datetime.strptime(args.since, "%Y-%m-%d").date()
    with (MANUAL / f"{args.universe}.csv").open(encoding="utf-8") as fh:
        universe = [r["symbol"] for r in csv.DictReader(fh)]
    for sym in args.symbols or universe:
        try:
            fetch(sym, since)
        except Exception as e:  # one bank failing should not stop the rest
            print(f"{sym:11s} FAILED: {e}")
        time.sleep(1)


if __name__ == "__main__":
    main()
