"""Parse RBI's Annual BSR-1 (credit of scheduled commercial banks) exports from DBIE.

Tables written (data/bank.db)
  bsr1_dist   latest-March snapshot by one dimension at a time:
                as_of, dimension, category, ord, accounts, credit_limit_cr, outstanding_cr, share_pct
              dimensions: Bank group, Population group (sanction / utilisation), State,
              Credit limit size, Interest rate, Type of account, Organisation
  bsr1_ts     time series (if exported): as_of, bank_group, pop_group, occupation, outstanding_cr
              aggregated over districts

Source files: raw/rbi/dbie/bsr1_*.xlsx (written by fetch_dbie.py). Amounts in Rs crore.
Includes regional rural banks, as RBI's BSR-1 publication does.

Usage:  python src/parse_bsr1.py
"""
import re
import sqlite3
import warnings
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "raw" / "rbi" / "dbie"
DB = ROOT / "data" / "bank.db"
warnings.filterwarnings("ignore", module="openpyxl")

# file key: (dimension, value columns after the label, in order)
SIMPLE = {
    "bsr1_t1_1": ("Bank group", ["offices", "accounts", "outstanding_cr"]),
    "bsr1_t1_8": ("Credit limit size", ["accounts", "credit_limit_cr", "outstanding_cr"]),
    "bsr1_t1_9": ("Interest rate", ["accounts", "credit_limit_cr", "outstanding_cr"]),
    "bsr1_t1_10": ("Type of account", ["accounts", "credit_limit_cr", "outstanding_cr"]),
    "bsr1_t1_11": ("Organisation", ["accounts", "credit_limit_cr", "outstanding_cr"]),
}
TOTALS = re.compile(r"^(TOTAL|ALL[- ]INDIA|ALL INDIA|GRAND TOTAL|TOTAL LOANS|ALL SCHEDULED COMMERCIAL BANKS)", re.I)


def as_of(d):
    title = " ".join(str(v) for v in d.iloc[:4].values.ravel() if isinstance(v, str))
    m = re.search(r"MARCH\s*-?\s*(\d{4})", title, re.I)
    return f"{m.group(1)}-03-31" if m else None


def numeric_rows(d):
    """(label, [numbers]) for data rows; skips headers, notes and the '(12.3)' share rows."""
    out = []
    for _, r in d.iterrows():
        vals = [v for v in r.values if not (isinstance(v, float) and pd.isna(v))]
        if not vals:
            continue
        label = vals[0]
        if not isinstance(label, str):
            continue
        nums = [v for v in vals[1:] if isinstance(v, (int, float))]
        if len(nums) < 2:
            continue
        out.append((" ".join(label.split()), nums))
    return out


def parse_simple(key, dim, cols):
    f = SRC / f"{key}.xlsx"
    if not f.exists():
        return []
    d = pd.read_excel(f, header=None)
    date = as_of(d)
    rows = []
    for i, (label, nums) in enumerate(numeric_rows(d)):
        if label.isdigit():                    # the '1 2 3' column-number row
            continue
        # organisation rows are nested: '1. PUBLIC SECTOR' (level 1), 'a) ...', '4.1 ...', '(a) Male' (level 2)
        level, clean = 1, label
        if dim == "Organisation":   # other tables' labels start with real numbers ('5% and above')
            level = 1 if re.match(r"^\d+\.\s*[A-Za-z]", label) or not re.match(r"^(\d|\(?[a-z]\))", label) else 2
            clean = re.sub(r"^(\d+(\.\d+)?\.?|\(?[a-z]\))\s*", "", label).strip()
        rec = {"as_of": date, "dimension": dim, "category": clean.title() if clean.isupper() else clean, "ord": i,
               "level": level, "is_total": bool(TOTALS.match(clean))}
        rec.update(dict(zip(cols, nums)))
        rows.append(rec)
    return rows


