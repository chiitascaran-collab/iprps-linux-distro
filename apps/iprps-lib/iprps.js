// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS session tools - shared browser code: elements, the API, toasts, the color scheme,
// and the campaign / session picker. Load after ../auth/auth-client.js.
(() => {
  'use strict';
  const LIB = new URL('.', document.currentScript.src).href;           // .../iprps-lib/
  const IP = window.IP = {};
  IP.$ = id => document.getElementById(id);

  // Color scheme: applied at once from this browser's copy, then from the account (IPRPS Welcome).
  IP.store = {
    get(k, d) { try { const v = localStorage.getItem('iprps.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('iprps.' + k, JSON.stringify(v)); } catch {} },
  };
  IP.setTheme = t => { document.documentElement.dataset.theme = t || 'night'; IP.store.set('theme', t || 'night'); };
  document.documentElement.dataset.theme = IP.store.get('theme', 'night');

  // Elements without innerHTML: text always goes in as text.
  IP.h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  };
  const h = IP.h;

  // api('action', body?, '&query', 'api.php') - POST when there's a body. Throws with the server's message.
  IP.api = async (action, body, params = '', base = 'api.php') => {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const r = await fetch(`${base}?action=${action}${params}`, opt);
    let j; try { j = await r.json(); } catch { throw new Error(`Server error (HTTP ${r.status})`); }
    if (!j.ok) throw new Error(j.error || 'That did not work');
    return j;
  };
  IP.lib = (action, body, params = '') => IP.api(action, body, params, LIB + 'api.php');

  IP.toast = (m, bad) => {
    let t = IP.$('toast'); if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = m; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(IP.toast.t); IP.toast.t = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3200);
  };
  IP.act = fn => async (...a) => { try { return await fn(...a); } catch (e) { IP.toast(e.message, true); } };
  IP.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  IP.shift = n => (n >= 0 ? '+' : '') + n;
  IP.when = ts => { if (!ts) return ''; const d = new Date(String(ts).replace(' ', 'T')); return isNaN(d) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };
  IP.time = ts => { const d = new Date(String(ts).replace(' ', 'T')); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  IP.download = (name, text, type = 'text/plain') => {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  // boot(fn): waits for the Universal Login, applies the account's color scheme, then fn(user, status).
  IP.boot = fn => {
    const go = async user => {
      const who = IP.$('who'); if (who) who.textContent = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username;
      let status = { apps: {}, table_open: false, sheets: false };
      try { status = await IP.lib('status'); IP.setTheme(status.theme); } catch (e) { IP.toast(e.message, true); }
      IP.status = status;
      try { await fn(user, status); } catch (e) { IP.toast(e.message, true); }
    };
    if (!window.IPAuth) {
      const b = IP.$('banner');
      if (b) { b.innerHTML = 'Sign-in system not found: <code>../auth/auth-client.js</code> must exist (<code>/srv/www/iprps/auth/</code>).'; b.hidden = false; }
    } else if (IPAuth.user) go(IPAuth.user);
    else document.addEventListener('ipauth:ready', e => go(e.detail), { once: true });
  };

  // ---------------------------------------------------------------- campaign and session picker
  // picker(root, {sessions: true, onChange(state)}) → { state: {campaign, session, campaigns, sessions}, reload() }
  IP.picker = (root, opts = {}) => {
    const st = { campaign: 0, session: 0, campaigns: [], sessions: [] };
    const cSel = h('select', { 'aria-label': 'Campaign', title: 'Campaign' });
    const sSel = opts.sessions ? h('select', { 'aria-label': 'Session', title: 'Session' }) : null;
    const editBtn = h('button', { class: 'ghost small', text: '✎', title: 'Edit this campaign' });
    const newSess = opts.sessions ? h('button', { class: 'ghost small', text: '+ Session', title: 'Start the next session of this campaign' }) : null;
    root.classList.add('picker');
    root.append(h('span', { class: 'field', text: 'Campaign' }), cSel, editBtn, ...(sSel ? [h('span', { class: 'field', text: 'Session' }), sSel, newSess] : []));
    const key = opts.key || 'picker';
    const changed = () => { IP.store.set(key, { c: st.campaign, s: st.session }); opts.onChange && opts.onChange(st); };

    async function loadCampaigns(want) {
      st.campaigns = (await IP.lib('campaigns')).campaigns;
      cSel.textContent = '';
      cSel.append(h('option', { value: '0', text: st.campaigns.length ? '— choose a campaign —' : '— no campaigns yet —' }));
      for (const c of st.campaigns) cSel.append(h('option', { value: c.id, text: c.name + (c.status !== 'active' ? ` (${c.status})` : '') }));
      cSel.append(h('option', { value: 'new', text: '+ New campaign…' }));
      st.campaign = st.campaigns.some(c => c.id === +want) ? +want : 0;
      cSel.value = String(st.campaign);
      editBtn.hidden = !st.campaign;
    }
    async function loadSessions(want) {
      if (!sSel) return;
      st.sessions = st.campaign ? (await IP.lib('sessions', null, `&campaign=${st.campaign}`)).sessions : [];
      sSel.textContent = '';
      if (!st.sessions.length) sSel.append(h('option', { value: '0', text: st.campaign ? 'No sessions yet' : '—' }));
      for (const s of st.sessions) sSel.append(h('option', { value: s.id, text: `Session ${s.session_no}${s.title ? ': ' + s.title : ''}` }));
      st.session = st.sessions.some(s => s.id === +want) ? +want : (st.sessions[0] || {}).id || 0;
      sSel.value = String(st.session);
      newSess.disabled = !st.campaign;
    }
    cSel.onchange = IP.act(async () => {
      if (cSel.value === 'new') { cSel.value = String(st.campaign); return editCampaign(null); }
      st.campaign = +cSel.value; editBtn.hidden = !st.campaign;
      await loadSessions(0); changed();
    });
    if (sSel) sSel.onchange = () => { st.session = +sSel.value; changed(); };
    if (newSess) newSess.onclick = IP.act(async () => {
      const title = prompt(`Title for session ${(st.sessions[0] ? st.sessions[0].session_no : 0) + 1} (optional):`, '');
      if (title === null) return;
      const j = await IP.lib('session_save', { campaign_id: st.campaign, title });
      await loadSessions(j.id); changed(); IP.toast(`Session ${j.session_no} started`);
    });
    editBtn.onclick = () => editCampaign(st.campaigns.find(c => c.id === st.campaign));

    function editCampaign(c) {
      const f = { name: h('input', { maxlength: 160, value: c ? c.name : '', required: true }), setting: h('input', { maxlength: 160, value: c ? c.setting || '' : '', placeholder: 'Iron City, the Long Road…' }),
        status: h('select', {}, ['planning', 'active', 'paused', 'finished'].map(s => h('option', { value: s, text: s[0].toUpperCase() + s.slice(1) }))),
        description: h('textarea', { rows: 4, placeholder: 'What the campaign is about. The Oracle reads it.' }) };
      f.status.value = c ? c.status : 'active'; f.description.value = c ? c.description || '' : '';
      const dlg = h('dialog', { class: 'dlg' }, h('form', { method: 'dialog' },
        h('h2', { text: c ? 'Edit campaign' : 'New campaign' }),
        h('label', { class: 'frow' }, 'Name', f.name), h('label', { class: 'frow' }, 'Setting', f.setting), h('label', { class: 'frow' }, 'Status', f.status),
        h('label', { class: 'frow col' }, 'Description', f.description),
        h('div', { class: 'dlgbtns' }, h('button', { class: 'ghost', value: 'cancel', text: 'Cancel', formnovalidate: true }), h('button', { value: 'ok', text: c ? 'Save' : 'Create campaign' }))));
      document.body.append(dlg);
      dlg.addEventListener('close', IP.act(async () => {
        dlg.remove();
        if (dlg.returnValue !== 'ok') return;
        const j = await IP.lib('campaign_save', { id: c ? c.id : undefined, name: f.name.value, setting: f.setting.value, status: f.status.value, description: f.description.value });
        await loadCampaigns(j.id); await loadSessions(st.session); changed();
        IP.toast(c ? 'Campaign saved' : 'Campaign created');
      }));
      dlg.showModal(); f.name.focus();
    }
    const saved = IP.store.get(key, IP.store.get('picker', { c: 0, s: 0 }));
    const ready = (async () => { await loadCampaigns(saved.c); await loadSessions(saved.s); changed(); })();
    const setSession = id => { if (!sSel || !st.sessions.some(x => x.id === id)) return; st.session = id; sSel.value = String(id); changed(); };
    return { state: st, ready, reload: async () => { await loadCampaigns(st.campaign); await loadSessions(st.session); changed(); }, setSession, editCampaign };
  };

  // Show text to the players: a dialog with the player display and the IPRPS Table as targets.
  IP.showToPlayers = async (title, text, campaign) => {
    const disp = h('input', { type: 'checkbox', checked: IP.store.get('show.display', true) });
    const tab = h('input', { type: 'checkbox', checked: IP.store.get('show.table', !!IP.status?.table_open) });
    const tt = h('input', { value: title || '', maxlength: 120 }), body = h('textarea', { rows: 8 }); body.value = text;
    const dlg = h('dialog', { class: 'dlg' }, h('form', { method: 'dialog' },
      h('h2', { text: 'Show to the players' }),
      h('label', { class: 'frow' }, 'Title', tt), h('label', { class: 'frow col' }, 'Text (edit before showing)', body),
      h('div', { class: 'row' }, h('label', { class: 'check' }, disp, 'Player display (second screen)'), h('label', { class: 'check' }, tab, 'IPRPS Table (players\' devices)')),
      h('div', { class: 'dlgbtns' }, h('button', { class: 'ghost', value: 'cancel', text: 'Cancel' }), h('button', { value: 'ok', text: 'Show' }))));
    document.body.append(dlg);
    return new Promise(resolve => {
      dlg.addEventListener('close', IP.act(async () => {
        dlg.remove();
        if (dlg.returnValue !== 'ok') return resolve(false);
        IP.store.set('show.display', disp.checked); IP.store.set('show.table', tab.checked);
        if (!disp.checked && !tab.checked) return resolve(false);
        const r = await IP.lib('show', { title: tt.value, text: body.value, campaign, display: disp.checked, table: tab.checked });
        const done = [r.display ? 'player display' : null, r.table && r.table.ok ? `${r.table.sent} Table screen(s)` : null].filter(Boolean);
        if (r.table && !r.table.ok) IP.toast(r.table.error + (done.length ? ` Shown on the ${done.join(' and ')}.` : ''), true);
        else IP.toast(`Shown on the ${done.join(' and ')}`);
        resolve(true);
      }));
      dlg.showModal();
    });
  };
  // Quietly push to the targets chosen last time (used by "keep players updated").
  IP.pushQuiet = (title, text, campaign) => IP.lib('show', { title, text, campaign, display: IP.store.get('show.display', true), table: IP.store.get('show.table', false) }).catch(() => {});
})();
