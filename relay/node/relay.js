#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Link relay (Node.js) - the public address remote players open. No npm packages: Node.js core only.
//
//  Players:  https://<relay>/t/<table>/      The Session Master's computer (IPRPS Link) dials in on /_link/.
//  The relay stores nothing about the game: it passes requests to the connected computer and the answers back.
//  Only a signed-in Infinite Plane account that owns this relay can connect a table to it.
//
//  Settings (environment, or KEY=value lines in relay.env beside this file):
//    PORT=8787  BIND=127.0.0.1      listen address (put Caddy/nginx with HTTPS in front), or
//    TLS_CERT= TLS_KEY=             serve HTTPS directly with these files (then BIND=0.0.0.0 PORT=443)
//    PUBLIC_URL=https://play.example.com   the address players use (no trailing slash; may include a folder)
//    OWNERS=name1,name2             Infinite Plane usernames or emails allowed to connect a table.
//                                   Empty: the first account that connects becomes the owner.
//    AUTH_URL=https://infiniteplane.space/auth/   where accounts are checked
//    DATA_DIR=./data  TRUST_PROXY=1 (read the visitor's address from X-Forwarded-For)
'use strict';
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const envFile = path.join(__dirname, 'relay.env');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; }
const E = process.env;
const VERSION = '1.0.0';
const PORT = +E.PORT || 8787, BIND = E.BIND || '127.0.0.1';
const PUBLIC_URL = (E.PUBLIC_URL || '').replace(/\/+$/, '');
const BASE = PUBLIC_URL ? new URL(PUBLIC_URL).pathname.replace(/\/+$/, '') : (E.BASE_PATH || '').replace(/\/+$/, '');
const AUTH_URL = (E.AUTH_URL || 'https://infiniteplane.space/auth/').replace(/\/+$/, '') + '/';
const OWNERS = (E.OWNERS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const DATA_DIR = path.resolve(__dirname, E.DATA_DIR || 'data');
const TRUST_PROXY = E.TRUST_PROXY === '1';
const LIM = { upload: (+E.MAX_UPLOAD_MB || 20) << 20, chunk: 4 << 20, perTable: 200, tables: +E.MAX_TABLES || 50, offlineAfter: 45000 };

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const secretFile = path.join(DATA_DIR, 'secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();
const ownerFile = path.join(DATA_DIR, 'owner.json');
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const tableId = userId => crypto.createHmac('sha256', SECRET).update('table:' + userId).digest('hex').replace(/[^a-z0-9]/g, '').slice(0, 12);

const tables = new Map();       // id -> { id, user, keyHash, seen, burst, pending: [], waiters: [], reqs: Map }
const hits = new Map();
function limited(key, max, ms) {
  const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < ms);
  a.push(now); hits.set(key, a); return a.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.length || now - a[a.length - 1] > 600000) hits.delete(k); }, 60000).unref();

// ---------------------------------------------------------------- helpers
const json = (res, status, obj, headers = {}) => { const b = JSON.stringify(obj); res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b), ...headers }); res.end(b); };
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const parts = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > max) { reject(Object.assign(new Error('too big'), { status: 413 })); req.resume(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts))); req.on('error', reject);
  });
}
const clientIp = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';
function publicUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = (TRUST_PROXY && req.headers['x-forwarded-proto']) || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers.host}${BASE}`;
}
const page = (title, body, refresh) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0e1a;color:#e6e3d6;font:16px/1.5 system-ui,sans-serif}main{max-width:520px;padding:24px;text-align:center}h1{font:600 26px Georgia,serif;color:#f1d58c}p{color:#b9b6a8}</style></head><body><main><h1>✦ ${title}</h1>${body}</main></body></html>`;
function html(res, status, title, body, refresh) { const b = page(title, body, refresh); res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b) }); res.end(b); }

