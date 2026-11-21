// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { summarize } = require('./lib/gguf');
const { LlamaServer, findServer } = require('./lib/server');
const { TEMPLATES, OPTIONS } = require('./lib/templates');

const IPRPS_SYSTEM = 'You are the AI Session Master and rules assistant for the Infinite Plane Role Playing System (IPRPS) by Mythical Legends Publishing, LLC. You apply the official IPRPS AI profiles, profile patches, campaign patches and rules accurately, completely and in their intended tone.';

const DEFAULT_SETTINGS = {
  systemPrompt: IPRPS_SYSTEM,
  temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1, maxTokens: 1024,
  ctx: 8192, gpuLayers: 99, threads: 0,
  template: 'auto', templateFile: '',
  serverPath: '', extraArgs: '',
  theme: 'dark',
};

// Optional custom data folder (useful for portable installs and testing).
if (process.env.IPRPS_USER_DATA) app.setPath('userData', process.env.IPRPS_USER_DATA);

let win = null;
const server = new LlamaServer();
const dataDir = () => app.getPath('userData');
const file = (n) => path.join(dataDir(), n);

function readJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return fallback; }
}
function writeJSON(name, value) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = file(name + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file(name));
}

const settings = () => ({ ...DEFAULT_SETTINGS, ...readJSON('settings.json', {}) });
const serverPath = (s) => findServer({ override: s.serverPath, resourcesPath: app.isPackaged ? process.resourcesPath : null, appPath: app.getAppPath() });

function send(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    title: 'IPRPS Model Loader',
    backgroundColor: '#14121a',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

server.on('log', (line) => send('server:log', line));
server.on('state', (st) => send('server:state', st));
server.on('notice', (n) => send('server:notice', n));

ipcMain.handle('app:info', () => ({
  version: app.getVersion(), platform: process.platform, arch: process.arch,
  cpus: os.cpus().length, totalMemGB: Math.round(os.totalmem() / 2 ** 30 * 10) / 10,
  serverPath: serverPath(settings()), dataDir: dataDir(),
  templateOptions: OPTIONS, defaultSystemPrompt: IPRPS_SYSTEM,
}));

ipcMain.handle('settings:get', () => settings());
ipcMain.handle('settings:set', (_e, patch) => { const s = { ...settings(), ...patch }; writeJSON('settings.json', s); return s; });
ipcMain.handle('settings:reset', () => { writeJSON('settings.json', DEFAULT_SETTINGS); return DEFAULT_SETTINGS; });

ipcMain.handle('library:get', () => readJSON('library.json', []));
ipcMain.handle('library:add', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Add GGUF model', properties: ['openFile', 'multiSelections'], filters: [{ name: 'GGUF models', extensions: ['gguf'] }] });
  if (r.canceled) return readJSON('library.json', []);
  const lib = readJSON('library.json', []);
  for (const p of r.filePaths) {
    if (lib.some((m) => m.path === p)) continue;
    try {
      const s = summarize(p);
      lib.push({ path: p, name: path.basename(p), sizeBytes: s.sizeBytes, quantization: s.quantization, architecture: s.architecture, sizeLabel: s.sizeLabel, contextLength: s.contextLength, addedAt: Date.now() });
    } catch (e) { dialog.showErrorBox('Could not read model', `${path.basename(p)}\n\n${e.message}`); }
  }
  writeJSON('library.json', lib);
  return lib;
});
ipcMain.handle('library:remove', (_e, p) => { const lib = readJSON('library.json', []).filter((m) => m.path !== p); writeJSON('library.json', lib); return lib; });
ipcMain.handle('model:inspect', (_e, p) => { const s = summarize(p); return { ...s, metadata: s.metadata }; });
ipcMain.handle('model:reveal', (_e, p) => shell.showItemInFolder(p));

ipcMain.handle('server:start', async (_e, modelPath) => {
  const s = settings();
  let fallbackFamily = 'chatml';
  try { fallbackFamily = summarize(modelPath).vocabFamily; } catch { /* the server will report the real problem */ }
  const info = await server.start({
    serverPath: serverPath(s), model: modelPath, ctx: s.ctx, gpuLayers: s.gpuLayers, threads: s.threads || 0,
    template: s.template, templateFile: s.templateFile, templateDir: dataDir(), extraArgs: s.extraArgs, fallbackFamily,
  });
  const fam = TEMPLATES[info.templateUsed] ? info.templateUsed : fallbackFamily;
  return { ...info, stop: TEMPLATES[fam]?.stop || [] };
});
ipcMain.handle('server:stop', () => server.stop());
ipcMain.handle('server:status', () => ({ state: server.state, port: server.port, ...server.info }));
ipcMain.handle('server:log', () => server.log.join('\n'));

ipcMain.handle('chats:get', () => readJSON('chats.json', []));
ipcMain.handle('chats:save', (_e, chats) => { writeJSON('chats.json', chats); return true; });
ipcMain.handle('chats:export', async (_e, { title, markdown }) => {
  const r = await dialog.showSaveDialog(win, { title: 'Export conversation', defaultPath: `${(title || 'conversation').replace(/[\\/:*?"<>|]+/g, '_')}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
  if (r.canceled) return false;
  fs.writeFileSync(r.filePath, markdown);
  return r.filePath;
});

ipcMain.handle('dialog:pickFile', async (_e, { title, filters }) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ['openFile'], filters });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('shell:openData', () => shell.openPath(dataDir()));

app.whenReady().then(() => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', async () => { await server.stop(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { server.stop(); });
