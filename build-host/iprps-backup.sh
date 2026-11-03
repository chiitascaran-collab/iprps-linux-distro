#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# iprps-backup.sh - back up the IPRPS build image and snapshots to a Windows drive (guide Appendix F)
#   iprps-backup.sh snapshots   every snapshot in /root/snapshots that isn't backed up yet (or changed since)
#   iprps-backup.sh image       the working build image (close it first: iprps-leave.sh)
#   iprps-backup.sh all         both
#   iprps-backup.sh list        what is backed up
# Destination: IPRPS_BACKUP (default /mnt/d/IPRPS/backups, which is D:\IPRPS\backups in Windows).
# Files are compressed with zstd (sparse images would otherwise be written out at full size) and
# each copy is checked before it's kept. Restore with: zstd -d --sparse <file>.img.zst -o <image>  (Appendix F).
set -u
DEST=${IPRPS_BACKUP:-/mnt/d/IPRPS/backups}
IMG=${IPRPS_IMG:-/root/iprps-system.img}
SNAPS=${IPRPS_SNAPSHOTS:-/root/snapshots}
LOG=$DEST/BACKUPS.txt
FAILED=0

die() { printf '\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "run this as root in Debian (sudo -i)"
command -v zstd >/dev/null || die "zstd is missing: apt install zstd"
DRIVE=$(echo "$DEST" | cut -d/ -f1-3)
[ -d "$DRIVE" ] || die "$DRIVE not found. Is the drive connected? (Appendix F: drives in WSL)"
mkdir -p "$DEST/snapshots" "$DEST/image" || die "can't write to $DEST"

# one <source image> <backup file>
one() {
  local src=$1 out=$2 name=${1##*/} used avail
  if [ -f "$out" ] && [ "$out" -nt "$src" ]; then echo "  up to date   $name"; return 0; fi
  used=$(du -B1 "$src" | cut -f1)
  avail=$(df -B1 --output=avail "$DEST" | tail -1)
  if [ "$avail" -lt $(( used * 6 / 10 )) ]; then
    printf '\033[1;31m  NO ROOM      %s (uses %s; %s free on the drive)\033[0m\n' "$name" "$(numfmt --to=iec "$used")" "$(numfmt --to=iec "$avail")"
    FAILED=1; return 1
  fi
  echo "== $name  ($(numfmt --to=iec "$used") of data, $(numfmt --to=iec "$(stat -c %s "$src")") image)"
  if zstd -T0 -3 -q --progress -f "$src" -o "$out.part" && zstd -tq "$out.part" && mv -f "$out.part" "$out" && touch "$out"; then
    printf '%s  %s  %s bytes  %s\n' "$(date '+%F %R')" "${out##*/}" "$(stat -c %s "$src")" "$(numfmt --to=iec "$(stat -c %s "$out")") compressed" >> "$LOG"
    printf '\033[1;32m  OK           %s → %s (%s)\033[0m\n' "$name" "$out" "$(numfmt --to=iec "$(stat -c %s "$out")")"
  else
    rm -f "$out.part"
    printf '\033[1;31m  FAILED       %s\033[0m\n' "$name"; FAILED=1; return 1
  fi
}

do_snapshots() {
  local n=0 f
  for f in "$SNAPS"/*.img; do
    [ -f "$f" ] || continue
    n=$((n + 1)); one "$f" "$DEST/snapshots/${f##*/}.zst"
  done
  [ "$n" -gt 0 ] || echo "  No snapshots in $SNAPS."
}
do_image() {
  [ -f "$IMG" ] || die "$IMG not found"
  [ -z "$(losetup -j "$IMG")" ] || die "the build image is in use: leave every chroot window, then bash /root/iprps-leave.sh"
  pgrep -x qemu-system-x86_64 >/dev/null && echo "  (a QEMU test VM is running; that's fine if it uses a test copy, not $IMG)"
  one "$IMG" "$DEST/image/$(basename "$IMG" .img)-$(date +%F).img.zst"
}

case "${1:-}" in
  snapshots) do_snapshots ;;
  image)     do_image ;;
  all)       do_image; do_snapshots ;;
  list)      ls -lh "$DEST/image" "$DEST/snapshots"; echo; [ -f "$LOG" ] && tail -n 30 "$LOG"; exit 0 ;;
  *)         echo "usage: $0 snapshots | image | all | list"; exit 1 ;;
esac
df -h "$DEST" | tail -1 | awk '{print "Drive: " $4 " free of " $2}'
[ "$FAILED" = 0 ] && printf '\033[1;32mBackup complete: %s\033[0m\n' "$DEST" || die "some backups failed (see above)"
