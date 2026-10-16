// @ts-nocheck -- page renderers carried over from the single-page report.
// Each function fills the DOM ids of one page (see markup.tsx) and registers its charts.
import { C, MON, NS, SHORT, barsH, barsV, barsVG, bps, charts, clearCharts, dataTable, dumbbell, edgeText, el, fitText, fm, fms, hideTip, lakhCr, legend, li, lin, lineChart, n0, n1, n2, niceTicks, pct, pd, pp, register, scatter, sgn, showTip, sname, sortTable, stacked, tip } from "./core";

const D = window.__IBM_DATA__;
const cr = D.credit, fu = D.funding, ra = D.rates, ca = D.cards;
const trans = Object.fromEntries(ra.transmission.filter(t => t.group === "All SCBs").map(t => [t.measure, t]));
const lastDec = ra.decisions[ra.decisions.length - 1];
const VAL = Object.fromEntries(((D.val && D.val.rows) || []).map(r => [r.symbol, r]));
const PRES = D.pres || {};
const presLine = (sym, kind) => {
  const m = PRES[sym]; if (!m) return null;
  const f = (k, fmt) => m[k] ? `${fmt(m[k].value)}${m[k].prev != null ? ` (a year earlier ${fmt(m[k].prev)})` : ""}` : null;
  const src = Object.values(m)[0], when = src.period_end ? fm(src.period_end) : "";
  const pg = k => m[k] && m[k].page ? `p.${m[k].page}` : "";
  const parts = kind === "bank"
    ? [m.casa_pct && `CASA ratio ${f("casa_pct", v => n1(v) + "%")} [${pg("casa_pct")}]`, m.pcr_pct && `provision coverage ${f("pcr_pct", v => n1(v) + "%")} [${pg("pcr_pct")}]`]
    : [m.aum_cr && `AUM ₹${n0(m.aum_cr.value)} cr${m.aum_cr.prev ? ` (${sgn(m.aum_cr.value / m.aum_cr.prev * 100 - 100)}${n1(Math.abs(m.aum_cr.value / m.aum_cr.prev * 100 - 100))}% YoY)` : ""} [${pg("aum_cr")}]`,
       m.gnpa_pct && `gross stage 3 ${f("gnpa_pct", v => n2(v) + "%")} [${pg("gnpa_pct")}]`, m.nnpa_pct && `net stage 3 ${f("nnpa_pct", v => n2(v) + "%")} [${pg("nnpa_pct")}]`];
  const t = parts.filter(Boolean);
  return t.length ? `From the ${when} investor presentation${src.basis ? ` (${src.basis})` : ""}: ${t.join("; ")}.` : null;
};
const valLine = sym => {
  const v = VAL[sym]; if (!v || v.mcap == null) return null;
  const when = new Date(D.val.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `Market cap ₹${n0(v.mcap)} cr on ${when}${v.chg == null ? "" : ` (${sgn(v.chg)}${n1(Math.abs(v.chg))}% on a year earlier)`}: ${n2(v.pb)}× book${v.pe == null ? "" : `, ${n1(v.pe)}× trailing earnings`}.`;
};


export function tilesData() {
  const tiles = [
  { label: "Bank credit growth", value: n1(cr.total.yoy), unit: "%", chip: [pp(cr.total.yoy - cr.total.yoy_prev) + " vs a year ago", cr.total.yoy >= cr.total.yoy_prev ? "up" : "down"], sub: `YoY, ${fm(cr.month)} · ${lakhCr(cr.total.outstanding_cr)}` },
  { label: "Deposit growth", value: n1(fu.latest.deposit_yoy), unit: "%", chip: [pp(fu.latest.deposit_yoy - fu.latest.credit_yoy) + " vs credit", fu.latest.deposit_yoy >= fu.latest.credit_yoy ? "up" : "down"], sub: `YoY, ${fm(fu.month)} · ${lakhCr(fu.latest.deposits)}` },
  { label: "Credit-to-deposit ratio", value: n1(fu.latest.cd_ratio), unit: "%", chip: [`Incremental ${n0(fu.latest.incr_cd_ratio)}%`, fu.latest.incr_cd_ratio > 100 ? "down" : "flat"], sub: `${fm(fu.month)}, all SCBs` },
  { label: "Lending rate, new loans", value: n2(ra.latest_by_group["All SCBs"].walr_fresh), unit: "%", chip: [bps(trans.walr_fresh.change_bps) + " since Jan ’25", "flat"], sub: `Weighted average, ${fm(ra.month)}` },
  { label: "Policy repo rate", value: n2(lastDec.repo_rate), unit: "%", chip: [lastDec.change_bps > 0 ? `+${lastDec.change_bps} bps on ${fm(lastDec.effective_date)}` : "unchanged", "flat"], sub: "RBI Monetary Policy Committee" },
];
tiles.push({ label: "Real credit growth", value: n1(cr.real.real[cr.real.real.length - 1][1]), unit: "%", chip: [`CPI ${n2(cr.real.cpi[cr.real.cpi.length - 1][1])}%`, "flat"], sub: `${fm(cr.real.real[cr.real.real.length - 1][0])}; credit growth minus inflation` });
  return tiles;
}

export function heroHeadline() {
  const g = cr.total.yoy, g0 = cr.total.yoy_prev, ratio = g / g0;
  const pace = ratio >= 1.8 ? "almost twice as fast as" : ratio >= 1.25 ? "much faster than" : ratio > 1.02 ? "faster than" : ratio < 0.98 ? "slower than" : "about as fast as";
  const outrun = fu.latest.credit_yoy > fu.latest.deposit_yoy + 1;
  return `Bank credit is growing ${pace} a year ago${outrun ? ", and loans are outrunning deposits" : ""}`;
}

export function renderCredit() {
  const main = Object.fromEntries(cr.main.map(r => [r.code, r]));
  const subs = cr.subs;
  const byCode = c => subs.find(s => s.code === c) || {};
  const fastest = [...subs].filter(s => s.share_pct > 1).sort((a, b) => b.yoy_now - a.yoy_now).slice(0, 3);
  const gainers = [...subs].map(s => ({ ...s, tilt: s.incr_share_pct - s.share_pct })).sort((a, b) => b.tilt - a.tilt);
  li("tk-credit", [
    `Bank credit was ${lakhCr(cr.total.outstanding_cr)} in ${fm(cr.month)}, up ${pct(cr.total.yoy)} on a year earlier, against ${pct(cr.total.yoy_prev)} growth in the year before that.`,
    `Every major sector accelerated: services ${pct(main["3"].yoy_now)} (from ${pct(main["3"].yoy_year_ago)}), industry ${pct(main["2"].yoy_now)} (from ${pct(main["2"].yoy_year_ago)}), agriculture ${pct(main["1"].yoy_now)} and personal loans ${pct(main["4"].yoy_now)}.`,
    `Fastest-growing large segments: ${fastest.map(s => `${sname(s).toLowerCase().replace("nbfcs", "NBFCs")} ${pct(s.yoy_now)}`).join(", ")}.`,
    `Lending to NBFCs made up ${pct(byCode("3.9").share_pct)} of credit but ${pct(byCode("3.9").incr_share_pct)} of the year's new credit; gold loans ${pct(byCode("4.8").share_pct)} vs ${pct(byCode("4.8").incr_share_pct)}. Housing went the other way: ${pct(byCode("4.2").share_pct)} of credit, ${pct(byCode("4.2").incr_share_pct)} of new credit.`,
  ]);
  document.getElementById("cap-dumb").textContent = `YoY growth, ${fm(cr.month)} (filled dot) vs the same month a year earlier (open dot). Segments over ₹50,000 crore.`;
  legend("lg-dumb", [{ name: "Now", color: C.s1 }, { name: "A year earlier", color: C.muted }]);
  const order = ["1", "2", "2.1", "2.2", "2.3", "3", "3.9", "3.7", "3.8", "3.10", "3.1", "3.6", "3.3", "3.5", "4", "4.2", "4.9", "4.7", "4.8", "4.5", "4.3", "4.6"];
  const all = [...cr.main.map(r => ({ ...r, sector: r.name, parent: null })), ...subs];
  const rowsD = order.map(c => all.find(r => r.code === c)).filter(Boolean).map(r => ({
    label: sname(r),
    a: r.yoy_year_ago, b: r.yoy_now, bold: !r.parent, indent: !!r.parent,
    extra: [{ name: "Outstanding", value: lakhCr(r.outstanding_cr), color: "transparent" }, { name: "Share of credit", value: pct(r.share_pct), color: "transparent" }]
  }));
  register("c-dumb", (b, w) => dumbbell(b, w, { rows: rowsD, aLabel: "A year earlier", bLabel: fm(cr.month), labelW: 200, aria: "Dumbbell chart of credit growth by sector" }));
  dataTable(document.getElementById("c-dumb").parentElement, ["Sector", "Outstanding ₹ cr", "YoY now %", "YoY a year ago %", "Share %", "Share of new credit %"],
    all.map(r => [r.sector, n0(r.outstanding_cr), n1(r.yoy_now), n1(r.yoy_year_ago), n1(r.share_pct), n1(r.incr_share_pct)]));

  const incrRows = [...subs].filter(s => s.share_pct > 0.9 || s.incr_share_pct > 1.5).sort((a, b) => b.incr_share_pct - a.incr_share_pct).slice(0, 16)
    .map(s => ({ label: sname(s), values: { stock: s.share_pct, incr: s.incr_share_pct } }));
  legend("lg-incr", [{ name: "Share of credit", color: C.muted, box: true }, { name: "Share of new credit", color: C.s1, box: true }]);
  register("c-incr", (b, w) => barsH(b, w, { rows: incrRows, keys: [{ key: "stock", name: "Share of credit", color: "var(--axis)" }, { key: "incr", name: "Share of new credit (12 months)", color: C.s1 }], fmt: v => n1(v) + "%", tickFmt: v => n0(v) + "%", labelW: 150, bar: 8, rowPad: 14, labelKeys: ["incr"], aria: "Share of stock vs increment" }));

  const sy = cr.yoy_series, colors = { "All bank credit": C.agg, "Agriculture": C.s1, "Industry": C.s2, "Services": C.s3, "Personal loans": C.s4 };
  const secSer = ["All bank credit", "Agriculture", "Industry", "Services", "Personal loans"].map(n => ({ name: n, color: colors[n], data: sy[n] || [], width: n === "All bank credit" ? 2.5 : 2 }));
  legend("lg-secyoy", secSer.map(s => ({ name: s.name, color: s.color })));
  register("c-secyoy", (b, w) => lineChart(b, w, { series: secSer, yFmt: v => n0(v) + "%", valFmt: pct, include: [0], gapDays: 70, aria: "Credit growth by sector over time" }));
  dataTable(document.getElementById("c-secyoy").parentElement, ["Month", ...secSer.map(s => s.name + " %")],
    secSer[0].data.map((p, i) => [fm(p[0]), ...secSer.map(s => { const q = s.data.find(x => x[0] === p[0]); return q ? n1(q[1]) : "–"; })]));

  const realSer = [{ name: "Nominal credit growth", color: C.s1, data: cr.real.nominal }, { name: "CPI inflation", color: C.s2, data: cr.real.cpi }, { name: "Real credit growth", color: C.agg, data: cr.real.real, width: 2.5 }];
  legend("lg-real", realSer.map(s => ({ name: s.name, color: s.color })));
  register("c-real", (b, w) => lineChart(b, w, { series: realSer, yFmt: v => n0(v) + "%", valFmt: pct, include: [0], aria: "Real credit growth" }));
  dataTable(document.getElementById("c-real").parentElement, ["Month", "Credit YoY %", "CPI %", "Real %"], cr.real.nominal.map((p, i) => [fm(p[0]), n1(p[1]), n2(cr.real.cpi[i][1]), n1(cr.real.real[i][1])]));

  const ind = [...cr.industry].sort((a, b) => b.yoy_now - a.yoy_now);
  document.getElementById("cap-ind").textContent = `YoY growth, ${fm(cr.month)} vs a year earlier. Infrastructure is the largest borrower at ${pct((cr.industry.find(r => r.code === "2.18") || {}).share_pct)} of industry credit.`;
  legend("lg-ind", [{ name: "Now", color: C.s1 }, { name: "A year earlier", color: C.muted }]);
  register("c-ind", (b, w) => dumbbell(b, w, { rows: ind.map(r => ({ label: r.sector.replace(/ \(incl\..*\)/, "").replace("Vehicles, Vehicle Parts and Transport Equipment", "Vehicles and parts").replace("Petroleum, Coal Products and Nuclear Fuels", "Petroleum and coal products"), a: r.yoy_year_ago, b: r.yoy_now, extra: [{ name: "Share of industry", value: pct(r.share_pct), color: "transparent" }, { name: "Share of new industry credit", value: pct(r.incr_share_pct), color: "transparent" }] })), aLabel: "A year earlier", bLabel: fm(cr.month), labelW: 210, aria: "Industry credit growth" }));
  dataTable(document.getElementById("c-ind").parentElement, ["Industry", "Outstanding ₹ cr", "YoY now %", "YoY a year ago %", "Share %", "Share of new credit %"],
    ind.map(r => [r.sector, n0(r.outstanding_cr), n1(r.yoy_now), n1(r.yoy_year_ago), n1(r.share_pct), n1(r.incr_share_pct)]));
}

export function renderFunding() {
  const L = fu.latest;
  const peak = fu.icd.reduce((a, b) => b[1] > a[1] ? b : a);
  li("tk-funding", [
    `Deposits reached ${lakhCr(L.deposits)} in ${fm(fu.month)}, growing ${pct(L.deposit_yoy)} against ${pct(L.credit_yoy)} for credit.`,
    `For most of 2026 banks lent more than they raised: the incremental credit-to-deposit ratio peaked at ${n0(peak[1])}% in ${fm(peak[0])}, before a deposit surge in August pulled it back to ${n0(L.incr_cd_ratio)}%.`,
    `The stock ratio is ${pct(L.cd_ratio)}. Banks funded the gap partly by holding fewer government securities: ${pct(L.gsec_to_dep)} of deposits, down from about ${pct(fu.gsec_to_dep[0][1])} at the end of 2024.`,
  ]);
  const gr = [{ name: "Credit growth", color: C.s1, data: fu.credit_yoy }, { name: "Deposit growth", color: C.s2, data: fu.deposit_yoy }];
  legend("lg-gr", gr.map(s => ({ name: s.name, color: s.color })));
  register("c-gr", (b, w) => lineChart(b, w, { series: gr, yFmt: v => n0(v) + "%", valFmt: pct, endLabels: true, aria: "Credit vs deposit growth" }));
  const cd = [{ name: "Credit-to-deposit ratio", short: "Stock ratio", color: C.s1, data: fu.cd }, { name: "Incremental ratio (12 months)", short: "Incremental", color: C.s2, data: fu.icd }];
  legend("lg-cd", cd.map(s => ({ name: s.name, color: s.color })));
  register("c-cd", (b, w) => lineChart(b, w, { series: cd, yFmt: v => n0(v) + "%", valFmt: pct, refs: [{ y: 100, label: "100%: new loans = new deposits" }], include: [100], endLabels: true, aria: "Credit-deposit ratio" }));
  const mix = [{ name: "Demand deposits, % of deposits", short: "Demand deposits", color: C.s3, data: fu.demand_share }, { name: "Govt securities, % of deposits", short: "Govt securities", color: C.s7, data: fu.gsec_to_dep }];
  legend("lg-mix", mix.map(s => ({ name: s.name, color: s.color })));
  register("c-mix", (b, w) => lineChart(b, w, { series: mix, yFmt: v => n0(v) + "%", valFmt: pct, include: [0], height: 220, endLabels: true, aria: "Deposit mix" }));
  dataTable(document.getElementById("c-mix").parentElement, ["Month", "Deposits ₹ cr", "Credit ₹ cr", "C/D %", "Incr. C/D %", "Credit YoY %", "Deposit YoY %", "Demand %", "G-sec/dep %"],
    fu.table.map(r => [fm(r.month), n0(r.deposits), n0(r.bank_credit), n1(r.cd_ratio), n1(r.incr_cd_ratio), n1(r.credit_yoy), n1(r.deposit_yoy), n1(r.demand_share), n1(r.gsec_to_dep)]));
}

export function renderRates() {
  const tm = ra.trans_meta, T = ra.transmission;
  const g = (meas, grp) => (T.find(t => t.measure === meas && t.group === grp) || {}).change_bps;
  const repoChg = (tm.repo_end - tm.repo_start) * 100;
  const bl = Object.fromEntries(["PSU banks", "Private banks"].map(gp => [gp, Object.fromEntries(ra.bench_latest.filter(b => b.group === gp).map(b => [b.benchmark, b.value]))]));
  const L = ra.latest_by_group;
  li("tk-rates", [
    `The RBI cut the repo rate by ${n0(-repoChg)} bps between ${fm(tm.start)} and ${fm(tm.end)} (${n2(tm.repo_start)}% to ${n2(tm.repo_end)}%), then raised it to ${n2(ra.repo_now)}% on ${fm(lastDec.effective_date)}.`,
    `Over that period rates on new deposits fell ${n0(-g("td_fresh", "All SCBs"))} bps, rates on outstanding loans ${n0(-g("walr_outstanding", "All SCBs"))} bps and rates on new loans ${n0(-g("walr_fresh", "All SCBs"))} bps. The median 1-year MCLR fell only ${n0(-g("mclr_1y_median", "All SCBs"))} bps.`,
    `Private banks passed on more of the cut to borrowers (${n0(-g("walr_outstanding", "Private banks"))} bps on outstanding loans vs ${n0(-g("walr_outstanding", "PSU banks"))} bps at PSU banks): ${n0(bl["Private banks"].EBLR)}% of their floating loans are repo-linked, against ${n0(bl["PSU banks"].EBLR)}% at PSU banks, where ${n0(bl["PSU banks"].MCLR)}% still sit on MCLR.`,
    `Private banks charge ${n2(L["Private banks"].walr_outstanding)}% on outstanding loans vs ${n2(L["PSU banks"].walr_outstanding)}% at PSU banks. With inflation rising, the real lending rate has fallen from about 9% in late 2025 to ${n1(ra.real_walr[ra.real_walr.length - 1][1])}%.`,
  ]);
  const lines = ra.scb_lines;
  const rl = [
    { name: "Policy repo rate", short: "Repo", color: C.agg, data: ra.repo.filter(p => p[0] <= ra.month), step: true, width: 2.5 },
    { name: "Lending rate, outstanding loans", short: "Loans, outstanding", color: C.s1, data: lines["Lending rate, outstanding loans"] },
    { name: "Lending rate, new loans", short: "Loans, new", color: C.s2, data: lines["Lending rate, new loans"] },
    { name: "Term deposit rate, outstanding", short: "Deposits, outstanding", color: C.s3, data: lines["Term deposit rate, outstanding"] },
    { name: "Term deposit rate, new deposits", short: "Deposits, new", color: C.s4, data: lines["Term deposit rate, new deposits"], gapDays: 400 },
  ];
  legend("lg-rl", rl.map(s => ({ name: s.name, color: s.color })));
  register("c-rl", (b, w) => lineChart(b, w, { series: rl, yFmt: v => n1(v) + "%", valFmt: v => n2(v) + "%", height: 300, endLabels: true, gapDays: 70, aria: "Repo vs bank rates" }));
  dataTable(document.getElementById("c-rl").parentElement, ["Month", ...rl.map(s => s.name)],
    rl[1].data.map(p => [fm(p[0]), ...rl.map(s => { const q = s.data.find(x => x[0] === p[0]); return q ? n2(q[1]) : "–"; })]));

  document.getElementById("cap-tr").textContent = `Change in basis points, ${fm(tm.start)} to ${fm(tm.end)}. The vertical line marks the ${n0(-repoChg)} bps repo cut over the same period.`;
  const measures = ["walr_outstanding", "walr_fresh", "mclr_1y_median", "td_outstanding", "td_fresh"];
  const trRows = measures.map(mm => ({ label: (T.find(t => t.measure === mm) || {}).measure_name, values: { psu: g(mm, "PSU banks"), pvt: g(mm, "Private banks"), all: g(mm, "All SCBs") } }));
  const trKeys = [{ key: "psu", name: "PSU banks", color: C.s1 }, { key: "pvt", name: "Private banks", color: C.s2 }, { key: "all", name: "All SCBs", color: C.agg }];
  legend("lg-tr", trKeys.map(k => ({ name: k.name, color: k.color, box: true })));
  register("c-tr", (b, w) => barsH(b, w, { rows: trRows, keys: trKeys, fmt: v => sgn(v) + n0(Math.abs(v)), tickFmt: v => n0(v), refs: [{ x: repoChg, label: `Repo ${sgn(repoChg)}${n0(Math.abs(repoChg))}` }], include: [repoChg - 10], labelW: 170, bar: 8, rowPad: 14, aria: "Transmission by bank group" }));
  dataTable(document.getElementById("c-tr").parentElement, ["Measure", "Group", "Start %", "End %", "Change bps", "Pass-through %"],
    T.map(t => [t.measure_name, t.group, n2(t.start), n2(t.end), n0(t.change_bps), n0(t.pass_through_pct)]));

  document.getElementById("cap-bm").textContent = `Share of outstanding floating-rate rupee loans by benchmark, ${fm(ra.bench_month)}.`;
  const bkeys = [{ key: "EBLR", name: "External benchmark (repo)", color: C.s1 }, { key: "MCLR", name: "MCLR", color: C.s2 }, { key: "Base Rate", name: "Base rate", color: C.s3 }, { key: "Others", name: "Other", color: C.muted }];
  legend("lg-bm", bkeys.map(k => ({ name: k.name, color: k.color, box: true })));
  const bRows = ["PSU banks", "Private banks", "Foreign banks", "All SCBs"].map(gp => ({ label: gp, values: Object.fromEntries(ra.bench_latest.filter(b => b.group === gp).map(b => [b.benchmark, b.value])) }));
  register("c-bm", (b, w) => stacked(b, w, { rows: bRows, keys: bkeys, labelW: 96, aria: "Benchmark mix" }));
  dataTable(document.getElementById("c-bm").parentElement, ["Group", "EBLR %", "MCLR %", "Base rate %", "Other %"], bRows.map(r => [r.label, n1(r.values.EBLR), n1(r.values.MCLR), n1(r.values["Base Rate"]), n1(r.values.Others)]));

  const eb = [{ name: "PSU banks", color: C.s1, data: ra.eblr["PSU banks"] }, { name: "Private banks", color: C.s2, data: ra.eblr["Private banks"] }, { name: "Foreign banks", color: C.s3, data: ra.eblr["Foreign banks"] }, { name: "All SCBs", color: C.agg, data: ra.eblr["All SCBs"] }];
  legend("lg-eblr", eb.map(s => ({ name: s.name, color: s.color })));
  register("c-eblr", (b, w) => lineChart(b, w, { series: eb, yFmt: v => n0(v) + "%", valFmt: pct, include: [0], gapDays: 120, aria: "EBLR share" }));

  const rr = [{ name: "Real lending rate (outstanding)", color: C.s1, data: ra.real_walr.filter(p => p[0] >= "2019-01-01") }, { name: "Real deposit rate (new deposits)", color: C.s2, data: ra.real_td }];
  legend("lg-real-r", rr.map(s => ({ name: s.name, color: s.color })));
  register("c-real-r", (b, w) => lineChart(b, w, { series: rr, yFmt: v => n0(v) + "%", valFmt: pct, include: [0], gapDays: 70, aria: "Real rates" }));

  const sp = [{ name: "Outstanding loans vs deposits", color: C.s1, data: ra.spread_out }, { name: "New loans vs new deposits", color: C.s2, data: ra.spread_fresh }];
  legend("lg-spr", sp.map(s => ({ name: s.name, color: s.color })));
  register("c-spr", (b, w) => lineChart(b, w, { series: sp, yFmt: v => n1(v), valFmt: v => n2(v) + " pp", gapDays: 70, aria: "Spread" }));

  document.getElementById("cap-secr").textContent = `Weighted average rate on new rupee loans, ${fm(ra.sector_month)}; hover for the change over 12 months.`;
  const sr = ra.sector_fresh.map(r => ({ label: r.sector.trim(), values: { r: r.rate }, extra: [{ name: "Change over 12 months", value: bps(r.chg_bps), color: "transparent" }] }));
  register("c-secr", (b, w) => barsH(b, w, { rows: sr, keys: [{ key: "r", name: "Rate on new loans", color: C.s1 }], fmt: v => n2(v) + "%", tickFmt: v => n0(v) + "%", labelW: 150, bar: 12, rowPad: 10, aria: "Sector lending rates" }));
  dataTable(document.getElementById("c-secr").parentElement, ["Sector", "Rate %", "12-month change bps"], ra.sector_fresh.map(r => [r.sector.trim(), n2(r.rate), n0(r.chg_bps)]));

  document.getElementById("cap-mclr").textContent = `1-year marginal cost of funds based lending rate, ${fm(ra.mclr_month)}, with change over one month and one year. Click a column to sort.`;
  let gf = "All";
  const f = document.getElementById("f-mclr");
  const render = sortTable(document.getElementById("t-mclr"), [
    { key: "bank", label: "Bank" }, { key: "group", label: "Group" }, { key: "mclr", label: "1y MCLR %", num: true, fmt: n2 },
    { key: "mom_bps", label: "1-month change", num: true, fmt: bps, tone: ["neg", "pos"] }, { key: "yoy_bps", label: "1-year change", num: true, fmt: bps, tone: ["neg", "pos"] },
  ], () => ra.mclr_banks.filter(r => gf === "All" || r.group === gf), { key: "mclr", dir: 1 });
  ["All", "PSU banks", "Private banks"].forEach(n => {
    const b = document.createElement("button"); b.textContent = n === "All" ? "All banks" : n; b.setAttribute("aria-pressed", n === gf);
    b.addEventListener("click", () => { gf = n; f.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); render(); });
    f.append(b);
  });
}

