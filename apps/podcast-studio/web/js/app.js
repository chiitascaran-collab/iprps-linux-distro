// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Podcast Studio — app shell: show library, show settings, episodes, export, publishing, backups.
import { $, h, api, upload, toast, fail, modal, confirmBox, promptBox, fmtTime, fmtSize, fmtDate, debounce, copyText, inp, field } from './util.js';
import { studioView } from './studio.js';
import { editorView } from './editor.js';

const CATEGORIES = {
  'Arts': ['Books', 'Design', 'Fashion & Beauty', 'Food', 'Performing Arts', 'Visual Arts'],
  'Business': ['Careers', 'Entrepreneurship', 'Investing', 'Management', 'Marketing', 'Non-Profit'],
  'Comedy': ['Comedy Interviews', 'Improv', 'Stand-Up'],
  'Education': ['Courses', 'How To', 'Language Learning', 'Self-Improvement'],
  'Fiction': ['Comedy Fiction', 'Drama', 'Science Fiction'],
  'Government': [], 'History': [],
  'Health & Fitness': ['Alternative Health', 'Fitness', 'Medicine', 'Mental Health', 'Nutrition', 'Sexuality'],
  'Kids & Family': ['Education for Kids', 'Parenting', 'Pets & Animals', 'Stories for Kids'],
  'Leisure': ['Animation & Manga', 'Automotive', 'Aviation', 'Crafts', 'Games', 'Hobbies', 'Home & Garden', 'Video Games'],
  'Music': ['Music Commentary', 'Music History', 'Music Interviews'],
  'News': ['Business News', 'Daily News', 'Entertainment News', 'News Commentary', 'Politics', 'Sports News', 'Tech News'],
  'Religion & Spirituality': ['Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Judaism', 'Religion', 'Spirituality'],
  'Science': ['Astronomy', 'Chemistry', 'Earth Sciences', 'Life Sciences', 'Mathematics', 'Natural Sciences', 'Nature', 'Physics', 'Social Sciences'],
  'Society & Culture': ['Documentary', 'Personal Journals', 'Philosophy', 'Places & Travel', 'Relationships'],
  'Sports': ['Baseball', 'Basketball', 'Cricket', 'Fantasy Sports', 'Football', 'Golf', 'Hockey', 'Rugby', 'Running', 'Soccer', 'Swimming', 'Tennis', 'Volleyball', 'Wilderness', 'Wrestling'],
  'Technology': [], 'True Crime': [],
  'TV & Film': ['After Shows', 'Film History', 'Film Interviews', 'Film Reviews', 'TV Reviews'],
};
const LANGS = [['en', 'English'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['pl', 'Polish'], ['sv', 'Swedish'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['tl', 'Filipino']];
const PAD_COLORS = ['#7c5cff', '#ff4d5e', '#ffb347', '#3ddc97', '#4db8ff', '#ff7ad9'];

const view = $('#view'), crumbs = $('#crumbs');
let current = null, app = null;
const assetUrl = (show, id) => { const a = show.assets.find(x => x.id === id); return a ? `/files/${show.id}/assets/${a.file}` : ''; };
const go = hash => { location.hash = hash; };

async function route() {
  if (current && current.busy && current.busy() && !(await confirmBox('Recording in progress', 'Leaving the studio stops the recording and saves what has been recorded so far.', 'Stop and leave'))) { history.replaceState(null, '', current.hash); return; }
  if (current && current.destroy) { try { await current.destroy(); } catch (e) { console.error(e); } }
  current = null;
  document.documentElement.style.removeProperty('--brand'); document.documentElement.style.removeProperty('--accent');
  const hash = location.hash || '#/';
  const p = hash.slice(2).split('/');
  try {
    if (!app) { app = await api('GET', '/api/state'); $('#sysflag').replaceChildren(app.ffmpeg ? '' : h('span', { class: 'pill warn', title: 'Install ffmpeg to get waveforms and exports' }, 'ffmpeg missing')); }
    let v;
    if (p[0] === 'settings') v = await settingsView();
    else if (p[0] === 'show' && p[2] === 'ep') v = await episodeView(p[1], p[3], p[4] || 'details');
    else if (p[0] === 'show') v = await showView(p[1], p[2] || 'episodes');
    else v = await libraryView();
    v.hash = hash; current = v;
    view.replaceChildren(v.el); window.scrollTo(0, 0);
  } catch (e) { crumbs.replaceChildren(); view.replaceChildren(h('div', { class: 'card lobby' }, h('h2', {}, 'Something went wrong'), h('p', {}, e.message), h('a', { class: 'btn', href: '#/' }, 'Back to your shows'))); }
}
window.addEventListener('hashchange', route);
route();

function setCrumbs(...items) { crumbs.replaceChildren(...items.flatMap((it, i) => [i ? h('span', { class: 'sep' }, '›') : null, it.href ? h('a', { href: it.href }, it.label) : h('span', {}, it.label)])); }
function brandVars(show) { const s = document.documentElement.style; s.setProperty('--brand', show.brand.primary || '#7c5cff'); s.setProperty('--accent', show.brand.accent || '#ffb347'); }
function tabsBar(tabs, active, hrefOf) { return h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => h('a', { href: hrefOf(k), class: k === active ? 'on' : '', role: 'tab', 'aria-selected': k === active }, l))); }
function pickFile(accept, cb) { const i = h('input', { type: 'file', accept, onchange: () => i.files[0] && cb(i.files[0]) }); i.click(); }

