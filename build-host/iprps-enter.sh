#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# Mount the IPRPS image and enter the chroot as root
IMG=/root/iprps-system.img; R=/mnt/iprps
L=$(losetup -j $IMG | cut -d: -f1 | head -1); [ -n "$L" ] || L=$(losetup -fP --show $IMG)
mkdir -p $R; mountpoint -q $R || mount ${L}p3 $R
mkdir -p $R/boot/efi $R/build
mountpoint -q $R/boot/efi || mount ${L}p1 $R/boot/efi
mountpoint -q $R/build || mount --bind /build $R/build
mountpoint -q $R/dev || mount --bind /dev $R/dev
mountpoint -q $R/dev/pts || mount -t devpts devpts -o gid=5,mode=0620 $R/dev/pts
mountpoint -q $R/proc || mount -t proc proc $R/proc
mountpoint -q $R/sys || mount -t sysfs sysfs $R/sys
mountpoint -q $R/run || mount -t tmpfs tmpfs $R/run
mountpoint -q $R/dev/shm || mount -t tmpfs -o nosuid,nodev tmpfs $R/dev/shm
cp -L /etc/resolv.conf $R/etc/resolv.conf
exec chroot $R /usr/bin/env -i HOME=/root TERM=$TERM PATH=/usr/bin:/usr/sbin /bin/bash --login
