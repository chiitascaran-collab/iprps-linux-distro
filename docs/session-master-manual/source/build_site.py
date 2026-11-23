#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Builds the website edition of the Session Master Training Manual (index.html) from the Markdown.

    python3 docs/session-master-manual/source/build_site.py          # rewrites index.html
    python3 docs/session-master-manual/source/build_site.py --check  # only says whether index.html is up to date

The page's look (header, hero, fact strip, styles, footer and script) is kept from the current index.html; only
the contents list and the chapters between <div class="layout"> and </main> are rebuilt. So edit the Markdown,
run this, and upload the folder. Needs Python 3 and python-markdown (Debian: python3-markdown).

What it does with the Markdown:
- the title, subtitle and cover picture before the first "## " heading, and the closing credits line after the
  last "---", are skipped (the hero and the footer show them);
- each "## " heading is a chapter (<section class="chapter">) and a line in the contents; "Chapter 3: Prepare"
  shows as 3 · Prepare there;
- headings get ids and # links; tables scroll on phones;
- ![caption](images/x.jpg "w=6.3") becomes a figure: wide from 6 inches, medium from 3.5, narrow below;
- quote boxes become boxes: "**Walkthrough 1: Title**", "**Tip:**" and "**Try it:**", each its own box (even when
  only a blank line separates two of them, which plain Markdown would join into one).
"""
import html, os, re, sys
import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.dirname(HERE)
MD = os.path.join(DIR, 'IPRPS-OS-Session-Master-Training-Manual.md')
OUT = os.path.join(DIR, 'index.html')


def slug(text):
    t = html.unescape(re.sub(r'<[^>]+>', '', text)).lower()
    t = re.sub(r'[^\w\s-]', '', t)
    return re.sub(r'[\s]+', '-', t.strip())


def anchor(level, inner):
    i = slug(inner)
    return f'<h{level} id="{i}">{inner}<a class="anchor" href="#{i}" aria-label="Link to this section">#</a></h{level}>'


def figure(m):
    alt, src, w = m.group(1), m.group(2), float(m.group(3) or 6.5)
    size = 'wide' if w >= 6 else 'medium' if w >= 3.5 else 'narrow'
    a = html.escape(html.unescape(alt), quote=True)
    return (f'<figure class="{size}"><a href="{src}" target="_blank" rel="noopener"><img src="{src}" alt="{a}" loading="lazy" decoding="async"></a>'
            f'<figcaption>{a}</figcaption></figure>')


def box(m):
    body = m.group(1).strip('\n')
    w = re.match(r'<p><strong>Walkthrough (\d+): (.*?)</strong></p>', body)
    if w:
        return f'<aside class="box walk"><span class="box-label">Walkthrough {w.group(1)}</span>\n<p><strong class="wt">{w.group(2)}</strong></p>' + body[w.end():] + '\n</aside>'
    for label, cls in (('Tip', 'tip'), ('Try it', 'try')):
        if body.startswith(f'<p><strong>{label}:</strong> '):
            return f'<aside class="box {cls}"><span class="box-label">{label}</span>\n<p>' + body[len(f'<p><strong>{label}:</strong> '):] + '\n</aside>'
    return f'<aside class="box">\n{body}\n</aside>'


def chapter(md_text, last=False):
    # Markdown joins quote boxes that only a blank line separates: keep each Walkthrough, Tip and Try it its own box
    md_text = re.sub(r'(?m)^(>[^\n]*\n)\n(?=> \*\*(?:Walkthrough \d+:|Tip:|Try it:))', '\\1\n<!-- box -->\n\n', md_text)
    h = markdown.markdown(md_text, extensions=['tables'], output_format='html')
    h = h.replace('<!-- box -->\n', '')
    h = re.sub(r'<p><img alt="([^"]*)" src="([^"]+)"(?: title="w=([\d.]+)")? ?/?></p>', figure, h)
    h = re.sub(r'<h([23])>(.*?)</h\1>', lambda m: anchor(int(m.group(1)), m.group(2)), h)
    h = h.replace('<table>', '<div class="table-scroll" tabindex="0"><table>').replace('</table>', '</table></div>')
    h = re.sub(r'<blockquote>\n(.*?)\n</blockquote>', box, h, flags=re.S)
    h = h.replace('&quot;', '"')
    return '<section class="chapter">' + h + ('' if last else '\n') + '</section>'


def toc(heads):
    items = []
    for title in heads:
        m = re.match(r'Chapter (\d+): (.*)', title)
        num, text = (m.group(1), m.group(2)) if m else ('·', title)
        items.append(f'<li><a href="#{slug(title)}"><span class="num">{num}</span>{html.escape(text, quote=False)}</a></li>')
    return '<ol>' + '\n'.join(items) + '</ol>'


def build():
    src = open(MD, encoding='utf-8').read()
    body = src[src.index('\n## ') + 1:]
    body = re.sub(r'\n---\n+\*[^\n]*\*\s*$', '\n', body)   # the closing credits line: the page has it in its footer
    parts = re.split(r'(?m)^(?=## )', body)
    parts = [p for p in parts if p.strip()]
    heads = [p.splitlines()[0][3:].strip() for p in parts]
    page = open(OUT, encoding='utf-8').read()
    start = page.index('<div class="layout">')
    end = page.index('  </main>\n</div>')
    t = toc(heads)
    mid = ('<div class="layout">\n'
           f'  <nav class="toc" aria-label="Chapters"><h2>Contents</h2>{t}</nav>\n'
           '  <main>\n'
           f'    <details class="toc-m"><summary>Contents</summary><nav class="toc" aria-label="Chapters">{t}</nav></details>\n'
           '    ' + '\n'.join(chapter(p, last=i == len(parts) - 1) for i, p in enumerate(parts)) + '\n')
    return page[:start] + mid + page[end:], page


if __name__ == '__main__':
    new, old = build()
    if '--check' in sys.argv:
        print('index.html is up to date.' if new == old else 'index.html is out of date: run build_site.py.')
        sys.exit(0 if new == old else 1)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(new)
    print('Wrote', OUT)