// ================================================================= library
async function libraryView() {
  setCrumbs();
  const shows = await api('GET', '/api/shows');
  let showArchived = false;
  const grid = h('div', { class: 'grid' });
  const draw = () => {
    const list = shows.filter(s => !!s.archived === showArchived);
    grid.replaceChildren(...list.map(s => h('a', { class: 'show-card', href: `#/show/${s.id}` },
      s.coverAsset ? h('img', { src: assetUrl(s, s.coverAsset), alt: '' }) : h('div', { class: 'cover-ph', style: { background: s.brand.primary } }, s.title.slice(0, 1).toUpperCase()),
      h('div', {}, h('b', {}, s.title), h('small', {}, `${s.episodeCount} episode${s.episodeCount === 1 ? '' : 's'} · updated ${fmtDate(s.updatedAt)}`)))),
      list.length ? null : h('div', { class: 'empty' }, showArchived ? 'No archived shows.' : h('div', {}, h('h2', {}, 'Start your first show'), h('p', { class: 'muted' }, 'A show holds your branding, cast, soundboard and episodes. Create one, then record in the studio.'), h('button', { class: 'btn primary big', onclick: create }, 'Create a show'))));
  };
  const create = async () => { const title = await promptBox('New show', '', 'Show title'); if (title) { try { const s = await api('POST', '/api/shows', { title }); go(`#/show/${s.id}/details`); } catch (e) { fail(e); } } };
  draw();
  const arch = h('button', { class: 'btn ghost', onclick: () => { showArchived = !showArchived; arch.textContent = showArchived ? 'Show active' : 'Show archived'; draw(); } }, 'Show archived');
  return { el: h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', {}, 'Your shows'), h('span', { class: 'grow' }), arch,
    h('button', { class: 'btn', onclick: () => pickFile('.gz,.tgz,application/gzip', async f => { toast('Restoring backup…'); try { const s = await upload('/api/restore', f); toast(`Restored “${s.title}”`, 'ok'); go(`#/show/${s.id}`); } catch (e) { fail(e); } }) }, 'Restore from backup'),
    h('button', { class: 'btn primary', id: 'new-show', onclick: create }, 'New show')), grid) };
}

// ================================================================= show
async function showView(sid, tab) {
  const show = await api('GET', `/api/shows/${sid}`);
  brandVars(show);
  setCrumbs({ label: 'Shows', href: '#/' }, { label: show.title });
  const status = h('span', { class: 'muted small' }, '');
  const save = debounce(async () => { try { const s = await api('PUT', `/api/shows/${sid}`, show); show.updatedAt = s.updatedAt; s.cast.forEach((c, i) => { if (show.cast[i]) { show.cast[i].id = c.id; if (c.inviteToken) show.cast[i].inviteToken = c.inviteToken; } }); status.textContent = 'Saved'; brandVars(show); } catch (e) { fail(e); } }, 500);
  const ch = () => { status.textContent = 'Saving…'; save(); };
  const body = h('div', { class: 'tab-body' });
  const tabs = [['episodes', 'Episodes'], ['details', 'Show details'], ['brand', 'Brand'], ['cast', 'Cast & AI'], ['soundboard', 'Soundboard'], ['publish', 'Publish'], ['backup', 'Backup & archive']];
  const panes = { episodes: () => episodesPane(show), details: () => detailsPane(show, ch), brand: () => brandPane(show, ch), cast: () => castPane(show, ch), soundboard: () => padsPane(show, ch), publish: () => publishPane(show, ch, save), backup: () => backupPane(show, ch) };
  body.append(await (panes[tab] || panes.episodes)());
  const el = h('div', { class: 'page' },
    h('div', { class: 'show-head' }, show.coverAsset ? h('img', { src: assetUrl(show, show.coverAsset), alt: '' }) : h('div', { class: 'cover-ph', style: { background: show.brand.primary } }, show.title.slice(0, 1).toUpperCase()),
      h('div', {}, h('h1', {}, show.title, show.archived ? h('span', { class: 'pill' }, 'Archived') : null), h('p', { class: 'muted' }, show.brand.tagline || show.subtitle || show.description.slice(0, 140) || 'Add a description under Show details.')), h('span', { class: 'grow' }), status),
    tabsBar(tabs, tab, k => `#/show/${sid}/${k}`), body);
  return { el, destroy: () => save.flush() };
}

async function episodesPane(show) {
  const eps = await api('GET', `/api/shows/${show.id}/episodes`);
  const create = async () => { const title = await promptBox('New episode', '', 'Episode title'); if (title) { try { const e = await api('POST', `/api/shows/${show.id}/episodes`, { title }); go(`#/show/${show.id}/ep/${e.id}/studio`); } catch (x) { fail(x); } } };
  const label = { draft: 'Draft', recorded: 'Recorded', edited: 'Edited' };
  return h('div', {}, h('div', { class: 'row' }, h('h2', {}, 'Episodes'), h('span', { class: 'grow' }), h('button', { class: 'btn primary', id: 'new-episode', onclick: create }, 'New episode')),
    eps.length ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['#', 'Title', 'Status', 'Published', ''].map(x => h('th', {}, x)))),
      h('tbody', {}, eps.map(e => h('tr', {},
        h('td', {}, `S${e.season || 1} · E${e.number || 1}`), h('td', {}, h('a', { href: `#/show/${show.id}/ep/${e.id}/details` }, e.title)),
        h('td', {}, h('span', { class: 'pill ' + (e.published ? 'live' : '') }, e.published ? 'Published' : label[e.status] || 'Draft')), h('td', {}, e.published ? fmtDate(e.pubDate) : '—'),
        h('td', { class: 'right' }, h('a', { class: 'btn small', href: `#/show/${show.id}/ep/${e.id}/studio` }, 'Studio'), h('a', { class: 'btn small', href: `#/show/${show.id}/ep/${e.id}/editor` }, 'Edit'),
          h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox('Delete episode?', `“${e.title}”, its recordings and exports will be permanently deleted. Back the show up first if you might want it later.`, 'Delete episode')) { await api('DELETE', `/api/shows/${show.id}/episodes/${e.id}`).catch(fail); route(); } } }, 'Delete'))))))
      : h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'No episodes yet.'), h('button', { class: 'btn primary', onclick: create }, 'Create the first episode')));
}

