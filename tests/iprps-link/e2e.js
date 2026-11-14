#!/usr/bin/env node
// End-to-end test: real IPRPS Table + IPRPS Link + a relay (node or php) + a stand-in for the Infinite Plane sign-in.
//   node tests/iprps-link/e2e.js node|php [burst]
'use strict';
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { spawn } = require('child_process');
const kind = process.argv[2] || 'node', burst = process.argv[3] === 'burst';
const ROOT = path.join(__dirname, '..', '..'), TABLE_DIR = process.env.TABLE_DIR || path.join(ROOT, 'apps', 'table');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iprps-link-'));
const P = { auth: 18700, table: 18777, agent: 18778, relay: 18787 };
const TOK_SM = 'a'.repeat(64), TOK_OTHER = 'b'.repeat(64);
const kids = [], sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (cond, msg, extra = '') => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
function run(cmd, args, env, cwd) { const k = spawn(cmd, args, { env: { ...process.env, ...env }, cwd, stdio: ['ignore', 'pipe', 'pipe'] }); k.stdout.on('data', d => process.env.VERBOSE && process.stdout.write(d)); k.stderr.on('data', d => process.env.VERBOSE && process.stderr.write(d)); kids.push(k); return k; }
function rq(method, url, { headers = {}, body = null, host } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), h = { ...headers }; if (host) h.Host = host; if (body != null) h['Content-Length'] = Buffer.byteLength(body);
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: h }, res => { const p = []; res.on('data', c => p.push(c)); res.on('end', () => { const buf = Buffer.concat(p); let json = null; try { json = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, headers: res.headers, body: buf, text: buf.toString(), json }); }); });
    r.on('error', reject); r.end(body != null ? body : undefined);
  });
}
// A small EventSource: reconnects like a browser does and records what arrives.
function eventSource(url, headers) {
  const es = { events: [], hellos: 0, connects: 0, closed: false, req: null, retry: 3000, lastId: null };
  const open = () => {
    if (es.closed) return; es.connects++;
    const u = new URL(url); let buf = '';
    es.req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: { Accept: 'text/event-stream', ...headers, ...(es.lastId ? { 'Last-Event-ID': es.lastId } : {}) } }, res => {
      es.status = res.statusCode;
      res.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const block = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /^event: (.*)$/m.exec(block), data = /^data: (.*)$/m.exec(block), rt = /^retry: (\d+)$/m.exec(block), idm = /^id: (.*)$/m.exec(block); if (rt) es.retry = +rt[1]; if (idm) es.lastId = idm[1]; if (ev) { if (ev[1] === 'hello') es.hellos++; es.events.push({ t: Date.now(), ev: ev[1], data: data ? data[1] : '' }); } } });
      res.on('close', () => { if (!es.closed) setTimeout(open, es.retry); });
      res.on('error', () => {});
    });
    es.req.on('error', () => { if (!es.closed && !es.req.res) setTimeout(open, es.retry); }); es.req.end();
  };
  es.close = () => { es.closed = true; es.req && es.req.destroy(); };
  es.drop = () => { es.req && es.req.destroy(); };          // lose the connection, then reconnect like a phone would
  open(); return es;
}
const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(40); } return null; };

