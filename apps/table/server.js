#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Table - LAN play for the Session Master. No npm packages: Node.js core only.
//
//  Players (any device on the same network):  http://<this computer>:7777/
//  Session Master console (this computer only): http://localhost:7777/sm/
'use strict';
const http = require('http'), fs = require('fs'), fsp = fs.promises, path = require('path'), crypto = require('crypto'), os = require('os');
const Dice = require('./dice');

const PORT = +process.env.IPRPS_TABLE_PORT || 7777;
const BIND = process.env.IPRPS_TABLE_BIND || '0.0.0.0';
const STATE_DIR = (process.env.STATE_DIRECTORY || process.env.IPRPS_TABLE_STATE || '/var/lib/iprps-table').split(':')[0];
const PUB = path.join(__dirname, 'public');
const MEDIA = path.join(STATE_DIR, 'media');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const PRESET_FILES = [process.env.IPRPS_TABLE_PRESETS, '/etc/iprps-table/presets.json', path.join(__dirname, 'dice-presets.json')].filter(Boolean);
const MB = 1 << 20;
const LIM = { players: 40, text: 2000, history: 3000, att: 6, name: 32,
  playerUpload: (+process.env.IPRPS_TABLE_PLAYER_MB || 15) * MB, smUpload: (+process.env.IPRPS_TABLE_SM_MB || 1024) * MB,
  mediaTotal: (+process.env.IPRPS_TABLE_MEDIA_GB || 8) * 1024 * MB };

// Allowed media. Nothing else is accepted (no SVG/HTML: they could run scripts).
const TYPES = { 'image/png': 'image', 'image/jpeg': 'image', 'image/gif': 'image', 'image/webp': 'image',
  'audio/mpeg': 'audio', 'audio/ogg': 'audio', 'audio/wav': 'audio', 'audio/webm': 'audio', 'audio/mp4': 'audio', 'audio/aac': 'audio', 'audio/flac': 'audio',
  'video/mp4': 'video', 'video/webm': 'video', 'video/ogg': 'video' };
