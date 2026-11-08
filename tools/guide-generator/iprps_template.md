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
| Downloadable from GitHub and/or a download site | One compressed disk image per edition (USB stick or internal disk), a live ISO (DVD or USB, 13.9), optional VM images, checksums and source archives (13.8) |
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
| Campaign tools | IPRPS Session Master Hub, **character sheets** (Character Creator, Character Sheets), IPRPS Table, player display, dice, initiative, session log | + all Medium IPRPS apps | + all IPRPS apps |
| Audio | Parole (music and ambience); mpv plays ambience in Session Master Mode; **Soundboard** | + VLC | + upstream audio tools (Part 16) |
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

**Backing up to another drive.** Snapshots live inside WSL's own disk, so a damaged or reset WSL loses them all. After each checkpoint, copy the new snapshot to D: (set up once in Appendix F.1):

**[DEBIAN ROOT]**

```bash
/root/iprps-backup.sh snapshots
```

- Every snapshot not yet backed up is compressed with zstd into `D:\IPRPS\backups\snapshots` and tested. Each prints **OK** or **up to date**, and the run ends with **Backup complete**.
- Compressing matters: a plain copy to a Windows drive writes each sparse snapshot out at its full 40 GB.
- Always back up the release snapshots (`RELEASE-lite`, and so on).
- Backing up the working image and restoring from a backup are in Appendix F.

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
# Only one image can be open at a time: refuse if another image is mounted at /mnt/iprps
if mountpoint -q $R; then
  CUR=$(losetup -l -n -O NAME,BACK-FILE | awk -v d="$(findmnt -n -o SOURCE $R | sed 's/p[0-9]*$//')" '$1==d {print $2}')
  if [ "$CUR" != "$IMG" ]; then
    echo "STOPPED: /mnt/iprps has another image open: ${CUR:-unknown}"
    echo "Exit its chroot windows and close it first: IPRPS_IMG=${CUR:-<that image>} bash /root/iprps-leave.sh"
    exit 1
  fi
fi
L=$(losetup -j $IMG | cut -d: -f1 | head -1); [ -n "$L" ] || L=$(losetup -fP --show $IMG)
mkdir -p $R; mountpoint -q $R || mount ${L}p3 $R
echo "Image: $IMG ($(. $R/etc/os-release 2>/dev/null; echo "$PRETTY_NAME"))"
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
# Background helpers started inside the image (gpg-agent and dirmngr from pacman-key or gpg) keep it busy:
# stop any process whose root directory is the image, except chroot shells, which the user closes
for p in /proc/[0-9]*; do
  [ "$(readlink "$p/root" 2>/dev/null)" = "$R" ] || continue
  case "$(cat "$p/comm" 2>/dev/null)" in gpg-agent|dirmngr|keyboxd|scdaemon) echo "Stopping $(cat "$p/comm") (${p#/proc/})"; kill "${p#/proc/}" ;; esac
done
sleep 1
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
# Detach the image, retrying: the kernel can keep a loop device busy for a moment after the last unmount
IMGF=${IPRPS_IMG:-/root/iprps-system.img}
for try in 1 2 3 4 5; do
  LS=$(losetup -j "$IMGF" | cut -d: -f1)
  [ -z "$LS" ] && break
  for L in $LS; do losetup -d "$L" 2>/dev/null && echo "Detached $L"; done
  sleep 1
done
if [ -n "$(losetup -j "$IMGF")" ]; then
  echo "STILL ATTACHED: $(losetup -j "$IMGF" | cut -d: -f1 | tr '\n' ' ')- detach it with: losetup -d /dev/loopN"
  exit 1
fi
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
qemu-system-x86_64 -enable-kvm -cpu host -m 6G -smp 4 \
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

**IPRPS addition: live boot from an ISO (DVD or USB).** The live ISO images (13.9) start IPRPS OS from a DVD or USB stick without touching the computer's disks: the initramfs finds the disc by its label, opens the compressed system on it read-only, and puts a RAM layer on top, so the session can change anything and nothing is written to disk. This adds the CD/DVD drivers to the initramfs and a `do_mount_live` step to its `init`, used only when the kernel line has `iprps.live=<label>`; normal boots from a disk are unchanged. It finds the disc by trying every device with that label (a USB stick shows the label on a partition too, which can't be mounted, so it also tries the whole stick). Safe to run more than once:

**[IPRPS CHROOT]**

```bash
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
```

The output shows `init.in: live boot added` (or nothing new on a second run), the `mkinitramfs` line with `drivers/{block,ata,nvme,md,firewire,cdrom}`, and three `init.in` lines: the `do_mount_live` comment, the `iprps.live=*)` option, and the call. **Create the initramfs again** afterwards (the next step), or the change isn't in it.

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
| `/usr/share/iprps/icons/*.png` | 256×256, 72 files | The **IPRPS icon theme** and folder icons (9.3), and the IPRPS launchers. They come from the repository's `artwork/icons`, installed in 9.3 |
| `/boot/grub/iprps-grub.png` | 1920×1080 | GRUB boot menu background (optional, 9.5) |

Images that aren't exactly 16:9 are trimmed to 16:9 first (centred), so they fill a 16:9 screen without black bars. The repository's `artwork/` folder keeps the finished files.

**1. Copy them in. [DEBIAN ROOT]** (the files are in your Windows Downloads folder):

```bash
cp -v /mnt/c/Users/<you>/Downloads/iprps-login.png /mnt/c/Users/<you>/Downloads/iprps-default.png /build/src/
```

**2. Check the chroot sees them. [IPRPS CHROOT]**

```bash
ls /build/src/iprps-login.png /build/src/iprps-default.png
```

If the chroot doesn't see files that Debian has in `/build/src`, Debian's `/build` isn't connected to this chroot session (`findmnt /mnt/iprps/build` in DEBIAN ROOT prints nothing). Copy straight into the image instead (`cp -v ... /mnt/iprps/build/src/`), and reconnect next time: leave the chroot, run `iprps-leave.sh`, then `iprps-enter.sh` again.

**3. Install them. [IPRPS CHROOT]**

```bash
install -vdm755 /usr/share/backgrounds/iprps /usr/share/iprps/{icons,schema,branding}
install -v -m644 /build/src/iprps-login.png /build/src/iprps-default.png /usr/share/backgrounds/iprps/
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

**The IPRPS icon theme.** It layers the **72 IPRPS icons** (256×256 PNG, in the repository's `artwork/icons`) on top of Adwaita: wherever Xfce, Thunar or GTK asks for an icon IPRPS has (home, trash, terminal, folders, text files…), it gets the IPRPS one; Adwaita covers the rest. Every icon is available as `iprps-<name>` for IPRPS's own launchers, and many also under the **standard names** programs ask for. `/usr/lib/iprps/iprps-icon-theme` builds the theme; the `iprps-icons` package (12.12) runs the same script, so new images and updates always agree.

| IPRPS icon | Standard names | Where it shows |
|---|---|---|
| home | `user-home`, `folder-home`, `go-home` | Home |
| folder-desktop, documents, folder-downloads, folder-music, folder-pictures, folder-videos | `user-desktop`, `folder-documents`, `folder-download`, `folder-music`, `folder-pictures`, `folder-videos` | The standard folders |
| Public, Templates, Projects, campaigns | `folder-publicshare`, `folder-templates`, `folder-projects`, `folder-campaigns` | Public, Templates; Projects and Campaigns |
| folder | `folder`, `generic-folder`, `inode-directory` | **Every other folder** |
| folder-network, network | `folder-remote`, `network-workgroup` | Network folders, Browse Network |
| trash | `user-trash`, `user-trash-full` | Trash |
| file-system | `drive-harddisk` | File System |
| text-files, document | `text-x-generic`, `text-plain`; `x-office-document`, `application-document` | Text files; documents |
| thunar-app, file-system-thunar, finder | `org.xfce.thunar`; `thunar`, `Thunar`; `system-file-manager` | The file manager (Thunar) |
| terminal | `utilities-terminal`, `org.xfce.terminal`, `org.xfce.terminalemulator` | Terminal |
| internet | `applications-internet`, `web-browser`, `org.xfce.webbrowser` | Internet category, browser |
| settings, security | `preferences-system`, `preferences-desktop`, `org.xfce.settings.manager`; `preferences-system-privacy` | Settings |
| audio | `applications-multimedia`, `multimedia-volume-control` | Multimedia category, volume |
| menu, apps | `org.xfce.panel.applicationsmenu`, `start-here`; `applications-other`, `applications-all` | The Applications menu button; Other category |
| hub, session-master-mode, initiative, dice | `iprps-hub`, `iprps-session`, `iprps-combat`, `iprps-dice` | Session Master Hub, Session Master Mode, Combat Tracker, Dice Roller |
| ai-session-master, media-player | `iprps-ai-session-master`, `iprps-media-player` | Reserved for two future apps: the **AI Session Master** (one place for AI profiles, patches and capstones) and the **IPRPS CD/DVD player**; their menu entries use these names |
| folder-root-system and the folder icons | `iprps-` names | The folder icons below |

**IPRPS folder icons in Thunar.** An icon theme names *kinds* of folders, not particular ones, and Thunar 4.20 has no per-folder icon setting. So IPRPS adds a **folder thumbnailer** (`/usr/bin/iprps-folder-thumbnailer`, the method in Thunar's documentation): Thunar asks it for a "thumbnail" of each folder, and it answers with that folder's IPRPS icon. Nothing is written inside the folders; folders without an IPRPS icon keep the `folder` icon.

| Folders | Icon |
|---|---|
| `/` (the top of the file system) | folder-root-system |
| `/bin` `/boot` `/dev` `/etc` `/home` `/lib` `/lib64` `/media` `/mnt` `/opt` `/proc` `/root` `/run` `/sbin` `/srv` `/sys` `/tmp` `/usr` `/var` | The icon of the same name |
| `/build`, `/usr/src`, `/build/src` | build, src, sources |
| By name, anywhere (any capitals): Campaigns, Projects, Public, Templates, Maps, Handouts, NPCs, Players, Creatures, Dungeons, AI Profiles, AI Patches, RPG Vault, Archives, Code / Scripts, Text Files, Audio, debian-kconfig | campaigns, Projects, Public, Templates, folder-maps, folder-handouts, folder-npcs, folder-players, folder-creatures, folder-dungeons, folder-ai-profiles, folder-ai-patches, folder-rpg-vault, folder-archives, folder-code-scripts, folder-text-files, folder-music, debian-kconfig |

Thunar shows these where it shows thumbnails (**View → Show thumbnails**, default *Local files only*); the side pane uses the theme icons.

**1. Copy the icons and the two scripts into the image. [DEBIAN ROOT]** From the repository (unzip the newest over `G:\IPRPS\iprps-os` first):

```bash
R=/mnt/g/IPRPS/iprps-os
install -vdm755 /mnt/iprps/usr/share/iprps/icons
install -m644 $R/artwork/icons/*.png /mnt/iprps/usr/share/iprps/icons/
install -vDm755 $R/rootfs/usr/lib/iprps/iprps-icon-theme /mnt/iprps/usr/lib/iprps/iprps-icon-theme
install -vDm755 $R/rootfs/usr/bin/iprps-folder-thumbnailer /mnt/iprps/usr/bin/iprps-folder-thumbnailer
install -vDm644 $R/rootfs/usr/share/thumbnailers/iprps-folders.thumbnailer /mnt/iprps/usr/share/thumbnailers/iprps-folders.thumbnailer
ls /mnt/iprps/usr/share/iprps/icons/*.png | wc -l      # 72
```

**2. Build the theme. [IPRPS CHROOT]**

```bash
/usr/lib/iprps/iprps-icon-theme
find /usr/share/icons/IPRPS -xtype l | wc -l           # 0 broken links
```

It prints **IPRPS icon theme: 124 names from 72 icons**. It starts by deleting the old theme, so it's safe to run again after changing icons.

> **Side note:** On a system that already has the package manager (12.12), install the **`iprps-icons`** package instead of these two steps (it contains the same files and runs the same script); Part 17's app-update steps publish it to installed computers. `Type=Scalable` with `MinSize=16` lets GTK scale the 256-pixel icons down for the panel and menus.

**If the icons don't show up in a test boot**, check the build image. **[IPRPS CHROOT]**

```bash
ls /usr/share/iprps/icons/*.png | wc -l                                  # 72
find /usr/share/icons/IPRPS -xtype l | wc -l                             # 0 broken links
ls -l /usr/share/icons/IPRPS/index.theme /usr/share/icons/IPRPS/icon-theme.cache
grep IconThemeName /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml   # value="IPRPS"
grep icon-theme /etc/lightdm/lightdm-gtk-greeter.conf                    # IPRPS
/usr/bin/iprps-folder-thumbnailer 256 /usr /tmp/t.png && echo "folder icons OK"
```

Any wrong answer: repeat steps 1 and 2. If everything is right, the test copy is probably older than the change (make a fresh one), or the test user has an icon setting of its own (next note). Folder icons that don't change in Thunar: the thumbnail service reads its list of thumbnailers when it starts and keeps old pictures, so run `thunar -q; pkill tumblerd; rm -rf ~/.cache/thumbnails/*/; thunar ~ &` (or log out and in). Appendix C.6 shows users and administrators how to add their own icons later.

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

-- Character sheets (players, NPCs, creatures) for the Character Sheets app (12.9); one owner account each
CREATE TABLE IF NOT EXISTS character_sheets (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  campaign_id   INT UNSIGNED NULL,
  kind          ENUM('pc','npc','creature') NOT NULL DEFAULT 'pc',
  name          VARCHAR(120) NOT NULL,
  player_name   VARCHAR(100),
  race          VARCHAR(80),
  class         VARCHAR(80),
  level         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  hp            INT,
  mp            BIGINT,
  armor         SMALLINT,
  sheet_json    LONGTEXT NOT NULL,
  avatar        MEDIUMTEXT,
  thumb         TEXT,
  source        ENUM('import','editor','oracle','table') NOT NULL DEFAULT 'import',
  file_name     VARCHAR(200),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner (user_id, kind, name),
  INDEX idx_campaign (campaign_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
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

`grep -c` prints **12**, and `SHOW TABLES` lists the 12 tables. `character_sheets` holds the Character Sheets app's sheets (12.9).

> **Side note:** `sheet_json` (in `characters` and `character_sheets`) stores a full character sheet as JSON, so IPRPS sheets (including data imported from `.iprps` files) fit without schema changes. The Universal Login tables (`ip_users`, `ip_sessions`) live in their own database as in the existing IPRPS web apps.

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
Icon=iprps-session
Categories=X-IPRPS;
EOF
cat > /usr/share/applications/iprps-hub.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Session Master Hub
Comment=Campaigns, players, characters, sessions and encounters
Exec=iprps-open hub/
Icon=iprps-hub
Categories=X-IPRPS;
EOF
update-desktop-database /usr/share/applications
```

### 12.4 Which apps go in which edition

