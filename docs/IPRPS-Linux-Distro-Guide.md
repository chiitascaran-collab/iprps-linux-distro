# IPRPS Linux — Distribution Build Guide

## A Creative Workstation for Writers, Artists, Game Masters and Media Producers — Built on LFS 13.1-systemd + BLFS 13.1

This guide turns a finished Linux From Scratch system into **IPRPS Linux**, a branded, distributable creative workstation for the Infinite Plane Role Playing System community. It covers support for both UEFI and older BIOS hardware, branding, the path to a desktop, a curated suite of graphics, audio, video, writing and design apps, how to ship the existing IPRPS apps, and ideas for new apps to build later.

> **Side note:** This is a companion to the **LFS 13.1-systemd Companion Guide (Arch Linux & Debian Host Edition)**. Build the base system with that guide first, following the decisions in Part 1 below. Package versions in this guide come from the **BLFS 13.1** book source; always confirm against the BLFS book before building: https://www.linuxfromscratch.org/blfs/

---

## Part 1 — Project Decisions

### 1.1 The IPRPS Linux profile

| Decision | Choice | Why |
|---|---|---|
| Architecture | x86_64 (64-bit) only | LFS's default. Modern creative apps and BLFS desktops need 64-bit |
| Init system | systemd (LFS 13.1-systemd) | Required by KDE Plasma and GNOME, and matches the base guide |
| Primary firmware | **UEFI** | Your reference build machine is UEFI hardware |
| Secondary firmware | **Legacy BIOS** | Some IPRPS users have older machines |
| Audio | PipeWire + WirePlumber | Handles desktop sound, pro-audio (JACK-compatible) and screen capture in one stack |
| Display | Wayland + Xorg (XWayland) | Wayland for modern desktops; Xorg compatibility for older apps and GPUs |
| Studio desktop | KDE Plasma 6 | Krita and Kdenlive are KDE apps; strong creative workflow |
| Lite desktop | Xfce 4.20 | Light enough for older BIOS-era machines |
| Web stack for IPRPS apps | Apache + PHP + MariaDB bound to `localhost` | Runs your existing PHP/HTML apps offline, like XAMPP |

> **Warning:** Secure Boot must stay **off**. LFS doesn't include the signing tools that Secure Boot requires. Document this clearly in your install notes for users.

### 1.2 Two editions

| | IPRPS Linux Studio | IPRPS Linux Lite |
|---|---|---|
| Target | UEFI machines from roughly 2012 onward | Older BIOS machines and low-RAM laptops |
| Desktop | KDE Plasma 6.7 | Xfce 4.20 |
| RAM | 8 GB minimum, 16 GB recommended | 4 GB minimum |
| Disk | 60 GB+ (creative apps and assets are large) | 30 GB+ |
| Apps | Full suite (Part 5) | "Core" apps only |
| Boot | UEFI and BIOS (hybrid disk) | BIOS and UEFI (hybrid disk) |

> **Pro tip:** Both editions share the same base system, kernel and web stack. Build the base **once**, back it up, then add the Lite or Studio layer on top. That halves your maintenance work.

---

## Part 2 — Supporting UEFI and Older BIOS Hardware

### 2.1 One disk image that boots both ways

For the image you distribute, create **both** a 1 MiB BIOS boot partition **and** an EFI System Partition on a GPT disk. Then install GRUB for both. The same disk then boots on UEFI machines and on BIOS machines that can boot GPT disks (most BIOS machines from about 2008 onward).

Build GRUB for BIOS **and** 64-bit UEFI during the LFS build (see the GRUB section of the base guide), then install both from the chroot. Replace `/dev/sdX` with the target disk:

```bash
# BIOS boot code (writes to the disk's first sector + BIOS boot partition)
grub-install /dev/sdX --target=i386-pc

# UEFI boot file at the standard fallback path EFI/BOOT/BOOTX64.EFI
grub-install --target=x86_64-efi --removable
```

> **Side note:** Both installs share one `/boot/grub/grub.cfg`, so there's only one boot menu to maintain. `--removable` means UEFI firmware finds GRUB without any NVRAM boot entry, which is exactly what you want for a disk that moves between computers.