function detailsPane(show, ch) {
  const subSel = h('span', {});
  const drawSub = () => subSel.replaceChildren(inp(show, 'subcategory', { type: 'select', opts: [['', '— none —'], ...(CATEGORIES[show.category] || [])], onchange: ch }));
  drawSub();
  return h('div', { class: 'form two' },
    h('section', {}, h('h2', {}, 'About the show'),
      field('Title', inp(show, 'title', { onchange: ch })), field('Subtitle', inp(show, 'subtitle', { onchange: ch })),
      field('Description', inp(show, 'description', { type: 'textarea', rows: 6, onchange: ch }), 'Shown in every podcast app. Up to 4,000 characters.'),
      field('Author / host name', inp(show, 'author', { onchange: ch })), field('Website', inp(show, 'website', { placeholder: 'https://', onchange: ch })),
      field('Copyright', inp(show, 'copyright', { placeholder: '© 2026 Your Name', onchange: ch }))),
    h('section', {}, h('h2', {}, 'Directory listing'),
      field('Owner name', inp(show, 'ownerName', { onchange: ch })), field('Owner email', inp(show, 'ownerEmail', { type: 'email', onchange: ch }), 'Published in the feed. Spotify, Amazon and others email a verification code here.'),
      field('Language', inp(show, 'language', { type: 'select', opts: LANGS, onchange: ch })),
      field('Category', inp(show, 'category', { type: 'select', opts: Object.keys(CATEGORIES), onchange: () => { show.subcategory = ''; drawSub(); ch(); } })), h('label', { class: 'field' }, h('span', {}, 'Subcategory'), subSel),
      field('Show type', inp(show, 'showType', { type: 'select', opts: [['episodic', 'Episodic — newest first'], ['serial', 'Serial — listen in order']], onchange: ch })),
      field('Contains explicit content', inp(show, 'explicit', { type: 'checkbox', onchange: ch }))));
}

function uploader(show, role, label, accept, ch, after) {
  const box = h('div', { class: 'uploader' });
  const draw = () => {
    const a = show.assets.find(x => x.id === show[role]);
    box.replaceChildren(h('b', {}, label),
      a ? (a.kind === 'image' ? h('img', { src: `/files/${show.id}/assets/${a.file}`, alt: label }) : h('audio', { controls: true, src: `/files/${show.id}/assets/${a.file}` })) : h('div', { class: 'ph' }, 'None yet'),
      a ? h('small', {}, a.kind === 'image' ? `${a.width}×${a.height} · ${fmtSize(a.size)}` : `${fmtTime(a.duration)} · ${a.name}`) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => pickFile(accept, async f => { try { const r = await upload(`/api/shows/${show.id}/assets?role=${role}&name=${encodeURIComponent(f.name)}`, f); show.assets = r.show.assets; show[role] = r.asset.id; draw(); after && after(); } catch (e) { fail(e); } }) }, a ? 'Replace' : 'Upload'),
        a ? h('button', { class: 'btn small ghost', onclick: () => { show[role] = ''; ch(); draw(); } }, 'Remove') : null));
  };
  draw(); return box;
}

function brandPane(show, ch) {
  const b = show.brand;
  const sample = h('div', { class: 'brand-sample' });
  const draw = () => { sample.style.background = b.bg; sample.style.color = b.text; sample.replaceChildren(h('div', { class: 'bs-tile' }, h('span', { style: { background: b.primary } }, show.cast[0] ? show.cast[0].name : 'Host')), h('div', {}, h('b', {}, show.title), h('div', { style: { color: b.accent } }, b.tagline || 'Your tagline'), h('button', { style: { background: b.primary } }, 'Listen'))); };
  const c = () => { draw(); ch(); };
  draw();
  return h('div', { class: 'form two' },
    h('section', {}, h('h2', {}, 'Artwork'),
      h('div', { class: 'row top wrap' }, uploader(show, 'coverAsset', 'Cover art', 'image/png,image/jpeg', ch), uploader(show, 'logoAsset', 'Logo / watermark', 'image/png,image/jpeg,image/webp', ch)),
      h('p', { class: 'muted small' }, 'Cover art must be square, 1400–3000 px, JPEG or PNG — the directories reject anything else. The logo is placed in the corner of video exports.'),
      h('h2', {}, 'Signature audio'), h('div', { class: 'row top wrap' }, uploader(show, 'introAsset', 'Intro', 'audio/*', ch), uploader(show, 'outroAsset', 'Outro', 'audio/*', ch)),
      h('p', { class: 'muted small' }, 'Add them to any episode from the editor with “Intro / outro”.')),
    h('section', {}, h('h2', {}, 'Colors and voice'),
      h('div', { class: 'row wrap' }, field('Primary', inp(b, 'primary', { type: 'color', onchange: c })), field('Accent', inp(b, 'accent', { type: 'color', onchange: c })), field('Background', inp(b, 'bg', { type: 'color', onchange: c })), field('Text', inp(b, 'text', { type: 'color', onchange: c }))),
      field('Tagline', inp(b, 'tagline', { onchange: c })), sample,
      field('Name lower-thirds on video', inp(b, 'lowerThirds', { type: 'checkbox', onchange: ch })), field('Logo watermark on video', inp(b, 'watermark', { type: 'checkbox', onchange: ch })),
      field('Show-notes footer', inp(b, 'footer', { type: 'textarea', rows: 3, placeholder: 'Links, credits, how to support the show…', onchange: ch }), 'Appended to every episode\'s notes in the feed.'),
      h('p', { class: 'muted small' }, 'These colors style this show\'s pages here, the guest join page, video and audiogram exports, and the public landing page.')));
}

function castPane(show, ch) {
  const list = h('div', { class: 'cast' });
  const roleOpts = [['host', 'Host'], ['cohost', 'Co-host'], ['guest', 'Guest']];
  const draw = () => list.replaceChildren(...show.cast.map((c, i) => {
    const ai = c.kind === 'ai';
    if (ai) { c.ai = c.ai || {}; c.ai.brain = c.ai.brain || { provider: 'gemini', model: '' }; c.ai.voice = c.ai.voice || { provider: 'gemini', voiceId: 'Kore', style: '' }; }
    const card = h('div', { class: 'cast-card' + (ai ? ' ai' : '') },
      h('div', { class: 'row wrap' }, h('span', { class: 'pill' }, ai ? 'AI' : 'Person'), field('Name', inp(c, 'name', { onchange: ch })),
        field('Role', inp(c, 'role', { type: 'select', opts: ai ? roleOpts.slice(1) : roleOpts, onchange: ch })), h('span', { class: 'grow' }),
        c.role === 'host' && !ai ? null : h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox('Remove from cast?', `${c.name} will be removed from the show. Their invite link stops working.`, 'Remove')) { show.cast.splice(i, 1); ch(); draw(); } } }, 'Remove')));
    if (ai) card.append(aiEditor(c, ch));
    else if (c.role !== 'host') card.append(h('p', { class: 'muted small' }, 'Joins from their own browser using a personal invite link — get it in any episode\'s Studio, under Guests.'));
    return card;
  }));
  draw();
  const add = (kind, role, name) => { show.cast.push({ name, role, kind }); ch(); draw(); };
  return h('div', {}, h('div', { class: 'row' }, h('h2', {}, 'Cast'), h('span', { class: 'grow' }),
    h('button', { class: 'btn', onclick: () => add('human', 'cohost', 'Co-host') }, '+ Co-host'), h('button', { class: 'btn', onclick: () => add('human', 'guest', 'Guest') }, '+ Guest'),
    h('button', { class: 'btn primary', id: 'add-ai', onclick: () => add('ai', 'cohost', 'Nova') }, '+ AI co-host / guest')),
    h('p', { class: 'muted' }, 'People can be in the room with you, elsewhere on your network, or anywhere on the internet. AI cast members speak with a voice from Gemini, Grok or ElevenLabs.'), list);
}

