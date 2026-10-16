"""Derived NBFC / HFC metrics from nbfc_quarter (data/bank.db).

Tables written
  nbfc_q_metrics   per company-quarter: Indus-style income statement (operating income,
                   expenditure ex-interest, interest expense, PBT, PAT), growth, cost ratios
                   to total income, net interest income, cost-to-income, and (Sep/Mar)
                   balance-sheet items, leverage and book value
  nbfc_fy_metrics  per company-financial-year: summed P&L and returns on average
                   opening/closing balances (RoA, RoE, NIM on assets, yield on loans,
                   cost of borrowings, credit cost, opex to assets)

NBFC filings carry no NPA ratios, so credit cost (impairment / average loans) is the
asset-quality measure. Conventions as bank_metrics.py: Rs crore, %, FY ends March.

Usage:  python src/nbfc_metrics.py [SYMBOL]
"""
import sqlite3
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bank_metrics import fy_of, label, safe_div  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "bank.db"


def load():
    with sqlite3.connect(DB) as con:
        q = pd.read_sql("select * from nbfc_quarter", con, parse_dates=["period_end"])
    return q.merge(pd.read_csv(ROOT / "raw" / "manual" / "nbfcs.csv"), on="symbol", how="left")


def num(s):
    return pd.to_numeric(s, errors="coerce")


def quarterly(q):
    q = q.sort_values(["symbol", "period_end"]).copy()
    for c in q.columns:
        if c not in ("symbol", "period_end", "derived", "name", "short", "group"):
            q[c] = num(q[c])
    q["fy"] = q.period_end.map(fy_of)
    q["label"] = q.period_end.map(label)
    z = lambda c: q[c].fillna(0)
    # Some filings use SEBI's generic company template, which has no interest-income or
    # impairment line; impairment is then the part of total expenses not tagged elsewhere.
    generic = q.interest_income.isna() & q.impairment.isna() & q.total_expenses.notna()
    rest = q.total_expenses - (z("employee_cost") + z("finance_cost") + z("depreciation") + z("other_expenses")
                               + z("fee_expense") + z("fv_loss"))
    q["impairment_est"] = generic & (rest >= 0)
    q.loc[q.impairment_est, "impairment"] = rest[q.impairment_est]
    # Indus layout: expenditure excludes interest; interest expense shown separately
    q["opex"] = z("employee_cost") + z("depreciation") + z("other_expenses") + z("fee_expense") + z("fv_loss")
    q["expenditure_ex_int"] = q.opex + z("impairment")
    q["other_opex"] = z("other_expenses") + z("fee_expense") + z("fv_loss")   # Indus 'Other exp'
    q["nii"] = q.interest_income - q.finance_cost
    q["net_total_income"] = q.total_income - q.finance_cost
    q["ppop"] = q.net_total_income - q.opex
    q["cost_to_income"] = safe_div(q.opex, q.net_total_income) * 100
    q["credit_cost_to_ppop"] = safe_div(q.impairment, q.ppop) * 100
    q["tax_rate"] = safe_div(q.tax, q.pbt) * 100
    q["pat_margin"] = safe_div(q.pat, q.total_income) * 100
    for c in ["employee_cost", "other_opex", "impairment", "depreciation", "expenditure_ex_int", "finance_cost", "pat"]:
        q[f"{c}_pct_ti"] = safe_div(q[c], q.total_income) * 100
    # balance sheet (Sep/Mar filings)
    q["borrowings_total"] = (q[["debt_securities", "borrowings", "deposits", "subordinated"]]
                             .sum(axis=1, min_count=1))
    q["leverage"] = safe_div(q.total_assets, q.net_worth)
    shares = q.paid_up_capital * 1e7 / q.face_value
    q["bvps"] = safe_div(q.net_worth * 1e7, shares)
    q["shares_cr"] = shares / 1e7
    g = q.groupby("symbol", group_keys=False)
    # quarterly ratios, annualised, on the latest balance sheet (Sep serves Dec, Mar serves Jun)
    ref = lambda c: g[c].transform(lambda s: s.ffill(limit=1))
    q["roa_ann"] = safe_div(q.pat * 4, ref("total_assets")) * 100
    q["roe_ann"] = safe_div(q.pat * 4, ref("net_worth")) * 100
    q["credit_cost_ann"] = safe_div(q.impairment * 4, ref("loans")) * 100
    q["nim_ann"] = safe_div(q.nii * 4, ref("total_assets")) * 100
    for c in ["revenue_ops", "total_income", "nii", "opex", "impairment", "ppop", "pat", "finance_cost",
              "expenditure_ex_int", "pbt"]:
        prev_y = g.apply(lambda d, c=c: d.set_index("period_end")[c]
                         .reindex(d.period_end - pd.DateOffset(years=1)).set_axis(d.index))
        q[f"{c}_yoy"] = (safe_div(q[c], prev_y) - 1) * 100
        q[f"{c}_qoq"] = np.where(g.period_end.diff().dt.days.between(80, 100),
                                  (safe_div(q[c], g[c].shift(1)) - 1) * 100, np.nan)
    for c in ["loans", "borrowings_total", "net_worth"]:
        prev_y = g.apply(lambda d, c=c: d.set_index("period_end")[c]
                         .reindex(d.period_end - pd.DateOffset(years=1)).set_axis(d.index))
        q[f"{c}_yoy"] = (safe_div(q[c], prev_y) - 1) * 100
    return q


