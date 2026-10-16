import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_INDEX } from "../chartIndex";
import { DATA, NAV_PAGES, pageById, type PageId } from "../pages";
import { href, navigate } from "../router";

interface Item { group: string; label: string; hint: string; to: string; anchor?: string; terms: string }

function buildItems(): Item[] {
  const items: Item[] = [{ group: "Pages", label: "Overview", hint: "contents", to: "#overview", terms: "overview home contents" }];
  NAV_PAGES.forEach(p => items.push({ group: "Pages", label: p.title, hint: p.group.toLowerCase(), to: href(p.id), terms: `${p.title} ${p.summary}` }));
  (DATA.banks?.banks || []).forEach((b: any) =>
    items.push({ group: "Banks", label: b.name, hint: b.symbol, to: href("banks", b.symbol), terms: `${b.name} ${b.short} ${b.symbol} ${b.group}` }));
  (DATA.nbfcs?.cos || []).forEach((c: any) =>
    items.push({ group: "NBFCs & HFCs", label: c.name, hint: c.symbol, to: href("nbfcs", c.symbol), terms: `${c.name} ${c.short} ${c.symbol} ${c.group}` }));
  CHART_INDEX.forEach(c => {
    const page = pageById(c.page as PageId);
    if (page.available) items.push({ group: "Charts and tables", label: c.title, hint: page.title, to: href(page.id), anchor: c.anchor, terms: `${c.title} ${page.title}` });
  });
  return items;
}

function score(item: Item, words: string[]): number {
  const t = item.terms.toLowerCase(), l = item.label.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (!t.includes(w)) return -1;
    s += l.startsWith(w) ? 3 : l.includes(w) ? 2 : 1;
  }
  return s;
}

export function JumpTo({ onClose }: { onClose: () => void }) {
  const all = useMemo(buildItems, []);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return all.filter(i => i.group === "Pages");
    return all.map(i => ({ i, s: score(i, words) })).filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.i)
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [q, all]);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const go = (it: Item) => { onClose(); navigate(it.to, it.anchor); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(results.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === "Enter" && results[sel]) { e.preventDefault(); go(results[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  let lastGroup = "";
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jump" role="dialog" aria-modal="true" aria-label="Jump to">
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Type a page, bank, NBFC or chart…" aria-label="Search pages, banks, NBFCs and charts"
          role="combobox" aria-expanded="true" aria-controls="jump-list" aria-activedescendant={results[sel] ? `jr-${sel}` : undefined} />
        {results.length ? (
          <ul ref={list} id="jump-list" role="listbox">
            {results.map((it, n) => {
              const head = it.group !== lastGroup ? <li className="jg" role="presentation" key={`g-${it.group}`}>{it.group}</li> : null;
              lastGroup = it.group;
              return [head,
                <li key={`${it.to}-${it.anchor || ""}-${n}`} id={`jr-${n}`} className="jr" role="option" aria-selected={n === sel}
                  onMouseMove={() => setSel(n)} onClick={() => go(it)}>
                  {it.label}<span>{it.hint}</span>
                </li>];
            })}
          </ul>
        ) : <p className="jempty">Nothing matches “{q}”. Try a bank name, a ticker such as SBIN, or a topic such as deposits.</p>}
        <div className="jfoot"><span>↑ ↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>
      </div>
    </div>
  );
}

const GROUP_ORDER = ["Pages", "Banks", "NBFCs & HFCs", "Charts and tables"];