function aiEditor(c, ch) {
  const v = c.ai.voice, b = c.ai.brain;
  const voiceSel = h('select', { 'aria-label': 'Voice', onchange: () => { v.voiceId = voiceSel.value; ch(); } }, h('option', { value: v.voiceId || '' }, v.voiceId || 'Default'));
  const modelSel = h('select', { 'aria-label': 'Model', onchange: () => { b.model = modelSel.value; ch(); } }, h('option', { value: b.model || '' }, b.model || 'Automatic (recommended)'));
  const loadVoices = async quiet => {
    try {
      const vs = await api('GET', `/api/ai/voices?provider=${v.provider}`);
      voiceSel.replaceChildren(...vs.map(x => h('option', { value: x.id, selected: x.id === v.voiceId }, x.desc ? `${x.name} — ${x.desc}` : x.name)));
      if (!vs.some(x => x.id === v.voiceId) && vs[0]) { v.voiceId = vs[0].id; ch(); }
    } catch (e) { if (!quiet) fail(e); voiceSel.replaceChildren(h('option', { value: v.voiceId || '' }, v.voiceId || 'Add this service\'s API key in Settings')); }
  };
  const loadModels = async () => { try { const ms = await api('GET', `/api/ai/models?provider=${b.provider}`); modelSel.replaceChildren(h('option', { value: '' }, 'Automatic (recommended)'), ...ms.map(m => h('option', { value: m, selected: m === b.model }, m))); } catch (e) { fail(e); } };
  const test = h('button', { class: 'btn small', onclick: async () => {
    test.disabled = true; test.textContent = 'Generating…';
    try { const blob = await api('POST', '/api/ai/tts', { provider: v.provider, voiceId: v.voiceId, style: v.style, text: `Hi, I'm ${c.name}. This is how I'll sound on the show.` }); new Audio(URL.createObjectURL(blob)).play(); } catch (e) { fail(e); }
    test.disabled = false; test.textContent = 'Test voice';
  } }, 'Test voice');
  loadVoices(true);
  return h('div', { class: 'ai-editor' },
    h('div', { class: 'row wrap top' },
      field('Voice service', inp(v, 'provider', { type: 'select', opts: [['gemini', 'Gemini TTS (Google)'], ['xai', 'Grok (xAI)'], ['elevenlabs', 'ElevenLabs']], onchange: () => { v.voiceId = ''; ch(); loadVoices(); } })),
      h('label', { class: 'field' }, h('span', {}, 'Voice'), voiceSel), field('Delivery style', inp(v, 'style', { placeholder: 'warm, upbeat, dry wit…', onchange: ch }), 'Gemini follows this; other services ignore it.'), h('div', { class: 'field' }, h('span', {}, ' '), test)),
    h('div', { class: 'row wrap top' },
      field('Thinks with', inp(b, 'provider', { type: 'select', opts: [['gemini', 'Gemini'], ['xai', 'Grok'], ['anthropic', 'Claude'], ['ollama', 'Local model (Ollama / IPRPS Oracle)']], onchange: () => { b.model = ''; modelSel.replaceChildren(h('option', { value: '' }, 'Automatic (recommended)')); ch(); } })),
      h('label', { class: 'field' }, h('span', {}, 'Model'), modelSel), h('div', { class: 'field' }, h('span', {}, ' '), h('button', { class: 'btn small', onclick: loadModels }, 'List models'))),
    field('Persona', inp(c.ai, 'persona', { type: 'textarea', rows: 4, placeholder: 'Who is this character? Background, expertise, sense of humor, how they relate to the host, topics to lean into or avoid…', onchange: ch })));
}

