// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Map Maker - saving maps as SVG, PNG, JPG, GIF and ASCII, and the .ipmap file people trade.
// Reading them back: .ipmap / .json, an SVG made here (the map rides along inside it), and ASCII.
(() => {
  'use strict';
  const MM = window.MM;
  const X = MM.io = {};
  const safe = s => (String(s || 'map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'map');
  X.fileBase = m => safe(m.name);

  // ---------------------------------------------------------------- .ipmap
  X.toIpmap = m => JSON.stringify(Object.assign(MM.clone(m), { format: MM.FORMAT, version: MM.VERSION, exported: new Date().toISOString(), app: 'IPRPS Map Maker' }), null, 1);

  // ---------------------------------------------------------------- SVG (with the map inside, so it can be opened again)
  X.toSVG = m => '<?xml version="1.0" encoding="UTF-8"?>\n' + MM.render(m, { metadata: true, uid: 'x' }).svg;

  // ---------------------------------------------------------------- raster: PNG, JPG, and pixels for GIF
  X.toCanvas = (m, scale = 1, maxSide = 0) => new Promise((resolve, reject) => {
    const r = MM.render(m, { uid: 'r' });
    let k = scale; if (maxSide) k = Math.min(k, maxSide / Math.max(r.width, r.height));
    const w = Math.max(1, Math.round(r.width * k)), h = Math.max(1, Math.round(r.height * k));
    const svg = r.svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
    const img = new Image();
    img.onload = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); resolve(cv); };
    img.onerror = () => reject(new Error('The browser could not draw the map as a picture.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  X.toBlob = async (m, type, scale, quality) => { const cv = await X.toCanvas(m, scale, 16000); return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Picture too large for this browser: try a smaller size.'))), type, quality)); };
  X.toDataURL = async (m, type = 'image/jpeg', maxSide = 1920, quality = 0.86) => (await X.toCanvas(m, 2, maxSide)).toDataURL(type, quality);

  // ---------------------------------------------------------------- GIF (89a, one frame, 256 colors, LZW)
  X.toGIF = async (m, scale = 1) => { const cv = await X.toCanvas(m, scale, 4000); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); return new Blob([X.encodeGIF(d.data, cv.width, cv.height)], { type: 'image/gif' }); };
  X.encodeGIF = (rgba, w, h) => {
    // Palette: the most used colors at 5 bits per channel; everything else maps to its nearest one.
    const counts = new Map();
    for (let i = 0; i < rgba.length; i += 4) { const k = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3); counts.set(k, (counts.get(k) || 0) + 1); }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map(e => e[0]);
    const pal = top.map(k => [((k >> 10) & 31) << 3 | 4, ((k >> 5) & 31) << 3 | 4, (k & 31) << 3 | 4]);
    while (pal.length < 256) pal.push([0, 0, 0]);
    const cache = new Map(top.map((k, i) => [k, i]));
    const near = k => { let v = cache.get(k); if (v !== undefined) return v; const r = ((k >> 10) & 31) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3; let best = 0, bd = 1e9; for (let i = 0; i < top.length; i++) { const p = pal[i], d = (p[0] - r) ** 2 * 3 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 2; if (d < bd) { bd = d; best = i; } } cache.set(k, best); return best; };
    const idx = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) idx[j] = near(((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3));
    const out = []; const b = v => out.push(v & 255), w16 = v => { b(v); b(v >> 8); };
    'GIF89a'.split('').forEach(ch => b(ch.charCodeAt(0)));
    w16(w); w16(h); b(0xF7); b(0); b(0);
    for (const p of pal) { b(p[0]); b(p[1]); b(p[2]); }
    b(0x21); b(0xF9); b(4); b(0); w16(0); b(0); b(0);                      // graphic control
    b(0x2C); w16(0); w16(0); w16(w); w16(h); b(0);                         // image descriptor
    const minCode = 8; b(minCode);
    // LZW
    const clear = 1 << minCode, eoi = clear + 1; let size = minCode + 1, next = eoi + 1, dict = new Map();
    let cur = 0, bits = 0; const bytes = [];
    const emit = code => { cur |= code << bits; bits += size; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8; } };
    emit(clear);
    let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], key = prefix * 256 + k, v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
      else { emit(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
      prefix = k;
    }
    emit(prefix); emit(eoi); if (bits > 0) bytes.push(cur & 255);
    for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); b(n); for (let j = 0; j < n; j++) out.push(bytes[i + j]); }
    b(0); b(0x3B);
    return new Uint8Array(out);
  };

  // ---------------------------------------------------------------- ASCII
  // One character per square or hex (hex rows are offset by half a character pair), then the legend and the places.
  const FEATURE_CH = { door: '+', sdoor: 'S', portcullis: '|', stairsup: '<', stairsdown: '>', ladder: 'H', trap: '^', pit: 'O', chest: '$', altar: 'L', statue: '&', pillar: 'o', tree: 'T', pine: 'Y', bush: '*', rock: 'o', boulder: 'O', campfire: '%', well: 'w', tent: 'a', table: 'n', chair: 'z', bed: 'B', bones: 'j', portal: '@', building: 'B', keep: 'K', temple: 'Q', tower: 'I', gate: 'G', bridge: '=', stall: 'k', barrel: 'u', crate: 'C', web: 'X', coffin: 'D', boat: 'v', sign: '!', mill: 'm', counter: 'n', hearth: 'E', log: 'g' };
  const PATH_CH = { river: '~', road: '=', trail: ':', street: '=', wall: '#' };
  X.toASCII = m => {
    const geo = MM.geom(m), g = MM.gridFrom(m), notes = new Map();
    const cellOf = (x, y) => geo.cellAt(x, y);
    const put = (x, y, ch, why) => { const c = cellOf(x, y); if (!c) return; g[c[1]][c[0]] = ch; if (why) notes.set(ch, why); };
    for (const p of m.paths) { if (p.t === 'river' && m.kind === 'settlement') continue; for (let i = 1; i < p.pts.length; i++) { const [x0, y0] = p.pts[i - 1], [x1, y1] = p.pts[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (m.cell * 0.4)); for (let k = 0; k <= n; k++) put(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, PATH_CH[p.t] || '=', null); } }
    for (const f of m.features) if (FEATURE_CH[f.t]) { if (f.t === 'building' || f.t === 'field') { const w = (f.w || 2) * m.cell / 2, h = (f.h || 1.5) * m.cell / 2, a = (f.r || 0) * Math.PI / 180; for (let u = -w; u <= w; u += m.cell / 2) for (let v = -h; v <= h; v += m.cell / 2) put(f.x + u * Math.cos(a) - v * Math.sin(a), f.y + u * Math.sin(a) + v * Math.cos(a), f.t === 'field' ? 'r' : 'B'); } else put(f.x, f.y, FEATURE_CH[f.t]); }
    // Places: numbers 1-9 then letters, listed under the map.
    // Places: the first nine get a digit on the map (rooms use their own number); every place is listed with its square.
    const listed = m.places.filter(p => p.kind !== 'area' && p.kind !== 'district');
    const placeLines = [];
    listed.forEach((p, i) => {
      const n = p.kind === 'room' && p.num ? p.num : i + 1, mk = n <= 9 ? String(n) : '';
      const at = cellOf(p.x, p.y) || [0, 0];
      if (mk) put(p.x, p.y, mk);
      const bits = [(MM.PLACE_KINDS[p.kind] || {}).name, `at ${at[0]},${at[1]}`];
      if (p.population) bits.push('pop. ' + MM.fmtPop(p.population));
      if ((p.demographics || []).length) bits.push(p.demographics.map(d => `${d.species} ${d.pct}%`).join(', '));
      placeLines.push(`  ${(mk || '-').padStart(2)}  ${p.kind === 'room' && p.num ? p.num + '. ' : ''}${p.name}  (${bits.filter(Boolean).join('; ')})`);
      if (p.notes) placeLines.push('        ' + p.notes.replace(/\s+/g, ' '));
      for (const a of p.areas || []) placeLines.push(`        - ${a.name}${a.notes ? ': ' + a.notes.replace(/\s+/g, ' ') : ''}`);
    });
    const regions = m.places.filter(p => p.kind === 'area' || p.kind === 'district').map(p => `  ${p.name}`);
    const lines = [];
    lines.push(`IPRPS MAP: ${m.name}`);
    lines.push(`${MM.KINDS[m.kind]}${m.subtype ? ' (' + m.subtype + ')' : ''}${m.kind === 'dungeon' ? ', level ' + (m.level || 1) : ''}. ${m.cols} x ${m.rows} ${m.grid.type === 'hex' ? 'hexes' : 'squares'}, 1 = ${m.scale.per} ${m.scale.unit}. North: ${dir(m.north || 0)}. Seed: ${m.seed}`);
    lines.push('');
    const pad = String(m.rows).length;
    lines.push(' '.repeat(pad + 1) + Array.from({ length: m.cols }, (_, c) => (c % 10 === 0 ? String(Math.floor(c / 10) % 10) : ' ')).join(geo.hex ? ' ' : ''));
    lines.push(' '.repeat(pad + 1) + Array.from({ length: m.cols }, (_, c) => String(c % 10)).join(geo.hex ? ' ' : ''));
    g.forEach((row, r) => lines.push(String(r).padStart(pad) + ' ' + (geo.hex && r & 1 ? ' ' : '') + row.join(geo.hex ? ' ' : '')));
    lines.push('');
    lines.push('LEGEND');
    const used = new Set(g.flat());
    for (const ch of Object.keys(MM.TERRAIN)) if (used.has(ch) && m.terrain.includes(ch)) lines.push(`  ${ch === ' ' ? "' '" : ch}  ${MM.TERRAIN[ch].name}`);
    lines.push('  1-9  Places and rooms (see the list below)');
    const fl = new Map(); for (const f of m.features) if (FEATURE_CH[f.t]) fl.set(FEATURE_CH[f.t], (fl.get(FEATURE_CH[f.t]) ? fl.get(FEATURE_CH[f.t]) + ', ' : '') + MM.FEATURES[f.t].name);
    for (const [ch, name] of fl) if (used.has(ch)) lines.push(`  ${ch}  ${[...new Set(name.split(', '))].join(', ')}`);
    for (const [t, ch] of Object.entries(PATH_CH)) if (m.paths.some(p => p.t === t) && used.has(ch)) lines.push(`  ${ch}  ${t[0].toUpperCase() + t.slice(1)}`);
    if (placeLines.length) { lines.push(''); lines.push(m.places.some(p => p.kind === 'room') ? 'KEY' : 'PLACES'); lines.push(...placeLines); }
    if (regions.length) { lines.push(''); lines.push('REGIONS'); lines.push(...regions); }
    if (m.notes) { lines.push(''); lines.push('NOTES'); lines.push('  ' + m.notes); }
    lines.push(''); lines.push('Made with IPRPS Map Maker (IPRPS OS). Terrain characters can be read back with Import.');
    return lines.join('\n') + '\n';
  };
  const dir = a => ['up', 'upper right', 'right', 'lower right', 'down', 'lower left', 'left', 'upper left'][Math.round(((a % 360) + 360) % 360 / 45) % 8];

  // ---------------------------------------------------------------- reading files
  X.parse = (text, name = '') => {
    const t = String(text).replace(/^﻿/, '');
    if (/^\s*\{/.test(t)) return MM.normalize(JSON.parse(t));
    if (/<svg[\s>]/i.test(t)) {
      const mm = t.match(/<metadata id="iprps-map">([\s\S]*?)<\/metadata>/);
      if (!mm) throw new Error('This SVG was not made with IPRPS Map Maker, so it has no map inside to edit.');
      const div = document.createElement('textarea'); div.innerHTML = mm[1];
      return MM.normalize(JSON.parse(div.value));
    }
    return X.fromASCII(t, name);
  };
  // ASCII: the grid between the column numbers and LEGEND (from this app), or any block of map characters.
  X.fromASCII = (t, name) => {
    let lines = t.replace(/\r/g, '').split('\n'), head = lines[0] || '', rows;
    const hdr = /^IPRPS MAP: (.*)$/.exec(head);
    const hex = /hexes/.test(lines[1] || '');
    if (hdr) {
      const start = lines.findIndex(l => /^\s*0123456789/.test(l.replace(/ /g, '').slice(0, 10)) && /\d/.test(l)) + 1;
      const end = lines.findIndex((l, i) => i > start && l.trim() === '');
      rows = lines.slice(start, end).map(l => l.replace(/^\s*\d+ /, '')).map(l => (hex ? l.replace(/^ /, '').replace(/(.) ?/g, '$1') : l));
    } else rows = lines.filter(l => l.trim() !== '');
    if (!rows.length) throw new Error('No map found in this text file.');
    const cols = Math.max(...rows.map(r => r.length));
    if (cols < 4 || rows.length < 4) throw new Error('The ASCII map is too small (at least 4 x 4).');
    const kindHint = /Dungeon level/.test(lines[1] || '') ? 'dungeon' : /Travel/.test(lines[1] || '') ? 'travel' : /Town, city/.test(lines[1] || '') ? 'settlement' : rows.join('').includes('#') ? 'dungeon' : 'battle';
    const m = MM.blank(kindHint, { cols, rows: rows.length, orientation: cols >= rows.length ? 'landscape' : 'portrait', grid: hex ? 'hex' : undefined });
    m.cols = cols; m.rows = rows.length; m.name = hdr ? hdr[1].trim() : (name.replace(/\.[^.]+$/, '') || 'Imported map');
    const fill = kindHint === 'dungeon' ? '#' : ',';
    m.terrain = rows.map(r => r.padEnd(cols, fill).split('').map(ch => (MM.TERRAIN[ch] ? ch : FROM_CH[ch] || fill)).join('')).join('');
    const geo = MM.geom(m);
    rows.forEach((r, y) => r.split('').forEach((ch, x) => { const ft = FEAT_FROM[ch]; if (ft) { const [px, py] = geo.center(x, y); m.features.push({ id: MM.uid(), t: ft, x: px, y: py, r: 0, s: 1 }); } }));
    return MM.normalize(m);
  };
  const FROM_CH = { '+': '.', S: '.', '<': '.', '>': '.', '^': '.', $: '.', '|': '.', H: '.', O: '.', o: '.', T: ',', Y: ',', '*': ',', w: ',', B: '_', '%': '.', '&': '.', '@': '.', n: '_', x: '.' };
  const FEAT_FROM = { '+': 'door', S: 'sdoor', '<': 'stairsup', '>': 'stairsdown', '^': 'trap', $: 'chest', '|': 'portcullis', T: 'tree', Y: 'pine', '*': 'bush', o: 'pillar', O: 'pit', '%': 'campfire', '&': 'statue', '@': 'portal', w: 'well' };
})();
