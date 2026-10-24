import { Bars, Dumbbell, Stack } from "../charts/Bars";
import { Line } from "../charts/Line";
import { Panel, Table } from "../components/Panel";
import { count, cr, D, day, isNum, last, lastVal, month, n, pct, signed, yearAgo, type Pt, type Series } from "../data";
import type { Stat, Topic } from "./types";

const P = (v: number) => `${n(v, v % 1 && Math.abs(v) < 20 ? 1 : 0)}%`;
const P1 = (v: number | null | undefined) => pct(v, 1);
const P2 = (v: number | null | undefined) => pct(v, 2);
const bps = (v: number) => `${signed(v, 0)} bps`;
const ser = (o: Record<string, Pt[]>, names?: string[]): Series[] => (names || Object.keys(o)).filter(k => o[k]).map(k => ({ name: k, data: o[k] }));
const lv = (s: Pt[]) => lastVal(s)?.[1] ?? null;
const ppDelta = (s: Pt[], goodUp = true, label = "on a year ago") => {
  const a = lastVal(s), b = yearAgo(s);
  if (!a || !b || !isNum(a[1]) || !isNum(b[1])) return null;
  const d = a[1] - b[1];
  return { text: `${signed(d, 1)} pp ${label}`, tone: (Math.abs(d) < 0.05 ? "flat" : (d > 0) === goodUp ? "up" : "down") as "up" | "down" | "flat" };
};
const src = {
  sibc: "RBI, Sectoral Deployment of Bank Credit (monthly Excel, rbi.org.in → Statistics → Data Releases).",
  sop: "RBI, Scheduled Banks' Statement of Position (fortnightly, month-end editions).",
  rates: "RBI, Lending and Deposit Rates of Scheduled Commercial Banks (monthly Excel).",
  cards: "RBI, Bank-wise ATM/POS/Card Statistics (monthly Excel).",
  cpi: "MoSPI, Consumer Price Index press releases (base 2024 from Jan 2026).",
};

