import { useEffect, useLayoutEffect, useRef } from "react";
import { clearCharts, hideTip } from "./legacy/core";
import { heroHeadline, renderBanks, renderNbfcs, tilesData } from "./legacy/sections";
import { DATA, NAV_PAGES, type PageDef } from "./pages";
import { href, navigate, reducedMotion, scrollToAnchor, takeAnchor } from "./router";
import { OnThisPage } from "./components/OnThisPage";
import { Pager } from "./components/Pager";
import { Spark } from "./components/Spark";
import { fm } from "./legacy/core";

/* ---------- shared page frame ---------- */
function Crumb({ page, extra }: { page: PageDef; extra?: string }) {
  return (
    <div className="crumb">
      <b>{page.group}</b><i>/</i><span>{page.source}</span>{page.asOf && <><i>·</i><span>data to {page.asOf}</span></>}
      {extra && <><i>·</i><span>{extra}</span></>}
    </div>
  );
}

function Frame({ page, pageKey, children }: { page: PageDef; pageKey: string; children: React.ReactNode }) {
  const Head = page.Head!;
  return (
    <main id="main" tabIndex={-1} className={`page-${page.id}`}>
      <div className="wrap page-head"><Crumb page={page} /><Head /></div>
      <OnThisPage pageKey={pageKey} />
      <div className="wrap page-body" id="page-body">
        {children}
        <Pager current={page.id} />
      </div>
    </main>
  );
}

/** After a page's DOM is in place: reset the chart registry, draw, then honour a pending jump. */
function useDraw(draw: () => void, key: string) {
  useLayoutEffect(() => {
    hideTip(); clearCharts();
    draw();
    const anchor = takeAnchor();
    if (anchor) requestAnimationFrame(() => scrollToAnchor(anchor)); else window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/* ---------- topic pages (credit, deposits, rates, …) ---------- */
export function TopicPage({ page }: { page: PageDef }) {
  const Body = page.Body!;
  useDraw(() => page.render?.(), page.id);
  return <Frame page={page} pageKey={page.id}><div className="grid-host"><Body /></div></Frame>;
}

/* ---------- banks and NBFCs: one company at a time, deep-linkable ---------- */
export function LenderPage({ page, sym }: { page: PageDef; sym?: string }) {
  const kind = page.id === "banks" ? "bank" : "nbfc";
  const store = kind === "bank" ? "bank-sel" : "nbfc-sel";
  const Body = page.Body!;
  const pick = useRef<((s: string) => void) | null>(null);
  const shown = useRef<string | null>(null);

  useDraw(() => {
    let start = sym || (kind === "bank" ? "HDFCBANK" : "BAJFINANCE");
    try { if (sym) localStorage.setItem(store, sym); else start = localStorage.getItem(store) || start; } catch { /* storage blocked */ }
    const go = (s: string) => navigate(href(page.id, s));
    pick.current = (kind === "bank" ? renderBanks : renderNbfcs)(start, go);
    shown.current = (document.getElementById(kind === "bank" ? "bank-sel" : "nbfc-sel") as HTMLSelectElement | null)?.value || start;
  }, page.id);

  useEffect(() => {
    if (!sym || sym === shown.current || !pick.current) return;
    pick.current(sym); shown.current = sym;
    try { localStorage.setItem(store, sym); } catch { /* storage blocked */ }
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [sym, store]);

  useEffect(() => {
    const name = (kind === "bank" ? DATA.banks?.banks : DATA.nbfcs?.cos)?.find((b: any) => b.symbol === shown.current)?.name;
    document.title = `${name ? name + " · " : ""}${page.title} · India Banking Monitor`;
  });

  return <Frame page={page} pageKey={page.id}><Body /></Frame>;
}

/* ---------- overview: the hero and a contents ledger of every page ---------- */
export function Overview() {
  useDraw(() => {}, "overview");
  const tiles = tilesData();
  const D = DATA;
  const groups = ["Economy", "Lenders", "Reference"] as const;
  return (
    <main id="main" tabIndex={-1} className="page-overview">
      <div className="wrap">
        <section className="hero" aria-labelledby="hero-h1">
          <div className="crumb"><b>Built {fm(D.built)}</b><i>·</i><span>RBI, MoSPI and NSE public data</span></div>
          <h1 id="hero-h1">{heroHeadline()}</h1>
          <p className="lede">Credit, deposits, interest rates, payments and the results of {D.banks?.banks?.length || 0} banks
            and {D.nbfcs?.cos?.length || 0} NBFCs, rebuilt from the Reserve Bank of India's data releases, MoSPI inflation data and NSE filings.
            Figures in ₹ crore unless stated; 1 lakh crore = ₹1 trillion.</p>
        </section>
        <div className="tiles">
          {tiles.map((t: any) => (
            <div className="tile" key={t.label}>
              <div className="label">{t.label}</div>
              <div className="value">{t.value}<small>{t.unit}</small></div>
              <div className={`chip ${t.chip[1]}`}>{t.chip[0]}</div>
              <div className="sub">{t.sub}</div>
            </div>
          ))}
        </div>

        <section className="index" aria-labelledby="index-h">
          <div className="index-head">
            <h2 id="index-h">In this monitor</h2>
            <p>Latest figure and trend for each page · press / to search</p>
          </div>
          {groups.map(g => {
            const rows = NAV_PAGES.filter(p => p.group === g);
            if (!rows.length) return null;
            return (
              <div key={g} role="list" aria-label={g}>
                <div className="igroup">{g}</div>
                {rows.map(p => (
                  <a className="irow" href={href(p.id)} key={p.id} role="listitem">
                    <div><div className="it">{p.title}</div><div className="ih">{p.summary}</div></div>
                    <div className="ispark">{p.spark && <Spark data={p.spark} label={`${p.title}: ${p.figure?.caption || ""} trend`} />}</div>
                    <div className="ifig">
                      {p.figure && <><b>{p.figure.value}<small>{p.figure.unit}</small></b><span>{p.figure.caption}</span></>}
                    </div>
                    <div className="ias">{p.asOf && <>data to<br />{p.asOf}</>}</div>
                    <div className="iarr" aria-hidden="true">→</div>
                  </a>
                ))}
              </div>
            );
          })}
        </section>
        <Pager current="overview" />
      </div>
    </main>
  );
}