// ---------------------------------------------------------------- Infinite Plane accounts
const seenTokens = new Map();
function whoIs(token) {
  return new Promise((resolve, reject) => {
    if (!/^[a-f0-9]{64}$/.test(token)) return reject(new Error('Sign in with your Infinite Plane account.'));
    const hit = seenTokens.get(sha(token)); if (hit && Date.now() - hit.t < 60000) return resolve(hit.user);
    const u = new URL(AUTH_URL + 'auth.php'), body = JSON.stringify({ action: 'me' });
    const rq = (u.protocol === 'https:' ? https : http).request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token, 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'IPRPS-Link-Relay/' + VERSION } }, rs => {
      const parts = []; rs.on('data', c => parts.push(c));
      rs.on('end', () => { try { const j = JSON.parse(Buffer.concat(parts)); if (j.ok && j.user && j.user.id != null) { seenTokens.set(sha(token), { t: Date.now(), user: j.user }); return resolve(j.user); } } catch {} reject(new Error('Your Infinite Plane sign-in has ended. Sign in again.')); });
    });
    rq.setTimeout(15000, () => rq.destroy(new Error('timeout')));
    rq.on('error', () => reject(Object.assign(new Error('The relay could not reach the Infinite Plane sign-in service.'), { status: 502 })));
    rq.end(body);
  });
}
function allowed(user) {
  const names = [String(user.username || '').toLowerCase(), String(user.email || '').toLowerCase()].filter(Boolean);
  if (OWNERS.length) return names.some(n => OWNERS.includes(n));
  let owner = null; try { owner = JSON.parse(fs.readFileSync(ownerFile, 'utf8')); } catch {}
  if (!owner) { fs.writeFileSync(ownerFile, JSON.stringify({ id: user.id, username: user.username || '', claimed: new Date().toISOString() }), { mode: 0o600 }); console.log(`Relay claimed by ${user.username || user.id}`); return true; }
  return String(owner.id) === String(user.id);
}

