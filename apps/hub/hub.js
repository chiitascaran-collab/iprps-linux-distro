// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Session Master Hub - app launcher and app manager.
(() => {
  const $ = id => document.getElementById(id);
  let apps = [], missing = [];

  async function api(action, body) {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const r = await fetch(`api.php?action=${action}`, opt);
    let j; try { j = await r.json(); } catch { throw new Error(`Server error (HTTP ${r.status})`); }
    if (!j.ok) throw new Error(j.error || 'Request failed');
    return j;
  }
  function toast(m, bad) {
    const t = $('toast'); t.textContent = m; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 3000);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => (n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || '?');

  function iconHTML(a, cls) {
    return `<span class="${cls}"><img src="api.php?action=icon&app=${encodeURIComponent(a.folder)}" alt=""
      onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'${esc(initials(a.name))}'}))"></span>`;
  }

  // ---------------------------------------------------------------- the Hub grid
  function renderGrid() {
    const q = $('filter').value.trim().toLowerCase();
    const shown = apps.filter(a => a.enabled && (!q || (a.name + ' ' + a.folder + ' ' + a.description).toLowerCase().includes(q)));
    $('grid').innerHTML = shown.map(a => `
      <a class="tile" href="../${encodeURIComponent(a.folder)}/" target="_blank" rel="noopener" data-folder="${esc(a.folder)}">
        ${iconHTML(a, 'icon')}
        <span class="name">${esc(a.name)}</span>
        ${a.description ? `<span class="desc">${esc(a.description)}</span>` : ''}
      </a>`).join('');
    $('empty').hidden = shown.length > 0 || !!q;
  }

  // ---------------------------------------------------------------- Manage apps
  function renderList() {
    const q = $('dlgFilter').value.trim().toLowerCase();
    $('list').innerHTML = apps.map((a, i) => {
      const hide = q && !(a.name + ' ' + a.folder).toLowerCase().includes(q);
      return `<li ${hide ? 'hidden' : ''}>
        <label>
          ${iconHTML(a, 'licon')}
          <span class="ltext"><b>${esc(a.name)}</b> ${a.default ? '<span class="tag">Default</span>' : ''}
            <small>${esc(a.folder)}${a.description ? ' — ' + esc(a.description) : ''}</small></span>
          <input type="checkbox" class="switch" data-i="${i}" ${a.enabled ? 'checked' : ''}>
        </label></li>`;
    }).join('');
    $('list').querySelectorAll('input').forEach(cb => cb.onchange = () => { apps[+cb.dataset.i].enabled = cb.checked; count(); });
    count();
    $('missing').hidden = !missing.length;
    $('missing').textContent = missing.length ? `Default apps not installed on this computer: ${missing.join(', ')}.` : '';
  }
  function count() { $('count').textContent = `${apps.filter(a => a.enabled).length} of ${apps.length} on`; }

  let snapshot = null;
  function openDlg() { snapshot = apps.map(a => a.enabled); $('dlgFilter').value = ''; renderList(); $('dlg').hidden = false; $('dlgFilter').focus(); }
  function closeDlg(restore) { if (restore && snapshot) apps.forEach((a, i) => a.enabled = snapshot[i]); $('dlg').hidden = true; renderGrid(); }

  async function load() {
    const j = await api('apps');
    apps = j.apps; missing = j.missing_defaults;
    renderGrid();
    if (!apps.length) $('empty').textContent = 'No apps are installed in /srv/www/iprps yet.';
  }

  function boot(user) {
    $('who').textContent = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username;
    $('greeting').textContent = `Welcome, ${user.first_name || user.username}.`;
    $('logout').onclick = () => IPAuth.logout();
    $('filter').oninput = renderGrid;
    $('manage').onclick = openDlg;
    $('dlgFilter').oninput = renderList;
    $('allOn').onclick = () => { apps.forEach(a => a.enabled = true); renderList(); };
    $('allOff').onclick = () => { apps.forEach(a => a.enabled = false); renderList(); };
    $('reset').onclick = async () => {
      if (!confirm('Go back to the default apps?')) return;
      try { await api('reset', {}); await load(); renderList(); toast('Back to the default apps'); } catch (e) { toast(e.message, true); }
    };
    $('cancel').onclick = () => closeDlg(true);
    $('save').onclick = async () => {
      try {
        const j = await api('save', { enabled: apps.filter(a => a.enabled).map(a => a.folder) });
        closeDlg(false); toast(`Saved: ${j.enabled} apps on your Hub`);
      } catch (e) { toast(e.message, true); }
    };
    $('dlg').onclick = e => { if (e.target === $('dlg')) closeDlg(true); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('dlg').hidden) closeDlg(true); });
    load().catch(e => { $('banner').textContent = e.message; $('banner').hidden = false; });
  }

  if (!window.IPAuth) {
    $('banner').innerHTML = 'Sign-in system not found: <code>../auth/auth-client.js</code> must exist (<code>/srv/www/iprps/auth/</code>).';
    $('banner').hidden = false;
  } else if (IPAuth.user) boot(IPAuth.user);
  else document.addEventListener('ipauth:ready', e => boot(e.detail), { once: true });
})();
