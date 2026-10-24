# IPRPS artwork

| File | Size | Installed as | Used for |
|---|---|---|---|
| `iprps-login.png` | 1920×1080 | `/usr/share/backgrounds/iprps/iprps-login.png` | LightDM login screen |
| `iprps-default.png` | 2731×1536 (16:9) | `/usr/share/backgrounds/iprps/iprps-default.png` | Desktop wallpaper |
| `icons/*.png` | 256×256, 24 files | `/usr/share/iprps/icons/` and the **IPRPS** icon theme (`/usr/share/icons/IPRPS`) | Desktop, menu and folder icons |
| `iprps-grub.png` (to do) | 1920×1080 | `/boot/grub/iprps-grub.png` | GRUB boot menu (optional) |

The build guide's Part 9.2 installs these, and 9.3 builds the icon theme (`tools/install-iprps-icons.sh` here). **Put your 24 icon PNGs into `artwork/icons/` before committing** (they're kept on your PC, not generated). Images are trimmed to 16:9 so they fill the screen without bars.