/* ===================== CREDIT ===================== */
const C = () => D.credit;
const credit: Stat[] = [
  {
    id: "growth", title: "How fast is bank credit growing?", card: "Bank credit growth",
    value: () => P1(C().total.yoy), unit: "year on year", asOf: () => month(C().month),
    delta: () => { const d = C().total.yoy - C().total.yoy_prev; return { text: `${signed(d, 1)} pp on a year ago`, tone: d >= 0 ? "up" : "down" }; },
    spark: () => C().yoy_series["All bank credit"],
    lede: () => `Banks' loans were ${P1(C().total.yoy)} higher in ${month(C().month)} than a year earlier, against ${P1(C().total.yoy_prev)} growth a year before. Outstanding credit is ${cr(C().total.outstanding_cr)}.`,
    what: "All the loans banks have given out, compared with the same month last year. Faster growth means more borrowing by companies and households.",
    how: "Outstanding bank credit this month ÷ outstanding credit in the same month last year − 1.",
    source: `${src.sop} Sector splits: ${src.sibc}`,
    Body: () => (
      <>
        <Panel title="Credit growth, year on year"><Line series={[{ name: "All bank credit", data: C().yoy_series["All bank credit"] }]} fmt={P} label="Bank credit growth" /></Panel>
        <Panel title="Growth by sector, now vs a year ago" note="Every major sector sped up.">
          <Dumbbell rows={C().main.map((m: any) => ({ key: m.code, label: m.name, a: m.yoy_now, b: m.yoy_year_ago }))} fmt={P1} names={[month(C().month), "A year earlier"]} label="Sector growth" />
        </Panel>
      </>
    ),
  },
  {
    id: "real-growth", title: "Credit growth after inflation", card: "Real credit growth",
    value: () => P1(lv(C().real.real)), unit: "after inflation", asOf: () => month(lastVal(C().real.real)?.[0]),
    delta: () => ppDelta(C().real.real),
    spark: () => C().real.real,
    lede: () => `Take out ${P1(lv(C().real.cpi))} consumer inflation and credit grew ${P1(lv(C().real.real))} in real terms in ${month(lastVal(C().real.real)?.[0])}.`,
    what: "Credit growth with rising prices taken out. It shows whether lending is really expanding or just keeping up with inflation.",
    how: "Nominal credit growth − CPI inflation for the same month.",
    source: `${src.sibc} ${src.cpi}`,
    Body: () => (
      <Panel title="Nominal growth, inflation and real growth" note="CPI moved to a 2024 base in January 2026, so the series mixes two baskets.">
        <Line series={[{ name: "Real growth", data: C().real.real }, { name: "Nominal growth", data: C().real.nominal }, { name: "CPI inflation", data: C().real.cpi, dash: true }]} fmt={P} zero label="Real credit growth" />
      </Panel>
    ),
  },
  {
    id: "sectors", title: "Which sectors are getting the new loans?", card: "Credit by sector",
    value: () => { const s = [...C().main].sort((a: any, b: any) => b.yoy_now - a.yoy_now)[0]; return P1(s.yoy_now); },
    unit: "", asOf: () => month(C().month),
    delta: () => { const s = [...C().main].sort((a: any, b: any) => b.yoy_now - a.yoy_now)[0]; return { text: `${s.name}, the fastest`, tone: "flat" }; },
    spark: () => C().yoy_series.Services,
    lede: () => { const s = [...C().main].sort((a: any, b: any) => b.incr_share_pct - b.share_pct - (a.incr_share_pct - a.share_pct))[0]; return `${s.name} hold ${P1(s.share_pct)} of all bank credit but took ${P1(s.incr_share_pct)} of the last year's new lending.`; },
    what: "Bank credit split into agriculture, industry, services and personal loans. Comparing each sector's share of all credit with its share of new credit shows where lending is shifting.",
    how: "Each sector's outstanding credit ÷ total; new lending = this year's outstanding − last year's.",
    source: src.sibc,
    Body: () => (
      <>
        <Panel title="Growth by sector over time"><Line series={ser(C().yoy_series, ["Agriculture", "Industry", "Services", "Personal loans"])} fmt={P} label="Sector growth" /></Panel>
        <Panel title="Share of new lending vs share of all credit" note="A sector whose dot sits right of its circle is gaining share.">
          <Dumbbell rows={C().main.map((m: any) => ({ key: m.code, label: m.name, a: m.incr_share_pct, b: m.share_pct }))} fmt={P1} names={["Share of new lending", "Share of all credit"]} label="Shares" />
        </Panel>
      </>
    ),
  },
  {
    id: "personal-loans", title: "Personal loans: homes, gold, cars and cards", card: "Personal loans",
    value: () => P1(C().main.find((m: any) => m.name === "Personal loans")?.yoy_now), unit: "growth", asOf: () => month(C().month),
    delta: () => { const g = C().subs.find((s: any) => /gold/i.test(s.sector)); return g ? { text: `Gold loans ${signed(g.yoy_now, 0)}%`, tone: "flat" } : null; },
    spark: () => C().yoy_series["Personal loans"],
    lede: () => { const h = C().subs.find((s: any) => /^Housing/.test(s.sector)); return `Home loans are ${cr(h.outstanding_cr)}, ${P1(h.share_pct)} of all bank credit, and grew ${P1(h.yoy_now)}.`; },
    what: "Loans to individuals: home loans, car and two-wheeler loans, gold loans, credit card balances, education and other personal loans.",
    how: "Each category's outstanding this month vs the same month last year.",
    source: src.sibc,
    Body: () => {
      const rows = C().subs.filter((s: any) => s.parent === "Personal loans");
      const short = (s: string) => s.replace(/ \(.*\)/, "").replace("Loans against gold jewellery", "Gold loans").replace("Advances against Fixed Deposits", "Loans against deposits");
      return (
        <>
          <Panel title="Growth by type of personal loan" note="One bank reclassified some farm loans as gold loans from May 2024, which inflates gold-loan growth.">
            <Bars rows={rows.map((s: any) => ({ key: s.code, label: short(s.sector), value: s.yoy_now, sub: cr(s.outstanding_cr) }))} fmt={P1} label="Personal loan growth" />
          </Panel>
          <Panel title="Size of each type">
            <Bars rows={rows.map((s: any) => ({ key: s.code, label: short(s.sector), value: s.outstanding_cr / 1e5 }))} fmt={v => `₹${n(v, 1)} lakh cr`} label="Outstanding" color="var(--topic-2)" />
          </Panel>
        </>
      );
    },
  },
  {
    id: "industry", title: "Lending to industry", card: "Industry credit",
    value: () => P1(C().main.find((m: any) => m.name === "Industry")?.yoy_now), unit: "growth", asOf: () => month(C().month),
    delta: () => { const m = C().main.find((x: any) => x.name === "Industry"); return { text: `${signed(m.yoy_now - m.yoy_year_ago, 1)} pp on a year ago`, tone: m.yoy_now >= m.yoy_year_ago ? "up" : "down" }; },
    spark: () => C().yoy_series.Industry,
    lede: () => { const s = C().subs.filter((x: any) => x.parent === "Industry"); const t = [...s].sort((a: any, b: any) => b.yoy_now - a.yoy_now)[0]; return `Among company sizes, ${t.sector.toLowerCase()} firms saw the fastest growth at ${P1(t.yoy_now)}.`; },
    what: "Loans to manufacturing, mining, infrastructure and other industry, split by company size and by industry.",
    how: "Outstanding credit to each industry this month vs the same month last year.",
    source: src.sibc,
    Body: () => (
      <>
        <Panel title="By size of company">
          <Bars rows={C().subs.filter((s: any) => s.parent === "Industry").map((s: any) => ({ key: s.code, label: s.sector, value: s.yoy_now, sub: cr(s.outstanding_cr) }))} fmt={P1} label="By size" />
        </Panel>
        <Panel title="By industry">
          <Bars rows={C().industry.map((s: any) => ({ key: s.code + s.sector, label: s.sector.replace(/ \(.*\)/, ""), value: s.yoy_now, sub: cr(s.outstanding_cr) }))} fmt={P1} label="By industry" />
        </Panel>
      </>
    ),
  },
  {
    id: "services", title: "Lending to services, including NBFCs", card: "Services credit",
    value: () => P1(C().main.find((m: any) => m.name === "Services")?.yoy_now), unit: "growth", asOf: () => month(C().month),
    delta: () => { const s = C().subs.find((x: any) => /NBFC/.test(x.sector)); return s ? { text: `NBFCs ${signed(s.yoy_now, 1)}%`, tone: "flat" } : null; },
    spark: () => C().yoy_series.Services,
    lede: () => { const s = C().subs.find((x: any) => /NBFC/.test(x.sector)); return `Banks lend ${cr(s.outstanding_cr)} to NBFCs, ${P1(s.share_pct)} of their credit, and that grew ${P1(s.yoy_now)}.`; },
    what: "Loans to trade, transport, real estate, software, tourism and to non-bank lenders (NBFCs), which borrow from banks and lend on.",
    how: "Outstanding credit to each service sector this month vs the same month last year.",
    source: src.sibc,
    Body: () => (
      <Panel title="Growth by service sector">
        <Bars rows={C().subs.filter((s: any) => s.parent === "Services").map((s: any) => ({ key: s.code, label: s.sector.replace(" (NBFCs)", ""), value: s.yoy_now, sub: cr(s.outstanding_cr) }))} fmt={P1} label="Services" />
      </Panel>
    ),
  },
];

