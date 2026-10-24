import { safe, type Stat, type Topic } from "../catalog";
import { Spark } from "../charts/Spark";

/** Card linking to one statistic's page: label, headline figure, change and a trend line. */
export function StatCard({ t, s, compact = false }: { t: Topic; s: Stat; compact?: boolean }) {
  const delta = safe(s.delta, null);
  const spark = safe(s.spark, undefined);
  return (
    <a className={`scard t-${t.id}`} href={`#${t.id}.${s.id}`}>
      <span className="sl">{s.card}</span>
      <span className="sv"><b className="fig">{safe(s.value, "–")}</b>{s.unit && <small>{s.unit}</small>}</span>
      {delta && <span><span className={`chip ${delta.tone}`}>{delta.text}</span></span>}
      <span className="sb">
        <span className="asof">{safe(s.asOf, "")}</span>
        {spark && !compact && <Spark data={spark} />}
      </span>
      <svg className="go" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </a>
  );
}
