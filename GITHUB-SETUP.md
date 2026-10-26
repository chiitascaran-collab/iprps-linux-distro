# Publishing this repository on GitHub

## Repository settings

- **Name:** `iprps-os`
- **Description** (paste into "About"):
  > IPRPS OS — a role-playing game workstation OS for IPRPS Session Masters and Storytellers, built from source with LFS/BLFS 13.1 in Lite, Medium and Advanced editions. GPL v2.
- **Website:** `https://infiniteplane.space/`
- **Topics:** `linux` `linux-distribution` `operating-system` `linux-from-scratch` `lfs` `blfs` `xfce` `tabletop-rpg` `ttrpg` `game-master-tools` `rpg-tools` `iprps` `gpl-2`
- **License:** GPL v2 is already in `LICENSE`, and GitHub detects it automatically ("GPL-2.0 license" in the About box). Don't add another license file through GitHub's picker.

## First upload (from Debian on WSL)

Create an **empty** repository on github.com first (no README, no license, no .gitignore), so the first push doesn't conflict.

```bash
cd /mnt/g/IPRPS                       # or wherever you keep it
unzip iprps-os-repo.zip -d .
cd iprps-os
git init -b main
git add .
git commit -m "IPRPS OS: build guide, scripts, licensing and status as of 2026-10-26"
git remote add origin https://github.com/<your-account>/iprps-os.git
git push -u origin main
```

GitHub asks for a **personal access token** instead of a password: Settings → Developer settings → Personal access tokens.

**If you already pushed the earlier `iprps-linux` repository:** rename it on GitHub (Settings → Repository name → `iprps-os`; GitHub redirects the old address). Then, in your local copy, `git remote set-url origin https://github.com/<your-account>/iprps-os.git`, copy the new files over the old ones (delete files that were renamed, such as the `IPRPS-Linux-*` docs), and `git add -A && git commit -m "Rename to IPRPS OS; add GPL v2 licensing" && git push`.

## Releases

- Each release file must be **under 2 GiB**. Put the images on the download site, and the notes, checksums and source archive on GitHub, or split images with `split -b 1900M -d -a 2`.
- **GPL obligation:** every release must come with the complete corresponding source (the upstream tarballs listed in `SOURCES.md` plus this repository at the release tag), or a written offer for it. Tag the repository for each release (`git tag v1.0-lite && git push --tags`).
- Use `docs/RELEASE-NOTES-TEMPLATE.md` for the release text.
- **Never commit disk images** (`.gitignore` blocks `*.img`, `*.vhdx`, `*.qcow2`, `*.xz`).