export function renderCardsMain() {
  const I = ca.issuers, T = ca.totals, H = ca.hhi;
  const t0 = T[0], t1 = T[T.length - 1];
  const top4 = I.slice(0, 4).reduce((a, r) => a + r.card_share, 0);
  const amex = I.find(r => r.bank === "American Express");
  const grow = [...I].filter(r => r.credit_cards > 1e6 && r.cards_growth != null).sort((a, b) => b.cards_growth - a.cards_growth)[0];
  li("tk-cards", [
    `${(t1.credit_cards / 1e7).toFixed(2)} crore credit cards were outstanding in ${fm(ca.month)}, up ${pct((t1.credit_cards / t0.credit_cards - 1) * 100)} since ${fm(ca.first_month)}; card spend was ₹${n0(t1.cc_spend_cr / 1000)} thousand crore in the month.`,
    `HDFC Bank, SBI, ICICI Bank and Axis Bank hold ${pct(top4)} of cards. HDFC Bank's share of spend (${pct(I[0].spend_share)}) is well above its share of cards (${pct(I[0].card_share)}).`,
    `Concentration is falling slowly: the index for cards outstanding dropped from ${n0(H[0].hhi_cards)} to ${n0(H[H.length - 1].hhi_cards)}. Among issuers with 10 lakh+ cards, ${grow.bank} grew fastest (${pct(grow.cards_growth)} in nine months).`,
    amex ? `American Express cards see ₹${n0(amex.spend_per_card_rs)} of spend a month, about ${n1(amex.spend_per_card_rs / t1.spend_per_card_rs)} times the market average of ₹${n0(t1.spend_per_card_rs)}.` : "",
  ].filter(Boolean));
  document.getElementById("cap-share").textContent = `${fm(ca.month)}, top 12 issuers by cards outstanding.`;
  const sk = [{ key: "c", name: "Share of cards", color: C.s1 }, { key: "s", name: "Share of spend", color: C.s2 }];
  legend("lg-share", sk.map(k => ({ name: k.name, color: k.color, box: true })));
  const sRows = I.slice(0, 12).map(r => ({ label: r.bank, values: { c: r.card_share, s: r.spend_share }, extra: [{ name: "Cards", value: n0(r.credit_cards), color: "transparent" }] }));
  register("c-share", (b, w) => barsH(b, w, { rows: sRows, keys: sk, fmt: v => n1(v) + "%", tickFmt: v => n0(v) + "%", labelW: 140, bar: 8, rowPad: 10, aria: "Issuer shares" }));

  const pts = I.filter(r => r.credit_cards >= 5e5).map(r => ({
    x: r.credit_cards / 1e5, y: r.spend_per_card_rs, name: r.bank, label: (r.credit_cards > 4e6 || r.spend_per_card_rs > 30000) ? r.bank.replace(" Bank", "").replace("State of India", "SBI").replace("State Bank of India", "SBI") : null,
    color: r.bank_group === "Public Sector Banks" ? C.s1 : r.bank_group === "Private Sector Banks" ? C.s2 : C.s3,
    rows: [{ name: "Cards outstanding", value: n0(r.credit_cards), color: "transparent" }, { name: "Spend per card / month", value: "₹" + n0(r.spend_per_card_rs), color: "transparent" }, { name: "Average transaction", value: "₹" + n0(r.ticket_rs), color: "transparent" }, { name: "Online share of spend", value: pct(r.ecom_share_pct), color: "transparent" }]
  }));
  register("c-scatter", (b, w) => scatter(b, w, { points: pts, xFmt: v => n0(v), yFmt: v => "₹" + n0(v / 1000) + "k", xTitle: "Cards outstanding, lakh", yTitle: "Spend per card, ₹/month", aria: "Spend per card vs cards" }));
  const lgS = document.createElement("div"); lgS.className = "legend";
  document.getElementById("c-scatter").before(lgS); lgS.id = "lg-scatter";
  legend("lg-scatter", [{ name: "PSU banks", color: C.s1, box: true }, { name: "Private banks", color: C.s2, box: true }, { name: "Foreign banks", color: C.s3, box: true }]);

  register("c-cc", (b, w) => lineChart(b, w, { series: [{ name: "Credit cards outstanding", color: C.s1, data: T.map(r => [r.month, r.credit_cards / 1e7]) }], yFmt: v => n1(v), valFmt: v => n2(v) + " cr", height: 200, aria: "Cards outstanding" }));
  register("c-spend", (b, w) => barsV(b, w, { rows: T.map(r => ({ label: fms(r.month), full: fm(r.month), v: r.cc_spend_cr / 1000 })), fmt: v => "₹" + n1(v) + "k cr", aria: "Monthly card spend" }));
  const hs = [{ name: "Cards outstanding", color: C.s1, data: H.map(r => [r.month, r.hhi_cards]) }, { name: "Card spend", color: C.s2, data: H.map(r => [r.month, r.hhi_spend]) }];
  legend("lg-hhi", hs.map(s => ({ name: s.name, color: s.color })));
  register("c-hhi", (b, w) => lineChart(b, w, { series: hs, yFmt: n0, valFmt: n0, height: 200, include: [1200, 1800], aria: "HHI" }));
  dataTable(document.getElementById("c-hhi").parentElement, ["Month", "Cards m", "Spend ₹ cr", "Spend/card ₹", "Online %", "HHI cards", "HHI spend"],
    T.map((r, i) => [fm(r.month), n1(r.credit_cards / 1e6), n0(r.cc_spend_cr), n0(r.spend_per_card_rs), n1(r.ecom_share_pct), n0(H[i].hhi_cards), n0(H[i].hhi_spend)]));

  document.getElementById("cap-grp").textContent = `Share by bank group, ${fm(ca.month)}. PSU banks dominate debit cards and ATMs; private banks dominate credit cards and merchant UPI QR codes.`;
  const gk = [{ key: "PSU banks", name: "PSU banks", color: C.s1 }, { key: "Private banks", name: "Private banks", color: C.s2 }, { key: "Foreign banks", name: "Foreign banks", color: C.s3 }, { key: "Small finance banks", name: "Small finance banks", color: C.s4, ink: "#111" }, { key: "Payment banks", name: "Payment banks", color: C.s7 }];
  legend("lg-grp", gk.map(k => ({ name: k.name, color: k.color, box: true })));
  const metrics = [["credit_cards", "Credit cards"], ["cc_spend_cr", "Credit card spend"], ["debit_cards", "Debit cards"], ["dc_spend_cr", "Debit card spend"], ["atm_total", "ATMs and cash recyclers"], ["upi_qr", "UPI QR codes"]];
  const gRows = metrics.map(([k, lab]) => ({ label: lab, values: Object.fromEntries(ca.groups.map(gp => [gp.group, gp[k]])) }));
  register("c-grp", (b, w) => stacked(b, w, { rows: gRows, keys: gk, labelW: 160, aria: "Bank group shares" }));
  dataTable(document.getElementById("c-grp").parentElement, ["Metric", ...gk.map(k => k.name + " %")], gRows.map(r => [r.label, ...gk.map(k => n1(r.values[k.key]))]));

  document.getElementById("cap-iss").textContent = `Issuers with 5 lakh+ credit cards, ${fm(ca.month)}. Changes are over nine months from ${fm(ca.first_month)}. Click a column to sort.`;
  sortTable(document.getElementById("t-iss"), [
    { key: "bank", label: "Bank" }, { key: "credit_cards", label: "Cards", num: true, fmt: n0 }, { key: "card_share", label: "Card share %", num: true, fmt: n1 },
    { key: "share_chg_pp", label: "Share change", num: true, fmt: pp, tone: ["pos", "neg"] }, { key: "cards_growth", label: "Card growth %", num: true, fmt: n1, tone: ["pos", "neg"] },
    { key: "spend_share", label: "Spend share %", num: true, fmt: n1 }, { key: "spend_per_card_rs", label: "Spend/card ₹", num: true, fmt: n0 },
    { key: "ticket_rs", label: "Avg txn ₹", num: true, fmt: n0 }, { key: "ecom_share_pct", label: "Online %", num: true, fmt: n1 },
  ], () => I.filter(r => r.credit_cards >= 5e5), { key: "credit_cards", dir: -1 });
}

