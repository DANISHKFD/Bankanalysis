"""Market capitalisation and valuation multiples for banks and NBFCs/HFCs.

Tables written (data/bank.db)
  valuation       one row per company at the latest price date: close, shares, market cap,
                  price-to-book (market cap / latest net worth), price-to-earnings (market cap /
                  last four quarters' profit), latest full-year RoE, and market-cap change on a
                  year earlier
  valuation_hist  price-to-book at each September and March balance-sheet date since FY23,
                  and trailing P/E at every quarter end

Shares are paid-up capital / face value from the latest quarterly filing. Splits and
bonuses after that filing are picked up from the price files: on an ex-date NSE's
'previous close' is adjusted, so actual previous close / adjusted previous close is the
share multiplier. Market cap and multiples are computed on totals, so per-share figures
(and their split adjustments) are never needed.

Usage:  python src/valuation.py
"""
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "bank.db"
BHAV = ROOT / "raw" / "nse" / "bhav"


def prices():
    frames = [pd.read_csv(f).assign(date=pd.Timestamp(f.stem)) for f in sorted(BHAV.glob("*.csv"))]
    return pd.concat(frames, ignore_index=True).sort_values(["symbol", "date"])


def fundamentals():
    with sqlite3.connect(DB) as con:
        b = pd.read_sql("select symbol, period_end, label, shares_cr, net_worth, pat from bank_q_metrics", con)
        n = pd.read_sql("select symbol, period_end, label, shares_cr, net_worth, pat from nbfc_q_metrics", con)
        bf = pd.read_sql("select symbol, fy, label, roe from bank_fy_metrics", con)
        nf = pd.read_sql("select symbol, fy, label, roe from nbfc_fy_metrics", con)
    q = pd.concat([b.assign(sector="Bank"), n.assign(sector="NBFC")], ignore_index=True)
    q["period_end"] = pd.to_datetime(q.period_end)
    q = q.sort_values(["symbol", "period_end"])
    # trailing four quarters' profit, only when the four quarters are consecutive
    g = q.groupby("symbol")
    span = (q.period_end - g.period_end.shift(3)).dt.days
    q["ttm_pat"] = np.where(span.between(260, 290), g.pat.transform(lambda s: s.rolling(4).sum()), np.nan)
    return q, pd.concat([bf, nf], ignore_index=True)


def split_factor(px, sym, since):
    """Share multiplier from splits/bonuses with ex-date after `since`."""
    p = px[(px.symbol == sym) & (px.date > since)].copy()
    p["actual_prev"] = p.close.shift(1)
    p = p.dropna(subset=["actual_prev"])
    # consecutive trading days only: the daily run covers everything after the oldest filing
    ratio = p.actual_prev / p.prev_close
    events = ratio[(ratio > 1.1) | (ratio < 0.9)]
    return float(events.prod()) if len(events) else 1.0, list(zip(p.loc[events.index, "date"].dt.date, events.round(3)))


def close_on(px, sym, d):
    """Close on the trading day nearest to d (within a week before or three days after)."""
    p = px[(px.symbol == sym) & (px.date <= d + pd.Timedelta(days=3)) & (px.date > d - pd.Timedelta(days=8))]
    if p.empty:
        return np.nan, pd.NaT
    i = (p.date - d).abs().values.argmin()
    return p.close.iloc[i], p.date.iloc[i]


def main():
    px = prices()
    q, fy = fundamentals()
    last_day = px.date.max()
    rows, hist = [], []
    for sym, g in q.groupby("symbol"):
        sh = g.dropna(subset=["shares_cr"])
        nw = g.dropna(subset=["net_worth"])
        if sh.empty:
            continue
        s_row = sh.iloc[-1]
        factor, events = split_factor(px, sym, s_row.period_end)
        close, d = close_on(px, sym, last_day)
        shares = s_row.shares_cr * factor
        mcap = close * shares                                   # crore shares x Rs = Rs crore
        ttm = g.dropna(subset=["ttm_pat"]).iloc[-1] if g.ttm_pat.notna().any() else None
        f = fy[fy.symbol == sym].sort_values("fy")
        f = f[f.roe.notna()]
        year_ago = last_day - pd.Timedelta(days=365)
        c1, d1 = close_on(px, sym, year_ago)
        sh1 = sh[sh.period_end <= year_ago]
        mcap1 = c1 * sh1.shares_cr.iloc[-1] if len(sh1) else np.nan
        rows.append({
            "symbol": sym, "sector": s_row.sector, "price_date": d.date() if pd.notna(d) else None,
            "close": close, "shares_cr": shares, "split_factor": factor,
            "split_events": "; ".join(f"{a} x{b}" for a, b in events) or None,
            "mcap_cr": mcap, "net_worth": nw.net_worth.iloc[-1] if len(nw) else np.nan,
            "bs_label": nw.label.iloc[-1] if len(nw) else None,
            "pb": mcap / nw.net_worth.iloc[-1] if len(nw) and nw.net_worth.iloc[-1] > 0 else np.nan,
            "ttm_pat": ttm.ttm_pat if ttm is not None else np.nan, "ttm_label": ttm.label if ttm is not None else None,
            "pe": mcap / ttm.ttm_pat if ttm is not None and ttm.ttm_pat > 0 else np.nan,
            "roe_fy": f.roe.iloc[-1] if len(f) else np.nan, "roe_label": f.label.iloc[-1] if len(f) else None,
            "mcap_1y_ago": mcap1, "mcap_chg_1y": (mcap / mcap1 - 1) * 100 if mcap1 and mcap1 > 0 else np.nan,
        })
        # history at quarter ends: same-date shares, so no split adjustment is needed
        for _, r in g[g.period_end >= "2023-03-31"].iterrows():
            c, dd = close_on(px, sym, r.period_end)
            if np.isnan(c) or pd.isna(r.shares_cr):
                continue
            m = c * r.shares_cr
            hist.append({"symbol": sym, "period_end": r.period_end.date(), "label": r.label, "close": c, "mcap_cr": m,
                         "pb": m / r.net_worth if r.net_worth and r.net_worth > 0 else np.nan,
                         "pe": m / r.ttm_pat if r.ttm_pat and r.ttm_pat > 0 else np.nan})
    v, h = pd.DataFrame(rows), pd.DataFrame(hist)
    with sqlite3.connect(DB) as con:
        v.to_sql("valuation", con, if_exists="replace", index=False)
        h.to_sql("valuation_hist", con, if_exists="replace", index=False)
    pd.set_option("display.width", 250, "display.max_rows", 100)
    print(f"valuation: {len(v)} companies at {last_day.date()}; history {len(h)} rows")
    print(v.sort_values("mcap_cr", ascending=False)[["symbol", "close", "shares_cr", "split_events", "mcap_cr", "pb",
                                                     "pe", "roe_fy", "mcap_chg_1y"]].round(2).to_string(index=False))


if __name__ == "__main__":
    main()
