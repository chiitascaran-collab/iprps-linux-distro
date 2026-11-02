// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Small QR code encoder (byte mode, error correction M, versions 1-10) for the join link. Offline, no libraries.
(function (root) {
  'use strict';
  // [ec codewords per block, blocks in group 1, data per block g1, blocks in group 2, data per block g2] for level M
  const EC = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; }
  function rsDivisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
      root = gfMul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
    return r;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 0, spec;
    for (let v = 1; v <= 10; v++) {
      spec = EC[v]; const cap = spec[1] * spec[2] + spec[3] * spec[4];
      const bits = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
      if (bits <= cap * 8) { ver = v; break; }
    }
    if (!ver) throw new Error('Text too long for a QR code');
    spec = EC[ver];
    const dataCw = spec[1] * spec[2] + spec[3] * spec[4];
    // ---- bit stream
    const bb = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, dataCw * 8 - bb.length));
    while (bb.length % 8) bb.push(0);
    const data = [];
    for (let i = 0; i < bb.length; i += 8) data.push(parseInt(bb.slice(i, i + 8).join(''), 2));
    for (let pad = 0xec; data.length < dataCw; pad ^= 0xec ^ 0x11) data.push(pad);
    // ---- blocks + error correction, interleaved
    const blocks = [], div = rsDivisor(spec[0]);
    let k = 0;
    for (let g = 0; g < 2; g++) for (let b = 0; b < spec[1 + g * 2]; b++) {
      const d = data.slice(k, k += spec[2 + g * 2]); blocks.push({ d, e: rsRemainder(d, div) });
    }
    const final = [];
    const maxD = Math.max(...blocks.map(b => b.d.length));
    for (let i = 0; i < maxD; i++) blocks.forEach(b => { if (i < b.d.length) final.push(b.d[i]); });
    for (let i = 0; i < spec[0]; i++) blocks.forEach(b => final.push(b.e[i]));

    // ---- matrix
    const size = ver * 4 + 17;
    const M = Array.from({ length: size }, () => new Array(size).fill(false));
    const F = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { M[y][x] = dark; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = ALIGN[ver], n = al.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const drawFormat = mask => {
      const d = (0 << 3) | mask;                         // level M = 00
      let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((d << 10) | rem) ^ 0x5412, bit = i => ((bits >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);                                      // reserve the format areas
    if (ver >= 7) {
      let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) { const b = ((bits >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, b); set(c, a, b); }
    }
    // ---- data, zig-zag from the bottom right
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!F[y][x]) { M[y][x] = bi < final.length * 8 ? ((final[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1 : false; bi++; }
      }
    }
    // ---- choose the mask with the lowest penalty
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0, dark = 0;
      const line = get => {
        let run = 1;
        for (let i = 1; i <= size; i++) {
          if (i < size && get(i) === get(i - 1)) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
        for (let i = 0; i + 11 <= size; i++) {
          const s = Array.from({ length: 11 }, (_, k) => (get(i + k) ? 1 : 0)).join('');
          if (s === '10111010000' || s === '00001011101') p += 40;
        }
      };
      for (let y = 0; y < size; y++) line(x => M[y][x]);
      for (let x = 0; x < size; x++) line(y => M[y][x]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3;
      }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (M[y][x]) dark++;
      const total = size * size;
      p += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      apply(m); drawFormat(m);
      const pen = penalty(); if (pen < bestP) { bestP = pen; best = m; }
      apply(m);
    }
    apply(best); drawFormat(best);
    return M;
  }

  function svg(text, opts = {}) {
    const M = encode(text), q = 4, n = M.length + q * 2;
    let d = '';
    M.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + q},${y + q}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"${opts.size ? ` width="${opts.size}" height="${opts.size}"` : ''}>` +
      `<rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  const api = { encode, svg };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IPQR = api;
})(typeof self !== 'undefined' ? self : this);
