// @ts-nocheck -- chart engine carried over from the single-page report, kept as plain DOM/SVG code.
/* ---------- formatting ---------- */
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(Date.UTC(y, m-1, d||1)); };
const fm = s => { const d = typeof s === "string" ? pd(s) : s; return MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); };
const fms = s => { const d = typeof s === "string" ? pd(s) : s; return MON[d.getUTCMonth()] + " ’" + String(d.getUTCFullYear()).slice(2); };
const n1 = v => v == null ? "–" : v.toLocaleString("en-IN", {maximumFractionDigits: 1, minimumFractionDigits: 1});
const n2 = v => v == null ? "–" : v.toLocaleString("en-IN", {maximumFractionDigits: 2, minimumFractionDigits: 2});
const n0 = v => v == null ? "–" : Math.round(v).toLocaleString("en-IN");
const pct = v => v == null ? "–" : n1(v) + "%";
const pp = v => v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + n1(Math.abs(v)) + " pp";
const bps = v => v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + n0(Math.abs(v)) + " bps";
const lakhCr = v => v == null ? "–" : "₹" + n1(v / 1e5) + " lakh cr";
const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") ;

/* ---------- tooltip ---------- */
const tip = document.getElementById("tip");
function showTip(ev, head, rows) {
  tip.replaceChildren();
  const h = document.createElement("div"); h.className = "t-head"; h.textContent = head; tip.append(h);
  for (const r of rows) {
    const row = document.createElement("div"); row.className = "t-row";
    const i = document.createElement("i"); i.style.background = r.color || "var(--ink-2)";
    if (r.box) { i.style.height = "10px"; i.style.width = "10px"; i.style.borderRadius = "2px"; }
    const b = document.createElement("b"); b.textContent = r.value;
    const s = document.createElement("span"); s.textContent = r.name;
    row.append(i, b, s); tip.append(row);
  }
  tip.hidden = false;
  const pad = 14, w = tip.offsetWidth, h2 = tip.offsetHeight;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
  if (y + h2 > innerHeight - 8) y = ev.clientY - h2 - pad;
  tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
}
const hideTip = () => { tip.hidden = true; };

/* ---------- svg helpers ---------- */
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style") e.setAttribute("style", v); else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
  }
  if (parent) parent.append(e);
  return e;
}
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0);
function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag, step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}
function legend(id, items) {
  const box = document.getElementById(id); if (!box) return;
  box.replaceChildren();
  for (const it of items) {
    const s = document.createElement("span"), i = document.createElement("i");
    i.style.background = it.color; if (it.box) i.className = "box";
    s.append(i, document.createTextNode(it.name)); box.append(s);
  }
}
function dataTable(card, headers, rows) {
  const det = document.createElement("details"); det.className = "data";
  const sum = document.createElement("summary"); sum.textContent = "Show data table"; det.append(sum);
  const wrap = document.createElement("div"); wrap.className = "tbl-wrap";
  const t = document.createElement("table"), thead = document.createElement("thead"), tr = document.createElement("tr");
  headers.forEach(h => { const th = document.createElement("th"); th.textContent = h; tr.append(th); });
  thead.append(tr); t.append(thead);
  const tb = document.createElement("tbody");
  rows.forEach(r => { const row = document.createElement("tr"); r.forEach(c => { const td = document.createElement("td"); td.textContent = c; row.append(td); }); tb.append(row); });
  t.append(tb); wrap.append(t); det.append(wrap); card.append(det);
}
const charts = [];
function register(id, draw) {
  const box = document.getElementById(id); if (!box) return;
  const run = () => {
    box.replaceChildren();
    try { draw(box, Math.max(280, box.clientWidth)); }
    catch (e) {   // one bad chart must not stop the rest of the page
      console.error(id, e); box.replaceChildren();
      const p = document.createElement("p"); p.className = "cap"; p.textContent = "Chart unavailable for this data."; box.append(p);
    }
  };
  const old = charts.findIndex(c => c.box === box);
  const entry = { box, run, w: Math.round(box.clientWidth) };
  if (old >= 0) charts[old] = entry; else charts.push(entry);
  run();
}
// Redraw only when a chart's width changes; redrawing alters page height, so
// observing height would loop.
let rzT;
window.addEventListener("resize", () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => charts.forEach(c => {
    const w = Math.round(c.box.clientWidth);
    if (w !== c.w) { c.w = w; c.run(); }
  }), 150);
});
const clearCharts = () => { charts.length = 0; };