/* ===================== DEPOSITS ===================== */
const F = () => D.funding;
const deposits: Stat[] = [
  {
    id: "growth", title: "Are deposits keeping up with loans?", card: "Deposit growth",
    value: () => P1(F().latest.deposit_yoy), unit: "year on year", asOf: () => month(F().month),
    delta: () => { const g = F().latest.credit_yoy - F().latest.deposit_yoy; return { text: `${n(Math.abs(g), 1)} pp ${g > 0 ? "behind" : "ahead of"} credit`, tone: g > 0 ? "down" : "up" }; },
    spark: () => F().deposit_yoy,
    lede: () => `Deposits grew ${P1(F().latest.deposit_yoy)} while credit grew ${P1(F().latest.credit_yoy)} in ${month(F().month)}. Banks hold ${cr(F().latest.deposits)} of deposits.`,
    what: "How fast the money people and firms keep in banks is growing. If loans grow faster than deposits for long, banks must find other funding or slow lending.",
    how: "Deposits this month ÷ the same month last year − 1.",
    source: src.sop,
    Body: () => (
      <Panel title="Deposit growth vs credit growth" note="RBI moved to month-end reporting in December 2025.">
        <Line series={[{ name: "Deposits", data: F().deposit_yoy }, { name: "Credit", data: F().credit_yoy }]} fmt={P} label="Deposit and credit growth" />
      </Panel>
    ),
  },
  {
    id: "cd-ratio", title: "How much of each deposit is lent out?", card: "Credit-to-deposit ratio",
    value: () => P1(F().latest.cd_ratio), asOf: () => month(F().month),
    delta: () => ppDelta(F().cd, false),
    spark: () => F().cd,
    lede: () => `Banks have lent ₹${n(F().latest.cd_ratio, 0)} for every ₹100 of deposits.`,
    what: "Loans divided by deposits. A higher ratio means banks are stretching their deposit base; above about 80 they usually lean on other borrowing.",
    how: "Outstanding bank credit ÷ outstanding deposits.",
    source: src.sop,
    Body: () => <Panel title="Credit-to-deposit ratio"><Line series={[{ name: "Credit ÷ deposits", data: F().cd }]} fmt={P} label="CD ratio" /></Panel>,
  },
  {
    id: "incremental-cd", title: "New loans vs new deposits", card: "Incremental CD ratio",
    value: () => P1(F().latest.incr_cd_ratio), asOf: () => month(F().month),
    spark: () => F().icd,
    lede: () => `Over the last year banks added ₹${n(F().latest.incr_cd_ratio, 0)} of loans for every ₹100 of new deposits.`,
    what: "Of each extra rupee deposited over the past year, how much was lent out. Above 100 means loans grew by more than deposits.",
    how: "(Credit now − credit a year ago) ÷ (deposits now − deposits a year ago).",
    source: src.sop,
    Body: () => <Panel title="Incremental credit-to-deposit ratio"><Line series={[{ name: "Incremental CD", data: F().icd }]} fmt={P} refs={[{ y: 100, label: "100: loans grew as much as deposits" }]} label="Incremental CD" /></Panel>,
  },
  {
    id: "bonds", title: "How much do banks hold in government bonds?", card: "Govt bonds ÷ deposits",
    value: () => P1(F().latest.gsec_to_dep), asOf: () => month(F().month),
    delta: () => ppDelta(F().gsec_to_dep, true),
    spark: () => F().gsec_to_dep,
    lede: () => `Government securities equal ${P1(F().latest.gsec_to_dep)} of deposits. Falling holdings free up money for loans.`,
    what: "Banks must keep some deposits in government bonds. Holdings well above the minimum are a buffer they can run down to fund loans.",
    how: "Investments in government securities ÷ deposits.",
    source: src.sop,
    Body: () => <Panel title="Government securities as a share of deposits"><Line series={[{ name: "G-secs ÷ deposits", data: F().gsec_to_dep }]} fmt={P} label="G-sec ratio" /></Panel>,
  },
  {
    id: "demand", title: "Share of deposits in current and savings accounts", card: "Demand deposits",
    value: () => P1(F().latest.demand_share), asOf: () => month(F().month),
    delta: () => ppDelta(F().demand_share, true),
    spark: () => F().demand_share,
    lede: () => `${P1(F().latest.demand_share)} of deposits sit in demand deposits that can be withdrawn any time.`,
    what: "Demand deposits (current accounts and the demand part of savings) are cheap money for banks. The rest are term deposits that pay more.",
    how: "Demand deposits ÷ total deposits.",
    source: src.sop,
    Body: () => <Panel title="Demand deposits as a share of all deposits"><Line series={[{ name: "Demand share", data: F().demand_share }]} fmt={P} label="Demand share" /></Panel>,
  },
];

