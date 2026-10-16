// Page bodies carried over from the single-page report. Ids are filled by sections.ts.
/* eslint-disable */

export const CreditHead = () => (
    <div className="block-head">
      <div className="eyebrow">Sectoral deployment of bank credit</div>
      <h1>Credit growth has almost doubled in a year</h1>
      <ul className="takeaways" id="tk-credit"></ul>
    </div>
);

export const CreditBody = () => (
  <>
    <div className="grid">
      <div className="card two3"><h2>Growth by sector: a year ago vs now</h2><p className="cap" id="cap-dumb"></p><div className="legend" id="lg-dumb"></div><div className="chart" id="c-dumb"></div></div>
      <div className="card third"><h2>Share of credit vs share of the year's new credit</h2><p className="cap">Sectors whose bar for new credit is longer than their stock bar are gaining share.</p><div className="legend" id="lg-incr"></div><div className="chart" id="c-incr"></div></div>
      <div className="card"><h2>YoY credit growth by major sector</h2><p className="cap">Monthly, % change on a year earlier. The gap is the months not covered by the releases downloaded so far.</p><div className="legend" id="lg-secyoy"></div><div className="chart" id="c-secyoy"></div></div>
      <div className="card"><h2>Real credit growth</h2><p className="cap">Bank credit growth minus CPI inflation. CPI moved to a new 2024 base from January 2026.</p><div className="legend" id="lg-real"></div><div className="chart" id="c-real"></div></div>
      <div className="card wide"><h2>Industry: growth by sub-sector (share of industry credit ≥ 1%)</h2><p className="cap" id="cap-ind"></p><div className="legend" id="lg-ind"></div><div className="chart" id="c-ind"></div></div>
    </div>
  </>
);

export const FundingHead = () => (
    <div className="block-head">
      <div className="eyebrow">Scheduled Banks' Statement of Position</div>
      <h1>Loans are running ahead of deposits</h1>
      <ul className="takeaways" id="tk-funding"></ul>
    </div>
);

export const FundingBody = () => (
  <>
    <div className="grid">
      <div className="card"><h2>Credit growth vs deposit growth</h2><p className="cap">YoY %, month-end. Year-ago figures before December 2025 use the old fortnight dates.</p><div className="legend" id="lg-gr"></div><div className="chart" id="c-gr"></div></div>
      <div className="card"><h2>Credit-to-deposit ratio</h2><p className="cap">Stock ratio, and the incremental ratio: new credit over new deposits in the past 12 months.</p><div className="legend" id="lg-cd"></div><div className="chart" id="c-cd"></div></div>
      <div className="card wide"><h2>Balance-sheet mix</h2><p className="cap">Demand deposits (current and savings) as a share of deposits, and government securities held as a share of deposits.</p><div className="legend" id="lg-mix"></div><div className="chart" id="c-mix"></div></div>
    </div>
  </>
);

export const RatesHead = () => (
    <div className="block-head">
      <div className="eyebrow">Lending and deposit rates · RBI policy</div>
      <h1>Repo-linked loans repriced; MCLR loans barely moved</h1>
      <ul className="takeaways" id="tk-rates"></ul>
    </div>
);

export const RatesBody = () => (
  <>
    <div className="grid">
      <div className="card wide"><h2>Policy repo vs bank lending and deposit rates</h2><p className="cap">All scheduled commercial banks, weighted average %, monthly since 2019.</p><div className="legend" id="lg-rl"></div><div className="chart" id="c-rl"></div></div>
      <div className="card two3"><h2>How much of the repo cut has passed through</h2><p className="cap" id="cap-tr"></p><div className="legend" id="lg-tr"></div><div className="chart" id="c-tr"></div></div>
      <div className="card third"><h2>What floating-rate loans are priced off</h2><p className="cap" id="cap-bm"></p><div className="legend" id="lg-bm"></div><div className="chart" id="c-bm"></div></div>
      <div className="card"><h2>Share of loans linked to the repo (EBLR)</h2><p className="cap">External-benchmark loans reprice within a quarter of a repo change; MCLR loans reprice at their reset date.</p><div className="legend" id="lg-eblr"></div><div className="chart" id="c-eblr"></div></div>
      <div className="card"><h2>Real interest rates</h2><p className="cap">Lending rate on outstanding loans and rate on new term deposits, minus CPI inflation.</p><div className="legend" id="lg-real-r"></div><div className="chart" id="c-real-r"></div></div>
      <div className="card"><h2>Lending-deposit spread</h2><p className="cap">Lending rate minus term deposit rate, percentage points. A rough gauge of bank margins.</p><div className="legend" id="lg-spr"></div><div className="chart" id="c-spr"></div></div>
      <div className="card"><h2>Rate on new loans by sector</h2><p className="cap" id="cap-secr"></p><div className="chart" id="c-secr"></div></div>
      <div className="card wide"><h2>Bank-wise 1-year MCLR</h2><p className="cap" id="cap-mclr"></p><div className="filters" id="f-mclr" role="group" aria-label="Filter banks"></div><div className="tbl-wrap" id="t-mclr" style={{ maxHeight: "440px" }}></div></div>
    </div>
  </>
);

