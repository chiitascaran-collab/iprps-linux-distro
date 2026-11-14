// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Web Audio building blocks: channel strips with EQ/compressor, meters, and chunk-uploading recorders.
export const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
export const EQ_PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Voice clarity': [-6, -3, -1, 0, -1, 0, 2, 3, 2, 1],
  'Radio host': [-4, 2, 3, 1, -2, -1, 2, 4, 3, 1],
  'Warm': [1, 2, 2, 1, 0, 0, -1, -1, -2, -2],
  'Bass cut': [-12, -8, -3, 0, 0, 0, 0, 0, 0, 0],
  'De-ess': [0, 0, 0, 0, 0, 0, 0, -2, -5, -3],
  'Remote guest fix': [-8, -4, 0, 1, 0, 1, 3, 3, 1, 0],
  'Music bed': [2, 2, 1, 0, -2, -3, -2, 0, 1, 1],
};

export function makeEq(ctx) {
  return EQ_FREQS.map(f => { const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = f; b.Q.value = 1.41; b.gain.value = 0; return b; });
}
export function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

export class Strip {
  constructor(ctx, name, o = {}) {
    this.ctx = ctx; this.name = name; this.vol = o.vol ?? 1; this.muted = false; this.eqVals = Array(10).fill(0);
    this.input = ctx.createGain();
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 10;
    this.eq = makeEq(ctx);
    this.comp = ctx.createDynamicsCompressor(); this.setComp(false);
    this.fader = ctx.createGain(); this.fader.gain.value = this.vol;
    this.pan = ctx.createStereoPanner();
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024;
    this.out = chain(this.input, this.hp, ...this.eq, this.comp, this.fader, this.pan);
    this.out.connect(this.analyser);
    this.buf = new Float32Array(1024); this.peakHold = -60; this.clipAt = 0;
  }
  setEq(i, db) { this.eqVals[i] = db; this.eq[i].gain.setTargetAtTime(db, this.ctx.currentTime, 0.02); }
  setEqAll(a) { a.forEach((v, i) => this.setEq(i, v || 0)); }
  setHp(on) { this.hpOn = on; this.hp.frequency.value = on ? 80 : 10; }
  setComp(on) { this.compOn = on; const c = this.comp; c.threshold.value = on ? -18 : 0; c.ratio.value = on ? 3 : 1; c.knee.value = on ? 12 : 0; c.attack.value = 0.008; c.release.value = 0.15; }
  setVol(v) { this.vol = v; this._apply(); }
  setMute(m) { this.muted = m; this._apply(); }
  setPan(p) { this.pan.pan.setTargetAtTime(p, this.ctx.currentTime, 0.02); }
  _apply() { this.fader.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.015); }
  level() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let pk = 0, sum = 0;
    for (let i = 0; i < this.buf.length; i++) { const v = Math.abs(this.buf[i]); if (v > pk) pk = v; sum += v * v; }
    const db = x => x > 1e-5 ? 20 * Math.log10(x) : -100;
    const peak = db(pk), rms = db(Math.sqrt(sum / this.buf.length));
    this.peakHold = Math.max(peak, this.peakHold - 0.35);
    if (pk >= 0.99) this.clipAt = performance.now();
    return { peak, rms, hold: this.peakHold, clip: performance.now() - this.clipAt < 1500 };
  }
}

// Draw a vertical broadcast-style meter (-60..0 dBFS) on a canvas.
export function drawMeter(cv, lv) {
  const g = cv.getContext('2d'), w = cv.width, hh = cv.height;
  const y = db => hh - Math.max(0, Math.min(1, (db + 60) / 60)) * hh;
  g.clearRect(0, 0, w, hh); g.fillStyle = '#0a0c10'; g.fillRect(0, 0, w, hh);
  const top = y(lv.rms + 3);
  const grad = g.createLinearGradient(0, hh, 0, 0);
  grad.addColorStop(0, '#2fbf7f'); grad.addColorStop(0.7, '#3ddc97'); grad.addColorStop(0.82, '#ffd166'); grad.addColorStop(0.95, '#ff4d5e');
  g.fillStyle = grad; g.fillRect(0, top, w, hh - top);
  g.fillStyle = lv.clip ? '#ff4d5e' : '#e8ebf2'; g.fillRect(0, y(lv.hold) - 1, w, 2);
  if (lv.clip) { g.fillStyle = '#ff4d5e'; g.fillRect(0, 0, w, 4); }
}

