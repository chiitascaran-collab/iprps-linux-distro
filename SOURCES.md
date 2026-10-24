# Sources

Upstream source code for everything IPRPS OS builds. For each release, these exact tarballs (and the patches named in the build guide) are published as the release's **complete corresponding source**, together with this repository at the release tag.

Where the original download address no longer works, the guide uses an identical copy: **libaio**, **newt** and **xmlto** from Debian's archive (`deb.debian.org`), **linux-firmware** from `cdn.kernel.org`, and **XScreenSaver** from the current jwz.org release. The build guide notes each case.

## LFS 13.1-systemd base system

The LFS base system's packages and patches (94 files), from the LFS book's `wget-list-systemd` (also in `docs/lfs/`, with `md5sums`):

- https://download.savannah.gnu.org/releases/acl/acl-2.4.0.tar.xz
- https://download.savannah.gnu.org/releases/attr/attr-2.6.0.tar.gz
- https://ftpmirror.gnu.org/autoconf/autoconf-2.73.tar.xz
- https://ftpmirror.gnu.org/automake/automake-1.18.1.tar.xz
- https://ftpmirror.gnu.org/bash/bash-5.3.tar.gz
- https://github.com/gavinhoward/bc/releases/download/7.0.3/bc-7.0.3.tar.xz
- https://sourceware.org/pub/binutils/releases/binutils-2.47.tar.xz
- https://ftpmirror.gnu.org/bison/bison-3.8.2.tar.xz
- https://www.sourceware.org/pub/bzip2/bzip2-1.0.8.tar.gz
- https://ftpmirror.gnu.org/coreutils/coreutils-9.11.tar.xz
- https://dbus.freedesktop.org/releases/dbus/dbus-1.16.2.tar.xz
- https://ftpmirror.gnu.org/dejagnu/dejagnu-1.6.3.tar.gz
- https://ftpmirror.gnu.org/diffutils/diffutils-3.12.tar.xz
- https://downloads.sourceforge.net/project/e2fsprogs/e2fsprogs/v1.47.4/e2fsprogs-1.47.4.tar.gz
- https://sourceware.org/ftp/elfutils/0.195/elfutils-0.195.tar.bz2
- https://github.com/libexpat/libexpat/releases/download/R_2_8_3/expat-2.8.3.tar.xz
- https://prdownloads.sourceforge.net/expect/expect5.45.4.tar.gz
- https://astron.com/pub/file/file-5.48.tar.gz
- https://ftpmirror.gnu.org/findutils/findutils-4.11.0.tar.xz
- https://github.com/westes/flex/releases/download/v2.6.4/flex-2.6.4.tar.gz
- https://pypi.org/packages/source/f/flit-core/flit_core-4.0.2.tar.gz
- https://ftpmirror.gnu.org/gawk/gawk-5.4.1.tar.xz
- https://ftpmirror.gnu.org/gcc/gcc-16.2.0/gcc-16.2.0.tar.xz
- https://ftpmirror.gnu.org/gdbm/gdbm-1.26.tar.gz
- https://ftpmirror.gnu.org/gettext/gettext-1.0.tar.xz
- https://ftpmirror.gnu.org/glibc/glibc-2.44.tar.xz
- https://ftpmirror.gnu.org/gmp/gmp-6.3.0.tar.xz
- https://ftpmirror.gnu.org/gperf/gperf-3.3.tar.gz
- https://ftpmirror.gnu.org/grep/grep-3.12.tar.xz
- https://ftpmirror.gnu.org/groff/groff-1.24.1.tar.gz
- https://ftpmirror.gnu.org/grub/grub-2.14.tar.xz
- https://ftpmirror.gnu.org/gzip/gzip-1.14.tar.xz
- https://github.com/Mic92/iana-etc/releases/download/20260805/iana-etc-20260805.tar.gz
- https://ftpmirror.gnu.org/inetutils/inetutils-2.8.tar.gz
- https://www.kernel.org/pub/linux/utils/net/iproute2/iproute2-7.1.0.tar.xz
- https://pypi.org/packages/source/J/Jinja2/jinja2-3.1.6.tar.gz
- https://www.kernel.org/pub/linux/utils/kbd/kbd-2.10.0.tar.xz
- https://www.kernel.org/pub/linux/utils/kernel/kmod/kmod-34.2.tar.xz
- https://www.greenwoodsoftware.com/less/less-704.tar.gz
- https://www.kernel.org/pub/linux/libs/security/linux-privs/libcap2/libcap-2.78.tar.xz
- https://github.com/libffi/libffi/releases/download/v3.8.0/libffi-3.8.0.tar.gz
- https://download.savannah.gnu.org/releases/libpipeline/libpipeline-1.5.8.tar.gz
- https://ftpmirror.gnu.org/libtool/libtool-2.6.2.tar.xz
- https://github.com/besser82/libxcrypt/releases/download/v4.5.2/libxcrypt-4.5.2.tar.xz
- https://www.kernel.org/pub/linux/kernel/v7.x/linux-7.1.8.tar.xz
- https://github.com/lz4/lz4/releases/download/v1.10.0/lz4-1.10.0.tar.gz
- https://ftpmirror.gnu.org/m4/m4-1.4.21.tar.xz
- https://ftpmirror.gnu.org/make/make-4.4.1.tar.gz
- https://download.savannah.gnu.org/releases/man-db/man-db-2.13.1.tar.xz
- https://www.kernel.org/pub/linux/docs/man-pages/man-pages-6.18.tar.xz
- https://pypi.org/packages/source/M/MarkupSafe/markupsafe-3.0.3.tar.gz
- https://github.com/mesonbuild/meson/releases/download/1.12.0/meson-1.12.0.tar.gz
- https://ftpmirror.gnu.org/mpc/mpc-1.4.1.tar.xz
- https://www.bytereef.org/software/mpdecimal/releases/mpdecimal-4.0.1.tar.gz
- https://ftpmirror.gnu.org/mpfr/mpfr-4.2.2.tar.xz
- https://invisible-mirror.net/archives/ncurses/ncurses-6.6.tar.gz
- https://github.com/ninja-build/ninja/archive/v1.13.2/ninja-1.13.2.tar.gz
- https://github.com/openssl/openssl/releases/download/openssl-4.0.1/openssl-4.0.1.tar.gz
- https://files.pythonhosted.org/packages/source/p/packaging/packaging-26.3.tar.gz
- https://ftpmirror.gnu.org/patch/patch-2.8.tar.xz
- https://github.com/PCRE2Project/pcre2/releases/download/pcre2-10.47/pcre2-10.47.tar.bz2
- https://www.cpan.org/src/5.0/perl-5.44.0.tar.xz
- https://distfiles.ariadne.space/pkgconf/pkgconf-3.0.5.tar.xz
- https://sourceforge.net/projects/procps-ng/files/Production/procps-ng-4.0.7.tar.xz
- https://sourceforge.net/projects/psmisc/files/psmisc/psmisc-23.7.tar.xz
- https://www.python.org/ftp/python/3.14.7/Python-3.14.7.tar.xz
- https://www.python.org/ftp/python/doc/3.14.7/python-3.14.7-docs-html.tar.bz2
- https://ftpmirror.gnu.org/readline/readline-8.3.tar.gz
- https://ftpmirror.gnu.org/sed/sed-4.10.tar.xz
- https://pypi.org/packages/source/s/setuptools/setuptools-84.0.0.tar.gz
- https://github.com/shadow-maint/shadow/releases/download/4.20.2/shadow-4.20.2.tar.xz
- https://sqlite.org/2026/sqlite-autoconf-3530400.tar.gz
- https://sqlite.org/2026/sqlite-doc-3530400.zip
- https://github.com/systemd/systemd/archive/v261.2/systemd-261.2.tar.gz
- https://anduin.linuxfromscratch.org/LFS/systemd-man-pages-261.2.tar.xz
- https://ftpmirror.gnu.org/tar/tar-1.35.tar.xz
- https://downloads.sourceforge.net/tcl/tcl8.6.18-src.tar.gz
- https://downloads.sourceforge.net/tcl/tcl8.6.18-html.tar.gz
- https://ftpmirror.gnu.org/texinfo/texinfo-7.3.tar.xz
- https://www.iana.org/time-zones/repository/releases/tzdata2026c.tar.gz
- https://www.kernel.org/pub/linux/utils/util-linux/v2.42/util-linux-2.42.2.tar.xz
- https://github.com/vim/vim/archive/v9.2.1025/vim-9.2.1025.tar.gz
- https://pypi.org/packages/source/w/wheel/wheel-0.48.0.tar.gz
- https://github.com//tukaani-project/xz/releases/download/v5.8.3/xz-5.8.3.tar.xz
- https://zlib.net/fossils/zlib-1.3.2.tar.gz
- https://github.com/facebook/zstd/releases/download/v1.5.7/zstd-1.5.7.tar.gz
- https://www.linuxfromscratch.org/patches/lfs/development/bzip2-1.0.8-install_docs-1.patch
- https://www.linuxfromscratch.org/patches/lfs/development/coreutils-9.11-i18n-1.patch
- https://www.linuxfromscratch.org/patches/lfs/development/expect-5.45.4-gcc15-1.patch
- https://www.linuxfromscratch.org/patches/lfs/development/glibc-2.44-upstream_fixes-1.patch
- https://www.linuxfromscratch.org/patches/lfs/development/glibc-fhs-1.patch
- https://www.linuxfromscratch.org/patches/lfs/development/kbd-2.10.0-backspace-1.patch
- https://www.linuxfromscratch.org/patches/lfs/development/Python-3.14.7-openssl_4-1.patch
- https://www.linuxfromscratch.org/patches/lfs/development/tar-1.35-acl_fix-1.patch

## Kernel, firmware and microcode (Part 4)

- Linux 7.1.8 — https://www.kernel.org/pub/linux/kernel/v7.x/linux-7.1.8.tar.xz
- linux-firmware — https://cdn.kernel.org/pub/linux/kernel/firmware/ (dated release; checked against `sha256sums.asc`)
- Intel microcode — https://github.com/intel/Intel-Linux-Processor-Microcode-Data-Files/releases
- AMD microcode — included in linux-firmware (`amd-ucode/`)

## BLFS 13.1 packages, in build order

