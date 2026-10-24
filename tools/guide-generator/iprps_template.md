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
| A desktop customized for IPRPS | The **IPRPS Desktop**: Xfce with IPRPS branding, a Session Master menu, Session Master Mode and a player display |
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
| Web browser | Firefox (unbranded) | Same | Same |
| Campaign tools | IPRPS Session Master Hub, player display, dice, initiative, session log | + all Medium IPRPS apps | + all IPRPS apps |
| Audio | Parole (music and ambience); mpv plays ambience in Session Master Mode | + VLC | + upstream audio tools (Part 16) |
| Video | mpv | + VLC, FFmpeg tools | + upstream video tools |
| Images | Ristretto (viewer) | + GIMP, Inkscape, ImageMagick | + FontForge, Graphviz, upstream art tools |
| Documents | Evince (PDF), Mousepad (text) | + LibreOffice, printing (CUPS) | + scanning (SANE) |
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
for L in $(losetup -j /root/iprps-system.img | cut -d: -f1); do losetup -v -d "$L"; done
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

Enable anything reported that you need: `scripts/config --module NAME` for drivers, or `--enable NAME` for features. Then run `make olddefconfig` and the check again. Options that remain off after `olddefconfig` depend on something else being off, and some are only needed for test suites (for example `SCSI_DEBUG` and `DUMMY`), which is fine. Appendix C lists every option with the packages that need it.

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
sed -i '0,/udevadm settle/s//udevadm settle\nmodprobe -a -q virtio_pci virtio_blk virtio_scsi nvme ahci sd_mod usb_storage uas xhci_pci ehci_pci ohci_pci sdhci_pci sdhci_acpi mmc_block hv_vmbus hv_storvsc vmw_pvscsi ata_piix 2>\/dev\/null\nudevadm settle/' /usr/share/mkinitramfs/init.in
grep -n -A2 'udevadm settle' /usr/share/mkinitramfs/init.in | head -6
```

The last `grep` must show `udevadm settle`, then the `modprobe -a -q ...` line, then `udevadm settle` again.

**Create the initramfs** for the new kernel, as root. The kernel version name must match the folder in `/usr/lib/modules` (`ls /usr/lib/modules`):

**[IPRPS CHROOT]**

```bash
cd /boot
mkinitramfs 7.1.8-iprps
ls -lh /boot/initrd.img-7.1.8-iprps
```

It bundles the storage and filesystem modules, plus the Intel and AMD microcode at the front of the file.

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

> **Checkpoint:** Firefox opens and shows `http://localhost/` (Apache's test page), and Evince, Parole and mpv launch from the menu. Take snapshot **`G-lite-apps`**.

---

## Part 12 — The IPRPS Apps

### 12.1 Layout on disk

| Path | Contents |
|---|---|
| `/srv/www/iprps/` | Web apps, one folder each (`hub/`, `genesis/`, and so on), served at `http://localhost/iprps/<app>/` |
| `/usr/share/iprps/` | Schema, icons, branding, shared assets |
| `/etc/iprps/` | Settings written at first boot (database credentials), readable by Apache only |
| `/usr/bin/iprps-*` | Command-line helpers and launchers |
| `/opt/iprps/` | Desktop (non-web) IPRPS apps, such as the Media Player |
| `~/Campaigns/` | Each user's campaign files, handouts, maps and audio |

### 12.2 Launch helpers

**`iprps-open`** starts the local services if needed, then opens an app:

**[IPRPS CHROOT]**

```bash
cat > /usr/bin/iprps-open << "EOF"
#!/bin/bash
# iprps-open <app-folder> — open an IPRPS web app (for example: iprps-open hub)
APP="${1:-}"
for svc in httpd php-fpm mariadb; do
  systemctl is-active --quiet "$svc" || pkexec systemctl start "$svc"
done
exec firefox --new-window "http://localhost/iprps/${APP}"
EOF
chmod 755 /usr/bin/iprps-open
```

**`iprps-session`** is **Session Master Mode**. It opens the Session Master Hub, starts the ambience player, and opens a full-screen **player display** for a second monitor or projector:

**[IPRPS CHROOT]**

```bash
cat > /usr/bin/iprps-session << "EOF"
#!/bin/bash
# iprps-session — Session Master Mode
iprps-open hub/ &
sleep 2
[ -d "$HOME/Campaigns/Audio" ] && mpv --player-operation-mode=pseudo-gui --no-video \
    --shuffle --loop-playlist=inf --title="IPRPS Ambience" "$HOME/Campaigns/Audio" &
mkdir -p "$HOME/.iprps/player-display"
firefox --no-remote --profile "$HOME/.iprps/player-display" --kiosk \
        "http://localhost/iprps/hub/display.php" &
wait
EOF
chmod 755 /usr/bin/iprps-session
```

