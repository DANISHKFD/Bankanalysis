"""Parse quarterly result XBRL (raw/nse/<SYMBOL>/*.xml) of banks and NBFCs/HFCs into data/bank.db.

Tables
  results_facts  every non-dimensional numeric fact: symbol, period_end, basis, item, value
                 basis: Q   = the quarter
                        YTD = financial year to date (equals Q for Jun quarters)
                        I   = balance at period end
                        PYI = balance at the previous financial year end
  bank_quarter   one row per (symbol, quarter): P&L for the quarter, asset quality,
                 capital ratios, and balance-sheet items where filed (Sep and Mar).
                 Missing standalone quarters are rebuilt from YTD differences when the
                 neighbouring filings allow it (flagged in `derived`).
  nbfc_quarter   the same for NBFCs/HFCs (raw/manual/nbfcs.csv), which file the Ind AS
                 format: revenue from operations by type, finance costs, impairment on
                 financial instruments; balance sheet (loans, borrowings, debt securities,
                 equity) in Sep and Mar filings. No NPA ratios: NBFCs do not tag them.

Amounts in Rs crore; ratios in % (RoA is for the quarter, not annualised).

Usage:  python src/parse_results.py
"""
import re
import sqlite3
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "nse"
DB = ROOT / "data" / "bank.db"
NS_DATA = ("in-capmkt", "in-bse-fin")
XBRLI = "http://www.xbrl.org/2003/instance"

PCT_ITEMS = re.compile(r"Ratio$|^PercentageOf|^ReturnOnAssets$")
KEEP_RAW_UNITS = {"BasicEarningsPerShareBeforeExtraordinaryItems", "DilutedEarningsPerShareBeforeExtraordinaryItems",
                  "BasicEarningsPerShareAfterExtraordinaryItems", "DilutedEarningsPerShareAfterExtraordinaryItems",
                  "FaceValueOfEquityShareCapital", "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
                  "DebtEquityRatio"}
MANUAL = ROOT / "raw" / "manual"

FLOW = {  # quarterly P&L items -> column
    "InterestOrDiscountOnAdvancesOrBills": "int_advances",
    "RevenueOnInvestments": "int_investments",
    "InterestOnBalancesWithReserveBankOfIndiaAndOtherInterBankFunds": "int_rbi_interbank",
    "OtherInterest": "int_other",
    "InterestEarned": "interest_earned",
    "OtherIncome": "other_income",
    "Income": "total_income",
    "InterestExpended": "interest_expended",
    "EmployeesCost": "employee_cost",
    "OtherOperatingExpenses": "other_opex",
    "OperatingExpenses": "opex",
    "OperatingProfitBeforeProvisionAndContingencies": "ppop",
    "ProvisionsOtherThanTaxAndContingencies": "provisions",
    "ExceptionalItems": "exceptional",
    "ProfitLossFromOrdinaryActivitiesBeforeTax": "pbt",
    "TaxExpense": "tax",
    "ProfitLossForThePeriod": "pat",
    "BasicEarningsPerShareAfterExtraordinaryItems": "eps",
}
STOCK = {  # point-in-time items reported every quarter (OneD context in filings)
    "GrossNonPerformingAssets": "gnpa",
    "NonPerformingAssets": "nnpa",
    "PercentageOfGrossNpa": "gnpa_pct",
    "PercentageOfNpa": "nnpa_pct",
    "ReturnOnAssets": "roa_q",
    "CET1Ratio": "cet1",
    "AdditionalTier1Ratio": "at1",
    "PaidUpValueOfEquityShareCapital": "paid_up_capital",
    "FaceValueOfEquityShareCapital": "face_value",
    "PercentageOfShareHeldByGovernmentOfIndia": "govt_holding",
}
BALANCE = {  # statement of assets and liabilities (Sep and Mar filings)
    "Capital": "bs_capital",
    "ReservesAndSurplus": "bs_reserves",
    "Deposits": "deposits",
    "Borrowings": "borrowings",
    "OtherLiabilitiesAndProvisions": "other_liabilities",
    "CashAndBalancesWithReserveBankOfIndia": "cash_rbi",
    "BalancesWithBanksAndMoneyAtCallAndShortNotice": "bank_balances",
    "Investments": "investments",
    "Advances": "advances",
    "FixedAssets": "fixed_assets",
    "OtherAssets": "other_assets",
    "Assets": "total_assets",
}

