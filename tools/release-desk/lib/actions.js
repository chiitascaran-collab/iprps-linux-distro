'use strict';
// IPRPS Release Desk - the steps the Desk does itself (changes to files in your repository).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const C = require('./core');
const { P, read, exists, isDir } = C;

const ALLOW = cfg => P(cfg, '.iprps-desk-allow');
function needSrc(cfg) { if (!exists(P(cfg, 'packages/iprps-apps/PKGBUILD'))) throw new Error('The repository is not reachable here: ' + cfg.src + ' (check Folders)'); }
function backup(cfg, rel, log) {
  const from = P(cfg, rel); if (!exists(from)) return;
  const d = C.stamp();
  const to = path.join(C.CFG_DIR, 'backups', d, rel);
  isDir(from) ? C.copyTree(from, to) : (fs.mkdirSync(path.dirname(to), { recursive: true }), fs.copyFileSync(from, to));
  log('Backup: ' + to);
}
function write(cfg, rel, text, log) { fs.mkdirSync(path.dirname(P(cfg, rel)), { recursive: true }); fs.writeFileSync(P(cfg, rel), text); log('Wrote ' + rel); }
const appOf = (cfg, pkg) => { const r = C.readRepo(cfg); const a = r && r.apps.find(x => x.pkg === pkg); if (!a) throw new Error(pkg + ' is not in packages/iprps-apps/PKGBUILD'); return a; };
const folderOf = (cfg, job) => job.type === 'add-app' ? job.params.folder : appOf(cfg, job.params.pkg).folder;

function report(found, log) {
  log(found.length + ' thing(s) to check:');
  for (const f of found) log(`  ${f.file}${f.line ? ':' + f.line : ''}  ${f.rule}  (${f.shown})`);
  log('Remove them (the IPRPS OS apps read the database password from /etc/iprps/db.php), then run this step again.');
  log('If one is not a secret (an example value), choose "Mark as safe".');
}

const A = {};

A['import-app'] = ({ cfg, job, log }) => {
  needSrc(cfg); const app = appOf(cfg, job.params.pkg), rel = 'apps/' + app.folder;
  job.data.folder = app.folder; job.data.edition = app.edition;
  const src = C.unpackSource(job.params.source, log);
  try {
    if (!C.listFiles(src.dir).length) throw new Error('The new version is empty');
    backup(cfg, rel, log);
    const keep = {};
    for (const k of (job.params.keep || '').split(/\s+/).filter(Boolean)) { const f = P(cfg, rel, k); if (exists(f) && !isDir(f)) keep[k] = fs.readFileSync(f); }
    fs.rmSync(P(cfg, rel), { recursive: true, force: true }); C.copyTree(src.dir, P(cfg, rel));
    for (const [k, b] of Object.entries(keep)) { fs.mkdirSync(path.dirname(P(cfg, rel, k)), { recursive: true }); fs.writeFileSync(P(cfg, rel, k), b); log('Kept the IPRPS OS ' + k); }
    log(`apps/${app.folder}: ${C.listFiles(P(cfg, rel)).length} files`);
  } finally { src.cleanup(); }
  return true;
};

A['scan-app'] = ({ cfg, job, log }) => {
  needSrc(cfg); const folder = folderOf(cfg, job), rel = 'apps/' + folder;
  if (!isDir(P(cfg, rel))) throw new Error(rel + ' not found');
  const fl = C.listFiles(P(cfg, rel)).map(f => rel + '/' + f);
  const found = C.scanSecrets(cfg.src, fl, ALLOW(cfg)); job.data.findings = found;
  if (!found.length) { log(`Checked ${fl.length} files: no passwords, keys or hosting names found.`); return true; }
  report(found, log); return false;
};

