import { useState } from "react";
import { isNum } from "../data";
import { PAL } from "./util";

export type Bar = { key: string; label: string; value: number | null; sub?: string; href?: string; color?: string; hi?: boolean; group?: string };

/**
 * Ranked horizontal bars built in HTML so long labels wrap and rows can be links.
 * Handles negative values with a zero line; an optional reference (e.g. the median) is drawn across.
 */
export function Bars({ rows, fmt, reference, color = "var(--topic)", sort = true, label, limit, max }: {
  rows: Bar[]; fmt: (v: number) => string; reference?: { value: number; label: string }; color?: string; sort?: boolean; label: string; limit?: number; max?: number;
}) {
  const [all, setAll] = useState(false);
  const vals = rows.map(r => r.value).filter(isNum);
  const lo = Math.min(0, ...vals, reference?.value ?? 0), hi = Math.max(0, ...vals, reference?.value ?? 0, max ?? 0);
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;
  const list = sort ? [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)) : rows;
  const shown = limit && !all ? list.slice(0, limit) : list;
  return (
    <div className="bars" role="list" aria-label={label}>
      {reference && (
        <div className="bars-ref" aria-hidden="true">
          <span style={{ left: `${pos(reference.value)}%` }}>{reference.label}</span>
        </div>
      )}
      {shown.map(r => {
        const v = r.value;
        const inner = (
          <>
            <div className="bl"><span>{r.label}</span>{r.sub && <small>{r.sub}</small>}</div>
            <div className="bt">
              {lo < 0 && <i className="b0" style={{ left: `${pos(0)}%` }} />}
              {reference && <i className="bref" style={{ left: `${pos(reference.value)}%` }} />}
              {isNum(v) && (
                <span className={`bf${v < 0 ? " neg" : ""}`}
                  style={{ left: `${pos(Math.min(0, v))}%`, width: `${Math.max(0.4, (Math.abs(v) / span) * 100)}%`, background: r.color || color }} />
              )}
            </div>
            <div className="bv">{isNum(v) ? fmt(v) : "–"}</div>
          </>
        );
        return r.href
          ? <a key={r.key} href={r.href} className={`brow${r.hi ? " hi" : ""}`} role="listitem">{inner}</a>
          : <div key={r.key} className={`brow${r.hi ? " hi" : ""}`} role="listitem">{inner}</div>;
      })}
      {limit && list.length > limit && (
        <button type="button" className="more" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${list.length}`}</button>
      )}
    </div>
  );
}

/** Two values per row (now vs before), drawn as a dumbbell. */
export function Dumbbell({ rows, fmt, names, label }: {
  rows: { key: string; label: string; a: number | null; b: number | null }[]; fmt: (v: number) => string; names: [string, string]; label: string;
}) {
  const vals = rows.flatMap(r => [r.a, r.b]).filter(isNum);
  const lo = Math.min(0, ...vals), hi = Math.max(...vals);
  const pos = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  return (
    <div className="bars dumb" role="list" aria-label={label}>
      <div className="legend">
        <span><i className="dot-b" />{names[1]}</span>
        <span><i style={{ background: "var(--topic)" }} />{names[0]}</span>
      </div>
      {rows.map(r => (
        <div className="brow" key={r.key} role="listitem">
          <div className="bl"><span>{r.label}</span></div>
          <div className="bt">
            {lo < 0 && <i className="b0" style={{ left: `${pos(0)}%` }} />}
            {isNum(r.a) && isNum(r.b) && (
              <span className="dl" style={{ left: `${pos(Math.min(r.a, r.b))}%`, width: `${Math.abs(pos(r.a) - pos(r.b))}%` }} />
            )}
            {isNum(r.b) && <span className="dd b" style={{ left: `${pos(r.b)}%` }} title={`${names[1]}: ${fmt(r.b)}`} />}
            {isNum(r.a) && <span className="dd a" style={{ left: `${pos(r.a)}%` }} title={`${names[0]}: ${fmt(r.a)}`} />}
          </div>
          <div className="bv">{isNum(r.a) ? fmt(r.a) : "–"}<small>{isNum(r.b) ? `was ${fmt(r.b)}` : ""}</small></div>
        </div>
      ))}
    </div>
  );
}

/** 100% stacked rows: each row splits into named parts. */
export function Stack({ rows, keys, label, fmt = v => `${v.toFixed(1)}%` }: {
  rows: { label: string; values: Record<string, number | null> }[]; keys: string[]; label: string; fmt?: (v: number) => string;
}) {
  return (
    <div className="stack" role="list" aria-label={label}>
      <div className="legend">{keys.map((k, i) => <span key={k}><i style={{ background: PAL[i] }} />{k}</span>)}</div>
      {rows.map(r => {
        const tot = keys.reduce((s, k) => s + (r.values[k] || 0), 0) || 1;
        return (
          <div className="srow" key={r.label} role="listitem">
            <div className="sl">{r.label}</div>
            <div className="st">
              {keys.map((k, i) => {
                const v = r.values[k] || 0, w = (v / tot) * 100;
                return (
                  <span key={k} style={{ width: `${w}%`, background: PAL[i] }} title={`${k}: ${fmt(v)}`}>
                    {w > 9 && <em>{fmt(v)}</em>}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