export const CardsHead = () => (
    <div className="block-head">
      <div className="eyebrow">Bank-wise ATM, PoS and card statistics</div>
      <h1>Four issuers hold seven in ten credit cards</h1>
      <ul className="takeaways" id="tk-cards"></ul>
    </div>
);

export const CardsBody = () => (
  <>
    <div className="grid">
      <div className="card"><h2>Share of credit cards vs share of card spend</h2><p className="cap" id="cap-share"></p><div className="legend" id="lg-share"></div><div className="chart" id="c-share"></div></div>
      <div className="card"><h2>Spend per card vs number of cards</h2><p className="cap">Monthly spend per card outstanding (PoS, online and other), issuers with 5 lakh+ cards.</p><div className="chart" id="c-scatter"></div></div>
      <div className="card third"><h2>Credit cards outstanding</h2><p className="cap">Crore cards, all banks.</p><div className="chart" id="c-cc"></div></div>
      <div className="card third"><h2>Monthly credit card spend</h2><p className="cap">₹ thousand crore, all banks.</p><div className="chart" id="c-spend"></div></div>
      <div className="card third"><h2>Market concentration</h2><p className="cap">Herfindahl index (0–10,000). Below 1,500 counts as unconcentrated.</p><div className="legend" id="lg-hhi"></div><div className="chart" id="c-hhi"></div></div>
      <div className="card wide"><h2>Who runs India's card and payment infrastructure</h2><p className="cap" id="cap-grp"></p><div className="legend" id="lg-grp"></div><div className="chart" id="c-grp"></div></div>
      <div className="card wide"><h2>Credit card issuers</h2><p className="cap" id="cap-iss"></p><div className="tbl-wrap" id="t-iss" style={{ maxHeight: "440px" }}></div></div>
      <div className="card wide"><h2>Debit cards: purchases vs cash withdrawals</h2><p className="cap">₹ thousand crore a month, all banks. Purchases are PoS, online and other spend; cash is ATM withdrawals.</p><div className="legend" id="lg-dc"></div><div className="chart" id="c-dc"></div></div>
      <div className="card third"><h2>UPI QR codes</h2><p className="cap">Crore QR codes deployed by banks.</p><div className="chart" id="c-qr"></div></div>
      <div className="card third"><h2>PoS terminals</h2><p className="cap" id="cap-pos">Lakh card terminals.</p><div className="chart" id="c-pos"></div></div>
      <div className="card third"><h2>ATMs</h2><p className="cap">Thousand ATMs, on-site and off-site.</p><div className="chart" id="c-atm"></div></div>
      <div className="card wide"><h2>Debit cards, QR codes and acceptance by bank</h2><p className="cap" id="cap-dci"></p><div className="tbl-wrap" id="t-dci" style={{ maxHeight: "440px" }}></div></div>
    </div>
  </>
);

export const RegionsHead = () => (
    <div className="block-head">
      <div className="eyebrow">Spatial distribution · RBI quarterly, by place of branch</div>
      <h1 id="h-spatial">Rural, semi-urban, urban and metro banking</h1>
      <ul className="takeaways" id="tk-spatial"></ul>
    </div>
);

