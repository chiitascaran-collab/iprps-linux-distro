#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-only
// IPRPS Link relay (PHP) as a service for many Session Masters: open sign-up, approval, addresses, plans and limits,
// the dashboard API and its access rules.   node tests/iprps-link/service.js      (needs php)
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iprps-relay-svc-'));
const P = { auth: 18800, relay: 18887 }, RELAY = `http://127.0.0.1:${P.relay}`, ORIGIN = 'https://infiniteplane.space';
const USERS = { ['a'.repeat(64)]: { id: 7, username: 'james', email: 'j@example.com', first_name: 'James', last_name: 'J' },
  ['b'.repeat(64)]: { id: 8, username: 'Marisol', email: 'm@example.com' }, ['c'.repeat(64)]: { id: 9, username: 'thorne', email: 't@example.com' },
  ['d'.repeat(64)]: { id: 10, username: 'newbie', email: 'n@example.com' }, ['e'.repeat(64)]: { id: 11, username: 'x', email: 'x@example.com' } };
const [JAMES, MARISOL, THORNE, NEWBIE, SHORT] = Object.keys(USERS);
let failed = 0; const kids = [], sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (cond, msg, extra = '') => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
function rq(method, url, { headers = {}, body = null, timeout = 15000 } = {}) {
  return new Promise(resolve => {
    const r = http.request(url, { method, headers, timeout }, res => { const b = []; res.on('data', d => b.push(d)); res.on('end', () => { const t = Buffer.concat(b).toString(); let j = null; try { j = JSON.parse(t); } catch {} resolve({ status: res.statusCode, headers: res.headers, text: t, json: j }); }); });
    r.on('timeout', () => { r.destroy(); resolve({ status: 0 }); }); r.on('error', () => resolve({ status: 0 })); if (body) r.write(body); r.end();
  });
}
const open = tok => rq('POST', `${RELAY}/_link/open`, { headers: { 'X-Auth-Token': tok, 'Content-Type': 'application/json' }, body: '{}' });
const admin = (op, body, tok = JAMES, origin = ORIGIN) => rq(body ? 'POST' : 'GET', `${RELAY}/_admin/${op}`, { headers: { 'X-Auth-Token': tok, 'Content-Type': 'application/json', Origin: origin }, body: body ? JSON.stringify(body) : null });
const master = async name => (await admin('list')).json.masters.find(m => m.username === name);