A['scan-changes'] = ({ cfg, job, log }) => {
  needSrc(cfg); let fl;
  if (isDir(P(cfg, '.git'))) {
    const r = git(cfg, ['status', '--porcelain', '-uall']);
    fl = r.split('\n').filter(l => l && l[1] !== 'D' && l[0] !== 'D').map(l => l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''));
    log(fl.length + ' new or changed file(s) in Git.');
  } else { fl = C.listFiles(cfg.src); log('No Git here: checking all ' + fl.length + ' files.'); }
  const found = C.scanSecrets(cfg.src, fl, ALLOW(cfg)); job.data.findings = found;
  if (!found.length) { log('No passwords, keys or hosting names found.'); return true; }
  report(found, log); return false;
};

A['versions-apps'] = ({ cfg, job, log }) => {
  needSrc(cfg); if (job.data.v && job.data.v.apps) { log('Already set: ' + job.data.v.apps.ver + '-' + job.data.v.apps.rel); return true; }
  backup(cfg, 'packages/iprps-apps/PKGBUILD', log);
  const v = C.bumpAppsVersion(cfg); job.data.v = Object.assign(job.data.v || {}, { apps: v });
  log(`iprps-apps: ${v.ver}-${v.rel}`); return true;
};

function iconFor(cfg, folder, name, log) {
  for (const f of ['favicon.svg', 'icon.svg', 'logo.svg']) if (exists(P(cfg, 'apps', folder, f))) return f;
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('').replace(/[<&>]/g, '') || 'IP';
  write(cfg, `apps/${folder}/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1c1630"/><rect x="5" y="5" width="54" height="54" rx="11" fill="none" stroke="#e5b567" stroke-width="3"/><text x="32" y="42" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="${ini.length > 1 ? 24 : 30}" font-weight="700" fill="#e5b567">${ini}</text></svg>\n`, log);
  return 'favicon.svg';
}

A['import-new-app'] = ({ cfg, job, log }) => {
  needSrc(cfg); const p = job.params, rel = 'apps/' + p.folder;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(p.folder)) throw new Error('The folder name may only have lowercase letters, digits, - and _');
  const repo = C.readRepo(cfg), pkg = 'iprps-' + p.folder.replace(/_/g, '-');
  if (repo.apps.some(a => a.pkg === pkg)) throw new Error(pkg + ' already exists: use Update an app');
  if (repo.apps.some(a => a.webFolder === p.folder)) throw new Error('Another app already uses the folder ' + p.folder);
  if (exists(P(cfg, rel))) { backup(cfg, rel, log); fs.rmSync(P(cfg, rel), { recursive: true, force: true }); }
  const src = C.unpackSource(p.source, log);
  try {
    C.copyTree(src.dir, P(cfg, rel));
    const fl = C.listFiles(P(cfg, rel)); log(`apps/${p.folder}: ${fl.length} files`);
    if (!fl.some(f => /^index\.(html|php)$/.test(f))) log('NOTE: no index.html or index.php at the top: the Hub only lists folders that have one.');
    const all = fl.filter(f => /\.(html|php|js)$/.test(f)).map(f => read(P(cfg, rel, f))).join('\n');
    log(/auth-client\.js|auth-check\.php/.test(all) ? 'Uses the Universal Login (../auth/).' : 'NOTE: it doesn\'t use the Universal Login (../auth/auth-client.js); anyone on the computer can open it.');
    if (/new PDO|mysqli/.test(all)) log('NOTE: it uses a database. It must read the password from /etc/iprps/db.php (12.5), as master_db does.');
  } finally { src.cleanup(); }
  return true;
};

