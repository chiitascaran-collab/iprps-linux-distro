// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let last = null, editing = false, errTimer = null;
  const showErr = m => { $('err').textContent = m || ''; clearTimeout(errTimer); if (m) errTimer = setTimeout(() => { $('err').textContent = ''; }, 8000); };
  async function post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-IPRPS-Link': '1' }, body: JSON.stringify(body || {}) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error || 'That did not work'); return j;
  }
  const mb = n => n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : (n / 1e6).toFixed(1) + ' MB';
  const TITLES = { off: 'Remote play is off', connecting: 'Connecting…', online: 'Remote play is on', error: 'Can\'t connect yet' };

  function draw(s) {
    last = s;
    $('power').className = 'card ' + s.status;
    $('status-title').textContent = TITLES[s.status] || s.status;
    const ready = s.user && s.relay;
    $('status-text').textContent = s.status === 'error' ? s.error + ' Trying again by itself.'
      : s.status === 'online' ? 'Remote players reach your IPRPS Table through your relay. Your console stays on this computer only.'
      : ready ? 'Turn it on when you want remote players at the table.' : 'Finish steps 1 and 2 below first.';
    const t = $('toggle'); t.textContent = s.enabled ? 'Turn off' : 'Turn on'; t.className = 'big' + (s.enabled ? ' on' : ''); t.disabled = !s.enabled && !ready;
    $('share').hidden = s.status !== 'online';
    if (s.status === 'online' && $('url').value !== s.url) {
      $('url').value = s.url;
      if (window.IPQR) try { $('qr').src = 'data:image/svg+xml,' + encodeURIComponent(window.IPQR.svg(s.url, { size: 180 })); $('qr').hidden = false; } catch { $('qr').hidden = true; } else $('qr').hidden = true;
    }
    $('counts').textContent = `${s.remotePlayers} remote device${s.remotePlayers === 1 ? '' : 's'} in the last minute · ${s.requests} requests · ${mb(s.bytesOut)} sent`;
    $('signed-in').hidden = !s.user; $('signed-out').hidden = !!s.user;
    if (s.user) $('who').textContent = s.user.username || s.user.email || 'your account';
    if (!editing) { $('relay').value = s.relay || ''; $('auth').value = s.auth || ''; }
    $('relay-info').textContent = s.status === 'online' ? `Connected to a ${s.relayKind === 'php' ? 'web-hosting (PHP)' : 'Node.js'} relay.${s.burst ? ' This host holds responses back, so chat arrives about half a second later.' : ''}${s.separateAddresses ? '' : ' Remote players all show the same address in the Table console.'}` : '';
    const log = $('log'); log.replaceChildren(...s.log.slice().reverse().map(l => { const li = document.createElement('li'), tm = document.createElement('time'); tm.textContent = new Date(l.t).toLocaleTimeString(); li.append(tm, l.msg); return li; }));
    if (!s.log.length) { const li = document.createElement('li'); li.className = 'muted'; li.textContent = 'Nothing yet.'; log.append(li); }
  }
  async function refresh() { try { draw(await (await fetch('/api/state', { cache: 'no-store' })).json()); } catch { showErr('IPRPS Link is not answering. Is the service running?'); } }

  $('toggle').onclick = async () => { try { draw(await post('/api/enable', { on: !last.enabled })); } catch (e) { showErr(e.message); } };
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText($('url').value); } catch { $('url').select(); document.execCommand('copy'); } $('copy').textContent = 'Copied'; setTimeout(() => { $('copy').textContent = 'Copy'; }, 1500); };
  $('save').onclick = async () => { try { editing = false; draw(await post('/api/settings', { relay: $('relay').value, auth: $('auth').value })); } catch (e) { showErr(e.message); } };
  for (const id of ['relay', 'auth']) { $(id).oninput = () => { editing = true; }; $(id).onkeydown = e => { if (e.key === 'Enter') $('save').click(); }; }
  $('signout').onclick = async () => { try { draw(await post('/api/signout')); } catch (e) { showErr(e.message); } };
  $('use-token').onclick = async () => { try { draw(await post('/api/token', { token: $('token').value })); $('token').value = ''; } catch (e) { showErr(e.message); } };

  // Coming back from the Infinite Plane sign-in page: it hands the session over in the address fragment.
  (async () => {
    if (location.pathname === '/auth/callback') {
      const f = new URLSearchParams(location.hash.slice(1));
      history.replaceState(null, '', '/');
      if (f.get('token')) { try { draw(await post('/api/token', { token: f.get('token'), state: f.get('state') || '' })); } catch (e) { showErr(e.message); } }
      else showErr('The sign-in was cancelled.');
    }
    await refresh();
    setInterval(refresh, 3000);
  })();
})();