## Stage A — Foundations: downloads, security, admin tools and sudo

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | libtasn1-4.21.0 | https://ftp.gnu.org/gnu/libtasn1/libtasn1-4.21.0.tar.gz | `2ee1d9f3aa66f1e308c46a283aa9a8c2` |
| 2 | p11-kit-0.26.5 | https://github.com/p11-glue/p11-kit/releases/download/0.26.5/p11-kit-0.26.5.tar.xz | `308306e889850bff08fae74ae7897a21` |
| 3 | make-ca-1.16.1 | https://github.com/lfs-book/make-ca/archive/v1.16.1/make-ca-1.16.1.tar.gz | `bf9cea2d24fc5344d4951b49f275c595` |
| 4 | libunistring-1.4.2 | https://ftp.gnu.org/gnu/libunistring/libunistring-1.4.2.tar.xz | `e033195d90d0803063f3fecc77148124` |
| 5 | libidn2-2.3.8 | https://ftp.gnu.org/gnu/libidn/libidn2-2.3.8.tar.gz | `a8e113e040d57a523684e141970eea7a` |
| 6 | libpsl-0.23.3 | https://github.com/rockdaboot/libpsl/releases/download/0.23.3/libpsl-0.23.3.tar.gz | `596df43f3c2a8f1d4a677b032ccbc820` |
| 7 | Wget-1.25.0 | https://ftp.gnu.org/gnu/wget/wget-1.25.0.tar.gz | `c70ba58b36f944e8ba1d655ace552881` |
| 8 | Linux-PAM-1.7.2 | https://github.com/linux-pam/linux-pam/releases/download/v1.7.2/Linux-PAM-1.7.2.tar.xz | `934c26eca3fada956356a30489e86291` |
| 9 | Sudo-1.9.17p2 | https://www.sudo.ws/dist/sudo-1.9.17p2.tar.gz | `dcbf46f739ae06b076e1a11cbb271a10` |
| 10 | icu-78.3 | https://github.com/unicode-org/icu/releases/download/release-78.3/icu4c-78.3-sources.tgz | `a7b736b570ef0e180c96a31715a00c78` |
| 11 | libxml2-2.15.3 | https://download.gnome.org/sources/libxml2/2.15/libxml2-2.15.3.tar.xz | `b7b0123654f86ebf630a5cbedaafdece` |
| 12 | nghttp2-1.70.0 | https://github.com/nghttp2/nghttp2/releases/download/v1.70.0/nghttp2-1.70.0.tar.xz | `3df2b4b51caa13b76032bfd2d11d4ab2` |
| 13 | cURL-8.21.0 | https://curl.se/download/curl-8.21.0.tar.xz | `230131079987135cbe1eadb77a04af57` |
| 14 | libarchive-3.8.9 | https://github.com/libarchive/libarchive/releases/download/v3.8.9/libarchive-3.8.9.tar.xz | `535e3afec5f61d493f0b1b9e8bcf7539` |
| 15 | libuv-1.52.1 | https://dist.libuv.org/dist/v1.52.1/libuv-v1.52.1.tar.gz | `db711bbe3822dd4fe51fad0cd78baa57` |
| 16 | CMake-4.4.2 | https://cmake.org/files/v4.4/cmake-4.4.2.tar.gz | `6911f0379d901db23619413f092b99ef` |
| 17 | libssh2-1.11.1 | https://www.libssh2.org/download/libssh2-1.11.1.tar.gz | `38857d10b5c5deb198d6989dacace2e6` |
| 18 | LLVM-22.1.8 | https://github.com/llvm/llvm-project/releases/download/llvmorg-22.1.8/llvm-project-22.1.8.src.tar.xz | `69065494ebcb1150b2a329c1b3db7584` |
| 19 | Rustc-1.97.1 | https://static.rust-lang.org/dist/rustc-1.97.1-src.tar.xz | `c6fc3febcd3b1235cf4f00c3e05559b3` |
| 20 | Git-2.55.0 | https://www.kernel.org/pub/software/scm/git/git-2.55.0.tar.xz | `758c02a1b621cc0868ee0a0d99573e6b` |
| 21 | OpenSSH-10.5p1 | https://ftp.openbsd.org/pub/OpenBSD/OpenSSH/portable/openssh-10.5p1.tar.gz | `a95119f402dfa0166c9dd1237239085c` |
| 22 | cpio-2.15 | https://ftp.gnu.org/gnu/cpio/cpio-2.15.tar.bz2 | `3394d444ca1905ea56c94b628b706a0b` |
| 23 | Which-2.25 and Alternatives | https://ftp.gnu.org/gnu/which/which-2.25.tar.gz | `60140cb2637634e4f4e68c2e98c6a07b` |
| 24 | Nano-9.2 | https://www.nano-editor.org/dist/v9/nano-9.2.tar.xz | `9bb0f37945afa964d16bffd9e4da3106` |
| 25 | Zip-3.0 | https://downloads.sourceforge.net/infozip/zip30.tar.gz | `7b74551e63f8ee6aab6fbc86676c0d37` |
| 26 | dosfstools-4.2 | https://github.com/dosfstools/dosfstools/releases/download/v4.2/dosfstools-4.2.tar.gz | `49c8e457327dc61efab5b115a27b087a` |
| 27 | libaio-0.3.113 | https://releases.pagure.org/libaio/libaio-0.3.113.tar.gz | `7d5be185f20eeaae15e267419950aaf7` |
| 28 | LVM2-2.03.42 | https://sourceware.org/ftp/lvm2/LVM2.2.03.42.tgz | `1cfc17fcbdc5103492b4504c5ddaa274` |
| 29 | parted-3.7 | https://ftp.gnu.org/gnu/parted/parted-3.7.tar.xz | `b56ec0cf7bc89d61da1585f88fc8ef5e` |
| 30 | efivar-39 | https://github.com/rhboot/efivar/archive/39/efivar-39.tar.gz | `a8fc3e79336cd6e738ab44f9bc96a5aa` |
| 31 | Popt-1.19 | https://ftp.osuosl.org/pub/rpm/popt/releases/popt-1.x/popt-1.19.tar.gz | `eaa2135fddb6eb03f2c87ee1823e5a78` |
| 32 | efibootmgr-18 | https://github.com/rhboot/efibootmgr/archive/18/efibootmgr-18.tar.gz | `e170147da25e1d5f72721ffc46fe4e06` |
| 33 | pciutils-3.15.0 | https://mj.ucw.cz/download/linux/pci/pciutils-3.15.0.tar.gz | `20b8e936cce9784444961088c8801f68` |
| 34 | libusb-1.0.30 | https://github.com/libusb/libusb/releases/download/v1.0.30/libusb-1.0.30.tar.bz2 | `b0b0bacc2c6919515db8e863f0517db8` |
| 35 | usbutils-019 | https://kernel.org/pub/linux/utils/usb/usbutils/usbutils-019.tar.xz | `67a8eb4782540058d0648f83ecabdf6c` |
| 36 | rsync-3.5.0 | https://www.samba.org/ftp/rsync/src/rsync-3.5.0.tar.gz | `418db7651d1acf55364b0834234dbbfb` |
| 37 | libtirpc-1.3.7 | https://downloads.sourceforge.net/libtirpc/libtirpc-1.3.7.tar.bz2 | `74f97df306b8d6149d3d9898a1d44c6e` |
| 38 | lsof-4.99.7 | https://github.com/lsof-org/lsof/releases/download/4.99.7/lsof-4.99.7.tar.gz | `46647a774bb8ba630eb738c3aa1b5275` |
| 39 | duktape-2.7.0 | https://duktape.org/duktape-2.7.0.tar.xz | `b3200b02ab80125b694bae887d7c1ca6` |
| 40 | docutils-0.23 | https://files.pythonhosted.org/packages/source/d/docutils/docutils-0.23.tar.gz | `39d10acfd1fc81b87f5de84418b88be9` |
| 41 | libxslt-1.1.45 | https://download.gnome.org/sources/libxslt/1.1/libxslt-1.1.45.tar.xz | `84bb3f6ba7f5ee98af5dcd72e828c73e` |
| 42 | GLib-2.88.3 | https://download.gnome.org/sources/glib/2.88/glib-2.88.3.tar.xz | `b61c04cfbf55b0d24fbe64e4ac9e9d56` |
| 43 | Polkit-127 | https://github.com/polkit-org/polkit/archive/127/polkit-127.tar.gz | `2cc95f1b02fc1de6c9e52db986642ec4` |
| 44 | docbook-xml-4.5 | https://archive.docbook.org/xml/4.5/docbook-xml-4.5.zip | `03083e288e87a7e829e437358da7ef9e` |
| 45 | CrackLib-2.10.3 | https://github.com/cracklib/cracklib/releases/download/v2.10.3/cracklib-2.10.3.tar.xz | `e8ea2b86de774fc09fdd0f2829680b19` |
| 46 | docbook-xsl-nons-1.79.2 | https://github.com/docbook/xslt10-stylesheets/releases/download/release/1.79.2/docbook-xsl-nons-1.79.2.tar.bz2 | `2666d1488d6ced1551d15f31d7ed8c38` |
| 47 | hwdata-0.410 | https://github.com/vcrhonek/hwdata/archive/v0.410/hwdata-0.410.tar.gz | `07f1de937ff5b830280f6157221164eb` |
| 48 | libpwquality-1.4.5 | https://github.com/libpwquality/libpwquality/releases/download/libpwquality-1.4.5/libpwquality-1.4.5.tar.bz2 | `6b70e355269aef0b9ddb2b9d17936f21` |
| 49 | shared-mime-info-2.5.1 | https://gitlab.freedesktop.org/xdg/shared-mime-info/-/archive/2.5.1/shared-mime-info-2.5.1.tar.gz | `5f8baa7bac254ea9e65782f754a2880b` |