export function renderDebit() {
  if (!(D.cards && D.cards.debit)) return;
  const ca2 = D.cards, T = ca2.totals, t1 = T[T.length - 1], t0 = T[0], DB = ca2.debit;
  const S = (k, f) => T.map(r => [r.month, r[k] == null ? null : f(r[k])]);
  const dcS = [{ name: "Purchases", color: C.s1, data: S("dc_spend_cr", v => v / 1000) }, { name: "ATM cash", color: C.s2, data: S("dc_atm_cash_val", v => v / 1000) }];
  legend("lg-dc", dcS.map(s => ({ name: s.name, color: s.color })));
  register("c-dc", (b, w) => lineChart(b, w, { series: dcS, yFmt: v => n0(v), valFmt: v => "₹" + n1(v) + "k cr", include: [0], gapDays: 40, height: 220, aria: "Debit card purchases vs cash" }));
  const mini = (id, k, f, unit) => register(id, (b, w) => lineChart(b, w, { series: [{ name: id, color: C.s1, data: S(k, f) }], yFmt: v => n1(v), valFmt: v => n1(v) + unit, gapDays: 40, height: 180, aria: id }));
  mini("c-qr", "upi_qr", v => v / 1e7, " crore");
  mini("c-pos", "pos", v => v / 1e5, " lakh");
  if ((ca2.pos_notes || []).length) document.getElementById("cap-pos").textContent = "Lakh card terminals. " + ca2.pos_notes.join(" ");
  mini("c-atm", "atm_total", v => v / 1e3, "k");
  const top3qr = [...DB].sort((a, b) => b.qr_share - a.qr_share).slice(0, 3);
  const tk = document.getElementById("tk-cards");
  [
    `Debit cards are still mostly a cash tool: in ${fm(ca2.month)} they drew ₹${n0(t1.dc_atm_cash_val / 1000)} thousand crore from ATMs against ₹${n0(t1.dc_spend_cr / 1000)} thousand crore of purchases, across ${n1(t1.debit_cards / 1e7)} crore cards.`,
    `Banks have deployed ${n1(t1.upi_qr / 1e7)} crore UPI QR codes, concentrated in a few banks (${top3qr.map(r => `${r.bank} ${n0(r.qr_share)}%`).join(", ")}), against ${n1(t1.pos / 1e5)} lakh card terminals and ${n0(t1.atm_total / 1e3)} thousand ATMs.`,
  ].forEach(x => { const e = document.createElement("li"); e.textContent = x; tk.append(e); });
  document.getElementById("cap-dci").textContent = `${fm(ca2.month)}, banks with 50 lakh+ debit cards. Cash share is ATM withdrawals as % of ATM cash plus purchases. Growth is over nine months. Click a column to sort.`;
  sortTable(document.getElementById("t-dci"), [
    { key: "bank", label: "Bank" }, { key: "debit_cards", label: "Debit cards", num: true, fmt: v => n1(v / 1e7) + " cr" },
    { key: "dc_share", label: "Share %", num: true, fmt: n1 }, { key: "dc_growth", label: "Growth %", num: true, fmt: n1, tone: ["pos", "neg"] },
    { key: "dc_spend_cr", label: "Purchases ₹ cr", num: true, fmt: n0 }, { key: "dc_atm_cash_val", label: "ATM cash ₹ cr", num: true, fmt: n0 },
    { key: "cash_share", label: "Cash share %", num: true, fmt: n0 }, { key: "upi_qr", label: "UPI QR (lakh)", num: true, fmt: v => n0(v / 1e5) },
    { key: "qr_share", label: "QR share %", num: true, fmt: n1 }, { key: "pos", label: "PoS (thousand)", num: true, fmt: v => n0(v / 1e3) },
    { key: "atm_total", label: "ATMs", num: true, fmt: n0 },
  ], () => DB, { key: "debit_cards", dir: -1 });
}

