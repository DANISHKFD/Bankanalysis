"""Analysis layer over data/bank.db. Each function returns a tidy DataFrame;
build_report.py turns them into charts. Run directly for a text summary.

Usage:  python src/analysis.py
"""
import re
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

DB = Path(__file__).resolve().parent.parent / "data" / "bank.db"


def q(sql, **kw):
    with sqlite3.connect(DB) as con:
        return pd.read_sql(sql, con, **kw)


def _month(df, col="month"):
    df[col] = pd.to_datetime(df[col])
    return df


def yoy(s, periods=12):
    """YoY % for a monthly series indexed by month (gaps allowed)."""
    prev = s.reindex(s.index - pd.DateOffset(years=1))
    prev.index = s.index
    return (s / prev - 1) * 100


# ----------------------------------------------------------------- Credit (SIBC)

def sibc():
    df = q("select statement, code, sector, level, as_of_month, value_cr from sibc_credit")
    return _month(df, "as_of_month").rename(columns={"as_of_month": "month"})


def credit_growth_table(statement="sector"):
    """Latest month: outstanding, YoY growth now and a year earlier, share of
    total, share of the year's incremental credit."""
    df = sibc()
    df = df[df.statement == statement]
    piv = df.pivot_table(index=["code", "sector", "level"], columns="month", values="value_cr")
    last = piv.columns.max()
    y1, y2 = last - pd.DateOffset(years=1), last - pd.DateOffset(years=2)
    out = pd.DataFrame({
        "outstanding_cr": piv[last],
        "yoy_now": (piv[last] / piv[y1] - 1) * 100,
        "yoy_year_ago": (piv[y1] / piv[y2] - 1) * 100 if y2 in piv else np.nan,
        "incr_cr": piv[last] - piv[y1],
    }).reset_index()
    if statement == "sector":
        base = out.set_index("code")
        nonfood = base.loc["III", "outstanding_cr"]
        sect_total = base.loc[["1", "2", "3", "4"], "outstanding_cr"].sum()
        sect_incr = base.loc[["1", "2", "3", "4"], "incr_cr"].sum()
        out["share_pct"] = out["outstanding_cr"] / sect_total * 100
        out["incr_share_pct"] = out["incr_cr"] / sect_incr * 100
        out.loc[out.level == 0, ["share_pct", "incr_share_pct"]] = np.nan
    else:
        tot = out.set_index("code").loc["2"]
        out["share_pct"] = out["outstanding_cr"] / tot["outstanding_cr"] * 100
        out["incr_share_pct"] = out["incr_cr"] / tot["incr_cr"] * 100
    out["accel_pp"] = out["yoy_now"] - out["yoy_year_ago"]
    out.attrs["month"] = last
    return out


def credit_yoy_series(codes=("I", "1", "2", "3", "4"), statement="sector"):
    df = sibc()
    df = df[(df.statement == statement) & df.code.isin(codes)]
    out = []
    for (code, name), g in df.groupby(["code", "sector"]):
        s = g.set_index("month").value_cr.sort_index()
        y = yoy(s).dropna()
        out.append(pd.DataFrame({"month": y.index, "code": code, "sector": name, "yoy": y.values}))
    return pd.concat(out, ignore_index=True)


# ----------------------------------------------------------- Deposits & funding

def funding():
    s = q("select as_of_month as month, metric, value_cr from sop_scb")
    s = _month(s).pivot(index="month", columns="metric", values="value_cr").sort_index()
    s["cd_ratio"] = s.bank_credit / s.deposits * 100
    s["demand_share"] = s.deposits_demand / s.deposits * 100
    s["gsec_to_dep"] = s.investments_gsec / s.deposits * 100
    s["credit_yoy"] = yoy(s.bank_credit)
    s["deposit_yoy"] = yoy(s.deposits)
    s["gap_pp"] = s.credit_yoy - s.deposit_yoy
    prev_c = s.bank_credit.reindex(s.index - pd.DateOffset(years=1)).values
    prev_d = s.deposits.reindex(s.index - pd.DateOffset(years=1)).values
    s["incr_cd_ratio"] = (s.bank_credit - prev_c) / (s.deposits - prev_d) * 100
    return s.reset_index()


# --------------------------------------------------------------------- Macro

def cpi():
    return _month(q("select month, inflation_yoy, base, status from cpi"))


def repo_monthly():
    return _month(q("select month, repo_rate from repo_monthly"))


def real_credit_growth():
    c = credit_yoy_series(("I",))[["month", "yoy"]]
    m = c.merge(cpi()[["month", "inflation_yoy"]], on="month", how="left")
    m["real_yoy"] = m.yoy - m.inflation_yoy
    return m


# --------------------------------------------------------------------- Rates

def rates_group():
    return _month(q("select series, month, bank_group, value from rates_group"))


