"""Derived bank metrics from bank_quarter (data/bank.db).

Tables written
  bank_q_metrics   per bank-quarter: P&L lines, growth, efficiency, asset quality,
                   capital, and (Sep/Mar) balance-sheet ratios
  bank_fy_metrics  per bank-financial-year: summed P&L and balance-sheet based
                   returns (RoE, NIM on assets, yield on advances, cost of funds,
                   credit cost) using average opening/closing balances

Conventions: Rs crore; ratios in %; quarterly RoA is annualised (x4); FY = year
ending March (FY26 = Apr-2025..Mar-2026).

Usage:  python src/bank_metrics.py [SYMBOL]
"""
import sqlite3
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "bank.db"


def load():
    with sqlite3.connect(DB) as con:
        q = pd.read_sql("select * from bank_quarter", con, parse_dates=["period_end"])
    banks = pd.read_csv(ROOT / "raw" / "manual" / "banks.csv")
    return q.merge(banks, on="symbol", how="left")


def fy_of(d):
    return d.year + 1 if d.month >= 4 else d.year


def label(d):
    qn = {6: 1, 9: 2, 12: 3, 3: 4}[d.month]
    return f"Q{qn}FY{str(fy_of(d))[2:]}"


def safe_div(a, b):
    a = pd.to_numeric(pd.Series(np.asarray(a, dtype=object)), errors="coerce").to_numpy(float)
    b = pd.to_numeric(pd.Series(np.asarray(b, dtype=object)), errors="coerce").to_numpy(float)
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where((b != 0) & ~np.isnan(a) & ~np.isnan(b), a / b, np.nan)


def fix_filing_units(q):
    """Repair two inconsistencies in how banks tag ratios in XBRL.

    - Ratios filed as a fraction of a fraction (13% tagged 0.0013): a CET1 below 1%
      is impossible for an operating bank, so CET1 < 1 and that filing's AT1 are
      scaled by 100. GNPA/NNPA % get the same treatment when implausibly small.
    - Return on assets: some banks tag the quarter's RoA, others the annualised
      figure. Each filing is matched against annualised profit / total assets (from
      the nearest balance sheet within six months); filings without a nearby balance
      sheet use the basis that bank uses most often.
    """
    q = q.copy()
    low = q.cet1 < 1
    q.loc[low, "cet1"] *= 100
    q.loc[low & (q.at1 < 0.2), "at1"] *= 100
    for c in ["gnpa_pct", "nnpa_pct"]:
        bad = (q[c] > 0) & (q[c] < 0.05) & (q.gnpa > 0)
        q.loc[bad, c] *= 100
    q["roa_basis"] = pd.NA
    for sym, g in q.groupby("symbol"):
        ta = g.dropna(subset=["total_assets"]).set_index("period_end").total_assets
        basis = {}
        for i, r in g.iterrows():
            if pd.isna(r.roa_q) or pd.isna(r.pat) or ta.empty:
                continue
            near = ta.index[abs((ta.index - r.period_end).days) <= 185]
            if not len(near):
                continue
            est = r.pat * 4 / ta[min(near, key=lambda d: abs((d - r.period_end).days))] * 100
            basis[i] = "annual" if abs(r.roa_q - est) < abs(r.roa_q * 4 - est) else "quarter"
        default = pd.Series(list(basis.values())).mode()
        default = default.iloc[0] if len(default) else ("annual" if g.roa_q.abs().median() > 0.6 else "quarter")
        for i in g.index:
            q.at[i, "roa_basis"] = basis.get(i, default)
    q["roa"] = np.where(q.roa_basis == "annual", q.roa_q, q.roa_q * 4)
    return q


