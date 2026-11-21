// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
'use strict';
/* global MD */
const api = window.iprps;
const $ = (id) => document.getElementById(id);
const esc = MD.esc;

const state = {
  info: null, settings: null, library: [], chats: [], chatId: null,
  server: { state: 'stopped' }, loadedModel: null, stopStrings: [],
  generating: false, abort: null, loadingPath: null,
};

// ---------- helpers ----------
const fmtSize = (b) => (b >= 2 ** 30 ? `${(b / 2 ** 30).toFixed(1)} GB` : `${Math.round(b / 2 ** 20)} MB`);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const currentChat = () => state.chats.find((c) => c.id === state.chatId) || null;
const baseName = (p) => (p || '').split(/[\\/]/).pop();

function toast(text, kind = 'info', ms = 6000) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
}

function openModal(id) { $(id).hidden = false; }
function closeModal(el) { el.closest('.modal').hidden = true; }
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]')) closeModal(e.target);
  else if (e.target.classList.contains('modal')) e.target.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach((m) => { m.hidden = true; });
});

// ---------- status ----------
function renderStatus() {
  const s = state.server.state;
  const dot = $('statusDot');
  dot.className = `dot ${s}`;
  let text = 'No model loaded';
  if (s === 'loading') text = `Loading ${baseName(state.loadingPath)}…`;
  if (s === 'ready' && state.loadedModel) {
    const names = { embedded: 'model\u2019s own template', llama3: 'built-in Llama 3 template', chatml: 'built-in ChatML template', gemma: 'built-in Gemma template', phi3: 'built-in Phi-3 template', mistral: 'built-in Mistral template' };
    const tpl = names[state.loadedModel.templateUsed] || `template: ${state.loadedModel.templateUsed}`;
    text = `${baseName(state.loadedModel.model)} · ${tpl}`;
  }
  $('statusText').textContent = text;
  const ready = s === 'ready';
  $('unload').disabled = s === 'stopped';
  $('input').disabled = !ready;
  $('input').placeholder = ready ? 'Ask the Session Master…' : (s === 'loading' ? 'Loading the model…' : 'Load a model to start chatting…');
  $('send').disabled = !ready || state.generating;
  const chat = currentChat();
  $('regenerate').disabled = !ready || state.generating || !chat || !chat.messages.some((m) => m.role === 'assistant');
  renderLibrary();
}

// ---------- model library ----------
function renderLibrary() {
  const list = $('modelList');
  list.innerHTML = '';
  $('modelEmpty').hidden = state.library.length > 0;
  for (const m of state.library) {
    const li = document.createElement('li');
    const loaded = state.loadedModel && state.loadedModel.model === m.path && state.server.state === 'ready';
    const loading = state.server.state === 'loading' && state.loadingPath === m.path;
    li.className = 'model' + (loaded ? ' loaded' : '');
    li.innerHTML = `
      <div class="model-name" title="${esc(m.path)}">${esc(m.name.replace(/\.gguf$/i, ''))}</div>
      <div class="model-meta">${[m.sizeLabel, m.quantization, fmtSize(m.sizeBytes)].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="model-actions">
        <button class="btn small ${loaded ? '' : 'primary'}" data-act="load" ${state.server.state === 'loading' ? 'disabled' : ''}>${loaded ? 'Loaded' : loading ? 'Loading…' : 'Load'}</button>
        <button class="btn small ghost" data-act="info">Details</button>
        <button class="btn small ghost" data-act="remove" title="Remove from list (the file is not deleted)">Remove</button>
      </div>`;
    li.querySelector('[data-act="load"]').onclick = () => (loaded ? null : loadModel(m.path));
    li.querySelector('[data-act="info"]').onclick = () => showInfo(m.path);
    li.querySelector('[data-act="remove"]').onclick = async () => { state.library = await api.removeModel(m.path); renderLibrary(); };
    list.appendChild(li);
  }
}

async function loadModel(path) {
  state.loadingPath = path;
  state.server = { state: 'loading' };
  renderStatus();
  try {
    const r = await api.startServer(path);
    state.loadedModel = r;
    state.stopStrings = r.stop || [];
    state.server = { state: 'ready', port: r.port };
    toast(`${baseName(path)} is ready.`, 'ok', 3500);
    $('input').focus();
  } catch (e) {
    state.loadedModel = null;
    state.server = { state: 'stopped' };
    toast(cleanErr(e), 'error', 12000);
  }
  renderStatus();
}
const cleanErr = (e) => String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

