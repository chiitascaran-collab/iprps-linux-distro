# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Render BLFS 13.1 (systemd) package sections as Markdown for the IPRPS guide."""
import json, re
from lxml import etree

FULL = '/home/claude/blfs-full.xml'
root = etree.parse(FULL).getroot()
for el in root.xpath('//*[@revision="sysv"]'):
    el.getparent().remove(el)
units = json.load(open('/home/claude/blfs_units.json'))

def clean(s):
    return re.sub(r'\s+', ' ', s or '').strip()

def fix_urls(s):
    return (s.replace('https://ftpmirror.gnu.org/', 'https://ftp.gnu.org/gnu/')
             .replace('/patches/blfs/svn/', '/patches/blfs/13.1/')
             .replace('/blfs/downloads/svn/', '/blfs/downloads/13.1-systemd/')
             .replace('/blfs/view/svn/', '/blfs/view/13.1-systemd/'))

def node_of(pid):
    n = root.xpath(f'//*[@id="{pid}"]')
    return n[0] if n else None

def pkg_info(node):
    """Return dict with download, md5, size, disk, time, additional[]"""
    info = {'download': None, 'md5': None, 'size': None, 'disk': None, 'time': None, 'additional': []}
    pk = node.xpath('.//*[@role="package"]')
    if not pk:
        return info
    pk = pk[0]
    mode = 'main'
    for el in pk.iter():
        if el.tag == 'bridgehead':
            t = clean(''.join(el.itertext())).lower()
            if 'additional' in t: mode = 'add'
            elif 'dependenc' in t or 'required' in t or 'recommended' in t or 'optional' in t: mode = 'stop'
            continue
        if mode == 'stop': break
        if el.tag == 'listitem':
            t = clean(''.join(el.itertext()))
            links = [u.get('url') for u in el.xpath('.//ulink') if u.get('url')]
            if mode == 'main':
                tl = t.lower()
                if (tl.startswith('download (http)') or tl.startswith('core download:') or tl.startswith('download:')) and links and not info['download']:
                    info['download'] = fix_urls(links[0])
                elif (tl.startswith('download md5') or tl.startswith('core download md5')) and not info['md5']:
                    info['md5'] = t.split(':', 1)[-1].strip()
                elif t.lower().startswith('download size'): info['size'] = t.split(':', 1)[-1].strip()
                elif t.lower().startswith('estimated disk'): info['disk'] = t.split(':', 1)[-1].strip()
                elif t.lower().startswith('estimated build'): info['time'] = t.split(':', 1)[-1].strip()
            elif mode == 'add':
                for l in links:
                    info['additional'].append((fix_urls(l), t))
    # de-duplicate additional
    seen = set(); add = []
    for l, t in info['additional']:
        if l not in seen and not l.startswith('mailto'):
            seen.add(l); add.append((l, t))
    info['additional'] = add
    return info

def richtext(el):
    """Text of an element with <xref> replaced by the linked package's name."""
    parts = []
    def walk(e):
        if e.tag == 'xref':
            lk = e.get('linkend', '')
            u = units.get(lk)
            parts.append((u['title'] if u and u.get('title') else lk))
        elif e.text:
            parts.append(e.text)
        for c in e:
            walk(c)
            if c.tail: parts.append(c.tail)
    walk(el)
    return ''.join(parts)

def label_text(el):
    t = clean(richtext(el))
    return t

NOTE_TAGS = ('note', 'important', 'warning', 'caution', 'tip')
# Steps BLFS marks optional that IPRPS needs (NetworkManager drives Wi-Fi through wpa_supplicant's D-Bus interface)
REQUIRED_MARKERS = ('CONFIG_CTRL_IFACE_DBUS_NEW', 'dbus/fi.w1.wpa_supplicant1.service', 'make install-httpd', 'make install-php-fpm', 'make install-mariadb')
OPTIONAL_RE = re.compile(r'^(if you\'ve|if you\'re|if you (wish|want|have|need|prefer|are|built|installed|downloaded|used|did|do not)|if desired|optionally|to test|to run the test|the test|tests? |before running the tests)'
                         r'|\b(test suite|run the tests|testsuite|doxygen|sphinx|api documentation|build the documentation|install the documentation|manual pages)\b', re.I)

def note_ancestor(el):
    for a in el.iterancestors():
        if a.tag in NOTE_TAGS: return a
    return None

