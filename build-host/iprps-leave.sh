#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# Unmount everything and detach the IPRPS image (run in Debian, outside the chroot)
R=/mnt/iprps
cd /
if fuser -sm "$R" 2>/dev/null; then
  echo "Still in use. Close these first (exit the chroot windows):"
  fuser -vm "$R" 2>&1 | tail -n +2
  exit 1
fi
rm -f "$R/etc/resolv.conf"
for m in dev/shm dev/pts dev proc sys run build boot/efi; do
  mountpoint -q "$R/$m" && umount -v "$R/$m"
done
mountpoint -q "$R" && umount -v "$R"
sync
for L in $(losetup -j "${IPRPS_IMG:-/root/iprps-system.img}" | cut -d: -f1); do losetup -v -d "$L"; done
echo "Remaining mounts under $R:"; findmnt -R "$R" || echo "  none"
losetup -a | grep iprps || echo "Image detached."
