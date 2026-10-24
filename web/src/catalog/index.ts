import { ECONOMY } from "./economy";
import { STRUCTURE } from "./structure";
import type { Stat, Topic } from "./types";

export const TOPICS: Topic[] = [...ECONOMY, ...STRUCTURE];
export const topic = (id: string) => TOPICS.find(t => t.id === id);
export const stat = (t: Topic, id?: string) => t.stats.find(s => s.id === id);

/** Navigation order: economy topics, then lenders, then reference. */
export const NAV: { id: string; title: string; group: "Economy" | "Lenders" | "Reference" }[] = [
  ...ECONOMY.map(t => ({ id: t.id, title: t.title, group: "Economy" as const })),
  ...STRUCTURE.filter(t => t.group === "Economy").map(t => ({ id: t.id, title: t.title, group: "Economy" as const })),
  { id: "banks", title: "Banks", group: "Lenders" },
  { id: "nbfcs", title: "NBFCs & HFCs", group: "Lenders" },
  { id: "valuations", title: "Valuations", group: "Lenders" },
  { id: "about", title: "About", group: "Reference" },
];

/** Run a stat's formatter safely: a missing field shows a dash instead of breaking the page. */
export function safe<T>(f: (() => T) | undefined, fallback: T): T {
  if (!f) return fallback;
  try { return f(); } catch { return fallback; }
}

export type { Stat, Topic };
