import { safe, type Topic } from "../catalog";
import { Guilloche } from "../components/Guilloche";
import { StatCard } from "../components/StatCard";

/** Topic hub: the topic's banner and a card for each of its statistics. */
export function TopicPage({ t }: { t: Topic }) {
  return (
    <main id="main" tabIndex={-1} className={`t-${t.id} page-in`}>
      <section className="band">
        <Guilloche seed={t.id} />
        <div className="wrap band-in">
          <p className="crumb"><a href="#">Home</a><span>/</span><span>{t.group}</span><span>·</span><span>{t.source}</span></p>
          <h1>{t.title}</h1>
          <p className="intro">{t.intro}</p>
        </div>
      </section>
      <div className="wrap">
        <div className="cards">{t.stats.map(s => <StatCard key={s.id} t={t} s={s} />)}</div>
      </div>
    </main>
  );
}

export const topicTitle = (t: Topic) => `${t.title} · ${safe(() => t.stats[0].asOf(), "")}`;
