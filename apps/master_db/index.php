<?php require getenv('IPRPS_AUTH_CHECK') ?: __DIR__ . '/../auth/auth-check.php'; ip_require_login_page(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IPRPS Master Database</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<!-- Central login guard: verifies session + auto-adds X-Auth-Token to fetch -->
<script src="../auth/auth-client.js"></script>
<style>
  :root{
    --bg:#0e0c17; --panel:#171326; --panel2:#1f1930; --edge:#332a4d;
    --ink:#ece7fb; --muted:#a89fc7; --gold:#e5b567; --arcane:#8b6fe8; --arcane2:#b49bff;
    --danger:#e0567a; --ok:#5bd6a0;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--ink);}
  a{color:var(--arcane2)}
  #boot{display:flex;height:100vh;align-items:center;justify-content:center;color:var(--muted);font-size:18px}
  header{display:flex;align-items:center;gap:16px;padding:12px 20px;background:linear-gradient(90deg,#1a1430,#241a3d);border-bottom:1px solid var(--edge);position:sticky;top:0;z-index:20}
  header h1{font-size:18px;margin:0;letter-spacing:.5px}
  header h1 .g{color:var(--gold)}
  header .spacer{flex:1}
  .badge{font-size:11px;padding:3px 9px;border-radius:20px;border:1px solid var(--edge);color:var(--muted)}
  .badge.admin{color:#0e0c17;background:var(--gold);border-color:var(--gold);font-weight:700}
  .btn{background:var(--panel2);color:var(--ink);border:1px solid var(--edge);border-radius:8px;padding:8px 13px;cursor:pointer;font-size:13px}
  .btn:hover{border-color:var(--arcane)}
  .btn.primary{background:var(--arcane);border-color:var(--arcane);color:#fff}
  .btn.primary:hover{background:var(--arcane2)}
  .btn.gold{background:var(--gold);border-color:var(--gold);color:#231a08;font-weight:600}
  .btn.danger{background:transparent;border-color:var(--danger);color:var(--danger)}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  .layout{display:flex;min-height:calc(100vh - 57px)}
  aside{width:230px;background:var(--panel);border-right:1px solid var(--edge);padding:12px 8px;flex-shrink:0}
  .mod{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:8px;cursor:pointer;color:var(--muted);font-size:14px}
  .mod:hover{background:var(--panel2);color:var(--ink)}
  .mod.active{background:var(--panel2);color:var(--ink);box-shadow:inset 3px 0 0 var(--gold)}
  .mod .ic{font-size:17px}
  .mod .ct{margin-left:auto;font-size:11px;color:var(--muted);background:#0e0c17;border:1px solid var(--edge);border-radius:12px;padding:1px 8px}
  main{flex:1;padding:18px 22px;min-width:0}
  .toolbar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
  .search{flex:1;min-width:180px;background:var(--panel);border:1px solid var(--edge);border-radius:8px;padding:9px 13px;color:var(--ink);font-size:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
  .card{background:var(--panel);border:1px solid var(--edge);border-radius:12px;overflow:hidden;cursor:pointer;transition:.15s;position:relative}
  .card:hover{border-color:var(--arcane);transform:translateY(-2px)}
  .card .thumb{height:130px;background:#0c0a15 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#3a3356;font-size:34px}
  .card .body{padding:11px 13px}
  .card .body h3{margin:0 0 5px;font-size:15px}
  .card .body p{margin:0;font-size:12px;color:var(--muted);line-height:1.4;max-height:50px;overflow:hidden}
  .card .pick{position:absolute;top:9px;left:9px;width:22px;height:22px;accent-color:var(--gold);display:none}
  body.selecting .card .pick{display:block}
  body.selecting .card.picked{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold)}
  .empty{color:var(--muted);text-align:center;padding:60px 0}
  /* modal */
  .overlay{position:fixed;inset:0;background:rgba(6,4,12,.72);display:none;align-items:center;justify-content:center;z-index:40;padding:20px}
  .overlay.show{display:flex}
  .modal{background:var(--panel);border:1px solid var(--edge);border-radius:14px;max-width:640px;width:100%;max-height:90vh;overflow:auto}
  .modal .head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--edge);position:sticky;top:0;background:var(--panel)}
  .modal .head h2{margin:0;font-size:19px;flex:1}
  .modal .content{padding:18px 20px}
  .modal img.hero{width:100%;max-height:280px;object-fit:contain;background:#0c0a15;border-radius:10px;margin-bottom:14px}
  .attr{margin-bottom:12px}
  .attr .k{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--gold);margin-bottom:3px}
  .attr .v{font-size:14px;color:var(--ink);white-space:pre-wrap;line-height:1.5}
  .modal .foot{display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--edge);position:sticky;bottom:0;background:var(--panel)}
  label.fld{display:block;margin-bottom:12px}
  label.fld span{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
  label.fld input,label.fld textarea,label.fld select{width:100%;background:var(--panel2);border:1px solid var(--edge);border-radius:7px;padding:8px 11px;color:var(--ink);font-size:14px;font-family:inherit}
  label.fld textarea{min-height:70px;resize:vertical}
  .close{cursor:pointer;color:var(--muted);font-size:22px;line-height:1}
  .toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--panel2);border:1px solid var(--edge);border-radius:9px;padding:11px 18px;font-size:14px;z-index:60;opacity:0;transition:.25s;pointer-events:none}
  .toast.show{opacity:1}
  .toast.err{border-color:var(--danger);color:var(--danger)}
  .toast.ok{border-color:var(--ok);color:var(--ok)}
  .selbar{display:none;gap:10px;align-items:center;background:var(--panel2);border:1px solid var(--gold);border-radius:9px;padding:9px 14px;margin-bottom:14px}
  body.selecting .selbar{display:flex}
  .selbar .n{color:var(--gold);font-weight:600}
  .seedrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border:1px solid var(--edge);border-radius:8px;margin-bottom:8px}
  .err{color:var(--danger)}
</style>
</head>
<body>
<div id="boot">✦ Verifying your Infinite Plane sign-in…</div>

<div id="app" style="display:none">
  <header>
    <h1>✦ IPRPS <span class="g">Master Database</span></h1>
    <span class="spacer"></span>
    <span id="userName" class="badge"></span>
    <span id="roleBadge" class="badge"></span>
    <button class="btn" id="logoutBtn">Log out</button>
  </header>

  <div class="layout">
    <aside id="sidebar"></aside>
    <main>
      <div class="toolbar">
        <input id="search" class="search" placeholder="Search entries…">
        <button class="btn" id="selectBtn">☑ Select for report</button>
        <button class="btn gold" id="newBtn" style="display:none">＋ New entry</button>
        <button class="btn" id="importBtn" style="display:none">⭳ Import</button>
      </div>

      <div class="selbar">
        <span class="n"><span id="selCount">0</span> selected</span>
        <button class="btn gold" id="reportBtn">🖨 Export report (images)</button>
        <button class="btn" id="dataBtn">⭳ Export data (.iprps)</button>
        <button class="btn" id="cancelSel">Cancel</button>
      </div>

      <div id="grid" class="grid"></div>
    </main>
  </div>
</div>

<!-- Detail / Edit modal -->
<div class="overlay" id="overlay">
  <div class="modal" id="modal"></div>
</div>
<div class="toast" id="toast"></div>

<script>
const API = 'master_api.php';
let ME = {is_admin:false, user:{}};
let MODULES = [];
let CURRENT_MODULE = '';       // '' = all
let ENTRIES = [];
let SELECT_MODE = false;
const SELECTED = new Set();

// ---- boot on central-login ready ------------------------------------------
if (window.IPAuth && IPAuth.user) start();
else document.addEventListener('ipauth:ready', start);

async function start(){
  try {
    const who = await api('?action=whoami');
    ME = who;
    document.getElementById('userName').textContent = who.user.name || who.user.email || 'Signed in';
    const rb = document.getElementById('roleBadge');
    rb.textContent = who.is_admin ? 'ADMIN · full CRUD' : 'Read-only';
    rb.className = 'badge' + (who.is_admin ? ' admin' : '');
    if (who.is_admin){
      document.getElementById('newBtn').style.display='';
      document.getElementById('importBtn').style.display='';
    }
    document.getElementById('boot').style.display='none';
    document.getElementById('app').style.display='';
    await loadModules();
    await loadEntries();
    wire();
  } catch(e){
    document.getElementById('boot').textContent = 'Could not load: ' + e.message;
  }
}

// ---- API helper (auth-client.js already adds X-Auth-Token to fetch) --------
async function api(qs){
  const r = await fetch(API + qs, {cache:'no-store'});
  const j = await r.json();
  if (!j.success) throw new Error(j.message || 'Request failed');
  return j;
}
async function apiPost(fd){
  const r = await fetch(API, {method:'POST', body:fd});
  const j = await r.json();
  if (!j.success) throw new Error(j.message || 'Request failed');
  return j;
}

async function loadModules(){
  const j = await api('?action=modules');
  MODULES = j.modules;
  const side = document.getElementById('sidebar');
  const total = MODULES.reduce((s,m)=>s+m.count,0);
  side.innerHTML = '';
  side.appendChild(modRow({module_key:'', label:'All catalogs', icon:'✦', count:total}));
  MODULES.forEach(m=>side.appendChild(modRow(m)));
}
function modRow(m){
  const d=document.createElement('div');
  d.className='mod'+(m.module_key===CURRENT_MODULE?' active':'');
  d.innerHTML=`<span class="ic">${m.icon||'📦'}</span><span>${esc(m.label)}</span><span class="ct">${m.count}</span>`;
  d.onclick=()=>{CURRENT_MODULE=m.module_key;document.querySelectorAll('.mod').forEach(x=>x.classList.remove('active'));d.classList.add('active');loadEntries();};
  return d;
}

async function loadEntries(){
  const search = document.getElementById('search').value.trim();
  const qs = '?action=list' + (CURRENT_MODULE?'&module='+encodeURIComponent(CURRENT_MODULE):'') + (search?'&search='+encodeURIComponent(search):'');
  const j = await api(qs);
  ENTRIES = j.entries;
  renderGrid();
}

function renderGrid(){
  const g=document.getElementById('grid');
  if(!ENTRIES.length){g.innerHTML='<div class="empty">No entries here yet.</div>';return;}
  g.innerHTML='';
  ENTRIES.forEach(e=>{
    const mod = MODULES.find(m=>m.module_key===e.module);
    const c=document.createElement('div');
    c.className='card'+(SELECTED.has(e.id)?' picked':'');
    const thumb = e.image_url
      ? `<div class="thumb" style="background-image:url('${bust(e.image_url,e.updated_at)}')"></div>`
      : `<div class="thumb">${mod?mod.icon:'📦'}</div>`;
    c.innerHTML = `<input type="checkbox" class="pick" ${SELECTED.has(e.id)?'checked':''}>
      ${thumb}
      <div class="body"><h3>${esc(e.name)}</h3><p>${esc(e.summary||e.category||'')}</p></div>`;
    const cb=c.querySelector('.pick');
    cb.onclick=(ev)=>{ev.stopPropagation();toggleSel(e.id,c);};
    c.onclick=()=>{ if(SELECT_MODE){cb.checked=!cb.checked;toggleSel(e.id,c);} else openDetail(e.id); };
    g.appendChild(c);
  });
}

function toggleSel(id,card){
  if(SELECTED.has(id)){SELECTED.delete(id);card.classList.remove('picked');}
  else{SELECTED.add(id);card.classList.add('picked');}
  document.getElementById('selCount').textContent=SELECTED.size;
}

// ---- detail / edit --------------------------------------------------------
async function openDetail(id){
  const j = await api('?action=get&id='+id);
  const e = j.entry;
  const mod = MODULES.find(m=>m.module_key===e.module);
  const fields = mod ? mod.fields : [];
  let rows = '';
  fields.forEach(f=>{
    const v = e.attributes[f.key];
    if(v!==undefined && v!=='' && v!==null)
      rows += `<div class="attr"><div class="k">${esc(f.label)}</div><div class="v">${esc(String(v))}</div></div>`;
  });
  // any extra attributes not in the template
  Object.keys(e.attributes||{}).forEach(k=>{
    if(!fields.find(f=>f.key===k) && e.attributes[k])
      rows += `<div class="attr"><div class="k">${esc(k)}</div><div class="v">${esc(String(e.attributes[k]))}</div></div>`;
  });
  const hero = e.image_url?`<img class="hero" src="${bust(e.image_url,e.updated_at)}">`:'';
  const adminFoot = ME.is_admin
    ? `<button class="btn" onclick="editEntry(${e.id})">✎ Edit</button>
       <button class="btn danger" onclick="deleteEntry(${e.id})">🗑 Delete</button>`
    : '';
  document.getElementById('modal').innerHTML = `
    <div class="head"><span>${mod?mod.icon:'📦'}</span><h2>${esc(e.name)}</h2><span class="close" onclick="closeModal()">✕</span></div>
    <div class="content">${hero}
      ${e.summary?`<div class="attr"><div class="k">Summary</div><div class="v">${esc(e.summary)}</div></div>`:''}
      ${rows||'<p style="color:var(--muted)">No further details.</p>'}
    </div>
    <div class="foot"><button class="btn gold" onclick="reportOne(${e.id})">🖨 Report</button>
      <span style="flex:1"></span>${adminFoot}</div>`;
  showModal();
}

function newEntry(){ openForm(null); }
async function editEntry(id){ const j=await api('?action=get&id='+id); openForm(j.entry); }

function openForm(entry){
  const isNew = !entry;
  // choose module: current, or first
  const modKey = entry ? entry.module : (CURRENT_MODULE || (MODULES[0]&&MODULES[0].module_key));
  const modOptions = MODULES.map(m=>`<option value="${m.module_key}" ${m.module_key===modKey?'selected':''}>${esc(m.label)}</option>`).join('');
  const mod = MODULES.find(m=>m.module_key===modKey) || {fields:[],name_label:'Name'};
  const attrs = entry ? entry.attributes : {};
  const fieldHtml = mod.fields.map(f=>fieldInput(f,attrs[f.key])).join('');
  document.getElementById('modal').innerHTML = `
    <div class="head"><h2>${isNew?'New entry':'Edit entry'}</h2><span class="close" onclick="closeModal()">✕</span></div>
    <div class="content">
      <input type="hidden" id="f_id" value="${entry?entry.id:''}">
      <label class="fld"><span>Catalog</span><select id="f_module" ${isNew?'':'disabled'} onchange="rerenderFields()">${modOptions}</select></label>
      <label class="fld"><span id="nameLbl">${esc(mod.name_label||'Name')} *</span><input id="f_name" value="${entry?escAttr(entry.name):''}"></label>
      <label class="fld"><span>Summary (shown in list)</span><textarea id="f_summary">${entry?esc(entry.summary||''):''}</textarea></label>
      <div id="f_fields">${fieldHtml}</div>
      <label class="fld"><span>Image ${entry&&entry.image_url?'(replace)':''}</span><input type="file" id="f_image" accept="image/*" onchange="previewImage(this)"></label>
      <div id="f_preview_wrap" style="${entry&&entry.image_url?'':'display:none'};margin:-4px 0 12px">
        <img id="f_preview" src="${entry&&entry.image_url?escAttr(bust(entry.image_url,entry.updated_at)):''}"
             style="max-width:160px;max-height:160px;border-radius:8px;border:1px solid var(--edge);background:#0c0a15">
        <div id="f_preview_note" style="font-size:11px;color:var(--muted);margin-top:3px">${entry&&entry.image_url?'Current image':''}</div>
      </div>
      ${entry&&entry.image_url?`<label style="font-size:12px;color:var(--muted)"><input type="checkbox" id="f_removeimg"> remove current image</label>`:''}
    </div>
    <div class="foot"><button class="btn primary" onclick="saveEntry()">💾 Save</button>
      <button class="btn" onclick="closeModal()">Cancel</button></div>`;
  showModal();
}
function fieldInput(f,val){
  val = (val===undefined||val===null)?'':val;
  const tag = f.type==='textarea'
    ? `<textarea data-key="${f.key}">${esc(String(val))}</textarea>`
    : `<input data-key="${f.key}" type="${f.type==='number'?'number':'text'}" step="any" value="${escAttr(String(val))}">`;
  return `<label class="fld"><span>${esc(f.label)}</span>${tag}</label>`;
}
async function previewImage(input){
  const file=input.files[0];
  const wrap=document.getElementById('f_preview_wrap');
  const img=document.getElementById('f_preview');
  const note=document.getElementById('f_preview_note');
  if(!file){ return; }
  try{
    img.src=await processImage(file);
    wrap.style.display='';
    note.textContent='✓ New image ready — click Save to store it';
    note.style.color='var(--ok)';
    const rm=document.getElementById('f_removeimg'); if(rm) rm.checked=false;
  }catch(e){ toast('Could not read image','err'); }
}
function rerenderFields(){
  const modKey=document.getElementById('f_module').value;
  const mod=MODULES.find(m=>m.module_key===modKey)||{fields:[],name_label:'Name'};
  document.getElementById('nameLbl').textContent=(mod.name_label||'Name')+' *';
  document.getElementById('f_fields').innerHTML=mod.fields.map(f=>fieldInput(f,'')).join('');
}

async function saveEntry(){
  const id=document.getElementById('f_id').value;
  const name=document.getElementById('f_name').value.trim();
  if(!name){toast('Name is required','err');return;}
  const attrs={};
  document.querySelectorAll('#f_fields [data-key]').forEach(el=>{
    if(el.value!=='') attrs[el.getAttribute('data-key')]=el.value;
  });
  const fd=new FormData();
  fd.append('action', id?'update':'create');
  if(id) fd.append('id',id);
  fd.append('module', document.getElementById('f_module').value);
  fd.append('name', name);
  fd.append('summary', document.getElementById('f_summary').value);
  fd.append('attributes', JSON.stringify(attrs));
  const rm=document.getElementById('f_removeimg');
  if(rm&&rm.checked) fd.append('remove_image','1');
  const file=document.getElementById('f_image').files[0];
  if(file){ fd.append('image_data', await processImage(file)); }
  try{
    await apiPost(fd);
    toast('Saved','ok');
    closeModal(); await loadModules(); await loadEntries();
  }catch(e){toast(e.message,'err');}
}

async function deleteEntry(id){
  if(!confirm('Delete this entry permanently?'))return;
  const fd=new FormData(); fd.append('action','delete'); fd.append('id',id);
  try{ await apiPost(fd); toast('Deleted','ok'); closeModal(); await loadModules(); await loadEntries(); }
  catch(e){toast(e.message,'err');}
}

// ---- report / export ------------------------------------------------------
async function fetchExport(ids){
  const qs='?action=export&inline=1'+(ids&&ids.length?'&ids='+ids.join(','):(CURRENT_MODULE?'&module='+encodeURIComponent(CURRENT_MODULE):''));
  const r=await fetch(API+qs); return (await r.json()).entries||[];
}
function reportOne(id){ buildReport([id]); }
async function buildReport(ids){
  const entries=await fetchExport(ids);
  if(!entries.length){toast('Nothing to report','err');return;}
  const modMap={}; MODULES.forEach(m=>modMap[m.module_key]=m);
  const blocks=entries.map(e=>{
    const mod=modMap[e.module]||{fields:[],label:e.module,icon:'📦'};
    const img=e.image_data_embedded?`<img src="${e.image_data_embedded}">`:'';
    let rows='';
    (mod.fields||[]).forEach(f=>{const v=e.attributes?e.attributes[f.key]:'';if(v)rows+=`<tr><th>${escH(f.label)}</th><td>${escH(String(v))}</td></tr>`;});
    return `<article><h2>${escH(e.name)} <small>${mod.icon} ${escH(mod.label)}</small></h2>
      ${e.summary?`<p class="sum">${escH(e.summary)}</p>`:''}
      <div class="row">${img}<table>${rows}</table></div></article>`;
  }).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>IPRPS Report</title>
    <style>
    body{font-family:Georgia,serif;color:#1a1526;margin:0;padding:32px;background:#fff}
    header.rp{border-bottom:3px double #7a5a1e;margin-bottom:24px;padding-bottom:10px}
    header.rp h1{margin:0;color:#3a2d5e}header.rp .m{color:#666;font-size:13px}
    article{page-break-inside:avoid;border:1px solid #d8d0e6;border-radius:10px;padding:16px 20px;margin-bottom:20px}
    article h2{margin:0 0 6px;color:#3a2d5e;font-size:20px}
    article h2 small{font-size:12px;color:#8a7fae;font-weight:normal}
    .sum{font-style:italic;color:#444;margin:0 0 12px}
    .row{display:flex;gap:18px;align-items:flex-start}
    .row img{max-width:220px;max-height:220px;object-fit:contain;border-radius:8px;border:1px solid #ddd}
    table{border-collapse:collapse;flex:1}
    th{text-align:left;color:#7a5a1e;font-size:11px;text-transform:uppercase;vertical-align:top;padding:4px 12px 4px 0;white-space:nowrap}
    td{padding:4px 0;font-size:14px;vertical-align:top}
    @media print{.noprint{display:none}article{border-color:#bbb}}
    .noprint{margin-bottom:20px}.noprint button{padding:10px 18px;font-size:14px;cursor:pointer}
    </style></head><body>
    <div class="noprint"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <header class="rp"><h1>✦ IPRPS Master Database — Report</h1>
      <div class="m">${entries.length} entr${entries.length===1?'y':'ies'} · generated ${new Date().toLocaleString()} · Infinite Plane Role Playing System</div></header>
    ${blocks}
    <footer style="margin-top:30px;color:#999;font-size:11px">© 2026 Mythical Legends Publishing, LLC · infiniteplane.space</footer>
    </body></html>`;
  const w=window.open('','_blank');
  w.document.write(html); w.document.close();
}
async function exportData(ids){
  const qs='?action=export'+(ids&&ids.length?'&ids='+ids.join(','):(CURRENT_MODULE?'&module='+encodeURIComponent(CURRENT_MODULE):''));
  const r=await fetch(API+qs);
  const blob=await r.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='iprps_master_export_'+new Date().toISOString().slice(0,10)+'.iprps';
  a.click(); URL.revokeObjectURL(url);
}

// ---- wiring ---------------------------------------------------------------
function wire(){
  let t; document.getElementById('search').oninput=()=>{clearTimeout(t);t=setTimeout(loadEntries,250);};
  document.getElementById('logoutBtn').onclick=()=>IPAuth.logout();
  document.getElementById('newBtn').onclick=newEntry;
  document.getElementById('selectBtn').onclick=()=>setSelect(true);
  document.getElementById('cancelSel').onclick=()=>setSelect(false);
  document.getElementById('reportBtn').onclick=()=>buildReport([...SELECTED]);
  document.getElementById('dataBtn').onclick=()=>exportData([...SELECTED]);
  document.getElementById('importBtn').onclick=openImport;
  document.getElementById('overlay').onclick=(e)=>{if(e.target.id==='overlay')closeModal();};
}
function setSelect(on){
  SELECT_MODE=on; document.body.classList.toggle('selecting',on);
  document.getElementById('selectBtn').style.display=on?'none':'';
  if(!on){SELECTED.clear();document.getElementById('selCount').textContent='0';renderGrid();}
}
async function openImport(){
  let seed={datasets:[]};
  try{ seed=await api('?action=seedList'); }catch(e){}
  const rows=seed.datasets.map(d=>`
    <div class="seedrow">
      <div><b>${esc(d.label||d.file)}</b><br><span style="font-size:12px;color:var(--muted)">→ ${esc(d.module)} ${d.available?'':'<span class="err">(file missing on server)</span>'}</span></div>
      <button class="btn" ${d.available?'':'disabled'} onclick="seedImport('${esc(d.file)}',this)">Import</button>
    </div>`).join('');
  const modOpts=MODULES.map(m=>`<option value="${m.module_key}">${esc(m.label)}</option>`).join('');
  document.getElementById('modal').innerHTML=`
    <div class="head"><h2>⭳ Import JSON</h2><span class="close" onclick="closeModal()">✕</span></div>
    <div class="content">
      <h3 style="margin:0 0 8px;color:var(--gold);font-size:14px">Starter datasets (bundled)</h3>
      ${rows||'<p style="color:var(--muted)">No bundled datasets found.</p>'}
      ${seed.datasets.length?`<button class="btn primary" style="margin-top:10px" onclick="seedImport('',this)">⭳ Import ALL starter datasets</button>`:''}
      <hr style="border:none;border-top:1px solid var(--edge);margin:20px 0">
      <h3 style="margin:0 0 8px;color:var(--gold);font-size:14px">Import your own JSON / .iprps file</h3>
      <label class="fld"><span>File a JSON array of records under this catalog</span>
        <select id="imp_module">${modOpts}</select></label>
      <label class="fld"><span>File</span><input type="file" id="imp_file" accept=".json,.iprps"></label>
      <button class="btn primary" onclick="fileImport(this)">Import file</button>
      <p style="font-size:12px;color:var(--muted);margin-top:12px">Duplicates (same catalog + name) are skipped, so re-importing is safe.</p>
    </div>`;
  showModal();
}
async function seedImport(file,btn){
  btn.disabled=true; const old=btn.textContent; btn.textContent='Importing…';
  const fd=new FormData(); fd.append('action','seedImport'); if(file) fd.append('file',file);
  try{ const j=await apiPost(fd); toast(j.message,'ok'); await loadModules(); await loadEntries(); }
  catch(e){toast(e.message,'err');}
  btn.disabled=false; btn.textContent=old;
}
async function fileImport(btn){
  const file=document.getElementById('imp_file').files[0];
  if(!file){toast('Choose a file first','err');return;}
  btn.disabled=true; const old=btn.textContent; btn.textContent='Importing…';
  const fd=new FormData(); fd.append('action','import'); fd.append('module',document.getElementById('imp_module').value); fd.append('file',file);
  try{ const j=await apiPost(fd); toast(j.message,'ok'); closeModal(); await loadModules(); await loadEntries(); }
  catch(e){toast(e.message,'err');}
  btn.disabled=false; btn.textContent=old;
}

// ---- utils ----------------------------------------------------------------
function showModal(){document.getElementById('overlay').classList.add('show');}
function closeModal(){document.getElementById('overlay').classList.remove('show');}
function toDataUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}
// Downscale/compress an image in the browser before upload so large photos
// (AI art is often several MB) fit well under server + POST size limits and
// load fast. Non-images or failures fall back to the raw data URL.
function processImage(file){
  return new Promise((resolve)=>{
    if(!file.type || !file.type.startsWith('image/')){ toDataUrl(file).then(resolve); return; }
    const r=new FileReader();
    r.onerror=()=>toDataUrl(file).then(resolve);
    r.onload=()=>{
      const im=new Image();
      im.onerror=()=>resolve(r.result);
      im.onload=()=>{
        const MAX=1400; let w=im.width, h=im.height;
        if(w>MAX||h>MAX){ const s=Math.min(MAX/w,MAX/h); w=Math.round(w*s); h=Math.round(h*s); }
        try{
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(im,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',0.85));
        }catch(e){ resolve(r.result); }
      };
      im.src=r.result;
    };
    r.readAsDataURL(file);
  });
}
// Append a version tag (the entry's updated_at) so the browser reloads a
// changed image instead of serving a stale/404-cached copy for the same URL.
function bust(url,ver){return url?url+'?v='+encodeURIComponent(ver||Date.now()):url;}
function toast(msg,kind){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show '+(kind||'');setTimeout(()=>t.className='toast',2600);}
function esc(s){return (s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function escAttr(s){return (s??'').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function escH(s){return (s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
</script>
</body>
</html>