### 2.2 Very old BIOS machines (MBR-only)

Some very old BIOS machines can't boot from GPT disks at all. For those users, provide an **MBR ("dos") layout** alternative. It doesn't need a BIOS boot partition, because GRUB uses the gap before the first partition:

```bash
sfdisk /dev/sdX << "EOF"
label: dos
size=4GiB, type=82
type=83, bootable
EOF
```

Here type `82` is Linux swap and type `83` is Linux. Format and install exactly as in the base guide, then run only the BIOS `grub-install` command.

> **Warning:** 32-bit-only CPUs (for example, Pentium 4 without 64-bit support, Atom N270) **can't** run IPRPS Linux. Say this plainly in your system requirements.

### 2.3 Make the kernel boot on other people's hardware

Your LFS kernel was configured for *your* machine. A distributed kernel has to boot on hardware you've never seen. Three changes make this possible:

1. **Add an initramfs.** BLFS provides a `mkinitramfs` script (BLFS "About initramfs" page). With an initramfs, disk controllers and filesystems can be kernel modules that load at boot.
2. **Enable a broad driver set as modules.** Start from `make defconfig`, then enable common SATA/AHCI, NVMe, USB storage, virtio, Intel/AMD/NVIDIA (nouveau) graphics, Intel/Realtek/Broadcom network and Wi-Fi drivers, and HD-Audio as modules (`<M>`).
3. **Install firmware.** Many Wi-Fi cards and GPUs need firmware files. Follow the BLFS "About Firmware" page, including CPU microcode updates for Intel and AMD.

Then update your GRUB entry to load the initramfs and to find the root partition by UUID:

```bash
menuentry "IPRPS Linux" {
        insmod part_gpt
        insmod ext2
        search --no-floppy --fs-uuid --set=root <UUID>
        linux   /boot/vmlinuz-7.1.8-iprps root=UUID=<UUID> ro quiet
        initrd  /boot/initrd.img-7.1.8-iprps
}
```

> **Side note:** With an initramfs, `root=UUID=` works (the initramfs finds the filesystem). Without one, the kernel only understands `root=PARTUUID=`, as in the base guide.

### 2.4 Genericize CPU-specific libraries

- **GMP** optimizes for the CPU it's built on. For release builds, reconfigure it with the book's generic option (`--host=none-linux-gnu`).
- Never add `-march=native` to `CFLAGS` for release builds. Binaries would crash on older CPUs with "Illegal instruction." If you want optimization, use a conservative baseline such as `-O2` only.

### 2.5 Test matrix before every release

| Test | Firmware | Checks |
|---|---|---|
| Your UEFI build machine | UEFI | Boots, Wi-Fi, audio, GPU acceleration, all apps launch |
| An older BIOS machine | BIOS (GPT) | Boots via BIOS path, Lite desktop usable |
| QEMU with OVMF | UEFI | Clean-install behavior on neutral hardware |
| QEMU without OVMF | BIOS | Legacy path works |
| A USB-stick install | Both | Image copies and boots from removable media |

> **Pro tip:** With QEMU you can test both firmware types on your build machine without rebooting it: `qemu-system-x86_64 -enable-kvm -m 4G -drive file=iprps.img,format=raw` for BIOS. Add `-bios` with the OVMF firmware file for UEFI. On Arch it's in `/usr/share/edk2/x64/` (package `edk2-ovmf`); on Debian it's in `/usr/share/OVMF/` (package `ovmf`). File names vary by version, so check with `ls`. The base guide's **Phase 0** shows the same tests with virt-manager's point-and-click interface.

---

## Part 3 — Branding IPRPS Linux

### 3.1 Identity files

