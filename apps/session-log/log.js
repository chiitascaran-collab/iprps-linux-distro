// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Session Log and Recap - front end.
(() => {
  'use strict';
  const { $, h, act } = IP;
  const KINDS = { note: ['📝', 'Note'], event: ['✦', 'Event'], combat: ['⚔', 'Combat'], roll: ['🎲', 'Roll'], loot: ['💰', 'Loot'], xp: ['⭐', 'XP'] };
  let picker, data = null, filter = '', saveTimer = null;

  // datetime-local <-> database
  const toLocal = v => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');
  const fromLocal = v => (v ? v.replace('T', ' ') + ':00' : '');

  // ---------------------------------------------------------------- sessions list (left)
  function renderSessions() {
    const ul = $('sessList'); ul.textContent = '';
    const st = picker.state;
    if (!st.campaign) ul.append(h('li', { class: 'none', text: 'Choose a campaign.' }));
    else if (!st.sessions.length) ul.append(h('li', { class: 'none', text: 'No sessions yet: + Session.' }));
    for (const s of st.sessions) ul.append(h('li', { class: s.id === st.session ? 'on' : '', onclick: () => picker.setSession(s.id) },
      h('b', { text: `Session ${s.session_no}` }), s.title ? ` · ${s.title}` : '',
      h('small', { text: [s.played_at ? new Date(s.played_at.replace(' ', 'T')).toLocaleDateString() : '', `${s.entries} entr${s.entries === 1 ? 'y' : 'ies'}`, s.has_recap ? 'recap ✓' : ''].filter(Boolean).join(' · ') })));
  }

  // ---------------------------------------------------------------- one session
  async function load() {
    renderSessions();
    const id = picker.state.session;
    $('emptyMsg').hidden = !!id; $('sess').hidden = !id;
    if (!id) { data = null; return; }
    data = await IP.api('session', null, `&id=${id}`);
    const s = data.session;
    $('sNo').textContent = `Session ${s.session_no}`;
    $('sTitle').value = s.title || ''; $('sPlayed').value = toLocal(s.played_at); $('sSched').value = toLocal(s.scheduled_at);
    document.title = `Session ${s.session_no} · ${s.campaign_name} · Session Log`;
    $('recap').value = s.recap || ''; $('smNotes').value = s.sm_notes || ''; $('saved').textContent = '';
    $('prevBox').hidden = !data.previous;
    if (data.previous) { $('prevTitle').textContent = `Session ${data.previous.session_no}${data.previous.title ? ': ' + data.previous.title : ''}`; $('prevText').innerHTML = IPMarkdown.render(data.previous.recap); }
    renderLog(); renderPlayers(); renderPreview();
  }
  async function saveHeader() {
    await IP.lib('session_save', { id: data.session.id, title: $('sTitle').value, played_at: fromLocal($('sPlayed').value), scheduled_at: fromLocal($('sSched').value) });
    await picker.reload();
  }
  for (const id of ['sTitle', 'sPlayed', 'sSched']) $(id).onchange = act(saveHeader);
  $('delSess').onclick = act(async () => {
    const s = data.session;
    if (!confirm(`Delete session ${s.session_no} with its ${data.log.length} log entries, encounters, recap and attendance? This can't be undone.`)) return;
    await IP.api('session_delete', { id: s.id }); await picker.reload();
  });

  // ---------------------------------------------------------------- tabs
  document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    for (const t of ['log', 'recap', 'players']) $('tab' + t[0].toUpperCase() + t.slice(1)).hidden = b.dataset.tab !== t;
    IP.store.set('log.tab', b.dataset.tab);
  }; });
  const startTab = IP.store.get('log.tab', 'log'); document.querySelector(`#tabs [data-tab="${startTab}"]`)?.click();

  // ---------------------------------------------------------------- the log
  function renderLog() {
    const counts = {}; data.log.forEach(e => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
    const f = $('filters'); f.textContent = '';
    f.append(h('span', { class: 'chip' + (filter ? '' : ' on'), text: `All ${data.log.length}`, onclick: () => { filter = ''; renderLog(); } }));
    for (const [k, [icon, label]] of Object.entries(KINDS)) if (counts[k]) f.append(h('span', { class: 'chip' + (filter === k ? ' on' : ''), text: `${icon} ${label} ${counts[k]}`, onclick: () => { filter = k; renderLog(); } }));
    const ol = $('timeline'); ol.textContent = '';
    const list = data.log.filter(e => !filter || e.kind === filter);
    if (!list.length) ol.append(h('li', { class: 'none', style: { display: 'block' }, text: data.log.length ? 'Nothing of this kind.' : 'Nothing logged yet. Type what happens above; combat, dice and the Oracle add their entries here too.' }));
    for (const e of list) {
      const t = h('div', { class: 't', text: e.text, title: 'Click to edit' });
      t.onclick = () => {
        const ta = h('textarea', { rows: Math.min(10, Math.max(2, e.text.split('\n').length + 1)) }); ta.value = e.text;
        const kind = h('select', {}, Object.entries(KINDS).map(([k, [i, l]]) => h('option', { value: k, text: `${i} ${l}` }))); kind.value = e.kind;
        const box = h('div', {}, ta, h('div', { class: 'row' }, kind, h('button', { class: 'small', text: 'Save', onclick: act(async () => { await IP.api('entry_update', { id: e.id, text: ta.value, kind: kind.value }); await load(); }) }),
          h('button', { class: 'ghost small', text: 'Cancel', onclick: () => renderLog() })));
        t.replaceWith(box); ta.focus();
      };
      ol.append(h('li', { class: 'k-' + e.kind }, h('time', { text: IP.time(e.logged_at) }), h('span', { class: 'k', title: KINDS[e.kind][1], text: KINDS[e.kind][0] }), t,
        h('div', { class: 'acts noprint' },
          h('button', { class: 'icon', text: '👁', title: 'Show to the players', onclick: act(() => IP.showToPlayers(KINDS[e.kind][1], e.text, picker.state.campaign)) }),
          h('button', { class: 'icon danger', text: '×', title: 'Delete', onclick: act(async () => { if (confirm('Delete this entry?')) { await IP.api('entry_delete', { id: e.id }); await load(); } }) }))));
    }
  }
  $('addForm').onsubmit = act(async ev => {
    ev.preventDefault();
    const text = $('addText').value.trim(); if (!text) return;
    await IP.api('entry_add', { session_id: data.session.id, kind: $('addKind').value, text });
    $('addText').value = ''; await load(); $('addText').focus();
    const tl = $('timeline'); tl.lastElementChild && tl.lastElementChild.scrollIntoView({ block: 'nearest' });
  });

  // ---------------------------------------------------------------- recap
  function renderPreview() { $('recapPreview').innerHTML = IPMarkdown.render(`## Session ${data.session.session_no}${data.session.title ? ': ' + data.session.title : ''}\n\n` + $('recap').value); }
  function queueSave() {
    $('saved').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(act(async () => { await IP.api('recap_save', { id: data.session.id, recap: $('recap').value, sm_notes: $('smNotes').value }); $('saved').textContent = 'Saved'; renderPreview(); }), 800);
  }
  $('recap').oninput = queueSave; $('smNotes').oninput = queueSave;
  function localDraft() {
    const by = k => data.log.filter(e => e.kind === k).map(e => '- ' + e.text.replace(/\n+/g, ' '));
    const parts = [];
    const story = data.log.filter(e => e.kind === 'event' || e.kind === 'note').map(e => '- ' + e.text.replace(/\n+/g, ' '));
    if (story.length) parts.push('### What happened', ...story, '');
    const fights = by('combat'); if (fights.length) parts.push('### Fights', ...fights, '');
    const loot = by('loot'); if (loot.length) parts.push('### Loot', ...loot, '');
    const xp = by('xp'); if (xp.length) parts.push('### Experience', ...xp, '');
    const present = data.players.filter(p => p.present).map(p => p.display_name);
    if (present.length) parts.push(`*Players: ${present.join(', ')}.*`);
    return parts.join('\n').trim();
  }
  $('draftLocal').onclick = () => {
    const d = localDraft();
    if (!d) return IP.toast('The log has no notes, events, combat, loot or XP yet.', true);
    if ($('recap').value.trim() && !confirm('Add the draft below the recap you have?')) return;
    $('recap').value = ($('recap').value.trim() ? $('recap').value.trim() + '\n\n' : '') + d; queueSave();
  };
  $('draftOracle').onclick = act(async () => {
    if (!data.log.length) return IP.toast('The log is empty: there is nothing to recap yet.', true);
    if ($('recap').value.trim() && !confirm('The Oracle\'s draft will be added below the recap you have. Continue?')) return;
    const b = $('draftOracle'); b.disabled = true; b.textContent = '✦ The Oracle is writing… (a minute or two)';
    try {
      const j = await IP.api('recap', { session_id: data.session.id }, '', '../oracle/api.php');
      $('recap').value = ($('recap').value.trim() ? $('recap').value.trim() + '\n\n' : '') + j.text; queueSave();
      IP.toast('Draft added: read it and change anything that isn\'t right.');
    } finally { b.disabled = false; b.textContent = '✦ Draft with the Oracle'; }
  });
  const recapTitle = () => `${data.session.campaign_name} · Session ${data.session.session_no}${data.session.title ? ': ' + data.session.title : ''}`;
  $('recapShow').onclick = act(() => IP.showToPlayers(recapTitle(), $('recap').value.replace(/^#+\s*/gm, ''), picker.state.campaign));
  $('prevShow').onclick = act(() => IP.showToPlayers(`Last time: ${$('prevTitle').textContent}`, data.previous.recap.replace(/^#+\s*/gm, ''), picker.state.campaign));
  $('recapCopy').onclick = act(async () => { await navigator.clipboard.writeText($('recap').value); IP.toast('Copied'); });
  $('recapMd').onclick = () => IP.download(`${recapTitle().replace(/[\\/:*?"<>|]+/g, ' ')}.md`, `# ${recapTitle()}\n\n${$('recap').value}\n`, 'text/markdown');
  $('recapPrint').onclick = () => { renderPreview(); window.print(); };

  // ---------------------------------------------------------------- players and attendance
  function renderPlayers() {
    const tb = $('attBody'); tb.textContent = '';
    if (!data.players.length) tb.append(h('tr', {}, h('td', { colspan: 4, class: 'none', text: 'No players yet: + Player.' })));
    for (const p of data.players) {
      const present = h('input', { type: 'checkbox', checked: !!p.present }), xp = h('input', { type: 'number', value: p.xp_awarded || 0 }), notes = h('input', { class: 'n', value: p.att_notes || '', maxlength: 2000 });
      const save = act(async () => { await IP.api('attendance', { session_id: data.session.id, player_id: p.id, present: present.checked, xp_awarded: +xp.value || 0, notes: notes.value });
        p.present = present.checked; p.xp_awarded = +xp.value || 0; p.att_notes = notes.value; });
      present.onchange = save; xp.onchange = save; notes.onchange = save;
      tb.append(h('tr', {}, h('td', {}, h('b', { text: p.display_name }), p.contact ? h('div', { class: 'fine', text: p.contact }) : null), h('td', {}, present), h('td', {}, xp), h('td', {}, notes)));
    }
  }
  $('addPlayer').onclick = act(async () => {
    const name = prompt('Player\'s name:'); if (!name) return;
    const contact = prompt('Contact (optional: email, phone…):', '') || '';
    const j = await IP.api('player_save', { display_name: name, contact });
    await IP.api('attendance', { session_id: data.session.id, player_id: j.id, present: true, xp_awarded: 0 });
    await load();
  });
  $('logXp').onclick = act(async () => {
    const aw = data.players.filter(p => p.xp_awarded).map(p => `${p.display_name} ${p.xp_awarded}`);
    if (!aw.length) return IP.toast('No XP awarded yet: type amounts in the XP column first.', true);
    await IP.api('entry_add', { session_id: data.session.id, kind: 'xp', text: `XP awarded: ${aw.join(', ')}.` });
    await load(); IP.toast('Added to the log');
  });

  IP.boot(async (user, st) => {
    $('draftOracle').hidden = !st.apps.oracle;
    picker = IP.picker($('picker'), { sessions: true, key: 'session-tools', onChange: () => load().catch(e => IP.toast(e.message, true)) });
    await picker.ready;
  });
})();