def transmission(start="2025-01-01", end=None):
    """Change (bps) between start and end months in repo, WALR, TD rates and
    median 1y MCLR, by bank group."""
    r = rates_group()
    end = pd.Timestamp(end) if end else r.month.max()
    start = pd.Timestamp(start)
    rows = []
    for (series, grp), g in r.groupby(["series", "bank_group"]):
        g = g.set_index("month").value
        if start in g and end in g:
            rows.append({"measure": series, "bank_group": grp, "start": g[start], "end": g[end],
                         "change_bps": (g[end] - g[start]) * 100})
    mc = _month(q("select month, bank_group, stat, value from rates_mclr_group where stat='Median'"))
    for grp, g in mc.groupby("bank_group"):
        g = g.set_index("month").value
        if start in g and end in g:
            rows.append({"measure": "mclr_1y_median", "bank_group": grp, "start": g[start],
                         "end": g[end], "change_bps": (g[end] - g[start]) * 100})
    rp = repo_monthly().set_index("month").repo_rate
    out = pd.DataFrame(rows)
    repo_chg = (rp[end] - rp[start]) * 100
    out["repo_change_bps"] = repo_chg
    out["pass_through_pct"] = out.change_bps / repo_chg * 100
    out.attrs.update(start=start, end=end, repo_start=rp[start], repo_end=rp[end])
    return out


def benchmark_mix():
    return _month(q("select month, bank_group, benchmark, value from rates_benchmark"))


def spreads():
    r = rates_group().pivot_table(index=["month", "bank_group"], columns="series", values="value")
    r = r.reset_index()
    r["spread_outstanding"] = r.walr_outstanding - r.td_outstanding
    r["spread_fresh"] = r.walr_fresh - r.td_fresh
    m = r.merge(cpi()[["month", "inflation_yoy"]], on="month", how="left")
    m["real_walr_outstanding"] = m.walr_outstanding - m.inflation_yoy
    m["real_td_fresh"] = m.td_fresh - m.inflation_yoy
    return m


RENAME = {  # RBI tables keep legacy names; show what readers know today
    "Development Credit Bank": "DCB Bank", "Catholic Syrian Bank": "CSB Bank",
    "IDFC Bank": "IDFC First Bank", "Dhanalaxmi Bank": "Dhanlaxmi Bank",
    "Indusind Bank": "IndusInd Bank", "Hdfc Bank": "HDFC Bank", "Icici Bank": "ICICI Bank",
    "Idbi Bank": "IDBI Bank", "Rbl Bank": "RBL Bank", "Dbs India Bank": "DBS Bank India",
    "Hsbc": "HSBC", "Sbm Bank India": "SBM Bank India", "Csb Bank": "CSB Bank",
    "Dcb Bank": "DCB Bank", "Uco Bank": "UCO Bank", "Idfc First Bank": "IDFC First Bank",
    "Au Small Finance Bank": "AU Small Finance Bank", "Esaf Small Finance Bank": "ESAF Small Finance Bank",
    "American Express Banking": "American Express", "Citi Bank": "Citibank",
    "Keb Hana Bank": "KEB Hana Bank", "Nsdl Payments Bank": "NSDL Payments Bank",
    "Fino Payments Bank": "Fino Payments Bank",
}
SMALL = {"of", "and", "the"}


def display_name(raw):
    s = re.sub(r"\s+(Ltd\.?|Limited)\s*$", "", " ".join(str(raw).split()), flags=re.I)
    if s.isupper():
        s = " ".join(w.lower() if w.lower() in SMALL and i else w.capitalize()
                     for i, w in enumerate(s.split()))
    return RENAME.get(s, s)


def mclr_banks():
    m = _month(q("select bank, bank_group, month, value from rates_mclr_bank"))
    m["bank"] = m["bank"].map(display_name)
    last = m.month.max()
    p = m.pivot_table(index=["bank", "bank_group"], columns="month", values="value")
    p = p[p[last].notna()]
    out = pd.DataFrame({
        "mclr": p[last],
        "mom_bps": (p[last] - p[last - pd.DateOffset(months=1)]) * 100,
        "yoy_bps": (p[last] - p[last - pd.DateOffset(years=1)]) * 100,
    }).reset_index()
    out.attrs["month"] = last
    return out


# --------------------------------------------------------------------- Cards

def cards():
    return _month(q("select month, bank_group, bank, metric, value from cards"))


CC_SPEND = ["cc_pos_val", "cc_ecom_val", "cc_other_val"]
DC_SPEND = ["dc_pos_val", "dc_ecom_val", "dc_other_val"]