A['add-app-recipe'] = ({ cfg, job, log }) => {
  needSrc(cfg); const p = job.params, pkg = 'iprps-' + p.folder.replace(/_/g, '-'), menu = p.folder.replace(/_/g, '-');
  const ap = 'packages/iprps-apps/PKGBUILD', bp = 'packages/iprps-base/PKGBUILD';
  let t = read(P(cfg, ap));
  if (C.fnBody(t, pkg) !== null) { log(pkg + ' is already in the recipe.'); }
  else {
    backup(cfg, ap, log);
    const icon = iconFor(cfg, p.folder, p.name, log), wr = (p.writable || '').split(/\s+/).filter(Boolean).map(w => w.replace(/^\/+|\/+$/g, '')).filter(w => /^[A-Za-z0-9_.\/-]+$/.test(w) && !w.includes('..'));
    const names = C.parseArray(t, 'pkgname'); names.push(pkg); t = C.setArray(t, 'pkgname', names);
    const esc = s => String(s).replace(/'/g, '’');
    let fn = `\npackage_${pkg}() {\n  pkgdesc='${esc(p.name)}: ${esc(p.desc)}'\n  depends=(iprps-lib)\n`;
    if (wr.length) fn += `  install=${pkg}.install\n`;
    fn += `  _web ${p.folder} ${p.folder}\n`;
    for (const w of wr) fn += `  install -dm755 "$pkgdir/$_www/${p.folder}/${w}"\n`;
    fn += `  _menu ${menu} ${p.folder}/${icon}\n}\n`;
    t = t.trimEnd() + '\n' + fn; write(cfg, ap, t, log);
    if (wr.length) write(cfg, `packages/iprps-apps/${pkg}.install`, `# ${p.name}: folders the web server saves files in (added by the IPRPS Release Desk)\npost_install() {\n  getent passwd apache >/dev/null || return 0\n` + wr.map(w => `  install -dm755 -o apache -g apache /srv/www/iprps/${p.folder}/${w}\n  chown -R apache:apache /srv/www/iprps/${p.folder}/${w}\n`).join('') + `  return 0\n}\npost_upgrade() { post_install; }\n`, log);
    const one = s => String(s).replace(/[\r\n]+/g, ' ');
    write(cfg, `packages/iprps-apps/desktop/iprps-${menu}.desktop`, `[Desktop Entry]\nType=Application\nName=${one(p.name)}\nGenericName=IPRPS ${one(p.name)}\nComment=${one(p.desc)}\nExec=iprps-open ${p.folder}/\nIcon=iprps-${menu}\nTerminal=false\nCategories=X-IPRPS;${p.category || 'Game'};\n`, log);
  }
  // Hub: name, description, default list
  const hn = 'apps/hub/app-names.json', hd = 'apps/hub/default-apps.json';
  if (exists(P(cfg, hn))) { const j = JSON.parse(read(P(cfg, hn))); j[p.folder] = { name: p.name, description: p.desc }; write(cfg, hn, JSON.stringify(j, null, 2) + '\n', log); }
  if (p.hub && exists(P(cfg, hd))) { const j = JSON.parse(read(P(cfg, hd))); if (!j.apps.includes(p.folder)) j.apps.push(p.folder); write(cfg, hd, JSON.stringify(j, null, 2) + '\n', log); }
  // Editions
  if (p.edition !== 'optional') {
    let b = read(P(cfg, bp)); const list = '_apps_' + p.edition, arr = C.parseArray(b, list);
    if (!arr) throw new Error(list + '=() not found in ' + bp);
    if (!arr.includes(pkg)) { backup(cfg, bp, log); arr.push(pkg); b = C.setArray(b, list, arr); write(cfg, bp, b, log); }
  }
  // Versions
  if (!(job.data.v && job.data.v.apps)) {
    const v = { apps: C.bumpAppsVersion(cfg) };
    if (p.edition !== 'optional') v.base = C.bumpRel(cfg, 'iprps-base');
    job.data.v = v;
  }
  log('Versions: iprps-apps ' + job.data.v.apps.ver + '-' + job.data.v.apps.rel + (job.data.v.base ? ', iprps-base ' + job.data.v.base.ver + '-' + job.data.v.base.rel : ''));
  return true;
};

A['retire-recipe'] = ({ cfg, job, log }) => {
  needSrc(cfg); const p = job.params, ap = 'packages/iprps-apps/PKGBUILD', bp = 'packages/iprps-base/PKGBUILD';
  let t = read(P(cfg, ap));
  const repo = C.readRepo(cfg); const app = repo.apps.find(a => a.pkg === p.pkg) || job.data.app;
  if (!app) throw new Error(p.pkg + ' is not in ' + ap);
  job.data.app = app;
  if (['iprps-lib', 'iprps-hub', 'iprps-welcome', 'iprps-updates-tile'].includes(p.pkg)) throw new Error(p.pkg + ' is needed by IPRPS OS itself and can\'t be retired');
  if (C.fnBody(t, p.pkg) !== null) {
    backup(cfg, ap, log); backup(cfg, bp, log);
    t = C.setArray(t, 'pkgname', C.parseArray(t, 'pkgname').filter(n => n !== p.pkg));
    t = C.removeFn(t, p.pkg).replace(/\n{3,}/g, '\n\n'); write(cfg, ap, t, log);
    if (app.menu && exists(P(cfg, `packages/iprps-apps/desktop/iprps-${app.menu}.desktop`))) { fs.rmSync(P(cfg, `packages/iprps-apps/desktop/iprps-${app.menu}.desktop`)); log('Removed the menu entry'); }
    if (app.install && !t.includes('install=' + app.install) && exists(P(cfg, 'packages/iprps-apps', app.install))) { fs.rmSync(P(cfg, 'packages/iprps-apps', app.install)); log('Removed ' + app.install); }
    let b = read(P(cfg, bp));
    for (const l of ['_apps_lite', '_apps_medium', '_apps_advanced']) { const a = C.parseArray(b, l); if (a && a.includes(p.pkg)) b = C.setArray(b, l, a.filter(n => n !== p.pkg)); }
    write(cfg, bp, b, log);
    if (p.uninstall) {
      const rp = 'packages/iprps-base/retired-apps'; let r = read(P(cfg, rp), '# IPRPS OS: retired apps (guide 17.6). One package name per line.\n');
      if (!r.split('\n').some(l => l.trim() === p.pkg)) { r = r.trimEnd() + '\n' + p.pkg + '\n'; write(cfg, rp, r, log); }
    }
    const hn = 'apps/hub/app-names.json', hd = 'apps/hub/default-apps.json';
    if (exists(P(cfg, hn))) { const j = JSON.parse(read(P(cfg, hn))); if (j[app.webFolder]) { delete j[app.webFolder]; write(cfg, hn, JSON.stringify(j, null, 2) + '\n', log); } }
    if (exists(P(cfg, hd))) { const j = JSON.parse(read(P(cfg, hd))); if (j.apps.includes(app.webFolder)) { j.apps = j.apps.filter(x => x !== app.webFolder); write(cfg, hd, JSON.stringify(j, null, 2) + '\n', log); } }
    if (app.folder && isDir(P(cfg, 'apps', app.folder))) {
      if (p.keepSource) { fs.mkdirSync(P(cfg, 'retired'), { recursive: true }); fs.rmSync(P(cfg, 'retired', app.folder), { recursive: true, force: true }); fs.renameSync(P(cfg, 'apps', app.folder), P(cfg, 'retired', app.folder)); log(`Moved apps/${app.folder} to retired/${app.folder}`); }
      else { backup(cfg, 'apps/' + app.folder, log); fs.rmSync(P(cfg, 'apps', app.folder), { recursive: true, force: true }); log(`Deleted apps/${app.folder}`); }
    }
  } else log(p.pkg + ' is already out of the recipe.');
  if (!(job.data.v && job.data.v.base)) job.data.v = { apps: C.bumpAppsVersion(cfg), base: C.bumpRel(cfg, 'iprps-base') };
  log('Versions: iprps-apps ' + job.data.v.apps.ver + '-' + job.data.v.apps.rel + ', iprps-base ' + job.data.v.base.ver + '-' + job.data.v.base.rel);
  return true;
};

function recordPkg(cfg, job, dir, v, log) {
  const i = C.pkgInfo(cfg, dir); job.data.names = i.names; job.data.arch = i.arch;
  job.data.v = Object.assign(job.data.v || {}, { pkg: v || { ver: i.ver, rel: i.rel } });
  log(`${dir}: ${job.data.v.pkg.ver}-${job.data.v.pkg.rel} (${i.names.join(', ')})`);
}
A['versions-package'] = ({ cfg, job, log }) => {
  needSrc(cfg); const d = job.params.dir;
  if (!exists(P(cfg, 'packages', d, 'PKGBUILD'))) throw new Error('packages/' + d + '/PKGBUILD not found');
  if (job.data.v && job.data.v.pkg) { log('Already set.'); return true; }
  backup(cfg, `packages/${d}/PKGBUILD`, log);
  recordPkg(cfg, job, d, d === 'iprps-apps' ? C.bumpAppsVersion(cfg) : C.bumpRel(cfg, d), log); return true;
};
A['versions-security'] = ({ cfg, job, log }) => {
  needSrc(cfg); const n = job.params.name, rel = 'packages/' + n;
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(n)) throw new Error('Not a package folder name: ' + n);
  if (!exists(P(cfg, rel, 'PKGBUILD'))) {
    if (!exists(P(cfg, 'packages/examples', n, 'PKGBUILD'))) throw new Error(`Neither packages/${n} nor packages/examples/${n} has a PKGBUILD. Start from packages/examples/_blfs-template.`);
    C.copyTree(P(cfg, 'packages/examples', n), P(cfg, rel)); log(`Copied packages/examples/${n} to ${rel}`);
  }
  if (job.data.v && job.data.v.pkg) { log('Already set.'); return true; }
  backup(cfg, rel + '/PKGBUILD', log);
  let t = read(P(cfg, rel, 'PKGBUILD')); const old = C.getVar(t, 'pkgver'), oldRel = +C.getVar(t, 'pkgrel') || 0;
  const nr = old === job.params.version ? oldRel + 1 : 1;
  t = C.setVar(C.setVar(t, 'pkgver', job.params.version), 'pkgrel', nr); fs.writeFileSync(P(cfg, rel, 'PKGBUILD'), t);
  log(`${n}: ${old}-${oldRel} → ${job.params.version}-${nr}`);
  if (old !== job.params.version) log('Remember the checksum: the next steps can fill it in (Update the download checksums), or edit it yourself.');
  recordPkg(cfg, job, n, { ver: job.params.version, rel: String(nr) }, log); return true;
};
A['point-recipe'] = ({ cfg, job, log }) => {
  needSrc(cfg); const bp = 'packages/iprps-base/PKGBUILD'; let t = read(P(cfg, bp));
  if (!(job.data.v && job.data.v.pkg)) {
    backup(cfg, bp, log);
    t = C.setVar(C.setVar(t, 'pkgver', job.params.version), 'pkgrel', 1);
    const deps = (job.params.depends || '').split(/\s+/).filter(Boolean);
    if (deps.length) {
      const body = C.fnBody(t, 'iprps-base'); const m = /depends=\(([^)]*)\)/.exec(body); if (!m) throw new Error('depends=() not found in package_iprps-base');
      const cur = m[1].split(/\s+/).filter(Boolean), nm = d => d.replace(/^'|'$/g, '').split(/[<>=]/)[0];
      const merged = cur.filter(c => !deps.some(d => nm(d) === nm(c))).concat(deps.map(d => /^'.*'$/.test(d) ? d : `'${d}'`));
      t = t.replace(body, body.replace(m[0], 'depends=(' + merged.join(' ') + ')'));
      log('depends=(' + merged.join(' ') + ')');
    }
    fs.writeFileSync(P(cfg, bp), t);
  }
  recordPkg(cfg, job, 'iprps-base', null, log); return true;
};

