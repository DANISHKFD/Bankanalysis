import type { ReactNode } from "react";
import { TOPICS } from "../catalog";
import { lenders } from "../catalog/lenders";
import { Guilloche } from "../components/Guilloche";
import { D, day } from "../data";

type Page = { id: string; title: string; body: () => ReactNode };

const CMP: [string, "yes" | "part" | "no" | "ours", string][] = [
  ["Bank quarterly results (40 banks)", "yes", "June 2020 to now. HDFC Bank's Q4 FY26 matches Indus to the rupee."],
  ["NBFC / HFC results (36 companies)", "yes", "Bajaj Finance and Shriram Finance match Indus exactly for Q4 FY26 and FY26."],
  ["Margins, costs, returns, bad loans, capital", "yes", "Worked out from the filings; mistakes in some banks' own filings are corrected."],
  ["Peer comparisons", "yes", "Every measure has a page ranking all lenders, filterable by group."],
  ["Market value, P/B, P/E", "yes", "Daily from NSE prices."],
  ["Credit by sector", "yes", "Monthly history from Feb 2024."],
  ["Lending and deposit rates, MCLR", "yes", "Averages back to 2012, MCLR back to 2016."],
  ["Cards, ATMs and QR codes", "yes", "Monthly from Nov 2025."],
  ["Rural / urban / metro split, states", "yes", "Quarterly from 2023 and yearly back to 2015; within 0.1 point of Indus."],
  ["Deposits and CASA by area", "yes", "2015 to 2026; March 2026 shares match Indus exactly."],
  ["CASA, AUM, stage 3 from slide decks", "part", "Read by Claude from each company's latest investor presentation."],
  ["Loan mix by product", "no", "Only in slide decks, laid out differently by every bank."],
  ["Branch counts", "no", "Only in slide decks and annual reports."],
  ["Bad-loan movement (slippages, recoveries, write-offs)", "no", "Only in annual reports and year-end decks."],
  ["Credit growth after inflation", "ours", "Uses MoSPI's CPI."],
  ["Funding pressure", "ours", "Credit-to-deposit, new loans vs new deposits, bond holdings."],
  ["Did rate cuts reach customers?", "ours", "Pass-through by bank type, explained by loan benchmarks."],
  ["Card concentration and spend per card", "ours", ""],
  ["Loans by interest rate and size", "ours", "From RBI's annual BSR-1 survey."],
];
const ST = { yes: "Rebuilt", part: "Partly", no: "Not yet", ours: "Only here" };

export const ABOUT: Page[] = [
  {
    id: "", title: "About this monitor", body: () => (
      <div className="prose">
        <p>The India Banking Monitor rebuilds, from free public data, the bank research that Indus Equity Advisors publishes as about a hundred PDF slide decks, and adds analysis they don't have.</p>
        <p>It covers {TOPICS.reduce((s, t) => s + t.stats.length, 0)} statistics on the banking system, {lenders("bank").length} listed banks and {lenders("nbfc").length} NBFCs and housing finance companies. Every statistic has its own page with a chart, a plain explanation, the formula and the source.</p>
        <h2>Where the numbers come from</h2>
        <ul>
          <li><b>Reserve Bank of India:</b> monthly releases on credit, interest rates and card payments; fortnightly bank balance sheets; quarterly and annual BSR tables from its database (data.rbi.org.in).</li>
          <li><b>NSE:</b> each company's quarterly results (XBRL filings), investor presentations and daily closing prices.</li>
          <li><b>MoSPI:</b> consumer price inflation.</li>
        </ul>
        <p>Last rebuilt {day(D.built?.slice(0, 10))}. This is an analysis of public data, not investment advice.</p>
      </div>
    ),
  },
  {
    id: "compare", title: "What's rebuilt from Indus Equity, and what's new", body: () => (
      <div className="prose" style={{ maxWidth: "none" }}>
        <p>Indus Equity's reports page is a library of PDF decks. Every chart in it comes from RBI data or company filings, so all of it can be rebuilt. Here is where this monitor stands.</p>
        <div className="tbl"><table>
          <thead><tr><th>Item</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>{CMP.map(([a, s, b]) => <tr key={a}><td>{a}</td><td><span className={`status ${s}`}>{ST[s]}</span></td><td style={{ whiteSpace: "normal" }}>{b}</td></tr>)}</tbody>
        </table></div>
      </div>
    ),
  },
  {
    id: "data", title: "How the data is built", body: () => (
      <div className="prose" style={{ maxWidth: "none" }}>
        <p>A program on a home PC runs the same five steps every evening at 19:30 and only downloads what's new.</p>
        <div className="steps">
          <div><b>Fetch</b><p>Downloads new RBI, NSE and MoSPI files. RBI's servers block plain scripts, so a hidden browser does the clicking.</p></div>
          <div><b>Clean</b><p>Reads each file into one database, finding rows by name, converting units, rebuilding missing quarters.</p></div>
          <div><b>Read decks</b><p>Claude reads each new investor presentation once; a figure is kept only if its quoted text is on the cited page.</p></div>
          <div><b>Calculate</b><p>Works out growth rates, ratios, rankings and valuations.</p></div>
          <div><b>Publish</b><p>Rebuilds this website and pushes it to GitHub Pages.</p></div>
        </div>
        <h2>Checks</h2>
        <ul>
          <li>HDFC Bank Q4 FY26: profit ₹19,221 cr, NII ₹33,082 cr, gross NPA ₹34,061 cr, all identical to Indus.</li>
          <li>Bajaj Finance and Shriram Finance match Indus line for line.</li>
          <li>Credit growth matches RBI's own 19.08%; card statistics add up to RBI's totals.</li>
          <li>Metro share of credit 65.9% (2015) and 60.3% (2025), as in Indus; March 2026 deposit shares match exactly.</li>
        </ul>
        <h2>Known differences</h2>
        <ul>
          <li>Quarters are shown as first reported; companies sometimes restate them later.</li>
          <li>CPI moved to a 2024 base in January 2026, so inflation-adjusted series mix two baskets.</li>
          <li>RBI switched to month-end reporting in December 2025.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "sources", title: "Data notes", body: () => (
      <div className="prose">
        <ul>{(D.notes?.notes || []).map((x: any, i: number) => <li key={i}><b>{x.dataset.toUpperCase()}:</b> {x.note}</li>)}</ul>
        <p>Inflation for {D.notes?.cpi_latest?.month?.slice(0, 7)} is {D.notes?.cpi_latest?.status} (base {D.notes?.cpi_latest?.base}).</p>
      </div>
    ),
  },
];

export function AboutPage({ id }: { id: string }) {
  const p = ABOUT.find(a => a.id === id) || ABOUT[0];
  return (
    <main id="main" tabIndex={-1} className="t-about page-in" key={p.id}>
      <section className="band">
        <Guilloche seed="about" />
        <div className="wrap band-in">
          <p className="crumb"><a href="#">Home</a><span>/</span><span>About</span></p>
          <h1>{p.title}</h1>
          <div className="chips" style={{ marginTop: 18 }}>
            {ABOUT.map(a => <a key={a.id} href={a.id ? `#about.${a.id}` : "#about"} className="ibtn" aria-current={a === p ? "page" : undefined} style={a === p ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : undefined}>{a.id ? a.title.split(",")[0].replace("What's rebuilt from Indus Equity", "Indus vs this monitor") : "Overview"}</a>)}
          </div>
        </div>
      </section>
      <div className="wrap" style={{ paddingBlock: "28px 64px" }}>{p.body()}</div>
    </main>
  );
}