def card_bank_panel():
    c = cards()
    c = c[c.bank != "TOTAL"]
    p = c.pivot_table(index=["month", "bank_group", "bank"], columns="metric",
                      values="value", aggfunc="sum").reset_index()
    p["bank"] = p["bank"].map(display_name)
    p["cc_spend_cr"] = p[CC_SPEND].sum(axis=1)
    p["dc_spend_cr"] = p[DC_SPEND].sum(axis=1)
    p["cc_txn"] = p[[m.replace("_val", "_vol") for m in CC_SPEND]].sum(axis=1)
    p["atm_total"] = p.atm_onsite + p.atm_offsite
    p["spend_per_card_rs"] = np.where(p.credit_cards > 0, p.cc_spend_cr * 1e7 / p.credit_cards, np.nan)
    p["ticket_rs"] = np.where(p.cc_txn > 0, p.cc_spend_cr * 1e7 / p.cc_txn, np.nan)
    p["ecom_share_pct"] = np.where(p.cc_spend_cr > 0, p.cc_ecom_val / p.cc_spend_cr * 100, np.nan)
    return p


def card_market(metric="credit_cards"):
    p = card_bank_panel()
    tot = p.groupby("month")[metric].transform("sum")
    p["share_pct"] = p[metric] / tot * 100
    return p


def hhi(metric="credit_cards"):
    p = card_market(metric)
    h = p.groupby("month").share_pct.apply(lambda s: (s ** 2).sum()).rename("hhi")
    top5 = p.groupby("month").share_pct.apply(lambda s: s.nlargest(5).sum()).rename("top5_pct")
    return pd.concat([h, top5], axis=1).reset_index()


def card_totals():
    p = card_bank_panel()
    cols = ["credit_cards", "debit_cards", "cc_spend_cr", "dc_spend_cr", "atm_total", "pos",
            "upi_qr", "bharat_qr", "dc_atm_cash_val", "cc_txn", "cc_ecom_val"]
    t = p.groupby("month")[cols].sum().reset_index()
    t["spend_per_card_rs"] = t.cc_spend_cr * 1e7 / t.credit_cards
    t["ecom_share_pct"] = t.cc_ecom_val / t.cc_spend_cr * 100
    return t


# ----------------------------------------------------------------- Summary

def main():
    pd.set_option("display.width", 220, "display.max_columns", 30, "display.max_rows", 200)
    fmt = lambda df: df.round(2).to_string(index=False)

    g = credit_growth_table("sector")
    print(f"\n=== CREDIT by sector, {g.attrs['month']:%b-%Y}")
    print(fmt(g[["code", "sector", "outstanding_cr", "yoy_now", "yoy_year_ago", "accel_pp",
                 "share_pct", "incr_share_pct"]]))
    i = credit_growth_table("industry")
    print("\n=== INDUSTRY top YoY (share>1%)")
    print(fmt(i[(i.share_pct > 1) & (i.level == 2)].sort_values("yoy_now", ascending=False)
              [["code", "sector", "share_pct", "yoy_now", "yoy_year_ago", "incr_share_pct"]]))
    print("\n=== REAL CREDIT GROWTH"); print(fmt(real_credit_growth()))
    f = funding()
    print("\n=== FUNDING"); print(fmt(f[["month", "deposits", "bank_credit", "cd_ratio", "incr_cd_ratio",
                                    "credit_yoy", "deposit_yoy", "gap_pp", "demand_share", "gsec_to_dep"]]))
    t = transmission()
    print(f"\n=== TRANSMISSION {t.attrs['start']:%b-%y} -> {t.attrs['end']:%b-%y}  repo "
          f"{t.attrs['repo_start']} -> {t.attrs['repo_end']}")
    print(fmt(t.pivot(index="measure", columns="bank_group", values="change_bps")))
    b = benchmark_mix(); lb = b[b.month == b.month.max()]
    print("\n=== BENCHMARK MIX latest"); print(lb.pivot(index="bank_group", columns="benchmark", values="value"))
    s = spreads(); print("\n=== SPREADS (SCB)"); print(fmt(s[(s.bank_group == "Scheduled Commercial Banks") &
          (s.month >= "2024-09-01")][["month", "walr_outstanding", "td_outstanding", "spread_outstanding",
                                      "walr_fresh", "td_fresh", "spread_fresh", "inflation_yoy", "real_walr_outstanding"]]))
    m = mclr_banks(); print(f"\n=== MCLR banks {m.attrs['month']:%b-%Y}")
    print(fmt(m[m.bank_group != "Foreign Banks"].sort_values("mclr")))
    ct = card_totals(); print("\n=== CARD TOTALS"); print(fmt(ct))
    cm = card_market("credit_cards"); lm = cm[cm.month == cm.month.max()].nlargest(12, "share_pct")
    print("\n=== CREDIT CARD SHARE latest"); print(fmt(lm[["bank", "bank_group", "credit_cards", "share_pct",
                                                     "cc_spend_cr", "spend_per_card_rs", "ticket_rs", "ecom_share_pct"]]))
    print("\n=== HHI credit cards"); print(fmt(hhi()))
    print("\n=== HHI cc spend"); print(fmt(hhi("cc_spend_cr")))


if __name__ == "__main__":
    main()
