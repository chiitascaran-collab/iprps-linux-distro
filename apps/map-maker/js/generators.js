// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Map Maker - the generators: travel / terrain, battle maps, dungeon levels, settlements.
// Each one takes options and returns a complete map document; the same seed gives the same map.
(() => {
  'use strict';
  const MM = window.MM;
  const G = MM.gen = {};
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const feat = (t, x, y, extra) => Object.assign({ id: MM.uid(), t, x, y, r: 0, s: 1 }, extra);
  const place = (kind, name, x, y, extra) => Object.assign({ id: MM.uid(), kind, name, x, y, population: null, demographics: [], areas: [], notes: '' }, extra);

  // A* over the grid. cost(c,r) → number or Infinity. Returns [[c,r]...] or null.
  function astar(m, geo, from, to, cost) {
    const key = (c, r) => r * m.cols + c, N = m.cols * m.rows;
    const g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const open = [[0, from[0], from[1]]]; g[key(...from)] = 0;
    const hd = (c, r) => Math.hypot(c - to[0], r - to[1]);
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, c, r] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      const k = key(c, r); if (done[k]) continue; done[k] = 1;
      if (c === to[0] && r === to[1]) { const out = []; for (let x = k; x !== -1; x = prev[x]) out.push([x % m.cols, Math.floor(x / m.cols)]); return out.reverse(); }
      for (const [nc, nr] of geo.neighbors(c, r)) {
        const nk = key(nc, nr); if (done[nk]) continue;
        const w = cost(nc, nr); if (!isFinite(w)) continue;
        const ng = g[k] + w * (nc !== c && nr !== r && !geo.hex ? 1.41 : 1);
        if (ng < g[nk]) { g[nk] = ng; prev[nk] = k; open.push([ng + hd(nc, nr), nc, nr]); }
      }
    }
    return null;
  }
  // Fewer points on a path: keep every n-th, plus the ends.
  const thin = (pts, n) => pts.filter((p, i) => i === 0 || i === pts.length - 1 || i % n === 0);

  // ================================================================ travel / terrain map
  G.travel = o => {
    const r = MM.rng(o.seed), m = MM.blank('travel', o), geo = MM.geom(m);
    m.name = o.name || MM.areaName(r, r.pick(['plains', 'forest', 'hills'])).replace(/^The /, '') + ' Region';
    const hN = MM.noise2(o.seed + 'h'), wN = MM.noise2(o.seed + 'w'), tN = MM.noise2(o.seed + 't');
    const land = o.landform || 'coast', climate = o.climate || 'temperate', zoom = 6 / Math.max(m.cols, m.rows) * (o.roughness || 1.6);
    const H = [], W = [];
    for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
      let h = hN(x * zoom, y * zoom, 5);
      const nx = x / m.cols * 2 - 1, ny = y / m.rows * 2 - 1;
      if (land === 'island') h = h * 0.9 + 0.38 - 0.62 * Math.pow(Math.min(1, Math.hypot(nx, ny) / 1.05), 2.2);
      else if (land === 'coast') h = h + 0.18 - 0.42 * Math.max(0, (o.coastSide === 'west' ? -nx : nx) + 0.25);
      else if (land === 'archipelago') h = h - 0.06;
      else h = h * 0.75 + 0.28;   // inland
      H.push(h); W.push(wN(x * zoom * 1.3, y * zoom * 1.3, 3));
    }
    // Heights by rank, so every landform gets a sensible share of sea, hills and mountains.
    const sorted = H.slice().sort((a, b) => a - b), q = f => sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(f * sorted.length)))];
    const seaFrac = { inland: 0.04, coast: 0.36, island: 0.48, archipelago: 0.6 }[land] ?? 0.36, mtn = o.mountains ?? 0.08;
    const tDeep = q(Math.max(0, seaFrac - 0.07)), tSea = q(seaFrac), tBeach = q(seaFrac + 0.025), tHill = q(1 - mtn - 0.11), tMtn = q(1 - mtn), tSnow = q(1 - mtn * 0.35);
    const grid = MM.gridFrom(m);
    for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
      const i = y * m.cols + x, h = H[i], w = W[i];
      const lat = y / m.rows, tmp = (climate === 'cold' ? 0.25 : climate === 'hot' ? 0.75 : 0.5) + (tN(x * zoom, y * zoom, 2) - 0.5) * 0.35 + (climate === 'temperate' ? (0.5 - lat) * -0.2 : 0) - (h >= tMtn ? 0.15 : 0);
      let t;
      if (h < tDeep && land !== 'inland') t = '~'; else if (h < tSea) t = '-';
      else if (h < tBeach && land !== 'inland') t = 'b';
      else if (h >= tSnow) t = tmp < 0.5 ? 'A' : 'M';
      else if (h >= tMtn) t = 'M';
      else if (h >= tHill) t = w > 0.55 && tmp < 0.4 ? 'p' : 'h';
      else if (tmp > 0.7 && w < 0.42) t = 'd';
      else if (tmp < 0.28) t = w > 0.5 ? 'p' : 't';
      else if (w > 0.64 && h < q(seaFrac + 0.2)) t = 's';
      else if (w > 0.58) t = tmp > 0.66 ? 'F' : 'f';
      else if (w > 0.5) t = tmp < 0.4 ? 'p' : 'f';
      else t = ',';
      grid[y][x] = t;
    }
    MM.gridTo(m, grid);
    const isWater = (c, rr) => '~-'.includes(MM.T(m, c, rr)), isLand = (c, rr) => !isWater(c, rr);
    const Hc = (c, rr) => H[rr * m.cols + c];

    // Rivers: from high ground, always downhill, until they reach water.
    const highs = []; for (let y = 1; y < m.rows - 1; y++) for (let x = 1; x < m.cols - 1; x++) if (Hc(x, y) >= tHill && Hc(x, y) < tSnow) highs.push([x, y]);
    r.shuffle(highs);
    const nRivers = o.rivers ?? r.int(2, 5), riverCells = new Set();
    for (const src of highs) {
      if (m.paths.filter(p => p.t === 'river').length >= nRivers) break;
      if ([...riverCells].some(k => { const c = k % m.cols, y = Math.floor(k / m.cols); return Math.hypot(c - src[0], y - src[1]) < 6; })) continue;
      const pts = [src]; let cur = src; const seen = new Set([cur[1] * m.cols + cur[0]]);
      for (let step = 0; step < 400; step++) {
        if (isWater(...cur)) break;
        let nb = geo.neighbors(...cur).filter(([a, b]) => !seen.has(b * m.cols + a));
        if (!nb.length) break;
        nb.sort((a, b) => Hc(...a) - Hc(...b));
        let nxt = nb[0]; if (Hc(...nxt) > Hc(...cur) + 0.03) { MM.setT(m, cur[0], cur[1], '-'); break; }   // a lake in a hollow
        if (r.chance(0.25) && nb[1] && Hc(...nb[1]) <= Hc(...cur) + 0.01) nxt = nb[1];
        pts.push(nxt); seen.add(nxt[1] * m.cols + nxt[0]); cur = nxt;
      }
      if (pts.length < 6) continue;
      pts.forEach(([c, y]) => riverCells.add(y * m.cols + c));
      m.paths.push({ id: MM.uid(), t: 'river', w: 1.2, pts: pts.map(p => geo.center(...p).map(v => +v.toFixed(1))) });
    }

    // Settlements on good land.
    const score = (c, y) => {
      const t = MM.T(m, c, y); if (!',frhb'.includes(t)) return -1;
      let s = (t === ',' ? 3 : t === 'r' ? 3 : t === 'h' ? 1.5 : t === 'b' ? 2 : 1) + r() * 1.5;
      if (riverCells.has(y * m.cols + c)) s += 3;
      if (geo.neighbors(c, y).some(n => isWater(...n))) s += 2.5;
      if (c < 2 || y < 2 || c > m.cols - 3 || y > m.rows - 3) s -= 3;
      return s;
    };
    const cand = []; for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) { const s = score(x, y); if (s > 0) cand.push([s, x, y]); }
    cand.sort((a, b) => b[0] - a[0]);
    const scaleN = m.cols * m.rows / 2600;
    const want = [['city', o.cities ?? Math.max(1, Math.round(1.2 * scaleN)), 14], ['town', o.towns ?? Math.round(3 * scaleN), 9], ['village', o.villages ?? Math.round(6 * scaleN), 6], ['hamlet', Math.round(3 * scaleN), 5]];
    const settl = [];
    for (const [kind, n, gap] of want) {
      let made = 0;
      for (const [, x, y] of cand) {
        if (made >= n) break;
        if (settl.some(s => Math.hypot(s.c - x, s.r - y) < gap)) continue;
        const [px, py] = geo.center(x, y), coastal = geo.neighbors(x, y).some(nb => '~'.includes(MM.T(m, ...nb)));
        const k = coastal && kind !== 'hamlet' && r.chance(0.5) && kind !== 'city' ? 'port' : kind;
        const pop = MM.POP[k === 'port' ? 'port' : kind];
        const p = place(k, MM.placeName(r), +px.toFixed(1), +py.toFixed(1), { population: Math.round(r.int(pop[0], pop[1]) / 10) * 10, demographics: MM.demographics(r) });
        settl.push(Object.assign({ c: x, r: y, p })); m.places.push(p); made++;
        if (kind === 'village' || kind === 'hamlet') for (const [a, b] of geo.neighbors(x, y)) if (MM.T(m, a, b) === ',' && r.chance(0.7)) MM.setT(m, a, b, 'r');
      }
    }
    // Roads: each place to its nearest bigger (or equal) neighbor, avoiding water and peaks.
    const rank = { city: 4, port: 3, town: 3, village: 2, hamlet: 1 };
    const cost = (c, y) => { const t = MM.T(m, c, y); return { '~': Infinity, '-': Infinity, A: Infinity, M: 9, h: 2.5, F: 4, f: 2, p: 2.2, s: 5, d: 2.5, t: 2 }[t] || 1; };
    const linked = new Set();
    for (const s of settl) {
      const others = settl.filter(o2 => o2 !== s && rank[o2.p.kind] >= rank[s.p.kind]).sort((a, b) => Math.hypot(a.c - s.c, a.r - s.r) - Math.hypot(b.c - s.c, b.r - s.r));
      const tgt = others[0]; if (!tgt) continue;
      const key = [s.p.id, tgt.p.id].sort().join(); if (linked.has(key)) continue; linked.add(key);
      const path = astar(m, geo, [s.c, s.r], [tgt.c, tgt.r], cost); if (!path || path.length < 2) continue;
      m.paths.push({ id: MM.uid(), t: rank[s.p.kind] >= 3 && rank[tgt.p.kind] >= 3 ? 'road' : 'trail', w: 1, pts: thin(path, 2).map(p => geo.center(...p).map(v => +v.toFixed(1))) });
    }
    // Dungeons, caves, ruins and landmarks in the wild.
    const wild = []; for (let y = 1; y < m.rows - 1; y++) for (let x = 1; x < m.cols - 1; x++) if ('hMfFps'.includes(MM.T(m, x, y))) wild.push([x, y]);
    r.shuffle(wild);
    const wildWant = [['dungeon', o.dungeons ?? Math.max(1, Math.round(2 * scaleN))], ['cave', Math.round(1.2 * scaleN)], ['ruin', Math.round(1.5 * scaleN)], ['landmark', Math.round(1.2 * scaleN)]];
    const placed = settl.map(s => [s.c, s.r]);
    for (const [kind, n] of wildWant) {
      let made = 0;
      for (const [x, y] of wild) {
        if (made >= n) break; if (placed.some(q => Math.hypot(q[0] - x, q[1] - y) < 5)) continue;
        const [px, py] = geo.center(x, y);
        const name = kind === 'dungeon' ? MM.dungeonName(r) : kind === 'cave' ? MM.placeName(r) + ' Caves' : kind === 'ruin' ? 'Ruins of ' + MM.placeName(r) : r.pick(['The Standing Stones', 'Giant\'s Seat', 'The Watchtower', 'Old Oak', 'The Weeping Statue', 'Dragon\'s Skull', 'The Monolith']);
        m.places.push(place(kind, name, +px.toFixed(1), +py.toFixed(1), kind === 'dungeon' ? { areas: [{ name: 'Entrance', notes: '' }] } : {}));
        placed.push([x, y]); made++;
      }
    }
    // Region labels: the biggest forest, mountain, swamp, desert and sea areas.
    const seen = new Uint8Array(m.cols * m.rows), groups = { f: 'forest', F: 'forest', p: 'forest', M: 'mountain', A: 'mountain', h: 'hills', s: 'swamp', d: 'desert', '~': 'sea', t: 'tundra' };
    const regs = [];
    for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
      const k0 = y * m.cols + x, g0 = groups[MM.T(m, x, y)]; if (seen[k0] || !g0) continue;
      const stack = [[x, y]], cells = []; seen[k0] = 1;
      while (stack.length) { const [a, b] = stack.pop(); cells.push([a, b]); for (const [c2, r2] of geo.neighbors(a, b)) { const k = r2 * m.cols + c2; if (!seen[k] && groups[MM.T(m, c2, r2)] === g0) { seen[k] = 1; stack.push([c2, r2]); } } }
      if (cells.length >= 12) regs.push({ kind: g0, cells });
    }
    regs.sort((a, b) => b.cells.length - a.cells.length);
    const usedKinds = {};
    for (const rg of regs.slice(0, 8)) {
      if ((usedKinds[rg.kind] = (usedKinds[rg.kind] || 0) + 1) > 2) continue;
      // the spot inside the region farthest from towns and other labels, not too near the edge
      const taken = m.places.map(p => [p.x, p.y]);
      let pick = null, bs = -1e9;
      for (const c of rg.cells) {
        const [x, y] = geo.center(...c), edge = Math.min(c[0], m.cols - 1 - c[0]) * 1.6, edgeY = Math.min(c[1], m.rows - 1 - c[1]) * 2;
        const near = taken.reduce((d, t) => Math.min(d, Math.hypot(t[0] - x, (t[1] - y) * 1.8) / m.cell), 99);
        const underTitle = c[1] < 4 && Math.abs(c[0] - m.cols / 2) < m.cols * 0.3 ? 6 : 0;   // the title banner sits there
        const sc = Math.min(near, 9) + Math.min(edge, 10) * 0.5 + Math.min(edgeY, 6) * 0.6 + MM.h2(c[0], c[1], 3) - underTitle;
        if (sc > bs) { bs = sc; pick = c; }
      }
      const [px, py] = geo.center(...pick);
      m.places.push(place('area', MM.areaName(r, rg.kind), +px.toFixed(1), +py.toFixed(1), { size: rg.cells.length > 120 ? 1.3 : 1.05 }));
    }
    return m;
  };

  // ================================================================ battle maps
  const ring = (m, cx, cy, rad, ch, rr, jag = 0.3) => { for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) if (Math.hypot(x - cx, y - cy) < rad * (1 + (MM.h2(x, y, 7) - 0.5) * jag)) MM.setT(m, x, y, ch); };
  const scatter = (m, r, types, n, ok) => { for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) { const x = r.range(0.5, m.cols - 0.5), y = r.range(0.5, m.rows - 0.5); if (!ok(Math.floor(x), Math.floor(y))) continue; if (m.features.some(f => Math.hypot(f.x - x, f.y - y) < 1.1)) continue; m.features.push(feat(r.pick(types), +x.toFixed(2), +y.toFixed(2), { r: r.int(0, 359), s: +r.range(0.8, 1.3).toFixed(2) })); i++; } };
  const cellsF = m => { for (const f of m.features) { f.x *= m.cell; f.y *= m.cell; } }; // features are placed in cells, then turned into world units

  G.battle = o => {
    const r = MM.rng(o.seed), sub = o.subtype || 'forest';
    const m = MM.blank('battle', Object.assign({}, o, { subtype: sub }));
    m.subtype = sub;
    const g = MM.gridFrom(m), fill = ch => g.forEach(row => row.fill(ch)), C = m.cols, R = m.rows;
    const at = (x, y) => (g[y] || [])[x];
    const set = (x, y, ch) => { if (y >= 0 && y < R && x >= 0 && x < C) g[y][x] = ch; };
    const noise = MM.noise2(o.seed + 'b');
    const roadLine = (horizontal, width, ch) => { let p = horizontal ? R / 2 : C / 2; const len = horizontal ? C : R; for (let i = 0; i < len; i++) { p += (noise(i * 0.15, 3) - 0.5) * 0.9; for (let w = -width / 2; w < width / 2; w++) horizontal ? set(i, Math.round(p + w), ch) : set(Math.round(p + w), i, ch); } };
    if (sub === 'forest' || sub === 'road' || sub === 'camp') {
      fill(',');
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (noise(x * 0.25, y * 0.25) > 0.6) g[y][x] = '"';
      if (sub === 'road') { roadLine(true, 2, ':'); if (r.chance(0.6)) roadLine(false, 2, ':'); }
      else if (r.chance(0.6)) roadLine(r.chance(0.5), 1, ':');
      MM.gridTo(m, g);
      const clear = sub === 'camp' ? Math.min(C, R) * 0.33 : Math.min(C, R) * 0.28;
      scatter(m, r, ['tree', 'tree', 'pine', 'bush'], Math.round(C * R * (sub === 'road' ? 0.05 : 0.09)), (x, y) => at(x, y) !== ':' && Math.hypot(x - C / 2, y - R / 2) > clear);
      scatter(m, r, ['rock', 'bush', 'log'], Math.round(C * R * 0.012), (x, y) => at(x, y) !== ':');
      if (sub === 'camp') { m.features.push(feat('campfire', C / 2, R / 2)); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + r.range(-0.3, 0.3); m.features.push(feat('tent', C / 2 + Math.cos(a) * 4.5, R / 2 + Math.sin(a) * 4, { r: Math.round(a * 180 / Math.PI + 90) })); } m.features.push(feat('crate', C / 2 + 2, R / 2 + 1.5), feat('barrel', C / 2 - 2, R / 2 - 1.8)); }
      if (sub === 'road') m.features.push(feat('sign', C / 2 + 1.6, R / 2 - 1.6));
    } else if (sub === 'river') {
      fill(',');
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (noise(x * 0.25, y * 0.25) > 0.62) g[y][x] = '"';
      let p = C / 2; for (let y = 0; y < R; y++) { p += (noise(5, y * 0.15) - 0.5) * 1.1; for (let w = -3; w <= 3; w++) set(Math.round(p + w), y, Math.abs(w) <= 1 ? '~' : '-'); set(Math.round(p - 4), y, 'b'); set(Math.round(p + 4), y, 'b'); }
      roadLine(true, 2, ':'); const by = Math.round(R / 2);
      for (let x = 0; x < C; x++) if ('~-b'.includes(g[by][x]) || '~-b'.includes((g[by - 1] || [])[x])) { set(x, by, '_'); set(x, by - 1, '_'); }
      MM.gridTo(m, g);
      scatter(m, r, ['tree', 'pine', 'bush', 'rock'], Math.round(C * R * 0.05), (x, y) => ',"'.includes(at(x, y)) && Math.abs(y - R / 2) > 2);
      scatter(m, r, ['rock'], 4, (x, y) => at(x, y) === '-');
    } else if (sub === 'cavern') {
      fill('#');
      for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) g[y][x] = r.chance(0.55) ? 'c' : '#';
      for (let it = 0; it < 5; it++) { const n2 = g.map(row => row.slice()); for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) { let w = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] === '#') w++; n2[y][x] = w >= 5 ? '#' : 'c'; } for (let y = 0; y < R; y++) g[y] = n2[y]; }
      // keep the biggest open area
      const seen = new Set(); let best = [];
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { if (g[y][x] !== 'c' || seen.has(y * C + x)) continue; const st = [[x, y]], cells = []; seen.add(y * C + x); while (st.length) { const [a, b] = st.pop(); cells.push([a, b]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (b + dy) * C + a + dx; if (g[b + dy] && g[b + dy][a + dx] === 'c' && !seen.has(k)) { seen.add(k); st.push([a + dx, b + dy]); } } } if (cells.length > best.length) best = cells; }
      const keep = new Set(best.map(([a, b]) => b * C + a)); for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (g[y][x] === 'c' && !keep.has(y * C + x)) g[y][x] = '#';
      if (best.length) { const [px, py] = r.pick(best); for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (g[y][x] === 'c' && Math.hypot(x - px, y - py) < 2.6) g[y][x] = '-'; }
      MM.gridTo(m, g);
      scatter(m, r, ['rock', 'boulder', 'bones', 'rock'], Math.round(best.length * 0.04), (x, y) => at(x, y) === 'c');
      if (r.chance(0.5)) scatter(m, r, ['web'], 2, (x, y) => at(x, y) === 'c');
      scatter(m, r, ['campfire', 'chest'], 2, (x, y) => at(x, y) === 'c');
    } else if (sub === 'ruins') {
      fill(','); for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (noise(x * 0.3, y * 0.3) > 0.58) g[y][x] = '"';
      const bx = Math.round(C * 0.2), by = Math.round(R * 0.2), bw = Math.round(C * 0.6), bh = Math.round(R * 0.6);
      for (let y = by; y <= by + bh; y++) for (let x = bx; x <= bx + bw; x++) g[y][x] = (y === by || y === by + bh || x === bx || x === bx + bw) ? (r.chance(0.62) ? '#' : 'x') : (r.chance(0.12) ? 'x' : '.');
      const mx = bx + Math.round(bw / 2); for (let y = by; y <= by + bh; y++) if (r.chance(0.7)) g[y][mx] = y % 4 === 0 ? '.' : '#';
      g[by + bh][bx + 3] = '.'; g[by + bh][bx + 4] = '.';
      MM.gridTo(m, g);
      for (let x = bx + 3; x < bx + bw - 1; x += 4) { m.features.push(feat('pillar', x + 0.5, by + 2.5), feat('pillar', x + 0.5, by + bh - 1.5)); }
      m.features.push(feat('altar', bx + bw * 0.75 + 0.5, by + bh / 2 + 0.5), feat('statue', bx + bw * 0.25, by + bh / 2 + 0.5));
      scatter(m, r, ['tree', 'bush', 'rock', 'bush'], Math.round(C * R * 0.03), (x, y) => ',"'.includes(at(x, y)));
      scatter(m, r, ['bones', 'rock'], 5, (x, y) => '.x'.includes(at(x, y)));
    } else if (sub === 'tavern') {
      fill('=');
      const bx = 2, by = 2, bw = C - 5, bh = R - 5;
      for (let y = by; y <= by + bh; y++) for (let x = bx; x <= bx + bw; x++) g[y][x] = (y === by || y === by + bh || x === bx || x === bx + bw) ? '#' : '_';
      const kx = bx + Math.round(bw * 0.68); for (let y = by; y <= by + bh; y++) g[y][kx] = '#';
      const ky = by + Math.round(bh * 0.5); for (let x = kx; x <= bx + bw; x++) g[ky][x] = '#';
      for (let y = by + 1; y < ky; y++) for (let x = kx + 1; x < bx + bw; x++) g[y][x] = '.';
      g[by + bh][bx + Math.round(bw * 0.3)] = '_'; g[ky][kx + 2] = '_'; g[by + 2][kx] = '_'; g[ky + 2][kx] = '_';
      MM.gridTo(m, g);
      m.features.push(feat('door', bx + Math.round(bw * 0.3) + 0.5, by + bh + 0.5), feat('door', kx + 2.5, ky + 0.5, { r: 0 }), feat('door', kx + 0.5, by + 2.5, { r: 90 }), feat('door', kx + 0.5, ky + 2.5, { r: 90 }));
      m.features.push(feat('counter', kx - 1.3, by + bh * 0.35, { r: 90, s: 1.3 }), feat('hearth', bx + 1.3, by + bh / 2 + 0.5, { r: 90 }));
      for (let i = 0; i < 6; i++) { const tx = bx + 4 + (i % 3) * 4.5, ty = by + 3.5 + Math.floor(i / 3) * Math.max(4, bh * 0.45); if (tx > kx - 3) continue; m.features.push(feat('table', tx, ty)); [[-1.2, 0], [1.2, 0], [0, -1.1], [0, 1.1]].forEach(([dx, dy]) => m.features.push(feat('chair', tx + dx, ty + dy, { r: dx ? 90 : 0 }))); }
      m.features.push(feat('barrel', kx + 1.6, by + 1.6), feat('barrel', kx + 2.5, by + 1.6), feat('crate', kx + 1.6, by + 2.6), feat('hearth', bx + bw - 1.4, by + 2, { r: 270, s: 0.8 }), feat('table', kx + 3.5, by + 3.5));
      for (let i = 0; i < 3; i++) m.features.push(feat('bed', kx + 2 + i * 2.2, ky + bh * 0.33 + 0.5, { r: 90 }));
      m.features.push(feat('stairsup', bx + bw - 1.5, by + bh - 1.5), feat('well', C - 1.2, R - 1.2));
      m.places.push(place('room', 'Common Room', bx + bw * 0.33, by + 1.4, { num: 1 }), place('room', 'Kitchen', kx + bw * 0.16, by + 1.4, { num: 2 }), place('room', 'Guest Rooms', kx + bw * 0.16, ky + 1.4, { num: 3 }));
      m.places.forEach(p => { p.x *= m.cell; p.y *= m.cell; });
    }
    cellsF(m);
    m.name = o.name || { forest: 'Forest Clearing', road: 'Crossroads Ambush', camp: 'Bandit Camp', river: 'River Crossing', cavern: 'Dark Cavern', ruins: 'Ruined Temple', tavern: MM.POI.inn[r.int(0, MM.POI.inn.length - 1)] }[sub];
    return m;
  };

  // ================================================================ dungeon levels
  G.dungeon = o => {
    const r = MM.rng(o.seed), m = MM.blank('dungeon', o);
    m.name = o.name || MM.dungeonName(r); m.level = o.level || 1;
    if (o.feet10) m.scale.per = 10;
    const C = m.cols, R = m.rows, g = MM.gridFrom(m); g.forEach(row => row.fill('#'));
    const nRooms = o.rooms || Math.round(C * R / 120), rooms = [];
    for (let tries = 0; tries < nRooms * 40 && rooms.length < nRooms; tries++) {
      const w = r.int(4, Math.min(11, C / 3)), h = r.int(4, Math.min(9, R / 3)), x = r.int(1, C - w - 2), y = r.int(1, R - h - 2);
      if (rooms.some(q => x < q.x + q.w + 2 && x + w + 2 > q.x && y < q.y + q.h + 2 && y + h + 2 > q.y)) continue;
      rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2), round: r.chance(0.12) && w > 5 && h > 5 });
    }
    rooms.sort((a, b) => a.cx + a.cy * 0.5 - (b.cx + b.cy * 0.5));
    const inRoom = (x, y) => rooms.findIndex(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
    for (const q of rooms) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) {
      if (q.round && Math.hypot((x + 0.5 - q.x - q.w / 2) / (q.w / 2), (y + 0.5 - q.y - q.h / 2) / (q.h / 2)) > 1.05) continue;
      g[y][x] = '.';
    }
    // Connect: minimum spanning tree plus a few loops.
    const edges = []; for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) edges.push([Math.hypot(rooms[i].cx - rooms[j].cx, rooms[i].cy - rooms[j].cy), i, j]);
    edges.sort((a, b) => a[0] - b[0]);
    const par = rooms.map((_, i) => i), f = i => (par[i] === i ? i : (par[i] = f(par[i]))), links = [];
    for (const [, i, j] of edges) { if (f(i) !== f(j)) { par[f(i)] = f(j); links.push([i, j]); } else if (r.chance(o.loops ?? 0.12)) links.push([i, j]); }
    const corridor = new Set();
    const carve = (x, y) => { if (g[y][x] === '#') { g[y][x] = '.'; corridor.add(y * C + x); } };
    for (const [i, j] of links) {
      const a = rooms[i], b = rooms[j]; let x = a.cx, y = a.cy;
      const horizFirst = r.chance(0.5);
      const stepX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); carve(x, y); } }, stepY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); carve(x, y); } };
      horizFirst ? (stepX(), stepY()) : (stepY(), stepX());
    }
    MM.gridTo(m, g);
    // Doors where a corridor meets a room.
    const doorAt = new Set();
    for (const k of corridor) {
      const x = k % C, y = Math.floor(k / C);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (inRoom(x + dx, y + dy) < 0 || g[y + dy][x + dx] !== '.') continue;
        if (doorAt.has(k)) continue;
        const sideWalls = dx ? g[y - 1][x] === '#' && g[y + 1][x] === '#' : g[y][x - 1] === '#' && g[y][x + 1] === '#';
        if (!sideWalls) continue;
        doorAt.add(k);
        const t = r.weighted([['door', 10], ['sdoor', o.secrets === false ? 0 : 1], ['portcullis', 1]]);
        m.features.push(feat(t, x + 0.5, y + 0.5, { r: dx ? 90 : 0 }));
      }
    }
    // Contents.
    const contents = [['chest', 3], ['trap', 3], ['pillar', 2], ['statue', 2], ['altar', 1], ['bones', 3], ['barrel', 2], ['crate', 2], ['coffin', 1], ['pit', 1], ['web', 1], ['portal', 0.3], ['table', 1], ['bed', 1], ['campfire', 0.5]];
    rooms.forEach((q, i) => {
      const n = r.int(0, Math.max(1, Math.round(q.w * q.h / 18)));
      if (q.w >= 7 && q.h >= 6 && r.chance(0.35)) for (const [px, py] of [[q.x + 1.5, q.y + 1.5], [q.x + q.w - 1.5, q.y + 1.5], [q.x + 1.5, q.y + q.h - 1.5], [q.x + q.w - 1.5, q.y + q.h - 1.5]]) m.features.push(feat('pillar', px, py));
      for (let k = 0; k < n; k++) { const t = r.weighted(contents), px = r.int(q.x + 1, q.x + q.w - 2) + 0.5, py = r.int(q.y + 1, q.y + q.h - 2) + 0.5; if (MM.T(m, Math.floor(px), Math.floor(py)) !== '.') continue; if (m.features.some(f2 => Math.hypot(f2.x - px, f2.y - py) < 1)) continue; m.features.push(feat(t, px, py, { r: r.pick([0, 90, 180, 270]) })); }
      if (r.chance(0.12)) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) if (MM.T(m, x, y) === '.' && MM.h2(x, y, i) < 0.35) MM.setT(m, x, y, r.chance(0.5) ? '-' : 'x');
      const nm = i === 0 ? 'Entrance' : r.pick(MM.ROOM_NAMES);
      m.places.push(place('room', nm, (q.x + 0.6) , (q.y + 0.75), { num: i + 1, rect: [q.x, q.y, q.w, q.h], areas: [] }));
    });
    if (rooms.length) {
      const a = rooms[0], z = rooms[rooms.length - 1];
      m.features.push(feat('stairsup', a.cx + 0.5, a.cy + 0.5));
      if (o.stairsDown !== false) m.features.push(feat('stairsdown', z.cx + 0.5, z.cy + 0.5));
    }
    cellsF(m); m.places.forEach(p => { p.x *= m.cell; p.y *= m.cell; if (p.rect) p.rect = p.rect.map(v => v * m.cell); });
    return m;
  };

  // ================================================================ settlements
  G.settlement = o => {
    const r = MM.rng(o.seed), size = o.subtype || 'town';
    const dims = { hamlet: [56, 40], village: [70, 50], town: [84, 60], city: [110, 80] }[size];
    const m = MM.blank('settlement', Object.assign({ cols: dims[0], rows: dims[1] }, o, { subtype: size }));
    m.subtype = size;
    const C = m.cols, R = m.rows, S = m.cell, cx = C / 2 + r.range(-2, 2), cy = R / 2 + r.range(-2, 2);
    const g = MM.gridFrom(m), noise = MM.noise2(o.seed + 's');
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const n = noise(x * 0.08, y * 0.08); g[y][x] = n > 0.63 && Math.hypot(x - cx, y - cy) > Math.min(C, R) * 0.32 ? 'f' : n < 0.4 ? '"' : ','; }
    // River (optional) through the map, as water cells and a path.
    const river = o.river ?? r.chance(size === 'hamlet' ? 0.35 : 0.6), riverPts = [];
    if (river) {
      let p = C * r.range(0.25, 0.75); const width = size === 'city' ? 3.2 : 2.2;
      for (let y = -1; y <= R + 1; y++) { p += (noise(9, y * 0.06) - 0.5) * 1.6; if (y % 3 === 0 || y === R + 1) riverPts.push([p * S, y * S]); for (let x = Math.floor(p - width); x <= p + width; x++) if (y >= 0 && y < R && x >= 0 && x < C) g[y][x] = Math.abs(x - p) < width - 0.8 ? '~' : '-'; }
    }
    MM.gridTo(m, g);
    const water = (x, y) => '~-'.includes(MM.T(m, Math.floor(x), Math.floor(y)));
    // Roads: from the center out to 2-5 edges, gently bent.
    const nRoads = { hamlet: 2, village: 3, town: 4, city: 5 }[size], roads = [];
    const ang0 = r.range(0, Math.PI * 2);
    for (let i = 0; i < nRoads; i++) {
      const a = ang0 + i * Math.PI * 2 / nRoads + r.range(-0.35, 0.35), pts = [[cx, cy]];
      let x = cx, y = cy, aa = a;
      for (let k = 0; k < 200; k++) { aa += (noise(i * 3.1, k * 0.2) - 0.5) * 0.25; x += Math.cos(aa) * 3; y += Math.sin(aa) * 3; pts.push([x, y]); if (x < -1 || y < -1 || x > C + 1 || y > R + 1) break; }
      roads.push(pts);
    }
    // Side streets for towns and cities.
    const streets = [];
    if (size === 'town' || size === 'city') for (const rd of roads) for (let k = 3; k < Math.min(rd.length - 1, size === 'city' ? 10 : 7); k += 2) {
      if (!r.chance(0.65)) continue;
      const [x0, y0] = rd[k], [x1, y1] = rd[k + 1], dir = Math.atan2(y1 - y0, x1 - x0) + (r.chance(0.5) ? 1 : -1) * Math.PI / 2;
      const len = r.int(3, size === 'city' ? 7 : 5), pts = [[x0, y0]]; for (let j = 1; j <= len; j++) pts.push([x0 + Math.cos(dir) * j * 2.2, y0 + Math.sin(dir) * j * 2.2]);
      streets.push(pts);
    }
    const toW = pts => pts.map(([x, y]) => [+(x * S).toFixed(1), +(y * S).toFixed(1)]);
    if (riverPts.length) m.paths.push({ id: MM.uid(), t: 'river', w: 0, pts: riverPts.map(p => p.map(v => +v.toFixed(1))) });
    roads.forEach(rd => m.paths.push({ id: MM.uid(), t: 'street', w: size === 'city' ? 1.6 : 1.25, pts: toW(rd) }));
    streets.forEach(st => m.paths.push({ id: MM.uid(), t: 'street', w: 0.9, pts: toW(st) }));
    const segs = [...roads, ...streets];
    const nearRoad = (x, y, d) => segs.some(pts => pts.some((p, i) => i && segDist([x, y], pts[i - 1], p) < d));
    // Walls for towns and cities.
    const wallR = Math.min(C, R) * ({ town: 0.3, city: 0.38 }[size] || 0);
    if (wallR && o.walls !== false) {
      const n = size === 'city' ? 14 : 10, pts = [];
      for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = wallR * r.range(0.9, 1.08); pts.push(i === n ? pts[0] : [cx + Math.cos(a) * rr * (C > R ? 1.15 : 1), cy + Math.sin(a) * rr]); }
      m.paths.push({ id: MM.uid(), t: 'wall', w: 1, closed: true, pts: toW(pts.slice(0, n)) });
      // gates where roads cross the wall
      for (const rd of roads) for (let i = 1; i < rd.length; i++) for (let j = 0; j < n; j++) { const hit = segX(rd[i - 1], rd[i], pts[j], pts[j + 1]); if (hit) { m.features.push(feat('gate', +(hit[0] * S).toFixed(1), +(hit[1] * S).toFixed(1), { r: Math.round(Math.atan2(rd[i][1] - rd[i - 1][1], rd[i][0] - rd[i - 1][0]) * 180 / Math.PI) })); break; } }
    }
    // Plaza and the important buildings.
    const plazaR = { hamlet: 2.2, village: 3, town: 4, city: 5.5 }[size];
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < plazaR && !water(x, y)) MM.setT(m, x, y, '=');
    const pois = [];
    const addPoi = (type, name, x, y, ft, sc) => { if (water(x, y)) return; m.features.push(feat(ft, +(x * S).toFixed(1), +(y * S).toFixed(1), { s: sc || 1, r: r.int(-15, 15) })); pois.push([x, y, (sc || 1) * MM.FEATURES[ft].size * 0.7 + 0.8]); m.places.push(place('poi', name, +(x * S).toFixed(1), +((y + (sc || 1) * MM.FEATURES[ft].size * 0.6 + 0.9) * S).toFixed(1))); };
    m.features.push(feat('well', +(cx * S).toFixed(1), +(cy * S).toFixed(1))); pois.push([cx, cy, 1.5]);
    if (size !== 'hamlet') { for (let i = 0; i < (size === 'city' ? 8 : size === 'town' ? 5 : 2); i++) { const a = i / 8 * Math.PI * 2 + 0.4; const x = cx + Math.cos(a) * plazaR * 0.6, y = cy + Math.sin(a) * plazaR * 0.6; m.features.push(feat('stall', +(x * S).toFixed(1), +(y * S).toFixed(1), { r: Math.round(a * 57.3) })); pois.push([x, y, 0.8]); } }
    const ringAt = (rad, a) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    const spots = r.shuffle([0, 1, 2, 3, 4, 5].map(i => i * Math.PI / 3 + r.range(-0.3, 0.3)));
    if (size !== 'hamlet') addPoi('temple', r.pick(MM.POI.temple), ...ringAt(plazaR + 3.2, spots[0]), 'temple', 1);
    addPoi('inn', r.pick(MM.POI.inn), ...ringAt(plazaR + 2.4, spots[1]), 'building', 1.5);
    if (size === 'city' || size === 'town') addPoi('keep', (size === 'city' ? 'Castle ' : 'Keep of ') + MM.placeName(r), ...ringAt(plazaR + (size === 'city' ? 8 : 5.5), spots[2]), 'keep', size === 'city' ? 1.2 : 0.9);
    if (size !== 'hamlet') addPoi('smithy', r.pick(MM.POI.smithy), ...ringAt(plazaR + 3, spots[3]), 'building', 1.2);
    if (size === 'city') addPoi('guild', r.pick(MM.POI.guild), ...ringAt(plazaR + 3.5, spots[4]), 'building', 1.6);
    if (river && size !== 'city') { const rp = riverPts[Math.floor(riverPts.length * 0.3)]; if (rp) addPoi('mill', r.pick(MM.POI.mill), rp[0] / S + 3.2, rp[1] / S, 'mill', 1); }
    // Bridges where roads cross the river.
    if (river) for (const rd of [...roads, ...streets]) for (let i = 1; i < rd.length; i++) { const [x, y] = rd[i]; if (x > 0 && y > 0 && x < C && y < R && MM.T(m, Math.floor(x), Math.floor(y)) === '~') { m.features.push(feat('bridge', +(x * S).toFixed(1), +(y * S).toFixed(1), { r: Math.round(Math.atan2(rd[i][1] - rd[i - 1][1], rd[i][0] - rd[i - 1][0]) * 57.3), s: size === 'city' ? 1.4 : 1.1 })); break; } }
    // Houses along the roads.
    const houses = [], maxH = { hamlet: 14, village: 45, town: 170, city: 420 }[size], reach = { hamlet: 12, village: 16, town: wallR * 1.05 || 22, city: wallR * 1.05 || 30 }[size];
    const tryHouse = (x, y, a, w, h) => {
      if (x < 1 || y < 1 || x > C - 1 || y > R - 1) return false;
      if (Math.hypot(x - cx, y - cy) > reach) return false;
      if (water(x, y) || water(x + Math.cos(a) * w / 2, y + Math.sin(a) * w / 2) || water(x - Math.cos(a) * w / 2, y - Math.sin(a) * w / 2)) return false;
      if (Math.hypot(x - cx, y - cy) < plazaR + 0.6) return false;
      const rad = Math.max(w, h) * 0.55;
      if (houses.some(q => Math.hypot(q[0] - x, q[1] - y) < (rad + q[2]) * 0.9)) return false;
      if (pois.some(q => Math.hypot(q[0] - x, q[1] - y) < rad + q[2])) return false;
      if (nearRoad(x, y, Math.min(w, h) * 0.45 + 0.6)) return false;
      houses.push([x, y, rad]);
      m.features.push(feat('building', +(x * S).toFixed(1), +(y * S).toFixed(1), { r: Math.round(a * 57.3), w: +w.toFixed(2), h: +h.toFixed(2), roof: r.int(0, 5) }));
      return true;
    };
    for (let pass = 0; pass < (size === 'city' ? 3 : 2) && houses.length < maxH; pass++) for (const pts of r.shuffle(segs.slice())) for (let i = 1; i < pts.length && houses.length < maxH; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
      for (let t = 0; t < len; t += r.range(1.6, 2.6)) for (const side of [1, -1]) {
        const w = r.range(1.4, size === 'city' ? 2.6 : 2.2), h = r.range(1.2, 1.9), off = 0.9 + h / 2 + pass * 2.3;
        const x = x0 + Math.cos(a) * t - Math.sin(a) * off * side, y = y0 + Math.sin(a) * t + Math.cos(a) * off * side;
        tryHouse(x, y, a, w, h);
      }
    }
    // Fields around villages and hamlets.
    if (size === 'village' || size === 'hamlet' || size === 'town') {
      for (let i = 0; i < (size === 'town' ? 6 : 8); i++) { const a = r.range(0, Math.PI * 2), d = reach + r.range(2, 8), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (x < 3 || y < 3 || x > C - 3 || y > R - 3 || water(x, y) || nearRoad(x, y, 2.6)) continue; m.features.push(feat('field', +(x * S).toFixed(1), +(y * S).toFixed(1), { r: r.int(0, 179), w: +r.range(3, 6).toFixed(1), h: +r.range(2.5, 4.5).toFixed(1), roof: r.int(0, 2) })); }
    }
    const before = m.features.length;
    scatter(m, r, ['tree', 'tree', 'bush'], { hamlet: 40, village: 55, town: 50, city: 40 }[size], (x, y) => !water(x, y) && Math.hypot(x - cx, y - cy) > reach * 0.85 && !nearRoad(x, y, 1.2) && !m.features.some(f => f.t === 'field' && Math.hypot(f.x / S - x, f.y / S - y) < 3.5));
    m.features.slice(before).forEach(f => { f.x = +(f.x * S).toFixed(1); f.y = +(f.y * S).toFixed(1); });
    // Districts and the settlement itself.
    if (size === 'city' || size === 'town') { const names = r.shuffle(MM.DISTRICTS.slice()); const n = size === 'city' ? 5 : 3; for (let i = 0; i < n; i++) { const a = ang0 + (i + 0.5) * Math.PI * 2 / nRoads * (nRoads / n) , d = reach * 0.62; m.places.push(place('district', names[i], +((cx + Math.cos(a) * d) * S).toFixed(1), +((cy + Math.sin(a) * d) * S).toFixed(1))); } }
    const pop = MM.POP[size];
    const name = o.name || MM.placeName(r);
    m.name = name;
    m.places.unshift(place(size, name, +(cx * S).toFixed(1), +((cy - plazaR - 0.6) * S).toFixed(1), { population: Math.round(r.int(pop[0], pop[1]) / 10) * 10, demographics: MM.demographics(r), center: true, notes: '' }));
    m.show.population = true; m.show.demographics = true; m.show.key = false;
    return m;
  };
  function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
  function segX(p1, p2, p3, p4) { const d = (p4[1] - p3[1]) * (p2[0] - p1[0]) - (p4[0] - p3[0]) * (p2[1] - p1[1]); if (!d) return null; const ua = ((p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0])) / d, ub = ((p2[0] - p1[0]) * (p1[1] - p3[1]) - (p2[1] - p1[1]) * (p1[0] - p3[0])) / d; return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1 ? [p1[0] + ua * (p2[0] - p1[0]), p1[1] + ua * (p2[1] - p1[1])] : null; }
  MM.segDist = segDist;

  G.make = o => { const fn = G[o.kind]; if (!fn) throw new Error('Unknown map type: ' + o.kind); const m = fn(Object.assign({ seed: MM.newSeed() }, o)); m.seed = o.seed || m.seed; if (o.style) m.style = o.style; if (o.grid) m.grid.type = o.grid; return m; };
})();
