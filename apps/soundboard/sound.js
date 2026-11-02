// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Soundboard - boards of pads; built-in sounds (synth.js) and the Session Master's own files.
(() => {
  'use strict';
  const { $, h, act } = IP;
  const { LOOPS, SHOTS } = IPSynth;
  const KEYS = '1234567890qwertyuiop';
  const COLORS = ['#3b4a8f', '#2f6f73', '#3d7d3a', '#7a5a12', '#8f3b3b', '#6b3b8f', '#8f3b6e', '#4a4a4a', '#1f5f9f', '#9f5f1f'];
  let boards = [], cur = 0, files = [], editing = false, saveTimer = null, tableOpen = false;
  const uid = () => Math.random().toString(36).slice(2, 10);

  // ---------------------------------------------------------------- default boards (first visit)
  function defaults() {
    const pad = (src, mode, color) => {
      const [kind, id] = src.split(':'); const def = (kind === 'loop' ? LOOPS : SHOTS)[id];
      return { id: uid(), src, label: def[0], icon: def[1], color, mode, volume: 0.8, fade: mode === 'loop' ? 3 : 0, table: false };
    };
    return [
      { id: uid(), name: 'Ambience', pads: [['rain', '#1f5f9f'], ['storm', '#3b4a8f'], ['wind', '#4a4a4a'], ['fire', '#9f5f1f'], ['waves', '#2f6f73'], ['river', '#2f6f73'],
        ['cave', '#4a4a4a'], ['night', '#3d7d3a'], ['dungeon', '#6b3b8f'], ['tavern', '#7a5a12']].map(([id, c]) => pad('loop:' + id, 'loop', c)) },
      { id: uid(), name: 'Effects', pads: [['thunder', '#3b4a8f'], ['sword', '#8f3b3b'], ['impact', '#8f3b3b'], ['arrow', '#7a5a12'], ['whoosh', '#6b3b8f'], ['chime', '#6b3b8f'],
        ['gong', '#7a5a12'], ['bell', '#7a5a12'], ['heartbeat', '#8f3b6e'], ['knock', '#4a4a4a'], ['creak', '#4a4a4a'], ['coins', '#7a5a12'], ['dice', '#2f6f73'],
        ['horn', '#9f5f1f'], ['fanfare', '#3d7d3a'], ['growl', '#8f3b3b']].map(([id, c]) => pad('shot:' + id, 'once', c)) },
    ];
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => IP.api('boards_save', { boards }).catch(e => IP.toast(e.message, true)), 600);
  }

  // ---------------------------------------------------------------- audio engine
  let ctx = null, master = null;
  const playing = new Map();                 // pad id -> { gain, stop(fade), loop }
  const buffers = new Map();                 // file id -> Promise<AudioBuffer>
  function audio() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = +$('master').value; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function loadFile(id) {
    if (!buffers.has(id)) buffers.set(id, (async () => {
      const r = await fetch(`api.php?action=file&id=${id}`);
      if (!r.ok) { let m = `Could not load the sound (HTTP ${r.status})`; try { m = (await r.json()).error || m; } catch {} throw new Error(m); }
      return audio().decodeAudioData(await r.arrayBuffer());
    })().catch(e => { buffers.delete(id); throw e; }));
    return buffers.get(id);
  }
  function fadeOut(entry, secs) {
    const t = ctx.currentTime, g = entry.gain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + Math.max(0.05, secs));
    setTimeout(() => { try { entry.stop(); } catch {} try { entry.gain.disconnect(); } catch {} }, Math.max(0.05, secs) * 1000 + 80);
  }
  async function start(pad, { preview = false } = {}) {
    audio();
    const [kind, id] = pad.src.split(':');
    const loop = pad.mode === 'loop';
    const g = ctx.createGain(), vol = +pad.volume;
    g.connect(master);
    if (loop && pad.fade > 0) { g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + +pad.fade); } else g.gain.value = vol;
    let stopFn = () => {};
    if (kind === 'loop' || kind === 'shot') {
      const def = (kind === 'loop' ? LOOPS : SHOTS)[id];
      if (!def) throw new Error('That built-in sound no longer exists.');
      if (kind === 'loop' && loop) { const hnd = def[2](ctx, g); stopFn = () => hnd.stop(); }
      else if (kind === 'loop') { const hnd = def[2](ctx, g); setTimeout(() => fadeOut({ gain: g, stop: () => hnd.stop() }, 1.5), 8000); stopFn = () => hnd.stop(); }
      else if (loop) { const run = () => def[2](ctx, g); run(); const iv = setInterval(run, 6000); stopFn = () => clearInterval(iv); }
      else { def[2](ctx, g); }
    } else {
      const buf = await loadFile(+id);
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.connect(g); s.start();
      stopFn = () => { try { s.stop(); } catch {} };
      if (!loop) s.onended = () => { if (playing.get(pad.id)?.src === s) { playing.delete(pad.id); renderPads(); } };
      if (pad.table && !preview) IP.api('table_play', { id: +id, loop, volume: vol }).then(r => IP.toast(`Playing on ${r.sent} player device${r.sent === 1 ? '' : 's'}`)).catch(e => IP.toast(e.message, true));
      const entry = { gain: g, stop: stopFn, loop, src: s, table: !!pad.table };
      if (!preview) playing.set(pad.id, entry);
      return entry;
    }
    const entry = { gain: g, stop: stopFn, loop };
    if (!preview && loop) playing.set(pad.id, entry);
    if (!loop) setTimeout(() => { try { g.disconnect(); } catch {} }, 12000);
    return entry;
  }
  async function trigger(pad) {
    const now = playing.get(pad.id);
    if (now && now.loop) { playing.delete(pad.id); fadeOut(now, pad.fade > 0 ? Math.min(3, +pad.fade) : 0.4); if (now.table) IP.api('table_stop', {}).catch(() => {}); renderPads(); return; }
    if (now) { fadeOut(now, 0.08); playing.delete(pad.id); }
    await start(pad);
    renderPads();
    const el = document.querySelector(`.pad[data-id="${pad.id}"]`);
    if (el && pad.mode !== 'loop') { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 250); }
  }
  function stopAll() {
    if (!ctx) return;
    let table = false;
    for (const [, e] of playing) { fadeOut(e, 1.5); table = table || e.table; }
    playing.clear();
    // one-shots still sounding: fade the master briefly
    const t = ctx.currentTime, mv = +$('master').value;
    master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0.0001, t + 1.5); master.gain.linearRampToValueAtTime(mv, t + 1.8);
    if (table || tableOpen) IP.api('table_stop', {}).catch(() => {});
    renderPads();
  }
  $('stopAll').onclick = stopAll;
  $('master').oninput = () => { if (master) master.gain.value = +$('master').value; IP.store.set('sb.master', +$('master').value); };
  $('master').value = IP.store.get('sb.master', 0.8);

  // ---------------------------------------------------------------- boards and pads
  const board = () => boards[cur];
  function renderBoards() {
    const b = $('boards'); b.textContent = '';
    boards.forEach((bd, i) => b.append(h('button', { class: i === cur ? 'on' : '', text: bd.name, onclick: () => { cur = i; IP.store.set('sb.board', i); renderAll(); } })));
    $('boardbar').hidden = !editing;
    if (editing && board()) $('boardName').value = board().name;
  }
  function srcLabel(src) {
    const [k, id] = src.split(':');
    if (k === 'file') { const f = files.find(x => x.id === +id); return f ? f.name : 'missing file'; }
    return ((k === 'loop' ? LOOPS : SHOTS)[id] || ['?'])[0];
  }
  function renderPads() {
    const box = $('pads'); box.textContent = '';
    if (!board()) return;
    board().pads.forEach((p, i) => {
      const on = playing.has(p.id) && p.mode === 'loop';
      const missing = p.src.startsWith('file:') && !files.some(f => f.id === +p.src.slice(5));
      const el = h('div', { class: 'pad' + (on ? ' on' : ''), dataset: { id: p.id }, style: `--pc:${/^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : '#3b4a8f'}`, role: 'button', tabindex: 0,
        title: `${p.label} — ${srcLabel(p.src)}${p.mode === 'loop' ? ' (loops)' : ''}${missing ? ' — the file was deleted' : ''}`,
        onclick: e => { if (e.target.closest('input')) return; editing ? editPad(i) : trigger(p).catch(err => IP.toast(err.message, true)); } },
        i < KEYS.length ? h('span', { class: 'key', text: KEYS[i].toUpperCase() }) : null,
        p.mode === 'loop' ? h('span', { class: 'loopb', text: '∞', title: 'Loops until stopped' }) : null,
        p.table ? h('span', { class: 'tb', text: '📱', title: 'Also on players\' devices' }) : null,
        h('span', { class: 'ic', text: missing ? '⚠' : p.icon || '🔊' }), h('span', { class: 'lb', text: p.label }));
      if (on) {
        const v = h('input', { class: 'vol', type: 'range', min: 0, max: 1, step: 0.01, value: p.volume, title: 'Volume' });
        v.oninput = () => { p.volume = +v.value; const e = playing.get(p.id); if (e) e.gain.gain.setTargetAtTime(p.volume, ctx.currentTime, 0.05); save(); };
        el.append(v);
      }
      box.append(el);
    });
    if (editing) box.append(h('div', { class: 'pad add', role: 'button', tabindex: 0, onclick: () => editPad(-1) }, h('span', { class: 'ic', text: '+' }), h('span', { class: 'lb', text: 'Add a pad' })));
  }
  function renderAll() { renderBoards(); renderPads(); }
  $('editBtn').onclick = () => { editing = !editing; document.body.classList.toggle('editing', editing); $('editBtn').classList.toggle('on', editing); $('editBtn').textContent = editing ? '✓ Done editing' : '✎ Edit pads'; renderAll(); };
  $('addBoard').onclick = () => { const name = prompt('Name the board (for example: Tavern, Combat, The Crypt):'); if (!name) return; boards.push({ id: uid(), name: name.slice(0, 40), pads: [] }); cur = boards.length - 1; if (!editing) $('editBtn').click(); else renderAll(); save(); };
  $('boardName').onchange = () => { board().name = $('boardName').value.trim().slice(0, 40) || board().name; renderBoards(); save(); };
  $('boardLeft').onclick = () => { if (cur > 0) { [boards[cur - 1], boards[cur]] = [boards[cur], boards[cur - 1]]; cur--; renderAll(); save(); } };
  $('boardRight').onclick = () => { if (cur < boards.length - 1) { [boards[cur + 1], boards[cur]] = [boards[cur], boards[cur + 1]]; cur++; renderAll(); save(); } };
  $('boardDel').onclick = () => { if (boards.length < 2) return IP.toast('Keep at least one board.', true); if (!confirm(`Delete the board “${board().name}” and its pads? Your sound files stay.`)) return; boards.splice(cur, 1); cur = Math.max(0, cur - 1); renderAll(); save(); };

  // ---------------------------------------------------------------- pad editor
  let editIdx = -1, editColor = COLORS[0];
  function fillSources(sel, value) {
    sel.textContent = '';
    sel.append(h('optgroup', { label: 'Built-in ambience' }, Object.entries(LOOPS).map(([id, d]) => h('option', { value: 'loop:' + id, text: `${d[1]} ${d[0]}` }))),
      h('optgroup', { label: 'Built-in effects' }, Object.entries(SHOTS).map(([id, d]) => h('option', { value: 'shot:' + id, text: `${d[1]} ${d[0]}` }))),
      files.length ? h('optgroup', { label: 'Your sounds' }, files.map(f => h('option', { value: 'file:' + f.id, text: f.name }))) : null);
    if (value) sel.value = value;
  }
  function editPad(i, preset) {
    editIdx = i;
    const p = i >= 0 ? board().pads[i] : Object.assign({ src: 'shot:chime', label: '', icon: '', color: COLORS[(board().pads.length) % COLORS.length], mode: 'once', volume: 0.8, fade: 0, table: false }, preset || {});
    const f = $('padForm');
    fillSources($('padSrc'), p.src);
    f.label.value = p.label; f.icon.value = p.icon || ''; f.mode.value = p.mode; f.volume.value = p.volume; f.fade.value = String(p.fade || 0); f.table.checked = !!p.table;
    editColor = p.color;
    const cs = $('colors'); cs.textContent = '';
    COLORS.forEach(c => cs.append(h('button', { type: 'button', class: c === editColor ? 'on' : '', style: { background: c }, title: c, onclick: () => { editColor = c; cs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.title === c)); } })));
    $('padTitle').textContent = i >= 0 ? `Pad: ${p.label}` : 'New pad';
    $('padDel').hidden = $('padLeft').hidden = $('padRight').hidden = i < 0;
    srcChanged(i < 0 && !preset);
    $('padDlg').showModal();
  }
  // Choosing a sound fills in a name, icon and loop setting that fit it.
  function srcChanged(fill) {
    const f = $('padForm'), [k, id] = f.src.value.split(':');
    $('tableRow').hidden = k !== 'file';
    if (!fill) return;
    if (k === 'file') { const fl = files.find(x => x.id === +id); f.label.value = fl ? fl.name.slice(0, 40) : ''; f.icon.value = '🎵'; }
    else { const d = (k === 'loop' ? LOOPS : SHOTS)[id]; f.label.value = d[0]; f.icon.value = d[1]; f.mode.value = k === 'loop' ? 'loop' : 'once'; f.fade.value = k === 'loop' ? '3' : '0'; }
  }
  $('padSrc').onchange = () => srcChanged(true);
  const formPad = () => { const f = $('padForm'); return { src: f.src.value, label: f.label.value.trim().slice(0, 40) || srcLabel(f.src.value), icon: f.icon.value.trim().slice(0, 4), color: editColor,
    mode: f.mode.value, volume: +f.volume.value, fade: +f.fade.value, table: f.table.checked && f.src.value.startsWith('file:') }; };
  $('padTry').onclick = act(async () => { const p = formPad(); const e = await start({ ...p, id: 'try' }, { preview: true }); if (p.mode === 'loop') setTimeout(() => fadeOut(e, 1), 5000); });
  $('padDlg').addEventListener('close', () => {
    if ($('padDlg').returnValue !== 'ok') return;
    const p = formPad();
    if (editIdx >= 0) Object.assign(board().pads[editIdx], p); else board().pads.push({ id: uid(), ...p });
    renderPads(); save();
  });
  $('padDel').onclick = () => { const p = board().pads[editIdx]; const e = playing.get(p.id); if (e) { fadeOut(e, 0.3); playing.delete(p.id); } board().pads.splice(editIdx, 1); $('padDlg').close(); renderPads(); save(); };
  const movePad = d => { const a = board().pads, j = editIdx + d; if (j < 0 || j >= a.length) return; [a[editIdx], a[j]] = [a[j], a[editIdx]]; editIdx = j; renderPads(); save(); };
  $('padLeft').onclick = () => movePad(-1); $('padRight').onclick = () => movePad(1);

  // ---------------------------------------------------------------- your sound files
  function renderLibrary() {
    const ul = $('library'); ul.textContent = '';
    if (!files.length) ul.append(h('li', { class: 'none', style: { display: 'block' }, text: 'No sound files yet.' }));
    for (const f of files) {
      const prev = h('button', { class: 'icon', text: '▶', title: 'Listen', onclick: act(async () => {
        const e = playing.get('preview'); if (e) { fadeOut(e, 0.2); playing.delete('preview'); if (prev.textContent === '■') { prev.textContent = '▶'; return; } }
        document.querySelectorAll('.library .icon').forEach(b => { if (b.textContent === '■') b.textContent = '▶'; });
        const en = await start({ id: 'preview', src: 'file:' + f.id, mode: 'once', volume: 0.9, fade: 0 }, { preview: true });
        playing.set('preview', en); prev.textContent = '■';
        if (en.src) en.src.onended = () => { prev.textContent = '▶'; playing.delete('preview'); };
      }) });
      ul.append(h('li', {}, prev, h('div', { style: { minWidth: 0 } }, h('div', { class: 'nm', text: f.name, title: f.name }), h('small', { text: `${(f.size / 1048576).toFixed(1)} MB · ${f.mime.replace('audio/', '')}` })),
        h('div', { class: 'row' },
          h('button', { class: 'small', text: '+ Pad', title: 'Put it on this board', onclick: () => { if (!editing) $('editBtn').click(); editPad(-1, { src: 'file:' + f.id, label: f.name.slice(0, 40), icon: '🎵', mode: 'loop', fade: 3 }); } }),
          h('button', { class: 'icon', text: '✎', title: 'Rename', onclick: act(async () => { const n = prompt('Name:', f.name); if (!n) return; await IP.api('file_rename', { id: f.id, name: n }); f.name = n; renderLibrary(); renderPads(); }) }),
          h('button', { class: 'icon danger', text: '×', title: 'Delete', onclick: act(async () => {
            const used = boards.flatMap(b => b.pads).filter(p => p.src === 'file:' + f.id).length;
            if (!confirm(`Delete “${f.name}” from this computer?${used ? ` ${used} pad${used === 1 ? ' uses' : 's use'} it.` : ''}`)) return;
            await IP.api('file_delete', { id: f.id }); files = files.filter(x => x !== f); buffers.delete(f.id); renderLibrary(); renderPads(); }) }))));
    }
  }
  function upload(file) {
    const row = h('div', { class: 'uprow', text: `Adding ${file.name}…` }); $('uploads').append(row);
    return new Promise(resolve => {
      const x = new XMLHttpRequest();
      x.open('POST', 'api.php?action=upload');
      x.setRequestHeader('X-Auth-Token', window.IPAuth && IPAuth.token ? IPAuth.token() : '');
      x.setRequestHeader('X-Filename', encodeURIComponent(file.name));
      if (file.type) x.setRequestHeader('Content-Type', file.type);
      x.upload.onprogress = e => { if (e.lengthComputable) row.textContent = `Adding ${file.name}… ${Math.round(e.loaded / e.total * 100)}%`; };
      x.onload = () => {
        row.remove();
        let j = {}; try { j = JSON.parse(x.responseText); } catch {}
        if (j.ok) { files.push(j.file); files.sort((a, b) => a.name.localeCompare(b.name)); renderLibrary(); IP.toast(`Added “${j.file.name}”`); }
        else IP.toast(`${file.name}: ${j.error || 'upload failed (HTTP ' + x.status + ')'}`, true);
        resolve();
      };
      x.onerror = () => { row.remove(); IP.toast(`${file.name}: upload failed`, true); resolve(); };
      x.send(file);
    });
  }
  const addFiles = async list => { for (const f of list) await upload(f); };
  $('upload').onchange = () => { addFiles([...$('upload').files]); $('upload').value = ''; };
  let depth = 0;
  document.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { depth++; $('dropzone').hidden = false; } });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('dropzone').hidden = true; } });
  document.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { depth = 0; $('dropzone').hidden = true; if (e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });

  // ---------------------------------------------------------------- keyboard
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || $('padDlg').open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'Escape') { e.preventDefault(); stopAll(); return; }
    const i = KEYS.indexOf(e.key.toLowerCase());
    if (i >= 0 && board() && board().pads[i]) { e.preventDefault(); trigger(board().pads[i]).catch(err => IP.toast(err.message, true)); }
  });

  IP.boot(async (user, st) => {
    const j = await IP.api('state');
    files = j.files; tableOpen = j.table_open;
    $('tablePill').textContent = tableOpen ? 'Table open' : 'Table closed'; $('tablePill').className = 'pill' + (tableOpen ? ' ok' : '');
    boards = Array.isArray(j.boards) && j.boards.length ? j.boards : defaults();
    if (!j.boards) save();
    cur = Math.min(IP.store.get('sb.board', 0), boards.length - 1);
    renderAll(); renderLibrary();
  });
})();