export const RegionsBody = () => (
  <>
    <div className="grid">
      <div className="card two3"><h2>Share of credit and deposits by population group</h2><p className="cap" id="cap-sp-share"></p><div className="legend" id="lg-sp-share"></div><div className="chart" id="c-sp-share"></div></div>
      <div className="card third"><h2>Credit-to-deposit ratio</h2><p className="cap">Credit as % of deposits raised by branches in each population group.</p><div className="legend" id="lg-sp-cd"></div><div className="chart" id="c-sp-cd"></div></div>
      <div className="card"><h2>Credit growth by population group</h2><p className="cap">YoY %, as published by RBI.</p><div className="legend" id="lg-sp-cg"></div><div className="chart" id="c-sp-cg"></div></div>
      <div className="card"><h2>Deposit growth by population group</h2><p className="cap">YoY %, as published by RBI.</p><div className="legend" id="lg-sp-dg"></div><div className="chart" id="c-sp-dg"></div></div>
      <div className="card wide"><h2>Credit growth by bank group</h2><p className="cap">YoY %, scheduled commercial banks excluding regional rural banks.</p><div className="legend" id="lg-sp-bg"></div><div className="chart" id="c-sp-bg"></div></div>
      <div className="card wide"><h2>States and union territories</h2><p className="cap" id="cap-sp-st"></p><div className="filters" id="f-sp-st" role="group" aria-label="Filter regions"></div><div className="tbl-wrap" id="t-sp-st" style={{ maxHeight: "560px" }}></div></div>
    </div>
  </>
);

export const StructureHead = () => (
    <div className="block-head">
      <div className="eyebrow" id="eb-bsr1">Annual BSR-1 · RBI</div>
      <h1>How bank credit and deposits are structured</h1>
      <ul className="takeaways" id="tk-bsr1"></ul>
    </div>
);

export const StructureBody = () => (
  <>
    <div className="grid">
      <div className="card two3"><h2>Where bank credit goes: population group, every March</h2><p className="cap" id="cap-bsrh-pop"></p><div className="legend" id="lg-bsrh-pop"></div><div className="chart" id="c-bsrh-pop"></div></div>
      <div className="card third"><h2>Share of loans charged below 9%</h2><p className="cap">% of loans and advances by amount, every March. Tracks the policy-rate cycle.</p><div className="chart" id="c-bsrh-r9"></div></div>
      <div className="card"><h2>Bank group shares of credit</h2><p className="cap">% of all scheduled commercial bank credit, every March, including regional rural banks.</p><div className="legend" id="lg-bsrh-bg"></div><div className="chart" id="c-bsrh-bg"></div></div>
      <div className="card"><h2>Where PSU and private banks lend</h2><p className="cap" id="cap-bsrh-w"></p><div className="legend" id="lg-bsrh-w"></div><div className="chart" id="c-bsrh-w"></div></div>
      <div className="card two3"><h2>Where deposits come from: population group, every March</h2><p className="cap" id="cap-bsr2-pop"></p><div className="legend" id="lg-bsr2-pop"></div><div className="chart" id="c-bsr2-pop"></div></div>
      <div className="card third"><h2>CASA share of deposits by population group</h2><p className="cap">Current and savings deposits as % of total, every March, including regional rural banks.</p><div className="legend" id="lg-bsr2-cp"></div><div className="chart" id="c-bsr2-cp"></div></div>
      <div className="card wide"><h2>CASA share of deposits by bank group</h2><p className="cap">Current and savings deposits as % of each bank group's deposits, every March.</p><div className="legend" id="lg-bsr2-cb"></div><div className="chart" id="c-bsr2-cb"></div></div>
      <div className="card"><h2>Loans by interest rate</h2><p className="cap">Share of loan amount and of number of loans in each rate band. Excludes bills purchased and discounted.</p><div className="legend" id="lg-bsr-ir"></div><div className="chart" id="c-bsr-ir"></div></div>
      <div className="card"><h2>Loans by size of credit limit</h2><p className="cap">Share of amount outstanding and of number of accounts by sanctioned limit.</p><div className="legend" id="lg-bsr-sz"></div><div className="chart" id="c-bsr-sz"></div></div>
      <div className="card"><h2>Credit by bank group</h2><p className="cap">Share of amount outstanding and of loan accounts, including regional rural banks.</p><div className="legend" id="lg-bsr-bg"></div><div className="chart" id="c-bsr-bg"></div></div>
      <div className="card"><h2>Credit by type of account</h2><p className="cap">Share of amount and of accounts; types under 0.5% of credit are grouped as other.</p><div className="legend" id="lg-bsr-ac"></div><div className="chart" id="c-bsr-ac"></div></div>
      <div className="card wide"><h2>Who borrows</h2><p className="cap" id="cap-bsr-org"></p><div className="legend" id="lg-bsr-org"></div><div className="chart" id="c-bsr-org"></div></div>
    </div>
  </>
);

