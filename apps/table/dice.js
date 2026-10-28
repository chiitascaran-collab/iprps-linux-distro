// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Table - dice. All rolls happen on the Session Master's computer (crypto random).
'use strict';
const crypto = require('crypto');
const d = sides => crypto.randomInt(1, sides + 1);
const int = (v, def, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
const sgn = n => (n < 0 ? `− ${-n}` : `+ ${n}`);
const shift = { skill: s => Math.floor(s / 10), attr: a => a - 10 };

const bandA = r => (r <= 6 ? 'Failure' : r <= 12 ? 'Zone of Uncertainty' : 'Success');
const bandB = r => (r <= 6 ? 'Weak' : r <= 14 ? 'Standard' : r <= 19 ? 'Strong' : 'Peak');

// One die that explodes on its maximum (roll again and add), capped at 20 extra rolls.
function explode(sides) {
  const rolls = [d(sides)];
  while (sides > 1 && rolls[rolls.length - 1] === sides && rolls.length < 21) rolls.push(d(sides));
  return { total: rolls.reduce((a, b) => a + b, 0), rolls };
}

// ---------------------------------------------------------------- expressions: 2d6+3, d20, 4d6kh3, 1d6!, d%
const TERM = /([+-])(?:(\d*)d(\d+|%)(!)?(?:k([hl])(\d+))?|(\d+))/gy;
function rollExpr(src) {
  let s = String(src || '').toLowerCase().replace(/\s+/g, '');
  if (!s) throw new Error('Type dice, for example 2d6+3');
  if (s.length > 60) throw new Error('That roll is too long');
  if (!/^[+-]/.test(s)) s = '+' + s;
  TERM.lastIndex = 0;
  let total = 0, dice = 0, pos = 0, m;
  const parts = [];
  while (pos < s.length && (m = TERM.exec(s)) && m.index === pos) {
    pos = TERM.lastIndex;
    const sign = m[1] === '-' ? -1 : 1;
    if (m[7] !== undefined) {
      const n = int(m[7], 0, 0, 100000); total += sign * n; parts.push(`${sign < 0 ? '−' : '+'} ${n}`); continue;
    }
    const n = m[2] === '' ? 1 : int(m[2], 1, 1, 100), sides = m[3] === '%' ? 100 : int(m[3], 6, 2, 1000);
    if (String(m[2]) !== '' && +m[2] > 100) throw new Error('At most 100 dice at once');
    if (+m[3] > 1000) throw new Error('At most 1000 sides');
    if ((dice += n) > 200) throw new Error('Too many dice');
    let rolls = Array.from({ length: n }, () => (m[4] ? explode(sides).total : d(sides)));
    let shown = rolls.join(', ');
    if (m[5]) {
      const k = Math.min(n, int(m[6], 1, 1, 100));
      const order = rolls.map((v, i) => [v, i]).sort((a, b) => (m[5] === 'h' ? b[0] - a[0] : a[0] - b[0]));
      const keep = new Set(order.slice(0, k).map(x => x[1]));
      shown = rolls.map((v, i) => (keep.has(i) ? `${v}` : `(${v})`)).join(', ');
      rolls = rolls.filter((_, i) => keep.has(i));
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    total += sign * sum;
    parts.push(`${sign < 0 ? '−' : '+'} ${n}d${m[3]}${m[4] || ''}${m[5] ? 'k' + m[5] + m[6] : ''} [${shown}]`);
  }
  if (pos !== s.length) throw new Error(`Can't read "${src}". Try 2d6+3, d20, 4d6kh3 or 1d6!`);
  const pretty = s.replace(/^\+/, '').replace(/([+-])/g, ' $1 ');
  return { total, detail: parts.join(' ').replace(/^\+ /, ''), expr: pretty };
}

// ---------------------------------------------------------------- IPRPS rolls
// Fields shown in the dice panel for each kind. Attribute = score (10 is average), Skill = 0-100.
const KINDS = {
  check: { fields: [['attr', 'Attribute', 10, 1, 60], ['skill', 'Skill', 0, 0, 100], ['btn', 'BTN (optional)', '', 0, 200], ['band', 'Band', 'A', ['A', 'B']]] },
  initiative: { fields: [['dex', 'DEX', 10, 1, 60], ['mod', 'Other modifier', 0, -50, 50]] },
  trinity: { fields: [['hydra', 'Impact dice (Hydra)', 1, 1, 8], ['impact', 'Impact bonus', 0, -50, 50], ['guard', 'Guard bonus', 0, -50, 50]] },
  dual: { fields: [['attr', 'Attribute', 10, 1, 60], ['skill', 'Skill', 0, 0, 100], ['guard', 'Target Guard (optional)', '', 0, 200]] },
  convergence: { fields: [['blur', 'Blur level', 2, ['0', '1', '2', '3', '4', '5', '6']], ['attr', 'Attribute', 10, 1, 60], ['skill', 'Skill', 0, 0, 100]] },
  rps: { fields: [['throw', 'Stance', 'random', ['random', 'rock', 'paper', 'scissors']]] },
  expr: { fields: [['mod', 'Modifier', 0, -100, 100]] },
  weapon: { fields: [['mod', 'Modifier', 0, -100, 100], ['ar', 'Target AR (optional)', '', 0, 200]] },
};
const BLUR = [['Glacial', 1, 50, 50], ['Heavy', 1, 30, 30], ['Balanced', 1, 20, 20], ['Precise', 2, 10, 10], ['Rapid', 3, 8, 8], ['Swift', 4, 6, 6], ['Flurry', 6, 4, 4]];
const IMPACT = r => (r <= 2 ? 'Glancing: light wound, −1 next action' : r <= 4 ? 'Solid: −2 all actions for 1d6 rounds, bleeding' : 'Critical: incapacitated unless CON Effectiveness 15+');

function rollPreset(preset, p = {}) {
  const k = preset.kind;
  const opt = (key, lo, hi) => (p[key] === '' || p[key] === undefined || p[key] === null ? null : int(p[key], null, lo, hi));
  if (k === 'check') {
    const attr = int(p.attr, 10, 1, 60), skill = int(p.skill, 0, 0, 100), btn = opt('btn', 0, 200), band = p.band === 'B' ? 'B' : 'A';
    const r = d(20), total = r + shift.skill(skill) + shift.attr(attr);
    const lines = [[`d20`, `${r} → ${band === 'B' ? bandB(r) : bandA(r)} (Band ${band})`]];
    if (btn !== null) lines.push([`vs BTN ${btn}`, total >= btn ? 'Beats it' : 'Falls short']);
    return { total, natural: r, detail: `d20 [${r}] ${sgn(shift.skill(skill))} skill shift ${sgn(shift.attr(attr))} attribute shift`, lines };
  }
  if (k === 'initiative') {
    const dex = int(p.dex, 10, 1, 60), mod = int(p.mod, 0, -50, 50), r = d(20);
    return { total: r + shift.attr(dex) + mod, natural: r, detail: `d20 [${r}] ${sgn(shift.attr(dex))} DEX${mod ? ' ' + sgn(mod) : ''}`, lines: [] };
  }
  if (k === 'trinity') {
    const n = int(p.hydra, 1, 1, 8), ib = int(p.impact, 0, -50, 50), gb = int(p.guard, 0, -50, 50);
    const v = d(3), imp = Array.from({ length: n }, () => d(20)), g = d(12);
    const lines = [['Velocity d3', `${v}${v === 3 ? ' (fastest)' : ''}`]];
    imp.forEach((r, i) => lines.push([`Impact d20${n > 1 ? ' #' + (i + 1) : ''}`, `${r + ib} (rolled ${r} → ${bandB(r)})`]));
    lines.push(['Guard d12', `${g + gb}${gb ? ` (rolled ${g})` : ''}`]);
    return { total: null, detail: `1d3 + ${n}d20 + 1d12${n > 1 ? ' (Hydra Hand)' : ''}`, lines };
  }
  if (k === 'dual') {
    const attr = int(p.attr, 10, 1, 60), skill = int(p.skill, 0, 0, 100), guard = opt('guard', 0, 200);
    const r = d(20), total = r + shift.skill(skill) + shift.attr(attr);
    const lines = [];
    const hit = guard === null ? null : total >= guard;
    if (hit !== null) lines.push([`vs Guard ${guard}`, hit ? 'Hit' : 'Miss']);
    if (hit !== false) { const i = d(6); lines.push([`Impact d6${hit === null ? ' (if it hits)' : ''}`, `${i} → ${IMPACT(i)}`]); }
    return { total, natural: r, detail: `d20 [${r}] ${sgn(shift.skill(skill))} skill shift ${sgn(shift.attr(attr))} attribute shift`, lines };
  }
  if (k === 'convergence') {
    const b = int(p.blur, 2, 0, 6), [name, n, sides, cap] = BLUR[b];
    const attr = int(p.attr, 10, 1, 60), skill = int(p.skill, 0, 0, 100);
    const dice = Array.from({ length: n }, () => explode(sides));
    const sum = dice.reduce((a, x) => a + x.total, 0), sk = Math.min(shift.skill(skill), cap);
    const shown = dice.map(x => (x.rolls.length > 1 ? `${x.rolls.join('+')}💥` : x.rolls[0])).join(', ');
    return { total: sum + shift.attr(attr) + sk, detail: `Blur ${b} ${name}: ${n}d${sides} [${shown}] ${sgn(shift.attr(attr))} attribute ${sgn(sk)} skill (cap +${cap})`,
      lines: dice.some(x => x.rolls.length > 1) ? [['Exploded', 'Maximum rolled: rolled again and added']] : [] };
  }
  if (k === 'rps') {
    const T = ['rock', 'paper', 'scissors'], t = T.includes(p.throw) ? p.throw : T[d(3) - 1];
    const label = { rock: 'Rock (Heavy / Defensive)', paper: 'Paper (Magical / Ranged)', scissors: 'Scissors (Precision / Melee)' }[t];
    return { total: null, detail: label, lines: [['Beats', { rock: 'Scissors', paper: 'Rock', scissors: 'Paper' }[t]]] };
  }
  if (k === 'expr' || k === 'weapon') {
    const mod = int(p.mod, 0, -100, 100), ar = k === 'weapon' ? opt('ar', 0, 200) : null;
    const r = rollExpr(preset.expr + (mod ? (mod > 0 ? '+' : '') + mod : ''));
    const lines = [];
    if (preset.band && /^1?d20$/i.test(String(preset.expr).trim())) {
      const nat = parseInt(r.detail.match(/\[(\d+)\]/)[1], 10);
      lines.push(['d20', `${nat} → ${preset.band === 'B' ? bandB(nat) : bandA(nat)} (Band ${preset.band})`]);
    }
    if (ar !== null) lines.push([`After AR ${ar}`, `${Math.max(0, r.total - ar)} damage`]);
    return { total: r.total, detail: r.detail, lines };
  }
  throw new Error('Unknown roll');
}

module.exports = { rollExpr, rollPreset, KINDS, bandA, bandB };
