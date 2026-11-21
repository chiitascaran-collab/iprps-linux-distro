#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Downloads the official llama.cpp release build of llama-server for a platform and
// places it in bin/<os>-<arch>/, where the app (and electron-builder) pick it up.
//
//   node scripts/fetch-llama.js                       # this computer's OS and CPU
//   node scripts/fetch-llama.js --os win --arch x64   # os: win | mac | linux
//   node scripts/fetch-llama.js --backend cuda        # Windows only: NVIDIA CUDA 12 build instead of Vulkan
//   node scripts/fetch-llama.js --tag b6500           # a specific llama.cpp release
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const OS = args.os || { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform];
const ARCH = args.arch || process.arch;
const BACKEND = args.backend || 'default';
const TAG = args.tag || 'latest';
const REPO = 'ggml-org/llama.cpp';
const OUT = path.join(__dirname, '..', 'bin', `${OS}-${ARCH}`);

// Asset name patterns, in order of preference. Every entry in a group is downloaded and merged.
function wanted() {
  if (OS === 'win') {
    if (BACKEND === 'cuda') return [[/bin-win-cuda-12[.\d]*-x64\.zip$/, /^cudart-llama-bin-win-cuda-12[.\d]*-x64\.zip$/]];
    if (BACKEND === 'cpu') return [[new RegExp(`bin-win-cpu-${ARCH}\\.zip$`)]];
    return [[new RegExp(`bin-win-cpu-${ARCH}\\.zip$`), new RegExp(`bin-win-vulkan-${ARCH}\\.zip$`)], [new RegExp(`bin-win-cpu-${ARCH}\\.zip$`)]];
  }
  if (OS === 'mac') return [[new RegExp(`bin-macos-${ARCH}\\.(tar\\.gz|zip)$`)]];
  if (OS === 'linux') {
    if (ARCH === 'x64' && BACKEND !== 'cpu') return [[/bin-ubuntu-vulkan-x64\.(tar\.gz|zip)$/], [/bin-ubuntu-x64\.(tar\.gz|zip)$/]];
    return [[new RegExp(`bin-ubuntu-${ARCH}\\.(tar\\.gz|zip)$`)]];
  }
  throw new Error(`Unknown --os ${OS}`);
}

function get(url, json) {
  const headers = { 'User-Agent': 'iprps-model-loader', Accept: json ? 'application/vnd.github+json' : 'application/octet-stream' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) { res.resume(); return resolve(get(res.headers.location, json)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${res.statusCode} for ${url}`)); }
      const chunks = []; let got = 0; const total = +res.headers['content-length'] || 0; let last = 0;
      res.on('data', (c) => {
        chunks.push(c); got += c.length;
        if (!json && total && Date.now() - last > 1500) { last = Date.now(); process.stdout.write(`  ${Math.round(got / total * 100)}%\r`); }
      });
      res.on('end', () => { const buf = Buffer.concat(chunks); resolve(json ? JSON.parse(buf.toString()) : buf); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extract(archive, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (archive.endsWith('.zip')) {
    try { execFileSync('tar', ['-xf', archive, '-C', dest], { stdio: 'ignore' }); return; } catch { /* GNU tar cannot read zip */ }
    try { execFileSync('unzip', ['-o', '-q', archive, '-d', dest]); return; } catch { /* fall through */ }
    if (process.platform === 'win32') { execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${archive}' -DestinationPath '${dest}'`]); return; }
    throw new Error('Could not extract a .zip archive: install unzip.');
  }
  execFileSync('tar', ['-xzf', archive, '-C', dest]);
}

// Move every file from nested folders up into dest (release tarballs wrap files in a folder).
function flatten(dir, dest) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) flatten(p, dest);
    else if (e.isSymbolicLink() || e.isFile()) {
      const target = path.join(dest, e.name);
      if (p !== target) { fs.rmSync(target, { force: true }); fs.renameSync(p, target); }
    }
  }
}

const KEEP = (name) => /^llama-server(\.exe)?$/.test(name) || /\.(dll|so|dylib|metal)$/.test(name) || /\.so\.\d/.test(name) || /\.(\d+\.)*dylib$/.test(name) || /^LICENSE/i.test(name);

(async () => {
  const api = TAG === 'latest' ? `https://api.github.com/repos/${REPO}/releases/latest` : `https://api.github.com/repos/${REPO}/releases/tags/${TAG}`;
  console.log(`Looking up llama.cpp release (${TAG})…`);
  const rel = await get(api, true);
  const assets = rel.assets || [];
  let pick = null;
  for (const group of wanted()) {
    const found = group.map((re) => assets.find((a) => re.test(a.name)));
    if (found.every(Boolean)) { pick = found; break; }
  }
  if (!pick) throw new Error(`No matching llama.cpp build for ${OS}-${ARCH} (${BACKEND}) in release ${rel.tag_name}.\nAvailable: ${assets.map((a) => a.name).join(', ')}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'llama-'));
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const a of pick) {
    console.log(`Downloading ${a.name} (${Math.round(a.size / 2 ** 20)} MB)…`);
    const file = path.join(tmp, a.name);
    fs.writeFileSync(file, await get(a.browser_download_url, false));
    const x = path.join(tmp, a.name + '.d');
    extract(file, x);
    flatten(x, OUT);
  }
  for (const f of fs.readdirSync(OUT)) if (!KEEP(f)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
  const exe = path.join(OUT, OS === 'win' ? 'llama-server.exe' : 'llama-server');
  if (!fs.existsSync(exe)) throw new Error(`llama-server was not found in the downloaded archive(s).`);
  if (OS !== 'win') fs.chmodSync(exe, 0o755);
  fs.writeFileSync(path.join(OUT, 'VERSION.txt'), `llama.cpp ${rel.tag_name}\n${pick.map((a) => a.name).join('\n')}\n`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`llama-server ${rel.tag_name} is ready in ${path.relative(process.cwd(), OUT)} (${fs.readdirSync(OUT).length} files).`);
})().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
