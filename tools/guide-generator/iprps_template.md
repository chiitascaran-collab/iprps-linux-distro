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

{{stagetable}}

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

---

## Part 3 — Stage A: Foundations, Security and sudo

{{stage:A}}

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

BLFS lists kernel options for {{kernel-pkg-count}} of the packages in this build (Bluetooth, NetworkManager, PipeWire, CUPS, and others). This loop reports any that aren't enabled:

{{kernel-check}}

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

{{pkg:initramfs}}

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

---

## Part 5 — Stage B: Graphics Stack

{{stage:B}}

> **Checkpoint:** `glxinfo` isn't installed, so check Mesa with `ls /usr/lib/dri/ /usr/lib/gbm/ 2>/dev/null` and `pkg-config --modversion gl`. Take snapshot **`B-graphics`**.

---

## Part 6 — Stage C: Audio

{{stage:C}}

> **Side note:** PipeWire replaces the PulseAudio *daemon* while keeping PulseAudio's library, which Firefox and the Xfce volume plugin use. Each user's PipeWire starts automatically with their desktop session.

> **Checkpoint:** Take snapshot **`C-audio`**.

---

## Part 7 — Stage D: Networking, Wireless and Bluetooth

{{stage:D}}

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

---

## Part 8 — Stage E: The Desktop (Xfce and LightDM)

{{stage:E}}

Enable the graphical login, as root:

**[IPRPS CHROOT]**

```bash
systemctl enable lightdm.service
systemctl set-default graphical.target
```

> **Checkpoint:** Boot-test a copy (1.4). The LightDM login screen appears, and logging in as `builder` opens Xfce. Take snapshot **`E-desktop`**.

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

---

## Part 10 — Stage F: Web Server and Database

{{stage:F}}

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

---

## Part 11 — Stage G: Lite Edition Apps

{{stage:G}}

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

{{stage:H}}

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

---

## Part 16 — Stage I: Advanced Edition Apps

{{stage:I}}

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

{{kernel-table}}

## Appendix E — Package Lists by Edition

{{edition-lists}}

---

*Credits: Built with Linux From Scratch and Beyond Linux From Scratch 13.1 (https://www.linuxfromscratch.org/). BLFS commands are reproduced from the book under its MIT-licensed command terms; BLFS text is under a Creative Commons license. IPRPS design, scripts and explanations are original to this guide. "Linux" is a registered trademark of Linus Torvalds. Firefox is a trademark of the Mozilla Foundation; IPRPS ships an unbranded build. Medium and Advanced include ungoogled-chromium, an unbranded Chromium (BSD license), Ollama (MIT license) and the Qwen3.5 4B model (Apache-2.0, by the Qwen team).*
