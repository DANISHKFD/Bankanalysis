import { safe, TOPICS } from "../catalog";
import { lenders } from "../catalog/lenders";
import { Spark } from "../charts/Spark";
import { Guilloche } from "../components/Guilloche";
import { D, day, month, n, pct } from "../data";

/** Home: a one-sentence state of play, a banknote card per topic, and every statistic in one ledger. */
export function Home() {
  const c = D.credit, f = D.funding, r = D.rates;
  const cards = [
    ...TOPICS.filter(t => t.group === "Economy"),
    { id: "banks", title: "Banks", blurb: `Results, asset quality and rankings for ${lenders("bank").length} listed banks`, stats: [] as any[] },
    { id: "nbfcs", title: "NBFCs & HFCs", blurb: `Results and rankings for ${lenders("nbfc").length} non-bank and housing lenders`, stats: [] as any[] },
    ...TOPICS.filter(t => t.group === "Lenders"),
  ];
  const lead = (id: string) => TOPICS.find(t => t.id === id)?.stats[0];
  return (
    <main id="main" tabIndex={-1} className="t-home page-in">
      <section className="hero">
        <Guilloche seed="home" />
        <div className="wrap">
          <p className="eyebrow"><b>Updated {day(D.built?.slice(0, 10))}</b><span>From RBI, NSE and MoSPI releases</span></p>
          <h1>
            Bank credit is up <em style={{ ["--hc" as any]: "var(--t-credit)" }}>{pct(c.total.yoy)}</em>, deposits{" "}
            <em style={{ ["--hc" as any]: "var(--t-deposits)" }}>{pct(f.latest.deposit_yoy)}</em>, and the repo rate is{" "}
            <em style={{ ["--hc" as any]: "var(--t-rates)" }}>{n(r.repo_now, 2)}%</em>.
          </h1>
          <p className="lede">
            A public monitor of Indian banking: lending, deposits, interest rates and payments from the Reserve Bank of India,
            and the results of {lenders("bank").length} banks and {lenders("nbfc").length} NBFCs from their stock exchange filings.
            Every number has its own page explaining what it means and where it comes from.
          </p>
        </div>
      </section>

      <div className="wrap">
        <div className="notes">
          {cards.map(t => {
            const s = lead(t.id);
            const nStats = t.stats.length;
            return (
              <a key={t.id} className={`note t-${t.id}`} href={`#${t.id}`}>
                <Guilloche seed={t.id} />
                <div>
                  <div className="note-top"><h2>{t.title}</h2><span>{nStats ? `${nStats} pages` : "Directory"}</span></div>
                  <p className="bl">{t.blurb}</p>
                </div>
                <div />
                {s ? (
                  <div className="note-fig">
                    <div><span className="fig">{safe(s.value, "–")}</span><span className="cap">{s.card} · {safe(s.asOf, "")}</span></div>
                    {s.spark && <Spark data={safe(s.spark, [])} w={110} h={40} />}
                  </div>
                ) : (
                  <div className="note-fig"><div><span className="fig">{t.id === "banks" ? lenders("bank").length : lenders("nbfc").length}</span><span className="cap">lenders, latest results {month(D.val?.date)}</span></div></div>
                )}
              </a>
            );
          })}
        </div>

        <div className="sect-h">
          <h2>Every statistic</h2>
          <p>{TOPICS.reduce((s, t) => s + t.stats.length, 0)} pages, each with charts, an explanation and the source</p>
        </div>
        <div className="ledger">
          {TOPICS.map(t => (
            <div key={t.id} className={`lgroup t-${t.id}`}>
              <h3><i />{t.title}</h3>
              {t.stats.map(s => (
                <a key={s.id} className="lrow" href={`#${t.id}.${s.id}`}>
                  <span className="lt">{s.card}</span>
                  <span className="lv">{safe(s.value, "–")}</span>
                  <span className="asof" style={{ font: "500 11px var(--f-data)", color: "var(--muted)", textAlign: "right" }}>{safe(s.asOf, "")}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