/* ===================== RATES ===================== */
const R = () => D.rates;
const repoMarks = () => R().decisions.filter((d: any) => d.change_bps).map((d: any) => ({ date: d.effective_date, label: `Repo ${d.change_bps > 0 ? "+" : "−"}${Math.abs(d.change_bps)} bps to ${n(d.repo_rate, 2)}%` }));
const trans = (m: string, g = "All SCBs") => R().transmission.find((t: any) => t.measure === m && t.group === g);
const rates: Stat[] = [
  {
    id: "repo", title: "The RBI's repo rate", card: "Repo rate",
    value: () => P2(R().repo_now), asOf: () => day(last<any>(R().decisions)?.effective_date),
    delta: () => { const d = last<any>(R().decisions); return d ? { text: d.change_bps ? `${d.change_bps > 0 ? "Raised" : "Cut"} ${Math.abs(d.change_bps)} bps` : "Held", tone: d.change_bps > 0 ? "down" : d.change_bps < 0 ? "up" : "flat" } : null; },
    spark: () => R().repo,
    lede: () => { const d = last<any>(R().decisions); return `The repo rate is ${P2(R().repo_now)} after the ${day(d.effective_date)} decision${d.note ? ` (${d.note})` : ""}.`; },
    what: "The rate at which the RBI lends to banks overnight. It is the main lever for steering loan and deposit rates across the economy.",
    how: "Set by the RBI's Monetary Policy Committee, usually every two months.",
    source: "RBI monetary policy statements; history typed from official announcements.",
    Body: () => (
      <>
        <Panel title="Repo rate"><Line series={[{ name: "Repo rate", data: R().repo }]} fmt={P} step label="Repo rate" /></Panel>
        <Panel title="Recent decisions">
          <Table head={["Effective", "Change", "Repo rate", "Note"]} num={[1, 2]}
            rows={[...R().decisions].reverse().map((d: any) => [day(d.effective_date), d.change_bps ? bps(d.change_bps) : "Hold", P2(d.repo_rate), d.note || ""])} />
        </Panel>
      </>
    ),
  },
  {
    id: "lending", title: "What do borrowers pay?", card: "Lending rate, new loans",
    value: () => P2(R().latest_by_group["All SCBs"].walr_fresh), asOf: () => month(R().month),
    delta: () => ppDelta(R().scb_lines["Lending rate, new loans"], false),
    spark: () => R().scb_lines["Lending rate, new loans"],
    lede: () => `New loans cost ${P2(R().latest_by_group["All SCBs"].walr_fresh)} on average and existing loans ${P2(R().latest_by_group["All SCBs"].walr_outstanding)}.`,
    what: "The average interest rate banks charge, weighted by loan size: on loans made this month (new) and on all loans on their books (outstanding).",
    how: "RBI's weighted average lending rate (WALR) for all scheduled commercial banks.",
    source: src.rates,
    Body: () => (
      <Panel title="Lending rates and the repo rate">
        <Line series={[{ name: "New loans", data: R().scb_lines["Lending rate, new loans"] }, { name: "Outstanding loans", data: R().scb_lines["Lending rate, outstanding loans"] }, { name: "Repo", data: R().repo, dash: true }]} fmt={P} marks={repoMarks()} label="Lending rates" />
      </Panel>
    ),
  },
  {
    id: "deposit", title: "What do depositors earn?", card: "Deposit rate, new deposits",
    value: () => P2(R().latest_by_group["All SCBs"].td_fresh), asOf: () => month(R().month),
    delta: () => ppDelta(R().scb_lines["Term deposit rate, new deposits"], true),
    spark: () => R().scb_lines["Term deposit rate, new deposits"],
    lede: () => `New term deposits pay ${P2(R().latest_by_group["All SCBs"].td_fresh)}; the average on all term deposits is ${P2(R().latest_by_group["All SCBs"].td_outstanding)}.`,
    what: "The average interest rate on fixed deposits: on deposits taken this month and on all deposits banks hold.",
    how: "RBI's weighted average term deposit rate (WATDR).",
    source: src.rates,
    Body: () => (
      <Panel title="Term deposit rates and the repo rate">
        <Line series={[{ name: "New deposits", data: R().scb_lines["Term deposit rate, new deposits"] }, { name: "Outstanding deposits", data: R().scb_lines["Term deposit rate, outstanding"] }, { name: "Repo", data: R().repo, dash: true }]} fmt={P} marks={repoMarks()} label="Deposit rates" />
      </Panel>
    ),
  },
  {
    id: "pass-through", title: "Did the rate cuts reach customers?", card: "Rate pass-through",
    value: () => P(trans("walr_outstanding")?.pass_through_pct ?? NaN), unit: "of the repo cut", asOf: () => month(R().trans_meta.end),
    delta: () => ({ text: `Repo ${bps((R().trans_meta.repo_end - R().trans_meta.repo_start) * 100)}`, tone: "flat" }),
    spark: () => R().scb_lines["Lending rate, outstanding loans"],
    lede: () => { const m = R().trans_meta; return `Between ${month(m.start)} and ${month(m.end)} the repo fell ${n((m.repo_start - m.repo_end) * 100, 0)} bps. Rates on existing loans fell ${n(-trans("walr_outstanding").change_bps, 0)} bps and on new deposits ${n(-trans("td_fresh").change_bps, 0)} bps.`; },
    what: "How much of a change in the repo rate shows up in what banks charge and pay. 100% means the full cut was passed on.",
    how: "Change in each rate ÷ change in the repo rate over the same period.",
    source: src.rates,
    Body: () => {
      const groups = ["PSU banks", "Private banks", "All SCBs"];
      const measures = [...new Set<string>(R().transmission.map((t: any) => t.measure))];
      const repoCut = (R().trans_meta.repo_start - R().trans_meta.repo_end) * 100;
      const maxCut = Math.max(repoCut, ...R().transmission.map((t: any) => -t.change_bps));
      return (
        <Panel title="Change in each rate since the cuts began" note="All bars share one scale; the dashed line is the full repo cut. MCLR moved least: many PSU loans still use it.">
          {measures.map(ms => {
            const rows = R().transmission.filter((t: any) => t.measure === ms && groups.includes(t.group));
            return (
              <div className="subgroup" key={ms}>
                <h3>{rows[0].measure_name}</h3>
                <Bars sort={false} rows={rows.map((t: any) => ({ key: t.group, label: t.group, value: -t.change_bps, sub: `${n(t.pass_through_pct, 0)}% passed on` }))} fmt={v => `−${n(v, 0)} bps`} label={rows[0].measure_name}
                  reference={{ value: repoCut, label: `Repo −${n(repoCut, 0)}` }} max={maxCut} />
              </div>
            );
          })}
        </Panel>
      );
    },
  },
  {
    id: "benchmarks", title: "Which benchmark are loans linked to?", card: "Loans linked to repo",
    value: () => P1(lv(R().eblr["All SCBs"])), unit: "of floating loans", asOf: () => month(R().bench_month),
    delta: () => { const psu = lv(R().eblr["PSU banks"]), pvt = lv(R().eblr["Private banks"]); return { text: `PSU ${n(psu ?? NaN, 0)}% · Private ${n(pvt ?? NaN, 0)}%`, tone: "flat" }; },
    spark: () => R().eblr["All SCBs"],
    lede: () => { const m = R().bench_latest.find((b: any) => b.group === "PSU banks" && b.benchmark === "MCLR"); return `${P1(lv(R().eblr["All SCBs"]))} of floating-rate loans follow an external benchmark such as the repo rate. At PSU banks ${P1(m?.value)} still follow MCLR, which moves slowly.`; },
    what: "Floating-rate loans reset against a benchmark. Loans linked to the repo (external benchmark, EBLR) change as soon as the RBI moves; MCLR and base-rate loans lag.",
    how: "Share of each bank group's floating-rate loans by benchmark, from RBI's quarterly survey.",
    source: src.rates,
    Body: () => {
      const groups = ["PSU banks", "Private banks", "Foreign banks"];
      const keys = ["EBLR", "MCLR", "Base Rate", "Others"];
      return (
        <>
          <Panel title="Share of floating loans linked to an external benchmark"><Line series={ser(R().eblr, ["All SCBs", "PSU banks", "Private banks", "Foreign banks"])} fmt={P} label="EBLR share" /></Panel>
          <Panel title={`Benchmark mix, ${month(R().bench_month)}`}>
            <Stack keys={keys} label="Benchmark mix" rows={groups.map(g => ({ label: g, values: Object.fromEntries(R().bench_latest.filter((b: any) => b.group === g).map((b: any) => [b.benchmark, b.value])) }))} />
          </Panel>
        </>
      );
    },
  },
  {
    id: "spread", title: "The gap between loan and deposit rates", card: "Lending–deposit spread",
    value: () => `${n(lv(R().spread_out) ?? NaN, 2)}`, unit: "pp", asOf: () => month(R().month),
    delta: () => ppDelta(R().spread_out, true),
    spark: () => R().spread_out,
    lede: () => `Banks earn ${n(lv(R().spread_out) ?? NaN, 2)} percentage points more on outstanding loans than they pay on outstanding deposits, a rough guide to margins.`,
    what: "Lending rate minus deposit rate. A rough guide to how much banks make on lending before costs.",
    how: "Average lending rate − average term deposit rate, on outstanding and on new business.",
    source: src.rates,
    Body: () => <Panel title="Lending rate minus deposit rate"><Line series={[{ name: "Outstanding", data: R().spread_out }, { name: "New business", data: R().spread_fresh }]} fmt={v => `${n(v, 1)} pp`} label="Spread" /></Panel>,
  },
  {
    id: "real-rates", title: "Interest rates after inflation", card: "Real lending rate",
    value: () => P1(lv(R().real_walr)), asOf: () => month(lastVal(R().real_walr)?.[0]),
    delta: () => ppDelta(R().real_walr, false),
    spark: () => R().real_walr,
    lede: () => `After inflation, borrowers pay ${P1(lv(R().real_walr))} on existing loans and new depositors earn ${P1(lv(R().real_td))}.`,
    what: "Interest rates minus inflation. Positive real rates reward savers; high real loan rates make borrowing expensive.",
    how: "Outstanding lending rate − CPI inflation; new deposit rate − CPI inflation.",
    source: `${src.rates} ${src.cpi}`,
    Body: () => <Panel title="Real interest rates"><Line series={[{ name: "Real lending rate", data: R().real_walr }, { name: "Real deposit rate", data: R().real_td }]} fmt={P} zero label="Real rates" /></Panel>,
  },
  {
    id: "mclr", title: "Each bank's benchmark lending rate (MCLR)", card: "1-year MCLR",
    value: () => { const v = R().mclr_banks.map((b: any) => b.mclr).sort((a: number, b: number) => a - b); return P2(v[Math.floor(v.length / 2)]); }, unit: "median", asOf: () => month(R().mclr_month),
    delta: () => { const v = R().mclr_banks.map((b: any) => b.yoy_bps).sort((a: number, b: number) => a - b); return { text: `${bps(v[Math.floor(v.length / 2)])} in a year`, tone: "flat" }; },
    lede: () => { const s = [...R().mclr_banks].sort((a: any, b: any) => a.mclr - b.mclr); return `1-year MCLR runs from ${P2(s[0].mclr)} at ${s[0].bank} to ${P2(s[s.length - 1].mclr)} at ${s[s.length - 1].bank}.`; },
    what: "The Marginal Cost of funds based Lending Rate each bank sets every month. Older floating-rate loans reset against it.",
    how: "Each bank's published 1-year MCLR, collected by the RBI.",
    source: src.rates,
    Body: () => (
      <>
        <Panel title="1-year MCLR by bank"><Bars rows={R().mclr_banks.map((b: any) => ({ key: b.bank, label: b.bank, value: b.mclr, sub: b.group }))} fmt={P2} label="MCLR" /></Panel>
        <Panel title="Change over the last year"><Bars rows={R().mclr_banks.map((b: any) => ({ key: b.bank, label: b.bank, value: b.yoy_bps }))} fmt={bps} label="MCLR change" color="var(--topic-2)" sort /></Panel>
      </>
    ),
  },
  {
    id: "sector-rates", title: "Loan rates by sector", card: "Rates by sector",
    value: () => { const h = R().sector_fresh.find((s: any) => /hous/i.test(s.sector)); return h ? P2(h.rate) : "–"; }, unit: "home loans", asOf: () => month(R().sector_month),
    lede: () => { const s = [...R().sector_fresh].sort((a: any, b: any) => b.rate - a.rate); return `On new loans, ${s[0].sector.trim().toLowerCase()} costs most (${P2(s[0].rate)}) and ${s[s.length - 1].sector.trim().toLowerCase()} least (${P2(s[s.length - 1].rate)}).`; },
    what: "Average interest rate on new loans to each sector.",
    how: "RBI's weighted average lending rate on new loans, by sector.",
    source: src.rates,
    Body: () => (
      <>
        <Panel title="Rate on new loans"><Bars rows={R().sector_fresh.map((s: any) => ({ key: s.sector, label: s.sector.trim(), value: s.rate }))} fmt={P2} label="Sector rates" /></Panel>
        <Panel title="Change over 12 months"><Bars rows={R().sector_fresh.map((s: any) => ({ key: s.sector, label: s.sector.trim(), value: s.chg_bps }))} fmt={bps} label="Sector rate change" color="var(--topic-2)" /></Panel>
      </>
    ),
  },
];