export function renderCards() { renderCardsMain(); renderDebit(); }
export function renderRegions() {
  if (!(D.spatial)) return;
  const P = D.spatial, PG = [["Rural", C.s3], ["Semi-urban", C.s4], ["Urban", C.s2], ["Metropolitan", C.s1]];
  const qlab = s => new Date(s).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const L = Object.fromEntries(P.latest.map(r => [r.pop_group, r]));
  const credFirst = P.shares.credit_first, credLast = P.shares.credit_last;
  const nonMetro = o => 100 - o.Metropolitan;
  const cg = P.growth["Population group"].credit_yoy, lastG = n => { const s = cg[n] || []; const v = [...s].reverse().find(p => p[1] != null); return v ? v[1] : null; };
  const fastest = PG.map(([n]) => [n, lastG(n)]).sort((a, b) => b[1] - a[1])[0];
  const tk = document.getElementById("tk-spatial");
  [
    `Branches outside the metros now hold ${n1(nonMetro(credLast))}% of bank credit, up from ${n1(nonMetro(credFirst))}% in ${qlab(P.first)}; metro branches still lend ${n1(credLast.Metropolitan)}%.`,
    `${fastest[0]} credit grew fastest in ${qlab(P.last)}, ${n1(fastest[1])}% on a year earlier (all banks ${n1(((P.growth.All.credit_yoy["All banks"] || []).slice(-1)[0] || [])[1])}%).`,
    `Metro branches lend ₹${n0(L.Metropolitan.cd_ratio)} for every ₹100 of deposits they raise; rural branches ₹${n0(L.Rural.cd_ratio)}, semi-urban ₹${n0(L["Semi-urban"].cd_ratio)} and urban ₹${n0(L.Urban.cd_ratio)}.`,
  ].forEach(s => { const x = document.createElement("li"); x.textContent = s; tk.append(x); });
  document.getElementById("cap-sp-share").textContent = `Population group of the branch (Census 2011 classification), ${qlab(P.first)} against ${qlab(P.last)}, same quarter to avoid the March year-end peak. Rows add to 100%.`;
  legend("lg-sp-share", PG.map(([n, c]) => ({ name: n, color: c, box: true })));
  register("c-sp-share", (b, w) => stacked(b, w, { rows: P.shares.rows, keys: PG.map(([n, c]) => ({ key: n, name: n, color: c, ink: n === "Semi-urban" ? "#111" : undefined })), labelW: 110, aria: "Credit and deposit shares by population group" }));
  const cdS = PG.map(([n, c]) => ({ name: n, color: c, data: P.cd[n] }));
  legend("lg-sp-cd", cdS.map(s => ({ name: s.name, color: s.color })));
  register("c-sp-cd", (b, w) => lineChart(b, w, { series: cdS, yFmt: v => n0(v), valFmt: v => n1(v) + "%", gapDays: 100, height: 220, aria: "Credit-deposit ratio by population group" }));
  const lines = (src, id, lg) => {
    const ss = PG.map(([n, c]) => ({ name: n, short: n, color: c, data: src[n] || [] }));
    legend(lg, ss.map(s => ({ name: s.name, color: s.color })));
    register(id, (b, w) => lineChart(b, w, { series: ss, yFmt: v => n0(v), valFmt: v => n1(v) + "%", gapDays: 100, height: 240, endLabels: true, aria: id }));
  };
  lines(cg, "c-sp-cg", "lg-sp-cg");
  lines(P.growth["Population group"].deposits_yoy, "c-sp-dg", "lg-sp-dg");
  const BG = [["PSU banks", "PSU banks", C.s1], ["Private banks", "Private banks", C.s2], ["Small finance banks", "Small finance banks", C.s4], ["Foreign banks", "Foreign banks", C.s3]];
  const bgS = BG.map(([k, n, c]) => ({ name: n, short: n, color: c, data: P.growth["Bank group"].credit_yoy[k] || [] }));
  legend("lg-sp-bg", bgS.map(s => ({ name: s.name, color: s.color })));
  register("c-sp-bg", (b, w) => lineChart(b, w, { series: bgS, yFmt: v => n0(v), valFmt: v => n1(v) + "%", gapDays: 100, height: 240, endLabels: true, aria: "Credit growth by bank group" }));
  document.getElementById("cap-sp-st").textContent = `${qlab(P.last)}, ₹ crore. Growth is on the same quarter a year earlier. Rural share is the part of a state's credit lent by rural and semi-urban branches. Click a column to sort.`;
  let rg = "All";
  const tone = ["pos", "neg"];
  const regions = [...new Set(P.states.map(s => s.region))].sort();
  const renderSt = sortTable(document.getElementById("t-sp-st"), [
    { key: "state", label: "State / UT" }, { key: "region", label: "Region" }, { key: "offices", label: "Branches", num: true, fmt: n0 },
    { key: "deposits_cr", label: "Deposits ₹ cr", num: true, fmt: n0 }, { key: "credit_cr", label: "Credit ₹ cr", num: true, fmt: n0 },
    { key: "credit_share", label: "Share of credit %", num: true, fmt: n2 }, { key: "cd", label: "C/D %", num: true, fmt: n1 },
    { key: "credit_yoy", label: "Credit YoY %", num: true, fmt: n1, tone }, { key: "deposits_yoy", label: "Deposits YoY %", num: true, fmt: n1, tone },
    { key: "rural_share", label: "Rural + semi-urban share %", num: true, fmt: n1 },
  ], () => P.states.filter(s => rg === "All" || s.region === rg), { key: "credit_cr", dir: -1 });
  const fs = document.getElementById("f-sp-st");
  [["All", "All India"], ...regions.map(r => [r, r.replace(" Region", "").replace(/^\w/, c => c.toUpperCase())])].forEach(([k, lab]) => {
    const b = document.createElement("button"); b.textContent = lab; b.setAttribute("aria-pressed", k === rg);
    b.addEventListener("click", () => { rg = k; fs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderSt(); });
    fs.append(b);
  });
}

