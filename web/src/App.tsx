import { useEffect, useLayoutEffect, useState } from "react";
import { stat, topic } from "./catalog";
import { lenders, metrics } from "./catalog/lenders";
import { Header } from "./components/Header";
import { Search } from "./components/Search";
import { D, day, unslug } from "./data";
import { AboutPage, ABOUT } from "./pages/About";
import { Home } from "./pages/Home";
import { Directory, LenderPage, NotFound, Ranking } from "./pages/Lenders";
import { StatPage } from "./pages/StatPage";
import { TopicPage } from "./pages/TopicPage";
import { useRoute } from "./router";

const SITE = "India Banking Monitor";

export function App() {
  const r = useRoute();
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      const typing = t?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); setSearch(true); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  // new page: start at the top and move focus to the content for screen readers
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    setSearch(false);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [r.a, r.b]);

  let page: JSX.Element, current = r.a, title = SITE;
  const t = topic(r.a);
  if (!r.a) { page = <Home />; current = ""; }
  else if (t) {
    const s = stat(t, r.b);
    if (r.b && !s) page = <NotFound what={`There is no page called “${r.b}” under ${t.title}.`} back={`#${t.id}`} />;
    else if (s) { page = <StatPage t={t} s={s} />; title = `${s.card} · ${t.title} · ${SITE}`; }
    else { page = <TopicPage t={t} />; title = `${t.title} · ${SITE}`; }
  } else if (r.a === "banks" || r.a === "nbfcs") {
    const kind = r.a === "banks" ? "bank" : "nbfc";
    const m = r.b ? metrics(kind).find(x => x.id === r.b) : undefined;
    if (m) { page = <Ranking kind={kind} m={m} />; title = `${m.label} ranked · ${SITE}`; }
    else { page = <Directory kind={kind} />; title = `${kind === "bank" ? "Banks" : "NBFCs & HFCs"} · ${SITE}`; }
  } else if ((r.a === "bank" || r.a === "nbfc") && r.b) {
    const sym = unslug(r.b);
    current = r.a === "bank" ? "banks" : "nbfcs";
    page = <LenderPage kind={r.a} sym={sym} />;
    const l = lenders(r.a).find(x => x.symbol === sym);
    title = `${l?.name || sym} · ${SITE}`;
  } else if (r.a === "about") {
    page = <AboutPage id={r.b || ""} />;
    title = `${(ABOUT.find(a => a.id === (r.b || "")) || ABOUT[0]).title} · ${SITE}`;
  } else page = <NotFound what={`Nothing lives at “#${r.a}”.`} back="#" />;

  useEffect(() => { document.title = title; }, [title]);

  return (
    <>
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <Header current={current} onSearch={() => setSearch(true)} />
      {page}
      <footer className="site">
        <div className="wrap">
          <span>Rebuilt {day(D.built?.slice(0, 10))} from RBI, NSE and MoSPI public data. Not investment advice.</span>
          <span><a href="#about">About</a> · <a href="#about.data">How it's built</a> · <a href="#about.compare">Indus vs this monitor</a></span>
        </div>
      </footer>
      {search && <Search onClose={() => setSearch(false)} />}
    </>
  );
}