export const BanksHead = () => (
    <div className="block-head">
      <div className="eyebrow">Quarterly results · NSE XBRL filings, standalone</div>
      <h1>Bank results and snapshots</h1>
      <p>Pick a bank for its quarterly results since FY21, or compare all banks in the peer table below.</p>
    </div>
);

export const BanksBody = () => (
  <>
    <div className="bank-bar">
      <label htmlFor="bank-sel">Bank</label>
      <select id="bank-sel"></select>
      <span className="bank-meta" id="bank-meta"></span>
    </div>
    <ul className="takeaways" id="tk-bank"></ul>
    <div className="tiles" id="bank-tiles"></div>
    <div className="grid">
      <div className="card two3"><h2>Net interest income, operating profit and net profit</h2><p className="cap">₹ crore per quarter. Operating profit is before provisions and tax.</p><div className="legend" id="lg-b-pl"></div><div className="chart" id="c-b-pl"></div></div>
      <div className="card third"><h2>Deposits and advances</h2><p className="cap">₹ lakh crore, from the half-yearly balance sheet (Sep and Mar).</p><div className="legend" id="lg-b-bs"></div><div className="chart" id="c-b-bs"></div></div>
      <div className="card third"><h2>Asset quality</h2><p className="cap">Gross and net NPAs, % of advances.</p><div className="legend" id="lg-b-npa"></div><div className="chart" id="c-b-npa"></div></div>
      <div className="card third"><h2>Efficiency</h2><p className="cap">Cost-to-income, and provisions as a share of operating profit, %.</p><div className="legend" id="lg-b-eff"></div><div className="chart" id="c-b-eff"></div></div>
      <div className="card third"><h2>Returns and capital</h2><p className="cap">Return on assets (annualised) and CET1 ratio, %.</p><div className="legend" id="lg-b-ret"></div><div className="chart" id="c-b-ret"></div></div>
      <div className="card wide"><h2>Result snapshot</h2><p className="cap" id="cap-b-tbl"></p><div className="tbl-wrap" id="t-bank" style={{ maxHeight: "none" }}></div></div>
      <div className="card wide"><h2>Peer comparison</h2><p className="cap" id="cap-peer"></p><div className="filters" id="f-peer" role="group" aria-label="Filter bank groups"></div><div className="tbl-wrap" id="t-peer" style={{ maxHeight: "560px" }}></div></div>
    </div>
  </>
);

export const NbfcsHead = () => (
    <div className="block-head">
      <div className="eyebrow">Quarterly results · NSE XBRL filings, standalone</div>
      <h1>NBFC and HFC results and snapshots</h1>
      <p>Non-bank lenders and housing finance companies covered by Indus Equity. Their filings use the Ind AS format and carry no NPA ratios, so asset quality is shown as credit cost: impairment charges against loans.</p>
    </div>
);

export const NbfcsBody = () => (
  <>
    <div className="bank-bar">
      <label htmlFor="nbfc-sel">Company</label>
      <select id="nbfc-sel"></select>
      <span className="bank-meta" id="nbfc-meta"></span>
    </div>
    <ul className="takeaways" id="tk-nbfc"></ul>
    <div className="tiles" id="nbfc-tiles"></div>
    <div className="grid">
      <div className="card two3"><h2>Income, net interest income and net profit</h2><p className="cap">₹ crore per quarter. Net interest income is interest earned minus finance costs.</p><div className="legend" id="lg-n-pl"></div><div className="chart" id="c-n-pl"></div></div>
      <div className="card third"><h2>Loans and net worth</h2><p className="cap">₹ thousand crore, from the half-yearly balance sheet (Sep and Mar).</p><div className="legend" id="lg-n-bs"></div><div className="chart" id="c-n-bs"></div></div>
      <div className="card third"><h2>Credit cost</h2><p className="cap">Impairment on financial instruments, annualised, % of loans on the latest balance sheet.</p><div className="chart" id="c-n-cc"></div></div>
      <div className="card third"><h2>Efficiency</h2><p className="cap">Operating cost over net total income (total income minus finance costs), %.</p><div className="legend" id="lg-n-eff"></div><div className="chart" id="c-n-eff"></div></div>
      <div className="card third"><h2>Returns</h2><p className="cap">Quarterly profit annualised, % of total assets and of net worth on the latest balance sheet.</p><div className="legend" id="lg-n-ret"></div><div className="chart" id="c-n-ret"></div></div>
      <div className="card wide"><h2>Result snapshot</h2><p className="cap" id="cap-n-tbl"></p><div className="tbl-wrap" id="t-nbfc" style={{ maxHeight: "none" }}></div></div>
      <div className="card wide"><h2>Peer comparison</h2><p className="cap" id="cap-npeer"></p><div className="filters" id="f-npeer" role="group" aria-label="Filter company groups"></div><div className="tbl-wrap" id="t-npeer" style={{ maxHeight: "560px" }}></div></div>
    </div>
  </>
);

