// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Writer - editor, documents list, autosave, import and export.
(() => {
  const $ = id => document.getElementById(id);
  const F = window.WFormats;
  const page = $('page');
  let docs = [], current = null, dirty = false, saveTimer = null, saving = false;

  // ---------------------------------------------------------------- helpers
  async function api(action, body, params = '') {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const r = await fetch(`api.php?action=${action}${params}`, opt);
    let j; try { j = await r.json(); } catch { throw new Error(`Server error (HTTP ${r.status})`); }
    if (!j.ok) throw new Error(j.error || 'Request failed');
    return j;
  }
  function toast(m, bad) {
    const t = $('toast'); t.textContent = m; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 3200);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const words = () => (page.innerText.match(/[\p{L}\p{N}’'-]+/gu) || []).length;
  const fileName = (ext) => ((($('title').value.trim() || 'Untitled document').replace(/[\\/:*?"<>|]+/g, ' ').trim()) || 'document') + '.' + ext;
  function setSaved(text) { $('saved').textContent = text; }
  function when(ts) {
    const d = new Date(ts.replace(' ', 'T')); if (isNaN(d)) return '';
    const today = new Date().toDateString() === d.toDateString();
    return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  // ---------------------------------------------------------------- documents
  function renderList() {
    const q = $('search').value.trim().toLowerCase();
    $('docs').innerHTML = docs.filter(d => !q || d.title.toLowerCase().includes(q)).map(d => `
      <li class="${current && current.id === +d.id ? 'active' : ''}" data-id="${d.id}">
        <button class="open"><span class="dt">${esc(d.title)}</span><small>${when(d.updated_at)} · ${d.words} words</small></button>
        <button class="del" title="Delete">×</button>
      </li>`).join('') || `<li class="none">${q ? 'No matches.' : 'No documents yet.'}</li>`;
    $('docs').querySelectorAll('li[data-id]').forEach(li => {
      li.querySelector('.open').onclick = () => openDoc(+li.dataset.id);
      li.querySelector('.del').onclick = () => deleteDoc(+li.dataset.id);
    });
  }
  async function loadList() { docs = (await api('list')).docs; renderList(); }

  function showDoc(doc) {
    current = doc;
    $('title').value = doc.id ? doc.title : '';
    page.innerHTML = doc.html || '<p><br></p>';
    dirty = false; setSaved(doc.id ? 'Saved' : ''); updateCount(); renderList();
    page.focus();
  }
  async function openDoc(id) {
    await saveNow();
    try { showDoc((await api('get', null, `&id=${id}`)).doc); } catch (e) { toast(e.message, true); }
  }
  async function newDoc(html = '', title = '') {
    await saveNow();
    showDoc({ id: 0, title, html });
    if (title) $('title').value = title;
    if (html) { dirty = true; scheduleSave(10); }
  }
  async function deleteDoc(id) {
    const d = docs.find(x => +x.id === id);
    if (!confirm(`Delete “${d ? d.title : 'this document'}”? This can't be undone.`)) return;
    try {
      await api('delete', { id });
      if (current && current.id === id) showDoc({ id: 0, title: '', html: '' });
      await loadList(); toast('Deleted');
    } catch (e) { toast(e.message, true); }
  }

  // ---------------------------------------------------------------- saving
  function scheduleSave(ms = 1200) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, ms); }
  function markDirty() { dirty = true; setSaved('Editing…'); updateCount(); scheduleSave(); }
  async function saveNow(opts = {}) {
    clearTimeout(saveTimer);
    if (!dirty || !current) return;
    if (!current.id && !page.innerText.trim() && !$('title').value.trim()) return;   // nothing typed yet
    if (saving) { scheduleSave(400); return; }
    saving = true; setSaved('Saving…');
    const body = { id: current.id || 0, title: $('title').value.trim() || firstLine() || 'Untitled document', html: F.sanitize(page.innerHTML), words: words() };
    try {
      const j = await (opts.keepalive
        ? fetch('api.php?action=save', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
        : api('save', body));
      if (!current.id) current.id = j.id;
      current.title = body.title; dirty = false; setSaved('Saved');
      if (!opts.keepalive) await loadList();
    } catch (e) { setSaved('Not saved'); toast(e.message, true); }
    finally { saving = false; }
  }
  const firstLine = () => (page.innerText.split('\n').find(l => l.trim()) || '').trim().slice(0, 60);

  // ---------------------------------------------------------------- editing
  function updateCount() { const t = page.innerText; $('count').textContent = `${words()} words · ${t.replace(/\s/g, '').length} characters`; }
  function cmd(c, v = null) { page.focus(); document.execCommand(c, false, v); markDirty(); syncToolbar(); }
  function syncToolbar() {
    document.querySelectorAll('.toolbar [data-cmd]').forEach(b => {
      let on = false; try { on = document.queryCommandState(b.dataset.cmd); } catch {}
      b.classList.toggle('on', on);
    });
    const sel = getSelection();
    if (!sel.rangeCount || !page.contains(sel.anchorNode)) return;
    let n = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    while (n && n !== page && !/^(P|H1|H2|H3|BLOCKQUOTE|LI|DIV)$/.test(n.tagName)) n = n.parentNode;
    const t = n && n !== page ? n.tagName.toLowerCase() : 'p';
    $('block').value = ['h1', 'h2', 'h3', 'blockquote'].includes(t) ? t : 'p';
  }

  // ---------------------------------------------------------------- import / export
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportAs(fmt) {
    $('exportMenu').hidden = true;
    if (fmt === 'pdf') { await saveNow(); window.print(); return; }
    const blocks = F.htmlToBlocks(new DOMParser().parseFromString(`<body>${F.sanitize(page.innerHTML)}</body>`, 'text/html').body);
    const title = $('title').value.trim() || firstLine();
    const out = {
      docx: () => F.toDocx(blocks, title),
      odt: () => F.toOdt(blocks, title),
      txt: () => new Blob([F.toText(blocks)], { type: 'text/plain;charset=utf-8' }),
      html: () => new Blob([F.toHtmlFile(blocks, title)], { type: 'text/html;charset=utf-8' }),
    }[fmt]();
    download(out, fileName(fmt));
    toast(`Saved a copy as ${fileName(fmt)} (in your Downloads folder)`);
  }
  async function importFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      let blocks;
      if (ext === 'docx') blocks = await F.fromDocx(await file.arrayBuffer());
      else if (ext === 'odt') blocks = await F.fromOdt(await file.arrayBuffer());
      else if (ext === 'html' || ext === 'htm') blocks = F.fromHtmlFile(await file.text());
      else if (ext === 'txt' || ext === 'md') blocks = F.fromText(await file.text());
      else throw new Error('Writer opens .docx, .odt, .txt and .html files.');
      await newDoc(F.blocksToHtml(blocks), file.name.replace(/\.[^.]+$/, ''));
      toast(`Opened ${file.name} as a new document`);
    } catch (e) { toast(e.message, true); }
  }

  // ---------------------------------------------------------------- wiring
  function boot(user) {
    $('who').textContent = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username;
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch {}
    page.addEventListener('input', markDirty);
    page.addEventListener('paste', e => {
      const html = e.clipboardData.getData('text/html'), text = e.clipboardData.getData('text/plain');
      e.preventDefault();
      if (html) document.execCommand('insertHTML', false, F.sanitize(html));
      else document.execCommand('insertText', false, text);
    });
    page.addEventListener('drop', e => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { e.preventDefault(); importFile(f); }
    });
    document.addEventListener('selectionchange', syncToolbar);
    document.querySelectorAll('.toolbar [data-cmd]').forEach(b => b.onmousedown = e => { e.preventDefault(); cmd(b.dataset.cmd); });
    $('block').onchange = () => cmd('formatBlock', $('block').value);
    $('title').oninput = () => { dirty = true; setSaved('Editing…'); scheduleSave(); };
    $('newDoc').onclick = () => newDoc();
    $('search').oninput = renderList;
    $('importFile').onchange = e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; };
    $('exportBtn').onclick = e => { e.stopPropagation(); $('exportMenu').hidden = !$('exportMenu').hidden; };
    document.addEventListener('click', () => $('exportMenu').hidden = true);
    $('exportMenu').querySelectorAll('button').forEach(b => b.onclick = () => exportAs(b.dataset.fmt));
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); dirty = true; saveNow().then(() => toast('Saved')); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); exportAs('pdf'); }
    });
    window.addEventListener('beforeunload', () => { if (dirty) saveNow({ keepalive: true }); });
    loadList().then(() => docs.length ? openDoc(+docs[0].id) : newDoc()).catch(e => { $('banner').textContent = e.message; $('banner').hidden = false; });
  }

  if (!window.IPAuth) { $('banner').innerHTML = 'Sign-in system not found: <code>../auth/auth-client.js</code> must exist.'; $('banner').hidden = false; }
  else if (IPAuth.user) boot(IPAuth.user);
  else document.addEventListener('ipauth:ready', e => boot(e.detail), { once: true });
})();
