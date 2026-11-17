'use strict';
// IPRPS Release Desk - the walkthroughs. Each task is a list of steps; each step says where it runs.
//   where: desk (the Desk changes files in your repository) | debian | chroot | builder | src (Git, where the repository is)
//          | vm (test VM, by hand) | windows (FileZilla etc., by hand)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const C = require('./core');
const { q, P } = C;

// ---------- shared pieces ----------
// Only the settings that differ from iprps-repo.sh's own defaults go on the command line
const REPO_DEFAULTS = { IPRPS_SRC: ['src', '/mnt/g/IPRPS/iprps-os'], IPRPS_REPO_DIR: ['repoDir', '/root/iprps-repo/1'],
  IPRPS_REPO_UPLOAD: ['repoUpload', '/mnt/g/IPRPS/repo-upload/1'], IPRPS_REPO_URL: ['repoUrl', 'https://infiniteplane.space/downloads/iprps/repo/1'] };
const repoEnv = cfg => Object.entries(REPO_DEFAULTS).filter(([, [k, d]]) => cfg[k] !== d).map(([v, [k]]) => `${v}=${q(cfg[k])} `).join('');
const verOf = (job, k) => (job.data.v || {})[k];
const files = (job, k, names, arch = 'any') => { const v = verOf(job, k); return v ? names.map(n => C.pkgFile(n, v.ver, v.rel, arch)) : null; };
const PEND = '(set by the versions step)';

