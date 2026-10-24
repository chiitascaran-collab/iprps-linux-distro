#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# Build the IPRPS icon theme from /usr/share/iprps/icons (guide 9.3). Run as root in the image.
I=/usr/share/iprps/icons; T=/usr/share/icons/IPRPS
ls $I/*.png | wc -l                    # 24 - stop here if not
rm -rf $T
install -vdm755 $T/256x256/places $T/256x256/apps $T/256x256/devices
ic() { ln -sfv $I/$1.png $T/256x256/$2/$3.png; }
for f in $I/*.png; do n=$(basename $f .png); ic $n apps iprps-$n; done
ic folder-home places user-home
ic folder-desktop places user-desktop
ic folder-documents places folder-documents
ic folder-downloads places folder-download
ic folder-music places folder-music
ic folder-pictures places folder-pictures
ic folder-videos places folder-videos
ic folder-network places folder-remote
ic network places network-workgroup
ic trash places user-trash
ic trash places user-trash-full
ic file-system devices drive-harddisk
for n in system-file-manager org.xfce.thunar; do ic finder apps $n; done
for n in utilities-terminal org.xfce.terminal org.xfce.terminalemulator; do ic terminal apps $n; done
for n in applications-internet web-browser org.xfce.webbrowser; do ic internet apps $n; done
for n in preferences-system preferences-desktop org.xfce.settings.manager; do ic settings apps $n; done
ic security apps preferences-system-privacy
for n in applications-multimedia multimedia-volume-control; do ic audio apps $n; done
for n in org.xfce.panel.applicationsmenu start-here; do ic menu apps $n; done
for n in applications-other applications-all; do ic apps apps $n; done
ic home apps go-home
cat > $T/index.theme << "EOF"
[Icon Theme]
Name=IPRPS
Comment=IPRPS OS icons
Inherits=Adwaita,hicolor
Directories=256x256/places,256x256/apps,256x256/devices

[256x256/places]
Size=256
MinSize=16
MaxSize=512
Type=Scalable
Context=Places

[256x256/apps]
Size=256
MinSize=16
MaxSize=512
Type=Scalable
Context=Applications

[256x256/devices]
Size=256
MinSize=16
MaxSize=512
Type=Scalable
Context=Devices
EOF
gtk-update-icon-cache -f $T
ls $T/256x256/*/ | wc -l               # about 60