## Stage B — Graphics stack (X11 + Mesa)

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | Mako-1.4.1 | https://files.pythonhosted.org/packages/source/M/Mako/mako-1.4.1.tar.gz | `9c09a897c23a34df7ba614ec2d7229e1` |
| 2 | Cython-3.2.9 | https://github.com/cython/cython/releases/download/3.2.9/cython-3.2.9.tar.gz | `775ad752cdb021193f3ef323228388d5` |
| 3 | libyaml-0.2.5 | https://github.com/yaml/libyaml/releases/download/0.2.5/yaml-0.2.5.tar.gz | `bb15429d8fb787e7d3f1c83ae129a999` |
| 4 | PyYAML-6.0.3 | https://files.pythonhosted.org/packages/source/P/PyYAML/pyyaml-6.0.3.tar.gz | `dbc6f815cd75160ccf12e470be1c8d6e` |
| 5 | Cbindgen-0.29.4 | https://github.com/mozilla/cbindgen/archive/v0.29.4/cbindgen-0.29.4.tar.gz | `7e790e024bc678ad1b4431b0350679e9` |
| 6 | SPIRV-Headers-1.4.357.0 | https://github.com/KhronosGroup/SPIRV-Headers/archive/vulkan-sdk-1.4.357.0/SPIRV-Headers-vulkan-sdk-1.4.357.0.tar.gz | `085dd07d487c165c0ca7713d726eb6de` |
| 7 | SPIRV-Tools-1.4.357.0 | https://github.com/KhronosGroup/SPIRV-Tools/archive/vulkan-sdk-1.4.357.0/SPIRV-Tools-vulkan-sdk-1.4.357.0.tar.gz | `c357eec1e33bc95e650aa4c8efdd3b13` |
| 8 | glslang-16.5.0 | https://github.com/KhronosGroup/glslang/archive/16.5.0/glslang-16.5.0.tar.gz | `79e949d6d50cc167e7d5307afb04c41a` |
| 9 | libpng-1.6.58 | https://downloads.sourceforge.net/libpng/libpng-1.6.58.tar.xz | `c6c372a9d7754c66e0b77a8d34987a3b` |
| 10 | FreeType-2.14.3 | https://downloads.sourceforge.net/freetype/freetype-2.14.3.tar.xz | `5e78e6fdce5a61d3075e4c25e9852f84` |
| 11 | Fontconfig-2.18.3 | https://gitlab.freedesktop.org/api/v4/projects/890/packages/generic/fontconfig/2.18.3/fontconfig-2.18.3.tar.xz | `ce819e229ca6fb7d1be47a192d6681a3` |
| 12 | util-macros-1.20.2 | https://www.x.org/pub/individual/util/util-macros-1.20.2.tar.xz | `5f683a1966834b0a6ae07b3680bcb863` |
| 13 | xorgproto-2025.1 | https://xorg.freedesktop.org/archive/individual/proto/xorgproto-2025.1.tar.xz | `15534fa6fb13a6a70afe7561c1424f3c` |
| 14 | libXau-1.0.12 | https://www.x.org/pub/individual/lib/libXau-1.0.12.tar.xz | `4c9f81acf00b62e5de56a912691bd737` |
| 15 | libXdmcp-1.1.5 | https://www.x.org/pub/individual/lib/libXdmcp-1.1.5.tar.xz | `ce0af51de211e4c99a111e64ae1df290` |
| 16 | xcb-proto-1.17.0 | https://xorg.freedesktop.org/archive/individual/proto/xcb-proto-1.17.0.tar.xz | `c415553d2ee1a8cea43c3234a079b53f` |
| 17 | libxcb-1.17.0 | https://xorg.freedesktop.org/archive/individual/lib/libxcb-1.17.0.tar.xz | `96565523e9f9b701fcb35d31f1d4086e` |
| 18 | Xorg Libraries | https://www.x.org/pub/individual/lib/ | `—` |
| 19 | Libdrm-2.4.134 | https://dri.freedesktop.org/libdrm/libdrm-2.4.134.tar.xz | `0e70607bb5c2f7ecbc411e6a2fab8b22` |
| 20 | rust-bindgen-0.72.1 | https://github.com/rust-lang/rust-bindgen/archive/refs/tags/v0.72.1/rust-bindgen-0.72.1.tar.gz | `49be3303557d072ce4c6987b2989be3c` |
| 21 | SPIRV-LLVM-Translator-22.1.5 | https://github.com/KhronosGroup/SPIRV-LLVM-Translator/archive/v22.1.5/SPIRV-LLVM-Translator-22.1.5.tar.gz | `8bdf03a2f7d90da52e358ac78b3e9959` |
| 22 | Vulkan-Headers-1.4.357.0 | https://github.com/KhronosGroup/Vulkan-Headers/archive/vulkan-sdk-1.4.357.0/Vulkan-Headers-vulkan-sdk-1.4.357.0.tar.gz | `64a23bb12e95a2017004d72569132929` |
| 23 | Wayland-1.26.0 | https://gitlab.freedesktop.org/wayland/wayland/-/releases/1.26.0/downloads/wayland-1.26.0.tar.xz | `64c593ccf6820635765a952ec5f34fbb` |
| 24 | Vulkan-Loader-1.4.357.0 | https://github.com/KhronosGroup/Vulkan-Loader/archive/vulkan-sdk-1.4.357.0/Vulkan-Loader-vulkan-sdk-1.4.357.0.tar.gz | `ce35f16bee47e9faf0a50d682a2db77d` |
| 25 | Wayland-Protocols-1.49 | https://gitlab.freedesktop.org/wayland/wayland-protocols/-/releases/1.49/downloads/wayland-protocols-1.49.tar.xz | `5685f769a227f2d4143d983ad07edaba` |
| 26 | Mesa-26.1.7 | https://mesa.freedesktop.org/archive/mesa-26.1.7.tar.xz | `1a3ea044abc823e2db8c6041e5adcc4f` |
| 27 | libepoxy-1.5.10 | https://download.gnome.org/sources/libepoxy/1.5/libepoxy-1.5.10.tar.xz | `10c635557904aed5239a4885a7c4efb7` |
| 28 | libxcvt-0.1.3 | https://www.x.org/pub/individual/lib/libxcvt-0.1.3.tar.xz | `7fb9c51d33a680f724f34da41768b1d0` |
| 29 | Pixman-0.46.4 | https://www.cairographics.org/releases/pixman-0.46.4.tar.gz | `c08173c8e1d2cc79428d931c13ffda59` |
| 30 | xbitmaps-1.1.4 | https://www.x.org/pub/individual/data/xbitmaps-1.1.4.tar.xz | `793992635c45250028eaec226af416fc` |
| 31 | xcb-util-0.4.1 | https://xcb.freedesktop.org/dist/xcb-util-0.4.1.tar.xz | `34d749eab0fd0ffd519ac64798d79847` |
| 32 | Xorg Applications | https://www.x.org/pub/individual/app/ | `—` |
| 33 | xcursor-themes-1.0.7 | https://www.x.org/pub/individual/data/xcursor-themes-1.0.7.tar.xz | `070993be1f010b09447ea24bab2c9846` |
| 34 | Xorg Fonts | https://www.x.org/pub/individual/font/ | `—` |
| 35 | Xorg-Server-21.1.24 | https://www.x.org/pub/individual/xserver/xorg-server-21.1.24.tar.xz | `19c2d104a6c9ba85b4896ef75b2d1084` |
| 36 | XKeyboardConfig-2.48 | https://www.x.org/pub/individual/data/xkeyboard-config/xkeyboard-config-2.48.tar.xz | `575106aff79b589abe4aff6c4bff4782` |
| 37 | mtdev-1.1.7 | https://bitmath.org/code/mtdev/mtdev-1.1.7.tar.bz2 | `483ed7fdf7c1e7b7375c05a62848cce7` |
| 38 | libevdev 1.13.6 | https://www.freedesktop.org/software/libevdev/libevdev-1.13.6.tar.xz | `4202ff132e3efe95fe9ca2c4f8f119f7` |
| 38 | Xorg Evdev Driver-2.11.0 | https://www.x.org/pub/individual/driver/xf86-input-evdev-2.11.0.tar.xz | `faa89be0ef86aebd6fd0a03eed23839c` |
| 38 | libinput-1.31.3 | https://gitlab.freedesktop.org/libinput/libinput/-/archive/1.31.3/libinput-1.31.3.tar.gz | `022aa3838b0cf8b932c0e4a4dbeac150` |
| 38 | Xorg Libinput Driver-1.5.0 | https://www.x.org/pub/individual/driver/xf86-input-libinput-1.5.0.tar.xz | `f8d0fb6987d843e688d597c2b66ec824` |
| 38 | Xorg Synaptics Driver-1.10.0 | https://www.x.org/pub/individual/driver/xf86-input-synaptics-1.10.0.tar.xz | `017383c13a0d0f4cb320be477ab25513` |
| 38 | Xorg Wacom Driver-1.2.4 | https://github.com/linuxwacom/xf86-input-wacom/releases/download/xf86-input-wacom-1.2.4/xf86-input-wacom-1.2.4.tar.bz2 | `e22300fe7cf162fa2b1a6e64ef7341f3` |
| 39 | xinit-1.4.4 | https://www.x.org/pub/individual/app/xinit-1.4.4.tar.xz | `e7430a710261c9129b1280f26cb159a5` |
| 40 | Graphite2-1.3.14 | https://github.com/silnrsi/graphite/releases/download/1.3.14/graphite2-1.3.14.tgz | `1bccb985a7da01092bfb53bb5041e836` |
| 41 | harfBuzz-14.3.1 | https://github.com/harfbuzz/harfbuzz/releases/download/14.3.1/harfbuzz-14.3.1.tar.xz | `4baccda978c92e5f27702ed8b3ceefa7` |
| 42 | libva-2.24.1 | https://github.com/intel/libva/archive/2.24.1/libva-2.24.1.tar.gz | `6de86c7c9d47963108c52a51af9ac191` |
| 43 | luit-20250912 | https://invisible-mirror.net/archives/luit/luit-20250912.tgz | `d03e636d2f919bb21e77aec16a53247d` |
| 44 | twm-1.0.13.1 | https://www.x.org/pub/individual/app/twm-1.0.13.1.tar.xz | `2a337b776c904eab5b874eddc0124d4f` |
| 45 | xclock-1.2.1 | https://www.x.org/pub/individual/app/xclock-1.2.1.tar.xz | `73ae5b4b4b839e13891f9c7d6970b150` |
| 46 | xterm-411 | https://invisible-mirror.net/archives/xterm/xterm-411.tgz | `08193f9b11db32c37aad00be4e386933` |

## Stage C — Audio (ALSA + PipeWire)

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | alsa-lib-1.2.16.1 | https://www.alsa-project.org/files/pub/lib/alsa-lib-1.2.16.1.tar.bz2 | `c14c9f94f78f76924c13668954997a33` |
| 2 | alsa-utils-1.2.16 | https://www.alsa-project.org/files/pub/utils/alsa-utils-1.2.16.tar.bz2 | `570a1627d47b70ad683ef9f2429ddfca` |
| 3 | alsa-plugins-1.2.12 | https://www.alsa-project.org/files/pub/plugins/alsa-plugins-1.2.12.tar.bz2 | `71fce75baa38efab4e32e40db0a33716` |
| 4 | Cairo-1.18.4 | https://www.cairographics.org/releases/cairo-1.18.4.tar.xz | `db575fb41bbda127e0147e401f36f8ac` |
| 5 | FriBidi-1.0.16 | https://github.com/fribidi/fribidi/releases/download/v1.0.16/fribidi-1.0.16.tar.xz | `333ad150991097a627755b752b87f9ff` |
| 6 | Pango-1.58.2 | https://download.gnome.org/sources/pango/1.58/pango-1.58.2.tar.xz | `7b5640fd9adfa24554a88b2b9a6cd3f3` |
| 7 | Graphviz-15.1.1 | https://gitlab.com/graphviz/graphviz/-/archive/15.1.1/graphviz-15.1.1.tar.bz2 | `ec7f236467bcaeb57b69601d4913c5b7` |
| 8 | Vala-0.56.19 | https://download.gnome.org/sources/vala/0.56/vala-0.56.19.tar.xz | `a2dc825de503fad703584cfb0ed50302` |
| 9 | libical-4.0.5 | https://github.com/libical/libical/releases/download/v4.0.5/libical-4.0.5.tar.gz | `9896781cc82bad3b9a2c6c1ee8177347` |
| 10 | BlueZ-5.87 | https://www.kernel.org/pub/linux/bluetooth/bluez-5.87.tar.xz | `6c6f8445ec3d2fa3cc570a671ccea9fa` |
| 11 | CDParanoia-III-10.2 | https://downloads.xiph.org/releases/cdparanoia/cdparanoia-III-10.2.src.tgz | `b304bbe8ab63373924a744eac9ebc652` |
| 12 | gstreamer-1.28.6 | https://gstreamer.freedesktop.org/src/gstreamer/gstreamer-1.28.6.tar.xz | `3d16d7912727ea85ab90b9e5f3bc6e8a` |
| 13 | ISO Codes-4.20.1 | https://salsa.debian.org/iso-codes-team/iso-codes/-/archive/v4.20.1/iso-codes-v4.20.1.tar.gz | `a8f16a62662ec13e55ca255a7c036ee3` |
| 14 | libgudev-238 | https://download.gnome.org/sources/libgudev/238/libgudev-238.tar.xz | `46da30a1c69101c3a13fa660d9ab7b73` |
| 15 | NASM-3.02 | https://www.nasm.us/pub/nasm/releasebuilds/3.02/nasm-3.02.tar.xz | `31ba022fff8de3065b5bc5ad5559188c` |
| 16 | yasm-1.3.0 | https://www.tortall.net/projects/yasm/releases/yasm-1.3.0.tar.gz | `fc9e586751ff789b34b1f21d572d96af` |
| 17 | libjpeg-turbo-3.2.0 | https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.2.0/libjpeg-turbo-3.2.0.tar.gz | `a80f9f1c735b57d3cdd66daed1ba6bb4` |
| 18 | libogg-1.3.6 | https://downloads.xiph.org/releases/ogg/libogg-1.3.6.tar.xz | `529275432dff072f63d4ed0f1f961384` |
| 19 | libvorbis-1.3.7 | https://downloads.xiph.org/releases/vorbis/libvorbis-1.3.7.tar.xz | `50902641d358135f06a8392e61c9ac77` |
| 20 | gst-plugins-base-1.28.6 | https://gstreamer.freedesktop.org/src/gst-plugins-base/gst-plugins-base-1.28.6.tar.xz | `cd0b2bd13e8196d5bfb20459c12a5d9b` |
| 21 | FLAC-1.5.0 | https://github.com/xiph/flac/releases/download/1.5.0/flac-1.5.0.tar.xz | `0bb45bcf74338b00efeec121fff27367` |
| 22 | Opus-1.6.1 | https://downloads.xiph.org/releases/opus/opus-1.6.1.tar.gz | `67cafc438c430aa74eeb605eef670886` |
| 23 | libsndfile-1.2.2 | https://github.com/libsndfile/libsndfile/releases/download/1.2.2/libsndfile-1.2.2.tar.xz | `04e2e6f726da7c5dc87f8cf72f250d04` |
| 24 | Class::Inspector-1.36 | https://cpan.metacpan.org/authors/id/P/PL/PLICEASE/Class-Inspector-1.36.tar.gz | `084c3aeec023639d21ecbaf7d4460b21` |
| 25 | File::ShareDir::Install-0.14 | https://cpan.metacpan.org/authors/id/E/ET/ETHER/File-ShareDir-Install-0.14.tar.gz | `bac4d924f3d863b00648ab56ec0dcbdc` |
| 26 | File::ShareDir-1.118 | https://cpan.metacpan.org/authors/id/R/RE/REHSACK/File-ShareDir-1.118.tar.gz | `0084f730f4e3d4d89703d92b3ea82f54` |
| 27 | XML::Parser-2.59 | https://www.cpan.org/authors/id/T/TO/TODDR/XML-Parser-2.59.tar.gz | `f483e6b8541d60a84e4bf50803e476bc` |
| 28 | Speex-1.2.1 | https://downloads.xiph.org/releases/speex/speex-1.2.1.tar.gz | `fe7bf610883ff202092b92c72fe0fe3e` |
| 29 | PulseAudio-17.0 | https://www.freedesktop.org/software/pulseaudio/releases/pulseaudio-17.0.tar.xz | `c4a3596a26ff4b9dcd0c394dd1d4f8ee` |
| 30 | SBC-2.2 | https://www.kernel.org/pub/linux/bluetooth/sbc-2.2.tar.xz | `f3f1a4e69249241801bc8ddd6050de23` |
| 31 | GLU-9.0.3 | https://archive.mesa3d.org/glu/glu-9.0.3.tar.xz | `06a4fff9179a98ea32ef41b6d83f6b19` |
| 32 | v4l-utils-1.32.0 | https://www.linuxtv.org/downloads/v4l-utils/v4l-utils-1.32.0.tar.xz | `c484b0320a757bd08a785cad7b32147a` |
| 33 | Pipewire-1.6.8 | https://gitlab.freedesktop.org/pipewire/pipewire/-/archive/1.6.8/pipewire-1.6.8.tar.bz2 | `9ae75812a76951c93210a26272c90ef3` |
| 34 | Lua-5.4.8 | https://www.lua.org/ftp/lua-5.4.8.tar.gz | `81cf5265b8634967d8a7480d238168ce` |
| 35 | Wireplumber-0.5.15 | https://gitlab.freedesktop.org/pipewire/wireplumber/-/archive/0.5.15/wireplumber-0.5.15.tar.bz2 | `dba978afa67ba317d99ef03285ad4733` |