def parse_pop():
    f = SRC / "bsr1_t1_2.xlsx"
    if not f.exists():
        return []
    d = pd.read_excel(f, header=None)
    date, rows = as_of(d), []
    for i, (label, nums) in enumerate(numeric_rows(d)):
        if label.isdigit() or len(nums) < 4:
            continue
        for basis, (a, o) in (("sanction", nums[0:2]), ("utilisation", nums[2:4])):
            rows.append({"as_of": date, "dimension": f"Population group ({basis})", "category": label.title(),
                         "ord": i, "is_total": bool(TOTALS.match(label)), "accounts": a, "outstanding_cr": o})
    return rows


def parse_state():
    f = SRC / "bsr1_t1_3.xlsx"
    if not f.exists():
        return []
    d = pd.read_excel(f, header=None)
    date, rows = as_of(d), []
    for i, (label, nums) in enumerate(numeric_rows(d)):
        if label.isdigit() or len(nums) < 5:
            continue
        region = label.upper().endswith("REGION")
        rows.append({"as_of": date, "dimension": "Region" if region else "State", "category": label.title(),
                     "ord": i, "is_total": bool(TOTALS.match(label)),
                     "sanctioned_cr": nums[0], "outstanding_cr": nums[4]})   # credit utilised in the state
    return rows


VOLS = SRC / "bsr_vol"
BANK_GROUPS = {   # older volumes split PSU banks into SBI group and nationalised banks
    "STATE BANK OF INDIA AND ITS ASSOCIATES": "PSU banks", "SBI AND ITS ASSOCIATES": "PSU banks",
    "STATE BANK OF INDIA": "PSU banks", "NATIONALISED BANKS": "PSU banks", "PUBLIC SECTOR BANKS": "PSU banks",
    "PRIVATE SECTOR BANKS": "Private banks", "FOREIGN BANKS": "Foreign banks",
    "REGIONAL RURAL BANKS": "Regional rural banks", "SMALL FINANCE BANKS": "Small finance banks",
    "ALL SCHEDULED COMMERCIAL BANKS": "All SCBs",
}
POP = {"RURAL": "Rural", "SEMI-URBAN": "Semi-urban", "URBAN": "Urban", "METROPOLITAN": "Metropolitan",
       "ALL-INDIA": "All", "ALL INDIA": "All"}


def read_frames():
    """(as_of, title, DataFrame) for every table in the downloaded annual volumes and current exports."""
    import io
    import zipfile
    for z in sorted(VOLS.glob("*.zip")):
        with zipfile.ZipFile(z) as zf:
            for n in zf.namelist():
                if n.lower().endswith((".xls", ".xlsx")):
                    try:
                        d = pd.read_excel(io.BytesIO(zf.read(n)), header=None)
                    except Exception:
                        continue
                    yield d
    for f in sorted(SRC.glob("bsr1_t*.xlsx")):
        yield pd.read_excel(f, header=None)


def title_of(d):
    return " ".join(" ".join(str(v).split()) for v in d.iloc[:6].values.ravel() if isinstance(v, str)).upper()


