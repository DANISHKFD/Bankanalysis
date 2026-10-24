import { useEffect, useMemo, useRef, useState } from "react";
import { NAV, TOPICS } from "../catalog";
import { lenders, metrics } from "../catalog/lenders";
import { slug } from "../data";

type Item = { label: string; kind: string; href: string; topic: string; words: string };

function buildIndex(): Item[] {
  const out: Item[] = [];
  for (const p of NAV) out.push({ label: p.title, kind: "Section", href: `#${p.id}`, topic: p.id, words: p.title });
  for (const t of TOPICS) for (const s of t.stats) out.push({ label: s.title, kind: t.title, href: `#${t.id}.${s.id}`, topic: t.id, words: `${s.title} ${s.card} ${t.title}` });
  for (const k of ["bank", "nbfc"] as const) {
    const tp = k === "bank" ? "banks" : "nbfcs";
    for (const l of lenders(k)) out.push({ label: l.name, kind: k === "bank" ? "Bank" : "NBFC", href: `#${k}.${slug(l.symbol)}`, topic: tp, words: `${l.name} ${l.short} ${l.symbol}` });
    for (const m of metrics(k)) out.push({ label: `${m.label}: ${k === "bank" ? "banks" : "NBFCs"} ranked`, kind: "Ranking", href: `#${tp}.${m.id}`, topic: tp, words: `${m.label} ${m.short} rank` });
  }
  return out;
}

/** Jump-to search over sections, statistics, lenders and rankings. Opens with "/" or Ctrl/Cmd+K. */
export function Search({ onClose }: { onClose: () => void }) {
  const idx = useMemo(buildIndex, []);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = (words.length ? idx.filter(i => words.every(w => i.words.toLowerCase().includes(w))) : idx.filter(i => i.kind === "Section")).slice(0, 40);
  useEffect(() => setSel(0), [q]);
  const go = (h: string) => { location.hash = h; onClose(); };
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search a statistic, bank or NBFC…" aria-label="Search"
          role="combobox" aria-expanded="true" aria-controls="hits" aria-activedescendant={hits[sel] ? `hit-${sel}` : undefined}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(hits.length - 1, sel + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, sel - 1)); }
            if (e.key === "Enter" && hits[sel]) go(hits[sel].href);
          }} />
        <ul id="hits" role="listbox">
          {hits.map((h, i) => (
            <li key={h.href} id={`hit-${i}`} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)}>
              <a href={h.href} style={{ ["--dot" as any]: `var(--t-${h.topic})` }} onClick={e => { e.preventDefault(); go(h.href); }}>
                <i /><b style={{ fontWeight: 500 }}>{h.label}</b><span>{h.kind}</span>
              </a>
            </li>
          ))}
          {!hits.length && <li className="hint">Nothing matches “{q}”. Try a bank name, a ticker like SBIN, or a word like “deposits”.</li>}
        </ul>
        <div className="hint">↑ ↓ to move · Enter to open · Esc to close</div>
      </div>
    </div>
  );
}
