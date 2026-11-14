#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Link - remote players join the IPRPS Table from any browser. No npm packages: Node.js core only.
//
//  This service runs on the Session Master's computer. It dials OUT to an IPRPS Link relay (no router
//  setup, no open ports), takes the requests remote players make to the relay's public address, and
//  makes them to the IPRPS Table on this computer, so remote players are players like any others.
//
//  Console (this computer only): http://localhost:7778/
//  It never forwards the Session Master console (/sm/, /api/sm/): the Table refuses it too.
'use strict';
const http = require('http'), https = require('https'), net = require('net'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const VERSION = '1.0.0';
const PORT = +process.env.IPRPS_LINK_PORT || 7778;
const BIND = process.env.IPRPS_LINK_BIND || '127.0.0.1';
const TABLE = new URL(process.env.IPRPS_LINK_TABLE || 'http://127.0.0.1:7777');
const STATE_DIR = (process.env.STATE_DIRECTORY || process.env.IPRPS_LINK_STATE || '/var/lib/iprps-link').split(':')[0];
const CONF_FILE = path.join(STATE_DIR, 'config.json');
const PUB = path.join(__dirname, 'public');
const QR_JS = process.env.IPRPS_LINK_QR || path.join(__dirname, '..', 'table', 'public', 'qr.js');
const DEFAULT_AUTH = 'https://infiniteplane.space/auth/';
const MAX_BODY = 20 << 20, REWRITE_MAX = 6 << 20, CHUNK = 256 << 10, SSE_BUFFER = 4 << 20;

// ---------------------------------------------------------------- settings + state
let C = { relay: '', auth: DEFAULT_AUTH, token: '', user: null, enabled: false };
const ST = { status: 'off', error: '', url: '', table: '', relayKind: '', burst: false, since: 0, requests: 0, bytesOut: 0, bytesIn: 0, players: new Map(), log: [] };
let session = null, generation = 0, authState = '';

function loadConf() {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  try { C = Object.assign(C, JSON.parse(fs.readFileSync(CONF_FILE, 'utf8'))); } catch {}
  if (process.env.IPRPS_LINK_RELAY && !C.relay) C.relay = process.env.IPRPS_LINK_RELAY;
}
function saveConf() {
  fs.writeFileSync(CONF_FILE + '.tmp', JSON.stringify(C, null, 1), { mode: 0o600 });
  fs.renameSync(CONF_FILE + '.tmp', CONF_FILE);
}
function log(msg) {
  ST.log.push({ t: Date.now(), msg }); if (ST.log.length > 60) ST.log.shift();
  console.log(msg);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanUrl = (u, slash) => { u = String(u || '').trim().replace(/\/+$/, ''); return u ? u + (slash ? '/' : '') : ''; };

// ---------------------------------------------------------------- small HTTP client (relay + auth)
const agents = { 'http:': new http.Agent({ keepAlive: true, maxSockets: 32 }), 'https:': new https.Agent({ keepAlive: true, maxSockets: 32 }) };
function call(method, url, { headers = {}, body = null, timeout = 40000, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), lib = u.protocol === 'https:' ? https : http;
    const h = { 'User-Agent': 'IPRPS-Link/' + VERSION, ...headers };
    if (body != null) h['Content-Length'] = Buffer.byteLength(body);
    const req = lib.request(u, { method, headers: h, agent: agents[u.protocol] }, res => {
      if (stream) return resolve(res);
      const parts = []; res.on('data', c => parts.push(c));
      res.on('end', () => { const buf = Buffer.concat(parts); let json = null; try { json = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, headers: res.headers, body: buf, json }); });
      res.on('error', reject);
    });
    req.setTimeout(timeout, () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    req.end(body != null ? body : undefined);
  });
}

// ---------------------------------------------------------------- Infinite Plane account
async function whoIs(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('That is not a sign-in token.');
  const r = await call('POST', cleanUrl(C.auth, true) + 'auth.php', { headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token }, body: JSON.stringify({ action: 'me' }), timeout: 20000 });
  if (!r.json || !r.json.ok || !r.json.user) throw new Error('The Infinite Plane sign-in was not accepted. Sign in again.');
  return r.json.user;
}