async function showInfo(path) {
  $('infoTitle').textContent = baseName(path);
  $('infoBody').innerHTML = '<p class="muted">Reading model header…</p>';
  openModal('infoModal');
  try {
    const m = await api.inspectModel(path);
    const c = m.templateCheck;
    const rows = [
      ['File', m.path], ['Size', fmtSize(m.sizeBytes)], ['Architecture', m.architecture],
      ['Parameters', m.sizeLabel], ['Quantization', m.quantization], ['Trained context', m.contextLength?.toLocaleString()],
      ['Vocabulary', `${m.vocabSize.toLocaleString()} tokens (${m.vocabFamily} format)`],
      ['BOS / EOS tokens', `${m.bos ?? '—'} / ${m.eos ?? '—'}`],
      ['Embedded template', c.family === 'none' ? 'none' : c.family],
    ];
    const issues = c.issues.length
      ? c.issues.map((i) => `<div class="issue ${i.level}">${esc(i.text)}</div>`).join('')
      : '<div class="issue ok">The embedded chat template matches this model’s tokenizer. If the engine cannot parse it, the app switches to the built-in template automatically.</div>';
    const meta = Object.entries(m.metadata).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('');
    $('infoBody').innerHTML = `
      <table class="kv">${rows.filter((r) => r[1]).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(String(v))}</td></tr>`).join('')}</table>
      <h3>Chat template check</h3>${issues}
      <details><summary>Embedded chat template</summary><pre class="code"><code>${esc(m.chatTemplate || '(none)')}</code></pre></details>
      <details><summary>All metadata (${Object.keys(m.metadata).length} keys)</summary><div class="table-wrap"><table class="meta">${meta}</table></div></details>
      <p><button class="link" id="revealModel">Show file in folder</button></p>`;
    $('revealModel').onclick = () => api.revealModel(path);
  } catch (e) {
    $('infoBody').innerHTML = `<div class="issue error">${esc(cleanErr(e))}</div>`;
  }
}

// ---------- conversations ----------
function renderChats() {
  const list = $('chatList');
  list.innerHTML = '';
  const sorted = [...state.chats].sort((a, b) => b.updated - a.updated);
  for (const c of sorted) {
    const li = document.createElement('li');
    li.className = 'chat' + (c.id === state.chatId ? ' active' : '');
    li.innerHTML = `<span class="chat-title">${esc(c.title)}</span><button class="icon-btn small" title="Delete conversation">×</button>`;
    li.onclick = (e) => {
      if (e.target.closest('button')) return;
      state.chatId = c.id; renderChats(); renderMessages();
    };
    li.querySelector('button').onclick = () => {
      if (!confirm(`Delete "${c.title}"?`)) return;
      state.chats = state.chats.filter((x) => x.id !== c.id);
      if (state.chatId === c.id) state.chatId = null;
      persistChats(); renderChats(); renderMessages();
    };
    list.appendChild(li);
  }
}

function newChat() {
  if (state.generating) return;
  state.chatId = null;
  renderChats(); renderMessages();
  $('input').focus();
}

let saveTimer = null;
function persistChats() { clearTimeout(saveTimer); saveTimer = setTimeout(() => api.saveChats(state.chats), 400); }

function messageEl(m, idx) {
  const div = document.createElement('div');
  div.className = `msg ${m.role}`;
  div.dataset.idx = idx;
  const who = m.role === 'user' ? 'You' : 'Session Master';
  const body = m.role === 'user' ? `<p>${esc(m.content).replace(/\n/g, '<br />')}</p>` : MD.renderReply(m.content || '');
  const meta = m.meta ? `<span class="meta">${esc(m.meta)}</span>` : '';
  div.innerHTML = `<div class="who">${who}${meta}<button class="link copy" title="Copy text">Copy</button></div><div class="body">${body}</div>`;
  div.querySelector('.copy').onclick = () => { navigator.clipboard.writeText(m.content); toast('Copied.', 'ok', 1500); };
  return div;
}

function renderMessages() {
  const box = $('messages');
  const chat = currentChat();
  box.querySelectorAll('.msg').forEach((n) => n.remove());
  $('welcome').hidden = !!(chat && chat.messages.length);
  if (chat) chat.messages.forEach((m, i) => box.appendChild(messageEl(m, i)));
  box.scrollTop = box.scrollHeight;
  renderStatus();
}

// ---------- generation ----------
async function send(text) {
  if (!text.trim() || state.generating || state.server.state !== 'ready') return;
  let chat = currentChat();
  if (!chat) {
    chat = { id: uid(), title: text.trim().slice(0, 60), created: Date.now(), updated: Date.now(), messages: [] };
    state.chats.push(chat);
    state.chatId = chat.id;
    renderChats();
  }
  chat.messages.push({ role: 'user', content: text });
  renderMessages();
  await generate(chat);
}

async function regenerate() {
  const chat = currentChat();
  if (!chat || state.generating) return;
  while (chat.messages.length && chat.messages[chat.messages.length - 1].role === 'assistant') chat.messages.pop();
  renderMessages();
  await generate(chat);
}

async function generate(chat) {
  const s = state.settings;
  const reply = { role: 'assistant', content: '' };
  chat.messages.push(reply);
  const box = $('messages');
  const el = messageEl(reply, chat.messages.length - 1);
  el.classList.add('streaming');
  box.appendChild(el);
  $('welcome').hidden = true;
  const bodyEl = el.querySelector('.body');
  bodyEl.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';

  state.generating = true;
  state.abort = new AbortController();
  $('stopGen').hidden = false; $('send').hidden = true;
  renderStatus();

  const history = chat.messages.slice(0, -1).map(({ role, content }) => ({ role, content }));
  const messages = s.systemPrompt.trim() ? [{ role: 'system', content: s.systemPrompt.trim() }, ...history] : history;
  const started = performance.now();
  let tokens = 0;
  let stopReason = '';
  try {
    const res = await fetch(`http://127.0.0.1:${state.server.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: state.abort.signal,
      body: JSON.stringify({
        messages, stream: true, temperature: +s.temperature, top_p: +s.topP, top_k: +s.topK,
        repeat_penalty: +s.repeatPenalty, max_tokens: +s.maxTokens,
        stop: state.stopStrings.length ? state.stopStrings : undefined,
      }),
    });
    if (!res.ok) throw new Error(`The engine returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let pending = false;
    const paint = () => {
      pending = false;
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      bodyEl.innerHTML = MD.renderReply(reply.content) || '<span class="typing"><i></i><i></i><i></i></span>';
      if (atBottom) box.scrollTop = box.scrollHeight;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch { continue; }
        const ch = j.choices && j.choices[0];
        if (ch && ch.delta && ch.delta.content) { reply.content += ch.delta.content; tokens++; }
        if (ch && ch.finish_reason) stopReason = ch.finish_reason;
        if (j.timings && j.timings.predicted_n) tokens = j.timings.predicted_n;
      }
      if (!pending) { pending = true; requestAnimationFrame(paint); }
    }
    paint();
  } catch (e) {
    if (e.name === 'AbortError') stopReason = 'stopped';
    else { reply.content += `${reply.content ? '\n\n' : ''}> ⚠ ${cleanErr(e)}`; stopReason = 'error'; }
  } finally {
    const secs = (performance.now() - started) / 1000;
    reply.meta = `${tokens} tokens · ${(tokens / Math.max(secs, 0.01)).toFixed(1)} tok/s${stopReason === 'length' ? ' · hit max tokens' : stopReason === 'stopped' ? ' · stopped' : ''}`;
    state.generating = false;
    state.abort = null;
    $('stopGen').hidden = true; $('send').hidden = false;
    chat.updated = Date.now();
    if (!reply.content.trim()) reply.content = '_(no reply)_';
    persistChats();
    renderMessages();
    renderChats();
  }
}

// ---------- settings ----------
function fillSettings() {
  const s = state.settings;
  $('sSystem').value = s.systemPrompt;
  $('sTemp').value = s.temperature; $('sTopP').value = s.topP; $('sTopK').value = s.topK;
  $('sRepeat').value = s.repeatPenalty; $('sMax').value = s.maxTokens;
  $('sCtx').value = s.ctx; $('sGpu').value = s.gpuLayers; $('sThreads').value = s.threads;
  $('sTemplate').innerHTML = state.info.templateOptions.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('');
  $('sTemplate').value = s.template;
  $('sTemplateFile').value = s.templateFile || '';
  $('templateFileRow').hidden = s.template !== 'file';
  $('sServer').value = s.serverPath || '';
  $('sExtra').value = s.extraArgs || '';
  $('serverFound').textContent = state.info.serverPath ? `Using: ${state.info.serverPath}` : 'No engine found. Choose the llama-server program from a llama.cpp download.';
  $('sysInfo').textContent = `${state.info.platform} ${state.info.arch} · ${state.info.cpus} CPU threads · ${state.info.totalMemGB} GB RAM · app ${state.info.version}`;
}

async function saveSettings() {
  const num = (id) => Number($(id).value);
  state.settings = await api.setSettings({
    systemPrompt: $('sSystem').value,
    temperature: num('sTemp'), topP: num('sTopP'), topK: num('sTopK'), repeatPenalty: num('sRepeat'), maxTokens: num('sMax'),
    ctx: num('sCtx'), gpuLayers: num('sGpu'), threads: num('sThreads'),
    template: $('sTemplate').value, templateFile: $('sTemplateFile').value,
    serverPath: $('sServer').value.trim(), extraArgs: $('sExtra').value.trim(),
  });
  state.info = await api.info();
  $('settingsModal').hidden = true;
  toast('Settings saved.', 'ok', 2000);
}

// ---------- export ----------
async function exportChat() {
  const chat = currentChat();
  if (!chat) return toast('Open a conversation to export it.');
  const md = [`# ${chat.title}`, '', `_Exported from IPRPS Model Loader · ${new Date().toLocaleString()}_`, ''];
  for (const m of chat.messages) md.push(`## ${m.role === 'user' ? 'You' : 'Session Master'}`, '', m.content, '');
  const p = await api.exportChat({ title: chat.title, markdown: md.join('\n') });
  if (p) toast(`Saved to ${p}`, 'ok');
}

