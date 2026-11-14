#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# IPRPS: live boot from the ISO (DVD or USB): CD/DVD drivers and a do_mount_live step in the initramfs (Part 4.9, used by 13.9)
set -e
grep -q 'drivers/{block,ata,nvme,md,firewire,cdrom}' /usr/sbin/mkinitramfs || \
sed -i 's|drivers/{block,ata,nvme,md,firewire}|drivers/{block,ata,nvme,md,firewire,cdrom}|' /usr/sbin/mkinitramfs
grep -q 'do_mount_live' /usr/share/mkinitramfs/init.in || python3 - /usr/share/mkinitramfs/init.in << "PYEOF"
import sys
p = sys.argv[1]; s = open(p).read()
func = r'''
# IPRPS: live boot from an ISO (DVD or USB): iprps.live=<volume label> on the kernel line.
# Mounts the ISO, its live/filesystem.squashfs read-only, and a RAM overlay on top.
find_live()
{
   # Every device with the disc's label; a USB stick also shows it on a partition, so try the whole disk too
   for d in $(blkid -o device -t LABEL="$live" 2>/dev/null) ; do
      for m in "$d" "/dev/$(basename "$(readlink -f /sys/class/block/${d#/dev/}/..)")" ; do
         [ -b "$m" ] || continue
         if mount -n -t iso9660 -o ro "$m" /run/live/medium 2>/dev/null ; then
            device=$m; return 0
         fi
      done
   done
   return 1
}

do_mount_live()
{
   modprobe -a -q isofs squashfs overlay loop sr_mod cdrom 2>/dev/null
   mkdir -p /run/live/medium /run/live/rootfs /run/live/rw /.root
   n=0
   until find_live ; do
      [ $n = 0 ] && echo "Looking for the IPRPS OS live disc or USB drive ($live)..."
      n=$((n+1))
      if [ $n -gt 30 ] ; then
         echo "The IPRPS OS live medium ($live) was not found."
         problem
         n=0
      fi
      sleep 1; udevadm settle
   done
   mount -n -t squashfs -o ro,loop /run/live/medium/live/filesystem.squashfs /run/live/rootfs || {
      echo "Could not open live/filesystem.squashfs on $device"; problem; }
   mount -n -t tmpfs -o mode=0755 tmpfs /run/live/rw
   mkdir -p /run/live/rw/upper /run/live/rw/work
   mount -n -t overlay overlay \
      -o lowerdir=/run/live/rootfs,upperdir=/run/live/rw/upper,workdir=/run/live/rw/work /.root || {
      echo "Could not set up the live system in memory"; problem; }
   mkdir -p /.root/var/lib/iprps
   : > /.root/etc/iprps-live
   : > /.root/var/lib/iprps/firstboot-done
   : > /.root/var/lib/iprps/setup-done
   echo "Started IPRPS OS live from $live"
}
'''
assert '\ninit=/sbin/init\n' in s and '\ndo_mount_root\n' in s and '    root=*      )' in s
s = s.replace('\ninit=/sbin/init\n', func + '\ninit=/sbin/init\nlive=\n', 1)
s = s.replace('    root=*      )', '    iprps.live=*) live=${param#iprps.live=}       ;;\n    root=*      )', 1)
s = s.replace('\ndo_try_resume # This function will not return if resuming from disk\ndo_mount_root\n',
              '\nif [ -n "$live" ] ; then\n   do_mount_live\nelse\n   do_try_resume # This function will not return if resuming from disk\n   do_mount_root\nfi\n', 1)
assert 'do_mount_live\nelse' in s
open(p, 'w').write(s)
print("init.in: live boot added")
PYEOF
grep -n 'drivers/{block,ata,nvme,md,firewire,cdrom}' /usr/sbin/mkinitramfs
grep -n 'iprps.live\|do_mount_live$' /usr/share/mkinitramfs/init.in