## Stage D — Networking: wired, wireless and Bluetooth

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | iptables-1.8.13 | https://www.netfilter.org/projects/iptables/files/iptables-1.8.13.tar.xz | `81b5edf500e2672bfbc744581ff7dc3e` |
| 2 | libndp-1.9 | http://libndp.org/files/libndp-1.9.tar.gz | `9d486750569e7025e5d0afdcc509b93c` |
| 3 | slang-2.3.3 | https://www.jedsoft.org/releases/slang/slang-2.3.3.tar.bz2 | `69015c8300088373eb65ffcc6ed4db8c` |
| 4 | newt-0.52.25 | https://releases.pagure.org/newt/newt-0.52.25.tar.gz | `4857119244d34d18c67c5c6d6e2d746c` |
| 5 | NSPR-4.40 | https://archive.mozilla.org/pub/nspr/releases/v4.40/src/nspr-4.40.tar.gz | `0c3c871158cc9af694f1f7d2b799ffd8` |
| 6 | NSS-3.126 | https://archive.mozilla.org/pub/security/nss/releases/NSS_3_126_RTM/src/nss-3.126.tar.gz | `0ca322cec564a53ac5a59ce130d96f46` |
| 7 | PyCairo-1.29.1 | https://github.com/pygobject/pycairo/releases/download/v1.29.1/pycairo-1.29.1.tar.gz | `fc7c3b4104e88df7dea34af4314b9d12` |
| 8 | PyGObject-3.56.3 | https://download.gnome.org/sources/pygobject/3.56/pygobject-3.56.3.tar.gz | `7fe8fa9ff801a010eca0f0c79f59232b` |
| 9 | NetworkManager-1.58.1 | https://gitlab.freedesktop.org/NetworkManager/NetworkManager/-/releases/1.58.1/downloads/NetworkManager-1.58.1.tar.xz | `7b06b1dd7b56adffc1dbbf3d04bedf8e` |
| 10 | libnl-3.12.0 | https://github.com/thom311/libnl/releases/download/libnl3_12_0/libnl-3.12.0.tar.gz | `f9112ca215807fe65eecd583d8f180cc` |
| 11 | wpa_supplicant-2.12 | https://w1.fi/releases/wpa_supplicant-2.12.tar.gz | `3f1af56655ebca941d2035358331bbc9` |
| 12 | iw-6.17 | https://www.kernel.org/pub/software/network/iw/iw-6.17.tar.xz | `7323e43843f30068ffb6079e15e8e11a` |

