// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Join page for remote co-hosts and guests. Records this person's own mic + camera locally
// (full quality, unaffected by the call) and uploads it to the host's studio while recording.
import { h, $, toast, fail, fmtTime } from './util.js';
import { Strip, drawMeter, syncClock, recTime, ChunkRecorder, avatarTrack } from './audio.js';
import { Mesh } from './rtc.js';

const [, , sid, eid] = location.pathname.split('/');
const tok = new URLSearchParams(location.search).get('t') || '';
const qs = `sid=${encodeURIComponent(sid)}&eid=${encodeURIComponent(eid)}&t=${encodeURIComponent(tok)}`;
const root = $('#guest');
const G = { rec: null, recorder: null, tiles: new Map(), pads: [] };

init().catch(e => root.replaceChildren(h('div', { class: 'card lobby' }, h('h2', {}, 'This invite link did not work'), h('p', {}, e.message || String(e)), h('p', { class: 'muted' }, 'Ask the host to send you a fresh link.'))));

async function init() {
  const r = await fetch('/g/info?' + qs);
  const info = await r.json();
  if (!r.ok) throw new Error(info.error || 'Invite not valid');
  G.info = info;
  const br = info.show.brand || {};
  const st = document.documentElement.style;
  st.setProperty('--brand', br.primary || '#7c5cff'); st.setProperty('--accent', br.accent || '#ffb347');
  document.title = `Join — ${info.show.title}`;
  const preview = h('video', { autoplay: true, muted: true, playsInline: true, class: 'preview' });
  const cv = h('canvas', { width: 10, height: 90, class: 'meter' });
  const mic = h('select', { 'aria-label': 'Microphone' }), cam = h('select', { 'aria-label': 'Camera' });
  const joinBtn = h('button', { class: 'btn primary big', id: 'join-btn', disabled: true, onclick: () => join().catch(fail) }, 'Join the studio');
  root.replaceChildren(h('div', { class: 'card lobby guest-lobby' },
    info.show.hasCover ? h('img', { class: 'cover', src: '/g/cover?' + qs, alt: '' }) : null,
    h('div', {},
      h('p', { class: 'eyebrow' }, info.me.role === 'cohost' ? 'You are co-hosting' : 'You are a guest on'),
      h('h1', {}, info.show.title), h('p', { class: 'muted' }, info.episode.title),
      h('p', {}, `Hi ${info.me.name}. Check your camera and microphone, put on headphones, then join.`),
      h('div', { class: 'row top' }, preview, cv),
      h('label', { class: 'field' }, h('span', {}, 'Microphone'), mic), h('label', { class: 'field' }, h('span', {}, 'Camera'), cam),
      joinBtn,
      h('p', { class: 'muted small' }, 'While the host records, your own audio and video are also recorded in this browser at full quality and sent to the host. Keep this tab open until it says the upload is finished.'))));
  if (!window.isSecureContext || !navigator.mediaDevices) throw new Error('This browser blocks the camera and microphone on this address. Open the https:// link the host sent, in a current Chrome, Chromium, Edge or Firefox.');
  await getMedia();
  const devs = await navigator.mediaDevices.enumerateDevices();
  const fill = (sel, kind, cur) => sel.replaceChildren(...devs.filter(d => d.kind === kind).map(d => h('option', { value: d.deviceId, selected: cur && cur.getSettings().deviceId === d.deviceId }, d.label || kind)), ...(kind === 'videoinput' ? [h('option', { value: 'none' }, 'No camera')] : []));
  fill(mic, 'audioinput', G.mic); fill(cam, 'videoinput', G.cam && !G.cam._avatar ? G.cam : null);
  if (G.cam && G.cam._avatar) cam.value = 'none';
  mic.onchange = cam.onchange = () => getMedia(mic.value, cam.value).catch(fail);
  preview.srcObject = G.stream;
  G.preview = preview;
  const ctx = G.ctx = new AudioContext();
  document.addEventListener('pointerdown', () => ctx.resume(), { once: true });
  G.strip = new Strip(ctx, 'me'); G.micSrc = ctx.createMediaStreamSource(G.stream); G.micSrc.connect(G.strip.input);
  const tick = () => { if (G.strip) { G.lv = G.strip.level(); if (cv.isConnected) drawMeter(cv, G.lv); const me = G.tiles.get('me'); me && me.classList.toggle('speaking', G.lv.rms > -42 && G.mic && G.mic.enabled); if (G.timer) G.timer.textContent = fmtTime(recTime(G.rec)); } requestAnimationFrame(tick); };
  tick();
  joinBtn.disabled = false;
}

