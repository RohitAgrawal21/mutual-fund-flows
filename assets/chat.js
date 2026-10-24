/* Mutual Fund Flows - chat widget (loaded on every page) */
(() => {
'use strict';
const CFG = window.FFL_CONFIG || {}, BASE = CFG.BASE_PATH || '', API = CFG.API_BASE || '';   // see assets/config.js
if (window.__fflChat) return; window.__fflChat = true;
const KEY = 'ffl_chat_v1', MAX_SEND = 14;
const MOCK = new URLSearchParams(location.search).has('mock');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let hist = []; try { hist = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { }
let busy = false;
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(hist.slice(-60))); } catch (e) { } };
const PAGE_NAME = { home: 'the Overview page', movers: 'the What fund buying does to stocks page', stocks: 'the Stocks list', stock: 'a stock page', houses: 'the Funds & houses list', house: 'a fund house page', fund: 'a fund page', evidence: 'the Evidence page', about: 'the About page' };
const pageKey = () => { const f = window.FFL || {}; return (f.page || '') + ':' + ((f.ctx && f.ctx.id) || ''); };
const pageName = () => { const f = window.FFL || {}; const n = PAGE_NAME[f.page] || 'another page'; return f.ctx && f.ctx.name ? n.replace(/^(a|the) /, '') + ' for ' + f.ctx.name : n; };

// When the person moves to another page, mark it in the transcript and stop sending older messages as context for the new page.
try {
  const last = sessionStorage.getItem(KEY + '_pk');
  if (last !== null && last !== pageKey() && hist.length && hist[hist.length - 1].role !== 'divider') { hist.push({ role: 'divider', content: 'You moved to ' + pageName() }); save(); }
  sessionStorage.setItem(KEY + '_pk', pageKey());
} catch (e) { }
const sendable = () => { const i = hist.map(m => m.role).lastIndexOf('divider'); return hist.slice(i + 1).filter(m => m.role === 'user' || m.role === 'assistant').slice(-MAX_SEND); };

// minimal, safe markdown: **bold**, *italic*, `code`, lists, paragraphs, same-site links (clean URLs)
function md(t) {
  let s = esc(t);
  s = s.replace(/\[([^\]]+)\]\(\/?(stock|fund|house|houses|movers|stocks|evidence|about|index)(?:\.html)?(\?[^)\s]*)?\)/g, (m, txt, name, q) => '<a href="' + BASE + (name === 'index' ? '/' : '/' + name) + (q || '') + '">' + txt + '</a>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
  const lines = s.split(/\n/), out = []; let list = null;
  const close = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  for (const ln of lines) {
    const ul = ln.match(/^\s*[-•*]\s+(.*)/), ol = ln.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + ul[1] + '</li>'); }
    else if (ol) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + ol[1] + '</li>'); }
    else { close(); if (ln.trim()) out.push('<p>' + ln + '</p>'); }
  }
  close(); return out.join('');
}

const fab = document.createElement('button'); fab.id = 'chat-fab'; fab.setAttribute('aria-label', 'Open chat assistant');
fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>Ask';
const box = document.createElement('div'); box.id = 'chat'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Chat assistant');
box.innerHTML = '<div class="hd"><b>Ask about the data</b><button data-a="new" title="Start over">↺</button><button data-a="close" title="Close" aria-label="Close">✕</button></div><div class="msgs" aria-live="polite"></div><div class="sugs"></div><div class="fine">AI assistant: it looks things up on this site but can be wrong. Not investment advice. Your questions are sent to an AI service (Cloudflare Workers AI) to write the reply, so please don\'t include personal or financial details.</div><form><textarea rows="1" placeholder="Ask anything about the data…" aria-label="Message"></textarea><button class="send" type="submit">Send</button></form>';
document.body.appendChild(fab); document.body.appendChild(box);
const msgs = box.querySelector('.msgs'), sugs = box.querySelector('.sugs'), ta = box.querySelector('textarea'), send = box.querySelector('.send');

