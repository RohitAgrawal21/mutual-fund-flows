/* Mutual Fund Flows - shared code: shell, helpers, charts, pages */
(() => {
'use strict';
const CFG = window.FFL_CONFIG || {}, BASE = CFG.BASE_PATH || '', API = CFG.API_BASE || '';   // see assets/config.js
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cache = {};
const getJSON = p => cache[p] || (cache[p] = fetch(BASE + '/data/' + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }));
const qs = k => new URLSearchParams(location.search).get(k);
const nfmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mlabel = m => { if (!m) return ''; const [y, mo] = m.split('-'); return MON[+mo - 1] + ' ' + y; };
const cr = v => v == null ? '–' : (Math.abs(v) >= 100000 ? '₹' + (v / 100000).toFixed(2) + ' lakh cr' : '₹' + nfmt.format(Math.round(v)) + ' cr');
const crs = v => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + cr(Math.abs(v));
const pct = (v, d = 1) => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';
const pctn = (v, d = 1) => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '%';
const cls = v => v == null ? 'flat' : v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat';
const BUCKET = { '1': 'Funds buying', '0': 'Little activity', '-1': 'Funds selling' };
const bucketPill = b => b > 0 ? '<span class="pill buy">Funds buying</span>' : b < 0 ? '<span class="pill sell">Funds selling</span>' : '<span class="pill">Little activity</span>';
// t (statistical strength) is shown to readers as a plain "could be luck" tag; the number stays in the hover text
const isReal = t => t != null && Math.abs(t) >= 2;
const luckTxt = t => isReal(t) ? 'Unlikely to be luck' : 'Could be luck';
const luckPill = t => `<span class="pill${isReal(t) ? ' real' : ''}" title="Statistical strength: t = ${t}">${luckTxt(t)}</span>`;
const vsAvg = (m, d = 1) => Math.abs(m).toFixed(d) + '% ' + (m >= 0 ? 'better' : 'worse');
let STOCKSET = null;      // ids that have a stock page; null until loaded (then every link is shown)
const loadStockSet = () => getJSON('stock_ids.json').then(l => { STOCKSET = new Set(l); }).catch(() => { });
const stockLink = (c, n) => (STOCKSET && !STOCKSET.has(c)) ? esc(n) : `<a href="${BASE}/stock?c=${encodeURIComponent(c)}">${esc(n)}</a>`;
const buyBar = (b, s) => { const t = b + s || 1; return `<span class="bar" title="${b} funds bought, ${s} funds sold"><i class="b" style="width:${100 * b / t}%"></i><i class="s" style="width:${100 * s / t}%"></i></span> <span class="small muted">${b}/${s}</span>`; };
const err = (el, e) => { el.innerHTML = `<div class="note"><b>Couldn't load data.</b> ${esc(e.message || e)}. If you're viewing this from a local file, serve the folder with a web server.</div>`; };

/* ---------------------------------------------------------------- tables */
function table(container, cols, rows, opt = {}) {
  let sortIdx = opt.sort ?? 0, dir = opt.dir ?? -1, limit = opt.limit ?? 40;
  const wrap = document.createElement('div'); container.innerHTML = ''; container.appendChild(wrap);
  function render() {
    const c = cols[sortIdx];
    const sorted = c && c.get ? [...rows].sort((a, b) => { const x = c.get(a), y = c.get(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; }) : rows;
    const shown = sorted.slice(0, limit);
    wrap.innerHTML = `<div class="tw"><table><thead><tr>${cols.map((c, i) => `<th class="${c.cls || ''}" data-i="${i}">${esc(c.label)}${c.tip ? ` <span class="qm-pop"><button type="button" class="qm" aria-label="${esc(c.tip)}">ⓘ</button><span class="qm-txt" role="tooltip">${esc(c.tip)}</span></span>` : ''}${c.get ? `<span class="ar">${i === sortIdx ? (dir < 0 ? '▾' : '▴') : ''}</span>` : ''}</th>`).join('')}</tr></thead><tbody>${shown.map(r => `<tr>${cols.map(c => `<td class="${c.cls || ''}">${c.html(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` +
      (rows.length > limit ? `<div class="more"><button class="btn ghost">Show more (${rows.length - limit} remaining)</button></div>` : '') + (rows.length === 0 ? '<p class="muted">Nothing to show.</p>' : '');
    $$('th', wrap).forEach(th => th.onclick = () => { const i = +th.dataset.i; if (!cols[i].get) return; if (sortIdx === i) dir = -dir; else { sortIdx = i; dir = cols[i].asc ? 1 : -1; } render(); });
    // ⓘ explanations: a real, focusable button (works with touch and keyboard, not just hover) that toggles a visible bubble.
    $$('.qm', wrap).forEach(btn => btn.onclick = e => { e.stopPropagation(); const pop = btn.closest('.qm-pop'); const was = pop.classList.contains('open'); $$('.qm-pop.open', wrap).forEach(p => p.classList.remove('open')); if (!was) pop.classList.add('open'); });
    const mb = $('.more button', wrap); if (mb) mb.onclick = () => { limit += 60; render(); };
  }
  render();
  return { set(r) { rows = r; limit = opt.limit ?? 40; render(); } };
}
// One document-wide listener (not per render, so it never piles up) closes any open ⓘ bubble on outside click or Escape.
document.addEventListener('click', () => $$('.qm-pop.open').forEach(p => p.classList.remove('open')));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.qm-pop.open').forEach(p => p.classList.remove('open')); });

/* ---------------------------------------------------------------- charts (plain SVG) */
const W = 800;
function scaleTicks(min, max, n = 4) { if (min === max) { max = min + 1; } const step0 = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(step0))); const step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(s => s >= step0) || step0; const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step; const t = []; for (let v = lo; v <= hi + 1e-9; v += step) t.push(+v.toFixed(10)); return t; }
function tipEl(el) { let t = $('.tip', el); if (!t) { t = document.createElement('div'); t.className = 'tip'; el.appendChild(t); } return t; }
// The tooltip is centered on px via CSS translate(-50%); clamp that anchor so its rendered box never crosses the
// chart's own edges (near x=0 or x=W it otherwise pokes past the container and forces the whole page wider on mobile).
function placeTip(tip, px, W) { const half = tip.offsetWidth / 2, lo = half + 4, hi = Math.max(lo, W - half - 4); tip.style.left = Math.max(lo, Math.min(hi, px)) + 'px'; }
window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(() => $$('.chart').forEach(c => c._redraw && c._redraw()), 150); });
function lineChart(el, o) {
  const W = Math.max(300, Math.round(el.clientWidth || 800)); el._redraw = () => { if (Math.abs((el.clientWidth || 800) - W) > 20) lineChart(el, o); };
  const H = o.h || 220, pad = { l: 52, r: 12, t: 10, b: 24 }, n = o.labels.length;
  const all = o.series.flatMap(s => s.data).filter(v => v != null && isFinite(v));
  if (!all.length) { el.innerHTML = '<p class="muted small">No data.</p>'; return; }
  let mn = Math.min(...all), mx = Math.max(...all); if (o.zero) { mn = Math.min(mn, 0); mx = Math.max(mx, 0); } if (o.min0) mn = Math.min(0, mn);
  const tk = scaleTicks(mn, mx), lo = tk[0], hi = tk[tk.length - 1];
  const x = i => pad.l + (n <= 1 ? 0 : (W - pad.l - pad.r) * i / (n - 1)), y = v => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo || 1));
  let g = tk.map(v => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${(o.yFmt || (z => z))(v)}</text>`).join('');
  let last = '', lastX = -99; o.labels.forEach((l, i) => { const yr = l.slice(0, 4); if (yr !== last && (l.slice(5) === '01' || i === 0) && x(i) - lastX > 38) { g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${yr}</text>`; lastX = x(i); } last = yr; });
  o.series.forEach(s => {
    let d = '', pen = false, ar = '', a0 = 0, a1 = 0; s.data.forEach((v, i) => { const ok = !(v == null || !isFinite(v)); if (ok) { d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); if (!pen) { ar += 'M' + x(i).toFixed(1) + ' ' + y(lo) + 'L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1); } else ar += 'L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1); a1 = i; pen = true; } else if (pen) { ar += 'L' + x(a1).toFixed(1) + ' ' + y(lo) + 'Z'; pen = false; } });
    if (pen) ar += 'L' + x(a1).toFixed(1) + ' ' + y(lo) + 'Z';
    if (o.area && s === o.series[0]) g += `<path d="${ar}" fill="${s.color}" opacity=".12"/>`;
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
  });
  el.classList.add('chart'); el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" tabindex="0" role="img" aria-label="${esc(o.series[0] ? o.series[0].name : 'Chart')}, ${o.labels.length} months from ${mlabel(o.labels[0])} to ${mlabel(o.labels[o.labels.length - 1])}. Focus and use the left and right arrow keys to read each month's value.">${g}<line class="cur" y1="${pad.t}" y2="${H - pad.b}" stroke="var(--muted)" opacity="0" /></svg>` + (o.series.length > 1 || o.legend ? `<div class="legend">${o.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '');
  const svg = $('svg', el), tip = tipEl(el), cur = $('.cur', el);
  let ci = n - 1;
  const showAt = i => { i = Math.max(0, Math.min(n - 1, i)); ci = i; cur.setAttribute('x1', x(i)); cur.setAttribute('x2', x(i)); cur.setAttribute('opacity', .5);
    const gn = o.gapNote && o.gapNote(o.labels[i]);
    tip.style.display = 'block'; tip.style.top = '30px'; tip.innerHTML = `<b>${mlabel(o.labels[i])}</b>` + (gn ? `<br><span class="muted">${esc(gn)}</span>` : o.series.map(s => `<br>${esc(s.name)}: ${s.data[i] == null ? '–' : (o.tipFmt || o.yFmt || (z => z))(s.data[i])}`).join('')); placeTip(tip, x(i), W); };
  const idxAtClientX = clientX => { const r = svg.getBoundingClientRect(), fx = (clientX - r.left) / r.width * W; return Math.round((fx - pad.l) / ((W - pad.l - pad.r) / Math.max(n - 1, 1))); };
  const hide = () => { tip.style.display = 'none'; cur.setAttribute('opacity', 0); };
  svg.onmousemove = ev => showAt(idxAtClientX(ev.clientX));
  svg.onmouseleave = hide;
  // Touch: a finger drag reads values the same way a mouse hover does, instead of leaving touch users with no way to see them at all.
  svg.addEventListener('touchstart', ev => { showAt(idxAtClientX(ev.touches[0].clientX)); ev.preventDefault(); }, { passive: false });
  svg.addEventListener('touchmove', ev => { showAt(idxAtClientX(ev.touches[0].clientX)); ev.preventDefault(); }, { passive: false });
  svg.addEventListener('touchend', hide);
  // Keyboard: Tab to focus the chart, then Left/Right steps through months one at a time.
  svg.addEventListener('focus', () => showAt(ci));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', ev => { if (ev.key === 'ArrowLeft') { showAt(ci - 1); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { showAt(ci + 1); ev.preventDefault(); } });
}
function divBars(el, o) { // up (positive) and down (negative) bars per label
  const W = Math.max(300, Math.round(el.clientWidth || 800)); el._redraw = () => { if (Math.abs((el.clientWidth || 800) - W) > 20) divBars(el, o); };
  const H = o.h || 200, pad = { l: 40, r: 12, t: 10, b: 24 }, n = o.labels.length;
  const mx = Math.max(1, ...o.up.data.map(v => v || 0), ...o.down.data.map(v => v || 0)); const tk = scaleTicks(0, mx, 3), hi = tk[tk.length - 1];
  const mid = pad.t + (H - pad.t - pad.b) / 2, half = (H - pad.t - pad.b) / 2, bw = Math.max(1, (W - pad.l - pad.r) / n - 1);
  const x = i => pad.l + (W - pad.l - pad.r) * i / n;
  let g = `<line x1="${pad.l}" x2="${W - pad.r}" y1="${mid}" y2="${mid}" stroke="var(--line)"/>`;
  tk.forEach(v => { if (v) g += `<text x="${pad.l - 6}" y="${mid - half * v / hi + 4}" text-anchor="end">${v}</text><text x="${pad.l - 6}" y="${mid + half * v / hi + 4}" text-anchor="end">${v}</text>`; });
  let last = '', lastX = -99; o.labels.forEach((l, i) => { const yr = l.slice(0, 4); if (yr !== last && (l.slice(5) === '01' || i === 0) && x(i) - lastX > 38) { g += `<text x="${x(i) + bw / 2}" y="${H - 6}" text-anchor="middle">${yr}</text>`; lastX = x(i); } last = yr; });
  o.labels.forEach((l, i) => { const u = o.up.data[i] || 0, d = o.down.data[i] || 0; if (u) g += `<rect x="${x(i)}" y="${mid - half * u / hi}" width="${bw}" height="${half * u / hi}" fill="${o.up.color}"/>`; if (d) g += `<rect x="${x(i)}" y="${mid}" width="${bw}" height="${half * d / hi}" fill="${o.down.color}"/>`; });
  el.classList.add('chart'); el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" tabindex="0" role="img" aria-label="${esc(o.up.name)} and ${esc(o.down.name)}, ${o.labels.length} months from ${mlabel(o.labels[0])} to ${mlabel(o.labels[o.labels.length - 1])}. Focus and use the left and right arrow keys to read each month's value.">${g}</svg><div class="legend"><span><i style="background:${o.up.color}"></i>${esc(o.up.name)}</span><span><i style="background:${o.down.color}"></i>${esc(o.down.name)}</span></div>`;
  const svg = $('svg', el), tip = tipEl(el);
  let ci = n - 1;
  const showAt = i => { ci = i = Math.max(0, Math.min(n - 1, i)); tip.style.display = 'block'; tip.style.top = '30px'; tip.innerHTML = `<b>${mlabel(o.labels[i])}</b><br>${esc(o.up.name)}: ${o.up.data[i] || 0}<br>${esc(o.down.name)}: ${o.down.data[i] || 0}`; placeTip(tip, x(i), W); };
  const idxAtClientX = clientX => { const r = svg.getBoundingClientRect(), fx = (clientX - r.left) / r.width * W; return Math.floor((fx - pad.l) / ((W - pad.l - pad.r) / n)); };
  const hide = () => tip.style.display = 'none';
  svg.onmousemove = ev => showAt(idxAtClientX(ev.clientX));
  svg.onmouseleave = hide;
  svg.addEventListener('touchstart', ev => { showAt(idxAtClientX(ev.touches[0].clientX)); ev.preventDefault(); }, { passive: false });
  svg.addEventListener('touchmove', ev => { showAt(idxAtClientX(ev.touches[0].clientX)); ev.preventDefault(); }, { passive: false });
  svg.addEventListener('touchend', hide);
  svg.addEventListener('focus', () => showAt(ci));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', ev => { if (ev.key === 'ArrowLeft') { showAt(ci - 1); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { showAt(ci + 1); ev.preventDefault(); } });
}
function hbars(el, items, o = {}) { // items: {label, val, color, note}
  const mx = Math.max(1, ...items.map(i => Math.abs(i.val ?? 0))), fmt = o.fmt || (v => pctn(v, 1));
  el.innerHTML = items.map(i => { const w = Math.min(100, Math.abs(i.val ?? 0) / mx * 100); const neg = (i.val ?? 0) < 0; return `<div style="display:grid;grid-template-columns:minmax(110px,170px) 1fr 120px;gap:10px;align-items:center;margin:8px 0"><div>${esc(i.label)}${i.sub ? `<div class="small muted" style="line-height:1.25">${esc(i.sub)}</div>` : ''}</div><div style="position:relative;height:22px;background:var(--chip);border-radius:6px"><div style="position:absolute;top:0;bottom:0;${neg ? 'right:50%' : 'left:50%'};width:${w / 2}%;background:${i.color};border-radius:${neg ? '6px 0 0 6px' : '0 6px 6px 0'}"></div><div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--muted);opacity:.5"></div></div><div class="right ${cls(i.val)}"><b>${fmt(i.val)}</b>${i.note ? `<div class="small muted">${esc(i.note)}</div>` : ''}</div></div>`; }).join('');
}

