# Build status

*Last updated: 2026-10-23*

## Progress

| Step | Status | Notes |
|---|---|---|
| LFS 13.1-systemd base system | ✅ Done | Built in Debian 13 on WSL2; booted on real hardware from USB |
| Part 0 — Build machine (WSL on drive G:, 1 TB SSD) | ✅ Done | Debian WSL moved to `G:\WSL\Debian`; release files go to `G:\IPRPS` |
| Part 1 — IPRPS base image | ✅ Done | Swap partition removed, root partition last, clean two-line fstab |
| Part 2 — BLFS groundwork | ✅ Done | Shell startup files, Xorg environment, `builder` user, `~/fetch`, systemd units |
| Part 3 — Stage A (foundations, sudo, Wget, LLVM, Rust) | ✅ Done | CrackLib added for libpwquality; libaio from Debian's archive |
| Part 4 — Generic kernel, firmware, microcode, initramfs | ✅ Done | Debian 13 config + SimpleDRM; storage drivers loaded by the initramfs; QEMU boot test passed |
| Part 5 — Stage B (graphics: X11, Mesa) | ✅ Done | rust-bindgen before Mesa; mtdev before the input drivers |
| Part 6 — Stage C (audio, Bluetooth stack) | ✅ Done | libical before BlueZ |
| Part 7 — Stage D (networking) | ✅ Done | PyGObject, slang and newt before NetworkManager; no `wpa_supplicant@wlan0` |
| Part 8 — Stage E (Xfce desktop, LightDM) | ✅ Done | Desktop boot test passed: login, user switching, file manager, browser. glycin two-pass build |
| Part 9 — IPRPS Desktop customization | ✅ Done (panel after Part 12) | Login screen and wallpaper artwork, IPRPS icon theme (24 icons), folders at login |
| Part 10 — Stage F (Apache, PHP-FPM, MariaDB) + campaign schema | ✅ Done | PHP 8.5.12 (fixes CVE-2026-109618/109619) with MariaDB support; MariaDB 12.3.3 without a preset root password |
| Part 11 — Stage G (Lite apps) | 🔄 In progress | Node.js, Firefox, Poppler built; Parole for music; mpv for Session Master ambience |
| Part 12 — IPRPS apps | ⏳ Not started | Session Master Hub and campaign tools still to be written |
| Parts 13–14 — Release engineering, Lite release | ⏳ Not started | Scripts ready in `rootfs/` (untested) |
| Parts 15–16 — Medium and Advanced | ⏳ Not started | |

## Decisions log

| Decision | Choice |
|---|---|
| Name | **IPRPS OS** (`/etc/os-release`: `NAME="IPRPS OS"`, `ID=iprps-os`); formerly "IPRPS Linux" |
| License | IPRPS OS's own work: GNU GPL v2; components keep their own licenses |
| Base | LFS 13.1-systemd + BLFS 13.1 (systemd) |
| Build machine | Debian 13 in WSL2 (on G:), chroot on a 40 GB disk image; test VMs in QEMU (RealVNC + QEMU monitor + SSH on port 2222) or Hyper-V |
| Desktop | Xfce + LightDM for all editions ("IPRPS Desktop") |
| Kernel base config | Debian 13's distribution config, adapted by `kernel/iprps-kernel-adjust.sh` (incl. SimpleDRM instead of the EFI framebuffer) |
| Hardware support | Modules for nearly all hardware, full linux-firmware (zstd), all Intel/AMD microcode, BLFS mkinitramfs + storage-driver loading |
| Disk layout | GPT: EFI 512 MiB, BIOS boot 1 MiB, root (last, grows at first boot); swap file sized at first boot |
| Web stack | Apache (localhost only) + PHP-FPM + MariaDB (`skip-networking`) |
| Lite music player | Parole; Session Master Mode plays ambience with mpv. No Audacious / Qt 6 |
| Distribution | `iprps-os-1.0-<edition>.img.xz` (USB or disk) + `.vhdx` + `.qcow2` + checksums; complete corresponding source per release |
| Redistribution overrides | FFmpeg without non-free options, Mesa without patented codecs, unbranded Firefox without embedded API keys |
| Future | Live ISO (1.1), package manager, local AI assistant (Advanced first) |

## Lessons learned (built into the guide)

- Every command block is labeled with its window: **[DEBIAN ROOT]**, **[IPRPS CHROOT]**, **[BUILDER]**. Root steps run in the same folder as BUILDER; meson/cmake installs run in the `build` subfolder.
- `make install-<service>` units come from `blfs-systemd-units`; the guide `cd`s there.
- Downloads move: libaio, newt, xmlto (Debian archive), linux-firmware (cdn.kernel.org), XScreenSaver (current release only).
- The BLFS dependency lists miss some real requirements (json-c, GTK-Doc for `autoreconf`, PyGObject for NetworkManager); `stages.py` carries them in `EXTRA_REQ`.
- glycin → gdk-pixbuf → glycin again: the second pass is required for SVG icons and the login screen.
- A test copy older than your last fix reproduces old problems: compare file times before trusting a test.
