// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS File Viewer - what each IPRPS file type should contain, and the checks.
// Works on Markdown/text and on JSON versions of the same files.
// analyze(name, text) -> { type, label, json, report: [{level: error|warn|ok|info, group, text}], summary, outline }
(function (root) {
  'use strict';
  const BASE_SKILLS = ['Melee Weapons', 'Ranged Weapons', 'Martial Arts', 'Parry', 'Dodge', 'Weapon Specialization', 'Shield Combat', 'Shield Bash',
    'Dual Wielding', 'Archery', 'Throwing', 'Athletics', 'Climbing', 'Stealth', 'Swimming', 'Acrobatics', 'Endurance', 'Running', 'Jumping', 'Balance',
    'Escape Artist', 'Investigation', 'Lore', 'Perception', 'Insight', 'Survival', 'Tracking', 'Medicine', 'Nature', 'Animal Handling', 'Navigation',
    'Negotiation', 'Persuasion', 'Deception', 'Streetwise', 'Leadership', 'Public Speaking', 'Intimidation', 'Diplomacy', 'Bluff', 'Etiquette',
    'Concentration', 'Meditation', 'Resistance', 'Mental Focus', 'Engineering', 'Crafting', 'Piloting', 'Repair', 'Alchemy', 'Magick Theory',
    'Magick Recovery', 'Lock Picking', 'Trap Detection', 'Disguise', 'Forgery', 'Gambling', 'Sleight of Hand'];
  const STATS = ['int', 'str', 'dex', 'wis', 'con', 'wil', 'cha'];
  const COMBAT_MODES = /standard|trinity|hand|rock[- ]?paper[- ]?scissors|\brps\b|dual[- ]?die|infinite convergence|convergence/i;
  const TYPES = {
    sheet: 'Character sheet (Character Creator)', srpatch: 'Session Run Patch', capstone: 'Session Master Capstone', pcapstone: 'Player Capstone',
    ipai: 'AI Profile / Profile Patch', iprps: 'IPRPS data file', json: 'JSON file', text: 'Text file',
  };

  // ---------------------------------------------------------------- helpers
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  function flatten(obj, path = '', out = []) {
    if (Array.isArray(obj)) obj.forEach((v, i) => flatten(v, path, out));
    else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) {
      const key = k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
      if (v && typeof v === 'object') { out.push(`## ${key}`); flatten(v, key, out); } else out.push(`${key}: ${v}`);
    }
    return out;
  }
  // A field "Name: value" (also **Name:**, - Name:, | Name |, ## Name) or a JSON key of that name.
  function fieldRe(name) {
    const n = name.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s_-]*');
    return new RegExp(`(^|\\n|\\|)[ \\t>]*(?:[-*•]\\s*|\\d+[.)]\\s*|#{1,6}\\s*|\\|\\s*)?(?:\\*\\*|__)?${n}(?:\\*\\*|__)?\\s*(?::|：|\\||\\*\\*:|\\s*$)`, 'i');
  }
  function has(ctx, name) { return fieldRe(name).test(ctx.text) || ctx.keys.has(norm(name)); }
  function value(ctx, name) {
    const n = name.split(/\s+/).join('[\\s_-]*');
    const m = ctx.text.match(new RegExp(`(?:^|\\n|\\|)[ \\t>]*(?:[-*•][ \\t]*|\\|[ \\t]*)?(?:\\*\\*|__)?${n}(?:\\*\\*|__)?[ \\t]*(?::|：)[ \\t]*(?:\\*\\*)?[ \\t]*([^\\n|]*)`, 'i'));
    return m ? m[1].replace(/\*\*/g, '').trim() : '';
  }
  function heading(ctx, re) { return ctx.headings.some(h => re.test(h.text)) || [...ctx.keys].some(k => re.test(k)); }
  function outlineOf(text) {
    const out = [];
    for (const [i, line] of text.split('\n').entries()) { const m = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/); if (m) out.push({ level: m[1].length, text: m[2].replace(/\*\*/g, ''), line: i }); }
    return out;
  }
  function common(ctx, R) {
    const dcac = ctx.text.match(/\b(?:DC|AC)\s*\d+|\b(?:Difficulty Class|Armor Class)\b/g);
    if (dcac) R.push(['warn', 'IPRPS rules', `Uses ${[...new Set(dcac)].slice(0, 4).join(', ')}: IPRPS uses BTN (Base Target Number) for difficulty and AR (Armor Rating, subtracted from damage).`]);
    else R.push(['ok', 'IPRPS rules', 'No DC or AC: difficulty and armor use IPRPS terms.']);
  }

  // ---------------------------------------------------------------- character sheets
  function attrCost(a, l) { if (l === 10) return 0; const per = a === 'int' || a === 'dex' ? 10 : 5; return l > 10 ? (l - 10) * per : -((10 - l) * 2); }
  function skillCost(l) { let c = 0; for (let i = 1; i <= Math.min(l, 100); i++) c += i <= 3 ? 1 : i <= 9 ? 2 : i === 10 ? 5 : i <= 14 ? 3 : i === 15 ? 10 : i <= 19 ? 5 : i === 20 ? 15 : i <= 49 ? 10 : i === 50 ? 50 : i <= 99 ? 20 : 100; return c; }
  function sheet(o, R, S) {
    const g = 'Character sheet';
    if (o.format === 'iprps-character-sheet') R.push(['ok', g, `IPRPS character sheet, format version ${o.formatVersion || 1}${o.sheetType ? `, ${o.sheetType === 'pc' ? 'player character' : o.sheetType}` : ''}.`]);
    else R.push(['info', g, 'No format tag: an older Character Creator file. That is fine; Character Sheets reads it.']);
    const name = String(o.characterName || o.name || '').trim();
    R.push(name ? ['ok', g, `Character name: ${name}.`] : ['error', g, 'No character name.']);
    const lvl = +o.level;
    if (o.level !== undefined && !(lvl >= 1 && lvl <= 110)) R.push(['warn', g, `Level ${o.level} is outside 1–110.`]);
    const st = o.stats || {};
    const bad = STATS.filter(k => st[k] !== undefined && !(Number.isInteger(+st[k]) && +st[k] >= 1 && +st[k] <= 100));
    const missing = STATS.filter(k => st[k] === undefined);
    if (missing.length) R.push(['warn', 'Attributes', `Missing ${missing.map(k => k.toUpperCase()).join(', ')} (counted as 10).`]);
    if (bad.length) R.push(['error', 'Attributes', `${bad.map(k => `${k.toUpperCase()} ${st[k]}`).join(', ')}: attributes run from 1 to 100.`]);
    const high = STATS.filter(k => +st[k] > 20);
    if (o.sheetType !== 'creature' && high.length) R.push(['warn', 'Attributes', `${high.map(k => `${k.toUpperCase()} ${st[k]}`).join(', ')}: above 20 is unusual for a character (the Creator's buttons stop at 20).`]);
    if (!bad.length && !missing.length) R.push(['ok', 'Attributes', STATS.map(k => `${k.toUpperCase()} ${st[k]}`).join('  ')]);
    // skills
    const skills = o.skills && typeof o.skills === 'object' ? (Array.isArray(o.skills) ? Object.fromEntries(o.skills.map(x => [x.name, x.level])) : o.skills) : {};
    const custom = new Set((o.customSkills || []).map(c => c && c.name));
    const trained = Object.entries(skills).filter(([, l]) => +l > 0);
    const outOfRange = trained.filter(([, l]) => !(+l >= 0 && +l <= 100));
    if (outOfRange.length) R.push(['error', 'Skills', `${outOfRange.map(([n, l]) => `${n} ${l}`).join(', ')}: skills run from 0 to 100.`]);
    const unknown = trained.filter(([n]) => !BASE_SKILLS.includes(n) && !custom.has(n)).map(([n]) => n);
    if (unknown.length) R.push(['warn', 'Skills', `Not in the skill list or the sheet's custom skills: ${unknown.join(', ')}. The Creator shows them as custom skills after import.`]);
    R.push(['ok', 'Skills', trained.length ? `${trained.length} trained: ${trained.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, l]) => `${n} ${l}`).join(', ')}${trained.length > 8 ? '…' : ''}` : 'No trained skills.']);
    // development points
    if (o.sheetType !== 'creature') {
      const spells = (o.spells || []).filter(s => s && s.acquired);
      const spent = STATS.reduce((a, k) => a + attrCost(k, +(st[k] ?? 10)), 0) + trained.reduce((a, [, l]) => a + skillCost(+l), 0)
        + spells.reduce((a, s) => a + 10 + skillCost(+s.skillLevel || 0), 0);
      const budget = (+o.characterPoints || 0) + (+o.xpPool || 0);
      S.push(['DP spent', spent], ['DP budget', o.characterPoints !== undefined ? budget : '—']);
      if (o.characterPoints === undefined) R.push(['info', 'Development points', `Spent ${spent} DP (no starting points on the sheet).`]);
      else if (spent > budget) R.push(['warn', 'Development points', `Spends ${spent} DP of ${budget} (starting ${o.characterPoints} + XP pool ${o.xpPool || 0}): ${spent - budget} over budget.`]);
      else R.push(['ok', 'Development points', `Spends ${spent} DP of ${budget}; ${budget - spent} left.`]);
      if (o.remainingPoints !== undefined && +o.remainingPoints !== budget - spent) R.push(['info', 'Development points', `The sheet says ${o.remainingPoints} remaining; worked out again it's ${budget - spent}. Opening it in the Character Creator corrects it.`]);
      const q = (o.quirks || []).length;
      if (q > 5) R.push(['warn', 'Quirks', `${q} quirks: the rule is no more than 5.`]);
      ['advantages', 'disadvantages', 'quirks'].forEach(k => S.push([k[0].toUpperCase() + k.slice(1), (o[k] || []).length]));
    }
    if (o.sheetType === 'creature') {
      const c = o.creature || {};
      if (!c.attacks || !c.attacks.length) R.push(['warn', 'Creature', 'No attacks listed.']);
      if (c.size !== undefined && !(+c.size >= -3 && +c.size <= 6)) R.push(['error', 'Creature', `Size ${c.size} is outside −3 to +6.`]);
      R.push(['ok', 'Creature', [c.type, c.size !== undefined ? `size ${c.size}` : '', c.threat].filter(Boolean).join(', ') || 'Creature sheet.']);
    }
    if (o.avatar) {
      const okAv = typeof o.avatar === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(o.avatar);
      R.push(okAv ? ['ok', 'Portrait', `Portrait included (${Math.max(1, Math.round(o.avatar.length / 1024))} KB).`] : ['warn', 'Portrait', 'The portrait is not a PNG, JPEG, GIF or WebP picture: it will be left out on import.']);
      if (okAv && o.avatar.length > 3 * 1024 * 1024) R.push(['warn', 'Portrait', 'The portrait is larger than 3 MB: Character Sheets will leave it out. Re-export from the current Character Creator.']);
    }
    S.unshift(['Name', name || '—'], ['Level', o.level ?? '—'], ['Race', o.race || (o.creature && o.creature.type) || '—'],
      ['Class', o.class === 'custom' ? o.customClass : o.class || (o.creature && o.creature.threat) || '—'], ['HP', (o.derived && o.derived.hp) ?? '—'], ['AR', o.armor ?? '—']);
  }

  // ---------------------------------------------------------------- Session Run Patch
  function srpatch(ctx, R, S) {
    const need = (g, fields, level) => fields.forEach(f => R.push(has(ctx, f) ? ['ok', g, `${f}${value(ctx, f) ? ': ' + value(ctx, f).slice(0, 90) : ''}`] : [level, g, `Missing: ${f}`]));
    need('Required fields', ['Patch ID', 'Session Title', 'Date', 'SM Name'], 'error');
    const sections = [['Scenario', /scenario/i], ['Beginning', /beginning/i], ['Objectives', /objective/i], ['NPCs', /\bnpcs?\b/i], ['Triggers', /trigger/i], ['SM Notes', /sm\s*notes|session master notes/i]];
    for (const [n, re] of sections) R.push(heading(ctx, re) || has(ctx, n) ? ['ok', 'Sections', n] : [n === 'Scenario' || n === 'Beginning' || n === 'Objectives' ? 'error' : 'warn', 'Sections', `No ${n} section${n === 'Scenario' || n === 'Beginning' || n === 'Objectives' ? ' (a run patch needs Scenario, Beginning and Objectives at minimum)' : ''}.`]);
    need('Scenario', ['Setting', 'Era', 'TL', 'Active Patches', 'Tone', 'Combat System', 'Player Count', 'Session Length'], 'warn');
    need('Beginning', ['Opening Scene', 'Hook', 'Starting Condition', 'Information Given'], 'warn');
    need('Objectives', ['Primary Goal', 'Milestones'], 'warn');
    const cs = value(ctx, 'Combat System');
    if (cs && !COMBAT_MODES.test(cs)) R.push(['warn', 'Scenario', `Combat System “${cs}” isn't one of the five modes (Standard, Trinity Hand, Rock-Paper-Scissors, Dual-Die, Infinite Convergence).`]);
    const tl = value(ctx, 'TL');
    if (tl && !/^\s*(TL\s*)?\d+\+?/i.test(tl)) R.push(['warn', 'Scenario', `TL “${tl}” should be a Technology Level number (0–9+).`]);
    const ms = ctx.text.match(/milestones?[^\n]*\n((?:\s*(?:[-*•]|\d+[.)])\s+.+\n?)+)/i);
    if (ms) { const n = ms[1].trim().split('\n').length; R.push(n >= 3 && n <= 6 ? ['ok', 'Objectives', `${n} milestones.`] : ['warn', 'Objectives', `${n} milestone${n === 1 ? '' : 's'}: a session usually has 3 to 6.`]); }
    if (heading(ctx, /\bnpcs?\b/i)) need('NPCs', ['Name', 'Role', 'Disposition'], 'warn');
    S.push(['Patch ID', value(ctx, 'Patch ID') || '—'], ['Session', value(ctx, 'Session Title') || '—'], ['SM', value(ctx, 'SM Name') || '—'], ['Combat', cs || '—']);
  }

  // ---------------------------------------------------------------- Capstones
  function capstone(ctx, R, S, player) {
    const want = player ? [['Character', /character|name/i], ['HP', /\bhp\b|hit points|health/i], ['Inventory', /inventory|equipment|gear/i], ['Conditions', /condition|status/i]]
                        : [['Party HP', /\bhp\b|hit points|health/i], ['NPC attitudes', /npc|attitude|relationship|\brs\b/i], ['Inventory', /inventory|loot|items/i],
                           ['Active conditions', /condition/i], ['Quest state', /quest|objective/i], ['Combat state', /combat|initiative|round/i]];
    for (const [n, re] of want) R.push(heading(ctx, re) || re.test(ctx.text) ? ['ok', 'Sections', n] : ['warn', 'Sections', `Nothing about ${n}.`]);
    let rsBad = 0, rsN = 0;
    for (const m of ctx.text.matchAll(/\b(?:RS|Relationship(?:\s*Score)?)\s*[:=]?\s*([+-−]?\d+)/gi)) { rsN++; const v = +m[1].replace('−', '-'); if (v < -100 || v > 100) rsBad++; }
    if (rsN) R.push(rsBad ? ['error', 'Values', `${rsBad} Relationship Score${rsBad === 1 ? '' : 's'} outside −100 to +100.`] : ['ok', 'Values', `${rsN} Relationship Score${rsN === 1 ? '' : 's'}, all within −100 to +100.`]);
    let hpBad = []; let hpN = 0;
    for (const m of ctx.text.matchAll(/\bHP\b[^\n\d]{0,12}(-?\d+)\s*\/\s*(\d+)/gi)) { hpN++; if (+m[1] > +m[2]) hpBad.push(`${m[1]}/${m[2]}`); }
    if (hpN) R.push(hpBad.length ? ['warn', 'Values', `HP above maximum: ${hpBad.join(', ')}.`] : ['ok', 'Values', `${hpN} HP value${hpN === 1 ? '' : 's'} (current/maximum) look right.`]);
    S.push(['Kind', player ? 'Player Capstone' : 'SM Capstone'], ['HP entries', hpN], ['RS entries', rsN]);
  }

  // ---------------------------------------------------------------- AI Profiles and Profile Patches
  function ipai(ctx, R, S) {
    const head = ['System', 'Publisher', 'Part', 'Version', 'Compatibility', 'Activation', 'Sections'];
    const found = head.filter(f => has(ctx, f));
    head.forEach(f => R.push(found.includes(f) ? ['ok', 'Patch header', `${f}${value(ctx, f) ? ': ' + value(ctx, f).slice(0, 80) : ''}`] : ['warn', 'Patch header', `Missing: ${f}`]));
    const tiers = [...new Set((ctx.text.match(/\bTier\s*[1-4][AB]?(?:\.5)?/gi) || []).map(t => t.replace(/\s+/, ' ')))];
    if (tiers.length) R.push(['info', 'Structure', `Mentions ${tiers.join(', ')}.`]);
    if (/unified foundation/i.test(ctx.text)) R.push(['info', 'Structure', 'A Unified Foundation profile (Tier 1): the core rules every other patch builds on.']);
    const secs = ctx.headings.length;
    R.push(secs ? ['ok', 'Structure', `${secs} heading${secs === 1 ? '' : 's'}.`] : ['warn', 'Structure', 'No headings: long profiles are easier to read and load with ## headings per section.']);
    S.push(['System', value(ctx, 'System') || '—'], ['Part', value(ctx, 'Part') || '—'], ['Version', value(ctx, 'Version') || '—'], ['Activation', value(ctx, 'Activation') || '—']);
  }

  // ---------------------------------------------------------------- entry point
  function analyze(name, raw) {
    const text = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
    let json = null;
    if (/^\s*[{[]/.test(text)) { try { json = JSON.parse(text); } catch (e) { json = undefined; } }
    const R = [], S = [];
    const ctxText = json ? flatten(json).join('\n') : text;
    const keys = new Set(); if (json) (function walk(o) { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (!Array.isArray(o)) keys.add(norm(k)); walk(v); } })(json);
    const ctx = { text: ctxText, keys, headings: outlineOf(ctxText) };
    if (!text.trim()) return { type: 'text', label: 'Empty file', json, report: [{ level: 'error', group: 'File', text: 'The file is empty.' }], summary: [], outline: [] };
    if (json === undefined) R.push(['error', 'File', 'Starts like JSON but is not valid JSON (a missing comma or quote?). Shown as text.']);
    let type;
    const isSheet = json && !Array.isArray(json) && (json.format === 'iprps-character-sheet' || (json.stats && typeof json.stats === 'object' && ('characterName' in json || 'skills' in json)));
    if (isSheet) type = 'sheet';
    else if (ext === 'srpatch' || (/patch\s*id/i.test(ctxText) && /session\s*title/i.test(ctxText))) type = 'srpatch';
    else if (ext === 'pcapstone') type = 'pcapstone';
    else if (ext === 'capstone' || /\bcapstone\b/i.test(ctxText.slice(0, 600))) type = 'capstone';
    else if (ext === 'ipai' || /unified foundation|profile patch/i.test(ctxText.slice(0, 3000))) type = 'ipai';
    else if (ext === 'iprps') type = 'iprps';
    else type = json ? 'json' : 'text';
    if (type === 'sheet') sheet(json, R, S);
    else if (type === 'srpatch') srpatch(ctx, R, S);
    else if (type === 'capstone' || type === 'pcapstone') capstone(ctx, R, S, type === 'pcapstone');
    else if (type === 'ipai') ipai(ctx, R, S);
    else if (type === 'iprps') R.push(['info', 'File', json ? 'An .iprps file that is not a character sheet: shown as data.' : 'An .iprps file in text form.']);
    if (ext && ext !== 'json' && ext !== 'md' && ext !== 'txt' && ext !== 'iprps' && type !== ext && !(ext === 'pcapstone' && type === 'pcapstone'))
      R.push(['info', 'File', `The extension is .${ext}, but the contents look like a ${TYPES[type]}.`]);
    if (type !== 'json' && type !== 'text') common(ctx, R);
    S.push(['Size', text.length < 10240 ? `${text.length} characters` : `${Math.round(text.length / 1024)} KB`]);
    return { type, label: TYPES[type], json, report: R.map(([level, group, t]) => ({ level, group, text: t })), summary: S, outline: json ? [] : outlineOf(text), text };
  }
  root.IPValidate = { analyze, TYPES };
  if (typeof module !== 'undefined') module.exports = root.IPValidate;
})(typeof window !== 'undefined' ? window : globalThis);
