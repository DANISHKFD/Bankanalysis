import type { ReactNode } from "react";
import type { Pt } from "../data";

export type Tone = "up" | "down" | "flat";

/** One statistic = one page. */
export type Stat = {
  id: string;
  title: string;          // page title, a plain question or noun phrase
  card: string;           // short label on cards
  value: () => string;    // headline figure, already formatted
  unit?: string;          // small text after the figure
  asOf: () => string;     // "Aug 2026"
  delta?: () => { text: string; tone: Tone } | null;
  spark?: () => Pt[];
  lede: () => string;     // one data-driven sentence saying what the number shows now
  what: string;           // what it means, in plain words
  how: string;            // how it is worked out
  source: string;         // where the data comes from
  Body: () => ReactNode;  // charts and tables
};

export type Topic = {
  id: string;
  title: string;
  group: "Economy" | "Lenders";
  blurb: string;          // one line on the hub card
  intro: string;          // paragraph on the hub page
  source: string;
  stats: Stat[];
};
