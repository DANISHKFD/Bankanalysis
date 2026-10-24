import { isNum, type Pt } from "../data";

/** Small trend line with an emphasised last point. Decorative next to a number, so hidden from screen readers. */
export function Spark({ data, w = 120, h = 36, color = "var(--topic)" }: { data: Pt[]; w?: number; h?: number; color?: string }) {
  const pts = data.filter(p => isNum(p[1])) as [string, number][];
  if (pts.length < 2) return <svg width={w} height={h} aria-hidden="true" />;
  const vs = pts.map(p => p[1]);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const X = (i: number) => 2 + (i / (pts.length - 1)) * (w - 6);
  const Y = (v: number) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
  const lx = X(pts.length - 1), ly = Y(vs[vs.length - 1]);
  return (
    <svg width={w} height={h} aria-hidden="true" className="spark">
      <path d={`${d}V${h}H${X(0)}Z`} fill={color} opacity="0.1" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill={color} />
    </svg>
  );
}