> **Side note:** Ambience plays in a small **IPRPS Ambience** window (mpv), shuffled and looping, from *Campaigns/Audio*. With that window selected: **Space** pauses, **9** and **0** lower and raise the volume, **>** skips to the next track, and **q** stops it. For browsing music or playing a single track, use **Parole** from the menu.

> **Pro tip:** The player display runs in its own Firefox profile, so it opens as a separate full-screen window. Drag it to the second monitor or projector, and press **Alt+F4** to close it. Players see only what the Session Master reveals there: maps, handouts and the initiative order.

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
| **Session Master Hub** | Campaigns, player roster, characters, XP, attendance, quests, NPCs | **To build** (schema in 10.2) | ✔ | ✔ | ✔ |
| **Initiative and Combat Tracker** | Turn order, HP, conditions; feeds the player display | **To build** (part of the Hub) | ✔ | ✔ | ✔ |
| **Dice Roller** | IPRPS dice mechanics; logs rolls to the session log | **To build** (part of the Hub) | ✔ | ✔ | ✔ |
| **Session Log and Recap** | Timeline of notes, rolls, loot and XP; exports recaps | **To build** (part of the Hub) | ✔ | ✔ | ✔ |
| **Player Display** | Full-screen handouts, maps and initiative for players | **To build** (`hub/display.php`) | ✔ | ✔ | ✔ |
| **Infinite Plane Universal Login** | Single sign-on for the local IPRPS apps | Exists | ✔ | ✔ | ✔ |
| **IPRPS Welcome** | First-run tour; settings for API keys and color scheme | **To build** | ✔ | ✔ | ✔ |
| **IPRPS Media Player** | Music, ambience, CDs and DVDs; IPRPS radio | Exists (Electron + libVLC) | — | ✔ | ✔ |
| **Genesis Character Engine** | AI character reference sheets | Exists (needs internet + API key) | — | ✔ | ✔ |
| **Infinite Plane Writing Assistant** | Writing help for campaigns and lore | Exists (needs internet + API key) | — | ✔ | ✔ |
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

### 12.5 Installing a web app

The pattern is the same for every web app. As root, from the app's release folder:

**[IPRPS CHROOT]**

```bash
install -vdm755 /srv/www/iprps/<app>
cp -rv ./* /srv/www/iprps/<app>/
chown -R root:apache /srv/www/iprps/<app>
find /srv/www/iprps/<app> -type d -exec chmod 755 {} \; -o -type f -exec chmod 644 {} \;
```

Folders the app writes to (uploads, cache) get `chown -R apache:apache` on **those folders only**. Apps read their database settings from `/etc/iprps/db.php`, which first boot creates (Part 14).

> **Pro tip:** Moving apps from Windows/XAMPP: Linux filenames are **case-sensitive**, `D:\xampp\...` paths must become `/srv/www/iprps/...`, and the database host is `localhost` over the socket.

### 12.6 Desktop (non-web) apps

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

**The database password, unique per installation:**

**[IPRPS CHROOT]**

```bash
cat > /usr/sbin/iprps-db-init << "EOF"
#!/bin/bash
# iprps-db-init — create the IPRPS database and a unique random application password
set -e
PW=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
mariadb -u root << SQL
CREATE DATABASE IF NOT EXISTS iprps CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'iprps'@'localhost' IDENTIFIED BY '$PW';
ALTER USER 'iprps'@'localhost' IDENTIFIED BY '$PW';
GRANT ALL PRIVILEGES ON iprps.* TO 'iprps'@'localhost';
FLUSH PRIVILEGES;
SQL
mariadb -u root iprps < /usr/share/iprps/schema/iprps-core.sql
install -dm750 -o root -g apache /etc/iprps
cat > /etc/iprps/db.php << PHP
<?php
return ['host' => 'localhost', 'name' => 'iprps', 'user' => 'iprps', 'pass' => '$PW'];
PHP
chown root:apache /etc/iprps/db.php
chmod 640 /etc/iprps/db.php
touch /var/lib/iprps/db-done
EOF
chmod 755 /usr/sbin/iprps-db-init
cat > /usr/lib/systemd/system/iprps-db-init.service << "EOF"
[Unit]
Description=IPRPS first boot: create the campaign database
ConditionPathExists=!/var/lib/iprps/db-done
After=mariadb.service
Requires=mariadb.service

[Service]
Type=oneshot
ExecStart=/usr/sbin/iprps-db-init
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl enable iprps-db-init.service
```

