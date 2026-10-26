# Customizing icons on IPRPS OS

*For users and administrators of an installed IPRPS OS. From Appendix C.6 of the build guide; the standard icon names are in section 9.3.*


This section is for **users and administrators of a finished IPRPS OS** (installed, or running from the USB image or a Live ISO), not for the build. Commands run in a **terminal on the IPRPS OS computer** (Applications → Terminal).

**1. Make the icons.** PNG, **256×256**, transparent background (an SVG works too). Use lowercase names with dashes, no spaces. To replace a standard icon, name your file after the **standard name** it should replace (9.3's table lists them, for example `user-home.png`, `user-trash.png`, `folder-documents.png`, `utilities-terminal.png`).

**2. Get them onto the computer.** Copy them to a USB stick on any computer; plug it in, and it opens in the file manager. Copy the files into your **Downloads** folder.

**3a. Just for you (no administrator rights).** Your own icon theme, layered on top of IPRPS:

```bash
T=~/.local/share/icons/MyIcons
mkdir -p $T/256x256/places $T/256x256/apps $T/256x256/devices
cp -v ~/Downloads/user-home.png $T/256x256/places/          # one line per icon: places = folders,
cp -v ~/Downloads/utilities-terminal.png $T/256x256/apps/   # apps = programs and menu categories,
cp -v ~/Downloads/drive-harddisk.png $T/256x256/devices/    # devices = drives
printf '%s\n' '[Icon Theme]' 'Name=MyIcons' 'Inherits=IPRPS,Adwaita,hicolor' \
  'Directories=256x256/places,256x256/apps,256x256/devices' '' \
  '[256x256/places]' 'Size=256' 'MinSize=16' 'MaxSize=512' 'Type=Scalable' '' \
  '[256x256/apps]' 'Size=256' 'MinSize=16' 'MaxSize=512' 'Type=Scalable' '' \
  '[256x256/devices]' 'Size=256' 'MinSize=16' 'MaxSize=512' 'Type=Scalable' > $T/index.theme
gtk-update-icon-cache -f $T
xfconf-query -c xsettings -p /Net/IconThemeName -s MyIcons
```

The last line switches your desktop to **MyIcons** at once (or choose it in **Settings → Appearance → Icons**). Everything you didn't replace still comes from IPRPS. To undo: choose **IPRPS** again, and delete `~/.local/share/icons/MyIcons`.

**One program's icon only:** right-click a panel launcher → **Properties** → click the icon and pick your PNG. For a menu entry, copy its launcher and point it at your icon:

```bash
mkdir -p ~/.local/share/applications
cp /usr/share/applications/org.xfce.mousepad.desktop ~/.local/share/applications/
sed -i 's|^Icon=.*|Icon=/home/'"$USER"'/Downloads/my-editor.png|' ~/.local/share/applications/org.xfce.mousepad.desktop
```

(Keep the icon somewhere permanent, such as `~/.local/share/icons/`, rather than Downloads.)

**3b. For every user on the computer (administrator, with `sudo`).** Add or replace icons in the IPRPS theme itself:

```bash
sudo install -v -m644 ~/Downloads/folder-documents.png /usr/share/iprps/icons/
ls -l /usr/share/icons/IPRPS/256x256/places/folder-documents.png     # a link to that file
sudo install -v -m644 ~/Downloads/my-new-icon.png /usr/share/icons/IPRPS/256x256/apps/
sudo gtk-update-icon-cache -f /usr/share/icons/IPRPS
```

The first line replaces one of the 24 IPRPS icons in place: name your file exactly like the IPRPS icon it replaces (`folder-documents.png`, `trash.png`, `terminal.png`…, the first column of 9.3's table), and every standard name linked to it changes too. The third adds a brand-new icon under its own name, usable as `Icon=my-new-icon` in launchers. Log out and back in to see the change everywhere. An IPRPS OS update (a new image) brings back the original icons, so keep your custom PNGs on a USB stick.

**On a Live ISO or Live USB:** changes live in memory and disappear at shutdown. Keep your icons and the commands above on a USB stick and run them again in each session, or install IPRPS OS to keep them for good.

> **Pro tip:** If an icon doesn't change, look for broken links with `find <theme folder> -xtype l` (it should print nothing), confirm the active theme with `xfconf-query -c xsettings -p /Net/IconThemeName`, and log out and back in: the panel and file manager load icons when they start.

