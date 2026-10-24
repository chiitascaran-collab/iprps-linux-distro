#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# IPRPS: make the BLFS initramfs load common storage drivers at every boot (Part 4.9)
set -e
sed -i '0,/udevadm settle/s//udevadm settle\nmodprobe -a -q virtio_pci virtio_blk virtio_scsi nvme ahci sd_mod usb_storage uas xhci_pci ehci_pci ohci_pci sdhci_pci sdhci_acpi mmc_block hv_vmbus hv_storvsc vmw_pvscsi ata_piix 2>\/dev\/null\nudevadm settle/' /usr/share/mkinitramfs/init.in