/* ===================== PAYMENTS ===================== */
const K = () => D.cards;
const tot = (k: string): Pt[] => K().totals.map((t: any) => [t.month, t[k]]);
const growthDelta = (k: string) => { const t = K().totals; const a = t[t.length - 1][k], b = t[0][k]; return { text: `${signed((a / b - 1) * 100, 1)}% since ${month(K().first_month)}`, tone: (a >= b ? "up" : "down") as "up" | "down" }; };
const payments: Stat[] = [
  {
    id: "credit-cards", title: "How many credit cards are out there?", card: "Credit cards",
    value: () => count(last<any>(K().totals).credit_cards), asOf: () => month(K().month),
    delta: () => growthDelta("credit_cards"), spark: () => tot("credit_cards"),
    lede: () => { const t = [...K().issuers].sort((a: any, b: any) => b.card_share - a.card_share).slice(0, 4); return `${t.map((x: any) => x.bank).join(", ")} issue ${P1(t.reduce((s: number, x: any) => s + x.card_share, 0))} of all credit cards.`; },
    what: "Credit cards in issue across all banks, and each issuer's share.",
    how: "Cards outstanding at month end, summed across banks.",
    source: src.cards,
    Body: () => (
      <>
        <Panel title="Credit cards in issue"><Line series={[{ name: "Credit cards", data: tot("credit_cards") }]} fmt={v => count(v, 1)} label="Credit cards" /></Panel>
        <Panel title="Market share by issuer"><Bars rows={K().issuers.map((b: any) => ({ key: b.bank, label: b.bank, value: b.card_share, sub: `${signed(b.share_chg_pp, 2)} pp` }))} fmt={P1} label="Card share" limit={12} /></Panel>
      </>
    ),
  },
  {
    id: "spend", title: "How much is spent on credit cards?", card: "Credit card spend",
    value: () => cr(last<any>(K().totals).cc_spend_cr), unit: "a month", asOf: () => month(K().month),
    delta: () => growthDelta("cc_spend_cr"), spark: () => tot("cc_spend_cr"),
    lede: () => `Cardholders spent ${cr(last<any>(K().totals).cc_spend_cr)} in ${month(K().month)}, ${P1(last<any>(K().totals).ecom_share_pct)} of it online.`,
    what: "The value of purchases made with credit cards each month, at shops and online.",
    how: "Card transaction value at point of sale and e-commerce, summed across banks.",
    source: src.cards,
    Body: () => (
      <>
        <Panel title="Monthly credit card spend"><Line series={[{ name: "Spend", data: tot("cc_spend_cr") }]} fmt={v => cr(v, 1)} label="Card spend" /></Panel>
        <Panel title="Share of spend by issuer"><Bars rows={K().issuers.map((b: any) => ({ key: b.bank, label: b.bank, value: b.spend_share }))} fmt={P1} label="Spend share" limit={12} /></Panel>
        <Panel title="Share of spend made online"><Line series={[{ name: "Online share", data: tot("ecom_share_pct") }]} fmt={P} label="Online share" height={220} /></Panel>
      </>
    ),
  },
  {
    id: "spend-per-card", title: "How much does each card get used?", card: "Spend per card",
    value: () => `₹${n(last<any>(K().totals).spend_per_card_rs, 0)}`, unit: "a month", asOf: () => month(K().month),
    delta: () => growthDelta("spend_per_card_rs"), spark: () => tot("spend_per_card_rs"),
    lede: () => { const s = [...K().issuers].sort((a: any, b: any) => b.spend_per_card_rs - a.spend_per_card_rs)[0]; return `The average card is used for ₹${n(last<any>(K().totals).spend_per_card_rs, 0)} a month; ${s.bank} cards for ₹${n(s.spend_per_card_rs, 0)}.`; },
    what: "Monthly spend divided by cards in issue: a sign of how active and how affluent each issuer's cardholders are.",
    how: "Card spend ÷ cards outstanding.",
    source: src.cards,
    Body: () => (
      <>
        <Panel title="By issuer"><Bars rows={K().issuers.map((b: any) => ({ key: b.bank, label: b.bank, value: b.spend_per_card_rs, sub: `avg ticket ₹${n(b.ticket_rs, 0)}` }))} fmt={v => `₹${n(v, 0)}`} label="Spend per card" limit={12} /></Panel>
        <Panel title="Market average over time"><Line series={[{ name: "Spend per card", data: tot("spend_per_card_rs") }]} fmt={v => `₹${n(v, 0)}`} label="Spend per card" height={220} /></Panel>
      </>
    ),
  },
  {
    id: "concentration", title: "Do a few banks dominate cards?", card: "Card market concentration",
    value: () => n(last<any>(K().hhi).hhi_cards, 0), unit: "HHI", asOf: () => month(K().month),
    delta: () => ({ text: `Top 5 hold ${P1(last<any>(K().hhi).top5_pct_cards)}`, tone: "flat" }),
    spark: () => K().hhi.map((h: any) => [h.month, h.hhi_cards]),
    lede: () => `The top five issuers hold ${P1(last<any>(K().hhi).top5_pct_cards)} of cards and ${P1(last<any>(K().hhi).top5_pct_spend)} of spend. An HHI between 1,500 and 2,500 counts as moderately concentrated.`,
    what: "The Herfindahl-Hirschman Index adds up each issuer's market share squared. Below 1,500 is unconcentrated, above 2,500 highly concentrated.",
    how: "Σ (market share in %)² across all issuers, for cards and for spend.",
    source: src.cards,
    Body: () => (
      <Panel title="Concentration index">
        <Line series={[{ name: "By cards", data: K().hhi.map((h: any) => [h.month, h.hhi_cards]) }, { name: "By spend", data: K().hhi.map((h: any) => [h.month, h.hhi_spend]) }]} fmt={v => n(v, 0)} refs={[{ y: 1500, label: "1,500: moderately concentrated" }]} label="HHI" />
      </Panel>
    ),
  },
  {
    id: "debit-cards", title: "Debit cards and cash withdrawals", card: "Debit cards",
    value: () => count(last<any>(K().totals).debit_cards), asOf: () => month(K().month),
    delta: () => growthDelta("debit_cards"), spark: () => tot("debit_cards"),
    lede: () => { const t = last<any>(K().totals); return `There are ${count(t.debit_cards)} debit cards. They were used for ${cr(t.dc_atm_cash_val)} of ATM withdrawals but only ${cr(t.dc_spend_cr)} of shopping.`; },
    what: "Debit cards in issue, and how they are used: mostly for cash at ATMs rather than for paying in shops.",
    how: "Cards outstanding, ATM cash value and spend, summed across banks.",
    source: src.cards,
    Body: () => (
      <>
        <Panel title="Debit card share by bank"><Bars rows={K().debit.map((b: any) => ({ key: b.bank, label: b.bank, value: b.dc_share, sub: `${P1(b.cash_share)} of use is cash` }))} fmt={P1} label="Debit share" limit={12} /></Panel>
        <Panel title="Debit cards in issue"><Line series={[{ name: "Debit cards", data: tot("debit_cards") }]} fmt={v => count(v, 0)} label="Debit cards" height={220} /></Panel>
      </>
    ),
  },
  {
    id: "acceptance", title: "Where can you pay? QR codes, card machines and ATMs", card: "UPI QR codes",
    value: () => count(last<any>(K().totals).upi_qr), asOf: () => month(K().month),
    delta: () => growthDelta("upi_qr"), spark: () => tot("upi_qr"),
    lede: () => { const t = last<any>(K().totals); return `Merchants display ${count(t.upi_qr)} UPI QR codes, against ${count(t.pos)} card machines and ${n(t.atm_total, 0)} ATMs.`; },
    what: "The points where people can pay or withdraw cash: UPI QR codes, card machines (POS) and ATMs.",
    how: "Counts at month end, summed across banks.",
    source: src.cards,
    Body: () => (
      <>
        <Panel title="UPI QR codes"><Line series={[{ name: "UPI QR", data: tot("upi_qr") }]} fmt={v => count(v, 0)} label="UPI QR" height={220} /></Panel>
        <Panel title="Card machines (POS)" note={K().pos_notes?.[0]}><Line series={[{ name: "POS", data: tot("pos") }]} fmt={v => count(v, 0)} label="POS" height={220} /></Panel>
        <Panel title="ATMs and cash recyclers"><Line series={[{ name: "ATMs", data: tot("atm_total") }]} fmt={v => n(v / 1000, 0) + "k"} label="ATMs" height={220} /></Panel>
      </>
    ),
  },
  {
    id: "bank-groups", title: "Which kinds of bank lead in payments?", card: "Shares by bank group",
    value: () => P1(K().groups.find((g: any) => /Private/.test(g.group))?.credit_cards), unit: "of credit cards", asOf: () => month(K().month),
    delta: () => ({ text: "Private banks", tone: "flat" }),
    lede: () => { const p = K().groups.find((g: any) => /Public|PSU/.test(g.group)); return `Public sector banks issue ${P1(p?.debit_cards)} of debit cards but only ${P1(p?.credit_cards)} of credit cards.`; },
    what: "Each type of bank's share of cards, spend, ATMs and QR codes.",
    how: "Sum for each bank group ÷ all banks.",
    source: src.cards,
    Body: () => {
      const metrics: [string, string][] = [["credit_cards", "Credit cards"], ["cc_spend_cr", "Credit card spend"], ["debit_cards", "Debit cards"], ["dc_spend_cr", "Debit card spend"], ["atm_total", "ATMs"], ["upi_qr", "UPI QR codes"]];
      const groups = K().groups.map((g: any) => g.group);
      return (
        <Panel title="Share by bank group">
          <Stack keys={groups} label="Bank group shares" rows={metrics.map(([k, l]) => ({ label: l, values: Object.fromEntries(K().groups.map((g: any) => [g.group, g[k]])) }))} />
        </Panel>
      );
    },
  },
];

export const ECONOMY: Topic[] = [
  { id: "credit", title: "Credit", group: "Economy", blurb: "How fast bank lending grows, and to whom", source: "RBI sectoral credit, monthly",
    intro: "Every month the RBI reports how much banks have lent and to which sectors. These pages track growth, who is borrowing and whether lending outpaces inflation.", stats: credit },
  { id: "deposits", title: "Deposits", group: "Economy", blurb: "Whether deposits keep up with loans", source: "RBI statement of position, fortnightly",
    intro: "Loans have to be funded. These pages compare deposit growth with credit growth and show how stretched banks' balance sheets are.", stats: deposits },
  { id: "rates", title: "Rates", group: "Economy", blurb: "The repo rate and what it does to loans and deposits", source: "RBI lending and deposit rates, monthly",
    intro: "The RBI's repo rate sets the tone; banks decide how much to pass on. These pages follow loan and deposit rates, pass-through, benchmarks and each bank's MCLR.", stats: rates },
  { id: "payments", title: "Payments", group: "Economy", blurb: "Cards, spending, QR codes and ATMs", source: "RBI card statistics, monthly",
    intro: "Card counts, spending and acceptance points by bank, from the RBI's monthly card statistics.", stats: payments },
];
