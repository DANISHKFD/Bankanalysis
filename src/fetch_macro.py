"""Keep the two hand-started macro inputs current without typing.

  CPI (base 2024)  MoSPI's home-page feed lists its latest releases; each new
                   'Press release of CPI for the month of ...' PDF is saved to
                   raw/mospi/cpi_<YYYY>-<Month>.pdf. Every release PDF there is
                   then parsed: the headline sentence gives the new month's
                   provisional inflation, and the page-1 table gives combined
                   inflation and index for both that month and the previous one
                   (now final). Results are merged into
                   raw/manual/cpi_2024base_headline.csv (final beats provisional).
  Repo rate        read from the 'Current Rates' box on rbi.org.in; when it differs
                   from the last row of raw/manual/repo_rate.csv a row is appended,
                   dated the day the change was seen (MPC changes take effect the
                   same day, and this runs daily).

Usage:  python src/fetch_macro.py
"""
import re
from datetime import date
from pathlib import Path

import pandas as pd
import pdfplumber
import requests

ROOT = Path(__file__).resolve().parent.parent
MOSPI = ROOT / "raw" / "mospi"
CPI_CSV = ROOT / "raw" / "manual" / "cpi_2024base_headline.csv"
REPO_CSV = ROOT / "raw" / "manual" / "repo_rate.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                         "(KHTML, like Gecko) Chrome/140.0 Safari/537.36"}
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
NUM = re.compile(r"^\d{1,3}\.\d{2}$")


def fetch_cpi_releases():
    feed = requests.get("https://www.mospi.gov.in/api/main-site/get-home-main-site-data?lang=en",
                        headers=HEADERS, timeout=60).json()
    new = []
    for r in feed.get("latestReleasesData", []):
        m = re.search(r"CPI.*?month of\s+([A-Za-z]+),?\s+(\d{4})", r.get("title", ""), re.I)
        path = (r.get("file_one") or {}).get("path")
        if not (m and path):
            continue
        target = MOSPI / f"cpi_{m.group(2)}-{m.group(1).title()}.pdf"
        if target.exists():
            continue
        data = requests.get(f"https://www.mospi.gov.in/{path}", headers=HEADERS, timeout=120).content
        if data[:4] != b"%PDF":
            print(f"  CPI: {target.name} did not download as a PDF")
            continue
        target.write_bytes(data)
        new.append(target.name)
    print(f"CPI releases: {len(new)} new {new if new else ''}")


def parse_release(path):
    """Rows (month, index, inflation, status) from one CPI press release."""
    page = pdfplumber.open(path).pages[0]
    text = page.extract_text()
    m = re.search(r"All India Consumer Price Index.*?month of\s+([A-Za-z]+),?\s+(\d{4})\s+over"
                  r".*?is\s+([\d.]+)\s*%", text, re.S)
    if not m:
        return []
    cur = pd.Timestamp(f"{m.group(2)}-{MONTHS.index(m.group(1).title()) + 1:02d}-01")
    prev = cur - pd.DateOffset(months=1)
    rows = {cur: {"month": cur, "inflation_yoy": float(m.group(3)), "status": "provisional"}}

    # page-1 table: columns Rural/Urban/Combined under '<Month> (Final)' and
    # '<Month> (Provisional)'; locate the two 'Combined' columns by position
    words = page.extract_words()
    combined = sorted((w for w in words if w["text"] == "Combined"), key=lambda w: w["x0"])[:2]
    marks = [w for w in words if w["text"] in ("(Final)", "(Provisional)")]
    if len(combined) == 2 and len(marks) >= 2:
        mid = lambda w: (w["x0"] + w["x1"]) / 2
        cols = [(mid(c), min(marks, key=lambda w: abs(mid(w) - mid(c)))["text"].strip("()").lower())
                for c in combined]
        lines = {}
        for w in words:
            if NUM.match(w["text"]) and w["top"] > combined[0]["top"]:
                lines.setdefault(round(w["top"] / 3), []).append(w)

        def first_row(ok):
            for k in sorted(lines):
                vals = {}
                for x, status in cols:
                    near = [w for w in lines[k] if abs(mid(w) - x) < 18]
                    if near:
                        v = float(min(near, key=lambda w: abs(mid(w) - x))["text"])
                        if ok(v):
                            vals[status] = v
                if len(vals) == 2:
                    return vals

        infl = first_row(lambda v: v < 30) or {}      # CPI (General) inflation row
        index = first_row(lambda v: v > 50) or {}     # CPI (General) index row
        if "final" in infl:
            rows[prev] = {"month": prev, "inflation_yoy": infl["final"], "status": "final",
                          "index_combined": index.get("final")}
        rows[cur]["index_combined"] = index.get("provisional")
    for r in rows.values():
        r["source"] = f"MoSPI CPI release (raw/mospi/{path.name})"
    return list(rows.values())


