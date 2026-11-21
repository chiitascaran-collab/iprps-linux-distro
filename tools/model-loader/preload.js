// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const fn = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

contextBridge.exposeInMainWorld('iprps', {
  info: () => ipcRenderer.invoke('app:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  addModels: () => ipcRenderer.invoke('library:add'),
  removeModel: (p) => ipcRenderer.invoke('library:remove', p),
  inspectModel: (p) => ipcRenderer.invoke('model:inspect', p),
  revealModel: (p) => ipcRenderer.invoke('model:reveal', p),
  startServer: (p) => ipcRenderer.invoke('server:start', p),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  serverStatus: () => ipcRenderer.invoke('server:status'),
  serverLog: () => ipcRenderer.invoke('server:log'),
  getChats: () => ipcRenderer.invoke('chats:get'),
  saveChats: (c) => ipcRenderer.invoke('chats:save', c),
  exportChat: (x) => ipcRenderer.invoke('chats:export', x),
  pickFile: (o) => ipcRenderer.invoke('dialog:pickFile', o),
  openDataFolder: () => ipcRenderer.invoke('shell:openData'),
  onLog: on('server:log'),
  onState: on('server:state'),
  onNotice: on('server:notice'),
});
