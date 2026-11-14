// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Multitrack audio/video editor: timeline, cut/trim/move, fades, per-track EQ and dynamics, video layouts.
import { h, api, upload, toast, fail, fmtTime, fmtSize, modal, confirmBox, promptBox, debounce } from './util.js';
import { makeEq, chain, drawMeter, Strip } from './audio.js';
import { eqPanel } from './fxui.js';

const uid = p => p + Math.random().toString(36).slice(2, 12);
const even = v => Math.max(2, Math.floor(v) & ~1);

// Mirrors server/media.py layout_rects() so the preview matches the export.
export function layoutRects(layout, n, W, H) {
  const g = even(H / 90);
  if (n <= 0) return [];
  if (layout === 'single' || n === 1) return [[0, 0, W, H]];
  if (layout === 'spotlight') {
    const sw = even(W * 0.24), mw = even(W - sw - 3 * g), out = [[g, g, mw, even(H - 2 * g)]], m = n - 1;
    const th = even(Math.min((H - g * (m + 1)) / m, sw * 9 / 16 * 1.4)), y0 = even((H - (th * m + g * (m - 1))) / 2);
    for (let i = 0; i < m; i++) out.push([mw + 2 * g, y0 + i * (th + g), sw, th]);
    return out;
  }
  if (layout === 'pip') {
    const out = [[0, 0, W, H]], pw = even(W / 5), ph = even(H / 5);
    for (let i = 0; i < n - 1; i++) out.push([W - (i + 1) * (pw + g), H - ph - g, pw, ph]);
    return out;
  }
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), tw = even((W - g * (cols + 1)) / cols), th = even((H - g * (rows + 1)) / rows), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, inRow = r < rows - 1 ? cols : n - cols * (rows - 1), x0 = (W - (inRow * tw + (inRow - 1) * g)) / 2;
    out.push([even(x0 + c * (tw + g)), g + r * (th + g), tw, th]);
  }
  return out;
}