/* ---------- line chart (time x, one y axis) ---------- */
function lineChart(box, W, opt) {
  opt = { ...opt, series: opt.series.filter(sr => sr.data && sr.data.some(p => p[1] != null)) };
  const H = opt.height || 260, m = { t: 12, r: opt.endLabels ? 118 : 16, b: 26, l: 44 };
  if (W < 520 && opt.endLabels) m.r = 16;
  const ser = opt.series.filter(s => s.data && s.data.length);
  const xs = ser.flatMap(s => s.data.map(p => pd(p[0]).getTime()));
  const ys = ser.flatMap(s => s.data.map(p => p[1]).filter(v => v != null)).concat(opt.include || []);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yt = niceTicks(Math.min(...ys), Math.max(...ys), opt.yTicks || 5);
  const X = lin(x0, x1, m.l, W - m.r), Y = lin(yt[0], yt[yt.length - 1], H - m.b, m.t);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opt.aria || "" }, box);
  yt.forEach(v => {
    el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), style: `stroke:${v === 0 ? "var(--axis)" : "var(--grid)"};stroke-width:1` }, svg);
    el("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end", text: (opt.yFmt || n1)(v) }, svg);
  });
  // x ticks: up to ~6 evenly spaced months
  const months = [...new Set(xs)].sort((a, b) => a - b);
  const want = Math.max(2, Math.min(7, Math.floor((W - m.l - m.r) / 90)));
  const span = (x1 - x0) / (want - 1 || 1);
  let ticks = [];
  const diffs = months.slice(1).map((t, i) => t - months[i]).sort((a, b) => a - b);
  const regular = diffs.length && diffs[diffs.length - 1] < diffs[Math.floor(diffs.length / 2)] * 1.6;
  if (regular) {
    // evenly spaced data: step a whole number of periods, anchored on the latest month
    const n = months.length - 1, plotW = W - m.l - m.r;
    let k = 1; while (k < n && (k * plotW / n < 72 || Math.floor(n / k) + 1 > 8)) k++;
    for (let i = months.length - 1; i >= 0; i -= k) ticks.unshift(months[i]);
  } else for (let i = 0; i < want; i++) { const t = x0 + span * i; const near = months.reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a); if (!ticks.includes(near)) ticks.push(near); }
  // a data gap can snap two targets onto neighbouring months; drop ticks that would collide
  for (let i = ticks.length - 2; i > 0; i--) if (X(ticks[i + 1]) - X(ticks[i]) < 64 || X(ticks[i]) - X(ticks[i - 1]) < 64) ticks.splice(i, 1);
  ticks.forEach(t => el("text", { x: X(t), y: H - 8, "text-anchor": X(t) - m.l < 24 ? "start" : W - m.r - X(t) < 24 ? "end" : "middle", text: fms(new Date(t)) }, svg));
  (opt.refs || []).forEach(r => {
    el("line", { x1: m.l, x2: W - m.r, y1: Y(r.y), y2: Y(r.y), style: "stroke:var(--muted);stroke-width:1" }, svg);
    el("text", { x: m.l + 6, y: Y(r.y) - 5, "text-anchor": "start", class: "lbl", style: "font-size:11px", text: r.label }, svg);
  });
  const gapMs = (opt.gapDays || 70) * 864e5;
  ser.forEach(s => {
    let d = "", prev = null;
    s.data.forEach(p => {
      const t = pd(p[0]).getTime();
      if (p[1] == null) { prev = null; return; }
      const brk = prev == null || (t - prev) > gapMs;
      if (s.step && !brk) d += `H${X(t).toFixed(1)}V${Y(p[1]).toFixed(1)}`;
      else d += (brk ? "M" : "L") + X(t).toFixed(1) + "," + Y(p[1]).toFixed(1);
      prev = t;
    });
    el("path", { d, style: `fill:none;stroke:${s.color};stroke-width:${s.width || 2};stroke-linejoin:round;stroke-linecap:round` }, svg);
    const last = [...s.data].reverse().find(p => p[1] != null);
    if (last) {
      el("circle", { cx: X(pd(last[0]).getTime()), cy: Y(last[1]), r: 4, style: `fill:${s.color};stroke:var(--surface);stroke-width:2` }, svg);
      s._end = { x: X(pd(last[0]).getTime()), y: Y(last[1]), v: last[1] };
    }
  });
  if (opt.endLabels && W >= 520) {
    const labs = ser.filter(s => s._end).map(s => ({ s, y: s._end.y })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 26) labs[i].y = labs[i - 1].y + 26;
    labs.forEach(l => {
      const tx = l.s._end.x + 10;
      if (Math.abs(l.y - l.s._end.y) > 2) el("line", { x1: l.s._end.x + 5, y1: l.s._end.y, x2: tx - 2, y2: l.y - 4, style: "stroke:var(--axis);stroke-width:1" }, svg);
      el("text", { x: tx, y: l.y - 1, class: "val", text: (opt.valFmt || opt.yFmt || n1)(l.s._end.v) }, svg);
      el("text", { x: tx, y: l.y + 12, class: "lbl", style: "font-size:11px", text: l.s.short || l.s.name }, svg);
    });
  }
  // crosshair + tooltip
  const cross = el("line", { y1: m.t, y2: H - m.b, style: "stroke:var(--axis);stroke-width:1", visibility: "hidden" }, svg);
  const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, class: "hit", tabindex: 0 }, svg);
  const lookup = ser.map(s => new Map(s.data.map(p => [pd(p[0]).getTime(), p[1]])));
  function at(t, ev) {
    cross.setAttribute("x1", X(t)); cross.setAttribute("x2", X(t)); cross.setAttribute("visibility", "visible");
    const rows = ser.map((s, i) => ({ name: s.name, color: s.color, value: lookup[i].has(t) && lookup[i].get(t) != null ? (opt.valFmt || opt.yFmt || n1)(lookup[i].get(t)) : "–" }));
    showTip(ev, fm(new Date(t)), rows);
  }
  hit.addEventListener("pointermove", ev => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width);
    const t = months.reduce((a, b) => Math.abs(X(b) - px) < Math.abs(X(a) - px) ? b : a); at(t, ev);
  });
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
  let fi = months.length - 1;
  hit.addEventListener("focus", () => { const r = hit.getBoundingClientRect(); at(months[fi], { clientX: r.right - 40, clientY: r.top + 20 }); });
  hit.addEventListener("keydown", ev => { if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") { fi = Math.max(0, Math.min(months.length - 1, fi + (ev.key === "ArrowRight" ? 1 : -1))); const r = hit.getBoundingClientRect(); at(months[fi], { clientX: r.left + X(months[fi]) * r.width / W, clientY: r.top + 20 }); ev.preventDefault(); } });
  hit.addEventListener("blur", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
}

// shorten an SVG label with an ellipsis so it fits max px; the full text stays in a <title>
function fitText(t, max) {
  if (!t.getComputedTextLength || t.getComputedTextLength() <= max) return;
  const full = t.textContent; let s = full;
  while (s.length > 4 && t.getComputedTextLength() > max) { s = s.slice(0, -1); t.textContent = s.trimEnd() + "…"; }
  el("title", { text: full }, t);
}

// a centred axis label that switches to end-anchored when it would run past the right edge
function edgeText(svg, x, y, text, W) {
  const t = el("text", { x, y, "text-anchor": "middle", text }, svg);
  const w = t.getComputedTextLength ? t.getComputedTextLength() : 0;
  if (x + w / 2 > W - 1) { t.setAttribute("text-anchor", "end"); t.setAttribute("x", W - 1); }
  return t;
}

/* ---------- horizontal bars (grouped allowed, negatives allowed) ---------- */
function barsH(box, W, opt) {
  const rows = opt.rows, keys = opt.keys; // rows: {label, values:{key:v}}
  // two labelled bars per row need ~13px pitch or their value labels overprint
  const nLab = opt.valueLabels === false ? 0 : keys.filter(k => !opt.labelKeys || opt.labelKeys.includes(k.key)).length;
  const bar = nLab > 1 ? Math.max(opt.bar || 10, 10) : (opt.bar || 10), gap = nLab > 1 ? Math.max(2, 13 - bar) : 2, group = keys.length * bar + (keys.length - 1) * gap;
  const rowH = group + (opt.rowPad || 16);
  const labW = Math.min(opt.labelW || 190, W * 0.42);
  const m = { t: opt.refs && opt.refs.length ? 22 : 8, r: 54, b: 24, l: labW + 8 };
  const H = m.t + m.b + rows.length * rowH;
  const vals = rows.flatMap(r => keys.map(k => r.values[k.key])).filter(v => v != null).concat(opt.include || [0]);
  const xt = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), W < 500 ? 4 : 6);
  const X = lin(xt[0], xt[xt.length - 1], m.l, W - m.r);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opt.aria || "" }, box);
  const thin = xt.length > 2 && X(xt[1]) - X(xt[0]) < 38 ? 2 : 1;
  xt.forEach((v, i) => {
    el("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, style: `stroke:${v === 0 ? "var(--axis)" : "var(--grid)"};stroke-width:1` }, svg);
    if (i % thin === 0) el("text", { x: X(v), y: H - 8, "text-anchor": "middle", text: (opt.tickFmt || opt.fmt)(v) }, svg);
  });
  (opt.refs || []).forEach(r => {
    el("line", { x1: X(r.x), x2: X(r.x), y1: m.t - 6, y2: H - m.b, style: "stroke:var(--ink-2);stroke-width:1" }, svg);
    el("text", { x: X(r.x) + (r.x < 0 ? 4 : -4), y: m.t - 9, "text-anchor": r.x < 0 ? "start" : "end", class: "lbl", style: "font-size:11px", text: r.label }, svg);
  });
  rows.forEach((r, i) => {
    const y0 = m.t + i * rowH + (rowH - group) / 2;
    const lt = el("text", { x: m.l - 10, y: y0 + group / 2 + 4, "text-anchor": "end", class: "lbl", text: r.label }, svg);
    fitText(lt, labW - 4);
    keys.forEach((k, j) => {
      const v = r.values[k.key]; if (v == null) return;
      const y = y0 + j * (bar + gap), xa = X(0), xb = X(v), w = Math.max(1, Math.abs(xb - xa)), x = Math.min(xa, xb);
      const rad = Math.min(4, w / 2), neg = v < 0;
      const d = neg
        ? `M${xa},${y}H${x + rad}Q${x},${y} ${x},${y + rad}V${y + bar - rad}Q${x},${y + bar} ${x + rad},${y + bar}H${xa}Z`
        : `M${xa},${y}H${xb - rad}Q${xb},${y} ${xb},${y + rad}V${y + bar - rad}Q${xb},${y + bar} ${xb - rad},${y + bar}H${xa}Z`;
      const p = el("path", { d, style: `fill:${(r.colors && r.colors[k.key]) || k.color}` }, svg);
      if (opt.valueLabels !== false && (!opt.labelKeys || opt.labelKeys.includes(k.key))) el("text", { x: neg ? x - 4 : xb + 4, y: y + bar / 2 + 4, "text-anchor": neg ? "end" : "start", class: "val", text: opt.fmt(v) }, svg);
      const hit = el("rect", { x: m.l - labW, y: y - 1, width: W - m.r - m.l + labW, height: bar + 2, class: "hit" }, svg);
      hit.addEventListener("pointermove", ev => { p.classList.add("hover-mark"); showTip(ev, r.label, keys.map(kk => ({ name: kk.name, value: r.values[kk.key] == null ? "–" : opt.fmt(r.values[kk.key]), color: (r.colors && r.colors[kk.key]) || kk.color, box: true })).concat(r.extra || [])); });
      hit.addEventListener("pointerleave", () => { p.classList.remove("hover-mark"); hideTip(); });
    });
  });
}

