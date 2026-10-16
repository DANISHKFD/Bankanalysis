"""Build reports/india_banking_monitor.html: analysis results as JSON embedded
in src/report_template.html (self-contained; charts are drawn in-page).

Usage:  python src/build_report.py
"""
import json
import math
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analysis as A  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
# The page is a React + TypeScript app (web/). `npm run build` there writes web/dist/index.html;
# src/report_app.html is the committed copy, so the nightly run needs no Node toolchain.
TEMPLATE = ROOT / "src" / "report_app.html"
LEGACY_TEMPLATE = ROOT / "src" / "report_template.html"   # old single-page report, kept for reference
OUT = ROOT / "reports" / "india_banking_monitor.html"

GROUP_SHORT = {"Public Sector Banks": "PSU banks", "Private Sector Banks": "Private banks",
               "Foreign Banks": "Foreign banks", "Scheduled Commercial Banks": "All SCBs",
               "Payment Banks": "Payment banks", "Small Finance Banks": "Small finance banks"}


def clean(v):
    if isinstance(v, (pd.Timestamp, date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if hasattr(v, "item"):
        return clean(v.item())
    return v


def records(df, cols=None):
    df = df[cols] if cols else df
    return [{k: clean(v) for k, v in r.items()} for r in df.to_dict("records")]


def series(df, x, y, by=None, rnd=2):
    """{name: [[x, y], ...]} for line charts."""
    out = {}
    groups = df.groupby(by) if by else [(y, df)]
    for name, g in groups:
        g = g.sort_values(x)
        out[GROUP_SHORT.get(name, name)] = [[clean(a), None if pd.isna(b) else round(float(b), rnd)]
                                            for a, b in zip(g[x], g[y])]
    return out


def credit_block():
    sec = A.credit_growth_table("sector")
    ind = A.credit_growth_table("industry")
    month = sec.attrs["month"]
    main = sec[sec.code.isin(["1", "2", "3", "4"])]
    short = {"1": "Agriculture", "2": "Industry", "3": "Services", "4": "Personal loans"}
    subs = sec[(sec.level == 2) & (sec.outstanding_cr > 50000)].copy()
    subs["parent"] = subs.code.str.split(".").str[0].map(short)
    ind2 = ind[(ind.level == 2) & (ind.share_pct >= 1)].copy()
    agg = sec.set_index("code")
    yo = A.credit_yoy_series(("I", "1", "2", "3", "4"))
    yo["sector"] = yo.code.map({**short, "I": "All bank credit"})
    real = A.real_credit_growth()
    return {
        "month": clean(month),
        "total": {"outstanding_cr": clean(agg.loc["I", "outstanding_cr"]),
                  "yoy": clean(agg.loc["I", "yoy_now"]), "yoy_prev": clean(agg.loc["I", "yoy_year_ago"]),
                  "nonfood_yoy": clean(agg.loc["III", "yoy_now"])},
        "main": records(main.assign(name=main.code.map(short)),
                        ["code", "name", "outstanding_cr", "yoy_now", "yoy_year_ago", "share_pct",
                         "incr_share_pct", "incr_cr"]),
        "subs": records(subs, ["code", "sector", "parent", "outstanding_cr", "yoy_now", "yoy_year_ago",
                               "share_pct", "incr_share_pct", "incr_cr"]),
        "industry": records(ind2, ["code", "sector", "outstanding_cr", "yoy_now", "yoy_year_ago",
                                   "share_pct", "incr_share_pct"]),
        "yoy_series": series(yo, "month", "yoy", "sector"),
        "real": {"nominal": series(real, "month", "yoy")["yoy"],
                 "cpi": series(real, "month", "inflation_yoy")["inflation_yoy"],
                 "real": series(real, "month", "real_yoy")["real_yoy"]},
    }


def funding_block():
    f = A.funding()
    f = f[f.month >= "2024-12-01"]
    last = f.dropna(subset=["cd_ratio"]).iloc[-1]
    return {
        "month": clean(last.month),
        "latest": {k: clean(last[k]) for k in ["deposits", "bank_credit", "cd_ratio", "incr_cd_ratio",
                                               "credit_yoy", "deposit_yoy", "demand_share", "gsec_to_dep"]},
        "cd": series(f, "month", "cd_ratio")["cd_ratio"],
        "icd": series(f.dropna(subset=["incr_cd_ratio"]), "month", "incr_cd_ratio")["incr_cd_ratio"],
        "credit_yoy": series(f.dropna(subset=["credit_yoy"]), "month", "credit_yoy")["credit_yoy"],
        "deposit_yoy": series(f.dropna(subset=["deposit_yoy"]), "month", "deposit_yoy")["deposit_yoy"],
        "demand_share": series(f, "month", "demand_share")["demand_share"],
        "gsec_to_dep": series(f, "month", "gsec_to_dep")["gsec_to_dep"],
        "table": records(f, ["month", "deposits", "bank_credit", "cd_ratio", "incr_cd_ratio", "credit_yoy",
                             "deposit_yoy", "demand_share", "gsec_to_dep"]),
    }


def rates_block():
    r = A.rates_group()
    r19 = r[r.month >= "2019-01-01"]
    scb = r19[r19.bank_group == "Scheduled Commercial Banks"]
    names = {"walr_outstanding": "Lending rate, outstanding loans", "walr_fresh": "Lending rate, new loans",
             "td_outstanding": "Term deposit rate, outstanding", "td_fresh": "Term deposit rate, new deposits"}
    scb = scb.assign(series=scb.series.map(names))
    repo = A.repo_monthly()
    repo = repo[repo.month >= "2019-01-01"]
    t = A.transmission("2025-01-01")
    t = t[t.bank_group != "Foreign Banks"]
    tnames = {"walr_outstanding": "Lending rate, outstanding", "walr_fresh": "Lending rate, new loans",
              "mclr_1y_median": "1-year MCLR (median)", "td_outstanding": "Deposit rate, outstanding",
              "td_fresh": "Deposit rate, new deposits"}
    t = t.assign(measure_name=t.measure.map(tnames), group=t.bank_group.map(GROUP_SHORT))
    b = A.benchmark_mix()
    bl = b[b.month == b.month.max()].assign(group=lambda d: d.bank_group.map(GROUP_SHORT))
    eblr = b[b.benchmark == "EBLR"]
    s = A.spreads()
    s19 = s[(s.month >= "2019-01-01")]
    sscb = s19[s19.bank_group == "Scheduled Commercial Banks"]
    sec = A._month(A.q("select series, month, sector, value from rates_sector"))
    lastm = sec.month.max()
    yr = lastm - pd.DateOffset(years=1)
    secp = sec[sec.series == "walr_fresh"].pivot_table(index="sector", columns="month", values="value")
    sec_tbl = pd.DataFrame({"sector": secp.index, "rate": secp[lastm].values,
                            "chg_bps": ((secp[lastm] - secp[yr]) * 100).values})
    m = A.mclr_banks()
    m = m[m.bank_group != "Foreign Banks"].assign(group=lambda d: d.bank_group.map(GROUP_SHORT))
    latest = r[r.month == r.month.max()].pivot(index="bank_group", columns="series", values="value")
    return {
        "month": clean(r.month.max()),
        "repo_now": clean(A.q("select repo_rate from repo_rate order by effective_date desc limit 1").iloc[0, 0]),
        "decisions": records(A.q("select * from repo_rate where effective_date >= '2025-01-01'")),
        "scb_lines": series(scb, "month", "value", "series"),
        "repo": series(repo, "month", "repo_rate")["repo_rate"],
        "transmission": records(t, ["measure", "measure_name", "group", "start", "end", "change_bps",
                                    "pass_through_pct"]),
        "trans_meta": {"start": clean(t.attrs["start"]), "end": clean(t.attrs["end"]),
                       "repo_start": t.attrs["repo_start"], "repo_end": t.attrs["repo_end"]},
        "bench_latest": records(bl, ["group", "benchmark", "value"]),
        "bench_month": clean(b.month.max()),
        "eblr": series(eblr, "month", "value", "bank_group"),
        "spread_out": series(sscb, "month", "spread_outstanding")["spread_outstanding"],
        "spread_fresh": series(sscb, "month", "spread_fresh")["spread_fresh"],
        "real_walr": series(sscb.dropna(subset=["real_walr_outstanding"]), "month",
                            "real_walr_outstanding")["real_walr_outstanding"],
        "real_td": series(sscb.dropna(subset=["real_td_fresh"]), "month", "real_td_fresh")["real_td_fresh"],
        "sector_fresh": records(sec_tbl.sort_values("rate")),
        "sector_month": clean(lastm),
        "mclr_banks": records(m.sort_values("mclr"), ["bank", "group", "mclr", "mom_bps", "yoy_bps"]),
        "mclr_month": clean(m.attrs["month"]),
        "latest_by_group": {GROUP_SHORT[k]: {c: clean(v) for c, v in row.items()}
                            for k, row in latest.iterrows()},
    }


def cards_block():
    p = A.card_bank_panel()
    last = p.month.max()
    L = p[p.month == last].copy()
    tot_cards = L.credit_cards.sum()
    tot_spend = L.cc_spend_cr.sum()
    L["card_share"] = L.credit_cards / tot_cards * 100
    L["spend_share"] = L.cc_spend_cr / tot_spend * 100
    prev = p[p.month == last - pd.DateOffset(months=9)].set_index("bank")
    L["share_chg_pp"] = L.card_share - L.bank.map(prev.credit_cards / prev.credit_cards.sum() * 100)
    L["cards_growth"] = (L.credit_cards / L.bank.map(prev.credit_cards) - 1) * 100
    top = L[L.credit_cards > 0].sort_values("credit_cards", ascending=False)
    issuers = top[top.credit_cards >= 500000]
    t = A.card_totals()
    grp = (p[p.month == last].groupby("bank_group")[["credit_cards", "cc_spend_cr", "debit_cards",
                                                       "dc_spend_cr", "atm_total", "upi_qr"]].sum())
    grp = (grp / grp.sum() * 100).reset_index().assign(group=lambda d: d.bank_group.map(GROUP_SHORT))
    h = A.hhi("credit_cards").merge(A.hhi("cc_spend_cr"), on="month", suffixes=("_cards", "_spend"))
    # debit cards, ATMs, PoS and QR codes by bank (Indus Equity's debit card and QR code shares)
    D_ = L.copy()
    D_["dc_share"] = D_.debit_cards / D_.debit_cards.sum() * 100
    D_["qr_share"] = D_.upi_qr / D_.upi_qr.sum() * 100
    D_["cash_share"] = D_.dc_atm_cash_val / (D_.dc_atm_cash_val + D_.dc_spend_cr) * 100
    D_["dc_growth"] = (D_.debit_cards / D_.bank.map(prev.debit_cards) - 1) * 100
    debit = D_[D_.debit_cards >= 5_000_000].sort_values("debit_cards", ascending=False)
    # explain sharp falls in total PoS terminals (usually one bank changing what it reports)
    w = p.pivot_table(index="bank", columns="month", values="pos", aggfunc="sum").fillna(0)
    months = sorted(w.columns)
    pos_notes = []
    for m0, m1 in zip(months[:-1], months[1:]):
        if w[m1].sum() < w[m0].sum() * 0.95:
            chg = (w[m1] - w[m0]).sort_values()
            pos_notes.append(f"The fall in {m1:%B %Y} is mostly {chg.index[0]} reporting "
                             f"{-chg.iloc[0] / 1e5:.1f} lakh fewer terminals.")
    return {
        "month": clean(last),
        "first_month": clean(p.month.min()),
        "issuers": records(issuers, ["bank", "bank_group", "credit_cards", "card_share", "share_chg_pp",
                                     "cards_growth", "cc_spend_cr", "spend_share", "spend_per_card_rs",
                                     "ticket_rs", "ecom_share_pct"]),
        "totals": records(t),
        "groups": records(grp, ["group", "credit_cards", "cc_spend_cr", "debit_cards", "dc_spend_cr",
                                "atm_total", "upi_qr"]),
        "hhi": records(h),
        "pos_notes": pos_notes,
        "debit": records(debit, ["bank", "bank_group", "debit_cards", "dc_share", "dc_growth", "dc_spend_cr",
                                 "dc_atm_cash_val", "cash_share", "upi_qr", "qr_share", "pos", "atm_total"]),
    }


BANK_Q_COLS = [
    "label", "period_end", "derived", "interest_earned", "interest_expended", "nii", "nii_yoy", "nii_qoq",
    "other_income", "other_income_yoy", "total_income", "opex", "employee_cost", "other_opex", "opex_yoy",
    "cost_to_income", "ppop", "ppop_yoy", "provisions", "prov_to_ppop", "exceptional", "pbt", "tax", "tax_rate", "pat",
    "pat_yoy", "pat_qoq", "eps", "gnpa", "nnpa", "gnpa_pct", "nnpa_pct", "pcr", "roa", "cet1", "tier1",
    "opm", "nii_to_int_income", "other_inc_share", "deposits", "advances", "deposits_yoy", "advances_yoy",
    "cd_ratio", "investments", "net_worth", "total_assets", "bvps",
]
BANK_FY_COLS = ["label", "interest_earned", "interest_expended", "nii", "nii_yoy", "other_income", "opex", "employee_cost", "ppop", "provisions", "exceptional", "pbt", "tax", "pat", "pat_yoy", "roe", "roa", "nim_assets", "yield_advances",
                "cost_of_funds", "credit_cost", "cost_to_income", "deposits", "advances", "deposits_yoy",
                "advances_yoy", "gnpa_pct", "nnpa_pct", "pcr", "cet1", "bvps"]


def banks_block():
    q = A.q("select * from bank_q_metrics")
    fy = A.q("select * from bank_fy_metrics")
    if q.empty:
        return None
    banks = pd.read_csv(ROOT / "raw" / "manual" / "banks.csv")
    out = {"banks": [], "q": {}, "fy": {}}
    for _, b in banks.iterrows():
        s = q[q.symbol == b.symbol].sort_values("period_end")
        if s.empty:
            continue
        out["banks"].append({"symbol": b.symbol, "name": b["name"], "short": b["short"], "group": b.group})
        out["q"][b.symbol] = [{k: clean(v) for k, v in r.items()} for r in s[BANK_Q_COLS].to_dict("records")]
        f = fy[fy.symbol == b.symbol].sort_values("fy")
        out["fy"][b.symbol] = [{k: clean(v) for k, v in r.items()} for r in f[BANK_FY_COLS].to_dict("records")]
    return out


NBFC_Q_COLS = ["period_end", "label", "derived", "impairment_est", "revenue_ops", "revenue_ops_yoy", "revenue_ops_qoq",
               "interest_income", "fee_income", "other_income", "total_income", "total_income_yoy",
               "employee_cost", "other_opex", "impairment", "depreciation", "expenditure_ex_int",
               "expenditure_ex_int_yoy", "finance_cost", "finance_cost_yoy", "nii", "nii_yoy", "exceptional",
               "pbt", "tax", "tax_rate", "pat", "pat_yoy", "pat_qoq", "eps", "employee_cost_pct_ti",
               "other_opex_pct_ti", "impairment_pct_ti", "finance_cost_pct_ti", "pat_margin",
               "cost_to_income", "credit_cost_to_ppop", "credit_cost_ann", "roa_ann", "roe_ann", "loans",
               "loans_yoy", "borrowings_total", "net_worth", "leverage", "bvps"]
NBFC_FY_COLS = ["fy", "label", "revenue_ops", "revenue_ops_yoy", "interest_income", "fee_income", "other_income",
                "total_income", "total_income_yoy", "employee_cost", "other_opex", "depreciation", "impairment",
                "expenditure_ex_int", "finance_cost", "nii", "nii_yoy",
                "exceptional", "pbt", "tax", "pat", "pat_yoy", "eps", "cost_to_income", "credit_cost", "roa", "roe",
                "nim_assets", "yield_loans", "cost_of_borrowings", "spread", "opex_to_assets", "loans", "loans_yoy",
                "borrowings_total", "net_worth", "leverage", "bvps"]


def nbfcs_block():
    try:
        q = A.q("select * from nbfc_q_metrics")
        fy = A.q("select * from nbfc_fy_metrics")
    except Exception:
        return None
    cos = pd.read_csv(ROOT / "raw" / "manual" / "nbfcs.csv")
    out = {"cos": [], "q": {}, "fy": {}}
    for _, b in cos.iterrows():
        s = q[q.symbol == b.symbol].sort_values("period_end")
        if s.empty:
            continue
        out["cos"].append({"symbol": b.symbol, "name": b["name"], "short": b["short"], "group": b.group,
                           "note": b.get("note") if isinstance(b.get("note"), str) else None})
        out["q"][b.symbol] = records(s, [c for c in NBFC_Q_COLS if c in s])
        f = fy[fy.symbol == b.symbol].sort_values("fy")
        out["fy"][b.symbol] = records(f, [c for c in NBFC_FY_COLS if c in f])
    return out


def valuation_block():
    try:
        v = A.q("select * from valuation")
    except Exception:
        return None
    if v.empty:
        return None
    names = pd.concat([pd.read_csv(ROOT / "raw" / "manual" / f"{f}.csv")[["symbol", "name", "short", "group"]]
                       for f in ("banks", "nbfcs")])
    v = v.merge(names, on="symbol", how="left").rename(columns={"mcap_cr": "mcap", "roe_fy": "roe", "mcap_chg_1y": "chg"})
    cols = ["symbol", "name", "short", "group", "sector", "close", "mcap", "chg", "pb", "pe", "roe", "roe_label",
            "bs_label", "ttm_label", "split_events"]
    return {"date": str(v.price_date.max()), "rows": records(v, cols)}


def spatial_block():
    try:
        st = A.q("select * from spatial_state")
        gr = A.q("select * from spatial_growth")
    except Exception:
        return None
    if st.empty:
        return None
    st["quarter"] = pd.to_datetime(st.quarter)
    groups = ["Rural", "Semi-urban", "Urban", "Metropolitan"]
    pg = st[st.pop_group.isin(groups)].groupby(["quarter", "pop_group"])[["offices", "deposits_cr", "credit_cr"]].sum()
    pg = pg.reset_index()
    tot = pg.groupby("quarter")[["deposits_cr", "credit_cr"]].transform("sum")
    pg["credit_share"] = pg.credit_cr / tot.credit_cr * 100
    pg["deposit_share"] = pg.deposits_cr / tot.deposits_cr * 100
    pg["cd_ratio"] = pg.credit_cr / pg.deposits_cr * 100
    last = pg.quarter.max()
    # compare like with like: the earliest quarter ending in the same month as the latest
    first = pg.quarter[pg.quarter.dt.month == last.month].min()
    share_of = lambda q, col: {r.pop_group: round(float(r[col]), 2) for _, r in pg[pg.quarter == q].iterrows()}
    shares = {"credit_first": share_of(first, "credit_share"), "credit_last": share_of(last, "credit_share"),
              "rows": [{"label": f"{lab} {q:%b-%y}", "values": share_of(q, col)}
                       for lab, col in (("Credit", "credit_share"), ("Deposits", "deposit_share"))
                       for q in (first, last)]}
    # states: latest quarter, with growth on the same quarter a year earlier
    s = st[st.pop_group == "All Population Groups"].copy()
    yago = last - pd.DateOffset(years=1)
    prev = s[s.quarter == yago].set_index("state")
    cur = s[s.quarter == last].set_index("state")
    rural = (st[(st.quarter == last) & (st.pop_group.isin(["Rural", "Semi-urban"]))]
             .groupby("state").credit_cr.sum())
    states = cur.assign(
        cd=cur.credit_cr / cur.deposits_cr * 100,
        credit_share=cur.credit_cr / cur.credit_cr.sum() * 100,
        credit_yoy=(cur.credit_cr / prev.credit_cr - 1) * 100,
        deposits_yoy=(cur.deposits_cr / prev.deposits_cr - 1) * 100,
        rural_share=rural.reindex(cur.index) / cur.credit_cr * 100,
    ).reset_index()
    gr["quarter"] = pd.to_datetime(gr.quarter)
    growth = {}
    for (dim, metric), g in gr[gr.metric != "ratio"].groupby(["dimension", "metric"]):
        growth.setdefault(dim, {})[metric] = series(g, "quarter", "value", by="grp", rnd=1)
    return {
        "first": first.strftime("%Y-%m-%d"), "last": last.strftime("%Y-%m-%d"),
        "shares": shares,
        "cd": series(pg, "quarter", "cd_ratio", by="pop_group", rnd=1),
        "credit_share": series(pg, "quarter", "credit_share", by="pop_group", rnd=2),
        "latest": records(pg[pg.quarter == last], ["pop_group", "offices", "deposits_cr", "credit_cr", "credit_share",
                                                  "deposit_share", "cd_ratio"]),
        "growth": growth,
        "states": records(states, ["state", "region", "offices", "deposits_cr", "credit_cr", "cd", "credit_share",
                                   "credit_yoy", "deposits_yoy", "rural_share"]),
    }


def _rupees(cr):
    """Rs crore -> short label: 0.0025 -> 25k, 0.02 -> 2 lakh, 4 -> 4 cr."""
    v = cr * 1e7
    if v < 1e5:
        return f"₹{v / 1e3:g}k"
    if v < 1e7:
        return f"₹{v / 1e5:g} lakh"
    return f"₹{cr:g} cr"


def _band(dim, label):
    import re
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", label)]
    low = label.lower()
    if not nums:
        return label
    if dim == "Interest rate":
        if low.startswith("less than"):
            return f"Below {nums[0]:g}%"
        if "less than" in low and len(nums) == 2:
            return f"{nums[0]:g}–{nums[1]:g}%"
        if "above" in low:
            return f"{nums[0]:g}% and above"
    if dim == "Credit limit size":
        if "less" in low and len(nums) == 1:
            return f"Up to {_rupees(nums[0])}"
        if len(nums) == 2:
            return f"{_rupees(nums[0])}–{_rupees(nums[1])}"
        if len(nums) == 1:
            return f"Above {_rupees(nums[0])}"
    return label


def bsr1_block():
    try:
        d = A.q("select * from bsr1_dist")
    except Exception:
        return None
    if d.empty:
        return None
    d["is_total"] = d.is_total.astype(bool)      # stored as 0/1 in SQLite
    out = {"as_of": str(d.as_of.dropna().max()), "dims": {}}
    for dim, g in d.groupby("dimension", sort=False):
        g = g.sort_values("ord")
        tot = g[g.is_total].sort_values("ord")
        base_acc = tot.accounts.iloc[0] if len(tot) and "accounts" in g and pd.notna(tot.accounts.iloc[0]) else None
        rows = []
        for _, r in g[~g.is_total].iterrows():
            rows.append({"label": _band(dim, r.category), "share": clean(r.share_pct), "amount": clean(r.outstanding_cr),
                         "accounts": clean(r.get("accounts")),
                         "acc_share": clean(r.accounts / base_acc * 100) if base_acc and pd.notna(r.get("accounts")) else None,
                         "level": clean(r.get("level")) if "level" in r else 1})
        out["dims"][dim] = rows
    return out


def bsr1_history_block():
    import re
    try:
        pb = A.q("select * from bsr1_popbank")
        rh = A.q("select * from bsr1_rates_hist")
    except Exception:
        return None
    if pb.empty:
        return None
    groups = ["Rural", "Semi-urban", "Urban", "Metropolitan"]
    yr = lambda d: str(d)[:4]
    # population-group shares excluding regional rural banks (the basis Indus Equity uses)
    ex = pb[~pb.bank_group.isin(["All SCBs", "Regional rural banks"]) & pb.pop_group.isin(groups)]
    pop = ex.groupby(["as_of", "pop_group"]).outstanding_cr.sum().unstack()
    pop = pop.div(pop.sum(axis=1), axis=0) * 100
    pop_rows = [{"label": f"Mar-{yr(i)[2:]}", "values": {g: round(float(r[g]), 2) for g in groups}} for i, r in pop.iterrows()]
    # bank-group shares of all credit (incl. RRBs)
    tot = pb[(pb.pop_group == "All") & (pb.bank_group != "All SCBs")]
    tot = tot.assign(share=tot.outstanding_cr / tot.groupby("as_of").outstanding_cr.transform("sum") * 100,
                     date=pd.to_datetime(tot.as_of))
    bank = series(tot, "date", "share", by="bank_group", rnd=2)
    # where PSU and private banks lend: first vs latest year
    within = []
    for bg in ("PSU banks", "Private banks"):
        g = pb[(pb.bank_group == bg) & pb.pop_group.isin(groups)]
        for d in (g.as_of.min(), g.as_of.max()):
            s = g[g.as_of == d].set_index("pop_group").outstanding_cr
            within.append({"label": f"{bg} Mar-{yr(d)[2:]}", "values": {k: round(float(v / s.sum() * 100), 2) for k, v in s.items()}})
    # share of loans charged below 9% (bands differ by year; all have a 9% boundary)
    def upper(c):
        n = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", c)]
        return n[-1] if n and "less than" in c.lower() else None
    below9 = []
    for d, g in rh.groupby("as_of"):
        base = g[g.category.str.contains("Total Loans", case=False)].outstanding_cr
        if base.empty:
            continue
        b = g[g.category.map(lambda c: (upper(c) or 99) <= 9 and "total" not in c.lower())].outstanding_cr.sum()
        below9.append([str(d)[:10], round(float(b / base.iloc[0] * 100), 1)])
    return {"years": [yr(i) for i in pop.index], "pop_rows": pop_rows, "bank": bank, "within": within, "below9": below9}


def bsr2_block():
    try:
        d = A.q("select * from bsr2_deposits")
    except Exception:
        return None
    if d.empty:
        return None
    groups = ["Rural", "Semi-urban", "Urban", "Metropolitan"]
    d["date"] = pd.to_datetime(d.as_of)
    ex = d[~d.bank_group.isin(["All SCBs", "Regional rural banks"]) & d.pop_group.isin(groups)]
    pop = ex.groupby(["as_of", "pop_group"]).total_cr.sum().unstack()
    pop = pop.div(pop.sum(axis=1), axis=0) * 100
    allb = d[d.bank_group == "All SCBs"]
    casa_pop = series(allb[allb.pop_group.isin(groups + ["All"])].replace({"pop_group": {"All": "All India"}}),
                      "date", "casa_pct", by="pop_group", rnd=1)
    bank = d[(d.pop_group == "All") & (d.bank_group != "All SCBs")]
    last = allb[allb.as_of == allb.as_of.max()].set_index("pop_group")
    return {
        "years": [str(i)[:4] for i in pop.index],
        "pop_rows": [{"label": f"Mar-{str(i)[2:4]}", "values": {g: round(float(r[g]), 2) for g in groups}}
                     for i, r in pop.iterrows()],
        "casa_pop": casa_pop,
        "casa_bank": series(bank, "date", "casa_pct", by="bank_group", rnd=1),
        "latest": {"as_of": str(allb.as_of.max()), "total_cr": clean(last.loc["All", "total_cr"]),
                   "casa": clean(last.loc["All", "casa_pct"])},
    }


def presentation_block():
    """Verified figures from investor presentations: {symbol: {metric: {...}}} (latest file each)."""
    try:
        p = A.q("select * from presentation_metrics")
    except Exception:
        return None
    if p.empty:
        return None
    p = p.sort_values("file").groupby(["symbol", "metric"]).tail(1)
    out = {}
    for _, r in p.iterrows():
        out.setdefault(r.symbol, {})[r.metric] = {"value": clean(r.value), "prev": clean(r.prev_year),
                                                 "page": clean(r.page), "period_end": r.period_end,
                                                 "file": r.file, "basis": r.basis}
    return out


def notes_block():
    n = A.q("select dataset, note from data_notes")
    cpi = A.q("select month, base, status from cpi order by month desc limit 1")
    return {"notes": records(n), "cpi_latest": records(cpi)[0]}


def main():
    data = {
        "built": date.today().isoformat(),
        "credit": credit_block(),
        "funding": funding_block(),
        "rates": rates_block(),
        "cards": cards_block(),
        "banks": banks_block(),
        "nbfcs": nbfcs_block(),
        "val": valuation_block(),
        "spatial": spatial_block(),
        "bsr1": bsr1_block(),
        "bsr1_hist": bsr1_history_block(),
        "bsr2": bsr2_block(),
        "pres": presentation_block(),
        "notes": notes_block(),
    }
    blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8")
    assert "/*__DATA__*/{}" in html, f"data placeholder missing from {TEMPLATE}"
    html = html.replace("/*__DATA__*/{}", blob, 1)
    html = artifact_body(html)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    (ROOT / "reports" / "report_data.json").write_text(json.dumps(data, indent=1, ensure_ascii=False),
                                                       encoding="utf-8")
    print(f"wrote {OUT} ({len(html)//1024} KB)")


def artifact_body(html: str) -> str:
    """Drop the <!doctype>/<html>/<head>/<body> wrapper: the artifact host adds its own skeleton."""
    import re
    head = re.search(r"<head>(.*?)</head>", html, flags=re.S)
    body = re.search(r"<body>(.*?)</body>", html, flags=re.S)
    if not (head and body):
        return html
    keep = re.sub(r'\s*<meta (charset|name="viewport")[^>]*>', "", head.group(1))
    return '<meta charset="utf-8">\n' + keep.strip() + "\n" + body.group(1).strip() + "\n"


if __name__ == "__main__":
    main()