function stepCopy(cfg) {
  return { id: 'copy', where: 'debian', title: 'Copy the repository into the build image',
    text: 'The packages are built from the copy inside the image, so it must match your repository (12.12 step 5). Open the image first if it is closed: `bash /root/iprps-enter.sh` in the IPRPS CHROOT window.',
    cmd: `mountpoint -q ${q(cfg.imageRoot + '/build')} || { echo 'STOPPED: the build image is not open. In the IPRPS CHROOT window: bash /root/iprps-enter.sh'; exit 1; }
rsync -a --delete --exclude .git ${q(cfg.src + '/')} ${q(cfg.imageRoot + cfg.buildSrc + '/')}
chroot ${q(cfg.imageRoot)} chown -R builder:builder ${q(cfg.buildSrc)}
echo "Copied: $(ls ${q(cfg.imageRoot + cfg.buildSrc + '/packages')} | tr '\\n' ' ')"` };
}
function stepBuild(cfg, dirs) {
  return { id: 'build', where: 'builder', long: true, title: 'Build the package' + (dirs.length > 1 ? 's' : ''),
    text: 'makepkg builds every package in ' + dirs.map(d => '`packages/' + d + '`').join(' and ') + ' into ' + cfg.pkgOut + '. Watch for errors at the end.',
    cmd: dirs.map(d => `cd ${q(cfg.buildSrc + '/packages/' + d)} && makepkg -f --nodeps --noconfirm`).join(' && \\\n') + ` && \\\nls -t ${q(cfg.pkgOut)} | head -${Math.max(6, dirs.length * 6)}` };
}
function stepInstall(cfg, fl, extra = '', opts = '') {
  return { id: 'install', where: 'chroot', title: 'Install in the build image',
    text: 'Keeps the build image current, so the next release images have it too. Files copied into the image by hand are taken over by the packages (as IPRPS Updates does on computers). If `find` lists a `.pacnew` file, compare it with the file next to it.',
    // The same take-over rule as IPRPS Updates on installed computers: files copied into the build image by hand
    // (in /usr, /opt and /srv/www/iprps) go to the package that now ships them
    cmd: fl ? `cd ${q(cfg.pkgOut)} && pacman -U --noconfirm ${opts || "--overwrite '/usr/*' --overwrite '/opt/*' --overwrite '/srv/www/iprps/*' "}${fl.join(' ')}\nfind /etc /srv/www/iprps -name '*.pacnew'` + (extra ? '\n' + extra : '') : PEND, needsVersions: !fl };
}
function stepRepoAdd(cfg, adds, removes = []) {
  const lines = [];
  for (const [repo, fl] of adds) lines.push(fl ? `${repoEnv(cfg)}${q(cfg.repoScript)} add ${repo} ${fl.map(f => f.includes('*') ? q(cfg.imageRoot + cfg.pkgOut) + '/' + f : q(cfg.imageRoot + cfg.pkgOut + '/' + f)).join(' ')}` : PEND);
  for (const [repo, names] of removes) lines.push(`${repoEnv(cfg)}${q(cfg.repoScript)} remove ${repo} ${names.join(' ')}`);
  return { id: 'repo', where: 'debian', terminal: true, title: 'Sign and add to the package repository',
    text: 'Adds the packages that changed' + ' (every app, when the editions change: an edition package may only name apps the repository has). Signs with the IPRPS key, so GnuPG asks for its **passphrase**. That needs a terminal: run this step from `iprps-desk menu` in DEBIAN ROOT, or copy it there. (Run here works only while GnuPG still remembers the passphrase.)',
    cmd: lines.join(' && \\\n'), needsVersions: lines.includes(PEND) };
}
function stepsPublish(cfg) {
  const env = repoEnv(cfg), s = q(cfg.repoScript);
  return [
    { id: 'check', where: 'debian', title: 'Check the repository', text: 'Signatures, files in two packages, /etc files, dependencies. It must end with **Repository check passed.**', cmd: `${env}${s} check` },
    { id: 'serve', where: 'debian', long: true, optional: true, title: 'Serve the repository to a test VM',
      text: 'Runs until you stop it. In the test VM (a copy of the **last release**, not the build image): `echo \'Server = http://10.0.2.2:8080/$repo/$arch\' | sudo tee /etc/pacman.d/iprps-mirrorlist`', cmd: `${env}${s} serve` },
    { id: 'vm', where: 'vm', optional: true, title: 'Test the update in the VM',
      text: '1. **IPRPS Updates → Check now**, then **Install updates** (or `sudo iprps-update upgrade`).\n2. Open what changed and try it.\n3. Put the real server back: `echo \'Server = ' + cfg.repoUrl + '/$repo/$arch\' | sudo tee /etc/pacman.d/iprps-mirrorlist`\n4. Stop the server step above.' },
    { id: 'stage', where: 'debian', title: 'Save the packages to the upload folder',
      text: 'Checks again, then copies the signed repository to **' + (C.winPath(cfg.repoUpload) || cfg.repoUpload) + '**, ready for FileZilla.', cmd: `${env}${s} stage` },
    { id: 'upload', where: 'windows', title: 'Upload with FileZilla',
      text: '1. Connect to the web server (your hosting login; never stored in the repository).\n2. Open **' + cfg.serverFolder + '** on the server.\n3. Upload the **contents** of **' + (C.winPath(cfg.repoUpload) || cfg.repoUpload) + '** (`iprps-core`, `iprps-apps`, `iprps-extra`), overwriting. Packages first; the `.db`, `.files` and `.sig` files last.' },
    { id: 'online', where: 'debian', title: 'Check what the server has', text: 'Must end with **Online repository matches.** Computers see the update within 6 hours, or at once with **Check now**.', cmd: `${env}${s} online` },
  ];
}
function stepsGit(cfg, job, msgDefault) {
  return [
    { id: 'changelog', where: 'desk', action: 'changelog', title: 'Add a changelog line', text: 'Adds this line under today\'s date in CHANGELOG.md:\n\n> ' + (job.params.note || msgDefault) },
    { id: 'scan-all', where: 'desk', action: 'scan-changes', title: 'Check the changes for passwords and keys', text: 'Looks through every changed file before anything goes to GitHub.' },
    { id: 'git-status', where: 'src', title: 'See what will go to GitHub', text: 'Lists the changed files.', cmd: `git status --short && git log -1 --oneline`, git: true },
    { id: 'git-push', where: 'src', title: 'Commit and push to GitHub', text: 'If GitHub asks for a login, run it from `iprps-desk menu` or copy it to a terminal. Without Git: use **Prepare GitHub → export** instead.',
      cmd: `git add -A && git commit -m ${q(job.params.note || msgDefault)} && git push`, git: true },
  ];
}
// When the edition packages change, every app on the edition's list must be installed with them, and every app
// built at the new version goes to the repository (an edition package can't name an app the repository lacks).
function edApps(job, repo, ed) {
  if (repo) { const names = new Set(repo.apps.map(a => a.pkg)); job.data.lists = Object.fromEntries(['lite', 'medium', 'advanced'].map(e => [e, (repo.lists[e] || []).filter(n => names.has(n))])); }
  return (job.data.lists || {})[ed] || [];
}
const allApps = (cfg, job) => { const v = verOf(job, 'apps'); return v ? [`iprps-*-${v.ver}-${v.rel}-any.pkg.tar.zst`] : null; };

// ---------- the tasks ----------
const WF = {};

