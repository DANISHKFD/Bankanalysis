"""Pull headline figures out of investor presentations with Claude, then verify them.

For each raw/presentations/<SYMBOL>/<date>.pdf without a <date>.json beside it:
  1. extract the text locally (pdfplumber), page by page
  2. send that text to Claude Code in headless mode (`claude -p`) with a fixed prompt asking for
     a small set of figures, each with the page number and an exact quote
  3. verify every figure: the quote must appear on that page of the extracted text and contain
     the number, and the value must be in a plausible range; failures are dropped, not guessed
  4. save <date>.json (raw answer + verified figures)

Figures (current quarter and the same quarter a year earlier, standalone where both are shown):
  banks:  casa_pct, gnpa_pct, nnpa_pct, pcr_pct
  NBFCs:  aum_cr, gnpa_pct (gross stage 3), nnpa_pct (net stage 3)

Each presentation is read once; later runs only process new files. Table written:
presentation_metrics (symbol, file, period_end, metric, value, prev_year, page, quote).

Usage:  python src/extract_presentations.py [SYMBOL ...] [--model sonnet]
"""
import argparse
import csv
import json
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PRES = ROOT / "raw" / "presentations"
DB = ROOT / "data" / "bank.db"
MAX_PAGES = 60
RANGES = {"casa_pct": (5, 80), "gnpa_pct": (0, 25), "nnpa_pct": (0, 15), "pcr_pct": (20, 100),
          "aum_cr": (500, 2_000_000)}
METRICS = {
    "bank": {"casa_pct": "CASA ratio (current + savings deposits as % of total deposits)",
             "gnpa_pct": "Gross NPA ratio %", "nnpa_pct": "Net NPA ratio %",
             "pcr_pct": "Provision coverage ratio % (say in the quote whether it includes technical write-offs)"},
    "nbfc": {"aum_cr": "Assets under management (AUM), in Rs crore (convert lakh crore / bn / mn to crore)",
             "gnpa_pct": "Gross stage 3 ratio % (Ind AS). If both stage 3 and an RBI-norm GNPA are shown, use stage 3",
             "nnpa_pct": "Net stage 3 ratio % (Ind AS). If both are shown, use stage 3"},
}
PROMPT = """You are extracting figures from the text of an Indian {kind} investor presentation ({name}).
The text is below, page by page, each page starting with a line '=== PAGE n ==='.

Return ONLY a JSON object, no prose:
{{"period_end": "YYYY-MM-DD (quarter the presentation reports)",
  "basis": "standalone" or "consolidated",
  "metrics": {{ "<metric>": {{"value": number, "prev_year": number or null, "page": n,
                "quote": "exact text copied from that page that contains the value"}} }} }}

Metrics to find:
{metrics}

Rules: use the figure for the latest quarter and, as prev_year, the same quarter one year earlier
if shown. Prefer standalone figures for the company itself, not subsidiaries or the group.
Copy quotes exactly (they are checked against the text). Omit a metric you cannot find rather
than guessing. Percentages as plain numbers (2.14 for 2.14%).

{text}"""


def universe():
    out = {}
    for f, kind in (("banks", "bank"), ("nbfcs", "nbfc")):
        with (ROOT / "raw" / "manual" / f"{f}.csv").open(encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                out[r["symbol"]] = (kind, r["name"])
    return out


def pdf_pages(path):
    with pdfplumber.open(path) as pdf:
        return [(p.extract_text() or "") for p in pdf.pages[:MAX_PAGES]]


def norm(s):
    return re.sub(r"[\s,₹]+", "", s or "").lower()


def verify(m, page_text, metric):
    """Keep a figure only if its quote is on the page and carries the number."""
    v = m.get("value")
    if not isinstance(v, (int, float)):
        return False
    lo, hi = RANGES[metric]
    if not lo <= v <= hi:
        return False
    q = norm(m.get("quote"))
    if not q or q not in norm(page_text):
        return False
    if "$" in (m.get("quote") or "") or "usd" in q:          # dollar figures are not rupee crore
        return False
    cands = {f"{v:g}", f"{v:,.0f}", f"{v:.2f}", f"{v:.1f}", f"{v:.0f}"}
    if metric == "aum_cr":   # the slide may state the amount in another unit than crore
        for f in (10, 100):                                    # Rs million, Rs lakh
            cands |= {f"{v * f:.0f}", f"{v * f:,.0f}"}
        for f in (100, 1e5):                                   # Rs billion, Rs lakh crore
            cands |= {f"{v / f:.0f}", f"{v / f:.1f}", f"{v / f:.2f}"}
    # a converted figure must still be a meaningful number (at least three digits), or tiny
    # strings like "0" or "4" would match almost any quote
    digits = lambda c: len(re.sub(r"\D", "", c))
    return any(norm(c) in q for c in cands if digits(c) >= (1 if metric != "aum_cr" else 3))


def claude_exe():
    import shutil
    found = shutil.which("claude")
    if found:
        return found
    local = Path.home() / ".local" / "bin" / "claude.exe"     # default install location on Windows
    return str(local) if local.exists() else "claude"


def ask_claude(prompt, model):
    p = subprocess.run([claude_exe(), "-p", "--output-format", "json", "--model", model, "--allowedTools", ""],
                       input=prompt, capture_output=True, text=True, encoding="utf-8", timeout=900,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))   # no console from the nightly task
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip()[:300] or p.stdout.strip()[:300])
    reply = json.loads(p.stdout).get("result", "")
    start = reply.find("{")
    if start < 0:
        raise RuntimeError(f"no JSON in reply: {reply[:200]}")
    obj, _ = json.JSONDecoder().raw_decode(reply[start:])     # first object; ignore anything after it
    return obj


