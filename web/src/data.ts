/** Report data injected by src/build_report.py, plus number and date formatting used everywhere. */
export const D: any = window.__IBM_DATA__ || {};

export type Pt = [string, number | null];
export type Series = { name: string; data: Pt[]; color?: string; dash?: boolean };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-01" -> "Aug 2026" */
export function month(iso?: string | null): string {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MON[+m - 1]} ${y}`;
}
/** "2026-08-01" -> "Aug 26" (axis ticks) */
export function monthShort(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MON[+m - 1]} ${y.slice(2)}`;
}
/** "2026-03-31" -> "Mar 2026" for quarter ends; same as month() */
export const qtr = month;
export function day(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${+d} ${MON[+m - 1]} ${y}`;
}

export const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);

export function n(v: number | null | undefined, dp = 1): string {
  if (!isNum(v)) return "–";
  return v.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
export const pct = (v: number | null | undefined, dp = 1) => (isNum(v) ? `${n(v, dp)}%` : "–");
export const signed = (v: number | null | undefined, dp = 1, unit = "") =>
  isNum(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${n(Math.abs(v), dp)}${unit}` : "–";

/** Rupees in crore, shortened to lakh crore when large: 2112345 -> "₹21.1 lakh cr" */
export function cr(v: number | null | undefined, dp = 1): string {
  if (!isNum(v)) return "–";
  if (Math.abs(v) >= 1e5) return `₹${n(v / 1e5, dp)} lakh cr`;
  return `₹${n(v, 0)} cr`;
}
/** Counts: 124053544 -> "12.4 crore", 2100000 -> "21 lakh" */
export function count(v: number | null | undefined, dp = 1): string {
  if (!isNum(v)) return "–";
  if (Math.abs(v) >= 1e7) return `${n(v / 1e7, dp)} crore`;
  if (Math.abs(v) >= 1e5) return `${n(v / 1e5, dp)} lakh`;
  return n(v, 0);
}

export const last = <T,>(a: T[] | undefined | null): T | undefined => (a && a.length ? a[a.length - 1] : undefined);
export const lastVal = (s: Pt[] | undefined) => {
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) if (isNum(s[i][1])) return s[i];
  return null;
};
/** Value of a series a year before its last point (or nearest earlier). */
export function yearAgo(s: Pt[]): Pt | null {
  const l = lastVal(s);
  if (!l) return null;
  const [y, m, d] = l[0].split("-");
  const target = `${+y - 1}-${m}-${d}`;
  let best: Pt | null = null;
  for (const p of s) if (p[0] <= target && isNum(p[1])) best = p;
  return best && best[0].slice(0, 7) === target.slice(0, 7) ? best : null;
}
export function median(a: number[]): number | null {
  const v = a.filter(isNum).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Hash tokens may only use letters, digits, . _ ~ - ; tickers like J&KBANK become J_KBANK. */
export const slug = (sym: string) => sym.replace(/&/g, "_");
export const unslug = (s: string) => s.replace(/_/g, "&");
