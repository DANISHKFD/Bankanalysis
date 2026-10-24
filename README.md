# India Banking Monitor

Analysis of Indian scheduled commercial banks built from RBI and MoSPI public data,
modelled on (and extending) the reports at indusequity.com/reports.html.

## Pipeline

Python: `D:\programs\python.exe` (packages: pandas, openpyxl, requests, lxml, pdfplumber,
playwright + `python -m playwright install chromium`).

**One command runs everything:** `python src/run_all.py`. The steps below are what it runs, in order.

| Step | Command | Output |
|---|---|---|
| 1. New RBI releases | `python src/fetch_rbi.py` | `raw/rbi/<dataset>/`; files behind rbidocs' bot check are fetched with headless Chromium; anything still blocked is listed in `raw/rbi/pending_downloads.tsv` |
| 2. CPI and repo rate | `python src/fetch_macro.py` | new MoSPI CPI release PDFs parsed into `raw/manual/cpi_2024base_headline.csv`; repo-rate changes read from rbi.org.in appended to `raw/manual/repo_rate.csv` |
| 3. Parse RBI data | `python src/parse_rbi.py` | `data/bank.db` |
| 4. Macro series | `python src/macro.py` | `cpi`, `repo_rate`, `repo_monthly` tables |
| 5. Bank results | `python src/fetch_results.py` then `parse_results.py`, `bank_metrics.py` | `raw/nse/<SYMBOL>/*.xml` → `results_facts`, `bank_quarter`, `bank_q_metrics`, `bank_fy_metrics` |
| 5b. NBFC / HFC results | `python src/fetch_results.py --universe nbfcs`, then `parse_results.py`, `nbfc_metrics.py` | `nbfc_quarter`, `nbfc_q_metrics`, `nbfc_fy_metrics` |
| 5c. Share prices and valuations | `python src/fetch_prices.py`, then `valuation.py` | `raw/nse/bhav/<date>.csv` (NSE daily closes) → `valuation`, `valuation_hist` |
| 5d. Rural / urban / metro split | `python src/fetch_dbie.py`, then `parse_spatial.py` | `raw/rbi/dbie/*.xlsx` (RBI DBIE exports) → `spatial_state`, `spatial_growth` |
| 5e. Annual BSR-1 credit structure | `fetch_dbie.py` (same run), then `parse_bsr1.py` | `raw/rbi/dbie/bsr1_*.xlsx` → `bsr1_dist` (interest rate, loan size, borrower, state, population group; latest March, incl. RRBs) |
| 5f. BSR-1 history (2015 on) | `fetch_dbie.py` downloads each year's volume zip to `raw/rbi/dbie/bsr_vol/` | `bsr1_popbank` (population group x bank group), `bsr1_rates_hist` (interest-rate bands) |
| 5g. BSR-2 deposits (2015 on) | `fetch_dbie.py` (tables 2.1, 2.2, 2.10 with every year selected), then `parse_bsr2.py` | `bsr2_deposits`: deposits by population group x bank group x current / saving / term, CASA share |
| 5h. Investor presentations | `fetch_presentations.py --keep 1`, then `extract_presentations.py` | `raw/presentations/<SYM>/<date>.pdf` + `.json` → `presentation_metrics` (CASA, PCR; AUM, stage 3) |
| 6. Report | `python src/build_report.py` | `reports/india_banking_monitor.html`, `reports/report_data.json` |
| 7. Website | `python src/publish_site.py` | force-pushes a one-commit `gh-pages` branch, served at https://danishkfd.github.io/Bankanalysis/ (skipped when unchanged) |

Bank results come from NSE's standalone quarterly XBRL filings (old results format to Dec 2024,
SEBI Integrated Filing from Mar 2025). The bank list is `raw/manual/banks.csv`. Quarters NSE's
archive no longer holds are listed in `raw/nse/<SYMBOL>/_missing.tsv`; where possible they are
rebuilt from year-to-date figures (`derived` flag). Banks tag RoA either per quarter or annualised,
and a few tag CET1 100x too small; `bank_metrics.py` normalises both.

NBFCs and HFCs (the 36 companies Indus Equity covers, listed in `raw/manual/nbfcs.csv` with notes on
holding companies and mergers) file the Ind AS format: income by type, finance costs, impairment on
financial instruments, and a Sep/Mar balance sheet. They tag no NPA ratios, so credit cost
(impairment / loans) stands in for asset quality. Some older filings used SEBI's generic company
template with no impairment line; impairment there is estimated from untagged expenses
(`impairment_est`). Full-year figures come from the March filing's audited year-to-date numbers.
Checked against Indus Equity's Bajaj Finance and Shriram Finance snapshots: every line matches for
Q4 FY26 and FY26.

Valuations use NSE's daily bhavcopy. Market cap = close × shares from the latest filing, with
splits and bonuses since then detected from NSE's adjusted previous close; P/B = market cap / latest
net worth; P/E = market cap / last four quarters' profit (no per-share figures needed).

