#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# iprps-release-pack.sh <lite|medium|advanced> - guide 13.5
# Shrinks the cleaned release copy, checks it, and makes the downloads:
# .img.xz (USB / disk), .vhdx (Hyper-V), .qcow2 (QEMU), SHA256SUMS. Run as root in Debian (WSL)
# after iprps-release-clean.sh. Output folder: /mnt/g/IPRPS/release (or set IPRPS_RELEASE_OUT).
set -eu
case "${1:-}" in lite|medium|advanced) ED=$1 ;; *) echo "usage: $0 lite|medium|advanced"; exit 1 ;; esac
REL=/root/release
NAME=iprps-os-1.0-$ED
IMG=$REL/$NAME.img
OUT=${IPRPS_RELEASE_OUT:-/mnt/g/IPRPS/release}
LP=""

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }
p3_loop() {
  local s n
  read -r s n < <(sfdisk -d "$1" | sed -n 's/.*3 : start= *\([0-9]*\), size= *\([0-9]*\).*/\1 \2/p') || true
  [ -n "${s:-}" ] || return 1
  losetup -f --show -o $(( s * 512 )) --sizelimit $(( n * 512 )) "$1"
}
trap '[ -n "$LP" ] && losetup -d "$LP" 2>/dev/null; true' EXIT

say "Checks"
[ "$(id -u)" = 0 ] || die "run this as root in Debian"
[ -f "$IMG" ] || die "$IMG not found: run /root/iprps-release-clean.sh $ED first"
[ -z "$(losetup -j "$IMG")" ] || die "$IMG is still attached: $(losetup -j "$IMG" | cut -d: -f1) (losetup -d it)"
for t in sfdisk e2fsck resize2fs dumpe2fs xz qemu-img sha256sum; do command -v $t >/dev/null || die "$t is missing (apt install fdisk e2fsprogs xz-utils qemu-utils)"; done
mkdir -p "$OUT" || die "can't create $OUT"
echo "OK. Downloads will be copied to $OUT"

say "1/5 Checking and shrinking the file system"
LP=$(p3_loop "$IMG") || die "no partition 3 in $IMG"
set +e; e2fsck -fy "$LP"; RC=$?; set -e
[ $RC -le 1 ] || die "e2fsck found problems it couldn't fix (code $RC)"
resize2fs -M "$LP"
BLK=$(dumpe2fs -h "$LP" 2>/dev/null | awk -F: '/^Block count/{gsub(/ /,"",$2); print $2}')
BSZ=$(dumpe2fs -h "$LP" 2>/dev/null | awk -F: '/^Block size/{gsub(/ /,"",$2); print $2}')
losetup -d "$LP"; LP=""
NEW_MIB=$(( BLK * BSZ / 1048576 + 2048 ))
echo ", ${NEW_MIB}M" | sfdisk -q -N 3 "$IMG"
NPART=$(sfdisk -d "$IMG" | grep -c 'start=')
TABLE=$(sfdisk -d "$IMG" | grep -v '^last-lba:')      # the partition table, with all its IDs
END=$(sfdisk -d "$IMG" | sed -n 's/.*3 : start= *\([0-9]*\), size= *\([0-9]*\).*/\1 \2/p' | awk '{print $1+$2}')
truncate -s $(( (END + 34) * 512 )) "$IMG"
printf '%s\n' "$TABLE" | sfdisk -q --no-reread "$IMG"    # rewrite it: GPT backup lands at the new end
[ "$(sfdisk -d "$IMG" | grep -c 'start=')" = "$NPART" ] && sfdisk -d "$IMG" | grep -q '^label: gpt' \
  || die "the partition table didn't survive the shrink; start again from iprps-release-clean.sh"
sfdisk -l "$IMG" | sed -n '1,3p;/^Device/,$p'

say "2/5 Health check of the shrunk image"
LP=$(p3_loop "$IMG") || die "partition 3 missing after shrinking"
set +e; e2fsck -fn "$LP"; RC=$?; set -e
losetup -d "$LP"; LP=""
[ $RC = 0 ] || die "the shrunk file system has errors (code $RC); start again from iprps-release-clean.sh"
echo "Healthy. Image size: $(du -h --apparent-size "$IMG" | cut -f1)"

cd "$REL"
rm -f "$NAME.img.xz" "$NAME.vhdx" "$NAME.qcow2" "SHA256SUMS-$ED"
FREE=$(df -B1 --output=avail "$REL" | tail -1); SZ=$(stat -c %s "$IMG")
[ "$FREE" -gt $(( SZ * 3 / 2 )) ] || echo "Warning: only $(( FREE/1073741824 )) GB free here; the three files may need about $(( SZ*3/2/1073741824 )) GB."

say "3/5 Compressing for USB sticks (.img.xz) - the long step, often 30-90 minutes"
xz -T0 -9 -k -v -f "$NAME.img" || { echo "Retrying with 2 threads (less memory)..."; xz -T2 -9 -k -v -f "$NAME.img"; }

say "4/5 Hyper-V (.vhdx) and QEMU (.qcow2) images"
qemu-img convert -p -O vhdx -o subformat=dynamic "$NAME.img" "$NAME.vhdx"
qemu-img convert -p -O qcow2 -c "$NAME.img" "$NAME.qcow2"
sha256sum "$NAME.img.xz" "$NAME.vhdx" "$NAME.qcow2" > "SHA256SUMS-$ED"

say "5/5 Copying to $OUT"
cp -v "$NAME.img.xz" "$NAME.vhdx" "$NAME.qcow2" "SHA256SUMS-$ED" "$OUT/"
( cd "$OUT" && sha256sum -c "SHA256SUMS-$ED" ) || die "a copied file doesn't match its checksum: copy it again"
ls -lh "$OUT"/"$NAME".* "$OUT/SHA256SUMS-$ED"
printf '\n\033[1;32mDone: the %s release is in %s (copies verified).\033[0m\n' "$ED" "$OUT"
echo "Keep $IMG and $NAME.qcow2 here until testing (13.6) passes; then delete the copies in $REL to free space."
