#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# IPRPS: USB in the initramfs - USB core modules, USB keyboards, and a 30 s wait for the root device (USB boot, Part 4.9)
set -e
grep -q '^cp -a /usr/lib/firmware' /usr/sbin/mkinitramfs && \
sed -i 's|^cp -a /usr/lib/firmware \$WDIR/usr/lib$|# IPRPS: no firmware in the initramfs (over 1 GB); drivers load it from the root file system|' /usr/sbin/mkinitramfs
grep -q 'usb/{host,storage,core,common}' /usr/sbin/mkinitramfs || \
sed -i 's|drivers/usb/{host,storage}|drivers/usb/{host,storage,core,common}|' /usr/sbin/mkinitramfs
grep -q 'usbhid' /usr/share/mkinitramfs/init.in || \
sed -i 's/ ata_piix 2>/ ata_piix usbhid hid_generic 2>/' /usr/share/mkinitramfs/init.in
grep -q 'Waiting for the root device' /usr/share/mkinitramfs/init.in || \
sed -i 's|^   while \[ ! -b "\$device" \] ; do$|   n=0\n   while [ ! -b "$device" ] \&\& [ $n -lt 30 ] ; do\n      [ $n = 0 ] \&\& echo "Waiting for the root device (USB drives can take a few seconds)..."\n      sleep 1; udevadm settle; n=$((n+1))\n   done\n\n&|' /usr/share/mkinitramfs/init.in
grep -n 'usb/{\|IPRPS: no firmware' /usr/sbin/mkinitramfs
grep -n 'usbhid' /usr/share/mkinitramfs/init.in
grep -n -B1 -A5 '^   n=0' /usr/share/mkinitramfs/init.in