| App | What it does | Status | Lite | Medium | Advanced |
|---|---|---|---|---|---|
| **Session Master Hub** | Home page with the Session Master's apps and **Manage apps** (12.6); the campaign tools are their own apps (12.9, 12.10) | Exists (`hub/`) | ✔ | ✔ | ✔ |
| **IPRPS Writer** | Word processor in the Hub: headings, bold/italic, lists, alignment; documents saved per account; opens and saves `.docx`, `.odt`, `.txt`, `.html`, prints to PDF | Exists (`writer/`, 12.6) | ✔ | ✔ | ✔ |
| **Initiative and Combat Tracker** | Encounters, initiative, turns and rounds, HP with Damage − AR, conditions, the five combat modes; shows the order to players; logs the fight | Exists (`combat/`, 12.10) | ✔ | ✔ | ✔ |
| **Dice Roller** | Any dice and every IPRPS roll (the Table's rules); logs rolls and shows them to players | Exists (`dice/`, 12.10) | ✔ | ✔ | ✔ |
| **Session Log and Recap** | Campaigns and sessions; timeline of notes, events, combat, rolls, loot and XP; recap (from the log or the Oracle) and Session Master notes; attendance and XP | Exists (`session-log/`, 12.10) | ✔ | ✔ | ✔ |
| **Character Creator** | The IPRPS character sheet (attributes, DP costs, skills, advantages, spells, portrait); exports `.json`; one file players can use anywhere | Exists (`character-creator/`, 12.9) | ✔ | ✔ | ✔ |
| **Character Sheets** | The Session Master's sheet library: import players' files, view, print, by campaign; NPC and creature sheets; in the Table console; read by the Oracle | Exists (`character-sheets/`, 12.9) | ✔ | ✔ | ✔ |
| **IPRPS Table** | LAN play: players join from phones, tablets and laptops on the same network; chat (everyone, players only, private), images and audio, IPRPS dice, and the Session Master pushes pictures, video, text and sound to everyone, groups or single players | Exists (`/opt/iprps/table`, 12.7) | ✔ | ✔ | ✔ |
| **Player Display** | Full-screen handouts, maps and initiative for players | **Exists** (`hub/display.php`, shows text sent to it: Oracle replies, the turn order, rolls, recaps); maps to build | ✔ | ✔ | ✔ |
| **Infinite Plane Universal Login** | Single sign-on for the local IPRPS apps | Exists | ✔ | ✔ | ✔ |
| **IPRPS Welcome** | First-login tour, first campaign, color scheme, encrypted API key vault | Exists (`welcome/`, 12.10) | ✔ | ✔ | ✔ |
| **IPRPS Media Player** | Music, ambience, CDs and DVDs; IPRPS radio | Exists (Electron + libVLC) | — | ✔ | ✔ |
| **Genesis Character Engine** | AI character reference sheets | Exists (needs internet + API key) | — | ✔ | ✔ |
| **Infinite Plane Writing Assistant** | Writing help for campaigns and lore | Exists (needs internet + API key) | — | ✔ | ✔ |
| **IPRPS Oracle** | Local AI for the Session Master: chat, quick generators (NPC, location, loot, encounter, plot hook, names, read-aloud), campaign memory, save to the campaign, show on the player display | Exists (`oracle/`, Part 15) | — | ✔ | ✔ |
| **Soundboard** | One-click sound effects and ambience: built-in sounds made by the computer, your own files, boards and hotkeys; plays files on the Table too | Exists (`soundboard/`, 12.11) | ✔ | ✔ | ✔ |
| **IPRPS Updates** | Security fixes, new app versions and optional software, installed without reinstalling (pacman); Hub tile, notifications | Exists (`iprps-base`, 12.12) | ✔ | ✔ | ✔ |
| **IPRPS File Viewer** | Open and check `.iprps`, `.ipai`, `.srpatch` and `.capstone`/`.pcapstone` files; import sheets | Exists (`file-viewer/`, 12.10) | ✔ | ✔ | ✔ |
| **Lookbook Studio** | Visual lookbooks for campaigns and settings | Exists | — | — | ✔ |
| **Reel** | Browser-based audio workstation | Exists | — | — | ✔ |
| **THE DIRECTOR** | Story maps into AI video Scene Packages | Exists | — | — | ✔ |
| **Script Breakdown Engine** | Story breakdowns for production | Exists | — | — | ✔ |
| **Generative Art Gallery** | Image gallery with accounts | Exists | — | — | ✔ |
| **RadioStation Manager** | Web radio broadcasting | Exists | — | — | ✔ |
| **IPRPS CD Burner** | Disc burning for IPRPS media | In progress | — | — | ✔ |
| **AI Session Master campaign apps** | AI-run campaigns | Exists (React) | — | — | ✔ |

> **Warning:** Apps that call online AI services need internet access and each user's **own** API keys. Never ship keys in the image. **IPRPS Welcome** (12.10) stores each user's keys in one protected place.

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
| `character-sheets` | Character Sheets (12.9) |
| `character-creator` | Character Creator (12.9) |
| `session-log` | Session Log and Recap (12.10) |
| `combat` | Initiative and Combat Tracker (12.10) |
| `dice` | Dice Roller (12.10) |
| `soundboard` | Soundboard (12.11) |
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
| `file-viewer` | IPRPS File Viewer (12.10) |

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

`ls` shows `api.php`, `app-names.json`, `default-apps.json`, `display.php`, `hub-icon.svg`, `hub.css`, `hub.js` and `index.html`. The loop checks the default apps: each `MISSING` is a folder that isn't installed or has another name. Correct the name in `default-apps.json` (and `app-names.json`), or install the app. `table`, `character-sheets`, `character-creator`, `session-log`, `combat`, `dice`, `soundboard` and `file-viewer` show `MISSING` until 12.7, 12.9, 12.10 and 12.11 install them. The Hub needs no database setup: it creates its table on first use.

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

**Character sheets (12.9).**

- Players tap **📜 Sheet** to fill in the IPRPS Character Creator on their own device, then **Send to the Session Master**. The sheet goes privately to the Session Master and stays on their device for next time.
- In the console, **📜 Character sheets** opens the Character Sheets app beside the table. **Import to Character Sheets** adds or updates a sheet that arrived, **Sheet** next to a player opens theirs, and **Show to …** puts a sheet on a player's screen.
- **New session** clears the files players sent, so import sheets first.

**Safety.** The Table listens on port **7777** of every network the computer is on, but answers other devices only while the Session Master has the table **open**, and only with the join code. The console (`http://localhost:7777/sm/`) opens on the Session Master's own computer only. It runs as its own account, `iprps-table`, which can write nowhere but `/var/lib/iprps-table`. Closing the table disconnects everyone; chat, players and media are kept for next time (**Session → New session** clears the chat; **Reset everything** also removes players and media and makes a new code). After a restart the table is always closed.

> **Note:** Players in another city or state join through a private, encrypted connection between their computer and the Session Master's: Appendix G. Nothing in the Table changes for that.

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

### 12.9 Character sheets: Character Creator and Character Sheets

Two apps in every edition handle IPRPS character sheets. Both are on the Hub by default.

| App | Folder | What it does |
|---|---|---|
| **Character Creator** | `character-creator` | The IPRPS character sheet: attributes and derived stats, Development Point costs, 58 skills, advantages, disadvantages, quirks, magick spells, equipment, a portrait. It exports the sheet as **`.json`** (or `.iprps`, the same file) and prints blank or filled sheets. It's **one self-contained file**, so players can use it on any computer, offline. |
| **Character Sheets** | `character-sheets` | The Session Master's library: import players' files, view, print and download sheets, sort them by campaign, keep private notes. It also makes **NPC** and **creature** sheets. It opens inside the **IPRPS Table** console and is read by the **IPRPS Oracle**. |

**How a sheet travels**

1. **Players fill in the sheet** on their own computers, in one of two ways.
   - **As a file:** in Character Sheets, **Blank sheet for players ⇩** saves `IPRPS-Character-Sheet.html`. Give it to players on a USB stick, by email or in a shared folder. They open it in any browser, fill it in, and click **Export .json**. Their work is kept in that browser between visits.
   - **At the table:** during a game on the IPRPS Table (12.7), players tap **📜 Sheet** on their phone, tablet or laptop. The same Character Creator opens. **Send to the Session Master** delivers the sheet privately to the Session Master, and they can send it again after changes.
2. **The Session Master imports it.**
   - **Files:** in Character Sheets, **Import sheets…** (or drag the files onto the window) takes any number of `.json`/`.iprps` files at once. Choose the campaign. A sheet for the same character and player **updates** the one you have instead of adding a copy.
   - **From the Table:** in the Table console, a sheet that arrives shows an **Import to Character Sheets** button in the chat and at the top of the **📜 Character sheets** panel.
3. **Using the sheets.**
   - **Viewing and keeping them:** Character Sheets shows each sheet laid out for reading: attributes with their shifts, HP and Mana Pool, skills with skill shifts, advantages, spells and gear. **Print** prints just the sheet, and **Download .json** gives the file back.
   - **Editing:** **Edit** opens a player or NPC sheet in the Character Creator, and **💾 Save to Character Sheets** stores it.
   - **NPCs and creatures:**
     - **New ▾** makes player, NPC and creature sheets.
     - Creature sheets have their own layout: type, size (with the IPRPS size modifiers), threat, natural AR, attacks, abilities, weaknesses, behavior, tactics and loot.
     - In Medium and Advanced, **✦ NPC with the Oracle…** and **✦ Creature with the Oracle…** have the local AI write a complete sheet that fits the campaign.
   - **At the table:**
     - The console's **📜 Character sheets** panel shows every sheet, and a green dot marks the players who are at the table. **Sheet** next to a player opens their sheet.
     - **Show to …** puts a sheet on that player's screen as a text card.
   - **With the Oracle (Medium and Advanced):** the Oracle gets a one-line summary of every sheet in the campaign. When a message names a character ("Can **Kira** climb the tower?"), it reads that sheet in full.

Every sheet belongs to the Universal Login account that imported it, like Writer documents. The sheets are kept in the **`character_sheets`** table of the IPRPS core database (10.2), which Character Sheets also creates on first use.

| Field | What it holds |
|---|---|
| `id`, `user_id` | The sheet, and the Session Master's account (`ip_users.id`) |
| `campaign_id` | The campaign (optional; cleared if the campaign is deleted) |
| `kind` | `pc` (player character), `npc` or `creature` |
| `name`, `player_name`, `race`, `class`, `level`, `hp`, `mp`, `armor` | Copied from the sheet for lists and searches (for creatures, `race` holds the type and `class` the threat) |
| `sheet_json` | The whole sheet as JSON, in the Character Creator's format (`format: iprps-character-sheet`, `formatVersion: 1`, `sheetType`) |
| `avatar`, `thumb` | The portrait (at most 768 pixels) and a small copy for lists |
| `source`, `file_name` | Where it came from (`import`, `editor`, `oracle`, `table`) and the imported file's name |
| `notes` | The Session Master's private notes (the Oracle reads them too) |
| `created_at`, `updated_at` | When it was added and last changed |

Imported sheets are checked before they're stored. Numbers are kept in range and HP, Mana Pool, Speed and Dodge are worked out again with the Character Creator's formulas. Names that end up in the page are cleaned, and anything that isn't a PNG, JPEG, GIF or WebP portrait is left out, because the files come from other people's computers.

**1. Copy the apps and the updated Hub and Table files. [DEBIAN ROOT]** From the newest repository (`apps/character-creator/`, `apps/character-sheets/`, and the updated `apps/hub/`, `apps/table/` and `apps/oracle/`):

```bash
R=/mnt/g/IPRPS/iprps-os
cp -rv $R/apps/character-creator $R/apps/character-sheets /mnt/iprps/srv/www/iprps/
cp -v $R/apps/hub/default-apps.json $R/apps/hub/app-names.json /mnt/iprps/srv/www/iprps/hub/
cp -rv $R/apps/table/. /mnt/iprps/opt/iprps/table/
[ -d /mnt/iprps/srv/www/iprps/oracle ] && cp -v $R/apps/oracle/{api.php,prompts.php,index.html,oracle.js,oracle.css} /mnt/iprps/srv/www/iprps/oracle/
```

The last line only does something in Medium and Advanced, where the Oracle is installed (Part 15). It leaves the Oracle's `config.php` as it is. In Lite, run it again after Part 15's step 8, or install the Oracle from this repository, which already has the changes.

**2. Permissions, menu entries and the schema. [IPRPS CHROOT]**

```bash
for d in character-creator character-sheets; do
  chown -R root:apache /srv/www/iprps/$d
  find /srv/www/iprps/$d -type d -exec chmod 755 {} + ; find /srv/www/iprps/$d -type f -exec chmod 644 {} +
done
chown -R root:root /opt/iprps/table
find /opt/iprps/table -type d -exec chmod 755 {} + ; find /opt/iprps/table -type f -exec chmod 644 {} +
install -vDm644 /srv/www/iprps/character-sheets/favicon.svg /usr/share/icons/hicolor/scalable/apps/iprps-character-sheets.svg
install -vDm644 /srv/www/iprps/character-creator/favicon.svg /usr/share/icons/hicolor/scalable/apps/iprps-character-creator.svg
cat > /usr/share/applications/iprps-character-sheets.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Character Sheets
GenericName=IPRPS Character Sheets
Comment=Every player's, NPC's and creature's sheet: import, view, print, and use them at the table
Exec=iprps-open character-sheets/
Icon=iprps-character-sheets
Terminal=false
Categories=X-IPRPS;Game;
Keywords=character;sheet;npc;creature;player;stats;
EOF
cat > /usr/share/applications/iprps-character-creator.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Character Creator
GenericName=IPRPS Character Sheet
Comment=Fill in an IPRPS character sheet
Exec=iprps-open character-creator/
Icon=iprps-character-creator
Terminal=false
Categories=X-IPRPS;Game;
Keywords=character;sheet;creator;
EOF
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database /usr/share/applications
grep -q 'character_sheets' /usr/share/iprps/schema/iprps-core.sql || cat >> /usr/share/iprps/schema/iprps-core.sql << "EOF"

CREATE TABLE IF NOT EXISTS character_sheets (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  campaign_id   INT UNSIGNED NULL,
  kind          ENUM('pc','npc','creature') NOT NULL DEFAULT 'pc',
  name          VARCHAR(120) NOT NULL,
  player_name   VARCHAR(100),
  race          VARCHAR(80),
  class         VARCHAR(80),
  level         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  hp            INT,
  mp            BIGINT,
  armor         SMALLINT,
  sheet_json    LONGTEXT NOT NULL,
  avatar        MEDIUMTEXT,
  thumb         TEXT,
  source        ENUM('import','editor','oracle','table') NOT NULL DEFAULT 'import',
  file_name     VARCHAR(200),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner (user_id, kind, name),
  INDEX idx_campaign (campaign_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
EOF
grep -c "CREATE TABLE" /usr/share/iprps/schema/iprps-core.sql
ls -A /srv/www/iprps/character-creator /srv/www/iprps/character-sheets
grep -c 'character-sheets' /srv/www/iprps/hub/default-apps.json
grep -c 'SHEET_PAGE' /opt/iprps/table/server.js
```

**What you should see:**
- `grep -c "CREATE TABLE"` prints **12**.
- `character-creator` holds `favicon.svg` and `index.html`.
- `character-sheets` holds `.user.ini` (raises PHP's upload size for sheets with portraits to 16 MB), `api.php`, `favicon.svg`, `index.html`, `lib.php`, `sheets.css` and `sheets.js`.
- The last two lines print **1** or more. The Table service picks up its new files at the next boot (`sudo systemctl restart iprps-table` on a running system).

> **Side note:** The Hub's default apps now include **Character Sheets** and **Character Creator**, after IPRPS Table. Accounts that already saved their own choice in **Manage apps** keep it. New apps follow the defaults, so the two appear switched on until the account saves again.

**3. Test. [TEST VM]** Fresh test copy, signed in.

1. **Hub:** open the **Session Master Hub**. The tiles **Character Sheets** and **Character Creator** are there.
2. **A file from a player:**
   - In **Character Sheets**, click **Blank sheet for players ⇩** and open the saved `IPRPS-Character-Sheet.html` from the Downloads folder.
   - Fill in a character, click **Export .json**, then use **Import sheets…** in Character Sheets with that file and a campaign.
   - The sheet appears under **Players**. Import the same file again: the import result says **updated**, not added.
3. **Editing:**
   - **Edit** opens the Character Creator with the sheet. Change something and click **💾 Save to Character Sheets**; Character Sheets shows the change.
   - **New ▾ → Creature sheet**: fill in a name and an attack, then save. **Print** prints only the sheet.
4. **The Table:**
   - Open the table (12.7) and join from a second browser window.
   - The player's **📜 Sheet** opens the Character Creator. Fill in a name and click **Send to the Session Master**.
   - In the console, **Import to Character Sheets** opens the **📜 Character sheets** panel with the sheet. A green dot means the player is at the table.
   - **Show to …** puts the sheet on the player's screen.
5. **Medium and Advanced:**
   - In the Oracle, **Character sheets → NPC sheet** writes a sheet and saves it; **📇 Open the sheet** opens it.
   - Ask the Oracle about a character by name, and its answer uses that sheet.

> **Note:** For the **Lite** release that is already published, add the character sheets with *Lite fixes* at the start of Part 15. Run steps 1 and 2 with `IPRPS_IMG` pointing at the Lite release copy, then clean and pack Lite again (13.4, 13.5), and make its ISO again (13.9).

> **Pro tip:** A Session Master can keep a library of NPCs and creatures with no campaign (**No campaign**) and assign them to a campaign when they're needed. The Oracle reads the sheets of the campaign you choose, plus any sheet you name in a message.

### 12.10 Session tools: Combat, Dice, Session Log, Welcome and File Viewer

Five more apps complete the Session Master's toolkit, in every edition. Like Character Sheets, they're web apps in `/srv/www/iprps`, behind the Universal Login, and they open from the Hub and the menu.

| App | Folder | What it does |
|---|---|---|
| **Initiative and Combat Tracker** | `combat` | Encounters per session. Add combatants from Character Sheets (the whole party in one click; *n* goblins numbered) or by hand. Roll initiative (1d20 + DEX − 10), step through turns and rounds, track HP with **Damage − AR**, conditions and who is down. Covers all five combat modes, shows the turn order to the players, and logs the fight |
| **Dice Roller** | `dice` | Any dice (`2d6+3`, `4d6kh3`, `1d6!`), Band A and B for a d20, and every IPRPS roll: skill check, initiative, Trinity Hand, Dual-Die, Infinite Convergence, RPS, weapon damage. Rolls can be logged to the session and shown to the players; secret rolls stay private |
| **Session Log and Recap** | `session-log` | Campaigns and sessions; a timeline of notes, events, combat, rolls, loot and XP (the other tools write into it); the players' **recap** and private **Session Master notes**; who played and the XP they got. Drafts a recap from the log (and, in Medium and Advanced, with the Oracle); shows, copies, prints or downloads it |
| **IPRPS Welcome** | `welcome` | The first-login tour: what's installed, a first campaign, the tools, the **color scheme** (Night, Parchment, Forest, High contrast) and the **API key vault** for online AI apps |
| **IPRPS File Viewer** | `file-viewer` | Opens and **checks** `.iprps` (character sheets), `.ipai` (AI profiles and Profile Patches), `.srpatch` (Session Run Patches) and `.capstone`/`.pcapstone` files: required fields and sections, value ranges, Development Point totals, DC/AC instead of BTN/AR. Reads them formatted or raw, and imports sheets into Character Sheets |

**How they work together**

- **One campaign and session for all of them.** Combat, Dice and Session Log share a **Campaign / Session** picker at the top. The choice is remembered, so switching apps keeps your place. **+ New campaign…** and **✎** make and edit campaigns; **+ Session** starts the next session (numbered automatically).
- **One log.** Combat (start, who went down, the end with everyone's HP), dice rolls (when **Add it to the session log** is on), the XP awards and your own entries all land in the chosen session's log. The Oracle reads the latest session's log as campaign memory.
- **Showing things to the players.** **Show order…**, **Show to the players…** and the dice options send text to the **player display** (second screen, Session Master Mode) and/or the **IPRPS Table** (players' devices, while the table is open). The web server passes these to the Table on this computer, because the Table takes Session Master requests from this computer only.
- **Shared code:** `/srv/www/iprps/iprps-lib/` holds the common look and color schemes, the campaign picker, the IPRPS dice rules (the same as the Table's `dice.js`), a Markdown reader and the shared API. It isn't an app: the Hub doesn't list it (it has no start page).

**Database additions.** The apps add what they need to the IPRPS core database (10.2) on first use, once. The version is recorded in the `iprps_meta` table, so nothing changes on a fresh install.

| Table | Added |
|---|---|
| `encounters` | `mode` (standard, trinity, rps, dual, convergence), `turn_idx` (whose turn), `created_at` |
| `initiative` | `hp_max`, `ar`, `init_mod` (added to the initiative d20), `side` (party, ally, foe, neutral), `sheet_id` (the Character Sheets sheet it came from), `defeated`, `rolled`, `notes`; `conditions` holds the conditions separated by `\|` |
| `user_settings` (new) | Per-account settings: `user_id`, `name`, `value` (the color scheme, the tour's progress) |
| `user_secrets` (new) | The API key vault: `user_id`, `provider`, `label`, `secret_enc` (encrypted), `hint` (the last characters), `updated_at` |
| `display_items` | The player display's items. It's the same table the Hub and the Oracle use, created here too if it's missing |
| `iprps_meta` (new) | `k`, `v`: the version of these additions |

**The API key vault.**
- Keys are encrypted with AES-256-GCM, using a key that IPRPS Welcome creates in `/var/lib/iprps-vault/vault.key`. That folder is readable by the web server only (`apache`, mode 700).
- Each key is bound to its account and service, and the release cleanup (13.4) deletes the vault key with the test data.
- Apps that need a key ask for it with the user's sign-in: `GET /iprps/welcome/api.php?action=secret&provider=anthropic` (or `google`, `openai`, `xai`, `leonardo`, `elevenlabs`, `kling`, or a name the user chose) returns `{"ok":true,"secret":"…"}` for that account only.
- The IPRPS web apps from the live server keep their own key settings until they're changed to ask the vault (12.5).

**1. Copy the apps. [DEBIAN ROOT]** From the newest repository. The Combat Tracker adds combatants from Character Sheets, so do 12.9 first if you want that (the first line checks; the other tools work without it):

```bash
[ -d /mnt/iprps/srv/www/iprps/character-sheets ] || echo "Note: Character Sheets (12.9) isn't installed yet"
R=/mnt/g/IPRPS/iprps-os
cp -rv $R/apps/iprps-lib $R/apps/combat $R/apps/dice $R/apps/session-log $R/apps/welcome $R/apps/file-viewer /mnt/iprps/srv/www/iprps/
cp -v $R/apps/hub/default-apps.json $R/apps/hub/app-names.json /mnt/iprps/srv/www/iprps/hub/
[ -d /mnt/iprps/srv/www/iprps/oracle ] && cp -v $R/apps/oracle/api.php /mnt/iprps/srv/www/iprps/oracle/
```

The last line (Medium and Advanced) gives the Oracle the **recap** action used by **✦ Draft with the Oracle**.

**2. Permissions, the vault folder, menu entries and the first-login tour. [IPRPS CHROOT]**

```bash
for d in iprps-lib combat dice session-log welcome file-viewer; do
  chown -R root:apache /srv/www/iprps/$d
  find /srv/www/iprps/$d -type d -exec chmod 755 {} + ; find /srv/www/iprps/$d -type f -exec chmod 644 {} +
  [ -f /srv/www/iprps/$d/favicon.svg ] && install -Dm644 /srv/www/iprps/$d/favicon.svg /usr/share/icons/hicolor/scalable/apps/iprps-$d.svg
done
install -vdm700 -o apache -g apache /var/lib/iprps-vault
while IFS='|' read -r app name generic comment cats; do
cat > /usr/share/applications/iprps-$app.desktop << DESKTOP
[Desktop Entry]
Type=Application
Name=$name
GenericName=$generic
Comment=$comment
Exec=iprps-open $app/
Icon=iprps-$app
Terminal=false
Categories=$cats
DESKTOP
done << "LIST"
combat|Initiative and Combat Tracker|Combat Tracker|Turn order, rounds, HP, Armor Rating and conditions|X-IPRPS;Game;
dice|Dice Roller|IPRPS Dice|Any dice and every IPRPS roll, logged to the session|X-IPRPS;Game;
session-log|Session Log and Recap|Session Log|What happened each session, the recap, and who played|X-IPRPS;Game;
welcome|IPRPS Welcome|Welcome Tour|The tour, your first campaign, color scheme and API keys|X-IPRPS;
file-viewer|IPRPS File Viewer|IPRPS File Viewer|Open and check .iprps, .ipai, .srpatch and .capstone files|X-IPRPS;Utility;
LIST
cat > /usr/bin/iprps-welcome-once << "EOF"
#!/bin/bash
# iprps-welcome-once - open IPRPS Welcome at a user's first desktop login (once per user)
DONE="$HOME/.config/iprps/welcome-shown"
[ -e "$DONE" ] && exit 0
mkdir -p "$HOME/.config/iprps" && touch "$DONE"
sleep 6                               # let the desktop and the web services settle
exec iprps-open welcome/
EOF
chmod 755 /usr/bin/iprps-welcome-once
cat > /etc/xdg/autostart/iprps-welcome.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=IPRPS Welcome (first login)
Exec=/usr/bin/iprps-welcome-once
NoDisplay=true
EOF
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database /usr/share/applications
ls /usr/share/applications/iprps-{combat,dice,session-log,welcome,file-viewer}.desktop
ls -ld /var/lib/iprps-vault
php -r 'echo function_exists("openssl_encrypt") ? "openssl OK\n" : "openssl MISSING\n";'
```

**What you should see:**
- `ls` lists the five launchers.
- `ls -ld` shows `drwx------ … apache apache`.
- `php -r` prints **openssl OK** (IPRPS builds PHP with `--with-openssl`, Stage F).

> **Side note:** The Hub's default apps (`hub/default-apps.json`) now also include **Session Log**, **Combat Tracker**, **Dice Roller** and **IPRPS File Viewer**; **IPRPS Welcome** is in the menu and opens once at each user's first login. Accounts that saved their own Hub choice see the new apps switched on until they save again.

**3. The release cleanup forgets the vault key. [DEBIAN ROOT]** Section 13.4's `iprps-release-clean.sh` now empties `/var/lib/iprps-vault` (each install makes its own key at first use). If you installed the script before this change, update it:

```bash
install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-release-clean.sh /root/
grep -c 'iprps-vault' /root/iprps-release-clean.sh
```

It prints **2**. This installs the current script from the repository (writing it again from 13.4 does the same).

**4. Test. [TEST VM]** Fresh test copy, new user.

1. **Welcome:**
   - About six seconds after the first login, **IPRPS Welcome** opens. Go through it: create a campaign, pick **Parchment**, store a test key (it shows only its last characters), then **Finish**.
   - Log out and in: Welcome doesn't open again. (Menu → **IPRPS Welcome** opens it any time.)
2. **Session Log:** choose the campaign, then **+ Session**. Add a note and an event.
3. **Dice Roller:**
   - With **Add it to the session log** on, roll a d20 and a **Skill check**. Both appear in the Session Log's timeline.
   - The colors are Parchment here too.
4. **Combat Tracker:**
   - **+ New** encounter. Add yourself from **From sheets** (or **Quick add**) and three goblins (**How many** 3, HP 40, AR 1).
   - **▶ Start combat**, damage a goblin by 45 (it takes 44 after AR 1 and goes down), **Next turn** a few times, then **■ End combat**.
   - The Session Log shows *Combat started…*, *Goblin 1 is down…* and *Combat ended…*.
5. **Showing it to the players:**
   - With the IPRPS Table open and a player joined (12.7), **Show order…** with **IPRPS Table** ticked puts the order on the player's screen.
   - In Session Master Mode with two screens, **Player display** does the same there.
6. **Recap:** in the Session Log's **Recap** tab, **Draft from the log** writes a draft. In Medium and Advanced, **✦ Draft with the Oracle** adds the Oracle's version.
7. **File Viewer:**
   - Open a Character Creator `.json`/`.iprps` export: **Check** lists its attributes, skills and Development Points; **📜 Import to Character Sheets** adds it.
   - Open any `.srpatch` or `.capstone` file to see its check.

| Problem | Fix |
|---|---|
| *The key vault folder /var/lib/iprps-vault is missing or not writable* | Step 2's `install -vdm700 -o apache -g apache /var/lib/iprps-vault` |
| *The IPRPS Table service is not running* / *is closed* when showing to players | Start or open the table in the Table console (12.7). The player display works without it |
| A tool says *Choose or start a session first* | Choose the campaign at the top, then **+ Session** (or pick an existing session) |
| *That stored key can't be read (the vault key changed)* | The vault key was deleted (for example by the release cleanup on a test image). Delete the key in Welcome and store it again |
| Colors don't change in the Hub, Writer, Oracle or Character Sheets | The color scheme applies to the session tools and Welcome; the other apps keep their own look for now |

### 12.11 Soundboard

The **Soundboard** (`soundboard`) is the last of the Session Master's tools, in every edition: one-click sound effects and ambience during play.

- **Boards of pads.** A new account starts with two boards:
  - **Ambience** (loops): rain, storm, wind, campfire, ocean waves, river, cave drips, night crickets, dungeon drone, tavern hum.
  - **Effects** (one-shots): thunder, sword clash, heavy hit, arrow, spell whoosh, magic chime, gong, church bell, heartbeat, door knock, door creak, coins, dice rattle, war horn, level up, monster growl.
  - Make more boards (**+ Board**) for a tavern, a battle or a crypt.
- **Built-in sounds need no files.** The computer makes them as they play (Web Audio), so they work offline, never run out and carry no licenses. Loops vary as they play, so they don't sound like a short recording repeating.
- **Your own sounds.** **Add files…** (or drop files on the window) adds MP3, OGG/Opus, WAV, M4A/AAC, FLAC or WebM recordings and music, up to 50 MB each and 2 GB per account. **+ Pad** puts one on the board.
- **Playing.**
  - A pad marked **∞** loops until you click it again, and several loops play together, each with its own volume slider while it plays. Other pads play once.
  - Loops can fade in. **■ Stop all** (or **Esc**) fades everything out.
  - Keys **1**–**0** and **Q**–**P** play the first twenty pads of the board, and the master volume is at the top.
- **Editing.** **✎ Edit pads**, then click a pad to change its sound, name, emoji, color, once/loop, volume and fade, or to move or delete it. Boards are renamed, moved and deleted the same way.
- **On the players' devices.**
  - A pad playing one of **your** files can be set to **Also on players' devices**. While the IPRPS Table is open (12.7), the file then plays on every player's phone or laptop too. The web server hands the file to the Table on this computer the first time.
  - The Table plays one sound per player at a time. The built-in sounds play on this computer's speakers only.

Every account has its own boards (stored in `user_settings` as `soundboard`) and its own files: the table `sound_files` (`id`, `user_id`, `name`, `file`, `mime`, `size`, `table_media`, `created_at`), created on first use, with the audio in `/var/lib/iprps-sounds/<account>/`. That folder is readable by the web server only, and files are fetched with the sign-in token. The release cleanup (13.4) empties it.

**1. Copy the app. [DEBIAN ROOT]** The Soundboard uses the session tools' shared code, so **12.10 must be done first** (the first line checks):

```bash
[ -d /mnt/iprps/srv/www/iprps/iprps-lib ] || echo "STOP: do 12.10 first (iprps-lib and IPRPS Welcome are missing)"
R=/mnt/g/IPRPS/iprps-os
cp -rv $R/apps/soundboard /mnt/iprps/srv/www/iprps/
cp -v $R/apps/hub/default-apps.json $R/apps/hub/app-names.json /mnt/iprps/srv/www/iprps/hub/
cp -v $R/apps/iprps-lib/api.php /mnt/iprps/srv/www/iprps/iprps-lib/
cp -v $R/apps/welcome/{welcome.js,index.html} /mnt/iprps/srv/www/iprps/welcome/
```

The last two lines add the Soundboard to IPRPS Welcome's list of tools.

**2. Permissions, the sound folder and the menu entry. [IPRPS CHROOT]**

```bash
chown -R root:apache /srv/www/iprps/soundboard
find /srv/www/iprps/soundboard -type d -exec chmod 755 {} + ; find /srv/www/iprps/soundboard -type f -exec chmod 644 {} +
install -Dm644 /srv/www/iprps/soundboard/favicon.svg /usr/share/icons/hicolor/scalable/apps/iprps-soundboard.svg
install -vdm700 -o apache -g apache /var/lib/iprps-sounds
cat > /usr/share/applications/iprps-soundboard.desktop << "EOF"
[Desktop Entry]
Type=Application
Name=Soundboard
GenericName=IPRPS Soundboard
Comment=One-click sound effects and ambience during play
Exec=iprps-open soundboard/
Icon=iprps-soundboard
Terminal=false
Categories=X-IPRPS;AudioVideo;Audio;
Keywords=sound;effects;ambience;music;
EOF
gtk-update-icon-cache -qtf /usr/share/icons/hicolor
update-desktop-database /usr/share/applications
ls -A /srv/www/iprps/soundboard
ls -ld /var/lib/iprps-sounds
```

**What you should see:**
- `ls -A` lists `.user.ini` (allows 50 MB uploads), `api.php`, `favicon.svg`, `index.html`, `sound.css`, `sound.js` and `synth.js`.
- `ls -ld` shows `drwx------ … apache apache`.

**3. The release cleanup empties the sound folder. [DEBIAN ROOT]** Section 13.4's script now includes `/var/lib/iprps-sounds/*`. To update a script installed earlier:

```bash
install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-release-clean.sh /root/
grep -c 'iprps-sounds' /root/iprps-release-clean.sh
```

It prints **2**. This installs the current script from the repository, which also has 12.10's change.

**4. Test. [TEST VM]**

1. **Built-in sounds:** open **Soundboard** from the menu or the Hub. Click **Rain**, then **Campfire**: both loop, glow and show a volume slider. **Esc** fades them out.
2. **Effects:** on **Effects**, press **1** for thunder.
3. **Your own file:** **Add files…** with an MP3, then **+ Pad**, then **Save**. The pad plays it.
4. **On the players' devices:** with the IPRPS Table open and a player joined, edit that pad, tick **Also on players' devices**, and play it. The player hears it after tapping **Tap to turn on the table sound** once.

| Problem | Fix |
|---|---|
| *The sound folder /var/lib/iprps-sounds is missing or not writable* | Step 2's `install -vdm700 -o apache -g apache /var/lib/iprps-sounds` |
| A large file fails with *The file was empty (or larger than the upload limit)* | `ls -A /srv/www/iprps/soundboard/.user.ini` must exist (it allows 64 MB requests). Files over 50 MB aren't accepted |
| No sound at all | Check the master volume and the desktop's volume (panel). In a QEMU VM started with `-audio none`, there is no sound device |
| *The IPRPS Table is closed* | Open the table in its console first; built-in sounds and pads without **Also on players' devices** don't need it |

### 12.12 Package manager: pacman and IPRPS Updates

From here on, IPRPS OS installs updates **without reinstalling**: security fixes, new versions of the IPRPS apps, and optional software that an edition doesn't include. The tool is **pacman**, Arch Linux's package manager, built from source like everything else. Every edition gets it.

**How it fits together:**

| Piece | What it is |
|---|---|
| **pacman 7.1.0** | Installs, updates and removes packages (`.pkg.tar.zst` files), keeps track of every file a package owns, and checks dependencies. **makepkg** builds packages from recipes called **PKGBUILDs**. |
| **Three repositories** on infiniteplane.space | **`iprps-core`**: pacman, the signing key, the system, the edition packages and security updates. **`iprps-apps`**: the IPRPS apps, one package each. **`iprps-extra`**: optional software. Address: `https://infiniteplane.space/downloads/iprps/repo/1/<repository>/x86_64/` (`1` = the IPRPS OS 1.x series). |
| **Signatures** | Every package and every repository list is signed with the **IPRPS signing key**, which you create in step 1. Computers refuse anything unsigned or signed by another key, even if the server or a mirror were tampered with. The private key stays in Debian and on your D: drive; it is never in the image or in Git. |
| **`iprps-base`** | pacman's settings (`/etc/pacman.conf`, `/etc/pacman.d/iprps-mirrorlist`), **IPRPS Updates**, `iprps-update`, the update check timer and the notifications. Its version *is* the IPRPS OS version: a point release (1.0.1) raises it and adds what the release needs (Part 17). |
| **Edition packages** | `iprps-lite`, `iprps-medium`, `iprps-advanced`: exactly one is installed (13.4 picks it). Each depends on that edition's IPRPS apps, so an app added to an edition later arrives with the next update. Medium and Advanced also tell pacman about software they have that isn't packaged yet (Ollama; Advanced also XCB Utilities' `libxcb-cursor`). |
| **IPRPS app packages** | `iprps-hub`, `iprps-table`, `iprps-writer`, `iprps-oracle` and the others: the files from 12.5–12.11, built from the repository (`packages/iprps-apps`). Users' data is never in a package: it stays in the database and in `/var/lib`. |
| **IPRPS Updates** (menu: IPRPS → IPRPS Updates) | A window for administrators: what's waiting, **Install updates**, optional software to **Install** or **Remove**, and the automatic-check setting. It asks for the administrator's password (polkit), then runs on this computer only, for that account only. |
| **`iprps-update`** | The same in a terminal: `sudo iprps-update` (status), `check`, `upgrade`, `extras`, `install NAME`, `remove NAME`, `auto on/off`. |
| **Automatic check** | `iprps-update-check.timer`: 10 minutes after start and every 6 hours, when online, it downloads the package lists (nothing else) into a separate copy. Administrators get a desktop notification when updates are ready, and the Hub's **IPRPS Updates** tile shows them. |

> **Side note:** **Adopting the release's files.** The system was built without a package manager, so pacman doesn't know who owns most files. The first time a package arrives for something already installed (the Hub, say, or a rebuilt cURL), it **takes over** those files. That's what `--overwrite` does: `iprps-update` allows it only under `/usr`, `/opt` and `/srv/www/iprps`, never in `/etc`. `iprps-repo.sh check` (step 8) makes sure no two IPRPS packages contain the same file, so taking over can never steal a file from another package.

**Privacy:** the update check is an ordinary download from infiniteplane.space (the server sees the computer's IP address, as with any web page). Nothing about the user or the computer is sent. Users can switch it off in IPRPS Updates (**Settings**) or with `sudo iprps-update auto off`.

**1. The signing key, and the publishing tools. [DEBIAN ROOT]** Unzip the newest repository over `G:\IPRPS\iprps-os` first. It has the recipes (`packages/`), the Hub tile (`apps/updates-tile/`) and `build-host/iprps-repo.sh`.

```bash
apt install pacman-package-manager makepkg gnupg rsync libarchive-tools zstd curl
install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-repo.sh /root/
/root/iprps-repo.sh key
```

`iprps-repo.sh key` creates the key (**ed25519**, valid 5 years) as *IPRPS OS Packages &lt;packages@infiniteplane.space&gt;*; set `IPRPS_KEY_UID="Name <address>"` before it to use another name. It asks for a **passphrase** twice: choose a strong one and keep it in a password manager. You type it whenever you publish.

**What you should see:** *Signing key* followed by 40 characters (the **fingerprint**), and:

- `D:\IPRPS\keys\iprps-signing-key-PRIVATE.asc`: the private key, protected by the passphrase, plus `iprps-signing-key-revoke.rev`. **Copy both to a USB stick** kept somewhere safe. Never upload them, email them or put them in Git. If the PC dies, `gpg --import` of that file brings the key back.
- `G:\IPRPS\iprps-os\packages\iprps-keyring\iprps.gpg` and `iprps-trusted`: the **public** key and its fingerprint. These belong in Git, and the keyring package is built from them.

> **Warning:** The newest repository zips don't contain `iprps.gpg` or `iprps-trusted`, so unzipping one never wipes your key files. If they're ever lost, run `/root/iprps-repo.sh key` again: it reuses the existing key and writes them back.

**2. GnuPG, GPGME and fakeroot.** pacman checks signatures through **GPGME** and **GnuPG** (both BLFS 13.1), and makepkg builds packages inside **fakeroot** (not in BLFS; from Debian).

**[BUILDER]** — GnuPG 2.5.21. IPRPS builds it without LDAP (address-book servers), so OpenLDAP isn't needed:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/gnupg/gnupg-2.5.21.tar.bz2
md5sum gnupg-2.5.21.tar.bz2          # must print 39311d55044c9548b5eb8f53466a86b5
tar -xf gnupg-2.5.21.tar.bz2 && cd gnupg-2.5.21
mkdir build && cd build
../configure --prefix=/usr --localstatedir=/var --sysconfdir=/etc \
             --docdir=/usr/share/doc/gnupg-2.5.21 --disable-ldap &&
make
```

**[IPRPS CHROOT]**

```bash
cd /build/src/gnupg-2.5.21/build && make install
gpg --version | head -1
```

**[BUILDER]** — GPGME 2.1.2:

```bash
cd ~/src
wget https://www.gnupg.org/ftp/gcrypt/gpgme/gpgme-2.1.2.tar.bz2
md5sum gpgme-2.1.2.tar.bz2           # must print 58448073da13a22e878adfb22a988d4d
tar -xf gpgme-2.1.2.tar.bz2 && cd gpgme-2.1.2
mkdir build && cd build
../configure --prefix=/usr --disable-static &&
make
```

**[IPRPS CHROOT]**

```bash
cd /build/src/gpgme-2.1.2/build && make install
ls /usr/lib/libgpgme.so*
```

**[BUILDER]** — fakeroot 1.37.2 (Debian's upstream tarball, from Debian's permanent archive):

```bash
cd ~/src
wget https://snapshot.debian.org/archive/debian/20260401T000000Z/pool/main/f/fakeroot/fakeroot_1.37.2.orig.tar.gz
sha256sum fakeroot_1.37.2.orig.tar.gz   # must print 0eea60fbe89771b88fcf415c8f2f0a6ccfe9edebbcf3ba5dc0212718d98884db
tar -xf fakeroot_1.37.2.orig.tar.gz && cd fakeroot-1.37.2
[ -x configure ] || ./bootstrap
./configure --prefix=/usr --libdir=/usr/lib/libfakeroot --disable-static --with-ipc=sysv &&
make
```

**[IPRPS CHROOT]**

```bash
cd /build/src/fakeroot-1.37.2 && make install
grep -q '^include /etc/ld.so.conf.d' /etc/ld.so.conf || echo 'include /etc/ld.so.conf.d/*.conf' >> /etc/ld.so.conf
install -dm755 /etc/ld.so.conf.d && echo /usr/lib/libfakeroot > /etc/ld.so.conf.d/fakeroot.conf && ldconfig
su - builder -c 'fakeroot id -u'
```

The last line prints **`0`**: inside fakeroot, `builder` looks like root, so packages get root-owned files without anyone being root.

> **Side note:** Why this address: Debian's normal download server keeps only the current version, so links to it break (*404 Not Found*). `snapshot.debian.org` keeps every version permanently. IPRPS uses **1.37.2**, the newest 1.x release; fakeroot 2.x changed how it handles file attributes and has known problems (Buildroot went back to 1.37.2 for that reason).

**3. pacman 7.1.0, the first time.** This builds pacman by hand so that it can then package everything, itself included (step 6).

**[BUILDER]**

```bash
cd ~/src
wget https://gitlab.archlinux.org/pacman/pacman/-/releases/v7.1.0/downloads/pacman-7.1.0.tar.xz
tar -xf pacman-7.1.0.tar.xz && cd pacman-7.1.0
meson setup --prefix=/usr --sysconfdir=/etc --localstatedir=/var --buildtype=release \
      -D doc=disabled -D i18n=true -D crypto=openssl -D gpgme=enabled -D curl=enabled \
      -D scriptlet-shell=/usr/bin/bash -D ldconfig=/usr/sbin/ldconfig -D pkg-ext=.pkg.tar.zst build &&
ninja -C build
```

**[IPRPS CHROOT]**

```bash
cd /build/src/pacman-7.1.0 && ninja -C build install
cat > /etc/pacman.conf << "EOF"
# Temporary (12.12 step 3): iprps-base replaces this in step 7
[options]
Architecture = x86_64
SigLevel = Required
LocalFileSigLevel = Optional
EOF
pacman --version | grep -o 'Pacman v[0-9.]*'
ldd /usr/bin/pacman | grep -cE 'libalpm|libgpgme|libcurl|libarchive'
install -dm755 -o builder -g builder /build/repo
```

**What you should see:** `Pacman v7.1.0`, and `4` from `ldd` (pacman found its four libraries). `/build/repo` is where every package you build lands.

**4. makepkg settings for `builder`. [BUILDER]**

```bash
cat > ~/.makepkg.conf << "EOF"
# IPRPS OS package builds (12.12). Removed with the builder account at release (13.4).
PKGDEST=/build/repo
SRCDEST=/build/src
PACKAGER="IPRPS OS <packages@infiniteplane.space>"
OPTIONS=(strip docs !libtool !staticlibs emptydirs zipman purge !debug !lto)
MAKEFLAGS="-j4"
PKGEXT='.pkg.tar.zst'
EOF
grep -E '^CARCH' /etc/makepkg.conf
```

`grep` shows `CARCH="x86_64"`. `PKGEXT` makes packages **zstd**-compressed (`.pkg.tar.zst`), like Arch's: pacman's own default is `.pkg.tar.gz`, which `iprps-repo.sh` and step 7 don't accept.

**5. Copy the repository into the image. [DEBIAN ROOT]** The app packages are built from it, so copy it again whenever the apps change (Part 17):

```bash
rsync -a --delete /mnt/g/IPRPS/iprps-os/ /mnt/iprps/build/src/iprps-os/
chroot /mnt/iprps chown -R builder:builder /build/src/iprps-os
ls /mnt/iprps/build/src/iprps-os/packages
grep -c ':4:' /mnt/iprps/build/src/iprps-os/packages/iprps-keyring/iprps-trusted
```

`ls` lists `examples iprps-apps iprps-base iprps-keyring pacman README.md`, and `grep` prints **1** (step 1's fingerprint).

**6. Build the packages. [BUILDER]**

```bash
cd /build/src/iprps-os/packages
for p in pacman iprps-keyring iprps-base iprps-apps; do
  ( cd $p && makepkg -f --nodeps --noconfirm ) || { echo "STOPPED at $p"; break; }
done
ls /build/repo
```

- `--nodeps`: makepkg doesn't look for the packages' dependencies on this system (pacman checks them when installing, in step 7).
- pacman's recipe downloads its tarball again and runs pacman's test suite (a few minutes).
- **What you should see:** `ls` lists **20** packages: `pacman-7.1.0-1-x86_64`, `iprps-keyring-…`, `iprps-base-1.0-1-any`, `iprps-lite-…`, `iprps-medium-…`, `iprps-advanced-…` and the 14 IPRPS app packages (`iprps-hub-2026.11.01-1-any.pkg.tar.zst` and so on), each ending in `.pkg.tar.zst`.

**7. Install them: pacman takes over the system's IPRPS files. [IPRPS CHROOT]** Set `ED` to the edition this image is **now** (`advanced` once Part 16 is done; `lite` in a Lite copy):

```bash
ED=advanced
cd /build/repo
ls pacman-*.pkg.tar.zst iprps-*.pkg.tar.zst | grep -vE '^iprps-(lite|medium|advanced)-' > /tmp/iprps-pkgs
ls iprps-$ED-*.pkg.tar.zst >> /tmp/iprps-pkgs
[ "$ED" = lite ] && sed -i '/^iprps-oracle-/d' /tmp/iprps-pkgs
pacman -U --noconfirm --overwrite '*' $(cat /tmp/iprps-pkgs)
find /etc /srv/www/iprps -name '*.pacnew'
```

`--overwrite '*'` is used **only here, once**: it lets the packages take over the files you installed in 12.3–12.11 and in step 3.

`find` lists `/etc/pacman.conf.pacnew` and `/srv/www/iprps/hub/default-apps.json.pacnew` (and in Medium/Advanced `oracle/config.php.pacnew`). These are files a package keeps when you've changed them; here the existing copies are the build's own, so take the packaged versions:

```bash
for f in $(find /etc /srv/www/iprps -name '*.pacnew'); do mv -v "$f" "${f%.pacnew}"; done
pacman-key --init && pacman-key --populate iprps
gpgconf --homedir /etc/pacman.d/gnupg --kill all      # its background helper would keep the image busy
pacman -Q | wc -l
pacman -Qo /usr/bin/pacman /srv/www/iprps/hub/index.html /opt/iprps/table/server.js
pacman -Dk
systemctl is-enabled iprps-update-check.timer iprps-pacman-keyring.service iprps-table
iprps-update status
```

**What you should see:**

- `pacman -Q | wc -l`: **18** (Advanced or Medium) or **17** (Lite).
- `pacman -Qo` names `pacman`, `iprps-hub` and `iprps-table` as the owners.
- `pacman -Dk`: *No database errors have been found!*
- `systemctl is-enabled`: `enabled` three times.
- `iprps-update status`: *IPRPS OS 1.0 … (iprps-base 1.0-1, 18 packages managed)*, *Last check: never*.

The keyring made here is only for testing in the build image: 13.4 deletes it, and every installed computer makes its own at first boot (`iprps-pacman-keyring.service`).

**8. Publish the first repository. [DEBIAN ROOT]** With the chroot open (the image mounted at `/mnt/iprps`):

```bash
D=/mnt/iprps/build/repo
/root/iprps-repo.sh add iprps-core $D/pacman-*.pkg.tar.zst $D/iprps-{keyring,base,lite,medium,advanced}-*.pkg.tar.zst
/root/iprps-repo.sh add iprps-apps $(ls $D/iprps-*.pkg.tar.zst | grep -vE '/iprps-(keyring|base|lite|medium|advanced)-')
/root/iprps-repo.sh check
/root/iprps-repo.sh stage
```

- `add` signs each package (it asks for the passphrase; `gpg-agent` remembers it for a while) and builds each repository's signed package list in `/root/iprps-repo/1/` (the master copy; back it up with the snapshots).
- `check` must end with **Repository check passed.** It verifies every signature and looks for files in two packages and for `/etc` files that would overwrite users' settings.
- `stage` first gives every repository that has no packages yet (at first, `iprps-extra`) an **empty, signed list** (`iprps-repo.sh init` does just that). Every computer downloads all three lists, and a missing one would make each update check fail. Then it copies the repository to **`G:\IPRPS\repo-upload\1`**, with real files instead of links.

Then upload, in **FileZilla** or **WinSCP** (your hosting login; never stored in the repository):

1. On the server, create the folder `/downloads/iprps/repo/1/` (next to the release images).
2. Upload the **contents** of `G:\IPRPS\repo-upload\1` (the folders `iprps-core`, `iprps-apps` and `iprps-extra`) into it. Packages first; the `.db`, `.files` and `.sig` files last, so computers never see a list that names packages not uploaded yet.
3. **[DEBIAN ROOT]** `/root/iprps-repo.sh online` must end with **Online repository matches.**

**9. The release cleanup knows about pacman. [DEBIAN ROOT]** 13.4's script now installs the right **edition package** in each release copy, removes the build's keyring (each computer makes its own), and empties pacman's download cache. Install the current script:

```bash
install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-release-clean.sh /root/
grep -c 'edition package' /root/iprps-release-clean.sh
```

It prints **2**.

**10. Test. [TEST VM]** In a boot-test copy (1.4), logged in as a user in `wheel`:

1. **IPRPS menu → IPRPS Updates.** The password window (polkit) appears; then the IPRPS Updates window. **Check now**: *IPRPS OS is up to date* (the server has the same versions as the image). **IPRPS apps and optional software** lists the apps; **Part of your edition** holds the installed ones.
2. **The Hub's IPRPS Updates tile** shows the result of the last check.
3. **Terminal:** `sudo iprps-update status`, `sudo iprps-update extras`.
4. **Before uploading,** test against your own copy instead: **[DEBIAN ROOT]** `/root/iprps-repo.sh serve`, then in the VM `echo 'Server = http://10.0.2.2:8080/$repo/$arch' | sudo tee /etc/pacman.d/iprps-mirrorlist` (`10.0.2.2` is Debian, from inside QEMU). Afterwards put the real line back: `Server = https://infiniteplane.space/downloads/iprps/repo/1/$repo/$arch`.

| Problem | Fix |
|---|---|
| GnuPG's `configure` stops at *LDAP* or *OpenLDAP* | The `--disable-ldap` option is missing from the `configure` line |
| `meson setup` for pacman: *Dependency "gpgme" not found* | Step 2's GPGME isn't installed: `ls /usr/lib/pkgconfig/gpgme.pc` |
| makepkg: *Running makepkg as root is not allowed* | Run it in the **BUILDER** window, not the IPRPS CHROOT window |
| Step 6 made `.pkg.tar.gz` files; step 7 finds nothing | `PKGEXT='.pkg.tar.zst'` is missing from `~/.makepkg.conf` (step 4): add it, `rm /build/repo/*.pkg.tar.gz`, and run step 6 again |
| makepkg: *Cannot find the fakeroot binary* | Step 2's fakeroot isn't installed: `which fakeroot` |
| iprps-keyring: *iprps.gpg is missing or empty* | Step 1 (`iprps-repo.sh key`) and step 5 (copy the repository) |
| pacman: *exists in filesystem* during step 7 | `--overwrite '*'` is missing from the `pacman -U` line |
| pacman: *signature from "…" is unknown trust* / *invalid or corrupted package (PGP signature)* | This computer's keyring lacks the IPRPS key: `sudo pacman-key --init && sudo pacman-key --populate iprps` |
| IPRPS Updates: *Could not check for updates* · *No connection to the update server* | Offline, or the repository isn't uploaded yet (`iprps-repo.sh online` on the build host) |
| IPRPS Updates: *failed to retrieve some files* / *404* | The upload missed files, or the host refuses `.db` files: `iprps-repo.sh online` names what's missing. On some hosts, `.db` files need a MIME type: add `AddType application/octet-stream .db .files .sig .zst` to `/downloads/iprps/repo/.htaccess` |
| IPRPS Updates doesn't open after the password | Run `iprps-updates` in a terminal to see the message. Only administrators (group `wheel`) or someone who knows an administrator's password can open it |
| IPRPS Updates stays at *upgrading …* (iprps-base 1.0-1 only) | pacman 7.1 hung starting `ldconfig` right after downloading in the same run. The package is installed; the transaction just doesn't finish. From 1.0-2, `iprps-update` downloads first and installs in a separate run | In a terminal: `ps -eo pid,etime,args --forest \| grep pacman`, then `sudo kill <PID>` of the **inner** `pacman` (the one whose parent is also `pacman`). pacman then finishes by itself. Then install iprps-base 1.0-2 (Part 17) |
| `iprps-leave.sh`: *Still in use* with only `gpg-agent` (or `dirmngr`) listed | A key helper started inside the image by `pacman-key` or `gpg` | `kill <PID>` of it, then `iprps-leave.sh` again. The current `iprps-leave.sh` (0.5) stops them itself |
| *IPRPS Updates is open for another account* | Another user opened it on this computer. It closes 2 minutes after its window closes |

**Lite: the same in the Lite fix copy.** The Lite release was made before the package manager, so Lite gets it in the Lite fix copy (*Before Stage H*, step 4). Nothing is rebuilt there: the packages are the same for every edition, and installing them also brings Lite's apps up to date (12.9–12.11 and the icons, 9.3), because Lite's edition package depends on them.

**L1. Make the Lite copy and enter it. [DEBIAN ROOT]** Close the build image first:

```bash
bash /root/iprps-leave.sh
cp -v --sparse=always /root/snapshots/iprps-RELEASE-lite.img /root/iprps-lite-fix.img
IPRPS_IMG=/root/iprps-lite-fix.img bash /root/iprps-enter.sh
grep PRETTY_NAME /mnt/iprps/etc/os-release
```

`grep` shows **IPRPS OS 1.0** (the build image's name; the release copies get *Lite* in 13.4). Open the **IPRPS CHROOT** and **BUILDER** windows as usual (0.5): they now work on the Lite copy.

**L2. The libraries and pacman.** Do steps **2, 3 and 4** above in the Lite copy (GnuPG, GPGME, fakeroot, pacman, and `builder`'s `~/.makepkg.conf` with the `PKGEXT` line).

**L3. The packages, the first-boot script and one menu icon. [DEBIAN ROOT]** From the master repository (the newest version of every package) and the repository:

```bash
mkdir -p /mnt/iprps/build/repo
cp -v /root/iprps-repo/1/iprps-*/x86_64/*.pkg.tar.zst /mnt/iprps/build/repo/
chroot /mnt/iprps chown -R builder:builder /build/repo
install -vm755 /mnt/g/IPRPS/iprps-os/rootfs/usr/sbin/iprps-db-init /mnt/iprps/usr/sbin/
sed -i 's|^Icon=.*|Icon=iprps-session|' /mnt/iprps/usr/share/applications/iprps-session.desktop
ls /mnt/iprps/build/repo | wc -l
```

`ls` counts every package in the repository (20 or more: pacman, the keyring, `iprps-base`, three editions, `iprps-icons` and the 14 apps).

**L4. Install them. [IPRPS CHROOT]** Step 7 above with **`ED=lite`** (it leaves out the Oracle and the other editions). `wc -l` prints **18**, and after `pacman -U`, `pacman -Q | wc -l` prints **18** too. Take the `.pacnew` files as step 7 says, then:

```bash
pacman -Q iprps-lite iprps-icons iprps-hub
ls /srv/www/iprps/ | grep -cE '^(character-sheets|combat|dice|session-log|welcome|file-viewer|soundboard|updates)$'
ls -ld /var/lib/iprps-vault /var/lib/iprps-sounds
/usr/lib/iprps/iprps-icon-theme >/dev/null && find /usr/share/icons/IPRPS -xtype l | wc -l
```

The `grep -c` prints **8** (the apps from 12.9–12.11 and the Updates tile), both folders show `drwx------ … apache apache`, and the last line prints **0**.

**L5. Test. [TEST VM]** Boot a test copy of `/root/iprps-lite-fix.img` (1.4) and check the apps of 12.9–12.11, the icons, and IPRPS Updates (**Check now**: *up to date*; the Oracle shows *not in this edition*).

**L6. Release Lite, and keep the result. [DEBIAN ROOT]** As in *Before Stage H*, step 4:

```bash
IPRPS_IMG=/root/iprps-lite-fix.img bash /root/iprps-leave.sh
IPRPS_IMG=/root/iprps-lite-fix.img /root/iprps-release-clean.sh lite
/root/iprps-release-pack.sh lite
cp -v --sparse=always /root/iprps-lite-fix.img /root/snapshots/iprps-RELEASE-lite.img
bash /root/iprps-enter.sh
```

13.4's check list now shows **edition package: iprps-lite** and **pacman keyring: removed**. Make the Lite ISO too if you publish one (13.9), and back up the new `RELEASE-lite` snapshot (Appendix F).

> **Checkpoint:** All Lite IPRPS apps open from the IPRPS menu, Session Master Mode opens all three windows, and **IPRPS Updates** opens and checks. Take snapshot **`iprps-apps-lite`**.

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

**The database password, unique per installation.** The web apps (12.5) share one database user, `iprps`, for the core `iprps` database and all `iprps_*` app databases; their settings hold the placeholder `@IPRPS_DB_PASS@`. At first boot this script gives `iprps` a new random password, writes it into every app (replacing the placeholder) and into `/etc/iprps/db.php`. The backslashes in its `GRANT … iprps\\_%` line are deliberate: they give MariaDB a literal `` `iprps\_%` ``, meaning every database whose name starts with `iprps_`. It also replaces the password the apps had before: the one in `/etc/iprps/db.php` if the script runs a second time, and the build's test password (`/root/iprps-dev-db.txt`) in a boot-test copy of the build image, where the apps hold that instead of the placeholder. So the apps and the database always end up with the same password.

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
# The web apps: put this computer's password wherever the apps have the placeholder (a release),
# the previous password (a second run) or the build's test password (a test copy of the build image)
OLD=$(sed -n "s/.*'pass' => '\([A-Za-z0-9]*\)'.*/\1/p" /etc/iprps/db.php 2>/dev/null || true)
DEV=$(awk '{print $2}' /root/iprps-dev-db.txt 2>/dev/null || true)
for o in "$PH" "$OLD" "$DEV"; do
  [ ${#o} -ge 8 ] || continue
  grep -rlF "$o" /srv/www/iprps 2>/dev/null | xargs -r sed -i "s/$o/$PW/g"
done
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

 * Updates install from IPRPS Updates (IPRPS menu): security
   fixes, new app versions and optional software. No reinstalling.

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
# iprps-install — copy IPRPS OS to an internal disk: the running system (USB image),
# or, when started from the live ISO (DVD or USB), the clean system on the disc
set -euo pipefail
[ $EUID -eq 0 ] || { echo "Please run: sudo iprps-install"; exit 1; }
if [ -e /etc/iprps-live ] && mountpoint -q /run/live/rootfs; then
  SRC=/run/live/rootfs                                   # live ISO: the read-only system, not the RAM session
  MEDIUM=$(findmnt -no SOURCE /run/live/medium)
  SRC_DISK=$(lsblk -no PKNAME "$MEDIUM" 2>/dev/null || true); [ -n "$SRC_DISK" ] || SRC_DISK=$(basename "$MEDIUM")
else
  SRC=/
  SRC_ROOT=$(findmnt -no SOURCE /)
  SRC_DISK=$(lsblk -no PKNAME "$SRC_ROOT")
fi
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
  "$SRC/" "$NEW/"

ROOT_UUID=$(blkid -s UUID -o value "${P}3")
EFI_UUID=$(blkid -s UUID -o value "${P}1")
OLD_UUID=$(grep -o 'root=UUID=[^ ]*' "$SRC/boot/grub/grub.cfg" | head -1 | cut -d= -f3)
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
echo; echo "Done. Shut down, remove the USB drive or DVD, and start the computer."
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

> **Warning:** Test the installer in a VM with a second empty virtual disk before every release. Installed from a USB image, the new system keeps the user account created at first boot, and its next boot re-runs `iprps-firstboot`, which creates swap and new SSH keys for the new disk. Installed from the **live ISO** (13.9), it copies the clean system from the disc instead of the live session, so its first boot runs the full setup (account, computer name, time zone).

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
   - **package manager** (12.12): installs this edition's package (`iprps-lite`, `iprps-medium` or `iprps-advanced`, removing the others), and removes the build's pacman keyring and download cache: each computer makes its own keyring at first boot;
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

say "Package manager: edition package, keyring, cache"
if command -v pacman >/dev/null 2>&1; then
  ED=${EDC,,}
  for e in lite medium advanced; do
    [ "$e" = "$ED" ] || pacman -Rdd --noconfirm "iprps-$e" >/dev/null 2>&1 || true
  done
  if pacman -Q "iprps-$ED" >/dev/null 2>&1; then
    echo "iprps-$ED is installed."
  else
    P=$(ls -t /build/repo/iprps-$ED-[0-9]*.pkg.tar.zst 2>/dev/null | head -1 || true)
    if [ -n "$P" ]; then pacman -U --noconfirm "$P" >/dev/null && echo "Installed ${P##*/}"
    else echo "WARNING: no iprps-$ED package found (publish it first: 12.12 step 8)"; fi
  fi
  pacman -Dk 2>&1 | tail -3 || true
  rm -rf /etc/pacman.d/gnupg /var/cache/pacman/pkg/* /var/lib/iprps-updates/*   # each computer makes its own keyring
else
  echo "pacman isn't installed (12.12): this release has no package manager."
fi

say "3/4 General cleanup"
id builder >/dev/null 2>&1 && { userdel -r builder 2>/dev/null || userdel builder; rm -rf /home/builder; }
rm -f /etc/sudoers.d/90-builder-build-only /etc/sudoers.d/xorg
rm -rf /build /root/* /root/.bash_history /home/*/.bash_history /tmp/* /var/tmp/*
rm -f /etc/ssh/ssh_host_* /etc/resolv.conf
: > /etc/machine-id      # empty: a fresh ID at first boot, but not "first boot" (no systemd preset reset)
BROKEN=$(find /etc/systemd/system /etc/systemd/user -xtype l 2>/dev/null || true)
if [ -n "$BROKEN" ]; then echo "Removing broken service links:"; echo "$BROKEN" | sed 's/^/  /'; echo "$BROKEN" | xargs -r rm -f; fi
rm -rf /var/lib/iprps/*-done /var/lib/ollama/.ollama /var/log/journal/* /var/lib/iprps-table/* /var/lib/iprps-vault/* /var/lib/iprps-sounds/*   # Table test data; API key vault key; Soundboard files
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
echo "  API key vault:     $( [ -n "$(ls -A /var/lib/iprps-vault 2>/dev/null)" ] && echo 'STILL THERE' || echo 'empty')"
echo "  Soundboard files:  $( [ -n "$(ls -A /var/lib/iprps-sounds 2>/dev/null)" ] && echo 'STILL THERE' || echo 'empty')"
echo "  root password:     $(passwd -S root | awk '{print ($2=="L"||$2=="LK")?"locked":"NOT LOCKED"}')"
echo "  machine ID:        $( [ -s /etc/machine-id ] && echo 'NOT EMPTY' || echo 'empty (new ID at first boot)')"
echo "  edition:           $(grep ^PRETTY_NAME /etc/os-release)"
echo "  edition package:   $(pacman -Qq 2>/dev/null | grep -xE 'iprps-(lite|medium|advanced)' | tr '\n' ' ' || true)"
echo "  pacman keyring:    $( [ -d /etc/pacman.d/gnupg ] && echo 'STILL THERE' || echo 'removed (each computer makes its own)')"
INSIDE_EOF
chmod 755 "$INSIDE"
# The edition package (12.12): /build is Debian's folder (iprps-enter.sh mounts it), so the copy doesn't have
# it. Bring the newest one in, from the published repository or else from the local builds.
mkdir -p "$MNT/build/repo"
P=$(ls -t /root/iprps-repo/1/iprps-core/x86_64/iprps-$ED-[0-9]*.pkg.tar.zst /build/repo/iprps-$ED-[0-9]*.pkg.tar.zst 2>/dev/null | head -1 || true)
[ -n "$P" ] && cp "$P" "$MNT/build/repo/"
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
| Live ISO (13.9) as DVD and as USB, UEFI and BIOS | Live desktop as IPRPS Live; installing to a second disk gives the setup screens at its first boot |
| `systemctl --failed` | Shows nothing |

**Without Hyper-V** (Windows 11 Home, for example), run the VM tests in QEMU on an **overlay**: a small file on top of the release `.qcow2` that leaves it unchanged and acts as a 40 GB disk, so first boot has room to grow. The backing file needs its **full path**:

**[DEBIAN ROOT]**

```bash
ED=lite        # or medium / advanced
qemu-img create -f qcow2 -b /root/release/iprps-os-1.0-$ED.qcow2 -F qcow2 /root/rel-uefi.qcow2 40G
qemu-system-x86_64 -enable-kvm -cpu host -m 6G -smp 4 -bios /usr/share/ovmf/OVMF.fd \
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

### 13.9 Live ISO images: DVD and USB

Next to the `.img.xz`, each edition can ship as a **live ISO**: `iprps-os-1.0-<edition>.iso`. It starts IPRPS OS from a **DVD or a USB stick** on UEFI and BIOS computers, runs it entirely in memory without touching the computer's disks, and installs it from there with **Install IPRPS OS to This Computer**. It's the familiar "try it first" download.

| | `.img.xz` (13.5) | `.iso` (this section) |
|---|---|---|
| Media | USB stick or internal disk | **DVD** or USB stick |
| Changes are kept | Yes: it *is* the installed system | No: the live session lives in RAM and is gone at shutdown |
| First start | Setup screens, then the desktop | Straight to the desktop as **IPRPS Live** (no password) |
| Installing | Optional; copies the running system | Copies the clean system from the disc; its first boot runs the setup screens |
| Memory | The edition's minimum | The edition's minimum plus about 2 GB (the session's changes are kept in RAM). **The IPRPS Oracle in the live session needs 12 GB or more**: its model is read from the compressed disc |

The ISO is made from the same cleaned release copy as the other downloads (13.4), so it contains exactly the same system.

**1. Live support in the build image. [IPRPS CHROOT]** Once per build image. For an edition that was already released (Lite), also do it in its release copy, as in *Lite fixes* at the start of Part 15. First do 4.9's **live boot** step if you haven't, then:

```bash
cat > /usr/sbin/iprps-live-setup << "EOF"
#!/bin/bash
# iprps-live-setup - prepares the live session when IPRPS OS starts from its ISO (DVD or USB).
# The live initramfs (4.9) marks a live start with /etc/iprps-live; everything here lives in RAM
# and is gone at shutdown. Installed systems never run it.
set -u
[ -e /etc/iprps-live ] || exit 0
U=live
getent group autologin >/dev/null || groupadd -r autologin
if ! id "$U" >/dev/null 2>&1; then
  useradd -m -G users,wheel,audio,video,iprps,autologin -s /bin/bash -c "IPRPS Live" "$U"
  for g in lpadmin scanner; do getent group $g >/dev/null && usermod -aG $g "$U"; done
fi
passwd -d "$U" >/dev/null
echo "$U ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/99-iprps-live
chmod 440 /etc/sudoers.d/99-iprps-live
# No password prompts in the live session (the live user has no password)
cat > /etc/polkit-1/rules.d/05-iprps-live.rules << "LIVEEOF"
polkit.addRule(function(action, subject) {
    if (subject.user == "live") return polkit.Result.YES;
});
LIVEEOF
echo iprps-live > /etc/hostname; hostname iprps-live
sed -i '/^127\.0\.1\.1/d' /etc/hosts; echo "127.0.1.1 iprps-live" >> /etc/hosts
mkdir -p /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/50-iprps-live.conf << "LIVEEOF"
[Seat:*]
autologin-user=live
autologin-user-timeout=0
autologin-session=xfce
LIVEEOF
# The installer, on the desktop
D=/home/$U/Desktop
install -d -o "$U" -g "$U" "$D"
if [ -f /usr/share/applications/iprps-install.desktop ]; then
  install -m 755 -o "$U" -g "$U" /usr/share/applications/iprps-install.desktop "$D/"
fi
exit 0
EOF
chmod 755 /usr/sbin/iprps-live-setup
cat > /usr/lib/systemd/system/iprps-live.service << "EOF"
[Unit]
Description=IPRPS OS live session: live user, automatic login, installer on the desktop
ConditionPathExists=/etc/iprps-live
After=local-fs.target
Before=display-manager.service iprps-setup.service systemd-user-sessions.service

[Service]
Type=oneshot
ExecStart=/usr/sbin/iprps-live-setup
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl enable iprps-live.service
bash -n /usr/sbin/iprps-live-setup && echo "live setup OK"
grep -c 'run/live/rootfs' /usr/sbin/iprps-install
cd /boot && mkinitramfs 7.1.8-iprps && ls -lh /boot/initrd.img-7.1.8-iprps
```

- `iprps-live-setup` runs only on a live start (the live initramfs leaves `/etc/iprps-live` in the RAM layer). It creates the **IPRPS Live** user (`live`, no password, administrator without prompts), logs it in automatically, names the computer `iprps-live`, and puts **Install IPRPS OS to This Computer** on its desktop. Installed systems skip it.
- `grep -c 'run/live/rootfs' /usr/sbin/iprps-install` must print a number above 0: the installer knows the live ISO. If it prints `0`, write `iprps-install` again from 13.3.
- The initramfs is rebuilt, so it contains the live boot step.

**2. Tools on the build host. [DEBIAN ROOT]** Once:

```bash
apt install squashfs-tools grub-common grub-pc-bin grub-efi-amd64-bin xorriso mtools ovmf
```

These only provide files for building and testing the ISO in WSL (GRUB's BIOS and UEFI boot files, the ISO writer, the compressor, and OVMF for UEFI tests). Nothing is installed into the PC's boot setup.

**3. The ISO script. [DEBIAN ROOT]** Once (or `install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-release-iso.sh /root/` from the repository):

```bash
cat > /root/iprps-release-iso.sh << "EOF"
#!/bin/bash
# iprps-release-iso.sh <lite|medium|advanced> - guide 13.9
# Makes a live ISO (DVD or USB stick; UEFI and BIOS) from the cleaned release copy that
# iprps-release-clean.sh made. Run as root in Debian (WSL), after 13.4 (before or after 13.5).
# The ISO starts IPRPS OS in memory without touching the computer's disks; its installer
# copies the clean system to a disk. Output: /mnt/g/IPRPS/release (or set IPRPS_RELEASE_OUT).
# IPRPS_ISO_ARGS adds kernel options to the menu entries (for tests, e.g. "console=ttyS0").
set -eu
case "${1:-}" in lite|medium|advanced) ED=$1 ;; *) echo "usage: $0 lite|medium|advanced"; exit 1 ;; esac
EDC=${ED^}
REL=/root/release
NAME=iprps-os-1.0-$ED
IMG=${IPRPS_ISO_SRC:-$REL/$NAME.img}
OUT=${IPRPS_RELEASE_OUT:-/mnt/g/IPRPS/release}
LABEL="IPRPS_OS_1_0_${ED^^}"
WORK=$REL/iso-$ED
STAGE=$WORK/stage
MNT=$WORK/root
ISO=$REL/$NAME.iso
LP=""

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }
p3_loop() {
  local s n
  read -r s n < <(sfdisk -d "$1" | sed -n 's/.*3 : start= *\([0-9]*\), size= *\([0-9]*\).*/\1 \2/p') || true
  [ -n "${s:-}" ] || return 1
  losetup -r -f --show -o $(( s * 512 )) --sizelimit $(( n * 512 )) "$1"
}
cleanup() {
  mountpoint -q "$MNT" 2>/dev/null && umount "$MNT"
  [ -n "$LP" ] && losetup -d "$LP" 2>/dev/null
  true
}
trap cleanup EXIT

say "Checks"
[ "$(id -u)" = 0 ] || die "run this as root in Debian"
[ -f "$IMG" ] || die "$IMG not found: run /root/iprps-release-clean.sh $ED first"
[ -z "$(losetup -j "$IMG")" ] || die "$IMG is attached: $(losetup -j "$IMG" | cut -d: -f1) (losetup -d it)"
for t in sfdisk mksquashfs grub-mkrescue xorriso mformat sha256sum; do
  command -v $t >/dev/null || die "$t is missing: apt install squashfs-tools grub-common grub-pc-bin grub-efi-amd64-bin xorriso mtools"
done
[ -d /usr/lib/grub/i386-pc ] || die "GRUB's BIOS files are missing: apt install grub-pc-bin"
[ -d /usr/lib/grub/x86_64-efi ] || die "GRUB's UEFI files are missing: apt install grub-efi-amd64-bin"
mkdir -p "$OUT" || die "can't create $OUT"
echo "OK. Source: $IMG"

say "1/4 Opening the release image (read-only)"
rm -rf "$WORK"; mkdir -p "$MNT" "$STAGE/boot/grub" "$STAGE/live"
LP=$(p3_loop "$IMG") || die "partition 3 not found in $IMG"
mount -o ro "$LP" "$MNT" || die "can't mount the image's root partition"
K=$(ls "$MNT"/boot/vmlinuz-* 2>/dev/null | sort -V | tail -1); [ -n "$K" ] || die "no kernel in /boot of the image"
KV=${K##*/vmlinuz-}
INITRD=$MNT/boot/initrd.img-$KV
[ -f "$INITRD" ] || die "no initramfs for kernel $KV in the image"
grep -q do_mount_live "$MNT/usr/share/mkinitramfs/init.in" 2>/dev/null \
  || die "the image has no live boot support: do 4.9's live-boot step in the build image, rebuild the initramfs, then release again"
[ "$(stat -c %Y "$INITRD")" -ge "$(stat -c %Y "$MNT/usr/share/mkinitramfs/init.in")" ] \
  || die "the initramfs is older than the live boot change: run mkinitramfs $KV (4.9) in the build image, then release again"
[ -x "$MNT/usr/sbin/iprps-live-setup" ] || die "iprps-live-setup is missing from the image (13.9 step 1)"
[ ! -e "$MNT/var/lib/iprps/setup-done" ] && [ ! -e "$MNT/etc/iprps/db.php" ] \
  || die "this image wasn't cleaned: run /root/iprps-release-clean.sh $ED first"
echo "Kernel $KV, live boot support present, image cleaned."

say "2/4 Compressing the system (squashfs) - the long step, often 20-60 minutes"
mksquashfs "$MNT" "$STAGE/live/filesystem.squashfs" -comp xz -Xbcj x86 -b 1M -noappend \
  -wildcards -e 'lost+found' 'swapfile' 'tmp/*' 'var/tmp/*'
cp -v "$K" "$STAGE/boot/vmlinuz"
cp -v "$INITRD" "$STAGE/boot/initrd.img"
umount "$MNT"; losetup -d "$LP"; LP=""

cat > "$STAGE/boot/grub/grub.cfg" << GRUBCFG
set default=0
set timeout=10
insmod all_video
search --no-floppy --set=root --file /live/filesystem.squashfs

menuentry "Start IPRPS OS 1.0 $EDC (try it, or install it)" {
        linux   /boot/vmlinuz iprps.live=$LABEL quiet${IPRPS_ISO_ARGS:+ $IPRPS_ISO_ARGS}
        initrd  /boot/initrd.img
}
menuentry "Start IPRPS OS 1.0 $EDC (safe graphics)" {
        linux   /boot/vmlinuz iprps.live=$LABEL nomodeset${IPRPS_ISO_ARGS:+ $IPRPS_ISO_ARGS}
        initrd  /boot/initrd.img
}
menuentry "Restart" {
        reboot
}
menuentry "Power off" {
        halt
}
GRUBCFG

say "3/4 Building the ISO (UEFI and BIOS; DVD and USB)"
rm -f "$ISO"
grub-mkrescue -o "$ISO" -V "$LABEL" -iso-level 3 "$STAGE"
xorriso -indev "$ISO" -pvd_info 2>/dev/null | grep -i '^Volume Id' || die "the ISO can't be read back"
SZ=$(stat -c %s "$ISO")
echo "ISO size: $(( SZ / 1048576 )) MB"
if   [ "$SZ" -le 4700000000 ]; then echo "Fits a single-layer DVD (4.7 GB) or a USB stick."
elif [ "$SZ" -le 8500000000 ]; then echo "Needs a DUAL-LAYER DVD (DVD+R DL, 8.5 GB) or a USB stick."
else echo "Too big for a DVD: USB stick only (8 GB or larger)."; fi
( cd "$REL" && sha256sum "$NAME.iso" > "SHA256SUMS-$ED-iso" )

say "4/4 Copying to $OUT"
cp -v "$ISO" "$REL/SHA256SUMS-$ED-iso" "$OUT/"
( cd "$OUT" && sha256sum -c "SHA256SUMS-$ED-iso" ) || die "the copied ISO doesn't match its checksum: copy it again"
rm -rf "$WORK"
ls -lh "$OUT/$NAME.iso" "$OUT/SHA256SUMS-$ED-iso"
printf '\n\033[1;32mDone: %s (copy verified).\033[0m\n' "$OUT/$NAME.iso"
echo "Test it (13.9 step 4) before publishing. Delete $ISO afterwards to free space."
EOF
chmod 755 /root/iprps-release-iso.sh
```

**4. Make the ISO. [DEBIAN ROOT]** After `iprps-release-clean.sh <edition>` (13.4), before or after `iprps-release-pack.sh` (13.5); both leave the cleaned image in `/root/release`:

```bash
/root/iprps-release-iso.sh lite        # or medium / advanced
```

The script checks that the image is cleaned and has live support, compresses the system into `live/filesystem.squashfs` (xz, 20 to 60 minutes), adds the kernel, the initramfs and a GRUB menu, and builds one hybrid ISO that starts from a DVD or a USB stick on UEFI and BIOS. It reports the size, writes `SHA256SUMS-<edition>-iso`, and copies both to `G:\IPRPS\release` with a verified checksum.

**Which disc it needs.** A single-layer DVD holds **4.7 GB** and a dual-layer DVD (DVD+R DL) **8.5 GB**; the script says which one the ISO fits. Lite is expected to fit a single-layer DVD. Medium and Advanced, with LibreOffice, Chromium, GIMP and the Oracle's AI model, may need a dual-layer DVD or a USB stick: check the size the script reports, and say so on the download page. A USB stick of 8 GB or more takes any edition.

**5. Test. [DEBIAN ROOT]** In QEMU, as a DVD on UEFI (then again without the `-bios` line, for BIOS), and as a USB stick:

```bash
ED=lite
qemu-system-x86_64 -enable-kvm -cpu host -m 8G -smp 4 -bios /usr/share/ovmf/OVMF.fd \
  -cdrom /root/release/iprps-os-1.0-$ED.iso \
  -audio none -vga virtio -display none -vnc 127.0.0.1:0 -monitor stdio
qemu-system-x86_64 -enable-kvm -cpu host -m 8G -smp 4 \
  -drive if=none,id=stick,file=/root/release/iprps-os-1.0-$ED.iso,format=raw,readonly=on \
  -device qemu-xhci -device usb-storage,drive=stick \
  -audio none -vga virtio -display none -vnc 127.0.0.1:0 -monitor stdio
```

Connect with RealVNC to `localhost:5900` (Appendix C). Expected:

1. The GRUB menu: **Start IPRPS OS 1.0 Lite (try it, or install it)**.
2. "Looking for the IPRPS OS live disc or USB drive…" for a few seconds, then "Started IPRPS OS live".
3. The desktop, logged in as **IPRPS Live**, with **Install IPRPS OS to This Computer** on it. The Hub, the IPRPS Table and Writer work; anything saved disappears at shutdown.

For the installer test, add an empty disk (`qemu-img create -f qcow2 /root/iso-target.qcow2 64G`, plus `-drive file=/root/iso-target.qcow2,format=qcow2,if=virtio`), install to `vda`, shut down, and start the disk alone: the setup screens (13.2) appear. In Hyper-V: a Generation 2 VM with **Secure Boot off**, the ISO in its DVD drive, and 8 GB of memory.

**Writing the ISO** (also for the release notes and the download page):

- **DVD (Windows):** right-click the `.iso`, then **Burn disc image**.
- **USB stick:** **balenaEtcher**, or **Rufus**: when Rufus asks how to write the image, choose **DD Image mode**. On Linux: `sudo dd if=iprps-os-1.0-lite.iso of=/dev/sdX bs=4M status=progress conv=fsync`.
- **Secure Boot must be off**, as for the other downloads.

| Problem | Fix |
|---|---|
| The script stops: *the image has no live boot support* or *the initramfs is older* | Step 1 wasn't done in the image that was released: do it in the build image (or the Lite release copy), then clean and release again (13.4) |
| Boot stops at "The IPRPS OS live medium (IPRPS_OS_1_0_…) was not found" | The stick was written in Rufus's *ISO mode*, which changes the volume name: write it again in **DD Image mode**. In a VM, check the ISO is attached |
| *Could not open live/filesystem.squashfs* | The download or the disc is damaged: check it against `SHA256SUMS-<edition>-iso`, and burn DVDs at a slower speed |
| The desktop gets slow, or programs close, after a while | The live session keeps every change in RAM: install IPRPS OS, or use the `.img.xz` on a USB stick to keep changes |
| The ISO is too big for a DVD | Use a dual-layer DVD or a USB stick (step 4) |

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

**1. Download (Windows).** From **https://github.com/ungoogled-software/ungoogled-chromium-portablelinux/releases**, download the newest **x86_64 Linux `.tar.xz`** (for example `ungoogled-chromium-156.0.8078.73-1-x86_64_linux.tar.xz`; the naming changes between releases, so the commands below match any of them). GitHub lists each file's **SHA-256** next to it; note it down.

**2. Copy it in and check it. [DEBIAN ROOT]**

```bash
cp -v /mnt/c/Users/<you>/Downloads/ungoogled-chromium*linux.tar.xz /build/src/
sha256sum /build/src/ungoogled-chromium*linux.tar.xz
```

The `sha256sum` output must match GitHub's value exactly.

> **Note:** Windows hides the last part of the name: Explorer shows `...x86_64_linux.tar` for a file that is really `...x86_64_linux.tar.xz`. If `cp` says *No such file*, run `ls /mnt/c/Users/<you>/Downloads/ | grep -i chromium` to see the real name. Keep only one ungoogled-chromium archive in `/build/src`, so the commands pick the right one.

**3. Install into `/opt/chromium`. [IPRPS CHROOT]**

```bash
rm -rf /opt/chromium && install -vdm755 /opt/chromium
tar -xf /build/src/ungoogled-chromium*linux.tar.xz -C /opt/chromium --strip-components=1
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

Medium and Advanced include a **local AI** for Session Masters: the **IPRPS Oracle**, an app in Session Master Mode that improvises NPCs, scenes, locations, loot, encounters, plot hooks and names, answers questions about the campaign, and sends descriptions to the players' screen. Its default model runs **entirely on the computer**: no internet, no account, no API key, and nothing leaves the machine. A Session Master who wants faster or richer answers can switch the Oracle to **Claude**, Anthropic's online AI, with their own API key (step 10); that part needs internet and is never on unless they add a key.

| Part | What it is | Size |
|---|---|---|
| **Ollama** | The service that runs AI models (MIT license), `/usr/bin/ollama` + `/usr/lib/ollama` | about 0.3–0.6 GB (after removing the NVIDIA libraries) |
| **iprps-storyteller** | The Oracle's model: Meta's **Llama 3.2 3B Instruct**, 8-bit (`llama3.2:3b-instruct-q8_0`, Llama 3.2 Community License) plus the IPRPS Modelfile (Session Master voice, BTN/AR terminology) | about 3.4 GB |
| **IPRPS Oracle** | The app, `/srv/www/iprps/oracle`, with the Universal Login | under 150 KB |
| **Claude** (optional) | Anthropic's online models (Haiku, Sonnet, Opus, Fable), used only with the Session Master's own API key | nothing on disk |

The local model needs about **5 GB of free memory** while answering, so 8 GB machines work (16 GB is comfortable). Graphics cards help through **Vulkan** (AMD and Intel, with Mesa's drivers from Stage B); without a usable GPU it runs on the processor, more slowly. **NVIDIA** acceleration needs NVIDIA's own driver, which IPRPS OS can't ship; it runs on the processor there.

Later, a **custom-trained IPRPS model** replaces the bundled one with one command (`iprps-ai-model install`, below); the app keeps working unchanged because it always asks for the model named `iprps-storyteller`.

> **Warning:** **Llama's license terms.** Llama 3.2 comes under the *Llama 3.2 Community License*, not an open-source license. Shipping it in IPRPS OS requires three things, all handled in this part: a copy of the license with the model (`LICENSE-llama3.2.txt`, step 6), the notice *"Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved."* (`ai/NOTICE`), and **"Built with Llama"** shown in the product or its documentation (the Oracle shows it, with a **Licenses** page, and so do the Overview and the manual). Users agree to Meta's Acceptable Use Policy (https://www.llama.com/llama3_2/use-policy). A model **trained** from Llama or its outputs must have a name that starts with "Llama" (see the custom-model tip below).

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
install -vm644 $R/ai/Modelfile $R/ai/system-prompt.txt $R/ai/NOTICE /mnt/iprps/usr/share/iprps/ai/
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
/root/ollama-host/bin/ollama pull llama3.2:3b-instruct-q8_0
/root/ollama-host/bin/ollama create iprps-storyteller -f /mnt/iprps/usr/share/iprps/ai/Modelfile
/root/ollama-host/bin/ollama list
/root/ollama-host/bin/ollama show llama3.2:3b-instruct-q8_0 --license > /mnt/iprps/usr/share/iprps/ai/LICENSE-llama3.2.txt
head -3 /mnt/iprps/usr/share/iprps/ai/LICENSE-llama3.2.txt
rm -f /mnt/iprps/usr/share/iprps/ai/LICENSE-qwen3.5.txt
/root/ollama-host/bin/ollama rm qwen3.5:4b 2>/dev/null
/root/ollama-host/bin/ollama run iprps-storyteller "In two sentences, describe a smugglers' tavern."
pkill -f 'ollama-host/bin/ollama serve'; unset OLLAMA_HOST
du -sh /mnt/iprps/var/lib/ollama/models
```

- `ollama pull` downloads about 3.4 GB; `ollama list` must show **llama3.2:3b-instruct-q8_0** and **iprps-storyteller:latest**.
- The license file must start with **LLAMA 3.2 COMMUNITY LICENSE AGREEMENT**; it ships with the model, as the license requires.
- The last two lines remove the earlier default model (Qwen3.5 4B) from an image that had it; on a new image they do nothing.
- Answers in Debian are slow; that's the processor of a WSL machine, not the target computer.
- If `pull` says the model isn't found, its name changed: check **https://ollama.com/library/llama3.2** (the *Tags* list) for the 3B instruct Q8_0 tag, and change the `pull` line, the `show` line and the `FROM` line of `ai/Modelfile`.

> **Side note:** **Q8_0 or Q4_K_M?** `llama3.2:3b-instruct-q8_0` (3.4 GB) keeps nearly all of the model's quality. On a computer without a usable graphics chip, `llama3.2:3b-instruct-q4_K_M` (2.0 GB) writes about 1.7 times faster with slightly plainer text. To ship that one instead, change the three names above; to switch one computer, see the speed note in step 9.

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

`ls -A` lists `about-models.html`, `api.php`, `config.php`, `display.php`, `index.html`, `llm.php`, `markdown.js`, `oracle.css`, `oracle.js`, `oracle-icon.svg`, `prompts.php` and `.user.ini` (which turns PHP's output buffering off for this folder). The Oracle needs **no database setup**: on first use it creates its tables (`oracle_messages`, `oracle_memory`, `display_items`) in the IPRPS core database, using the password `iprps-db-init` writes to `/etc/iprps/db.php` (13.1). It reads the campaign memory from the core tables the Session Master Hub fills: `campaigns`, `sessions` (recap, Session Master notes), `session_log`, `npcs`, `quests` and `characters`, and the campaign's sheets in `character_sheets` (12.9). With Character Sheets installed, its **Character sheets** buttons (**NPC sheet**, **Creature sheet**) write complete IPRPS sheets and save them there. The model answers in a fixed JSON layout (Ollama's structured outputs), and the values are checked before they're stored.

**9. Test** (fresh test copy, `-m 8G`, log in):

**[TEST VM]** (terminal)

```bash
systemctl status ollama --no-pager | head -5
iprps-ai-model status
```

The service is **active (running)**; the status lists `iprps-storyteller` "built from: llama3.2:3b-instruct-q8_0", and the log line shows which compute device was found (in QEMU: the processor).

Then open **IPRPS Oracle** from the menu (or Session Master Mode): it asks for the Universal Login once, the top bar shows **On this computer** in green, and the **Model** menu shows `iprps-storyteller (Llama 3.2 3B)` under *On this computer*, and the four Claude models under *Online*. The left column ends with **Built with Llama** and a **Licenses** link. Click **NPC**: the first answer takes longer (the model loads), then text appears word by word. Try **Show players**, then open **Player display ↗**: the text appears full-screen. With a campaign chosen (create one in the Hub, or `INSERT INTO campaigns (name) VALUES ('Test')` in `mariadb -u root iprps`), **Save NPC** adds it to the campaign, and **What the Oracle knows** shows it.

| What the Session Master does | Where it goes |
|---|---|
| Chat, generators | `oracle_messages` (per user and campaign; **Clear this chat** deletes them) |
| **Pin to memory** / **Pin** | `oracle_memory`: facts the Oracle always gets for that campaign |
| **Save NPC**, **Save quest**, **Add to log** | The campaign's `npcs`, `quests`, and the latest session's `session_log` |
| **Show players**, **Clear display** | `display_items`, shown by the player display |

> **Side note:** **Speed.** On a processor, the local model first reads the request (the instructions, campaign memory and recent chat: often 3,000–4,500 tokens), then writes the answer, roughly a sentence every one to three seconds; a Vulkan GPU is several times faster. An NPC can take one to three minutes on an older processor. What helps, per computer: in `/etc/iprps/ollama.conf`, `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0` and `OLLAMA_KEEP_ALIVE=60m` (then `systemctl restart ollama`); with AMD or Intel integrated graphics also `OLLAMA_IGPU_ENABLE=1` (compare the speed before and after); **Clear this chat** between scenes; untick **Use campaign memory** for Names and Loot. For a faster model, `sudo iprps-ai-model pull llama3.2:3b-instruct-q4_K_M`, then make a copy of `/usr/share/iprps/ai/Modelfile` with that `FROM` line and `sudo iprps-ai-model install-modelfile` it (`reset` goes back). `ollama run iprps-storyteller --verbose "hi"` prints the reading speed (*prompt eval rate*) and writing speed (*eval rate*). Or switch the Oracle to Claude (step 10), which answers in seconds. Session Master Mode loads the local model when it starts. Inside QEMU everything is slower, and the VM needs `-cpu host`.

**10. Claude, the optional online AI.** The Oracle's **Model** menu has two groups: *On this computer* (the local models) and *Online: Claude*, with the newest **Claude Haiku**, **Sonnet**, **Opus** and **Fable**. Claude answers in seconds and writes richer NPCs and scenes, but it needs **internet** and the Session Master's **own Anthropic API key**, and Anthropic charges their account for each reply. Nothing is sent anywhere until a key is added.

| | |
|---|---|
| **Adding the key** | **Online AI…** (next to the Model menu), paste the key from **console.anthropic.com → API keys**, **Check and save**. The Oracle tries the key with Anthropic first, then stores it encrypted in the Session Master's IPRPS key vault (12.10; the same vault as **IPRPS Welcome → API keys**, provider *Anthropic*). The key never reaches the browser or the players; **Remove key** deletes it. |
| **What is sent** | Only while a Claude model is chosen: the message, recent Oracle chat, the campaign memory (when **Use campaign memory** is on) and named character sheets. A teal **Online** notice above the message box says so. Recaps (**✦ Draft with the Oracle** in the Session Log) and **NPC sheet** / **Creature sheet** use the Session Master's chosen model too. |
| **New Claude models** | **Check for new models** asks Anthropic's Models API which models the key can use and keeps the newest of each family; the Oracle also checks by itself once a week. A new release (say *Sonnet 5.6*) then appears in the Model menu with no IPRPS update, and a chosen model moves to its family's newest. The starting list is in `llm.php` (`CLAUDE_FAMILIES`); code changes come through IPRPS Updates as usual. |
| **Where it's set** | `/srv/www/iprps/oracle/llm.php`: the address, API version (`2023-06-01`), the longest reply (`CLAUDE_MAX_TOKENS`, 2048) and the check interval. Override any of them in `config.php` with `define(...)`. |

**Test Claude** (needs internet and a key; skip it otherwise): **Online AI…**, add the key: the list shows four models with their IDs. Choose a Claude model, click **NPC**: the top bar shows **Online · Claude …** in teal, the notice appears, and the answer arrives within seconds. Choose `iprps-storyteller` again and the notice disappears.

> **Side note:** **An installed computer.** IPRPS Updates brings the new Oracle (with Claude) like any app update. The new local model is a separate 3.4 GB download: the update leaves the current model working, the Oracle shows *A new local model is ready*, and the Session Master runs `sudo iprps-ai-model upgrade` once. It downloads Llama 3.2, rebuilds `iprps-storyteller`, writes `LICENSE-llama3.2.txt`, and offers to delete the old model.

> **Pro tip:** **A custom IPRPS model.** When the trained IPRPS storyteller model exists (as a `.gguf` file, the format Ollama imports), one command makes it the Oracle's model on any IPRPS OS computer: `sudo iprps-ai-model install iprps-storyteller-v1.Q4_K_M.gguf`. It keeps the IPRPS system prompt (`/usr/share/iprps/ai/system-prompt.txt`); a model that needs its own chat template comes with a Modelfile instead: `sudo iprps-ai-model install-modelfile Modelfile`. `sudo iprps-ai-model reset` returns to the shipped model. To ship the custom model in a release instead, change the `FROM` line of `ai/Modelfile` to the `.gguf` file's path and repeat step 6 with that file instead of the `pull`. The license of the model it was trained from still applies: a model trained from Llama 3.2 (or from its outputs) must be named starting with "Llama" (for example `Llama-IPRPS-Storyteller`), ship the Llama license and notice, and say "Built with Llama".

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

### 16.2 Calibre (e-books)

**Calibre** manages and converts e-books: campaign books, rulebooks and setting guides as EPUB, plus a reader for them. It's free software (**GPL-3.0**), so it can ship in IPRPS OS. IPRPS uses its **official Linux binary**, which carries private copies of nearly everything it needs (its own Qt and Python) and installs into `/opt/calibre`. Calibre's author recommends it over distribution-built packages.

**1. The libraries Calibre needs from the system. [IPRPS CHROOT]** Its Qt needs `libxcb-cursor` (from **XCB Utilities**, Stage I above), Mesa's `libEGL` and `libGL`, and `libOpenGL.so.0`:

```bash
ls -l /usr/lib/libxcb-cursor.so.0 /usr/lib/libEGL.so.1 /usr/lib/libGL.so.1
[ -e /usr/lib/libOpenGL.so.0 ] || ln -sv libGL.so.1 /usr/lib/libOpenGL.so.0
[ -e /usr/lib/libGLX.so.0 ] || ln -sv libGL.so.1 /usr/lib/libGLX.so.0
ldconfig && ldconfig -p | grep -E 'libOpenGL.so.0|libGLX.so.0|libxcb-cursor.so.0'
```

- If `libxcb-cursor.so.0` is missing, build **XCB Utilities** from Stage I first. Without it, Calibre stops at start with *Could not load the Qt platform plugin "xcb"*.
- **Why the links:** `libOpenGL.so.0` and `libGLX.so.0` normally come from *libglvnd*, which BLFS doesn't use: BLFS's Mesa puts all of OpenGL and GLX in `libGL.so.1`. Programs built elsewhere, such as Calibre's Qt, ask for the two libglvnd names; the links point them at Mesa's library, which has the same functions. Without `libOpenGL.so.0`, Calibre's installer stops with *You are missing the system library libOpenGL.so.0*; without `libGLX.so.0`, it installs but Calibre doesn't start and gets no menu entries (*cannot import name 'QImage'*).
- `ldconfig -p` must list all three libraries.

**2. Install with Calibre's own installer. [IPRPS CHROOT]**

```bash
cd /build/src
wget -nv -O calibre-linux-installer.sh https://download.calibre-ebook.com/linux-installer.sh
sh calibre-linux-installer.sh install_dir=/opt
/opt/calibre/calibre --version
ls /usr/bin/calibre /usr/bin/ebook-viewer /usr/bin/ebook-convert
ls /usr/share/applications/calibre-*.desktop
```

`ls` must list four menu entries: `calibre-gui`, `calibre-ebook-viewer`, `calibre-ebook-edit` and `calibre-lrfviewer`. If it says *No such file*, the installer's last part (the menu entries) failed: scroll up for `WARNING` and *Setting up desktop integration failed*. Run that part again with the standard folders set, move anything it put under `/usr/local`, and refresh the menu and icon caches:

```bash
XDG_DATA_DIRS=/usr/share XDG_CONFIG_DIRS=/etc/xdg /opt/calibre/calibre_postinstall 2>&1 | grep -i -A4 'warning\|failed\|error'
mv -v /usr/local/share/applications/calibre-*.desktop /usr/share/applications/ 2>/dev/null
update-desktop-database /usr/share/applications
gtk-update-icon-cache -qtf /usr/share/icons/hicolor || true
ls /usr/share/applications/calibre-*.desktop
grep -H '^Categories' /usr/share/applications/calibre-*.desktop
```

The `grep -i` line prints nothing when the menu step works. `Categories` lines start with `Office`, so the entries appear under **Office**.

- The installer downloads the newest Calibre, **checks its signature**, unpacks it to `/opt/calibre`, and runs `calibre_postinstall`, which adds the `calibre`, `ebook-viewer` and `ebook-convert` commands, the menu entries (Office) and the e-book file types.
- `calibre --version` prints the version, for example `calibre (calibre 9.17.0)`. Note it for step 3.
- Saving the script first (rather than piping it into `sh`) lets you read it before running it: `less calibre-linux-installer.sh`.

**3. Keep the matching source code. [IPRPS CHROOT]** The GPL requires it to be published with each release (13.7):

```bash
V=$(/opt/calibre/calibre --version | grep -o '[0-9][0-9.]*' | head -1); echo "Calibre $V"
wget -P /build/src https://download.calibre-ebook.com/$V/calibre-$V.tar.xz
ls -l /build/src/calibre-$V.tar.xz
```

Publish `calibre-$V.tar.xz` with the release's other source archives. The official binary also bundles Qt, Python and other libraries under their own licenses; they're listed in Calibre's `bypy/sources.json` (in the source tarball and at https://github.com/kovidgoyal/calibre), and their licenses are inside `/opt/calibre`.

**4. Test. [TEST VM]** Open **calibre** from the menu (Office). The welcome wizard asks where to keep the library: the default, `~/Calibre Library`, is fine; or choose a folder inside *Campaigns*. Add any EPUB or PDF and open it in the viewer.

> **Pro tip:** **Updating Calibre.** Calibre releases often. To update between IPRPS releases, an administrator runs step 2 again (`sudo sh calibre-linux-installer.sh install_dir=/opt`); it replaces `/opt/calibre` and keeps every user's library and settings.

| Problem | Fix |
| --- | --- |
| *You are missing the system library libOpenGL.so.0* | Step 1: create the `libOpenGL.so.0` link and run `ldconfig`, then run the installer again |
| *Setting up desktop integration failed*, *cannot import name 'QImage' from 'qt.core'*, or *libGLX.so.0: cannot open shared object file* | Step 1: create the `libGLX.so.0` link and run `ldconfig`, then step 2's second block (`calibre_postinstall`). Check with `/opt/calibre/calibre-debug -c 'from PyQt6.QtGui import QImage; print("QtGui OK")'` |
| *Could not load the Qt platform plugin "xcb"* | `libxcb-cursor` is missing: build XCB Utilities (Stage I), then start Calibre again. `QT_DEBUG_PLUGINS=1 calibre` names any other missing library |
| The installer stops with a signature or download error | Check the internet connection in the chroot (`ping -c1 download.calibre-ebook.com`) and run step 2 again; never skip the check |
| No Calibre in the menu (Office) | Step 2's second block (`calibre_postinstall` with `XDG_DATA_DIRS=/usr/share`). The change is in the build image: make a **new test copy** to see it; in a running session, log out and in |

Install the Advanced IPRPS apps (12.4).

> **Checkpoint:** Take snapshot **`RELEASE-advanced`**, then release it as in Part 14: `/root/iprps-release-clean.sh advanced`, `/root/iprps-release-pack.sh advanced` → `iprps-os-1.0-advanced.img.xz`.

---

## Part 17 — After Release: Updates and Users

- **Users tailor their own systems.** They have `sudo`, a compiler and the full build toolchain, so they can follow BLFS for anything else they want.
- **Updates are your job as the distributor,** and since 12.12 they reach installed computers as **packages**: users click **Install updates** in IPRPS Updates (or run `sudo iprps-update upgrade`). New images (1.0.1, 1.1, …) are still worth publishing for new installs, but nobody has to reinstall to stay current.
- **Watch** https://www.linuxfromscratch.org/blfs/advisories/ (and LFS's) for security fixes in packages IPRPS OS ships.

Every update follows the same path:

| Step | Where | Command |
|---|---|---|
| 1. Change the recipe or the app | Windows / **[DEBIAN ROOT]** | edit `G:\IPRPS\iprps-os\…`, then 12.12 step 5 (copy the repository into the image) |
| 2. Build | **[BUILDER]** | `cd /build/src/iprps-os/packages/<folder> && makepkg -f --nodeps` |
| 3. Install in the build image (keeps it current for the next release) | **[IPRPS CHROOT]** | `pacman -U /build/repo/<package>.pkg.tar.zst` |
| 4. Sign and add | **[DEBIAN ROOT]** | `/root/iprps-repo.sh add <repository> /mnt/iprps/build/repo/<package>.pkg.tar.zst` |
| 5. Check and test | **[DEBIAN ROOT]** + **[TEST VM]** | `/root/iprps-repo.sh check`, then `serve` and a VM copy of the **last release** (12.12 step 10) |
| 6. Publish | **[DEBIAN ROOT]** + FileZilla | `/root/iprps-repo.sh stage`, upload, `/root/iprps-repo.sh online` |
| 7. Record it | Git | a CHANGELOG line, commit and push (E.3) |

Installed computers notice within 6 hours (or at once with **Check now**). **Test against a copy of a release image**, not the build image: the release is what users have.

### 17.1 New versions of the IPRPS apps

1. Change the app in `G:\IPRPS\iprps-os\apps\<app>\` (or unzip a newer repository).
2. In `packages/iprps-apps/PKGBUILD`, set `pkgver` to today's date (`2026.11.15`), and `pkgrel=1`.
3. Steps 1–7 above with the folder `iprps-apps`. Add only the packages that changed, or all of them (unchanged ones just get the new date):

```bash
/root/iprps-repo.sh add iprps-apps /mnt/iprps/build/repo/iprps-*-2026.11.15-1-any.pkg.tar.zst
```

A **new app** for an edition: add a `package_iprps-<app>()` function and its name to `pkgname=()` in `iprps-apps/PKGBUILD`, a menu entry in `iprps-apps/desktop/`, and the name to the edition lists (`_apps_lite`, …) in `iprps-base/PKGBUILD`. Then publish a new `iprps-base` (17.3) too: the edition packages then depend on it, so every computer of that edition installs it with the next update.

### 17.2 A security update for a system package (example: cURL)

BLFS publishes an advisory: cURL before 8.21.1 has a vulnerability.

1. **[DEBIAN ROOT]** `cp -r` `packages/examples/curl` to `packages/curl` in `G:\IPRPS\iprps-os`. Set `pkgver=8.21.1` and replace the checksum (from the BLFS page or curl.se, or `makepkg -g` after checking the download's signature). Copy the repository into the image (12.12 step 5).
2. **[BUILDER]** `cd /build/src/iprps-os/packages/curl && makepkg -f --nodeps`. The recipe is BLFS's own commands with `DESTDIR` (see `packages/examples/_blfs-template` for the rules).
3. **[IPRPS CHROOT]** `pacman -U --overwrite '/usr/*' /build/repo/curl-8.21.1-1-x86_64.pkg.tar.zst` (the first cURL package takes over the files BLFS installed), then `curl --version`.
4. **[DEBIAN ROOT]** `/root/iprps-repo.sh add iprps-core /mnt/iprps/build/repo/curl-8.21.1-1-x86_64.pkg.tar.zst`, check, test, publish.

If the update must reach **every** computer (a security fix normally must, even where nobody installed cURL as a package), do a point release (17.3) that depends on it: `'curl>=8.21.1'`.

**Libraries** (OpenSSL, glibc, …): if the library's file name changes (`libssl.so.3` → `libssl.so.4`), every program using it must be rebuilt and published in the same update. BLFS's advisories say when that applies. Updates of glibc, systemd, Mesa, D-Bus, OpenSSL or GnuTLS make IPRPS Updates ask for a restart.

### 17.3 A point release (1.0.1, 1.1, …)

`iprps-base`'s version **is** the IPRPS OS version. In `packages/iprps-base/PKGBUILD`:

1. Set `pkgver=1.0.1`.
2. Add what the release must bring to every computer to `package_iprps-base()`'s `depends=()`, for example `depends=(pacman iprps-keyring 'curl>=8.21.1' 'openssl>=3.6.2')`.
3. Build and publish `iprps-base` and the three edition packages (one `makepkg` builds all four) to `iprps-core`.

On each computer, the update sets the version in `/etc/os-release` (*IPRPS OS 1.0.1 Lite*); the first-boot setup, the Welcome tour and IPRPS Updates show it. Also make new images for new installs (13.4–13.9, with `1.0.1` in the file names).

### 17.4 Optional extras

Software that an edition doesn't include, offered under **IPRPS apps and optional software** in IPRPS Updates:

- **IPRPS apps** from `iprps-apps` that an edition lacks appear automatically (the Oracle on Lite shows *not in this edition*, because it needs Ollama, which only Medium and Advanced have as yet).
- **Other software** goes in `iprps-extra`. `packages/examples/calibre` packages Calibre's official binary. It depends on `xcb-util-cursor`, which only Advanced provides, so Lite and Medium show *not in this edition* until you also package XCB Utilities (BLFS, like 17.2) into `iprps-extra`. On Advanced, installing the package takes over the Calibre from 16.2 and keeps it updated.
- IPRPS Updates never installs anything that would replace the computer's **edition package**; that's what *not in this edition* means.

Good candidates for extras: binary apps that carry their own libraries (Calibre, the Chromium build from Part 15, Ollama and the Oracle's model for Lite on 16 GB machines), and Advanced's creative apps for Medium once their libraries are packaged.

### 17.5 Mistakes, old packages, and the key

- **A bad update:** publish a fixed one with a higher `pkgrel` (or `pkgver`). pacman never goes back to an older version on its own.
- **Removing a package from a repository:** `/root/iprps-repo.sh remove <repository> <name>`. Computers keep what they have installed.
- **Old versions** are deleted from the repository when a new one is added (`repo-add --remove`); the master copy in `/root/iprps-repo/1` is backed up with the snapshots (Appendix F), so add it to your backups: `rsync -a /root/iprps-repo/ /mnt/d/IPRPS/backups/repo/`.
- **The signing key** expires after 5 years. Before then, extend it (`gpg --quick-set-expire <fingerprint> 5y`), run `/root/iprps-repo.sh key` to export the public key again, and publish a new `iprps-keyring` (raise its `pkgver`).
- **If the private key leaks:** create a new key, put the old fingerprint in `packages/iprps-keyring/iprps-revoked` and the new key in `iprps.gpg`/`iprps-trusted`, sign the new `iprps-keyring` with the **old** key one last time (so computers accept it), then re-sign everything with the new key and announce it.
- **A 2.x series** with breaking changes gets its own folder (`…/repo/2/`) and a new `iprps-mirrorlist`, so 1.x computers are never moved to it by accident.

---

## Part 18 — Future Releases

### 18.1 Local AI: next steps

The local AI is part of 1.0: the **IPRPS Oracle** with Ollama and the bundled `iprps-storyteller` model, in Medium and Advanced (Part 15). Later releases can build on it:

| Next step | Notes |
|---|---|
| A custom-trained IPRPS model | `iprps-ai-model` (Part 15) installs it in place of the bundled model; the Oracle doesn't change |
| Larger optional models | Downloaded on demand for 16 GB+ machines, rather than shipped in the image |
| The Hub's campaign tools | Session log, NPC and quest screens give the Oracle more campaign context |
| The IPRPS Table | Oracle descriptions sent straight to players' devices, as they are to the player display |

### 18.2 A live/installer ISO

Done in 1.0: **13.9** makes a live ISO for each edition (DVD or USB, UEFI and BIOS) that runs in memory and installs from there. A later release can add a persistent live mode (keeping changes on the USB stick) and a graphical installer.

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
| `iprps-icon-theme` prints fewer than 124 names, or *not found* | Icons missing from `/usr/share/iprps/icons` | 9.3 step 1 (copy the 72 icons), then step 2 again |
| Folders in Thunar keep the plain folder icon | The thumbnail service started before the thumbnailer was installed, thumbnails are off, or old pictures are cached | `thunar -q; pkill tumblerd; rm -rf ~/.cache/thumbnails/*/; thunar ~ &` (`iprps-icons` 2026.11.02-2 and later do this when installed). **View → Show thumbnails** must not be *Never*; `ls /usr/share/thumbnailers/iprps-folders.thumbnailer` |
| `ERROR 2002 … Can't connect to local server through socket` right after `mariadbd-safe … &` | The server wasn't ready yet | Wait for it: `until mariadb-admin -u root ping >/dev/null 2>&1; do sleep 1; done`, then rerun what failed |
| `ERROR 1045 … Access denied for user 'iprps'@'localhost'` | The `iprps` user wasn't created (or another password) | Rerun 12.5 step 6's `CREATE USER … ALTER USER … GRANT` with the password from `/root/iprps-dev-db.txt` |
| Web apps show only the IPRPS login, or "Sign in required" | Normal: the Universal Login is working | Register at `/iprps/auth/login.html`; apps then let you in |
| *DB connection failed* (Universal Login) in a boot-test copy of the build image | The copy ran the first-boot `iprps-db-init` from before 2026-11-02, which changed the database password but not the apps' test password | Install the current `iprps-db-init` (13.1) in the build image. In the copy: replace the test password from `/root/iprps-dev-db.txt` with the one in `/etc/iprps/db.php` in `/srv/www/iprps` (`grep -rlF … \| xargs sed -i`) |
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
| The Oracle never answers in a QEMU test VM (Ollama green, no text after many minutes) | The VM's processor has no AVX2: QEMU was started without `-cpu host`, so Ollama runs its slowest code (hours per answer). In the live ISO, also too little memory (the model is read from the compressed disc) | Start QEMU with `-enable-kvm -cpu host`; `grep -c avx2 /proc/cpuinfo` in the VM must be above 0. Live ISO: `-m 12G` or more |
| The Oracle says no model is installed, or `iprps-storyteller` is missing | Step 6 skipped, or the models aren't owned by `ollama` | `sudo iprps-ai-model status`; `chown -R ollama:ollama /var/lib/ollama`; `sudo iprps-ai-model reset` |
| Oracle answers appear all at once instead of word by word | 10.1's PHP rule (`flushpackets`) missing | `cat /etc/httpd/extra/iprps-php.conf` (10.1); `ls -A /srv/www/iprps/oracle/.user.ini` |
| Oracle answers are very slow | No usable GPU, or too little free memory | `sudo iprps-ai-model status` (compute device); close other programs; 8 GB is the minimum |
| The Oracle shows *A new local model is ready* | The Oracle was updated (IPRPS Updates) but the Llama 3.2 model isn't downloaded yet | `sudo iprps-ai-model upgrade` (3.4 GB, needs internet); the old model keeps working until then |
| **Online AI…**: *Anthropic refused the API key* | Mistyped or revoked key | Copy it again from console.anthropic.com → API keys; keys start with `sk-ant-` |
| Claude: *Can't reach Anthropic* | No internet, or a firewall blocks `api.anthropic.com` (HTTPS) | Check the connection (`curl -sI https://api.anthropic.com`); choose the local model meanwhile |
| Claude: *out of credit*, *rate limit*, or *busy (overloaded)* | The Anthropic account needs credit, or too many requests | Add credit in the Anthropic Console, or wait a minute; the local model always works |
| Claude: *isn't available to your key* | That model was retired, or the key's workspace can't use it | **Online AI… → Check for new models** |
| First boot: "database could not be created", apps can't log in | MariaDB's first start was slower than `iprps-db-init` waited (slow USB stick) | Fixed in 13.1 (waits up to 3 minutes). On an affected computer: `sudo systemctl restart iprps-db-init`, or reboot (it runs again until it succeeds) |
| Saving Wi-Fi (or another admin task) asks for a password and rejects it | polkit asks for **root's** password, and root is locked | 13.2 polkit rule (`/etc/polkit-1/rules.d/10-iprps.rules`); users then type their own password, and Wi-Fi needs none |
| IPRPS Table: players' phones can't open `http://<address>:7777/` | The table isn't open; the phone is on another network (mobile data, guest Wi-Fi with client isolation); a firewall blocks TCP 7777 | Click **Open the table**; put the phone on the same Wi-Fi as the Session Master's computer (turn off mobile data to check), or use a phone hotspot for everyone; allow TCP 7777 (12.7) |
| IPRPS Table: "The Session Master console only opens on the Session Master's computer" | The console was opened from another device, or with the computer's network address instead of `localhost` | Open it from the menu (**IPRPS Table**) or at `http://localhost:7777/sm/` on the IPRPS OS computer |
| IPRPS Table: the Hub tile says the service isn't running | `iprps-table.service` is stopped or failed | `systemctl status iprps-table` and `journalctl -u iprps-table -b`; check `node --version` and that `/opt/iprps/table/server.js` exists, then `sudo systemctl restart iprps-table` (12.7) |
| IPRPS Table: "That join code is not right" | A new code was made, or a typo | Read the code in the console (letters and numbers, no O/0 or I/1 confusion); scanning the QR code fills it in |
| IPRPS Table: no music on a phone | Phones block sound until the page is touched once | Tap **Tap to turn on the table sound**; check the phone's volume |
| IPRPS Table: players have no **📜 Sheet** button, or it says the character sheet is not installed | The Character Creator isn't at `/srv/www/iprps/character-creator/`, or the Table service still runs its old files | 12.9 steps 1 and 2, then `sudo systemctl restart iprps-table` |
| IPRPS Table: the **📜 Character sheets** panel asks to sign in, or stays empty | Normal the first time: the panel is Character Sheets, which uses the Universal Login | Sign in once inside the panel. If it stays blank, check `http://localhost/iprps/character-sheets/` opens in the browser (12.9) |
| Character Sheets: an import says *not an IPRPS character sheet* | The file isn't a Character Creator export (or is damaged) | Ask the player for the `.json` from **Export .json**; `.iprps` exports work too |
| Character Sheets: *The sheet was too large to send* | A very large portrait in a sheet made outside IPRPS | Re-export it from the current Character Creator (it shrinks portraits), or remove the portrait; the limit is 16 MB (`character-sheets/.user.ini`) |
| The Oracle has no **Character sheets** buttons | Character Sheets isn't installed, or the Oracle files are older than 12.9 | 12.9 step 1 (the Oracle line), then reload the Oracle |
| The Oracle: *the answer was not a usable sheet* | The model's answer didn't fit the sheet layout | Try again; a shorter description helps. Check `ollama --version` is 0.5 or newer (structured outputs) |
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
ls artwork/icons/*.png | wc -l        # 72 (the repository zip includes them)
git status
git add -A && git commit -m "Update IPRPS OS" && git push
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
qemu-system-x86_64 -enable-kvm -cpu host -m 6G -smp 4 \
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

The first line replaces one of the 72 IPRPS icons in place: name your file exactly like the IPRPS icon it replaces (`folder-documents.png`, `trash.png`, `terminal.png`…, the first column of 9.3's table or `ls /usr/share/iprps/icons`), and every standard name linked to it changes too. Folder icons in Thunar use the same files (9.3); clear the old pictures with `rm -rf ~/.cache/thumbnails/*/`. The third adds a brand-new icon under its own name, usable as `Icon=my-new-icon` in launchers. Log out and back in to see the change everywhere. An update of the `iprps-icons` package (IPRPS Updates) brings back the original icons, so keep your custom PNGs on a USB stick, or use 3a, which updates never touch.

**On a Live ISO or Live USB:** changes live in memory and disappear at shutdown. Keep your icons and the commands above on a USB stick and run them again in each session, or install IPRPS OS to keep them for good.

> **Pro tip:** If an icon doesn't change, look for broken links with `find <theme folder> -xtype l` (it should print nothing), confirm the active theme with `xfconf-query -c xsettings -p /Net/IconThemeName`, and log out and back in: the panel and file manager load icons when they start.

## Appendix D — Kernel Options Required by BLFS Packages

{{kernel-table}}

## Appendix E — Package Lists by Edition

{{edition-lists}}

## Appendix F — Backing Up and Restoring Images

The build image and its snapshots live inside WSL's own disk (`G:\WSL\Debian\ext4.vhdx`). If that file is damaged, or WSL is reset or reinstalled, they're gone with it. Copies on another drive protect weeks of build work.

| What | Where in Debian | Back up |
|---|---|---|
| Working build image | `/root/iprps-system.img` | Before risky steps, and at the end of a long session |
| Snapshots (0.4) | `/root/snapshots/iprps-<NAME>.img` | After each checkpoint, **always** the release snapshots (`RELEASE-lite`, and so on) |
| Release downloads | `G:\IPRPS\release` | Already on a Windows drive. Copy them to a second drive in Explorer if you like |
| The repository | `G:\IPRPS\iprps-os` | Already on a Windows drive (and on GitHub) |
| Source tarballs | `/build/src` | Optional: everything can be downloaded again |

**Why compressed.**
- The images are **sparse**: a 40 GB image with 15 GB of data uses only 15 GB inside WSL.
- A plain copy to a Windows drive (`cp` to `/mnt/d`, or Explorer) writes the empty parts out in full, so every copy takes the image's full size (40 GB, or 80 GB after Part 15's resize).
- `iprps-backup.sh` compresses each image with **zstd**: the empty parts disappear and the data shrinks too, typically to a third or a half. It also tests every copy before keeping it.
- Restoring with `zstd -d --sparse` gives back a sparse image, exactly like the original.

### F.1 Set up once

**1. A drive for backups.** D: is used here. An external USB drive works too (see the note after step 3).

**[DEBIAN ROOT]**

```bash
apt install zstd
ls /mnt/d
mkdir -p /mnt/d/IPRPS/backups
```

`ls /mnt/d` lists the drive's folders. If it says *No such file or directory*, WSL doesn't see the drive yet: in **[WINDOWS POWERSHELL]** run `wsl --shutdown`, then open Debian again.

**2. The backup script. [DEBIAN ROOT]** Install it from the repository (`install -vm755 /mnt/g/IPRPS/iprps-os/build-host/iprps-backup.sh /root/`), or write it here:

```bash
cat > /root/iprps-backup.sh << "EOF"
#!/bin/bash
# iprps-backup.sh - back up the IPRPS build image and snapshots to a Windows drive (guide Appendix F)
#   iprps-backup.sh snapshots   every snapshot in /root/snapshots that isn't backed up yet (or changed since)
#   iprps-backup.sh image       the working build image (close it first: iprps-leave.sh)
#   iprps-backup.sh all         both
#   iprps-backup.sh list        what is backed up
# Destination: IPRPS_BACKUP (default /mnt/d/IPRPS/backups, which is D:\IPRPS\backups in Windows).
# Files are compressed with zstd (sparse images would otherwise be written out at full size) and
# each copy is checked before it's kept. Restore with: zstd -d --sparse <file>.img.zst -o <image>  (Appendix F).
set -u
DEST=${IPRPS_BACKUP:-/mnt/d/IPRPS/backups}
IMG=${IPRPS_IMG:-/root/iprps-system.img}
SNAPS=${IPRPS_SNAPSHOTS:-/root/snapshots}
LOG=$DEST/BACKUPS.txt
FAILED=0

die() { printf '\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "run this as root in Debian (sudo -i)"
command -v zstd >/dev/null || die "zstd is missing: apt install zstd"
DRIVE=$(echo "$DEST" | cut -d/ -f1-3)
[ -d "$DRIVE" ] || die "$DRIVE not found. Is the drive connected? (Appendix F: drives in WSL)"
mkdir -p "$DEST/snapshots" "$DEST/image" || die "can't write to $DEST"

# one <source image> <backup file>
one() {
  local src=$1 out=$2 name=${1##*/} used avail
  if [ -f "$out" ] && [ "$out" -nt "$src" ]; then echo "  up to date   $name"; return 0; fi
  used=$(du -B1 "$src" | cut -f1)
  avail=$(df -B1 --output=avail "$DEST" | tail -1)
  if [ "$avail" -lt $(( used * 6 / 10 )) ]; then
    printf '\033[1;31m  NO ROOM      %s (uses %s; %s free on the drive)\033[0m\n' "$name" "$(numfmt --to=iec "$used")" "$(numfmt --to=iec "$avail")"
    FAILED=1; return 1
  fi
  echo "== $name  ($(numfmt --to=iec "$used") of data, $(numfmt --to=iec "$(stat -c %s "$src")") image)"
  if zstd -T0 -3 -q --progress -f "$src" -o "$out.part" && zstd -tq "$out.part" && mv -f "$out.part" "$out" && touch "$out"; then
    printf '%s  %s  %s bytes  %s\n' "$(date '+%F %R')" "${out##*/}" "$(stat -c %s "$src")" "$(numfmt --to=iec "$(stat -c %s "$out")") compressed" >> "$LOG"
    printf '\033[1;32m  OK           %s → %s (%s)\033[0m\n' "$name" "$out" "$(numfmt --to=iec "$(stat -c %s "$out")")"
  else
    rm -f "$out.part"
    printf '\033[1;31m  FAILED       %s\033[0m\n' "$name"; FAILED=1; return 1
  fi
}

do_snapshots() {
  local n=0 f
  for f in "$SNAPS"/*.img; do
    [ -f "$f" ] || continue
    n=$((n + 1)); one "$f" "$DEST/snapshots/${f##*/}.zst"
  done
  [ "$n" -gt 0 ] || echo "  No snapshots in $SNAPS."
}
do_image() {
  [ -f "$IMG" ] || die "$IMG not found"
  [ -z "$(losetup -j "$IMG")" ] || die "the build image is in use: leave every chroot window, then bash /root/iprps-leave.sh"
  pgrep -x qemu-system-x86_64 >/dev/null && echo "  (a QEMU test VM is running; that's fine if it uses a test copy, not $IMG)"
  one "$IMG" "$DEST/image/$(basename "$IMG" .img)-$(date +%F).img.zst"
}

case "${1:-}" in
  snapshots) do_snapshots ;;
  image)     do_image ;;
  all)       do_image; do_snapshots ;;
  list)      ls -lh "$DEST/image" "$DEST/snapshots"; echo; [ -f "$LOG" ] && tail -n 30 "$LOG"; exit 0 ;;
  *)         echo "usage: $0 snapshots | image | all | list"; exit 1 ;;
esac
df -h "$DEST" | tail -1 | awk '{print "Drive: " $4 " free of " $2}'
[ "$FAILED" = 0 ] && printf '\033[1;32mBackup complete: %s\033[0m\n' "$DEST" || die "some backups failed (see above)"
EOF
chmod 755 /root/iprps-backup.sh
bash -n /root/iprps-backup.sh && echo "script OK"
```

**3. Check the space.** The backup needs, at most, the space the images really use:

```bash
du -ch /root/iprps-system.img /root/snapshots/*.img | tail -1
df -h /mnt/d
```

The free space on D: (`df`, **Avail**) should be larger than the `du` total. Expect the backups to use a third to a half of it. The script checks again before each image and skips any image that won't fit (**NO ROOM**).

> **Note:** **An external USB drive.** Plug it in. Windows gives it a letter, say E:, and WSL shows it as `/mnt/e` (run `wsl --shutdown` and reopen Debian if it doesn't). Use it by setting the destination for each run: `IPRPS_BACKUP=/mnt/e/IPRPS/backups /root/iprps-backup.sh snapshots`. Eject it in Windows before unplugging it. An exFAT or NTFS drive is fine; FAT32 is not (files over 4 GB).

### F.2 Back up

**Snapshots. [DEBIAN ROOT]** Any time, without closing anything:

```bash
/root/iprps-backup.sh snapshots
```

- Each snapshot not yet backed up is compressed to `D:\IPRPS\backups\snapshots\iprps-<NAME>.img.zst`, tested, and kept. Each run prints **OK**, **up to date** (already backed up, unchanged) or **FAILED** for every snapshot.
- Run it after each checkpoint: only the new snapshot is copied.
- It ends with **Backup complete** and the free space on the drive.
- Allow about 5 to 15 minutes per snapshot (more for Medium and Advanced). Use a tmux window for long runs. Don't take or restore a snapshot while it runs.

**The working image.** Close it first (0.4 steps 1–2: stop test VMs, leave every chroot window), then:

**[DEBIAN ROOT]**

```bash
bash /root/iprps-leave.sh
/root/iprps-backup.sh image
```

The copy is `D:\IPRPS\backups\image\iprps-system-<date>.img.zst`, one per day; a second run on the same day replaces it only if the image changed. The script refuses to copy an image that's still open: an image copied while in use can be broken.

**Both at once:** `/root/iprps-backup.sh all`. **What's there:** `/root/iprps-backup.sh list` shows the files and the log `D:\IPRPS\backups\BACKUPS.txt` (date, file, the image's exact size in bytes).

**Housekeeping.** Backups aren't deleted automatically. Delete old ones in Windows Explorer (or with `rm` in Debian), but keep the **release snapshots** and the newest copy of each stage you might go back to.

### F.3 Restore

**Space first.** A restored image uses as much space in WSL as its data (`du` size), not its full size. Check `df -h /` in Debian before restoring.

**A snapshot back into `/root/snapshots`. [DEBIAN ROOT]**

```bash
mkdir -p /root/snapshots
zstd -d --sparse /mnt/d/IPRPS/backups/snapshots/iprps-<NAME>.img.zst -o /root/snapshots/iprps-<NAME>.img && echo "RESTORED"
ls -l /root/snapshots/iprps-<NAME>.img
grep 'iprps-<NAME>.img.zst' /mnt/d/IPRPS/backups/BACKUPS.txt | tail -1
```

- Wait for **RESTORED**. `ls -l` shows the same number of bytes as the last `BACKUPS.txt` line for that file.
- Then use it like any snapshot: *Restoring a snapshot* in 0.4 copies it over the build image.
- If `zstd` says the file exists, the snapshot is still in `/root/snapshots`: use that, or delete it first if you want the backup's version.

**The working image directly. [DEBIAN ROOT]** Do 0.4 steps 1–2 first:

```bash
bash /root/iprps-leave.sh
zstd -d --sparse -f /mnt/d/IPRPS/backups/image/iprps-system-<date>.img.zst -o /root/iprps-system.img && echo "RESTORED"
ls -l /root/iprps-system.img
```

`-f` replaces the current image. Re-enter the chroot windows (0.5) and continue from where that backup was made.

**On a new PC, or after WSL was reinstalled:**

1. Set up Debian in WSL again as in 0.2 and 0.3.
2. Install the build-host scripts from the repository (`install -vm755 /mnt/g/IPRPS/iprps-os/build-host/*.sh /root/`), then `apt install zstd`.
3. Restore the working image (or a snapshot, then restore it as in 0.4) with the commands above.
4. Create the scratch space as in 1.3, then enter the chroot (0.5). `/build` is empty on a new system: the next package you build downloads its sources again.

| Problem | Fix |
|---|---|
| **STOPPED: /mnt/d not found** | WSL doesn't see the drive: `wsl --shutdown` in PowerShell, reopen Debian. For a USB drive, check it's connected and has a drive letter in Explorer |
| **NO ROOM** for a snapshot | Free space on the drive (delete old backups) or use a bigger drive (`IPRPS_BACKUP=...`) |
| **STOPPED: the build image is in use** | Leave every chroot window, then `bash /root/iprps-leave.sh` |
| **FAILED**, or `zstd -d` reports a damaged file | The copy was interrupted or the drive has errors: run the backup again; check the drive in Windows (Properties → Tools → Check) |
| A restored image is the full 40 GB in WSL | `--sparse` was left out: delete it and restore again with `zstd -d --sparse` |
| Backups are very slow | Normal for a USB 2 drive or a busy disk. Close Windows programs that scan files (or exclude `D:\IPRPS\backups` from real-time antivirus scanning) |

## Appendix G — Remote Players

The IPRPS Table (12.7) is made for players in the same room, on the same network. A player in another city or state can join too, through **Tailscale**: a free app on both computers that links them into a small private network over the internet, encrypted with WireGuard. The remote player's browser then reaches the Table exactly as a phone on the Session Master's Wi-Fi does, and the Table treats them as a local player: same join code, same chat, dice, media and character sheets.

Nothing in IPRPS OS changes for this, and the Table needs no update: it already listens on every network the computer is on, answers only while the table is **open**, and only with the join code. No router settings (port forwarding) are needed on either side.

| | Session Master | Remote player |
|---|---|---|
| Computer | IPRPS OS (any edition) | Windows, macOS, Linux (IPRPS OS too), iPhone, iPad or Android |
| App | Tailscale, installed by `iprps-remote-play.sh` into `/opt/tailscale` | Tailscale from https://tailscale.com/download (on IPRPS OS: the same script) |
| Account | A free Tailscale account (Google, Microsoft, GitHub or email) | Their own free Tailscale account |
| Sees | Everything on their own Tailscale network | **Only** the Session Master's IPRPS computer, and only port 7777 (G.3) |

**What the script adds to the Session Master's computer.** `/opt/tailscale` (Tailscale's official static build, checked against its published SHA-256), `/etc/systemd/system/tailscaled.service` and `/var/lib/tailscale` (the sign-in). It installs no packages, changes no IPRPS files, and leaves the firewall and DNS settings alone (`--netfilter-mode=off`, `--accept-dns=false`). `remove` takes all of it out again. Tailscale uses the kernel's TUN device (Debian's and Arch's kernel configurations, 4.3, build it as the `tun` module); the script stops if the kernel has none. It never uses Tailscale's *userspace* mode, because that mode hands remote connections to the Table as if they came from the computer itself, and the Table trusts its own computer as the Session Master.

> **Side note:** Tailscale's free **Personal** plan covers up to 6 users with unlimited devices, for **non-commercial** use: a home campaign qualifies. Paid games for customers need a paid plan. A shared computer counts only for the Session Master's account.

### G.1 The Session Master's computer

All commands in this appendix run on the installed IPRPS OS computer, in a **Terminal** (not in the build windows), as a user who can run administrator tasks.

**1. Get the script.** It's in the repository as `tools/iprps-remote-play.sh`. In Firefox, open https://raw.githubusercontent.com/chiitascaran-collab/iprps-linux-distro/main/tools/iprps-remote-play.sh and save it (**Ctrl+S**) to **Downloads**, or copy it from a USB stick.

**2. Install and sign in.**

```bash
cd ~/Downloads
sudo bash iprps-remote-play.sh
```

It downloads Tailscale (about 30 MB), prints **Checksum OK**, starts the service, then prints **To authenticate, visit:** and a link. Open the link in Firefox, create or sign in to your Tailscale account, and approve the computer. The script finishes with:

```
Done. This computer's private address: 100.x.y.z
Remote players join the IPRPS Table at:  http://100.x.y.z:7777/
```

The computer's name on the Tailscale network is **iprps-table** (`TS_HOSTNAME=<name> sudo bash iprps-remote-play.sh` picks another). Tailscale starts at every boot from now on.

**3. Keep it signed in.** Tailscale asks every computer to sign in again after 180 days. In the admin console (https://login.tailscale.com/admin/machines), open the **⋯** menu next to **iprps-table** and choose **Disable key expiry**.

### G.2 Invite a player

In the admin console, open the **⋯** menu next to **iprps-table** and choose **Share…**. Copy the invite link (or enter the player's email) and send it to the player. One invite per player: you can see and revoke them under **Share…** later.

A shared computer is **quarantined**: the player can connect to it, but it can't connect to the player's devices, and the player sees none of your other devices.

### G.3 Allow players only the Table

Tailscale's starting rules let everyone on the network reach every port. Players need only the Table's port. In the admin console, open **Access controls**, replace the rules with these, and click **Save**:

```json
{
  "grants": [
    { "src": ["autogroup:member"], "dst": ["*"], "ip": ["*"] },
    { "src": ["autogroup:shared"], "dst": ["*"], "ip": ["tcp:7777"] }
  ]
}
```

The first rule keeps your own devices working as before; the second lets invited players (`autogroup:shared`) reach only TCP port 7777, the Table. If your Tailscale network already has rules of its own, add just the second rule to them.

> **Side note:** The web apps (Apache), the database and the Oracle listen only on `127.0.0.1` on IPRPS OS, so they can't be reached from outside anyway. The rule protects anything you add later that listens on the network.

### G.4 The player's side

1. Install Tailscale from https://tailscale.com/download and sign in with their own free account. On IPRPS OS, use the same script (G.1).
2. Open the invite link from the Session Master and click **Accept**. **iprps-table** appears in their Tailscale app.
3. At game time, the Session Master opens the table (**IPRPS Table → Open the table**). The console now lists the `100.x.y.z` address too, beside the local one. The player opens `http://100.x.y.z:7777/` in their browser and joins with the code.

The connection is encrypted end to end by Tailscale, so the Table's plain `http://` address is safe here: nothing crosses the internet unencrypted.

### G.5 Test it before game night

Use a phone as the "remote" player: install the Tailscale app on it, sign in with a **second** account (not the Session Master's), and accept the invite. Turn the phone's **Wi-Fi off** so it uses mobile data, open the table, and join at `http://100.x.y.z:7777/`. Send a message, roll a skill check, and **Show** an image from the console.

On the Session Master's computer:

```bash
sudo bash ~/Downloads/iprps-remote-play.sh status
```

It shows `active`, the address, and the connected devices. `direct` next to the player means a direct connection; `relay "…"` means Tailscale passes the traffic through one of its relay servers (still encrypted, a little slower), which happens when both sides are behind strict routers.

### G.6 Remove it

```bash
sudo bash ~/Downloads/iprps-remote-play.sh remove
```

It signs out, stops and removes the service, and deletes `/opt/tailscale` and `/var/lib/tailscale`. Delete **iprps-table** from the admin console's machine list as well. IPRPS OS is exactly as before.

| Problem | Fix |
|---|---|
| **No /dev/net/tun** | The kernel was built without TUN: check `ls /usr/lib/modules/$(uname -r)/kernel/drivers/net/tun.ko*` (or `CONFIG_TUN` in the kernel's `.config`, 4.3): it must be built as a module or into the kernel |
| **Checksum does not match** | The download was interrupted or changed: run the script again. Nothing was installed |
| `curl: (6) Could not resolve host` | The computer is offline: check the network and run it again |
| The console doesn't list a `100.` address | `sudo bash iprps-remote-play.sh status`: if it isn't `active`, `journalctl -u tailscaled -b` shows why. The console refreshes its address list within 10 seconds |
| The player's browser can't connect | The table isn't **open** (the page says so), the player hasn't accepted the invite, or the access rule (G.3) has a typo: the admin console shows **Access controls** errors when saving |
| Media and video play slowly for remote players | They come from the Session Master's home internet upload. Keep large videos short, or send an image instead |
| The player had to sign in again / the computer disappeared after 6 months | Key expiry: G.1 step 3 |

---

*Credits: Built with Linux From Scratch and Beyond Linux From Scratch 13.1 (https://www.linuxfromscratch.org/). BLFS commands are reproduced from the book under its MIT-licensed command terms; BLFS text is under a Creative Commons license. IPRPS design, scripts and explanations are original to this guide. "Linux" is a registered trademark of Linus Torvalds. Firefox is a trademark of the Mozilla Foundation; IPRPS ships an unbranded build. Medium and Advanced include ungoogled-chromium, an unbranded Chromium (BSD license), Ollama (MIT license) and Meta's Llama 3.2 3B Instruct model: Built with Llama. Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved. Claude, the Oracle's optional online AI, is a service of Anthropic used with each Session Master's own API key. Tailscale (Appendix G) is a product of Tailscale Inc., installed by the user from its official builds; IPRPS OS doesn't ship it.*
