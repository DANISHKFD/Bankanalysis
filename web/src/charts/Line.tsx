import { useMemo, useState } from "react";
import { isNum, monthShort, month, type Series } from "../data";
import { ms, niceTicks, PAL, spread, Tip, TipRow, useWidth } from "./util";

type Ref = { y: number; label: string };
type Mark = { date: string; label: string };

/**
 * Time-series line chart. One series gets a soft area fill; several get end labels and a legend.
 * Hover (or touch) shows a crosshair with every series' value at that date.
 */
export function Line({ series, fmt, height = 300, zero = false, refs = [], marks = [], step = false, label }: {
  series: Series[]; fmt: (v: number) => string; height?: number; zero?: boolean; refs?: Ref[]; marks?: Mark[]; step?: boolean; label: string;
}) {
  const [box, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const multi = series.length > 1;
  const S = series.map((s, i) => ({ ...s, color: s.color || (multi ? PAL[i] : "var(--topic)") }));
  const narrow = W < 520;
  const endLab = multi && !narrow;

  const geo = useMemo(() => {
    const dates = [...new Set(S.flatMap(s => s.data.map(p => p[0])))].sort();
    const vals = S.flatMap(s => s.data.map(p => p[1]).filter(isNum)).concat(refs.map(r => r.y));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const pad = (hi - lo) * 0.08 || 1;
    if (!zero || lo < 0) lo -= pad;
    hi += pad;
    const ticks = niceTicks(lo, hi, height < 240 ? 4 : 5);
    return { dates, lo: Math.min(lo, ticks[0]), hi: Math.max(hi, ticks[ticks.length - 1]), ticks };
  }, [series, refs, zero, height]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = { l: 46, r: endLab ? 128 : 14, t: 14, b: 30 };
  const iw = Math.max(10, W - m.l - m.r), ih = height - m.t - m.b;
  const t0 = ms(geo.dates[0] || "2000-01-01"), t1 = ms(geo.dates[geo.dates.length - 1] || "2000-01-01");
  const X = (d: string) => m.l + (t1 === t0 ? iw / 2 : ((ms(d) - t0) / (t1 - t0)) * iw);
  const Y = (v: number) => m.t + ih - ((v - geo.lo) / (geo.hi - geo.lo)) * ih;

  const gaps = geo.dates.slice(1).map((d, i) => ms(d) - ms(geo.dates[i])).sort((a, b) => a - b);
  const usual = gaps.length ? gaps[Math.floor(gaps.length / 2)] : Infinity;
  const path = (data: Series["data"]) => {
    let d = "", pen = false, prevY = 0, prevT = 0;
    for (const [x, v] of data) {
      if (!isNum(v)) { pen = false; continue; }
      const px = X(x), py = Y(v);
      if (pen && ms(x) - prevT > usual * 2.5) pen = false;
      prevT = ms(x);
      if (!pen) d += `M${px.toFixed(1)},${py.toFixed(1)}`;
      else d += step ? `H${px.toFixed(1)}V${py.toFixed(1)}` : `L${px.toFixed(1)},${py.toFixed(1)}`;
      pen = true; prevY = py;
    }
    void prevY;
    return d;
  };

  // x ticks: spread evenly back from the latest date, at least ~80px apart
  const spanYears = (t1 - t0) / 3.15e10;
  const maxTicks = Math.max(2, Math.floor(iw / 84));
  const stepN = Math.max(1, Math.ceil(geo.dates.length / maxTicks));
  const xt: string[] = [];
  for (let i = geo.dates.length - 1; i >= 0; i -= stepN) xt.unshift(geo.dates[i]);
  const tickLab = (d: string) => (spanYears > 5 ? d.slice(0, 4) : monthShort(d));

  const lastPts = S.map(s => [...s.data].reverse().find(p => isNum(p[1])));
  const labYs = endLab ? spread(lastPts.map(p => (p ? Y(p[1] as number) : 0)), 15, m.t, m.t + ih) : [];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = 0, bd = Infinity;
    geo.dates.forEach((d, i) => { const dd = Math.abs(X(d) - x); if (dd < bd) { bd = dd; best = i; } });
    setHover(best);
  };
  const hd = hover != null ? geo.dates[hover] : null;

  return (
    <div className="chart" ref={box}>
      {multi && narrow && (
        <div className="legend">{S.map(s => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      )}
      {W > 0 && (
        <svg width={W} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={`g-${label.replace(/\W/g, "")}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={S[0].color} stopOpacity="0.22" />
              <stop offset="1" stopColor={S[0].color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {geo.ticks.map(t => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={Y(t)} y2={Y(t)} className={t === 0 ? "zero" : "grid"} />
              <text x={m.l - 8} y={Y(t)} className="ax" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
            </g>
          ))}
          {xt.map((d, i) => (
            <text key={d} x={X(d)} y={height - 8} className="ax" textAnchor={i === xt.length - 1 ? "end" : i === 0 && X(d) - m.l < 30 ? "start" : "middle"}>{tickLab(d)}</text>
          ))}
          {marks.map(mk => (
            <g key={mk.date + mk.label} className="mark">
              <line x1={X(mk.date)} x2={X(mk.date)} y1={m.t} y2={m.t + ih} />
            </g>
          ))}
          {refs.map(r => (
            <g key={r.label}>
              <line x1={m.l} x2={m.l + iw} y1={Y(r.y)} y2={Y(r.y)} className="ref" />
              <text x={m.l + 4} y={Y(r.y) - 5} className="ax reflab">{r.label}</text>
            </g>
          ))}
          {!multi && (() => {
            const d = path(S[0].data);
            const pts = S[0].data.filter(p => isNum(p[1]));
            if (!pts.length) return null;
            const base = Y(Math.max(geo.lo, Math.min(0, geo.hi)) > geo.lo ? Math.max(geo.lo, 0) : geo.lo);
            return <path d={`${d}V${base}H${X(pts[0][0])}Z`} fill={`url(#g-${label.replace(/\W/g, "")})`} stroke="none" />;
          })()}
          {S.map(s => (
            <path key={s.name} d={path(s.data)} fill="none" stroke={s.color} strokeWidth={multi ? 2 : 2.4} strokeDasharray={s.dash ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {S.map((s, i) => lastPts[i] && (
            <circle key={s.name} cx={X(lastPts[i]![0])} cy={Y(lastPts[i]![1] as number)} r={4} fill={s.color} className="endpt" />
          ))}
          {endLab && S.map((s, i) => lastPts[i] && (
            <text key={s.name} x={m.l + iw + 10} y={labYs[i]} dominantBaseline="middle" className="endlab">
              <tspan className="ev">{fmt(lastPts[i]![1] as number)}</tspan>
              <tspan dx="6" className="en">{s.name.length > 13 ? s.name.slice(0, 12) + "…" : s.name}</tspan>
            </text>
          ))}
          {hd && (
            <g>
              <line x1={X(hd)} x2={X(hd)} y1={m.t} y2={m.t + ih} className="cross" />
              {S.map(s => { const p = s.data.find(q => q[0] === hd); return p && isNum(p[1]) ? <circle key={s.name} cx={X(hd)} cy={Y(p[1])} r={4.5} fill={s.color} className="hdot" /> : null; })}
            </g>
          )}
        </svg>
      )}
      {hd && (
        <Tip x={X(hd)} y={m.t} w={W}>
          <div className="th">{month(hd)}</div>
          {S.map(s => { const p = s.data.find(q => q[0] === hd); return p && isNum(p[1]) ? <TipRow key={s.name} color={s.color} name={s.name} value={fmt(p[1])} /> : null; })}
          {marks.filter(mk => mk.date.slice(0, 7) === hd.slice(0, 7)).map(mk => <div key={mk.label} className="tnote">{mk.label}</div>)}
        </Tip>
      )}
    </div>
  );
}