## Stage E — The IPRPS Desktop (Xfce + LightDM)

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | at-spi2-core-2.60.6 | https://download.gnome.org/sources/at-spi2-core/2.60/at-spi2-core-2.60.6.tar.xz | `1082626c9a82694b7900f8283b20dfac` |
| 2 | Little CMS-2.19.1 | https://github.com/mm2/Little-CMS/releases/download/lcms2.19.1/lcms2-2.19.1.tar.gz | `541978f73749499e9e0277bfe5a3c868` |
| 3 | libaom-3.14.1 | https://storage.googleapis.com/aom-releases/libaom-3.14.1.tar.gz | `4a689bbc27ec095d253ed8d241077ad5` |
| 4 | libde265-1.1.1 | https://github.com/strukturag/libde265/releases/download/v1.1.1/libde265-1.1.1.tar.gz | `e9a8ccb8185b5191e712b8a5fa1d1bfc` |
| 5 | x265-4.2 | https://bitbucket.org/multicoreware/x265_git/downloads/x265_4.2.tar.gz | `0a7edcf495aba9f320047d61647d610b` |
| 6 | libheif-1.23.1 | https://github.com/strukturag/libheif/releases/download/v1.23.1/libheif-1.23.1.tar.gz | `26fd31d0591ab927ef1a638de64cb2da` |
| 7 | brotli-1.2.0 | https://github.com/google/brotli/archive/v1.2.0/brotli-1.2.0.tar.gz | `8fbfae9a5ecbc278ae7f761ecb6d1285` |
| 8 | giflib-6.1.3 | https://sourceforge.net/projects/giflib/files/giflib-6.1.3.tar.gz | `a70e90ff780e9ebee9cb84b82bbd46a7` |
| 9 | highway-1.4.0 | https://github.com/google/highway/archive/1.4.0/highway-1.4.0.tar.gz | `9d335797777e17f827c7980b8313a34b` |
| 10 | libjxl-0.12.0 | https://github.com/libjxl/libjxl/archive/v0.12.0/libjxl-0.12.0.tar.gz | `a0fd3ac7b474525dadb99bbcb5d814f9` |
| 11 | cargo-c-0.10.24 | https://github.com/lu-zero/cargo-c/archive/v0.10.24/cargo-c-0.10.24.tar.gz | `b6247bf8f5eac962f001ee8a37f1c25f` |
| 12 | librsvg-2.62.3 | https://download.gnome.org/sources/librsvg/2.62/librsvg-2.62.3.tar.xz | `bf6d56ffe4cfa5426cf1a67bcabdf5ce` |
| 13 | libseccomp-2.6.1 | https://github.com/seccomp/libseccomp/releases/download/v2.6.1/libseccomp-2.6.1.tar.gz | `33a3a5d4c526a739515ff4dc53cdc192` |
| 14 | glycin-2.1.5 | https://download.gnome.org/sources/glycin/2.1/glycin-2.1.5.tar.xz | `d9224a846ad1ed964d07e1ebb48d4458` |
| 15 | gdk-pixbuf-2.44.7 | https://download.gnome.org/sources/gdk-pixbuf/2.44/gdk-pixbuf-2.44.7.tar.xz | `2a12da2133476b7b36fbfcadd7133315` |
| 16 | libxkbcommon-1.13.2 | https://github.com/lfs-book/libxkbcommon/archive/v1.13.2/libxkbcommon-1.13.2.tar.gz | `07f838f575d62c267cfc53eaf5ee739b` |
| 17 | GTK-3.24.52 | https://download.gnome.org/sources/gtk/3.24/gtk-3.24.52.tar.xz | `4dfad1e56bf8ad25dfab58add17e7146` |
| 18 | startup-notification-0.12 | https://www.freedesktop.org/software/startup-notification/releases/startup-notification-0.12.tar.gz | `2cd77326d4dcaed9a5a23a1232fb38e9` |
| 19 | libxfce4util-4.20.1 | https://archive.xfce.org/src/xfce/libxfce4util/4.20/libxfce4util-4.20.1.tar.bz2 | `8e30b7735333f74d80c379e15d9da145` |
| 20 | Xfconf-4.20.0 | https://archive.xfce.org/src/xfce/xfconf/4.20/xfconf-4.20.0.tar.bz2 | `ca596ff0a9be7fa655bb09cb05458644` |
| 21 | libxfce4ui-4.20.2 | https://archive.xfce.org/src/xfce/libxfce4ui/4.20/libxfce4ui-4.20.2.tar.bz2 | `ce54074a9ed7964b4a3274e8ac74d949` |
| 22 | Exo-4.20.0 | https://archive.xfce.org/src/xfce/exo/4.20/exo-4.20.0.tar.bz2 | `f059ec3d8686d4b322c42d19ebec0366` |
| 23 | lxml-6.1.1 | https://files.pythonhosted.org/packages/source/l/lxml/lxml-6.1.1.tar.gz | `6bbd3674ecba1340b08c9180afef1829` |
| 24 | itstool-2.0.7 | https://github.com/itstool/itstool/archive/2.0.7/itstool-2.0.7.tar.gz | `e759b258617a912acce630de3fa43957` |
| 25 | Pathspec-1.1.1 | https://files.pythonhosted.org/packages/source/p/pathspec/pathspec-1.1.1.tar.gz | `c762d0a00d6cfc9de003e02d5072b26a` |
| 26 | vcs_versioning-2.2.4 | https://files.pythonhosted.org/packages/source/v/vcs_versioning/vcs_versioning-2.2.4.tar.gz | `4379f311792d41c845f9b86975b1be18` |
| 27 | Setuptools_scm-10.1.2 | https://files.pythonhosted.org/packages/source/s/setuptools_scm/setuptools_scm-10.1.2.tar.gz | `fc7dfeae0b61636e3705547acc9f3276` |
| 28 | Pluggy-1.6.0 | https://files.pythonhosted.org/packages/source/p/pluggy/pluggy-1.6.0.tar.gz | `54391218af778acb006c2d915085d469` |
| 29 | Poetry-core-2.4.1 | https://files.pythonhosted.org/packages/source/p/poetry_core/poetry_core-2.4.1.tar.gz | `6c4fb726467b1e270892f51c54c392ba` |
| 30 | Tomlkit-0.15.1 | https://files.pythonhosted.org/packages/source/t/tomlkit/tomlkit-0.15.1.tar.gz | `8e5245fd4099c9a6f99774b24a4591ae` |
| 31 | Trove-Classifiers-2026.6.1.19 | https://files.pythonhosted.org/packages/source/t/trove_classifiers/trove_classifiers-2026.6.1.19.tar.gz | `fb231b2e9492a5d34fb9bec0250f0f55` |
| 32 | Hatchling-1.32.0 | https://files.pythonhosted.org/packages/source/h/hatchling/hatchling-1.32.0.tar.gz | `e5870c28ce4403c12b3d9a4a4f8866fe` |
| 33 | Pygments-2.20.0 | https://files.pythonhosted.org/packages/source/P/Pygments/pygments-2.20.0.tar.gz | `358297d0a1db8e4beff8eebc0620960e` |
| 34 | GTK-Doc-1.36.1 | https://download.gnome.org/sources/gtk-doc/1.36/gtk-doc-1.36.1.tar.xz | `819b11aa730cf5108f1df3f0eec91cf9` |
| 35 | Intltool-0.51.0 | http://launchpad.net/intltool/trunk/0.51.0/+download/intltool-0.51.0.tar.gz | `12e517cac2b57a0121cda351570f1e63` |
| 36 | libgpg-error-1.61 | https://www.gnupg.org/ftp/gcrypt/libgpg-error/libgpg-error-1.61.tar.bz2 | `c89a8c6825cb64c527d5c1c0fb36f245` |
| 37 | libgcrypt-1.12.2 | https://www.gnupg.org/ftp/gcrypt/libgcrypt/libgcrypt-1.12.2.tar.bz2 | `4e98430cfc16d842a7231026c32418da` |
| 38 | libxklavier-5.4 | https://people.freedesktop.org/~svu/libxklavier-5.4.tar.bz2 | `13af74dcb6011ecedf1e3ed122bd31fa` |
| 39 | lightdm-1.33.1 | https://github.com/ubuntu/lightdm/archive/1.33.1/lightdm-1.33.1.tar.gz | `1e228e940a9e97a59a4e67b07836ad17` |
| 40 | desktop-file-utils-0.28 | https://www.freedesktop.org/software/desktop-file-utils/releases/desktop-file-utils-0.28.tar.xz | `dec5d7265c802db1fde3980356931b7b` |
| 41 | libwnck-43.3 | https://download.gnome.org/sources/libwnck/43/libwnck-43.3.tar.xz | `61938ba1c41f38c9c12033aca5706598` |
| 42 | libdisplay-info-0.4.0 | https://gitlab.freedesktop.org/emersion/libdisplay-info/-/releases/0.4.0/downloads/libdisplay-info-0.4.0.tar.xz | `af9f07493bd5ff560a98b95ea4c5c129` |
| 43 | xfce4-dev-tools-4.20.0 | http://archive.xfce.org/src/xfce/xfce4-dev-tools/4.20/xfce4-dev-tools-4.20.0.tar.bz2 | `bea58046e67b4274c022fcff893fa350` |
| 44 | libxfce4windowing-4.20.7 | https://archive.xfce.org/src/xfce/libxfce4windowing/4.20/libxfce4windowing-4.20.7.tar.bz2 | `7f409dec4961e9340a29b273029453d2` |
| 45 | json-c-0.19 | https://s3.amazonaws.com/json-c_releases/releases/json-c-0.19.tar.gz | `5678f1373ba51e0041b574c0411c696b` |
| 46 | AccountsService-26.27.3 | https://gitlab.freedesktop.org/accountsservice/accountsservice/-/archive/26.27.3/accountsservice-26.27.3.tar.bz2 | `61f56055b9d4564ad29bab799222e386` |
| 47 | polkit-gnome-0.105 | https://download.gnome.org/sources/polkit-gnome/0.105/polkit-gnome-0.105.tar.xz | `50ecad37c8342fb4a52f590db7530621` |
| 48 | XScreenSaver-6.15 | https://www.jwz.org/xscreensaver/xscreensaver-6.15.tar.gz | `65cd8d94841019763e1246df097612ff` |
| 49 | xfce4-session-4.20.4 | https://archive.xfce.org/src/xfce/xfce4-session/4.20/xfce4-session-4.20.4.tar.bz2 | `048a3f838449dd75d358779b528b0a63` |
| 50 | Garcon-4.20.0 | https://archive.xfce.org/src/xfce/garcon/4.20/garcon-4.20.0.tar.bz2 | `fe17e9cb15a62013e0086183a446e89e` |
| 51 | xfce4-panel-4.20.8 | https://archive.xfce.org/src/xfce/xfce4-panel/4.20/xfce4-panel-4.20.8.tar.bz2 | `c4c7919a07c2c48cffea7a608ea86803` |
| 52 | libnotify-0.8.8 | https://download.gnome.org/sources/libnotify/0.8/libnotify-0.8.8.tar.xz | `35bef24dc1e9a336394556d09345e078` |
| 53 | thunar-4.20.9 | https://archive.xfce.org/src/xfce/thunar/4.20/thunar-4.20.9.tar.bz2 | `7d6daadb0c241ebfaed2684950a67f74` |
| 54 | thunar-volman-4.20.0 | https://archive.xfce.org/src/xfce/thunar-volman/4.20/thunar-volman-4.20.0.tar.bz2 | `34c8e0af77ea3894db7e3d164998f9bf` |
| 55 | tumbler-4.20.2 | https://archive.xfce.org/src/xfce/tumbler/4.20/tumbler-4.20.2.tar.bz2 | `544cd05cf6ec8d16c8c812529d09b34b` |
| 56 | xfce4-appfinder-4.20.0 | https://archive.xfce.org/src/xfce/xfce4-appfinder/4.20/xfce4-appfinder-4.20.0.tar.bz2 | `e60f6c2521a985c6cfe09057d4fb2d69` |
| 57 | UPower-1.91.3 | https://gitlab.freedesktop.org/upower/upower/-/archive/v1.91.3/upower-v1.91.3.tar.bz2 | `bf09da2eb695224e249e38077460414c` |
| 58 | xfce4-power-manager-4.20.1 | https://archive.xfce.org/src/xfce/xfce4-power-manager/4.20/xfce4-power-manager-4.20.1.tar.bz2 | `021ff5a9f6111e3bedfad87dddf91420` |
| 59 | libcanberra-0.30 | https://0pointer.de/lennart/projects/libcanberra/libcanberra-0.30.tar.xz | `34cb7e4430afaf6f447c4ebdb9b42072` |
| 60 | xfce4-settings-4.20.5 | https://archive.xfce.org/src/xfce/xfce4-settings/4.20/xfce4-settings-4.20.5.tar.bz2 | `681c73af0e2db6f0e13ff61db265556c` |
| 61 | Xfdesktop-4.20.2 | https://archive.xfce.org/src/xfce/xfdesktop/4.20/xfdesktop-4.20.2.tar.bz2 | `8789870145b82f5ba4f35c8a6522db2e` |
| 62 | Xfwm4-4.20.0 | https://archive.xfce.org/src/xfce/xfwm4/4.20/xfwm4-4.20.0.tar.bz2 | `e74cfb30b6e9ebf9cbaac0827dd534e3` |
| 63 | fast_float-8.2.10 | https://github.com/fastfloat/fast_float/archive/v8.2.10/fast_float-8.2.10.tar.gz | `ddcf64ffe15f1e1ed964a355db7a04f3` |
| 64 | fmt-12.2.0 | https://github.com/fmtlib/fmt/archive/12.2.0/fmt-12.2.0.tar.gz | `7be257d8bfad55bc9eabb1288ad895be` |
| 65 | Nettle-4.0 | https://ftp.gnu.org/gnu/nettle/nettle-4.0.tar.gz | `144401453f9f35e53938bcacfc59800e` |
| 66 | GnuTLS-3.8.13 | https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/gnutls-3.8.13.tar.xz | `a97671c1839340c6b43c23ccb3237180` |
| 67 | glslc from shaderc-2026.3 | https://github.com/google/shaderc/archive/v2026.3/shaderc-2026.3.tar.gz | `5ce02d42b02a77e6165dbc476d1a334c` |
| 68 | Graphene-1.10.8 | https://download.gnome.org/sources/graphene/1.10/graphene-1.10.8.tar.xz | `169e3c507b5a5c26e9af492412070b81` |
| 69 | libdvdread-7.1.1 | https://get.videolan.org/libdvdread/7.1.1/libdvdread-7.1.1.tar.xz | `bfd662e9180dabad03bae95292b38a50` |
| 70 | libdvdnav-7.0.0 | https://get.videolan.org/libdvdnav/7.0.0/libdvdnav-7.0.0.tar.xz | `e9e9f137cdd52828abc0c61b727ea579` |
| 71 | SoundTouch-2.4.1 | https://www.surina.net/soundtouch/soundtouch-2.4.1.tar.gz | `6e8732dea92b6e65fc4ee75528ab0524` |
| 72 | SVT-AV1-4.2.0 | https://gitlab.com/AOMediaCodec/SVT-AV1/-/archive/v4.2.0/SVT-AV1-v4.2.0.tar.gz | `a40beb25d550ed1ddf26aa372f2dca42` |
| 73 | gst-plugins-bad-1.28.6 | https://gstreamer.freedesktop.org/src/gst-plugins-bad/gst-plugins-bad-1.28.6.tar.xz | `cdc3c30609d2d235d9322a676a5d4474` |
| 74 | GTK-4.22.4 | https://download.gnome.org/sources/gtk/4.22/gtk-4.22.4.tar.xz | `2420b9b289937c1c9f97332470db1889` |
| 75 | simdutf-9.0.0 | https://github.com/simdutf/simdutf/archive/v9.0.0/simdutf-9.0.0.tar.gz | `a20af35e2a7c9737d97b7beae96e7146` |
| 76 | VTE-0.84.1 | https://gitlab.gnome.org/GNOME/vte/-/archive/0.84.1/vte-0.84.1.tar.gz | `9733f0218f72051999e42725fe5fbaa8` |
| 77 | xfce4-terminal-1.2.0 | https://archive.xfce.org/src/apps/xfce4-terminal/1.2/xfce4-terminal-1.2.0.tar.xz | `1662d52f7ffdcfde7c4ef76fd2358947` |
| 78 | Aspell-0.60.8.2 | https://ftp.gnu.org/gnu/aspell/aspell-0.60.8.2.tar.gz | `bc3f30321db5d44f112ab66084421225` |
| 79 | enchant-2.8.19 | https://github.com/rrthomas/enchant/releases/download/v2.8.19/enchant-2.8.19.tar.gz | `b06fe4ea79687202ec58ce58bd4f5867` |
| 80 | gspell-1.14.4 | https://download.gnome.org/sources/gspell/1.14/gspell-1.14.4.tar.xz | `f2baf4a418c57e0dc044d50ffc0dcf62` |
| 81 | gtksourceview4-4.8.4 | https://download.gnome.org/sources/gtksourceview/4.8/gtksourceview-4.8.4.tar.xz | `2bf056caaae27654ec3a5930dd5597d3` |
| 82 | mousepad-0.7.0 | https://archive.xfce.org/src/apps/mousepad/0.7/mousepad-0.7.0.tar.xz | `96c09736fd02da599ffedf215313328f` |
| 83 | libexif-0.6.26 | https://github.com/libexif/libexif/releases/download/v0.6.26/libexif-0.6.26.tar.bz2 | `d659a750d1be6330105de54eb3bf627a` |
| 84 | ristretto-0.14.0 | https://archive.xfce.org/src/apps/ristretto/0.14/ristretto-0.14.0.tar.xz | `63b94c3e3fab28c4533697f36ee6caa2` |
| 85 | xfce4-notifyd-0.9.7 | https://archive.xfce.org/src/apps/xfce4-notifyd/0.9/xfce4-notifyd-0.9.7.tar.bz2 | `d5bfe1fd8e8da9d64367a1f520d88633` |
| 86 | keybinder-3.0-0.3.2 | https://github.com/kupferlauncher/keybinder/releases/download/keybinder-3.0-v0.3.2/keybinder-3.0-0.3.2.tar.gz | `97260321fda721fce799174ea6ba10cf` |
| 87 | xfce4-pulseaudio-plugin-0.5.1 | https://archive.xfce.org/src/panel-plugins/xfce4-pulseaudio-plugin/0.5/xfce4-pulseaudio-plugin-0.5.1.tar.xz | `186a097794ced3612713c2098ec0b51c` |
| 88 | xarchiver-0.5.4.27 | https://github.com/ib/xarchiver/archive/0.5.4.27/xarchiver-0.5.4.27.tar.gz | `8a6fb3ab5c0161e3fa05ec6a1faf2c12` |
| 89 | libassuan-3.0.2 | https://www.gnupg.org/ftp/gcrypt/libassuan/libassuan-3.0.2.tar.bz2 | `c6f1bf4bd2aaa79cd1635dcc070ba51a` |
| 90 | libksba-1.8.0 | https://www.gnupg.org/ftp/gcrypt/libksba/libksba-1.8.0.tar.bz2 | `182951961170c12f6569454717a1383a` |
| 91 | npth-1.8 | https://www.gnupg.org/ftp/gcrypt/npth/npth-1.8.tar.bz2 | `cb4fc0402be5ba67544e499cb2c1a74d` |
| 92 | lmdb-1.0.1 | https://git.openldap.org/openldap/openldap/-/archive/LMDB_1.0.1/openldap-LMDB_1.0.1.tar.bz2 | `f060b9e036cd5d998b7b3ca1498d7715` |
| 93 | Cyrus SASL-2.1.28 | https://github.com/cyrusimap/cyrus-sasl/releases/download/cyrus-sasl-2.1.28/cyrus-sasl-2.1.28.tar.gz | `6f228a692516f5318a64505b46966cfa` |
| 94 | OpenLDAP-2.7.0 | https://www.openldap.org/software/download/OpenLDAP/openldap-release/openldap-2.7.0.tgz | `fcb40191baba83c1f237d79f85835283` |
| 95 | pinentry-1.3.3 | https://www.gnupg.org/ftp/gcrypt/pinentry/pinentry-1.3.3.tar.bz2 | `59a65644180ac2a43a1235d698515b36` |
| 96 | GnuPG-2.5.21 | https://www.gnupg.org/ftp/gcrypt/gnupg/gnupg-2.5.21.tar.bz2 | `39311d55044c9548b5eb8f53466a86b5` |
| 97 | libsecret-0.21.7 | https://download.gnome.org/sources/libsecret/0.21/libsecret-0.21.7.tar.xz | `7a938a802a3c17df441fbd0358866e99` |
| 98 | Gcr-4.4.0.1 | https://download.gnome.org/sources/gcr/4.4/gcr-4.4.0.1.tar.xz | `01da4445b5b16801c6dcc7d8945b4cc4` |
| 99 | libcdio-2.1.0 | https://ftp.gnu.org/gnu/libcdio/libcdio-2.1.0.tar.bz2 | `aa7629e8f73662a762f64c444b901055` |
| 100 | gsettings-desktop-schemas-50.1 | https://download.gnome.org/sources/gsettings-desktop-schemas/50/gsettings-desktop-schemas-50.1.tar.xz | `b3851a1d2dd684f7ea1a1d032e2a7dfb` |
| 101 | glib-networking-2.80.1 | https://download.gnome.org/sources/glib-networking/2.80/glib-networking-2.80.1.tar.xz | `405e6c058723217a1307ba8415615f9d` |
| 102 | libsoup-3.6.6 | https://download.gnome.org/sources/libsoup/3.6/libsoup-3.6.6.tar.xz | `9e07742595800ecf301eafb52300dd89` |
| 103 | cryptsetup-2.8.7 | https://www.kernel.org/pub/linux/utils/cryptsetup/v2.8/cryptsetup-2.8.7.tar.xz | `a9a19068e4db32f77c0ab95c378ab290` |
| 104 | keyutils-1.6.3 | https://git.kernel.org/pub/scm/linux/kernel/git/dhowells/keyutils.git/snapshot/keyutils-1.6.3.tar.gz | `6b70b2b381c1b6d9adfaf66d5d3e7c00` |
| 105 | libatasmart-0.19 | https://0pointer.de/public/libatasmart-0.19.tar.xz | `53afe2b155c36f658e121fe6def33e77` |
| 106 | libbytesize-2.12 | https://github.com/storaged-project/libbytesize/releases/download/2.12/libbytesize-2.12.tar.gz | `5314b773b20d1f3acdf3b2bf0c92549f` |
| 107 | libnvme-1.16.2 | https://github.com/linux-nvme/libnvme/archive/v1.16.2/libnvme-1.16.2.tar.gz | `a6554fb50022d762021fc1e949e01520` |
| 108 | libblockdev-3.5.0 | https://github.com/storaged-project/libblockdev/releases/download/3.5.0/libblockdev-3.5.0.tar.gz | `68448042ea0a2073098fc4ae37b01cbf` |
| 109 | UDisks-2.11.2 | https://github.com/storaged-project/udisks/releases/download/udisks-2.11.2/udisks-2.11.2.tar.bz2 | `9e8e8c7f43257bc501b4896f43db9eb8` |
| 110 | Gvfs-1.60.2 | https://download.gnome.org/sources/gvfs/1.60/gvfs-1.60.2.tar.xz | `467f7d017234e5aab24d8e0a4e09deff` |
| 111 | Lynx-2.9.3 | https://invisible-mirror.net/archives/lynx/tarballs/lynx2.9.3.tar.bz2 | `faedd64b8e3cb87ae41197340cc3016a` |
| 112 | xmlto-0.0.29 | https://pagure.io/xmlto/archive/0.0.29/xmlto-0.0.29.tar.gz | `9d9e9b2ebfca1e453f5e1599b82c48cc` |
| 113 | xdg-utils-1.2.1 | https://gitlab.freedesktop.org/xdg/xdg-utils/-/archive/v1.2.1/xdg-utils-v1.2.1.tar.gz | `4c72585a98ba8f775cb9e72b066cc0df` |
| 114 | Xdg-user-dirs-0.20 | https://gitlab.freedesktop.org/xdg/xdg-user-dirs/-/archive/v0.20/xdg-user-dirs-v0.20.tar.gz | `a80c6f2cc9fd3d9870fcda76d73ce3e6` |
| 115 | adwaita-icon-theme-50.0 | https://download.gnome.org/sources/adwaita-icon-theme/50/adwaita-icon-theme-50.0.tar.xz | `a03d8d68377a88fcf06e090ba6a6ec2f` |
| 116 | gnome-themes-extra-3.28 | https://download.gnome.org/sources/gnome-themes-extra/3.28/gnome-themes-extra-3.28.tar.xz | `f9f2c6c521948da427f702372e16f826` |
| 117 | TTF and OTF fonts | — | `—` |
| 118 | libmbim-1.34.0 | https://gitlab.freedesktop.org/mobile-broadband/libmbim/-/archive/1.34.0/libmbim-1.34.0.tar.gz | `e5c2b38c6a79a047b93cb0c9510bd91f` |
| 119 | libqmi-1.38.0 | https://gitlab.freedesktop.org/mobile-broadband/libqmi/-/archive/1.38.0/libqmi-1.38.0.tar.gz | `4ed2c13150611007f56f84b896449d46` |
| 120 | ModemManager-1.24.2 | https://gitlab.freedesktop.org/mobile-broadband/ModemManager/-/archive/1.24.2/ModemManager-1.24.2.tar.gz | `b72860c54670f362e947edba160fa98e` |
| 121 | Gcr-3.41.2 | https://download.gnome.org/sources/gcr/3.41/gcr-3.41.2.tar.xz | `40a754ba44d5e95e4d07656d6302900c` |
| 122 | libnma-1.10.6 | https://download.gnome.org/sources/libnma/1.10/libnma-1.10.6.tar.xz | `71c7ce674fea1fae8f1368a7fcb6ff43` |
| 123 | network-manager-applet-1.34.0 | https://download.gnome.org/sources/network-manager-applet/1.34/network-manager-applet-1.34.0.tar.xz | `83ff059aff3a691766d5f0079209e5af` |
| 124 | Bubblewrap-0.11.2 | https://github.com/containers/bubblewrap/releases/download/v0.11.2/bubblewrap-0.11.2.tar.xz | `6376255e2e505100e01b20c2dafa7faf` |
| 125 | Fuse-3.18.2 | https://github.com/libfuse/libfuse/releases/download/fuse-3.18.2/fuse-3.18.2.tar.gz | `43c6f6cd2c1368d916f6fb080eb39cbb` |
| 126 | hicolor-icon-theme-0.18 | https://icon-theme.freedesktop.org/releases/hicolor-icon-theme-0.18.tar.xz | `ef14f3af03bcde9ed134aad626bdbaad` |
| 127 | XML::Simple-2.25 | https://www.cpan.org/authors/id/G/GR/GRANTM/XML-Simple-2.25.tar.gz | `bb841dce889a26c89a1c2739970e9fbc` |
| 128 | icon-naming-utils-0.8.90 | https://tango.freedesktop.org/releases/icon-naming-utils-0.8.90.tar.bz2 | `dd8108b56130b9eedc4042df634efa66` |
| 129 | gnome-icon-theme-3.12.0 | https://download.gnome.org/sources/gnome-icon-theme/3.12/gnome-icon-theme-3.12.0.tar.xz | `f14bed7f804e843189ffa7021141addd` |
| 130 | gnome-keyring-50.0 | https://download.gnome.org/sources/gnome-keyring/50/gnome-keyring-50.0.tar.xz | `406fb764c664de580a091527af059750` |
| 131 | LAME-3.100 | https://downloads.sourceforge.net/lame/lame-3.100.tar.gz | `83e260acbe4389b54fe08e0bdbf7cddb` |
| 132 | libvpx-1.16.0 | https://github.com/webmproject/libvpx/archive/v1.16.0/libvpx-1.16.0.tar.gz | `fb51551487ecfdec93f3d243b7fb1a67` |
| 133 | mpg123-1.33.7 | https://downloads.sourceforge.net/mpg123/mpg123-1.33.7.tar.bz2 | `46ceab9bfb0f04e739f010b88de5943d` |
| 134 | gst-plugins-good-1.28.6 | https://gstreamer.freedesktop.org/src/gst-plugins-good/gst-plugins-good-1.28.6.tar.xz | `d84c17388909e98e7f7d81bb2717327c` |
| 135 | json-glib-1.10.8 | https://download.gnome.org/sources/json-glib/1.10/json-glib-1.10.8.tar.xz | `95c3d5dd56d4ada808480739889b75bc` |
| 136 | lxde-icon-theme-0.5.1 | https://downloads.sourceforge.net/lxde/lxde-icon-theme-0.5.1.tar.xz | `7467133275edbbcc79349379235d4411` |
| 137 | sound-theme-freedesktop-0.8 | https://people.freedesktop.org/~mccann/dist/sound-theme-freedesktop-0.8.tar.bz2 | `d7387912cfd275282d1ec94483cb2f62` |
| 138 | xdg-desktop-portal-1.22.1 | https://github.com/flatpak/xdg-desktop-portal/releases/download/1.22.1/xdg-desktop-portal-1.22.1.tar.xz | `edfbfffe55a35920a303404b6c5d49a0` |
| 139 | xdg-desktop-portal-gtk-1.15.3 | https://github.com/flatpak/xdg-desktop-portal-gtk/releases/download/1.15.3/xdg-desktop-portal-gtk-1.15.3.tar.xz | `2d6e2ad2953c386a1db11618fa3803b0` |