The rural / semi-urban / urban / metro split comes from RBI's quarterly 'Spatial Distribution of
Deposits and Credit' on DBIE (data.rbi.org.in), Statements 1 and 3A (SCBs excl. RRBs, Mar-2023 on).
DBIE serves tables only through a SAP BusinessObjects viewer, so `fetch_dbie.py` drives it in headless
Chromium and uses the viewer's Excel export (re-exported when the file is over a week old). Shares
match Indus Equity's annual BSR-1 figures within 0.1 pp for March 2026.

BSR-1 summary tables 1.1-1.11 (latest March) come through the same exporter. The BSR-1 district-level
time series (`bsr1_ts`, 2010 onward) is excluded from the default run: its first export ran the PC low
on memory. A later run with a RAM watchdog showed memory was not the issue (peak 0.8 GB): RBI's server
does not finish an Excel export of all years at district level (the report itself says to export at most
two years). History therefore comes from the yearly 'Basic Statistical Returns of SCBs - Vol NN' zips
(every BSR-1 table as Excel; Vol 44 = March 2015), which download directly. Their figures are in Rs million
up to 2018 and Rs crore from 2019; `parse_bsr1.py` finds tables by title because numbering changed in 2019.
Population-group shares excluding RRBs match Indus Equity exactly (e.g. metro 65.9% in 2015, 60.3% in 2025).

BSR-2 deposit reports on DBIE open on the latest year only; `fetch_dbie.py` ticks 'All' in their Quarter
filter before exporting, giving March 2019 onward. 2015-2018 deposits come from the combined BSR 1&2
volumes. March 2026 deposit shares excluding RRBs match Indus Equity exactly (metro 54.65%, rural 9.08%).

`python src/analysis.py` prints a text summary of every analysis.

## Data

| Folder | Source | Frequency |
|---|---|---|
| `raw/rbi/sibc` | Sectoral Deployment of Bank Credit | monthly |
| `raw/rbi/rates` | Lending and Deposit Rates of SCBs (latest file holds full history) | monthly |
| `raw/rbi/cards` | Bank-wise ATM/POS/Card Statistics | monthly |
| `raw/rbi/sop` | Scheduled Banks' Statement of Position (month-end editions) | fortnightly |
| `raw/rbi/bsr1`, `bsr2` | BSR credit / deposit press releases (summary only) | quarterly |
| `raw/mospi` | CPI press releases (base 2024) and API cache (base 2012) | monthly |
| `raw/manual` | CPI 2026 headline figures and repo-rate decisions, typed from official releases | as released |

Caveats are stored in the `data_notes` table and shown on the report.

## Website

The UI is a React + TypeScript app in `web/` (Vite, single-file build). Every statistic, lender and lender ranking has its own page,
addressed by a bare hash token: `#credit.real-growth`, `#bank.HDFCBANK`, `#banks.gnpa` (tickers with `&` use `_`, e.g. `#bank.J_KBANK`).
Statistics are defined in `web/src/catalog/` (one entry = one page: headline value, sentence, charts, meaning, formula, source);
lender metrics in `web/src/catalog/lenders.ts`. After changing the UI run `npm run release` in `web/`, which rebuilds
`src/report_app.html` (the template the nightly run fills with data, so the nightly run needs no Node).

GitHub Pages must serve the `gh-pages` branch (Settings → Pages → Branch: gh-pages, / (root)).

## Automation

Windows Task Scheduler task **BankAnalysis daily** runs
`D:\programs\python.exe -I D:\Projects\Bankanalysis\src\run_all.py` every day at 19:30
(catching up after the PC was off). Each run writes `logs/<timestamp>.log` and `logs/last_run.json`
(steps, new files, blocked downloads). The local report `reports/india_banking_monitor.html` is
rebuilt every run; the claude.ai artifact is refreshed from it in an interactive Claude Code session
(headless `claude -p` has no artifact tool).

Manage it from PowerShell: `Start-ScheduledTask "BankAnalysis daily"` (run now),
`Get-ScheduledTaskInfo "BankAnalysis daily"` (last result), `Unregister-ScheduledTask "BankAnalysis daily"` (remove).

Still manual: `raw/manual/banks.csv` (bank universe) and the repo-rate history before automation.

## Not yet covered

- Loan mix and branch counts (presentations are read only for CASA, PCR, AUM and stage 3 so far)
- History before the current-year RBI listings (older months need the year filter on RBI's pages)

## Investor presentations

`fetch_presentations.py` downloads each company's latest 'Investor Presentation' filing from NSE
(or the results press release when the filing is only a cover letter). `extract_presentations.py`
sends each new file's text to Claude Code in headless mode (`claude -p --model sonnet`), once per file,
and keeps a figure only if its quoted text appears on the cited page and contains the number (allowing
for Rs million / lakh / billion / lakh crore) and the value is in range. `--reverify` re-checks saved
answers without new Claude calls. Bank NPA ratios read this way match the XBRL filings exactly.
It stops for the day when Claude's usage limit is reached; unread files are picked up next run.
