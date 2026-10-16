"""Parse RBI's quarterly spatial distribution of deposits and credit (DBIE exports).

Tables written (data/bank.db)
  spatial_state   quarter, pop_group (Rural / Semi Urban / Urban / Metropolitan /
                  All Population Groups), region, state, offices, deposits_cr, credit_cr
                  (from Statement 3A; SCBs excluding regional rural banks)
  spatial_growth  quarter, dimension ('All' / 'Population group' / 'Bank group'), grp,
                  deposits_yoy, credit_yoy (from Statement 1), plus the credit-deposit ratio
                  as dimension 'All', grp 'Credit-deposit ratio'

Usage:  python src/parse_spatial.py
"""
import re
import sqlite3
import warnings
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "raw" / "rbi" / "dbie"
DB = ROOT / "data" / "bank.db"
MONTHS = {"Mar": 3, "Jun": 6, "Sep": 9, "Dec": 12}
warnings.filterwarnings("ignore", module="openpyxl")


def fy_quarter_end(label):
    """'2026-27:Q1' -> 2026-06-30 (Indian financial-year quarters)."""
    m = re.match(r"(\d{4})-\d{2}:Q([1-4])", str(label).strip())
    y, q = int(m.group(1)), int(m.group(2))
    month = {1: 6, 2: 9, 3: 12, 4: 3}[q]
    return (pd.Timestamp(y + (q == 4), month, 1) + pd.offsets.MonthEnd(0)).date()


def parse_s3a():
    d = pd.read_excel(SRC / "spatial_s3a.xlsx", header=None)
    hdr = d.index[d.apply(lambda r: r.astype(str).str.contains("Population Group").any(), axis=1)][0]
    quarters = d.iloc[hdr]
    metrics = d.iloc[hdr + 1]
    cols = []
    q = None
    for c in range(4, d.shape[1]):
        if pd.notna(quarters[c]):
            q = fy_quarter_end(quarters[c])
        m = str(metrics[c]).strip()
        if q and m != "nan":
            cols.append((c, q, {"Number of Reporting Offices": "offices", "Deposit": "deposits_cr",
                                "Credit": "credit_cr"}[m]))
    rows = []
    for _, r in d.iloc[hdr + 2:].iterrows():
        pop, region, state = r[1], r[2], r[3]
        if pd.isna(pop) or pd.isna(state):       # region and all-India subtotals are recomputed
            continue
        rec = {}
        for c, qd, m in cols:
            rec.setdefault(qd, {})[m] = r[c]
        for qd, vals in rec.items():
            rows.append({"quarter": qd, "pop_group": str(pop).strip(), "region": str(region).strip().title(),
                         "state": str(state).strip().title(), **vals})
    out = pd.DataFrame(rows)
    for c in ["offices", "deposits_cr", "credit_cr"]:
        out[c] = pd.to_numeric(out[c], errors="coerce")
    out["pop_group"] = out.pop_group.replace({"Semi Urban": "Semi-urban"})
    # check: state rows add up to the all-India total the statement prints
    allind = d[d[1].astype(str).str.strip() == "ALL-INDIA"]
    if len(allind):
        c_dep = [c for c, qd, m in cols if m == "deposits_cr"][0]
        printed = float(allind.iloc[0][c_dep])
        q0 = cols[0][1]
        summed = out[(out.quarter == q0) & (out.pop_group == "All Population Groups")].deposits_cr.sum()
        assert abs(summed / printed - 1) < 1e-6, (summed, printed)
    return out


def parse_s1():
    d = pd.read_excel(SRC / "spatial_s1.xlsx", header=None)
    hdr = d.index[d[2].astype(str).str.strip() == "Important Indicators"][0]
    qcols = {c: pd.Timestamp(int(v.split(":")[1]), MONTHS[v.split(":")[0]], 1) + pd.offsets.MonthEnd(0)
             for c, v in d.iloc[hdr].items() if isinstance(v, str) and re.match(r"[A-Z][a-z]{2}:\d{4}", v)}
    rows, dim, grp = [], "All", "All banks"
    for _, r in d.iloc[hdr + 2:].iterrows():
        label = str(r[2]).strip()
        has_vals = any(pd.notna(r[c]) for c in qcols)
        if label.startswith("Population Group"):
            dim = "Population group"; continue
        if label.startswith("Bank Group"):
            dim = "Bank group"; continue
        if not has_vals and label not in ("nan",) and dim != "All":
            grp = label.replace("Semi Urban", "Semi-urban"); continue
        if label.startswith("Credit-deposit Ratio"):
            for c, qd in qcols.items():
                rows.append({"quarter": qd.date(), "dimension": "All", "grp": "Credit-deposit ratio",
                             "metric": "ratio", "value": r[c]})
            continue
        if label in ("Aggregate Deposits", "Bank Credit") and has_vals:
            for c, qd in qcols.items():
                rows.append({"quarter": qd.date(), "dimension": dim, "grp": grp,
                             "metric": "deposits_yoy" if label.startswith("Aggregate") else "credit_yoy",
                             "value": r[c]})
    g = pd.DataFrame(rows)
    g["value"] = pd.to_numeric(g.value, errors="coerce")
    return g


def main():
    st, gr = parse_s3a(), parse_s1()
    with sqlite3.connect(DB) as con:
        st.to_sql("spatial_state", con, if_exists="replace", index=False)
        gr.to_sql("spatial_growth", con, if_exists="replace", index=False)
    tot = st[st.pop_group != "All Population Groups"].groupby(["quarter", "pop_group"])[["deposits_cr", "credit_cr"]].sum()
    share = (tot / tot.groupby(level=0).transform("sum") * 100).round(1)
    print(f"spatial_state: {len(st)} rows, {st.quarter.nunique()} quarters {st.quarter.min()} .. {st.quarter.max()}, "
          f"{st.state.nunique()} states")
    print("credit share by population group, %:\n", share.credit_cr.unstack().tail(5).to_string())
    print(f"spatial_growth: {len(gr)} rows; groups {sorted(gr.grp.unique())}")


if __name__ == "__main__":
    main()
