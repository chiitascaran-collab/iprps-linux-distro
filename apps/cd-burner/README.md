# IPRPS CD Burner for IPRPS OS

Burn data discs, audio CDs and disc images on IPRPS OS. A GTK 3 desktop app that matches the rest of the IPRPS desktop and appears in the **IPRPS** menu.

| Tab | What it does |
|---|---|
| **Data Disc** | Burn files and folders to a CD, DVD or Blu-ray, or save them as an ISO image. **Add Campaigns** adds your whole *Campaigns* folder in one click. Checks every file after burning. On a disc that isn't closed, the next burn adds files and keeps what's already there. |
| **Audio CD** | Burn MP3, FLAC, OGG, Opus, M4A, AAC, WMA, AIFF or WAV files as a standard audio CD that plays in any CD player. **Add Campaign Audio** adds *Campaigns/Audio*. Song titles can be edited, and are written as CD-TEXT. Options: 2-second gaps between songs (or none, for live albums), and even out volume. |
| **Burn Image** | Write an `.iso` or `.img` file to a disc (for example an IPRPS OS live DVD). Shows the SHA-256 checksum so you can compare it with the download page. |
| **Copy Disc** | Save a data disc in the drive as an ISO image. |
| **Erase** | Quick or full erase of CD-RW, DVD-RW, DVD+RW and BD-RE discs. |

Every burn can be **simulated** first (laser off; CD-R/RW and DVD-R/RW only), run at the **slowest speed** for older players and car stereos, and **ejects** the disc when done. While a disc is being written, the app asks the desktop not to sleep or log out. Drag files from the file manager onto the lists, or right-click an `.iso` and choose **Open With → IPRPS CD Burner**.

## What it needs

All of these are in BLFS 13.1:

| Package | Why | Edition |
|---|---|---|
| Python 3, **PyGObject 3**, **GTK 3** | The app itself | Already in every edition (Xfce) |
| **libburn**, **libisofs**, **libisoburn** | `xorriso` (data discs, images, erasing, disc info) and `cdrskin` (audio CDs) | Optional apps (Part 5.3 of the distro guide) |
| **FFmpeg** | Converting music files to CD audio, and reading song lengths | Already in every edition |

If a tool is missing, the app still opens, says what's missing, and switches off only what needs it. Without a drive, **Save as Image** still works.

## Install

**IPRPS → IPRPS Updates → IPRPS apps and optional software → IPRPS CD Burner → Install**, or `sudo iprps-update install iprps-cd-burner`. It brings `libisoburn`, `libburn` and `libisofs` with it, and adds the accounts on the computer to the **cdrom** group: log out and back in once before burning. Publishing the package: guide **12.15**.

**From the repository, without installing** (for testing): `PYTHONPATH=apps/cd-burner python3 -m iprps_cd_burner`

## Using a drive

The drive must be readable and writable by you. IPRPS OS's udev rules give `/dev/sr*` to the **cdrom** group, so being in that group is enough. If the app says you don't have permission, run `sudo usermod -aG cdrom $USER` and log in again.

After you put a disc in, wait until the drive's light stops blinking, then choose the **refresh** button next to the drive list.

## Tips

- **Audio CDs for car stereos:** use a CD-R (not CD-RW) and choose **Slowest (most reliable)**.
- **Campaign archives:** on the Data Disc tab, choose **Add Campaigns**, set the label (for example `IRON_CITY_S1`) and choose **Save as Image** to keep an ISO backup, or **Burn**.
- **Close the disc** only when you won't add more files later. Some older DVD players read only closed discs.
- Stopping a burn part-way usually ruins a write-once disc; a rewritable disc can be erased and reused.
- **Details** at the bottom shows the exact commands and the drive's messages, useful for troubleshooting.

## Files

| Path | What it is |
|---|---|
| `apps/cd-burner/iprps_cd_burner/backend.py` | The burning engine (no GUI): builds and runs `xorriso`, `cdrskin` and `ffmpeg` commands, parses disc info and progress |
| `apps/cd-burner/iprps_cd_burner/app.py` | The GTK 3 window |
| `apps/cd-burner/icon.svg` | The icon |
| `apps/cd-burner/tests/test_backend.py` | Tests: `cd apps/cd-burner && python3 -m unittest discover -s tests -v` (uses real `xorriso` on image files, so no drive or disc is needed) |
| `rootfs/usr/bin/iprps-cd-burner` | The launcher |
| `packages/iprps-cd-burner/` | The package recipe, menu entry and install script (adds users to `cdrom`) |
| `packages/libburn/`, `libisofs/`, `libisoburn/` | BLFS 13.1 recipes for the disc tools, published to `iprps-core` |

## License

© 2026 Mythical Legends Publishing, LLC. Free software under the GNU General Public License, version 2 (see `LICENSE`), like IPRPS OS's other system apps.
