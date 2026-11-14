#!/usr/bin/env node
'use strict';
// IPRPS Release Desk - walks you through updating IPRPS OS: app updates, new apps, retiring apps,
// security updates, point releases, publishing the package repository, and GitHub.
//   node desk.js web       the Desk in your browser (http://127.0.0.1:7791)
//   node desk.js menu      the same walkthrough in this terminal (any window: DEBIAN ROOT, IPRPS CHROOT, BUILDER)
//   node desk.js status    a summary
// No npm packages. Mythical Legends Publishing, LLC - GPL-2.0-only (part of the iprps-os repository).
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), crypto = require('crypto');
const C = require('./lib/core'), { WF } = require('./lib/workflows'), { A, gitPrefix, ALLOW } = require('./lib/actions');
const VERSION = '1.0';
const PORT = +process.env.IPRPS_DESK_PORT || 7791;
const LOC = C.location();

// ---------- tasks (jobs) ----------
const JOBS = path.join(C.CFG_DIR, 'jobs');
const jobPath = id => path.join(JOBS, id.replace(/[^a-z0-9-]/gi, '') + '.json');
function loadJob(id) { try { return JSON.parse(fs.readFileSync(jobPath(id), 'utf8')); } catch { return null; } }
function saveJob(j) { j.updated = Date.now(); C.writeShared(jobPath(j.id), JSON.stringify(j, null, 2)); }
function listJobs() {
  let f = []; try { f = fs.readdirSync(JOBS).filter(n => n.endsWith('.json')); } catch {}
  return f.map(n => loadJob(n.slice(0, -5))).filter(Boolean).sort((a, b) => b.updated - a.updated);
}
function validate(type, params, cfg) {
  const wf = WF[type]; if (!wf) throw new Error('Unknown task');
  const out = {};
  for (const p of wf.params) {
    let v = params[p.key];
    if (p.type === 'bool') v = v === true || v === 'true' || v === 'yes' || v === 'on' || (v === undefined && !!p.def);
    else {
      v = (v === undefined || v === null) ? (p.def ?? '') : String(v).trim();
      if (p.type === 'path' && v) v = C.fromWinPath(v);
      if (p.required && !v) throw new Error(p.label + ' is needed');
      if (v && p.pattern && !new RegExp(p.pattern).test(v)) throw new Error(p.label + ': ' + (p.help || 'not allowed'));
      if (p.type === 'choice' && !p.choices.some(c => c[0] === v)) v = p.def;
    }
    out[p.key] = v;
  }
  if (type === 'add-app') out.name = out.name.replace(/[\r\n]/g, ' ');
  return out;
}
function newJob(type, params, cfg) {
  const p = validate(type, params, cfg), repo = C.readRepo(cfg);
  if (['update-app', 'retire-app'].includes(type) && repo && !repo.apps.some(a => a.pkg === p.pkg)) throw new Error(p.pkg + ' is not an app in the repository');
  const id = new Date().toISOString().slice(0, 10) + '-' + crypto.randomBytes(3).toString('hex');
  const j = { id, type, params: p, data: {}, steps: {}, created: Date.now() };
  j.title = WF[type].title_of(j, repo); saveJob(j); return j;
}
function stepsOf(job, cfg) { return WF[job.type].steps(job, cfg, C.readRepo(cfg)); }

