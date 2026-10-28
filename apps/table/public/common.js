// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Table - shared by the player page and the Session Master console.
(() => {
  'use strict';
  const T = window.T = {};
  T.role = document.body.dataset.role;
  T.$ = id => document.getElementById(id);

  // Build elements without innerHTML (all text goes in as text).
  T.h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  };
  const h = T.h;

  T.store = {
    get(k, d) { try { const v = localStorage.getItem('iprps-table:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('iprps-table:' + k, JSON.stringify(v)); } catch {} },
  };

  T.api = async (path, body) => {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-IPRPS': '1', 'X-IPRPS-SM': '1' }, body: JSON.stringify(body || {}) });
    let j; try { j = await r.json(); } catch { throw new Error(`The table computer did not answer (HTTP ${r.status})`); }
    if (!j.ok) throw new Error(j.error || 'That did not work');
    return j;
  };
  T.upload = (path, file, onProgress) => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', path);
    x.setRequestHeader('X-IPRPS', '1'); x.setRequestHeader('X-IPRPS-SM', '1');
    x.setRequestHeader('X-Filename', encodeURIComponent(file.name || 'pasted-image.png'));
    if (file.type) x.setRequestHeader('Content-Type', file.type);
    x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    x.onload = () => { let j; try { j = JSON.parse(x.responseText); } catch { return reject(new Error(`Upload failed (HTTP ${x.status})`)); } j.ok ? resolve(j.media) : reject(new Error(j.error)); };
    x.onerror = () => reject(new Error('Upload failed: lost the connection'));
    x.send(file);
  });
  T.mediaUrl = id => `/media/${encodeURIComponent(id)}${T.role === 'sm' ? '?sm=1' : ''}`;

  T.toast = (msg, bad) => {
    let t = T.$('toast'); if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(T.toast.t); T.toast.t = setTimeout(() => { t.className = 'toast'; }, 3500);
  };
  T.copy = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch {                                       // plain http on the LAN: no clipboard API, use the old way
      const ta = h('textarea', { class: 'offscreen', readonly: true }); ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); } catch {} ta.remove();
    }
    T.toast('Copied');
  };
  T.time = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  T.ago = ts => { const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(ts).toLocaleDateString(); };
  T.size = n => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`);

  // ---------------------------------------------------------------- events
  T.connect = (url, on) => {
    let es, alive = false;
    const open = () => {
      es = new EventSource(url);
      es.onopen = () => { alive = true; on.status && on.status(true); };
      es.onerror = () => { alive = false; on.status && on.status(false); if (es.readyState === 2) { on.gone && on.gone(); } };
      for (const ev of Object.keys(on)) if (!['status', 'gone'].includes(ev)) es.addEventListener(ev, e => on[ev](JSON.parse(e.data)));
    };
    open();
    return { close: () => { alive = false; es.close(); }, reopen: () => { es.close(); open(); }, get alive() { return alive; } };
  };

  // ---------------------------------------------------------------- lightbox for images
  T.lightbox = src => {
    const box = h('div', { class: 'lightbox', onclick: () => box.remove() }, h('img', { src, alt: '' }));
    document.body.append(box);
  };

  // ---------------------------------------------------------------- one chat message
  T.msgEl = (m, ctx) => {
    if (m.kind === 'system') return h('div', { class: 'sysmsg', dataset: { id: m.id } }, h('span', { text: m.text }), h('time', { text: T.time(m.ts) }));
    const mine = m.from === ctx.me;
    const priv = m.to && !['all', 'players'].includes(m.to.type);
    const who = h('span', { class: 'who', text: m.from === 'sm' ? '✦ Session Master' : m.fromName });
    if (m.color) who.style.color = m.color;
    const copyText = () => (m.roll ? `${m.fromName}: ${m.roll.label} = ${m.roll.total ?? ''} ${m.roll.detail}` : m.text);
    const el = h('div', { class: `msg${mine ? ' mine' : ''}${priv ? ' private' : ''}${m.kind === 'roll' ? ' rollmsg' : ''}${m.from === 'sm' ? ' fromsm' : ''}`, dataset: { id: m.id } },
      h('div', { class: 'meta' }, who,
        m.fromCharacter ? h('span', { class: 'char', text: m.fromCharacter }) : null,
        m.to && m.to.type !== 'all' ? h('span', { class: 'badge', text: m.to.label }) : null,
        h('time', { text: T.time(m.ts) }),
        h('button', { class: 'icon copy', title: 'Copy', 'aria-label': 'Copy', text: '⧉', onclick: () => T.copy(copyText()) })));
    if (m.roll) {
      const r = m.roll;
      el.append(h('div', { class: 'roll' },
        r.total !== null && r.total !== undefined ? h('b', { class: 'total', text: String(r.total) }) : null,
        h('div', { class: 'rbody' }, h('div', { class: 'rlabel', text: r.label }), h('div', { class: 'rdetail', text: r.detail }),
          r.lines && r.lines.length ? h('dl', {}, r.lines.map(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])) : null)));
    }
    if (m.text) el.append(h('div', { class: 'text', text: m.text }));
    for (const a of m.att || []) {
      const src = T.mediaUrl(a.id);
      if (a.kind === 'image') el.append(h('img', { class: 'att', src, alt: a.name, loading: 'lazy', onclick: () => T.lightbox(src) }));
      else if (a.kind === 'audio') el.append(h('div', { class: 'attaudio' }, h('span', { text: '♪ ' + a.name }), h('audio', { controls: true, preload: 'none', src })));
      else if (a.kind === 'video') el.append(h('video', { class: 'att', controls: true, preload: 'metadata', src }));
    }
    return el;
  };

  // A chat feed that stays scrolled to the bottom unless the reader scrolled up.
  T.feed = (el, ctx) => {
    const seen = new Set();
    return {
      clear() { el.textContent = ''; seen.clear(); },
      add(m) {
        if (seen.has(m.id)) return; seen.add(m.id);
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        el.append(T.msgEl(m, ctx));
        if (atBottom || m.from === ctx.me) el.scrollTop = el.scrollHeight;
      },
    };
  };

  // ---------------------------------------------------------------- dice toolbar
  T.diceBar = (root, opts) => {
    let presets = { presets: [], weapons: [], kinds: {} };
    const vis = h('select', { class: 'vis', title: 'Who sees the roll' }, opts.vis.map(([v, l]) => h('option', { value: v, text: l })));
    vis.value = T.store.get('vis', opts.vis[0][0]); if (!vis.value) vis.value = opts.vis[0][0];
    vis.onchange = () => T.store.set('vis', vis.value);
    const roll = async body => {
      try { await opts.onRoll({ ...body, vis: vis.value }); }
      catch (e) { T.toast(e.message, true); }
    };
    const expr = h('input', { class: 'expr', placeholder: '2d6+3', 'aria-label': 'Dice to roll', maxlength: 60, autocomplete: 'off',
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); go(); } } });
    const go = () => { if (expr.value.trim()) roll({ expr: expr.value.trim() }); };
    const pick = h('select', { class: 'pick', 'aria-label': 'IPRPS roll' });
    const fields = h('div', { class: 'fields' }), help = h('p', { class: 'help' });
    const panel = h('div', { class: 'iprps', hidden: true },
      h('div', { class: 'prow' }, pick, fields, h('button', { class: 'gold', text: 'Roll', onclick: () => rollPreset() })), help);
    const toggle = h('button', { class: 'ghost', text: 'IPRPS ▾', title: 'IPRPS combat and check rolls', onclick: () => { panel.hidden = !panel.hidden; toggle.classList.toggle('on', !panel.hidden); } });
    root.append(h('div', { class: 'dicebar' },
      h('div', { class: 'quick' }, [4, 6, 8, 10, 12, 20, 100].map(n => h('button', { class: 'die', text: `d${n}`, title: `Roll 1d${n}`, onclick: () => roll({ expr: `1d${n}` }) })),
        expr, h('button', { class: 'gold', text: 'Roll', onclick: go }), toggle, vis), panel));

    function presetOf(id) {
      if (id.startsWith('weapon:')) { const w = presets.weapons.find(x => 'weapon:' + x.name === id); return w && { id, kind: 'weapon', label: w.name, help: `Damage ${w.expr}. Armor Rating comes off the damage (Damage − AR).` }; }
      return presets.presets.find(p => p.id === id);
    }
    function showFields() {
      const p = presetOf(pick.value); fields.textContent = ''; help.textContent = p ? p.help || '' : '';
      if (!p) return;
      const saved = T.store.get('p:' + p.id, {});
      for (const [key, label, def, a, b] of (presets.kinds[p.kind] || { fields: [] }).fields) {
        const v = saved[key] !== undefined ? saved[key] : def;
        const inp = Array.isArray(a)
          ? h('select', { name: key }, a.map(o => h('option', { value: o, text: o[0].toUpperCase() + o.slice(1) })))
          : h('input', { name: key, type: 'number', min: a, max: b, inputmode: 'numeric' });
        inp.value = v;
        fields.append(h('label', {}, h('span', { text: label }), inp));
      }
    }
    function rollPreset() {
      const p = presetOf(pick.value); if (!p) return;
      const params = {};
      fields.querySelectorAll('[name]').forEach(i => { params[i.name] = i.value; });
      T.store.set('p:' + p.id, params);
      roll({ preset: p.id, params });
    }
    pick.onchange = () => { T.store.set('pick', pick.value); showFields(); };
    return {
      setPresets(p) {
        presets = p;
        pick.textContent = '';
        pick.append(h('optgroup', { label: 'IPRPS rolls' }, p.presets.map(x => h('option', { value: x.id, text: x.label }))));
        if (p.weapons.length) pick.append(h('optgroup', { label: 'Weapon damage' }, p.weapons.map(w => h('option', { value: 'weapon:' + w.name, text: `${w.name} (${w.expr})` }))));
        const last = T.store.get('pick', ''); if (last && presetOf(last)) pick.value = last;
        showFields();
      },
    };
  };

  // ---------------------------------------------------------------- composer with attachments
  T.composer = (root, opts) => {
    const atts = [];              // { id, name, kind, chip, pending }
    const list = h('div', { class: 'atts' });
    const to = h('select', { class: 'to', 'aria-label': 'Send to' });
    const text = h('textarea', { rows: 1, maxlength: 2000, placeholder: 'Message…', 'aria-label': 'Message',
      onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } },
      oninput: () => { text.style.height = 'auto'; text.style.height = Math.min(text.scrollHeight, 160) + 'px'; } });
    const file = h('input', { type: 'file', accept: opts.accept, multiple: true, hidden: true, onchange: () => { [...file.files].forEach(add); file.value = ''; } });
    const sendBtn = h('button', { class: 'gold', text: 'Send', onclick: () => send() });
    root.append(h('div', { class: 'composer' }, list,
      h('div', { class: 'crow' }, to, text,
        h('button', { class: 'ghost icon', title: 'Attach an image or audio file', 'aria-label': 'Attach', text: '📎', onclick: () => file.click() }), file, sendBtn)));
    text.addEventListener('paste', e => {
      const files = [...(e.clipboardData && e.clipboardData.files || [])];
      if (files.length) { e.preventDefault(); files.forEach(add); }
    });
    root.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); root.classList.add('drop'); } });
    root.addEventListener('dragleave', () => root.classList.remove('drop'));
    root.addEventListener('drop', e => { root.classList.remove('drop'); if (e.dataTransfer.files.length) { e.preventDefault(); [...e.dataTransfer.files].forEach(add); } });

    function add(f) {
      if (atts.length >= 6) return T.toast('Up to 6 files per message', true);
      const bar = h('i'), a = { name: f.name || 'pasted image', pending: true };
      a.chip = h('span', { class: 'chip' }, h('span', { text: (/^audio/.test(f.type) ? '♪ ' : '🖼 ') + a.name }), h('span', { class: 'prog' }, bar),
        h('button', { class: 'icon', text: '×', 'aria-label': 'Remove', onclick: () => { atts.splice(atts.indexOf(a), 1); a.chip.remove(); } }));
      atts.push(a); list.append(a.chip);
      T.upload(opts.uploadPath, f, p => { bar.style.width = Math.round(p * 100) + '%'; })
        .then(m => { a.id = m.id; a.kind = m.kind; a.pending = false; a.chip.classList.add('done'); })
        .catch(e => { T.toast(e.message, true); atts.splice(atts.indexOf(a), 1); a.chip.remove(); });
    }
    async function send() {
      if (atts.some(a => a.pending)) return T.toast('Wait for the files to finish uploading');
      const body = { to: opts.target(to.value), text: text.value.trim(), att: atts.map(a => a.id) };
      if (!body.text && !body.att.length) return;
      sendBtn.disabled = true;
      try {
        await T.api(opts.sendPath, body);
        text.value = ''; text.style.height = 'auto'; atts.splice(0).forEach(a => a.chip.remove());
      } catch (e) { T.toast(e.message, true); }
      finally { sendBtn.disabled = false; text.focus(); }
    }
    return {
      setTargets(options) {           // [[value, label, group?]]
        const keep = to.value; to.textContent = '';
        let group = null;
        for (const [v, l, g] of options) {
          if (g && (!group || group.label !== g)) { group = h('optgroup', { label: g }); to.append(group); }
          (g ? group : to).append(h('option', { value: v, text: l }));
          if (!g) group = null;
        }
        if ([...to.options].some(o => o.value === keep)) to.value = keep;
      },
      set target(v) { to.value = v; }, get target() { return to.value; },
      focus() { text.focus(); },
    };
  };
})();
