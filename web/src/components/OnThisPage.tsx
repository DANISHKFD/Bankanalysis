import { useEffect, useState } from "react";
import { reducedMotion } from "../router";

interface Entry { title: string; el: HTMLElement }

/** Strip of the current page's card titles; highlights the card in view and scrolls to one on click. */
export function OnThisPage({ pageKey }: { pageKey: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>("#page-body .card")].filter(c => c.querySelector("h2") && !c.closest("[hidden]"));
    const list = cards.map(el => ({ el, title: el.querySelector("h2")!.textContent || "" }));
    setEntries(list);
    setActive(0);
    const seen = new Map<HTMLElement, number | null>();
    const io = new IntersectionObserver(es => {
      es.forEach(e => seen.set(e.target as HTMLElement, e.isIntersecting ? e.boundingClientRect.top : null));
      const vis = list.map((x, i) => [i, seen.get(x.el)] as const).filter(([, t]) => t != null).sort((a, b) => (a[1] as number) - (b[1] as number));
      if (vis.length) setActive(vis[0][0]);
    }, { rootMargin: "-130px 0px -55% 0px" });
    list.forEach(x => io.observe(x.el));
    return () => io.disconnect();
  }, [pageKey]);

  useEffect(() => {
    document.querySelector('.onpage button[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (entries.length < 3) return null;
  return (
    <nav className="onpage" aria-label="On this page">
      <div className="wrap onpage-in">
        <span className="ol">On this page</span>
        {entries.map((x, i) => (
          <button key={i} type="button" aria-current={i === active ? "true" : undefined}
            onClick={() => x.el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" })}>
            {x.title}
          </button>
        ))}
      </div>
    </nav>
  );
}
