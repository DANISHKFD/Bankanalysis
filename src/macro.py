"""Macro series used alongside the banking data, written to data/bank.db.

  cpi        all-India CPI (Combined, General) monthly YoY inflation
             - base 2012=100 from the MoSPI API (api.mospi.gov.in) up to Dec-2025
             - base 2024=100 from raw/manual/cpi_2024base_headline.csv (typed from
               the monthly MoSPI / PIB press releases kept in raw/mospi/) from Jan-2026
             The two bases are different baskets; YoY rates are used as one series
             with a `base` column so the break stays visible.
  repo_rate  RBI policy repo rate, one row per MPC decision, plus a monthly
             (month-end) series in repo_monthly

Usage:  python src/macro.py
"""
import sqlite3
import ssl
import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "bank.db"
MANUAL = ROOT / "raw" / "manual"
CACHE = ROOT / "raw" / "mospi" / "cpi_2012base_api.csv"
API = "https://api.mospi.gov.in/api/cpi/getCPIIndex"
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


class LegacyTLSAdapter(requests.adapters.HTTPAdapter):
    """api.mospi.gov.in needs legacy TLS renegotiation, which OpenSSL 3 refuses
    by default. Certificates are still verified."""

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


def fetch_cpi_2012(years=range(2013, 2026)):
    s = requests.Session()
    s.mount("https://api.mospi.gov.in", LegacyTLSAdapter())
    rows = []
    for y in years:
        page = 1
        while True:
            r = s.get(API, params={
                "base_year": 2012, "series": "Current", "year": y, "sector_code": 3,
                "group_code": 0, "format": "json", "page": page, "limit": 100}, timeout=60)
            r.raise_for_status()
            js = r.json()
            data = js.get("data") or []
            rows += [d for d in data if d.get("state") == "All India"
                     and d.get("subgroup") == "General-Overall"]
            meta = js.get("meta_data") or {}
            if page >= int(meta.get("totalPages", 1)):
                break
            page += 1
            time.sleep(0.3)
    df = pd.DataFrame(rows)
    df["month"] = pd.to_datetime(df["year"].astype(str) + "-" +
                                 df["month"].map(lambda m: MONTHS.index(m) + 1).astype(str) + "-01")
    df = df.rename(columns={"index": "index_value", "inflation": "inflation_yoy"})
    df["index_value"] = pd.to_numeric(df["index_value"], errors="coerce")
    df["inflation_yoy"] = pd.to_numeric(df["inflation_yoy"], errors="coerce")
    return (df[["month", "index_value", "inflation_yoy", "status"]]
            .drop_duplicates("month").sort_values("month"))


def build_cpi(refresh=False):
    if refresh or not CACHE.exists():
        fetch_cpi_2012().to_csv(CACHE, index=False)
    old = pd.read_csv(CACHE, parse_dates=["month"]).assign(base="2012")
    new = (pd.read_csv(MANUAL / "cpi_2024base_headline.csv", parse_dates=["month"])
           .rename(columns={"index_combined": "index_value"})
           .assign(base="2024"))
    cpi = pd.concat([old[old.month < "2026-01-01"], new[["month", "index_value",
                    "inflation_yoy", "status", "base"]]], ignore_index=True)
    cpi["month"] = cpi["month"].dt.date
    return cpi.sort_values("month").reset_index(drop=True)


def build_repo():
    rr = pd.read_csv(MANUAL / "repo_rate.csv", parse_dates=["effective_date"])
    months = pd.date_range("2018-01-01", pd.Timestamp.today().normalize(), freq="MS")
    # rate in force at each month end
    me = months + pd.offsets.MonthEnd(0)
    idx = rr.set_index("effective_date")["repo_rate"].sort_index()
    vals = [idx[idx.index <= d].iloc[-1] if (idx.index <= d).any() else None for d in me]
    monthly = pd.DataFrame({"month": months.date, "repo_rate": vals}).dropna()
    rr["effective_date"] = rr["effective_date"].dt.date
    return rr, monthly


def main():
    cpi = build_cpi()
    rr, rm = build_repo()
    with sqlite3.connect(DB) as con:
        cpi.to_sql("cpi", con, if_exists="replace", index=False)
        rr.to_sql("repo_rate", con, if_exists="replace", index=False)
        rm.to_sql("repo_monthly", con, if_exists="replace", index=False)
    print(f"cpi:          {len(cpi)} rows {cpi.month.min()} .. {cpi.month.max()}")
    print(cpi.tail(14).to_string(index=False))
    print(f"repo_rate:    {len(rr)} decisions; repo_monthly {rm.month.min()} .. {rm.month.max()}")


if __name__ == "__main__":
    main()