### 13.2 First boot: create the user (text-mode setup)

The release images contain **no user accounts**. On first boot, before the login screen appears, a short setup screen asks for a user name, password, computer name and time zone:

**[IPRPS CHROOT]**

```bash
cat > /usr/sbin/iprps-setup << "EOF"
#!/bin/bash
# iprps-setup — create the first user on a new IPRPS installation
clear
cat << "TXT"

  ============================================
            Welcome to IPRPS OS
  ============================================

  Let's create your account. This takes a minute.

TXT
read -rp "  User name (lowercase, e.g. alex): " U
until [[ "$U" =~ ^[a-z][a-z0-9_-]{0,30}$ ]] && ! id "$U" &>/dev/null; do
  read -rp "  Lowercase letters/numbers, starting with a letter: " U
done
useradd -m -G users,wheel,audio,video,iprps -s /bin/bash "$U"
until passwd "$U"; do echo "  Let's try that again."; done
read -rp "  Computer name [iprps]: " H
echo "${H:-iprps}" > /etc/hostname
read -rp "  Time zone, e.g. America/New_York [UTC]: " TZ
TZ=${TZ:-UTC}
[ -f "/usr/share/zoneinfo/$TZ" ] && ln -sf "/usr/share/zoneinfo/$TZ" /etc/localtime
touch /var/lib/iprps/setup-done
echo; echo "  All set. Starting the desktop..."; sleep 2
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
TTYReset=yes
TTYVHangup=yes
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl enable iprps-setup.service
```

> **Side note:** The new user is in the `wheel` group, so they have **sudo**. The root account is locked in release images (13.4), which is the same model Ubuntu and many other distros use.

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
echo uninitialized > "$NEW/etc/machine-id"
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

At a release checkpoint, **copy** the system image and clean the copy. Your build image stays untouched. In WSL, as root, with the build image unmounted (`iprps-leave.sh`):

**[DEBIAN ROOT]**

```bash
mkdir -pv /root/release
cp -v --sparse=always /root/iprps-system.img /root/release/iprps-os-1.0-<edition>.img
L=$(losetup -fP --show /root/release/iprps-os-1.0-<edition>.img)
mkdir -pv /mnt/rel && mount -v ${L}p3 /mnt/rel
for d in dev proc sys run; do mount --rbind /$d /mnt/rel/$d; done
chroot /mnt/rel /bin/bash
```

Inside that chroot:

**[RELEASE COPY CHROOT]**

```bash
userdel -r builder
rm -f /etc/sudoers.d/90-builder-build-only /etc/sudoers.d/xorg
rm -rf /build /root/* /root/.bash_history /home/*/.bash_history /tmp/* /var/tmp/*
rm -f /etc/ssh/ssh_host_* /etc/resolv.conf
echo uninitialized > /etc/machine-id
rm -rf /var/lib/iprps/*-done
rm -rf /var/log/journal/*
passwd -l root
sed -i 's/^VERSION=.*/VERSION="1.0 <Edition>"/; s/^PRETTY_NAME=.*/PRETTY_NAME="IPRPS OS 1.0 <Edition>"/' /etc/os-release
sed -i 's/^DISTRIB_DESCRIPTION=.*/DISTRIB_DESCRIPTION="IPRPS OS 1.0 <Edition>"/' /etc/lsb-release
exit
```

Back in WSL, release the free space and unmount:

**[DEBIAN ROOT]**

```bash
fstrim -v /mnt/rel
umount -R /mnt/rel
```

### 13.5 Shrink, compress and convert

A smaller image writes faster and fits smaller USB sticks; first boot grows it back to fill the drive. With the copy still attached (`$L` from 13.4):

**[DEBIAN ROOT]**

```bash
e2fsck -fy ${L}p3
resize2fs -M ${L}p3
BLK=$(dumpe2fs -h ${L}p3 2>/dev/null | awk -F: '/^Block count/{gsub(/ /,"",$2); print $2}')
BSZ=$(dumpe2fs -h ${L}p3 2>/dev/null | awk -F: '/^Block size/{gsub(/ /,"",$2); print $2}')
NEW_MIB=$(( BLK * BSZ / 1048576 + 2048 ))
losetup -d $L
IMG=/root/release/iprps-os-1.0-<edition>.img
echo ", ${NEW_MIB}M" | sfdisk -N 3 $IMG
END=$(sfdisk -d $IMG | sed -n 's/.*3 : start= *\([0-9]*\), size= *\([0-9]*\).*/\1 \2/p' | awk '{print $1+$2}')
truncate -s $(( (END + 34) * 512 )) $IMG
sfdisk --relocate gpt-bak-std $IMG
sfdisk -l $IMG
```

