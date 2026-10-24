import { useEffect, useState } from "react";
import { NAV } from "../catalog";

const dot = (id: string) => ({ ["--dot" as any]: `var(--t-${id})` });

function Mark() {
  // a small rupee-in-rosette mark
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="13.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="15" cy="15" r="10.5" fill="none" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.4 1.6" />
      <path d="M10.5 9.5h9M10.5 12.6h9M12 9.5c4.6 0 4.6 6.2 0 6.2h-1.5l6.5 5.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Theme = "auto" | "light" | "dark";
function useTheme(): [Theme, () => void] {
  const [t, set] = useState<Theme>(() => { try { return (localStorage.getItem("ibm-theme") as Theme) || "auto"; } catch { return "auto"; } });
  useEffect(() => {
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("ibm-theme", t); } catch { /* storage blocked */ }
  }, [t]);
  return [t, () => set(t === "auto" ? "light" : t === "light" ? "dark" : "auto")];
}

export function Header({ current, onSearch }: { current: string; onSearch: () => void }) {
  const [open, setOpen] = useState(false);
  const [theme, cycle] = useTheme();
  useEffect(() => setOpen(false), [current]);
  const groups = ["Economy", "Lenders", "Reference"] as const;
  return (
    <header className="mast">
      <div className="wrap mast-in">
        <a className="brand" href="#" aria-label="India Banking Monitor, home">
          <Mark />
          <span><b>India Banking Monitor</b><small>RBI · NSE · MoSPI data</small></span>
        </a>
        <nav className="nav" aria-label="Sections">
          {NAV.map((p, i) => (
            <span key={p.id} style={{ display: "contents" }}>
              {i > 0 && NAV[i - 1].group !== p.group && <span className="sep" aria-hidden="true" />}
              <a href={`#${p.id}`} style={dot(p.id)} aria-current={current === p.id ? "page" : undefined}><i />{p.title}</a>
            </span>
          ))}
        </nav>
        <div className="tools">
          <button type="button" className="ibtn" onClick={onSearch} aria-label="Search statistics and lenders">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span className="lbl">Search</span><kbd>/</kbd>
          </button>
          <button type="button" className="ibtn" onClick={cycle} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
            {theme === "dark"
              ? <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 107 7z" fill="currentColor" /></svg>
              : theme === "light"
                ? <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                : <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 2a6 6 0 010 12z" fill="currentColor" /></svg>}
            <span className="lbl">{theme === "auto" ? "Auto" : theme === "light" ? "Light" : "Dark"}</span>
          </button>
          <button type="button" className="ibtn menu-btn" aria-expanded={open} aria-controls="sheet" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      <div id="sheet" className="sheet" data-open={open}>
        <div className="wrap">
          {groups.map(g => (
            <div key={g}>
              <h4>{g}</h4>
              {NAV.filter(p => p.group === g).map(p => (
                <a key={p.id} href={`#${p.id}`} style={dot(p.id)} aria-current={current === p.id ? "page" : undefined}><i />{p.title}<span>→</span></a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
