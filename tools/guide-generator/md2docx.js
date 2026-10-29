const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, ExternalHyperlink, TableOfContents, Footer, Header,
  PageNumber, PageBreak, ImageRun,
} = require('docx');
const path = require('path');

const src = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const OUT = process.argv[3];

const FONT = 'Calibri', MONO = 'Consolas';
const CONTENT_W = 12240 - 2 * 1260; // letter width minus 0.875" margins
const CALLOUT = {
  'Side note': { color: '2563EB', fill: 'EFF6FF' },
  'Pro tip': { color: '15803D', fill: 'F0FDF4' },
  'Warning': { color: 'B91C1C', fill: 'FEF2F2' },
  'Checkpoint': { color: '6D28D9', fill: 'F5F3FF' },
};

// ---------- inline parsing ----------
function inline(text, base = {}) {
  const runs = [];
  const re = /(`[^`]+`)|(\*\*(.+?)\*\*)|(\*([^*\s][^*]*?)\*)|(https?:\/\/[^\s)|]+)/;
  let rest = text;
  while (rest.length) {
    const m = rest.match(re);
    if (!m) { runs.push(new TextRun({ text: rest, ...base })); break; }
    if (m.index > 0) runs.push(new TextRun({ text: rest.slice(0, m.index), ...base }));
    if (m[1]) {
      runs.push(new TextRun({ text: m[1].slice(1, -1), ...base, font: MONO, size: (base.size || 21) - 2,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F5F9' } }));
    } else if (m[2]) {
      runs.push(...inline(m[3], { ...base, bold: true }));
    } else if (m[4]) {
      runs.push(...inline(m[5], { ...base, italics: true }));
    } else if (m[6]) {
      let url = m[6]; let trail = '';
      while (/[.,;:]$/.test(url)) { trail = url.slice(-1) + trail; url = url.slice(0, -1); }
      runs.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, ...base, style: 'Hyperlink' })] }));
      if (trail) runs.push(new TextRun({ text: trail, ...base }));
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return runs;
}

// ---------- block builders ----------
const children = [];
const P = (opts) => children.push(new Paragraph(opts));

function codeBlock(lines, isOutput) {
  const fill = isOutput ? 'FFFBEB' : 'F3F4F6';
  const bcol = isOutput ? 'F59E0B' : '94A3B8';
  lines.forEach((ln, i) => {
    const border = { left: { style: BorderStyle.SINGLE, size: 12, color: bcol, space: 6 } };
    children.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      border,
      indent: { left: 180, right: 120 },
      spacing: { before: 0, after: i === lines.length - 1 ? 160 : 0, line: 250 },
      keepLines: true, keepNext: i < lines.length - 1 && lines.length < 25,
      children: [new TextRun({ text: ln.length ? ln : ' ', font: MONO, size: 17 })],
    }));
  });
}

function callout(lines) {
  const first = lines[0];
  const m = first.match(/^\*\*(Side note|Pro tip|Warning|Checkpoint):\*\*\s*(.*)$/);
  const kind = m ? m[1] : 'Side note';
  const c = CALLOUT[kind];
  const border = { left: { style: BorderStyle.SINGLE, size: 24, color: c.color, space: 8 } };
  const mk = (runs, extra = {}) => new Paragraph({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: c.fill }, border,
    indent: { left: 240, right: 120 }, spacing: { before: 0, after: 0, line: 276 }, keepLines: true, ...extra,
    children: runs,
  });
  const out = [];
  const body = m ? m[2] : first;
  out.push(mk([new TextRun({ text: kind.toUpperCase() + '  ', bold: true, color: c.color, size: 19 }), ...inline(body, { size: 21 })],
    { spacing: { before: 60, after: 40, line: 276 } }));
  lines.slice(1).forEach((l) => {
    if (/^- /.test(l)) out.push(mk(inline(l.slice(2), { size: 21 }), { numbering: { reference: 'bullets-callout', level: 0 }, spacing: { after: 30 } }));
    else if (l.trim()) out.push(mk(inline(l, { size: 21 }), { spacing: { after: 40 } }));
  });
  // bottom padding
  const last = out.length - 1;
  out[last] = out[last]; // keep
  children.push(...out);
  children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
}

function table(rows) {
  const cells = rows.map((r) => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((x) => x.trim().replace(/\\\|/g, '|')));
  const ncol = cells[0].length;
  cells.forEach((r, k) => { while (r.length < ncol) r.push(''); if (r.length > ncol) cells[k] = r.slice(0, ncol - 1).concat([r.slice(ncol - 1).join(' | ')]); });
  const header = cells[0];
  const body = cells.slice(2);
  const n = header.length;
  // column widths proportional to max text length (bounded)
  const lens = header.map((_, i) => Math.min(45, Math.max(15, ...cells.filter((_, k) => k !== 1).map((r) => (r[i] || '').length))));
  const tot = lens.reduce((a, b) => a + b, 0);
  let widths = lens.map((l) => Math.floor((l / tot) * CONTENT_W));
  widths[n - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const mkRow = (r, isHead) => new TableRow({
    tableHeader: isHead, cantSplit: true,
    children: r.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA }, borders,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: isHead ? '1E3A5F' : 'FFFFFF' },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ spacing: { after: 0 }, children: inline(t, isHead ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19 }) })],
    })),
  });
  children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
    rows: [mkRow(header, true), ...body.map((r) => mkRow(r, false))] }));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
}

// ---------- main parse loop ----------
let i = 0, h2count = 0, titleDone = false, numInst = 0;
while (i < src.length) {
  const line = src[i];
  if (line.trimStart().startsWith('```')) {
    const ind = line.length - line.trimStart().length;
    const lang = line.trimStart().slice(3).trim();
    const strip = new RegExp('^ {0,' + ind + '}');
    const buf = []; i++;
    while (i < src.length && !src[i].trimStart().startsWith('```')) buf.push(src[i++].replace(strip, ''));
    i++; codeBlock(buf, lang === 'text'); continue;
  }
  if (line.startsWith('> ') || line === '>') {
    const buf = [];
    while (i < src.length && (src[i].startsWith('> ') || src[i] === '>')) buf.push(src[i++].replace(/^> ?/, ''));
    callout(buf); continue;
  }
  if (line.startsWith('|')) {
    const buf = [];
    while (i < src.length && src[i].startsWith('|')) buf.push(src[i++]);
    table(buf); continue;
  }
  if (line.startsWith('# ')) {
    P({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
      children: [new TextRun({ text: line.slice(2), bold: true, size: 52, color: '1E3A5F', font: FONT })] });
    i++; continue;
  }
  if (line.startsWith('## ')) {
    const t = line.slice(3);
    if (!titleDone) { // subtitle on cover page
      P({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [new TextRun({ text: t, size: 30, color: '475569', font: FONT })] });
      titleDone = true; i++; continue;
    }
    h2count++;
    P({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] });
    i++; continue;
  }
  if (line.startsWith('### ')) { P({ heading: HeadingLevel.HEADING_2, keepNext: true, children: inline(line.slice(4)) }); i++; continue; }
  if (line.trim() === '---') {
    if (h2count === 0 && titleDone && !children._tocAdded) {
      // after intro paragraph on cover: add TOC page
      children.push(new Paragraph({ children: [new PageBreak()] }));
      P({ spacing: { after: 200 }, children: [new TextRun({ text: 'Contents', bold: true, size: 34, color: '1E3A5F' })] });
      children.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));
      P({ spacing: { before: 120 }, children: [new TextRun({ text: 'If page numbers are missing, right-click the table and choose "Update Field" (in Word) or Tools > Update > Update All (in LibreOffice).', italics: true, size: 18, color: '64748B' })] });
      children._tocAdded = true;
    } else if (h2count > 0) {
      P({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 } }, spacing: { after: 120 }, children: [] });
    }
    i++; continue;
  }
  if (/^- \[ \] /.test(line)) { P({ numbering: { reference: 'checks', level: 0 }, spacing: { after: 60 }, children: inline(line.slice(6)) }); i++; continue; }
  if (/^- /.test(line)) { P({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 }, children: inline(line.slice(2)) }); i++; continue; }
  if (/^\d+\. /.test(line)) { if (/^1\. /.test(line)) numInst++; P({ numbering: { reference: 'numbers', level: 0, instance: numInst }, spacing: { after: 60 }, children: inline(line.replace(/^\d+\. /, '')) }); i++; continue; }
  // ![caption](image.png "w=4.5")  ->  a centered picture (PNG or JPEG), width in inches, with an italic caption
  const im = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"w=([\d.]+)")?\)\s*$/.exec(line);
  if (im) {
    const file = path.resolve(path.dirname(process.argv[2]), im[2]);
    const data = fs.readFileSync(file);
    let w, h;
    if (data[0] === 0x89) { w = data.readUInt32BE(16); h = data.readUInt32BE(20); }
    else { let o = 2; while (o < data.length) { const m = data[o + 1], len = data.readUInt16BE(o + 2); if (m >= 0xC0 && m <= 0xC3) { h = data.readUInt16BE(o + 5); w = data.readUInt16BE(o + 7); break; } o += 2 + len; } }
    const inch = Math.min(parseFloat(im[3] || '6.5'), 6.75), pw = Math.round(inch * 96), ph = Math.round(pw * h / w);
    P({ alignment: AlignmentType.CENTER, keepNext: !!im[1], spacing: { before: 120, after: im[1] ? 60 : 200, line: 240, lineRule: 'auto' },
        children: [new ImageRun({ type: data[0] === 0x89 ? 'png' : 'jpg', data, transformation: { width: pw, height: ph }, altText: { title: im[1] || 'Image', description: im[1] || 'Image', name: path.basename(file) } })] });
    if (im[1]) P({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: im[1], italics: true, size: 18, color: '64748B' })] });
    i++; continue;
  }
  if (line.trim() === '') { i++; continue; }
  // paragraph (join following non-empty plain lines)
  const buf = [line]; i++;
  while (i < src.length && src[i].trim() && !/^(\s*```|> |\||#|- |\d+\. |---)/.test(src[i])) buf.push(src[i++].trim());
  const txt = buf.join(' ');
  const isLead = /:$/.test(txt) && txt.length < 160;
  P({ spacing: { after: isLead ? 80 : 140 }, keepNext: isLead, children: inline(txt) });
}

const doc = new Document({
  creator: process.env.DOC_CREATOR || 'Mythical Legends Publishing, LLC',
  title: ((src.find(l => /^# /.test(l)) || '# Document').slice(2).trim()),
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line: 288 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, color: '1E3A5F', font: FONT },
        paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '2563EB', space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: '1E3A5F', font: FONT },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: 'bullets-callout', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 270 } } } }] },
      { reference: 'checks', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2610', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: process.argv[4] || 'LFS 13.1-systemd Companion Guide — Arch Linux Host', size: 16, color: '94A3B8' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Page ', size: 16, color: '94A3B8' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8' })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log('wrote', OUT, children.length, 'blocks'); });
