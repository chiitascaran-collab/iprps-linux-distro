// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
(() => {
  'use strict';
  const { $ } = T;
  const q = new URLSearchParams(location.search);
  if (q.get('code')) $('code').value = q.get('code').toUpperCase();
  $('name').value = T.store.get('name', '');
  $('character').value = T.store.get('character', '');
  let timer = null;

  async function check() {
    clearTimeout(timer);
    try {
      const r = await fetch('/api/info', { cache: 'no-store' }).then(r => r.json());
      if (r.joined) { location.replace('/play'); return; }
      if (r.open) {
        $('state').textContent = r.locked ? `${r.name}: the table is locked. Players already here can rejoin with their name.` : `Join “${r.name}”`;
        $('join').hidden = false;
        (($('code').value ? $('name').value ? null : $('name') : $('code')) || $('character')).focus();
        return;
      }
      $('state').textContent = 'No table is open yet. When the Session Master opens one, this page will show the sign-in.';
    } catch { $('state').textContent = 'Can\'t reach the table computer. Check that you are on the same Wi-Fi network.'; }
    $('join').hidden = true;
    timer = setTimeout(check, 4000);
  }

  $('join').onsubmit = async e => {
    e.preventDefault();
    $('err').textContent = '';
    const body = { code: $('code').value.trim(), name: $('name').value.trim(), character: $('character').value.trim() };
    T.store.set('name', body.name); T.store.set('character', body.character);
    try { await T.api('/api/join', body); location.replace('/play'); }
    catch (x) { $('err').textContent = x.message; }
  };
  check();
})();
