# IPRPS OS

**A role-playing game workstation operating system for Session Masters, Storytellers and players of the Infinite Plane Role Playing System (IPRPS).** Built from source with Linux From Scratch 13.1 and Beyond Linux From Scratch 13.1 (systemd), released in three editions — **Lite**, **Medium** and **Advanced** — that boot on most 64-bit Intel and AMD PCs.

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](LICENSE)

> **Status: in development (pre-1.0).** The base system, generic kernel, graphics, audio, networking and the Xfce desktop are built, and the desktop logs in successfully in boot tests. Next: the web server and database (Stage F). See [BUILD-STATUS.md](BUILD-STATUS.md). No downloadable images yet.

## What it is

- **Session Master Mode:** one click opens the campaign hub, starts looping ambience, and puts a full-screen player display on a second screen or projector.
- **Campaign and player tracking:** a local MariaDB database for campaigns, players, characters, XP, sessions, attendance, NPCs, quests, handouts, a session log and character sheets ([schema](database/iprps-core.sql)).
- **Character sheets:** players fill in the **Character Creator** (on their own computer or phone, also during play on the IPRPS Table); the Session Master keeps every player, NPC and creature sheet in **Character Sheets**, and the IPRPS Oracle reads them and writes new NPC and creature sheets.
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
| Highlights | Xfce IPRPS Desktop, Firefox, Evince, Parole, mpv, Wi-Fi, sudo, web server + database | + IPRPS Oracle (local AI), Chromium (default browser, IPRPS apps as windows), LibreOffice, GIMP, Inkscape, VLC, FFmpeg, printing | + scanning, FontForge, Graphviz, disc tools, upstream creative apps |

## Repository layout