// ---- clock shared with the studio server so every participant's track lines up -------------
let clockOffset = 0;
export async function syncClock(url) {
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const t0 = performance.now(), d0 = Date.now();
    try {
      const j = await (await fetch(url, { cache: 'no-store' })).json();
      const rtt = performance.now() - t0;
      if (rtt < best) { best = rtt; clockOffset = j.now + rtt / 2 - (d0 + rtt); }
    } catch (e) { /* keep previous */ }
  }
  return clockOffset;
}
export const serverNow = () => Date.now() + clockOffset;
export const recTime = rec => rec ? Math.max(0, ((rec.paused ? rec.pausedAt : serverNow()) - rec.t0 - rec.pausedMs) / 1000) : 0;

export function pickMime(video) {
  const c = video ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'] : ['audio/webm;codecs=opus', 'audio/webm'];
  return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

// Records a MediaStream locally and uploads it to the studio in small chunks while recording,
// so a dropped connection or a closed tab loses seconds, not the whole take.
export class ChunkRecorder {
  constructor(stream, o) {
    this.o = o; this.seq = 0; this.queue = Promise.resolve(); this.sent = 0; this.failed = false;
    const video = stream.getVideoTracks().length > 0;
    this.mr = new MediaRecorder(stream, { mimeType: pickMime(video), audioBitsPerSecond: 192000, videoBitsPerSecond: o.videoBps || 2500000 });
    this.mr.ondataavailable = e => { if (e.data && e.data.size) this._push(e.data); };
    this.stopped = new Promise(r => { this.mr.onstop = r; });
    this.mr.onstart = () => { this.startedAt = serverNow(); };
  }
  // Where this take begins on the session timeline (seconds), excluding paused time.
  offset() { const r = this.o.rec; return r && this.startedAt ? Math.max(0, (this.startedAt - r.t0 - (this.pausedMsAtStart || 0)) / 1000) : 0; }
  _push(blob) {
    const seq = this.seq++;
    this.queue = this.queue.then(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const r = await fetch(this.o.chunkUrl(seq), { method: 'POST', body: blob });
          if (r.ok) { this.sent += blob.size; this.o.onProgress && this.o.onProgress(this.sent); return; }
          if (r.status === 404 || r.status === 403) break;
        } catch (e) { /* retry */ }
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
      this.failed = true;
    });
  }
  async start(meta) {
    const r = await fetch(this.o.beginUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta) });
    if (!r.ok) throw new Error('Could not start the recording upload.');
    this.pausedMsAtStart = this.o.rec ? this.o.rec.pausedMs : 0;
    this.mr.start(3000);
  }
  pause() { if (this.mr.state === 'recording') this.mr.pause(); }
  resume() { if (this.mr.state === 'paused') this.mr.resume(); }
  async stop(finishBody) {
    if (this.mr.state !== 'inactive') { this.mr.stop(); await this.stopped; }
    await this.queue;
    await fetch(this.o.finishUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offset: this.offset(), ...finishBody }) }).catch(() => {});
    return !this.failed;
  }
}

// A branded placeholder video track (used when a participant has no camera, and for AI cast).
export function avatarTrack(name, color = '#7c5cff', bg = '#151922') {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
  const g = cv.getContext('2d');
  const paint = () => {
    g.fillStyle = bg; g.fillRect(0, 0, 640, 360);
    g.fillStyle = color; g.beginPath(); g.arc(320, 160, 70, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '600 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((name || '?').trim().slice(0, 1).toUpperCase(), 320, 164);
    g.font = '500 26px system-ui, sans-serif'; g.fillText(name || '', 320, 280);
  };
  paint();
  const timer = setInterval(paint, 500);      // keep frames flowing so recorders and peers get video
  const track = cv.captureStream(5).getVideoTracks()[0];
  track._stopAvatar = () => clearInterval(timer);
  track._avatar = true;
  return track;
}
