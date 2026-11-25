// SPDX-License-Identifier: GPL-2.0-only
// IPRPS Link relay dashboard. Signs in with the Infinite Plane account (shared /auth/), then manages the relay through
// its /_admin/ API. Names, usernames and notes come from other people's accounts: they are only ever set as text.
'use strict';
(() => {
  const RELAY = String(window.IPRPS_RELAY || '').replace(/\/+$/, '');
  const $ = s => document.querySelector(s);
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const STATUS = { active: 'Active', pending: 'Waiting for approval', suspended: 'Suspended', blocked: 'Blocked' };
  const hours = s => (s / 3600).toFixed(s >= 36000 ? 0 : 1);
  const gb = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  const when = t => { if (!t) return '—'; const d = new Date(t), s = (Date.now() - d) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : d.toLocaleDateString(); };
  let OV = null, LIST = [], INV = [], SEL = null, TIMER = null;

  function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, bad ? 7000 : 3000); }
  async function api(op, body) {
    const token = window.IPAuth && window.IPAuth.token ? window.IPAuth.token() : '';
    let r;
    try { r = await fetch(`${RELAY}/_admin/${op}`, { method: body ? 'POST' : 'GET', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token }, body: body ? JSON.stringify(body) : undefined }); }
    catch { throw new Error(`The relay at ${RELAY} did not answer. Is it online, and is this page's address in dashboard_origins?`); }
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || `The relay answered HTTP ${r.status}.`);
    return j;
  }

  // ---------- tabs ----------
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => show(b.dataset.tab));
  function show(t) {
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
    if (t === 'invites') loadInvites(); if (t === 'activity') loadLog(); if (t === 'settings') renderSettings();
  }
  $('#refresh').onclick = () => refresh(true);

  async function refresh(say) {
    try {
      [OV, { masters: LIST }] = await Promise.all([api('overview'), api('list')]);
      $('#banner').hidden = true;
      renderOverview(); renderPlansSelects(); renderList(); if (SEL) { const m = LIST.find(x => x.id === SEL); if (m && !$('#editor').contains(document.activeElement)) renderEditor(m); }
      if (say) toast('Up to date.');
    } catch (e) { $('#banner').textContent = e.message; $('#banner').hidden = false; }
  }

  // ---------- overview ----------
  function renderOverview() {
    const o = OV, s = o.settings, max = +s.max_online_tables;
    $('#relayAddr').textContent = o.relay; $('#you').replaceChildren('Signed in as ', el('b', { text: o.you }));
    const pend = o.status.pending || 0; const b = $('#pendingBadge'); b.hidden = !pend; b.textContent = pend;
    const access = { open: 'Open: any Infinite Plane account', approval: 'With approval', owners: 'Owners only' }[s.access];
    const card = (label, big, sub) => el('div', { class: 'card' }, el('small', { text: label }), el('div', { class: 'big', text: big }), el('div', { class: 'sub', text: sub }));
    $('#cards').replaceChildren(
      card('Online now', String(o.online), max ? `of ${max} tables at once` : 'no limit on tables at once'),
      card('Session Masters', String(o.registered), `${o.status.active || 0} active · ${pend} waiting · ${o.status.suspended || 0} suspended · ${o.status.blocked || 0} blocked`),
      card('Played this month', hours(o.usage.sec) + ' h', `${o.usage.sessions} sessions by ${o.active_this_month} Session Masters`),
      card('Data this month', gb(o.usage.in + o.usage.out), `${gb(o.usage.out)} to players · ${gb(o.usage.in)} from players`),
      card('Who can connect', access, o.invites ? `${o.invites} pre-set account${o.invites > 1 ? 's' : ''}` : 'Change under Settings'),
      card('Relay', 'v' + o.version, `PHP ${o.php} · month ${o.month} (UTC)`));
    const waiting = LIST.filter(m => m.status === 'pending');
    $('#waiting').replaceChildren(...(waiting.length ? [el('div', { class: 'waitbox' }, el('b', { text: `${waiting.length} Session Master${waiting.length > 1 ? 's are' : ' is'} waiting for approval` }),
      el('ul', {}, waiting.map(m => el('li', {}, el('span', { text: `${m.display || m.username} (${m.username}, ${m.email})` }), el('span', { class: 'hint', text: 'signed up ' + when(m.created) }),
        el('button', { class: 'small primary', text: 'Approve', onclick: () => change(m, { status: 'active' }, 'Approved.') }),
        el('button', { class: 'small', text: 'Block', onclick: () => change(m, { status: 'blocked' }, 'Blocked.') })))))] : []));
    $('#ovNote').textContent = 'Usage counts connected time (while IPRPS Link is on) and data passed through the relay. It refreshes every 30 seconds.';
  }

  // ---------- Session Masters ----------
  ['#q', '#fStatus', '#fPlan', '#sort'].forEach(s => $(s).addEventListener('input', renderList));
  function renderPlansSelects() {
    const plans = Object.entries(OV.settings.plans);
    const cur = $('#fPlan').value; $('#fPlan').replaceChildren(el('option', { value: '', text: 'Every plan' }), ...plans.map(([k, p]) => el('option', { value: k, text: p.label })));
    $('#fPlan').value = cur;
    const ip = $('#iPlan').value; $('#iPlan').replaceChildren(...plans.map(([k, p]) => el('option', { value: k, text: p.label })));
    $('#iPlan').value = ip || OV.settings.default_plan;
  }
  function renderList() {
    const q = $('#q').value.trim().toLowerCase(), fs = $('#fStatus').value, fp = $('#fPlan').value, sort = $('#sort').value;
    let rows = LIST.filter(m => (!q || [m.display, m.username, m.email, m.name, m.note].join(' ').toLowerCase().includes(q))
      && (!fs || (fs === 'online' ? m.online : m.status === fs)) && (!fp || m.plan === fp));
    const by = { last: (a, b) => String(b.last_seen).localeCompare(String(a.last_seen)), new: (a, b) => String(b.created).localeCompare(String(a.created)),
      name: (a, b) => (a.display || a.username).localeCompare(b.display || b.username), hours: (a, b) => b.usage.sec - a.usage.sec, data: (a, b) => (b.usage.in + b.usage.out) - (a.usage.in + a.usage.out) };
    rows.sort(by[sort]);
    $('#count').textContent = `${rows.length} of ${LIST.length}`;
    const plans = OV.settings.plans;
    $('#rows').replaceChildren(...rows.map(m => el('tr', { class: m.id === SEL ? 'sel' : '', tabindex: 0, onclick: () => select(m.id), onkeydown: e => { if (e.key === 'Enter') select(m.id); } },
      el('td', {}, m.online ? el('span', { class: 'dot', title: 'Online now' }) : null, el('b', { text: m.display || m.username }), el('span', { class: 'u', text: `${m.username} · ${m.email}` })),
      el('td', {}, el('span', { class: 'st st-' + m.status, text: STATUS[m.status] || m.status })),
      el('td', { text: (plans[m.plan] || {}).label || m.plan }),
      el('td', {}, el('span', { class: 'addr', text: m.link.replace(/^https?:\/\//, '') })),
      el('td', { text: `${hours(m.usage.sec)} h · ${gb(m.usage.in + m.usage.out)} · ${m.usage.sessions}×` }),
      el('td', { text: when(m.last_seen) }))));
    if (!rows.length) $('#rows').append(el('tr', {}, el('td', { colspan: 6, class: 'hint', text: LIST.length ? 'Nobody matches.' : 'No Session Masters yet. They appear here the first time their IPRPS Link connects to the relay.' })));
  }
  function select(id) { SEL = id; renderList(); const m = LIST.find(x => x.id === id); if (m) renderEditor(m); }
  function renderEditor(m) {
    const ed = $('#editor'), plans = OV.settings.plans, lim = m.limits || {}, eff = m.effective;
    const statusSel = el('select', { id: 'eStatus' }, Object.entries(STATUS).map(([k, v]) => el('option', { value: k, text: v })));
    statusSel.value = m.status;
    const planSel = el('select', { id: 'ePlan' }, Object.entries(plans).map(([k, p]) => el('option', { value: k, text: p.label })));
    planSel.value = m.plan;
    const num = (id, v, ph) => el('input', { id, type: 'number', min: 0, step: 'any', value: v ?? '', placeholder: ph });
    const shown = v => (+v ? String(v) : 'no limit');
    ed.replaceChildren(
      el('h3', { text: m.display || m.username }), el('div', { class: 'hint', text: `${m.username} · ${m.email}` }),
      el('div', { class: 'facts' }, el('div', {}, 'Joined ', el('b', { text: m.created ? new Date(m.created).toLocaleString() : '—' }), m.invited ? ' (pre-set)' : ''),
        el('div', {}, 'Last connected ', el('b', { text: m.last_seen ? new Date(m.last_seen).toLocaleString() : 'never' }), m.online ? ' · online now' : ''),
        el('div', {}, 'This month ', el('b', { text: `${hours(m.usage.sec)} h, ${gb(m.usage.in + m.usage.out)}, ${m.usage.sessions} sessions` })),
        el('div', {}, 'Last month ', el('b', { text: `${hours(m.usage_last.sec)} h, ${gb(m.usage_last.in + m.usage_last.out)}, ${m.usage_last.sessions} sessions` }))),
      el('div', {}, el('span', { class: 'addr', text: m.link }), ' ', el('button', { type: 'button', class: 'small', text: 'Copy', onclick: () => navigator.clipboard.writeText(m.link).then(() => toast('Copied.')) })),
      el('label', { for: 'eStatus', text: 'Status' }), statusSel,
      el('div', { class: 'hint', text: 'Suspended and Blocked disconnect them now. Suspended Session Masters see “paused”; Blocked ones see that the account can\'t use this relay.' }),
      el('label', { for: 'ePlan', text: 'Plan' }), planSel,
      el('label', { for: 'eName', text: 'Players\' address' }), el('input', { id: 'eName', value: m.name, maxlength: 32 }),
      el('div', { class: 'hint', text: 'Lowercase letters, digits and dashes. The new address works the next time their IPRPS Link connects; tell them to send players the new link.' }),
      el('label', { text: 'Their own limits (empty = the plan\'s)' }),
      el('div', { class: 'three' },
        el('label', {}, 'Hours a month', num('eH', lim.hours_per_month, shown(plans[m.plan]?.hours_per_month))),
        el('label', {}, 'GB a month', num('eG', lim.gb_per_month, shown(plans[m.plan]?.gb_per_month))),
        el('label', {}, 'Upload MB', num('eU', lim.max_upload_mb, String(plans[m.plan]?.max_upload_mb ?? '')))),
      el('div', { class: 'hint', text: `In effect: ${shown(eff.hours_per_month)} hours, ${shown(eff.gb_per_month)} GB a month, uploads up to ${eff.max_upload_mb} MB.` }),
      el('label', { for: 'eNote', text: 'Note (only you see it)' }), el('input', { id: 'eNote', value: m.note, maxlength: 1000 }),
      el('div', { class: 'actions' },
        el('button', { class: 'primary', text: 'Save', onclick: () => save(m) }),
        el('button', { text: 'Disconnect now', disabled: !m.online, title: 'Ends their connection; IPRPS Link reconnects by itself if they are still allowed', onclick: () => disconnect(m) }),
        el('button', { class: 'danger', text: 'Delete', onclick: () => remove(m) }),
        el('button', { text: 'Close', onclick: () => { SEL = null; $('#editor').hidden = true; renderList(); } })),
      el('p', { class: 'err', id: 'eErr' }));
    ed.hidden = false;
  }
  async function change(m, body, msg) { try { await api('update', { id: m.id, ...body }); toast(msg); await refresh(); } catch (e) { toast(e.message, true); } }
  async function save(m) {
    const v = id => $(id).value.trim();
    const body = { id: m.id, status: v('#eStatus'), plan: v('#ePlan'), name: v('#eName').toLowerCase(), note: v('#eNote'), limits: { hours_per_month: v('#eH'), gb_per_month: v('#eG'), max_upload_mb: v('#eU') } };
    if (body.status !== 'active' && m.status === 'active' && !confirm(`${STATUS[body.status]}: ${m.display || m.username} is disconnected now and can't reconnect. Continue?`)) return;
    try { await api('update', body); $('#eErr').textContent = ''; toast('Saved.'); await refresh(); } catch (e) { $('#eErr').textContent = e.message; }
  }
  async function disconnect(m) { try { await api('disconnect', { id: m.id }); toast('Disconnected. If they are still allowed, IPRPS Link reconnects by itself.'); await refresh(); } catch (e) { toast(e.message, true); } }
  async function remove(m) {
    if (!confirm(`Delete ${m.display || m.username}?\n\nTheir record, address and usage are removed. With open sign-up they are added again the next time their IPRPS Link connects; to keep them out, choose Blocked instead.`)) return;
    try { await api('delete', { id: m.id }); SEL = null; $('#editor').hidden = true; toast('Deleted.'); await refresh(); } catch (e) { toast(e.message, true); }
  }

  // ---------- pre-set accounts ----------
  async function loadInvites() {
    try { INV = (await api('invites')).invites; } catch (e) { toast(e.message, true); return; }
    const plans = OV ? OV.settings.plans : {};
    $('#invRows').replaceChildren(...INV.map(i => el('tr', {},
      el('td', { text: i.who }), el('td', { text: (plans[i.plan] || {}).label || i.plan }), el('td', {}, el('span', { class: 'st st-' + i.status, text: STATUS[i.status] })),
      el('td', { text: i.name || 'from the username' }), el('td', { text: i.note || '' }), el('td', { text: when(i.created) }),
      el('td', {}, el('button', { class: 'small danger', text: 'Remove', onclick: async () => { try { await api('uninvite', { key: i.key }); loadInvites(); refresh(); } catch (e) { toast(e.message, true); } } })))));
    if (!INV.length) $('#invRows').append(el('tr', {}, el('td', { colspan: 7, class: 'hint', text: 'None.' })));
  }
  $('#inviteForm').onsubmit = async e => {
    e.preventDefault();
    try { await api('invite', { who: $('#iWho').value.trim(), plan: $('#iPlan').value, status: $('#iStatus').value, name: $('#iName').value.trim().toLowerCase(), note: $('#iNote').value.trim() }); $('#iErr').textContent = ''; e.target.reset(); $('#iPlan').value = OV.settings.default_plan; toast('Added.'); loadInvites(); refresh(); }
    catch (er) { $('#iErr').textContent = er.message; }
  };

  // ---------- settings ----------
  function renderSettings() {
    if (!OV) return; const s = OV.settings;
    document.querySelectorAll('input[name=access]').forEach(r => r.checked = r.value === s.access);
    $('#ownersList').textContent = OV.owners.length ? OV.owners.join(', ') : '(none listed: the first account to connect owns the relay)';
    $('#sMax').value = s.max_online_tables; $('#sFriendly').checked = !!s.friendly_links; $('#sContact').value = s.contact || '';
    $('#planRows').replaceChildren(...Object.entries(s.plans).map(([k, p]) => planRow(k, p, k === s.default_plan)));
  }
  function planRow(k, p, def) {
    const n = (cls, v) => el('input', { class: cls, type: 'number', min: 0, step: 'any', value: v ?? 0 });
    return el('tr', {}, el('td', {}, el('input', { class: 'pk', value: k, maxlength: 20, pattern: '[a-z0-9_-]+' })), el('td', {}, el('input', { class: 'pl', value: p.label || k, maxlength: 40 })),
      el('td', {}, n('ph', p.hours_per_month)), el('td', {}, n('pg', p.gb_per_month)), el('td', {}, n('pu', p.max_upload_mb)),
      el('td', {}, el('input', { type: 'radio', name: 'defplan', checked: def, 'aria-label': 'Default plan' })),
      el('td', {}, el('button', { type: 'button', class: 'small danger', text: 'Remove', onclick: e => e.target.closest('tr').remove() })));
  }
  $('#addPlan').onclick = () => $('#planRows').append(planRow('', { label: '', hours_per_month: 0, gb_per_month: 0, max_upload_mb: 20 }, false));
  $('#setForm').onsubmit = async e => {
    e.preventDefault();
    const plans = {}; let def = '';
    for (const tr of $('#planRows').children) {
      const k = tr.querySelector('.pk').value.trim().toLowerCase(); if (!k) continue;
      plans[k] = { label: tr.querySelector('.pl').value.trim() || k, hours_per_month: +tr.querySelector('.ph').value || 0, gb_per_month: +tr.querySelector('.pg').value || 0, max_upload_mb: +tr.querySelector('.pu').value || 0 };
      if (tr.querySelector('input[name=defplan]').checked) def = k;
    }
    const used = new Set(LIST.map(m => m.plan)); const gone = [...used].filter(p => !plans[p]);
    if (gone.length && !confirm(`Session Masters are on plan${gone.length > 1 ? 's' : ''} ${gone.join(', ')}, which you removed. They get the default plan's limits until you move them. Continue?`)) return;
    const settings = { access: (document.querySelector('input[name=access]:checked') || {}).value, max_online_tables: +$('#sMax').value || 0, friendly_links: $('#sFriendly').checked,
      contact: $('#sContact').value.trim(), plans, default_plan: def || Object.keys(plans)[0] };
    try { await api('settings', { settings }); $('#sErr').textContent = ''; toast('Settings saved.'); await refresh(); renderSettings(); } catch (er) { $('#sErr').textContent = er.message; }
  };

  // ---------- activity ----------
  let EVENTS = [];
  $('#fType').oninput = renderLog;
  async function loadLog() { try { EVENTS = (await api('log')).events; renderLog(); } catch (e) { toast(e.message, true); } }
  function describe(e) {
    const who = e.user || e.who || e.id || '';
    switch (e.type) {
      case 'register': return `New Session Master ${who} (${STATUS[e.status] || e.status}, plan ${e.plan})`;
      case 'connect': return `${who} turned remote play on`;
      case 'refused': return `${who} was refused: ${{ blocked: 'blocked', suspended: 'suspended', pending: 'waiting for approval', hours: 'monthly hours used up', data: 'monthly data used up' }[e.why] || e.why}`;
      case 'full': return `${who} could not connect: the relay was full`;
      case 'admin-update': { const c = []; if (e.status) c.push('status ' + (STATUS[e.status] || e.status)); if (e.plan) c.push('plan ' + e.plan); if (e.name) c.push('address ' + e.name); if (e.limits) c.push('limits'); if (e.note) c.push('note'); return `${e.by} changed ${who}: ${c.join(', ') || 'nothing'}`; }
      case 'admin-disconnect': return `${e.by} disconnected ${who}`;
      case 'admin-delete': return `${e.by} deleted ${who}`;
      case 'admin-invite': return `${e.by} pre-set ${who} (${STATUS[e.status] || e.status}, plan ${e.plan})`;
      case 'admin-uninvite': return `${e.by} removed a pre-set account`;
      case 'admin-settings': return `${e.by} changed settings: ${(e.changed || []).join(', ')}`;
      case 'admin-refused': return `${who} tried to open this dashboard and was refused`;
      default: return e.type;
    }
  }
  function renderLog() {
    const f = $('#fType').value;
    const list = EVENTS.filter(e => !f || (f === 'admin' ? e.type.startsWith('admin') : e.type === f));
    $('#log').replaceChildren(...list.map(e => el('li', {}, el('time', { datetime: e.t, text: new Date(e.t).toLocaleString() }), el('span', { text: describe(e) }))));
    if (!list.length) $('#log').append(el('li', { class: 'hint', text: 'Nothing yet.' }));
  }

  // ---------- start ----------
  function start() {
    if (!RELAY) { $('#banner').textContent = 'Set the relay\'s address in config.js.'; $('#banner').hidden = false; return; }
    refresh();
    clearInterval(TIMER); TIMER = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  }
  if (window.IPAuth && window.IPAuth.user) start(); else document.addEventListener('ipauth:ready', start);
})();