def render_section(sec, root_note=True):
    """Render paras, notes and screens of a section in order, with window labels."""
    out = []
    last_label = ''
    for el in sec.iter():
        if el is sec: continue
        if el.tag == 'para' and el.getparent().tag not in ('listitem', 'entry') and note_ancestor(el) is None:
            t = label_text(el)
            if t: last_label = t
        elif el.tag in NOTE_TAGS:
            t = clean(' '.join(richtext(p) for p in el.xpath('./para | ./itemizedlist')))
            if t:
                kind = 'Warning' if el.tag in ('warning', 'caution', 'important') else 'Side note'
                out.append(f'> **{kind} (BLFS):** {t[:900]}')
                out.append('')
        elif el.tag == 'screen':
            ui = el.xpath('./userinput')
            body = ''.join(el.itertext()).strip('\n')
            if not body.strip(): continue
            na = note_ancestor(el)
            is_root = el.get('role') == 'root' or 'as the root user' in (last_label or '').lower() or 'as root' in (last_label or '').lower()
            lab = clean(' '.join(richtext(p) for p in na.xpath('./para'))) if na is not None else last_label
            optional = el.get('role') == 'nodump' or bool(OPTIONAL_RE.search(lab or '')) or na is not None
            if len(lab) > 260: lab = lab[:257].rsplit(' ', 1)[0] + '…'
            if is_root:
                prefix = '**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — ' if root_note else '**[IPRPS CHROOT]** *(root; any folder)* — '
            else:
                prefix = '**[BUILDER]** — '
            if optional and any(m in body for m in REQUIRED_MARKERS):
                optional = False
                prefix += '*(IPRPS: **required**)* '
            if optional: prefix += '*(Optional — skip if unsure)* '
            if ui and re.search(r'^make install-(httpd|iptables|lightdm|mariadb|php-fpm|rsyncd|saslauthd|slapd|sshd|[a-z0-9-]*units?)\b', body.strip(), re.M) and 'blfs-systemd-units' not in body:
                body = 'cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)\n' + body.strip('\n')
            if ui:
                out.append(f'{prefix}{lab}'.strip().rstrip('—').strip())
                out.append('')
                out.append('```bash')
                out.append(fix_urls(body.rstrip()))
                out.append('```')
            else:
                if '--->' in body or re.search(r'\[[A-Z0-9_]{3,}\]', body):
                    out.append('*Kernel settings — for reference only, not commands. The generic kernel (Part 4) already includes them.* ' + (lab or ''))
                else:
                    out.append('*Example only — don\'t run:* ' + (lab or 'expected output or file contents'))
                out.append('')
                out.append('```text')
                out.append(body.rstrip())
                out.append('```')
            out.append('')
            last_label = ''
    return out

def unpack_dir(tarball):
    d = re.sub(r'\.(tar\.(xz|gz|bz2|lz|zst)|tgz|zip)$', '', tarball)
    return d

