import { useState } from "react";
import { Bars, Dumbbell, Stack } from "../charts/Bars";
import { Line } from "../charts/Line";
import { Chips, Panel } from "../components/Panel";
import { cr, D, isNum, lastVal, median, month, n, pct, signed, slug, type Pt, type Series } from "../data";
import type { Stat, Topic } from "./types";

const P = (v: number) => `${n(v, v % 1 && Math.abs(v) < 20 ? 1 : 0)}%`;
const P1 = (v: number | null | undefined) => pct(v, 1);
const POP = ["Rural", "Semi-urban", "Urban", "Metropolitan"];
const ser = (o: Record<string, Pt[]>, names: string[]): Series[] => names.filter(k => o[k]).map(k => ({ name: k, data: o[k] }));
const lv = (s?: Pt[]) => (s ? lastVal(s)?.[1] ?? null : null);
const firstV = (s: Pt[]) => s.find(p => isNum(p[1]));
const since = (s: Pt[], goodUp: boolean) => {
  const a = lastVal(s), b = firstV(s);
  if (!a || !b) return null;
  const d = (a[1] as number) - (b[1] as number);
  return { text: `${signed(d, 1)} pp since ${month(b[0]).slice(-4)}`, tone: (Math.abs(d) < 0.05 ? "flat" : (d > 0) === goodUp ? "up" : "down") as "up" | "down" | "flat" };
};
const src = {
  spatial: "RBI, Quarterly Statistics on Deposits and Credit of SCBs by population group and state (DBIE, data.rbi.org.in).",
  bsr1: "RBI, Basic Statistical Returns BSR-1 (credit), annual, via DBIE and yearly BSR volumes.",
  bsr2: "RBI, Basic Statistical Returns BSR-2 (deposits), annual, via DBIE.",
};
const yr = (iso: string) => `Mar ${iso.slice(0, 4)}`;