/* ---------------------------------------------------------------- shell */
const NAV = [['/', 'Overview', 'home'], ['/movers', "What fund buying does to stocks", 'movers'], ['/changes', 'What changed', 'changes'], ['/stocks', 'Stocks', 'stocks'], ['/houses', 'Funds & houses', 'houses'], ['/evidence', 'Evidence', 'evidence'], ['/about', 'About', 'about']];
function shell(page) {
  const active = { stock: 'stocks', house: 'houses', funds: 'houses', fund: 'houses' }[page] || page;
  document.body.innerHTML = `<header class="top"><div class="wrap"><a class="brand" href="${BASE}/"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M6 21l6-7 5 4 9-11" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Mutual Fund Flows</a><nav class="main">${NAV.map(n => `<a href="${BASE}${n[0]}" class="${n[2] === active ? 'on' : ''}">${n[1]}</a>`).join('')}</nav><div class="search"><input type="search" placeholder="Search a stock or fund…" aria-label="Search" autocomplete="off"><div class="suggest"></div></div><div class="hbtns"><button type="button" id="srch-btn" aria-label="Search" aria-expanded="false"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button><button type="button" id="menu-btn" aria-label="Menu" aria-expanded="false"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></div></header><main><div class="wrap" id="main"></div></main><footer class="foot"><div class="wrap"><div id="foot-cov"></div><p class="small"><b>Disclaimer:</b> Mutual Fund Flows is an independent educational and research project. It is not registered with SEBI as an investment adviser or research analyst, and nothing on this site is investment advice, a recommendation, or an offer or solicitation to buy or sell any security. Data comes from <a href="${BASE}/about">mutual funds' own public portfolio disclosures</a>; prices are approximations derived from them, and figures may be incomplete or wrong. Past patterns don't predict future results. Investments in securities are subject to market risks. Do your own research or consult a SEBI-registered adviser before making any investment decision. The AI assistant can make mistakes.</p></div></footer>`;
  initSearch();
  const hd = $('header.top'), sb = $('#srch-btn'), mb = $('#menu-btn');
  const setOpen = (k, on) => { hd.classList.toggle(k, on); (k === 's-open' ? sb : mb).setAttribute('aria-expanded', String(on)); };
  sb.onclick = () => { const on = !hd.classList.contains('s-open'); setOpen('s-open', on); if (on) { setOpen('m-open', false); setTimeout(() => $('.search input').focus(), 30); } };
  mb.onclick = () => { const on = !hd.classList.contains('m-open'); setOpen('m-open', on); if (on) setOpen('s-open', false); };
  $$('nav.main a').forEach(a => a.addEventListener('click', () => setOpen('m-open', false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { setOpen('s-open', false); setOpen('m-open', false); } });
  getJSON('meta.json').then(m => { $('#foot-cov').innerHTML = `Data through <b>${mlabel(m.month)}</b> · ${m.houses.length} fund houses · ${m.schemes} active equity schemes · ${m.stocks} stocks · built ${esc(m.built)}`; }).catch(() => { });
  return $('#main');
}
async function initSearch() {
  const inp = $('.search input'), box = $('.suggest'); let idx = null, sel = -1; inp.value = ''; window.addEventListener('pageshow', () => { inp.value = ''; box.style.display = 'none'; });
  const load = async () => { if (idx) return idx; const [s, f] = await Promise.all([getJSON('stocks.json'), getJSON('funds.json')]); idx = [...s.r.map(r => ({ t: 'stock', c: r[0], n: r[1], sub: r[2], w: r[3], l: BASE + '/stock?c=' + r[0] })), ...f.r.map(r => ({ t: 'fund', c: r[0], n: r[1], sub: r[2], w: r[5], l: BASE + '/fund?id=' + r[0] }))]; return idx; };
  const run = async () => { const q = inp.value.trim().toLowerCase(); if (!q) { box.style.display = 'none'; return; } const ix = await load(); const toks = q.split(/\s+/); const res = ix.filter(i => toks.every(t => (i.n + ' ' + i.sub).toLowerCase().includes(t))).sort((a, b) => (b.n.toLowerCase().startsWith(q) - a.n.toLowerCase().startsWith(q)) || b.w - a.w).slice(0, 8); box.innerHTML = res.map(r => `<a href="${r.l}">${esc(r.n)}<small>${r.t === 'fund' ? 'fund · ' : ''}${esc(r.sub)}</small></a>`).join('') || '<a>No match</a>'; box.style.display = 'block'; sel = -1; };
  inp.oninput = run; inp.onfocus = run;
  inp.onkeydown = e => { const as = $$('a', box); if (e.key === 'ArrowDown') { sel = Math.min(as.length - 1, sel + 1); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); } else if (e.key === 'Enter') { const a = as[Math.max(0, sel)]; if (a && a.href) location.href = a.href; return; } else if (e.key === 'Escape') { box.style.display = 'none'; return; } else return; as.forEach((a, i) => a.classList.toggle('hi', i === sel)); e.preventDefault(); };
  document.addEventListener('click', e => { if (!e.target.closest('.search')) box.style.display = 'none'; });
}
const chatCtx = (ctx, sugg) => { window.FFL = { page: document.body.dataset.page, ctx: ctx || {}, suggestions: sugg || [] }; window.dispatchEvent(new Event('ffl-context')); };

/* ---------------------------------------------------------------- evidence helpers */
const H_LABEL = { 3: '3 months', 6: '6 months', 12: '12 months', 24: '2 years' };
function bucketCard(ev, sigKey, b, h, L) {
  const s = (L && sigKey === 'breadth' && ev.strength?.L?.[L]?.pooled?.[h]?.[b]) || ev.buckets[sigKey]?.[h]?.[b]; if (!s) return '<p class="muted small">Not enough history.</p>';
  const who = b === '1' ? 'funds had been buying' : b === '-1' ? 'funds had been selling' : 'funds had barely touched';
  return `<p class="plain"><b>In plain words:</b> in the past, stocks that ${who} went on to do <b class="${cls(s.mean)}">${vsAvg(s.mean)}</b> than the average stock over the next ${H_LABEL[h]}, on average. ${isReal(s.t) ? 'That gap is big and steady enough that it is unlikely to be luck.' : 'That gap is small enough that it could easily be luck, so it is not a dependable clue.'}</p><div class="grid g4" style="margin-top:10px"><div class="stat"><div class="v ${cls(s.mean)}">${pctn(s.mean, 1)}</div><div class="l">Average result compared with the average stock <span class="muted">(0% = kept pace with it)</span></div></div><div class="stat"><div class="v ${cls(s.median)}">${pctn(s.median, 1)}</div><div class="l">The "middle" stock: half did better than this, half did worse</div></div><div class="stat"><div class="v">${s.hit} in 100</div><div class="l">beat the average stock</div></div><div class="stat"><div class="v">${pctn(s.p10, 0)} to ${pctn(s.p90, 0)}</div><div class="l">Where 8 in 10 stocks landed. A wide range means lots of uncertainty.</div></div></div><p class="small muted">Based on ${nfmt.format(s.n)} past cases (one stock in one month = one case; about ${s.avg_stocks} stocks a month). How reliable is this? ${luckPill(s.t)}</p>`;
}

/* ---------------------------------------------------------------- pages */
const TIER_NAME = ['Light', 'Medium', 'Heavy'];
const LB_LABEL = { '1': '1 month', '3': '3 months', '6': '6 months', '12': '12 months' };
const strengthOf = (ev, L) => ev.strength?.L?.[L];
function tierSub(ev, measure, side, i, S) {
  const c = ev.strength.cuts[measure], verb = side === 'buy' ? 'buying' : 'selling', opp = side === 'buy' ? 'selling' : 'buying';
  if (measure === 'breadth') { const lo = Math.round(c[0] * S.n_schemes), hi = Math.round(c[1] * S.n_schemes); return [`fewer than ${lo} more funds ${verb} than ${opp}`, `${lo} to ${hi - 1} more funds ${verb} than ${opp}`, `${hi} or more funds ${verb} than ${opp}`][i]; }
  const p = v => Math.round(v * 100) + '%', w = side === 'buy' ? 'added' : 'removed';
  return [`${w} under ${p(c[0])} of what funds held`, `${w} ${p(c[0])} to ${p(c[1])} of what funds held`, `${w} ${p(c[1])} or more of what funds held`][i];
}
// light / medium / heavy history for one side (buy or sell), one look-back window L and one horizon h -> bars + plain-words text
function tierBlock(ev, measure, side, h, L) {
  const S = strengthOf(ev, L), r = S?.measures?.[measure]?.[side]?.[h]; if (!r) return null;
  const verb = side === 'buy' ? 'buying' : 'selling';
  // Per-tier "Could be luck" / "Unlikely to be luck" notes used to repeat on all three bars; that reliability call is
  // now made once, for the group as a whole, in luckNote below - the bars themselves are supporting detail only.
  const items = r.tiers.map((t, i) => ({ label: TIER_NAME[i] + ' ' + verb, sub: tierSub(ev, measure, side, i, S), val: t.mean, color: side === 'buy' ? 'var(--buy)' : 'var(--sell)' }));
  const hv = r.tiers[2], lt = r.tiers[0];
  const verdictWord = side === 'buy' ? 'bought' : 'sold', dirWord = hv.mean >= 0 ? 'BETTER' : 'WORSE';
  const verdict = `Historically, heavily-${verdictWord} stocks did <b class="${cls(hv.mean)}">${Math.abs(hv.mean).toFixed(1)}% ${dirWord}</b> than the average stock over the next ${H_LABEL[h]}.`;
  const luckNote = isReal(r.t) ? 'These gaps are large enough that they are unlikely to be luck.' : 'These gaps are small enough that they could be luck.';
  const summary = `<b>Heavy ${verb}</b> stocks did <b class="${cls(hv.mean)}">${vsAvg(hv.mean)}</b> than the average stock (${luckTxt(hv.t).toLowerCase()}); <b>light ${verb}</b> stocks did <b class="${cls(lt.mean)}">${vsAvg(lt.mean)}</b> (${luckTxt(lt.t).toLowerCase()}).`;
  const gap = `<p class="small" style="margin:.4em 0 0"><b>Heavy vs. light ${verb}:</b> heavy finished ${vsAvg(r.spread)} than light (${luckTxt(r.t).toLowerCase()}). Based on ${nfmt.format(r.tiers.reduce((a, t) => a + t.n, 0))} past cases.</p>`;
  const U = ev.strength.universe, nh = ev.coverage?.houses?.length || 11;
  // lo/hi must come from the SAME cuts-fraction × n_schemes formula tierSub() uses for the bar sub-labels above -
  // this text used to hardcode "2, 2 to 4, and 5 or more" regardless of S.n_schemes, which drifted wrong (6, not 5)
  // once the scheme count grew past 200, so the collapsed text quietly disagreed with the bars right above it.
  const cutsB = ev.strength.cuts.breadth, loN = Math.round(cutsB[0] * S.n_schemes), hiN = Math.round(cutsB[1] * S.n_schemes);
  const rule = measure === 'breadth' ? `<b>How light, medium and heavy are defined:</b> by how many more funds were ${verb} the stock than ${side === 'buy' ? 'selling' : 'buying'} it over the look-back window. The rule is fixed (under 1% of all funds = light, 1% to 2.5% = medium, 2.5% or more = heavy; with ${S.n_schemes} schemes from ${nh} fund houses that is fewer than ${loN}, ${loN} to ${hiN - 1}, and ${hiN} or more) and is the same for every stock and every month. It is about how many funds agree, not the size of the company or the rupee amount.` : `<b>How light, medium and heavy are defined:</b> by net money ${side === 'buy' ? 'added' : 'removed'} compared with what funds already held in the stock (under 5% = light, 5% to 20% = medium, 20% or more = heavy). The rule is fixed for every stock and month.`;
  const tip = `<p class="small muted" style="margin:.5em 0 0">${rule}</p><p class="small muted" style="margin:.5em 0 0"><b>Reading tip:</b> "the average stock" is the simple average return of all the stocks these funds hold (about ${U} in a typical month, each counted equally) over that same ${H_LABEL[h]}. So "${vsAvg(hv.mean)}" means: if the average stock rose 15%, the heavy-${verb} stocks rose about ${Math.round(15 + hv.mean)}%.</p>`;
  return { items, summary, details: gap + tip, verdict, luckNote };
}

const midx = s => { const [y, m] = String(s).split('-'); return (+y) * 12 + (+m) - 1; };
// monthIdx is the same function as midx under a name pages.movers can call directly: that page's own `midx` local
// variable (the fetched movers/index.json data) shadows the name `midx` within its scope, so code in there needs a
// different name to reach this arithmetic. monthFromIdx reverses it (index -> "YYYY-MM"); addMonths shifts by n
// months (n<0 goes back). All defined at top level so their own closures resolve these names independently of any
// page's local variables.
const monthIdx = midx;
const monthFromIdx = i => Math.floor(i / 12) + '-' + String(i % 12 + 1).padStart(2, '0');
const addMonths = (m, n) => monthFromIdx(monthIdx(m) + n);
const eventsFor = (evt, comp, latest, months) => ((evt && evt.events && evt.events[comp]) || []).filter(e => midx(latest) - midx(e.m) < months);
const eventBadge = list => list.length ? `<span class="pill warn" title="${esc(list.map(e => `${mlabel(e.m)}: ${e.new} more schemes opened a position in the same month (${e.before} holders before, ${e.after} after). This is typical of an IPO, demerger or large share sale (OFS or QIP) rather than gradual buying by fund managers.`).join(' '))}">One-off event</span>` : '';

