# Changelog

## 2026-10-25

- **Web apps (Part 12):** 32 apps from the live server plus the Universal Login, installed through `tools/iprps-clean-apps.py` (removes API keys and hosting passwords, maps 16 server databases to local `iprps_*` databases, one local user `iprps`, password placeholder `@IPRPS_DB_PASS@`). Guide 12.5 rewritten with the full procedure, database map and checks.
- **`iprps-db-init` (13.1)** now grants `iprps_*`, fills the placeholder in every app and writes `/etc/iprps/db.php`. **13.4** restores the placeholder, empties every app table and retires the test password before the general cleanup.
- Troubleshooting: MariaDB start-up wait, `iprps` access denied, login-only pages, unreachable app databases.

## 2026-10-23

- Stage F built: Apache, **PHP 8.5.12** (fixes CVE-2026-109618 and CVE-2026-109619; BLFS 13.1 has 8.5.9) with MariaDB (`mysqli`, `pdo_mysql`), OpenSSL, curl and GD; MariaDB 12.3.3. Stage G in progress.
- IPRPS Desktop artwork: login screen and wallpaper in `artwork/`; the **IPRPS icon theme** (24 icons, `tools/install-iprps-icons.sh`) is the default icon theme for the desktop and the login screen.
- Wallpaper script waits for Xfce and covers every monitor; a new `iprps-folders` script creates the standard and Campaigns folders at every login; panel design moves to after Part 12.
- New **Appendix C — Useful Commands** (file transfers, QEMU/RealVNC, SSH, Git, custom icons for users and admins), also as `docs/USEFUL-COMMANDS.md` and `docs/CUSTOMIZING-ICONS.md`; former Appendices C and D are now D and E. Icon-theme checklist in 9.3.
- Guide: notes for MariaDB (no preset root password, stop the test server), Node.js (finish the build first), Firefox (`./mach` folder and memory), Poppler (no Qt 6 / GPGME; poppler-data folder), uchardet (`make install`); "which install command" rule; five new troubleshooting rows.

## 2026-10-22

- **Renamed to IPRPS OS** (`NAME="IPRPS OS"`, `ID=iprps-os`; images `iprps-os-1.0-<edition>`). Formerly "IPRPS Linux".
- **Licensed under the GNU GPL v2**; added `LICENSES/`, `THIRD-PARTY.md`, `SOURCES.md`, SPDX headers.
- Stages B–E built; the Xfce desktop logs in successfully in QEMU boot tests.
- Kernel: SimpleDRM replaces the EFI framebuffer (X always has a screen).
- Build order: PyGObject and newt before NetworkManager; json-c before AccountsService; GTK-Doc (with Pygments and hatchling) before LightDM; mtdev before the input drivers; rust-bindgen before Mesa.
- New in the guide: glycin second pass after gdk-pixbuf; systemd unit installs run in the units folder; download fixes (newt, xmlto, XScreenSaver); LightDM session-wrapper and greeter checkpoints; no `wpa_supplicant@wlan0`; QEMU monitor, SSH and text-mode test methods; troubleshooting rows for every problem met.

## 2026-10-18

- First repository: build guide, scripts, overview and status through the generic kernel.