def quarterly(q):
    q = fix_filing_units(q.sort_values(["symbol", "period_end"]))
    q["fy"] = q.period_end.map(fy_of)
    q["label"] = q.period_end.map(label)
    q["nii"] = q.interest_earned - q.interest_expended
    q["op_income"] = q.nii + q.other_income
    q["cost_to_income"] = safe_div(q.opex, q.op_income) * 100
    q["prov_to_ppop"] = safe_div(q.provisions, q.ppop) * 100
    q["tax_rate"] = safe_div(q.tax, q.pbt) * 100
    q["opm"] = safe_div(q.nii - q.opex, q.interest_earned) * 100          # Indus 'OPM'
    q["nii_to_int_income"] = safe_div(q.nii, q.interest_earned) * 100
    q["other_inc_share"] = safe_div(q.other_income, q.total_income) * 100
    q["pcr"] = (1 - safe_div(q.nnpa, q.gnpa)) * 100                        # excl. technical write-offs
    q["tier1"] = q.cet1 + q.at1.fillna(0)
    # common-size: each line as % of total income (Indus 'cost ratios')
    for c in ["int_advances", "int_investments", "int_rbi_interbank", "int_other", "other_income",
              "interest_expended", "employee_cost", "other_opex", "opex", "ppop", "provisions", "pbt", "tax", "pat"]:
        q[f"{c}_pct_ti"] = safe_div(q[c], q.total_income) * 100
    # balance sheet (Sep/Mar filings)
    q["net_worth"] = q.bs_capital + q.bs_reserves
    q["cd_ratio"] = safe_div(q.advances, q.deposits) * 100
    shares = q.paid_up_capital * 1e7 / q.face_value                        # number of shares
    q["bvps"] = safe_div(q.net_worth * 1e7, shares)
    q["shares_cr"] = shares / 1e7
    # growth vs same quarter last year / previous quarter
    g = q.groupby("symbol", group_keys=False)
    for c in ["nii", "other_income", "opex", "ppop", "provisions", "pat", "interest_earned"]:
        prev_y = g.apply(lambda d, c=c: d.set_index("period_end")[c]
                         .reindex(d.period_end - pd.DateOffset(years=1)).set_axis(d.index))
        prev_q = g[c].shift(1)
        q[f"{c}_yoy"] = (safe_div(q[c], prev_y) - 1) * 100
        q[f"{c}_qoq"] = np.where(g.period_end.diff().dt.days.between(80, 100),
                                  (safe_div(q[c], prev_q) - 1) * 100, np.nan)
    for c in ["deposits", "advances"]:
        prev_y = g.apply(lambda d, c=c: d.set_index("period_end")[c]
                         .reindex(d.period_end - pd.DateOffset(years=1)).set_axis(d.index))
        q[f"{c}_yoy"] = (safe_div(q[c], prev_y) - 1) * 100
    return q


def annual(q):
    flows = ["interest_earned", "int_advances", "interest_expended", "nii", "other_income", "op_income",
             "opex", "employee_cost", "ppop", "provisions", "exceptional", "pbt", "tax", "pat"]
    full = q.groupby(["symbol", "fy"]).filter(lambda d: len(d) == 4 and d.nii.notna().all())
    fy = full.groupby(["symbol", "fy"])[flows].sum(min_count=1).reset_index()
    mar = q[q.period_end.dt.month == 3][["symbol", "fy", "deposits", "advances", "borrowings", "total_assets",
                                       "net_worth", "gnpa", "gnpa_pct", "nnpa_pct", "pcr", "cet1", "tier1",
                                       "bvps", "cd_ratio", "eps"]]
    fy = fy.merge(mar, on=["symbol", "fy"], how="left")
    fy = fy.sort_values(["symbol", "fy"])
    prev = fy.groupby("symbol").shift(1)
    contiguous = (fy.fy - fy.groupby("symbol").fy.shift(1)) == 1
    avg = lambda c: np.where(contiguous, (fy[c] + prev[c]) / 2, np.nan)
    fy["roe"] = safe_div(fy.pat, avg("net_worth")) * 100
    fy["roa"] = safe_div(fy.pat, avg("total_assets")) * 100
    fy["nim_assets"] = safe_div(fy.nii, avg("total_assets")) * 100
    fy["yield_advances"] = safe_div(fy.int_advances, avg("advances")) * 100
    fy["cost_of_funds"] = safe_div(fy.interest_expended,
                                   (fy.deposits + fy.borrowings.fillna(0) + prev.deposits + prev.borrowings.fillna(0)) / 2
                                   ) * 100
    fy.loc[~contiguous, "cost_of_funds"] = np.nan
    fy["credit_cost"] = safe_div(fy.provisions, avg("advances")) * 100
    fy["cost_to_income"] = safe_div(fy.opex, fy.op_income) * 100
    for c in ["nii", "pat", "ppop", "deposits", "advances"]:
        fy[f"{c}_yoy"] = np.where(contiguous, (safe_div(fy[c], prev[c]) - 1) * 100, np.nan)
    fy["label"] = "FY" + fy.fy.astype(str).str[2:]
    return fy


def main():
    q = quarterly(load())
    fy = annual(q)
    with sqlite3.connect(DB) as con:
        q.assign(period_end=q.period_end.dt.date).to_sql("bank_q_metrics", con, if_exists="replace", index=False)
        fy.to_sql("bank_fy_metrics", con, if_exists="replace", index=False)
    sym = sys.argv[1] if len(sys.argv) > 1 else "HDFCBANK"
    pd.set_option("display.width", 250, "display.max_columns", 40)
    s = q[q.symbol == sym]
    print(s[["label", "nii", "nii_yoy", "other_income", "opex", "cost_to_income", "ppop", "provisions",
             "prov_to_ppop", "pat", "pat_yoy", "gnpa_pct", "nnpa_pct", "pcr", "roa", "cet1", "tier1",
             "cd_ratio", "bvps"]].tail(9).round(2).to_string(index=False))
    print(fy[fy.symbol == sym][["label", "nii", "pat", "pat_yoy", "roe", "roa", "nim_assets", "yield_advances",
                                "cost_of_funds", "credit_cost", "cost_to_income", "deposits_yoy",
                                "advances_yoy", "bvps"]].round(2).to_string(index=False))


if __name__ == "__main__":
    main()
