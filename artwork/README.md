# IPRPS artwork

| File | Size | Installed as | Used for |
|---|---|---|---|
| `iprps-login.png` | 1920×1080 | `/usr/share/backgrounds/iprps/iprps-login.png` | LightDM login screen |
| `iprps-default.png` | 2731×1536 (16:9) | `/usr/share/backgrounds/iprps/iprps-default.png` | Desktop wallpaper |
| `icons/*.png` | 256×256, 72 files | `/usr/share/iprps/icons/` and the **IPRPS** icon theme (`/usr/share/icons/IPRPS`), packaged as `iprps-icons` | Desktop, menu, file-type and folder icons (also Thunar's per-folder icons) |
| `iprps-grub.png` (to do) | 1920×1080 | `/boot/grub/iprps-grub.png` | GRUB boot menu (optional) |

The build guide's Part 9.2 installs the backgrounds, and 9.3 installs the icons and builds the icon theme with `rootfs/usr/lib/iprps/iprps-icon-theme`. The `iprps-icons` package (`packages/iprps-icons`) is built from the same files. Images are trimmed to 16:9 so they fill the screen without bars.