export function renderStructure() {
  if (D.bsr1 && D.bsr1.dims["Interest rate"]) {
  const B1 = D.bsr1.dims, yr = D.bsr1.as_of.slice(0, 4);
  document.getElementById("eb-bsr1").textContent = `Annual BSR-1 · RBI · March ${yr}, all scheduled commercial banks incl. regional rural banks`;
  const keys = [{ key: "share", name: "Share of amount", color: C.s1 }, { key: "acc", name: "Share of accounts", color: "var(--axis)" }];
  const toRows = list => list.filter(r => r.share != null).map(r => ({ label: r.label.replace("Non-Profit Institutions Serving Households", "Non-profit institutions (NPISH)").replace("Micro Finance-Institutions", "Microfinance institutions"), values: { share: r.share, acc: r.acc_share },
    extra: [{ name: "Outstanding", value: "₹" + n0(r.amount) + " cr", color: "transparent" }, { name: "Accounts", value: r.accounts == null ? "–" : n0(r.accounts), color: "transparent" }] }));
  ["lg-bsr-ir", "lg-bsr-sz", "lg-bsr-org", "lg-bsr-bg", "lg-bsr-ac"].forEach(id => legend(id, keys.map(k => ({ name: k.name, color: k.color, box: true }))));
  const opts = (rows, aria, labelW) => (b, w) => barsH(b, w, { rows, keys, fmt: v => n1(v) + "%", tickFmt: v => n0(v) + "%", labelW, bar: 7, rowPad: 10, labelKeys: ["share"], aria });
  register("c-bsr-ir", opts(toRows(B1["Interest rate"]), "Loans by interest rate", 110));
  register("c-bsr-sz", opts(toRows(B1["Credit limit size"]), "Loans by size of credit limit", 130));
  if (B1["Bank group"]) register("c-bsr-bg", opts(toRows(B1["Bank group"]), "Credit by bank group", 150));
  if (B1["Type of account"]) {
    const ac = B1["Type of account"].filter(r => r.share != null), main = ac.filter(r => r.share >= 0.5), rest = ac.filter(r => r.share < 0.5);
    const other = { label: "Other (bills, export credit etc.)", share: rest.reduce((t, r) => t + r.share, 0), acc_share: rest.reduce((t, r) => t + (r.acc_share || 0), 0),
                    amount: rest.reduce((t, r) => t + r.amount, 0), accounts: rest.reduce((t, r) => t + (r.accounts || 0), 0) };
    register("c-bsr-ac", opts(toRows(main.concat(rest.length ? [other] : [])), "Credit by type of account", 170));
  }
  const org = B1.Organisation || [];
  register("c-bsr-org", opts(toRows(org.filter(r => r.level === 1).concat(org.filter(r => ["Male", "Female"].includes(r.label)).map(r => ({ ...r, label: `  of which ${r.label.toLowerCase()} individuals` })))), "Credit by borrower", 230));
  const pick = (dim, lab) => (B1[dim] || []).find(r => r.label === lab) || {};
  const ir = B1["Interest rate"].filter(r => r.share != null), below9 = ir.slice(0, 5).reduce((s, r) => s + r.share, 0);
  const top = ir.find(r => r.label.includes("and above")) || {};
  const big = pick("Credit limit size", B1["Credit limit size"].slice(-1)[0].label), hh = pick("Organisation", "Household Sector"), fem = pick("Organisation", "Female"), corp = pick("Organisation", "Private Corporate Sector");
  document.getElementById("cap-bsr-org").textContent = `Institutional sector of the borrower, March ${yr}. Individuals are split by gender of the borrower.`;
  const tk = document.getElementById("tk-bsr1");
  [
    `${n1(below9)}% of loans by amount carry interest below 9%. At the other end, ${n1(top.acc_share)}% of loan accounts pay ${top.label} but they are only ${n1(top.share)}% of the amount; the average loan in that band is ₹${n0(top.amount * 1e7 / top.accounts / 1000)} thousand.`,
    `Loans with limits ${big.label.replace("Above", "above")} are ${n1(big.share)}% of all bank credit but ${big.acc_share < 0.1 ? "under 0.1" : n1(big.acc_share)}% of accounts.`,
    B1["Bank group"] ? (() => { const psu = pick("Bank group", "Public Sector Banks"), pvt = pick("Bank group", "Private Sector Banks");
      return `PSU banks hold ${n1(psu.share)}% of bank credit and private banks ${n1(pvt.share)}%, but private banks run ${n1(pvt.acc_share)}% of loan accounts against ${n1(psu.acc_share)}% at PSU banks.`; })() : null,
    `Households borrow ${n1(hh.share)}% of bank credit and the private corporate sector ${n1(corp.share)}%. Women borrowers hold ${n1(fem.share)}% of all credit through ${n1(fem.acc_share)}% of accounts.`,
  ].filter(Boolean).forEach(s => { const x = document.createElement("li"); x.textContent = s; tk.append(x); });
  }
  if (D.bsr1_hist && D.bsr1_hist.pop_rows.length) {
  const H = D.bsr1_hist, PGc = [["Rural", C.s3], ["Semi-urban", C.s4], ["Urban", C.s2], ["Metropolitan", C.s1]];
  const pkeys = PGc.map(([n, c]) => ({ key: n, name: n, color: c, ink: n === "Semi-urban" ? "#111" : undefined }));
  ["lg-bsrh-pop", "lg-bsrh-w"].forEach(id => legend(id, PGc.map(([n, c]) => ({ name: n, color: c, box: true }))));
  document.getElementById("cap-bsrh-pop").textContent = `Share of credit by population group of the place of utilisation, March ${H.years[0]} to March ${H.years[H.years.length - 1]}, excluding regional rural banks (the basis Indus Equity uses). Rows add to 100%.`;
  register("c-bsrh-pop", (b, w) => stacked(b, w, { rows: H.pop_rows, keys: pkeys, labelW: 60, aria: "Population group shares of credit by year" }));
  register("c-bsrh-r9", (b, w) => lineChart(b, w, { series: [{ name: "Loans below 9%", color: C.s1, data: H.below9 }], yFmt: v => n0(v) + "%", valFmt: v => n1(v) + "%", include: [0], gapDays: 400, height: 220, aria: "Share of loans below 9%" }));
  const BGc = [["PSU banks", C.s1], ["Private banks", C.s2], ["Foreign banks", C.s3], ["Small finance banks", C.s4], ["Regional rural banks", C.s7]];
  const bgS = BGc.map(([n, c]) => ({ name: n, short: n, color: c, data: H.bank[n] || [] }));
  legend("lg-bsrh-bg", bgS.map(s => ({ name: s.name, color: s.color })));
  register("c-bsrh-bg", (b, w) => lineChart(b, w, { series: bgS, yFmt: v => n0(v) + "%", valFmt: v => n1(v) + "%", include: [0], gapDays: 400, height: 240, aria: "Bank group shares of credit" }));
  document.getElementById("cap-bsrh-w").textContent = `Share of each bank group's own credit by population group, first and latest March available.`;
  register("c-bsrh-w", (b, w) => stacked(b, w, { rows: H.within, keys: pkeys, labelW: 130, aria: "Population mix within PSU and private banks" }));
  const P0 = H.pop_rows[0], P1 = H.pop_rows[H.pop_rows.length - 1];
  const psu = H.bank["PSU banks"] || [], pvt = H.bank["Private banks"] || [];
  const tk = document.getElementById("tk-bsr1");
  const li = document.createElement("li");
  li.textContent = `Metro branches lent ${n1(P1.values.Metropolitan)}% of credit in ${P1.label}, down from ${n1(P0.values.Metropolitan)}% in ${P0.label} (excluding regional rural banks). Over the same years PSU banks' share of all credit went from ${n1(psu[0][1])}% to ${n1(psu[psu.length - 1][1])}% and private banks' from ${n1(pvt[0][1])}% to ${n1(pvt[pvt.length - 1][1])}%.`;
  tk.prepend(li);
  }
  if (D.bsr2 && D.bsr2.pop_rows.length) {
  const B2 = D.bsr2, PGc = [["Rural", C.s3], ["Semi-urban", C.s4], ["Urban", C.s2], ["Metropolitan", C.s1]];
  legend("lg-bsr2-pop", PGc.map(([n, c]) => ({ name: n, color: c, box: true })));
  document.getElementById("cap-bsr2-pop").textContent = `Share of deposits by population group of the branch, March ${B2.years[0]} to March ${B2.years[B2.years.length - 1]}, excluding regional rural banks and inter-bank deposits. Rows add to 100%.`;
  register("c-bsr2-pop", (b, w) => stacked(b, w, { rows: B2.pop_rows, keys: PGc.map(([n, c]) => ({ key: n, name: n, color: c, ink: n === "Semi-urban" ? "#111" : undefined })), labelW: 60, aria: "Deposit shares by population group" }));
  const cp = [["All India", "var(--agg)"], ...PGc].map(([n, c]) => ({ name: n, color: c, data: B2.casa_pop[n] || [] }));
  legend("lg-bsr2-cp", cp.map(s => ({ name: s.name, color: s.color })));
  register("c-bsr2-cp", (b, w) => lineChart(b, w, { series: cp, yFmt: v => n0(v) + "%", valFmt: v => n1(v) + "%", gapDays: 400, height: 240, aria: "CASA share by population group" }));
  const BGc = [["PSU banks", C.s1], ["Private banks", C.s2], ["Foreign banks", C.s3], ["Small finance banks", C.s4], ["Regional rural banks", C.s7]];
  const cb = BGc.map(([n, c]) => ({ name: n, short: n, color: c, data: B2.casa_bank[n] || [] }));
  legend("lg-bsr2-cb", cb.map(s => ({ name: s.name, color: s.color })));
  register("c-bsr2-cb", (b, w) => lineChart(b, w, { series: cb, yFmt: v => n0(v) + "%", valFmt: v => n1(v) + "%", gapDays: 400, height: 240, endLabels: true, aria: "CASA share by bank group" }));
  const ca = B2.casa_pop["All India"] || [], peak = ca.reduce((m, p) => p[1] > m[1] ? p : m, ca[0] || [null, 0]);
  const last = ca[ca.length - 1] || [], R = B2.casa_pop.Rural || [], M = B2.casa_pop.Metropolitan || [];
  const li = document.createElement("li");
  li.textContent = `Banks held ₹${n1(B2.latest.total_cr / 1e5)} lakh crore of deposits in March ${B2.latest.as_of.slice(0, 4)}. The cheap current-and-savings (CASA) share fell to ${n1(last[1])}% from a peak of ${n1(peak[1])}% in March ${String(peak[0]).slice(0, 4)}; rural branches still raise ${n0((R[R.length - 1] || [])[1])}% of deposits as CASA, metro branches ${n0((M[M.length - 1] || [])[1])}%.`;
  document.getElementById("tk-bsr1").append(li);
  }
}

