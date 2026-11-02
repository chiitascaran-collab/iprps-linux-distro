// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Initiative and Combat Tracker - front end.
(() => {
  'use strict';
  const { $, h, act } = IP;
  const MODE_HELP = {
    standard: 'Mode 1 · Standard: initiative 1d20 + DEX modifier; attack 1d20 + Skill Shift + Attribute Shift vs Guard. Defenses: Dodge, Parry, Block, Magick Defense; repeated defenses get harder. Damage − AR.',
    trinity: 'Mode 2 · Trinity Hand (bosses, hordes, PvP): everyone rolls 1d3 Velocity + 1d20 Impact + 1d12 Guard at once. Fastest acts first; Impact vs Guard; the Impact d20 sets the Effectiveness band. Bosses roll extra Impact dice (Hydra Hand).',
    rps: 'Mode 3 · Rock-Paper-Scissors (quick skirmishes): Rock (heavy) beats Scissors (precision), Scissors beats Paper (magick, ranged), Paper beats Rock. Winner: base damage × 1.5 − defense; tie: both × 0.5; loser: no damage.',
    dual: 'Mode 4 · Dual-Die (gritty): 1d20 + Attribute + Skill vs Guard; on a hit roll 1d6 Impact: 1–2 Glancing (−1 next action), 3–4 Solid (−2 all actions for 1d6 rounds, bleeding), 5–6 Critical (incapacitated unless CON Effectiveness 15+).',
    convergence: 'Mode 5 · Infinite Convergence (one decisive clash): each side picks a Blur level (0 Glacial 1d50 … 6 Flurry 6d4); dice + Attribute + Skill (capped by the Blur level) = total, highest wins; maximum dice explode.',
  };
  const CONDITIONS = ['Bleeding', 'Stunned', 'Prone', 'Grappled', 'Poisoned', 'Blinded', 'Frightened', 'Berserk', 'Unconscious', 'Hidden',
    'Concentrating', 'Glancing (−1 next action)', 'Solid (−2, 1d6 rounds)'];
  const SIDES = ['party', 'ally', 'foe', 'neutral'];
  let picker, encounters = [], enc = null, rows = [], sheets = [], currentId = null;

  const api = (a, b, p) => IP.api(a, b, p);
  const status = r => (r.hp_max ? (r.hp <= 0 ? 'Down' : r.hp / r.hp_max <= 0.25 ? 'Near death' : r.hp / r.hp_max <= 0.5 ? 'Bloodied' : r.hp < r.hp_max ? 'Hurt' : 'Unhurt') : '');
  const alive = () => rows.filter(r => !r.defeated);
  const sessionId = () => picker.state.session;
  const log = (kind, text) => (sessionId() ? IP.lib('log_add', { session_id: sessionId(), kind, text }).catch(e => IP.toast(e.message, true)) : null);

  // ---------------------------------------------------------------- encounters
  async function loadEncounters(selectId) {
    encounters = sessionId() ? (await api('encounters', null, `&session=${sessionId()}`)).encounters : [];
    const ul = $('encList'); ul.textContent = '';
    $('newEnc').disabled = !sessionId();
    if (!picker.state.campaign) ul.append(h('li', { class: 'none', text: 'Choose a campaign.' }));
    else if (!sessionId()) ul.append(h('li', { class: 'none', text: 'Start a session first (+ Session).' }));
    else if (!encounters.length) ul.append(h('li', { class: 'none', text: 'No encounters yet.' }));
    for (const e of encounters) {
      ul.append(h('li', { class: enc && enc.id === e.id ? 'on' : '', onclick: () => openEnc(e.id) },
        h('b', { text: e.name }), e.active ? h('span', { class: 'live', text: ' ● live' }) : null,
        h('small', { text: `${e.combatants} combatant${e.combatants === 1 ? '' : 's'}${e.round_no ? ` · round ${e.round_no}` : ''}` })));
    }
    const has = id => encounters.some(e => e.id === id);
    const want = has(selectId) ? selectId : enc && has(enc.id) ? enc.id : (encounters.find(e => e.active) || encounters[0] || {}).id;
    if (want) await openEnc(want); else { enc = null; render(); }
  }
  async function openEnc(id) {
    const j = await api('encounter', null, `&id=${id}`);
    enc = j.encounter; rows = j.combatants;
    currentId = enc.active && rows[enc.turn_idx] ? rows[enc.turn_idx].id : null;
    IP.store.set('combat.enc', id);
    document.querySelectorAll('#encList li').forEach((li, i) => li.classList.toggle('on', encounters[i] && encounters[i].id === id));
    render();
  }
  $('newEnc').onclick = act(async () => {
    const name = prompt('Name the encounter:', `Encounter ${encounters.length + 1}`);
    if (!name) return;
    const j = await api('encounter_save', { session_id: sessionId(), name, mode: enc ? enc.mode : 'standard' });
    await loadEncounters(j.id);
  });
  $('delEnc').onclick = act(async () => {
    if (!confirm(`Delete the encounter “${enc.name}” and its combatants? The session log keeps what was logged.`)) return;
    await api('encounter_delete', { id: enc.id }); enc = null; await loadEncounters();
  });
  $('encName').onchange = act(async () => { await api('encounter_save', { id: enc.id, name: $('encName').value, mode: enc.mode, notes: enc.notes }); enc.name = $('encName').value; loadEncounters(enc.id); });
  $('encMode').onchange = act(async () => { enc.mode = $('encMode').value; await api('encounter_save', { id: enc.id, name: enc.name, mode: enc.mode, notes: enc.notes }); render(); });

  // ---------------------------------------------------------------- turns
  async function setState(active, round, turnIdx) {
    const j = await api('state', { id: enc.id, active, round_no: round, turn_idx: turnIdx });
    enc = j.encounter;
    currentId = active && rows[turnIdx] ? rows[turnIdx].id : null;
    render();
    if (active && $('autoShow').checked) IP.pushQuiet(enc.name, orderText(), picker.state.campaign);
  }
  function fixTurnAfterReorder() {
    if (!enc.active || currentId === null) return;
    const i = rows.findIndex(r => r.id === currentId);
    if (i >= 0 && i !== enc.turn_idx) { enc.turn_idx = i; api('state', { id: enc.id, active: true, round_no: enc.round_no, turn_idx: i }).catch(() => {}); }
  }
  async function rollMissing(all) {
    const todo = rows.filter(r => all || !r.rolled);
    if (!todo.length) return false;
    const res = todo.map(r => { const d = IPDice.roll(20); return { id: r.id, initiative: d + r.init_mod, d }; });
    rows = (await api('order', { encounter_id: enc.id, rows: res })).combatants;
    fixTurnAfterReorder();
    IP.toast(res.map(x => `${rows.find(r => r.id === x.id).label} ${x.initiative}`).join(' · '));
    return true;
  }
  $('rollInit').onclick = act(async () => {
    if (!rows.length) return IP.toast('Add combatants first.', true);
    if (!(await rollMissing(false))) { if (!confirm('Everyone has initiative. Roll again for everyone?')) return; await rollMissing(true); }
    render();
  });
  $('startBtn').onclick = act(async () => {
    if (!alive().length) return IP.toast('Add combatants first.', true);
    await rollMissing(false);
    const first = rows.findIndex(r => !r.defeated);
    log('combat', `Combat started: ${enc.name} (${$('encMode').selectedOptions[0].textContent.replace(/^\d · /, '')}). Order: ${rows.filter(r => !r.defeated).map(r => `${r.label} ${r.initiative}`).join(', ')}.`);
    await setState(true, 1, first);
  });
  async function step(dir) {
    if (!enc.active) return;
    const n = rows.length;
    let i = enc.turn_idx, round = enc.round_no;
    for (let k = 0; k < n; k++) {
      i += dir;
      if (i >= n) { i = 0; round++; }
      if (i < 0) { i = n - 1; round = Math.max(1, round - 1); }
      if (!rows[i].defeated) break;
    }
    if (rows[i].defeated) return IP.toast('Everyone is down.', true);
    await setState(true, round, i);
  }
  $('nextBtn').onclick = act(() => step(1));
  $('prevBtn').onclick = act(() => step(-1));
  $('endBtn').onclick = act(async () => {
    if (!confirm('End this combat?')) return;
    const down = rows.filter(r => r.defeated).map(r => r.label), up = alive().map(r => r.label + (r.hp_max ? ` (${Math.max(0, r.hp)}/${r.hp_max} HP)` : ''));
    log('combat', `Combat ended: ${enc.name}, after ${enc.round_no} round${enc.round_no === 1 ? '' : 's'}.${down.length ? ' Down: ' + down.join(', ') + '.' : ''}${up.length ? ' Standing: ' + up.join(', ') + '.' : ''}`);
    await setState(false, enc.round_no, 0);
  });
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && enc && enc.active) { e.preventDefault(); step(1).catch(err => IP.toast(err.message, true)); }
  });

  // ---------------------------------------------------------------- showing the order to players
  function orderText() {
    const lines = [];
    rows.forEach((r, i) => {
      if (r.defeated) return;
      const mark = enc.active && i === enc.turn_idx ? '▶ ' : '   ';
      const hp = r.hp_max ? (r.side === 'party' ? ` — ${Math.max(0, r.hp)}/${r.hp_max} HP` : ` — ${status(r)}`) : '';
      const cond = r.conditions.length ? ` [${r.conditions.join(', ')}]` : '';
      lines.push(`${mark}${r.label}${hp}${cond}`);
    });
    const down = rows.filter(r => r.defeated).map(r => r.label);
    const head = enc.active ? `Round ${enc.round_no}${rows[enc.turn_idx] ? ` — ${rows[enc.turn_idx].label}'s turn` : ''}` : 'Turn order';
    return [head, '', ...lines, down.length ? `\nDown: ${down.join(', ')}` : ''].join('\n').trim();
  }
  $('showBtn').onclick = act(() => IP.showToPlayers(enc.name, orderText(), picker.state.campaign));

  // ---------------------------------------------------------------- combatant rows
  async function update(r, fields, note) {
    rows = (await api('update', { id: r.id, ...fields })).combatants;
    if ('initiative' in fields) fixTurnAfterReorder();
    if (note && enc.active) log('combat', note);
    render();
  }
  async function hurt(r, amount, heal) {
    amount = Math.abs(parseInt(amount, 10) || 0); if (!amount) return;
    if (r.hp === null) return IP.toast(`Give ${r.label} HP first (click the HP box).`, true);
    let hp, note = null, defeated = r.defeated;
    if (heal) { hp = r.hp_max ? Math.min(r.hp_max, r.hp + amount) : r.hp + amount; if (hp > 0) defeated = false; }
    else {
      const dmg = $('useAr').checked ? Math.max(0, amount - r.ar) : amount;
      hp = r.hp - dmg;
      if (dmg === 0) IP.toast(`${r.label}'s armor (AR ${r.ar}) stops all ${amount} damage.`);
      if (hp <= 0 && !r.defeated) { defeated = true; note = `${r.label} is down (round ${enc.round_no || '—'}).`; }
    }
    await update(r, { hp, defeated }, note);
  }
  function condControl(r) {
    const sel = h('select', { title: 'Add a condition', 'aria-label': 'Add a condition' }, h('option', { value: '', text: '+ condition' }),
      CONDITIONS.filter(c => !r.conditions.includes(c)).map(c => h('option', { value: c, text: c })), h('option', { value: '*', text: 'Other…' }));
    sel.onchange = act(async () => {
      let c = sel.value; sel.value = '';
      if (c === '*') c = (prompt('Condition:') || '').trim();
      if (c) await update(r, { conditions: [...r.conditions, c] });
    });
    return h('div', { class: 'conds' }, r.conditions.map(c => h('span', { class: 'chip' }, c,
      h('button', { type: 'button', text: '×', title: 'Remove', onclick: act(() => update(r, { conditions: r.conditions.filter(x => x !== c) })) }))), sel);
  }
  function render() {
    $('emptyMsg').hidden = !!enc; $('tracker').hidden = !enc;
    if (!enc) return;
    if (document.activeElement !== $('encName')) $('encName').value = enc.name;
    $('encMode').value = enc.mode; $('modeHelp').textContent = MODE_HELP[enc.mode] || '';
    $('roundNo').textContent = enc.active ? enc.round_no : '—';
    $('startBtn').hidden = enc.active; $('nextBtn').hidden = $('prevBtn').hidden = $('endBtn').hidden = !enc.active;
    const ol = $('order'); ol.textContent = '';
    if (!rows.length) ol.append(h('li', { class: 'none', style: { display: 'block' }, text: 'No combatants yet. Add them from the panel on the right.' }));
    rows.forEach((r, i) => {
      const turn = enc.active && i === enc.turn_idx;
      const init = h('input', { class: 'init' + (r.rolled ? '' : ' unrolled'), type: 'number', value: r.rolled ? r.initiative : '', placeholder: 'roll', title: `Initiative (d20 ${IP.shift(r.init_mod)})` });
      init.onchange = act(() => update(r, { initiative: +init.value || 0 }));
      const name = h('input', { value: r.label, maxlength: 120, 'aria-label': 'Name' });
      name.onchange = act(() => update(r, { label: name.value }));
      const sideB = h('button', { type: 'button', class: 'side-b ' + r.side, text: r.side, title: 'Side (click to change)',
        onclick: act(() => update(r, { side: SIDES[(SIDES.indexOf(r.side) + 1) % SIDES.length] })) });
      const hpIn = h('input', { type: 'number', value: r.hp ?? '', placeholder: '—', title: 'Current HP' });
      hpIn.onchange = act(() => update(r, r.hp_max === null && hpIn.value !== '' ? { hp: +hpIn.value, hp_max: Math.max(1, +hpIn.value) } : { hp: hpIn.value === '' ? null : +hpIn.value }));
      const maxB = h('button', { type: 'button', class: 'icon max', text: r.hp_max ? `/ ${r.hp_max}` : '/ —', title: 'Maximum HP (click to change)',
        onclick: act(async () => { const v = prompt(`Maximum HP for ${r.label}:`, r.hp_max ?? ''); if (v !== null && +v > 0) await update(r, { hp_max: +v, ...(r.hp === null ? { hp: +v } : {}) }); }) });
      const pct = r.hp_max ? Math.max(0, Math.min(100, (r.hp / r.hp_max) * 100)) : 0;
      const dmg = h('input', { type: 'number', min: 0, placeholder: 'dmg', 'aria-label': 'Damage or healing' });
      dmg.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); hurt(r, dmg.value, false).catch(err => IP.toast(err.message, true)); } });
      const ar = h('input', { type: 'number', min: 0, value: r.ar, title: 'Armor Rating' });
      ar.onchange = act(() => update(r, { ar: +ar.value || 0 }));
      ol.append(h('li', { class: `${r.side}${turn ? ' turn' : ''}${r.defeated ? ' down' : ''}`, dataset: { id: r.id } },
        h('div', {}, init),
        h('div', {}, h('div', { class: 'nm' }, h('span', { class: 'turnmark', text: turn ? '▶' : '' }), name, sideB),
          h('span', { class: 'sub', text: [r.sheet_id ? '📜 from sheet' : '', r.init_mod ? `init ${IP.shift(r.init_mod)}` : '', status(r), r.notes || ''].filter(Boolean).join(' · ') })),
        h('div', { class: 'hp' }, h('div', { class: 'hpn' }, hpIn, maxB), r.hp_max ? h('div', { class: 'hpbar' }, h('i', { class: pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '', style: { width: pct + '%' } })) : null),
        h('div', { class: 'dmg' }, dmg, h('button', { type: 'button', class: 'small', text: '−', title: 'Damage' + ($('useAr').checked ? ' (minus AR)' : ''), onclick: act(() => hurt(r, dmg.value, false)) }),
          h('button', { type: 'button', class: 'ghost small', text: '+', title: 'Heal', onclick: act(() => hurt(r, dmg.value, true)) })),
        h('div', { class: 'ar' }, ar),
        condControl(r),
        h('div', { class: 'btns' },
          h('button', { type: 'button', class: 'icon', text: r.defeated ? '↺' : '☠', title: r.defeated ? 'Back in the fight' : 'Mark as down',
            onclick: act(() => update(r, { defeated: !r.defeated }, r.defeated ? `${r.label} is back in the fight.` : `${r.label} is down (round ${enc.round_no || '—'}).`)) }),
          h('button', { type: 'button', class: 'icon danger', text: '×', title: 'Remove from the encounter',
            onclick: act(async () => { if (!confirm(`Remove ${r.label}?`)) return; const cur = currentId; rows = (await api('remove', { id: r.id })).combatants; if (cur !== r.id) fixTurnAfterReorder(); render(); }) }))));
    });
  }

  // ---------------------------------------------------------------- adding combatants
  document.querySelectorAll('#addTabs button').forEach(b => { b.onclick = () => {
    document.querySelectorAll('#addTabs button').forEach(x => x.classList.toggle('on', x === b));
    $('tabSheets').hidden = b.dataset.tab !== 'sheets'; $('tabQuick').hidden = b.dataset.tab !== 'quick';
  }; });
  function nextLabels(base, count) {
    if (count <= 1 && !rows.some(r => r.label === base)) return [base];
    const re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' (\\d+)$');
    let n = Math.max(0, ...rows.map(r => (r.label.match(re) || [0, 0])[1] | 0), rows.some(r => r.label === base) ? 1 : 0);
    return Array.from({ length: count }, () => `${base} ${++n}`);
  }
  async function addItems(items) {
    if (!enc) return IP.toast('Make or choose an encounter first.', true);
    const j = await api('add', { encounter_id: enc.id, items });
    rows = j.combatants; fixTurnAfterReorder(); render(); loadEncounters(enc.id);
    IP.toast(`Added ${j.added}`);
    if (enc.active) log('combat', `${items.map(i => i.label).join(', ')} joined the fight (round ${enc.round_no}).`);
  }
  function sheetItem(s, label) {
    const side = $('sheetSide').value === 'auto' ? (s.kind === 'pc' ? 'party' : 'foe') : $('sheetSide').value;
    return { label, hp: s.hp, hp_max: s.hp, ar: s.ar, init_mod: s.dex - 10, side, sheet_id: s.id };
  }
  async function loadSheets() {
    sheets = [];
    if (picker.state.campaign) {
      const j = await api('sheets', null, `&campaign=${picker.state.campaign}`);
      sheets = j.sheets;
      $('sheetNote').textContent = j.installed ? 'Sheets of this campaign, then your library (sheets with no campaign).' : 'Character Sheets is not installed: use Quick add.';
    }
    renderSheets();
  }
  function renderSheets() {
    const q = $('sheetSearch').value.trim().toLowerCase(), ul = $('sheetList'); ul.textContent = '';
    const list = sheets.filter(s => !q || s.name.toLowerCase().includes(q));
    let grp = null;
    for (const s of list) {
      const g = s.in_campaign ? 'This campaign' : 'Library';
      if (g !== grp) { ul.append(h('li', { class: 'grp', text: g })); grp = g; }
      const count = s.kind === 'pc' ? null : h('input', { type: 'number', min: 1, max: 30, value: 1, style: { width: '46px' }, title: 'How many' });
      ul.append(h('li', {}, h('div', {}, h('b', { text: s.name }), ' ', h('span', { class: 'kind', text: s.kind }),
        h('small', { text: [s.hp ? `HP ${s.hp}` : '', `AR ${s.ar}`, `DEX ${s.dex} (${IP.shift(s.dex - 10)})`, s.player_name ? `👤 ${s.player_name}` : ''].filter(Boolean).join(' · ') })),
        h('div', { class: 'row' }, count, h('button', { class: 'small', text: '+', title: 'Add to the encounter',
          onclick: act(() => addItems(nextLabels(s.name, count ? +count.value || 1 : 1).map(l => sheetItem(s, l)))) }))));
    }
    if (!list.length) ul.append(h('li', { class: 'none', text: picker.state.campaign ? 'No sheets found.' : 'Choose a campaign.' }));
  }
  $('sheetSearch').oninput = renderSheets;
  $('addParty').onclick = act(async () => {
    const party = sheets.filter(s => s.kind === 'pc' && s.in_campaign && !rows.some(r => r.sheet_id === s.id));
    if (!party.length) return IP.toast('No player character sheets in this campaign (or they are all added).', true);
    await addItems(party.map(s => ({ ...sheetItem(s, s.name), side: 'party' })));
  });
  $('tabQuick').onsubmit = act(async e => {
    e.preventDefault();
    const f = new FormData($('tabQuick'));
    const base = String(f.get('label')).trim(), count = Math.max(1, Math.min(30, +f.get('count') || 1));
    const hp = f.get('hp') ? +f.get('hp') : null, init = f.get('initiative');
    await addItems(nextLabels(base, count).map(label => ({ label, hp, hp_max: hp, ar: +f.get('ar') || 0, init_mod: +f.get('init_mod') || 0, side: f.get('side'),
      initiative: init === '' ? null : +init })));
    $('tabQuick').label.value = ''; $('tabQuick').label.focus();
  });

  // ---------------------------------------------------------------- quick roll
  $('qRoll').onclick = act(async () => {
    const r = IPDice.rollExpr($('qExpr').value);
    $('qOut').textContent = ''; $('qOut').append(h('b', { text: r.total }), r.detail);
    if ($('qLog').checked) await log('roll', `${r.expr} = ${r.total} (${r.detail})${enc ? ' — ' + enc.name : ''}`);
  });
  $('qExpr').addEventListener('keydown', e => { if (e.key === 'Enter') $('qRoll').click(); });
  $('useAr').onchange = render;
  $('autoShow').checked = IP.store.get('combat.autoshow', false);
  $('autoShow').onchange = () => IP.store.set('combat.autoshow', $('autoShow').checked);

  // ---------------------------------------------------------------- start
  IP.boot(async (user, st) => {
    $('tablePill').textContent = st.table_open ? 'Table open' : 'Table closed';
    $('tablePill').className = 'pill' + (st.table_open ? ' ok' : '');
    picker = IP.picker($('picker'), { sessions: true, key: 'session-tools', onChange: () => { loadEncounters(IP.store.get('combat.enc', 0)).catch(e => IP.toast(e.message, true)); loadSheets().catch(e => IP.toast(e.message, true)); } });
    await picker.ready;
  });
})();
