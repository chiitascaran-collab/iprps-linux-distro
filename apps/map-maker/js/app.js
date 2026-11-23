// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Map Maker - the editor: tools, panels, the library, preview, printing, exports and "Show to players".
(() => {
  'use strict';
  const MM = window.MM, IP = window.IP, h = IP.h, $ = IP.$;
  const DRAFT_KEY = 'mapmaker.draft';

  // ---------------------------------------------------------------- state
  let M = null;                 // the map being edited
  let libId = null;             // its id in the library, once saved
  let dirty = false, online = false, campaign = 0, RW = null;
  let tool = 'select', sel = null, draft = null, drag = null, pathDraft = null, lastMeasure = '';
  let undo = [], redo = [], zoom = 1, panX = 20, panY = 20, spaceDown = false, libCache = null;
  const opt = IP.store.get('mapmaker.opt', {}) || {};
  const O = Object.assign({ terrain: ',', brush: 1, feature: 'tree', rot: 0, size: 1, snap: true, placeKind: 'village', pathType: 'road', pathW: 1, color: '#c0392b', width: 4, fill: false, textSize: 24, allTerrain: false,
    gen: { kind: 'battle', subtype: 'forest', size: 'medium', orientation: 'landscape', style: '', landform: 'coast', climate: 'temperate', rooms: 0, feet10: false } }, opt);
  const saveOpt = () => IP.store.set('mapmaker.opt', O);

  const TOOLS = [
    ['select', '⬚', 'Select and move (V)', 'v'], ['pan', '✋', 'Move the view (H, or hold Space, or the middle mouse button)', 'h'], null,
    ['paint', '🖌', 'Paint terrain (B)', 'b'], ['fill', '🪣', 'Fill an area with terrain (G)', 'g'], ['stamp', '♣', 'Stamp objects: trees, doors, furniture… (S)', 's'],
    ['place', '📍', 'Name a place: city, town, village, dungeon, room, region… (P)', 'p'], ['path', '〰', 'Draw a road, river, trail, street or wall (R)', 'r'], null,
    ['pen', '✎', 'Draw freehand (D)', 'd'], ['line', '╱', 'Line (L)', 'l'], ['arrow', '➚', 'Arrow (A)', 'a'], ['rect', '▭', 'Rectangle (Q)', 'q'], ['ellipse', '◯', 'Ellipse (O)', 'o'], ['text', 'T', 'Text note (T)', 't'], null,
    ['erase', '⌫', 'Erase an object, note, place or path (E)', 'e'], ['measure', '📏', 'Measure a distance (M)', 'm'],
  ];
  const COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#ffffff', '#111111'];

  // ---------------------------------------------------------------- map changes, undo, autosave
  const snap = () => JSON.stringify(M);
  function pushUndo() { undo.push(snap()); if (undo.length > 60) undo.shift(); redo = []; }
  function changed() { dirty = true; M.updated = new Date().toISOString(); $('dirty').hidden = false; redraw(); autosave(); }
  function edit(fn) { pushUndo(); fn(); changed(); }
  function doUndo() { if (!undo.length) return; redo.push(snap()); M = JSON.parse(undo.pop()); sel = null; changed(); panels(); }
  function doRedo() { if (!redo.length) return; undo.push(snap()); M = JSON.parse(redo.pop()); sel = null; changed(); panels(); }
  let asT = 0;
  function autosave() { clearTimeout(asT); asT = setTimeout(() => IP.store.set(DRAFT_KEY, { map: M, libId, dirty, at: Date.now() }), 800); }
  function setMap(m, id = null, isDirty = false) {
    M = MM.normalize(m); libId = id; dirty = isDirty; sel = null; draft = null; pathDraft = null; undo = []; redo = [];
    $('dirty').hidden = !dirty; drawNow(); fit(); panels(); autosave();
    if (!MM.terrainFor(M.kind).includes(O.terrain)) O.terrain = MM.terrainFor(M.kind)[0];
    if (!MM.featuresFor(M.kind).includes(O.feature)) O.feature = MM.featuresFor(M.kind)[0];
    toolPane();
  }

  // ---------------------------------------------------------------- drawing the map
  let rafPending = false;
  function redraw() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; drawNow(); }); }
  function drawNow() {
    const d = draft || (pathDraft && pathDraft.pts.length ? { t: 'pen', pts: pathDraft.pts.concat(pathDraft.hover ? [pathDraft.hover] : []), color: '#ffbf3c', w: Math.max(2, M.cell * 0.12) } : null);
    // While dragging, skip the paper and hand-drawn-edge filters: much faster on big maps and old computers.
    RW = MM.render(M, { editor: true, sel, draft: d, uid: 'e', show: drag && !drag.pan ? { texture: false } : undefined });
    $('stage').innerHTML = RW.svg;
    applyView();
    document.title = (dirty ? '• ' : '') + M.name + ' — Map Maker';
  }
  function applyView() { $('stage').style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`; $('zLbl').textContent = Math.round(zoom * 100) + '%'; }
  function fit() { if (!RW) drawNow(); const v = $('view').getBoundingClientRect(); zoom = Math.max(0.05, Math.min(4, Math.min((v.width - 30) / RW.width, (v.height - 60) / RW.height))); panX = (v.width - RW.width * zoom) / 2; panY = Math.max(10, (v.height - 30 - RW.height * zoom) / 2); applyView(); }
  function zoomAt(f, cx, cy) { const nz = Math.max(0.05, Math.min(8, zoom * f)); panX = cx - (cx - panX) * nz / zoom; panY = cy - (cy - panY) * nz / zoom; zoom = nz; applyView(); }
  function toWorld(e) { const svg = $('stage').firstElementChild, r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * RW.width / r.width - RW.pad, (e.clientY - r.top) * RW.height / r.height - RW.pad]; }
  const geo = () => MM.geom(M);
  function find(id) { for (const k of ['features', 'places', 'annotations', 'paths']) { const o = M[k].find(x => x.id === id); if (o) return [k, o]; } return [null, null]; }
  const hit = e => { const el = e.target.closest && e.target.closest('[data-id]'); return el ? el.dataset.id : null; };

  // ---------------------------------------------------------------- pointer tools
  const view = $('view');
  view.addEventListener('contextmenu', e => e.preventDefault());
  view.addEventListener('wheel', e => { e.preventDefault(); const r = view.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  view.addEventListener('pointerdown', e => {
    if (!M) return; view.focus();
    if (e.button === 1 || e.button === 2 && tool !== 'path' || spaceDown || tool === 'pan') { drag = { pan: true, x: e.clientX, y: e.clientY, px: panX, py: panY }; view.classList.add('panning'); view.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0 && !(e.button === 2 && tool === 'path')) return;
    const w = toWorld(e), id = hit(e), g = geo();
    view.setPointerCapture(e.pointerId);
    switch (tool) {
      case 'select': {
        sel = id; panels();
        if (id) { const [, o] = find(id); drag = { move: true, id, start: w, orig: JSON.parse(JSON.stringify(o)), pushed: false }; }
        redraw(); break;
      }
      case 'paint': pushUndo(); drag = { paint: true }; paintAt(w); break;
      case 'fill': { const c = g.cellAt(...w); if (c) edit(() => flood(c, O.terrain)); break; }
      case 'stamp': {
        let [x, y] = w; if (O.snap && M.grid.type !== 'none') { const c = g.cellAt(x, y); if (c) [x, y] = g.center(...c); }
        const f = { id: MM.uid(), t: O.feature, x: +x.toFixed(1), y: +y.toFixed(1), r: O.rot, s: O.size };
        if (O.feature === 'building') Object.assign(f, { w: 2, h: 1.5, roof: Math.floor(Math.random() * 6) }); if (O.feature === 'field') Object.assign(f, { w: 4, h: 3, roof: 0 });
        edit(() => M.features.push(f)); break;
      }
      case 'place': {
        const p = { id: MM.uid(), kind: O.placeKind, name: defaultPlaceName(O.placeKind), x: +w[0].toFixed(1), y: +w[1].toFixed(1), population: null, demographics: [], areas: [], notes: '' };
        if (p.kind === 'room') p.num = Math.max(0, ...M.places.filter(q => q.kind === 'room').map(q => q.num || 0)) + 1;
        if (MM.POP[p.kind]) { const r = MM.rng(MM.newSeed()); p.population = Math.round(r.int(...MM.POP[p.kind]) / 10) * 10; p.demographics = MM.demographics(r); }
        edit(() => M.places.push(p)); sel = p.id; tab('places'); setTimeout(() => { const n = $('plName'); if (n) { n.focus(); n.select(); } }, 30); break;
      }
      case 'path': {
        if (!pathDraft) pathDraft = { pts: [] };
        if (e.button === 2 || e.detail >= 2) { finishPath(); break; }
        pathDraft.pts.push([+w[0].toFixed(1), +w[1].toFixed(1)]); redraw(); break;
      }
      case 'pen': draft = { t: 'pen', pts: [w], color: O.color, w: O.width }; drag = { draw: true }; break;
      case 'line': case 'arrow': case 'rect': case 'ellipse': draft = { t: tool, pts: [w, w], color: O.color, w: O.width, fill: O.fill }; drag = { draw: true }; break;
      case 'measure': draft = { t: 'arrow', pts: [w, w], color: '#ffbf3c', w: Math.max(2, M.cell * 0.08) }; drag = { measure: true }; break;
      case 'text': { askText('Text on the map', '').then(t => { if (t) edit(() => M.annotations.push({ id: MM.uid(), t: 'text', pts: [w], text: t, color: O.color, size: O.textSize, w: 1 })); }); break; }
      case 'erase': if (id) { const [k] = find(id); edit(() => { M[k] = M[k].filter(x => x.id !== id); }); if (sel === id) sel = null; panels(); } break;
    }
  });
  view.addEventListener('pointermove', e => {
    if (!M || !RW) return;
    const w = toWorld(e), c = geo().cellAt(...w);
    status(c, w);
    if (pathDraft && tool === 'path' && !drag) { pathDraft.hover = w; redraw(); }
    if (!drag) return;
    if (drag.pan) { panX = drag.px + e.clientX - drag.x; panY = drag.py + e.clientY - drag.y; applyView(); return; }
    if (drag.paint) { paintAt(w); return; }
    if (drag.draw) { if (draft.t === 'pen') { const l = draft.pts[draft.pts.length - 1]; if (Math.hypot(l[0] - w[0], l[1] - w[1]) > 2 / zoom) draft.pts.push(w); } else draft.pts[1] = w; redraw(); return; }
    if (drag.measure) { draft.pts[1] = w; lastMeasure = measureText(draft.pts[0], w); status(c, w); redraw(); return; }
    if (drag.move) {
      const dx = w[0] - drag.start[0], dy = w[1] - drag.start[1]; if (!drag.pushed && Math.hypot(dx, dy) < 3) return;
      if (!drag.pushed) { pushUndo(); drag.pushed = true; }
      const [k, o] = find(drag.id); if (!o) return;
      if (k === 'annotations' || k === 'paths') o.pts = drag.orig.pts.map(p => [+(p[0] + dx).toFixed(1), +(p[1] + dy).toFixed(1)]);
      else { o.x = +(drag.orig.x + dx).toFixed(1); o.y = +(drag.orig.y + dy).toFixed(1); if (o.rect) o.rect = [drag.orig.rect[0] + dx, drag.orig.rect[1] + dy, drag.orig.rect[2], drag.orig.rect[3]]; }
      redraw();
    }
  });
  const endDrag = () => {
    if (!drag) return;
    view.classList.remove('panning');
    const wasDrag = drag; drag = null;
    if (!wasDrag.pan && !wasDrag.paint && !(wasDrag.move && wasDrag.pushed) && !wasDrag.draw) redraw();
    drag = wasDrag;
    if (drag.paint) changed();
    if (drag.draw && draft) { const d = draft; draft = null; const big = d.t === 'pen' ? d.pts.length > 1 : Math.hypot(d.pts[1][0] - d.pts[0][0], d.pts[1][1] - d.pts[0][1]) > 3; if (big) edit(() => M.annotations.push(Object.assign({ id: MM.uid() }, d, { pts: d.pts.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]) }))); else redraw(); }
    if (drag.measure) { draft = null; redraw(); toolPane(); }
    const moved = drag.move && drag.pushed; drag = null;
    if (moved) { changed(); panels(); }
  };
  view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);

  function paintAt(w) {
    const g = geo(), c = g.cellAt(...w); if (!c) return;
    const rad = (O.brush - 0.5) * g.W, arr = M.terrain.split('');
    let n = 0;
    for (let r = Math.max(0, c[1] - O.brush); r <= Math.min(M.rows - 1, c[1] + O.brush); r++) for (let k = Math.max(0, c[0] - O.brush); k <= Math.min(M.cols - 1, c[0] + O.brush); k++) {
      const [x, y] = g.center(k, r), [cx, cy] = g.center(...c);
      if ((O.brush === 1 ? (k === c[0] && r === c[1]) : Math.hypot(x - cx, y - cy) <= rad) && arr[r * M.cols + k] !== O.terrain) { arr[r * M.cols + k] = O.terrain; n++; }
    }
    if (n) { M.terrain = arr.join(''); redraw(); }
  }
  function flood(c, ch) {
    const g = geo(), from = MM.T(M, ...c); if (from === ch) return;
    const arr = M.terrain.split(''), st = [c]; arr[c[1] * M.cols + c[0]] = ch;
    while (st.length) { const [x, y] = st.pop(); for (const [a, b] of g.neighbors(x, y)) { const i = b * M.cols + a; if (arr[i] === from) { arr[i] = ch; st.push([a, b]); } } }
    M.terrain = arr.join('');
  }
  function finishPath() {
    if (pathDraft && pathDraft.pts.length >= 2) { const p = { id: MM.uid(), t: O.pathType, w: O.pathW, pts: pathDraft.pts, closed: O.pathType === 'wall' && !!O.pathClosed }; edit(() => M.paths.push(p)); }
    pathDraft = null; redraw();
  }
  function measureText(a, b) {
    const g = geo(), d = Math.hypot(b[0] - a[0], b[1] - a[1]) / g.W, dist = d * M.scale.per;
    const ca = g.cellAt(...a), cb = g.cellAt(...b);
    let squares = ''; if (ca && cb && !g.hex) squares = ` · ${Math.max(Math.abs(ca[0] - cb[0]), Math.abs(ca[1] - cb[1]))} squares (diagonals count 1)`;
    return `${+dist.toFixed(1)} ${M.scale.unit}${squares}`;
  }
  function status(c, w) {
    const parts = [];
    if (c) parts.push(`${M.grid.type === 'hex' ? 'Hex' : 'Square'} ${c[0]}, ${c[1]}: ${(MM.TERRAIN[MM.T(M, ...c)] || {}).name || ''}`);
    if (lastMeasure && tool === 'measure') parts.push('Measured: ' + lastMeasure);
    if (tool === 'path' && pathDraft) parts.push(`${pathDraft.pts.length} point(s): double-click, right-click or Enter to finish, Esc to cancel`);
    parts.push(`${M.cols} × ${M.rows}, 1 = ${M.scale.per} ${M.scale.unit}`);
    $('status').textContent = parts.join('   ·   ');
  }
  function defaultPlaceName(k) {
    const r = MM.rng(MM.newSeed());
    if (k === 'area') return MM.areaName(r, 'forest'); if (k === 'dungeon') return MM.dungeonName(r); if (k === 'room') return r.pick(MM.ROOM_NAMES);
    if (k === 'district') return r.pick(MM.DISTRICTS); if (k === 'ruin') return 'Ruins of ' + MM.placeName(r); if (k === 'cave') return MM.placeName(r) + ' Caves';
    if (k === 'poi' && M.kind === 'settlement') return r.pick(MM.POI.inn); return MM.placeName(r);
  }

  // ---------------------------------------------------------------- keyboard
  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.querySelector('dialog[open]');
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); save(); } else if (k === 'p') { e.preventDefault(); printDlg(); } else if (k === 'n' && !typing) { e.preventDefault(); newDlg(); }
      else if (!typing && (k === 'z' && !e.shiftKey)) { e.preventDefault(); doUndo(); } else if (!typing && (k === 'y' || k === 'z' && e.shiftKey)) { e.preventDefault(); doRedo(); }
      else if (!typing && k === 'd' && sel) { e.preventDefault(); duplicate(); }
      return;
    }
    if (typing) return;
    if (e.key === ' ') { spaceDown = true; view.classList.add('pan'); e.preventDefault(); return; }
    if (e.key === 'Escape') { pathDraft = null; draft = null; sel = null; panels(); redraw(); return; }
    if (e.key === 'Enter' && pathDraft) { finishPath(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { const [k] = find(sel); if (k) { edit(() => { M[k] = M[k].filter(x => x.id !== sel); }); sel = null; panels(); } return; }
    if ((e.key === '[' || e.key === ']') && sel) { const [k, o] = find(sel); if (k === 'features') { edit(() => { o.r = ((o.r || 0) + (e.key === ']' ? 15 : -15) + 360) % 360; }); toolPane(); } return; }
    if (e.key === '+' || e.key === '=') { const r = view.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); return; }
    if (e.key === '-') { const r = view.getBoundingClientRect(); zoomAt(1 / 1.2, r.width / 2, r.height / 2); return; }
    if (e.key === '0') { fit(); return; }
    const t = TOOLS.find(x => x && x[3] === e.key.toLowerCase()); if (t) setTool(t[0]);
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; view.classList.remove('pan'); } });
  function duplicate() { const [k, o] = find(sel); if (!k || k === 'places' && o.center) return; const c = JSON.parse(JSON.stringify(o)); c.id = MM.uid(); const d = M.cell * 0.7; if (c.pts) c.pts = c.pts.map(p => [p[0] + d, p[1] + d]); else { c.x += d; c.y += d; } if (c.rect) c.rect = [c.rect[0] + d, c.rect[1] + d, c.rect[2], c.rect[3]]; edit(() => M[k].push(c)); sel = c.id; panels(); }

  // ---------------------------------------------------------------- side panels
  function tab(name) { document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); for (const p of ['tool', 'map', 'places']) $('pane-' + p).hidden = p !== name; if (name === 'map') mapPane(); if (name === 'places') placesPane(); if (name === 'tool') toolPane(); }
  document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => tab(b.dataset.tab); });
  const curTab = () => (document.querySelector('#tabs button.on') || {}).dataset?.tab || 'tool';
  function panels() { const t = curTab(); const [k] = sel ? find(sel) : [null]; if (k === 'places' && t !== 'places') return tab('places'); if (t === 'tool') toolPane(); else if (t === 'map') mapPane(); else placesPane(); }
  function setTool(t) { tool = t; pathDraft = null; draft = null; document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); view.classList.toggle('pan', t === 'pan'); view.classList.toggle('sel', t === 'select'); if (curTab() !== 'tool') tab('tool'); else toolPane(); redraw(); }
  function buildTools() { const n = $('tools'); n.textContent = ''; for (const t of TOOLS) n.append(t ? h('button', { dataset: { tool: t[0] }, title: t[2], text: t[1], class: t[0] === tool ? 'on' : '', onclick: () => setTool(t[0]) }) : h('hr')); }

  // little form helpers
  const fld = (label, el, cls) => h('label', { class: 'f' + (cls ? ' ' + cls : '') }, h('span', { text: label }), el);
  const inp = (v, on, attrs = {}) => { const i = h('input', Object.assign({ value: v ?? '' }, attrs)); i.addEventListener(attrs.type === 'checkbox' ? 'change' : 'change', () => on(attrs.type === 'checkbox' ? i.checked : attrs.type === 'number' || attrs.type === 'range' ? +i.value : i.value)); if (attrs.type === 'checkbox') i.checked = !!v; return i; };
  const selEl = (v, choices, on) => { const s = h('select', {}, choices.map(([k, n]) => h('option', { value: k, text: n }))); s.value = v; s.onchange = () => on(s.value); return s; };
  const chk = (label, v, on, title) => { const i = h('input', { type: 'checkbox' }); i.checked = !!v; i.onchange = () => on(i.checked); return h('label', { class: 'check', title }, i, label); };

  function toolPane() {
    const p = $('pane-tool'); if (!M) return; p.textContent = '';
    const t = TOOLS.find(x => x && x[0] === tool);
    p.append(h('h3', { text: t[2].replace(/ \(.*/, '') }));
    if (tool === 'select') {
      p.append(h('p', { class: 'hint', text: 'Click an object, place, path or note to change it; drag to move it. Delete removes it, Ctrl+D copies it, [ and ] turn objects.' }));
      selectionProps(p);
    } else if (tool === 'pan') p.append(h('p', { class: 'hint', text: 'Drag to move around. The mouse wheel zooms. Any tool: hold Space or the middle mouse button to move the view.' }));
    else if (tool === 'paint' || tool === 'fill') {
      if (tool === 'paint') p.append(fld('Brush size', inp(O.brush, v => { O.brush = Math.max(1, Math.min(8, v)); saveOpt(); }, { type: 'number', min: 1, max: 8 })));
      p.append(chk('Show every terrain', O.allTerrain, v => { O.allTerrain = v; saveOpt(); toolPane(); }));
      const pal = h('div', { class: 'pal' }), P = MM.palette(M.style);
      const list = O.allTerrain ? Object.keys(MM.TERRAIN) : MM.terrainFor(M.kind);
      for (const k of list) pal.append(h('button', { class: O.terrain === k ? 'on' : '', title: `${MM.TERRAIN[k].name} (ASCII: ${k === ' ' ? 'space' : k})`, onclick: () => { O.terrain = k; saveOpt(); toolPane(); } }, h('span', { class: 'sw', style: { background: k === ' ' ? P.paper : P.f(MM.TERRAIN[k].color) } }), MM.TERRAIN[k].name));
      p.append(h('h3', { text: 'Terrain' }), pal);
      p.append(h('p', { class: 'hint', text: tool === 'fill' ? 'Click to fill every touching square of the same terrain.' : 'Click or drag to paint.' }));
    } else if (tool === 'stamp') {
      p.append(h('div', { class: 'f2' }, fld('Turn (°)', inp(O.rot, v => { O.rot = v; saveOpt(); }, { type: 'number', step: 15 })), fld('Size', inp(O.size, v => { O.size = Math.max(0.2, Math.min(6, v)); saveOpt(); }, { type: 'number', step: 0.1, min: 0.2, max: 6 }))));
      p.append(chk('Snap to the grid', O.snap, v => { O.snap = v; saveOpt(); }));
      const pal = h('div', { class: 'pal' });
      const list = MM.featuresFor(M.kind).concat(Object.keys(MM.FEATURES).filter(k => !MM.featuresFor(M.kind).includes(k)));
      list.forEach((k, i) => { if (i === MM.featuresFor(M.kind).length) pal.append(h('div', { style: { gridColumn: '1/-1' }, class: 'hint', text: 'More:' })); const b = h('button', { class: O.feature === k ? 'on' : '', title: MM.FEATURES[k].name, onclick: () => { O.feature = k; saveOpt(); toolPane(); } }); b.innerHTML = k === 'building' || k === 'field' ? `<span class="sw" style="background:${k === 'field' ? '#cdd18a' : '#9c4a35'}"></span>` : MM.icon(k === 'pine' ? 'pinetop' : k, M.style); b.append(MM.FEATURES[k].name); pal.append(b); });
      p.append(h('h3', { text: 'Objects' }), pal);
    } else if (tool === 'place') {
      p.append(fld('Kind', selEl(O.placeKind, Object.entries(MM.PLACE_KINDS).map(([k, v]) => [k, v.name]), v => { O.placeKind = v; saveOpt(); })));
      p.append(h('p', { class: 'hint', text: 'Click the map to add the place, then fill in its name, population, people and notes in Places. Dungeons, caves, ruins and rooms can list the areas inside them.' }));
    } else if (tool === 'path') {
      p.append(fld('Kind', selEl(O.pathType, [['road', 'Road'], ['trail', 'Trail'], ['river', 'River'], ['street', 'Street'], ['wall', 'Wall (with towers)']], v => { O.pathType = v; saveOpt(); toolPane(); })));
      p.append(fld('Width', inp(O.pathW, v => { O.pathW = Math.max(0.2, Math.min(8, v)); saveOpt(); }, { type: 'number', step: 0.1, min: 0.2, max: 8 })));
      if (O.pathType === 'wall') p.append(chk('Close the ring', O.pathClosed, v => { O.pathClosed = v; saveOpt(); }));
      p.append(h('p', { class: 'hint', text: 'Click points along the way. Double-click, right-click or press Enter to finish; Esc cancels.' }));
    } else if (['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'].includes(tool)) {
      const sw = h('div', { class: 'swatches' }, COLORS.map(c => h('button', { class: O.color === c ? 'on' : '', style: { background: c }, title: c, onclick: () => { O.color = c; saveOpt(); toolPane(); } })));
      const ci = h('input', { type: 'color', value: O.color }); ci.oninput = () => { O.color = ci.value; saveOpt(); };
      p.append(fld('Color', h('div', { class: 'row' }, sw, ci)));
      if (tool === 'text') p.append(fld('Text size', inp(O.textSize, v => { O.textSize = v; saveOpt(); }, { type: 'number', min: 6, max: 200 })));
      else p.append(fld('Line width', inp(O.width, v => { O.width = v; saveOpt(); }, { type: 'number', min: 1, max: 60 })));
      if (tool === 'rect' || tool === 'ellipse') p.append(chk('Filled (see-through)', O.fill, v => { O.fill = v; saveOpt(); }));
      p.append(h('p', { class: 'hint', text: 'Notes are drawn on top of the map and exported with it. Remove them with the Erase tool, or all at once in Map → Clear notes.' }));
    } else if (tool === 'erase') p.append(h('p', { class: 'hint', text: 'Click an object, note, place or path to remove it. To change terrain, paint over it.' }));
    else if (tool === 'measure') p.append(h('p', { class: 'hint', text: 'Drag from one point to another. ' + (lastMeasure ? 'Last: ' + lastMeasure : '') }));
  }

  function selectionProps(p) {
    if (!sel) return p.append(h('p', { class: 'none', text: 'Nothing selected.' }));
    const [k, o] = find(sel); if (!o) return;
    const upd = fn => edit(() => fn());
    p.append(h('h3', { text: k === 'features' ? MM.FEATURES[o.t].name : k === 'paths' ? 'Path' : k === 'annotations' ? 'Note' : 'Place' }));
    if (k === 'features') {
      p.append(fld('Turn (°)', inp(o.r || 0, v => upd(() => { o.r = v; }), { type: 'number', step: 15 })));
      if (o.t === 'building' || o.t === 'field') {
        p.append(h('div', { class: 'f2' }, fld('Width', inp(o.w || 2, v => upd(() => { o.w = v; }), { type: 'number', step: 0.1, min: 0.3 })), fld('Depth', inp(o.h || 1.5, v => upd(() => { o.h = v; }), { type: 'number', step: 0.1, min: 0.3 }))));
        p.append(fld(o.t === 'field' ? 'Crop color' : 'Roof color', selEl(String(o.roof || 0), (o.t === 'field' ? ['Green-gold', 'Green', 'Wheat'] : ['Red tile', 'Brown thatch', 'Grey slate', 'Dark red', 'Blue slate', 'Straw']).map((n, i) => [String(i), n]), v => upd(() => { o.roof = +v; }))));
      } else p.append(fld('Size', inp(o.s || 1, v => upd(() => { o.s = Math.max(0.2, v); }), { type: 'number', step: 0.1, min: 0.2 })));
      p.append(fld('Object', selEl(o.t, Object.entries(MM.FEATURES).map(([a, b]) => [a, b.name]), v => upd(() => { o.t = v; if (v === 'building' && !o.w) Object.assign(o, { w: 2, h: 1.5 }); }))));
    } else if (k === 'paths') {
      p.append(fld('Kind', selEl(o.t, [['road', 'Road'], ['trail', 'Trail'], ['river', 'River'], ['street', 'Street'], ['wall', 'Wall']], v => upd(() => { o.t = v; if (v === 'river' && !o.w) o.w = 1; }))));
      p.append(fld('Width', inp(o.w || 1, v => upd(() => { o.w = v; }), { type: 'number', step: 0.1, min: 0 })));
      p.append(chk('Closed ring', o.closed, v => upd(() => { o.closed = v; })));
      if (o.t === 'river' && o.w === 0) p.append(h('p', { class: 'hint', text: 'Width 0: the river is painted as water terrain and this line only marks its course.' }));
    } else if (k === 'annotations') {
      const ci = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '#c0392b' }); ci.onchange = () => upd(() => { o.color = ci.value; });
      p.append(fld('Color', ci));
      if (o.t === 'text') { p.append(fld('Text', inp(o.text, v => upd(() => { o.text = v; })))); p.append(fld('Size', inp(o.size || 24, v => upd(() => { o.size = v; }), { type: 'number', min: 6 }))); }
      else p.append(fld('Line width', inp(o.w || 3, v => upd(() => { o.w = v; }), { type: 'number', min: 1 })));
      if (o.t === 'rect' || o.t === 'ellipse') p.append(chk('Filled', o.fill, v => upd(() => { o.fill = v; })));
    }
    p.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'ghost small', text: 'Copy (Ctrl+D)', onclick: duplicate }), h('button', { class: 'ghost small danger', text: 'Delete', onclick: () => { edit(() => { M[k] = M[k].filter(x => x.id !== o.id); }); sel = null; panels(); } })));
  }

  function mapPane() {
    const p = $('pane-map'); if (!M) return; p.textContent = '';
    const upd = fn => { edit(fn); };
    p.append(h('h3', { text: 'Map' }));
    p.append(fld('Name', inp(M.name, v => upd(() => { M.name = v || 'Untitled map'; const c = M.places.find(q => q.center); if (c && M.kind === 'settlement') c.name = M.name; }), { maxlength: 160 })));
    p.append(fld('Type', h('span', { text: MM.KINDS[M.kind] + (M.subtype ? ' — ' + M.subtype : '') })));
    if (M.kind === 'dungeon') p.append(fld('Level', inp(M.level || 1, v => upd(() => { M.level = v; }), { type: 'number', min: -99, max: 999 })));
    p.append(fld('Style', selEl(M.style, Object.entries(MM.STYLES), v => upd(() => { M.style = v; }))));
    p.append(h('h3', { text: 'Grid and scale' }));
    p.append(fld('Grid', selEl(M.grid.type, [['square', 'Squares'], ['hex', 'Hexes'], ['none', 'None']], v => upd(() => { M.grid.type = v; }))));
    p.append(chk('Show the grid lines', M.grid.show, v => upd(() => { M.grid.show = v; })));
    p.append(fld('Grid strength', inp(M.grid.opacity, v => upd(() => { M.grid.opacity = v; }), { type: 'range', min: 0.05, max: 1, step: 0.05 })));
    p.append(h('div', { class: 'f2' }, fld('1 square =', inp(M.scale.per, v => upd(() => { M.scale.per = Math.max(0.01, v); }), { type: 'number', min: 0.01, step: 'any' })), fld('Unit', selEl(M.scale.unit, [['ft', 'feet'], ['m', 'meters'], ['yd', 'yards'], ['mi', 'miles'], ['km', 'km'], ['leagues', 'leagues'], ['days', 'days\' travel']], v => upd(() => { M.scale.unit = v; })))));
    p.append(h('h3', { text: 'Size and orientation' }));
    const cI = h('input', { type: 'number', value: M.cols, min: 4, max: 300 }), rI = h('input', { type: 'number', value: M.rows, min: 4, max: 300 });
    p.append(h('div', { class: 'f2' }, fld('Columns', cI), fld('Rows', rI)));
    p.append(h('div', { class: 'row' }, h('button', { class: 'ghost small', text: 'Resize', title: 'Add or cut squares on the right and bottom', onclick: () => resize(+cI.value, +rI.value) }),
      h('button', { class: 'ghost small', text: 'Turn 90° ↻', title: 'Turn the whole map: landscape ↔ portrait', onclick: rotate90 }),
      h('span', { class: 'fine', text: M.cols >= M.rows ? 'Landscape' : 'Portrait' })));
    p.append(fld('North points', inp(M.north || 0, v => upd(() => { M.north = ((v % 360) + 360) % 360; }), { type: 'range', min: 0, max: 359, step: 1 })));
    p.append(h('h3', { text: 'On the map' }));
    const posChoices = [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right'], ['bc', 'Bottom center']];
    p.append(h('div', { class: 'f2' }, chk('Title', M.show.title, v => upd(() => { M.show.title = v; })), chk('Place names', M.show.labels, v => upd(() => { M.show.labels = v; }))));
    p.append(h('div', { class: 'f2' }, chk('Legend', M.show.legend, v => upd(() => { M.show.legend = v; })), selEl(M.legendPos, posChoices, v => upd(() => { M.legendPos = v; }))));
    p.append(h('div', { class: 'f2' }, chk('Compass', M.show.compass, v => upd(() => { M.show.compass = v; })), selEl(M.compassPos, posChoices, v => upd(() => { M.compassPos = v; }))));
    p.append(fld('Compass style', selEl(M.compassStyle, [['rose8', 'Compass rose (8 points)'], ['rose4', 'Compass rose (4 points)'], ['arrow', 'North arrow']], v => upd(() => { M.compassStyle = v; }))));
    p.append(h('div', { class: 'f2' }, chk('Scale bar', M.show.scalebar, v => upd(() => { M.show.scalebar = v; })), selEl(M.scalePos, posChoices, v => upd(() => { M.scalePos = v; }))));
    p.append(h('div', { class: 'f2' }, chk('Populations', M.show.population, v => upd(() => { M.show.population = v; })), chk('People (demographics)', M.show.demographics, v => upd(() => { M.show.demographics = v; }))));
    p.append(h('div', { class: 'f2' }, chk('Key / gazetteer', M.show.key, v => upd(() => { M.show.key = v; }), 'A list of numbered rooms, or of places with their people and notes, beside the map'), chk('Terrain symbols', M.show.symbols, v => upd(() => { M.show.symbols = v; }))));
    p.append(chk('Painted texture', M.show.texture, v => upd(() => { M.show.texture = v; }), 'Paper grain and hand-drawn edges. Turn off for a faster editor on old computers.'));
    p.append(h('h3', { text: 'Notes' }));
    const ta = h('textarea', { rows: 4, placeholder: 'Anything about this map (only in the ASCII export and the .ipmap file).' }); ta.value = M.notes || ''; ta.onchange = () => upd(() => { M.notes = ta.value; });
    p.append(ta);
    p.append(h('h3', { text: 'Clear' }));
    p.append(h('div', { class: 'row' },
      h('button', { class: 'ghost small danger', text: 'Clear notes', onclick: () => { if (confirm('Remove every drawing and text note?')) upd(() => { M.annotations = []; }); } }),
      h('button', { class: 'ghost small danger', text: 'Clear objects', onclick: () => { if (confirm('Remove every object (trees, doors, buildings…)?')) upd(() => { M.features = []; }); } }),
      h('button', { class: 'ghost small danger', text: 'Clear paths', onclick: () => { if (confirm('Remove every road, river, trail, street and wall?')) upd(() => { M.paths = []; }); } })));
    p.append(h('p', { class: 'fine', text: `Seed ${M.seed}. Generated maps with the same type, options and seed come out the same.` }));
  }
  function resize(c, r) {
    c = Math.max(4, Math.min(300, c | 0)); r = Math.max(4, Math.min(300, r | 0)); if (c === M.cols && r === M.rows) return;
    const fillCh = M.kind === 'dungeon' ? '#' : ',';
    edit(() => { const g = MM.gridFrom(M); const ng = []; for (let y = 0; y < r; y++) { ng.push([]); for (let x = 0; x < c; x++) ng[y].push(g[y] && g[y][x] !== undefined ? g[y][x] : fillCh); } M.cols = c; M.rows = r; M.terrain = ng.map(row => row.join('')).join(''); M.orientation = c >= r ? 'landscape' : 'portrait'; });
    fit(); mapPane();
  }
  function rotate90() {
    if (M.grid.type === 'hex') { IP.toast('Hex maps can\'t be turned 90°: switch the grid to squares first, or regenerate the map in the other orientation.', true); return; }
    edit(() => {
      const g = MM.gridFrom(M), H = M.rows * M.cell, ng = [];
      for (let x = 0; x < M.cols; x++) { ng.push([]); for (let y = M.rows - 1; y >= 0; y--) ng[x].push(g[y][x]); }
      const rot = ([x, y]) => [+(H - y).toFixed(1), +x.toFixed(1)];
      M.features.forEach(f => { [f.x, f.y] = rot([f.x, f.y]); f.r = ((f.r || 0) + 90) % 360; });
      M.places.forEach(p => { [p.x, p.y] = rot([p.x, p.y]); if (p.rect) { const [a, b] = rot([p.rect[0], p.rect[1] + p.rect[3]]); p.rect = [a, b, p.rect[3], p.rect[2]]; } });
      M.paths.forEach(p => { p.pts = p.pts.map(rot); });
      M.annotations.forEach(a => { a.pts = a.pts.map(rot); });
      [M.cols, M.rows] = [M.rows, M.cols]; M.terrain = ng.map(row => row.join('')).join(''); M.orientation = M.cols >= M.rows ? 'landscape' : 'portrait';
    });
    fit(); mapPane();
  }

  function placesPane() {
    const p = $('pane-places'); if (!M) return; p.textContent = '';
    const [k, cur] = sel ? find(sel) : [null, null];
    if (k === 'places') placeEditor(p, cur);
    p.append(h('h3', { text: `Places (${M.places.length})` }));
    const q = h('input', { placeholder: 'Find a place…', value: placesPane.q || '' }); q.oninput = () => { placesPane.q = q.value; drawList(); };
    p.append(h('div', { class: 'row' }, q, h('button', { class: 'small', text: '+ Add', title: 'Pick the Place tool and click the map', onclick: () => setTool('place') })));
    const list = h('div', { class: 'list' }); p.append(list);
    function drawList() {
      list.textContent = ''; const f = (placesPane.q || '').toLowerCase();
      const items = M.places.filter(x => !f || x.name.toLowerCase().includes(f)).sort((a, b) => (a.kind === 'room' && b.kind === 'room' ? (a.num || 0) - (b.num || 0) : 0));
      if (!items.length) list.append(h('p', { class: 'none', text: 'No places yet. Use the Place tool (P) to name cities, villages, dungeons, rooms and regions.' }));
      for (const x of items) list.append(h('div', { class: 'it' + (x.id === sel ? ' on' : ''), onclick: () => { sel = x.id; centerOn(x.x, x.y); redraw(); placesPane(); } },
        h('b', { text: (x.kind === 'room' && x.num ? x.num + '. ' : '') + x.name }), h('span', { class: 'k', text: (MM.PLACE_KINDS[x.kind] || {}).name + (x.population ? ' · ' + MM.fmtPop(x.population) : '') })));
    }
    drawList();
  }
  function centerOn(x, y) { const v = view.getBoundingClientRect(); panX = v.width / 2 - (x + RW.pad) * zoom; panY = v.height / 2 - (y + RW.pad) * zoom; applyView(); }
  function placeEditor(p, pl) {
    const upd = fn => { edit(fn); };
    p.append(h('h3', { text: 'Place' }));
    const nm = inp(pl.name, v => upd(() => { pl.name = v || 'Unnamed'; if (pl.center) M.name = pl.name; }), { id: 'plName', maxlength: 120 });
    p.append(fld('Name', nm));
    p.append(fld('Kind', selEl(pl.kind, Object.entries(MM.PLACE_KINDS).map(([a, b]) => [a, b.name]), v => upd(() => { pl.kind = v; if (v === 'room' && !pl.num) pl.num = Math.max(0, ...M.places.filter(q => q.kind === 'room').map(q => q.num || 0)) + 1; }))));
    if (pl.kind === 'room') p.append(fld('Number', inp(pl.num, v => upd(() => { pl.num = v; }), { type: 'number', min: 0 })));
    p.append(fld('Label size', inp(pl.size || 1, v => upd(() => { pl.size = Math.max(0.3, Math.min(5, v)); }), { type: 'number', step: 0.1, min: 0.3, max: 5 })));
    const kd = MM.PLACE_KINDS[pl.kind] || {};
    if (kd.settlement || pl.population) {
      p.append(fld('Population', inp(pl.population ?? '', v => upd(() => { pl.population = v === '' || isNaN(v) ? null : Math.max(0, Math.round(v)); }), { type: 'number', min: 0, step: 1 })));
      p.append(h('h3', { text: 'People (demographics)' }));
      const box = h('div'); p.append(box);
      const drawDemo = () => {
        box.textContent = '';
        (pl.demographics || []).forEach((d, i) => {
          const s = h('input', { value: d.species, list: 'speciesList', 'aria-label': 'Species' }); s.onchange = () => upd(() => { d.species = s.value || 'Unknown'; });
          const n = h('input', { type: 'number', value: d.pct, min: 0, max: 100, 'aria-label': 'Percent' }); n.onchange = () => { upd(() => { d.pct = Math.max(0, Math.min(100, +n.value || 0)); }); drawDemo(); };
          box.append(h('div', { class: 'demo' }, s, n, h('button', { class: 'icon', text: '✕', title: 'Remove', onclick: () => { upd(() => { pl.demographics.splice(i, 1); }); drawDemo(); } })));
        });
        const tot = (pl.demographics || []).reduce((s, d) => s + (+d.pct || 0), 0);
        box.append(h('div', { class: 'row' },
          h('button', { class: 'ghost small', text: '+ Species', onclick: () => { upd(() => { pl.demographics = pl.demographics || []; pl.demographics.push({ species: MM.SPECIES.find(s => !pl.demographics.some(d => d.species === s)) || 'Human', pct: Math.max(0, 100 - tot) }); }); drawDemo(); } }),
          h('button', { class: 'ghost small', text: 'Make it 100%', title: 'Scale the ratios so they add up to 100%', onclick: () => { upd(() => normalizeDemo(pl)); drawDemo(); } }),
          h('button', { class: 'ghost small', text: 'Random', onclick: () => { upd(() => { pl.demographics = MM.demographics(MM.rng(MM.newSeed())); }); drawDemo(); } }),
          h('span', { class: 'total ' + (tot === 100 ? 'ok' : 'bad'), text: `Total ${tot}%` })));
        if (pl.population && (pl.demographics || []).length) box.append(h('p', { class: 'fine', text: pl.demographics.map(d => `${d.species}: about ${MM.fmtPop(Math.round(pl.population * d.pct / 100))}`).join(' · ') }));
      };
      drawDemo();
    }
    p.append(h('h3', { text: 'Notes' }));
    const ta = h('textarea', { rows: 3, placeholder: 'Rulers, rumors, hooks, treasure, what the players know…' }); ta.value = pl.notes || ''; ta.onchange = () => upd(() => { pl.notes = ta.value; });
    p.append(ta);
    if (kd.areas || (pl.areas || []).length) {
      p.append(h('h3', { text: pl.kind === 'room' ? 'Areas in this room' : 'Areas inside' }));
      const box = h('div', { class: 'areas' }); p.append(box);
      const drawAreas = () => {
        box.textContent = '';
        (pl.areas || []).forEach((a, i) => {
          const n = h('input', { value: a.name, placeholder: 'Area name' }); n.onchange = () => upd(() => { a.name = n.value; });
          const t = h('textarea', { rows: 2, placeholder: 'What is here' }); t.value = a.notes || ''; t.onchange = () => upd(() => { a.notes = t.value; });
          box.append(h('div', { class: 'ar' }, h('div', { class: 'row' }, n, h('button', { class: 'icon', text: '✕', title: 'Remove', onclick: () => { upd(() => { pl.areas.splice(i, 1); }); drawAreas(); } })), t));
        });
        box.append(h('button', { class: 'ghost small', text: '+ Area', onclick: () => { upd(() => { pl.areas = pl.areas || []; pl.areas.push({ name: pl.kind === 'room' ? 'Alcove' : `Area ${pl.areas.length + 1}`, notes: '' }); }); drawAreas(); } }));
      };
      drawAreas();
    }
    if (['dungeon', 'cave', 'ruin', 'city', 'town', 'village', 'hamlet', 'port', 'fort', 'landmark', 'poi'].includes(pl.kind)) {
      p.append(h('h3', { text: 'Its own map' }));
      const row = h('div', { class: 'row' }); p.append(row);
      const fill = maps => {
        row.textContent = '';
        if (!online) { row.append(h('span', { class: 'fine', text: 'Sign in to link maps from your library.' })); return; }
        const s = h('select', { class: 'grow' }, h('option', { value: '', text: '— none —' }), maps.filter(x => x.id !== libId).map(x => h('option', { value: x.id, text: `${x.name} (${MM.KINDS[x.kind] || x.kind})` })));
        s.value = pl.link || ''; s.onchange = () => upd(() => { pl.link = s.value ? +s.value : null; });
        row.append(s, h('button', { class: 'ghost small', text: 'Open', disabled: !pl.link, onclick: () => openLib(pl.link) }));
        row.append(h('button', { class: 'ghost small', text: 'Make one', title: pl.kind === 'dungeon' || pl.kind === 'cave' || pl.kind === 'ruin' ? 'A new dungeon level named after this place' : 'A new settlement map named after this place', onclick: () => makeFor(pl) }));
      };
      fill(libCache || []); if (online && !libCache) loadLib().then(fill).catch(() => {});
    }
    p.append(h('div', { class: 'row', style: { margin: '10px 0' } }, h('button', { class: 'ghost small', text: 'Show on the map', onclick: () => centerOn(pl.x, pl.y) }), h('button', { class: 'ghost small danger', text: 'Delete place', onclick: () => { if (!confirm(`Delete ${pl.name}?`)) return; upd(() => { M.places = M.places.filter(x => x.id !== pl.id); }); sel = null; placesPane(); } })));
  }
  function normalizeDemo(pl) {
    const d = pl.demographics || []; const tot = d.reduce((s, x) => s + (+x.pct || 0), 0); if (!d.length) return;
    if (!tot) { d.forEach(x => { x.pct = Math.floor(100 / d.length); }); } else d.forEach(x => { x.pct = Math.round((+x.pct || 0) * 100 / tot); });
    const diff = 100 - d.reduce((s, x) => s + x.pct, 0); d.sort((a, b) => b.pct - a.pct)[0].pct += diff;
  }
  async function makeFor(pl) {
    if (dirty && !confirm('This map has changes that aren\'t saved. Save it first?\n\nOK: save it, then make the new map. Cancel: stay here.')) return;
    if (dirty && !(await save())) return;
    const parentId = libId, wild = ['dungeon', 'cave', 'ruin', 'landmark', 'poi'].includes(pl.kind);
    const sizes = { city: 'city', town: 'town', port: 'town', village: 'village', hamlet: 'hamlet', fort: 'village' };
    const m = MM.gen.make(wild ? { kind: 'dungeon', name: pl.name, seed: MM.newSeed() } : { kind: 'settlement', subtype: sizes[pl.kind] || 'town', name: pl.name, seed: MM.newSeed() });
    if (!wild) { const c = m.places.find(q => q.center); if (c) Object.assign(c, { population: pl.population ?? c.population, demographics: (pl.demographics || []).length ? JSON.parse(JSON.stringify(pl.demographics)) : c.demographics, notes: pl.notes || '' }); }
    m.notes = 'Made from ' + pl.name + ' on ' + (M.name || 'another map') + '.';
    setMap(m, null, true);
    if (online && parentId) { const id = await save(); if (id) { try { const j = await IP.api('get', null, '&id=' + parentId); const pm = j.map; const q = pm.places.find(x => x.id === pl.id); if (q) { q.link = id; await IP.api('save', { id: parentId, name: pm.name, kind: pm.kind, campaign_id: j.campaign_id, data: pm }); } IP.toast('Made and linked to ' + pm.name); } catch (e) { IP.toast(e.message, true); } } }
  }

  // ---------------------------------------------------------------- dialogs
  function dlg(title, body, buttons, cls = '') {
    const d = h('dialog', { class: 'dlg ' + cls }, h('h2', { text: title }), body, h('div', { class: 'dlgbtns' }, buttons.map(([label, fn, c]) => h('button', { class: c || '', text: label, onclick: async () => { if (fn) { const r = await IP.act(fn)(); if (r === false) return; } d.close(); } }))));
    d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); return d;
  }
  function askText(title, v) { return new Promise(res => { const i = h('input', { value: v, style: { width: '100%' } }); const d = dlg(title, i, [['Cancel', () => res(null), 'ghost'], ['OK', () => res(i.value.trim())]]); i.onkeydown = e => { if (e.key === 'Enter') { res(i.value.trim()); d.close(); } }; setTimeout(() => i.focus(), 20); }); }

  function newDlg() {
    const g = O.gen, body = h('div');
    const kinds = h('div', { class: 'kinds' });
    const icons = { travel: '🏔', battle: '⚔', dungeon: '🗝', settlement: '🏘' };
    const opts = h('div');
    const draw = () => {
      kinds.textContent = '';
      for (const [k, n] of Object.entries(MM.KINDS)) kinds.append(h('button', { class: g.kind === k ? 'on' : '', onclick: () => { g.kind = k; g.subtype = { battle: 'forest', settlement: 'town' }[k] || ''; draw(); } }, h('span', { class: 'big', text: icons[k] }), n));
      opts.textContent = '';
      if (g.kind === 'battle') opts.append(fld('Scene', selEl(g.subtype || 'forest', [['forest', 'Forest clearing'], ['road', 'Crossroads'], ['camp', 'Camp'], ['river', 'River crossing with a bridge'], ['cavern', 'Cavern'], ['ruins', 'Ruined temple'], ['tavern', 'Tavern interior']], v => { g.subtype = v; })));
      if (g.kind === 'settlement') opts.append(fld('Size', selEl(g.subtype || 'town', [['hamlet', 'Hamlet'], ['village', 'Village'], ['town', 'Town (walled)'], ['city', 'City (walled)']], v => { g.subtype = v; })), chk('River', g.river !== false, v => { g.river = v; }));
      if (g.kind === 'travel') opts.append(fld('Land', selEl(g.landform, [['coast', 'Coast'], ['island', 'Island'], ['archipelago', 'Islands'], ['inland', 'Inland']], v => { g.landform = v; })), fld('Climate', selEl(g.climate, [['temperate', 'Temperate'], ['cold', 'Cold'], ['hot', 'Hot']], v => { g.climate = v; })));
      if (g.kind === 'dungeon') opts.append(fld('Rooms', inp(g.rooms || '', v => { g.rooms = v; }, { type: 'number', min: 2, max: 60, placeholder: 'automatic' })), chk('10-foot squares', g.feet10, v => { g.feet10 = v; }), chk('Secret doors', g.secrets !== false, v => { g.secrets = v; }));
      opts.append(fld('Size', selEl(g.size, [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge (slower)']], v => { g.size = v; })));
      opts.append(fld('Orientation', selEl(g.orientation, [['landscape', 'Landscape (wide)'], ['portrait', 'Portrait (tall)']], v => { g.orientation = v; })));
      opts.append(fld('Grid', selEl(g.grid || '', [['', 'Usual for this map'], ['square', 'Squares'], ['hex', 'Hexes'], ['none', 'None']], v => { g.grid = v; })));
      opts.append(fld('Style', selEl(g.style || '', [['', 'Usual for this map'], ...Object.entries(MM.STYLES)], v => { g.style = v; })));
    };
    const name = h('input', { placeholder: 'Leave empty for a generated name', maxlength: 160 }), seed = h('input', { value: MM.newSeed(), maxlength: 40 });
    const blank = h('input', { type: 'checkbox' });
    draw();
    body.append(kinds, h('h3', { text: 'Options' }), opts, fld('Name', name), fld('Seed', h('div', { class: 'row' }, seed, h('button', { class: 'ghost small', text: '🎲', title: 'New seed', onclick: () => { seed.value = MM.newSeed(); } }))), h('label', { class: 'check' }, blank, 'Start blank (no generated content)'));
    dlg('New map', body, [['Cancel', null, 'ghost'], ['Make the map', async () => {
      if (dirty && !confirm('The current map has changes that aren\'t saved. Make a new map anyway? (Your last map stays in this browser until you make another change.)')) return false;
      saveOpt();
      const m = makeMap(Object.assign({}, g, { name: name.value.trim(), seed: seed.value.trim() || MM.newSeed() }), blank.checked);
      setMap(m, null, true);
    }]], 'wide');
  }
  const SIZES = { travel: { small: [44, 32], medium: [60, 44], large: [80, 58], huge: [110, 80] }, battle: { small: [20, 14], medium: [30, 20], large: [40, 28], huge: [56, 40] }, dungeon: { small: [32, 24], medium: [44, 32], large: [60, 44], huge: [80, 60] } };
  const SET_SCALE = { small: 0.8, medium: 1, large: 1.25, huge: 1.5 };
  function makeMap(g, blank) {
    const o = { kind: g.kind, subtype: g.subtype, seed: g.seed, name: g.name, orientation: g.orientation, style: g.style || undefined, grid: g.grid || undefined, landform: g.landform, climate: g.climate, rooms: g.rooms || undefined, feet10: g.feet10, secrets: g.secrets, river: g.river };
    if (SIZES[g.kind]) [o.cols, o.rows] = SIZES[g.kind][g.size || 'medium'];
    else { const base = { hamlet: [56, 40], village: [70, 50], town: [84, 60], city: [110, 80] }[g.subtype || 'town'], k = SET_SCALE[g.size || 'medium']; o.cols = Math.round(base[0] * k); o.rows = Math.round(base[1] * k); }
    if (blank) { const m = MM.blank(g.kind, o); m.name = g.name || 'Untitled map'; if (o.style) m.style = o.style; if (o.grid) m.grid.type = o.grid; return m; }
    return MM.gen.make(o);
  }
  function regen() {
    if (!M) return;
    if (dirty && !confirm('Make this map again with a new seed? Your changes to it will be replaced (Undo brings them back).')) return;
    const g = Object.assign({}, O.gen, { kind: M.kind, subtype: M.subtype || O.gen.subtype, seed: MM.newSeed(), name: '', orientation: M.cols >= M.rows ? 'landscape' : 'portrait', style: M.style, grid: M.grid.type });
    pushUndo(); const keepUndo = undo.slice();
    const m = makeMap(g, false); setMap(m, libId, true); undo = keepUndo;
  }

  // ---------------------------------------------------------------- the library
  async function loadLib() { const j = await IP.api('list'); libCache = j.maps; return libCache; }
  async function save(asCopy = false) {
    if (!online) { IP.download(MM.io.fileBase(M) + '.ipmap', MM.io.toIpmap(M), 'application/json'); IP.toast('Not signed in: saved as a .ipmap file instead'); return null; }
    let thumb = null; try { thumb = await MM.io.toDataURL(M, 'image/jpeg', 320, 0.7); } catch (e) {}
    const j = await IP.api('save', { id: asCopy ? undefined : libId, name: M.name, kind: M.kind, campaign_id: campaign || null, data: M, thumb });
    libId = j.id; dirty = false; $('dirty').hidden = true; libCache = null; autosave(); drawNow();
    IP.toast(asCopy ? 'Saved as a copy' : 'Saved to your library');
    return libId;
  }
  async function openLib(id) {
    if (dirty && !confirm('The current map has changes that aren\'t saved. Open the other map anyway?')) return;
    const j = await IP.api('get', null, '&id=' + id);
    setMap(j.map, j.id, false); IP.toast('Opened ' + M.name);
  }
  function libDlg() {
    if (!online) { IP.toast('Sign in to keep maps in your library. You can still Import and Export files.', true); return; }
    const body = h('div'), grid = h('div', { class: 'lib' }), onlyCamp = h('input', { type: 'checkbox', checked: !!campaign });
    body.append(h('div', { class: 'row' }, h('label', { class: 'check' }, onlyCamp, 'Only this campaign'), h('div', { class: 'spacer' }), h('button', { class: 'ghost small', text: 'Save as a copy', onclick: IP.act(async () => { await save(true); draw(); }) })), grid);
    const draw = async () => {
      grid.textContent = 'Loading…';
      const maps = await loadLib(); grid.textContent = '';
      const shown = maps.filter(m => !onlyCamp.checked || !campaign || m.campaign_id === campaign);
      if (!shown.length) grid.append(h('p', { class: 'none', text: 'No saved maps yet.' }));
      for (const m of shown) {
        const card = h('div', { class: 'card' + (m.id === libId ? ' on' : '') }, m.thumb ? h('img', { src: m.thumb, alt: '' }) : h('div', { class: 'none', text: 'No picture' }), h('b', { text: m.name }),
          h('div', { class: 'meta', text: `${MM.KINDS[m.kind] || m.kind}${m.campaign_name ? ' · ' + m.campaign_name : ''} · ${IP.when(m.updated_at)}` }),
          h('div', { class: 'row' }, h('button', { class: 'small', text: 'Open', onclick: IP.act(async ev => { ev.stopPropagation(); d.close(); await openLib(m.id); }) }),
            h('button', { class: 'ghost small danger', text: 'Delete', onclick: IP.act(async ev => { ev.stopPropagation(); if (!confirm(`Delete "${m.name}" from your library? This can't be undone.`)) return; await IP.api('delete', { id: m.id }); if (m.id === libId) { libId = null; dirty = true; $('dirty').hidden = false; } draw(); }) })));
        card.ondblclick = IP.act(async () => { d.close(); await openLib(m.id); });
        grid.append(card);
      }
    };
    onlyCamp.onchange = () => draw().catch(e => IP.toast(e.message, true));
    const d = dlg('Your maps', body, [['Close', null, 'ghost']], 'wide');
    draw().catch(e => IP.toast(e.message, true));
  }

  // ---------------------------------------------------------------- import and export
  function importFile() { $('file').value = ''; $('file').click(); }
  $('file').onchange = IP.act(async () => {
    const f = $('file').files[0]; if (!f) return;
    if (f.size > 12 * 1024 * 1024) throw new Error('That file is too large for a map (over 12 MB).');
    if (dirty && !confirm('The current map has changes that aren\'t saved. Open the file anyway?')) return;
    const m = MM.io.parse(await f.text(), f.name);
    m.id = MM.uid();     // an imported map is a new map in this library
    setMap(m, null, true); IP.toast(`Imported ${M.name}: Save keeps it in your library`);
  });
  function exportDlg(defFmt) {
    const fmts = [['png', 'PNG picture'], ['jpg', 'JPG picture (smaller file)'], ['svg', 'SVG drawing (sharp at any size; opens here again)'], ['gif', 'GIF picture (256 colors)'], ['ascii', 'ASCII text map'], ['ipmap', '.ipmap file (to trade, share and edit)']];
    const body = h('div'), fmt = selEl(defFmt || IP.store.get('mapmaker.fmt', 'png'), fmts, () => info()), scale = selEl(String(IP.store.get('mapmaker.scale', 1)), [['0.5', 'Half size'], ['1', 'Normal'], ['2', 'Double (print quality)'], ['3', 'Triple']], () => info());
    const q = h('input', { type: 'range', min: 0.5, max: 1, step: 0.02, value: 0.9 }), note = h('p', { class: 'fine' });
    const r = MM.render(M, {});
    const info = () => { const s = +scale.value; const raster = ['png', 'jpg', 'gif'].includes(fmt.value); scale.disabled = !raster; q.disabled = fmt.value !== 'jpg'; note.textContent = raster ? `${Math.round(r.width * s)} × ${Math.round(r.height * s)} pixels.` : fmt.value === 'ascii' ? `${M.cols} × ${M.rows} characters, with the legend and the list of places.` : fmt.value === 'svg' ? 'Opens in browsers, Inkscape and IPRPS Map Maker (Import).' : 'Everything about the map. Import it here, or send it to another Session Master.'; };
    body.append(fld('Format', fmt), fld('Size', scale), fld('JPG quality', q), note);
    info();
    dlg('Export', body, [['Cancel', null, 'ghost'], ['Download', async () => {
      IP.store.set('mapmaker.fmt', fmt.value); IP.store.set('mapmaker.scale', +scale.value);
      await exportAs(fmt.value, +scale.value, +q.value);
    }]]);
  }
  async function exportAs(fmt, scale = 1, quality = 0.9) {
    const base = MM.io.fileBase(M);
    const dl = (blob, name) => { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
    if (fmt === 'svg') dl(new Blob([MM.io.toSVG(M)], { type: 'image/svg+xml' }), base + '.svg');
    else if (fmt === 'ascii') dl(new Blob([MM.io.toASCII(M)], { type: 'text/plain' }), base + '.txt');
    else if (fmt === 'ipmap') dl(new Blob([MM.io.toIpmap(M)], { type: 'application/json' }), base + '.ipmap');
    else if (fmt === 'gif') { IP.toast('Making the GIF…'); dl(await MM.io.toGIF(M, scale), base + '.gif'); }
    else dl(await MM.io.toBlob(M, fmt === 'jpg' ? 'image/jpeg' : 'image/png', scale, quality), base + (fmt === 'jpg' ? '.jpg' : '.png'));
    IP.toast('Downloaded ' + base + '.' + (fmt === 'ascii' ? 'txt' : fmt));
  }

  // ---------------------------------------------------------------- preview, print, show to players
  function previewDlg() {
    const r = MM.render(M, { uid: 'p' }), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
    const pv = h('div', { class: 'pv' }, h('img', { src: url, alt: M.name, title: 'Click to switch between fit and actual size' }));
    pv.firstChild.onclick = () => pv.classList.toggle('actual');
    const d = dlg('Preview: ' + M.name, pv, [['Close', null, 'ghost'], ['Export…', () => { exportDlg(); }, 'ghost'], ['Print…', () => { printDlg(); }, 'ghost'], ...(online ? [['Show to players', () => showPlayers(), 'ghost']] : []), ['Save', () => save()]], 'full');
    return d;
  }
  function printDlg() {
    const body = h('div');
    const mode = selEl(IP.store.get('mapmaker.printmode', 'fit'), [['fit', 'Fit on one page'], ['inch', 'Battle scale: 1 inch per square (several pages, for miniatures)']], () => {});
    const paper = selEl(IP.store.get('mapmaker.paper', 'letter'), [['letter', 'US Letter'], ['a4', 'A4'], ['legal', 'US Legal'], ['a3', 'A3'], ['tabloid', 'Tabloid / Ledger']], () => {});
    const orient = selEl(M.cols >= M.rows ? 'landscape' : 'portrait', [['landscape', 'Landscape'], ['portrait', 'Portrait']], () => {});
    body.append(fld('Print', mode), fld('Paper', paper), fld('Page', orient), h('p', { class: 'fine', text: 'The printout is exactly what Preview shows. For battle scale, the key and legend print on the map\'s own pages; turn them off in Map if you want only the grid.' }));
    dlg('Print', body, [['Cancel', null, 'ghost'], ['Print', async () => { IP.store.set('mapmaker.printmode', mode.value); IP.store.set('mapmaker.paper', paper.value); await printMap(mode.value, paper.value, orient.value); }]]);
  }
  const PAPER = { letter: [8.5, 11], a4: [8.27, 11.69], legal: [8.5, 14], a3: [11.69, 16.54], tabloid: [11, 17] };
  async function printMap(mode, paper, orient) {
    const r = MM.render(M, { uid: 'pr' }), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
    let [pw, ph] = PAPER[paper] || PAPER.letter; if (orient === 'landscape') [pw, ph] = [ph, pw];
    const margin = 0.4, aw = pw - margin * 2, ah = ph - margin * 2;
    let pages = '';
    if (mode === 'inch' && M.grid.type !== 'none') {
      const g = geo(), ppi = g.W; // one square (or hex width) = 1 inch
      const totalW = r.width / ppi, totalH = r.height / ppi, nx = Math.ceil(totalW / aw), ny = Math.ceil(totalH / ah);
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) pages += `<div class="pg" style="width:${aw}in;height:${ah}in"><img src="${url}" style="width:${totalW}in;height:${totalH}in;margin-left:-${x * aw}in;margin-top:-${y * ah}in"><span class="lbl">${M.name.replace(/[<&>]/g, '')} · page ${y * nx + x + 1} of ${nx * ny} (row ${y + 1}, column ${x + 1})</span></div>`;
    } else pages = `<div class="pg fit" style="width:${aw}in;height:${ah}in"><img src="${url}"></div>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${M.name.replace(/[<&>]/g, '')}</title><style>@page{size:${pw}in ${ph}in;margin:${margin}in}html,body{margin:0;padding:0;background:#fff}.pg{position:relative;overflow:hidden;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}.pg img{display:block}.pg.fit img{width:100%;height:100%;object-fit:contain}.lbl{position:absolute;right:4px;bottom:2px;font:9px sans-serif;color:#555;background:#fffc;padding:0 3px}</style></head><body>${pages}</body></html>`;
    const fr = h('iframe', { style: { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' } }); document.body.append(fr);
    fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
    await new Promise(res => { const imgs = [...fr.contentDocument.images]; let n = imgs.length; if (!n) res(); imgs.forEach(i => { if (i.complete) { if (!--n) res(); } else i.onload = i.onerror = () => { if (!--n) res(); }; }); setTimeout(res, 4000); });
    fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 60000);
  }
  async function showPlayers() {
    if (!online) { IP.toast('Sign in to use the player display.', true); return; }
    IP.toast('Sending the map to the player display…');
    const image = await MM.io.toDataURL(M, 'image/jpeg', 1920, 0.86);
    await IP.api('show', { title: M.name, image, campaign_id: campaign || null });
    IP.toast('Showing on the player display');
  }

  // ---------------------------------------------------------------- buttons and start
  const wire = (id, fn) => { $(id).onclick = IP.act(fn); };
  wire('bNew', newDlg); wire('bRegen', regen); wire('bLib', libDlg); wire('bSave', () => save()); wire('bImport', importFile); wire('bExport', () => exportDlg());
  wire('bPreview', previewDlg); wire('bPrint', printDlg); wire('bShow', showPlayers); wire('bUndo', doUndo); wire('bRedo', doRedo);
  wire('zIn', () => { const r = view.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); }); wire('zOut', () => { const r = view.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); }); wire('zFit', fit);
  window.addEventListener('resize', () => { if (RW) applyView(); });
  window.addEventListener('beforeunload', e => { if (dirty && online) { e.preventDefault(); e.returnValue = ''; } });
  $('speciesList').append(...MM.SPECIES.map(s => h('option', { value: s })));
  buildTools();

  function start() {
    const d = IP.store.get(DRAFT_KEY, null);
    let restored = false;
    if (d && d.map) { try { setMap(d.map, d.libId || null, !!d.dirty); restored = true; } catch (e) { restored = false; } }
    if (!restored) setMap(MM.gen.make({ kind: 'battle', subtype: 'forest', seed: MM.newSeed() }), null, false);
    setTool('select'); toolPane();
    if (restored) IP.toast('Picked up where you left off: ' + M.name);
  }
  function offline(msg) { online = false; const b = $('banner'); b.textContent = msg; b.hidden = false; $('bShow').disabled = true; $('bLib').disabled = true; $('bSave').title = 'Not signed in: Save downloads a .ipmap file'; start(); }

  // Signed in (IPRPS OS): library, campaigns and the player display. Without the sign-in system, the editor still works with files.
  if (window.IPAuth) IP.boot(() => { online = true; IP.picker($('picker'), { key: 'mapmaker.picker', onChange: st => { campaign = st.campaign; } }); start(); });
  else offline('Working without signing in: maps can be made, exported and imported as files, but not saved to a library or shown to players.');
  MM.app = { get map() { return M; }, setMap, exportAs, makeMap, render: drawNow };   // for tests and the console
})();