export function renderBanks(start: string, go: (sym: string) => void) {
  if (!(D.banks && D.banks.banks.length)) return null;
  const B = D.banks, sel = document.getElementById("bank-sel");
  const GROUPS = [["Private", "Private banks"], ["PSU", "PSU banks"], ["SFB", "Small finance banks"]];
  GROUPS.forEach(([g, lab]) => {
    const og = document.createElement("optgroup"); og.label = lab;
    B.banks.filter(b => b.group === g).forEach(b => { const o = document.createElement("option"); o.value = b.symbol; o.textContent = b.name; og.append(o); });
    if (og.children.length) sel.append(og);
  });
  const cr0 = v => v == null ? "–" : "₹" + n0(v) + " cr";
  const lastWith = (rows, k) => [...rows].reverse().find(r => r[k] != null);
  const yoyChip = v => v == null ? ["–", "flat"] : [`${sgn(v)}${n1(Math.abs(v))}% YoY`, v >= 0 ? "up" : "down"];

  function renderBank(sym) {
    const bank = B.banks.find(b => b.symbol === sym), Q = B.q[sym], F = B.fy[sym];
    const L = Q[Q.length - 1], bs = lastWith(Q, "deposits"), yAgo = Q.find(r => r.period_end === (+L.period_end.slice(0, 4) - 1) + L.period_end.slice(4));
    document.getElementById("bank-meta").textContent = `${bank.symbol} · ${GROUPS.find(g => g[0] === bank.group)[1].replace(/s$/, "")} · ${Q.length} quarters, ${Q[0].label}–${L.label}`;
    // takeaways
    const tk = document.getElementById("tk-bank"); tk.replaceChildren();
    const lines = [
      `${L.label}: net interest income ${cr0(L.nii)} (${L.nii_yoy == null ? "–" : sgn(L.nii_yoy) + n1(Math.abs(L.nii_yoy)) + "% YoY"}), net profit ${cr0(L.pat)} (${L.pat_yoy == null ? "–" : sgn(L.pat_yoy) + n1(Math.abs(L.pat_yoy)) + "% YoY"}).`,
      yAgo && yAgo.gnpa_pct != null ? `Gross NPAs ${n2(L.gnpa_pct)}% of advances, ${L.gnpa_pct <= yAgo.gnpa_pct ? "down" : "up"} from ${n2(yAgo.gnpa_pct)}% a year earlier; provision coverage ${n0(L.pcr)}%.` : null,
      yAgo && yAgo.cost_to_income != null ? `Cost-to-income ${n1(L.cost_to_income)}% (a year earlier ${n1(yAgo.cost_to_income)}%); annualised return on assets ${n2(L.roa)}%.` : null,
      bs ? `At ${bs.label} deposits were ${lakhCr(bs.deposits)} (${bs.deposits_yoy == null ? "growth n/a" : sgn(bs.deposits_yoy) + n1(Math.abs(bs.deposits_yoy)) + "% YoY"}) and advances ${lakhCr(bs.advances)} (${bs.advances_yoy == null ? "growth n/a" : sgn(bs.advances_yoy) + n1(Math.abs(bs.advances_yoy)) + "% YoY"}); credit-to-deposit ratio ${n1(bs.cd_ratio)}%.` : null,
      L.exceptional ? `Profit includes an exceptional item of ${cr0(L.exceptional)} in ${L.label}; before it, profit before tax was ${cr0(L.pbt - L.exceptional)}.` : null,
      presLine(sym, "bank"),
      valLine(sym),
      sym === "HDFCBANK" ? "HDFC Ltd merged into HDFC Bank on 1 July 2023, so growth rates from Q2FY24 to Q1FY25 compare the merged bank with the pre-merger bank." : null,
      Q.some(r => r.derived) ? `Quarters rebuilt from year-to-date figures (standalone filing missing on NSE): ${Q.filter(r => r.derived).map(r => r.label).join(", ")}.` : null,
    ].filter(Boolean);
    lines.forEach(s => { const x = document.createElement("li"); x.textContent = s; tk.append(x); });
    // tiles
    const tb = document.getElementById("bank-tiles"); tb.replaceChildren();
    [
      { label: "Net interest income", value: n0(L.nii), unit: " cr", chip: yoyChip(L.nii_yoy), sub: L.label },
      { label: "Net profit", value: n0(L.pat), unit: " cr", chip: yoyChip(L.pat_yoy), sub: L.label },
      { label: "Cost-to-income", value: n1(L.cost_to_income), unit: "%", chip: [yAgo && yAgo.cost_to_income != null ? pp(L.cost_to_income - yAgo.cost_to_income) + " YoY" : "–", yAgo && L.cost_to_income <= yAgo.cost_to_income ? "up" : "down"], sub: "Opex / (NII + other income)" },
      { label: "Return on assets", value: n2(L.roa), unit: "%", chip: [yAgo && yAgo.roa != null ? pp(L.roa - yAgo.roa) + " YoY" : "–", yAgo && L.roa >= yAgo.roa ? "up" : "down"], sub: "Annualised" },
      { label: "Gross NPA", value: n2(L.gnpa_pct), unit: "%", chip: [`Net ${n2(L.nnpa_pct)}%`, "flat"], sub: `Coverage ${n0(L.pcr)}% excl. write-offs` },
      { label: "CET1 ratio", value: n2(L.cet1), unit: "%", chip: [`Tier 1 ${n2(L.tier1)}%`, "flat"], sub: "Common equity tier 1" },
      bs ? { label: "Credit-to-deposit", value: n1(bs.cd_ratio), unit: "%", chip: [`Book value ₹${n0(bs.bvps)}`, "flat"], sub: `Balance sheet ${bs.label}` } : null,
    ].filter(Boolean).forEach(t => {
      const d = document.createElement("div"); d.className = "tile";
      const l = document.createElement("div"); l.className = "label"; l.textContent = t.label;
      const v = document.createElement("div"); v.className = "value"; v.textContent = t.value; const u = document.createElement("small"); u.textContent = t.unit; v.append(u);
      const c = document.createElement("div"); c.className = "chip " + t.chip[1]; c.textContent = t.chip[0];
      const s = document.createElement("div"); s.className = "sub"; s.textContent = t.sub;
      d.append(l, v, c, s); tb.append(d);
    });
    // charts
    const S = k => Q.map(r => [r.period_end, r[k]]);
    const pl = [{ name: "Net interest income", short: "NII", color: C.s1, data: S("nii") }, { name: "Operating profit (PPOP)", short: "PPOP", color: C.s2, data: S("ppop") }, { name: "Net profit", short: "Net profit", color: C.s3, data: S("pat") }];
    legend("lg-b-pl", pl.map(s => ({ name: s.name, color: s.color })));
    register("c-b-pl", (b, w) => lineChart(b, w, { series: pl, yFmt: v => n0(v / 1000) + "k", valFmt: v => "₹" + n0(v) + " cr", include: [0], gapDays: 100, endLabels: true, aria: "Quarterly NII, PPOP and profit" }));
    const bsRows = Q.filter(r => r.deposits != null).map(r => ({ label: r.label, dep: r.deposits / 1e5, adv: r.advances / 1e5, extra: [{ name: "Credit-to-deposit", value: pct(r.cd_ratio), color: "transparent" }] }));
    legend("lg-b-bs", [{ name: "Deposits", color: C.s1, box: true }, { name: "Advances", color: C.s2, box: true }]);
    register("c-b-bs", (b, w) => barsVG(b, w, { rows: bsRows, keys: [{ key: "dep", name: "Deposits", color: C.s1 }, { key: "adv", name: "Advances", color: C.s2 }], fmt: v => "₹" + n2(v) + " lakh cr", tickFmt: v => n1(v), empty: "No balance sheet in this bank's XBRL filings.", aria: "Deposits and advances" }));
    const npa = [{ name: "Gross NPA %", color: C.s2, data: S("gnpa_pct") }, { name: "Net NPA %", color: C.s1, data: S("nnpa_pct") }];
    legend("lg-b-npa", npa.map(s => ({ name: s.name, color: s.color })));
    register("c-b-npa", (b, w) => lineChart(b, w, { series: npa, yFmt: v => n1(v), valFmt: v => n2(v) + "%", include: [0], gapDays: 100, height: 220, aria: "NPA ratios" }));
    const eff = [{ name: "Cost-to-income", color: C.s1, data: S("cost_to_income") }, { name: "Provisions / operating profit", color: C.s2, data: S("prov_to_ppop") }];
    legend("lg-b-eff", eff.map(s => ({ name: s.name, color: s.color })));
    register("c-b-eff", (b, w) => lineChart(b, w, { series: eff, yFmt: v => n0(v), valFmt: pct, include: [0], gapDays: 100, height: 220, aria: "Efficiency" }));
    const ret = [{ name: "Return on assets", color: C.s1, data: S("roa") }, { name: "CET1 ratio", color: C.s3, data: S("cet1") }];
    legend("lg-b-ret", ret.map(s => ({ name: s.name, color: s.color })));
    register("c-b-ret", (b, w) => lineChart(b, w, { series: ret, yFmt: v => n0(v), valFmt: v => n2(v) + "%", include: [0], gapDays: 100, height: 220, aria: "Returns and capital" }));
    renderSnapshot(Q, F);
    document.querySelectorAll("#t-peer tbody tr").forEach(tr => tr.classList.toggle("on", tr.dataset.sym === sym));
  }

  function renderSnapshot(Q, F) {
    const qs = Q.slice(-8), fys = F.slice(-3);
    document.getElementById("cap-b-tbl").textContent = `Last ${qs.length} quarters and ${fys.length} financial years, ₹ crore unless stated. Return on equity, margin and cost-of-funds figures use average opening and closing balances.`;
    const rows = [
      ["Income statement"],
      ["Interest earned", "interest_earned", n0], ["Interest expended", "interest_expended", n0],
      ["Net interest income", "nii", n0], ["  growth YoY %", "nii_yoy", n1, "sub"], ["  growth QoQ %", "nii_qoq", n1, "sub", true],
      ["Other income", "other_income", n0], ["Operating expenses", "opex", n0], ["  employee cost", "employee_cost", n0, "sub", true], ["  other expenses", "other_opex", n0, "sub", true],
      ["Operating profit (PPOP)", "ppop", n0], ["  growth YoY %", "ppop_yoy", n1, "sub"],
      ["Provisions", "provisions", n0], ["Exceptional items", "exceptional", n0], ["Profit before tax", "pbt", n0], ["Tax", "tax", n0], ["  effective tax rate %", "tax_rate", n1, "sub", true],
      ["Net profit", "pat", n0], ["  growth YoY %", "pat_yoy", n1, "sub"], ["  growth QoQ %", "pat_qoq", n1, "sub", true], ["EPS ₹", "eps", n2, null, true],
      ["Ratios, %"],
      ["NII / interest earned", "nii_to_int_income", n1, null, true], ["Operating margin (NII − opex) / interest", "opm", n1, null, true],
      ["Other income / total income", "other_inc_share", n1, null, true], ["Cost-to-income", "cost_to_income", n1], ["Provisions / PPOP", "prov_to_ppop", n1, null, true],
      ["Return on assets", "roa", n2], ["Return on equity", "roe", n2, null, false, true], ["NII / average assets", "nim_assets", n2, null, false, true],
      ["Yield on advances", "yield_advances", n2, null, false, true], ["Cost of funds", "cost_of_funds", n2, null, false, true], ["Credit cost", "credit_cost", n2, null, false, true],
      ["Asset quality"],
      ["Gross NPAs", "gnpa", n0, null, true], ["Net NPAs", "nnpa", n0, null, true], ["Gross NPA %", "gnpa_pct", n2], ["Net NPA %", "nnpa_pct", n2], ["Provision coverage %", "pcr", n1],
      ["Capital & balance sheet"],
      ["CET1 %", "cet1", n2], ["Tier 1 %", "tier1", n2, null, true],
      ["Deposits", "deposits", n0], ["  growth YoY %", "deposits_yoy", n1, "sub"], ["Advances", "advances", n0], ["  growth YoY %", "advances_yoy", n1, "sub"],
      ["Credit-to-deposit %", "cd_ratio", n1, null, true], ["Book value per share ₹", "bvps", n1],
    ];
    const t = document.createElement("table"), thead = document.createElement("thead"), hr = document.createElement("tr");
    const th0 = document.createElement("th"); th0.textContent = "₹ crore"; hr.append(th0);
    qs.forEach(r => { const th = document.createElement("th"); th.textContent = r.label + (r.derived ? "*" : ""); hr.append(th); });
    fys.forEach(r => { const th = document.createElement("th"); th.className = "fy"; th.textContent = r.label; hr.append(th); });
    thead.append(hr); t.append(thead);
    const tb = document.createElement("tbody");
    rows.forEach(([lab, key, f, cls, qOnly, fyOnly]) => {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td"); td0.textContent = lab; tr.append(td0);
      if (!key) { tr.className = "sec"; td0.colSpan = 1 + qs.length + fys.length; tb.append(tr); return; }
      if (cls) tr.className = cls;
      qs.forEach(r => { const td = document.createElement("td"); td.textContent = fyOnly ? "" : (r[key] == null ? "–" : f(r[key])); tr.append(td); });
      fys.forEach(r => { const td = document.createElement("td"); td.className = "fy"; td.textContent = qOnly || !(key in r) ? "" : (r[key] == null ? "–" : f(r[key])); tr.append(td); });
      tb.append(tr);
    });
    t.append(tb); document.getElementById("t-bank").replaceChildren(t);
  }

  // peer table
  const peers = B.banks.map(b => {
    const Q = B.q[b.symbol], L = Q[Q.length - 1], bs = lastWith(Q, "deposits") || {};
    return { symbol: b.symbol, bank: b.short, group: b.group, quarter: L.label, nii: L.nii, nii_yoy: L.nii_yoy, pat: L.pat, pat_yoy: L.pat_yoy, cti: L.cost_to_income, roa: L.roa, gnpa: L.gnpa_pct, nnpa: L.nnpa_pct, pcr: L.pcr, cet1: L.cet1, dep_yoy: bs.deposits_yoy, adv_yoy: bs.advances_yoy, cd: bs.cd_ratio, pb: (VAL[b.symbol] || {}).pb, mcap: (VAL[b.symbol] || {}).mcap, casa: ((PRES[b.symbol] || {}).casa_pct || {}).value };
  });
  const counts = peers.reduce((m, p) => (m[p.quarter] = (m[p.quarter] || 0) + 1, m), {});
  const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const ahead = peers.filter(p => p.quarter !== common).map(p => `${p.bank} (${p.quarter})`);
  document.getElementById("cap-peer").textContent = `Each bank's latest quarter: ${common} for ${counts[common]} banks${ahead.length ? `; ${ahead.join(", ")}` : ""}. Balance-sheet growth is from the latest half-year. Click a row to open that bank above; click a column to sort.`;
  let pg = "All";
  const fp = document.getElementById("f-peer");
  const tone = ["pos", "neg"];
  const renderPeers = sortTable(document.getElementById("t-peer"), [
    { key: "bank", label: "Bank" }, { key: "group", label: "Group" }, { key: "quarter", label: "Quarter" },
    { key: "nii", label: "NII ₹ cr", num: true, fmt: n0 }, { key: "nii_yoy", label: "NII YoY %", num: true, fmt: n1, tone },
    { key: "pat", label: "Profit ₹ cr", num: true, fmt: n0 }, { key: "pat_yoy", label: "Profit YoY %", num: true, fmt: n1, tone },
    { key: "cti", label: "Cost/income %", num: true, fmt: n1 }, { key: "roa", label: "RoA %", num: true, fmt: n2 },
    { key: "gnpa", label: "GNPA %", num: true, fmt: n2 }, { key: "nnpa", label: "NNPA %", num: true, fmt: n2 }, { key: "pcr", label: "PCR %", num: true, fmt: n1 },
    { key: "cet1", label: "CET1 %", num: true, fmt: n2 }, { key: "dep_yoy", label: "Deposits YoY %", num: true, fmt: n1, tone }, { key: "adv_yoy", label: "Advances YoY %", num: true, fmt: n1, tone }, { key: "cd", label: "C/D %", num: true, fmt: n1 },
    { key: "casa", label: "CASA %", num: true, fmt: n1 },
    { key: "mcap", label: "Mkt cap ₹ cr", num: true, fmt: n0 }, { key: "pb", label: "P/B ×", num: true, fmt: n2 },
  ], () => peers.filter(p => pg === "All" || p.group === pg), { key: "nii", dir: -1 });
  const host = document.getElementById("t-peer");
  const decorate = () => host.querySelectorAll("tbody tr").forEach(tr => {
    const name = tr.firstChild.textContent, p = peers.find(x => x.bank === name);
    if (!p) return; tr.dataset.sym = p.symbol; tr.tabIndex = 0; tr.classList.toggle("on", p.symbol === sel.value);
  });
  new MutationObserver(decorate).observe(host, { childList: true });
  decorate();
  const pick = sym => go(sym);
  host.addEventListener("click", ev => { const tr = ev.target.closest("tbody tr"); if (tr && tr.dataset.sym) pick(tr.dataset.sym); });
  host.addEventListener("keydown", ev => { const tr = ev.target.closest("tbody tr"); if (tr && tr.dataset.sym && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); pick(tr.dataset.sym); } });
  [["All", "All banks"], ["Private", "Private"], ["PSU", "PSU"], ["SFB", "Small finance"]].forEach(([k, lab]) => {
    const b = document.createElement("button"); b.textContent = lab; b.setAttribute("aria-pressed", k === pg);
    b.addEventListener("click", () => { pg = k; fp.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderPeers(); });
    fp.append(b);
  });
  if (!B.q[start]) start = B.banks[0].symbol;
  sel.value = start; renderBank(start);
  sel.addEventListener("change", () => go(sel.value));
  return (s: string) => { if (!B.q[s]) return; sel.value = s; renderBank(s); };
}