// ---------- wiring ----------
function autoGrow() { const t = $('input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 260) + 'px'; }

async function init() {
  state.info = await api.info();
  state.settings = await api.getSettings();
  state.library = await api.getLibrary();
  state.chats = await api.getChats();
  $('version').textContent = `v${state.info.version}`;
  const st = await api.serverStatus();
  if (st.state === 'ready') { state.server = { state: 'ready', port: st.port }; state.loadedModel = st; }
  renderLibrary(); renderChats(); renderMessages();
  if (!state.info.serverPath) toast('The llama.cpp engine was not found. Open Settings → Engine to choose llama-server.', 'error', 15000);

  api.onState((s) => {
    if (s.state === 'stopped' && state.server.state === 'ready') toast('The model was unloaded.', 'info', 3000);
    if (s.state === 'stopped' || s.state === 'ready') { state.server = { state: s.state, port: s.port }; if (s.state === 'stopped') state.loadedModel = null; }
    renderStatus();
  });
  api.onNotice((n) => toast(n, 'warn', 12000));
  api.onLog((line) => { const b = $('logBody'); if (!$('logModal').hidden) { b.textContent += line + '\n'; b.scrollTop = b.scrollHeight; } });

  $('addModel').onclick = async () => { state.library = await api.addModels(); renderLibrary(); };
  $('newChat').onclick = newChat;
  $('unload').onclick = async () => { await api.stopServer(); state.loadedModel = null; state.server = { state: 'stopped' }; renderStatus(); };
  $('exportChat').onclick = exportChat;
  $('composer').onsubmit = (e) => { e.preventDefault(); const t = $('input').value; $('input').value = ''; autoGrow(); send(t); };
  $('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); } });
  $('input').addEventListener('input', autoGrow);
  $('stopGen').onclick = () => state.abort && state.abort.abort();
  $('regenerate').onclick = regenerate;
  $('openSettings').onclick = () => { fillSettings(); openModal('settingsModal'); };
  $('openLog').onclick = async () => { $('logBody').textContent = (await api.serverLog()) + '\n'; openModal('logModal'); $('logBody').scrollTop = 1e9; };
  $('saveSettings').onclick = saveSettings;
  $('resetSettings').onclick = async () => { if (confirm('Reset all settings to their defaults?')) { state.settings = await api.resetSettings(); state.info = await api.info(); fillSettings(); } };
  $('resetSystem').onclick = () => { $('sSystem').value = state.info.defaultSystemPrompt; };
  $('sTemplate').onchange = () => { $('templateFileRow').hidden = $('sTemplate').value !== 'file'; };
  $('pickTemplate').onclick = async () => { const p = await api.pickFile({ title: 'Choose a Jinja chat template', filters: [{ name: 'Jinja template', extensions: ['jinja', 'j2', 'txt'] }] }); if (p) $('sTemplateFile').value = p; };
  $('pickServer').onclick = async () => { const p = await api.pickFile({ title: 'Choose llama-server', filters: [] }); if (p) $('sServer').value = p; };
  $('openData').onclick = () => api.openDataFolder();
  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
  }));
}

init().catch((e) => toast(cleanErr(e), 'error', 15000));
