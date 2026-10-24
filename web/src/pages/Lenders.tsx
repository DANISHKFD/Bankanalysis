import { Component, useEffect, useState, type ReactNode } from "react";
import { groupLabel, groupMedian, lenders, metrics, qrows, rank, type Kind, type Metric } from "../catalog/lenders";
import { Bars } from "../charts/Bars";
import { Columns } from "../charts/Columns";
import { Line } from "../charts/Line";
import { Spark } from "../charts/Spark";
import { Guilloche } from "../components/Guilloche";
import { Chips, Panel, Table } from "../components/Panel";
import { cr, D, isNum, median, month, n, pct, qtr, signed, slug, type Pt } from "../data";

const T = (k: Kind) => (k === "bank" ? "banks" : "nbfcs");
const TITLE = (k: Kind) => (k === "bank" ? "Banks" : "NBFCs & HFCs");
const lhref = (k: Kind, sym: string) => `#${k}.${slug(sym)}`;
const groupsOf = (k: Kind) => [{ id: "all", label: "All" }, ...[...new Set(lenders(k).map(l => l.group))].map(g => ({ id: g, label: groupLabel[g] || g }))];
const remember = (k: Kind, sym: string) => { try { localStorage.setItem(`last-${k}`, sym); } catch { /* storage blocked */ } };
const recall = (k: Kind) => { try { return localStorage.getItem(`last-${k}`); } catch { return null; } };

class Guard extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? <div className="empty">This chart could not be drawn for this lender.</div> : this.props.children; }
}

