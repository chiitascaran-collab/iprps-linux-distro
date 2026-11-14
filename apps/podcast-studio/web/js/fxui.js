// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Shared 10-band graphic equalizer panel (live mixer strips and editor tracks use the same control).
import { h, modal } from './util.js';
import { EQ_LABELS, EQ_PRESETS } from './audio.js';

// o: { title, values:[10], onBand(i, db), toggles:[{label, hint, get(), set(v)}] }
export function eqPanel(o) {
  const sliders = [];
  const outs = [];
  const set = (i, v, fire = true) => { sliders[i].value = v; outs[i].textContent = (v > 0 ? '+' : '') + Number(v).toFixed(0); if (fire) o.onBand(i, Number(v)); };
  const bands = h('div', { class: 'eq-bands' }, EQ_LABELS.map((lab, i) => {
    const s = h('input', { type: 'range', min: -12, max: 12, step: 1, value: o.values[i] || 0, class: 'vslider', 'aria-label': lab + ' Hz', oninput: () => set(i, s.value), ondblclick: () => set(i, 0) });
    const out = h('output', {}, '0');
    sliders.push(s); outs.push(out);
    return h('div', { class: 'eq-band' }, out, s, h('span', {}, lab));
  }));
  sliders.forEach((s, i) => set(i, o.values[i] || 0, false));
  const preset = h('select', { onchange: () => { const p = EQ_PRESETS[preset.value]; if (p) p.forEach((v, i) => set(i, v)); } },
    h('option', { value: '' }, 'Presets…'), Object.keys(EQ_PRESETS).map(k => h('option', { value: k }, k)));
  const toggles = (o.toggles || []).map(t => {
    const c = h('input', { type: 'checkbox', checked: !!t.get(), onchange: () => t.set(c.checked) });
    return h('label', { class: 'field check', title: t.hint || '' }, c, h('span', {}, t.label), t.hint ? h('small', {}, t.hint) : null);
  });
  const body = h('div', { class: 'eq-panel' }, h('div', { class: 'row' }, preset, h('span', { class: 'muted' }, 'Double-click a band to reset it. Range ±12 dB.')), bands, h('div', { class: 'eq-toggles' }, toggles));
  return modal(o.title, body, [{ label: 'Done', cls: 'primary' }], { cls: 'wide-modal' });
}
