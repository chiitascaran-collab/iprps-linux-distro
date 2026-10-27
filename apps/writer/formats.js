// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Writer - document model, ZIP, and .docx / .odt / .txt / .html conversion. No libraries.
//
// Model: an array of blocks
//   { type: 'p'|'h1'|'h2'|'h3'|'quote'|'li', list?: 'ul'|'ol', listId?: n, align?: 'left'|'center'|'right'|'justify',
//     runs: [{ text, b, i, u, s } | { br: true }] }
window.WFormats = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const htmlEsc = xmlEsc;

  // ---------------------------------------------------------------- HTML <-> model
  const BLOCK = { P: 'p', DIV: 'p', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3', BLOCKQUOTE: 'quote', PRE: 'p' };
  function alignOf(el) {
    const a = (el.style && el.style.textAlign) || el.getAttribute && el.getAttribute('align') || '';
    return { center: 'center', right: 'right', end: 'right', justify: 'justify' }[a] || undefined;
  }
  function htmlToBlocks(root) {
    const blocks = [];
    let listCounter = 0;
    function inline(node, fmt, runs) {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) {
          const t = n.nodeValue.replace(/[\r\n]+/g, ' ');
          if (t) runs.push({ text: t, ...fmt });
        } else if (n.nodeType === 1) {
          const tag = n.tagName;
          if (tag === 'BR') { runs.push({ br: true }); continue; }
          if (/^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT|HEAD|TITLE|META)$/.test(tag)) continue;
          const f = { ...fmt };
          const st = n.style || {};
          if (tag === 'B' || tag === 'STRONG' || /^(bold|[6-9]00)$/.test(st.fontWeight || '')) f.b = true;
          if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') f.i = true;
          if (tag === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) f.u = true;
          if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /line-through/.test(st.textDecoration || st.textDecorationLine || '')) f.s = true;
          inline(n, f, runs);
        }
      }
    }
    function trimRuns(runs) {
      while (runs.length && runs[runs.length - 1].br) runs.pop();
      return runs;
    }
    function walk(node, ctx) {
      let pending = [];
      const flush = () => { if (pending.some(r => r.br || r.text.trim())) blocks.push({ type: ctx.type || 'p', align: ctx.align, runs: trimRuns(pending), list: ctx.list, listId: ctx.listId }); pending = []; };
      for (const n of node.childNodes) {
        if (n.nodeType === 3 || (n.nodeType === 1 && !BLOCK[n.tagName] && !/^(UL|OL|LI|TABLE|TBODY|THEAD|TR|TD|TH|SECTION|ARTICLE|HEADER|FOOTER|MAIN|BODY|HTML)$/.test(n.tagName))) {
          const wrap = document.createElement('span'); wrap.appendChild(n.cloneNode(true));
          inline(wrap, {}, pending);
          continue;
        }
        if (n.nodeType !== 1) continue;
        flush();
        const tag = n.tagName;
        if (tag === 'UL' || tag === 'OL') {
          const id = ++listCounter;
          for (const li of n.children) {
            if (li.tagName !== 'LI') continue;
            const runs = [];
            // text of the item, without nested lists; nested lists follow as items of their own
            const clone = li.cloneNode(true);
            clone.querySelectorAll('ul,ol').forEach(x => x.remove());
            inline(clone, {}, runs);
            blocks.push({ type: 'li', list: tag === 'OL' ? 'ol' : 'ul', listId: id, align: alignOf(li), runs: trimRuns(runs) });
            li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => walk({ childNodes: [sub] }, {}));
          }
        } else if (BLOCK[tag]) {
          if (!n.childNodes.length) continue;   // empty leftovers of browser editing (a blank line has a <br>)
          const hasBlocks = [...n.children].some(c => BLOCK[c.tagName] || c.tagName === 'UL' || c.tagName === 'OL');
          const type = ctx.type === 'quote' && BLOCK[tag] === 'p' ? 'quote' : BLOCK[tag];
          if (hasBlocks) walk(n, { type: type === 'quote' ? 'quote' : undefined, align: alignOf(n) });
          else { const runs = []; inline(n, {}, runs); blocks.push({ type, align: alignOf(n), runs: trimRuns(runs) }); }
        } else {
          walk(n, ctx);                     // tables, sections, body...: their contents in order
        }
      }
      flush();
    }
    walk(root, {});
    return blocks;
  }

  function runsToHtml(runs) {
    return runs.map(r => {
      if (r.br) return '<br>';
      let h = htmlEsc(r.text);
      if (r.s) h = `<s>${h}</s>`;
      if (r.u) h = `<u>${h}</u>`;
      if (r.i) h = `<em>${h}</em>`;
      if (r.b) h = `<strong>${h}</strong>`;
      return h;
    }).join('') || '<br>';
  }
  function blocksToHtml(blocks) {
    let html = '', open = null;
    for (const b of blocks) {
      const st = b.align && b.align !== 'left' ? ` style="text-align:${b.align}"` : '';
      if (b.type === 'li') {
        const key = b.list + ':' + b.listId;
        if (open !== key) { if (open) html += `</${open.split(':')[0]}>`; html += `<${b.list}>`; open = key; }
        html += `<li${st}>${runsToHtml(b.runs)}</li>`;
        continue;
      }
      if (open) { html += `</${open.split(':')[0]}>`; open = null; }
      const tag = b.type === 'quote' ? 'blockquote' : b.type;
      html += `<${tag}${st}>${runsToHtml(b.runs)}</${tag}>`;
    }
    if (open) html += `</${open.split(':')[0]}>`;
    return html || '<p><br></p>';
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    return blocksToHtml(htmlToBlocks(doc.body));
  }
  const plain = runs => runs.map(r => r.br ? '\n' : r.text).join('');

  // ---------------------------------------------------------------- ZIP (store) writer and reader
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {                       // files: [[name, string|Uint8Array]], stored (no compression)
    const parts = [], central = []; let offset = 0;
    const now = new Date(), dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
      ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const [name, content] of files) {
      const data = typeof content === 'string' ? enc.encode(content) : content, nm = enc.encode(name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dtime, true); h.setUint16(12, ddate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, dtime, true); c.setUint16(14, ddate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), nm);
      offset += 30 + nm.length + data.length;
    }
    const csize = central.reduce((a, p) => a + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)]);
  }
  async function unzip(buf) {                 // -> { name: Uint8Array }
    const d = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (d.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This file is not a valid document (no ZIP directory).');
    const count = d.getUint16(eocd + 10, true); let p = d.getUint32(eocd + 16, true);
    const out = {};
    for (let k = 0; k < count; k++) {
      if (d.getUint32(p, true) !== 0x02014b50) break;
      const method = d.getUint16(p + 10, true), csize = d.getUint32(p + 20, true),
        nlen = d.getUint16(p + 28, true), xlen = d.getUint16(p + 30, true), clen = d.getUint16(p + 32, true), loff = d.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      const start = loff + 30 + d.getUint16(loff + 26, true) + d.getUint16(loff + 28, true);
      const raw = u8.subarray(start, start + csize);
      if (method === 0) out[name] = raw;
      else if (method === 8) out[name] = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }

  // ---------------------------------------------------------------- DOCX
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  function toDocx(blocks, title) {
    const olNums = {}; let nextNum = 2;
    for (const b of blocks) if (b.type === 'li' && b.list === 'ol' && !olNums[b.listId]) olNums[b.listId] = nextNum++;
    const runXml = r => {
      if (r.br) return '<w:r><w:br/></w:r>';
      const pr = (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '') + (r.u ? '<w:u w:val="single"/>' : '') + (r.s ? '<w:strike/>' : '');
      return r.text.split('\t').map((t, i) => (i ? `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:tab/></w:r>` : '') +
        (t ? `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>` : '')).join('');
    };
    const styleOf = { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', quote: 'Quote', li: 'ListParagraph' };
    const body = blocks.map(b => {
      let ppr = styleOf[b.type] ? `<w:pStyle w:val="${styleOf[b.type]}"/>` : '';
      if (b.type === 'li') ppr += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${b.list === 'ol' ? olNums[b.listId] : 1}"/></w:numPr>`;
      if (b.align && b.align !== 'left') ppr += `<w:jc w:val="${b.align === 'justify' ? 'both' : b.align}"/>`;
      return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${b.runs.map(runXml).join('')}</w:p>`;
    }).join('');
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const hstyle = (id, name, size, lvl) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${lvl}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Liberation Serif" w:hAnsi="Liberation Serif" w:cs="Liberation Serif"/><w:sz w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${hstyle('Heading1', 'heading 1', 40, 0)}${hstyle('Heading2', 'heading 2', 32, 1)}${hstyle('Heading3', 'heading 3', 28, 2)}
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/></w:pPr></w:style></w:styles>`;
    const absNum = (id, fmt, text) => `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>`;
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}">${absNum(0, 'bullet', '•')}${absNum(1, 'decimal', '%1.')}<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${Object.values(olNums).map(n => `<w:num w:numId="${n}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')}</w:numbering>`;
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(title || '')}</dc:title><dc:creator>IPRPS Writer</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`;
    return zip([
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
      ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`],
      ['word/document.xml', document], ['word/styles.xml', styles], ['word/numbering.xml', numbering], ['docProps/core.xml', core],
    ]);
  }

  async function fromDocx(buf) {
    const files = await unzip(buf);
    if (!files['word/document.xml']) throw new Error('This .docx has no document inside.');
    const parse = n => files[n] ? new DOMParser().parseFromString(dec.decode(files[n]), 'application/xml') : null;
    const doc = parse('word/document.xml'), numDoc = parse('word/numbering.xml');
    const kids = (el, name) => [...el.childNodes].filter(c => c.localName === name);
    const val = el => el && (el.getAttributeNS(W, 'val') || el.getAttribute('w:val'));
    const on = el => !!el && !/^(0|false|none)$/.test(val(el) || '');
    // numId -> 'ol' | 'ul'
    const numFmt = {};
    if (numDoc) {
      const absFmt = {};
      for (const a of numDoc.getElementsByTagNameNS(W, 'abstractNum')) {
        const lvl = a.getElementsByTagNameNS(W, 'lvl')[0];
        const f = lvl && val(lvl.getElementsByTagNameNS(W, 'numFmt')[0]);
        absFmt[a.getAttributeNS(W, 'abstractNumId') || a.getAttribute('w:abstractNumId')] = f;
      }
      for (const n of numDoc.getElementsByTagNameNS(W, 'num')) {
        const abs = val(n.getElementsByTagNameNS(W, 'abstractNumId')[0]);
        numFmt[n.getAttributeNS(W, 'numId') || n.getAttribute('w:numId')] = absFmt[abs] && absFmt[abs] !== 'bullet' ? 'ol' : 'ul';
      }
    }
    const blocks = []; let lastNum = null, listId = 0;
    for (const p of doc.getElementsByTagNameNS(W, 'p')) {
      const ppr = kids(p, 'pPr')[0];
      const style = ppr && val(kids(ppr, 'pStyle')[0]) || '';
      const numPr = ppr && kids(ppr, 'numPr')[0];
      const jc = ppr && val(kids(ppr, 'jc')[0]);
      const runs = [];
      for (const r of p.getElementsByTagNameNS(W, 'r')) {
        const rpr = kids(r, 'rPr')[0];
        const fmt = rpr ? { b: on(kids(rpr, 'b')[0]), i: on(kids(rpr, 'i')[0]), u: on(kids(rpr, 'u')[0]), s: on(kids(rpr, 'strike')[0]) } : {};
        for (const c of r.childNodes) {
          if (c.localName === 't') runs.push({ text: c.textContent, ...fmt });
          else if (c.localName === 'tab') runs.push({ text: '\t', ...fmt });
          else if (c.localName === 'br' || c.localName === 'cr') runs.push({ br: true });
        }
      }
      const b = { runs, align: { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' }[jc] };
      const sl = style.toLowerCase().replace(/\s/g, '');
      if (numPr) {
        const numId = val(kids(numPr, 'numId')[0]);
        if (numId !== lastNum) { listId++; lastNum = numId; }
        Object.assign(b, { type: 'li', list: numFmt[numId] || 'ul', listId });
      } else {
        lastNum = null;
        b.type = /^(heading1|title)$/.test(sl) ? 'h1' : sl === 'heading2' || sl === 'subtitle' ? 'h2' : /^heading[3-9]$/.test(sl) ? 'h3' : /quote/.test(sl) ? 'quote' : 'p';
      }
      blocks.push(b);
    }
    return blocks;
  }

  // ---------------------------------------------------------------- ODT
  const NS = {
    office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
    text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0', fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  };
  const nsDecl = Object.entries(NS).map(([k, v]) => `xmlns:${k}="${v}"`).join(' ');
  function odtText(s) {
    return xmlEsc(s).replace(/\t/g, '<text:tab/>').replace(/ {2,}/g, m => ' ' + `<text:s text:c="${m.length - 1}"/>`).replace(/^ /, '<text:s/>');
  }
  function toOdt(blocks, title) {
    const tStyles = {}, pStyles = {};
    const tName = r => { const k = (r.b ? 'B' : '') + (r.i ? 'I' : '') + (r.u ? 'U' : '') + (r.s ? 'S' : ''); if (!k) return null; tStyles[k] = 'T' + k; return 'T' + k; };
    const parentOf = { p: 'Standard', h1: 'Heading_20_1', h2: 'Heading_20_2', h3: 'Heading_20_3', quote: 'Quotations', li: 'Standard' };
    const pName = b => {
      const parent = parentOf[b.type];
      if (!b.align || b.align === 'left') return parent;
      const k = `${parent}_${b.align}`; pStyles[k] = { parent, align: { center: 'center', right: 'end', justify: 'justify' }[b.align] }; return 'P_' + k;
    };
    const runs = rs => rs.map(r => r.br ? '<text:line-break/>' : (n => n ? `<text:span text:style-name="${n}">${odtText(r.text)}</text:span>` : odtText(r.text))(tName(r))).join('');
    let body = '', open = null;
    for (const b of blocks) {
      if (b.type === 'li') {
        const key = b.list + ':' + b.listId;
        if (open !== key) { if (open) body += '</text:list>'; body += `<text:list text:style-name="${b.list === 'ol' ? 'L2' : 'L1'}">`; open = key; }
        body += `<text:list-item><text:p text:style-name="${pName(b)}">${runs(b.runs)}</text:p></text:list-item>`;
        continue;
      }
      if (open) { body += '</text:list>'; open = null; }
      const lvl = { h1: 1, h2: 2, h3: 3 }[b.type];
      body += lvl ? `<text:h text:style-name="${pName(b)}" text:outline-level="${lvl}">${runs(b.runs)}</text:h>`
                  : `<text:p text:style-name="${pName(b)}">${runs(b.runs)}</text:p>`;
    }
    if (open) body += '</text:list>';
    const auto = Object.entries(tStyles).map(([k, n]) => `<style:style style:name="${n}" style:family="text"><style:text-properties${k.includes('B') ? ' fo:font-weight="bold"' : ''}${k.includes('I') ? ' fo:font-style="italic"' : ''}${k.includes('U') ? ' style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"' : ''}${k.includes('S') ? ' style:text-line-through-style="solid"' : ''}/></style:style>`).join('')
      + Object.entries(pStyles).map(([k, v]) => `<style:style style:name="P_${k}" style:family="paragraph" style:parent-style-name="${v.parent}"><style:paragraph-properties fo:text-align="${v.align}"/></style:style>`).join('')
      + `<text:list-style style:name="L1"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="0.5in" fo:text-indent="-0.25in" fo:margin-left="0.5in"/></style:list-level-properties></text:list-level-style-bullet></text:list-style>`
      + `<text:list-style style:name="L2"><text:list-level-style-number text:level="1" style:num-suffix="." style:num-format="1"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="0.5in" fo:text-indent="-0.25in" fo:margin-left="0.5in"/></style:list-level-properties></text:list-level-style-number></text:list-style>`;
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${nsDecl} office:version="1.3"><office:automatic-styles>${auto}</office:automatic-styles><office:body><office:text>${body}</office:text></office:body></office:document-content>`;
    const head = (n, d, size) => `<style:style style:name="Heading_20_${n}" style:display-name="Heading ${n}" style:family="paragraph" style:parent-style-name="Heading" style:next-style-name="Standard" style:default-outline-level="${n}"><style:text-properties fo:font-size="${size}pt" fo:font-weight="bold"/></style:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${nsDecl} office:version="1.3"><office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.08in"/><style:text-properties style:font-name="Liberation Serif" fo:font-family="'Liberation Serif'" fo:font-size="12pt"/></style:default-style><style:style style:name="Standard" style:family="paragraph"/><style:style style:name="Heading" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard"><style:paragraph-properties fo:margin-top="0.17in" fo:margin-bottom="0.08in" fo:keep-with-next="always"/></style:style>${head(1, 0, 20)}${head(2, 0, 16)}${head(3, 0, 14)}<style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="0.4in" fo:margin-right="0.4in"/><style:text-properties fo:font-style="italic"/></style:style></office:styles><office:master-styles><style:master-page style:name="Standard"/></office:master-styles></office:document-styles>`;
    const meta = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="${NS.office}" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta><dc:title>${xmlEsc(title || '')}</dc:title><meta:generator>IPRPS Writer</meta:generator></office:meta></office:document-meta>`;
    return zip([
      ['mimetype', 'application/vnd.oasis.opendocument.text'],
      ['META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`],
      ['content.xml', content], ['styles.xml', styles], ['meta.xml', meta],
    ]);
  }

  async function fromOdt(buf) {
    const files = await unzip(buf);
    if (!files['content.xml']) throw new Error('This .odt has no content inside.');
    const doc = new DOMParser().parseFromString(dec.decode(files['content.xml']), 'application/xml');
    const attr = (el, ns, n) => el.getAttributeNS(NS[ns], n) || el.getAttribute(`${ns}:${n}`) || '';
    const tfmt = {}, palign = {}, pparent = {}, listKind = {};
    for (const s of doc.getElementsByTagNameNS(NS.style, 'style')) {
      const name = attr(s, 'style', 'name');
      pparent[name] = attr(s, 'style', 'parent-style-name');
      const tp = s.getElementsByTagNameNS(NS.style, 'text-properties')[0];
      if (tp) tfmt[name] = {
        b: attr(tp, 'fo', 'font-weight') === 'bold' || +attr(tp, 'fo', 'font-weight') >= 600,
        i: attr(tp, 'fo', 'font-style') === 'italic',
        u: !!attr(tp, 'style', 'text-underline-style') && attr(tp, 'style', 'text-underline-style') !== 'none',
        s: !!attr(tp, 'style', 'text-line-through-style') && attr(tp, 'style', 'text-line-through-style') !== 'none',
      };
      const pp = s.getElementsByTagNameNS(NS.style, 'paragraph-properties')[0];
      if (pp) palign[name] = { center: 'center', end: 'right', right: 'right', justify: 'justify' }[attr(pp, 'fo', 'text-align')];
    }
    for (const l of doc.getElementsByTagNameNS(NS.text, 'list-style'))
      listKind[attr(l, 'style', 'name')] = l.getElementsByTagNameNS(NS.text, 'list-level-style-number').length ? 'ol' : 'ul';
    function runsOf(el, fmt, runs) {
      for (const c of el.childNodes) {
        if (c.nodeType === 3) { if (c.nodeValue) runs.push({ text: c.nodeValue, ...fmt }); continue; }
        if (c.nodeType !== 1) continue;
        const ln = c.localName;
        if (ln === 's') runs.push({ text: ' '.repeat(+attr(c, 'text', 'c') || 1), ...fmt });
        else if (ln === 'tab') runs.push({ text: '\t', ...fmt });
        else if (ln === 'line-break') runs.push({ br: true });
        else if (ln === 'note' || ln === 'annotation') continue;
        else { const f = { ...fmt, ...Object.fromEntries(Object.entries(tfmt[attr(c, 'text', 'style-name')] || {}).filter(([, v]) => v)) }; runsOf(c, f, runs); }
      }
      return runs;
    }
    const blocks = []; let listId = 0;
    function walk(el, list) {
      for (const c of el.childNodes) {
        if (c.nodeType !== 1) continue;
        const ln = c.localName, sn = attr(c, 'text', 'style-name');
        if (ln === 'p' || ln === 'h') {
          const parent = pparent[sn] || sn;
          const level = ln === 'h' ? (+attr(c, 'text', 'outline-level') || 1) : 0;
          const type = list ? 'li' : level ? (level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3') : /Quotation/.test(parent) ? 'quote' : /^Title$/.test(parent) ? 'h1' : 'p';
          blocks.push({ type, list: list && list.kind, listId: list && list.id, align: palign[sn], runs: runsOf(c, tfmt[sn] ? Object.fromEntries(Object.entries(tfmt[sn]).filter(([, v]) => v)) : {}, []) });
        } else if (ln === 'list') {
          walk(c, list || { kind: listKind[sn] || 'ul', id: ++listId });
        } else if (['list-item', 'list-header', 'section', 'table', 'table-row', 'table-cell', 'table-header-rows', 'text'].includes(ln)) {
          walk(c, list);
        }
      }
    }
    const text = doc.getElementsByTagNameNS(NS.office, 'text')[0];
    if (text) walk(text, null);
    return blocks;
  }

  // ---------------------------------------------------------------- text and HTML
  function toText(blocks) {
    const nums = {};
    return blocks.map(b => {
      const t = plain(b.runs);
      if (b.type === 'li') return (b.list === 'ol' ? `${nums[b.listId] = (nums[b.listId] || 0) + 1}. ` : '• ') + t;
      if (b.type === 'h1') return t.toUpperCase();
      return t;
    }).join('\n\n') + '\n';
  }
  function fromText(s) {
    return s.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(par => ({
      type: 'p', runs: par.split('\n').flatMap((line, i) => i ? [{ br: true }, { text: line }] : [{ text: line }]).filter(r => r.br || r.text),
    })).filter(b => b.runs.length);
  }
  function toHtmlFile(blocks, title) {
    return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>${htmlEsc(title || 'Document')}</title>
<style>body{font:12pt/1.5 "Liberation Serif",Georgia,serif;max-width:46em;margin:2em auto;padding:0 1em}blockquote{font-style:italic;margin:1em 2.5em}</style></head>
<body>${blocksToHtml(blocks)}</body></html>\n`;
  }
  function fromHtmlFile(s) { return htmlToBlocks(new DOMParser().parseFromString(s, 'text/html').body); }

  return { htmlToBlocks, blocksToHtml, sanitize, toDocx, fromDocx, toOdt, fromOdt, toText, fromText, toHtmlFile, fromHtmlFile, zip, unzip };
})();
