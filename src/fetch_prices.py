"""Daily closing prices for the covered banks and NBFCs from NSE's bhavcopy.

NSE publishes one zip per trading day at nsearchives.nseindia.com (the UDiFF
'BhavCopy_NSE_CM' file). Only the equity rows of covered symbols are kept, in
raw/nse/bhav/<YYYY-MM-DD>.csv:
    symbol, close, prev_close (NSE's previous close, adjusted for corporate actions)

Dates fetched:
  - every trading day from the oldest 'latest results quarter' to today, so splits and
    bonuses since the last filing can be detected (valuation.py)
  - every quarter end from Mar-2023 and the day one year before today, for valuation
    history and one-year returns (the last trading day on or before each date)

Usage:  python src/fetch_prices.py
"""
import csv
import io
import sqlite3
import time
import zipfile
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "raw" / "nse" / "bhav"
DB = ROOT / "data" / "bank.db"
URL = "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{:%Y%m%d}_F_0000.csv.zip"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                         "(KHTML, like Gecko) Chrome/140.0 Safari/537.36"}
session = requests.Session()
session.headers.update(HEADERS)


def universe():
    syms = set()
    for f in ("banks", "nbfcs"):
        syms |= set(pd.read_csv(ROOT / "raw" / "manual" / f"{f}.csv").symbol)
    return syms


def get_day(d, syms):
    """Save the day's file; True if NSE had one (False on holidays/weekends)."""
    target = OUT / f"{d:%Y-%m-%d}.csv"
    if target.exists():
        return True
    if d.weekday() >= 5:
        return False
    r = session.get(URL.format(d), timeout=60)
    if r.status_code == 404 or not r.content.startswith(b"PK"):
        return False
    r.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        text = z.read(z.namelist()[0]).decode("utf-8")
    rows = [(x["TckrSymb"], x["ClsPric"], x["PrvsClsgPric"]) for x in csv.DictReader(io.StringIO(text))
            if x["TckrSymb"] in syms and x["SctySrs"] in ("EQ", "BE")]
    with target.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["symbol", "close", "prev_close"])
        w.writerows(rows)
    time.sleep(0.3)
    return True


def last_trading_day(d, syms, back=7):
    for i in range(back):
        if get_day(d - timedelta(days=i), syms):
            return d - timedelta(days=i)
    return None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    syms = universe()
    today = date.today()
    with sqlite3.connect(DB) as con:
        latest = pd.read_sql("select max(period_end) d from bank_quarter group by symbol "
                             "union all select max(period_end) from nbfc_quarter group by symbol", con)
    start = pd.to_datetime(latest.d).min().date()
    n = 0
    d = start
    while d <= today:
        n += get_day(d, syms)
        d += timedelta(days=1)
    anchors = [q.date() for q in pd.date_range("2023-03-31", today, freq="QE")] + [today - timedelta(days=365)]
    got = [last_trading_day(a, syms) for a in anchors]
    print(f"prices: {n} trading days {start} .. {today}; {sum(g is not None for g in got)} anchor dates; "
          f"{len(list(OUT.glob('*.csv')))} files in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