The filesystem shrinks to its minimum size, the partition shrinks to that plus 2 GiB of headroom, and the image file is cut off just after it. Finally, the GPT's backup copy is moved to the new end.

**Check that the shrunk image is healthy** before compressing:

**[DEBIAN ROOT]**

```bash
L=$(losetup -fP --show $IMG); e2fsck -fn ${L}p3; losetup -d $L
```

It must report no errors. Then produce the downloads:

**[DEBIAN ROOT]**

```bash
cd /root/release
OUT=/mnt/g/IPRPS/release
xz -T0 -9 -k -v iprps-os-1.0-<edition>.img
qemu-img convert -p -O vhdx -o subformat=dynamic iprps-os-1.0-<edition>.img iprps-os-1.0-<edition>.vhdx
qemu-img convert -p -O qcow2 -c iprps-os-1.0-<edition>.img iprps-os-1.0-<edition>.qcow2
sha256sum iprps-os-1.0-<edition>.img.xz iprps-os-1.0-<edition>.vhdx iprps-os-1.0-<edition>.qcow2 > SHA256SUMS-<edition>
cp -v iprps-os-1.0-<edition>.img.xz iprps-os-1.0-<edition>.vhdx iprps-os-1.0-<edition>.qcow2 SHA256SUMS-<edition> $OUT/
ls -lh $OUT/
```

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
split -b 1900M -d -a 2 iprps-os-1.0-<edition>.img.xz iprps-os-1.0-<edition>.img.xz.part
ls -lh iprps-os-1.0-<edition>.img.xz.part*
```

Users join the parts before writing them. On Linux: `cat iprps-os-1.0-<edition>.img.xz.part* > iprps-os-1.0-<edition>.img.xz`. On Windows (Command Prompt): `copy /b iprps-os-1.0-<edition>.img.xz.part00 + iprps-os-1.0-<edition>.img.xz.part01 iprps-os-1.0-<edition>.img.xz` (list every part, in order). Then they check the result against `SHA256SUMS` before writing it.

> **Pro tip:** Publish checksums in **both** places, and state the SHA256 in the release notes. Users can then verify a download from either site.

**Release notes checklist:** edition contents (Part 1 table), minimum requirements (64-bit Intel/AMD, 6 GB RAM, 64 GB storage; 128 GB for Advanced), **Secure Boot must be off**, how to write the image, first-boot setup, how to install to disk, known issues, and the link to the source archive.

---

## Part 14 — Release Checkpoint: Lite

> **Checkpoint:** Take snapshot **`RELEASE-lite`** (0.4).

1. Clean a copy with 13.4 (`<edition>` = `lite`, `<Edition>` = `Lite`).
2. Shrink, compress and convert it with 13.5.
3. Run the test matrix in 13.6, including a 6 GB RAM test (Hyper-V lets you set exactly 6 GB).
4. Publish with 13.8.

Then continue building in `/root/iprps-system.img`.

---

## Part 15 — Stage H: Medium Edition Apps

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

Install the Medium IPRPS apps (12.4) using 12.5 and 12.6.

> **Checkpoint:** Take snapshot **`RELEASE-medium`**, then release it as in Part 14 with `VERSION="1.0 Medium"` → `iprps-1.0-medium.img.xz`.

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

> **Checkpoint:** Take snapshot **`RELEASE-advanced`**, then release it as in Part 14 with `VERSION="1.0 Advanced"` → `iprps-1.0-advanced.img.xz`.

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
| `http://localhost/iprps/` doesn't load | Apache or PHP-FPM stopped | `systemctl status httpd php-fpm`; `journalctl -u httpd -u php-fpm` |
| PHP can't reach MariaDB | Socket path mismatch, or `php-fpm` stopped | `grep default_socket /etc/php.ini` must show `/run/mariadb/mariadb.sock`; `systemctl status php-fpm mariadb` |
| First-boot setup screen doesn't appear | Setup already marked done | Remove `/var/lib/iprps/setup-done` on the image before release (13.4 does this) |

## Appendix C — Kernel Options Required by BLFS Packages

{{kernel-table}}

## Appendix D — Package Lists by Edition

{{edition-lists}}

---

*Credits: Built with Linux From Scratch and Beyond Linux From Scratch 13.1 (https://www.linuxfromscratch.org/). BLFS commands are reproduced from the book under its MIT-licensed command terms; BLFS text is under a Creative Commons license. IPRPS design, scripts and explanations are original to this guide. "Linux" is a registered trademark of Linus Torvalds. Firefox is a trademark of the Mozilla Foundation; IPRPS ships an unbranded build.*