/* ---------- dumbbell: year-ago → now ---------- */
function dumbbell(box, W, opt) {
  const rows = opt.rows, rowH = 26, labW = Math.min(opt.labelW || 210, W * 0.44);
  const m = { t: 8, r: 52, b: 24, l: labW + 8 }, H = m.t + m.b + rows.length * rowH;
  const vals = rows.flatMap(r => [r.a, r.b]).filter(v => v != null);
  const xt = niceTicks(Math.min(0, ...vals), Math.max(...vals), W < 500 ? 4 : 6);
  const X = lin(xt[0], xt[xt.length - 1], m.l, W - m.r);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opt.aria || "" }, box);
  const thin = xt.length > 2 && X(xt[1]) - X(xt[0]) < 38 ? 2 : 1;
  xt.forEach((v, i) => {
    el("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, style: `stroke:${v === 0 ? "var(--axis)" : "var(--grid)"};stroke-width:1` }, svg);
    if (i % thin === 0) el("text", { x: X(v), y: H - 8, "text-anchor": "middle", text: n0(v) + "%" }, svg);
  });
  rows.forEach((r, i) => {
    const y = m.t + i * rowH + rowH / 2;
    if (r.bold) el("rect", { x: 0, y: y - rowH / 2 + 1, width: W, height: rowH - 2, rx: 4, style: "fill:var(--accent-wash)" }, svg);
    fitText(el("text", { x: m.l - 10, y: y + 4, "text-anchor": "end", class: "lbl", style: r.bold ? "font-weight:600;fill:var(--ink)" : (r.indent ? "font-size:11.5px" : ""), text: r.label }, svg), labW - 4);
    if (r.a != null && r.b != null) el("line", { x1: X(r.a), x2: X(r.b), y1: y, y2: y, style: `stroke:${r.b >= r.a ? "var(--s1)" : "var(--s2)"};stroke-width:2;opacity:.45` }, svg);
    if (r.a != null) el("circle", { cx: X(r.a), cy: y, r: 4, style: "fill:var(--surface);stroke:var(--muted);stroke-width:2" }, svg);
    if (r.b != null) el("circle", { cx: X(r.b), cy: y, r: 5, style: "fill:var(--s1);stroke:var(--surface);stroke-width:2" }, svg);
    if (r.b != null) el("text", { x: Math.max(X(r.a ?? r.b), X(r.b)) + 9, y: y + 4, class: "val", text: n1(r.b) }, svg);
    const hit = el("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, class: "hit" }, svg);
    hit.addEventListener("pointermove", ev => showTip(ev, r.label, [
      { name: opt.bLabel, value: pct(r.b), color: "var(--s1)" }, { name: opt.aLabel, value: pct(r.a), color: "var(--muted)" },
      ...(r.extra || [])]));
    hit.addEventListener("pointerleave", hideTip);
  });
}

/* ---------- 100% stacked horizontal bars ---------- */
function stacked(box, W, opt) {
  const rows = opt.rows, keys = opt.keys, bar = 18, rowH = 38, labW = Math.min(opt.labelW || 130, W * 0.42);
  const m = { t: 6, r: 12, b: 22, l: labW + 8 }, H = m.t + m.b + rows.length * rowH;
  const X = lin(0, 100, m.l, W - m.r);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opt.aria || "" }, box);
  [0, 25, 50, 75, 100].forEach(v => el("text", { x: X(v), y: H - 6, "text-anchor": v === 0 ? "start" : v === 100 ? "end" : "middle", text: v + "%" }, svg));
  rows.forEach((r, i) => {
    const y = m.t + i * rowH + (rowH - bar) / 2;
    fitText(el("text", { x: m.l - 10, y: y + bar / 2 + 4, "text-anchor": "end", class: "lbl", text: r.label }, svg), labW - 4);
    let acc = 0;
    keys.forEach(k => {
      const v = r.values[k.key] || 0; if (v <= 0) return;
      const xa = X(acc), xb = X(acc + v), w = Math.max(0, xb - xa - 2);
      const rect = el("rect", { x: xa, y, width: Math.max(w, 0.5), height: bar, rx: w > 6 ? 3 : 0, style: `fill:${k.color}` }, svg);
      if (w > 40) el("text", { x: xa + w / 2, y: y + bar / 2 + 4, "text-anchor": "middle", style: `fill:${k.ink || "#fff"};font-size:11px;font-family:var(--font-data)`, text: n0(v) + "%" }, svg);
      const hit = el("rect", { x: xa, y: y - 4, width: Math.max(w, 6), height: bar + 8, class: "hit" }, svg);
      hit.addEventListener("pointermove", ev => { rect.classList.add("hover-mark"); showTip(ev, r.label, [{ name: k.name, value: n1(v) + "%", color: k.color, box: true }]); });
      hit.addEventListener("pointerleave", () => { rect.classList.remove("hover-mark"); hideTip(); });
      acc += v;
    });
  });
}

