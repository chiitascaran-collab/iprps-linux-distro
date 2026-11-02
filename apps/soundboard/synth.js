// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Soundboard - built-in sounds, made live with the Web Audio API (no sound files, no licenses).
// IPSynth.LOOPS / IPSynth.SHOTS: { id: [label, icon, make(ctx, out) -> { stop() } ] }
(() => {
  'use strict';
  const noiseBuffers = new WeakMap();
  // White, pink and brown noise, 4 s each, made once per audio context.
  function noise(ctx, kind) {
    let m = noiseBuffers.get(ctx); if (!m) noiseBuffers.set(ctx, m = {});
    if (m[kind]) return m[kind];
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return (m[kind] = b);
  }
  function src(ctx, kind, loop = true) { const s = ctx.createBufferSource(); s.buffer = noise(ctx, kind); s.loop = loop; return s; }
  function filt(ctx, type, f, q = 0.7) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
  function gain(ctx, v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function lfo(ctx, rate, depth, target) { const o = ctx.createOscillator(), g = gain(ctx, depth); o.frequency.value = rate; o.connect(g); g.connect(target); o.start(); return o; }
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  // A loop made of always-running nodes plus optional repeating events.
  function loopOf(ctx, nodes, timers = []) {
    return { stop() { timers.forEach(t => clearTimeout(t.id)); timers.length = 0; nodes.forEach(n => { try { n.stop(); } catch {} try { n.disconnect(); } catch {} }); } };
  }
  function every(timers, minMs, maxMs, fn) {
    const t = { id: 0 };
    const tick = () => { fn(); t.id = setTimeout(tick, minMs + Math.random() * (maxMs - minMs)); };
    t.id = setTimeout(tick, minMs * Math.random()); timers.push(t);
  }
  // One envelope-shaped tone (for bells, chirps, thumps)
  function tone(ctx, out, { type = 'sine', f = 440, f2 = null, t = 0, a = 0.005, d = 0.5, v = 0.3 }) {
    const o = ctx.createOscillator(), g = gain(ctx, 0), at = ctx.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + d);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + a + d + 0.05);
    return o;
  }
  function burst(ctx, out, { kind = 'white', type = 'bandpass', f = 1000, f2 = null, q = 1, t = 0, a = 0.002, d = 0.2, v = 0.5 }) {
    const s = src(ctx, kind, false), x = filt(ctx, type, f, q), g = gain(ctx, 0), at = ctx.currentTime + t;
    if (f2) x.frequency.exponentialRampToValueAtTime(f2, at + a + d);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
    chain(s, x, g, out); s.start(at, Math.random() * 3); s.stop(at + a + d + 0.05);
    return s;
  }

  // ---------------------------------------------------------------- ambience (loops)
  const LOOPS = {
    rain: ['Rain', '🌧', (ctx, out) => {
      const s = src(ctx, 'pink'), hp = filt(ctx, 'highpass', 500), lp = filt(ctx, 'lowpass', 7000), g = gain(ctx, 0.55);
      chain(s, hp, lp, g, out); s.start();
      const timers = []; every(timers, 15, 70, () => burst(ctx, out, { f: 2500 + Math.random() * 4000, q: 4, d: 0.03, v: 0.08 * Math.random() }));
      return loopOf(ctx, [s], timers);
    }],
    storm: ['Storm', '⛈', (ctx, out) => {
      const r = LOOPS.rain[2](ctx, out), timers = [];
      every(timers, 7000, 19000, () => SHOTS.thunder[2](ctx, out));
      return { stop() { r.stop(); timers.forEach(t => clearTimeout(t.id)); } };
    }],
    wind: ['Wind', '🌬', (ctx, out) => {
      const s = src(ctx, 'pink'), bp = filt(ctx, 'bandpass', 500, 1.2), g = gain(ctx, 0.5);
      chain(s, bp, g, out); s.start();
      const l1 = lfo(ctx, 0.07, 300, bp.frequency), l2 = lfo(ctx, 0.11, 0.35, g.gain);
      return loopOf(ctx, [s, l1, l2]);
    }],
    fire: ['Campfire', '🔥', (ctx, out) => {
      const s = src(ctx, 'brown'), lp = filt(ctx, 'lowpass', 400), g = gain(ctx, 0.7); chain(s, lp, g, out); s.start();
      const timers = []; every(timers, 40, 260, () => burst(ctx, out, { f: 1500 + Math.random() * 3500, q: 2, d: 0.015 + Math.random() * 0.03, v: 0.1 + Math.random() * 0.3 }));
      return loopOf(ctx, [s], timers);
    }],
    waves: ['Ocean waves', '🌊', (ctx, out) => {
      const s = src(ctx, 'pink'), lp = filt(ctx, 'lowpass', 900), g = gain(ctx, 0.35); chain(s, lp, g, out); s.start();
      const l1 = lfo(ctx, 0.12, 0.3, g.gain), l2 = lfo(ctx, 0.12, 500, lp.frequency);
      return loopOf(ctx, [s, l1, l2]);
    }],
    river: ['River', '🏞', (ctx, out) => {
      const s = src(ctx, 'white'), bp = filt(ctx, 'bandpass', 1200, 0.6), g = gain(ctx, 0.18); chain(s, bp, g, out); s.start();
      const s2 = src(ctx, 'brown'), g2 = gain(ctx, 0.5); chain(s2, g2, out); s2.start();
      const timers = []; every(timers, 60, 220, () => tone(ctx, out, { f: 500 + Math.random() * 900, f2: 1200 + Math.random() * 900, d: 0.06, v: 0.04 }));
      return loopOf(ctx, [s, s2], timers);
    }],
    cave: ['Cave drips', '🕳', (ctx, out) => {
      const s = src(ctx, 'brown'), lp = filt(ctx, 'lowpass', 120), g = gain(ctx, 0.6); chain(s, lp, g, out); s.start();
      const dl = ctx.createDelay(1), fb = gain(ctx, 0.35), wet = gain(ctx, 0.5); dl.delayTime.value = 0.31; chain(dl, fb, dl); chain(dl, wet, out);
      const timers = []; every(timers, 700, 3200, () => { const f = 900 + Math.random() * 1400; tone(ctx, out, { f, f2: f * 1.6, d: 0.12, v: 0.12 }); tone(ctx, dl, { f, f2: f * 1.6, d: 0.12, v: 0.12 }); });
      return loopOf(ctx, [s, dl], timers);
    }],
    night: ['Night crickets', '🦗', (ctx, out) => {
      const s = src(ctx, 'pink'), lp = filt(ctx, 'lowpass', 300), g = gain(ctx, 0.25); chain(s, lp, g, out); s.start();
      const timers = [];
      const cricket = f => every(timers, 900, 2200, () => { for (let i = 0; i < 3; i++) tone(ctx, out, { f, t: i * 0.045, d: 0.03, v: 0.1 }); });
      cricket(4200); cricket(4700); cricket(3900);
      return loopOf(ctx, [s], timers);
    }],
    dungeon: ['Dungeon drone', '🏚', (ctx, out) => {
      const nodes = [];
      for (const [f, v] of [[55, 0.18], [82.4, 0.1], [110.6, 0.05]]) { const o = ctx.createOscillator(), g = gain(ctx, v), lp = filt(ctx, 'lowpass', 300); o.type = 'sawtooth'; o.frequency.value = f; chain(o, lp, g, out); o.start(); nodes.push(o); nodes.push(lfo(ctx, 0.05 + Math.random() * 0.05, 0.6, o.detune)); }
      const s = src(ctx, 'brown'), g = gain(ctx, 0.25); chain(s, g, out); s.start(); nodes.push(s);
      return loopOf(ctx, nodes);
    }],
    tavern: ['Tavern hum', '🍺', (ctx, out) => {
      const s = src(ctx, 'pink'), bp = filt(ctx, 'bandpass', 450, 0.8), g = gain(ctx, 0.35); chain(s, bp, g, out); s.start();
      const l = lfo(ctx, 0.3, 0.12, g.gain);
      const timers = [];
      every(timers, 2500, 7000, () => { for (let i = 0; i < 2; i++) tone(ctx, out, { type: 'triangle', f: 2600 + Math.random() * 900, t: i * 0.08, d: 0.25, v: 0.03 }); });   // mugs
      every(timers, 300, 900, () => burst(ctx, out, { kind: 'pink', f: 200 + Math.random() * 500, q: 3, d: 0.25, v: 0.12 }));                                                   // voices
      return loopOf(ctx, [s, l], timers);
    }],
  };

  // ---------------------------------------------------------------- effects (one-shots)
  const SHOTS = {
    thunder: ['Thunder', '⚡', (ctx, out) => {
      burst(ctx, out, { kind: 'white', type: 'lowpass', f: 3000, f2: 200, d: 0.4, v: 0.7 });
      burst(ctx, out, { kind: 'brown', type: 'lowpass', f: 300, f2: 60, t: 0.08, a: 0.2, d: 3.5, v: 1.0 });
      burst(ctx, out, { kind: 'brown', type: 'lowpass', f: 200, t: 0.9, a: 0.4, d: 2.5, v: 0.6 });
    }],
    sword: ['Sword clash', '⚔', (ctx, out) => {
      burst(ctx, out, { f: 3000, q: 1, d: 0.06, v: 0.8 });
      for (const [f, v] of [[2214, 0.12], [3189, 0.1], [4471, 0.08], [5893, 0.05], [1580, 0.08]]) tone(ctx, out, { type: 'sine', f, d: 0.9 + Math.random() * 0.6, v });
    }],
    impact: ['Heavy hit', '💥', (ctx, out) => {
      tone(ctx, out, { f: 150, f2: 40, d: 0.35, v: 0.6 });
      burst(ctx, out, { kind: 'white', type: 'lowpass', f: 2500, f2: 300, d: 0.15, v: 0.6 });
    }],
    arrow: ['Arrow', '🏹', (ctx, out) => {
      burst(ctx, out, { type: 'bandpass', f: 800, f2: 4000, q: 1.5, a: 0.05, d: 0.25, v: 0.9 });
      burst(ctx, out, { kind: 'brown', type: 'lowpass', f: 500, t: 0.32, d: 0.08, v: 0.8 });
    }],
    whoosh: ['Spell whoosh', '✨', (ctx, out) => {
      burst(ctx, out, { kind: 'pink', type: 'bandpass', f: 300, f2: 5000, q: 1.2, a: 0.25, d: 0.6, v: 1.4 });
      [0, 0.12, 0.24, 0.36].forEach((t, i) => tone(ctx, out, { f: 1046 * Math.pow(1.26, i), t: 0.35 + t, d: 0.8, v: 0.06 }));
    }],
    chime: ['Magic chime', '🔔', (ctx, out) => {
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => { tone(ctx, out, { f, t: i * 0.09, d: 2.2, v: 0.1 }); tone(ctx, out, { f: f * 2.01, t: i * 0.09, d: 1.2, v: 0.03 }); });
    }],
    gong: ['Gong', '🥁', (ctx, out) => {
      for (const [f, v, d] of [[98, 0.35, 5], [147.3, 0.18, 4], [211, 0.14, 3.5], [287, 0.08, 3], [392.5, 0.05, 2.5]]) tone(ctx, out, { f, a: 0.02, d, v });
      burst(ctx, out, { kind: 'brown', type: 'lowpass', f: 400, d: 0.3, v: 0.4 });
    }],
    bell: ['Church bell', '🛎', (ctx, out) => {
      [0, 1.6, 3.2].forEach(t => { for (const [m, v] of [[1, 0.25], [2.4, 0.1], [3.0, 0.08], [4.5, 0.04]]) tone(ctx, out, { f: 220 * m, t, a: 0.005, d: 2.6, v }); });
    }],
    heartbeat: ['Heartbeat', '💓', (ctx, out) => {
      for (let i = 0; i < 4; i++) { tone(ctx, out, { f: 70, f2: 40, t: i * 0.85, d: 0.18, v: 0.9 }); tone(ctx, out, { f: 60, f2: 35, t: i * 0.85 + 0.22, d: 0.2, v: 0.6 }); }
    }],
    knock: ['Door knock', '🚪', (ctx, out) => {
      [0, 0.22, 0.44].forEach(t => { burst(ctx, out, { kind: 'brown', type: 'bandpass', f: 220, q: 2, t, d: 0.09, v: 1 }); tone(ctx, out, { f: 180, f2: 90, t, d: 0.08, v: 0.4 }); });
    }],
    creak: ['Door creak', '🗝', (ctx, out) => {
      const o = ctx.createOscillator(), g = gain(ctx, 0), bp = filt(ctx, 'bandpass', 900, 6), at = ctx.currentTime;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(70, at); o.frequency.linearRampToValueAtTime(140, at + 0.8); o.frequency.linearRampToValueAtTime(95, at + 1.6);
      const l = lfo(ctx, 23, 25, o.frequency);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.9, at + 0.15); g.gain.linearRampToValueAtTime(0.7, at + 1.3); g.gain.linearRampToValueAtTime(0, at + 1.7);
      chain(o, bp, g, out); o.start(at); o.stop(at + 1.8); l.stop(at + 1.8);
    }],
    coins: ['Coins', '🪙', (ctx, out) => {
      for (let i = 0; i < 9; i++) { const t = i * 0.06 + Math.random() * 0.04, f = 2800 + Math.random() * 2600; tone(ctx, out, { type: 'triangle', f, t, d: 0.25, v: 0.16 }); tone(ctx, out, { f: f * 1.5, t, d: 0.15, v: 0.06 }); }
    }],
    dice: ['Dice rattle', '🎲', (ctx, out) => {
      for (let i = 0; i < 14; i++) burst(ctx, out, { type: 'bandpass', f: 1800 + Math.random() * 2500, q: 3, t: i * 0.045 + Math.random() * 0.03, d: 0.03, v: 1.2 * (1 - i / 16) });
    }],
    horn: ['War horn', '📯', (ctx, out) => {
      for (const [t, f, d] of [[0, 110, 0.9], [1.0, 146.8, 1.8]]) {
        const o = ctx.createOscillator(), lp = filt(ctx, 'lowpass', 900), g = gain(ctx, 0), at = ctx.currentTime + t;
        o.type = 'sawtooth'; o.frequency.value = f;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.25, at + 0.15); g.gain.setValueAtTime(0.25, at + d - 0.2); g.gain.linearRampToValueAtTime(0, at + d);
        chain(o, lp, g, out); o.start(at); o.stop(at + d + 0.05);
      }
    }],
    fanfare: ['Level up', '🏆', (ctx, out) => {
      [[523.3, 0], [659.3, 0.12], [784, 0.24], [1046.5, 0.36], [784, 0.56], [1046.5, 0.68]].forEach(([f, t]) => { tone(ctx, out, { type: 'square', f, t, d: 0.22, v: 0.1 }); tone(ctx, out, { type: 'triangle', f: f / 2, t, d: 0.3, v: 0.15 }); });
    }],
    growl: ['Monster growl', '👹', (ctx, out) => {
      const o = ctx.createOscillator(), g = gain(ctx, 0), lp = filt(ctx, 'lowpass', 500, 4), at = ctx.currentTime;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(75, at); o.frequency.linearRampToValueAtTime(55, at + 1.6);
      const l = lfo(ctx, 27, 18, o.frequency);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.5, at + 0.3); g.gain.linearRampToValueAtTime(0, at + 1.8);
      chain(o, lp, g, out); o.start(at); o.stop(at + 1.9); l.stop(at + 1.9);
      burst(ctx, out, { kind: 'brown', type: 'lowpass', f: 300, a: 0.3, d: 1.3, v: 0.5 });
    }],
  };
  window.IPSynth = { LOOPS, SHOTS };
})();