export const ValuationsHead = () => (
    <div className="block-head">
      <div className="eyebrow">Valuations · NSE closing prices</div>
      <h1 id="h-val">What the market pays for each lender</h1>
      <ul className="takeaways" id="tk-val"></ul>
    </div>
);

export const ValuationsBody = () => (
  <>
    <div className="grid">
      <div className="card wide"><h2>Price-to-book against return on equity</h2><p className="cap" id="cap-val-sc"></p><div className="legend" id="lg-val-sc"></div><div className="chart" id="c-val-sc"></div></div>
      <div className="card wide"><h2>Market capitalisation and multiples</h2><p className="cap" id="cap-val"></p><div className="filters" id="f-val" role="group" aria-label="Filter lender groups"></div><div className="tbl-wrap" id="t-val" style={{ maxHeight: "560px" }}></div></div>
    </div>
  </>
);

export const SourcesHead = () => (
    <div className="block-head">
      <div className="eyebrow">Sources &amp; method</div>
      <h1>Where every number comes from</h1>
    </div>
);

export const SourcesBody = () => (
  <>
    <div className="notes">
      <div className="card"><h2>Data sources</h2><ul>
        <li><b>Sectoral deployment of bank credit</b>: RBI monthly release (SIBC return, banks covering ~95% of non-food credit).</li>
        <li><b>Deposits and credit totals</b>: RBI fortnightly Scheduled Banks' Statement of Position, month-end editions.</li>
        <li><b>Lending and deposit rates, MCLR, benchmark mix</b>: RBI monthly Lending and Deposit Rates of SCBs.</li>
        <li><b>Cards, ATMs, PoS, QR codes</b>: RBI Bank-wise ATM/POS/Card Statistics.</li>
        <li><b>CPI inflation</b>: MoSPI API (base 2012, to Dec 2025) and MoSPI/PIB monthly releases (base 2024, from Jan 2026).</li>
        <li><b>Repo rate</b>: RBI Monetary Policy Committee decisions.</li>
        <li><b>Rural, semi-urban, urban and metro split; states</b>: RBI quarterly Spatial Distribution of Deposits and Credit (DBIE, Statements 1 and 3A), SCBs excluding regional rural banks, from March 2023.</li>
        <li><b>CASA, AUM, stage 3 and coverage ratios</b>: companies' quarterly investor presentations filed on NSE (a results press release where the presentation is only on the company website). Figures are read by Claude and kept only when the quoted text is found on the cited page and the value is in a plausible range.</li>
        <li><b>Share prices</b>: NSE daily bhavcopy (closing prices) for market cap, price-to-book and P/E.</li>
        <li><b>Bank, NBFC and HFC results</b>: standalone quarterly financial results filed with NSE in XBRL (old results format to Dec 2024, SEBI Integrated Filing from Mar 2025). NBFCs and HFCs file the Ind AS format.</li>
      </ul></div>
      <div className="card"><h2>Caveats</h2><ul id="caveats"></ul></div>
      <div className="card"><h2>Refreshing the data</h2><ul>
        <li><code>{"python src/run_all.py"}</code> runs everything: new RBI releases (through a headless browser where RBI's file server blocks scripts), CPI releases and repo rate, NSE results for banks and NBFCs, then the database and this page.</li>
        <li>A Windows scheduled task runs it every evening; each run's summary is in <code>{"logs/last_run.json"}</code>.</li>
        <li>Not yet included: loan mix and branch counts for banks, and product mix for NBFCs. CASA, AUM and stage 3 ratios come from investor presentations, so a lender shows them only once its latest deck has been read.</li>
      </ul></div>
    </div>
  </>
);