/* ---------- scatter ---------- */
function scatter(box, W, opt) {
  const H = 320, m = { t: 30, r: 20, b: 46, l: 54 };
  const pts = opt.points;
  const xt = niceTicks(0, Math.max(...pts.map(p => p.x)), 5), yt = niceTicks(0, Math.max(...pts.map(p => p.y)), 5);
  const X = lin(xt[0], xt[xt.length - 1], m.l, W - m.r), Y = lin(yt[0], yt[yt.length - 1], H - m.b, m.t);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opt.aria || "" }, box);
  yt.forEach(v => { el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), style: `stroke:${v === 0 ? "var(--axis)" : "var(--grid)"};stroke-width:1` }, svg); el("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end", text: opt.yFmt(v) }, svg); });
  xt.forEach((v, i) => el("text", { x: X(v), y: H - m.b + 18, "text-anchor": i === xt.length - 1 ? "end" : "middle", text: opt.xFmt(v) }, svg));
  el("text", { x: W - m.r, y: H - 6, "text-anchor": "end", class: "lbl", style: "font-size:11px", text: opt.xTitle + " →" }, svg);
  el("text", { x: 4, y: 12, class: "lbl", style: "font-size:11px", text: "↑ " + opt.yTitle }, svg);
  const placed = [];
  pts.forEach(p => {
    const cx = X(p.x), cy = Y(p.y);
    const c = el("circle", { cx, cy, r: 5, style: `fill:${p.color || "var(--s1)"};stroke:var(--surface);stroke-width:2` }, svg);
    if (p.label) {
      let ly = cy - 9; while (placed.some(q => Math.abs(q.y - ly) < 13 && Math.abs(q.x - cx) < 90)) ly -= 13;
      if (ly < m.t - 10) ly = cy + 16;
      placed.push({ x: cx, y: ly });
      const right = cx > W - 120;
      if (Math.abs(ly - (cy - 9)) > 4) el("line", { x1: cx + (right ? -3 : 3), y1: cy + (ly < cy ? -4 : 4), x2: cx + (right ? -7 : 7), y2: ly + (ly < cy ? 2 : -9), style: "stroke:var(--axis);stroke-width:1" }, svg);
      el("text", { x: cx + (cx > W - 120 ? -8 : 8), y: ly, "text-anchor": cx > W - 120 ? "end" : "start", class: "lbl", style: "font-size:11px", text: p.label }, svg);
    }
    const hit = el("circle", { cx, cy, r: 13, class: "hit" }, svg);
    hit.addEventListener("pointermove", ev => { c.setAttribute("r", 7); showTip(ev, p.name, p.rows); });
    hit.addEventListener("pointerleave", () => { c.setAttribute("r", 5); hideTip(); });
  });
}

