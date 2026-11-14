// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Live studio: camera + mic, mixer with EQ, two decks, soundboard, remote guests, AI cast, recording.
import { h, api, toast, fail, fmtTime, modal, copyText, promptBox } from './util.js';
import { Strip, drawMeter, syncClock, recTime, ChunkRecorder, avatarTrack } from './audio.js';
import { Mesh } from './rtc.js';
import { eqPanel } from './fxui.js';

export function studioView(show, ep) {
  const sid = show.id, eid = ep.id, room = `/api/room/${sid}/${eid}`;
  const hostCast = show.cast.find(c => c.role === 'host') || { name: 'Host' };
  const aiCast = show.cast.filter(c => c.kind === 'ai');
  const S = { rec: null, recorders: [], tiles: new Map(), remote: new Map(), meters: [], transcript: (ep.transcript || []).slice(-60), markers: 0, pads: [], alive: true, fxUsed: false };
  const root = h('div', { class: 'studio' });

  // ------------------------------------------------------------------ lobby
  const lobby = h('div', { class: 'card lobby' },
    h('h2', {}, 'Studio'),
    h('p', { class: 'muted' }, 'Entering the studio turns on your microphone and camera, opens the mixer, and lets co-hosts and guests join. Wear headphones so your speakers do not bleed into the mic.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary big', id: 'enter-studio', onclick: () => enter(true).catch(fail) }, 'Enter studio'),
      h('button', { class: 'btn', onclick: () => enter(false).catch(fail) }, 'Audio only (no camera)')));
  root.append(lobby);

  // ------------------------------------------------------------------ audio graph
  function build() {
    const ctx = S.ctx = new AudioContext({ latencyHint: 'interactive' });
    const g = v => { const n = ctx.createGain(); if (v != null) n.gain.value = v; return n; };
    const B = S.bus = { program: g(), send: g(), monitor: g(), micRec: g(), fx: g(), duck: g(), voice: g(), micMon: g(0), xA: g(), xB: g(), phones: g(0.9) };
    const D = S.dest = {}; for (const k of ['program', 'send', 'micRec', 'fx', 'voice']) D[k] = ctx.createMediaStreamDestination();
    S.master = new Strip(ctx, 'Master');
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.002; lim.release.value = 0.1;
    B.program.connect(S.master.input); S.master.out.connect(lim); lim.connect(D.program);
    B.send.connect(D.send); B.micRec.connect(D.micRec); B.voice.connect(D.voice);
    B.monitor.connect(B.phones); B.phones.connect(ctx.destination);
    S.mic = new Strip(ctx, 'Mic'); S.mic.setHp(true);
    for (const b of [B.program, B.send, B.micRec, B.voice, B.micMon]) S.mic.out.connect(b);
    B.micMon.connect(B.monitor);
    S.ai = new Strip(ctx, 'AI'); for (const b of [B.program, B.send, B.monitor]) S.ai.out.connect(b);
    S.deckA = new Strip(ctx, 'Deck A', { vol: 0.8 }); S.deckB = new Strip(ctx, 'Deck B', { vol: 0.8 }); S.padStrip = new Strip(ctx, 'Pads', { vol: 0.8 });
    S.deckA.out.connect(B.xA); S.deckB.out.connect(B.xB); B.xA.connect(B.fx); B.xB.connect(B.fx); S.padStrip.out.connect(B.fx);
    B.fx.connect(B.duck); for (const b of [B.program, B.send, B.monitor, D.fx]) B.duck.connect(b);
    setXfade(0);
  }
  const setXfade = x => { const p = (x + 1) / 2 * Math.PI / 2; S.bus.xA.gain.value = Math.cos(p); S.bus.xB.gain.value = Math.sin(p); };

  // ------------------------------------------------------------------ enter
  async function enter(wantVideo) {
    lobby.querySelectorAll('button').forEach(b => b.disabled = true);
    build();
    await syncClock('/api/time');
    S.local = { cam: null, mic: null };
    await acquire({ wantVideo });
    lobby.remove();
    renderStudio();
    const inv = await api('GET', room + '/invites');
    S.ice = inv.ice; S.invites = inv;
    renderGuests();
    S.mesh = new Mesh({
      iceServers: S.ice, signalUrl: room + '/signal', getLocalStream: () => S.sendStream,
      onHello: m => { applyRec(m.rec, 'hello'); renderGuests(); },
      onPeer: p => { toast(`${p.name} joined`); renderGuests(); if (p.role === 'cohost') setTimeout(() => sendPads(p.id), 800); },
      onStream: (id, stream, peer) => addRemote(id, stream, peer),
      onLeave: (id, silent) => { removeRemote(id); if (!silent) renderGuests(); },
      onPeerState: () => renderGuests(),
      onMessage: onRoomMessage,
      onStatus: s => { if (s === 'replaced') toast('This episode\'s studio was opened in another window — this one is now disconnected.', 'err', 9000); },
    });
    S.mesh.connect(room + '/events');
    loadPads();
    loop();
    document.addEventListener('keydown', onKey);
  }

  async function acquire({ wantVideo, micId, camId } = {}) {
    const audio = { deviceId: micId ? { exact: micId } : undefined, echoCancellation: S.opt?.ec ?? true, noiseSuppression: S.opt?.ns ?? true, autoGainControl: S.opt?.agc ?? false, channelCount: 1 };
    let stream = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio, video: wantVideo ? { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false }); }
    catch (e) {
      if (wantVideo) { try { stream = await navigator.mediaDevices.getUserMedia({ audio }); toast('No camera available — continuing with audio only.'); } catch (e2) { /* below */ } }
      if (!stream) toast('No microphone available (' + (e.message || e.name) + '). You can still run decks, guests and AI.', 'err', 8000);
    }
    const mic = stream && stream.getAudioTracks()[0];
    let cam = stream && stream.getVideoTracks()[0];
    if (mic) {
      if (S.micSrc) S.micSrc.disconnect();
      if (S.local.mic) S.local.mic.stop();
      S.local.mic = mic; S.micSrc = S.ctx.createMediaStreamSource(new MediaStream([mic])); S.micSrc.connect(S.mic.input);
    }
    if (!cam && !S.local.cam) cam = avatarTrack(hostCast.name, show.brand.primary, show.brand.bg);
    if (cam) {
      if (S.local.cam && S.local.cam !== cam) { S.local.cam.stop(); S.local.cam._stopAvatar && S.local.cam._stopAvatar(); }
      S.local.cam = cam;
      if (!S.screen) setOutgoingVideo(cam);
    }
    if (!S.sendStream) S.sendStream = new MediaStream([S.dest.send.stream.getAudioTracks()[0], S.local.cam]);
  }
  function setOutgoingVideo(track) {
    if (S.sendStream) { S.sendStream.getVideoTracks().forEach(t => S.sendStream.removeTrack(t)); S.sendStream.addTrack(track); }
    S.mesh && S.mesh.replaceTrack('video', track);
    const t = S.tiles.get('host'); if (t) t.video.srcObject = new MediaStream([track]);
  }

  // ------------------------------------------------------------------ layout
  let stage, side, mixer, transport, recBtn, pauseBtn, timerEl, statusEl, sideBody;
  function renderStudio() {
    recBtn = h('button', { class: 'btn rec', id: 'rec-btn', onclick: toggleRec }, h('i', {}), 'Record');
    pauseBtn = h('button', { class: 'btn', disabled: true, onclick: () => api('POST', room + '/rec', { action: S.rec.paused ? 'resume' : 'pause' }).catch(fail) }, 'Pause');
    timerEl = h('span', { class: 'timer', id: 'rec-timer' }, '0:00');
    statusEl = h('span', { class: 'pill' }, 'Ready');
    transport = h('div', { class: 'transport' }, recBtn, pauseBtn, timerEl, statusEl,
      h('button', { class: 'btn', title: 'Drop a chapter marker (M)', onclick: () => marker() }, '⚑ Marker'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn', id: 'cam-btn', onclick: toggleCam }, 'Camera on'),
      h('button', { class: 'btn', id: 'mute-btn', onclick: () => { S.mic.setMute(!S.mic.muted); syncStripUI(); } }, 'Mic live'),
      h('button', { class: 'btn', id: 'share-btn', onclick: toggleShare }, 'Share screen'),
      h('button', { class: 'btn ghost', onclick: deviceDialog }, 'Devices'));
    stage = h('div', { class: 'stage' });
    side = h('div', { class: 'side' });
    const tabs = [['guests', 'Guests'], ['ai', 'AI cast'], ['script', 'Script'], ['log', 'Log']];
    const tabBar = h('div', { class: 'tabs small' }, tabs.map(([k, l]) => h('button', { data: { k }, class: k === 'guests' ? 'on' : '', onclick: () => showSide(k) }, l)));
    sideBody = h('div', { class: 'side-body' });
    side.append(tabBar, sideBody);
    mixer = h('div', { class: 'console' });
    root.append(transport, h('div', { class: 'studio-main' }, stage, side), mixer);
    addTile('host', hostCast.name + ' (you)', 'host').video.srcObject = new MediaStream([S.local.cam]);
    for (const c of aiCast) addTile('ai_' + c.id, c.name, c.role, true);
    renderMixer();
    showSide('guests');
    syncButtons();
  }
  const panes = {};
  function showSide(k) {
    S.sideTab = k;
    side.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    if (!panes[k]) panes[k] = { guests: guestsPane, ai: aiPane, script: scriptPane, log: logPane }[k]();
    sideBody.replaceChildren(panes[k]);
  }

  function addTile(id, name, role, isAi) {
    const video = h('video', { autoplay: true, playsInline: true, muted: true });
    const el = h('div', { class: 'tile' + (isAi ? ' ai' : ''), data: { id } }, isAi ? h('div', { class: 'avatar' }, name.slice(0, 1).toUpperCase()) : video,
      h('div', { class: 'tile-label' }, h('b', {}, name), h('span', {}, { host: 'Host', cohost: 'Co-host', guest: 'Guest' }[role] || role, isAi ? ' · AI' : '')));
    stage.append(el);
    const t = { el, video }; S.tiles.set(id, t); return t;
  }

  // ------------------------------------------------------------------ remote peers
  function addRemote(id, stream, peer) {
    let t = S.tiles.get(id) || addTile(id, peer ? peer.name : 'Guest', peer ? peer.role : 'guest');
    t.video.srcObject = stream;                       // muted element; audio is routed through the mixer
    if (!S.remote.has(id) && stream.getAudioTracks().length) {
      const strip = new Strip(S.ctx, peer ? peer.name : 'Guest');
      const src = S.ctx.createMediaStreamSource(stream); src.connect(strip.input);
      for (const b of [S.bus.program, S.bus.monitor, S.bus.voice]) strip.out.connect(b);
      S.remote.set(id, { strip, src, peer }); renderMixer();
    }
  }
  function removeRemote(id) {
    const r = S.remote.get(id); if (r) { r.src.disconnect(); r.strip.out.disconnect(); S.remote.delete(id); renderMixer(); }
    const t = S.tiles.get(id); if (t && id !== 'host' && !id.startsWith('ai_')) { t.el.remove(); S.tiles.delete(id); }
  }
  function onRoomMessage(m) {
    if (m.type === 'rec') applyRec(m.action === 'stop' ? null : m.rec, m.action);
    else if (m.type === 'media') { log('studio', `Saved take: ${m.track} (${fmtTime(m.media.duration)})`); toast(`Saved: ${m.track}`); }
    else if (m.type === 'error') toast(m.msg, 'err', 9000);
    else if (m.type === 'app') {
      const a = m.app || {};
      if (a.kind === 'chat') log(m.name, a.text, true);
      else if (m.role === 'cohost' && a.kind === 'marker') marker(`Marker (${m.name})`);
      else if (m.role === 'cohost' && a.kind === 'pad') firePad(a.i);
      else if (a.kind === 'upload') { const r = S.remote.get(m.from); if (r) r.uploaded = a; renderGuests(); }
    }
  }
  const sendPads = to => S.mesh.app(to, { kind: 'pads', pads: (show.pads || []).map(p => ({ label: p.label, color: p.color, ready: !!p.assetId })) });

  // ------------------------------------------------------------------ guests pane
  let guestsEl;
  function guestsPane() { guestsEl = h('div', {}); renderGuests(); return guestsEl; }
  function renderGuests() {
    if (!guestsEl || !S.invites) return;
    const online = id => S.mesh && S.mesh.peers && S.mesh.peers.has('p_' + id);
    guestsEl.replaceChildren(
      S.invites.guestUp ? null : h('p', { class: 'warn' }, 'The guest gateway is off, so only people on this computer can join. Turn it on in Settings.'),
      S.invites.invites.length ? null : h('p', { class: 'muted' }, 'No co-host or guests on this show yet.'),
      S.invites.invites.map(i => h('div', { class: 'invite' },
        h('div', { class: 'row' }, h('span', { class: 'dot ' + (online(i.castId) ? 'on' : '') }), h('b', {}, i.name), h('span', { class: 'pill' }, i.role === 'cohost' ? 'Co-host' : 'Guest'),
          h('span', { class: 'grow' }), h('span', { class: 'muted' }, online(i.castId) ? 'In the studio' : 'Not connected')),
        i.links.filter(l => l.label !== 'This computer' || i.links.length === 1).map(l => h('div', { class: 'row link' }, h('span', { class: 'muted' }, l.label), h('input', { readOnly: true, value: l.url, onclick: e => e.target.select() }), h('button', { class: 'btn small', onclick: () => copyText(l.url) }, 'Copy'))))),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => addGuest('guest') }, '+ Guest'),
        h('button', { class: 'btn small', onclick: () => addGuest('cohost') }, '+ Co-host')),
      h('p', { class: 'muted small' }, 'Send each person their own link. On your local network the browser will warn about the studio\'s self-signed certificate — they choose “Advanced → Proceed”. For guests over the internet set a public address in Settings → Network.'));
  }
  async function addGuest(role) {
    const name = await promptBox(role === 'cohost' ? 'Add a co-host' : 'Add a guest', '', 'Name'); if (!name) return;
    try {
      const fresh = await api('GET', `/api/shows/${sid}`);
      fresh.cast.push({ name, role, kind: 'human' });
      Object.assign(show, await api('PUT', `/api/shows/${sid}`, { cast: fresh.cast }));
      S.invites = await api('GET', room + '/invites'); renderGuests();
    } catch (e) { fail(e); }
  }

  // ------------------------------------------------------------------ AI pane
  function aiPane() {
    if (!aiCast.length) return h('div', {}, h('p', { class: 'muted' }, 'No AI co-host or guest on this show yet. Add one under the show\'s Cast tab, pick a voice, and it will appear here.'));
    return h('div', {}, aiCast.map(c => {
      const v = (c.ai && c.ai.voice) || {}, b = (c.ai && c.ai.brain) || {};
      const status = h('div', { class: 'muted small ai-status' }, 'Ready');
      const cue = h('input', { placeholder: 'Type a cue or question…', onkeydown: e => { if (e.key === 'Enter') go('reply'); } });
      const setBusy = (x, msg) => { card.classList.toggle('busy', x); status.textContent = msg; };
      const go = async (mode, blob) => {
        if (card.classList.contains('busy')) return;
        const text = cue.value.trim();
        if (mode === 'say' && !text) return toast('Type the line you want spoken first.');
        setBusy(true, blob ? 'Listening…' : 'Thinking…');
        try {
          const body = { sid, eid, castId: c.id, mode, cue: text, history: S.transcript.slice(-40) };
          if (blob) body.audio = await blobB64(blob);
          const r = await api('POST', '/api/ai/turn', body);
          cue.value = '';
          if (r.heard) log(hostCast.name, r.heard, true);
          log(c.name, r.text, true);
          setBusy(true, 'Speaking…');
          await playAi(c, r);
        } catch (e) { fail(e); }
        setBusy(false, 'Ready');
      };
      let ptt = null;
      const talk = h('button', { class: 'btn primary', title: 'Hold while you (or a guest) speak; release and the AI answers',
        onpointerdown: e => { e.preventDefault(); if (ptt || card.classList.contains('busy')) return; try { const mr = new MediaRecorder(S.dest.voice.stream, { mimeType: 'audio/webm;codecs=opus' }); const parts = []; mr.ondataavailable = x => parts.push(x.data); mr.start(); ptt = { mr, parts, t: Date.now() }; talk.classList.add('hot'); talk.textContent = 'Listening… release to send'; } catch (x) { fail(x); } },
        onpointerup: () => endPtt(), onpointerleave: () => endPtt() }, 'Hold to talk');
      const endPtt = () => { if (!ptt) return; const p = ptt; ptt = null; talk.classList.remove('hot'); talk.textContent = 'Hold to talk';
        p.mr.onstop = () => { if (Date.now() - p.t < 500) return toast('Hold the button while speaking.'); go('reply', new Blob(p.parts, { type: 'audio/webm' })); }; p.mr.stop(); };
      const card = h('div', { class: 'ai-card' },
        h('div', { class: 'row' }, h('b', {}, c.name), h('span', { class: 'pill' }, c.role === 'cohost' ? 'Co-host' : 'Guest'), h('span', { class: 'grow' }),
          h('button', { class: 'btn small ghost', onclick: () => stopAi() }, 'Cut off')),
        h('div', { class: 'muted small' }, `Voice: ${voiceName(v.provider)} · ${v.voiceId || 'default'}   Brain: ${b.provider || 'gemini'}`),
        h('div', { class: 'row' }, talk), h('div', { class: 'row' }, cue),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => go('reply') }, 'Respond'), h('button', { class: 'btn small', title: 'Speak the typed text word for word', onclick: () => go('say') }, 'Say exactly')),
        status);
      return card;
    }), h('p', { class: 'muted small' }, 'The AI hears what you send it: hold “Hold to talk” while anyone speaks, or type a cue. Its voice goes to your guests and into the recording on its own track.'));
  }
  const voiceName = p => ({ gemini: 'Gemini', xai: 'Grok', elevenlabs: 'ElevenLabs' }[p] || 'Gemini');
  const blobB64 = blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  async function playAi(c, r) {
    const buf = await S.ctx.decodeAudioData(await (await fetch(r.url)).arrayBuffer());
    const src = S.ctx.createBufferSource(); src.buffer = buf; src.connect(S.ai.input);
    const tile = S.tiles.get('ai_' + c.id);
    const recording = S.rec && !S.rec.paused;
    const t = recTime(S.rec);
    await new Promise(res => { src.onended = res; S.aiSrc = src; tile && tile.el.classList.add('speaking'); src.start(); });
    tile && tile.el.classList.remove('speaking'); S.aiSrc = null;
    if (recording) api('POST', `/api/shows/${sid}/episodes/${eid}/place`, { mediaId: r.media.id, track: c.name + ' (AI)', start: t, ai: true }).catch(fail);
    else api('DELETE', `/api/shows/${sid}/episodes/${eid}/media/${r.media.id}`).catch(() => {});
  }
  const stopAi = () => { try { S.aiSrc && S.aiSrc.stop(); } catch (e) { /* already ended */ } };

  // ------------------------------------------------------------------ script + log
  function scriptPane() {
    const box = h('div', { class: 'prompter' }, ep.script || 'No script yet — write one on the episode\'s Details tab and it shows here as a teleprompter.');
    let timer = null, speed = 30, size = 20; box.style.fontSize = size + 'px';
    const run = h('button', { class: 'btn small', onclick: () => { if (timer) { clearInterval(timer); timer = null; run.textContent = 'Auto-scroll'; } else { timer = setInterval(() => { box.scrollTop += speed / 20; }, 50); run.textContent = 'Stop scroll'; } } }, 'Auto-scroll');
    S.stopScroll = () => timer && clearInterval(timer);
    return h('div', {}, h('div', { class: 'row' }, run,
      h('button', { class: 'btn small', onclick: () => { speed = Math.max(5, speed - 10); } }, 'Slower'), h('button', { class: 'btn small', onclick: () => { speed += 10; } }, 'Faster'),
      h('button', { class: 'btn small', onclick: () => { size = Math.max(12, size - 2); box.style.fontSize = size + 'px'; } }, 'A−'), h('button', { class: 'btn small', onclick: () => { size += 2; box.style.fontSize = size + 'px'; } }, 'A+')), box);
  }
  let logEl;
  function logPane() {
    logEl = h('div', { class: 'log' });
    S.transcript.forEach(x => logEl.append(logLine(x.who, x.text)));
    const chat = h('input', { placeholder: 'Message everyone in the studio…', onkeydown: e => { if (e.key === 'Enter' && chat.value.trim()) { S.mesh.app('*', { kind: 'chat', text: chat.value.trim() }); log(hostCast.name, chat.value.trim()); chat.value = ''; } } });
    return h('div', {}, logEl, chat);
  }
  const logLine = (who, text) => h('p', {}, h('b', {}, who + ': '), text);
  function log(who, text, keep) {
    if (keep) { const item = { who, text, t: Math.round(recTime(S.rec) * 10) / 10 }; S.transcript.push(item); api('POST', `/api/shows/${sid}/episodes/${eid}/append`, { field: 'transcript', item }).catch(() => {}); }
    if (!logEl) return;
    logEl.append(logLine(who, text)); logEl.scrollTop = logEl.scrollHeight;
  }

  // ------------------------------------------------------------------ mixer console
  function stripUI(strip, label, extra) {
    const cv = h('canvas', { width: 10, height: 120, class: 'meter' });
    const fader = h('input', { type: 'range', class: 'vslider fader', min: 0, max: 1.5, step: 0.01, value: strip.vol, 'aria-label': label + ' level', oninput: () => strip.setVol(Number(fader.value)) });
    const mute = h('button', { class: 'btn tiny' + (strip.muted ? ' on' : ''), title: 'Mute', onclick: () => { strip.setMute(!strip.muted); syncStripUI(); } }, 'M');
    const eq = h('button', { class: 'btn tiny', title: 'Equalizer and dynamics', onclick: () => eqPanel({
      title: label + ' — equalizer', values: strip.eqVals, onBand: (i, v) => strip.setEq(i, v),
      toggles: [{ label: 'High-pass filter (80 Hz)', hint: 'Removes rumble, desk bumps and plosive thump', get: () => strip.hpOn, set: v => strip.setHp(v) },
        { label: 'Compressor', hint: 'Evens out loud and quiet speech', get: () => strip.compOn, set: v => strip.setComp(v) }] }) }, 'EQ');
    const pan = h('input', { type: 'range', class: 'pan', min: -1, max: 1, step: 0.1, value: 0, title: 'Pan', 'aria-label': label + ' pan', oninput: () => strip.setPan(Number(pan.value)), ondblclick: () => { pan.value = 0; strip.setPan(0); } });
    strip._ui = { mute };
    S.meters.push({ strip, cv });
    return h('div', { class: 'strip' }, h('div', { class: 'strip-name', title: label }, label), h('div', { class: 'strip-mid' }, cv, fader), pan, h('div', { class: 'row tight' }, mute, eq), extra || null);
  }
  function syncStripUI() {
    for (const m of S.meters) m.strip._ui && m.strip._ui.mute.classList.toggle('on', m.strip.muted);
    syncButtons();
  }
  function renderMixer() {
    if (!mixer) return;
    S.meters = [];
    const strips = h('div', { class: 'strips' }, stripUI(S.mic, 'Mic'),
      [...S.remote.values()].map(r => stripUI(r.strip, r.peer ? r.peer.name : 'Guest')),
      aiCast.length ? stripUI(S.ai, 'AI voice') : null, stripUI(S.deckA, 'Deck A'), stripUI(S.deckB, 'Deck B'), stripUI(S.padStrip, 'Pads'),
      h('div', { class: 'strip-gap' }), stripUI(S.master, 'Master'));
    if (!S.decksEl) S.decksEl = decksUI();
    if (!S.padsEl) S.padsEl = padsUI();
    mixer.replaceChildren(h('div', { class: 'console-col mix' }, h('h4', {}, 'Mixer'), strips, masterOpts()), h('div', { class: 'console-col' }, h('h4', {}, 'Audio decks'), S.decksEl), h('div', { class: 'console-col' }, h('h4', {}, 'Soundboard'), S.padsEl));
  }
  function masterOpts() {
    if (S.masterOpts) return S.masterOpts;
    const phones = h('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: 0.9, 'aria-label': 'Headphone volume', oninput: () => { S.bus.phones.gain.value = Number(phones.value); } });
    const self = h('input', { type: 'checkbox', onchange: () => { S.bus.micMon.gain.value = self.checked ? 1 : 0; } });
    const duck = h('input', { type: 'checkbox', checked: true, onchange: () => { S.duck = duck.checked; if (!S.duck) S.bus.duck.gain.value = 1; } }); S.duck = true;
    return S.masterOpts = h('div', { class: 'master-opts' }, h('label', {}, 'Headphones', phones), h('label', { class: 'check' }, self, 'Hear my own mic'), h('label', { class: 'check', title: 'Lowers decks and soundboard while you speak' }, duck, 'Auto-duck music under voice'));
  }

  // ------------------------------------------------------------------ decks
  function deckUI(name, strip) {
    const el = h('audio', { preload: 'auto' });
    S.ctx.createMediaElementSource(el).connect(strip.input);
    const title = h('div', { class: 'deck-title' }, 'Empty');
    const time = h('div', { class: 'deck-time' }, '0:00 / 0:00');
    const seek = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': name + ' position', oninput: () => { if (el.duration) el.currentTime = seek.value / 1000 * el.duration; } });
    const play = h('button', { class: 'btn small', onclick: () => { if (!el.src) return toast('Load a track first.'); S.fxUsed = true; el.paused ? el.play() : el.pause(); } }, '▶ Play');
    const loop = h('button', { class: 'btn small', onclick: () => { el.loop = !el.loop; loop.classList.toggle('on', el.loop); } }, 'Loop');
    const tempo = h('input', { type: 'range', min: 0.8, max: 1.2, step: 0.01, value: 1, title: 'Tempo', 'aria-label': name + ' tempo', oninput: () => { el.playbackRate = Number(tempo.value); }, ondblclick: () => { tempo.value = 1; el.playbackRate = 1; } });
    el.onplay = () => { play.textContent = '❚❚ Pause'; }; el.onpause = () => { play.textContent = '▶ Play'; };
    el.ontimeupdate = () => { time.textContent = `${fmtTime(el.currentTime)} / −${fmtTime((el.duration || 0) - el.currentTime)}`; if (el.duration) seek.value = el.currentTime / el.duration * 1000; };
    const assets = show.assets.filter(a => a.kind === 'audio');
    const pick = h('select', { 'aria-label': name + ' track', onchange: () => {
      if (pick.value === 'file') { file.click(); pick.value = ''; return; }
      const a = assets.find(x => x.id === pick.value); if (a) { el.src = `/files/${sid}/assets/${a.file}`; title.textContent = a.name; }
    } }, h('option', { value: '' }, 'Load…'), assets.map(a => h('option', { value: a.id }, a.name)), h('option', { value: 'file' }, 'Choose a file…'));
    const file = h('input', { type: 'file', accept: 'audio/*', hidden: true, onchange: () => { const f = file.files[0]; if (f) { el.src = URL.createObjectURL(f); title.textContent = f.name; } } });
    return h('div', { class: 'deck' }, h('div', { class: 'row tight' }, h('b', {}, name), h('span', { class: 'grow' }), pick, file), title, seek, h('div', { class: 'row tight' }, play, h('button', { class: 'btn small', onclick: () => { el.pause(); el.currentTime = 0; } }, '⏮ Cue'), loop), h('label', { class: 'tempo' }, 'Tempo', tempo, time));
  }
  function decksUI() {
    const x = h('input', { type: 'range', min: -1, max: 1, step: 0.02, value: 0, 'aria-label': 'Crossfader', oninput: () => setXfade(Number(x.value)), ondblclick: () => { x.value = 0; setXfade(0); } });
    return h('div', { class: 'decks' }, deckUI('Deck A', S.deckA), deckUI('Deck B', S.deckB), h('label', { class: 'xfade' }, h('span', {}, 'A'), x, h('span', {}, 'B')));
  }

  // ------------------------------------------------------------------ soundboard
  const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  async function loadPads() {
    for (const [i, p] of (show.pads || []).entries()) {
      const a = show.assets.find(x => x.id === p.assetId); if (!a) continue;
      try { S.pads[i] = { buf: await S.ctx.decodeAudioData(await (await fetch(`/files/${sid}/assets/${a.file}`)).arrayBuffer()) }; } catch (e) { /* unreadable pad */ }
      const b = S.padsEl && S.padsEl.querySelector(`[data-i="${i}"]`); b && b.classList.add('ready');
    }
  }
  function firePad(i) {
    const p = (show.pads || [])[i], st = S.pads[i]; if (!p || !st) return;
    const btn = S.padsEl.querySelector(`[data-i="${i}"]`);
    if (st.src) { try { st.src.stop(); } catch (e) { /* ended */ } return; }
    const src = S.ctx.createBufferSource(), g = S.ctx.createGain();
    src.buffer = st.buf; src.loop = !!p.loop; g.gain.value = p.gain ?? 1; src.connect(g); g.connect(S.padStrip.input);
    src.onended = () => { st.src = null; btn && btn.classList.remove('playing'); };
    st.src = src; S.fxUsed = true; btn && btn.classList.add('playing'); src.start();
  }
  function padsUI() {
    const pads = show.pads || [];
    if (!pads.length) return h('p', { class: 'muted' }, 'No pads yet. Add intros, stingers, applause or music beds under the show\'s Soundboard tab.');
    return h('div', { class: 'pads' }, pads.slice(0, 12).map((p, i) => h('button', { class: 'pad', data: { i }, style: { '--pad': p.color || '#7c5cff' }, onclick: () => firePad(i) }, h('kbd', {}, PAD_KEYS[i]), h('span', {}, p.label || 'Pad ' + (i + 1)), p.loop ? h('em', {}, 'loop') : null)));
  }

  // ------------------------------------------------------------------ recording
  async function toggleRec() {
    if (S.busy) return; S.busy = true;
    try {
      if (S.rec) { await api('POST', room + '/rec', { action: 'stop' }); }
      else {
        const cd = h('div', { class: 'countdown' }, '3'); root.append(cd);
        for (const n of [3, 2, 1]) { cd.textContent = n; await new Promise(r => setTimeout(r, 700)); }
        cd.remove();
        await api('POST', room + '/rec', { action: 'start' });
      }
    } catch (e) { fail(e); }
    S.busy = false;
  }
  function applyRec(rec, action) {
    const was = S.rec;
    S.rec = rec;
    if (rec && !was) startRecorders(rec);
    else if (!rec && was) stopRecorders();
    else if (rec && action === 'pause') S.recorders.forEach(r => r.pause());
    else if (rec && action === 'resume') S.recorders.forEach(r => r.resume());
    syncButtons();
  }
  function recorder(stream, kind, rec) {
    const up = `${rec.id}_host_${kind}_${Date.now() % 100000}`;
    const r = new ChunkRecorder(stream, { rec, beginUrl: room + '/begin', chunkUrl: seq => `${room}/chunk?up=${up}&seq=${seq}`, finishUrl: room + '/finish' });
    r.up = up; r.kind = kind;
    r.start({ up, kind, recId: rec.id, offset: recTime(rec) }).catch(fail);
    S.recorders.push(r); return r;
  }
  function startRecorders(rec) {
    S.fxUsed = false; S.markers = 0;
    const own = [S.dest.micRec.stream.getAudioTracks()[0]];
    if (S.local.cam && !S.local.cam._avatar) own.push(S.local.cam);
    recorder(new MediaStream(own), 'cam', rec);
    recorder(S.dest.fx.stream, 'fx', rec);
    recorder(S.dest.program.stream, 'program', rec);
    if (S.screen) recorder(new MediaStream([S.screen]), 'screen', rec);
    log('studio', 'Recording started');
  }
  async function stopRecorders() {
    const rs = S.recorders; S.recorders = [];
    statusEl.textContent = 'Saving…';
    const ok = await Promise.all(rs.map(r => r.stop({ up: r.up, discard: r.kind === 'fx' && !S.fxUsed })));
    if (S.alive) { statusEl.textContent = 'Ready'; ok.every(Boolean) ? toast('Recording saved — every track is waiting in the Editor.', 'ok', 7000) : toast('Part of the recording could not be uploaded.', 'err', 9000); }
  }
  function marker(title) {
    if (!S.rec) return toast('Markers are added while recording.');
    S.markers++;
    const item = { t: Math.round(recTime(S.rec) * 10) / 10, title: title || 'Marker ' + S.markers };
    api('POST', `/api/shows/${sid}/episodes/${eid}/append`, { field: 'chapters', item }).catch(fail);
    log('studio', `⚑ ${item.title} at ${fmtTime(item.t)}`); toast(`Marker at ${fmtTime(item.t)}`);
  }
  function syncButtons() {
    if (!recBtn) return;
    const on = !!S.rec, paused = on && S.rec.paused;
    recBtn.classList.toggle('on', on); recBtn.lastChild.textContent = on ? 'Stop' : 'Record';
    pauseBtn.disabled = !on; pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    statusEl.textContent = on ? (paused ? 'PAUSED' : 'ON AIR · REC') : (statusEl.textContent === 'Saving…' ? 'Saving…' : 'Ready');
    statusEl.className = 'pill ' + (on ? (paused ? 'warn' : 'live') : '');
    const mb = transport.querySelector('#mute-btn'); mb.textContent = S.mic.muted ? 'Mic muted' : 'Mic live'; mb.classList.toggle('danger', S.mic.muted);
    const cb = transport.querySelector('#cam-btn'); const camOn = S.local.cam && S.local.cam.enabled && !S.local.cam._avatar; cb.textContent = S.local.cam._avatar ? 'No camera' : (camOn ? 'Camera on' : 'Camera off'); cb.classList.toggle('danger', !camOn && !S.local.cam._avatar);
    transport.querySelector('#share-btn').textContent = S.screen ? 'Stop sharing' : 'Share screen';
  }
  function toggleCam() { const c = S.local.cam; if (c._avatar) return toast('No camera is connected — choose one under Devices.'); c.enabled = !c.enabled; syncButtons(); }
  async function toggleShare() {
    if (S.screen) { S.screen.stop(); return endShare(); }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      S.screen = ds.getVideoTracks()[0]; S.screen.onended = endShare;
      setOutgoingVideo(S.screen);
      if (S.rec) recorder(new MediaStream([S.screen]), 'screen', S.rec);
      syncButtons();
    } catch (e) { /* user cancelled the picker */ }
  }
  function endShare() {
    if (!S.screen) return; S.screen = null;
    const i = S.recorders.findIndex(r => r.kind === 'screen');
    if (i >= 0) { const r = S.recorders.splice(i, 1)[0]; r.stop({ up: r.up }); }
    setOutgoingVideo(S.local.cam); syncButtons();
  }
  async function deviceDialog() {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const sel = (kind, cur) => h('select', {}, devs.filter(d => d.kind === kind).map(d => h('option', { value: d.deviceId, selected: cur && cur.getSettings().deviceId === d.deviceId }, d.label || kind)));
    const mic = sel('audioinput', S.local.mic), cam = sel('videoinput', S.local.cam && !S.local.cam._avatar ? S.local.cam : null);
    S.opt = S.opt || { ec: true, ns: true, agc: false };
    const chk = k => { const c = h('input', { type: 'checkbox', checked: S.opt[k], onchange: () => { S.opt[k] = c.checked; } }); return c; };
    modal('Devices', h('div', { class: 'form' },
      h('label', { class: 'field' }, h('span', {}, 'Microphone'), mic), h('label', { class: 'field' }, h('span', {}, 'Camera'), cam),
      h('label', { class: 'field check' }, chk('ec'), h('span', {}, 'Echo cancellation'), h('small', {}, 'Leave on unless everyone wears headphones')),
      h('label', { class: 'field check' }, chk('ns'), h('span', {}, 'Noise suppression')), h('label', { class: 'field check' }, chk('agc'), h('span', {}, 'Automatic gain')),
      S.rec ? h('p', { class: 'warn' }, 'Stop recording before switching devices.') : null),
    [{ label: 'Cancel', cls: 'ghost' }, { label: 'Apply', cls: 'primary', fn: async () => { if (S.rec) return false; await acquire({ wantVideo: !!cam.value, micId: mic.value, camId: cam.value }); syncButtons(); } }]);
  }

  // ------------------------------------------------------------------ loop + keys
  function loop() {
    if (!S.alive) return;
    let micLv = null;
    for (const m of S.meters) { const lv = m.strip.level(); if (m.strip === S.mic) micLv = lv; drawMeter(m.cv, lv); }
    if (S.duck && micLv) S.bus.duck.gain.setTargetAtTime(micLv.rms > -40 && !S.mic.muted ? 0.3 : 1, S.ctx.currentTime, micLv.rms > -40 ? 0.06 : 0.5);
    for (const [id, r] of S.remote) { const t = S.tiles.get(id); t && t.el.classList.toggle('speaking', r.strip.level().rms > -42); }
    const ht = S.tiles.get('host'); ht && micLv && ht.el.classList.toggle('speaking', micLv.rms > -42 && !S.mic.muted);
    if (timerEl) timerEl.textContent = fmtTime(recTime(S.rec));
    S.raf = requestAnimationFrame(loop);
  }
  function onKey(e) {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = PAD_KEYS.indexOf(e.key);
    if (i >= 0) firePad(i);
    else if (e.key === 'm' || e.key === 'M') marker();
  }

  return {
    el: root,
    busy: () => !!S.rec,
    async destroy() {
      const wasRec = S.rec;
      document.removeEventListener('keydown', onKey);
      if (wasRec) { try { await api('POST', room + '/rec', { action: 'stop' }); } catch (e) { /* server gone */ } S.rec = null; await stopRecorders(); }
      S.alive = false; cancelAnimationFrame(S.raf); S.stopScroll && S.stopScroll();
      S.mesh && S.mesh.close();
      if (S.local) for (const t of [S.local.cam, S.local.mic, S.screen]) if (t) { t.stop(); t._stopAvatar && t._stopAvatar(); }
      S.ctx && S.ctx.close();
    },
  };
}