// ---------- running a step ----------
function srcReady(cfg) { return C.exists(C.P(cfg, 'packages/iprps-apps/PKGBUILD')); }
function wrap(step, cfg) {
  const c = step.cmd, root = C.q(cfg.imageRoot), env = '/usr/bin/env -i HOME=/root TERM=xterm-256color LANG=C.UTF-8 PATH=/usr/bin:/usr/sbin';
  switch (step.where) {
    case 'debian': if (LOC === 'debian-root') return c; throw new Error('Run this in DEBIAN ROOT on the build PC (sudo -i).');
    case 'chroot':
      if (LOC === 'chroot') return c;
      if (LOC === 'debian-root') { if (!C.chrootReady(cfg)) throw new Error('The build image is not open: run  bash /root/iprps-enter.sh  in the IPRPS CHROOT window.'); return `chroot ${root} ${env} /bin/bash --login -c ${C.q(c)}`; }
      throw new Error('Run this in the IPRPS CHROOT window.');
    case 'builder':
      if (LOC === 'builder') return c;
      if (LOC === 'chroot') return `su - builder -c ${C.q(c)}`;
      if (LOC === 'debian-root') { if (!C.chrootReady(cfg)) throw new Error('The build image is not open: run  bash /root/iprps-enter.sh  in the IPRPS CHROOT window.'); return `chroot ${root} ${env} /bin/su - builder -c ${C.q(c)}`; }
      throw new Error('Run this in the BUILDER window.');
    case 'src': {
      if (!C.isDir(path.join(cfg.src, '.git'))) throw new Error('Your repository is not a Git repository here (' + cfg.src + '). Use Prepare GitHub → export, or set up Git (GITHUB-SETUP.md).');
      const u = gitPrefix(cfg), inner = `cd ${C.q(cfg.src)} && ${c}`;
      return u ? `runuser -l ${u} -c ${C.q(inner)}` : inner;
    }
  }
  throw new Error('Do this step yourself (' + C.WHERE_LABEL[step.where] + ').');
}
function canRun(step, cfg) {
  if (step.needsVersions) return { ok: false, why: 'Do the step that sets the versions first.' };
  if (step.action) {
    if (step.action === 'checksums') { if (LOC !== 'debian-root') return { ok: false, why: 'Run this from the Desk in DEBIAN ROOT.' }; if (!C.chrootReady(cfg)) return { ok: false, why: 'The build image is not open.' }; }
    return srcReady(cfg) ? { ok: true } : { ok: false, why: 'Your repository isn\'t reachable here (' + cfg.src + '). Use the Desk in DEBIAN ROOT, or fix Folders.' };
  }
  if (!step.cmd) return { ok: false, why: 'Do this step yourself.' };
  try { wrap(step, cfg); return { ok: true }; } catch (e) { return { ok: false, why: e.message }; }
}
function runIn(where, cmd, cfg) {
  const r = cp.spawnSync('bash', ['-c', wrap({ where, cmd }, cfg)], { encoding: 'utf8', maxBuffer: 64e6 });
  if (r.status) throw new Error((r.stderr || r.stdout || '').trim().split('\n').slice(-5).join('\n') || 'failed');
  return r.stdout;
}
function doAction(job, step, cfg, log) {
  const def = (stepsOf(job, cfg).find(s => s.id === 'changelog') || {}).text?.split('> ')[1] || job.title;
  try { return A[step.action]({ cfg, job, log, def, runIn: (w, c) => runIn(w, c, cfg) }); }
  finally { giveBack(cfg); }
}
// Files the Desk writes as root in a repository someone else owns go back to that owner (so Git and Windows can change them)
function giveBack(cfg) {
  if (!(process.getuid && process.getuid() === 0)) return;
  let st; try { st = fs.statSync(cfg.src); } catch { return; }
  if (st.uid === 0) return;
  cp.spawnSync('find', [cfg.src, '-path', path.join(cfg.src, '.git'), '-prune', '-o', '-uid', '0', '-exec', 'chown', '-h', `${st.uid}:${st.gid}`, '{}', '+'], { stdio: 'ignore' });
}
function mark(job, sid, status, code) { job.steps[sid] = { status, at: Date.now(), code }; saveJob(job); }