def audited_years(q):
    """Full-year P&L from the March filings' year-to-date figures.

    These are the audited annual numbers, with any reclassification of earlier
    quarters already applied, so they can differ from the sum of quarters as
    first reported (and match what companies and Indus Equity show for the year).
    """
    from parse_results import NBFC_FLOW
    with sqlite3.connect(DB) as con:
        f = pd.read_sql("select symbol, period_end, item, value from results_facts where basis='YTD'", con,
                        parse_dates=["period_end"])
    f = f[(f.period_end.dt.month == 3) & f.item.isin(NBFC_FLOW) & f.symbol.isin(q.symbol.unique())]
    w = f.pivot_table(index=["symbol", "period_end"], columns="item", values="value", aggfunc="first")
    w = w.rename(columns=NBFC_FLOW).reset_index()
    for c in NBFC_FLOW.values():
        if c not in w:
            w[c] = np.nan
    w["fy"] = w.period_end.dt.year
    return w


def annual(q):
    flows = ["interest_income", "fee_income", "revenue_ops", "other_income", "total_income", "finance_cost",
             "nii", "net_total_income", "opex", "employee_cost", "other_opex", "depreciation", "impairment",
             "expenditure_ex_int", "ppop", "exceptional", "pbt", "tax", "pat"]
    full = q.groupby(["symbol", "fy"]).filter(lambda d: len(d) == 4 and d.total_income.notna().all())
    summed = full.groupby(["symbol", "fy"])[flows].sum(min_count=4).reset_index()  # all four quarters or none
    a = audited_years(q)
    z = lambda c: a[c].fillna(0)
    a["opex"] = z("employee_cost") + z("depreciation") + z("other_expenses") + z("fee_expense") + z("fv_loss")
    a["nii"] = a.interest_income - a.finance_cost
    a["net_total_income"] = a.total_income - a.finance_cost
    a["ppop"] = a.net_total_income - a.opex
    a["expenditure_ex_int"] = a.opex + z("impairment")
    a["other_opex"] = z("other_expenses") + z("fee_expense") + z("fv_loss")
    a = a[a.total_income.notna()][["symbol", "fy"] + flows]
    # audited year where the March filing has it; items it lacks come from the sum of four quarters
    fy = (a.set_index(["symbol", "fy"]).combine_first(summed.set_index(["symbol", "fy"]))
          .reset_index())
    mar = q[q.period_end.dt.month == 3][["symbol", "fy", "loans", "total_assets", "net_worth",
                                       "borrowings_total", "leverage", "debt_equity", "bvps", "eps"]]
    fy = fy.merge(mar, on=["symbol", "fy"], how="left").sort_values(["symbol", "fy"])
    prev = fy.groupby("symbol").shift(1)
    contiguous = (fy.fy - fy.groupby("symbol").fy.shift(1)) == 1
    avg = lambda c: np.where(contiguous, (fy[c] + prev[c]) / 2, np.nan)
    fy["roa"] = safe_div(fy.pat, avg("total_assets")) * 100
    fy["roe"] = safe_div(fy.pat, avg("net_worth")) * 100
    fy["nim_assets"] = safe_div(fy.nii, avg("total_assets")) * 100
    fy["yield_loans"] = safe_div(fy.interest_income, avg("loans")) * 100
    fy["cost_of_borrowings"] = safe_div(fy.finance_cost, avg("borrowings_total")) * 100
    fy["spread"] = fy.yield_loans - fy.cost_of_borrowings
    fy["credit_cost"] = safe_div(fy.impairment, avg("loans")) * 100
    fy["opex_to_assets"] = safe_div(fy.opex, avg("total_assets")) * 100
    fy["cost_to_income"] = safe_div(fy.opex, fy.net_total_income) * 100
    for c in ["total_income", "revenue_ops", "nii", "pat", "loans", "net_worth"]:
        fy[f"{c}_yoy"] = np.where(contiguous, (safe_div(fy[c], prev[c]) - 1) * 100, np.nan)
    fy["label"] = "FY" + fy.fy.astype(str).str[2:]
    return fy


def main():
    q = quarterly(load())
    fy = annual(q)
    with sqlite3.connect(DB) as con:
        q.assign(period_end=q.period_end.dt.date).to_sql("nbfc_q_metrics", con, if_exists="replace", index=False)
        fy.to_sql("nbfc_fy_metrics", con, if_exists="replace", index=False)
    sym = sys.argv[1] if len(sys.argv) > 1 else "BAJFINANCE"
    pd.set_option("display.width", 250, "display.max_columns", 40)
    s = q[q.symbol == sym]
    print(s[["label", "revenue_ops", "other_income", "total_income", "employee_cost", "other_expenses",
             "impairment", "depreciation", "expenditure_ex_int", "finance_cost", "pbt_pre_exceptional",
             "exceptional", "pbt", "tax", "pat", "pat_yoy", "eps", "loans", "net_worth", "bvps"]]
          .tail(9).round(1).to_string(index=False))
    print(fy[fy.symbol == sym][["label", "total_income", "nii", "pat", "pat_yoy", "roa", "roe", "nim_assets",
                                "yield_loans", "cost_of_borrowings", "credit_cost", "cost_to_income",
                                "loans_yoy", "leverage"]].round(2).to_string(index=False))


if __name__ == "__main__":
    main()