// ---------------------------------------------------------------- what remote players may reach, and how it looks to them
// The Table uses absolute paths (/api/..., /assets/...). Behind the relay it lives at <base>/, so its pages and
// scripts get those paths prefixed on the way out. Nothing in IPRPS OS is changed.
const REWRITE_TYPES = /^(text\/html|text\/javascript|application\/javascript)/;
const PATHS = /(["'`])\/(api\/|assets\/|media\/|sheet\/|play(?=["'`?#])|join(?=["'`?#])|favicon\.ico)/g;
const rewriteText = (text, base) => text.replace(PATHS, (m, q, p) => q + base + '/' + p)
  .replace(/Check that you are on the same Wi-Fi network\./g, 'Check your internet connection, or ask the Session Master whether remote play is on.');
function blocked(p) {
  let n; try { n = new URL(p, 'http://x').pathname; } catch { return true; }
  try { n = decodeURIComponent(n); } catch { return true; }
  n = n.replace(/\/+/g, '/').toLowerCase();
  return n === '/sm' || n.startsWith('/sm/') || n.startsWith('/api/sm');
}
const PASS_REQ = ['accept', 'content-type', 'range', 'if-none-match', 'if-modified-since', 'if-range', 'user-agent', 'x-iprps', 'x-filename', 'accept-language'];
const DROP_RES = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'date', 'x-accel-buffering']);
function responseHead(up, s) {
  const headers = {};
  for (const [k, v] of Object.entries(up.headers)) {
    if (DROP_RES.has(k)) continue;
    if (k === 'location') headers[k] = String(v).startsWith('/') ? s.base + v : v;
    else if (k === 'set-cookie') headers[k] = [].concat(v).map(c => c.replace(/;\s*Path=\/(?=;|$)/i, `; Path=${s.base}/`) + (s.secure && !/;\s*Secure/i.test(c) ? '; Secure' : ''));
    else headers[k] = v;
  }
  return { status: up.statusCode, headers };
}
// Each remote player reaches the Table from their own loopback address (127.77.x.y), so the Table's
// per-address limits and the console's address column tell them apart. Never 127.0.0.1: that one is the Session Master.
let canBind = false;
function sourceFor(client) {
  if (!canBind) return undefined;
  const h = crypto.createHash('sha256').update(String(client)).digest();
  return `127.77.${h[0]}.${1 + h[1] % 254}`;
}
function tableRequest(r, body) {
  const headers = { Host: 'remote.iprps-link' };                       // never "localhost": the Table reserves that for the console
  for (const k of PASS_REQ) if (r.headers[k] != null) headers[k] = r.headers[k];
  const ck = /(?:^|;\s*)iprps_table=([^;]*)/.exec(r.headers.cookie || '');
  if (ck) headers.Cookie = 'iprps_table=' + ck[1];
  if (body) headers['Content-Length'] = body.length;
  return http.request({ host: TABLE.hostname, port: TABLE.port || 80, path: r.path, method: r.method, headers, localAddress: sourceFor(r.client) });
}

// ---------------------------------------------------------------- sending a response back through the relay
// One POST at a time per response, in order; whatever arrives meanwhile is sent together in the next one.
class Sender {
  constructor(s, id) { this.s = s; this.id = id; this.seq = 0; this.q = []; this.size = 0; this.head = null; this.busy = false; this.ended = false; this.gone = false; this.onGone = null; this.onDrain = null; }
  start(head) { this.head = head; this.pump(); }
  write(buf) { if (this.gone || this.ended) return; this.q.push(buf); this.size += buf.length; this.pump(); }
  end(buf) { if (buf) this.write(buf); this.ended = true; this.pump(); }
  get full() { return this.size > 4 * CHUNK; }
  async pump() {
    if (this.busy || this.gone) return;
    if (!this.head && !this.q.length && !this.ended) return;
    if (this.done) return;
    this.busy = true;
    let take = 0, parts = [];
    while (this.q.length && take < 2 * CHUNK) { const b = this.q.shift(); parts.push(b); take += b.length; }
    this.size -= take;
    const last = this.ended && !this.q.length;
    const headers = { 'X-Link-Key': this.s.key, 'Content-Type': 'application/octet-stream' };
    if (this.head) { headers['X-Link-Head'] = Buffer.from(JSON.stringify(this.head)).toString('base64'); this.head = null; }
    const seq = this.seq++, data = Buffer.concat(parts);
    const url = `${this.s.api}chunk?table=${this.s.table}&id=${this.id}&seq=${seq}${last ? '&end=1' : ''}`;
    let ok = false;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      try {
        const r = await call('POST', url, { headers, body: data, timeout: 60000 });
        if (r.status === 200 && r.json) { ok = true; if (r.json.gone) this.gone = true; }
        else if (r.status === 401 || r.status === 404 || r.status === 410) { this.gone = true; ok = true; }
        else await sleep(400 * (attempt + 1));
      } catch { await sleep(400 * (attempt + 1)); }
    }
    if (!ok) this.gone = true;
    ST.bytesOut += take;
    this.busy = false;
    if (last) this.done = true;
    if (this.gone) { this.q = []; this.size = 0; this.onGone && this.onGone(); return; }
    if (!this.full && this.onDrain) this.onDrain();
    this.pump();
  }
}
function fail(s, id, status, message) {
  const body = Buffer.from(JSON.stringify({ ok: false, error: message }));
  const snd = new Sender(s, id); snd.start({ status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'content-length': String(body.length) } }); snd.end(body);
}

// ---------------------------------------------------------------- one remote request
async function handle(s, r) {
  ST.requests++;
  if (r.client) ST.players.set(r.client, Date.now());
  if (typeof r.path !== 'string' || !r.path.startsWith('/') || blocked(r.path)) return fail(s, r.id, 403, 'The Session Master console only opens on the Session Master\'s computer.');
  if (r.method === 'GET' && /text\/event-stream/.test(r.headers.accept || '')) return events(s, r);
  let body = null;
  if (r.hasBody) {
    try {
      const b = await call('GET', `${s.api}body?table=${s.table}&id=${r.id}`, { headers: { 'X-Link-Key': s.key }, timeout: 120000 });
      if (b.status !== 200) throw new Error('no body');
      body = b.body; ST.bytesIn += body.length;
      if (body.length > MAX_BODY) return fail(s, r.id, 413, 'That is too much data.');
    } catch { return fail(s, r.id, 502, 'The upload did not arrive. Try again.'); }
  }
  const snd = new Sender(s, r.id);
  const up = tableRequest(r, body);
  up.setTimeout(120000, () => up.destroy(new Error('timeout')));
  up.on('error', () => { if (!snd.seq && !snd.busy) fail(s, r.id, 502, 'The IPRPS Table is not running on the Session Master\'s computer.'); else snd.end(); });
  up.on('response', res => {
    const head = responseHead(res, s);
    const type = String(res.headers['content-type'] || ''), len = +res.headers['content-length'] || 0;
    if (REWRITE_TYPES.test(type) && len <= REWRITE_MAX && r.method !== 'HEAD') {          // pages and scripts: fix their paths
      const parts = []; let size = 0;
      res.on('data', c => { size += c.length; if (size <= REWRITE_MAX) parts.push(c); });
      res.on('end', () => {
        const out = Buffer.from(rewriteText(Buffer.concat(parts).toString('utf8'), s.base));
        head.headers['content-length'] = String(out.length); delete head.headers.etag;
        snd.start(head); snd.end(out);
      });
      return;
    }
    snd.start(head);
    snd.onGone = () => res.destroy();
    snd.onDrain = () => res.resume();
    res.on('data', c => { snd.write(c); if (snd.full) res.pause(); });
    res.on('end', () => snd.end());
    res.on('error', () => snd.end());
  });
  up.end(body || undefined);
}

// ---------------------------------------------------------------- the live events stream
// The connection to the Table stays open while a player's browser reconnects through the relay (phones do
// that often, and plain web hosting cuts long responses). Every event gets a number on its way out; a browser
// that reconnects says which one it saw last, and gets the ones after it. Nobody flickers offline, nothing is lost.
const streams = new Map();
function events(s, r) {
  const key = crypto.createHash('sha1').update((r.headers.cookie || '') + '\n' + r.path + '\n' + s.table).digest('hex');
  const snd = new Sender(s, r.id);
  const retry = Buffer.from(`retry: ${s.burst ? 400 : 3000}\n\n`);
  const lastId = r.headers['last-event-id'] != null && /^\d+$/.test(r.headers['last-event-id']) ? +r.headers['last-event-id'] : null;
  let e = streams.get(key);
  const attach = from => {
    clearTimeout(e.timer);
    if (e.snd && e.snd !== snd) e.snd.end();
    e.snd = snd;
    snd.onGone = () => { if (e.snd === snd) { e.snd = null; e.timer = setTimeout(() => drop(key), s.burst ? 15000 : 8000); } };
    snd.start(e.head); snd.write(retry);
    for (const x of e.ring) if (x.id > from) snd.write(x.data);
  };
  if (e && e.alive && lastId !== null && lastId < e.next && lastId >= (e.ring.length ? e.ring[0].id : e.next) - 1) return attach(lastId);
  if (e) drop(key);                                                     // a new page (or too far behind): start over with a full snapshot
  e = { alive: false, ring: [], size: 0, next: 1, part: '', snd: null, timer: null, up: null, head: null };
  const up = e.up = tableRequest(r, null);
  up.on('error', () => { if (!e.alive) fail(s, r.id, 502, 'The IPRPS Table is not running on the Session Master\'s computer.'); if (streams.get(key) === e) drop(key); });
  up.on('response', res => {
    if (res.statusCode !== 200) {                                        // not joined, table closed...: pass the answer on as it is
      snd.start(responseHead(res, s)); res.on('data', c => snd.write(c)); res.on('end', () => snd.end()); return;
    }
    e.alive = true; e.head = responseHead(res, s); delete e.head.headers['content-length'];
    streams.set(key, e); attach(0);
    res.setEncoding('utf8');
    res.on('data', text => {
      e.part += text;
      let i;
      while ((i = e.part.indexOf('\n\n')) >= 0) {
        const block = e.part.slice(0, i); e.part = e.part.slice(i + 2);
        if (/^retry:/.test(block) && !/^(event|data):/m.test(block)) continue;          // the stream sets its own
        if (!/^(event|data):/m.test(block)) { if (e.snd) e.snd.write(Buffer.from(block + '\n\n')); continue; }   // keep-alive comments
        const x = { id: e.next++, data: null }; x.data = Buffer.from(`${block}\nid: ${x.id}\n\n`);
        e.ring.push(x); e.size += x.data.length;
        while (e.ring.length > 1 && (e.ring.length > 800 || e.size > SSE_BUFFER)) e.size -= e.ring.shift().data.length;
        if (e.snd) e.snd.write(x.data);
      }
    });
    res.on('close', () => { if (streams.get(key) === e) drop(key); });
  });
  up.end();
}
function drop(key) {
  const e = streams.get(key);
  if (e) { streams.delete(key); clearTimeout(e.timer); if (e.snd) e.snd.end(); if (e.up) e.up.destroy(); }
}

// ---------------------------------------------------------------- the link to the relay
async function openLink() {
  const base = cleanUrl(C.relay);
  if (!/^https?:\/\//.test(base)) throw new Error('Type the address of your IPRPS Link relay first.');
  if (!C.token) throw new Error('Sign in with your Infinite Plane account first.');
  const r = await call('POST', base + '/_link/open', { headers: { 'Content-Type': 'application/json', 'X-Auth-Token': C.token }, body: JSON.stringify({ version: VERSION, name: (C.user && C.user.username) || '' }), timeout: 30000 });
  if (!r.json) throw new Error(`No IPRPS Link relay answered at ${base} (HTTP ${r.status}).`);
  if (!r.json.ok) { const e = new Error(r.json.error || 'The relay refused the connection.'); e.auth = r.status === 401; throw e; }
  const u = new URL(r.json.url);
  const s = { api: base + '/_link/', table: r.json.table, key: r.json.key, url: r.json.url, base: u.pathname.replace(/\/$/, ''), secure: u.protocol === 'https:', kind: r.json.relay || '', burst: false };
  // Does this relay deliver a response as it is written, or only when it ends (some web hosts hold it back)?
  try {
    const t0 = Date.now(), res = await call('GET', s.api + 'streamtest', { stream: true, timeout: 15000 });
    let first = 0; await new Promise(done => { res.on('data', () => { first = first || Date.now() - t0; }); res.on('end', done); res.on('error', done); });
    s.burst = first > 700 || process.env.IPRPS_LINK_FORCE_BURST === '1';
    if (s.burst) await call('POST', `${s.api}set?table=${s.table}&burst=1`, { headers: { 'X-Link-Key': s.key }, body: '' });
  } catch {}
  return s;
}
async function poller(s, gen) {
  let errors = 0;
  while (gen === generation) {
    try {
      const r = await call('GET', `${s.api}poll?table=${s.table}&wait=25`, { headers: { 'X-Link-Key': s.key }, timeout: 45000 });
      if (gen !== generation) return;
      if (r.status === 401 || r.status === 404) throw Object.assign(new Error('relay restarted'), { reopen: true });
      if (r.status !== 200 || !r.json) throw new Error('HTTP ' + r.status);
      errors = 0;
      for (const q of r.json.requests || []) handle(s, q).catch(e => console.error('request failed:', e.message));
    } catch (e) {
      if (gen !== generation) return;
      if (e.reopen || ++errors >= 4) { generation++; setTimeout(run, 500); return; }
      await sleep(1000 * errors);
    }
  }
}
async function run() {
  const gen = ++generation;
  for (const k of [...streams.keys()]) drop(k);
  session = null;
  if (!C.enabled) { Object.assign(ST, { status: 'off', error: '', url: '' }); return; }
  let wait = 2000;
  while (gen === generation && C.enabled) {
    ST.status = 'connecting';
    try {
      const s = await openLink();
      if (gen !== generation) return;
      session = s;
      Object.assign(ST, { status: 'online', error: '', url: s.url, table: s.table, relayKind: s.kind, burst: s.burst, since: Date.now() });
      log(`Remote play is on: ${s.url}${s.burst ? ' (this web host holds responses back; using short connections)' : ''}`);
      poller(s, gen); poller(s, gen);
      return;
    } catch (e) {
      if (gen !== generation) return;
      Object.assign(ST, { status: 'error', error: e.message, url: '' });
      log('Could not connect: ' + e.message);
      if (e.auth) { C.token = ''; C.user = null; C.enabled = false; saveConf(); ST.status = 'off'; return; }
      await sleep(wait); wait = Math.min(wait * 2, 60000);
    }
  }
}
async function closeLink() {
  const s = session; generation++; session = null;
  for (const k of [...streams.keys()]) drop(k);
  Object.assign(ST, { status: 'off', error: '', url: '' });
  if (s) { try { await call('POST', `${s.api}close?table=${s.table}`, { headers: { 'X-Link-Key': s.key }, body: '', timeout: 8000 }); } catch {} log('Remote play is off.'); }
}

// ---------------------------------------------------------------- console (this computer only)
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
const STATIC = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const LOOP = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function isLocal(req) {
  if (!LOOP.has(req.socket.remoteAddress)) return false;
  const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
const json = (res, status, obj) => { res.writeHead(status, { ...SEC, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const readJson = req => new Promise((resolve, reject) => {
  const parts = []; let size = 0;
  req.on('data', c => { size += c.length; if (size > 65536) { reject(new Error('Too much data')); req.destroy(); } else parts.push(c); });
  req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts)) : {}); } catch { reject(new Error('Bad request')); } });
});
function publicState() {
  const now = Date.now();
  for (const [k, t] of ST.players) if (now - t > 90000) ST.players.delete(k);
  return { ok: true, version: VERSION, relay: C.relay, auth: C.auth, user: C.user, enabled: C.enabled, status: ST.status, error: ST.error, url: ST.url,
    relayKind: ST.relayKind, burst: ST.burst, since: ST.since, requests: ST.requests, bytesOut: ST.bytesOut, bytesIn: ST.bytesIn,
    remotePlayers: ST.players.size, log: ST.log.slice(-25), separateAddresses: canBind };
}
async function route(req, res) {
  if (!isLocal(req)) { res.writeHead(403, { ...SEC, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('IPRPS Link only opens on the Session Master\'s computer.'); }
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (req.method === 'GET') {
    if (p === '/' || p === '/auth/callback') return fs.createReadStream(path.join(PUB, 'index.html')).on('error', () => res.end()).pipe((res.writeHead(200, { ...SEC, 'Content-Type': STATIC['.html'] }), res));
    if (p === '/assets/qr.js') { res.writeHead(200, { ...SEC, 'Content-Type': STATIC['.js'] }); return fs.createReadStream(QR_JS).on('error', () => res.end('')).pipe(res); }
    if (p.startsWith('/assets/')) {
      const f = path.join(PUB, path.basename(p)); if (!STATIC[path.extname(f)] || !fs.existsSync(f)) { res.writeHead(404, SEC); return res.end(); }
      res.writeHead(200, { ...SEC, 'Content-Type': STATIC[path.extname(f)] }); return fs.createReadStream(f).pipe(res);
    }
    if (p === '/api/state') return json(res, 200, publicState());
    if (p === '/auth/start') {                                       // sign in on the Infinite Plane site, which hands the session back to this page
      authState = crypto.randomBytes(16).toString('hex');
      const back = `http://localhost:${PORT}/auth/callback`;
      res.writeHead(302, { ...SEC, Location: `${cleanUrl(C.auth, true)}link.html?return=${encodeURIComponent(back)}&state=${authState}` }); return res.end();
    }
    res.writeHead(404, SEC); return res.end();
  }
  if (req.method !== 'POST' || req.headers['x-iprps-link'] !== '1') return json(res, 400, { ok: false, error: 'Bad request' });
  const b = await readJson(req);
  if (p === '/api/settings') {
    const relay = cleanUrl(b.relay), auth = cleanUrl(b.auth || DEFAULT_AUTH, true);
    if (relay && !/^https?:\/\/[^\s/]+/.test(relay)) return json(res, 400, { ok: false, error: 'The relay address starts with https://' });
    if (!/^https?:\/\/[^\s/]+/.test(auth)) return json(res, 400, { ok: false, error: 'The sign-in address starts with https://' });
    const changed = relay !== C.relay || auth !== C.auth;
    if (auth !== C.auth) { C.token = ''; C.user = null; }
    C.relay = relay; C.auth = auth; saveConf();
    if (changed && C.enabled) run();
    return json(res, 200, publicState());
  }
  if (p === '/api/token') {
    if (b.state !== undefined && (!authState || b.state !== authState)) return json(res, 400, { ok: false, error: 'That sign-in did not start here. Try again.' });
    authState = '';
    try { C.user = await whoIs(String(b.token || '').trim()); } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
    C.token = String(b.token).trim(); saveConf();
    log(`Signed in as ${C.user.username || C.user.email}.`);
    if (C.enabled) run();
    return json(res, 200, publicState());
  }
  if (p === '/api/signout') { await closeLink(); C.token = ''; C.user = null; C.enabled = false; saveConf(); return json(res, 200, publicState()); }
  if (p === '/api/enable') {
    C.enabled = !!b.on; saveConf();
    if (C.enabled) run(); else await closeLink();
    return json(res, 200, publicState());
  }
  json(res, 404, { ok: false, error: 'Not found' });
}

loadConf();
const probe = net.createServer();
probe.once('error', () => start()).listen(0, '127.77.0.1', () => { canBind = true; probe.close(start); });
let started = false;
function start() {
  if (started) return; started = true;
  http.createServer((req, res) => route(req, res).catch(e => { if (!res.headersSent) json(res, 500, { ok: false, error: e.message }); else res.end(); }))
    .listen(PORT, BIND, () => { console.log(`IPRPS Link ${VERSION}: console at http://localhost:${PORT}/ (Table at ${TABLE.origin}, state in ${STATE_DIR})`); if (C.enabled) run(); });
}
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { closeLink().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