/* ---------------------------------------------------------------- watchlist (this device only) and sharing */
const WL_KEY = 'ffl_watch_v1';
const wlGet = () => { try { const l = JSON.parse(localStorage.getItem(WL_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
const wlSave = l => { try { localStorage.setItem(WL_KEY, JSON.stringify(l.slice(0, 60))); return true; } catch (e) { return false; } };
const wlHas = (t, id) => wlGet().some(x => x.t === t && x.id === id);
function wlToggle(t, id, name) { const l = wlGet(), i = l.findIndex(x => x.t === t && x.id === id); if (i >= 0) l.splice(i, 1); else l.push({ t, id, name }); return wlSave(l) ? (i < 0) : null; }
function copyText(text, done) {
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); done(ok); };
  try { navigator.clipboard.writeText(text).then(() => done(true), fallback); } catch (e) { fallback(); }
}
function wireActions(kind, id, name, shareText) {
  const star = $('#star'), msg = $('#acts-msg'), sh = $('#share');
  const paint = () => { const on = wlHas(kind, id); star.setAttribute('aria-pressed', String(on)); star.textContent = on ? '★ Watching' : '☆ Watch'; };
  paint();
  star.onclick = () => { const r = wlToggle(kind, id, name); if (r === null) msg.textContent = 'This browser is not letting us save. Turn off private browsing to use the watchlist.'; else msg.textContent = r ? 'Added. See it on the moves page.' : 'Removed.'; paint(); };
  if (sh) sh.onclick = () => copyText(shareText(), ok => { msg.textContent = ok ? 'Copied. Paste it anywhere.' : 'Could not copy. Select the address bar and share the link.'; setTimeout(() => { msg.textContent = ''; }, 3500); });
}
async function renderWatch(el, evt, latest) {
  const list = wlGet();
  if (!list.length) { el.innerHTML = '<p class="small muted" style="margin:6px 0">Star a stock or fund (the Watch button on its page) to follow it here. Your watchlist is saved on this device only.</p>'; return; }
  const stocks = list.filter(x => x.t === 'stock'), funds = list.filter(x => x.t === 'fund');
  const sd = await Promise.all(stocks.map(x => getJSON('stock/' + encodeURIComponent(x.id) + '.json').catch(() => null)));
  const fd = await Promise.all(funds.map(x => getJSON('fund/' + encodeURIComponent(x.id) + '.json').catch(() => null)));
  const rm = (t, id) => `<button type="button" class="x" data-t="${t}" data-id="${esc(id)}" title="Stop watching" aria-label="Stop watching">×</button>`;
  const srows = sd.map((d, i) => { if (!d) return ''; const w1 = d.win['1'], w3 = d.win['3']; return `<tr><td>${stockLink(d.c, d.name)} ${eventBadge(eventsFor(evt, d.c, latest, 3))}</td><td class="r"><span class="${cls(w1[2])}">${crs(w1[2])}</span><span class="sub">${w1[0]} adding / ${w1[1]} cutting</span></td><td class="r"><span class="${cls(w3[2])}">${crs(w3[2])}</span><span class="sub">${w3[0]} adding / ${w3[1]} cutting</span></td><td class="r"><span class="${cls(d.r3)}">${pct(d.r3)}</span></td><td class="r">${rm('stock', stocks[i].id)}</td></tr>`; }).join('');
  const frows = fd.map((d, i) => { if (!d) return ''; const a = d.adds3.slice(0, 2).map(x => `${esc(x[1])} <span class="pos">${crs(x[2])}</span>`).join(', ') || '–', c = d.trims3.slice(0, 2).map(x => `${esc(x[1])} <span class="neg">${crs(x[2])}</span>`).join(', ') || '–'; return `<tr><td><a href="${BASE}/fund?id=${encodeURIComponent(d.id || funds[i].id)}">${esc(d.name)}</a><span class="sub">${esc(d.house)}</span></td><td>${a}</td><td>${c}</td><td class="r">${rm('fund', funds[i].id)}</td></tr>`; }).join('');
  el.innerHTML = `<div class="card" style="margin-bottom:12px"><h3 style="margin:0 0 2px">Watching (${list.length})</h3><p class="small muted" style="margin:0 0 8px">Saved on this device only, in this browser. No account, nothing is sent to us. Clearing your browser data removes it.</p>` +
    (srows ? `<div class="tw"><table><thead><tr><th>Stock</th><th class="r">Last month</th><th class="r">Last 3 months</th><th class="r">Price 3 mo</th><th></th></tr></thead><tbody>${srows}</tbody></table></div>` : '') +
    (frows ? `<div class="tw" style="margin-top:8px"><table><thead><tr><th>Fund</th><th>Added (3 mo)</th><th>Trimmed (3 mo)</th><th></th></tr></thead><tbody>${frows}</tbody></table></div>` : '') + '</div>';
  $$('button.x', el).forEach(b => b.onclick = () => { wlToggle(b.dataset.t, b.dataset.id); renderWatch(el, evt, latest); });
}

const missingHouses = (list, what) => (list && list.length) ? `<p style="margin:0 0 6px"><b>Missing data ${what}:</b> ${list.map(esc).join(', ')}. Their trades ${what === 'this month' ? 'in this month' : 'in these months'} are not in the totals, so the totals and rankings shown may differ from the true totals.</p>` : '';
const earlyNote = (cm, mo) => (cm && cm.months && cm.months[mo] && cm.first_complete_month && mo < cm.first_complete_month && cm.months[mo].houses < cm.houses_total) ? `Only ${cm.months[mo].houses} of the ${cm.houses_total} covered fund houses are in the data for ${mlabel(mo)}; the others start later. Totals for this month are not comparable with ${mlabel(cm.first_complete_month)} onwards, when all ${cm.houses_total} are in. ` : '';
const monthOutside = (asked, months, page, what) => {
  if (!asked || months.includes(asked)) return null;
  const first = months[months.length - 1], latest = months[0], ok = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked);
  const why = !ok ? `"${esc(asked)}" is not a month.` : asked < first ? `<b>The data starts ${mlabel(first)}.</b> There are no ${what} for ${mlabel(asked)}${asked < first ? '. Disclosures begin in October 2012, and a month can only be compared with the months before it, so the first month shown is ' + mlabel(first) : ''}.` : `The latest data is ${mlabel(latest)}. There is nothing for ${mlabel(asked)} yet.`;
  return `<h1>${what === 'moves' ? 'Fund moves' : 'What changed'}</h1><div class="note" style="margin:12px 0"><p style="margin:0 0 8px">${why}</p><p style="margin:0">Months available: ${mlabel(first)} to ${mlabel(latest)}. <a href="${BASE}/${page}?m=${first}">${mlabel(first)}</a> · <a href="${BASE}/${page}">${mlabel(latest)} (latest)</a></p></div>`;
};
const monthBanner = (miss, catchup, early, unresolved) => ((miss && miss.length) || (catchup && catchup.length) || early) ? `<div class="note" style="margin:8px 0"><b>Incomplete data.</b> ${early || ''}${(miss && miss.length) ? 'No data for this month from ' + miss.map(esc).join(', ') + ': their trading is missing here, so the totals and rankings shown may differ from the true totals. ' : ''}${(catchup && catchup.length) ? 'This month also includes two months of trading by ' + catchup.map(esc).join(', ') + ' (their previous month is missing), so their activity looks larger than it was in a single month. ' : ''}${(unresolved && unresolved.length) ? 'For ' + unresolved.map(esc).join(', ') + ', we searched the fund house\'s own site, web archives and industry sources and could not find this month\'s disclosure anywhere — it may no longer be hosted at all, so this gap is unlikely to fill in later. ' : ''}Longer windows are less affected.</div>` : '';

const pages = {};

pages.home = async main => {
  main.innerHTML = '<p class="muted">Loading…</p>';
  const [meta, mv, ev] = await Promise.all([getJSON('meta.json'), getJSON('movers.json'), getJSON('evidence.json')]);
  const b = ev.buckets.breadth['12'], pers = ev.persistence, fm = ev.fm['12'], S3h = ev.strength.L['3'], ss = S3h.measures.breadth.sell['12'].tiers, bs = S3h.measures.breadth.buy['12'].tiers, hi3h = Math.round(ev.strength.cuts.breadth[1] * S3h.n_schemes);
  const row = r => `<tr><td>${stockLink(r[0], r[1])}<span class="sub">${esc(r[2])}</span></td><td class="r ${cls(r[4])}">${crs(r[4])}</td><td class="r nowrap">${buyBar(r[5], r[6])}</td></tr>`;
  main.innerHTML = `
  <p class="lead" style="font-size:1.15em;font-weight:600;margin:0 0 10px">See what Indian mutual funds actually buy and sell each month, stock by stock — and what history says happened to those stocks next.</p>
  <h1>What are these ${meta.houses.length} fund houses doing with stocks, and what happened next?</h1>
  <p class="lead">Covers ${meta.houses.length} of India's 54 fund houses, including SBI, HDFC and Nippon India. They disclose what they hold every month; we collected over a decade of those disclosures and tested whether what they buy and sell says anything about what happens next. Short answer: less than you'd hope.</p>
  <p style="margin:18px 0"><a class="btn" href="${BASE}/changes">See what changed in ${mlabel(meta.month)} →</a></p>
  <div class="grid g4" style="margin:22px 0">
    <div class="card stat"><div class="v">${mlabel(meta.month)}</div><div class="l">latest data month</div></div>
    <div class="card stat"><div class="v">${meta.houses.length} of 54</div><div class="l">fund houses covered</div></div>
    <div class="card stat"><div class="v">${meta.schemes}</div><div class="l">active equity schemes</div></div>
    <div class="card stat"><div class="v">${nfmt.format(meta.stocks)}</div><div class="l">stocks tracked · ${Math.floor(meta.months_of_history / 12)}+ years</div></div>
  </div>
  <p style="margin:-6px 0 18px" class="muted">New positions, full exits and the biggest adds and cuts, updated every month.</p>
  <div class="grid g2">
    <div class="card"><h3>Most bought by funds — last 3 months</h3><div class="tw"><table><tbody>${mv.w['3'].buy.slice(0, 6).map(row).join('')}</tbody></table></div><p class="small muted">Money funds added, in ₹ crore (1 crore = 10 million), ignoring routine buying from new SIP money. <a href="${BASE}/movers">See all →</a></p></div>
    <div class="card"><h3>Most sold by funds — last 3 months</h3><div class="tw"><table><tbody>${mv.w['3'].sell.slice(0, 6).map(row).join('')}</tbody></table></div><p class="small muted">The bar shows how many funds were buying (green) vs. selling (red). <a href="${BASE}/movers">See all →</a></p></div>
  </div>
  <h2>What history says</h2>
  <div class="grid g3">
    <div class="card"><h3>Funds buying a stock isn't a tip-off</h3><p>Stocks that many funds had been buying went on to do <b class="${cls(b['1'].mean)}">${vsAvg(b['1'].mean)}</b> than the average stock over the next year, ${isReal(b['1'].t) ? 'a gap big enough to take seriously' : 'a gap small enough to be luck'}. So "funds are buying it" hasn't been a reliable clue, and heavy buying (${hi3h} or more net funds, over 3 months) did <b class="${cls(bs[2].mean)}">${vsAvg(bs[2].mean)}</b> than average.</p></div>
    <div class="card"><h3>Top managers didn't reliably stay on top</h3><p>We split funds into thirds by their 3-year record. A year later the best third had done <b>${pctn(pers.top, 1)}</b> vs. similar funds and the worst third <b>${pctn(pers.bottom, 1)}</b>. A great past record was not a dependable sign of a great next year.</p></div>
    <div class="card"><h3>Broad selling was a warning sign</h3><p>When many funds were selling the same stock (heavy selling: ${hi3h} or more net funds over 3 months), it did <b class="${cls(ss[2].mean)}">${vsAvg(ss[2].mean)}</b> than the average stock over the next year. A few funds trimming meant little (<b class="${cls(ss[0].mean)}">${pctn(ss[0].mean, 1)}</b>). What matters is how many funds agree, not just the direction.</p></div>
  </div>
  <p style="margin-top:14px"><a href="${BASE}/evidence">See the full evidence and how we tested it →</a></p>
  <div class="note" style="margin-top:22px"><b>Read this first.</b> We cover ${meta.houses.length} fund houses (including some of the largest), not the whole industry. Stock prices here are approximations built from the funds' own disclosures and exclude dividends. This is a research tool to help you think — not a list of stocks to buy or sell. Use the chat (bottom-right) to ask anything.</div>`;
  chatCtx({ type: 'home' }, ['What are funds buying most right now?', 'Does fund buying actually predict returns?', 'Explain what funds buying and selling means, in plain words', 'What should I be careful about with this data?']);
};

pages.movers = async main => {
  main.innerHTML = `<h1 style="margin-bottom:4px">What fund buying does to stocks</h1><p class="lead" style="margin:.2em 0 .5em">Which stocks mutual funds have been buying or selling most, and what usually happened next to stocks in the same situation.</p>
  <p class="small muted" style="margin:0 0 10px">Two things on this page: what mutual funds bought and sold most, and what those stocks usually did next.</p>
  <div id="mv-miss"></div>
  <details class="howd"><summary>How to read this page</summary><div class="small">Pick a time window and a list. The table shows what funds <i>did</i>. The box above it shows what <i>historically happened afterwards</i> to stocks in the same situation, split into light, medium and heavy buying or selling, always compared with the average stock (0% means "just kept pace", not "no gain"). Hover over the ⓘ on a column heading to see what it means.</div></details>
  <div id="watch" style="margin-top:10px"></div>
  <p class="small muted" id="mv-hint" style="margin:8px 0 6px"></p>
  <div class="controls" style="margin-top:8px"><span><span class="lab">Month</span><select id="mm" aria-label="Month"></select></span><span><span class="lab">Look at the past</span><span class="seg" id="s-win"></span></span><span><span class="lab">Show me</span><span class="seg" id="s-list"></span></span><span><span class="lab">Then check what happened over the next</span><span class="seg" id="s-h"></span></span></div><div id="ev" class="card" style="margin-bottom:12px"></div><p class="small muted" id="mv-note" style="margin:0 0 8px"></p><div id="tb"></div><div id="mv-foot" class="small muted" style="margin-top:14px"></div>`;
  const midx = await getJSON('movers/index.json').catch(() => null);
  const outside = midx ? monthOutside(qs('m'), midx.months, 'movers', 'moves') : null; if (outside) { main.innerHTML = outside; return; }
  let mo = qs('m'); if (!midx || !midx.months.includes(mo)) mo = midx ? midx.latest : null;
  const isLatest = !midx || mo === midx.latest;
  const [mv, ev, evt, cmv] = await Promise.all([getJSON(midx ? 'movers/' + (isLatest ? midx.latest : mo) + '.json' : 'movers.json'), getJSON('evidence.json'), getJSON('events.json').catch(() => null), getJSON('coverage_months.json').catch(() => null), loadStockSet()]);
  if (midx) { $('#mm').innerHTML = midx.months.map(x => `<option value="${x}" ${x === mv.month ? 'selected' : ''}>${mlabel(x)}</option>`).join(''); $('#mm').onchange = e => { location.href = BASE + '/movers?m=' + e.target.value; }; }
  else $('#mm').closest('span').style.display = 'none';
  const st = { w: '3', l: 'buy', h: '12' };
  const seg = (id, opts, key) => { const el = $(id); el.innerHTML = opts.map(o => `<button data-v="${o[0]}" class="${st[key] === o[0] ? 'on' : ''}">${o[1]}</button>`).join(''); $$('button', el).forEach(b => b.onclick = () => { st[key] = b.dataset.v; draw(); }); };
  const LISTS = { buy: ['Most bought', 1], sell: ['Most sold', -1], broad_buy: ['Most funds buying', 1], churn: ['Most actively traded', 0] };
  let T;
  function draw() {
    if (!mv.w[st.w]) st.w = Object.keys(mv.w)[0];
    seg('#s-win', [['1', '1 month'], ['3', '3 months'], ['6', '6 months'], ['12', '12 months']].filter(o => mv.w[o[0]]), 'w');
    seg('#s-list', Object.entries(LISTS).map(([k, v]) => [k, v[0]]), 'l');
    seg('#s-h', [['3', '3 months'], ['6', '6 months'], ['12', '12 months'], ['24', '2 years']], 'h');
    const bk = LISTS[st.l][1], rows = mv.w[st.w][st.l];
    const explain = { buy: 'Stocks where funds added the most money over this period. We take out routine buying from new SIP money, so this shows real decisions.', sell: 'Stocks where funds took the most money out over this period.', broad_buy: 'Stocks where the largest number of different funds increased their holding.', churn: 'Stocks funds traded the most compared with what they hold: lots of buying and selling in both directions.' }[st.l];
    const verb = bk > 0 ? 'buying' : 'selling';
    // Dynamic hint: spell out the actual calendar months the current controls select, computed from the same
    // month arithmetic the rest of the page uses (mv.month, st.w, st.h) - never a hardcoded date. If "the next
    // <horizon>" from this month would run past the latest month we actually have data for, say so plainly instead
    // of naming months that haven't happened yet.
    { const wN = +st.w, hN = +st.h, lbStart = addMonths(mv.month, -(wN - 1));
      const lbPhrase = wN === 1 ? `in ${mlabel(mv.month)}` : `from ${mlabel(lbStart)} to ${mlabel(mv.month)}`;
      const dirWord = bk > 0 ? 'bought' : bk < 0 ? 'sold' : 'traded most actively';
      const latestM = midx ? midx.latest : mv.month, latestIdx = monthIdx(latestM);
      const fwdStartIdx = monthIdx(mv.month) + 1, fwdWantIdx = monthIdx(mv.month) + hN;
      let hint = `Showing stocks that funds ${dirWord} ${lbPhrase}`;
      if (bk === 0) hint += '.';
      else if (fwdStartIdx > latestIdx) hint += `, and how they performed over the next ${H_LABEL[st.h]} — performance data is available only up to ${mlabel(latestM)}, so there is nothing to show there yet.`;
      else { const fwdEndIdx = Math.min(fwdWantIdx, latestIdx), clipped = fwdWantIdx > latestIdx;
        hint += `, and how they performed over the next ${H_LABEL[st.h]} (${mlabel(monthFromIdx(fwdStartIdx))} to ${mlabel(monthFromIdx(fwdEndIdx))})` + (clipped ? ` — performance data available only up to ${mlabel(latestM)}.` : '.'); }
      $('#mv-hint').textContent = hint;
    }
    $('#ev').innerHTML = `<h3 style="margin:0 0 2px">${LISTS[st.l][0]} — last ${LB_LABEL[st.w]} <span class="muted small">(data to ${mlabel(mv.month)})</span></h3><p class="small muted" style="margin:0 0 8px">${explain}</p>` +
      (bk === 0 ? '<p class="small">We have not checked history for "most actively traded" on its own. See the Evidence page for how stocks funds left alone compared with ones they were buying or selling.</p>' :
        `<div class="split"><div><p id="mv-verdict" class="verdict" style="margin:0 0 10px"></p><div id="mv-t"></div><p id="mv-luck" class="small muted" style="margin:8px 0 0"></p></div><div><p class="plain" id="mv-s" style="margin-top:0"></p><details><summary class="small">How this is worked out, and the numbers behind it</summary><div id="mv-d"></div><div style="margin-top:8px"><b class="small">All ${verb} stocks lumped together</b>${bucketCard(ev, 'breadth', String(bk), st.h, st.w)}</div></details></div></div>`);
    if (bk !== 0) { const t = tierBlock(ev, 'breadth', bk > 0 ? 'buy' : 'sell', st.h, st.w); if (t) { $('#mv-verdict').innerHTML = t.verdict; hbars($('#mv-t'), t.items); $('#mv-luck').textContent = t.luckNote; $('#mv-s').innerHTML = t.summary; $('#mv-d').innerHTML = t.details; } }
    // Same lo/hi formula as tierSub()/tierBlock()'s rule text, computed once here for the "Strength" column tip below -
    // it used to hardcode "fewer than 2, medium 2 to 4, heavy 5 or more" regardless of the actual scheme count.
    const S_str = strengthOf(ev, st.w), N_str = mv.n_schemes || (S_str && S_str.n_schemes);
    const cutsB_str = ev.strength.cuts.breadth, loN_str = N_str ? Math.round(cutsB_str[0] * N_str) : 2, hiN_str = N_str ? Math.round(cutsB_str[1] * N_str) : 5;
    const cols = [
      { label: 'Stock', get: r => r[1], asc: true, html: r => stockLink(r[0], r[1]) + `<span class="sub">${esc(r[2])} ${eventBadge(eventsFor(evt, r[0], mv.month, +st.w))}</span>` },
      { label: 'Held by funds', tip: 'The market value of this stock held across all the fund schemes we track.', cls: 'r', get: r => r[3], html: r => cr(r[3]) },
      { label: 'Money added', tip: 'Money funds put into this stock minus money they took out over the period you chose. Green = net buying, red = net selling. 1 crore = 10 million rupees.', cls: 'r', get: r => r[4], html: r => `<span class="${cls(r[4])}">${crs(r[4])}</span>` },
      { label: 'Adding / cutting', tip: 'How many funds raised their holding (green) versus reduced it (red). The numbers show funds adding / funds cutting.', cls: 'r', get: r => r[5] - r[6], html: r => buyBar(r[5], r[6]) },
      { label: 'Strength', tip: `How strongly funds were buying or selling over the window you picked, compared with history: light, medium or heavy, based on how many funds were net buying or selling it (light: fewer than ${loN_str} net funds, medium: ${loN_str} to ${hiN_str - 1}, heavy: ${hiN_str} or more). It counts funds, not rupees, so a stock can be heavily sold by many funds and still appear in Most bought if a few funds added a lot of money.`, cls: 'r', get: r => r[5] - r[6], html: r => { const S = strengthOf(ev, st.w); if (!S) return '<span class="muted">–</span>'; const b = (r[5] - r[6]) / (mv.n_schemes || S.n_schemes); if (!b) return '<span class="pill">Little activity</span>'; const side = b > 0 ? 'buy' : 'sell', c = ev.strength.cuts.breadth, v = Math.abs(b), i = v < c[0] ? 0 : v < c[1] ? 1 : 2; const mixed = (r[4] > 0) !== (b > 0); return `<span class="pill ${side}">${TIER_NAME[i]} ${side === 'buy' ? 'buying' : 'selling'}</span>` + (mixed ? ' <span class="small muted" title="Money added and the number of funds point in different directions: a few funds added a lot of money while more funds sold, or the reverse.">mixed</span>' : ''); } },
      { label: 'Held by', tip: 'How many fund schemes hold this stock today.', cls: 'r', get: r => r[7], html: r => r[7] + ' funds' },
      { label: 'Price 3 mo', tip: 'How the stock price moved over the last 3 months. Approximate: worked out from the funds own disclosures.', cls: 'r', get: r => r[8], html: r => `<span class="${cls(r[8])}">${pct(r[8])}</span>` },
      { label: 'Price 12 mo', tip: 'How the stock price moved over the last 12 months. Approximate: worked out from the funds own disclosures.', cls: 'r', get: r => r[9], html: r => `<span class="${cls(r[9])}">${pct(r[9])}</span>` },
      { label: 'Trading activity', tip: 'How much funds traded this stock (buying plus selling) compared with what they hold. Higher = more in-and-out activity.', cls: 'r', get: r => r[10], html: r => r[10] == null ? '–' : r[10].toFixed(2) + '×' }];
    const sortIdx = st.l === 'sell' ? 2 : st.l === 'broad_buy' ? 3 : st.l === 'churn' ? 8 : 2;
    $('#mv-note').innerHTML = 'This list is ranked by ' + (st.l === 'broad_buy' ? 'how many funds bought' : st.l === 'churn' ? 'trading activity' : 'rupees of money added or removed') + '. <b>Strength</b> counts funds, not rupees, so a stock can add a lot of money and still show "Heavy selling" (marked "mixed") when a few funds bought big while many sold. A <span class="pill warn">One-off event</span> tag means many funds opened a position in the same month, typical of an IPO, demerger or large share sale rather than gradual buying.';
    T = table($('#tb'), cols, rows, { sort: sortIdx, dir: st.l === 'sell' ? 1 : -1, limit: 25 });
  }
  draw();
  $('#mv-foot').innerHTML = `<p style="margin:0 0 6px"><b>How the lists are ranked.</b> <b>Most bought</b>: the biggest net money added by funds over the window (buying minus selling, price-adjusted). <b>Most sold</b>: the biggest net money removed. <b>Most funds buying</b>: the biggest excess of funds adding over funds cutting. <b>Most actively traded</b>: money traded in and out, compared with the amount held. The window is the 1, 3, 6 or 12 months ending in the month shown; a window is offered only when there is enough history before that month.</p><p style="margin:0 0 6px"><b>Timing and coverage.</b> Each month is the funds' month-end disclosure, published about 10 days into the following month, so it was public only after the month ended. Earlier months cover fewer funds${mv.n_schemes ? ' (' + mv.n_schemes + ' schemes in this month)' : ''}.</p>`;
  $('#mv-miss').innerHTML = monthBanner(mv.amcs_missing, mv.amcs_catchup, earlyNote(cmv, mv.month), mv.amcs_unresolved);
  if (isLatest) renderWatch($('#watch'), evt, mv.month); else $('#watch').innerHTML = '';
  chatCtx({ type: 'movers' }, ['Summarise this month\'s biggest moves in plain words', 'Which stocks are being sold the most, and does history say that matters?', 'Why might funds be selling Reliance?', 'What does "money added" mean?']);
};

// Monthly email signup (Buttondown, double opt-in). The form appears only when /api/subscribe reports it is switched on.
function initDigest() {
  const el = $('#digest'); if (!el) return;
  fetch(API + '/api/subscribe').then(r => r.ok ? r.json() : { enabled: false }).catch(() => ({ enabled: false })).then(j => {
    if (!j || !j.enabled) return;
    el.innerHTML = `<div class="card" id="dg" style="margin-top:18px"><h2 style="margin-top:0">Get this by email, once a month</h2><p class="muted" style="max-width:62ch">One short email after each monthly data update with the biggest changes. We send a confirmation link first, and nothing else until you click it. You can unsubscribe from any email.</p><form id="dgf" class="dgf" novalidate><label class="sr" for="dge">Email address</label><input id="dge" type="email" required autocomplete="email" placeholder="you@example.com" maxlength="254"><input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit" class="btn" id="dgb">Email me the monthly update</button></form><p class="small" id="dgm" role="status" style="min-height:1.4em;margin:8px 0 0"></p><p class="small muted" style="margin:6px 0 0">Emails are sent through Buttondown and your address goes straight to them; we do not keep it on this site. Educational research, not investment advice.</p></div>`;
    const ctl = $('.controls'); if (ctl) ctl.insertAdjacentHTML('beforeend', '<span><a href="#dg">Get this by email</a></span>');
    const f = $('#dgf'), m = $('#dgm'), b = $('#dgb');
    f.onsubmit = async e => {
      e.preventDefault(); const email = $('#dge').value.trim();
      if (!email) { m.textContent = 'Please enter your email address.'; return; }
      b.disabled = true; m.textContent = 'Sending…';
      try {
        const r = await fetch(API + '/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, website: f.website.value }) });
        let d = {}; try { d = await r.json(); } catch (x) { }
        if (r.ok && d.ok) { f.style.display = 'none'; m.innerHTML = '<b>Check your inbox.</b> We sent a confirmation link to ' + esc(email) + '. Click it to finish. If it does not arrive in a few minutes, look in your spam folder.'; }
        else { m.textContent = d.error || 'Something went wrong. Please try again.'; b.disabled = false; }
      } catch (x) { m.textContent = 'Could not send. Check your connection and try again.'; b.disabled = false; }
    };
  });
}

pages.changes = async main => {
  main.innerHTML = '<p class="muted">Loading…</p>';
  const idx = await getJSON('changes/index.json'); const outside = monthOutside(qs('m'), idx.months, 'changes', 'changes'); if (outside) { main.innerHTML = outside; return; }
  let m = qs('m'); if (!idx.months.includes(m)) m = idx.latest;
  const [d, evt, fl, cmc] = await Promise.all([getJSON('changes/' + m + '.json'), getJSON('events.json').catch(() => null), getJSON('funds.json').catch(() => ({ r: [] })), getJSON('coverage_months.json').catch(() => null), loadStockSet()]);
  const live = new Set((fl.r || []).map(r => r[0]));
  const fresh = d.top_bought.filter(r => !r[7]).length, freshS = d.top_sold.filter(r => !r[7]).length;
  const stockCols = kind => [
    { label: 'Stock', get: r => r[1], asc: true, html: r => stockLink(r[0], r[1]) + ' ' + eventBadge(eventsFor(evt, r[0], d.month, 1)) },
    { label: kind === 'buy' ? 'Money added' : 'Money removed', cls: 'r', get: r => r[2], html: r => `<span class="${cls(r[2])}">${crs(r[2])}</span>` },
    { label: 'Adding / cutting', tip: 'How many schemes added to the stock versus reduced it this month.', cls: 'r', get: r => r[3] - r[4], html: r => buyBar(r[3], r[4]) },
    { label: 'Opened / closed', tip: 'Schemes that opened a brand new position this month, and schemes that closed theirs completely.', cls: 'r', get: r => r[5] - r[6], html: r => `${r[5]} / ${r[6]}` },
    { label: 'Last month', tip: 'Where the stock ranked on this same list last month.', cls: 'r', get: r => r[7] || 99, html: r => r[7] ? '#' + r[7] : '<span class="pill">new in top 10</span>' }];
  const posCols = (amtLabel, tip, signed) => [
    { label: 'Stock', get: r => r[1], asc: true, html: r => stockLink(r[0], r[1]) },
    { label: 'Fund', get: r => r[3], asc: true, html: r => (live.has(r[2]) ? `<a href="${BASE}/fund?id=${encodeURIComponent(r[2])}">${esc(r[3])}</a>` : esc(r[3])) + `<span class="sub">${esc(r[4])}</span>` },
    { label: amtLabel, cls: 'r', get: r => r[5], html: r => signed ? `<span class="${cls(r[5])}">${crs(r[5])}</span>` : cr(r[5]) },
    { label: 'Share of fund', tip, cls: 'r', get: r => r[6], html: r => r[6] == null ? '–' : r[6] + '%' }];
  main.innerHTML = `<h1 style="margin-bottom:4px">What changed in ${mlabel(d.month)}</h1>
  ${monthBanner(d.amcs_missing, null, earlyNote(cmc, d.month), d.amcs_unresolved)}
  <p class="lead" style="margin:.2em 0 .5em">${d.schemes} active schemes were in the data in both ${mlabel(d.prev_month)} and ${mlabel(d.month)}. ${d.net_flow_cr >= 0 ? 'Funds added a net' : 'Funds took out a net'} ${cr(Math.abs(d.net_flow_cr))}; ${d.new_positions_total} new positions were opened and ${d.exits_total} were closed completely. ${fresh ? (fresh === d.top_bought.length ? `None of the ${fresh} most-added stocks were in last month's top 10.` : `${fresh} of the ${d.top_bought.length} most-added stocks were not in last month's top 10.`) : ''}</p>
  <div class="controls"><span><span class="lab">Month</span><select id="cm">${idx.months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${mlabel(x)}</option>`).join('')}</select></span></div>
  <div class="grid g2" style="margin-top:14px">
    <div><h2 style="margin-top:0">Most added by funds</h2><div id="ch-buy"></div></div>
    <div><h2 style="margin-top:0">Most removed by funds</h2><div id="ch-sell"></div></div>
  </div>
  ${d.events.length ? `<h2>One-off events this month</h2><div class="card"><p class="small muted" style="margin-top:0">Many schemes opened a position in the same month, typical of an IPO, demerger or large share sale (OFS or QIP) rather than gradual buying. They are the reason some stocks jump to the top of the lists above.</p><ul style="margin:0;padding-left:1.2em">${d.events.map(e => `<li>${stockLink(e[0], e[1])}: ${e[2]} more schemes opened a position (${e[3]} holders before, ${e[4]} after)</li>`).join('')}</ul></div>` : ''}
  <div class="grid g2" style="margin-top:6px">
    <div><h2>Biggest new positions</h2><p class="small muted" style="margin:-6px 0 8px">One fund opening a stock it did not hold last month.</p><div id="ch-new"></div></div>
    <div><h2>Positions closed completely</h2><p class="small muted" style="margin:-6px 0 8px">One fund selling out of a stock it held last month. Amount is what it held.</p><div id="ch-exit"></div></div>
  </div>
  <div class="grid g2">
    <div><h2>Biggest increases</h2><p class="small muted" style="margin:-6px 0 8px">Adding to a stock the fund already held.</p><div id="ch-inc"></div></div>
    <div><h2>Biggest cuts</h2><p class="small muted" style="margin:-6px 0 8px">Trimming a stock the fund still holds.</p><div id="ch-cut"></div></div>
  </div>
  <div class="grid g2">
    <div><h2>Stocks the most funds started buying</h2><div id="ch-mn"></div></div>
    <div><h2>Stocks the most funds sold out of</h2><div id="ch-mx"></div></div>
  </div>
  <div id="digest"></div>
  <p class="small muted" style="margin-top:14px">Amounts are in ₹ crore and price-adjusted: a stock rising in price on its own is not counted as buying. Only schemes that were in the data last month are counted. Research and education only, not investment advice.</p>`;
  $('#cm').onchange = e => { location.href = BASE + '/changes?m=' + e.target.value; };
  table($('#ch-buy'), stockCols('buy'), d.top_bought, { sort: 1, limit: 10 });
  table($('#ch-sell'), stockCols('sell'), d.top_sold, { sort: 1, dir: 1, limit: 10 });
  table($('#ch-new'), posCols('Amount', 'Size of the new position as a share of the fund\'s equity holdings.'), d.new_positions, { sort: 2, limit: 10 });
  table($('#ch-exit'), posCols('Amount held', 'How big the closed position was, as a share of the fund\'s equity holdings.'), d.exits, { sort: 2, limit: 10 });
  table($('#ch-inc'), posCols('Added', 'Size of the holding after the change, as a share of the fund\'s equity holdings.', true), d.increases, { sort: 2, limit: 10 });
  table($('#ch-cut'), posCols('Trimmed', 'Size of the holding after the change, as a share of the fund\'s equity holdings.', true), d.cuts, { sort: 2, dir: 1, limit: 10 });
  table($('#ch-mn'), [{ label: 'Stock', get: r => r[1], asc: true, html: r => stockLink(r[0], r[1]) + ' ' + eventBadge(eventsFor(evt, r[0], d.month, 1)) }, { label: 'Schemes that opened it', cls: 'r', get: r => r[2], html: r => r[2] }, { label: 'Total put in', cls: 'r', get: r => r[3], html: r => cr(r[3]) }], d.most_new_holders, { sort: 1, limit: 8 });
  table($('#ch-mx'), [{ label: 'Stock', get: r => r[1], asc: true, html: r => stockLink(r[0], r[1]) }, { label: 'Schemes that closed it', cls: 'r', get: r => r[2], html: r => r[2] }], d.most_exits, { sort: 1, limit: 8 });
  initDigest();
  chatCtx({ type: 'changes' }, ['Summarise what changed this month', 'Which stocks did funds sell out of this month?', 'Why did LIC jump to the top this month?', 'What are the biggest new positions?']);
};

pages.stocks = async main => {
  main.innerHTML = '<h1>Stocks</h1><p class="lead">Every stock held by the funds we track. Click a column heading to sort, hover the ⓘ to see what it means, and click a stock for its full history.</p><div class="controls"><input type="search" id="q" placeholder="Filter by name…" style="min-width:220px"><select id="ind"><option value="">All industries</option></select><select id="bk"><option value="">Any fund activity</option><option value="1">Funds buying</option><option value="-1">Funds selling</option><option value="0">Little activity</option></select></div><div id="tb"></div>';
  const s = await getJSON('stocks.json'); const rows = s.r;
  const inds = [...new Set(rows.map(r => r[2]).filter(Boolean))].sort(); $('#ind').innerHTML += inds.map(i => `<option>${esc(i)}</option>`).join('');
  const cols = [
    { label: 'Stock', get: r => r[1], asc: true, html: r => stockLink(r[0], r[1]) + `<span class="sub">${esc(r[2])}</span>` },
    { label: 'Held by funds', tip: 'The market value of this stock held across all the fund schemes we track.', cls: 'r', get: r => r[3], html: r => cr(r[3]) },
    { label: 'Held by', tip: 'How many fund schemes hold this stock today.', cls: 'r', get: r => r[4], html: r => r[4] + ' funds' },
    { label: 'Fund activity', tip: 'Were funds mostly buying, mostly selling, or leaving this stock alone over the last 3 months? The bar shows funds adding (green) vs. cutting (red).', cls: 'r', get: r => r[8] * 1e3 + (r[5] - r[6]), html: r => bucketPill(r[8]) + ' ' + buyBar(r[5], r[6]) },
    { label: 'Money added (3 mo)', tip: 'Money funds put in minus money they took out over the last 3 months. 1 crore = 10 million rupees.', cls: 'r', get: r => r[7], html: r => `<span class="${cls(r[7])}">${crs(r[7])}</span>` },
    { label: 'Price 12 mo', tip: 'How the stock price moved over the last 12 months. Approximate: worked out from the funds own disclosures.', cls: 'r', get: r => r[11], html: r => `<span class="${cls(r[11])}">${pct(r[11])}</span>` }];
  const T = table($('#tb'), cols, rows, { sort: 1, limit: 50 });
  const f = () => { const q = $('#q').value.toLowerCase(), i = $('#ind').value, b = $('#bk').value; T.set(rows.filter(r => (!q || r[1].toLowerCase().includes(q)) && (!i || r[2] === i) && (!b || String(r[8]) === b))); };
  $('#q').oninput = f; $('#ind').onchange = f; $('#bk').onchange = f;
  chatCtx({ type: 'stocks' }, ['Which sectors have funds been buying?', 'Find me stocks funds are selling that have also fallen', 'What does "total held by funds" mean?']);
};

pages.stock = async main => {
  const c = qs('c'); if (!c) { main.innerHTML = `<p>No stock selected. <a href="${BASE}/stocks">Browse stocks</a></p>`; return; }
  main.innerHTML = '<p class="muted">Loading…</p>';
  let s, ev; try { [s, ev] = await Promise.all([getJSON('stock/' + encodeURIComponent(c) + '.json'), getJSON('evidence.json')]); } catch (e) { main.innerHTML = `<div class="note">We don't have a page for that stock. <a href="${BASE}/stocks">Browse all stocks</a>.</div>`; return; }
  const ser = s.series.map(r => Object.fromEntries(s.sh.map((k, i) => [k, r[i]]))); const labels = ser.map(r => r.m);
  const w3 = s.win['3'], net = w3[0] - w3[1], bk = Math.sign(net);
  const last = ser[ser.length - 1];
  const evt = await getJSON('events.json').catch(() => null);
  const covd = await getJSON('coverage_months.json').catch(() => null);
  const valNote = covd && covd.first_complete_month ? `Shown from ${mlabel(covd.first_complete_month)}, the first month every covered fund house is in the data. Earlier months cover fewer funds, so their totals cannot be compared with later ones. Months when a fund house's data is missing are left blank.` : '';
  const shNote = `The stock's weight in the portfolios of the funds in the data that month, so it is not inflated by more funds being added over time. Months with missing data are left blank.`;
  const stockEv = ((evt && evt.events && evt.events[c]) || []).slice(-3).reverse().map(e => `<div class="note" style="margin:10px 0"><b>One-off event, ${mlabel(e.m)}:</b> ${e.new} more schemes opened a position in this stock in the same month (${e.before} holders before, ${e.after} after). That pattern is typical of an IPO, demerger or large share sale (OFS or QIP) rather than gradual buying by fund managers, so read the buying below with care.</div>`).join('');
  const mixedNote = (s.held_now && w3[0] !== w3[1] && (w3[2] > 0) !== (w3[0] > w3[1])) ? `<div class="note" style="margin:12px 0"><b>Mixed signal:</b> funds ${w3[2] > 0 ? 'added' : 'removed'} ${cr(Math.abs(w3[2]))} net over the last 3 months, but ${w3[2] > 0 ? 'more funds cut than added' : 'more funds added than cut'} (${w3[0]} adding, ${w3[1]} cutting). A few funds ${w3[2] > 0 ? 'bought a lot while more funds sold' : 'sold a lot while more funds bought'}, so the money and the number of funds point in different directions.</div>` : '';
  // own-history analogues
  const same = ser.filter(r => r.x12 != null && Math.sign(r.buyers - r.sellers) === bk);
  const med = a => { const x = a.filter(v => v != null).sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : null; };
  const own = same.length >= 4 ? `In ${same.length} earlier months when funds were doing the same thing with this stock, its next 12 months came out a typical (median) <b class="${cls(med(same.map(r => r.x12)))}">${pctn(med(same.map(r => r.x12)) * 100, 1)}</b> vs. the average stock (it beat the average stock in ${Math.round(100 * same.filter(r => r.x12 > 0).length / same.length)}% of those months).` : 'Not enough history for this stock in the same situation to say anything meaningful.';
  main.innerHTML = `<div class="crumbs"><a href="${BASE}/stocks">Stocks</a> › ${esc(s.industry || 'Other')}</div>
  <h1>${esc(s.name)} ${s.held_now ? bucketPill(bk) : '<span class="pill warn">Not currently held by tracked funds</span>'}</h1>
  <p class="lead">${s.held_now ? `Held by ${s.holders} active equity schemes we track, worth ${cr(s.value_cr)} (${mlabel(s.latest_month)}).` : 'Shown for history only.'}</p>
  <div class="acts"><button type="button" class="btn ghost" id="share">Share</button><button type="button" class="btn ghost" id="star" aria-pressed="false">☆ Watch</button><span class="small muted">Watchlist is saved on this device only.</span><span id="acts-msg" class="small" role="status"></span></div>
  ${stockEv}
  <div class="grid g4" style="margin:18px 0">
    <div class="card stat"><div class="v">${cr(s.value_cr)}</div><div class="l">held by funds in total</div></div>
    <div class="card stat"><div class="v ${cls(w3[2])}">${crs(w3[2])}</div><div class="l">net money from funds, last 3 months (a minus means taken out)</div></div>
    <div class="card stat"><div class="v">${w3[0]} / ${w3[1]}</div><div class="l">funds adding / cutting (last 3 months)</div></div>
    <div class="card stat"><div class="v ${cls(s.r12)}">${pct(s.r12)}</div><div class="l">price change, 12 months*</div></div>
  </div>
  ${mixedNote}
  <div class="grid g2">
    <div class="card"><h3>How much funds hold</h3><p class="small muted" style="margin:0 0 6px">${valNote}</p><div id="c1"></div></div>
    <div class="card"><h3>Share of the funds' equity holdings</h3><p class="small muted" style="margin:0 0 6px">${shNote}</p><div id="c1b"></div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Approximate price*</h3><div id="c2"></div></div>
  <div class="card" style="margin-top:16px"><h3>How many funds were buying vs. selling <span class="muted small">(each month, looking at the previous 3 months)</span></h3><div id="c3"></div></div>
  ${s.held_now ? `<div class="card" style="margin-top:16px"><h3>What has usually happened next</h3>
    <p style="margin:.3em 0"><b>Across all stocks:</b> when funds had been ${bk > 0 ? 'buying' : bk < 0 ? 'selling' : 'mostly leaving a stock alone'} over 3 months, as they have with this one, here is how those stocks did compared with the average stock over the next:</p>
    <div class="controls" style="margin:6px 0"><span class="seg" id="s-h"></span></div><div id="base"></div>
    <p style="margin:.8em 0 .3em"><b>This stock's own history:</b> ${own}</p></div>` : ''}
  <div class="grid g2" style="margin-top:16px">
    <div><h2 style="margin-top:0">What funds did in the last 3 months</h2><div id="moves"></div></div>
    <div><h2 style="margin-top:0">Biggest holders now</h2><div id="holders"></div></div>
  </div>
  <p class="small muted" style="margin-top:14px">*Prices are implied from funds' own disclosures (value ÷ shares), adjusted for splits and bonuses where we could detect them; they exclude dividends and are approximate.</p>`;
  const cM = covd ? covd.months : null, byM = Object.fromEntries(ser.map(r => [r.m, r]));
  const stockGapNote = k => { const u = covd && covd.unresolved_by_month && covd.unresolved_by_month[k]; return u && u.length ? `Source disclosure could not be located for ${u.map(esc).join(', ')} this month` : ((cM && cM[k] && cM[k].gap) ? 'A fund house has no data this month' : null); };
  const lastM = cM ? Object.keys(cM).pop() : ser[ser.length - 1].m, allM = [];
  { let y = +ser[0].m.slice(0, 4), mo = +ser[0].m.slice(5, 7); for (;;) { const k = y + '-' + String(mo).padStart(2, '0'); allM.push(k); if (k >= lastM) break; if (++mo > 12) { mo = 1; y++; } } }
  const fc = covd && covd.first_complete_month, okM = fc ? allM.filter(k => k >= fc) : allM;
  lineChart($('#c1'), { labels: okM, series: [{ name: 'Fund-held value', data: okM.map(k => (cM && cM[k] && !cM[k].complete) ? null : (byM[k] ? byM[k].value_cr : 0)), color: 'var(--accent)' }], yFmt: v => v >= 1000 ? nfmt.format(v / 1000) + 'k' : v, tipFmt: v => cr(v), area: true, min0: true, legend: false, gapNote: stockGapNote });
  lineChart($('#c1b'), { labels: allM, series: [{ name: "Share of the funds' equity holdings", data: allM.map(k => (!cM || !cM[k] || cM[k].gap || !cM[k].eq) ? null : (byM[k] ? Math.round(10000 * byM[k].value_cr / cM[k].eq) / 100 : 0)), color: '#7c3aed' }], yFmt: v => v + '%', tipFmt: v => v + '%', min0: true, legend: false, gapNote: stockGapNote });
  lineChart($('#c2'), { labels, series: [{ name: 'Approx. price (₹)', data: ser.map(r => r.price), color: '#7c3aed' }], yFmt: v => nfmt.format(v), tipFmt: v => '₹' + nfmt.format(v) });
  divBars($('#c3'), { labels: allM, up: { name: 'Funds buying', data: allM.map(k => (cM && cM[k] && cM[k].gap) ? 0 : (byM[k] ? byM[k].buyers : 0)), color: 'var(--buy)' }, down: { name: 'Funds selling', data: allM.map(k => (cM && cM[k] && cM[k].gap) ? 0 : (byM[k] ? byM[k].sellers : 0)), color: 'var(--sell)' } });
  if (s.held_now) { const seg = $('#s-h'); let h = '12'; const dr = () => { seg.innerHTML = ['3', '6', '12', '24'].map(k => `<button data-v="${k}" class="${k === h ? 'on' : ''}">${H_LABEL[k]}</button>`).join(''); $$('button', seg).forEach(b => b.onclick = () => { h = b.dataset.v; dr(); }); $('#base').innerHTML = bucketCard(ev, 'breadth', String(bk), h); }; dr(); }
  table($('#moves'), [{ label: 'Fund', html: r => esc(r[0]) + `<span class="sub">${esc(r[1])}</span>` }, { label: 'Action', html: r => `<span class="pill ${r[3] === 'added' || r[3] === 'new' ? 'buy' : 'sell'}">${r[3]}</span>` }, { label: 'Amount', cls: 'r', get: r => r[2], html: r => `<span class="${cls(r[2])}">${crs(r[2])}</span>` }], s.moves3, { sort: 2, limit: 10 });
  table($('#holders'), [{ label: 'Fund', html: r => esc(r[0]) + `<span class="sub">${esc(r[1])}</span>` }, { label: 'Held', cls: 'r', get: r => r[2], html: r => cr(r[2]) }, { label: '% of equity', tip: 'Share of that scheme equity holdings (cash and debt are excluded), so it can read higher than the fund own "% of NAV".', cls: 'r', get: r => r[3], html: r => r[3] + '%' }, { label: 'Change (3 months)', cls: 'r', get: r => r[4], html: r => `<span class="${cls(r[4])}">${crs(r[4])}</span>` }], s.holders_now, { sort: 1, limit: 10 });
  wireActions('stock', c, s.name, () => { const flow = w3[2], mixed = w3[0] !== w3[1] && (flow > 0) !== (w3[0] > w3[1]); return `${s.name}: funds ${flow >= 0 ? 'added' : 'removed'} ${cr(Math.abs(flow))} net in 3 months (${w3[0]} funds adding, ${w3[1]} cutting${mixed ? ', so money and fund count disagree' : ''}).\n${location.origin}/stock?c=${encodeURIComponent(c)}`; });
  chatCtx({ type: 'stock', id: c, name: s.name }, [`Explain what's going on with ${s.name} in plain words`, `Which funds are selling ${s.name}?`, 'Does this pattern usually matter?', 'What should I be cautious about here?']);
};