// ---------------------------------------------------------------- the Session Master's side (/_link/)
function tableOf(req, url) {
  const t = tables.get(url.searchParams.get('table') || '');
  if (!t || sha(req.headers['x-link-key'] || '') !== t.keyHash) return null;
  t.seen = Date.now(); return t;
}
async function linkApi(req, res, url, p) {
  if (p === 'health') return json(res, 200, { ok: true, relay: 'node', version: VERSION, tables: [...tables.values()].filter(online).length });
  if (p === 'streamtest') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    res.write('1\n'); setTimeout(() => res.write('2\n'), 500); setTimeout(() => res.end('3\n'), 1000); return;
  }
  if (p === 'open' && req.method === 'POST') {
    await readBody(req, 4096);
    if (limited('open:' + clientIp(req), 20, 60000)) return json(res, 429, { ok: false, error: 'Too many tries. Wait a minute.' });
    let user; try { user = await whoIs(String(req.headers['x-auth-token'] || '')); } catch (e) { return json(res, e.status || 401, { ok: false, error: e.message }); }
    if (!allowed(user)) return json(res, 403, { ok: false, error: 'This relay belongs to another Session Master. Use your own relay\'s address.' });
    const id = tableId(user.id), key = crypto.randomBytes(32).toString('hex');
    let t = tables.get(id);
    if (!t) { if (tables.size >= LIM.tables) return json(res, 503, { ok: false, error: 'This relay is full.' }); t = { id, pending: [], waiters: [], reqs: new Map() }; tables.set(id, t); }
    for (const w of t.waiters.splice(0)) w(true);                    // an older connection of the same table steps aside
    Object.assign(t, { user: { id: user.id, username: user.username || '' }, keyHash: sha(key), seen: Date.now(), burst: false });
    console.log(`Table ${id} connected (${t.user.username || t.user.id})`);
    return json(res, 200, { ok: true, relay: 'node', version: VERSION, table: id, key, url: `${publicUrl(req)}/t/${id}/` });
  }
  const t = tableOf(req, url);
  if (!t) return json(res, 401, { ok: false, error: 'Not connected' });
  if (p === 'poll') {
    const give = () => json(res, 200, { ok: true, requests: t.pending.splice(0) });
    if (t.pending.length) return give();
    const wait = Math.min(Math.max(+url.searchParams.get('wait') || 25, 1), 30) * 1000;
    let done = false;
    const w = stale => { if (done) return; done = true; clearTimeout(timer); const i = t.waiters.indexOf(w); if (i >= 0) t.waiters.splice(i, 1); stale ? json(res, 401, { ok: false, error: 'Replaced by a newer connection' }) : give(); };
    const timer = setTimeout(w, wait); t.waiters.push(w); req.on('close', () => { if (!done) { done = true; clearTimeout(timer); const i = t.waiters.indexOf(w); if (i >= 0) t.waiters.splice(i, 1); } });
    return;
  }
  if (p === 'body') {
    const r = t.reqs.get(url.searchParams.get('id') || '');
    if (!r || !r.body) return json(res, 404, { ok: false });
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': r.body.length }); res.end(r.body); r.body = null; return;
  }
  if (p === 'chunk' && req.method === 'POST') {
    const data = await readBody(req, LIM.chunk);
    const r = t.reqs.get(url.searchParams.get('id') || ''), seq = +url.searchParams.get('seq') || 0;
    if (!r) return json(res, 200, { ok: true, gone: true, consumed: -1 });
    if (r.gone) return json(res, 200, { ok: true, gone: true, consumed: r.consumed });
    if (req.headers['x-link-head'] && !r.res.headersSent) {
      let head; try { head = JSON.parse(Buffer.from(req.headers['x-link-head'], 'base64').toString('utf8')); } catch { head = { status: 502, headers: {} }; }
      clearTimeout(r.timer);
      const headers = {}; for (const [k, v] of Object.entries(head.headers || {})) if (!/^(connection|keep-alive|transfer-encoding|upgrade)$/i.test(k)) headers[k] = v;
      if (/event-stream/.test(String(headers['content-type'] || ''))) headers['X-Accel-Buffering'] = 'no';
      r.res.writeHead(+head.status || 502, headers);
    }
    let flowing = true;
    if (data.length) flowing = r.res.write(data);
    r.consumed = seq;
    if (url.searchParams.get('end') === '1') { r.done = true; r.res.end(); t.reqs.delete(r.id); return json(res, 200, { ok: true, gone: false, consumed: seq }); }
    if (flowing) return json(res, 200, { ok: true, gone: false, consumed: seq });
    const finish = () => { clearTimeout(tm); r.res.off('drain', finish); json(res, 200, { ok: true, gone: r.gone, consumed: seq }); };
    const tm = setTimeout(finish, 20000); r.res.once('drain', finish);          // slow player: hold the next chunk back
    return;
  }
  if (p === 'set' && req.method === 'POST') { t.burst = url.searchParams.get('burst') === '1'; return json(res, 200, { ok: true }); }
  if (p === 'close' && req.method === 'POST') { t.seen = 0; for (const r of t.reqs.values()) if (!r.res.writableEnded) r.res.destroy(); t.reqs.clear(); t.pending = []; console.log(`Table ${t.id} disconnected`); return json(res, 200, { ok: true }); }
  json(res, 404, { ok: false, error: 'Not found' });
}
const online = t => Date.now() - t.seen < LIM.offlineAfter;

