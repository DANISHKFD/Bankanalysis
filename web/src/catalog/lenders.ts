import { cr, D, isNum, median, n, pct, signed, type Pt } from "../data";

export type Kind = "bank" | "nbfc";
export type Metric = {
  id: string; label: string; short: string; fmt: (v: number) => string; up: boolean;
  get: (sym: string) => { v: number | null; when: string } ; hist?: string; // quarterly field for history charts
  what: string; how: string; source: string;
};

const P = (v: number) => pct(v, 1);
const P2 = (v: number) => `${n(v, 2)}%`;
const filing = "Quarterly results filed with NSE (XBRL).";
const deck = "Company investor presentation, read by Claude and checked against the page it came from.";

/** Latest non-empty value of a quarterly field, with the quarter label. */
export function latestQ(kind: Kind, sym: string, field: string) {
  const rows: any[] = (kind === "bank" ? D.banks.q : D.nbfcs.q)[sym] || [];
  for (let i = rows.length - 1; i >= 0; i--) if (isNum(rows[i][field])) return { v: rows[i][field] as number, when: rows[i].label as string };
  return { v: null, when: "" };
}
const pres = (sym: string, k: string) => { const p = D.pres?.[sym]?.[k]; return p ? { v: p.value as number, when: p.period_end as string } : { v: null, when: "" }; };
const val = (sym: string, k: string) => { const r = (D.val.rows as any[]).find(x => x.symbol === sym); return { v: r && isNum(r[k]) ? r[k] : null, when: D.val.date }; };
const q = (kind: Kind, field: string) => (sym: string) => latestQ(kind, sym, field);

const common = (kind: Kind): Metric[] => [
  { id: "profit", label: "Net profit, latest quarter", short: "Quarterly profit", fmt: v => cr(v), up: true, get: q(kind, "pat"), hist: "pat",
    what: "Profit after tax in the latest quarter.", how: "As reported in the standalone quarterly results.", source: filing },
  { id: "profit-growth", label: "Profit growth", short: "Profit growth", fmt: v => signed(v, 1, "%"), up: true, get: q(kind, "pat_yoy"), hist: "pat_yoy",
    what: "How much more (or less) the lender earned than in the same quarter last year.", how: "Net profit this quarter ÷ same quarter last year − 1.", source: filing },
  { id: "nii-growth", label: "Net interest income growth", short: "NII growth", fmt: v => signed(v, 1, "%"), up: true, get: q(kind, "nii_yoy"), hist: "nii_yoy",
    what: "Growth in core lending income: interest earned minus interest paid.", how: "NII this quarter ÷ same quarter last year − 1.", source: filing },
  { id: "cost-to-income", label: "Cost-to-income ratio", short: "Cost-to-income", fmt: P, up: false, get: q(kind, "cost_to_income"), hist: "cost_to_income",
    what: "Running costs as a share of income. Lower means a more efficient lender.", how: kind === "bank" ? "Operating expenses ÷ (net interest income + other income)." : "Operating expenses ÷ (net interest income + fees and other income).", source: filing },
];

export const BANK_METRICS: Metric[] = [
  ...common("bank"),
  { id: "gnpa", label: "Gross NPA ratio", short: "Gross NPA", fmt: P2, up: false, get: q("bank", "gnpa_pct"), hist: "gnpa_pct",
    what: "Bad loans (non-performing assets) as a share of all loans. Lower is better.", how: "Gross NPAs ÷ gross advances, as reported.", source: filing },
  { id: "nnpa", label: "Net NPA ratio", short: "Net NPA", fmt: P2, up: false, get: q("bank", "nnpa_pct"), hist: "nnpa_pct",
    what: "Bad loans left after money set aside for them, as a share of loans.", how: "Net NPAs ÷ net advances, as reported.", source: filing },
  { id: "pcr", label: "Provision coverage", short: "Provision coverage", fmt: P, up: true, get: q("bank", "pcr"), hist: "pcr",
    what: "How much of the bad loans the bank has already provided for. Higher is safer.", how: "(Gross NPA − net NPA) ÷ gross NPA. Excludes technical write-offs, so can be below the bank's own figure.", source: filing },
  { id: "roa", label: "Return on assets", short: "RoA", fmt: P2, up: true, get: q("bank", "roa"), hist: "roa",
    what: "Annualised profit as a share of everything the bank owns. Around 1% is decent for a bank.", how: "As reported, normalised to an annual rate.", source: filing },
  { id: "cet1", label: "CET1 capital ratio", short: "CET1", fmt: P2, up: true, get: q("bank", "cet1"), hist: "cet1",
    what: "The strongest capital as a share of risk-weighted assets. The regulatory minimum with buffers is 8%.", how: "As reported in the results.", source: filing },
  { id: "loan-growth", label: "Loan growth", short: "Loan growth", fmt: v => signed(v, 1, "%"), up: true, get: q("bank", "advances_yoy"), hist: "advances_yoy",
    what: "Growth in the bank's loans over a year.", how: "Advances ÷ a year earlier − 1 (balance sheet is filed each September and March).", source: filing },
  { id: "deposit-growth", label: "Deposit growth", short: "Deposit growth", fmt: v => signed(v, 1, "%"), up: true, get: q("bank", "deposits_yoy"), hist: "deposits_yoy",
    what: "Growth in the bank's deposits over a year.", how: "Deposits ÷ a year earlier − 1 (half-yearly).", source: filing },
  { id: "cd-ratio", label: "Credit-to-deposit ratio", short: "CD ratio", fmt: P, up: false, get: q("bank", "cd_ratio"), hist: "cd_ratio",
    what: "Loans ÷ deposits. Very high ratios mean the bank relies on other borrowing.", how: "Advances ÷ deposits (half-yearly).", source: filing },
  { id: "casa", label: "CASA ratio", short: "CASA", fmt: P, up: true, get: s => pres(s, "casa_pct"),
    what: "Share of deposits in current and savings accounts, the cheapest funding.", how: "As stated in the latest investor presentation.", source: deck },
  { id: "pb", label: "Price-to-book", short: "P/B", fmt: v => `${n(v, 2)}×`, up: true, get: s => val(s, "pb"),
    what: "Market value ÷ net worth.", how: "Closing price × shares ÷ latest net worth.", source: "NSE prices and filings." },
  { id: "pe", label: "Price-to-earnings", short: "P/E", fmt: v => `${n(v, 1)}×`, up: true, get: s => val(s, "pe"),
    what: "Market value ÷ last four quarters' profit.", how: "Closing price × shares ÷ trailing profit.", source: "NSE prices and filings." },
];