pages.houses = async main => {
  main.innerHTML = '<h1>Funds &amp; fund houses</h1><p class="lead">The <span id="hcount">fund houses</span> we cover, and every active equity scheme within them. History includes schemes that later closed or merged, for the months they reported; company shares only (no REIT or InvIT units, bonds or preference shares).</p><div id="hs"></div><h2>All schemes</h2><div class="controls"><input type="search" id="q" placeholder="Filter schemes…" style="min-width:240px"><select id="hf"><option value="">All houses</option></select></div><div id="tb"></div>';
  const [hs, fl] = await Promise.all([getJSON('houses.json'), getJSON('funds.json')]);
  $('#hcount').textContent = `${hs.length} fund houses`;
  $('#hs').innerHTML = `<div class="grid g3">${hs.map(h => `<a class="card" href="${BASE}/house?h=${h.id}" style="color:inherit;text-decoration:none;display:block"><h3>${esc(h.name)} ${h.boutique ? '<span class="pill">specialist</span>' : ''}</h3><div class="stat"><span class="v">${cr(h.equity_cr)}</span> <span class="l">in active equity</span></div><p class="small muted" style="margin:.4em 0 0">${h.schemes_active} active schemes · data since ${mlabel(h.first_month)}<br>Top: ${h.top.slice(0, 3).map(t => esc(t[1])).join(', ')}</p></a>`).join('')}</div>`;
  $('#hf').innerHTML += hs.map(h => `<option value="${h.name}">${esc(h.name)}</option>`).join('');
  const rows = fl.r;
  const cols = [{ label: 'Scheme', get: r => r[1], asc: true, html: r => `<a href="${BASE}/fund?id=${r[0]}">${esc(r[1])}</a><span class="sub">${esc(r[4] || '')}</span>` }, { label: 'House', get: r => r[2], asc: true, html: r => esc(r[2]) }, { label: 'Equity holdings', cls: 'r', get: r => r[5], html: r => cr(r[5]) }, { label: 'Stocks held', cls: 'r', get: r => r[6], html: r => r[6] }];
  const T = table($('#tb'), cols, rows, { sort: 2, limit: 30 });
  const f = () => { const q = $('#q').value.toLowerCase(), h = $('#hf').value; T.set(rows.filter(r => (!q || r[1].toLowerCase().includes(q)) && (!h || r[2] === h))); };
  $('#q').oninput = f; $('#hf').onchange = f;
  chatCtx({ type: 'houses' }, ['Which fund house has the most in equities?', 'How are boutique funds different from big ones?', 'Which house is selling the most?']);
};

