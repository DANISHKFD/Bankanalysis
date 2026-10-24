import { useEffect, useState } from "react";

/**
 * Hash routes are bare tokens so a shared artifact link can deep-link (only letters, digits, . _ ~ - survive):
 *   #credit            topic hub          #credit.real-growth   one statistic
 *   #banks             lender directory   #bank.HDFCBANK        one lender    #banks.gnpa   one metric ranked across lenders
 *   #about.sources     about pages
 */
export type Route = { a: string; b?: string };

const LEGACY: Record<string, string> = {
  overview: "", summary: "", funding: "deposits", cards: "payments", spatial: "regions", bsr1: "structure",
  valuation: "valuations", notes: "about.sources", sources: "about.sources",
};

export function parse(hash = location.hash): Route {
  let t = decodeURIComponent(hash.replace(/^#/, ""));
  if (t in LEGACY) t = LEGACY[t];
  const m = t.match(/^(bank|nbfc)-(.+)$/);
  if (m) t = `${m[1]}.${m[2]}`;
  const i = t.indexOf(".");
  return i < 0 ? { a: t } : { a: t.slice(0, i), b: t.slice(i + 1) };
}

export const href = (a: string, b?: string) => (a ? `#${a}${b ? "." + b : ""}` : "#");

export function useRoute(): Route {
  const [r, set] = useState(parse);
  useEffect(() => {
    const on = () => set(parse());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return r;
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
