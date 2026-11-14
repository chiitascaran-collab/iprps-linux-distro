#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# iprps-release-iso.sh <lite|medium|advanced> - guide 13.9
# Makes a live ISO (DVD or USB stick; UEFI and BIOS) from the cleaned release copy that
# iprps-release-clean.sh made. Run as root in Debian (WSL), after 13.4 (before or after 13.5).
# The ISO starts IPRPS OS in memory without touching the computer's disks; its installer
# copies the clean system to a disk. Output: /mnt/g/IPRPS/release (or set IPRPS_RELEASE_OUT).
# IPRPS_ISO_ARGS adds kernel options to the menu entries (for tests, e.g. "console=ttyS0").
set -eu
case "${1:-}" in lite|medium|advanced) ED=$1 ;; *) echo "usage: $0 lite|medium|advanced"; exit 1 ;; esac
EDC=${ED^}
REL=/root/release
NAME=iprps-os-1.0-$ED
IMG=${IPRPS_ISO_SRC:-$REL/$NAME.img}
OUT=${IPRPS_RELEASE_OUT:-/mnt/g/IPRPS/release}
LABEL="IPRPS_OS_1_0_${ED^^}"
WORK=$REL/iso-$ED
STAGE=$WORK/stage
MNT=$WORK/root
ISO=$REL/$NAME.iso
LP=""

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }
p3_loop() {
  local s n
  read -r s n < <(sfdisk -d "$1" | sed -n 's/.*3 : start= *\([0-9]*\), size= *\([0-9]*\).*/\1 \2/p') || true
  [ -n "${s:-}" ] || return 1
  losetup -r -f --show -o $(( s * 512 )) --sizelimit $(( n * 512 )) "$1"
}
cleanup() {
  mountpoint -q "$MNT" 2>/dev/null && umount "$MNT"
  [ -n "$LP" ] && losetup -d "$LP" 2>/dev/null
  true
}
trap cleanup EXIT

say "Checks"
[ "$(id -u)" = 0 ] || die "run this as root in Debian"
[ -f "$IMG" ] || die "$IMG not found: run /root/iprps-release-clean.sh $ED first"
[ -z "$(losetup -j "$IMG")" ] || die "$IMG is attached: $(losetup -j "$IMG" | cut -d: -f1) (losetup -d it)"
for t in sfdisk mksquashfs grub-mkrescue xorriso mformat sha256sum; do
  command -v $t >/dev/null || die "$t is missing: apt install squashfs-tools grub-common grub-pc-bin grub-efi-amd64-bin xorriso mtools"
done
[ -d /usr/lib/grub/i386-pc ] || die "GRUB's BIOS files are missing: apt install grub-pc-bin"
[ -d /usr/lib/grub/x86_64-efi ] || die "GRUB's UEFI files are missing: apt install grub-efi-amd64-bin"
mkdir -p "$OUT" || die "can't create $OUT"
echo "OK. Source: $IMG"

say "1/4 Opening the release image (read-only)"
rm -rf "$WORK"; mkdir -p "$MNT" "$STAGE/boot/grub" "$STAGE/live"
LP=$(p3_loop "$IMG") || die "partition 3 not found in $IMG"
mount -o ro "$LP" "$MNT" || die "can't mount the image's root partition"
K=$(ls "$MNT"/boot/vmlinuz-* 2>/dev/null | sort -V | tail -1); [ -n "$K" ] || die "no kernel in /boot of the image"
KV=${K##*/vmlinuz-}
INITRD=$MNT/boot/initrd.img-$KV
[ -f "$INITRD" ] || die "no initramfs for kernel $KV in the image"
grep -q do_mount_live "$MNT/usr/share/mkinitramfs/init.in" 2>/dev/null \
  || die "the image has no live boot support: do 4.9's live-boot step in the build image, rebuild the initramfs, then release again"
[ "$(stat -c %Y "$INITRD")" -ge "$(stat -c %Y "$MNT/usr/share/mkinitramfs/init.in")" ] \
  || die "the initramfs is older than the live boot change: run mkinitramfs $KV (4.9) in the build image, then release again"
[ -x "$MNT/usr/sbin/iprps-live-setup" ] || die "iprps-live-setup is missing from the image (13.9 step 1)"
[ ! -e "$MNT/var/lib/iprps/setup-done" ] && [ ! -e "$MNT/etc/iprps/db.php" ] \
  || die "this image wasn't cleaned: run /root/iprps-release-clean.sh $ED first"
echo "Kernel $KV, live boot support present, image cleaned."

say "2/4 Compressing the system (squashfs) - the long step, often 20-60 minutes"
mksquashfs "$MNT" "$STAGE/live/filesystem.squashfs" -comp xz -Xbcj x86 -b 1M -noappend \
  -wildcards -e 'lost+found' 'swapfile' 'tmp/*' 'var/tmp/*'
cp -v "$K" "$STAGE/boot/vmlinuz"
cp -v "$INITRD" "$STAGE/boot/initrd.img"
umount "$MNT"; losetup -d "$LP"; LP=""

cat > "$STAGE/boot/grub/grub.cfg" << GRUBCFG
set default=0
set timeout=10
insmod all_video
search --no-floppy --set=root --file /live/filesystem.squashfs

menuentry "Start IPRPS OS 1.0 $EDC (try it, or install it)" {
        linux   /boot/vmlinuz iprps.live=$LABEL quiet${IPRPS_ISO_ARGS:+ $IPRPS_ISO_ARGS}
        initrd  /boot/initrd.img
}
menuentry "Start IPRPS OS 1.0 $EDC (safe graphics)" {
        linux   /boot/vmlinuz iprps.live=$LABEL nomodeset${IPRPS_ISO_ARGS:+ $IPRPS_ISO_ARGS}
        initrd  /boot/initrd.img
}
menuentry "Restart" {
        reboot
}
menuentry "Power off" {
        halt
}
GRUBCFG

say "3/4 Building the ISO (UEFI and BIOS; DVD and USB)"
rm -f "$ISO"
grub-mkrescue -o "$ISO" -V "$LABEL" -iso-level 3 "$STAGE"
xorriso -indev "$ISO" -pvd_info 2>/dev/null | grep -i '^Volume Id' || die "the ISO can't be read back"
SZ=$(stat -c %s "$ISO")
echo "ISO size: $(( SZ / 1048576 )) MB"
if   [ "$SZ" -le 4700000000 ]; then echo "Fits a single-layer DVD (4.7 GB) or a USB stick."
elif [ "$SZ" -le 8500000000 ]; then echo "Needs a DUAL-LAYER DVD (DVD+R DL, 8.5 GB) or a USB stick."
else echo "Too big for a DVD: USB stick only (8 GB or larger)."; fi
( cd "$REL" && sha256sum "$NAME.iso" > "SHA256SUMS-$ED-iso" )

say "4/4 Copying to $OUT"
cp -v "$ISO" "$REL/SHA256SUMS-$ED-iso" "$OUT/"
( cd "$OUT" && sha256sum -c "SHA256SUMS-$ED-iso" ) || die "the copied ISO doesn't match its checksum: copy it again"
rm -rf "$WORK"
ls -lh "$OUT/$NAME.iso" "$OUT/SHA256SUMS-$ED-iso"
printf '\n\033[1;32mDone: %s (copy verified).\033[0m\n' "$OUT/$NAME.iso"
echo "Test it (13.9 step 4) before publishing. Delete $ISO afterwards to free space."
