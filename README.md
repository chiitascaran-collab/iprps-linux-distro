# IPRPS OS

**A role-playing game workstation operating system for Session Masters, Storytellers and players of the Infinite Plane Role Playing System (IPRPS).** Built from source with Linux From Scratch 13.1 and Beyond Linux From Scratch 13.1 (systemd), released in three editions — **Lite**, **Medium** and **Advanced** — that boot on most 64-bit Intel and AMD PCs.

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](LICENSE)

> **Status: in development (pre-1.0).** The base system, generic kernel, graphics, audio, networking and the Xfce desktop are built, and the desktop logs in successfully in boot tests. Next: the web server and database (Stage F). See [BUILD-STATUS.md](BUILD-STATUS.md). No downloadable images yet.

## What it is

- **Session Master Mode:** one click opens the campaign hub, starts looping ambience, and puts a full-screen player display on a second screen or projector.
- **Campaign and player tracking:** a local MariaDB database for campaigns, players, characters, XP, sessions, attendance, NPCs, quests, handouts and a session log ([schema](database/iprps-core.sql)).
- **Local-first:** the IPRPS web apps run on Apache + PHP that only the computer itself can reach; the database has no network port.
- **Creative tools:** writing, art, audio and video apps, scaled by edition.
- **Generic hardware support:** distro-grade kernel modules, SimpleDRM display fallback, the full linux-firmware collection, all Intel and AMD microcode, and an initramfs; UEFI and legacy BIOS.

Read the user-facing overview: **[docs/IPRPS-OS-Overview.md](docs/IPRPS-OS-Overview.md)** (also as [PDF](docs/IPRPS-OS-What-It-Is-and-What-It-Can-Do.pdf)).

## Editions

| | Lite | Medium | Advanced |
|---|---|---|---|
| Purpose | Set up and run campaigns | Essential creative and office apps | Everything |
| RAM | 6 GB minimum | 8 GB (runs on 6 GB, slower) | 16 GB (runs on 6 GB, slower) |
| Storage | 64 GB | 64 GB | 128 GB |
| Highlights | Xfce IPRPS Desktop, Firefox, Evince, Parole, mpv, Wi-Fi, sudo, web server + database | + LibreOffice, GIMP, Inkscape, VLC, FFmpeg, printing | + scanning, FontForge, Graphviz, disc tools, upstream creative apps |

## Repository layout

| Path | Contents |
|---|---|
| `docs/IPRPS-OS-Distribution-Build-Guide.md` / `.docx` | The complete step-by-step build guide (386 BLFS packages, every command labeled with its window) |
| `docs/IPRPS-OS-Overview.md` / `.pdf` | What IPRPS OS is, who it's for, editions, requirements, roadmap, FAQ |
| `docs/lfs/` | LFS 13.1-systemd companion guides (WSL and Debian editions), checklists, `wget-list-systemd`, `md5sums` |
| `docs/archive/` | The original planning guide (written under the earlier name "IPRPS Linux") |
| `build-host/` | `iprps-enter.sh` / `iprps-leave.sh`: mount the image and enter the build chroot from Debian on WSL |
| `rootfs/` | Files installed into the system: first-boot setup, installer, Session Master Mode, desktop and menu defaults, systemd units |
| `database/` | `iprps-core.sql`, the campaign and player-tracking schema |
| `kernel/` | Generic kernel adjustment script and the BLFS-required kernel options |
| `initramfs/` | IPRPS changes to the BLFS `mkinitramfs` script |
| `artwork/` | Logo, wallpaper, login and boot artwork specifications |
| `tools/guide-generator/` | Scripts that regenerate the build guide from the BLFS book source |
| `SOURCES.md` | Every upstream package in IPRPS OS with its version, download address and checksum |
| `LICENSE`, `LICENSES/`, `NOTICE.md`, `THIRD-PARTY.md` | Licensing: this project's GPL v2 and the licenses of the components it builds |

## Building it

Everything is in the build guide. In short: build LFS 13.1-systemd (WSL guide), convert it to the IPRPS disk layout, then follow stages A–I inside a chroot on Debian/WSL, boot-testing copies of the image in QEMU (VNC + SSH) or Hyper-V, and taking a snapshot at every checkpoint.

| Stage | Contents | Packages |
|---|---|---|
| A | Foundations: downloads, security, admin tools and sudo | 49 |
| B | Graphics stack (X11 + Mesa) | 46 |
| C | Audio (ALSA + PipeWire) | 35 |
| D | Networking: wired, wireless and Bluetooth | 12 |
| E | The IPRPS Desktop (Xfce + LightDM) | 139 |
| F | Web server and database | 6 |
| G | Lite edition apps | 25 |
| H | Medium edition apps | 68 |
| I | Advanced edition apps (BLFS part) | 6 |

## License

IPRPS OS's own work in this repository — the build guide, scripts, system configuration, database schema and generator tools — is © 2026 Mythical Legends Publishing, LLC and free software under the **GNU General Public License, version 2** ([LICENSE](LICENSE)). Files carry an `SPDX-License-Identifier: GPL-2.0-only` line where the format allows.

IPRPS OS is built from many open-source components that keep **their own licenses** (GPL, LGPL, MIT, BSD, MPL, Apache and others); see [THIRD-PARTY.md](THIRD-PARTY.md), [LICENSES/](LICENSES/) and [SOURCES.md](SOURCES.md). Commands reproduced from the LFS and BLFS books are under the MIT license; see [NOTICE.md](NOTICE.md). IPRPS, the Infinite Plane Role Playing System and the IPRPS apps are by Mythical Legends Publishing, LLC ([infiniteplane.space](https://infiniteplane.space/)); the names and logos are not covered by the GPL.
