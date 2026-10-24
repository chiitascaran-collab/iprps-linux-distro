# Third-party components

IPRPS OS is assembled from 386 BLFS packages, plus the LFS base system, the Linux kernel, linux-firmware, CPU microcode and (Advanced edition) upstream application releases. Each keeps **its own license**; the GPL v2 of this project covers only IPRPS OS's own work. The full list of packages, versions and download addresses is in [SOURCES.md](SOURCES.md).

The main components and their licenses (SPDX identifiers; always check the license files shipped in each source tarball, which are authoritative):

| Component | License |
|---|---|
| Linux kernel | GPL-2.0-only WITH Linux-syscall-note |
| linux-firmware | Various redistributable firmware licenses (see its `WHENCE` file, installed in `/usr/share/licenses/linux-firmware`) |
| Intel / AMD CPU microcode | Vendor redistributable licenses (in each package) |
| GNU C Library (glibc) | LGPL-2.1-or-later |
| GCC and its runtime libraries | GPL-3.0-or-later WITH GCC-exception-3.1 |
| Bash, Coreutils, Grep, Sed, Tar, Make and other GNU tools | GPL-3.0-or-later |
| systemd | LGPL-2.1-or-later (some tools GPL-2.0-or-later) |
| GRUB | GPL-3.0-or-later |
| X.Org server and libraries | MIT and related permissive licenses |
| Mesa | MIT |
| GTK, GLib, Pango, Cairo | LGPL-2.1-or-later (Cairo: LGPL-2.1 or MPL-1.1) |
| Xfce | GPL-2.0-or-later and LGPL-2.0-or-later |
| LightDM | GPL-3.0-or-later (library LGPL) |
| NetworkManager | GPL-2.0-or-later (library LGPL-2.1-or-later) |
| PipeWire, WirePlumber | MIT |
| LLVM / Clang | Apache-2.0 WITH LLVM-exception |
| Rust toolchain | MIT OR Apache-2.0 |
| Python | PSF-2.0 |
| Perl | Artistic-1.0-Perl OR GPL-1.0-or-later |
| OpenSSL | Apache-2.0 |
| OpenSSH | BSD-style |
| sudo | ISC |
| curl | curl |
| Apache HTTP Server | Apache-2.0 |
| PHP | PHP-3.01 |
| MariaDB | GPL-2.0-only (client library LGPL-2.1) |
| Firefox, NSS | MPL-2.0 (built without official branding) |
| LibreOffice | MPL-2.0 |
| FFmpeg | LGPL-2.1-or-later with GPL-2.0-or-later parts enabled (no non-free parts) |
| GIMP | GPL-3.0-or-later |
| Inkscape | GPL-2.0-or-later |
| VLC | GPL-2.0-or-later (libVLC LGPL-2.1-or-later) |
| DejaVu fonts | Bitstream-Vera and public-domain changes |

License texts: [LICENSES/](LICENSES/).