// ---------------------------------------------------------------- the players' side (/t/<table>/...)
const DROP_REQ = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'accept-encoding', 'content-length', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'x-real-ip', 'x-auth-token', 'x-link-key', 'x-link-head', 'authorization']);
function isConsole(p) {
  let n = p; try { n = decodeURIComponent(new URL(p, 'http://x').pathname); } catch { return true; }
  n = n.replace(/\/+/g, '/').toLowerCase();
  return n === '/sm' || n.startsWith('/sm/') || n.startsWith('/api/sm');
}
async function player(req, res, id, rest, search) {
  const wantsPage = req.method === 'GET' && /text\/html/.test(req.headers.accept || '') && !rest.startsWith('/api/');
  const t = tables.get(id);
  if (!t || !online(t)) {
    const msg = 'The Session Master\'s table isn\'t connected right now.';
    return wantsPage ? html(res, 503, 'IPRPS Table', `<p>${msg}</p><p>This page tries again by itself. Ask your Session Master to turn on remote play.</p>`, 6) : json(res, 503, { ok: false, error: msg });
  }
  if (isConsole(rest)) return json(res, 403, { ok: false, error: 'The Session Master console only opens on the Session Master\'s computer.' });
  const ip = clientIp(req);
  if (req.method === 'POST' && rest === '/api/join' && limited(`join:${id}:${ip}`, 12, 300000)) return json(res, 429, { ok: false, error: 'Too many tries. Wait a few minutes and try again.' });
  if (limited(`req:${id}:${ip}`, 1200, 60000)) return json(res, 429, { ok: false, error: 'Slow down a little.' });
  if (t.reqs.size >= LIM.perTable) return json(res, 503, { ok: false, error: 'The table is busy. Try again in a moment.' });
  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { body = await readBody(req, LIM.upload); } catch { return json(res, 413, { ok: false, error: `That file is too big (limit ${LIM.upload >> 20} MB).` }); }
  }
  const headers = {}; for (const [k, v] of Object.entries(req.headers)) if (!DROP_REQ.has(k)) headers[k] = v;
  // Only the Table's own cookie travels on: any other cookie of this site (a sign-in, for one) stays here.
  const ck = /(?:^|;\s*)iprps_table=([^;]*)/.exec(req.headers.cookie || ''); delete headers.cookie; if (ck) headers.cookie = 'iprps_table=' + ck[1];
  const r = { id: crypto.randomBytes(9).toString('hex'), res, body: body && body.length ? body : null, gone: false, done: false, consumed: -1 };
  r.timer = setTimeout(() => { if (!res.headersSent) { json(res, 504, { ok: false, error: 'The Session Master\'s computer did not answer.' }); t.reqs.delete(r.id); } }, 45000);
  res.on('close', () => { clearTimeout(r.timer); if (!r.done) { r.gone = true; setTimeout(() => t.reqs.delete(r.id), 60000).unref(); } });
  t.reqs.set(r.id, r);
  t.pending.push({ id: r.id, method: req.method, path: rest + search, headers, hasBody: !!r.body, client: sha(ip + '|' + (req.headers['user-agent'] || '')).slice(0, 16) });
  const w = t.waiters.shift(); if (w) w();
}

async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  let p = url.pathname;
  if (BASE) { if (p !== BASE && !p.startsWith(BASE + '/')) { res.writeHead(404); return res.end(); } p = p.slice(BASE.length) || '/'; }
  if (p.startsWith('/_link/')) return linkApi(req, res, url, p.slice(7));
  const m = /^\/t\/([a-z0-9]{6,20})(\/.*)?$/.exec(p);
  if (m) {
    if (!m[2]) { res.writeHead(302, { Location: `${BASE}/t/${m[1]}/${url.search}` }); return res.end(); }
    return player(req, res, m[1], m[2], url.search);
  }
  if (p === '/' || p === '') return html(res, 200, 'IPRPS Link relay', '<p>This address connects remote players to a Session Master\'s IPRPS Table. Players: use the link your Session Master sent you.</p>');
  res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
}

const handler = (req, res) => route(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, e.status || 500, { ok: false, error: 'Relay error' }); else res.end(); });
const server = E.TLS_CERT && E.TLS_KEY ? https.createServer({ cert: fs.readFileSync(E.TLS_CERT), key: fs.readFileSync(E.TLS_KEY) }, handler) : http.createServer(handler);
server.requestTimeout = 0; server.headersTimeout = 30000; server.keepAliveTimeout = 65000;
server.listen(PORT, BIND, () => console.log(`IPRPS Link relay ${VERSION} on ${BIND}:${PORT}${BASE}  (accounts: ${AUTH_URL}, owners: ${OWNERS.join(', ') || 'first to connect'})`));
