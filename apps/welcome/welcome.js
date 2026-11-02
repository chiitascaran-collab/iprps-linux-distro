// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Welcome - first-run tour, first campaign, color scheme and API key vault.
(() => {
  'use strict';
  const { $, h, act } = IP;
  const STEPS = ['Welcome', 'Your campaign', 'Your tools', 'Color scheme', 'API keys', 'Ready'];
  const TOOLS = [
    ['hub', 'Session Master Hub', 'Your apps in one place, and Manage apps to choose which ones show.'],
    ['character-sheets', 'Character Sheets', 'Every player\'s, NPC\'s and creature\'s sheet: import, view, print, by campaign.'],
    ['character-creator', 'Character Creator', 'The IPRPS character sheet. Give players the blank file, or they open it on the Table.'],
    ['session-log', 'Session Log and Recap', 'Sessions, a timeline of what happened, attendance, XP, and the recap.'],
    ['combat', 'Initiative and Combat Tracker', 'Turn order, rounds, HP with Armor Rating, conditions, all five combat modes.'],
    ['dice', 'Dice Roller', 'Any dice and every IPRPS roll, logged to the session and shown to players if you like.'],
    ['soundboard', 'Soundboard', 'Ambience and sound effects at a click: rain, fire, thunder, swords… and your own music.'],
    ['table', 'IPRPS Table', 'Players join from phones and laptops on your network: chat, dice, pictures, sound, sheets.'],
    ['oracle', 'IPRPS Oracle', 'Local AI for Session Masters: NPCs, scenes, loot, recaps and sheets, without the internet.', 'Medium and Advanced'],
    ['writer', 'IPRPS Writer', 'A word processor for handouts and notes: saves Word, OpenDocument and PDF.'],
    ['file-viewer', 'IPRPS File Viewer', 'Open and check .iprps, .ipai, .srpatch and .capstone files.'],
  ];
  const THEMES = [
    ['night', 'Night (default)', ['#0b0e1a', '#161c38', '#d9b45a', '#e6e3d6']],
    ['parchment', 'Parchment (light)', ['#f4efe2', '#fffdf7', '#9a6b12', '#2a2418']],
    ['forest', 'Forest', ['#0c1410', '#172820', '#c9a45a', '#e4e8dc']],
    ['contrast', 'High contrast', ['#000000', '#111111', '#ffd400', '#ffffff']],
  ];
  let step = 0, seen = new Set([0]), status = {}, booted = false;

  // ---------------------------------------------------------------- steps
  function go(n) {
    step = Math.max(0, Math.min(STEPS.length - 1, n)); seen.add(step);
    document.querySelectorAll('section[data-step]').forEach(s => { s.hidden = +s.dataset.step !== step; });
    const nav = $('steps'); nav.textContent = '';
    STEPS.forEach((t, i) => nav.append(h('button', { class: (i === step ? 'on ' : '') + (seen.has(i) && i !== step ? 'seen' : ''), onclick: () => go(i) },
      h('span', { class: 'n', text: seen.has(i) && i !== step ? '✓' : i + 1 }), h('span', { text: t }))));
    $('back').disabled = step === 0;
    $('next').textContent = step === STEPS.length - 1 ? 'Finish' : step === 0 ? 'Start ▶' : 'Next ▶';
    $('stepOf').textContent = `Step ${step + 1} of ${STEPS.length}`;
    if (booted) IP.api('tour', { step, done: step === STEPS.length - 1 }).catch(() => {});
    document.querySelector('.page').scrollTop = 0;
  }
  $('back').onclick = () => go(step - 1);
  $('next').onclick = () => (step === STEPS.length - 1 ? location.assign('../hub/') : go(step + 1));

  // ---------------------------------------------------------------- 0: what's installed
  function renderInstalled() {
    const ul = $('installed'); ul.textContent = '';
    for (const [k, name, , ed] of TOOLS) ul.append(h('li', { class: status.apps[k] ? '' : 'no', text: name + (status.apps[k] ? '' : ed ? ` (${ed})` : ' (not installed)') }));
  }

  // ---------------------------------------------------------------- 1: campaigns
  async function loadCampaigns() {
    const list = (await IP.lib('campaigns')).campaigns;
    const ul = $('campList'); ul.textContent = '';
    if (!list.length) ul.append(h('li', { class: 'none', text: 'No campaigns yet: create your first one below.' }));
    for (const c of list) ul.append(h('li', {}, h('b', { text: c.name }), h('span', { class: 'fine', text: [c.setting, c.status].filter(Boolean).join(' · ') })));
  }
  $('campForm').onsubmit = act(async e => {
    e.preventDefault();
    const f = new FormData($('campForm'));
    await IP.lib('campaign_save', { name: f.get('name'), setting: f.get('setting'), description: f.get('description'), status: 'active' });
    $('campForm').reset(); await loadCampaigns(); IP.toast('Campaign created');
  });

  // ---------------------------------------------------------------- 2: tools
  function renderTools() {
    const box = $('tools'); box.textContent = '';
    for (const [k, name, desc, ed] of TOOLS) {
      if (!status.apps[k]) continue;
      box.append(h('div', { class: 'tool' }, h('img', { src: `../hub/api.php?action=icon&app=${encodeURIComponent(k)}`, alt: '', onerror: e => { e.target.style.visibility = 'hidden'; } }),
        h('div', {}, h('b', { text: name }), ed ? h('span', { class: 'tag', text: ed }) : null, h('p', { text: desc }),
          h('a', { class: 'btn ghost small', href: k === 'table' ? 'http://localhost:7777/sm/' : `../${k}/`, target: '_blank', rel: 'noopener', text: 'Open ↗' }))));
    }
  }

  // ---------------------------------------------------------------- 3: color scheme
  function renderThemes() {
    const box = $('themes'); box.textContent = '';
    const cur = document.documentElement.dataset.theme || 'night';
    for (const [id, name, [bg, panel, accent, text]] of THEMES) {
      box.append(h('button', { type: 'button', class: 'theme' + (id === cur ? ' on' : ''), onclick: act(async () => { IP.setTheme(id); renderThemes(); await IP.lib('prefs_save', { theme: id }); IP.toast(`${name}: saved`); }) },
        h('div', { class: 'sw', style: { background: bg } }, h('i', { style: { background: accent, width: '45%' } }), h('i', { style: { background: panel, border: `1px solid ${accent}` } }),
          h('i', { style: { background: text, width: '70%', opacity: '.8' } }), h('i', { style: { background: text, width: '55%', opacity: '.5' } })),
        h('div', { class: 'nm', text: name })));
    }
  }

  // ---------------------------------------------------------------- 4: API keys
  let providers = {};
  async function loadKeys() {
    const j = await IP.api('vault');
    providers = j.providers;
    const sel = $('keyProv'); sel.textContent = '';
    for (const [k, v] of Object.entries(providers)) sel.append(h('option', { value: k, text: v }));
    sel.append(h('option', { value: '*', text: 'Other service…' }));
    const ul = $('keyList'); ul.textContent = '';
    if (!j.keys.length) ul.append(h('li', { class: 'none', text: 'No keys stored.' }));
    for (const k of j.keys) ul.append(h('li', {}, h('b', { class: 'grow', text: k.label }), h('code', { text: k.hint || '' }), h('span', { class: 'fine', text: IP.when(k.updated_at) }),
      h('button', { class: 'ghost small', text: 'Copy', title: 'Copy the key to the clipboard', onclick: act(async () => { const s = await IP.api('secret', null, `&provider=${encodeURIComponent(k.provider)}`); await navigator.clipboard.writeText(s.secret); IP.toast('Copied: paste it where it\'s needed'); }) }),
      h('button', { class: 'ghost small danger', text: 'Delete', onclick: act(async () => { if (!confirm(`Delete the ${k.label} key from this computer?`)) return; await IP.api('vault_delete', { provider: k.provider }); await loadKeys(); }) })));
  }
  $('keyProv').onchange = () => { $('otherBox').hidden = $('keyProv').value !== '*'; };
  $('showKey').onchange = () => { $('keyForm').secret.type = $('showKey').checked ? 'text' : 'password'; };
  $('keyForm').onsubmit = act(async e => {
    e.preventDefault();
    const f = $('keyForm'), other = f.provider.value === '*';
    const provider = other ? f.other.value : f.provider.value;
    await IP.api('vault_save', { provider, label: other ? f.other.value : providers[provider], secret: f.secret.value });
    f.secret.value = ''; f.other.value = ''; $('showKey').checked = false; f.secret.type = 'password';
    await loadKeys(); IP.toast('Key saved (encrypted)');
  });

  IP.boot(async (user, st) => {
    status = st;
    $('firstName').textContent = user.first_name || user.username || 'Session Master';
    renderInstalled(); renderTools(); renderThemes();
    await Promise.all([loadCampaigns(), loadKeys().catch(e => IP.toast(e.message, true))]);
    let t = {}; try { t = (await IP.api('vault')).tour || {}; } catch {}
    const start = +new URLSearchParams(location.search).get('step') || (t.done ? 0 : t.step || 0);
    for (let i = 0; i <= start; i++) seen.add(i);
    booted = true; go(start);
  });
  go(0);
})();