(async () => {
  // stand-in for https://infiniteplane.space/auth/auth.php
  http.createServer((req, res) => { req.resume(); req.on('end', () => { const t = req.headers['x-auth-token']; const user = t === TOK_SM ? { id: 7, username: 'james', email: 'j@example.com' } : t === TOK_OTHER ? { id: 8, username: 'mallory', email: 'm@example.com' } : null; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(user ? { ok: true, user } : { ok: false })); }); }).listen(P.auth, '127.0.0.1');
  const AUTH = `http://127.0.0.1:${P.auth}/`;
  run('node', [path.join(TABLE_DIR, 'server.js')], { IPRPS_TABLE_PORT: P.table, IPRPS_TABLE_STATE: tmp + '/table', STATE_DIRECTORY: '', IPRPS_TABLE_SHEET: tmp + '/nosheet.html' });
  let RELAY;
  if (kind === 'node') { RELAY = `http://127.0.0.1:${P.relay}/play`; run('node', [path.join(ROOT, 'relay/node/relay.js')], { PORT: P.relay, PUBLIC_URL: RELAY, AUTH_URL: AUTH, DATA_DIR: tmp + '/relay', OWNERS: '' }); }
  else {
    RELAY = `http://127.0.0.1:${P.relay}`; const dir = tmp + '/php'; fs.mkdirSync(dir); fs.copyFileSync(path.join(ROOT, 'relay/php/index.php'), dir + '/index.php');
    fs.writeFileSync(dir + '/config.php', `<?php return ['auth_url' => '${AUTH}', 'data_dir' => '${tmp}/phpdata', 'base_path' => '', 'stream_seconds' => 6];`);
    run('php', ['-S', `127.0.0.1:${P.relay}`, '-t', dir, dir + '/index.php'], { PHP_CLI_SERVER_WORKERS: '32' }, dir);
  }
  run('node', [path.join(ROOT, 'apps/link/agent.js')], { IPRPS_LINK_PORT: P.agent, IPRPS_LINK_TABLE: `http://127.0.0.1:${P.table}`, IPRPS_LINK_STATE: tmp + '/agent', STATE_DIRECTORY: '', IPRPS_LINK_FORCE_BURST: burst ? '1' : '' });
  await sleep(1200);
  const A = `http://127.0.0.1:${P.agent}`, LH = { 'Content-Type': 'application/json', 'X-IPRPS-Link': '1' }, lhost = 'localhost:' + P.agent;
  const apost = (p, b) => rq('POST', A + p, { headers: LH, body: JSON.stringify(b), host: lhost });
  console.log(`\n== relay: ${kind}${burst ? ' (burst mode)' : ''}`);

  ok((await rq('GET', A + '/api/state', { host: 'evil.example' })).status === 403, 'Link console refuses other host names');
  ok((await rq('GET', `${RELAY}/_link/health`)).json?.relay === kind, 'relay answers');
  // someone else's account cannot take the relay after the owner claimed it; first the owner connects
  await apost('/api/settings', { relay: RELAY, auth: AUTH });
  ok((await apost('/api/token', { token: 'c'.repeat(64) })).status === 400, 'unknown sign-in refused');
  ok((await apost('/api/token', { token: TOK_SM })).json?.user?.username === 'james', 'signed in with the Infinite Plane account');
  await apost('/api/enable', { on: true });
  const st = await waitFor(async () => { const s = (await rq('GET', A + '/api/state', { host: lhost })).json; return s.status === 'online' ? s : null; }, 15000);
  ok(!!st, 'remote play comes online', st ? st.url : '');
  if (!st) throw new Error('not online');
  const U = st.url, base = new URL(U).pathname.replace(/\/$/, '');
  const other = await rq('POST', `${RELAY}/_link/open`, { headers: { 'X-Auth-Token': TOK_OTHER, 'Content-Type': 'application/json' }, body: '{}' });
  ok(other.status === 403, 'another account cannot use this relay', other.json?.error);
  ok((await rq('GET', `${RELAY}/_link/poll?table=${st.url.split('/t/')[1].replace('/', '')}`, { headers: { 'X-Link-Key': 'nope' } })).status === 401, 'relay API needs the table key');

  // Session Master opens the table (console API: this computer only)
  const T = `http://127.0.0.1:${P.table}`, SMH = { 'Content-Type': 'application/json', 'x-iprps-sm': '1' }, thost = 'localhost:' + P.table;
  await rq('POST', T + '/api/sm/table', { headers: SMH, body: JSON.stringify({ open: true, name: 'Fog on Pier Nine' }), host: thost });
  const sm = eventSource(T + '/api/sm/events', { Host: thost });
  const hello = await waitFor(() => sm.events.find(e => e.ev === 'hello'));
  const code = JSON.parse(hello.data).table.code;

  let r = await rq('GET', U, { headers: { Accept: 'text/html' } });
  ok(r.status === 200 && r.text.includes(`"${base}/assets/join.js"`) && !/["']\/assets\//.test(r.text), 'join page arrives with its paths under the relay address');
  r = await rq('GET', U + 'assets/common.js');
  ok(r.status === 200 && r.text.includes('`' + base + '/media/') && /javascript/.test(r.headers['content-type']), 'scripts are rewritten too');
  r = await rq('GET', U + 'assets/table.css'); ok(r.status === 200 && r.body.length > 5000, 'stylesheet passes through unchanged');
  r = await rq('GET', U + 'api/info'); ok(r.json?.open === true && r.json.name === 'Fog on Pier Nine', 'table info through the relay');
  for (const p of ['sm/', 'api/sm/events', 'api/sm/table', '%73m/', 'x/../sm/']) { r = await rq(p.includes('table') ? 'POST' : 'GET', U + p, { headers: { 'x-iprps-sm': '1', 'Content-Type': 'application/json' }, body: p.includes('table') ? '{"open":false}' : null }); ok(r.status === 403 || r.status === 404, `console is unreachable: /${p}`, 'HTTP ' + r.status); }
  const PH = { 'Content-Type': 'application/json', 'X-IPRPS': '1' };
  r = await rq('POST', U + 'api/join', { headers: PH, body: JSON.stringify({ code: 'ZZZZZZ', name: 'Riley' }) }); ok(r.status === 403, 'wrong join code refused');
  r = await rq('POST', U + 'api/join', { headers: PH, body: JSON.stringify({ code, name: 'Riley', character: 'Vex' }) });
  const setc = (r.headers['set-cookie'] || [''])[0];
  ok(r.status === 200 && setc.includes(`Path=${base}/`) && !/Path=\/;/.test(setc), 'joined; the cookie is scoped to this table', setc.replace(/=[0-9a-f]{20,}/, '=…'));
  const cookie = setc.split(';')[0];
  const roster = await waitFor(() => { const e = [...sm.events].reverse().find(e => e.ev === 'roster' || e.ev === 'hello'); const j = e && JSON.parse(e.data); const list = j && (j.roster || j.players || j); const me = JSON.stringify(list).match(/"ip":"([^"]+)"/); return me && me[1]; });
  ok(!!roster, 'the Session Master sees the remote player', 'address ' + roster);
  ok(roster !== '127.0.0.1', 'the remote player does not look like the Session Master\'s own computer');

  r = await rq('GET', U + 'api/info', { headers: { Cookie: `ip_session=${'d'.repeat(64)}; ${cookie}; other=1` } });
  ok(r.json?.joined === true, 'only the Table cookie is passed on (other site cookies stay at the relay)');
  const es = eventSource(U + 'api/p/events', { Cookie: cookie });
  const smMark = sm.events.length;
  ok(!!(await waitFor(() => es.hellos === 1)), 'live events stream opens through the relay');
  let t0 = Date.now();
  r = await rq('POST', U + 'api/p/send', { headers: { ...PH, Cookie: cookie }, body: JSON.stringify({ text: 'hello from another city' }) });
  let got = await waitFor(() => es.events.find(e => e.data.includes('hello from another city')));
  ok(r.status === 200 && !!got, 'chat sent remotely comes back on the stream', got ? `${got.t - t0} ms` : '');
  t0 = Date.now();
  await rq('POST', T + '/api/sm/send', { headers: SMH, body: JSON.stringify({ text: 'the fog rolls in', to: 'all' }), host: thost });
  got = await waitFor(() => es.events.find(e => e.data.includes('the fog rolls in')));
  ok(!!got, 'the Session Master\'s message reaches the remote player', got ? `${got.t - t0} ms` : '');
  r = await rq('POST', U + 'api/p/roll', { headers: { ...PH, Cookie: cookie }, body: JSON.stringify({ kind: 'dice', expr: '2d6' }) });
  ok(r.status === 200 || r.status === 400, 'dice roll request is answered by the Table', 'HTTP ' + r.status);

  // the connection drops (phone changes network); nobody should notice
  es.drop(); await sleep(300);
  await rq('POST', T + '/api/sm/send', { headers: SMH, body: JSON.stringify({ text: 'said while offline', to: 'all' }), host: thost });
  got = await waitFor(() => es.events.find(e => e.data.includes('said while offline')), 9000);
  ok(!!got && es.hellos === 1, 'after a dropped connection the stream resumes with nothing lost', `connects ${es.connects}, hellos ${es.hellos}`);
  const texts = es.events.filter(e => e.ev === 'message' || /"text"/.test(e.data)).map(e => (e.data.match(/"text":"([^"]*)"/) || [])[1]).filter(Boolean);
  ok(new Set(texts).size === texts.length, 'no event arrives twice', texts.length + ' messages');
  await sleep(600); const offline = sm.events.slice(smMark + 1).filter(e => e.ev === 'roster' && /"online":false/.test(e.data)).length;
  ok(offline === 0, 'the player never showed as offline to the Session Master');
  if (kind === 'php') { await sleep(7000); await rq('POST', T + '/api/sm/send', { headers: SMH, body: JSON.stringify({ text: 'after the host cut the stream', to: 'all' }), host: thost }); got = await waitFor(() => es.events.find(e => e.data.includes('after the host cut the stream')), 9000); ok(!!got && es.hellos === 1, 'events keep flowing across the web host\'s response time limit', `connects ${es.connects}`); }

  // files up and down
  const small = crypto.randomBytes(300000), big = crypto.randomBytes(13 * 1024 * 1024);
  r = await rq('POST', U + 'api/p/upload', { headers: { 'X-IPRPS': '1', Cookie: cookie, 'Content-Type': 'image/png', 'X-Filename': 'map.png' }, body: small });
  const mid = r.json?.media?.id; ok(!!mid, 'image upload through the relay');
  r = await rq('GET', U + 'media/' + mid, { headers: { Cookie: cookie } }); ok(r.status === 200 && r.body.equals(small), 'image downloads intact');
  r = await rq('GET', U + 'media/' + mid, { headers: { Cookie: cookie, Range: 'bytes=1000-1999' } }); ok(r.status === 206 && r.body.equals(small.subarray(1000, 2000)), 'range requests work (video seeking)');
  r = await rq('GET', U + 'media/' + mid); ok(r.status === 404, 'media stays private to its audience');
  t0 = Date.now();
  r = await rq('POST', U + 'api/p/upload', { headers: { 'X-IPRPS': '1', Cookie: cookie, 'Content-Type': 'audio/mpeg', 'X-Filename': 'theme.mp3' }, body: big });
  const bid = r.json?.media?.id; const tUp = Date.now() - t0; t0 = Date.now();
  r = bid ? await rq('GET', U + 'media/' + bid, { headers: { Cookie: cookie } }) : { body: Buffer.alloc(0) };
  ok(!!bid && r.body.equals(big), '13 MB file up and down intact', `up ${tUp} ms, down ${Date.now() - t0} ms`);

  await apost('/api/enable', { on: false }); await sleep(500);
  r = await rq('GET', U, { headers: { Accept: 'text/html' } }); ok(r.status === 503 && /isn't connected/.test(r.text.replace(/&#39;|\\'/g, "'")), 'turned off: players get a waiting page');
  es.close(); sm.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
})().catch(e => { console.error(e); failed++; }).finally(() => { for (const k of kids) k.kill(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(failed ? 1 : 0); });
