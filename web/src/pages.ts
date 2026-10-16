import type { ComponentType } from "react";
import { fm, n0, n1, n2 } from "./legacy/core";
import {
  renderCards, renderCredit, renderFunding, renderRates, renderRegions, renderSources, renderStructure, renderValuations,
} from "./legacy/sections";
import * as M from "./legacy/markup";

const D = window.__IBM_DATA__;

export type PageId =
  | "overview" | "credit" | "deposits" | "rates" | "payments" | "regions" | "structure"
  | "banks" | "nbfcs" | "valuations" | "sources";

export type Point = [string, number | null];

export interface Figure { value: string; unit: string; caption: string }

export interface PageDef {
  id: PageId;
  title: string;
  group: "Economy" | "Lenders" | "Reference";
  source: string;
  asOf: string;
  /** one-line finding shown in the overview ledger */
  summary: string;
  figure?: Figure;
  spark?: Point[];
  Head?: ComponentType;
  Body?: ComponentType;
  render?: () => void;
  available: boolean;
}

const last = <T,>(a: T[]): T => a[a.length - 1];
const series = (a: Point[] | undefined, n = 36): Point[] => (a || []).filter(p => p[1] != null).slice(-n);
const yr = (label: string): string => `20${label.slice(-2)}-03-31`;   // "Mar-25" -> 2025-03-31

function bankQuarter(): string {
  const counts: Record<string, number> = {};
  Object.values(D.banks?.q || {}).forEach((rows: any) => { const l = last(rows as any[])?.label; if (l) counts[l] = (counts[l] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

const cr = D.credit, fu = D.funding, ra = D.rates, ca = D.cards;
const metro = D.spatial?.credit_share?.Metropolitan as Point[] | undefined;
const casa = (D.bsr2?.casa_pop?.["All India"] || []) as Point[];
const mcap = (D.val?.rows || []).reduce((s: number, r: any) => s + (r.mcap || 0), 0);

export const PAGES: PageDef[] = [
  { id: "overview", title: "Overview", group: "Reference", source: "RBI · NSE · MoSPI", asOf: fm(D.built), summary: "", available: true },
  {
    id: "credit", title: "Credit", group: "Economy", source: "RBI sectoral deployment of bank credit", asOf: fm(cr.month),
    summary: "Who banks are lending to, and how fast each sector's borrowing is growing.",
    figure: { value: n1(cr.total.yoy), unit: "%", caption: "credit growth, year on year" },
    spark: series(cr.real.nominal), Head: M.CreditHead, Body: M.CreditBody, render: renderCredit, available: true,
  },
  {
    id: "deposits", title: "Deposits", group: "Economy", source: "RBI Scheduled Banks' Statement of Position", asOf: fm(fu.month),
    summary: "Deposit growth against credit growth, and how banks fund the gap.",
    figure: { value: n1(fu.latest.cd_ratio), unit: "%", caption: "credit-to-deposit ratio" },
    spark: series(fu.cd), Head: M.FundingHead, Body: M.FundingBody, render: renderFunding, available: true,
  },
  {
    id: "rates", title: "Rates", group: "Economy", source: "RBI lending and deposit rates · MPC", asOf: fm(ra.month),
    summary: "How much of the repo cut has reached borrowers and depositors.",
    figure: { value: n2(ra.latest_by_group["All SCBs"].walr_fresh), unit: "%", caption: "rate on new loans" },
    spark: series(ra.scb_lines["Lending rate, new loans"], 48), Head: M.RatesHead, Body: M.RatesBody, render: renderRates, available: true,
  },
  {
    id: "payments", title: "Payments", group: "Economy", source: "RBI bank-wise ATM, PoS and card statistics", asOf: fm(ca.month),
    summary: "Credit and debit cards, card spend, ATMs, PoS terminals and UPI QR codes by bank.",
    figure: { value: n2(last(ca.totals as any[]).credit_cards / 1e7), unit: "cr", caption: "credit cards outstanding" },
    spark: (ca.totals as any[]).map(t => [t.month, t.credit_cards / 1e7] as Point), Head: M.CardsHead, Body: M.CardsBody, render: renderCards, available: true,
  },
  {
    id: "regions", title: "Regions", group: "Economy", source: "RBI spatial distribution of deposits and credit", asOf: D.spatial ? fm(D.spatial.last) : "",
    summary: "Rural, semi-urban, urban and metro branches, and every state's credit and deposits.",
    figure: metro ? { value: n1(100 - (last(metro)[1] as number)), unit: "%", caption: "of credit lent outside metros" } : undefined,
    spark: metro ? metro.map(([d, v]) => [d, v == null ? null : 100 - v] as Point) : undefined,
    Head: M.RegionsHead, Body: M.RegionsBody, render: renderRegions, available: !!D.spatial,
  },
  {
    id: "structure", title: "Structure", group: "Economy", source: "RBI annual BSR-1 and BSR-2", asOf: D.bsr1 ? fm(D.bsr1.as_of) : "",
    summary: "A decade of where loans go, who borrows, what they pay, and where deposits come from.",
    figure: casa.length ? { value: n1(last(casa)[1]), unit: "%", caption: "CASA share of deposits" } : undefined,
    spark: casa.length ? casa : (D.bsr1_hist?.pop_rows || []).map((r: any) => [yr(r.label), r.values.Metropolitan] as Point),
    Head: M.StructureHead, Body: M.StructureBody, render: renderStructure, available: !!(D.bsr1 && D.bsr1.dims && D.bsr1.dims["Interest rate"]),
  },
  {
    id: "banks", title: "Banks", group: "Lenders", source: "NSE XBRL results, standalone", asOf: bankQuarter(),
    summary: "Quarterly results for each bank since FY21, and a peer table to compare them.",
    figure: { value: n0(D.banks?.banks?.length || 0), unit: "", caption: `banks, latest ${bankQuarter()}` },
    Head: M.BanksHead, Body: M.BanksBody, available: !!(D.banks && D.banks.banks.length),
  },
  {
    id: "nbfcs", title: "NBFCs & HFCs", group: "Lenders", source: "NSE XBRL results, Ind AS standalone", asOf: bankQuarter(),
    summary: "Non-bank lenders and housing finance companies: income, credit cost and returns.",
    figure: { value: n0(D.nbfcs?.cos?.length || 0), unit: "", caption: "NBFCs and HFCs" },
    Head: M.NbfcsHead, Body: M.NbfcsBody, available: !!(D.nbfcs && D.nbfcs.cos.length),
  },
  {
    id: "valuations", title: "Valuations", group: "Lenders", source: "NSE closing prices", asOf: D.val ? fm(D.val.date) : "",
    summary: "What the market pays for each lender's book and earnings.",
    figure: mcap ? { value: n1(mcap / 1e5), unit: "lakh cr", caption: "market value of all lenders" } : undefined,
    Head: M.ValuationsHead, Body: M.ValuationsBody, render: renderValuations, available: !!(D.val && D.val.rows.length),
  },
  {
    id: "sources", title: "Sources", group: "Reference", source: "Method and caveats", asOf: fm(D.built),
    summary: "Where every number comes from, what to watch out for, and how the data refreshes.",
    Head: M.SourcesHead, Body: M.SourcesBody, render: renderSources, available: true,
  },
];

export const pageById = (id: PageId): PageDef => PAGES.find(p => p.id === id)!;
export const NAV_PAGES = PAGES.filter(p => p.id !== "overview" && p.available);
export const DATA = D;