NBFC_FLOW = {  # Ind AS (Division III) statement of profit and loss
    "InterestEarned": "interest_income",
    "DividendIncome": "dividend_income",
    "FeesAndCommissionIncome": "fee_income",
    "NetGainOnFairValueChanges": "fv_gain",
    "NetGainOnDerecognitionOfFinancialInstrumentsUnderAmortisedCostCategory": "derecognition_gain",
    "RevenueFromOperations": "revenue_ops",
    "OtherIncome": "other_income",
    "Income": "total_income",
    "FinanceCosts": "finance_cost",
    "FeesAndCommissionExpense": "fee_expense",
    "NetLossOnFairValueChanges": "fv_loss",
    "ImpairmentOnFinancialInstruments": "impairment",
    "EmployeeBenefitExpense": "employee_cost",
    "DepreciationDepletionAndAmortisationExpense": "depreciation",
    "OtherExpenses": "other_expenses",
    "Expenses": "total_expenses",
    "ProfitBeforeExceptionalItemsAndTax": "pbt_pre_exceptional",
    "ExceptionalItemsBeforeTax": "exceptional",
    "ProfitBeforeTax": "pbt",
    "TaxExpense": "tax",
    "ProfitLossForPeriod": "pat",
    "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations": "eps",
}
NBFC_STOCK = {
    "PaidUpValueOfEquityShareCapital": "paid_up_capital",
    "FaceValueOfEquityShareCapital": "face_value",
    "DebtEquityRatio": "debt_equity",
}
NBFC_BALANCE = {
    "CashAndCashEquivalents": "cash",
    "BankBalanceOtherThanCashAndCashEquivalents": "bank_balances",
    "Loans": "loans",
    "Investments": "investments",
    "Assets": "total_assets",
    "EquityShareCapital": "bs_capital",
    "OtherEquity": "other_equity",
    "Equity": "net_worth",
    "DebtSecurities": "debt_securities",
    "Borrowings": "borrowings",
    "Deposits": "deposits",
    "SubordinatedLiabilities": "subordinated",
}


def parse_file(path):
    tree = etree.parse(str(path))
    root = tree.getroot()
    ctx = {}
    for c in root.iter(f"{{{XBRLI}}}context"):
        cid = c.get("id")
        dims = c.find(f".//{{{XBRLI}}}segment") is not None or c.find(f".//{{{XBRLI}}}scenario") is not None
        p = c.find(f"{{{XBRLI}}}period")
        inst = p.find(f"{{{XBRLI}}}instant")
        if inst is not None:
            ctx[cid] = ("I", None, inst.text.strip(), dims)
        else:
            ctx[cid] = ("D", p.find(f"{{{XBRLI}}}startDate").text.strip(),
                        p.find(f"{{{XBRLI}}}endDate").text.strip(), dims)
    fmt = "new" if any(el.prefix == "in-capmkt" for el in root) else "old"
    facts = []
    for el in root:
        if not isinstance(el.tag, str) or el.prefix not in NS_DATA:
            continue
        c = ctx.get(el.get("contextRef"))
        if c is None:
            # Pre-2022 NSE files reference OneD/FourD/OneI without defining them;
            # the ids follow a fixed convention, so resolve them by name.
            cid0 = el.get("contextRef") or ""
            if cid0 in ("OneD", "FourD"):
                c = ("D", None, None, False)
            elif cid0 in ("OneI", "FourI"):
                c = ("I", None, str(path.stem), False)
            else:
                continue
        if c[3]:
            continue
        try:
            v = float((el.text or "").strip())
        except ValueError:
            continue
        name = etree.QName(el).localname
        cid = el.get("contextRef")
        facts.append((name, cid, c, v))
    return fmt, facts


def classify(fmt, cid, c, period_end):
    """Map a context to basis Q / YTD / I / PYI (None = ignore)."""
    kind, start, end, _ = c
    if kind == "I":
        end_d = datetime.strptime(end, "%Y-%m-%d").date()
        if end_d == period_end:
            return "I"
        if end_d < period_end:
            return "PYI"
        return None
    if fmt == "old":  # old filings: OneD = quarter, FourD = year to date (dates unreliable)
        return {"OneD": "Q", "FourD": "YTD"}.get(cid)
    s = datetime.strptime(start, "%Y-%m-%d").date()
    e = datetime.strptime(end, "%Y-%m-%d").date()
    if e != period_end:
        return None
    months = (e.year - s.year) * 12 + e.month - s.month + 1
    return "Q" if months <= 3 else "YTD"


def scale(item, v):
    if item in KEEP_RAW_UNITS:
        return v
    if PCT_ITEMS.search(item):
        return v * 100
    return v / 1e7  # rupees -> crore