(async () => {
  http.createServer((req, res) => { req.resume(); req.on('end', () => { const u = USERS[req.headers['x-auth-token']]; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(u ? { ok: true, user: u } : { ok: false })); }); }).listen(P.auth, '127.0.0.1');
  const dir = tmp + '/play'; fs.mkdirSync(dir); fs.copyFileSync(path.join(ROOT, 'relay/php/index.php'), dir + '/index.php');
  fs.writeFileSync(dir + '/config.php', `<?php return ['auth_url' => 'http://127.0.0.1:${P.auth}/', 'data_dir' => '${tmp}/data', 'base_path' => '', 'access' => 'open', 'admins' => ['james'], 'contact' => 'help@example.com'];`);
  const k = spawn('php', ['-S', `127.0.0.1:${P.relay}`, '-t', dir, dir + '/index.php'], { env: { ...process.env, PHP_CLI_SERVER_WORKERS: '16' }, stdio: 'ignore' }); kids.push(k);
  await sleep(900);

  console.log('== open sign-up');
  let r = await open(JAMES); ok(r.status === 200 && r.json.url === `${RELAY}/james/`, 'first Session Master is added and gets their own address', r.json?.url);
  const jamesKey = r.json.key, jamesTable = r.json.table;
  r = await open(MARISOL); ok(r.status === 200 && r.json.url === `${RELAY}/marisol/` && r.json.table !== jamesTable, 'a second Session Master gets a separate table and address', r.json?.url);
  const marisolKey = r.json.key, marisolTable = r.json.table;
  r = await open(SHORT); ok(r.status === 200 && /\/sm-[0-9a-f]{6}\/$/.test(r.json.url), 'a username too short for an address gets a generated one', r.json?.url);
  r = await open(JAMES); ok(r.status === 200 && r.json.table === jamesTable, 'the same account always gets the same table');

  console.log('== dashboard access');
  r = await admin('overview', null, MARISOL); ok(r.status === 403, 'a Session Master who is not an admin is refused', r.json?.error);
  r = await admin('overview', null, 'f'.repeat(64)); ok(r.status === 401, 'no valid sign-in, no dashboard');
  r = await admin('overview', null, JAMES, 'https://evil.example'); ok(r.status === 403, 'another web page cannot use the dashboard API');
  r = await rq('OPTIONS', `${RELAY}/_admin/list`, { headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-auth-token,content-type' } });
  ok(r.status === 204 && r.headers['access-control-allow-origin'] === ORIGIN && r.headers['access-control-allow-credentials'] === 'true', 'the dashboard page is allowed (CORS)');
  r = await admin('overview'); ok(r.status === 200 && r.json.registered === 3 && r.json.status.active === 3 && r.headers['access-control-allow-origin'] === ORIGIN, 'overview: 3 Session Masters, all active', `online ${r.json?.online}`);
  r = await admin('list'); const m = r.json.masters.find(x => x.username === 'Marisol');
  ok(r.json.masters.length === 3 && m.link === `${RELAY}/marisol/` && m.usage.sessions === 1 && m.email === 'm@example.com', 'list shows each Session Master with address and usage');

  console.log('== suspend, address, delete');
  r = await admin('update', { id: '8', status: 'suspended', note: 'test' }); ok(r.status === 200 && r.json.master.status === 'suspended', 'suspend a Session Master');
  r = await rq('GET', `${RELAY}/_link/poll?table=${marisolTable}&wait=1`, { headers: { 'X-Link-Key': marisolKey } }); ok(r.status === 401, 'their connected table is let go');
  r = await open(MARISOL); ok(r.status === 403 && /paused/.test(r.json.error) && /help@example\.com/.test(r.json.error), 'they cannot reconnect, and see why', r.json?.error);
  r = await admin('update', { id: '8', status: 'active' }); r = await open(MARISOL); ok(r.status === 200, 'reactivated: they connect again');
  r = await admin('update', { id: '7', name: 'marisol' }); ok(r.status === 409, 'two Session Masters cannot share an address');
  r = await admin('update', { id: '7', name: 'admin' }); ok(r.status === 400, 'reserved words cannot be addresses');
  r = await admin('update', { id: '7', name: 'gm-james' }); ok(r.status === 200 && r.json.master.link === `${RELAY}/gm-james/`, 'change an address');
  r = await open(JAMES); ok(r.json.url === `${RELAY}/gm-james/`, 'their next connection uses the new address');
  r = await rq('GET', `${RELAY}/gm-james`); ok(r.status === 302 && r.headers.location === '/gm-james/', 'the address without a slash goes to the table');
  r = await rq('GET', `${RELAY}/james/`, { headers: { Accept: 'text/html' } }); ok(r.status === 404, 'the old address is free again');
  r = await rq('GET', `${RELAY}/nobody-here/`); ok(r.status === 404, 'unknown addresses are not found');

  console.log('== plans and limits');
  r = await admin('update', { id: '7', limits: { gb_per_month: 0.000001 } }); ok(r.status === 200 && r.json.master.effective.gb_per_month === 0.000001, 'a Session Master gets their own limit');
  const up = rq('POST', `${RELAY}/gm-james/api/media`, { headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(5000, 1), timeout: 1500 });
  await up; r = await master('james'); ok(r.usage.in >= 5000, 'players\' uploads are counted', r.usage.in + ' bytes');
  r = await open(JAMES); ok(r.status === 403 && /GB/.test(r.json.error), 'over the plan\'s data: refused with the reason', r.json?.error);
  r = await admin('update', { id: '7', limits: {} }); r = await open(JAMES); ok(r.status === 200, 'limit removed: connects again');
  r = await admin('settings', { settings: { plans: { free: { label: 'Free', hours_per_month: 10, gb_per_month: 5, max_upload_mb: 15 }, monthly: { label: 'Monthly', hours_per_month: 0, gb_per_month: 0, max_upload_mb: 20 } }, default_plan: 'free' } });
  ok(r.status === 200, 'plans changed in the dashboard');
  r = await master('james'); ok(r.effective.hours_per_month === 10 && r.effective.max_upload_mb === 15, 'the plan\'s limits apply');
  r = await admin('update', { id: '7', plan: 'monthly' }); ok(r.json.master.effective.hours_per_month === 0, 'move a Session Master to another plan');
  r = await admin('update', { id: '7', plan: 'gold' }); ok(r.status === 400, 'unknown plans are refused');
  r = await admin('settings', { settings: { default_plan: 'nope' } }); ok(r.status === 400, 'the default plan must exist');

  console.log('== approval, pre-approval, capacity');
  r = await admin('settings', { settings: { access: 'approval' } }); ok(r.status === 200, 'switch to approval');
  r = await open(THORNE); ok(r.status === 403 && /waiting/.test(r.json.error), 'a new Session Master waits for approval', r.json?.error);
  r = await admin('overview'); ok(r.json.status.pending === 1 && r.json.settings.access === 'approval', 'the dashboard shows one waiting');
  r = await admin('update', { id: '9', status: 'active' }); r = await open(THORNE); ok(r.status === 200 && r.json.url === `${RELAY}/thorne/`, 'approved: they connect');
  r = await admin('invite', { who: 'NEWBIE', plan: 'monthly', status: 'blocked', note: 'pre-set' }); ok(r.status === 200, 'pre-set an account that has not connected yet');
  r = await admin('invite', { who: 'thorne' }); ok(r.status === 409, 'cannot pre-set someone already listed');
  r = await admin('invites'); ok(r.json.invites.length === 1 && r.json.invites[0].who === 'newbie', 'pre-set accounts are listed');
  r = await open(NEWBIE); ok(r.status === 403 && /can.t use this relay/.test(r.json.error), 'the pre-set status applies on their first connection', r.json?.error);
  r = await master('newbie'); ok(r.plan === 'monthly' && r.note === 'pre-set' && r.invited, 'and the pre-set plan and note');
  r = await admin('invites'); ok(r.json.invites.length === 0, 'the pre-set entry is used up');
  r = await admin('settings', { settings: { max_online_tables: 2, access: 'open' } });
  r = await open(NEWBIE); ok(r.status === 403, 'blocked stays blocked in open mode');
  r = await admin('overview'); const onl = r.json.online;
  r = await admin('update', { id: '10', status: 'active' }); r = await open(NEWBIE); ok(r.status === 503 && /full/.test(r.json.error), `the relay is full at its limit (${onl} online)`, r.json?.error);
  r = await admin('settings', { settings: { max_online_tables: 0 } }); r = await open(NEWBIE); ok(r.status === 200, 'no limit: they connect');

  console.log('== disconnect, delete, activity');
  r = await open(JAMES); const jk = r.json.key;
  r = await admin('disconnect', { id: '7' }); r = await rq('GET', `${RELAY}/_link/poll?table=${jamesTable}&wait=1`, { headers: { 'X-Link-Key': jk } }); ok(r.status === 401, 'disconnect a table now');
  r = await admin('delete', { id: '9' }); r = await admin('list'); ok(r.json.masters.length === 4 && !r.json.masters.some(x => x.username === 'thorne'), 'delete a Session Master');
  r = await rq('GET', `${RELAY}/thorne/`); ok(r.status === 404, 'their address is freed');
  r = await admin('log'); const types = new Set(r.json.events.map(e => e.type));
  ok(['register', 'connect', 'refused', 'admin-update', 'admin-settings', 'admin-invite', 'admin-delete', 'full'].every(t => types.has(t)), 'the activity log records it all', [...types].join(' '));
  r = await rq('GET', `${RELAY}/`); ok(r.status === 200 && /help@example\.com/.test(r.text) && r.headers['x-robots-tag'], 'the front page shows the contact and stays out of search engines');
  r = await rq('GET', `${RELAY}/data/settings.json`); ok(r.status === 404 || r.status === 403, 'the data folder is not served', 'HTTP ' + r.status);
  for (const f of ['secret', 'settings.json']) ok(!fs.readFileSync(`${tmp}/data/${f}`, 'utf8').includes('aaaa'), `no sign-in token is stored (${f})`);
  ok(!fs.readdirSync(`${tmp}/data/sm`).some(f => fs.readFileSync(`${tmp}/data/sm/${f}`, 'utf8').includes('aaaaaaaa')), 'no sign-in token in the Session Master records');

  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  kids.forEach(k => k.kill()); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); kids.forEach(k => k.kill()); process.exit(1); });
