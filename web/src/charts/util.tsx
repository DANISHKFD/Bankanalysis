import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Width of a container, kept current with ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= count + 0.5) || 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) || 1);

/** Floating tooltip positioned inside a chart box; flips to stay within it. */
export function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = x > w * 0.6;
  return (
    <div className="ctip" style={{ top: Math.max(0, y), ...(left ? { right: w - x + 14 } : { left: x + 14 }) }} role="status">
      {children}
    </div>
  );
}

export function TipRow({ color, name, value, strong }: { color?: string; name: string; value: string; strong?: boolean }) {
  return (
    <div className={`trow${strong ? " strong" : ""}`}>
      {color && <i style={{ background: color }} />}
      <span>{name}</span>
      <b>{value}</b>
    </div>
  );
}

/** Push labels apart vertically so none overlap (min gap px), keeping order. */
export function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const idx = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const out = idx.map(([y]) => y);
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  const over = out.length ? out[out.length - 1] - hi : 0;
  if (over > 0) for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], (i === out.length - 1 ? hi : out[i + 1] - gap));
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], lo + i * 0);
  const res = new Array(ys.length);
  idx.forEach(([, i], k) => (res[i] = out[k]));
  return res;
}

/** Categorical series palette (fixed order, never cycled past 8). */
export const PAL = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];