## Stage F — Web server and database

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | Apr-1.7.6 | https://archive.apache.org/dist/apr/apr-1.7.6.tar.bz2 | `2ebb58910e426e5a83af97bc94cae66d` |
| 2 | Apr-Util-1.6.5 | https://archive.apache.org/dist/apr/apr-util-1.6.5.tar.bz2 | `3897a2f32d365a8281fbb90d1c2794ac` |
| 3 | Apache-2.4.68 | https://archive.apache.org/dist/httpd/httpd-2.4.68.tar.bz2 | `f2f3121e9f1fb4838d433dbd494543f9` |
| 4 | PHP-8.5.9 | https://www.php.net/distributions/php-8.5.9.tar.xz | `26b8387c7c772c57c1f990369530b3d5` |
| 5 | libevent-2.1.13 | https://github.com/libevent/libevent/releases/download/release-2.1.13-stable/libevent-2.1.13-stable.tar.gz | `eaa0bd3472b5d6a52ac6b9e0b7418b03` |
| 6 | MariaDB-12.3.3 | https://downloads.mariadb.org/interstitial/mariadb-12.3.3/source/mariadb-12.3.3.tar.gz | `83d962d0f5917a0445786cc31337b118` |

## Stage G — Lite edition apps

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | dav1d-1.5.4 | https://code.videolan.org/videolan/dav1d/-/archive/1.5.4/dav1d-1.5.4.tar.gz | `af9b8fdb97f436a76b73425ed16b6239` |
| 2 | SDL3-3.4.14 | https://www.libsdl.org/release/SDL3-3.4.14.tar.gz | `32968d1180d29903e70cd3f7fc38470b` |
| 3 | sdl2-compat-2.32.70 | https://www.libsdl.org/release/sdl2-compat-2.32.70.tar.gz | `ba9179f09652a6395b3673e4ce8c473b` |
| 4 | tiff-4.7.2 | https://download.osgeo.org/libtiff/tiff-4.7.2.tar.gz | `a2a65ea450b8f469c667128848ffebfc` |
| 5 | libwebp-1.6.0 | https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.6.0.tar.gz | `cceb6447180f961473b181c9ef38b630` |
| 6 | c-ares-1.34.8 | https://github.com/c-ares/c-ares/releases/download/v1.34.8/c-ares-1.34.8.tar.gz | `a0568780ffe1476160a6bbb4b6737261` |
| 7 | Node.js-24.19.0 | https://nodejs.org/dist/v24.19.0/node-v24.19.0.tar.xz | `9746bea71fd37c5ec17236b713e0879f` |
| 8 | Firefox-153.2.0esr | https://archive.mozilla.org/pub/firefox/releases/153.2.0esr/source/firefox-153.2.0esr.source.tar.xz | `127f9c7fe72cf8cc9a47f35a051303f0` |
| 9 | libhandy-1.8.3 | https://download.gnome.org/sources/libhandy/1.8/libhandy-1.8.3.tar.xz | `af586a91ff6d4093a6e7e283dfab5f7f` |
| 10 | OpenJPEG-2.5.4 | https://github.com/uclouvain/openjpeg/archive/v2.5.4/openjpeg-2.5.4.tar.gz | `6160de075bb5191e482bc0f024b375e4` |
| 11 | boost-1.92.0 | https://github.com/boostorg/boost/releases/download/boost-1.92.0/boost-1.92.0-b2-nodocs.tar.xz | `01f7ba6534c21e1b49dc9f69524bf5e4` |
| 12 | Poppler-26.08.0 | https://poppler.freedesktop.org/poppler-26.08.0.tar.xz | `0c7953c55c449f20d97adbe355bcf49d` |
| 13 | Evince-48.4 | https://download.gnome.org/sources/evince/48/evince-48.4.tar.xz | `5df36228e83ac93a5860f013af50c5c8` |
| 14 | dbus-glib-0.114 | https://dbus.freedesktop.org/releases/dbus-glib/dbus-glib-0.114.tar.gz | `188792077e880a8c0359288d7819dab3` |
| 15 | utfcpp-4.1.1 | https://github.com/nemtrif/utfcpp/archive/v4.1.1/utfcpp-4.1.1.tar.gz | `2b439bf8f222cd85bac0d2603265a246` |
| 16 | Taglib-2.3.1 | https://taglib.org/releases/taglib-2.3.1.tar.gz | `b189dcfcf284179c04b97a89887e0ce6` |
| 17 | Parole-4.20.0 | https://archive.xfce.org/src/apps/parole/4.20/parole-4.20.0.tar.xz | `388dee33b1d06ee89f007b4cb08dedaf` |
| 18 | libass-0.17.5 | https://github.com/libass/libass/releases/download/0.17.5/libass-0.17.5.tar.xz | `d9aeb9dac0ca97acbaae96c35af4013b` |
| 19 | x264-20250815 | https://anduin.linuxfromscratch.org/BLFS/x264/x264-20250815.tar.xz | `a4adb6f7d2644043765885e54abc3955` |
| 20 | FFmpeg-9.0.1 | https://ffmpeg.org/releases/ffmpeg-9.0.1.tar.xz | `3ed2aab5ce5d18a3c5e0d22d8ca3fadb` |
| 21 | Glad-2.0.8 | https://github.com/Dav1dde/glad/archive/v2.0.8/glad-2.0.8.tar.gz | `028c39d581e6b53e53871f1dc21cf442` |
| 22 | libplacebo-7.360.1 | https://github.com/haasn/libplacebo/archive/v7.360.1/libplacebo-7.360.1.tar.gz | `e0fa1b52f8d7b7ba51373e9a639ca966` |
| 23 | luajit-20260213 | https://anduin.linuxfromscratch.org/BLFS/luajit/luajit-20260213.tar.xz | `6459b2696188b74edf950926cb3bacd1` |
| 24 | Uchardet-0.0.8 | https://www.freedesktop.org/software/uchardet/releases/uchardet-0.0.8.tar.xz | `9e267be7aee81417e5875086dd9d44fd` |
| 25 | mpv-0.41.0 | https://github.com/mpv-player/mpv/archive/v0.41.0/mpv-0.41.0.tar.gz | `fa40a0fedeaf0a77127e238a39b9d4c4` |