/* ---------- sortable table ---------- */
function sortTable(host, cols, rows, initial) {
  let key = initial.key, dir = initial.dir;
  const render = () => {
    const t = document.createElement("table"), thead = document.createElement("thead"), tr = document.createElement("tr");
    cols.forEach(c => {
      const th = document.createElement("th"), b = document.createElement("button");
      b.textContent = c.label + (c.key === key ? (dir > 0 ? " ↑" : " ↓") : "");
      b.addEventListener("click", () => { if (key === c.key) dir = -dir; else { key = c.key; dir = c.num ? -1 : 1; } render(); });
      th.setAttribute("aria-sort", c.key === key ? (dir > 0 ? "ascending" : "descending") : "none");
      th.append(b); tr.append(th);
    });
    thead.append(tr); t.append(thead);
    const tb = document.createElement("tbody");
    [...rows()].sort((a, b) => { const x = a[key], y = b[key]; return (typeof x === "string" ? x.localeCompare(y) : (x ?? -1e9) - (y ?? -1e9)) * dir; })
      .forEach(r => { const row = document.createElement("tr"); cols.forEach(c => { const td = document.createElement("td"); td.textContent = c.fmt ? c.fmt(r[c.key]) : r[c.key]; if (c.tone && r[c.key]) td.className = r[c.key] > 0 ? c.tone[0] : c.tone[1]; row.append(td); }); tb.append(row); });
    t.append(tb); host.replaceChildren(t);
  };
  render(); return render;
}
const li = (id, items) => { const ul = document.getElementById(id); items.forEach(s => { const x = document.createElement("li"); x.textContent = s; ul.append(x); }); };
const SHORT = {
  "1": "Agriculture", "2": "Industry", "2.1": "Micro & small industry", "2.2": "Medium industry", "2.3": "Large industry",
  "3": "Services", "3.1": "Transport operators", "3.2": "Software", "3.3": "Tourism & hotels", "3.4": "Shipping", "3.5": "Aviation",
  "3.6": "Professional services", "3.7": "Trade", "3.8": "Commercial real estate", "3.9": "NBFCs", "3.10": "Other services",
  "4": "Personal loans", "4.1": "Consumer durables", "4.2": "Housing", "4.3": "Loans against deposits", "4.4": "Loans against shares",
  "4.5": "Credit card dues", "4.6": "Education", "4.7": "Vehicle loans", "4.8": "Gold loans", "4.9": "Other personal loans",
};
const sname = r => SHORT[r.code] || r.sector;
const C = { s1: "var(--s1)", s2: "var(--s2)", s3: "var(--s3)", s4: "var(--s4)", s5: "var(--s5)", s7: "var(--s7)", agg: "var(--agg)", muted: "var(--muted)" };


