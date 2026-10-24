import { useState, type ReactNode } from "react";

/** A titled block on a statistic page holding one chart or table. */
export function Panel({ title, note, children, wide = true }: { title: string; note?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`panel${wide ? "" : " half"}`}>
      <h2>{title}</h2>
      {note && <p className="pnote">{note}</p>}
      {children}
    </section>
  );
}

/** Pill buttons for switching a view (one choice at a time). */
export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function useChoice<T extends string>(init: T) {
  return useState<T>(init);
}

/** Plain data table; first column is the row label. */
export function Table({ head, rows, num = [] }: { head: string[]; rows: (string | number | ReactNode)[][]; num?: number[] }) {
  return (
    <div className="tbl">
      <table>
        <thead><tr>{head.map((h, i) => <th key={h} className={num.includes(i) ? "r" : ""}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={num.includes(j) ? "r" : ""}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