const ALIAS = { 'image/jpg': 'image/jpeg', 'audio/mp3': 'audio/mpeg', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4', 'audio/x-flac': 'audio/flac', 'audio/x-aac': 'audio/aac', 'video/quicktime': 'video/mp4' };
const EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/ogg', wav: 'audio/wav', weba: 'audio/webm', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', mp4: 'video/mp4', m4v: 'video/mp4',
  mov: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg' };
const STATIC = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const COLORS = ['#e8b04a', '#4fc3c7', '#e0675f', '#8fd16a', '#b48cf0', '#f08cc4', '#6aa8f0', '#f0a36a', '#c7d96a', '#6af0c8'];

// ---------------------------------------------------------------- state
let S = { table: { name: 'Tonight\'s campaign', open: false, locked: false, code: '' }, players: {}, groups: {}, messages: [], media: {}, stage: {}, audio: {}, seq: 1 };
const nextId = p => `${p}${(S.seq++).toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await fsp.writeFile(STATE_FILE + '.tmp', JSON.stringify(S)); await fsp.rename(STATE_FILE + '.tmp', STATE_FILE); }
    catch (e) { console.error('save failed:', e.message); }
  }, 800);
}
function load() {
  fs.mkdirSync(MEDIA, { recursive: true, mode: 0o750 });
  try { S = Object.assign(S, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); } catch {}
  S.table.open = false;                       // a restart always starts with the table closed
  for (const m of Object.values(S.media)) if (!fs.existsSync(path.join(MEDIA, m.id))) delete S.media[m.id];
}
let PRESETS = { presets: [], weapons: [] };
const presetsOut = () => ({ presets: PRESETS.presets, weapons: PRESETS.weapons, kinds: Dice.KINDS });
function loadPresets() {
  for (const f of PRESET_FILES) {
    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); PRESETS = { presets: j.presets || [], weapons: j.weapons || [], from: f }; return; }
    catch (e) { if (e.code !== 'ENOENT') console.error(`${f}: ${e.message}`); }
  }
}

// ---------------------------------------------------------------- who can see what
// aud: '*' everyone, 'players' every player (not the SM), or a list of ids ('sm' = Session Master).
const sees = (aud, who) => aud === '*' || (aud === 'players' ? who !== 'sm' : Array.isArray(aud) && aud.includes(who));
// Media: the uploader always sees it; sending or pushing it widens who else may (all / players / listed ids).
const canSeeMedia = (m, who) => !!m && (m.owner === who || m.all || (m.players && who !== 'sm') || (m.ids || []).includes(who));
function grant(mediaIds, aud) {
  for (const id of mediaIds) {
    const m = S.media[id]; if (!m) continue;
    if (aud === '*') m.all = true;
    else if (aud === 'players') m.players = true;
    else m.ids = [...new Set([...(m.ids || []), ...aud])];
  }
}

// ---------------------------------------------------------------- live connections (Server-Sent Events)
const clients = new Set();                  // { res, who }
const online = id => [...clients].some(c => c.who === id);
function send(c, ev, data) { try { c.res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} }
function emit(filter, ev, data) { for (const c of clients) if (filter(c.who)) send(c, ev, typeof data === 'function' ? data(c.who) : data); }

const pubPlayer = p => ({ id: p.id, name: p.name, character: p.character, color: p.color, online: online(p.id) });
const smPlayer = p => ({ ...pubPlayer(p), device: p.device, ip: p.ip, joinedAt: p.joinedAt, lastSeen: online(p.id) ? Date.now() : p.lastSeen,
  groups: Object.values(S.groups).filter(g => g.members.includes(p.id)).map(g => g.id) });
const roster = who => Object.values(S.players).map(who === 'sm' ? smPlayer : pubPlayer);
const nameOf = id => (id === 'sm' ? 'Session Master' : S.players[id] ? S.players[id].name : 'Someone who left');
function viewMsg(m, who) {
  const v = { ...m }; delete v.aud;
  v.att = (m.att || []).map(id => S.media[id]).filter(Boolean).map(x => ({ id: x.id, kind: x.kind, type: x.type, name: x.name, size: x.size }));
  return v;
}
function pushRoster() { emit(() => true, 'roster', roster); }
function tableInfo(who) {
  const t = { name: S.table.name, open: S.table.open, locked: S.table.locked };
  if (who === 'sm') Object.assign(t, { code: S.table.code, port: PORT, addresses: lanAddresses(), presetsFrom: PRESETS.from });
  return t;
}
function snapshot(who) {
  return {
    me: who === 'sm' ? { id: 'sm', name: 'Session Master' } : pubPlayer(S.players[who]),
    table: tableInfo(who), roster: roster(who),
    groups: who === 'sm' ? Object.values(S.groups) : undefined,
    messages: S.messages.filter(m => sees(m.aud, who) || m.from === who).slice(-300).map(m => viewMsg(m, who)),
    stage: who === 'sm' ? null : S.stage[who] || null, audio: who === 'sm' ? null : S.audio[who] || null,
    media: who === 'sm' ? mediaLibrary() : undefined, presets: presetsOut(),
  };
}
const mediaLibrary = () => Object.values(S.media).filter(m => m.owner === 'sm').sort((a, b) => b.ts - a.ts)
  .map(({ id, kind, type, name, size, ts }) => ({ id, kind, type, name, size, ts }));

function lanAddresses() {
  const out = [];
  for (const [ifname, list] of Object.entries(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ ifname, address: a.address });
  return out;
}

// ---------------------------------------------------------------- messages
function post(from, kind, text, att, aud, to, extra = {}) {
  const m = { id: nextId('m'), ts: Date.now(), from, fromName: nameOf(from), kind, text: text || '', att: att || [], aud, to, ...extra };
  if (from !== 'sm' && S.players[from]) m.fromCharacter = S.players[from].character, m.color = S.players[from].color;
  grant(m.att, aud);
  S.messages.push(m);
  if (S.messages.length > LIM.history) S.messages.splice(0, S.messages.length - LIM.history);
  emit(who => sees(aud, who) || who === from, 'msg', who => viewMsg(m, who));
  save();
  return m;
}
const system = text => post('sm', 'system', text, [], '*', { type: 'all', label: 'Everyone' });

// Who a message goes to, from what the sender picked.
function audience(from, to) {
  const t = (to && to.type) || 'all';
  if (from === 'sm') {
    if (t === 'all') return ['*', { type: 'all', label: 'Everyone' }];
    if (t === 'group') {
      const g = S.groups[to.id]; if (!g) throw httpErr(400, 'That group no longer exists');
      return [['sm', ...g.members], { type: 'group', id: g.id, label: `Group: ${g.name}` }];
    }
    const ids = (Array.isArray(to.ids) ? to.ids : [to.id]).filter(id => S.players[id]);
    if (!ids.length) throw httpErr(400, 'Choose at least one player');
    return [['sm', ...ids], { type: 'select', ids, label: ids.length === 1 ? `Private: ${nameOf(ids[0])}` : `To ${ids.map(nameOf).join(', ')}` }];
  }
  if (t === 'all') return ['*', { type: 'all', label: 'Everyone' }];
  if (t === 'players') return ['players', { type: 'players', label: 'Players only' }];
  if (t === 'sm') return [[from, 'sm'], { type: 'sm', label: 'Private: Session Master' }];
  if (t === 'player' && S.players[to.id] && to.id !== from) return [[from, to.id], { type: 'player', id: to.id, label: `Private: ${nameOf(to.id)}` }];
  throw httpErr(400, 'Choose who gets the message');
}

// ---------------------------------------------------------------- HTTP helpers
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
function json(res, status, obj, headers = {}) { res.writeHead(status, { ...SEC, 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); }
function readJson(req, max = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { reject(httpErr(413, 'Too much data')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch { reject(httpErr(400, 'Bad request')); } });
    req.on('error', reject);
  });
}
const LOOP = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function isSM(req) {
  if (!LOOP.has(req.socket.remoteAddress)) return false;
  const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';      // blocks DNS-rebinding tricks
}
function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
function playerOf(req) {
  const tok = cookies(req).iprps_table; if (!tok) return null;
  const h = hash(tok);
  return Object.values(S.players).find(p => p.tokenHash === h) || null;
}
function device(ua = '') {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'Tablet';
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return 'Phone';
  if (/Windows|Macintosh|Linux|CrOS|X11/i.test(ua)) return 'Computer';
  return 'Device';
}
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);

// Simple per-key rate limiter: n events per window.
const buckets = new Map();
function limited(key, n, ms) {
  const now = Date.now(), b = (buckets.get(key) || []).filter(t => now - t < ms);
  b.push(now); buckets.set(key, b);
  return b.length > n;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (!b.some(t => now - t < 600000)) buckets.delete(k); }, 600000).unref();

// ---------------------------------------------------------------- static files
async function serveStatic(res, file) {
  const full = path.join(PUB, file);
  if (!full.startsWith(PUB + path.sep)) throw httpErr(404, 'Not found');
  let data; try { data = await fsp.readFile(full); } catch { throw httpErr(404, 'Not found'); }
  res.writeHead(200, { ...SEC, 'Content-Type': STATIC[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(data);
}

// ---------------------------------------------------------------- media upload + download
function upload(req, res, who) {
  const max = who === 'sm' ? LIM.smUpload : LIM.playerUpload;
  let name = 'file'; try { name = clean(decodeURIComponent(req.headers['x-filename'] || 'file'), 120) || 'file'; } catch {}
  let type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  type = ALIAS[type] || type;
  if (!TYPES[type]) type = EXT[(name.split('.').pop() || '').toLowerCase()] || type;
  const kind = TYPES[type];
  if (!kind) return req.resume(), json(res, 415, { ok: false, error: 'Use an image (PNG, JPEG, GIF, WebP), audio (MP3, OGG, WAV, M4A, FLAC) or video (MP4, WebM).' });
  if (kind === 'video' && who !== 'sm') return req.resume(), json(res, 415, { ok: false, error: 'Players can share images and audio.' });
  const len = +req.headers['content-length'] || 0;
  if (len > max) return req.resume(), json(res, 413, { ok: false, error: `That file is too big (limit ${Math.round(max / MB)} MB).` });
  const used = Object.values(S.media).reduce((a, m) => a + m.size, 0);
  if (used + len > LIM.mediaTotal) return req.resume(), json(res, 507, { ok: false, error: 'The table has no room for more media. The Session Master can delete some in the console.' });
  const id = nextId('f'), file = path.join(MEDIA, id), out = fs.createWriteStream(file, { mode: 0o640 });
  let size = 0, failed = false;
  const fail = (status, error) => { if (failed) return; failed = true; out.destroy(); fs.unlink(file, () => {}); json(res, status, { ok: false, error }); req.resume(); };
  req.on('data', c => { size += c.length; if (size > max) fail(413, `That file is too big (limit ${Math.round(max / MB)} MB).`); });
  req.on('aborted', () => fail(400, 'Upload interrupted'));
  out.on('error', () => fail(500, 'Could not save the file'));
  out.on('finish', () => {
    if (failed) return;
    if (!size) { fs.unlink(file, () => {}); return json(res, 400, { ok: false, error: 'The file is empty' }); }
    S.media[id] = { id, owner: who, kind, type, name, size, ts: Date.now(), ids: [] };
    save();
    if (who === 'sm') emit(w => w === 'sm', 'library', mediaLibrary);
    json(res, 200, { ok: true, media: { id, kind, type, name, size } });
  });
  req.pipe(out);
}
async function serveMedia(req, res, who, id) {
  const m = S.media[id];
  if (!m || !canSeeMedia(m, who)) throw httpErr(404, 'Not found');
  const file = path.join(MEDIA, m.id), size = (await fsp.stat(file)).size;
  const head = { ...SEC, 'Content-Type': m.type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600',
    'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(m.name)}` };
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (r && (r[1] || r[2])) {
    let start = r[1] ? +r[1] : size - +r[2], end = r[1] && r[2] ? Math.min(+r[2], size - 1) : size - 1;
    if (start < 0) start = 0;
    if (start >= size || start > end) { res.writeHead(416, { ...head, 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, 'Content-Length': size });
  return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
}
function deleteMedia(id) {
  const m = S.media[id]; if (!m) return;
  delete S.media[id]; fs.unlink(path.join(MEDIA, id), () => {});
}

// ---------------------------------------------------------------- events stream
function openEvents(req, res, who) {
  res.writeHead(200, { ...SEC, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  const c = { res, who };
  const wasOnline = who !== 'sm' && online(who);
  clients.add(c);
  send(c, 'hello', snapshot(who));
  if (who !== 'sm' && !wasOnline) { S.players[who].lastSeen = Date.now(); pushRoster(); }
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  req.on('close', () => {
    clearInterval(ping); clients.delete(c);
    if (who !== 'sm' && S.players[who]) { S.players[who].lastSeen = Date.now(); if (!online(who)) { pushRoster(); save(); } }
  });
}
function dropPlayers(ev, data, filter = () => true) {
  for (const c of [...clients]) if (c.who !== 'sm' && filter(c.who)) { send(c, ev, data); c.res.end(); clients.delete(c); }
}

// ---------------------------------------------------------------- dice
function rollDice(body) {
  if (body.preset) {
    const p = PRESETS.presets.find(x => x.id === body.preset) || (body.preset.startsWith('weapon:') && (() => {
      const w = PRESETS.weapons.find(x => x.name === body.preset.slice(7)); return w && { kind: 'weapon', expr: w.expr, label: w.name };
    })());
    if (!p) throw new Error('Unknown roll');
    return { ...Dice.rollPreset(p, body.params || {}), label: p.label };
  }
  const r = Dice.rollExpr(body.expr);
  return { ...r, label: r.expr };
}
function doRoll(who, body) {
  let r;
  try { r = rollDice(body); } catch (e) { throw httpErr(400, e.message); }
  const label = r.label;
  const vis = body.vis === 'self' ? 'self' : body.vis === 'sm' && who !== 'sm' ? 'sm' : 'all';
  const aud = vis === 'all' ? '*' : vis === 'sm' ? [who, 'sm'] : [who];
  const to = { all: { type: 'all', label: 'Everyone' }, sm: { type: 'sm', label: 'Only the Session Master' }, self: { type: 'self', label: who === 'sm' ? 'Secret roll' : 'Only me' } }[vis];
  return post(who, 'roll', clean(body.note, 200), [], aud, to, { roll: { label, total: r.total, detail: r.detail, lines: r.lines || [] } });
}

// ---------------------------------------------------------------- stage and audio pushes (Session Master)
function targets(t) {
  const ids = Object.keys(S.players);
  if (!t || t.type === 'all') return ids;
  if (t.type === 'group') return (S.groups[t.id] || { members: [] }).members.filter(id => S.players[id]);
  return (t.ids || []).filter(id => S.players[id]);
}
function pushStage(body) {
  const ids = targets(body.target);
  if (!ids.length) throw httpErr(400, 'No players to send to');
  let item = null;
  if (body.kind !== 'clear') {
    const m = body.media && S.media[body.media];
    if (body.kind === 'text') item = { kind: 'text', text: clean(body.text, 4000), title: clean(body.title, 120) };
    else if (m && (m.kind === 'image' || m.kind === 'video')) item = { kind: m.kind, media: m.id, type: m.type, name: m.name, title: clean(body.title, 120) };
    else throw httpErr(400, 'Choose an image or video');
    if (item.media) grant([item.media], ids);
    item.ts = Date.now();
  }
  for (const id of ids) S.stage[id] = item;
  emit(w => ids.includes(w), 'stage', item);
  save();
  return ids.length;
}
function pushAudio(body) {
  const ids = targets(body.target);
  if (!ids.length) throw httpErr(400, 'No players to send to');
  let item = null;
  if (body.action !== 'stop') {
    const m = S.media[body.media];
    if (!m || (m.kind !== 'audio' && m.kind !== 'video')) throw httpErr(400, 'Choose an audio track');
    grant([m.id], ids);
    item = { media: m.id, type: m.type, name: m.name, loop: !!body.loop, volume: Math.max(0, Math.min(1, +body.volume || 0.8)), ts: Date.now() };
  }
  for (const id of ids) S.audio[id] = item;
  emit(w => ids.includes(w), 'audio', item);
  save();
  return ids.length;
}

// ---------------------------------------------------------------- routes
async function route(req, res) {
  const url = new URL(req.url, 'http://x'), p = url.pathname, method = req.method;
  const local = isSM(req);

  // ---- Session Master (this computer only)
  if (p === '/sm' ) { res.writeHead(302, { Location: '/sm/' }); return res.end(); }
  if (p === '/sm/' || p.startsWith('/api/sm/')) {
    if (!local) throw httpErr(403, 'The Session Master console only opens on the Session Master\'s computer.');
    if (p === '/sm/') return serveStatic(res, 'sm.html');
    if (p === '/api/sm/events') return openEvents(req, res, 'sm');
    if (method !== 'POST' || req.headers['x-iprps-sm'] !== '1') throw httpErr(400, 'Bad request');
    if (p === '/api/sm/upload') return upload(req, res, 'sm');
    const b = await readJson(req);
    switch (p) {
      case '/api/sm/table': {
        const t = S.table;
        if (b.name !== undefined) t.name = clean(b.name, 80) || 'Untitled campaign';
        if (b.locked !== undefined) t.locked = !!b.locked;
        if (b.newCode || (b.open && !t.code)) t.code = newCode();
        if (b.open !== undefined && !!b.open !== t.open) {
          t.open = !!b.open;
          if (!t.open) dropPlayers('closed', { message: 'The Session Master closed the table.' });
        }
        save();
        emit(w => w === 'sm', 'table', tableInfo('sm'));
        emit(w => w !== 'sm', 'table', tableInfo(''));
        return json(res, 200, { ok: true, table: tableInfo('sm') });
      }
      case '/api/sm/send': {
        const text = clean(b.text, LIM.text), att = (b.att || []).slice(0, LIM.att).filter(id => S.media[id] && S.media[id].owner === 'sm');
        if (!text && !att.length) throw httpErr(400, 'Type a message or attach a file');
        const [aud, to] = audience('sm', b.to);
        return json(res, 200, { ok: true, id: post('sm', 'msg', text, att, aud, to).id });
      }
      case '/api/sm/roll': return json(res, 200, { ok: true, id: doRoll('sm', b).id });
      case '/api/sm/push': return json(res, 200, { ok: true, sent: pushStage(b) });
      case '/api/sm/audio': return json(res, 200, { ok: true, sent: pushAudio(b) });
      case '/api/sm/group': {
        if (b.action === 'create') {
          const name = clean(b.name, 40); if (!name) throw httpErr(400, 'Name the group');
          const id = nextId('g'); S.groups[id] = { id, name, members: (b.members || []).filter(x => S.players[x]) };
        } else if (b.action === 'set' && S.groups[b.id]) {
          if (b.name !== undefined) S.groups[b.id].name = clean(b.name, 40) || S.groups[b.id].name;
          if (b.members) S.groups[b.id].members = b.members.filter(x => S.players[x]);
        } else if (b.action === 'delete') delete S.groups[b.id];
        save();
        emit(w => w === 'sm', 'groups', Object.values(S.groups)); pushRoster();
        return json(res, 200, { ok: true, groups: Object.values(S.groups) });
      }
      case '/api/sm/kick': {
        const pl = S.players[b.id]; if (!pl) throw httpErr(404, 'No such player');
        dropPlayers('kicked', { message: 'The Session Master removed you from the table.' }, w => w === pl.id);
        delete S.players[pl.id]; delete S.stage[pl.id]; delete S.audio[pl.id];
        for (const g of Object.values(S.groups)) g.members = g.members.filter(x => x !== pl.id);
        system(`${pl.name} left the table.`);
        pushRoster(); emit(w => w === 'sm', 'groups', Object.values(S.groups)); save();
        return json(res, 200, { ok: true });
      }
      case '/api/sm/media-delete': {
        deleteMedia(b.id); save();
        emit(w => w === 'sm', 'library', mediaLibrary);
        return json(res, 200, { ok: true });
      }
      case '/api/sm/reset': {
        // New session: clears the chat and everything shared. Players and groups stay unless "everything".
        dropPlayers('reset', { message: 'The Session Master started a new session.' }, () => b.everything);
        S.messages = []; S.stage = {}; S.audio = {};
        for (const m of Object.values(S.media)) if (m.owner !== 'sm' || b.everything) deleteMedia(m.id);
        if (b.everything) { S.players = {}; S.groups = {}; S.table.code = newCode(); }
        save();
        for (const c of clients) send(c, 'hello', snapshot(c.who));
        return json(res, 200, { ok: true });
      }
      case '/api/sm/reload-presets': loadPresets(); for (const c of clients) send(c, 'presets', presetsOut()); return json(res, 200, { ok: true, from: PRESETS.from });
    }
    throw httpErr(404, 'Not found');
  }

  // ---- static pages (anyone)
  if (method === 'GET' && (p === '/' || p === '/join')) return serveStatic(res, 'join.html');
  if (method === 'GET' && p === '/play') return serveStatic(res, 'player.html');
  if (method === 'GET' && p.startsWith('/assets/')) return serveStatic(res, p.slice(8));
  if (method === 'GET' && p === '/favicon.ico') { res.writeHead(302, { Location: '/assets/table-icon.svg' }); return res.end(); }
  if (method === 'GET' && p === '/api/info') {
    const me = playerOf(req);
    return json(res, 200, { ok: true, name: S.table.open ? S.table.name : '', open: S.table.open, locked: S.table.locked, joined: !!(me && S.table.open) });
  }

  // ---- players
  if (!p.startsWith('/api/') && !p.startsWith('/media/')) throw httpErr(404, 'Not found');
  const ip = req.socket.remoteAddress;
  if (p.startsWith('/media/')) {
    const me = local && url.searchParams.get('sm') === '1' ? 'sm' : (S.table.open ? (playerOf(req) || {}).id : null);
    if (!me) throw httpErr(404, 'Not found');
    return serveMedia(req, res, me, p.slice(7));
  }
  if (!S.table.open) throw httpErr(423, 'The table is closed. Wait for the Session Master to open it.');
  if (method === 'POST' && req.headers['x-iprps'] !== '1') throw httpErr(400, 'Bad request');

  if (p === '/api/join' && method === 'POST') {
    if (limited('join:' + ip, 8, 60000)) throw httpErr(429, 'Too many tries. Wait a minute and try again.');
    const b = await readJson(req, 4096);
    if (String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '') !== S.table.code) throw httpErr(403, 'That join code is not right. Ask the Session Master.');
    const name = clean(b.name, LIM.name), character = clean(b.character, 48);
    if (!name) throw httpErr(400, 'Type your name');
    const same = Object.values(S.players).find(x => x.name.toLowerCase() === name.toLowerCase());
    if (same && online(same.id)) throw httpErr(409, `Someone named ${name} is already at the table. Use another name.`);
    if (!same && S.table.locked) throw httpErr(403, 'The Session Master locked the table: no new players right now.');
    if (!same && Object.keys(S.players).length >= LIM.players) throw httpErr(403, 'The table is full.');
    const token = crypto.randomBytes(32).toString('hex');
    let pl = same;
    if (!pl) {
      const id = nextId('p');
      pl = S.players[id] = { id, name, joinedAt: Date.now(), color: COLORS[Object.keys(S.players).length % COLORS.length] };
    }
    Object.assign(pl, { name, character, tokenHash: hash(token), device: device(req.headers['user-agent']), ip: ip.replace(/^::ffff:/, ''), lastSeen: Date.now() });
    save();
    if (!same) system(`${name}${character ? ` (${character})` : ''} joined the table.`);
    pushRoster();
    return json(res, 200, { ok: true }, { 'Set-Cookie': `iprps_table=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000` });
  }

  const me = playerOf(req);
  if (!me) throw httpErr(401, 'Join the table first');
  if (p === '/api/p/events') return openEvents(req, res, me.id);
  if (method !== 'POST') throw httpErr(404, 'Not found');
  if (limited('act:' + me.id, 40, 10000)) throw httpErr(429, 'Slow down a little.');
  if (p === '/api/p/upload') {
    if (limited('up:' + me.id, 20, 60000)) throw httpErr(429, 'Too many files at once. Wait a minute.');
    return upload(req, res, me.id);
  }
  const b = await readJson(req);
  switch (p) {
    case '/api/p/send': {
      const text = clean(b.text, LIM.text), att = (b.att || []).slice(0, LIM.att).filter(id => S.media[id] && S.media[id].owner === me.id);
      if (!text && !att.length) throw httpErr(400, 'Type a message or attach a file');
      const [aud, to] = audience(me.id, b.to);
      return json(res, 200, { ok: true, id: post(me.id, 'msg', text, att, aud, to).id });
    }
    case '/api/p/roll': return json(res, 200, { ok: true, id: doRoll(me.id, b).id });
    case '/api/p/profile': {
      const character = clean(b.character, 48); me.character = character; save(); pushRoster();
      return json(res, 200, { ok: true });
    }
    case '/api/p/leave': {
      dropPlayers('left', { message: 'You left the table.' }, w => w === me.id);
      me.tokenHash = ''; save(); pushRoster();
      return json(res, 200, { ok: true }, { 'Set-Cookie': 'iprps_table=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
    }
  }
  throw httpErr(404, 'Not found');
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => {
    if (res.headersSent) { try { res.end(); } catch {} return; }
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (req.headers.accept && req.headers.accept.includes('text/html') && !req.url.startsWith('/api/')) {
      res.writeHead(status, { ...SEC, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(e.message);
    }
    json(res, status, { ok: false, error: status === 500 ? 'Something went wrong on the table computer' : e.message });
  });
});
server.requestTimeout = 0;                      // big uploads and the live events stream
server.headersTimeout = 30000;

load(); loadPresets();
let lastAddrs = JSON.stringify(lanAddresses());
setInterval(() => {                             // Wi-Fi reconnects can change the address players use
  const now = JSON.stringify(lanAddresses());
  if (now !== lastAddrs) { lastAddrs = now; emit(w => w === 'sm', 'table', tableInfo('sm')); }
}, 10000).unref();
server.listen(PORT, BIND, () => {
  console.log(`IPRPS Table listening on ${BIND}:${PORT} (state in ${STATE_DIR}, presets from ${PRESETS.from || 'nowhere'})`);
  for (const a of lanAddresses()) console.log(`  players: http://${a.address}:${PORT}/`);
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  clearTimeout(saveTimer);
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(S)); } catch {}
  process.exit(0);
});