WF['update-app'] = {
  title: 'Update an app', icon: '⟳', blurb: 'Bring in a new version of an IPRPS app (a folder or .zip), check it, build it and publish it through IPRPS Updates.',
  params: [
    { key: 'pkg', label: 'App', type: 'app', required: true },
    { key: 'source', label: 'New version (folder or .zip)', type: 'path', help: 'Leave empty if you already changed the files in the repository\'s apps folder.' },
    { key: 'keep', label: 'Keep these files from the IPRPS OS version', type: 'text', def: 'config.php',
      help: 'Space-separated. Files changed for IPRPS OS (local database, no passwords) that the site\'s version would put back. Ignored if the app doesn\'t have them.' },
    { key: 'note', label: 'What changed (changelog and commit message)', type: 'text' },
  ],
  title_of: (j, repo) => 'Update ' + ((repo && repo.apps.find(a => a.pkg === j.params.pkg) || {}).name || j.params.pkg),
  steps(job, cfg, repo) {
    const app = (repo && repo.apps.find(a => a.pkg === job.params.pkg)) || { pkg: job.params.pkg, folder: job.data.folder || '?', edition: job.data.edition };
    const fl = files(job, 'apps', [app.pkg]);
    const skip = (app.edition === 'medium' || app.edition === 'advanced') && cfg.edition === 'lite' || app.edition === 'advanced' && cfg.edition === 'medium';
    return [
      job.params.source ? { id: 'import', where: 'desk', action: 'import-app', title: 'Bring in the new version',
        text: 'Replaces `apps/' + app.folder + '/` with **' + job.params.source + '**' + (job.params.keep ? ', keeping the IPRPS OS `' + job.params.keep + '`' : '') + '. The old files are saved in the Desk\'s backups first.' } : null,
      { id: 'scan', where: 'desk', action: 'scan-app', title: 'Check the app for passwords and keys', text: 'Looks for database passwords, API keys, hosting server names and private keys in `apps/' + app.folder + '/`. Nothing with a real password may ship.' },
      { id: 'versions', where: 'desk', action: 'versions-apps', title: 'Set the version', text: 'Sets `iprps-apps` to today\'s date (a second update on the same day raises the release number instead).' },
      stepCopy(cfg), stepBuild(cfg, ['iprps-apps']),
      skip ? null : stepInstall(cfg, fl),
      stepRepoAdd(cfg, [['iprps-apps', fl]]),
      ...stepsPublish(cfg), ...stepsGit(cfg, job, 'Update ' + app.name + (fl ? ' (' + app.pkg + ' ' + verOf(job, 'apps').ver + '-' + verOf(job, 'apps').rel + ')' : '')),
    ].filter(Boolean);
  },
};

