// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Updates - the page. Talks only to its own back end (iprps-updates-server).
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const h = (tag, props = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e[k] = v; else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k);
    return e;
  };
  let st = null, from = 0, polling = null, closed = false;
  const LABEL = { check: 'Looking for updates', upgrade: 'Installing updates', install: 'Installing', remove: 'Removing', auto: 'Changing the setting' };

  async function call(path, body) {
    const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-IPRPS': '1' }, body: JSON.stringify(body) };
    const r = await fetch(path, opt);
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }
  function toast(msg, bad) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 5000);
  }
  const ago = s => {
    if (!s) return 'never';
    const d = (Date.now() / 1000 - s) | 0;
    if (d < 90) return 'just now';
    if (d < 5400) return `${Math.round(d / 60)} minutes ago`;
    if (d < 129600) return `${Math.round(d / 3600)} hours ago`;
    return new Date(s * 1000).toLocaleString();
  };

  function render() {
    const busy = st.busy;
    $('version').textContent = `${st.version}${st.base ? ' · iprps-base ' + st.base : ''}`;
    const n = st.updates.length;
    const hero = $('hero');
    hero.className = 'card hero ' + (st.ok === false ? 'bad' : n ? '' : st.checked ? 'ok' : '');
    $('heroIcon').textContent = st.ok === false ? '!' : n ? '⬇' : '✓';
    $('heroTitle').textContent = st.ok === false ? 'Could not check for updates'
      : n ? `${n} update${n > 1 ? 's' : ''} ready` : st.checked ? 'IPRPS OS is up to date' : 'Not checked yet';
    $('heroText').textContent = (st.ok === false ? st.error + ' · ' : '') + `Last check: ${ago(st.checked)}`;
    $('upgrade').hidden = !n; $('upgrade').disabled = busy; $('check').disabled = busy;
    $('restart').hidden = !st.restart;
    $('updatesCard').hidden = !n;
    const ub = $('updates'); ub.textContent = '';
    for (const u of st.updates) ub.append(h('tr', {}, h('td', { text: u.name }), h('td', { text: u.old }), h('td', { text: u.new })));

    const ex = $('extras'); ex.textContent = '';
    if (!st.extras.length) ex.append(h('p', { class: 'none', text: st.checked ? 'Nothing offered yet.' : 'Check for updates first: the list comes with it.' }));
    const row = x => {
      let btn = null, tag = null;
      if (x.installed) {
        tag = h('span', { class: 'tag on', text: 'installed' });
        if (x.removable) btn = h('button', { class: 'ghost small', text: 'Remove', disabled: busy, onclick: () => act('remove', { names: [x.name] }, `Remove ${x.name}?`) });
        else if (x.required_by) tag.title = `Part of your edition (needed by ${x.required_by})`;
      } else if (x.installable) {
        btn = h('button', { class: 'small', text: 'Install', disabled: busy, onclick: () => act('install', { names: [x.name] }, `Install ${x.name}${x.size ? ' (' + x.size + ')' : ''}? Waiting updates are installed too.`) });
      } else {
        tag = h('span', { class: 'tag', text: x.needs && x.needs.startsWith('a bigger edition') ? 'not in this edition' : x.needs ? `needs ${x.needs}` : 'not for this edition', title: 'This computer lacks something it needs' });
      }
      return h('div', { class: 'extra' },
        h('div', { class: 'desc' }, h('b', { text: x.name }), h('span', { class: 'tag', text: x.repo === 'iprps-apps' ? 'IPRPS app' : 'extra' }), tag,
          h('div', { class: 'fine', text: `${x.description || ''}${x.version ? ' · ' + x.version : ''}` })), btn);
    };
    const avail = st.extras.filter(x => !x.installed), mine = st.extras.filter(x => x.installed && x.removable),
          edition = st.extras.filter(x => x.installed && !x.removable);
    if (st.extras.length && !avail.length && !mine.length) ex.append(h('p', { class: 'none', text: 'Everything offered is already installed.' }));
    avail.forEach(x => ex.append(row(x)));
    if (mine.length) { ex.append(h('h3', { class: 'sub', text: 'Added by you' })); mine.forEach(x => ex.append(row(x))); }
    if (edition.length) ex.append(h('details', {}, h('summary', { text: `Part of your edition (${edition.length})` }), h('div', { class: 'extras' }, edition.map(row))));
    $('auto').checked = !!st.auto; $('auto').disabled = busy;
    const ip = $('iprps'); ip.textContent = '';
    for (const [k, v] of Object.entries(st.iprps).sort()) ip.append(h('tr', {}, h('td', { text: k }), h('td', { text: v })));
  }

  async function load() {
    try { st = await call('/api/status'); render(); if (st.busy) follow(); }
    catch (e) { toast(e.message, true); }
  }

  async function act(kind, body = {}, question) {
    if (question && !confirm(question)) return;
    try {
      await call('/api/' + kind, body);
      from = 0; $('log').textContent = ''; follow(kind);
    } catch (e) { toast(e.message, true); }
  }

  function follow(kind) {
    $('jobCard').hidden = false; $('jobBar').parentNode.className = 'progress';
    $('jobTitle').textContent = (LABEL[kind] || 'Working') + '…';
    document.querySelectorAll('main button').forEach(b => { b.disabled = true; });
    clearInterval(polling);
    polling = setInterval(async () => {
      try {
        const j = await call(`/api/job?from=${from}`);
        if (j.lines.length) {
          const log = $('log'); log.textContent += j.lines.join('\n') + '\n'; log.scrollTop = log.scrollHeight; from = j.next;
        }
        if (j.kind) $('jobTitle').textContent = (LABEL[j.kind] || 'Working') + (j.running ? '…' : j.rc === 0 ? ': done' : ': stopped');
        if (!j.running) {
          clearInterval(polling);
          $('jobBar').parentNode.className = 'progress ' + (j.rc === 0 ? 'done' : 'failed');
          if (j.rc === 0) toast('Done.'); else toast('It stopped: the messages below say why. Nothing was half-installed.', true);
          await load();
        }
      } catch (e) { clearInterval(polling); toast(e.message, true); }
    }, 700);
  }

  $('check').onclick = () => act('check');
  $('upgrade').onclick = () => act('upgrade', {}, 'Install all updates now? Close the IPRPS Table first if it is open.');
  $('auto').onchange = () => act('auto', { on: $('auto').checked });
  $('close').onclick = async () => {
    try { const j = await call('/api/quit', {}); if (!j.ok) return toast('Wait until the installation finishes.', true); } catch {}
    closed = true; window.close();
    document.body.textContent = 'IPRPS Updates is closed. You can close this window.';
  };
  setInterval(() => { if (!closed) call('/api/ping', {}).catch(() => {}); }, 30000);
  load();
})();