def build_facts():
    rows = []
    for d in sorted(RAW.glob("*/")):
        sym = d.name
        for f in sorted(d.glob("*.xml")):
            pe = datetime.strptime(f.stem, "%Y-%m-%d").date()
            fmt, facts = parse_file(f)
            for name, cid, c, v in facts:
                basis = classify(fmt, cid, c, pe)
                if basis:
                    rows.append((sym, pe, basis, name, scale(name, v), fmt))
    df = pd.DataFrame(rows, columns=["symbol", "period_end", "basis", "item", "value", "fmt"])
    # Jun quarter: YTD is the quarter itself
    jun = (df.basis == "YTD") & df.period_end.map(lambda d: d.month == 6)
    df = pd.concat([df, df[jun].assign(basis="Q")]).drop_duplicates(["symbol", "period_end", "basis", "item"])
    return df


def fy_quarters(pe):
    """Quarter ends of the financial year up to and including pe."""
    fy_start = pe.year if pe.month >= 4 else pe.year - 1
    qs = [date(fy_start, 6, 30), date(fy_start, 9, 30), date(fy_start, 12, 31), date(fy_start + 1, 3, 31)]
    return [q for q in qs if q <= pe]


def build_quarter(facts, flow=FLOW, stock=STOCK, balance=BALANCE):
    q = facts[facts.basis == "Q"]
    ytd = facts[facts.basis == "YTD"]
    inst = facts[facts.basis == "I"]
    wide_q = q.pivot_table(index=["symbol", "period_end"], columns="item", values="value", aggfunc="first")
    wide_ytd = ytd.pivot_table(index=["symbol", "period_end"], columns="item", values="value", aggfunc="first")
    wide_i = inst.pivot_table(index=["symbol", "period_end"], columns="item", values="value", aggfunc="first")

    out = pd.DataFrame(index=wide_q.index.union(wide_i.index))
    for src, col in {**flow, **stock}.items():
        out[col] = wide_q[src] if src in wide_q else pd.NA
    for src, col in balance.items():
        out[col] = wide_i[src] if src in wide_i else pd.NA
    out["derived"] = False
    out = out.reset_index()

    # rebuild missing quarters' flows: Q_missing = YTD(next quarter in FY) - Q(next quarter)
    have = set(zip(out.symbol, out.period_end))
    add = []
    for sym in out.symbol.unique():
        for (s, pe) in [k for k in wide_ytd.index if k[0] == sym]:
            qs = fy_quarters(pe)
            missing = [x for x in qs if (sym, x) not in have]
            if len(missing) != 1 or missing[0] == pe:
                continue
            others = [x for x in qs if x != missing[0]]
            if not all((sym, x) in wide_q.index for x in others):
                continue
            rec = {"symbol": sym, "period_end": missing[0], "derived": True}
            for src, col in flow.items():
                if col == "eps":
                    continue
                if src in wide_ytd and src in wide_q:
                    rec[col] = wide_ytd.loc[(sym, pe), src] - sum(wide_q.loc[(sym, x), src] for x in others)
            add.append(rec)
            have.add((sym, missing[0]))
    if add:
        out = pd.concat([out, pd.DataFrame(add)], ignore_index=True)
    return out.sort_values(["symbol", "period_end"]).reset_index(drop=True)


def universe(name):
    return set(pd.read_csv(MANUAL / f"{name}.csv").symbol)


def main():
    facts = build_facts()
    banks = facts[facts.symbol.isin(universe("banks"))]
    nbfcs = facts[facts.symbol.isin(universe("nbfcs"))]
    quarter = build_quarter(banks)
    nq = build_quarter(nbfcs, NBFC_FLOW, NBFC_STOCK, NBFC_BALANCE)
    with sqlite3.connect(DB) as con:
        facts.to_sql("results_facts", con, if_exists="replace", index=False)
        quarter.to_sql("bank_quarter", con, if_exists="replace", index=False)
        nq.to_sql("nbfc_quarter", con, if_exists="replace", index=False)
    print(f"results_facts: {len(facts)} rows, {facts.symbol.nunique()} companies")
    for name, t, bs in (("banks", quarter, "deposits"), ("NBFCs/HFCs", nq, "loans")):
        cov = t.groupby("symbol").agg(quarters=("period_end", "count"), first=("period_end", "min"),
                                      last=("period_end", "max"), derived=("derived", "sum"),
                                      with_bs=(bs, lambda s: s.notna().sum()))
        print(f"\n{name}:\n{cov.to_string()}")


if __name__ == "__main__":
    main()
