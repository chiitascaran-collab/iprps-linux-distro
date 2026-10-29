# IPRPS OS — Distribution Build Guide

## A Role-Playing Game Workstation Distro in Three Editions — Built on LFS 13.1-systemd and BLFS 13.1

This guide builds **IPRPS OS** for distribution: a generic, ready-to-use Linux system for Session Masters, Storytellers and players of the Infinite Plane Role Playing System. You build it once and release it in three editions — **Lite**, **Medium** and **Advanced** — that boot on the majority of Intel and AMD computers without any per-machine tuning.

> **Side note:** Every BLFS command in this guide was extracted directly from the **BLFS 13.1 (systemd) book source**, together with its download link, MD5 checksum and the sentence that introduces it. The build order was computed from BLFS's own dependency data. Explanations, IPRPS decisions, scripts and release steps are written for this guide. Where the two ever disagree, the BLFS book wins, except for the clearly marked **IPRPS release overrides**, which exist because of distribution licensing. BLFS book: https://www.linuxfromscratch.org/blfs/view/13.1-systemd/

---

## How to Use This Guide

### The constraints this guide is built around

| Constraint | How the guide meets it |
|---|---|
| Works on the majority of Intel/AMD PCs as-is | A distro-grade **generic kernel** (modules for nearly all hardware), the full **linux-firmware** collection, **all Intel and AMD CPU microcode**, and an **initramfs**. No per-machine firmware steps |
| Users tailor their own installs later | Nothing machine-specific is built in. `sudo`, compilers and source tarballs stay on the system |
| RAM: 6 GB minimum, 16 GB recommended | Lightweight **Xfce** desktop for every edition, a database tuned for small memory, and a swap file sized at first boot |
| Wireless and sudo must be installed | **NetworkManager** with Wi-Fi (wpa_supplicant), Bluetooth (BlueZ) and **sudo** are in every edition |
| A desktop customized for IPRPS | The **IPRPS Desktop**: Xfce with IPRPS branding, a Session Master menu, Session Master Mode, a player display, and the **IPRPS Table** for players' phones, tablets and laptops on the same network |
| Audio, video, image and document apps | Chosen per edition (Part 1) |
| Exclusive IPRPS apps for Session Masters and Storytellers | Served by a built-in local **web server (Apache + PHP)** and **database (MariaDB)**, with a campaign and player-tracking database included |
| Downloadable from GitHub and/or a download site | One compressed disk image per edition (USB stick or internal disk), optional VM images, checksums and source archives (13.8) |
| Local AI later | Designed for, not built (Part 18) |

### The three editions

| | **Lite** | **Medium** | **Advanced** |
|---|---|---|---|
| Purpose | Bare minimum to set up and run campaigns | Essential creative and office apps | Everything |
| RAM | 6 GB minimum | 8 GB minimum, 16 GB recommended | 16 GB recommended |
| Storage | 64 GB or more | 64 GB or more | 128 GB or more |
| Desktop | IPRPS Desktop (Xfce) | Same | Same |
| Local AI | — | **IPRPS Oracle** (Ollama, one bundled storyteller model) | Same as Medium |
| Web browser | Firefox (unbranded) | Chromium (ungoogled, default; IPRPS apps open as their own windows) + Firefox | Same as Medium |
| Campaign tools | IPRPS Session Master Hub, player display, dice, initiative, session log | + all Medium IPRPS apps | + all IPRPS apps |
| Audio | Parole (music and ambience); mpv plays ambience in Session Master Mode | + VLC | + upstream audio tools (Part 16) |
| Video | mpv | + VLC, FFmpeg tools | + upstream video tools |
| Images | Ristretto (viewer), **Drawing** (simple painting) | + GIMP, Inkscape, ImageMagick | + FontForge, Graphviz, upstream art tools |
| Documents | **IPRPS Writer** (.docx/.odt/PDF), Evince (PDF), Mousepad (text) | + LibreOffice, printing (CUPS) | + scanning (SANE) |
| Discs | — | Xfburn | + cdrdao, libisoburn |

### How the build is organized

You build **one** system in stages, inside **WSL** on your Windows PC, working in a chroot on the IPRPS disk image (the same way you entered LFS). The editions are **cumulative**: Medium is Lite plus more, and Advanced is Medium plus more. You take a **release snapshot** after the Lite apps, another after the Medium apps, and a final one after the Advanced apps. Each snapshot becomes one edition's disk image.

| Stage | Part | Contents | Packages | Edition |
|---|---|---|---|---|
| A | Part 3 | Foundations: downloads, security, admin tools and sudo | 49 | Lite (and up) |
| B | Part 5 | Graphics stack (X11 + Mesa) | 46 | Lite (and up) |
| C | Part 6 | Audio (ALSA + PipeWire) | 35 | Lite (and up) |
| D | Part 7 | Networking: wired, wireless and Bluetooth | 12 | Lite (and up) |
| E | Part 8 | The IPRPS Desktop (Xfce + LightDM) | 139 | Lite (and up) |
| F | Part 10 | Web server and database | 6 | Lite (and up) |
| G | Part 11 | Lite edition apps | 25 | Lite (and up) |
| H | Part 15 | Medium edition apps | 68 | Medium |
| I | Part 16 | Advanced edition apps (BLFS part) | 6 | Advanced |
| | | **Total BLFS packages** | **386** (+2 rebuilds) | |

### Conventions

- **Every command block is labeled with the window it runs in.** Don't rely on prompt colors; read the label. The windows are explained in **0.5**:

| Label | What it is | How you get there | Prompt (typical) |
|---|---|---|---|
| **[WINDOWS POWERSHELL]** | Windows itself | Start menu, then PowerShell | `PS C:\Users\...>` |
| **[DEBIAN ROOT]** | Debian in WSL, as root | Open Debian, then `sudo -i` | `root@ADRUQU:~#` |
| **[IPRPS CHROOT]** | Root **inside the IPRPS image** | From DEBIAN ROOT: `bash /root/iprps-enter.sh` | `bash-5.3#` or `(iprps chroot) root:...#` |
| **[BUILDER]** | The build user inside the image | From IPRPS CHROOT: `su - builder` | `(iprps chroot) builder:...$` |
| **[TEST VM]** | The Hyper-V (or QEMU) test machine | 1.4 | IPRPS login |
| **[RELEASE COPY CHROOT]** | Root inside a *release copy* of the image | 13.4 | `root:/#` |

- **Not sure where you are?** Run this. It's the only reliable test, since prompts can be changed:

**[ANY WINDOW]**

```bash
whoami; [ -f /etc/debian_version ] && echo "DEBIAN" || echo "IPRPS CHROOT"
```

- BLFS builds as a regular user (**BUILDER**) and installs as root (**IPRPS CHROOT**), in the **same folder** (0.5).
- **`~/src`** is BUILDER's build folder. It points to `/build/src`, the scratch space on WSL's disk (1.3).
- **Placeholders** such as `<ROOT-UUID>` must be replaced, including the angle brackets.
- **(Optional)** blocks are documentation, tests or alternatives. **Test suites** are worth running for important libraries, but they're optional.
- Each package ends with **Clean up**. Delete the extracted folder every time, and start each package from a fresh extraction.
- A **Warning: IPRPS release override** marks the few places where this guide deliberately differs from BLFS so the result can be legally redistributed.

> **Side note:** How to read the callouts. **Side note** = background. **Pro tip** = shortcut or best practice. **Warning** = read before running. **Checkpoint** = something to verify before moving on.

---

## Part 0 — Lessons Learned and the Build Machine

### 0.1 What the first build taught us

| What happened | Rule for this build |
|---|---|
| Building on a USB flash drive: slow, and swap on USB froze the machine | **Never build on USB flash.** Build in WSL on the internal SSD; USB is only for the *finished* image |
| LLVM ran out of memory with 12 parallel jobs | Limit jobs to about **one per 2 GB of RAM**; one link job at a time for LLVM (0.3) |
| Typing into the wrong window (fstab, `make`, passwords) | Separate, **named tmux windows**; yellow chroot prompt; read the prompt before every block |
| Example IDs pasted into fstab | Get IDs from `blkid`; the release scripts in this guide fill them in automatically |
| Leftover installer signatures stopped the USB drive booting | **`wipefs --all`** before partitioning; `diskpart clean` before writing images |
| A built-in driver couldn't load its firmware | Drivers that need firmware are **modules** in the generic kernel, loaded after the root filesystem is mounted |
| Machine-specific firmware tweaks | Generic hardware support only (Part 4). Users tune their own machines |
| Hard power-off during a heavy build | **Snapshots** before every stage; always build inside `tmux` |

### 0.2 The build machine: WSL on drive G: (the 1 TB SSD)

You build IPRPS where your LFS system already lives: **Debian in WSL2**, with the whole WSL installation moved to drive **G:** (the 1 TB SSD). All work happens in a **chroot** on the IPRPS disk image. A virtual machine is used only to **test-boot copies** of that image.

| Location | Windows path | Path inside Debian | Holds |
|---|---|---|---|
| WSL's Linux disk | `G:\WSL\Debian\ext4.vhdx` | `/` (everything in Debian) | `/root/iprps-system.img`, `/root/snapshots`, `/root/release`, `/build` |
| Test VM disks | `G:\IPRPS\test\` | `/mnt/g/IPRPS/test/` | `iprps-test.vhdx` for Hyper-V |
| Finished downloads | `G:\IPRPS\release\` | `/mnt/g/IPRPS/release/` | `.img.xz`, `.vhdx`, `.qcow2`, checksums, source archive |

> **Warning:** Inside Debian, `/mnt/g` is drive G: seen **through Windows file sharing**. It's slow, and it doesn't support Linux permissions or loop devices properly. Never put the **working** image, snapshots or `/build` there. Those stay inside WSL's own disk, which is now on G: anyway. Use `/mnt/g/IPRPS` only for files Windows programs need: Hyper-V disks and release downloads.

**Moving WSL to G: (done once).** In PowerShell:

**[WINDOWS POWERSHELL]**

```powershell
wsl --shutdown
mkdir G:\WSL
wsl --manage Debian --move G:\WSL\Debian
```

If `--move` isn't recognized, run `wsl --update` first. After a move (or an export/import), set your normal user as the default again, in Debian as root:

**[DEBIAN ROOT]**

```bash
cat >> /etc/wsl.conf << "EOF"

[user]
default=chiita
EOF
```

Then `wsl --shutdown` in PowerShell, and reopen Debian. `whoami` should show `chiita`; use `sudo -i` for root.

**The Windows-side folders (done once),** in Debian:

**[DEBIAN ROOT]**

```bash
mkdir -p /mnt/g/IPRPS/test /mnt/g/IPRPS/release
```

| Resource | Setting |
|---|---|
| WSL memory (`%UserProfile%\.wslconfig`) | As much as you can spare: `memory=` about 75% of the PC's RAM, plus `swap=16GB` |
| WSL processors | All cores (WSL's default) |
| System image | `/root/iprps-system.img`, 40 GB (becomes the release image) |
| Scratch space | `/build` on WSL's own disk: sources and build folders, never released |
| Test VM | Hyper-V (built into Windows 10/11 Pro), VirtualBox, or QEMU inside WSL if `/dev/kvm` exists |

**Space plan for the 279 GB free:**

| Item | Size |
|---|---|
| System image (sparse; grows as you build) | up to 40 GB |
| `/build` sources and build folders (peak, during Firefox/LibreOffice) | 80–120 GB |
| Image snapshots (keep the latest 3) | 30–60 GB |
| Release files (compressed images, VM images, source archive) | 20–40 GB |
| **Total at peak** | **about 170–260 GB** |

> **Warning:** WSL's virtual disk (`ext4.vhdx`) grows as files are added, but **doesn't shrink by itself** when files are deleted. Clean `~/src` after every package (the guide's Clean up steps), delete old snapshots, and on recent WSL versions enable automatic shrinking in PowerShell with `wsl --manage Debian --set-sparse true` (with WSL shut down). Keep an eye on free space in Windows Explorer.

> **Side note:** WSL's own swap lives in a file on the SSD, not on USB, so the memory problems of the first build don't freeze the machine. Builds simply slow down if memory runs short.

### 0.3 Parallel jobs and memory

`free -h` inside WSL shows how much memory WSL has. Then choose:

| WSL memory | `MAKEFLAGS` / `ninja -j` | LLVM | Firefox, LibreOffice, Rust |
|---|---|---|---|
| 8–12 GB | `-j4` | `-j3` with one link job | `-j3` |
| 16 GB | `-j6` | `-j4` with one link job | `-j4` |
| 24 GB | `-j8` | `-j6` with one link job | `-j6` |
| 32 GB or more | `-j12` | `-j10` with one link job | `-j8` |

Set the default in the build user's `~/.bashrc` (Part 2.3). For LLVM, add `-D LLVM_PARALLEL_LINK_JOBS=1` to its `cmake` command.

> **Warning:** Watch memory during the big builds in a second tmux window (`watch -n 5 free -h`). If "available" nears zero, stop the build with **Ctrl+C** and restart with fewer jobs. It continues where it left off.

### 0.4 Snapshots

A snapshot is a complete copy of the build image, taken while **nothing** is using it. If a later stage goes wrong, you copy the snapshot back and lose only that stage's work. Every checkpoint in this guide names a snapshot and repeats these steps with that name filled in.

**Taking a snapshot**

1. **Stop any test VM.** In the VM: `poweroff`. Then check in **[DEBIAN ROOT]** that QEMU is gone: `pgrep -a qemu || echo "No QEMU running"`.
2. **Leave every chroot window.** In BUILDER and IPRPS CHROOT, type `exit` until each shows a Debian prompt.
3. **Detach the image, check space, copy, and verify:**

**[DEBIAN ROOT]**

```bash
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-<NAME>.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-<NAME>.img
```

- `iprps-leave.sh` must end with **Image detached.**
- `df`'s **Avail** must be larger than `du`'s size.
- Wait for **SNAPSHOT COMPLETE**, then check that `ls -l` shows **42949672960** bytes. A smaller number means the copy was cut short: delete it and copy again.

4. **Re-enter** the IPRPS CHROOT and BUILDER windows (0.5) and continue.

**Restoring a snapshot** (do steps 1–2 first):

**[DEBIAN ROOT]**

```bash
bash /root/iprps-leave.sh
cp -v --sparse=always /root/snapshots/iprps-<NAME>.img /root/iprps-system.img && echo "RESTORE COMPLETE"
```

**Housekeeping.** `--sparse=always` makes each copy only as large as the data inside it (`du -h /root/snapshots/*` shows the real sizes). Keep the **latest three** and delete older ones with `rm`, except the release snapshots (`RELEASE-lite`, and so on). Snapshots cover the image only; `/build` (downloads and build folders) is separate and untouched by a restore.

### 0.5 The windows: how to open each one

Use `tmux` in Debian, with one window per label, and **name them** (**Ctrl+B** then **,**) exactly like the labels: **DEBIAN ROOT**, **IPRPS CHROOT** and **BUILDER**.

| Window | Open it with | Used for |
|---|---|---|
| **DEBIAN ROOT** | Open Debian, then `sudo -i` | `apt`, `qemu-img`, the enter/leave scripts, snapshots, release images |
| **IPRPS CHROOT** | In a new tmux window: `sudo -i`, then `bash /root/iprps-enter.sh` | Every block labeled **[IPRPS CHROOT]**: root work inside the image, including the "As root" steps of each package |
| **BUILDER** | In a new tmux window: `sudo -i`, `bash /root/iprps-enter.sh`, then `su - builder` | Every block labeled **[BUILDER]**: downloading, configuring, compiling |

**The "same folder as BUILDER" rule.** A package's root steps (`make install`, `ninja install`, ...) must run in the folder where BUILDER built it. Before each **[IPRPS CHROOT]** block inside a package section, check the folder in BUILDER with `pwd`, then go there in IPRPS CHROOT, for example `cd /build/src/libtasn1-4.21.0`. BUILDER's `~/src` is `/build/src`.

**Which install command:** if the BUILDER step ended with `ninja` (meson, or cmake with `-G Ninja`), install with `ninja install`, inside the `build` subfolder; if it ended with `make`, install with `make install`, in the same folder. "No rule to make target 'install'" or "loading 'build.ninja': No such file" means the wrong folder, the wrong command, or a build step that didn't finish.

**Five rules for building in a chroot:**

- **Clean-up "Permission denied"** means root-built files are in the folder (common with Perl and Python modules): run the same `rm -rf` in IPRPS CHROOT with the `/build/src/...` path.
- **Anything in angle brackets** (`<VERSION>`, `<ROOT-UUID>`, `<edition>`) is a placeholder: replace it, brackets included.

- **Skip steps that use the running hardware.** Mounting `efivarfs`, `systemctl start`, loading kernel modules and tests that create devices can't work in a chroot. Build and install steps are what matter; the hardware gets used at the boot tests.
- **Skip test suites** unless you're curious. Blocks marked **(Optional — skip if unsure)** are tests, documentation or extras that need tools you may not have.
- **Blocks marked "Example only — don't run"** show sample files or expected output. They're for reading.

> **Pro tip:** If Debian root's prompt shows `-bash-5.2#` instead of `root@ADRUQU:~#`, LFS Phase 3 renamed Debian's `/etc/bash.bashrc`. Restore it in DEBIAN ROOT with `mv -v /etc/bash.bashrc.NOUSE /etc/bash.bashrc`. In prompts, use `\$` (shows `#` for root), never `\#` (that's the command number).

> **Side note:** `su - builder` prints "cannot set terminal process group" and "no job control". That's a harmless chroot quirk. Inside BUILDER, `su` itself won't work ("must be run from a terminal"), which is why root work always happens in the IPRPS CHROOT window.

---

## Part 1 — The Base System: Your WSL LFS Build

You already have a working LFS 13.1-systemd system in WSL: the image that booted on real hardware. Rather than rebuilding LFS, copy it and convert the copy into the IPRPS base.

### 1.1 Make the IPRPS image from your LFS image

In WSL, as root (`sudo -i`). Start from the **known-good** image (`lfs-disk-v2-working.img`), not one that was used for experiments:

**[DEBIAN ROOT]**

```bash
mkdir -pv /root/snapshots
losetup -a                    # make sure no LFS image is attached
cp -v --sparse=always /root/lfs-disk-v2-working.img /root/iprps-system.img
sfdisk -l /root/iprps-system.img
```

The listing shows the old layout: EFI (1), BIOS boot (2), root (3) and **swap (4)** at the end. The IPRPS layout has no swap partition, and the root partition must be **last** so it can grow at first boot. Remove the swap partition, grow the root partition into the freed space, and grow the filesystem:

**[DEBIAN ROOT]**

```bash
sfdisk --delete /root/iprps-system.img 4
echo ", +" | sfdisk -N 3 /root/iprps-system.img
sfdisk -l /root/iprps-system.img
losetup -fP --show /root/iprps-system.img        # prints e.g. /dev/loop0
e2fsck -f /dev/loop0p3
resize2fs /dev/loop0p3
```

`sfdisk -l` should now show three partitions, with root taking the rest of the 40 GB. Use your loop number in the last two commands.

### 1.2 Adjust the base system for IPRPS

Mount it, then make the changes (the chroot comes in 1.3; these are plain file edits):

**[DEBIAN ROOT]**

```bash
mkdir -pv /mnt/iprps
mount -v /dev/loop0p3 /mnt/iprps
cat /mnt/iprps/etc/fstab
```

**Write a clean fstab.** The fstab from the USB build may still contain the old swap partition, a duplicate `/boot/efi` line, or a `/dev/<UUID>` mistake, and any of those drops the first boot test into emergency mode. Replace it with exactly two lines, filled in from the real IDs (`loop0` as in 1.1):

**[DEBIAN ROOT]**

```bash
cp -v /mnt/iprps/etc/fstab /mnt/iprps/etc/fstab.old
ROOT_UUID=$(blkid -s UUID -o value /dev/loop0p3)
EFI_UUID=$(blkid -s UUID -o value /dev/loop0p1)
echo "root: $ROOT_UUID   efi: $EFI_UUID"
cat > /mnt/iprps/etc/fstab << EOF
# Begin /etc/fstab

# file system        mount-point  type   options                                  dump fsck
UUID=$ROOT_UUID  /            ext4   defaults                                 1    1
UUID=$EFI_UUID   /boot/efi    vfat   codepage=437,iocharset=iso8859-1,nofail  0    2

# End /etc/fstab
EOF
cat /mnt/iprps/etc/fstab
```

The `echo` must show two IDs: a long one for root and a short one, like `87E8-3B4A`, for EFI. No swap line: first boot creates a swap file (13.1). `nofail` keeps a missing EFI partition from ever causing emergency mode. Then:

**[DEBIAN ROOT]**

```bash
echo iprps > /mnt/iprps/etc/hostname
ls /mnt/iprps/home                                  # remove test accounts if any
ls /mnt/iprps/boot/vmlinuz-*
grep -n 'linux ' /mnt/iprps/boot/grub/grub.cfg
```

The kernel name on the `linux` line must match the file `ls` shows exactly, capitals included. If the backup image still has the old name, fix it with `sed`, using the real name from `ls`:

**[DEBIAN ROOT]**

```bash
sed -i 's|/boot/vmlinuz-7.1.8-lfs-13.1-systemd|/boot/vmlinuz-7.1.8-IPRPS-1.0-systemd|' /mnt/iprps/boot/grub/grub.cfg
```

(Part 4 rewrites `grub.cfg` for the generic kernel anyway, so this only matters for testing before then.)

> **Side note:** Your LFS kernel was configured for that one USB setup. It stays for now, because Stages A–F run in the chroot and nothing boots until Part 4 installs the **generic** kernel. You'll boot-test from Part 4 on.

### 1.3 The scratch space and the chroot entry script

The scratch space is a folder on WSL's own disk, made visible inside the chroot:

**[DEBIAN ROOT]**

```bash
mkdir -pv /build/src /build/sources
cp -v /mnt/lfs/sources/*.tar.* /mnt/lfs/sources/*.patch /build/sources/ 2>/dev/null
ls /build/sources | wc -l
```

If your LFS sources are elsewhere (for example inside the image at `/mnt/iprps/sources`), copy them from there. They're your GPL source archive (13.7).

Save this script; it attaches the image, mounts everything and enters the chroot. It's safe to run again for a second window:

**[DEBIAN ROOT]**

```bash
cat > /root/iprps-enter.sh << "EOF"
#!/bin/bash
# Mount the IPRPS image and enter the chroot as root (IPRPS_IMG=<file> picks another image, such as a Lite fix copy)
IMG=${IPRPS_IMG:-/root/iprps-system.img}; R=/mnt/iprps
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
EOF
cat > /root/iprps-leave.sh << "EOF"
#!/bin/bash
# Unmount everything and detach the IPRPS image (run in Debian, outside the chroot)
R=/mnt/iprps
cd /
if fuser -sm "$R" 2>/dev/null; then
  echo "Still in use. Close these first (exit the chroot windows):"
  fuser -vm "$R" 2>&1 | tail -n +2
  exit 1
fi
rm -f "$R/etc/resolv.conf"
for m in dev/shm dev/pts dev proc sys run build boot/efi; do
  mountpoint -q "$R/$m" && umount -v "$R/$m"
done
mountpoint -q "$R" && umount -v "$R"
sync
for L in $(losetup -j "${IPRPS_IMG:-/root/iprps-system.img}" | cut -d: -f1); do losetup -v -d "$L"; done
echo "Remaining mounts under $R:"; findmnt -R "$R" || echo "  none"
losetup -a | grep iprps || echo "Image detached."
EOF
chmod 755 /root/iprps-enter.sh /root/iprps-leave.sh
bash -n /root/iprps-enter.sh && bash -n /root/iprps-leave.sh && echo "Scripts OK"
```

The last line must print **Scripts OK**. If not, the paste was garbled; compare the files with `nano`.

> **Side note:** The script copies WSL's `/etc/resolv.conf` into the image so downloads work inside the chroot; `iprps-leave.sh` removes it again. `iprps-leave.sh` refuses to run while anything is still inside the image, and lists what's blocking it. Usually that's a second chroot window: type `exit` there. Inside the chroot your prompt is a yellow `(iprps chroot)`, so you can't confuse it with WSL.

Enter the chroot. This window is now **IPRPS CHROOT**:

**[DEBIAN ROOT]**

```bash
bash /root/iprps-enter.sh
```

Confirm with the one-line test from the Conventions; it must print `IPRPS CHROOT`. Then create the build user. It's removed before release:

**[IPRPS CHROOT]**

```bash
useradd -m -G users,wheel -s /bin/bash builder
passwd builder
chown -v builder: /build/src
ln -sv /build/src /home/builder/src
```

### 1.4 Boot-testing a copy (from Part 4 on)

Never boot the image while it's mounted in WSL; that corrupts it. To test, leave every chroot window, run `bash /root/iprps-leave.sh`, and boot a **copy**:

**[DEBIAN ROOT]**

```bash
rm -f /root/iprps-test.img /mnt/g/IPRPS/test/iprps-test.vhdx
cp -v --sparse=always /root/iprps-system.img /root/iprps-test.img && echo "COPY COMPLETE"
qemu-img convert -p -O vhdx -o subformat=dynamic /root/iprps-test.img /mnt/g/IPRPS/test/iprps-test.vhdx
```

`qemu-img` comes from Debian's `qemu-utils` package. Install it in Debian, not in the chroot: `apt install qemu-utils`.

**Hyper-V (recommended).** In **Hyper-V Manager**, create the VM once:

1. **New > Virtual Machine**, Generation **2**.
2. Memory **6144 MB**, with **Dynamic Memory unticked**, so the test matches the 6 GB minimum.
3. Network: **Default Switch**.
4. **Use an existing virtual hard disk:** `G:\IPRPS\test\iprps-test.vhdx`.
5. Before the first start: **Settings > Security**, untick **Enable Secure Boot**.

For each new test, **turn off** the VM, re-create `iprps-test.vhdx` with the commands above (same path), and start it again.

**QEMU inside WSL with RealVNC Viewer** (works if `ls /dev/kvm` shows a file). WSL has no window support, so QEMU shows its screen over VNC, and **RealVNC Viewer** on Windows displays it.

**[DEBIAN ROOT]**: install once, then check that no old QEMU is running and the test copy is **complete**:

```bash
apt install qemu-system-x86 ovmf
pgrep -a qemu || echo "No QEMU running"
ls -l /root/iprps-test.img          # must be 42949672960 bytes
```

Start the VM:

```bash
qemu-system-x86_64 -enable-kvm -m 6G -smp 4 \
  -bios /usr/share/ovmf/OVMF.fd \
  -drive file=/root/iprps-test.img,format=raw,if=virtio \
  -nic user,model=virtio-net-pci,hostfwd=tcp::2222-:22 \
  -audio none \
  -vga virtio \
  -display none -vnc 127.0.0.1:0 \
  -monitor stdio
```

QEMU's Debian window shows a **`(qemu)`** prompt: the QEMU monitor. It sends keys the viewer can't, for example `sendkey ctrl-alt-f2` (text console), `sendkey ctrl-alt-f1` (back), `sendkey ctrl-alt-delete`; `quit` stops the VM.

**Logging in over SSH** (once OpenSSH is installed, Stage A) is the most reliable way to inspect a test VM, even when its screen is blank. From a **Debian** window (not a chroot window), once: `apt install openssh-client` as root. Then:

```bash
ssh -p 2222 builder@localhost
su -
```

Answer `yes` to the host-key question the first time. If it later says "REMOTE HOST IDENTIFICATION HAS CHANGED" (each fresh test copy), run `ssh-keygen -R "[localhost]:2222"`. Inside the VM, check you're really there with `cat /proc/cmdline` (it shows `vmlinuz-7.1.8-iprps`): the VM's `builder` has the same prompt as the chroot's.

**Booting to text mode once** (to debug a blank graphical screen): in the GRUB menu, press `e`, add ` systemd.unit=multi-user.target` to the end of the `linux` line, and press **Ctrl+X**.

On Windows, open **RealVNC Viewer** and connect to **`localhost:5900`** (accept the "unencrypted connection" warning; the connection never leaves your PC). Stop the VM with `poweroff` inside it, or **Ctrl+C** in QEMU's Debian window. Closing RealVNC doesn't stop the VM.

| Problem | Fix |
|---|---|
| `Failed to get "write" lock` | An old QEMU still runs: `pkill -f qemu-system-x86_64` |
| `Address already in use` | Use `-vnc 127.0.0.1:1` and connect to `localhost:5901` |
| RealVNC can't connect | Use `-vnc 0.0.0.0:0` and connect to the first address from `hostname -I` |
| GRUB: "attempt to read or write outside of disk" | The test copy is incomplete. Copy it again and wait for the copy to finish |
| `Could not set up host forwarding rule 'tcp::2222-:22'` | Port 2222 is taken by an old QEMU: `pkill -f qemu-system-x86_64` |
| A test shows an old problem you already fixed | The test copy is **older** than your fix: `ls -l --time-style=+'%F %H:%M' /root/iprps-system.img /root/iprps-test.img`. The test copy must be newer; re-copy after `iprps-leave.sh` |

> **Side note:** Until Part 4, the image still has the LFS kernel from your USB build, which lacks Hyper-V's disk driver, so a Hyper-V test would stop with "VFS: Unable to mount root fs". That's expected; real boot tests start with the generic kernel in Part 4.

> **Checkpoint:** Take snapshot **`00-iprps-base`** (0.4).

**[DEBIAN ROOT]** — snapshot `00-iprps-base`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-00-iprps-base.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-00-iprps-base.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 2 — BLFS Groundwork

### 2.1 BLFS shell startup files

BLFS packages install settings into `/etc/profile.d/`, which LFS's `/etc/profile` doesn't read. As root:

**[IPRPS CHROOT]**

```bash
cp -v /etc/profile /etc/profile.lfs-original
install --directory --mode=0755 --owner=root --group=root /etc/profile.d
cat > /etc/profile << "EOF"
# Begin /etc/profile
# Written for Beyond Linux From Scratch

pathremove () {
        local IFS=':'
        local NEWPATH
        local DIR
        local PATHVARIABLE=${2:-PATH}
        for DIR in ${!PATHVARIABLE} ; do
                if [ "$DIR" != "$1" ] ; then
                  NEWPATH=${NEWPATH:+$NEWPATH:}$DIR
                fi
        done
        export $PATHVARIABLE="$NEWPATH"
}

pathprepend () {
        pathremove $1 $2
        local PATHVARIABLE=${2:-PATH}
        export $PATHVARIABLE="$1${!PATHVARIABLE:+:${!PATHVARIABLE}}"
}

pathappend () {
        pathremove $1 $2
        local PATHVARIABLE=${2:-PATH}
        export $PATHVARIABLE="${!PATHVARIABLE:+${!PATHVARIABLE}:}$1"
}

export -f pathremove pathprepend pathappend

export PATH=/usr/bin

if [ ! -L /bin ]; then
        pathappend /bin
fi

if [ $EUID -eq 0 ] ; then
        pathappend /usr/sbin
        if [ ! -L /sbin ]; then
                pathappend /sbin
        fi
        unset HISTFILE
fi

export HISTSIZE=1000
export HISTIGNORE="&:[bf]g:exit"

export XDG_DATA_DIRS=${XDG_DATA_DIRS:-/usr/share}
export XDG_CONFIG_DIRS=${XDG_CONFIG_DIRS:-/etc/xdg}
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/tmp/xdg-$USER}

for script in /etc/profile.d/*.sh ; do
        if [ -r $script ] ; then
                . $script
        fi
done

unset script

# End /etc/profile
EOF
cat > /etc/profile.d/i18n.sh << "EOF"
# Set up i18n variables
for i in $(locale); do
  unset ${i%=*}
done

if [[ "$TERM" = linux ]]; then
  export LANG=C.UTF-8
else
  source /etc/locale.conf

  for i in $(locale); do
    key=${i%=*}
    if [[ -v $key ]]; then
      export $key
    fi
  done
fi
EOF
cat > /etc/profile.d/extrapaths.sh << "EOF"
if [ -d /usr/local/lib/pkgconfig ] ; then
        pathappend /usr/local/lib/pkgconfig PKG_CONFIG_PATH
fi
if [ -d /usr/local/bin ]; then
        pathprepend /usr/local/bin
fi
if [ -d /usr/local/sbin -a $EUID -eq 0 ]; then
        pathprepend /usr/local/sbin
fi
if [ -d /usr/local/share ]; then
        pathprepend /usr/local/share XDG_DATA_DIRS
fi
pathappend /usr/share/info INFOPATH
EOF
cat > /etc/profile.d/readline.sh << "EOF"
if [ -z "$INPUTRC" -a ! -f "$HOME/.inputrc" ] ; then
        INPUTRC=/etc/inputrc
fi
export INPUTRC
EOF
cat > /etc/profile.d/umask.sh << "EOF"
if [ "$(id -gn)" = "$(id -un)" -a $EUID -gt 99 ] ; then
  umask 002
else
  umask 022
fi
EOF
```

### 2.2 The Xorg build environment

**[IPRPS CHROOT]**

```bash
export XORG_PREFIX="/usr"
cat > /etc/profile.d/xorg.sh << EOF
XORG_PREFIX="$XORG_PREFIX"
XORG_CONFIG="--prefix=\$XORG_PREFIX --sysconfdir=/etc --localstatedir=/var --disable-static"
export XORG_PREFIX XORG_CONFIG
EOF
chmod 644 /etc/profile.d/xorg.sh
```

The sudo rule that keeps these variables comes after sudo is installed (Stage A).

### 2.3 Build-user settings

A login shell (which `su - builder` starts) reads `~/.bash_profile`, **not** `~/.bashrc`. So first make `.bash_profile` load `.bashrc`, then add the settings to `.bashrc`. Use the numbers for WSL's memory from 0.3:

**[BUILDER]**

```bash
echo '[ -f ~/.bashrc ] && . ~/.bashrc' >> ~/.bash_profile
```



**[BUILDER]**

```bash
cat >> ~/.bashrc << "EOF"
export MAKEFLAGS=-j6
export NINJAJOBS=6
EOF
```

Then define BLFS's `as_root` helper, which the Xorg loops use, in the same file:

**[BUILDER]**

```bash
cat >> ~/.bashrc << "EOF"
as_root()
{
  if   [ $EUID = 0 ];        then $*
  elif [ -x /usr/bin/sudo ]; then sudo $*
  else                            su -c \\"$*\\"
  fi
}
export -f as_root
EOF
```

Log out and back in, then check: `echo $XORG_PREFIX $MAKEFLAGS`.

### 2.4 First downloads before wget exists

LFS has no HTTPS download tool or certificate store. Until **make-ca** and **Wget** are installed (early in Stage A), download with this small helper. It uses Python without certificate checking, so **always check the MD5** printed in each package section:

**[BUILDER]**

```bash
cat > ~/fetch << "EOF"
#!/usr/bin/env python3
# fetch URL — bootstrap downloader (no certificate check: ALWAYS verify the MD5)
import ssl, sys, urllib.request, os
url = sys.argv[1]
name = os.path.basename(url.split('?')[0])
data = urllib.request.urlopen(url, context=ssl._create_unverified_context()).read()
open(name, 'wb').write(data)
print(f'{name}: {len(data)} bytes')
EOF
chmod +x ~/fetch
```

Stage A starts with the packages Wget needs, then Wget itself. Their download blocks **already use `~/fetch`** (and say so). Every later package uses plain `wget`.

### 2.5 The BLFS systemd units

Many BLFS packages enable their services with commands such as `make install-httpd`, which come from the **blfs-systemd-units** package. Download it once and **keep** the folder:

**[BUILDER]**

```bash
cd ~/src
~/fetch https://www.linuxfromscratch.org/blfs/downloads/13.1-systemd/blfs-systemd-units-20251204.tar.xz
tar -xf blfs-systemd-units-20251204.tar.xz
```

When a **Configure** step says to install a unit "included in the blfs-systemd-units package", run it from that folder: `cd ~/src/blfs-systemd-units-20251204`.

> **Checkpoint:** Take snapshot **`01-blfs-groundwork`**.

**[DEBIAN ROOT]** — snapshot `01-blfs-groundwork`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-01-blfs-groundwork.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-01-blfs-groundwork.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 3 — Stage A: Foundations, Security and sudo

Security and administration basics every edition needs: Linux-PAM (login security), **sudo**, certificates (make-ca), download tools (Wget, cURL), Git, OpenSSH, Polkit, disk tools, and the build tools later stages need (CMake, LLVM, Rust).

> **Warning:** **LLVM** and **Rust** are among the heaviest builds in this guide. Use the job limits from 0.3, and add `-D LLVM_PARALLEL_LINK_JOBS=1` to LLVM's `cmake` command.

> **Side note:** The first seven packages (up to and including **Wget**) download with `~/fetch`; their download commands already say so. After installing **Linux-PAM**, BLFS asks you to **rebuild Shadow and systemd** so they use it; those two rebuilds follow right after Linux-PAM below.

**49 packages, in build order:** libtasn1-4.21.0, p11-kit-0.26.5, make-ca-1.16.1, libunistring-1.4.2, libidn2-2.3.8, libpsl-0.23.3, Wget-1.25.0, Linux-PAM-1.7.2, Sudo-1.9.17p2, icu-78.3, libxml2-2.15.3, nghttp2-1.70.0, cURL-8.21.0, libarchive-3.8.9, libuv-1.52.1, CMake-4.4.2, libssh2-1.11.1, LLVM-22.1.8, Rustc-1.97.1, Git-2.55.0, OpenSSH-10.5p1, cpio-2.15, Which-2.25 and Alternatives, Nano-9.2, Zip-3.0, dosfstools-4.2, libaio-0.3.113, LVM2-2.03.42, parted-3.7, efivar-39, Popt-1.19, efibootmgr-18, pciutils-3.15.0, libusb-1.0.30, usbutils-019, rsync-3.5.0, libtirpc-1.3.7, lsof-4.99.7, duktape-2.7.0, docutils-0.23, libxslt-1.1.45, GLib-2.88.3, Polkit-127, docbook-xml-4.5, CrackLib-2.10.3, docbook-xsl-nons-1.79.2, hwdata-0.410, libpwquality-1.4.5, shared-mime-info-2.5.1.

### libtasn1-4.21.0

*BLFS 13.1 · ID `libtasn1` · Stage A* · *Build time:* 0.5 SBU (with tests) · *Disk space:* 16 MB (with tests)

> **Warning:** Wget isn't installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.

**[BUILDER]** — Download:

```bash
cd ~/src
~/fetch https://ftp.gnu.org/gnu/libtasn1/libtasn1-4.21.0.tar.gz
```

MD5 sum of `libtasn1-4.21.0.tar.gz`: `2ee1d9f3aa66f1e308c46a283aa9a8c2` (check with `md5sum libtasn1-4.21.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libtasn1-4.21.0.tar.gz
cd "$(tar -tf libtasn1-4.21.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libtasn1 by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you did not pass the --enable-gtk-doc parameter to the configure script, you can install the API documentation using the following command as the root user:

```bash
make -C doc/reference install-data-local
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libtasn1-4.21.0.tar.gz | head -1 | cut -d/ -f1)"
```


### p11-kit-0.26.5

*BLFS 13.1 · ID `p11-kit` · Stage A* · *Build time:* 0.5 SBU (with tests) · *Disk space:* 117 MB (with tests)

**Recommended (included):** `libtasn1`  
**Needed at runtime:** `make-ca`

> **Warning:** Wget isn't installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.

**[BUILDER]** — Download:

```bash
cd ~/src
~/fetch https://github.com/p11-glue/p11-kit/releases/download/0.26.5/p11-kit-0.26.5.tar.xz
```

MD5 sum of `p11-kit-0.26.5.tar.xz`: `308306e889850bff08fae74ae7897a21` (check with `md5sum p11-kit-0.26.5.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf p11-kit-0.26.5.tar.xz
cd "$(tar -tf p11-kit-0.26.5.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Prepare the distribution specific anchor hook:

```bash
sed '20,$ d' -i trust/trust-extract-compat &&

cat >> trust/trust-extract-compat << "EOF"
# Copy existing anchor modifications to /etc/ssl/local
/usr/libexec/make-ca/copy-trust-modifications

# Update trust stores
/usr/sbin/make-ca -r
EOF
```

**[BUILDER]** — Install p11-kit by running the following commands:

```bash
mkdir p11-build &&
cd    p11-build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D trust_paths=/etc/pki/anchors &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
ln -sfv /usr/libexec/p11-kit/trust-extract-compat \
        /usr/bin/update-ca-certificates
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The p11-kit trust module (/usr/lib/pkcs11/p11-kit-trust.so) can be used as a drop-in replacement for /usr/lib/libnssckbi.so to transparently make the system CAs available to NSS aware applications, rather than the static list provided by…

```bash
ln -sfv ./pkcs11/p11-kit-trust.so /usr/lib/libnssckbi.so
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf p11-kit-0.26.5.tar.xz | head -1 | cut -d/ -f1)"
```


### make-ca-1.16.1

*BLFS 13.1 · ID `make-ca` · Stage A* · *Build time:* less than 0.1 SBU (with all runtime deps) · *Disk space:* 164 KB (with all runtime deps)

**Requires:** `p11-kit`

> **Warning:** Wget isn't installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.

**[BUILDER]** — Download:

```bash
cd ~/src
~/fetch https://github.com/lfs-book/make-ca/archive/v1.16.1/make-ca-1.16.1.tar.gz
```

MD5 sum of `make-ca-1.16.1.tar.gz`: `bf9cea2d24fc5344d4951b49f275c595` (check with `md5sum make-ca-1.16.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf make-ca-1.16.1.tar.gz
cd "$(tar -tf make-ca-1.16.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — At first, remove the -t option from the mktemp commands in the script. This option is deprecated and it can cause unwanted effects if TMPDIR is set in the environment:

```bash
sed '/mktemp/s/-t //' -i make-ca
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To install the various certificate stores, first install the make-ca script into the correct location. As the root user:

```bash
make install &&
install -vdm755 /etc/ssl/local
```

> **Warning (BLFS):** Technically, this package is already installed at this point. But most packages listing make-ca as a dependency actually require the system certificate store set up by this package, rather than the make-ca program itself. So the instructions for using make-ca for setting up the system certificate store are included in this section. You should make sure the required runtime dependency for make-ca is satisfied now, and continue to follow the instructions.

> **Side note (BLFS):** If running the script a second time with the same version of certdata.txt, for instance, to update the stores when make-ca is upgraded, or to add additional stores as the requisite software is installed, replace the -g switch with the -r switch in the command line. If packaging, run make-ca --help to see all available command line options.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, download the certificate source and prepare for system use with the following command:

```bash
/usr/sbin/make-ca -g
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — You should periodically update the store with the above command, either manually, or via a systemd timer. A timer is installed at /usr/lib/systemd/system/update-pki.timer that, if enabled, will check for updates weekly.Execute the following commands, as…

```bash
systemctl enable update-pki.timer
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you need to override trust values, or otherwise need to create an OpenSSL trusted certificate manually from a regular PEM encoded file, you need to add trust arguments to the openssl command, and create a new certificate. For example, using the CAcert…

```bash
wget http://www.cacert.org/certs/root.crt &&
wget http://www.cacert.org/certs/class3.crt &&
openssl x509 -in root.crt -text -fingerprint -setalias "CAcert Class 1 root" \
        -addtrust serverAuth -addtrust emailProtection -addtrust codeSigning \
        > /etc/ssl/local/CAcert_Class_1_root.pem &&
openssl x509 -in class3.crt -text -fingerprint -setalias "CAcert Class 3 root" \
        -addtrust serverAuth -addtrust emailProtection -addtrust codeSigning \
        > /etc/ssl/local/CAcert_Class_3_root.pem &&
/usr/sbin/make-ca -r
```

**[BUILDER]** — *(Optional — skip if unsure)* Occasionally, there may be instances where you don't agree with Mozilla's inclusion of a particular certificate authority. If you'd like to override the default trust of a particular CA, simply create a copy of the existing certificate in /etc/ssl/local…

```bash
openssl x509 -in /etc/ssl/certs/Makebelieve_CA_Root.pem \
             -text \
             -fingerprint \
             -setalias "Disabled Makebelieve CA Root" \
             -addreject serverAuth \
             -addreject emailProtection \
             -addreject codeSigning \
       > /etc/ssl/local/Disabled_Makebelieve_CA_Root.pem &&
/usr/sbin/make-ca -r
```

**Configure:**

**[BUILDER]** — To use the system certificates in Python3, you should set _PIP_STANDALONE_CERT to point to them, e.g for the bash shell:

```bash
export _PIP_STANDALONE_CERT=/etc/pki/tls/certs/ca-bundle.crt
```

> **Warning (BLFS):** If you have created virtual environments, for example when testing modules, and those include the Requests and Certifi modules in ~/.local/lib/python3.14/, then those local modules will be used instead of the system certificates unless you remove the local modules.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To use the system certificates in Python3 with the BLFS profiles, add the following variable to your system or personal profiles:

```bash
mkdir -pv /etc/profile.d &&
cat > /etc/profile.d/pythoncerts.sh << "EOF"
# Begin /etc/profile.d/pythoncerts.sh

export _PIP_STANDALONE_CERT=/etc/pki/tls/certs/ca-bundle.crt

# End /etc/profile.d/pythoncerts.sh
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf make-ca-1.16.1.tar.gz | head -1 | cut -d/ -f1)"
```


### libunistring-1.4.2

*BLFS 13.1 · ID `libunistring` · Stage A* · *Build time:* 0.6 SBU (add 0.3 SBU for tests; both using parallelism=4) · *Disk space:* 58 MB (add 46 MB for tests)

> **Warning:** Wget isn't installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.

**[BUILDER]** — Download:

```bash
cd ~/src
~/fetch https://ftp.gnu.org/gnu/libunistring/libunistring-1.4.2.tar.xz
```

MD5 sum of `libunistring-1.4.2.tar.xz`: `e033195d90d0803063f3fecc77148124` (check with `md5sum libunistring-1.4.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libunistring-1.4.2.tar.xz
cd "$(tar -tf libunistring-1.4.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libunistring by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/libunistring-1.4.2 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libunistring-1.4.2.tar.xz | head -1 | cut -d/ -f1)"
```


### libidn2-2.3.8

*BLFS 13.1 · ID `libidn2` · Stage A* · *Build time:* 0.1 SBU (add 0.6 SBU for tests) · *Disk space:* 21 MB (add 3 MB for tests)

**Recommended (included):** `libunistring`

> **Warning:** Wget isn't installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.

**[BUILDER]** — Download:

```bash
cd ~/src
~/fetch https://ftp.gnu.org/gnu/libidn/libidn2-2.3.8.tar.gz
```

MD5 sum of `libidn2-2.3.8.tar.gz`: `a8e113e040d57a523684e141970eea7a` (check with `md5sum libidn2-2.3.8.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libidn2-2.3.8.tar.gz
cd "$(tar -tf libidn2-2.3.8.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libidn2 by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libidn2-2.3.8.tar.gz | head -1 | cut -d/ -f1)"
```


### libpsl-0.23.3

*BLFS 13.1 · ID `libpsl` · Stage A* · *Build time:* less than 0.1 SBU (including tests) · *Disk space:* 51 MB

**Recommended (included):** `libidn2`, `libunistring`

> **Warning:** Wget isn't installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.

**[BUILDER]** — Download:

```bash
cd ~/src
~/fetch https://github.com/rockdaboot/libpsl/releases/download/0.23.3/libpsl-0.23.3.tar.gz
```

MD5 sum of `libpsl-0.23.3.tar.gz`: `596df43f3c2a8f1d4a677b032ccbc820` (check with `md5sum libpsl-0.23.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libpsl-0.23.3.tar.gz
cd "$(tar -tf libpsl-0.23.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libpsl by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release &&

ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libpsl-0.23.3.tar.gz | head -1 | cut -d/ -f1)"
```


### Wget-1.25.0

*BLFS 13.1 · ID `wget` · Stage A* · *Build time:* 0.3 SBU (add 0.4 SBU for tests) · *Disk space:* 38 MB (add 27 MB for tests)

**Recommended (included):** `libpsl`  
**Needed at runtime:** `make-ca`

> **Warning:** Wget isn't installed yet, so this package downloads with **`~/fetch`** (2.4). Always check the MD5 sum below.

**[BUILDER]** — Download:

```bash
cd ~/src
~/fetch https://ftp.gnu.org/gnu/wget/wget-1.25.0.tar.gz
```

MD5 sum of `wget-1.25.0.tar.gz`: `c70ba58b36f944e8ba1d655ace552881` (check with `md5sum wget-1.25.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf wget-1.25.0.tar.gz
cd "$(tar -tf wget-1.25.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, make a fix to make the package compatible with OpenSSL 4. The bash variable is for presentation purposes due to the long line.

```bash
NEW_LINE='#if !defined OPENSSL_NO_SSL3_METHOD '
NEW_LINE+='&& OPENSSL_VERSION_NUMBER < 0x40000000L'

sed -i "/SSL3/c $NEW_LINE" src/openssl.c

unset NEW_LINE
```

**[BUILDER]** — Install Wget by running the following commands:

```bash
./configure --prefix=/usr      \
            --sysconfdir=/etc  \
            --with-ssl=openssl &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf wget-1.25.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Linux-PAM-1.7.2

*BLFS 13.1 · ID `linux-pam` · Stage A* · *Build time:* 0.3 SBU (with tests) · *Disk space:* 16 MB (with tests)

**Needed at runtime:** `shadow`, `systemd`, `libpwquality`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/linux-pam/linux-pam/releases/download/v1.7.2/Linux-PAM-1.7.2.tar.xz
wget https://anduin.linuxfromscratch.org/BLFS/Linux-PAM/Linux-PAM-1.7.2-docs.tar.xz
```

MD5 sum of `Linux-PAM-1.7.2.tar.xz`: `934c26eca3fada956356a30489e86291` (check with `md5sum Linux-PAM-1.7.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf Linux-PAM-1.7.2.tar.xz
cd "$(tar -tf Linux-PAM-1.7.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* If you've installed docbook-xml-5.0, docbook-xsl-ns-1.79.2, libxslt-1.1.45, and Lynx-2.9.3 and you wish to generate the plain text format of the documentations, modify meson.build to use Lynx-2.9.3 instead of W3m or Elinks that BLFS does not provide:

```bash
sed -e "s/'elinks'/'lynx'/"                       \
    -e "s/'-no-numbering', '-no-references'/      \
          '-force-html', '-nonumbers', '-stdin'/" \
    -i meson.build
```

**[BUILDER]** — Compile and link Linux PAM by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..        \
  --prefix=/usr       \
  --buildtype=release \
  -D docdir=/usr/share/doc/Linux-PAM-1.7.2 &&

ninja
```

> **Warning (BLFS):** If you have a system with Linux PAM installed and working, be careful when modifying the files in /etc/pam.d, since your system may become totally unusable. If you want to run the tests, you do not need to create another /etc/pam.d/other file. The existing file can be used for the tests.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For a first-time installation, create a configuration file by issuing the following commands as the root user:

```bash
install -v -m755 -d /etc/pam.d &&

cat > /etc/pam.d/other << "EOF"
auth     required       pam_deny.so
account  required       pam_deny.so
password required       pam_deny.so
session  required       pam_deny.so
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For a first-time installation, remove the configuration file created earlier by issuing the following command as the root user:

```bash
rm -fv /etc/pam.d/other
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
chmod -v 4755 /usr/sbin/unix_chkpwd
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you do not have the optional dependencies installed to build the documentation and downloaded the optional pre-built documentation, again as the root user:

```bash
tar -C / -xvf ../../Linux-PAM-1.7.2-docs.tar.xz
```

**Configure:**

*Example only — don't run:* Configuration information is placed in /etc/pam.d/. Here is a sample file:

```text
# Begin /etc/pam.d/other

auth            required        pam_unix.so     nullok
account         required        pam_unix.so
session         required        pam_unix.so
password        required        pam_unix.so     nullok

# End /etc/pam.d/other
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now create some generic configuration files. As the root user:

```bash
install -vdm755 /etc/pam.d &&
cat > /etc/pam.d/system-account << "EOF" &&
# Begin /etc/pam.d/system-account

account   required    pam_unix.so

# End /etc/pam.d/system-account
EOF

cat > /etc/pam.d/system-auth << "EOF" &&
# Begin /etc/pam.d/system-auth

auth      required    pam_unix.so

# End /etc/pam.d/system-auth
EOF

cat > /etc/pam.d/system-session << "EOF" &&
# Begin /etc/pam.d/system-session

session   required    pam_unix.so

# End /etc/pam.d/system-session
EOF

cat > /etc/pam.d/system-password << "EOF"
# Begin /etc/pam.d/system-password

# use yescrypt hash for encryption, use shadow, and try to use any
# previously defined authentication token (chosen password) set by any
# prior module.
password  required    pam_unix.so       yescrypt shadow try_first_pass

# End /etc/pam.d/system-password
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Next, add a restrictive /etc/pam.d/other configuration file. With this file, programs that are PAM aware will not run unless a configuration file specifically for that application exists.

```bash
cat > /etc/pam.d/other << "EOF"
# Begin /etc/pam.d/other

auth        required        pam_warn.so
auth        required        pam_deny.so
account     required        pam_warn.so
account     required        pam_deny.so
password    required        pam_warn.so
password    required        pam_deny.so
session     required        pam_warn.so
session     required        pam_deny.so

# End /etc/pam.d/other
EOF
```

> **Warning (BLFS):** You should now reinstall the Shadow-4.20.2 and Systemd-261.2 packages.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf Linux-PAM-1.7.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Shadow-4.20.2 (rebuild)

*BLFS 13.1 · ID `shadow` · Stage A* · *Build time:* 0.4 SBU · *Disk space:* 100 MB

> **Side note:** BLFS asks for this rebuild after installing Linux-PAM, so that the package uses PAM.

**Requires:** `linux-pam`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/shadow-maint/shadow/releases/download/4.20.2/shadow-4.20.2.tar.xz
```

MD5 sum of `shadow-4.20.2.tar.xz`: `f52e717bd330818c67bd57c897ec5a8e` (check with `md5sum shadow-4.20.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf shadow-4.20.2.tar.xz
cd "$(tar -tf shadow-4.20.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Warning (BLFS):** The installation commands shown below are for installations where Linux-PAM has been installed and Shadow is being reinstalled to support the Linux-PAM installation.

**[BUILDER]** — Reinstall Shadow by running the following commands:

```bash
find man -name Makefile.in -exec sed -i 's/getspnam\.3 / /' {} \; &&
find man -name Makefile.in -exec sed -i 's/passwd\.5 / /'   {} \; &&

sed -e 's@#ENCRYPT_METHOD DES@ENCRYPT_METHOD YESCRYPT@' \
    -e 's@/var/spool/mail@/var/mail@'                   \
    -e '/PATH=/{s@/sbin:@@;s@/bin:@@}'                  \
    -i etc/login.defs                                   &&

./configure --sysconfdir=/etc   \
            --disable-static    \
            --without-libbsd    \
            --with-{b,yes}crypt &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make exec_prefix=/usr pamddir= install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The man pages were installed in LFS, but if reinstallation is desired, run (as the root user):

```bash
make -C man install-man
```

**Configure:**

> **Side note (BLFS):** The rest of this page is devoted to configuring Shadow to work properly with Linux-PAM.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The login program currently performs many functions which Linux-PAM modules should now handle. The following sed command will comment out the appropriate lines in /etc/login.defs, and stop login from performing these functions (a backup file named…

```bash
install -v -m644 /etc/login.defs /etc/login.defs.orig &&
for FUNCTION in FAIL_DELAY               \
                FAILLOG_ENAB             \
                LASTLOG_ENAB             \
                MAIL_CHECK_ENAB          \
                OBSCURE_CHECKS_ENAB      \
                PORTTIME_CHECKS_ENAB     \
                QUOTAS_ENAB              \
                CONSOLE MOTD_FILE        \
                FTMP_FILE NOLOGINS_FILE  \
                ENV_HZ PASS_MIN_LEN      \
                SU_WHEEL_ONLY            \
                PASS_CHANGE_TRIES        \
                PASS_ALWAYS_WARN         \
                CHFN_AUTH ENCRYPT_METHOD \
                ENVIRON_FILE
do
    sed -i "s/^${FUNCTION}/# &/" /etc/login.defs
done
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, create the following Linux-PAM configuration files in the /etc/pam.d/ directory (or add the contents to the /etc/pam.conf file) using the following commands:

```bash
cat > /etc/pam.d/login << "EOF"
# Begin /etc/pam.d/login

# Set failure delay before next prompt to 3 seconds
auth      optional    pam_faildelay.so  delay=3000000

# Check to make sure that the user is allowed to login
auth      requisite   pam_nologin.so

# Check to make sure that root is allowed to login
# Disabled by default. You will need to create /etc/securetty
# file for this module to function. See man 5 securetty.
#auth      required    pam_securetty.so

# Additional group memberships - disabled by default
#auth      optional    pam_group.so

# include system auth settings
auth      include     system-auth

# check access for the user
account   required    pam_access.so

# include system account settings
account   include     system-account

# Set default environment variables for the user
session   required    pam_env.so

# Set resource limits for the user
session   required    pam_limits.so

# Display the message of the day - Disabled by default
#session   optional    pam_motd.so

# Check user's mail - Disabled by default
#session   optional    pam_mail.so      standard quiet

# include system session and password settings
session   include     system-session
password  include     system-password

# End /etc/pam.d/login
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
cat > /etc/pam.d/passwd << "EOF"
# Begin /etc/pam.d/passwd

password  include     system-password

# End /etc/pam.d/passwd
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
cat > /etc/pam.d/su << "EOF"
# Begin /etc/pam.d/su

# always allow root
auth      sufficient  pam_rootok.so

# Allow users in the wheel group to execute su without a password
# disabled by default
#auth      sufficient  pam_wheel.so trust use_uid

# include system auth settings
auth      include     system-auth

# limit su to users in the wheel group
# disabled by default
#auth      required    pam_wheel.so use_uid

# include system account settings
account   include     system-account

# Set default environment variables for the service user
session   required    pam_env.so

# include system session settings
session   include     system-session

# End /etc/pam.d/su
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
cat > /etc/pam.d/chpasswd << "EOF"
# Begin /etc/pam.d/chpasswd

# always allow root
auth      sufficient  pam_rootok.so

# include system auth and account settings
auth      include     system-auth
account   include     system-account
password  include     system-password

# End /etc/pam.d/chpasswd
EOF

sed -e s/chpasswd/newusers/ /etc/pam.d/chpasswd >/etc/pam.d/newusers
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
cat > /etc/pam.d/chage << "EOF"
# Begin /etc/pam.d/chage

# always allow root
auth      sufficient  pam_rootok.so

# include system auth and account settings
auth      include     system-auth
account   include     system-account

# End /etc/pam.d/chage
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
for PROGRAM in chfn chgpasswd chsh groupadd groupdel \
               groupmems groupmod useradd userdel usermod
do
    install -v -m644 /etc/pam.d/chage /etc/pam.d/${PROGRAM}
    sed -i "s/chage/$PROGRAM/" /etc/pam.d/${PROGRAM}
done
```

> **Warning (BLFS):** At this point, you should do a simple test to see if Shadow is working as expected. Open another terminal and log in as root, and then run login and login as another user. If you do not see any errors, then all is well and you should proceed with the rest of the configuration. If you did receive errors, stop now and double check the above configuration files manually. Any error is the sign of an error in the above procedure. You can also run the test suite from the Linux-PAM package to assist you in determining the problem. If you cannot find and fix the error, you should recompile Shadow adding the --without-libpam switch to the configure command in the above instructions (also move the /etc/login.defs.orig backup file to /etc/login.defs). If you fail to do this and the errors remain, you will be unable to log into your system.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Instead of using the /etc/login.access file for controlling access to the system, Linux-PAM uses the pam_access.so module along with the /etc/security/access.conf file. Rename the /etc/login.access file using the following command:

```bash
if [ -f /etc/login.access ]; then mv -v /etc/login.access{,.NOUSE}; fi
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Instead of using the /etc/limits file for limiting usage of system resources, Linux-PAM uses the pam_limits.so module along with the /etc/security/limits.conf file. Rename the /etc/limits file using the following command:

```bash
if [ -f /etc/limits ]; then mv -v /etc/limits{,.NOUSE}; fi
```

> **Warning (BLFS):** Be sure to test the login capabilities of the system before logging out. Errors in the configuration can cause a permanent lockout requiring a boot from an external source to correct the problem.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf shadow-4.20.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Systemd-261.2 (rebuild)

*BLFS 13.1 · ID `systemd` · Stage A* · *Build time:* 1.2 SBU (with tests using 4 cores) · *Disk space:* 396 MB (with tests)

> **Side note:** BLFS asks for this rebuild after installing Linux-PAM, so that the package uses PAM.

**Recommended (included):** `linux-pam`  
**Needed at runtime:** `polkit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/systemd/systemd/archive/v261.2/systemd-261.2.tar.gz
```

MD5 sum of `systemd-261.2.tar.gz`: `e3f04ccc83a28ec5e80c5432bb8329f5` (check with `md5sum systemd-261.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf systemd-261.2.tar.gz
cd "$(tar -tf systemd-261.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Warning (BLFS):** If a previous version of systemd has been installed, remove a service that will generate errors on following boots. As the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If a previous version of systemd has been installed, remove a service that will generate errors on following boots. As the root user:

```bash
rm -fv /usr/lib/systemd/system/systemd-update-utmp-runlevel.service
```

**[BUILDER]** — Remove two unneeded groups, render and sgx, from the default udev rules:

```bash
sed -i -e 's/GROUP="render"/GROUP="video"/' \
       -e 's/GROUP="sgx", //' rules.d/50-udev-default.rules.in
```

**[BUILDER]** — Rebuild systemd by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                 \
      --prefix=/usr            \
      --buildtype=release      \
      -D default-dnssec=no     \
      -D firstboot=false       \
      -D install-tests=false   \
      -D ldconfig=false        \
      -D man=auto              \
      -D sysusers=false        \
      -D rpmmacrosdir=no       \
      -D homed=disabled        \
      -D mode=release          \
      -D pam=enabled           \
      -D pamconfdir=/etc/pam.d \
      -D dev-kvm-mode=0660     \
      -D nobody-group=nogroup  \
      -D sysupdate=disabled    \
      -D ukify=disabled        \
      -D docdir=/usr/share/doc/systemd-261.2 &&

ninja
```

> **Side note (BLFS):** For the best test results, make sure you run the test suite from a system that is booted by the same systemd version you are rebuilding.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The /etc/pam.d/system-session file needs to be modified and a new file needs to be created in order for systemd-logind to work correctly. Run the following commands as the root user:

```bash
grep 'pam_systemd' /etc/pam.d/system-session ||
cat >> /etc/pam.d/system-session << "EOF"
# Begin Systemd addition

session  required    pam_loginuid.so
session  optional    pam_systemd.so

# End Systemd addition
EOF

cat > /etc/pam.d/systemd-user << "EOF"
# Begin /etc/pam.d/systemd-user

account  required    pam_access.so
account  include     system-account

session  required    pam_env.so
session  required    pam_limits.so
session  required    pam_loginuid.so
session  optional    pam_keyinit.so force revoke
session  optional    pam_systemd.so

auth     required    pam_deny.so
password required    pam_deny.so

# End /etc/pam.d/systemd-user
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, replace the running systemd manager (the init process) with the systemd executable newly built and installed:

```bash
systemctl daemon-reexec
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — A desktop environment often runs as a group of systemd user services. Those services are spawned by the systemd per-user instance, instead of the login shell. To ensure those services get the environment variables we've set via /etc/profile.d, as the root…

```bash
install -vdm755 /etc/systemd/user-environment-generators &&
cat > /etc/systemd/user-environment-generators/50-profile.sh << "EOF" &&
#!/usr/bin/env -S -i /usr/bin/bash
# SPDX-License-Identifier: MIT

. /etc/profile

# Systemd should have already set a better value for them.
unset XDG_RUNTIME_DIR
for i in $(locale); do
  unset ${i%=*}
done

# Some shell magic that we don't want to expose.
unset SHLVL

# Systemd does not want to pass functions to the environment
for i in $(declare -pF | awk '{print $3}'); do
  unset -f $i
done

python3 << _EOF
import os
for var in os.environ:
  # Simply unsetting them in shell does not work.
  if var in ['LC_CTYPE', '_']:
    continue

  print(var + '=' + os.environ[var])
_EOF
EOF

chmod -v 755 /etc/systemd/user-environment-generators/50-profile.sh
```

**[BUILDER]** — *(Optional — skip if unsure)* Read systemd.environment-generator(7) for details about the systemd environment generators. Note that if you've edited the content of /etc/profile.d when a desktop environment is running, you need to sync the change into the systemd per-user instance:

```bash
systemctl --user unset-environment \
  $(/etc/systemd/user-environment-generators/50-profile.sh | sed 's/=.*//')
systemctl --user daemon-reload
```

> **Warning (BLFS):** Now ensure Shadow-4.20.2 has been already rebuilt with Linux-PAM-1.7.2 support first, then logout, and login again. This will ensure that the running login session is registered with systemd-logind, and that a per-user systemd instance is running for each user owning a login session. Many BLFS packages listing systemd as a dependency need the systemd-logind integration and/or a running per-user systemd instance at runtime.

> **Warning (BLFS):** If you are upgrading from a previous version of systemd and an initrd is used for system boot, you should generate a new initrd before rebooting the system.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf systemd-261.2.tar.gz | head -1 | cut -d/ -f1)"
```


### Sudo-1.9.17p2

*BLFS 13.1 · ID `sudo` · Stage A* · *Build time:* 0.2 SBU (with parallelism=4; add 0.1 SBU for tests) · *Disk space:* 54 MB (add 10 MB for tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.sudo.ws/dist/sudo-1.9.17p2.tar.gz
```

MD5 sum of `sudo-1.9.17p2.tar.gz`: `dcbf46f739ae06b076e1a11cbb271a10` (check with `md5sum sudo-1.9.17p2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf sudo-1.9.17p2.tar.gz
cd "$(tar -tf sudo-1.9.17p2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix building sudo with openssl-4:

```bash
sed -e 's/\([->.a-zA-Z_]*\)->length/ASN1_STRING_length(\1)/' \
    -i lib/iolog/hostcheck.c
```

**[BUILDER]** — Install Sudo by running the following commands:

```bash
./configure --prefix=/usr         \
            --libexecdir=/usr/lib \
            --with-secure-path    \
            --with-env-editor     \
            --docdir=/usr/share/doc/sudo-1.9.17p2 \
            --with-passprompt="[sudo] password for %p: " &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — A couple of common configuration changes are to set the path for the super user and to allow members of the wheel group to execute all commands after providing their own credentials. Use the following commands to create the /etc/sudoers.d/00-sudo…

```bash
cat > /etc/sudoers.d/00-sudo << "EOF"
Defaults secure_path="/usr/sbin:/usr/bin"
%wheel ALL=(ALL) ALL
EOF
```

> **Side note (BLFS):** In very simple installations where there is only one user, it may be easier to just edit the /etc/sudoers file directly. In that case, the secure_path entry may not be needed and using sudo -E ... can import the non-privileged user's full environment into the privileged session. The files in the /etc/sudoers.d directory are parsed in sorted lexical order. Be careful that entries in an added file do not overwrite previous entries.

> **Side note (BLFS):** The Sudo developers highly recommend using the visudo program to edit the sudoers file. This will provide basic sanity checking like syntax parsing and file permission to avoid some possible mistakes that could lead to a vulnerable configuration.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If PAM is installed on the system, Sudo is built with PAM support. In that case, issue the following command as the root user to create the PAM configuration file:

```bash
cat > /etc/pam.d/sudo << "EOF"
# Begin /etc/pam.d/sudo

# include the default auth settings
auth      include     system-auth

# include the default account settings
account   include     system-account

# Set default environment variables for the service user
session   required    pam_env.so

# include system session defaults
session   include     system-session

# End /etc/pam.d/sudo
EOF
chmod 644 /etc/pam.d/sudo
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf sudo-1.9.17p2.tar.gz | head -1 | cut -d/ -f1)"
```


### icu-78.3

*BLFS 13.1 · ID `icu` · Stage A* · *Build time:* 0.5 SBU (Using parallelism=4; add 2.1 SBU for tests) · *Disk space:* 362 MB (add 48 MB for tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/unicode-org/icu/releases/download/release-78.3/icu4c-78.3-sources.tgz
```

MD5 sum of `icu4c-78.3-sources.tgz`: `a7b736b570ef0e180c96a31715a00c78` (check with `md5sum icu4c-78.3-sources.tgz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf icu4c-78.3-sources.tgz
cd "$(tar -tf icu4c-78.3-sources.tgz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package expands to the directory icu.

**[BUILDER]** — A part of a test cannot be run on i686. Avoid executing it when building for that platform:

```bash
case $(uname -m) in
  i?86) sed -e "s/U_PLATFORM_IS_LINUX_BASED/__X86_64__ \&\& &/" \
            -i source/test/intltest/ustrtest.cpp ;;
esac
```

**[BUILDER]** — Install ICU by running the following commands:

```bash
cd source                 &&
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf icu4c-78.3-sources.tgz | head -1 | cut -d/ -f1)"
```


### libxml2-2.15.3

*BLFS 13.1 · ID `libxml2` · Stage A* · *Build time:* less than 0.1 SBU (Using parallelism=4; with tests and documentation) · *Disk space:* 64 MB (add 27 MB for documentation and 17 MB for tests)

**Recommended (included):** `icu`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libxml2/2.15/libxml2-2.15.3.tar.xz
wget https://www.w3.org/XML/Test/xmlts20130923.tar.gz
```

MD5 sum of `libxml2-2.15.3.tar.xz`: `b7b0123654f86ebf630a5cbedaafdece` (check with `md5sum libxml2-2.15.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxml2-2.15.3.tar.xz
cd "$(tar -tf libxml2-2.15.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, remove an unnecessary call to git in meson.build:

```bash
sed -i "/'git'/,+3d" meson.build
```

**[BUILDER]** — Install libxml2 by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D history=enabled  \
      -D icu=enabled      &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you wish to build and install the manual pages and the documentation, you should have libxslt-1.1.45 and Doxygen-1.18.0 installed, and run:

```bash
sed -e "/^dir_doc/s/\$/ + '-' + meson.project_version()/" \
    -i ../meson.build                                     &&
meson configure -D docs=enabled                           &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you downloaded the test suite, issue the following command:

```bash
tar xf ../../xmlts20130923.tar.gz -C ..
```

> **Side note (BLFS):** The tests use http://localhost/ to test parsing of external entities. If the machine where you run the tests serves as a web site, the tests may hang, depending on the content of the file served. It is therefore recommended to shut down the server during the tests, as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* The tests use http://localhost/ to test parsing of external entities. If the machine where you run the tests serves as a web site, the tests may hang, depending on the content of the file served. It is therefore recommended to shut down the server during…

```bash
systemctl stop httpd.service
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The xml2-config may return flags needed to link against the static library for the project, including the references to the icu-78.3 libraries. That would be pointless because we only install the shared library. To make things worse, that may cause some…

```bash
sed "s/--static/--shared/" -i /usr/bin/xml2-config
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxml2-2.15.3.tar.xz | head -1 | cut -d/ -f1)"
```


### nghttp2-1.70.0

*BLFS 13.1 · ID `nghttp2` · Stage A* · *Build time:* 0.1 SBU · *Disk space:* 29 MB

**Recommended (included):** `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/nghttp2/nghttp2/releases/download/v1.70.0/nghttp2-1.70.0.tar.xz
```

MD5 sum of `nghttp2-1.70.0.tar.xz`: `3df2b4b51caa13b76032bfd2d11d4ab2` (check with `md5sum nghttp2-1.70.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf nghttp2-1.70.0.tar.xz
cd "$(tar -tf nghttp2-1.70.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install nghttp2 by running the following commands:

```bash
./configure --prefix=/usr     \
            --disable-static  \
            --enable-lib-only \
            --docdir=/usr/share/doc/nghttp2-1.70.0 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf nghttp2-1.70.0.tar.xz | head -1 | cut -d/ -f1)"
```


### cURL-8.21.0

*BLFS 13.1 · ID `curl` · Stage A* · *Build time:* 0.3 SBU (add 4.1 SBU for tests (without valgrind, add 17 SBU with valgrind) all using parallelism=4) · *Disk space:* 51 64 MB (with tests)

**Recommended (included):** `libpsl`, `nghttp2`  
**Needed at runtime:** `make-ca`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://curl.se/download/curl-8.21.0.tar.xz
```

MD5 sum of `curl-8.21.0.tar.xz`: `230131079987135cbe1eadb77a04af57` (check with `md5sum curl-8.21.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf curl-8.21.0.tar.xz
cd "$(tar -tf curl-8.21.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install cURL by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --with-openssl   \
            --with-ca-path=/etc/ssl/certs &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&

rm -rf docs/examples/.deps &&

find docs \( -name Makefile\* -o  \
             -name \*.1       -o  \
             -name \*.3       -o  \
             -name CMakeLists.txt \) -delete &&

cp -v -R docs -T /usr/share/doc/curl-8.21.0
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf curl-8.21.0.tar.xz | head -1 | cut -d/ -f1)"
```


### libarchive-3.8.9

*BLFS 13.1 · ID `libarchive` · Stage A* · *Build time:* 1.1 SBU (with tests) · *Disk space:* 91 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libarchive/libarchive/releases/download/v3.8.9/libarchive-3.8.9.tar.xz
```

MD5 sum of `libarchive-3.8.9.tar.xz`: `535e3afec5f61d493f0b1b9e8bcf7539` (check with `md5sum libarchive-3.8.9.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libarchive-3.8.9.tar.xz
cd "$(tar -tf libarchive-3.8.9.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libarchive by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Still as the root user, create a symlink so we can use bsdunzip as unzip, instead of relying on the unmaintained Unzip package:

```bash
ln -sfv bsdunzip /usr/bin/unzip
```

> **Side note (BLFS):** As discussed in locale-wrong-filename-encoding, if the Zip archive to be extracted contains any file with a name containing any non-Latin characters, you need to manually specify the encoding of those characters or they will be turned into unreadable sequences in the extracted file name. For example, if a Zip archive created with WinZip, archive.zip, contains a file named with Simplified Chinese characters, the encoding should be CP936 and the -I cp936 option should be used. I.e. the command to extract the archive should be unzip -I cp936 archive.zip.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libarchive-3.8.9.tar.xz | head -1 | cut -d/ -f1)"
```


### libuv-1.52.1

*BLFS 13.1 · ID `libuv` · Stage A* · *Build time:* 0.5 SBU (with tests and man page) · *Disk space:* 33 MB (with tests and man page)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://dist.libuv.org/dist/v1.52.1/libuv-v1.52.1.tar.gz
```

MD5 sum of `libuv-v1.52.1.tar.gz`: `db711bbe3822dd4fe51fad0cd78baa57` (check with `md5sum libuv-v1.52.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libuv-v1.52.1.tar.gz
cd "$(tar -tf libuv-v1.52.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Warning (BLFS):** The sh autogen.sh command below fails if the ACLOCAL environment variable is set as specified in Introduction to Xorg-7. If it is used, ACLOCAL needs to be unset for this package and then reset for other packages.

**[BUILDER]** — Install libuv by running the following commands:

```bash
sh autogen.sh                              &&
./configure --prefix=/usr --disable-static &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you installed the optional Sphinx-9.1.0 python module, create the man page:

```bash
make man -C docs
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the man page, install it as the root user:

```bash
install -Dm644 docs/build/man/libuv.1 /usr/share/man/man1
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libuv-v1.52.1.tar.gz | head -1 | cut -d/ -f1)"
```


### CMake-4.4.2

*BLFS 13.1 · ID `cmake` · Stage A* · *Build time:* 2.2 SBU (add 4.3 SBU for tests, both using parallelism=4) · *Disk space:* 2.3 GB (with tests)

**Recommended (included):** `curl`, `libarchive`, `libuv`, `nghttp2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://cmake.org/files/v4.4/cmake-4.4.2.tar.gz
```

MD5 sum of `cmake-4.4.2.tar.gz`: `6911f0379d901db23619413f092b99ef` (check with `md5sum cmake-4.4.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cmake-4.4.2.tar.gz
cd "$(tar -tf cmake-4.4.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install CMake by running the following commands:

```bash
sed -i '/"lib64"/s/64//' Modules/GNUInstallDirs.cmake &&

./bootstrap --prefix=/usr        \
            --system-libs        \
            --mandir=/share/man  \
            --no-system-jsoncpp  \
            --no-system-cppdap   \
            --no-system-librhash \
            --docdir=/share/doc/cmake-4.4.2 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cmake-4.4.2.tar.gz | head -1 | cut -d/ -f1)"
```


### libssh2-1.11.1

*BLFS 13.1 · ID `libssh2` · Stage A* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 15 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.libssh2.org/download/libssh2-1.11.1.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/libssh2-1.11.1-security_fixes-1.patch
```

MD5 sum of `libssh2-1.11.1.tar.gz`: `38857d10b5c5deb198d6989dacace2e6` (check with `md5sum libssh2-1.11.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libssh2-1.11.1.tar.gz
cd "$(tar -tf libssh2-1.11.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix three security vulnerabilities in libssh2:

```bash
patch -Np1 -i ../libssh2-1.11.1-security_fixes-1.patch
```

**[BUILDER]** — Install libssh2 by running the following commands:

```bash
./configure --prefix=/usr          \
            --disable-docker-tests \
            --disable-static       &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libssh2-1.11.1.tar.gz | head -1 | cut -d/ -f1)"
```


### LLVM-22.1.8

*BLFS 13.1 · ID `llvm` · Stage A* · *Build time:* 13 SBU (Add 19 SBU for tests; both using parallelism=8) · *Disk space:* 4.7 GB (1.1 GB installed; add 23 GB for tests and 2.3 GB for documentation)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/llvm/llvm-project/releases/download/llvmorg-22.1.8/llvm-project-22.1.8.src.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/llvm-22.1.8-upstream_fix-1.patch
```

MD5 sum of `llvm-project-22.1.8.src.tar.xz`: `69065494ebcb1150b2a329c1b3db7584` (check with `md5sum llvm-project-22.1.8.src.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf llvm-project-22.1.8.src.tar.xz
cd "$(tar -tf llvm-project-22.1.8.src.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — At first, fix a bug causing wrong code on some conditions:

```bash
patch -Np1 -i ../llvm-22.1.8-upstream_fix-1.patch
```

**[BUILDER]** — There are many Python scripts in this package which use /usr/bin/env python to access the system Python which on LFS is Python-3.14.7. Use the following command to fix these scripts:

```bash
grep -rl '#!.*python$' | xargs sed -i '1s/python$/python3/'
```

**[BUILDER]** — *(Optional — skip if unsure)* Ensure installing the FileCheck program which is needed by the test suite of some packages (for example Rustc-1.97.1):

```bash
sed 's/utility/tool/' -i llvm/utils/FileCheck/CMakeLists.txt
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, create two configuration files to make gSSP enabled by default for clang and clang++, so the default configuration of their SSP feature will be consistent with GCC-16.2.0:

```bash
mkdir -pv /etc/clang &&
for i in clang clang++; do
  echo -fstack-protector-strong > /etc/clang/$i.cfg
done
```

> **Side note (BLFS):** Generally we only create the configuration files after installing the package in BLFS. However in this case the building system will build compiler-rt with clang and clang++, so we create the configuration files before compiling LLVM to ensure compiler-rt built with SSP.

**[BUILDER]** — Install LLVM by running the following commands:

```bash
mkdir -v llvm/build &&
cd       llvm/build &&

CC=gcc CXX=g++                               \
cmake -D CMAKE_INSTALL_PREFIX=/usr           \
      -D CMAKE_SKIP_INSTALL_RPATH=ON         \
      -D LLVM_ENABLE_FFI=ON                  \
      -D CMAKE_BUILD_TYPE=Release            \
      -D LLVM_BUILD_LLVM_DYLIB=ON            \
      -D LLVM_LINK_LLVM_DYLIB=ON             \
      -D LLVM_ENABLE_RTTI=ON                 \
      -D LLVM_TARGETS_TO_BUILD="host;AMDGPU" \
      -D LLVM_ENABLE_PROJECTS=clang          \
      -D LLVM_ENABLE_RUNTIMES=compiler-rt    \
      -D LLVM_BINUTILS_INCDIR=/usr/include   \
      -D LLVM_INCLUDE_BENCHMARKS=OFF         \
      -D CLANG_DEFAULT_PIE_ON_LINUX=ON       \
      -D CLANG_CONFIG_FILE_SYSTEM_DIR=/etc/clang \
      -W no-author -G Ninja ..               &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* LLVM test suite can produce many core dump files. They will occupy a large amount of disk space, and the core dump process can significantly slow down the testing. To test the results with core dump disabled, ensure Systemd-261.2 and Shadow-4.20.2 have…

```bash
systemctl   --user start dbus &&
systemd-run --user --pty -d -G -p LimitCORE=0 ninja check-all
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf llvm-project-22.1.8.src.tar.xz | head -1 | cut -d/ -f1)"
```


### Rustc-1.97.1

*BLFS 13.1 · ID `rust` · Stage A* · *Build time:* 10 SBU (including download time; add 15 SBU for tests, both using parallelism=8) · *Disk space:* 10 GB (324 MB installed); add 11 GB if running the tests

**Requires:** `cmake`, `curl`  
**Recommended (included):** `libssh2`, `llvm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://static.rust-lang.org/dist/rustc-1.97.1-src.tar.xz
```

MD5 sum of `rustc-1.97.1-src.tar.xz`: `c6fc3febcd3b1235cf4f00c3e05559b3` (check with `md5sum rustc-1.97.1-src.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf rustc-1.97.1-src.tar.xz
cd "$(tar -tf rustc-1.97.1-src.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To install into the /opt directory, remove any existing /opt/rustc symlink and create a new directory (i.e. with a different name if trying a modified build of the same version). As the root user:

```bash
mkdir -pv /opt/rustc-1.97.1      &&
ln -svfn rustc-1.97.1 /opt/rustc
```

> **Side note (BLFS):** If multiple versions of Rust are installed in /opt, changing to another version only requires changing the /opt/rustc symbolic link and then running ldconfig.

**[BUILDER]** — Create a suitable bootstrap.toml file which will configure the build.

```bash
cat << EOF > bootstrap.toml
# See bootstrap.toml.example for more possible options,
# and see src/bootstrap/defaults/bootstrap.dist.toml for a few options
# automatically set when building from a release tarball
# (unfortunately, we have to override many of them).

# Tell x.py that the editors have reviewed the content of this file
# and updated it to follow the major changes of the building system,
# so x.py will not warn users to review that information.
change-id = 154587

[llvm]
# When using the system installed copy of LLVM, prefer the shared libraries
link-shared = true

# If building the shipped LLVM source, only enable the x86 target
# instead of all the targets supported by LLVM.
targets = "X86"

[build]
description = "for BLFS r13.1"

# Omit the documentation to save time and space (the default is to build them).
docs = false

# Only install these extended tools. Cargo, clippy, rustdoc, and rustfmt
# are installed by a default rustup installation, and rust-src is needed
# to build the Rust code in Linux kernel (in case you need such a kernel
# feature).
tools = ["cargo", "clippy", "rustdoc", "rustfmt", "src"]

[install]
prefix = "/opt/rustc-1.97.1"
docdir = "share/doc/rustc-1.97.1"

[rust]
channel = "stable"

# Enable the same optimizations as the official upstream build.
lto = "thin"
codegen-units = 1

# Don't build llvm-bitcode-linker which is only useful for the NVPTX
# backend that we don't enable.
llvm-bitcode-linker = false

[target.x86_64-unknown-linux-gnu]
llvm-config = "/usr/bin/llvm-config"

[target.i686-unknown-linux-gnu]
llvm-config = "/usr/bin/llvm-config"
EOF
```

**[BUILDER]** — Compile Rust by running the following commands:

```bash
export LIBSSH2_SYS_USE_PKG_CONFIG=1
export LIBSQLITE3_SYS_USE_PKG_CONFIG=1
./x.py build
```

> **Side note (BLFS):** The test suite will generate some messages in the systemd journal for traps on invalid opcodes, and for segmentation faults. In themselves these are nothing to worry about, and they are just a way for a test to be terminated.

**[BUILDER]** — *(Optional — skip if unsure)* If running the test suite, fake a Git executable to allow running the test suite without Git-2.55.0 installed (we are building from a release tarball instead of Git repository here so Git will not be really useful even if it's installed):

```bash
mkdir fake-git && ln -sv /usr/bin/false fake-git/git
```

**[BUILDER]** — *(Optional — skip if unsure)* To run the tests, issue:

```bash
PATH+=:$PWD/fake-git \
./x.py test --no-fail-fast | tee rustc-testlog
```

**[BUILDER]** — Therefore, you should determine the number of failures. The number of tests which passed and failed can be found by running:

```bash
grep '^test result:' rustc-testlog |
 awk '{sum1 += $4; sum2 += $6} END { print sum1 " passed; " sum2 " failed" }'
```

> **Side note (BLFS):** If sudo or su is invoked for switching to the root user, ensure LIBSSH2_SYS_USE_PKG_CONFIG and LIBSQLITE3_SYS_USE_PKG_CONFIG are correctly passed or the following command may rebuild cargo with shipped copies of libssh2 and sqlite. For sudo, use the --preserve-env=LIB{SSH2,SQLITE3}_SYS_USE_PKG_CONFIG option. For su, do not use the - or --login options.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user, install the package:

```bash
./x.py install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Still as the root user, fix the installation of the documentation, symlink a Zsh completion file into the correct location, and move a Bash completion file into the location recommended by the Bash completion maintainers:

```bash
rm -fv /opt/rustc-1.97.1/share/doc/rustc-1.97.1/*.old   &&
install -vm644 README.md                                \
               /opt/rustc-1.97.1/share/doc/rustc-1.97.1 &&

install -vdm755 /usr/share/zsh/site-functions      &&
ln -sfv /opt/rustc/share/zsh/site-functions/_cargo \
        /usr/share/zsh/site-functions

mv -v /etc/bash_completion.d/cargo /usr/share/bash-completion/completions
```

**[BUILDER]** — Finally, unset the exported environment variables:

```bash
unset LIB{SSH2,SQLITE3}_SYS_USE_PKG_CONFIG
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, create the /etc/profile.d/rustc.sh file:

```bash
cat > /etc/profile.d/rustc.sh << "EOF"
# Begin /etc/profile.d/rustc.sh

pathprepend /opt/rustc/bin           PATH

# End /etc/profile.d/rustc.sh
EOF
```

**[BUILDER]** — Immediately after installation, update the current PATH for your current shell as a normal user:

```bash
source /etc/profile.d/rustc.sh
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf rustc-1.97.1-src.tar.xz | head -1 | cut -d/ -f1)"
```


### Git-2.55.0

*BLFS 13.1 · ID `git` · Stage A* · *Build time:* 0.4 SBU (add 2.0 SBU for tests (disk speed dependent) and 1.0 SBU for building docs (all with parallelism=4) · *Disk space:* 403 MB (with tests and downloaded documentation; add 22 MB for building docs)

**Recommended (included):** `curl`, `rust`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.kernel.org/pub/software/scm/git/git-2.55.0.tar.xz
wget https://www.kernel.org/pub/software/scm/git/git-manpages-2.55.0.tar.xz
wget https://www.kernel.org/pub/software/scm/git/git-htmldocs-2.55.0.tar.xz
```

MD5 sum of `git-2.55.0.tar.xz`: `758c02a1b621cc0868ee0a0d99573e6b` (check with `md5sum git-2.55.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf git-2.55.0.tar.xz
cd "$(tar -tf git-2.55.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Git by running the following commands:

```bash
./configure --prefix=/usr                   \
            --with-gitconfig=/etc/gitconfig \
            --with-python=python3           \
            --with-libpcre2                 &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed Asciidoc-10.2.1 you can create the html version of the man pages and other docs:

```bash
make html
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed Asciidoc-10.2.1 and xmlto-0.0.29 you can create the man pages:

```bash
make man
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make perllibdir=/usr/lib/perl5/5.44/site_perl install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the man pages as the root user:

```bash
make install-man
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the html docs as the root user:

```bash
make htmldir=/usr/share/doc/git-2.55.0 install-html
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you downloaded the man pages untar them as the root user:

```bash
tar -xf ../git-manpages-2.55.0.tar.xz \
    -C /usr/share/man --no-same-owner --no-overwrite-dir
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you downloaded the html docs untar them as the root user:

```bash
mkdir -vp   /usr/share/doc/git-2.55.0 &&
tar   -xf   ../git-htmldocs-2.55.0.tar.xz \
      -C    /usr/share/doc/git-2.55.0 --no-same-owner --no-overwrite-dir &&

find        /usr/share/doc/git-2.55.0 -type d -exec chmod 755 {} \; &&
find        /usr/share/doc/git-2.55.0 -type f -exec chmod 644 {} \;
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For both methods, the html-docs include a lot of plain text files. Reorganize the files as the root user:

```bash
mkdir -vp /usr/share/doc/git-2.55.0/man-pages/{html,text}         &&
mv        /usr/share/doc/git-2.55.0/{git*.adoc,man-pages/text}    &&
mv        /usr/share/doc/git-2.55.0/{git*.,index.,man-pages/}html &&

mkdir -vp /usr/share/doc/git-2.55.0/technical/{html,text}         &&
mv        /usr/share/doc/git-2.55.0/technical/{*.adoc,text}       &&
mv        /usr/share/doc/git-2.55.0/technical/{*.,}html           &&

mkdir -vp /usr/share/doc/git-2.55.0/howto/{html,text}             &&
mv        /usr/share/doc/git-2.55.0/howto/{*.adoc,text}           &&
mv        /usr/share/doc/git-2.55.0/howto/{*.,}html               &&

sed -i '/^<a href=/s|howto/|&html/|' /usr/share/doc/git-2.55.0/howto-index.html &&
sed -i '/^\* link:/s|howto/|&html/|' /usr/share/doc/git-2.55.0/howto-index.adoc
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf git-2.55.0.tar.xz | head -1 | cut -d/ -f1)"
```


### OpenSSH-10.5p1

*BLFS 13.1 · ID `openssh` · Stage A* · *Build time:* 0.3 SBU (Using parallelism=4; running the tests takes about 11 minutes, irrespective of processor speed) · *Disk space:* 103 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.openbsd.org/pub/OpenBSD/OpenSSH/portable/openssh-10.5p1.tar.gz
```

MD5 sum of `openssh-10.5p1.tar.gz`: `a95119f402dfa0166c9dd1237239085c` (check with `md5sum openssh-10.5p1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf openssh-10.5p1.tar.gz
cd "$(tar -tf openssh-10.5p1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — OpenSSH runs as two processes when connecting to other computers. The first process is a privileged process and controls the issuance of privileges as necessary. The second process communicates with the network. Additional installation steps are necessary…

```bash
install -v -g sys -m700 -d /var/lib/sshd &&

groupadd -g 50 sshd        &&
useradd  -c 'sshd PrivSep' \
         -d /var/lib/sshd  \
         -g sshd           \
         -s /bin/false     \
         -u 50 sshd
```

**[BUILDER]** — Install OpenSSH by running the following commands:

```bash
./configure --prefix=/usr                            \
            --sysconfdir=/etc/ssh                    \
            --with-privsep-path=/var/lib/sshd        \
            --with-default-path=/usr/bin             \
            --with-superuser-path=/usr/sbin:/usr/bin \
            --with-pid-dir=/run                      &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m755    contrib/ssh-copy-id /usr/bin     &&

install -v -m644    contrib/ssh-copy-id.1 \
                    /usr/share/man/man1              &&
install -v -m755 -d /usr/share/doc/openssh-10.5p1    &&
install -v -m644    INSTALL LICENCE OVERVIEW README* \
                    /usr/share/doc/openssh-10.5p1
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — There are no required changes to any of these files. However, you may wish to view the /etc/ssh/ files and make any changes appropriate for the security of your system. One recommended change is that you disable root login via ssh. Execute the following…

```bash
echo "PermitRootLogin no" >> /etc/ssh/sshd_config
```

**[BUILDER]** — *(Optional — skip if unsure)* If you want to be able to log in without typing in your password, first create ~/.ssh/id_rsa and ~/.ssh/id_rsa.pub with ssh-keygen and then copy ~/.ssh/id_rsa.pub to ~/.ssh/authorized_keys on the remote computer that you want to log into. You'll need to…

```bash
ssh-keygen &&
ssh-copy-id -i ~/.ssh/id_ed25519.pub REMOTE_USERNAME@REMOTE_HOSTNAME
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Once you've got passwordless logins working it's actually more secure than logging in with a password (as the private key is much longer than most people's passwords). If you would like to now disable password logins, as the root user:

```bash
echo "PasswordAuthentication no" >> /etc/ssh/sshd_config &&
echo "KbdInteractiveAuthentication no" >> /etc/ssh/sshd_config
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If you added Linux-PAM support and you want ssh to use it then you will need to add a configuration file for sshd and enable use of LinuxPAM. Note, ssh only uses PAM to check passwords, if you've disabled password logins these commands are not needed. If…

```bash
sed 's@d/login@d/sshd@g' /etc/pam.d/login > /etc/pam.d/sshd &&
chmod 644 /etc/pam.d/sshd &&
echo "UsePAM yes" >> /etc/ssh/sshd_config
```

> **Side note (BLFS):** Changing the setting of ListenAddress in /etc/sshd/sshd_config is unsupported with the BLFS sshd systemd unit.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To start the SSH server at system boot, install the sshd.service unit included in the BLFS Systemd Units package.

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-sshd
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf openssh-10.5p1.tar.gz | head -1 | cut -d/ -f1)"
```


### cpio-2.15

*BLFS 13.1 · ID `cpio` · Stage A* · *Build time:* 0.3 SBU (with tests and docs) · *Disk space:* 21 MB (with tests and docs)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.gnu.org/gnu/cpio/cpio-2.15.tar.bz2
```

MD5 sum of `cpio-2.15.tar.bz2`: `3394d444ca1905ea56c94b628b706a0b` (check with `md5sum cpio-2.15.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cpio-2.15.tar.bz2
cd "$(tar -tf cpio-2.15.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Add a workaround for an issue shown by gcc15:

```bash
sed -e "/^extern int (\*xstat)/s/()/(const char * restrict,  struct stat * restrict)/" \
    -i src/extern.h
sed -e "/^int (\*xstat)/s/()/(const char * restrict,  struct stat * restrict)/" \
    -i src/global.c
```

**[BUILDER]** — Install cpio by running the following commands:

```bash
./configure --prefix=/usr \
            --enable-mt   \
            --with-rmt=/usr/libexec/rmt &&
make &&
makeinfo --html            -o doc/html      doc/cpio.texi &&
makeinfo --html --no-split -o doc/cpio.html doc/cpio.texi &&
makeinfo --plaintext       -o doc/cpio.txt  doc/cpio.texi
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have texlive-20260301-source installed and wish to create PDF or Postscript documentation, issue one or both of the following commands:

```bash
make -C doc pdf &&
make -C doc ps
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m755 -d /usr/share/doc/cpio-2.15/html &&
install -v -m644    doc/html/* \
                    /usr/share/doc/cpio-2.15/html &&
install -v -m644    doc/cpio.{html,txt} \
                    /usr/share/doc/cpio-2.15
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built PDF or Postscript documentation, install it by issuing the following commands as the root user:

```bash
install -v -m644 doc/cpio.{pdf,ps,dvi} \
                 /usr/share/doc/cpio-2.15
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cpio-2.15.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Which-2.25 and Alternatives

*BLFS 13.1 · ID `which` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 1.3 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.gnu.org/gnu/which/which-2.25.tar.gz
```

MD5 sum of `which-2.25.tar.gz`: `60140cb2637634e4f4e68c2e98c6a07b` (check with `md5sum which-2.25.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf which-2.25.tar.gz
cd "$(tar -tf which-2.25.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install which by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The second option (for those who don't want to install the package) is to create a simple script (execute as the root user):

```bash
cat > /usr/bin/which << "EOF"
#!/bin/bash
type -pa "$@" | head -n 1 ; exit ${PIPESTATUS[0]}
EOF
chmod -v 755 /usr/bin/which
chown -v root:root /usr/bin/which
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf which-2.25.tar.gz | head -1 | cut -d/ -f1)"
```


### Nano-9.2

*BLFS 13.1 · ID `nano` · Stage A* · *Build time:* 0.2 SBU · *Disk space:* 30 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.nano-editor.org/dist/v9/nano-9.2.tar.xz
```

MD5 sum of `nano-9.2.tar.xz`: `9bb0f37945afa964d16bffd9e4da3106` (check with `md5sum nano-9.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf nano-9.2.tar.xz
cd "$(tar -tf nano-9.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Nano by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --enable-utf8     \
            --docdir=/usr/share/doc/nano-9.2 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m644 doc/{nano.html,sample.nanorc} /usr/share/doc/nano-9.2
```

**Configure:**

*Example only — don't run:* Example configuration (create as a system-wide /etc/nanorc or a personal ~/.nanorc file)

```text
set autoindent
set constantshow
set fill 72
set historylog
set multibuffer
set nohelp
set positionlog
set quickblank
set regexp
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf nano-9.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Zip-3.0

*BLFS 13.1 · ID `zip` · Stage A* · *Build time:* 0.1 SBU · *Disk space:* 6.4 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/infozip/zip30.tar.gz
```

MD5 sum of `zip30.tar.gz`: `7b74551e63f8ee6aab6fbc86676c0d37` (check with `md5sum zip30.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf zip30.tar.gz
cd "$(tar -tf zip30.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Zip by running the following commands:

```bash
make -f unix/Makefile generic CC="gcc -std=gnu89"
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make prefix=/usr MANDIR=/usr/share/man/man1 -f unix/Makefile install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf zip30.tar.gz | head -1 | cut -d/ -f1)"
```


### dosfstools-4.2

*BLFS 13.1 · ID `dosfstools` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 4.5 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/dosfstools/dosfstools/releases/download/v4.2/dosfstools-4.2.tar.gz
```

MD5 sum of `dosfstools-4.2.tar.gz`: `49c8e457327dc61efab5b115a27b087a` (check with `md5sum dosfstools-4.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf dosfstools-4.2.tar.gz
cd "$(tar -tf dosfstools-4.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install dosfstools by running the following commands:

```bash
./configure --prefix=/usr            \
            --enable-compat-symlinks \
            --mandir=/usr/share/man  \
            --docdir=/usr/share/doc/dosfstools-4.2 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf dosfstools-4.2.tar.gz | head -1 | cut -d/ -f1)"
```


### libaio-0.3.113

*BLFS 13.1 · ID `libaio` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 1.1 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget -O libaio-0.3.113.tar.gz https://deb.debian.org/debian/pool/main/liba/libaio/libaio_0.3.113.orig.tar.gz
```

MD5 sum of `libaio-0.3.113.tar.gz`: `7d5be185f20eeaae15e267419950aaf7` (check with `md5sum libaio-0.3.113.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libaio-0.3.113.tar.gz
cd "$(tar -tf libaio-0.3.113.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS download fix.** libaio's original download server is gone. The download command above uses Debian's copy of the same release; its MD5 matches the BLFS book exactly.

**Build and install:**

**[BUILDER]** — First, disable the installation of the static library:

```bash
sed -i '/install.*libaio.a/s/^/#/' src/Makefile
```

**[BUILDER]** — *(Optional — skip if unsure)* Next, fix an issue in the test suite:

```bash
case "$(uname -m)" in
  i?86) sed -e "s/off_t/off64_t/" -i harness/cases/23.t ;;
esac
```

**[BUILDER]** — Build libaio by running the following command:

```bash
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, install the package as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libaio-0.3.113.tar.gz | head -1 | cut -d/ -f1)"
```


### LVM2-2.03.42

*BLFS 13.1 · ID `lvm2` · Stage A* · *Build time:* 0.4 SBU (add 9 to 48 SBU for tests, depending on disk speed and options enabled in the kernel) · *Disk space:* 40 MB (add up to 300 MB for transient files for tests in the /tmp directory)

**Requires:** `libaio`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://sourceware.org/ftp/lvm2/LVM2.2.03.42.tgz
```

MD5 sum of `LVM2.2.03.42.tgz`: `1cfc17fcbdc5103492b4504c5ddaa274` (check with `md5sum LVM2.2.03.42.tgz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf LVM2.2.03.42.tgz
cd "$(tar -tf LVM2.2.03.42.tgz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install LVM2 by running the following commands:

```bash
PATH+=:/usr/sbin                \
./configure --prefix=/usr       \
            --enable-cmdlib     \
            --enable-pkgconfig  \
            --enable-udev_sync  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* The tests use udev for logical volume synchronization, so the LVM udev rules and some utilities need to be installed before running the tests. If you are installing LVM2 for the first time, and do not want to install the full package before running the…

```bash
make -C tools install_tools_dynamic &&
make -C udev  install               &&
make -C libdm install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* The tests need the ability to create and remove device nodes in the /tmp directory. On systemd systems, the default is to mount /tmp with the nodev option. Rather than disabling this behavior permanently (since it does have valid security reasons to be…

```bash
mount -o remount,dev /tmp
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* To test the results, issue, as the root user:

```bash
LC_ALL=en_US.UTF-8 make check_local
```

**[BUILDER]** — *(Optional — skip if unsure)* The tests do not implement the expected fail possibility and some test failures are expected by upstream. Most tests will fail if the kernel does not have all the device drivers listed above. More failures may happen because some kernel options are…

```bash
     --with-thin-check=    \
     --with-thin-dump=     \
     --with-thin-repair=   \
     --with-thin-restore=  \
     --with-cache-check=   \
     --with-cache-dump=    \
     --with-cache-repair=  \
     --with-cache-restore= \
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
make install_systemd_units
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The default configuration still references the obsolete /var/lock directory. This creates a deadlock at boot time. Change this (as the root user):

```bash
sed -e '/locking_dir =/{s/#//;s/var/run/}' \
    -i /etc/lvm/lvm.conf
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf LVM2.2.03.42.tgz | head -1 | cut -d/ -f1)"
```


### parted-3.7

*BLFS 13.1 · ID `parted` · Stage A* · *Build time:* 0.3 SBU (additional 3.6 SBU for the tests) · *Disk space:* 35 MB (additional 3 MB for the tests and additional 2 MB for optional PDF and Postscript documentation)

**Recommended (included):** `lvm2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.gnu.org/gnu/parted/parted-3.7.tar.xz
```

MD5 sum of `parted-3.7.tar.xz`: `b56ec0cf7bc89d61da1585f88fc8ef5e` (check with `md5sum parted-3.7.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf parted-3.7.tar.xz
cd "$(tar -tf parted-3.7.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Parted by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make &&

make -C doc html                                       &&
makeinfo --html      -o doc/html       doc/parted.texi &&
makeinfo --plaintext -o doc/parted.txt doc/parted.texi
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have texlive-20260301-source installed and wish to create PDF and Postscript documentation issue the following commands:

```bash
cp build-aux/texinfo.tex doc               &&
texi2pdf -o doc/parted.pdf doc/parted.texi &&
texi2dvi -o doc/parted.dvi doc/parted.texi &&
dvips    -o doc/parted.ps  doc/parted.dvi
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* To test the results, issue, as the root user:

```bash
make check
```

> **Side note (BLFS):** Many tests are skipped if not run as the root user.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m755 -d /usr/share/doc/parted-3.7/html &&
install -v -m644    doc/html/* \
                    /usr/share/doc/parted-3.7/html &&
install -v -m644    doc/{FAT,API.md,parted.{txt,html}} \
                    /usr/share/doc/parted-3.7
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the optional PDF and Postscript documentation by issuing the following command as the root user:

```bash
install -v -m644 doc/FAT doc/API doc/parted.{pdf,ps,dvi} \
                    /usr/share/doc/parted-3.7
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf parted-3.7.tar.xz | head -1 | cut -d/ -f1)"
```


### efivar-39

*BLFS 13.1 · ID `efivar` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 21 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/rhboot/efivar/archive/39/efivar-39.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/efivar-39-upstream_fixes-1.patch
```

MD5 sum of `efivar-39.tar.gz`: `a8fc3e79336cd6e738ab44f9bc96a5aa` (check with `md5sum efivar-39.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf efivar-39.tar.gz
cd "$(tar -tf efivar-39.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package cannot function properly on a 32-bit system with a 64-bit UEFI implementation. Don't install this package (or efibootmgr) on 32-bit system unless you are absolutely sure you have a 32-bit UEFI implementation, which is very rare in practice.

**[BUILDER]** — First, apply a patch to make this package compatible with glibc-2.43 and later:

```bash
patch -Np1 -i ../efivar-39-upstream_fixes-1.patch
```

**[BUILDER]** — Build efivar with the following commands:

```bash
make ENABLE_DOCS=0
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install ENABLE_DOCS=0 LIBDIR=/usr/lib
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To avoid a hard dependency on mandoc we used ENABLE_DOCS=0, but it causes all the man pages skipped from the installation even though most of them actually do not need mandoc. Still as the root user, install these man pages:

```bash
install -vm644 docs/efivar.1 /usr/share/man/man1 &&
install -vm644 docs/*.3      /usr/share/man/man3
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf efivar-39.tar.gz | head -1 | cut -d/ -f1)"
```


### Popt-1.19

*BLFS 13.1 · ID `popt` · Stage A* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 6.9 MB (includes installing documentation and tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.osuosl.org/pub/rpm/popt/releases/popt-1.x/popt-1.19.tar.gz
```

MD5 sum of `popt-1.19.tar.gz`: `eaa2135fddb6eb03f2c87ee1823e5a78` (check with `md5sum popt-1.19.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf popt-1.19.tar.gz
cd "$(tar -tf popt-1.19.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install popt by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Doxygen-1.18.0 installed and wish to build the API documentation, issue:

```bash
sed -i 's@\./@src/@' Doxyfile &&
doxygen
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the API documentation, install it using the following commands issued by the root user:

```bash
install -v -m755 -d /usr/share/doc/popt-1.19 &&
install -v -m644 doxygen/html/* /usr/share/doc/popt-1.19
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf popt-1.19.tar.gz | head -1 | cut -d/ -f1)"
```


### efibootmgr-18

*BLFS 13.1 · ID `efibootmgr` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 1.1 MB

**Requires:** `efivar`, `popt`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/rhboot/efibootmgr/archive/18/efibootmgr-18.tar.gz
```

MD5 sum of `efibootmgr-18.tar.gz`: `e170147da25e1d5f72721ffc46fe4e06` (check with `md5sum efibootmgr-18.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf efibootmgr-18.tar.gz
cd "$(tar -tf efibootmgr-18.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build efibootmgr with the following commands:

```bash
make EFIDIR=LFS EFI_LOADER=grubx64.efi
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install EFIDIR=LFS
```

**Using efibootmgr:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — In order for efibootmgr to work, the EFI variable file system must be mounted beforehand. If you're still in a chroot and haven't rebooted, mount it as the root user:

```bash
mountpoint /sys/firmware/efi/efivars ||
  mount -v -t efivarfs efivarfs /sys/firmware/efi/efivars
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf efibootmgr-18.tar.gz | head -1 | cut -d/ -f1)"
```


### pciutils-3.15.0

*BLFS 13.1 · ID `pciutils` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 5.4 MB

**Needed at runtime:** `hwdata`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://mj.ucw.cz/download/linux/pci/pciutils-3.15.0.tar.gz
```

MD5 sum of `pciutils-3.15.0.tar.gz`: `20b8e936cce9784444961088c8801f68` (check with `md5sum pciutils-3.15.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pciutils-3.15.0.tar.gz
cd "$(tar -tf pciutils-3.15.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Prevent the installation of the pci.ids file to avoid a conflict with the hwdata-0.410 package:

```bash
sed -r '/INSTALL/{/PCI_IDS|update-pciids /d; s/update-pciids.8//}' \
    -i Makefile
```

**[BUILDER]** — Install PCI Utils by running the following commands:

```bash
make PREFIX=/usr                \
     SHAREDIR=/usr/share/hwdata \
     SHARED=yes
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make PREFIX=/usr                \
     SHAREDIR=/usr/share/hwdata \
     SHARED=yes                 \
     install install-lib        &&

chmod -v 755 /usr/lib/libpci.so
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pciutils-3.15.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libusb-1.0.30

*BLFS 13.1 · ID `libusb` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 7.8 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libusb/libusb/releases/download/v1.0.30/libusb-1.0.30.tar.bz2
```

MD5 sum of `libusb-1.0.30.tar.bz2`: `b0b0bacc2c6919515db8e863f0517db8` (check with `md5sum libusb-1.0.30.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libusb-1.0.30.tar.bz2
cd "$(tar -tf libusb-1.0.30.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libusb by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If Doxygen is installed and you wish to build the API documentation, issue the following commands:

```bash
pushd doc                &&
  doxygen -u doxygen.cfg &&
  make docs              &&
popd
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the API documentation, install it using the following commands as the root user:

```bash
install -v -d -m755 /usr/share/doc/libusb-1.0.30/apidocs &&
install -v -m644    doc/api-1.0/* \
                    /usr/share/doc/libusb-1.0.30/apidocs
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libusb-1.0.30.tar.bz2 | head -1 | cut -d/ -f1)"
```


### usbutils-019

*BLFS 13.1 · ID `usbutils` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 1.9 MB

**Requires:** `libusb`  
**Needed at runtime:** `hwdata`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://kernel.org/pub/linux/utils/usb/usbutils/usbutils-019.tar.xz
```

MD5 sum of `usbutils-019.tar.xz`: `67a8eb4782540058d0648f83ecabdf6c` (check with `md5sum usbutils-019.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf usbutils-019.tar.xz
cd "$(tar -tf usbutils-019.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install USB Utils by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release &&

ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf usbutils-019.tar.xz | head -1 | cut -d/ -f1)"
```


### rsync-3.5.0

*BLFS 13.1 · ID `rsync` · Stage A* · *Build time:* 0.6 SBU (with tests) · *Disk space:* 80 MB (with tests and documentation)

**Recommended (included):** `popt`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.samba.org/ftp/rsync/src/rsync-3.5.0.tar.gz
```

MD5 sum of `rsync-3.5.0.tar.gz`: `418db7651d1acf55364b0834234dbbfb` (check with `md5sum rsync-3.5.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf rsync-3.5.0.tar.gz
cd "$(tar -tf rsync-3.5.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For security reasons, running the rsync server as an unprivileged user and group is encouraged. If you intend to run rsync as a daemon, create the rsyncd user and group with the following commands issued by the root user:

```bash
groupadd -g 48 rsyncd &&
useradd -c "rsyncd Daemon" -m -d /home/rsync -g rsyncd \
    -s /bin/false -u 48 rsyncd
```

**[BUILDER]** — Install rsync by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-xxhash \
            --without-included-zlib &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Doxygen-1.18.0 installed and wish to build HTML API documentation, issue:

```bash
doxygen
```

**[BUILDER]** — *(Optional — skip if unsure)* To run the tests, issue:

```bash
make check
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the documentation, install it using the following commands as the root user:

```bash
install -v -m755 -d          /usr/share/doc/rsync-3.5.0/api &&
install -v -m644 dox/html/*  /usr/share/doc/rsync-3.5.0/api
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — This is a simple download-only configuration to set up running rsync as a server. See the rsyncd.conf(5) man-page for additional options (i.e., user authentication).

```bash
cat > /etc/rsyncd.conf << "EOF"
# This is a basic rsync configuration file
# It exports a single module without user authentication.

motd file = /home/rsync/welcome.msg
use chroot = yes

[localhost]
    path = /home/rsync
    comment = Default rsync module
    read only = yes
    list = yes
    uid = rsyncd
    gid = rsyncd

EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the rsyncd.service unit included in the BLFS Systemd Units package.

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-rsyncd
```

> **Side note (BLFS):** This package comes with two types of units: A service file and a socket file. The service file will start rsync daemon once at boot and it will keep running until the system shuts down. The socket file will make systemd listen on rsync port (Default 873, needs to be edited for anything else) and will start rsync daemon when something tries to connect to that port and stop the daemon when the connection is terminated. This is called socket activation and is analogous to using {,x}inetd on a SysVinit based system. By default, the first method is used - rsync daemon is started at boot and stopped at shutdown. If the socket method is desired, you need to run as the root user: Note that socket method is only useful for remote backups. For local backups you'll need the service method.

**[BUILDER]** — *(Optional — skip if unsure)* This package comes with two types of units: A service file and a socket file. The service file will start rsync daemon once at boot and it will keep running until the system shuts down. The socket file will make systemd listen on rsync port (Default 873,…

```bash
systemctl stop rsyncd &&
systemctl disable rsyncd &&
systemctl enable rsyncd.socket &&
systemctl start rsyncd.socket
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf rsync-3.5.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libtirpc-1.3.7

*BLFS 13.1 · ID `libtirpc` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 6.8 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/libtirpc/libtirpc-1.3.7.tar.bz2
```

MD5 sum of `libtirpc-1.3.7.tar.bz2`: `74f97df306b8d6149d3d9898a1d44c6e` (check with `md5sum libtirpc-1.3.7.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libtirpc-1.3.7.tar.bz2
cd "$(tar -tf libtirpc-1.3.7.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** If updating this package, you will also need to update any existing version of rpcbind-1.2.9

**[BUILDER]** — Install libtirpc by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --disable-static  \
            --disable-gssapi  &&

make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libtirpc-1.3.7.tar.bz2 | head -1 | cut -d/ -f1)"
```


### lsof-4.99.7

*BLFS 13.1 · ID `lsof` · Stage A* · *Build time:* 0.6 SBU (with tests) · *Disk space:* 14 MB (with tests)

**Requires:** `libtirpc`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/lsof-org/lsof/releases/download/4.99.7/lsof-4.99.7.tar.gz
```

MD5 sum of `lsof-4.99.7.tar.gz`: `46647a774bb8ba630eb738c3aa1b5275` (check with `md5sum lsof-4.99.7.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lsof-4.99.7.tar.gz
cd "$(tar -tf lsof-4.99.7.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install lsof by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* The tests should be run as the root user. They require that the POSIX message queues are enabled in the kernel, and that Nmap-7.991 be installed with a symbolic link /usr/bin/nc pointing to ncat.

```bash
make check
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lsof-4.99.7.tar.gz | head -1 | cut -d/ -f1)"
```


### duktape-2.7.0

*BLFS 13.1 · ID `duktape` · Stage A* · *Build time:* 0.3 SBU · *Disk space:* 25 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://duktape.org/duktape-2.7.0.tar.xz
```

MD5 sum of `duktape-2.7.0.tar.xz`: `b3200b02ab80125b694bae887d7c1ca6` (check with `md5sum duktape-2.7.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf duktape-2.7.0.tar.xz
cd "$(tar -tf duktape-2.7.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install duktape by running the following commands:

```bash
sed -i 's/-Os/-O2/' Makefile.sharedlibrary
make -f Makefile.sharedlibrary INSTALL_PREFIX=/usr
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make -f Makefile.sharedlibrary INSTALL_PREFIX=/usr install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf duktape-2.7.0.tar.xz | head -1 | cut -d/ -f1)"
```


### docutils-0.23

*BLFS 13.1 · ID `docutils` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 15 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/d/docutils/docutils-0.23.tar.gz
```

MD5 sum of `docutils-0.23.tar.gz`: `39d10acfd1fc81b87f5de84418b88be9` (check with `md5sum docutils-0.23.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf docutils-0.23.tar.gz
cd "$(tar -tf docutils-0.23.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — First, remove some files installed in a previous version that are no longer valid. As the root user:

```bash
for f in /usr/bin/rst*.py; do
  rm -fv /usr/bin/$(basename $f .py)
done
```

**[BUILDER]** — To build the Python 3 applications, run the following command:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To install the Python applications run the following as the root user:

```bash
pip3 install --no-index --find-links dist --no-user docutils
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf docutils-0.23.tar.gz | head -1 | cut -d/ -f1)"
```


### libxslt-1.1.45

*BLFS 13.1 · ID `libxslt` · Stage A* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 33 MB (with tests)

**Requires:** `libxml2`  
**Needed at runtime:** `DocBook`, `docbook-xsl`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libxslt/1.1/libxslt-1.1.45.tar.xz
```

MD5 sum of `libxslt-1.1.45.tar.xz`: `84bb3f6ba7f5ee98af5dcd72e828c73e` (check with `md5sum libxslt-1.1.45.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxslt-1.1.45.tar.xz
cd "$(tar -tf libxslt-1.1.45.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxslt by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --without-python \
            --docdir=/usr/share/doc/libxslt-1.1.45 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxslt-1.1.45.tar.xz | head -1 | cut -d/ -f1)"
```


### GLib-2.88.3

*BLFS 13.1 · ID `glib2` · Stage A* · *Build time:* 0.7 SBU (add 0.5 SBU for tests; both using parallelism=4) · *Disk space:* 430 MB (with tests and documentation)

**Recommended (included):** `docutils`, `libxslt`  
**Needed at runtime:** `shared-mime-info`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/glib/2.88/glib-2.88.3.tar.xz
wget https://download.gnome.org/sources/gobject-introspection/1.86/gobject-introspection-1.86.0.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/glib-skip_warnings-1.patch
```

MD5 sum of `glib-2.88.3.tar.xz`: `b61c04cfbf55b0d24fbe64e4ac9e9d56` (check with `md5sum glib-2.88.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glib-2.88.3.tar.xz
cd "$(tar -tf glib-2.88.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — For instance export GLIB_LOG_LEVEL=4 will skip output of Warning and Notice messages (and Info/Debug messages if they are turned on). If GLIB_LOG_LEVEL is not defined, normal message output will not be affected.

```bash
patch -Np1 -i ../glib-skip_warnings-1.patch
```

> **Warning (BLFS):** If a previous version of glib is installed, move the headers out of the way so that later packages do not encounter conflicts:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If a previous version of glib is installed, move the headers out of the way so that later packages do not encounter conflicts:

```bash
if [ -e /usr/include/glib-2.0 ]; then
    rm -rf /usr/include/glib-2.0.old &&
    mv -vf /usr/include/glib-2.0{,.old}
fi
```

**[BUILDER]** — Install GLib by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                  \
      --prefix=/usr             \
      --buildtype=release       \
      -D introspection=disabled \
      -D glib_debug=disabled    \
      -D man-pages=enabled      \
      -D sysprof=disabled       &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, install this package for the first time to allow building GObject Introspection:

```bash
ninja install
```

**[BUILDER]** — Build GObject Introspection:

```bash
tar xf ../../gobject-introspection-1.86.0.tar.xz &&

meson setup gobject-introspection-1.86.0 gi-build \
            --prefix=/usr --buildtype=release     &&
ninja -C gi-build
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, install GObject Introspection for generating the introspection data of GLib libraries (required by various packages using Glib, especially some GNOME packages):

```bash
ninja -C gi-build install
```

**[BUILDER]** — Now generate the introspection data:

```bash
meson configure -D introspection=enabled &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed "/docs_dir =/s|$| / 'glib-' + meson.project_version()|" \
    -i ../docs/reference/meson.build                        &&
meson configure -D documentation=true                       &&
ninja
```

> **Warning (BLFS):** Do not run the test suite as root or some tests will fail unexpectedly and leave some non-FHS-compliant directories in the /usr hierarchy.

> **Side note (BLFS):** If the GLIB_LOG_LEVEL environment variable is set, unset it before running the tests. Also one file that was created in the first install instruction above needs to be writable. As the root user, run chmod a+rw .ninja_log.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user, install this package again for the introspection data (and optionally, the documentation):

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glib-2.88.3.tar.xz | head -1 | cut -d/ -f1)"
```


### Polkit-127

*BLFS 13.1 · ID `polkit` · Stage A* · *Build time:* 0.3 SBU (with tests; using parallelism=4) · *Disk space:* 7.8 MB (with tests)

**Requires:** `duktape`, `glib2`  
**Recommended (included):** `libxslt`, `linux-pam`  
**Needed at runtime:** `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/polkit-org/polkit/archive/127/polkit-127.tar.gz
```

MD5 sum of `polkit-127.tar.gz`: `2cc95f1b02fc1de6c9e52db986642ec4` (check with `md5sum polkit-127.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf polkit-127.tar.gz
cd "$(tar -tf polkit-127.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS change.** Manual pages and tests are switched off: the man pages need extra documentation tools, and the tests can't run in the chroot.

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — There should be a dedicated user and group to take control of the polkitd daemon after it is started. Issue the following commands as the root user:

```bash
groupadd -fg 27 polkitd &&
useradd -c "PolicyKit Daemon Owner" -d /etc/polkit-1 -u 27 \
        -g polkitd -s /bin/false polkitd
```

**[BUILDER]** — Install Polkit by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                   \
      --prefix=/usr              \
      --buildtype=release        \
      -D man=false               \
      -D session_tracking=logind \
      -D tests=false
```

**[BUILDER]** — Build the package:

```bash
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf polkit-127.tar.gz | head -1 | cut -d/ -f1)"
```


### docbook-xml-4.5

*BLFS 13.1 · ID `DocBook` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 1.2 MB

**Requires:** `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.docbook.org/xml/4.5/docbook-xml-4.5.zip
```

MD5 sum of `docbook-xml-4.5.zip`: `03083e288e87a7e829e437358da7ef9e` (check with `md5sum docbook-xml-4.5.zip`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf docbook-xml-4.5.zip
cd "$(tar -tf docbook-xml-4.5.zip | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** The package source is distributed in zip format and you can use the python3 -m zipfile -e <name>.zip <name> command to extract it. The last parameter, <name>, ensures to extract the content of the zip archive into the directory named <name> (it will be automatically created if it does not exist yet), so after the package has been installed the removal of the source files will be easier.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install DocBook XML DTD by running the following commands as the root user:

```bash
install -v -d -m755 /usr/share/xml/docbook/xml-dtd-4.5 &&
install -v -d -m755 /etc/xml                           &&
cp -v -af --no-preserve=ownership                      \
    catalog.xml docbook.cat *.dtd ent/ *.mod           \
    /usr/share/xml/docbook/xml-dtd-4.5
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The shipped catalog.xml file handles the formal public identifiers of the DocBook-4.5 XML DTD. We need add some entries into its installation to handle the URLs of the DTD as well, by running the following commands as the root user:

```bash
xmlcatalog --noout --add "rewriteSystem"        \
    "http://www.oasis-open.org/docbook/xml/4.5" \
    "file:///usr/share/xml/docbook/xml-dtd-4.5" \
    /usr/share/xml/docbook/xml-dtd-4.5/catalog.xml &&

xmlcatalog --noout --add "rewriteURI"           \
    "http://www.oasis-open.org/docbook/xml/4.5" \
    "file:///usr/share/xml/docbook/xml-dtd-4.5" \
    /usr/share/xml/docbook/xml-dtd-4.5/catalog.xml
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Create (or update) and populate the /etc/xml/catalog catalog file by running the following commands as the root user:

```bash
if [ ! -e /etc/xml/catalog ]; then
    xmlcatalog --noout --create /etc/xml/catalog
fi &&

xmlcatalog --noout --add "delegatePublic"                   \
    "-//OASIS//ENTITIES DocBook XML"                        \
    "file:///usr/share/xml/docbook/xml-dtd-4.5/catalog.xml" \
    /etc/xml/catalog                                        &&

xmlcatalog --noout --add "delegatePublic"                   \
    "-//OASIS//DTD DocBook XML"                             \
    "file:///usr/share/xml/docbook/xml-dtd-4.5/catalog.xml" \
    /etc/xml/catalog                                        &&

xmlcatalog --noout --add "delegateSystem"                   \
    "http://www.oasis-open.org/docbook/"                    \
    "file:///usr/share/xml/docbook/xml-dtd-4.5/catalog.xml" \
    /etc/xml/catalog                                        &&

xmlcatalog --noout --add "delegateURI"                      \
    "http://www.oasis-open.org/docbook/"                    \
    "file:///usr/share/xml/docbook/xml-dtd-4.5/catalog.xml" \
    /etc/xml/catalog
```

**Configure:**

> **Warning (BLFS):** Various BLFS packages request DocBook XML DTD version 4.x before V4.5, so the following step must be done for those packages to be built successfully.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The above installation creates the files and updates the catalogs. In order to utilize DocBook XML DTD V4.5 when any version 4.x is requested in the System Identifier, you need to add additional statements to the catalog files. If you have any of the…

```bash
for DTDVERSION in 4.1.2 4.2 4.3 4.4
do
  xmlcatalog --noout --add "public"                                  \
    "-//OASIS//DTD DocBook XML V$DTDVERSION//EN"                     \
    "http://www.oasis-open.org/docbook/xml/$DTDVERSION/docbookx.dtd" \
    /usr/share/xml/docbook/xml-dtd-4.5/catalog.xml

  xmlcatalog --noout --add "rewriteSystem"              \
    "http://www.oasis-open.org/docbook/xml/$DTDVERSION" \
    "file:///usr/share/xml/docbook/xml-dtd-4.5"         \
    /usr/share/xml/docbook/xml-dtd-4.5/catalog.xml
  
  xmlcatalog --noout --add "rewriteURI"                 \
    "http://www.oasis-open.org/docbook/xml/$DTDVERSION" \
    "file:///usr/share/xml/docbook/xml-dtd-4.5"         \
    /usr/share/xml/docbook/xml-dtd-4.5/catalog.xml
done
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf docbook-xml-4.5.zip | head -1 | cut -d/ -f1)"
```


### CrackLib-2.10.3

*BLFS 13.1 · ID `cracklib` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 5.0 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/cracklib/cracklib/releases/download/v2.10.3/cracklib-2.10.3.tar.xz
wget https://github.com/cracklib/cracklib/releases/download/v2.10.3/cracklib-words-2.10.3.xz
```

MD5 sum of `cracklib-2.10.3.tar.xz`: `e8ea2b86de774fc09fdd0f2829680b19` (check with `md5sum cracklib-2.10.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cracklib-2.10.3.tar.xz
cd "$(tar -tf cracklib-2.10.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS change.** BLFS adds `$(hostname)` to the extra-words list. Inside the WSL chroot that would be your Windows PC's name, so this guide adds `iprps`, the system's hostname.

**Build and install:**

**[BUILDER]** — Install CrackLib by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --with-default-dict=/usr/lib/cracklib/pw_dict &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Issue the following commands as the root user to install the recommended word list and create the CrackLib dictionary. Other word lists (text based, one word per line) can also be used by simply installing them into /usr/share/dict and adding them to the…

```bash
xzcat ../cracklib-words-2.10.3.xz \
                       > /usr/share/dict/cracklib-words       &&
ln -v -sf cracklib-words /usr/share/dict/words                &&
echo iprps >>           /usr/share/dict/cracklib-extra-words &&
install -v -m755 -d      /usr/lib/cracklib                    &&

create-cracklib-dict     /usr/share/dict/cracklib-words \
                         /usr/share/dict/cracklib-extra-words
```

**[BUILDER]** — *(Optional — skip if unsure)* If desired, check the proper operation of the library as an unprivileged user by issuing the following command:

```bash
make test
```

**[BUILDER]** — *(Optional — skip if unsure)* If desired, test the Python module with:

```bash
python3 -c 'import cracklib; cracklib.test()'
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cracklib-2.10.3.tar.xz | head -1 | cut -d/ -f1)"
```


### docbook-xsl-nons-1.79.2

*BLFS 13.1 · ID `docbook-xsl` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 58 MB (includes installing optional documentation)

**Needed at runtime:** `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/docbook/xslt10-stylesheets/releases/download/release/1.79.2/docbook-xsl-nons-1.79.2.tar.bz2
wget https://www.linuxfromscratch.org/patches/blfs/13.1/docbook-xsl-nons-1.79.2-stack_fix-1.patch
wget https://github.com/docbook/xslt10-stylesheets/releases/download/release/1.79.2/docbook-xsl-doc-1.79.2.tar.bz2
```

MD5 sum of `docbook-xsl-nons-1.79.2.tar.bz2`: `2666d1488d6ced1551d15f31d7ed8c38` (check with `md5sum docbook-xsl-nons-1.79.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf docbook-xsl-nons-1.79.2.tar.bz2
cd "$(tar -tf docbook-xsl-nons-1.79.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a problem that causes stack overflows when doing recursion:

```bash
patch -Np1 -i ../docbook-xsl-nons-1.79.2-stack_fix-1.patch
```

**[BUILDER]** — *(Optional — skip if unsure)* If you downloaded the optional documentation tarball, unpack it with the following command:

```bash
tar -xf ../docbook-xsl-doc-1.79.2.tar.bz2 --strip-components=1
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install DocBook XSL Stylesheets by running the following commands as the root user:

```bash
install -v -m755 -d /usr/share/xml/docbook/xsl-stylesheets-nons-1.79.2 &&

cp -v -R VERSION assembly common eclipse epub epub3 extensions fo        \
         highlighting html htmlhelp images javahelp lib manpages params  \
         profiling roundtrip slides template tests tools webhelp website \
         xhtml xhtml-1_1 xhtml5                                          \
    /usr/share/xml/docbook/xsl-stylesheets-nons-1.79.2 &&

ln -svf VERSION /usr/share/xml/docbook/xsl-stylesheets-nons-1.79.2/VERSION.xsl &&

install -v -m644 -D README \
                    /usr/share/doc/docbook-xsl-nons-1.79.2/README.txt &&

install -v -m644    RELEASE-NOTES* NEWS* \
                    /usr/share/doc/docbook-xsl-nons-1.79.2
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you downloaded the optional documentation tarball, install the documentation by issuing the following command as the root user:

```bash
cp -v -R doc/* /usr/share/doc/docbook-xsl-nons-1.79.2
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Create (or append) and populate the XML catalog file using the following commands as the root user (both http and https forms are used because upstream have had both in their documentation):

```bash
(set -e

 install -v -d -m755 /etc/xml
 [ -e /etc/xml/catalog ] || xmlcatalog --noout --create /etc/xml/catalog

 for uri in http{,s}://cdn.docbook.org/release/xsl-nons/{1.79.2,current} \
            http://docbook.sourceforge.net/release/xsl/current; do
   for rewrite in System URI; do
     xmlcatalog --noout --add "rewrite$rewrite"             \
       "$uri"                                               \
       "/usr/share/xml/docbook/xsl-stylesheets-nons-1.79.2" \
       /etc/xml/catalog
   done
 done)
```

**[BUILDER]** — *(Optional — skip if unsure)* Occasionally, you may find the need to install other versions of the XSL stylesheets as some projects reference a specific version. One example is BLFS-6.0, which required the 1.67.2 version. In these instances you should install any other required version…

```bash
xmlcatalog --noout --add "rewriteSystem"                          \
           "http://docbook.sourceforge.net/release/xsl/<version>" \
           "/usr/share/xml/docbook/xsl-stylesheets-<version>"     \
           /etc/xml/catalog &&

xmlcatalog --noout --add "rewriteURI"                             \
           "http://docbook.sourceforge.net/release/xsl/<version>" \
           "/usr/share/xml/docbook/xsl-stylesheets-<version>"     \
           /etc/xml/catalog
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf docbook-xsl-nons-1.79.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### hwdata-0.410

*BLFS 13.1 · ID `hwdata` · Stage A* · *Build time:* less than 0.1 SBU · *Disk space:* 21 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/vcrhonek/hwdata/archive/v0.410/hwdata-0.410.tar.gz
```

MD5 sum of `hwdata-0.410.tar.gz`: `07f1de937ff5b830280f6157221164eb` (check with `md5sum hwdata-0.410.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf hwdata-0.410.tar.gz
cd "$(tar -tf hwdata-0.410.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install hwdata by running the following commands:

```bash
./configure --prefix=/usr --disable-blacklist
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf hwdata-0.410.tar.gz | head -1 | cut -d/ -f1)"
```


### libpwquality-1.4.5

*BLFS 13.1 · ID `libpwquality` · Stage A* · *Build time:* 0.1 SBU · *Disk space:* 5.4 MB

**Requires:** `cracklib`  
**Recommended (included):** `linux-pam`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libpwquality/libpwquality/releases/download/libpwquality-1.4.5/libpwquality-1.4.5.tar.bz2
```

MD5 sum of `libpwquality-1.4.5.tar.bz2`: `6b70e355269aef0b9ddb2b9d17936f21` (check with `md5sum libpwquality-1.4.5.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libpwquality-1.4.5.tar.bz2
cd "$(tar -tf libpwquality-1.4.5.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libpwquality by running the following commands:

```bash
./configure --prefix=/usr                      \
            --disable-static                   \
            --with-securedir=/usr/lib/security \
            --disable-python-bindings          &&
make &&
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD/python
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
pip3 install --no-index --find-links dist --no-user pwquality
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — libpwquality is intended to be a functional replacement for the now-obsolete pam_cracklib.so PAM module. To configure the system to use the pam_pwquality module, execute the following commands as the root user:

```bash
mv /etc/pam.d/system-password{,.orig} &&
cat > /etc/pam.d/system-password << "EOF"
# Begin /etc/pam.d/system-password

# check new passwords for strength (man pam_pwquality)
password  required    pam_pwquality.so   authtok_type=UNIX retry=1 difok=1 \
                                         minlen=8 dcredit=0 ucredit=0      \
                                         lcredit=0 ocredit=0 minclass=1    \
                                         maxrepeat=0 maxsequence=0         \
                                         maxclassrepeat=0 gecoscheck=0     \
                                         dictcheck=1 usercheck=1           \
                                         enforcing=1 badwords=""           \
                                         dictpath=/usr/lib/cracklib/pw_dict

# use yescrypt hash for encryption, use shadow, and try to use any
# previously defined authentication token (chosen password) set by any
# prior module.
password  required    pam_unix.so        yescrypt shadow try_first_pass

# End /etc/pam.d/system-password
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libpwquality-1.4.5.tar.bz2 | head -1 | cut -d/ -f1)"
```


### shared-mime-info-2.5.1

*BLFS 13.1 · ID `shared-mime-info` · Stage A* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 32 MB (with tests)

**Requires:** `glib2`, `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/xdg/shared-mime-info/-/archive/2.5.1/shared-mime-info-2.5.1.tar.gz
```

MD5 sum of `shared-mime-info-2.5.1.tar.gz`: `5f8baa7bac254ea9e65782f754a2880b` (check with `md5sum shared-mime-info-2.5.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf shared-mime-info-2.5.1.tar.gz
cd "$(tar -tf shared-mime-info-2.5.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Shared Mime Info by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr         \
            --buildtype=release   \
            -D update-mimedb=true \
            -D build-tests=false  \
            -D build-spec=false   \
            .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — *(Optional — skip if unsure)* If want to run the tests, support files will automatically be downloaded from upstream. Build and run the tests with:

```bash
meson configure -D build-tests=true &&
ninja test
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf shared-mime-info-2.5.1.tar.gz | head -1 | cut -d/ -f1)"
```



### After Stage A: sudo for the build user

Allow the `wheel` group to use sudo (this rule ships in the release), and keep the Xorg variables:

**[IPRPS CHROOT]**

```bash
cat > /etc/sudoers.d/00-iprps << "EOF"
Defaults secure_path="/usr/sbin:/usr/bin"
Defaults env_keep += XORG_PREFIX
Defaults env_keep += XORG_CONFIG
%wheel ALL=(ALL) ALL
EOF
```

**For the build only:** let `builder` use sudo **without a password**. The Xorg build loops (Stage B) call `sudo` from BUILDER, where there's no terminal to type a password into. This file is removed at release (13.4):

**[IPRPS CHROOT]**

```bash
echo 'builder ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/90-builder-build-only
chmod 440 /etc/sudoers.d/90-builder-build-only
visudo -c
```

Package root steps still go in the **IPRPS CHROOT** window as labeled; the password-free sudo is only for BLFS's `as_root` loops.

> **Checkpoint:** In BUILDER, `sudo whoami` prints `root` without asking for a password, and `wget -q -O /dev/null https://www.linuxfromscratch.org && echo OK` prints `OK`. Take snapshot **`A-foundations`**.

**[DEBIAN ROOT]** — snapshot `A-foundations`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-A-foundations.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-A-foundations.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 4 — Generic Hardware Support: Kernel, Firmware, Microcode and Initramfs

This part replaces the LFS kernel from your USB build with a **distribution kernel**: modules for nearly all hardware, the complete firmware collection, all CPU microcode, and an initramfs that loads the right drivers at boot. It's what makes one IPRPS image boot on most Intel and AMD PCs.

### 4.1 The strategy

| Piece | Choice | Why |
|---|---|---|
| Kernel configuration | Start from a **mainstream distribution's** configuration, then adapt it | Distro configs are tested on millions of machines; hand-picking drivers misses hardware |
| Drivers | **Modules**, loaded on demand | Works everywhere; firmware loads after the root filesystem is available |
| Firmware | Full **linux-firmware** collection, zstd-compressed | Wi-Fi, GPUs, Bluetooth and more work out of the box |
| CPU microcode | **All** Intel and AMD microcode, in the initramfs | Early CPU fixes on every machine, chosen automatically |
| Initramfs | BLFS **mkinitramfs** | Loads storage and filesystem modules before mounting root |

### 4.2 Get the kernel source

Use the LFS 13.1 kernel (7.1.8). Build it in the scratch space as `builder` (BUILD window):

**[BUILDER]**

```bash
cd ~/src
tar -xf /build/sources/linux-7.1.8.tar.xz
cd linux-7.1.8
make mrproper
```

### 4.3 Choose a base configuration

**Option A (recommended): Arch Linux's kernel configuration.** Arch follows current kernel releases closely, so its configuration supports the newest hardware. Download the configuration file from Arch's `linux` package repository at https://gitlab.archlinux.org/archlinux/packaging/packages/linux. The file is named `config` (or `config.x86_64`) in the repository's file list. Save it as `~/src/base-config`.

**Option B: Debian 13's kernel configuration.** It's older (Debian 13 ships Linux 6.12), so very new hardware may be missing, but it's very conservative. On the Debian/WSL machine:

**[DEBIAN ROOT]**

```bash
mkdir -p /root/debian-kconfig && cd /root/debian-kconfig
apt update
apt download $(apt-cache depends linux-image-amd64 | awk '/Depends: linux-image-[0-9]/{print $2; exit}')
dpkg-deb --fsys-tarfile linux-image-*.deb | tar -x ./boot
ls boot/config-*
```

Still in `/root/debian-kconfig`, copy it into the scratch space, where BUILDER sees it as `~/src/base-config`:

**[DEBIAN ROOT]**

```bash
cp -v boot/config-* /build/src/base-config
chown 1000:1000 /build/src/base-config
```

User number 1000 is `chiita` in Debian but `builder` inside the image, so this gives the file to `builder`.

### 4.4 Adapt it for IPRPS

**[BUILDER]**

```bash
cd ~/src/linux-7.1.8
cp -v ../base-config .config
scripts/config --set-str LOCALVERSION "-iprps" --disable LOCALVERSION_AUTO \
  --enable DRM_SIMPLEDRM --enable SYSFB_SIMPLEFB --disable FB_EFI \
  --disable DEBUG_INFO_BTF --disable DEBUG_INFO_DWARF4 --disable DEBUG_INFO_DWARF5 \
  --disable DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT --enable DEBUG_INFO_NONE \
  --disable RUST \
  --disable MODULE_SIG --disable MODULE_SIG_ALL --set-str MODULE_SIG_KEY "" \
  --set-str SYSTEM_TRUSTED_KEYS "" --set-str SYSTEM_REVOCATION_KEYS "" \
  --disable MODULE_COMPRESS --disable MODULE_COMPRESS_GZIP \
  --disable MODULE_COMPRESS_XZ --disable MODULE_COMPRESS_ZSTD \
  --enable FW_LOADER_COMPRESS --enable FW_LOADER_COMPRESS_ZSTD --enable FW_LOADER_COMPRESS_XZ \
  --set-str EXTRA_FIRMWARE "" \
  --enable BLK_DEV_INITRD --enable RD_GZIP \
  --enable EFI --enable EFI_STUB --enable X86_X2APIC
make olddefconfig
```

| Change | Why |
|---|---|
| `LOCALVERSION "-iprps"` | The kernel and its modules are named `7.1.8-iprps` |
| Debug info and BTF off | BTF needs the `pahole` tool, which isn't in LFS, and debug info multiplies the build size |
| Rust off | The kernel's Rust support needs extra tools; nothing IPRPS needs uses it |
| Module signing off | Distro configs point to their own signing keys, which you don't have |
| Module compression off | Keeps module loading simple with LFS's `kmod` |
| Firmware compression on | The firmware collection is installed zstd-compressed (4.7) |

> **Side note:** `make olddefconfig` silently accepts the default for any option the base configuration doesn't mention. That's what makes a configuration from a different kernel version usable.

### 4.5 Check the options BLFS packages need

BLFS lists kernel options for 25 of the packages in this build (Bluetooth, NetworkManager, PipeWire, CUPS, and others). This loop reports any that aren't enabled:

```bash
cd ~/src/linux-7.1.8
for s in \
  ASYMMETRIC_KEY_TYPE ASYMMETRIC_PUBLIC_KEY_SUBTYPE AUDIT BIG_KEYS BLK_DEV BLK_DEV_DM \
  BLK_DEV_RAM BONDING BT BT_BNEP BT_BNEP_MC_FILTER BT_BNEP_PROTO_FILTER \
  BT_BREDR BT_HCIBTSDIO BT_HCIBTUSB BT_HCIUART BT_HIDP BT_RFCOMM \
  BT_RFCOMM_TTY CRYPTO CRYPTO_AES CRYPTO_CCM CRYPTO_CMAC CRYPTO_RSA \
  CRYPTO_SHA1 CRYPTO_SHA256 CRYPTO_TWOFISH CRYPTO_USER CRYPTO_USER_API_AEAD CRYPTO_USER_API_HASH \
  CRYPTO_USER_API_SKCIPHER CRYPTO_XTS CUSE DM_CACHE DM_CRYPT DM_DELAY \
  DM_MIRROR DM_SNAPSHOT DM_THIN_PROVISIONING DM_ZERO DRM DRM_AMDGPU \
  DRM_AMDGPU_CIK DRM_AMDGPU_SI DRM_AMD_DC DRM_BOCHS DRM_I915 DRM_NOUVEAU \
  DRM_RADEON DRM_SIMPLEDRM DRM_VBOXVIDEO DRM_VGEM DRM_VMWGFX DRM_XE \
  DRM_XE_DISPLAY DRM_XE_FORCE_PROBE DUMMY EVENTFD EXPERT FUSE_FS \
  HID HID_SUPPORT HID_WACOM INET INPUT INPUT_EVDEV \
  INPUT_MISC INPUT_UINPUT IPV6 IPV6_GRE IPV6_MULTIPLE_TABLES IPV6_SIT \
  IPVLAN IP_NF_IPTABLES IP_NF_NAT KEYS KEY_DH_OPERATIONS MACVLAN \
  MACVTAP MAGIC_SYSRQ MD MPTCP MPTCP_IPV6 MSDOS_FS \
  NAMESPACES NET NETDEVICES NETFILTER NETFILTER_ADVANCED NETFILTER_XTABLES \
  NETFILTER_XTABLES_LEGACY NETFILTER_XT_TARGET_LOG NET_CORE NET_IPGRE NET_IPGRE_DEMUX NET_IPIP \
  NET_SCHED NET_SCH_FQ_CODEL NET_SCH_INGRESS NET_SCH_SFQ NET_SCH_TBF NET_TEAM \
  NET_VRF NF_CONNTRACK PARPORT PARPORT_PC POSIX_MQUEUE PRINTER \
  RFKILL SCSI_DEBUG SCSI_LOWLEVEL SECONDARY_TRUSTED_KEYRING SND SOUND \
  SYSFB_SIMPLEFB SYSTEM_BLACKLIST_KEYRING SYSTEM_TRUSTED_KEYRING TIMERFD UDMABUF USB \
  USB_EHCI_HCD USB_HID USB_OHCI_HCD USB_PCI USB_PRINTER USB_SUPPORT \
  USB_XHCI_HCD USER_NS VETH VFAT_FS VLAN_8021Q VXLAN \
  X509_CERTIFICATE_PARSER \
  ; do
  grep -qE "^CONFIG_${s}=(y|m)" .config || echo "not enabled: $s"
done
```

> **Side note:** **Why SimpleDRM.** Debian's configuration uses the old EFI framebuffer (`FB_EFI`), which gives console text but nothing X can use. **SimpleDRM** turns the firmware's display into a real DRM device (`/dev/dri/card0`) on every UEFI PC and VM. When a GPU's own driver loads, it takes over; when it can't (a too-new GPU, or QEMU's virtio-gpu, which fails with error -22), X still has a screen instead of "no screens found". Check after building: `grep -E '^CONFIG_DRM_SIMPLEDRM=y' .config`.

Enable anything reported that you need: `scripts/config --module NAME` for drivers, or `--enable NAME` for features. Then run `make olddefconfig` and the check again. Options that remain off after `olddefconfig` depend on something else being off, and some are only needed for test suites (for example `SCSI_DEBUG` and `DUMMY`), which is fine. Appendix D lists every option with the packages that need it.

### 4.6 Build and install

This is a large build (a distro configuration builds thousands of modules). Expect one to several hours, and about 20 GB on the scratch disk.

**[BUILDER]**

```bash
make
```

**[IPRPS CHROOT]**

```bash
make INSTALL_MOD_STRIP=1 modules_install
cp -v arch/x86/boot/bzImage /boot/vmlinuz-7.1.8-iprps
cp -v System.map /boot/System.map-7.1.8-iprps
cp -v .config /boot/config-7.1.8-iprps
```

`INSTALL_MOD_STRIP=1` strips debugging data from the modules, which shrinks them considerably.

### 4.7 Firmware: the complete collection

Download the newest dated release of **linux-firmware** from kernel.org's download area. (git.kernel.org's "snapshot" links refuse automated downloads with **400 Bad Request**.) List the newest releases:

**[BUILDER]**

```bash
cd ~/src
wget -qO- https://cdn.kernel.org/pub/linux/kernel/firmware/ | grep -o 'linux-firmware-[0-9]*\.tar\.xz' | sort -u | tail -5
```

Download the newest one and check it. Replace `<YYYYMMDD>` with its date, for example `20260916`:

**[BUILDER]**

```bash
wget https://cdn.kernel.org/pub/linux/kernel/firmware/linux-firmware-<YYYYMMDD>.tar.xz
wget https://cdn.kernel.org/pub/linux/kernel/firmware/sha256sums.asc
grep linux-firmware-<YYYYMMDD>.tar.xz sha256sums.asc | sha256sum -c
tar -xf linux-firmware-<YYYYMMDD>.tar.xz
cd linux-firmware-<YYYYMMDD> && pwd
```

The `sha256sum` line must print `OK`. The unpacked folder is 1–2 GB.

**[IPRPS CHROOT]**

```bash
make FIRMWAREDIR=/usr/lib/firmware install-zst
install -vdm755 /usr/share/licenses/linux-firmware
cp -v WHENCE LICEN[CS]E* /usr/share/licenses/linux-firmware/
```

> **Side note:** `install-zst` compresses each firmware file with zstd, cutting the installed size by more than half. The kernel decompresses them on demand thanks to the `FW_LOADER_COMPRESS_ZSTD` option from 4.4. Upstream's optional `dedup` step needs the `rdfind` tool, which isn't in LFS or BLFS, so it's skipped.

### 4.8 CPU microcode: all Intel and AMD

The AMD microcode came with linux-firmware. Add Intel's, using the release BLFS 13.1 lists:

**[BUILDER]**

```bash
cd ~/src
wget https://github.com/intel/Intel-Linux-Processor-Microcode-Data-Files/archive/microcode-20260812.tar.gz
tar -xf microcode-20260812.tar.gz
```

**[IPRPS CHROOT]**

```bash
install -vdm755 /usr/lib/firmware/intel-ucode
install -vm644 Intel-Linux-Processor-Microcode-Data-Files-microcode-20260812/intel-ucode/* /usr/lib/firmware/intel-ucode/
find /usr/lib/firmware/intel-ucode /usr/lib/firmware/amd-ucode -name '*.zst' -exec zstd -d --rm {} \;
ls /usr/lib/firmware/intel-ucode | wc -l
ls /usr/lib/firmware/amd-ucode | head -3
```

> **Warning:** The microcode files **must stay uncompressed**. The initramfs script (4.9) collects `intel-ucode/*` and `amd-ucode/microcode_amd*.bin` and wouldn't find `.zst` files. That's what the `find ... zstd -d` line ensures.

### 4.9 The initramfs (BLFS mkinitramfs)

### About initramfs

*BLFS 13.1 · ID `initramfs` · Stage K*

**Needed at runtime:** `cpio`

**Building an initramfs:**

**[IPRPS CHROOT]** *(root; any folder)* — To install these scripts, run the following commands as the root user:

```bash
cat > /usr/sbin/mkinitramfs << "EOF"
#!/bin/bash
# This file based in part on the mkinitramfs script for the LFS LiveCD
# written by Alexander E. Patrakov and Jeremy Huntwork.

copy()
{
  local file

  if [ "$2" = "lib" ]; then
    file=$(PATH=/usr/lib type -p $1)
  else
    file=$(type -p $1)
  fi

  if [ -n "$file" ] ; then
    cp $file $WDIR/usr/$2
  else
    echo "Missing required file: $1 for directory $2"
    rm -rf $WDIR
    exit 1
  fi
}

if [ -z $1 ] ; then
  INITRAMFS_FILE=initrd.img-no-kmods
else
  KERNEL_VERSION=$1
  INITRAMFS_FILE=initrd.img-$KERNEL_VERSION
fi

if [ -n "$KERNEL_VERSION" ] && [ ! -d "/usr/lib/modules/$1" ] ; then
  echo "No modules directory named $1"
  exit 1
fi

printf "Creating $INITRAMFS_FILE... "

binfiles="sh cat cp dd killall ls mkdir mknod mount "
binfiles="$binfiles umount sed sleep ln rm uname"
binfiles="$binfiles readlink basename"

# Systemd installs udevadm in /bin. Other udev implementations have it in /sbin
if [ -x /usr/bin/udevadm ] ; then binfiles="$binfiles udevadm"; fi

sbinfiles="modprobe blkid switch_root"

# Optional files and locations
for f in mdadm mdmon udevd udevadm; do
  if [ -x /usr/sbin/$f ] ; then sbinfiles="$sbinfiles $f"; fi
done

# Add lvm if present (cannot be done with the others because it
# also needs dmsetup
if [ -x /usr/sbin/lvm ] ; then sbinfiles="$sbinfiles lvm dmsetup"; fi

unsorted=$(mktemp /tmp/unsorted.XXXXXXXXXX)

DATADIR=/usr/share/mkinitramfs
INITIN=init.in

# Create a temporary working directory
WDIR=$(mktemp -d /tmp/initrd-work.XXXXXXXXXX)

# Create base directory structure
mkdir -p $WDIR/{dev,run,sys,proc,usr/{bin,lib/{firmware,modules},sbin}}
mkdir -p $WDIR/etc/{modprobe.d,udev/rules.d}
touch $WDIR/etc/modprobe.d/modprobe.conf
ln -s usr/bin  $WDIR/bin
ln -s usr/lib  $WDIR/lib
ln -s usr/sbin $WDIR/sbin
ln -s lib      $WDIR/lib64

# Create necessary device nodes
mknod -m 640 $WDIR/dev/console c 5 1
mknod -m 664 $WDIR/dev/null    c 1 3

# Install the udev configuration files
if [ -f /etc/udev/udev.conf ]; then
  cp /etc/udev/udev.conf $WDIR/etc/udev/udev.conf
fi

for file in $(find /etc/udev/rules.d/ -type f) ; do
  cp $file $WDIR/etc/udev/rules.d
done

# Install any firmware present
cp -a /usr/lib/firmware $WDIR/usr/lib

# Copy the RAID configuration file if present
if [ -f /etc/mdadm.conf ] ; then
  cp /etc/mdadm.conf $WDIR/etc
fi

# Install the init file
install -m0755 $DATADIR/$INITIN $WDIR/init

if [  -n "$KERNEL_VERSION" ] ; then
  if [ -x /usr/bin/kmod ] ; then
    binfiles="$binfiles kmod"
  else
    binfiles="$binfiles lsmod"
    sbinfiles="$sbinfiles insmod"
  fi
fi

# Install basic binaries
for f in $binfiles ; do
  ldd /usr/bin/$f | sed "s/\t//" | cut -d " " -f1 >> $unsorted
  copy /usr/bin/$f bin
done

for f in $sbinfiles ; do
  ldd /usr/sbin/$f | sed "s/\t//" | cut -d " " -f1 >> $unsorted
  copy $f sbin
done

# Add udevd libraries if not in /usr/sbin
if [ -x /usr/lib/udev/udevd ] ; then
  ldd /usr/lib/udev/udevd | sed "s/\t//" | cut -d " " -f1 >> $unsorted
elif [ -x /usr/lib/systemd/systemd-udevd ] ; then
  ldd /usr/lib/systemd/systemd-udevd | sed "s/\t//" | cut -d " " -f1 >> $unsorted
fi

# Add module symlinks if appropriate
if [ -n "$KERNEL_VERSION" ] && [ -x /usr/bin/kmod ] ; then
  ln -s kmod $WDIR/usr/bin/lsmod
  ln -s kmod $WDIR/usr/bin/insmod
fi

# Add lvm symlinks if appropriate
# Also copy the lvm.conf file
if  [ -x /usr/sbin/lvm ] ; then
  ln -s lvm $WDIR/usr/sbin/lvchange
  ln -s lvm $WDIR/usr/sbin/lvrename
  ln -s lvm $WDIR/usr/sbin/lvextend
  ln -s lvm $WDIR/usr/sbin/lvcreate
  ln -s lvm $WDIR/usr/sbin/lvdisplay
  ln -s lvm $WDIR/usr/sbin/lvscan

  ln -s lvm $WDIR/usr/sbin/pvchange
  ln -s lvm $WDIR/usr/sbin/pvck
  ln -s lvm $WDIR/usr/sbin/pvcreate
  ln -s lvm $WDIR/usr/sbin/pvdisplay
  ln -s lvm $WDIR/usr/sbin/pvscan

  ln -s lvm $WDIR/usr/sbin/vgchange
  ln -s lvm $WDIR/usr/sbin/vgcreate
  ln -s lvm $WDIR/usr/sbin/vgscan
  ln -s lvm $WDIR/usr/sbin/vgrename
  ln -s lvm $WDIR/usr/sbin/vgck
  # Conf file(s)
  cp -a /etc/lvm $WDIR/etc
fi

# Install libraries
sort $unsorted | uniq | while read library ; do
# linux-vdso and linux-gate are pseudo libraries and do not correspond to a file
# libsystemd-shared is in /lib/systemd, so it is not found by copy, and
# it is copied below anyway
  if [[ "$library" == linux-vdso.so.1 ]] ||
     [[ "$library" == linux-gate.so.1 ]] ||
     [[ "$library" == libsystemd-shared* ]]; then
    continue
  fi

  copy $library lib
done

if [ -d /usr/lib/udev ]; then
  cp -a /usr/lib/udev $WDIR/usr/lib
fi
if [ -d /usr/lib/systemd ]; then
  cp -a /usr/lib/systemd $WDIR/usr/lib
fi
if [ -d /usr/lib/elogind ]; then
  cp -a /usr/lib/elogind $WDIR/usr/lib
fi

# Install the kernel modules if requested
if [ -n "$KERNEL_VERSION" ]; then
  find \
     /usr/lib/modules/$KERNEL_VERSION/kernel/{crypto,fs,lib}                      \
     /usr/lib/modules/$KERNEL_VERSION/kernel/drivers/{block,ata,nvme,md,firewire} \
     /usr/lib/modules/$KERNEL_VERSION/kernel/drivers/{scsi,message,pcmcia,virtio} \
     /usr/lib/modules/$KERNEL_VERSION/kernel/drivers/usb/{host,storage}           \
     -type f 2> /dev/null | cpio --make-directories -p --quiet $WDIR

  cp /usr/lib/modules/$KERNEL_VERSION/modules.{builtin,order} \
            $WDIR/usr/lib/modules/$KERNEL_VERSION
  if [ -f /usr/lib/modules/$KERNEL_VERSION/modules.builtin.modinfo ]; then
    cp /usr/lib/modules/$KERNEL_VERSION/modules.builtin.modinfo \
            $WDIR/usr/lib/modules/$KERNEL_VERSION
  fi

  depmod -b $WDIR $KERNEL_VERSION
fi

( cd $WDIR ; find . | cpio -o -H newc --quiet | gzip -9 ) > $INITRAMFS_FILE

# Prepare early loading of microcode if available
if ls /usr/lib/firmware/intel-ucode/* >/dev/null 2>&1 ||
   ls /usr/lib/firmware/amd-ucode/*   >/dev/null 2>&1; then

# first empty WDIR to reuse it
  rm -r $WDIR/*

  DSTDIR=$WDIR/kernel/x86/microcode
  mkdir -p $DSTDIR

  if [ -d /usr/lib/firmware/amd-ucode ]; then
    cat /usr/lib/firmware/amd-ucode/microcode_amd*.bin > $DSTDIR/AuthenticAMD.bin
  fi

  if [ -d /usr/lib/firmware/intel-ucode ]; then
    cat /usr/lib/firmware/intel-ucode/* > $DSTDIR/GenuineIntel.bin
  fi

  ( cd $WDIR; find . | cpio -o -H newc --quiet ) > microcode.img
  cat microcode.img $INITRAMFS_FILE > tmpfile
  mv tmpfile $INITRAMFS_FILE
  rm microcode.img
fi

# Remove the temporary directories and files
rm -rf $WDIR $unsorted
printf "done.\n"

EOF

chmod 0755 /usr/sbin/mkinitramfs
```

**[IPRPS CHROOT]** *(root; any folder)*

```bash
mkdir -p /usr/share/mkinitramfs &&
cat > /usr/share/mkinitramfs/init.in << "EOF"
#!/bin/sh

PATH=/usr/bin:/usr/sbin
export PATH

problem()
{
   printf "Encountered a problem!\n\nDropping you to a shell.\n\n"
   sh
}

no_device()
{
   printf "The device %s, which is supposed to contain the\n" $1
   printf "root file system, does not exist.\n"
   printf "Please fix this problem and exit this shell.\n\n"
}

no_mount()
{
   printf "Could not mount device %s\n" $1
   printf "Sleeping forever. Please reboot and fix the kernel command line.\n\n"
   printf "Maybe the device is formatted with an unsupported file system?\n\n"
   printf "Or maybe filesystem type autodetection went wrong, in which case\n"
   printf "you should add the rootfstype=... parameter to the kernel command line.\n\n"
   printf "Available partitions:\n"
}

do_mount_root()
{
   mkdir /.root
   [ -n "$rootflags" ] && rootflags="$rootflags,"
   rootflags="$rootflags$ro"

   case "$root" in
      /dev/*    ) device=$root ;;
      UUID=*    ) eval $root; device="/dev/disk/by-uuid/$UUID" ;;
      PARTUUID=*) eval $root; device="/dev/disk/by-partuuid/$PARTUUID" ;;
      LABEL=*   ) eval $root; device="/dev/disk/by-label/$LABEL" ;;
      ""        ) echo "No root device specified." ; problem ;;
   esac

   while [ ! -b "$device" ] ; do
       no_device $device
       problem
   done

   if ! mount -n -t "$rootfstype" -o "$rootflags" "$device" /.root ; then
       no_mount $device
       cat /proc/partitions
       while true ; do sleep 10000 ; done
   else
       echo "Successfully mounted device $root"
   fi
}

do_try_resume()
{
   case "$resume" in
      UUID=* ) eval $resume; resume="/dev/disk/by-uuid/$UUID"  ;;
      LABEL=*) eval $resume; resume="/dev/disk/by-label/$LABEL" ;;
   esac

   if $noresume || ! [ -b "$resume" ]; then return; fi

   ls -lH "$resume" | ( read x x x x maj min x
       echo -n ${maj%,}:$min > /sys/power/resume )
}

init=/sbin/init
root=
rootdelay=
rootfstype=auto
ro="ro"
rootflags=
device=
resume=
noresume=false

mount -n -t devtmpfs devtmpfs /dev
mount -n -t proc     proc     /proc
mount -n -t sysfs    sysfs    /sys
mount -n -t tmpfs    tmpfs    /run

read -r cmdline < /proc/cmdline

for param in $cmdline ; do
  case $param in
    init=*      ) init=${param#init=}             ;;
    root=*      ) root=${param#root=}             ;;
    rootdelay=* ) rootdelay=${param#rootdelay=}   ;;
    rootfstype=*) rootfstype=${param#rootfstype=} ;;
    rootflags=* ) rootflags=${param#rootflags=}   ;;
    resume=*    ) resume=${param#resume=}         ;;
    noresume    ) noresume=true                   ;;
    ro          ) ro="ro"                         ;;
    rw          ) ro="rw"                         ;;
  esac
done

# udevd location depends on version
if [ -x /sbin/udevd ]; then
  UDEVD=/sbin/udevd
elif [ -x /lib/udev/udevd ]; then
  UDEVD=/lib/udev/udevd
elif [ -x /lib/systemd/systemd-udevd ]; then
  UDEVD=/lib/systemd/systemd-udevd
else
  echo "Cannot find udevd nor systemd-udevd"
  problem
fi

${UDEVD} --daemon --resolve-names=never
udevadm trigger
udevadm settle

if [ -f /etc/mdadm.conf ] ; then mdadm -As                       ; fi
if [ -x /sbin/vgchange  ] ; then /sbin/vgchange -a y > /dev/null ; fi
if [ -n "$rootdelay"    ] ; then sleep "$rootdelay"              ; fi

do_try_resume # This function will not return if resuming from disk
do_mount_root

killall -w ${UDEVD##*/}

exec switch_root /.root "$init" "$@"

EOF
```

**Using an initramfs:**

**[IPRPS CHROOT]** *(root; any folder)* — *(Optional — skip if unsure)* To build an initramfs, run the following as the root user:

```bash
mkinitramfs [KERNEL VERSION]
```

**[BUILDER]** — *(Optional — skip if unsure)* Now edit /boot/grub/grub.cfg and add a new menuentry. Below are several examples.

```bash
# Generic initramfs and root fs identified by UUID
menuentry "LFS Dev (LFS-7.0-Feb14) initrd, Linux 3.0.4"
{
  linux  /vmlinuz-3.0.4-lfs-20120214 root=UUID=54b934a9-302d-415e-ac11-4988408eb0a8 ro
  initrd /initrd.img-no-kmods
}
```

**[BUILDER]** — *(Optional — skip if unsure)*

```bash
# Generic initramfs and root fs on LVM partition
menuentry "LFS Dev (LFS-7.0-Feb18) initrd lvm, Linux 3.0.4"
{
  linux  /vmlinuz-3.0.4-lfs-20120218 root=/dev/mapper/myroot ro
  initrd /initrd.img-no-kmods
}
```

**[BUILDER]** — *(Optional — skip if unsure)*

```bash
# Specific initramfs and root fs identified by LABEL
menuentry "LFS Dev (LFS-7.1-Feb20) initrd label, Linux 3.2.6"
{
  linux  /vmlinuz-3.2.6-lfs71-120220 root=LABEL=lfs71 ro
  initrd /initrd.img-3.2.6-lfs71-120220
}
```


> **Side note:** The "To install these scripts" block writes two script files to fixed paths, so it can run in **any** folder. Check the result in **[IPRPS CHROOT]** with `bash -n /usr/sbin/mkinitramfs && echo "mkinitramfs OK"`. The book's own "To build an initramfs" and GRUB examples are replaced by the IPRPS steps below.

**IPRPS addition: include SD/eMMC and keyboard drivers.** Many budget laptops boot from eMMC storage, and a working keyboard matters if the initramfs ever needs input. As root:

**[IPRPS CHROOT]**

```bash
sed -i 's|/kernel/drivers/usb/{host,storage}|/kernel/drivers/usb/{host,storage} /usr/lib/modules/$KERNEL_VERSION/kernel/drivers/{mmc,hid}|' /usr/sbin/mkinitramfs
grep -n 'drivers/{mmc,hid}' /usr/sbin/mkinitramfs
```

**IPRPS addition: load storage drivers at every boot.** The initramfs contains the disk drivers, but doesn't always load them by itself. In the first QEMU test, the virtio disk only appeared after loading `virtio_pci` and `virtio_blk` by hand. This line makes the initramfs load the common storage drivers for PCs and virtual machines, so the same image boots everywhere:

**[IPRPS CHROOT]**

```bash
grep -n 'udevadm' /usr/share/mkinitramfs/init.in
sed -i '0,/udevadm settle/s//udevadm settle\nmodprobe -a -q virtio_pci virtio_blk virtio_scsi nvme ahci sd_mod usb_storage uas xhci_pci ehci_pci ohci_pci sdhci_pci sdhci_acpi mmc_block hv_vmbus hv_storvsc vmw_pvscsi ata_piix usbhid hid_generic 2>\/dev\/null\nudevadm settle/' /usr/share/mkinitramfs/init.in
grep -n -A2 'udevadm settle' /usr/share/mkinitramfs/init.in | head -6
```

The last `grep` must show `udevadm settle`, then the `modprobe -a -q ...` line, then `udevadm settle` again.

**IPRPS addition: USB in the initramfs: the USB core, keyboards, and waiting for USB drives.** BLFS's `mkinitramfs` copies the USB *host* and *storage* drivers but not the USB **core** (`usbcore`, `usb-common`), which Debian's kernel configuration builds as modules: without it, the initramfs has no USB at all, so a PC booting from a USB stick can't find the stick and a USB keyboard is dead. This adds `drivers/usb/core` and `drivers/usb/common`. It also stops `mkinitramfs` from copying the **whole firmware collection** into the initramfs (BLFS's `cp -a /usr/lib/firmware`), which made it over 1 GB: slow to load from USB and heavy on RAM. Drivers load their firmware from the root file system once it's mounted, and the CPU microcode is added separately. The keyboard driver (`usbhid`) is added to the drivers loaded at boot (images built before this change lacked it, so a USB keyboard was dead in the initramfs shell). And a USB stick's disk appears a few seconds *after* its drivers load. BLFS's initramfs checks for the root file system only once, so on real PCs booting from USB it stops with "The device /dev/disk/by-uuid/... does not exist" (QEMU's virtual disks are instant, so VM tests don't show this). This makes it wait up to 30 seconds for the root device, checking every second:

**[IPRPS CHROOT]**

```bash
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
```

The first `grep` shows the `# IPRPS: no firmware` line and `drivers/usb/{host,storage,core,common}` in `mkinitramfs`. The second shows the `modprobe` line, now ending in `usbhid hid_generic`. The third shows `n=0`, a `while … -lt 30` loop with the "Waiting for the root device" message, then BLFS's own `while [ ! -b "$device" ]` loop.

**IPRPS addition: quiet the PC speaker.** Debian's kernel configuration has two PC-speaker drivers, and both try to load ("Driver 'pcspkr' is already registered" at boot). Neither is needed (sound goes through the sound card), so both are switched off, which also ends the console beep:

**[IPRPS CHROOT]**

```bash
cat > /etc/modprobe.d/iprps-blacklist.conf << "EOF"
# IPRPS OS: no PC-speaker drivers (they conflict, and the beep isn't wanted)
blacklist pcspkr
blacklist snd_pcsp
EOF
```

**Create the initramfs** for the new kernel, as root. The kernel version name must match the folder in `/usr/lib/modules` (`ls /usr/lib/modules`):

**[IPRPS CHROOT]**

```bash
cd /boot
mkinitramfs 7.1.8-iprps
ls -lh /boot/initrd.img-7.1.8-iprps
```

Expect roughly 50–150 MB. Over 1 GB means the firmware collection got in (see the USB/firmware step above). It bundles the storage and filesystem modules, plus the Intel and AMD microcode at the front of the file.

### 4.10 GRUB: one menu for every machine

Install GRUB for both firmware types into the image (as root, in the chroot). The image is attached as a loop device; `losetup -a` in WSL shows which, here `/dev/loop0`:

**[IPRPS CHROOT]**

```bash
mountpoint -q /boot/efi || mount -v /boot/efi
grub-install --target=x86_64-efi --efi-directory=/boot/efi --removable
grub-install --target=i386-pc /dev/loop0
```

Get the root partition's UUID and keep it in a variable, so nothing gets mistyped:

**[IPRPS CHROOT]**

```bash
ROOT_UUID=$(blkid -s UUID -o value $(findmnt -no SOURCE /)); echo $ROOT_UUID
grep ' / ' /etc/fstab
```

The UUID must match the root line of fstab. (If `findmnt` prints nothing in the chroot, get it in DEBIAN ROOT with `blkid -s UUID -o value /dev/loop0p3`.) Write the menu, then fill in the UUID:

**[IPRPS CHROOT]**

```bash
cat > /boot/grub/grub.cfg << "EOF"
set default=0
set timeout=5

insmod part_gpt
insmod ext2
insmod all_video
search --no-floppy --fs-uuid --set=root <ROOT-UUID>

menuentry "IPRPS OS" {
        linux   /boot/vmlinuz-7.1.8-iprps root=UUID=<ROOT-UUID> ro rootwait quiet
        initrd  /boot/initrd.img-7.1.8-iprps
}

menuentry "IPRPS OS (safe graphics)" {
        linux   /boot/vmlinuz-7.1.8-iprps root=UUID=<ROOT-UUID> ro rootwait nomodeset
        initrd  /boot/initrd.img-7.1.8-iprps
}
EOF
```

**[IPRPS CHROOT]**

```bash
sed -i "s/<ROOT-UUID>/$ROOT_UUID/g" /boot/grub/grub.cfg
grep -c "$ROOT_UUID" /boot/grub/grub.cfg             # must print 3
ls -l /boot/vmlinuz-7.1.8-iprps /boot/initrd.img-7.1.8-iprps /boot/efi/EFI/BOOT/BOOTX64.EFI
```

> **Side note:** With an initramfs, `root=UUID=` works (the initramfs finds the filesystem), so the release images no longer need PARTUUIDs. **Safe graphics** (`nomodeset`) is the standard fallback for machines whose graphics driver misbehaves.

Leave the chroot, run `iprps-leave.sh`, and boot-test a copy (1.4). In the test VM, check:

**[TEST VM]**

```bash
uname -r                                # 7.1.8-iprps
dmesg | grep -i -E 'microcode|firmware' | head
lsmod | wc -l                           # dozens of modules loaded automatically
```

> **Checkpoint:** The test copy boots the generic kernel and `uname -r` shows `7.1.8-iprps`. Take snapshot **`kernel-generic`**.

**[DEBIAN ROOT]** — snapshot `kernel-generic`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-kernel-generic.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-kernel-generic.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 5 — Stage B: Graphics Stack

The X Window System, Mesa (OpenGL and Vulkan drivers for Intel, AMD and NVIDIA open-source drivers), and the font and image libraries the desktop builds on.

**46 packages, in build order:** Mako-1.4.1, Cython-3.2.9, libyaml-0.2.5, PyYAML-6.0.3, Cbindgen-0.29.4, SPIRV-Headers-1.4.357.0, SPIRV-Tools-1.4.357.0, glslang-16.5.0, libpng-1.6.58, FreeType-2.14.3, Fontconfig-2.18.3, util-macros-1.20.2, xorgproto-2025.1, libXau-1.0.12, libXdmcp-1.1.5, xcb-proto-1.17.0, libxcb-1.17.0, Xorg Libraries, Libdrm-2.4.134, rust-bindgen-0.72.1, SPIRV-LLVM-Translator-22.1.5, Vulkan-Headers-1.4.357.0, Wayland-1.26.0, Vulkan-Loader-1.4.357.0, Wayland-Protocols-1.49, Mesa-26.1.7, libepoxy-1.5.10, libxcvt-0.1.3, Pixman-0.46.4, xbitmaps-1.1.4, xcb-util-0.4.1, Xorg Applications, xcursor-themes-1.0.7, Xorg Fonts, Xorg-Server-21.1.24, XKeyboardConfig-2.48, mtdev-1.1.7, Xorg Input Drivers, xinit-1.4.4, Graphite2-1.3.14, harfBuzz-14.3.1, libva-2.24.1, luit-20250912, twm-1.0.13.1, xclock-1.2.1, xterm-411.

### Mako-1.4.1

*BLFS 13.1 · ID `Mako` · Stage B* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 5.1 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/M/Mako/mako-1.4.1.tar.gz
```

MD5 sum of `mako-1.4.1.tar.gz`: `9c09a897c23a34df7ba614ec2d7229e1` (check with `md5sum mako-1.4.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mako-1.4.1.tar.gz
cd "$(tar -tf mako-1.4.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the module as the root user:

```bash
pip3 install --no-index --find-links dist --no-user Mako
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mako-1.4.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Cython-3.2.9

*BLFS 13.1 · ID `cython` · Stage B* · *Build time:* 1.1 SBU · *Disk space:* 186 MB (add 12 MB for tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/cython/cython/releases/download/3.2.9/cython-3.2.9.tar.gz
```

MD5 sum of `cython-3.2.9.tar.gz`: `775ad752cdb021193f3ef323228388d5` (check with `md5sum cython-3.2.9.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cython-3.2.9.tar.gz
cd "$(tar -tf cython-3.2.9.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user Cython
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cython-3.2.9.tar.gz | head -1 | cut -d/ -f1)"
```


### libyaml-0.2.5

*BLFS 13.1 · ID `libyaml` · Stage B* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 6.4 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/yaml/libyaml/releases/download/0.2.5/yaml-0.2.5.tar.gz
```

MD5 sum of `yaml-0.2.5.tar.gz`: `bb15429d8fb787e7d3f1c83ae129a999` (check with `md5sum yaml-0.2.5.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf yaml-0.2.5.tar.gz
cd "$(tar -tf yaml-0.2.5.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libyaml by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf yaml-0.2.5.tar.gz | head -1 | cut -d/ -f1)"
```


### PyYAML-6.0.3

*BLFS 13.1 · ID `PyYAML` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 8.6 MB

**Recommended (included):** `cython`, `libyaml`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/P/PyYAML/pyyaml-6.0.3.tar.gz
```

MD5 sum of `pyyaml-6.0.3.tar.gz`: `dbc6f815cd75160ccf12e470be1c8d6e` (check with `md5sum pyyaml-6.0.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pyyaml-6.0.3.tar.gz
cd "$(tar -tf pyyaml-6.0.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build PyYAML with the following command:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, install the module as the root user:

```bash
pip3 install --no-index --find-links dist --no-user PyYAML
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pyyaml-6.0.3.tar.gz | head -1 | cut -d/ -f1)"
```


### Cbindgen-0.29.4

*BLFS 13.1 · ID `cbindgen` · Stage B* · *Build time:* 0.4 SBU (add 0.2 SBU for tests), both on a 4-core machine · *Disk space:* 255 MB (with tests)

**Requires:** `rust`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/mozilla/cbindgen/archive/v0.29.4/cbindgen-0.29.4.tar.gz
```

MD5 sum of `cbindgen-0.29.4.tar.gz`: `7e790e024bc678ad1b4431b0350679e9` (check with `md5sum cbindgen-0.29.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cbindgen-0.29.4.tar.gz
cd "$(tar -tf cbindgen-0.29.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install cbindgen by running the following commands:

```bash
cargo build --release
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
install -Dm755 target/release/cbindgen /usr/bin/
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cbindgen-0.29.4.tar.gz | head -1 | cut -d/ -f1)"
```


### SPIRV-Headers-1.4.357.0

*BLFS 13.1 · ID `spirv-headers` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 8.5 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/KhronosGroup/SPIRV-Headers/archive/vulkan-sdk-1.4.357.0/SPIRV-Headers-vulkan-sdk-1.4.357.0.tar.gz
```

MD5 sum of `SPIRV-Headers-vulkan-sdk-1.4.357.0.tar.gz`: `085dd07d487c165c0ca7713d726eb6de` (check with `md5sum SPIRV-Headers-vulkan-sdk-1.4.357.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf SPIRV-Headers-vulkan-sdk-1.4.357.0.tar.gz
cd "$(tar -tf SPIRV-Headers-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install SPIRV-Headers by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr -G Ninja .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf SPIRV-Headers-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)"
```


### SPIRV-Tools-1.4.357.0

*BLFS 13.1 · ID `spirv-tools` · Stage B* · *Build time:* 0.6 SBU (with tests; both using parallelism=8) · *Disk space:* 80 MB

**Requires:** `cmake`, `spirv-headers`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/KhronosGroup/SPIRV-Tools/archive/vulkan-sdk-1.4.357.0/SPIRV-Tools-vulkan-sdk-1.4.357.0.tar.gz
```

MD5 sum of `SPIRV-Tools-vulkan-sdk-1.4.357.0.tar.gz`: `c357eec1e33bc95e650aa4c8efdd3b13` (check with `md5sum SPIRV-Tools-vulkan-sdk-1.4.357.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf SPIRV-Tools-vulkan-sdk-1.4.357.0.tar.gz
cd "$(tar -tf SPIRV-Tools-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install SPIRV-Tools by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr     \
      -D CMAKE_BUILD_TYPE=Release      \
      -D SPIRV_WERROR=OFF              \
      -D BUILD_SHARED_LIBS=ON          \
      -D SPIRV_TOOLS_BUILD_STATIC=OFF  \
      -D SPIRV-Headers_SOURCE_DIR=/usr \
      -G Ninja .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf SPIRV-Tools-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)"
```


### glslang-16.5.0

*BLFS 13.1 · ID `glslang` · Stage B* · *Build time:* 0.4 SBU (with parallelism=4; with tests) · *Disk space:* 191 MB (with tests)

**Requires:** `cmake`, `spirv-tools`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/KhronosGroup/glslang/archive/16.5.0/glslang-16.5.0.tar.gz
```

MD5 sum of `glslang-16.5.0.tar.gz`: `79e949d6d50cc167e7d5307afb04c41a` (check with `md5sum glslang-16.5.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glslang-16.5.0.tar.gz
cd "$(tar -tf glslang-16.5.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Glslang by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr     \
      -D CMAKE_BUILD_TYPE=Release      \
      -D ALLOW_EXTERNAL_SPIRV_TOOLS=ON \
      -D BUILD_SHARED_LIBS=ON          \
      -D GLSLANG_TESTS=ON              \
      -G Ninja .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glslang-16.5.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libpng-1.6.58

*BLFS 13.1 · ID `libpng` · Stage B* · *Build time:* 0.4 SBU (with tests) · *Disk space:* 17 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/libpng/libpng-1.6.58.tar.xz
wget https://downloads.sourceforge.net/sourceforge/libpng-apng/libpng-1.6.58-apng.patch.gz
```

MD5 sum of `libpng-1.6.58.tar.xz`: `c6c372a9d7754c66e0b77a8d34987a3b` (check with `md5sum libpng-1.6.58.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libpng-1.6.58.tar.xz
cd "$(tar -tf libpng-1.6.58.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* If you want to patch libpng to support apng files, apply it here:

```bash
zcat ../libpng-1.6.58-apng.patch.gz | patch -p1
```

**[BUILDER]** — Install libpng by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -vDm644 README libpng-manual.txt -t /usr/share/doc/libpng-1.6.58
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libpng-1.6.58.tar.xz | head -1 | cut -d/ -f1)"
```


### FreeType-2.14.3

*BLFS 13.1 · ID `freetype2` · Stage B* · *Build time:* 0.2 SBU (with additional documentation) · *Disk space:* 51 MB (with additional documentation)

**Recommended (included):** `libpng`  
**Needed at runtime:** `harfbuzz`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/freetype/freetype-2.14.3.tar.xz
wget https://downloads.sourceforge.net/freetype/freetype-doc-2.14.3.tar.xz
```

MD5 sum of `freetype-2.14.3.tar.xz`: `5e78e6fdce5a61d3075e4c25e9852f84` (check with `md5sum freetype-2.14.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf freetype-2.14.3.tar.xz
cd "$(tar -tf freetype-2.14.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* If you downloaded the additional documentation, unpack it into the source tree using the following command:

```bash
tar -xf ../freetype-doc-2.14.3.tar.xz --strip-components=2 -C docs
```

**[BUILDER]** — Install FreeType2 by running the following commands:

```bash
sed -ri "s:.*(AUX_MODULES.*valid):\1:" modules.cfg &&

sed -r "s:.*(#.*SUBPIXEL_RENDERING) .*:\1:" \
    -i include/freetype/config/ftoption.h   &&

./configure --prefix=/usr            \
            --disable-static         \
            --enable-freetype-config \
            --with-harfbuzz=dynamic  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you downloaded the optional documentation, install it as the root user:

```bash
cp -v -R docs -T /usr/share/doc/freetype-2.14.3 &&
rm -v /usr/share/doc/freetype-2.14.3/freetype-config.1
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf freetype-2.14.3.tar.xz | head -1 | cut -d/ -f1)"
```


### Fontconfig-2.18.3

*BLFS 13.1 · ID `fontconfig` · Stage B* · *Build time:* 0.3 SBU (with tests) · *Disk space:* 27 MB (with tests)

**Requires:** `freetype2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/api/v4/projects/890/packages/generic/fontconfig/2.18.3/fontconfig-2.18.3.tar.xz
```

MD5 sum of `fontconfig-2.18.3.tar.xz`: `ce819e229ca6fb7d1be47a192d6681a3` (check with `md5sum fontconfig-2.18.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf fontconfig-2.18.3.tar.xz
cd "$(tar -tf fontconfig-2.18.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Fontconfig by running the following commands:

```bash
./configure --prefix=/usr        \
            --sysconfdir=/etc    \
            --localstatedir=/var \
            --disable-docs       \
            --docdir=/usr/share/doc/fontconfig-2.18.3 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you did not remove the --disable-docs parameter from the configure command, you can install the pre-generated documentation by using the following commands as the root user:

```bash
install -v -dm755 \
        /usr/share/{man/man{1,3,5},doc/fontconfig-2.18.3} &&
install -v -m644 fc-*/*.1         /usr/share/man/man1 &&
install -v -m644 doc/*.3          /usr/share/man/man3 &&
install -v -m644 doc/fonts-conf.5 /usr/share/man/man5 &&
install -v -m644 doc/*.{pdf,sgml,txt,html} \
                                  /usr/share/doc/fontconfig-2.18.3
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf fontconfig-2.18.3.tar.xz | head -1 | cut -d/ -f1)"
```


### util-macros-1.20.2

*BLFS 13.1 · ID `util-macros` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 524 KB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/util/util-macros-1.20.2.tar.xz
```

MD5 sum of `util-macros-1.20.2.tar.xz`: `5f683a1966834b0a6ae07b3680bcb863` (check with `md5sum util-macros-1.20.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf util-macros-1.20.2.tar.xz
cd "$(tar -tf util-macros-1.20.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install util-macros by running the following commands:

```bash
./configure $XORG_CONFIG
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf util-macros-1.20.2.tar.xz | head -1 | cut -d/ -f1)"
```


### xorgproto-2025.1

*BLFS 13.1 · ID `xorgproto` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 8.4 MB

**Requires:** `util-macros`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://xorg.freedesktop.org/archive/individual/proto/xorgproto-2025.1.tar.xz
```

MD5 sum of `xorgproto-2025.1.tar.xz`: `15534fa6fb13a6a70afe7561c1424f3c` (check with `md5sum xorgproto-2025.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xorgproto-2025.1.tar.xz
cd "$(tar -tf xorgproto-2025.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xorgproto by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=$XORG_PREFIX .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
mv -v $XORG_PREFIX/share/doc/xorgproto{,-2025.1}
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xorgproto-2025.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libXau-1.0.12

*BLFS 13.1 · ID `libXau` · Stage B* · *Build time:* less than 0.1 SBU (with test) · *Disk space:* 2.9 MB (with test)

**Requires:** `xorgproto`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/lib/libXau-1.0.12.tar.xz
```

MD5 sum of `libXau-1.0.12.tar.xz`: `4c9f81acf00b62e5de56a912691bd737` (check with `md5sum libXau-1.0.12.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libXau-1.0.12.tar.xz
cd "$(tar -tf libXau-1.0.12.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libXau by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libXau-1.0.12.tar.xz | head -1 | cut -d/ -f1)"
```


### libXdmcp-1.1.5

*BLFS 13.1 · ID `libXdmcp` · Stage B* · *Build time:* less than 0.1 SBU (with test) · *Disk space:* 3.0 MB (with test)

**Requires:** `xorgproto`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/lib/libXdmcp-1.1.5.tar.xz
```

MD5 sum of `libXdmcp-1.1.5.tar.xz`: `ce0af51de211e4c99a111e64ae1df290` (check with `md5sum libXdmcp-1.1.5.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libXdmcp-1.1.5.tar.xz
cd "$(tar -tf libXdmcp-1.1.5.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libXdmcp by running the following commands:

```bash
./configure $XORG_CONFIG --docdir='${datadir}'/doc/libXdmcp-1.1.5 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libXdmcp-1.1.5.tar.xz | head -1 | cut -d/ -f1)"
```


### xcb-proto-1.17.0

*BLFS 13.1 · ID `xcb-proto` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 1.3 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://xorg.freedesktop.org/archive/individual/proto/xcb-proto-1.17.0.tar.xz
```

MD5 sum of `xcb-proto-1.17.0.tar.xz`: `c415553d2ee1a8cea43c3234a079b53f` (check with `md5sum xcb-proto-1.17.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xcb-proto-1.17.0.tar.xz
cd "$(tar -tf xcb-proto-1.17.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xcb-proto by running the following commands:

```bash
PYTHON=python3 ./configure $XORG_CONFIG
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you are upgrading from version 1.15.1 or lower, the old pkgconfig file needs to be removed. Issue, as the root user:

```bash
rm -f $XORG_PREFIX/lib/pkgconfig/xcb-proto.pc
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xcb-proto-1.17.0.tar.xz | head -1 | cut -d/ -f1)"
```


### libxcb-1.17.0

*BLFS 13.1 · ID `libxcb` · Stage B* · *Build time:* 0.2 SBU (with tests, add 1.4 SBU for doxygen docs) · *Disk space:* 30 MB (with tests, add 62 MB for doxygen docs)

**Requires:** `libXau`, `xcb-proto`  
**Recommended (included):** `libXdmcp`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://xorg.freedesktop.org/archive/individual/lib/libxcb-1.17.0.tar.xz
```

MD5 sum of `libxcb-1.17.0.tar.xz`: `96565523e9f9b701fcb35d31f1d4086e` (check with `md5sum libxcb-1.17.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxcb-1.17.0.tar.xz
cd "$(tar -tf libxcb-1.17.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxcb by running the following commands:

```bash
./configure $XORG_CONFIG      \
            --without-doxygen \
            --docdir='${datadir}'/doc/libxcb-1.17.0 &&
LC_ALL=en_US.UTF-8 make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If the package was built as a non-root user, the installed documentation is now owned by this user. As the root user, fix the ownership:

```bash
chown -Rv root:root $XORG_PREFIX/share/doc/libxcb-1.17.0
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxcb-1.17.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Xorg Libraries

*BLFS 13.1 · ID `xorg7-lib` · Stage B* · *Build time:* 1.8 SBU · *Disk space:* 274 MB (47 MB installed) - if source directories not deleted

**Requires:** `fontconfig`, `libxcb`

This page builds a **set of packages** from https://www.x.org/pub/individual/lib/ using the list and loop below.

**Download preparation:**

> **Side note (BLFS):** This package is known to build and work properly using an LFS 13.1 platform.

**Downloading Xorg Libraries:**

**[BUILDER]** — First, create a list of files to be downloaded. This file will also be used to verify the integrity of the downloads when complete:

```bash
cat > lib-7.md5 << "EOF"
6ad67d4858814ac24e618b8072900664  xtrans-1.6.0.tar.xz
b617a053d2003cc81309f4e13d01379c  libX11-1.8.13.tar.xz
ea8149187a26e9df6dbd94a60b3d8da0  libXext-1.3.7.tar.xz
c5cc0942ed39c49b8fcd47a427bd4305  libFS-1.0.10.tar.xz
d1ffde0a07709654b20bada3f9abdd16  libICE-1.1.2.tar.xz
3aeeea05091db1c69e6f768e0950a431  libSM-1.2.6.tar.xz
ec09c90a1cfd2c0630321d366a5e7203  libXScrnSaver-1.2.5.tar.xz
9acd189c68750b5028cf120e53c68009  libXt-1.3.1.tar.xz
1ef8065f0284e76c2238770365012ab2  libXmu-1.3.1.tar.xz
cdc7a83243dba674b1ea3c365a1deab1  libXpm-3.5.19.tar.xz
2a9793533224f92ddad256492265dd82  libXaw-1.0.16.tar.xz
baa39ada682dd524491a165bb0dfc708  libXfixes-6.0.2.tar.xz
132816d5efccb883bbc2bf45eb905770  libXcomposite-0.4.7.tar.xz
4c54dce455d96e3bdee90823b0869f89  libXrender-0.9.12.tar.xz
5ce55e952ec2d84d9817169d5fdb7865  libXcursor-1.2.3.tar.xz
72bb73f2a07f81784ad69a39d7df1da2  libXdamage-1.1.7.tar.xz
3cba344d6b351cf308114865afa0d91e  libfontenc-1.1.9.tar.xz
134b3f673f6ecd3e67c0e892dd1a89e8  libXfont2-2.0.9.tar.xz
d378be0fcbd1f689f9a132e0d642bc4b  libXft-2.3.9.tar.xz
2b1cde310bc361464df43276fb969adf  libXi-1.8.3.tar.xz
5f3f5754a40730d1518233a60ba5c48e  libXinerama-1.1.6.tar.xz
b550dfa388292a821aecdd52acecc94c  libXrandr-1.5.5.tar.xz
5014282a08b54ec0edfa73c5cf9ae2c1  libXres-1.2.3.tar.xz
b62dc44d8e63a67bb10230d54c44dcb7  libXtst-1.2.5.tar.xz
8a26503185afcb1bbd2c65e43f775a67  libXv-1.0.13.tar.xz
de4227c5722a8f5ca5748f3ef524aeee  libXvMC-1.0.15.tar.xz
543164f1239fbe92cc0a9128d8da88e9  libXxf86dga-1.1.7.tar.xz
bea9e3707fae6c3275769e771006fa0f  libXxf86vm-1.1.7.tar.xz
0c11ea502b531e59563a9aa7979146fc  libpciaccess-0.19.tar.xz
fa0faa5b6a8e726186c535d73712ccea  libxkbfile-1.2.0.tar.xz
9805be7e18f858bed9938542ed2905dc  libxshmfence-1.3.3.tar.xz
53b72ce969745f8d3e41175d6549ce0b  libXpresent-1.0.2.tar.xz
EOF
```

**[BUILDER]** — To download the needed files using Wget-1.25.0, use the following commands:

```bash
mkdir lib &&
cd lib &&
grep -v '^#' ../lib-7.md5 | awk '{print $2}' | wget -i- -c \
    -B https://www.x.org/pub/individual/lib/ &&
md5sum -c ../lib-7.md5
```

**Build and install:**

> **Side note (BLFS):** When installing multiple packages in a script, the installation needs to be done as the root user. There are three general options that can be used to do this: One way to handle this situation is to create a short bash function that automatically selects the appropriate method. Once the command is set in the environment, it does not need to be set again.

**[BUILDER]** — *(Optional — skip if unsure)* When installing multiple packages in a script, the installation needs to be done as the root user. There are three general options that can be used to do this: One way to handle this situation is to create a short bash function that automatically selects…

```bash
as_root()
{
  if   [ $EUID = 0 ];        then $*
  elif [ -x /usr/bin/sudo ]; then sudo $*
  else                            su -c \\"$*\\"
  fi
}

export -f as_root
```

**[BUILDER]** — *(Optional — skip if unsure)* Some libraries come with a test suite. If you wish to execute them, either comment out the rm -rf ... below, so that, after all libraries are installed, you can come back to the corresponding directory and run make check, or do individual builds, running…

```bash
grep -A9 summary *make_check.log
```

**[BUILDER]** — First, start a subshell that will exit on error:

```bash
bash -e
```

**[BUILDER]** — Install all of the packages by running the following commands:

```bash
for package in $(grep -v '^#' ../lib-7.md5 | awk '{print $2}')
do
  packagedir=${package%.tar.?z*}
  echo "Building $packagedir"

  tar -xf $package
  pushd $packagedir
  docdir="--docdir=$XORG_PREFIX/share/doc/$packagedir"

  do_build() { make; }
  do_test() { make check; }
  do_install() { as_root make install; }
  
  case $packagedir in
    libXfont2-[0-9]* )
      ./configure $XORG_CONFIG $docdir --disable-devel-docs
    ;;

    libXt-[0-9]* )
      ./configure $XORG_CONFIG $docdir \
                  --with-appdefaultdir=/etc/X11/app-defaults
    ;;

    libXpm-[0-9]* )
      ./configure $XORG_CONFIG $docdir --disable-open-zfile
    ;;
  
    libpciaccess* | libxkbfile* )
      meson setup --prefix=$XORG_PREFIX --buildtype=release build
      do_build()  { ninja -C build; }
      do_test() { ninja -C build test; }
      do_install() { as_root ninja -C build install; }
    ;;

    * )
      ./configure $XORG_CONFIG $docdir
    ;;
  esac

  do_build
  #do_test |& tee ../$packagedir-test.log
  do_install
  unset do_build do_test do_install

  popd
  rm -rf $packagedir
  as_root /sbin/ldconfig
done
```

**[BUILDER]** — Finally, exit the shell that was started earlier:

```bash
exit
```

**Configure:**

**[IPRPS CHROOT]** *(root; any folder)* — *(Optional — skip if unsure)* If you've chosen to install Xorg into /usr, then no further configuration is necessary and you can skip the rest of this section. If you've opted for an alternate prefix, you should create two symlinks to satisfy the expected environment of several…

```bash
ln -sv $XORG_PREFIX/lib/X11 /usr/lib/X11 &&
ln -sv $XORG_PREFIX/include/X11 /usr/include/X11
```


### Libdrm-2.4.134

*BLFS 13.1 · ID `libdrm` · Stage B* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 7.8 MB (with tests)

**Recommended (included):** `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://dri.freedesktop.org/libdrm/libdrm-2.4.134.tar.xz
```

MD5 sum of `libdrm-2.4.134.tar.xz`: `0e70607bb5c2f7ecbc411e6a2fab8b22` (check with `md5sum libdrm-2.4.134.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libdrm-2.4.134.tar.xz
cd "$(tar -tf libdrm-2.4.134.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libdrm by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=$XORG_PREFIX \
            --buildtype=release   \
            -D udev=true          \
            -D valgrind=disabled  \
            ..                    &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libdrm-2.4.134.tar.xz | head -1 | cut -d/ -f1)"
```


### rust-bindgen-0.72.1

*BLFS 13.1 · ID `rust-bindgen` · Stage B* · *Build time:* 0.4 SBU (with parallelism=8) · *Disk space:* 219 MB

**Requires:** `rust`  
**Needed at runtime:** `llvm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/rust-lang/rust-bindgen/archive/refs/tags/v0.72.1/rust-bindgen-0.72.1.tar.gz
```

MD5 sum of `rust-bindgen-0.72.1.tar.gz`: `49be3303557d072ce4c6987b2989be3c` (check with `md5sum rust-bindgen-0.72.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf rust-bindgen-0.72.1.tar.gz
cd "$(tar -tf rust-bindgen-0.72.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install rust-bindgen by running the following commands:

```bash
cargo build --release
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
install -v -m755 target/release/bindgen /usr/bin
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Still as the root user, install the Bash and Zsh completion support files:

```bash
bindgen --generate-shell-completions bash \
    > /usr/share/bash-completion/completions/bindgen
bindgen --generate-shell-completions zsh  \
    > /usr/share/zsh/site-functions/_bindgen
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf rust-bindgen-0.72.1.tar.gz | head -1 | cut -d/ -f1)"
```


### SPIRV-LLVM-Translator-22.1.5

*BLFS 13.1 · ID `spirv-llvm-translator` · Stage B* · *Build time:* 0.5 SBU (with parallelism=4) · *Disk space:* 48 MB

**Requires:** `libxml2`, `llvm`, `spirv-tools`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/KhronosGroup/SPIRV-LLVM-Translator/archive/v22.1.5/SPIRV-LLVM-Translator-22.1.5.tar.gz
```

MD5 sum of `SPIRV-LLVM-Translator-22.1.5.tar.gz`: `8bdf03a2f7d90da52e358ac78b3e9959` (check with `md5sum SPIRV-LLVM-Translator-22.1.5.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf SPIRV-LLVM-Translator-22.1.5.tar.gz
cd "$(tar -tf SPIRV-LLVM-Translator-22.1.5.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install SPIRV-LLVM-Translator by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr                   \
      -D CMAKE_BUILD_TYPE=Release                    \
      -D BUILD_SHARED_LIBS=ON                        \
      -D CMAKE_SKIP_INSTALL_RPATH=ON                 \
      -D LLVM_EXTERNAL_SPIRV_HEADERS_SOURCE_DIR=/usr \
      -G Ninja ..                                    &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf SPIRV-LLVM-Translator-22.1.5.tar.gz | head -1 | cut -d/ -f1)"
```


### Vulkan-Headers-1.4.357.0

*BLFS 13.1 · ID `vulkan-headers` · Stage B* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 122 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/KhronosGroup/Vulkan-Headers/archive/vulkan-sdk-1.4.357.0/Vulkan-Headers-vulkan-sdk-1.4.357.0.tar.gz
```

MD5 sum of `Vulkan-Headers-vulkan-sdk-1.4.357.0.tar.gz`: `64a23bb12e95a2017004d72569132929` (check with `md5sum Vulkan-Headers-vulkan-sdk-1.4.357.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf Vulkan-Headers-vulkan-sdk-1.4.357.0.tar.gz
cd "$(tar -tf Vulkan-Headers-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Vulkan-Headers by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr -G Ninja .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf Vulkan-Headers-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Wayland-1.26.0

*BLFS 13.1 · ID `wayland` · Stage B* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 9.0 MB (with tests)

**Requires:** `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/wayland/wayland/-/releases/1.26.0/downloads/wayland-1.26.0.tar.xz
```

MD5 sum of `wayland-1.26.0.tar.xz`: `64c593ccf6820635765a952ec5f34fbb` (check with `md5sum wayland-1.26.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf wayland-1.26.0.tar.xz
cd "$(tar -tf wayland-1.26.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Wayland by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D documentation=false &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf wayland-1.26.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Vulkan-Loader-1.4.357.0

*BLFS 13.1 · ID `vulkan-loader` · Stage B* · *Build time:* 0.4 SBU (with tests) · *Disk space:* 146 MB (with tests)

**Requires:** `cmake`, `vulkan-headers`, `xorg7-lib`  
**Recommended (included):** `wayland`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/KhronosGroup/Vulkan-Loader/archive/vulkan-sdk-1.4.357.0/Vulkan-Loader-vulkan-sdk-1.4.357.0.tar.gz
```

MD5 sum of `Vulkan-Loader-vulkan-sdk-1.4.357.0.tar.gz`: `ce35f16bee47e9faf0a50d682a2db77d` (check with `md5sum Vulkan-Loader-vulkan-sdk-1.4.357.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf Vulkan-Loader-vulkan-sdk-1.4.357.0.tar.gz
cd "$(tar -tf Vulkan-Loader-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** If this package is being installed on a system where Mesa has already been installed previously, please rebuild Mesa-26.1.7 after this package to install Vulkan graphics drivers.

**[BUILDER]** — Install Vulkan-Loader by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr   \
      -D CMAKE_BUILD_TYPE=Release    \
      -D CMAKE_SKIP_INSTALL_RPATH=ON \
      -G Ninja .. &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* To run the test suite, issue (note that the command will use Git-2.55.0 to download a copy of GoogleTest for building the test suite):

```bash
sed "s/'git', 'clone'/&, '--depth=1', '-b', self.commit/" \
    -i ../scripts/update_deps.py &&
cmake -D BUILD_TESTS=ON -D UPDATE_DEPS=ON .. &&
ninja &&
ninja test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf Vulkan-Loader-vulkan-sdk-1.4.357.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Wayland-Protocols-1.49

*BLFS 13.1 · ID `wayland-protocols` · Stage B* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 16 MB (with tests)

**Requires:** `wayland`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/wayland/wayland-protocols/-/releases/1.49/downloads/wayland-protocols-1.49.tar.xz
```

MD5 sum of `wayland-protocols-1.49.tar.xz`: `5685f769a227f2d4143d983ad07edaba` (check with `md5sum wayland-protocols-1.49.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf wayland-protocols-1.49.tar.xz
cd "$(tar -tf wayland-protocols-1.49.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Wayland-protocols by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf wayland-protocols-1.49.tar.xz | head -1 | cut -d/ -f1)"
```


### Mesa-26.1.7

*BLFS 13.1 · ID `mesa` · Stage B* · *Build time:* 3.4 SBU (with docs; add 1.6 SBU for tests; both with parallelism=4) · *Disk space:* 1.2 GB (with docs; add 570 MB for tests)

**Requires:** `xorg7-lib`, `libdrm`, `Mako`, `PyYAML`  
**Recommended (included):** `glslang`, `libva`, `llvm`, `wayland-protocols`, `spirv-llvm-translator`, `vulkan-loader`, `cbindgen`, `make-ca`, `rust-bindgen`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://mesa.freedesktop.org/archive/mesa-26.1.7.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/mesa-add_xdemos-5.patch
```

MD5 sum of `mesa-26.1.7.tar.xz`: `1a3ea044abc823e2db8c6041e5adcc4f` (check with `md5sum mesa-26.1.7.tar.xz`).

Additional reference: https://archive.mesa3d.org/demos/

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mesa-26.1.7.tar.xz
cd "$(tar -tf mesa-26.1.7.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS release override.** BLFS warns that `-D video-codecs=all` enables patent-encumbered video codecs, which matters when distributing. The command below already has that option removed; Mesa then uses its default, royalty-free codec set.

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* If you have downloaded the xdemos patch (needed if testing the Xorg installation per BLFS instructions), apply it by running the following command:

```bash
patch -Np1 -i ../mesa-add_xdemos-5.patch
```

**[BUILDER]** — Install Mesa by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                 \
      --prefix=$XORG_PREFIX    \
      --buildtype=release      \
      -D platforms=x11,wayland \
      -D gallium-drivers=auto  \
      -D vulkan-drivers=auto   \
      -D valgrind=disabled     \
      -D libunwind=disabled    &&

ninja
```

> **Warning (BLFS):** Please ask your lawyer or remove the -D video-codecs=all option if you will distribute the compiled Mesa libraries and drivers to others.

**[BUILDER]** — *(Optional — skip if unsure)* To test the results, issue:

```bash
meson configure -D build-tests=true &&
ninja test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If desired, install the optional documentation by running the following commands as the root user:

```bash
cp -rv ../docs -T /usr/share/doc/mesa-26.1.7
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mesa-26.1.7.tar.xz | head -1 | cut -d/ -f1)"
```


### libepoxy-1.5.10

*BLFS 13.1 · ID `libepoxy` · Stage B* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 13 MB (with tests)

**Requires:** `mesa`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libepoxy/1.5/libepoxy-1.5.10.tar.xz
```

MD5 sum of `libepoxy-1.5.10.tar.xz`: `10c635557904aed5239a4885a7c4efb7` (check with `md5sum libepoxy-1.5.10.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libepoxy-1.5.10.tar.xz
cd "$(tar -tf libepoxy-1.5.10.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libepoxy by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libepoxy-1.5.10.tar.xz | head -1 | cut -d/ -f1)"
```


### libxcvt-0.1.3

*BLFS 13.1 · ID `libxcvt` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 440 KB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/lib/libxcvt-0.1.3.tar.xz
```

MD5 sum of `libxcvt-0.1.3.tar.xz`: `7fb9c51d33a680f724f34da41768b1d0` (check with `md5sum libxcvt-0.1.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxcvt-0.1.3.tar.xz
cd "$(tar -tf libxcvt-0.1.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxcvt by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=$XORG_PREFIX --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxcvt-0.1.3.tar.xz | head -1 | cut -d/ -f1)"
```


### Pixman-0.46.4

*BLFS 13.1 · ID `pixman` · Stage B* · *Build time:* 0.1 SBU (Using parallelism=4; with tests) · *Disk space:* 28 MB (With tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.cairographics.org/releases/pixman-0.46.4.tar.gz
```

MD5 sum of `pixman-0.46.4.tar.gz`: `c08173c8e1d2cc79428d931c13ffda59` (check with `md5sum pixman-0.46.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pixman-0.46.4.tar.gz
cd "$(tar -tf pixman-0.46.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Pixman by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pixman-0.46.4.tar.gz | head -1 | cut -d/ -f1)"
```


### xbitmaps-1.1.4

*BLFS 13.1 · ID `xbitmaps` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 1.4 MB

**Requires:** `util-macros`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/data/xbitmaps-1.1.4.tar.xz
```

MD5 sum of `xbitmaps-1.1.4.tar.xz`: `793992635c45250028eaec226af416fc` (check with `md5sum xbitmaps-1.1.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xbitmaps-1.1.4.tar.xz
cd "$(tar -tf xbitmaps-1.1.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xbitmaps by running the following commands:

```bash
./configure $XORG_CONFIG
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xbitmaps-1.1.4.tar.xz | head -1 | cut -d/ -f1)"
```


### xcb-util-0.4.1

*BLFS 13.1 · ID `xcb-util` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 2.6 MB

**Requires:** `libxcb`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://xcb.freedesktop.org/dist/xcb-util-0.4.1.tar.xz
```

MD5 sum of `xcb-util-0.4.1.tar.xz`: `34d749eab0fd0ffd519ac64798d79847` (check with `md5sum xcb-util-0.4.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xcb-util-0.4.1.tar.xz
cd "$(tar -tf xcb-util-0.4.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xcb-util by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xcb-util-0.4.1.tar.xz | head -1 | cut -d/ -f1)"
```


### Xorg Applications

*BLFS 13.1 · ID `xorg7-app` · Stage B* · *Build time:* 1.5 SBU (ignoring the time to download) · *Disk space:* 48 MB

**Requires:** `libpng`, `mesa`, `xbitmaps`, `xcb-util`

This page builds a **set of packages** from https://www.x.org/pub/individual/app/ using the list and loop below.

**Download preparation:**

> **Side note (BLFS):** This package is known to build and work properly using an LFS 13.1 platform.

**Downloading Xorg Applications:**

**[BUILDER]** — First, create a list of files to be downloaded. This file will also be used to verify the integrity of the downloads when complete:

```bash
cat > app-7.md5 << "EOF"
36936e5bcf04b982ea87b4556d082061  iceauth-1.0.11.tar.xz
83d943bbb0e3ab868cb0a7438e135544  mkfontscale-1.2.4.tar.xz
b9efe1d21615c474b22439d41981beef  sessreg-1.1.4.tar.xz
5a10223c3305f48bfb3b09e0a7a139d1  setxkbmap-1.3.5.tar.xz
6484cd8ee30354aaaf8f490988f5f6ef  smproxy-1.0.8.tar.xz
9cfdec89ad7bd86bcdfda150ae995955  xauth-1.1.5.tar.xz
37063ccf902fe3d55a90f387ed62fe1f  xcmsdb-1.0.7.tar.xz
f97e81b2c063f6ae9b18d4b4be7543f6  xcursorgen-1.0.9.tar.xz
700556957773d378fa16a65a4406be0a  xdpyinfo-1.4.0.tar.xz
830a54ef3ba338013e06a1b5b012b4bd  xdriinfo-1.0.8.tar.xz
6d2309b05267e31923b11ed2b83f33ae  xev-1.2.7.tar.xz
687e42aa5afaec37f14da3072651c635  xgamma-1.0.8.tar.xz
45c7e956941194e5f06a9c7307f5f971  xhost-1.0.10.tar.xz
8e4d14823b7cbefe1581c398c6ab0035  xinput-1.6.4.tar.xz
b8128ff6816897bd385ca437cd2886ee  xkbcomp-1.5.0.tar.xz
543c0535367ca30e0b0dbcfa90fefdf9  xkbevd-1.1.6.tar.xz
c572508053297094995f1fc4bc681624  xkbutils-1.0.7.tar.xz
294db9393a9d8e6613e1e3dd4fe0273f  xkill-1.0.7.tar.xz
a98d83568d19cc606b114b133d6ed8be  xlsatoms-1.1.5.tar.xz
cf2fc9e9d298c149253cfc77faaa475e  xlsclients-1.1.6.tar.xz
ba2dd3db3361e374fefe2b1c797c46eb  xmessage-1.0.7.tar.xz
4e6b8655260cca88252e86f5431041c0  xmodmap-1.0.12.tar.xz
ab6c9d17eb1940afcfb80a72319270ae  xpr-1.2.0.tar.xz
5ef4784b406d11bed0fdf07cc6fba16c  xprop-1.2.8.tar.xz
211abd989eef11708cc0a4978d101014  xrandr-1.5.4.tar.xz
44894ebd60a40c54ccc44c67ad3b7de8  xrdb-1.2.3.tar.xz
af26f2a7f128f27e0df30ef246687726  xrefresh-1.1.1.tar.xz
95fcb2ae70ee7e7ef7fe70b096b3d254  xset-1.2.6.tar.xz
33c80b7744f9a452bf9e39ea7303650e  xsetroot-1.1.4.tar.xz
5076c46fe4f6da29377e462ad25c893d  xvinfo-1.1.6.tar.xz
ee94a7722c8b9e37a28f1ac0fc371454  xwd-1.0.10.tar.xz
e24406c671ab09a7ab0e13a7d1ef2752  xwininfo-1.1.7.tar.xz
53d99fe7077b162b0cb87189f7ed71ce  xwud-1.0.8.tar.xz
EOF
```

**[BUILDER]** — To download the needed files using Wget-1.25.0, use the following commands:

```bash
mkdir app &&
cd app &&
grep -v '^#' ../app-7.md5 | awk '{print $2}' | wget -i- -c \
    -B https://www.x.org/pub/individual/app/ &&
md5sum -c ../app-7.md5
```

**Build and install:**

> **Side note (BLFS):** When installing multiple packages in a script, the installation needs to be done as the root user. There are three general options that can be used to do this: One way to handle this situation is to create a short bash function that automatically selects the appropriate method. Once the command is set in the environment, it does not need to be set again.

**[BUILDER]** — *(Optional — skip if unsure)* When installing multiple packages in a script, the installation needs to be done as the root user. There are three general options that can be used to do this: One way to handle this situation is to create a short bash function that automatically selects…

```bash
as_root()
{
  if   [ $EUID = 0 ];        then $*
  elif [ -x /usr/bin/sudo ]; then sudo $*
  else                            su -c \\"$*\\"
  fi
}

export -f as_root
```

**[BUILDER]** — First, start a subshell that will exit on error:

```bash
bash -e
```

**[BUILDER]** — Install all of the packages by running the following commands:

```bash
for package in $(grep -v '^#' ../app-7.md5 | awk '{print $2}')
do
  packagedir=${package%.tar.?z*}
  tar -xf $package
  pushd $packagedir
     ./configure $XORG_CONFIG
     make
     as_root make install
  popd
  rm -rf $packagedir
done
```

**[BUILDER]** — Finally, exit the shell that was started earlier:

```bash
exit
```

**[BUILDER]** — Unless you installed the optional dependencies, remove an undocumented script which is reported to be broken (xkeystone provided by the xrandr package).

```bash
as_root rm -f $XORG_PREFIX/bin/xkeystone
```


### xcursor-themes-1.0.7

*BLFS 13.1 · ID `xcursor-themes` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 15 MB

**Requires:** `xorg7-app`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/data/xcursor-themes-1.0.7.tar.xz
```

MD5 sum of `xcursor-themes-1.0.7.tar.xz`: `070993be1f010b09447ea24bab2c9846` (check with `md5sum xcursor-themes-1.0.7.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xcursor-themes-1.0.7.tar.xz
cd "$(tar -tf xcursor-themes-1.0.7.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** We explicitly install the cursor themes in /usr instead of $XORG_PREFIX so non-Xorg desktop environments can find them.

**[BUILDER]** — Install xcursor-themes by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xcursor-themes-1.0.7.tar.xz | head -1 | cut -d/ -f1)"
```


### Xorg Fonts

*BLFS 13.1 · ID `xorg7-font` · Stage B* · *Build time:* 0.1 SBU · *Disk space:* 8.8 MB

**Requires:** `xcursor-themes`

This page builds a **set of packages** from https://www.x.org/pub/individual/font/ using the list and loop below.

**Download preparation:**

> **Side note (BLFS):** This package is known to build and work properly using an LFS 13.1 platform.

**Downloading Xorg Fonts:**

**[BUILDER]** — First, create a list of files to be downloaded. This file will also be used to verify the integrity of the downloads when complete:

```bash
cat > font-7.md5 << "EOF"
42ea8cc91549e43e9251ccbd664e7864  font-util-1.4.2.tar.xz
a56b1a7f2c14173f71f010225fa131f1  encodings-1.1.0.tar.xz
dd1a744b97eb6d388d4e78b17011193e  font-alias-1.0.6.tar.xz
546d17feab30d4e3abcf332b454f58ed  font-adobe-utopia-type1-1.0.5.tar.xz
063bfa1456c8a68208bf96a33f472bb1  font-bh-ttf-1.0.4.tar.xz
51a17c981275439b85e15430a3d711ee  font-bh-type1-1.0.4.tar.xz
00f64a84b6c9886040241e081347a853  font-ibm-type1-1.0.4.tar.xz
fe972eaf13176fa9aa7e74a12ecc801a  font-misc-ethiopic-1.0.5.tar.xz
3b47fed2c032af3a32aad9acc1d25150  font-xfree86-type1-1.0.5.tar.xz
EOF
```

**[BUILDER]** — To download the needed files using Wget-1.25.0, use the following commands:

```bash
mkdir font &&
cd font &&
grep -v '^#' ../font-7.md5 | awk '{print $2}' | wget -i- -c \
    -B https://www.x.org/pub/individual/font/ &&
md5sum -c ../font-7.md5
```

**Build and install:**

> **Side note (BLFS):** When installing multiple packages in a script, the installation needs to be done as the root user. There are three general options that can be used to do this: One way to handle this situation is to create a short bash function that automatically selects the appropriate method. Once the command is set in the environment, it does not need to be set again.

**[BUILDER]** — *(Optional — skip if unsure)* When installing multiple packages in a script, the installation needs to be done as the root user. There are three general options that can be used to do this: One way to handle this situation is to create a short bash function that automatically selects…

```bash
as_root()
{
  if   [ $EUID = 0 ];        then $*
  elif [ -x /usr/bin/sudo ]; then sudo $*
  else                            su -c \\"$*\\"
  fi
}

export -f as_root
```

**[BUILDER]** — First, start a subshell that will exit on error:

```bash
bash -e
```

**[BUILDER]** — Install all of the packages by running the following commands:

```bash
for package in $(grep -v '^#' ../font-7.md5 | awk '{print $2}')
do
  packagedir=${package%.tar.?z*}
  tar -xf $package
  pushd $packagedir
    ./configure $XORG_CONFIG
    make
    as_root make install
  popd
  as_root rm -rf $packagedir
done
```

**[BUILDER]** — Finally, exit the shell that was started earlier:

```bash
exit
```

**[IPRPS CHROOT]** *(root; any folder)* — When all of the fonts have been installed, the system must be configured so that Fontconfig can find the TrueType fonts. Since the fonts are outside of the default search path of several packages if XORG_PREFIX is not /usr, make symlinks to the Xorg…

```bash
install -v -d -m755 /usr/share/fonts                               &&
ln -svfn $XORG_PREFIX/share/fonts/X11/OTF /usr/share/fonts/X11-OTF &&
ln -svfn $XORG_PREFIX/share/fonts/X11/TTF /usr/share/fonts/X11-TTF
```


### Xorg-Server-21.1.24

*BLFS 13.1 · ID `xorg-server` · Stage B* · *Build time:* 0.3 SBU (using parallelism=4; with tests) · *Disk space:* 199 MB (with tests)

**Requires:** `libxcvt`, `pixman`, `xorg7-font`  
**Recommended (included):** `libepoxy`, `libtirpc`  
**Needed at runtime:** `xkeyboard-config`, `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/xserver/xorg-server-21.1.24.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/xorg-server-21.1.24-tearfree_backport-1.patch
```

MD5 sum of `xorg-server-21.1.24.tar.xz`: `19c2d104a6c9ba85b4896ef75b2d1084` (check with `md5sum xorg-server-21.1.24.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xorg-server-21.1.24.tar.xz
cd "$(tar -tf xorg-server-21.1.24.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, if you need the TearFree option to work around screen tearing, apply the backported patch:

```bash
patch -Np1 -i ../xorg-server-21.1.24-tearfree_backport-1.patch
```

**[BUILDER]** — Install the server by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..              \
      --prefix=$XORG_PREFIX \
      --localstatedir=/var  \
      -D glamor=true        \
      -D xkb_output_dir=/var/lib/xkb &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now as the root user:

```bash
ninja install &&
mkdir -pv /etc/X11/xorg.conf.d
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xorg-server-21.1.24.tar.xz | head -1 | cut -d/ -f1)"
```


### XKeyboardConfig-2.48

*BLFS 13.1 · ID `xkeyboard-config` · Stage B* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 35 MB

**Requires:** `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/data/xkeyboard-config/xkeyboard-config-2.48.tar.xz
```

MD5 sum of `xkeyboard-config-2.48.tar.xz`: `575106aff79b589abe4aff6c4bff4782` (check with `md5sum xkeyboard-config-2.48.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xkeyboard-config-2.48.tar.xz
cd "$(tar -tf xkeyboard-config-2.48.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install XKeyboardConfig by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=$XORG_PREFIX --buildtype=release .. &&
ninja
```

> **Warning (BLFS):** If upgrading from version 2.44 or earlier, the installation will fail if some files are not symbolic links. To fix this, run as the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If upgrading from version 2.44 or earlier, the installation will fail if some files are not symbolic links. To fix this, run as the root user:

```bash
if [ -d $XORG_PREFIX/share/X11/xkb ]; then
  rm -rf $XORG_PREFIX/share/X11/xkb
  rm -f  $XORG_PREFIX/share/man/man7/xkeyboard-config.7
  rm -f  $XORG_PREFIX/share/pkgconfig/xkeyboard-config.pc
fi
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xkeyboard-config-2.48.tar.xz | head -1 | cut -d/ -f1)"
```


### mtdev-1.1.7

*BLFS 13.1 · ID `mtdev` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 2.5 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://bitmath.org/code/mtdev/mtdev-1.1.7.tar.bz2
```

MD5 sum of `mtdev-1.1.7.tar.bz2`: `483ed7fdf7c1e7b7375c05a62848cce7` (check with `md5sum mtdev-1.1.7.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mtdev-1.1.7.tar.bz2
cd "$(tar -tf mtdev-1.1.7.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install mtdev by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mtdev-1.1.7.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Xorg Input Drivers

*BLFS 13.1 · ID `xorg7-input-driver` · Stage B*

This page builds **6 packages**, in this order. Build and install each one completely before starting the next.

#### libevdev 1.13.6

*Build time:* less than 0.1 SBU (without tests) · *Disk space:* 5.0 MB (without tests

**[BUILDER]** — Download and unpack (the folder name is read from the tarball):

```bash
cd ~/src
wget https://www.freedesktop.org/software/libevdev/libevdev-1.13.6.tar.xz
md5sum libevdev-1.13.6.tar.xz          # must print 4202ff132e3efe95fe9ca2c4f8f119f7
tar -xf libevdev-1.13.6.tar.xz
cd "$(tar -tf libevdev-1.13.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

*Kernel settings — for reference only, not commands. The generic kernel (Part 4) already includes them.* Enable the following options in the kernel configuration and recompile the kernel if necessary:

```text
Device Drivers --->
  Input device support --->
    -*-   Generic input layer (needed for keyboard, mouse, ...)          [INPUT]
    <*/M>   Event interface                                        [INPUT_EVDEV]
```

*Kernel settings — for reference only, not commands. The generic kernel (Part 4) already includes them.* If you want to test this package with full coverage, the following options are needed as well:

```text
Device Drivers --->
  Input device support --->
    -*- Generic input layer (needed for keyboard, mouse, ...)            [INPUT]
    [*]   Miscellaneous devices --->                                [INPUT_MISC]
      <*/M>   User level driver support                           [INPUT_UINPUT]
```

**[BUILDER]** — Install libevdev by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                  \
      --prefix=$XORG_PREFIX     \
      --buildtype=release       \
      -D documentation=disabled \
      -D tests=disabled         &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libevdev-1.13.6.tar.xz | head -1 | cut -d/ -f1)"
```

#### Xorg Evdev Driver-2.11.0

*Build time:* less than 0.1 SBU · *Disk space:* 3.7 MB

**[BUILDER]** — Download and unpack (the folder name is read from the tarball):

```bash
cd ~/src
wget https://www.x.org/pub/individual/driver/xf86-input-evdev-2.11.0.tar.xz
md5sum xf86-input-evdev-2.11.0.tar.xz          # must print faa89be0ef86aebd6fd0a03eed23839c
tar -xf xf86-input-evdev-2.11.0.tar.xz
cd "$(tar -tf xf86-input-evdev-2.11.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**[BUILDER]** — Install Xorg Evdev Driver by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xf86-input-evdev-2.11.0.tar.xz | head -1 | cut -d/ -f1)"
```

#### libinput-1.31.3

*Build time:* 0.1 SBU (add 0.1 SBU for documentation and 0.3 SBU for minor tests) · *Disk space:* 15 MB (add 47 MB for documentation and tests)

**[BUILDER]** — Download and unpack (the folder name is read from the tarball):

```bash
cd ~/src
wget https://gitlab.freedesktop.org/libinput/libinput/-/archive/1.31.3/libinput-1.31.3.tar.gz
md5sum libinput-1.31.3.tar.gz          # must print 022aa3838b0cf8b932c0e4a4dbeac150
tar -xf libinput-1.31.3.tar.gz
cd "$(tar -tf libinput-1.31.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

*Kernel settings — for reference only, not commands. The generic kernel (Part 4) already includes them.* If you wish to run the standard test suite, enable the following option in the kernel configuration and recompile the kernel if necessary:

```text
Device Drivers --->
  Input device support --->
    -*- Generic input layer (needed for keyboard, mouse, ...)            [INPUT]
    [*]   Miscellaneous devices --->                                [INPUT_MISC]
      <*/M>   User level driver support                           [INPUT_UINPUT]
```

**[BUILDER]** — Install libinput by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..              \
      --prefix=$XORG_PREFIX \
      --buildtype=release   \
      -D debug-gui=false    \
      -D tests=false        \
      -D libwacom=false     \
      -D udev-dir=/usr/lib/udev &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have passed -D documentation=true to meson, you can install the generated documentation by running the following commands as the root user:

```bash
install -v -dm755      /usr/share/doc/libinput-1.31.3/html &&
cp -rv Documentation/* /usr/share/doc/libinput-1.31.3/html
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libinput-1.31.3.tar.gz | head -1 | cut -d/ -f1)"
```

#### Xorg Libinput Driver-1.5.0

*Build time:* less than 0.1 SBU (with tests) · *Disk space:* 3.9 MB (with tests)

**[BUILDER]** — Download and unpack (the folder name is read from the tarball):

```bash
cd ~/src
wget https://www.x.org/pub/individual/driver/xf86-input-libinput-1.5.0.tar.xz
md5sum xf86-input-libinput-1.5.0.tar.xz          # must print f8d0fb6987d843e688d597c2b66ec824
tar -xf xf86-input-libinput-1.5.0.tar.xz
cd "$(tar -tf xf86-input-libinput-1.5.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**[BUILDER]** — Install Xorg Libinput Driver by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xf86-input-libinput-1.5.0.tar.xz | head -1 | cut -d/ -f1)"
```

#### Xorg Synaptics Driver-1.10.0

*Build time:* less than 0.1 SBU · *Disk space:* 5.3 MB

**[BUILDER]** — Download and unpack (the folder name is read from the tarball):

```bash
cd ~/src
wget https://www.x.org/pub/individual/driver/xf86-input-synaptics-1.10.0.tar.xz
md5sum xf86-input-synaptics-1.10.0.tar.xz          # must print 017383c13a0d0f4cb320be477ab25513
tar -xf xf86-input-synaptics-1.10.0.tar.xz
cd "$(tar -tf xf86-input-synaptics-1.10.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**[BUILDER]** — Install Xorg Synaptics Driver by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xf86-input-synaptics-1.10.0.tar.xz | head -1 | cut -d/ -f1)"
```

#### Xorg Wacom Driver-1.2.4

*Build time:* less than 0.1 SBU (with tests) · *Disk space:* 6.4 MB (with tests)

**[BUILDER]** — Download and unpack (the folder name is read from the tarball):

```bash
cd ~/src
wget https://github.com/linuxwacom/xf86-input-wacom/releases/download/xf86-input-wacom-1.2.4/xf86-input-wacom-1.2.4.tar.bz2
md5sum xf86-input-wacom-1.2.4.tar.bz2          # must print e22300fe7cf162fa2b1a6e64ef7341f3
tar -xf xf86-input-wacom-1.2.4.tar.bz2
cd "$(tar -tf xf86-input-wacom-1.2.4.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

*Kernel settings — for reference only, not commands. The generic kernel (Part 4) already includes them.* To use a Wacom tablet with USB interface, enable the following options in your kernel configuration and recompile. Note that other configuration options could be required for tablet with a serial or bluetooth interface:

```text
Device Drivers --->
  [*] HID bus support --->                                         [HID_SUPPORT]
    {*/M} HID bus core support                                             [HID]
      Special HID drivers --->
      <*/M>   Wacom Intuos/Graphire tablet support (USB)             [HID_WACOM]
    USB HID support --->
      <*/M> USB HID transport layer                                    [USB_HID]
  [*] USB support --->                                             [USB_SUPPORT]
    <*/M> Support for Host-side USB                                        [USB]
```

**[BUILDER]** — Install Xorg Wacom Driver by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xf86-input-wacom-1.2.4.tar.bz2 | head -1 | cut -d/ -f1)"
```


### xinit-1.4.4

*BLFS 13.1 · ID `xinit` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 1.4 MB

**Requires:** `xorg7-lib`  
**Needed at runtime:** `twm`, `xclock`, `xterm2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/app/xinit-1.4.4.tar.xz
```

MD5 sum of `xinit-1.4.4.tar.xz`: `e7430a710261c9129b1280f26cb159a5` (check with `md5sum xinit-1.4.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xinit-1.4.4.tar.xz
cd "$(tar -tf xinit-1.4.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xinit by running the following commands:

```bash
./configure $XORG_CONFIG --with-xinitdir=/etc/X11/app-defaults &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
ldconfig
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xinit-1.4.4.tar.xz | head -1 | cut -d/ -f1)"
```


### Graphite2-1.3.14

*BLFS 13.1 · ID `graphite2` · Stage B* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 30 MB (with tests)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/silnrsi/graphite/releases/download/1.3.14/graphite2-1.3.14.tgz
```

MD5 sum of `graphite2-1.3.14.tgz`: `1bccb985a7da01092bfb53bb5041e836` (check with `md5sum graphite2-1.3.14.tgz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf graphite2-1.3.14.tgz
cd "$(tar -tf graphite2-1.3.14.tgz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Some tests fail if FontTools (Python 3 module) is not installed. These tests can be removed with:

```bash
sed -i '/cmptest/d' tests/CMakeLists.txt
```

**[BUILDER]** — Fix building this package with CMake 4.0 by updating its syntax to conform to newer versions of CMake:

```bash
sed -i '/cmake_policy(SET CMP0012 NEW)/d' CMakeLists.txt &&
sed -i 's/PythonInterp/Python3/' CMakeLists.txt          &&
find . -name CMakeLists.txt | xargs sed -i 's/VERSION 2.8.0 FATAL_ERROR/VERSION 4.0.0/'
```

**[BUILDER]** — Now fix a problem when building with gcc-15 or newer:

```bash
sed -i '/Font.h/i #include <cstdint>' tests/featuremap/featuremaptest.cpp
```

**[BUILDER]** — Install Graphite2 by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr .. &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you wish to build the documentation, issue:

```bash
make docs
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the documentation, install, as the root user:

```bash
install -v -d -m755 /usr/share/doc/graphite2-1.3.14 &&

cp      -v -f    doc/{GTF,manual}.html \
                    /usr/share/doc/graphite2-1.3.14 &&
cp      -v -f    doc/{GTF,manual}.pdf \
                    /usr/share/doc/graphite2-1.3.14
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf graphite2-1.3.14.tgz | head -1 | cut -d/ -f1)"
```


### harfBuzz-14.3.1

*BLFS 13.1 · ID `harfbuzz` · Stage B* · *Build time:* 0.9 SBU (with tests; both using parallelism=4) · *Disk space:* 179 MB (with tests)

**Recommended (included):** `freetype2`, `glib2`, `graphite2`, `icu`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/harfbuzz/harfbuzz/releases/download/14.3.1/harfbuzz-14.3.1.tar.xz
```

MD5 sum of `harfbuzz-14.3.1.tar.xz`: `4baccda978c92e5f27702ed8b3ceefa7` (check with `md5sum harfbuzz-14.3.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf harfbuzz-14.3.1.tar.xz
cd "$(tar -tf harfbuzz-14.3.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install HarfBuzz by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..             \
      --prefix=/usr        \
      --buildtype=release  \
      -D graphite2=enabled &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf harfbuzz-14.3.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libva-2.24.1

*BLFS 13.1 · ID `libva` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 4.6 MB

**Requires:** `libdrm`  
**Recommended (included):** `mesa`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/intel/libva/archive/2.24.1/libva-2.24.1.tar.gz
```

MD5 sum of `libva-2.24.1.tar.gz`: `6de86c7c9d47963108c52a51af9ac191` (check with `md5sum libva-2.24.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libva-2.24.1.tar.gz
cd "$(tar -tf libva-2.24.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libva by running the following commands:

```bash
cd build &&

meson setup --prefix=$XORG_PREFIX --buildtype=release &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libva-2.24.1.tar.gz | head -1 | cut -d/ -f1)"
```


### luit-20250912

*BLFS 13.1 · ID `luit` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 1.8 MB

**Requires:** `xorg7-app`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://invisible-mirror.net/archives/luit/luit-20250912.tgz
```

MD5 sum of `luit-20250912.tgz`: `d03e636d2f919bb21e77aec16a53247d` (check with `md5sum luit-20250912.tgz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf luit-20250912.tgz
cd "$(tar -tf luit-20250912.tgz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install luit by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf luit-20250912.tgz | head -1 | cut -d/ -f1)"
```


### twm-1.0.13.1

*BLFS 13.1 · ID `twm` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 3.8 MB

**Requires:** `xorg-server`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/app/twm-1.0.13.1.tar.xz
```

MD5 sum of `twm-1.0.13.1.tar.xz`: `2a337b776c904eab5b874eddc0124d4f` (check with `md5sum twm-1.0.13.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf twm-1.0.13.1.tar.xz
cd "$(tar -tf twm-1.0.13.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install twm by running the following commands:

```bash
sed -i -e '/^rcdir =/s,^\(rcdir = \).*,\1/etc/X11/app-defaults,' src/Makefile.in &&
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf twm-1.0.13.1.tar.xz | head -1 | cut -d/ -f1)"
```


### xclock-1.2.1

*BLFS 13.1 · ID `xclock` · Stage B* · *Build time:* less than 0.1 SBU · *Disk space:* 2.0 MB

**Requires:** `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.x.org/pub/individual/app/xclock-1.2.1.tar.xz
```

MD5 sum of `xclock-1.2.1.tar.xz`: `73ae5b4b4b839e13891f9c7d6970b150` (check with `md5sum xclock-1.2.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xclock-1.2.1.tar.xz
cd "$(tar -tf xclock-1.2.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xclock by running the following commands:

```bash
./configure $XORG_CONFIG &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xclock-1.2.1.tar.xz | head -1 | cut -d/ -f1)"
```


### xterm-411

*BLFS 13.1 · ID `xterm2` · Stage B* · *Build time:* 0.2 SBU (with parallelism=4) · *Disk space:* 15 MB

**Requires:** `luit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://invisible-mirror.net/archives/xterm/xterm-411.tgz
```

MD5 sum of `xterm-411.tgz`: `08193f9b11db32c37aad00be4e386933` (check with `md5sum xterm-411.tgz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xterm-411.tgz
cd "$(tar -tf xterm-411.tgz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xterm by running the following commands:

```bash
sed -i '/v0/{n;s/new:/new:kb=^?:/}' termcap &&
printf '\tkbs=\\177,\n' >> terminfo &&

TERMINFO=/usr/share/terminfo \
./configure $XORG_CONFIG     \
            --with-app-defaults=/etc/X11/app-defaults &&

make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&

mkdir -pv /usr/share/applications &&
cp -v *.desktop /usr/share/applications/
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — In order for xterm to follow the locale settings in the environment, use TrueType fonts, and follow the Linux convention about the code sent by the Backspace key, add the following definitions as the root user:

```bash
cat >> /etc/X11/app-defaults/XTerm << "EOF"
*VT100*locale: true
*VT100*faceName: Monospace
*VT100*faceSize: 10
*backarrowKeyIsErase: true
*ptyInitialErase: true
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xterm-411.tgz | head -1 | cut -d/ -f1)"
```



> **Checkpoint:** `glxinfo` isn't installed, so check Mesa with `ls /usr/lib/dri/ /usr/lib/gbm/ 2>/dev/null` and `pkg-config --modversion gl`. Take snapshot **`B-graphics`**.

**[DEBIAN ROOT]** — snapshot `B-graphics`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-B-graphics.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-B-graphics.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 6 — Stage C: Audio

Sound for every edition: ALSA, PipeWire and WirePlumber, plus GStreamer and the media libraries the apps use.

**35 packages, in build order:** alsa-lib-1.2.16.1, alsa-utils-1.2.16, alsa-plugins-1.2.12, Cairo-1.18.4, FriBidi-1.0.16, Pango-1.58.2, Graphviz-15.1.1, Vala-0.56.19, libical-4.0.5, BlueZ-5.87, CDParanoia-III-10.2, gstreamer-1.28.6, ISO Codes-4.20.1, libgudev-238, NASM-3.02, yasm-1.3.0, libjpeg-turbo-3.2.0, libogg-1.3.6, libvorbis-1.3.7, gst-plugins-base-1.28.6, FLAC-1.5.0, Opus-1.6.1, libsndfile-1.2.2, Class::Inspector-1.36, File::ShareDir::Install-0.14, File::ShareDir-1.118, XML::Parser-2.59, Speex-1.2.1, PulseAudio-17.0, SBC-2.2, GLU-9.0.3, v4l-utils-1.32.0, Pipewire-1.6.8, Lua-5.4.8, Wireplumber-0.5.15.

### alsa-lib-1.2.16.1

*BLFS 13.1 · ID `alsa-lib` · Stage C* · *Build time:* 0.3 SBU (with tests and docs) · *Disk space:* 82 MB (with tests and docs)

**Needed at runtime:** `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.alsa-project.org/files/pub/lib/alsa-lib-1.2.16.1.tar.bz2
wget https://www.alsa-project.org/files/pub/lib/alsa-ucm-conf-1.2.16.1.tar.bz2
```

MD5 sum of `alsa-lib-1.2.16.1.tar.bz2`: `c14c9f94f78f76924c13668954997a33` (check with `md5sum alsa-lib-1.2.16.1.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf alsa-lib-1.2.16.1.tar.bz2
cd "$(tar -tf alsa-lib-1.2.16.1.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install ALSA Library by running the following commands:

```bash
./configure &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Doxygen installed and you wish to build the library API documentation, run the following commands from the top-level directory of the source tree:

```bash
make doc
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user, install the package and recommended configuration files:

```bash
make install &&
tar -C /usr/share/alsa --strip-components=1 -xf ../alsa-ucm-conf-1.2.16.1.tar.bz2
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* To install the API documentation, run the following command as the root user:

```bash
install -v -d -m755 /usr/share/doc/alsa-lib-1.2.16.1/html/search &&
install -v -m644 doc/doxygen/html/*.* \
                /usr/share/doc/alsa-lib-1.2.16.1/html &&
install -v -m644 doc/doxygen/html/search/* \
                /usr/share/doc/alsa-lib-1.2.16.1/html/search
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf alsa-lib-1.2.16.1.tar.bz2 | head -1 | cut -d/ -f1)"
```


### alsa-utils-1.2.16

*BLFS 13.1 · ID `alsa-utils` · Stage C* · *Build time:* 0.2 SBU · *Disk space:* 22 MB

**Requires:** `alsa-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.alsa-project.org/files/pub/utils/alsa-utils-1.2.16.tar.bz2
```

MD5 sum of `alsa-utils-1.2.16.tar.bz2`: `570a1627d47b70ad683ef9f2429ddfca` (check with `md5sum alsa-utils-1.2.16.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf alsa-utils-1.2.16.tar.bz2
cd "$(tar -tf alsa-utils-1.2.16.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install ALSA Utilities by running the following commands:

```bash
./configure --disable-alsaconf \
            --disable-bat      \
            --disable-xmlto    \
            --with-curses=ncursesw &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* As the root user, apply the default setting for the sound card. Note that this command may return an exit code of 99 although the card is correctly initialized:

```bash
alsactl init
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The alsactl program is normally run from a standard udev rule. The first time it is run, it will complain that there is no state in /var/lib/alsa/asound.state. You can prevent this by running the following command as the root user:

```bash
alsactl -L store
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* On systems which have multiple sound cards, you may need to adjust the default audio device so that you can get output from your speakers. To set the default device, first check the /proc/asound/cards file to determine which number you need to set. After…

```bash
cat > /etc/asound.conf << "EOF"
# Begin /etc/asound.conf

defaults.pcm.card 1
defaults.ctl.card 1

# End /etc/asound.conf
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf alsa-utils-1.2.16.tar.bz2 | head -1 | cut -d/ -f1)"
```


### alsa-plugins-1.2.12

*BLFS 13.1 · ID `alsa-plugins` · Stage C* · *Build time:* less than 0.1 SBU · *Disk space:* 5.1 MB

**Requires:** `alsa-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.alsa-project.org/files/pub/plugins/alsa-plugins-1.2.12.tar.bz2
wget https://www.linuxfromscratch.org/patches/blfs/13.1/alsa-plugins-1.2.12-ffmpeg-9.0.patch
```

MD5 sum of `alsa-plugins-1.2.12.tar.bz2`: `71fce75baa38efab4e32e40db0a33716` (check with `md5sum alsa-plugins-1.2.12.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf alsa-plugins-1.2.12.tar.bz2
cd "$(tar -tf alsa-plugins-1.2.12.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Fix building this package with ffmpeg-9:

```bash
patch -Np1 -i ../alsa-plugins-1.2.12-ffmpeg-9.0.patch
```

**[BUILDER]** — Install ALSA Plugins by running the following commands:

```bash
./configure --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf alsa-plugins-1.2.12.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Cairo-1.18.4

*BLFS 13.1 · ID `cairo` · Stage C* · *Build time:* 0.2 SBU (Using parallelism=4) · *Disk space:* 95 MB

**Requires:** `libpng`, `pixman`  
**Recommended (included):** `fontconfig`, `glib2`, `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.cairographics.org/releases/cairo-1.18.4.tar.xz
```

MD5 sum of `cairo-1.18.4.tar.xz`: `db575fb41bbda127e0147e401f36f8ac` (check with `md5sum cairo-1.18.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cairo-1.18.4.tar.xz
cd "$(tar -tf cairo-1.18.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Cairo by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cairo-1.18.4.tar.xz | head -1 | cut -d/ -f1)"
```


### FriBidi-1.0.16

*BLFS 13.1 · ID `fribidi` · Stage C* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 22 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/fribidi/fribidi/releases/download/v1.0.16/fribidi-1.0.16.tar.xz
```

MD5 sum of `fribidi-1.0.16.tar.xz`: `333ad150991097a627755b752b87f9ff` (check with `md5sum fribidi-1.0.16.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf fribidi-1.0.16.tar.xz
cd "$(tar -tf fribidi-1.0.16.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install FriBidi by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf fribidi-1.0.16.tar.xz | head -1 | cut -d/ -f1)"
```


### Pango-1.58.2

*BLFS 13.1 · ID `pango` · Stage C* · *Build time:* less than 0.1 SBU (Using parallelism=4; with tests) · *Disk space:* 59 MB (with tests)

**Requires:** `fontconfig`, `freetype2`, `harfbuzz`, `fribidi`, `glib2`  
**Recommended (included):** `cairo`, `harfbuzz`, `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/pango/1.58/pango-1.58.2.tar.xz
```

MD5 sum of `pango-1.58.2.tar.xz`: `7b5640fd9adfa24554a88b2b9a6cd3f3` (check with `md5sum pango-1.58.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pango-1.58.2.tar.xz
cd "$(tar -tf pango-1.58.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Pango by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr            \
            --buildtype=release      \
            --wrap-mode=nofallback   \
            -D introspection=enabled \
            ..                       &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have docutils-0.23 installed and wish to build the manual pages for the installed programs, issue:

```bash
meson configure -D man-pages=true &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed "/docs_dir =/s@\$@ / 'pango-1.58.2'@" -i ../docs/meson.build &&
meson configure -D documentation=true                            &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pango-1.58.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Graphviz-15.1.1

*BLFS 13.1 · ID `graphviz` · Stage C* · *Build time:* 0.3 SBU (using parallelism=4) · *Disk space:* 198 MB (6.8 MB installed)

**Requires:** `cmake`  
**Recommended (included):** `pango`, `cairo`, `xorg7-lib`, `fontconfig`, `libpng`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.com/graphviz/graphviz/-/archive/15.1.1/graphviz-15.1.1.tar.bz2
```

MD5 sum of `graphviz-15.1.1.tar.bz2`: `ec7f236467bcaeb57b69601d4913c5b7` (check with `md5sum graphviz-15.1.1.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf graphviz-15.1.1.tar.bz2
cd "$(tar -tf graphviz-15.1.1.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Now prevent hard coding library search paths (rpath) into the shared libraries. The libraries do not need the rpath for an installation into the standard location, and rpath may sometimes cause unwanted effects or even security issues. We cannot use -D…

```bash
sed '/ORIGIN/d' -i lib/CMakeLists.txt
```

**[BUILDER]** — Install Graphviz by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      ..                           &&

sed -i '/GZIP/s/:.*$/=/' CMakeCache.txt &&

make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf graphviz-15.1.1.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Vala-0.56.19

*BLFS 13.1 · ID `vala` · Stage C* · *Build time:* 0.4 SBU (add 0.9 SBU for tests; both using parallelism=4) · *Disk space:* 160 MB (add 16 MB for tests)

**Requires:** `glib2`  
**Recommended (included):** `graphviz`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/vala/0.56/vala-0.56.19.tar.xz
```

MD5 sum of `vala-0.56.19.tar.xz`: `a2dc825de503fad703584cfb0ed50302` (check with `md5sum vala-0.56.19.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf vala-0.56.19.tar.xz
cd "$(tar -tf vala-0.56.19.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Vala by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf vala-0.56.19.tar.xz | head -1 | cut -d/ -f1)"
```


### libical-4.0.5

*BLFS 13.1 · ID `libical` · Stage C* · *Build time:* 0.4 SBU (using parallelism=4; with tests and docs) · *Disk space:* 171 MB (with tests and docs)

**Requires:** `cmake`  
**Recommended (included):** `glib2`, `libxml2`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libical/libical/releases/download/v4.0.5/libical-4.0.5.tar.gz
```

MD5 sum of `libical-4.0.5.tar.gz`: `9896781cc82bad3b9a2c6c1ee8177347` (check with `md5sum libical-4.0.5.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libical-4.0.5.tar.gz
cd "$(tar -tf libical-4.0.5.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package may occasionally fail when building with multiple processors. See parallel-builds for more information.

**[BUILDER]** — Install libical by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr  \
      -D CMAKE_BUILD_TYPE=Release   \
      -D LIBICAL_STATIC=NO          \
      -D LIBICAL_BUILD_DOCS=false   \
      -D LIBICAL_GLIB_VAPI=true     \
      -D LIBICAL_JAVA_BINDINGS=OFF  \
      -D LIBICAL_GOBJECT_INTROSPECTION=true \
      .. &&
make -j1
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Doxygen-1.18.0, Graphviz-15.1.1, and GTK-Doc-1.36.1 installed and wish to build the API documentation, you should remove the -D LIBICAL_BUILD_DOCS=false switch and issue:

```bash
make docs
```

**[BUILDER]** — *(Optional — skip if unsure)* If you wish to run the tests, issue:

```bash
cmake .. -D LIBICAL_BUILD_TESTING=ON &&
make &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have built the API documentation, install by issuing, as root user:

```bash
install -vdm755 /usr/share/doc/libical-4.0.5/html &&
cp -vr apidocs/html/* /usr/share/doc/libical-4.0.5/html
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libical-4.0.5.tar.gz | head -1 | cut -d/ -f1)"
```


### BlueZ-5.87

*BLFS 13.1 · ID `bluez` · Stage C* · *Build time:* 0.8 SBU (using parallelism=4; with tests) · *Disk space:* 146 MB (with tests)

**Requires:** `glib2`, `libical`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.kernel.org/pub/linux/bluetooth/bluez-5.87.tar.xz
```

MD5 sum of `bluez-5.87.tar.xz`: `6c6f8445ec3d2fa3cc570a671ccea9fa` (check with `md5sum bluez-5.87.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf bluez-5.87.tar.xz
cd "$(tar -tf bluez-5.87.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install BlueZ by running the following commands:

```bash
./configure --prefix=/usr         \
            --sysconfdir=/etc     \
            --localstatedir=/var  \
            --enable-library      &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
ln -svf ../libexec/bluetooth/bluetoothd /usr/sbin
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the main configuration file as the root user:

```bash
install -v -dm555 /etc/bluetooth &&
install -v -m644 src/main.conf /etc/bluetooth/main.conf
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If desired, install the API documentation as the root user:

```bash
install -v -dm755 /usr/share/doc/bluez-5.87 &&
install -v -m644 doc/*.txt /usr/share/doc/bluez-5.87
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — /etc/bluetooth/main.conf is installed automatically during the installation. Additionally, there are two supplementary configuration files. You can optionally install the following files as the root user:

```bash
cat > /etc/bluetooth/rfcomm.conf << "EOF"
# Start rfcomm.conf
# Set up the RFCOMM configuration of the Bluetooth subsystem in the Linux kernel.
# Use one line per command
# See the rfcomm man page for options


# End of rfcomm.conf
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
cat > /etc/bluetooth/uart.conf << "EOF"
# Start uart.conf
# Attach serial devices via UART HCI to BlueZ stack
# Use one line per device
# See the hciattach man page for options

# End of uart.conf
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To start the bluetoothd daemon at boot, enable the previously installed systemd unit by running the following command as the root user:

```bash
systemctl enable bluetooth
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To start the obexd daemon for a user session (to support some Bluetooth programs using it), enable the previously installed systemd unit for all users by running the following command as the root user:

```bash
systemctl enable --global obex
```

> **Side note (BLFS):** Systemd will start the Bluetooth daemon only when a bluetooth device is detected on the system.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf bluez-5.87.tar.xz | head -1 | cut -d/ -f1)"
```


### CDParanoia-III-10.2

*BLFS 13.1 · ID `cdparanoia` · Stage C* · *Build time:* less than 0.1 SBU · *Disk space:* 2.9 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.xiph.org/releases/cdparanoia/cdparanoia-III-10.2.src.tgz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/cdparanoia-III-10.2-gcc_fixes-1.patch
```

MD5 sum of `cdparanoia-III-10.2.src.tgz`: `b304bbe8ab63373924a744eac9ebc652` (check with `md5sum cdparanoia-III-10.2.src.tgz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cdparanoia-III-10.2.src.tgz
cd "$(tar -tf cdparanoia-III-10.2.src.tgz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package does not support parallel build.

**[BUILDER]** — Install CDParanoia by running the following commands:

```bash
patch -Np1 -i ../cdparanoia-III-10.2-gcc_fixes-1.patch &&
./configure --prefix=/usr --mandir=/usr/share/man &&
make -j1
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
chmod -v 755 /usr/lib/libcdda_*.so.0.10.2 &&
rm -fv /usr/lib/libcdda_*.a
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cdparanoia-III-10.2.src.tgz | head -1 | cut -d/ -f1)"
```


### gstreamer-1.28.6

*BLFS 13.1 · ID `gstreamer10` · Stage C* · *Build time:* 0.3 SBU (Using parallelism=4; with tests) · *Disk space:* 73 MB (with tests)

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gstreamer.freedesktop.org/src/gstreamer/gstreamer-1.28.6.tar.xz
```

MD5 sum of `gstreamer-1.28.6.tar.xz`: `3d16d7912727ea85ab90b9e5f3bc6e8a` (check with `md5sum gstreamer-1.28.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gstreamer-1.28.6.tar.xz
cd "$(tar -tf gstreamer-1.28.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install gstreamer by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D gst_debug=false  &&
ninja
```

> **Warning (BLFS):** If you are reinstalling gstreamer from a previous version, it is best if you remove the prior version, including plugins, before installing the new version. If there is a mixture of versions installed, using processes may hang or not work properly. As the root user:

**[BUILDER]** — *(Optional — skip if unsure)* If you are reinstalling gstreamer from a previous version, it is best if you remove the prior version, including plugins, before installing the new version. If there is a mixture of versions installed, using processes may hang or not work properly. As the…

```bash
rm -rf /usr/bin/gst-* /usr/{lib,libexec}/gstreamer-1.0
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gstreamer-1.28.6.tar.xz | head -1 | cut -d/ -f1)"
```


### ISO Codes-4.20.1

*BLFS 13.1 · ID `iso-codes` · Stage C* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 114 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://salsa.debian.org/iso-codes-team/iso-codes/-/archive/v4.20.1/iso-codes-v4.20.1.tar.gz
```

MD5 sum of `iso-codes-v4.20.1.tar.gz`: `a8f16a62662ec13e55ca255a7c036ee3` (check with `md5sum iso-codes-v4.20.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf iso-codes-v4.20.1.tar.gz
cd "$(tar -tf iso-codes-v4.20.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install ISO Codes by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf iso-codes-v4.20.1.tar.gz | head -1 | cut -d/ -f1)"
```


### libgudev-238

*BLFS 13.1 · ID `libgudev` · Stage C* · *Build time:* less than 0.1 SBU · *Disk space:* 2.0 MB

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libgudev/238/libgudev-238.tar.xz
```

MD5 sum of `libgudev-238.tar.xz`: `46da30a1c69101c3a13fa660d9ab7b73` (check with `md5sum libgudev-238.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libgudev-238.tar.xz
cd "$(tar -tf libgudev-238.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libgudev by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libgudev-238.tar.xz | head -1 | cut -d/ -f1)"
```


### NASM-3.02

*BLFS 13.1 · ID `nasm` · Stage C* · *Build time:* 0.2 SBU · *Disk space:* 72 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.nasm.us/pub/nasm/releasebuilds/3.02/nasm-3.02.tar.xz
wget https://www.nasm.us/pub/nasm/releasebuilds/3.02/nasm-3.02-xdoc.tar.xz
```

MD5 sum of `nasm-3.02.tar.xz`: `31ba022fff8de3065b5bc5ad5559188c` (check with `md5sum nasm-3.02.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf nasm-3.02.tar.xz
cd "$(tar -tf nasm-3.02.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* If you downloaded the optional documentation, put it into the source tree:

```bash
tar -xf ../nasm-3.02-xdoc.tar.xz --strip-components=1
```

**[BUILDER]** — Install NASM by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you downloaded the optional documentation, install it with the following instructions as the root user:

```bash
install -m755 -d         /usr/share/doc/nasm-3.02/html  &&
cp -v doc/html/*.html    /usr/share/doc/nasm-3.02/html  &&
cp -v doc/*.{txt,ps,pdf} /usr/share/doc/nasm-3.02
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf nasm-3.02.tar.xz | head -1 | cut -d/ -f1)"
```


### yasm-1.3.0

*BLFS 13.1 · ID `yasm` · Stage C* · *Build time:* 0.1 SBU (additional 0.1 SBU for the tests) · *Disk space:* 27 MB (additional 12 MB for the tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.tortall.net/projects/yasm/releases/yasm-1.3.0.tar.gz
```

MD5 sum of `yasm-1.3.0.tar.gz`: `fc9e586751ff789b34b1f21d572d96af` (check with `md5sum yasm-1.3.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf yasm-1.3.0.tar.gz
cd "$(tar -tf yasm-1.3.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a problem when building with gcc-15:

```bash
sed -e 's/def __cplusplus/ defined(__cplusplus) || __STDC_VERSION__ >= 202311L/' \
    -i libyasm/bitvect.h
```

**[BUILDER]** — Install yasm by running the following commands:

```bash
sed -i 's#) ytasm.*#)#' Makefile.in &&

./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf yasm-1.3.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libjpeg-turbo-3.2.0

*BLFS 13.1 · ID `libjpeg` · Stage C* · *Build time:* 0.6 SBU (with tests; both using parallelism=4) · *Disk space:* 59 MB (with tests)

**Requires:** `cmake`  
**Recommended (included):** `nasm`, `yasm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.2.0/libjpeg-turbo-3.2.0.tar.gz
```

MD5 sum of `libjpeg-turbo-3.2.0.tar.gz`: `a80f9f1c735b57d3cdd66daed1ba6bb4` (check with `md5sum libjpeg-turbo-3.2.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libjpeg-turbo-3.2.0.tar.gz
cd "$(tar -tf libjpeg-turbo-3.2.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libjpeg-turbo by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr        \
      -D CMAKE_BUILD_TYPE=RELEASE         \
      -D ENABLE_STATIC=FALSE              \
      -D CMAKE_INSTALL_DEFAULT_LIBDIR=lib \
      -D CMAKE_SKIP_INSTALL_RPATH=ON      \
      -D CMAKE_INSTALL_DOCDIR=/usr/share/doc/libjpeg-turbo-3.2.0 \
      .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libjpeg-turbo-3.2.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libogg-1.3.6

*BLFS 13.1 · ID `libogg` · Stage C* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 3.5 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.xiph.org/releases/ogg/libogg-1.3.6.tar.xz
```

MD5 sum of `libogg-1.3.6.tar.xz`: `529275432dff072f63d4ed0f1f961384` (check with `md5sum libogg-1.3.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libogg-1.3.6.tar.xz
cd "$(tar -tf libogg-1.3.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libogg by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/libogg-1.3.6 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libogg-1.3.6.tar.xz | head -1 | cut -d/ -f1)"
```


### libvorbis-1.3.7

*BLFS 13.1 · ID `libvorbis` · Stage C* · *Build time:* 0.1 SBU · *Disk space:* 15 MB

**Requires:** `libogg`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.xiph.org/releases/vorbis/libvorbis-1.3.7.tar.xz
```

MD5 sum of `libvorbis-1.3.7.tar.xz`: `50902641d358135f06a8392e61c9ac77` (check with `md5sum libvorbis-1.3.7.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libvorbis-1.3.7.tar.xz
cd "$(tar -tf libvorbis-1.3.7.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libvorbis by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m644 doc/Vorbis* /usr/share/doc/libvorbis-1.3.7
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libvorbis-1.3.7.tar.xz | head -1 | cut -d/ -f1)"
```


### gst-plugins-base-1.28.6

*BLFS 13.1 · ID `gst10-plugins-base` · Stage C* · *Build time:* 0.9 SBU (Using parallelism=4; with tests) · *Disk space:* 122 MB (with tests)

**Requires:** `gstreamer10`  
**Recommended (included):** `alsa-lib`, `cdparanoia`, `glib2`, `iso-codes`, `libgudev`, `libjpeg`, `libogg`, `libpng`, `libvorbis`, `mesa`, `pango`, `wayland-protocols`, `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gstreamer.freedesktop.org/src/gst-plugins-base/gst-plugins-base-1.28.6.tar.xz
```

MD5 sum of `gst-plugins-base-1.28.6.tar.xz`: `cd0b2bd13e8196d5bfb20459c12a5d9b` (check with `md5sum gst-plugins-base-1.28.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gst-plugins-base-1.28.6.tar.xz
cd "$(tar -tf gst-plugins-base-1.28.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** If you need a plugin for a given dependency, that dependency needs to be installed before this package.

**[BUILDER]** — Install GStreamer Base Plug-ins by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..               \
      --prefix=/usr          \
      --buildtype=release    \
      --wrap-mode=nodownload &&
ninja
```

> **Side note (BLFS):** When installing, the build process does some additional linking. If you do not have Xorg in /usr, the LIBRARY_PATH variable needs to be defined for the root user. If using sudo to assume root, use the -E option to pass your current environment variables for the install process.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gst-plugins-base-1.28.6.tar.xz | head -1 | cut -d/ -f1)"
```


### FLAC-1.5.0

*BLFS 13.1 · ID `flac` · Stage C* · *Build time:* 0.2 SBU (additional 0.2 SBU to run the test suite) · *Disk space:* 25 MB (additional 170 MB to run the test suite)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/xiph/flac/releases/download/1.5.0/flac-1.5.0.tar.xz
```

MD5 sum of `flac-1.5.0.tar.xz`: `0bb45bcf74338b00efeec121fff27367` (check with `md5sum flac-1.5.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf flac-1.5.0.tar.xz
cd "$(tar -tf flac-1.5.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install FLAC by running the following commands:

```bash
./configure --prefix=/usr            \
            --disable-thorough-tests \
            --docdir=/usr/share/doc/flac-1.5.0 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf flac-1.5.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Opus-1.6.1

*BLFS 13.1 · ID `opus` · Stage C* · *Build time:* 0.5 SBU (with tests) · *Disk space:* 41 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.xiph.org/releases/opus/opus-1.6.1.tar.gz
```

MD5 sum of `opus-1.6.1.tar.gz`: `67cafc438c430aa74eeb605eef670886` (check with `md5sum opus-1.6.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf opus-1.6.1.tar.gz
cd "$(tar -tf opus-1.6.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Opus by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr        \
            --buildtype=release  \
            -D docdir=/usr/share/doc/opus-1.6.1 &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf opus-1.6.1.tar.gz | head -1 | cut -d/ -f1)"
```


### libsndfile-1.2.2

*BLFS 13.1 · ID `libsndfile` · Stage C* · *Build time:* 0.3 SBU (add 0.3 SBU for tests) · *Disk space:* 12 MB (add 10 MB for tests)

**Recommended (included):** `flac`, `opus`, `libvorbis`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libsndfile/libsndfile/releases/download/1.2.2/libsndfile-1.2.2.tar.xz
```

MD5 sum of `libsndfile-1.2.2.tar.xz`: `04e2e6f726da7c5dc87f8cf72f250d04` (check with `md5sum libsndfile-1.2.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libsndfile-1.2.2.tar.xz
cd "$(tar -tf libsndfile-1.2.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Fix building with GCC-15:

```bash
sed -i '/typedef enum/,/bool ;/d' src/ALAC/alac_{en,de}coder.c
```

**[BUILDER]** — Install libsndfile by running the following commands:

```bash
./configure --prefix=/usr    \
            --docdir=/usr/share/doc/libsndfile-1.2.2 &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If running the test suite, disable the Opus tests which would fail with the recent Opus release and cause the test suite to bail out early:

```bash
sed '/ogg_opus/,+1s/HAVE_[A-Z_]*/0/' -i tests/lossy_comp_test.c
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libsndfile-1.2.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Class::Inspector-1.36

*BLFS 13.1 · ID `perl-class-inspector` · Stage C*

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://cpan.metacpan.org/authors/id/P/PL/PLICEASE/Class-Inspector-1.36.tar.gz
```

MD5 sum of `Class-Inspector-1.36.tar.gz`: `084c3aeec023639d21ecbaf7d4460b21` (check with `md5sum Class-Inspector-1.36.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf Class-Inspector-1.36.tar.gz
cd "$(tar -tf Class-Inspector-1.36.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — This module uses the standard build and installation instructions: perl Makefile.PL && make && make test Now, as the root user: make install

```bash
perl Makefile.PL &&
make             &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf Class-Inspector-1.36.tar.gz | head -1 | cut -d/ -f1)"
```


### File::ShareDir::Install-0.14

*BLFS 13.1 · ID `perl-file-sharedir-install` · Stage C*

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://cpan.metacpan.org/authors/id/E/ET/ETHER/File-ShareDir-Install-0.14.tar.gz
```

MD5 sum of `File-ShareDir-Install-0.14.tar.gz`: `bac4d924f3d863b00648ab56ec0dcbdc` (check with `md5sum File-ShareDir-Install-0.14.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf File-ShareDir-Install-0.14.tar.gz
cd "$(tar -tf File-ShareDir-Install-0.14.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — This module uses the standard build and installation instructions: perl Makefile.PL && make && make test Now, as the root user: make install

```bash
perl Makefile.PL &&
make             &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf File-ShareDir-Install-0.14.tar.gz | head -1 | cut -d/ -f1)"
```


### File::ShareDir-1.118

*BLFS 13.1 · ID `perl-file-sharedir` · Stage C*

**Requires:** `perl-class-inspector`, `perl-file-sharedir-install`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://cpan.metacpan.org/authors/id/R/RE/REHSACK/File-ShareDir-1.118.tar.gz
```

MD5 sum of `File-ShareDir-1.118.tar.gz`: `0084f730f4e3d4d89703d92b3ea82f54` (check with `md5sum File-ShareDir-1.118.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf File-ShareDir-1.118.tar.gz
cd "$(tar -tf File-ShareDir-1.118.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — This module uses the standard build and installation instructions: perl Makefile.PL && make && make test Now, as the root user: make install

```bash
perl Makefile.PL &&
make             &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf File-ShareDir-1.118.tar.gz | head -1 | cut -d/ -f1)"
```


### XML::Parser-2.59

*BLFS 13.1 · ID `perl-xml-parser` · Stage C*

**Requires:** `perl-file-sharedir`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.cpan.org/authors/id/T/TO/TODDR/XML-Parser-2.59.tar.gz
```

MD5 sum of `XML-Parser-2.59.tar.gz`: `f483e6b8541d60a84e4bf50803e476bc` (check with `md5sum XML-Parser-2.59.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf XML-Parser-2.59.tar.gz
cd "$(tar -tf XML-Parser-2.59.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — This module uses the standard build and installation instructions: perl Makefile.PL && make && make test Now, as the root user: make install

```bash
perl Makefile.PL &&
make             &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf XML-Parser-2.59.tar.gz | head -1 | cut -d/ -f1)"
```


### Speex-1.2.1

*BLFS 13.1 · ID `speex` · Stage C* · *Build time:* less than 0.1 SBU · *Disk space:* 7.8 MB

**Requires:** `libogg`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.xiph.org/releases/speex/speex-1.2.1.tar.gz
wget https://downloads.xiph.org/releases/speex/speexdsp-1.2.1.tar.gz
```

MD5 sum of `speex-1.2.1.tar.gz`: `fe7bf610883ff202092b92c72fe0fe3e` (check with `md5sum speex-1.2.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf speex-1.2.1.tar.gz
cd "$(tar -tf speex-1.2.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** This section builds **two** packages, Speex and then SpeexDSP: each has its own `make install`, in its own folder (`/build/src/speex-1.2.1`, then `/build/src/speexdsp-1.2.1`). Clean up both: `cd ~/src && rm -rf speex-1.2.1 speexdsp-1.2.1`.

**Build and install:**

**[BUILDER]** — Install Speex by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/speex-1.2.1 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user:

```bash
make install
```

**[BUILDER]** — Now extract and install the speexdsp package:

```bash
cd ..                          &&
tar -xf speexdsp-1.2.1.tar.gz &&
cd speexdsp-1.2.1             &&

./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/speexdsp-1.2.1 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Again, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf speex-1.2.1.tar.gz | head -1 | cut -d/ -f1)"
```


### PulseAudio-17.0

*BLFS 13.1 · ID `pulseaudio` · Stage C* · *Build time:* 0.2 SBU (Using parallelism=4; add 0.2 SBU for tests) · *Disk space:* 42 MB (with tests)

**Requires:** `libsndfile`  
**Recommended (included):** `alsa-lib`, `glib2`, `speex`, `perl-xml-parser`, `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.freedesktop.org/software/pulseaudio/releases/pulseaudio-17.0.tar.xz
```

MD5 sum of `pulseaudio-17.0.tar.xz`: `c4a3596a26ff4b9dcd0c394dd1d4f8ee` (check with `md5sum pulseaudio-17.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pulseaudio-17.0.tar.xz
cd "$(tar -tf pulseaudio-17.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** If you intend to use Pipewire-1.6.8 as the sound system instead of PulseAudio, you can pass the -D daemon=false option to only build the support libraries of this package. If so, those libraries will require Wireplumber-0.5.15 installed and pipewire-pulse.socket enabled to be really functional.

**[BUILDER]** — Install PulseAudio by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            -D database=gdbm    \
            -D doxygen=false    \
            -D bluez5=disabled  \
            -D tests=false      \
            ..                  &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Running PulseAudio as a system-wide daemon is possible but not recommended. See for more information. While still as the root user, remove the D-Bus configuration file for the system wide daemon to avoid creating unnecessary system users and groups:

```bash
rm /usr/share/dbus-1/system.d/pulseaudio-system.conf
```

> **Side note (BLFS):** If you have installed Wireplumber-0.5.15, make sure to follow the commands to disable the Pulseaudio server to prevent conflicts with Pipewire.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pulseaudio-17.0.tar.xz | head -1 | cut -d/ -f1)"
```


### SBC-2.2

*BLFS 13.1 · ID `sbc` · Stage C* · *Build time:* less than 0.1 SBU · *Disk space:* 3.2 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.kernel.org/pub/linux/bluetooth/sbc-2.2.tar.xz
```

MD5 sum of `sbc-2.2.tar.xz`: `f3f1a4e69249241801bc8ddd6050de23` (check with `md5sum sbc-2.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf sbc-2.2.tar.xz
cd "$(tar -tf sbc-2.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install SBC by running the following commands:

```bash
./configure --prefix=/usr --disable-static --disable-tester &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf sbc-2.2.tar.xz | head -1 | cut -d/ -f1)"
```


### GLU-9.0.3

*BLFS 13.1 · ID `glu` · Stage C* · *Build time:* 0.2 SBU · *Disk space:* 5.9 MB

**Requires:** `mesa`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.mesa3d.org/glu/glu-9.0.3.tar.xz
```

MD5 sum of `glu-9.0.3.tar.xz`: `06a4fff9179a98ea32ef41b6d83f6b19` (check with `md5sum glu-9.0.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glu-9.0.3.tar.xz
cd "$(tar -tf glu-9.0.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GLU by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..              \
      --prefix=$XORG_PREFIX \
      --buildtype=release   \
      -D gl_provider=gl     \
      --default-library=shared &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glu-9.0.3.tar.xz | head -1 | cut -d/ -f1)"
```


### v4l-utils-1.32.0

*BLFS 13.1 · ID `v4l-utils` · Stage C* · *Build time:* 0.3 SBU (using parallelism=4) · *Disk space:* 37 MB

**Recommended (included):** `alsa-lib`, `glu`, `libjpeg`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.linuxtv.org/downloads/v4l-utils/v4l-utils-1.32.0.tar.xz
```

MD5 sum of `v4l-utils-1.32.0.tar.xz`: `c484b0320a757bd08a785cad7b32147a` (check with `md5sum v4l-utils-1.32.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf v4l-utils-1.32.0.tar.xz
cd "$(tar -tf v4l-utils-1.32.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** If you've installed both LLVM and libbpf (not in BLFS), either enable the BPF target (via -D LLVM_TARGETS_TO_BUILD=) when building LLVM, or disable the infrared remote control decoders based on BPF:

**[BUILDER]** — *(Optional — skip if unsure)* If you've installed both LLVM and libbpf (not in BLFS), either enable the BPF target (via -D LLVM_TARGETS_TO_BUILD=) when building LLVM, or disable the infrared remote control decoders based on BPF:

```bash
sed -i '/^ir_bpf_enabled/s/=.*/= false/' utils/keytable/meson.build
```

**[BUILDER]** — Install v4l-utils by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D gconv=disabled   \
      -D doxygen-doc=disabled &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If you also wish to install the contrib programs, add:

```bash
for prog in v4l2gl v4l2grab
do
   cp -v contrib/test/$prog /usr/bin
done
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf v4l-utils-1.32.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Pipewire-1.6.8

*BLFS 13.1 · ID `pipewire` · Stage C* · *Build time:* 0.7 SBU (with tests, both using parallelism=4) · *Disk space:* 110 MB (with tests)

**Recommended (included):** `bluez`, `gstreamer10`, `gst10-plugins-base`, `pulseaudio`, `sbc`, `v4l-utils`  
**Needed at runtime:** `wireplumber`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/pipewire/pipewire/-/archive/1.6.8/pipewire-1.6.8.tar.bz2
```

MD5 sum of `pipewire-1.6.8.tar.bz2`: `9ae75812a76951c93210a26272c90ef3` (check with `md5sum pipewire-1.6.8.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pipewire-1.6.8.tar.bz2
cd "$(tar -tf pipewire-1.6.8.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install pipewire by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                 \
      --prefix=/usr            \
      --buildtype=release      \
      -D session-managers="[]" &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pipewire-1.6.8.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Lua-5.4.8

*BLFS 13.1 · ID `lua` · Stage C* · *Build time:* less than 0.1 SBU (with Basic tests) · *Disk space:* 3.7 MB (with Basic tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.lua.org/ftp/lua-5.4.8.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/lua-5.4.8-shared_library-1.patch
wget https://www.lua.org/tests/lua-5.4.8-tests.tar.gz
```

MD5 sum of `lua-5.4.8.tar.gz`: `81cf5265b8634967d8a7480d238168ce` (check with `md5sum lua-5.4.8.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lua-5.4.8.tar.gz
cd "$(tar -tf lua-5.4.8.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Some packages check for the pkg-config file for Lua, which is created with:

```bash
cat > lua.pc << "EOF"
V=5.4
R=5.4.8

prefix=/usr
INSTALL_BIN=${prefix}/bin
INSTALL_INC=${prefix}/include
INSTALL_LIB=${prefix}/lib
INSTALL_MAN=${prefix}/share/man/man1
INSTALL_LMOD=${prefix}/share/lua/${V}
INSTALL_CMOD=${prefix}/lib/lua/${V}
exec_prefix=${prefix}
libdir=${exec_prefix}/lib
includedir=${prefix}/include

Name: Lua
Description: An Extensible Extension Language
Version: ${R}
Requires:
Libs: -L${libdir} -llua -lm -ldl
Cflags: -I${includedir}
EOF
```

**[BUILDER]** — Install Lua by running the following commands:

```bash
patch -Np1 -i ../lua-5.4.8-shared_library-1.patch &&
make linux
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make INSTALL_TOP=/usr                \
     INSTALL_DATA="cp -d"            \
     INSTALL_MAN=/usr/share/man/man1 \
     TO_LIB="liblua.so liblua.so.5.4 liblua.so.5.4.8" \
     install &&

mkdir -pv                      /usr/share/doc/lua-5.4.8 &&
cp -v doc/*.{html,css,gif,png} /usr/share/doc/lua-5.4.8 &&

install -v -m644 -D lua.pc /usr/lib/pkgconfig/lua.pc
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lua-5.4.8.tar.gz | head -1 | cut -d/ -f1)"
```


### Wireplumber-0.5.15

*BLFS 13.1 · ID `wireplumber` · Stage C* · *Build time:* 0.3 SBU (with tests) · *Disk space:* 100 MB (with tests)

**Requires:** `glib2`, `pipewire`  
**Recommended (included):** `lua`  
**Needed at runtime:** `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/pipewire/wireplumber/-/archive/0.5.15/wireplumber-0.5.15.tar.bz2
```

MD5 sum of `wireplumber-0.5.15.tar.bz2`: `dba978afa67ba317d99ef03285ad4733` (check with `md5sum wireplumber-0.5.15.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf wireplumber-0.5.15.tar.bz2
cd "$(tar -tf wireplumber-0.5.15.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Wireplumber by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release -D system-lua=true .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Finally, rename the documentation directory to a versioned directory as the root user:

```bash
mv -v /usr/share/doc/wireplumber{,-0.5.15}
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Pipewire now provides it's own Pulseaudio server implementation, which causes runtime conflicts with the server provided by Pulseaudio itself. This generally presents itself by applications hanging or malfunctioning when trying to play or record audio and…

```bash
rm -vf /etc/xdg/autostart/pulseaudio.desktop         &&
rm -vf /etc/xdg/Xwayland-session.d/00-pulseaudio-x11 &&
sed -e '$a autospawn = no' -i /etc/pulse/client.conf
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Next, configure Wireplumber to start when a desktop environment is started. Run the following commands as the root user to enable the systemd user units:

```bash
systemctl enable --global pipewire.socket       &&
systemctl enable --global pipewire-pulse.socket &&
systemctl enable --global wireplumber
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf wireplumber-0.5.15.tar.bz2 | head -1 | cut -d/ -f1)"
```



> **Side note:** PipeWire replaces the PulseAudio *daemon* while keeping PulseAudio's library, which Firefox and the Xfce volume plugin use. Each user's PipeWire starts automatically with their desktop session.

> **Checkpoint:** Take snapshot **`C-audio`**.

**[DEBIAN ROOT]** — snapshot `C-audio`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-C-audio.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-C-audio.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 7 — Stage D: Networking, Wireless and Bluetooth

Wired, **wireless** and Bluetooth networking with NetworkManager, wpa_supplicant, iw and BlueZ.

**12 packages, in build order:** iptables-1.8.13, libndp-1.9, slang-2.3.3, newt-0.52.25, NSPR-4.40, NSS-3.126, PyCairo-1.29.1, PyGObject-3.56.3, NetworkManager-1.58.1, libnl-3.12.0, wpa_supplicant-2.12, iw-6.17.

### iptables-1.8.13

*BLFS 13.1 · ID `iptables` · Stage D* · *Build time:* 0.1 SBU · *Disk space:* 16 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.netfilter.org/projects/iptables/files/iptables-1.8.13.tar.xz
```

MD5 sum of `iptables-1.8.13.tar.xz`: `81b5edf500e2672bfbc744581ff7dc3e` (check with `md5sum iptables-1.8.13.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf iptables-1.8.13.tar.xz
cd "$(tar -tf iptables-1.8.13.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS:** install the unit, but don't write the firewall script or enable `iptables` yet. The firewall policy is decided at release time (Part 13).

**Build and install:**

**[BUILDER]** — Install iptables by running the following commands:

```bash
./configure --prefix=/usr      \
            --disable-nftables \
            --enable-libipq    &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

> **Side note (BLFS):** In the following example configurations, LAN1 is used for the internal LAN interface, and WAN1 is used for the external interface connected to the Internet. You will need to replace these values with appropriate interface names for your system.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Below is a slightly modified version of Rusty Russell's recommendation from the Linux 2.4 Packet Filtering HOWTO. It is still applicable to the Linux 6.x kernels.

```bash
install -v -dm755 /etc/systemd/scripts

cat > /etc/systemd/scripts/iptables << "EOF"
#!/bin/sh

# Begin /etc/systemd/scripts/iptables

# Insert connection-tracking modules
# (not needed if built into the kernel)
modprobe nf_conntrack
modprobe xt_LOG

# Enable broadcast echo Protection
echo 1 > /proc/sys/net/ipv4/icmp_echo_ignore_broadcasts

# Disable Source Routed Packets
echo 0 > /proc/sys/net/ipv4/conf/all/accept_source_route
echo 0 > /proc/sys/net/ipv4/conf/default/accept_source_route

# Enable TCP SYN Cookie Protection
echo 1 > /proc/sys/net/ipv4/tcp_syncookies

# Disable ICMP Redirect Acceptance
echo 0 > /proc/sys/net/ipv4/conf/default/accept_redirects

# Do not send Redirect Messages
echo 0 > /proc/sys/net/ipv4/conf/all/send_redirects
echo 0 > /proc/sys/net/ipv4/conf/default/send_redirects

# Drop Spoofed Packets coming in on an interface, where responses
# would result in the reply going out a different interface.
echo 1 > /proc/sys/net/ipv4/conf/all/rp_filter
echo 1 > /proc/sys/net/ipv4/conf/default/rp_filter

# Log packets with impossible addresses.
echo 1 > /proc/sys/net/ipv4/conf/all/log_martians
echo 1 > /proc/sys/net/ipv4/conf/default/log_martians

# be verbose on dynamic ip-addresses  (not needed in case of static IP)
echo 2 > /proc/sys/net/ipv4/ip_dynaddr

# disable Explicit Congestion Notification
# too many routers are still ignorant
echo 0 > /proc/sys/net/ipv4/tcp_ecn

# Set a known state
iptables -P INPUT   DROP
iptables -P FORWARD DROP
iptables -P OUTPUT  DROP

# These lines are here in case rules are already in place and the
# script is ever rerun on the fly. We want to remove all rules and
# pre-existing user defined chains before we implement new rules.
iptables -F
iptables -X
iptables -Z

iptables -t nat -F

# Allow local-only connections
iptables -A INPUT  -i lo -j ACCEPT

# Free output on any interface to any ip for any service
# (equal to -P ACCEPT)
iptables -A OUTPUT -j ACCEPT

# Permit answers on already established connections
# and permit new connections related to established ones
# (e.g. port mode ftp)
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Log everything else.
iptables -A INPUT -j LOG --log-prefix "FIREWALL:INPUT "

# End /etc/systemd/scripts/iptables
EOF
chmod 700 /etc/systemd/scripts/iptables
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — A Network Firewall has two interfaces, one connected to an intranet, in this example LAN1, and one connected to the Internet, here WAN1. To provide the maximum security for the firewall itself, make sure that there are no unnecessary servers running on it…

```bash
install -v -dm755 /etc/systemd/scripts

cat > /etc/systemd/scripts/iptables << "EOF"
#!/bin/sh

# Begin /etc/systemd/scripts/iptables

echo
echo "You're using the example configuration for a setup of a firewall"
echo "from Beyond Linux From Scratch."
echo "This example is far from being complete, it is only meant"
echo "to be a reference."
echo "Firewall security is a complex issue, that exceeds the scope"
echo "of the configuration rules below."

echo "You can find additional information"
echo "about firewalls in Chapter 4 of the BLFS book."
echo "https://www.linuxfromscratch.org/blfs"
echo

# Insert iptables modules (not needed if built into the kernel).

modprobe nf_conntrack
modprobe nf_conntrack_ftp
modprobe xt_conntrack
modprobe xt_LOG
modprobe xt_state

# Enable broadcast echo Protection
echo 1 > /proc/sys/net/ipv4/icmp_echo_ignore_broadcasts

# Disable Source Routed Packets
echo 0 > /proc/sys/net/ipv4/conf/all/accept_source_route

# Enable TCP SYN Cookie Protection
echo 1 > /proc/sys/net/ipv4/tcp_syncookies

# Disable ICMP Redirect Acceptance
echo 0 > /proc/sys/net/ipv4/conf/all/accept_redirects

# Don't send Redirect Messages
echo 0 > /proc/sys/net/ipv4/conf/default/send_redirects

# Drop Spoofed Packets coming in on an interface where responses
# would result in the reply going out a different interface.
echo 1 > /proc/sys/net/ipv4/conf/default/rp_filter

# Log packets with impossible addresses.
echo 1 > /proc/sys/net/ipv4/conf/all/log_martians

# Be verbose on dynamic ip-addresses  (not needed in case of static IP)
echo 2 > /proc/sys/net/ipv4/ip_dynaddr

# Disable Explicit Congestion Notification
# Too many routers are still ignorant
echo 0 > /proc/sys/net/ipv4/tcp_ecn

# Set a known state
iptables -P INPUT   DROP
iptables -P FORWARD DROP
iptables -P OUTPUT  DROP

# These lines are here in case rules are already in place and the
# script is ever rerun on the fly. We want to remove all rules and
# pre-existing user defined chains before we implement new rules.
iptables -F
iptables -X
iptables -Z

iptables -t nat -F

# Allow local connections
iptables -A INPUT  -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow forwarding if the initiated on the intranet
iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD ! -i WAN1 -m conntrack --ctstate NEW       -j ACCEPT

# Do masquerading
# (not needed if intranet is not using private ip-addresses)
iptables -t nat -A POSTROUTING -o WAN1 -j MASQUERADE

# Log everything for debugging
# (last of all rules, but before policy rules)
iptables -A INPUT   -j LOG --log-prefix "FIREWALL:INPUT "
iptables -A FORWARD -j LOG --log-prefix "FIREWALL:FORWARD "
iptables -A OUTPUT  -j LOG --log-prefix "FIREWALL:OUTPUT "

# Enable IP Forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# The following sections allow inbound packets for specific examples
# Uncomment the example lines and adjust as necessary

# Allow ping on the external interface
#iptables -A INPUT  -p icmp -m icmp --icmp-type echo-request -j ACCEPT
#iptables -A OUTPUT -p icmp -m icmp --icmp-type echo-reply   -j ACCEPT

# Reject ident packets with TCP reset to avoid delays with FTP or IRC
#iptables -A INPUT  -p tcp --dport 113 -j REJECT --reject-with tcp-reset

# Allow HTTP and HTTPS to 192.168.0.2
#iptables -A PREROUTING -t nat -i WAN1 -p tcp --dport 80 -j DNAT --to 192.168.0.2
#iptables -A PREROUTING -t nat -i WAN1 -p tcp --dport 443 -j DNAT --to 192.168.0.2
#iptables -A FORWARD -p tcp -d 192.168.0.2 --dport 80 -j ACCEPT
#iptables -A FORWARD -p tcp -d 192.168.0.2 --dport 443 -j ACCEPT

# End /etc/systemd/scripts/iptables
EOF
chmod 700 /etc/systemd/scripts/iptables
```

> **Side note (BLFS):** Outlining specifically how to protect a server that offers services on the Internet goes far beyond the scope of this document. See the references in fw-extra-info for more information.

*Example only — don't run:* If you want to add services such as internal Samba or name servers that do not need to access the Internet themselves, the additional statements are quite simple and should still be acceptable from a security standpoint. Just add the following lines into…

```text
iptables -A INPUT  -i ! WAN1  -j ACCEPT
iptables -A OUTPUT -o ! WAN1  -j ACCEPT
```

*Example only — don't run:* If daemons, such as squid, have to access the Internet themselves, you could open OUTPUT generally and restrict INPUT.

```text
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -j ACCEPT
```

*Example only — don't run:* To accomplish this, you should restrict INPUT and OUTPUT on all ports except those that it's absolutely necessary to have open. Which ports you have to open depends on your needs: mostly you will find them by looking for failed accesses in your log files.

```text
iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT  -p tcp --sport 80 -m conntrack --ctstate ESTABLISHED \
  -j ACCEPT
```

*Example only — don't run:* expected output or file contents

```text
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
```

*Example only — don't run:* expected output or file contents

```text
iptables -A INPUT  -p icmp -m icmp --icmp-type echo-request -j ACCEPT
iptables -A OUTPUT -p icmp -m icmp --icmp-type echo-reply   -j ACCEPT
```

*Example only — don't run:* expected output or file contents

```text
iptables -A INPUT  -p tcp --dport 113 -j REJECT --reject-with tcp-reset
```

*Example only — don't run:* expected output or file contents

```text
iptables -I INPUT 0 -p tcp -m conntrack --ctstate INVALID \
  -j LOG --log-prefix "FIREWALL:INVALID "
iptables -I INPUT 1 -p tcp -m conntrack --ctstate INVALID -j DROP
```

*Example only — don't run:* expected output or file contents

```text
iptables -A INPUT -i WAN1 -s 10.0.0.0/8     -j DROP
iptables -A INPUT -i WAN1 -s 172.16.0.0/12  -j DROP
iptables -A INPUT -i WAN1 -s 192.168.0.0/16 -j DROP
```

*Example only — don't run:* expected output or file contents

```text
iptables -A INPUT  -i WAN1 -p udp -s 0.0.0.0 --sport 67 \
   -d 255.255.255.255 --dport 68 -j ACCEPT
```

*Example only — don't run:* expected output or file contents

```text
iptables -A INPUT -j REJECT
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To set up the iptables firewall at boot, install the iptables.service unit included in the BLFS Systemd Units package.

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-iptables
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf iptables-1.8.13.tar.xz | head -1 | cut -d/ -f1)"
```


### libndp-1.9

*BLFS 13.1 · ID `libndp` · Stage D* · *Build time:* less than 0.1 SBU · *Disk space:* 2.5 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget http://libndp.org/files/libndp-1.9.tar.gz
```

MD5 sum of `libndp-1.9.tar.gz`: `9d486750569e7025e5d0afdcc509b93c` (check with `md5sum libndp-1.9.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libndp-1.9.tar.gz
cd "$(tar -tf libndp-1.9.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libndp by running the following command:

```bash
./configure --prefix=/usr        \
            --sysconfdir=/etc    \
            --localstatedir=/var \
            --disable-static     &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libndp-1.9.tar.gz | head -1 | cut -d/ -f1)"
```


### slang-2.3.3

*BLFS 13.1 · ID `slang` · Stage D* · *Build time:* 0.4 SBU (add 0.5 SBU for tests) · *Disk space:* 22 MB (add 15 MB for tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.jedsoft.org/releases/slang/slang-2.3.3.tar.bz2
```

MD5 sum of `slang-2.3.3.tar.bz2`: `69015c8300088373eb65ffcc6ed4db8c` (check with `md5sum slang-2.3.3.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf slang-2.3.3.tar.bz2
cd "$(tar -tf slang-2.3.3.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package does not support parallel build.

**[BUILDER]** — Install slang by running the following commands:

```bash
./configure --prefix=/usr       \
            --sysconfdir=/etc   \
            --with-readline=gnu &&
make -j1 RPATH=
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install_doc_dir=/usr/share/doc/slang-2.3.3   \
     SLSH_DOC_DIR=/usr/share/doc/slang-2.3.3/slsh \
     RPATH= install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf slang-2.3.3.tar.bz2 | head -1 | cut -d/ -f1)"
```


### newt-0.52.25

*BLFS 13.1 · ID `newt` · Stage D* · *Build time:* less than 0.1 SBU · *Disk space:* 3.0 MB

**Requires:** `popt`, `slang`

**[BUILDER]** — Download:

```bash
cd ~/src
wget -O newt-0.52.25.tar.gz https://deb.debian.org/debian/pool/main/n/newt/newt_0.52.25.orig.tar.xz
```

MD5 sum of `newt-0.52.25.tar.gz`: `4857119244d34d18c67c5c6d6e2d746c` (check with `md5sum newt-0.52.25.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf newt-0.52.25.tar.gz
cd "$(tar -tf newt-0.52.25.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS fixes.** newt's pagure.io download is gone; this uses Debian's copy of the same release (it's xz-compressed inside, which `tar` detects automatically, so the MD5 differs from the book). `--with-gpm-support` is removed because GPM isn't part of IPRPS OS.

**Build and install:**

**[BUILDER]** — Install newt by running the following command:

```bash
sed -e '/install -m 644 $(LIBNEWT)/ s/^/#/' \
    -e '/$(LIBNEWT):/,/rv/ s/^/#/'          \
    -e 's/$(LIBNEWT)/$(LIBNEWTSH)/g'        \
    -i Makefile.in                          &&

./configure --prefix=/usr      &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf newt-0.52.25.tar.gz | head -1 | cut -d/ -f1)"
```


### NSPR-4.40

*BLFS 13.1 · ID `nspr` · Stage D* · *Build time:* less than 0.1 SBU · *Disk space:* 11 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.mozilla.org/pub/nspr/releases/v4.40/src/nspr-4.40.tar.gz
```

MD5 sum of `nspr-4.40.tar.gz`: `0c3c871158cc9af694f1f7d2b799ffd8` (check with `md5sum nspr-4.40.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf nspr-4.40.tar.gz
cd "$(tar -tf nspr-4.40.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install NSPR by running the following commands:

```bash
cd nspr &&

sed -i '/^RELEASE/s|^|#|' pr/src/misc/Makefile.in &&
sed -i 's|$(LIBRARY) ||'  config/rules.mk         &&

./configure --prefix=/usr   \
            --with-mozilla  \
            --with-pthreads \
            $([ $(uname -m) = x86_64 ] && echo --enable-64bit) &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf nspr-4.40.tar.gz | head -1 | cut -d/ -f1)"
```


### NSS-3.126

*BLFS 13.1 · ID `nss` · Stage D* · *Build time:* 0.8 SBU (with parallelism=4, add 8.4 SBU for tests) · *Disk space:* 406 MB (with tests)

**Requires:** `nspr`  
**Needed at runtime:** `p11-kit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.mozilla.org/pub/security/nss/releases/NSS_3_126_RTM/src/nss-3.126.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/nss-standalone-1.patch
```

MD5 sum of `nss-3.126.tar.gz`: `0ca322cec564a53ac5a59ce130d96f46` (check with `md5sum nss-3.126.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf nss-3.126.tar.gz
cd "$(tar -tf nss-3.126.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install NSS by running the following commands:

```bash
patch -Np1 -i ../nss-standalone-1.patch &&

cd nss &&

make BUILD_OPT=1                      \
  NSPR_INCLUDE_DIR=/usr/include/nspr  \
  USE_SYSTEM_ZLIB=1                   \
  ZLIB_LIBS=-lz                       \
  NSS_ENABLE_WERROR=0                 \
  NSS_USE_SYSTEM_SQLITE=1             \
  $([ $(uname -m) = x86_64 ] && echo USE_64=1)
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
cd ../dist                                         &&

install -v -m755 Linux*/lib/*.so  /usr/lib         &&
install -v -m644 Linux*/lib/*.chk /usr/lib         &&

install -v -m755 -d               /usr/include/nss &&
cp -v -RL {public,private}/nss/*  /usr/include/nss &&

install -v -m755 Linux*/bin/{certutil,nss-config,pk12util} /usr/bin &&

install -v -m644 Linux*/lib/pkgconfig/nss.pc  /usr/lib/pkgconfig
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If p11-kit-0.26.5 is installed, the p11-kit trust module (/usr/lib/pkcs11/p11-kit-trust.so) can be used as a drop-in replacement for /usr/lib/libnssckbi.so to transparently make the system CAs available to NSS aware applications, rather than the static…

```bash
ln -sfv ./pkcs11/p11-kit-trust.so /usr/lib/libnssckbi.so
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf nss-3.126.tar.gz | head -1 | cut -d/ -f1)"
```


### PyCairo-1.29.1

*BLFS 13.1 · ID `pycairo` · Stage D* · *Build time:* less than 0.1 SBU · *Disk space:* 5.0 MB

**Requires:** `cairo`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/pygobject/pycairo/releases/download/v1.29.1/pycairo-1.29.1.tar.gz
```

MD5 sum of `pycairo-1.29.1.tar.gz`: `fc7c3b4104e88df7dea34af4314b9d12` (check with `md5sum pycairo-1.29.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pycairo-1.29.1.tar.gz
cd "$(tar -tf pycairo-1.29.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install PyCairo by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pycairo-1.29.1.tar.gz | head -1 | cut -d/ -f1)"
```


### PyGObject-3.56.3

*BLFS 13.1 · ID `pygobject3` · Stage D* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 15 MB (with tests)

**Requires:** `glib2`  
**Recommended (included):** `pycairo`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/pygobject/3.56/pygobject-3.56.3.tar.gz
```

MD5 sum of `pygobject-3.56.3.tar.gz`: `7fe8fa9ff801a010eca0f0c79f59232b` (check with `md5sum pygobject-3.56.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pygobject-3.56.3.tar.gz
cd "$(tar -tf pygobject-3.56.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, if you do not have GTK-4.22.4 installed, remove two tests:

```bash
mv -v tests/test_gdbus.py{,.nouse}         &&
mv -v tests/test_overrides_gtk.py{,.nouse}
```

**[BUILDER]** — Install pygobject3 by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pygobject-3.56.3.tar.gz | head -1 | cut -d/ -f1)"
```


### NetworkManager-1.58.1

*BLFS 13.1 · ID `NetworkManager` · Stage D* · *Build time:* 0.7 SBU (with tests, using parallelism=4) · *Disk space:* 327 MB (with tests and documentation)

**Requires:** `libndp`  
**Recommended (included):** `curl`, `glib2`, `iptables`, `libpsl`, `newt`, `nss`, `pygobject3`, `systemd`, `vala`  
**Needed at runtime:** `polkit`, `wpa_supplicant`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/NetworkManager/NetworkManager/-/releases/1.58.1/downloads/NetworkManager-1.58.1.tar.xz
```

MD5 sum of `NetworkManager-1.58.1.tar.xz`: `7b06b1dd7b56adffc1dbbf3d04bedf8e` (check with `md5sum NetworkManager-1.58.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf NetworkManager-1.58.1.tar.xz
cd "$(tar -tf NetworkManager-1.58.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Fix the python scripts so that they use Python 3:

```bash
grep -rl '^#!.*python$' | xargs sed -i '1s/python/&3/'
```

**[BUILDER]** — Install NetworkManager by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                    \
      --prefix=/usr               \
      --buildtype=release         \
      -D libaudit=no              \
      -D nmtui=true               \
      -D ovs=false                \
      -D ppp=false                \
      -D nbft=false               \
      -D selinux=false            \
      -D qt=false                 \
      -D session_tracking=systemd \
      -D nm_cloud_setup=false     \
      -D clat=false               \
      -D modem_manager=false      &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
rm -rf /usr/share/doc/NetworkManager-1.58.1 &&
mv -v /usr/share/doc/NetworkManager{,-1.58.1}
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have not passed the -D docs=true option to meson, you can install the pregenerated manual pages with (as the root user):

```bash
for file in $(echo ../man/*.[1578]); do
    section=${file##*.} &&
    install -vdm 755 /usr/share/man/man$section
    install -vm 644 $file /usr/share/man/man$section/
done
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have not used -D docs=true, the pregenerated HTML documentation can also be installed with (as the root user):

```bash
cp -Rv ../docs/{api,libnm} /usr/share/doc/NetworkManager-1.58.1
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For NetworkManager to work, at least a minimal configuration file must be present. Such a file is not installed with make install. Issue the following command as the root user to create a minimal NetworkManager.conf file:

```bash
cat >> /etc/NetworkManager/NetworkManager.conf << "EOF"
[main]
plugins=keyfile
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To allow polkit to manage authorizations, add the following configuration file:

```bash
cat > /etc/NetworkManager/conf.d/polkit.conf << "EOF"
[main]
auth-polkit=true
EOF
```

**[BUILDER]** — *(Optional — skip if unsure)* To prevent NetworkManager from updating the /etc/resolv.conf file, add the following configuration file:

```bash
cat > /etc/NetworkManager/conf.d/no-dns-update.conf << "EOF"
[main]
dns=none
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To allow regular users to configure network connections, you should add them to the netdev group, and create a polkit rule that grants access. Run the following commands as the root user:

```bash
groupadd -fg 86 netdev &&
/usr/sbin/usermod -a -G netdev <username>

cat > /usr/share/polkit-1/rules.d/org.freedesktop.NetworkManager.rules << "EOF"
polkit.addRule(function(action, subject) {
    if (action.id.indexOf("org.freedesktop.NetworkManager.") == 0 && subject.isInGroup("netdev")) {
        return polkit.Result.YES;
    }
});
EOF
```

> **Side note (BLFS):** If using Network Manager to manage an interface, any previous configuration for that interface should be removed, and the interface brought down prior to starting Network Manager.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To start the NetworkManager daemon at boot, enable the previously installed systemd unit by running the following command as the root user:

```bash
systemctl enable NetworkManager
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Starting in version 1.11.2 of NetworkManager, a systemd unit named NetworkManager-wait-online.service is enabled, which is used to prevent services that require network connectivity from starting until NetworkManager establishes a connection. To disable…

```bash
systemctl disable NetworkManager-wait-online
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf NetworkManager-1.58.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libnl-3.12.0

*BLFS 13.1 · ID `libnl` · Stage D* · *Build time:* 0.2 SBU (with API documentation) · *Disk space:* 32 MB (with API documentation)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/thom311/libnl/releases/download/libnl3_12_0/libnl-3.12.0.tar.gz
```

MD5 sum of `libnl-3.12.0.tar.gz`: `f9112ca215807fe65eecd583d8f180cc` (check with `md5sum libnl-3.12.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libnl-3.12.0.tar.gz
cd "$(tar -tf libnl-3.12.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libnl by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --disable-static  &&
make
```

> **Side note (BLFS):** If the make command was executed with multiple parallel jobs enabled, it might disrupt the terminal mode and cause some amusing visual effects. In the worst case, this issue may cause keyboard inputs not displayed on the screen at all (but you can still run any command if you can type it correctly). Run the reset command to fix such an issue.

*Kernel settings — for reference only, not commands. The generic kernel (Part 4) already includes them.* If you wish to run the tests, check that the following options are enabled in the kernel configuration and recompile the kernel if necessary. Some of them may not be strictly needed, but they should support a complete test coverage.

```text
General setup --->
  -*- Namespaces support --->                                       [NAMESPACES]
    [*] User namespace                                                 [USER_NS]
    [*] Network namespace                                               [NET_NS]

[*] Networking support --->                                                [NET]
  Networking options --->
    [*]   TCP/IP networking                                               [INET]
    [*]     IP: advanced router                             [IP_ADVANCED_ROUTER]
    [*]       IP: policy routing                            [IP_MULTIPLE_TABLES]
    <*/M>   IP: tunneling                                             [NET_IPIP]
    <*/M>   IP: GRE demultiplexer                              [NET_IPGRE_DEMUX]
    <*/M>   IP: GRE tunnels over IP                                  [NET_IPGRE]
    <*/M>   Virtual (secure) IP: tunneling                           [NET_IPVTI]
    <*>     The IPv6 protocol --->                                        [IPV6]
      <*/M>   IPv6: IPv6-in-IPv4 tunnel (SIT driver)                  [IPV6_SIT]
      <*/M>   IPv6: IP-in-IPv6 tunnel (RFC2473)                    [IPV6_TUNNEL]
      [*]     IPv6: Multiple Routing Tables               [IPV6_MULTIPLE_TABLES]
    [*]   Network packet filtering framework (Netfilter) --->        [NETFILTER]
      Core Netfilter Configuration --->
        <*/M> Netfilter nf_tables support                            [NF_TABLES]
        [*]     Netfilter nf_tables netdev tables support     [NF_TABLES_NETDEV]
        {*/M}   Netfilter packet duplication support             [NF_DUP_NETDEV]
        <*/M>   Netfilter nf_tables netdev packet forwarding support
                                                           ...  [NFT_FWD_NETDEV]
    <*/M> 802.1d Ethernet Bridging                                      [BRIDGE]
    <*/M> 802.1Q/802.1ad VLAN Support                               [VLAN_8021Q]
    -*-   L3 Master device support                           [NET_L3_MASTER_DEV]

Device Drivers --->
  [*] Network device support --->                                   [NETDEVICES]
    [*]   Network core driver support                                 [NET_CORE]
    <*/M>   Bonding driver support                                     [BONDING]
    <*/M>   Dummy net driver support                                     [DUMMY]
    <*/M>   Intermediate Functional Block support                          [IFB]
    <*/M>   MAC-VLAN support                                           [MACVLAN]
    <*/M>     MAC-VLAN based tap driver                                [MACVTAP]
    <*/M>   IP-VLAN support                                             [IPVLAN]
    <*/M>   Virtual eXtensible Local Area Network (VXLAN)                [VXLAN]
    <*/M>   IEEE 802.1AE MAC-level encryption (MACsec)                  [MACSEC]
    <*/M>   Virtual ethernet pair device                                  [VETH]
    <*/M>   Virtual Routing and Forwarding (Lite)                      [NET_VRF]
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you wish to install the API documentation, as the root user:

```bash
mkdir -vp /usr/share/doc/libnl-3.12.0 &&
tar -xf ../libnl-doc-3.12.0.tar.gz --strip-components=1 --no-same-owner \
    -C  /usr/share/doc/libnl-3.12.0
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libnl-3.12.0.tar.gz | head -1 | cut -d/ -f1)"
```


### wpa_supplicant-2.12

*BLFS 13.1 · ID `wpa_supplicant` · Stage D* · *Build time:* 0.3 SBU · *Disk space:* 46 MB

**Recommended (included):** `libnl`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://w1.fi/releases/wpa_supplicant-2.12.tar.gz
```

MD5 sum of `wpa_supplicant-2.12.tar.gz`: `3f1af56655ebca941d2035358331bbc9` (check with `md5sum wpa_supplicant-2.12.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf wpa_supplicant-2.12.tar.gz
cd "$(tar -tf wpa_supplicant-2.12.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS change.** Don't enable `wpa_supplicant@wlan0`. NetworkManager (Stage D) manages Wi-Fi and starts wpa_supplicant when needed. If you enabled it already: `systemctl disable wpa_supplicant@wlan0.service` in IPRPS CHROOT.

> **Warning:** **IPRPS check: Wi-Fi drivers and D-Bus.** Write the **whole** `.config` from this section (all the `CONFIG_...=y` lines, including `CONFIG_DRIVER_NL80211=y`, `CONFIG_LIBNL32=y` and `CONFIG_CTRL_IFACE_DBUS_NEW=y`), not only the D-Bus lines: without the others, wpa_supplicant builds but says **"No drivers enabled"** and Wi-Fi stays greyed out. Before `make install`, check: `./wpa_supplicant -h | grep -A4 '^drivers:'` lists `nl80211` and `wext`, and `ldd wpa_supplicant | grep -c libnl` prints `2` or more. If not, fix `.config`, run `make clean`, and build again.

**Build and install:**

**[BUILDER]** — First you will need to create an initial configuration file for the build process. You can read wpa_supplicant/README and wpa_supplicant/defconfig for the explanation of the following options as well as other options that can be used. Create a build…

```bash
cat > wpa_supplicant/.config << "EOF"
CONFIG_BACKEND=file
CONFIG_CTRL_IFACE=y
CONFIG_DEBUG_FILE=y
CONFIG_DEBUG_SYSLOG=y
CONFIG_DEBUG_SYSLOG_FACILITY=LOG_DAEMON
CONFIG_DRIVER_NL80211=y
CONFIG_DRIVER_WEXT=y
CONFIG_DRIVER_WIRED=y
CONFIG_EAP_GTC=y
CONFIG_EAP_LEAP=y
CONFIG_EAP_MD5=y
CONFIG_EAP_MSCHAPV2=y
CONFIG_EAP_OTP=y
CONFIG_EAP_PEAP=y
CONFIG_EAP_TLS=y
CONFIG_EAP_TTLS=y
CONFIG_IEEE8021X_EAPOL=y
CONFIG_IPV6=y
CONFIG_LIBNL32=y
CONFIG_PEERKEY=y
CONFIG_PKCS12=y
CONFIG_READLINE=y
CONFIG_SMARTCARD=y
CONFIG_WPS=y
CFLAGS += -I/usr/include/libnl3
EOF
```

**[BUILDER]** — *(IPRPS: **required**)* If you wish to use WPA Supplicant with NetworkManager-1.58.1, WPA Supplicant build configuration file by running the following command:

```bash
cat >> wpa_supplicant/.config << "EOF"
CONFIG_CTRL_IFACE_DBUS=y
CONFIG_CTRL_IFACE_DBUS_NEW=y
CONFIG_CTRL_IFACE_DBUS_INTRO=y
EOF
```

**[BUILDER]** — Install WPA Supplicant by running the following commands:

```bash
cd wpa_supplicant &&
make BINDIR=/usr/sbin LIBDIR=/usr/lib
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
install -v -m755 wpa_{cli,passphrase,supplicant} /usr/sbin/ &&
install -v -m644 doc/docbook/wpa_supplicant.conf.5 /usr/share/man/man5/ &&
install -v -m644 doc/docbook/wpa_{cli,passphrase,supplicant}.8 /usr/share/man/man8/
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the systemd support files by running the following command as the root user:

```bash
install -v -m644 systemd/*.service /usr/lib/systemd/system/
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(IPRPS: **required**)* If you have built WPA Supplicant with D-Bus support, you will need to install D-Bus configuration files. Install them by running the following commands as the root user:

```bash
install -v -m644 dbus/fi.w1.wpa_supplicant1.service \
                 /usr/share/dbus-1/system-services/ &&
install -v -d -m755 /etc/dbus-1/system.d &&
install -v -m644 dbus/dbus-wpa_supplicant.conf \
                 /etc/dbus-1/system.d/wpa_supplicant.conf
```

> **Side note (BLFS):** You will need to restart the system D-Bus daemon before you can use the WPA Supplicant D-Bus interface.

**Configure:**

> **Warning (BLFS):** If you are using WPA Supplicant with NetworkManager-1.58.1 (or anything communicating with WPA Supplicant via D-Bus), this section should be skipped. Running a D-Bus connected WPA Supplicant instance and another WPA supplicant instance configured following this section simultaneously can cause subtle issues.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* To connect to an access point that uses a password, you need to put the pre-shared key in /etc/wpa_supplicant/wpa_supplicant-wifi0.conf. SSID is the string that the access point/router transmits to identify itself. Run the following command as the root user:

```bash
install -v -dm755 /etc/wpa_supplicant &&
wpa_passphrase SSID | sed '/^\t#/d' > /etc/wpa_supplicant/wpa_supplicant-wifi0.conf
```

*Example only — don't run:* If you want to connect to an access point that isn't password protected, put an entry like this in /etc/wpa_supplicant/wpa_supplicant-wifi0.conf. Replace "Some-SSID" with the SSID of the access point/router.

```text
network={
  ssid="Some-SSID"
  key_mgmt=NONE
}
```

*Example only — don't run:* Connecting to a new access point that is not in the configuration file can be accomplished manually via the command line, but it must be done via a privileged user. To do that, add the following to the configuration file:

```text
ctrl_interface=DIR=/run/wpa_supplicant GROUP=<privileged group>
update_config=1
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — You can connect to the wireless access point by running the following command as the root user:

```bash
# systemctl start wpa_supplicant@wlan0
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To connect to the wireless access point at boot, simply enable the appropriate wpa_supplicant service by running the following command as the root user:

```bash
# IPRPS: don't enable this. NetworkManager starts wpa_supplicant itself;
# an enabled per-interface unit makes every boot wait 90 s for wlan0.
# systemctl enable wpa_supplicant@wlan0
```

> **Side note (BLFS):** Ensure that the systemd-networkd service is enabled so that the system can reach the internet.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf wpa_supplicant-2.12.tar.gz | head -1 | cut -d/ -f1)"
```


### iw-6.17

*BLFS 13.1 · ID `iw` · Stage D* · *Build time:* less than 0.1 SBU · *Disk space:* 4.0 MB

**Requires:** `libnl`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.kernel.org/pub/software/network/iw/iw-6.17.tar.xz
```

MD5 sum of `iw-6.17.tar.xz`: `7323e43843f30068ffb6079e15e8e11a` (check with `md5sum iw-6.17.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf iw-6.17.tar.xz
cd "$(tar -tf iw-6.17.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — To install iw, use the following commands:

```bash
sed -i "/INSTALL.*gz/s/.gz//" Makefile &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf iw-6.17.tar.xz | head -1 | cut -d/ -f1)"
```



### Switch from systemd-networkd to NetworkManager

The LFS system uses systemd-networkd. The desktop editions use **NetworkManager**, which handles Wi-Fi and has the panel applet. In the chroot, as root (these only change what starts at boot):

**[IPRPS CHROOT]**

```bash
systemctl disable systemd-networkd.service systemd-networkd-wait-online.service
systemctl enable NetworkManager.service
systemctl enable bluetooth.service
```

You'll check networking at the next boot test (`nmcli general status`, `nmcli device`).

> **Checkpoint:** Take snapshot **`D-networking`**.

**[DEBIAN ROOT]** — snapshot `D-networking`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-D-networking.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-D-networking.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 8 — Stage E: The Desktop (Xfce and LightDM)

The Xfce desktop, the LightDM login screen, file management (Thunar), disks and removable media (UDisks, GVfs), power management, notifications, and the network applet. Part 9 turns it into the IPRPS Desktop.

> **Side note:** This stage also builds GTK 3 and GTK 4, which the Wi-Fi applet needs. It's the longest stage by package count, but most packages are small.

**139 packages, in build order:** at-spi2-core-2.60.6, Little CMS-2.19.1, libaom-3.14.1, libde265-1.1.1, x265-4.2, libheif-1.23.1, brotli-1.2.0, giflib-6.1.3, highway-1.4.0, libjxl-0.12.0, cargo-c-0.10.24, librsvg-2.62.3, libseccomp-2.6.1, glycin-2.1.5, gdk-pixbuf-2.44.7, libxkbcommon-1.13.2, GTK-3.24.52, startup-notification-0.12, libxfce4util-4.20.1, Xfconf-4.20.0, libxfce4ui-4.20.2, Exo-4.20.0, lxml-6.1.1, itstool-2.0.7, Pathspec-1.1.1, vcs_versioning-2.2.4, Setuptools_scm-10.1.2, Pluggy-1.6.0, Poetry-core-2.4.1, Tomlkit-0.15.1, Trove-Classifiers-2026.6.1.19, Hatchling-1.32.0, Pygments-2.20.0, GTK-Doc-1.36.1, Intltool-0.51.0, libgpg-error-1.61, libgcrypt-1.12.2, libxklavier-5.4, lightdm-1.33.1, desktop-file-utils-0.28, libwnck-43.3, libdisplay-info-0.4.0, xfce4-dev-tools-4.20.0, libxfce4windowing-4.20.7, json-c-0.19, AccountsService-26.27.3, polkit-gnome-0.105, XScreenSaver-6.15, xfce4-session-4.20.4, Garcon-4.20.0, xfce4-panel-4.20.8, libnotify-0.8.8, thunar-4.20.9, thunar-volman-4.20.0, tumbler-4.20.2, xfce4-appfinder-4.20.0, UPower-1.91.3, xfce4-power-manager-4.20.1, libcanberra-0.30, xfce4-settings-4.20.5, Xfdesktop-4.20.2, Xfwm4-4.20.0, fast_float-8.2.10, fmt-12.2.0, Nettle-4.0, GnuTLS-3.8.13, glslc from shaderc-2026.3, Graphene-1.10.8, libdvdread-7.1.1, libdvdnav-7.0.0, SoundTouch-2.4.1, SVT-AV1-4.2.0, gst-plugins-bad-1.28.6, GTK-4.22.4, simdutf-9.0.0, VTE-0.84.1, xfce4-terminal-1.2.0, Aspell-0.60.8.2, enchant-2.8.19, gspell-1.14.4, gtksourceview4-4.8.4, mousepad-0.7.0, libexif-0.6.26, ristretto-0.14.0, xfce4-notifyd-0.9.7, keybinder-3.0-0.3.2, xfce4-pulseaudio-plugin-0.5.1, xarchiver-0.5.4.27, libassuan-3.0.2, libksba-1.8.0, npth-1.8, lmdb-1.0.1, Cyrus SASL-2.1.28, OpenLDAP-2.7.0, pinentry-1.3.3, GnuPG-2.5.21, libsecret-0.21.7, Gcr-4.4.0.1, libcdio-2.1.0, gsettings-desktop-schemas-50.1, glib-networking-2.80.1, libsoup-3.6.6, cryptsetup-2.8.7, keyutils-1.6.3, libatasmart-0.19, libbytesize-2.12, libnvme-1.16.2, libblockdev-3.5.0, UDisks-2.11.2, Gvfs-1.60.2, Lynx-2.9.3, xmlto-0.0.29, xdg-utils-1.2.1, Xdg-user-dirs-0.20, adwaita-icon-theme-50.0, gnome-themes-extra-3.28, TTF and OTF fonts, libmbim-1.34.0, libqmi-1.38.0, ModemManager-1.24.2, Gcr-3.41.2, libnma-1.10.6, network-manager-applet-1.34.0, Bubblewrap-0.11.2, Fuse-3.18.2, hicolor-icon-theme-0.18, XML::Simple-2.25, icon-naming-utils-0.8.90, gnome-icon-theme-3.12.0, gnome-keyring-50.0, LAME-3.100, libvpx-1.16.0, mpg123-1.33.7, gst-plugins-good-1.28.6, json-glib-1.10.8, lxde-icon-theme-0.5.1, sound-theme-freedesktop-0.8, xdg-desktop-portal-1.22.1, xdg-desktop-portal-gtk-1.15.3.

### at-spi2-core-2.60.6

*BLFS 13.1 · ID `at-spi2-core` · Stage E* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 22 MB (with tests)

**Requires:** `glib2`, `xorg7-lib`  
**Needed at runtime:** `gsettings-desktop-schemas`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/at-spi2-core/2.60/at-spi2-core-2.60.6.tar.xz
```

MD5 sum of `at-spi2-core-2.60.6.tar.xz`: `1082626c9a82694b7900f8283b20dfac` (check with `md5sum at-spi2-core-2.60.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf at-spi2-core-2.60.6.tar.xz
cd "$(tar -tf at-spi2-core-2.60.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install At-Spi2 Core by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                  \
      --prefix=/usr             \
      --buildtype=release       \
      -D gtk2_atk_adaptor=false &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf at-spi2-core-2.60.6.tar.xz | head -1 | cut -d/ -f1)"
```


### Little CMS-2.19.1

*BLFS 13.1 · ID `lcms2` · Stage E* · *Build time:* 0.2 SBU (with the tests) · *Disk space:* 17 MB (with the tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/mm2/Little-CMS/releases/download/lcms2.19.1/lcms2-2.19.1.tar.gz
```

MD5 sum of `lcms2-2.19.1.tar.gz`: `541978f73749499e9e0277bfe5a3c868` (check with `md5sum lcms2-2.19.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lcms2-2.19.1.tar.gz
cd "$(tar -tf lcms2-2.19.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Little CMS2 by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lcms2-2.19.1.tar.gz | head -1 | cut -d/ -f1)"
```


### libaom-3.14.1

*BLFS 13.1 · ID `libaom` · Stage E* · *Build time:* 0.8 SBU (with parallelism=4) · *Disk space:* 124 MB

**Recommended (included):** `yasm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://storage.googleapis.com/aom-releases/libaom-3.14.1.tar.gz
```

MD5 sum of `libaom-3.14.1.tar.gz`: `4a689bbc27ec095d253ed8d241077ad5` (check with `md5sum libaom-3.14.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libaom-3.14.1.tar.gz
cd "$(tar -tf libaom-3.14.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Prevent installing static versions of the libraries:

```bash
sed -i 's/aom aom_static/aom/' cmake/aom_install.cmake
```

**[BUILDER]** — Install libaom by running the following commands:

```bash
mkdir aom-build &&
cd    aom-build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D BUILD_SHARED_LIBS=1       \
      -D ENABLE_DOCS=no            \
      -G Ninja .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libaom-3.14.1.tar.gz | head -1 | cut -d/ -f1)"
```


### libde265-1.1.1

*BLFS 13.1 · ID `libde265` · Stage E* · *Build time:* 0.2 SBU · *Disk space:* 7.8 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/strukturag/libde265/releases/download/v1.1.1/libde265-1.1.1.tar.gz
```

MD5 sum of `libde265-1.1.1.tar.gz`: `e9a8ccb8185b5191e712b8a5fa1d1bfc` (check with `md5sum libde265-1.1.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libde265-1.1.1.tar.gz
cd "$(tar -tf libde265-1.1.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libde265 by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libde265-1.1.1.tar.gz | head -1 | cut -d/ -f1)"
```


### x265-4.2

*BLFS 13.1 · ID `x265` · Stage E* · *Build time:* 0.4 SBU (using parallelism=4) · *Disk space:* 49 MB

**Requires:** `cmake`  
**Recommended (included):** `nasm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://bitbucket.org/multicoreware/x265_git/downloads/x265_4.2.tar.gz
```

MD5 sum of `x265_4.2.tar.gz`: `0a7edcf495aba9f320047d61647d610b` (check with `md5sum x265_4.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf x265_4.2.tar.gz
cd "$(tar -tf x265_4.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix building this package for 32-bit platforms:

```bash
sed -i 's/FORMAT_ELF/UNIX64 \&\& FORMAT_ELF/' source/common/x86/cpu-a.asm
```

**[BUILDER]** — Install x265 by running the following commands:

```bash
mkdir bld &&
cd    bld &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D GIT_ARCHETYPE=1           \
      -W no-author                 \
      ../source                    &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To install the package, first remove any old library versions. After installation, remove a static library. As the root user:

```bash
make install &&
rm -vf /usr/lib/libx265.a
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf x265_4.2.tar.gz | head -1 | cut -d/ -f1)"
```


### libheif-1.23.1

*BLFS 13.1 · ID `libheif` · Stage E* · *Build time:* 0.6 SBU (with tests, parallelism=4) · *Disk space:* 49 MB (with tests)

**Recommended (included):** `libaom`, `libde265`, `x265`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/strukturag/libheif/releases/download/v1.23.1/libheif-1.23.1.tar.gz
```

MD5 sum of `libheif-1.23.1.tar.gz`: `26fd31d0591ab927ef1a638de64cb2da` (check with `md5sum libheif-1.23.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libheif-1.23.1.tar.gz
cd "$(tar -tf libheif-1.23.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libheif by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D WITH_GDK_PIXBUF=OFF       \
      -D WITH_OpenH264_DECODER=OFF \
      -G Ninja ..                  &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libheif-1.23.1.tar.gz | head -1 | cut -d/ -f1)"
```


### brotli-1.2.0

*BLFS 13.1 · ID `brotli` · Stage E* · *Build time:* 0.3 SBU (with python3 bindings; parallelism=4) · *Disk space:* 33 MB (with python3 bindings)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/google/brotli/archive/v1.2.0/brotli-1.2.0.tar.gz
```

MD5 sum of `brotli-1.2.0.tar.gz`: `8fbfae9a5ecbc278ae7f761ecb6d1285` (check with `md5sum brotli-1.2.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf brotli-1.2.0.tar.gz
cd "$(tar -tf brotli-1.2.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install brotli by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -G Ninja .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — *(Optional — skip if unsure)* If desired, build the Python3 bindings:

```bash
cd .. &&

sed -e '/libraries +=/s/=.*/= [required_system_library[3:]]/' \
    -e '/package_configuration/d'                             \
    -e '/pkgconfig/d'                                         \
    -i setup.py                                               &&

USE_SYSTEM_BROTLI=1 \
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the Python3 bindings as the root user:

```bash
pip3 install --no-index --find-links dist --no-user Brotli
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf brotli-1.2.0.tar.gz | head -1 | cut -d/ -f1)"
```


### giflib-6.1.3

*BLFS 13.1 · ID `giflib` · Stage E* · *Build time:* less than 0.1 SBU (with documentation) · *Disk space:* 4.2 MB (with documentation)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://sourceforge.net/projects/giflib/files/giflib-6.1.3.tar.gz
```

MD5 sum of `giflib-6.1.3.tar.gz`: `a70e90ff780e9ebee9cb84b82bbd46a7` (check with `md5sum giflib-6.1.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf giflib-6.1.3.tar.gz
cd "$(tar -tf giflib-6.1.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install giflib by running the following commands:

```bash
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make PREFIX=/usr \
     DOCDIR=/usr/share/doc/giflib-6.1.3 install &&

rm -fv /usr/lib/libgif.a
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf giflib-6.1.3.tar.gz | head -1 | cut -d/ -f1)"
```


### highway-1.4.0

*BLFS 13.1 · ID `highway` · Stage E* · *Build time:* 0.6 SBU (with parallelism=4) · *Disk space:* 41 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/google/highway/archive/1.4.0/highway-1.4.0.tar.gz
```

MD5 sum of `highway-1.4.0.tar.gz`: `9d335797777e17f827c7980b8313a34b` (check with `md5sum highway-1.4.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf highway-1.4.0.tar.gz
cd "$(tar -tf highway-1.4.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install highway by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D BUILD_TESTING=OFF         \
      -D BUILD_SHARED_LIBS=ON      \
      -G Ninja ..                  &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf highway-1.4.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libjxl-0.12.0

*BLFS 13.1 · ID `libjxl` · Stage E* · *Build time:* 1.0 SBU (with parallelism=4) · *Disk space:* 67 MB

**Requires:** `brotli`, `cmake`, `giflib`, `highway`, `lcms2`, `libjpeg`, `libpng`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libjxl/libjxl/archive/v0.12.0/libjxl-0.12.0.tar.gz
```

MD5 sum of `libjxl-0.12.0.tar.gz`: `a0fd3ac7b474525dadb99bbcb5d814f9` (check with `md5sum libjxl-0.12.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libjxl-0.12.0.tar.gz
cd "$(tar -tf libjxl-0.12.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libjxl by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr             \
      -D CMAKE_BUILD_TYPE=Release              \
      -D BUILD_TESTING=OFF                     \
      -D BUILD_SHARED_LIBS=ON                  \
      -D JPEGXL_ENABLE_SKCMS=OFF               \
      -D JPEGXL_ENABLE_SJPEG=OFF               \
      -D JPEGXL_ENABLE_PLUGINS=OFF             \
      -D JPEGXL_INSTALL_JARDIR=/usr/share/java \
      -G Ninja ..                              &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libjxl-0.12.0.tar.gz | head -1 | cut -d/ -f1)"
```


### cargo-c-0.10.24

*BLFS 13.1 · ID `cargo-c` · Stage E* · *Build time:* 0.7 SBU (add 5.2 SBU for tests) · *Disk space:* 1.4 GB (with tests)

**Requires:** `rust`  
**Recommended (included):** `libssh2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/lu-zero/cargo-c/archive/v0.10.24/cargo-c-0.10.24.tar.gz
```

MD5 sum of `cargo-c-0.10.24.tar.gz`: `b6247bf8f5eac962f001ee8a37f1c25f` (check with `md5sum cargo-c-0.10.24.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cargo-c-0.10.24.tar.gz
cd "$(tar -tf cargo-c-0.10.24.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, download a file to ensure that cargo uses the dependency versions specified by the upstream developers when this cargo-c version (0.10.24) was released. Without this, the latest versions of the dependencies would be used and they might cause breakages:

```bash
curl -fLO https://github.com/lu-zero/cargo-c/releases/download/v0.10.24/Cargo.lock
```

> **Side note (BLFS):** Normally we would put such a download into an Additional Downloads section. But in this case we cannot tell the package name and version from the file name Cargo.lock, so it's better not to put the ambiguously-named file outside the cargo-c-0.10.24 directory. We use curl here because the cURL-8.21.0 package should have been installed as a required dependency of Rustc-1.97.1. The md5sum of the file should be fd58412b6d608a57a7d9a7bf384dca03.

**[BUILDER]** — Install cargo-c by running the following commands:

```bash
export LIBSSH2_SYS_USE_PKG_CONFIG=1    &&
export LIBSQLITE3_SYS_USE_PKG_CONFIG=1 &&

cargo build --release
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
install -vm755 target/release/cargo-{capi,cbuild,cinstall,ctest} /usr/bin/
```

**[BUILDER]** — Finally, unset the exported environment variables:

```bash
unset LIB{SSH2,SQLITE3}_SYS_USE_PKG_CONFIG
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cargo-c-0.10.24.tar.gz | head -1 | cut -d/ -f1)"
```


### librsvg-2.62.3

*BLFS 13.1 · ID `librsvg` · Stage E* · *Build time:* 0.6 SBU (add 0.3 SBU for tests; both using parallelism=4) · *Disk space:* 2.0 GB (with tests; 18 MB installed)

**Requires:** `cairo`, `cargo-c`, `pango`  
**Recommended (included):** `gdk-pixbuf`, `glib2`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/librsvg/2.62/librsvg-2.62.3.tar.xz
```

MD5 sum of `librsvg-2.62.3.tar.xz`: `bf6d56ffe4cfa5426cf1a67bcabdf5ce` (check with `md5sum librsvg-2.62.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf librsvg-2.62.3.tar.xz
cd "$(tar -tf librsvg-2.62.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* First, fix the installation path of the API documentation:

```bash
sed -e "/OUTDIR/s|,| / 'librsvg-2.62.3', '--no-namespace-dir',|" \
    -e '/output/s|Rsvg-2.0|librsvg-2.62.3|'                      \
    -i doc/meson.build
```

**[BUILDER]** — Install librsvg by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the results, issue:

```bash
meson test -v
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf librsvg-2.62.3.tar.xz | head -1 | cut -d/ -f1)"
```


### libseccomp-2.6.1

*BLFS 13.1 · ID `libseccomp` · Stage E* · *Build time:* less than 0.1 SBU (additional 1.7 SBU for tests) · *Disk space:* 13 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/seccomp/libseccomp/releases/download/v2.6.1/libseccomp-2.6.1.tar.gz
```

MD5 sum of `libseccomp-2.6.1.tar.gz`: `33a3a5d4c526a739515ff4dc53cdc192` (check with `md5sum libseccomp-2.6.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libseccomp-2.6.1.tar.gz
cd "$(tar -tf libseccomp-2.6.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libseccomp by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libseccomp-2.6.1.tar.gz | head -1 | cut -d/ -f1)"
```


### glycin-2.1.5

*BLFS 13.1 · ID `glycin` · Stage E* · *Build time:* 3.3 SBU (with documentation, add 2.5 SBU for tests) · *Disk space:* 1.4 GB (with documentation, add 1 GB for tests)

**Requires:** `fontconfig`, `glib2`, `lcms2`, `libseccomp`, `rust`  
**Recommended (included):** `libheif`, `libjxl`, `librsvg`, `vala`  
**Needed at runtime:** `bubblewrap`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/glycin/2.1/glycin-2.1.5.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/glycin-2.1.5-xorg_prefix-1.patch
```

MD5 sum of `glycin-2.1.5.tar.xz`: `d9224a846ad1ed964d07e1ebb48d4458` (check with `md5sum glycin-2.1.5.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glycin-2.1.5.tar.xz
cd "$(tar -tf glycin-2.1.5.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS: build glycin in two passes.** Its SVG loader needs gdk-pixbuf, which comes next and itself uses glycin. **Pass 1 (here):** add `-D loaders=glycin-heif,glycin-image-rs,glycin-jxl` to the `meson setup` line (check the option name with `grep -n "option(" ../meson_options.txt ../meson.options 2>/dev/null`; in glycin 2.1 `glycin-loaders` is only an on/off switch). Install, and **keep the folder**. **Pass 2** comes right after gdk-pixbuf. Without pass 2, every SVG icon fails and the LightDM login screen crashes ("Unsupported image format").

**Build and install:**

**[BUILDER]** — If installing Xorg into /opt, download the needed Rust crates now and apply a patch to allow accessing $XORG_PREFIX/lib from the sandbox (note that the patch requires XORG_PREFIX to be set properly for both the current user and for root following xorg-env…

```bash
cargo vendor &&
patch -Np1 -i ../glycin-2.1.5-xorg_prefix-1.patch
```

**[BUILDER]** — Fix a build error when a system libglycin is not yet installed:

```bash
sed -e "s/get_option('libglycin-gtk4')/(& or get_option('glycin-thumbnailer'))/" \
    -i meson.build
```

**[BUILDER]** — Install glycin by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr           \
            --buildtype=release     \
            -D libglycin-gtk4=false \
            -D tests=false ..       &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed Gi-DocGen-2026.1, you can build the documentation by issuing:

```bash
sed "/install_dir:.*doc/s|,$| / 'glycin-' + meson.project_version()&|" \
    -i ../libglycin/meson.build &&

meson configure -D capi_docs=true &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glycin-2.1.5.tar.xz | head -1 | cut -d/ -f1)"
```


### gdk-pixbuf-2.44.7

*BLFS 13.1 · ID `gdk-pixbuf` · Stage E* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 68 MB (with tests)

**Requires:** `glib2`, `shared-mime-info`  
**Recommended (included):** `docutils`, `glycin`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gdk-pixbuf/2.44/gdk-pixbuf-2.44.7.tar.xz
```

MD5 sum of `gdk-pixbuf-2.44.7.tar.xz`: `2a12da2133476b7b36fbfcadd7133315` (check with `md5sum gdk-pixbuf-2.44.7.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gdk-pixbuf-2.44.7.tar.xz
cd "$(tar -tf gdk-pixbuf-2.44.7.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS checkpoint.** gdk-pixbuf must be built **after glycin pass 1 is installed**: its PNG/JPEG/GIF/TIFF loaders are switched off and glycin does all image loading. After `ninja install`, `ldd /usr/lib/libgdk_pixbuf-2.0.so.0 | grep glycin` must show `libglycin-2.so.0`. If it doesn't, gdk-pixbuf can't read any image: rebuild it.

**Build and install:**

**[BUILDER]** — Install Gdk Pixbuf by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                \
      --prefix=/usr           \
      --buildtype=release     \
      -D png=disabled         \
      -D gif=disabled         \
      -D jpeg=disabled        \
      -D tiff=disabled        \
      -D thumbnailer=disabled \
      --wrap-mode=nofallback  \
      $(pkgconf glycin-2 || echo -D glycin=disabled) &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed "/docs_dir =/s@\$@ / 'gdk-pixbuf-2.44.7'@" -i ../docs/meson.build &&
meson configure -D gtk_doc=true                                        &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

> **Side note (BLFS):** If you installed the package on to your system using a DESTDIR method, an important file was not installed and should be copied and/or generated. Generate it using the following command as the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you installed the package on to your system using a DESTDIR method, an important file was not installed and should be copied and/or generated. Generate it using the following command as the root user:

```bash
gdk-pixbuf-query-loaders --update-cache
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gdk-pixbuf-2.44.7.tar.xz | head -1 | cut -d/ -f1)"
```

### glycin — second pass (IPRPS)

*Required.* Now that gdk-pixbuf is installed, rebuild glycin **with all four loaders**, so SVG images and icons work. Without this pass the LightDM login screen crashes.

**[BUILDER]** — glycin's folder from pass 1 (unpack it again if it was removed):

```bash
cd ~/src
ls -d glycin-2.1.5 2>/dev/null || tar -xf glycin-2.1.5.tar.xz
cd glycin-2.1.5
rm -rf build
mkdir build &&
cd    build &&
meson setup --prefix=/usr           \
            --buildtype=release     \
            -D libglycin-gtk4=false \
            -D tests=false .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
cd /build/src/glycin-2.1.5/build
ninja install
ls /usr/libexec/glycin-loaders/2+/
gdk-pixbuf-query-loaders --update-cache
update-mime-database /usr/share/mime
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
```

`ls` must list four loaders, including **`glycin-svg`**. Run `gtk-update-icon-cache -qtf /usr/share/icons/Adwaita` too once the Adwaita icon theme is installed later in this stage.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf glycin-2.1.5
```



### libxkbcommon-1.13.2

*BLFS 13.1 · ID `libxkbcommon` · Stage E* · *Build time:* 0.4 SBU (with tests) · *Disk space:* 45 MB (with tests)

**Recommended (included):** `libxcb`, `wayland`, `wayland-protocols`  
**Needed at runtime:** `xkeyboard-config`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/lfs-book/libxkbcommon/archive/v1.13.2/libxkbcommon-1.13.2.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/libxkbcommon-1.13.2-upstream_fix-1.patch
```

MD5 sum of `libxkbcommon-1.13.2.tar.gz`: `07f838f575d62c267cfc53eaf5ee739b` (check with `md5sum libxkbcommon-1.13.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxkbcommon-1.13.2.tar.gz
cd "$(tar -tf libxkbcommon-1.13.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Fix an issue introduced in libxkbcommon-1.13.2:

```bash
patch -Np1 -i ../libxkbcommon-1.13.2-upstream_fix-1.patch
```

**[BUILDER]** — Install libxkbcommon by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..             \
      --prefix=/usr        \
      --buildtype=release  \
      -D enable-docs=false &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxkbcommon-1.13.2.tar.gz | head -1 | cut -d/ -f1)"
```


### GTK-3.24.52

*BLFS 13.1 · ID `gtk3` · Stage E* · *Build time:* 0.6 SBU (using parallelism=4; add 2.4 SBU for tests) · *Disk space:* 302 MB (with tests)

**Requires:** `at-spi2-core`, `gdk-pixbuf`, `libepoxy`, `pango`  
**Recommended (included):** `iso-codes`, `libxkbcommon`, `wayland`, `wayland-protocols`, `glib2`  
**Needed at runtime:** `adwaita-icon-theme`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gtk/3.24/gtk-3.24.52.tar.xz
```

MD5 sum of `gtk-3.24.52.tar.xz`: `4dfad1e56bf8ad25dfab58add17e7146` (check with `md5sum gtk-3.24.52.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gtk-3.24.52.tar.xz
cd "$(tar -tf gtk-3.24.52.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GTK3 by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D man=true         \
      -D broadway_backend=true &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

> **Side note (BLFS):** If you installed the package on to your system using a DESTDIR method, an important file was not installed and must be copied and/or generated. Generate it using the following command as the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you installed the package on to your system using a DESTDIR method, an important file was not installed and must be copied and/or generated. Generate it using the following command as the root user:

```bash
gtk-query-immodules-3.0 --update-cache
```

> **Side note (BLFS):** If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

```bash
glib-compile-schemas /usr/share/glib-2.0/schemas
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — GTK3 themes change the way a GTK3 application looks. An icon theme can be used to change the icons that appear on the application's toolbar. If you have installed a GTK3 theme (e.g. the Adwaita theme built in GTK3), an icon theme (such as…

```bash
mkdir -vp ~/.config/gtk-3.0
cat > ~/.config/gtk-3.0/settings.ini << "EOF"
[Settings]
gtk-theme-name = Adwaita
gtk-icon-theme-name = oxygen
gtk-font-name = DejaVu Sans 12
gtk-cursor-theme-size = 18
gtk-toolbar-style = GTK_TOOLBAR_BOTH_HORIZ
gtk-xft-antialias = 1
gtk-xft-hinting = 1
gtk-xft-hintstyle = hintslight
gtk-xft-rgba = rgb
gtk-cursor-theme-name = Adwaita
EOF
```

**[BUILDER]** — As part of GTK-3.0's redesign, the scroll bar buttons are no longer visible on the scrollbar in many applications. If this functionality is desired, modify the gtk.css file and restore them using the following command:

```bash
cat > ~/.config/gtk-3.0/gtk.css << "EOF"
*  {
   -GtkScrollbar-has-backward-stepper: 1;
   -GtkScrollbar-has-forward-stepper: 1;
}
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gtk-3.24.52.tar.xz | head -1 | cut -d/ -f1)"
```


### startup-notification-0.12

*BLFS 13.1 · ID `startup-notification` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 4 MB

**Requires:** `xorg7-lib`, `xcb-util`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.freedesktop.org/software/startup-notification/releases/startup-notification-0.12.tar.gz
```

MD5 sum of `startup-notification-0.12.tar.gz`: `2cd77326d4dcaed9a5a23a1232fb38e9` (check with `md5sum startup-notification-0.12.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf startup-notification-0.12.tar.gz
cd "$(tar -tf startup-notification-0.12.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install startup-notification by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m644 -D doc/startup-notification.txt \
    /usr/share/doc/startup-notification-0.12/startup-notification.txt
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf startup-notification-0.12.tar.gz | head -1 | cut -d/ -f1)"
```


### libxfce4util-4.20.1

*BLFS 13.1 · ID `libxfce4util` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 6.8 MB

**Requires:** `glib2`  
**Recommended (included):** `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/libxfce4util/4.20/libxfce4util-4.20.1.tar.bz2
```

MD5 sum of `libxfce4util-4.20.1.tar.bz2`: `8e30b7735333f74d80c379e15d9da145` (check with `md5sum libxfce4util-4.20.1.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxfce4util-4.20.1.tar.bz2
cd "$(tar -tf libxfce4util-4.20.1.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxfce4util by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxfce4util-4.20.1.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Xfconf-4.20.0

*BLFS 13.1 · ID `xfconf` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 10 MB

**Requires:** `libxfce4util`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfconf/4.20/xfconf-4.20.0.tar.bz2
```

MD5 sum of `xfconf-4.20.0.tar.bz2`: `ca596ff0a9be7fa655bb09cb05458644` (check with `md5sum xfconf-4.20.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfconf-4.20.0.tar.bz2
cd "$(tar -tf xfconf-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfconf by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfconf-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libxfce4ui-4.20.2

*BLFS 13.1 · ID `libxfce4ui` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 14 MB

**Requires:** `gtk3`, `xfconf`  
**Recommended (included):** `startup-notification`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/libxfce4ui/4.20/libxfce4ui-4.20.2.tar.bz2
```

MD5 sum of `libxfce4ui-4.20.2.tar.bz2`: `ce54074a9ed7964b4a3274e8ac74d949` (check with `md5sum libxfce4ui-4.20.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxfce4ui-4.20.2.tar.bz2
cd "$(tar -tf libxfce4ui-4.20.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxfce4ui by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxfce4ui-4.20.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Exo-4.20.0

*BLFS 13.1 · ID `exo` · Stage E* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 14 MB (with tests)

**Requires:** `gtk3`, `libxfce4ui`, `libxfce4util`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/exo/4.20/exo-4.20.0.tar.bz2
```

MD5 sum of `exo-4.20.0.tar.bz2`: `f059ec3d8686d4b322c42d19ebec0366` (check with `md5sum exo-4.20.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf exo-4.20.0.tar.bz2
cd "$(tar -tf exo-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Exo by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf exo-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### lxml-6.1.1

*BLFS 13.1 · ID `lxml` · Stage E* · *Build time:* 0.8 SBU · *Disk space:* 134 MB

**Requires:** `libxslt`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/l/lxml/lxml-6.1.1.tar.gz
```

MD5 sum of `lxml-6.1.1.tar.gz`: `6bbd3674ecba1340b08c9180afef1829` (check with `md5sum lxml-6.1.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lxml-6.1.1.tar.gz
cd "$(tar -tf lxml-6.1.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — To build the Python 3 module, run:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To install the module, issue the following command as the root user:

```bash
pip3 install --no-index --find-links dist --no-user lxml
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lxml-6.1.1.tar.gz | head -1 | cut -d/ -f1)"
```


### itstool-2.0.7

*BLFS 13.1 · ID `itstool` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 688 KB

**Requires:** `DocBook`, `lxml`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/itstool/itstool/archive/2.0.7/itstool-2.0.7.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/itstool-2.0.7-lxml-1.patch
```

MD5 sum of `itstool-2.0.7.tar.gz`: `e759b258617a912acce630de3fa43957` (check with `md5sum itstool-2.0.7.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf itstool-2.0.7.tar.gz
cd "$(tar -tf itstool-2.0.7.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, apply a patch to use lxml-6.1.1 for handling the XML files instead of the deprecated (disabled by default) Python module from libxml2-2.15.3:

```bash
patch -Np1 -i ../itstool-2.0.7-lxml-1.patch
```

**[BUILDER]** — Install itstool by running the following commands:

```bash
PYTHON=/usr/bin/python3 ./autogen.sh --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf itstool-2.0.7.tar.gz | head -1 | cut -d/ -f1)"
```


### Pathspec-1.1.1

*BLFS 13.1 · ID `pathspec` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 1.7 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/p/pathspec/pathspec-1.1.1.tar.gz
```

MD5 sum of `pathspec-1.1.1.tar.gz`: `c762d0a00d6cfc9de003e02d5072b26a` (check with `md5sum pathspec-1.1.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pathspec-1.1.1.tar.gz
cd "$(tar -tf pathspec-1.1.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user pathspec
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pathspec-1.1.1.tar.gz | head -1 | cut -d/ -f1)"
```


### vcs_versioning-2.2.4

*BLFS 13.1 · ID `vcs_versioning` · Stage E* · *Build time:* less than 0.1 SBU (add 1.2 SBU for tests) · *Disk space:* 2.8 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/v/vcs_versioning/vcs_versioning-2.2.4.tar.gz
```

MD5 sum of `vcs_versioning-2.2.4.tar.gz`: `4379f311792d41c845f9b86975b1be18` (check with `md5sum vcs_versioning-2.2.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf vcs_versioning-2.2.4.tar.gz
cd "$(tar -tf vcs_versioning-2.2.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user vcs_versioning
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, issue (HOME= prevents the .gitconfig file in the home directory from interfering the tests):

```bash
python3 -m venv --system-site-packages testenv &&
testenv/bin/pip3 install pytest-timeout        &&
HOME= testenv/bin/python3 -m pytest
```

> **Side note (BLFS):** The test suite may cause keyboard inputs not displayed on the screen at all (but you can still run any command if you can type it correctly). Run the reset command to fix such an issue.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf vcs_versioning-2.2.4.tar.gz | head -1 | cut -d/ -f1)"
```


### Setuptools_scm-10.1.2

*BLFS 13.1 · ID `setuptools_scm` · Stage E* · *Build time:* less than 0.1 SBU (add 0.4 SBU for tests) · *Disk space:* 1.6 MB (add 118 MB for tests)

**Requires:** `vcs_versioning`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/s/setuptools_scm/setuptools_scm-10.1.2.tar.gz
```

MD5 sum of `setuptools_scm-10.1.2.tar.gz`: `fc7dfeae0b61636e3705547acc9f3276` (check with `md5sum setuptools_scm-10.1.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf setuptools_scm-10.1.2.tar.gz
cd "$(tar -tf setuptools_scm-10.1.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user setuptools_scm
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, make sure Pytest-9.1.1 and the other optional dependencies are installed and run (HOME= prevents the .gitconfig file in the home directory from interfering the tests):

```bash
python3 -m venv --system-site-packages testenv &&
testenv/bin/pip3 install --group test          &&
TZ=UTC HOME= testenv/bin/python3 -m pytest
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf setuptools_scm-10.1.2.tar.gz | head -1 | cut -d/ -f1)"
```


### Pluggy-1.6.0

*BLFS 13.1 · ID `pluggy` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 588 KB (add 18 MB for tests)

**Recommended (included):** `setuptools_scm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/p/pluggy/pluggy-1.6.0.tar.gz
```

MD5 sum of `pluggy-1.6.0.tar.gz`: `54391218af778acb006c2d915085d469` (check with `md5sum pluggy-1.6.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pluggy-1.6.0.tar.gz
cd "$(tar -tf pluggy-1.6.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user pluggy
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pluggy-1.6.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Poetry-core-2.4.1

*BLFS 13.1 · ID `poetry-core` · Stage E* · *Build time:* less than 0.1 SBU (0.3 SBU for tests) · *Disk space:* 10 MB (add 28 MB for tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/p/poetry_core/poetry_core-2.4.1.tar.gz
```

MD5 sum of `poetry_core-2.4.1.tar.gz`: `6c4fb726467b1e270892f51c54c392ba` (check with `md5sum poetry_core-2.4.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf poetry_core-2.4.1.tar.gz
cd "$(tar -tf poetry_core-2.4.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user poetry-core
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, make sure Pytest-9.1.1 and build-1.5.1 are installed, then issue:

```bash
python3 -m venv --system-site-packages testenv                &&
testenv/bin/pip3 install pytest-{cov,mock} tomli-w virtualenv &&
testenv/bin/python -m pytest
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf poetry_core-2.4.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Tomlkit-0.15.1

*BLFS 13.1 · ID `tomlkit` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 5.7 MB (add 17 MB for tests)

**Requires:** `poetry-core`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/t/tomlkit/tomlkit-0.15.1.tar.gz
```

MD5 sum of `tomlkit-0.15.1.tar.gz`: `8e5245fd4099c9a6f99774b24a4591ae` (check with `md5sum tomlkit-0.15.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf tomlkit-0.15.1.tar.gz
cd "$(tar -tf tomlkit-0.15.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user tomlkit
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, make sure Pytest-9.1.1 is installed, then issue:

```bash
python3 -m venv --system-site-packages testenv &&
testenv/bin/pip3 install pytest-cov            &&
testenv/bin/python -m pytest
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf tomlkit-0.15.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Trove-Classifiers-2026.6.1.19

*BLFS 13.1 · ID `trove-classifiers` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 540 KB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/t/trove_classifiers/trove_classifiers-2026.6.1.19.tar.gz
```

MD5 sum of `trove_classifiers-2026.6.1.19.tar.gz`: `fb231b2e9492a5d34fb9bec0250f0f55` (check with `md5sum trove_classifiers-2026.6.1.19.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf trove_classifiers-2026.6.1.19.tar.gz
cd "$(tar -tf trove_classifiers-2026.6.1.19.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, hard code the package version into setup.py to work around an issue causing the generated wheel to contain an incorrect version string when the calver module is not installed:

```bash
sed -i '/calver/s/^/#/;$iversion="2026.6.1.19"' setup.py
```

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user trove-classifiers
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf trove_classifiers-2026.6.1.19.tar.gz | head -1 | cut -d/ -f1)"
```


### Hatchling-1.32.0

*BLFS 13.1 · ID `hatchling` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 1.1 MB

**Requires:** `pathspec`, `pluggy`, `tomlkit`, `trove-classifiers`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/h/hatchling/hatchling-1.32.0.tar.gz
```

MD5 sum of `hatchling-1.32.0.tar.gz`: `e5870c28ce4403c12b3d9a4a4f8866fe` (check with `md5sum hatchling-1.32.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf hatchling-1.32.0.tar.gz
cd "$(tar -tf hatchling-1.32.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user hatchling
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf hatchling-1.32.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Pygments-2.20.0

*BLFS 13.1 · ID `pygments` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 84 MB

**Requires:** `hatchling`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/P/Pygments/pygments-2.20.0.tar.gz
```

MD5 sum of `pygments-2.20.0.tar.gz`: `358297d0a1db8e4beff8eebc0620960e` (check with `md5sum pygments-2.20.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pygments-2.20.0.tar.gz
cd "$(tar -tf pygments-2.20.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the Python 3 module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To install the package run the following as the root user:

```bash
pip3 install --no-index --find-links dist --no-user Pygments
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, make sure Pytest-9.1.1 is installed and run:

```bash
python3 -m venv --system-site-packages testenv &&
testenv/bin/pip3 install wcag-contrast-ratio   &&
testenv/bin/python -m pytest
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pygments-2.20.0.tar.gz | head -1 | cut -d/ -f1)"
```


### GTK-Doc-1.36.1

*BLFS 13.1 · ID `gtk-doc` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 16 MB (add 2.2 MB for tests)

**Requires:** `DocBook`, `docbook-xsl`, `glib2`, `itstool`, `libxslt`, `pygments`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gtk-doc/1.36/gtk-doc-1.36.1.tar.xz
```

MD5 sum of `gtk-doc-1.36.1.tar.xz`: `819b11aa730cf5108f1df3f0eec91cf9` (check with `md5sum gtk-doc-1.36.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gtk-doc-1.36.1.tar.xz
cd "$(tar -tf gtk-doc-1.36.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GTK-Doc by running the following commands:

```bash
mkdir -p build &&
cd       build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D tests=false      &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the results, ensure you have the python module parameterized installed, and issue:

```bash
meson configure -D tests=true &&
ninja test
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gtk-doc-1.36.1.tar.xz | head -1 | cut -d/ -f1)"
```


### Intltool-0.51.0

*BLFS 13.1 · ID `intltool` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 1.5 MB

**Requires:** `perl-xml-parser`

**[BUILDER]** — Download:

```bash
cd ~/src
wget http://launchpad.net/intltool/trunk/0.51.0/+download/intltool-0.51.0.tar.gz
```

MD5 sum of `intltool-0.51.0.tar.gz`: `12e517cac2b57a0121cda351570f1e63` (check with `md5sum intltool-0.51.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf intltool-0.51.0.tar.gz
cd "$(tar -tf intltool-0.51.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First fix a warning that is caused by perl-5.22 and later:

```bash
sed -i 's:\\\${:\\\$\\{:' intltool-update.in
```

> **Side note (BLFS):** The above regular expression looks unusual because of all the backslashes. What it does is add a backslash before the right brace character in the sequence '\${' resulting in '\$\{'.

**[BUILDER]** — Install Intltool by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m644 -D doc/I18N-HOWTO -t /usr/share/doc/intltool-0.51.0
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf intltool-0.51.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libgpg-error-1.61

*BLFS 13.1 · ID `libgpg-error` · Stage E* · *Build time:* 0.3 SBU (with tests) · *Disk space:* 15 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/libgpg-error/libgpg-error-1.61.tar.bz2
```

MD5 sum of `libgpg-error-1.61.tar.bz2`: `c89a8c6825cb64c527d5c1c0fb36f245` (check with `md5sum libgpg-error-1.61.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libgpg-error-1.61.tar.bz2
cd "$(tar -tf libgpg-error-1.61.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libgpg-error by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m644 -D README /usr/share/doc/libgpg-error-1.61/README
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libgpg-error-1.61.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libgcrypt-1.12.2

*BLFS 13.1 · ID `libgcrypt` · Stage E* · *Build time:* 0.2 SBU (with documentation; add 0.9 SBU for tests) · *Disk space:* 159 MB (with tests)

**Requires:** `libgpg-error`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/libgcrypt/libgcrypt-1.12.2.tar.bz2
```

MD5 sum of `libgcrypt-1.12.2.tar.bz2`: `4e98430cfc16d842a7231026c32418da` (check with `md5sum libgcrypt-1.12.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libgcrypt-1.12.2.tar.bz2
cd "$(tar -tf libgcrypt-1.12.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libgcrypt by running the following commands:

```bash
./configure --prefix=/usr &&
make                      &&

make -C doc html                                                       &&
makeinfo --html --no-split -o doc/gcrypt_nochunks.html doc/gcrypt.texi &&
makeinfo --plaintext       -o doc/gcrypt.txt           doc/gcrypt.texi
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -dm755   /usr/share/doc/libgcrypt-1.12.2 &&
install -v -m644    README doc/{README.apichanges,fips*,libgcrypt*} \
                    /usr/share/doc/libgcrypt-1.12.2 &&

install -v -dm755   /usr/share/doc/libgcrypt-1.12.2/html &&
install -v -m644 doc/gcrypt.html/* \
                    /usr/share/doc/libgcrypt-1.12.2/html &&
install -v -m644 doc/gcrypt_nochunks.html \
                    /usr/share/doc/libgcrypt-1.12.2      &&
install -v -m644 doc/gcrypt.{txt,texi} \
                    /usr/share/doc/libgcrypt-1.12.2
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libgcrypt-1.12.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libxklavier-5.4

*BLFS 13.1 · ID `libxklavier` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 5.2 MB

**Requires:** `glib2`, `iso-codes`, `libxml2`, `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://people.freedesktop.org/~svu/libxklavier-5.4.tar.bz2
```

MD5 sum of `libxklavier-5.4.tar.bz2`: `13af74dcb6011ecedf1e3ed122bd31fa` (check with `md5sum libxklavier-5.4.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxklavier-5.4.tar.bz2
cd "$(tar -tf libxklavier-5.4.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxklavier by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxklavier-5.4.tar.bz2 | head -1 | cut -d/ -f1)"
```


### lightdm-1.33.1

*BLFS 13.1 · ID `lightdm` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 19 MB

**Requires:** `exo`, `libgcrypt`, `intltool`, `itstool`, `linux-pam`  
**Recommended (included):** `glib2`, `libxklavier`, `vala`  
**Needed at runtime:** `xorg-server`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/ubuntu/lightdm/archive/1.33.1/lightdm-1.33.1.tar.gz
wget https://github.com/Xubuntu/lightdm-gtk-greeter/releases/download/lightdm-gtk-greeter-2.0.9/lightdm-gtk-greeter-2.0.9.tar.gz
```

MD5 sum of `lightdm-1.33.1.tar.gz`: `1e228e940a9e97a59a4e67b07836ad17` (check with `md5sum lightdm-1.33.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lightdm-1.33.1.tar.gz
cd "$(tar -tf lightdm-1.33.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS checkpoints for LightDM.** LightDM's `autoreconf` needs **GTK-Doc** (built earlier in this stage). Its whole install block must complete: `ls -l /usr/bin/lightdm-session` (the session wrapper; without it every login closes at once, which looks like a wrong password) and `ls -ld /var/lib/lightdm-data` must both succeed. The greeter's `tar -xf ../lightdm-gtk-greeter-...` line only works straight after LightDM's install, from inside LightDM's folder. After the greeter: `ls /usr/share/xgreeters/` must list `lightdm-gtk-greeter.desktop`. `make install-lightdm` runs in the systemd units folder.

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — First, create a dedicated user and group to take control of the lightdm daemon after it is started. Issue the following commands as the root user:

```bash
groupadd -g 65 lightdm       &&
useradd  -c "Lightdm Daemon" \
         -d /var/lib/lightdm \
         -u 65 -g lightdm    \
         -s /bin/false lightdm
```

**[BUILDER]** — Install lightdm by running the following commands:

```bash
sed -i '/YELP_HELP/d' configure.ac help/Makefile.am    &&

autoreconf -fiv                                        &&

./configure --prefix=/usr                 \
            --libexecdir=/usr/lib/lightdm \
            --localstatedir=/var          \
            --sbindir=/usr/bin            \
            --sysconfdir=/etc             \
            --disable-static              \
            --disable-tests               \
            --with-greeter-user=lightdm   \
            --with-greeter-session=lightdm-gtk-greeter &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install                                                  &&

cp tests/src/lightdm-session /usr/bin                         &&
sed -i '1 s/sh/bash --login/' /usr/bin/lightdm-session        &&
rm -rf /etc/init                                              &&
install -v -dm755 -o lightdm -g lightdm /var/lib/lightdm      &&
install -v -dm755 -o lightdm -g lightdm /var/lib/lightdm-data &&
install -v -dm755 -o lightdm -g lightdm /var/cache/lightdm    &&
install -v -dm770 -o lightdm -g lightdm /var/log/lightdm
```

**[BUILDER]** — Now build the greeter:

```bash
tar -xf ../lightdm-gtk-greeter-2.0.9.tar.gz &&
cd lightdm-gtk-greeter-2.0.9                &&

./configure --prefix=/usr                 \
            --libexecdir=/usr/lib/lightdm \
            --sbindir=/usr/bin            \
            --sysconfdir=/etc             \
            --with-libxklavier            \
            --enable-kill-on-sigterm      \
            --disable-libido              \
            --disable-libindicator        \
            --disable-static              \
            --disable-maintainer-mode     &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
mv -v /usr/share/doc/lightdm-gtk-greeter{,-2.0.9}
```

> **Side note (BLFS):** If you installed Xorg in /opt, you will need to create a symbolic link so lightdm can find the Xorg server. As the root user:

**[BUILDER]** — *(Optional — skip if unsure)* If you installed Xorg in /opt, you will need to create a symbolic link so lightdm can find the Xorg server. As the root user:

```bash
ln -sf /opt/xorg/bin/Xorg /usr/bin/X
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the lightdm.service unit included in the BLFS Systemd Units package:

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-lightdm
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lightdm-1.33.1.tar.gz | head -1 | cut -d/ -f1)"
```


### desktop-file-utils-0.28

*BLFS 13.1 · ID `desktop-file-utils` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 1.2 MB

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.freedesktop.org/software/desktop-file-utils/releases/desktop-file-utils-0.28.tar.xz
```

MD5 sum of `desktop-file-utils-0.28.tar.xz`: `dec5d7265c802db1fde3980356931b7b` (check with `md5sum desktop-file-utils-0.28.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf desktop-file-utils-0.28.tar.xz
cd "$(tar -tf desktop-file-utils-0.28.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Warning (BLFS):** If you are upgrading from a previous version of desktop-file-utils that used the Autotools method of installing and configuring the package, you must remove the desktop-file-edit symlink by using the following commands.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
rm -fv /usr/bin/desktop-file-edit
```

**[BUILDER]** — Install Desktop File Utils by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — When a package installs a .desktop file to a location in one of the base data directories, the database that maps MIME-types to available applications can be updated. For instance, the cache file at /usr/share/applications/mimeinfo.cache can be rebuilt by…

```bash
install -vdm755 /usr/share/applications &&
update-desktop-database /usr/share/applications
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf desktop-file-utils-0.28.tar.xz | head -1 | cut -d/ -f1)"
```


### libwnck-43.3

*BLFS 13.1 · ID `libwnck` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 9.8 MB

**Requires:** `gtk3`  
**Recommended (included):** `glib2`, `startup-notification`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libwnck/43/libwnck-43.3.tar.xz
```

MD5 sum of `libwnck-43.3.tar.xz`: `61938ba1c41f38c9c12033aca5706598` (check with `md5sum libwnck-43.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libwnck-43.3.tar.xz
cd "$(tar -tf libwnck-43.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libwnck by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libwnck-43.3.tar.xz | head -1 | cut -d/ -f1)"
```


### libdisplay-info-0.4.0

*BLFS 13.1 · ID `libdisplay-info` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 3.8 MB

**Requires:** `hwdata`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/emersion/libdisplay-info/-/releases/0.4.0/downloads/libdisplay-info-0.4.0.tar.xz
```

MD5 sum of `libdisplay-info-0.4.0.tar.xz`: `af9f07493bd5ff560a98b95ea4c5c129` (check with `md5sum libdisplay-info-0.4.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libdisplay-info-0.4.0.tar.xz
cd "$(tar -tf libdisplay-info-0.4.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libdisplay-info by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libdisplay-info-0.4.0.tar.xz | head -1 | cut -d/ -f1)"
```


### xfce4-dev-tools-4.20.0

*BLFS 13.1 · ID `xfce4-dev-tools` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 2.7 MB

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget http://archive.xfce.org/src/xfce/xfce4-dev-tools/4.20/xfce4-dev-tools-4.20.0.tar.bz2
```

MD5 sum of `xfce4-dev-tools-4.20.0.tar.bz2`: `bea58046e67b4274c022fcff893fa350` (check with `md5sum xfce4-dev-tools-4.20.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-dev-tools-4.20.0.tar.bz2
cd "$(tar -tf xfce4-dev-tools-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install the Xfce4 Development Tools by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-dev-tools-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libxfce4windowing-4.20.7

*BLFS 13.1 · ID `libxfce4windowing` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 16 MB

**Requires:** `gtk3`, `libdisplay-info`, `libwnck`, `xfce4-dev-tools`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/libxfce4windowing/4.20/libxfce4windowing-4.20.7.tar.bz2
```

MD5 sum of `libxfce4windowing-4.20.7.tar.bz2`: `7f409dec4961e9340a29b273029453d2` (check with `md5sum libxfce4windowing-4.20.7.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxfce4windowing-4.20.7.tar.bz2
cd "$(tar -tf libxfce4windowing-4.20.7.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxfce4windowing by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --enable-x11      \
            --disable-debug   &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxfce4windowing-4.20.7.tar.bz2 | head -1 | cut -d/ -f1)"
```


### json-c-0.19

*BLFS 13.1 · ID `json-c` · Stage E* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 12 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://s3.amazonaws.com/json-c_releases/releases/json-c-0.19.tar.gz
```

MD5 sum of `json-c-0.19.tar.gz`: `5678f1373ba51e0041b574c0411c696b` (check with `md5sum json-c-0.19.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf json-c-0.19.tar.gz
cd "$(tar -tf json-c-0.19.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install json-c by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D BUILD_STATIC_LIBS=OFF     \
      .. &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed Doxygen-1.18.0 and Graphviz-15.1.1, you can build the documentation by running the following command:

```bash
doxygen doc/Doxyfile
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the documentation, install it by running the following commands as the root user:

```bash
install -d -vm755 /usr/share/doc/json-c-0.19 &&
install -v -m644 doc/html/* /usr/share/doc/json-c-0.19
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf json-c-0.19.tar.gz | head -1 | cut -d/ -f1)"
```


### AccountsService-26.27.3

*BLFS 13.1 · ID `accountsservice` · Stage E* · *Build time:* 0.4 SBU (with tests) · *Disk space:* 11 MB (with tests)

**Requires:** `polkit`  
**Recommended (included):** `glib2`, `vala`  
**Needed at runtime:** `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/accountsservice/accountsservice/-/archive/26.27.3/accountsservice-26.27.3.tar.bz2
```

MD5 sum of `accountsservice-26.27.3.tar.bz2`: `61f56055b9d4564ad29bab799222e386` (check with `md5sum accountsservice-26.27.3.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf accountsservice-26.27.3.tar.bz2
cd "$(tar -tf accountsservice-26.27.3.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, Fix a test that fails if the en_IE.UTF-8 locale is not installed:

```bash
sed -i '/^SIMULATED_SYSTEM_LOCALE/s/en_IE.UTF-8/en_HK.iso88591/' tests/test-daemon.py
```

**[BUILDER]** — Install AccountsService by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D admin_group=adm
```

**[BUILDER]** — Build the package:

```bash
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To allow users in the adm group to be listed as Administrators, execute the following commands as the root user:

```bash
cat > /etc/polkit-1/rules.d/40-adm.rules << "EOF"
polkit.addAdminRule(function(action, subject) {
   return ["unix-group:adm"];
   });
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf accountsservice-26.27.3.tar.bz2 | head -1 | cut -d/ -f1)"
```


### polkit-gnome-0.105

*BLFS 13.1 · ID `polkit-gnome` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 5.0 MB

**Requires:** `accountsservice`, `gtk3`, `intltool`, `polkit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/polkit-gnome/0.105/polkit-gnome-0.105.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/polkit-gnome-0.105-consolidated_fixes-1.patch
```

MD5 sum of `polkit-gnome-0.105.tar.xz`: `50ecad37c8342fb4a52f590db7530621` (check with `md5sum polkit-gnome-0.105.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf polkit-gnome-0.105.tar.xz
cd "$(tar -tf polkit-gnome-0.105.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, apply some fixes that allow for the proper user icon to be used, as well as some security fixes:

```bash
patch -Np1 -i ../polkit-gnome-0.105-consolidated_fixes-1.patch
```

**[BUILDER]** — Install Polkit GNOME by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Issue the following commands as the root user to create a startup file for Polkit GNOME:

```bash
mkdir -p /etc/xdg/autostart &&
cat > /etc/xdg/autostart/polkit-gnome-authentication-agent-1.desktop << "EOF"
[Desktop Entry]
Name=PolicyKit Authentication Agent
Comment=PolicyKit Authentication Agent
Exec=/usr/libexec/polkit-gnome-authentication-agent-1
Terminal=false
Type=Application
Categories=
NoDisplay=true
OnlyShowIn=GNOME;XFCE;Unity;
AutostartCondition=GNOME3 unless-session gnome
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf polkit-gnome-0.105.tar.xz | head -1 | cut -d/ -f1)"
```


### XScreenSaver-6.15

*BLFS 13.1 · ID `xscreensaver` · Stage E* · *Build time:* 0.4 SBU (Using parallelism=4) · *Disk space:* 379 MB

**Requires:** `gtk3`, `intltool`, `xorg7-app`  
**Recommended (included):** `glu`

**[BUILDER]** — Download:

```bash
cd ~/src
wget -qO- https://www.jwz.org/xscreensaver/download.html | grep -o 'xscreensaver-[0-9.]*\.tar\.gz' | sort -u
wget https://www.jwz.org/xscreensaver/xscreensaver-<VERSION>.tar.gz    # the name the line above printed
```

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xscreensaver-6.15.tar.gz
cd "$(tar -tf xscreensaver-6.15.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS download and build fixes.** jwz.org keeps only the newest release, so 6.15 is gone. Download the current one (the first command shows its name) and use that version wherever this section says `6.15`. jwz.org publishes no MD5. XScreenSaver 6.16 ships a broken `configure` (`syntax error near unexpected token 'external'`); fix it before `./configure` with `sed -i 's/^AM_GNU_GETTEXT(external)$/:/' configure`. If `make` then stops in `po` ("No rule to make target 'default'"), remove `po` from the `SUBDIRS` lines of the top-level `Makefile` (`sed -n '9,10p' Makefile` shows them) and run `make` again: XScreenSaver then runs in English only. Check afterwards: `which xscreensaver-command` and `ls /etc/pam.d/xscreensaver` (the screen lock needs both).

**Build and install:**

**[BUILDER]** — Install XScreenSaver by running the following commands:

```bash
./configure --prefix=/usr --with-systemd &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Issue the following commands as the root user to create the configuration file for Linux PAM:

```bash
cat > /etc/pam.d/xscreensaver << "EOF"
# Begin /etc/pam.d/xscreensaver

auth    include system-auth
account include system-account

# End /etc/pam.d/xscreensaver
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xscreensaver-6.15.tar.gz | head -1 | cut -d/ -f1)"
```


### xfce4-session-4.20.4

*BLFS 13.1 · ID `xfce4-session` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 20 MB

**Requires:** `libwnck`, `libxfce4windowing`, `libxfce4ui`  
**Recommended (included):** `desktop-file-utils`, `xscreensaver`, `shared-mime-info`, `polkit-gnome`  
**Needed at runtime:** `xfdesktop`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfce4-session/4.20/xfce4-session-4.20.4.tar.bz2
```

MD5 sum of `xfce4-session-4.20.4.tar.bz2`: `048a3f838449dd75d358779b528b0a63` (check with `md5sum xfce4-session-4.20.4.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-session-4.20.4.tar.bz2
cd "$(tar -tf xfce4-session-4.20.4.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfce4 Session by running the following commands:

```bash
./configure --prefix=/usr       \
            --sysconfdir=/etc   \
            --disable-legacy-sm &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — When building an Xfce4 package, some configuration files are installed in /usr/share/applications, /usr/share/icons, and /usr/share/mime. In order to use those files in your Xfce4 session, you need to update various databases. Do that by running, as the…

```bash
update-desktop-database &&
update-mime-database /usr/share/mime
```

**Starting Xfce4:**

**[BUILDER]** — *(Optional — skip if unsure)* To start Xfce4 using xinit-1.4.4, run the following commands:

```bash
cat > ~/.xinitrc << "EOF"
dbus-launch --exit-with-x11 startxfce4
EOF

startx
```

**[BUILDER]** — *(Optional — skip if unsure)* The X session starts on the first unused virtual terminal, normally vt7. You can switch to another vtn simultaneously pressing the keys Ctrl-Alt-Fn (n=1, 2, ...). To switch back to the X session, normally started at vt7, use Ctrl-Alt-F7. The vt where the…

```bash
startx &> ~/.x-session-errors
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-session-4.20.4.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Garcon-4.20.0

*BLFS 13.1 · ID `garcon` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 8.6 MB

**Requires:** `libxfce4ui`, `gtk3`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/garcon/4.20/garcon-4.20.0.tar.bz2
```

MD5 sum of `garcon-4.20.0.tar.bz2`: `fe17e9cb15a62013e0086183a446e89e` (check with `md5sum garcon-4.20.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf garcon-4.20.0.tar.bz2
cd "$(tar -tf garcon-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Garcon by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf garcon-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### xfce4-panel-4.20.8

*BLFS 13.1 · ID `xfce4-panel` · Stage E* · *Build time:* 0.2 SBU (Using parallelism=4) · *Disk space:* 62 MB

**Requires:** `cairo`, `exo`, `garcon`, `libwnck`, `libxfce4windowing`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfce4-panel/4.20/xfce4-panel-4.20.8.tar.bz2
```

MD5 sum of `xfce4-panel-4.20.8.tar.bz2`: `c4c7919a07c2c48cffea7a608ea86803` (check with `md5sum xfce4-panel-4.20.8.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-panel-4.20.8.tar.bz2
cd "$(tar -tf xfce4-panel-4.20.8.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfce4 Panel by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-panel-4.20.8.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libnotify-0.8.8

*BLFS 13.1 · ID `libnotify` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 2.2 MB

**Requires:** `gdk-pixbuf`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libnotify/0.8/libnotify-0.8.8.tar.xz
```

MD5 sum of `libnotify-0.8.8.tar.xz`: `35bef24dc1e9a336394556d09345e078` (check with `md5sum libnotify-0.8.8.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libnotify-0.8.8.tar.xz
cd "$(tar -tf libnotify-0.8.8.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS change.** `-D tests=false`: the test programs need GTK 4, which comes later in this stage.

**Build and install:**

**[BUILDER]** — Install libnotify by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            -D gtk_doc=false    \
            -D man=false        \
            -D tests=false      \
            ..                  &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed "/docs_dir =/s@\$@ / 'libnotify'@" \
    -i ../docs/reference/meson.build   &&
meson configure -D gtk_doc=true        &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
if [ -e /usr/share/doc/libnotify ]; then
  rm -rf /usr/share/doc/libnotify-0.8.8
  mv -v  /usr/share/doc/libnotify{,-0.8.8}
fi
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libnotify-0.8.8.tar.xz | head -1 | cut -d/ -f1)"
```


### thunar-4.20.9

*BLFS 13.1 · ID `thunar` · Stage E* · *Build time:* 0.2 SBU (Using parallelism=4) · *Disk space:* 86 MB

**Requires:** `exo`  
**Recommended (included):** `libgudev`, `libnotify`  
**Needed at runtime:** `hicolor-icon-theme`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/thunar/4.20/thunar-4.20.9.tar.bz2
```

MD5 sum of `thunar-4.20.9.tar.bz2`: `7d6daadb0c241ebfaed2684950a67f74` (check with `md5sum thunar-4.20.9.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf thunar-4.20.9.tar.bz2
cd "$(tar -tf thunar-4.20.9.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Thunar by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --docdir=/usr/share/doc/thunar-4.20.9 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf thunar-4.20.9.tar.bz2 | head -1 | cut -d/ -f1)"
```


### thunar-volman-4.20.0

*BLFS 13.1 · ID `thunar-volman` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 7.0 MB

**Requires:** `exo`, `libgudev`  
**Recommended (included):** `libnotify`  
**Needed at runtime:** `gvfs`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/thunar-volman/4.20/thunar-volman-4.20.0.tar.bz2
```

MD5 sum of `thunar-volman-4.20.0.tar.bz2`: `34c8e0af77ea3894db7e3d164998f9bf` (check with `md5sum thunar-volman-4.20.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf thunar-volman-4.20.0.tar.bz2
cd "$(tar -tf thunar-volman-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install the Thunar Volume Manager by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf thunar-volman-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### tumbler-4.20.2

*BLFS 13.1 · ID `tumbler` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 17 MB

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/tumbler/4.20/tumbler-4.20.2.tar.bz2
```

MD5 sum of `tumbler-4.20.2.tar.bz2`: `544cd05cf6ec8d16c8c812529d09b34b` (check with `md5sum tumbler-4.20.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf tumbler-4.20.2.tar.bz2
cd "$(tar -tf tumbler-4.20.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Tumbler by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf tumbler-4.20.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### xfce4-appfinder-4.20.0

*BLFS 13.1 · ID `xfce4-appfinder` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 7.3 MB

**Requires:** `garcon`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfce4-appfinder/4.20/xfce4-appfinder-4.20.0.tar.bz2
```

MD5 sum of `xfce4-appfinder-4.20.0.tar.bz2`: `e60f6c2521a985c6cfe09057d4fb2d69` (check with `md5sum xfce4-appfinder-4.20.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-appfinder-4.20.0.tar.bz2
cd "$(tar -tf xfce4-appfinder-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfce4 Appfinder by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-appfinder-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### UPower-1.91.3

*BLFS 13.1 · ID `upower` · Stage E* · *Build time:* less than 0.1 SBU (add 0.8 SBU for tests) · *Disk space:* 12 MB (with tests)

**Requires:** `libgudev`, `libusb`  
**Recommended (included):** `polkit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/upower/upower/-/archive/v1.91.3/upower-v1.91.3.tar.bz2
```

MD5 sum of `upower-v1.91.3.tar.bz2`: `bf09da2eb695224e249e38077460414c` (check with `md5sum upower-v1.91.3.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf upower-v1.91.3.tar.bz2
cd "$(tar -tf upower-v1.91.3.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install UPower by running the following commands:

```bash
mkdir build               &&
cd    build               &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D gtk-doc=false    \
      -D man=false        &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf upower-v1.91.3.tar.bz2 | head -1 | cut -d/ -f1)"
```


### xfce4-power-manager-4.20.1

*BLFS 13.1 · ID `xfce4-power-manager` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 26 MB

**Requires:** `libnotify`, `upower`, `xfce4-panel`  
**Recommended (included):** `polkit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfce4-power-manager/4.20/xfce4-power-manager-4.20.1.tar.bz2
```

MD5 sum of `xfce4-power-manager-4.20.1.tar.bz2`: `021ff5a9f6111e3bedfad87dddf91420` (check with `md5sum xfce4-power-manager-4.20.1.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-power-manager-4.20.1.tar.bz2
cd "$(tar -tf xfce4-power-manager-4.20.1.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfce4 Power Manager by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-power-manager-4.20.1.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libcanberra-0.30

*BLFS 13.1 · ID `libcanberra` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 7.5 MB

**Requires:** `libvorbis`  
**Recommended (included):** `alsa-lib`, `gstreamer10`, `gtk3`  
**Needed at runtime:** `sound-theme-freedesktop`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://0pointer.de/lennart/projects/libcanberra/libcanberra-0.30.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/libcanberra-0.30-wayland-1.patch
```

MD5 sum of `libcanberra-0.30.tar.xz`: `34cb7e4430afaf6f447c4ebdb9b42072` (check with `md5sum libcanberra-0.30.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libcanberra-0.30.tar.xz
cd "$(tar -tf libcanberra-0.30.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, apply a patch to fix an issue causing some applications to crash in Wayland-based desktop environments:

```bash
patch -Np1 -i ../libcanberra-0.30-wayland-1.patch
```

**[BUILDER]** — Install libcanberra by running the following commands:

```bash
./configure --prefix=/usr --disable-oss &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make docdir=/usr/share/doc/libcanberra-0.30 install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libcanberra-0.30.tar.xz | head -1 | cut -d/ -f1)"
```


### xfce4-settings-4.20.5

*BLFS 13.1 · ID `xfce4-settings` · Stage E* · *Build time:* 0.3 SBU · *Disk space:* 47 MB

**Requires:** `exo`, `garcon`  
**Recommended (included):** `libcanberra`, `libnotify`, `libxklavier`  
**Needed at runtime:** `gnome-icon-theme`, `lxde-icon-theme`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfce4-settings/4.20/xfce4-settings-4.20.5.tar.bz2
```

MD5 sum of `xfce4-settings-4.20.5.tar.bz2`: `681c73af0e2db6f0e13ff61db265556c` (check with `md5sum xfce4-settings-4.20.5.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-settings-4.20.5.tar.bz2
cd "$(tar -tf xfce4-settings-4.20.5.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfce4 Settings by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-settings-4.20.5.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Xfdesktop-4.20.2

*BLFS 13.1 · ID `xfdesktop` · Stage E* · *Build time:* 0.2 SBU · *Disk space:* 35 MB

**Requires:** `exo`, `libxfce4windowing`, `libwnck`  
**Recommended (included):** `libnotify`, `startup-notification`, `thunar`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfdesktop/4.20/xfdesktop-4.20.2.tar.bz2
```

MD5 sum of `xfdesktop-4.20.2.tar.bz2`: `8789870145b82f5ba4f35c8a6522db2e` (check with `md5sum xfdesktop-4.20.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfdesktop-4.20.2.tar.bz2
cd "$(tar -tf xfdesktop-4.20.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfdesktop by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfdesktop-4.20.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Xfwm4-4.20.0

*BLFS 13.1 · ID `xfwm4` · Stage E* · *Build time:* 0.2 SBU · *Disk space:* 26 MB

**Requires:** `libwnck`, `libxfce4ui`  
**Recommended (included):** `startup-notification`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/xfce/xfwm4/4.20/xfwm4-4.20.0.tar.bz2
```

MD5 sum of `xfwm4-4.20.0.tar.bz2`: `e74cfb30b6e9ebf9cbaac0827dd534e3` (check with `md5sum xfwm4-4.20.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfwm4-4.20.0.tar.bz2
cd "$(tar -tf xfwm4-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfwm4 by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfwm4-4.20.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### fast_float-8.2.10

*BLFS 13.1 · ID `fast_float` · Stage E* · *Build time:* less than 0.1 SBU (add 0.3 SBU for tests, depending on network connection) · *Disk space:* 1.5 MB (add 620 MB for tests)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/fastfloat/fast_float/archive/v8.2.10/fast_float-8.2.10.tar.gz
```

MD5 sum of `fast_float-8.2.10.tar.gz`: `ddcf64ffe15f1e1ed964a355db7a04f3` (check with `md5sum fast_float-8.2.10.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf fast_float-8.2.10.tar.gz
cd "$(tar -tf fast_float-8.2.10.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install fast_float by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -G Ninja ..
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf fast_float-8.2.10.tar.gz | head -1 | cut -d/ -f1)"
```


### fmt-12.2.0

*BLFS 13.1 · ID `fmt` · Stage E* · *Build time:* 0.4 SBU (using parallelism=4; with tests) · *Disk space:* 48 MB (with tests)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/fmtlib/fmt/archive/12.2.0/fmt-12.2.0.tar.gz
```

MD5 sum of `fmt-12.2.0.tar.gz`: `7be257d8bfad55bc9eabb1288ad895be` (check with `md5sum fmt-12.2.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf fmt-12.2.0.tar.gz
cd "$(tar -tf fmt-12.2.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install fmt by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr     \
      -D CMAKE_INSTALL_LIBDIR=/usr/lib \
      -D BUILD_SHARED_LIBS=ON          \
      -D FMT_TEST=OFF                  \
      -G Ninja ..                      &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the results, issue:

```bash
cmake -D FMT_TEST=ON .. &&
ninja                   &&
ninja test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf fmt-12.2.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Nettle-4.0

*BLFS 13.1 · ID `nettle` · Stage E* · *Build time:* 0.3 SBU (with tests; both using parallelism=4) · *Disk space:* 106 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.gnu.org/gnu/nettle/nettle-4.0.tar.gz
```

MD5 sum of `nettle-4.0.tar.gz`: `144401453f9f35e53938bcacfc59800e` (check with `md5sum nettle-4.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf nettle-4.0.tar.gz
cd "$(tar -tf nettle-4.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Nettle by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
chmod   -v   755 /usr/lib/lib{hogweed,nettle}.so &&
install -v -m755 -d /usr/share/doc/nettle-4.0 &&
install -v -m644 nettle.{html,pdf} /usr/share/doc/nettle-4.0
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf nettle-4.0.tar.gz | head -1 | cut -d/ -f1)"
```


### GnuTLS-3.8.13

*BLFS 13.1 · ID `gnutls` · Stage E* · *Build time:* 0.6 SBU (add 1.4 SBU for tests; both using parallelism=8) · *Disk space:* 336 MB (with tests)

**Requires:** `nettle`  
**Recommended (included):** `make-ca`, `libunistring`, `libtasn1`, `p11-kit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/gnutls-3.8.13.tar.xz
```

MD5 sum of `gnutls-3.8.13.tar.xz`: `a97671c1839340c6b43c23ccb3237180` (check with `md5sum gnutls-3.8.13.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gnutls-3.8.13.tar.xz
cd "$(tar -tf gnutls-3.8.13.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GnuTLS by running the following commands:

```bash
./configure --prefix=/usr \
            --docdir=/usr/share/doc/gnutls-3.8.13 \
            --with-default-trust-store-pkcs11="pkcs11:" &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, install the package as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gnutls-3.8.13.tar.xz | head -1 | cut -d/ -f1)"
```


### glslc from shaderc-2026.3

*BLFS 13.1 · ID `glslc` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 3.9 MB

**Requires:** `cmake`, `glslang`, `spirv-tools`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/google/shaderc/archive/v2026.3/shaderc-2026.3.tar.gz
```

MD5 sum of `shaderc-2026.3.tar.gz`: `5ce02d42b02a77e6165dbc476d1a334c` (check with `md5sum shaderc-2026.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf shaderc-2026.3.tar.gz
cd "$(tar -tf shaderc-2026.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, allow building with system glslang-16.5.0 and SPIRV-Tools-1.4.357.0:

```bash
sed '/build-version/d'   -i glslc/CMakeLists.txt            &&
sed '/third_party/d'     -i CMakeLists.txt                  &&
sed 's|SPIRV|glslang/&|' -i libshaderc_util/src/compiler.cc &&

echo '"2026.3"' > glslc/src/build-version.inc
```

**[BUILDER]** — Now install glslc by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D SHADERC_SKIP_TESTS=ON     \
      -G Ninja ..
ninja glslc/glslc
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
install -vm755 glslc/glslc /usr/bin
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf shaderc-2026.3.tar.gz | head -1 | cut -d/ -f1)"
```


### Graphene-1.10.8

*BLFS 13.1 · ID `graphene` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 7.6 MB

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/graphene/1.10/graphene-1.10.8.tar.xz
```

MD5 sum of `graphene-1.10.8.tar.xz`: `169e3c507b5a5c26e9af492412070b81` (check with `md5sum graphene-1.10.8.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf graphene-1.10.8.tar.xz
cd "$(tar -tf graphene-1.10.8.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Graphene by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf graphene-1.10.8.tar.xz | head -1 | cut -d/ -f1)"
```


### libdvdread-7.1.1

*BLFS 13.1 · ID `libdvdread` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 2.0 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://get.videolan.org/libdvdread/7.1.1/libdvdread-7.1.1.tar.xz
```

MD5 sum of `libdvdread-7.1.1.tar.xz`: `bfd662e9180dabad03bae95292b38a50` (check with `md5sum libdvdread-7.1.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libdvdread-7.1.1.tar.xz
cd "$(tar -tf libdvdread-7.1.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* First, install the documentation in a versioned directory:

```bash
sed -i "/get_option/s/libdvdread/&-7.1.1/" meson.build
```

**[BUILDER]** — Install libdvdread by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            --default-library=shared .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libdvdread-7.1.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libdvdnav-7.0.0

*BLFS 13.1 · ID `libdvdnav` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 1.4 MB

**Requires:** `libdvdread`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://get.videolan.org/libdvdnav/7.0.0/libdvdnav-7.0.0.tar.xz
```

MD5 sum of `libdvdnav-7.0.0.tar.xz`: `e9e9f137cdd52828abc0c61b727ea579` (check with `md5sum libdvdnav-7.0.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libdvdnav-7.0.0.tar.xz
cd "$(tar -tf libdvdnav-7.0.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* First, install the documentation in a versioned directory:

```bash
sed -i "/get_option/s/libdvdnav/&-7.0.0/" meson.build
```

**[BUILDER]** — Install libdvdnav by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            --default-library=shared .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libdvdnav-7.0.0.tar.xz | head -1 | cut -d/ -f1)"
```


### SoundTouch-2.4.1

*BLFS 13.1 · ID `soundtouch` · Stage E* · *Build time:* 0.2 SBU · *Disk space:* 8.4 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.surina.net/soundtouch/soundtouch-2.4.1.tar.gz
```

MD5 sum of `soundtouch-2.4.1.tar.gz`: `6e8732dea92b6e65fc4ee75528ab0524` (check with `md5sum soundtouch-2.4.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf soundtouch-2.4.1.tar.gz
cd "$(tar -tf soundtouch-2.4.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** The tarball expands to 'soundtouch' instead of the expected 'soundtouch-2.4.1'

> **Warning (BLFS):** The bootstrap command below fails if the ACLOCAL environment variable is set as specified in Introduction to Xorg-7. If it is used, ACLOCAL needs to be unset for this package and then reset for other packages.

**[BUILDER]** — Install SoundTouch by running the following commands:

```bash
./bootstrap &&
./configure --prefix=/usr \
            --docdir=/usr/share/doc/soundtouch-2.4.1 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf soundtouch-2.4.1.tar.gz | head -1 | cut -d/ -f1)"
```


### SVT-AV1-4.2.0

*BLFS 13.1 · ID `svt-av1` · Stage E* · *Build time:* 0.7 SBU (using parallelism=4; add 31 SBU for tests) · *Disk space:* 79 MB (add 668 MB for tests)

**Requires:** `cmake`  
**Recommended (included):** `nasm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.com/AOMediaCodec/SVT-AV1/-/archive/v4.2.0/SVT-AV1-v4.2.0.tar.gz
```

MD5 sum of `SVT-AV1-v4.2.0.tar.gz`: `a40beb25d550ed1ddf26aa372f2dca42` (check with `md5sum SVT-AV1-v4.2.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf SVT-AV1-v4.2.0.tar.gz
cd "$(tar -tf SVT-AV1-v4.2.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install SVT-AV1 by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr   \
      -D CMAKE_BUILD_TYPE=Release    \
      -D CMAKE_SKIP_INSTALL_RPATH=ON \
      -D BUILD_SHARED_LIBS=ON        \
      -W no-author -G Ninja .. &&

ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* The test suite is very long and doesn't provide meaningful results. If you want to test the results anyway, issue:

```bash
cmake .. -D BUILD_TESTING=ON &&
ninja                        &&
ninja TestVectors            &&
SVT_AV1_TEST_VECTOR_PATH=$PWD/../test/vectors \
ctest -V -O testlog.txt --timeout 10800
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf SVT-AV1-v4.2.0.tar.gz | head -1 | cut -d/ -f1)"
```


### gst-plugins-bad-1.28.6

*BLFS 13.1 · ID `gst10-plugins-bad` · Stage E* · *Build time:* 0.7 SBU (Using parallelism=4; with tests) · *Disk space:* 314 MB (with tests)

**Requires:** `gst10-plugins-base`  
**Recommended (included):** `libaom`, `libdvdread`, `libdvdnav`, `libva`, `svt-av1`, `soundtouch`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gstreamer.freedesktop.org/src/gst-plugins-bad/gst-plugins-bad-1.28.6.tar.xz
```

MD5 sum of `gst-plugins-bad-1.28.6.tar.xz`: `cdc3c30609d2d235d9322a676a5d4474` (check with `md5sum gst-plugins-bad-1.28.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gst-plugins-bad-1.28.6.tar.xz
cd "$(tar -tf gst-plugins-bad-1.28.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** If you need a plugin for a given dependency, that dependency needs to be installed before this package.

**[BUILDER]** — Install GStreamer Bad Plug-ins by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D gpl=enabled      &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gst-plugins-bad-1.28.6.tar.xz | head -1 | cut -d/ -f1)"
```


### GTK-4.22.4

*BLFS 13.1 · ID `gtk4` · Stage E* · *Build time:* 1.5 SBU (using parallelism=4; with docs; add 2.1 SBU for tests) · *Disk space:* 1.4 GB (with docs and tests)

**Requires:** `gdk-pixbuf`, `graphene`, `iso-codes`, `libepoxy`, `librsvg`, `libxkbcommon`, `pango`, `pygobject3`, `wayland-protocols`  
**Recommended (included):** `gst10-plugins-bad`, `glslc`, `vulkan-loader`, `glib2`  
**Needed at runtime:** `adwaita-icon-theme`, `gst10-plugins-good`, `xdg-desktop-portal`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gtk/4.22/gtk-4.22.4.tar.xz
```

MD5 sum of `gtk-4.22.4.tar.xz`: `2420b9b289937c1c9f97332470db1889` (check with `md5sum gtk-4.22.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gtk-4.22.4.tar.xz
cd "$(tar -tf gtk-4.22.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GTK 4 by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr            \
            --buildtype=release      \
            -D broadway-backend=true \
            -D introspection=enabled \
            -D vulkan=enabled        \
            .. &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed "s@'doc'@& / 'gtk-4.22.4'@" -i ../docs/reference/meson.build &&
meson configure -D documentation=true                            &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* To run the tests, issue:

```bash
env -u{GALLIUM_DRIVER,MESA_LOADER_DRIVER_OVERRIDE}          \
    LIBGL_ALWAYS_SOFTWARE=1 VK_LOADER_DRIVERS_SELECT='lvp*' \
    dbus-run-session meson test --setup x11                 \
                                --no-suite=headless
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — GTK 4 themes change the way a GTK 4 application looks. An icon theme can be used to change the icons that appear on the application's toolbar. If you have installed a GTK 4 theme (e.g. the Adwaita theme built in GTK 4), an icon theme (such as…

```bash
mkdir -pv ~/.config/gtk-4.0
cat > ~/.config/gtk-4.0/settings.ini << "EOF"
[Settings]
gtk-theme-name = Adwaita
gtk-icon-theme-name = oxygen
gtk-font-name = DejaVu Sans 12
gtk-cursor-theme-size = 18
gtk-xft-antialias = 1
gtk-xft-hinting = 1
gtk-xft-hintstyle = hintslight
gtk-xft-rgba = rgb
gtk-cursor-theme-name = Adwaita
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gtk-4.22.4.tar.xz | head -1 | cut -d/ -f1)"
```


### simdutf-9.0.0

*BLFS 13.1 · ID `simdutf` · Stage E* · *Build time:* 0.3 SBU (add 1.1 SBU for tests) · *Disk space:* 44 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/simdutf/simdutf/archive/v9.0.0/simdutf-9.0.0.tar.gz
```

MD5 sum of `simdutf-9.0.0.tar.gz`: `a20af35e2a7c9737d97b7beae96e7146` (check with `md5sum simdutf-9.0.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf simdutf-9.0.0.tar.gz
cd "$(tar -tf simdutf-9.0.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install simdutf by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr  \
      -D CMAKE_BUILD_TYPE=Release   \
      -D BUILD_SHARED_LIBS=ON       \
      -G Ninja ..                   &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf simdutf-9.0.0.tar.gz | head -1 | cut -d/ -f1)"
```


### VTE-0.84.1

*BLFS 13.1 · ID `vte` · Stage E* · *Build time:* 0.7 SBU (using parallelism=4; with tests) · *Disk space:* 70 MB (with tests)

**Requires:** `libxml2`  
**Recommended (included):** `fast_float`, `fmt`, `icu`, `gnutls`, `glib2`, `gtk3`, `gtk4`, `simdutf`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.gnome.org/GNOME/vte/-/archive/0.84.1/vte-0.84.1.tar.gz
```

MD5 sum of `vte-0.84.1.tar.gz`: `9733f0218f72051999e42725fe5fbaa8` (check with `md5sum vte-0.84.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf vte-0.84.1.tar.gz
cd "$(tar -tf vte-0.84.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install VTE by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed -e "/docdir =/s@\$@/ 'vte-0.84.1'@" \
    -i ../doc/reference/meson.build     &&
meson configure -D docs=true            &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
rm -v /etc/profile.d/vte.*
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf vte-0.84.1.tar.gz | head -1 | cut -d/ -f1)"
```


### xfce4-terminal-1.2.0

*BLFS 13.1 · ID `xfce4-terminal` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 10 MB

**Requires:** `libxfce4ui`, `vte`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/apps/xfce4-terminal/1.2/xfce4-terminal-1.2.0.tar.xz
```

MD5 sum of `xfce4-terminal-1.2.0.tar.xz`: `1662d52f7ffdcfde7c4ef76fd2358947` (check with `md5sum xfce4-terminal-1.2.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-terminal-1.2.0.tar.xz
cd "$(tar -tf xfce4-terminal-1.2.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, work around a problem where functions from a package not in BLFS are used accidentally:

```bash
sed -e '570i #ifdef HAVE_GTK_LAYER_SHELL' \
    -e '574a #endif'                      \
    -i  terminal/terminal-window-dropdown.c
```

**[BUILDER]** — Install Xfce4 Terminal by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..      \
      --prefix=/usr \
      --buildtype=release &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-terminal-1.2.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Aspell-0.60.8.2

*BLFS 13.1 · ID `aspell` · Stage E* · *Build time:* 0.4 SBU · *Disk space:* 56 MB (Additional 8 MB for EN dictionary)

**Requires:** `which`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.gnu.org/gnu/aspell/aspell-0.60.8.2.tar.gz
wget https://ftp.gnu.org/gnu/aspell/dict/en/aspell6-en-2020.12.07-0.tar.bz2
```

MD5 sum of `aspell-0.60.8.2.tar.gz`: `bc3f30321db5d44f112ab66084421225` (check with `md5sum aspell-0.60.8.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf aspell-0.60.8.2.tar.gz
cd "$(tar -tf aspell-0.60.8.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Aspell by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
ln -svfn aspell-0.60 /usr/lib/aspell &&

install -v -m755 -d /usr/share/doc/aspell-0.60.8.2/aspell{,-dev}.html &&

install -v -m644 manual/aspell.html/* \
    /usr/share/doc/aspell-0.60.8.2/aspell.html &&

install -v -m644 manual/aspell-dev.html/* \
    /usr/share/doc/aspell-0.60.8.2/aspell-dev.html
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you do not plan to install Ispell, then copy the wrapper script ispell:

```bash
install -v -m 755 scripts/ispell /usr/bin/
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you do not plan to install Spell, then copy the wrapper script spell:

```bash
install -v -m 755 scripts/spell /usr/bin/
```

**Configure:**

**[BUILDER]** — After Aspell is installed, you must set up at least one dictionary. Install the English dictionary by running the following commands:

```bash
tar xf ../aspell6-en-2020.12.07-0.tar.bz2 &&
cd aspell6-en-2020.12.07-0                &&

./configure &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf aspell-0.60.8.2.tar.gz | head -1 | cut -d/ -f1)"
```


### enchant-2.8.19

*BLFS 13.1 · ID `enchant` · Stage E* · *Build time:* 0.2 SBU (add 0.8 SBU for tests) · *Disk space:* 69 MB (with tests)

**Requires:** `aspell`, `glib2`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/rrthomas/enchant/releases/download/v2.8.19/enchant-2.8.19.tar.gz
```

MD5 sum of `enchant-2.8.19.tar.gz`: `b06fe4ea79687202ec58ce58bd4f5867` (check with `md5sum enchant-2.8.19.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf enchant-2.8.19.tar.gz
cd "$(tar -tf enchant-2.8.19.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install enchant by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --disable-static  \
            --docdir=/usr/share/doc/enchant-2.8.19 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

**[BUILDER]** — You can test your installation and configuration by creating a test file and running the following commands (you can replace the en_GB dictionary by any other downloaded when installing Aspell-0.60.8.2):

```bash
cat > /tmp/test-enchant.txt << "EOF"
Tel me more abot linux
Ther ar so many commads
EOF

enchant-2 -d en_GB -l /tmp/test-enchant.txt &&
enchant-2 -d en_GB -a /tmp/test-enchant.txt
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf enchant-2.8.19.tar.gz | head -1 | cut -d/ -f1)"
```


### gspell-1.14.4

*BLFS 13.1 · ID `gspell` · Stage E* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 7.0 MB (with tests)

**Requires:** `enchant`, `icu`, `gtk3`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gspell/1.14/gspell-1.14.4.tar.xz
```

MD5 sum of `gspell-1.14.4.tar.xz`: `f2baf4a418c57e0dc044d50ffc0dcf62` (check with `md5sum gspell-1.14.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gspell-1.14.4.tar.xz
cd "$(tar -tf gspell-1.14.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install gspell by running the following commands:

```bash
mkdir gspell-build &&
cd    gspell-build &&

meson setup --prefix=/usr --buildtype=release -D gtk_doc=false .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gspell-1.14.4.tar.xz | head -1 | cut -d/ -f1)"
```


### gtksourceview4-4.8.4

*BLFS 13.1 · ID `gtksourceview4` · Stage E* · *Build time:* 0.1 SBU (with tests; both using parallelism=4) · *Disk space:* 71 MB (with tests)

**Requires:** `gtk3`  
**Recommended (included):** `glib2`, `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gtksourceview/4.8/gtksourceview-4.8.4.tar.xz
```

MD5 sum of `gtksourceview-4.8.4.tar.xz`: `2bf056caaae27654ec3a5930dd5597d3` (check with `md5sum gtksourceview-4.8.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gtksourceview-4.8.4.tar.xz
cd "$(tar -tf gtksourceview-4.8.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GtkSourceView by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gtksourceview-4.8.4.tar.xz | head -1 | cut -d/ -f1)"
```


### mousepad-0.7.0

*BLFS 13.1 · ID `mousepad` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 9.2 MB

**Requires:** `gtksourceview4`, `libxfce4ui`  
**Recommended (included):** `gspell`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/apps/mousepad/0.7/mousepad-0.7.0.tar.xz
```

MD5 sum of `mousepad-0.7.0.tar.xz`: `96c09736fd02da599ffedf215313328f` (check with `md5sum mousepad-0.7.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mousepad-0.7.0.tar.xz
cd "$(tar -tf mousepad-0.7.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Mousepad by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release &&

ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mousepad-0.7.0.tar.xz | head -1 | cut -d/ -f1)"
```


### libexif-0.6.26

*BLFS 13.1 · ID `libexif` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 24 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libexif/libexif/releases/download/v0.6.26/libexif-0.6.26.tar.bz2
```

MD5 sum of `libexif-0.6.26.tar.bz2`: `d659a750d1be6330105de54eb3bf627a` (check with `md5sum libexif-0.6.26.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libexif-0.6.26.tar.bz2
cd "$(tar -tf libexif-0.6.26.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libexif by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --with-doc-dir=/usr/share/doc/libexif-0.6.26 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libexif-0.6.26.tar.bz2 | head -1 | cut -d/ -f1)"
```


### ristretto-0.14.0

*BLFS 13.1 · ID `ristretto` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 5.5 MB

**Requires:** `libexif`, `libxfce4ui`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/apps/ristretto/0.14/ristretto-0.14.0.tar.xz
```

MD5 sum of `ristretto-0.14.0.tar.xz`: `63b94c3e3fab28c4533697f36ee6caa2` (check with `md5sum ristretto-0.14.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf ristretto-0.14.0.tar.xz
cd "$(tar -tf ristretto-0.14.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install ristretto by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf ristretto-0.14.0.tar.xz | head -1 | cut -d/ -f1)"
```


### xfce4-notifyd-0.9.7

*BLFS 13.1 · ID `xfce4-notifyd` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 12 MB

**Requires:** `libnotify`, `libxfce4ui`, `libcanberra`, `xfce4-dev-tools`, `xfce4-panel`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/apps/xfce4-notifyd/0.9/xfce4-notifyd-0.9.7.tar.bz2
```

MD5 sum of `xfce4-notifyd-0.9.7.tar.bz2`: `d5bfe1fd8e8da9d64367a1f520d88633` (check with `md5sum xfce4-notifyd-0.9.7.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-notifyd-0.9.7.tar.bz2
cd "$(tar -tf xfce4-notifyd-0.9.7.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install the Xfce4 Notification Daemon by running the following commands:

```bash
./configure --prefix=/usr --sysconfdir=/etc &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — *(Optional — skip if unsure)* You can test the notification daemon with the command notify-send, to be run in a graphical environment. But first, the daemon should be started:

```bash
/usr/lib/xfce4/notifyd/xfce4-notifyd &
notify-send -i info Information "Hi ${USER}, This is a Test"
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-notifyd-0.9.7.tar.bz2 | head -1 | cut -d/ -f1)"
```


### keybinder-3.0-0.3.2

*BLFS 13.1 · ID `keybinder3` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 2.6 MB

**Requires:** `gtk3`  
**Recommended (included):** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/kupferlauncher/keybinder/releases/download/keybinder-3.0-v0.3.2/keybinder-3.0-0.3.2.tar.gz
```

MD5 sum of `keybinder-3.0-0.3.2.tar.gz`: `97260321fda721fce799174ea6ba10cf` (check with `md5sum keybinder-3.0-0.3.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf keybinder-3.0-0.3.2.tar.gz
cd "$(tar -tf keybinder-3.0-0.3.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install keybinder-3.0 by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf keybinder-3.0-0.3.2.tar.gz | head -1 | cut -d/ -f1)"
```


### xfce4-pulseaudio-plugin-0.5.1

*BLFS 13.1 · ID `xfce4-pulseaudio-plugin` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 3.4 MB

**Requires:** `libnotify`, `pulseaudio`, `xfce4-panel`  
**Recommended (included):** `keybinder3`, `libcanberra`, `libxfce4windowing`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/panel-plugins/xfce4-pulseaudio-plugin/0.5/xfce4-pulseaudio-plugin-0.5.1.tar.xz
```

MD5 sum of `xfce4-pulseaudio-plugin-0.5.1.tar.xz`: `186a097794ced3612713c2098ec0b51c` (check with `md5sum xfce4-pulseaudio-plugin-0.5.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfce4-pulseaudio-plugin-0.5.1.tar.xz
cd "$(tar -tf xfce4-pulseaudio-plugin-0.5.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install the Xfce4 Pulseaudio Plugin by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup  --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfce4-pulseaudio-plugin-0.5.1.tar.xz | head -1 | cut -d/ -f1)"
```


### xarchiver-0.5.4.27

*BLFS 13.1 · ID `xarchiver` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 11 MB

**Requires:** `gtk3`, `intltool`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/ib/xarchiver/archive/0.5.4.27/xarchiver-0.5.4.27.tar.gz
```

MD5 sum of `xarchiver-0.5.4.27.tar.gz`: `8a6fb3ab5c0161e3fa05ec6a1faf2c12` (check with `md5sum xarchiver-0.5.4.27.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xarchiver-0.5.4.27.tar.gz
cd "$(tar -tf xarchiver-0.5.4.27.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — BLFS provides unzip as a symlink to bsdunzip from libarchive-3.8.9, but it doesn't work for xarchiver. Adapt xarchiver to use 7zip-26.02 for handling .zip files by default instead:

```bash
sed '/TOGGLE.*prefer_unzip/s/TRUE/FALSE/' -i src/pref_dialog.c
```

> **Side note (BLFS):** If you've already installed and run this package before (maybe in another distro if your /home is a partition shared with that distro), it's likely already configured to prefer unzip. Unset the Prefer unzip for zip files checkbox in the Action => Preferences dialog to change the configuration.

**[BUILDER]** — Install xarchiver by running the following commands:

```bash
./configure  --prefix=/usr               \
             --libexecdir=/usr/lib/xfce4 \
             --docdir=/usr/share/doc/xarchiver-0.5.4.27 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

> **Side note (BLFS):** This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and /usr/share/applications/mimeinfo.cache. To perform the update you must have GTK-3.24.52 installed (for the icon cache) and desktop-file-utils-0.28 (for the desktop cache) and issue the following commands as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and…

```bash
gtk-update-icon-cache -qtf /usr/share/icons/hicolor &&
update-desktop-database -q
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xarchiver-0.5.4.27.tar.gz | head -1 | cut -d/ -f1)"
```


### libassuan-3.0.2

*BLFS 13.1 · ID `libassuan` · Stage E* · *Build time:* 0.1 SBU (with tests and html documentation) · *Disk space:* 6.5 MB (with tests, add 3.4 MB for pdf documentation)

**Requires:** `libgpg-error`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/libassuan/libassuan-3.0.2.tar.bz2
```

MD5 sum of `libassuan-3.0.2.tar.bz2`: `c6f1bf4bd2aaa79cd1635dcc070ba51a` (check with `md5sum libassuan-3.0.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libassuan-3.0.2.tar.bz2
cd "$(tar -tf libassuan-3.0.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libassuan by running the following commands:

```bash
./configure --prefix=/usr &&
make                      &&

make -C doc html                                                       &&
makeinfo --html --no-split -o doc/assuan_nochunks.html doc/assuan.texi &&
makeinfo --plaintext       -o doc/assuan.txt           doc/assuan.texi
```

**[BUILDER]** — *(Optional — skip if unsure)* The above commands build the documentation in html and plaintext formats. If you wish to build alternate formats of the documentation, you must have texlive-20260301-source installed and issue the following commands:

```bash
make -C doc pdf ps
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&

install -v -dm755   /usr/share/doc/libassuan-3.0.2/html &&
install -v -m644 doc/assuan.html/* \
                    /usr/share/doc/libassuan-3.0.2/html &&
install -v -m644 doc/assuan_nochunks.html \
                    /usr/share/doc/libassuan-3.0.2      &&
install -v -m644 doc/assuan.{txt,texi} \
                    /usr/share/doc/libassuan-3.0.2
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built alternate formats of the documentation, install them by running the following commands as the root user:

```bash
install -v -m644  doc/assuan.{pdf,ps,dvi} \
                  /usr/share/doc/libassuan-3.0.2
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libassuan-3.0.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libksba-1.8.0

*BLFS 13.1 · ID `libksba` · Stage E* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 12 MB (with tests)

**Requires:** `libgpg-error`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/libksba/libksba-1.8.0.tar.bz2
```

MD5 sum of `libksba-1.8.0.tar.bz2`: `182951961170c12f6569454717a1383a` (check with `md5sum libksba-1.8.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libksba-1.8.0.tar.bz2
cd "$(tar -tf libksba-1.8.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Libksba by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libksba-1.8.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### npth-1.8

*BLFS 13.1 · ID `npth` · Stage E* · *Build time:* less than 0.1 SBU (with checks) · *Disk space:* 2.9 MB (with checks)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/npth/npth-1.8.tar.bz2
```

MD5 sum of `npth-1.8.tar.bz2`: `cb4fc0402be5ba67544e499cb2c1a74d` (check with `md5sum npth-1.8.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf npth-1.8.tar.bz2
cd "$(tar -tf npth-1.8.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install NPth by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf npth-1.8.tar.bz2 | head -1 | cut -d/ -f1)"
```


### lmdb-1.0.1

*BLFS 13.1 · ID `lmdb` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 8.7 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://git.openldap.org/openldap/openldap/-/archive/LMDB_1.0.1/openldap-LMDB_1.0.1.tar.bz2
```

MD5 sum of `openldap-LMDB_1.0.1.tar.bz2`: `f060b9e036cd5d998b7b3ca1498d7715` (check with `md5sum openldap-LMDB_1.0.1.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf openldap-LMDB_1.0.1.tar.bz2
cd "$(tar -tf openldap-LMDB_1.0.1.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install lmdb by running the following commands:

```bash
cd libraries/liblmdb &&
make                 &&
sed -i 's| liblmdb.a||' Makefile
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make prefix=/usr install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf openldap-LMDB_1.0.1.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Cyrus SASL-2.1.28

*BLFS 13.1 · ID `cyrus-sasl` · Stage E* · *Build time:* 0.2 SBU · *Disk space:* 28 MB

**Recommended (included):** `lmdb`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/cyrusimap/cyrus-sasl/releases/download/cyrus-sasl-2.1.28/cyrus-sasl-2.1.28.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/cyrus-sasl-2.1.28-gcc15_fixes-1.patch
```

MD5 sum of `cyrus-sasl-2.1.28.tar.gz`: `6f228a692516f5318a64505b46966cfa` (check with `md5sum cyrus-sasl-2.1.28.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cyrus-sasl-2.1.28.tar.gz
cd "$(tar -tf cyrus-sasl-2.1.28.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package does not support parallel build.

**[BUILDER]** — First, fix the package to be compatible with gcc-15 and later:

```bash
patch -Np1 -i ../cyrus-sasl-2.1.28-gcc15_fixes-1.patch &&
autoreconf -fiv
```

**[BUILDER]** — Also, fix a problem revealed by gcc-14 and later:

```bash
sed '/saslint/a #include <time.h>'       -i lib/saslutil.c &&
sed '/plugin_common/a #include <time.h>' -i plugins/cram.c
```

**[BUILDER]** — Install Cyrus SASL by running the following commands:

```bash
./configure --prefix=/usr                       \
            --sysconfdir=/etc                   \
            --enable-auth-sasldb                \
            --with-dblib=lmdb                   \
            --with-dbpath=/var/lib/sasl/sasldb2 \
            --with-sphinx-build=no              \
            --with-saslauthd=/var/run/saslauthd &&
make -j1
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -dm755                          /usr/share/doc/cyrus-sasl-2.1.28/html &&
install -v -m644  saslauthd/LDAP_SASLAUTHD /usr/share/doc/cyrus-sasl-2.1.28      &&
install -v -m644  doc/legacy/*.html        /usr/share/doc/cyrus-sasl-2.1.28/html &&
install -v -dm700 /var/lib/sasl
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you need to run the saslauthd daemon at system startup, install the saslauthd.service unit included in the BLFS Systemd Units package using the following command:

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-saslauthd
```

> **Side note (BLFS):** You'll need to modify /etc/default/saslauthd and modify the MECHANISM parameter with your desired authentication mechanism. The default authentication mechanism is "shadow".

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cyrus-sasl-2.1.28.tar.gz | head -1 | cut -d/ -f1)"
```


### OpenLDAP-2.7.0

*BLFS 13.1 · ID `openldap` · Stage E* · *Build time:* 0.3 SBU (client), 0.8 SBU (server) · *Disk space:* 108 MB (client and server)

**Recommended (included):** `cyrus-sasl`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.openldap.org/software/download/OpenLDAP/openldap-release/openldap-2.7.0.tgz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/openldap-2.7.0-consolidated-1.patch
```

MD5 sum of `openldap-2.7.0.tgz`: `fcb40191baba83c1f237d79f85835283` (check with `md5sum openldap-2.7.0.tgz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf openldap-2.7.0.tgz
cd "$(tar -tf openldap-2.7.0.tgz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS: client libraries only.** GnuPG only needs OpenLDAP's client libraries. Follow the book's client-only instructions and skip the `slapd` server parts: the `ldap` user, the server build and configuration, and `make install-slapd`. Check: `ls /usr/lib/libldap.so /usr/lib/liblber.so`.

**Build and install:**

> **Side note (BLFS):** If you only need to install the client side ldap* binaries, corresponding man pages, libraries and header files (referred to as a client-only install), issue these commands instead of the following ones (no test suite available): Then, as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* If you only need to install the client side ldap* binaries, corresponding man pages, libraries and header files (referred to as a client-only install), issue these commands instead of the following ones (no test suite available): Then, as the root user:

```bash
patch -Np1 -i ../openldap-2.7.0-consolidated-1.patch &&
autoconf &&

./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --disable-static  \
            --enable-dynamic  \
            --disable-debug   \
            --disable-slapd   &&

make depend &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you only need to install the client side ldap* binaries, corresponding man pages, libraries and header files (referred to as a client-only install), issue these commands instead of the following ones (no test suite available): Then, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — There should be a dedicated user and group to take control of the slapd daemon after it is started. Issue the following commands as the root user:

```bash
groupadd -g 83 ldap &&
useradd  -c "OpenLDAP Daemon Owner" \
         -d /var/lib/openldap -u 83 \
         -g ldap -s /bin/false ldap
```

**[BUILDER]** — Install OpenLDAP by running the following commands:

```bash
patch -Np1 -i ../openldap-2.7.0-consolidated-1.patch &&
autoconf &&

./configure --prefix=/usr         \
            --sysconfdir=/etc     \
            --localstatedir=/var  \
            --libexecdir=/usr/lib \
            --disable-static      \
            --disable-debug       \
            --with-tls=openssl    \
            --with-cyrus-sasl     \
            --without-systemd     \
            --enable-dynamic      \
            --enable-crypt        \
            --enable-spasswd      \
            --enable-slapd        \
            --enable-modules      \
            --enable-rlookups     \
            --enable-backends=mod \
            --disable-sql         \
            --disable-wt          \
            --enable-overlays=mod &&

make depend &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&

sed -e "s/\.la/.so/" -i /etc/openldap/slapd.{conf,ldif}{,.default} &&

install -v -dm700 -o ldap -g ldap /var/lib/openldap     &&

install -v -dm700 -o ldap -g ldap /etc/openldap/slapd.d &&
chmod   -v    640     /etc/openldap/slapd.{conf,ldif}   &&
chown   -v  root:ldap /etc/openldap/slapd.{conf,ldif}   &&

install -v -dm755 /usr/share/doc/openldap-2.7.0 &&
cp      -vfr      doc/{drafts,rfc,guide} \
                  /usr/share/doc/openldap-2.7.0
```

**Configure:**

> **Warning (BLFS):** The instructions above install an empty LDAP structure and a default /etc/openldap/slapd.conf file, which are suitable for testing the build and other packages using LDAP. Do not use them on a production server.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To automate the startup of the LDAP server at system bootup, install the slapd.service unit included in the BLFS Systemd Units package using the following command:

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-slapd
```

> **Side note (BLFS):** You'll need to modify /etc/default/slapd to include the parameters needed for your specific configuration. See the slapd man page for parameter information.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Start the LDAP server using systemctl:

```bash
systemctl start slapd
```

**[BUILDER]** — Verify access to the LDAP server with the following command:

```bash
ldapsearch -x -b '' -s base '(objectclass=*)' namingContexts
```

*Example only — don't run:* The expected result is:

```text
# extended LDIF
#
# LDAPv3
# base <> with scope baseObject
# filter: (objectclass=*)
# requesting: namingContexts
#

#
dn:
namingContexts: dc=my-domain,dc=com

# search result
search: 2
result: 0 Success

# numResponses: 2
# numEntries: 1
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf openldap-2.7.0.tgz | head -1 | cut -d/ -f1)"
```


### pinentry-1.3.3

*BLFS 13.1 · ID `pinentry` · Stage E* · *Build time:* 0.2 SBU · *Disk space:* 8.4 MB

**Requires:** `libassuan`, `libgpg-error`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/pinentry/pinentry-1.3.3.tar.bz2
```

MD5 sum of `pinentry-1.3.3.tar.bz2`: `59a65644180ac2a43a1235d698515b36` (check with `md5sum pinentry-1.3.3.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pinentry-1.3.3.tar.bz2
cd "$(tar -tf pinentry-1.3.3.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install PIN-Entry by running the following commands:

```bash
./configure --prefix=/usr          \
            --enable-pinentry-tty  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pinentry-1.3.3.tar.bz2 | head -1 | cut -d/ -f1)"
```


### GnuPG-2.5.21

*BLFS 13.1 · ID `gnupg2` · Stage E* · *Build time:* 0.7 SBU (with tests; both using parallelism=4) · *Disk space:* 181 MB (with tests)

**Requires:** `libassuan`, `libgcrypt`, `libksba`, `npth`, `openldap`  
**Recommended (included):** `gnutls`, `pinentry`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/gnupg/gnupg-2.5.21.tar.bz2
```

MD5 sum of `gnupg-2.5.21.tar.bz2`: `39311d55044c9548b5eb8f53466a86b5` (check with `md5sum gnupg-2.5.21.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gnupg-2.5.21.tar.bz2
cd "$(tar -tf gnupg-2.5.21.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GnuPG by running the following commands:

```bash
mkdir build &&
cd    build &&

../configure --prefix=/usr        \
             --localstatedir=/var \
             --sysconfdir=/etc    \
             --docdir=/usr/share/doc/gnupg-2.5.21 &&
make &&

makeinfo --html --no-split -I doc -o doc/gnupg_nochunks.html ../doc/gnupg.texi &&
makeinfo --plaintext       -I doc -o doc/gnupg.txt           ../doc/gnupg.texi &&
make -C doc html
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have texlive-20260301-source installed and you wish to create documentation in the pdf format, issue the following command:

```bash
make -C doc pdf
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Note that if you have already installed <application>GnuPG</application>, the instructions below will overwrite <filename>/usr/share/man/man1/gpg-zip.1</filename>. Now, as the root user:

```bash
make install &&

install -v -m755 -d /usr/share/doc/gnupg-2.5.21/html            &&
install -v -m644    doc/gnupg_nochunks.html \
                    /usr/share/doc/gnupg-2.5.21/html/gnupg.html &&
install -v -m644    ../doc/*.texi doc/gnupg.txt \
                    /usr/share/doc/gnupg-2.5.21 &&
install -v -m644    doc/gnupg.html/* \
                    /usr/share/doc/gnupg-2.5.21/html
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If you created the pdf format of the documentation, install them using the following command as the root user:

```bash
install -v -m644 doc/gnupg.pdf \
                 /usr/share/doc/gnupg-2.5.21
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gnupg-2.5.21.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libsecret-0.21.7

*BLFS 13.1 · ID `libsecret` · Stage E* · *Build time:* 0.3 SBU (with tests) · *Disk space:* 11 MB (with tests)

**Requires:** `glib2`  
**Recommended (included):** `libgcrypt`, `vala`  
**Needed at runtime:** `gnome-keyring`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libsecret/0.21/libsecret-0.21.7.tar.xz
```

MD5 sum of `libsecret-0.21.7.tar.xz`: `7a938a802a3c17df441fbd0358866e99` (check with `md5sum libsecret-0.21.7.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libsecret-0.21.7.tar.xz
cd "$(tar -tf libsecret-0.21.7.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libsecret by running the following commands:

```bash
mkdir bld &&
cd    bld &&

meson setup --prefix=/usr       \
            --buildtype=release \
            -D gtk_doc=false    \
            ..                  &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed "s/api_version_major/'0.21.7'/"            \
    -i ../docs/reference/libsecret/meson.build &&
meson configure -D gtk_doc=true                &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libsecret-0.21.7.tar.xz | head -1 | cut -d/ -f1)"
```


### Gcr-4.4.0.1

*BLFS 13.1 · ID `gcr4` · Stage E* · *Build time:* 0.1 SBU (with tests; both using parallelism=4) · *Disk space:* 26 MB (with tests)

**Requires:** `glib2`, `libgcrypt`, `p11-kit`  
**Recommended (included):** `gnupg2`, `gtk4`, `libsecret`, `libxslt`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gcr/4.4/gcr-4.4.0.1.tar.xz
```

MD5 sum of `gcr-4.4.0.1.tar.xz`: `01da4445b5b16801c6dcc7d8945b4cc4` (check with `md5sum gcr-4.4.0.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gcr-4.4.0.1.tar.xz
cd "$(tar -tf gcr-4.4.0.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** Both gcr-3 and gcr-4 are coinstallable. This version of the package is used to support GTK-4 applications, such as gnome-shell-50.4 and Epiphany-50.6.

**[BUILDER]** — Install Gcr by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            -D gtk_doc=false    \
            ..                  &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed -e "/install_dir/s@,\$@ / 'gcr-4.4.0.1'&@" \
    -i ../docs/*/meson.build                 &&
meson configure -D gtk_doc=true              &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gcr-4.4.0.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libcdio-2.1.0

*BLFS 13.1 · ID `libcdio` · Stage E* · *Build time:* 0.2 SBU (using parallelism=4; both packages, including checks) · *Disk space:* 53 MB (both packages, including checks)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.gnu.org/gnu/libcdio/libcdio-2.1.0.tar.bz2
wget https://ftp.gnu.org/gnu/libcdio/libcdio-paranoia-10.2+2.0.2.tar.bz2
```

MD5 sum of `libcdio-2.1.0.tar.bz2`: `aa7629e8f73662a762f64c444b901055` (check with `md5sum libcdio-2.1.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libcdio-2.1.0.tar.bz2
cd "$(tar -tf libcdio-2.1.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — *(Optional — skip if unsure)* If you are building on an i686 system, fix a build issue caused by large file support: _cdio_generic.c:63:20: error: implicit declaration of function ‘lseek64’

```bash
case $(uname -m) in
   i?86)
      sed '/CDIO_LSEEK/s/lseek64/lseek/'  -i lib/driver/_cdio_generic.c &&
      sed '/CDIO_FSEEK/s/fseeko64/fseek/' -i lib/driver/_cdio_stdio.c   ;;
esac
```

**[BUILDER]** — Install libcdio by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Now install libcdio-paranoia:

```bash
tar -xf ../libcdio-paranoia-10.2+2.0.2.tar.bz2 &&
cd libcdio-paranoia-10.2+2.0.2 &&

./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libcdio-2.1.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### gsettings-desktop-schemas-50.1

*BLFS 13.1 · ID `gsettings-desktop-schemas` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 17 MB

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gsettings-desktop-schemas/50/gsettings-desktop-schemas-50.1.tar.xz
```

MD5 sum of `gsettings-desktop-schemas-50.1.tar.xz`: `b3851a1d2dd684f7ea1a1d032e2a7dfb` (check with `md5sum gsettings-desktop-schemas-50.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gsettings-desktop-schemas-50.1.tar.xz
cd "$(tar -tf gsettings-desktop-schemas-50.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GSettings Desktop Schemas by running the following commands:

```bash
sed -i -r 's:"(/system):"/org/gnome\1:g' schemas/*.in &&

mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

> **Side note (BLFS):** If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

```bash
glib-compile-schemas /usr/share/glib-2.0/schemas
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gsettings-desktop-schemas-50.1.tar.xz | head -1 | cut -d/ -f1)"
```


### glib-networking-2.80.1

*BLFS 13.1 · ID `glib-networking` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 5.9 MB (with tests)

**Requires:** `glib2`, `gnutls`  
**Recommended (included):** `gsettings-desktop-schemas`, `make-ca`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/glib-networking/2.80/glib-networking-2.80.1.tar.xz
```

MD5 sum of `glib-networking-2.80.1.tar.xz`: `405e6c058723217a1307ba8415615f9d` (check with `md5sum glib-networking-2.80.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glib-networking-2.80.1.tar.xz
cd "$(tar -tf glib-networking-2.80.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GLib Networking by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup             \
   --prefix=/usr        \
   --buildtype=release  \
   -D libproxy=disabled \
   .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glib-networking-2.80.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libsoup-3.6.6

*BLFS 13.1 · ID `libsoup3` · Stage E* · *Build time:* 0.4 SBU (Using parallelism=4; with tests) · *Disk space:* 42 MB (with tests)

**Requires:** `glib-networking`, `libpsl`, `libxml2`, `nghttp2`  
**Recommended (included):** `glib2`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libsoup/3.6/libsoup-3.6.6.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/libsoup-3.6.6-upstream_fixes-1.patch
```

MD5 sum of `libsoup-3.6.6.tar.xz`: `9e07742595800ecf301eafb52300dd89` (check with `md5sum libsoup-3.6.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libsoup-3.6.6.tar.xz
cd "$(tar -tf libsoup-3.6.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a security vulnerability that could lead to credential leakage:

```bash
patch -Np1 -i ../libsoup-3.6.6-upstream_fixes-1.patch
```

**[BUILDER]** — *(Optional — skip if unsure)* Fix the installation path of API documentation:

```bash
sed 's/apiversion/soup_version/' -i docs/reference/meson.build
```

**[BUILDER]** — Install libsoup3 by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr          \
            --buildtype=release    \
            --wrap-mode=nofallback \
            ..                     &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libsoup-3.6.6.tar.xz | head -1 | cut -d/ -f1)"
```


### cryptsetup-2.8.7

*BLFS 13.1 · ID `cryptsetup` · Stage E* · *Build time:* 0.2 SBU (add 19 SBU for tests) · *Disk space:* 35 MB (add 5 MB for tests)

**Requires:** `json-c`, `lvm2`, `popt`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.kernel.org/pub/linux/utils/cryptsetup/v2.8/cryptsetup-2.8.7.tar.xz
```

MD5 sum of `cryptsetup-2.8.7.tar.xz`: `a9a19068e4db32f77c0ab95c378ab290` (check with `md5sum cryptsetup-2.8.7.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cryptsetup-2.8.7.tar.xz
cd "$(tar -tf cryptsetup-2.8.7.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install cryptsetup by running the following commands:

```bash
./configure --prefix=/usr       \
            --disable-ssh-token \
            --disable-asciidoc  &&
make
```

*Example only — don't run:* To test the result, issue as the root user: make check. Some tests will fail if appropriate kernel configuration options are not set. Some additional options that may be needed for tests are: CONFIG_SCSI_LOWLEVEL, CONFIG_SCSI_DEBUG,…

```text
CONFIG_SCSI_LOWLEVEL,
CONFIG_SCSI_DEBUG,
CONFIG_BLK_DEV_DM_BUILTIN,
CONFIG_CRC_T10DIF,
CONFIG_CRYPTO_USER,
CONFIG_CRYPTO_CRYPTD,
CONFIG_CRYPTO_LRW,
CONFIG_CRYPTO_XTS,
CONFIG_CRYPTO_ESSIV,
CONFIG_CRYPTO_AES_TI,
CONFIG_CRYPTO_AES_NI_INTEL,
CONFIG_CRYPTO_BLOWFISH,
CONFIG_CRYPTO_CAST5,
CONFIG_CRYPTO_SERPENT,
CONFIG_CRYPTO_SERPENT_SSE2_X86_64,
CONFIG_CRYPTO_SERPENT_AVX_X86_64,
CONFIG_CRYPTO_SERPENT_AVX2_X86_64, and
CONFIG_CRYPTO_TWOFISH_X86_64
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cryptsetup-2.8.7.tar.xz | head -1 | cut -d/ -f1)"
```


### keyutils-1.6.3

*BLFS 13.1 · ID `keyutils` · Stage E* · *Build time:* less than 0.1 SBU (add 0.4 SBU for tests) · *Disk space:* 2.6 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://git.kernel.org/pub/scm/linux/kernel/git/dhowells/keyutils.git/snapshot/keyutils-1.6.3.tar.gz
```

MD5 sum of `keyutils-1.6.3.tar.gz`: `6b70b2b381c1b6d9adfaf66d5d3e7c00` (check with `md5sum keyutils-1.6.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf keyutils-1.6.3.tar.gz
cd "$(tar -tf keyutils-1.6.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install keyutils by running the following commands:

```bash
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make NO_ARLIB=1 LIBDIR=/usr/lib BINDIR=/usr/bin SBINDIR=/usr/sbin install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* The test suite can only run after installing this package. A support file in the test suite needs to be adapted for File 5.48 or newer. To test the results, issue, as the root user:

```bash
sed 's/\$\$/self/' -i tests/toolbox.inc.sh &&
make -k test
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf keyutils-1.6.3.tar.gz | head -1 | cut -d/ -f1)"
```


### libatasmart-0.19

*BLFS 13.1 · ID `libatasmart` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 3 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://0pointer.de/public/libatasmart-0.19.tar.xz
```

MD5 sum of `libatasmart-0.19.tar.xz`: `53afe2b155c36f658e121fe6def33e77` (check with `md5sum libatasmart-0.19.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libatasmart-0.19.tar.xz
cd "$(tar -tf libatasmart-0.19.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libatasmart by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make docdir=/usr/share/doc/libatasmart-0.19 install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libatasmart-0.19.tar.xz | head -1 | cut -d/ -f1)"
```


### libbytesize-2.12

*BLFS 13.1 · ID `libbytesize` · Stage E* · *Build time:* less than 0.1 SBU (including tests) · *Disk space:* 3.6 MB

**Requires:** `pygments`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/storaged-project/libbytesize/releases/download/2.12/libbytesize-2.12.tar.gz
```

MD5 sum of `libbytesize-2.12.tar.gz`: `5314b773b20d1f3acdf3b2bf0c92549f` (check with `md5sum libbytesize-2.12.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libbytesize-2.12.tar.gz
cd "$(tar -tf libbytesize-2.12.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libbytesize by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libbytesize-2.12.tar.gz | head -1 | cut -d/ -f1)"
```


### libnvme-1.16.2

*BLFS 13.1 · ID `libnvme` · Stage E* · *Build time:* 0.1 SBU (including tests) · *Disk space:* 34 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/linux-nvme/libnvme/archive/v1.16.2/libnvme-1.16.2.tar.gz
```

MD5 sum of `libnvme-1.16.2.tar.gz`: `a6554fb50022d762021fc1e949e01520` (check with `md5sum libnvme-1.16.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libnvme-1.16.2.tar.gz
cd "$(tar -tf libnvme-1.16.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libnvme by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release -D libdbus=auto .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libnvme-1.16.2.tar.gz | head -1 | cut -d/ -f1)"
```


### libblockdev-3.5.0

*BLFS 13.1 · ID `libblockdev` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 19 MB

**Requires:** `glib2`  
**Recommended (included):** `cryptsetup`, `keyutils`, `libatasmart`, `libbytesize`, `libnvme`, `lvm2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/storaged-project/libblockdev/releases/download/3.5.0/libblockdev-3.5.0.tar.gz
```

MD5 sum of `libblockdev-3.5.0.tar.gz`: `68448042ea0a2073098fc4ae37b01cbf` (check with `md5sum libblockdev-3.5.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libblockdev-3.5.0.tar.gz
cd "$(tar -tf libblockdev-3.5.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libblockdev by running the following commands:

```bash
./configure --prefix=/usr      \
            --sysconfdir=/etc  \
            --with-python3     \
            --without-escrow   \
            --without-gtk-doc  \
            --without-lvm      \
            --without-lvm_dbus \
            --without-nvdimm   \
            --without-tools    \
            --without-smartmontools &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libblockdev-3.5.0.tar.gz | head -1 | cut -d/ -f1)"
```


### UDisks-2.11.2

*BLFS 13.1 · ID `udisks2` · Stage E* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 68 MB (with tests)

**Requires:** `libblockdev`, `libgudev`, `polkit`  
**Needed at runtime:** `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/storaged-project/udisks/releases/download/udisks-2.11.2/udisks-2.11.2.tar.bz2
```

MD5 sum of `udisks-2.11.2.tar.bz2`: `9e8e8c7f43257bc501b4896f43db9eb8` (check with `md5sum udisks-2.11.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf udisks-2.11.2.tar.bz2
cd "$(tar -tf udisks-2.11.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install UDisks by running the following commands:

```bash
./configure --prefix=/usr        \
            --sysconfdir=/etc    \
            --localstatedir=/var \
            --disable-static     \
            --enable-available-modules &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf udisks-2.11.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Gvfs-1.60.2

*BLFS 13.1 · ID `gvfs` · Stage E* · *Build time:* 0.1 SBU (using parallelism=4) · *Disk space:* 36 MB

**Requires:** `glib2`, `gcr4`, `libusb`, `libsecret`  
**Recommended (included):** `gtk3`, `libcdio`, `libgudev`, `libsoup3`, `udisks2`  
**Needed at runtime:** `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gvfs/1.60/gvfs-1.60.2.tar.xz
```

MD5 sum of `gvfs-1.60.2.tar.xz`: `467f7d017234e5aab24d8e0a4e09deff` (check with `md5sum gvfs-1.60.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gvfs-1.60.2.tar.xz
cd "$(tar -tf gvfs-1.60.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Gvfs by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup               \
      --prefix=/usr       \
      --buildtype=release \
      -D onedrive=false   \
      -D fuse=false       \
      -D gphoto2=false    \
      -D afc=false        \
      -D bluray=false     \
      -D nfs=false        \
      -D mtp=false        \
      -D smb=false        \
      -D dnssd=false      \
      -D goa=false        \
      ..                  &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

> **Side note (BLFS):** If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

```bash
glib-compile-schemas /usr/share/glib-2.0/schemas
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gvfs-1.60.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Lynx-2.9.3

*BLFS 13.1 · ID `lynx` · Stage E* · *Build time:* 0.3 SBU · *Disk space:* 26 MB

**Recommended (included):** `brotli`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://invisible-mirror.net/archives/lynx/tarballs/lynx2.9.3.tar.bz2
```

MD5 sum of `lynx2.9.3.tar.bz2`: `faedd64b8e3cb87ae41197340cc3016a` (check with `md5sum lynx2.9.3.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lynx2.9.3.tar.bz2
cd "$(tar -tf lynx2.9.3.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Lynx by running the following commands:

```bash
./configure --prefix=/usr           \
            --sysconfdir=/etc/lynx  \
            --with-zlib             \
            --with-bzlib            \
            --with-ssl              \
            --with-screen=ncursesw  \
            --enable-ipv6           \
            --enable-locale-charset \
            --enable-nls            \
            --datadir=/usr/share/doc/lynx-2.9.3 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install-full
chgrp -v -R root /usr/share/doc/lynx-2.9.3/lynx_doc
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The proper way to get the display character set is to examine the current locale. However, Lynx does not do this by default. As the root user, change this setting:

```bash
sed -e '/#LOCALE/     a LOCALE_CHARSET:TRUE'     \
    -i /etc/lynx/lynx.cfg
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The built-in editor in Lynx locale-wrong-multibyte-characters. This issue manifests itself in multibyte locales, e.g., as the Backspace key not erasing non-ASCII characters properly, and as incorrect data being sent to the network when one edits the…

```bash
sed -e '/#DEFAULT_ED/ a DEFAULT_EDITOR:vi'       \
    -i /etc/lynx/lynx.cfg
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — By default, Lynx doesn't save cookies between sessions. Again as the root user, change this setting:

```bash
sed -e '/#PERSIST/    a PERSISTENT_COOKIES:TRUE' \
    -i /etc/lynx/lynx.cfg
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lynx2.9.3.tar.bz2 | head -1 | cut -d/ -f1)"
```


### xmlto-0.0.29

*BLFS 13.1 · ID `xmlto` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 1.9 MB (with tests)

**Requires:** `DocBook`, `docbook-xsl`, `libxslt`

**[BUILDER]** — Download:

```bash
cd ~/src
wget -O xmlto-0.0.29.tar.gz https://deb.debian.org/debian/pool/main/x/xmlto/xmlto_0.0.29.orig.tar.bz2
```

MD5 sum of `xmlto-0.0.29.tar.gz`: `9d9e9b2ebfca1e453f5e1599b82c48cc` (check with `md5sum xmlto-0.0.29.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xmlto-0.0.29.tar.gz
cd "$(tar -tf xmlto-0.0.29.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS download fix.** pagure.io no longer serves xmlto. This is Debian's copy of the official 0.0.29 release tarball (bz2 inside; `tar` detects it), with a ready `configure`.

**Build and install:**

**[BUILDER]** — Install xmlto by running the following commands:

```bash
autoreconf -fiv                                  &&
LINKS="/usr/bin/links" ./configure --prefix=/usr &&

make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xmlto-0.0.29.tar.gz | head -1 | cut -d/ -f1)"
```


### xdg-utils-1.2.1

*BLFS 13.1 · ID `xdg-utils` · Stage E* · *Build time:* 2.5 SBU (with tests) · *Disk space:* 3.3 MB (with tests)

**Requires:** `xmlto`, `lynx`  
**Needed at runtime:** `xorg7-app`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/xdg/xdg-utils/-/archive/v1.2.1/xdg-utils-v1.2.1.tar.gz
```

MD5 sum of `xdg-utils-v1.2.1.tar.gz`: `4c72585a98ba8f775cb9e72b066cc0df` (check with `md5sum xdg-utils-v1.2.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xdg-utils-v1.2.1.tar.gz
cd "$(tar -tf xdg-utils-v1.2.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Compile xdg-utils with the following commands:

```bash
./configure --prefix=/usr &&
make
```

> **Warning (BLFS):** The tests for the scripts must be made from an X-Window based session. There are several run-time requirements to run the tests including a browser and an MTA. Running the tests as root user is not recommended.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now install it as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xdg-utils-v1.2.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Xdg-user-dirs-0.20

*BLFS 13.1 · ID `xdg-user-dirs` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 3.6 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/xdg/xdg-user-dirs/-/archive/v0.20/xdg-user-dirs-v0.20.tar.gz
```

MD5 sum of `xdg-user-dirs-v0.20.tar.gz`: `a80c6f2cc9fd3d9870fcda76d73ce3e6` (check with `md5sum xdg-user-dirs-v0.20.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xdg-user-dirs-v0.20.tar.gz
cd "$(tar -tf xdg-user-dirs-v0.20.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xdg-user-dirs by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            -D docs=false       \
            .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xdg-user-dirs-v0.20.tar.gz | head -1 | cut -d/ -f1)"
```


### adwaita-icon-theme-50.0

*BLFS 13.1 · ID `adwaita-icon-theme` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 31 MB

**Requires:** `gtk3`, `librsvg`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/adwaita-icon-theme/50/adwaita-icon-theme-50.0.tar.xz
```

MD5 sum of `adwaita-icon-theme-50.0.tar.xz`: `a03d8d68377a88fcf06e090ba6a6ec2f` (check with `md5sum adwaita-icon-theme-50.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf adwaita-icon-theme-50.0.tar.xz
cd "$(tar -tf adwaita-icon-theme-50.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Adwaita Icon Theme by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Remove any old icons and install the new ones. As the root user:

```bash
rm -rf /usr/share/icons/Adwaita/ &&
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf adwaita-icon-theme-50.0.tar.xz | head -1 | cut -d/ -f1)"
```


### gnome-themes-extra-3.28

*BLFS 13.1 · ID `gnome-themes-extra` · Stage E* · *Build time:* 0.3 SBU · *Disk space:* 40 MB

**Requires:** `gtk3`, `librsvg`, `intltool`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gnome-themes-extra/3.28/gnome-themes-extra-3.28.tar.xz
```

MD5 sum of `gnome-themes-extra-3.28.tar.xz`: `f9f2c6c521948da427f702372e16f826` (check with `md5sum gnome-themes-extra-3.28.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gnome-themes-extra-3.28.tar.xz
cd "$(tar -tf gnome-themes-extra-3.28.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GNOME Themes Extra by running the following commands:

```bash
./configure --prefix=/usr --disable-gtk2-engine &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gnome-themes-extra-3.28.tar.xz | head -1 | cut -d/ -f1)"
```


### TTF and OTF fonts

*BLFS 13.1 · ID `TTF-and-OTF-fonts` · Stage E*

**Configure:**

**[IPRPS CHROOT]** *(root; any folder)* — As a font installation example, consider the installation of the dejavu-fonts. In this particular package, the TTF files are in a subdirectory. From the unpacked source directory, run the following commands as the root user:

```bash
install -v -d -m755 /usr/share/fonts/dejavu &&
install -v -m644 ttf/*.ttf /usr/share/fonts/dejavu &&
fc-cache -v /usr/share/fonts/dejavu
```

> **Side note (BLFS):** Installation of the dejavu-fonts used to be strongly recommended, but the noto-fonts will be used in preference if both have been installed. The only likely reason to now prefer a DejaVu font is that DejaVu-Serif has an open 'g' (Both DejaVu Sans and Noto Sans also use an open 'g'). Other than that, Noto is more up to date with fuller coverage.


### libmbim-1.34.0

*BLFS 13.1 · ID `libmbim` · Stage E* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 23 MB (with tests)

**Recommended (included):** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/mobile-broadband/libmbim/-/archive/1.34.0/libmbim-1.34.0.tar.gz
```

MD5 sum of `libmbim-1.34.0.tar.gz`: `e5c2b38c6a79a047b93cb0c9510bd91f` (check with `md5sum libmbim-1.34.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libmbim-1.34.0.tar.gz
cd "$(tar -tf libmbim-1.34.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libmbim by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                 \
      --prefix=/usr            \
      --buildtype=release      \
      -D bash_completion=false \
      -D man=false             &&

ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libmbim-1.34.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libqmi-1.38.0

*BLFS 13.1 · ID `libqmi` · Stage E* · *Build time:* 0.4 SBU (Using parallelism=4; with tests) · *Disk space:* 75 MB (with tests)

**Requires:** `glib2`, `libgudev`  
**Recommended (included):** `libmbim`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/mobile-broadband/libqmi/-/archive/1.38.0/libqmi-1.38.0.tar.gz
```

MD5 sum of `libqmi-1.38.0.tar.gz`: `4ed2c13150611007f56f84b896449d46` (check with `md5sum libqmi-1.38.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libqmi-1.38.0.tar.gz
cd "$(tar -tf libqmi-1.38.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libqmi by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                 \
      --prefix=/usr            \
      --buildtype=release      \
      -D bash_completion=false \
      -D qrtr=false            \
      -D man=false             &&

ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libqmi-1.38.0.tar.gz | head -1 | cut -d/ -f1)"
```


### ModemManager-1.24.2

*BLFS 13.1 · ID `ModemManager` · Stage E* · *Build time:* 0.3 SBU (Using parallelism=4; with tests) · *Disk space:* 59 MB (with tests)

**Requires:** `libgudev`, `libxslt`  
**Recommended (included):** `glib2`, `libmbim`, `libqmi`, `polkit`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gitlab.freedesktop.org/mobile-broadband/ModemManager/-/archive/1.24.2/ModemManager-1.24.2.tar.gz
```

MD5 sum of `ModemManager-1.24.2.tar.gz`: `b72860c54670f362e947edba160fa98e` (check with `md5sum ModemManager-1.24.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf ModemManager-1.24.2.tar.gz
cd "$(tar -tf ModemManager-1.24.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install ModemManager by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                 \
      --prefix=/usr            \
      --buildtype=release      \
      -D bash_completion=false \
      -D qrtr=false            &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To start the ModemManager daemon at boot, enable the previously installed systemd unit by running the following command as the root user:

```bash
systemctl enable ModemManager
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf ModemManager-1.24.2.tar.gz | head -1 | cut -d/ -f1)"
```


### Gcr-3.41.2

*BLFS 13.1 · ID `gcr` · Stage E* · *Build time:* 0.2 SBU (with tests; both using parallelism=4) · *Disk space:* 33 MB (with tests)

**Requires:** `glib2`, `libgcrypt`, `p11-kit`  
**Recommended (included):** `gnupg2`, `gtk3`, `libsecret`, `libxslt`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gcr/3.41/gcr-3.41.2.tar.xz
```

MD5 sum of `gcr-3.41.2.tar.xz`: `40a754ba44d5e95e4d07656d6302900c` (check with `md5sum gcr-3.41.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gcr-3.41.2.tar.xz
cd "$(tar -tf gcr-3.41.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, apply a fix for building without OpenSSH installed:

```bash
sed '/ssh.add/d; /ssh.agent/d' -i meson.build
```

**[BUILDER]** — Install Gcr by running the following commands:

```bash
sed -i 's:"/desktop:"/org:' schema/*.xml &&

mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            -D gtk_doc=false    \
            -D ssh_agent=false  \
            ..                  &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed -e "/install_dir/s@,\$@ / 'gcr-3.41.2'&@" \
    -i ../docs/*/meson.build                  &&
meson configure -D gtk_doc=true               &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gcr-3.41.2.tar.xz | head -1 | cut -d/ -f1)"
```


### libnma-1.10.6

*BLFS 13.1 · ID `libnma` · Stage E* · *Build time:* 0.1 SBU (Using parallelism=4; with test) · *Disk space:* 15 MB

**Requires:** `gcr`, `gtk3`, `iso-codes`, `NetworkManager`  
**Recommended (included):** `gtk4`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libnma/1.10/libnma-1.10.6.tar.xz
```

MD5 sum of `libnma-1.10.6.tar.xz`: `71c7ce674fea1fae8f1368a7fcb6ff43` (check with `md5sum libnma-1.10.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libnma-1.10.6.tar.xz
cd "$(tar -tf libnma-1.10.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libnma by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D gtk_doc=false    \
      -D libnma_gtk4=true \
      -D mobile_broadband_provider_info=false &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libnma-1.10.6.tar.xz | head -1 | cut -d/ -f1)"
```


### network-manager-applet-1.34.0

*BLFS 13.1 · ID `network-manager-applet` · Stage E* · *Build time:* 0.4 SBU (with tests) · *Disk space:* 46 MB (with tests)

**Requires:** `gtk3`, `libnma`, `libsecret`  
**Recommended (included):** `glib2`, `ModemManager`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/network-manager-applet/1.34/network-manager-applet-1.34.0.tar.xz
```

MD5 sum of `network-manager-applet-1.34.0.tar.xz`: `83ff059aff3a691766d5f0079209e5af` (check with `md5sum network-manager-applet-1.34.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf network-manager-applet-1.34.0.tar.xz
cd "$(tar -tf network-manager-applet-1.34.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install NetworkManager Applet by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D appindicator=no  \
      -D selinux=false    \
      -D team=false       &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf network-manager-applet-1.34.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Bubblewrap-0.11.2

*BLFS 13.1 · ID `bubblewrap` · Stage E* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 3.8 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/containers/bubblewrap/releases/download/v0.11.2/bubblewrap-0.11.2.tar.xz
```

MD5 sum of `bubblewrap-0.11.2.tar.xz`: `6376255e2e505100e01b20c2dafa7faf` (check with `md5sum bubblewrap-0.11.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf bubblewrap-0.11.2.tar.xz
cd "$(tar -tf bubblewrap-0.11.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Bubblewrap by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* Next, if you desire to run the test suite, fix an issue caused by the merged-/usr configuration in LFS:

```bash
sed 's@symlink usr/lib64@ro-bind-try /lib64@' -i ../tests/libtest.sh
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf bubblewrap-0.11.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Fuse-3.18.2

*BLFS 13.1 · ID `fuse3` · Stage E* · *Build time:* 0.1 SBU (add 1.0 SBU for tests) · *Disk space:* 97 MB (with tests and documentation)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libfuse/libfuse/releases/download/fuse-3.18.2/fuse-3.18.2.tar.gz
```

MD5 sum of `fuse-3.18.2.tar.gz`: `43c6f6cd2c1368d916f6fb080eb39cbb` (check with `md5sum fuse-3.18.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf fuse-3.18.2.tar.gz
cd "$(tar -tf fuse-3.18.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Fuse by running the following commands:

```bash
sed -i '/^udev/,$ s/^/#/' util/meson.build &&

mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* The API documentation is included in the package, but if you have Doxygen-1.18.0 installed and wish to rebuild it, issue:

```bash
pushd .. &&
  doxygen doc/Doxyfile &&
popd
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* To test the results, issue the following commands (as the root user):

```bash
python3 -m venv --system-site-packages testenv &&
source testenv/bin/activate                    &&
pip3 install looseversion                      &&
python3 -m pytest
deactivate
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install                  &&
chmod u+s /usr/bin/fusermount3 &&

cd ..                          &&
cp -Rv doc/html -T /usr/share/doc/fuse-3.18.2  &&
install -v -m644   doc/{README.NFS,kernel.txt} \
                   /usr/share/doc/fuse-3.18.2
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Some options regarding mount policy can be set in the file /etc/fuse.conf. To install the file run the following command as the root user:

```bash
cat > /etc/fuse.conf << "EOF"
# Set the maximum number of FUSE mounts allowed to non-root users.
# The default is 1000.
#
#mount_max = 1000

# Allow non-root users to specify the 'allow_other' or 'allow_root'
# mount options.
#
#user_allow_other
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf fuse-3.18.2.tar.gz | head -1 | cut -d/ -f1)"
```


### hicolor-icon-theme-0.18

*BLFS 13.1 · ID `hicolor-icon-theme` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 644 KB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://icon-theme.freedesktop.org/releases/hicolor-icon-theme-0.18.tar.xz
```

MD5 sum of `hicolor-icon-theme-0.18.tar.xz`: `ef14f3af03bcde9ed134aad626bdbaad` (check with `md5sum hicolor-icon-theme-0.18.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf hicolor-icon-theme-0.18.tar.xz
cd "$(tar -tf hicolor-icon-theme-0.18.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install hicolor-icon-theme by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf hicolor-icon-theme-0.18.tar.xz | head -1 | cut -d/ -f1)"
```


### XML::Simple-2.25

*BLFS 13.1 · ID `perl-xml-simple` · Stage E*

**Recommended (included):** `perl-xml-parser`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.cpan.org/authors/id/G/GR/GRANTM/XML-Simple-2.25.tar.gz
```

MD5 sum of `XML-Simple-2.25.tar.gz`: `bb841dce889a26c89a1c2739970e9fbc` (check with `md5sum XML-Simple-2.25.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf XML-Simple-2.25.tar.gz
cd "$(tar -tf XML-Simple-2.25.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** During the configuration process, the build system will complain about missing the XML::SAX::Expat module. If XML::SAX is installed, this module is not necessary as XML::SAX will use the libxml2 package instead. However, if it is not installed, XML::Parser-2.59 will get used instead.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — This module uses the standard build and installation instructions: perl Makefile.PL && make && make test Now, as the root user: make install

```bash
perl Makefile.PL &&
make             &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf XML-Simple-2.25.tar.gz | head -1 | cut -d/ -f1)"
```


### icon-naming-utils-0.8.90

*BLFS 13.1 · ID `icon-naming-utils` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 440 KB

**Requires:** `perl-xml-simple`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://tango.freedesktop.org/releases/icon-naming-utils-0.8.90.tar.bz2
```

MD5 sum of `icon-naming-utils-0.8.90.tar.bz2`: `dd8108b56130b9eedc4042df634efa66` (check with `md5sum icon-naming-utils-0.8.90.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf icon-naming-utils-0.8.90.tar.bz2
cd "$(tar -tf icon-naming-utils-0.8.90.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install icon-naming-utils by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf icon-naming-utils-0.8.90.tar.bz2 | head -1 | cut -d/ -f1)"
```


### gnome-icon-theme-3.12.0

*BLFS 13.1 · ID `gnome-icon-theme` · Stage E* · *Build time:* 0.5 SBU · *Disk space:* 85 MB

**Requires:** `gtk3`, `hicolor-icon-theme`, `icon-naming-utils`, `intltool`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gnome-icon-theme/3.12/gnome-icon-theme-3.12.0.tar.xz
```

MD5 sum of `gnome-icon-theme-3.12.0.tar.xz`: `f14bed7f804e843189ffa7021141addd` (check with `md5sum gnome-icon-theme-3.12.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gnome-icon-theme-3.12.0.tar.xz
cd "$(tar -tf gnome-icon-theme-3.12.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GNOME Icon Theme by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gnome-icon-theme-3.12.0.tar.xz | head -1 | cut -d/ -f1)"
```


### gnome-keyring-50.0

*BLFS 13.1 · ID `gnome-keyring` · Stage E* · *Build time:* 0.1 SBU (Using parallelism=4; add 0.2 SBU for tests) · *Disk space:* 38 MB

**Requires:** `gcr`  
**Recommended (included):** `linux-pam`, `libxslt`, `openssh`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gnome-keyring/50/gnome-keyring-50.0.tar.xz
```

MD5 sum of `gnome-keyring-50.0.tar.xz`: `406fb764c664de580a091527af059750` (check with `md5sum gnome-keyring-50.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gnome-keyring-50.0.tar.xz
cd "$(tar -tf gnome-keyring-50.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GNOME Keyring by running the following commands:

```bash
sed -i 's:"/desktop:"/org:' schema/*.xml &&

mkdir build-gkr &&
cd    build-gkr &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gnome-keyring-50.0.tar.xz | head -1 | cut -d/ -f1)"
```


### LAME-3.100

*BLFS 13.1 · ID `lame` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 9.7 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/lame/lame-3.100.tar.gz
```

MD5 sum of `lame-3.100.tar.gz`: `83e260acbe4389b54fe08e0bdbf7cddb` (check with `md5sum lame-3.100.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lame-3.100.tar.gz
cd "$(tar -tf lame-3.100.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Prevent the source code directory from being mistakenly hardcoded as a shared library search path in the installed programs:

```bash
sed -i -e 's/^\(\s*hardcode_libdir_flag_spec\s*=\).*/\1/' configure
```

**[BUILDER]** — Install LAME by running the following commands:

```bash
./configure --prefix=/usr --enable-mp3rtp --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make pkghtmldir=/usr/share/doc/lame-3.100 install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lame-3.100.tar.gz | head -1 | cut -d/ -f1)"
```


### libvpx-1.16.0

*BLFS 13.1 · ID `libvpx` · Stage E* · *Build time:* 0.4 SBU (Using parallelism=4; add approx 11 SBU for tests using parallelism=4, including download time) · *Disk space:* 73 MB (add 1.7 GB for tests)

**Recommended (included):** `yasm`, `which`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/webmproject/libvpx/archive/v1.16.0/libvpx-1.16.0.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/libvpx-1.16.0-security_fix-1.patch
```

MD5 sum of `libvpx-1.16.0.tar.gz`: `fb51551487ecfdec93f3d243b7fb1a67` (check with `md5sum libvpx-1.16.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libvpx-1.16.0.tar.gz
cd "$(tar -tf libvpx-1.16.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — If upgrading from a previous version of libvpx, update the timestamps of all the files to prevent the build system from retaining the files from the old installation:

```bash
find -type f | xargs touch
```

**[BUILDER]** — Next, fix a security vulnerability:

```bash
patch -Np1 -i ../libvpx-1.16.0-security_fix-1.patch
```

**[BUILDER]** — Install libvpx by running the following commands:

```bash
sed -i 's/cp -p/cp/' build/make/Makefile &&

mkdir libvpx-build            &&
cd    libvpx-build            &&

../configure --prefix=/usr    \
             --enable-shared  \
             --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libvpx-1.16.0.tar.gz | head -1 | cut -d/ -f1)"
```


### mpg123-1.33.7

*BLFS 13.1 · ID `mpg123` · Stage E* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 20 MB (with tests)

**Recommended (included):** `alsa-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/mpg123/mpg123-1.33.7.tar.bz2
```

MD5 sum of `mpg123-1.33.7.tar.bz2`: `46ceab9bfb0f04e739f010b88de5943d` (check with `md5sum mpg123-1.33.7.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mpg123-1.33.7.tar.bz2
cd "$(tar -tf mpg123-1.33.7.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install mpg123 by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mpg123-1.33.7.tar.bz2 | head -1 | cut -d/ -f1)"
```


### gst-plugins-good-1.28.6

*BLFS 13.1 · ID `gst10-plugins-good` · Stage E* · *Build time:* 0.6 SBU (Using parallelism=4; with tests) · *Disk space:* 130 MB (with tests)

**Requires:** `gst10-plugins-base`  
**Recommended (included):** `cairo`, `flac`, `gdk-pixbuf`, `lame`, `libsoup3`, `libvpx`, `mpg123`, `nasm`, `pulseaudio`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://gstreamer.freedesktop.org/src/gst-plugins-good/gst-plugins-good-1.28.6.tar.xz
```

MD5 sum of `gst-plugins-good-1.28.6.tar.xz`: `d84c17388909e98e7f7d81bb2717327c` (check with `md5sum gst-plugins-good-1.28.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gst-plugins-good-1.28.6.tar.xz
cd "$(tar -tf gst-plugins-good-1.28.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** If you need a plugin for a given dependency, that dependency needs to be installed before this package.

**[BUILDER]** — Install GStreamer Good Plug-ins by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gst-plugins-good-1.28.6.tar.xz | head -1 | cut -d/ -f1)"
```


### json-glib-1.10.8

*BLFS 13.1 · ID `json-glib` · Stage E* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 15 MB (with tests)

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/json-glib/1.10/json-glib-1.10.8.tar.xz
```

MD5 sum of `json-glib-1.10.8.tar.xz`: `95c3d5dd56d4ada808480739889b75bc` (check with `md5sum json-glib-1.10.8.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf json-glib-1.10.8.tar.xz
cd "$(tar -tf json-glib-1.10.8.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install json glib by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[BUILDER]** — If docutils-0.23 is installed, build the man pages:

```bash
meson configure -D man=true &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If Gi-DocGen-2026.1 is installed, build the API documentation:

```bash
sed "/json_docdir =/s|$| / 'json-glib-1.10.8'|" -i ../doc/meson.build &&
meson configure -D documentation=enabled &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf json-glib-1.10.8.tar.xz | head -1 | cut -d/ -f1)"
```


### lxde-icon-theme-0.5.1

*BLFS 13.1 · ID `lxde-icon-theme` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 18 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/lxde/lxde-icon-theme-0.5.1.tar.xz
```

MD5 sum of `lxde-icon-theme-0.5.1.tar.xz`: `7467133275edbbcc79349379235d4411` (check with `md5sum lxde-icon-theme-0.5.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf lxde-icon-theme-0.5.1.tar.xz
cd "$(tar -tf lxde-icon-theme-0.5.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install LXDE Icon Theme by running the following commands:

```bash
./configure --prefix=/usr
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have installed one of the optional dependencies, run the following command as the root user:

```bash
gtk-update-icon-cache -qf /usr/share/icons/nuoveXT2
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf lxde-icon-theme-0.5.1.tar.xz | head -1 | cut -d/ -f1)"
```


### sound-theme-freedesktop-0.8

*BLFS 13.1 · ID `sound-theme-freedesktop` · Stage E* · *Build time:* less than 0.1 SBU · *Disk space:* 2 MB

**Requires:** `intltool`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://people.freedesktop.org/~mccann/dist/sound-theme-freedesktop-0.8.tar.bz2
```

MD5 sum of `sound-theme-freedesktop-0.8.tar.bz2`: `d7387912cfd275282d1ec94483cb2f62` (check with `md5sum sound-theme-freedesktop-0.8.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf sound-theme-freedesktop-0.8.tar.bz2
cd "$(tar -tf sound-theme-freedesktop-0.8.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Sound Theme Freedesktop by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf sound-theme-freedesktop-0.8.tar.bz2 | head -1 | cut -d/ -f1)"
```


### xdg-desktop-portal-1.22.1

*BLFS 13.1 · ID `xdg-desktop-portal` · Stage E* · *Build time:* 0.1 SBU (add 0.1 SBU for tests; with parallelism=4) · *Disk space:* 36 MB (add 3 MB for tests)

**Requires:** `fuse3`, `gdk-pixbuf`, `json-glib`, `pipewire`  
**Recommended (included):** `bubblewrap`  
**Needed at runtime:** `xdg-desktop-portal-gtk`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/flatpak/xdg-desktop-portal/releases/download/1.22.1/xdg-desktop-portal-1.22.1.tar.xz
```

MD5 sum of `xdg-desktop-portal-1.22.1.tar.xz`: `edfbfffe55a35920a303404b6c5d49a0` (check with `md5sum xdg-desktop-portal-1.22.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xdg-desktop-portal-1.22.1.tar.xz
cd "$(tar -tf xdg-desktop-portal-1.22.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install xdg-desktop-portal by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release -D tests=disabled .. &&
ninja
```

**[BUILDER]** — If the optional dependencies are installed, you can test the results by running:

```bash
meson configure -D tests=enabled &&
ninja test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xdg-desktop-portal-1.22.1.tar.xz | head -1 | cut -d/ -f1)"
```


### xdg-desktop-portal-gtk-1.15.3

*BLFS 13.1 · ID `xdg-desktop-portal-gtk` · Stage E* · *Build time:* 0.1 SBU · *Disk space:* 6.6 MB

**Requires:** `gtk3`, `xdg-desktop-portal`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/flatpak/xdg-desktop-portal-gtk/releases/download/1.15.3/xdg-desktop-portal-gtk-1.15.3.tar.xz
```

MD5 sum of `xdg-desktop-portal-gtk-1.15.3.tar.xz`: `2d6e2ad2953c386a1db11618fa3803b0` (check with `md5sum xdg-desktop-portal-gtk-1.15.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xdg-desktop-portal-gtk-1.15.3.tar.xz
cd "$(tar -tf xdg-desktop-portal-gtk-1.15.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS change.** The wallpaper portal needs GNOME Desktop, which IPRPS OS doesn't build (Xfce sets its own wallpapers). If `meson` still asks for `gnome-desktop-3.0`, also add `-D settings=disabled`.

**Build and install:**

**[BUILDER]** — Install xdg-desktop-portal-gtk by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release -D wallpaper=disabled .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xdg-desktop-portal-gtk-1.15.3.tar.xz | head -1 | cut -d/ -f1)"
```



Enable the graphical login, as root:

**[IPRPS CHROOT]**

```bash
systemctl enable lightdm.service
systemctl set-default graphical.target
```

> **Checkpoint:** Boot-test a copy (1.4). The LightDM login screen appears, and logging in as `builder` opens Xfce. Take snapshot **`E-desktop`**.

**[DEBIAN ROOT]** — snapshot `E-desktop`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-E-desktop.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-E-desktop.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 9 — The IPRPS Desktop

This is where Xfce becomes the **IPRPS Desktop**: branded, organized for Session Masters, and identical for every new user. Everything goes into system-wide defaults (`/etc/xdg`, `/etc/skel`, `/usr/share`), so each new account starts out fully set up.

### 9.1 Identity

As root:

**[IPRPS CHROOT]**

```bash
cat > /etc/os-release << "EOF"
NAME="IPRPS OS"
VERSION="1.0"
ID=iprps-os
ID_LIKE=lfs
VERSION_ID=1.0
PRETTY_NAME="IPRPS OS 1.0"
HOME_URL="https://infiniteplane.space/"
EOF
cat > /etc/lsb-release << "EOF"
DISTRIB_ID="IPRPS OS"
DISTRIB_RELEASE="1.0"
DISTRIB_DESCRIPTION="IPRPS OS 1.0"
EOF
cat > /etc/issue << "EOF"
IPRPS OS 1.0 — \n (\l)

EOF
```

Each edition's release step (Part 14) sets `VERSION` and `PRETTY_NAME` to include the edition, for example `1.0 Lite`.

### 9.2 Artwork

The artwork comes from Windows. Each file travels **Windows → Debian (`/mnt/c/...`) → `/build/src` → its place in the image**.

| File in the image | Size | Used for |
|---|---|---|
| `/usr/share/backgrounds/iprps/iprps-login.png` | 1920×1080 | LightDM login screen (the IPRPS plane with castles and dice) |
| `/usr/share/backgrounds/iprps/iprps-default.png` | 16:9, about 2700×1536 | Desktop wallpaper (the IPRPS logo on black) |
| `/usr/share/iprps/icons/*.png` | 256×256, 24 files | The **IPRPS icon theme** (9.3) and the IPRPS launchers |
| `/boot/grub/iprps-grub.png` | 1920×1080 | GRUB boot menu background (optional, 9.5) |

Images that aren't exactly 16:9 are trimmed to 16:9 first (centred), so they fill a 16:9 screen without black bars. The repository's `artwork/` folder keeps the finished files.

**1. Copy them in. [DEBIAN ROOT]** (the files are in your Windows Downloads folder; the icons in a folder `iprps-icons`):

```bash
cp -v /mnt/c/Users/<you>/Downloads/iprps-login.png /mnt/c/Users/<you>/Downloads/iprps-default.png /build/src/
mkdir -p /build/src/iprps-icons
cp -v /mnt/c/Users/<you>/Downloads/iprps-icons/*.png /build/src/iprps-icons/
ls /build/src/iprps-icons | wc -l       # 24
```

Windows file names with spaces or capitals make poor icon names; rename them in `/build/src/iprps-icons` first: `for f in *.png; do n=$(echo "$f" | tr 'A-Z ' 'a-z-'); [ "$f" != "$n" ] && mv -v "$f" "$n"; done`.

**2. Check the chroot sees them. [IPRPS CHROOT]**

```bash
ls /build/src/iprps-login.png /build/src/iprps-default.png
ls /build/src/iprps-icons/*.png | wc -l    # 24
```

If the chroot doesn't see files that Debian has in `/build/src`, Debian's `/build` isn't connected to this chroot session (`findmnt /mnt/iprps/build` in DEBIAN ROOT prints nothing). Copy straight into the image instead (`cp -v ... /mnt/iprps/build/src/`), and reconnect next time: leave the chroot, run `iprps-leave.sh`, then `iprps-enter.sh` again.

**3. Install them. [IPRPS CHROOT]**

```bash
install -vdm755 /usr/share/backgrounds/iprps /usr/share/iprps/{icons,schema,branding}
install -v -m644 /build/src/iprps-login.png /build/src/iprps-default.png /usr/share/backgrounds/iprps/
install -v -m644 /build/src/iprps-icons/*.png /usr/share/iprps/icons/
```

`-m644` matters: the login screen runs as the `lightdm` user, which must be able to read the image.

### 9.3 Theme, icons and fonts (system-wide defaults)

As root:

**[IPRPS CHROOT]**

```bash
install -vdm755 /etc/xdg/xfce4/xfconf/xfce-perchannel-xml
cat > /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml << "EOF"
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xsettings" version="1.0">
  <property name="Net" type="empty">
    <property name="ThemeName" type="string" value="Adwaita-dark"/>
    <property name="IconThemeName" type="string" value="IPRPS"/>
  </property>
  <property name="Gtk" type="empty">
    <property name="FontName" type="string" value="DejaVu Sans 10"/>
    <property name="MonospaceFontName" type="string" value="DejaVu Sans Mono 10"/>
  </property>
</channel>
EOF
```

`Adwaita-dark` comes from the gnome-themes-extra package (Stage E). `IPRPS` is the icon theme built next.

**The IPRPS icon theme.** It layers your 24 icons on top of Adwaita: wherever Xfce asks for an icon you made (home, trash, terminal and so on), it gets yours; Adwaita covers the rest. Each icon is linked under the standard names Xfce uses, and also as `iprps-<name>` for IPRPS's own launchers.

| Icon | Standard names | Where it shows |
|---|---|---|
| folder-home, folder-desktop, folder-documents, folder-downloads, folder-music, folder-pictures, folder-videos | `user-home`, `user-desktop`, `folder-documents`, `folder-download`, `folder-music`, `folder-pictures`, `folder-videos` | Home and the standard folders |
| folder-network, network | `folder-remote`, `network-workgroup` | Network folders, Browse Network |
| file-system | `drive-harddisk` | File System |
| trash | `user-trash`, `user-trash-full` | Trash |
| finder | `system-file-manager`, `org.xfce.thunar` | File manager |
| terminal | `utilities-terminal`, `org.xfce.terminal`, `org.xfce.terminalemulator` | Terminal |
| internet | `applications-internet`, `web-browser`, `org.xfce.webbrowser` | Internet category, browser |
| settings | `preferences-system`, `preferences-desktop`, `org.xfce.settings.manager` | Settings |
| security | `preferences-system-privacy` | Privacy and security settings |
| audio | `applications-multimedia`, `multimedia-volume-control` | Multimedia category, volume |
| menu | `org.xfce.panel.applicationsmenu`, `start-here` | The panel's Applications menu button |
| apps | `applications-other`, `applications-all` | Other category |
| home | `go-home` | Go-home buttons |
| folder-rpg-vault, folder-archives, folder-code-scripts, folder-root-system | `iprps-` names only | IPRPS's own folders and launchers |

**[IPRPS CHROOT]** (the icons are in `/usr/share/iprps/icons` from 9.2)

```bash
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
```

The final count is about **60** (24 `iprps-*` names, 31 standard names and 5 lines of `ls` headings). **36** means the 24 icons weren't found in `/usr/share/iprps/icons`.

> **Side note:** `Type=Scalable` with `MinSize=16` lets GTK scale the 256-pixel icons down for the panel and menus. There's no plain `folder` icon, so ordinary folders keep Adwaita's look; add a `folder.png` and link it as `places/folder` to change that.

**If the icons don't show up in a test boot**, check the build image. **[IPRPS CHROOT]**

```bash
ls /usr/share/iprps/icons/*.png | wc -l                                  # 24
find /usr/share/icons/IPRPS -xtype l | wc -l                             # 0 broken links
ls /usr/share/icons/IPRPS/256x256/*/ | wc -l                             # about 60
ls -l /usr/share/icons/IPRPS/index.theme /usr/share/icons/IPRPS/icon-theme.cache
grep IconThemeName /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml   # value="IPRPS"
grep icon-theme /etc/lightdm/lightdm-gtk-greeter.conf                    # IPRPS
```

Any wrong answer: install the icons again (9.2 step 3) and rerun the block above; it starts with `rm -rf` of the theme, so it's safe to repeat. If everything is right, the test copy is probably older than the change (make a fresh one), or the test user has an icon setting of its own (next note). Appendix C.6 shows users and administrators how to add their own icons later.

> **Side note:** Users who logged in before the theme existed may keep their own saved setting. Change it for them, in their desktop session, with `xfconf-query -c xsettings -p /Net/IconThemeName -s IPRPS`.

### 9.4 Login screen (LightDM)

**[IPRPS CHROOT]**

```bash
cat > /etc/lightdm/lightdm-gtk-greeter.conf << "EOF"
[greeter]
background=/usr/share/backgrounds/iprps/iprps-login.png
theme-name=Adwaita-dark
icon-theme-name=IPRPS
font-name=DejaVu Sans 11
clock-format=%A %d %B, %H:%M
EOF
grep -n -E '^\s*#?\s*(greeter-session|user-session)' /etc/lightdm/lightdm.conf
```

Check that the login screen can read its picture, and that the file has exactly the six lines above:

**[IPRPS CHROOT]**

```bash
cat /etc/lightdm/lightdm-gtk-greeter.conf
sudo -u lightdm test -r /usr/share/backgrounds/iprps/iprps-login.png && echo "lightdm can read it"
```

If it doesn't print **lightdm can read it**: `chmod 755 /usr/share/backgrounds /usr/share/backgrounds/iprps` and `chmod 644 /usr/share/backgrounds/iprps/*.png`.

In `/etc/lightdm/lightdm.conf`, under `[Seat:*]`, make sure these two lines are set (uncommented): `greeter-session=lightdm-gtk-greeter` and `user-session=xfce`.

### 9.5 GRUB background (optional)

Add these lines near the top of `/boot/grub/grub.cfg`, after `insmod all_video`:

```text
insmod png
insmod gfxterm
terminal_output gfxterm
background_image /boot/grub/iprps-grub.png
```

### 9.6 The IPRPS menu

Add an **IPRPS** category to the applications menu. As root:

**[IPRPS CHROOT]**

```bash
install -vdm755 /etc/xdg/menus/applications-merged /usr/share/desktop-directories
cat > /usr/share/desktop-directories/iprps.directory << "EOF"
[Desktop Entry]
Type=Directory
Name=IPRPS
Comment=Infinite Plane Role Playing System tools
Icon=/usr/share/iprps/icons/iprps-logo.png
EOF
cat > /etc/xdg/menus/applications-merged/iprps.menu << "EOF"
<!DOCTYPE Menu PUBLIC "-//freedesktop//DTD Menu 1.0//EN"
 "http://www.freedesktop.org/standards/menu-spec/1.0/menu.dtd">
<Menu>
  <Name>Applications</Name>
  <Menu>
    <Name>IPRPS</Name>
    <Directory>iprps.directory</Directory>
    <Include>
      <Category>X-IPRPS</Category>
    </Include>
  </Menu>
</Menu>
EOF
grep -n -i 'MergeDir\|DefaultMergeDirs' /etc/xdg/menus/xfce-applications.menu
```

The last command checks that Xfce's menu reads merged menus. It should show a `DefaultMergeDirs` or `MergeDir` line. Any `.desktop` file with `Categories=X-IPRPS;` now appears under **IPRPS** (Part 12 creates them).

### 9.7 Panel layout and wallpaper for every new user

The reliable way to ship an Xfce layout is to **design it once, then make it the default**. **Do this after Part 12**, when the IPRPS launchers (Session Master Mode, the Hub) exist; until then, new users get Xfce's normal panel. The design happens in a **test VM** (builder never logs in to a desktop in the build image), and is then copied into the build image.

1. Boot a fresh test copy and log in as `builder`. If Xfce asks about the panel, choose **Use default config**. Arrange the panel (right-click it → **Panel** → **Panel Preferences**): an **IPRPS** launcher group, the volume, network and battery indicators, and a **Session Master Mode** button. **Log out**, then shut the VM down.
2. Copy the layout from the test copy into the build image, with an IPRPS CHROOT window open (so the build image is mounted at `/mnt/iprps`):

**[DEBIAN ROOT]**

```bash
pgrep -a qemu || echo "No QEMU running"
L=$(losetup -fP --show -r /root/iprps-test.img)
mkdir -p /mnt/iprps-test && mount -o ro ${L}p3 /mnt/iprps-test
P=/mnt/iprps-test/home/builder/.config/xfce4
ls -l $P/xfconf/xfce-perchannel-xml/xfce4-panel.xml $P/panel/
install -vdm755 /mnt/iprps/etc/xdg/xfce4/panel /mnt/iprps/etc/skel/.config/xfce4/panel
cp -v $P/xfconf/xfce-perchannel-xml/xfce4-panel.xml /mnt/iprps/etc/xdg/xfce4/panel/default.xml
cp -rv $P/panel/launcher-* /mnt/iprps/etc/skel/.config/xfce4/panel/ 2>/dev/null || echo "(no launchers to copy)"
umount /mnt/iprps-test && losetup -d $L
```

`-r` and `-o ro` keep the test copy untouched. The panel file and the `launcher-*` folders must be copied together: the layout refers to the launchers by those folder names. Check with a fresh test copy and a new user (`useradd -m -G users,audio,video tester && passwd tester`): they get your panel without the first-run question.

**Wallpaper for every monitor.** Xfce stores wallpapers per monitor name, which differs between machines, so a one-time login script sets it. It waits up to 30 seconds for Xfce's desktop, also covers every connected monitor (`xrandr`), uses the Zoomed style so the image keeps its proportions, and only marks itself done once a wallpaper was actually set:

**[IPRPS CHROOT]**

```bash
cat > /usr/bin/iprps-wallpaper << "EOF"
#!/bin/bash
# Apply the IPRPS wallpaper on every monitor and workspace (once per user)
IMG=/usr/share/backgrounds/iprps/iprps-default.png
DONE="$HOME/.config/iprps/wallpaper-done"
[ -f "$DONE" ] && exit 0
for i in $(seq 1 30); do
  props=$(xfconf-query -c xfce4-desktop -l 2>/dev/null | grep last-image)
  [ -n "$props" ] && break
  sleep 1
done
for m in $(xrandr --listmonitors 2>/dev/null | awk "NR>1{print \$NF}"); do
  props="$props /backdrop/screen0/monitor$m/workspace0/last-image"
done
n=0
for p in $(echo $props | tr " " "\n" | sort -u); do
  xfconf-query -c xfce4-desktop -p "$p" -n -t string -s "$IMG" && n=$((n+1))
  xfconf-query -c xfce4-desktop -p "${p%last-image}image-style" -n -t int -s 5
done
[ "$n" -gt 0 ] && mkdir -p "$HOME/.config/iprps" && touch "$DONE"
EOF
chmod 755 /usr/bin/iprps-wallpaper
install -vdm755 /etc/xdg/autostart
cat > /etc/xdg/autostart/iprps-wallpaper.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=IPRPS Wallpaper
Exec=/usr/bin/iprps-wallpaper
NoDisplay=true
EOF
```

### 9.8 User folders and groups

LFS doesn't create `/etc/skel` (the template for new home folders), so create it. The standard folders (Documents, Downloads, Music and so on, which get the IPRPS folder icons) and the **Campaigns** folders are created by a small script at **every desktop login**. A `.bashrc` line wouldn't do: it only runs when someone opens a terminal.

**[IPRPS CHROOT]**

```bash
install -vdm755 /etc/skel
groupadd -r iprps
cat > /usr/bin/iprps-folders << "EOF"
#!/bin/bash
# Create the standard and IPRPS folders (safe to run at every login)
command -v xdg-user-dirs-update >/dev/null && xdg-user-dirs-update
mkdir -p "$HOME/Campaigns/Handouts" "$HOME/Campaigns/Maps" "$HOME/Campaigns/Audio"
EOF
chmod 755 /usr/bin/iprps-folders
cat > /etc/xdg/autostart/iprps-folders.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=IPRPS Folders
Exec=/usr/bin/iprps-folders
NoDisplay=true
EOF
bash -n /usr/bin/iprps-folders && echo "script OK"
```

If `groupadd` says the group exists, that's fine.

### 9.9 Wi-Fi Networks window

NetworkManager's **Advanced Network Configuration** (`nm-connection-editor`) has no scanning: choosing Wi-Fi gives an empty SSID box to type into. IPRPS adds a **Wi-Fi Networks** window, and the menu's Advanced Network Configuration entry opens it:

- it **scans** as it opens and every 20 seconds, listing each network once with its signal, its security and which one is connected;
- **double-click** (or **Connect**) joins a network, asking for the password when needed; saved networks reconnect without asking;
- **Advanced settings…** opens NetworkManager's editor **for the selected network**, with its name and security type already filled in, for IP addresses, DNS, proxies or enterprise (802.1X) sign-in;
- **Hidden network…** joins a network that doesn't broadcast its name; **All connections…** opens the full editor (wired, VPN, saved networks).

It uses `nmcli` (no administrator password: 13.2's polkit rule allows the person at the computer to manage connections) and GTK 3 through PyGObject, both already in the build. The panel's network icon (nm-applet) also lists networks with a left click.

**[IPRPS CHROOT]**

```bash
cat > /usr/bin/iprps-wifi << "EOF"
#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""IPRPS Wi-Fi Networks: scan, connect, and open NetworkManager's advanced settings
for the chosen network. Uses nmcli; no root needed (polkit rule 10-iprps.rules)."""
import subprocess, threading, re, sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, Pango

NMCLI = 'nmcli'
RESCAN_SECONDS = 20


def nmcli(*args, timeout=40):
    p = subprocess.run([NMCLI, *args], capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, (p.stderr or p.stdout).strip()


def split_terse(line):
    """Split one line of `nmcli -t -e yes` output on unescaped colons."""
    out, cur, esc = [], '', False
    for ch in line:
        if esc: cur += ch; esc = False
        elif ch == '\\': esc = True
        elif ch == ':': out.append(cur); cur = ''
        else: cur += ch
    out.append(cur)
    return out


def scan(rescan=True):
    """Return (networks, error). Networks: one entry per SSID, strongest signal."""
    rc, out, err = nmcli('-t', '-e', 'yes', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list',
                         '--rescan', 'yes' if rescan else 'no')
    if rc != 0:
        return [], err or 'Wi-Fi scan failed'
    nets = {}
    for line in out.splitlines():
        f = split_terse(line)
        if len(f) < 4 or not f[1]:
            continue                       # hidden networks have no name
        inuse, ssid, signal, sec = f[0] == '*', f[1], int(f[2] or 0), f[3]
        n = nets.get(ssid)
        if n is None or signal > n['signal'] or inuse:
            nets[ssid] = {'ssid': ssid, 'signal': signal, 'security': sec, 'active': inuse or (n or {}).get('active', False)}
    return sorted(nets.values(), key=lambda n: (not n['active'], -n['signal'], n['ssid'].lower())), None


def saved_profiles():
    """SSID -> connection UUID for saved Wi-Fi profiles."""
    rc, out, _ = nmcli('-t', '-e', 'yes', '-f', 'UUID,TYPE', 'connection', 'show')
    res = {}
    if rc != 0:
        return res
    for line in out.splitlines():
        uuid, typ = (split_terse(line) + ['', ''])[:2]
        if typ != '802-11-wireless':
            continue
        rc2, ssid, _ = nmcli('-g', '802-11-wireless.ssid', 'connection', 'show', uuid)
        if rc2 == 0 and ssid.strip():
            res[ssid.strip()] = uuid
    return res


def bars(sig):
    return '▂▄▆█'[:max(1, min(4, (sig + 24) // 25))].ljust(4, '·')


def is_enterprise(sec):
    return '802.1X' in sec or 'EAP' in sec


class WifiWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title='Wi-Fi Networks')
        self.set_default_size(460, 520)
        self.set_icon_name('network-wireless')
        self.busy = False
        self.note = ''

        hb = Gtk.HeaderBar(title='Wi-Fi Networks', show_close_button=True)
        self.set_titlebar(hb)
        self.refresh_btn = Gtk.Button.new_from_icon_name('view-refresh', Gtk.IconSize.BUTTON)
        self.refresh_btn.set_tooltip_text('Scan again')
        self.refresh_btn.connect('clicked', lambda *_: self.refresh(True))
        hb.pack_start(self.refresh_btn)
        self.spinner = Gtk.Spinner()
        hb.pack_start(self.spinner)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin=12)
        self.add(box)
        self.status = Gtk.Label(xalign=0, wrap=True)
        box.pack_start(self.status, False, False, 0)

        self.store = Gtk.ListStore(str, str, str, str, bool)   # ssid, label, bars, security, active
        self.view = Gtk.TreeView(model=self.store, headers_visible=False, activate_on_single_click=False)
        r = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.END)
        col = Gtk.TreeViewColumn('Network', r, markup=1); col.set_expand(True)
        self.view.append_column(col)
        self.view.append_column(Gtk.TreeViewColumn('Security', Gtk.CellRendererText(foreground='#888'), text=3))
        self.view.append_column(Gtk.TreeViewColumn('Signal', Gtk.CellRendererText(family='monospace'), text=2))
        self.view.connect('row-activated', lambda *_: self.connect_selected())
        self.view.get_selection().connect('changed', lambda *_: self.update_buttons())
        sw = Gtk.ScrolledWindow(); sw.add(self.view)
        box.pack_start(sw, True, True, 0)

        row = Gtk.Box(spacing=6)
        self.connect_btn = Gtk.Button(label='Connect')
        self.connect_btn.get_style_context().add_class('suggested-action')
        self.connect_btn.connect('clicked', lambda *_: self.connect_selected())
        self.adv_btn = Gtk.Button(label='Advanced settings…')
        self.adv_btn.set_tooltip_text('IP addresses, DNS, proxy, enterprise (802.1X) security and more, for the selected network')
        self.adv_btn.connect('clicked', lambda *_: self.advanced_selected())
        hidden = Gtk.Button(label='Hidden network…')
        hidden.connect('clicked', lambda *_: self.connect_hidden())
        allc = Gtk.Button(label='All connections…')
        allc.set_tooltip_text('NetworkManager\'s connection editor: wired, VPN, saved networks')
        allc.connect('clicked', lambda *_: self.run_editor([]))
        for b in (self.connect_btn, self.adv_btn):
            row.pack_start(b, False, False, 0)
        for b in (allc, hidden):
            row.pack_end(b, False, False, 0)
        box.pack_start(row, False, False, 0)

        self.update_buttons()
        self.refresh(True)
        GLib.timeout_add_seconds(RESCAN_SECONDS, self.auto_refresh)

    # -------------------------------------------------------------- scanning
    def auto_refresh(self):
        if not self.busy:
            self.refresh(True, quiet=True)
        return True

    def refresh(self, rescan, quiet=False):
        if self.busy:
            return
        self.busy = True
        self.spinner.start()
        if not quiet:
            self.status.set_text('Scanning for Wi-Fi networks…')

        def work():
            rc, out, _ = nmcli('radio', 'wifi')
            if out.strip() == 'disabled':
                GLib.idle_add(self.show_radio_off); return
            nets, err = scan(rescan)
            GLib.idle_add(self.show_networks, nets, err)
        threading.Thread(target=work, daemon=True).start()

    def show_radio_off(self):
        self.busy = False; self.spinner.stop()
        d = Gtk.MessageDialog(transient_for=self, modal=True, message_type=Gtk.MessageType.QUESTION,
                              buttons=Gtk.ButtonsType.YES_NO, text='Wi-Fi is turned off')
        d.format_secondary_text('Turn Wi-Fi on and scan for networks?')
        if d.run() == Gtk.ResponseType.YES:
            nmcli('radio', 'wifi', 'on')
            GLib.timeout_add_seconds(3, lambda: (self.refresh(True), False)[1])
        d.destroy()
        self.status.set_text('Wi-Fi is off.')

    def show_networks(self, nets, err):
        self.busy = False; self.spinner.stop()
        sel = self.selected()
        self.store.clear()
        if err:
            self.status.set_text(f'Couldn\'t scan: {err}\nIs there a Wi-Fi adapter? (Try "nmcli device" in a terminal.)')
            return
        for n in nets:
            name = GLib.markup_escape_text(n['ssid'])
            label = f'<b>{name}</b>  <small>connected</small>' if n['active'] else name
            sec = '🔒 ' + n['security'] if n['security'] not in ('', '--') else 'open'
            self.store.append([n['ssid'], label, bars(n['signal']), sec, n['active']])
        self.status.set_text(self.note or (f'{len(nets)} networks found. Double-click one to connect.' if nets else
                             'No networks found. Move closer to the router, or press refresh.'))
        self.note = ''
        if sel:
            for i, r in enumerate(self.store):
                if r[0] == sel['ssid']:
                    self.view.get_selection().select_path(Gtk.TreePath(i))
        self.update_buttons()

    def selected(self):
        m, it = self.view.get_selection().get_selected()
        if not it:
            return None
        return {'ssid': m[it][0], 'security': m[it][3], 'active': m[it][4]}

    def update_buttons(self):
        s = self.selected()
        self.connect_btn.set_sensitive(bool(s) and not s['active'])
        self.adv_btn.set_sensitive(bool(s))

    # -------------------------------------------------------------- actions
    def ask_password(self, ssid):
        d = Gtk.Dialog(title='Wi-Fi password', transient_for=self, modal=True)
        d.add_buttons('Cancel', Gtk.ResponseType.CANCEL, 'Connect', Gtk.ResponseType.OK)
        d.set_default_response(Gtk.ResponseType.OK)
        a = d.get_content_area(); a.set_spacing(8); a.set_border_width(12)
        a.add(Gtk.Label(label=f'Password for “{ssid}”:', xalign=0))
        e = Gtk.Entry(visibility=False, activates_default=True); a.add(e)
        show = Gtk.CheckButton(label='Show password')
        show.connect('toggled', lambda b: e.set_visibility(b.get_active())); a.add(show)
        d.show_all()
        pw = e.get_text() if d.run() == Gtk.ResponseType.OK else None
        d.destroy()
        return pw

    def message(self, text, detail='', error=False):
        d = Gtk.MessageDialog(transient_for=self, modal=True,
                              message_type=Gtk.MessageType.ERROR if error else Gtk.MessageType.INFO,
                              buttons=Gtk.ButtonsType.OK, text=text)
        if detail: d.format_secondary_text(detail)
        d.run(); d.destroy()

    def run_nmcli_async(self, args, done_text, ssid):
        self.spinner.start(); self.status.set_text(f'Connecting to “{ssid}”…')

        def work():
            rc, out, err = nmcli(*args, timeout=90)
            GLib.idle_add(self.after_connect, rc, err, done_text, ssid)
        threading.Thread(target=work, daemon=True).start()

    def after_connect(self, rc, err, done_text, ssid):
        self.spinner.stop()
        if rc == 0:
            self.status.set_text(done_text); self.note = done_text
        else:
            msg = re.sub(r'^Error:\s*', '', err.splitlines()[-1] if err else 'unknown error')
            self.message(f'Couldn\'t connect to “{ssid}”', msg +
                         ('\n\nIf the password is right, try Advanced settings….' if 'Secrets' in msg or 'password' in msg.lower() else ''),
                         error=True)
            self.status.set_text('Not connected.')
        self.refresh(False)

    def connect_selected(self):
        s = self.selected()
        if not s or s['active']:
            return
        ssid, sec = s['ssid'], s['security']
        if is_enterprise(sec):
            self.message('This network uses enterprise (802.1X) sign-in',
                         'Use Advanced settings… to enter the user name, certificates and method your organisation gave you.')
            return self.advanced_selected()
        saved = saved_profiles().get(ssid)
        if saved:
            return self.run_nmcli_async(['connection', 'up', saved], f'Connected to “{ssid}”.', ssid)
        args = ['device', 'wifi', 'connect', ssid]
        if sec != 'open':
            pw = self.ask_password(ssid)
            if pw is None:
                return
            args += ['password', pw]
        self.run_nmcli_async(args, f'Connected to “{ssid}”. It will reconnect automatically.', ssid)

    def connect_hidden(self):
        d = Gtk.Dialog(title='Hidden network', transient_for=self, modal=True)
        d.add_buttons('Cancel', Gtk.ResponseType.CANCEL, 'Connect', Gtk.ResponseType.OK)
        a = d.get_content_area(); a.set_spacing(8); a.set_border_width(12)
        a.add(Gtk.Label(label='Network name (SSID):', xalign=0)); n = Gtk.Entry(); a.add(n)
        a.add(Gtk.Label(label='Password (leave empty for an open network):', xalign=0))
        p = Gtk.Entry(visibility=False, activates_default=True); a.add(p)
        d.set_default_response(Gtk.ResponseType.OK); d.show_all()
        ok = d.run() == Gtk.ResponseType.OK
        ssid, pw = n.get_text().strip(), p.get_text()
        d.destroy()
        if ok and ssid:
            args = ['device', 'wifi', 'connect', ssid, 'hidden', 'yes'] + (['password', pw] if pw else [])
            self.run_nmcli_async(args, f'Connected to “{ssid}”.', ssid)

    def run_editor(self, args):
        try:
            subprocess.Popen(['nm-connection-editor', *args])
        except FileNotFoundError:
            self.message('NetworkManager\'s connection editor isn\'t installed.', error=True)

    def advanced_selected(self):
        """Open the advanced editor for the selected network, creating its profile first if needed."""
        s = self.selected()
        if not s:
            return
        ssid, sec = s['ssid'], s['security']
        uuid = saved_profiles().get(ssid)
        if not uuid:
            args = ['connection', 'add', 'type', 'wifi', 'ifname', '*', 'con-name', ssid, 'ssid', ssid]
            if is_enterprise(sec):
                args += ['wifi-sec.key-mgmt', 'wpa-eap', '802-1x.eap', 'peap', '802-1x.phase2-auth', 'mschapv2']
            elif 'WPA3' in sec and 'WPA2' not in sec:
                args += ['wifi-sec.key-mgmt', 'sae']
            elif 'WPA' in sec:
                args += ['wifi-sec.key-mgmt', 'wpa-psk']
            elif 'WEP' in sec:
                args += ['wifi-sec.key-mgmt', 'none']
            rc, out, err = nmcli(*args)
            m = re.search(r'\(([0-9a-f-]{36})\)', out)
            if rc != 0 or not m:
                return self.message('Couldn\'t prepare the network\'s settings', err, error=True)
            uuid = m.group(1)
        self.status.set_text(f'Opening advanced settings for “{ssid}”…')
        self.run_editor(['--edit', uuid])


def main():
    if subprocess.run(['which', NMCLI], capture_output=True).returncode != 0:
        print('nmcli not found: NetworkManager is required', file=sys.stderr); sys.exit(1)
    w = WifiWindow(); w.connect('destroy', Gtk.main_quit); w.show_all(); Gtk.main()


if __name__ == '__main__':
    main()
EOF
chmod 755 /usr/bin/iprps-wifi
python3 -m py_compile /usr/bin/iprps-wifi && echo "iprps-wifi OK"
F=/usr/share/applications/nm-connection-editor.desktop
ls -l $F
sed -i 's|^Exec=.*|Exec=iprps-wifi|; s|^Name=.*|Name=Wi-Fi and Network Connections|' $F
grep -q '^Keywords=' $F || echo 'Keywords=wifi;wireless;network;internet;connection;' >> $F
grep -E '^(Name|Exec|Keywords)=' $F
update-desktop-database /usr/share/applications
rm -rf /usr/bin/__pycache__
```

`ls` must find the file (it comes with network-manager-applet, Stage E). The menu entry is then called **Wi-Fi and Network Connections** and opens the new window; NetworkManager's own editor stays one click away.

> **Checkpoint:** Create a test user (`useradd -m -G users,wheel test`, then `passwd test`), boot-test a copy (1.4), log in as `test`, and confirm the theme, panel, wallpaper and IPRPS menu. Back in the chroot, delete it with `userdel -r test`. Take snapshot **`desktop-iprps`**.

**[DEBIAN ROOT]** — snapshot `desktop-iprps`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-desktop-iprps.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-desktop-iprps.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 10 — Stage F: Web Server and Database

The local web server (**Apache**), **PHP** (as PHP-FPM) and the **MariaDB** database that the IPRPS apps run on.

**6 packages, in build order:** Apr-1.7.6, Apr-Util-1.6.5, Apache-2.4.68, PHP-8.5.9, libevent-2.1.13, MariaDB-12.3.3.

### Apr-1.7.6

*BLFS 13.1 · ID `apr` · Stage F* · *Build time:* 0.2 SBU (add 1.7 SBU for tests) · *Disk space:* 11 MB (additional 4 MB for the tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.apache.org/dist/apr/apr-1.7.6.tar.bz2
```

MD5 sum of `apr-1.7.6.tar.bz2`: `2ebb58910e426e5a83af97bc94cae66d` (check with `md5sum apr-1.7.6.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf apr-1.7.6.tar.bz2
cd "$(tar -tf apr-1.7.6.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Apr by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --with-installbuilddir=/usr/share/apr-1/build &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf apr-1.7.6.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Apr-Util-1.6.5

*BLFS 13.1 · ID `apr-util` · Stage F* · *Build time:* less than 0.1 SBU (add 0.3 SBU for tests) · *Disk space:* 9.4 MB (with tests)

**Requires:** `apr`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.apache.org/dist/apr/apr-util-1.6.5.tar.bz2
```

MD5 sum of `apr-util-1.6.5.tar.bz2`: `3897a2f32d365a8281fbb90d1c2794ac` (check with `md5sum apr-util-1.6.5.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf apr-util-1.6.5.tar.bz2
cd "$(tar -tf apr-util-1.6.5.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Apr Util by running the following commands:

```bash
./configure --prefix=/usr       \
            --with-apr=/usr     \
            --with-gdbm=/usr    \
            --with-openssl=/usr \
            --with-crypto &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf apr-util-1.6.5.tar.bz2 | head -1 | cut -d/ -f1)"
```


### Apache-2.4.68

*BLFS 13.1 · ID `apache` · Stage F* · *Build time:* 0.3 SBU (Using parallelism=4) · *Disk space:* 133 MB

**Requires:** `apr-util`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.apache.org/dist/httpd/httpd-2.4.68.tar.bz2
wget https://www.linuxfromscratch.org/patches/blfs/13.1/httpd-blfs_layout-1.patch
wget https://www.linuxfromscratch.org/patches/blfs/13.1/httpd-2.4.68-openssl4_fixes-1.patch
```

MD5 sum of `httpd-2.4.68.tar.bz2`: `f2f3121e9f1fb4838d433dbd494543f9` (check with `md5sum httpd-2.4.68.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf httpd-2.4.68.tar.bz2
cd "$(tar -tf httpd-2.4.68.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For security reasons, running the server as an unprivileged user and group is strongly encouraged. Create the following group and user using the following commands as root:

```bash
groupadd -g 25 apache &&
useradd -c "Apache Server" -d /srv/www -g apache \
        -s /bin/false -u 25 apache
```

**[BUILDER]** — Now add a patch for compatibility with openssl4:

```bash
patch -Np1 -i ../httpd-2.4.68-openssl4_fixes-1.patch
```

**[BUILDER]** — Build and install Apache HTTPD by running the following commands:

```bash
patch -Np1 -i ../httpd-blfs_layout-1.patch             &&

sed '/dir.*CFG_PREFIX/s@^@#@' -i support/apxs.in       &&

sed -e '/HTTPD_ROOT/s:${ap_prefix}:/etc/httpd:'       \
    -e '/SERVER_CONFIG_FILE/s:${rel_sysconfdir}/::'   \
    -e '/AP_TYPES_CONFIG_FILE/s:${rel_sysconfdir}/::' \
    -i configure  &&

./configure --enable-authnz-fcgi                    \
            --enable-layout=BLFS                    \
            --enable-mods-shared="all cgi"          \
            --enable-mpms-shared=all                \
            --enable-suexec=shared                  \
            --with-apr=/usr/bin/apr-1-config        \
            --with-apr-util=/usr/bin/apu-1-config   \
            --with-suexec-bin=/usr/lib/httpd/suexec \
            --with-suexec-caller=apache             \
            --with-suexec-docroot=/srv/www          \
            --with-suexec-uidmin=100                \
            --with-suexec-userdir=public_html       \
            --with-suexec-logfile=/var/log/httpd/suexec.log &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install  &&

mv -v /usr/sbin/suexec /usr/lib/httpd/suexec &&
chgrp apache           /usr/lib/httpd/suexec &&
chmod 4754             /usr/lib/httpd/suexec &&

chown -v -R apache:apache /srv/www
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(IPRPS: **required**)* If you want the Apache server to start automatically when the system is booted, install the httpd.service unit included in the BLFS Systemd Units package:

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-httpd
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf httpd-2.4.68.tar.bz2 | head -1 | cut -d/ -f1)"
```


### PHP-8.5.12

*BLFS 13.1 · ID `php` · Stage F* · *Build time:* 1.6 SBU (add 2.5 SBU for tests; both with parallelism=4) · *Disk space:* 651 MB (with tests)

**Recommended (included):** `apache`, `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.php.net/distributions/php-8.5.12.tar.xz
wget https://www.php.net/distributions/manual/php_manual_en.html.gz
wget https://www.php.net/distributions/manual/php_manual_en.tar.gz
```

Checksum of `php-8.5.12.tar.xz`: the SHA-256 listed on https://www.php.net/downloads.php under "Source Tarballs" (check with `sha256sum php-8.5.12.tar.xz`; both values must match exactly).

Additional reference: https://www.php.net/download-docs.php

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf php-8.5.12.tar.xz
cd "$(tar -tf php-8.5.12.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS changes: build PHP 8.5.12, with MariaDB support.**
>
> - **Version.** BLFS 13.1 has PHP 8.5.9, which is vulnerable to **CVE-2026-109618 and CVE-2026-109619** (critical remote code execution, fixed 21 Oct 2026). This section builds **8.5.12** instead; BLFS's commands are unchanged. Before every IPRPS release, check php.net for a newer 8.5 release and use that.
> - **Options.** BLFS's configuration has no MariaDB support. IPRPS adds `--with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd` (the campaign database; `mysqlnd` is built in, so MariaDB doesn't need to be installed first), `--with-openssl` (secure tokens), `--with-curl` (the online AI apps) and `--enable-gd --with-freetype --with-jpeg` (image thumbnails). WebP isn't in the build, so `--with-webp` is left out. If `configure` stops on an image library, remove that one option.
> - **Check after `make install`:** `php -v` shows 8.5.12, and `php -m | grep -i -E 'mysqli|pdo_mysql|openssl|curl|gd'` lists all five.
> - The offline-manual and PEAR steps are optional; skip them.

**Build and install:**

> **Side note (BLFS):** PHP has many more configure options that will enable support for various things. You can use ./configure --help to see a full list of the available options. Also, use of the PHP web site is highly recommended, as their online docs are very good. An example of a configure command that utilizes many of the most common dependencies can be found at . If, for whatever reason, you don't have libxml2-2.15.3 installed, you need to add --disable-libxml to the configure command in the instructions below. Note that this will prevent the pear command from being built.

**[BUILDER]** — Install PHP by running the following commands:

```bash
./configure --prefix=/usr                \
            --sysconfdir=/etc            \
            --localstatedir=/var         \
            --datadir=/usr/share/php     \
            --mandir=/usr/share/man      \
            --enable-fpm                 \
            --without-pear               \
            --with-fpm-user=apache       \
            --with-fpm-group=apache      \
            --with-fpm-systemd           \
            --with-config-file-path=/etc \
            --with-zlib                  \
            --enable-bcmath              \
            --with-bz2                   \
            --enable-calendar            \
            --enable-dba=shared          \
            --with-gdbm                  \
            --with-gmp                   \
            --enable-ftp                 \
            --with-gettext               \
            --enable-mbstring            \
            --disable-mbregex            \
            --with-readline              \
            --with-mysqli=mysqlnd        \
            --with-pdo-mysql=mysqlnd     \
            --with-openssl               \
            --with-curl                  \
            --enable-gd                  \
            --with-freetype              \
            --with-jpeg                  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install                                     &&
install -v -m644 php.ini-production /etc/php.ini &&

install -v -m755 -d /usr/share/doc/php-8.5.12 &&
install -v -m644    CODING_STANDARDS* EXTENSIONS NEWS README* UPGRADING* \
                    /usr/share/doc/php-8.5.12
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The default configuration files for the fastCGI process manager are installed only if they do not already exist on the system. If this is the first installation, they should be renamed, as the root user:

```bash
if [ -f /etc/php-fpm.conf.default ]; then
  mv -v /etc/php-fpm.conf{.default,} &&
  mv -v /etc/php-fpm.d/www.conf{.default,}
fi
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For the Single HTML file:

```bash
install -v -m644 ../php_manual_en.html.gz \
    /usr/share/doc/php-8.5.12 &&
gunzip -v /usr/share/doc/php-8.5.12/php_manual_en.html.gz
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For the Many HTML files tarball:

```bash
tar -xvf ../php_manual_en.tar.gz \
    -C /usr/share/doc/php-8.5.12 --no-same-owner
```

**[BUILDER]** — *(Optional — skip if unsure)* The bundled pear is not installed because of a bug which might pollute the filesystem with several hidden files and directories. If pear is needed, execute the following commands to install it:

```bash
wget https://pear.php.net/go-pear.phar
php ./go-pear.phar
```

**Configure:**

*Example only — don't run:* You may have noticed the following from the output of the make install command:

```text
You may want to add: /usr/lib/php to your php.ini include_path
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If desired, add the entry using the following command as the root user:

```bash
sed -i 's@php/includes"@&\ninclude_path = ".:/usr/lib/php"@' \
    /etc/php.ini
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To enable fastCGI support in the Apache web server, two LoadModule directives must be added to the httpd.conf file. They are commented out, so just issue the following command as root user:

```bash
sed -i -e '/proxy_module/s/^#//'      \
       -e '/proxy_fcgi_module/s/^#//' \
       /etc/httpd/httpd.conf
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Those modules accept various ProxyPass directives. One possibility is (as the root user):

```bash
echo \
'ProxyPassMatch ^/(.*\.php)$ fcgi://127.0.0.1:9000/srv/www/$1' >> \
/etc/httpd/httpd.conf
```

*Example only — don't run:* Additionally, it may be useful to add an entry for index.php to the DirectoryIndex directive of the httpd.conf file. Lastly, adding a line to set up the .phps extension to show highlighted PHP source may be desirable:

```text
AddType application/x-httpd-php-source .phps
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To start the php-fpm daemon at boot, install the systemd unit from the BLFS Systemd Units package by running the following command as the root user:

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-php-fpm
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf php-8.5.12.tar.xz | head -1 | cut -d/ -f1)"
```


### libevent-2.1.13

*BLFS 13.1 · ID `libevent` · Stage F* · *Build time:* 0.3 SBU (add 11 SBU for tests) · *Disk space:* 23 MB (with tests and API docs)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libevent/libevent/releases/download/release-2.1.13-stable/libevent-2.1.13-stable.tar.gz
```

MD5 sum of `libevent-2.1.13-stable.tar.gz`: `eaa0bd3472b5d6a52ac6b9e0b7418b03` (check with `md5sum libevent-2.1.13-stable.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libevent-2.1.13-stable.tar.gz
cd "$(tar -tf libevent-2.1.13-stable.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix an issue that prevents event_rpcgen.py from working:

```bash
sed -i 's/python/&3/' event_rpcgen.py
```

**[BUILDER]** — Install libevent by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Doxygen-1.18.0 installed and wish to build API documentation, issue :

```bash
doxygen Doxyfile
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the API documentation, install it by issuing the following commands as the root user:

```bash
install -v -m755 -d /usr/share/doc/libevent-2.1.13/api &&
cp      -v -R       html/* \
                    /usr/share/doc/libevent-2.1.13/api
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libevent-2.1.13-stable.tar.gz | head -1 | cut -d/ -f1)"
```


### MariaDB-12.3.3

*BLFS 13.1 · ID `mariadb` · Stage F* · *Build time:* 6.4 SBU (with parallelism=8, add 2.6 SBU for tests) · *Disk space:* 3.6 GB (906 MB installed)

**Requires:** `cmake`  
**Recommended (included):** `libevent`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.mariadb.org/interstitial/mariadb-12.3.3/source/mariadb-12.3.3.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/mariadb-12.3.3-openssl4_fixes-1.patch
```

MD5 sum of `mariadb-12.3.3.tar.gz`: `83d962d0f5917a0445786cc31337b118` (check with `md5sum mariadb-12.3.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mariadb-12.3.3.tar.gz
cd "$(tar -tf mariadb-12.3.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS notes for MariaDB.**
>
> - Its `make install` runs as root, in **IPRPS CHROOT**, in `/build/src/mariadb-12.3.3/build`. Run as builder, it fails with "Permission denied".
> - **Don't set a root password** (the book's `mariadb-admin -u root password` step): each installation gets its own random password at first boot (`iprps-db-init`, Part 13).
> - The test server (`mariadbd-safe ... &`) runs in the background and returns the prompt at once (press Enter). The data folder is **`/srv/mariadb`**. Inside the chroot it opens port 3306 on the WSL machine until IPRPS's `skip-networking` (Part 10) is in place, and it names its log files after your Windows PC: stop it with `mariadb-admin -u root shutdown` (check with `pgrep -a mariadbd`) and remove `/srv/mariadb/<PC-NAME>.*` before leaving the chroot.

**Build and install:**

> **Warning (BLFS):** MariaDB and MySQL cannot be installed on the same system without extensive changes to the build configuration of one of the two applications.

> **Warning (BLFS):** If you are upgrading MariaDB from 11.x to 12.x, please pay special attention to the upgrade notes later in this page. Users of existing MariaDB installations may want to consider staying on the 11.8.x LTS branch instead, especially if they rely on the Galera functionality which was removed from MariaDB-12.x.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For security reasons, running the server as an unprivileged user and group is strongly encouraged. Issue the following (as root) to create the user and group:

```bash
groupadd -g 40 mariadb &&
useradd -c "MariaDB Server" -d /srv/mariadb -g mariadb -s /bin/false -u 40 mariadb
```

**[BUILDER]** — Fix runtime issues with OpenSSL-4.0 and later:

```bash
patch -Np1 -i ../mariadb-12.3.3-openssl4_fixes-1.patch
```

**[BUILDER]** — Install MariaDB by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_BUILD_TYPE=Release                       \
      -D CMAKE_INSTALL_PREFIX=/usr                      \
      -D GRN_LOG_PATH=/var/log/groonga.log              \
      -D INSTALL_DOCDIR=share/doc/mariadb-12.3.3        \
      -D INSTALL_DOCREADMEDIR=share/doc/mariadb-12.3.3  \
      -D INSTALL_MANDIR=share/man                       \
      -D INSTALL_MYSQLSHAREDIR=share/mariadb            \
      -D INSTALL_MYSQLTESTDIR=share/mariadb/test        \
      -D INSTALL_PAMDIR=lib/security                    \
      -D INSTALL_PAMDATADIR=/etc/security               \
      -D INSTALL_PLUGINDIR=lib/mariadb/plugin           \
      -D INSTALL_SBINDIR=sbin                           \
      -D INSTALL_SCRIPTDIR=bin                          \
      -D INSTALL_SQLBENCHDIR=share/mariadb/bench        \
      -D INSTALL_SUPPORTFILESDIR=share/mariadb          \
      -D MYSQL_DATADIR=/srv/mariadb                     \
      -D MYSQL_UNIX_ADDR=/run/mariadb/mariadb.sock      \
      -D WITH_EXTRA_CHARSETS=complex                    \
      -D WITH_EMBEDDED_SERVER=ON                        \
      -D SKIP_TESTS=ON                                  \
      -D TOKUDB_OK=0                                    \
      -W no-author                                      \
      .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Create a basic /etc/my.cnf file using the following command as the root user:

```bash
cat > /etc/my.cnf << "EOF"
# Begin /etc/my.cnf

# The following options will be passed to all MySQL clients
[client]
#password       = your_password
port            = 3306
socket          = /run/mariadb/mariadb.sock

# The MySQL server
[server]
port            = 3306
socket          = /run/mariadb/mariadb.sock
datadir         = /srv/mariadb
skip-external-locking
key_buffer_size = 16M
max_allowed_packet = 1M
sort_buffer_size = 512K
net_buffer_length = 16K
myisam_sort_buffer_size = 8M

# Don't listen on a TCP/IP port at all.
skip-networking

# required unique id between 1 and 2^32 - 1
server-id       = 1

# Uncomment the following if you are using BDB tables
#bdb_cache_size = 4M
#bdb_max_lock = 10000

# InnoDB tables are now used by default
innodb_data_home_dir = /srv/mariadb
innodb_log_group_home_dir = /srv/mariadb
# All the innodb_xxx values below are the default ones:
innodb_data_file_path = ibdata1:12M:autoextend
# You can set .._buffer_pool_size up to 50 - 80 %
# of RAM but beware of setting memory usage too high
innodb_buffer_pool_size = 128M
innodb_log_file_size = 48M
innodb_log_buffer_size = 16M
innodb_flush_log_at_trx_commit = 1
innodb_lock_wait_timeout = 50

[mariadbdump]
quick
max_allowed_packet = 16M

[mysql]
no-auto-rehash
# Remove the next comment character if you are not familiar with SQL
#safe-updates

[isamchk]
key_buffer = 20M
sort_buffer_size = 20M
read_buffer = 2M
write_buffer = 2M

[myisamchk]
key_buffer_size = 20M
sort_buffer_size = 20M
read_buffer = 2M
write_buffer = 2M

[mariadbhotcopy]
interactive-timeout

# End /etc/my.cnf
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — You can now install a database and change the ownership to the unprivileged user and group (perform as the root user):

```bash
mariadb-install-db --basedir=/usr --datadir=/srv/mariadb --user=mariadb &&
chown -R mariadb:mariadb /srv/mariadb
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Further configuration requires that the MariaDB server is running. Start the server using the following commands as the root user:

```bash
install -v -m755 -o mariadb -g mariadb -d /run/mariadb &&
mariadbd-safe --user=mariadb 2>&1 >/dev/null &
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — A default installation does not set up a password for the administrator, so use the following command as the root user to set one.

```bash
mariadb-admin -u root password
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Configuration of the server is now finished. Shut the server down using the following command as the root user:

```bash
mariadb-admin -p shutdown
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install the mariadb.service unit included in the BLFS Systemd Units package as the root user to start the MariaDB server during system boot-up.

```bash
cd /build/src/blfs-systemd-units-20251204    # the BLFS systemd units folder (kept since Part 2.5)
make install-mariadb
```

> **Warning (BLFS):** Upgrading MariaDB from version 11 to 12 requires a full backup, a clean shutdown, uninstalling the old binaries, installing the version 12 binaries, restarting the server, and running the mariadb-upgrade command to update system tables. Skipping this backup can result in unrecoverable data.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mariadb-12.3.3.tar.gz | head -1 | cut -d/ -f1)"
```



### 10.1 IPRPS web stack settings

The IPRPS apps run on this computer only. The web server and database must **never** be reachable from the network.

**Apache: listen on localhost only.** As root:

**[IPRPS CHROOT]**

```bash
sed -i 's/^Listen 80$/Listen 127.0.0.1:80/' /etc/httpd/httpd.conf
grep -n '^Listen' /etc/httpd/httpd.conf
grep -q '^ServerName' /etc/httpd/httpd.conf || echo 'ServerName localhost' >> /etc/httpd/httpd.conf
install -vdm755 -o root -g apache /srv/www/iprps
```

**Apache and PHP: serve `index.php` pages.** BLFS's PHP setup (Stage F) passes `.php` requests to the PHP-FPM service. Also make `index.php` a default page:

**[IPRPS CHROOT]**

```bash
sed -i 's/DirectoryIndex index.html/DirectoryIndex index.php index.html/' /etc/httpd/httpd.conf
grep -n '^ *DirectoryIndex' /etc/httpd/httpd.conf
```

**Apache and PHP: only real `.php` files go to PHP.** BLFS connects PHP with a `ProxyPassMatch` line, which forwards *every* address ending in `.php` to PHP-FPM without checking the file exists. With `DirectoryIndex index.php index.html`, an app whose start page is `index.html` (the Session Master Hub, IPRPS Writer, the Oracle) then shows PHP's **"File not found."** instead of its page. Replace that line with Apache's standard `FilesMatch` handler, which checks first. It also passes long answers through as they're written (`flushpackets`, used by the IPRPS Oracle), and allows up to 15 minutes per request:

**[IPRPS CHROOT]**

```bash
sed -i '/^ProxyPassMatch .*fcgi:\/\/127\.0\.0\.1:9000/d' /etc/httpd/httpd.conf
install -vdm755 /etc/httpd/extra
cat > /etc/httpd/extra/iprps-php.conf << "EOF"
# IPRPS OS: PHP through PHP-FPM, only for .php files that exist
# (so a folder whose start page is index.html works), streaming long answers.
<FilesMatch "\.php$">
    SetHandler "proxy:fcgi://127.0.0.1:9000"
</FilesMatch>
<Proxy "fcgi://127.0.0.1:9000">
    ProxySet flushpackets=on timeout=900
</Proxy>
EOF
grep -q 'extra/iprps-php.conf' /etc/httpd/httpd.conf || echo 'Include /etc/httpd/extra/iprps-php.conf' >> /etc/httpd/httpd.conf
grep -n 'ProxyPassMatch\|iprps-php' /etc/httpd/httpd.conf
httpd -t
```

`grep` must show only the `Include` line (no `ProxyPassMatch`), and `httpd -t` must say `Syntax OK`. The modules this uses (`mod_proxy`, `mod_proxy_fcgi`) are the ones BLFS's PHP setup already switched on.

**MariaDB: already local-only and small.** BLFS's `/etc/my.cnf` uses `skip-networking` (no network port at all) and a 128 MB buffer pool, which suits 6 GB machines. Add two more memory savers:

**[IPRPS CHROOT]**

```bash
cat >> /etc/my.cnf << "EOF"

# IPRPS settings (low-memory machines)
[mysqld]
performance_schema = OFF
max_connections    = 50
EOF
```

**PHP: use MariaDB's socket.** BLFS's MariaDB socket is `/run/mariadb/mariadb.sock`. Tell PHP:

**[IPRPS CHROOT]**

```bash
sed -i -e 's|^pdo_mysql.default_socket.*|pdo_mysql.default_socket = /run/mariadb/mariadb.sock|' \
       -e 's|^mysqli.default_socket.*|mysqli.default_socket = /run/mariadb/mariadb.sock|' /etc/php.ini
grep -n 'default_socket' /etc/php.ini
```

> **Warning:** **IPRPS release override.** In Stage F, **skip** BLFS's `mariadb-admin -u root password` step, and shut the server down with `mariadb-admin -u root shutdown` instead of `mariadb-admin -p shutdown`. Without a password, the database's root account is reachable only by the computer's own root user, through the socket. Each installation then gets its own random application password at first boot (13.1). A shared root password baked into every downloaded image would be a security hole.

Enable and test, as root:

**[IPRPS CHROOT]**

```bash
systemctl enable --now httpd.service php-fpm.service mariadb.service
echo '<?php phpinfo();' > /srv/www/iprps/info.php
wget -qO- http://localhost/iprps/info.php | grep -o 'PHP Version [0-9.]*' | head -1
rm /srv/www/iprps/info.php
mariadb -u root -e 'SELECT VERSION();'
```

### 10.2 The IPRPS campaign database

This schema is the shared foundation for all campaign and player-tracking tools. Save it where first boot can find it:

**[IPRPS CHROOT]**

```bash
install -vdm755 /usr/share/iprps/schema
cat > /usr/share/iprps/schema/iprps-core.sql << "EOF"
-- IPRPS core schema: campaigns, players, characters, sessions and play tracking
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS campaigns (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(160) NOT NULL,
  setting       VARCHAR(160),
  description   TEXT,
  status        ENUM('planning','active','paused','finished') NOT NULL DEFAULT 'planning',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS players (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  display_name  VARCHAR(100) NOT NULL,
  contact       VARCHAR(200),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS characters (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  player_id     INT UNSIGNED NULL,
  name          VARCHAR(120) NOT NULL,
  species       VARCHAR(80),
  role          VARCHAR(80),
  level         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  xp            INT UNSIGNED NOT NULL DEFAULT 0,
  hp_current    INT,
  hp_max        INT,
  sheet_json    JSON,
  portrait_path VARCHAR(255),
  status        ENUM('active','retired','dead','npc') NOT NULL DEFAULT 'active',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id)   REFERENCES players(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  session_no    SMALLINT UNSIGNED NOT NULL,
  title         VARCHAR(160),
  scheduled_at  DATETIME,
  played_at     DATETIME,
  recap         TEXT,
  sm_notes      TEXT,
  UNIQUE KEY (campaign_id, session_no),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance (
  session_id    INT UNSIGNED NOT NULL,
  player_id     INT UNSIGNED NOT NULL,
  character_id  INT UNSIGNED NULL,
  present       BOOLEAN NOT NULL DEFAULT TRUE,
  xp_awarded    INT NOT NULL DEFAULT 0,
  notes         TEXT,
  PRIMARY KEY (session_id, player_id),
  FOREIGN KEY (session_id)   REFERENCES sessions(id)   ON DELETE CASCADE,
  FOREIGN KEY (player_id)    REFERENCES players(id)    ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS encounters (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id    INT UNSIGNED NOT NULL,
  name          VARCHAR(160) NOT NULL,
  round_no      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS initiative (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  encounter_id  INT UNSIGNED NOT NULL,
  character_id  INT UNSIGNED NULL,
  label         VARCHAR(120) NOT NULL,
  initiative    SMALLINT NOT NULL DEFAULT 0,
  hp            INT,
  conditions    VARCHAR(255),
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS npcs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          VARCHAR(120),
  notes         TEXT,
  portrait_path VARCHAR(255),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quests (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  title         VARCHAR(160) NOT NULL,
  status        ENUM('open','active','done','failed') NOT NULL DEFAULT 'open',
  notes         TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS handouts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  title         VARCHAR(160) NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  revealed      BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS session_log (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id    INT UNSIGNED NOT NULL,
  logged_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kind          ENUM('note','roll','combat','loot','xp','event') NOT NULL DEFAULT 'note',
  text          TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
EOF
grep -c "CREATE TABLE" /usr/share/iprps/schema/iprps-core.sql
```

Test it now, then drop the test database:

**[IPRPS CHROOT]**

```bash
mariadb -u root -e 'CREATE DATABASE iprps_test CHARACTER SET utf8mb4'
mariadb -u root iprps_test < /usr/share/iprps/schema/iprps-core.sql
mariadb -u root -e 'SHOW TABLES' iprps_test
mariadb -u root -e 'DROP DATABASE iprps_test'
```

> **Side note:** `sheet_json` stores a full character sheet as JSON, so IPRPS sheets (including data imported from `.iprps` files) fit without schema changes. The Universal Login tables (`ip_users`, `ip_sessions`) live in their own database as in the existing IPRPS web apps.

> **Checkpoint:** Take snapshot **`F-webstack`**.

**[DEBIAN ROOT]** — snapshot `F-webstack`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-F-webstack.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-F-webstack.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 11 — Stage G: Lite Edition Apps

The Lite edition's apps: **Firefox** (for the IPRPS web apps), **Evince** (PDF), **Parole** (music and ambience) and **mpv** (video, and ambience playback in Session Master Mode).

> **Warning:** Firefox is a very large build (Rust and C++). Give the VM its full memory, limit jobs as in 0.3, and expect several hours.

**25 packages, in build order:** dav1d-1.5.4, SDL3-3.4.14, sdl2-compat-2.32.70, tiff-4.7.2, libwebp-1.6.0, c-ares-1.34.8, Node.js-24.19.0, Firefox-153.2.0esr, libhandy-1.8.3, OpenJPEG-2.5.4, boost-1.92.0, Poppler-26.08.0, Evince-48.4, dbus-glib-0.114, utfcpp-4.1.1, Taglib-2.3.1, Parole-4.20.0, libass-0.17.5, x264-20250815, FFmpeg-9.0.1, Glad-2.0.8, libplacebo-7.360.1, luajit-20260213, Uchardet-0.0.8, mpv-0.41.0.

### dav1d-1.5.4

*BLFS 13.1 · ID `dav1d` · Stage G* · *Build time:* 0.3 SBU (using parallelism=4; with tests) · *Disk space:* 26 MB (with tests)

**Recommended (included):** `nasm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://code.videolan.org/videolan/dav1d/-/archive/1.5.4/dav1d-1.5.4.tar.gz
```

MD5 sum of `dav1d-1.5.4.tar.gz`: `af9b8fdb97f436a76b73425ed16b6239` (check with `md5sum dav1d-1.5.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf dav1d-1.5.4.tar.gz
cd "$(tar -tf dav1d-1.5.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install dav1d by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release --wrap-mode=nofallback .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf dav1d-1.5.4.tar.gz | head -1 | cut -d/ -f1)"
```


### SDL3-3.4.14

*BLFS 13.1 · ID `sdl3` · Stage G* · *Build time:* 0.3 SBU (Using parallelism=4; add 0.3 SBU for tests) · *Disk space:* 121 MB (add 105 MB for tests)

**Requires:** `cmake`  
**Recommended (included):** `alsa-lib`, `libusb`, `libxkbcommon`, `mesa`, `pipewire`, `pulseaudio`, `vulkan-loader`, `wayland-protocols`, `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.libsdl.org/release/SDL3-3.4.14.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/SDL3-3.4.14-upstream_fixes-1.patch
```

MD5 sum of `SDL3-3.4.14.tar.gz`: `32968d1180d29903e70cd3f7fc38470b` (check with `md5sum SDL3-3.4.14.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf SDL3-3.4.14.tar.gz
cd "$(tar -tf SDL3-3.4.14.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Fix potential conflicts with getresuid by applying a patch:

```bash
patch -Np1 -i ../SDL3-3.4.14-upstream_fixes-1.patch
```

**[BUILDER]** — Install SDL3 by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D SDL_TEST_LIBRARY=OFF      \
      -D SDL_STATIC=OFF            \
      -D SDL_RPATH=OFF             \
      -W no-author -G Ninja ..     &&

ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**Testing SDL3:**

**[BUILDER]** — *(Optional — skip if unsure)* If you want to build the tests, issue the following commands:

```bash
mkdir ../build-tests &&
cd    ../build-tests &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D SDL_STATIC=OFF            \
      -D SDL_RPATH=OFF             \
      -D SDL_TESTS=ON              \
      -D SDL_INSTALL_TESTS=ON      \
      -W no-author -G Ninja ..     &&

ninja &&
DESTDIR=$PWD/TESTS ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf SDL3-3.4.14.tar.gz | head -1 | cut -d/ -f1)"
```


### sdl2-compat-2.32.70

*BLFS 13.1 · ID `sdl2` · Stage G* · *Build time:* 0.1 SBU (add 0.1 SBU for tests) · *Disk space:* 63 MB (add 29 MB for tests)

**Requires:** `cmake`, `sdl3`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.libsdl.org/release/sdl2-compat-2.32.70.tar.gz
```

MD5 sum of `sdl2-compat-2.32.70.tar.gz`: `ba9179f09652a6395b3673e4ce8c473b` (check with `md5sum sdl2-compat-2.32.70.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf sdl2-compat-2.32.70.tar.gz
cd "$(tar -tf sdl2-compat-2.32.70.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install sdl2-compat by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr   \
      -D CMAKE_BUILD_TYPE=Release    \
      -D CMAKE_SKIP_INSTALL_RPATH=ON \
      -D SDL2COMPAT_STATIC=OFF       \
      -D SDL2COMPAT_TESTS=OFF        \
      -W no-author -G Ninja ..       &&

ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
rm -vf /usr/lib/libSDL2_test.a
```

**Testing sdl2-compat:**

**[BUILDER]** — *(Optional — skip if unsure)* If you want to build the tests, issue the following commands:

```bash
mkdir ../build-tests &&
cd    ../build-tests &&

cmake -D CMAKE_INSTALL_PREFIX=/usr   \
      -D CMAKE_BUILD_TYPE=Release    \
      -D CMAKE_SKIP_INSTALL_RPATH=ON \
      -D SDL2COMPAT_INSTALL_TESTS=ON \
      -D SDL2COMPAT_STATIC=OFF       \
      -D SDL2COMPAT_TESTS=ON         \
      -W no-author -G Ninja ..       &&

ninja &&
DESTDIR=$PWD/TESTS ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf sdl2-compat-2.32.70.tar.gz | head -1 | cut -d/ -f1)"
```


### tiff-4.7.2

*BLFS 13.1 · ID `tiff` · Stage G* · *Build time:* 0.3 SBU (with tests) · *Disk space:* 56 MB (with tests)

**Recommended (included):** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.osgeo.org/libtiff/tiff-4.7.2.tar.gz
```

MD5 sum of `tiff-4.7.2.tar.gz`: `a2a65ea450b8f469c667128848ffebfc` (check with `md5sum tiff-4.7.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf tiff-4.7.2.tar.gz
cd "$(tar -tf tiff-4.7.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install tiff by running the following commands:

```bash
mkdir -p tiff-build &&
cd       tiff-build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -W no-author -G Ninja ..
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
mv -v /usr/share/doc/tiff{,-4.7.2}
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf tiff-4.7.2.tar.gz | head -1 | cut -d/ -f1)"
```


### libwebp-1.6.0

*BLFS 13.1 · ID `libwebp` · Stage G* · *Build time:* 0.3 SBU · *Disk space:* 41 MB

**Recommended (included):** `libjpeg`, `libpng`, `tiff`, `sdl2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.6.0.tar.gz
```

MD5 sum of `libwebp-1.6.0.tar.gz`: `cceb6447180f961473b181c9ef38b630` (check with `md5sum libwebp-1.6.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libwebp-1.6.0.tar.gz
cd "$(tar -tf libwebp-1.6.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libwebp by running the following commands:

```bash
./configure --prefix=/usr           \
            --enable-libwebpmux     \
            --enable-libwebpdemux   \
            --enable-libwebpdecoder \
            --enable-libwebpextras  \
            --enable-swap-16bit-csp \
            --disable-static        &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libwebp-1.6.0.tar.gz | head -1 | cut -d/ -f1)"
```


### c-ares-1.34.8

*BLFS 13.1 · ID `c-ares` · Stage G* · *Build time:* 0.1 SBU · *Disk space:* 11 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/c-ares/c-ares/releases/download/v1.34.8/c-ares-1.34.8.tar.gz
```

MD5 sum of `c-ares-1.34.8.tar.gz`: `a0568780ffe1476160a6bbb4b6737261` (check with `md5sum c-ares-1.34.8.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf c-ares-1.34.8.tar.gz
cd "$(tar -tf c-ares-1.34.8.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install c-ares by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake  -D CMAKE_INSTALL_PREFIX=/usr .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf c-ares-1.34.8.tar.gz | head -1 | cut -d/ -f1)"
```


### Node.js-24.19.0

*BLFS 13.1 · ID `nodejs` · Stage G* · *Build time:* 16 SBU (add 3.5 SBU for tests: both using parallelism=8 and 8 CPUs online, parts of the tests will use all online CPUs) · *Disk space:* 1.4 GB (with tests)

**Requires:** `which`  
**Recommended (included):** `brotli`, `c-ares`, `icu`, `libuv`, `nghttp2`, `simdutf`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://nodejs.org/dist/v24.19.0/node-v24.19.0.tar.xz
```

MD5 sum of `node-v24.19.0.tar.xz`: `9746bea71fd37c5ec17236b713e0879f` (check with `md5sum node-v24.19.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf node-v24.19.0.tar.xz
cd "$(tar -tf node-v24.19.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS: finish the build before installing.** Node.js is a long build. Let `make` finish in BUILDER (`-j4` uses less memory; check with `out/Release/node --version`) before running `make install` as root. If `make install` starts compiling (`g++ -o ...` lines), the build wasn't finished: press Ctrl+C, run `chown -R builder:builder /build/src/node-v24.19.0` in IPRPS CHROOT, and finish `make` in BUILDER.

**Build and install:**

**[BUILDER]** — Build Node.js by running the following commands:

```bash
./configure --prefix=/usr          \
            --shared-brotli        \
            --shared-cares         \
            --shared-libuv         \
            --shared-nghttp2       \
            --shared-openssl       \
            --shared-simdutf       \
            --shared-zlib          \
            --with-intl=system-icu &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
ln -sf node /usr/share/doc/node-24.19.0
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf node-v24.19.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Firefox-153.2.0esr

*BLFS 13.1 · ID `firefox` · Stage G* · *Build time:* 15 SBU using -j8, without tests · *Disk space:* 8.9 GB (268 MB installed) without tests

**Requires:** `cbindgen`, `gtk3`, `libnotify`, `libarchive`, `llvm`, `nodejs`, `pulseaudio`, `alsa-lib`, `startup-notification`  
**Recommended (included):** `dav1d`, `icu`, `libaom`, `libevent`, `libvpx`, `libwebp`, `nasm`, `nss`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.mozilla.org/pub/firefox/releases/153.2.0esr/source/firefox-153.2.0esr.source.tar.xz
```

MD5 sum of `firefox-153.2.0esr.source.tar.xz`: `127f9c7fe72cf8cc9a47f35a051303f0` (check with `md5sum firefox-153.2.0esr.source.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf firefox-153.2.0esr.source.tar.xz
cd "$(tar -tf firefox-153.2.0esr.source.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS release override.** BLFS notes that a Firefox built with `--enable-official-branding` **cannot be distributed**, and its mozconfig embeds a Google location API key. In the mozconfig below, both lines are already commented out. The browser then builds with Mozilla's generic "unofficial" branding, which may be redistributed.

> **Side note:** **Running `./mach`.** `cat > mozconfig`, the two `export` lines and `./mach build` must all run **inside the Firefox source folder** (`ls mach mozconfig` lists both). `MOZBUILD_STATE_PATH=${PWD}/mozbuild` takes the folder you're in, so export it again after changing folders. Firefox is the longest build of the project (several hours). If it's killed for lack of memory, run `export MOZ_PARALLEL_BUILD=4` before `./mach build`. After an interruption, the same commands in the same folder continue the build. The two `export` lines are also needed in IPRPS CHROOT before `./mach install`.

**Build and install:**

**[BUILDER]** — The configuration of Firefox is accomplished by creating a mozconfig file containing the desired configuration options. A default mozconfig is created below. To see the entire list of available configuration options (and an abbreviated description of some…

```bash
cat > mozconfig << "EOF"
# If you have a multicore machine, all cores will be used by default.

# If you have installed (or will install) wireless-tools, and you wish
# to use geolocation web services, comment out this line
ac_add_options --disable-necko-wifi

# Comment out the following line if you wish not to use Google's Location
# Service (GLS).  Note that if Geoclue is installed and configured to use
# GLS (as the BLFS instruction does), Firefox can access GLS via Geoclue
# anyway.  On the other hand if Geoclue is not installed (or not properly
# configured) and this line is commented out, the website requiring a
# location service will not function properly.
# IPRPS: no embedded third-party API key in distributed builds
# ac_add_options --with-google-location-service-api-keyfile=$PWD/google-key

# If you wish to use libproxy to determine proxy server information, you will
# need to install the libproxy package and then uncomment the option below:
#ac_add_options --enable-libproxy

# Uncomment the following option if you have not installed PulseAudio and
# want to use alsa instead
#ac_add_options --enable-audio-backends=alsa

# Comment out following options if you have not installed
# recommended dependencies:
ac_add_options --with-system-av1
ac_add_options --with-system-icu
ac_add_options --with-system-libevent
ac_add_options --with-system-libvpx
ac_add_options --with-system-nspr
ac_add_options --with-system-nss
ac_add_options --with-system-webp

# Firefox provides a copy of dav1d if it has not been installed. If you have
# not installed nasm and ffmpeg, uncomment the following line:
#ac_add_options --disable-av1

# You cannot distribute the binary if you do this.
# IPRPS: official branding may not be redistributed without Mozilla's permission
# ac_add_options --enable-official-branding

# Stripping is now enabled by default.
# Uncomment these lines if you need to run a debugger:
#ac_add_options --disable-strip
#ac_add_options --disable-install-strip

# Disabling debug symbols makes the build much smaller and a little
# faster. Comment this if you need to run a debugger.
ac_add_options --disable-debug-symbols

# The BLFS editors recommend not changing anything below this line:
ac_add_options --prefix=/usr
ac_add_options --enable-application=browser
ac_add_options --disable-crashreporter
ac_add_options --disable-updater

# Enabling the tests will use a lot more space and significantly
# increase the build time, for no obvious benefit.
ac_add_options --disable-tests

# This enables SIMD optimization in the shipped encoding_rs crate.
ac_add_options --enable-rust-simd

ac_add_options --enable-system-ffi
ac_add_options --enable-system-pixman

ac_add_options --with-system-jpeg
ac_add_options --with-system-png
ac_add_options --with-system-zlib

# Sandboxing works well on x86_64 but might cause issues on other
# platforms, e.g. i686.
[ $(uname -m) != x86_64 ] && ac_add_options --disable-sandbox

# Using sandboxed wasm libraries has been moved to all builds instead
# of only mozilla automation builds. It requires extra llvm packages
# and was reported to seriously slow the build. Disable it.
ac_add_options --without-wasm-sandboxed-libraries

# The following option unsets Telemetry Reporting. With the Addons Fiasco,
# Mozilla was found to be collecting user's data, including saved passwords and
# web form data, without users consent. Mozilla was also found shipping updates
# to systems without the user's knowledge or permission.
# As a result of this, use the following command to permanently disable
# telemetry reporting in Firefox.
unset MOZ_TELEMETRY_REPORTING

mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/firefox-build-dir

# By default firefox will attempt to use the window class firefox-default on
# launch. This makes the icon not work properly because wayland does not
# support the X11 property  class header. Change the remoting name to fix this.
# This is also reflected in the .desktop file where StartupWMClass is set to
# firefox.
MOZ_APP_REMOTINGNAME=firefox
EOF
```

> **Side note (BLFS):** Taken from Arch Linux - an immensely helpful link - Thanks The Google API Key below is specific to LFS. If using these instructions for another distro, or if you intend to distribute binary copies of the software using these instructions, please obtain your own key following the instructions located at . BLFS Devs, register an account at Google with your @linuxfromscratch.org email address, and I'll make you an administrator for the 'Google APIs for LFS' project (where the API and OAuth keys were created for use in the book).

**[BUILDER]** — If the geolocation APIs are needed:

```bash
# IPRPS: skip this step. The key belongs to the LFS project and must not be
# built into IPRPS OS; Firefox works without geolocation.
```

> **Side note (BLFS):** If you are compiling this package in chroot you must ensure that /dev/shm is mounted. If you do not do this, the Python configuration will fail with a traceback report referencing /usr/lib/pythonN.N/multiprocessing/synchronize.py. As the root user, run: mountpoint -q /dev/shm || mount -t tmpfs devshm /dev/shm

**[BUILDER]** — *(Optional — skip if unsure)* If you are compiling this package in chroot you must ensure that /dev/shm is mounted. If you do not do this, the Python configuration will fail with a traceback report referencing /usr/lib/pythonN.N/multiprocessing/synchronize.py. As the root user, run:…

```bash
mountpoint -q /dev/shm || mount -t tmpfs devshm /dev/shm
```

**[BUILDER]** — Compile Firefox by issuing the following commands:

```bash
export MACH_BUILD_PYTHON_NATIVE_PACKAGE_SOURCE=none &&
export MOZBUILD_STATE_PATH=${PWD}/mozbuild          &&
./mach build
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
export MACH_BUILD_PYTHON_NATIVE_PACKAGE_SOURCE=none &&
./mach install
```

**[BUILDER]** — Empty the environment variables which were set above:

```bash
unset MACH_BUILD_PYTHON_NATIVE_PACKAGE_SOURCE
unset MOZBUILD_STATE_PATH
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If you use a desktop environment like Gnome or KDE you may want to create a firefox.desktop file so that Firefox appears in the panel's menus. As the root user:

```bash
mkdir -pv /usr/share/applications &&
mkdir -pv /usr/share/pixmaps      &&

MIMETYPE="text/xml;text/mml;text/html;"                            &&
MIMETYPE+="application/xhtml+xml;application/vnd.mozilla.xul+xml;" &&
MIMETYPE+="x-scheme-handler/http;x-scheme-handler/https"           &&

cat > /usr/share/applications/firefox.desktop << EOF &&
[Desktop Entry]
Encoding=UTF-8
Name=Firefox Web Browser
Comment=Browse the World Wide Web
GenericName=Web Browser
Exec=firefox %u
Terminal=false
Type=Application
Icon=firefox
Categories=GNOME;GTK;Network;WebBrowser;
MimeType=$MIMETYPE
StartupNotify=true
StartupWMClass=firefox
EOF

unset MIMETYPE &&

ln -sfv /usr/lib/firefox/browser/chrome/icons/default/default128.png \
        /usr/share/pixmaps/firefox.png
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf firefox-153.2.0esr.source.tar.xz | head -1 | cut -d/ -f1)"
```


### libhandy-1.8.3

*BLFS 13.1 · ID `libhandy1` · Stage G* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 24 MB (with tests)

**Requires:** `gtk3`  
**Recommended (included):** `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libhandy/1.8/libhandy-1.8.3.tar.xz
```

MD5 sum of `libhandy-1.8.3.tar.xz`: `af586a91ff6d4093a6e7e283dfab5f7f` (check with `md5sum libhandy-1.8.3.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libhandy-1.8.3.tar.xz
cd "$(tar -tf libhandy-1.8.3.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libhandy by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libhandy-1.8.3.tar.xz | head -1 | cut -d/ -f1)"
```


### OpenJPEG-2.5.4

*BLFS 13.1 · ID `openjpeg2` · Stage G* · *Build time:* 0.2 SBU (add 1.1 SBU for tests) · *Disk space:* 16 MB (add 1.7 GB for tests)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/uclouvain/openjpeg/archive/v2.5.4/openjpeg-2.5.4.tar.gz
```

MD5 sum of `openjpeg-2.5.4.tar.gz`: `6160de075bb5191e482bc0f024b375e4` (check with `md5sum openjpeg-2.5.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf openjpeg-2.5.4.tar.gz
cd "$(tar -tf openjpeg-2.5.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install OpenJPEG by running the following commands:

```bash
mkdir -v build &&
cd       build &&

cmake -D CMAKE_BUILD_TYPE=Release  \
      -D CMAKE_INSTALL_PREFIX=/usr \
      -D BUILD_STATIC_LIBS=OFF ..  &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you wish to run the tests, some additional files are required. Download these files and run the tests using the following commands, but note that 8 tests are known to fail:

```bash
git clone https://github.com/uclouvain/openjpeg-data.git --depth 1 &&
OPJ_DATA_ROOT=$PWD/openjpeg-data cmake -D BUILD_TESTING=ON ..      &&
make                                                               &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
cp -rv ../doc/man -T /usr/share/man
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf openjpeg-2.5.4.tar.gz | head -1 | cut -d/ -f1)"
```


### boost-1.92.0

*BLFS 13.1 · ID `boost` · Stage G* · *Build time:* 1.7 SBU (Using parallelism=4; add 0.2 SBU for tests) · *Disk space:* 959 MB (208 MB installed)

**Recommended (included):** `which`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/boostorg/boost/releases/download/boost-1.92.0/boost-1.92.0-b2-nodocs.tar.xz
```

MD5 sum of `boost-1.92.0-b2-nodocs.tar.xz`: `01f7ba6534c21e1b49dc9f69524bf5e4` (check with `md5sum boost-1.92.0-b2-nodocs.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf boost-1.92.0-b2-nodocs.tar.xz
cd "$(tar -tf boost-1.92.0-b2-nodocs.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a build issue which occurs in the stacktrace library. This issue is specific to i686 systems.

```bash
case $(uname -m) in
   i?86)
      sed -e "s/defined(__MINGW32__)/& || defined(__i386__)/" \
          -i ./libs/stacktrace/src/exception_headers.h ;;
esac
```

**[BUILDER]** — This package can be built with several jobs running in parallel. In the instructions below, all available logical cores are used. Replace $(nproc) with the number of logical cores you want to use if you don't want to use all. Install Boost by running the…

```bash
./bootstrap.sh --prefix=/usr --with-python=python3 &&
./b2 stage -j$(nproc) threading=multi link=shared
```

> **Side note (BLFS):** Boost installs many versioned directories in /usr/lib/cmake. If a new version of Boost is installed over a previous version, the older cmake directories need to be explicitly removed. To do this, run as the root user: before installing the new version.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* Boost installs many versioned directories in /usr/lib/cmake. If a new version of Boost is installed over a previous version, the older cmake directories need to be explicitly removed. To do this, run as the root user: before installing the new version.

```bash
rm -rf /usr/lib/cmake/[Bb]oost*
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
./b2 install threading=multi link=shared
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf boost-1.92.0-b2-nodocs.tar.xz | head -1 | cut -d/ -f1)"
```


### Poppler-26.08.0

*BLFS 13.1 · ID `poppler` · Stage G* · *Build time:* 1.3 SBU (with parallelism=4, tests, and Qt6 library) · *Disk space:* 1.2 GB (with Qt6 library and tests)

**Requires:** `cmake`, `fontconfig`, `glib2`  
**Recommended (included):** `boost`, `cairo`, `lcms2`, `libjpeg`, `libpng`, `tiff`, `nss`, `openjpeg2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://poppler.freedesktop.org/poppler-26.08.0.tar.xz
wget https://poppler.freedesktop.org/poppler-data-0.4.12.tar.gz
```

MD5 sum of `poppler-26.08.0.tar.xz`: `0c7953c55c449f20d97adbe355bcf49d` (check with `md5sum poppler-26.08.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf poppler-26.08.0.tar.xz
cd "$(tar -tf poppler-26.08.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** **IPRPS changes.** `-D ENABLE_QT6=OFF` (no Qt 6 in IPRPS OS) and `-D ENABLE_GPGME=OFF` (GnuPG-signed PDFs; needs GPGME++, which isn't built). **poppler-data** is unpacked *inside* Poppler's `build` folder (that's what `../../` means), so its root install runs in `/build/src/poppler-26.08.0/build/poppler-data-0.4.12`. Check: `ls /usr/share/poppler` lists `cMap` and other folders.

**Build and install:**

**[BUILDER]** — Now, install Poppler by running the following commands:

```bash
mkdir build                         &&
cd    build                         &&

cmake -D CMAKE_BUILD_TYPE=Release   \
      -D CMAKE_INSTALL_PREFIX=/usr  \
      -D TESTDATADIR=$PWD/testfiles \
      -D ENABLE_QT5=OFF             \
      -D ENABLE_QT6=OFF             \
      -D ENABLE_GPGME=OFF           \
      -D ENABLE_UNSTABLE_API_ABI_HEADERS=ON \
      -G Ninja ..                   &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* To install the documentation, run the following commands as root:

```bash
install -v -m755 -d           /usr/share/doc/poppler-26.08.0 &&
cp -vr ../glib/reference/html /usr/share/doc/poppler-26.08.0
```

**[BUILDER]** — *(Optional — skip if unsure)* If you downloaded the additional encoding data package, install it by issuing the following commands:

```bash
tar -xf ../../poppler-data-0.4.12.tar.gz &&
cd poppler-data-0.4.12
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make prefix=/usr install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf poppler-26.08.0.tar.xz | head -1 | cut -d/ -f1)"
```


### Evince-48.4

*BLFS 13.1 · ID `evince` · Stage G* · *Build time:* 0.1 SBU (Using parallelism=4) · *Disk space:* 90 MB

**Requires:** `adwaita-icon-theme`, `gsettings-desktop-schemas`, `gtk3`, `itstool`, `libhandy1`, `libxml2`, `openjpeg2`  
**Recommended (included):** `gnome-keyring`, `glib2`, `libarchive`, `libsecret`, `poppler`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/evince/48/evince-48.4.tar.xz
```

MD5 sum of `evince-48.4.tar.xz`: `5df36228e83ac93a5860f013af50c5c8` (check with `md5sum evince-48.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf evince-48.4.tar.xz
cd "$(tar -tf evince-48.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Evince by running the following commands:

```bash
mkdir build &&
cd    build &&

CPPFLAGS+=" -I/opt/texlive/2026/include -DNO_DEBUG" \
meson setup --prefix=/usr                \
            --buildtype=release          \
            -D gtk_doc=false             \
            --wrap-mode=nodownload       \
            ..                           &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed "/docs_dir/s@\$@ / 'evince-48.4'@" -i ../help/meson.build &&
meson configure -D gtk_doc=true                                 &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

> **Side note (BLFS):** If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you installed the package to your system using a DESTDIR method, /usr/share/glib-2.0/schemas/gschemas.compiled was not updated/created. Create (or update) the file using the following command as the root user:

```bash
glib-compile-schemas /usr/share/glib-2.0/schemas
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf evince-48.4.tar.xz | head -1 | cut -d/ -f1)"
```


### dbus-glib-0.114

*BLFS 13.1 · ID `dbus-glib` · Stage G* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 11 MB (with tests)

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://dbus.freedesktop.org/releases/dbus-glib/dbus-glib-0.114.tar.gz
```

MD5 sum of `dbus-glib-0.114.tar.gz`: `188792077e880a8c0359288d7819dab3` (check with `md5sum dbus-glib-0.114.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf dbus-glib-0.114.tar.gz
cd "$(tar -tf dbus-glib-0.114.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install D-Bus GLib by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --disable-static  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf dbus-glib-0.114.tar.gz | head -1 | cut -d/ -f1)"
```


### utfcpp-4.1.1

*BLFS 13.1 · ID `utfcpp` · Stage G* · *Build time:* less than 0.1 SBU · *Disk space:* 716 KB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/nemtrif/utfcpp/archive/v4.1.1/utfcpp-4.1.1.tar.gz
```

MD5 sum of `utfcpp-4.1.1.tar.gz`: `2b439bf8f222cd85bac0d2603265a246` (check with `md5sum utfcpp-4.1.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf utfcpp-4.1.1.tar.gz
cd "$(tar -tf utfcpp-4.1.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install utfcpp by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr ..
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf utfcpp-4.1.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Taglib-2.3.1

*BLFS 13.1 · ID `taglib` · Stage G* · *Build time:* 0.1 SBU (Using parallelism=4) · *Disk space:* 25 MB

**Requires:** `cmake`, `utfcpp`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://taglib.org/releases/taglib-2.3.1.tar.gz
```

MD5 sum of `taglib-2.3.1.tar.gz`: `b189dcfcf284179c04b97a89887e0ce6` (check with `md5sum taglib-2.3.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf taglib-2.3.1.tar.gz
cd "$(tar -tf taglib-2.3.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Taglib by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D BUILD_SHARED_LIBS=ON \
      .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf taglib-2.3.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Parole-4.20.0

*BLFS 13.1 · ID `parole` · Stage G* · *Build time:* 0.2 SBU · *Disk space:* 19 MB

**Requires:** `dbus-glib`, `gst10-plugins-base`, `gst10-plugins-good`, `libxfce4ui`  
**Recommended (included):** `libnotify`, `taglib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/apps/parole/4.20/parole-4.20.0.tar.xz
```

MD5 sum of `parole-4.20.0.tar.xz`: `388dee33b1d06ee89f007b4cb08dedaf` (check with `md5sum parole-4.20.0.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf parole-4.20.0.tar.xz
cd "$(tar -tf parole-4.20.0.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Parole by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf parole-4.20.0.tar.xz | head -1 | cut -d/ -f1)"
```


### libass-0.17.5

*BLFS 13.1 · ID `libass` · Stage G* · *Build time:* 0.1 SBU · *Disk space:* 9.9 MB

**Requires:** `freetype2`, `fribidi`  
**Recommended (included):** `fontconfig`, `nasm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/libass/libass/releases/download/0.17.5/libass-0.17.5.tar.xz
```

MD5 sum of `libass-0.17.5.tar.xz`: `d9aeb9dac0ca97acbaae96c35af4013b` (check with `md5sum libass-0.17.5.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libass-0.17.5.tar.xz
cd "$(tar -tf libass-0.17.5.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libass by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libass-0.17.5.tar.xz | head -1 | cut -d/ -f1)"
```


### x264-20250815

*BLFS 13.1 · ID `x264` · Stage G* · *Build time:* 0.2 SBU (Using parallelism=4) · *Disk space:* 15 MB

**Recommended (included):** `nasm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://anduin.linuxfromscratch.org/BLFS/x264/x264-20250815.tar.xz
```

MD5 sum of `x264-20250815.tar.xz`: `a4adb6f7d2644043765885e54abc3955` (check with `md5sum x264-20250815.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf x264-20250815.tar.xz
cd "$(tar -tf x264-20250815.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install x264 by running the following commands:

```bash
./configure --prefix=/usr   \
            --enable-shared \
            --disable-cli   &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf x264-20250815.tar.xz | head -1 | cut -d/ -f1)"
```


### FFmpeg-9.0.1

*BLFS 13.1 · ID `ffmpeg` · Stage G* · *Build time:* 1.6 SBU (using parallelism=4; add 3.2 SBU (with THREADS=4) to run the FATE suite after sample files are downloaded; add 0.2 SBU for doxygen docs) · *Disk space:* 297 MB (add 1.7 GB for the FATE suite/tests, add 889 MB for documentation)

**Recommended (included):** `dav1d`, `libaom`, `libass`, `freetype2`, `lame`, `libvorbis`, `libvpx`, `opus`, `svt-av1`, `x264`, `x265`, `nasm`, `alsa-lib`, `libva`, `sdl2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ffmpeg.org/releases/ffmpeg-9.0.1.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/ffmpeg-9.0.1-chromium_method-1.patch
```

MD5 sum of `ffmpeg-9.0.1.tar.xz`: `3ed2aab5ce5d18a3c5e0d22d8ca3fadb` (check with `md5sum ffmpeg-9.0.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf ffmpeg-9.0.1.tar.xz
cd "$(tar -tf ffmpeg-9.0.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Warning:** **IPRPS release override.** BLFS builds FFmpeg with `--enable-nonfree` and `--enable-libfdk-aac`. FFmpeg built that way may **not be redistributed**. The command below already has both options removed, so the result is GPL and redistributable. (fdk-aac is left out of the IPRPS build for the same reason.)

**Build and install:**

**[BUILDER]** — First, apply a patch that adds an API necessary for some packages to build: qtwebengine

```bash
patch -Np1 -i ../ffmpeg-9.0.1-chromium_method-1.patch
```

**[BUILDER]** — Install FFmpeg by running the following commands:

```bash
./configure --prefix=/usr        \
            --enable-gpl         \
            --enable-version3    \
            --disable-static     \
            --enable-shared      \
            --disable-debug      \
            --enable-libaom      \
            --enable-libass      \
            --enable-libfreetype \
            --enable-libmp3lame  \
            --enable-libopus     \
            --enable-libvorbis   \
            --enable-libvpx      \
            --enable-libx264     \
            --enable-libx265     \
            --enable-openssl     \
            --enable-libdav1d    \
            --enable-libsvtav1   \
            --ignore-tests=enhanced-flv-av1,enhanced-flv-multitrack \
            --docdir=/usr/share/doc/ffmpeg-9.0.1 &&

make &&

gcc tools/qt-faststart.c -o tools/qt-faststart
```

**[BUILDER]** — HTML documentation was built in the previous step. If you have texlive-20260301-source installed and wish to build PDF and Postscript versions of the documentation, issue the following commands:

```bash
pushd doc &&
for DOCNAME in `basename -s .html *.html`
do
    texi2pdf -b $DOCNAME.texi &&
    texi2dvi -b $DOCNAME.texi &&

    dvips    -o $DOCNAME.ps   \
                $DOCNAME.dvi
done &&
popd &&
unset DOCNAME
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Doxygen-1.18.0 installed and you wish to build (if --disable-doc was used) or rebuild the html documentation, issue:

```bash
doxygen doc/Doxyfile
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&

install -v -m755    tools/qt-faststart /usr/bin &&
install -v -m755 -d           /usr/share/doc/ffmpeg-9.0.1 &&
install -v -m644    doc/*.txt /usr/share/doc/ffmpeg-9.0.1
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If the PDF and Postscript documentation was built, issue the following commands, as the root user, to install them:

```bash
install -v -m644 doc/*.pdf /usr/share/doc/ffmpeg-9.0.1 &&
install -v -m644 doc/*.ps  /usr/share/doc/ffmpeg-9.0.1
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you used doxygen to manually create the API documentation, install it by issuing the following commands as the root user:

```bash
install -v -m755 -d /usr/share/doc/ffmpeg-9.0.1/api                     &&
cp -vr doc/doxy/html/* /usr/share/doc/ffmpeg-9.0.1/api                  &&
find /usr/share/doc/ffmpeg-9.0.1/api -type f -exec chmod -c 0644 \{} \; &&
find /usr/share/doc/ffmpeg-9.0.1/api -type d -exec chmod -c 0755 \{} \;
```

**[BUILDER]** — To properly test the installation you must have rsync-3.5.0 installed and follow the instructions for the FFmpeg Automated Testing Environment (FATE). First, about 1 GB of sample files used to run FATE are downloaded with the command:

```bash
make fate-rsync SAMPLES=fate-suite/
```

**[BUILDER]** — *(Optional — skip if unsure)* The fate-suite directory is created and the files are downloaded there. That command actually runs an rsync command to obtain the sample files. You may want to compress and keep this directory for testing again, for testing in another system, or for when a…

```bash
rsync -vrltLW  --delete --timeout=60 --contimeout=60 \
      rsync://fate-suite.ffmpeg.org/fate-suite/ fate-suite/
```

**[BUILDER]** — Next, execute FATE with the following commands (there are more than 5200 tests in the suite):

```bash
make fate THREADS=N SAMPLES=fate-suite/ | tee ../fate.log &&
grep ^TEST ../fate.log | wc -l
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf ffmpeg-9.0.1.tar.xz | head -1 | cut -d/ -f1)"
```


### Glad-2.0.8

*BLFS 13.1 · ID `glad` · Stage G* · *Build time:* less than 0.1 SBU · *Disk space:* 14 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/Dav1dde/glad/archive/v2.0.8/glad-2.0.8.tar.gz
```

MD5 sum of `glad-2.0.8.tar.gz`: `028c39d581e6b53e53871f1dc21cf442` (check with `md5sum glad-2.0.8.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glad-2.0.8.tar.gz
cd "$(tar -tf glad-2.0.8.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Glad by running the following commands:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the results, you need the optional dependencies above. If you only install dependencies that are in the book, then 12 tests out of 100 fail. Issue:

```bash
PYTHON=python3 utility/test.sh
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user glad2
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glad-2.0.8.tar.gz | head -1 | cut -d/ -f1)"
```


### libplacebo-7.360.1

*BLFS 13.1 · ID `libplacebo` · Stage G* · *Build time:* 0.2 SBU (With tests) · *Disk space:* 38 MB

**Requires:** `glad`  
**Recommended (included):** `glslang`, `vulkan-loader`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/haasn/libplacebo/archive/v7.360.1/libplacebo-7.360.1.tar.gz
```

MD5 sum of `libplacebo-7.360.1.tar.gz`: `e0fa1b52f8d7b7ba51373e9a639ca966` (check with `md5sum libplacebo-7.360.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libplacebo-7.360.1.tar.gz
cd "$(tar -tf libplacebo-7.360.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libplacebo by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D tests=true       \
      -D demos=false      &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libplacebo-7.360.1.tar.gz | head -1 | cut -d/ -f1)"
```


### luajit-20260213

*BLFS 13.1 · ID `luajit` · Stage G* · *Build time:* 0.2 SBU · *Disk space:* 9.1 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://anduin.linuxfromscratch.org/BLFS/luajit/luajit-20260213.tar.xz
```

MD5 sum of `luajit-20260213.tar.xz`: `6459b2696188b74edf950926cb3bacd1` (check with `md5sum luajit-20260213.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf luajit-20260213.tar.xz
cd "$(tar -tf luajit-20260213.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install luajit by running the following commands:

```bash
make PREFIX=/usr amalg
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make PREFIX=/usr install &&
rm -v /usr/lib/libluajit-5.1.a
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf luajit-20260213.tar.xz | head -1 | cut -d/ -f1)"
```


### Uchardet-0.0.8

*BLFS 13.1 · ID `uchardet` · Stage G* · *Build time:* less than 0.1 SBU (with test) · *Disk space:* 4.6 MB (with test)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.freedesktop.org/software/uchardet/releases/uchardet-0.0.8.tar.xz
```

MD5 sum of `uchardet-0.0.8.tar.xz`: `9e267be7aee81417e5875086dd9d44fd` (check with `md5sum uchardet-0.0.8.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf uchardet-0.0.8.tar.xz
cd "$(tar -tf uchardet-0.0.8.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

> **Side note:** uchardet uses CMake **without** Ninja, so it installs with `make install` (not `ninja install`). The rule: if the build step ended with `ninja`, install with `ninja install`; if it ended with `make`, use `make install`.

**Build and install:**

**[BUILDER]** — Install Uchardet by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr        \
      -D BUILD_STATIC=OFF                 \
      -D CMAKE_POLICY_VERSION_MINIMUM=3.5 \
      -W no-author ..                     &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf uchardet-0.0.8.tar.xz | head -1 | cut -d/ -f1)"
```


### mpv-0.41.0

*BLFS 13.1 · ID `mpv` · Stage G* · *Build time:* 0.4 SBU · *Disk space:* 35 MB

**Requires:** `alsa-lib`, `ffmpeg`, `libass`, `libplacebo`, `mesa`, `pulseaudio`  
**Recommended (included):** `libjpeg`, `libva`, `luajit`, `uchardet`, `vulkan-loader`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/mpv-player/mpv/archive/v0.41.0/mpv-0.41.0.tar.gz
```

MD5 sum of `mpv-0.41.0.tar.gz`: `fa40a0fedeaf0a77127e238a39b9d4c4` (check with `md5sum mpv-0.41.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mpv-0.41.0.tar.gz
cd "$(tar -tf mpv-0.41.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install mpv by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr       \
            --buildtype=release \
            -D x11=enabled      \
            ..                  &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

> **Side note (BLFS):** This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and /usr/share/applications/mimeinfo.cache. To perform the update you must have GTK-3.24.52 installed (for the icon cache) and desktop-file-utils-0.28 (for the desktop cache) and issue the following commands as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and…

```bash
gtk-update-icon-cache -qtf /usr/share/icons/hicolor &&
update-desktop-database -q
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mpv-0.41.0.tar.gz | head -1 | cut -d/ -f1)"
```



### Firefox: IPRPS settings

Firefox normally contacts Mozilla at start-up (telemetry, studies, "what's new" pages, region lookup). Offline, those calls fail one by one, which slows the first start, especially from a USB stick. This settings file (a Firefox **policy**, applied to every user) turns them off and makes the Session Master Hub the home page:

**[IPRPS CHROOT]**

```bash
install -vdm755 /usr/lib/firefox/distribution
cat > /usr/lib/firefox/distribution/policies.json << "EOF"
{
  "policies": {
    "DisableTelemetry": true,
    "DisableFirefoxStudies": true,
    "DisableDefaultBrowserAgent": true,
    "DontCheckDefaultBrowser": true,
    "OverrideFirstRunPage": "",
    "OverridePostUpdatePage": "",
    "NoDefaultBookmarks": true,
    "Homepage": { "URL": "http://localhost/iprps/hub/", "StartPage": "homepage" },
    "UserMessaging": { "WhatsNew": false, "ExtensionRecommendations": false, "FeatureRecommendations": false,
                       "UrlbarInterventions": false, "SkipOnboarding": true, "MoreFromMozilla": false },
    "FirefoxHome": { "SponsoredTopSites": false, "SponsoredStories": false }
  }
}
EOF
python3 -m json.tool /usr/lib/firefox/distribution/policies.json > /dev/null && echo "policies OK"
```

Check after a boot test: `about:policies` in Firefox lists them as **Active**. (A policy this Firefox version doesn't know is shown under **Errors** and simply ignored.)

### Drawing: a simple painting program

Lite gets **Drawing** (GPL-3.0), a small paint program: pencil, shapes, text, selection, crop, scale and rotate, saving PNG, JPEG or BMP. It isn't in BLFS; it's Python with GTK 3, PyGObject and pycairo, all already in the build, and it builds with Meson. (GIMP and Inkscape come with Medium.)

**[BUILDER]**

```bash
cd ~/src
wget -O drawing-1.0.2.tar.gz https://github.com/maoschanz/drawing/archive/refs/tags/1.0.2.tar.gz
tar -xf drawing-1.0.2.tar.gz && cd drawing-1.0.2
mkdir build && cd build
meson setup --prefix=/usr --buildtype=release ..
ninja
```

If `meson setup` stops on a missing program (`itstool`, `appstream-util` or `desktop-file-validate`), say which: the first comes with Stage E, the other two are only used by the tests and can be skipped.

**[IPRPS CHROOT]**

```bash
cd /build/src/drawing-1.0.2/build && ninja install
glib-compile-schemas /usr/share/glib-2.0/schemas
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database /usr/share/applications
ls /usr/bin/drawing /usr/share/applications/*drawing*.desktop
python3 -c "import gi; gi.require_version('Gtk','3.0'); from gi.repository import Gtk; import cairo; print('Drawing dependencies OK')"
```

Clean up the source folder as usual. Test: **Applications → Graphics → Drawing** opens a blank canvas; draw, then **Save** as PNG.

> **Checkpoint:** Firefox opens and shows `http://localhost/` (Apache's test page), and Evince, Parole, mpv and Drawing launch from the menu. Take snapshot **`G-lite-apps`**.

**[DEBIAN ROOT]** — snapshot `G-lite-apps`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-G-lite-apps.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-G-lite-apps.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 12 — The IPRPS Apps

### 12.1 Layout on disk

| Path | Contents |
|---|---|
| `/srv/www/iprps/` | Web apps, one folder each (`hub/`, `genesis/`, and so on), served at `http://localhost/iprps/<app>/` |
| `/usr/share/iprps/` | Schema, icons, branding, shared assets |
| `/etc/iprps/` | Settings written at first boot (database credentials), readable by Apache only |
| `/usr/bin/iprps-*` | Command-line helpers and launchers |
| `/opt/iprps/` | Desktop (non-web) IPRPS apps, such as the Media Player, and the IPRPS Table service (12.7) |
| `~/Campaigns/` | Each user's campaign files, handouts, maps and audio |

### 12.2 Launch helpers

**`iprps-open`** starts the local services if needed, then opens an app. Where Chromium is installed (Medium and Advanced, Part 15), each app opens in **its own window**, without tabs or address bar, like a desktop program; in Lite it opens in a Firefox window. Every app window shares one browser profile, so the Universal Login signs you in once for all of them:

**[IPRPS CHROOT]**

```bash
cat > /usr/bin/iprps-open << "EOF"
#!/bin/bash
# iprps-open <app-folder> - open an IPRPS web app (for example: iprps-open hub)
# Medium/Advanced: its own window (Chromium app mode). Lite: a Firefox window.
APP="${1:-}"; APP="${APP%/}"
URL="http://localhost/iprps/${APP:+$APP/}"
for svc in httpd php-fpm mariadb; do
  systemctl is-active --quiet "$svc" || pkexec systemctl start "$svc"
done
if command -v chromium >/dev/null; then
  exec chromium --app="$URL"
else
  exec firefox --new-window "$URL"
fi
EOF
chmod 755 /usr/bin/iprps-open
```

**`iprps-session`** is **Session Master Mode**. It opens the Session Master Hub, starts the ambience player, and opens a full-screen **player display** for a second monitor or projector. On a computer with **one screen** it opens the **IPRPS Table** console instead (12.7), so the players follow on their own phones, tablets and laptops:

**[IPRPS CHROOT]**

```bash
cat > /usr/bin/iprps-session << "EOF"
#!/bin/bash
# iprps-session - Session Master Mode: the Hub, ambience, and the player display
W=/srv/www/iprps
note() { command -v notify-send >/dev/null && notify-send -i iprps-logo "Session Master Mode" "$1"; }
if [ -d "$W/hub" ]; then
  iprps-open hub/ &
else
  note "The Session Master Hub isn't installed in this version yet."
fi
sleep 2
[ -d "$HOME/Campaigns/Audio" ] && mpv --player-operation-mode=pseudo-gui --no-video \
    --shuffle --loop-playlist=inf --title="IPRPS Ambience" "$HOME/Campaigns/Audio" &
# Medium/Advanced: load the Oracle's AI model now, so its first answer is quick
command -v ollama >/dev/null && curl -s -m 2 http://127.0.0.1:11434/api/generate \
    -d '{"model":"iprps-storyteller","keep_alive":"60m"}' >/dev/null &
# The player display: only if a display page is installed
PAGE=""
[ -f "$W/oracle/display.php" ] && PAGE=oracle/display.php
[ -f "$W/hub/display.php" ] && PAGE=hub/display.php
if [ -n "$PAGE" ]; then
  mkdir -p "$HOME/.iprps/player-display"
  SCREENS=$(xrandr --listactivemonitors 2>/dev/null | awk 'NR==1{print $2}')
  if [ "${SCREENS:-1}" -ge 2 ]; then
    # Second screen or projector: full screen there (drag it over if needed; Alt+F4 closes it)
    firefox --no-remote --profile "$HOME/.iprps/player-display" --kiosk "http://localhost/iprps/$PAGE" &
  elif [ -x /usr/bin/iprps-table ]; then
    # One screen: the players follow on their own phones, tablets and laptops (IPRPS Table, 12.7)
    iprps-table &
    note "One screen: open the table, and players join on their own devices. With a second screen or projector, the player display opens there."
  else
    # One screen, no IPRPS Table: a normal window, so it can't cover the desktop
    firefox --no-remote --profile "$HOME/.iprps/player-display" --new-window "http://localhost/iprps/$PAGE" &
    note "Player display opened in a window. With a second screen or projector connected, it opens full screen there."
  fi
fi
wait
EOF
chmod 755 /usr/bin/iprps-session
```

> **Side note:** Ambience plays in a small **IPRPS Ambience** window (mpv), shuffled and looping, from *Campaigns/Audio*. With that window selected: **Space** pauses, **9** and **0** lower and raise the volume, **>** skips to the next track, and **q** stops it. For browsing music or playing a single track, use **Parole** from the menu.

> **Pro tip:** The player display runs in its own Firefox profile. With a **second screen or projector** connected it opens **full screen** (kiosk); with one screen, Session Master Mode opens the **IPRPS Table** (12.7) instead (or, without the Table, the display as a normal window), so it can never hide the desktop. It only opens when a display page is installed (the Hub's, or the Oracle's in Medium and Advanced). Drag it to the second monitor or projector, and press **Alt+F4** to close it. Players see only what the Session Master reveals there: maps, handouts and the initiative order. Until the Hub's own display page exists, Session Master Mode uses the IPRPS Oracle's display (Medium and Advanced), which shows anything sent with **Show players**; both read the same `display_items` table.

### 12.3 Menu launchers

Every IPRPS app gets a `.desktop` file in the IPRPS menu category. Two examples follow; the rest use the same pattern, with `Exec=iprps-open <folder>/`:

**[IPRPS CHROOT]**

```bash
cat > /usr/share/applications/iprps-session.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Session Master Mode
Comment=Open the Session Master Hub, ambience and the player display
Exec=iprps-session
Icon=/usr/share/iprps/icons/iprps-session.png
Categories=X-IPRPS;
EOF
cat > /usr/share/applications/iprps-hub.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Session Master Hub
Comment=Campaigns, players, characters, sessions and encounters
Exec=iprps-open hub/
Icon=/usr/share/iprps/icons/iprps-hub.png
Categories=X-IPRPS;
EOF
update-desktop-database /usr/share/applications
```

### 12.4 Which apps go in which edition

| App | What it does | Status | Lite | Medium | Advanced |
|---|---|---|---|---|---|
| **Session Master Hub** | Home page with the Session Master's apps and **Manage apps** (12.6); campaigns, player roster, characters, XP, attendance, quests, NPCs to come | **Home page and app manager exist** (`hub/`); campaign tools to build (schema in 10.2) | ✔ | ✔ | ✔ |
| **IPRPS Writer** | Word processor in the Hub: headings, bold/italic, lists, alignment; documents saved per account; opens and saves `.docx`, `.odt`, `.txt`, `.html`, prints to PDF | Exists (`writer/`, 12.6) | ✔ | ✔ | ✔ |
| **Initiative and Combat Tracker** | Turn order, HP, conditions; feeds the player display | **To build** (part of the Hub) | ✔ | ✔ | ✔ |
| **Dice Roller** | IPRPS dice mechanics; logs rolls to the session log | **To build** (part of the Hub) | ✔ | ✔ | ✔ |
| **Session Log and Recap** | Timeline of notes, rolls, loot and XP; exports recaps | **To build** (part of the Hub) | ✔ | ✔ | ✔ |
| **IPRPS Table** | LAN play: players join from phones, tablets and laptops on the same network; chat (everyone, players only, private), images and audio, IPRPS dice, and the Session Master pushes pictures, video, text and sound to everyone, groups or single players | Exists (`/opt/iprps/table`, 12.7) | ✔ | ✔ | ✔ |
| **Player Display** | Full-screen handouts, maps and initiative for players | **Exists** (`hub/display.php`, shows text sent to it); maps and initiative to build | ✔ | ✔ | ✔ |
| **Infinite Plane Universal Login** | Single sign-on for the local IPRPS apps | Exists | ✔ | ✔ | ✔ |
| **IPRPS Welcome** | First-run tour; settings for API keys and color scheme | **To build** | ✔ | ✔ | ✔ |
| **IPRPS Media Player** | Music, ambience, CDs and DVDs; IPRPS radio | Exists (Electron + libVLC) | — | ✔ | ✔ |
| **Genesis Character Engine** | AI character reference sheets | Exists (needs internet + API key) | — | ✔ | ✔ |
| **Infinite Plane Writing Assistant** | Writing help for campaigns and lore | Exists (needs internet + API key) | — | ✔ | ✔ |
| **IPRPS Oracle** | Local AI for the Session Master: chat, quick generators (NPC, location, loot, encounter, plot hook, names, read-aloud), campaign memory, save to the campaign, show on the player display | Exists (`oracle/`, Part 15) | — | ✔ | ✔ |
| **Soundboard** | One-click sound effects and ambience during play | **To build** | — | ✔ | ✔ |
| **IPRPS File Viewer** | Open and validate `.iprps`, `.ipai`, `.srpatch` and `.capstone` files | **To build** | — | ✔ | ✔ |
| **Lookbook Studio** | Visual lookbooks for campaigns and settings | Exists | — | — | ✔ |
| **Reel** | Browser-based audio workstation | Exists | — | — | ✔ |
| **THE DIRECTOR** | Story maps into AI video Scene Packages | Exists | — | — | ✔ |
| **Script Breakdown Engine** | Story breakdowns for production | Exists | — | — | ✔ |
| **Generative Art Gallery** | Image gallery with accounts | Exists | — | — | ✔ |
| **RadioStation Manager** | Web radio broadcasting | Exists | — | — | ✔ |
| **IPRPS CD Burner** | Disc burning for IPRPS media | In progress | — | — | ✔ |
| **AI Session Master campaign apps** | AI-run campaigns | Exists (React) | — | — | ✔ |

> **Warning:** Apps that call online AI services need internet access and each user's **own** API keys. Never ship keys in the image. The planned **IPRPS Welcome** app stores each user's keys in one protected place.

### 12.5 Installing the web apps

The IPRPS web apps come from the **live web server** (the real, current versions), not from a local XAMPP copy. They go through a **cleaning step** before they enter the image: the server files contain hosting database passwords and API keys, which must never end up in a distributable image or on GitHub.

The path: **web server → `D:\IPRPS-OS\Server` (Windows) → cleaned copy in `/build/src/iprps-apps` → `/srv/www/iprps` in the image.**

**1. Download the apps and the database structure (Windows).**

- With FileZilla or WinSCP (SFTP), download the **`auth`** folder and **every IPRPS app folder** from the web root into `D:\IPRPS-OS\Server`.
- In the host's **phpMyAdmin**, export every database the apps use: **Export → Custom → SQL → Output: Structure only** (untick "Data"), saved as `D:\IPRPS-OS\Server\sql\<server-name>.sql`. Structure only means tables without any real users or records.

> **Warning:** `D:\IPRPS-OS\Server` holds live keys and hosting passwords. Never copy it into the Git repository or upload it anywhere. Only the cleaned copy goes into the image. Files ending in `.json` or `.env` on the live server can be downloadable by anyone; block them with a `.htaccess` (`<FilesMatch "\.(env|ini|sql|bak)$"> Require all denied </FilesMatch>`) and rotate any key that was reachable.

**2. Find the secrets and databases (DEBIAN ROOT).** This scan shows only the first characters of each match, so it is safe to share:

**[DEBIAN ROOT]**

```bash
cd /mnt/d/IPRPS-OS/Server
grep -rIho -E 'dbs[0-9]{6,}' --include='*.php' --include='*.env' --include='*.json' . | sort | uniq -c
grep -rIno -E "sk-ant-|sk-proj-|AIzaSy[0-9A-Za-z_-]{2}|xai-[A-Za-z0-9]{2}|[a-z0-9.-]*hosting-data\.io|db[su][0-9]{6,}|['\"](pass|password|DB_PASS)['\"]\s*(=>|=|,)\s*['\"][^'\"]{0,3}" \
  --include='*.php' --include='*.js' --include='*.json' --include='*.env' . | sort -u
```

**3. The database map.** Each server database gets a local name; one local database user, **`iprps`**, owns them all:

| Server database | Apps | Local database |
|---|---|---|
| dbs15863785 | auth (Universal Login) | `iprps_auth` |
| dbs15389281, dbs15389600, dbs15389670 | cerebrum | `iprps_cerebrum1`, `2`, `3` |
| dbs15994502 | character-development, sfx | `iprps_character` |
| dbs15968534 | cookbook | `iprps_cookbook` |
| dbs15215034 | infinite-plane-story | `iprps_story` |
| dbs15234695 | interstellar | `iprps_interstellar` |
| dbs15614716 | iprps-crt, prompt_database | `iprps_crt` |
| dbs16050888 | iprps-video | `iprps_video` |
| dbs15250527 | language | `iprps_language` |
| dbs15926577 | lookbook_studio | `iprps_lookbook` |
| dbs15772721 | radiostation | `iprps_radio` |
| dbs15792286 | storyboard-to-screen | `iprps_storyboard` |
| dbs15780226 | story-node-video | `iprps_storynode` |
| dbs15783496 | story-to-screen | `iprps_storytoscreen` |

New apps or databases: add a line to this table and to `DB_MAP` in the cleaning script.

**4. Make the clean copy (DEBIAN ROOT).** `iprps-clean-apps.py` (in the repository's `tools/`) never changes the source. In the copy it leaves out `_old`/backup files and Windows clutter, renames folders with spaces or capitals (`Cerebrum` → `cerebrum`, `camera patch generator` → `camera-patch-generator`, `ComicBookBuilder` → `comic-book-builder`), points every database setting at `localhost`, the local database name and user `iprps`, replaces every database password with the placeholder **`@IPRPS_DB_PASS@`**, and removes API keys and stored passwords. It writes a report.

**[DEBIAN ROOT]**

```bash
cp /mnt/c/Users/<you>/Downloads/iprps-clean-apps.py /root/
python3 -I /root/iprps-clean-apps.py /mnt/d/IPRPS-OS/Server /build/src/iprps-apps
find /build/src/iprps-apps -name '*.log' -exec truncate -s 0 {} +
cp /build/src/iprps-clean-report.txt /mnt/c/Users/<you>/Downloads/
mkdir -p /build/src/iprps-sql && cp -v /mnt/d/IPRPS-OS/Server/sql/*.sql /build/src/iprps-sql/
```

Read the report. **"STILL LOOKS SECRET" must be 0** (empty logs fix the usual leftovers). Files where it changed the database user but found no password use an unusual form: open them (`grep -n -i pass <file> | cut -c1-60` shows the line without the value) and replace the password text with `@IPRPS_DB_PASS@` by hand.

**5. Install (IPRPS CHROOT).** Root owns everything and Apache only reads it, except the folders the apps write to:

**[IPRPS CHROOT]**

```bash
rm -rf /srv/www/iprps/*
cp -r /build/src/iprps-apps/. /srv/www/iprps/
chown -R root:apache /srv/www/iprps
find /srv/www/iprps -type d -exec chmod 755 {} +
find /srv/www/iprps -type f -exec chmod 644 {} +
cd /srv/www/iprps
W="lookbook_studio/data cineforge/projects cineforge/data radiostation/uploads radiostation/logs iprps-crt/uploads iprps-video/api/uploads multicharacter/data cookbook/uploads cookbook/data story-map-builder/data story-to-screen/storage story-node-video/storage iprps-writers-studio/uploads iprps-writers-studio/data iprps_email/uploads iprps_email/data"
for d in $W; do [ -d "$d" ] && chown -R apache:apache "$d"; done
for d in $W; do sudo -u apache test -w "$d" && echo "OK   $d" || echo "FAIL $d"; done
chown root:apache auth/auth-config.php && chmod 640 auth/auth-config.php
```

To find an app's writable folders: `find /srv/www/iprps -type d \( -iname 'upload*' -o -iname cache -o -iname tmp -o -iname logs -o -iname data -o -iname 'output*' -o -iname storage -o -iname projects \)`.

The **Universal Login** lives in `/srv/www/iprps/auth/` (`auth.php`, `auth-check.php`, `auth-client.js`, `login.html` and the cleaned `auth-config.php`). Every app includes `../auth/auth-client.js`, so `auth` must sit next to the apps. `auth.php` creates its `ip_users` and `ip_sessions` tables itself; the export adds the other three.

**6. Create the user, the databases and their tables (IPRPS CHROOT).** The test password is saved in `/root/iprps-dev-db.txt` (root only); 13.4 removes it.

**[IPRPS CHROOT]**

```bash
install -vdm755 -o mariadb -g mariadb /run/mariadb
mariadbd-safe --user=mariadb >/dev/null 2>&1 &
until mariadb-admin -u root ping >/dev/null 2>&1; do sleep 1; done; echo "MariaDB is up"
[ -f /root/iprps-dev-db.txt ] || { echo "iprps $(openssl rand -hex 16)" > /root/iprps-dev-db.txt; chmod 600 /root/iprps-dev-db.txt; }
P=$(awk '{print $2}' /root/iprps-dev-db.txt)
mariadb -u root -e "CREATE USER IF NOT EXISTS 'iprps'@'localhost' IDENTIFIED BY '$P';
ALTER USER 'iprps'@'localhost' IDENTIFIED BY '$P';
GRANT ALL PRIVILEGES ON \`iprps\\_%\`.* TO 'iprps'@'localhost';
FLUSH PRIVILEGES;"
while read s l; do
  mariadb -u root -e "CREATE DATABASE IF NOT EXISTS \`$l\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  f=/build/src/iprps-sql/$s.sql
  if [ -f "$f" ]; then
    sed -E -e '/^CREATE DATABASE/d' -e '/^USE /d' -e 's/DEFINER=`[^`]+`@`[^`]+`//g' "$f" | mariadb -u root "$l" \
      && echo "OK      $l ($(mariadb -u root -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$l'") tables)"
  else
    echo "no SQL  $l (the app may create its tables itself)"
  fi
done << "EOF"
dbs15863785 iprps_auth
dbs15389281 iprps_cerebrum1
dbs15389600 iprps_cerebrum2
dbs15389670 iprps_cerebrum3
dbs15994502 iprps_character
dbs15968534 iprps_cookbook
dbs15215034 iprps_story
dbs15234695 iprps_interstellar
dbs15614716 iprps_crt
dbs16050888 iprps_video
dbs15250527 iprps_language
dbs15926577 iprps_lookbook
dbs15772721 iprps_radio
dbs15792286 iprps_storyboard
dbs15780226 iprps_storynode
dbs15783496 iprps_storytoscreen
EOF
mariadb -u iprps -p"$P" -e "SHOW DATABASES LIKE 'iprps%';"
```

The `until … ping` line waits for the server: MariaDB can take more than a few seconds to start, and commands sent too early fail with "Can't connect … socket". The `sed` strips hosting-specific lines (`CREATE DATABASE`, `USE`, `DEFINER` owners). Run the loop only once per database: loading an export twice fails with "table already exists" (harmless). `iprps_auth` has **5 tables**; the last command, as user `iprps`, must list all 16.

**7. Put the test password into the installed apps, enable the services, stop MariaDB (IPRPS CHROOT):**

**[IPRPS CHROOT]**

```bash
grep -rl '@IPRPS_DB_PASS@' /srv/www/iprps | xargs -r sed -i "s/@IPRPS_DB_PASS@/$P/g"
grep -rl '@IPRPS_DB_PASS@' /srv/www/iprps | wc -l      # 0
systemctl enable httpd php-fpm mariadb
mariadb-admin -u root shutdown; sleep 3; pgrep -a mariadbd || echo "MariaDB stopped"
rm -fv /srv/mariadb/$(hostname).*
```

Only `/srv/www/iprps` gets the test password; the staging copy keeps the placeholder. At release, 13.4 puts the placeholder back and first boot (`iprps-db-init`, 13.1) writes each computer's own password.

**8. Test.** Fresh test copy, log in, Firefox: register at `http://localhost/iprps/auth/login.html`, then open apps (`/iprps/cookbook/`, `/iprps/prompt_database/`…) without logging in again. Errors: `tail -15 /var/log/httpd/error_log` over SSH. AI features stay off until API keys are entered in each app's settings (they were removed on purpose).

> **Pro tip:** Moving apps from Windows/XAMPP: Linux filenames are **case-sensitive** (`Config.php` ≠ `config.php`), `D:\xampp\...` paths must become `/srv/www/iprps/...`, and the database host is `localhost` (the socket; there is no port with `skip-networking`). Shell scripts need Linux line endings: `sed -i 's/\r$//' file.sh`.

### 12.6 The Session Master Hub: home page and app manager

The Hub (`/srv/www/iprps/hub/`, opened by the **Session Master Hub** launcher and by Session Master Mode) starts with its home page: a grid of the Session Master's apps, plus **Manage apps**, which lists **every app in the IPRPS folder** with an on/off switch. Each Session Master has their own choice (saved per Universal Login account, in the `hub_app_prefs` table of the core database); apps stay installed whether they're switched on or off. The campaign tools (campaigns, players, characters, initiative, session log) join the Hub later.

**The default apps** (every edition) are listed in `hub/default-apps.json`:

| Folder | App |
|---|---|
| `writer` | IPRPS Writer |
| `table` | IPRPS Table (opens the LAN play console, 12.7) |
| `prompt_database` | Prompt Database |
| `expressions` | Expressions |
| `sfx` | SFX |
| `character-development` | Character Development |
| `iprps-writers-studio` | IPRPS Writers Studio |
| `camera-patch-generator` | Camera Patch Generator |
| `reel` | Reel |
| `language` | Language |
| `lighting-generator` | Lighting Generator |
| `iprps_email` | IPRPS Email |

The Hub lists any folder in `/srv/www/iprps` with an `index.php` or `index.html` (except `auth`, `hub` and helper folders such as `sql`). Display names come from `hub/app-names.json`, then the app's page title, then the folder name; icons from the app's own `favicon`/`icon`/`logo` file, then the IPRPS icon theme (an icon named after the folder), then the app's initials. A default app that isn't installed is named under **Manage apps**, so a missing or misnamed folder is easy to spot.

**Install it, with IPRPS Writer. [DEBIAN ROOT]** From the repository (`apps/hub/`, `apps/writer/`):

```bash
R=/mnt/g/IPRPS/iprps-os
cp -rv $R/apps/hub $R/apps/writer /mnt/iprps/srv/www/iprps/
```

**[IPRPS CHROOT]**

```bash
for d in hub writer; do
  chown -R root:apache /srv/www/iprps/$d
  find /srv/www/iprps/$d -type d -exec chmod 755 {} + ; find /srv/www/iprps/$d -type f -exec chmod 644 {} +
done
cat > /usr/share/applications/iprps-writer.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=IPRPS Writer
GenericName=Word Processor
Comment=Write documents; save them as Word, OpenDocument or PDF
Exec=iprps-open writer/
Icon=accessories-text-editor
Terminal=false
Categories=X-IPRPS;Office;WordProcessor;
Keywords=write;document;word;docx;odt;
EOF
update-desktop-database /usr/share/applications
ls /srv/www/iprps/hub
for a in $(python3 -c "import json; print(' '.join(json.load(open('/srv/www/iprps/hub/default-apps.json'))['apps']))"); do
  [ -f /srv/www/iprps/$a/index.php ] || [ -f /srv/www/iprps/$a/index.html ] && echo "  ok       $a" || echo "  MISSING  $a"
done
```

`ls` shows `api.php`, `app-names.json`, `default-apps.json`, `display.php`, `hub-icon.svg`, `hub.css`, `hub.js` and `index.html`. The loop checks the default apps: each `MISSING` is a folder that isn't installed or has another name. Correct the name in `default-apps.json` (and `app-names.json`), or install the app. The Hub needs no database setup: it creates its table on first use.

**IPRPS Writer** (`/srv/www/iprps/writer/`) is a simple word processor that runs in the browser like the other IPRPS apps (in its own window in Medium and Advanced): headings, bold, italic, underline, lists, alignment, a word count, and a printed-page look. Documents save automatically to the Session Master's account (table `writer_docs` in the core database, created on first use) and are listed on the left. **Open file…** imports `.docx`, `.odt`, `.txt` and `.html` (or drag a file onto the page); **Save as** writes `.docx` (Word), `.odt` (LibreOffice), `.txt` or `.html` to Downloads, or prints/makes a PDF (**Ctrl+P**). It keeps text, headings, bold/italic/underline/strikethrough, lists and alignment; pictures, tables and fonts in imported files are not kept. It's also on the Hub by default and in the menu (**IPRPS Writer**, also under Office).

`display.php` is the **player display** for Session Master Mode (12.2): full screen on a second screen or projector, showing what's sent to it (from the IPRPS Oracle in Medium and Advanced, and later from the Hub's own tools).

**Test** (fresh test copy): open **Session Master Hub** from the menu, sign in once. The default apps appear as tiles and open in a new window (**IPRPS Table** after 12.7). **Manage apps** lists every app; switch one off and one on, **Save**, and the grid changes; **Reset to defaults** brings back the defaults. A second account keeps its own choice.

> **Pro tip:** To change the defaults for every new Session Master on a computer, edit `/srv/www/iprps/hub/default-apps.json` (folder names, in the order they should appear) with `sudo`. Accounts that already saved their own choice keep it; apps installed later follow the defaults until the account saves again.

### 12.7 IPRPS Table: LAN play on phones, tablets and laptops

Many computers, especially older desktops, have **one display output**, so a second-screen player display isn't possible. The **IPRPS Table** replaces it with the players' own devices: any phone, tablet, laptop or desktop **on the same network** opens a web page on the Session Master's computer and joins the campaign. No app to install and no internet needed: it all runs on the IPRPS OS computer.

| Who | What they get |
|---|---|
| **Session Master** (console, on the IPRPS OS computer only) | Opens and closes the table; join code, links and a QR code; who is at the table (online or away, phone/tablet/computer, address, last seen); **groups** of players; **push** images, video clips and text cards to everyone, a group or selected players, and **play sound** (music, ambience, effects, looping or not) on their devices; messages to everyone, a group, selected players or one player; dice with secret rolls; copy buttons; paste images; remove a player; new join code; lock the table |
| **Players** (any browser) | The campaign's chat; messages **to everyone**, **players only**, **private to the Session Master** or **private to another player**, with images and audio files attached (pasting an image works too); what the Session Master pushes, full width at the top; a **dice toolbar** with the IPRPS rolls; who else is at the table |

**The dice toolbar** (players and Session Master): d4, d6, d8, d10, d12, d20, d100 in one tap; any expression (`2d6+3`, `4d6kh3` keeps the highest three, `1d6!` explodes, `d%`); and **IPRPS ▾**: **Skill check** (1d20 + Skill Shift + Attribute Shift, with the Band A or B result and an optional BTN), **Initiative** (1d20 + DEX modifier), **Reaction**, **Trinity Hand** (1d3 Velocity + 1d20 Impact + 1d12 Guard; more Impact dice for a Hydra Hand), **Dual-Die attack** (vs Guard, then the 1d6 Impact severity), **Infinite Convergence** (Blur 0–6, maximum results explode, skill capped by the Blur level), **RPS stance**, and **weapon damage** (Unarmed to Rifle, with an optional AR). Players choose who sees each roll: everyone, only the Session Master, or only themselves; the Session Master can roll in secret. Every roll is made on the Session Master's computer, so nobody can fake one.

> **Note:** The buttons come from `/opt/iprps/table/dice-presets.json`. To change them (the **Reaction** roll is a placeholder: 1d20 read on the Effectiveness bands), copy it to `/etc/iprps-table/presets.json` (`sudo install -Dm644 /opt/iprps/table/dice-presets.json /etc/iprps-table/presets.json`), edit it, and run `sudo systemctl restart iprps-table`. The console's **Session** box shows which file is in use.

**Privacy.** The Session Master sees messages to everyone and to the Session Master. **Players only** messages and private messages between players stay between the players. Files follow their message: an image sent privately to one player can be opened by that player only. Players can share images and audio up to 15 MB; the Session Master can also share video, up to 1 GB per file.

**Safety.** The Table listens on port **7777** of every network the computer is on, but answers other devices only while the Session Master has the table **open**, and only with the join code. The console (`http://localhost:7777/sm/`) opens on the Session Master's own computer only. It runs as its own account, `iprps-table`, which can write nowhere but `/var/lib/iprps-table`. Closing the table disconnects everyone; chat, players and media are kept for next time (**Session → New session** clears the chat; **Reset everything** also removes players and media and makes a new code). After a restart the table is always closed.

**1. Copy the Table into the image. [DEBIAN ROOT]** From the repository (`apps/table/` is the server, `apps/table-tile/` its Hub tile):

```bash
R=/mnt/g/IPRPS/iprps-os
mkdir -p /mnt/iprps/opt/iprps
cp -rv $R/apps/table /mnt/iprps/opt/iprps/table
cp -rv $R/apps/table-tile /mnt/iprps/srv/www/iprps/table
```

**2. The service, the menu launcher and Hub tile. [IPRPS CHROOT]** Node.js is in every edition (Stage G):

```bash
node --version
getent group iprps-table >/dev/null || groupadd -r iprps-table
getent passwd iprps-table >/dev/null || useradd -r -g iprps-table -d /var/lib/iprps-table -s /sbin/nologin -c "IPRPS Table" iprps-table
chown -R root:root /opt/iprps/table
find /opt/iprps/table -type d -exec chmod 755 {} + ; find /opt/iprps/table -type f -exec chmod 644 {} +
chown -R root:apache /srv/www/iprps/table
find /srv/www/iprps/table -type d -exec chmod 755 {} + ; find /srv/www/iprps/table -type f -exec chmod 644 {} +
install -v -Dm644 /opt/iprps/table/public/table-icon.svg /usr/share/iprps/icons/iprps-table.svg
cat > /usr/lib/systemd/system/iprps-table.service << "EOF"
[Unit]
Description=IPRPS Table (LAN play for the Session Master)
After=network.target

[Service]
User=iprps-table
Group=iprps-table
ExecStart=/usr/bin/node /opt/iprps/table/server.js
StateDirectory=iprps-table
StateDirectoryMode=0750
Restart=on-failure
RestartSec=3
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
LockPersonality=yes
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF
cat > /usr/bin/iprps-table << "EOF"
#!/bin/bash
# iprps-table - open the IPRPS Table Session Master console (LAN play)
URL=http://localhost:7777/sm/
systemctl is-active --quiet iprps-table || pkexec systemctl start iprps-table
for i in $(seq 1 20); do curl -s -o /dev/null -m 1 http://localhost:7777/api/info && break; sleep 0.5; done
if command -v chromium >/dev/null; then
  exec chromium --app="$URL"
else
  exec firefox --new-window "$URL"
fi
EOF
chmod 755 /usr/bin/iprps-table
cat > /usr/share/applications/iprps-table.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=IPRPS Table
GenericName=LAN Play
Comment=Players join from their phones, tablets and laptops: chat, dice, pictures and sound
Exec=iprps-table
Icon=/usr/share/iprps/icons/iprps-table.svg
Terminal=false
Categories=X-IPRPS;Game;
Keywords=lan;party;players;phone;tablet;dice;chat;
EOF
update-desktop-database /usr/share/applications
systemctl enable iprps-table
```

`node --version` prints `v24.19.0`, and `systemctl enable` creates the link in `multi-user.target.wants`. The service starts at every boot (about 50 MB of memory) with the table **closed**.

The Hub's default apps include **IPRPS Table** (`table` in `hub/default-apps.json`); its tile opens the console. **Session Master Mode** (12.2) opens the Table's console instead of a player display window when the computer has **one screen**.

> **Warning:** IPRPS OS has no firewall by default. If you add one, allow **TCP 7777** from the local network, or players can't connect.

**3. Test. [TEST VM]** In a fresh test copy, open **IPRPS Table** from the menu: the console shows **Closed**. Click **Open the table**: a join code, the computer's address (`http://<address>:7777/`) and a QR code appear. A player page needs another device on the same network; in a QEMU test VM, the guest's own address works instead: open a second Firefox window at the address shown (for example `http://10.0.2.15:7777/`), join with the code, and the player appears in the console as **online**. Send a message each way, roll **IPRPS ▾ → Skill check**, then in the console **Add media…** an image and click **Show**: it appears at the top of the player page. On real hardware, scan the QR code with a phone on the same Wi-Fi.

> **Side note:** Phones and tablets block sound until the player touches the page once: when the Session Master starts music, players who haven't touched the page see **Tap to turn on the table sound**. Recording audio in the browser needs a secure (https) connection, which the Table doesn't have on a home network, so players attach audio **files** (a phone's voice-memo app can make one).

> **Pro tip:** Guest Wi-Fi networks often stop devices from seeing each other ("client isolation"). If players can't open the address, put everyone on the main network, or turn on a phone's hotspot and connect the Session Master's computer and the players to it.

> **Pro tip:** The upload limits can be changed without editing the program: `sudo systemctl edit iprps-table`, add `[Service]` and lines such as `Environment=IPRPS_TABLE_PLAYER_MB=25`, `Environment=IPRPS_TABLE_SM_MB=2048` or `Environment=IPRPS_TABLE_MEDIA_GB=20` (all media together), save, then `sudo systemctl restart iprps-table`.

### 12.8 Desktop (non-web) apps

Install desktop apps under `/opt/iprps/<app>/`, with a launcher in `/usr/share/applications/` (`Categories=X-IPRPS;AudioVideo;` for the Media Player). The **IPRPS Media Player** is an Electron app using libVLC: VLC must be installed (Medium), and Electron's own runtime needs GTK 3, NSS and ALSA, which are already in the build.

> **Checkpoint:** All Lite IPRPS apps open from the IPRPS menu, and Session Master Mode opens all three windows. Take snapshot **`iprps-apps-lite`**.

**[DEBIAN ROOT]** — snapshot `iprps-apps-lite`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-iprps-apps-lite.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-iprps-apps-lite.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 13 — Release Engineering

Part 14 uses these steps at every release checkpoint. Set them up once here.

### 13.1 First boot: grow the disk, create swap, new identity

Each installation must get its own disk size, swap, SSH keys and database password. This one-time service does that on first boot. As root:

**[IPRPS CHROOT]**

```bash
install -vdm755 /var/lib/iprps
cat > /usr/sbin/iprps-firstboot << "EOF"
#!/bin/bash
# iprps-firstboot — runs once on the first boot of a new IPRPS installation
set -u
ROOTPART=$(findmnt -no SOURCE /)
DISK=/dev/$(lsblk -no PKNAME "$ROOTPART")
PARTNUM=$(cat /sys/class/block/$(basename "$ROOTPART")/partition)

# 1. Grow the root partition and filesystem to fill the disk
sfdisk --relocate gpt-bak-std "$DISK" || printf 'w\n' | fdisk "$DISK"
echo ", +" | sfdisk --no-reread --force -N "$PARTNUM" "$DISK"
partx -u "$DISK"
resize2fs "$ROOTPART"

# 2. Swap file sized to the computer's RAM (4-8 GiB)
if [ ! -f /swapfile ]; then
  MEM=$(awk '/MemTotal/{printf "%d", $2/1048576 + 0.5}' /proc/meminfo)
  SZ=$(( MEM < 4 ? 4 : (MEM > 8 ? 8 : MEM) ))
  fallocate -l ${SZ}G /swapfile && chmod 600 /swapfile && mkswap /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile  none  swap  defaults  0 0' >> /etc/fstab
  swapon /swapfile
fi

# 3. Unique SSH host keys (the machine ID is generated by systemd)
ssh-keygen -A

touch /var/lib/iprps/firstboot-done
EOF
chmod 755 /usr/sbin/iprps-firstboot
cat > /usr/lib/systemd/system/iprps-firstboot.service << "EOF"
[Unit]
Description=IPRPS first boot: grow disk, create swap, new keys
ConditionPathExists=!/var/lib/iprps/firstboot-done
After=local-fs.target
Before=display-manager.service sshd.service

[Service]
Type=oneshot
ExecStart=/usr/sbin/iprps-firstboot
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl enable iprps-firstboot.service
```

**The database password, unique per installation.** The web apps (12.5) share one database user, `iprps`, for the core `iprps` database and all `iprps_*` app databases; their settings hold the placeholder `@IPRPS_DB_PASS@`. At first boot this script gives `iprps` a new random password, writes it into every app (replacing the placeholder) and into `/etc/iprps/db.php`. The backslashes in its `GRANT … iprps\\_%` line are deliberate: they give MariaDB a literal `` `iprps\_%` ``, meaning every database whose name starts with `iprps_`.

**[IPRPS CHROOT]**

```bash
cat > /usr/sbin/iprps-db-init << "EOF"
#!/bin/bash
# iprps-db-init - first boot: a unique database password for this computer
set -e
PW=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
PH='@IPRPS_DB_PASS@'
# MariaDB's first start can be slow (USB drives, first boot): wait for it, up to 3 minutes
for i in $(seq 180); do mariadb-admin -u root ping >/dev/null 2>&1 && break; sleep 1; done
mariadb-admin -u root ping >/dev/null 2>&1 || { echo "iprps-db-init: MariaDB isn't answering; will retry at next boot" >&2; exit 1; }
mariadb -u root << SQL
CREATE DATABASE IF NOT EXISTS iprps CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'iprps'@'localhost' IDENTIFIED BY '$PW';
ALTER USER 'iprps'@'localhost' IDENTIFIED BY '$PW';
GRANT ALL PRIVILEGES ON iprps.* TO 'iprps'@'localhost';
GRANT ALL PRIVILEGES ON \`iprps\\_%\`.* TO 'iprps'@'localhost';
FLUSH PRIVILEGES;
SQL
mariadb -u root iprps < /usr/share/iprps/schema/iprps-core.sql
# The web apps: replace the placeholder with this computer's password
grep -rlF "$PH" /srv/www/iprps 2>/dev/null | xargs -r sed -i "s/$PH/$PW/g"
install -dm750 -o root -g apache /etc/iprps
cat > /etc/iprps/db.php << PHP
<?php
return ['host' => 'localhost', 'name' => 'iprps', 'user' => 'iprps', 'pass' => '$PW'];
PHP
chown root:apache /etc/iprps/db.php
chmod 640 /etc/iprps/db.php
install -dm755 /var/lib/iprps && touch /var/lib/iprps/db-done
EOF
chmod 755 /usr/sbin/iprps-db-init
bash -n /usr/sbin/iprps-db-init && echo "script OK"
cat > /usr/lib/systemd/system/iprps-db-init.service << "EOF"
[Unit]
Description=IPRPS first boot: create the campaign database
ConditionPathExists=!/var/lib/iprps/db-done
After=mariadb.service
Requires=mariadb.service

[Service]
Type=oneshot
ExecStart=/usr/sbin/iprps-db-init
TimeoutStartSec=300
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl enable iprps-db-init.service
```

### 13.2 First boot: create the user (text-mode setup)

The release images contain **no user accounts**. On first boot, before the login screen appears, a short setup runs in menu screens (`whiptail`, from newt, built in Stage E): a **welcome** describing IPRPS OS, **the editions** (with the one installed), **good to know** (hardware and other limits), then the user name, full name, password (typed twice, at least 8 characters), computer name and a **time zone menu** (common US and Canadian zones first, or any region and city), and a summary to confirm or change. It reads the edition from `VERSION` in `/etc/os-release`, which 13.4 sets.

**[IPRPS CHROOT]**

```bash
command -v whiptail
```

It must print `/usr/bin/whiptail`. Then:

**[IPRPS CHROOT]**

```bash
cat > /usr/sbin/iprps-setup << "EOF"
#!/bin/bash
# iprps-setup - first boot: welcome, edition overview, and the first user account
# Menus use whiptail (from newt). IPRPS_SETUP_DRYRUN=1 shows the screens without changing anything.
export NEWT_COLORS='
root=white,blue
window=white,black
border=yellow,black
title=yellow,black
textbox=white,black
button=black,yellow
actbutton=black,yellow
compactbutton=white,black
listbox=white,black
actlistbox=black,yellow
actsellistbox=black,yellow
entry=white,blue
label=white,black
checkbox=white,black
roottext=yellow,blue
'
DRY=${IPRPS_SETUP_DRYRUN:-}
BT="IPRPS OS - first-time setup"
W=(--backtitle "$BT")
msg() { whiptail "${W[@]}" "$@" >&2; }      # message boxes: always on screen, even inside $( )
H=$(tput lines 2>/dev/null || echo 25); C=$(tput cols 2>/dev/null || echo 80)
TH=$(( H > 30 ? 26 : H - 2 )); TW=$(( C > 90 ? 78 : C - 4 ))

. /etc/os-release 2>/dev/null
ED=${VERSION#* }; [ "$ED" = "$VERSION" ] && ED=""

# ---------------------------------------------------------------- 1. welcome
msg --title " Welcome to IPRPS OS ${VERSION:-} " --ok-button "Continue" --msgbox "\
IPRPS OS is a complete operating system for tabletop role-playing: \
built for Session Masters, Storytellers and players of the Infinite Plane \
Role Playing System (IPRPS) by Mythical Legends Publishing.

It gives you a fast desktop with your campaign tools ready: the \
Session Master Hub, dice and initiative, the session log, a player \
display for a second screen or projector, ambience and music, and the \
IPRPS apps - all running on this computer, with or without internet.

IPRPS OS is free software (GNU GPL v2), built from Linux From Scratch.

This setup takes about a minute: you'll create your account, name \
this computer and choose your time zone." $TH $TW

# ---------------------------------------------------------------- 2. editions, 3. good to know
read -r -d '' EDITIONS << TXT
You are running IPRPS OS ${ED:-(development build)}.

LITE - the essentials. 6 GB RAM minimum, 64 GB storage.
 Session Master Hub, dice, initiative, session log, player display,
 IPRPS Writer, Drawing, Firefox, PDF viewer, music, ambience, Wi-Fi.

MEDIUM - creative and office. 8 GB minimum, 16 GB recommended.
 Lite, plus the IPRPS Oracle (local AI for Session Masters, works
 without internet), Chromium, LibreOffice, GIMP, Inkscape, VLC,
 printing, and more IPRPS apps.

ADVANCED - everything. 16 GB recommended, 128 GB storage.
 Medium, plus scanning, FontForge, Graphviz, disc tools, more
 creative tools, and all IPRPS apps.
TXT
[ "$ED" = "Lite" ] && EDITIONS+=$'\n\nLite has no office suite or local AI: those come with Medium and Advanced.'
msg --title " The IPRPS OS editions " --ok-button "Continue" --msgbox "$EDITIONS" $TH $TW

read -r -d '' LIMITS << TXT
Before you start:

 * Runs on 64-bit Intel and AMD PCs, not on ARM computers or Apple
   Silicon Macs. Secure Boot must be turned off to start it.

 * NVIDIA graphics use the open-source driver: fine for the desktop,
   but without NVIDIA acceleration for games or the local AI.

 * Most Wi-Fi works; a few chips (some Broadcom) aren't supported.

 * New versions arrive as new IPRPS OS releases. There is no app
   store or package manager for adding other software.

 * Apps that use online AI services need internet and your own
   API key. Everything else works offline.
TXT
[ "$ED" = "Lite" ] && LIMITS+=$'\n\n * On 6 GB computers, keep a few programs open at a time.'
msg --title " Good to know " --ok-button "Continue" --msgbox "$LIMITS" $TH $TW

# ---------------------------------------------------------------- 3. account, computer name, time zone
ask_user() {
  local u="${1:-}"
  while :; do
    u=$(whiptail "${W[@]}" --title " Your account " --inputbox \
      "Choose a user name.\n\nLowercase letters, numbers, - and _ only, starting with a letter (for example: alex)." \
      12 64 "$u" 3>&1 1>&2 2>&3) || continue
    if [[ ! "$u" =~ ^[a-z][a-z0-9_-]{0,30}$ ]]; then
      msg --title " User name " --msgbox "\"$u\" can't be used. Use lowercase letters and numbers, starting with a letter." 9 64
    elif id "$u" &>/dev/null; then
      msg --title " User name " --msgbox "\"$u\" is a system name. Please choose another." 8 64
    else
      echo "$u"; return
    fi
  done
}

ask_fullname() {
  whiptail "${W[@]}" --title " Your account " --inputbox \
    "Your full name, as shown on the login screen (optional):" 10 64 "${1:-}" 3>&1 1>&2 2>&3 || true
}

ask_password() {
  local p1 p2
  while :; do
    p1=$(whiptail "${W[@]}" --title " Password " --passwordbox \
      "Choose a password for $1 (at least 8 characters).\nYou'll also use it for administrator (sudo) tasks." 11 64 3>&1 1>&2 2>&3) || continue
    p2=$(whiptail "${W[@]}" --title " Password " --passwordbox "Type the password again:" 9 64 3>&1 1>&2 2>&3) || continue
    if [ ${#p1} -lt 8 ]; then
      msg --title " Password " --msgbox "That password is too short: use at least 8 characters." 8 64
    elif [ "$p1" != "$p2" ]; then
      msg --title " Password " --msgbox "The two passwords don't match. Let's try again." 8 64
    else
      printf '%s' "$p1"; return
    fi
  done
}

ask_hostname() {
  local h="${1:-iprps}"
  while :; do
    h=$(whiptail "${W[@]}" --title " Computer name " --inputbox \
      "A name for this computer on your network:" 10 64 "$h" 3>&1 1>&2 2>&3) || { h=iprps; continue; }
    [[ "$h" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]] && { echo "$h"; return; }
    msg --title " Computer name " --msgbox "Use letters, numbers and dashes only (no spaces)." 8 64
  done
}

ask_timezone() {
  local cur="${1:-America/New_York}" region z args=() Z=/usr/share/zoneinfo
  while :; do
    region=$(whiptail "${W[@]}" --title " Time zone " --default-item "US & Canada" --menu \
      "Where are you?" 20 60 11 \
      "US & Canada" "Common US and Canadian time zones" \
      "America"     "North, Central and South America" \
      "Europe"      "" \
      "Africa"      "" \
      "Asia"        "" \
      "Australia"   "" \
      "Pacific"     "Pacific islands, New Zealand" \
      "Atlantic"    "Atlantic islands" \
      "Indian"      "Indian Ocean" \
      "Antarctica"  "" \
      "UTC"         "Coordinated Universal Time" 3>&1 1>&2 2>&3) || continue
    case "$region" in
      UTC) echo UTC; return ;;
      "US & Canada")
        z=$(whiptail "${W[@]}" --title " Time zone: US & Canada " --notags --default-item "$cur" --menu \
          "Choose your time zone:" 20 60 11 \
          America/New_York    "Eastern (New York, Toronto)" \
          America/Chicago     "Central (Chicago, Winnipeg)" \
          America/Denver      "Mountain (Denver, Edmonton)" \
          America/Phoenix     "Arizona (Phoenix, no daylight saving)" \
          America/Los_Angeles "Pacific (Los Angeles, Vancouver)" \
          America/Anchorage   "Alaska (Anchorage)" \
          Pacific/Honolulu    "Hawaii (Honolulu)" \
          America/Halifax     "Atlantic (Halifax)" \
          America/St_Johns    "Newfoundland (St. John's)" \
          America/Regina      "Saskatchewan (Regina)" \
          America/Puerto_Rico "Puerto Rico" 3>&1 1>&2 2>&3) || continue ;;
      *)
        args=()
        while IFS= read -r f; do
          args+=("$region/$f" "$(echo "$f" | sed 's|_| |g; s|/| / |g')")
        done < <(cd "$Z/$region" 2>/dev/null && find . -type f | sed 's|^\./||' | LC_ALL=C sort)
        [ ${#args[@]} -eq 0 ] && { msg --msgbox "No time zones found for $region." 8 50; continue; }
        z=$(whiptail "${W[@]}" --title " Time zone: $region " --notags --default-item "$cur" --menu \
          "Choose the city nearest you (type its first letter to jump):" 22 64 14 "${args[@]}" 3>&1 1>&2 2>&3) || continue ;;
    esac
    [ -n "$z" ] && { echo "$z"; return; }
  done
}

U=""; FN=""; HN="iprps"; TZ="America/New_York"
while :; do
  U=$(ask_user "$U")
  FN=$(ask_fullname "$FN")
  P=$(ask_password "$U")
  HN=$(ask_hostname "$HN")
  TZ=$(ask_timezone "$TZ")
  whiptail "${W[@]}" --title " Ready " --yes-button "Create account" --no-button "Change something" --yesno "\
User name:      $U
Full name:      ${FN:-(none)}
Computer name:  $HN
Time zone:      $TZ ($(TZ=$TZ date '+%a %H:%M'))

Create this account and start IPRPS OS?" 14 64 && break
done

# ---------------------------------------------------------------- 4. apply
if [ -n "$DRY" ]; then
  msg --msgbox "Dry run: nothing was changed.\n\n$U / $HN / $TZ" 10 50; exit 0
fi
if ! id "$U" &>/dev/null; then
  useradd -m -G users,wheel,audio,video,iprps -s /bin/bash -c "$FN" "$U" || {
    msg --msgbox "The account couldn't be created. Setup will start again." 8 60; exec "$0"; }
fi
until printf '%s:%s\n' "$U" "$P" | chpasswd 2>/tmp/iprps-setup.err; do
  msg --title " Password " --msgbox "That password was refused:\n\n$(tail -2 /tmp/iprps-setup.err)\n\nPlease choose another." 12 64
  P=$(ask_password "$U")
done
rm -f /tmp/iprps-setup.err
echo "$HN" > /etc/hostname
sed -i "/^127\.0\.1\.1/d" /etc/hosts; echo "127.0.1.1 $HN" >> /etc/hosts
ln -sf "/usr/share/zoneinfo/$TZ" /etc/localtime
unset P
touch /var/lib/iprps/setup-done
msg --title " All set " --msgbox "Welcome, ${FN:-$U}!\n\nThe login screen appears next. Sign in as \"$U\".\n\nTip: Session Master Mode is in the IPRPS menu." 12 60
EOF
chmod 755 /usr/sbin/iprps-setup
cat > /usr/lib/systemd/system/iprps-setup.service << "EOF"
[Unit]
Description=IPRPS first boot: create the first user
ConditionPathExists=!/var/lib/iprps/setup-done
After=iprps-firstboot.service systemd-user-sessions.service
Before=display-manager.service getty@tty1.service
Conflicts=getty@tty1.service

[Service]
Type=oneshot
ExecStart=/usr/sbin/iprps-setup
StandardInput=tty
StandardOutput=tty
TTYPath=/dev/tty1
Environment=TERM=linux
TTYReset=yes
TTYVHangup=yes
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl enable iprps-setup.service
```

> **Pro tip:** Preview the screens any time without changing anything: `sudo IPRPS_SETUP_DRYRUN=1 iprps-setup` in a terminal or on a text console.

> **Side note:** The new user is in the `wheel` group, so they have **sudo**. The root account is locked in release images (13.4), which is the same model Ubuntu and many other distros use.

**Administrator prompts use the user's own password.** Graphical programs ask for permission through **polkit** (saving Wi-Fi settings, starting the web services from the IPRPS menu, mounting disks). polkit's default asks for **root's** password, and root is locked in release images, so those prompts could never succeed. This rule makes the members of `wheel` the administrators (they type their own password), and lets the person at the computer manage network connections, such as saving a Wi-Fi network, without any prompt:

**[IPRPS CHROOT]**

```bash
install -vdm700 /etc/polkit-1/rules.d
cat > /etc/polkit-1/rules.d/10-iprps.rules << "EOF"
// IPRPS OS: root is locked; the members of "wheel" (the first user) are the administrators
polkit.addAdminRule(function(action, subject) {
    return ["unix-group:wheel"];
});
// The person at the computer may manage network connections (Wi-Fi) without a password
polkit.addRule(function(action, subject) {
    if (action.id.indexOf("org.freedesktop.NetworkManager.") == 0 &&
        subject.local && subject.active && subject.isInGroup("users")) {
        return polkit.Result.YES;
    }
});
EOF
chmod 644 /etc/polkit-1/rules.d/10-iprps.rules
ls -l /etc/polkit-1/rules.d/
```

The file name starts with `10-` so it's read before other admin rules (such as AccountsService's `40-adm.rules`).

### 13.3 The installer: from USB drive to internal disk

Users can run IPRPS straight from the USB drive, or install it to an internal disk. This script copies the running system to a disk the user picks, then installs GRUB for UEFI and BIOS:

**[IPRPS CHROOT]**

```bash
cat > /usr/sbin/iprps-install << "EOF"
#!/bin/bash
# iprps-install — copy the running IPRPS system to an internal disk
set -euo pipefail
[ $EUID -eq 0 ] || { echo "Please run: sudo iprps-install"; exit 1; }
SRC_ROOT=$(findmnt -no SOURCE /)
SRC_DISK=$(lsblk -no PKNAME "$SRC_ROOT")
echo "Disks on this computer (you are running from: $SRC_DISK):"
lsblk -d -e 7,11 -o NAME,SIZE,MODEL,TRAN | grep -v "^$SRC_DISK "
read -rp "Install IPRPS OS to which disk (e.g. nvme0n1 or sda)? " T
TARGET=/dev/$T
if [ ! -b "$TARGET" ] || [ "$T" = "$SRC_DISK" ]; then echo "That disk can't be used."; exit 1; fi
echo; echo "WARNING: EVERYTHING on $TARGET will be ERASED."
read -rp "Type ERASE to continue: " C; [ "$C" = "ERASE" ] || exit 1

umount "${TARGET}"* 2>/dev/null || true
wipefs --all "$TARGET"
sfdisk "$TARGET" << PARTS
label: gpt
size=512MiB, type=U, name="EFI"
size=1MiB,   type=21686148-6449-6E6F-744E-656564454649, name="BIOS boot"
type=L, name="iprps-root"
PARTS
partx -u "$TARGET"; sleep 2
case "$T" in nvme*|mmcblk*) P="${TARGET}p" ;; *) P="$TARGET" ;; esac
mkfs.vfat -F 32 "${P}1"
mkfs.ext4 -F "${P}3"

NEW=/mnt/iprps-target
mkdir -p "$NEW"
mount "${P}3" "$NEW"
mkdir -p "$NEW/boot/efi"
mount "${P}1" "$NEW/boot/efi"
rsync -aAXH --info=progress2 \
  --exclude={/dev/*,/proc/*,/sys/*,/run/*,/tmp/*,/mnt/*,/media/*,/lost+found,/swapfile,/boot/efi/*} \
  / "$NEW/"

ROOT_UUID=$(blkid -s UUID -o value "${P}3")
EFI_UUID=$(blkid -s UUID -o value "${P}1")
OLD_UUID=$(blkid -s UUID -o value "$SRC_ROOT")
cat > "$NEW/etc/fstab" << FSTAB
UUID=$ROOT_UUID  /          ext4  defaults                                 1 1
UUID=$EFI_UUID   /boot/efi  vfat  codepage=437,iocharset=iso8859-1,nofail  0 2
FSTAB
sed -i "s/$OLD_UUID/$ROOT_UUID/g" "$NEW/boot/grub/grub.cfg"

for d in dev proc sys run; do mount --rbind "/$d" "$NEW/$d"; done
chroot "$NEW" grub-install --target=x86_64-efi --efi-directory=/boot/efi --removable
chroot "$NEW" grub-install --target=i386-pc "$TARGET"

rm -f "$NEW/var/lib/iprps/firstboot-done" "$NEW/etc/ssh/ssh_host_"*
: > "$NEW/etc/machine-id"        # empty: a new ID at first boot, without systemd's preset reset
umount -R "$NEW"
echo; echo "Done. Shut down, remove the USB drive, and start the computer."
EOF
chmod 755 /usr/sbin/iprps-install
cat > /usr/share/applications/iprps-install.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Install IPRPS OS to This Computer
Exec=xfce4-terminal --title "IPRPS Installer" -x sudo /usr/sbin/iprps-install
Icon=drive-harddisk
Categories=X-IPRPS;System;
EOF
```

> **Warning:** Test the installer in a VM with a second empty virtual disk before every release. The installed system keeps the user account created at first boot. Its next boot re-runs `iprps-firstboot`, which creates swap and new SSH keys for the new disk.

### 13.4 Release cleanup (on a copy of the image)

At a release checkpoint, a script **copies** the system image to `/root/release/iprps-os-1.0-<edition>.img` and cleans the copy for release. Your build image is never changed, so you keep building the next edition in it afterwards. You only type the edition once, as a word: `lite`, `medium` or `advanced`.

What it does, in order:

1. **Checks** that the build image is closed (no chroot, not attached, no MariaDB running in Debian, no QEMU using it) and that there's enough free space. It offers to delete old release files for that edition.
2. **Copies** the image and opens the copy's root file system at `/mnt/rel`, with `/dev`, `/proc`, `/sys` and `/run` connected one-way (`--make-rslave`), so closing it can't affect Debian.
3. **Web apps and databases** (inside the copy):
   - puts `@IPRPS_DB_PASS@` back wherever the test password is (from `/root/iprps-dev-db.txt`);
   - starts MariaDB and **empties every table** in the core `iprps` database and every `iprps_*` app database (test campaigns, Oracle chats, test accounts and logins, app records), keeping the tables;
   - gives the `iprps` database user a random password nobody knows, stops MariaDB, and removes `/etc/iprps/db.php`.

   At first boot, `iprps-db-init` (13.1) sets the real password.
4. **App data:** lists files added to the apps' upload, storage and project folders since installation, and asks whether to delete them from the copy (**y**), keep them (**n**) or stop (**q**).
5. **General cleanup:**
   - removes the `builder` account and its sudo rules;
   - removes `/build`, root's files, command histories and temporary files;
   - removes the SSH host keys and first-boot markers (each installation makes its own), plus Ollama's identity key and the logs;
   - empties `/etc/machine-id`, so each computer gets its own ID at first boot. It's left **empty**, not `uninitialized`: `uninitialized` tells systemd "first boot", which resets every service to systemd's default presets (and would switch off IPRPS's own services);
   - removes broken service links (left behind by packages that were rebuilt or removed), listing them;
   - locks root's password;
   - sets the edition name (`IPRPS OS 1.0 Lite`) in `/etc/os-release`. The first-boot setup (13.2) shows that name.

   It then prints a check list.
6. **Trims and closes** the copy (`fstrim`, unmount, detach). If anything fails along the way, it undoes the mounts and says so; run it again and it starts from a fresh copy.

**Install the script once. [DEBIAN ROOT]** Copy it from the repository, or create it with the block below:

```bash
install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-release-clean.sh /root/
```

```bash
cat > /root/iprps-release-clean.sh << "EOF"
#!/bin/bash
# iprps-release-clean.sh <lite|medium|advanced> - guide 13.4
# Copies the build image to /root/release/iprps-os-1.0-<edition>.img and cleans the copy
# for release. The build image itself is never changed. Run as root in Debian (WSL),
# with the build chroot closed (iprps-leave.sh).
set -eu
case "${1:-}" in lite|medium|advanced) ED=$1 ;; *) echo "usage: $0 lite|medium|advanced"; exit 1 ;; esac
EDC=${ED^}
SRC=${IPRPS_IMG:-/root/iprps-system.img}     # IPRPS_IMG=<file> releases another image (a Lite fix copy, Part 15)
REL=/root/release
IMG=$REL/iprps-os-1.0-$ED.img
MNT=/mnt/rel
INSIDE=/run/iprps-release-inside.sh     # in Debian's /run, which the chroot sees: nothing lands in the image
LP=""; OK=0

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }

# Attach partition 3 (the root file system) by its offset: works without udev partition nodes.
p3_loop() {
  local s n
  read -r s n < <(sfdisk -d "$1" | sed -n 's/.*3 : start= *\([0-9]*\), size= *\([0-9]*\).*/\1 \2/p') || true
  [ -n "${s:-}" ] || return 1
  losetup -f --show -o $(( s * 512 )) --sizelimit $(( n * 512 )) "$1"
}

unmount_all() {
  cd /
  for d in run sys proc dev; do
    findmnt "$MNT/$d" >/dev/null 2>&1 && { umount -R "$MNT/$d" 2>/dev/null || umount -Rl "$MNT/$d"; }
  done
  if findmnt "$MNT" >/dev/null 2>&1; then
    umount "$MNT" || { echo "Still in use:"; fuser -vm "$MNT" || true; return 1; }
  fi
  [ -n "$LP" ] && losetup -d "$LP" 2>/dev/null; LP=""
  rm -f "$INSIDE"
}
on_exit() {
  [ "$OK" = 1 ] && return
  echo; echo "Undoing the mounts..."
  if findmnt "$MNT" >/dev/null 2>&1; then
    chroot "$MNT" mariadb-admin -u root shutdown >/dev/null 2>&1 || true; sleep 2
  fi
  unmount_all || true
  printf '\033[1;31mThe release copy is incomplete. Your build image is unchanged.\nFix the problem above, then run this script again (it starts from a fresh copy).\033[0m\n'
}
trap on_exit EXIT

# ---------------------------------------------------------------- checks
say "Checks"
[ "$(id -u)" = 0 ] || die "run this as root in Debian"
[ -f "$SRC" ] || die "$SRC not found"
findmnt /mnt/iprps >/dev/null 2>&1 && die "the build image is open: leave the chroot (exit) and run /root/iprps-leave.sh"
[ -z "$(losetup -j "$SRC")" ] || die "the build image is still attached ($(losetup -j "$SRC" | cut -d: -f1)): run /root/iprps-leave.sh"
findmnt "$MNT" >/dev/null 2>&1 && die "$MNT is in use: unmount it first (see 13.4)"
pgrep -x mariadbd >/dev/null && die "a MariaDB server is running in Debian: stop it first"
pgrep -af qemu-system | grep -q "$(basename "$SRC")" && die "QEMU is using the build image: shut that VM down"
for t in sfdisk losetup fstrim; do command -v $t >/dev/null || die "$t is missing (apt install fdisk util-linux)"; done
mkdir -p "$REL" "$MNT"
ls "$REL"/iprps-os-1.0-"$ED".* >/dev/null 2>&1 && {
  echo "Old $ED release files in $REL:"; ls -lh "$REL"/iprps-os-1.0-"$ED".*
  read -rp "Delete them and start fresh? [y/N] " a; [[ "$a" =~ ^[Yy] ]] || die "kept the old files"
  rm -f "$REL"/iprps-os-1.0-"$ED".* "$REL"/SHA256SUMS-"$ED"
}
NEED=$(du -B1 "$SRC" | cut -f1); AVAIL=$(df -B1 --output=avail "$REL" | tail -1)
[ "$AVAIL" -gt $(( NEED + 2*1024*1024*1024 )) ] || die "not enough space in $REL: need $(( NEED/1073741824 + 2 )) GB, have $(( AVAIL/1073741824 )) GB"
echo "OK: build image closed, $(( AVAIL/1073741824 )) GB free."

# ---------------------------------------------------------------- copy and open
say "1/4 Copying the build image (a few minutes)"
cp --sparse=always "$SRC" "$IMG"
LP=$(p3_loop "$IMG") || die "no partition 3 found in $IMG"
mount "$LP" "$MNT"
[ -x "$MNT/bin/bash" ] || die "partition 3 doesn't look like the IPRPS system"
for d in dev proc sys run; do mount --rbind "/$d" "$MNT/$d"; done
mount --make-rslave "$MNT"
echo "Copy: $IMG (root file system on $LP)"

# ---------------------------------------------------------------- the cleanup inside the copy
cat > "$INSIDE" << 'INSIDE_EOF'
#!/bin/bash
set -eu
EDC=$1; DB_UP=0
say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }
stop_db() {
  [ "$DB_UP" = 1 ] || return 0
  mariadb-admin -u root shutdown >/dev/null 2>&1 || true
  for i in $(seq 30); do pgrep -x mariadbd >/dev/null || break; sleep 1; done
  DB_UP=0
}
trap stop_db EXIT

say "2/4 Web apps and databases"
if [ -f /root/iprps-dev-db.txt ]; then
  DEV=$(awk '{print $2}' /root/iprps-dev-db.txt)
  [ ${#DEV} -ge 8 ] || die "/root/iprps-dev-db.txt doesn't contain the test password"
  grep -rlF "$DEV" /srv/www/iprps 2>/dev/null | xargs -r sed -i "s/$DEV/@IPRPS_DB_PASS@/g"
  LEFT=$(grep -rlF "$DEV" /srv/www/iprps 2>/dev/null | wc -l)
  [ "$LEFT" = 0 ] || die "the test password is still in $LEFT files"
  echo "Placeholder restored: $(grep -rlF '@IPRPS_DB_PASS@' /srv/www/iprps 2>/dev/null | wc -l) app files use @IPRPS_DB_PASS@."
else
  echo "No /root/iprps-dev-db.txt: skipping the placeholder step."
  LEFT=$(grep -rlE "(pass|password)['\"]? *(=>|=) *['\"][A-Za-z0-9]{20,}['\"]" /srv/www/iprps 2>/dev/null | wc -l)
  [ "$LEFT" = 0 ] || echo "Note: $LEFT app files still contain a long password value; check them."
fi

if [ -d /srv/mariadb/mysql ]; then
  install -dm755 -o mariadb -g mariadb /run/mariadb
  mariadbd-safe --user=mariadb >/dev/null 2>&1 &
  DB_UP=1
  for i in $(seq 120); do mariadb-admin -u root ping >/dev/null 2>&1 && break; sleep 1; done
  mariadb-admin -u root ping >/dev/null 2>&1 || die "MariaDB didn't start; see: tail /srv/mariadb/*.err"
  for db in $(mariadb -u root -N -e "SHOW DATABASES WHERE \`Database\` = 'iprps' OR \`Database\` LIKE 'iprps\\_%'"); do
    for t in $(mariadb -u root -N -e "SHOW TABLES" "$db"); do
      mariadb -u root -e "SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE \`$t\`;" "$db"
    done
    echo "  emptied $db"
  done
  if [ "$(mariadb -u root -N -e "SELECT COUNT(*) FROM mysql.user WHERE User='iprps'")" != 0 ]; then
    mariadb -u root -e "ALTER USER 'iprps'@'localhost' IDENTIFIED BY '$(openssl rand -hex 24)';"
    echo "  test password of the 'iprps' database user retired"
  fi
  stop_db
  rm -f /srv/mariadb/*.err /srv/mariadb/*.pid
  echo "MariaDB stopped."
else
  echo "No MariaDB data folder: skipping the databases."
fi
rm -f /etc/iprps/db.php

if [ -f /srv/www/iprps/auth/auth.php ]; then
  mapfile -t F < <(find /srv/www/iprps -type f -newer /srv/www/iprps/auth/auth.php \
      \( -path '*upload*' -o -path '*/storage/*' -o -path '*/projects/*' \) 2>/dev/null)
  if [ ${#F[@]} -gt 0 ]; then
    echo; echo "Files added to app data folders while testing (${#F[@]}):"
    printf '  %s\n' "${F[@]:0:40}"; [ ${#F[@]} -gt 40 ] && echo "  ... and $(( ${#F[@]} - 40 )) more"
    read -rp "Delete these from the release copy? [y = delete / n = keep / q = stop] " a
    case "$a" in
      [Yy]*) rm -f -- "${F[@]}"; echo "Deleted." ;;
      [Qq]*) die "stopped so you can check the app data" ;;
      *) echo "Kept." ;;
    esac
  else
    echo "No test files in the app data folders."
  fi
fi

say "3/4 General cleanup"
id builder >/dev/null 2>&1 && { userdel -r builder 2>/dev/null || userdel builder; rm -rf /home/builder; }
rm -f /etc/sudoers.d/90-builder-build-only /etc/sudoers.d/xorg
rm -rf /build /root/* /root/.bash_history /home/*/.bash_history /tmp/* /var/tmp/*
rm -f /etc/ssh/ssh_host_* /etc/resolv.conf
: > /etc/machine-id      # empty: a fresh ID at first boot, but not "first boot" (no systemd preset reset)
BROKEN=$(find /etc/systemd/system /etc/systemd/user -xtype l 2>/dev/null || true)
if [ -n "$BROKEN" ]; then echo "Removing broken service links:"; echo "$BROKEN" | sed 's/^/  /'; echo "$BROKEN" | xargs -r rm -f; fi
rm -rf /var/lib/iprps/*-done /var/lib/ollama/.ollama /var/log/journal/* /var/lib/iprps-table/*   # IPRPS Table test chat, players, media
passwd -l root >/dev/null
sed -i "s/^VERSION=.*/VERSION=\"1.0 $EDC\"/; s/^PRETTY_NAME=.*/PRETTY_NAME=\"IPRPS OS 1.0 $EDC\"/" /etc/os-release
[ -f /etc/lsb-release ] && sed -i "s/^DISTRIB_DESCRIPTION=.*/DISTRIB_DESCRIPTION=\"IPRPS OS 1.0 $EDC\"/" /etc/lsb-release

echo
echo "Check:"
echo "  builder account:   $(id builder >/dev/null 2>&1 && echo 'STILL THERE' || echo removed)"
echo "  /root:             $( [ -z "$(ls /root)" ] && echo "empty (shell settings kept)" || ls /root | tr '\n' ' ')"
echo "  first-boot marks:  $(ls /var/lib/iprps/ 2>/dev/null | grep -c done) left (0 expected)"
echo "  database settings: $( [ -e /etc/iprps/db.php ] && echo 'STILL THERE' || echo removed)"
echo "  IPRPS Table data:  $( [ -n "$(ls -A /var/lib/iprps-table 2>/dev/null)" ] && echo 'STILL THERE' || echo 'empty')"
echo "  root password:     $(passwd -S root | awk '{print ($2=="L"||$2=="LK")?"locked":"NOT LOCKED"}')"
echo "  machine ID:        $( [ -s /etc/machine-id ] && echo 'NOT EMPTY' || echo 'empty (new ID at first boot)')"
echo "  edition:           $(grep ^PRETTY_NAME /etc/os-release)"
INSIDE_EOF
chmod 755 "$INSIDE"
chroot "$MNT" /bin/bash "$INSIDE" "$EDC"

# ---------------------------------------------------------------- close
say "4/4 Trimming and closing the copy"
fstrim -v "$MNT" || true
unmount_all || die "the copy couldn't be unmounted (see the list above); close what uses it and run: umount $MNT; losetup -d \$(losetup -j $IMG | cut -d: -f1)"
OK=1
printf '\n\033[1;32mDone: %s is cleaned and closed.\033[0m\nNext (13.5): /root/iprps-release-pack.sh %s\n' "$IMG" "$ED"
EOF
chmod 755 /root/iprps-release-clean.sh
```

**Run it.** Take the release snapshot first (Part 14), close the build image (`exit` from the chroot, then `/root/iprps-leave.sh`), and in Debian:

**[DEBIAN ROOT]**

```bash
/root/iprps-release-clean.sh lite
```

It takes a few minutes, mostly the copy. Expect `emptied iprps`, `emptied iprps_auth` and so on, one line per app database, and a check list ending with:

```
  builder account:   removed
  /root:             empty (shell settings kept)
  first-boot marks:  0 left (0 expected)
  database settings: removed
  root password:     locked
  edition:           PRETTY_NAME="IPRPS OS 1.0 Lite"
```

then **Done: … is cleaned and closed.**

| It stops with | Do this |
|---|---|
| "the build image is open" / "still attached" | `exit` the chroot, run `/root/iprps-leave.sh`, run the script again |
| "a MariaDB server is running in Debian" | `pgrep -a mariadbd`; stop it (`kill <number>`), then run again |
| "not enough space" | Free space in `/root` (old release files, `/root/release/*.qcow2` overlays) |
| "MariaDB didn't start" | Open the copy and read `/srv/mariadb/*.err`, or send the error to your build notes; the build image is unaffected |
| "the copy couldn't be unmounted" | It lists what uses `/mnt/rel` (usually another window inside it): close that, then `umount /mnt/rel` and `losetup -d` the device it names |

### 13.5 Shrink, compress and convert

A second script turns the cleaned copy into the downloads. Smaller images write faster and fit smaller USB sticks; first boot grows the system back to fill the drive.

What it does: checks and shrinks the root file system to its minimum, then makes partition 3 that size plus 2 GiB of headroom. It cuts the image file off just after it, and rewrites the partition table at the new size, keeping every disk and partition ID, with the backup GPT at the new end. It checks the shrunk file system again, then makes the three downloads and their checksums. Finally it copies them to `G:\IPRPS\release` and verifies each copy against its checksum.

**Install the script once. [DEBIAN ROOT]**

```bash
install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-release-pack.sh /root/
```

```bash
cat > /root/iprps-release-pack.sh << "EOF"
#!/bin/bash
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
EOF
chmod 755 /root/iprps-release-pack.sh
```

**Run it** right after 13.4:

**[DEBIAN ROOT]**

```bash
apt install -y fdisk e2fsprogs xz-utils qemu-utils
/root/iprps-release-pack.sh lite
```

- **Step 1** prints `e2fsck` passes and `resize2fs`, then the new partition list with three partitions.
- **Step 2** prints **Healthy**.
- **Step 3**, `xz`, is the long one: about 30–90 minutes, with progress shown. If it runs short of memory it retries with fewer threads by itself.
- At the end, each copied file is checked (`…: OK`) and listed.

To write the downloads somewhere else, run `IPRPS_RELEASE_OUT=/mnt/d/somewhere /root/iprps-release-pack.sh lite`.

| Download | For |
|---|---|
| `iprps-os-1.0-<edition>.img.xz` | **USB stick or internal disk.** Write it with Rufus or balenaEtcher (Windows), or `xz -dc ... \| dd of=/dev/sdX bs=4M status=progress` (Linux). Boot it, and optionally run **Install IPRPS OS to This Computer** |
| `iprps-os-1.0-<edition>.vhdx` | Hyper-V (Generation 2, Secure Boot off) |
| `iprps-os-1.0-<edition>.qcow2` | QEMU/KVM, Proxmox, virt-manager |

> **Side note:** The files are produced inside WSL's disk (fast) and then copied to `G:\IPRPS\release\`, where Windows tools such as Rufus, Hyper-V and your upload tools can reach them. Once copied, delete the large intermediate files in `/root/release` to free space. The `.img.xz` is a complete disk (EFI, BIOS boot and root partitions), so one file covers both "full disk image" and "USB stick image". It boots with UEFI and BIOS. A live **ISO** (try-before-install, read-only) is planned for a later release (18.2).

### 13.6 Release test matrix

| Test | Expected |
|---|---|
| Hyper-V VM from `G:\IPRPS\release\iprps-os-1.0-<edition>.vhdx` | Setup screen, then desktop; disk grown; swap active |
| BIOS VM (same image) | Same |
| Real Intel PC from USB | Wi-Fi, sound and graphics work; Session Master Mode works |
| Real AMD PC from USB | Same |
| 6 GB RAM machine or VM (Lite) | Desktop + Firefox + Hub usable; `free -h` shows swap |
| `iprps-install` to a second disk | Installed system boots without the USB drive |
| `systemctl --failed` | Shows nothing |

**Without Hyper-V** (Windows 11 Home, for example), run the VM tests in QEMU on an **overlay**: a small file on top of the release `.qcow2` that leaves it unchanged and acts as a 40 GB disk, so first boot has room to grow. The backing file needs its **full path**:

**[DEBIAN ROOT]**

```bash
ED=lite        # or medium / advanced
qemu-img create -f qcow2 -b /root/release/iprps-os-1.0-$ED.qcow2 -F qcow2 /root/rel-uefi.qcow2 40G
qemu-system-x86_64 -enable-kvm -m 6G -smp 4 -bios /usr/share/ovmf/OVMF.fd \
  -drive file=/root/rel-uefi.qcow2,format=qcow2,if=virtio \
  -nic user,model=virtio-net-pci,hostfwd=tcp::2222-:22 \
  -audio none -vga virtio -display none -vnc 127.0.0.1:0 -monitor stdio
```

For the BIOS test, use a second overlay and leave out the `-bios` line. For the installer test, add an empty disk (`qemu-img create -f qcow2 /root/rel-target.qcow2 64G`, a second `-drive` line), install to `/dev/vdb`, then boot that disk alone. Delete the overlays afterwards (`rm /root/rel-*.qcow2`); keep the release `.qcow2` while they exist.

> **Warning:** **Testing on a real Windows PC from USB.** Write the `.img.xz` to a USB stick with Rufus (DD mode) or balenaEtcher, turn Secure Boot off and pick the stick in the boot menu. **Before** changing Secure Boot, run `manage-bde -status C:` in an administrator PowerShell: if BitLocker is on, save the recovery key (`manage-bde -protectors -get C:`), because Windows asks for it after the change. Don't run the installer on a PC whose Windows you want to keep; turn Secure Boot back on afterwards.

### 13.7 Source code and licenses

Every release must come with the matching source code for its GPL and LGPL software. Publish, next to each image:

- every tarball and patch in `/build/sources/` and `~/src/` (the LFS and BLFS sources used),
- this guide, plus your build notes and IPRPS scripts,
- the IPRPS apps' source (in your Git repository).

Keep license texts in the image (`/usr/share/licenses/`, `/usr/share/doc/`). The IPRPS release overrides (FFmpeg, Mesa, Firefox) exist for redistribution reasons; keep them. Patent rules for video codecs such as H.264/H.265 (x264, x265) differ by country. **This is general information, not legal advice.**

---

### 13.8 Publishing: GitHub and a download site

**GitHub Releases** suit the source code, checksums and small files, but **each file in a release must be under 2 GiB**. Compressed IPRPS images will likely be larger, especially Medium and Advanced. Two options:

**Option A (recommended): images on the download site, everything else on GitHub.** From `G:\IPRPS\release\`, upload the `.img.xz`, `.vhdx` and `.qcow2` files to your download site (for example under `infiniteplane.space/downloads/iprps/1.0/`). The GitHub release holds the release notes, `SHA256SUMS-*`, the source archive (13.7) and links to the images.

**Option B: split the images for GitHub.**

**[DEBIAN ROOT]**

```bash
cd /mnt/g/IPRPS/release
ED=lite        # or medium / advanced
split -b 1900M -d -a 2 iprps-os-1.0-$ED.img.xz iprps-os-1.0-$ED.img.xz.part
ls -lh iprps-os-1.0-$ED.img.xz.part*
```

Users join the parts before writing them. On Linux: `cat iprps-os-1.0-<edition>.img.xz.part* > iprps-os-1.0-<edition>.img.xz`. On Windows (Command Prompt): `copy /b iprps-os-1.0-<edition>.img.xz.part00 + iprps-os-1.0-<edition>.img.xz.part01 iprps-os-1.0-<edition>.img.xz` (list every part, in order). Then they check the result against `SHA256SUMS` before writing it.

> **Pro tip:** Publish checksums in **both** places, and state the SHA256 in the release notes. Users can then verify a download from either site.

**Release notes checklist:** edition contents (Part 1 table), minimum requirements (64-bit Intel/AMD, 6 GB RAM, 64 GB storage; 128 GB for Advanced), **Secure Boot must be off**, how to write the image, first-boot setup, how to install to disk, known issues, and the link to the source archive.

---

## Part 14 — Release Checkpoint: Lite

> **Checkpoint:** Take snapshot **`RELEASE-lite`** (0.4).

**[DEBIAN ROOT]** — snapshot `RELEASE-lite`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-RELEASE-lite.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-RELEASE-lite.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

1. Clean a copy with 13.4: `/root/iprps-release-clean.sh lite`.
2. Shrink, compress and convert it with 13.5: `/root/iprps-release-pack.sh lite`.
3. Run the test matrix in 13.6, including a 6 GB RAM test (Hyper-V lets you set exactly 6 GB).
4. Publish with 13.8.

Then continue building in `/root/iprps-system.img`.

---

## Part 15 — Stage H: Medium Edition Apps

### Before Stage H: room in the image, memory, and Lite fixes

**1. Snapshot.** Take snapshot **`stage-H-start`** (0.4), after `RELEASE-lite`. Every Stage H problem can go back to it.

**2. Free space.** Medium adds LibreOffice, GIMP, Inkscape, VLC, Chromium and the Oracle's AI model, and LibreOffice alone needs about 15 GB while it builds. Check the image:

**[IPRPS CHROOT]**

```bash
df -h /
du -sh /build/src
```

If **Avail** is under **30 GB**, make the image bigger before starting (the release scripts shrink it again, so this doesn't change the download size). Leave the chroot windows (`exit`) and stop any test VM first:

**[DEBIAN ROOT]**

```bash
bash /root/iprps-leave.sh
df -h /                                            # Debian needs room for the extra 40 GB
truncate -s +40G /root/iprps-system.img
sfdisk --relocate gpt-bak-std /root/iprps-system.img
echo ", +" | sfdisk -N 3 /root/iprps-system.img
LP=$(losetup -fP --show /root/iprps-system.img) && e2fsck -f ${LP}p3 && resize2fs ${LP}p3; losetup -d $LP
ls -l /root/iprps-system.img                       # now 85899345920 bytes
```

`sfdisk --relocate` moves the partition table's backup copy to the new end of the image, and `resize2fs` grows the file system into the new space. Then enter again (`bash /root/iprps-enter.sh`) and `df -h /` shows the extra space. From now on, a complete snapshot (0.4) or test copy has the **new size** (85899345920 bytes), not 42949672960.

> **Side note:** Deleting finished build folders also frees space: once a package is installed, its extracted folder in `/build/src` (not the tarball) can go, for example `rm -rf /build/src/libreoffice-26.2.5` after LibreOffice's `make install`. Keep folders the guide says to keep (such as glycin's).

**3. Memory.** LibreOffice, GIMP and Inkscape are large C++ builds. With 32 GB in the PC, give WSL 20 GB and swap (`.wslconfig`, Appendix C) and build them with `make -j4` (or `ninja -j4`) if WSL becomes unresponsive.

**4. Lite fixes during Stage H.** The editions share one image, so a fix made now (to an IPRPS app or script, say) lands in Medium and Advanced automatically. To **re-release Lite** with it, make the same fix in a copy of the `RELEASE-lite` snapshot. `iprps-enter.sh`, `iprps-leave.sh` and `iprps-release-clean.sh` work on another image when `IPRPS_IMG` names it. Only one image can be entered at a time, so leave the main one first:

**[DEBIAN ROOT]**

```bash
bash /root/iprps-leave.sh
cp -v --sparse=always /root/snapshots/iprps-RELEASE-lite.img /root/iprps-lite-fix.img
IPRPS_IMG=/root/iprps-lite-fix.img bash /root/iprps-enter.sh
#   ... make the fix inside, then exit ...
IPRPS_IMG=/root/iprps-lite-fix.img bash /root/iprps-leave.sh
IPRPS_IMG=/root/iprps-lite-fix.img /root/iprps-release-clean.sh lite
/root/iprps-release-pack.sh lite
cp -v --sparse=always /root/iprps-lite-fix.img /root/snapshots/iprps-RELEASE-lite.img    # the fixed Lite is the new Lite base
bash /root/iprps-enter.sh                                                               # back to the Medium build
```

The repository's CHANGELOG records each fix, so the Lite copy and the main image stay in step.

The Medium edition's apps: **LibreOffice**, **GIMP**, **Inkscape**, **VLC**, **FFmpeg**, **ImageMagick**, **CUPS** printing with Gutenprint and Ghostscript, **Xfburn**, and hardware video decoding for Intel (libva, intel-media-driver).

> **Warning:** LibreOffice is the largest build in the Medium stage. As with Firefox, give it time and memory.

**68 packages, in build order:** CLucene-2.3.3.4, libgusb-0.4.9, Colord-1.4.8, Cups-2.4.19, GLM-1.0.3, libatomic_ops-7.10.0, Archive::Zip-1.68, LibreOffice-26.2.5, docbook-xsl-ns-1.79.2, libfyaml-0.9.6, libxmlb-0.3.29, AppStream-1.1.6, babl-0.1.128, gegl-0.4.70, inih-62, Exiv2-0.28.8, gexiv2-0.16.2, ghostscript-10.07.1, libmypaint-1.6.1, mypaint-brushes-2.0.2, Gimp-3.2.4, Double-conversion-3.4.0, GC-8.2.12, gsl-2.8, libsigc++-2.12.1, GLibmm-2.66.10, Atkmm-2.28.5, libcairomm-1.0 (cairomm-1.14.6), Pangomm-2.46.5, Gtkmm-3.24.11, Potrace-1.16, Inkscape-1.4.4, Liba52-0.8.0, libmad-0.15.1b, VLC-3.0.23, ImageMagick-7.1.2-13, Freeglut-3.8.0, MuPDF-1.26.12, pdfio-1.6.4, Qpdf-12.4.0, libcupsfilters-2.1.1, libppd-2.1.1, cups-filters-2.0.1, Gutenprint-5.3.5, libburn-1.5.8, libisofs-1.5.8.pl02, Xfburn-0.8.0, gmmlib-22.10.0, intel-media-driver-26.2.4, Msgpack-1.2.1, Charset-normalizer-3.4.7, Idna-3.18, Hatch_vcs-0.5.0, Urllib3-2.7.0, Requests-2.34.2, semantic_version-2.10.0, setuptools_rust-1.12.1, maturin-1.14.1, uv_build-0.11.24, cachecontrol-0.14.4, CSSSelect-1.5.0, Pyproject-Metadata-0.12.1, Meson_python-0.20.0, NumPy-2.5.2, Patchelf-0.19.1, pySerial-3.5, six-1.17.0, Scour-0.38.2.

### CLucene-2.3.3.4

*BLFS 13.1 · ID `clucene` · Stage H* · *Build time:* 0.8 SBU · *Disk space:* 78 MB

**Requires:** `cmake`  
**Recommended (included):** `boost`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/clucene/clucene-core-2.3.3.4.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/clucene-2.3.3.4-contribs_lib-1.patch
```

MD5 sum of `clucene-core-2.3.3.4.tar.gz`: `48d647fbd8ef8889e5a7f422c1bfda94` (check with `md5sum clucene-core-2.3.3.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf clucene-core-2.3.3.4.tar.gz
cd "$(tar -tf clucene-core-2.3.3.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install CLucene by running the following commands:

```bash
patch -Np1 -i ../clucene-2.3.3.4-contribs_lib-1.patch &&

sed -i '/Misc.h/a #include <ctime>' src/core/CLucene/document/DateTools.cpp &&

mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr        \
      -D CMAKE_POLICY_VERSION_MINIMUM=3.5 \
      -D BUILD_CONTRIBS_LIB=ON            \
      -W no-author ..                     &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf clucene-core-2.3.3.4.tar.gz | head -1 | cut -d/ -f1)"
```


### libgusb-0.4.9

*BLFS 13.1 · ID `libgusb` · Stage H* · *Build time:* 0.1 SBU (with tests and docs) · *Disk space:* 5.0 MB (with tests and docs)

**Requires:** `json-glib`, `libusb`  
**Recommended (included):** `glib2`, `hwdata`, `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/hughsie/libgusb/releases/download/0.4.9/libgusb-0.4.9.tar.xz
```

MD5 sum of `libgusb-0.4.9.tar.xz`: `354a3227334991ea4e924843c144bd82` (check with `md5sum libgusb-0.4.9.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libgusb-0.4.9.tar.xz
cd "$(tar -tf libgusb-0.4.9.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libgusb by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D docs=false       &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Gi-DocGen-2026.1 installed and wish to build the API documentation for this package, issue:

```bash
sed -E "/output|install_dir/s/('libgusb)'/\1-0.4.9'/" \
    -i ../docs/meson.build                            &&
meson configure -D docs=true                          &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the results, run:

```bash
sed -e 's/pkg_resources/packaging.version/'  \
    -e 's/parse_version/parse/g'             \
    -i ../contrib/generate-version-script.py &&
ninja test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libgusb-0.4.9.tar.xz | head -1 | cut -d/ -f1)"
```


### Colord-1.4.8

*BLFS 13.1 · ID `colord` · Stage H* · *Build time:* 0.3 SBU (with tests) · *Disk space:* 22 MB (with tests)

**Requires:** `glib2`, `lcms2`, `libgudev`, `libgusb`, `polkit`  
**Recommended (included):** `vala`  
**Needed at runtime:** `systemd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.freedesktop.org/software/colord/releases/colord-1.4.8.tar.xz
```

MD5 sum of `colord-1.4.8.tar.xz`: `4d17dea7fe5460c2ea16aee64dca2ecb` (check with `md5sum colord-1.4.8.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf colord-1.4.8.tar.xz
cd "$(tar -tf colord-1.4.8.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — There should be a dedicated user and group to take control of the colord daemon after it has started. Issue the following commands as the root user:

```bash
groupadd -g 71 colord &&
useradd -c "Color Daemon Owner" -d /var/lib/colord -u 71 \
        -g colord -s /bin/false colord
```

**[BUILDER]** — Install Colord by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup ..                  \
      --prefix=/usr             \
      --buildtype=release       \
      -D daemon_user=colord     \
      -D vapi=true              \
      -D systemd=true           \
      -D libcolordcompat=true   \
      -D argyllcms_sensor=false \
      -D bash_completion=false  \
      -D docs=false             \
      -D man=false              &&
ninja
```

**[BUILDER]** — If docbook-xml-5.0, docbook-xsl-ns-1.79.2, and libxslt-1.1.45 are installed, build the man pages:

```bash
meson configure -D man=true &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf colord-1.4.8.tar.xz | head -1 | cut -d/ -f1)"
```


### Cups-2.4.19

*BLFS 13.1 · ID `cups` · Stage H* · *Build time:* 0.4 SBU (Add 1.4 SBU for tests) · *Disk space:* 134 MB (with tests)

**Requires:** `gnutls`  
**Recommended (included):** `colord`, `libusb`, `linux-pam`, `xdg-utils`  
**Needed at runtime:** `cups-filters`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/OpenPrinting/cups/releases/download/v2.4.19/cups-2.4.19-source.tar.gz
```

MD5 sum of `cups-2.4.19-source.tar.gz`: `06b7a3921812988cdb3198ff74ae381d` (check with `md5sum cups-2.4.19-source.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cups-2.4.19-source.tar.gz
cd "$(tar -tf cups-2.4.19-source.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — You will need to add an lp user, as Cups will create some files owned by this user. (The lp user is the default used by Cups, but may be changed to a different user by passing a parameter to the configure script.) Use the following command as the root user:

```bash
useradd -c "Print Service User" -d /var/spool/cups -g lp -s /bin/false -u 9 lp
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — You will also need a dedicated group that will contain users allowed to do Cups administrative tasks. Add the group by running the following command as the root user:

```bash
groupadd -g 19 lpadmin
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you want to add a user to the Cups administrative group, run the following command as the root user:

```bash
usermod -a -G lpadmin <username>
```

**[BUILDER]** — *(Optional — skip if unsure)* If you didn't install xdg-utils-1.2.1, use the following sed to change the default browser that will be used to access the Cups web interface:

```bash
sed -i 's#@CUPS_HTMLVIEW@#firefox#' desktop/cups.desktop.in
```

**[BUILDER]** — https://github.com/OpenPrinting/cups/commit/dc4407f5187c4d2a530e6595c27c22ca7efeae01 This doesn't occur on glibc-2.42 for me, but does on 2.43. The issue causes a segfault when printing. Fix a runtime issue caused by corruption of a previous pointer when…

```bash
sed -i '/& ipp->prev)/s/prev/& \&\& ipp->prev->next == *attr/' cups/ipp.c
```

**[BUILDER]** — Build Cups by running the following commands:

```bash
./configure --libdir=/usr/lib            \
            --with-rundir=/run/cups      \
            --with-system-groups=lpadmin \
            --with-docdir=/usr/share/cups/doc-2.4.19 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
ln -svnf ../cups/doc-2.4.19 /usr/share/doc/cups-2.4.19
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Create a basic Cups client configuration file by running the following command as the root user:

```bash
echo "ServerName /run/cups/cups.sock" > /etc/cups/client.conf
```

> **Side note (BLFS):** This package installs icon files into the /usr/share/icons/hicolor hierarchy and you can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme. To perform the update you must have GTK-3.24.52 installed and issue the following command as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* This package installs icon files into the /usr/share/icons/hicolor hierarchy and you can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme. To perform the update you must have GTK-3.24.52 installed and issue the…

```bash
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Issue the following command as the root user to create the configuration file for Linux PAM:

```bash
cat > /etc/pam.d/cups << "EOF"
# Begin /etc/pam.d/cups

auth    include system-auth
account include system-account
session include system-session

# End /etc/pam.d/cups
EOF
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To start the cupsd daemon when something tries to access it, enable the previously installed systemd units by running the following command as the root user:

```bash
systemctl enable cups
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cups-2.4.19-source.tar.gz | head -1 | cut -d/ -f1)"
```


### GLM-1.0.3

*BLFS 13.1 · ID `glm` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 25 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/g-truc/glm/archive/1.0.3/glm-1.0.3.tar.gz
```

MD5 sum of `glm-1.0.3.tar.gz`: `2192069d8d0091ff1cca041cdcdc85fe` (check with `md5sum glm-1.0.3.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glm-1.0.3.tar.gz
cd "$(tar -tf glm-1.0.3.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package is unusual as it includes its functionality in header files. We just copy them into position.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user:

```bash
cp -r glm /usr/include/ &&
cp -r doc /usr/share/doc/glm-1.0.3
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glm-1.0.3.tar.gz | head -1 | cut -d/ -f1)"
```


### libatomic_ops-7.10.0

*BLFS 13.1 · ID `libatomic_ops` · Stage H* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 6.2 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/bdwgc/libatomic_ops/releases/download/v7.10.0/libatomic_ops-7.10.0.tar.gz
```

MD5 sum of `libatomic_ops-7.10.0.tar.gz`: `1de9631daa0781a8c5a8457053d57cf0` (check with `md5sum libatomic_ops-7.10.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libatomic_ops-7.10.0.tar.gz
cd "$(tar -tf libatomic_ops-7.10.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libatomic_ops by running the following commands:

```bash
./configure --prefix=/usr    \
            --enable-shared  \
            --disable-static \
            --docdir=/usr/share/doc/libatomic_ops-7.10.0 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libatomic_ops-7.10.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Archive::Zip-1.68

*BLFS 13.1 · ID `perl-archive-zip` · Stage H*

**Requires:** `libarchive`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.cpan.org/authors/id/P/PH/PHRED/Archive-Zip-1.68.tar.gz
```

MD5 sum of `Archive-Zip-1.68.tar.gz`: `a33993309322164867c99e04a4000ee3` (check with `md5sum Archive-Zip-1.68.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf Archive-Zip-1.68.tar.gz
cd "$(tar -tf Archive-Zip-1.68.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — This module uses the standard build and installation instructions: perl Makefile.PL && make && make test Now, as the root user: make install

```bash
perl Makefile.PL &&
make             &&
make test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)*

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf Archive-Zip-1.68.tar.gz | head -1 | cut -d/ -f1)"
```


### LibreOffice-26.2.5

*BLFS 13.1 · ID `libreoffice` · Stage H* · *Build time:* 25 SBU with parallelism=8 (will vary due to download time) · *Disk space:* 7.8 GB including the additional files if downloaded during the build (751 MB installed). Installing the whole set of languages requires more than 25 GB (around 3 GB installed)

**Requires:** `perl-archive-zip`, `libarchive`, `wget`, `which`, `zip`  
**Recommended (included):** `boost`, `clucene`, `cups`, `curl`, `glm`, `glu`, `graphite2`, `gst10-plugins-base`, `gtk3`, `harfbuzz`, `icu`, `libatomic_ops`, `libepoxy`, `libjpeg`, `librsvg`, `tiff`, `libwebp`, `libxml2`, `libxslt`, `lcms2`, `llvm`, `lxml`, `mesa`, `nss`, `openldap`, `poppler`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.documentfoundation.org/libreoffice/src/26.2.5/libreoffice-26.2.5.2.tar.xz
wget https://download.documentfoundation.org/libreoffice/src/26.2.5/libreoffice-dictionaries-26.2.5.2.tar.xz
wget https://download.documentfoundation.org/libreoffice/src/26.2.5/libreoffice-help-26.2.5.2.tar.xz
wget https://download.documentfoundation.org/libreoffice/src/26.2.5/libreoffice-translations-26.2.5.2.tar.xz
```

MD5 sum of `libreoffice-26.2.5.2.tar.xz`: `cde5452693205386a34cbf3ce561956b` (check with `md5sum libreoffice-26.2.5.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libreoffice-26.2.5.2.tar.xz
cd "$(tar -tf libreoffice-26.2.5.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a bug with linking to zlib, fix a bug which would cause an install failure, and prevent compression of man pages:

```bash
sed -i '/icuuc \\/a zlib\\'           writerperfect/Library_wpftdraw.mk &&
sed -i "/distro-install-file-lists/d" Makefile.in                       &&
sed -e "/gzip -f/d"   \
    -e "s|.1.gz|.1|g" \
    -i bin/distro-install-desktop-integration
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have downloaded the dictionaries, help and translations tarballs, create symlinks to them from the source directory so they won't get downloaded again:

```bash
install -dm755 external/tarballs &&
ln -sv ../../../libreoffice-dictionaries-26.2.5.2.tar.xz external/tarballs/ &&
ln -sv ../../../libreoffice-help-26.2.5.2.tar.xz         external/tarballs/ &&
ln -sv ../../../libreoffice-translations-26.2.5.2.tar.xz external/tarballs/
```

**[BUILDER]** — The instructions in the package unpack some tarballs into a location it cannot find later. Create some symlinks to help the build system out:

```bash
ln -sv src/libreoffice-help-26.2.5.2/helpcontent2/ &&
ln -sv src/libreoffice-dictionaries-26.2.5.2/dictionaries/ &&
ln -sv src/libreoffice-translations-26.2.5.2/translations/
```

> **Side note (BLFS):** During the build process, some packages will be downloaded (including the ones listed as recommended and optional dependencies) if they are not present on the system. Because of this, build time may vary from the published time more than usual.

**[BUILDER]** — Due to the large size of the package, you may prefer to install it in /opt, instead of /usr. Depending on your choice, replace <PREFIX> by /usr or by /opt/libreoffice-26.2.5.2:

```bash
export LO_PREFIX=<PREFIX>
```

> **Side note (BLFS):** If you set the ACLOCAL environment variable to support installing Xorg in /opt, you will need to unset it for this package.

**[BUILDER]** — *(Optional — skip if unsure)* If you are building on a 32 bit machine, CFLAGS is set to -Os, which breaks the build. Prevent this by issuing:

```bash
case $(uname -m) in
   i?86) sed /-Os/d -i solenv/gbuild/platform/LINUX_INTEL_GCC.mk ;;
esac
```

**[BUILDER]** — Prepare LibreOffice for compilation by running the following commands:

```bash
./autogen.sh --prefix=$LO_PREFIX         \
             --sysconfdir=/etc           \
             --with-vendor=BLFS          \
             --with-lang='fr en-GB'      \
             --with-help=html            \
             --with-myspell-dicts        \
             --without-junit             \
             --without-system-dicts      \
             --disable-dconf             \
             --disable-odk               \
             --disable-mariadb-sdbc      \
             --enable-release-build=yes  \
             --enable-python=system      \
             --with-jdk-home=/opt/jdk    \
             --with-system-boost         \
             --with-system-clucene       \
             --with-system-curl          \
             --with-system-epoxy         \
             --with-system-expat         \
             --with-system-glm           \
             --with-system-gpgmepp       \
             --with-system-graphite      \
             --with-system-harfbuzz      \
             --with-system-icu           \
             --with-system-jpeg          \
             --with-system-lcms2         \
             --with-system-libatomic_ops \
             --with-system-libtiff       \
             --with-system-libpng        \
             --with-system-libxml        \
             --with-system-libwebp       \
             --with-system-nss           \
             --with-system-odbc          \
             --with-system-openldap      \
             --with-system-openssl       \
             --with-system-poppler       \
             --with-system-postgresql    \
             --with-system-redland       \
             --with-system-zlib          \
             --with-system-zstd
```

**[BUILDER]** — Build the package:

```bash
make build
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make distro-pack-install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If installed in /opt/libreoffice-26.2.5.2 some additional steps are necessary. Issue the following commands as the root user:

```bash
if [ "$LO_PREFIX" != "/usr" ]; then

  # This symlink is necessary for the desktop menu entries
  ln -svf $LO_PREFIX/lib/libreoffice/program/soffice /usr/bin/libreoffice &&

  # Set up a generic location independent of version number
  ln -sfv $LO_PREFIX /opt/libreoffice &&

  # Icons
  mkdir -vp /usr/share/pixmaps &&
  for i in $LO_PREFIX/share/icons/hicolor/32x32/apps/*; do
    ln -svf $i /usr/share/pixmaps
  done &&

  # Desktop menu entries
  for i in $LO_PREFIX/lib/libreoffice/share/xdg/*; do
    ln -svf $i /usr/share/applications/libreoffice-$(basename $i)
  done &&

  # Man pages
  for i in $LO_PREFIX/share/man/man1/*; do
    ln -svf $i /usr/share/man/man1/
  done &&

  unset i
fi
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have installed desktop-file-utils-0.28, and you wish to update the MIME database, issue, as the root user:

```bash
update-desktop-database
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libreoffice-26.2.5.2.tar.xz | head -1 | cut -d/ -f1)"
```


### docbook-xsl-ns-1.79.2

*BLFS 13.1 · ID `docbook-xsl-ns` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 49 MB

**Needed at runtime:** `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/docbook/xslt10-stylesheets/releases/download/release/1.79.2/docbook-xsl-1.79.2.tar.bz2
wget https://www.linuxfromscratch.org/patches/blfs/13.1/docbook-xsl-1.79.2-stack_fix-1.patch
```

MD5 sum of `docbook-xsl-1.79.2.tar.bz2`: `4a400f0264a19329c7f95f69e098744a` (check with `md5sum docbook-xsl-1.79.2.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf docbook-xsl-1.79.2.tar.bz2
cd "$(tar -tf docbook-xsl-1.79.2.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a problem that causes stack overflows when doing recursion:

```bash
patch -Np1 -i ../docbook-xsl-1.79.2-stack_fix-1.patch
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Install DocBook XSL Stylesheets by running the following commands as the root user:

```bash
install -v -m755 -d /usr/share/xml/docbook/xsl-stylesheets-1.79.2 &&

cp -v -R VERSION assembly common eclipse epub epub3 extensions fo        \
         highlighting html htmlhelp images javahelp lib manpages params  \
         profiling roundtrip slides template tests tools webhelp website \
         xhtml xhtml-1_1 xhtml5                                          \
    /usr/share/xml/docbook/xsl-stylesheets-1.79.2 &&

ln -s VERSION /usr/share/xml/docbook/xsl-stylesheets-1.79.2/VERSION.xsl
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Create (or append) and populate the XML catalog file using the following commands as the root user (both http and https forms are used because upstream have had both in their documentation):

```bash
(set -e

 install -v -d -m755 /etc/xml
 [ -e /etc/xml/catalog ] || xmlcatalog --noout --create /etc/xml/catalog

 for uri in http{,s}://cdn.docbook.org/release/xsl/{1.79.2,current} \
            http://docbook.sourceforge.net/release/xsl-ns/current; do
   for rewrite in System URI; do
     xmlcatalog --noout --add "rewrite$rewrite"        \
       "$uri"                                          \
       "/usr/share/xml/docbook/xsl-stylesheets-1.79.2" \
       /etc/xml/catalog
   done
 done)
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf docbook-xsl-1.79.2.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libfyaml-0.9.6

*BLFS 13.1 · ID `libfyaml` · Stage H* · *Build time:* 0.4 SBU (add 1.8 SBU for tests) · *Disk space:* 280 MB (with tests)

**Recommended (included):** `libyaml`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/pantoniou/libfyaml/releases/download/v0.9.6/libfyaml-0.9.6.tar.gz
```

MD5 sum of `libfyaml-0.9.6.tar.gz`: `f6d3756a80cb1ff99714e510cf4ce13d` (check with `md5sum libfyaml-0.9.6.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libfyaml-0.9.6.tar.gz
cd "$(tar -tf libfyaml-0.9.6.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libfyaml by running the following commands:

```bash
./configure --prefix=/usr --disable-static --without-libclang &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libfyaml-0.9.6.tar.gz | head -1 | cut -d/ -f1)"
```


### libxmlb-0.3.29

*BLFS 13.1 · ID `libxmlb` · Stage H* · *Build time:* 0.1 SBU (With tests) · *Disk space:* 5.6 MB (with tests)

**Requires:** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/hughsie/libxmlb/releases/download/0.3.29/libxmlb-0.3.29.tar.xz
```

MD5 sum of `libxmlb-0.3.29.tar.xz`: `83f87e2ce1fd6b34b25e7f5e1443293c` (check with `md5sum libxmlb-0.3.29.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libxmlb-0.3.29.tar.xz
cd "$(tar -tf libxmlb-0.3.29.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libxmlb by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release -D gtkdoc=false .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libxmlb-0.3.29.tar.xz | head -1 | cut -d/ -f1)"
```


### AppStream-1.1.6

*BLFS 13.1 · ID `appstream` · Stage H* · *Build time:* 0.2 SBU (add 0.3 SBU for tests) · *Disk space:* 42 MB

**Requires:** `curl`, `itstool`, `libfyaml`, `libxml2`, `libxmlb`, `libxslt`, `wayland`  
**Recommended (included):** `docbook-xsl-ns`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.freedesktop.org/software/appstream/releases/AppStream-1.1.6.tar.xz
```

MD5 sum of `AppStream-1.1.6.tar.xz`: `cc07d222289ec963be208c3757bde6a9` (check with `md5sum AppStream-1.1.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf AppStream-1.1.6.tar.xz
cd "$(tar -tf AppStream-1.1.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install AppStream by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr            \
            --buildtype=release      \
            -D apidocs=false         \
            -D bash-completion=false \
            -D stemming=false   .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&
mv -v /usr/share/doc/appstream{,-1.1.6}
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — AppStream expects an operating system metainfo file describing the GNU/Linux distribution. As the root user, create the file describing LFS:

```bash
install -vdm755 /usr/share/metainfo &&
cat > /usr/share/metainfo/org.linuxfromscratch.lfs.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<component type="operating-system">
  <id>org.linuxfromscratch.lfs</id>
  <name>Linux From Scratch</name>
  <summary>A customized Linux system built entirely from source</summary>
  <description>
    <p>
      Linux From Scratch (LFS) is a project that provides you with
      step-by-step instructions for building your own customized Linux
      system entirely from source.
    </p>
  </description>
  <url type="homepage">https://www.linuxfromscratch.org/lfs/</url>
  <metadata_license>MIT</metadata_license>
  <developer id='linuxfromscratch.org'>
    <name>The Linux From Scratch Editors</name>
  </developer>

  <releases>
    <release version="13.0" type="stable" date="2026-03-05">
      <description>
        <p>Now contains Binutils 2.46.0, GCC-15.2.0, Glibc-2.43,
        Linux kernel 6.18, and six security updates.</p>
      </description>
    </release>

    <release version="12.4" type="stable" date="2025-09-01">
      <description>
        <p>Now contains Binutils 2.45, GCC-15.2.0, Glibc-2.42,
        Linux kernel 6.16, and twelve security updates.</p>
      </description>
    </release>

    <release version="12.3" type="stable" date="2025-03-05">
      <description>
        <p>Now contains Binutils 2.44, GCC-14.2.0, Glibc-2.41, and
        Linux Kernel 6.13, and three security updates.</p>
      </description>
    </release>
  </releases>
</component>
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf AppStream-1.1.6.tar.xz | head -1 | cut -d/ -f1)"
```


### babl-0.1.128

*BLFS 13.1 · ID `babl` · Stage H* · *Build time:* 0.1 SBU (Using parallelism=4; with tests) · *Disk space:* 21 MB (with tests)

**Recommended (included):** `glib2`, `librsvg`, `lcms2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gimp.org/pub/babl/0.1/babl-0.1.128.tar.xz
```

MD5 sum of `babl-0.1.128.tar.xz`: `47bc0674961d219710a96e03d9e839ad` (check with `md5sum babl-0.1.128.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf babl-0.1.128.tar.xz
cd "$(tar -tf babl-0.1.128.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Babl by running the following commands:

```bash
mkdir bld &&
cd    bld &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install &&

install -v -m755 -d                            /usr/share/gtk-doc/html/babl/graphics &&
install -v -m644 ../docs/*.{css,html}          /usr/share/gtk-doc/html/babl          &&
install -v -m644 ../docs/graphics/*.{html,svg} /usr/share/gtk-doc/html/babl/graphics
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf babl-0.1.128.tar.xz | head -1 | cut -d/ -f1)"
```


### gegl-0.4.70

*BLFS 13.1 · ID `gegl` · Stage H* · *Build time:* 0.9 SBU (with tests, both with parallelism=4) · *Disk space:* 159 MB (With tests)

**Requires:** `babl`, `json-glib`  
**Recommended (included):** `glib2`, `graphviz`, `pygments`, `pygobject3`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gimp.org/pub/gegl/0.4/gegl-0.4.70.tar.xz
```

MD5 sum of `gegl-0.4.70.tar.xz`: `2442d5f0cb97bcc1b50d2082e29c9375` (check with `md5sum gegl-0.4.70.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gegl-0.4.70.tar.xz
cd "$(tar -tf gegl-0.4.70.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you are installing over a previous version of gegl, one of the modules will need to be removed. As the root user, run the following command to remove it:

```bash
rm -f /usr/lib/gegl-0.4/vector-fill.so
```

**[BUILDER]** — Install gegl by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gegl-0.4.70.tar.xz | head -1 | cut -d/ -f1)"
```


### inih-62

*BLFS 13.1 · ID `inih` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 2 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/benhoyt/inih/archive/r62/inih-r62.tar.gz
```

MD5 sum of `inih-r62.tar.gz`: `c0c6982525958a0376a3cb5bfbee14a0` (check with `md5sum inih-r62.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf inih-r62.tar.gz
cd "$(tar -tf inih-r62.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install inih by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf inih-r62.tar.gz | head -1 | cut -d/ -f1)"
```


### Exiv2-0.28.8

*BLFS 13.1 · ID `exiv2` · Stage H* · *Build time:* 0.4 SBU (Using parallelism=4, with tests) · *Disk space:* 134 MB (with tests)

**Requires:** `cmake`  
**Recommended (included):** `brotli`, `curl`, `inih`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/Exiv2/exiv2/archive/v0.28.8/exiv2-0.28.8.tar.gz
```

MD5 sum of `exiv2-0.28.8.tar.gz`: `3f3b2d9c3e73880ea8e6bd78c67ea56a` (check with `md5sum exiv2-0.28.8.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf exiv2-0.28.8.tar.gz
cd "$(tar -tf exiv2-0.28.8.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Exiv2 by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr   \
      -D CMAKE_BUILD_TYPE=Release    \
      -D EXIV2_ENABLE_VIDEO=yes      \
      -D EXIV2_ENABLE_WEBREADY=yes   \
      -D EXIV2_ENABLE_CURL=yes       \
      -D EXIV2_BUILD_SAMPLES=no      \
      -D CMAKE_SKIP_INSTALL_RPATH=ON \
      -G Ninja ..                    &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf exiv2-0.28.8.tar.gz | head -1 | cut -d/ -f1)"
```


### gexiv2-0.16.2

*BLFS 13.1 · ID `gexiv2` · Stage H* · *Build time:* less than 0.1 SBU (with tests; both with parallelism=4) · *Disk space:* 6.7 MB (with tests)

**Requires:** `exiv2`  
**Recommended (included):** `vala`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gexiv2/0.16/gexiv2-0.16.2.tar.xz
```

MD5 sum of `gexiv2-0.16.2.tar.xz`: `ed530cddf2f30e1903e983e5542262f9` (check with `md5sum gexiv2-0.16.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gexiv2-0.16.2.tar.xz
cd "$(tar -tf gexiv2-0.16.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install gexiv2 by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the results, run:

```bash
meson configure -D tests=true &&
ninja test
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gexiv2-0.16.2.tar.xz | head -1 | cut -d/ -f1)"
```


### ghostscript-10.07.1

*BLFS 13.1 · ID `gs` · Stage H* · *Build time:* 1.9 SBU (Using parallelism=4; with libgs.so) · *Disk space:* 1.1 GB (with fonts and libgs.so)

**Recommended (included):** `cups`, `fontconfig`, `freetype2`, `lcms2`, `libjpeg`, `libpng`, `tiff`, `openjpeg2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10071/ghostscript-10.07.1.tar.xz
wget https://downloads.sourceforge.net/gs-fonts/ghostscript-fonts-std-8.11.tar.gz
wget https://downloads.sourceforge.net/gs-fonts/gnu-gs-fonts-other-6.0.tar.gz
```

MD5 sum of `ghostscript-10.07.1.tar.xz`: `9e987b203c535d3c7829e1daefb85e98` (check with `md5sum ghostscript-10.07.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf ghostscript-10.07.1.tar.xz
cd "$(tar -tf ghostscript-10.07.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** The Ghostscript build system is not user-friendly. In order to use system copies of various graphics libraries, you must do it using unconventional methods.

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed the recommended dependencies on your system, remove the copies of freetype, lcms2, libjpeg, libpng, and openjpeg:

```bash
rm -rf freetype lcms2mt jpeg libpng openjpeg
```

**[BUILDER]** — Compile Ghostscript:

```bash
rm -rf zlib &&

./configure --prefix=/usr           \
            --disable-compile-inits \
            --with-system-libtiff   \
            CFLAGS="${CFLAGS:--g -O3} -fPIC" &&
make
```

> **Side note (BLFS):** The shared library depends on GTK-3.24.52. It is only used by external programs like asymptote-3.14, dvisvgm-3.6.1, and ImageMagick-7.1.2-13.

**[BUILDER]** — To compile the shared library libgs.so, run the following additional command as an unprivileged user:

```bash
make so
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the shared library, install it with:

```bash
make soinstall                                     &&
install -v -m644 base/*.h /usr/include/ghostscript &&
ln -sfvn ghostscript /usr/include/ps
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now make the documentation accessible from a standard place:

```bash
mv -v /usr/share/doc/ghostscript/10.07.1 /usr/share/doc/ghostscript-10.07.1 &&
rmdir /usr/share/doc/ghostscript                                            &&
cp -r examples/ -T /usr/share/ghostscript/10.07.1/examples
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have downloaded the fonts, unpack them to /usr/share/ghostscript and ensure the ownership of the files are root: root.

```bash
tar -xvf ../ghostscript-fonts-std-8.11.tar.gz -C /usr/share/ghostscript --no-same-owner &&
tar -xvf ../gnu-gs-fonts-other-6.0.tar.gz     -C /usr/share/ghostscript --no-same-owner &&
fc-cache -v /usr/share/ghostscript/fonts/
```

**[BUILDER]** — You can now test the rendering of various postscript and pdf files from the /usr/share/ghostscript/10.07.1/examples . To do this, run the following command (in a X11 session):

```bash
gs -q -dBATCH /usr/share/ghostscript/10.07.1/examples/tiger.eps
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf ghostscript-10.07.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libmypaint-1.6.1

*BLFS 13.1 · ID `libmypaint` · Stage H* · *Build time:* 0.1 SBU (add 0.3 SBU for tests) · *Disk space:* 11 MB (add 1 MB for tests)

**Requires:** `intltool`, `json-c`  
**Recommended (included):** `glib2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/mypaint/libmypaint/releases/download/v1.6.1/libmypaint-1.6.1.tar.xz
```

MD5 sum of `libmypaint-1.6.1.tar.xz`: `7f1dab2d30ce8a3f494354c7c77a2977` (check with `md5sum libmypaint-1.6.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libmypaint-1.6.1.tar.xz
cd "$(tar -tf libmypaint-1.6.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libmypaint by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libmypaint-1.6.1.tar.xz | head -1 | cut -d/ -f1)"
```


### mypaint-brushes-2.0.2

*BLFS 13.1 · ID `mypaint-brushes` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 4.1 MB

**Needed at runtime:** `libmypaint`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/mypaint/mypaint-brushes/releases/download/v2.0.2/mypaint-brushes-2.0.2.tar.xz
```

MD5 sum of `mypaint-brushes-2.0.2.tar.xz`: `ce965cd5d75947b7beca5ed3ee4521d2` (check with `md5sum mypaint-brushes-2.0.2.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mypaint-brushes-2.0.2.tar.xz
cd "$(tar -tf mypaint-brushes-2.0.2.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install mypaint-brushes by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mypaint-brushes-2.0.2.tar.xz | head -1 | cut -d/ -f1)"
```


### Gimp-3.2.4

*BLFS 13.1 · ID `gimp` · Stage H* · *Build time:* 1.4 SBU (Using parallelism=4) · *Disk space:* 639 MB (173 MB installed)

**Requires:** `appstream`, `gegl`, `gexiv2`, `glib-networking`, `gtk3`, `harfbuzz`, `libmypaint`, `librsvg`, `tiff`, `libxml2`, `lcms2`, `mypaint-brushes`, `poppler`  
**Recommended (included):** `graphviz`, `gs`, `iso-codes`, `libgudev`, `pygobject3`, `xdg-utils`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gimp.org/gimp/v3.2/gimp-3.2.4.tar.xz
wget https://download.gimp.org/pub/gimp/help/gimp-help-3.0.2.tar.bz2
```

MD5 sum of `gimp-3.2.4.tar.xz`: `4a5a233cf24e599bbf73084a3583e29f` (check with `md5sum gimp-3.2.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gimp-3.2.4.tar.xz
cd "$(tar -tf gimp-3.2.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — If upgrading from a previous Gimp-3 installation, as the root user, remove some files and directories from the old installation or the build system may mistakenly pick them up, causing a build failure:

```bash
rm -rf /usr/{lib,share}/gimp/3.0 &&
rm -f  /usr/share/gir-1.0/Gimp-3.0.gir &&
rm -f  /usr/lib/girepository-1.0/Gimp-3.0.typelib &&
rm -f  /usr/lib/libgimp*-3.0.so*
```

**[BUILDER]** — Upstream provides a patch for building against gexiv2-0.16.0 and later. Use it as follows:

```bash
patch -Np1 -i build/macos/patches/0001-build-macos-Do-not-require-gexiv2-0.14-on-homebrew.patch
```

**[BUILDER]** — Install Gimp by running the following commands:

```bash
mkdir gimp-build &&
cd    gimp-build &&

meson setup ..            \
      --prefix=/usr       \
      --buildtype=release \
      -D headless-tests=disabled &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

> **Side note (BLFS):** This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and /usr/share/applications/mimeinfo.cache. To perform the update you must have GTK-3.24.52 installed (for the icon cache) and desktop-file-utils-0.28 (for the desktop cache) and issue the following commands as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and…

```bash
gtk-update-icon-cache -qtf /usr/share/icons/hicolor &&
update-desktop-database -q
```

**Build and install:**

**[BUILDER]** — The gimp-help tarball contains images and English text help for help files, together with translations. If you wish to install local copies of the help files to read offline, unpack the gimp-help tarball and change into the root of the newly created source…

```bash
tar -xf ../../gimp-help-3.0.2.tar.bz2 &&
cd gimp-help-3.0.2

sed -i 's/import libxml2//' configure &&

ALL_LINGUAS="en" \
./configure --prefix=/usr
```

**[BUILDER]** — Now build the help files:

```bash
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Issue the following commands as the root user to install the help files:

```bash
make install &&
chown -R root:root /usr/share/gimp/3.0/help
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gimp-3.2.4.tar.xz | head -1 | cut -d/ -f1)"
```


### Double-conversion-3.4.0

*BLFS 13.1 · ID `double-conversion` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 62 MB (with tests)

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/google/double-conversion/archive/v3.4.0/double-conversion-3.4.0.tar.gz
```

MD5 sum of `double-conversion-3.4.0.tar.gz`: `cb2e555c32614f680ba928e962dda9be` (check with `md5sum double-conversion-3.4.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf double-conversion-3.4.0.tar.gz
cd "$(tar -tf double-conversion-3.4.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Double-conversion by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr        \
      -D CMAKE_POLICY_VERSION_MINIMUM=3.5 \
      -D BUILD_SHARED_LIBS=ON             \
      -D BUILD_TESTING=ON                 \
      ..                                  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf double-conversion-3.4.0.tar.gz | head -1 | cut -d/ -f1)"
```


### GC-8.2.12

*BLFS 13.1 · ID `gc` · Stage H* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 9.4 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/bdwgc/bdwgc/releases/download/v8.2.12/gc-8.2.12.tar.gz
```

MD5 sum of `gc-8.2.12.tar.gz`: `5e7c74f8bd57f64d3f86673ff3c17230` (check with `md5sum gc-8.2.12.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gc-8.2.12.tar.gz
cd "$(tar -tf gc-8.2.12.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GC by running the following commands:

```bash
./configure --prefix=/usr      \
            --enable-cplusplus \
            --disable-static   \
            --docdir=/usr/share/doc/gc-8.2.12 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m644 doc/gc.man /usr/share/man/man3/gc_malloc.3
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gc-8.2.12.tar.gz | head -1 | cut -d/ -f1)"
```


### gsl-2.8

*BLFS 13.1 · ID `gsl` · Stage H* · *Build time:* 1.0 SBU (Using parallelism=4; with tests, without docs) · *Disk space:* 223 MB (with tests, without docs)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://ftp.gnu.org/gnu/gsl/gsl-2.8.tar.gz
```

MD5 sum of `gsl-2.8.tar.gz`: `182ec03204f164e67238c9116591a37d` (check with `md5sum gsl-2.8.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gsl-2.8.tar.gz
cd "$(tar -tf gsl-2.8.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Gsl by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have Sphinx_rtd_theme-3.1.0 installed, build the documentation with:

```bash
make html
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you built the documentation, install it (as root) with:

```bash
mkdir                   /usr/share/doc/gsl-2.8 &&
cp -R doc/_build/html/* /usr/share/doc/gsl-2.8
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gsl-2.8.tar.gz | head -1 | cut -d/ -f1)"
```


### libsigc++-2.12.1

*BLFS 13.1 · ID `libsigc` · Stage H* · *Build time:* 0.2 SBU (with tests) · *Disk space:* 27 MB (with tests)

**Recommended (included):** `boost`, `libxslt`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/libsigc++/2.12/libsigc++-2.12.1.tar.xz
```

MD5 sum of `libsigc++-2.12.1.tar.xz`: `891f1b2dbaebd8007eda8c639bbe1149` (check with `md5sum libsigc++-2.12.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libsigc++-2.12.1.tar.xz
cd "$(tar -tf libsigc++-2.12.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix detecting Boost when configuring this package:

```bash
sed -i "s/'system',//" meson.build
```

**[BUILDER]** — Install libsigc++ by running the following commands:

```bash
mkdir bld &&
cd    bld &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libsigc++-2.12.1.tar.xz | head -1 | cut -d/ -f1)"
```


### GLibmm-2.66.10

*BLFS 13.1 · ID `glibmm` · Stage H* · *Build time:* 0.4 SBU (Using parallelism=4; with tests) · *Disk space:* 91 MB (with tests)

**Requires:** `glib2`, `libsigc`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/glibmm/2.66/glibmm-2.66.10.tar.xz
```

MD5 sum of `glibmm-2.66.10.tar.xz`: `04fab47987ee9df63f808959577d153b` (check with `md5sum glibmm-2.66.10.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf glibmm-2.66.10.tar.xz
cd "$(tar -tf glibmm-2.66.10.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install GLibmm by running the following commands:

```bash
mkdir bld &&
cd    bld &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf glibmm-2.66.10.tar.xz | head -1 | cut -d/ -f1)"
```


### Atkmm-2.28.5

*BLFS 13.1 · ID `atkmm` · Stage H* · *Build time:* 0.2 SBU · *Disk space:* 11 MB

**Requires:** `at-spi2-core`, `glibmm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/atkmm/2.28/atkmm-2.28.5.tar.xz
```

MD5 sum of `atkmm-2.28.5.tar.xz`: `c9bdc196eed368c274177b0c1caf140c` (check with `md5sum atkmm-2.28.5.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf atkmm-2.28.5.tar.xz
cd "$(tar -tf atkmm-2.28.5.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Atkmm by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf atkmm-2.28.5.tar.xz | head -1 | cut -d/ -f1)"
```


### libcairomm-1.0 (cairomm-1.14.6)

*BLFS 13.1 · ID `cairomm-1.0` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 12 MB (with tests)

**Requires:** `cairo`, `libsigc`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.cairographics.org/releases/cairomm-1.14.6.tar.xz
```

MD5 sum of `cairomm-1.14.6.tar.xz`: `634242bb797fb6e9d7cfae1a83474d11` (check with `md5sum cairomm-1.14.6.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cairomm-1.14.6.tar.xz
cd "$(tar -tf cairomm-1.14.6.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Cairomm-1.0 by running the following commands:

```bash
mkdir bld &&
cd    bld &&

meson setup ..             \
      --prefix=/usr        \
      --buildtype=release  \
      -D build-tests=true  \
      -D boost-shared=true &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cairomm-1.14.6.tar.xz | head -1 | cut -d/ -f1)"
```


### Pangomm-2.46.5

*BLFS 13.1 · ID `pangomm` · Stage H* · *Build time:* 0.2 SBU · *Disk space:* 12 MB

**Requires:** `cairomm-1.0`, `glibmm`, `pango`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/pangomm/2.46/pangomm-2.46.5.tar.xz
```

MD5 sum of `pangomm-2.46.5.tar.xz`: `4fc19301ccc94e4fb72f1ed54bc65d4d` (check with `md5sum pangomm-2.46.5.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pangomm-2.46.5.tar.xz
cd "$(tar -tf pangomm-2.46.5.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Pangomm by running the following commands:

```bash
mkdir build &&
cd    build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pangomm-2.46.5.tar.xz | head -1 | cut -d/ -f1)"
```


### Gtkmm-3.24.11

*BLFS 13.1 · ID `gtkmm3` · Stage H* · *Build time:* 0.6 SBU (Using parallelism=4; with tests) · *Disk space:* 188 MB (with tests)

**Requires:** `atkmm`, `gtk3`, `pangomm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.gnome.org/sources/gtkmm/3.24/gtkmm-3.24.11.tar.xz
```

MD5 sum of `gtkmm-3.24.11.tar.xz`: `554154811621e1e411285dde09ca8913` (check with `md5sum gtkmm-3.24.11.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gtkmm-3.24.11.tar.xz
cd "$(tar -tf gtkmm-3.24.11.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Gtkmm by running the following commands:

```bash
mkdir gtkmm3-build &&
cd    gtkmm3-build &&

meson setup --prefix=/usr --buildtype=release .. &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have built the documentation (see Command Explanations below) it was installed to /usr/share/doc/gtkmm-3.0. For consistency, move it to a versioned directory as the root user:

```bash
mv -v /usr/share/doc/gtkmm-3.0 /usr/share/doc/gtkmm-3.24.11
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gtkmm-3.24.11.tar.xz | head -1 | cut -d/ -f1)"
```


### Potrace-1.16

*BLFS 13.1 · ID `potrace` · Stage H* · *Build time:* less than 0.1 SBU (including tests) · *Disk space:* 7.1 MB (including tests)

**Recommended (included):** `llvm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/potrace/potrace-1.16.tar.gz
```

MD5 sum of `potrace-1.16.tar.gz`: `5f0bd87ddd9a620b0c4e65652ef93d69` (check with `md5sum potrace-1.16.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf potrace-1.16.tar.gz
cd "$(tar -tf potrace-1.16.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Potrace by running the following commands:

```bash
./configure --prefix=/usr                        \
            --disable-static                     \
            --docdir=/usr/share/doc/potrace-1.16 \
            --enable-a4                          \
            --enable-metric                      \
            --with-libpotrace                    &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf potrace-1.16.tar.gz | head -1 | cut -d/ -f1)"
```


### Inkscape-1.4.4

*BLFS 13.1 · ID `inkscape` · Stage H* · *Build time:* 2.2 SBU (with parallelism=8) · *Disk space:* 1.1 GB (216 MB installed)

**Requires:** `boost`, `double-conversion`, `gc`, `gsl`, `gtkmm3`, `libxslt`, `poppler`, `popt`  
**Recommended (included):** `lcms2`, `libcanberra`, `potrace`  
**Needed at runtime:** `imagemagick`, `cachecontrol`, `cssselect`, `lxml`, `numpy`, `pyserial`, `scour`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://inkscape.org/gallery/item/59505/inkscape-1.4.4.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/inkscape-1.4.4-poppler_fixes-3.patch
```

MD5 sum of `inkscape-1.4.4.tar.xz`: `60ed50c2de060307ad1a6555c7653458` (check with `md5sum inkscape-1.4.4.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf inkscape-1.4.4.tar.xz
cd "$(tar -tf inkscape-1.4.4.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix build failures starting with poppler-26.05 and later:

```bash
patch -Np1 -i ../inkscape-1.4.4-poppler_fixes-3.patch
```

**[BUILDER]** — Install Inkscape by running the following commands:

```bash
mkdir build                        &&
cd    build                        &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D WITH_INTERNAL_2GEOM=ON    \
      -W no-author                 \
      ..                           &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

> **Side note (BLFS):** This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and /usr/share/applications/mimeinfo.cache. To perform the update you must have GTK-3.24.52 installed (for the icon cache) and desktop-file-utils-0.28 (for the desktop cache) and issue the following commands as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and…

```bash
gtk-update-icon-cache -qtf /usr/share/icons/hicolor &&
update-desktop-database -q
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf inkscape-1.4.4.tar.xz | head -1 | cut -d/ -f1)"
```


### Liba52-0.8.0

*BLFS 13.1 · ID `liba52` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 3.7 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://distfiles.adelielinux.org/source/a52dec/a52dec-0.8.0.tar.gz
```

MD5 sum of `a52dec-0.8.0.tar.gz`: `4debeed0257f5312e84d92711a5cfcec` (check with `md5sum a52dec-0.8.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf a52dec-0.8.0.tar.gz
cd "$(tar -tf a52dec-0.8.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install liba52 by running the following commands:

```bash
./configure --prefix=/usr           \
            --mandir=/usr/share/man \
            --enable-shared         \
            --disable-static        \
            CFLAGS="${CFLAGS:--g -O3} -fPIC" &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
cp liba52/a52_internal.h /usr/include/a52dec &&
install -v -m644 -D doc/liba52.txt \
    /usr/share/doc/liba52-0.8.0/liba52.txt
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf a52dec-0.8.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libmad-0.15.1b

*BLFS 13.1 · ID `libmad` · Stage H* · *Build time:* 0.1 SBU · *Disk space:* 4.2 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/mad/libmad-0.15.1b.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/libmad-0.15.1b-fixes-1.patch
```

MD5 sum of `libmad-0.15.1b.tar.gz`: `1be543bc30c56fb6bea1d7bf6a64e66c` (check with `md5sum libmad-0.15.1b.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libmad-0.15.1b.tar.gz
cd "$(tar -tf libmad-0.15.1b.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libmad by running the following commands:

```bash
patch -Np1 -i ../libmad-0.15.1b-fixes-1.patch                &&
sed "s@AM_CONFIG_HEADER@AC_CONFIG_HEADERS@g" -i configure.ac &&
touch NEWS AUTHORS ChangeLog                                 &&
autoreconf -fi                                               &&

./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — As the root user:

```bash
cat > /usr/lib/pkgconfig/mad.pc << "EOF"
prefix=/usr
exec_prefix=${prefix}
libdir=${exec_prefix}/lib
includedir=${prefix}/include

Name: mad
Description: MPEG audio decoder
Requires:
Version: 0.15.1b
Libs: -L${libdir} -lmad
Cflags: -I${includedir}
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libmad-0.15.1b.tar.gz | head -1 | cut -d/ -f1)"
```


### VLC-3.0.23

*BLFS 13.1 · ID `vlc` · Stage H* · *Build time:* 1.2 SBU (using parallelism=4; with tests) · *Disk space:* 957 MB

**Recommended (included):** `alsa-lib`, `desktop-file-utils`, `ffmpeg`, `liba52`, `libgcrypt`, `libmad`, `lua`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://download.videolan.org/vlc/3.0.23/vlc-3.0.23.tar.xz
```

MD5 sum of `vlc-3.0.23.tar.xz`: `ebc3f0d0a94785fd2b2df4087516938e` (check with `md5sum vlc-3.0.23.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf vlc-3.0.23.tar.xz
cd "$(tar -tf vlc-3.0.23.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a build failure introduced by the latest version of gst-plugins-base:

```bash
sed -i 's/gstvideopool.h/video.h/' modules/codec/gstreamer/gstvlcvideopool.h
```

**[BUILDER]** — Install VLC by running the following commands:

```bash
BUILDCC=gcc ./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make docdir=/usr/share/doc/vlc-3.0.23 install
```

> **Side note (BLFS):** This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and /usr/share/applications/mimeinfo.cache. To perform the update you must have GTK-3.24.52 installed (for the icon cache) and desktop-file-utils-0.28 (for the desktop cache) and issue the following commands as the root user:

**[BUILDER]** — *(Optional — skip if unsure)* This package installs icon files into the /usr/share/icons/hicolor hierarchy and desktop files into the /usr/share/applications hierarchy. You can improve system performance and memory usage by updating /usr/share/icons/hicolor/index.theme and…

```bash
gtk-update-icon-cache -qtf /usr/share/icons/hicolor &&
update-desktop-database -q
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf vlc-3.0.23.tar.xz | head -1 | cut -d/ -f1)"
```


### ImageMagick-7.1.2-13

*BLFS 13.1 · ID `imagemagick` · Stage H* · *Build time:* 1.6 SBU (with typical dependencies; add 0.5 SBU for checks, both using parallelism=4) · *Disk space:* 179 MB, 45 MB installed (with typical dependencies; add 26 MB for checks)

**Recommended (included):** `xorg7-lib`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.imagemagick.org/archive/releases/ImageMagick-7.1.2-13.tar.xz
```

MD5 sum of `ImageMagick-7.1.2-13.tar.xz`: `a28a5d65a58fce9c24e8cf4b47cb5c5c` (check with `md5sum ImageMagick-7.1.2-13.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf ImageMagick-7.1.2-13.tar.xz
cd "$(tar -tf ImageMagick-7.1.2-13.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install ImageMagick by running the following commands:

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --enable-hdri     \
            --with-modules    \
            --with-perl       \
            --disable-static  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make DOCUMENTATION_PATH=/usr/share/doc/imagemagick-7.1.2 install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf ImageMagick-7.1.2-13.tar.xz | head -1 | cut -d/ -f1)"
```


### Freeglut-3.8.0

*BLFS 13.1 · ID `freeglut` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 6.5 MB

**Requires:** `cmake`, `mesa`  
**Recommended (included):** `glu`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/freeglut/freeglut-3.8.0.tar.gz
```

MD5 sum of `freeglut-3.8.0.tar.gz`: `ca8361b5b6a64b07795b41bd24f6a23e` (check with `md5sum freeglut-3.8.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf freeglut-3.8.0.tar.gz
cd "$(tar -tf freeglut-3.8.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Freeglut by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr        \
      -D CMAKE_BUILD_TYPE=Release         \
      -D FREEGLUT_BUILD_DEMOS=OFF         \
      -D FREEGLUT_BUILD_STATIC_LIBS=OFF   \
      -W no-author .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf freeglut-3.8.0.tar.gz | head -1 | cut -d/ -f1)"
```


### MuPDF-1.26.12

*BLFS 13.1 · ID `mupdf` · Stage H* · *Build time:* 0.2 SBU (Using parallelism=4) · *Disk space:* 295 MB

**Requires:** `xorg7-lib`  
**Recommended (included):** `brotli`, `freeglut`, `harfbuzz`, `libjpeg`, `openjpeg2`, `curl`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://www.mupdf.com/downloads/archive/mupdf-1.26.12-source.tar.gz
```

MD5 sum of `mupdf-1.26.12-source.tar.gz`: `d10eb7e1ef0f4a44f5c14a29b9d6f906` (check with `md5sum mupdf-1.26.12-source.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf mupdf-1.26.12-source.tar.gz
cd "$(tar -tf mupdf-1.26.12-source.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install MuPDF by running the following commands:

```bash
cat > user.make << EOF &&
USE_SYSTEM_BROTLI := yes
USE_SYSTEM_FREETYPE := yes
USE_SYSTEM_HARFBUZZ := yes
USE_SYSTEM_JBIG2DEC := no
USE_SYSTEM_JPEGXR := no # not used without HAVE_JPEGXR
USE_SYSTEM_LCMS2 := no # lcms2mt is strongly preferred
USE_SYSTEM_LIBJPEG := yes
USE_SYSTEM_MUJS := no # build needs source anyway
USE_SYSTEM_OPENJPEG := yes
USE_SYSTEM_ZLIB := yes
USE_SYSTEM_GLUT := yes
USE_SYSTEM_CURL := yes
USE_SYSTEM_GUMBO := no
EOF

export XCFLAGS=-fPIC                      &&
make build=release shared=yes verbose=yes &&
unset XCFLAGS
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make prefix=/usr                         \
     shared=yes                          \
     docdir=/usr/share/doc/mupdf-1.26.12 \
     install                             &&

ln -sfv libmupdf.so.26.12 /usr/lib/libmupdf.so.26 &&
ln -sfv libmupdf.so.26   /usr/lib/libmupdf.so     &&
chmod 755 /usr/lib/libmupdf.so.26.12              &&

ln -sfv mupdf-x11 /usr/bin/mupdf
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf mupdf-1.26.12-source.tar.gz | head -1 | cut -d/ -f1)"
```


### pdfio-1.6.4

*BLFS 13.1 · ID `pdfio` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 14 MB

**Recommended (included):** `libpng`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/michaelrsweet/pdfio/releases/download/v1.6.4/pdfio-1.6.4.tar.gz
```

MD5 sum of `pdfio-1.6.4.tar.gz`: `21d128da7e16b8035e5eab0676c7496d` (check with `md5sum pdfio-1.6.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pdfio-1.6.4.tar.gz
cd "$(tar -tf pdfio-1.6.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install pdfio by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --enable-shared  &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
mv -v /usr/share/doc/pdfio{,-1.6.4}
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pdfio-1.6.4.tar.gz | head -1 | cut -d/ -f1)"
```


### Qpdf-12.4.0

*BLFS 13.1 · ID `qpdf` · Stage H* · *Build time:* 0.6 SBU (using parallelism=4; add 0.5 SBU for tests) · *Disk space:* 381 MB (with tests)

**Requires:** `libjpeg`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/qpdf/qpdf/releases/download/v12.4.0/qpdf-12.4.0.tar.gz
```

MD5 sum of `qpdf-12.4.0.tar.gz`: `d3156920305cafe5b554dcf36cf3cfe7` (check with `md5sum qpdf-12.4.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf qpdf-12.4.0.tar.gz
cd "$(tar -tf qpdf-12.4.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Qpdf by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -D BUILD_STATIC_LIBS=OFF     \
      -D CMAKE_INSTALL_DOCDIR=/usr/share/doc/qpdf-12.4.0 \
      .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf qpdf-12.4.0.tar.gz | head -1 | cut -d/ -f1)"
```


### libcupsfilters-2.1.1

*BLFS 13.1 · ID `libcupsfilters` · Stage H* · *Build time:* less than 0.1 SBU (Using parallelism=4) · *Disk space:* 25 MB

**Requires:** `cups`, `glib2`, `gs`, `mupdf`, `lcms2`, `pdfio`, `poppler`, `qpdf`  
**Recommended (included):** `libexif`, `libjpeg`, `libpng`, `tiff`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/OpenPrinting/libcupsfilters/releases/download/2.1.1/libcupsfilters-2.1.1.tar.xz
```

MD5 sum of `libcupsfilters-2.1.1.tar.xz`: `1e3144c242e7ddcee112d41c79266885` (check with `md5sum libcupsfilters-2.1.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libcupsfilters-2.1.1.tar.xz
cd "$(tar -tf libcupsfilters-2.1.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libcupsfilters by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/libcupsfilters-2.1.1 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libcupsfilters-2.1.1.tar.xz | head -1 | cut -d/ -f1)"
```


### libppd-2.1.1

*BLFS 13.1 · ID `libppd` · Stage H* · *Build time:* less than 0.1 SBU (Using parallelism=4; with tests) · *Disk space:* 13 MB (with tests)

**Requires:** `libcupsfilters`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/OpenPrinting/libppd/releases/download/2.1.1/libppd-2.1.1.tar.xz
```

MD5 sum of `libppd-2.1.1.tar.xz`: `65accc86f9956a1160937b14e0f516a6` (check with `md5sum libppd-2.1.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libppd-2.1.1.tar.xz
cd "$(tar -tf libppd-2.1.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libppd by running the following commands:

```bash
./configure --prefix=/usr                \
            --disable-static             \
            --with-cups-rundir=/run/cups \
            --enable-ppdc-utils          \
            --docdir=/usr/share/doc/libppd-2.1.1 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libppd-2.1.1.tar.xz | head -1 | cut -d/ -f1)"
```


### cups-filters-2.0.1

*BLFS 13.1 · ID `cups-filters` · Stage H* · *Build time:* less than 0.1 SBU (Using parallelism=4) · *Disk space:* 9.0 MB

**Requires:** `libcupsfilters`, `libppd`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/OpenPrinting/cups-filters/releases/download/2.0.1/cups-filters-2.0.1.tar.xz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/cups-filters-2.0.1-security_fix-1.patch
```

MD5 sum of `cups-filters-2.0.1.tar.xz`: `b40d0f135af414666e1c3917983a1bb3` (check with `md5sum cups-filters-2.0.1.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cups-filters-2.0.1.tar.xz
cd "$(tar -tf cups-filters-2.0.1.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a problem when building with gcc-15:

```bash
sed -i '/proc_func)()/s/()/(FILE*, FILE*, void*)/' filter/foomatic-rip/process.h
```

**[BUILDER]** — Next, fix a security vulnerability:

```bash
patch -Np1 -i ../cups-filters-2.0.1-security_fix-1.patch
```

**[BUILDER]** — Install CUPS Filters by running the following commands:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/cups-filters-2.0.1 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cups-filters-2.0.1.tar.xz | head -1 | cut -d/ -f1)"
```


### Gutenprint-5.3.5

*BLFS 13.1 · ID `gutenprint` · Stage H* · *Build time:* 0.3 SBU (without tests) · *Disk space:* 71 MB (without tests)

**Recommended (included):** `cups`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/gimp-print/gutenprint-5.3.5.tar.xz
```

MD5 sum of `gutenprint-5.3.5.tar.xz`: `18968a1376a0fb0155afea4ce832d7fd` (check with `md5sum gutenprint-5.3.5.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gutenprint-5.3.5.tar.xz
cd "$(tar -tf gutenprint-5.3.5.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Gutenprint by running the following commands:

```bash
sed -i 's|$(PACKAGE)/doc|doc/$(PACKAGE)-$(VERSION)|' \
       {,doc/,doc/developer/}Makefile.in &&

./configure --prefix=/usr    \
            --disable-static \
            --without-gimp2  \
            --without-gimp2-as-gutenprint &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m755 -d /usr/share/doc/gutenprint-5.3.5/api/gutenprint{,ui2} &&
install -v -m644    doc/gutenprint/html/* \
                    /usr/share/doc/gutenprint-5.3.5/api/gutenprint &&
install -v -m644    doc/gutenprintui2/html/* \
                    /usr/share/doc/gutenprint-5.3.5/api/gutenprintui2
```

**Configure:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — For CUPS to see newly installed print drivers, it has to be restarted (as the root user):

```bash
systemctl restart cups
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gutenprint-5.3.5.tar.xz | head -1 | cut -d/ -f1)"
```


### libburn-1.5.8

*BLFS 13.1 · ID `libburn` · Stage H* · *Build time:* 0.1 SBU · *Disk space:* 22 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.libburnia-project.org/releases/libburn-1.5.8.tar.gz
```

MD5 sum of `libburn-1.5.8.tar.gz`: `4c8c786e88eb3e9f7c1d0ddc4d4a39e7` (check with `md5sum libburn-1.5.8.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libburn-1.5.8.tar.gz
cd "$(tar -tf libburn-1.5.8.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libburn by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed Doxygen and wish to generate the HTML documentation, issue the following command:

```bash
doxygen doc/doxygen.conf
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have built the HTML documentation, install it by running the following commands as the root user:

```bash
install -v -dm755 /usr/share/doc/libburn-1.5.8 &&
install -v -m644 doc/html/* /usr/share/doc/libburn-1.5.8
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libburn-1.5.8.tar.gz | head -1 | cut -d/ -f1)"
```


### libisofs-1.5.8.pl02

*BLFS 13.1 · ID `libisofs` · Stage H* · *Build time:* 0.1 SBU · *Disk space:* 15 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.libburnia-project.org/releases/libisofs-1.5.8.pl02.tar.gz
```

MD5 sum of `libisofs-1.5.8.pl02.tar.gz`: `48150014510f8e65de66cb687ff63957` (check with `md5sum libisofs-1.5.8.pl02.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libisofs-1.5.8.pl02.tar.gz
cd "$(tar -tf libisofs-1.5.8.pl02.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libisofs by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed Doxygen and wish to generate the HTML documentation, issue the following command:

```bash
doxygen doc/doxygen.conf
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have built the HTML documentation, install it by running the following commands as the root user:

```bash
install -v -dm755 /usr/share/doc/libisofs-1.5.8.pl02 &&
install -v -m644 doc/html/* /usr/share/doc/libisofs-1.5.8.pl02
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libisofs-1.5.8.pl02.tar.gz | head -1 | cut -d/ -f1)"
```


### Xfburn-0.8.0

*BLFS 13.1 · ID `xfburn` · Stage H* · *Build time:* 0.1 SBU · *Disk space:* 15 MB

**Requires:** `libburn`, `libisofs`, `libxfce4ui`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://archive.xfce.org/src/apps/xfburn/0.8/xfburn-0.8.0.tar.bz2
```

MD5 sum of `xfburn-0.8.0.tar.bz2`: `0ae5e3e94c71857b7cd8555f9f18625f` (check with `md5sum xfburn-0.8.0.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf xfburn-0.8.0.tar.bz2
cd "$(tar -tf xfburn-0.8.0.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Xfburn by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf xfburn-0.8.0.tar.bz2 | head -1 | cut -d/ -f1)"
```


### gmmlib-22.10.0

*BLFS 13.1 · ID `gmmlib` · Stage H* · *Build time:* 0.7 SBU · *Disk space:* 59 MB

**Requires:** `cmake`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/lfs-book/gmmlib/archive/v22.10.0/gmmlib-22.10.0.tar.gz
```

MD5 sum of `gmmlib-22.10.0.tar.gz`: `f94f6903e7df944c7a064f85b1b4a99b` (check with `md5sum gmmlib-22.10.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf gmmlib-22.10.0.tar.gz
cd "$(tar -tf gmmlib-22.10.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install gmmlib by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D BUILD_TYPE=Release        \
      -G Ninja                     \
      -W no-author ..              &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf gmmlib-22.10.0.tar.gz | head -1 | cut -d/ -f1)"
```


### intel-media-driver-26.2.4

*BLFS 13.1 · ID `intel-media-driver` · Stage H* · *Build time:* 6.0 SBU (with parallelism=4 and a single GPU model) · *Disk space:* 3.2 GB (293 MB installed with a single GPU model)

**Requires:** `cmake`, `gmmlib`, `libva`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/lfs-book/intel-media-driver/archive/v26.2.4/intel-media-driver-26.2.4.tar.gz
```

MD5 sum of `intel-media-driver-26.2.4.tar.gz`: `507c81a204cbb38da19ac915ec16a618` (check with `md5sum intel-media-driver-26.2.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf intel-media-driver-26.2.4.tar.gz
cd "$(tar -tf intel-media-driver-26.2.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

> **Side note (BLFS):** This package takes a long time to build because it compiles code specific to each individual generation of Intel GPUs and for a variety of media codecs. If you know the model of your Intel GPU, you can pass the -D{GEN{8,9,11,12},MTL,ARL,LNL,BMG,PTL,NVL}=OFF option to the cmake command but leaving the option for your GPU out. Note that the GEN number here is the generation of the GPU, not the CPU. For example, with an Intel Core i7-1065G7 CPU shipping a 11th-generation Intel GPU, the -D{GEN{8,9,12},MTL,ARL,LNL,BMG,PTL,NVL}=OFF option can be used so the code specific to the other generations of Intel GPUs won't be built. To determine the model of the Intel GPU, install pciutils-3.15.0 and run lspci -nn | grep -Ei 'VGA|DISPLAY' first. It will output some information about the GPU, including the PCI vendor ID (8086 for Intel) and the PCI device ID. For example, with an Intel Core i5-11300H C

**[BUILDER]** — *(Optional — skip if unsure)* This package takes a long time to build because it compiles code specific to each individual generation of Intel GPUs and for a variety of media codecs. If you know the model of your Intel GPU, you can pass the…

```bash
grep -ri 'RegisterDevice(0x9a49'
```

**[BUILDER]** — Install intel-media-driver by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=$XORG_PREFIX \
      -D CMAKE_POLICY_VERSION_MINIMUM=3.5  \
      -D INSTALL_DRIVER_SYSCONF=OFF        \
      -D BUILD_TYPE=Release                \
      -D MEDIA_BUILD_FATAL_WARNINGS=OFF    \
      -G Ninja                             \
      -W no-author ..                      &&
ninja
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
ninja install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf intel-media-driver-26.2.4.tar.gz | head -1 | cut -d/ -f1)"
```


### Msgpack-1.2.1

*BLFS 13.1 · ID `msgpack` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 4.1 MB (add 0.3 MB for tests)

**Requires:** `cython`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/m/msgpack/msgpack-1.2.1.tar.gz
```

MD5 sum of `msgpack-1.2.1.tar.gz`: `e0a9c82423574f99314ccd1ed77b8c67` (check with `md5sum msgpack-1.2.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf msgpack-1.2.1.tar.gz
cd "$(tar -tf msgpack-1.2.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user msgpack
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf msgpack-1.2.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Charset-normalizer-3.4.7

*BLFS 13.1 · ID `charset-normalizer` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 1.1 MB (add 15 MB for tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/c/charset-normalizer/charset_normalizer-3.4.7.tar.gz
```

MD5 sum of `charset_normalizer-3.4.7.tar.gz`: `68805886064d248d2e5205fd11112d85` (check with `md5sum charset_normalizer-3.4.7.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf charset_normalizer-3.4.7.tar.gz
cd "$(tar -tf charset_normalizer-3.4.7.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user charset-normalizer
```

**[BUILDER]** — Assuming Pytest-9.1.1 is installed, but the other optional dependencies are not, the installation can be tested with the following commands:

```bash
python3 -m venv --system-site-packages testenv &&
source testenv/bin/activate                    &&
pip3 install pytest-cov                        &&
python3 /usr/bin/pytest                        &&
deactivate
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf charset_normalizer-3.4.7.tar.gz | head -1 | cut -d/ -f1)"
```


### Idna-3.18

*BLFS 13.1 · ID `idna` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 4.8 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/i/idna/idna-3.18.tar.gz
```

MD5 sum of `idna-3.18.tar.gz`: `64359467ec86d86e398b1ae614e5718c` (check with `md5sum idna-3.18.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf idna-3.18.tar.gz
cd "$(tar -tf idna-3.18.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user idna
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf idna-3.18.tar.gz | head -1 | cut -d/ -f1)"
```


### Hatch_vcs-0.5.0

*BLFS 13.1 · ID `hatch-vcs` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 436 KB (with tests)

**Requires:** `hatchling`, `setuptools_scm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/h/hatch-vcs/hatch_vcs-0.5.0.tar.gz
```

MD5 sum of `hatch_vcs-0.5.0.tar.gz`: `9a22a9f7203783e526959d34510a9672` (check with `md5sum hatch_vcs-0.5.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf hatch_vcs-0.5.0.tar.gz
cd "$(tar -tf hatch_vcs-0.5.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user hatch_vcs
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf hatch_vcs-0.5.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Urllib3-2.7.0

*BLFS 13.1 · ID `urllib3` · Stage H* · *Build time:* less than 0.1 SBU (0.6 SBU for tests) · *Disk space:* 3.5 MB (add 123 MB for tests)

**Requires:** `hatch-vcs`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/u/urllib3/urllib3-2.7.0.tar.gz
```

MD5 sum of `urllib3-2.7.0.tar.gz`: `e79707b798a66c8165c9c441440f4e80` (check with `md5sum urllib3-2.7.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf urllib3-2.7.0.tar.gz
cd "$(tar -tf urllib3-2.7.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user urllib3
```

**[BUILDER]** — Assuming Pytest-9.1.1 is installed, but the other optional dependencies are not, the installation can be tested with the following commands:

```bash
python3 -m venv --system-site-packages testenv &&
source testenv/bin/activate                    &&
pip3 install --group dev                       &&
python3 /usr/bin/pytest --timeout 10
deactivate
```

> **Side note (BLFS):** The tests are currently broken with OpenSSL-4 as the pyopenssl module that is downloaded and installed into the virtual environment has not been adjusted for changes required by OpenSSL-4.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf urllib3-2.7.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Requests-2.34.2

*BLFS 13.1 · ID `requests` · Stage H* · *Build time:* less than 0.1 SBU (0.9 SBU for tests) · *Disk space:* 89 MB (with tests)

**Requires:** `charset-normalizer`, `idna`, `urllib3`  
**Recommended (included):** `make-ca`, `p11-kit`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/r/requests/requests-2.34.2.tar.gz
wget https://www.linuxfromscratch.org/patches/blfs/13.1/requests-use_system_certs-2.patch
```

MD5 sum of `requests-2.34.2.tar.gz`: `611e438d0803e962500225f9807a475e` (check with `md5sum requests-2.34.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf requests-2.34.2.tar.gz
cd "$(tar -tf requests-2.34.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First apply a patch so that the same environment variable already used to point to system certificates in Python3 following the installation of make-ca can also be used by this module:

```bash
patch -Np1 -i ../requests-use_system_certs-2.patch
```

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user requests
```

> **Side note (BLFS):** Some of the setup instructions below may indicate an error due to dependent module versions, but these errors do not affect the test results.

**[BUILDER]** — Assuming Pytest-9.1.1 is installed, but the other optional dependencies are not, the installation can be tested with the following commands:

```bash
python3 -m venv --system-site-packages testenv &&
source testenv/bin/activate                    &&
pip3 install pytest-mock    \
             pytest-httpbin \
             pytest-cov     \
             pytest-xdist   \
             pysocks        \
             trustme                           &&
python3 /usr/bin/pytest tests
deactivate
```

> **Side note (BLFS):** See make-ca-1.16.1 for how to set the environment variable, and for how local copies of the Certifi and Requests modules installed in a virtual environment will override the system certificates.

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf requests-2.34.2.tar.gz | head -1 | cut -d/ -f1)"
```


### semantic_version-2.10.0

*BLFS 13.1 · ID `semantic_version` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 656 KB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/s/semantic_version/semantic_version-2.10.0.tar.gz
```

MD5 sum of `semantic_version-2.10.0.tar.gz`: `e48abef93ba69abcd4eaf4640edfc38b` (check with `md5sum semantic_version-2.10.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf semantic_version-2.10.0.tar.gz
cd "$(tar -tf semantic_version-2.10.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user semantic_version
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf semantic_version-2.10.0.tar.gz | head -1 | cut -d/ -f1)"
```


### setuptools_rust-1.12.1

*BLFS 13.1 · ID `setuptools_rust` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 3.9 MB (with tests)

**Requires:** `semantic_version`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/s/setuptools_rust/setuptools_rust-1.12.1.tar.gz
```

MD5 sum of `setuptools_rust-1.12.1.tar.gz`: `90ce501aabce2a859e19a213985288ea` (check with `md5sum setuptools_rust-1.12.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf setuptools_rust-1.12.1.tar.gz
cd "$(tar -tf setuptools_rust-1.12.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user setuptools_rust
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf setuptools_rust-1.12.1.tar.gz | head -1 | cut -d/ -f1)"
```


### maturin-1.14.1

*BLFS 13.1 · ID `maturin` · Stage H* · *Build time:* 1.3 SBU (including download time, add 2.5 SBU for tests with download time) · *Disk space:* 537 MB (add 6.1 GB for tests)

**Requires:** `rust`, `setuptools_rust`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/PyO3/maturin/archive/v1.14.1/maturin-1.14.1.tar.gz
```

MD5 sum of `maturin-1.14.1.tar.gz`: `ed60ce01916c36311fa8752b7af00b67` (check with `md5sum maturin-1.14.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf maturin-1.14.1.tar.gz
cd "$(tar -tf maturin-1.14.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user maturin
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, issue:

```bash
python3 -m venv --system-site-packages testenv     &&
testenv/bin/pip3 install cffi pycparser virtualenv &&
PATH=$PWD/testenv/bin:$PATH cargo test
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf maturin-1.14.1.tar.gz | head -1 | cut -d/ -f1)"
```


### uv_build-0.11.24

*BLFS 13.1 · ID `uv_build` · Stage H* · *Build time:* 0.9 SBU · *Disk space:* 445 MB

**Requires:** `maturin`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/u/uv_build/uv_build-0.11.24.tar.gz
```

MD5 sum of `uv_build-0.11.24.tar.gz`: `f537ded461369ed76aec64e5d2e0269d` (check with `md5sum uv_build-0.11.24.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf uv_build-0.11.24.tar.gz
cd "$(tar -tf uv_build-0.11.24.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user uv_build
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf uv_build-0.11.24.tar.gz | head -1 | cut -d/ -f1)"
```


### cachecontrol-0.14.4

*BLFS 13.1 · ID `cachecontrol` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 348 KB (add 97 MB for the tests)

**Requires:** `msgpack`, `requests`, `uv_build`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/psf/cachecontrol/archive/v0.14.4/cachecontrol-0.14.4.tar.gz
```

MD5 sum of `cachecontrol-0.14.4.tar.gz`: `05c8e0cb39b405094ae1d6cdea337521` (check with `md5sum cachecontrol-0.14.4.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cachecontrol-0.14.4.tar.gz
cd "$(tar -tf cachecontrol-0.14.4.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user cachecontrol
```

**[BUILDER]** — *(Optional — skip if unsure)* To run the tests, issue:

```bash
python3 -m venv --system-site-packages testenv &&
testenv/bin/pip3 install 'cachecontrol[dev]'   &&
testenv/bin/python3 -m pytest
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cachecontrol-0.14.4.tar.gz | head -1 | cut -d/ -f1)"
```


### CSSSelect-1.5.0

*BLFS 13.1 · ID `cssselect` · Stage H* · *Build time:* less than 0.1 SBU (with tests) · *Disk space:* 1.2 MB (with tests)

**Requires:** `hatchling`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/c/cssselect/cssselect-1.5.0.tar.gz
```

MD5 sum of `cssselect-1.5.0.tar.gz`: `465a7b6af9ea95fdefe5357301589b9c` (check with `md5sum cssselect-1.5.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cssselect-1.5.0.tar.gz
cd "$(tar -tf cssselect-1.5.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user cssselect
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cssselect-1.5.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Pyproject-Metadata-0.12.1

*BLFS 13.1 · ID `pyproject-metadata` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 700 KB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/p/pyproject-metadata/pyproject_metadata-0.12.1.tar.gz
```

MD5 sum of `pyproject_metadata-0.12.1.tar.gz`: `d44c15fd176128acd9497af2512085a0` (check with `md5sum pyproject_metadata-0.12.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pyproject_metadata-0.12.1.tar.gz
cd "$(tar -tf pyproject_metadata-0.12.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user pyproject-metadata
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, make sure Pytest-9.1.1 is installed and run:

```bash
python3 -m venv --system-site-packages testenv &&
testenv/bin/pip3 install exceptiongroup        &&
testenv/bin/python3 -m pytest
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pyproject_metadata-0.12.1.tar.gz | head -1 | cut -d/ -f1)"
```


### Meson_python-0.20.0

*BLFS 13.1 · ID `meson_python` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 20 MB (with tests)

**Requires:** `pyproject-metadata`  
**Needed at runtime:** `patchelf`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/m/meson_python/meson_python-0.20.0.tar.gz
```

MD5 sum of `meson_python-0.20.0.tar.gz`: `032ed60b1d86c448331fc0a2ba81f499` (check with `md5sum meson_python-0.20.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf meson_python-0.20.0.tar.gz
cd "$(tar -tf meson_python-0.20.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user meson_python
```

**[BUILDER]** — *(Optional — skip if unsure)* To test the installation, make sure Git-2.55.0, Patchelf-0.19.1, and Pytest-9.1.1 are installed, then issue (HOME= prevents the .gitconfig file in the home directory from interfering the tests):

```bash
python3 -m venv --system-site-packages testenv &&
testenv/bin/pip3 install --group=test          &&
HOME= testenv/bin/python -m pytest
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf meson_python-0.20.0.tar.gz | head -1 | cut -d/ -f1)"
```


### NumPy-2.5.2

*BLFS 13.1 · ID `numpy` · Stage H* · *Build time:* 0.8 SBU (add 0.9 SBU for tests) · *Disk space:* 391 MB (with tests)

**Requires:** `cython`, `meson_python`, `pyproject-metadata`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/n/numpy/numpy-2.5.2.tar.gz
```

MD5 sum of `numpy-2.5.2.tar.gz`: `85f9db626b908f4d2211d98b4bf8a83d` (check with `md5sum numpy-2.5.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf numpy-2.5.2.tar.gz
cd "$(tar -tf numpy-2.5.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir \
           -C setup-args=-Dallow-noblas=true $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user numpy
```

**[BUILDER]** — The installation can be tested with the following commands:

```bash
mkdir -p test                                  &&
cd       test                                  &&
python3 -m venv --system-site-packages testenv &&
source testenv/bin/activate                    &&
pip3 install hypothesis attrs                  &&
python3 -c "import numpy, sys; sys.exit(numpy.test() is False)"
deactivate
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf numpy-2.5.2.tar.gz | head -1 | cut -d/ -f1)"
```


### Patchelf-0.19.1

*BLFS 13.1 · ID `patchelf` · Stage H* · *Build time:* 0.1 SBU (with tests) · *Disk space:* 27 MB (with tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/NixOS/patchelf/releases/download/0.19.1/patchelf-0.19.1.tar.gz
```

MD5 sum of `patchelf-0.19.1.tar.gz`: `508702ca6e4ee4638fe4e6dcf8885c95` (check with `md5sum patchelf-0.19.1.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf patchelf-0.19.1.tar.gz
cd "$(tar -tf patchelf-0.19.1.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install patchelf by running the following commands:

```bash
./configure --prefix=/usr \
            --docdir=/usr/share/doc/patchelf-0.19.1 &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf patchelf-0.19.1.tar.gz | head -1 | cut -d/ -f1)"
```


### pySerial-3.5

*BLFS 13.1 · ID `pyserial` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 2.1 MB (add 0.2 MB for tests)

**Requires:** `setuptools_scm`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/p/pyserial/pyserial-3.5.tar.gz
```

MD5 sum of `pyserial-3.5.tar.gz`: `1cf25a76da59b530dbfc2cf99392dc83` (check with `md5sum pyserial-3.5.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf pyserial-3.5.tar.gz
cd "$(tar -tf pyserial-3.5.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user pyserial
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf pyserial-3.5.tar.gz | head -1 | cut -d/ -f1)"
```


### six-1.17.0

*BLFS 13.1 · ID `six` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 300 KB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.pythonhosted.org/packages/source/s/six/six-1.17.0.tar.gz
```

MD5 sum of `six-1.17.0.tar.gz`: `a0387fe15662c71057b4fb2b7aa9056a` (check with `md5sum six-1.17.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf six-1.17.0.tar.gz
cd "$(tar -tf six-1.17.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
pip3 install --no-index --find-links dist --no-user six
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf six-1.17.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Scour-0.38.2

*BLFS 13.1 · ID `scour` · Stage H* · *Build time:* less than 0.1 SBU · *Disk space:* 1.3 MB

**Requires:** `six`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/scour-project/scour/archive/v0.38.2/scour-0.38.2.tar.gz
```

MD5 sum of `scour-0.38.2.tar.gz`: `ae30f52602802f8c7df3a32e1f72b325` (check with `md5sum scour-0.38.2.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf scour-0.38.2.tar.gz
cd "$(tar -tf scour-0.38.2.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Build the module:

```bash
pip3 wheel -w dist --no-build-isolation --no-deps --no-cache-dir $PWD
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — To install the module, run the following command as the root user:

```bash
pip3 install --no-index --find-links dist --no-user scour
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf scour-0.38.2.tar.gz | head -1 | cut -d/ -f1)"
```



### Rebuild Mesa for hardware video decoding

Mesa was built in Stage B, before **libva** existed, so it has no VA-API (hardware video decoding) support yet. BLFS says to rebuild Mesa once libva is installed. Repeat the **Mesa** steps from Stage B, from a fresh extraction, with exactly the same commands. Mesa's `meson setup` then reports `Run-time dependency libva found: YES`.

**[BUILDER]**

```bash
cd ~/src && rm -rf mesa-26.1.7
tar -xf mesa-26.1.7.tar.xz && cd mesa-26.1.7
```

Then continue with Mesa's Stage B build block (`mkdir build && cd build`, `meson setup ..`, `ninja`), and **[IPRPS CHROOT]** `ninja install` in `/build/src/mesa-26.1.7/build`.

### Printing

Enable printing, and let users manage printers. As root:

**[IPRPS CHROOT]**

```bash
systemctl enable cups
usermod -aG lpadmin builder
```

Add `lpadmin` to the groups in `iprps-setup` (13.2) so new users can add printers: change `-G users,wheel,audio,video,iprps` to `-G users,wheel,audio,video,iprps,lpadmin`.

### Chromium (Medium and Advanced)

Medium and Advanced add **Chromium** as the **default web browser**, and as the engine that runs each IPRPS app in its own window (`iprps-open`, 12.2). Firefox stays installed, and Lite keeps Firefox only: on 6 GB machines one browser is enough.

IPRPS uses **ungoogled-chromium**, a prebuilt, open-source Chromium **without Google's services and telemetry**, unbranded, and BSD-licensed like Chromium itself. It isn't built from source here on purpose: BLFS has no Chromium, one build needs about 16 GB of RAM, over 100 GB of disk and roughly a day, and since September 2026 Chromium releases every two weeks, with weekly security fixes. A prebuilt release keeps IPRPS current with a few minutes' work per update.

**1. Download (Windows).** From **https://github.com/ungoogled-software/ungoogled-chromium-portablelinux/releases**, download the newest **x86_64 Linux `.tar.xz`** (for example `ungoogled-chromium_155.0.8059.84-1_linux.tar.xz`; use the exact name shown). GitHub lists each file's **SHA-256** next to it; note it down.

**2. Copy it in and check it. [DEBIAN ROOT]**

```bash
cp -v /mnt/c/Users/<you>/Downloads/ungoogled-chromium_*_linux.tar.xz /build/src/
sha256sum /build/src/ungoogled-chromium_*_linux.tar.xz
```

The `sha256sum` output must match GitHub's value exactly.

**3. Install into `/opt/chromium`. [IPRPS CHROOT]**

```bash
rm -rf /opt/chromium && install -vdm755 /opt/chromium
tar -xf /build/src/ungoogled-chromium_*_linux.tar.xz -C /opt/chromium --strip-components=1
ls -l /opt/chromium/chrome
S=$(ls /opt/chromium/chrome[-_]sandbox 2>/dev/null) && chown root:root "$S" && chmod 4755 "$S" && ls -l "$S"
ldd /opt/chromium/chrome | grep 'not found' || echo "all libraries found"
```

- `chrome` must exist; if `ls` fails, the archive has a different folder layout: `tar -tf <file> | head` shows it, and the `--strip-components` number may need changing.
- The sandbox helper gets the setuid bit (`-rwsr-xr-x`): Chromium's security sandbox relies on it when user namespaces aren't available.
- `ldd` must print **all libraries found**. A missing library (often `libcups.so.2`, from the Medium printing packages) means a package from Stage H isn't built yet.

**4. The `chromium` command, the menu entry and its icon. [IPRPS CHROOT]**

```bash
cat > /usr/bin/chromium << "EOF"
#!/bin/sh
# chromium - IPRPS wrapper for ungoogled-chromium in /opt/chromium
FLAGS=""
[ -r /etc/iprps/chromium-flags.conf ] && FLAGS=$(grep -v '^\s*#' /etc/iprps/chromium-flags.conf | tr '\n' ' ')
exec /opt/chromium/chrome $FLAGS "$@"
EOF
chmod 755 /usr/bin/chromium
install -vdm755 /etc/iprps
cat > /etc/iprps/chromium-flags.conf << "EOF"
# Extra command-line flags for every Chromium start, one per line.
# Hardware video decoding (VA-API, after Mesa's rebuild with libva in this stage):
--enable-features=AcceleratedVideoDecodeLinuxGL
EOF
install -vdm755 /usr/share/icons/hicolor/256x256/apps
L=$(ls /opt/chromium/product_logo_256.png 2>/dev/null) && install -v -m644 "$L" /usr/share/icons/hicolor/256x256/apps/chromium.png
cat > /usr/share/applications/chromium.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Chromium
GenericName=Web Browser
Comment=Browse the web
Exec=chromium %U
Icon=chromium
Terminal=false
Categories=Network;WebBrowser;
MimeType=text/html;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
StartupWMClass=Chromium
Actions=new-window;incognito;

[Desktop Action new-window]
Name=New Window
Exec=chromium --new-window

[Desktop Action incognito]
Name=New Incognito Window
Exec=chromium --incognito
EOF
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database /usr/share/applications
```

If `product_logo_256.png` isn't in the archive, `find /opt/chromium -name 'product_logo*'` shows what is there; any of them works as the icon.

**5. IPRPS settings for every user (policies). [IPRPS CHROOT]** Chromium reads system-wide settings from `/etc/chromium/policies/managed/`. This one sets the IPRPS Hub as the home page, a private search engine, no promotional tabs or usage statistics, no background running after the window closes (saves memory), and an **IPRPS bookmarks folder** with every installed app, built from the folders in `/srv/www/iprps`:

```bash
install -vdm755 /etc/chromium/policies/managed
python3 - << "PY"
import json, os
root = '/srv/www/iprps'
apps = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and d != 'auth')
marks = [{"toplevel_name": "IPRPS"},
         {"name": "Sign in (Universal Login)", "url": "http://localhost/iprps/auth/login.html"}]
marks += [{"name": a.replace('_', ' ').replace('-', ' ').title(), "url": f"http://localhost/iprps/{a}/"} for a in apps]
policy = {
    "HomepageLocation": "http://localhost/iprps/hub/",
    "HomepageIsNewTabPage": False,
    "ShowHomeButton": True,
    "BookmarkBarEnabled": True,
    "ManagedBookmarks": marks,
    "DefaultSearchProviderEnabled": True,
    "DefaultSearchProviderName": "DuckDuckGo",
    "DefaultSearchProviderSearchURL": "https://duckduckgo.com/?q={searchTerms}",
    "MetricsReportingEnabled": False,
    "PromotionalTabsEnabled": False,
    "BackgroundModeEnabled": False,
    "DefaultBrowserSettingEnabled": False,
}
json.dump(policy, open('/etc/chromium/policies/managed/iprps.json', 'w'), indent=2)
print(len(apps), "apps in the IPRPS bookmarks folder")
PY
python3 -m json.tool /etc/chromium/policies/managed/iprps.json > /dev/null && echo "policy file OK"
```

Run this block again whenever apps are added or renamed, to refresh the bookmarks. Users see these settings as "managed by your organization"; the IPRPS bookmarks folder and the search engine can't be removed by users, everything else stays theirs to change. `DefaultBrowserSettingEnabled: false` only stops Chromium from asking; IPRPS sets the default below.

**6. Make Chromium the default browser. [IPRPS CHROOT]** For the system's link handling (`xdg-open`) and for Xfce's "Web Browser" setting:

```bash
cat > /etc/xdg/mimeapps.list << "EOF"
[Default Applications]
text/html=chromium.desktop
application/xhtml+xml=chromium.desktop
x-scheme-handler/http=chromium.desktop
x-scheme-handler/https=chromium.desktop
EOF
ls /usr/share/xfce4/helpers/ | grep -i chrom
install -vdm755 /etc/xdg/xfce4
grep -q '^WebBrowser=' /etc/xdg/xfce4/helpers.rc 2>/dev/null && \
  sed -i 's/^WebBrowser=.*/WebBrowser=chromium/' /etc/xdg/xfce4/helpers.rc || echo 'WebBrowser=chromium' >> /etc/xdg/xfce4/helpers.rc
cat /etc/xdg/xfce4/helpers.rc
```

The `ls` should show a `chromium.desktop` helper (it comes with Xfce's exo). If it doesn't, Xfce's setting falls back to the first browser it finds, while links opened with `xdg-open` still follow `mimeapps.list`. Users can change the default in **Settings → Default Applications**.

**7. Test** (fresh test copy, log in): the panel's web-browser button and links open Chromium; the **IPRPS** bookmarks folder is on its bookmark bar; `chrome://policy` lists the IPRPS settings as active; and an IPRPS menu launcher (or `iprps-open cookbook` in a terminal) opens the app **in its own window**, already signed in after one login.

> **Side note:** **What "ungoogled" changes.** No Google sign-in, sync or Safe Browsing (Safe Browsing needs Google's service; Firefox's own protection remains available), no usage statistics, and the Chrome Web Store isn't built in: extensions are installed by downloading their `.crx` file and dragging it onto `chrome://extensions` with **Developer mode** on. IPRPS's own apps don't need any extensions.

> **Pro tip:** **Updating Chromium.** Each IPRPS release ships the newest ungoogled-chromium. Between releases, an administrator updates it in a minute with steps 1–3 (download, check, `rm -rf /opt/chromium`, unpack, sandbox permission); the settings in steps 4–6 stay in place. Check the releases page about every two weeks.

### Local AI: Ollama and the IPRPS Oracle (Medium and Advanced)

Medium and Advanced include a **local AI** for Session Masters: the **IPRPS Oracle**, an app in Session Master Mode that improvises NPCs, scenes, locations, loot, encounters, plot hooks and names, answers questions about the campaign, and sends descriptions to the players' screen. It runs **entirely on the computer**: no internet, no account, no API key, and nothing leaves the machine.

| Part | What it is | Size |
|---|---|---|
| **Ollama** | The service that runs AI models (MIT license), `/usr/bin/ollama` + `/usr/lib/ollama` | about 0.3–0.6 GB (after removing the NVIDIA libraries) |
| **iprps-storyteller** | The Oracle's model: **Qwen3.5 4B** (Apache-2.0) plus the IPRPS Modelfile (Session Master voice, BTN/AR terminology) | about 3.4 GB |
| **IPRPS Oracle** | The app, `/srv/www/iprps/oracle`, with the Universal Login | under 100 KB |

It needs about **5 GB of free memory** while answering, so 8 GB machines work (16 GB is comfortable). Graphics cards help through **Vulkan** (AMD and Intel, with Mesa's drivers from Stage B); without a usable GPU it runs on the processor, more slowly. **NVIDIA** acceleration needs NVIDIA's own driver, which IPRPS OS can't ship; it runs on the processor there.

Later, a **custom-trained IPRPS model** replaces the bundled one with one command (`iprps-ai-model install`, below); the app keeps working unchanged because it always asks for the model named `iprps-storyteller`.

**Before you start:** unzip the newest IPRPS OS repository over your local copy (`G:\IPRPS\iprps-os`, E.3). It contains the app (`apps/oracle/`) and the AI files (`ai/`).

**1. Check the Vulkan drivers. [IPRPS CHROOT]**

```bash
ls /usr/share/vulkan/icd.d/
ls /usr/lib/libvulkan.so.1
```

Expect `radeon_icd.x86_64.json` (AMD), `intel_icd.x86_64.json` (Intel) and `lvp_icd.x86_64.json` (software). They come from Mesa, built in Stage B after the Vulkan loader and glslang. The service below switches the software driver off, because it's slower than Ollama's own processor code.

**2. Download Ollama (Windows).** Download **https://ollama.com/download/ollama-linux-amd64.tar.zst** (the standard Linux build; not the `-rocm` one). Its SHA-256 is in **`sha256sum.txt`** on the newest release at **https://github.com/ollama/ollama/releases**. Note the version number shown there.

**[DEBIAN ROOT]**

```bash
cp -v /mnt/c/Users/<you>/Downloads/ollama-linux-amd64.tar.zst /build/src/
sha256sum /build/src/ollama-linux-amd64.tar.zst
```

The checksum must match the `ollama-linux-amd64.tar.zst` line in `sha256sum.txt`.

**3. Install it. [IPRPS CHROOT]**

```bash
rm -rf /usr/lib/ollama
tar --zstd -xf /build/src/ollama-linux-amd64.tar.zst -C /usr
find /usr/lib/ollama -maxdepth 1 -iname '*cuda*' -exec rm -rf {} +
ls /usr/lib/ollama
du -sh /usr/lib/ollama
ollama -v
```

- The `find` removes the NVIDIA (CUDA) libraries, which are over a gigabyte and can't work without NVIDIA's driver. What's left: the processor libraries (`libggml-cpu-*`) and the Vulkan library.
- `ollama -v` prints the version and a warning that it can't connect to a running Ollama; that's expected, the service isn't running yet.

**4. The service. [IPRPS CHROOT]** A system user `ollama` owns the models in `/var/lib/ollama`; the service listens on this computer only (`127.0.0.1`), keeps one model in memory at a time and frees it after 15 minutes without use:

```bash
getent group render >/dev/null || groupadd -r render
getent group ollama >/dev/null || groupadd -r ollama
id ollama >/dev/null 2>&1 || useradd -r -g ollama -G video,render -d /var/lib/ollama -s /bin/false -c "Ollama AI service" ollama
install -vdm755 -o ollama -g ollama /var/lib/ollama /var/lib/ollama/models
cat > /etc/systemd/system/ollama.service << "EOF"
[Unit]
Description=Ollama local AI service (IPRPS Oracle)
Documentation=https://docs.ollama.com/
After=network.target

[Service]
Type=simple
User=ollama
Group=ollama
SupplementaryGroups=video render
Environment=HOME=/var/lib/ollama
# This computer only; the IPRPS Oracle reaches it through Apache and PHP.
Environment=OLLAMA_HOST=127.0.0.1:11434
Environment=OLLAMA_MODELS=/var/lib/ollama/models
# One model at a time, one request at a time: fits 8 GB machines.
Environment=OLLAMA_MAX_LOADED_MODELS=1
Environment=OLLAMA_NUM_PARALLEL=1
Environment=OLLAMA_CONTEXT_LENGTH=8192
# Free the memory 15 minutes after the last request.
Environment=OLLAMA_KEEP_ALIVE=15m
# Never use Mesa's software Vulkan driver (slower than the CPU code).
Environment=VK_LOADER_DRIVERS_DISABLE=lvp_icd*
EnvironmentFile=-/etc/iprps/ollama.conf
ExecStart=/usr/bin/ollama serve
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/ollama

[Install]
WantedBy=multi-user.target
EOF
systemctl enable ollama
```

Settings for one computer (for example `OLLAMA_KEEP_ALIVE=60m`) go into `/etc/iprps/ollama.conf`, one `NAME=value` per line, without editing the service file.

**5. The AI files and the `iprps-ai-model` tool. [DEBIAN ROOT]**

```bash
R=/mnt/g/IPRPS/iprps-os
install -vdm755 /mnt/iprps/usr/share/iprps/ai
install -vm644 $R/ai/Modelfile $R/ai/system-prompt.txt /mnt/iprps/usr/share/iprps/ai/
install -vm755 $R/ai/iprps-ai-model /mnt/iprps/usr/bin/
```

**6. Put the model into the image. [DEBIAN ROOT]** The download runs in Debian (it has internet and nothing else to configure): a temporary copy of Ollama on a separate port saves the model straight into the image's `/var/lib/ollama/models`, then builds `iprps-storyteller` from the IPRPS Modelfile. Keep this window open until the end of the block.

```bash
apt install -y zstd
rm -rf /root/ollama-host && mkdir -p /root/ollama-host
tar --zstd -xf /build/src/ollama-linux-amd64.tar.zst -C /root/ollama-host
export OLLAMA_HOST=127.0.0.1:11500
OLLAMA_MODELS=/mnt/iprps/var/lib/ollama/models /root/ollama-host/bin/ollama serve > /root/ollama-host.log 2>&1 &
sleep 5
/root/ollama-host/bin/ollama pull qwen3.5:4b
/root/ollama-host/bin/ollama create iprps-storyteller -f /mnt/iprps/usr/share/iprps/ai/Modelfile
/root/ollama-host/bin/ollama list
/root/ollama-host/bin/ollama show qwen3.5:4b --license > /mnt/iprps/usr/share/iprps/ai/LICENSE-qwen3.5.txt
head -3 /mnt/iprps/usr/share/iprps/ai/LICENSE-qwen3.5.txt
/root/ollama-host/bin/ollama run iprps-storyteller "In two sentences, describe a smugglers' tavern."
pkill -f 'ollama-host/bin/ollama serve'; unset OLLAMA_HOST
du -sh /mnt/iprps/var/lib/ollama/models
```

- `ollama pull` downloads about 3.4 GB; `ollama list` must show **qwen3.5:4b** and **iprps-storyteller:latest**.
- The license file must start with the Apache License header; it ships with the model, as Apache-2.0 requires.
- The test answer may first print a "Thinking…" section (the Oracle app switches thinking off). Answers in Debian are slow; that's the processor of a WSL machine, not the target computer.
- If `pull` says the model isn't found, its name changed: check **https://ollama.com/library/qwen3.5** for the 4B tag, and change both the `pull` line and the `FROM` line of `ai/Modelfile`.

Then give the model files to the service user:

**[IPRPS CHROOT]**

```bash
chown -R ollama:ollama /var/lib/ollama
ls -l /var/lib/ollama/models
```

**7. Let AI replies stream. [IPRPS CHROOT]** Nothing to add: 10.1's PHP rule (`/etc/httpd/extra/iprps-php.conf`) already passes answers through as they're written. Check that it's in place:

```bash
grep -n 'flushpackets' /etc/httpd/extra/iprps-php.conf
grep -c '^ProxyPassMatch' /etc/httpd/httpd.conf
```

Expect the `ProxySet flushpackets=on timeout=900` line, and **0**. On an image built before that change, do 10.1's "only real `.php` files go to PHP" step now; it replaces the older Oracle-only `ProxyPassMatch` rule as well.

**8. Install the IPRPS Oracle app. [DEBIAN ROOT]**

```bash
R=/mnt/g/IPRPS/iprps-os
cp -rv $R/apps/oracle /mnt/iprps/srv/www/iprps/
install -vDm644 $R/apps/oracle/oracle-icon.svg /mnt/iprps/usr/share/icons/hicolor/scalable/apps/iprps-oracle.svg
```

**[IPRPS CHROOT]**

```bash
chown -R root:apache /srv/www/iprps/oracle
find /srv/www/iprps/oracle -type d -exec chmod 755 {} + ; find /srv/www/iprps/oracle -type f -exec chmod 644 {} +
ls -A /srv/www/iprps/oracle
cat > /usr/share/applications/iprps-oracle.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=IPRPS Oracle
GenericName=Session Master AI
Comment=Local AI for Session Masters: NPCs, scenes, loot, encounters and campaign memory
Exec=iprps-open oracle/
Icon=iprps-oracle
Terminal=false
Categories=X-IPRPS;
EOF
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database /usr/share/applications
```

`ls -A` lists `api.php`, `config.php`, `display.php`, `index.html`, `markdown.js`, `oracle.css`, `oracle.js`, `oracle-icon.svg`, `prompts.php` and `.user.ini` (which turns PHP's output buffering off for this folder). The Oracle needs **no database setup**: on first use it creates its tables (`oracle_messages`, `oracle_memory`, `display_items`) in the IPRPS core database, using the password `iprps-db-init` writes to `/etc/iprps/db.php` (13.1). It reads the campaign memory from the core tables the Session Master Hub fills: `campaigns`, `sessions` (recap, Session Master notes), `session_log`, `npcs`, `quests` and `characters`.

**9. Test** (fresh test copy, `-m 8G`, log in):

**[TEST VM]** (terminal)

```bash
systemctl status ollama --no-pager | head -5
iprps-ai-model status
```

The service is **active (running)**; the status lists `iprps-storyteller` "built from: qwen3.5:4b", and the log line shows which compute device was found (in QEMU: the processor).

Then open **IPRPS Oracle** from the menu (or Session Master Mode): it asks for the Universal Login once, the top bar shows **Ollama** in green, and the model menu shows `iprps-storyteller`. Click **NPC**: the first answer takes longer (the model loads), then text appears word by word. Try **Show players**, then open **Player display ↗**: the text appears full-screen. With a campaign chosen (create one in the Hub, or `INSERT INTO campaigns (name) VALUES ('Test')` in `mariadb -u root iprps`), **Save NPC** adds it to the campaign, and **What the Oracle knows** shows it.

| What the Session Master does | Where it goes |
|---|---|
| Chat, generators | `oracle_messages` (per user and campaign; **Clear this chat** deletes them) |
| **Pin to memory** / **Pin** | `oracle_memory`: facts the Oracle always gets for that campaign |
| **Save NPC**, **Save quest**, **Add to log** | The campaign's `npcs`, `quests`, and the latest session's `session_log` |
| **Show players**, **Clear display** | `display_items`, shown by the player display |

> **Side note:** **Speed.** On a recent 4–8 core processor, the 4B model writes roughly a sentence every one to three seconds; a Vulkan GPU is several times faster. Session Master Mode loads the model when it starts, so the first question at the table doesn't wait for it. Inside QEMU everything is slower.

> **Pro tip:** **A custom IPRPS model.** When the trained IPRPS storyteller model exists (as a `.gguf` file, the format Ollama imports), one command makes it the Oracle's model on any IPRPS OS computer: `sudo iprps-ai-model install iprps-storyteller-v1.Q4_K_M.gguf`. It keeps the IPRPS system prompt (`/usr/share/iprps/ai/system-prompt.txt`); a model that needs its own chat template comes with a Modelfile instead: `sudo iprps-ai-model install-modelfile Modelfile`. `sudo iprps-ai-model reset` returns to the shipped model. To ship the custom model in a release instead, change the `FROM` line of `ai/Modelfile` to the `.gguf` file's path and repeat step 6 with that file instead of the `pull`. The license of the model it was trained from still applies.

> **Side note:** **Updating Ollama.** Repeat steps 2 and 3 (the `rm -rf /usr/lib/ollama` comes first) and restart the service: `systemctl restart ollama`. The models in `/var/lib/ollama` stay. Users can download other models with `sudo iprps-ai-model pull <name>` (from **https://ollama.com/library**, needs internet) and choose them in the Oracle's **Model** menu; IPRPS's prompts are written for `iprps-storyteller`.

Install the Medium IPRPS apps (12.4) using 12.5 and 12.8; they appear in every Session Master's **Manage apps** list (12.6) automatically.

> **Checkpoint:** Take snapshot **`RELEASE-medium`**, then release it as in Part 14: `/root/iprps-release-clean.sh medium`, `/root/iprps-release-pack.sh medium` → `iprps-os-1.0-medium.img.xz`.

**[DEBIAN ROOT]** — snapshot `RELEASE-medium`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-RELEASE-medium.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-RELEASE-medium.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 16 — Stage I: Advanced Edition Apps

The Advanced edition's extra BLFS packages: **SANE** (scanners), **FontForge** (fonts and symbols), **Graphviz** (relationship and story diagrams), **cdrdao** and **libisoburn** (disc mastering), and **FUSE 3** (for AppImage apps in 16.1).

**6 packages, in build order:** SANE-1.4.0, Libspiro-20220722, FontForge-20251009, Libao-1.2.0, Cdrdao-1.2.6, libisoburn-1.5.8.pl02.

### SANE-1.4.0

*BLFS 13.1 · ID `sane` · Stage I* · *Build time:* 0.4 SBU (Using parallelism=4; add 0.1 SBU for tests) · *Disk space:* 214 MB (Add 58 MB for tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://anduin.linuxfromscratch.org/BLFS/sane/sane-backends-1.4.0.tar.gz
```

MD5 sum of `sane-backends-1.4.0.tar.gz`: `fddb8b164ff1b1ffb576c9ba4173610d` (check with `md5sum sane-backends-1.4.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf sane-backends-1.4.0.tar.gz
cd "$(tar -tf sane-backends-1.4.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — The SANE daemon should run with its own group. Create this group by issuing the following command as the root user:

```bash
groupadd -g 70 scanner
```

> **Side note (BLFS):** configure assumes that the user building SANE Backends is a member of the scanner group for testing the existence of this group. As a result, the user building the package needs to be added to the scanner group. Add the user to the scanner group by issuing the following command as the root user: After adding the scanner group as above, you will need to log out and back in to activate it.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* configure assumes that the user building SANE Backends is a member of the scanner group for testing the existence of this group. As a result, the user building the package needs to be added to the scanner group. Add the user to the scanner group by issuing…

```bash
usermod -G scanner -a username
```

**[BUILDER]** — For a USB scanner, if you are linking to libusb-1.0.30, include the configure switch --enable-libusb_1_0. Install SANE Backends by running the following commands:

```bash
sg scanner -c "                                 \
PYTHON=python3 ./configure --prefix=/usr        \
                           --sysconfdir=/etc    \
                           --localstatedir=/var \
                           --with-lockdir=/run/lock \
                           --docdir=/usr/share/doc/sane-backends-1.4.0" &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install                                         &&
install -m 644 -v tools/udev/libsane.rules           \
                  /etc/udev/rules.d/65-scanner.rules &&
mkdir -p          /run/lock/sane &&
chgrp -v scanner  /run/lock/sane
```

**Configure:**

> **Side note (BLFS):** If you plan on using the scanner client Simple-scan-50.0 to access a networked scanner such as an "All-in-One" printer/scanner, there may be no configuration necessary. Try that first.

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you want to access a network scanner, include two lines in net.conf, as the root user (make sure to replace <server_ip> by the actual value):

```bash
cat >> /etc/sane.d/net.conf << "EOF"
connect_timeout = 60
<server_ip>
EOF
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf sane-backends-1.4.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Libspiro-20220722

*BLFS 13.1 · ID `libspiro` · Stage I* · *Build time:* 0.1 SBU · *Disk space:* 5.1 MB (add 1.3 MB if running the tests)

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/fontforge/libspiro/releases/download/20220722/libspiro-dist-20220722.tar.gz
```

MD5 sum of `libspiro-dist-20220722.tar.gz`: `c21f86e6c1ad65ed4cb1f754f6d7563c` (check with `md5sum libspiro-dist-20220722.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libspiro-dist-20220722.tar.gz
cd "$(tar -tf libspiro-dist-20220722.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libspiro by running the following commands:

```bash
./configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libspiro-dist-20220722.tar.gz | head -1 | cut -d/ -f1)"
```


### FontForge-20251009

*BLFS 13.1 · ID `fontforge` · Stage I* · *Build time:* 0.4 SBU (with parallelism=4, add 0.1 SBU for the tests) · *Disk space:* 170 MB (add 51 MB for the tests)

**Requires:** `gtkmm3`, `libspiro`, `libxml2`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://github.com/fontforge/fontforge/releases/download/20251009/fontforge-20251009.tar.xz
```

MD5 sum of `fontforge-20251009.tar.xz`: `9407db5126f937618f1f5f1f9ee8aab2` (check with `md5sum fontforge-20251009.tar.xz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf fontforge-20251009.tar.xz
cd "$(tar -tf fontforge-20251009.tar.xz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install FontForge by running the following commands:

```bash
mkdir build &&
cd    build &&

cmake -D CMAKE_INSTALL_PREFIX=/usr \
      -D CMAKE_BUILD_TYPE=Release  \
      -W no-author .. &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have installed sphinx-build, HTML documentation was built and installed in /usr/share/doc/fontforge. To be able to access it as a versioned directory, create a symlink as the root user:

```bash
ln -sv fontforge /usr/share/doc/fontforge-20251009
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf fontforge-20251009.tar.xz | head -1 | cut -d/ -f1)"
```


### Libao-1.2.0

*BLFS 13.1 · ID `libao` · Stage I* · *Build time:* less than 0.1 SBU · *Disk space:* 3.9 MB

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.xiph.org/releases/ao/libao-1.2.0.tar.gz
```

MD5 sum of `libao-1.2.0.tar.gz`: `9f5dd20d7e95fd0dd72df5353829f097` (check with `md5sum libao-1.2.0.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libao-1.2.0.tar.gz
cd "$(tar -tf libao-1.2.0.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — First, fix a gcc-14 issue:

```bash
sed -i '/limits.h/a #include <time.h>' src/plugins/pulse/ao_pulse.c
```

**[BUILDER]** — Install libao by running the following commands:

```bash
./configure --prefix=/usr &&
make
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m644 README /usr/share/doc/libao-1.2.0
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libao-1.2.0.tar.gz | head -1 | cut -d/ -f1)"
```


### Cdrdao-1.2.6

*BLFS 13.1 · ID `cdrdao` · Stage I* · *Build time:* 0.3 SBU (Using parallelism-4) · *Disk space:* 88 MB

**Recommended (included):** `gtkmm3`, `libao`, `libvorbis`, `libmad`, `lame`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://downloads.sourceforge.net/cdrdao/cdrdao-1.2.6.tar.bz2
```

MD5 sum of `cdrdao-1.2.6.tar.bz2`: `f59689d847d56647187d4de487e3487d` (check with `md5sum cdrdao-1.2.6.tar.bz2`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf cdrdao-1.2.6.tar.bz2
cd "$(tar -tf cdrdao-1.2.6.tar.bz2 | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install Cdrdao by running the following commands:

```bash
./configure --prefix=/usr --mandir=/usr/share/man &&
make CC="gcc -std=gnu17"
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install &&
install -v -m755 -d /usr/share/doc/cdrdao-1.2.6 &&
install -v -m644 README /usr/share/doc/cdrdao-1.2.6
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf cdrdao-1.2.6.tar.bz2 | head -1 | cut -d/ -f1)"
```


### libisoburn-1.5.8.pl02

*BLFS 13.1 · ID `libisoburn` · Stage I* · *Build time:* 0.2 SBU (with Tk and HTML documentation) · *Disk space:* 17 MB (with Tk and HTML documentation)

**Requires:** `libburn`, `libisofs`

**[BUILDER]** — Download:

```bash
cd ~/src
wget https://files.libburnia-project.org/releases/libisoburn-1.5.8.pl02.tar.gz
```

MD5 sum of `libisoburn-1.5.8.pl02.tar.gz`: `008b9adc9ab3545e167495220b453413` (check with `md5sum libisoburn-1.5.8.pl02.tar.gz`).

**[BUILDER]** — Unpack (the folder name is read from the tarball):

```bash
cd ~/src && tar -xf libisoburn-1.5.8.pl02.tar.gz
cd "$(tar -tf libisoburn-1.5.8.pl02.tar.gz | head -1 | cut -d/ -f1)" && pwd
```

**Build and install:**

**[BUILDER]** — Install libisoburn by running the following commands:

```bash
./configure --prefix=/usr              \
            --disable-static           \
            --enable-pkg-check-modules &&
make
```

**[BUILDER]** — *(Optional — skip if unsure)* If you have installed Doxygen and wish to generate the HTML documentation, issue the following command:

```bash
doxygen doc/doxygen.conf
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — Now, as the root user:

```bash
make install
```

**[IPRPS CHROOT]** *(root; same folder as BUILDER)* — *(Optional — skip if unsure)* If you have built the HTML documentation, install it by running the following commands as the root user:

```bash
install -v -dm755 /usr/share/doc/libisoburn-1.5.8.pl02 &&
install -v -m644 doc/html/* /usr/share/doc/libisoburn-1.5.8.pl02
```

**[BUILDER]** — Clean up:

```bash
cd ~/src && rm -rf "$(tar -tf libisoburn-1.5.8.pl02.tar.gz | head -1 | cut -d/ -f1)"
```



### 16.1 Creative apps from upstream (not in BLFS)

These popular creative tools aren't in BLFS 13.1. Ship them as their projects' **official portable Linux builds**, installed under `/opt/<app>/` with a menu launcher:

| App | Purpose | Official Linux download format | Notes |
|---|---|---|---|
| Krita | Digital painting, maps, character art | AppImage | Tablet support via `HID_WACOM` (in the kernel config) |
| Blender | 3D models, props, scenes, animation | Tarball | Uses Mesa (OpenGL/Vulkan) |
| Audacity | Recording and editing audio | AppImage | Narration, sound effects |
| Shotcut | Video editing | AppImage or tarball | Trailers, recaps |
| Kdenlive | Video editing | AppImage | Heavier than Shotcut |
| LMMS | Music composition | AppImage | Soundtracks |
| Scribus | Print layout | AppImage | Rulebooks, character sheets |
| Calibre | E-books | Official installer/tarball | Campaign books as EPUB |
| Pandoc | Document conversion | Tarball (single binary) | Markdown to DOCX/EPUB/PDF |

> **Warning:** Before each release, download the current version from each project's official site, check its published checksum or signature, and **test that it starts** on the IPRPS image. AppImages need FUSE (`fuse3` is in the build). If an AppImage complains about FUSE, run it with `--appimage-extract` once and use the extracted `AppRun` instead. Check each app's license allows redistribution; for GPL apps, also link to their source.

Install the Advanced IPRPS apps (12.4).

> **Checkpoint:** Take snapshot **`RELEASE-advanced`**, then release it as in Part 14: `/root/iprps-release-clean.sh advanced`, `/root/iprps-release-pack.sh advanced` → `iprps-os-1.0-advanced.img.xz`.

**[DEBIAN ROOT]** — snapshot `RELEASE-advanced`. First stop any test VM (`poweroff`) and `exit` every chroot window:

```bash
pgrep -a qemu || echo "No QEMU running"
bash /root/iprps-leave.sh
df -h / && du -h /root/iprps-system.img
mkdir -p /root/snapshots
cp -v --sparse=always /root/iprps-system.img /root/snapshots/iprps-RELEASE-advanced.img && echo "SNAPSHOT COMPLETE"
ls -l /root/snapshots/iprps-RELEASE-advanced.img     # must show 42949672960 bytes
```

Then re-enter the IPRPS CHROOT and BUILDER windows (0.5). Details and restoring: 0.4.

---

## Part 17 — After Release: Updates and Users

- **Users tailor their own systems.** They have `sudo`, a compiler and the full build toolchain, so they can follow BLFS for anything else they want.
- **Security updates** are your job as the distributor. Watch https://www.linuxfromscratch.org/blfs/advisories/, rebuild affected packages in the build image (WSL chroot), and publish updated images (1.0.1, 1.0.2, ...).
- **Package management** comes later. Until then, each release is a complete image. The image snapshots (0.4) make rebuilding any edition repeatable.

---

## Part 18 — Future Releases

### 18.1 Local AI (planning only)

A later IPRPS release will add a local AI assistant for Session Masters: NPC dialogue, encounter ideas, recaps, all without internet or API keys. Plan for it now, without building anything yet:

| Planning item | Recommendation |
|---|---|
| Edition | Advanced only, at first |
| Hardware | 16 GB RAM minimum for small models; a supported GPU speeds it up greatly |
| Storage | Models are several GB each. Keep them in `/opt/iprps-ai/models`, downloaded on demand rather than shipped in the image |
| Integration | A local web API on `127.0.0.1` only, which the Hub and other IPRPS apps call like any other service |
| Database | The `session_log` and `sheet_json` data already give an assistant the campaign context it needs |
| Privacy | Everything stays on the computer, which is a strong selling point for player data |

### 18.2 A live/installer ISO

A hybrid ISO that boots read-only from USB or DVD, lets people try IPRPS without changing their computer, and installs it from there. What it takes:

| Piece | How |
|---|---|
| Compressed root filesystem | `mksquashfs` of the cleaned release image (Debian's `squashfs-tools`, run in WSL) |
| Live boot | An initramfs `init` that finds the ISO by label, mounts the squashfs read-only, adds a RAM overlay (`overlayfs`), then switches to it |
| Bootable ISO for UEFI and BIOS | `grub-mkrescue` with `xorriso` and `mtools` (Debian packages, in WSL) |
| Installer | `iprps-install` (13.3), copying from the live system |

This is planned for IPRPS 1.1. The 1.0 images already run directly from a USB stick and install from there.

---

## Appendix A — Resuming Work

1. **[WINDOWS POWERSHELL]** Open Debian (`wsl -d Debian`), and start or attach tmux: `tmux attach -t iprps` or `tmux new -s iprps`.
2. **DEBIAN ROOT** window: `sudo -i`.
3. **IPRPS CHROOT** window: `sudo -i`, then `bash /root/iprps-enter.sh`.
4. **BUILDER** window: `sudo -i`, `bash /root/iprps-enter.sh`, then `su - builder`.
5. In BUILDER: `echo $XORG_PREFIX $MAKEFLAGS` must show `/usr` and your jobs setting.
6. Continue from the first unchecked package. If unsure whether the last package finished, delete its folder in `~/src` and rebuild it from the start.
7. Before shutting down: `exit` in BUILDER and IPRPS CHROOT until they're back at Debian, then in DEBIAN ROOT: `bash /root/iprps-leave.sh`. Never run `wsl --shutdown` with the image mounted.

## Appendix B — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| A build is "Killed", or WSL becomes unresponsive | Out of memory | Fewer jobs (0.3); for LLVM, `-D LLVM_PARALLEL_LINK_JOBS=1`; raise `memory=` in `.wslconfig` |
| "No space left on device" | `/build` or the image is full | `df -h / /build`; delete finished build folders in `~/src`; the image itself is 40 GB |
| Downloads fail inside the chroot | No `/etc/resolv.conf` | Re-enter with `iprps-enter.sh`, which copies it in |
| `apt: command not found` | You're inside the chroot (IPRPS has no apt) | `exit` to Debian, then run `apt` |
| `iprps-leave.sh` says "Still in use" | A chroot window or shell is still inside the image | `exit` in every chroot window, `cd /` in Debian, run it again |
| QEMU: "gtk initialization failed" | No window support in your WSL | Use Hyper-V, or QEMU with `-display none -vnc 127.0.0.1:0` (1.4) |
| GRUB: "attempt to read or write outside of disk" | The test copy is incomplete | Copy again and wait for `COPY COMPLETE`; `ls -l` must show 42949672960 bytes |
| Boot stops: "device /dev/disk/by-uuid/... does not exist" (initramfs shell), **real PC from USB** | USB core missing from the initramfs (no USB at all; the keyboard is dead too), or the stick appeared after the initramfs looked | 4.9 "wait for USB drives", then `mkinitramfs` again. Right now: `ls /dev/disk/by-uuid/` until the UUID appears, then `exit`; or add `rootdelay=10` to the `linux` line in GRUB (`e`, then Ctrl+X) |
| The keyboard doesn't work in the initramfs shell (USB keyboard) | USB core or keyboard driver missing from the initramfs | 4.9 "USB in the initramfs", then `mkinitramfs` again and remake the release |
| Boot stops: "device /dev/disk/by-uuid/... does not exist" (initramfs shell) | Storage driver not loaded in the initramfs | 4.9 storage-driver fix, then `mkinitramfs` again. Right now: `modprobe virtio_pci virtio_blk` (QEMU) and `exit` |
| Emergency mode: "Timed out waiting for device /dev/87E8-..." or "Duplicate entry in /etc/fstab" | Old fstab from the USB build | Write the clean two-line fstab (1.2) |
| Boot waits 90 s: "Timed out waiting for device ... wlan0" | `wpa_supplicant@wlan0` enabled | `systemctl disable wpa_supplicant@wlan0.service` (NetworkManager handles Wi-Fi) |
| Blank screen; Xorg log: "open /dev/dri/card0: No such file", "no screens found" | No DRM device (GPU driver failed, no SimpleDRM) | Kernel with `DRM_SIMPLEDRM=y` (4.4); in QEMU, `-vga std` as a quick test |
| Pointer on a black screen; greeter log: "Unsupported image format" for an `.svg` | SVG loading broken | glycin pass 2 (Stage E); gdk-pixbuf must link `libglycin-2` |
| Login screen rejects the password; journal shows "session opened ... closed" a second later | The session exits at once, not a wrong password | `/usr/bin/lightdm-session` missing: copy it from LightDM's `tests/src/` (Stage E) |
| `make install-<name>`: "No rule to make target" for a service | It's a BLFS systemd unit | Run it in `/build/src/blfs-systemd-units-20251204` |
| The chroot doesn't see files Debian put in `/build/src` | `/build` isn't connected in this chroot session | `findmnt /mnt/iprps/build` (DEBIAN ROOT); copy to `/mnt/iprps/build/src/` for now, re-enter the chroot to reconnect |
| `make install` as root starts compiling (`g++ -o ...`) | The BUILDER build didn't finish | Ctrl+C, `chown -R builder:builder <folder>`, finish `make` in BUILDER |
| `make install` / `cmake --install`: "Permission denied", "Maybe need administrative privileges" | Installed from the BUILDER window | Run it in IPRPS CHROOT, in the same folder |
| A server started in the chroot (`mariadbd-safe ... &`) | Background process: the prompt returns at once | Press Enter; stop it (`mariadb-admin -u root shutdown`) before leaving the chroot |
| Icon theme count is 36 instead of about 60 | The 24 icons weren't in `/usr/share/iprps/icons` | Install them (9.2), `rm -rf /usr/share/icons/IPRPS`, run 9.3's block again |
| `ERROR 2002 … Can't connect to local server through socket` right after `mariadbd-safe … &` | The server wasn't ready yet | Wait for it: `until mariadb-admin -u root ping >/dev/null 2>&1; do sleep 1; done`, then rerun what failed |
| `ERROR 1045 … Access denied for user 'iprps'@'localhost'` | The `iprps` user wasn't created (or another password) | Rerun 12.5 step 6's `CREATE USER … ALTER USER … GRANT` with the password from `/root/iprps-dev-db.txt` |
| Web apps show only the IPRPS login, or "Sign in required" | Normal: the Universal Login is working | Register at `/iprps/auth/login.html`; apps then let you in |
| A web app says it can't reach its database | Placeholder not filled in, or MariaDB not running | `grep -rl '@IPRPS_DB_PASS@' /srv/www/iprps`; `systemctl status mariadb php-fpm` |
| `wget` → 404 Not Found | The download moved | Check the newest BLFS development book for the current address, or Debian's archive copy (`deb.debian.org/debian/pool/main/...`) with the same MD5 |
| git.kernel.org → 400 Bad Request | Snapshot downloads are blocked | Use cdn.kernel.org release tarballs (4.7) |
| `configure` stops; then `make install`: "No rule to make target 'install'" | A required dependency is missing, so no Makefile was created | Read the end of the `configure` output for the missing package; build it first |
| GRUB: "file `/boot/vmlinuz-...` not found" | `grub.cfg` names a kernel file that doesn't exist | Compare `ls /boot/vmlinuz-*` with `grep 'linux ' /boot/grub/grub.cfg` and fix the name (1.2) |
| `configure` can't find a library you built | Wrong order, or the earlier install failed | Check the earlier package's `make install` finished without errors; `pkg-config --modversion <name>` |
| A Python module install says "No matching distribution" | The `pip3 wheel` build step failed or ran in the wrong folder | Rerun it inside the package folder; check `ls dist` |
| `$XORG_CONFIG` empty in IPRPS CHROOT or BUILDER | The shell didn't load the profile files | Leave the window and re-enter (Appendix A); check `ls /etc/profile.d/xorg.sh` |
| `su: must be run from a terminal` (in BUILDER) | `su` doesn't work inside BUILDER | Run root steps in the **IPRPS CHROOT** window (0.5) |
| Generic kernel: "VFS: Unable to mount root fs" | initramfs missing or for another kernel | `mkinitramfs 7.1.8-iprps` in `/boot`; check the `initrd` line in `grub.cfg` |
| Black screen on a real PC | Graphics driver or firmware issue | Choose **IPRPS OS (safe graphics)** in GRUB; check `dmesg` for firmware errors |
| Wi-Fi missing on a real PC | Firmware not loaded | `dmesg \| grep -i firmware`; the file should be under `/usr/lib/firmware` |
| The Oracle says "The local AI service (Ollama) is not running" | Service stopped or failed | `systemctl status ollama`; `journalctl -u ollama -b` |
| The Oracle says no model is installed, or `iprps-storyteller` is missing | Step 6 skipped, or the models aren't owned by `ollama` | `sudo iprps-ai-model status`; `chown -R ollama:ollama /var/lib/ollama`; `sudo iprps-ai-model reset` |
| Oracle answers appear all at once instead of word by word | 10.1's PHP rule (`flushpackets`) missing | `cat /etc/httpd/extra/iprps-php.conf` (10.1); `ls -A /srv/www/iprps/oracle/.user.ini` |
| Oracle answers are very slow | No usable GPU, or too little free memory | `sudo iprps-ai-model status` (compute device); close other programs; 8 GB is the minimum |
| First boot: "database could not be created", apps can't log in | MariaDB's first start was slower than `iprps-db-init` waited (slow USB stick) | Fixed in 13.1 (waits up to 3 minutes). On an affected computer: `sudo systemctl restart iprps-db-init`, or reboot (it runs again until it succeeds) |
| Saving Wi-Fi (or another admin task) asks for a password and rejects it | polkit asks for **root's** password, and root is locked | 13.2 polkit rule (`/etc/polkit-1/rules.d/10-iprps.rules`); users then type their own password, and Wi-Fi needs none |
| IPRPS Table: players' phones can't open `http://<address>:7777/` | The table isn't open; the phone is on another network (mobile data, guest Wi-Fi with client isolation); a firewall blocks TCP 7777 | Click **Open the table**; put the phone on the same Wi-Fi as the Session Master's computer (turn off mobile data to check), or use a phone hotspot for everyone; allow TCP 7777 (12.7) |
| IPRPS Table: "The Session Master console only opens on the Session Master's computer" | The console was opened from another device, or with the computer's network address instead of `localhost` | Open it from the menu (**IPRPS Table**) or at `http://localhost:7777/sm/` on the IPRPS OS computer |
| IPRPS Table: the Hub tile says the service isn't running | `iprps-table.service` is stopped or failed | `systemctl status iprps-table` and `journalctl -u iprps-table -b`; check `node --version` and that `/opt/iprps/table/server.js` exists, then `sudo systemctl restart iprps-table` (12.7) |
| IPRPS Table: "That join code is not right" | A new code was made, or a typo | Read the code in the console (letters and numbers, no O/0 or I/1 confusion); scanning the QR code fills it in |
| IPRPS Table: no music on a phone | Phones block sound until the page is touched once | Tap **Tap to turn on the table sound**; check the phone's volume |
| Session Master Mode: closing the browser leaves a white full-screen page | The full-screen player display stayed open on a single screen (and in Lite no display page exists yet) | 12.2 `iprps-session` update (full screen only with two screens); right now press **Alt+F4** |
| Everything is slow when running from a USB stick | USB 2 sticks (and ports) have very slow small reads and writes | Use a USB 3 stick in a USB 3 (often blue) port, or install to the internal disk; the first boot is the slowest (disk growth, swap, database) |
| Boot shows many "Failed to preset all unit … Read-only file system" lines | The release image's `/etc/machine-id` said `uninitialized` (first boot), so systemd tried to reset all services | 13.4: the release script now leaves it **empty**. On an affected image it's harmless (the reset failed); new releases don't show it |
| "Driver 'pcspkr' is already registered, aborting" at boot | Two PC-speaker drivers | Harmless; 4.9 blacklists them (`/etc/modprobe.d/iprps-blacklist.conf`) |
| Advanced Network Configuration doesn't list Wi-Fi networks | NetworkManager's editor can't scan | 9.9: **Wi-Fi and Network Connections** opens the scanning window |
| Wi-Fi menu greyed out; log shows "Failed to D-Bus activate wpa_supplicant service"; `wpa_supplicant -u` prints its help | wpa_supplicant built **without** D-Bus support, or its D-Bus files not installed | Rebuild wpa_supplicant with the three `CONFIG_CTRL_IFACE_DBUS…` lines and install the `dbus/` files (both **required** for IPRPS), then `systemctl restart NetworkManager` |
| First boot: "iprps-core.sql: No such file or directory" (iprps-db-init) | The core schema wasn't saved (10.2), usually because `/usr/share/iprps/schema` didn't exist | Run 10.2 again (it creates the folder now), then `systemctl restart iprps-db-init` |
| An app (the Hub, Writer, the Oracle) shows only **"File not found."** | Its start page is `index.html`, and Apache sent the request for `index.php` to PHP without checking it exists (BLFS's `ProxyPassMatch`) | 10.1 "only real `.php` files go to PHP", then `systemctl restart httpd` |
| `http://localhost/iprps/` doesn't load | Apache or PHP-FPM stopped | `systemctl status httpd php-fpm`; `journalctl -u httpd -u php-fpm` |
| PHP can't reach MariaDB | Socket path mismatch, or `php-fpm` stopped | `grep default_socket /etc/php.ini` must show `/run/mariadb/mariadb.sock`; `systemctl status php-fpm mariadb` |
| First-boot setup screen doesn't appear | Setup already marked done | Remove `/var/lib/iprps/setup-done` on the image before release (13.4 does this) |

## Appendix C — Useful Commands

Quick reference for moving files around, testing in QEMU, and customizing icons. `<you>` is your Windows user name (the folder under `C:\Users`); replace it, angle brackets included.

### C.1 Windows ↔ Debian (WSL)

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

### C.2 Debian ↔ the build image (chroot)

Debian's `/build` is connected into the chroot by `iprps-enter.sh`, so **`/build/src` is the same folder on both sides** (and `~/src` for BUILDER). Put files there from Debian, then use them in IPRPS CHROOT or BUILDER.

**[DEBIAN ROOT]**

```bash
findmnt /mnt/iprps/build || echo "build is NOT connected"
ls /mnt/iprps/build/src | head        # what the chroot sees in /build/src
cp -v /some/file /mnt/iprps/root/      # copy straight into the image (any path under /mnt/iprps)
```

If `/build` isn't connected, copy into `/mnt/iprps/build/src/` instead, and reconnect next session (leave the chroot, `iprps-leave.sh`, `iprps-enter.sh`).

### C.3 The local Git repository

The repository lives on the G: drive (`/mnt/g/IPRPS/iprps-os`).

**[DEBIAN ROOT]**

```bash
cd /mnt/g/IPRPS/iprps-os
cp -v /mnt/c/Users/<you>/Downloads/iprps-icons/*.png artwork/icons/
ls artwork/icons/*.png | wc -l        # 24
git status
git add -A && git commit -m "Add the IPRPS icons" && git push
```

### C.4 Debian ↔ a running test VM (SSH)

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

### C.5 QEMU and RealVNC

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

### C.6 Custom icons: changing icons on an installed IPRPS OS

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

## Appendix D — Kernel Options Required by BLFS Packages

| Option | Needed by |
|---|---|
| `ASYMMETRIC_KEY_TYPE` | keyutils-1.6.3 |
| `ASYMMETRIC_PUBLIC_KEY_SUBTYPE` | keyutils-1.6.3 |
| `AUDIT` | Linux-PAM-1.7.2 |
| `BIG_KEYS` | keyutils-1.6.3 |
| `BLK_DEV` | LVM2-2.03.42 |
| `BLK_DEV_DM` | cryptsetup-2.8.7, LVM2-2.03.42 |
| `BLK_DEV_RAM` | LVM2-2.03.42 |
| `BONDING` | NetworkManager-1.58.1 |
| `BT` | BlueZ-5.87 |
| `BT_BNEP` | BlueZ-5.87 |
| `BT_BNEP_MC_FILTER` | BlueZ-5.87 |
| `BT_BNEP_PROTO_FILTER` | BlueZ-5.87 |
| `BT_BREDR` | BlueZ-5.87 |
| `BT_HCIBTSDIO` | BlueZ-5.87 |
| `BT_HCIBTUSB` | BlueZ-5.87 |
| `BT_HCIUART` | BlueZ-5.87 |
| `BT_HIDP` | BlueZ-5.87 |
| `BT_RFCOMM` | BlueZ-5.87 |
| `BT_RFCOMM_TTY` | BlueZ-5.87 |
| `CRYPTO` | BlueZ-5.87, cryptsetup-2.8.7, keyutils-1.6.3 |
| `CRYPTO_AES` | BlueZ-5.87, cryptsetup-2.8.7 |
| `CRYPTO_CCM` | BlueZ-5.87 |
| `CRYPTO_CMAC` | BlueZ-5.87 |
| `CRYPTO_RSA` | keyutils-1.6.3 |
| `CRYPTO_SHA1` | keyutils-1.6.3 |
| `CRYPTO_SHA256` | cryptsetup-2.8.7 |
| `CRYPTO_TWOFISH` | cryptsetup-2.8.7 |
| `CRYPTO_USER` | BlueZ-5.87 |
| `CRYPTO_USER_API_AEAD` | BlueZ-5.87 |
| `CRYPTO_USER_API_HASH` | BlueZ-5.87 |
| `CRYPTO_USER_API_SKCIPHER` | BlueZ-5.87, cryptsetup-2.8.7 |
| `CRYPTO_XTS` | cryptsetup-2.8.7 |
| `CUSE` | Fuse-3.18.2 |
| `DM_CACHE` | LVM2-2.03.42 |
| `DM_CRYPT` | cryptsetup-2.8.7, LVM2-2.03.42 |
| `DM_DELAY` | LVM2-2.03.42 |
| `DM_MIRROR` | LVM2-2.03.42 |
| `DM_SNAPSHOT` | LVM2-2.03.42 |
| `DM_THIN_PROVISIONING` | LVM2-2.03.42 |
| `DM_ZERO` | LVM2-2.03.42 |
| `DRM` | intel-media-driver-26.2.4, Mesa-26.1.7, Xorg-Server-21.1.24 |
| `DRM_AMDGPU` | Mesa-26.1.7 |
| `DRM_AMDGPU_CIK` | Mesa-26.1.7 |
| `DRM_AMDGPU_SI` | Mesa-26.1.7 |
| `DRM_AMD_DC` | Mesa-26.1.7 |
| `DRM_BOCHS` | Xorg-Server-21.1.24 |
| `DRM_I915` | intel-media-driver-26.2.4, Mesa-26.1.7 |
| `DRM_NOUVEAU` | Mesa-26.1.7 |
| `DRM_RADEON` | Mesa-26.1.7 |
| `DRM_SIMPLEDRM` | Xorg-Server-21.1.24 |
| `DRM_VBOXVIDEO` | Xorg-Server-21.1.24 |
| `DRM_VGEM` | Mesa-26.1.7 |
| `DRM_VMWGFX` | Mesa-26.1.7, Xorg-Server-21.1.24 |
| `DRM_XE` | intel-media-driver-26.2.4, Mesa-26.1.7 |
| `DRM_XE_DISPLAY` | Mesa-26.1.7 |
| `DRM_XE_FORCE_PROBE` | intel-media-driver-26.2.4, Mesa-26.1.7 |
| `DUMMY` | NetworkManager-1.58.1 |
| `EVENTFD` | BlueZ-5.87 |
| `EXPERT` | BlueZ-5.87 |
| `FUSE_FS` | Fuse-3.18.2 |
| `HID` | Xorg Input Drivers |
| `HID_SUPPORT` | Xorg Input Drivers |
| `HID_WACOM` | Xorg Input Drivers |
| `INET` | NetworkManager-1.58.1 |
| `INPUT` | libevdev 1.13.6, libinput-1.31.3, Xorg Input Drivers |
| `INPUT_EVDEV` | libevdev 1.13.6, Xorg Input Drivers |
| `INPUT_MISC` | libevdev 1.13.6, libinput-1.31.3, Xorg Input Drivers |
| `INPUT_UINPUT` | libevdev 1.13.6, libinput-1.31.3, Xorg Input Drivers |
| `IPV6` | NetworkManager-1.58.1 |
| `IPV6_GRE` | NetworkManager-1.58.1 |
| `IPV6_MULTIPLE_TABLES` | NetworkManager-1.58.1 |
| `IPV6_SIT` | NetworkManager-1.58.1 |
| `IPVLAN` | NetworkManager-1.58.1 |
| `IP_NF_IPTABLES` | iptables-1.8.13 |
| `IP_NF_NAT` | iptables-1.8.13 |
| `KEYS` | keyutils-1.6.3 |
| `KEY_DH_OPERATIONS` | keyutils-1.6.3 |
| `MACVLAN` | NetworkManager-1.58.1 |
| `MACVTAP` | NetworkManager-1.58.1 |
| `MAGIC_SYSRQ` | LVM2-2.03.42 |
| `MD` | cryptsetup-2.8.7, LVM2-2.03.42 |
| `MPTCP` | NetworkManager-1.58.1 |
| `MPTCP_IPV6` | NetworkManager-1.58.1 |
| `MSDOS_FS` | dosfstools-4.2 |
| `NAMESPACES` | Bubblewrap-0.11.2, Polkit-127, UPower-1.91.3 |
| `NET` | NetworkManager-1.58.1, BlueZ-5.87, iptables-1.8.13 |
| `NETDEVICES` | NetworkManager-1.58.1 |
| `NETFILTER` | iptables-1.8.13 |
| `NETFILTER_ADVANCED` | iptables-1.8.13 |
| `NETFILTER_XTABLES` | iptables-1.8.13 |
| `NETFILTER_XTABLES_LEGACY` | iptables-1.8.13 |
| `NETFILTER_XT_TARGET_LOG` | iptables-1.8.13 |
| `NET_CORE` | NetworkManager-1.58.1 |
| `NET_IPGRE` | NetworkManager-1.58.1 |
| `NET_IPGRE_DEMUX` | NetworkManager-1.58.1 |
| `NET_IPIP` | NetworkManager-1.58.1 |
| `NET_SCHED` | NetworkManager-1.58.1 |
| `NET_SCH_FQ_CODEL` | NetworkManager-1.58.1 |
| `NET_SCH_INGRESS` | NetworkManager-1.58.1 |
| `NET_SCH_SFQ` | NetworkManager-1.58.1 |
| `NET_SCH_TBF` | NetworkManager-1.58.1 |
| `NET_TEAM` | NetworkManager-1.58.1 |
| `NET_VRF` | NetworkManager-1.58.1 |
| `NF_CONNTRACK` | iptables-1.8.13 |
| `PARPORT` | Cups-2.4.19 |
| `PARPORT_PC` | Cups-2.4.19 |
| `POSIX_MQUEUE` | lsof-4.99.7 |
| `PRINTER` | Cups-2.4.19 |
| `RFKILL` | BlueZ-5.87 |
| `SCSI_DEBUG` | parted-3.7 |
| `SCSI_LOWLEVEL` | parted-3.7 |
| `SECONDARY_TRUSTED_KEYRING` | keyutils-1.6.3 |
| `SND` | alsa-lib-1.2.16.1 |
| `SOUND` | alsa-lib-1.2.16.1 |
| `SYSFB_SIMPLEFB` | Xorg-Server-21.1.24 |
| `SYSTEM_BLACKLIST_KEYRING` | keyutils-1.6.3 |
| `SYSTEM_TRUSTED_KEYRING` | keyutils-1.6.3 |
| `TIMERFD` | BlueZ-5.87 |
| `UDMABUF` | GTK-4.22.4 |
| `USB` | libusb-1.0.30, Xorg Input Drivers |
| `USB_EHCI_HCD` | libusb-1.0.30 |
| `USB_HID` | Xorg Input Drivers |
| `USB_OHCI_HCD` | libusb-1.0.30 |
| `USB_PCI` | libusb-1.0.30 |
| `USB_PRINTER` | Cups-2.4.19, Gutenprint-5.3.5 |
| `USB_SUPPORT` | Cups-2.4.19, Gutenprint-5.3.5, libusb-1.0.30, Xorg Input Drivers |
| `USB_XHCI_HCD` | libusb-1.0.30 |
| `USER_NS` | Bubblewrap-0.11.2, Polkit-127, UPower-1.91.3 |
| `VETH` | NetworkManager-1.58.1 |
| `VFAT_FS` | dosfstools-4.2 |
| `VLAN_8021Q` | NetworkManager-1.58.1 |
| `VXLAN` | NetworkManager-1.58.1 |
| `X509_CERTIFICATE_PARSER` | keyutils-1.6.3 |

## Appendix E — Package Lists by Edition

### Lite (312 BLFS packages, Stages A–G)

libtasn1-4.21.0, p11-kit-0.26.5, make-ca-1.16.1, libunistring-1.4.2, libidn2-2.3.8, libpsl-0.23.3, Wget-1.25.0, Linux-PAM-1.7.2, Sudo-1.9.17p2, icu-78.3, libxml2-2.15.3, nghttp2-1.70.0, cURL-8.21.0, libarchive-3.8.9, libuv-1.52.1, CMake-4.4.2, libssh2-1.11.1, LLVM-22.1.8, Rustc-1.97.1, Git-2.55.0, OpenSSH-10.5p1, cpio-2.15, Which-2.25 and Alternatives, Nano-9.2, Zip-3.0, dosfstools-4.2, libaio-0.3.113, LVM2-2.03.42, parted-3.7, efivar-39, Popt-1.19, efibootmgr-18, pciutils-3.15.0, libusb-1.0.30, usbutils-019, rsync-3.5.0, libtirpc-1.3.7, lsof-4.99.7, duktape-2.7.0, docutils-0.23, libxslt-1.1.45, GLib-2.88.3, Polkit-127, docbook-xml-4.5, CrackLib-2.10.3, docbook-xsl-nons-1.79.2, hwdata-0.410, libpwquality-1.4.5, shared-mime-info-2.5.1, Mako-1.4.1, Cython-3.2.9, libyaml-0.2.5, PyYAML-6.0.3, Cbindgen-0.29.4, SPIRV-Headers-1.4.357.0, SPIRV-Tools-1.4.357.0, glslang-16.5.0, libpng-1.6.58, FreeType-2.14.3, Fontconfig-2.18.3, util-macros-1.20.2, xorgproto-2025.1, libXau-1.0.12, libXdmcp-1.1.5, xcb-proto-1.17.0, libxcb-1.17.0, Xorg Libraries, Libdrm-2.4.134, rust-bindgen-0.72.1, SPIRV-LLVM-Translator-22.1.5, Vulkan-Headers-1.4.357.0, Wayland-1.26.0, Vulkan-Loader-1.4.357.0, Wayland-Protocols-1.49, Mesa-26.1.7, libepoxy-1.5.10, libxcvt-0.1.3, Pixman-0.46.4, xbitmaps-1.1.4, xcb-util-0.4.1, Xorg Applications, xcursor-themes-1.0.7, Xorg Fonts, Xorg-Server-21.1.24, XKeyboardConfig-2.48, mtdev-1.1.7, Xorg Input Drivers, xinit-1.4.4, Graphite2-1.3.14, harfBuzz-14.3.1, libva-2.24.1, luit-20250912, twm-1.0.13.1, xclock-1.2.1, xterm-411, alsa-lib-1.2.16.1, alsa-utils-1.2.16, alsa-plugins-1.2.12, Cairo-1.18.4, FriBidi-1.0.16, Pango-1.58.2, Graphviz-15.1.1, Vala-0.56.19, libical-4.0.5, BlueZ-5.87, CDParanoia-III-10.2, gstreamer-1.28.6, ISO Codes-4.20.1, libgudev-238, NASM-3.02, yasm-1.3.0, libjpeg-turbo-3.2.0, libogg-1.3.6, libvorbis-1.3.7, gst-plugins-base-1.28.6, FLAC-1.5.0, Opus-1.6.1, libsndfile-1.2.2, Class::Inspector-1.36, File::ShareDir::Install-0.14, File::ShareDir-1.118, XML::Parser-2.59, Speex-1.2.1, PulseAudio-17.0, SBC-2.2, GLU-9.0.3, v4l-utils-1.32.0, Pipewire-1.6.8, Lua-5.4.8, Wireplumber-0.5.15, iptables-1.8.13, libndp-1.9, slang-2.3.3, newt-0.52.25, NSPR-4.40, NSS-3.126, PyCairo-1.29.1, PyGObject-3.56.3, NetworkManager-1.58.1, libnl-3.12.0, wpa_supplicant-2.12, iw-6.17, at-spi2-core-2.60.6, Little CMS-2.19.1, libaom-3.14.1, libde265-1.1.1, x265-4.2, libheif-1.23.1, brotli-1.2.0, giflib-6.1.3, highway-1.4.0, libjxl-0.12.0, cargo-c-0.10.24, librsvg-2.62.3, libseccomp-2.6.1, glycin-2.1.5, gdk-pixbuf-2.44.7, libxkbcommon-1.13.2, GTK-3.24.52, startup-notification-0.12, libxfce4util-4.20.1, Xfconf-4.20.0, libxfce4ui-4.20.2, Exo-4.20.0, lxml-6.1.1, itstool-2.0.7, Pathspec-1.1.1, vcs_versioning-2.2.4, Setuptools_scm-10.1.2, Pluggy-1.6.0, Poetry-core-2.4.1, Tomlkit-0.15.1, Trove-Classifiers-2026.6.1.19, Hatchling-1.32.0, Pygments-2.20.0, GTK-Doc-1.36.1, Intltool-0.51.0, libgpg-error-1.61, libgcrypt-1.12.2, libxklavier-5.4, lightdm-1.33.1, desktop-file-utils-0.28, libwnck-43.3, libdisplay-info-0.4.0, xfce4-dev-tools-4.20.0, libxfce4windowing-4.20.7, json-c-0.19, AccountsService-26.27.3, polkit-gnome-0.105, XScreenSaver-6.15, xfce4-session-4.20.4, Garcon-4.20.0, xfce4-panel-4.20.8, libnotify-0.8.8, thunar-4.20.9, thunar-volman-4.20.0, tumbler-4.20.2, xfce4-appfinder-4.20.0, UPower-1.91.3, xfce4-power-manager-4.20.1, libcanberra-0.30, xfce4-settings-4.20.5, Xfdesktop-4.20.2, Xfwm4-4.20.0, fast_float-8.2.10, fmt-12.2.0, Nettle-4.0, GnuTLS-3.8.13, glslc from shaderc-2026.3, Graphene-1.10.8, libdvdread-7.1.1, libdvdnav-7.0.0, SoundTouch-2.4.1, SVT-AV1-4.2.0, gst-plugins-bad-1.28.6, GTK-4.22.4, simdutf-9.0.0, VTE-0.84.1, xfce4-terminal-1.2.0, Aspell-0.60.8.2, enchant-2.8.19, gspell-1.14.4, gtksourceview4-4.8.4, mousepad-0.7.0, libexif-0.6.26, ristretto-0.14.0, xfce4-notifyd-0.9.7, keybinder-3.0-0.3.2, xfce4-pulseaudio-plugin-0.5.1, xarchiver-0.5.4.27, libassuan-3.0.2, libksba-1.8.0, npth-1.8, lmdb-1.0.1, Cyrus SASL-2.1.28, OpenLDAP-2.7.0, pinentry-1.3.3, GnuPG-2.5.21, libsecret-0.21.7, Gcr-4.4.0.1, libcdio-2.1.0, gsettings-desktop-schemas-50.1, glib-networking-2.80.1, libsoup-3.6.6, cryptsetup-2.8.7, keyutils-1.6.3, libatasmart-0.19, libbytesize-2.12, libnvme-1.16.2, libblockdev-3.5.0, UDisks-2.11.2, Gvfs-1.60.2, Lynx-2.9.3, xmlto-0.0.29, xdg-utils-1.2.1, Xdg-user-dirs-0.20, adwaita-icon-theme-50.0, gnome-themes-extra-3.28, TTF and OTF fonts, libmbim-1.34.0, libqmi-1.38.0, ModemManager-1.24.2, Gcr-3.41.2, libnma-1.10.6, network-manager-applet-1.34.0, Bubblewrap-0.11.2, Fuse-3.18.2, hicolor-icon-theme-0.18, XML::Simple-2.25, icon-naming-utils-0.8.90, gnome-icon-theme-3.12.0, gnome-keyring-50.0, LAME-3.100, libvpx-1.16.0, mpg123-1.33.7, gst-plugins-good-1.28.6, json-glib-1.10.8, lxde-icon-theme-0.5.1, sound-theme-freedesktop-0.8, xdg-desktop-portal-1.22.1, xdg-desktop-portal-gtk-1.15.3, Apr-1.7.6, Apr-Util-1.6.5, Apache-2.4.68, PHP-8.5.9, libevent-2.1.13, MariaDB-12.3.3, dav1d-1.5.4, SDL3-3.4.14, sdl2-compat-2.32.70, tiff-4.7.2, libwebp-1.6.0, c-ares-1.34.8, Node.js-24.19.0, Firefox-153.2.0esr, libhandy-1.8.3, OpenJPEG-2.5.4, boost-1.92.0, Poppler-26.08.0, Evince-48.4, dbus-glib-0.114, utfcpp-4.1.1, Taglib-2.3.1, Parole-4.20.0, libass-0.17.5, x264-20250815, FFmpeg-9.0.1, Glad-2.0.8, libplacebo-7.360.1, luajit-20260213, Uchardet-0.0.8, mpv-0.41.0.

### Medium (Lite + 68 packages, Stage H)

CLucene-2.3.3.4, libgusb-0.4.9, Colord-1.4.8, Cups-2.4.19, GLM-1.0.3, libatomic_ops-7.10.0, Archive::Zip-1.68, LibreOffice-26.2.5, docbook-xsl-ns-1.79.2, libfyaml-0.9.6, libxmlb-0.3.29, AppStream-1.1.6, babl-0.1.128, gegl-0.4.70, inih-62, Exiv2-0.28.8, gexiv2-0.16.2, ghostscript-10.07.1, libmypaint-1.6.1, mypaint-brushes-2.0.2, Gimp-3.2.4, Double-conversion-3.4.0, GC-8.2.12, gsl-2.8, libsigc++-2.12.1, GLibmm-2.66.10, Atkmm-2.28.5, libcairomm-1.0 (cairomm-1.14.6), Pangomm-2.46.5, Gtkmm-3.24.11, Potrace-1.16, Inkscape-1.4.4, Liba52-0.8.0, libmad-0.15.1b, VLC-3.0.23, ImageMagick-7.1.2-13, Freeglut-3.8.0, MuPDF-1.26.12, pdfio-1.6.4, Qpdf-12.4.0, libcupsfilters-2.1.1, libppd-2.1.1, cups-filters-2.0.1, Gutenprint-5.3.5, libburn-1.5.8, libisofs-1.5.8.pl02, Xfburn-0.8.0, gmmlib-22.10.0, intel-media-driver-26.2.4, Msgpack-1.2.1, Charset-normalizer-3.4.7, Idna-3.18, Hatch_vcs-0.5.0, Urllib3-2.7.0, Requests-2.34.2, semantic_version-2.10.0, setuptools_rust-1.12.1, maturin-1.14.1, uv_build-0.11.24, cachecontrol-0.14.4, CSSSelect-1.5.0, Pyproject-Metadata-0.12.1, Meson_python-0.20.0, NumPy-2.5.2, Patchelf-0.19.1, pySerial-3.5, six-1.17.0, Scour-0.38.2.

### Advanced (Medium + 6 packages, Stage I, plus the upstream apps in 16.1)

SANE-1.4.0, Libspiro-20220722, FontForge-20251009, Libao-1.2.0, Cdrdao-1.2.6, libisoburn-1.5.8.pl02.


---

*Credits: Built with Linux From Scratch and Beyond Linux From Scratch 13.1 (https://www.linuxfromscratch.org/). BLFS commands are reproduced from the book under its MIT-licensed command terms; BLFS text is under a Creative Commons license. IPRPS design, scripts and explanations are original to this guide. "Linux" is a registered trademark of Linus Torvalds. Firefox is a trademark of the Mozilla Foundation; IPRPS ships an unbranded build. Medium and Advanced include ungoogled-chromium, an unbranded Chromium (BSD license), Ollama (MIT license) and the Qwen3.5 4B model (Apache-2.0, by the Qwen team).*