/* ===================== REGIONS ===================== */
const S = () => D.spatial;
const regions: Stat[] = [
  {
    id: "metro-share", title: "How much credit goes to the big cities?", card: "Metro share of credit",
    value: () => P1(lv(S().credit_share.Metropolitan)), asOf: () => month(S().last),
    delta: () => since(S().credit_share.Metropolitan, false), spark: () => S().credit_share.Metropolitan,
    lede: () => { const f = S().shares.credit_first, l = S().shares.credit_last; return `Metro branches hold ${P1(l.Metropolitan)} of bank credit, down from ${P1(f.Metropolitan)}; rural and semi-urban areas together now get ${P1(l.Rural + l["Semi-urban"])}.`; },
    what: "Bank credit split by where the branch is: rural, semi-urban, urban or metropolitan, using the RBI's population-based classification.",
    how: "Credit booked at branches in each population group ÷ all credit (scheduled commercial banks excluding regional rural banks).",
    source: src.spatial,
    Body: () => (
      <>
        <Panel title="Share of credit by area"><Line series={ser(S().credit_share, POP)} fmt={P} label="Credit share by area" /></Panel>
        <Panel title="Credit and deposit shares, then and now">
          <Stack keys={POP} label="Shares" rows={S().shares.rows.map((r: any) => ({ label: r.label, values: r.values }))} />
        </Panel>
      </>
    ),
  },
  {
    id: "area-growth", title: "Where is lending growing fastest?", card: "Credit growth by area",
    value: () => { const g = S().growth["Population group"].credit_yoy; const top = POP.map(k => [k, lv(g[k])] as const).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]; return P1(top[1]); },
    asOf: () => month(S().last),
    delta: () => { const g = S().growth["Population group"].credit_yoy; const top = POP.map(k => [k, lv(g[k])] as const).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]; return { text: `${top[0]}, the fastest`, tone: "flat" }; },
    spark: () => S().growth.All.credit_yoy["All banks"],
    lede: () => { const g = S().growth["Population group"].credit_yoy; return `Credit grew ${POP.map(k => `${P1(lv(g[k]))} in ${k.toLowerCase()} areas`).join(", ")} over the year to ${month(S().last)}.`; },
    what: "Year-on-year credit growth at branches in each kind of area, and for each type of bank.",
    how: "Credit this quarter ÷ the same quarter last year − 1.",
    source: src.spatial,
    Body: () => (
      <>
        <Panel title="Credit growth by area"><Line series={ser(S().growth["Population group"].credit_yoy, POP)} fmt={P} label="Growth by area" /></Panel>
        <Panel title="Credit growth by type of bank"><Line series={ser(S().growth["Bank group"].credit_yoy, ["PSU banks", "Private banks", "Small finance banks", "Foreign banks"])} fmt={P} zero label="Growth by bank group" /></Panel>
        <Panel title="Deposit growth by area"><Line series={ser(S().growth["Population group"].deposits_yoy, POP)} fmt={P} label="Deposit growth by area" /></Panel>
      </>
    ),
  },
  {
    id: "cd-by-area", title: "Where are deposits lent back out?", card: "Credit-to-deposit by area",
    value: () => P1(lv(S().cd.Rural)), unit: "rural", asOf: () => month(S().last),
    delta: () => since(S().cd.Rural, true), spark: () => S().cd.Rural,
    lede: () => `Rural branches lend ₹${n(lv(S().cd.Rural) ?? NaN, 0)} for every ₹100 they collect in deposits; metro branches ₹${n(lv(S().cd.Metropolitan) ?? NaN, 0)}.`,
    what: "Loans ÷ deposits for branches in each kind of area. A low ratio means deposits from that area are being lent elsewhere.",
    how: "Credit at branches in the area ÷ deposits at the same branches.",
    source: src.spatial,
    Body: () => <Panel title="Credit-to-deposit ratio by area"><Line series={ser(S().cd, POP)} fmt={P} label="CD by area" /></Panel>,
  },
  {
    id: "states", title: "Credit by state", card: "States",
    value: () => { const s = [...S().states].sort((a: any, b: any) => b.credit_yoy - a.credit_yoy)[0]; return P1(s.credit_yoy); }, asOf: () => month(S().last),
    delta: () => { const s = [...S().states].sort((a: any, b: any) => b.credit_yoy - a.credit_yoy)[0]; return { text: `${s.state}, the fastest`, tone: "flat" }; },
    lede: () => { const s = [...S().states].sort((a: any, b: any) => b.credit_share - a.credit_share).slice(0, 3); return `${s.map((x: any) => x.state).join(", ")} together hold ${P1(s.reduce((t: number, x: any) => t + x.credit_share, 0))} of all bank credit.`; },
    what: "Bank credit and deposits in each state and union territory: size, growth and how much of local deposits is lent locally.",
    how: "Credit and deposits at branches in each state; growth vs the same quarter last year.",
    source: src.spatial,
    Body: () => {
      const [v, set] = useState<"credit_yoy" | "cd" | "credit_share" | "rural_share">("credit_yoy");
      const opt = [
        { id: "credit_yoy" as const, label: "Credit growth" }, { id: "cd" as const, label: "Credit ÷ deposits" },
        { id: "credit_share" as const, label: "Share of India" }, { id: "rural_share" as const, label: "Rural share" },
      ];
      return (
        <Panel title="States and union territories">
          <Chips options={opt} value={v} onChange={set} label="Measure" />
          <Bars rows={S().states.map((s: any) => ({ key: s.state, label: s.state, value: s[v], sub: cr(s.credit_cr) }))} fmt={P1} label="States" limit={15}
            reference={v === "credit_yoy" ? { value: lv(S().growth.All.credit_yoy["All banks"]) ?? 0, label: "India" } : undefined} />
        </Panel>
      );
    },
  },
  {
    id: "since-2015", title: "Ten years of credit and deposits by area", card: "Long-run shares",
    value: () => { const r = D.bsr1_hist.pop_rows; return P1(r[r.length - 1].values.Metropolitan); }, unit: "metro share", asOf: () => D.bsr1_hist.pop_rows.at(-1).label.replace("-", " 20"),
    delta: () => { const r = D.bsr1_hist.pop_rows; const d = r[r.length - 1].values.Metropolitan - r[0].values.Metropolitan; return { text: `${signed(d, 1)} pp since 2015`, tone: "flat" }; },
    lede: () => { const r = D.bsr1_hist.pop_rows; return `Metro branches' share of credit fell from ${P1(r[0].values.Metropolitan)} in March 2015 to ${P1(r[r.length - 1].values.Metropolitan)}.`; },
    what: "The annual BSR survey goes back to 2015, giving a longer view of how credit and deposits have spread out of the big cities.",
    how: "Share of credit (BSR-1) and deposits (BSR-2) by population group, every March, excluding regional rural banks.",
    source: `${src.bsr1} ${src.bsr2}`,
    Body: () => (
      <>
        <Panel title="Credit by area, every March"><Stack keys={POP} label="Credit by area" rows={D.bsr1_hist.pop_rows} /></Panel>
        <Panel title="Deposits by area, every March"><Stack keys={POP} label="Deposits by area" rows={D.bsr2.pop_rows} /></Panel>
      </>
    ),
  },
];

