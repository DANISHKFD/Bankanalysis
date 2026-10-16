import { NAV_PAGES, PAGES, type PageId } from "../pages";
import { href } from "../router";

/** Previous / next page in reading order, so each page leads on to the next. */
export function Pager({ current }: { current: PageId }) {
  const order = [PAGES[0], ...NAV_PAGES];
  const i = order.findIndex(p => p.id === current);
  const prev = order[i - 1], next = order[i + 1];
  return (
    <nav className="pager" aria-label="Previous and next page">
      {prev && <a href={href(prev.id)}><span className="pl">← Previous</span><span className="pt">{prev.title}</span></a>}
      {next && <a className="next" href={href(next.id)}><span className="pl">Next →</span><span className="pt">{next.title}</span></a>}
    </nav>
  );
}