## Stage H — Medium edition apps

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | CLucene-2.3.3.4 | https://downloads.sourceforge.net/clucene/clucene-core-2.3.3.4.tar.gz | `48d647fbd8ef8889e5a7f422c1bfda94` |
| 2 | libgusb-0.4.9 | https://github.com/hughsie/libgusb/releases/download/0.4.9/libgusb-0.4.9.tar.xz | `354a3227334991ea4e924843c144bd82` |
| 3 | Colord-1.4.8 | https://www.freedesktop.org/software/colord/releases/colord-1.4.8.tar.xz | `4d17dea7fe5460c2ea16aee64dca2ecb` |
| 4 | Cups-2.4.19 | https://github.com/OpenPrinting/cups/releases/download/v2.4.19/cups-2.4.19-source.tar.gz | `06b7a3921812988cdb3198ff74ae381d` |
| 5 | GLM-1.0.3 | https://github.com/g-truc/glm/archive/1.0.3/glm-1.0.3.tar.gz | `2192069d8d0091ff1cca041cdcdc85fe` |
| 6 | libatomic_ops-7.10.0 | https://github.com/bdwgc/libatomic_ops/releases/download/v7.10.0/libatomic_ops-7.10.0.tar.gz | `1de9631daa0781a8c5a8457053d57cf0` |
| 7 | Archive::Zip-1.68 | https://www.cpan.org/authors/id/P/PH/PHRED/Archive-Zip-1.68.tar.gz | `a33993309322164867c99e04a4000ee3` |
| 8 | LibreOffice-26.2.5 | https://download.documentfoundation.org/libreoffice/src/26.2.5/libreoffice-26.2.5.2.tar.xz | `cde5452693205386a34cbf3ce561956b` |
| 9 | docbook-xsl-ns-1.79.2 | https://github.com/docbook/xslt10-stylesheets/releases/download/release/1.79.2/docbook-xsl-1.79.2.tar.bz2 | `4a400f0264a19329c7f95f69e098744a` |
| 10 | libfyaml-0.9.6 | https://github.com/pantoniou/libfyaml/releases/download/v0.9.6/libfyaml-0.9.6.tar.gz | `f6d3756a80cb1ff99714e510cf4ce13d` |
| 11 | libxmlb-0.3.29 | https://github.com/hughsie/libxmlb/releases/download/0.3.29/libxmlb-0.3.29.tar.xz | `83f87e2ce1fd6b34b25e7f5e1443293c` |
| 12 | AppStream-1.1.6 | https://www.freedesktop.org/software/appstream/releases/AppStream-1.1.6.tar.xz | `cc07d222289ec963be208c3757bde6a9` |
| 13 | babl-0.1.128 | https://download.gimp.org/pub/babl/0.1/babl-0.1.128.tar.xz | `47bc0674961d219710a96e03d9e839ad` |
| 14 | gegl-0.4.70 | https://download.gimp.org/pub/gegl/0.4/gegl-0.4.70.tar.xz | `2442d5f0cb97bcc1b50d2082e29c9375` |
| 15 | inih-62 | https://github.com/benhoyt/inih/archive/r62/inih-r62.tar.gz | `c0c6982525958a0376a3cb5bfbee14a0` |
| 16 | Exiv2-0.28.8 | https://github.com/Exiv2/exiv2/archive/v0.28.8/exiv2-0.28.8.tar.gz | `3f3b2d9c3e73880ea8e6bd78c67ea56a` |
| 17 | gexiv2-0.16.2 | https://download.gnome.org/sources/gexiv2/0.16/gexiv2-0.16.2.tar.xz | `ed530cddf2f30e1903e983e5542262f9` |
| 18 | ghostscript-10.07.1 | https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10071/ghostscript-10.07.1.tar.xz | `9e987b203c535d3c7829e1daefb85e98` |
| 19 | libmypaint-1.6.1 | https://github.com/mypaint/libmypaint/releases/download/v1.6.1/libmypaint-1.6.1.tar.xz | `7f1dab2d30ce8a3f494354c7c77a2977` |
| 20 | mypaint-brushes-2.0.2 | https://github.com/mypaint/mypaint-brushes/releases/download/v2.0.2/mypaint-brushes-2.0.2.tar.xz | `ce965cd5d75947b7beca5ed3ee4521d2` |
| 21 | Gimp-3.2.4 | https://download.gimp.org/gimp/v3.2/gimp-3.2.4.tar.xz | `4a5a233cf24e599bbf73084a3583e29f` |
| 22 | Double-conversion-3.4.0 | https://github.com/google/double-conversion/archive/v3.4.0/double-conversion-3.4.0.tar.gz | `cb2e555c32614f680ba928e962dda9be` |
| 23 | GC-8.2.12 | https://github.com/bdwgc/bdwgc/releases/download/v8.2.12/gc-8.2.12.tar.gz | `5e7c74f8bd57f64d3f86673ff3c17230` |
| 24 | gsl-2.8 | https://ftp.gnu.org/gnu/gsl/gsl-2.8.tar.gz | `182ec03204f164e67238c9116591a37d` |
| 25 | libsigc++-2.12.1 | https://download.gnome.org/sources/libsigc++/2.12/libsigc++-2.12.1.tar.xz | `891f1b2dbaebd8007eda8c639bbe1149` |
| 26 | GLibmm-2.66.10 | https://download.gnome.org/sources/glibmm/2.66/glibmm-2.66.10.tar.xz | `04fab47987ee9df63f808959577d153b` |
| 27 | Atkmm-2.28.5 | https://download.gnome.org/sources/atkmm/2.28/atkmm-2.28.5.tar.xz | `c9bdc196eed368c274177b0c1caf140c` |
| 28 | libcairomm-1.0 (cairomm-1.14.6) | https://www.cairographics.org/releases/cairomm-1.14.6.tar.xz | `634242bb797fb6e9d7cfae1a83474d11` |
| 29 | Pangomm-2.46.5 | https://download.gnome.org/sources/pangomm/2.46/pangomm-2.46.5.tar.xz | `4fc19301ccc94e4fb72f1ed54bc65d4d` |
| 30 | Gtkmm-3.24.11 | https://download.gnome.org/sources/gtkmm/3.24/gtkmm-3.24.11.tar.xz | `554154811621e1e411285dde09ca8913` |
| 31 | Potrace-1.16 | https://downloads.sourceforge.net/potrace/potrace-1.16.tar.gz | `5f0bd87ddd9a620b0c4e65652ef93d69` |
| 32 | Inkscape-1.4.4 | https://inkscape.org/gallery/item/59505/inkscape-1.4.4.tar.xz | `60ed50c2de060307ad1a6555c7653458` |
| 33 | Liba52-0.8.0 | https://distfiles.adelielinux.org/source/a52dec/a52dec-0.8.0.tar.gz | `4debeed0257f5312e84d92711a5cfcec` |
| 34 | libmad-0.15.1b | https://downloads.sourceforge.net/mad/libmad-0.15.1b.tar.gz | `1be543bc30c56fb6bea1d7bf6a64e66c` |
| 35 | VLC-3.0.23 | https://download.videolan.org/vlc/3.0.23/vlc-3.0.23.tar.xz | `ebc3f0d0a94785fd2b2df4087516938e` |
| 36 | ImageMagick-7.1.2-13 | https://www.imagemagick.org/archive/releases/ImageMagick-7.1.2-13.tar.xz | `a28a5d65a58fce9c24e8cf4b47cb5c5c` |
| 37 | Freeglut-3.8.0 | https://downloads.sourceforge.net/freeglut/freeglut-3.8.0.tar.gz | `ca8361b5b6a64b07795b41bd24f6a23e` |
| 38 | MuPDF-1.26.12 | https://www.mupdf.com/downloads/archive/mupdf-1.26.12-source.tar.gz | `d10eb7e1ef0f4a44f5c14a29b9d6f906` |
| 39 | pdfio-1.6.4 | https://github.com/michaelrsweet/pdfio/releases/download/v1.6.4/pdfio-1.6.4.tar.gz | `21d128da7e16b8035e5eab0676c7496d` |
| 40 | Qpdf-12.4.0 | https://github.com/qpdf/qpdf/releases/download/v12.4.0/qpdf-12.4.0.tar.gz | `d3156920305cafe5b554dcf36cf3cfe7` |
| 41 | libcupsfilters-2.1.1 | https://github.com/OpenPrinting/libcupsfilters/releases/download/2.1.1/libcupsfilters-2.1.1.tar.xz | `1e3144c242e7ddcee112d41c79266885` |
| 42 | libppd-2.1.1 | https://github.com/OpenPrinting/libppd/releases/download/2.1.1/libppd-2.1.1.tar.xz | `65accc86f9956a1160937b14e0f516a6` |
| 43 | cups-filters-2.0.1 | https://github.com/OpenPrinting/cups-filters/releases/download/2.0.1/cups-filters-2.0.1.tar.xz | `b40d0f135af414666e1c3917983a1bb3` |
| 44 | Gutenprint-5.3.5 | https://downloads.sourceforge.net/gimp-print/gutenprint-5.3.5.tar.xz | `18968a1376a0fb0155afea4ce832d7fd` |
| 45 | libburn-1.5.8 | https://files.libburnia-project.org/releases/libburn-1.5.8.tar.gz | `4c8c786e88eb3e9f7c1d0ddc4d4a39e7` |
| 46 | libisofs-1.5.8.pl02 | https://files.libburnia-project.org/releases/libisofs-1.5.8.pl02.tar.gz | `48150014510f8e65de66cb687ff63957` |
| 47 | Xfburn-0.8.0 | https://archive.xfce.org/src/apps/xfburn/0.8/xfburn-0.8.0.tar.bz2 | `0ae5e3e94c71857b7cd8555f9f18625f` |
| 48 | gmmlib-22.10.0 | https://github.com/lfs-book/gmmlib/archive/v22.10.0/gmmlib-22.10.0.tar.gz | `f94f6903e7df944c7a064f85b1b4a99b` |
| 49 | intel-media-driver-26.2.4 | https://github.com/lfs-book/intel-media-driver/archive/v26.2.4/intel-media-driver-26.2.4.tar.gz | `507c81a204cbb38da19ac915ec16a618` |
| 50 | Msgpack-1.2.1 | https://files.pythonhosted.org/packages/source/m/msgpack/msgpack-1.2.1.tar.gz | `e0a9c82423574f99314ccd1ed77b8c67` |
| 51 | Charset-normalizer-3.4.7 | https://files.pythonhosted.org/packages/source/c/charset-normalizer/charset_normalizer-3.4.7.tar.gz | `68805886064d248d2e5205fd11112d85` |
| 52 | Idna-3.18 | https://files.pythonhosted.org/packages/source/i/idna/idna-3.18.tar.gz | `64359467ec86d86e398b1ae614e5718c` |
| 53 | Hatch_vcs-0.5.0 | https://files.pythonhosted.org/packages/source/h/hatch-vcs/hatch_vcs-0.5.0.tar.gz | `9a22a9f7203783e526959d34510a9672` |
| 54 | Urllib3-2.7.0 | https://files.pythonhosted.org/packages/source/u/urllib3/urllib3-2.7.0.tar.gz | `e79707b798a66c8165c9c441440f4e80` |
| 55 | Requests-2.34.2 | https://files.pythonhosted.org/packages/source/r/requests/requests-2.34.2.tar.gz | `611e438d0803e962500225f9807a475e` |
| 56 | semantic_version-2.10.0 | https://files.pythonhosted.org/packages/source/s/semantic_version/semantic_version-2.10.0.tar.gz | `e48abef93ba69abcd4eaf4640edfc38b` |
| 57 | setuptools_rust-1.12.1 | https://files.pythonhosted.org/packages/source/s/setuptools_rust/setuptools_rust-1.12.1.tar.gz | `90ce501aabce2a859e19a213985288ea` |
| 58 | maturin-1.14.1 | https://github.com/PyO3/maturin/archive/v1.14.1/maturin-1.14.1.tar.gz | `ed60ce01916c36311fa8752b7af00b67` |
| 59 | uv_build-0.11.24 | https://files.pythonhosted.org/packages/source/u/uv_build/uv_build-0.11.24.tar.gz | `f537ded461369ed76aec64e5d2e0269d` |
| 60 | cachecontrol-0.14.4 | https://github.com/psf/cachecontrol/archive/v0.14.4/cachecontrol-0.14.4.tar.gz | `05c8e0cb39b405094ae1d6cdea337521` |
| 61 | CSSSelect-1.5.0 | https://files.pythonhosted.org/packages/source/c/cssselect/cssselect-1.5.0.tar.gz | `465a7b6af9ea95fdefe5357301589b9c` |
| 62 | Pyproject-Metadata-0.12.1 | https://files.pythonhosted.org/packages/source/p/pyproject-metadata/pyproject_metadata-0.12.1.tar.gz | `d44c15fd176128acd9497af2512085a0` |
| 63 | Meson_python-0.20.0 | https://files.pythonhosted.org/packages/source/m/meson_python/meson_python-0.20.0.tar.gz | `032ed60b1d86c448331fc0a2ba81f499` |
| 64 | NumPy-2.5.2 | https://files.pythonhosted.org/packages/source/n/numpy/numpy-2.5.2.tar.gz | `85f9db626b908f4d2211d98b4bf8a83d` |
| 65 | Patchelf-0.19.1 | https://github.com/NixOS/patchelf/releases/download/0.19.1/patchelf-0.19.1.tar.gz | `508702ca6e4ee4638fe4e6dcf8885c95` |
| 66 | pySerial-3.5 | https://files.pythonhosted.org/packages/source/p/pyserial/pyserial-3.5.tar.gz | `1cf25a76da59b530dbfc2cf99392dc83` |
| 67 | six-1.17.0 | https://files.pythonhosted.org/packages/source/s/six/six-1.17.0.tar.gz | `a0387fe15662c71057b4fb2b7aa9056a` |
| 68 | Scour-0.38.2 | https://github.com/scour-project/scour/archive/v0.38.2/scour-0.38.2.tar.gz | `ae30f52602802f8c7df3a32e1f72b325` |

