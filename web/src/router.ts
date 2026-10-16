import { useSyncExternalStore } from "react";
import type { PageId } from "./pages";

/** Hash routes are bare tokens (#credit, #bank-HDFCBANK) so a shared artifact link can deep-link to them. */
export interface Route { page: PageId; sym?: string }

const PAGE_IDS: PageId[] = ["overview", "credit", "deposits", "rates", "payments", "regions", "structure", "banks", "nbfcs", "valuations", "sources"];
// anchors from the old single-page report keep working
const LEGACY: Record<string, PageId> = {
  summary: "overview", funding: "deposits", cards: "payments", spatial: "regions", bsr1: "structure", valuation: "valuations", notes: "sources",
};

export function parse(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#/, ""));
  if (h.startsWith("bank-")) return { page: "banks", sym: h.slice(5) };
  if (h.startsWith("nbfc-")) return { page: "nbfcs", sym: h.slice(5) };
  if ((PAGE_IDS as string[]).includes(h)) return { page: h as PageId };
  return { page: LEGACY[h] || "overview" };
}

export const href = (page: PageId, sym?: string): string =>
  sym ? `#${page === "banks" ? "bank" : "nbfc"}-${sym}` : page === "overview" ? "#overview" : `#${page}`;

let pendingAnchor: string | null = null;
/** Go to a page; optionally scroll to the card holding the element with this id once it renders. */
export function navigate(to: string, anchor?: string) {
  if (location.hash === to || (to === "#overview" && !location.hash)) { if (anchor) scrollToAnchor(anchor); else window.scrollTo({ top: 0 }); return; }
  pendingAnchor = anchor || null;
  location.hash = to;
}

/** Scroll the card that contains element #id into view and briefly outline it. */
export function scrollToAnchor(id: string) {
  const card = document.getElementById(id)?.closest(".card") as HTMLElement | null;
  if (!card) return;
  card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  card.classList.add("flash");
  window.setTimeout(() => card.classList.remove("flash"), 1400);
}
export function takeAnchor(): string | null { const a = pendingAnchor; pendingAnchor = null; return a; }

const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parse(hash);
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