WF['add-app'] = {
  title: 'Add a new app', icon: '＋', blurb: 'Add a web app to IPRPS OS: its package, menu entry, Hub name and editions, published so computers get it with their next update.',
  params: [
    { key: 'source', label: 'The app (folder or .zip)', type: 'path', required: true },
    { key: 'folder', label: 'Folder name in /srv/www/iprps', type: 'text', required: true, pattern: '^[a-z0-9][a-z0-9_-]*$', help: 'Lowercase letters, digits, - and _ (for example: map-maker). The app opens at /iprps/<folder>/.' },
    { key: 'name', label: 'Name in the menu and the Hub', type: 'text', required: true },
    { key: 'desc', label: 'One-line description', type: 'text', required: true },
    { key: 'edition', label: 'Which editions get it', type: 'choice', def: 'lite', choices: [['lite', 'Every edition (Lite, Medium, Advanced)'], ['medium', 'Medium and Advanced'], ['advanced', 'Advanced only'], ['optional', 'None: offered as optional in IPRPS Updates']] },
    { key: 'category', label: 'Menu category', type: 'choice', def: 'Game', choices: [['Game', 'Game'], ['Utility', 'Utility'], ['Graphics', 'Graphics'], ['Office', 'Office'], ['AudioVideo', 'Audio and video'], ['Education', 'Education']] },
    { key: 'writable', label: 'Folders the app saves files in (optional)', type: 'text', help: 'Space-separated folders inside the app that the web server must be able to write to (for example: images uploads).' },
    { key: 'hub', label: 'Show it in the Hub by default', type: 'bool', def: true },
    { key: 'note', label: 'Changelog and commit message', type: 'text' },
  ],
  title_of: j => 'Add ' + (j.params.name || j.params.folder),
  steps(job, cfg, repo) {
    const pkg = 'iprps-' + job.params.folder.replace(/_/g, '-'), opt = job.params.edition === 'optional';
    const appFl = opt ? files(job, 'apps', [pkg, 'iprps-hub']) : allApps(cfg, job), baseFl = opt ? [] : files(job, 'base', ['iprps-base', 'iprps-lite', 'iprps-medium', 'iprps-advanced']);
    const ed = edApps(job, repo, cfg.edition);
    const instFl = !appFl || !baseFl ? null : opt ? appFl
      : [...baseFl.filter(f => /^iprps-base-/.test(f) || f.startsWith('iprps-' + cfg.edition + '-')), ...files(job, 'apps', ed.length ? ed : [pkg, 'iprps-hub'])];
    return [
      { id: 'import', where: 'desk', action: 'import-new-app', title: 'Bring the app into the repository', text: 'Copies **' + job.params.source + '** to `apps/' + job.params.folder + '/`.' },
      { id: 'scan', where: 'desk', action: 'scan-app', title: 'Check the app for passwords and keys', text: 'Looks for database passwords, API keys, hosting server names and private keys. Apps must read the database password from `/etc/iprps/db.php` (12.5), never keep it in their files.' },
      { id: 'recipe', where: 'desk', action: 'add-app-recipe', title: 'Write the package, menu entry and Hub name',
        text: 'Adds `' + pkg + '` to `packages/iprps-apps/PKGBUILD`, a menu entry `desktop/iprps-' + job.params.folder.replace(/_/g, '-') + '.desktop`, an icon if the app has none, the Hub name' + (job.params.hub ? ' and default list' : '') + (opt ? '' : ', and the edition lists in `packages/iprps-base/PKGBUILD`') + (job.params.writable ? ', and an install script that lets the web server write to `' + job.params.writable + '`' : '') + '. Sets the versions.' },
      stepCopy(cfg), stepBuild(cfg, opt ? ['iprps-apps'] : ['iprps-apps', 'iprps-base']),
      stepInstall(cfg, instFl),
      stepRepoAdd(cfg, [['iprps-apps', appFl], ...(opt ? [] : [['iprps-core', baseFl]])]),
      ...stepsPublish(cfg), ...stepsGit(cfg, job, 'Add ' + job.params.name + ' (' + pkg + ')'),
    ];
  },
};

WF['retire-app'] = {
  title: 'Retire an app', icon: '⊖', blurb: 'Stop shipping an app: take it out of the editions and the repository, and remove it from computers with their next update.',
  params: [
    { key: 'pkg', label: 'App', type: 'app', required: true },
    { key: 'uninstall', label: 'Remove it from computers that have it', type: 'bool', def: true, help: 'IPRPS Updates removes it after the next update. Files people saved with it outside the app (uploads, its database) stay.' },
    { key: 'keepSource', label: 'Keep its files in the repository (moved to retired/)', type: 'bool', def: true },
    { key: 'note', label: 'Changelog and commit message', type: 'text' },
  ],
  title_of: (j, repo) => 'Retire ' + ((repo && repo.apps.find(a => a.pkg === j.params.pkg) || {}).name || j.params.pkg),
  steps(job, cfg, repo) {
    const app = (repo && repo.apps.find(a => a.pkg === job.params.pkg)) || { pkg: job.params.pkg, name: job.params.pkg };
    const baseFl = files(job, 'base', ['iprps-base', 'iprps-lite', 'iprps-medium', 'iprps-advanced']), hubFl = allApps(cfg, job);
    const ed = edApps(job, repo, cfg.edition).filter(n => n !== app.pkg);
    const inst = baseFl && hubFl ? [...baseFl.filter(f => /^iprps-base-/.test(f) || f.startsWith('iprps-' + cfg.edition + '-')), ...files(job, 'apps', ed.length ? ed : ['iprps-hub'])] : null;
    return [
      { id: 'recipe', where: 'desk', action: 'retire-recipe', title: 'Take it out of the recipes',
        text: 'Removes `' + app.pkg + '` from `packages/iprps-apps/PKGBUILD` (its function, menu entry and install script), from the edition lists, the Hub name and default list' + (job.params.uninstall ? '; adds it to `packages/iprps-base/retired-apps`' : '') + (job.params.keepSource ? '; moves `apps/' + app.folder + '/` to `retired/' + app.folder + '/`' : '; deletes `apps/' + app.folder + '/`') + '. Sets the versions.' },
      stepCopy(cfg), stepBuild(cfg, ['iprps-apps', 'iprps-base']),
      stepInstall(cfg, inst, `pacman -Rns --noconfirm ${app.pkg} 2>/dev/null || echo '${app.pkg} was not installed here'`),
      stepRepoAdd(cfg, [['iprps-core', baseFl], ['iprps-apps', hubFl]], [['iprps-apps', [app.pkg]]]),
      ...stepsPublish(cfg), ...stepsGit(cfg, job, 'Retire ' + app.name + ' (' + app.pkg + ')'),
    ];
  },
};