/* ===================== STRUCTURE ===================== */
const B = () => D.bsr1;
const dim = (k: string) => B().dims[k] as any[];
const structure: Stat[] = [
  {
    id: "bank-groups", title: "PSU vs private banks' share of credit", card: "Private banks' share",
    value: () => P1(lv(D.bsr1_hist.bank["Private banks"])), asOf: () => yr(lastVal(D.bsr1_hist.bank["Private banks"])![0]),
    delta: () => since(D.bsr1_hist.bank["Private banks"], true), spark: () => D.bsr1_hist.bank["Private banks"],
    lede: () => `Private banks' share of credit rose from ${P1(firstV(D.bsr1_hist.bank["Private banks"])![1])} to ${P1(lv(D.bsr1_hist.bank["Private banks"]))} since 2015, while PSU banks fell to ${P1(lv(D.bsr1_hist.bank["PSU banks"]))}.`,
    what: "How the market for bank loans is split between public sector, private, foreign, small finance and regional rural banks.",
    how: "Each bank group's credit ÷ all credit, every March.",
    source: src.bsr1,
    Body: () => <Panel title="Share of credit by bank group"><Line series={ser(D.bsr1_hist.bank, ["PSU banks", "Private banks", "Regional rural banks", "Foreign banks", "Small finance banks"])} fmt={P} label="Bank group share" /></Panel>,
  },
  {
    id: "interest-rates", title: "What interest rate are loans charged?", card: "Loans below 9%",
    value: () => P1(lv(D.bsr1_hist.below9)), unit: "of credit", asOf: () => yr(B().as_of),
    delta: () => { const s = D.bsr1_hist.below9; const a = s[s.length - 1][1], b = s[s.length - 2]?.[1]; return isNum(b) ? { text: `${signed(a - b, 1)} pp in a year`, tone: "flat" } : null; },
    spark: () => D.bsr1_hist.below9,
    lede: () => `${P1(lv(D.bsr1_hist.below9))} of bank credit was charged less than 9% in March ${B().as_of.slice(0, 4)}.`,
    what: "Bank credit grouped by the interest rate charged, from the RBI's annual survey of every loan account.",
    how: "Credit outstanding in each interest-rate band ÷ all credit.",
    source: src.bsr1,
    Body: () => (
      <>
        <Panel title={`Credit by interest rate, March ${B().as_of.slice(0, 4)}`}><Bars sort={false} rows={dim("Interest rate").map(r => ({ key: r.label, label: r.label, value: r.share }))} fmt={P1} label="By rate" /></Panel>
        <Panel title="Share of credit below 9%"><Line series={[{ name: "Below 9%", data: D.bsr1_hist.below9 }]} fmt={P} label="Below 9%" height={220} /></Panel>
      </>
    ),
  },
  {
    id: "loan-size", title: "Big loans vs small loans", card: "Loans above ₹100 cr",
    value: () => P1(dim("Credit limit size").at(-1).share), unit: "of credit", asOf: () => yr(B().as_of),
    delta: () => ({ text: `${P1(dim("Credit limit size").at(-1).acc_share)} of accounts`, tone: "flat" }),
    lede: () => { const r = dim("Credit limit size"); const small = r.slice(0, 2); return `Loans up to ₹2 lakh are ${P1(small.reduce((s, x) => s + x.acc_share, 0))} of accounts but ${P1(small.reduce((s, x) => s + x.share, 0))} of the money; loans above ₹100 crore are ${P1(r.at(-1).share)} of the money.`; },
    what: "Bank credit grouped by the size of each loan's sanctioned limit, comparing the share of money with the share of accounts.",
    how: "Amount and number of accounts in each size band ÷ totals.",
    source: src.bsr1,
    Body: () => (
      <Panel title="Share of money vs share of accounts">
        <Dumbbell rows={dim("Credit limit size").map(r => ({ key: r.label, label: r.label, a: r.share, b: r.acc_share }))} fmt={P1} names={["Share of money", "Share of accounts"]} label="Loan size" />
      </Panel>
    ),
  },
  {
    id: "borrowers", title: "Who borrows from banks?", card: "Household share",
    value: () => P1(dim("Organisation").find(r => r.label === "Household Sector")?.share), unit: "households", asOf: () => yr(B().as_of),
    delta: () => { const f = dim("Organisation").find(r => r.label === "Female"), m = dim("Organisation").find(r => r.label === "Male"); return f && m ? { text: `Women ${P1(f.share)} · men ${P1(m.share)}`, tone: "flat" } : null; },
    lede: () => { const o = dim("Organisation"); const h = o.find(r => r.label === "Household Sector"), c = o.find(r => r.label === "Private Corporate Sector"); return `Households hold ${P1(h?.share)} of bank credit and private companies ${P1(c?.share)}.`; },
    what: "Bank credit by type of borrower: households (individuals and small businesses), private companies, the public sector and others.",
    how: "Credit to each borrower type ÷ all credit.",
    source: src.bsr1,
    Body: () => {
      const rename: Record<string, string> = { "Micro Finance-Institutions": "Microfinance institutions", "Non-Profit Institutions Serving Households": "Non-profit institutions (NPISH)" };
      const top = dim("Organisation").filter(r => r.level === 1);
      const sub = dim("Organisation").filter(r => r.level === 2);
      return (
        <>
          <Panel title="By main type of borrower"><Bars rows={top.map(r => ({ key: r.label, label: rename[r.label] || r.label, value: r.share }))} fmt={P1} label="Borrowers" /></Panel>
          <Panel title="In more detail"><Bars rows={sub.map(r => ({ key: r.label, label: r.label, value: r.share }))} fmt={P1} label="Borrowers detail" color="var(--topic-2)" limit={10} /></Panel>
        </>
      );
    },
  },
  {
    id: "account-types", title: "Term loans, overdrafts and cash credit", card: "Long-term loans",
    value: () => P1(dim("Type of account").find(r => r.label === "Long Term Loans")?.share), unit: "of credit", asOf: () => yr(B().as_of),
    lede: () => { const t = dim("Type of account"); const l = t.find(r => r.label === "Long Term Loans"), c = t.find(r => r.label === "Cash Credit"); return `Long-term loans are ${P1(l?.share)} of credit; working-capital cash credit ${P1(c?.share)}.`; },
    what: "How bank credit is extended: long and medium-term loans, demand loans, cash credit and overdrafts for working capital, and trade bills.",
    how: "Credit in each account type ÷ all credit.",
    source: src.bsr1,
    Body: () => <Panel title="Credit by type of account"><Bars rows={dim("Type of account").filter(r => r.share >= 0.05).map(r => ({ key: r.label, label: r.label, value: r.share }))} fmt={P1} label="Account types" /></Panel>,
  },
  {
    id: "casa-area", title: "Cheap deposits by area (CASA)", card: "CASA share",
    value: () => P1(D.bsr2.latest.casa), asOf: () => yr(D.bsr2.latest.as_of),
    delta: () => since(D.bsr2.casa_pop["All India"], true), spark: () => D.bsr2.casa_pop["All India"],
    lede: () => `${P1(D.bsr2.latest.casa)} of deposits are in current and savings accounts. Rural branches have ${P1(lv(D.bsr2.casa_pop.Rural))}, metro branches ${P1(lv(D.bsr2.casa_pop.Metropolitan))}.`,
    what: "CASA (current and savings accounts) is the cheapest money a bank can get. A higher share means lower funding costs.",
    how: "Current + savings deposits ÷ all deposits, every March.",
    source: src.bsr2,
    Body: () => (
      <>
        <Panel title="CASA share by area"><Line series={ser(D.bsr2.casa_pop, ["All India", ...POP])} fmt={P} label="CASA by area" /></Panel>
        <Panel title="CASA share by bank group"><Line series={ser(D.bsr2.casa_bank, ["PSU banks", "Private banks", "Foreign banks", "Regional rural banks", "Small finance banks"])} fmt={P} label="CASA by bank group" /></Panel>
      </>
    ),
  },
];