pages.house = async main => {
  const id = qs('h'); const hs = await getJSON('houses.json'); const h = hs.find(x => x.id === id);
  if (!h) { main.innerHTML = `<p>House not found. <a href="${BASE}/houses">Back</a></p>`; return; }
  main.innerHTML = `<div class="crumbs"><a href="${BASE}/houses">Funds &amp; houses</a></div><h1>${esc(h.name)}</h1><p class="lead">${cr(h.equity_cr)} in active equity across ${h.schemes_active} schemes. Data from ${mlabel(h.first_month)}.</p>
  <div class="grid g3"><div class="card"><h3>Largest holdings</h3>${h.top.map(t => `<div style="display:flex;justify-content:space-between;gap:8px;margin:5px 0">${stockLink(t[0], t[1])}<span class="muted">${cr(t[2])}</span></div>`).join('')}</div>
  <div class="card"><h3>Biggest buys — last 3 months</h3>${h.buys3.map(t => `<div style="display:flex;justify-content:space-between;gap:8px;margin:5px 0">${stockLink(t[0], t[1])}<span class="pos">${crs(t[2])}</span></div>`).join('')}</div>
  <div class="card"><h3>Biggest sells — last 3 months</h3>${h.sells3.map(t => `<div style="display:flex;justify-content:space-between;gap:8px;margin:5px 0">${stockLink(t[0], t[1])}<span class="neg">${crs(t[2])}</span></div>`).join('')}</div></div>
  <h2>Schemes</h2><div id="tb"></div>`;
  table($('#tb'), [{ label: 'Scheme', get: r => r[1], asc: true, html: r => `<a href="${BASE}/fund?id=${r[0]}">${esc(r[1])}</a>` }, { label: 'Equity holdings', cls: 'r', get: r => r[2], html: r => cr(r[2]) }], h.schemes, { sort: 1, limit: 40 });
  chatCtx({ type: 'house', id, name: h.name }, [`What is ${h.name} buying and selling lately?`, `How concentrated is ${h.name}?`]);
};

