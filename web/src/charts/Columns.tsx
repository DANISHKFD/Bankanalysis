import { useState } from "react";
import { isNum } from "../data";
import { niceTicks, Tip, TipRow, useWidth } from "./util";

/** Vertical bars for quarterly or yearly values; negatives hang below the zero line. */
export function Columns({ data, fmt, height = 260, label, color = "var(--topic)" }: {
  data: { label: string; value: number | null; note?: string }[]; fmt: (v: number) => string; height?: number; label: string; color?: string;
}) {
  const [box, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const vals = data.map(d => d.value).filter(isNum);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  const stepT = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  while (ticks[ticks.length - 1] < Math.max(0, ...vals)) ticks.push(+(ticks[ticks.length - 1] + stepT).toFixed(10));
  while (ticks[0] > Math.min(0, ...vals)) ticks.unshift(+(ticks[0] - stepT).toFixed(10));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const m = { l: 52, r: 8, t: 12, b: 28 };
  const iw = Math.max(10, W - m.l - m.r), ih = height - m.t - m.b;
  const bw = iw / Math.max(1, data.length);
  const Y = (v: number) => m.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 56))));
  return (
    <div className="chart" ref={box}>
      {W > 0 && (
        <svg width={W} height={height} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={Y(t)} y2={Y(t)} className={t === 0 ? "zero" : "grid"} />
              <text x={m.l - 8} y={Y(t)} className="ax" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = m.l + i * bw, v = d.value;
            const last = i === data.length - 1;
            return (
              <g key={d.label} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={x} y={m.t} width={bw} height={ih} fill="transparent" />
                {isNum(v) && (
                  <rect x={x + bw * 0.16} width={bw * 0.68} y={Math.min(Y(v), Y(0))} height={Math.max(1, Math.abs(Y(v) - Y(0)))}
                    rx={Math.min(3, bw * 0.2)} fill={color} opacity={hover == null ? (last ? 1 : 0.62) : hover === i ? 1 : 0.42} />
                )}
                {(i % every === (data.length - 1) % every) && (
                  <text x={x + bw / 2} y={height - 8} className="ax" textAnchor="middle">{d.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && (
        <Tip x={m.l + hover * bw + bw / 2} y={m.t} w={W}>
          <div className="th">{data[hover].label}</div>
          <TipRow color={color} name={label} value={isNum(data[hover].value) ? fmt(data[hover].value as number) : "–"} />
          {data[hover].note && <div className="tnote">{data[hover].note}</div>}
        </Tip>
      )}
    </div>
  );
}
