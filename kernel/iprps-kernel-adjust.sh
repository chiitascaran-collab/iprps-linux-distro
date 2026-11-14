#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# IPRPS generic kernel: adapt a distro base config (Part 4.4).
# Run in the kernel source folder after: cp ../base-config .config
set -e
scripts/config --set-str LOCALVERSION "-iprps" --disable LOCALVERSION_AUTO \
  --enable DRM_SIMPLEDRM --enable SYSFB_SIMPLEFB --disable FB_EFI \
  --disable DEBUG_INFO_BTF --disable DEBUG_INFO_DWARF4 --disable DEBUG_INFO_DWARF5 \
  --disable DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT --enable DEBUG_INFO_NONE \
  --disable RUST \
  --disable MODULE_SIG --disable MODULE_SIG_ALL --set-str MODULE_SIG_KEY "" \
  --set-str SYSTEM_TRUSTED_KEYS "" --set-str SYSTEM_REVOCATION_KEYS "" \
  --disable MODULE_COMPRESS --disable MODULE_COMPRESS_GZIP \
  --disable MODULE_COMPRESS_XZ --disable MODULE_COMPRESS_ZSTD \
  --enable FW_LOADER_COMPRESS --enable FW_LOADER_COMPRESS_ZSTD --enable FW_LOADER_COMPRESS_XZ \
  --set-str EXTRA_FIRMWARE "" \
  --enable BLK_DEV_INITRD --enable RD_GZIP \
  --enable EFI --enable EFI_STUB --enable X86_X2APIC
make olddefconfig
