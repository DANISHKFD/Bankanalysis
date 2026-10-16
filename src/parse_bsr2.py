"""Parse RBI's Annual BSR-2 (deposits of scheduled commercial banks) into data/bank.db.

Table written
  bsr2_deposits   as_of, bank_group ('All SCBs' when not split), pop_group ('All' when not
                  split), offices, current_cr, saving_cr, term_cr, total_cr, casa_pct
Sources
  2019 onward  raw/rbi/dbie/bsr2_t2_1.xlsx (population group), bsr2_t2_2.xlsx (bank group),
               bsr2_t2_10.xlsx (population group x bank group); every year side by side
  2015-2018    the combined BSR 1&2 volume zips (raw/rbi/dbie/bsr_vol), table 'Population group
               and bank group-wise deposits ... according to type of deposits' (Rs million)
Deposits exclude inter-bank deposits; regional rural banks are included, as RBI publishes.

Usage:  python src/parse_bsr2.py
"""
import io
import re
import sqlite3
import warnings
import zipfile
from pathlib import Path

import sys

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parse_bsr1 import BANK_GROUPS, POP  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "raw" / "rbi" / "dbie"
DB = ROOT / "data" / "bank.db"
warnings.filterwarnings("ignore", module="openpyxl")
TYPES = {"CURRENT": "current_cr", "SAVING": "saving_cr", "SAVINGS": "saving_cr", "TERM": "term_cr",
         "TOTAL": "total_cr", "TOTAL DEPOSITS": "total_cr"}
norm = lambda v: " ".join(str(v).upper().split())


def wide_years(d, has_bank):
    """BSR-2 tables with one block of columns per year: offices, then (accounts, amount) per type."""
    yr_row = next(i for i in range(len(d)) if any(isinstance(v, pd.Timestamp) or re.match(r"\d{4}-\d{2}-\d{2}", str(v))
                                                  for v in d.iloc[i]))
    type_row, rows = yr_row + 1, []
    blocks, year = [], None
    for c in range(d.shape[1]):
        v = d.iat[yr_row, c]
        if isinstance(v, pd.Timestamp) or re.match(r"\d{4}-\d{2}-\d{2}", str(v)):
            year = pd.Timestamp(v).date()
        t = norm(d.iat[type_row, c])
        if year and t in TYPES:
            blocks.append((year, TYPES[t], c + 1))           # amount sits in the second column of the pair
        if year and "OFFICES" in norm(d.iat[type_row + 1, c]) + norm(d.iat[type_row, c]):
            blocks.append((year, "offices", c))
    c_pop = next(c for c in range(d.shape[1]) if norm(d.iat[yr_row, c]) == "POPULATION GROUP"
                 or norm(d.iat[yr_row - 1, c]) == "POPULATION GROUP") if True else None
    c_bank = c_pop - 1 if has_bank else None
    bank = "All SCBs"
    for i in range(type_row + 2, len(d)):
        if has_bank and isinstance(d.iat[i, c_bank], str) and d.iat[i, c_bank].strip():
            bank = BANK_GROUPS.get(norm(d.iat[i, c_bank]), d.iat[i, c_bank].strip().title())
        p = norm(d.iat[i, c_pop])
        if p not in POP:
            continue
        rec = {}
        for year, col, c in blocks:
            rec.setdefault(year, {})[col] = pd.to_numeric(d.iat[i, c], errors="coerce")
        for year, vals in rec.items():
            rows.append({"as_of": year, "bank_group": bank, "pop_group": POP[p], **vals})
    return rows


def bank_only(d):
    """Table 2.2: bank group rows, no population split."""
    d = d.copy()
    lab = next(c for c in range(d.shape[1]) if d.iloc[:, c].map(norm).str.contains("PUBLIC SECTOR BANKS").any())
    d.insert(lab + 1, "pop", "ALL-INDIA")
    hdr = d.index[d.iloc[:, lab].map(norm) == "BANK GROUP"]
    if len(hdr):
        d.iat[hdr[0], lab + 1] = "Population Group"
    d.columns = range(d.shape[1])
    return wide_years(d, has_bank=True)


