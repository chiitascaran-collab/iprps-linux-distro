// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// A small, safe Markdown renderer: escapes all HTML first, then adds headings, bold, italics,
// lists, rules, tables, code blocks and paragraphs. No links or images. (Based on the Oracle's.)
window.IPMarkdown = (() => {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/^([A-Z][A-Za-z -]{1,24}):(\s)/, '<strong>$1:</strong>$2');   // "Name: ..." fields
  function render(src) {
    const lines = String(src).replace(/\r/g, '').split('\n');
    let html = '', list = null, para = [], table = null, code = null;
    const flushPara = () => { if (para.length) { html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const closeTable = () => {
      if (!table) return;
      const rows = table.filter(r => !r.every(c => /^:?-{2,}:?$/.test(c)));
      html += '<table>' + rows.map((r, i) => '<tr>' + r.map(c => (i === 0 && table.length > 1 && table[1].every(x => /^:?-{2,}:?$/.test(x)) ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('') + '</tr>').join('') + '</table>';
      table = null;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
      if (code !== null) {
        if (/^\s*```/.test(line)) { html += `<pre><code>${esc(code.join('\n'))}</code></pre>`; code = null; } else code.push(raw);
        continue;
      }
      if (/^\s*```/.test(line)) { flushPara(); closeList(); closeTable(); code = []; continue; }
      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); closeList(); (table = table || []).push(cells(line)); continue; }
      closeTable();
      if (!line.trim()) { flushPara(); closeList(); continue; }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flushPara(); closeList();
        const n = Math.min(m[1].length + 1, 5);
        html += `<h${n}>${inline(m[2])}</h${n}>`; continue;
      }
      if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); closeList(); html += '<hr>'; continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        const kind = /^\s*\d/.test(line) ? 'ol' : 'ul';
        if (list !== kind) { closeList(); html += `<${kind}>`; list = kind; }
        html += `<li>${inline(m[1])}</li>`; continue;
      }
      closeList();
      para.push(line.trim());
    }
    if (code !== null) html += `<pre><code>${esc(code.join('\n'))}</code></pre>`;
    flushPara(); closeList(); closeTable();
    return html;
  }
  return { render };
})();
