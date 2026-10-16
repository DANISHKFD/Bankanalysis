"""Run the whole pipeline: fetch every source, rebuild the database and the report.

Each step runs as its own process so one failure (a site down, a layout change)
does not stop the rest; the report is rebuilt from whatever the database holds.
Output goes to logs/<timestamp>.log and a summary to logs/last_run.json.

Usage:
    python src/run_all.py              # everything
    python src/run_all.py --no-fetch   # rebuild from files already on disk

Scheduled daily by Windows Task Scheduler (see README, 'Automation').
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
LOGS = ROOT / "logs"
# steps run under the console interpreter even when this runner is started
# windowless by Task Scheduler (pythonw.exe); CREATE_NO_WINDOW keeps them hidden
PY = str(Path(sys.executable).with_name("python.exe"))
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
if sys.stdout is None:  # pythonw: no console to print to
    sys.stdout = open(os.devnull, "w")

FETCH = [
    ("RBI releases", ["fetch_rbi.py"]),
    ("CPI and repo rate", ["fetch_macro.py"]),
    ("Bank results (NSE)", ["fetch_results.py"]),
    ("NBFC results (NSE)", ["fetch_results.py", "--universe", "nbfcs"]),
    ("Share prices (NSE)", ["fetch_prices.py"]),
    ("RBI DBIE spatial tables", ["fetch_dbie.py"]),
    ("Investor presentations", ["fetch_presentations.py", "--keep", "1"]),
    ("Read presentations (Claude)", ["extract_presentations.py"]),
]
BUILD = [
    ("Parse RBI files", ["parse_rbi.py"]),
    ("Macro tables", ["macro.py"]),
    ("Spatial distribution", ["parse_spatial.py"]),
    ("BSR-1 annual tables", ["parse_bsr1.py"]),
    ("BSR-2 deposits", ["parse_bsr2.py"]),
    ("Parse bank results", ["parse_results.py"]),
    ("Bank metrics", ["bank_metrics.py"]),
    ("NBFC metrics", ["nbfc_metrics.py"]),
    ("Valuations", ["valuation.py"]),
    ("Build report", ["build_report.py"]),
]


def snapshot():
    """{relative path: (size, mtime)} of every input file under raw/."""
    return {str(p.relative_to(ROOT)): (p.stat().st_size, int(p.stat().st_mtime))
            for p in (ROOT / "raw").rglob("*")
            if p.is_file() and not p.name.startswith("_") and p.name != "pending_downloads.tsv"}


def run(name, args, log):
    t0 = time.time()
    log.write(f"\n===== {name}: {' '.join(args)}  [{datetime.now():%H:%M:%S}]\n")
    log.flush()
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.run([PY, "-I", str(SRC / args[0]), *args[1:]], cwd=ROOT, env=env,
                       stdout=log, stderr=subprocess.STDOUT, timeout=3600,
                       creationflags=NO_WINDOW)
    secs = round(time.time() - t0)
    status = "ok" if p.returncode == 0 else f"failed (exit {p.returncode})"
    log.write(f"----- {name}: {status} in {secs}s\n")
    print(f"{name:22s} {status:18s} {secs:4d}s")
    return {"step": name, "status": status, "seconds": secs}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-fetch", action="store_true")
    args = ap.parse_args()
    LOGS.mkdir(exist_ok=True)
    started = datetime.now()
    log_path = LOGS / f"{started:%Y-%m-%d_%H%M}.log"
    before = snapshot()
    results = []
    with log_path.open("w", encoding="utf-8") as log:
        for name, a in ([] if args.no_fetch else FETCH) + BUILD:
            try:
                results.append(run(name, a, log))
            except Exception as e:
                log.write(f"----- {name}: crashed: {e}\n")
                results.append({"step": name, "status": f"crashed: {e}", "seconds": None})
        after = snapshot()
        changed = sorted(k for k in after if before.get(k) != after[k])
        pending = (ROOT / "raw" / "rbi" / "pending_downloads.tsv")
        blocked = [l for l in pending.read_text(encoding="utf-8").splitlines() if l.strip()] \
            if pending.exists() else []
        log.write(f"\nNew or changed input files ({len(changed)}):\n" + "\n".join(changed) + "\n")
    summary = {
        "started": started.isoformat(timespec="seconds"),
        "finished": datetime.now().isoformat(timespec="seconds"),
        "log": str(log_path.relative_to(ROOT)),
        "steps": results,
        "new_or_changed_files": changed,
        "still_blocked_downloads": blocked,
        "ok": all(r["status"] == "ok" for r in results) and not blocked,
    }
    (LOGS / "last_run.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    print(f"\n{len(changed)} new/changed input file(s); "
          f"{len(blocked)} blocked download(s); log: {log_path.relative_to(ROOT)}")
    for c in changed[:30]:
        print("  +", c)
    sys.exit(0 if summary["ok"] else 1)


if __name__ == "__main__":
    main()
