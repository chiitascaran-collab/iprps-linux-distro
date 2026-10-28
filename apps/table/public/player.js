// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Table - player page.
(() => {
  'use strict';
  const { $, h } = T;
  const ctx = { me: null };
  let roster = [], me = null, stream = null, wantAudio = null;
  const feed = T.feed($('feed'), ctx);

  const dice = T.diceBar($('dice'), {
    vis: [['all', 'Everyone sees'], ['sm', 'Only the SM sees'], ['self', 'Only I see']],
    onRoll: body => T.api('/api/p/roll', body),
  });
  const comp = T.composer($('composer'), {
    accept: 'image/png,image/jpeg,image/gif,image/webp,audio/*', uploadPath: '/api/p/upload', sendPath: '/api/p/send',
    target: v => (v.startsWith('p:') ? { type: 'player', id: v.slice(2) } : { type: v }),
  });

  // ---------------------------------------------------------------- roster
  function renderRoster() {
    const ul = $('roster'); ul.textContent = '';
    const on = roster.filter(p => p.online).length;
    $('count').textContent = `${on}`;
    for (const p of [...roster].sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name))) {
      const name = h('b', { text: p.name }); name.style.color = p.color;
      ul.append(h('li', { class: p.online ? 'on' : 'off' }, h('span', { class: 'dot', title: p.online ? 'Online' : 'Away' }),
        h('span', { class: 'pn' }, name, p.character ? h('small', { text: p.character }) : null, p.id === ctx.me ? h('small', { class: 'you', text: '(you)' }) : null),
        p.id !== ctx.me ? h('button', { class: 'ghost small', text: 'Message', onclick: () => { comp.target = 'p:' + p.id; comp.focus(); $('side').classList.remove('open'); } }) : null));
    }
    const others = roster.filter(p => p.id !== ctx.me).sort((a, b) => a.name.localeCompare(b.name));
    comp.setTargets([['all', 'Everyone'], ['players', 'Players only'], ['sm', 'Session Master (private)'],
      ...others.map(p => ['p:' + p.id, `${p.name}${p.online ? '' : ' (away)'}`, 'Private to a player'])]);
  }
  function renderMe() {
    me = roster.find(p => p.id === ctx.me) || me;
    if (me) $('meBtn').textContent = me.character ? `${me.name} · ${me.character}` : me.name;
  }

  // ---------------------------------------------------------------- stage (pushed by the SM)
  function showStage(item) {
    const body = $('stageBody'); body.textContent = '';
    if (!item) { $('stage').hidden = true; $('stageShow').hidden = true; return; }
    $('stageTitle').textContent = item.title || 'From the Session Master';
    if (item.kind === 'image') body.append(h('img', { src: T.mediaUrl(item.media), alt: item.title || item.name, onclick: e => T.lightbox(e.target.src) }));
    else if (item.kind === 'video') {
      const v = h('video', { src: T.mediaUrl(item.media), controls: true, playsinline: true, autoplay: true });
      body.append(v);
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); needSound(() => { v.muted = false; return v.play(); }); });
    } else body.append(h('div', { class: 'stagetext', text: item.text || '' }));
    $('stage').hidden = false; $('stageShow').hidden = true;
  }
  $('stageMin').onclick = () => { $('stage').hidden = true; $('stageShow').hidden = false; const v = $('stageBody').querySelector('video'); if (v) v.pause(); };
  $('stageShow').onclick = () => { $('stage').hidden = false; $('stageShow').hidden = true; };

  // ---------------------------------------------------------------- table sound (needs one tap on phones)
  const bgm = $('bgm');
  let pendingSound = null;
  function needSound(fn) { pendingSound = fn; $('soundBtn').hidden = false; }
  $('soundBtn').onclick = () => {
    const fn = pendingSound; pendingSound = null; $('soundBtn').hidden = true;
    if (fn) Promise.resolve(fn()).catch(() => needSound(fn));
  };
  function playAudio(item) {
    wantAudio = item;
    if (!item) { bgm.pause(); bgm.removeAttribute('src'); bgm.load(); if (pendingSound) { pendingSound = null; $('soundBtn').hidden = true; } return; }
    bgm.src = T.mediaUrl(item.media); bgm.loop = !!item.loop; bgm.volume = item.volume ?? 0.8;
    const start = () => bgm.play();
    start().catch(() => needSound(start));
  }

  // ---------------------------------------------------------------- connection
  function connect() {
    stream = T.connect('/api/p/events', {
      status: ok => $('conn').classList.toggle('ok', ok),
      hello: s => {
        ctx.me = s.me.id; me = s.me; roster = s.roster;
        $('campaign').textContent = s.table.name; document.title = `${s.table.name} · IPRPS Table`;
        feed.clear(); s.messages.forEach(feed.add);
        dice.setPresets(s.presets);
        renderRoster(); renderMe();
        showStage(s.stage);
        if (JSON.stringify(s.audio) !== JSON.stringify(wantAudio)) playAudio(s.audio);
        $('overlay').hidden = true;
      },
      msg: m => feed.add(m),
      roster: r => { roster = r; renderRoster(); renderMe(); },
      stage: showStage,
      audio: playAudio,
      table: t => { $('campaign').textContent = t.name; },
      presets: p => dice.setPresets(p),
      closed: e => stop('The table is closed', e.message, true),
      kicked: e => stop('You left the table', e.message, false),
      reset: e => stop('New session', e.message, false),
      left: () => location.replace('/'),
      gone: () => setTimeout(recheck, 1500),
    });
  }
  function stop(title, text, waitForOpen) {
    if (stream) stream.close();
    playAudio(null);
    $('ovTitle').textContent = title; $('ovText').textContent = text + (waitForOpen ? ' This page reconnects when it opens again.' : '');
    $('overlay').hidden = false;
    if (waitForOpen) setTimeout(recheck, 4000);
  }
  async function recheck() {
    try {
      const r = await fetch('/api/info', { cache: 'no-store' }).then(x => x.json());
      if (r.open && r.joined) { if (!stream || !stream.alive) { if (stream) stream.close(); connect(); } return; }
      if (r.open && !r.joined) { location.replace('/'); return; }
      stop('The table is closed', 'The Session Master closed the table.', true);
    } catch { setTimeout(recheck, 4000); }
  }
  $('ovBtn').onclick = () => location.replace('/');

  // ---------------------------------------------------------------- header buttons
  $('playersBtn').onclick = () => $('side').classList.toggle('open');
  $('sideClose').onclick = () => $('side').classList.remove('open');
  $('meBtn').onclick = async () => {
    const c = prompt('Your character name:', (me && me.character) || '');
    if (c === null) return;
    try { await T.api('/api/p/profile', { character: c }); } catch (e) { T.toast(e.message, true); }
  };
  $('leaveBtn').onclick = async () => {
    if (!confirm('Leave the table? You can join again with the code.')) return;
    try { await T.api('/api/p/leave'); } catch {}
    location.replace('/');
  };
  connect();
})();
