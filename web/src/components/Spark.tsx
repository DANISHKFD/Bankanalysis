import type { Point } from "../pages";

/** Small trend line for the overview ledger: one series, area wash, dot on the latest value. */
export function Spark({ data, label }: { data: Point[]; label: string }) {
  const pts = data.filter((p): p is [string, number] => p[1] != null);
  if (pts.length < 2) return null;
  const W = 150, H = 38, pad = 4;
  const t = pts.map(p => Date.parse(p[0])), v = pts.map(p => p[1]);
  const t0 = Math.min(...t), t1 = Math.max(...t), v0 = Math.min(...v), v1 = Math.max(...v);
  const x = (k: number) => pad + ((t[k] - t0) / (t1 - t0 || 1)) * (W - pad * 2);
  const y = (k: number) => H - pad - ((v[k] - v0) / (v1 - v0 || 1)) * (H - pad * 2);
  const line = pts.map((_, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(k).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${H}L${x(0).toFixed(1)},${H}Z`;
  const n = pts.length - 1;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <path className="sa" d={area} />
      <path className="sl" d={line} />
      <circle className="sd" cx={x(n)} cy={y(n)} r={3.5} />
    </svg>
  );
}
