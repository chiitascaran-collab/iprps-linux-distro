# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
import json, re, sys
sys.path.insert(0, '/home/claude')
import blfs_sections as B

st = json.load(open('/home/claude/stages.json'))['stages']
units = json.load(open('/home/claude/blfs_units.json'))
ksyms = json.load(open('/home/claude/kernel_syms.json'))
built = {p for c, n, o in st for p in o} | {'shadow', 'systemd', 'initramfs'}
STAGE = {c: (n, o) for c, n, o in st}

INTRO = {
 'A': ('Security and administration basics every edition needs: Linux-PAM (login security), **sudo**, certificates (make-ca), '
       'download tools (Wget, cURL), Git, OpenSSH, Polkit, disk tools, and the build tools later stages need (CMake, LLVM, Rust).',
       '> **Warning:** **LLVM** and **Rust** are among the heaviest builds in this guide. Use the job limits from 0.3, and add `-D LLVM_PARALLEL_LINK_JOBS=1` to LLVM\'s `cmake` command.\n\n'
       '> **Side note:** The first seven packages (up to and including **Wget**) download with `~/fetch`; their download commands already say so. After installing **Linux-PAM**, BLFS asks you to **rebuild Shadow and systemd** so they use it; those two rebuilds follow right after Linux-PAM below.'),
 'B': ('The X Window System, Mesa (OpenGL and Vulkan drivers for Intel, AMD and NVIDIA open-source drivers), and the font and image libraries the desktop builds on.', ''),
 'C': ('Sound for every edition: ALSA, PipeWire and WirePlumber, plus GStreamer and the media libraries the apps use.', ''),
 'D': ('Wired, **wireless** and Bluetooth networking with NetworkManager, wpa_supplicant, iw and BlueZ.', ''),
 'E': ('The Xfce desktop, the LightDM login screen, file management (Thunar), disks and removable media (UDisks, GVfs), power management, notifications, and the network applet. Part 9 turns it into the IPRPS Desktop.',
       '> **Side note:** This stage also builds GTK 3 and GTK 4, which the Wi-Fi applet needs. It\'s the longest stage by package count, but most packages are small.'),
 'F': ('The local web server (**Apache**), **PHP** (as PHP-FPM) and the **MariaDB** database that the IPRPS apps run on.', ''),
 'G': ('The Lite edition\'s apps: **Firefox** (for the IPRPS web apps), **Evince** (PDF), **Parole** (music and ambience) and **mpv** (video, and ambience playback in Session Master Mode).',
       '> **Warning:** Firefox is a very large build (Rust and C++). Give the VM its full memory, limit jobs as in 0.3, and expect several hours.'),
 'H': ('The Medium edition\'s apps: **LibreOffice**, **GIMP**, **Inkscape**, **VLC**, **FFmpeg**, **ImageMagick**, **CUPS** printing with Gutenprint and Ghostscript, **Xfburn**, and hardware video decoding for Intel (libva, intel-media-driver).',
       '> **Warning:** LibreOffice is the largest build in the Medium stage. As with Firefox, give it time and memory.'),
 'I': ('The Advanced edition\'s extra BLFS packages: **SANE** (scanners), **FontForge** (fonts and symbols), **Graphviz** (relationship and story diagrams), **cdrdao** and **libisoburn** (disc mastering), and **FUSE 3** (for AppImage apps in 16.1).', ''),
}

def title(p):
    return (units.get(p, {}).get('title') or p).replace('&', '&')

def render_stage(code):
    name, order = STAGE[code]
    intro, extra = INTRO[code]
    out = [intro, '']
    if extra: out += [extra, '']
    out += [f'**{len(order)} packages, in build order:** ' + ', '.join(title(p) for p in order) + '.', '']
    fetch_until = order.index('wget') if (code == 'A' and 'wget' in order) else -1
    for i, p in enumerate(order):
        out.append(B.render_package(p, code, built, use_fetch=(i <= fetch_until)))
        if p == 'gdk-pixbuf':
            out.append('''### glycin — second pass (IPRPS)

*Required.* Now that gdk-pixbuf is installed, rebuild glycin **with all four loaders**, so SVG images and icons work. Without this pass the LightDM login screen crashes.

**[BUILDER]** — glycin's folder from pass 1 (unpack it again if it was removed):

```bash
cd ~/src
ls -d glycin-2.1.5 2>/dev/null || tar -xf glycin-2.1.5.tar.xz
cd glycin-2.1.5
rm -rf build
mkdir build &&
cd    build &&
meson setup --prefix=/usr           \\
            --buildtype=release     \\
            -D libglycin-gtk4=false \\
            -D tests=false .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
cd /build/src/glycin-2.1.5/build
ninja install
ls /usr/libexec/glycin-loaders/2+/
gdk-pixbuf-query-loaders --update-cache
update-mime-database /usr/share/mime
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
```

`ls` must list four loaders, including **`glycin-svg`**. Run `gtk-update-icon-cache -qtf /usr/share/icons/Adwaita` too once the Adwaita icon theme is installed later in this stage.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf glycin-2.1.5
```

''')
        out.append('')
        if p == 'linux-pam':
            note = '> **Side note:** BLFS asks for this rebuild after installing Linux-PAM, so that the package uses PAM.'
            for rp in ('shadow', 'systemd'):
                out.append(B.render_package(rp, code, built, extra_note=note, rebuild=True))
                out.append('')
    return '\n'.join(out)