async function getMedia(micId, camId) {
  const audio = { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true };
  const wantCam = camId !== 'none';
  let s;
  try { s = await navigator.mediaDevices.getUserMedia({ audio, video: wantCam ? { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } : false }); }
  catch (e) { try { s = await navigator.mediaDevices.getUserMedia({ audio }); } catch (e2) { throw new Error('Could not open your microphone: ' + (e2.message || e2.name) + '. Allow microphone access for this page and reload.'); } }
  if (G.stream) G.stream.getTracks().forEach(t => { t.stop(); t._stopAvatar && t._stopAvatar(); });
  G.mic = s.getAudioTracks()[0];
  G.cam = s.getVideoTracks()[0] || avatarTrack(G.info.me.name, G.info.show.brand.primary, '#151922');
  G.stream = new MediaStream([G.mic, G.cam]);
  if (G.preview) G.preview.srcObject = G.stream;
  if (G.micSrc) { G.micSrc.disconnect(); G.micSrc = G.ctx.createMediaStreamSource(G.stream); G.micSrc.connect(G.strip.input); }
}

function tile(id, name, role, self) {
  const video = h('video', { autoplay: true, playsInline: true, muted: !!self });
  const el = h('div', { class: 'tile', data: { id } }, video, h('div', { class: 'tile-label' }, h('b', {}, name), h('span', {}, { host: 'Host', cohost: 'Co-host', guest: 'Guest' }[role] || '')));
  el.video = video; G.tiles.set(id, el); G.stage.append(el); return el;
}

async function join() {
  await G.ctx.resume();
  await syncClock('/g/time');
  const me = G.info.me;
  G.stage = h('div', { class: 'stage' });
  G.timer = h('span', { class: 'timer' }, '0:00');
  G.status = h('span', { class: 'pill' }, 'Connected — not recording');
  G.upload = h('span', { class: 'muted small' }, '');
  const micBtn = h('button', { class: 'btn', onclick: () => { G.mic.enabled = !G.mic.enabled; micBtn.textContent = G.mic.enabled ? 'Mic live' : 'Mic muted'; micBtn.classList.toggle('danger', !G.mic.enabled); } }, 'Mic live');
  const camBtn = h('button', { class: 'btn', onclick: () => { if (G.cam._avatar) return toast('No camera selected.'); G.cam.enabled = !G.cam.enabled; camBtn.textContent = G.cam.enabled ? 'Camera on' : 'Camera off'; camBtn.classList.toggle('danger', !G.cam.enabled); } }, G.cam._avatar ? 'No camera' : 'Camera on');
  G.log = h('div', { class: 'log' });
  const chat = h('input', { placeholder: 'Message the studio…', onkeydown: e => { if (e.key === 'Enter' && chat.value.trim()) { G.mesh.app('*', { kind: 'chat', text: chat.value.trim() }); say(me.name, chat.value.trim()); chat.value = ''; } } });
  G.padsEl = h('div', { class: 'pads' });
  const co = me.role === 'cohost' ? h('div', { class: 'cohost-tools' }, h('h4', {}, 'Co-host controls'),
    h('button', { class: 'btn', onclick: () => { G.mesh.app('host', { kind: 'marker' }); toast('Marker sent'); } }, '⚑ Drop marker'), G.padsEl) : null;
  root.replaceChildren(h('div', { class: 'studio' },
    h('div', { class: 'transport' }, h('b', {}, G.info.show.title), G.timer, G.status, G.upload, h('span', { class: 'grow' }), micBtn, camBtn,
      h('button', { class: 'btn ghost', onclick: leave }, 'Leave')),
    h('div', { class: 'studio-main' }, G.stage, h('div', { class: 'side' }, h('div', { class: 'side-body' }, co, h('h4', {}, 'Chat'), G.log, chat)))));
  tile('me', me.name + ' (you)', me.role, true).video.srcObject = G.stream;
  G.mesh = new Mesh({
    iceServers: G.info.ice, signalUrl: '/g/signal?' + qs, getLocalStream: () => G.stream,
    onHello: m => applyRec(m.rec),
    onStream: (id, stream, peer) => { const t = G.tiles.get(id) || tile(id, peer ? peer.name : 'Guest', peer ? peer.role : ''); t.video.srcObject = stream; t.video.play().catch(() => {}); },
    onLeave: id => { const t = G.tiles.get(id); if (t) { t.remove(); G.tiles.delete(id); } },
    onPeer: p => say('studio', `${p.name} joined`),
    onMessage: m => {
      if (m.type === 'rec') applyRec(m.action === 'stop' ? null : m.rec, m.action);
      else if (m.type === 'app' && m.app.kind === 'chat') say(m.name, m.app.text);
      else if (m.type === 'app' && m.app.kind === 'pads' && G.padsEl) G.padsEl.replaceChildren(...m.app.pads.map((p, i) => h('button', { class: 'pad ready', disabled: !p.ready, style: { '--pad': p.color || '#7c5cff' }, onclick: () => G.mesh.app('host', { kind: 'pad', i }) }, h('span', {}, p.label || 'Pad ' + (i + 1)))));
    },
    onStatus: s => { if (s === 'replaced') { G.status.textContent = 'Opened in another tab'; G.status.className = 'pill warn'; } else if (s === 'reconnecting' && !G.rec) { G.status.textContent = 'Reconnecting…'; } else if (s === 'online' && !G.rec) G.status.textContent = 'Connected — not recording'; },
  });
  G.mesh.connect('/g/events?' + qs);
  window.addEventListener('beforeunload', e => { if (G.rec || G.uploading) { e.preventDefault(); e.returnValue = ''; } });
}
const say = (who, text) => { G.log.append(h('p', {}, h('b', {}, who + ': '), text)); G.log.scrollTop = G.log.scrollHeight; };