// Web runs: output kept for the page
const RUNS = new Map();
function startRun(job, step, cfg) {
  const id = crypto.randomBytes(6).toString('hex'), run = { id, job: job.id, step: step.id, lines: [], done: false, code: null, child: null, started: Date.now() };
  const push = s => { for (const l of String(s).replace(/\r(?!\n)/g, '\n').split('\n')) run.lines.push(l); if (run.lines.length > 20000) run.lines.splice(0, run.lines.length - 20000); };
  RUNS.set(id, run);
  if (step.action) {
    setImmediate(() => {
      let ok = false;
      try { ok = doAction(job, step, cfg, push); } catch (e) { push('STOPPED: ' + e.message); }
      run.done = true; run.code = ok ? 0 : 1; mark(job, step.id, ok ? 'done' : 'failed', run.code);
    });
    return run;
  }
  const cmd = wrap(step, cfg);
  push('$ ' + step.cmd.split('\n').join('\n  '));
  const child = cp.spawn('bash', ['-c', cmd], { env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', TERM: 'dumb', LANG: process.env.LANG || 'C.UTF-8' }), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  run.child = child;
  let buf = { out: '', err: '' };
  const feed = k => d => { buf[k] += d.toString(); const i = buf[k].lastIndexOf('\n'); if (i >= 0) { push(buf[k].slice(0, i).replace(/\x1b\[[0-9;]*m/g, '')); buf[k] = buf[k].slice(i + 1); } };
  child.stdout.on('data', feed('out')); child.stderr.on('data', feed('err'));
  child.on('close', code => {
    for (const k of ['out', 'err']) if (buf[k]) push(buf[k].replace(/\x1b\[[0-9;]*m/g, ''));
    run.done = true; run.code = code; push(code === 0 ? '✔ Finished.' : run.stopped ? '■ Stopped.' : '✘ Exit code ' + code + '.');
    mark(job, step.id, code === 0 || (run.stopped && step.long) ? 'done' : 'failed', code);
  });
  child.on('error', e => { push('STOPPED: ' + e.message); });
  return run;
}

// ---------- status ----------
function repoList(cfg) {
  if (LOC !== 'debian-root' || !C.exists(cfg.repoScript)) return null;
  const r = cp.spawnSync('bash', ['-c', `IPRPS_REPO_DIR=${C.q(cfg.repoDir)} ${C.q(cfg.repoScript)} list`], { encoding: 'utf8', timeout: 20000 });
  if (r.status) return null;
  const out = {}; let cur = null;
  for (const l of r.stdout.split('\n')) {
    const h = /^== (\S+)/.exec(l); if (h) { cur = h[1]; continue; }
    const m = /^\s+(.+)-([^-]+-[^-]+)-[^-]+\.pkg\.tar\.zst$/.exec(l); if (m && cur) out[m[1]] = { repo: cur, version: m[2] };
  }
  return out;
}
function gitSummary(cfg) {
  if (!C.isDir(path.join(cfg.src, '.git'))) return null;
  try {
    const u = gitPrefix(cfg), args = ['-C', cfg.src, 'status', '--porcelain', '-b'];
    const r = u ? cp.spawnSync('runuser', ['-u', u, '--', 'git', ...args], { encoding: 'utf8', timeout: 20000 }) : cp.spawnSync('git', args, { encoding: 'utf8', timeout: 20000 });
    if (r.status) return { error: (r.stderr || '').trim() };
    const lines = r.stdout.split('\n').filter(Boolean), head = lines.shift() || '';
    return { branch: (/^## ([^.\s]+)/.exec(head) || [])[1] || '?', ahead: +((/ahead (\d+)/.exec(head) || [])[1] || 0), changed: lines.length };
  } catch (e) { return { error: e.message }; }
}
function status(cfg) {
  const repo = C.readRepo(cfg), pub = repoList(cfg);
  let built = []; try { built = fs.readdirSync(cfg.imageRoot + cfg.pkgOut).filter(f => f.endsWith('.pkg.tar.zst')); } catch {}
  const apps = repo ? repo.apps.map(a => {
    const v = repo.appsVer + '-' + repo.appsRel, b = built.includes(C.pkgFile(a.pkg, repo.appsVer, repo.appsRel, 'any'));
    return Object.assign({}, a, { version: v, built: b, published: pub ? (pub[a.pkg] || {}).version || '' : null });
  }) : [];
  return { loc: LOC, locLabel: C.LOC_LABEL[LOC], src: cfg.src, srcOk: !!repo, image: C.mounted(cfg.imageRoot), chroot: C.chrootReady(cfg),
    key: LOC === 'debian-root' ? C.exists('/root/.iprps-signing-key') : null, git: gitSummary(cfg),
    versions: repo ? { apps: repo.appsVer + '-' + repo.appsRel, base: repo.baseVer + '-' + repo.baseRel, basePublished: pub ? (pub['iprps-base'] || {}).version || '' : null } : null,
    apps, retired: repo ? repo.retired : [], pkgDirs: repo ? repo.pkgDirs : [], examples: repo ? repo.examples : [], published: !!pub };
}

// ---------- web server ----------
const UI = path.join(__dirname, 'ui');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
function jobView(job, cfg) {
  const steps = stepsOf(job, cfg).map((s, i) => Object.assign({ n: i + 1, whereLabel: C.WHERE_LABEL[s.where], state: (job.steps[s.id] || {}).status || '' }, s, canRun(s, cfg)));
  const runs = [...RUNS.values()].filter(r => r.job === job.id && !r.done).map(r => ({ id: r.id, step: r.step }));
  return { job, steps, runs, findings: job.data.findings || [] };
}
function browse(p, cfg) {
  p = C.fromWinPath(p || cfg.incoming); if (!C.isDir(p)) p = C.isDir(cfg.incoming) ? cfg.incoming : (C.isDir(cfg.src) ? cfg.src : require('os').homedir());
  let entries = []; try { entries = fs.readdirSync(p, { withFileTypes: true }).filter(e => !e.name.startsWith('.') && (e.isDirectory() || /\.zip$/i.test(e.name))).map(e => ({ name: e.name, dir: e.isDirectory() })).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name)); } catch {}
  const places = [['Incoming', cfg.incoming], ['Repository', cfg.src], ['Home', require('os').homedir()]];
  if (C.IS_WSL) for (const d of 'cdefg') if (C.isDir('/mnt/' + d)) places.push([d.toUpperCase() + ':', '/mnt/' + d]);
  return { path: p, win: C.winPath(p), parent: path.dirname(p), entries: entries.slice(0, 500), places: places.filter(x => C.isDir(x[1])) };
}
function serve() {
  const token = crypto.randomBytes(18).toString('base64url');
  const server = http.createServer(async (req, res) => {
    const send = (code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(type === 'application/json' ? JSON.stringify(obj) : obj); };
    const host = (req.headers.host || '').replace(/:\d+$/, '');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return send(403, { error: 'forbidden' });
    const u = new URL(req.url, 'http://x');
    if (!u.pathname.startsWith('/api/')) {
      const f = path.join(UI, u.pathname === '/' ? 'index.html' : path.normalize(u.pathname).replace(/^(\.\.[\/\\])+/, ''));
      if (!f.startsWith(UI) || !C.exists(f)) return send(404, 'Not found', 'text/plain');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'" });
      return fs.createReadStream(f).pipe(res);
    }
    if (req.headers['x-desk-token'] !== token) return send(401, { error: 'Open the Desk with the link it printed (it carries a key).' });
    let body = {};
    if (req.method === 'POST') { let b = ''; for await (const c of req) { b += c; if (b.length > 1e6) return send(413, { error: 'too large' }); } try { body = JSON.parse(b || '{}'); } catch { return send(400, { error: 'bad JSON' }); } }
    const cfg = C.loadConfig();
    try {
      const r = u.pathname, m = /^\/api\/job\/([\w-]+)(?:\/(\w+))?$/.exec(r);
      if (r === '/api/state') return send(200, { version: VERSION, loc: LOC, locLabel: C.LOC_LABEL[LOC], wsl: C.IS_WSL, cfg, fields: C.FIELDS, folders: C.checkFolders(cfg, LOC),
        workflows: Object.entries(WF).map(([id, w]) => ({ id, title: w.title, icon: w.icon, blurb: w.blurb, params: w.params })),
        jobs: listJobs().map(j => ({ id: j.id, title: j.title, type: j.type, updated: j.updated, done: Object.values(j.steps).filter(s => s.status === 'done' || s.status === 'skipped').length, total: (() => { try { return stepsOf(j, cfg).length; } catch { return 0; } })() })) });
      if (r === '/api/status') return send(200, status(cfg));
      if (r === '/api/config' && req.method === 'POST') { const c = C.saveConfig(body.values || {}); return send(200, { cfg: c, folders: C.checkFolders(c, LOC) }); }
      if (r === '/api/mkdir' && req.method === 'POST') { const f = C.FIELDS.find(x => x.key === body.key && x.kind === 'dir'); if (!f) throw new Error('not a folder setting'); fs.mkdirSync(cfg[f.key], { recursive: true }); return send(200, { folders: C.checkFolders(cfg, LOC) }); }
      if (r === '/api/browse' && req.method === 'POST') return send(200, browse(body.path, cfg));
      if (r === '/api/new' && req.method === 'POST') { const j = newJob(body.type, body.params || {}, cfg); return send(200, jobView(j, cfg)); }
      if (m) {
        const job = loadJob(m[1]); if (!job) return send(404, { error: 'No such task' });
        const act = m[2] || '';
        if (!act) return send(200, jobView(job, cfg));
        if (req.method !== 'POST') return send(405, { error: 'POST' });
        if (act === 'delete') { [...RUNS.values()].filter(x => x.job === job.id && !x.done).forEach(x => { try { process.kill(-x.child.pid, 'SIGTERM'); } catch {} }); fs.rmSync(jobPath(job.id), { force: true }); return send(200, { ok: true }); }
        const step = stepsOf(job, cfg).find(s => s.id === body.step); if (!step) throw new Error('No such step');
        if (act === 'mark') { if (!['done', 'skipped', ''].includes(body.status)) throw new Error('bad status'); if (body.status) mark(job, step.id, body.status); else { delete job.steps[step.id]; saveJob(job); } return send(200, jobView(job, cfg)); }
        if (act === 'allow') { const f = job.data.findings || []; if (!f.length) throw new Error('Nothing to mark'); C.allowFindings(ALLOW(cfg), f); job.data.findings = []; saveJob(job); return send(200, jobView(job, cfg)); }
        if (act === 'run') {
          if ([...RUNS.values()].some(x => x.job === job.id && !x.done)) throw new Error('A step of this task is still running.');
          const can = canRun(step, cfg); if (!can.ok) throw new Error(can.why);
          const run = startRun(job, step, cfg); return send(200, { run: run.id });
        }
        throw new Error('unknown');
      }
      const rm = /^\/api\/run\/(\w+)(?:\/(stop))?$/.exec(r);
      if (rm) {
        const run = RUNS.get(rm[1]); if (!run) return send(404, { error: 'No such run' });
        if (rm[2]) { if (!run.done && run.child) { run.stopped = true; try { process.kill(-run.child.pid, 'SIGTERM'); } catch {} } return send(200, { ok: true }); }
        const from = Math.max(0, +u.searchParams.get('from') || 0);
        return send(200, { lines: run.lines.slice(from), next: run.lines.length, done: run.done, code: run.code });
      }
      return send(404, { error: 'not found' });
    } catch (e) { return send(400, { error: e.message }); }
  });
  server.on('error', e => { if (e.code === 'EADDRINUSE') { console.error(`Port ${PORT} is in use: the Desk is probably already running (its window shows the link). Or start it on another port: IPRPS_DESK_PORT=7792 iprps-desk`); process.exit(1); } throw e; });
  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}/#k=${token}`;
    console.log(`\n  IPRPS Release Desk ${VERSION}  —  running in ${C.LOC_LABEL[LOC]}\n\n  Open:  ${url}\n\n  Keep this window open while you use the Desk. Ctrl+C stops it.\n`);
    openBrowser(url);
  });
  const stop = () => { for (const r of RUNS.values()) if (!r.done && r.child) try { process.kill(-r.child.pid, 'SIGTERM'); } catch {} process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
function openBrowser(url) {
  if (process.env.IPRPS_DESK_NO_BROWSER) return;
  const tryRun = (cmd, args) => { try { const c = cp.spawn(cmd, args, { stdio: 'ignore', detached: true }); c.on('error', () => {}); c.unref(); return true; } catch { return false; } };
  if (C.IS_WSL) { const ps = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'; if (C.exists(ps)) return tryRun(ps, ['-NoProfile', '-Command', `Start-Process '${url}'`]); }
  if (process.platform === 'darwin') return tryRun('open', [url]);
  if (process.platform === 'win32') return tryRun('cmd', ['/c', 'start', '', url]);
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) tryRun('xdg-open', [url]);
}

// ---------- terminal menu ----------
const T = { b: s => `\x1b[1m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, c: s => `\x1b[36m${s}\x1b[0m` };
const WHERE_COLOR = { debian: '\x1b[1;44;97m', chroot: '\x1b[1;45;97m', builder: '\x1b[1;42;30m', desk: '\x1b[1;43;30m', src: '\x1b[1;43;30m', vm: '\x1b[1;46;30m', windows: '\x1b[1;47;30m' };
const md = s => String(s).replace(/\*\*(.+?)\*\*/g, (_, x) => T.b(x)).replace(/`([^`]+)`/g, (_, x) => T.c(x));
async function menu() {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, a => r(a.trim())));
  const cfg = () => C.loadConfig();
  for (;;) {
    console.log('\n' + T.b('IPRPS Release Desk') + '  —  you are in ' + T.b(C.LOC_LABEL[LOC]) + T.dim('   (repository: ' + cfg().src + (srcReady(cfg()) ? '' : ', not reachable here') + ')'));
    const jobs = listJobs().slice(0, 9);
    jobs.forEach((j, i) => { const st = stepsOf(j, cfg()); const d = st.filter(s => ['done', 'skipped'].includes((j.steps[s.id] || {}).status)).length; console.log(`  ${i + 1}) ${j.title}  ${T.dim(d + '/' + st.length + ' steps')}`); });
    console.log(`  n) New task   f) Folders   s) Status   q) Quit`);
    const a = (await ask('> ')).toLowerCase();
    if (a === 'q') break;
    if (a === '') continue;
    if (a === 's') { printStatus(cfg()); continue; }
    if (a === 'f') { await folders(ask); continue; }
    if (a === 'n') { const j = await newTask(ask); if (j) await walk(j, ask); continue; }
    const j = jobs[+a - 1]; if (j) await walk(loadJob(j.id), ask);
  }
  rl.close();
}
function printStatus(cfg) {
  const s = status(cfg);
  console.log(`\n  Location: ${s.locLabel}   Build image: ${s.image ? T.g('open') : T.y('closed')}${s.chroot ? '' : s.image ? T.y(' (not fully mounted)') : ''}   Signing key: ${s.key === null ? 'n/a' : s.key ? T.g('yes') : T.r('missing')}`);
  if (s.git) console.log(`  Git: ${s.git.error ? T.r(s.git.error) : `branch ${s.git.branch}, ${s.git.changed} changed file(s)${s.git.ahead ? ', ' + s.git.ahead + ' commit(s) not pushed' : ''}`}`);
  if (s.versions) console.log(`  Versions: iprps-apps ${s.versions.apps}, iprps-base ${s.versions.base}${s.versions.basePublished ? ' (published ' + s.versions.basePublished + ')' : ''}`);
  for (const a of s.apps) console.log(`   ${a.name.padEnd(28)} ${a.pkg.padEnd(34)} ${a.edition.padEnd(9)} ${a.published === null ? '' : a.published ? 'published ' + a.published : T.y('not published')}`);
  if (s.retired.length) console.log('  Retired: ' + s.retired.join(' '));
}
async function folders(ask) {
  const cfg = C.loadConfig(), chk = C.checkFolders(cfg, LOC);
  C.FIELDS.forEach((f, i) => { const c = chk[i]; console.log(`  ${String(i + 1).padStart(2)}) ${f.label}\n      ${cfg[f.key]}${c.win ? T.dim('  (' + c.win + ')') : ''}  ${c.state === 'ok' ? T.g('✔') : c.state === 'n/a' ? '' : T.y(c.state)} ${T.dim(c.note || '')}`); });
  const n = +(await ask('Number to change (Enter: back): ')); const f = C.FIELDS[n - 1]; if (!f) return;
  const v = await ask(`${f.label} [${cfg[f.key]}]: `); if (v) { C.saveConfig({ [f.key]: v }); console.log(T.g('Saved.')); }
}
async function newTask(ask) {
  const ids = Object.keys(WF); ids.forEach((id, i) => console.log(`  ${i + 1}) ${WF[id].title}  ${T.dim(WF[id].blurb)}`));
  const w = ids[+(await ask('Task: ')) - 1]; if (!w) return null;
  const cfg = C.loadConfig(), repo = C.readRepo(cfg), params = {};
  for (const p of WF[w].params) {
    let choices = p.type === 'choice' ? p.choices : p.type === 'app' ? (repo ? repo.apps.map(a => [a.pkg, a.name + ' (' + a.pkg + ')']) : null) : p.type === 'package' ? (repo ? repo.pkgDirs.map(d => [d, d]) : null) : null;
    if (p.help) console.log(T.dim('  ' + p.help));
    if (choices) { choices.forEach((c, i) => console.log(`    ${i + 1}) ${c[1]}`)); const a = await ask(`${p.label}${p.def ? ' [' + (choices.findIndex(c => c[0] === p.def) + 1) + ']' : ''}: `); params[p.key] = a ? (choices[+a - 1] || [])[0] : p.def; }
    else if (p.type === 'bool') params[p.key] = /^y/i.test(await ask(`${p.label} (y/n) [${p.def ? 'y' : 'n'}]: `) || (p.def ? 'y' : 'n'));
    else params[p.key] = await ask(`${p.label}${p.def ? ' [' + p.def + ']' : ''}: `) || p.def || '';
  }
  try { const j = newJob(w, params, cfg); console.log(T.g('Task saved: ' + j.title)); return j; } catch (e) { console.log(T.r(e.message)); return null; }
}
async function walk(job, ask) {
  for (;;) {
    const cfg = C.loadConfig(), steps = stepsOf(job, cfg);
    let i = steps.findIndex(s => !['done', 'skipped'].includes((job.steps[s.id] || {}).status));
    if (i < 0) { console.log(T.g('\nAll steps of "' + job.title + '" are done.')); return; }
    console.log('\n' + T.b(job.title));
    steps.forEach((s, k) => { const st = (job.steps[s.id] || {}).status; console.log(`  ${st === 'done' ? T.g('✔') : st === 'skipped' ? T.dim('–') : st === 'failed' ? T.r('✘') : k === i ? T.y('▶') : ' '} ${String(k + 1).padStart(2)}. ${WHERE_COLOR[s.where]} ${C.WHERE_LABEL[s.where]} \x1b[0m ${s.title}${s.optional ? T.dim(' (optional)') : ''}`); });
    const s = steps[i];
    console.log(`\n${T.b('Step ' + (i + 1) + ': ' + s.title)}  ${WHERE_COLOR[s.where]} ${C.WHERE_LABEL[s.where]} \x1b[0m\n${md(s.text || '')}`);
    if (s.cmd) console.log('\n' + T.c(s.cmd.split('\n').map(l => '    ' + l).join('\n')));
    const can = canRun(s, cfg);
    if (!can.ok && (s.cmd || s.action)) console.log(T.y('\n  Not here: ' + can.why));
    const a = (await ask(`\n${can.ok ? '[Enter] run  ' : ''}d) done  s) skip  g <n>) go to step  b) back to the menu: `)).toLowerCase();
    if (a === 'b' || a === 'q') return;
    if (a === 'd') { mark(job, s.id, 'done'); continue; }
    if (a === 's') { mark(job, s.id, 'skipped'); continue; }
    const g = /^g\s*(\d+)$/.exec(a); if (g) { const t = steps[+g[1] - 1]; if (t) { for (const x of steps.slice(+g[1] - 1)) delete job.steps[x.id]; saveJob(job); } continue; }
    if (a === '' && can.ok) {
      let ok;
      if (s.action) { try { ok = doAction(job, s, cfg, l => console.log('  ' + l)); } catch (e) { console.log(T.r('  STOPPED: ' + e.message)); ok = false; } saveJob(job); }
      else { const r = cp.spawnSync('bash', ['-c', wrap(s, cfg)], { stdio: 'inherit' }); ok = r.status === 0 || (s.long && r.signal === 'SIGINT'); }
      mark(job, s.id, ok ? 'done' : 'failed', ok ? 0 : 1);
      console.log(ok ? T.g('✔ Done.') : T.r('✘ The step did not finish. Fix it and run it again, or mark it done if you did it another way.'));
      if (!ok && (job.data.findings || []).length && s.action && /^scan/.test(s.action)) {
        if ((await ask('Mark these findings as safe (they are not secrets)? Type yes: ')) === 'yes') { C.allowFindings(ALLOW(cfg), job.data.findings); job.data.findings = []; saveJob(job); }
      }
    }
  }
}

// ---------- main ----------
if (require.main === module) {
  const cmd = process.argv[2] || 'web';
  if (cmd === 'web') serve();
  else if (cmd === 'menu') menu();
  else if (cmd === 'status') printStatus(C.loadConfig());
  else { console.log('usage: iprps-desk [web|menu|status]'); process.exit(1); }
}
module.exports = { newJob, stepsOf, canRun, wrap, doAction, status };