def stagetable():
    rows = ['| Stage | Part | Contents | Packages | Edition |', '|---|---|---|---|---|']
    part = {'A': 3, 'B': 5, 'C': 6, 'D': 7, 'E': 8, 'F': 10, 'G': 11, 'H': 15, 'I': 16}
    ed = {'H': 'Medium', 'I': 'Advanced'}
    for c, n, o in st:
        rows.append(f'| {c} | Part {part[c]} | {n} | {len(o)} | {ed.get(c, "Lite (and up)")} |')
    tot = sum(len(o) for _, _, o in st)
    rows.append(f'| | | **Total BLFS packages** | **{tot}** (+2 rebuilds) | |')
    return '\n'.join(rows)

def kernel_check():
    syms = sorted(ksyms)
    lines = ['```bash', 'cd ~/src/linux-7.1.8', 'for s in \\']
    for i in range(0, len(syms), 6):
        lines.append('  ' + ' '.join(syms[i:i+6]) + ' \\')
    lines.append('  ; do')
    lines.append('  grep -qE "^CONFIG_${s}=(y|m)" .config || echo "not enabled: $s"')
    lines.append('done')
    lines.append('```')
    return '\n'.join(lines)

def kernel_table():
    rows = ['| Option | Needed by |', '|---|---|']
    for k in sorted(ksyms):
        rows.append(f'| `{k}` | ' + ', '.join(title(p) for p in ksyms[k]) + ' |')
    return '\n'.join(rows)

def edition_lists():
    lite = [p for c, n, o in st if c in 'ABCDEFG' for p in o]
    med = STAGE['H'][1]; adv = STAGE['I'][1]
    out = []
    out += [f'### Lite ({len(lite)} BLFS packages, Stages A–G)', '', ', '.join(title(p) for p in lite) + '.', '']
    out += [f'### Medium (Lite + {len(med)} packages, Stage H)', '', ', '.join(title(p) for p in med) + '.', '']
    out += [f'### Advanced (Medium + {len(adv)} packages, Stage I, plus the upstream apps in 16.1)', '', ', '.join(title(p) for p in adv) + '.', '']
    return '\n'.join(out)

tpl = open('/home/claude/iprps_template.md').read()
tpl = tpl.replace('{{stagetable}}', stagetable())
tpl = tpl.replace('{{kernel-check}}', kernel_check())
tpl = tpl.replace('{{kernel-pkg-count}}', str(len({q for v in ksyms.values() for q in v})))
tpl = tpl.replace('{{kernel-table}}', kernel_table())
tpl = tpl.replace('{{edition-lists}}', edition_lists())
tpl = tpl.replace('{{pkg:initramfs}}', B.render_package('initramfs', 'K', built))
for c in STAGE:
    tpl = tpl.replace('{{stage:%s}}' % c, render_stage(c))
def snapshot_steps(m):
    line, name = m.group(0), m.group(1)
    block = (f"\n\n**[DEBIAN ROOT]** — snapshot `{name}`. First stop any test VM (`poweroff`) and `exit` every chroot window:\n\n"
             "```bash\n"
             "pgrep -a qemu || echo \"No QEMU running\"\n"
             "bash /root/iprps-leave.sh\n"
             "df -h / && du -h /root/iprps-system.img\n"
             "mkdir -p /root/snapshots\n"
             f"cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-{name}.img && echo \"SNAPSHOT COMPLETE\"\n"
             f"ls -l /root/snapshots/iprps-{name}.img     # must show 42949672960 bytes\n"
             "```\n\n"
             "Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.")
    return line + block
tpl = re.sub(r'^>.*?Take snapshot \*\*`([^`<>]+)`\*\*[^\n]*$', snapshot_steps, tpl, flags=re.M)
left = re.findall(r'\{\{[^}]+\}\}', tpl)
assert not left, left
misses = tpl.count('OVERRIDE MISS')
out = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/outputs/IPRPS-OS-Distribution-Build-Guide.md'
open(out, 'w').write(tpl)
print('written', out, len(tpl), 'chars; code blocks:', tpl.count('```') // 2, '; override misses:', misses)