## Stage I — Advanced edition apps (BLFS part)

| # | Package | Download | MD5 |
|---|---|---|---|
| 1 | SANE-1.4.0 | https://anduin.linuxfromscratch.org/BLFS/sane/sane-backends-1.4.0.tar.gz | `fddb8b164ff1b1ffb576c9ba4173610d` |
| 2 | Libspiro-20220722 | https://github.com/fontforge/libspiro/releases/download/20220722/libspiro-dist-20220722.tar.gz | `c21f86e6c1ad65ed4cb1f754f6d7563c` |
| 3 | FontForge-20251009 | https://github.com/fontforge/fontforge/releases/download/20251009/fontforge-20251009.tar.xz | `9407db5126f937618f1f5f1f9ee8aab2` |
| 4 | Libao-1.2.0 | https://downloads.xiph.org/releases/ao/libao-1.2.0.tar.gz | `9f5dd20d7e95fd0dd72df5353829f097` |
| 5 | Cdrdao-1.2.6 | https://downloads.sourceforge.net/cdrdao/cdrdao-1.2.6.tar.bz2 | `f59689d847d56647187d4de487e3487d` |
| 6 | libisoburn-1.5.8.pl02 | https://files.libburnia-project.org/releases/libisoburn-1.5.8.pl02.tar.gz | `008b9adc9ab3545e167495220b453413` |