export const NBFC_METRICS: Metric[] = [
  ...common("nbfc"),
  { id: "loan-growth", label: "Loan book growth", short: "Loan growth", fmt: v => signed(v, 1, "%"), up: true, get: q("nbfc", "loans_yoy"), hist: "loans_yoy",
    what: "Growth in loans on the balance sheet over a year.", how: "Loans ÷ a year earlier − 1 (half-yearly balance sheet).", source: filing },
  { id: "credit-cost", label: "Credit cost", short: "Credit cost", fmt: P2, up: false, get: q("nbfc", "credit_cost_ann"), hist: "credit_cost_ann",
    what: "Money set aside for bad loans as a share of loans, annualised. NBFC filings carry no NPA ratio, so this stands in for asset quality.", how: "Impairment on financial instruments × 4 ÷ loans.", source: filing },
  { id: "roa", label: "Return on assets", short: "RoA", fmt: P2, up: true, get: q("nbfc", "roa_ann"), hist: "roa_ann",
    what: "Annualised profit as a share of total assets.", how: "Quarterly profit × 4 ÷ assets.", source: filing },
  { id: "roe", label: "Return on equity", short: "RoE", fmt: P, up: true, get: q("nbfc", "roe_ann"), hist: "roe_ann",
    what: "Annualised profit as a share of shareholders' capital.", how: "Quarterly profit × 4 ÷ net worth.", source: filing },
  { id: "leverage", label: "Leverage", short: "Leverage", fmt: v => `${n(v, 1)}×`, up: false, get: q("nbfc", "leverage"), hist: "leverage",
    what: "Borrowings ÷ own capital. Higher leverage lifts returns but adds risk.", how: "Total borrowings ÷ net worth.", source: filing },
  { id: "gnpa", label: "Gross stage 3 / GNPA", short: "Gross NPA", fmt: P2, up: false, get: s => pres(s, "gnpa_pct"),
    what: "Bad loans as a share of loans, as the company reports it.", how: "From the latest investor presentation.", source: deck },
  { id: "aum", label: "Assets under management", short: "AUM", fmt: v => cr(v), up: true, get: s => pres(s, "aum_cr"),
    what: "All loans the company manages, including those sold on.", how: "From the latest investor presentation.", source: deck },
  { id: "pb", label: "Price-to-book", short: "P/B", fmt: v => `${n(v, 2)}×`, up: true, get: s => val(s, "pb"),
    what: "Market value ÷ net worth.", how: "Closing price × shares ÷ latest net worth.", source: "NSE prices and filings." },
  { id: "pe", label: "Price-to-earnings", short: "P/E", fmt: v => `${n(v, 1)}×`, up: true, get: s => val(s, "pe"),
    what: "Market value ÷ last four quarters' profit.", how: "Closing price × shares ÷ trailing profit.", source: "NSE prices and filings." },
];

export const lenders = (kind: Kind): { symbol: string; name: string; short: string; group: string; note?: string }[] =>
  kind === "bank" ? D.banks.banks : D.nbfcs.cos;
export const metrics = (kind: Kind) => (kind === "bank" ? BANK_METRICS : NBFC_METRICS);
export const qrows = (kind: Kind, sym: string): any[] => (kind === "bank" ? D.banks.q : D.nbfcs.q)[sym] || [];
export const groupLabel: Record<string, string> = { Private: "Private bank", PSU: "Public sector bank", SFB: "Small finance bank", NBFC: "NBFC", HFC: "Housing finance", Govt: "Government NBFC" };

/** Rank of a lender on a metric (1 = best). */
export function rank(kind: Kind, m: Metric, sym: string) {
  const vals = lenders(kind).map(l => ({ s: l.symbol, v: m.get(l.symbol).v })).filter(x => isNum(x.v)) as { s: string; v: number }[];
  vals.sort((a, b) => (m.up ? b.v - a.v : a.v - b.v));
  const i = vals.findIndex(x => x.s === sym);
  return i < 0 ? null : { pos: i + 1, of: vals.length };
}

/** Median of a quarterly field across a group's lenders, per quarter end. */
export function groupMedian(kind: Kind, field: string, group?: string): Pt[] {
  const by: Record<string, number[]> = {};
  for (const l of lenders(kind)) {
    if (group && l.group !== group) continue;
    for (const r of qrows(kind, l.symbol)) if (isNum(r[field])) (by[r.period_end] ||= []).push(r[field]);
  }
  return Object.keys(by).sort().filter(k => by[k].length >= 3).map(k => [k, median(by[k])]);
}
