// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// A small, safe Markdown renderer for AI replies: escapes all HTML first, then
// adds headings, bold, italics, lists, rules and paragraphs. No links or images.
window.IPMarkdown = (() => {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/^([A-Z][A-Za-z -]{1,24}):(\s)/, '<strong>$1:</strong>$2');   // "Name: ..." fields
  function render(src) {
    const lines = String(src).replace(/\r/g, '').split('\n');
    let html = '', list = null, para = [];
    const flushPara = () => { if (para.length) { html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
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
    flushPara(); closeList();
    return html;
  }
  return { render };
})();
