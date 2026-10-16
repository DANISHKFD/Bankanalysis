import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { JumpTo } from "./components/JumpTo";
import { DATA, pageById } from "./pages";
import { useRoute } from "./router";
import { LenderPage, Overview, TopicPage } from "./views";

export function App() {
  const route = useRoute();
  const [jump, setJump] = useState(false);
  const page = pageById(route.page);
  const shown = page.available ? page : pageById("overview");

  // "/" (or Ctrl/Cmd+K) opens the jump-to search from anywhere except a text field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      const typing = t?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); setJump(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (shown.id !== "banks" && shown.id !== "nbfcs")
      document.title = shown.id === "overview" ? "India Banking Monitor" : `${shown.title} · India Banking Monitor`;
  }, [shown]);

  return (
    <>
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <Header current={shown.id} onJump={() => setJump(true)} />
      {shown.id === "overview" ? <Overview />
        : shown.id === "banks" || shown.id === "nbfcs" ? <LenderPage key={shown.id} page={shown} sym={route.sym} />
        : <TopicPage key={shown.id} page={shown} />}
      <footer className="wrap">
        Built {DATA.built} from RBI, MoSPI and NSE public data. Figures are provisional where the source says so. This is an analysis, not investment advice.
      </footer>
      {jump && <JumpTo onClose={() => setJump(false)} />}
    </>
  );
}