def volumes():
    """2015-2018 from the combined BSR 1&2 volumes."""
    rows = []
    for z in sorted((SRC / "bsr_vol").glob("*.zip")):
        with zipfile.ZipFile(z) as zf:
            for n in zf.namelist():
                if not n.lower().endswith((".xls", ".xlsx")):
                    continue
                try:
                    d = pd.read_excel(io.BytesIO(zf.read(n)), header=None)
                except Exception:
                    continue
                t = norm(" ".join(str(v) for v in d.iloc[:4].values.ravel() if isinstance(v, str)))
                if "POPULATION GROUP AND BANK GROUP-WISE DEPOSITS" in t and "TYPE OF DEPOSITS" in t:
                    rows += volume_table(d, t)
    return rows


def volume_table(d, t):
    m = re.search(r"MARCH\s*-?\s*(\d{4})", t)
    as_of = f"{m.group(1)}-03-31"
    scale = 0.1 if "MILLION" in t else 1.0
    hdr = next(i for i in range(len(d)) if d.iloc[i].map(norm).eq("POPULATION GROUP").any()
               or d.iloc[i].map(norm).str.startswith("POPULATION").any())
    c_pop = next(c for c in range(d.shape[1]) if norm(d.iat[hdr, c]).startswith("POPULATION"))
    cols = {}
    for c in range(d.shape[1]):
        for r in (hdr, hdr + 1):
            t2 = norm(d.iat[r, c])
            for k, v in TYPES.items():
                if t2 == k or t2.startswith(k + " "):
                    cols.setdefault(v, c)
    rows, bank = [], None
    for i in range(hdr + 1, len(d)):
        b = d.iat[i, c_pop - 1]
        if isinstance(b, str) and b.strip():
            bank = BANK_GROUPS.get(norm(b), b.strip().title())
        p = norm(d.iat[i, c_pop])
        if p not in POP or not bank:
            continue
        rec = {"as_of": as_of, "bank_group": bank, "pop_group": POP[p]}
        for k, c in cols.items():
            # amount column: the type header spans (accounts, amount); amount is the last numeric in the span
            v = pd.to_numeric(d.iat[i, c + 1], errors="coerce")
            rec[k] = v * scale if pd.notna(v) else None
        rows.append(rec)
    return rows


def main():
    rows = []
    for key, kind in (("bsr2_t2_10", "popbank"), ("bsr2_t2_1", "pop"), ("bsr2_t2_2", "bank")):
        f = SRC / f"{key}.xlsx"
        if not f.exists():
            continue
        d = pd.read_excel(f, header=None)
        rows += wide_years(d, has_bank=True) if kind == "popbank" else wide_years(d, False) if kind == "pop" else bank_only(d)
    rows += volumes()
    df = pd.DataFrame(rows)
    if df.empty:
        print("no BSR-2 data parsed")
        return
    df["as_of"] = df.as_of.astype(str)
    num = ["offices", "current_cr", "saving_cr", "term_cr", "total_cr"]
    df = (df.groupby(["as_of", "bank_group", "pop_group"], as_index=False)[[c for c in num if c in df]]
          .sum(min_count=1))                       # SBI group + nationalised banks -> PSU banks
    # older volumes list bank groups only: add the all-bank rows from their sum
    have_all = set(df[df.bank_group == "All SCBs"].as_of)
    add = (df[~df.as_of.isin(have_all)].groupby(["as_of", "pop_group"], as_index=False)
           [[c for c in num if c in df]].sum(min_count=1).assign(bank_group="All SCBs"))
    df = pd.concat([df, add], ignore_index=True)
    df["casa_pct"] = (df.current_cr + df.saving_cr) / df.total_cr * 100
    with sqlite3.connect(DB) as con:
        df.to_sql("bsr2_deposits", con, if_exists="replace", index=False)
    a = df[(df.bank_group == "All SCBs")].pivot_table(index="as_of", columns="pop_group", values="total_cr")
    print(f"bsr2_deposits: {len(df)} rows, years {sorted(df.as_of.str[:4].unique())}")
    print((a.div(a["All"], axis=0) * 100).round(1).to_string())


if __name__ == "__main__":
    main()
