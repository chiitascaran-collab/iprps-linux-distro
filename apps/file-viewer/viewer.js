// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS File Viewer - front end. Files are read in the browser; nothing is uploaded unless you import a sheet.
(() => {
  'use strict';
  const { $, h, act } = IP;
  const ICON = { error: '✖', warn: '⚠', ok: '✓', info: 'ℹ' };
  const MAX = 20 * 1024 * 1024;
  const docs = [];                 // { name, size, text, a: analysis }
  let cur = -1, view = IP.store.get('fv.view', 'report');

  function verdictOf(a) {
    const e = a.report.filter(r => r.level === 'error').length, w = a.report.filter(r => r.level === 'warn').length;
    return e ? ['error', `${e} problem${e === 1 ? '' : 's'} to fix${w ? `, ${w} warning${w === 1 ? '' : 's'}` : ''}`]
      : w ? ['warn', `Usable, with ${w} warning${w === 1 ? '' : 's'}`] : ['ok', 'Looks good: nothing to fix'];
  }

  async function addFiles(list) {
    for (const f of list) {
      if (f.size > MAX) { IP.toast(`${f.name}: larger than 20 MB, not opened.`, true); continue; }
      const text = await f.text();
      docs.push({ name: f.name, size: f.size, text, a: IPValidate.analyze(f.name, text) });
    }
    renderFiles(); show(docs.length - 1);
  }
  function renderFiles() {
    const ul = $('fileList'); ul.textContent = '';
    if (!docs.length) ul.append(h('li', { class: 'none', style: { display: 'block' }, text: 'No files open.' }));
    docs.forEach((d, i) => {
      const [lvl] = verdictOf(d.a);
      ul.append(h('li', { class: i === cur ? 'on' : '', onclick: () => show(i), title: d.name },
        h('span', { text: { error: '✖', warn: '⚠', ok: '✓' }[lvl], style: { color: `var(--${lvl === 'error' ? 'bad' : lvl === 'warn' ? 'warn' : 'good'})` } }),
        h('div', { style: { minWidth: 0 } }, h('b', { text: d.name }), h('small', { text: d.a.label })),
        h('button', { class: 'icon', text: '×', title: 'Close', onclick: e => { e.stopPropagation(); docs.splice(i, 1); renderFiles(); show(Math.min(cur, docs.length - 1)); } })));
    });
  }

  // ---------------------------------------------------------------- one file
  function show(i) {
    cur = i;
    document.querySelectorAll('#fileList li').forEach((li, k) => li.classList.toggle('on', k === i));
    $('emptyMsg').hidden = i >= 0; $('doc').hidden = i < 0;
    $('outline').textContent = ''; $('outlineH').hidden = true;
    if (i < 0) return;
    const d = docs[i], a = d.a;
    $('dName').textContent = d.name;
    $('dType').textContent = `${a.label} · ${d.size < 10240 ? d.size + ' bytes' : Math.round(d.size / 1024) + ' KB'}`;
    const [lvl, txt] = verdictOf(a);
    $('verdict').className = 'verdict ' + lvl; $('verdict').textContent = `${ICON[lvl]} ${txt}`;
    // actions
    const acts = $('dActions'); acts.textContent = '';
    if (a.type === 'sheet' && IP.status && IP.status.sheets) acts.append(h('button', { text: '📜 Import to Character Sheets', onclick: act(() => importSheet(d)) }));
    acts.append(h('button', { class: 'ghost', text: 'Copy text', onclick: act(async () => { await navigator.clipboard.writeText(d.text); IP.toast('Copied'); }) }),
      h('button', { class: 'ghost', text: 'Print', onclick: () => window.print() }));
    // report
    const rep = $('vReport'); rep.textContent = '';
    if (a.summary.length) rep.append(h('div', { class: 'summary' }, a.summary.map(([k, v]) => h('div', {}, h('small', { text: k }), h('b', { text: String(v) })))));
    const ul = h('ul', { class: 'report' }); let g = null;
    const order = { error: 0, warn: 1, info: 2, ok: 3 };
    const groups = [...new Set(a.report.map(r => r.group))];
    for (const grp of groups) {
      ul.append(h('li', { class: 'g', text: grp }));
      for (const r of a.report.filter(x => x.group === grp).sort((x, y) => order[x.level] - order[y.level]))
        ul.append(h('li', { class: r.level }, h('span', { text: ICON[r.level], style: { color: `var(--${{ error: 'bad', warn: 'warn', ok: 'good', info: 'teal' }[r.level]})` } }), h('span', { text: r.text })));
    }
    rep.append(ul);
    // formatted view
    const v = $('vView'); v.textContent = '';
    if (a.json) v.append(tree(a.json, d.name));
    else v.innerHTML = IPMarkdown.render(d.text);
    $('vRaw').textContent = a.json ? JSON.stringify(a.json, (k, val) => (k === 'avatar' && typeof val === 'string' && val.length > 200 ? val.slice(0, 80) + `… (${Math.round(val.length / 1024)} KB)` : val), 2) : d.text;
    // outline (Markdown headings)
    if (a.outline.length) {
      $('outlineH').hidden = false;
      const heads = () => [...$('vView').querySelectorAll('h2, h3, h4, h5')];
      a.outline.slice(0, 200).forEach((o, k) => $('outline').append(h('li', { class: 'l' + o.level, text: o.text, title: o.text,
        onclick: () => { setView('view'); const el = heads()[k]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } })));
    }
    setView(view);
  }
  function tree(o, label) {
    if (o === null || typeof o !== 'object') return h('span', { class: 'v', text: JSON.stringify(o) });
    const box = h('details', { open: true }, h('summary', { text: `${label} ${Array.isArray(o) ? `[${o.length}]` : `{${Object.keys(o).length}}`}` }));
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') box.append(tree(v, k));
      else box.append(h('div', { class: 'kv' }, h('span', { class: 'k', text: k + ': ' }),
        h('span', { class: 'v', text: k === 'avatar' && typeof v === 'string' && v.length > 200 ? `(picture, ${Math.round(v.length / 1024)} KB)` : typeof v === 'string' ? v : JSON.stringify(v) })));
    }
    const root = h('div', { class: 'jtree' }, box);
    return root;
  }
  function setView(v) {
    view = v; IP.store.set('fv.view', v);
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    $('vReport').hidden = v !== 'report'; $('vView').hidden = v !== 'view'; $('vRaw').hidden = v !== 'raw';
  }
  document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => setView(b.dataset.v); });

  async function importSheet(d) {
    const j = await IP.api('save', { sheet: d.a.json, file_name: d.name, source: 'import' }, '', '../character-sheets/api.php');
    IP.toast(`Imported “${j.name}”${j.warnings && j.warnings.length ? ' — ' + j.warnings.join(' ') : ''}`);
    if (confirm(`“${j.name}” is in Character Sheets. Open it there?`)) window.open(`../character-sheets/?id=${j.id}`, 'iprps-character-sheets');
  }

  // ---------------------------------------------------------------- opening files
  $('files').onchange = act(async () => { await addFiles([...$('files').files]); $('files').value = ''; });
  let depth = 0;
  document.addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { depth++; $('dropzone').hidden = false; } });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('dropzone').hidden = true; } });
  document.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { depth = 0; $('dropzone').hidden = true; if (e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]).catch(err => IP.toast(err.message, true)); } });

  renderFiles();
  IP.boot(async () => { if (cur >= 0) show(cur); });
})();
