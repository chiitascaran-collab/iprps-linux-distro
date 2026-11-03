# IPRPS OS packages

Recipes (PKGBUILDs) for the IPRPS OS package repositories. Guide: **12.12** (setup) and **Part 17** (publishing updates).

| Folder | Builds | Repository |
|---|---|---|
| `pacman/` | pacman 7.1.0, so pacman can update itself | `iprps-core` |
| `iprps-keyring/` | the public IPRPS signing key (`iprps.gpg`, `iprps-trusted`: made by `iprps-repo.sh key`, never shipped in the zips) | `iprps-core` |
| `iprps-base/` | `iprps-base` (pacman settings, IPRPS Updates, `iprps-update`, update timer, notifications, pacman hooks) and the edition packages `iprps-lite`, `iprps-medium`, `iprps-advanced` | `iprps-core` |
| `iprps-icons/` | the IPRPS icon theme and Thunar folder icons, from `artwork/icons` (72 PNGs) | `iprps-core` |
| `iprps-apps/` | one package per IPRPS app, from `apps/` in this repository (menu entries in `iprps-apps/desktop/`) | `iprps-apps` |
| `examples/curl/` | worked example: a BLFS package as a security update | `iprps-core` |
| `examples/calibre/` | worked example: an optional extra (official binary) | `iprps-extra` |
| `examples/_blfs-template/` | start here for any other BLFS/LFS package | |

Build as `builder` in the image (`makepkg -f --nodeps`); packages land in `/build/repo`. Sign and publish from Debian with `build-host/iprps-repo.sh` (`add`, `check`, `stage`, then upload, then `online`).

## Rules

1. **`depends=(iprps-base)`.** The release's own libraries are always there. Name other packages only if they exist in the repositories (or an edition package `provides` them).
2. **Never install onto the system while building.** BLFS's `make install` becomes `make DESTDIR="$pkgdir" install` (`ninja`/`meson install` take `DESTDIR`/`--destdir` too).
3. **`/etc` files go in `backup=()`**, so users' changes are kept (`.pacnew`). `iprps-repo.sh check` warns about any that aren't.
4. **No file in two packages.** `iprps-repo.sh check` refuses to stage a repository where that happens.
5. **Library version changes** (`libfoo.so.3` → `.so.4`): rebuild and publish everything that uses the library at the same time.
6. **Raise the version for every change:** `pkgver` for new upstream or app versions, `pkgrel` for a rebuild of the same version.
7. **Test before publishing:** `iprps-repo.sh serve` plus a test VM pointed at it (12.12 step 10).
8. **The private signing key never leaves Debian root's GnuPG and its backup.** Not in the image, not in Git.