/* vertical bars (single series) */
function barsV(box, W, opt) {
  const H = 200, m = { t: 14, r: 8, b: 24, l: 40 }, rows = opt.rows;
  const yt = niceTicks(0, Math.max(...rows.map(r => r.v)), 4), Y = lin(0, yt[yt.length - 1], H - m.b, m.t);
  const band = (W - m.l - m.r) / rows.length, bw = Math.min(24, band * 0.6);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opt.aria || "" }, box);
  yt.forEach(v => { el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), style: `stroke:${v === 0 ? "var(--axis)" : "var(--grid)"};stroke-width:1` }, svg); el("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end", text: n0(v) }, svg); });
  rows.forEach((r, i) => {
    const x = m.l + band * i + (band - bw) / 2, y = Y(r.v), h = H - m.b - y, rad = Math.min(4, bw / 2);
    const p = el("path", { d: `M${x},${H - m.b}V${y + rad}Q${x},${y} ${x + rad},${y}H${x + bw - rad}Q${x + bw},${y} ${x + bw},${y + rad}V${H - m.b}Z`, style: `fill:${i === rows.length - 1 ? "var(--s1)" : "color-mix(in srgb, var(--s1) 55%, var(--surface))"}` }, svg);
    const ev = Math.ceil(rows.length / Math.max(2, Math.floor(W / 70)));
    if ((i % ev === 0 && rows.length - 1 - i >= ev * 0.7) || i === rows.length - 1) edgeText(svg, x + bw / 2, H - 8, r.label, W);
    if (i === rows.length - 1) el("text", { x: x + bw / 2, y: y - 4, "text-anchor": "middle", class: "val", text: n0(r.v) }, svg);
    const hit = el("rect", { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, class: "hit" }, svg);
    hit.addEventListener("pointermove", ev => { p.classList.add("hover-mark"); showTip(ev, r.full, [{ name: "Card spend", value: opt.fmt(r.v), color: "var(--s1)", box: true }]); });
    hit.addEventListener("pointerleave", () => { p.classList.remove("hover-mark"); hideTip(); });
  });
}

