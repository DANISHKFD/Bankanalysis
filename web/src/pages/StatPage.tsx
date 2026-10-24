import { Component, type ReactNode } from "react";
import { safe, type Stat, type Topic } from "../catalog";
import { Guilloche } from "../components/Guilloche";
import { StatCard } from "../components/StatCard";

class Guard extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? <div className="empty">This chart could not be drawn from the latest data. The rest of the page is unaffected.</div> : this.props.children; }
}

/** One statistic: the figure as a banknote, the charts, what it means, and the rest of the topic. */
export function StatPage({ t, s }: { t: Topic; s: Stat }) {
  const i = t.stats.indexOf(s);
  const prev = t.stats[i - 1], next = t.stats[i + 1];
  const delta = safe(s.delta, null);
  const Body = s.Body;
  return (
    <main id="main" tabIndex={-1} className={`t-${t.id} page-in`} key={s.id}>
      <div className="wrap">
        <div className="stat-head">
          <div>
            <p className="crumb"><a href="#">Home</a><span>/</span><a href={`#${t.id}`}>{t.title}</a><span>/</span><span>{i + 1} of {t.stats.length}</span></p>
            <h1>{s.title}</h1>
            <p className="lede">{safe(s.lede, "")}</p>
          </div>
          <div className="bill" aria-label={`${s.card}: ${safe(s.value, "")} ${s.unit || ""}`}>
            <Guilloche seed={t.id} />
            <div className="bl">{s.card}</div>
            <span className="fig">{safe(s.value, "–")}</span>
            {s.unit && <span className="unit">{s.unit}</span>}
            <div className="foot">
              {delta ? <span className={`chip ${delta.tone}`}>{delta.text}</span> : <span />}
              <span className="asof">{safe(s.asOf, "")}</span>
            </div>
          </div>
        </div>

        <div className="panels"><Guard><Body /></Guard></div>

        <div className="explain">
          <div><h3>What it means</h3><p>{s.what}</p></div>
          <div><h3>How it's worked out</h3><p>{s.how}</p></div>
          <div><h3>Source</h3><p>{s.source}</p></div>
        </div>

        <section className="more" aria-labelledby="more-h">
          <div className="sect-h"><h2 id="more-h">More on {t.title.toLowerCase()}</h2><p><a href={`#${t.id}`}>All {t.stats.length} pages →</a></p></div>
          <div className="cards">{t.stats.filter(x => x !== s).map(x => <StatCard key={x.id} t={t} s={x} compact />)}</div>
        </section>

        <nav className="pager" aria-label="Previous and next">
          {prev ? <a href={`#${t.id}.${prev.id}`}><small>← Previous</small><b>{prev.card}</b></a> : <span />}
          {next ? <a className="nx" href={`#${t.id}.${next.id}`}><small>Next →</small><b>{next.card}</b></a> : <a className="nx" href={`#${t.id}`}><small>Back to</small><b>{t.title}</b></a>}
        </nav>
      </div>
    </main>
  );
}