function applyRec(rec, action) {
  const was = G.rec; G.rec = rec;
  if (rec && !was) {
    const up = rec.id + '_' + (Date.now() % 100000);
    const tracks = [G.mic]; if (!G.cam._avatar) tracks.push(G.cam);
    const r = G.recorder = new ChunkRecorder(new MediaStream(tracks), { rec, beginUrl: '/g/begin?' + qs, chunkUrl: seq => `/g/chunk?${qs}&up=${up}&seq=${seq}`, finishUrl: '/g/finish?' + qs,
      onProgress: b => { G.upload.textContent = `Your track: ${(b / 1e6).toFixed(1)} MB sent`; } });
    r.up = up;
    r.start({ up, offset: recTime(rec) }).catch(fail);
  } else if (!rec && was && G.recorder) {
    const r = G.recorder; G.recorder = null; G.uploading = true;
    G.upload.textContent = 'Finishing upload — keep this tab open…';
    r.stop({ up: r.up }).then(ok => { G.uploading = false; G.upload.textContent = ok ? 'Upload finished ✓' : 'Some of your track could not be uploaded.'; toast(ok ? 'Your recording is safely with the host.' : 'Upload problem — tell the host.', ok ? 'ok' : 'err', 8000); });
  } else if (rec && G.recorder) { if (rec.paused) G.recorder.pause(); else G.recorder.resume(); }
  if (G.status) { G.status.textContent = rec ? (rec.paused ? 'PAUSED' : 'ON AIR · REC') : 'Connected — not recording'; G.status.className = 'pill ' + (rec ? (rec.paused ? 'warn' : 'live') : ''); }
}

function leave() {
  if (G.rec || G.uploading) return toast('The recording is still running or uploading — wait for “Upload finished”.', 'err');
  G.mesh.close(); G.stream.getTracks().forEach(t => t.stop());
  root.replaceChildren(h('div', { class: 'card lobby' }, h('h2', {}, 'You have left the studio'), h('p', { class: 'muted' }, 'You can close this tab.')));
}
