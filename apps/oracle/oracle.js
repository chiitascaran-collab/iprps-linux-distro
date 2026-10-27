// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Oracle - front end. Talks only to api.php (same origin, Universal Login token
// added by auth-client.js), never to Ollama directly.
(() => {
  const API = 'api.php';
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { return localStorage.getItem('oracle.' + k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('oracle.' + k, v); } catch {} },
  };
  let busy = null;            // AbortController while a reply is streaming

  // ---------------------------------------------------------------- helpers
  async function api(action, body, params = '') {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const r = await fetch(`${API}?action=${action}${params}`, opt);
    let j;
    try { j = await r.json(); } catch { throw new Error(`Server error (HTTP ${r.status})`); }
    if (!j.ok) throw new Error(j.error || 'Request failed');
    return j;
  }
  function toast(msg, bad = false) {
    const t = $('toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3200);
  }
  const campaign = () => +$('campaign').value || 0;
  const campaignName = () => $('campaign').selectedOptions[0]?.textContent || '';
  function banner(html) { const b = $('banner'); b.innerHTML = html || ''; b.hidden = !html; }

  // ---------------------------------------------------------------- chat log
  function clearLog() { $('log').innerHTML = ''; }
  function addMsg(role, text, id) {
    $('log').querySelector('.welcome')?.remove();
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    el.innerHTML = `<div class="who">${role === 'user' ? 'Session Master' : '✦ Oracle'}</div><div class="prose"></div>`;
    el.dataset.text = text; if (id) el.dataset.id = id;
    setBody(el, text);
    if (role === 'assistant') addActions(el);
    $('log').appendChild(el);
    el.scrollIntoView({ block: 'end' });
    return el;
  }
  function setBody(el, text) {
    el.dataset.text = text;
    const p = el.querySelector('.prose');
    if (el.classList.contains('user')) p.textContent = text; else p.innerHTML = IPMarkdown.render(text);
  }
  // Shorten generator requests (stored with their format instructions) for display
  function shownUserText(t) {
    const m = t.match(/^(Create one NPC|Describe one location|Generate a treasure|Design one encounter|Give three distinct plot hooks|Give 12 names|Write a read-aloud)/);
    if (!m) return t;
    const d = t.match(/(?:Extra details[^:]*|The scene): ([^\n]*?)\.?\s*(?:\n|$)/);
    const label = { 'Create one NPC': 'NPC', 'Describe one location': 'Location', 'Generate a treasure': 'Loot',
      'Design one encounter': 'Encounter', 'Give three distinct plot hooks': 'Plot hook', 'Give 12 names': 'Names',
      'Write a read-aloud': 'Read-aloud' }[m[1]];
    return '⟡ ' + label + (d && d[1] && d[1] !== 'none' ? ': ' + d[1] : '');
  }

  function addActions(el) {
    const bar = document.createElement('div');
    bar.className = 'actions';
    const acts = [
      ['Copy', () => navigator.clipboard.writeText(el.dataset.text).then(() => toast('Copied'))],
      ['Pin to memory', () => pin(el.dataset.text)],
      ['Show players', () => showPlayers(el.dataset.text)],
      ['Save NPC', () => save('npc', el.dataset.text)],
      ['Save quest', () => save('quest', el.dataset.text)],
      ['Add to log', () => save('log', el.dataset.text)],
    ];
    for (const [label, fn] of acts) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mini'; b.textContent = label;
      b.onclick = async () => { try { await fn(); } catch (e) { toast(e.message, true); } };
      bar.appendChild(b);
    }
    el.appendChild(bar);
  }

  // ---------------------------------------------------------------- actions on replies
  async function pin(text) {
    const short = text.length > 600 ? prompt('Pin a shorter fact (edit as needed):', text.slice(0, 600)) : text;
    if (!short) return;
    await api('pin', { campaign: campaign(), text: short });
    toast('Pinned to campaign memory'); loadMemory();
  }
  async function showPlayers(text) {
    // Players see the read-aloud part when there is one, otherwise the whole reply
    const m = text.match(/Read-aloud\W*:\s*([\s\S]*?)(?:\n\s*\n|\n\W*[A-Z][A-Za-z ]+:|$)/i);
    const nm = text.match(/^\W*(?:Name|Title)\W*:\s*(.+)$/mi);
    const body = prompt('Text shown to the players (edit before showing):', (m ? m[1] : text).trim());
    if (!body) return;
    await api('display', { campaign: campaign(), title: nm ? nm[1].replace(/[*_#]/g, '').trim() : '', body });
    toast('Showing on the player display');
  }
  async function save(type, text) {
    if (!campaign()) throw new Error('Choose a campaign first.');
    const body = { campaign: campaign(), type, text };
    if (type === 'npc' && !/^\W*Name\W*:/mi.test(text)) {
      body.name = prompt('Name for this NPC:'); if (!body.name) return;
    }
    if (type === 'quest' && !/^\W*(Title|Name)\W*:/mi.test(text)) {
      body.name = prompt('Title for this quest:'); if (!body.name) return;
    }
    if (type === 'log') {
      body.kind = (prompt('Log entry type: note, event, loot, combat, roll or xp', 'note') || '').trim().toLowerCase();
      if (!body.kind) return;
    }
    const j = await api('save', body);
    toast(j.saved); loadMemory();
  }

  // ---------------------------------------------------------------- sending
  async function send(payload) {
    if (busy) return;
    busy = new AbortController();
    $('send').disabled = true; $('stop').hidden = false;
    const userEl = payload.generator ? null : addMsg('user', payload.message);
    let reply = null, text = '';
    try {
      const r = await fetch(`${API}?action=chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: busy.signal,
        body: JSON.stringify({ campaign: campaign(), model: $('model').value, use_memory: $('useMemory').checked, ...payload }),
      });
      if (!r.ok || !(r.headers.get('Content-Type') || '').includes('ndjson')) {
        let msg = `Server error (HTTP ${r.status})`;
        try { msg = (await r.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          const o = JSON.parse(line);
          if (o.start) {
            if (payload.generator) addMsg('user', o.shown);
            reply = addMsg('assistant', '');
            reply.classList.add('streaming');
          } else if (o.t) {
            text += o.t;
            setBody(reply, text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trimStart());
            reply.scrollIntoView({ block: 'end' });
          } else if (o.error) {
            toast(o.error, true);
          } else if (o.done && o.id) {
            reply.dataset.id = o.id;
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') { toast(e.message, true); if (!reply && userEl) userEl.classList.add('failed'); }
    } finally {
      if (reply) {
        reply.classList.remove('streaming');
        if (!reply.dataset.text) reply.remove();
      }
      busy = null; $('send').disabled = false; $('stop').hidden = true;
    }
  }

  // ---------------------------------------------------------------- loading
  async function loadStatus() {
    try {
      const s = await api('status');
      const sel = $('model'); sel.innerHTML = '';
      for (const m of s.models) sel.add(new Option(m.replace(/:latest$/, ''), m));
      const want = store.get('model', s.default_model);
      sel.value = s.models.includes(want) ? want : (s.default_model || '');
      if (!s.ollama) {
        $('status').textContent = 'AI offline'; $('status').className = 'pill bad';
        banner('The local AI service isn\'t running. Open a terminal and run <code>sudo systemctl start ollama</code>, then reload.');
      } else if (!s.models.length) {
        $('status').textContent = 'No model'; $('status').className = 'pill bad';
        banner('No AI model is installed. Run <code>sudo iprps-ai-model status</code> in a terminal for help.');
      } else {
        $('status').textContent = 'Ollama ' + s.ollama; $('status').className = 'pill ok';
        banner(s.models.some(m => m.startsWith(s.iprps_model)) ? '' :
          `The IPRPS model <b>${s.iprps_model}</b> isn't installed; using <b>${sel.value}</b>.`);
      }
      const g = $('gens'); g.innerHTML = '';
      for (const gen of s.generators) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'gen';
        b.innerHTML = `<span>${gen.icon}</span>${gen.label}`;
        b.onclick = () => send({ generator: gen.key, details: $('details').value });
        g.appendChild(b);
      }
    } catch (e) { banner(e.message); }
  }
  async function loadCampaigns() {
    try {
      const j = await api('campaigns');
      const sel = $('campaign');
      for (const c of j.campaigns) sel.add(new Option(c.name + (c.setting ? ` — ${c.setting}` : ''), c.id));
      const want = store.get('campaign', '');
      if ([...sel.options].some(o => o.value === want)) sel.value = want;
    } catch (e) { toast(e.message, true); }
  }
  async function loadMemory() {
    try {
      const j = await api('memory', null, `&campaign=${campaign()}`);
      $('memory').textContent = j.memory || (campaign() ? 'Nothing recorded for this campaign yet.' : 'Choose a campaign.');
      const ul = $('pins'); ul.innerHTML = '';
      for (const p of j.pins) {
        const li = document.createElement('li');
        li.textContent = p.text;
        const x = document.createElement('button');
        x.className = 'x'; x.title = 'Unpin'; x.textContent = '×';
        x.onclick = async () => { await api('unpin', { id: p.id }); loadMemory(); };
        li.appendChild(x); ul.appendChild(li);
      }
    } catch (e) { toast(e.message, true); }
  }
  async function loadHistory() {
    clearLog();
    try {
      const j = await api('history', null, `&campaign=${campaign()}`);
      if (!j.messages.length) {
        $('log').innerHTML = `<div class="welcome"><div class="sigil big">✦</div><h1>The Oracle is listening.</h1>
          <p>${campaign() ? 'Campaign: <b>' + campaignName().replace(/[<>&]/g, '') + '</b>.<br>' : ''}Ask a rules question, improvise an NPC, describe a scene, or use a quick generator.</p></div>`;
      }
      for (const m of j.messages) addMsg(m.role, m.role === 'user' ? shownUserText(m.content) : m.content, m.id);
    } catch (e) { toast(e.message, true); }
  }

  // ---------------------------------------------------------------- wiring
  function boot(user) {
    $('who').textContent = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username;
    $('logout').onclick = () => IPAuth.logout();
    $('useMemory').checked = store.get('useMemory', '1') === '1';
    $('useMemory').onchange = () => store.set('useMemory', $('useMemory').checked ? '1' : '0');
    $('model').onchange = () => store.set('model', $('model').value);
    $('campaign').onchange = () => { store.set('campaign', $('campaign').value); loadHistory(); loadMemory(); };
    $('composer').onsubmit = e => {
      e.preventDefault();
      const t = $('input').value.trim(); if (!t) return;
      $('input').value = ''; send({ message: t });
    };
    $('input').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composer').requestSubmit(); } };
    $('stop').onclick = () => busy?.abort();
    $('pinAdd').onclick = async () => {
      const t = $('pinText').value.trim(); if (!t) return;
      try { await api('pin', { campaign: campaign(), text: t }); $('pinText').value = ''; loadMemory(); toast('Pinned'); }
      catch (e) { toast(e.message, true); }
    };
    $('clearChat').onclick = async () => {
      if (!confirm('Delete this chat history? Pinned facts and saved campaign entries stay.')) return;
      await api('clear', { campaign: campaign() }); loadHistory();
    };
    $('displayClear').onclick = async () => { try { await api('display_clear', {}); toast('Player display cleared'); } catch (e) { toast(e.message, true); } };
    $('displayOpen').onclick = () => window.open('display.php', 'iprps-player-display', 'popup,width=1280,height=720');
    loadStatus();
    loadCampaigns().then(() => { loadHistory(); loadMemory(); });
  }

  if (!window.IPAuth) {
    banner('Sign-in system not found: <code>../auth/auth-client.js</code> must exist next to this app (in <code>/srv/www/iprps/auth/</code>).');
  } else if (IPAuth.user) {
    boot(IPAuth.user);
  } else {
    document.addEventListener('ipauth:ready', e => boot(e.detail), { once: true });
  }
})();
