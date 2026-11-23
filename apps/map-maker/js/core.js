// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Map Maker - core: seeded randomness, noise, names, the terrain / symbol / place catalogs,
// grid geometry (square and hex) and the map document (.ipmap).
(() => {
  'use strict';
  const MM = window.MM = window.MM || {};

  // ---------------------------------------------------------------- seeded randomness
  MM.hashStr = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
  MM.rng = seed => {
    let a = (typeof seed === 'number' ? seed : MM.hashStr(seed)) >>> 0 || 0x9e3779b9;
    const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.chance = p => r() < p;
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    r.weighted = pairs => { const tot = pairs.reduce((s, p) => s + p[1], 0); let x = r() * tot; for (const p of pairs) { if ((x -= p[1]) <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };
    return r;
  };
  // A cheap hash of integers to [0,1), for things drawn the same way every time (symbol jitter).
  MM.h2 = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  MM.newSeed = () => Math.random().toString(36).slice(2, 8);

  // Value noise with octaves, deterministic per seed.
  MM.noise2 = seed => {
    const s = MM.hashStr(String(seed)) & 0xffff;
    const v = (x, y) => MM.h2(x, y, s);
    const sm = t => t * t * (3 - 2 * t);
    const n = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
    return (x, y, oct = 4) => { let f = 1, amp = 1, sum = 0, tot = 0; for (let i = 0; i < oct; i++) { sum += n(x * f + i * 17.3, y * f - i * 9.1) * amp; tot += amp; f *= 2; amp *= 0.5; } return sum / tot; };
  };

  // ---------------------------------------------------------------- names
  const SYL_A = ['Ash', 'Bel', 'Cor', 'Dun', 'El', 'Fal', 'Gal', 'Har', 'Ith', 'Kar', 'Lor', 'Mor', 'Nor', 'Ost', 'Pel', 'Quel', 'Rav', 'Sar', 'Tor', 'Ul', 'Val', 'Wy', 'Yr', 'Zan', 'Bram', 'Cael', 'Dra', 'Esk', 'Gil', 'Hal'];
  const SYL_B = ['a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'or', 'en', 'an', 'ar', 'il', ''];
  const SYL_C = ['ford', 'wick', 'mere', 'holm', 'stead', 'haven', 'gard', 'moor', 'dale', 'fell', 'bridge', 'crest', 'reach', 'vale', 'thorpe', 'by', 'ton', 'well', 'rock', 'march', 'dor', 'heim', 'garth', 'rin', 'oth'];
  MM.placeName = r => { const n = r.pick(SYL_A) + r.pick(SYL_B) + r.pick(SYL_C); return n.charAt(0).toUpperCase() + n.slice(1).replace(/(.)\1\1/, '$1$1'); };
  const ADJ = ['Whispering', 'Iron', 'Grey', 'Shadow', 'Silver', 'Thorn', 'Ember', 'Frost', 'Hollow', 'Raven', 'Sunken', 'Broken', 'Golden', 'Mist', 'Wild', 'Old', 'Bleak', 'Amber', 'Storm', 'Witch'];
  MM.areaName = (r, kind) => {
    const nouns = { forest: ['Woods', 'Forest', 'Wildwood', 'Weald', 'Thicket'], mountain: ['Mountains', 'Peaks', 'Spine', 'Crags', 'Teeth'], hills: ['Hills', 'Downs', 'Barrows', 'Knolls'],
      swamp: ['Marsh', 'Fen', 'Bog', 'Mire'], desert: ['Wastes', 'Sands', 'Dunes', 'Barrens'], sea: ['Sea', 'Gulf', 'Sound', 'Deep'], lake: ['Lake', 'Mere', 'Tarn'], plains: ['Plains', 'Steppe', 'Fields', 'Moor'], tundra: ['Tundra', 'Icefields'] }[kind] || ['Lands'];
    return r.chance(0.6) ? `The ${r.pick(ADJ)} ${r.pick(nouns)}` : `${MM.placeName(r)} ${r.pick(nouns)}`;
  };
  MM.dungeonName = r => r.pick(['Tomb', 'Crypt', 'Vault', 'Halls', 'Warrens', 'Catacombs', 'Lair', 'Sanctum', 'Mines', 'Keep', 'Pit', 'Delve']) + ' of ' + r.pick(['the ' + r.pick(ADJ) + ' ' + r.pick(['King', 'Queen', 'Serpent', 'Wyrm', 'Oracle', 'Legion', 'Order', 'Hand', 'Flame', 'Crown']), MM.placeName(r)]);
  MM.ROOM_NAMES = ['Guard Room', 'Antechamber', 'Barracks', 'Armory', 'Shrine', 'Crypt', 'Ossuary', 'Storeroom', 'Well Room', 'Library', 'Laboratory', 'Throne Room', 'Prison Cells',
    'Kitchen', 'Feast Hall', 'Treasury', 'Torture Chamber', 'Collapsed Hall', 'Fungus Grotto', 'Flooded Chamber', 'Summoning Circle', 'Mess Hall', 'Kennel', 'Vestry', 'Gallery', 'Forge', 'Cistern', 'Hidden Study'];
  MM.DISTRICTS = ['Old Town', 'Market Ward', 'Temple Ward', 'Dockside', 'Craftsmen\'s Row', 'Noble Quarter', 'Tanners\' End', 'Lantern District', 'Garrison', 'Scholars\' Ward', 'Riverside', 'Smiths\' Ward'];
  MM.POI = { keep: ['Castle', 'Keep', 'Citadel'], temple: ['Temple of the Dawn', 'Shrine of the Twins', 'Moon Chapel', 'Cathedral of Light', 'Old Shrine'],
    inn: ['The Prancing Stag', 'The Drunken Gryphon', 'The Rusty Lantern', 'The Sleeping Giant', 'The Copper Kettle', 'The Wayfarer\'s Rest', 'The Green Dragon Inn'],
    market: ['Market Square', 'Grand Bazaar', 'Trade Cross'], smithy: ['The Smithy', 'Anvil & Ember'], guild: ['Guildhall', 'Merchants\' Hall', 'Mage Guild'], well: ['Town Well'], mill: ['Watermill', 'Windmill'] };

  // IPRPS species (used as suggestions; any text is allowed).
  MM.SPECIES = ['Human', 'Elf', 'Dwarf', 'Catfolk', 'Wolffolk', 'Bearfolk', 'Birdfolk', 'Rabbitfolk', 'Gemp', 'Orc', 'Goblin', 'Demon (Lilitu)', 'Angelicus', 'Lamia', 'Merfolk'];
  MM.demographics = (r, primary) => {
    const pool = r.shuffle(MM.SPECIES.slice()); const first = primary || (r.chance(0.6) ? 'Human' : pool[0]);
    const list = [first, ...pool.filter(s => s !== first).slice(0, r.int(1, 4))];
    let left = 100; const out = [];
    list.forEach((s, i) => { const last = i === list.length - 1; const p = last ? left : Math.max(1, Math.round(left * (i === 0 ? r.range(0.45, 0.8) : r.range(0.35, 0.7)))); out.push({ species: s, pct: p }); left -= p; });
    return out.filter(d => d.pct > 0);
  };
  MM.POP = { hamlet: [20, 90], village: [100, 900], town: [1000, 6000], city: [8000, 45000], fort: [40, 400], port: [800, 9000] };

  // ---------------------------------------------------------------- terrain (one ASCII character each: also the ASCII export)
  // sym: which symbol is scattered on those cells. kinds: which map types list it in the paint menu.
  MM.TERRAIN = {
    '~': { name: 'Deep water', color: '#2f6390', sym: 'wave', kinds: 'travel battle settlement' },
    '-': { name: 'Shallow water', color: '#5b93bd', kinds: 'travel battle settlement dungeon' },
    '.': { name: 'Floor (stone)', color: '#d8cfbb', kinds: 'battle dungeon' },
    '_': { name: 'Floor (wood)', color: '#a87b4f', sym: 'plank', kinds: 'battle dungeon settlement' },
    '#': { name: 'Wall / solid rock', color: '#3a3430', kinds: 'battle dungeon' },
    'c': { name: 'Cave floor', color: '#8d8170', kinds: 'battle dungeon' },
    'b': { name: 'Sand / beach', color: '#e6d6a0', kinds: 'travel battle settlement' },
    ',': { name: 'Grassland', color: '#a9c57c', kinds: 'travel battle settlement' },
    '"': { name: 'Tall grass', color: '#8fb565', sym: 'tuft', kinds: 'battle settlement' },
    ':': { name: 'Dirt / path', color: '#b39466', kinds: 'battle settlement dungeon' },
    '=': { name: 'Road / cobbles', color: '#a29d92', sym: 'stone', kinds: 'battle settlement' },
    'r': { name: 'Farmland', color: '#cdd18a', sym: 'crop', kinds: 'travel settlement' },
    'f': { name: 'Forest', color: '#6f9a55', sym: 'tree', kinds: 'travel settlement' },
    'F': { name: 'Dense forest / jungle', color: '#4b7a42', sym: 'tree2', kinds: 'travel' },
    'p': { name: 'Pine forest', color: '#5c8a5a', sym: 'pine', kinds: 'travel' },
    'h': { name: 'Hills', color: '#bdb47e', sym: 'hill', kinds: 'travel' },
    'M': { name: 'Mountains', color: '#a39582', sym: 'peak', kinds: 'travel' },
    'A': { name: 'Snowy peaks', color: '#e9edf0', sym: 'snowpeak', kinds: 'travel' },
    's': { name: 'Swamp / marsh', color: '#7f9468', sym: 'marsh', kinds: 'travel battle' },
    'd': { name: 'Desert', color: '#ead08f', sym: 'dune', kinds: 'travel battle' },
    't': { name: 'Tundra / snow', color: '#dfe7e8', kinds: 'travel battle' },
    'l': { name: 'Lava', color: '#d4502a', kinds: 'travel battle dungeon' },
    'x': { name: 'Rubble', color: '#9a9184', sym: 'rubble', kinds: 'battle dungeon settlement' },
    ' ': { name: 'Empty / void', color: '#000000', kinds: 'dungeon', hidden: true },
  };
  MM.terrainFor = kind => Object.entries(MM.TERRAIN).filter(([, t]) => t.kinds.split(' ').includes(kind)).map(([k]) => k);

  // Objects (stamps). size: default size in cells. kinds: where the stamp menu lists them.
  MM.FEATURES = {
    tree: { name: 'Tree', size: 1.4, kinds: 'battle settlement' }, pine: { name: 'Pine', size: 1.2, kinds: 'battle settlement' }, bush: { name: 'Bush', size: 0.8, kinds: 'battle settlement' },
    rock: { name: 'Rock', size: 0.8, kinds: 'battle dungeon' }, boulder: { name: 'Boulder', size: 1.6, kinds: 'battle dungeon' }, log: { name: 'Fallen log', size: 2, kinds: 'battle' },
    tent: { name: 'Tent', size: 2, kinds: 'battle settlement' }, campfire: { name: 'Campfire', size: 1, kinds: 'battle dungeon' }, well: { name: 'Well', size: 1.2, kinds: 'battle settlement' },
    statue: { name: 'Statue', size: 1, kinds: 'battle dungeon settlement' }, pillar: { name: 'Pillar', size: 0.9, kinds: 'battle dungeon' }, altar: { name: 'Altar', size: 1.4, kinds: 'battle dungeon' },
    chest: { name: 'Chest', size: 0.8, kinds: 'battle dungeon' }, barrel: { name: 'Barrel', size: 0.7, kinds: 'battle dungeon' }, crate: { name: 'Crate', size: 0.8, kinds: 'battle dungeon' },
    table: { name: 'Table', size: 1.6, kinds: 'battle dungeon' }, chair: { name: 'Chair', size: 0.6, kinds: 'battle dungeon' }, bed: { name: 'Bed', size: 1.6, kinds: 'battle dungeon' },
    counter: { name: 'Bar counter', size: 3, kinds: 'battle' }, hearth: { name: 'Hearth', size: 1.6, kinds: 'battle dungeon' },
    door: { name: 'Door', size: 1, kinds: 'battle dungeon' }, sdoor: { name: 'Secret door', size: 1, kinds: 'dungeon battle' }, portcullis: { name: 'Portcullis', size: 1, kinds: 'dungeon battle' },
    stairsup: { name: 'Stairs up', size: 1, kinds: 'dungeon battle' }, stairsdown: { name: 'Stairs down', size: 1, kinds: 'dungeon battle' }, ladder: { name: 'Ladder', size: 0.8, kinds: 'dungeon battle' },
    trap: { name: 'Trap', size: 0.8, kinds: 'dungeon battle' }, pit: { name: 'Pit', size: 1, kinds: 'dungeon battle' }, bones: { name: 'Bones', size: 0.8, kinds: 'dungeon battle' }, portal: { name: 'Portal', size: 1.4, kinds: 'dungeon battle' },
    web: { name: 'Web', size: 1.4, kinds: 'dungeon battle' }, coffin: { name: 'Sarcophagus', size: 1.6, kinds: 'dungeon' },
    building: { name: 'Building', size: 2, kinds: 'settlement' }, tower: { name: 'Tower', size: 2, kinds: 'settlement travel' }, keep: { name: 'Castle / keep', size: 4, kinds: 'settlement' },
    temple: { name: 'Temple', size: 3, kinds: 'settlement' }, stall: { name: 'Market stall', size: 1, kinds: 'settlement battle' }, bridge: { name: 'Bridge', size: 3, kinds: 'settlement battle travel' },
    boat: { name: 'Boat', size: 2, kinds: 'settlement battle travel' }, sign: { name: 'Signpost', size: 0.8, kinds: 'travel battle settlement' }, mill: { name: 'Mill', size: 2, kinds: 'settlement' },
    field: { name: 'Crop field', size: 4, kinds: 'settlement' }, gate: { name: 'Gate', size: 1.6, kinds: 'settlement' },
  };
  MM.featuresFor = kind => Object.entries(MM.FEATURES).filter(([, f]) => f.kinds.split(' ').includes(kind)).map(([k]) => k);

  // Named places. marker: what's drawn at the spot.
  MM.PLACE_KINDS = {
    city: { name: 'City', settlement: true }, town: { name: 'Town', settlement: true }, village: { name: 'Village', settlement: true }, hamlet: { name: 'Hamlet', settlement: true },
    port: { name: 'Port', settlement: true }, fort: { name: 'Fort / castle', settlement: true }, dungeon: { name: 'Dungeon', areas: true }, cave: { name: 'Cave', areas: true },
    ruin: { name: 'Ruin', areas: true }, landmark: { name: 'Landmark' }, area: { name: 'Area / region (label only)' }, district: { name: 'District (label only)', settlement: true },
    room: { name: 'Room / area (numbered)', areas: true }, poi: { name: 'Point of interest' },
  };
  MM.SETTLEMENT_SIZES = ['hamlet', 'village', 'town', 'city'];

  MM.STYLES = { color: 'Full color', parchment: 'Parchment', ink: 'Ink (black and white)', blueprint: 'Old-school blue', night: 'Night' };
  MM.KINDS = { travel: 'Travel / terrain map', battle: 'Battle map', dungeon: 'Dungeon level', settlement: 'Town, city or village' };

  // ---------------------------------------------------------------- color styles
  const hex2 = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const rgb2 = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  MM.mix = (a, b, t) => { const x = hex2(a), y = hex2(b); return rgb2(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  MM.shade = (c, t) => t < 0 ? MM.mix(c, '#000000', -t) : MM.mix(c, '#ffffff', t);
  MM.lum = c => { const [r, g, b] = hex2(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  // style(color) → the color in a map style; also the paper, ink and label colors of the style.
  MM.palette = style => {
    const P = {
      color: { f: c => c, paper: '#e9e2cc', ink: '#2b241b', label: '#1f1a12', halo: '#f6f0de', water: '#5b93bd', road: '#8a6b45', wall: '#5d554d', grid: '#000000' },
      parchment: { f: c => { const l = MM.lum(c); return MM.mix(MM.mix(c, '#d9c69a', 0.55), l > 0.5 ? '#f1e4c2' : '#6b5737', 0.25); }, paper: '#efe2c0', ink: '#4a3520', label: '#3a2612', halo: '#f4e9cc', water: '#8ea7a0', road: '#7a5a34', wall: '#5b4530', grid: '#4a3520' },
      ink: { f: c => { const l = MM.lum(c); return l < 0.3 ? '#b9b9b9' : rgb2(...Array(3).fill(200 + 55 * Math.min(1, (l - 0.3) / 0.6))); }, paper: '#ffffff', ink: '#111111', label: '#000000', halo: '#ffffff', water: '#d5d5d5', road: '#555555', wall: '#222222', grid: '#000000' },
      blueprint: { f: c => { const l = MM.lum(c); return l < 0.3 ? '#3f7fbf' : MM.mix('#ffffff', '#cfe3f5', 1 - l); }, paper: '#ffffff', ink: '#2a5f99', label: '#1d4a7a', halo: '#ffffff', water: '#9fc4e6', road: '#2a5f99', wall: '#2a5f99', grid: '#5b9bd5' },
      night: { f: c => MM.mix(c, '#0b1226', 0.55), paper: '#141a2c', ink: '#d6dbe8', label: '#f1e6c4', halo: '#0b0f1c', water: '#1f3e66', road: '#a58a5c', wall: '#8f8a84', grid: '#c8d0e8' },
    };
    return P[style] || P.color;
  };

  // ---------------------------------------------------------------- grid geometry
  // World units are pixels at 100% zoom. Square: cell c,r covers [c*C,(c+1)*C). Hex: pointy-top, odd rows shifted right.
  MM.geom = m => {
    const C = m.cell;
    if (m.grid.type === 'hex') {
      const W = C, H = C * 2 / Math.sqrt(3), dy = H * 0.75;
      const g = {
        hex: true, W, H, width: m.cols * W + W / 2, height: (m.rows - 1) * dy + H,
        center: (c, r) => [c * W + W / 2 + (r & 1 ? W / 2 : 0), r * dy + H / 2],
        corners: (c, r) => { const [x, y] = g.center(c, r); return [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (60 * i - 30); return [x + H / 2 * Math.cos(a), y + H / 2 * Math.sin(a)]; }); },
        cellAt: (x, y) => {
          const r0 = Math.round((y - H / 2) / dy); let best = null, bd = 1e18;
          for (let r = r0 - 1; r <= r0 + 1; r++) { if (r < 0 || r >= m.rows) continue; const c0 = Math.round((x - W / 2 - (r & 1 ? W / 2 : 0)) / W);
            for (let c = c0 - 1; c <= c0 + 1; c++) { if (c < 0 || c >= m.cols) continue; const [cx, cy] = g.center(c, r), d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bd) { bd = d; best = [c, r]; } } }
          return best;
        },
        neighbors: (c, r) => (r & 1 ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]).map(([dc, dr]) => [c + dc, r + dr]).filter(([a, b]) => a >= 0 && b >= 0 && a < m.cols && b < m.rows),
      };
      return g;
    }
    return {
      hex: false, W: C, H: C, width: m.cols * C, height: m.rows * C,
      center: (c, r) => [c * C + C / 2, r * C + C / 2],
      corners: (c, r) => [[c * C, r * C], [(c + 1) * C, r * C], [(c + 1) * C, (r + 1) * C], [c * C, (r + 1) * C]],
      cellAt: (x, y) => { const c = Math.floor(x / C), r = Math.floor(y / C); return c >= 0 && r >= 0 && c < m.cols && r < m.rows ? [c, r] : null; },
      neighbors: (c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [c + dc, r + dr]).filter(([a, b]) => a >= 0 && b >= 0 && a < m.cols && b < m.rows),
    };
  };

  // ---------------------------------------------------------------- the map document
  MM.FORMAT = 'iprps-map';
  MM.VERSION = 1;
  MM.uid = () => Math.random().toString(36).slice(2, 10);
  MM.blank = (kind = 'battle', opts = {}) => {
    const d = { travel: [60, 44, 'hex', 6, 'mi', 26, ','], battle: [30, 20, 'square', 5, 'ft', 40, ','], dungeon: [44, 32, 'square', 5, 'ft', 30, '#'], settlement: [84, 60, 'none', 10, 'ft', 14, ','] }[kind];
    let cols = opts.cols || d[0], rows = opts.rows || d[1];
    const orientation = opts.orientation || 'landscape';
    if ((orientation === 'portrait') === (cols > rows)) [cols, rows] = [rows, cols];
    return {
      format: MM.FORMAT, version: MM.VERSION, id: MM.uid(), name: opts.name || 'Untitled map', kind, subtype: opts.subtype || '', seed: opts.seed || MM.newSeed(),
      cols, rows, cell: d[5], orientation, north: 0, style: opts.style || (kind === 'dungeon' ? 'blueprint' : 'color'), level: kind === 'dungeon' ? 1 : undefined,
      grid: { type: opts.grid || d[2], show: kind !== 'settlement', opacity: 0.25 },
      scale: { per: d[3], unit: d[4] },
      terrain: d[6].repeat(cols * rows),
      features: [], paths: [], places: [], annotations: [],
      show: { title: true, legend: true, compass: true, scalebar: true, labels: true, population: kind === 'travel', demographics: false, key: kind === 'dungeon', symbols: true, texture: true },
      legendPos: 'br', compassPos: 'tr', scalePos: 'bl', compassStyle: 'rose8', notes: '', link: null,
      created: new Date().toISOString(), updated: new Date().toISOString(),
    };
  };
  MM.T = (m, c, r) => m.terrain[r * m.cols + c];
  MM.setT = (m, c, r, ch) => { if (c < 0 || r < 0 || c >= m.cols || r >= m.rows) return; const i = r * m.cols + c; m.terrain = m.terrain.slice(0, i) + ch + m.terrain.slice(i + 1); };
  MM.gridFrom = m => { const g = []; for (let r = 0; r < m.rows; r++) g.push(m.terrain.slice(r * m.cols, (r + 1) * m.cols).split('')); return g; };
  MM.gridTo = (m, g) => { m.terrain = g.map(row => row.join('')).join(''); };

  // Check and repair a map read from a file or the library (anything missing gets its default).
  MM.normalize = raw => {
    if (!raw || typeof raw !== 'object') throw new Error('Not a map file');
    if (raw.format && raw.format !== MM.FORMAT) throw new Error('Not an IPRPS map (format: ' + raw.format + ')');
    const kind = MM.KINDS[raw.kind] ? raw.kind : 'battle';
    const b = MM.blank(kind, { cols: raw.cols, rows: raw.rows, orientation: (raw.cols || 1) >= (raw.rows || 1) ? 'landscape' : 'portrait' });
    const m = Object.assign(b, raw, { kind });
    m.cols = Math.max(4, Math.min(300, m.cols | 0)); m.rows = Math.max(4, Math.min(300, m.rows | 0));
    m.cell = Math.max(6, Math.min(120, +m.cell || b.cell));
    m.grid = Object.assign({}, b.grid, raw.grid); if (!['square', 'hex', 'none'].includes(m.grid.type)) m.grid.type = 'square';
    m.scale = Object.assign({}, b.scale, raw.scale); m.show = Object.assign({}, b.show, raw.show);
    const n = m.cols * m.rows; let t = typeof m.terrain === 'string' ? m.terrain : '';
    t = t.split('').map(ch => (MM.TERRAIN[ch] ? ch : ',')).join('');
    m.terrain = t.length >= n ? t.slice(0, n) : t + ','.repeat(n - t.length);
    for (const k of ['features', 'paths', 'places', 'annotations']) m[k] = Array.isArray(m[k]) ? m[k].filter(x => x && typeof x === 'object') : [];
    m.features = m.features.filter(f => MM.FEATURES[f.t]).map(f => Object.assign({ id: MM.uid(), r: 0, s: 1 }, f, { x: +f.x || 0, y: +f.y || 0 }));
    m.paths = m.paths.filter(p => Array.isArray(p.pts)).map(p => Object.assign({ id: MM.uid(), t: 'road', w: 1 }, p));
    m.places = m.places.map(p => Object.assign({ id: MM.uid(), name: 'Unnamed', kind: 'poi', x: 0, y: 0, population: null, demographics: [], areas: [], notes: '' }, p))
      .map(p => (MM.PLACE_KINDS[p.kind] ? p : Object.assign(p, { kind: 'poi' })));
    m.annotations = m.annotations.filter(a => ['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'].includes(a.t)).map(a => Object.assign({ id: MM.uid(), color: '#c0392b', w: 3 }, a));
    m.format = MM.FORMAT; m.version = MM.VERSION; m.id = m.id || MM.uid();
    return m;
  };
  MM.clone = m => JSON.parse(JSON.stringify(m));
  MM.fmtPop = n => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
})();