```bash
cat > /etc/os-release << "EOF"
NAME="IPRPS Linux"
VERSION="1.0 (Studio)"
ID=iprps
ID_LIKE=lfs
VERSION_ID=1.0
PRETTY_NAME="IPRPS Linux 1.0 Studio"
VERSION_CODENAME="<codename>"
HOME_URL="https://infiniteplane.space/"
EOF

cat > /etc/lsb-release << "EOF"
DISTRIB_ID="IPRPS Linux"
DISTRIB_RELEASE="1.0"
DISTRIB_CODENAME="<codename>"
DISTRIB_DESCRIPTION="IPRPS Linux 1.0 Studio"
EOF

echo "iprps" > /etc/hostname

cat > /etc/issue << "EOF"
IPRPS Linux 1.0 — \n (\l)

EOF
```

> **Side note:** In `/etc/issue`, `\n` prints the hostname and `\l` prints the terminal name. Pick a codename that fits the IPRPS setting.

### 3.2 Visual identity

| Element | Where it lives | Suggestion |
|---|---|---|
| GRUB theme | `/boot/grub/themes/iprps/` + `set theme=` in `grub.cfg` | Infinite Plane grayscale background and logo |
| Boot splash (optional) | Plymouth (upstream, not in BLFS) | Keep boot text visible in 1.0 for easier support |
| Login screen | SDDM theme (Studio) / LightDM greeter (Lite) | Matching logo and colors |
| Desktop | Plasma global theme / Xfce theme + wallpaper pack | Default: Infinite Plane grayscale; include light, dark and amber monochrome alternates |
| Icons & app launchers | `/usr/share/icons/`, `/usr/share/applications/*.desktop` | One consistent icon style for all IPRPS apps |

> **Pro tip:** Build every artwork file (logo, wallpapers, GRUB theme) with the distro's own tools (Inkscape, GIMP, Krita). It's a good way to test the creative suite, and it's a nice story for users.

---

## Part 4 — From Base System to Desktop (BLFS Build Order)

BLFS is a *menu*, not a linear book. Each package page lists its required dependencies. Build in this order and follow the "Required" and "Recommended" dependencies on each page.

> **Warning:** A full desktop is a large project. Firefox, LibreOffice, KDE Plasma and the LLVM/Rust toolchains they need are among the biggest builds in BLFS, and each can take hours. Expect weeks of part-time work for the Studio edition. Take a backup after each stage.

| Stage | Build (BLFS 13.1 versions) | Result |
|---|---|---|
| 1. Usable base | make-ca 1.16.1, sudo 1.9.17p2, OpenSSH 10.5p1, Git 2.55.0, wget/curl, dosfstools, efibootmgr 18, firmware, initramfs | Secure downloads, admin user, remote access |
| 2. Networking | wpa_supplicant 2.12, NetworkManager | Wired + Wi-Fi with a GUI later |
| 3. Graphics stack | Mesa, Wayland 1.26.0, Xorg Server 21.1.24 (and XWayland), GPU drivers | Graphics acceleration |
| 4. Audio stack | ALSA, PipeWire 1.6.8, WirePlumber 0.5.15, GStreamer 1.28.6 | Sound, pro-audio routing, media framework |
| 5. Toolkits | GTK 3.24.52, GTK 4.22.4, Qt 6.11.2 | What the apps are built on |
| 6. Desktop | Studio: KDE Plasma 6.7.4 + SDDM 0.21.0 — Lite: Xfce 4.20 + LightDM 1.33.1 | A graphical desktop |
| 7. Browser & mail | Firefox 153.2.0, Thunderbird 153.2.0 | Web and the IPRPS web apps |
| 8. Creative suite | Part 5 | The reason IPRPS Linux exists |
| 9. IPRPS web stack | Apache 2.4.68, PHP 8.5.9, MariaDB 12.3.3, Node.js 24.19.0 | Runs the IPRPS apps locally |
| 10. Printing & scanning | CUPS, Gutenprint, SANE + XSane | Print character sheets and scan artwork |

> **Pro tip:** Build each BLFS package into a staging directory (`make DESTDIR=/tmp/pkg install`) and archive it before copying it into `/`. That archive is your package for later releases (see the base guide, Phase 11.3).

---

## Part 5 — The IPRPS Creative App Suite

**How to read the tables:**
- **Source:** "BLFS 13.1" means the BLFS book has build instructions (version shown). "Upstream" means build from the project's own source code or official Linux release, because BLFS doesn't cover it.
- **Tier:** **Core** apps go in both editions. **Studio** apps go in the Studio edition. **Optional** apps are offered as extras.

