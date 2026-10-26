*From Appendix C of the build guide.*

# IPRPS OS — Useful Commands

Quick reference for moving files around, testing in QEMU, and customizing icons. `<you>` is your Windows user name (the folder under `C:\Users`); replace it, angle brackets included.

## C.1 Windows ↔ Debian (WSL)

Windows drives appear in Debian under `/mnt`: `C:\Users\<you>\Downloads` is `/mnt/c/Users/<you>/Downloads`, and the G: drive is `/mnt/g`.

**[DEBIAN ROOT]**

```bash
# Windows -> Debian: one file, a whole folder, or all PNGs of a folder
cp -v /mnt/c/Users/<you>/Downloads/picture.png /build/src/
cp -rv "/mnt/c/Users/<you>/Downloads/My Folder" /build/src/
cp -v /mnt/c/Users/<you>/Downloads/iprps-icons/*.png /build/src/iprps-icons/

# Debian -> Windows
cp -v /build/src/somefile.log /mnt/c/Users/<you>/Downloads/

# Find a file on the Windows side when you're not sure of its folder
find /mnt/c/Users/<you> -maxdepth 3 -iname '*rpg-vault*' 2>/dev/null

# Open the current Debian folder in Windows Explorer
explorer.exe .
```

Put quotes around Windows paths with spaces. In **Windows Explorer**, Debian's files are under `\\wsl.localhost\Debian\` (for example `\\wsl.localhost\Debian\build\src`); you can drag files there too.

**[WINDOWS POWERSHELL]**

```powershell
# Run one Debian command from PowerShell (here: copy a file into /build/src as root)
wsl -d Debian -u root cp -v /mnt/c/Users/<you>/Downloads/picture.png /build/src/
```

## C.2 Debian ↔ the build image (chroot)

Debian's `/build` is connected into the chroot by `iprps-enter.sh`, so **`/build/src` is the same folder on both sides** (and `~/src` for BUILDER). Put files there from Debian, then use them in IPRPS CHROOT or BUILDER.

**[DEBIAN ROOT]**

```bash
findmnt /mnt/iprps/build || echo "build is NOT connected"
ls /mnt/iprps/build/src | head        # what the chroot sees in /build/src
cp -v /some/file /mnt/iprps/root/      # copy straight into the image (any path under /mnt/iprps)
```

If `/build` isn't connected, copy into `/mnt/iprps/build/src/` instead, and reconnect next session (leave the chroot, `iprps-leave.sh`, `iprps-enter.sh`).

## C.3 The local Git repository

The repository lives on the G: drive (`/mnt/g/IPRPS/iprps-os`).

**[DEBIAN ROOT]**

```bash
cd /mnt/g/IPRPS/iprps-os
cp -v /mnt/c/Users/<you>/Downloads/iprps-icons/*.png artwork/icons/
ls artwork/icons/*.png | wc -l        # 24
git status
git add -A && git commit -m "Add the IPRPS icons" && git push
```

## C.4 Debian ↔ a running test VM (SSH)

Start QEMU with `hostfwd=tcp::2222-:22` (1.4). Debian needs the SSH client once: `apt install openssh-client`.

**[DEBIAN ROOT]**

```bash
ssh -p 2222 builder@localhost                              # log in (then su - for root)
scp -P 2222 /build/src/file.png builder@localhost:~/       # Debian -> VM (builder's home)
scp -P 2222 builder@localhost:~/.xsession-errors /root/    # VM -> Debian
ssh-keygen -R "[localhost]:2222"                           # after "REMOTE HOST IDENTIFICATION HAS CHANGED"
```

Note the capital `-P` for `scp` (lowercase `-p` for `ssh`). From a Windows file, chain both: `cp` it to Debian first (C.1), then `scp` it into the VM.

**[TEST VM]** (over SSH, as builder) to change desktop settings of the logged-in session:

```bash
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
xfconf-query -c xsettings -p /Net/IconThemeName              # show
xfconf-query -c xsettings -p /Net/IconThemeName -s IPRPS     # set
cat /proc/cmdline                                            # proves you're in the VM, not the chroot
```

**Reading a stopped test copy** (for example to copy a panel layout out of it), read-only:

**[DEBIAN ROOT]**

```bash
L=$(losetup -fP --show -r /root/iprps-test.img)
mkdir -p /mnt/iprps-test && mount -o ro ${L}p3 /mnt/iprps-test
ls /mnt/iprps-test/home/builder
umount /mnt/iprps-test && losetup -d $L
```

## C.5 QEMU and RealVNC

**[DEBIAN ROOT]**

```bash
pgrep -a qemu || echo "No QEMU running"
qemu-system-x86_64 -enable-kvm -m 6G -smp 4 \
  -bios /usr/share/ovmf/OVMF.fd \
  -drive file=/root/iprps-test.img,format=raw,if=virtio \
  -nic user,model=virtio-net-pci,hostfwd=tcp::2222-:22 \
  -audio none \
  -vga virtio \
  -display none -vnc 127.0.0.1:0 \
  -monitor stdio
```

In **RealVNC Viewer** on Windows, connect to **`localhost:5900`** (accept the "unencrypted connection" warning). RealVNC's **View → Scaling** fits a large VM screen into the window. QEMU's VNC doesn't share the clipboard: to copy text out of the VM, use SSH (C.4).

At the **`(qemu)`** prompt in QEMU's Debian window:

| Command | What it does |
|---|---|
| `sendkey ctrl-alt-f2` | Switch the VM to text console 2 (`f3`, `f4`… for others) |
| `sendkey ctrl-alt-f1` (or `f7`) | Back to the graphical screen |
| `sendkey ctrl-alt-delete` | Restart the VM |
| `system_powerdown` | Ask the VM to shut down cleanly (like pressing the power button) |
| `screendump /mnt/c/Users/<you>/Downloads/vm.png -f png` | Save a screenshot of the VM to Windows |
| `info status` | Running or paused |
| `quit` | Stop the VM at once (like pulling the plug) |

**Boot to text mode once:** in the GRUB menu press `e`, add ` systemd.unit=multi-user.target` to the end of the `linux` line, press **Ctrl+X**. **More memory:** `-m 8G` instead of `-m 6G`. **Problems:** see the table in 1.4.

## C.6 Custom icons: changing icons on an installed IPRPS OS

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