export function editorView(show, ep) {
  const sid = show.id, eid = ep.id, base = `/api/shows/${sid}/episodes/${eid}`, files = `/files/${sid}/episodes/${eid}/media/`;
  const tl = ep.timeline; tl.master = tl.master || { eq: Array(10).fill(0), vol: 1, loudness: -16 }; tl.video = tl.video || { layout: 'grid' };
  const E = { pps: 40, t: 0, sel: null, selTrack: tl.tracks[0] ? tl.tracks[0].id : null, playing: false, peaks: new Map(), els: new Map(), nodes: new Map(), undo: [], redo: [], alive: true, mark: {} };
  const media = id => ep.media.find(m => m.id === id);
  const clipEnd = c => c.start + c.out - c.in;
  const total = () => Math.max(0, ...tl.tracks.flatMap(t => t.clips.map(clipEnd)));
  const findClip = id => { for (const t of tl.tracks) { const c = t.clips.find(c => c.id === id); if (c) return [c, t]; } return [null, null]; };

  // ---------------------------------------------------------------- persistence + history
  const saveNow = () => api('PUT', base, { timeline: tl, chapters: ep.chapters }).then(() => { saved.textContent = 'Saved'; }).catch(fail);
  const save = debounce(saveNow, 600);
  const snap = () => JSON.stringify({ tracks: tl.tracks, chapters: ep.chapters });
  function commit(before) { if (before && before !== snap()) { E.undo.push(before); if (E.undo.length > 80) E.undo.shift(); E.redo = []; } saved.textContent = 'Saving…'; save(); }
  function restore(s) { const o = JSON.parse(s); tl.tracks = o.tracks; ep.chapters = o.chapters; E.sel = null; renderAll(); saved.textContent = 'Saving…'; save(); }
  const undo = () => { if (E.undo.length) { E.redo.push(snap()); restore(E.undo.pop()); } };
  const redo = () => { if (E.redo.length) { E.undo.push(snap()); restore(E.redo.pop()); } };
  const edit = fn => { const b = snap(); fn(); commit(b); renderAll(); };

  // ---------------------------------------------------------------- DOM
  const saved = h('span', { class: 'muted small' }, 'Saved');
  const preview = h('canvas', { width: 640, height: 360, class: 'ed-preview' });
  const timeEl = h('span', { class: 'timer' }, '0:00.0');
  const playBtn = h('button', { class: 'btn primary', id: 'ed-play', onclick: () => toggle() }, '▶ Play');
  const meterCv = h('canvas', { width: 10, height: 90, class: 'meter' });
  const zoom = h('input', { type: 'range', min: 4, max: 200, value: E.pps, 'aria-label': 'Zoom', oninput: () => { E.pps = Number(zoom.value); renderTimeline(); } });
  const layoutSel = h('select', { 'aria-label': 'Video layout', onchange: () => { tl.video.layout = layoutSel.value; commit(); } }, [['grid', 'Grid'], ['spotlight', 'Spotlight + sidebar'], ['pip', 'Picture in picture'], ['single', 'Single (first video track)']].map(([v, l]) => h('option', { value: v, selected: tl.video.layout === v }, l)));
  const bin = h('div', { class: 'bin' });
  const inspector = h('div', { class: 'inspector' });
  const heads = h('div', { class: 'tl-heads' });
  const inner = h('div', { class: 'tl-inner' });
  const scroll = h('div', { class: 'tl-scroll', onscroll: () => drawWaves() }, inner);
  const playhead = h('div', { class: 'playhead' });
  const fileIn = h('input', { type: 'file', multiple: true, accept: 'audio/*,video/*', hidden: true, onchange: () => importFiles([...fileIn.files]) });
  const tb = (label, title, fn, id) => h('button', { class: 'btn small', title, id, onclick: fn }, label);
  const tools = h('div', { class: 'ed-tools' },
    tb('✂ Split', 'Split at the playhead (S)', split, 'ed-split'), tb('Delete', 'Delete the selected clip (Del)', () => del(false)), tb('Ripple delete', 'Delete and close the gap on that track (Shift+Del)', () => del(true)),
    tb('Duplicate', 'Duplicate the selected clip', dup), h('span', { class: 'sep' }),
    tb('Mark in', 'Start of a section to cut (I)', () => setMark('a')), tb('Mark out', 'End of the section (O)', () => setMark('b')), tb('Cut section', 'Remove the marked section from every track and close the gap (X)', cutSection, 'ed-cut'), h('span', { class: 'sep' }),
    tb('↶ Undo', 'Ctrl+Z', undo), tb('↷ Redo', 'Ctrl+Shift+Z', redo), h('span', { class: 'sep' }),
    tb('+ Track', 'Add an empty track', () => edit(() => tl.tracks.push(newTrack('Track ' + (tl.tracks.length + 1))))), tb('⚑ Chapter', 'Add a chapter at the playhead (M)', addChapter), tb('Chapters…', 'Edit chapter list', chaptersDialog),
    tb('Intro / outro', 'Add the show\'s branded intro and outro', introOutro), tb('Master', 'Master equalizer, level and loudness target', masterDialog),
    h('span', { class: 'grow' }), h('label', { class: 'zoom' }, 'Zoom', zoom), tb('Fit', 'Fit the whole episode', fit), saved);
  const root = h('div', { class: 'editor' },
    h('div', { class: 'ed-top' },
      h('div', { class: 'ed-monitor' }, preview, h('div', { class: 'row' }, tb('⏮', 'Go to start (Home)', () => seek(0)), playBtn, timeEl, h('span', { class: 'grow' }), h('label', { class: 'zoom' }, 'Layout', layoutSel), meterCv)),
      h('div', { class: 'ed-side' }, h('div', { class: 'row' }, h('h4', {}, 'Media'), h('span', { class: 'grow' }), h('button', { class: 'btn small', onclick: () => fileIn.click() }, 'Import audio / video'), fileIn), bin, inspector)),
    tools, h('div', { class: 'tl' }, heads, scroll));

  function newTrack(name) { return { id: uid('t_'), name, vol: 1, pan: 0, mute: false, solo: false, hideVideo: false, clips: [], fx: { eq: Array(10).fill(0), hp: false, comp: false, gate: false, denoise: false } }; }

  // ---------------------------------------------------------------- media bin + inspector
  function renderBin() {
    bin.replaceChildren(ep.media.length ? null : h('p', { class: 'muted' }, 'Nothing recorded or imported yet. Record in the Studio tab, or import files here.'),
      ep.media.map(m => h('div', { class: 'bin-item' + (m.missing ? ' missing' : '') },
        h('span', { class: 'kind' }, m.hasVideo ? '🎬' : '🎙'), h('div', { class: 'grow' }, h('b', { title: m.name }, m.name), h('small', {}, `${fmtTime(m.duration)} · ${fmtSize(m.size)}${m.missing ? ' · file not in backup' : ''}`)),
        h('button', { class: 'btn tiny', title: 'Add to the timeline at the playhead', onclick: () => addToTimeline(m) }, '+'),
        h('button', { class: 'btn tiny', title: 'Remove this media and its clips', onclick: async () => { if (await confirmBox('Remove media?', `“${m.name}” and every clip made from it will be removed from this episode.`, 'Remove')) { try { const fresh = await api('DELETE', `${base}/media/${m.id}`); ep.media = fresh.media; tl.tracks = fresh.timeline.tracks; renderAll(); } catch (e) { fail(e); } } } }, '×'))));
  }
  function addToTimeline(m) {
    edit(() => {
      let t = tl.tracks.find(x => x.id === E.selTrack);
      if (!t || t.clips.some(c => c.start < E.t + m.duration && clipEnd(c) > E.t)) { t = newTrack(m.participant || m.name.replace(/\.[^.]+$/, '')); tl.tracks.push(t); }
      const c = { id: uid('k_'), mediaId: m.id, in: 0, out: m.duration, start: E.t, gain: 1, fadeIn: 0, fadeOut: 0, mute: false };
      t.clips.push(c); E.sel = c.id; E.selTrack = t.id;
    });
  }
  async function importFiles(list) {
    for (const f of list) {
      const note = h('div', { class: 'bin-item' }, `Importing ${f.name}…`); bin.prepend(note);
      try { ep.media.push(await upload(`${base}/media?name=${encodeURIComponent(f.name)}`, f, p => { note.textContent = `Importing ${f.name}… ${Math.round(p * 100)}%`; })); } catch (e) { fail(e); }
    }
    fileIn.value = ''; renderBin();
  }
  function renderInspector() {
    const [c, t] = findClip(E.sel);
    if (!c) return inspector.replaceChildren(h('p', { class: 'muted small' }, 'Select a clip to adjust its level and fades. Drag a clip to move it (also between tracks); drag its edges to trim.'));
    const m = media(c.mediaId) || {};
    const num = (label, key, min, max, step, toUi = v => v, fromUi = v => v) => { const i = h('input', { type: 'number', min, max, step, value: Number(toUi(c[key] ?? 0)).toFixed(step < 1 ? 1 : 0), onchange: () => edit(() => { c[key] = fromUi(Math.min(max, Math.max(min, Number(i.value) || 0))); }) }); return h('label', { class: 'field mini' }, h('span', {}, label), i); };
    const mute = h('input', { type: 'checkbox', checked: !!c.mute, onchange: () => edit(() => { c.mute = mute.checked; }) });
    inspector.replaceChildren(h('h4', {}, 'Clip'), h('p', { class: 'small' }, h('b', {}, m.name || 'Missing media'), h('br'), `${t.name} · ${fmtTime(c.start, true)} → ${fmtTime(clipEnd(c), true)}`),
      h('div', { class: 'row wrap' }, num('Level (dB)', 'gain', -40, 12, 0.5, v => 20 * Math.log10(Math.max(v, 0.01)), v => Math.pow(10, v / 20)), num('Fade in (s)', 'fadeIn', 0, 30, 0.1), num('Fade out (s)', 'fadeOut', 0, 30, 0.1), h('label', { class: 'field check' }, mute, h('span', {}, 'Mute clip'))));
  }

  // ---------------------------------------------------------------- timeline rendering
  const LANE = 68;
  function renderAll() { renderBin(); renderTimeline(); renderInspector(); }
  function renderTimeline() {
    const width = Math.max(scroll.clientWidth || 800, (total() + 30) * E.pps);
    inner.style.width = width + 'px';
    const ruler = h('div', { class: 'ruler', onpointerdown: e => scrub(e) }, h('canvas', { class: 'sticky-cv' }));
    inner.replaceChildren(ruler);
    heads.replaceChildren(h('div', { class: 'ruler-head' }, 'Tracks'));
    tl.tracks.forEach((t, ti) => {
      const vol = h('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: t.vol, title: 'Track level', 'aria-label': t.name + ' level', oninput: () => { t.vol = Number(vol.value); applyTrack(t); }, onchange: () => commit() });
      const flag = (key, label, title) => h('button', { class: 'btn tiny' + (t[key] ? ' on' : ''), title, onclick: () => edit(() => { t[key] = !t[key]; }) }, label);
      const hasVideo = t.clips.some(c => (media(c.mediaId) || {}).hasVideo);
      heads.append(h('div', { class: 'tl-head' + (E.selTrack === t.id ? ' sel' : ''), onclick: () => { E.selTrack = t.id; heads.querySelectorAll('.tl-head').forEach((x, i) => x.classList.toggle('sel', i === ti)); } },
        h('div', { class: 'row tight' }, h('b', { title: 'Double-click to rename', ondblclick: async () => { const n = await promptBox('Rename track', t.name); if (n) edit(() => { t.name = n; }); } }, t.name), h('span', { class: 'grow' }),
          h('button', { class: 'btn tiny ghost', title: 'Move up', onclick: () => ti > 0 && edit(() => { tl.tracks.splice(ti - 1, 0, tl.tracks.splice(ti, 1)[0]); }) }, '↑'),
          h('button', { class: 'btn tiny ghost', title: 'Delete track', onclick: async () => { if (!t.clips.length || await confirmBox('Delete track?', `“${t.name}” and its ${t.clips.length} clip(s) will be removed from the timeline. The media stays in the bin.`, 'Delete')) edit(() => { tl.tracks.splice(ti, 1); }); } }, '×')),
        h('div', { class: 'row tight' }, flag('mute', 'M', 'Mute'), flag('solo', 'S', 'Solo'),
          h('button', { class: 'btn tiny' + (fxActive(t) ? ' on' : ''), title: 'Equalizer, compressor, gate, noise reduction', onclick: () => trackFx(t) }, 'FX'),
          hasVideo ? h('button', { class: 'btn tiny' + (t.hideVideo ? '' : ' on'), title: 'Show this track\'s video in the picture', onclick: () => edit(() => { t.hideVideo = !t.hideVideo; }) }, '🎬') : null, vol)));
      const lane = h('div', { class: 'lane', data: { tid: t.id }, onpointerdown: e => { if (e.target === lane || e.target.classList.contains('sticky-cv')) { E.sel = null; E.selTrack = t.id; scrub(e); renderInspector(); markSel(); } } }, h('canvas', { class: 'sticky-cv' }));
      for (const c of t.clips) lane.append(clipEl(c, t));
      inner.append(lane);
    });
    if (!tl.tracks.length) inner.append(h('div', { class: 'tl-empty' }, 'No tracks yet. Record in the Studio tab — every participant arrives here on their own track — or import media above.'));
    inner.append(playhead);
    playhead.style.height = (26 + tl.tracks.length * LANE) + 'px';
    placeHead(); drawWaves(); loadPeaks(); syncAudio();
  }
  const fxActive = t => { const f = t.fx || {}; return f.hp || f.comp || f.gate || f.denoise || (f.eq || []).some(v => v); };
  function clipEl(c, t) {
    const m = media(c.mediaId);
    const el = h('div', { class: 'clip' + (c.id === E.sel ? ' sel' : '') + (c.mute ? ' muted' : '') + (!m || m.missing ? ' missing' : '') + (m && m.hasVideo ? ' video' : ''), data: { cid: c.id },
      style: { left: c.start * E.pps + 'px', width: Math.max(4, (c.out - c.in) * E.pps) + 'px' } }, h('span', { class: 'clip-name' }, m ? m.name : 'missing'), h('i', { class: 'hl' }), h('i', { class: 'hr' }));
    el.onpointerdown = e => dragClip(e, c, el);
    return el;
  }
  const markSel = () => inner.querySelectorAll('.clip').forEach(x => x.classList.toggle('sel', x.dataset.cid === E.sel));

  function dragClip(e, c0, el) {
    e.stopPropagation(); e.preventDefault();
    let [c, t] = findClip(c0.id);
    E.sel = c.id; E.selTrack = t.id; markSel(); renderInspector();
    const r = el.getBoundingClientRect(), x = e.clientX - r.left;
    const mode = x < 8 ? 'l' : (x > r.width - 8 ? 'r' : 'move');
    const o = { ...c }, sx = e.clientX, before = snap(), m = media(c.mediaId) || { duration: c.out };
    const snaps = [0, E.t, ...tl.tracks.flatMap(tr => tr.clips.filter(k => k.id !== c.id).flatMap(k => [k.start, clipEnd(k)]))];
    const snapTo = v => { const th = 8 / E.pps; let best = v, bd = th; for (const s of snaps) { const d = Math.abs(s - v); if (d < bd) { bd = d; best = s; } } return best; };
    let moved = false;
    const move = ev => {
      const dx = (ev.clientX - sx) / E.pps;
      if (Math.abs(ev.clientX - sx) > 2) moved = true;
      if (!moved) return;
      if (mode === 'move') {
        let ns = snapTo(Math.max(0, o.start + dx));
        const endSnap = snapTo(ns + (o.out - o.in)); if (endSnap !== ns + (o.out - o.in) && ns === Math.max(0, o.start + dx)) ns = Math.max(0, endSnap - (o.out - o.in));
        c.start = ns;
        const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.lane');
        if (lane && lane.dataset.tid !== t.id) { const nt = tl.tracks.find(k => k.id === lane.dataset.tid); if (nt) { t.clips = t.clips.filter(k => k.id !== c.id); nt.clips.push(c); t = nt; E.selTrack = nt.id; lane.append(el); } }
      } else if (mode === 'l') {
        const ns = snapTo(o.start + Math.min(Math.max(dx, -o.in, -o.start), o.out - o.in - 0.05)), d = ns - o.start;
        c.in = o.in + d; c.start = ns;
      } else {
        const ne = snapTo(o.start + Math.min(Math.max(o.out - o.in + dx, 0.05), m.duration - o.in));
        c.out = Math.min(m.duration, Math.max(c.in + 0.05, c.in + ne - c.start));
      }
      el.style.left = c.start * E.pps + 'px'; el.style.width = Math.max(4, (c.out - c.in) * E.pps) + 'px'; drawWaves();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved) { commit(before); renderTimeline(); renderInspector(); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function scrub(e) {
    const x0 = inner.getBoundingClientRect().left;
    const at = ev => seek(Math.max(0, (ev.clientX - x0) / E.pps));
    at(e);
    const up = () => { window.removeEventListener('pointermove', at); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', at); window.addEventListener('pointerup', up);
  }
  function placeHead() { playhead.style.left = E.t * E.pps + 'px'; timeEl.textContent = fmtTime(E.t, true); }

  // ---------------------------------------------------------------- waveforms + ruler
  async function loadPeaks() {
    for (const m of ep.media) if (m.hasAudio && !m.missing && !E.peaks.has(m.id)) {
      E.peaks.set(m.id, null);
      try { E.peaks.set(m.id, await (await fetch(files + m.id + '.peaks.json')).json()); drawWaves(); } catch (e) { /* no waveform */ }
    }
  }
  function drawWaves() {
    const vw = scroll.clientWidth, x0 = scroll.scrollLeft, dpr = window.devicePixelRatio || 1;
    const prep = (cv, hh) => { cv.width = vw * dpr; cv.height = hh * dpr; cv.style.width = vw + 'px'; cv.style.height = hh + 'px'; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, vw, hh); return g; };
    const rc = inner.querySelector('.ruler canvas'); if (!rc) return;
    let g = prep(rc, 26);
    const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(s => s * E.pps >= 70) || 600;
    g.fillStyle = '#8b93a7'; g.strokeStyle = '#3a4254'; g.font = '11px system-ui, sans-serif';
    for (let s = Math.floor(x0 / E.pps / step) * step; s * E.pps < x0 + vw; s += step) { const x = s * E.pps - x0; g.beginPath(); g.moveTo(x + .5, 14); g.lineTo(x + .5, 26); g.stroke(); g.fillText(fmtTime(s, step < 1), x + 4, 12); }
    for (const c of ep.chapters || []) { const x = c.t * E.pps - x0; if (x > -80 && x < vw) { g.fillStyle = '#ffb347'; g.fillRect(x, 0, 2, 26); g.fillText('⚑ ' + (c.title || ''), x + 5, 23); } }
    if (E.mark.a != null || E.mark.b != null) { const a = (E.mark.a ?? E.mark.b) * E.pps - x0, b = (E.mark.b ?? E.mark.a) * E.pps - x0; g.fillStyle = 'rgba(255,77,94,.35)'; g.fillRect(Math.min(a, b), 0, Math.max(2, Math.abs(b - a)), 26); }
    inner.querySelectorAll('.lane').forEach(lane => {
      const t = tl.tracks.find(k => k.id === lane.dataset.tid); if (!t) return;
      g = prep(lane.querySelector('canvas'), LANE);
      const mid = LANE / 2 + 6;
      for (const c of t.clips) {
        const left = c.start * E.pps - x0, w = (c.out - c.in) * E.pps;
        if (left > vw || left + w < 0) continue;
        const pk = E.peaks.get(c.mediaId); if (!pk || !pk.peaks.length) continue;
        g.fillStyle = c.mute || t.mute ? 'rgba(160,170,190,.45)' : 'rgba(255,255,255,.82)';
        const from = Math.max(0, Math.floor(-left)), to = Math.min(w, vw - left);
        for (let px = from; px < to; px++) {
          const s0 = c.in + px / E.pps, i0 = Math.floor(s0 * pk.pps), i1 = Math.max(i0 + 1, Math.floor((s0 + 1 / E.pps) * pk.pps));
          let v = 0; for (let i = i0; i < i1 && i < pk.peaks.length; i++) if (pk.peaks[i] > v) v = pk.peaks[i];
          const hh = Math.max(1, v / 100 * (LANE - 26) * Math.min(1.5, c.gain || 1));
          g.fillRect(left + px, mid - hh / 2, 1, hh);
        }
        if (c.fadeIn > 0) { g.strokeStyle = '#ffb347'; g.beginPath(); g.moveTo(left, LANE - 2); g.lineTo(left + c.fadeIn * E.pps, 16); g.stroke(); }
        if (c.fadeOut > 0) { g.strokeStyle = '#ffb347'; g.beginPath(); g.moveTo(left + w - c.fadeOut * E.pps, 16); g.lineTo(left + w, LANE - 2); g.stroke(); }
      }
    });
  }
  function fit() { const d = total() || 60; E.pps = Math.max(4, Math.min(200, (scroll.clientWidth - 40) / d)); zoom.value = E.pps; renderTimeline(); }

  // ---------------------------------------------------------------- edit operations
  function split() {
    const targets = E.sel ? [findClip(E.sel)] : tl.tracks.flatMap(t => t.clips.map(c => [c, t]));
    const hit = targets.filter(([c]) => c && E.t > c.start + 0.03 && E.t < clipEnd(c) - 0.03);
    if (!hit.length) return toast('Put the playhead inside a clip to split it.');
    edit(() => { for (const [c, t] of hit) { const cut = c.in + (E.t - c.start); t.clips.push({ ...c, id: uid('k_'), in: cut, start: E.t, fadeIn: 0 }); c.out = cut; c.fadeOut = 0; } });
  }
  function del(ripple) {
    const [c, t] = findClip(E.sel); if (!c) return toast('Select a clip first.');
    edit(() => { const d = c.out - c.in; t.clips = t.clips.filter(k => k !== c); if (ripple) for (const k of t.clips) if (k.start >= c.start) k.start = Math.max(0, k.start - d); E.sel = null; });
  }
  function dup() { const [c, t] = findClip(E.sel); if (!c) return toast('Select a clip first.'); edit(() => { const n = { ...c, id: uid('k_'), start: clipEnd(c) }; t.clips.push(n); E.sel = n.id; }); }
  function setMark(k) { E.mark[k] = E.t; if (E.mark.a != null && E.mark.b != null && E.mark.a > E.mark.b) [E.mark.a, E.mark.b] = [E.mark.b, E.mark.a]; drawWaves(); }
  function cutSection() {
    const { a, b } = E.mark; if (a == null || b == null || b - a < 0.02) return toast('Set “Mark in” and “Mark out” around the part to remove.');
    edit(() => {
      const d = b - a;
      for (const t of tl.tracks) {
        const out = [];
        for (const c of t.clips) {
          const s = c.start, e = clipEnd(c);
          if (e <= a) out.push(c);
          else if (s >= b) { c.start -= d; out.push(c); }
          else {
            if (s < a) out.push({ ...c, id: uid('k_'), out: c.in + (a - s), fadeOut: 0 });
            if (e > b) out.push({ ...c, id: uid('k_'), in: c.in + (b - s), start: a, fadeIn: 0 });
          }
        }
        t.clips = out;
      }
      ep.chapters = (ep.chapters || []).filter(c => c.t < a || c.t >= b).map(c => c.t >= b ? { ...c, t: c.t - d } : c);
      E.mark = {}; E.sel = null;
    });
    seek(a);
  }
  function addChapter() { promptBox('Chapter title', 'Chapter ' + ((ep.chapters || []).length + 1)).then(title => { if (title) edit(() => { ep.chapters = [...(ep.chapters || []), { t: Math.round(E.t * 10) / 10, title }].sort((x, y) => x.t - y.t); }); }); }
  function chaptersDialog() {
    const list = h('div', { class: 'form' });
    const draw = () => list.replaceChildren((ep.chapters || []).length ? null : h('p', { class: 'muted' }, 'No chapters yet. Add them at the playhead with ⚑, or press M while recording.'),
      (ep.chapters || []).map((c, i) => h('div', { class: 'row' }, h('button', { class: 'btn tiny', title: 'Jump here', onclick: () => seek(c.t) }, fmtTime(c.t)),
        h('input', { class: 'grow', value: c.title || '', onchange: e => edit(() => { c.title = e.target.value; }) }), h('button', { class: 'btn tiny', onclick: () => { edit(() => { ep.chapters.splice(i, 1); }); draw(); } }, '×'))));
    draw(); modal('Chapters', list, [{ label: 'Done', cls: 'primary' }]);
  }
  async function introOutro() {
    const want = [['introAsset', 'Intro'], ['outroAsset', 'Outro']].filter(([k]) => show[k]);
    if (!want.length) return toast('Upload an intro or outro under the show\'s Brand tab first.');
    try {
      const got = {};
      for (const [k] of want) { got[k] = await api('POST', base + '/media-from-asset', { assetId: show[k] }); ep.media.push(got[k]); }
      edit(() => {
        let t = tl.tracks.find(x => x.name === 'Intro / outro'); if (!t) { t = newTrack('Intro / outro'); tl.tracks.unshift(t); }
        if (got.introAsset) {
          const d = got.introAsset.duration;
          for (const tr of tl.tracks) for (const c of tr.clips) c.start += d;
          ep.chapters = (ep.chapters || []).map(c => ({ ...c, t: c.t + d }));
          t.clips.push({ id: uid('k_'), mediaId: got.introAsset.id, in: 0, out: d, start: 0, gain: 1, fadeIn: 0, fadeOut: Math.min(1, d / 4), mute: false });
        }
        if (got.outroAsset) t.clips.push({ id: uid('k_'), mediaId: got.outroAsset.id, in: 0, out: got.outroAsset.duration, start: total(), gain: 1, fadeIn: Math.min(1, got.outroAsset.duration / 4), fadeOut: 0, mute: false });
      });
      toast('Intro and outro added on their own track.');
    } catch (e) { fail(e); }
  }
  function trackFx(t) {
    t.fx = t.fx || { eq: Array(10).fill(0) }; t.fx.eq = t.fx.eq || Array(10).fill(0);
    const before = snap();
    const tog = (key, label, hint) => ({ label, hint, get: () => t.fx[key], set: v => { t.fx[key] = v; applyTrack(t); commit(before); } });
    eqPanel({ title: `${t.name} — effects`, values: t.fx.eq, onBand: (i, v) => { t.fx.eq[i] = v; applyTrack(t); commit(before); },
      toggles: [tog('hp', 'High-pass filter (80 Hz)', 'Removes rumble and plosive thump'), tog('comp', 'Compressor', 'Evens out loud and quiet speech'),
        tog('gate', 'Noise gate', 'Silences the track between phrases (applied on export)'), tog('denoise', 'Noise reduction', 'Reduces steady hiss and hum (applied on export)')] });
  }
  function masterDialog() {
    const m = tl.master; m.eq = m.eq || Array(10).fill(0);
    const loud = h('select', { onchange: () => { m.loudness = Number(loud.value); commit(); } }, [[-16, '−16 LUFS — podcast standard (Apple, most apps)'], [-14, '−14 LUFS — louder (Spotify, YouTube)'], [-19, '−19 LUFS — mono speech'], [0, 'Off — keep my levels']].map(([v, l]) => h('option', { value: v, selected: (m.loudness ?? -16) === v }, l)));
    const vol = h('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: m.vol ?? 1, oninput: () => { m.vol = Number(vol.value); applyMaster(); }, onchange: () => commit() });
    modal('Master', h('div', { class: 'form' }, h('label', { class: 'field' }, h('span', {}, 'Loudness target on export'), loud, h('small', {}, 'Every export is normalized to this level with a true-peak limit of −1.5 dB.')),
      h('label', { class: 'field' }, h('span', {}, 'Master level'), vol),
      h('button', { class: 'btn', onclick: () => eqPanel({ title: 'Master equalizer', values: m.eq, onBand: (i, v) => { m.eq[i] = v; applyMaster(); commit(); } }) }, 'Master equalizer…')), [{ label: 'Done', cls: 'primary' }]);
  }

  // ---------------------------------------------------------------- preview engine
  function ensureCtx() {
    if (E.ctx) return;
    const ctx = E.ctx = new AudioContext();
    E.masterEq = makeEq(ctx); E.masterGain = ctx.createGain(); E.meter = new Strip(ctx, 'm');
    chain(...E.masterEq, E.masterGain, E.meter.input); E.meter.out.connect(ctx.destination);
    applyMaster(); syncAudio();
  }
  function applyMaster() { if (!E.ctx) return; (tl.master.eq || []).forEach((v, i) => { E.masterEq[i].gain.value = v || 0; }); E.masterGain.gain.value = tl.master.vol ?? 1; }
  function trackNodes(t) {
    let n = E.nodes.get(t.id);
    if (!n) {
      const ctx = E.ctx; n = { inp: ctx.createGain(), hp: ctx.createBiquadFilter(), eq: makeEq(ctx), comp: ctx.createDynamicsCompressor(), vol: ctx.createGain(), pan: ctx.createStereoPanner() };
      n.hp.type = 'highpass'; chain(n.inp, n.hp, ...n.eq, n.comp, n.vol, n.pan, E.masterEq[0]); E.nodes.set(t.id, n);
    }
    return n;
  }
  function applyTrack(t) {
    if (!E.ctx) return; const n = trackNodes(t), f = t.fx || {}, solo = tl.tracks.some(k => k.solo);
    n.hp.frequency.value = f.hp ? 80 : 10; (f.eq || []).forEach((v, i) => { n.eq[i].gain.value = v || 0; });
    n.comp.threshold.value = f.comp ? -18 : 0; n.comp.ratio.value = f.comp ? 3 : 1;
    n.vol.gain.value = (t.mute || (solo && !t.solo)) ? 0 : (t.vol ?? 1); n.pan.pan.value = t.pan || 0;
  }
  function syncAudio() {
    if (!E.ctx) return;
    tl.tracks.forEach(applyTrack);
    const live = new Set(tl.tracks.flatMap(t => t.clips.map(c => c.id)));
    for (const [id, x] of E.els) if (!live.has(id)) { x.el.pause(); x.el.removeAttribute('src'); x.el.load(); x.gain.disconnect(); E.els.delete(id); }
  }
  function clipNode(c, t) {
    let x = E.els.get(c.id);
    if (!x) {
      const m = media(c.mediaId); if (!m || m.missing) return null;
      const el = document.createElement(m.hasVideo ? 'video' : 'audio'); el.preload = 'auto'; el.src = files + m.file; el.playsInline = true;
      const gain = E.ctx.createGain(); E.ctx.createMediaElementSource(el).connect(gain);
      x = { el, gain, tid: null, hasVideo: m.hasVideo }; E.els.set(c.id, x);
    }
    if (x.tid !== t.id) { try { x.gain.disconnect(); } catch (e) { /* first connect */ } x.gain.connect(trackNodes(t).inp); x.tid = t.id; }
    return x;
  }
  function toggle(force) {
    const on = force ?? !E.playing;
    if (on === E.playing) return;
    if (on) { ensureCtx(); E.ctx.resume(); if (E.t >= total() - 0.05) E.t = 0; E.anchor = { ctx: E.ctx.currentTime, t: E.t }; E.playing = true; }
    else { E.playing = false; for (const x of E.els.values()) x.el.pause(); }
    playBtn.textContent = E.playing ? '❚❚ Pause' : '▶ Play';
  }
  function seek(t) {
    E.t = Math.max(0, t);
    if (E.playing) { E.anchor = { ctx: E.ctx.currentTime, t: E.t }; for (const x of E.els.values()) x.el.pause(); }
    else if (E.ctx || tl.tracks.some(tr => tr.clips.some(c => (media(c.mediaId) || {}).hasVideo))) { ensureCtx(); for (const tr of tl.tracks) for (const c of tr.clips) if (E.t >= c.start && E.t < clipEnd(c) && (media(c.mediaId) || {}).hasVideo) { const x = clipNode(c, tr); if (x) x.el.currentTime = c.in + (E.t - c.start); } }
    placeHead();
  }
  function tick() {
    if (!E.alive) return;
    if (E.playing) {
      E.t = E.anchor.t + (E.ctx.currentTime - E.anchor.ctx);
      const end = total();
      if (E.t >= end) { E.t = end; toggle(false); }
      for (const tr of tl.tracks) for (const c of tr.clips) {
        const s = c.start, e = clipEnd(c);
        if (E.t >= s - 1.5 && E.t < e) {
          const x = clipNode(c, tr); if (!x) continue;
          if (E.t >= s && !c.mute) {
            const want = c.in + (E.t - s), into = E.t - s, left = e - E.t;
            let gn = c.gain ?? 1; if (c.fadeIn > 0 && into < c.fadeIn) gn *= into / c.fadeIn; if (c.fadeOut > 0 && left < c.fadeOut) gn *= left / c.fadeOut;
            x.gain.gain.value = gn;
            if (x.el.paused) { x.el.currentTime = want; x.el.play().catch(() => {}); }
            else if (Math.abs(x.el.currentTime - want) > 0.25) x.el.currentTime = want;
          } else if (x.el.paused && Math.abs(x.el.currentTime - c.in) > 0.05 && E.t < s) x.el.currentTime = c.in;     // pre-roll
        } else { const x = E.els.get(c.id); if (x && !x.el.paused) x.el.pause(); }
      }
      placeHead();
      const px = E.t * E.pps; if (px > scroll.scrollLeft + scroll.clientWidth - 60 || px < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, px - 80);
    }
    drawPreview();
    if (E.meter) drawMeter(meterCv, E.meter.level());
    E.raf = requestAnimationFrame(tick);
  }
  const cover = new Image(); { const a = show.assets.find(x => x.id === show.coverAsset); if (a) cover.src = `/files/${sid}/assets/${a.file}`; }
  function drawPreview() {
    const g = preview.getContext('2d'), W = preview.width, H = preview.height, br = show.brand || {};
    g.fillStyle = br.bg || '#101418'; g.fillRect(0, 0, W, H);
    let vt = tl.tracks.filter(t => !t.hideVideo && t.clips.some(c => (media(c.mediaId) || {}).hasVideo));
    if (tl.video.layout === 'single') vt = vt.slice(0, 1);
    if (!vt.length) {
      if (cover.complete && cover.naturalWidth) { const s = H * 0.6; g.drawImage(cover, (W - s) / 2, H * 0.1, s, s); }
      g.fillStyle = br.text || '#fff'; g.font = '600 20px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(ep.title, W / 2, H * 0.86); g.textAlign = 'left';
      return;
    }
    layoutRects(tl.video.layout, vt.length, W, H).forEach(([x, y, w, hh], i) => {
      const t = vt[i]; g.fillStyle = '#000'; g.fillRect(x, y, w, hh);
      const c = t.clips.find(c => E.t >= c.start && E.t < clipEnd(c) && (media(c.mediaId) || {}).hasVideo), el = c && E.els.get(c.id) && E.els.get(c.id).el;
      if (el && el.videoWidth) { const s = Math.max(w / el.videoWidth, hh / el.videoHeight), sw = w / s, sh = hh / s; g.drawImage(el, (el.videoWidth - sw) / 2, (el.videoHeight - sh) / 2, sw, sh, x, y, w, hh); }
      if (br.lowerThirds !== false) { const fs = Math.max(9, hh / 16); g.font = `600 ${fs}px system-ui, sans-serif`; const tw = g.measureText(t.name).width; g.fillStyle = br.primary || '#7c5cff'; g.fillRect(x + fs * 0.5, y + hh - fs * 2.6, tw + fs, fs * 1.8); g.fillStyle = '#fff'; g.fillText(t.name, x + fs, y + hh - fs * 1.35); }
    });
  }
  function onKey(e) {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('.modal-back')) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); toggle(); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.ctrlKey || e.metaKey) return;
    else if (k === 's' || k === 'S') split();
    else if (k === 'Delete' || k === 'Backspace') del(e.shiftKey);
    else if (k === 'i' || k === 'I') setMark('a');
    else if (k === 'o' || k === 'O') setMark('b');
    else if (k === 'x' || k === 'X') cutSection();
    else if (k === 'm' || k === 'M') addChapter();
    else if (k === 'Home') seek(0);
    else if (k === 'End') seek(total());
    else if (k === 'ArrowLeft') seek(E.t - (e.shiftKey ? 5 : 0.5));
    else if (k === 'ArrowRight') seek(E.t + (e.shiftKey ? 5 : 0.5));
    else if (k === '=' || k === '+') { E.pps = Math.min(200, E.pps * 1.25); zoom.value = E.pps; renderTimeline(); }
    else if (k === '-') { E.pps = Math.max(4, E.pps / 1.25); zoom.value = E.pps; renderTimeline(); }
  }
  document.addEventListener('keydown', onKey);
  const onResize = () => renderTimeline(); window.addEventListener('resize', onResize);
  setTimeout(() => { if (!E.alive) return; renderAll(); if (total() > 0) fit(); tick(); }, 0);

  return {
    el: root,
    async destroy() {
      E.alive = false; cancelAnimationFrame(E.raf); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
      for (const x of E.els.values()) { x.el.pause(); x.el.removeAttribute('src'); x.el.load(); }
      E.ctx && E.ctx.close();
      await save.flush();
    },
  };
}