/* ---------------- directory ---------------- */
export function Directory({ kind }: { kind: Kind }) {
  const [q, setQ] = useState("");
  const [g, setG] = useState("all");
  const ms = metrics(kind);
  const pick = kind === "bank" ? ["profit-growth", "gnpa", "roa"] : ["profit-growth", "credit-cost", "roe"];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = lenders(kind).filter(l => (g === "all" || l.group === g) && words.every(w => `${l.name} ${l.short} ${l.symbol}`.toLowerCase().includes(w)));
  return (
    <main id="main" tabIndex={-1} className={`t-${T(kind)} page-in`}>
      <section className="band">
        <Guilloche seed={T(kind)} />
        <div className="wrap band-in">
          <p className="crumb"><a href="#">Home</a><span>/</span><span>Lenders</span><span>·</span><span>NSE results filings, quarterly</span></p>
          <h1>{TITLE(kind)}</h1>
          <p className="intro">
            {kind === "bank"
              ? `Quarterly results for ${lenders(kind).length} listed banks, rebuilt from their stock exchange filings. Open a bank for its own page, or rank all banks on one measure.`
              : `Quarterly results for ${lenders(kind).length} listed NBFCs and housing finance companies. Their filings carry no bad-loan ratio, so credit cost stands in for asset quality.`}
          </p>
        </div>
      </section>
      <div className="wrap">
        <div className="dir-tools">
          <input className="search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Find a ${kind === "bank" ? "bank" : "lender"} by name or ticker`} aria-label="Find a lender" />
          <Chips options={groupsOf(kind)} value={g} onChange={setG} label="Group" />
        </div>
        <div className="lgrid">
          {list.map(l => {
            const rows = qrows(kind, l.symbol);
            const lastQ = rows[rows.length - 1];
            return (
              <a key={l.symbol} className="lcard" href={lhref(kind, l.symbol)}>
                <div className="lh"><b>{l.short}</b><span>{groupLabel[l.group] || l.group}</span></div>
                <div className="lm">
                  {pick.map(id => { const m = ms.find(x => x.id === id)!; const v = m.get(l.symbol).v; return <div key={id}>{m.short}<b>{isNum(v) ? m.fmt(v) : "–"}</b></div>; })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <span className="asof" style={{ font: "500 11px var(--f-data)", color: "var(--muted)" }}>{lastQ?.label} · profit trend</span>
                  <Spark data={rows.slice(-12).map(r => [r.period_end, r.pat] as Pt)} w={96} h={30} />
                </div>
              </a>
            );
          })}
        </div>
        {!list.length && <div className="empty">No {kind === "bank" ? "bank" : "lender"} matches “{q}”. Try the short name (e.g. “SBI”) or the NSE ticker.</div>}
        <div className="sect-h" style={{ marginTop: 20 }}><h2>Rank all {TITLE(kind).toLowerCase()} by</h2><p>Each measure has its own page</p></div>
        <div className="ranklinks">{ms.map(m => <a key={m.id} href={`#${T(kind)}.${m.id}`}>{m.label}</a>)}</div>
      </div>
    </main>
  );
}

/* ---------------- one lender ---------------- */
export function LenderPage({ kind, sym }: { kind: Kind; sym: string }) {
  const all = lenders(kind);
  const i = all.findIndex(l => l.symbol === sym);
  const l = all[i];
  useEffect(() => { if (l) remember(kind, sym); }, [kind, sym, l]);
  if (!l) return <NotFound what={`No ${kind === "bank" ? "bank" : "lender"} with ticker ${sym}.`} back={`#${T(kind)}`} />;
  const rows = qrows(kind, sym);
  const lastQ = [...rows].reverse().find(r => isNum(r.pat)) || rows[rows.length - 1];
  const ms = metrics(kind);
  const v = (D.val.rows as any[]).find(r => r.symbol === sym);
  const prev = all[i - 1], next = all[i + 1];
  const recent = rows.slice(-12);
  const qs = (f: string): Pt[] => rows.map(r => [r.period_end, isNum(r[f]) ? r[f] : null] as Pt);
  const lede = kind === "bank"
    ? `${l.name} made ${cr(lastQ?.pat)} profit in ${lastQ?.label}${isNum(lastQ?.pat_yoy) ? `, ${signed(lastQ.pat_yoy, 1, "%")} on a year earlier` : ""}. Gross bad loans are ${isNum(lastQ?.gnpa_pct) ? pct(lastQ.gnpa_pct, 2) : "not reported"} of loans.`
    : `${l.name} made ${cr(lastQ?.pat)} profit in ${lastQ?.label}${isNum(lastQ?.pat_yoy) ? `, ${signed(lastQ.pat_yoy, 1, "%")} on a year earlier` : ""}, on a loan book of ${cr(rows.filter(r => isNum(r.loans)).at(-1)?.loans)}.`;
  return (
    <main id="main" tabIndex={-1} className={`t-${T(kind)} page-in`} key={sym}>
      <div className="wrap">
        <div className="stat-head">
          <div>
            <p className="crumb"><a href="#">Home</a><span>/</span><a href={`#${T(kind)}`}>{TITLE(kind)}</a><span>/</span><span>{groupLabel[l.group] || l.group}</span><span>·</span><span>NSE: {l.symbol}</span></p>
            <h1>{l.name}</h1>
            <p className="lede">{lede}</p>
            {l.note && <p className="lede" style={{ fontSize: 14.5 }}>{l.note}</p>}
          </div>
          <div className="bill">
            <Guilloche seed={T(kind)} />
            <div className="bl">Net profit, {lastQ?.label}</div>
            <span className="fig">{cr(lastQ?.pat)}</span>
            <div className="foot">
              {isNum(lastQ?.pat_yoy) ? <span className={`chip ${lastQ.pat_yoy >= 0 ? "up" : "down"}`}>{signed(lastQ.pat_yoy, 1, "%")} on a year ago</span> : <span />}
              <span className="asof">{v ? `Market cap ${cr(v.mcap)}` : ""}</span>
            </div>
          </div>
        </div>

        <section className="panel" style={{ marginBottom: 16 }}>
          <h2>Key measures</h2>
          <p className="pnote">Rank among {all.length} {TITLE(kind).toLowerCase()} in brackets. Open a measure to see every lender ranked.</p>
          <div className="tiles">
            {ms.map(m => {
              const g = m.get(sym); const rk = rank(kind, m, sym);
              return (
                <a key={m.id} className="tile" href={`#${T(kind)}.${m.id}`}>
                  <span className="tl">{m.label}</span>
                  <span className="tv">{isNum(g.v) ? m.fmt(g.v) : <small style={{ font: "500 14px var(--f-body)", color: "var(--muted)" }}>Not reported</small>}</span>
                  <span className="tr"><span>{g.when && g.when.length > 7 ? month(g.when) : g.when}</span>{rk && <em>#{rk.pos} of {rk.of}</em>}</span>
                </a>
              );
            })}
          </div>
        </section>

        <div className="panels">
          <Guard>
            <Panel title="Net profit each quarter" wide={false}>
              <Columns data={recent.map(r => ({ label: r.label, value: r.pat, note: r.exceptional ? `Includes exceptional items of ${cr(r.exceptional)}` : r.derived ? "Rebuilt from year-to-date figures" : undefined }))} fmt={v => n(v, 0)} label="Net profit, ₹ crore" />
            </Panel>
            <Panel title="Net interest income each quarter" wide={false}>
              <Columns data={recent.map(r => ({ label: r.label, value: r.nii }))} fmt={v => n(v, 0)} label="Net interest income, ₹ crore" color="var(--topic-2)" />
            </Panel>
            {kind === "bank" ? (
              <>
                <Panel title="Bad loans" wide={false}><Line series={[{ name: "Gross NPA", data: qs("gnpa_pct") }, { name: "Net NPA", data: qs("nnpa_pct") }]} fmt={v => `${n(v, 1)}%`} label="NPA ratios" height={250} /></Panel>
                <Panel title="Efficiency and returns" wide={false}><Line series={[{ name: "Cost-to-income", data: qs("cost_to_income") }]} fmt={v => `${n(v, 0)}%`} label="Cost to income" height={250} /></Panel>
                <Panel title="Loan and deposit growth" wide={false}><Line series={[{ name: "Loans", data: qs("advances_yoy") }, { name: "Deposits", data: qs("deposits_yoy") }]} fmt={v => `${n(v, 0)}%`} label="Balance sheet growth" height={250} /></Panel>
                <Panel title="Capital (CET1)" wide={false}><Line series={[{ name: "CET1", data: qs("cet1") }]} fmt={v => `${n(v, 1)}%`} label="CET1" height={250} /></Panel>
              </>
            ) : (
              <>
                <Panel title="Credit cost" wide={false}><Line series={[{ name: "Credit cost", data: qs("credit_cost_ann") }]} fmt={v => `${n(v, 1)}%`} label="Credit cost" height={250} zero /></Panel>
                <Panel title="Returns" wide={false}><Line series={[{ name: "RoE", data: qs("roe_ann") }, { name: "RoA", data: qs("roa_ann") }]} fmt={v => `${n(v, 0)}%`} label="Returns" height={250} zero /></Panel>
                <Panel title="Loan growth" wide={false}><Line series={[{ name: "Loans", data: qs("loans_yoy") }]} fmt={v => `${n(v, 0)}%`} label="Loan growth" height={250} /></Panel>
                <Panel title="Cost-to-income" wide={false}><Line series={[{ name: "Cost-to-income", data: qs("cost_to_income") }]} fmt={v => `${n(v, 0)}%`} label="Cost to income" height={250} /></Panel>
              </>
            )}
            <Panel title="Results, last eight quarters" note="₹ crore unless stated. * rebuilt from year-to-date figures.">
              <ResultsTable kind={kind} rows={rows.slice(-8)} />
            </Panel>
          </Guard>
        </div>

        <nav className="pager" aria-label="Previous and next lender" style={{ marginTop: 24 }}>
          {prev ? <a href={lhref(kind, prev.symbol)}><small>← Previous</small><b>{prev.short}</b></a> : <span />}
          {next ? <a className="nx" href={lhref(kind, next.symbol)}><small>Next →</small><b>{next.short}</b></a> : <a className="nx" href={`#${T(kind)}`}><small>Back to</small><b>{TITLE(kind)}</b></a>}
        </nav>
      </div>
    </main>
  );
}

function ResultsTable({ kind, rows }: { kind: Kind; rows: any[] }) {
  const N = (v: any) => (isNum(v) ? n(v, 0) : "–"), Pc = (v: any) => (isNum(v) ? `${n(v, 2)}%` : "–");
  const lines: [string, string, (v: any) => string][] = kind === "bank"
    ? [["Interest earned", "interest_earned", N], ["Interest paid", "interest_expended", N], ["Net interest income", "nii", N], ["Other income", "other_income", N], ["Operating costs", "opex", N],
      ["Operating profit", "ppop", N], ["Provisions", "provisions", N], ["Net profit", "pat", N], ["Cost-to-income", "cost_to_income", Pc], ["Gross NPA", "gnpa_pct", Pc], ["Net NPA", "nnpa_pct", Pc], ["Provision coverage", "pcr", Pc], ["CET1", "cet1", Pc]]
    : [["Revenue from operations", "revenue_ops", N], ["Finance cost", "finance_cost", N], ["Net interest income", "nii", N], ["Operating costs", "expenditure_ex_int", N], ["Impairment", "impairment", N],
      ["Net profit", "pat", N], ["Cost-to-income", "cost_to_income", Pc], ["Credit cost (annualised)", "credit_cost_ann", Pc], ["RoE (annualised)", "roe_ann", Pc], ["Loans", "loans", N], ["Leverage", "leverage", v => (isNum(v) ? `${n(v, 1)}×` : "–")]];
  return <Table head={["", ...rows.map(r => r.label + (r.derived ? "*" : ""))]} num={rows.map((_, i) => i + 1)} rows={lines.map(([lab, k, f]) => [lab, ...rows.map(r => f(r[k]))])} />;
}

/* ---------------- one metric, every lender ---------------- */
export function Ranking({ kind, m }: { kind: Kind; m: Metric }) {
  const [g, setG] = useState("all");
  const last = recall(kind);
  const ls = lenders(kind).filter(l => g === "all" || l.group === g);
  const rows = ls.map(l => { const x = m.get(l.symbol); return { key: l.symbol, label: l.short, value: x.v, sub: `${groupLabel[l.group] || l.group}${x.when ? " · " + (x.when.length > 7 ? qtr(x.when) : x.when) : ""}`, href: lhref(kind, l.symbol), hi: l.symbol === last }; }).filter(r => isNum(r.value));
  const med = median(rows.map(r => r.value as number));
  const groups = [...new Set(lenders(kind).map(l => l.group))];
  const ms = metrics(kind);
  const idx = ms.indexOf(m);
  const lastL = lenders(kind).find(l => l.symbol === last);
  const sorted = [...rows].sort((a, b) => (m.up ? (b.value as number) - (a.value as number) : (a.value as number) - (b.value as number)));
  return (
    <main id="main" tabIndex={-1} className={`t-${T(kind)} page-in`} key={m.id}>
      <div className="wrap">
        <div className="stat-head">
          <div>
            <p className="crumb"><a href="#">Home</a><span>/</span><a href={`#${T(kind)}`}>{TITLE(kind)}</a><span>/</span><span>Ranking {idx + 1} of {ms.length}</span></p>
            <h1>{m.label}: every {kind === "bank" ? "bank" : "lender"} ranked</h1>
            <p className="lede">
              {sorted.length ? `${sorted[0].label} ${m.up ? "leads" : "is lowest"} at ${m.fmt(sorted[0].value as number)}; ${sorted[sorted.length - 1].label} is at ${m.fmt(sorted[sorted.length - 1].value as number)}. ${m.up ? "Higher" : "Lower"} is better.` : "No lender reports this measure yet."}
            </p>
          </div>
          <div className="bill">
            <Guilloche seed={T(kind)} />
            <div className="bl">Median, {g === "all" ? TITLE(kind).toLowerCase() : (groupLabel[g] || g).toLowerCase()}</div>
            <span className="fig">{med != null ? m.fmt(med) : "–"}</span>
            <div className="foot"><span className="chip flat">{rows.length} reporting</span>{lastL && <a className="asof" href={lhref(kind, lastL.symbol)}>{lastL.short} highlighted</a>}</div>
          </div>
        </div>
        <div className="panels">
          <Panel title={`${m.short} by ${kind === "bank" ? "bank" : "lender"}`} note="Click a lender to open its page.">
            <Chips options={groupsOf(kind)} value={g} onChange={setG} label="Group" />
            <Bars rows={sorted} fmt={m.fmt} label={m.label} reference={med != null ? { value: med, label: `Median ${m.fmt(med)}` } : undefined} sort={false} />
          </Panel>
          {m.hist && (
            <Panel title="Median over time, by group" note="Median across the lenders in each group that reported that quarter.">
              <Line series={groups.map(gr => ({ name: groupLabel[gr] || gr, data: groupMedian(kind, m.hist!, gr) }))} fmt={v => m.fmt(v)} label={`${m.label} median`} />
            </Panel>
          )}
        </div>
        <div className="explain">
          <div><h3>What it means</h3><p>{m.what}</p></div>
          <div><h3>How it's worked out</h3><p>{m.how}</p></div>
          <div><h3>Source</h3><p>{m.source}</p></div>
        </div>
        <div className="sect-h" style={{ marginTop: 36 }}><h2>Other rankings</h2><p><a href={`#${T(kind)}`}>All {TITLE(kind).toLowerCase()} →</a></p></div>
        <div className="ranklinks">{ms.filter(x => x !== m).map(x => <a key={x.id} href={`#${T(kind)}.${x.id}`}>{x.label}</a>)}</div>
      </div>
    </main>
  );
}

export function NotFound({ what, back }: { what: string; back: string }) {
  return (
    <main id="main" tabIndex={-1} className="wrap" style={{ paddingBlock: 80 }}>
      <h1 style={{ font: "700 40px var(--f-display)" }}>Page not found</h1>
      <p className="lede">{what}</p>
      <p><a href={back}>Go back</a> or press / to search.</p>
    </main>
  );
}
