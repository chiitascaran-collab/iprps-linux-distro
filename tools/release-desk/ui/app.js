'use strict';
// IPRPS Release Desk - the page. Talks only to the Desk on this computer (127.0.0.1), with the key from the link.
(() => {
  const $ = s => document.querySelector(s);
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = s => h(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/^&gt; (.*)$/gm, '<i>$1</i>').replace(/\n/g, '<br>');
  let KEY = '';
  try { const m = /k=([\w-]+)/.exec(location.hash); if (m) { KEY = m[1]; sessionStorage.setItem('deskKey', KEY); history.replaceState(null, '', '/'); } else KEY = sessionStorage.getItem('deskKey') || ''; } catch {}

  async function api(p, body) {
    const r = await fetch('/api/' + p, { method: body ? 'POST' : 'GET', headers: { 'X-Desk-Token': KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ error: 'The Desk did not answer' }));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }
  function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, bad ? 7000 : 3000); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    toast('Copied. Paste it into the window named on the step.');
  }

  let STATE = null, STATUS = null, CUR = null, OPEN = null, POLL = null;
  const logs = {}; // step id -> {lines, done, code}

  // ---------- tabs ----------
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  function showTab(t) {
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
    if (t === 'status') loadStatus(); if (t === 'folders') renderFolders();
  }

  async function loadState() {
    STATE = await api('state');
    $('#ver').textContent = 'version ' + STATE.version;
    $('#here').innerHTML = 'Running in <b>' + h(STATE.locLabel) + '</b>';
    renderJobs();
  }
  function renderJobs() {
    const ul = $('#jobList'); ul.innerHTML = '';
    $('#noJobs').hidden = STATE.jobs.length > 0;
    for (const j of STATE.jobs) {
      const li = document.createElement('li'); li.className = CUR && CUR.job.id === j.id ? 'on' : '';
      li.innerHTML = `${h(j.title)}<small>${j.done}/${j.total} steps · ${new Date(j.updated).toLocaleDateString()}</small><div class="bar"><i></i></div>`;
      li.querySelector('i').style.width = (j.total ? 100 * j.done / j.total : 0) + '%';
      li.tabIndex = 0; li.onclick = li.onkeydown = e => { if (e.type === 'click' || e.key === 'Enter') openJob(j.id); };
      ul.append(li);
    }
  }

  // ---------- new task ----------
  $('#newTask').onclick = async () => { CUR = null; renderJobs(); await ensureStatus(); chooser(); };
  async function ensureStatus() { if (!STATUS) STATUS = await api('status').catch(() => null); }
  function chooser() {
    const w = $('#work');
    w.innerHTML = '<h2>What do you want to do?</h2><div class="cards"></div>';
    for (const wf of STATE.workflows) {
      const b = document.createElement('button'); b.className = 'card';
      b.innerHTML = `<div class="ic">${h(wf.icon)}</div><b>${h(wf.title)}</b><span>${h(wf.blurb)}</span>`;
      b.onclick = () => form(wf); w.querySelector('.cards').append(b);
    }
    if (STATUS && !STATUS.srcOk) w.insertAdjacentHTML('afterbegin', `<p class="why">Your repository isn't reachable here (${h(STATE.cfg.src)}). Check <b>Folders</b> first.</p>`);
  }
  function form(wf) {
    const w = $('#work');
    w.innerHTML = `<h2>${h(wf.icon)} ${h(wf.title)}</h2><p class="hint">${h(wf.blurb)}</p><form class="task" novalidate></form>`;
    const f = w.querySelector('form');
    for (const p of wf.params) {
      const d = document.createElement('div'); d.className = 'field'; const id = 'p_' + p.key;
      let input;
      if (p.type === 'bool') { d.innerHTML = `<label class="chk"><input type="checkbox" id="${id}" ${p.def ? 'checked' : ''}> ${h(p.label)}</label>`; }
      else {
        let opts = null;
        if (p.type === 'choice') opts = p.choices;
        if (p.type === 'app') opts = (STATUS?.apps || []).map(a => [a.pkg, `${a.name} (${a.pkg})`]);
        if (p.type === 'package') opts = (STATUS?.pkgDirs || []).map(x => [x, x]);
        if (opts) input = `<select id="${id}">${opts.map(o => `<option value="${h(o[0])}" ${o[0] === p.def ? 'selected' : ''}>${h(o[1])}</option>`).join('')}</select>`;
        else input = `<input type="text" id="${id}" value="${h(p.def || '')}" ${p.type === 'package-or-example' ? 'list="dl_' + id + '"' : ''} autocomplete="off">` +
          (p.type === 'package-or-example' ? `<datalist id="dl_${id}">${[...(STATUS?.pkgDirs || []), ...(STATUS?.examples || [])].map(x => `<option value="${h(x)}">`).join('')}</datalist>` : '');
        d.innerHTML = `<label for="${id}">${h(p.label)}${p.required ? '' : ' <span class="opt">(optional)</span>'}</label><div class="row">${input}${p.type === 'path' ? '<button type="button" class="br">Browse…</button>' : ''}</div>`;
        if (p.type === 'path') d.querySelector('.br').onclick = () => browse(d.querySelector('input'));
      }
      if (p.help) d.insertAdjacentHTML('beforeend', `<small>${h(p.help)}</small>`);
      f.append(d);
    }
    if (wf.id === 'add-app') {   // fill the folder name from the source
      const src = f.querySelector('#p_source'), fo = f.querySelector('#p_folder');
      src.addEventListener('change', () => { if (!fo.value) fo.value = src.value.split(/[\\/]/).pop().replace(/\.zip$/i, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''); });
    }
    f.insertAdjacentHTML('beforeend', '<p class="err" id="ferr"></p><div class="row"><button type="button" id="back">← Back</button><button class="primary" type="submit">Start the walkthrough</button></div>');
    f.querySelector('#back').onclick = chooser;
    f.onsubmit = async e => {
      e.preventDefault(); const params = {};
      for (const p of wf.params) { const el = f.querySelector('#p_' + p.key); params[p.key] = p.type === 'bool' ? el.checked : el.value; }
      try { const v = await api('new', { type: wf.id, params }); await loadState(); showJob(v); }
      catch (er) { f.querySelector('#ferr').textContent = er.message; }
    };
  }

  // ---------- a task ----------
  async function openJob(id) { try { showJob(await api('job/' + id)); } catch (e) { toast(e.message, true); } }
  function showJob(v) {
    const changed = !CUR || CUR.job.id !== v.job.id; CUR = v; renderJobs();
    if (changed) { OPEN = null; for (const k in logs) delete logs[k]; }
    const cur = v.steps.find(s => !['done', 'skipped'].includes(s.state));
    if (OPEN === null && cur) OPEN = cur.id;
    const done = v.steps.filter(s => ['done', 'skipped'].includes(s.state)).length;
    const w = $('#work');
    const params = Object.entries(v.job.params).filter(([, x]) => x !== '' && x !== false).map(([k, x]) => `${h(k)}: <b>${h(x === true ? 'yes' : x)}</b>`).join(' · ');
    w.innerHTML = `<div class="jobhead"><div><h2>${h(v.job.title)}</h2><div class="params">${params}</div><div class="bar"><i></i></div><small class="hint">${done} of ${v.steps.length} steps done</small></div><button class="danger small" id="del">Delete task</button></div><ol class="steps"></ol>`;
    w.querySelector('.jobhead i').style.width = (100 * done / v.steps.length) + '%';
    w.querySelector('#del').onclick = async () => { if (!confirm('Delete this task? (Your files are not changed.)')) return; await api('job/' + v.job.id + '/delete', {}); CUR = null; await loadState(); chooser(); };
    const ol = w.querySelector('.steps');
    for (const s of v.steps) ol.append(stepEl(v, s, s === cur));
    if (!cur) w.insertAdjacentHTML('beforeend', '<p class="s-ok"><b>✔ All steps are done.</b> You can delete the task, or keep it as a record.</p>');
    for (const r of v.runs) follow(r.id, r.step);
  }
  function stepEl(v, s, isCur) {
    const li = document.createElement('li');
    li.className = 'step ' + (s.state || '') + (isCur ? ' cur' : '');
    const icon = s.state === 'done' ? '✔' : s.state === 'skipped' ? '–' : s.state === 'failed' ? '!' : s.n;
    li.innerHTML = `<button class="sh" aria-expanded="${OPEN === s.id}"><span class="num">${h(icon)}</span><span class="where w-${h(s.where)}">${h(s.whereLabel)}</span><span class="stitle">${h(s.title)}${s.optional ? ' <span class="opt">(optional)</span>' : ''}</span></button>`;
    li.querySelector('.sh').onclick = () => { OPEN = OPEN === s.id ? '' : s.id; showJob(CUR); };
    if (OPEN !== s.id) return li;
    const b = document.createElement('div'); b.className = 'sb';
    b.innerHTML = `<p>${md(s.text || '')}</p>` + (s.cmd ? `<pre class="cmd">${h(s.cmd)}<button class="small cp">Copy</button></pre>` : '') +
      ((s.cmd || s.action) && !s.ok ? `<p class="why">${h(s.why)}</p>` : '') +
      `<div class="row">${(s.cmd || s.action) ? `<button class="primary run" ${s.ok ? '' : 'disabled'}>${s.action ? 'Do it' : 'Run here'}</button>` : ''}${/^scan/.test(s.id) && s.state === 'failed' && v.findings.length ? '' : '<button class="mk" data-st="done">Mark done</button>'}${s.optional || !s.state ? '<button class="mk" data-st="skipped">Skip</button>' : ''}${s.state ? '<button class="mk" data-st="">Undo</button>' : ''}<span class="stop-slot"></span></div>`;
    if (s.cmd) b.querySelector('.cp').onclick = () => copy(s.cmd);
    const run = b.querySelector('.run'); if (run) run.onclick = () => runStep(s);
    b.querySelectorAll('.mk').forEach(x => x.onclick = async () => { try { const nv = await api('job/' + v.job.id + '/mark', { step: s.id, status: x.dataset.st }); if (x.dataset.st) OPEN = null; showJob(nv); loadState(); } catch (e) { toast(e.message, true); } });
    if (logs[s.id]) b.append(logEl(s.id));
    if (/^scan/.test(s.id) && v.findings.length && s.state === 'failed') {
      const f = document.createElement('div'); f.className = 'findings';
      f.innerHTML = `<b>Check these before going on</b><table>${v.findings.map(x => `<tr><td><code>${h(x.file)}${x.line ? ':' + x.line : ''}</code></td><td>${h(x.rule)}</td><td><code>${h(x.shown)}</code></td></tr>`).join('')}</table><p class="hint">Remove real passwords and keys from the files (IPRPS OS apps read the database password from /etc/iprps/db.php), then run the step again. If something here is only an example value, mark it as safe.</p><button class="small allow">Mark these as safe</button>`;
      f.querySelector('.allow').onclick = async () => { if (!confirm('These are not real passwords or keys?')) return; try { showJob(await api('job/' + v.job.id + '/allow', { step: s.id })); toast('Marked as safe. Run the step again.'); } catch (e) { toast(e.message, true); } };
      b.append(f);
    }
    li.append(b); return li;
  }
  function logEl(sid) {
    const L = logs[sid], d = document.createElement('div'); d.className = 'log'; d.id = 'log-' + sid;
    d.innerHTML = L.lines.map(l => /^(✔|Checked .*no passwords|No passwords)/.test(l) ? `<span class="ok">${h(l)}</span>` : /^(✘|STOPPED|■)/.test(l) ? `<span class="bad">${h(l)}</span>` : h(l)).join('\n');
    setTimeout(() => { d.scrollTop = d.scrollHeight; }, 0); return d;
  }
  async function runStep(s) {
    try { const r = await api('job/' + CUR.job.id + '/run', { step: s.id }); logs[s.id] = { lines: [], done: false }; follow(r.run, s.id); }
    catch (e) { toast(e.message, true); }
  }
  function follow(runId, sid) {
    clearTimeout(POLL); let from = 0; logs[sid] = logs[sid] || { lines: [], done: false };
    const tick = async () => {
      let r; try { r = await fetch(`/api/run/${runId}?from=${from}`, { headers: { 'X-Desk-Token': KEY } }).then(x => x.json()); } catch { POLL = setTimeout(tick, 2000); return; }
      if (r.error) return;
      logs[sid].lines.push(...r.lines); from = r.next;
      const old = document.getElementById('log-' + sid);
      if (old) old.replaceWith(logEl(sid)); else if (OPEN === sid) { const sb = document.querySelector('.step.cur .sb, .sb'); if (sb) sb.append(logEl(sid)); }
      const slot = document.querySelector('.stop-slot');
      if (slot && !r.done && !slot.firstChild) { const b = document.createElement('button'); b.className = 'danger small'; b.textContent = 'Stop'; b.onclick = () => api('run/' + runId + '/stop', {}); slot.append(b); }
      if (r.done) { logs[sid].done = true; const v = await api('job/' + CUR.job.id); if (r.code === 0) OPEN = null; showJob(v); loadState(); toast(r.code === 0 ? '✔ Step done' : 'The step did not finish: read the output', r.code !== 0); if (r.code !== 0) OPEN = sid; return; }
      POLL = setTimeout(tick, 900);
    };
    tick();
  }

  // ---------- status ----------
  async function loadStatus() {
    const el = $('#status'); el.innerHTML = '<p class="hint">Reading…</p>';
    try { STATUS = await api('status'); } catch (e) { el.innerHTML = `<p class="err">${h(e.message)}</p>`; return; }
    const s = STATUS, yes = (v, a = 'yes', b = 'no') => v === null || v === undefined ? '<b class="s-muted">n/a here</b>' : v ? `<b class="s-ok">${a}</b>` : `<b class="s-warn">${b}</b>`;
    const g = s.git ? (s.git.error ? `<b class="s-bad">${h(s.git.error)}</b>` : `<b>${h(s.git.branch)}</b> · ${s.git.changed} changed${s.git.ahead ? ` · <span class="s-warn">${s.git.ahead} not pushed</span>` : ''}`) : '<b class="s-muted">not a Git repository</b>';
    el.innerHTML = `<div class="tiles">
      <div class="tile"><small>Running in</small><b>${h(s.locLabel)}</b></div>
      <div class="tile"><small>Repository</small>${s.srcOk ? '<b class="s-ok">found</b>' : '<b class="s-bad">not found</b>'}<br><code>${h(s.src)}</code></div>
      <div class="tile"><small>Build image</small>${s.image ? (s.chroot ? '<b class="s-ok">open</b>' : '<b class="s-warn">open, not ready</b>') : '<b class="s-warn">closed</b>'}</div>
      <div class="tile"><small>Signing key</small>${yes(s.key, 'present', 'missing')}</div>
      <div class="tile"><small>Git</small>${g}</div>
      <div class="tile"><small>Versions</small>${s.versions ? `iprps-apps <b>${h(s.versions.apps)}</b><br>iprps-base <b>${h(s.versions.base)}</b>${s.versions.basePublished ? ` <span class="s-muted">(published ${h(s.versions.basePublished)})</span>` : ''}` : '—'}</div></div>
      <h3>Apps (${s.apps.length})</h3>
      <table class="apps"><thead><tr><th>App</th><th>Package</th><th>Folder</th><th>Editions</th><th>Built</th><th>Published</th></tr></thead><tbody>
      ${s.apps.map(a => `<tr><td><b>${h(a.name)}</b><br><span class="hint">${h(a.desc)}</span></td><td><code>${h(a.pkg)}</code></td><td>${h(a.webFolder)}</td><td><span class="tag">${h({ lite: 'all', medium: 'Medium+', advanced: 'Advanced', optional: 'optional' }[a.edition])}</span></td><td>${a.built ? '<span class="s-ok">✔ ' + h(a.version) + '</span>' : '<span class="s-muted">—</span>'}</td><td>${a.published === null ? '<span class="s-muted">n/a here</span>' : a.published ? (a.published === a.version ? '<span class="s-ok">' : '<span class="s-warn">') + h(a.published) + '</span>' : '<span class="s-warn">not yet</span>'}</td></tr>`).join('')}
      </tbody></table>
      ${s.retired.length ? `<p class="hint">Retired (removed from computers by IPRPS Updates): ${s.retired.map(h).join(', ')}</p>` : ''}
      <p class="hint">“Published” is your signed repository on this PC (iprps-repo.sh list); <b>Publish the repository</b> checks the web server.</p>`;
  }

  // ---------- folders ----------
  function renderFolders() {
    const el = $('#folders'); const cfg = STATE.cfg, chk = Object.fromEntries(STATE.folders.map(f => [f.key, f]));
    const groups = {}; for (const f of STATE.fields) (groups[f.group] = groups[f.group] || []).push(f);
    el.innerHTML = `<p class="hint">Where your files are. Windows paths (G:\\IPRPS\\…) work too. Saved in the Desk's settings on this computer.</p>`;
    for (const [g, fs] of Object.entries(groups)) {
      const d = document.createElement('div'); d.className = 'fgroup'; d.innerHTML = `<h3>${h(g)}</h3>`;
      for (const f of fs) {
        const c = chk[f.key] || {}, cls = { ok: 's-ok', warn: 's-warn', missing: 's-bad', new: 's-muted' }[c.state] || 's-muted';
        const row = document.createElement('div'); row.className = 'frow';
        const input = f.kind === 'choice' ? `<select data-k="${f.key}">${f.choices.map(x => `<option ${x === cfg[f.key] ? 'selected' : ''}>${h(x)}</option>`).join('')}</select>` : `<input type="text" data-k="${f.key}" value="${h(cfg[f.key])}">`;
        row.innerHTML = `<label><b>${h(f.label)}</b></label><div class="row">${input}${f.kind === 'dir' ? '<button type="button" class="br">Browse…</button>' : ''}${c.state === 'new' ? '<button type="button" class="mkd">Create</button>' : ''}</div>
          <div class="st ${cls}">${c.state && c.state !== 'n/a' ? (c.state === 'ok' ? '✔ ' : '● ') + h(c.note || 'Found') : h(c.note || '')}${c.win ? ` <span class="s-muted">· ${h(c.win)}</span>` : ''}</div>${f.help ? `<div class="note">${h(f.help)}</div>` : ''}`;
        const br = row.querySelector('.br'); if (br) br.onclick = () => browse(row.querySelector('input'), true);
        const mk = row.querySelector('.mkd'); if (mk) mk.onclick = async () => { try { const r = await api('mkdir', { key: f.key }); STATE.folders = r.folders; renderFolders(); toast('Created.'); } catch (e) { toast(e.message, true); } };
        d.append(row);
      }
      el.append(d);
    }
    const b = document.createElement('div'); b.className = 'row'; b.innerHTML = '<button class="primary" id="saveF">Save folders</button>'; el.append(b);
    b.querySelector('#saveF').onclick = async () => {
      const values = {}; el.querySelectorAll('[data-k]').forEach(i => values[i.dataset.k] = i.value);
      try { const r = await api('config', { values }); STATE.cfg = r.cfg; STATE.folders = r.folders; STATUS = null; renderFolders(); toast('Saved.'); } catch (e) { toast(e.message, true); }
    };
  }

  // ---------- browse ----------
  let BR = null;
  async function browse(input, dirsOnly) {
    BR = { input, dirsOnly, sel: null }; $('#browser').hidden = false; $('#brPick').textContent = dirsOnly ? 'Use this folder' : 'Use the selected item';
    await brGo(input.value || '');
    $('#brList').querySelector('button')?.focus();
  }
  async function brGo(p) {
    let r; try { r = await api('browse', { path: p }); } catch (e) { toast(e.message, true); return; }
    BR.path = r.path; BR.sel = null;
    $('#brPath').textContent = r.win ? `${r.win}   (${r.path})` : r.path;
    $('#brPlaces').innerHTML = ''; for (const [n, pth] of r.places) { const b = document.createElement('button'); b.className = 'small'; b.textContent = n; b.onclick = () => brGo(pth); $('#brPlaces').append(b); }
    $('#brUp').onclick = () => brGo(r.parent);
    const ul = $('#brList'); ul.innerHTML = '';
    for (const e of r.entries) {
      if (BR.dirsOnly && !e.dir) continue;
      const li = document.createElement('li'), b = document.createElement('button');
      b.textContent = (e.dir ? '📁 ' : '🗜 ') + e.name; const full = r.path.replace(/\/$/, '') + '/' + e.name;
      b.onclick = () => { ul.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); BR.sel = full; };
      b.ondblclick = () => e.dir ? brGo(full) : pick(full);
      li.append(b); ul.append(li);
    }
    if (!ul.children.length) ul.innerHTML = '<li class="hint">&nbsp; (empty)</li>';
  }
  function pick(p) { BR.input.value = p; BR.input.dispatchEvent(new Event('change')); $('#browser').hidden = true; BR.input.focus(); }
  $('#brPick').onclick = () => pick(BR.dirsOnly ? (BR.sel || BR.path) : (BR.sel || BR.path));
  $('#brCancel').onclick = () => { $('#browser').hidden = true; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#browser').hidden) $('#browser').hidden = true; });

  // ---------- start ----------
  (async () => {
    if (!KEY) { $('#work').innerHTML = '<h2>Open the Desk with its link</h2><p>The window where the Desk is running shows a link that starts with <code>http://127.0.0.1:7791/#k=</code>. Open that link.</p>'; return; }
    try { await loadState(); await ensureStatus(); if (STATE.jobs[0]) openJob(STATE.jobs[0].id); else chooser(); }
    catch (e) { $('#work').innerHTML = `<h2>The Desk did not answer</h2><p class="err">${h(e.message)}</p><p>Start it again with <code>iprps-desk</code>, and open the new link it shows.</p>`; }
  })();
})();