pages.fund = async main => {
  const id = qs('id'); let f; try { f = await getJSON('fund/' + encodeURIComponent(id) + '.json'); } catch (e) { main.innerHTML = `<p>Fund not found. <a href="${BASE}/houses">Back</a></p>`; return; }
  const ser = f.series.map(r => Object.fromEntries(f.sh.map((k, i) => [k, r[i]]))), labels = ser.map(r => r.m);
  const covg = await getJSON('coverage.json').catch(() => null), byMf = Object.fromEntries(ser.map(r => [r.m, r]));
  const missF = k => !!(covg && covg.missing_by_month && (covg.missing_by_month[k] || []).includes(f.house));
  const unresF = k => !!(covg && covg.unresolved_by_month && (covg.unresolved_by_month[k] || []).includes(f.house));
  const fullM = []; { let y = +ser[0].m.slice(0, 4), mo = +ser[0].m.slice(5, 7); const last = ser[ser.length - 1].m; for (;;) { const k = y + '-' + String(mo).padStart(2, '0'); fullM.push(k); if (k >= last) break; if (++mo > 12) { mo = 1; y++; } } }
  const unresMonths = fullM.filter(unresF);
  const unresNote = unresMonths.length ? `<div class="note" style="margin:0 0 16px"><b>Gap explained.</b> For ${unresMonths.map(mlabel).join(', ')}, we searched ${esc(f.house)}'s own site, web archives and industry sources and could not find this month's disclosure anywhere — the chart is left blank there rather than guessed at, and this gap is unlikely to fill in later.</div>` : '';
  main.innerHTML = `<div class="crumbs"><a href="${BASE}/houses">Funds &amp; houses</a> › <a href="${BASE}/house?h=${f.house_id}">${esc(f.house)}</a></div><h1>${esc(f.name)}</h1>
  <p class="lead">${esc(f.category || 'Equity scheme')} · ${cr(f.equity_cr)} in equities across ${f.n_holdings} stocks (${mlabel(f.month)}).</p>
  <div class="acts"><button type="button" class="btn ghost" id="star" aria-pressed="false">☆ Watch</button><span class="small muted">Watchlist is saved on this device only.</span><span id="acts-msg" class="small" role="status"></span></div>
  ${f.r36 != null ? `<div class="note"><b>Past performance ≠ future performance.</b> Over 3 years this fund's return was ${pct(f.r36)} vs. its category's median (${f.nav_rank_pct != null ? 'better than ' + Math.round(f.nav_rank_pct * 100) + '% of the covered peers over 3 years' : 'peer ranking not available'}). In our data, a strong 3-year record did not predict a strong next year.</div>` : ''}
  ${unresNote}
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Equity holdings</h3><div id="c1"></div></div><div class="card"><h3>How concentrated <span class="muted small">(share of its equity holdings in its 10 biggest stocks)</span></h3><div id="c2"></div></div></div>
  <div class="grid g3" style="margin-top:16px">
   <div><h2 style="margin-top:0">Top holdings</h2><div id="top"></div></div>
   <div><h2 style="margin-top:0">Added — last 3 months</h2><div id="adds"></div></div>
   <div><h2 style="margin-top:0">Trimmed — last 3 months</h2><div id="trims"></div></div></div>
  ${f.top.some(t => t[2] > 10) ? `<p class="small muted" style="margin-top:14px">Some holdings above show more than 10%. SEBI limits a scheme to putting at most 10% of its assets into one company when it buys, but a holding can drift above that as its price rises, which is allowed. The percentages here are shares of the scheme's equity holdings (cash and debt excluded) and use prices worked out from the fund's own disclosures, so they can differ a little from the fund's reported "% of NAV".</p>` : ''}`;
  const gapNote = k => unresF(k) ? `Source disclosure could not be located for ${esc(f.house)} this month` : (missF(k) ? `No data this month from ${esc(f.house)}` : null);
  lineChart($('#c1'), { labels: fullM, series: [{ name: 'Equity holdings', data: fullM.map(k => (!byMf[k] || missF(k)) ? null : byMf[k].equity_cr), color: 'var(--accent)' }], yFmt: v => v >= 1000 ? nfmt.format(v / 1000) + 'k' : v, tipFmt: v => cr(v), area: true, min0: true, gapNote });
  lineChart($('#c2'), { labels: fullM, series: [{ name: 'Top-10 share', data: fullM.map(k => (!byMf[k] || missF(k)) ? null : byMf[k].top10_pct), color: '#7c3aed' }], yFmt: v => v + '%', tipFmt: v => v + '%', min0: true, gapNote });
  table($('#top'), [{ label: 'Stock', html: r => stockLink(r[0], r[1]) }, { label: '% of equity', tip: 'Share of the scheme equity holdings (cash and debt are excluded), so it can read higher than the fund own "% of NAV".', cls: 'r', get: r => r[2], html: r => r[2] + '%' }], f.top, { sort: 1, limit: 15 });
  table($('#adds'), [{ label: 'Stock', html: r => stockLink(r[0], r[1]) }, { label: 'Amount', cls: 'r', get: r => r[2], html: r => `<span class="pos">${crs(r[2])}</span>` }], f.adds3, { sort: 1, limit: 10 });
  table($('#trims'), [{ label: 'Stock', html: r => stockLink(r[0], r[1]) }, { label: 'Amount', cls: 'r', get: r => r[2], asc: true, html: r => `<span class="neg">${crs(r[2])}</span>` }], f.trims3, { sort: 1, dir: 1, limit: 10 });
  wireActions('fund', id, f.name, null);
  chatCtx({ type: 'fund', id, name: f.name }, [`What has ${f.name} been buying?`, `Is ${f.name} concentrated?`, 'Should past returns influence my choice of fund?']);
};

