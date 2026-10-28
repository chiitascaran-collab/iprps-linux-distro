// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Table - Session Master console (opens only on the SM's own computer).
(() => {
  'use strict';
  const { $, h } = T;
  const ctx = { me: 'sm' };
  let table = {}, roster = [], groups = [], library = [];
  const selected = new Set(T.store.get('selected', []));
  const feed = T.feed($('feed'), ctx);

  const dice = T.diceBar($('dice'), {
    vis: [['all', 'Everyone sees'], ['self', 'Secret (only me)']],
    onRoll: body => T.api('/api/sm/roll', body),
  });
  const comp = T.composer($('composer'), {
    accept: 'image/png,image/jpeg,image/gif,image/webp,audio/*,video/mp4,video/webm', uploadPath: '/api/sm/upload', sendPath: '/api/sm/send',
    target: v => {
      if (v === 'all') return { type: 'all' };
      if (v === 'sel') return { type: 'select', ids: [...selected] };
      if (v.startsWith('g:')) return { type: 'group', id: v.slice(2) };
      return { type: 'select', ids: [v.slice(2)] };
    },
  });
  const api = (path, body) => T.api('/api/sm/' + path, body);
  const act = fn => async (...a) => { try { await fn(...a); } catch (e) { T.toast(e.message, true); } };

  // ---------------------------------------------------------------- table controls
  function renderTable() {
    if (document.activeElement !== $('tname')) $('tname').value = table.name || '';
    $('tstate').textContent = table.open ? 'Open' : 'Closed';
    $('tstate').className = 'pill ' + (table.open ? 'open' : '');
    $('openBtn').textContent = table.open ? 'Close the table' : 'Open the table';
    $('openBtn').className = table.open ? 'ghost' : 'gold';
    $('lockBox').checked = !!table.locked;
    $('code').textContent = table.code || '——————';
    const addrs = $('addrs'); addrs.textContent = '';
    const list = table.addresses || [];
    if (!list.length) addrs.append(h('p', { class: 'warn', text: 'This computer is not on a network. Connect to Wi-Fi or a cable so players can reach it.' }));
    let chosen = T.store.get('addr', '');
    if (!list.some(a => a.address === chosen)) chosen = (list[0] || {}).address;
    for (const a of list) {
      const url = `http://${a.address}:${table.port}/`;
      addrs.append(h('div', { class: 'addr' + (a.address === chosen ? ' on' : '') },
        h('button', { class: 'linkish', title: `Network: ${a.ifname}. Show the QR code for this address.`, text: url, onclick: () => { T.store.set('addr', a.address); renderTable(); } }),
        h('button', { class: 'icon', title: 'Copy the link', text: '⧉', onclick: () => T.copy(url) })));
    }
    $('qr').textContent = '';
    if (chosen && table.open) {
      const url = `http://${chosen}:${table.port}/?code=${table.code}`;
      $('qr').append(svgEl(IPQR.svg(url)));
      $('qr').title = url;
    }
    $('joinCard').classList.toggle('closed', !table.open);
    $('presetsFrom').textContent = table.presetsFrom ? `Dice buttons: ${table.presetsFrom}` : '';
  }
  const svgEl = s => new DOMParser().parseFromString(s, 'image/svg+xml').documentElement;
  $('openBtn').onclick = act(async () => {
    if (table.open && !confirm('Close the table? Everyone is disconnected until you open it again. Chat and players are kept.')) return;
    await api('table', { open: !table.open });
  });
  $('lockBox').onchange = act(() => api('table', { locked: $('lockBox').checked }));
  $('newCode').onclick = act(async () => { if (confirm('Make a new join code? The old code stops working for new joins.')) await api('table', { newCode: true }); });
  $('tname').onchange = act(() => api('table', { name: $('tname').value }));

  // ---------------------------------------------------------------- players, selection, groups
  function setSel(ids) { selected.clear(); ids.forEach(i => selected.add(i)); T.store.set('selected', [...selected]); renderRoster(); }
  function renderRoster() {
    for (const id of [...selected]) if (!roster.some(p => p.id === id)) selected.delete(id);
    const ul = $('roster'); ul.textContent = '';
    $('count').textContent = `${roster.filter(p => p.online).length} online · ${roster.length}`;
    $('selCount').textContent = selected.size ? `${selected.size} selected` : '';
    if (!roster.length) ul.append(h('li', { class: 'none', text: 'Nobody yet.' }));
    for (const p of [...roster].sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name))) {
      const box = h('input', { type: 'checkbox', checked: selected.has(p.id), 'aria-label': 'Select ' + p.name,
        onchange: () => { box.checked ? selected.add(p.id) : selected.delete(p.id); setSel([...selected]); } });
      const name = h('b', { text: p.name }); name.style.color = p.color;
      ul.append(h('li', { class: p.online ? 'on' : 'off' },
        h('label', { class: 'pl' }, box, h('span', { class: 'dot', title: p.online ? 'Online' : 'Away' }),
          h('span', { class: 'pn' }, name, p.character ? h('small', { text: p.character }) : null,
            h('small', { class: 'dim', text: `${p.device} · ${p.ip} · ${p.online ? 'online' : 'seen ' + T.ago(p.lastSeen)}` }),
            p.groups.length ? h('span', { class: 'gchips' }, p.groups.map(g => h('span', { class: 'gchip', text: (groups.find(x => x.id === g) || {}).name || '' }))) : null)),
        h('div', { class: 'pbtns' },
          h('button', { class: 'ghost small', text: 'Message', onclick: () => { comp.target = 'p:' + p.id; comp.focus(); } }),
          h('button', { class: 'ghost small danger', text: 'Remove', onclick: act(async () => { if (confirm(`Remove ${p.name} from the table?`)) await api('kick', { id: p.id }); }) }))));
    }
    renderTargets();
  }
  function renderGroups() {
    const ul = $('groups'); ul.textContent = '';
    if (!groups.length) ul.append(h('li', { class: 'none', text: 'Select players, name a group, then Make. Use groups for whispers to a party split.' }));
    for (const g of groups) {
      const names = g.members.map(id => (roster.find(p => p.id === id) || {}).name).filter(Boolean);
      ul.append(h('li', {},
        h('div', {}, h('b', { text: g.name }), h('small', { class: 'dim', text: names.length ? names.join(', ') : 'nobody' })),
        h('div', { class: 'pbtns' },
          h('button', { class: 'ghost small', text: 'Select', title: 'Select these players', onclick: () => setSel(g.members) }),
          h('button', { class: 'ghost small', text: 'Set to selected', onclick: act(() => api('group', { action: 'set', id: g.id, members: [...selected] })) }),
          h('button', { class: 'ghost small danger', text: '×', title: 'Delete group', onclick: act(() => api('group', { action: 'delete', id: g.id })) }))));
    }
    const sel = $('tgGroup'), keep = sel.value; sel.textContent = '';
    groups.forEach(g => sel.append(h('option', { value: g.id, text: g.name })));
    if (groups.some(g => g.id === keep)) sel.value = keep;
    renderTargets();
  }
  function renderTargets() {
    comp.setTargets([['all', 'Everyone'], ['sel', `Selected players (${selected.size})`],
      ...groups.map(g => ['g:' + g.id, g.name, 'Group']),
      ...[...roster].sort((a, b) => a.name.localeCompare(b.name)).map(p => ['p:' + p.id, p.name + (p.online ? '' : ' (away)'), 'Private to one player'])]);
  }
  $('selAll').onclick = () => setSel(roster.map(p => p.id));
  $('selNone').onclick = () => setSel([]);
  $('gmake').onclick = act(async () => {
    const name = $('gname').value.trim(); if (!name) return T.toast('Name the group first', true);
    if (!selected.size) return T.toast('Select players first', true);
    await api('group', { action: 'create', name, members: [...selected] }); $('gname').value = '';
  });

  // ---------------------------------------------------------------- pushes
  function target() {
    const v = document.querySelector('input[name=tg]:checked').value;
    if (v === 'sel') { if (!selected.size) throw new Error('Select players on the left first'); return { type: 'select', ids: [...selected] }; }
    if (v === 'group') { if (!$('tgGroup').value) throw new Error('Make a group first'); return { type: 'group', id: $('tgGroup').value }; }
    return { type: 'all' };
  }
  const tLabel = t => (t.type === 'all' ? 'everyone' : t.type === 'group' ? (groups.find(g => g.id === t.id) || {}).name : `${t.ids.length} player(s)`);
  function renderLibrary() {
    const ul = $('library'); ul.textContent = '';
    if (!library.length) ul.append(h('li', { class: 'none', text: 'Add maps, portraits, handouts, music, sound effects or video clips.' }));
    for (const m of library) {
      const thumb = m.kind === 'image' ? h('img', { src: T.mediaUrl(m.id), alt: '', loading: 'lazy' }) : h('span', { class: 'mi', text: m.kind === 'audio' ? '♪' : '▶' });
      ul.append(h('li', {}, thumb, h('div', { class: 'mn' }, h('span', { text: m.name }), h('small', { class: 'dim', text: `${m.kind} · ${T.size(m.size)}` })),
        h('div', { class: 'pbtns' },
          m.kind !== 'audio' ? h('button', { class: 'gold small', text: 'Show', title: 'Show on the players\' screens', onclick: act(() => push({ kind: m.kind, media: m.id })) }) : null,
          m.kind !== 'image' ? h('button', { class: 'ghost small', text: '♪ Play', title: 'Play the sound on the players\' devices', onclick: act(() => playSound(m)) }) : null,
          h('button', { class: 'icon danger', text: '×', title: 'Delete', onclick: act(async () => { if (confirm(`Delete ${m.name}?`)) await api('media-delete', { id: m.id }); }) }))));
    }
  }
  async function push(body) { const t = target(); const r = await api('push', { ...body, target: t }); T.toast(`Shown to ${tLabel(t)} (${r.sent})`); }
  async function playSound(m) {
    const t = target();
    const r = await api('audio', { action: 'play', media: m.id, loop: $('loop').checked, volume: +$('vol').value, target: t });
    $('nowPlaying').textContent = `Playing “${m.name}” for ${tLabel(t)} (${r.sent})${$('loop').checked ? ', looping' : ''}.`;
  }
  $('stopAudio').onclick = act(async () => { const t = target(); await api('audio', { action: 'stop', target: t }); $('nowPlaying').textContent = `Sound stopped for ${tLabel(t)}.`; });
  $('clearStage').onclick = act(() => push({ kind: 'clear' }));
  $('cardBtn').onclick = act(async () => {
    if (!$('cardText').value.trim()) return T.toast('Type the text first', true);
    await push({ kind: 'text', title: $('cardTitle').value, text: $('cardText').value });
  });
  $('mfile').onchange = () => { [...$('mfile').files].forEach(uploadMedia); $('mfile').value = ''; };
  function uploadMedia(f) {
    const bar = h('i'), row = h('div', { class: 'uprow' }, h('span', { text: f.name }), h('span', { class: 'prog' }, bar));
    $('uploads').append(row);
    T.upload('/api/sm/upload', f, p => { bar.style.width = Math.round(p * 100) + '%'; })
      .then(() => row.remove()).catch(e => { row.remove(); T.toast(e.message, true); });
  }
  const right = document.querySelector('.smright');
  right.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); right.classList.add('drop'); } });
  right.addEventListener('dragleave', () => right.classList.remove('drop'));
  right.addEventListener('drop', e => { right.classList.remove('drop'); if (e.dataTransfer.files.length) { e.preventDefault(); [...e.dataTransfer.files].forEach(uploadMedia); } });

  // ---------------------------------------------------------------- session
  $('newSession').onclick = act(async () => { if (confirm('Start a new session? This clears the chat, the screens and the players\' files. Players, groups and your media stay.')) await api('reset', {}); });
  $('resetAll').onclick = act(async () => { if (confirm('Reset everything? Removes all players, groups, chat and all media, and makes a new join code.')) await api('reset', { everything: true }); });

  // ---------------------------------------------------------------- live
  T.connect('/api/sm/events', {
    status: ok => $('conn').classList.toggle('ok', ok),
    hello: s => {
      table = s.table; roster = s.roster; groups = s.groups; library = s.media;
      feed.clear(); s.messages.forEach(feed.add);
      dice.setPresets(s.presets);
      renderTable(); renderRoster(); renderGroups(); renderLibrary();
    },
    msg: m => feed.add(m),
    roster: r => { roster = r; renderRoster(); renderGroups(); },
    groups: g => { groups = g; renderGroups(); renderRoster(); },
    table: t => { table = t; renderTable(); },
    library: l => { library = l; renderLibrary(); },
    presets: p => dice.setPresets(p),
  });
  setInterval(renderRoster, 30000);                      // keeps "seen 5 min ago" current
})();
