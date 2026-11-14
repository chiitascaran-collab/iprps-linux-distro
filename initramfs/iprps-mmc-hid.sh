#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# IPRPS: include SD/eMMC and keyboard drivers in the initramfs (Part 4.9)
set -e
sed -i 's|/kernel/drivers/usb/{host,storage}|/kernel/drivers/usb/{host,storage} /usr/lib/modules/$KERNEL_VERSION/kernel/drivers/{mmc,hid}|' /usr/sbin/mkinitramfs