function padsPane(show, ch) {
  const list = h('div', { class: 'pad-list' });
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  const draw = () => list.replaceChildren(...show.pads.map((p, i) => {
    const a = show.assets.find(x => x.id === p.assetId);
    return h('div', { class: 'pad-row' }, h('kbd', {}, keys[i] || ''), inp(p, 'color', { type: 'color', onchange: ch }), inp(p, 'label', { placeholder: 'Label', onchange: ch }),
      a ? h('audio', { controls: true, src: `/files/${show.id}/assets/${a.file}` }) : h('span', { class: 'muted' }, 'No sound yet'),
      h('button', { class: 'btn small', onclick: () => pickFile('audio/*', async f => { try { const r = await upload(`/api/shows/${show.id}/assets?name=${encodeURIComponent(f.name)}`, f); show.assets = r.show.assets; p.assetId = r.asset.id; if (!p.label) p.label = f.name.replace(/\.[^.]+$/, ''); ch(); draw(); } catch (e) { fail(e); } }) }, a ? 'Replace sound' : 'Choose sound'),
      h('label', { class: 'check' }, inp(p, 'loop', { type: 'checkbox', onchange: ch }), 'Loop'), h('label', {}, 'Level', inp(p, 'gain', { type: 'range', min: 0, max: 1.5, step: 0.05, def: 1, onchange: ch })),
      h('button', { class: 'btn small ghost', onclick: () => { show.pads.splice(i, 1); ch(); draw(); } }, 'Remove'));
  }), show.pads.length ? null : h('p', { class: 'muted' }, 'No pads yet.'));
  draw();
  const lib = show.assets.filter(a => a.kind === 'audio');
  return h('div', {}, h('div', { class: 'row' }, h('h2', {}, 'Soundboard'), h('span', { class: 'grow' }), h('button', { class: 'btn primary', disabled: show.pads.length >= 12, onclick: () => { if (show.pads.length < 12) { show.pads.push({ id: 'p' + Date.now(), label: '', color: PAD_COLORS[show.pads.length % 6], assetId: '', loop: false, gain: 1 }); ch(); draw(); } } }, '+ Pad')),
    h('p', { class: 'muted' }, 'Up to 12 pads for stingers, applause, beds and bumpers. In the studio, click a pad or press its key; press again to stop. Co-hosts can fire them remotely.'), list,
    h('h2', {}, 'Audio library'), h('p', { class: 'muted' }, 'Tracks here can be loaded into Deck A or Deck B in the studio.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => pickFile('audio/*', async f => { try { await upload(`/api/shows/${show.id}/assets?name=${encodeURIComponent(f.name)}`, f); route(); } catch (e) { fail(e); } }) }, 'Add music or effect')),
    h('table', { class: 'table' }, h('tbody', {}, lib.map(a => h('tr', {}, h('td', {}, a.name), h('td', {}, fmtTime(a.duration)), h('td', {}, h('audio', { controls: true, preload: 'none', src: `/files/${show.id}/assets/${a.file}` })),
      h('td', { class: 'right' }, h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox('Delete sound?', `“${a.name}” will be removed from the library and from any pad using it.`, 'Delete')) { await api('DELETE', `/api/shows/${show.id}/assets/${a.id}`).catch(fail); route(); } } }, 'Delete')))))));
}

async function publishPane(show, ch, save) {
  const fd = show.feed;
  const out = h('div', {});
  const refresh = async () => {
    await save.flush();
    const f = await api('GET', `/api/shows/${show.id}/feed`);
    const errs = f.checks.filter(c => !c.ok && c.level === 'error').length;
    out.replaceChildren(
      h('h2', {}, 'Readiness'), h('ul', { class: 'checks' }, f.checks.map(c => h('li', { class: c.ok ? 'ok' : c.level }, h('i', {}, c.ok ? '✓' : (c.level === 'error' ? '✕' : '!')), c.msg))),
      h('div', { class: 'row' }, h('button', { class: 'btn primary big', id: 'publish-btn', onclick: async e => { e.target.disabled = true; try { const r = await api('POST', `/api/shows/${show.id}/publish`); toast(`Feed built with ${r.episodes} episode(s). ${r.log}`, 'ok', 9000); show.feed.lastPublished = Date.now(); } catch (x) { fail(x); } refresh(); } }, fd.lastPublished ? 'Publish updates' : 'Build and publish feed'),
        h('button', { class: 'btn', onclick: () => modal('feed.xml preview', h('pre', { class: 'code' }, f.xml), [{ label: 'Close' }], { cls: 'wide-modal' }) }, 'Preview feed.xml'),
        h('span', { class: 'muted' }, fd.lastPublished ? `Last published ${new Date(fd.lastPublished).toLocaleString()}` : 'Not published yet')),
      f.feedUrl ? h('div', { class: 'row link' }, h('b', {}, 'Your feed address'), h('input', { readOnly: true, value: f.feedUrl, onclick: e => e.target.select() }), h('button', { class: 'btn small', onclick: () => copyText(f.feedUrl) }, 'Copy')) : null,
      h('h2', {}, 'Podcast directories'),
      h('p', { class: 'muted' }, errs ? `Fix the ${errs} item(s) marked ✕ and publish the feed before submitting.` : 'Each directory asks for your feed address once; after that it picks up new episodes on its own whenever you publish. Sign-in happens on the directory\'s own site.'),
      h('table', { class: 'table dirs' }, h('thead', {}, h('tr', {}, ['Directory', 'How to submit', 'Status', 'Your listing', ''].map(x => h('th', {}, x)))),
        h('tbody', {}, app.directories.map(d => { const st = show.directories[d.id]; return h('tr', {}, h('td', {}, h('b', {}, d.name)), h('td', { class: 'muted small' }, d.how),
          h('td', {}, inp(st, 'status', { type: 'select', opts: [['none', 'Not submitted'], ['submitted', 'Submitted'], ['live', 'Live'], ['rejected', 'Needs changes']], onchange: ch })),
          h('td', {}, inp(st, 'url', { placeholder: 'Listing link', onchange: ch })),
          h('td', { class: 'right' }, h('button', { class: 'btn small', onclick: () => { if (f.feedUrl) copyText(f.feedUrl); window.open(d.url, '_blank', 'noopener'); if (st.status === 'none') { st.status = 'submitted'; ch(); } } }, 'Open + copy feed'),
            d.id === 'podcastindex' ? h('button', { class: 'btn small', onclick: async () => { try { const r = await api('POST', `/api/shows/${show.id}/podcastindex`); toast(r.description || 'Submitted to Podcast Index', 'ok'); st.status = 'submitted'; ch(); } catch (e) { fail(e); } } }, 'Submit via API') : null)); }))));
  };
  const el = h('div', {},
    h('div', { class: 'form two' },
      h('section', {}, h('h2', {}, 'Where the feed lives'),
        field('Public address of this show\'s folder', inp(fd, 'publicBaseUrl', { placeholder: 'https://infiniteplane.space/podcasts/my-show', onchange: ch }), 'Directories fetch feed.xml and the episode files from here, so it must be a public https address on your web host.'),
        field('Support / funding link (optional)', inp(fd, 'fundingUrl', { placeholder: 'https://', onchange: ch })),
        field('Lock feed against unauthorized imports', inp(fd, 'locked', { type: 'checkbox', onchange: ch }))),
      h('section', {}, h('h2', {}, 'How it gets there'),
        field('Upload method', inp(fd, 'deployMode', { type: 'select', opts: [['folder', 'Copy to a folder on this computer'], ['ssh', 'Upload to a server over SSH (rsync)'], ['none', 'Just build it — I\'ll upload it myself']], onchange: ch })),
        field('Folder', inp(fd, 'deployFolder', { placeholder: '/srv/http/podcasts/my-show', onchange: ch }), 'For a web server on this machine or a mounted share.'),
        field('SSH target', inp(fd, 'sshTarget', { placeholder: 'user@infiniteplane.space:/var/www/podcasts/my-show', onchange: ch }), 'Uses your SSH key (ssh-agent); no passwords are stored.'))),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => refresh().catch(fail) }, 'Re-check')), out);
  await refresh();
  return el;
}

async function backupPane(show, ch) {
  const list = h('div', {});
  const draw = async () => {
    const b = await api('GET', '/api/backups');
    list.replaceChildren(h('p', { class: 'muted small' }, `Backups are kept in ${b.dir}`),
      b.backups.length ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Backup', 'Size', 'Created', ''].map(x => h('th', {}, x)))), h('tbody', {}, b.backups.map(x => h('tr', {}, h('td', {}, x.name), h('td', {}, fmtSize(x.size)), h('td', {}, new Date(x.createdAt).toLocaleString()),
        h('td', { class: 'right' }, h('a', { class: 'btn small', href: `/backups/${encodeURIComponent(x.name)}` }, 'Download'),
          h('button', { class: 'btn small', onclick: async () => { try { const s = await api('POST', `/api/backups/${encodeURIComponent(x.name)}/restore`); toast(`Restored as “${s.title}”`, 'ok'); go(`#/show/${s.id}`); } catch (e) { fail(e); } } }, 'Restore'),
          h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox('Delete backup?', `${x.name} will be permanently deleted.`, 'Delete backup')) { await api('DELETE', `/api/backups/${encodeURIComponent(x.name)}`).catch(fail); draw(); } } }, 'Delete')))))) : h('p', { class: 'muted' }, 'No backups yet.'));
  };
  const mk = (media, label) => h('button', { class: 'btn' + (media ? ' primary' : ''), onclick: async e => { e.target.disabled = true; toast('Creating backup…'); try { const r = await api('POST', `/api/shows/${show.id}/backup`, { includeMedia: media }); toast(`Backup created (${fmtSize(r.size)})`, 'ok'); } catch (x) { fail(x); } e.target.disabled = false; draw(); } }, label);
  await draw();
  return h('div', {}, h('h2', {}, 'Back up this show'),
    h('p', { class: 'muted' }, 'A full backup holds everything — settings, branding, sounds, every recording and export — in one file you can copy to another drive or machine and restore here.'),
    h('div', { class: 'row' }, mk(true, 'Full backup'), mk(false, 'Settings only (no recordings)')), list,
    h('h2', {}, 'Archive'), h('p', { class: 'muted' }, 'Archiving hides a finished show from your library without deleting anything. Its published feed keeps working.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { show.archived = !show.archived; ch(); toast(show.archived ? 'Show archived' : 'Show restored to your library'); setTimeout(route, 700); } }, show.archived ? 'Unarchive show' : 'Archive show'),
      h('button', { class: 'btn', onclick: async () => { try { const s = await api('POST', `/api/shows/${show.id}/duplicate`); toast('Duplicated', 'ok'); go(`#/show/${s.id}/details`); } catch (e) { fail(e); } } }, 'Duplicate show (settings and brand)')),
    h('h2', {}, 'Delete'), h('div', { class: 'row' }, h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Delete this show?', `“${show.title}” and all of its episodes, recordings and exports will be permanently deleted from this computer. Backups you already made are kept.`, 'Delete show')) { await api('DELETE', `/api/shows/${show.id}`).catch(fail); go('#/'); } } }, 'Delete show…')));
}

// ================================================================= episode
async function episodeView(sid, eid, tab) {
  const [show, ep] = await Promise.all([api('GET', `/api/shows/${sid}`), api('GET', `/api/shows/${sid}/episodes/${eid}`)]);
  brandVars(show);
  setCrumbs({ label: 'Shows', href: '#/' }, { label: show.title, href: `#/show/${sid}` }, { label: ep.title });
  const tabs = [['details', 'Details'], ['studio', 'Studio'], ['editor', 'Editor'], ['export', 'Export & publish']];
  let inner = null;
  const body = h('div', { class: 'tab-body' });
  if (tab === 'studio') { inner = studioView(show, ep); body.append(inner.el); }
  else if (tab === 'editor') { inner = editorView(show, ep); body.append(inner.el); }
  else if (tab === 'export') { inner = exportPane(show, ep); body.append(inner.el); }
  else { inner = epDetails(show, ep); body.append(inner.el); }
  const el = h('div', { class: 'page wide' }, h('div', { class: 'ep-head' }, h('h1', {}, ep.title), h('span', { class: 'pill' }, `S${ep.season || 1} · E${ep.number || 1}`), ep.published ? h('span', { class: 'pill live' }, 'Published') : null),
    tabsBar(tabs, tab, k => `#/show/${sid}/ep/${eid}/${k}`), body);
  return { el, destroy: () => inner.destroy && inner.destroy(), busy: () => inner.busy && inner.busy() };
}

function epDetails(show, ep) {
  const status = h('span', { class: 'muted small' }, '');
  const save = debounce(async () => { try { await api('PUT', `/api/shows/${show.id}/episodes/${ep.id}`, { title: ep.title, description: ep.description, season: ep.season, number: ep.number, episodeType: ep.episodeType, explicit: ep.explicit, script: ep.script }); status.textContent = 'Saved'; } catch (e) { fail(e); } }, 500);
  const ch = () => { status.textContent = 'Saving…'; save(); };
  const el = h('div', { class: 'form two' },
    h('section', {}, h('div', { class: 'row' }, h('h2', {}, 'Episode'), h('span', { class: 'grow' }), status),
      field('Title', inp(ep, 'title', { onchange: ch })),
      field('Show notes', inp(ep, 'description', { type: 'textarea', rows: 9, placeholder: 'What is this episode about? Guests, links, credits…', onchange: ch }), 'Published in the feed. Blank lines become paragraphs.'),
      h('div', { class: 'row wrap' }, field('Season', inp(ep, 'season', { type: 'number', min: 1, onchange: ch })), field('Episode number', inp(ep, 'number', { type: 'number', min: 1, onchange: ch })),
        field('Type', inp(ep, 'episodeType', { type: 'select', opts: [['full', 'Full episode'], ['trailer', 'Trailer'], ['bonus', 'Bonus']], onchange: ch }))),
      field('Explicit content', inp(ep, 'explicit', { type: 'checkbox', onchange: ch })),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: `#/show/${show.id}/ep/${ep.id}/studio` }, 'Go to the studio'), h('a', { class: 'btn', href: `#/show/${show.id}/ep/${ep.id}/editor` }, 'Open the editor'))),
    h('section', {}, h('h2', {}, 'Script / rundown'),
      field('Shown as a teleprompter in the studio', inp(ep, 'script', { type: 'textarea', rows: 18, placeholder: 'Cold open…\n\nIntro…\n\nSegment 1…', onchange: ch }))));
  return { el, destroy: () => save.flush() };
}

function exportPane(show, ep) {
  const base = `/api/shows/${show.id}/episodes/${ep.id}`;
  const o = { format: 'mp3', bitrate: '128k', resolution: '720p', lowerThirds: true, watermark: true };
  const opts = h('div', { class: 'row wrap' });
  const drawOpts = () => opts.replaceChildren(
    field('Format', inp(o, 'format', { type: 'select', onchange: drawOpts, opts: [['mp3', 'MP3 — audio podcast (recommended for the feed)'], ['m4a', 'M4A (AAC) audio'], ['wav', 'WAV — uncompressed master'], ['flac', 'FLAC — lossless master'], ['mp4', 'MP4 — video podcast'], ['audiogram', 'MP4 audiogram — cover art + waveform']] })),
    ['mp3', 'm4a'].includes(o.format) ? field('Quality', inp(o, 'bitrate', { type: 'select', opts: [['96k', '96 kbps — speech, small files'], ['128k', '128 kbps — standard'], ['192k', '192 kbps — music-heavy shows']] })) : null,
    ['mp4', 'audiogram'].includes(o.format) ? field('Picture', inp(o, 'resolution', { type: 'select', opts: [['720p', '1280×720'], ['1080p', '1920×1080'], ['480p', '854×480 (fast)'], ['square', '1080×1080 square'], ['vertical', '1080×1920 vertical']] })) : null,
    o.format === 'mp4' ? field('Name lower-thirds', inp(o, 'lowerThirds', { type: 'checkbox' })) : null, o.format === 'mp4' ? field('Logo watermark', inp(o, 'watermark', { type: 'checkbox' })) : null);
  drawOpts();
  const prog = h('div', { class: 'progress', hidden: true }, h('i', {}), h('span', {}, ''));
  const list = h('div', {});
  let poll = null;
  const renderBtn = h('button', { class: 'btn primary big', id: 'render-btn', onclick: async () => {
    renderBtn.disabled = true;
    try {
      const job = await api('POST', base + '/render', o);
      prog.hidden = false;
      poll = setInterval(async () => {
        try {
          const j = await api('GET', '/api/jobs/' + job.id);
          prog.firstChild.style.width = j.progress + '%'; prog.lastChild.textContent = `Rendering… ${j.progress}%`;
          if (j.status !== 'running') {
            clearInterval(poll); poll = null; prog.hidden = true; renderBtn.disabled = false;
            if (j.status === 'done') { toast('Export finished', 'ok'); Object.assign(ep, await api('GET', base)); draw(); } else toast('Export failed: ' + (j.error || '').split('\n').slice(-3).join(' '), 'err', 12000);
          }
        } catch (e) { clearInterval(poll); poll = null; renderBtn.disabled = false; fail(e); }
      }, 700);
    } catch (e) { renderBtn.disabled = false; fail(e); }
  } }, 'Export episode');
  const pub = h('div', {});
  const draw = () => {
    list.replaceChildren(ep.exports.length ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['File', 'Length', 'Size', 'Created', 'In the feed', ''].map(x => h('th', {}, x)))),
      h('tbody', {}, [...ep.exports].reverse().map(x => { const url = `/files/${show.id}/episodes/${ep.id}/exports/${x.file}`; return h('tr', {},
        h('td', {}, x.hasVideo ? h('video', { controls: true, preload: 'none', src: url, class: 'thumb' }) : h('audio', { controls: true, preload: 'none', src: url }), h('div', { class: 'small muted' }, x.file)),
        h('td', {}, fmtTime(x.duration)), h('td', {}, fmtSize(x.size)), h('td', {}, new Date(x.createdAt).toLocaleString()),
        h('td', {}, ['mp3', 'm4a', 'mp4'].includes(x.format) ? h('label', { class: 'check' }, h('input', { type: 'radio', name: 'feedx', checked: ep.feedExportId === x.id, onchange: async () => { ep.feedExportId = x.id; await api('PUT', base, { feedExportId: x.id }).catch(fail); draw(); } }), 'Use this') : h('span', { class: 'muted small' }, 'master only')),
        h('td', { class: 'right' }, h('a', { class: 'btn small', href: url + '?dl=1' }, 'Download'), h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox('Delete export?', `${x.file} will be deleted. You can export again any time.`, 'Delete')) { try { Object.assign(ep, await api('DELETE', `${base}/exports/${x.id}`)); draw(); } catch (e) { fail(e); } } } }, 'Delete'))); })))
      : h('p', { class: 'muted' }, 'No exports yet. Export an MP3 for the audio feed; add an MP4 for YouTube and Spotify video.'));
    const date = h('input', { type: 'datetime-local', value: new Date((ep.pubDate || Date.now()) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) });
    const can = !!ep.feedExportId;
    pub.replaceChildren(h('h2', {}, 'Publish this episode'),
      ep.published ? h('p', {}, h('span', { class: 'pill live' }, 'Published'), ` Dated ${new Date(ep.pubDate).toLocaleString()}. It is included the next time you publish the show's feed.`)
        : h('p', { class: 'muted' }, can ? 'Marks the episode as released. It goes out when you publish the feed from the show\'s Publish tab.' : 'Export an MP3, M4A or MP4 and choose “Use this” first.'),
      h('div', { class: 'row' }, h('label', { class: 'field' }, h('span', {}, 'Release date'), date),
        h('button', { class: 'btn primary', disabled: !can && !ep.published, onclick: async () => { try { Object.assign(ep, await api('PUT', base, { published: !ep.published, pubDate: new Date(date.value).getTime() || Date.now() })); toast(ep.published ? 'Marked as published' : 'Unpublished'); draw(); } catch (e) { fail(e); } } }, ep.published ? 'Unpublish' : 'Mark as published'),
        h('a', { class: 'btn', href: `#/show/${show.id}/publish` }, 'Go to feed & directories')));
  };
  draw();
  const el = h('div', {}, h('h2', {}, 'Export'), h('p', { class: 'muted' }, 'Renders the editor timeline with every track\'s effects, loudness-normalized, tagged with the episode details, cover art and chapters.'),
    opts, h('div', { class: 'row' }, renderBtn, prog), h('h2', {}, 'Exports'), list, pub);
  return { el, destroy: () => poll && clearInterval(poll) };
}

// ================================================================= settings
async function settingsView() {
  setCrumbs({ label: 'Shows', href: '#/' }, { label: 'Settings' });
  app = await api('GET', '/api/state');
  const c = app.config, keys = {};
  const status = h('span', { class: 'muted small' }, '');
  const save = debounce(async () => { try { await api('PUT', '/api/config', { ...c, keys }); for (const k of Object.keys(keys)) delete keys[k]; status.textContent = 'Saved'; } catch (e) { fail(e); } }, 600);
  const ch = () => { status.textContent = 'Saving…'; save(); };
  const key = (name, label, hint) => { const i = h('input', { type: 'password', autocomplete: 'off', placeholder: c.hasKey[name] ? `Saved (${c.keyHint[name]}) — paste to replace` : 'Paste key', oninput: () => { keys[name] = i.value; ch(); } }); return h('label', { class: 'field' }, h('span', {}, label, c.hasKey[name] ? h('span', { class: 'pill live' }, 'saved') : null), i, hint ? h('small', {}, hint) : null); };
  const ice = h('textarea', { rows: 4, value: JSON.stringify(c.iceServers, null, 1), onchange: () => { try { c.iceServers = JSON.parse(ice.value); ch(); } catch (e) { toast('ICE servers must be valid JSON', 'err'); } } });
  const g = app.guest;
  const el = h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', {}, 'Settings'), h('span', { class: 'grow' }), status),
    h('div', { class: 'form two' },
      h('section', {}, h('h2', {}, 'AI services'), h('p', { class: 'muted' }, 'Keys are stored only on this computer (readable by your user alone) and sent only to the service they belong to.'),
        key('gemini', 'Google Gemini API key', 'Gemini TTS voices, plus Gemini as a brain and for hearing push-to-talk. aistudio.google.com'),
        key('xai', 'xAI (Grok) API key', 'Grok voices and Grok as a brain. console.x.ai'),
        key('elevenlabs', 'ElevenLabs API key', 'ElevenLabs voices, including your own cloned voices. elevenlabs.io'),
        key('anthropic', 'Anthropic (Claude) API key — optional', 'Claude as a brain. console.anthropic.com'),
        field('Gemini TTS model', inp(c, 'geminiTtsModel', { onchange: ch }), 'If this model is unavailable to your key, the studio falls back to the other Gemini TTS models automatically.'),
        field('ElevenLabs model', inp(c, 'elevenModel', { onchange: ch })),
        field('Push-to-talk hearing (speech-to-text)', inp(c, 'sttProvider', { type: 'select', opts: [['gemini', 'Gemini'], ['xai', 'Grok'], ['elevenlabs', 'ElevenLabs Scribe']], onchange: ch })),
        field('Local model server (Ollama)', inp(c, 'ollamaUrl', { onchange: ch }), 'The IPRPS Oracle\'s Ollama works here with no key.'),
        h('h2', {}, 'Podcast Index (optional)'), key('podcastindexKey', 'API key'), key('podcastindexSecret', 'API secret', 'Lets the studio submit your feed to Podcast Index directly. Free at api.podcastindex.org')),
      h('section', {}, h('h2', {}, 'Remote guests'),
        h('p', {}, g.up ? h('span', { class: 'pill live' }, 'Guest gateway on') : h('span', { class: 'pill warn' }, 'Guest gateway off'), ` Port ${g.port}, ${g.tls ? 'HTTPS (self-signed certificate)' : 'plain HTTP'}`),
        h('ul', { class: 'plain' }, g.bases.slice(0, -1).map(b => h('li', {}, h('b', {}, b.label + ': '), b.url))),
        field('Guest gateway enabled', inp(c, 'guestEnabled', { type: 'checkbox', onchange: ch }), 'Guests reach only their join page. The studio itself never leaves this computer.'),
        field('Serve guests over HTTPS', inp(c, 'guestTls', { type: 'checkbox', onchange: ch }), 'Browsers only allow camera and microphone on https. Turn off only behind a tunnel or proxy that adds HTTPS itself.'),
        field('Guest port', inp(c, 'guestPort', { type: 'number', min: 1024, max: 65535, onchange: ch })),
        field('Public address for internet guests', inp(c, 'publicUrl', { placeholder: 'https://studio.example.com', onchange: ch }), 'The address that reaches the guest port from outside: a port-forward with your own domain, a VPN/overlay address, or a tunnel. Invite links use it when set.'),
        h('label', { class: 'field' }, h('span', {}, 'ICE servers (STUN / TURN)'), ice, h('small', {}, 'STUN is enough for most home networks. Add a TURN server here if a guest behind a strict firewall cannot connect.')),
        h('p', { class: 'muted small' }, 'Port, HTTPS and gateway changes take effect the next time the studio starts.'),
        h('h2', {}, 'Storage'), field('Backup folder', inp(c, 'backupDir', { placeholder: 'Default: inside the studio data folder', onchange: ch }), 'Point this at an external drive or a synced folder.'),
        h('ul', { class: 'plain' }, h('li', {}, h('b', {}, 'Data folder: '), app.dataDir), h('li', {}, h('b', {}, 'ffmpeg: '), app.ffmpeg ? 'found' : 'missing — install the ffmpeg package'), h('li', {}, h('b', {}, 'rsync: '), app.rsync ? 'found' : 'missing — needed for SSH publishing'), h('li', {}, h('b', {}, 'Version: '), app.version)),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { if (await confirmBox('Quit Podcast Studio?', 'Stops the studio server. Guests are disconnected. Your shows are already saved.', 'Quit')) { try { await api('POST', '/api/quit'); view.replaceChildren(h('div', { class: 'card lobby' }, h('h2', {}, 'Podcast Studio has stopped'), h('p', { class: 'muted' }, 'You can close this window. Start it again from the applications menu.'))); } catch (e) { fail(e); } } } }, 'Quit Podcast Studio')))));
  return { el, destroy: () => save.flush() };
}