> **Side note:** Upstream apps aren't worse, just not documented by BLFS. Many ship official Linux downloads (such as tarballs or AppImages). Check each project's site for current formats and dependencies, and test that the app actually runs on your system before including it. AppImages need FUSE (BLFS has fuse3 3.18.2); some AppImages still expect the older libfuse2.

### 5.1 Graphics & art

| App | What it's for | Source | Tier |
|---|---|---|---|
| GIMP | Photo editing, retouching, texture and map painting | BLFS 13.1 (3.2.4) | Core |
| Inkscape | Vector art: logos, maps, icons, character sheet layouts | BLFS 13.1 (1.4.4) | Core |
| ImageMagick | Batch image conversion and resizing (command line); powers thumbnails | BLFS 13.1 (7.1.2) | Core |
| Krita | Digital painting and concept art with a drawing tablet | Upstream | Studio |
| darktable | RAW photo development and color grading | Upstream | Optional |
| Blender | 3D modeling, props, ships, sets, animation, rendering | Upstream | Studio |
| Graphviz | Auto-drawn diagrams: faction relationships, story maps | BLFS 13.1 (15.1.1) | Optional |
| XSane / SANE | Scanning sketches and printed art | BLFS 13.1 | Optional |

### 5.2 Audio

| App | What it's for | Source | Tier |
|---|---|---|---|
| PipeWire + WirePlumber | The sound system itself, with pro-audio (JACK) routing | BLFS 13.1 (1.6.8 / 0.5.15) | Core |
| Audacious | Lightweight music player | BLFS 13.1 (4.6.1) | Core |
| Audacity | Recording and editing voice-overs, podcasts, sound effects | Upstream | Core |
| Ardour | Full multitrack studio for music (for example, Phaser Blast tracks) | Upstream | Studio |
| LMMS | Beat-making and soundtrack composition | Upstream | Optional |
| LAME, FLAC, Opus | MP3, lossless and modern audio codecs | BLFS 13.1 (3.100 / 1.5.0 / 1.6.1) | Core |
| CDParanoia | Accurate audio-CD ripping | BLFS 13.1 | Optional |

### 5.3 Video

| App | What it's for | Source | Tier |
|---|---|---|---|
| FFmpeg | Converting, cutting, Ken Burns reels, 9:16 vertical crops, scripted batches | BLFS 13.1 (9.0.1) | Core |
| MLT | The video engine behind Kdenlive and Shotcut | BLFS 13.1 (7.40.0) | Studio |
| Kdenlive | Full non-linear video editor for series episodes and trailers | Upstream (KDE) | Studio |
| Shotcut | Simpler video editor; good for Lite | Upstream | Optional |
| OBS Studio | Screen recording and live streaming of game sessions | Upstream | Studio |
| HandBrake | Easy video compression and format presets | Upstream | Optional |
| VLC | Plays nearly any format, plus DVDs (and provides libVLC) | BLFS 13.1 (3.0.23) | Core |
| mpv | Minimal, fast video player for reviewing renders | BLFS 13.1 (0.41.0) | Optional |
| x264, x265, libvpx | H.264, H.265 and VP8/VP9 encoders for FFmpeg | BLFS 13.1 | Core |
| libdvdread / libdvdnav | DVD playback support | BLFS 13.1 (7.1.1 / 7.0.0) | Core |
| libisoburn (xorriso), cdrdao | Burning CDs/DVDs and making ISO images | BLFS 13.1 (1.5.8.pl02 / 1.2.6) | Optional |

> **Warning:** Some codecs (for example H.264/H.265 encoders) have patent and licensing implications in some countries when *distributed*. Research this before shipping them in a public release. This is general information, not legal advice.

### 5.4 Writing & publishing