/* ===================== VALUATIONS ===================== */
const V = () => D.val.rows as any[];
const GROUPS = [{ id: "all", label: "All" }, { id: "Private", label: "Private" }, { id: "PSU", label: "PSU" }, { id: "SFB", label: "Small finance" }, { id: "NBFC", label: "NBFC" }, { id: "HFC", label: "HFC" }, { id: "Govt", label: "Govt NBFC" }];
const lenderHref = (r: any) => `#${r.sector === "Bank" ? "bank" : "nbfc"}.${slug(r.symbol)}`;
function ValBars({ k, fmt, note }: { k: string; fmt: (v: number) => string; note?: string }) {
  const [g, set] = useState("all");
  const rows = V().filter(r => isNum(r[k]) && (g === "all" || r.group === g));
  const med = median(rows.map(r => r[k]));
  return (
    <Panel title="Every listed lender" note={note}>
      <Chips options={GROUPS} value={g} onChange={set} label="Group" />
      <Bars rows={rows.map(r => ({ key: r.symbol, label: r.short, value: r[k], sub: r.group, href: lenderHref(r) }))} fmt={fmt} label="Valuation"
        reference={med != null ? { value: med, label: `Median ${fmt(med)}` } : undefined} limit={20} />
    </Panel>
  );
}
const bankMed = (k: string, sector: string) => median(V().filter(r => r.sector === sector).map(r => r[k]));
const valuations: Stat[] = [
  {
    id: "price-to-book", title: "Price-to-book: what the market pays for each rupee of capital", card: "Median P/B, banks",
    value: () => `${n(bankMed("pb", "Bank") ?? NaN, 2)}×`, asOf: () => month(D.val.date),
    delta: () => ({ text: `NBFCs ${n(bankMed("pb", "NBFC") ?? NaN, 2)}×`, tone: "flat" }),
    lede: () => { const t = [...V()].filter(r => isNum(r.pb)).sort((a, b) => b.pb - a.pb); return `${t[0].short} trades at ${n(t[0].pb, 1)}× book, the highest; ${t.at(-1).short} at ${n(t.at(-1).pb, 2)}×, the lowest.`; },
    what: "Market value ÷ the lender's own capital (net worth). Above 1 means investors expect it to earn more than its cost of capital.",
    how: "Share price × shares outstanding ÷ latest reported net worth.",
    source: "NSE daily closing prices (bhavcopy); shares and net worth from NSE results filings.",
    Body: () => <ValBars k="pb" fmt={v => `${n(v, 2)}×`} />,
  },
  {
    id: "price-to-earnings", title: "Price-to-earnings", card: "Median P/E, banks",
    value: () => `${n(bankMed("pe", "Bank") ?? NaN, 1)}×`, asOf: () => month(D.val.date),
    delta: () => ({ text: `NBFCs ${n(bankMed("pe", "NBFC") ?? NaN, 1)}×`, tone: "flat" }),
    lede: () => `The median bank trades at ${n(bankMed("pe", "Bank") ?? NaN, 1)}× its last four quarters' profit; the median NBFC at ${n(bankMed("pe", "NBFC") ?? NaN, 1)}×.`,
    what: "Market value ÷ a year's profit: how many years of current earnings investors are paying for.",
    how: "Market cap ÷ sum of the last four quarters' net profit. Lenders with a loss are left out.",
    source: "NSE daily closing prices; profit from NSE results filings.",
    Body: () => <ValBars k="pe" fmt={v => `${n(v, 1)}×`} />,
  },
  {
    id: "market-cap", title: "The most valuable lenders", card: "Largest market cap",
    value: () => { const t = [...V()].sort((a, b) => b.mcap - a.mcap)[0]; return cr(t.mcap); }, asOf: () => month(D.val.date),
    delta: () => { const t = [...V()].sort((a, b) => b.mcap - a.mcap)[0]; return { text: t.short, tone: "flat" }; },
    lede: () => { const s = V().reduce((t, r) => t + (r.mcap || 0), 0); return `The ${V().length} lenders tracked here are worth ${cr(s)} together.`; },
    what: "Market capitalisation: what all of a company's shares are worth at today's price.",
    how: "Closing share price × shares outstanding (adjusted for splits and bonuses since the last filing).",
    source: "NSE daily closing prices; shares from NSE results filings.",
    Body: () => <ValBars k="mcap" fmt={v => cr(v, 1)} />,
  },
  {
    id: "one-year", title: "Which lenders' shares rose or fell most this year?", card: "1-year change, median",
    value: () => signed(median(V().map(r => r.chg)) ?? NaN, 1, "%"), asOf: () => month(D.val.date),
    lede: () => { const t = [...V()].filter(r => isNum(r.chg)).sort((a, b) => b.chg - a.chg); return `${t[0].short} rose most (${signed(t[0].chg, 0, "%")}); ${t.at(-1).short} fell most (${signed(t.at(-1).chg, 0, "%")}).`; },
    what: "Change in market value over the last 12 months.",
    how: "Market cap now ÷ market cap a year ago − 1.",
    source: "NSE daily closing prices.",
    Body: () => <ValBars k="chg" fmt={v => signed(v, 1, "%")} />,
  },
];

export const STRUCTURE: Topic[] = [
  { id: "regions", title: "Regions", group: "Economy", blurb: "Rural, urban and metro, state by state", source: "RBI quarterly spatial statistics",
    intro: "Where bank branches lend and take deposits: rural, semi-urban, urban and metro areas, and each state.", stats: regions },
  { id: "structure", title: "Loan structure", group: "Economy", blurb: "Who borrows, at what rate, in what size", source: "RBI BSR annual survey",
    intro: "Each March the RBI surveys every bank loan account. These pages show the mix of borrowers, rates, loan sizes and bank types, and how it has shifted since 2015.", stats: structure },
  { id: "valuations", title: "Valuations", group: "Lenders", blurb: "Market value, price-to-book and price-to-earnings", source: "NSE prices, daily",
    intro: "What the stock market says the 76 listed lenders are worth, compared with their capital and profits.", stats: valuations },
];