export function renderNbfcs(start: string, go: (sym: string) => void) {
  if (!(D.nbfcs && D.nbfcs.cos.length)) return null;
  const N = D.nbfcs, sel = document.getElementById("nbfc-sel");
  const GROUPS = [["NBFC", "NBFCs"], ["HFC", "Housing finance companies"], ["Govt", "Government-owned lenders"]];
  GROUPS.forEach(([g, lab]) => {
    const og = document.createElement("optgroup"); og.label = lab;
    N.cos.filter(b => b.group === g).forEach(b => { const o = document.createElement("option"); o.value = b.symbol; o.textContent = b.name; og.append(o); });
    if (og.children.length) sel.append(og);
  });
  const cr0 = v => v == null ? "–" : "₹" + n0(v) + " cr";
  const lastWith = (rows, k) => [...rows].reverse().find(r => r[k] != null);
  const yoyTxt = v => v == null ? "–" : sgn(v) + n1(Math.abs(v)) + "% YoY";
  const yoyChip = v => v == null ? ["–", "flat"] : [yoyTxt(v), v >= 0 ? "up" : "down"];
  const groupName = g => GROUPS.find(x => x[0] === g)[1];

  function renderCo(sym) {
    const co = N.cos.find(b => b.symbol === sym), Q = N.q[sym], F = N.fy[sym];
    const L = Q[Q.length - 1], bs = lastWith(Q, "loans"), fyL = F.length ? F[F.length - 1] : null;
    const yAgo = Q.find(r => r.period_end === (+L.period_end.slice(0, 4) - 1) + L.period_end.slice(4));
    document.getElementById("nbfc-meta").textContent = `${co.symbol} · ${groupName(co.group).replace(/ies$/, "y").replace(/s$/, "")} · ${Q.length} quarters, ${Q[0].label}–${L.label}`;
    const tk = document.getElementById("tk-nbfc"); tk.replaceChildren();
    [
      `${L.label}: total income ${cr0(L.total_income)} (${yoyTxt(L.total_income_yoy)}), net interest income ${cr0(L.nii)} (${yoyTxt(L.nii_yoy)}), net profit ${cr0(L.pat)} (${yoyTxt(L.pat_yoy)}).`,
      L.credit_cost_ann != null ? `Credit cost ${n2(L.credit_cost_ann)}% of loans annualised${yAgo && yAgo.credit_cost_ann != null ? ` (a year earlier ${n2(yAgo.credit_cost_ann)}%)` : ""}; impairment took ${n0(L.credit_cost_to_ppop)}% of operating profit.` : null,
      bs ? `At ${bs.label} loans were ${cr0(bs.loans)} (${yoyTxt(bs.loans_yoy)}), funded with net worth of ${cr0(bs.net_worth)}; assets are ${n1(bs.leverage)}× net worth.` : null,
      fyL && fyL.roa != null ? `${fyL.label}: return on assets ${n2(fyL.roa)}%, return on equity ${n1(fyL.roe)}%; yield on loans ${n1(fyL.yield_loans)}% against cost of borrowings ${n1(fyL.cost_of_borrowings)}%.` : null,
      L.exceptional ? `${L.label} profit includes an exceptional item of ${cr0(L.exceptional)}.` : null,
      presLine(sym, "nbfc"),
      valLine(sym),
      Q.some(r => r.derived) ? `Quarters rebuilt from year-to-date figures (standalone filing missing on NSE): ${Q.filter(r => r.derived).map(r => r.label).join(", ")}.` : null,
      Q.some(r => r.impairment_est) ? `Filed on SEBI's generic template, with no impairment line, in ${Q.filter(r => r.impairment_est).map(r => r.label).join(", ")}; impairment there is estimated as the untagged part of total expenses.` : null,
      co.note,
    ].filter(Boolean).forEach(s => { const x = document.createElement("li"); x.textContent = s; tk.append(x); });
    const tb = document.getElementById("nbfc-tiles"); tb.replaceChildren();
    [
      { label: "Total income", value: n0(L.total_income), unit: " cr", chip: yoyChip(L.total_income_yoy), sub: L.label },
      { label: "Net interest income", value: n0(L.nii), unit: " cr", chip: yoyChip(L.nii_yoy), sub: "Interest earned − finance costs" },
      { label: "Net profit", value: n0(L.pat), unit: " cr", chip: yoyChip(L.pat_yoy), sub: L.label },
      { label: "Cost-to-income", value: n1(L.cost_to_income), unit: "%", chip: [yAgo && yAgo.cost_to_income != null ? pp(L.cost_to_income - yAgo.cost_to_income) + " YoY" : "–", yAgo && L.cost_to_income <= yAgo.cost_to_income ? "up" : "down"], sub: "Opex / net total income" },
      { label: "Credit cost", value: n2(L.credit_cost_ann), unit: "%", chip: [yAgo && yAgo.credit_cost_ann != null ? pp(L.credit_cost_ann - yAgo.credit_cost_ann) + " YoY" : "–", yAgo && L.credit_cost_ann <= yAgo.credit_cost_ann ? "up" : "down"], sub: "Impairment, annualised, % loans" },
      { label: "Return on equity", value: n1(L.roe_ann), unit: "%", chip: [`RoA ${n2(L.roa_ann)}%`, "flat"], sub: "Quarter, annualised" },
      bs ? { label: "Loans", value: n0(bs.loans / 1000), unit: "k cr", chip: yoyChip(bs.loans_yoy), sub: `Book value ₹${n0(bs.bvps)} · ${bs.label}` } : null,
    ].filter(Boolean).forEach(t => {
      const d = document.createElement("div"); d.className = "tile";
      const l = document.createElement("div"); l.className = "label"; l.textContent = t.label;
      const v = document.createElement("div"); v.className = "value"; v.textContent = t.value; const u = document.createElement("small"); u.textContent = t.unit; v.append(u);
      const c = document.createElement("div"); c.className = "chip " + t.chip[1]; c.textContent = t.chip[0];
      const s = document.createElement("div"); s.className = "sub"; s.textContent = t.sub;
      d.append(l, v, c, s); tb.append(d);
    });
    const S = k => Q.map(r => [r.period_end, r[k]]);
    const pl = [{ name: "Total income", short: "Income", color: C.s1, data: S("total_income") }, { name: "Net interest income", short: "NII", color: C.s2, data: S("nii") }, { name: "Net profit", short: "Profit", color: C.s3, data: S("pat") }];
    legend("lg-n-pl", pl.map(s => ({ name: s.name, color: s.color })));
    register("c-n-pl", (b, w) => lineChart(b, w, { series: pl, yFmt: v => Math.abs(v) >= 1000 ? n0(v / 1000) + "k" : n0(v), valFmt: v => "₹" + n0(v) + " cr", include: [0], gapDays: 100, endLabels: true, aria: "Quarterly income, NII and profit" }));
    const bsRows = Q.filter(r => r.loans != null).map(r => ({ label: r.label, loans: r.loans / 1000, nw: r.net_worth / 1000, extra: [{ name: "Assets / net worth", value: r.leverage == null ? "–" : n1(r.leverage) + "×", color: "transparent" }] }));
    legend("lg-n-bs", [{ name: "Loans", color: C.s1, box: true }, { name: "Net worth", color: C.s3, box: true }]);
    register("c-n-bs", (b, w) => barsVG(b, w, { rows: bsRows, keys: [{ key: "loans", name: "Loans", color: C.s1 }, { key: "nw", name: "Net worth", color: C.s3 }], fmt: v => "₹" + n1(v) + "k cr", tickFmt: v => n0(v), empty: "No balance sheet in this company's XBRL filings.", aria: "Loans and net worth" }));
    register("c-n-cc", (b, w) => lineChart(b, w, { series: [{ name: "Credit cost", color: C.s2, data: S("credit_cost_ann") }], yFmt: v => n1(v), valFmt: v => n2(v) + "%", include: [0], gapDays: 100, height: 220, aria: "Credit cost" }));
    const eff = [{ name: "Cost-to-income", color: C.s1, data: S("cost_to_income") }, { name: "Impairment / operating profit", color: C.s2, data: S("credit_cost_to_ppop") }];
    legend("lg-n-eff", eff.map(s => ({ name: s.name, color: s.color })));
    register("c-n-eff", (b, w) => lineChart(b, w, { series: eff, yFmt: v => n0(v), valFmt: pct, include: [0], gapDays: 100, height: 220, aria: "Efficiency" }));
    const ret = [{ name: "Return on equity", color: C.s3, data: S("roe_ann") }, { name: "Return on assets", color: C.s1, data: S("roa_ann") }];
    legend("lg-n-ret", ret.map(s => ({ name: s.name, color: s.color })));
    register("c-n-ret", (b, w) => lineChart(b, w, { series: ret, yFmt: v => n0(v), valFmt: v => n2(v) + "%", include: [0], gapDays: 100, height: 220, aria: "Returns" }));
    renderSnapshot(Q, F);
    document.querySelectorAll("#t-npeer tbody tr").forEach(tr => tr.classList.toggle("on", tr.dataset.sym === sym));
  }

  function renderSnapshot(Q, F) {
    const qs = Q.slice(-8), fys = F.slice(-3);
    document.getElementById("cap-n-tbl").textContent = `Last ${qs.length} quarters and ${fys.length} financial years, ₹ crore unless stated, laid out like Indus Equity's snapshot (expenditure excludes interest). Quarters are as first reported; full years are the audited figures from the March filing, so the quarters may not add up to the year. Full-year returns use average opening and closing balances. * rebuilt from year-to-date figures; † impairment estimated.`;
    const rows = [
      ["Income statement"],
      ["Revenue from operations", "revenue_ops", n0], ["  growth YoY %", "revenue_ops_yoy", n1, "sub"], ["  growth QoQ %", "revenue_ops_qoq", n1, "sub", true],
      ["  of which interest income", "interest_income", n0, "sub"], ["  fees and commission", "fee_income", n0, "sub"],
      ["Other income", "other_income", n0], ["Total income", "total_income", n0], ["  growth YoY %", "total_income_yoy", n1, "sub"],
      ["Employee cost", "employee_cost", n0], ["Other expenses (incl. fees, commission)", "other_opex", n0], ["Impairment (loan loss)", "impairment", n0], ["Depreciation", "depreciation", n0],
      ["Total expenditure ex-interest", "expenditure_ex_int", n0, null, true], ["  growth YoY %", "expenditure_ex_int_yoy", n1, "sub", true],
      ["Interest expense (finance costs)", "finance_cost", n0], ["  growth YoY %", "finance_cost_yoy", n1, "sub", true],
      ["Net interest income", "nii", n0], ["  growth YoY %", "nii_yoy", n1, "sub"],
      ["Exceptional items", "exceptional", n0], ["Profit before tax", "pbt", n0], ["Tax", "tax", n0], ["  effective tax rate %", "tax_rate", n1, "sub", true],
      ["Net profit", "pat", n0], ["  growth YoY %", "pat_yoy", n1, "sub"], ["  growth QoQ %", "pat_qoq", n1, "sub", true], ["EPS ₹", "eps", n2],
      ["Cost ratios, % of total income"],
      ["Employee cost", "employee_cost_pct_ti", n1, null, true], ["Other expenses", "other_opex_pct_ti", n1, null, true], ["Impairment", "impairment_pct_ti", n1, null, true],
      ["Interest expense", "finance_cost_pct_ti", n1, null, true], ["Net profit margin", "pat_margin", n1, null, true],
      ["Ratios, %"],
      ["Cost-to-income", "cost_to_income", n1], ["Credit cost (annualised, % loans)", "credit_cost_ann", n2, null, true], ["Credit cost (% avg loans)", "credit_cost", n2, null, false, true],
      ["Return on assets", "roa", n2, null, false, true], ["Return on equity", "roe", n1, null, false, true], ["NII / average assets", "nim_assets", n2, null, false, true],
      ["Yield on loans", "yield_loans", n2, null, false, true], ["Cost of borrowings", "cost_of_borrowings", n2, null, false, true], ["Spread", "spread", n2, null, false, true],
      ["Opex / average assets", "opex_to_assets", n2, null, false, true],
      ["Balance sheet"],
      ["Loans", "loans", n0], ["  growth YoY %", "loans_yoy", n1, "sub"], ["Borrowings (incl. debt securities, deposits)", "borrowings_total", n0],
      ["Net worth", "net_worth", n0], ["Assets / net worth ×", "leverage", n1], ["Book value per share ₹", "bvps", n1],
    ];
    const t = document.createElement("table"), thead = document.createElement("thead"), hr = document.createElement("tr");
    const th0 = document.createElement("th"); th0.textContent = "₹ crore"; hr.append(th0);
    qs.forEach(r => { const th = document.createElement("th"); th.textContent = r.label + (r.derived ? "*" : "") + (r.impairment_est ? "†" : ""); hr.append(th); });
    fys.forEach(r => { const th = document.createElement("th"); th.className = "fy"; th.textContent = r.label; hr.append(th); });
    thead.append(hr); t.append(thead);
    const tb = document.createElement("tbody");
    rows.forEach(([lab, key, f, cls, qOnly, fyOnly]) => {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td"); td0.textContent = lab; tr.append(td0);
      if (!key) { tr.className = "sec"; td0.colSpan = 1 + qs.length + fys.length; tb.append(tr); return; }
      if (cls) tr.className = cls;
      qs.forEach(r => { const td = document.createElement("td"); td.textContent = fyOnly ? "" : (r[key] == null ? "–" : f(r[key])); tr.append(td); });
      fys.forEach(r => { const td = document.createElement("td"); td.className = "fy"; td.textContent = qOnly || !(key in r) ? "" : (r[key] == null ? "–" : f(r[key])); tr.append(td); });
      tb.append(tr);
    });
    t.append(tb); document.getElementById("t-nbfc").replaceChildren(t);
  }

  const peers = N.cos.map(b => {
    const Q = N.q[b.symbol], L = Q[Q.length - 1], bs = lastWith(Q, "loans") || {}, F = N.fy[b.symbol], f = F.length ? F[F.length - 1] : {};
    return { symbol: b.symbol, co: b.short, group: b.group, quarter: L.label, ti: L.total_income, ti_yoy: L.total_income_yoy, pat: L.pat, pat_yoy: L.pat_yoy,
      cti: L.cost_to_income, cc: L.credit_cost_ann, roe: L.roe_ann, loans: bs.loans, loans_yoy: bs.loans_yoy, lev: bs.leverage, fy_roa: f.roa, fy_spread: f.spread, pb: (VAL[b.symbol] || {}).pb, mcap: (VAL[b.symbol] || {}).mcap,
      aum: ((PRES[b.symbol] || {}).aum_cr || {}).value, gs3: ((PRES[b.symbol] || {}).gnpa_pct || {}).value };
  });
  const counts = peers.reduce((m, p) => (m[p.quarter] = (m[p.quarter] || 0) + 1, m), {});
  const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const other = peers.filter(p => p.quarter !== common).map(p => `${p.co} (${p.quarter})`);
  document.getElementById("cap-npeer").textContent = `Each company's latest quarter: ${common} for ${counts[common]} companies${other.length ? `; ${other.join(", ")}` : ""}. Loans are from the latest half-year balance sheet; RoA and spread are for the latest full financial year. Click a row to open that company above; click a column to sort.`;
  let pg = "All";
  const fp = document.getElementById("f-npeer"), tone = ["pos", "neg"];
  const renderPeers = sortTable(document.getElementById("t-npeer"), [
    { key: "co", label: "Company" }, { key: "group", label: "Group" }, { key: "quarter", label: "Quarter" },
    { key: "ti", label: "Income ₹ cr", num: true, fmt: n0 }, { key: "ti_yoy", label: "Income YoY %", num: true, fmt: n1, tone },
    { key: "pat", label: "Profit ₹ cr", num: true, fmt: n0 }, { key: "pat_yoy", label: "Profit YoY %", num: true, fmt: n1, tone },
    { key: "cti", label: "Cost/income %", num: true, fmt: n1 }, { key: "cc", label: "Credit cost %", num: true, fmt: n2 }, { key: "roe", label: "RoE % (ann.)", num: true, fmt: n1 },
    { key: "loans", label: "Loans ₹ cr", num: true, fmt: n0 }, { key: "loans_yoy", label: "Loans YoY %", num: true, fmt: n1, tone }, { key: "lev", label: "Assets/NW ×", num: true, fmt: n1 },
    { key: "fy_roa", label: "FY RoA %", num: true, fmt: n2 }, { key: "fy_spread", label: "FY spread %", num: true, fmt: n2 },
    { key: "aum", label: "AUM ₹ cr", num: true, fmt: n0 }, { key: "gs3", label: "Gross stage 3 %", num: true, fmt: n2 },
    { key: "mcap", label: "Mkt cap ₹ cr", num: true, fmt: n0 }, { key: "pb", label: "P/B ×", num: true, fmt: n2 },
  ], () => peers.filter(p => pg === "All" || p.group === pg), { key: "ti", dir: -1 });
  const host = document.getElementById("t-npeer");
  const decorate = () => host.querySelectorAll("tbody tr").forEach(tr => {
    const p = peers.find(x => x.co === tr.firstChild.textContent);
    if (!p) return; tr.dataset.sym = p.symbol; tr.tabIndex = 0; tr.classList.toggle("on", p.symbol === sel.value);
  });
  new MutationObserver(decorate).observe(host, { childList: true });
  decorate();
  const pick = sym => go(sym);
  host.addEventListener("click", ev => { const tr = ev.target.closest("tbody tr"); if (tr && tr.dataset.sym) pick(tr.dataset.sym); });
  host.addEventListener("keydown", ev => { const tr = ev.target.closest("tbody tr"); if (tr && tr.dataset.sym && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); pick(tr.dataset.sym); } });
  [["All", "All"], ["NBFC", "NBFCs"], ["HFC", "HFCs"], ["Govt", "Government"]].forEach(([k, lab]) => {
    const b = document.createElement("button"); b.textContent = lab; b.setAttribute("aria-pressed", k === pg);
    b.addEventListener("click", () => { pg = k; fp.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderPeers(); });
    fp.append(b);
  });
  if (!N.q[start]) start = N.cos[0].symbol;
  sel.value = start; renderCo(start);
  sel.addEventListener("change", () => go(sel.value));
  return (s: string) => { if (!N.q[s]) return; sel.value = s; renderCo(s); };
}