def process(pdf, kind, name, model):
    pages = pdf_pages(pdf)
    if sum(len(t) for t in pages) < 2000:
        return {"status": "no text (scanned images or a cover letter only)", "metrics": {}}
    text = "\n".join(f"=== PAGE {i + 1} ===\n{t}" for i, t in enumerate(pages))
    metrics = "\n".join(f"- {k}: {d}" for k, d in METRICS[kind].items())
    raw = ask_claude(PROMPT.format(kind="bank" if kind == "bank" else "NBFC/housing finance company",
                                   name=name, metrics=metrics, text=text), model)
    kept, dropped = {}, {}
    for k, m in (raw.get("metrics") or {}).items():
        if k not in METRICS[kind] or not isinstance(m, dict):
            continue
        pg = m.get("page")
        ok = isinstance(pg, int) and 1 <= pg <= len(pages) and verify(m, pages[pg - 1], k)
        (kept if ok else dropped)[k] = m
    if kept.get("nnpa_pct") and kept.get("gnpa_pct") and kept["nnpa_pct"]["value"] > kept["gnpa_pct"]["value"]:
        dropped["nnpa_pct"] = kept.pop("nnpa_pct")
    return {"status": "ok", "period_end": raw.get("period_end"), "basis": raw.get("basis"),
            "metrics": kept, "dropped": dropped, "model": model}


def reverify():
    """Re-run the checks on saved answers (kept + dropped) without asking Claude again."""
    for j in sorted(PRES.glob("*/*.json")):
        d = json.loads(j.read_text(encoding="utf-8"))
        if d.get("status") != "ok":
            continue
        pages = pdf_pages(j.with_suffix(".pdf"))
        allm = {**d.get("dropped", {}), **d.get("metrics", {})}
        kept, dropped = {}, {}
        for k, m in allm.items():
            pg = m.get("page")
            ok = isinstance(pg, int) and 1 <= pg <= len(pages) and verify(m, pages[pg - 1], k)
            (kept if ok else dropped)[k] = m
        if kept.get("nnpa_pct") and kept.get("gnpa_pct") and kept["nnpa_pct"]["value"] > kept["gnpa_pct"]["value"]:
            dropped["nnpa_pct"] = kept.pop("nnpa_pct")
        if set(kept) != set(d.get("metrics", {})):
            print(f"{j.parent.name:11s} now kept: {sorted(kept)}; dropped: {sorted(dropped)}")
        d["metrics"], d["dropped"] = kept, dropped
        j.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def load_table():
    rows = []
    for j in sorted(PRES.glob("*/*.json")):
        d = json.loads(j.read_text(encoding="utf-8"))
        for k, m in d.get("metrics", {}).items():
            rows.append({"symbol": j.parent.name, "file": j.stem, "period_end": d.get("period_end"),
                         "basis": d.get("basis"), "metric": k, "value": m.get("value"),
                         "prev_year": m.get("prev_year"), "page": m.get("page"), "quote": m.get("quote")})
    if rows:
        import pandas as pd
        with sqlite3.connect(DB) as con:
            pd.DataFrame(rows).to_sql("presentation_metrics", con, if_exists="replace", index=False)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--reverify", action="store_true", help="re-check saved answers only (no Claude calls)")
    args = ap.parse_args()
    if args.reverify:
        reverify()
        print(f"presentation_metrics: {len(load_table())} verified figures")
        return
    uni = universe()
    for pdf in sorted(PRES.glob("*/*.pdf")):
        sym = pdf.parent.name
        if (args.symbols and sym not in args.symbols) or sym not in uni:
            continue
        out = pdf.with_suffix(".json")
        if out.exists():
            continue
        kind, name = uni[sym]
        try:
            res = process(pdf, kind, name, args.model)
        except Exception as e:
            if "usage_limit" in str(e) or "429" in str(e):   # stop for today; the rest run next time
                print(f"Claude usage limit reached; stopping. Remaining presentations are read on the next run.")
                break
            print(f"{sym:11s} {pdf.stem}: FAILED {str(e)[:200]}")
            continue
        out.write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")
        got = ", ".join(f"{k}={m['value']}" for k, m in res["metrics"].items())
        print(f"{sym:11s} {pdf.stem}: {res['status']}; {got}"
              + (f"; dropped {list(res.get('dropped', {}))}" if res.get("dropped") else ""))
    rows = load_table()
    print(f"presentation_metrics: {len(rows)} verified figures")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