A['changelog'] = ({ cfg, job, log, def }) => {
  needSrc(cfg); if (job.data.changelogDone) { log('Already added.'); return true; }
  C.addChangelog(cfg, job.params.note || def); job.data.changelogDone = true; log('CHANGELOG.md: ' + (job.params.note || def)); return true;
};

A['github-export'] = ({ cfg, job, log }) => {
  needSrc(cfg); const stamp = C.stamp();
  const out = path.join(cfg.githubOut, stamp); let changed = [], deleted = [];
  if (isDir(P(cfg, '.git'))) {
    for (const l of git(cfg, ['status', '--porcelain', '-uall']).split('\n').filter(Boolean)) {
      const f = l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, '');
      (l[0] === 'D' || l[1] === 'D' ? deleted : changed).push(f);
    }
  } else {
    const mark = path.join(cfg.githubOut, '.last-export'); const since = exists(mark) ? fs.statSync(mark).mtimeMs : 0;
    changed = C.listFiles(cfg.src).filter(f => fs.statSync(P(cfg, f)).mtimeMs > since);
    log(since ? 'Files changed since the last export.' : 'First export: every file.');
  }
  if (!changed.length && !deleted.length) { log('Nothing has changed.'); return true; }
  for (const f of changed) { const to = path.join(out, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(P(cfg, f), to); }
  if (deleted.length) fs.writeFileSync(path.join(out, '_DELETED-FILES.txt'), 'Delete these on GitHub (open each, then the trash icon):\n' + deleted.join('\n') + '\n');
  fs.mkdirSync(cfg.githubOut, { recursive: true }); fs.writeFileSync(path.join(cfg.githubOut, '.last-export'), stamp + '\n');
  log(`${changed.length} file(s) copied to ${C.winPath(out) || out}` + (deleted.length ? `; ${deleted.length} deleted (listed in _DELETED-FILES.txt)` : ''));
  log('Upload: on github.com, open the repository, Add file → Upload files, drag the folder\'s contents in, and use the message: ' + job.params.note);
  return true;
};