| App | What it's for | Source | Tier |
|---|---|---|---|
| LibreOffice | Manuscripts, rulebooks, spreadsheets for stat tables, presentations | BLFS 13.1 (26.2.5) | Core |
| Pandoc | Convert Markdown to DOCX, EPUB, HTML and PDF (a writing pipeline) | Upstream | Core |
| Calibre | E-book library, EPUB/MOBI conversion and editing for publishing | Upstream | Studio |
| Manuskript | Novel-planning tool (outline, characters, scenes) | Upstream | Optional |
| Ghostwriter | Distraction-free Markdown editor | Upstream (KDE) | Optional |
| Firefox / Thunderbird | Browser for IPRPS web apps and research; mail | BLFS 13.1 (153.2.0) | Core |

### 5.5 Design & layout

| App | What it's for | Source | Tier |
|---|---|---|---|
| Scribus | Print layout: rulebooks, character sheets, posters, book covers | Upstream | Studio |
| Inkscape | (also design) vector layouts and print-ready PDFs | BLFS 13.1 | Core |
| FontForge | Creating and editing fonts (for example, alien alphabets for the setting) | BLFS 13.1 (20251009) | Optional |
| CUPS + Gutenprint | Printing proofs and handouts | BLFS 13.1 | Core |

---

## Part 6 — Shipping the Existing IPRPS Apps

These are the IPRPS and Infinite Plane apps built so far, with how each would run on IPRPS Linux. Most are PHP or single-file HTML apps, so one local web stack (Part 6.1) runs them all offline, without XAMPP.

### 6.1 The apps

| App | What it does | Current form | On IPRPS Linux | Tier |
|---|---|---|---|---|
| **IPRPS Media Player** | Plays MP3/MP4, audio CDs and DVDs; IPRPS radio built in | Electron desktop app + libVLC | Native desktop app; uses the system VLC from BLFS | Core |
| **Genesis Character Engine** | AI character reference-sheet generator (image, video, audio) | Single-file HTML + PHP proxy | Local web app | Core |
| **Infinite Plane Writing Assistant** | Writer's assistant for IPRPS content, multiple AI providers | Single-file PHP | Local web app | Core |
| **THE DIRECTOR** | Compiles story maps into AI video Scene Packages | Single-file browser tool | Local web app | Studio |
| **Script Breakdown Engine** | Breaks stories into scripts and production elements | Web tool suite | Local web app | Studio |
| **Reel** | Browser-based digital audio workstation (Web Audio API) | Single-file HTML | Local web app | Studio |
| **Lookbook Studio** | Builds film and series lookbooks | PHP/JS web app | Local web app + MariaDB | Studio |
| **RadioStation Manager** | Web radio broadcasting software | PHP web app | Optional local install (the live station stays in the cloud) | Optional |
| **Generative Art Gallery** | Image gallery with accounts, uploads and slideshows | PHP + MariaDB | Local web app | Optional |
| **Infinite Plane Universal Login** | Single sign-on for all Infinite Plane apps | PHP + MySQL/MariaDB | Installed first; gates the local suite | Core |
| **IPRPS CD Burner** | Disc burning for IPRPS media | In progress | Desktop app; pairs with libisoburn/cdrdao | Optional |
| **AI Session Master campaign apps** | AI-run campaigns (for example Armageddon 2419, Beneath CatsEye) | React JSX apps | Built once, served locally | Studio |

> **Side note:** Apps that call AI providers (Genesis, the Writing Assistant, THE DIRECTOR, the Session Master apps) still need **internet access and each user's own API keys**. The distro makes them easy to launch; it doesn't remove that requirement.

### 6.2 The local IPRPS web stack

After building Apache, PHP and MariaDB from BLFS (Part 4, stage 9):

1. **Where the apps live.** BLFS's Apache serves `/srv/www` by default. Put the suite under `/srv/www/iprps/` (mirroring your `htdocs/infiniteplane` layout), owned by the `apache` user.
2. **Keep it private.** In `/etc/httpd/httpd.conf`, change `Listen 80` to `Listen 127.0.0.1:80` so only the local computer can reach the apps.
3. **Start at boot.** Enable the Apache and MariaDB services using the systemd units that BLFS installs for them. Check the exact unit names with `systemctl list-unit-files | grep -E 'httpd|mysql|maria'`.
4. **Launchers.** Give each app a desktop launcher so users never type a URL:

