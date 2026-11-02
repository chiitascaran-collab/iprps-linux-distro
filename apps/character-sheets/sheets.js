// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Character Sheets - the Session Master's library of player, NPC and creature sheets.
// Talks only to api.php here (and the Oracle's api.php for AI sheets); the Universal Login token is added by auth-client.js.
// Inside the IPRPS Table console (?embed=table) it also shows who is at the table and sends sheets to players' screens.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const P = new URLSearchParams(location.search);
  const EMBED = P.get('embed') === 'table';
  if (EMBED) document.body.classList.add('embed');

  // ---------------------------------------------------------------- IPRPS data (same as the Character Creator)
  const BASE_SKILLS = {"Melee Weapons":"STR","Ranged Weapons":"DEX","Martial Arts":"DEX","Parry":"DEX","Dodge":"DEX","Weapon Specialization":"STR","Shield Combat":"STR","Shield Bash":"STR","Dual Wielding":"DEX","Archery":"DEX","Throwing":"DEX","Athletics":"STR","Climbing":"STR","Stealth":"DEX","Swimming":"STR","Acrobatics":"DEX","Endurance":"CON","Running":"CON","Jumping":"STR","Balance":"DEX","Escape Artist":"DEX","Investigation":"INT","Lore":"INT","Perception":"WIS","Insight":"WIS","Survival":"WIS","Tracking":"WIS","Medicine":"WIS","Nature":"WIS","Animal Handling":"WIS","Navigation":"INT","Negotiation":"CHA","Persuasion":"CHA","Deception":"CHA","Streetwise":"INT","Leadership":"CHA","Public Speaking":"CHA","Intimidation":"CHA","Diplomacy":"CHA","Bluff":"CHA","Etiquette":"INT","Concentration":"WIL","Meditation":"WIL","Resistance":"WIL","Mental Focus":"WIL","Engineering":"INT","Crafting":"INT","Piloting":"DEX","Repair":"INT","Alchemy":"INT","Magick Theory":"INT","Magick Recovery":"CON","Lock Picking":"DEX","Trap Detection":"WIS","Disguise":"CHA","Forgery":"INT","Gambling":"INT","Sleight of Hand":"DEX"};
  const STATS = [['int', 'INT', 'Intelligence'], ['str', 'STR', 'Strength'], ['dex', 'DEX', 'Dexterity'], ['wis', 'WIS', 'Wisdom'],
    ['con', 'CON', 'Constitution'], ['wil', 'WIL', 'Willpower'], ['cha', 'CHA', 'Charisma']];
  const RACES = { human: 'Human', humankin: 'Humankin', dwarf: 'Dwarf', elf: 'Elf', 'dark-elf': 'Dark Elf', gemp: 'Gemp', orc: 'Orc',
    catfolk: 'Catfolk', wolffolk: 'Wolffolk', dogfolk: 'Dogfolk', bearfolk: 'Bearfolk', foxfolk: 'Foxfolk', rabbitfolk: 'Rabbitfolk',
    lizardfolk: 'Lizardfolk', birdfolk: 'Birdfolk', dragonborn: 'Dragonborn', demon: 'Demon', halfling: 'Halfling', gnome: 'Gnome', fairy: 'Fairy' };
  const CLASSES = { warrior: 'Warrior', tank: 'Tank', mage: 'Mage', wizard: 'Wizard', sorcerer: 'Sorcerer', necromancer: 'Necromancer',
    rogue: 'Rogue', assassin: 'Assassin', ranger: 'Ranger', ninja: 'Ninja', scout: 'Scout', healer: 'Healer', cleric: 'Cleric',
    paladin: 'Paladin', bard: 'Bard', 'beast-tamer': 'Beast Tamer' };
  const ARMOR = ['None', 'Leather', 'Studded Leather', 'Chain Mail', 'Scale Mail', 'Plate Mail', 'Full Plate'];
  const SIZES = { '-3': ['Pixies, Fairies', -6, -3], '-2': ['Goblins', -4, -2], '-1': ['Catfolk, Birdfolk, Gemps', -2, -1], 0: ['Humans, Elves, Wolffolk', 0, 0],
    1: ['Orcs, Bearfolk', 2, 1], 2: ['Ogres, large Reptilians', 4, 2], 3: ['Giants', 6, 3], 4: ['Young Dragons', 8, 4], 5: ['Adult Dragons', 10, 5],
    6: ['Ancient Dragons, Primordials', 12, 6] };
  const CREATURE_TYPES = ['Beast', 'Monstrosity', 'Undead', 'Construct', 'Dragon', 'Elemental', 'Spirit', 'Demon', 'Aberration', 'Plant', 'Insectoid', 'Aquatic', 'Humanoid', 'Other'];
  const THREATS = ['Minion', 'Standard', 'Elite', 'Boss', 'Apex'];
  const KIND = { pc: 'Player', npc: 'NPC', creature: 'Creature' };

  // ---------------------------------------------------------------- state
  let all = [], campaigns = [], info = {}, current = null, kindTab = '', roster = [], parentWin = null, parentOrigin = null;

  // ---------------------------------------------------------------- helpers
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  };
  async function api(action, body, params = '', base = 'api.php') {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const r = await fetch(`${base}?action=${action}${params}`, opt);
    let j; try { j = await r.json(); } catch { throw new Error(`Server error (HTTP ${r.status})`); }
    if (!j.ok) throw new Error(j.error || 'Request failed');
    return j;
  }
  function toast(m, bad) {
    const t = $('toast'); t.textContent = m; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3200);
  }
  const act = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };
  const shift = n => (n >= 0 ? '+' : '') + n;
  const num = n => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString());
  const initials = name => { const w = String(name || '').match(/[\p{L}\p{N}]+/gu) || ['?']; return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase(); };
  const raceLabel = s => RACES[s.race] || s.race || '';
  const classLabel = s => (s.class === 'custom' ? s.customClass : CLASSES[s.class] || s.class) || '';
  const campNum = () => (+$('campaign').value > 0 ? +$('campaign').value : 0);
  function shrinkImage(dataUrl, max, force) {
    return new Promise(resolve => {
      if (!dataUrl) return resolve(null);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        if (scale === 1 && !force) return resolve(dataUrl);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        const g = c.getContext('2d'); g.fillStyle = '#121731'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }
  // Portrait at most 768 px (large ones only), plus a 96 px thumbnail for the list
  async function preparePortrait(sheet) {
    if (!sheet.avatar || typeof sheet.avatar !== 'string') return null;
    if (sheet.avatar.length > 400 * 1024) sheet.avatar = await shrinkImage(sheet.avatar, 768, true);
    return sheet.avatar ? shrinkImage(sheet.avatar, 96, true) : null;
  }
  function avatarEl(src, name, kind, cls = 'av') {
    return src ? h('img', { class: cls + (kind === 'creature' ? ' creature' : ''), src, alt: '' })
               : h('div', { class: cls + (kind === 'creature' ? ' creature' : ''), text: initials(name) });
  }
  const norm = s => String(s || '').trim().toLowerCase();
  const atTable = row => row.kind === 'pc' && roster.some(p => p.online && (norm(p.name) === norm(row.player_name) || (p.character && norm(p.character) === norm(row.name))));
  function playerFor(row) {
    return roster.find(p => norm(p.name) === norm(row.player_name)) || roster.find(p => p.character && norm(p.character) === norm(row.name));
  }

  // ---------------------------------------------------------------- campaigns and the list
  function campaignOptions(sel, { all: withAll = false, none = true, keep } = {}) {
    const v = keep !== undefined ? String(keep ?? '') : sel.value;
    sel.textContent = '';
    if (withAll) sel.append(h('option', { value: '', text: 'All campaigns' }));
    if (none) sel.append(h('option', { value: withAll ? 'none' : '', text: 'No campaign' }));
    for (const c of campaigns) sel.append(h('option', { value: String(c.id), text: c.name + (c.status && c.status !== 'active' ? ` (${c.status})` : '') }));
    if ([...sel.options].some(o => o.value === v)) sel.value = v;
  }
  async function loadCampaigns() {
    campaigns = (await api('campaigns')).campaigns;
    let want = $('campaign').value;
    try { if (!want) want = localStorage.getItem('charsheets.campaign') || ''; } catch {}
    campaignOptions($('campaign'), { all: true, keep: want });
  }
  async function loadList() {
    all = (await api('list')).sheets;
    renderList();
  }
  function filtered(ignoreKind) {
    const c = $('campaign').value, q = norm($('search').value), onlyTable = EMBED && $('atTable').checked;
    return all.filter(r => (ignoreKind || !kindTab || r.kind === kindTab)
      && (!c || (c === 'none' ? r.campaign_id === null : r.campaign_id === +c))
      && (!q || [r.name, r.player_name, r.race, r.class].some(x => norm(x).includes(q)))
      && (!onlyTable || atTable(r)));
  }
  function renderList() {
    const base = filtered(true);
    document.querySelectorAll('.tabs button').forEach(b => {
      const k = b.dataset.kind;
      b.querySelector('span').textContent = base.filter(r => !k || r.kind === k).length;
      b.classList.toggle('on', k === kindTab);
    });
    const rows = filtered(false);
    const ul = $('list'); ul.textContent = '';
    if (!rows.length) {
      ul.append(h('li', { class: 'none', text: all.length ? 'No sheets match.' : 'No character sheets yet. Import the files your players give you, or make one with New.' }));
      return;
    }
    let last = null;
    for (const r of rows) {
      if (!kindTab && r.kind !== last) { ul.append(h('li', { class: 'group', text: { pc: 'Player characters', npc: 'NPCs', creature: 'Creatures' }[r.kind] })); last = r.kind; }
      const sub = r.kind === 'creature'
        ? [r.race, r.class, `level ${r.level}`].filter(Boolean).join(' · ')
        : [[r.race, r.class].filter(Boolean).join(' '), `lvl ${r.level}`, r.player_name ? `👤 ${r.player_name}` : ''].filter(Boolean).join(' · ');
      const li = h('li', { class: 'item' + (current && current.meta.id === r.id ? ' active' : ''), title: r.campaign_name ? `Campaign: ${r.campaign_name}` : 'No campaign',
        onclick: () => openSheet(r.id) },
        avatarEl(r.thumb, r.name, r.kind),
        h('div', { style: 'min-width:0' },
          h('div', { class: 'li-name' }, h('b', { text: r.name }), h('span', { class: 'kind ' + r.kind, text: KIND[r.kind] }),
            EMBED && atTable(r) ? h('span', { class: 'attable', title: 'At the table now' }) : null),
          h('div', { class: 'li-sub', text: sub + (!$('campaign').value && r.campaign_name ? ` · ${r.campaign_name}` : '') })));
      ul.append(li);
    }
  }

  // ---------------------------------------------------------------- one sheet
  async function openSheet(id) {
    try {
      const j = await api('get', null, `&id=${id}`);
      current = j;
      renderView();
      renderList();
      if (!EMBED) history.replaceState(null, '', `?id=${id}`);
    } catch (e) { toast(e.message, true); }
  }
  function card(title, ...kids) { return h('section', { class: 'card' }, h('h2', { text: title }), ...kids); }
  function wide(title, ...kids) { const c = card(title, ...kids); c.classList.add('wide'); return c; }
  function textCard(title, text, isWide = true) { return text && String(text).trim() ? (isWide ? wide : card)(title, h('p', { class: 'text', text })) : null; }
  const statBox = (label, val) => h('div', { class: 'stat' }, h('small', { text: label }), h('b', { text: val }));
  function attrsGrid(s) {
    return h('div', { class: 'attrs' }, STATS.map(([k, ab, full]) => {
      const v = (s.stats || {})[k] ?? 10;
      return h('div', { class: 'attr', title: `${full}: attribute shift ${shift(v - 10)}` }, h('small', { text: ab }), h('b', { text: v }), h('i', { text: shift(v - 10) }));
    }));
  }
  function skillsGrid(s) {
    const attrOf = Object.assign({}, BASE_SKILLS, ...(s.customSkills || []).map(c => ({ [c.name]: c.attr })));
    const list = Object.entries(s.skills || {}).filter(([, l]) => +l > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!list.length) return h('p', { class: 'none-txt', text: 'No trained skills.' });
    return h('div', { class: 'skills' }, list.map(([n, l]) =>
      h('div', { class: 'skill', title: `Skill shift ${shift(Math.floor(l / 10))}` }, h('div', {}, n, ' ', h('span', { text: attrOf[n] ? `(${attrOf[n]})` : '' })),
        h('b', {}, String(l), h('i', { text: shift(Math.floor(l / 10)) })))));
  }
  const chips = (arr, cls = '') => (arr && arr.length ? h('div', { class: 'chips' }, arr.map(x => h('span', { class: 'chip ' + cls, text: x }))) : h('p', { class: 'none-txt', text: 'None.' }));
  function spellsTable(s) {
    const sp = (s.spells || []).filter(x => x.name);
    if (!sp.length) return null;
    return wide('Magick spells', h('table', { class: 'tbl' }, h('tr', {}, ['Spell', 'Damage', 'Mana cost', 'Skill', 'Acquired'].map(t => h('th', { text: t }))),
      sp.map(x => h('tr', {}, h('td', { text: x.name }), h('td', { text: x.damage || '—' }), h('td', { text: num(x.manaCost) }),
        h('td', { text: x.skillLevel ? `${x.skillLevel} (${shift(Math.floor(x.skillLevel / 10))})` : '—' }), h('td', { text: x.acquired ? '✓' : '' })))));
  }

  function renderView() {
    const v = $('view'); v.textContent = '';
    if (!current) return;
    const s = current.sheet, m = current.meta;
    const creature = m.kind === 'creature';
    const d = s.derived || {};
    const sub = creature
      ? [s.creature?.type, `size ${shift(+(s.creature?.size || 0))}`, s.creature?.threat, `level ${s.level}`]
      : [[raceLabel(s), classLabel(s)].filter(Boolean).join(' ') || null, `level ${s.level}`, m.kind === 'pc' && s.playerName ? `player: ${s.playerName}` : null];
    const player = EMBED ? playerFor(m) : null;

    const tools = h('div', { class: 'toolbar' },
      h('button', { text: '✎ Edit', title: creature ? 'Edit this creature' : 'Open in the Character Creator', onclick: () => editSheet() }),
      EMBED ? sendControl(m, player) : null,
      h('button', { class: 'ghost', text: '⇩ Download .json', onclick: act(download) }),
      h('button', { class: 'ghost', text: '🖨 Print', onclick: () => window.print() }),
      h('button', { class: 'ghost danger', text: 'Delete', onclick: act(remove) }));

    const campSel = h('select', { onchange: act(async () => { await saveMeta({ campaign_id: +campSel.value || null }); toast('Campaign changed'); }) });
    campaignOptions(campSel, { keep: m.campaign_id ?? '' });
    const kindSel = creature ? null : h('select', { onchange: act(async () => { await saveMeta({ kind: kindSel.value }); toast('Sheet type changed'); }) },
      h('option', { value: 'pc', text: 'Player character' }), h('option', { value: 'npc', text: 'NPC' }));
    if (kindSel) kindSel.value = m.kind;
    const notes = h('textarea', { rows: 2, placeholder: 'Only you see these. The Oracle reads them too.', text: m.notes || '' });
    notes.addEventListener('change', act(async () => { await saveMeta({ notes: notes.value }); toast('Notes saved'); }));

    v.append(h('article', { class: 'sheet' },
      h('div', { class: 'head' },
        s.avatar ? h('img', { class: 'portrait', src: s.avatar, alt: '' }) : h('div', { class: 'portrait', text: initials(s.characterName) }),
        h('div', {},
          h('h1', { text: s.characterName || 'Unnamed' }),
          h('div', { class: 'subtitle' }, h('span', { class: 'kind ' + m.kind, text: KIND[m.kind] }), sub.filter(Boolean).map(x => h('span', { text: x })),
            player ? h('span', { class: 'chip', text: player.online ? `🟢 ${player.name} is at the table` : `${player.name} (away)` }) : null),
          tools)),
      h('div', { class: 'meta' },
        h('label', {}, 'Campaign', campSel),
        kindSel ? h('label', {}, 'Sheet type', kindSel) : null,
        h('label', { class: 'notes' }, 'Session Master notes', notes),
        h('label', {}, 'Source', h('span', { class: 'fine', text: { import: 'Imported file', editor: 'Made here', oracle: 'The Oracle', table: 'Sent from the IPRPS Table' }[m.source] + (m.file_name ? ` (${m.file_name})` : '') })),
        h('label', {}, 'Updated', h('span', { class: 'fine', text: new Date(String(m.updated_at).replace(' ', 'T')).toLocaleString() }))),
      creature ? creatureCards(s, d) : characterCards(s, d, m)));
    v.scrollTop = 0;
  }

  function characterCards(s, d, m) {
    const ar = +s.armor || 0;
    const spent = s.totalSpent ?? null;
    return h('div', { class: 'cards' },
      card('Attributes', attrsGrid(s)),
      card('Derived stats', h('div', { class: 'stats' },
        statBox('HP', num(d.hp)), statBox('Mana Pool', num(d.mp)), statBox('Armor Rating', `${ar}${ARMOR[ar] && ar ? ' · ' + ARMOR[ar] : ''}`),
        statBox('Speed', d.speed ?? '—'), statBox('Dodge', d.dodge ?? '—'), statBox('Reach', d.reach || '—'), statBox('Jump', d.jump || '—'),
        statBox('Throw', d.throw || '—'), statBox('Punch', d.punch || '—'), statBox('Kick', d.kick || '—'), statBox('Swing', d.swing || '—'),
        statBox('Carry', d.carry || '—'), statBox('Lift', d.lift || '—'))),
      wide('Skills', skillsGrid(s)),
      card('Advantages', chips(s.advantages)),
      card('Disadvantages', chips(s.disadvantages, 'bad')),
      card('Quirks', chips(s.quirks, 'q')),
      card('Development points', h('div', { class: 'stats' },
        statBox('Starting', num(s.characterPoints)), statBox('XP pool', num(s.xpPool)), statBox('Spent', num(spent)),
        statBox('Remaining', num(s.remainingPoints)), statBox('XP', num(s.xp)))),
      spellsTable(s),
      textCard('Equipment, weapons and gear', s.equipment, false),
      textCard('Money and personal items', s.money, false),
      textCard('Background', s.background),
      textCard('Notes', s.notes));
  }

  function creatureCards(s, d) {
    const c = s.creature || {};
    const sz = SIZES[c.size ?? 0] || SIZES[0];
    return h('div', { class: 'cards' },
      card('Attributes', attrsGrid(s)),
      card('Combat', h('div', { class: 'stats' },
        statBox('HP', num(d.hp)), c.magick ? statBox('Mana Pool', num(d.mp)) : null, statBox('Natural AR', s.armor ?? 0),
        statBox('Speed', d.speed ?? '—'), statBox('Dodge', d.dodge ?? '—'), statBox('Size', shift(+(c.size || 0))),
        statBox('Damage adj.', shift(sz[1])), statBox('Grapple', shift(sz[2]))),
        h('p', { class: 'fine', text: `Size ${shift(+(c.size || 0))}: ${sz[0]}. Armor Rating comes off the damage (Damage − AR).` })),
      wide('Attacks', (c.attacks || []).length ? h('table', { class: 'tbl' }, h('tr', {}, ['Attack', 'Damage', 'Notes'].map(t => h('th', { text: t }))),
        c.attacks.map(a => h('tr', {}, h('td', { text: a.name }), h('td', { text: a.damage || '—' }), h('td', { text: a.notes || '' })))) : h('p', { class: 'none-txt', text: 'No attacks listed.' })),
      card('Abilities', (c.abilities || []).length ? h('div', { class: 'abil' }, c.abilities.map(a => [h('b', { text: a.name }), h('p', { text: a.text || '' })])) : h('p', { class: 'none-txt', text: 'None.' })),
      card('Weaknesses', chips(c.weaknesses, 'bad')),
      card('Where and how', ...([['Habitat', c.habitat], ['Movement', c.movement], ['Senses', c.senses]].filter(([, t]) => t)
        .map(([l, t]) => h('p', { style: 'margin:4px 0' }, h('b', { text: l + ': ' }), t))), !(c.habitat || c.movement || c.senses) ? h('p', { class: 'none-txt', text: 'Not described.' }) : null),
      wide('Skills', skillsGrid(s)),
      spellsTable(s),
      textCard('Behavior', c.behavior, false), textCard('Tactics', c.tactics, false), textCard('Loot', c.loot, false),
      textCard('Lore and description', s.background), textCard('Notes', s.notes));
  }

  async function saveMeta(body) {
    const j = await api('meta', { id: current.meta.id, ...body });
    current.meta = Object.assign(current.meta, j.meta);
    if (body.kind) current.sheet.sheetType = body.kind;
    await loadList(); renderView();
  }
  async function download() {
    const r = await fetch(`api.php?action=export&id=${current.meta.id}`);
    if (!r.ok) throw new Error(`Download failed (HTTP ${r.status})`);
    const blob = await r.blob();
    const a = h('a', { href: URL.createObjectURL(blob), download: `${(current.meta.name || 'character').replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/ /g, '_')}_infinite_plane.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function remove() {
    if (!confirm(`Delete the sheet “${current.meta.name}”? This can't be undone (download it first to keep a copy).`)) return;
    await api('delete', { id: current.meta.id });
    current = null; renderView(); await loadList();
    $('view').append(h('div', { class: 'empty' }, h('p', { text: 'Sheet deleted.' })));
    if (!EMBED) history.replaceState(null, '', location.pathname);
  }

  // ---------------------------------------------------------------- editing
  function openCreator(params) {
    if (!info.creator) return toast('The Character Creator is not installed (/srv/www/iprps/character-creator).', true);
    window.open(`../character-creator/index.html?${params}`, 'iprps-character-creator');
  }
  function editSheet() {
    if (current.meta.kind === 'creature') return renderCreatureEditor(current);
    openCreator(`id=${current.meta.id}`);
  }
  function newSheet(kind) {
    if (kind === 'creature') return renderCreatureEditor(null);
    openCreator(`new=1${kind === 'npc' ? '&kind=npc' : ''}${campNum() ? '&campaign=' + campNum() : ''}`);
  }
  // The Character Creator tells us when it saved, so the list stays current.
  window.addEventListener('message', e => {
    if (e.origin === location.origin && e.data && e.data.type === 'iprps-sheet-saved') {
      loadList().then(() => openSheet(+e.data.id)).catch(() => {});
    }
  });

  // ---------------------------------------------------------------- creature editor
  function renderCreatureEditor(cur) {
    const blank = { sheetType: 'creature', characterName: '', level: 1, stats: { int: 6, str: 12, dex: 12, wis: 10, con: 12, wil: 10, cha: 6 }, armor: 0,
      skills: {}, spells: [], background: '', notes: '', avatar: null,
      creature: { type: 'Beast', size: 0, threat: 'Standard', habitat: '', movement: '', senses: '', attacks: [{ name: 'Bite', damage: '1d6', notes: '' }],
        abilities: [], weaknesses: [], behavior: '', tactics: '', loot: '', magick: false } };
    const s = JSON.parse(JSON.stringify(cur ? cur.sheet : blank));
    s.creature = Object.assign({}, blank.creature, s.creature || {});
    let avatar = s.avatar || null;
    const v = $('view'); v.textContent = '';
    const inp = (val, attrs = {}) => h('input', { value: val ?? '', ...attrs });
    const area = (val, rows = 3) => { const t = h('textarea', { rows }); t.value = val || ''; return t; };
    const f = {
      name: inp(s.characterName, { maxlength: 120, placeholder: 'Swamp Lurker', required: true }),
      type: h('select', {}, CREATURE_TYPES.map(t => h('option', { value: t, text: t }))),
      size: h('select', {}, Object.keys(SIZES).map(Number).sort((a, b) => a - b).map(k => h('option', { value: k, text: `${shift(k)} · ${SIZES[k][0]}` }))),
      threat: h('select', {}, THREATS.map(t => h('option', { value: t, text: t }))),
      level: inp(s.level, { type: 'number', min: 1, max: 110 }),
      armor: inp(s.armor, { type: 'number', min: 0, max: 99 }),
      magick: h('input', { type: 'checkbox', checked: !!s.creature.magick }),
      habitat: inp(s.creature.habitat, { maxlength: 300 }), movement: inp(s.creature.movement, { maxlength: 300, placeholder: 'walk 6, swim 8' }),
      senses: inp(s.creature.senses, { maxlength: 300, placeholder: 'darkvision, tremorsense' }),
      weaknesses: inp((s.creature.weaknesses || []).join(', '), { placeholder: 'fire, bright light (comma separated)' }),
      behavior: area(s.creature.behavior), tactics: area(s.creature.tactics), loot: area(s.creature.loot, 2),
      lore: area(s.background, 4), notes: area(s.notes, 2),
    };
    if (!CREATURE_TYPES.includes(s.creature.type)) f.type.append(h('option', { value: s.creature.type, text: s.creature.type }));
    f.type.value = s.creature.type; f.size.value = String(s.creature.size ?? 0); f.threat.value = s.creature.threat;
    const stats = {};
    const statRow = h('div', { class: 'attrs' }, STATS.map(([k, ab, full]) => {
      stats[k] = inp((s.stats || {})[k] ?? 10, { type: 'number', min: 1, max: 100, title: full });
      return h('div', { class: 'attr' }, h('small', { text: ab }), stats[k]);
    }));
    const rowList = (items, make, empty) => {
      const box = h('div', { class: 'rows' });
      const add = it => { const r = make(it); r.append(h('button', { type: 'button', class: 'ghost small danger', text: '×', title: 'Remove', onclick: () => r.remove() })); box.append(r); };
      (items || []).forEach(add);
      return { box, add: () => add(empty()) };
    };
    const atk = rowList(s.creature.attacks, a => h('div', { class: 'r' }, inp(a.name, { placeholder: 'Attack', maxlength: 60 }), inp(a.damage, { placeholder: '2d6+1', maxlength: 40 }), inp(a.notes, { placeholder: 'Notes (reach, poison, BTN to resist…)', maxlength: 400 })), () => ({}));
    const abil = rowList(s.creature.abilities, a => h('div', { class: 'r two' }, inp(a.name, { placeholder: 'Ability', maxlength: 80 }), inp(a.text, { placeholder: 'What it does', maxlength: 800 })), () => ({}));
    const sk = rowList(Object.entries(s.skills || {}).filter(([, l]) => +l > 0).map(([name, level]) => ({ name, level })),
      x => h('div', { class: 'r sk' }, inp(x.name, { placeholder: 'Skill (Stealth, Perception…)', maxlength: 60, list: 'skillNames' }), inp(x.level, { type: 'number', min: 0, max: 100, placeholder: '0-100' })), () => ({}));
    const portrait = avatar ? h('img', { class: 'portrait', src: avatar, alt: '' }) : h('div', { class: 'portrait', text: '🐾' });
    const pic = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true, onchange: () => {
      const file = pic.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = async () => { avatar = await shrinkImage(rd.result, 768, file.size > 400 * 1024); portrait.replaceWith(Object.assign(h('img', { class: 'portrait', src: avatar, alt: '' }))); };
      rd.readAsDataURL(file);
    } });
    const save = act(async () => {
      const name = f.name.value.trim(); if (!name) { f.name.focus(); throw new Error('Name the creature first.'); }
      const skills = {};
      sk.box.querySelectorAll('.r').forEach(r => { const [n, l] = r.querySelectorAll('input'); if (n.value.trim() && +l.value > 0) skills[n.value.trim()] = +l.value; });
      const sheet = Object.assign(s, {
        sheetType: 'creature', characterName: name, level: +f.level.value || 1, armor: +f.armor.value || 0, avatar,
        stats: Object.fromEntries(STATS.map(([k]) => [k, +stats[k].value || 10])), skills, background: f.lore.value, notes: f.notes.value,
        creature: { type: f.type.value, size: +f.size.value, threat: f.threat.value, habitat: f.habitat.value, movement: f.movement.value, senses: f.senses.value,
          magick: f.magick.checked, behavior: f.behavior.value, tactics: f.tactics.value, loot: f.loot.value,
          weaknesses: f.weaknesses.value.split(',').map(x => x.trim()).filter(Boolean),
          attacks: [...atk.box.querySelectorAll('.r')].map(r => { const [a, b, c] = r.querySelectorAll('input'); return { name: a.value.trim(), damage: b.value.trim(), notes: c.value.trim() }; }).filter(a => a.name),
          abilities: [...abil.box.querySelectorAll('.r')].map(r => { const [a, b] = r.querySelectorAll('input'); return { name: a.value.trim(), text: b.value.trim() }; }).filter(a => a.name) },
      });
      const body = { sheet, kind: 'creature', source: 'editor', thumb: avatar ? await shrinkImage(avatar, 96, true) : null };
      if (cur) body.id = cur.meta.id; else if (campNum()) body.campaign_id = campNum();
      const j = await api('save', body);
      toast(`Saved “${j.name}”`);
      await loadList(); await openSheet(j.id);
    });
    const L = (label, el, cls) => h('label', { class: cls }, label, el);
    v.append(h('datalist', { id: 'skillNames' }, Object.keys(BASE_SKILLS).map(n => h('option', { value: n }))),
      h('article', { class: 'sheet' },
        h('div', { class: 'head' }, h('div', {}, portrait, h('button', { type: 'button', class: 'ghost small', style: 'margin-top:6px;width:132px', text: 'Picture…', onclick: () => pic.click() }), pic),
          h('div', {}, h('h1', { text: cur ? `Edit: ${cur.meta.name}` : 'New creature' }),
            h('p', { class: 'fine', text: 'Creature sheets keep the IPRPS attributes, plus size, attacks, abilities and behavior. HP, Speed and Dodge are worked out from the attributes when you save.' }),
            h('div', { class: 'toolbar' }, h('button', { text: '💾 Save creature', onclick: save }),
              h('button', { class: 'ghost', text: 'Cancel', onclick: () => (cur ? openSheet(cur.meta.id) : (current = null, renderView())) })))),
        h('div', { class: 'cards' },
          wide('Creature', h('div', { class: 'ed' }, L('Name', f.name), L('Type', f.type), L('Size', f.size), L('Threat', f.threat), L('Level', f.level),
            L('Natural Armor Rating (AR)', f.armor), h('label', { class: 'check' }, f.magick, 'Uses magick (has a Mana Pool)'))),
          wide('Attributes', statRow),
          wide('Attacks', atk.box, h('button', { type: 'button', class: 'ghost small', text: '+ Attack', onclick: atk.add })),
          wide('Abilities', abil.box, h('button', { type: 'button', class: 'ghost small', text: '+ Ability', onclick: abil.add })),
          wide('Skills', sk.box, h('button', { type: 'button', class: 'ghost small', text: '+ Skill', onclick: sk.add })),
          wide('Where and how', h('div', { class: 'ed' }, L('Habitat', f.habitat), L('Movement', f.movement), L('Senses', f.senses), L('Weaknesses', f.weaknesses))),
          wide('Behavior and loot', h('div', { class: 'ed' }, L('Behavior', f.behavior), L('Tactics', f.tactics), L('Loot', f.loot))),
          wide('Lore', h('div', { class: 'ed' }, L('Lore and description', f.lore, 'wide'), L('Notes', f.notes, 'wide')))),
        h('div', { class: 'toolbar' }, h('button', { text: '💾 Save creature', onclick: save }))));
    f.name.focus();
  }

  // ---------------------------------------------------------------- import
  let pendingFiles = [];
  function startImport(files) {
    pendingFiles = [...files].filter(f => /\.(json|iprps)$/i.test(f.name) || f.type === 'application/json');
    if (!pendingFiles.length) return toast('Choose .json or .iprps character sheet files.', true);
    $('importCount').textContent = pendingFiles.length === 1 ? `File: ${pendingFiles[0].name}` : `${pendingFiles.length} files`;
    campaignOptions($('importCampaign'), { keep: campNum() || '' });
    $('importResults').textContent = ''; $('importGo').disabled = false; $('importGo').hidden = false; $('importClose').textContent = 'Cancel';
    $('importDlg').showModal();
  }
  function existingFor(sheet, kind) {
    const k = kind || (sheet.sheetType === 'npc' ? 'npc' : sheet.sheetType === 'creature' ? 'creature' : 'pc');
    const name = norm(sheet.characterName), player = norm(sheet.playerName);
    return all.find(r => r.kind === k && norm(r.name) === name && (k !== 'pc' || norm(r.player_name) === player));
  }
  // Import one parsed sheet. Returns the API result (id, name, warnings) plus whether it updated one.
  async function importSheet(sheet, { kind = '', campaign = 0, update = true, fileName = '', source = 'import' } = {}) {
    if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) throw new Error('not an IPRPS character sheet');
    const thumb = await preparePortrait(sheet);
    const old = update ? existingFor(sheet, kind) : null;
    const body = { sheet, kind: kind || undefined, file_name: fileName, source, thumb };
    if (old) body.id = old.id; else if (campaign) body.campaign_id = campaign;
    const j = await api('save', body);
    return { ...j, updated: !!old };
  }
  async function runImport() {
    $('importGo').disabled = true;
    const ul = $('importResults'); ul.textContent = '';
    const opts = { kind: $('importKind').value, campaign: +$('importCampaign').value || 0, update: $('importUpdate').checked };
    let lastId = 0, ok = 0;
    for (const f of pendingFiles) {
      const li = h('li', { text: `${f.name}: importing…` }); ul.append(li);
      try {
        if (f.size > 16 * 1024 * 1024) throw new Error('larger than 16 MB');
        let sheet; try { sheet = JSON.parse(await f.text()); } catch { throw new Error('not a JSON file'); }
        const j = await importSheet(sheet, { ...opts, fileName: f.name });
        li.className = j.warnings.length ? 'warn' : 'ok';
        li.textContent = `✔ ${j.name} (${KIND[j.kind]}) ${j.updated ? 'updated' : 'added'}${j.warnings.length ? ' — ' + j.warnings.join(' ') : ''}`;
        lastId = j.id; ok++;
        await loadList();
      } catch (e) { li.className = 'err'; li.textContent = `✖ ${f.name}: ${e.message}`; }
    }
    $('importGo').hidden = true; $('importClose').textContent = 'Done';
    if (lastId) openSheet(lastId);
    toast(`${ok} of ${pendingFiles.length} imported`, ok < pendingFiles.length);
  }

  // ---------------------------------------------------------------- the Oracle (Medium and Advanced)
  let oracleKind = 'npc';
  function startOracle(kind) {
    oracleKind = kind;
    $('oracleTitle').textContent = kind === 'creature' ? '✦ A creature sheet from the Oracle' : '✦ An NPC sheet from the Oracle';
    campaignOptions($('oracleCampaign'), { keep: campNum() || (current && current.meta.campaign_id) || '' });
    $('oracleStatus').textContent = ''; $('oracleGo').disabled = false;
    $('oracleDlg').showModal(); $('oracleDetails').focus();
  }
  async function runOracle(e) {
    e.preventDefault();
    $('oracleGo').disabled = true;
    $('oracleStatus').innerHTML = '<span class="spin">✦</span> The Oracle is writing the sheet… this can take a minute or two.';
    try {
      const j = await api('sheet_generate', { kind: oracleKind, details: $('oracleDetails').value, level: +$('oracleLevel').value || null,
        campaign: +$('oracleCampaign').value || 0 }, '', '../oracle/api.php');
      $('oracleDlg').close(); $('oracleDetails').value = '';
      toast(`The Oracle created “${j.name}”`);
      await loadList(); openSheet(j.id);
    } catch (err) { $('oracleStatus').textContent = err.message; $('oracleGo').disabled = false; }
  }

  // ---------------------------------------------------------------- inside the IPRPS Table console
  function sendControl(m, player) {
    const sel = h('select', { title: 'Show this sheet on a player\'s screen (as a text card)' },
      h('option', { value: '', text: 'Show to…' }),
      roster.length ? roster.map(p => h('option', { value: p.id, text: `${p.name}${p.character ? ' · ' + p.character : ''}${p.online ? '' : ' (away)'}` })) : null,
      h('option', { value: '*', text: 'Everyone at the table' }));
    sel.onchange = act(async () => {
      const to = sel.value; sel.value = ''; if (!to) return;
      const j = await api('summary', null, `&id=${m.id}`);
      post({ type: 'iprps-table-push', target: to === '*' ? { type: 'all' } : { type: 'select', ids: [to] }, title: j.title, text: j.text });
    });
    if (player) {
      const quick = h('button', { class: 'ghost', text: `Show to ${player.name}`, title: 'Show this sheet on its player\'s screen' });
      quick.onclick = act(async () => {
        const j = await api('summary', null, `&id=${m.id}`);
        post({ type: 'iprps-table-push', target: { type: 'select', ids: [player.id] }, title: j.title, text: j.text });
      });
      return [quick, sel];
    }
    return sel;
  }
  function post(msg) { if (parentWin) parentWin.postMessage(msg, parentOrigin); }
  function setupEmbed() {
    document.querySelectorAll('.embed-only').forEach(x => { x.hidden = false; });
    $('atTable').onchange = renderList;
    window.addEventListener('message', act(async e => {
      if (e.source !== window.parent || !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(e.origin)) return;
      parentWin = e.source; parentOrigin = e.origin;
      const d = e.data || {};
      if (d.type === 'iprps-table-roster') {
        roster = Array.isArray(d.roster) ? d.roster : [];
        renderList(); if (current && current.meta.kind === 'pc') renderView();
      } else if (d.type === 'iprps-table-pushed') {
        d.ok ? toast(`Shown on ${d.sent} screen${d.sent === 1 ? '' : 's'}`) : toast(d.error || 'Could not show it', true);
      } else if (d.type === 'iprps-table-import') {
        const j = await importSheet(d.sheet, { campaign: campNum(), update: true, fileName: d.fileName || '', source: 'table' });
        toast(`${j.updated ? 'Updated' : 'Added'} “${j.name}”${d.playerName ? ' from ' + d.playerName : ''}${j.warnings.length ? ' — ' + j.warnings.join(' ') : ''}`);
        post({ type: 'iprps-sheets-imported', id: j.id, name: j.name, updated: j.updated, ref: d.ref });
        await loadList(); openSheet(j.id);
      } else if (d.type === 'iprps-table-find') {
        const r = all.find(x => x.kind === 'pc' && norm(x.player_name) === norm(d.name)) || all.find(x => d.character && norm(x.name) === norm(d.character));
        if (r) openSheet(r.id);
        else toast(`No sheet for ${d.name} yet. They can send it from “📜 Sheet” on their device.`, true);
      }
    }));
  }

  // ---------------------------------------------------------------- wiring
  async function boot(user) {
    $('who').textContent = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username;
    try { info = await api('info'); } catch (e) { $('banner').textContent = e.message; $('banner').hidden = false; return; }
    document.querySelectorAll('.oracle-only').forEach(x => { x.hidden = !info.oracle; });
    if (!info.creator) $('blankLink').hidden = true;
    $('campaign').onchange = () => { try { localStorage.setItem('charsheets.campaign', $('campaign').value); } catch {} renderList(); };
    let t; $('search').oninput = () => { clearTimeout(t); t = setTimeout(renderList, 150); };
    document.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => { kindTab = b.dataset.kind; renderList(); }; });
    $('importFile').onchange = () => { startImport($('importFile').files); $('importFile').value = ''; };
    $('importGo').onclick = e => { e.preventDefault(); runImport(); };
    $('oracleGo').onclick = runOracle;
    $('newBtn').onclick = () => { $('newMenu').hidden = !$('newMenu').hidden; };
    document.addEventListener('click', e => { if (!e.target.closest('.menu')) $('newMenu').hidden = true; });
    $('newMenu').querySelectorAll('[data-new]').forEach(b => { b.onclick = () => {
      $('newMenu').hidden = true;
      const k = b.dataset.new;
      if (k.startsWith('oracle-')) startOracle(k.slice(7)); else newSheet(k);
    }; });
    let depth = 0;
    document.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { depth++; $('dropzone').hidden = false; } });
    document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('dropzone').hidden = true; } });
    document.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', e => { depth = 0; $('dropzone').hidden = true; if (e.dataTransfer.files.length) { e.preventDefault(); startImport(e.dataTransfer.files); } });
    if (EMBED) setupEmbed();
    try { await loadCampaigns(); await loadList(); } catch (e) { $('banner').textContent = e.message; $('banner').hidden = false; return; }
    const want = +P.get('id');
    if (want && all.some(r => r.id === want)) openSheet(want);
    if (EMBED) window.parent.postMessage({ type: 'iprps-sheets-ready' }, '*');   // carries no data; the console answers with the roster
  }

  if (!window.IPAuth) {
    $('banner').innerHTML = 'Sign-in system not found: <code>../auth/auth-client.js</code> must exist (<code>/srv/www/iprps/auth/</code>).';
    $('banner').hidden = false;
  } else if (IPAuth.user) boot(IPAuth.user);
  else document.addEventListener('ipauth:ready', e => boot(e.detail), { once: true });
})();