/* grouped vertical bars (few series, categorical x) */
function barsVG(box, W, opt) {
  const H = opt.height || 220, m = { t: 14, r: 8, b: 26, l: 40 }, rows = opt.rows, keys = opt.keys;
  const vals = rows.flatMap(r => keys.map(k => r[k.key])).filter(v => v != null);
  if (!vals.length) { const p = document.createElement("p"); p.className = "cap"; p.textContent = opt.empty || "No data filed for this bank."; box.append(p); return; }
  const yt = niceTicks(0, Math.max(...vals), 4), Y = lin(0, yt[yt.length - 1], H - m.b, m.t);
  const band = (W - m.l - m.r) / rows.length, bw = Math.min(14, (band * 0.7 - 2 * (keys.length - 1)) / keys.length);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opt.aria || "" }, box);
  yt.forEach(v => { el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), style: `stroke:${v === 0 ? "var(--axis)" : "var(--grid)"};stroke-width:1` }, svg); el("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end", text: (opt.tickFmt || n0)(v) }, svg); });
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor((W - m.l) / 52))));
  rows.forEach((r, i) => {
    const gx = m.l + band * i + (band - (keys.length * bw + (keys.length - 1) * 2)) / 2;
    keys.forEach((k, j) => {
      const v = r[k.key]; if (v == null) return;
      const x = gx + j * (bw + 2), y = Y(v), rad = Math.min(4, bw / 2);
      el("path", { d: `M${x},${H - m.b}V${y + rad}Q${x},${y} ${x + rad},${y}H${x + bw - rad}Q${x + bw},${y} ${x + bw},${y + rad}V${H - m.b}Z`, style: `fill:${k.color}` }, svg);
    });
    if ((i % every === 0 && rows.length - 1 - i >= every * 0.7) || i === rows.length - 1) edgeText(svg, m.l + band * i + band / 2, H - 8, r.label, W);
    const hit = el("rect", { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, class: "hit" }, svg);
    hit.addEventListener("pointermove", ev => showTip(ev, r.label, keys.map(k => ({ name: k.name, value: r[k.key] == null ? "–" : opt.fmt(r[k.key]), color: k.color, box: true })).concat(r.extra || [])));
    hit.addEventListener("pointerleave", hideTip);
  });
}


const redrawAll = (): void => charts.forEach(c => c.run());

export { redrawAll, C, MON, NS, SHORT, barsH, barsV, barsVG, bps, charts, clearCharts, dataTable, dumbbell, edgeText, el, fitText, fm, fms, hideTip, lakhCr, legend, li, lin, lineChart, n0, n1, n2, niceTicks, pct, pd, pp, register, scatter, sgn, showTip, sname, sortTable, stacked, tip };
