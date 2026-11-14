// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Small DOM + network helpers shared by the studio and the guest page.
export const $ = (s, r = document) => r.querySelector(s);
// replaceChildren() that accepts nested arrays and skips null/false, like h() does.
const _rc = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function (...kids) { return _rc.apply(this, kids.flat(Infinity).filter(k => k != null && k !== false)); };
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, x] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, x) : (el.style[p] = x); }
    else if (k === 'data') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

export async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
  let r;
  try { r = await fetch(url, opt); } catch (e) { throw new Error('The studio server is not responding.'); }
  const ct = r.headers.get('Content-Type') || '';
  const data = ct.includes('json') ? await r.json() : await r.blob();
  if (!r.ok) throw new Error((data && data.error) || `Request failed (${r.status})`);
  return data;
}

export function upload(url, blob, onProgress) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.upload.onprogress = e => onProgress && e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} x.status < 300 ? res(j) : rej(new Error(j.error || `Upload failed (${x.status})`)); };
    x.onerror = () => rej(new Error('Upload failed — connection lost.'));
    x.send(blob);
  });
}

export function toast(msg, kind = 'info', ms = 4500) {
  const box = $('#toasts'); if (!box) return;
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, String(msg));
  box.append(t); setTimeout(() => t.remove(), ms);
}
export const fail = e => { console.error(e); toast(e.message || e, 'err', 7000); };

export function modal(title, body, buttons = [], opts = {}) {
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); opts.onClose && opts.onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const foot = h('div', { class: 'modal-foot' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: async () => { if (!b.fn || (await b.fn()) !== false) close(); } }, b.label)));
  const back = h('div', { class: 'modal-back', onmousedown: e => { if (e.target === back && !opts.sticky) close(); } },
    h('div', { class: 'modal ' + (opts.cls || ''), role: 'dialog', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'x', onclick: close, 'aria-label': 'Close' }, '×')),
      h('div', { class: 'modal-body' }, body), buttons.length ? foot : null));
  document.body.append(back); document.addEventListener('keydown', onKey);
  const f = back.querySelector('input,textarea,select'); f && f.focus();
  return close;
}
export const confirmBox = (title, msg, ok = 'Confirm', cls = 'danger') => new Promise(res => {
  let done = false;
  modal(title, h('p', {}, msg), [{ label: 'Cancel', cls: 'ghost', fn: () => { done = true; res(false); } }, { label: ok, cls, fn: () => { done = true; res(true); } }], { onClose: () => done || res(false) });
});
export const promptBox = (title, value = '', label = '') => new Promise(res => {
  let done = false; const i = h('input', { value, class: 'wide', onkeydown: e => { if (e.key === 'Enter') { done = true; res(i.value.trim()); close(); } } });
  const close = modal(title, h('label', { class: 'field' }, label, i), [{ label: 'Cancel', cls: 'ghost', fn: () => { done = true; res(null); } }, { label: 'OK', cls: 'primary', fn: () => { done = true; res(i.value.trim()); } }], { onClose: () => done || res(null) });
});

export function fmtTime(s, frac = false) {
  s = Math.max(0, s || 0);
  const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60);
  let out = (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
  if (frac) out += '.' + String(Math.floor(s * 10 % 10));
  return out;
}
export const fmtSize = b => b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
export const fmtDate = ms => ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
export function debounce(fn, ms = 500) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); return fn(...a); }; return d; }
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch (e) { const t = h('textarea', { value: text }); document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast('Copied to clipboard');
}

// Bound form control: edits obj[key] in place and calls onchange.
export function inp(obj, key, o = {}) {
  const set = v => { obj[key] = v; o.onchange && o.onchange(v); };
  const val = obj[key] ?? o.def ?? '';
  let el;
  if (o.type === 'textarea') el = h('textarea', { rows: o.rows || 4, placeholder: o.placeholder || '', value: val, oninput: () => set(el.value) });
  else if (o.type === 'select') { el = h('select', { onchange: () => set(el.value) }, (o.opts || []).map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return h('option', { value: v, selected: String(v) === String(val) }, l); })); }
  else if (o.type === 'checkbox') el = h('input', { type: 'checkbox', checked: !!val, onchange: () => set(el.checked) });
  else if (o.type === 'number' || o.type === 'range') el = h('input', { type: o.type, value: val, min: o.min, max: o.max, step: o.step || 1, oninput: () => set(el.value === '' ? 0 : Number(el.value)) });
  else el = h('input', { type: o.type || 'text', value: val, placeholder: o.placeholder || '', oninput: () => set(el.value) });
  if (o.cls) el.className = o.cls;
  if (o.id) el.id = o.id;
  return el;
}
export const field = (label, control, hint) => h('label', { class: 'field' + (control.type === 'checkbox' ? ' check' : '') },
  control.type === 'checkbox' ? [control, h('span', {}, label)] : [h('span', {}, label), control], hint ? h('small', {}, hint) : null);
