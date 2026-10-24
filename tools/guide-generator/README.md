# IPRPS guide generator

These scripts produce `docs/IPRPS-OS-Distribution-Build-Guide.md` (and the `.docx`) from the **BLFS 13.1 (systemd) book source** plus the hand-written IPRPS chapters in `iprps_template.md`.

| File | Role |
|---|---|
| `fetch_blfs.sh` | Downloads the BLFS book source (tag `r13.1`) and resolves it to `blfs-full.xml` |
| `blfsgraph.py` | Builds the package dependency graph (required / recommended / runtime) from the book |
| `stages.py` | Defines the edition stages A–I, computes a safe build order, and **fails if a required dependency is missing** |
| `blfs_sections.py` | Renders each package: downloads, MD5, labeled commands, optional/example markers, IPRPS release overrides |
| `label_blocks.py` | Labels hand-written command blocks with their window ([DEBIAN ROOT], [IPRPS CHROOT], [BUILDER], ...) |
| `build_iprps.py` | Assembles the final guide, including per-checkpoint snapshot steps |
| `md2docx.js` | Markdown to Word conversion (needs Node.js and the `docx` npm package) |

The scripts expect to run in `/home/claude` (paths are set at the top of each file); adjust them for your machine.

```bash
bash fetch_blfs.sh r13.1 13.1        # also needs the LFS book resolved for LFS package names
python3 blfsgraph.py
python3 stages.py                    # prints stage sizes; must report no missing deps / violations
python3 build_iprps.py <output.md>
node md2docx.js <output.md> <output.docx> "IPRPS OS — Distribution Build Guide"
```

**Release overrides** (in `blfs_sections.py`): FFmpeg without non-free options, Mesa without patented codecs, Firefox without official branding or the BLFS API key, libaio from Debian's archive, CrackLib with a fixed hostname.