STAGE_OF = {}
ANY_FOLDER_PAGES = {'initramfs', 'xorg7-lib', 'xorg7-font', 'TTF-and-OTF-fonts'}  # root steps that write fixed paths
MD5_OVERRIDE = {
    'newt': ('newt-0.52.25.tar.gz', '4857119244d34d18c67c5c6d6e2d746c'),   # Debian .orig (xz inside; tar detects it)
    'xmlto': ('xmlto-0.0.29.tar.gz', '9d9e9b2ebfca1e453f5e1599b82c48cc'),  # Debian .orig (bz2 inside)
}
OVERRIDES = {
 'php': ([('`26b8387c7c772c57c1f990369530b3d5` (check with `md5sum php-8.5.9.tar.xz`)', 'the SHA-256 listed on https://www.php.net/downloads.php under "Source Tarballs" (check with `sha256sum php-8.5.12.tar.xz`; both values must match exactly)'),
          ('8.5.9', '8.5.12'),
          ('MD5 sum of', 'Checksum of'),
          ('            --with-readline              &&',
           '            --with-readline              \\\n            --with-mysqli=mysqlnd        \\\n            --with-pdo-mysql=mysqlnd     \\\n            --with-openssl               \\\n            --with-curl                  \\\n            --enable-gd                  \\\n            --with-freetype              \\\n            --with-jpeg                  &&')],
   """> **Warning:** **IPRPS changes: build PHP 8.5.12, with MariaDB support.**
>
> - **Version.** BLFS 13.1 has PHP 8.5.9, which is vulnerable to **CVE-2026-109618 and CVE-2026-109619** (critical remote code execution, fixed 21 Oct 2026). This section builds **8.5.12** instead; BLFS's commands are unchanged. Before every IPRPS release, check php.net for a newer 8.5 release and use that.
> - **Options.** BLFS's configuration has no MariaDB support. IPRPS adds `--with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd` (the campaign database; `mysqlnd` is built in, so MariaDB doesn't need to be installed first), `--with-openssl` (secure tokens), `--with-curl` (the online AI apps) and `--enable-gd --with-freetype --with-jpeg` (image thumbnails). WebP isn't in the build, so `--with-webp` is left out. If `configure` stops on an image library, remove that one option.
> - **Check after `make install`:** `php -v` shows 8.5.12, and `php -m | grep -i -E 'mysqli|pdo_mysql|openssl|curl|gd'` lists all five.
> - The offline-manual and PEAR steps are optional; skip them."""),
 'mariadb': ([],
   """> **Warning:** **IPRPS notes for MariaDB.**
>
> - Its `make install` runs as root, in **IPRPS CHROOT**, in `/build/src/mariadb-12.3.3/build`. Run as builder, it fails with "Permission denied".
> - **Don't set a root password** (the book's `mariadb-admin -u root password` step): each installation gets its own random password at first boot (`iprps-db-init`, Part 13).
> - The test server (`mariadbd-safe ... &`) runs in the background and returns the prompt at once (press Enter). The data folder is **`/srv/mariadb`**. Inside the chroot it opens port 3306 on the WSL machine until IPRPS's `skip-networking` (Part 10) is in place, and it names its log files after your Windows PC: stop it with `mariadb-admin -u root shutdown` (check with `pgrep -a mariadbd`) and remove `/srv/mariadb/<PC-NAME>.*` before leaving the chroot."""),
 'nodejs': ([],
   """> **Warning:** **IPRPS: finish the build before installing.** Node.js is a long build. Let `make` finish in BUILDER (`-j4` uses less memory; check with `out/Release/node --version`) before running `make install` as root. If `make install` starts compiling (`g++ -o ...` lines), the build wasn't finished: press Ctrl+C, run `chown -R builder:builder /build/src/node-v24.19.0` in IPRPS CHROOT, and finish `make` in BUILDER."""),
 'poppler': ([('      -D ENABLE_QT5=OFF             \\', '      -D ENABLE_QT5=OFF             \\\n      -D ENABLE_QT6=OFF             \\\n      -D ENABLE_GPGME=OFF           \\')],
   """> **Side note:** **IPRPS changes.** `-D ENABLE_QT6=OFF` (no Qt 6 in IPRPS OS) and `-D ENABLE_GPGME=OFF` (GnuPG-signed PDFs; needs GPGME++, which isn't built). **poppler-data** is unpacked *inside* Poppler's `build` folder (that's what `../../` means), so its root install runs in `/build/src/poppler-26.08.0/build/poppler-data-0.4.12`. Check: `ls /usr/share/poppler` lists `cMap` and other folders."""),
 'uchardet': ([],
   '> **Side note:** uchardet uses CMake **without** Ninja, so it installs with `make install` (not `ninja install`). The rule: if the build step ended with `ninja`, install with `ninja install`; if it ended with `make`, use `make install`.'),
 'newt': ([('wget https://releases.pagure.org/newt/newt-0.52.25.tar.gz', 'wget -O newt-0.52.25.tar.gz https://deb.debian.org/debian/pool/main/n/newt/newt_0.52.25.orig.tar.xz'),
           ('\\\n            --with-gpm-support &&', '&&')],
   '> **Side note:** **IPRPS fixes.** newt\'s pagure.io download is gone; this uses Debian\'s copy of the same release (it\'s xz-compressed inside, which `tar` detects automatically, so the MD5 differs from the book). `--with-gpm-support` is removed because GPM isn\'t part of IPRPS OS.'),
 'xmlto': ([('wget https://pagure.io/xmlto/archive/0.0.29/xmlto-0.0.29.tar.gz', 'wget -O xmlto-0.0.29.tar.gz https://deb.debian.org/debian/pool/main/x/xmlto/xmlto_0.0.29.orig.tar.bz2')],
   '> **Side note:** **IPRPS download fix.** pagure.io no longer serves xmlto. This is Debian\'s copy of the official 0.0.29 release tarball (bz2 inside; `tar` detects it), with a ready `configure`.'),
 'libnotify': ([('            -D man=false        \\', '            -D man=false        \\\n            -D tests=false      \\')],
   '> **Side note:** **IPRPS change.** `-D tests=false`: the test programs need GTK 4, which comes later in this stage.'),
 'xdg-desktop-portal-gtk': ([('meson setup --prefix=/usr --buildtype=release .. &&', 'meson setup --prefix=/usr --buildtype=release -D wallpaper=disabled .. &&')],
   '> **Side note:** **IPRPS change.** The wallpaper portal needs GNOME Desktop, which IPRPS OS doesn\'t build (Xfce sets its own wallpapers). If `meson` still asks for `gnome-desktop-3.0`, also add `-D settings=disabled`.'),
 'wpa_supplicant': ([('systemctl enable wpa_supplicant@wlan0', '# IPRPS: don\'t enable this. NetworkManager starts wpa_supplicant itself;\n# an enabled per-interface unit makes every boot wait 90 s for wlan0.\n# systemctl enable wpa_supplicant@wlan0'),
                     ('systemctl start wpa_supplicant@wlan0', '# systemctl start wpa_supplicant@wlan0')],
   '> **Warning:** **IPRPS change.** Don\'t enable `wpa_supplicant@wlan0`. NetworkManager (Stage D) manages Wi-Fi and starts wpa_supplicant when needed. If you enabled it already: `systemctl disable wpa_supplicant@wlan0.service` in IPRPS CHROOT.\n\n> **Warning:** **IPRPS check: Wi-Fi drivers and D-Bus.** Write the **whole** `.config` from this section (all the `CONFIG_...=y` lines, including `CONFIG_DRIVER_NL80211=y`, `CONFIG_LIBNL32=y` and `CONFIG_CTRL_IFACE_DBUS_NEW=y`), not only the D-Bus lines: without the others, wpa_supplicant builds but says **"No drivers enabled"** and Wi-Fi stays greyed out. Before `make install`, check: `./wpa_supplicant -h | grep -A4 \'^drivers:\'` lists `nl80211` and `wext`, and `ldd wpa_supplicant | grep -c libnl` prints `2` or more. If not, fix `.config`, run `make clean`, and build again.'),
 'polkit': ([('-D man=true ', '-D man=false'), ('-D tests=true', '-D tests=false')],
   '> **Side note:** **IPRPS change.** Manual pages and tests are switched off: the man pages need extra documentation tools, and the tests can\'t run in the chroot.'),
 'xscreensaver': ([('wget https://www.jwz.org/xscreensaver/xscreensaver-6.15.tar.gz',
                    "wget -qO- https://www.jwz.org/xscreensaver/download.html | grep -o 'xscreensaver-[0-9.]*\\.tar\\.gz' | sort -u\nwget https://www.jwz.org/xscreensaver/xscreensaver-<VERSION>.tar.gz    # the name the line above printed")],
   """> **Warning:** **IPRPS download and build fixes.** jwz.org keeps only the newest release, so 6.15 is gone. Download the current one (the first command shows its name) and use that version wherever this section says `6.15`. jwz.org publishes no MD5. XScreenSaver 6.16 ships a broken `configure` (`syntax error near unexpected token 'external'`); fix it before `./configure` with `sed -i 's/^AM_GNU_GETTEXT(external)$/:/' configure`. If `make` then stops in `po` ("No rule to make target 'default'"), remove `po` from the `SUBDIRS` lines of the top-level `Makefile` (`sed -n '9,10p' Makefile` shows them) and run `make` again: XScreenSaver then runs in English only. Check afterwards: `which xscreensaver-command` and `ls /etc/pam.d/xscreensaver` (the screen lock needs both)."""),
 'glycin': ([],
   """> **Warning:** **IPRPS: build glycin in two passes.** Its SVG loader needs gdk-pixbuf, which comes next and itself uses glycin. **Pass 1 (here):** add `-D loaders=glycin-heif,glycin-image-rs,glycin-jxl` to the `meson setup` line (check the option name with `grep -n "option(" ../meson_options.txt ../meson.options 2>/dev/null`; in glycin 2.1 `glycin-loaders` is only an on/off switch). Install, and **keep the folder**. **Pass 2** comes right after gdk-pixbuf. Without pass 2, every SVG icon fails and the LightDM login screen crashes ("Unsupported image format")."""),
 'gdk-pixbuf': ([],
   '> **Warning:** **IPRPS checkpoint.** gdk-pixbuf must be built **after glycin pass 1 is installed**: its PNG/JPEG/GIF/TIFF loaders are switched off and glycin does all image loading. After `ninja install`, `ldd /usr/lib/libgdk_pixbuf-2.0.so.0 | grep glycin` must show `libglycin-2.so.0`. If it doesn\'t, gdk-pixbuf can\'t read any image: rebuild it.'),
 'lightdm': ([],
   """> **Warning:** **IPRPS checkpoints for LightDM.** LightDM's `autoreconf` needs **GTK-Doc** (built earlier in this stage). Its whole install block must complete: `ls -l /usr/bin/lightdm-session` (the session wrapper; without it every login closes at once, which looks like a wrong password) and `ls -ld /var/lib/lightdm-data` must both succeed. The greeter's `tar -xf ../lightdm-gtk-greeter-...` line only works straight after LightDM's install, from inside LightDM's folder. After the greeter: `ls /usr/share/xgreeters/` must list `lightdm-gtk-greeter.desktop`. `make install-lightdm` runs in the systemd units folder."""),
 'openldap': ([],
   '> **Side note:** **IPRPS: client libraries only.** GnuPG only needs OpenLDAP\'s client libraries. Follow the book\'s client-only instructions and skip the `slapd` server parts: the `ldap` user, the server build and configuration, and `make install-slapd`. Check: `ls /usr/lib/libldap.so /usr/lib/liblber.so`.'),
 'iptables': ([],
   '> **Side note:** **IPRPS:** install the unit, but don\'t write the firewall script or enable `iptables` yet. The firewall policy is decided at release time (Part 13).'),
 'speex': ([],
   '> **Side note:** This section builds **two** packages, Speex and then SpeexDSP: each has its own `make install`, in its own folder (`/build/src/speex-1.2.1`, then `/build/src/speexdsp-1.2.1`). Clean up both: `cd ~/src && rm -rf speex-1.2.1 speexdsp-1.2.1`.'),
 'libaio': ([('wget https://releases.pagure.org/libaio/libaio-0.3.113.tar.gz', 'wget -O libaio-0.3.113.tar.gz https://deb.debian.org/debian/pool/main/liba/libaio/libaio_0.3.113.orig.tar.gz')],
   '> **Side note:** **IPRPS download fix.** libaio\'s original download server is gone. The download command above uses Debian\'s copy of the same release; its MD5 matches the BLFS book exactly.'),
 'cracklib': ([('echo $(hostname) >>      /usr/share/dict/cracklib-extra-words', 'echo iprps >>           /usr/share/dict/cracklib-extra-words')],
   '> **Side note:** **IPRPS change.** BLFS adds `$(hostname)` to the extra-words list. Inside the WSL chroot that would be your Windows PC\'s name, so this guide adds `iprps`, the system\'s hostname.'),
 'ffmpeg': ([('            --enable-nonfree     \\\n', ''), ('            --enable-libfdk-aac  \\\n', '')],
   '> **Warning:** **IPRPS release override.** BLFS builds FFmpeg with `--enable-nonfree` and `--enable-libfdk-aac`. FFmpeg built that way may **not be redistributed**. The command below already has both options removed, so the result is GPL and redistributable. (fdk-aac is left out of the IPRPS build for the same reason.)'),
 'mesa': ([('      -D video-codecs=all      \\\n', '')],
   '> **Warning:** **IPRPS release override.** BLFS warns that `-D video-codecs=all` enables patent-encumbered video codecs, which matters when distributing. The command below already has that option removed; Mesa then uses its default, royalty-free codec set.'),
 'firefox': ([('ac_add_options --enable-official-branding', '# IPRPS: official branding may not be redistributed without Mozilla\'s permission\n# ac_add_options --enable-official-branding'),
              ('ac_add_options --with-google-location-service-api-keyfile=$PWD/google-key', '# IPRPS: no embedded third-party API key in distributed builds\n# ac_add_options --with-google-location-service-api-keyfile=$PWD/google-key')],
   '> **Warning:** **IPRPS release override.** BLFS notes that a Firefox built with `--enable-official-branding` **cannot be distributed**, and its mozconfig embeds a Google location API key. In the mozconfig below, both lines are already commented out. The browser then builds with Mozilla\'s generic "unofficial" branding, which may be redistributed.'),
}
def render_package(pid, stage_code, built_set, extra_note=None, rebuild=False, use_fetch=False):
    node = node_of(pid)
    if node is None:
        return f'### {pid}\n\n*(Not found in BLFS 13.1.)*\n'
    u = units.get(pid, {})
    title = u.get('title') or pid
    info = pkg_info(node)
    lines = [f'### {title}' + (' (rebuild)' if rebuild else ''), '']
    meta = [f'*BLFS 13.1 · ID `{pid}` · Stage {stage_code}*']
    if info['time']: meta.append(f'*Build time:* {info["time"]}')
    if info['disk']: meta.append(f'*Disk space:* {info["disk"]}')
    lines += [' · '.join(meta), '']
    if extra_note:
        lines += [extra_note, '']
    # dependencies (only those in our build plan)
    def names(ids):
        return ', '.join(f'`{i}`' for i in ids if i in built_set)
    req = names(u.get('req', [])); rec = names(u.get('rec', [])); rt = names(u.get('req_rt', []) + u.get('rec_rt', []))
    dep_bits = []
    if req: dep_bits.append(f'**Requires:** {req}')
    if rec: dep_bits.append(f'**Recommended (included):** {rec}')
    if rt: dep_bits.append(f'**Needed at runtime:** {rt}')
    if dep_bits:
        lines += ['  \n'.join(dep_bits), '']
    # downloads
    is_group = bool(info['download']) and info['download'].endswith('/')
    pk_sec = node.xpath('.//*[@role="package"]')
    prep = render_section(pk_sec[0]) if pk_sec else []
    prep = [l for l in prep]
    if is_group:
        lines += [f'This page builds a **set of packages** from {info["download"]} using the list and loop below.', '']
        if prep:
            lines += ['**Download preparation:**', ''] + prep
        info['download'] = None
    if info['download']:
        tb = info['download'].rstrip('/').split('/')[-1]
        info['_tb'] = tb
        dl = '~/fetch' if use_fetch else 'wget'
        if use_fetch:
            lines += ['> **Warning:** Wget isn\'t installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.', '']
        lines += ['**[BUILDER]** — Download:', '', '```bash', 'cd ~/src', f'{dl} {info["download"]}']
        for l, t in info['additional']:
            if re.search(r'\.(patch|tar\.\w+|tgz|zip|gz|xz|bz2)$', l):
                lines.append(f'{dl} {l}')
        lines += ['```', '']
        if info['md5']:
            md5 = MD5_OVERRIDE[pid][1] if pid in MD5_OVERRIDE else info["md5"]
            if pid != 'xscreensaver':
                lines += [f'MD5 sum of `{tb}`: `{md5}` (check with `md5sum {tb}`).', '']
        other = [(l, t) for l, t in info['additional'] if not re.search(r'\.(patch|tar\.\w+|tgz|zip|gz|xz|bz2)$', l)]
        for l, t in other:
            if l and l.strip().startswith('http'):
                lines += [f'Additional reference: {l.strip()}', '']
        lines += ['**[BUILDER]** — Unpack (the folder name is read from the tarball):', '', '```bash', f'cd ~/src && tar -xf {tb}', f'cd "$(tar -tf {tb} | head -1 | cut -d/ -f1)" && pwd', '```', '']
    # pages that build several packages: render each one like its own package
    multi = [x for x in node.xpath('./sect2') if x.xpath('./sect3[@role="package"]')]
    if len(multi) >= 2:
        lines += [f'This page builds **{len(multi)} packages**, in this order. Build and install each one completely before starting the next.', '']
        for sub in multi:
            st = ' '.join(''.join(sub.find('title').itertext()).split())
            si = pkg_info(sub)
            lines += [f'#### {st}', '']
            meta = []
            if si['time']: meta.append(f'*Build time:* {si["time"]}')
            if si['disk']: meta.append(f'*Disk space:* {si["disk"]}')
            if meta: lines += [' · '.join(meta), '']
            if si['download']:
                tb = si['download'].rstrip('/').split('/')[-1]
                lines += ['**[BUILDER]** — Download and unpack (the folder name is read from the tarball):', '', '```bash', 'cd ~/src',
                          f'wget {si["download"]}', f'md5sum {tb}' + (f'          # must print {si["md5"]}' if si['md5'] else ''),
                          f'tar -xf {tb}', f'cd "$(tar -tf {tb} | head -1 | cut -d/ -f1)" && pwd', '```', '']
            for sec in sub.xpath('./sect3'):
                if sec.get('role') in ('package', 'commands', 'content', 'kernel'):
                    if sec.get('role') == 'kernel' and sec.xpath('.//screen'):
                        lines += render_section(sec, root_note=True)
                    continue
                if not sec.xpath('.//screen'): continue
                body = render_section(sec, root_note=True)
                if any(l.startswith('```') for l in body):
                    lines += body
            if si['download']:
                lines += ['**[BUILDER]** — Clean up:', '', '```bash', f'cd ~/src && rm -rf "$(tar -tf {tb} | head -1 | cut -d/ -f1)"', '```', '']
        md = '\n'.join(lines)
        return md
    # render every command-bearing subsection in page order
    SKIP_ROLES = {'package', 'commands', 'content', 'kernel'}
    subs = node.xpath('./sect2 | ./sect3')
    for sec in subs:
        role = sec.get('role')
        if role in SKIP_ROLES:
            continue
        if not sec.xpath('.//screen'):
            continue
        body = render_section(sec, root_note=(pid not in ANY_FOLDER_PAGES))
        if not any(l.startswith('```') for l in body):
            continue
        if role == 'installation':
            head = '**Build and install:**'
        elif role == 'configuration':
            head = '**Configure:**'
        else:
            t = sec.find('title')
            head = f"**{clean(''.join(t.itertext())) if t is not None else 'Additional steps'}:**"
        lines += [head, ''] + body
    if info['download']:
        tb = info['download'].rstrip('/').split('/')[-1]
        lines += ['**[BUILDER]** — Clean up:', '', '```bash', f'cd ~/src && rm -rf "$(tar -tf {tb} | head -1 | cut -d/ -f1)"', '```', '']
    md = '\n'.join(lines)
    if pid in OVERRIDES:
        reps, note = OVERRIDES[pid]
        for a, b in reps:
            if a not in md:
                md += f'\n\n<!-- OVERRIDE MISS: {a!r} -->'
            md = md.replace(a, b)
        md = md.replace('**Build and install:**', note + '\n\n**Build and install:**', 1)
    return md