function pkgSteps(job, cfg, dir, repoName, opts = {}) {
  const v = verOf(job, 'pkg'), names = job.data.names || [dir];
  const fl = v ? names.map(n => C.pkgFile(n, v.ver, v.rel, job.data.arch || 'any')) : null;
  let inst = fl;
  if (fl && dir === 'iprps-base') inst = fl.filter(f => !/^iprps-(lite|medium|advanced)-/.test(f) || f.startsWith('iprps-' + cfg.edition + '-'));
  if (fl && dir === 'iprps-apps' && cfg.edition === 'lite') inst = fl.filter(f => !/^iprps-oracle-/.test(f));
  return [stepCopy(cfg),
    opts.checksums ? { id: 'checksums', where: 'builder', action: 'checksums', optional: true, title: 'Update the download checksums',
      text: 'Runs `makepkg -g` (downloads the source) and writes the new checksums into your repository\'s PKGBUILD, then copies it into the image again. Compare them with the checksum on the BLFS page or the project\'s site, or check the download\'s signature. Skip this if you typed the checksum yourself.' } : null,
    stepBuild(cfg, [dir]),
    // Optional apps stay out of the build image, so they stay out of the release images: computers add them from IPRPS Updates
    OPTIONAL_DIRS.has(dir) ? null : stepInstall(cfg, inst, '', opts.takeover ? "--overwrite '/usr/*' " : ''),
    stepRepoAdd(cfg, [[repoName, fl]])].filter(Boolean);
}
const OPTIONAL_DIRS = new Set(['iprps-link', 'iprps-podcast-studio', 'iprps-cd-burner']);
// Apps in their own recipe folder (iprps-link, iprps-podcast-studio, iprps-cd-burner) go to iprps-apps like the others
const APP_DIRS = new Set(['iprps-apps', 'iprps-link', 'iprps-podcast-studio', 'iprps-cd-burner']);
const defaultRepo = dir => APP_DIRS.has(dir) ? 'iprps-apps' : 'iprps-core';

WF['update-package'] = {
  title: 'Update IPRPS OS files or a recipe', icon: '✎', blurb: 'You changed files in a package folder (IPRPS Updates, the keyring, a recipe…): raise its version, build and publish it.',
  params: [
    { key: 'dir', label: 'Package folder', type: 'package', required: true },
    { key: 'repo', label: 'Repository', type: 'choice', def: 'auto', choices: [['auto', 'The usual one (iprps-apps for apps, including iprps-link, iprps-podcast-studio and iprps-cd-burner; iprps-core otherwise)'], ['iprps-core', 'iprps-core'], ['iprps-apps', 'iprps-apps'], ['iprps-extra', 'iprps-extra (optional software)']] },
    { key: 'note', label: 'What changed (changelog and commit message)', type: 'text', required: true },
  ],
  title_of: j => 'Update ' + j.params.dir,
  steps(job, cfg) {
    const repo = job.params.repo === 'auto' ? defaultRepo(job.params.dir) : job.params.repo;
    return [{ id: 'versions', where: 'desk', action: 'versions-package', title: 'Raise the version', text: job.params.dir === 'iprps-apps' ? 'Sets `iprps-apps` to today\'s date.' : 'Raises `pkgrel` by one, so computers see a newer package.' },
      ...pkgSteps(job, cfg, job.params.dir, repo), ...stepsPublish(cfg), ...stepsGit(cfg, job, 'Update ' + job.params.dir)];
  },
};

