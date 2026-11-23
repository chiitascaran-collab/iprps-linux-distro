# IPRPS OS Session Master Training Manual

A training guide for Session Masters using IPRPS OS, at an 8th-grade reading level, with eight step-by-step walkthroughs. It covers what makes IPRPS OS different from online tabletops such as Roll20, Owlbear Rodeo, Alchemy RPG, Fantasy Grounds and D&D Beyond; setting up a campaign; preparing a session; making maps with Map Maker; the IPRPS Table; IPRPS rolls and bands; the Combat Tracker; the Soundboard; the IPRPS Oracle; the Session Log and recap; updates; and remote players.

| File | What it is |
| --- | --- |
| [`IPRPS-OS-Session-Master-Training-Manual.md`](IPRPS-OS-Session-Master-Training-Manual.md) | The manual (source text; reads well on GitHub) |
| [`IPRPS-OS-Session-Master-Training-Manual.pdf`](IPRPS-OS-Session-Master-Training-Manual.pdf) | Print and share (39 pages) |
| [`IPRPS-OS-Session-Master-Training-Manual.docx`](IPRPS-OS-Session-Master-Training-Manual.docx) | Word, for editing |
| `index.html`, `assets/` | The website edition |
| `images/` | Screenshots and diagrams, used by all editions |
| `source/diagrams.html` | Source of the four diagrams (open in a browser; each diagram is one box) |
| `source/build_site.py` | Rebuilds the website's chapters in `index.html` from the Markdown |

**After changing the manual:** edit the `.md` file only, then rebuild the other three editions from the repository's top folder:

```bash
python3 docs/session-master-manual/source/build_site.py
cd docs/session-master-manual
node ../../tools/guide-generator/md2docx.js IPRPS-OS-Session-Master-Training-Manual.md IPRPS-OS-Session-Master-Training-Manual.docx "IPRPS OS Session Master Training Manual"
soffice --headless --convert-to pdf IPRPS-OS-Session-Master-Training-Manual.docx
```

`build_site.py` needs `python3-markdown`; `md2docx.js` needs Node.js and the `docx` package (`npm install docx`); the PDF needs LibreOffice. `build_site.py --check` says whether `index.html` matches the Markdown. It keeps the page's header, hero, styles and footer as they are, so change those in `index.html` itself. Look through the PDF after a big change: LibreOffice can drop the rows of a table that starts on the last line of a page; moving or resizing a picture just before it fixes that.

**Publish the website:** upload this whole folder to the web server (for example to `infiniteplane.space/iprps-os/manual/`). `index.html` is the page; its **Download PDF** and **Download Word** buttons use the two files in this folder. Nothing else is needed: no server code, no outside fonts or scripts.

Screenshots show IPRPS OS 1.0 with an example campaign, *Iron City Blues*. Third-party names are trademarks of their owners and are used only for comparison; their features and prices change.