pages.evidence = async main => {
  const ev = await getJSON('evidence.json'); const cov = ev.coverage; const S3 = ev.strength.L['3'], lo3 = Math.round(ev.strength.cuts.breadth[0] * S3.n_schemes), hi3 = Math.round(ev.strength.cuts.breadth[1] * S3.n_schemes);
  const SIG = { breadth: 'All actively managed funds', breadth_bout: 'Smaller specialist fund houses only (PPFAS, quant, Motilal Oswal)', breadth_nav: 'Funds with the best 3-year records', breadth_trade: 'Funds whose earlier stock picks did well' };
  main.innerHTML = `<h1 style="margin-bottom:4px">The evidence</h1><p class="lead" style="margin:.2em 0 .6em">Does it pay to follow what mutual funds buy and sell? We tested monthly data from ${cov.months_span.split(' to ').map(mlabel).join(' to ')} for ${cov.houses.length} fund houses.</p>
  <p class="small muted" style="margin:0 0 10px">Underlying data: monthly portfolio disclosures published by each fund house, collected via the AMFI directory. Full source and processing notes: <a href="${BASE}/about">the About page</a>.</p>
  <div class="grid g4 sum"><div class="card"><h3>Buying isn't a tip-off</h3><p>Funds buying a stock was not a reliable sign it would do well, even for the best-regarded funds.</p></div><div class="card"><h3>Crowded trades disappointed</h3><p>When lots of funds sold the same stock, or piled into it over many months, it tended to lag afterwards.</p></div><div class="card"><h3>Track records didn't repeat</h3><p>Funds with the best 3-year record weren't dependably the best the year after.</p></div><div class="card"><h3>Momentum did work</h3><p>Stocks that had already been rising tended to keep beating the average.</p></div></div>
  <details class="howd"><summary>How to read the numbers (30 seconds)</summary><ul class="small" style="margin:.4em 0 0;padding-left:1.2em"><li><b>Everything is compared with "the average stock".</b> That is the simple average return of all the stocks these funds hold (about ${ev.strength.universe} in a typical month, each counted equally) over the same period. 0% means a stock did just as well as that average, +3% means it beat it by 3 percentage points, and −3% means it lagged by 3. Example: if the average stock rose 15% over the next year, a stock scoring −4% rose about 11%. These are <i>not</i> profit figures.</li><li><b>"Could be luck" vs. "Unlikely to be luck".</b> Markets are noisy, so small differences often appear by chance. We tag every result: <span class="pill">Could be luck</span> means don't rely on it; <span class="pill real">Unlikely to be luck</span> means the pattern was strong and steady enough to take seriously (still no guarantee). For the statistically minded, this is the t-statistic, roughly |t| of 2 or more. Hover a tag to see it.</li><li><b>One "case" = one stock in one month.</b> That is how we count sample sizes.</li></ul></details>
  <h2 style="margin-top:16px">1. What happened after funds bought or sold a stock</h2>
  <p class="muted small" style="margin:.2em 0 .6em">Every month, for each stock we asked: over the previous 3 months, were funds mostly <b>buying</b> it, mostly <b>selling</b> it, or leaving it <b>alone</b>? Then we tracked how it did afterwards compared with the average stock, counting only from after the funds' holdings became public, so there is no hindsight. This first view lumps every strength together; section 2 separates them.</p>
  <div class="controls"><span><span class="lab">Whose activity?</span><select id="sig">${Object.entries(SIG).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></span><span><span class="lab">Then look at the next</span><span class="seg" id="s-h"></span></span></div>
  <div class="card"><div class="split"><div id="bk"></div><div><div class="plain" id="bkv" style="margin-top:0"></div><div id="bkn" class="small muted" style="margin-top:8px"></div></div></div></div>
  <h2>2. Does the size of the bet matter?</h2>
  <div class="card"><p class="muted" style="margin-top:0">A stock one fund nudged is not the same as one dozens of funds piled into. So each month we sorted the stocks funds were <b>buying</b> (and, separately, the ones they were <b>selling</b>) into <b>light, medium and heavy</b> using fixed rules, then checked whether the strength mattered. <b>By how many funds agree:</b> light = fewer than ${lo3} more funds buying than selling (or the reverse for selling), medium = ${lo3} to ${hi3 - 1}, heavy = ${hi3} or more, out of about ${S3.n_schemes} schemes. <b>By how much money moved:</b> light = under 5% of what funds already held, medium = 5% to 20%, heavy = 20% or more.</p>
  <div class="controls"><span><span class="lab">Funds' activity over the previous</span><select id="strl"><option value="1">1 month</option><option value="3" selected>3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></span><span><span class="lab">Measure strength by</span><select id="strm"><option value="breadth">How many funds agree</option><option value="intensity">How much money moved</option></select></span><span><span class="lab">Then look at the next</span><span class="seg" id="s-h3"></span></span></div>
  <div class="grid g2"><div><h3>Stocks funds were buying</h3><div id="stb"></div><div id="stbt"></div></div><div><h3>Stocks funds were selling</h3><div id="sts"></div><div id="stst"></div></div></div>
  <div id="stn"></div></div>
  <h2>3. Do the best fund managers stay the best?</h2>
  <div class="card" id="pers"></div>
  <h2>4. What did work: stocks that were already rising</h2>
  <div class="card"><p class="muted" style="margin-top:0">Each month we sorted stocks into five equal groups by how much their price had risen over the previous 6 months, from fallen-the-most to risen-the-most. Then we tracked the next period, compared with the average stock. (This pattern is called "momentum".)</p><div class="controls"><span><span class="lab">Then look at the next</span><span class="seg" id="s-h2"></span></span></div><div id="mom"></div></div>
  <h2>5. A fairer test: does fund buying add anything?</h2>
  <div class="card"><p class="muted" style="margin-top:0">Stocks that are already rising also tend to attract fund buying, which can muddy the picture. So we ran a fairer test that separates each clue from the others and asks: <i>once the other clues are accounted for, does this one still help predict the next 12 months?</i> The number is the extra 12-month return linked to a stock scoring noticeably higher on that clue.</p><div id="fm"></div></div>
  <h2>6. Does it depend on the era?</h2>
  <div class="card" id="per"></div>
  <h2>Limits of this analysis</h2>
  <div class="card"><ul style="margin:0;padding-left:1.2em"><li><b>Not every fund house:</b> we cover ${cov.houses.length} of 54. Results could differ for the others.</li><li><b>Prices are approximations.</b> We work them out from the funds' own disclosures (value ÷ shares), correct for splits and bonuses where we could detect them, and leave out dividends. About 1 in 5 stock-months lacks a 12-month result (mostly because funds fully exited).</li><li><b>Many things were tested.</b> When you test dozens of combinations, some will look impressive by pure chance. Trust patterns that repeat across periods more than any single result.</li><li><b>Costs and taxes are not included;</b> real-world results would be lower.</li><li><b>One-off events are included.</b> IPO, demerger and share-sale allotments (about 0.5% of stock-months) look like sudden buying. They are tagged on the moves page but not removed from these tests.</li><li><b>Corporate actions.</b> Prices are adjusted for bonuses and splits using the funds' own share counts. We audited this in September 2026 and fixed 49 missed adjustments; the research results moved by about 0.1 to 0.2 points and the conclusions did not change.</li><li>Past patterns are not promises. This is education, not advice.</li></ul></div>`;
  const st = { sig: 'breadth', h: '12', h2: '12', h3: '12', m: 'breadth', L: '3' };
  const seg = (id, key, ex) => { const el = $(id); el.innerHTML = ['3', '6', '12', '24'].map(k => `<button data-v="${k}" class="${st[key] === k ? 'on' : ''}">${H_LABEL[k]}</button>`).join(''); $$('button', el).forEach(b => b.onclick = () => { st[key] = b.dataset.v; ex(); }); };
  function drawBk() {
    seg('#s-h', 'h', drawBk); const d = ev.buckets[st.sig][st.h];
    const nm = { '-1': 'funds were selling', '0': 'funds barely touched', '1': 'funds were buying' };
    const line = k => { const r = d[k]; return r ? `<li>Stocks ${nm[k]}: <b class="${cls(r.mean)}">${vsAvg(r.mean)}</b> than the average stock (${isReal(r.t) ? 'unlikely to be luck' : 'could be luck'}).</li>` : ''; };
    const buyGood = d['1'] && isReal(d['1'].t) && d['1'].mean > 0;
    $('#bkv').innerHTML = `<b>In plain words</b>, over the next ${H_LABEL[st.h]}:<ul style="margin:.3em 0 .3em;padding-left:1.2em">${['-1', '0', '1'].map(line).join('')}</ul><b>Bottom line:</b> ${buyGood ? 'here, stocks funds were buying did better than average, and the gap was strong enough to take seriously.' : 'funds buying a stock did not give a reliable head start.'}`;
    hbars($('#bk'), [{ label: 'Funds were selling', val: d['-1']?.mean, color: 'var(--sell)', note: luckTxt(d['-1']?.t) }, { label: 'Funds left it alone', val: d['0']?.mean, color: 'var(--flat)', note: luckTxt(d['0']?.t) }, { label: 'Funds were buying', val: d['1']?.mean, color: 'var(--buy)', note: luckTxt(d['1']?.t) }]);
    $('#bkn').innerHTML = `How to read the bars: each one is the average result compared with the average stock (the simple average of all ~${ev.strength.universe} stocks these funds hold) over the next ${H_LABEL[st.h]}. A bar to the left of the middle line means the stocks did worse than average; to the right, better. Based on ${['-1', '0', '1'].map(k => nfmt.format(d[k]?.n || 0)).join(' / ')} cases (selling / left alone / buying).`;
  }
  $('#sig').onchange = e => { st.sig = e.target.value; drawBk(); }; drawBk();
  function drawStr() {
    seg('#s-h3', 'h3', drawStr);
    [['buy', '#stb', '#stbt'], ['sell', '#sts', '#stst']].forEach(([side, a, b]) => { const t = tierBlock(ev, st.m, side, st.h3, st.L); if (!t) { $(a).innerHTML = '<p class="muted small">Not enough history.</p>'; $(b).innerHTML = ''; return; } hbars($(a), t.items); $(b).innerHTML = '<p class="plain">' + t.summary + '</p><details><summary class="small">How this is worked out</summary>' + t.details + '</details>'; });
    const S = ev.strength, c = S.controls, e = S.eras;
    const say = side => { const r = S.L[st.L].measures[st.m][side][st.h3], verb = side === 'buy' ? 'buying' : 'selling'; return r ? (isReal(r.t) ? `for ${verb}, the stronger it was, the ${r.spread < 0 ? 'worse' : 'better'} the stock did afterwards, and ${Math.abs(r.t) >= 2.5 ? 'the difference is unlikely to be luck' : 'the difference only just clears our bar for "not luck", so treat it as a hint, not a finding'}` : `for ${verb}, strength did not make a dependable difference (could be luck)`) : ''; };
    $('#stn').innerHTML = `<p class="plain"><b>In plain words:</b> ${say('buy')}; ${say('sell')}.${st.m === 'intensity' ? ' Measured by money moved, the picture is much less clear than measured by how many funds agree.' : ''}</p><p class="small muted"><b>Is this just momentum or company size?</b> We checked at 12 months, using the 3-month look-back. After accounting for both, more selling still went with lower returns (${pctn(c.sell_strength.coef, 2)} for each step up in strength; ${luckTxt(c.sell_strength.t).toLowerCase()}), while more buying went with ${pctn(c.buy_strength.coef, 2)} (${luckTxt(c.buy_strength.t).toLowerCase()}). Heavy selling lagged in both eras (2013-2019: ${pctn(e['2013-2019'].sell[2].mean, 1)}; 2020-2026: ${pctn(e['2020-2026'].sell[2].mean, 1)}), and heavy buying was negative in both too (${pctn(e['2013-2019'].buy[2].mean, 1)}; ${pctn(e['2020-2026'].buy[2].mean, 1)}). A pattern that repeats in both periods deserves more weight than a one-off, but we tried many combinations, so treat it as a warning sign, not a rule.</p>`;
  }
  $('#strm').onchange = e => { st.m = e.target.value; drawStr(); }; $('#strl').onchange = e => { st.L = e.target.value; drawStr(); }; drawStr();
  const p = ev.persistence;
  $('#pers').innerHTML = `<p style="margin-top:0">Each month we ranked ${p.funds} funds by how well they had done over the previous 3 years compared with similar funds, and split them into the best third, the middle third and the worst third. Then we watched how each group did over the <i>next</i> 12 months, again compared with similar funds. If skill carried over, the best third should clearly come out on top.</p>` + `<div id="pb"></div><p class="plain"><b>In plain words:</b> a year later, the best-record funds were ${pctn(p.top, 1)} vs. their peers and the worst-record funds ${pctn(p.bottom, 1)}. The best third finished ${p.top_minus_bottom >= 0 ? 'ahead of' : 'behind'} the worst third by ${Math.abs(p.top_minus_bottom).toFixed(2)}% a year, and came out ahead in only ${p.pos_months}% of months (${luckTxt(p.t).toLowerCase()}). <b>So a great 3-year record was not a dependable sign of a great next year.</b></p>`;
  hbars($('#pb'), [{ label: 'Best third (past record)', val: p.top, color: 'var(--accent)' }, { label: 'Middle third', val: p.mid, color: 'var(--flat)' }, { label: 'Worst third (past record)', val: p.bottom, color: 'var(--warn)' }]);
  function drawMom() { seg('#s-h2', 'h2', drawMom); const m = ev.mom[st.h2]; hbars($('#mom'), m.q.map((v, i) => ({ label: ['Fallen most (bottom 20%)', '', 'Middle', '', 'Risen most (top 20%)'][i] || '', val: v, color: v >= 0 ? 'var(--buy)' : 'var(--sell)' }))); $('#mom').insertAdjacentHTML('beforeend', `<p class="plain"><b>In plain words:</b> over the next ${H_LABEL[st.h2]}, the stocks that had risen the most ${m.spread >= 0 ? 'beat' : 'trailed'} the ones that had fallen the most by <b>${Math.abs(m.spread).toFixed(1)}%</b> (${luckTxt(m.t).toLowerCase()}). ${isReal(m.t) ? '' : ' Over this horizon on its own the gap is not clear-cut; it is clearer over shorter horizons and in the combined test in section 5.'} It is a well-documented pattern around the world, but not a guarantee.</p>`); }
  drawMom();
  const fm = ev.fm['12']; const NM = { breadth_nav: 'Buying by best-record funds', breadth_trade: 'Buying by funds whose earlier picks did well', breadth_bout: 'Buying by specialist fund houses', breadth: 'Buying by all funds', mom6: 'Price rise over the past 6 months (momentum)', size: 'Size (bigger fund holdings)' };
  $('#fm').innerHTML = `<div class="tw"><table><thead><tr><th>Clue</th><th class="r">Extra 12-month return</th><th>Verdict</th></tr></thead><tbody>${Object.entries(NM).map(([k, n]) => { const r = fm[k]; const sig = isReal(r.t); return `<tr><td>${n}</td><td class="r ${cls(r.coef)}">${pctn(r.coef, 2)}</td><td><span class="pill${sig ? ' real' : ''}" title="Statistical strength: t = ${r.t}">${sig ? (r.coef > 0 ? 'Real: helps' : 'Real: hurts') : 'Could be luck'}</span></td></tr>`; }).join('')}</tbody></table></div><p class="small muted">"Could be luck" means we can't tell this clue apart from random noise, so it should not be relied on.</p>`;
  const per = ev.periods;
  $('#per').innerHTML = `<p style="margin-top:0">Smaller specialist houses' <b>selling</b> looked like a warning sign, but only in recent years:</p><div class="grid g2">${['2013-2019', '2020-2026'].map(k => `<div><h3>${k}</h3><div id="pp${k}"></div></div>`).join('')}</div><p class="small muted">Average 12-month result vs. the average stock, split by what these houses were doing. A pattern that shows up in only one era is a lead to watch, not a rule.</p>`;
  ['2013-2019', '2020-2026'].forEach(k => { const d = per[k].breadth_bout['12']; hbars($('#pp' + k), [{ label: 'Selling', val: d['-1']?.mean, color: 'var(--sell)', note: luckTxt(d['-1']?.t) }, { label: 'Left alone', val: d['0']?.mean, color: 'var(--flat)', note: luckTxt(d['0']?.t) }, { label: 'Buying', val: d['1']?.mean, color: 'var(--buy)', note: luckTxt(d['1']?.t) }]); });
  chatCtx({ type: 'evidence' }, ['Explain the main finding like I\'m new to investing', 'What does "could be luck" mean here?', 'If buying doesn\'t predict returns, why look at this data at all?', 'What would change your mind about these results?']);
};