if __name__ == '__main__':
    built = {p for c, n, o in json.load(open('/home/claude/stages.json'))['stages'] for p in o}
    for p in ['libpng', 'mesa', 'Mako', 'xorg7-lib', 'NetworkManager', 'apache', 'firefox']:
        md = render_package(p, 'X', built)
        print('=' * 30, p, len(md)); print(md[:2500])

# IPRPS (Oct 23): extra Firefox notes appended to the release override
_r, _n = OVERRIDES['firefox']
OVERRIDES['firefox'] = (_r, _n + """

> **Side note:** **Running `./mach`.** `cat > mozconfig`, the two `export` lines and `./mach build` must all run **inside the Firefox source folder** (`ls mach mozconfig` lists both). `MOZBUILD_STATE_PATH=${PWD}/mozbuild` takes the folder you're in, so export it again after changing folders. Firefox is the longest build of the project (several hours). If it's killed for lack of memory, run `export MOZ_PARALLEL_BUILD=4` before `./mach build`. After an interruption, the same commands in the same folder continue the build. The two `export` lines are also needed in IPRPS CHROOT before `./mach install`.""")

# IPRPS (Oct 25): never use the LFS project's Google key in IPRPS builds
_r, _n = OVERRIDES['firefox']
OVERRIDES['firefox'] = (_r + [('echo "' + 'AIzaSy' + 'DxKL42zsPjbke5O8_rPVpVrLrJ8aeE9rQ" > google-key',
    "# IPRPS: skip this step. The key belongs to the LFS project and must not be\n# built into IPRPS OS; Firefox works without geolocation.")], _n)