```bash
cat > /usr/share/applications/iprps-genesis.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Genesis Character Engine
Comment=IPRPS AI character reference sheets
Exec=firefox --new-window http://localhost/iprps/genesis/
Icon=iprps-genesis
Categories=Graphics;IPRPS;
EOF
```

> **Pro tip:** Moving the apps from Windows/XAMPP to Linux, watch for these three things:
> - **Case sensitivity:** `Logo.png` and `logo.png` are different files on Linux.
> - **Hard-coded Windows paths** such as `D:\xampp\htdocs\...` must become Linux paths.
> - **Permissions:** PHP must be able to write to upload folders (`chown -R apache:apache` on those folders only).

---

## Part 7 — New App Ideas for IPRPS Linux

Apps worth building for the distro later, roughly in priority order:

| Idea | What it would do | Why it matters |
|---|---|---|
| **IPRPS Welcome** (first-run wizard) | Create the user, connect Wi-Fi, pick a color scheme, enter API keys, choose which apps to enable | A friendly first five minutes for non-technical users |
| **IPRPS Key Vault** | One secure place for AI provider keys, shared by Genesis, the Writing Assistant, THE DIRECTOR and Session Master apps | Stops users pasting keys into every app |
| **IPRPS Control Center** | Start/stop the local web stack, update apps, back up databases, show app status | Replaces the XAMPP control panel |
| **IPRPS App Store** | Browse, install and update IPRPS apps and distro packages | Makes the package system (base guide 11.3) usable |
| **IPRPS File Viewer** | Open, preview and validate `.iprps`, `.ipai`, `.srpatch` and `.capstone` files | Makes IPRPS content first-class in the file manager |
| **Media Batch Studio** | A GUI over FFmpeg: Ken Burns reels, 9:16 vertical crops, format conversion, watermarking | Turns frequent command-line jobs into buttons |
| **Asset Librarian** | Tag and search images, audio and video across projects, with thumbnails | Creative projects produce thousands of assets |
| **Prompt Architect Desktop** | Build model-specific image and video prompts offline | Pairs with Genesis and THE DIRECTOR |
| **Scheme Switcher** | Apply one of the Infinite Plane color schemes to the desktop, GRUB and apps at once | Consistent branding with one click |
| **Session Night Mode** | One button that opens the Session Master, a music playlist, OBS and notes together | Set up a game session in seconds |
| **Project Sync** | Back up and sync project folders to your own server | Protects work; no third-party cloud needed |

---

## Part 8 — Release Workflow

1. **Build the base** with the LFS guide on your UEFI machine (from an Arch or Debian host), including GRUB for BIOS **and** UEFI.
2. **Genericize** the kernel, initramfs, firmware and GMP (Part 2).
3. **Brand** it (Part 3).
4. **Add BLFS stages 1–10** (Part 4), packaging each build.
5. **Add the creative suite** (Part 5) and the **IPRPS apps** (Part 6).
6. **Clean up for release:** remove personal accounts, passwords, SSH host keys and shell history; empty the machine ID (`echo uninitialized > /etc/machine-id`); delete build directories.
7. **Test** on the full matrix (Part 2.5).
8. **Publish** a disk image or root-filesystem tarball, the release notes and system requirements, and a **source archive** of every package and patch (GPL compliance).
9. **Maintain:** watch LFS/BLFS security advisories and publish updates.

### Release checklist

- [ ] Boots on UEFI (hardware + OVMF) and BIOS (hardware + QEMU)
- [ ] Secure Boot requirement documented
- [ ] Initramfs and firmware included; Wi-Fi works on common chips
- [ ] No personal data, keys or passwords in the image
- [ ] Every Core app launches; Studio apps launch in the Studio edition
- [ ] IPRPS web apps reachable only from `localhost`
- [ ] Source archive and license files published with the release
- [ ] Version manifest (every package and version) saved in Git

---

*IPRPS Linux is built with Linux From Scratch and Beyond Linux From Scratch (https://www.linuxfromscratch.org/). Package versions are from the BLFS 13.1 book source. "Linux" is a registered trademark of Linus Torvalds.*