def update_cpi_table():
    old = pd.read_csv(CPI_CSV, parse_dates=["month"])
    parsed = [r for f in sorted(MOSPI.glob("*.pdf")) for r in parse_release(f)]
    if not parsed:
        return
    new = pd.DataFrame(parsed)
    new = new[new.month >= "2026-01-01"]           # base-2024 series starts Jan-2026
    rank = {"provisional": 0, "final": 1}
    allrows = pd.concat([old.assign(_o=0), new.assign(_o=1)], ignore_index=True)
    allrows["_r"] = allrows.status.map(rank)
    # keep the best status per month; among equals prefer the parsed value
    best = (allrows.sort_values(["month", "_r", "_o"])
            .groupby("month").tail(1)
            .drop(columns=["_o", "_r"]))
    # parsed rows without an index keep the earlier index for that month
    keep_idx = old.set_index("month").index_combined
    best["index_combined"] = best.index_combined.fillna(best.month.map(keep_idx))
    best = best[["month", "index_combined", "inflation_yoy", "status", "source"]].sort_values("month")
    changed = len(best) != len(old) or not best.reset_index(drop=True)[
        ["month", "inflation_yoy", "status"]].equals(old[["month", "inflation_yoy", "status"]])
    text = best.assign(month=best.month.dt.date).to_csv(index=False, float_format="%.2f", lineterminator="\n")
    if text != CPI_CSV.read_text(encoding="utf-8"):   # leave the file untouched when nothing moved
        CPI_CSV.write_text(text, encoding="utf-8", newline="\n")
    print(f"CPI table: {len(best)} months to {best.month.max():%b-%Y}"
          f" ({'updated' if changed else 'no change'})")


def update_repo():
    page = requests.get("https://rbi.org.in/home.aspx", headers=HEADERS, timeout=60).text
    text = re.sub(r"<[^>]+>", " ", page)
    m = re.search(r"Policy Repo Rate\s*:\s*([\d.]+)\s*%", text)
    if not m:
        print("Repo rate: not found on rbi.org.in (page layout changed?)")
        return
    rate = float(m.group(1))
    rr = pd.read_csv(REPO_CSV)
    last = float(rr.repo_rate.iloc[-1])
    if abs(rate - last) < 1e-9:
        print(f"Repo rate: {rate:.2f}% (no change)")
        return
    row = {"effective_date": date.today().isoformat(), "repo_rate": f"{rate:.2f}",
           "change_bps": round((rate - last) * 100), "note": "auto: seen on rbi.org.in; date = day detected"}
    pd.concat([rr, pd.DataFrame([row])]).to_csv(REPO_CSV, index=False)
    print(f"Repo rate: {last:.2f}% -> {rate:.2f}% (appended)")


def main():
    for step in (fetch_cpi_releases, update_cpi_table, update_repo):
        try:
            step()
        except Exception as e:  # one source failing should not stop the other
            print(f"{step.__name__} FAILED: {e}")


if __name__ == "__main__":
    main()
