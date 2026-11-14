#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# Unmount everything and detach the IPRPS image (run in Debian, outside the chroot)
R=/mnt/iprps
cd /
# Background helpers started inside the image (gpg-agent and dirmngr from pacman-key or gpg) keep it busy:
# stop any process whose root directory is the image, except chroot shells, which the user closes
for p in /proc/[0-9]*; do
  [ "$(readlink "$p/root" 2>/dev/null)" = "$R" ] || continue
  case "$(cat "$p/comm" 2>/dev/null)" in gpg-agent|dirmngr|keyboxd|scdaemon) echo "Stopping $(cat "$p/comm") (${p#/proc/})"; kill "${p#/proc/}" ;; esac
done
sleep 1
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
# Detach the image, retrying: the kernel can keep a loop device busy for a moment after the last unmount
IMGF=${IPRPS_IMG:-/root/iprps-system.img}
for try in 1 2 3 4 5; do
  LS=$(losetup -j "$IMGF" | cut -d: -f1)
  [ -z "$LS" ] && break
  for L in $LS; do losetup -d "$L" 2>/dev/null && echo "Detached $L"; done
  sleep 1
done
if [ -n "$(losetup -j "$IMGF")" ]; then
  echo "STILL ATTACHED: $(losetup -j "$IMGF" | cut -d: -f1 | tr '\n' ' ')- detach it with: losetup -d /dev/loopN"
  exit 1
fi
echo "Remaining mounts under $R:"; findmnt -R "$R" || echo "  none"
losetup -a | grep iprps || echo "Image detached."