export function renderValuations() {
  if (!(D.val && D.val.rows.length)) return;
  const R = D.val.rows, when = new Date(D.val.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const GROUPS = [["Private", "Private banks", C.s2], ["PSU", "PSU banks", C.s1], ["SFB", "Small finance banks", C.s4], ["NBFC", "NBFCs", C.s7], ["HFC", "HFCs", C.s3], ["Govt", "Govt lenders", C.s5]];
  const gcol = g => (GROUPS.find(x => x[0] === g) || [, , C.muted])[2], glab = g => (GROUPS.find(x => x[0] === g) || [, g])[1];
  const lakh = v => v == null ? "–" : "₹" + n2(v / 1e5) + " lakh cr";
  const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  const banks = R.filter(r => r.sector === "Bank"), nb = R.filter(r => r.sector === "NBFC");
  const total = k => R.filter(r => r.sector === k).reduce((s, r) => s + (r.mcap || 0), 0);
  const top = [...R].sort((a, b) => b.mcap - a.mcap);
  const tk = document.getElementById("tk-val");
  [
    `At the close on ${when} the ${banks.length} banks were worth ${lakh(total("Bank"))} and the ${nb.length} NBFCs and HFCs ${lakh(total("NBFC"))}. The largest: ${top.slice(0, 3).map(r => `${r.short} ${lakh(r.mcap)}`).join(", ")}.`,
    (() => {
      const g = k => R.filter(r => r.group === k && r.roe != null && r.roe > 0);
      const s = k => `${n0(med(g(k).map(r => r.roe)))}% at ${n1(med(g(k).map(r => r.pb)))}× book`;
      return `Returns explain only part of the gap. Median return on equity and price-to-book: PSU banks ${s("PSU")}, private banks ${s("Private")}, NBFCs ${s("NBFC")}, HFCs ${s("HFC")}.`;
    })(),
  ].forEach(s => { const x = document.createElement("li"); x.textContent = s; tk.append(x); });
  const neg = R.filter(r => r.roe != null && r.roe < 0), sc = R.filter(r => r.roe != null && r.roe >= 0 && r.pb != null);
  document.getElementById("cap-val-sc").textContent = `Each dot is a lender: market cap over latest net worth (y) against return on equity for the latest full year (x). ${neg.length ? `Not shown, loss-making in the year: ${neg.map(r => r.short).join(", ")}.` : ""} ${R.filter(r => r.roe == null).length ? `No full-year RoE yet: ${R.filter(r => r.roe == null).map(r => r.short).join(", ")}.` : ""}`;
  legend("lg-val-sc", GROUPS.map(g => ({ name: g[1], color: g[2], box: true })));
  const labelled = new Set(top.slice(0, 8).map(r => r.symbol).concat(sc.filter(r => r.pb > 4.5).map(r => r.symbol)));
  const pts = sc.map(r => ({ x: r.roe, y: r.pb, color: gcol(r.group), label: labelled.has(r.symbol) ? r.short : null, name: r.name,
    rows: [{ name: "Price / book", value: n2(r.pb) + "×", color: gcol(r.group), box: true }, { name: `RoE ${r.roe_label}`, value: n1(r.roe) + "%", color: "transparent" },
           { name: "Market cap", value: lakh(r.mcap), color: "transparent" }, { name: "P/E (trailing)", value: r.pe == null ? "–" : n1(r.pe) + "×", color: "transparent" }] }));
  register("c-val-sc", (b, w) => scatter(b, w, { points: pts, xFmt: v => n0(v) + "%", yFmt: v => n1(v) + "×", xTitle: "Return on equity, latest FY", yTitle: "Price / book", aria: "Price to book against return on equity" }));
  document.getElementById("cap-val").textContent = `Prices are NSE closes on ${when}. Market cap uses shares from the latest results filing, adjusted for any split or bonus since. Price-to-book uses the latest half-year net worth; P/E uses the last four quarters' standalone profit. The 1-year change is in market cap, so it includes new shares issued. Click a column to sort.`;
  let vg = "All";
  const tone = ["pos", "neg"];
  const renderVal = sortTable(document.getElementById("t-val"), [
    { key: "short", label: "Lender" }, { key: "glab", label: "Group" }, { key: "close", label: "Price ₹", num: true, fmt: n1 },
    { key: "mcap", label: "Market cap ₹ cr", num: true, fmt: n0 }, { key: "chg", label: "1-yr change %", num: true, fmt: n1, tone },
    { key: "pb", label: "P/B ×", num: true, fmt: n2 }, { key: "pe", label: "P/E ×", num: true, fmt: n1 }, { key: "roe", label: "RoE % (FY)", num: true, fmt: n1 },
    { key: "bs_label", label: "Book as of" },
  ], () => R.map(r => ({ ...r, glab: glab(r.group) })).filter(r => vg === "All" || (vg === "Bank" ? r.sector === "Bank" : vg === "NBFC" ? r.sector === "NBFC" : r.group === vg)), { key: "mcap", dir: -1 });
  const fv = document.getElementById("f-val");
  [["All", "All"], ["Bank", "Banks"], ["NBFC", "NBFCs & HFCs"], ["Private", "Private banks"], ["PSU", "PSU banks"], ["SFB", "Small finance"], ["HFC", "HFCs"], ["Govt", "Govt lenders"]].forEach(([k, lab]) => {
    const b = document.createElement("button"); b.textContent = lab; b.setAttribute("aria-pressed", k === vg);
    b.addEventListener("click", () => { vg = k; fv.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderVal(); });
    fv.append(b);
  });
}

export function renderSources() {
  const ul = document.getElementById("caveats");
  D.notes.notes.forEach(n => { const x = document.createElement("li"); x.textContent = n.note; ul.append(x); });
  [
    "CPI base changed from 2012 to 2024 in January 2026, so inflation and real-rate series mix two baskets. April 2026 repo decision is inferred as a hold.",
    "Bank results are standalone and as first reported each quarter; banks sometimes restate earlier quarters in the year-end filing, so four quarters may not sum exactly to the annual figure.",
    "Bank balance sheets (deposits, advances, net worth) appear in XBRL only in September and March filings, and only from FY23–FY24 onward for most banks. Provision coverage excludes technical write-offs.",
    "NBFC and HFC figures are standalone, so they differ from the consolidated AUM and asset-quality figures companies headline in presentations. Loans are on-book loans net of impairment allowance, not AUM. Quarterly credit cost and returns are annualised against the latest half-year balance sheet.",
  ].forEach(s => { const x = document.createElement("li"); x.textContent = s; ul.append(x); });
}