| Path | Contents |
|---|---|
| `docs/IPRPS-OS-Distribution-Build-Guide.md` / `.docx` | The complete step-by-step build guide (387 BLFS packages, every command labeled with its window) |
| `docs/IPRPS-OS-Walkthrough.md` / `.docx` / `.pdf` | Step-by-step tutorial: first boot to game night, with the ready-to-run IPRPS one-shot "Fog on Pier Nine" |
| `docs/IPRPS-OS-Overview.md` / `.pdf` | What IPRPS OS is, who it's for, editions, requirements, roadmap, FAQ |
| `tools/iprps-clean-apps.py` | Makes a distributable copy of the web apps: no API keys, no hosting passwords, local database names, `@IPRPS_DB_PASS@` placeholder (guide 12.5) |
| `docs/USEFUL-COMMANDS.md` | File transfers (Windows ↔ WSL ↔ chroot ↔ test VM), QEMU and RealVNC, SSH, Git |
| `docs/CUSTOMIZING-ICONS.md` | How users and administrators add their own icons on an installed IPRPS OS |
| `docs/session-master-manual/` | The **Session Master Training Manual**: how to run games with IPRPS OS, with seven walkthroughs (Markdown, PDF, Word, and a website: upload the folder) |
| `docs/REMOTE-PLAYERS.md` | Players in another city or state join the IPRPS Table through Tailscale, without changing IPRPS OS (Appendix G) |
| `tools/iprps-remote-play.sh` | Installs Tailscale on the Session Master's computer into `/opt/tailscale` (`install`, `status`, `remove`), for remote players (Appendix G) |
| `docs/lfs/` | LFS 13.1-systemd companion guides (WSL and Debian editions), checklists, `wget-list-systemd`, `md5sums` |
| `docs/archive/` | The original planning guide (written under the earlier name "IPRPS Linux") |
| `build-host/` | `iprps-enter.sh` / `iprps-leave.sh`: mount the image and enter the build chroot from Debian on WSL; `iprps-release-clean.sh` / `iprps-release-pack.sh`: make the release images (13.4, 13.5); `iprps-release-iso.sh`: the live ISO for DVD and USB (13.9); `iprps-backup.sh`: back up the build image and snapshots to another drive, compressed (Appendix F); `iprps-repo.sh`: the package repository: signing key, sign and add packages, check, stage for upload, test server (12.12, Part 17) |
| `rootfs/` | Files installed into the system: first-boot setup, installer, Session Master Mode, desktop and menu defaults, systemd units |
| `apps/hub/` | The **Session Master Hub**: home page with the Session Master's apps, **Manage apps** (every app in `/srv/www/iprps`, on/off per account), default apps, and the player display |
| `apps/table/` | The **IPRPS Table**: LAN play. A Node.js service (no npm packages) on port 7777: players join from phones, tablets and laptops; chat with private messages, images and audio; IPRPS dice (`dice-presets.json`); the Session Master pushes images, video, text and sound to everyone, groups or single players |
| `apps/table-tile/` | The Hub tile that opens the IPRPS Table console (installed as `/srv/www/iprps/table`) |
| `apps/writer/` | **IPRPS Writer**: a simple word processor (per-account documents; opens and saves .docx, .odt, .txt, .html; PDF via print) |
| `apps/oracle/` | The **IPRPS Oracle**: AI for Session Masters (Medium and Advanced), PHP + JavaScript, Universal Login; local Llama 3.2 3B, or Claude online with the Session Master's own API key (`llm.php`); reads character sheets and writes NPC and creature sheets |
| `apps/character-creator/` | The **Character Creator**: the IPRPS character sheet as one self-contained HTML file (attributes, DP costs, skills, advantages, spells, portrait; exports `.json`). Works in the Hub, on the IPRPS Table (`/sheet/`) and on its own |
| `apps/iprps-lib/` | Shared code for the session tools: look and color schemes, campaign/session picker, the IPRPS dice (made from `apps/table/dice.js`), Markdown, the shared API (campaigns, sessions, log, player display and Table bridge) |
| `apps/combat/` | **Initiative and Combat Tracker** (12.10) |
| `apps/dice/` | **Dice Roller** (12.10) |
| `apps/soundboard/` | **Soundboard**: boards of pads; built-in sounds made with Web Audio (`synth.js`), your own files, Table playback (12.11) |
| `apps/session-log/` | **Session Log and Recap** (12.10) |
| `apps/welcome/` | **IPRPS Welcome**: first-login tour, color scheme, encrypted API key vault (12.10) |
| `apps/file-viewer/` | **IPRPS File Viewer**: opens and checks `.iprps`, `.ipai`, `.srpatch`, `.capstone` files (12.10) |
| `apps/updates-tile/` | The Hub tile for **IPRPS Updates**: what the last update check found (installed as `/srv/www/iprps/updates`, 12.12) |
| `packages/` | **Package recipes** (PKGBUILDs) for pacman: `pacman`, `iprps-keyring`, `iprps-base` (pacman settings, **IPRPS Updates**, `iprps-update`, the update timer, the edition packages), `iprps-apps` (one package per IPRPS app), and worked examples (`examples/curl`, `examples/calibre`, a BLFS template). Rules in `packages/README.md` (12.12, Part 17) |
| `apps/character-sheets/` | **Character Sheets**: the Session Master's sheet library (import players' files, view, print, by campaign; NPC and creature sheets; `character_sheets` table); shown inside the IPRPS Table console |
| `ai/` | Ollama service, the `iprps-storyteller` Modelfile (Llama 3.2 3B Instruct) and system prompt, the Llama `NOTICE`, and `iprps-ai-model` (`upgrade` to the current default model, or swap in a custom IPRPS model) |
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
| I | Advanced edition apps (BLFS part) | 7 |

## License

IPRPS OS's own work in this repository — the build guide, scripts, system configuration, database schema and generator tools — is © 2026 Mythical Legends Publishing, LLC and free software under the **GNU General Public License, version 2** ([LICENSE](LICENSE)). Files carry an `SPDX-License-Identifier: GPL-2.0-only` line where the format allows.

IPRPS OS is built from many open-source components that keep **their own licenses** (GPL, LGPL, MIT, BSD, MPL, Apache and others); see [THIRD-PARTY.md](THIRD-PARTY.md), [LICENSES/](LICENSES/) and [SOURCES.md](SOURCES.md). Commands reproduced from the LFS and BLFS books are under the MIT license; see [NOTICE.md](NOTICE.md). IPRPS, the Infinite Plane Role Playing System and the IPRPS apps are by Mythical Legends Publishing, LLC ([infiniteplane.space](https://infiniteplane.space/)); the names and logos are not covered by the GPL.
