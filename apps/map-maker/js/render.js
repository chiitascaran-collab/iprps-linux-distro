// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Map Maker - draws a map document as one SVG: the editor, the preview, every export and printing
// all use this, so what you see is what you save.
(() => {
  'use strict';
  const MM = window.MM;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = v => Math.round(v * 10) / 10;
  MM.esc = esc;

  // Smooth curve through points (Catmull-Rom as cubic Béziers).
  MM.smooth = (pts, closed) => {
    if (pts.length < 2) return '';
    if (pts.length === 2) return `M${f1(pts[0][0])},${f1(pts[0][1])}L${f1(pts[1][0])},${f1(pts[1][1])}`;
    const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
    let d = `M${f1(P[1][0])},${f1(P[1][1])}`;
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d + (closed ? 'Z' : '');
  };

  // ---------------------------------------------------------------- symbols, drawn in a -1..1 box
  function symbols(P, st) {
    const c = col => P.f(col), ink = P.ink, sw = 0.09;
    const ROOF = ['#9c4a35', '#7a5a45', '#6f6a62', '#8a3f3f', '#5d6b7a', '#9a7b4a'].map(c);
    const S = {
      // terrain scatter
      tree: `<ellipse cx=".12" cy=".2" rx=".8" ry=".7" fill="#000" opacity=".18"/><circle r=".78" fill="${c('#5c8a44')}" stroke="${ink}" stroke-width="${sw}"/><circle cx="-.22" cy="-.25" r=".32" fill="${c('#7fae5c')}"/>`,
      pinetop: `<ellipse cx=".12" cy=".18" rx=".85" ry=".8" fill="#000" opacity=".18"/><path d="M0.95,0.00L0.51,0.21L0.67,0.67L0.21,0.51L0.00,0.95L-0.21,0.51L-0.67,0.67L-0.51,0.21L-0.95,0.00L-0.51,-0.21L-0.67,-0.67L-0.21,-0.51L-0.00,-0.95L0.21,-0.51L0.67,-0.67L0.51,-0.21Z" fill="${c('#2f5c3a')}" stroke="${ink}" stroke-width=".07" stroke-linejoin="round"/><path d="M0.59,0.12L0.27,0.18L0.33,0.50L0.06,0.31L-0.12,0.59L-0.18,0.27L-0.50,0.33L-0.31,0.06L-0.59,-0.12L-0.27,-0.18L-0.33,-0.50L-0.06,-0.31L0.12,-0.59L0.18,-0.27L0.50,-0.33L0.31,-0.06Z" fill="${c('#467a4c')}"/><circle r=".12" fill="${c('#6b4a2c')}"/>`,
      tree2: `<circle cx="-.35" cy=".1" r=".55" fill="${c('#3f6e36')}" stroke="${ink}" stroke-width="${sw}"/><circle cx=".35" cy=".15" r=".55" fill="${c('#46793c')}" stroke="${ink}" stroke-width="${sw}"/><circle cx="0" cy="-.3" r=".6" fill="${c('#4f8544')}" stroke="${ink}" stroke-width="${sw}"/>`,
      pine: `<path d="M0,-.95L.6,.15H.25L.75,.8H-.75L-.25,.15H-.6Z" fill="${c('#3d6b48')}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/><path d="M0,.8V.98" stroke="${ink}" stroke-width=".12"/>`,
      hill: `<path d="M-.9,.45Q0,-.75 .9,.45" fill="${c('#c9bf86')}" stroke="${ink}" stroke-width=".11"/><path d="M-.2,-.05Q.2,.0 .35,.35" fill="none" stroke="${ink}" stroke-width=".06" opacity=".6"/>`,
      peak: `<path d="M-1,.75L-.15,-.9L.3,-.2L.5,-.45L1,.75Z" fill="${c('#b7a995')}" stroke="${ink}" stroke-width=".09" stroke-linejoin="round"/><path d="M-.15,-.9L.05,.75H-1Z" fill="${c('#8b7c68')}" opacity=".9"/>`,
      snowpeak: `<path d="M-1,.75L-.15,-.9L.3,-.2L.5,-.45L1,.75Z" fill="${c('#b9c0c8')}" stroke="${ink}" stroke-width=".09" stroke-linejoin="round"/><path d="M-.15,-.9L-.45,-.3L-.2,-.38L0,-.2L.18,-.4Z" fill="#fff"/>`,
      tuft: `<path d="M-.4,.4L-.55,-.25M-.15,.4L-.1,-.5M.1,.4L.35,-.3M.35,.4L.65,0" stroke="${c('#4f7a33')}" stroke-width=".13" stroke-linecap="round" fill="none"/>`,
      marsh: `<path d="M-.7,.45H.7M-.4,.25H.4" stroke="${c('#4f7f92')}" stroke-width=".1"/><path d="M-.2,.2L-.3,-.45M0,.2V-.6M.2,.2L.32,-.42" stroke="${c('#4f6e33')}" stroke-width=".1" fill="none"/>`,
      dune: `<path d="M-.8,.3Q-.3,-.25 .2,.3M-.1,-.1Q.35,-.55 .8,-.05" stroke="${c('#b8945a')}" stroke-width=".1" fill="none"/>`,
      wave: `<path d="M-.7,0Q-.35,-.3 0,0T.7,0" stroke="${c('#bcd6ea')}" stroke-width=".1" fill="none" opacity=".7"/>`,
      crop: `<path d="M-.8,-.6H.8M-.8,-.2H.8M-.8,.2H.8M-.8,.6H.8" stroke="${c('#9a9a4a')}" stroke-width=".08" opacity=".6"/>`,
      stone: `<path d="M-1,-1H0V0H-1ZM0,0H1V1H0Z" fill="#000" opacity=".06"/><path d="M-1,0H1M0,-1V1" stroke="#000" stroke-width=".05" opacity=".25"/>`,
      plank: `<path d="M-1,-.5H1M-1,0H1M-1,.5H1" stroke="#000" stroke-width=".05" opacity=".28"/><path d="M-.3,-1V-.5M.4,-.5V0M-.6,0V.5M.2,.5V1" stroke="#000" stroke-width=".04" opacity=".22"/>`,
      rubble: `<path d="M-.6,-.2L-.3,-.5L0,-.2L-.3,.05ZM.2,.2L.55,.05L.7,.4L.35,.55ZM-.4,.35L-.15,.3L-.2,.6Z" fill="${c('#6d655a')}" stroke="${ink}" stroke-width=".05"/>`,
      // stamps
      bush: `<circle r=".7" fill="${c('#6b9a4b')}" stroke="${ink}" stroke-width="${sw}"/><circle cx=".25" cy="-.2" r=".3" fill="${c('#86b363')}"/>`,
      rock: `<path d="M-.8,.3L-.5,-.5L.2,-.75L.8,-.2L.6,.55L-.2,.75Z" fill="${c('#9c958a')}" stroke="${ink}" stroke-width=".1"/><path d="M-.5,-.5L0,0L.8,-.2M0,0L-.2,.75" stroke="${ink}" stroke-width=".05" fill="none" opacity=".5"/>`,
      boulder: `<path d="M-.9,.2L-.6,-.6L.1,-.85L.85,-.3L.75,.6L-.1,.85L-.7,.65Z" fill="${c('#8f887c')}" stroke="${ink}" stroke-width=".08"/><path d="M-.6,-.6L-.1,0L.85,-.3M-.1,0L-.1,.85" stroke="${ink}" stroke-width=".05" fill="none" opacity=".5"/>`,
      log: `<rect x="-1" y="-.25" width="2" height=".5" rx=".22" fill="${c('#8a6440')}" stroke="${ink}" stroke-width=".07"/><ellipse cx=".9" cy="0" rx=".12" ry=".22" fill="${c('#c9a77a')}"/>`,
      tent: `<path d="M-.9,.8L0,-.85L.9,.8Z" fill="${c('#c9b48a')}" stroke="${ink}" stroke-width=".08"/><path d="M0,-.85V.8" stroke="${ink}" stroke-width=".06"/>`,
      campfire: `<circle r=".7" fill="${c('#5b5148')}" stroke="${ink}" stroke-width=".07"/><path d="M0,-.55Q.45,0 0,.45Q-.45,0 0,-.55Z" fill="#f0a030"/><path d="M0,-.25Q.18,.05 0,.3Q-.18,.05 0,-.25Z" fill="#ffe27a"/>`,
      well: `<circle r=".8" fill="${c('#9d978c')}" stroke="${ink}" stroke-width=".1"/><circle r=".45" fill="${c('#2f5c80')}" stroke="${ink}" stroke-width=".07"/>`,
      statue: `<rect x="-.7" y="-.7" width="1.4" height="1.4" fill="${c('#b5afa4')}" stroke="${ink}" stroke-width=".08"/><circle r=".42" fill="${c('#d6d1c6')}" stroke="${ink}" stroke-width=".06"/>`,
      pillar: `<circle r=".8" fill="${c('#cfc8bb')}" stroke="${ink}" stroke-width=".12"/><circle r=".45" fill="none" stroke="${ink}" stroke-width=".05"/>`,
      altar: `<rect x="-.9" y="-.5" width="1.8" height="1" fill="${c('#a9a196')}" stroke="${ink}" stroke-width=".08"/><path d="M-.25,0H.25M0,-.28V.28" stroke="${c('#8a2a2a')}" stroke-width=".1"/>`,
      chest: `<rect x="-.8" y="-.55" width="1.6" height="1.1" rx=".1" fill="${c('#9a6a3a')}" stroke="${ink}" stroke-width=".08"/><path d="M-.8,-.1H.8" stroke="${c('#d9b45a')}" stroke-width=".12"/><rect x="-.12" y="-.22" width=".24" height=".26" fill="${c('#d9b45a')}"/>`,
      barrel: `<circle r=".85" fill="${c('#9a6d42')}" stroke="${ink}" stroke-width=".09"/><circle r=".55" fill="none" stroke="${ink}" stroke-width=".06"/><circle r=".15" fill="${ink}" opacity=".4"/>`,
      crate: `<rect x="-.8" y="-.8" width="1.6" height="1.6" fill="${c('#b08a58')}" stroke="${ink}" stroke-width=".09"/><path d="M-.8,-.8L.8,.8M.8,-.8L-.8,.8" stroke="${ink}" stroke-width=".06" opacity=".6"/>`,
      table: `<rect x="-.9" y="-.55" width="1.8" height="1.1" rx=".1" fill="${c('#9b7046')}" stroke="${ink}" stroke-width=".07"/>`,
      chair: `<rect x="-.6" y="-.6" width="1.2" height="1.2" rx=".15" fill="${c('#8a6240')}" stroke="${ink}" stroke-width=".1"/><path d="M-.6,-.45H.6" stroke="${ink}" stroke-width=".18"/>`,
      bed: `<rect x="-.55" y="-.95" width="1.1" height="1.9" rx=".08" fill="${c('#7a5a3a')}" stroke="${ink}" stroke-width=".06"/><rect x="-.45" y="-.3" width=".9" height="1.15" fill="${c('#b03a3a')}"/><rect x="-.4" y="-.85" width=".8" height=".4" rx=".1" fill="#f2ecdf"/>`,
      counter: `<rect x="-1" y="-.25" width="2" height=".5" fill="${c('#7f5634')}" stroke="${ink}" stroke-width=".05"/>`,
      hearth: `<rect x="-.9" y="-.55" width="1.8" height="1.1" fill="${c('#7d7468')}" stroke="${ink}" stroke-width=".08"/><rect x="-.55" y="-.15" width="1.1" height=".55" fill="#3a2a1e"/><path d="M0,-.05Q.25,.2 0,.38Q-.25,.2 0,-.05Z" fill="#f0a030"/>`,
      door: `<rect x="-.5" y="-.2" width="1" height=".4" fill="${c('#a0703f')}" stroke="${ink}" stroke-width=".1"/>`,
      sdoor: `<path d="M-.5,0H.5" stroke="${ink}" stroke-width=".14" stroke-dasharray=".18 .12"/><text y=".38" font-size=".7" text-anchor="middle" font-family="DejaVu Serif,serif" font-weight="700" fill="${ink}">S</text>`,
      portcullis: `<path d="M-.5,-.12H.5M-.5,.12H.5" stroke="${ink}" stroke-width=".08"/><path d="M-.35,-.2V.2M0,-.2V.2M.35,-.2V.2" stroke="${ink}" stroke-width=".08"/>`,
      stairsup: `<rect x="-.95" y="-.95" width="1.9" height="1.9" fill="${c('#d7d0c2')}" stroke="${ink}" stroke-width=".07"/><path d="M-.95,-.55H.95M-.95,-.15H.95M-.95,.25H.95M-.95,.65H.95" stroke="${ink}" stroke-width=".07"/><path d="M0,.75V-.75M-.3,-.45L0,-.8L.3,-.45" stroke="${c('#2a6f2a')}" stroke-width=".12" fill="none"/>`,
      stairsdown: `<rect x="-.95" y="-.95" width="1.9" height="1.9" fill="${c('#bdb5a6')}" stroke="${ink}" stroke-width=".07"/><path d="M-.95,-.55H.95M-.75,-.15H.75M-.55,.25H.55M-.35,.65H.35" stroke="${ink}" stroke-width=".07"/><path d="M0,-.75V.75M-.3,.45L0,.8L.3,.45" stroke="${c('#8a2a2a')}" stroke-width=".12" fill="none"/>`,
      ladder: `<path d="M-.35,-.9V.9M.35,-.9V.9M-.35,-.55H.35M-.35,-.1H.35M-.35,.35H.35" stroke="${c('#7a5230')}" stroke-width=".12"/>`,
      trap: `<rect x="-.75" y="-.75" width="1.5" height="1.5" fill="none" stroke="${c('#a02020')}" stroke-width=".1" stroke-dasharray=".2 .12"/><text y=".3" font-size=".9" text-anchor="middle" font-family="DejaVu Serif,serif" font-weight="700" fill="${c('#a02020')}">T</text>`,
      pit: `<rect x="-.85" y="-.85" width="1.7" height="1.7" fill="#1a1612" stroke="${ink}" stroke-width=".08"/><path d="M-.85,-.85L.85,.85M.85,-.85L-.85,.85" stroke="#555" stroke-width=".05"/>`,
      bones: `<path d="M-.6,-.4L.6,.4M-.6,.4L.4,-.3" stroke="${c('#e8e0cc')}" stroke-width=".18" stroke-linecap="round"/><circle cx=".55" cy="-.45" r=".22" fill="${c('#e8e0cc')}" stroke="${ink}" stroke-width=".04"/>`,
      portal: `<circle r=".85" fill="${c('#6a3fa0')}" opacity=".85" stroke="${ink}" stroke-width=".07"/><circle r=".55" fill="none" stroke="#d8c2ff" stroke-width=".08"/><circle r=".25" fill="#efe6ff"/>`,
      web: `<path d="M-.9,-.9L.9,.9M.9,-.9L-.9,.9M0,-1V1M-1,0H1" stroke="#e8e8e8" stroke-width=".04"/><circle r=".35" fill="none" stroke="#e8e8e8" stroke-width=".04"/><circle r=".7" fill="none" stroke="#e8e8e8" stroke-width=".04"/>`,
      coffin: `<path d="M-.35,-.95H.35L.5,-.4L.3,.95H-.3L-.5,-.4Z" fill="${c('#8c8578')}" stroke="${ink}" stroke-width=".07"/><path d="M0,-.6V.4M-.2,-.25H.2" stroke="${ink}" stroke-width=".06"/>`,
      tower: `<circle r=".85" fill="${c('#a29a8e')}" stroke="${ink}" stroke-width=".1"/><circle r=".55" fill="${c('#7f776b')}"/>`,
      keep: `<rect x="-.7" y="-.7" width="1.4" height="1.4" fill="${c('#8d867b')}" stroke="${ink}" stroke-width=".07"/><rect x="-.4" y="-.4" width=".8" height=".8" fill="${c('#a49c90')}" stroke="${ink}" stroke-width=".05"/>` + [[-.75, -.75], [.75, -.75], [-.75, .75], [.75, .75]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".22" fill="${c('#9a9286')}" stroke="${ink}" stroke-width=".05"/>`).join(''),
      temple: `<path d="M-.3,-.95H.3V-.3H.95V.3H.3V.95H-.3V.3H-.95V-.3H-.3Z" fill="${c('#d8d2c4')}" stroke="${ink}" stroke-width=".06"/><circle r=".22" fill="${c('#c9a14a')}"/>`,
      stall: `<rect x="-.8" y="-.6" width="1.6" height="1.2" fill="${c('#c0563f')}" stroke="${ink}" stroke-width=".08"/><path d="M-.8,-.2H.8M-.8,.2H.8" stroke="#f3e6c8" stroke-width=".14"/>`,
      bridge: `<rect x="-1" y="-.32" width="2" height=".64" fill="${c('#9a7650')}" stroke="${ink}" stroke-width=".05"/><path d="M-.75,-.32V.32M-.4,-.32V.32M-.05,-.32V.32M.3,-.32V.32M.65,-.32V.32" stroke="${ink}" stroke-width=".03" opacity=".5"/>`,
      boat: `<path d="M-1,0Q-.6,-.45 .55,-.38L1,0L.55,.38Q-.6,.45 -1,0Z" fill="${c('#8a6440')}" stroke="${ink}" stroke-width=".06"/><path d="M-.3,0H.4" stroke="${ink}" stroke-width=".06"/>`,
      sign: `<path d="M0,.9V-.6" stroke="${c('#6d4c2c')}" stroke-width=".14"/><path d="M-.7,-.75H.5L.8,-.5L.5,-.25H-.7Z" fill="${c('#b08a58')}" stroke="${ink}" stroke-width=".06"/>`,
      mill: `<rect x="-.6" y="-.6" width="1.2" height="1.2" fill="${c('#b89b72')}" stroke="${ink}" stroke-width=".07"/><path d="M-1,-1L1,1M1,-1L-1,1" stroke="${c('#6d4c2c')}" stroke-width=".14"/>`,
      gate: `<rect x="-.95" y="-.45" width=".6" height=".9" fill="${c('#8f877b')}" stroke="${ink}" stroke-width=".06"/><rect x=".35" y="-.45" width=".6" height=".9" fill="${c('#8f877b')}" stroke="${ink}" stroke-width=".06"/><path d="M-.35,0H.35" stroke="${c('#7a5230')}" stroke-width=".22"/>`,
      // place markers
      m_city: `<circle r=".95" fill="${P.halo}" stroke="${ink}" stroke-width=".14"/><circle r=".6" fill="${c('#a02a2a')}" stroke="${ink}" stroke-width=".08"/><circle r=".22" fill="${P.halo}"/>`,
      m_town: `<circle r=".8" fill="${c('#a02a2a')}" stroke="${ink}" stroke-width=".14"/><circle r=".3" fill="${P.halo}"/>`,
      m_village: `<circle r=".6" fill="${c('#3a2a1a')}" stroke="${P.halo}" stroke-width=".15"/>`,
      m_hamlet: `<circle r=".42" fill="${P.halo}" stroke="${ink}" stroke-width=".16"/>`,
      m_port: `<circle r=".85" fill="${P.halo}" stroke="${ink}" stroke-width=".12"/><path d="M0,-.55V.55M-.35,-.25H.35M-.5,.2Q0,.75 .5,.2" stroke="${c('#2a4f80')}" stroke-width=".14" fill="none"/>`,
      m_fort: `<path d="M-.8,.75V-.4H-.5V-.75H-.2V-.4H.2V-.75H.5V-.4H.8V.75Z" fill="${c('#8d867b')}" stroke="${ink}" stroke-width=".1"/>`,
      m_dungeon: `<path d="M-.8,.8V-.1A.8,.8 0 0 1 .8,-.1V.8Z" fill="#1d1a17" stroke="${P.halo}" stroke-width=".12"/><circle cy="-.05" r=".28" fill="#e8e0cc"/><path d="M-.12,.2V.38M.12,.2V.38" stroke="#e8e0cc" stroke-width=".1"/>`,
      m_cave: `<path d="M-.9,.7Q-.8,-.8 0,-.75Q.8,-.8 .9,.7Z" fill="${c('#6d6458')}" stroke="${ink}" stroke-width=".09"/><path d="M-.45,.7Q-.4,-.2 0,-.25Q.4,-.2 .45,.7Z" fill="#111"/>`,
      m_ruin: `<path d="M-.7,.8V-.3L-.45,-.6L-.3,-.3V.8ZM.2,.8V-.05L.45,-.25L.65,.1V.8Z" fill="${c('#a39b8f')}" stroke="${ink}" stroke-width=".08"/><path d="M-.9,.8H.9" stroke="${ink}" stroke-width=".1"/>`,
      m_landmark: `<path d="M0,-.95L.28,-.3L.95,-.3L.4,.12L.6,.85L0,.42L-.6,.85L-.4,.12L-.95,-.3L-.28,-.3Z" fill="${c('#d9b45a')}" stroke="${ink}" stroke-width=".08" stroke-linejoin="round"/>`,
      m_poi: `<path d="M0,-.7L.6,0L0,.7L-.6,0Z" fill="${c('#d9b45a')}" stroke="${ink}" stroke-width=".1"/>`,
    };
    S.roofs = ROOF;
    return S;
  }
  // A small picture of one symbol (stamp palette, legend previews).
  MM.icon = (key, style) => { const S = symbols(MM.palette(style || 'color')); return S[key] ? `<svg viewBox="-1.15 -1.15 2.3 2.3" xmlns="http://www.w3.org/2000/svg">${S[key]}</svg>` : ''; };
  const TERRAIN_SYM = (code, kind) => { const t = MM.TERRAIN[code]; if (!t || !t.sym) return null; if (kind !== 'travel' && ['tree', 'tree2', 'pine', 'hill', 'peak', 'snowpeak'].includes(t.sym)) return t.sym === 'hill' ? null : t.sym; return t.sym; };

  // ---------------------------------------------------------------- the map itself
  MM.render = (m, opts = {}) => {
    const P = MM.palette(m.style), S = symbols(P, m.style), geo = MM.geom(m), C = m.cell, show = Object.assign({}, m.show, opts.show);
    const W = geo.width, H = geo.height, fs = Math.max(11, Math.min(42, Math.min(W, H) / 52));
    const pad = Math.round(Math.max(12, fs * 1.1));
    const keyItems = show.key ? keyList(m) : [];
    const keyBelow = keyItems.length && m.orientation === 'portrait';
    const keyW = keyItems.length && !keyBelow ? Math.round(Math.max(260, fs * 17)) : 0;
    const keyLines = keyItems.length ? wrapKey(keyItems, keyBelow ? Math.floor(W / (fs * 0.52)) : Math.floor((keyW - fs) / (fs * 0.52))) : [];
    const keyH = keyBelow ? Math.round(keyLines.length * fs * 1.3 + fs * 3) : 0;
    const TW = W + pad * 2 + (keyW ? keyW + pad : 0), TH = H + pad * 2 + keyH;
    const o = [];
    const uid = 'mm' + (opts.uid || '');
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${TW} ${TH}" width="${opts.width || TW}" height="${opts.height || TH}" font-family="DejaVu Serif, Liberation Serif, Georgia, serif">`);
    if (opts.metadata) o.push(`<metadata id="iprps-map">${esc(JSON.stringify(m))}</metadata>`);
    o.push('<defs>');
    o.push(`<filter id="${uid}-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .28  0 0 0 0 .18  0 0 0 .55 0"/></filter>`);
    o.push(`<filter id="${uid}-rough" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="${f1(0.9 / C * 10) / 10}" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${f1(C * 0.55)}" xChannelSelector="R" yChannelSelector="G"/></filter>`);
    o.push(`<filter id="${uid}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${f1(1.6 / C * 10) / 10}" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 -.12"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
    for (const [k, v] of Object.entries(S)) if (typeof v === 'string') o.push(`<symbol id="${uid}-${k}" viewBox="-1 -1 2 2" overflow="visible">${v}</symbol>`);
    o.push(`<clipPath id="${uid}-clip"><rect width="${W}" height="${H}"/></clipPath>`);
    o.push('</defs>');
    // paper
    o.push(`<rect width="${TW}" height="${TH}" fill="${P.paper}"/>`);
    if (show.texture && m.style !== 'blueprint' && m.style !== 'ink') o.push(`<rect width="${TW}" height="${TH}" filter="url(#${uid}-paper)" opacity=".5"/>`);
    o.push(`<g transform="translate(${pad},${pad})"><g clip-path="url(#${uid}-clip)">`);

    // terrain
    const rough = show.texture && (m.kind === 'travel' || m.kind === 'settlement');
    o.push(`<g id="terrain"${rough ? ` filter="url(#${uid}-rough)"` : ''}>`);
    if (rough) o.push(`<rect x="-${C}" y="-${C}" width="${W + 2 * C}" height="${H + 2 * C}" fill="${P.f(MM.TERRAIN[mostCommonEdge(m)].color)}"/>`);
    if (geo.hex) {
      const by = {};
      for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) { const t = MM.T(m, c, r); (by[t] = by[t] || []).push(geo.corners(c, r)); }
      for (const [t, list] of Object.entries(by)) o.push(`<path fill="${tFill(t, P)}" stroke="${tFill(t, P)}" stroke-width=".8" d="${list.map(cs => 'M' + cs.map(p => f1(p[0]) + ',' + f1(p[1])).join('L') + 'Z').join('')}"/>`);
    } else {
      const by = {};
      for (let r = 0; r < m.rows; r++) { let c = 0; while (c < m.cols) { const t = MM.T(m, c, r); let e = c; while (e + 1 < m.cols && MM.T(m, e + 1, r) === t) e++; (by[t] = by[t] || []).push(`M${c * C},${r * C}h${(e - c + 1) * C}v${C}h-${(e - c + 1) * C}Z`); c = e + 1; } }
      for (const [t, list] of Object.entries(by)) o.push(`<path fill="${tFill(t, P)}" stroke="${tFill(t, P)}" stroke-width=".6" d="${list.join('')}"/>`);
    }
    o.push('</g>');
    // painted grain on battle and dungeon maps
    if (show.texture && (m.kind === 'battle' || m.kind === 'dungeon') && m.style !== 'blueprint' && m.style !== 'ink') o.push(`<rect width="${W}" height="${H}" fill="#000" filter="url(#${uid}-grain)" opacity=".55"/>`);
    // wall edges (square grids)
    if (!geo.hex && m.terrain.includes('#')) {
      let d = '';
      const solid = (c, r) => c < 0 || r < 0 || c >= m.cols || r >= m.rows ? true : '# '.includes(MM.T(m, c, r));
      for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
        if (!solid(c, r)) continue;
        if (!solid(c + 1, r)) d += `M${(c + 1) * C},${r * C}v${C}`; if (!solid(c - 1, r)) d += `M${c * C},${r * C}v${C}`;
        if (!solid(c, r + 1)) d += `M${c * C},${(r + 1) * C}h${C}`; if (!solid(c, r - 1)) d += `M${c * C},${r * C}h${C}`;
      }
      if (d) o.push(`<path d="${d}" stroke="${P.ink}" stroke-width="${f1(Math.max(2, C * 0.12))}" stroke-linecap="square" fill="none"/>`);
      if (m.kind === 'dungeon' && m.style !== 'blueprint') { // hatching in the rock next to rooms, the classic look
        let hd = ''; const L = C * 0.3;
        for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
          if (MM.T(m, c, r) !== '#') continue;
          let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (!solid(c + dx, r + dy)) { near = true; break; }
          if (!near) continue;
          for (let k = 0; k < 3; k++) { const x = c * C + MM.h2(c, r, k) * C, y = r * C + MM.h2(r, c, k + 9) * C, a = MM.h2(c, r, k + 4) * Math.PI; hd += `M${f1(x - Math.cos(a) * L)},${f1(y - Math.sin(a) * L)}l${f1(Math.cos(a) * L * 2)},${f1(Math.sin(a) * L * 2)}`; }
        }
        if (hd) o.push(`<path d="${hd}" stroke="${P.ink}" stroke-width="${f1(Math.max(1, C * 0.04))}" opacity=".55"/>`);
      }
    }
    // terrain symbols
    if (show.symbols) {
      const items = [];
      for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
        const t = MM.T(m, c, r), sym = TERRAIN_SYM(t, m.kind); if (!sym) continue;
        const [cx, cy] = geo.center(c, r);
        if (['stone', 'plank', 'crop'].includes(sym)) { items.push([cy, `<use href="#${uid}-${sym}" x="${f1(cx - C / 2)}" y="${f1(cy - C / 2)}" width="${C}" height="${C}"/>`]); continue; }
        const big = m.kind === 'travel', n = big && (sym === 'tree' || sym === 'tree2' || sym === 'pine') ? 2 : 1;
        if (!big && MM.h2(c, r, 5) > (sym === 'wave' ? 0.2 : 0.45)) continue;
        for (let k = 0; k < n; k++) {
          const jx = (MM.h2(c, r, k * 3 + 1) - 0.5) * C * (n > 1 ? 0.6 : 0.35), jy = (MM.h2(c, r, k * 3 + 2) - 0.5) * C * (n > 1 ? 0.5 : 0.3);
          const sz = C * (sym === 'peak' || sym === 'snowpeak' ? 1.12 : sym === 'hill' ? 0.9 : n > 1 ? 0.58 : 0.62) * (0.85 + MM.h2(c, r, k + 8) * 0.3);
          const x = cx + jx + (n > 1 ? (k ? 0.22 : -0.22) * C : 0), y = cy + jy + (n > 1 ? (k ? 0.18 : -0.12) * C : 0);
          items.push([y, `<use href="#${uid}-${sym}" x="${f1(x - sz / 2)}" y="${f1(y - sz / 2)}" width="${f1(sz)}" height="${f1(sz)}"/>`]);
        }
      }
      items.sort((a, b) => a[0] - b[0]);
      o.push('<g id="tsym">' + items.map(i => i[1]).join('') + '</g>');
    }
    // grid
    if (m.grid.show && m.grid.type !== 'none') {
      let d = '';
      if (geo.hex) { for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) { const cs = geo.corners(c, r); d += 'M' + cs.map(p => f1(p[0]) + ',' + f1(p[1])).join('L') + 'Z'; } }
      else { for (let c = 0; c <= m.cols; c++) d += `M${c * C},0V${H}`; for (let r = 0; r <= m.rows; r++) d += `M0,${r * C}H${W}`; }
      o.push(`<path id="grid" d="${d}" fill="none" stroke="${P.grid}" stroke-width="${f1(Math.max(0.6, C / 40))}" opacity="${m.grid.opacity ?? 0.25}"/>`);
    }
    // paths
    o.push('<g id="paths">');
    const order = { river: 0, street: 1, road: 2, trail: 3, wall: 4 };
    for (const p of m.paths.slice().sort((a, b) => (order[a.t] ?? 5) - (order[b.t] ?? 5))) {
      if (p.t === 'river' && p.w === 0) continue;
      const d = MM.smooth(p.pts, !!p.closed), w = (p.w || 1), sel = opts.sel === p.id ? ' class="sel"' : '';
      const da = `data-id="${p.id}" data-k="path"`;
      if (p.t === 'river') o.push(`<path ${da}${sel} d="${d}" fill="none" stroke="${P.water}" stroke-width="${f1(C * 0.2 * w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      else if (p.t === 'road') o.push(`<path ${da}${sel} d="${d}" fill="none" stroke="${P.road}" stroke-width="${f1(C * 0.11 * w)}" stroke-linecap="round" opacity=".9"/>`);
      else if (p.t === 'trail') o.push(`<path ${da}${sel} d="${d}" fill="none" stroke="${P.road}" stroke-width="${f1(C * 0.08 * w)}" stroke-dasharray="${f1(C * 0.25)} ${f1(C * 0.18)}" stroke-linecap="round"/>`);
      else if (p.t === 'street') o.push(`<g ${da}${sel}><path d="${d}" fill="none" stroke="${MM.shade(P.f('#a29d92'), -0.35)}" stroke-width="${f1(C * w + 2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${P.f('#cbbd9c')}" stroke-width="${f1(C * w)}" stroke-linecap="round" stroke-linejoin="round"/></g>`);
      else if (p.t === 'wall') {
        const tw = C * 0.55 * w;
        o.push(`<g ${da}${sel}><path d="${'M' + p.pts.map(q => f1(q[0]) + ',' + f1(q[1])).join('L') + (p.closed ? 'Z' : '')}" fill="none" stroke="${P.wall}" stroke-width="${f1(tw)}" stroke-linejoin="miter"/>` + p.pts.map(q => `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(tw * 1.25)}" fill="${MM.shade(P.wall, 0.15)}" stroke="${P.ink}" stroke-width="${f1(tw * 0.18)}"/>`).join('') + '</g>');
      }
    }
    o.push('</g>');
    // features
    o.push('<g id="features">');
    const fe = m.features.slice().sort((a, b) => (fOrder(a.t) - fOrder(b.t)) || a.y - b.y);
    for (const f of fe) {
      const def = MM.FEATURES[f.t]; if (!def) continue;
      const sel = opts.sel === f.id ? ' class="sel"' : '', da = `data-id="${f.id}" data-k="feature"`;
      if (f.t === 'building' || f.t === 'field') {
        const w = (f.w || 2) * C, h = (f.h || 1.5) * C;
        if (f.t === 'field') { const fc = P.f(['#cdd18a', '#b9c46f', '#d8c47c'][f.roof || 0]); o.push(`<g ${da}${sel} transform="translate(${f1(f.x)},${f1(f.y)}) rotate(${f.r || 0})"><rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${f1(h)}" fill="${fc}" stroke="${MM.shade(fc, -0.35)}" stroke-width="${f1(C * 0.08)}"/><path d="${Array.from({ length: Math.max(2, Math.floor(h / (C * 0.5))) }, (_, i) => `M${f1(-w / 2)},${f1(-h / 2 + (i + 0.5) * h / Math.max(2, Math.floor(h / (C * 0.5))))}h${f1(w)}`).join('')}" stroke="${MM.shade(fc, -0.25)}" stroke-width="${f1(C * 0.05)}"/></g>`); continue; }
        const roof = S.roofs[(f.roof || 0) % S.roofs.length];
        o.push(`<g ${da}${sel} transform="translate(${f1(f.x)},${f1(f.y)}) rotate(${f.r || 0})"><rect x="${f1(-w / 2 + C * 0.12)}" y="${f1(-h / 2 + C * 0.15)}" width="${f1(w)}" height="${f1(h)}" fill="#000" opacity=".25"/><rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${f1(h)}" fill="${roof}" stroke="${P.ink}" stroke-width="${f1(Math.max(0.8, C * 0.08))}"/><rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${f1(h / 2)}" fill="#fff" opacity=".12"/><path d="M${f1(-w / 2)},0H${f1(w / 2)}" stroke="${P.ink}" stroke-width="${f1(Math.max(0.6, C * 0.06))}" opacity=".7"/></g>`);
        continue;
      }
      const sz = def.size * (f.s || 1) * C;
      o.push(`<use ${da}${sel} href="#${uid}-${f.t === 'pine' ? 'pinetop' : f.t}" x="${f1(-sz / 2)}" y="${f1(-sz / 2)}" width="${f1(sz)}" height="${f1(sz)}" transform="translate(${f1(f.x)},${f1(f.y)}) rotate(${f.r || 0})"/>`);
    }
    o.push('</g>');
    // places and labels
    o.push('<g id="places">');
    const halo = `stroke="${P.halo}" stroke-width="${f1(fs * 0.28)}" stroke-linejoin="round" paint-order="stroke"`;
    for (const p of m.places) {
      const sel = opts.sel === p.id ? ' class="sel"' : '', da = `data-id="${p.id}" data-k="place"`, sz = p.size || 1;
      const lw = String(p.name).length * fs * 0.62 * sz * (p.kind === 'area' ? 1.35 : p.kind === 'district' ? 1.2 : 1);
      const x = f1(Math.max(lw / 2 + 4, Math.min(W - lw / 2 - 4, p.x))), y = f1(Math.max(fs * 1.2, Math.min(H - fs * 0.4, p.y))), lines = [];
      if (p.kind === 'area') { if (show.labels) o.push(`<text ${da}${sel} x="${x}" y="${y}" text-anchor="middle" font-size="${f1(fs * 1.25 * sz)}" font-style="italic" letter-spacing="${f1(fs * 0.12)}" fill="${P.label}" ${halo} opacity=".92">${esc(p.name)}</text>`); continue; }
      if (p.kind === 'district') { if (show.labels) o.push(`<text ${da}${sel} x="${x}" y="${y}" text-anchor="middle" font-size="${f1(fs * 0.95 * sz)}" letter-spacing="${f1(fs * 0.25)}" fill="${P.label}" ${halo} opacity=".8">${esc(p.name.toUpperCase())}</text>`); continue; }
      if (p.kind === 'room') {
        if (p.rect && opts.editor) o.push(`<rect x="${f1(p.rect[0])}" y="${f1(p.rect[1])}" width="${f1(p.rect[2])}" height="${f1(p.rect[3])}" fill="none" stroke="#d9b45a" stroke-dasharray="4 3" opacity=".0"/>`);
        const rr = Math.max(fs * 0.62, C * 0.36) * sz;
        o.push(`<g ${da}${sel}><circle cx="${x}" cy="${y}" r="${f1(rr)}" fill="${P.halo}" stroke="${P.ink}" stroke-width="${f1(rr * 0.12)}"/><text x="${x}" y="${f1(p.y + rr * 0.38)}" text-anchor="middle" font-size="${f1(rr * 1.05)}" font-weight="700" fill="${P.label}">${esc(p.num ?? '?')}</text>${show.labels && opts.roomNames !== false && !show.key ? `<text x="${f1(p.x + rr * 1.3)}" y="${f1(p.y + rr * 0.38)}" font-size="${f1(fs * 0.8)}" fill="${P.label}" ${halo}>${esc(p.name)}</text>` : ''}</g>`);
        continue;
      }
      if (p.center && show.title && m.kind === 'settlement') continue;   // its name, population and people are in the title
      const mk = 'm_' + (S['m_' + p.kind] ? p.kind : 'poi'), ms = fs * (p.kind === 'city' ? 1.5 : p.kind === 'town' || p.kind === 'port' || p.kind === 'fort' ? 1.2 : p.kind === 'hamlet' ? 0.75 : 1) * sz;
      const inSettlement = m.kind === 'settlement';
      if (!(inSettlement && (p.kind === 'poi' || p.center))) lines.push(`<use href="#${uid}-${mk}" x="${f1(p.x - ms / 2)}" y="${f1(p.y - ms / 2)}" width="${f1(ms)}" height="${f1(ms)}"/>`);
      if (show.labels) {
        const big = p.center ? 1.7 : p.kind === 'city' ? 1.2 : p.kind === 'poi' ? 0.78 : p.kind === 'hamlet' ? 0.85 : 1;
        let ty = p.center ? p.y : p.y + ms * 0.5 + fs * big * 0.95;
        if (p.center) lines.push(`<text x="${x}" y="${f1(ty)}" text-anchor="middle" font-size="${f1(fs * big * sz)}" font-weight="700" letter-spacing="${f1(fs * 0.1)}" fill="${P.label}" ${halo}>${esc(p.name)}</text>`);
        else lines.push(`<text x="${x}" y="${f1(ty)}" text-anchor="middle" font-size="${f1(fs * big * sz)}"${p.kind === 'city' ? ' font-weight="700"' : ''}${p.kind === 'poi' ? ' font-style="italic"' : ''} fill="${P.label}" ${halo}>${esc(p.name)}</text>`);
        const sub = [];
        if (show.population && p.population) sub.push('Pop. ' + MM.fmtPop(p.population));
        if (show.demographics && p.demographics && p.demographics.length) sub.push(p.demographics.map(d => `${d.species} ${d.pct}%`).join(' · '));
        sub.forEach((s, i) => lines.push(`<text x="${x}" y="${f1(ty + fs * (0.95 + i * 0.85) * (p.center ? 1.1 : 1))}" text-anchor="middle" font-size="${f1(fs * (p.center ? 0.85 : 0.68))}" font-style="italic" fill="${P.label}" ${halo}>${esc(s)}</text>`));
      }
      o.push(`<g ${da}${sel}>${lines.join('')}</g>`);
    }
    o.push('</g>');
    // annotations
    o.push('<g id="anno">');
    for (const a of m.annotations) o.push(annoSVG(a, opts.sel === a.id, opts.editor));
    if (opts.draft) o.push(annoSVG(opts.draft, false));
    o.push('</g>');
    o.push('</g>'); // clip
    // frame
    o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${P.ink}" stroke-width="${f1(Math.max(1.5, fs * 0.14))}"/>`);
    // overlays
    if (show.title) o.push(titleSVG(m, P, W, fs));
    if (show.compass) o.push(compassSVG(m, P, W, H, fs));
    if (show.scalebar) o.push(scaleSVG(m, P, geo, W, H, fs));
    if (show.legend) o.push(legendSVG(m, P, S, uid, W, H, fs));
    o.push('</g>');
    if (keyLines.length) o.push(keySVG(keyLines, P, fs, keyBelow ? pad : W + pad * 2, keyBelow ? H + pad * 2 : pad, keyBelow ? W : keyW, keyBelow ? keyH - pad : H, m));
    o.push('</svg>');
    return { svg: o.join(''), width: TW, height: TH, pad, W, H };
  };

  const tFill = (t, P) => (t === ' ' ? P.paper : P.f(MM.TERRAIN[t] ? MM.TERRAIN[t].color : '#888888'));
  const fOrder = t => (t === 'field' ? 0 : t === 'bridge' ? 1 : ['tree', 'pine', 'bush'].includes(t) ? 3 : 2);
  function mostCommonEdge(m) { const n = {}; for (let c = 0; c < m.cols; c++) for (const r of [0, m.rows - 1]) { const t = MM.T(m, c, r); n[t] = (n[t] || 0) + 1; } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]; }

  function annoSVG(a, sel, editor) {
    if (editor && a.id && a.t !== 'text') { const g = annoSVG(Object.assign({}, a, { color: 'transparent', w: Math.max(14, (a.w || 3) + 10), fill: false }), false, false); return `<g data-id="${a.id}" data-k="anno"${sel ? ' class="sel"' : ''}>${annoSVG(Object.assign({}, a, { id: '' }), false, false)}${g.replace(/ data-id="[^"]*" data-k="anno"/, '')}</g>`; }
    const s = `stroke="${esc(a.color)}" stroke-width="${f1(a.w || 3)}" stroke-linecap="round" stroke-linejoin="round"`, fill = a.fill ? `fill="${esc(a.color)}" fill-opacity=".25"` : 'fill="none"';
    const da = a.id ? `data-id="${a.id}" data-k="anno"${sel ? ' class="sel"' : ''}` : '';
    const p = a.pts || [];
    if (a.t === 'pen' && p.length) return `<path ${da} d="${'M' + p.map(q => f1(q[0]) + ',' + f1(q[1])).join('L')}" ${s} fill="none"/>`;
    if ((a.t === 'line' || a.t === 'arrow') && p.length > 1) {
      const [x1, y1] = p[0], [x2, y2] = p[1], ang = Math.atan2(y2 - y1, x2 - x1), L = Math.max(10, (a.w || 3) * 4);
      const head = a.t === 'arrow' ? `<path d="M${f1(x2)},${f1(y2)}L${f1(x2 - L * Math.cos(ang - 0.45))},${f1(y2 - L * Math.sin(ang - 0.45))}L${f1(x2 - L * Math.cos(ang + 0.45))},${f1(y2 - L * Math.sin(ang + 0.45))}Z" fill="${esc(a.color)}"/>` : '';
      return `<g ${da}><path d="M${f1(x1)},${f1(y1)}L${f1(x2)},${f1(y2)}" ${s}/>${head}</g>`;
    }
    if ((a.t === 'rect' || a.t === 'ellipse') && p.length > 1) {
      const x = Math.min(p[0][0], p[1][0]), y = Math.min(p[0][1], p[1][1]), w = Math.abs(p[1][0] - p[0][0]), h = Math.abs(p[1][1] - p[0][1]);
      return a.t === 'rect' ? `<rect ${da} x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" ${s} ${fill}/>` : `<ellipse ${da} cx="${f1(x + w / 2)}" cy="${f1(y + h / 2)}" rx="${f1(w / 2)}" ry="${f1(h / 2)}" ${s} ${fill}/>`;
    }
    if (a.t === 'text' && p.length) return `<text ${da} x="${f1(p[0][0])}" y="${f1(p[0][1])}" font-size="${f1(a.size || 22)}" font-weight="700" fill="${esc(a.color)}" stroke="#ffffff" stroke-width="${f1((a.size || 22) * 0.2)}" stroke-linejoin="round" paint-order="stroke">${esc(a.text)}</text>`;
    return '';
  }

  function corner(pos, W, H, w, h, m) {
    const x = pos[1] === 'l' ? m : pos[1] === 'c' ? (W - w) / 2 : W - w - m, y = pos[0] === 't' ? m : H - h - m;
    return [x, y];
  }
  function titleSVG(m, P, W, fs) {
    const ctr = m.kind === 'settlement' ? m.places.find(p => p.center) : null;
    let sub = m.kind === 'dungeon' ? `Level ${m.level || 1}` : m.kind === 'settlement' ? (MM.PLACE_KINDS[m.subtype] || {}).name || '' : m.kind === 'battle' ? 'Battle map' : '';
    if (ctr && m.show.population && ctr.population) sub += (sub ? ' · ' : '') + 'Population ' + MM.fmtPop(ctr.population);
    const sub2 = ctr && m.show.demographics && (ctr.demographics || []).length ? ctr.demographics.map(d => `${d.species} ${d.pct}%`).join(' · ') : '';
    const t = esc(m.name), tw = Math.min(W * 0.9, Math.max(t.length * fs * 0.72, sub.length * fs * 0.45, sub2.length * fs * 0.4) + fs * 3), th = fs * (sub2 ? 3.7 : sub ? 2.9 : 2.1), x = (W - tw) / 2, y = fs * 0.6;
    return `<g id="title"><path d="M${f1(x)},${f1(y)}h${f1(tw)}l${f1(-fs * 0.6)},${f1(th / 2)}l${f1(fs * 0.6)},${f1(th / 2)}h${f1(-tw)}l${f1(fs * 0.6)},${f1(-th / 2)}Z" fill="${P.halo}" stroke="${P.ink}" stroke-width="${f1(fs * 0.1)}" opacity=".95"/>`
      + `<text x="${f1(W / 2)}" y="${f1(y + fs * 1.45)}" text-anchor="middle" font-size="${f1(fs * 1.25)}" font-weight="700" letter-spacing="${f1(fs * 0.08)}" fill="${P.label}">${t}</text>`
      + (sub ? `<text x="${f1(W / 2)}" y="${f1(y + fs * 2.4)}" text-anchor="middle" font-size="${f1(fs * 0.72)}" font-style="italic" fill="${P.label}">${esc(sub)}</text>` : '')
      + (sub2 ? `<text x="${f1(W / 2)}" y="${f1(y + fs * 3.25)}" text-anchor="middle" font-size="${f1(fs * 0.62)}" fill="${P.label}">${esc(sub2)}</text>` : '') + '</g>';
  }
  function compassSVG(m, P, W, H, fs) {
    const R = fs * 2.4, [x, y] = corner(m.compassPos || 'tr', W, H, R * 2, R * 2 + fs, fs * 0.8), cx = x + R, cy = y + R + fs * 0.3, st = m.compassStyle || 'rose8';
    let g = `<g id="compass" transform="translate(${f1(cx)},${f1(cy)}) rotate(${m.north || 0})">`;
    if (st === 'arrow') g += `<path d="M0,${f1(-R)}L${f1(R * 0.35)},${f1(R * 0.6)}L0,${f1(R * 0.35)}L${f1(-R * 0.35)},${f1(R * 0.6)}Z" fill="${P.ink}" stroke="${P.halo}" stroke-width="${f1(fs * 0.08)}"/>`;
    else {
      g += `<circle r="${f1(R * 0.82)}" fill="${P.halo}" fill-opacity=".7" stroke="${P.ink}" stroke-width="${f1(fs * 0.07)}"/><circle r="${f1(R * 0.62)}" fill="none" stroke="${P.ink}" stroke-width="${f1(fs * 0.04)}"/>`;
      const pts = st === 'rose4' ? 4 : 8;
      for (let i = 0; i < pts; i++) {
        const a = i * Math.PI * 2 / pts - Math.PI / 2, L = i % 2 && pts === 8 ? R * 0.62 : R, w = R * (i % 2 && pts === 8 ? 0.12 : 0.18);
        const tip = [Math.cos(a) * L, Math.sin(a) * L], l = [Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w], r = [-l[0], -l[1]];
        g += `<path d="M0,0L${f1(l[0])},${f1(l[1])}L${f1(tip[0])},${f1(tip[1])}Z" fill="${P.ink}"/><path d="M0,0L${f1(r[0])},${f1(r[1])}L${f1(tip[0])},${f1(tip[1])}Z" fill="${P.halo}" stroke="${P.ink}" stroke-width="${f1(fs * 0.04)}"/>`;
      }
    }
    g += `<text y="${f1(-R - fs * 0.25)}" text-anchor="middle" font-size="${f1(fs * 0.95)}" font-weight="700" fill="${P.label}" stroke="${P.halo}" stroke-width="${f1(fs * 0.22)}" paint-order="stroke">N</text></g>`;
    return g;
  }
  function niceLen(target) { const p = Math.pow(10, Math.floor(Math.log10(target))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= target) return k * p; return 10 * p; }
  function scaleSVG(m, P, geo, W, H, fs) {
    const unitPx = geo.W / (m.scale.per || 1), total = niceLen(W * 0.22 / unitPx), len = total * unitPx, seg = 4, h = fs * 0.45;
    const [x, y] = corner(m.scalePos || 'bl', W, H, len + fs * 2, fs * 2.6, fs * 0.8);
    let g = `<g id="scalebar" transform="translate(${f1(x + fs)},${f1(y + fs * 0.5)})"><rect x="${f1(-fs * 0.6)}" y="${f1(-fs * 0.5)}" width="${f1(len + fs * 1.2 + fs * 1.4)}" height="${f1(fs * 2.4)}" rx="${f1(fs * 0.2)}" fill="${P.halo}" opacity=".8"/>`;
    for (let i = 0; i < seg; i++) g += `<rect x="${f1(i * len / seg)}" y="0" width="${f1(len / seg)}" height="${f1(h)}" fill="${i % 2 ? P.halo : P.ink}" stroke="${P.ink}" stroke-width="${f1(fs * 0.05)}"/>`;
    const lab = v => `${+v.toFixed(2)}`;
    g += `<text x="0" y="${f1(h + fs * 1.05)}" text-anchor="middle" font-size="${f1(fs * 0.7)}" fill="${P.label}">0</text><text x="${f1(len / 2)}" y="${f1(h + fs * 1.05)}" text-anchor="middle" font-size="${f1(fs * 0.7)}" fill="${P.label}">${lab(total / 2)}</text><text x="${f1(len)}" y="${f1(h + fs * 1.05)}" text-anchor="middle" font-size="${f1(fs * 0.7)}" fill="${P.label}">${lab(total)} ${esc(m.scale.unit)}</text>`;
    g += `<text x="${f1(len + fs * 0.9)}" y="${f1(h * 0.9)}" font-size="${f1(fs * 0.55)}" fill="${P.label}" font-style="italic">1 ${m.grid.type === 'hex' ? 'hex' : 'square'} = ${esc(m.scale.per)} ${esc(m.scale.unit)}</text></g>`;
    return g;
  }
  // Entries: everything on the map, in a sensible order.
  MM.legendEntries = m => {
    const out = [], seenT = new Set(m.terrain);
    for (const k of Object.keys(MM.TERRAIN)) if (seenT.has(k) && !MM.TERRAIN[k].hidden) out.push({ type: 'terrain', key: k, name: MM.TERRAIN[k].name });
    const pt = { river: 'River', road: 'Road', trail: 'Trail', street: 'Street', wall: 'Wall' };
    for (const t of Object.keys(pt)) if (m.paths.some(p => p.t === t && !(t === 'river' && p.w === 0))) out.push({ type: 'path', key: t, name: pt[t] });
    const ft = new Set(m.features.map(f => f.t));
    for (const k of Object.keys(MM.FEATURES)) if (ft.has(k) && !['tree', 'bush', 'pine', 'building', 'field', 'chair'].includes(k)) out.push({ type: 'feature', key: k, name: MM.FEATURES[k].name });
    const pk = new Set(m.places.map(p => p.kind));
    for (const k of ['city', 'town', 'port', 'village', 'hamlet', 'fort', 'dungeon', 'cave', 'ruin', 'landmark']) if (pk.has(k) && m.kind !== 'settlement') out.push({ type: 'place', key: k, name: MM.PLACE_KINDS[k].name });
    return out;
  };
  function legendSVG(m, P, S, uid, W, H, fs) {
    let items = MM.legendEntries(m); if (!items.length) return '';
    const max = m.legendMax || 18; if (items.length > max) items = items.slice(0, max);
    const cols = items.length > 9 ? 2 : 1, rows = Math.ceil(items.length / cols), rh = fs * 1.15, colW = fs * 0.5 * Math.max(...items.map(i => i.name.length)) + fs * 2.2;
    const bw = cols * colW + fs * 0.8, bh = rows * rh + fs * 2;
    const [x, y] = corner(m.legendPos || 'br', W, H, bw, bh, fs * 0.8);
    let g = `<g id="legend" transform="translate(${f1(x)},${f1(y)})"><rect width="${f1(bw)}" height="${f1(bh)}" rx="${f1(fs * 0.25)}" fill="${P.halo}" fill-opacity=".9" stroke="${P.ink}" stroke-width="${f1(fs * 0.07)}"/><text x="${f1(bw / 2)}" y="${f1(fs * 1.15)}" text-anchor="middle" font-size="${f1(fs * 0.8)}" font-weight="700" letter-spacing="${f1(fs * 0.12)}" fill="${P.label}">LEGEND</text>`;
    items.forEach((it, i) => {
      const cx = fs * 0.5 + Math.floor(i / rows) * colW, cy = fs * 1.6 + (i % rows) * rh, s = fs * 0.95;
      if (it.type === 'terrain') { const sym = TERRAIN_SYM(it.key, m.kind); g += `<rect x="${f1(cx)}" y="${f1(cy)}" width="${f1(s)}" height="${f1(s)}" fill="${tFill(it.key, P)}" stroke="${P.ink}" stroke-width="${f1(fs * 0.04)}"/>` + (sym && m.show.symbols ? `<use href="#${uid}-${sym}" x="${f1(cx + s * 0.1)}" y="${f1(cy + s * 0.1)}" width="${f1(s * 0.8)}" height="${f1(s * 0.8)}"/>` : ''); }
      else if (it.type === 'path') { const col = it.key === 'river' ? P.water : it.key === 'wall' ? P.wall : P.road; g += `<path d="M${f1(cx)},${f1(cy + s / 2)}h${f1(s)}" stroke="${col}" stroke-width="${f1(it.key === 'street' || it.key === 'wall' ? s * 0.35 : s * 0.18)}"${it.key === 'trail' ? ` stroke-dasharray="${f1(s * 0.25)} ${f1(s * 0.15)}"` : ''}/>`; }
      else if (it.type === 'feature') g += `<use href="#${uid}-${it.key === 'pine' ? 'pinetop' : it.key}" x="${f1(cx)}" y="${f1(cy)}" width="${f1(s)}" height="${f1(s)}"/>`;
      else g += `<use href="#${uid}-m_${it.key}" x="${f1(cx)}" y="${f1(cy)}" width="${f1(s)}" height="${f1(s)}"/>`;
      g += `<text x="${f1(cx + s + fs * 0.35)}" y="${f1(cy + s * 0.8)}" font-size="${f1(fs * 0.72)}" fill="${P.label}">${esc(it.name)}</text>`;
    });
    return g + '</g>';
  }
  // The key: numbered rooms (dungeons, interiors) or the gazetteer (settlements and their people).
  function keyList(m) {
    const rooms = m.places.filter(p => p.kind === 'room').sort((a, b) => (a.num || 0) - (b.num || 0));
    const items = [];
    if (rooms.length) for (const p of rooms) items.push({ head: `${p.num ?? '•'}. ${p.name}`, body: [p.notes, ...(p.areas || []).map(a => `${a.name}${a.notes ? ': ' + a.notes : ''}`)].filter(Boolean) });
    for (const p of m.places.filter(q => q.kind !== 'room' && q.kind !== 'district' && q.kind !== 'area' && (q.population || (q.demographics || []).length || q.notes || (q.areas || []).length))) {
      const body = [];
      if (p.population) body.push('Population ' + MM.fmtPop(p.population));
      if ((p.demographics || []).length) body.push(p.demographics.map(d => `${d.species} ${d.pct}%`).join(', '));
      if (p.notes) body.push(p.notes);
      for (const a of p.areas || []) body.push('• ' + a.name + (a.notes ? ': ' + a.notes : ''));
      items.push({ head: `${p.name} (${(MM.PLACE_KINDS[p.kind] || {}).name || p.kind})`, body });
    }
    return items;
  }
  function wrap(text, n) { const out = []; let line = ''; for (const w of String(text).split(/\s+/)) { if ((line + ' ' + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; }
  function wrapKey(items, n) { const lines = []; for (const it of items) { wrap(it.head, n).forEach(l => lines.push({ t: l, b: true })); for (const b of it.body) wrap(b, n - 2).forEach(l => lines.push({ t: l, i: true })); lines.push({ t: '' }); } return lines; }
  function keySVG(lines, P, fs, x, y, w, h, m) {
    const maxLines = Math.floor((h - fs * 3) / (fs * 1.3));
    const shown = lines.length > maxLines ? [...lines.slice(0, Math.max(0, maxLines - 1)), { t: '… (more in the gazetteer)', i: true }] : lines;
    let g = `<g id="key" transform="translate(${f1(x)},${f1(y)})"><rect width="${f1(w)}" height="${f1(h)}" fill="${P.halo}" fill-opacity=".6" stroke="${P.ink}" stroke-width="${f1(fs * 0.1)}"/><text x="${f1(fs * 0.6)}" y="${f1(fs * 1.6)}" font-size="${f1(fs * 1.05)}" font-weight="700" letter-spacing="${f1(fs * 0.1)}" fill="${P.label}">${m.places.some(p => p.kind === 'room') ? 'KEY' : 'GAZETTEER'}</text>`;
    shown.forEach((l, i) => { if (l.t) g += `<text x="${f1(fs * (l.i ? 1.1 : 0.6))}" y="${f1(fs * 3 + i * fs * 1.3)}" font-size="${f1(fs * (l.b ? 0.8 : 0.7))}"${l.b ? ' font-weight="700"' : ''}${l.i ? ' font-style="italic"' : ''} fill="${P.label}">${esc(l.t)}</text>`; });
    return g + '</g>';
  }
})();