WF['security'] = {
  title: 'Apply a security update', icon: '⛨', blurb: 'BLFS published an advisory: package the fixed version of a program (17.2) and send it to every computer.',
  params: [
    { key: 'name', label: 'Program (package folder)', type: 'package-or-example', required: true, help: 'An existing folder in packages/, or one from packages/examples/ (it is copied first).' },
    { key: 'version', label: 'Fixed version', type: 'text', required: true, pattern: '^[0-9A-Za-z._+]+$', help: 'As in the advisory, for example 8.21.1' },
    { key: 'repo', label: 'Repository', type: 'choice', def: 'iprps-core', choices: [['iprps-core', 'iprps-core (part of IPRPS OS)'], ['iprps-extra', 'iprps-extra (optional software)']] },
    { key: 'takeover', label: 'First package of this program (BLFS installed it by hand)', type: 'bool', def: false, help: 'Lets the package take over the files in /usr once.' },
    { key: 'note', label: 'Changelog and commit message', type: 'text' },
  ],
  title_of: j => 'Security update: ' + j.params.name + ' ' + j.params.version,
  steps(job, cfg) {
    return [{ id: 'versions', where: 'desk', action: 'versions-security', title: 'Set the version in the recipe', text: 'Sets `pkgver=' + job.params.version + '` and `pkgrel=1` in `packages/' + job.params.name + '/PKGBUILD` (copying it from `packages/examples/` first if needed).' },
      ...pkgSteps(job, cfg, job.params.name, job.params.repo, { checksums: true, takeover: job.params.takeover }), ...stepsPublish(cfg),
      { id: 'point', where: 'desk', optional: true, title: 'Make sure every computer gets it', text: 'Computers that never installed this program as a package won\'t get it. For a security fix, follow with **Make a point release** and add `\'' + job.params.name + '>=' + job.params.version + '\'` to its depends.' },
      ...stepsGit(cfg, job, 'Security update: ' + job.params.name + ' ' + job.params.version)];
  },
};

WF['point-release'] = {
  title: 'Make a point release', icon: '★', blurb: 'Raise the IPRPS OS version (1.0.1, 1.1…) and bring required updates to every computer (17.3).',
  params: [
    { key: 'version', label: 'New IPRPS OS version', type: 'text', required: true, pattern: '^[0-9]+(\\.[0-9]+)+$', help: 'For example 1.0.1' },
    { key: 'depends', label: 'Packages every computer must have (optional)', type: 'text', help: "Space-separated, for example  curl>=8.21.1 openssl>=3.6.2" },
    { key: 'note', label: 'Changelog and commit message', type: 'text' },
  ],
  title_of: j => 'IPRPS OS ' + j.params.version,
  steps(job, cfg) {
    return [{ id: 'versions', where: 'desk', action: 'point-recipe', title: 'Set the version and requirements', text: 'In `packages/iprps-base/PKGBUILD`: `pkgver=' + job.params.version + '`, `pkgrel=1`' + (job.params.depends ? ', and adds `' + job.params.depends + '` to `depends=()`' : '') + '.' },
      ...pkgSteps(job, cfg, 'iprps-base', 'iprps-core'), ...stepsPublish(cfg),
      { id: 'images', where: 'debian', optional: true, title: 'Make new images for new installs', text: 'Follow 13.4–13.9 with `' + job.params.version + '` in the file names, and update the download page.' },
      ...stepsGit(cfg, job, 'IPRPS OS ' + job.params.version)];
  },
};

WF['publish'] = {
  title: 'Publish the repository', icon: '⇪', blurb: 'Check, save to the upload folder, upload and confirm: for packages already signed and added.',
  params: [], title_of: () => 'Publish the repository',
  steps: (job, cfg) => [{ id: 'list', where: 'debian', title: 'See what the repository holds', text: 'The newest version of each package in each repository.', cmd: `${repoEnv(cfg)}${q(cfg.repoScript)} list` }, ...stepsPublish(cfg)],
};

WF['github'] = {
  title: 'Prepare GitHub', icon: '⎇', blurb: 'Check the changes for passwords and keys, then commit and push, or copy the changed files to the GitHub upload folder.',
  params: [
    { key: 'note', label: 'Commit message', type: 'text', required: true },
    { key: 'mode', label: 'How', type: 'choice', def: 'push', choices: [['push', 'git commit and push'], ['export', 'Copy changed files to the GitHub upload folder (web uploader)']] },
  ],
  title_of: j => 'GitHub: ' + j.params.note,
  steps(job, cfg) {
    const g = stepsGit(cfg, job, job.params.note).filter(s => s.id !== 'changelog');
    if (job.params.mode === 'export') return [g[0], { id: 'export', where: 'desk', action: 'github-export', title: 'Copy the changed files to the upload folder',
      text: 'Copies new and changed files (keeping their folders) to a dated folder in **' + (C.winPath(cfg.githubOut) || cfg.githubOut) + '**, with a list of deleted files. Drag its contents onto the repository page on github.com (**Add file → Upload files**).' }];
    return g;
  },
};

module.exports = { WF, repoEnv };
