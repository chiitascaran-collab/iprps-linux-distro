# Build status

*Last updated: 2026-11-14*

**IPRPS OS 1.0 is in Beta.** All three editions are built and released for testing:
- **Lite**, **Medium** and **Advanced** images: `iprps-os-1.0-<edition>.img.xz` for USB sticks and disks (recommended), plus the live `.iso`.
- Downloads: [infiniteplane.space/downloads/iprps](https://infiniteplane.space/downloads/iprps/#download).
- Session Master manual: [infiniteplane.space/iprps-os/manual](https://infiniteplane.space/iprps-os/manual).

New apps and fixes now go out through **IPRPS Updates** (pacman, signed repository at `infiniteplane.space/downloads/iprps/repo/1`) instead of new images.

## Progress

| Step | Status | Notes |
|---|---|---|
| LFS 13.1-systemd base system | ✅ Done | Built in Debian 13 on WSL2; booted on real hardware from USB |
| Part 0 — Build machine (WSL on drive G:, 1 TB SSD) | ✅ Done | Debian WSL moved to `G:\\WSL\\Debian`; release files go to `G:\\IPRPS` |
| Part 1 — IPRPS base image | ✅ Done | Swap partition removed, root partition last, clean two-line fstab |
| Part 2 — BLFS groundwork | ✅ Done | Shell startup files, Xorg environment, `builder` user, `~/fetch`, systemd units |
| Part 3 — Stage A (foundations, sudo, Wget, LLVM, Rust) | ✅ Done | CrackLib added for libpwquality; libaio from Debian's archive |
| Part 4 — Generic kernel, firmware, microcode, initramfs | ✅ Done | Debian 13 config + SimpleDRM; storage drivers loaded by the initramfs; boots on UEFI and BIOS PCs |
| Part 5 — Stage B (graphics: X11, Mesa) | ✅ Done | rust-bindgen before Mesa; mtdev before the input drivers |
| Part 6 — Stage C (audio, Bluetooth stack) | ✅ Done | libical before BlueZ |
| Part 7 — Stage D (networking) | ✅ Done | PyGObject, slang and newt before NetworkManager; no `wpa_supplicant@wlan0` |
| Part 8 — Stage E (Xfce desktop, LightDM) | ✅ Done | Login, user switching, file manager, browser. glycin two-pass build |
| Part 9 — IPRPS Desktop customization | ✅ Done | Login screen and wallpaper, IPRPS icon theme and folder icons, panel, folders at login |
| Part 10 — Stage F (Apache, PHP-FPM, MariaDB) + campaign schema | ✅ Done | PHP 8.5.12 with MariaDB support; MariaDB 12.3.3 without a preset root password; Apache on 127.0.0.1 only |
| Part 11 — Stage G (Lite apps) | ✅ Done | Node.js, Firefox, Poppler, Evince, Parole, mpv, FFmpeg |
| Part 12 — IPRPS apps | ✅ Done | Session Master Hub, Writer, Character Creator and Character Sheets, IPRPS Table (LAN play), Combat, Dice, Session Log, Welcome, File Viewer, Soundboard, Master Database, Character Prompt Builder, IPRPS Updates; 32 web apps from the live server (cleaned of keys and hosting passwords) with the Universal Login and local databases. Optional: IPRPS Link (remote players) and IPRPS Podcast Studio |
| Part 12.12 — Package manager | ✅ Done | pacman with a signed IPRPS repository (`iprps-core`, `iprps-apps`, `iprps-extra`) and **IPRPS Updates** (graphical, notifications, Hub tile) |
| Part 13 — Release engineering | ✅ Done | Release cleanup, first-boot setup, installer, `.img.xz` and live `.iso`; first start after install takes 10–30 minutes, then one restart (13.3) |
| Part 14 — Lite release | ✅ Beta | Installed and tested on a 16 GB laptop and a 6 GB desktop; IPRPS Updates tested |
| Part 15 — Stage H (Medium) | ✅ Beta | Chromium (default browser, apps in their own windows), LibreOffice, GIMP and more; IPRPS Oracle with local Llama 3.2 3B and optional Claude |
| Part 16 — Stage I (Advanced) | ✅ Beta | Medium plus Calibre and more; installed and running on the 16 GB laptop (2026-11-14); IPRPS Updates tested (the `pacman.conf` fix of 2026-11-11 is in the release cleanup) |
| Part 17 — After release | ✅ In use | Updates, new apps, retiring apps, security updates and point releases; the **IPRPS Release Desk** (`tools/release-desk/`) walks through each one |

## Waiting to be published or tested

| Item | What's left |
|---|---|
| App packages 2026.11.14 and `iprps-base` 1.0-8 (Master Database, Character Prompt Builder, retiring apps) | Build, sign and upload with the Release Desk (**Update IPRPS OS files or a recipe**, `iprps-apps` and `iprps-base`); then **Check now** on a Lite and an Advanced computer |
| IPRPS Link (12.13, optional) | Its tests pass with both relays (Node.js and PHP, also in burst mode). Still to do: the live Infinite Plane sign-in (`relay/auth/link.html` in the site's `/auth/`), one relay on HTTPS, a session with a phone on mobile data, `makepkg` in the build image |
| IPRPS Podcast Studio (12.14, optional) | Server, export and AI-provider tests pass with mocks. Still to do: real camera and microphone, one LAN guest, a guest over the internet, real AI keys, `makepkg` in the build image |
| Session Master Hub and web apps | Overhaul of the 32 server apps before 1.0 final |

## Decisions log

| Decision | Choice |
|---|---|
| Name | **IPRPS OS** (`/etc/os-release`: `NAME="IPRPS OS"`, `ID=iprps-os`); formerly "IPRPS Linux" |
| License | IPRPS OS's own work: GNU GPL v2; components keep their own licenses |
| Base | LFS 13.1-systemd + BLFS 13.1 (systemd) |
| Build machine | Debian 13 in WSL2 (on G:), chroot on a disk image; test VMs in QEMU or Hyper-V; test PCs: 16 GB laptop, 6 GB desktop |
| Desktop | Xfce + LightDM for all editions ("IPRPS Desktop") |
| Kernel base config | Debian 13's distribution config, adapted by `kernel/iprps-kernel-adjust.sh` (incl. SimpleDRM instead of the EFI framebuffer) |
| Hardware support | Modules for nearly all hardware, full linux-firmware (zstd), all Intel/AMD microcode, BLFS mkinitramfs + storage-driver loading; UEFI and BIOS |
| Disk layout | GPT: EFI 512 MiB, BIOS boot 1 MiB, root (last, grows at first boot); swap file sized at first boot |
| Web stack | Apache (127.0.0.1 only) + PHP-FPM + MariaDB (`skip-networking`) |
| Package manager | **pacman**: signed repository on infiniteplane.space, edition packages (`iprps-lite`, `-medium`, `-advanced`) so new apps arrive with updates; retired apps removed by IPRPS Updates |
| Browsers | Firefox (Lite); ungoogled-chromium as the default on Medium and Advanced |
| Local AI | IPRPS Oracle (Medium, Advanced): Ollama with Llama 3.2 3B Instruct (Q8_0), Vulkan for AMD/Intel GPUs; optional Claude with the Session Master's own key |
| Remote players | IPRPS Table on the LAN; for other cities: IPRPS Link (browser only, the Session Master's own relay) or Tailscale (Appendix G) |
| Lite music player | Parole; Session Master Mode plays ambience with mpv. No Audacious / Qt 6 |
| Distribution | `iprps-os-1.0-<edition>.img.xz` (recommended) + live `.iso` + checksums; complete corresponding source per release |
| Redistribution overrides | FFmpeg without non-free options, Mesa without patented codecs, unbranded Firefox without embedded API keys |

## Lessons learned (built into the guide)

- Every command block is labeled with its window: **[DEBIAN ROOT]**, **[IPRPS CHROOT]**, **[BUILDER]**. Root steps run in the same folder as BUILDER; meson/cmake installs run in the `build` subfolder.
- `make install-<service>` units come from `blfs-systemd-units`; the guide `cd`s there.
- Downloads move: libaio, newt, xmlto (Debian archive), linux-firmware (cdn.kernel.org), XScreenSaver (current release only).
- The BLFS dependency lists miss some real requirements (json-c, GTK-Doc for `autoreconf`, PyGObject for NetworkManager); `stages.py` carries them in `EXTRA_REQ`.
- glycin → gdk-pixbuf → glycin again: the second pass is required for SVG icons and the login screen.
- A test copy older than your last fix reproduces old problems: compare file times before trusting a test.
- **The first start after installing is slow** (ext4 finishing in the background, caches being built): give it 10–30 minutes, then restart once (13.3).
- **Rufus:** write the `.iso` in **DD Image** mode (offered after **Start**); its recommended ISO mode makes an NTFS stick that doesn't boot. Prefer the `.img.xz` with balenaEtcher.
- **`pacman.conf`:** the release cleanup must replace the temporary build `pacman.conf` (12.12 step 3), or IPRPS Updates finds no repositories (13.4).
- **Edition packages** list every app of their edition: install and publish them together with every app built at the new version (Release Desk, 17.7).
- **Files copied into the build image by hand** belong to no package: the first package that ships them needs `--overwrite` (IPRPS Updates does this on computers).
- **Programs built from source** (Python, FFmpeg, OpenSSL…) aren't pacman packages: recipes depend on `iprps-base`, not on them.
- **Never ship hosting credentials:** apps read `/etc/iprps/db.php`; the Release Desk checks every app and every GitHub change for passwords and keys.