def parse_popbank(d):
    """Population group x bank group credit (Table 2.1 to 2018, 2.11 from 2019)."""
    t = title_of(d)
    date = as_of(d)
    scale = 0.1 if "MILLION" in t else 1.0          # Rs million -> crore
    # header row: the one with a cell reading exactly 'Population Group' (the title also says 'total credit')
    hdr = next(i for i in range(len(d))
               if d.iloc[i].map(lambda v: " ".join(str(v).upper().split())).eq("POPULATION GROUP").any())
    c_tot = [c for c in d.columns if "TOTAL CREDIT" in str(d.iat[hdr, c]).upper()][0]
    c_dep = [c for c in d.columns if str(d.iat[hdr, c]).strip().upper() == "DEPOSITS"]   # volumes to 2018 only
    c_off = [c for c in d.columns if "OFFICES" in str(d.iat[hdr, c]).upper()]
    c_pop = [c for c in d.columns if "POPULATION" in str(d.iat[hdr, c]).upper()][0]
    c_bank = c_pop - 1
    rows, bank = [], None
    for i in range(hdr + 1, len(d)):
        b, p = d.iat[i, c_bank], d.iat[i, c_pop]
        if isinstance(b, str) and b.strip():
            bank = BANK_GROUPS.get(" ".join(b.upper().split()), b.strip().title())
        if not isinstance(p, str) or " ".join(p.upper().split()) not in POP:
            continue
        num = lambda c: pd.to_numeric(str(d.iat[i, c]).replace(",", ""), errors="coerce")
        rows.append({"as_of": date, "bank_group": bank, "pop_group": POP[" ".join(p.upper().split())],
                     "offices": num(c_off[0]) if c_off else None,
                     "accounts_th": num(c_tot), "outstanding_cr": num(c_tot + 1) * scale,
                     "deposits_cr": num(c_dep[0] + 1) * scale if c_dep else None})
    g = pd.DataFrame(rows)
    if g.empty:
        print(f"  no rows parsed from: {t[:90]}")
        return g
    # SBI group + nationalised banks -> PSU banks
    return g.groupby(["as_of", "bank_group", "pop_group"], as_index=False).sum(min_count=1)


def parse_history():
    pb, ir = [], []
    for d in read_frames():
        t = title_of(d)
        if "POPULATION GROUP AND BANK GROUP" in t and "TOTAL CREDIT" in t and not re.search(r"STATE AND|STATE-WISE", t):
            pb.append(parse_popbank(d))
        elif "ACCORDING TO INTEREST RATE RANGE" in t and "OCCUPATION" not in t:
            date = as_of(d)
            for i, (label, nums) in enumerate(numeric_rows(d)):
                if not label.isdigit():
                    ir.append({"as_of": date, "category": label, "ord": i, "accounts": nums[0],
                               "outstanding_cr": nums[2] * (0.1 if "MILLION" in t else 1)})
    popbank = pd.concat(pb).drop_duplicates(["as_of", "bank_group", "pop_group"], keep="last") if pb else pd.DataFrame()
    rates = pd.DataFrame(ir).drop_duplicates(["as_of", "category"], keep="last") if ir else pd.DataFrame()
    return popbank, rates


def main():
    popbank, rates = parse_history()
    with sqlite3.connect(DB) as con:
        if not popbank.empty:
            popbank.to_sql("bsr1_popbank", con, if_exists="replace", index=False)
        if not rates.empty:
            rates.to_sql("bsr1_rates_hist", con, if_exists="replace", index=False)
    if not popbank.empty:
        print(f"bsr1_popbank: {len(popbank)} rows, years {sorted(popbank.as_of.str[:4].unique())}")
    rows = parse_pop() + parse_state()
    for key, (dim, cols) in SIMPLE.items():
        rows += parse_simple(key, dim, cols)
    df = pd.DataFrame(rows)
    if df.empty:
        print("no BSR-1 files parsed")
        return
    # share base: the first total row of each table (for interest rates that is 'Total Loans &
    # Advances', excluding bills discounted, as RBI's own percentages use); regions use the state total
    tot = df[df.is_total].sort_values("ord").groupby("dimension").outstanding_cr.first()
    tot["Region"] = tot.get("State")
    df["share_pct"] = df.outstanding_cr / df.dimension.map(tot) * 100
    df.loc[(df.dimension == "Interest rate") & df.category.str.contains("Bills", case=False), "share_pct"] = None
    with sqlite3.connect(DB) as con:
        df.to_sql("bsr1_dist", con, if_exists="replace", index=False)
    pd.set_option("display.width", 200)
    for dim, g in df.groupby("dimension", sort=False):
        print(f"{dim}: {len(g)} rows, as of {g.as_of.iloc[0]}, total {g[g.is_total].outstanding_cr.max():,.0f} cr")


if __name__ == "__main__":
    main()
