// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Dice Roller - front end. Dice rules: ../iprps-lib/dice.js (the same as the IPRPS Table's).
(() => {
  'use strict';
  const { $, h, act } = IP;
  let picker, presets = [], weapons = [], history = IP.store.get('dice.history', []);

  // ---------------------------------------------------------------- show one result
  async function done(r, label) {
    const who = $('who2').value.trim() || 'Session Master';
    const secret = $('secret').checked;
    const res = $('result');
    $('rTotal').textContent = r.total === null || r.total === undefined ? '✦' : r.total;
    $('rLabel').textContent = `${who}: ${label}`;
    $('rDetail').textContent = r.detail;
    const dl = $('rLines'); dl.textContent = '';
    for (const [k, v] of r.lines || []) dl.append(h('dt', { text: k }), h('dd', { text: v }));
    res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop');
    const entry = { ts: Date.now(), who, label, total: r.total ?? null, detail: r.detail, lines: r.lines || [], secret };
    history.unshift(entry); history = history.slice(0, 100); IP.store.set('dice.history', history); renderHistory();
    if (secret) return;
    const text = `${who}: ${label}${r.total !== null && r.total !== undefined ? ' = ' + r.total : ''} — ${r.detail}${(r.lines || []).length ? '; ' + r.lines.map(([k, v]) => `${k}: ${v}`).join('; ') : ''}`;
    const jobs = [];
    if ($('logIt').checked) {
      if (!picker.state.session) IP.toast('Not logged: choose a campaign and session at the top (or + Session).', true);
      else jobs.push(IP.lib('log_add', { session_id: picker.state.session, kind: 'roll', text }));
    }
    if ($('showDisp').checked || $('showTable').checked) {
      const body = [r.total !== null && r.total !== undefined ? `${r.total}` : '', r.detail, ...(r.lines || []).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('\n');
      jobs.push(IP.lib('show', { title: `${who}: ${label}`, text: body, campaign: picker.state.campaign, display: $('showDisp').checked, table: $('showTable').checked })
        .then(x => { if (x.table && !x.table.ok) IP.toast(x.table.error, true); }));
    }
    await Promise.all(jobs);
  }
  const roll = fn => act(async () => { const [r, label] = fn(); await done(r, label); });

  // ---------------------------------------------------------------- dice and expressions
  for (const n of [4, 6, 8, 10, 12, 20, 100]) {
    $('quick').append(h('button', { text: `d${n}`, title: `Roll d${n} (with How many and Modifier)`, onclick: roll(() => {
      const c = Math.max(1, Math.min(20, +$('qCount').value || 1)), m = +$('qMod').value || 0;
      const expr = `${c}d${n}${m ? (m > 0 ? '+' : '') + m : ''}`;
      const r = IPDice.rollExpr(expr);
      if (c === 1 && n === 20) r.lines = [['Band A', IPDice.bandA(+r.detail.match(/\[(\d+)\]/)[1])], ['Band B', IPDice.bandB(+r.detail.match(/\[(\d+)\]/)[1])]];
      return [r, r.expr];
    }) }));
  }
  $('exprBtn').onclick = roll(() => { const r = IPDice.rollExpr($('expr').value); return [r, r.expr]; });
  $('expr').addEventListener('keydown', e => { if (e.key === 'Enter') $('exprBtn').click(); });

  // ---------------------------------------------------------------- IPRPS rolls (presets)
  function presetOf(id) {
    if (id.startsWith('weapon:')) { const w = weapons.find(x => 'weapon:' + x.name === id); return w && { id, kind: 'weapon', label: `${w.name} damage`, expr: w.expr, help: `Damage ${w.expr}. Armor Rating comes off the damage (Damage − AR).` }; }
    return presets.find(p => p.id === id);
  }
  function showFields() {
    const p = presetOf($('preset').value); const box = $('fields'); box.textContent = '';
    $('presetHelp').textContent = p ? p.help || '' : '';
    if (!p) return;
    const saved = IP.store.get('dice.p:' + p.id, {});
    for (const [key, label, def, a, b] of (IPDice.KINDS[p.kind] || { fields: [] }).fields) {
      const v = saved[key] !== undefined ? saved[key] : def;
      const inp = Array.isArray(a) ? h('select', { name: key }, a.map(o => h('option', { value: o, text: o[0].toUpperCase() + o.slice(1) })))
                                   : h('input', { name: key, type: 'number', min: a, max: b });
      inp.value = v;
      box.append(h('label', {}, label, inp));
    }
  }
  $('preset').onchange = () => { IP.store.set('dice.preset', $('preset').value); showFields(); };
  $('presetBtn').onclick = roll(() => {
    const p = presetOf($('preset').value); if (!p) throw new Error('Choose a roll');
    const params = {}; $('fields').querySelectorAll('[name]').forEach(i => { params[i.name] = i.value; });
    IP.store.set('dice.p:' + p.id, params);
    return [IPDice.rollPreset(p, params), p.label];
  });

  // ---------------------------------------------------------------- history
  function renderHistory() {
    const ol = $('history'); ol.textContent = '';
    if (!history.length) ol.append(h('li', { class: 'none', text: 'No rolls yet.' }));
    for (const e of history) ol.append(h('li', { class: e.secret ? 'secret' : '', title: (e.lines || []).map(([k, v]) => `${k}: ${v}`).join('\n') },
      e.total !== null ? h('b', { text: e.total }) : h('b', { text: '✦' }), `${e.who}: ${e.label}`,
      h('small', { text: `${new Date(e.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${e.secret ? ' · secret' : ''} · ${e.detail}` })));
  }
  $('clearHist').onclick = () => { history = []; IP.store.set('dice.history', history); renderHistory(); };

  // ---------------------------------------------------------------- settings kept in this browser
  for (const id of ['logIt', 'showDisp', 'showTable', 'secret']) {
    $(id).checked = IP.store.get('dice.' + id, id === 'logIt');
    $(id).onchange = () => IP.store.set('dice.' + id, $(id).checked);
  }
  $('who2').value = IP.store.get('dice.who', '');
  $('who2').onchange = () => IP.store.set('dice.who', $('who2').value);
  renderHistory();

  IP.boot(async () => {
    picker = IP.picker($('picker'), { sessions: true, key: 'session-tools', onChange: st => loadNames(st).catch(() => {}) });
    try {
      const j = await IP.api('presets');
      presets = j.presets; weapons = j.weapons;
    } catch (e) { IP.toast(e.message, true); }
    const sel = $('preset'); sel.textContent = '';
    sel.append(h('optgroup', { label: 'IPRPS rolls' }, presets.map(p => h('option', { value: p.id, text: p.label }))));
    if (weapons.length) sel.append(h('optgroup', { label: 'Weapon damage' }, weapons.map(w => h('option', { value: 'weapon:' + w.name, text: `${w.name} (${w.expr})` }))));
    const last = IP.store.get('dice.preset', ''); if (last && presetOf(last)) sel.value = last;
    showFields();
    await picker.ready;
  });
  // Character names for "Who rolls" (from Character Sheets, when installed)
  async function loadNames(st) {
    const dl = $('names'); dl.textContent = '';
    if (!st.campaign || !IP.status.sheets) return;
    const j = await IP.api('sheets', null, `&campaign=${st.campaign}`, '../combat/api.php');
    for (const s of j.sheets) dl.append(h('option', { value: s.name }));
  }
})();