// Git as the owner of the repository (root's Git would refuse a folder it doesn't own)
function gitPrefix(cfg) {
  if (!(process.getuid && process.getuid() === 0)) return null;
  let st; try { st = fs.statSync(cfg.src); } catch { return null; }
  if (st.uid === 0) return null;
  const r = cp.spawnSync('getent', ['passwd', String(st.uid)], { encoding: 'utf8' });
  return (r.stdout || '').split(':')[0] || null;
}
function git(cfg, args) {
  const u = gitPrefix(cfg);
  const r = u ? cp.spawnSync('runuser', ['-u', u, '--', 'git', '-C', cfg.src, ...args], { encoding: 'utf8' })
    : cp.spawnSync('git', ['-C', cfg.src, ...args], { encoding: 'utf8' });
  if (r.error) throw new Error('git is not installed');
  if (r.status) throw new Error('git ' + args[0] + ': ' + (r.stderr || '').trim());
  return r.stdout;
}

// makepkg -g in BUILDER, then the checksums go into your repository's PKGBUILD
A['checksums'] = ({ cfg, job, log, runIn }) => {
  needSrc(cfg); const n = job.params.name, rel = `packages/${n}/PKGBUILD`;
  const out = runIn('builder', `cd ${C.q(cfg.buildSrc + '/packages/' + n)} && makepkg -g 2>/dev/null`);
  const sums = out.match(/^(?:md5|sha1|sha224|sha256|sha384|sha512|b2|ck)sums=\([\s\S]*?\)/gm);
  if (!sums) { log(out); throw new Error('makepkg -g printed no checksums'); }
  backup(cfg, rel, log);
  let t = read(P(cfg, rel));
  for (const s of sums) { const k = s.split('=')[0]; const re = new RegExp('^' + k + '=\\([\\s\\S]*?\\)', 'm'); t = re.test(t) ? t.replace(re, () => s) : t.replace(/^(source=\([\s\S]*?\))/m, (m) => m + '\n' + s); }
  fs.writeFileSync(P(cfg, rel), t); log(sums.join('\n'));
  fs.copyFileSync(P(cfg, rel), cfg.imageRoot + cfg.buildSrc + '/packages/' + n + '/PKGBUILD');
  log('Written to your PKGBUILD and copied into the image. Compare them with the checksum the project publishes.');
  return true;
};

module.exports = { A, git, gitPrefix, ALLOW };
