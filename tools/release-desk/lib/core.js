'use strict';
// IPRPS Release Desk - settings, where we are, reading and editing the repository's recipes.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');

const read = (p, d = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return d; } };
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const q = s => /^[\w\/.,:=@%+-]+$/.test(String(s)) ? String(s) : "'" + String(s).replace(/'/g, "'\\''") + "'";   // shell quoting, only when needed
const IS_WSL = /microsoft/i.test(read('/proc/version'));

// ---------- where am I ----------
function location() {
  if (process.env.IPRPS_DESK_AS) return process.env.IPRPS_DESK_AS;   // for testing the walkthroughs elsewhere
  if (process.platform === 'win32') return 'windows';
  const osr = read('/etc/os-release');
  const uid = process.getuid ? process.getuid() : -1;
  let user = ''; try { user = os.userInfo().username; } catch {}
  if (/^ID="?iprps/m.test(osr) && exists('/build')) return uid === 0 ? 'chroot' : (user === 'builder' ? 'builder' : 'iprps');
  if (process.platform === 'darwin') return 'mac';
  if (uid === 0 && (IS_WSL || exists('/root/iprps-enter.sh')) && /^ID="?debian/m.test(osr)) return 'debian-root';
  return 'linux';
}
const LOC_LABEL = { 'debian-root': 'DEBIAN ROOT', chroot: 'IPRPS CHROOT', builder: 'BUILDER', iprps: 'IPRPS OS',
  mac: 'MAC', linux: 'LINUX', windows: 'WINDOWS' };
const WHERE_LABEL = { desk: 'RELEASE DESK', debian: 'DEBIAN ROOT', chroot: 'IPRPS CHROOT', builder: 'BUILDER',
  src: 'RELEASE DESK', vm: 'TEST VM', windows: 'WINDOWS' };

// ---------- settings ----------
// On the build PC the Desk keeps its settings and tasks in /build, which Debian and the image both see, so a task
// started in DEBIAN ROOT continues in the BUILDER or IPRPS CHROOT window (iprps-desk menu) and the other way round.
const CFG_DIR = process.env.IPRPS_DESK_HOME || (isDir('/build/src') ? '/build/.iprps-desk' : path.join(os.homedir(), '.config', 'iprps-desk'));
const SHARED = CFG_DIR.startsWith('/build/');
function writeShared(p, text) {   // root and builder both update these files
  fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text);
  if (SHARED) { try { fs.chmodSync(path.dirname(p), 0o777); fs.chmodSync(p, 0o666); } catch {} }
}
const G = IS_WSL ? '/mnt/g/IPRPS' : path.join(os.homedir(), 'IPRPS');
const FIELDS = [
  { key: 'src', label: 'Local repository (your Git copy of iprps-os)', def: G + '/iprps-os', kind: 'dir', group: 'Your folders',
    help: 'Every change is made here first. On the build PC this is G:\\IPRPS\\iprps-os.' },
  { key: 'incoming', label: 'Incoming folder (new app versions you download)', def: G + '/incoming', kind: 'dir', group: 'Your folders',
    help: 'Where you put new app folders or .zip files. The Browse button starts here.' },
  { key: 'repoUpload', label: 'Upload folder for the package repository', def: G + '/repo-upload/1', kind: 'dir', group: 'Your folders',
    help: 'iprps-repo.sh stage copies the signed packages here; FileZilla uploads its contents.' },
  { key: 'githubOut', label: 'GitHub upload folder (for the web uploader)', def: G + '/github-upload', kind: 'dir', group: 'Your folders',
    help: 'Changed files are copied here when you prepare GitHub without git push.' },
  { key: 'image', label: 'Build image file', def: '/root/iprps-system.img', kind: 'file', group: 'Build PC (Debian)' },
  { key: 'imageRoot', label: 'Where the build image is opened', def: '/mnt/iprps', kind: 'dir', group: 'Build PC (Debian)',
    help: 'bash /root/iprps-enter.sh opens the image here.' },
  { key: 'buildSrc', label: 'Repository copy inside the image', def: '/build/src/iprps-os', kind: 'text', group: 'Build PC (Debian)',
    help: 'As BUILDER and IPRPS CHROOT see it. Debian sees it under the image folder.' },
  { key: 'pkgOut', label: 'Built packages (inside the image)', def: '/build/repo', kind: 'text', group: 'Build PC (Debian)' },
  { key: 'repoScript', label: 'Repository script', def: '/root/iprps-repo.sh', kind: 'file', group: 'Build PC (Debian)' },
  { key: 'repoDir', label: 'Signed package repository (master copy)', def: '/root/iprps-repo/1', kind: 'dir', group: 'Build PC (Debian)' },
  { key: 'edition', label: 'Edition of the build image', def: 'advanced', kind: 'choice', choices: ['lite', 'medium', 'advanced'], group: 'Build PC (Debian)',
    help: 'Which edition package the build image gets when packages are installed in it.' },
  { key: 'serverFolder', label: 'Repository folder on the web server', def: '/downloads/iprps/repo/1/', kind: 'text', group: 'Web server' },
  { key: 'repoUrl', label: 'Repository address', def: 'https://infiniteplane.space/downloads/iprps/repo/1', kind: 'text', group: 'Web server' },
];
function loadConfig() {
  let c = {}; try { c = JSON.parse(read(path.join(CFG_DIR, 'config.json'), '{}')); } catch {}
  const out = {}; for (const f of FIELDS) out[f.key] = (c[f.key] ?? '') !== '' ? c[f.key] : f.def;
  return out;
}
function saveConfig(vals) {
  const cur = loadConfig();
  for (const f of FIELDS) if (vals[f.key] !== undefined) {
    let v = String(vals[f.key]).trim();
    if (f.kind === 'dir' || f.kind === 'file') v = fromWinPath(v).replace(/\/+$/, '') || f.def;
    if (f.kind === 'choice' && !f.choices.includes(v)) v = f.def;
    cur[f.key] = v;
  }
  writeShared(path.join(CFG_DIR, 'config.json'), JSON.stringify(cur, null, 2) + '\n');
  return cur;
}
// G:\IPRPS\x  <->  /mnt/g/IPRPS/x
function winPath(p) { const m = /^\/mnt\/([a-z])(\/.*)?$/.exec(p || ''); return m ? m[1].toUpperCase() + ':' + (m[2] || '\\').replace(/\//g, '\\') : ''; }
function fromWinPath(p) {
  const m = /^([A-Za-z]):[\\/]?(.*)$/.exec(p || ''); if (!m || !IS_WSL) return p;
  return '/mnt/' + m[1].toLowerCase() + '/' + m[2].replace(/\\/g, '/');
}

function checkFolders(cfg, loc) {
  const onBuildPc = loc === 'debian-root';
  return FIELDS.map(f => {
    const v = cfg[f.key]; let state = 'ok', note = '';
    if (f.group === 'Build PC (Debian)' && !onBuildPc) return { key: f.key, state: 'n/a', note: 'Only checked in DEBIAN ROOT on the build PC' };
    if (f.key === 'src') {
      if (!isDir(v)) { state = 'missing'; note = 'Not found. Unzip the newest repository here, or choose your copy.'; }
      else if (!exists(path.join(v, 'packages/iprps-apps/PKGBUILD'))) { state = 'warn'; note = 'This folder has no packages/iprps-apps/PKGBUILD: is it the iprps-os repository?'; }
      else note = isDir(path.join(v, '.git')) ? 'Git repository' : 'Not a Git repository yet (GitHub: export mode works)';
    } else if (f.key === 'buildSrc' || f.key === 'pkgOut') {
      const p = cfg.imageRoot + v;
      if (!isDir(cfg.imageRoot + '/build/src')) { state = 'warn'; note = 'The build image is not open (bash /root/iprps-enter.sh)'; }
      else if (!isDir(p)) { state = f.key === 'pkgOut' ? 'warn' : 'missing'; note = 'Not found at ' + p; }
    } else if (f.key === 'imageRoot') {
      if (!mounted(v)) { state = 'warn'; note = 'The image is not open now. Open it with bash /root/iprps-enter.sh in the IPRPS CHROOT window.'; }
      else note = 'Open';
    } else if (f.kind === 'dir') {
      if (!isDir(v)) { state = (f.key === 'repoDir') ? 'missing' : 'new'; note = f.key === 'repoDir' ? 'Not found: create it with iprps-repo.sh key and init (12.12)' : 'Will be created when first used'; }
    } else if (f.kind === 'file') {
      if (!exists(v)) { state = 'missing'; note = 'Not found'; }
    }
    return { key: f.key, state, note, win: winPath(v) };
  });
}

// ---------- mounts ----------
const mountsText = () => read('/proc/mounts');
const mounted = p => mountsText().split('\n').some(l => l.split(' ')[1] === p);
const chrootReady = cfg => ['', '/proc', '/dev', '/sys', '/build'].every(s => mounted(cfg.imageRoot + s));

// ---------- recipes ----------
const P = (cfg, ...a) => path.join(cfg.src, ...a);
function parseArray(text, name) {
  const m = new RegExp('^' + name + '=\\(([\\s\\S]*?)\\)', 'm').exec(text); if (!m) return null;
  return m[1].replace(/#[^\n]*/g, '').split(/\s+/).filter(Boolean).map(s => s.replace(/^'(.*)'$/, '$1'));
}
function setArray(text, name, items, width = 104) {
  const ind = ' '.repeat(name.length + 2); const lines = []; let cur = name + '=(';
  items.forEach((it, i) => {
    const add = (cur.endsWith('(') ? '' : ' ') + it;
    if (cur.length + add.length > width && !cur.endsWith('(')) { lines.push(cur); cur = ind + it; } else cur += add;
  });
  lines.push(cur + ')');
  const re = new RegExp('^' + name + '=\\([\\s\\S]*?\\)', 'm');
  if (!re.test(text)) throw new Error(name + '=() not found');
  return text.replace(re, () => lines.join('\n'));
}
const getVar = (t, n) => (new RegExp('^' + n + '=([^\\s#]+)', 'm').exec(t) || [])[1]?.replace(/^['"]|['"]$/g, '');
function setVar(t, n, v) { const re = new RegExp('^' + n + '=.*$', 'm'); if (!re.test(t)) throw new Error(n + '= not found'); return t.replace(re, n + '=' + v); }
function fnBody(t, pkg) { const m = new RegExp('^package_' + pkg.replace(/[-.]/g, '\\$&') + '\\(\\) \\{([\\s\\S]*?)^\\}', 'm').exec(t); return m ? m[1] : null; }
function removeFn(t, pkg) { return t.replace(new RegExp('\\n*^package_' + pkg.replace(/[-.]/g, '\\$&') + '\\(\\) \\{[\\s\\S]*?^\\}\\n?', 'm'), '\n'); }

function readRepo(cfg) {
  const appsPb = read(P(cfg, 'packages/iprps-apps/PKGBUILD')), basePb = read(P(cfg, 'packages/iprps-base/PKGBUILD'));
  if (!appsPb) return null;
  const names = parseArray(appsPb, 'pkgname') || [];
  const lite = parseArray(basePb, '_apps_lite') || [], med = parseArray(basePb, '_apps_medium') || [], adv = parseArray(basePb, '_apps_advanced') || [];
  const edOf = n => lite.includes(n) ? 'lite' : med.includes(n) ? 'medium' : adv.includes(n) ? 'advanced' : 'optional';
  const apps = names.map(n => {
    const b = fnBody(appsPb, n) || '';
    const web = /_web\s+(\S+)\s+(\S+)/.exec(b), menu = /_menu\s+(\S+)(?:\s+(\S+))?/.exec(b);
    const desk = menu ? read(P(cfg, 'packages/iprps-apps/desktop/iprps-' + menu[1] + '.desktop')) : '';
    return { pkg: n, folder: web ? web[1] : '', webFolder: web ? web[2] : '', menu: menu ? menu[1] : '',
      icon: menu && menu[2] ? menu[2] : '', name: (/^Name=(.*)$/m.exec(desk) || [])[1] || n,
      desc: (/pkgdesc='([^']*)'/.exec(b) || [])[1] || '', install: (/install=(\S+)/.exec(b) || [])[1] || '', edition: edOf(n) };
  });
  const pkgDirs = (() => { try { return fs.readdirSync(P(cfg, 'packages')).filter(d => exists(P(cfg, 'packages', d, 'PKGBUILD'))).sort(); } catch { return []; } })();
  const examples = (() => { try { return fs.readdirSync(P(cfg, 'packages/examples')).filter(d => !d.startsWith('_') && exists(P(cfg, 'packages/examples', d, 'PKGBUILD'))).sort(); } catch { return []; } })();
  return { apps, appsVer: getVar(appsPb, 'pkgver'), appsRel: getVar(appsPb, 'pkgrel'),
    baseVer: getVar(basePb, 'pkgver'), baseRel: getVar(basePb, 'pkgrel'), lists: (() => {   // each edition's full list, with "${_apps_lite[@]}" and the like expanded
      const raw = { lite, medium: med, advanced: adv }, out = {};
      const exp = (e, seen = new Set()) => { if (seen.has(e)) return []; seen.add(e); return (raw[e] || []).flatMap(n => { const m = /^"?\$\{_apps_(\w+)\[@\]\}"?$/.exec(n); return m ? exp(m[1], seen) : [n]; }); };
      for (const e of Object.keys(raw)) out[e] = [...new Set(exp(e))];
      return out;
    })(),
    retired: read(P(cfg, 'packages/iprps-base/retired-apps')).split('\n').map(l => l.split('#')[0].trim()).filter(Boolean),
    pkgDirs, examples };
}
function pkgInfo(cfg, dir) {
  const t = read(P(cfg, 'packages', dir, 'PKGBUILD'));
  const names = parseArray(t, 'pkgname') || [getVar(t, 'pkgname')].filter(Boolean);
  const arch = (parseArray(t, 'arch') || ['x86_64'])[0];
  return { names, ver: getVar(t, 'pkgver'), rel: getVar(t, 'pkgrel'), arch, text: t };
}
const today = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return { dot: `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`, iso: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }; };
const stamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${today().iso}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };
const pkgFile = (n, v, r, a) => `${n}-${v}-${r}-${a}.pkg.tar.zst`;

// pacman versions must always go up: a second publish on the same day raises pkgrel
function bumpAppsVersion(cfg) {
  const p = P(cfg, 'packages/iprps-apps/PKGBUILD'); let t = read(p);
  const v = getVar(t, 'pkgver'), r = +getVar(t, 'pkgrel') || 1, d = today().dot;
  let nv = d, nr = 1; if (v === d) nr = r + 1; else if (v > d) { nv = v; nr = r + 1; }
  t = setVar(setVar(t, 'pkgver', nv), 'pkgrel', nr); fs.writeFileSync(p, t);
  return { ver: nv, rel: String(nr) };
}
function bumpRel(cfg, dir) {
  const p = P(cfg, 'packages', dir, 'PKGBUILD'); let t = read(p);
  const nr = (+getVar(t, 'pkgrel') || 0) + 1; t = setVar(t, 'pkgrel', nr); fs.writeFileSync(p, t);
  return { ver: getVar(t, 'pkgver'), rel: String(nr) };
}

// ---------- copying ----------
const SKIP_NAMES = new Set(['.git', '.DS_Store', 'Thumbs.db', 'desktop.ini', 'node_modules', '__MACOSX']);
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_NAMES.has(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyTree(a, b); else if (e.isFile()) fs.copyFileSync(a, b);
  }
}
function listFiles(root, rel = '') {
  let out = []; let ents = []; try { ents = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (SKIP_NAMES.has(e.name)) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(listFiles(root, r)); else if (e.isFile()) out.push(r);
  }
  return out;
}
// A folder or a .zip -> a folder (a zip with one top folder gives that folder)
function unpackSource(src, log) {
  src = fromWinPath(src);
  if (isDir(src)) return { dir: src, cleanup() {} };
  if (!/\.zip$/i.test(src) || !exists(src)) throw new Error('Not a folder or .zip file: ' + src);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iprps-desk-'));
  const r = cp.spawnSync('unzip', ['-q', src, '-d', tmp], { encoding: 'utf8' });
  if (r.error) throw new Error('unzip is needed: apt install unzip');
  if (r.status) throw new Error('unzip failed: ' + (r.stderr || '').trim());
  let dir = tmp; const top = fs.readdirSync(tmp).filter(n => !SKIP_NAMES.has(n));
  if (top.length === 1 && isDir(path.join(tmp, top[0]))) dir = path.join(tmp, top[0]);
  log && log('Unpacked ' + path.basename(src));
  return { dir, cleanup() { fs.rmSync(tmp, { recursive: true, force: true }); } };
}

// ---------- secret scan ----------
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|zst|xz|gz|tgz|bz2|img|iso|qcow2|mp3|ogg|wav|flac|mp4|webm|woff2?|ttf|otf|eot|gguf|bin|so|o|a|exe|dll|pyc|psd|xcf)$/i;
const RULES = [
  ['A private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['An Anthropic API key', /sk-ant-[A-Za-z0-9_\-]{20,}/],
  ['An OpenAI-style API key', /\bsk-(?:proj-)?[A-Za-z0-9_\-]{32,}/],
  ['A Google API key', /AIza[0-9A-Za-z_\-]{35}/],
  ['A GitHub token', /\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{36}\b|github_pat_[A-Za-z0-9_]{40,}/],
  ['An AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['A hosting database server name', /\bdb\d{6,}\.hosting-data\.io\b|['"]db5\d{9}['"]/],
  ['A hosting database user name', /['"]dbu\d{5,}['"]/],
  ['A database password written in the code', /(?:new\s+(?:PDO|mysqli)|mysqli_connect|mysqli_real_connect)\s*\([^;]*?,\s*['"][^'"]*['"]\s*,\s*['"]([^'"]{4,})['"]/i],
  ['A password or key in a PHP define()', /define\s*\(\s*['"][A-Z0-9_]*(?:PASS|PWD|SECRET|KEY|TOKEN)[A-Z0-9_]*['"]\s*,\s*['"]([^'"]{4,})['"]/i],
  ['A password or key written in the code', /(?:pass(?:word|wd)?|pwd|secret|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|client[_-]?secret)['"]?\s*(?:=>|=|:)\s*['"]([^'"\s]{6,})['"]/i],
];
const PLACEHOLDER = /^@[A-Z0-9_]+@$|^\$|^[\\(\[]|\{\{|^(?:changeme|change[_-]?me|your[_-]|xxx|\*+|example|placeholder|password|secret|replace|none|null|undefined|enter|test)/i;
const RISKY_FILE = /(^|\/)(\.env(\..*)?|id_rsa|id_ed25519|[^/]*\.pem|[^/]*\.p12|[^/]*\.pfx|[^/]*PRIVATE[^/]*\.asc|\.iprps-signing-key|sources\.php)$/i;
function scanSecrets(root, rels, allowFile) {
  const allow = new Set(read(allowFile).split('\n').map(l => l.split(/\s+/)[0]).filter(Boolean));
  const found = [];
  const add = (rel, line, rule, match) => {
    const fp = crypto.createHash('sha1').update(rel + '|' + rule + '|' + match).digest('hex').slice(0, 16);
    if (!allow.has(fp)) found.push({ fp, file: rel, line, rule, shown: match.slice(0, 2) + '…' + ' (' + match.length + ' characters)' });
  };
  for (const rel of rels) {
    const full = path.join(root, rel);
    if (RISKY_FILE.test(rel)) add(rel, 0, 'A file that usually holds secrets', path.basename(rel));
    if (BINARY.test(rel)) continue;
    let st; try { st = fs.statSync(full); } catch { continue; }
    if (st.size > 3e6) continue;
    const text = read(full); if (text.includes('\u0000')) continue;
    text.split('\n').forEach((l, i) => {
      if (l.length > 4000) return;
      for (const [rule, re] of RULES) {
        const m = re.exec(l); if (!m) continue;
        const val = m[1] || m[0];
        if (m[1] && (PLACEHOLDER.test(val) || /getenv|process\.env|\$_(ENV|SERVER)/.test(l))) continue;
        add(rel, i + 1, rule, val);
      }
    });
  }
  return found;
}
function allowFindings(allowFile, list) {
  const lines = list.map(f => `${f.fp}  ${f.file}:${f.line}  ${f.rule}`);
  fs.appendFileSync(allowFile, (exists(allowFile) ? '' : '# Release Desk: findings checked and marked safe (fingerprint, file, what). Delete a line to check it again.\n') + lines.join('\n') + '\n');
}

// ---------- changelog ----------
function addChangelog(cfg, text) {
  const p = P(cfg, 'CHANGELOG.md'); let t = read(p, '# Changelog\n');
  const h = '## ' + today().iso, line = '- ' + text.trim();
  if (t.includes(h + '\n')) t = t.replace(h + '\n\n', h + '\n\n' + line + '\n');
  else { const i = t.search(/^## /m); const block = h + '\n\n' + line + '\n\n'; t = i < 0 ? t.trimEnd() + '\n\n' + block : t.slice(0, i) + block + t.slice(i); }
  fs.writeFileSync(p, t);
}

module.exports = { read, exists, isDir, q, IS_WSL, location, writeShared, SHARED, LOC_LABEL, WHERE_LABEL, CFG_DIR, FIELDS, loadConfig, saveConfig,
  winPath, fromWinPath, checkFolders, mounted, chrootReady, P, parseArray, setArray, getVar, setVar, fnBody, removeFn, readRepo,
  pkgInfo, today, stamp, pkgFile, bumpAppsVersion, bumpRel, copyTree, listFiles, unpackSource, scanSecrets, allowFindings, addChangelog };