function add(role, text, extra) {
  const d = document.createElement('div');
  if (role === 'divider') { d.className = 'm d'; d.textContent = text; msgs.appendChild(d); return d; }
  d.className = 'm ' + (role === 'user' ? 'u' : 'a');
  if (role === 'user') d.textContent = text; else d.innerHTML = md(text) + (extra || '');
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
}
function greet() {
  const ctx = (window.FFL && window.FFL.ctx) || {};
  const hello = ctx.name ? `Hi! I can dig into the data on **${ctx.name}**, compare it with what history says, or answer anything else about how funds are behaving. What are you curious about?` : `Hi! I can look things up in the data on this site: what funds are buying and selling, how a stock has been held over time, and what history says about whether any of it matters. What would you like to know?`;
  add('assistant', hello);
}
function renderAll() { msgs.innerHTML = ''; if (!hist.length) greet(); else hist.forEach(m => add(m.role, m.content)); renderSugs(); }
function renderSugs() { const s = (window.FFL && window.FFL.suggestions) || []; sugs.innerHTML = sendable().length > 2 ? '' : s.slice(0, 4).map(x => `<button type="button">${esc(x)}</button>`).join(''); sugs.querySelectorAll('button').forEach(b => b.onclick = () => ask(b.textContent)); }
window.addEventListener('ffl-context', renderSugs);

function open() { box.classList.add('open'); fab.style.display = 'none'; renderAll(); setTimeout(() => ta.focus(), 50); }
function close() { box.classList.remove('open'); fab.style.display = 'flex'; }
fab.onclick = open;
box.querySelector('[data-a=close]').onclick = close;
box.querySelector('[data-a=new]').onclick = () => { hist = []; save(); renderAll(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); box.querySelector('form').requestSubmit(); } });
box.querySelector('form').onsubmit = e => { e.preventDefault(); const t = ta.value.trim(); if (t) { ta.value = ''; ta.style.height = 'auto'; ask(t); } };

// One request with automatic recovery: the first call after a quiet period can be slow or fail while the function starts up.
async function callChat(onSlow) {
  const payload = JSON.stringify({ messages: sendable(), context: (window.FFL && { page: window.FFL.page, ...window.FFL.ctx }) || {} });
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 60000);
    try {
      const r = await fetch(API + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, signal: ctl.signal });
      clearTimeout(timer);
      let j = {}; try { j = await r.json(); } catch (e) { }
      if (r.ok && j.reply) return j.reply;
      if (r.status >= 400 && r.status < 500) { const e = new Error(j.error || ('Something went wrong (' + r.status + ').')); e.final = true; throw e; }
      lastErr = new Error(j.error || 'The assistant is temporarily unavailable.');
    } catch (e) { clearTimeout(timer); if (e.final) throw e; lastErr = e; if (e && e.name === 'AbortError') break; }   // a timeout is not retried
    if (attempt < 2) { onSlow && onSlow(); await sleep(1500 * (attempt + 1)); }
  }
  const e = new Error('The assistant did not respond. This can happen when it has been idle for a while.'); e.retryable = true; e.cause = lastErr; throw e;
}

async function ask(text, isRetry) {
  if (busy) return; busy = true; send.disabled = true; sugs.innerHTML = '';
  hist.push({ role: 'user', content: text }); save(); if (!isRetry) add('user', text);
  const typing = add('assistant', ''); typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  try {
    let reply;
    if (MOCK) { await sleep(900); reply = 'This is a **mock reply** so you can check the chat layout.\n\nYou asked: "' + text + '"'; }
    else reply = await callChat(() => { typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span> <span class="small muted">Still working, one moment…</span>'; });
    typing.innerHTML = md(reply); hist.push({ role: 'assistant', content: reply }); save();
  } catch (e) {
    hist.pop(); save();
    typing.innerHTML = '<p>' + esc(e.message || 'Something went wrong.') + '</p>' + (e.final ? '' : '<p><button type="button" class="retry">Try again</button></p>');
    const b = typing.querySelector('.retry'); if (b) b.onclick = () => { typing.remove(); busy = false; ask(text, true); };
  } finally { busy = false; send.disabled = false; msgs.scrollTop = msgs.scrollHeight; ta.focus(); }
}
if (sessionStorage.getItem(KEY + '_open') === '1') open();
new MutationObserver(() => sessionStorage.setItem(KEY + '_open', box.classList.contains('open') ? '1' : '0')).observe(box, { attributes: true, attributeFilter: ['class'] });
})();
