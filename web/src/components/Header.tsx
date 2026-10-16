import { useEffect, useState } from "react";
import { redrawAll } from "../legacy/core";
import { NAV_PAGES, type PageDef, type PageId } from "../pages";
import { href } from "../router";

type Mode = "auto" | "light" | "dark";
const MODES: Mode[] = ["auto", "light", "dark"];
const GROUPS: PageDef["group"][] = ["Economy", "Lenders", "Reference"];

function readMode(): Mode {
  try { const m = localStorage.getItem("ibm-theme"); return MODES.includes(m as Mode) ? (m as Mode) : "auto"; } catch { return "auto"; }
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", mode);
  redrawAll();   // redraw so computed colours follow the theme
}

export function Header({ current, onJump }: { current: PageId; onJump: () => void }) {
  const [mode, setMode] = useState<Mode>(readMode);
  const [menu, setMenu] = useState(false);
  useEffect(() => { applyMode(mode); }, [mode]);
  useEffect(() => { setMenu(false); }, [current]);

  const cycle = () => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    try { localStorage.setItem("ibm-theme", next); } catch { /* storage blocked: theme still applies for this visit */ }
    setMode(next);
  };
  const link = (p: PageDef, cls: string) => (
    <a key={p.id} className={cls} href={href(p.id)} aria-current={p.id === current ? "page" : undefined}>{p.title}</a>
  );

  return (
    <header className="bar">
      <div className="wrap bar-in">
        <a className="mark" href="#overview" aria-current={current === "overview" ? "page" : undefined}>India Banking Monitor</a>
        <nav className="nav" aria-label="Pages">
          {GROUPS.slice(0, 2).map(g => (
            <div className="navgroup" key={g}>
              <span className="glabel">{g}</span>
              {NAV_PAGES.filter(p => p.group === g).map(p => link(p, "navlink"))}
            </div>
          ))}
          <div className="navgroup">{NAV_PAGES.filter(p => p.group === "Reference").map(p => link(p, "navlink"))}</div>
        </nav>
        <div className="bar-tools">
          <button className="jump-btn" type="button" onClick={onJump} aria-label="Jump to a page, bank or chart">
            <span aria-hidden="true">⌕</span><span className="jl">Search</span><kbd>/</kbd>
          </button>
          <button className="icon-btn" type="button" onClick={cycle} aria-label={`Colour theme: ${mode}. Change theme`}>
            {mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark"}
          </button>
          <button className="icon-btn menu-btn" type="button" aria-expanded={menu} aria-controls="page-menu" onClick={() => setMenu(m => !m)}>
            {menu ? "Close" : "Pages"}
          </button>
        </div>
      </div>
      {menu && (
        <nav className="menu" id="page-menu" aria-label="Pages">
          <div className="wrap menu-grid">
            {GROUPS.map(g => (
              <div key={g}>
                <h2>{g}</h2>
                {g === "Reference" && <a href="#overview" aria-current={current === "overview" ? "page" : undefined}>Overview</a>}
                {NAV_PAGES.filter(p => p.group === g).map(p => link(p, ""))}
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