pages.about = async main => {
  const meta = await getJSON('meta.json'); const ev = await getJSON('evidence.json');
  main.innerHTML = `<h1>About this project</h1>
  <p class="lead">Mutual Fund Flows is an educational research project to understand what mutual funds' stock buying and selling can — and can't — tell us.</p>
  <div class="grid g2"><div class="card"><h3>Where the data comes from</h3><p>Every mutual fund in India must publish its full stock holdings each month. We collected those disclosures directly from each fund house's own website (via <a href="https://www.amfiindia.com/otherdata/scheme-wise-disclosure" target="_blank" rel="noopener">the directory maintained by AMFI</a>, the industry body) — for example, <a href="https://www.sbimf.com/portfolios" target="_blank" rel="noopener">SBI Mutual Fund</a>, <a href="https://www.hdfcfund.com/statutory-disclosure/portfolio/monthly-portfolio" target="_blank" rel="noopener">HDFC Mutual Fund</a> and <a href="https://amc.ppfas.com/downloads/portfolio-disclosure/" target="_blank" rel="noopener">PPFAS Mutual Fund</a> each publish theirs this way — going back to ${Math.min(...ev.coverage.houses.map(h => +h.from.slice(0, 4)))} where available. We cover:</p><ul>${ev.coverage.houses.map(h => `<li>${esc(h.name)}${h.boutique ? ' <span class="pill">specialist</span>' : ''} <span class="muted small">(from ${mlabel(h.from)})</span></li>`).join('')}</ul><p class="small muted">That's ${ev.coverage.houses.length} of 54 fund houses — not yet ICICI Prudential, Kotak, UTI and others. Others could not be collected automatically (some block automated access; some publish in ways we haven't decoded yet).</p></div>
  <div class="card"><h3>How we work things out</h3><ul><li><b>Buying and selling:</b> we compare how many shares a fund holds now with before. When a fund simply grows because new investor money (SIPs) arrives, it buys a bit of everything, so we remove that and look only at real decisions. A fund counts as "buying" a stock if it raised its stake by 10% or more (or opened a new one) by a meaningful amount for its size. "Selling" is the reverse.</li><li><b>Prices:</b> we don't have a stock-exchange price feed. Instead we work out each stock's price from the funds' own numbers (value ÷ shares held) and correct for splits and bonuses. They leave out dividends, so treat them as close approximations.</li><li><b>"Compared with the average stock":</b> a stock's return minus the average return of all the stocks the funds hold over the same period. So 0% means "kept pace", not "no gain". We always start counting after the holdings became public, never before.</li><li><b>Which funds:</b> only actively managed equity funds. Index funds, ETFs and arbitrage funds are left out because their trades are automatic, not decisions.</li></ul></div></div>
  <h2>What is and is not included</h2>
  <div class="card"><ul style="margin:0;padding-left:1.2em">
    <li><b>Company shares only.</b> REIT and InvIT units, preference shares, bonds, commercial paper and similar holdings are left out on purpose.</li>
    <li><b>Active equity schemes only.</b> Index funds, ETFs, arbitrage funds and debt funds are left out. We follow ${ev.coverage.active_schemes} schemes in total across the history; ${meta.schemes} of them were still reporting in ${mlabel(meta.month)}. The rest closed, merged or stopped reporting along the way, and are included for the months they appear in the files we collected.</li>
    <li><b>${meta.houses.length} fund houses out of 54.</b> Anything the other ${54 - meta.houses.length} did is not in these numbers. So a total here is what these ${meta.houses.length} houses did, not what all mutual funds did.</li>
    <li><b>Some months are missing</b> for some fund houses (see "Incomplete data" notes on the pages). Where a house's file is missing, the totals shown may differ from the true totals, and charts leave that month blank.</li>
  </ul></div>
  <h2>How to use this responsibly</h2>
  <div class="callout"><ul style="margin:0;padding-left:1.2em"><li>This is for <b>research and education</b>. Nothing here is investment advice or a recommendation to buy or sell anything.</li><li>The honest finding is that fund flows are a weak guide. Don't build a concentrated portfolio on them.</li><li>If a stock's page shows something interesting, treat it as a <i>question to investigate</i> (look at the company, its valuation, your own goals), not an answer.</li><li>Check with a SEBI-registered advisor for anything personal.</li></ul></div>
  <h2>The chat assistant</h2>
  <div class="card"><p style="margin:0">The chat window on every page is an AI assistant that can look things up in the data on this site and explain them. It is instructed to be honest about uncertainty and not to give personalised advice. It can be wrong — check important numbers against the pages here.</p></div>
  <h2>How the numbers are checked</h2>
  <div class="card" id="dq"><p style="margin:0">Loading the data checks…</p></div>
  <h2>Plain-English glossary</h2>
  <div class="card"><dl style="margin:0">
    <dt><b>Scheme (or fund)</b></dt><dd style="margin:0 0 8px">One mutual fund product, for example a "Flexi Cap Fund". A fund house runs many schemes.</dd>
    <dt><b>Total held by funds</b></dt><dd style="margin:0 0 8px">The market value of a stock held across all the active equity schemes we track.</dd>
    <dt><b>Money added (net flow)</b></dt><dd style="margin:0 0 8px">Money funds put into a stock minus money they took out over the period, in ₹ crore (1 crore = 10 million). Positive means net buying; negative means net selling.</dd>
    <dt><b>SIP</b></dt><dd style="margin:0 0 8px">A monthly automatic investment plan. New SIP money makes funds buy a little of everything, so we strip that out to see real decisions.</dd>
    <dt><b>The average stock</b></dt><dd style="margin:0 0 8px">The simple average return of all the stocks these funds hold (about ${ev.strength.universe} in a typical month, each counted equally) over the same period. We measure results against it, so 0% means "kept pace", +3% means 3 percentage points better, and −3% means 3 points worse. If the average stock rose 15%, a stock that scored −4% rose about 11%.</dd>
    <dt><b>Could be luck / Unlikely to be luck</b></dt><dd style="margin:0 0 8px">Our plain-language tag for how trustworthy a result is. Small gaps often happen by chance; "unlikely to be luck" means the pattern was strong and steady. (Technically this is the t-statistic: roughly 2 or more is "unlikely to be luck".)</dd>
    <dt><b>Light, medium and heavy buying or selling</b></dt><dd style="margin:0 0 8px">Fixed rules, not judgement calls. By how many funds agree: light means fewer than 1% of all funds (about ${Math.max(1, Math.round(meta.schemes * 0.01))} of ${meta.schemes} schemes) more buying than selling a stock, medium is 1% to 2.5%, and heavy is 2.5% or more (about ${Math.max(1, Math.round(meta.schemes * 0.025))} or more funds). The same rule applies to selling. By money moved: under 5% of what funds already held is light, 5% to 20% medium, and 20% or more heavy.</dd>
    <dt><b>Case</b></dt><dd style="margin:0 0 8px">One stock in one month. We count sample sizes in cases.</dd>
    <dt><b>Median or "middle" stock</b></dt><dd style="margin:0 0 8px">Line up all the results from worst to best: the middle one is the median. Half did better, half did worse.</dd>
    <dt><b>Momentum</b></dt><dd style="margin:0 0 8px">The tendency for stocks that have been rising to keep rising for a while.</dd>
    <dt><b>Trading intensity (churn)</b></dt><dd style="margin:0 0 8px">How much funds traded a stock (buying plus selling) compared with what they hold. High means lots of activity in both directions.</dd>
    <dt><b>Specialist fund houses</b></dt><dd style="margin:0">Smaller houses with a focused style, such as PPFAS, quant and Motilal Oswal.</dd>
  </dl></div>
  <p class="small muted">Data built ${esc(meta.built)}. Latest disclosure month: ${mlabel(meta.month)}.</p>`;
  getJSON('data_quality.json').then(q => {
    const n = v => nfmt.format(v);
    $('#dq').innerHTML = `<p style="margin-top:0">A stock has one closing price a month, so a fund's reported holding value can be compared with what other schemes report for the same stock and month. For each holding we compare its implied price (value divided by shares) with the middle (median) price across all schemes that reported that stock that month. That pool includes other schemes of the same fund house, so this is a consistency check, not a fully independent one. It can be run only where at least five schemes report the stock: ${n(q.verifiable_rows)} of ${n(q.rows_out)} rows (${q.verifiable_pct_of_rows}%). The rest could not be tested.</p><ul><li>Of the rows that could be tested, <b>${q.agree_within_1pct}%</b> agree within 1% of the pooled median price, <b>${q.agree_within_2pct}%</b> within 2% and <b>${q.agree_within_5pct}%</b> within 5%.</li><li><b>Removed, because they are not company shares:</b> ${n(q.r1_removed_rows)} rows (${q.r1_value_share_pct}% of value): preference shares, bonds and commercial paper, REIT and InvIT units, and placeholder codes.</li><li><b>Removed, because their prices disagreed with the pooled median (typical deviation above 2%):</b> ${q.r2_removed_scheme_months} scheme-months out of ${n(q.scheme_months_checked)} tested (${n(q.r2_removed_rows)} rows), such as DSP's January 2016 file. In every scheme-month that was kept, the typical deviation is under 1.5%.</li><li><b>Kept, and shown as reported:</b> ${n(q.rows_valued_over_10pct_differently)} individual holdings that some funds valued more than 10% differently, typically thinly traded or newly listed stocks. Buying and selling are measured from changes in share counts, not from these reported values.</li></ul><p class="small muted" style="margin-bottom:0">Months where a fund house's file is missing are marked on every page and left blank in charts. A check cannot prove every number is right; it finds numbers that disagree with what other schemes report.</p>`;
  }).catch(() => { $('#dq').innerHTML = '<p style="margin:0">The data-check summary could not be loaded.</p>'; });
  chatCtx({ type: 'about' }, ['How reliable is this data?', 'Which fund houses are missing and why?', 'How is "net buying" calculated?']);
};

/* ---------------------------------------------------------------- boot */
async function boot() {
  const page = document.body.dataset.page; document.body.dataset.page = page;
  const t = { home: 'Mutual Fund Flows', movers: "What fund buying does to stocks", changes: 'What changed', stocks: 'Stocks', stock: 'Stock', houses: 'Funds & houses', house: 'Fund house', fund: 'Fund', evidence: 'Evidence', about: 'About' }[page] || '';
  const main = shell(page); document.title = (t && page !== 'home' ? t + ' · ' : '') + 'Mutual Fund Flows';
  try { await pages[page === 'funds' ? 'houses' : page](main); if (page === 'stock') { const h1 = $('h1', main); if (h1) document.title = h1.textContent.replace(/Funds buying|Funds selling|Little activity/, '').trim() + ' · Mutual Fund Flows'; } } catch (e) { console.error(e); err(main, e); }
  const s = document.createElement('script'); s.src = 'assets/chat.js'; document.body.appendChild(s);
}
document.addEventListener('DOMContentLoaded', () => { const page = document.body.dataset.page; document.body.dataset.page = page; boot(); });
window.FFLUI = { esc, mlabel, cr };
})();
