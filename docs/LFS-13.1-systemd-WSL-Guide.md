# Building Your Own Linux Distribution with Linux From Scratch

## A Clear, Step-by-Step Companion to LFS 13.1-systemd (Debian on WSL2 Edition)

This guide walks you through the official **Linux From Scratch 13.1-systemd** book (published September 1, 2026) from start to finish. It uses plain language, gives every command in the order you run it, and adds side notes and pro tips along the way. It uses **Debian 13 ("trixie") running in WSL2 on Windows** as the host, builds LFS inside a **disk-image file**, and boots the finished system on **real hardware from a USB drive**. It assumes a reader with basic Linux command-line skills.

> **Side note:** Every command in this guide was extracted directly from the official LFS 13.1-systemd book source, so versions, patches and options match the book exactly. The explanations, notes and tips are written for this guide. When this guide and the book ever disagree, **the book wins**. Keep it open in a browser tab: https://www.linuxfromscratch.org/lfs/downloads/stable-systemd/LFS-BOOK-13.1-NOCHUNKS.html

---

## How to Use This Guide

### What you will end up with

A small, fully working Linux system that you compiled yourself from source code. It has its own kernel, C library, compiler, shell, the systemd init system and the GRUB boot loader, and it boots on its own and gives you a login prompt. It includes everything needed to compile more software, so it can grow into a full distribution (Phase 11 covers that).

### What you need

| Item | Minimum | Recommended |
|---|---|---|
| CPU | 64-bit x86 (x86_64) | 4 or more cores |
| RAM | 4 GB | 8 GB or more |
| Free disk space | 60 GB free on Windows drive C: | 120 GB or more (the image, a backup copy, and the copy for writing the USB) |
| Host OS | Windows 10 (22H2) or 11 with WSL2, running Debian 13 (trixie) | Same, fully updated |
| USB drive | 64 GB or larger (it will be erased) | USB 3 flash drive or USB SSD, 128 GB or more |
| Target computer | Any 64-bit PC that can boot from USB (UEFI or BIOS) | The computer you'll use LFS on |
| Internet | Needed to download about 630 MB of source code | Same |
| Time | Several evenings | Plan on 1–3 days of total build time, depending on hardware and how many test suites you run |

> **Pro tip:** WSL2 is a fast, convenient place to build LFS, but it can't *boot* LFS. That's why this edition builds on an image file you later write to a USB drive. **Phase 0** sets up Windows and WSL.

### How to read the callouts

> **Side note:** Background information. Helpful to understand, but you can skim it.

> **Pro tip:** A shortcut, a best practice, or advice that saves time or trouble.

> **Warning:** Read this carefully. Ignoring it can break the build or your host system.

> **Checkpoint:** A test you must pass before moving on.

### Command conventions

- Type commands **exactly** as shown. Copying and pasting whole blocks is fine.
- Text in angle brackets, like `<xxx>`, is a **placeholder**. Replace the entire thing, brackets included, with your own value. For example, `/dev/<xxx>` becomes `/dev/sdb3`.
- A backslash (`\`) at the end of a line means "the command continues on the next line." Nothing may follow the backslash, not even a space.
- `cat > file << "EOF"` ... `EOF` creates a file containing the lines in between.
- The **prompt** tells you *who* you are and *where* you are. Always check it before running a command:

| Prompt looks like | Who | Where | Used in |
|---|---|---|---|
| `PS C:\Users\you>` | you, in Windows PowerShell | Windows | Phase 0 and Phase 10 |
| `you@debian:~$` | your normal Debian user | WSL | general use |
| `root@debian:~#` | root in Debian (WSL) | host | Phases 1–3, start of Phase 6, Phase 10 |
| `lfs:~$` | the `lfs` build user | host | Phases 4–5 |
| `(lfs chroot) root:/#` | root inside the new system | chroot | Phases 6–9 |

### The big picture

LFS builds a new system *next to* your Debian system, then gradually cuts the ties to the host until the new system can stand on its own.

| Phase | Book chapter | What happens | Runs as |
|---|---|---|---|
| 0. Windows & WSL setup | — | Install WSL2 + Debian and tune WSL for long builds | you (Windows) |
| 1. Prepare the host | 2 | Check Debian, create and mount the LFS disk image | root (host) |
| 2. Download sources | 3 | Download every package and patch | root (host) |
| 3. Final preparations | 4 | Create a directory layout and the `lfs` user | root, then `lfs` |
| 4. Cross-toolchain | 5 | Build a cross-compiler that targets the new system | `lfs` |
| 5. Temporary tools | 6 | Use the cross-compiler to build basic tools | `lfs` |
| 6. Enter chroot | 7 | Switch into the new system and build a few more tools | root (chroot) |
| 7. Final system | 8 | Build every package for real, with test suites | root (chroot) |
| 8. Configure | 9 | Networking, clock, console, locale | root (chroot) |
| 9. Make it bootable | 10 | fstab, the Linux kernel, GRUB | root (chroot) |
| 10. First boot | 11 | Write the image to a USB drive and boot it on real hardware | root (WSL), then you (Windows) |
| 11. Make it a distro | beyond the book | Branding, BLFS, packaging and distribution | you |

> **Side note:** *Why so many stages?* Your host's compiler and libraries would "leak" into anything built with them. LFS first builds a **cross-compiler**, a compiler that makes programs for a "different" machine (the new system, identified as `x86_64-lfs-linux-gnu`). Tools built with it can't accidentally depend on the host. Then **chroot** ("change root") makes a folder look like `/` to the programs running inside it, so the final system is built using only its own tools.

### How a WSL build works

WSL2 (Windows Subsystem for Linux) runs a real Linux kernel in a lightweight virtual machine, so compilers, `chroot` and loop devices all behave normally, and LFS builds fine. Two things are different from building on a Linux PC:

| On a Linux PC | In WSL2 (this guide) |
|---|---|
| LFS gets its own partition on a real disk | LFS lives in a **disk-image file** (`/root/lfs-disk.img`) that acts like a whole disk, attached as `/dev/loop0` |
| You reboot into LFS | WSL **can't boot** LFS. You write the image to a **USB drive** and boot that on real hardware |
| The disk stays attached | The image is **detached on every WSL restart** and must be reattached (Appendix A) |

Debian also needs its usual **three small adjustments**, all covered in Phase 1:

| Debian default | LFS needs | Fixed in |
|---|---|---|
| `/bin/sh` is **dash** | Bash | Phase 1.2 |
| `awk` is **mawk** | GNU awk (gawk) | Phase 1.2 |
| root has **no password** in WSL Debian | a root login shell | Always use `sudo -i` |

> **Side note:** Debian's stability doesn't carry over into your LFS system. Debian is only the workshop; the finished system contains none of Debian's packages.

---

## Phase 0 — Prepare Windows and WSL

### 0.1 Install WSL2 and Debian

Skip this if Debian already runs in WSL. In **PowerShell as Administrator**:

```powershell
wsl --install -d Debian
```

Restart Windows if asked. When Debian opens the first time, create your Linux user name and password. Then check that Debian runs under **WSL version 2**:

```powershell
wsl -l -v
```

The `VERSION` column must say **2**. If it says 1, convert it with `wsl --set-version Debian 2`.

> **Pro tip:** Use **Windows Terminal** (from the Microsoft Store if it isn't installed). It gives Debian its own tab, handles colors and `tmux` properly, and lets you name tabs, for example **DEBIAN HOST** and **LFS CHROOT**.

### 0.2 Keep Windows paths out of Linux

By default, WSL adds Windows folders, with spaces in their names, to Linux's `PATH`. That can confuse build scripts. In Debian:

```bash
sudo tee -a /etc/wsl.conf << "EOF"

[interop]
appendWindowsPath=false
EOF
```

Then, in **PowerShell**, restart WSL so the setting takes effect, and reopen Debian:

```powershell
wsl --shutdown
```

### 0.3 Give WSL enough memory

WSL gets about half your RAM by default. GCC's test suite needs a lot. If your PC has 16 GB or more, create or edit `C:\Users\<you>\.wslconfig` in Notepad:

```text
[wsl2]
memory=12GB
swap=8GB
```

Run `wsl --shutdown` again afterward. Leave Windows at least 4 GB for itself.

### 0.4 Rules for building in WSL

- **Never build under `/mnt/c/...`** (your Windows drive). It's very slow from WSL and doesn't support Linux permissions. Everything in this guide lives inside Debian (`/root`, `/mnt/lfs`).
- **Always work inside `tmux`** (installed in Phase 1). Closing the terminal window doesn't stop a build running in tmux.
- **Pause Windows Update** for the length of the build (*Settings > Windows Update > Pause updates*). An automatic restart stops WSL and everything running in it, tmux included.
- **Don't run `wsl --shutdown` during a build.** It stops all of Linux instantly.
- **After any WSL restart, reattach the LFS image** before doing anything else (Appendix A).

### 0.5 What happens at the end

When the build is done (Phase 10), you'll copy the image to Windows, write it to a USB drive with **Rufus** (DD mode) or **balenaEtcher**, and boot the USB drive on the target PC. Download one of those tools now if you like. Both are free.

---

## Phase 1 — Prepare the Host (Book Chapter 2)

### 1.1 Update the host and install the build requirements

Open Debian (a Windows Terminal tab) and become root with a **login** shell:

```bash
sudo -i
```

> **Warning:** In WSL, Debian's root account has **no password**, so `su -` doesn't work. Use `sudo -i` (with your own password). It gives a root **login** shell, which this guide needs. Plain `sudo` or `sudo su` don't load root's settings.

> **Side note:** A root **login** shell reads root's startup file, `/root/.profile`. That matters later when you store the `LFS` variable.

Update the system and install everything LFS expects on the host:

```bash
apt update
apt full-upgrade
apt install build-essential bison gawk m4 texinfo perl python3 \
            patch xz-utils gzip tar wget dosfstools fdisk tmux
```

> **Side note:** `build-essential` brings in GCC, G++, Make and the C library headers. Debian doesn't install `gawk` or `bison` by default, so they're listed explicitly. `fdisk` provides `sfdisk`, which WSL's Debian doesn't always include. `dosfstools` formats the EFI System Partition, and `tmux` is optional but recommended (see the pro tip below).

> **Pro tip:** Run long builds inside `tmux` (`tmux new -s lfs`). If your terminal window closes or your SSH session drops, the build keeps running. Reattach with `tmux attach -t lfs`.

### 1.2 Run the host version check

If you already ran the OS check, run it once more after the package step above, because installing or updating packages can change the result. Save this script and run it as your normal user or as root:

```bash
cat > version-check.sh << "EOF"
#!/bin/bash
# A script to list version numbers of critical development tools

# If you have tools installed in other directories, adjust PATH here AND
# in ~lfs/.bashrc (section 4.4) as well.

LC_ALL=C 
PATH=/usr/bin:/bin

bail() { echo "FATAL: $1"; exit 1; }
grep --version > /dev/null 2> /dev/null || bail "grep does not work"
sed '' /dev/null || bail "sed does not work"
sort   /dev/null || bail "sort does not work"

ver_check()
{
   if ! type -p $2 &>/dev/null
   then 
     echo "ERROR: Cannot find $2 ($1)"; return 1; 
   fi
   v=$($2 --version 2>&1 | grep -E -o '[0-9]+\.[0-9\.]+[a-z]*' | head -n1)
   if printf '%s\n' $3 $v | sort --version-sort --check &>/dev/null
   then 
     printf "OK:    %-9s %-6s >= $3\n" "$1" "$v"; return 0;
   else 
     printf "ERROR: %-9s is TOO OLD ($3 or later required)\n" "$1"; 
     return 1; 
   fi
}

ver_kernel()
{
   kver=$(uname -r | grep -E -o '^[0-9\.]+')
   if printf '%s\n' $1 $kver | sort --version-sort --check &>/dev/null
   then 
     printf "OK:    Linux Kernel $kver >= $1\n"; return 0;
   else 
     printf "ERROR: Linux Kernel ($kver) is TOO OLD ($1 or later required)\n" "$kver"; 
     return 1; 
   fi
}

# Coreutils first because --version-sort needs Coreutils >= 7.0
if sort --version |& grep -q uutils; then
    ver_check Coreutils  sort     0.8 || bail "Uutils Coreutils too old, stop"
else
    ver_check Coreutils  sort     8.1 || bail "GNU Coreutils too old, stop"
fi
ver_check Bash           bash     3.2
ver_check Binutils       ld       2.13.1
ver_check Bison          bison    2.7
ver_check Diffutils      diff     2.8.1
ver_check Findutils      find     4.2.31
ver_check Gawk           gawk     4.0.1
ver_check GCC            gcc      5.4
ver_check "GCC (C++)"    g++      5.4
ver_check Grep           grep     2.5.1a
ver_check Gzip           gzip     1.3.12
ver_check M4             m4       1.4.10
ver_check Make           make     4.0
ver_check Patch          patch    2.5.4
ver_check Perl           perl     5.8.8
ver_check Python         python3  3.4
ver_check Sed            sed      4.1.5
ver_check Tar            tar      1.22
ver_check Texinfo        texi2any 5.0
ver_check Xz             xz       5.0.0
ver_kernel 5.10

if mount | grep -q 'devpts on /dev/pts' && [ -e /dev/ptmx ]
then echo "OK:    Linux Kernel supports UNIX 98 PTY";
else echo "ERROR: Linux Kernel does NOT support UNIX 98 PTY"; fi

alias_check() {
   if $1 --version 2>&1 | grep -qi $2
   then printf "OK:    %-4s is $2\n" "$1";
   else printf "ERROR: %-4s is NOT $2\n" "$1"; fi
}
echo "Aliases:"
alias_check awk GNU
alias_check yacc Bison
alias_check sh Bash

echo "Compiler check:"
if printf "int main(){}" | g++ -x c++ -
then echo "OK:    g++ works";
else echo "ERROR: g++ does NOT work"; fi
rm -f a.out

if [ "$(nproc)" = "" ]; then
   echo "ERROR: nproc is not available or it produces empty output"
else
   echo "OK: nproc reports $(nproc) logical cores are available"
fi
EOF

bash version-check.sh
```

> **Checkpoint:** Every line must say `OK`. Pay special attention to these results:
> - `sh is Bash`, `awk is GNU`, and `yacc is Bison` must all say **OK**. **On a fresh Debian install, the first two fail until you apply the fixes below.**
> - `g++ works` must say **OK**.
> - The `nproc` line tells you how many CPU cores the build can use.

**Fix `sh is NOT Bash`.** Debian uses dash as `/bin/sh`. Point it at Bash, and tell the package system to leave that choice alone when dash is updated:

```bash
dpkg-divert --remove --no-rename /bin/sh
ln -sfv bash /bin/sh
dpkg-divert --add --local --no-rename /bin/sh
```

> **Side note:** The first command removes any older claim dash may have on `/bin/sh` (Debian 12 had one). On Debian 13 there's usually nothing to remove, and a "No diversion ... none removed" message is harmless. The old `dpkg-reconfigure dash` method no longer offers this choice. To undo it all after LFS is finished: `dpkg-divert --remove --no-rename /bin/sh && ln -sfv dash /bin/sh`.

**Fix `awk is NOT GNU`.** Debian's default `awk` is mawk. Select gawk instead:

```bash
update-alternatives --set awk /usr/bin/gawk
```

**Fix `yacc is NOT Bison`.** First see what the alternatives system offers, then select Bison's version:

```bash
update-alternatives --display yacc
update-alternatives --set yacc /usr/bin/bison.yacc
```

If no `yacc` alternative exists at all, create a small wrapper instead:

```bash
cat > /usr/bin/yacc << "EOF"
#!/bin/sh
exec /usr/bin/bison -y "$@"
EOF
chmod 755 /usr/bin/yacc
```

Run `bash version-check.sh` again after any fix. Every line should now say `OK`.

> **Side note:** **Compiler versions.** LFS 13.1 was tested with GCC up to 16.2.0 and Binutils up to 2.47, and needs at least GCC 5.4. Debian 13 ships GCC 14, which is older than the tested maximum but well above the minimum, so it's fine. Check yours with `gcc --version | head -1`.

### 1.3 Understand "building in stages" (read before you start)

You don't have to build LFS in one sitting, but some setup has to be **redone every time you come back** (after a reboot or a new terminal). Memorize these three rules. **Appendix A** also has a copy-and-paste "resume" checklist.

1. **Phases 1–3:** As root, the `LFS` variable must be set (`echo $LFS` must print `/mnt/lfs`).
2. **Phases 4–5:** `/mnt/lfs` must be mounted, and you must be the **`lfs`** user (`su - lfs`). Never build these phases as root.
3. **Phases 6–9:** `/mnt/lfs` must be mounted, the **virtual filesystems** (`/dev`, `/proc`, `/sys`, `/run`) must be mounted, and you must re-enter the chroot.

> **Warning:** **WSL adds one rule before all of these:** after every WSL restart (`wsl --shutdown`, a Windows reboot or update), the LFS image is **detached** and `/mnt/lfs` is empty. Reattach and remount it first (step 1.7 or Appendix A).

### 1.4 Create the LFS disk image

Instead of a partition on a real disk, LFS gets a **40 GB image file** with its own partition table. The file only uses real space as it fills up.

> **Side note:** Make the image **smaller than your USB drive**: 40 GB fits a 64 GB stick. After LFS boots, Appendix E shows how to grow it to fill the whole drive.

```bash
truncate -s 40G /root/lfs-disk.img
```

Partition it with the recommended layout. It's a brand-new file, so there's nothing to wipe:

```bash
sfdisk /root/lfs-disk.img << "EOF"
label: gpt
size=512MiB, type=U, name="EFI"
size=1MiB,   type=21686148-6449-6E6F-744E-656564454649, name="BIOS boot"
size=36GiB,  type=L, name="lfs"
type=S, name="swap"
EOF
```

| # | Size | Type | Purpose |
|---|---|---|---|
| 1 | 512 MiB | EFI System | Boot files for UEFI computers (FAT32) |
| 2 | 1 MiB | BIOS boot | Space for GRUB on older BIOS computers (not formatted) |
| 3 | 36 GiB | Linux filesystem | The LFS root (`/`), ext4 |
| 4 | the rest (about 3.5 GiB) | Linux swap | Swap for the finished system |

### 1.5 Attach the image and create the filesystems

Attach the image as a disk. `-P` makes Linux see its partitions:

```bash
losetup -fP --show /root/lfs-disk.img
lsblk /dev/loop0
```

The first command prints the loop device it used, usually `/dev/loop0`. In this guide, `loop0` is assumed. If yours differs, use your number everywhere. `lsblk` must list `loop0p1` through `loop0p4`. If those partition entries are missing, run `partx -a /dev/loop0` and check again.

Format the partitions. Don't format `loop0p2`:

```bash
mkfs.vfat -F 32 /dev/loop0p1
mkfs -v -t ext4 /dev/loop0p3
mkswap /dev/loop0p4
```

> **Side note:** Don't turn on the LFS swap partition inside WSL. WSL manages its own swap. The partition is for the finished system.

### 1.6 Set the `LFS` variable and the umask

`LFS` is the most important variable in the whole build. It holds the directory where the new system lives.

```bash
export LFS=/mnt/lfs
```

```bash
umask 022
```

Check both values:

```bash
echo $LFS     # must print: /mnt/lfs
umask         # must print: 0022
```

Make both settings permanent for root so a new root login shell always has them:

```bash
cat >> /root/.profile << "EOF"
export LFS=/mnt/lfs
umask 022
EOF
```

> **Warning:** Don't create `/root/.bash_profile` on Debian. If that file exists, Bash stops reading `/root/.profile`, and Debian's normal root setup (including `.bashrc`) quietly stops loading.

> **Warning:** Many commands use `$LFS` in paths such as `$LFS/usr`. If `LFS` is ever **empty**, those paths become `/usr`, and you'll overwrite **your host system**. Get into the habit of typing `echo $LFS` before any command that installs or deletes something as root.

> **Pro tip:** Put the variable in the prompt so you can't forget it. For example: `export PS1='[\u@\h LFS=$LFS \W]\$ '`.

### 1.7 Mount the LFS partition and save its IDs

```bash
mkdir -pv $LFS
mount -v /dev/loop0p3 $LFS
```

```bash
chown root:root $LFS
chmod 755 $LFS
```

```bash
findmnt $LFS     # must show /dev/loop0p3, without nosuid or nodev
```

Save the partition IDs to a file. You'll need them in Phase 9, and this way you never have to type them from the screen:

```bash
blkid /dev/loop0p1 /dev/loop0p3 /dev/loop0p4 | tee /root/lfs-disk-ids.txt
```

| Partition | Looks like | Used for |
|---|---|---|
| `loop0p1` | short UUID, e.g. `87E8-3B4A` | the `/boot/efi` line in LFS's fstab |
| `loop0p3` | long UUID, e.g. `ac1797e4-...` | the root line in fstab, `grub.cfg` `search` line, and remounting |
| `loop0p3` | `PARTUUID="..."` | the `root=PARTUUID=` part of the kernel line in `grub.cfg` |
| `loop0p4` | long UUID | the swap line in fstab |

> **Pro tip:** **After every WSL restart, use these two commands** to bring the LFS disk back. Mounting by the root partition's UUID works even if the image comes back as `loop1`:
> ```bash
> losetup -fP --show /root/lfs-disk.img
> mount -v UUID=<root-UUID-from-lfs-disk-ids.txt> /mnt/lfs
> ```

---

## Phase 2 — Download Packages and Patches (Book Chapter 3)

### 2.1 Create the sources directory

As root, with `LFS` set:

```bash
mkdir -v $LFS/sources
```

Make it writable by everyone but "sticky," so users can only delete their own files:

```bash
chmod -v a+wt $LFS/sources
```

### 2.2 Download everything

The LFS project publishes a ready-made download list (`wget-list-systemd`) and a checksum file (`md5sums`) next to the online book. Download both, then download all packages:

```bash
cd $LFS/sources
wget https://www.linuxfromscratch.org/lfs/view/stable-systemd/wget-list-systemd
wget https://www.linuxfromscratch.org/lfs/view/stable-systemd/md5sums
```

```bash
wget --input-file=wget-list-systemd --continue --directory-prefix=$LFS/sources
```

> **Warning:** `stable-systemd` always points to the **newest** stable book. If a newer LFS release comes out while you're building 13.1, the lists at that address change too. Keep the copies you downloaded, and check that `head -5 wget-list-systemd` shows the 13.1 versions (for example `gcc-16.2.0`, `linux-7.1.8`).

> **Pro tip:** If a download fails, just run the same `wget` command again. `--continue` resumes partial files and skips finished ones. If one server is down, the book lists alternative mirrors at https://www.linuxfromscratch.org/lfs/mirrors.html#files. You can also download one complete tarball of every package from a mirror.

### 2.3 Verify the downloads

```bash
pushd $LFS/sources
  md5sum -c md5sums
popd
```

> **Checkpoint:** Every line must end in `OK`. Re-download any file that reports `FAILED`, then check again.

Because you downloaded as root, the files already belong to root. If you ever download as a normal user, fix the ownership:

```bash
chown root:root $LFS/sources/*
```

### 2.4 Check the errata and security advisories

Before building, read these two pages and note any changes to specific packages:

- Errata for this release: https://www.linuxfromscratch.org/lfs/errata/13.1-systemd/
- Security advisories: https://www.linuxfromscratch.org/advisories/

> **Side note:** If the errata tells you to use a newer version of a package, download that version into `$LFS/sources` and adjust the file names in the commands for that package.

---

## Phase 3 — Final Preparations (Book Chapter 4)

### 3.1 Create a minimal directory layout

As root, with `LFS` set:

```bash
mkdir -pv $LFS/{etc,var} $LFS/usr/{bin,lib,sbin}

for i in bin lib sbin; do
  ln -sv usr/$i $LFS/$i
done

case $(uname -m) in
  x86_64) mkdir -pv $LFS/lib64 ;;
esac
```

Create the directory that will hold the cross-compiler:

```bash
mkdir -pv $LFS/tools
```

> **Side note:** In LFS (like Debian 12 and later), `/bin`, `/lib` and `/sbin` are just symlinks into `/usr`. This is called a "merged /usr" layout.

> **Warning:** A `/usr/lib64` directory must **never** exist in LFS. If you ever see one, something went wrong.

### 3.2 Add the unprivileged `lfs` user

Building as an ordinary user means a typo can't wreck your host. As root:

```bash
groupadd lfs
useradd -s /bin/bash -g lfs -m -k /dev/null lfs
```

Optionally set a password (only needed if you want to log in as `lfs` directly):

```bash
passwd lfs
```

Give `lfs` ownership of the LFS directories:

```bash
chown -v lfs $LFS/{usr{,/*},var,etc,tools}
case $(uname -m) in
  x86_64) chown -v lfs $LFS/lib64 ;;
esac
```

### 3.3 Move Debian's global bashrc out of the way

Debian ships `/etc/bash.bashrc`, which would "pollute" the clean build environment. As root:

```bash
[ ! -e /etc/bash.bashrc ] || mv -v /etc/bash.bashrc /etc/bash.bashrc.NOUSE
```

> **Warning:** On Debian this file **exists**, so this step is **required**, not optional. You can restore it after Phase 5 with `mv -v /etc/bash.bashrc.NOUSE /etc/bash.bashrc`.

### 3.4 Switch to the `lfs` user

```bash
su - lfs
```

> **Side note:** The `-` gives `lfs` a clean *login* shell. If the `lfs:~$` prompt doesn't appear right away, type `fg` and press Enter.

### 3.5 Set up the `lfs` user's environment

As `lfs`, create `.bash_profile`. It replaces the login shell with a new shell that has an almost empty environment:

```bash
cat > ~/.bash_profile << "EOF"
exec env -i HOME=$HOME TERM=$TERM PS1='\u:\w\$ ' /bin/bash
EOF
```

Create `.bashrc`. This is where the key build variables live:

```bash
cat > ~/.bashrc << "EOF"
set +h
umask 022
LFS=/mnt/lfs
LC_ALL=POSIX
LFS_TGT=$(uname -m)-lfs-linux-gnu
PATH=/usr/bin
if [ ! -L /bin ]; then PATH=/bin:$PATH; fi
PATH=$LFS/tools/bin:$PATH
CONFIG_SITE=$LFS/usr/share/config.site
export LFS LC_ALL LFS_TGT PATH CONFIG_SITE
EOF
```

> **Side note:** What each setting does:
> - `set +h` turns off command hashing, so the shell immediately finds newly built tools.
> - `LC_ALL=POSIX` keeps tool output in a plain, predictable format.
> - `LFS_TGT=x86_64-lfs-linux-gnu` is the "name" of the new machine that the cross-compiler targets.
> - `PATH=$LFS/tools/bin:...` puts the cross-compiler first, ahead of the host's tools.
> - `CONFIG_SITE` stops the host's own `configure` settings from leaking in.

Use all your CPU cores for building:

```bash
cat >> ~/.bashrc << "EOF"
export MAKEFLAGS=-j$(nproc)
EOF
```

> **Warning:** Never write `-j` **without** a number (for example `MAKEFLAGS=-j`). That starts unlimited parallel jobs and can freeze the machine.

Load the new environment:

```bash
source ~/.bash_profile
```

> **Checkpoint:** Run `echo $LFS $LFS_TGT $MAKEFLAGS` and `whoami`. You should see `/mnt/lfs x86_64-lfs-linux-gnu -j<cores>` and `lfs`.

### 3.6 About SBUs and test suites

- **SBU (Standard Build Unit):** Build times are given as multiples of how long the first package (Binutils pass 1) takes on your machine. If Binutils takes 3 minutes, a "10 SBU" package takes about 30 minutes. In this guide, times assume 4 cores (except Binutils pass 1).
- **Test suites:** In Phases 4–5 there are **no tests**, because the cross-compiled programs can't run properly on the host yet. In Phase 7, tests are recommended. The GCC, Binutils and Glibc tests are strongly recommended.

> **Pro tip:** If your system has a power-profile tool, set it to performance mode for faster, more consistent builds. For example, `powerprofilesctl set performance` if `power-profiles-daemon` is installed on the host.

---

## Phase 4 — Build the Cross-Toolchain (Book Chapter 5)

### 4.0 The package routine (read this once, then repeat it for every package)

From now on, almost every package follows the same six steps. The package sections below show steps 1, 2 and 6 for you each time. **This is the most important procedure in the book.**

1. Go to the sources directory: `cd $LFS/sources` (in Phases 4–5) or `cd /sources` (inside the chroot, Phases 6–7).
2. Extract the package **as the build user** (`lfs` or chroot root): `tar -xf <package>.tar.xz`
3. Change into the new directory: `cd <package-directory>`
4. Run that package's commands **in order**.
5. Watch the end of each command's output for errors.
6. Go back up and **delete the extracted directory**: `cd $LFS/sources` and `rm -rf <package-directory>`

> **Warning:** Always delete the extracted source directory when you're done, and always start each package from a **fresh** extraction, even for packages you build twice (Binutils, GCC, and others). Reusing an old directory is a very common cause of failures.

> **Warning:** Before starting each package in Phases 4–5, confirm you are the `lfs` user (`whoami`) and that `echo $LFS` prints `/mnt/lfs`. Also make sure `/bin/sh` points to Bash, `awk` to Gawk, and `yacc` to Bison, as checked in Phase 1.

> **Pro tip:** Keep a log of every build so you can look back if something goes wrong. For example: `make 2>&1 | tee ../make.log`. When a parallel build (`-j`) fails, rerun it with `make -j1` to see the real error message at the end.

> **Side note:** *How do I know if something failed?* A successful `make` or `make install` ends without a line containing `Error`, and `echo $?` right after the command prints `0`. `configure` scripts end with messages like `config.status: creating Makefile`. Warnings are normal. Errors are not.

### Binutils-2.47 — Pass 1

*Book §5.2* · *Package:* `binutils-2.47.tar.xz` · *Build time:* 1 SBU · *Disk space:* 691 MB

**What it is:** The linker (`ld`), assembler (`as`) and other tools that turn compiled code into programs.

**Why now:** Binutils is always built first: GCC and Glibc both check which linker and assembler exist when they configure themselves.

> **Pro tip:** This package defines your **SBU** (Standard Build Unit). Wrap the build in `time { ../configure ... && make && make install; }` and note the "real" time. Every other build time in this guide is a multiple of that number.

> **Warning:** Binutils insists on being built in a separate `build` directory. The `mkdir -v build; cd build` step is not optional.

Unpack the package:

```bash
cd $LFS/sources
tar -xf binutils-2.47.tar.xz
cd binutils-2.47
```

Build and install. Run each block in order:

```bash
mkdir -v build
cd       build
```

```bash
../configure --prefix=$LFS/tools \
             --with-sysroot=$LFS \
             --target=$LFS_TGT   \
             --disable-nls       \
             --enable-gprofng=no \
             --disable-werror    \
             --enable-new-dtags  \
             --enable-default-hash-style=gnu
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd $LFS/sources
rm -rf binutils-2.47
```

> **Side note:** `--target=$LFS_TGT` makes this a *cross* linker: it produces programs for the new system, not for the host. `--with-sysroot=$LFS` makes it look for libraries inside `$LFS` instead of on the host.

### GCC-16.2.0 — Pass 1

*Book §5.3* · *Package:* `gcc-16.2.0.tar.xz` · *Build time:* 4.3 SBU · *Disk space:* 5.8 GB

**What it is:** The GNU C and C++ compiler, first pass (a minimal cross-compiler).

**Why now:** We need a compiler that targets the new system before we can build its C library.

> **Side note:** GCC needs three math libraries (MPFR, GMP, MPC). Instead of installing them separately, the first command unpacks them *inside* the GCC source tree so GCC builds them automatically.

Unpack the package:

```bash
cd $LFS/sources
tar -xf gcc-16.2.0.tar.xz
cd gcc-16.2.0
```

Build and install. Run each block in order:

```bash
tar -xf ../mpfr-4.2.2.tar.xz
mv -v mpfr-4.2.2 mpfr
tar -xf ../gmp-6.3.0.tar.xz
mv -v gmp-6.3.0 gmp
tar -xf ../mpc-1.4.1.tar.xz
mv -v mpc-1.4.1 mpc
```

```bash
case $(uname -m) in
  x86_64)
    sed -e '/m64=/s/lib64/lib/' \
        -i.orig gcc/config/i386/t-linux64
 ;;
esac
```

```bash
mkdir -v build
cd       build
```

```bash
../configure                  \
    --target=$LFS_TGT         \
    --prefix=$LFS/tools       \
    --with-glibc-version=2.44 \
    --with-sysroot=$LFS       \
    --with-newlib             \
    --without-headers         \
    --enable-default-pie      \
    --enable-default-ssp      \
    --disable-fixincludes     \
    --disable-nls             \
    --disable-shared          \
    --disable-multilib        \
    --disable-threads         \
    --disable-libatomic       \
    --disable-libgomp         \
    --disable-libquadmath     \
    --disable-libssp          \
    --disable-libvtv          \
    --disable-libstdcxx       \
    --enable-languages=c,c++
```

```bash
make
```

```bash
make install
```

```bash
cat ../gcc/{limitx,glimits,limity}.h  > \
  $($LFS_TGT-gcc -print-file-name=include)/limits.h
```

Clean up:

```bash
cd $LFS/sources
rm -rf gcc-16.2.0
```

> **Side note:** The `sed` on `t-linux64` (x86_64 only) makes GCC put 64-bit libraries in `/lib` instead of `/lib64`, matching LFS's layout.

> **Side note:** The final `cat ... limits.h` command builds a complete `limits.h` header. The first pass of GCC can't create it correctly because Glibc doesn't exist yet.

> **Pro tip:** GCC is big (about 4 SBU here and far more in Chapter 8). Start it, then go do something else.

### Linux-7.1.8 API Headers

*Book §5.4* · *Package:* `linux-7.1.8.tar.xz` · *Build time:* less than 0.1 SBU · *Disk space:* 1.8 GB

**What it is:** The kernel's public header files (the "API"), which tell the C library how to talk to the kernel.

Unpack the package:

```bash
cd $LFS/sources
tar -xf linux-7.1.8.tar.xz
cd linux-7.1.8
```

Build and install. Run each block in order:

```bash
make mrproper
```

```bash
make headers
find usr/include -type f ! -name '*.h' -delete

cp -rv usr/include $LFS/usr
```

Clean up:

```bash
cd $LFS/sources
rm -rf linux-7.1.8
```

> **Side note:** You are **not** building a kernel here, only copying headers. The real kernel is built in Chapter 10.

> **Side note:** `make mrproper` wipes any stray files that shipped in the tarball, so the headers come out clean.

### Glibc-2.44

*Book §5.5* · *Package:* `glibc-2.44.tar.xz` · *Build time:* 1.3 SBU · *Disk space:* 900 MB

**What it is:** The GNU C Library: the core library that almost every program on Linux needs to run.

> **Warning:** **Double-check `echo $LFS` before running `make DESTDIR=$LFS install` below.** If `LFS` is empty, that command installs Glibc over your host system and can break it. It is the single most dangerous command in the whole build.

> **Side note:** The first command creates the standard dynamic-loader symlinks that some programs expect.

Unpack the package:

```bash
cd $LFS/sources
tar -xf glibc-2.44.tar.xz
cd glibc-2.44
```

Build and install. Run each block in order:

```bash
case $(uname -m) in
    i?86)   ln -sfv ld-linux.so.2 $LFS/lib/ld-lsb.so.3
    ;;
    x86_64) ln -sfv ../lib/ld-linux-x86-64.so.2 $LFS/lib64
            ln -sfv ../lib/ld-linux-x86-64.so.2 $LFS/lib64/ld-lsb-x86-64.so.3
    ;;
esac
```

```bash
patch -Np1 -i ../glibc-fhs-1.patch
```

```bash
patch -Np1 -i ../glibc-2.44-upstream_fixes-1.patch
```

```bash
mkdir -v build
cd       build
```

```bash
echo "rootsbindir=/usr/sbin" > configparms
```

```bash
../configure                             \
      --prefix=/usr                      \
      --host=$LFS_TGT                    \
      --build=$(../scripts/config.guess) \
      --disable-nscd                     \
      libc_cv_slibdir=/usr/lib           \
      --enable-kernel=5.10
```

You may see this warning during `configure`. It is harmless (`msgfmt` comes later) and you can ignore it:

```text
configure: WARNING:
*** These auxiliary programs are missing or
*** incompatible versions: msgfmt
*** some features will be disabled.
*** Check the INSTALL file for required versions.
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

```bash
sed '/RTLDLIST=/s@/usr@@g' -i $LFS/usr/bin/ldd
```

Test suite (recommended, but optional):

```bash
echo 'int main(){}' | $LFS_TGT-gcc -x c - -v -Wl,--verbose &> dummy.log
$LFS_TGT-readelf -l a.out | grep ': /lib'
```

Expected output (x86_64; 32-bit systems show `/lib/ld-linux.so.2`):

```text
[Requesting program interpreter: /lib64/ld-linux-x86-64.so.2]
```

```bash
grep -E -o "$LFS/lib.*/S?crt[1in].*succeeded" dummy.log
```

Expected output:

```text
/mnt/lfs/lib/../lib/Scrt1.o succeeded
/mnt/lfs/lib/../lib/crti.o succeeded
/mnt/lfs/lib/../lib/crtn.o succeeded
```

```bash
grep -B3 "^ $LFS/usr/include" dummy.log
```

Expected output:

```text
#include <...> search starts here:
 /mnt/lfs/tools/lib/gcc/x86_64-lfs-linux-gnu/16.2.0/include
 /mnt/lfs/tools/lib/gcc/x86_64-lfs-linux-gnu/16.2.0/include-fixed
 /mnt/lfs/usr/include
```

```bash
grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'
```

Expected output:

```text
SEARCH_DIR("=/mnt/lfs/tools/x86_64-lfs-linux-gnu/lib64")
SEARCH_DIR("=/usr/local/lib64")
SEARCH_DIR("=/lib64")
SEARCH_DIR("=/usr/lib64")
SEARCH_DIR("=/mnt/lfs/tools/x86_64-lfs-linux-gnu/lib")
SEARCH_DIR("=/usr/local/lib")
SEARCH_DIR("=/lib")
SEARCH_DIR("=/usr/lib");
```

```bash
grep "/lib.*/libc.so.6 " dummy.log
```

Expected output:

```text
attempt to open /mnt/lfs/usr/lib/libc.so.6 succeeded
```

```bash
grep found dummy.log
```

Expected output:

```text
found ld-linux-x86-64.so.2 at /mnt/lfs/usr/lib/ld-linux-x86-64.so.2
```

```bash
rm -v a.out dummy.log
```

Clean up:

```bash
cd $LFS/sources
rm -rf glibc-2.44
```

> **Checkpoint:** The "sanity check" commands at the end are the most important test in Chapter 5. Every result should match the expected output. If anything is different, **stop** and find out why before continuing.

### Libstdc++ from GCC-16.2.0

*Book §5.6* · *Package:* `gcc-16.2.0.tar.xz` · *Build time:* 0.3 SBU · *Disk space:* 1.5 GB

**What it is:** The C++ standard library, which the first-pass GCC could not build because Glibc did not exist yet.

Unpack the package:

```bash
cd $LFS/sources
tar -xf gcc-16.2.0.tar.xz
cd gcc-16.2.0
```

Build and install. Run each block in order:

```bash
mkdir -v build
cd       build
```

```bash
../libstdc++-v3/configure      \
    --host=$LFS_TGT            \
    --build=$(../config.guess) \
    CXX=$LFS_TGT-gcc           \
    --prefix=/usr              \
    --disable-multilib         \
    --disable-nls              \
    --disable-libstdcxx-pch    \
    --with-gxx-include-dir=/tools/$LFS_TGT/include/c++/16.2.0
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

```bash
rm -v $LFS/usr/lib/lib{stdc++{,exp,fs},supc++}.la
```

Clean up:

```bash
cd $LFS/sources
rm -rf gcc-16.2.0
```

> **Side note:** This uses the **GCC** tarball again. Remove the old `gcc-16.2.0` directory first, then extract it fresh.

> **Side note:** The last command deletes `.la` libtool files. They can cause problems when cross-compiling, and modern systems do not need them.


> **Checkpoint:** The cross-toolchain is done. You now have a compiler in `$LFS/tools` that builds programs for the new system.

---

## Phase 5 — Cross-Compile the Temporary Tools (Book Chapter 6)

These basic utilities are built with the new cross-compiler and installed into `$LFS`. They are temporary; the final versions are built in Phase 7. Stay logged in as **`lfs`**.

> **Side note:** Notice `--host=$LFS_TGT` and `make DESTDIR=$LFS install` in the commands below. The first says "build for the new system." The second says "install into `$LFS`, not into the host."

### M4-1.4.21

*Book §6.2* · *Package:* `m4-1.4.21.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 39 MB

**What it is:** A macro processor used by many build systems (for example Autoconf and Bison).

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf m4-1.4.21.tar.xz
cd m4-1.4.21
```

Build and install. Run each block in order:

```bash
cat > $LFS/usr/share/config.site << EOF
ac_cv_func_posix_spawn_file_actions_addchdir=yes
ac_cv_func_posix_spawn_file_actions_addfchdir=yes
EOF
```

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            --build=$(build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf m4-1.4.21
```

> **Side note:** The `config.site` file created here pre-answers two `configure` questions that can't be tested while cross-compiling.

### Ncurses-6.6

*Book §6.3* · *Package:* `ncurses-6.6.tar.gz` · *Build time:* 0.4 SBU · *Disk space:* 54 MB

**What it is:** A library for drawing text-based screens and menus in the terminal.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf ncurses-6.6.tar.gz
cd ncurses-6.6
```

Build and install. Run each block in order:

```bash
mkdir build
pushd build
  ../configure --prefix=$LFS/tools AWK=gawk
  make -C include
  make -C progs tic
  install progs/tic $LFS/tools/bin
popd
```

```bash
./configure --prefix=/usr                \
            --host=$LFS_TGT              \
            --build=$(./config.guess)    \
            --mandir=/usr/share/man      \
            --with-manpage-format=normal \
            --with-shared                \
            --without-normal             \
            --with-cxx-shared            \
            --without-debug              \
            --without-ada                \
            --disable-stripping          \
            AWK=gawk
```

```bash
make
```

```bash
make DESTDIR=$LFS install
ln -sv libncursesw.so $LFS/usr/lib/libncurses.so
sed -e 's/^#if.*XOPEN.*$/#if 1/' \
    -i $LFS/usr/include/curses.h
```

Clean up:

```bash
cd $LFS/sources
rm -rf ncurses-6.6
```

> **Side note:** The first block builds a small `tic` program that runs **on the host**. It's needed to create the terminal database for the new system.

### Bash-5.3

*Book §6.4* · *Package:* `bash-5.3.tar.gz` · *Build time:* 0.2 SBU · *Disk space:* 73 MB

**What it is:** The Bourne-Again Shell, the command interpreter you type into.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf bash-5.3.tar.gz
cd bash-5.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr                      \
            --build=$(sh support/config.guess) \
            --host=$LFS_TGT                    \
            --without-bash-malloc              \
            --docdir=/usr/share/doc/bash-5.3
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

```bash
ln -sv bash $LFS/bin/sh
```

Clean up:

```bash
cd $LFS/sources
rm -rf bash-5.3
```

### Coreutils-9.11

*Book §6.5* · *Package:* `coreutils-9.11.tar.xz` · *Build time:* 0.3 SBU · *Disk space:* 193 MB

**What it is:** Basic file, text and shell commands: `ls`, `cp`, `mv`, `cat`, `chmod`, and many more.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf coreutils-9.11.tar.xz
cd coreutils-9.11
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr                     \
            --host=$LFS_TGT                   \
            --build=$(build-aux/config.guess) \
            --enable-install-program=hostname
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

```bash
mv -v $LFS/usr/bin/chroot              $LFS/usr/sbin
mkdir -pv $LFS/usr/share/man/man8
mv -v $LFS/usr/share/man/man1/chroot.1 $LFS/usr/share/man/man8/chroot.8
sed -i 's/"1"/"8"/'                    $LFS/usr/share/man/man8/chroot.8
```

Clean up:

```bash
cd $LFS/sources
rm -rf coreutils-9.11
```

### Diffutils-3.12

*Book §6.6* · *Package:* `diffutils-3.12.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 35 MB

**What it is:** Tools such as `diff` and `cmp` that show differences between files.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf diffutils-3.12.tar.xz
cd diffutils-3.12
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            gl_cv_func_strcasecmp_works=yes \
            --build=$(./build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf diffutils-3.12
```

### File-5.48

*Book §6.7* · *Package:* `file-5.48.tar.gz` · *Build time:* 0.1 SBU · *Disk space:* 46 MB

**What it is:** The `file` command, which identifies what type of data a file contains.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf file-5.48.tar.gz
cd file-5.48
```

Build and install. Run each block in order:

```bash
mkdir build
pushd build
  ../configure --disable-bzlib      \
               --disable-libseccomp \
               --disable-xzlib      \
               --disable-zlib
  make
popd
```

```bash
./configure --prefix=/usr --host=$LFS_TGT --build=$(./config.guess)
```

```bash
make FILE_COMPILE=$(pwd)/build/src/file
```

```bash
make DESTDIR=$LFS install
```

```bash
rm -v $LFS/usr/lib/libmagic.la
```

Clean up:

```bash
cd $LFS/sources
rm -rf file-5.48
```

> **Side note:** File is built twice here: once for the host (to get a working `file` program) and once for LFS. The version of `file` used to build must match the one being built.

### Findutils-4.11.0

*Book §6.8* · *Package:* `findutils-4.11.0.tar.xz` · *Build time:* 0.2 SBU · *Disk space:* 51 MB

**What it is:** The `find` and `xargs` commands for searching the filesystem.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf findutils-4.11.0.tar.xz
cd findutils-4.11.0
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr                   \
            --localstatedir=/var/lib/locate \
            --host=$LFS_TGT                 \
            --build=$(build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf findutils-4.11.0
```

### Gawk-5.4.1

*Book §6.9* · *Package:* `gawk-5.4.1.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 52 MB

**What it is:** GNU awk, a small language for processing text.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf gawk-5.4.1.tar.xz
cd gawk-5.4.1
```

Build and install. Run each block in order:

```bash
sed -i 's/extras//' Makefile.in
```

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            --build=$(build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf gawk-5.4.1
```

### Grep-3.12

*Book §6.10* · *Package:* `grep-3.12.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 32 MB

**What it is:** The `grep` command for searching text with patterns.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf grep-3.12.tar.xz
cd grep-3.12
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            --build=$(./build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf grep-3.12
```

### Gzip-1.14

*Book §6.11* · *Package:* `gzip-1.14.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 12 MB

**What it is:** The `gzip` compression tool.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf gzip-1.14.tar.xz
cd gzip-1.14
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr --host=$LFS_TGT
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf gzip-1.14
```

### Make-4.4.1

*Book §6.12* · *Package:* `make-4.4.1.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 15 MB

**What it is:** The `make` program that drives almost every build in this guide.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf make-4.4.1.tar.gz
cd make-4.4.1
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            --build=$(build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf make-4.4.1
```

### Patch-2.8

*Book §6.13* · *Package:* `patch-2.8.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 14 MB

**What it is:** The `patch` program, which applies `.patch` files to source code.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf patch-2.8.tar.xz
cd patch-2.8
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            --build=$(build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf patch-2.8
```

### Sed-4.10

*Book §6.14* · *Package:* `sed-4.10.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 27 MB

**What it is:** The stream editor `sed`, used constantly by build scripts (and by this guide) to edit files.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf sed-4.10.tar.xz
cd sed-4.10
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            --build=$(./build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf sed-4.10
```

### Tar-1.35

*Book §6.15* · *Package:* `tar-1.35.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 43 MB

**What it is:** The `tar` archiver, which unpacks every package in this guide.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf tar-1.35.tar.xz
cd tar-1.35
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr   \
            --host=$LFS_TGT \
            --build=$(build-aux/config.guess)
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

Clean up:

```bash
cd $LFS/sources
rm -rf tar-1.35
```

### Xz-5.8.3

*Book §6.16* · *Package:* `xz-5.8.3.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 24 MB

**What it is:** XZ compression tools and the `liblzma` library.

**Why now:** Cross-compiled with the new toolchain and installed into `$LFS` (`DESTDIR=$LFS`). It will be rebuilt properly in Chapter 8.

Unpack the package:

```bash
cd $LFS/sources
tar -xf xz-5.8.3.tar.xz
cd xz-5.8.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr                     \
            --host=$LFS_TGT                   \
            --build=$(build-aux/config.guess) \
            --disable-static                  \
            --docdir=/usr/share/doc/xz-5.8.3
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

```bash
rm -v $LFS/usr/lib/liblzma.la
```

Clean up:

```bash
cd $LFS/sources
rm -rf xz-5.8.3
```

### Binutils-2.47 — Pass 2

*Book §6.17* · *Package:* `binutils-2.47.tar.xz` · *Build time:* 0.4 SBU · *Disk space:* 560 MB

**What it is:** Binutils again, this time cross-compiled so it can run inside the new system.

Unpack the package:

```bash
cd $LFS/sources
tar -xf binutils-2.47.tar.xz
cd binutils-2.47
```

Build and install. Run each block in order:

```bash
sed '6031s/$add_dir//' -i ltmain.sh
```

```bash
mkdir -v build
cd       build
```

```bash
../configure                   \
    --prefix=/usr              \
    --build=$(../config.guess) \
    --host=$LFS_TGT            \
    --disable-nls              \
    --enable-shared            \
    --enable-gprofng=no        \
    --disable-werror           \
    --enable-64-bit-bfd        \
    --enable-new-dtags         \
    --enable-default-hash-style=gnu
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

```bash
rm -v $LFS/usr/lib/lib{bfd,ctf,ctf-nobfd,opcodes,sframe}.{a,la}
```

Clean up:

```bash
cd $LFS/sources
rm -rf binutils-2.47
```

> **Side note:** Remove the old `binutils-2.47` directory and re-extract before starting. Never reuse a build directory between passes.

### GCC-16.2.0 — Pass 2

*Book §6.18* · *Package:* `gcc-16.2.0.tar.xz` · *Build time:* 5.2 SBU · *Disk space:* 6.4 GB

**What it is:** GCC again, this time as a full compiler that runs inside the new system.

Unpack the package:

```bash
cd $LFS/sources
tar -xf gcc-16.2.0.tar.xz
cd gcc-16.2.0
```

Build and install. Run each block in order:

```bash
tar -xf ../mpfr-4.2.2.tar.xz
mv -v mpfr-4.2.2 mpfr
tar -xf ../gmp-6.3.0.tar.xz
mv -v gmp-6.3.0 gmp
tar -xf ../mpc-1.4.1.tar.xz
mv -v mpc-1.4.1 mpc
```

```bash
case $(uname -m) in
  x86_64)
    sed -e '/m64=/s/lib64/lib/' \
        -i.orig gcc/config/i386/t-linux64
  ;;
esac
```

```bash
mkdir -v build
cd       build
```

```bash
../configure                   \
    --build=$(../config.guess) \
    --host=$LFS_TGT            \
    --target=$LFS_TGT          \
    --prefix=/usr              \
    --with-build-sysroot=$LFS  \
    --enable-default-pie       \
    --enable-default-ssp       \
    --disable-fixincludes      \
    --disable-nls              \
    --disable-multilib         \
    --disable-libatomic        \
    --disable-libgomp          \
    --disable-libquadmath      \
    --disable-libsanitizer     \
    --disable-libssp           \
    --disable-libvtv           \
    --enable-languages=c,c++   \
    CXX_FOR_TARGET="$LFS_TGT-gcc -nostdinc++" \
    LDFLAGS_FOR_TARGET=-L$PWD/$LFS_TGT/libgcc \
    target_configargs=gcc_cv_target_thread_file=posix
```

```bash
make
```

```bash
make DESTDIR=$LFS install
```

```bash
ln -sv gcc $LFS/usr/bin/cc
```

Clean up:

```bash
cd $LFS/sources
rm -rf gcc-16.2.0
```

> **Side note:** Remove the old `gcc-16.2.0` directory and re-extract before starting. As in pass 1, MPFR, GMP and MPC are unpacked inside the GCC tree.

> **Checkpoint:** After `make DESTDIR=$LFS install`, the last command creates a `cc` symlink. Chapter 6 is now complete.


> **Checkpoint:** Phase 5 is done. You can now log out of the `lfs` user (`exit`). You won't need it again.

---

## Phase 6 — Enter the Chroot and Build More Temporary Tools (Book Chapter 7)

### 6.1 Become root again and hand ownership to root

Leave the `lfs` user's shell:

```bash
exit
```

You're now back in your **root** shell on the host. **From this phase on, every command runs as root.** Check that `LFS` is still set:

```bash
echo $LFS    # must print /mnt/lfs
```

Hand the files back to root. In the finished system, the `lfs` user won't exist, so its files shouldn't belong to it:

```bash
chown --from lfs -R root:root $LFS/{usr,var,etc,tools}
case $(uname -m) in
  x86_64) chown --from lfs -R root:root $LFS/lib64 ;;
esac
```

You can now restore the host's global bashrc if you want to:

```bash
[ -e /etc/bash.bashrc.NOUSE ] && mv -v /etc/bash.bashrc.NOUSE /etc/bash.bashrc
```

### 6.2 Mount the virtual kernel filesystems

Programs inside the chroot need `/dev`, `/proc`, `/sys` and `/run`, just like a running system. Create the mount points:

```bash
mkdir -pv $LFS/{dev,proc,sys,run}
```

Bind-mount the host's `/dev` so the chroot can see devices:

```bash
mount -v --bind /dev $LFS/dev
```

Mount the other virtual filesystems:

```bash
mount -vt devpts devpts -o gid=5,mode=0620 $LFS/dev/pts
mount -vt proc proc $LFS/proc
mount -vt sysfs sysfs $LFS/sys
mount -vt tmpfs tmpfs $LFS/run
```

Handle shared memory (`/dev/shm`):

```bash
if [ -h $LFS/dev/shm ]; then
  install -v -d -m 1777 $LFS$(realpath /dev/shm)
else
  mount -vt tmpfs -o nosuid,nodev tmpfs $LFS/dev/shm
fi
```

> **Warning:** These mounts **disappear when you reboot** or unmount them. Every time you come back to Phases 6–9, you have to remount them *before* entering the chroot. See Appendix A.

### 6.3 Enter the chroot

```bash
chroot "$LFS" /usr/bin/env -i   \
    HOME=/root                  \
    TERM="$TERM"                \
    PS1='(lfs chroot) \u:\w\$ ' \
    PATH=/usr/bin:/usr/sbin     \
    MAKEFLAGS="-j$(nproc)"      \
    TESTSUITEFLAGS="-j$(nproc)" \
    /bin/bash --login
```

> **Side note:** `env -i` starts with a completely empty environment and then sets only the variables listed. Your prompt changes to `(lfs chroot) I have no name!:/#` for the moment. The "I have no name!" part is expected, because `/etc/passwd` doesn't exist yet. You'll fix it in step 6.5.

> **Pro tip:** Make the chroot impossible to confuse with the host. Inside the chroot, run `export PS1='\[\e[1;33m\](lfs chroot) \u:\w\$\[\e[0m\] '` for a bold yellow prompt. To keep it after re-entering, add the same line to `/root/.bashrc` inside the chroot (after step 6.5).

> **Checkpoint:** Run `ls /`. You should see the **LFS** directory tree (for example `sources`, `tools`, `usr`), **not** your host's files.

From here until Phase 10, **everything happens inside the chroot**. The `$LFS` variable isn't used here, because the chroot's `/` *is* the LFS partition.

### 6.4 Create the full directory tree

```bash
mkdir -pv /{boot,home,mnt,opt,srv}
```

```bash
mkdir -pv /etc/{opt,sysconfig}
mkdir -pv /lib/firmware
mkdir -pv /media/{floppy,cdrom}
mkdir -pv /usr/{,local/}{include,src}
mkdir -pv /usr/lib/locale
mkdir -pv /usr/local/{bin,lib,sbin}
mkdir -pv /usr/{,local/}share/{color,dict,doc,info,locale,man}
mkdir -pv /usr/{,local/}share/{misc,terminfo,zoneinfo}
mkdir -pv /usr/{,local/}share/man/man{1..8}
mkdir -pv /var/{cache,local,log,mail,opt,spool}
mkdir -pv /var/lib/{color,misc,locate}

ln -sfv /run /var/run
ln -sfv /run/lock /var/lock

install -dv -m 0750 /root
install -dv -m 1777 /tmp /var/tmp
```

> **Side note:** `/tmp` and `/var/tmp` get mode `1777` (anyone can write, only owners can delete), and `/root` gets `0750` (private to root). The symlinks point `/var/run` and `/var/lock` to `/run`, which is a temporary filesystem.

### 6.5 Create essential files and users

Create the mounted-filesystems link:

```bash
ln -sv /proc/self/mounts /etc/mtab
```

Create a basic `/etc/hosts`:

```bash
cat > /etc/hosts << EOF
127.0.0.1  localhost $(hostname)
::1        localhost
EOF
```

Create the user list, including the system accounts that systemd needs:

```bash
cat > /etc/passwd << "EOF"
root:x:0:0:root:/root:/bin/bash
bin:x:1:1:bin:/dev/null:/usr/bin/false
daemon:x:6:6:Daemon User:/dev/null:/usr/bin/false
messagebus:x:18:18:D-Bus Message Daemon User:/run/dbus:/usr/bin/false
systemd-journal-gateway:x:73:73:systemd Journal Gateway:/:/usr/bin/false
systemd-journal-remote:x:74:74:systemd Journal Remote:/:/usr/bin/false
systemd-journal-upload:x:75:75:systemd Journal Upload:/:/usr/bin/false
systemd-network:x:76:76:systemd Network Management:/:/usr/bin/false
systemd-resolve:x:77:77:systemd Resolver:/:/usr/bin/false
systemd-timesync:x:78:78:systemd Time Synchronization:/:/usr/bin/false
systemd-coredump:x:79:79:systemd Core Dumper:/:/usr/bin/false
uuidd:x:80:80:UUID Generation Daemon User:/dev/null:/usr/bin/false
systemd-oom:x:81:81:systemd Out Of Memory Daemon:/:/usr/bin/false
nobody:x:65534:65534:Unprivileged User:/dev/null:/usr/bin/false
EOF
```

Create the group list:

```bash
cat > /etc/group << "EOF"
root:x:0:
bin:x:1:daemon
sys:x:2:
kmem:x:3:
tape:x:4:
tty:x:5:
daemon:x:6:
floppy:x:7:
disk:x:8:
lp:x:9:
dialout:x:10:
audio:x:11:
video:x:12:
utmp:x:13:
clock:x:14:
cdrom:x:15:
adm:x:16:
messagebus:x:18:
systemd-journal:x:23:
input:x:24:
mail:x:34:
kvm:x:61:
systemd-journal-gateway:x:73:
systemd-journal-remote:x:74:
systemd-journal-upload:x:75:
systemd-network:x:76:
systemd-resolve:x:77:
systemd-timesync:x:78:
systemd-coredump:x:79:
uuidd:x:80:
systemd-oom:x:81:
wheel:x:97:
users:x:999:
nogroup:x:65534:
EOF
```

Add a temporary unprivileged `tester` user. Some test suites refuse to run as root. You'll delete this user at the end of Phase 7.

```bash
echo "tester:x:101:101::/home/tester:/bin/bash" >> /etc/passwd
echo "tester:x:101:" >> /etc/group
install -o tester -d /home/tester
```

Start a new shell so the prompt picks up the new user name ("I have no name!" goes away):

```bash
exec /usr/bin/bash --login
```

Create log files that `login`, `agetty` and `init` expect:

```bash
touch /var/log/{btmp,lastlog,faillog,wtmp}
chgrp -v utmp /var/log/lastlog
chmod -v 664  /var/log/lastlog
chmod -v 600  /var/log/btmp
```

> **Checkpoint:** The prompt should now read `(lfs chroot) root:/#`.

### 6.6 Build the additional temporary tools

Use the same package routine as before, but inside the chroot the sources are at `/sources`.

### Gettext-1.0

*Book §7.7* · *Package:* `gettext-1.0.tar.xz` · *Build time:* 1.5 SBU · *Disk space:* 531 MB

**What it is:** Internationalization tools (translated program messages).

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf gettext-1.0.tar.xz
cd gettext-1.0
```

Build and install. Run each block in order:

```bash
./configure --disable-shared
```

```bash
make
```

```bash
cp -v gettext-tools/src/{msgfmt,msgmerge,xgettext} /usr/bin
```

Clean up:

```bash
cd /sources
rm -rf gettext-1.0
```

> **Side note:** Only three programs are copied in right now. The full Gettext comes in Chapter 8.

### Bison-3.8.2

*Book §7.8* · *Package:* `bison-3.8.2.tar.xz` · *Build time:* 0.2 SBU · *Disk space:* 58 MB

**What it is:** A parser generator (the GNU version of `yacc`).

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf bison-3.8.2.tar.xz
cd bison-3.8.2
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr \
            --docdir=/usr/share/doc/bison-3.8.2
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf bison-3.8.2
```

### Perl-5.44.0

*Book §7.9* · *Package:* `perl-5.44.0.tar.xz` · *Build time:* 0.6 SBU · *Disk space:* 301 MB

**What it is:** The Perl programming language, which many build and test scripts use.

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf perl-5.44.0.tar.xz
cd perl-5.44.0
```

Build and install. Run each block in order:

```bash
sh Configure -des                                         \
             -D prefix=/usr                               \
             -D vendorprefix=/usr                         \
             -D useshrplib                                \
             -D privlib=/usr/lib/perl5/5.44/core_perl     \
             -D archlib=/usr/lib/perl5/5.44/core_perl     \
             -D sitelib=/usr/lib/perl5/5.44/site_perl     \
             -D sitearch=/usr/lib/perl5/5.44/site_perl    \
             -D vendorlib=/usr/lib/perl5/5.44/vendor_perl \
             -D vendorarch=/usr/lib/perl5/5.44/vendor_perl
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf perl-5.44.0
```

### Zlib-1.3.2

*Book §7.10* · *Package:* `zlib-1.3.2.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 5.7 MB

**What it is:** The zlib compression library.

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf zlib-1.3.2.tar.gz
cd zlib-1.3.2
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

```bash
make install
```

```bash
rm -fv /usr/lib/libz.a
```

Clean up:

```bash
cd /sources
rm -rf zlib-1.3.2
```

### mpdecimal-4.0.1

*Book §7.11* · *Package:* `mpdecimal-4.0.1.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 3.3 MB

**What it is:** A decimal-math library that Python needs.

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf mpdecimal-4.0.1.tar.gz
cd mpdecimal-4.0.1
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/mpdecimal-4.0.1
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf mpdecimal-4.0.1
```

### Python-3.14.7

*Book §7.12* · *Package:* `Python-3.14.7.tar.xz` · *Build time:* 0.5 SBU · *Disk space:* 603 MB

**What it is:** The Python 3 interpreter, needed to build several later packages.

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf Python-3.14.7.tar.xz
cd Python-3.14.7
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr       \
            --enable-shared     \
            --without-ensurepip \
            --without-static-libpython
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf Python-3.14.7
```

> **Side note:** A few optional Python modules fail to build at this stage (for example, SSL). That's expected, because their libraries don't exist yet. Python is rebuilt properly in Chapter 8.

### Texinfo-7.3

*Book §7.13* · *Package:* `texinfo-7.3.tar.xz` · *Build time:* 0.2 SBU · *Disk space:* 147 MB

**What it is:** Tools for reading and writing GNU "info" documentation.

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf texinfo-7.3.tar.xz
cd texinfo-7.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf texinfo-7.3
```

### Util-linux-2.42.2

*Book §7.14* · *Package:* `util-linux-2.42.2.tar.xz` · *Build time:* 0.2 SBU · *Disk space:* 211 MB

**What it is:** A large set of system utilities (`mount`, `fdisk`, `lsblk`, and more).

**Why now:** Built inside the chroot. Several later packages need it to build.

Unpack the package:

```bash
cd /sources
tar -xf util-linux-2.42.2.tar.xz
cd util-linux-2.42.2
```

Build and install. Run each block in order:

```bash
mkdir -pv /var/lib/hwclock
```

```bash
./configure --libdir=/usr/lib     \
            --runstatedir=/run    \
            --disable-chfn-chsh   \
            --disable-login       \
            --disable-nologin     \
            --disable-su          \
            --disable-setpriv     \
            --disable-runuser     \
            --disable-pylibmount  \
            --disable-static      \
            --disable-liblastlog2 \
            --without-python      \
            ADJTIME_PATH=/var/lib/hwclock/adjtime \
            --docdir=/usr/share/doc/util-linux-2.42.2
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf util-linux-2.42.2
```


### 6.7 Clean up and make a backup

Remove documentation and libtool files you don't need:

```bash
rm -rf /usr/share/{info,man,doc}/*
```

```bash
find /usr/{lib,libexec} -name \*.la -delete
```

Remove the cross-toolchain, which is no longer needed:

```bash
rm -rf /tools
```

> **Pro tip:** **Make a backup now.** Everything up to this point takes hours, and Phase 7 changes the system in ways that are hard to undo. A backup lets you start over from here in minutes. (In WSL, a copy of the whole image works too: with the image unmounted, `cp --sparse=always /root/lfs-disk.img /root/lfs-disk-backup.img`.)

To make a backup, leave the chroot:

```bash
exit
```

On the host, as root, check that `LFS` is set and unmount the virtual filesystems:

```bash
mountpoint -q $LFS/dev/shm && umount $LFS/dev/shm
umount $LFS/dev/pts
umount $LFS/{sys,proc,run,dev}
```

Create the backup archive (about 1 GB; make sure you have space in `$HOME`):

```bash
cd $LFS
tar -cJpf $HOME/lfs-temp-tools-13.1-systemd.tar.xz .
```

> **Side note:** If you ever need to **restore** this backup, run the following as root with `LFS` set. **Double-check `echo $LFS` first**, because `rm -rf ./*` deletes everything in the current directory:
> `cd $LFS && rm -rf ./* && tar -xpf $HOME/lfs-temp-tools-13.1-systemd.tar.xz`

**Before continuing:** remount the virtual filesystems (step 6.2) and re-enter the chroot (step 6.3). Appendix A has a script that does both.

---

## Phase 7 — Build the Final LFS System (Book Chapter 8)

This is the longest phase: about 80 packages, each built "for real" and, where it makes sense, tested. You're inside the chroot as root, and the sources are in `/sources`.

> **Side note:** *Package management.* LFS doesn't include a package manager, so `make install` puts files directly into the system. That's fine for learning. Phase 11 explains how to add package management when you turn LFS into a distribution.

> **Side note:** *Test suites.* Test commands in this phase are labeled. The tests for **Glibc, Binutils, GCC, GMP and MPFR** are the most important. Most other tests are optional, and skipping them saves time. A few failures are often normal. Compare them with the official logs at https://www.linuxfromscratch.org/lfs/build-logs/13.1/ before you worry.

> **Warning:** Don't use extra compiler optimization flags (`CFLAGS`) for this build. If one package gets miscompiled, the problem can quietly spread to everything built after it.

### Man-pages-6.18

*Book §8.3* · *Package:* `man-pages-6.18.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 54 MB

**What it is:** Several thousand manual pages that describe Linux system calls and C library functions.

Unpack the package:

```bash
cd /sources
tar -xf man-pages-6.18.tar.xz
cd man-pages-6.18
```

Build and install. Run each block in order:

```bash
rm -v man3/crypt*
```

```bash
make -R GIT=false prefix=/usr install
```

Clean up:

```bash
cd /sources
rm -rf man-pages-6.18
```

> **Side note:** The `crypt` man pages are removed because Libxcrypt installs better ones later.

### Iana-Etc-20260805

*Book §8.4* · *Package:* `iana-etc-20260805.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 4.8 MB

**What it is:** The `/etc/services` and `/etc/protocols` files, which map network service names to port numbers.

Unpack the package:

```bash
cd /sources
tar -xf iana-etc-20260805.tar.gz
cd iana-etc-20260805
```

Build and install. Run each block in order:

```bash
cp -v services protocols /etc
```

Clean up:

```bash
cd /sources
rm -rf iana-etc-20260805
```

> **Side note:** There is nothing to compile. You only copy two data files.

### Glibc-2.44

*Book §8.5* · *Package:* `glibc-2.44.tar.xz` · *Build time:* 11 SBU · *Disk space:* 3.7 GB

**What it is:** The final GNU C Library, the most important library on the system.

> **Warning:** This is one of the "big three" (Binutils, GCC, Glibc). Run its test suite. A broken C library means a broken system.

Unpack the package:

```bash
cd /sources
tar -xf glibc-2.44.tar.xz
cd glibc-2.44
```

Build and install. Run each block in order:

```bash
patch -Np1 -i ../glibc-fhs-1.patch
```

```bash
patch -Np1 -i ../glibc-2.44-upstream_fixes-1.patch
```

```bash
mkdir -v build
cd       build
```

```bash
../configure --prefix=/usr                   \
             --disable-werror                \
             --disable-nscd                  \
             libc_cv_slibdir=/usr/lib        \
             --enable-stack-protector=strong \
             --enable-kernel=5.10
```

```bash
make
```

Test suite (critical, do not skip):

```bash
make check
```

```bash
grep "Timed out" $(find -name \*.out)
```

Continue with the installation:

```bash
touch /etc/ld.so.conf
```

```bash
sed '/test-installation/s@$(PERL)@echo not running@' -i ../Makefile
```

```bash
make install
```

```bash
sed '/RTLDLIST=/s@/usr@@g' -i /usr/bin/ldd
```

Option A — install the recommended set of locales (quick, and enough for the test suites):

```bash
localedef -i C -f UTF-8 C.UTF-8
localedef -i cs_CZ -f UTF-8 cs_CZ.UTF-8
localedef -i de_DE -f ISO-8859-1 de_DE
localedef -i de_DE@euro -f ISO-8859-15 de_DE@euro
localedef -i de_DE -f UTF-8 de_DE.UTF-8
localedef -i el_GR -f ISO-8859-7 el_GR
localedef -i en_GB -f ISO-8859-1 en_GB
localedef -i en_GB -f UTF-8 en_GB.UTF-8
localedef -i en_HK -f ISO-8859-1 en_HK
localedef -i en_PH -f ISO-8859-1 en_PH
localedef -i en_US -f ISO-8859-1 en_US
localedef -i en_US -f UTF-8 en_US.UTF-8
localedef -i es_ES -f ISO-8859-15 es_ES@euro
localedef -i es_MX -f ISO-8859-1 es_MX
localedef -i fa_IR -f UTF-8 fa_IR
localedef -i fr_FR -f ISO-8859-1 fr_FR
localedef -i fr_FR@euro -f ISO-8859-15 fr_FR@euro
localedef -i fr_FR -f UTF-8 fr_FR.UTF-8
localedef -i is_IS -f ISO-8859-1 is_IS
localedef -i is_IS -f UTF-8 is_IS.UTF-8
localedef -i it_IT -f ISO-8859-1 it_IT
localedef -i it_IT -f ISO-8859-15 it_IT@euro
localedef -i it_IT -f UTF-8 it_IT.UTF-8
localedef -i ja_JP -f EUC-JP ja_JP
localedef -i ja_JP -f UTF-8 ja_JP.UTF-8
localedef -i nl_NL@euro -f ISO-8859-15 nl_NL@euro
localedef -i ru_RU -f KOI8-R ru_RU.KOI8-R
localedef -i ru_RU -f UTF-8 ru_RU.UTF-8
localedef -i se_NO -f UTF-8 se_NO.UTF-8
localedef -i ta_IN -f UTF-8 ta_IN.UTF-8
localedef -i tr_TR -f UTF-8 tr_TR.UTF-8
localedef -i zh_CN -f GB18030 zh_CN.GB18030
localedef -i zh_HK -f BIG5-HKSCS zh_HK.BIG5-HKSCS
localedef -i zh_TW -f UTF-8 zh_TW.UTF-8
```

Option B — install every supported locale instead (slow). Choose A **or** B:

```bash
make localedata/install-locales
```

Then continue:

```bash
cat > /etc/nsswitch.conf << "EOF"
# Begin /etc/nsswitch.conf

passwd: files systemd
group: files systemd
shadow: files systemd

hosts: mymachines resolve [!UNAVAIL=return] files myhostname dns
networks: files

protocols: files
services: files
ethers: files
rpc: files

# End /etc/nsswitch.conf
EOF
```

```bash
tar -xf ../../tzdata2026c.tar.gz

ZONEINFO=/usr/share/zoneinfo
mkdir -pv $ZONEINFO/{posix,right}

for tz in etcetera southamerica northamerica europe africa antarctica  \
          asia australasia backward; do
    zic -L /dev/null   -d $ZONEINFO       ${tz}
    zic -L /dev/null   -d $ZONEINFO/posix ${tz}
    zic -L leapseconds -d $ZONEINFO/right ${tz}
done

cp -v zone.tab zone1970.tab iso3166.tab $ZONEINFO
zic -d $ZONEINFO -p America/New_York
unset ZONEINFO tz
```

Helper (interactive): find the correct name for your time zone:

```bash
tzselect
```

Set the local time zone. Replace `<xxx>` with your zone, for example `America/New_York`:

```bash
ln -sfv /usr/share/zoneinfo/<xxx> /etc/localtime
```

Then continue:

```bash
cat > /etc/ld.so.conf << "EOF"
# Begin /etc/ld.so.conf
/usr/local/lib
/opt/lib

EOF
```

Optional: allow extra library-path files in `/etc/ld.so.conf.d`:

```bash
cat >> /etc/ld.so.conf << "EOF"
# Add an include directory
include /etc/ld.so.conf.d/*.conf

EOF
mkdir -pv /etc/ld.so.conf.d
```

Clean up:

```bash
cd /sources
rm -rf glibc-2.44
```

> **Side note:** The book also contains extra commands for *upgrading* Glibc on an already-running LFS system. On a first build they don't apply, so this guide leaves them out.

> **Side note:** A handful of Glibc tests are known to fail (for example, some timing-sensitive tests). Compare any failures with the official build logs at https://www.linuxfromscratch.org/lfs/build-logs/13.1/ before you worry.

> **Pro tip:** Also install the locale you actually use. For US English this is already covered by `en_US.UTF-8`.

### Zlib-1.3.2

*Book §8.6* · *Package:* `zlib-1.3.2.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 5.4 MB

**What it is:** The zlib compression library (final version).

Unpack the package:

```bash
cd /sources
tar -xf zlib-1.3.2.tar.gz
cd zlib-1.3.2
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
rm -fv /usr/lib/libz.a
```

Clean up:

```bash
cd /sources
rm -rf zlib-1.3.2
```

### Bzip2-1.0.8

*Book §8.7* · *Package:* `bzip2-1.0.8.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 7.3 MB

**What it is:** The bzip2 compressor and its library.

Unpack the package:

```bash
cd /sources
tar -xf bzip2-1.0.8.tar.gz
cd bzip2-1.0.8
```

Build and install. Run each block in order:

```bash
patch -Np1 -i ../bzip2-1.0.8-install_docs-1.patch
```

```bash
sed -i 's@\(ln -s -f \)$(PREFIX)/bin/@\1@' Makefile
```

```bash
sed -i "s@(PREFIX)/man@(PREFIX)/share/man@g" Makefile
```

```bash
make -f Makefile-libbz2_so
make clean
```

```bash
make
```

```bash
make PREFIX=/usr install
```

```bash
cp -av libbz2.so.* /usr/lib
ln -sfv libbz2.so.1.0.8 /usr/lib/libbz2.so
```

```bash
ln -sfv libbz2.so.1.0.8 /usr/lib/libbz2.so.1
```

```bash
cp -v bzip2-shared /usr/bin/bzip2
for i in /usr/bin/{bzcat,bunzip2}; do
  ln -sfv bzip2 $i
done
```

```bash
rm -fv /usr/lib/libbz2.a
```

Clean up:

```bash
cd /sources
rm -rf bzip2-1.0.8
```

### Xz-5.8.3

*Book §8.8* · *Package:* `xz-5.8.3.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 25 MB

**What it is:** XZ compression tools and `liblzma` (final version).

Unpack the package:

```bash
cd /sources
tar -xf xz-5.8.3.tar.xz
cd xz-5.8.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/xz-5.8.3
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf xz-5.8.3
```

### Lz4-1.10.0

*Book §8.9* · *Package:* `lz4-1.10.0.tar.gz` · *Build time:* 0.1 SBU · *Disk space:* 4.2 MB

**What it is:** LZ4, a very fast compression library.

Unpack the package:

```bash
cd /sources
tar -xf lz4-1.10.0.tar.gz
cd lz4-1.10.0
```

Build and install. Run each block in order:

```bash
make BUILD_STATIC=no PREFIX=/usr
```

Test suite (recommended, but optional):

```bash
make -j1 check
```

Continue with the installation:

```bash
make BUILD_STATIC=no PREFIX=/usr install
```

Clean up:

```bash
cd /sources
rm -rf lz4-1.10.0
```

### Zstd-1.5.7

*Book §8.10* · *Package:* `zstd-1.5.7.tar.gz` · *Build time:* 0.4 SBU · *Disk space:* 88 MB

**What it is:** Zstandard, a fast, high-ratio compression library.

Unpack the package:

```bash
cd /sources
tar -xf zstd-1.5.7.tar.gz
cd zstd-1.5.7
```

Build and install. Run each block in order:

```bash
make prefix=/usr
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make prefix=/usr install
```

```bash
rm -v /usr/lib/libzstd.a
```

Clean up:

```bash
cd /sources
rm -rf zstd-1.5.7
```

### File-5.48

*Book §8.11* · *Package:* `file-5.48.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 21 MB

**What it is:** The `file` command (final version).

Unpack the package:

```bash
cd /sources
tar -xf file-5.48.tar.gz
cd file-5.48
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf file-5.48
```

### Readline-8.3

*Book §8.12* · *Package:* `readline-8.3.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 17 MB

**What it is:** The library that gives Bash (and other programs) command-line editing and history.

Unpack the package:

```bash
cd /sources
tar -xf readline-8.3.tar.gz
cd readline-8.3
```

Build and install. Run each block in order:

```bash
sed -i '/MV.*old/d' Makefile.in
sed -i '/{OLDSUFF}/c:' support/shlib-install
```

```bash
sed -i 's/-Wl,-rpath,[^ ]*//' support/shobj-conf
```

```bash
sed -e '270a\
     else\
       chars_avail = 1;'      \
    -e '288i\   result = -1;' \
    -i.orig input.c
```

```bash
./configure --prefix=/usr    \
            --disable-static \
            --with-curses    \
            --docdir=/usr/share/doc/readline-8.3
```

```bash
make SHLIB_LIBS="-lncursesw"
```

```bash
make install
```

```bash
install -v -m644 doc/*.{ps,pdf,html,dvi} /usr/share/doc/readline-8.3
```

Clean up:

```bash
cd /sources
rm -rf readline-8.3
```

### Pcre2-10.47

*Book §8.13* · *Package:* `pcre2-10.47.tar.bz2` · *Build time:* 0.2 SBU · *Disk space:* 28 MB

**What it is:** Perl-compatible regular expression library.

Unpack the package:

```bash
cd /sources
tar -xf pcre2-10.47.tar.bz2
cd pcre2-10.47
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr                       \
            --docdir=/usr/share/doc/pcre2-10.47 \
            --enable-unicode                    \
            --enable-jit                        \
            --enable-pcre2-16                   \
            --enable-pcre2-32                   \
            --enable-pcre2grep-libz             \
            --enable-pcre2grep-libbz2           \
            --enable-pcre2test-libreadline      \
            --disable-static
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf pcre2-10.47
```

### M4-1.4.21

*Book §8.14* · *Package:* `m4-1.4.21.tar.xz` · *Build time:* 0.4 SBU · *Disk space:* 62 MB

**What it is:** The M4 macro processor (final version).

Unpack the package:

```bash
cd /sources
tar -xf m4-1.4.21.tar.xz
cd m4-1.4.21
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf m4-1.4.21
```

### Bc-7.0.3

*Book §8.15* · *Package:* `bc-7.0.3.tar.xz` · *Build time:* less than 0.1 SBU · *Disk space:* 7.8 MB

**What it is:** An arbitrary-precision calculator. The kernel build requires it.

Unpack the package:

```bash
cd /sources
tar -xf bc-7.0.3.tar.xz
cd bc-7.0.3
```

Build and install. Run each block in order:

```bash
CC='gcc -std=c99' ./configure --prefix=/usr -G -O3 -r
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make test
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf bc-7.0.3
```

### Flex-2.6.4

*Book §8.16* · *Package:* `flex-2.6.4.tar.gz` · *Build time:* 0.1 SBU · *Disk space:* 33 MB

**What it is:** A tool that generates programs that recognize text patterns (a "lexer").

Unpack the package:

```bash
cd /sources
tar -xf flex-2.6.4.tar.gz
cd flex-2.6.4
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/flex-2.6.4
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
ln -sv flex   /usr/bin/lex
ln -sv flex.1 /usr/share/man/man1/lex.1
```

Clean up:

```bash
cd /sources
rm -rf flex-2.6.4
```

### Tcl-8.6.18

*Book §8.17* · *Package:* `tcl8.6.18-src.tar.gz` · *Build time:* 2.9 SBU · *Disk space:* 92 MB

**What it is:** The Tcl scripting language, needed to run several test suites.

Unpack the package:

```bash
cd /sources
tar -xf tcl8.6.18-src.tar.gz
cd tcl8.6.18
```

Build and install. Run each block in order:

```bash
SRCDIR=$(pwd)
cd unix
./configure --prefix=/usr           \
            --mandir=/usr/share/man \
            --disable-rpath
```

```bash
make

sed -e "s|$SRCDIR/unix|/usr/lib|" \
    -e "s|$SRCDIR|/usr/include|"  \
    -i tclConfig.sh

sed -e "s|$SRCDIR/unix/pkgs/tdbc1.1.13|/usr/lib/tdbc1.1.13|" \
    -e "s|$SRCDIR/pkgs/tdbc1.1.13/generic|/usr/include|"     \
    -e "s|$SRCDIR/pkgs/tdbc1.1.13/library|/usr/lib/tcl8.6|"  \
    -e "s|$SRCDIR/pkgs/tdbc1.1.13|/usr/include|"             \
    -i pkgs/tdbc1.1.13/tdbcConfig.sh

sed -e "s|$SRCDIR/unix/pkgs/itcl4.3.7|/usr/lib/itcl4.3.7|" \
    -e "s|$SRCDIR/pkgs/itcl4.3.7/generic|/usr/include|"    \
    -e "s|$SRCDIR/pkgs/itcl4.3.7|/usr/include|"            \
    -i pkgs/itcl4.3.7/itclConfig.sh

unset SRCDIR
```

Test suite (recommended, but optional):

```bash
LC_ALL=C.UTF-8 make test
```

Continue with the installation:

```bash
make install 
chmod 644 /usr/lib/libtclstub8.6.a
```

```bash
chmod -v u+w /usr/lib/libtcl8.6.so
```

```bash
make install-private-headers
```

```bash
ln -sfv tclsh8.6 /usr/bin/tclsh
```

```bash
mv -v /usr/share/man/man3/{Thread,Tcl_Thread}.3
```

```bash
cd ..
tar -xf ../tcl8.6.18-html.tar.gz --strip-components=1
mkdir -v -p /usr/share/doc/tcl-8.6.18
cp -v -r  ./html/* /usr/share/doc/tcl-8.6.18
```

Clean up:

```bash
cd /sources
rm -rf tcl8.6.18
```

### Expect-5.45.4

*Book §8.18* · *Package:* `expect5.45.4.tar.gz` · *Build time:* 0.2 SBU · *Disk space:* 3.9 MB

**What it is:** A tool that scripts interactive programs. Test suites depend on it.

> **Checkpoint:** The first command verifies that pseudo-terminals (PTYs) work inside the chroot. It **must** print `ok`. If it doesn't, the virtual filesystems aren't mounted correctly (see Appendix A), and the Binutils/GCC tests will fail.

Unpack the package:

```bash
cd /sources
tar -xf expect5.45.4.tar.gz
cd expect5.45.4
```

Build and install. Run each block in order:

Required check: confirm pseudo-terminals work in the chroot (must print `ok`):

```bash
python3 -c 'from pty import spawn; spawn(["echo", "ok"])'
```

Then continue:

```bash
patch -Np1 -i ../expect-5.45.4-gcc15-1.patch
```

```bash
./configure --prefix=/usr           \
            --with-tcl=/usr/lib     \
            --enable-shared         \
            --disable-rpath         \
            --mandir=/usr/share/man \
            --with-tclinclude=/usr/include
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make test
```

Continue with the installation:

```bash
make install
ln -svf expect5.45.4/libexpect5.45.4.so /usr/lib
```

Clean up:

```bash
cd /sources
rm -rf expect5.45.4
```

### DejaGNU-1.6.3

*Book §8.19* · *Package:* `dejagnu-1.6.3.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 7.4 MB

**What it is:** A test framework used by GCC and Binutils.

Unpack the package:

```bash
cd /sources
tar -xf dejagnu-1.6.3.tar.gz
cd dejagnu-1.6.3
```

Build and install. Run each block in order:

```bash
mkdir -v build
cd       build
```

```bash
../configure --prefix=/usr
makeinfo --html --no-split -o doc/dejagnu.html ../doc/dejagnu.texi
makeinfo --plaintext       -o doc/dejagnu.txt  ../doc/dejagnu.texi
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
install -v -dm755  /usr/share/doc/dejagnu-1.6.3
install -v -m644   doc/dejagnu.{html,txt} /usr/share/doc/dejagnu-1.6.3
```

Clean up:

```bash
cd /sources
rm -rf dejagnu-1.6.3
```

### Ninja-1.13.2

*Book §8.20* · *Package:* `ninja-1.13.2.tar.gz` · *Build time:* 0.2 SBU · *Disk space:* 43 MB

**What it is:** A small, fast build system that Meson uses.

Unpack the package:

```bash
cd /sources
tar -xf ninja-1.13.2.tar.gz
cd ninja-1.13.2
```

Build and install. Run each block in order:

Optional: limit Ninja's parallel jobs (only if your machine runs out of memory):

```text
export NINJAJOBS=4
```

```bash
sed -i '/int Guess/a \
  int   j = 0;\
  char* jobs = getenv( "NINJAJOBS" );\
  if ( jobs != NULL ) j = atoi( jobs );\
  if ( j > 0 ) return j;\
' src/ninja.cc
```

```bash
python3 configure.py --bootstrap --verbose
```

```bash
install -vm755 ninja /usr/bin/
install -vDm644 misc/bash-completion /usr/share/bash-completion/completions/ninja
install -vDm644 misc/zsh-completion  /usr/share/zsh/site-functions/_ninja
```

Clean up:

```bash
cd /sources
rm -rf ninja-1.13.2
```

### Pkgconf-3.0.5

*Book §8.21* · *Package:* `pkgconf-3.0.5.tar.xz` · *Build time:* less than 0.1 SBU · *Disk space:* 47 MB

**What it is:** Tells build systems which compiler and linker flags a library needs (a drop-in for `pkg-config`).

Unpack the package:

```bash
cd /sources
tar -xf pkgconf-3.0.5.tar.xz
cd pkgconf-3.0.5
```

Build and install. Run each block in order:

```bash
tar -xf ../meson-1.12.0.tar.gz
```

```bash
mkdir build
cd    build

python3 ../meson-1.12.0/meson.py setup --prefix=/usr --buildtype=release ..
```

```bash
ninja
```

Test suite (recommended, but optional):

```bash
ninja test
```

Continue with the installation:

```bash
ninja install
mv /usr/share/doc/pkgconf{,-3.0.5}
```

```bash
ln -sv pkgconf   /usr/bin/pkg-config
ln -sv pkgconf.1 /usr/share/man/man1/pkg-config.1
```

Clean up:

```bash
cd /sources
rm -rf pkgconf-3.0.5
```

### Binutils-2.47

*Book §8.22* · *Package:* `binutils-2.47.tar.xz` · *Build time:* 1.7 SBU · *Disk space:* 817 MB

**What it is:** Final Binutils (linker, assembler, and object tools).

> **Warning:** One of the "big three". Run the test suite. The `grep '^FAIL:'` command lists any failures; compare them with the official build logs.

Unpack the package:

```bash
cd /sources
tar -xf binutils-2.47.tar.xz
cd binutils-2.47
```

Build and install. Run each block in order:

```bash
mkdir -v build
cd       build
```

```bash
../configure --prefix=/usr       \
             --sysconfdir=/etc   \
             --enable-ld=default \
             --enable-plugins    \
             --enable-shared     \
             --disable-werror    \
             --enable-64-bit-bfd \
             --enable-new-dtags  \
             --with-system-zlib  \
             --with-lib-path=/usr/lib \
             --enable-default-hash-style=gnu
```

```bash
make tooldir=/usr
```

Test suite (critical, do not skip):

```bash
make -k check
```

```bash
grep '^FAIL:' $(find -name '*.log')
```

Continue with the installation:

```bash
make tooldir=/usr install
```

```bash
rm -rfv /usr/lib/lib{bfd,ctf,ctf-nobfd,gprofng,opcodes,sframe}.a \
        /usr/share/doc/gprofng/
```

Clean up:

```bash
cd /sources
rm -rf binutils-2.47
```

### GMP-6.3.0

*Book §8.23* · *Package:* `gmp-6.3.0.tar.xz` · *Build time:* 0.3 SBU · *Disk space:* 54 MB

**What it is:** The GNU multiple-precision math library (a GCC dependency).

Unpack the package:

```bash
cd /sources
tar -xf gmp-6.3.0.tar.xz
cd gmp-6.3.0
```

Build and install. Run each block in order:

```bash
sed -i '/long long t1;/,+1s/()/(...)/' configure
```

```bash
./configure --prefix=/usr    \
            --enable-cxx     \
            --disable-static \
            --docdir=/usr/share/doc/gmp-6.3.0
```

```bash
make
make html
```

Test suite (critical, do not skip):

```bash
make check
```

```bash
cat $(find -name '*.log') | grep -c ^PASS
```

Continue with the installation:

```bash
make install
make install-html
```

Clean up:

```bash
cd /sources
rm -rf gmp-6.3.0
```

> **Warning:** Do **not** skip the `make check` step for GMP. The `grep -c ^PASS` command counts passed tests; the number should match the total in the book's build logs, and no test may fail. A failure here can mean the library was built for the wrong CPU.

> **Pro tip:** GMP optimizes itself for *your* CPU. If you plan to distribute this system to other machines, read the book's note about adding `--host=none-linux-gnu` for generic libraries.

### MPFR-4.2.2

*Book §8.24* · *Package:* `mpfr-4.2.2.tar.xz` · *Build time:* 0.2 SBU · *Disk space:* 44 MB

**What it is:** Multiple-precision floating-point math library (a GCC dependency).

Unpack the package:

```bash
cd /sources
tar -xf mpfr-4.2.2.tar.xz
cd mpfr-4.2.2
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr        \
            --disable-static     \
            --enable-thread-safe \
            --docdir=/usr/share/doc/mpfr-4.2.2
```

```bash
make
make html
```

Test suite (critical, do not skip):

```bash
make check
```

Continue with the installation:

```bash
make install
make install-html
```

Clean up:

```bash
cd /sources
rm -rf mpfr-4.2.2
```

> **Warning:** The MPFR test suite is considered critical. Do not skip it.

### MPC-1.4.1

*Book §8.25* · *Package:* `mpc-1.4.1.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 23 MB

**What it is:** Complex-number math library (a GCC dependency).

Unpack the package:

```bash
cd /sources
tar -xf mpc-1.4.1.tar.xz
cd mpc-1.4.1
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/mpc-1.4.1
```

```bash
make
make html
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
make install-html
```

Clean up:

```bash
cd /sources
rm -rf mpc-1.4.1
```

### Attr-2.6.0

*Book §8.26* · *Package:* `attr-2.6.0.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 4.5 MB

**What it is:** Tools for extended file attributes.

Unpack the package:

```bash
cd /sources
tar -xf attr-2.6.0.tar.gz
cd attr-2.6.0
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr     \
            --disable-static  \
            --sysconfdir=/etc \
            --docdir=/usr/share/doc/attr-2.6.0
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf attr-2.6.0
```

### Acl-2.4.0

*Book §8.27* · *Package:* `acl-2.4.0.tar.xz` · *Build time:* less than 0.1 SBU · *Disk space:* 7.1 MB

**What it is:** Tools for Access Control Lists (fine-grained file permissions).

Unpack the package:

```bash
cd /sources
tar -xf acl-2.4.0.tar.xz
cd acl-2.4.0
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/acl-2.4.0
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf acl-2.4.0
```

### Libcap-2.78

*Book §8.28* · *Package:* `libcap-2.78.tar.xz` · *Build time:* less than 0.1 SBU · *Disk space:* 3.1 MB

**What it is:** POSIX capabilities: lets programs have *some* root powers without being fully root.

Unpack the package:

```bash
cd /sources
tar -xf libcap-2.78.tar.xz
cd libcap-2.78
```

Build and install. Run each block in order:

```bash
sed -i '/install -m.*STA/d' libcap/Makefile
```

```bash
make prefix=/usr lib=lib
```

Test suite (recommended, but optional):

```bash
make test
```

Continue with the installation:

```bash
make prefix=/usr lib=lib install
```

Clean up:

```bash
cd /sources
rm -rf libcap-2.78
```

### Libxcrypt-4.5.2

*Book §8.29* · *Package:* `libxcrypt-4.5.2.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 14 MB

**What it is:** The library that hashes passwords (used by Shadow for `/etc/shadow`).

Unpack the package:

```bash
cd /sources
tar -xf libxcrypt-4.5.2.tar.xz
cd libxcrypt-4.5.2
```

Build and install. Run each block in order:

```bash
sed -i '/strchr/s/const//' lib/crypt-{sm3,gost}-yescrypt.c
```

```bash
./configure --prefix=/usr                \
            --enable-hashes=strong,glibc \
            --enable-obsolete-api=no     \
            --disable-static             \
            --disable-failure-tokens
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Optional — skip unless you must run old binary-only programs. Builds the legacy `libcrypt.so.1`:

```bash
make distclean
./configure --prefix=/usr                \
            --enable-hashes=strong,glibc \
            --enable-obsolete-api=glibc  \
            --disable-static             \
            --disable-failure-tokens
make
cp -av --remove-destination .libs/libcrypt.so.1* /usr/lib
```

Clean up:

```bash
cd /sources
rm -rf libxcrypt-4.5.2
```

### Shadow-4.20.2

*Book §8.30* · *Package:* `shadow-4.20.2.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 112 MB

**What it is:** Secure password handling: `passwd`, `useradd`, `login.defs`, and `/etc/shadow`.

Unpack the package:

```bash
cd /sources
tar -xf shadow-4.20.2.tar.xz
cd shadow-4.20.2
```

Build and install. Run each block in order:

```bash
find man -name Makefile.in -exec sed -i 's/getspnam\.3 / /' {} \;
find man -name Makefile.in -exec sed -i 's/passwd\.5 / /'   {} \;
```

```bash
sed -e 's:#ENCRYPT_METHOD SHA512:ENCRYPT_METHOD YESCRYPT:' \
    -e 's:/var/spool/mail:/var/mail:'                      \
    -e '/PATH=/{s@/sbin:@@;s@/bin:@@}'                     \
    -i etc/login.defs
```

```bash
touch /usr/bin/passwd
./configure --sysconfdir=/etc   \
            --disable-static    \
            --with-{b,yes}crypt \
            --without-libbsd    \
            --disable-logind    \
            --with-group-name-max-length=32
```

```bash
make
```

```bash
make exec_prefix=/usr install
make -C man install-man
```

```bash
pwconv
```

```bash
grpconv
```

```bash
mkdir -p /etc/default
useradd -D --gid 999
```

```bash
sed -i '/MAIL/s/yes/no/' /etc/default/useradd
```

```bash
touch /etc/sub{u,g}id
```

Required: set the root password. You will need it to log in on first boot:

```bash
passwd root
```

Clean up:

```bash
cd /sources
rm -rf shadow-4.20.2
```

> **Side note:** `pwconv` and `grpconv` move the password hashes out of the world-readable `/etc/passwd` into the protected `/etc/shadow`.

> **Warning:** Don't forget the root password. There is no other user account yet.

### Gawk-5.4.1

*Book §8.31* · *Package:* `gawk-5.4.1.tar.xz` · *Build time:* 0.2 SBU · *Disk space:* 47 MB

**What it is:** GNU awk text-processing language (final version).

Unpack the package:

```bash
cd /sources
tar -xf gawk-5.4.1.tar.xz
cd gawk-5.4.1
```

Build and install. Run each block in order:

```bash
sed -i 's/extras//' Makefile.in
```

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
chown -R tester .
su tester -c "PATH=$PATH make check"
```

Continue with the installation:

```bash
rm -f /usr/bin/gawk-5.4.1
make install
```

```bash
ln -sv gawk.1 /usr/share/man/man1/awk.1
```

```bash
install -vDm644 doc/{awkforai.txt,*.{eps,pdf,jpg}} -t /usr/share/doc/gawk-5.4.1
```

Clean up:

```bash
cd /sources
rm -rf gawk-5.4.1
```

### GCC-16.2.0

*Book §8.32* · *Package:* `gcc-16.2.0.tar.xz` · *Build time:* 53 SBU (with tests) · *Disk space:* 7.3 GB

**What it is:** The final GNU Compiler Collection (C and C++).

> **Warning:** The GCC test suite is very long (it can take many SBUs). It's still strongly recommended. Some failures are normal. Compare yours with the official build logs.

> **Pro tip:** Run the GCC tests inside `tmux` so a closed terminal doesn't kill hours of work.

Unpack the package:

```bash
cd /sources
tar -xf gcc-16.2.0.tar.xz
cd gcc-16.2.0
```

Build and install. Run each block in order:

```bash
case $(uname -m) in
  x86_64)
    sed -e '/m64=/s/lib64/lib/' \
        -i.orig gcc/config/i386/t-linux64
  ;;
esac
```

```bash
mkdir -v build
cd       build
```

```bash
../configure --prefix=/usr            \
             LD=ld                    \
             --enable-languages=c,c++ \
             --enable-default-pie     \
             --enable-default-ssp     \
             --enable-host-pie        \
             --enable-targets=all     \
             --disable-multilib       \
             --disable-bootstrap      \
             --disable-fixincludes    \
             --with-system-zlib
```

```bash
make
```

Test suite (critical, do not skip):

```bash
ulimit -s -H unlimited
```

```bash
chown -R tester .
su tester -c "PATH=$PATH make -k check"
```

```bash
../contrib/test_summary -t
```

Continue with the installation:

```bash
make install
```

```bash
chown -v -R root:root $(gcc -print-file-name=include){,-fixed}
```

```bash
ln -svr /usr/bin/cpp /usr/lib
```

```bash
ln -sv gcc.1 /usr/share/man/man1/cc.1
```

```bash
ln -sfvr $(gcc -print-prog-name=liblto_plugin.so) /usr/lib/bfd-plugins/
```

Test suite (critical, do not skip):

```bash
echo 'int main(){}' | cc -x c - -v -Wl,--verbose &> dummy.log
readelf -l a.out | grep ': /lib'
```

Expected output:

```text
[Requesting program interpreter: /lib64/ld-linux-x86-64.so.2]
```

```bash
grep -E -o '/usr/lib.*/S?crt[1in].*succeeded' dummy.log
```

Expected output:

```text
/usr/lib/gcc/x86_64-pc-linux-gnu/16.2.0/../../../../lib/Scrt1.o succeeded
/usr/lib/gcc/x86_64-pc-linux-gnu/16.2.0/../../../../lib/crti.o succeeded
/usr/lib/gcc/x86_64-pc-linux-gnu/16.2.0/../../../../lib/crtn.o succeeded
```

```bash
grep -B4 '^ /usr/include' dummy.log
```

Expected output:

```text
#include <...> search starts here:
 /usr/lib/gcc/x86_64-pc-linux-gnu/16.2.0/include
 /usr/local/include
 /usr/lib/gcc/x86_64-pc-linux-gnu/16.2.0/include-fixed
 /usr/include
```

```bash
grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'
```

Expected output:

```text
SEARCH_DIR("/usr/x86_64-pc-linux-gnu/lib64")
SEARCH_DIR("/usr/lib");
SEARCH_DIR("/usr/x86_64-pc-linux-gnu/lib")
```

```bash
grep "/lib.*/libc.so.6 " dummy.log
```

Expected output:

```text
attempt to open /usr/lib/libc.so.6 succeeded
```

```bash
grep found dummy.log
```

Expected output:

```text
found ld-linux-x86-64.so.2 at /usr/lib/ld-linux-x86-64.so.2
```

```bash
rm -v a.out dummy.log
```

Continue with the installation:

```bash
mkdir -pv /usr/share/gdb/auto-load/usr/lib
mv -v /usr/lib/*gdb.py /usr/share/gdb/auto-load/usr/lib
```

Clean up:

```bash
cd /sources
rm -rf gcc-16.2.0
```

> **Checkpoint:** The sanity checks after installation are just as important as in Chapter 5. Every output must match (32-bit systems show slightly different paths).

### Ncurses-6.6

*Book §8.33* · *Package:* `ncurses-6.6.tar.gz` · *Build time:* 0.2 SBU · *Disk space:* 47 MB

**What it is:** Terminal screen-handling library (final version).

Unpack the package:

```bash
cd /sources
tar -xf ncurses-6.6.tar.gz
cd ncurses-6.6
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr           \
            --mandir=/usr/share/man \
            --with-shared           \
            --without-debug         \
            --without-normal        \
            --with-cxx-shared       \
            --enable-pc-files       \
            --with-pkg-config-libdir=/usr/lib/pkgconfig
```

```bash
make
```

```bash
make DESTDIR=$PWD/dest install
sed -e 's/^#if.*XOPEN.*$/#if 1/' \
    -i dest/usr/include/curses.h
cp --remove-destination -av dest/* /
```

```bash
for lib in ncurses form panel menu ; do
    ln -sfv lib${lib}w.so /usr/lib/lib${lib}.so
    ln -sfv ${lib}w.pc    /usr/lib/pkgconfig/${lib}.pc
done
```

```bash
ln -sfv libncursesw.so /usr/lib/libcurses.so
```

```bash
cp -v -R doc -T /usr/share/doc/ncurses-6.6
```

Optional — skip unless you need old binary-only programs. Builds legacy `libncurses.so.5`:

```bash
make distclean
./configure --prefix=/usr    \
            --with-shared    \
            --without-normal \
            --without-debug  \
            --without-cxx-binding \
            --with-abi-version=5
make sources libs
cp -av lib/lib*.so.5* /usr/lib
```

Clean up:

```bash
cd /sources
rm -rf ncurses-6.6
```

### Sed-4.10

*Book §8.34* · *Package:* `sed-4.10.tar.xz` · *Build time:* 0.4 SBU · *Disk space:* 42 MB

**What it is:** The stream editor (final version).

Unpack the package:

```bash
cd /sources
tar -xf sed-4.10.tar.xz
cd sed-4.10
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
make html
```

Test suite (recommended, but optional):

```bash
chown -R tester .
su tester -c "PATH=$PATH make check"
```

Continue with the installation:

```bash
make install
install -vDm644 doc/sed.html -t /usr/share/doc/sed-4.10
```

Clean up:

```bash
cd /sources
rm -rf sed-4.10
```

### Psmisc-23.7

*Book §8.35* · *Package:* `psmisc-23.7.tar.xz` · *Build time:* less than 0.1 SBU · *Disk space:* 6.8 MB

**What it is:** Process tools such as `killall`, `fuser` and `pstree`.

Unpack the package:

```bash
cd /sources
tar -xf psmisc-23.7.tar.xz
cd psmisc-23.7
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf psmisc-23.7
```

### Gettext-1.0

*Book §8.36* · *Package:* `gettext-1.0.tar.xz` · *Build time:* 2.1 SBU · *Disk space:* 448 MB

**What it is:** Internationalization tools and libraries (final version).

Unpack the package:

```bash
cd /sources
tar -xf gettext-1.0.tar.xz
cd gettext-1.0
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/gettext-1.0
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
chmod -v 0755 /usr/lib/preloadable_libintl.so
```

Clean up:

```bash
cd /sources
rm -rf gettext-1.0
```

### Bison-3.8.2

*Book §8.37* · *Package:* `bison-3.8.2.tar.xz` · *Build time:* 2.1 SBU · *Disk space:* 63 MB

**What it is:** Parser generator (final version).

Unpack the package:

```bash
cd /sources
tar -xf bison-3.8.2.tar.xz
cd bison-3.8.2
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr --docdir=/usr/share/doc/bison-3.8.2
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf bison-3.8.2
```

### Grep-3.12

*Book §8.38* · *Package:* `grep-3.12.tar.xz` · *Build time:* 0.5 SBU · *Disk space:* 48 MB

**What it is:** Text search tool (final version).

Unpack the package:

```bash
cd /sources
tar -xf grep-3.12.tar.xz
cd grep-3.12
```

Build and install. Run each block in order:

```bash
sed -i "s/echo/#echo/" src/egrep.sh
```

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf grep-3.12
```

### Bash-5.3

*Book §8.39* · *Package:* `bash-5.3.tar.gz` · *Build time:* 1.4 SBU · *Disk space:* 56 MB

**What it is:** The Bash shell (final version).

Unpack the package:

```bash
cd /sources
tar -xf bash-5.3.tar.gz
cd bash-5.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr             \
            --without-bash-malloc     \
            --with-installed-readline \
            --docdir=/usr/share/doc/bash-5.3
```

```bash
make
```

Test suite (recommended, but optional):

```bash
chown -R tester .
```

```bash
LC_ALL=C.UTF-8 su -s /usr/bin/expect tester << "EOF"
set timeout -1
spawn make tests
expect eof
lassign [wait] _ _ _ value
exit $value
EOF
```

Continue with the installation:

```bash
make install
```

Required: replace the running shell with the brand-new Bash:

```bash
exec /usr/bin/bash --login
```

Clean up:

```bash
cd /sources
rm -rf bash-5.3
```

> **Side note:** After `exec`, your prompt keeps the `(lfs chroot)` prefix. That confirms you're still inside the chroot.

### Libtool-2.6.2

*Book §8.40* · *Package:* `libtool-2.6.2.tar.xz` · *Build time:* 0.6 SBU · *Disk space:* 50 MB

**What it is:** A helper script that hides the differences between shared-library systems.

Unpack the package:

```bash
cd /sources
tar -xf libtool-2.6.2.tar.xz
cd libtool-2.6.2
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
rm -fv /usr/lib/libltdl.a
```

Clean up:

```bash
cd /sources
rm -rf libtool-2.6.2
```

### GDBM-1.26

*Book §8.41* · *Package:* `gdbm-1.26.tar.gz` · *Build time:* 0.2 SBU · *Disk space:* 13 MB

**What it is:** A simple key/value database library (used by Man-DB).

Unpack the package:

```bash
cd /sources
tar -xf gdbm-1.26.tar.gz
cd gdbm-1.26
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --enable-libgdbm-compat
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf gdbm-1.26
```

### Gperf-3.3

*Book §8.42* · *Package:* `gperf-3.3.tar.gz` · *Build time:* 0.2 SBU · *Disk space:* 12 MB

**What it is:** Generates "perfect hash" functions (Systemd needs it).

Unpack the package:

```bash
cd /sources
tar -xf gperf-3.3.tar.gz
cd gperf-3.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr --docdir=/usr/share/doc/gperf-3.3
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf gperf-3.3
```

### Expat-2.8.3

*Book §8.43* · *Package:* `expat-2.8.3.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 12 MB

**What it is:** A small, fast XML parsing library.

Unpack the package:

```bash
cd /sources
tar -xf expat-2.8.3.tar.xz
cd expat-2.8.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/expat-2.8.3
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
install -v -m644 doc/*.{html,css} /usr/share/doc/expat-2.8.3
```

Clean up:

```bash
cd /sources
rm -rf expat-2.8.3
```

### Inetutils-2.8

*Book §8.44* · *Package:* `inetutils-2.8.tar.gz` · *Build time:* 0.3 SBU · *Disk space:* 38 MB

**What it is:** Basic networking programs such as `ping`, `hostname` and `ftp`.

Unpack the package:

```bash
cd /sources
tar -xf inetutils-2.8.tar.gz
cd inetutils-2.8
```

Build and install. Run each block in order:

```bash
sed -i 's/def HAVE_TERMCAP_TGETENT/ 1/' telnet/telnet.c
```

```bash
./configure --prefix=/usr        \
            --bindir=/usr/bin    \
            --localstatedir=/var \
            --disable-logger     \
            --disable-whois      \
            --disable-rcp        \
            --disable-rexec      \
            --disable-rlogin     \
            --disable-rsh        \
            --disable-servers
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
mv -v /usr/{,s}bin/ifconfig
```

Clean up:

```bash
cd /sources
rm -rf inetutils-2.8
```

### Less-704

*Book §8.45* · *Package:* `less-704.tar.gz` · *Build time:* 0.1 SBU · *Disk space:* 17 MB

**What it is:** The `less` pager for scrolling through text and man pages.

Unpack the package:

```bash
cd /sources
tar -xf less-704.tar.gz
cd less-704
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr --sysconfdir=/etc
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf less-704
```

### Perl-5.44.0

*Book §8.46* · *Package:* `perl-5.44.0.tar.xz` · *Build time:* 1.3 SBU · *Disk space:* 261 MB

**What it is:** The Perl language (final version).

Unpack the package:

```bash
cd /sources
tar -xf perl-5.44.0.tar.xz
cd perl-5.44.0
```

Build and install. Run each block in order:

```bash
export BUILD_ZLIB=False
export BUILD_BZIP2=0
```

```bash
sh Configure -des                                          \
             -D prefix=/usr                                \
             -D vendorprefix=/usr                          \
             -D privlib=/usr/lib/perl5/5.44/core_perl      \
             -D archlib=/usr/lib/perl5/5.44/core_perl      \
             -D sitelib=/usr/lib/perl5/5.44/site_perl      \
             -D sitearch=/usr/lib/perl5/5.44/site_perl     \
             -D vendorlib=/usr/lib/perl5/5.44/vendor_perl  \
             -D vendorarch=/usr/lib/perl5/5.44/vendor_perl \
             -D man1dir=/usr/share/man/man1                \
             -D man3dir=/usr/share/man/man3                \
             -D pager="/usr/bin/less -isR"                 \
             -D useshrplib                                 \
             -D usethreads
```

```bash
make
```

```bash
TEST_JOBS=$(nproc) make test_harness
```

```bash
make install
unset BUILD_ZLIB BUILD_BZIP2
```

Clean up:

```bash
cd /sources
rm -rf perl-5.44.0
```

### Autoconf-2.73

*Book §8.47* · *Package:* `autoconf-2.73.tar.xz` · *Build time:* less than 0.1 SBU (about 0.4 SBU with tests) · *Disk space:* 25 MB

**What it is:** Generates `configure` scripts from templates.

Unpack the package:

```bash
cd /sources
tar -xf autoconf-2.73.tar.xz
cd autoconf-2.73
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf autoconf-2.73
```

### Automake-1.18.1

*Book §8.48* · *Package:* `automake-1.18.1.tar.xz` · *Build time:* less than 0.1 SBU (about 1.1 SBU with tests) · *Disk space:* 124 MB

**What it is:** Generates Makefiles from templates.

Unpack the package:

```bash
cd /sources
tar -xf automake-1.18.1.tar.xz
cd automake-1.18.1
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr --docdir=/usr/share/doc/automake-1.18.1
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make -j$(($(nproc)>4?$(nproc):4)) check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf automake-1.18.1
```

### OpenSSL-4.0.1

*Book §8.49* · *Package:* `openssl-4.0.1.tar.gz` · *Build time:* 1.9 SBU · *Disk space:* 1.0 GB

**What it is:** Cryptography library and tools (TLS/SSL). The kernel and many programs use it.

Unpack the package:

```bash
cd /sources
tar -xf openssl-4.0.1.tar.gz
cd openssl-4.0.1
```

Build and install. Run each block in order:

```bash
./config --prefix=/usr         \
         --openssldir=/etc/ssl \
         --libdir=lib          \
         shared                \
         zlib-dynamic
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make test
```

Continue with the installation:

```bash
make INSTALL_LIBS= MANSUFFIX=ssl install
```

```bash
mv -v /usr/share/doc/openssl /usr/share/doc/openssl-4.0.1
```

```bash
cp -vfr doc/* /usr/share/doc/openssl-4.0.1
```

Clean up:

```bash
cd /sources
rm -rf openssl-4.0.1
```

### Libelf from Elfutils-0.195

*Book §8.50* · *Package:* `elfutils-0.195.tar.bz2` · *Build time:* 0.3 SBU · *Disk space:* 159 MB

**What it is:** Library for reading ELF binaries. Only `libelf` from Elfutils is installed; the kernel build needs it.

Unpack the package:

```bash
cd /sources
tar -xf elfutils-0.195.tar.bz2
cd elfutils-0.195
```

Build and install. Run each block in order:

Test suite (recommended, but optional):

```bash
./configure --prefix=/usr        \
            --disable-debuginfod \
            --enable-libdebuginfod=dummy
```

Continue with the installation:

```bash
make -C lib
make -C libelf
```

Test suite (recommended, but optional):

```bash
make -k check
```

Continue with the installation:

```bash
make -C libelf install
install -vm644 config/libelf.pc /usr/lib/pkgconfig
rm /usr/lib/libelf.a
```

Clean up:

```bash
cd /sources
rm -rf elfutils-0.195
```

> **Side note:** The tarball is `elfutils-0.195`, but only the `libelf` part is installed.

### Libffi-3.8.0

*Book §8.51* · *Package:* `libffi-3.8.0.tar.gz` · *Build time:* 1.7 SBU · *Disk space:* 12 MB

**What it is:** Lets code call functions whose signature is only known at run time (Python uses it).

Unpack the package:

```bash
cd /sources
tar -xf libffi-3.8.0.tar.gz
cd libffi-3.8.0
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --with-gcc-arch=native
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf libffi-3.8.0
```

### Sqlite-3530400

*Book §8.52* · *Package:* `sqlite-autoconf-3530400.tar.gz` · *Build time:* 0.4 SBU · *Disk space:* 128 MB

**What it is:** A small, file-based SQL database engine.

Unpack the package:

```bash
cd /sources
tar -xf sqlite-autoconf-3530400.tar.gz
cd sqlite-autoconf-3530400
```

Build and install. Run each block in order:

```bash
python3 -m zipfile -e ../sqlite-doc-3530400.zip .
```

```bash
./configure --prefix=/usr     \
            --disable-static  \
            --enable-fts{4,5} \
            CPPFLAGS="-D SQLITE_ENABLE_COLUMN_METADATA=1 \
                      -D SQLITE_ENABLE_UNLOCK_NOTIFY=1   \
                      -D SQLITE_ENABLE_DBSTAT_VTAB=1     \
                      -D SQLITE_SECURE_DELETE=1"
```

```bash
make LDFLAGS.rpath=""
```

```bash
make install
```

```bash
cp -v -R sqlite-doc-3530400 -T /usr/share/doc/sqlite-3.53.4
```

Clean up:

```bash
cd /sources
rm -rf sqlite-autoconf-3530400
```

### mpdecimal-4.0.1

*Book §8.53* · *Package:* `mpdecimal-4.0.1.tar.gz` · *Build time:* 0.1 SBU · *Disk space:* 4.4 MB

**What it is:** Decimal math library used by Python (final version).

Unpack the package:

```bash
cd /sources
tar -xf mpdecimal-4.0.1.tar.gz
cd mpdecimal-4.0.1
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr    \
            --disable-static \
            --docdir=/usr/share/doc/mpdecimal-4.0.1
```

```bash
make
```

```bash
make check_local
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf mpdecimal-4.0.1
```

### Python-3.14.7

*Book §8.54* · *Package:* `Python-3.14.7.tar.xz` · *Build time:* 2.7 SBU · *Disk space:* 509 MB

**What it is:** The Python 3 interpreter (final version, with SSL and all modules).

Unpack the package:

```bash
cd /sources
tar -xf Python-3.14.7.tar.xz
cd Python-3.14.7
```

Build and install. Run each block in order:

```bash
patch -Np1 -i ../Python-3.14.7-openssl_4-1.patch
```

```bash
./configure --prefix=/usr          \
            --enable-shared        \
            --with-system-expat    \
            --enable-optimizations \
            --without-static-libpython
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make test TESTOPTS="--timeout 120"
```

Continue with the installation:

```bash
make install
```

```bash
cat > /etc/pip.conf << EOF
[global]
root-user-action = ignore
disable-pip-version-check = true
EOF
```

```bash
install -v -dm755 /usr/share/doc/python-3.14.7/html

tar --strip-components=1  \
    --no-same-owner       \
    --no-same-permissions \
    -C /usr/share/doc/python-3.14.7/html \
    -xvf ../python-3.14.7-docs-html.tar.bz2
```

Clean up:

```bash
cd /sources
rm -rf Python-3.14.7
```

> **Side note:** The `/etc/pip.conf` file created here silences pip's "running as root" warning. In LFS you are deliberately installing Python modules system-wide.

### Flit-Core-4.0.2

*Book §8.55* · *Package:* `flit_core-4.0.2.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 1.3 MB

**What it is:** A small tool used to build Python modules ("wheels").

Unpack the package:

```bash
cd /sources
tar -xf flit_core-4.0.2.tar.gz
cd flit_core-4.0.2
```

Build and install. Run each block in order:

```bash
pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
```

```bash
pip3 install --no-index --find-links dist flit_core
```

Clean up:

```bash
cd /sources
rm -rf flit_core-4.0.2
```

### Packaging-26.3

*Book §8.56* · *Package:* `packaging-26.3.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 3.0 MB

**What it is:** Python module for handling version numbers and package metadata.

Unpack the package:

```bash
cd /sources
tar -xf packaging-26.3.tar.gz
cd packaging-26.3
```

Build and install. Run each block in order:

```bash
pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
```

```bash
pip3 install --no-index --find-links dist packaging
```

Clean up:

```bash
cd /sources
rm -rf packaging-26.3
```

### Wheel-0.48.0

*Book §8.57* · *Package:* `wheel-0.48.0.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 768 KB

**What it is:** Python module for the "wheel" package format.

Unpack the package:

```bash
cd /sources
tar -xf wheel-0.48.0.tar.gz
cd wheel-0.48.0
```

Build and install. Run each block in order:

```bash
pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
```

```bash
pip3 install --no-index --find-links dist wheel
```

Clean up:

```bash
cd /sources
rm -rf wheel-0.48.0
```

### Setuptools-84.0.0

*Book §8.58* · *Package:* `setuptools-84.0.0.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 19 MB

**What it is:** Python module for building and installing Python packages.

Unpack the package:

```bash
cd /sources
tar -xf setuptools-84.0.0.tar.gz
cd setuptools-84.0.0
```

Build and install. Run each block in order:

```bash
pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
```

```bash
pip3 install --no-index --find-links dist setuptools
```

Clean up:

```bash
cd /sources
rm -rf setuptools-84.0.0
```

### Meson-1.12.0

*Book §8.59* · *Package:* `meson-1.12.0.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 50 MB

**What it is:** A modern build system (Systemd and many BLFS packages use it).

Unpack the package:

```bash
cd /sources
tar -xf meson-1.12.0.tar.gz
cd meson-1.12.0
```

Build and install. Run each block in order:

```bash
pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
```

```bash
pip3 install --no-index --find-links dist meson
install -vDm644 data/shell-completions/bash/meson /usr/share/bash-completion/completions/meson
install -vDm644 data/shell-completions/zsh/_meson /usr/share/zsh/site-functions/_meson
```

Clean up:

```bash
cd /sources
rm -rf meson-1.12.0
```

### Kmod-34.2

*Book §8.60* · *Package:* `kmod-34.2.tar.xz` · *Build time:* less than 0.1 SBU · *Disk space:* 6.8 MB

**What it is:** Tools for loading and managing kernel modules (`modprobe`, `lsmod`).

Unpack the package:

```bash
cd /sources
tar -xf kmod-34.2.tar.xz
cd kmod-34.2
```

Build and install. Run each block in order:

```bash
mkdir -p build
cd       build

meson setup --prefix=/usr ..    \
            --buildtype=release \
            -D manpages=false
```

```bash
ninja
```

```bash
ninja install
```

Clean up:

```bash
cd /sources
rm -rf kmod-34.2
```

### Coreutils-9.11

*Book §8.61* · *Package:* `coreutils-9.11.tar.xz` · *Build time:* 1.2 SBU · *Disk space:* 194 MB

**What it is:** Essential file and text commands (final version).

Unpack the package:

```bash
cd /sources
tar -xf coreutils-9.11.tar.xz
cd coreutils-9.11
```

Build and install. Run each block in order:

```bash
patch -Np1 -i ../coreutils-9.11-i18n-1.patch
```

```bash
autoreconf -fv
automake -af
FORCE_UNSAFE_CONFIGURE=1 ./configure \
            --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make NON_ROOT_USERNAME=tester check-root
```

```bash
groupadd -g 102 dummy -U tester
```

```bash
chown -R tester .
```

```bash
su tester -c "PATH=$PATH make -k RUN_EXPENSIVE_TESTS=yes check" \
   < /dev/null
```

```bash
groupdel dummy
```

Continue with the installation:

```bash
make install
```

```bash
mv -v /usr/bin/chroot /usr/sbin
mv -v /usr/share/man/man1/chroot.1 /usr/share/man/man8/chroot.8
sed -i 's/"1"/"8"/' /usr/share/man/man8/chroot.8
```

Clean up:

```bash
cd /sources
rm -rf coreutils-9.11
```

> **Side note:** The test suite uses a temporary group called `dummy`. The commands create and then remove it.

### Diffutils-3.12

*Book §8.62* · *Package:* `diffutils-3.12.tar.xz` · *Build time:* 0.4 SBU · *Disk space:* 51 MB

**What it is:** File comparison tools (final version).

Unpack the package:

```bash
cd /sources
tar -xf diffutils-3.12.tar.xz
cd diffutils-3.12
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf diffutils-3.12
```

### Findutils-4.11.0

*Book §8.63* · *Package:* `findutils-4.11.0.tar.xz` · *Build time:* 0.9 SBU · *Disk space:* 71 MB

**What it is:** File search tools (final version).

Unpack the package:

```bash
cd /sources
tar -xf findutils-4.11.0.tar.xz
cd findutils-4.11.0
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr --localstatedir=/var/lib/locate
```

```bash
make
```

Test suite (recommended, but optional):

```bash
chown -R tester .
su tester -c "PATH=$PATH make check -k"
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf findutils-4.11.0
```

### Groff-1.24.1

*Book §8.64* · *Package:* `groff-1.24.1.tar.gz` · *Build time:* 0.6 SBU · *Disk space:* 128 MB

**What it is:** Text formatter used to display man pages.

> **Pro tip:** Groff wants to know your default paper size. The command uses `PAGE=<paper_size>`. Use `letter` in the US or `A4` in most other countries.

Unpack the package:

```bash
cd /sources
tar -xf groff-1.24.1.tar.gz
cd groff-1.24.1
```

Build and install. Run each block in order:

```bash
PAGE=<paper_size> ./configure --prefix=/usr
```

```bash
make -j1
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf groff-1.24.1
```


### GRUB-2.14

**What it is:** The GRand Unified Bootloader. It loads the Linux kernel when the computer starts.

*Package:* `grub-2.14.tar.xz` · *Build time:* 1.0 SBU · *Disk space:* 245 MB

GRUB can be built for **BIOS**, **64-bit UEFI**, and **32-bit UEFI** (rare). Build the ones you need. For a disk you plan to share or distribute, build BIOS **and** 64-bit UEFI.

```bash
cd /sources
tar -xf grub-2.14.tar.xz
cd grub-2.14
```

First, remove any custom compiler flags and apply a small fix for a bug in this GRUB release:

```bash
unset {C,CPP,CXX,LD}FLAGS
```

```bash
sed 's/--image-base/--nonexist-linker-option/' -i configure
```

**GRUB for BIOS** (skip if you only boot with UEFI):

```bash
./configure --prefix=/usr     \
            --sysconfdir=/etc \
            --disable-efiemu  \
            --disable-werror
```

```bash
make
```

```bash
make install
```

**GRUB for 64-bit UEFI** (most modern PCs and VMs with UEFI firmware). If you built the BIOS version above, clean the tree first with `make clean`. Then:

```bash
./configure --prefix=/usr       \
            --sysconfdir=/etc   \
            --target=x86_64     \
            --with-platform=efi \
            --disable-efiemu    \
            --disable-werror
```

```bash
make
```

```bash
make install
```

**GRUB for 32-bit UEFI** (very rare; skip unless you know you need it). Run `make clean` first, then:

```bash
./configure --prefix=/usr       \
            --sysconfdir=/etc   \
            --target=i386       \
            --with-platform=efi \
            --disable-efiemu    \
            --disable-werror
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf grub-2.14
```

> **Side note:** The GRUB test suite needs packages that LFS doesn't have, so the book recommends skipping it. Actually *installing* GRUB to the disk happens in Phase 9.

### Gzip-1.14

*Book §8.66* · *Package:* `gzip-1.14.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 21 MB

**What it is:** Gzip compression (final version).

Unpack the package:

```bash
cd /sources
tar -xf gzip-1.14.tar.xz
cd gzip-1.14
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf gzip-1.14
```

### IPRoute2-7.1.0

*Book §8.67* · *Package:* `iproute2-7.1.0.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 18 MB

**What it is:** Modern networking tools, including the `ip` command.

Unpack the package:

```bash
cd /sources
tar -xf iproute2-7.1.0.tar.xz
cd iproute2-7.1.0
```

Build and install. Run each block in order:

```bash
sed -i /ARPD/d Makefile
rm -fv man/man8/arpd.8
```

```bash
make NETNS_RUN_DIR=/run/netns
```

```bash
make SBINDIR=/usr/sbin install
```

```bash
install -vDm644 COPYING README* -t /usr/share/doc/iproute2-7.1.0
```

Clean up:

```bash
cd /sources
rm -rf iproute2-7.1.0
```

### Kbd-2.10.0

*Book §8.68* · *Package:* `kbd-2.10.0.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 45 MB

**What it is:** Keyboard maps, console fonts and keyboard utilities.

Unpack the package:

```bash
cd /sources
tar -xf kbd-2.10.0.tar.xz
cd kbd-2.10.0
```

Build and install. Run each block in order:

```bash
patch -Np1 -i ../kbd-2.10.0-backspace-1.patch
```

```bash
sed -i '/RESIZECONS_PROGS=/s/yes/no/' configure
sed -i 's/resizecons.8 //' docs/man/man8/Makefile.in
```

```bash
./configure --prefix=/usr --disable-vlock
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
cp -R -v docs/doc -T /usr/share/doc/kbd-2.10.0
```

Clean up:

```bash
cd /sources
rm -rf kbd-2.10.0
```

### Libpipeline-1.5.8

*Book §8.69* · *Package:* `libpipeline-1.5.8.tar.gz` · *Build time:* 0.1 SBU · *Disk space:* 10 MB

**What it is:** A library for running pipelines of programs (Man-DB uses it).

Unpack the package:

```bash
cd /sources
tar -xf libpipeline-1.5.8.tar.gz
cd libpipeline-1.5.8
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf libpipeline-1.5.8
```

### Make-4.4.1

*Book §8.70* · *Package:* `make-4.4.1.tar.gz` · *Build time:* 0.6 SBU · *Disk space:* 13 MB

**What it is:** GNU Make (final version).

Unpack the package:

```bash
cd /sources
tar -xf make-4.4.1.tar.gz
cd make-4.4.1
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
chown -R tester .
su tester -c "PATH=$PATH make check"
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf make-4.4.1
```

### Patch-2.8

*Book §8.71* · *Package:* `patch-2.8.tar.xz` · *Build time:* 0.2 SBU · *Disk space:* 14 MB

**What it is:** The `patch` program (final version).

Unpack the package:

```bash
cd /sources
tar -xf patch-2.8.tar.xz
cd patch-2.8
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf patch-2.8
```

### Tar-1.35

*Book §8.72* · *Package:* `tar-1.35.tar.xz` · *Build time:* 0.5 SBU · *Disk space:* 43 MB

**What it is:** The `tar` archiver (final version).

Unpack the package:

```bash
cd /sources
tar -xf tar-1.35.tar.xz
cd tar-1.35
```

Build and install. Run each block in order:

```bash
patch -Np1 -i ../tar-1.35-acl_fix-1.patch
```

```bash
FORCE_UNSAFE_CONFIGURE=1  \
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
make -C doc install-html docdir=/usr/share/doc/tar-1.35
```

Clean up:

```bash
cd /sources
rm -rf tar-1.35
```

### Texinfo-7.3

*Book §8.73* · *Package:* `texinfo-7.3.tar.xz` · *Build time:* 0.4 SBU · *Disk space:* 151 MB

**What it is:** GNU info documentation tools (final version).

Unpack the package:

```bash
cd /sources
tar -xf texinfo-7.3.tar.xz
cd texinfo-7.3
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
make TEXMF=/usr/share/texmf install-tex
```

Clean up:

```bash
cd /sources
rm -rf texinfo-7.3
```

> **Pro tip:** If `info` ever shows an out-of-date menu, the book has a short optional loop that rebuilds `/usr/share/info/dir`.

### Vim-9.2.1025

*Book §8.74* · *Package:* `vim-9.2.1025.tar.gz` · *Build time:* 3.3 SBU · *Disk space:* 234 MB

**What it is:** The Vim text editor (`vi`).

Unpack the package:

```bash
cd /sources
tar -xf vim-9.2.1025.tar.gz
cd vim-9.2.1025
```

Build and install. Run each block in order:

```bash
echo '#define SYS_VIMRC_FILE "/etc/vimrc"' >> src/feature.h
```

```bash
./configure --prefix=/usr
```

```bash
make
```

Test suite (recommended, but optional):

```bash
chown -R tester .
sed '/test_plugin_glvs/d' -i src/testdir/Make_all.mak
```

```bash
su tester -c "TERM=xterm-256color LANG=en_US.UTF-8 make -j1 test" \
   &> vim-test.log
```

Continue with the installation:

```bash
make install
```

```bash
ln -sv vim /usr/bin/vi
for L in  /usr/share/man/{,*/}man1/vim.1; do
    ln -sv vim.1 $(dirname $L)/vi.1
done
```

```bash
ln -sv ../vim/vim92/doc /usr/share/doc/vim-9.2.1025
```

```bash
cat > /etc/vimrc << "EOF"
" Begin /etc/vimrc

" Ensure defaults are set before customizing settings, not after
source $VIMRUNTIME/defaults.vim
let skip_defaults_vim=1

set nocompatible
set backspace=2
set mouse=
syntax on
if (&term == "xterm") || (&term == "putty")
  set background=dark
endif

" End /etc/vimrc
EOF
```

Clean up:

```bash
cd /sources
rm -rf vim-9.2.1025
```

> **Pro tip:** Prefer a different editor? You can swap Vim for another later in BLFS. Vim is just the book's choice.

### MarkupSafe-3.0.3

*Book §8.75* · *Package:* `markupsafe-3.0.3.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 696 KB

**What it is:** Python module for safe HTML/XML strings (Jinja2 needs it).

Unpack the package:

```bash
cd /sources
tar -xf markupsafe-3.0.3.tar.gz
cd markupsafe-3.0.3
```

Build and install. Run each block in order:

```bash
pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
```

```bash
pip3 install --no-index --find-links dist Markupsafe
```

Clean up:

```bash
cd /sources
rm -rf markupsafe-3.0.3
```

### Jinja2-3.1.6

*Book §8.76* · *Package:* `jinja2-3.1.6.tar.gz` · *Build time:* less than 0.1 SBU · *Disk space:* 2.7 MB

**What it is:** Python templating module (Systemd's build needs it).

Unpack the package:

```bash
cd /sources
tar -xf jinja2-3.1.6.tar.gz
cd jinja2-3.1.6
```

Build and install. Run each block in order:

```bash
pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
```

```bash
pip3 install --no-index --find-links dist Jinja2
```

Clean up:

```bash
cd /sources
rm -rf jinja2-3.1.6
```

### Systemd-261.2

*Book §8.77* · *Package:* `systemd-261.2.tar.gz` · *Build time:* 1.2 SBU · *Disk space:* 396 MB

**What it is:** The init system and service manager: it boots the machine and runs services. It also provides udev (device management), networking and logging.

> **Side note:** Systemd is built with Meson and Ninja instead of `configure` and `make`. The idea is the same: `meson setup` = configure, `ninja` = compile, `ninja install` = install.

Unpack the package:

```bash
cd /sources
tar -xf systemd-261.2.tar.gz
cd systemd-261.2
```

Build and install. Run each block in order:

```bash
sed -e 's/GROUP="render"/GROUP="video"/' \
    -e 's/GROUP="sgx", //'               \
    -i rules.d/50-udev-default.rules.in
```

```bash
mkdir -p build
cd       build

meson setup ..                \
      --prefix=/usr           \
      --buildtype=release     \
      -D default-dnssec=no    \
      -D firstboot=false      \
      -D install-tests=false  \
      -D ldconfig=false       \
      -D sysusers=false       \
      -D rpmmacrosdir=no      \
      -D homed=disabled       \
      -D man=disabled         \
      -D mode=release         \
      -D pamconfdir=no        \
      -D dev-kvm-mode=0660    \
      -D nobody-group=nogroup \
      -D sysupdate=disabled   \
      -D ukify=disabled       \
      -D docdir=/usr/share/doc/systemd-261.2
```

```bash
ninja
```

Test suite (recommended, but optional):

```bash
echo 'NAME="Linux From Scratch"' > /etc/os-release
unshare -m ninja test
```

Continue with the installation:

```bash
ninja install
```

```bash
tar -xf ../../systemd-man-pages-261.2.tar.xz \
    --no-same-owner --strip-components=1     \
    -C /usr/share/man
```

```bash
systemd-machine-id-setup
```

```bash
systemctl preset-all
```

Clean up:

```bash
cd /sources
rm -rf systemd-261.2
```

> **Side note:** A few Systemd tests can't pass inside a chroot. That's normal. Check the build logs if many fail.

> **Side note:** `systemctl preset-all` enables the default set of services (networking, logging, time sync, and so on) for first boot.

### D-Bus-1.16.2

*Book §8.78* · *Package:* `dbus-1.16.2.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 17 MB

**What it is:** A message bus that lets programs and services talk to each other.

Unpack the package:

```bash
cd /sources
tar -xf dbus-1.16.2.tar.xz
cd dbus-1.16.2
```

Build and install. Run each block in order:

```bash
mkdir build
cd    build

meson setup --prefix=/usr --buildtype=release --wrap-mode=nofallback ..
```

```bash
ninja
```

Test suite (recommended, but optional):

```bash
ninja test
```

Continue with the installation:

```bash
ninja install
```

```bash
ln -sfv /etc/machine-id /var/lib/dbus
```

Clean up:

```bash
cd /sources
rm -rf dbus-1.16.2
```

### Man-DB-2.13.1

*Book §8.79* · *Package:* `man-db-2.13.1.tar.xz` · *Build time:* 0.3 SBU · *Disk space:* 44 MB

**What it is:** The `man` command for reading manual pages.

Unpack the package:

```bash
cd /sources
tar -xf man-db-2.13.1.tar.xz
cd man-db-2.13.1
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr                         \
            --docdir=/usr/share/doc/man-db-2.13.1 \
            --sysconfdir=/etc                     \
            --disable-setuid                      \
            --enable-cache-owner=bin              \
            --with-browser=/usr/bin/lynx          \
            --with-vgrind=/usr/bin/vgrind         \
            --with-grap=/usr/bin/grap
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf man-db-2.13.1
```

### Procps-ng-4.0.7

*Book §8.80* · *Package:* `procps-ng-4.0.7.tar.xz` · *Build time:* 0.1 SBU · *Disk space:* 28 MB

**What it is:** Process tools such as `ps`, `top`, `free` and `kill`.

Unpack the package:

```bash
cd /sources
tar -xf procps-ng-4.0.7.tar.xz
cd procps-ng-4.0.7
```

Build and install. Run each block in order:

```bash
./configure --prefix=/usr                           \
            --docdir=/usr/share/doc/procps-ng-4.0.7 \
            --disable-static                        \
            --disable-kill                          \
            --enable-watch8bit                      \
            --with-systemd
```

```bash
make
```

Test suite (recommended, but optional):

```bash
chown -R tester .
su tester -c "PATH=$PATH make check"
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf procps-ng-4.0.7
```

### Util-linux-2.42.2

*Book §8.81* · *Package:* `util-linux-2.42.2.tar.xz` · *Build time:* 0.5 SBU · *Disk space:* 362 MB

**What it is:** Core system utilities (final version).

Unpack the package:

```bash
cd /sources
tar -xf util-linux-2.42.2.tar.xz
cd util-linux-2.42.2
```

Build and install. Run each block in order:

```bash
./configure --bindir=/usr/bin     \
            --libdir=/usr/lib     \
            --runstatedir=/run    \
            --sbindir=/usr/sbin   \
            --disable-chfn-chsh   \
            --disable-login       \
            --disable-nologin     \
            --disable-su          \
            --disable-setpriv     \
            --disable-runuser     \
            --disable-pylibmount  \
            --disable-liblastlog2 \
            --disable-static      \
            --without-python      \
            ADJTIME_PATH=/var/lib/hwclock/adjtime \
            --docdir=/usr/share/doc/util-linux-2.42.2
```

```bash
make
```

Test suite (recommended, but optional):

```bash
touch /etc/fstab
chown -R tester .
su tester -c "make -k check"
```

Continue with the installation:

```bash
make install
```

Clean up:

```bash
cd /sources
rm -rf util-linux-2.42.2
```

> **Warning:** Never run the Util-linux tests as root. The commands use the `tester` user for that reason.

### E2fsprogs-1.47.4

*Book §8.82* · *Package:* `e2fsprogs-1.47.4.tar.gz` · *Build time:* 2.4 SBU on a spinning disk, 0.4 SBU on an SSD · *Disk space:* 101 MB

**What it is:** Tools for ext2/ext3/ext4 filesystems (`mkfs.ext4`, `fsck.ext4`, and more).

Unpack the package:

```bash
cd /sources
tar -xf e2fsprogs-1.47.4.tar.gz
cd e2fsprogs-1.47.4
```

Build and install. Run each block in order:

```bash
mkdir -v build
cd       build
```

```bash
../configure --prefix=/usr       \
             --sysconfdir=/etc   \
             --enable-elf-shlibs \
             --disable-libblkid  \
             --disable-libuuid   \
             --disable-uuidd     \
             --disable-fsck
```

```bash
make
```

Test suite (recommended, but optional):

```bash
make check
```

Continue with the installation:

```bash
make install
```

```bash
rm -fv /usr/lib/{libcom_err,libe2p,libext2fs,libss}.a
```

```bash
gunzip -v /usr/share/info/libext2fs.info.gz
install-info --dir-file=/usr/share/info/dir /usr/share/info/libext2fs.info
```

```bash
makeinfo -o      doc/com_err.info ../lib/et/com_err.texinfo
install -v -m644 doc/com_err.info /usr/share/info
install-info --dir-file=/usr/share/info/dir /usr/share/info/com_err.info
```

Optional — only if an *older* bootloader or tool can't read new ext4 filesystems:

```bash
sed 's/metadata_csum_seed,//' -i /etc/mke2fs.conf
```

Clean up:

```bash
cd /sources
rm -rf e2fsprogs-1.47.4
```


### Stripping Debugging Symbols (Optional)

Most programs and libraries contain debugging symbols that make them several times larger. Removing ("stripping") them saves hundreds of megabytes. The book's command strips everything safely: it keeps separate debug files for a few key libraries and uses a trick for programs that are currently running.

```bash
save_usrlib="$(cd /usr/lib; ls ld-linux*[^g])
             libc.so.6
             libthread_db.so.1
             libquadmath.so.0.0.0
             libstdc++.so.6.0.36
             libitm.so.1.0.0
             libatomic.so.1.2.0"

cd /usr/lib

for LIB in $save_usrlib; do
    objcopy --only-keep-debug --compress-debug-sections=zstd $LIB $LIB.dbg
    cp $LIB /tmp/$LIB
    strip --strip-unneeded /tmp/$LIB
    objcopy --add-gnu-debuglink=$LIB.dbg /tmp/$LIB
    install -vm755 /tmp/$LIB /usr/lib
    rm /tmp/$LIB
done

online_usrbin="bash find strip"
online_usrlib="libbfd-2.47.20260726.so
               libsframe.so.3.0.0
               libhistory.so.8.3
               libncursesw.so.6.6
               libm.so.6
               libreadline.so.8.3
               libz.so.1.3.2
               libzstd.so.1.5.7
               $(cd /usr/lib; find libnss*.so* -type f)"

for BIN in $online_usrbin; do
    cp /usr/bin/$BIN /tmp/$BIN
    strip --strip-unneeded /tmp/$BIN
    install -vm755 /tmp/$BIN /usr/bin
    rm /tmp/$BIN
done

for LIB in $online_usrlib; do
    cp /usr/lib/$LIB /tmp/$LIB
    strip --strip-unneeded /tmp/$LIB
    install -vm755 /tmp/$LIB /usr/lib
    rm /tmp/$LIB
done

for i in $(find /usr/lib -type f -name \*.so* ! -name \*dbg) \
         $(find /usr/lib -type f -name \*.a)                 \
         $(find /usr/{bin,sbin,libexec} -type f); do
    case "$online_usrbin $online_usrlib $save_usrlib" in
        *$(basename $i)* )
            ;;
        * ) strip --strip-unneeded $i
            ;;
    esac
done

unset BIN LIB save_usrlib online_usrbin online_usrlib
```

> **Warning:** This step is optional. If you do it, run the **entire block exactly as written**. Stripping a library while it's in use (for example `libc`) the wrong way can break the system. Lots of "file format not recognized" warnings are normal.

### Cleaning Up

Remove temporary files:

```bash
rm -rf /tmp/{*,.*}
```

Remove libtool archive files:

```bash
find /usr/lib /usr/libexec -name \*.la -delete
```

Remove leftovers from the temporary cross-toolchain:

```bash
find /usr -depth -name $(uname -m)-lfs-linux-gnu\* | xargs rm -rf
```

Remove the temporary `tester` user:

```bash
userdel -r tester
```

> **Checkpoint:** The full system is now built. **Make another backup now** (a tar archive, or a copy of the unmounted image).

---

## Phase 8 — Configure the System (Book Chapter 9)

You're still inside the chroot.

### 8.1 Networking

systemd includes its own network manager (`systemd-networkd`) and DNS resolver (`systemd-resolved`). Both are already enabled.

**Recommended for beginners (and VMs): DHCP.** This version uses `Name=en*`, which matches any wired interface with a "predictable" name (`enp0s3`, `ens33`, `eno1`, and so on). That way you don't need to know the exact interface name in advance:

```bash
cat > /etc/systemd/network/10-eth-dhcp.network << "EOF"
[Match]
Name=en*

[Network]
DHCP=ipv4

[DHCPv4]
UseDomains=true
EOF
```

> **Side note:** The book's DHCP example uses a placeholder, `Name=<network-device-name>`. The `en*` wildcard is a standard systemd feature that does the same job for any wired card. After first boot, `ip link` shows the real name.

**Alternative: static IP address.** Use this instead of DHCP if your network needs a fixed address. Replace the placeholders and the example addresses:

```bash
cat > /etc/systemd/network/10-eth-static.network << "EOF"
[Match]
Name=<network-device-name>

[Network]
Address=192.168.0.2/24
Gateway=192.168.0.1
DNS=192.168.0.1
Domains=<Your Domain Name>
EOF
```

**DNS:** With `systemd-resolved`, you don't need to create `/etc/resolv.conf`. systemd creates it automatically on first boot.

> **Pro tip:** To download things *from inside the chroot* (for example, BLFS sources later), create a temporary `/etc/resolv.conf` containing `nameserver 1.1.1.1` (or your router's address). **Delete it before first boot**, so `systemd-resolved` can manage the file.

**Hostname:** Give your system a name. Replace `<lfs>` with your choice, for example `mydistro`:

```bash
echo "<lfs>" > /etc/hostname
```

**The hosts file.** For DHCP, a simple version is enough. Replace `mydistro` with your hostname:

```bash
cat > /etc/hosts << "EOF"
# Begin /etc/hosts

127.0.0.1 localhost
127.0.1.1 mydistro
::1       localhost ip6-localhost ip6-loopback
ff02::1   ip6-allnodes
ff02::2   ip6-allrouters

# End /etc/hosts
EOF
```

> **Side note:** The book's static-IP version of `/etc/hosts`, if you use a fixed address, puts your real IP and full domain name on the first line:

```bash
cat > /etc/hosts << "EOF"
# Begin /etc/hosts

<192.168.0.2> <FQDN> [alias1] [alias2] ...
::1       ip6-localhost ip6-loopback
ff02::1   ip6-allnodes
ff02::2   ip6-allrouters

# End /etc/hosts
EOF
```

### 8.2 Device management (udev)

No commands are required. systemd's `udevd` detects hardware and creates device files in `/dev` automatically at boot, and it loads kernel modules as needed.

> **Side note:** Network interface names such as `enp0s3` come from udev's "predictable naming." If you prefer the classic `eth0`, add `net.ifnames=0` to the kernel command line in `grub.cfg` (Phase 9) and use `Name=eth0` in the network file.

### 8.3 System clock

systemd assumes your hardware clock is set to **UTC**, which is the right choice for Linux-only machines and for VMs. **Only if** the machine dual-boots with Windows (which keeps the clock in *local* time), create this file:

```bash
cat > /etc/adjtime << "EOF"
0.0 0 0.0
0
LOCAL
EOF
```

> **Side note:** Commands such as `timedatectl set-timezone` don't work inside the chroot. The time zone was already set when you built Glibc (the `/etc/localtime` link). You can change it after first boot with `timedatectl set-timezone America/Chicago` (use your zone).

### 8.4 Console keyboard and font (optional)

With a US keyboard and the default font, you can **skip this step**. For other layouts, create `/etc/vconsole.conf`. For example, for a German keyboard:

```bash
cat > /etc/vconsole.conf << "EOF"
KEYMAP=de-latin1
FONT=Lat2-Terminus16
EOF
```

> **Pro tip:** List available keymaps with `ls /usr/share/keymaps/i386/*/` and fonts with `ls /usr/share/consolefonts`.

### 8.5 Locale (language settings)

Choose your locale. For US English with UTF-8:

```bash
cat > /etc/locale.conf << "EOF"
LANG=en_US.UTF-8
EOF
```

> **Side note:** The general form from the book is `LANG=<ll>_<CC>.<charmap>`, where `ll` is the language (`en`, `de`, `es`), `CC` is the country (`US`, `GB`, `MX`), and `charmap` is almost always `UTF-8`. Run `locale -a` to see which locales you installed with Glibc. The locale must be one of them.

Create the system-wide shell profile, which loads the locale for login shells:

```bash
cat > /etc/profile << "EOF"
# Begin /etc/profile

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

# End /etc/profile
EOF
```

> **Side note:** On the plain text console (`TERM=linux`), this profile uses `C.UTF-8`, because the console can't draw most non-Latin characters. Graphical terminals (added later in BLFS) get your full locale.

### 8.6 The `/etc/inputrc` file

This file makes keys such as Home, End, Delete and PageUp work correctly in Bash:

```bash
cat > /etc/inputrc << "EOF"
# Begin /etc/inputrc
# Modified by Chris Lynn <roryo@roryo.dynup.net>

# Allow the command prompt to wrap to the next line
set horizontal-scroll-mode Off

# Enable 8-bit input
set meta-flag On
set input-meta On

# Turns off 8th bit stripping
set convert-meta Off

# Keep the 8th bit for display
set output-meta On

# none, visible or audible
set bell-style none

# All of the following map the escape sequence of the value
# contained in the 1st argument to the readline specific functions
"\eOd": backward-word
"\eOc": forward-word

# for linux console
"\e[1~": beginning-of-line
"\e[4~": end-of-line
"\e[5~": beginning-of-history
"\e[6~": end-of-history
"\e[3~": delete-char
"\e[2~": quoted-insert

# for xterm
"\eOH": beginning-of-line
"\eOF": end-of-line

# for Konsole
"\e[H": beginning-of-line
"\e[F": end-of-line

# uncomment for history search mode with up/down
# "\e[A": history-search-backward
# "\e[B": history-search-forward

# End /etc/inputrc
EOF
```

### 8.7 The `/etc/shells` file

This file lists the valid login shells:

```bash
cat > /etc/shells << "EOF"
# Begin /etc/shells

/bin/sh
/bin/bash

# End /etc/shells
EOF
```

### 8.8 Optional systemd tweaks

Keep boot messages on screen (otherwise they're cleared when the login prompt appears), which is handy for troubleshooting:

```bash
mkdir -pv /etc/systemd/system/getty@tty1.service.d

cat > /etc/systemd/system/getty@tty1.service.d/noclear.conf << EOF
[Service]
TTYVTDisallocate=no
EOF
```

> **Side note:** By default, systemd mounts `/tmp` as a RAM-based `tmpfs`. That's fine for most people. The book explains how to disable it (`systemctl mask tmp.mount`) if you need `/tmp` on disk. You can also cap how much disk space crash dumps may use:

```bash
mkdir -pv /etc/systemd/coredump.conf.d

cat > /etc/systemd/coredump.conf.d/maxuse.conf << EOF
[Coredump]
MaxUse=5G
EOF
```

---

## Phase 9 — Make the System Bootable (Book Chapter 10)

### 9.1 Create `/etc/fstab`

> **Warning:** **Check the prompt first.** It must read `(lfs chroot)`. If you run the `cat > /etc/fstab` command in a Debian window by mistake, it **replaces WSL Debian's own fstab**, and WSL reports mount errors every time it starts. (Appendix D explains how to recover.) Also, **never paste the example values below as-is**. The UUIDs in this guide are samples; yours come from `blkid`.

This file tells the system which filesystems to mount at boot. In a WSL build, **use UUIDs only**. On the target computer the USB drive appears as `sda` or `sdb`, never as `loop0`, so device names would be wrong. The UUIDs travel with the image.

> **Pro tip:** Use **UUIDs** instead of device names such as `/dev/sdb3`. Device names can change when disks are added or when the disk moves to another computer (your LFS disk might be `/dev/sdb` under the host but `/dev/sda` when LFS boots by itself). UUIDs never change. Find them **on the host** (open a second terminal outside the chroot) with `lsblk -o NAME,UUID,PARTUUID,FSTYPE`, or inside the chroot with `blkid`.

Get your IDs inside the chroot with `blkid /dev/loop0p1 /dev/loop0p3 /dev/loop0p4` (or `cat /root/lfs-disk-ids.txt` in a Debian window). Then write the file with **your** UUIDs:

```bash
cat > /etc/fstab << "EOF"
# Begin /etc/fstab

# file system                               mount-point  type  options   dump fsck
UUID=<uuid-of-lfs-root-partition>           /            ext4  defaults  1    1
UUID=<uuid-of-swap-partition>               swap         swap  pri=1     0    0

# End /etc/fstab
EOF
```

Add the EFI System Partition line. Replace `/dev/<zzz>` with `UUID=` plus the short UUID of `loop0p1`, for example `UUID=87E8-3B4A`:

```bash
cat >> /etc/fstab << "EOF"
/dev/<zzz>  /boot/efi  vfat  rw,relatime,codepage=437,iocharset=iso8859-1   0   2
EOF
```

Then create the mount point and mount the ESP inside the chroot:

```bash
mkdir -pv /boot/efi
mount -v /boot/efi
findmnt /boot/efi      # must show /dev/loop0p1
```

If mounting by UUID fails inside WSL, mount by device instead: `mount -v /dev/loop0p1 /boot/efi`. Keep the `UUID=` line in fstab anyway, because that's what the target computer uses.

### 9.2 Build the Linux kernel

**What it is:** The kernel is the core of the operating system. It manages memory and processes and talks to your hardware.

*Package:* `linux-7.1.8.tar.xz` · *Build time:* 0.4 - 32 SBU (typically about 2.5 SBU) · *Disk space:* 1.7 - 14 GB (typically about 2.3 GB)

```bash
cd /sources
tar -xf linux-7.1.8.tar.xz
cd linux-7.1.8
```

Make sure the source tree is completely clean:

```bash
make mrproper
```

**Configure the kernel.** This is the step people find hardest. Here's a simple, reliable approach:

1. Start from the kernel's default configuration for your architecture:

```bash
make defconfig
```

2. **Skip `make kvm_guest.config`.** WSL is itself a virtual machine, but LFS will boot on **real hardware**, not in a VM.

3. Open the menu editor and check the required settings listed below:

```bash
make menuconfig
```

> **Side note:** Navigating `menuconfig`: use the arrow keys to move, **Enter** to open a submenu, **Space** to cycle an option (`[*]` = built in, `<M>` = module, `[ ]` = off), `/` to **search** by option name (for example, type `/` then `DEVTMPFS`), and **Esc Esc** to go back. When you exit, answer **Yes** to save.

**Required settings.** The option name is in `[BRACKETS]` at the end of each line. Search for it with `/` if you can't find it in the menus.

```text
General setup --->
  [ ] Compile the kernel with warnings as errors                        [WERROR]
  CPU/Task time and stats accounting --->
    [*] Pressure stall information tracking                                [PSI]
    [ ]   Require boot parameter to enable pressure stall information tracking
                                                     ...  [PSI_DEFAULT_DISABLED]
  < > Enable kernel headers through /sys/kernel/kheaders.tar.xz      [IKHEADERS]
  [*] Control Group support --->                                       [CGROUPS]
    [*]   Memory controller                                              [MEMCG]
    [ /*] CPU controller --->                                     [CGROUP_SCHED]
      # This may cause some systemd features malfunction:
      [ ] Group scheduling for SCHED_RR/FIFO                    [RT_GROUP_SCHED]
  [ ] Configure standard kernel features (expert users) --->            [EXPERT]

Processor type and features --->
  [*] Build a relocatable kernel                                   [RELOCATABLE]
  [*]   Randomize the address of the kernel image (KASLR)       [RANDOMIZE_BASE]

General architecture-dependent options --->
  [*] Stack Protector buffer overflow detection                 [STACKPROTECTOR]
  [*]   Strong Stack Protector                           [STACKPROTECTOR_STRONG]

[*] Networking support --->                                                [NET]
  Networking options --->
    [*] TCP/IP networking                                                 [INET]
    [*]   The IPv6 protocol --->                                          [IPV6]

Device Drivers --->
  Generic Driver Options --->
    [ ] Support for uevent helper                                [UEVENT_HELPER]
    [*] Maintain a devtmpfs filesystem to mount at /dev               [DEVTMPFS]
    [*]   Automount devtmpfs at /dev, after the kernel mounted the rootfs
                                                           ...  [DEVTMPFS_MOUNT]
    Firmware loader --->
      [ ] Enable the firmware sysfs fallback mechanism   [FW_LOADER_USER_HELPER]
  Firmware Drivers --->
    [*] Export DMI identification via sysfs to userspace                 [DMIID]
    [*] Mark VGA/VBE/EFI FB as generic system framebuffer       [SYSFB_SIMPLEFB]
  Character devices --->
    -*- Enable TTY                                                         [TTY]
    [ ]   Allow legacy TIOCSTI usage                            [LEGACY_TIOCSTI]
  Graphics support --->
    <*>    Direct Rendering Manager (XFree86 4.1.0 and higher DRI support) --->
                                                                      ...  [DRM]
    [*]    Display a user-friendly message when a kernel panic occurs
                                                                ...  [DRM_PANIC]
    (kmsg)   Panic screen formatter                           [DRM_PANIC_SCREEN]
    Supported DRM clients --->
      [*] Enable legacy fbdev support for your modesetting driver
                                                      ...  [DRM_FBDEV_EMULATION]
    Drivers for system framebuffers --->
      <*> Simple framebuffer driver                              [DRM_SIMPLEDRM]
    Console display driver support --->
      [*] Framebuffer Console support                      [FRAMEBUFFER_CONSOLE]

File systems --->
  [*] Inotify support for userspace                               [INOTIFY_USER]
  Pseudo filesystems --->
    [*] Tmpfs virtual memory file system support (former shm fs)         [TMPFS]
    [*]   Tmpfs POSIX Access Control Lists                     [TMPFS_POSIX_ACL]
```

**If you boot with UEFI**, also enable:

```text
Processor type and features --->
  [*] EFI runtime service support                                          [EFI]
  [*]   EFI stub support                                              [EFI_STUB]

-*- Enable the block layer --->                                          [BLOCK]
  Partition Types --->
    [ /*] Advanced partition selection                      [PARTITION_ADVANCED]
    [*]     EFI GUID Partition support                           [EFI_PARTITION]

File systems --->
  DOS/FAT/EXFAT/NT Filesystems --->
    <*/M> VFAT (Windows-95) fs support                                 [VFAT_FS]
  Pseudo filesystems --->
    <*/M> EFI Variable filesystem                                    [EFIVAR_FS]
  -*- Native language support --->                                         [NLS]
    <*/M> Codepage 437 (United States, Canada)                [NLS_CODEPAGE_437]
    <*/M> NLS ISO 8859-1  (Latin 1; Western European Languages)  [NLS_ISO8859_1]
```

> **Warning:** **Don't copy WSL's kernel configuration** (`/proc/config.gz` inside WSL) as a starting point. It's built for Microsoft's virtual machine and won't boot a real PC. Start from `make defconfig` as shown.

**Required for this build (LFS boots from a USB drive):** build these in as `[*]`. Without an initramfs, the kernel can't reach a USB root disk otherwise:

| Search for | Menu name | Why |
|---|---|---|
| `USB_XHCI_HCD` | xHCI HCD (USB 3.x) support | Newer USB ports |
| `USB_EHCI_HCD` | EHCI HCD (USB 2.0) support | Older USB ports and drives |
| `USB_STORAGE` | USB Mass Storage support | Makes the USB drive usable as a disk |
| `USB_UAS` | USB Attached SCSI | Faster protocol many newer drives use |
| `BLK_DEV_SD` | SCSI disk support | USB drives appear as SCSI disks (`sda`, `sdb`) |
| `USB_HID` | USB HID transport layer | USB keyboard at the login prompt |
| `DRM_SIMPLEDRM` (or `FB_EFI`) | Simple framebuffer driver | Text on screen during and after boot on UEFI PCs |

Also add **`rootwait`** to the kernel line in `grub.cfg` (step 9.3). USB drives take a moment to appear during boot.

**If your root disk is NVMe**, enable:

```text
Device Drivers --->
  NVME Support --->
    <*> NVM Express block device                                  [BLK_DEV_NVME]
```

**On all 64-bit (x86_64) builds**, also enable x2APIC support. If the firmware turns x2APIC on and the kernel lacks this option, the kernel panics at boot. If x2APIC isn't used, the option does no harm:

```text
Processor type and features --->
  [*] x2APIC interrupt controller architecture support              [X86_X2APIC]

Device Drivers --->
  [*] PCI support --->                                                     [PCI]
    [*] Message Signaled Interrupts (MSI and MSI-X)                    [PCI_MSI]
  [*] IOMMU Hardware Support --->                                [IOMMU_SUPPORT]
    [*] Support for Interrupt Remapping                              [IRQ_REMAP]
```

> **Warning:** LFS doesn't use an **initramfs** (a small startup filesystem that loads drivers early). So every driver needed to reach your root partition must be **built in** (`[*]`), not a module (`<M>`). That includes the disk controller (SATA/AHCI, NVMe, or virtio), the filesystem (ext4), and the partition type (GPT). If any of them is a module, the boot fails with "VFS: Unable to mount root fs."

> **Warning:** Don't copy your host's kernel configuration (Debian's `/boot/config-*`) as a shortcut. Debian builds most drivers as modules and loads them with an initramfs. Without an initramfs, that configuration usually won't boot LFS.

> **Pro tip:** Before you leave `menuconfig`, use `/` to confirm `EXT4_FS=y` and the USB drivers above. The network card of the **target** PC (for example `E1000E`, `IGB`, or Realtek `R8169`) can be added now if you know it, or later. It isn't needed to boot.

When you exit `menuconfig`, choose **Yes** to save. The file must be named `.config` (the default). Then confirm your key settings:

```bash
grep -E '^CONFIG_(EXT4_FS|EFI_STUB|USB_STORAGE|USB_XHCI_HCD|BLK_DEV_SD)=' .config
```

Every line that applies to your setup must end in `=y`.

Compile the kernel:

```bash
make
```

Install the kernel modules:

```bash
make modules_install
```

Copy the kernel, its symbol map and its configuration to `/boot`. The file name is up to you, but it must start with `vmlinuz`:

```bash
cp -iv arch/x86/boot/bzImage /boot/vmlinuz-7.1.8-lfs-13.1-systemd
```

```bash
cp -iv System.map /boot/System.map-7.1.8
```

```bash
cp -iv .config /boot/config-7.1.8
```

Optionally install the kernel documentation:

```bash
cp -r Documentation -T /usr/share/doc/linux-7.1.8
```

> **Pro tip:** **Keep the kernel source directory** (don't delete `linux-7.1.8` yet). You'll probably want to go back, enable a missing driver and rebuild. Make sure it's owned by root: `chown -R 0:0 /sources/linux-7.1.8`.

### 9.3 Install GRUB and create its menu

> **Side note:** In a WSL build, GRUB is installed **into the image**, not onto any disk Windows uses. Nothing here can affect how your Windows PC boots.

> **Warning:** LFS can't do **Secure Boot**. Turn Secure Boot off in your firmware (or VM) settings.

Install **both** versions, so the USB drive boots on newer UEFI PCs **and** older BIOS PCs.

**Option A — BIOS boot.** The target is the whole image (`loop0`), not a partition:

```bash
grub-install /dev/loop0 --target=i386-pc
```

It should end with "Installation finished. No error reported."

**Option B — UEFI boot.** Make sure the image's EFI partition is mounted: `findmnt /boot/efi` must show `/dev/loop0p1`. Then:

```bash
grub-install --target=x86_64-efi --removable
```

Check that the boot file was created on the EFI partition:

```bash
ls -l /boot/efi/EFI/BOOT/BOOTX64.EFI
```

A warning about EFI variables or NVRAM is normal in WSL and harmless. `--removable` doesn't need them.

> **Side note:** `--removable` puts GRUB at the standard fallback path `EFI/BOOT/BOOTX64.EFI`, which firmware finds automatically, so no boot-menu entry is needed. If you build for both BIOS and UEFI, you can run both Option A and Option B. They share the same configuration file.

> **Pro tip:** If `grub-install` in the chroot fails with "failed to get canonical path", `/dev` isn't bind-mounted into the chroot (step 6.2). As an alternative for the BIOS part, Debian's own GRUB can install the BIOS boot code from a Debian window: install `grub-pc-bin`, then run `grub-install --target=i386-pc --boot-directory=$LFS/boot /dev/loop0`. It uses LFS's `grub.cfg` and doesn't touch Debian's own boot setup. Don't run `update-grub` or `grub-mkconfig` for this.

**Create the GRUB menu** (`/boot/grub/grub.cfg`). The book's own example uses fixed disk numbers such as `(hd0,2)` and `/dev/sda2`, which won't match the target computer. Use this UUID version instead:

**UUID version:** find the partition by UUID, so it keeps working no matter how disks are numbered. Replace `<UUID>` with the **filesystem UUID** and `<PARTUUID>` with the **partition UUID** of the LFS root partition (from `lsblk -o NAME,UUID,PARTUUID` on the host):

```bash
cat > /boot/grub/grub.cfg << "EOF"
# Begin /boot/grub/grub.cfg
set default=0
set timeout=5

insmod part_gpt
insmod ext2
search --no-floppy --fs-uuid --set=root <UUID>
set gfxpayload=1024x768x32

menuentry "GNU/Linux, Linux 7.1.8-lfs-13.1-systemd" {
        linux   /boot/vmlinuz-7.1.8-lfs-13.1-systemd root=PARTUUID=<PARTUUID> rootwait ro
}
EOF
```

Replace `<UUID>` with the `UUID` and `<PARTUUID>` with the `PARTUUID` that `blkid /dev/loop0p3` shows for your LFS root partition, removing the angle brackets. `rootwait` is essential for USB disks and harmless otherwise.

> **Side note:** Why two different IDs? GRUB searches by the **filesystem UUID**. The kernel, which has no initramfs, can only find its root partition by device name or by **PARTUUID** (the partition's own ID in the GPT table). `insmod ext2` loads GRUB's driver for all ext2/3/4 filesystems.

> **Pro tip:** If LFS later won't boot on the target PC, nothing is damaged. Back in WSL, reattach the image, remount, re-enter the chroot (Appendix A), fix the problem (usually a kernel option or a `grub.cfg` ID), then write the image to the USB drive again.

---

## Phase 10 — The End and First Boot (Book Chapter 11)

### 10.1 Create release files

These files identify your system. Many programs read `/etc/os-release`. You'll customize them for your own distro in Phase 11.

```bash
echo 13.1-systemd > /etc/lfs-release
```

```bash
cat > /etc/lsb-release << "EOF"
DISTRIB_ID="Linux From Scratch"
DISTRIB_RELEASE="13.1-systemd"
DISTRIB_CODENAME="<your name here>"
DISTRIB_DESCRIPTION="Linux From Scratch"
EOF
```

```bash
cat > /etc/os-release << "EOF"
NAME="Linux From Scratch"
VERSION="13.1-systemd"
ID=lfs
PRETTY_NAME="Linux From Scratch 13.1-systemd"
VERSION_CODENAME="<your name here>"
HOME_URL="https://www.linuxfromscratch.org/lfs/"
RELEASE_TYPE="stable"
EOF
```

### 10.2 Final checklist before rebooting

- [ ] Root password set (`passwd root`, done in the Shadow step)
- [ ] `/etc/fstab` uses the correct UUIDs or partitions
- [ ] Kernel is in `/boot`, and `grub.cfg` points to it with the correct `root=`
- [ ] Temporary `/etc/resolv.conf` (if you created one) is deleted
- [ ] Disk and filesystem drivers are **built into** the kernel
- [ ] `grub.cfg` has `rootwait` if the LFS disk is USB
- [ ] `/boot/efi/EFI/BOOT/BOOTX64.EFI` exists (UEFI)
- [ ] Secure Boot is off
- [ ] You have a backup copy of the image

### 10.3 Leave the chroot and detach the image

```bash
logout
```

In the Debian window, as root (check `echo $LFS` first). Unmount the EFI partition first, then the virtual filesystems, then the LFS root:

```bash
mountpoint -q $LFS/boot/efi && umount -v $LFS/boot/efi
```

```bash
umount -v $LFS/dev/pts
mountpoint -q $LFS/dev/shm && umount -v $LFS/dev/shm
umount -v $LFS/dev
umount -v $LFS/run
umount -v $LFS/proc
umount -v $LFS/sys
```

```bash
umount -v $LFS
```

Flush everything to the image and detach it:

```bash
sync
losetup -d /dev/loop0
losetup -a          # should no longer list lfs-disk.img
```

Keep a backup copy inside Debian. It takes almost no time and very little space:

```bash
cp --sparse=always /root/lfs-disk.img /root/lfs-disk-v1.img
```

### 10.4 Write the image to the USB drive (Windows)

**1. Copy the image to Windows.** Rufus and Etcher can't always open files directly inside WSL, so copy it to your Windows desktop. Replace `<you>` with your Windows user name. The copy takes the full 40 GB on drive C:

```bash
cp -v /root/lfs-disk.img /mnt/c/Users/<you>/Desktop/
```

**2. Clean the USB drive.** Old installer images leave hidden signatures that can stop a PC from booting the drive. In **PowerShell as Administrator**:

```powershell
diskpart
```

Then, inside diskpart:

```text
list disk
select disk N
clean
exit
```

> **Warning:** In `list disk`, find the USB drive **by its size** and replace `N` with its number. `clean` erases the selected disk instantly. Selecting the wrong number would erase a Windows disk.

**3. Write the image.**
- **Rufus:** choose the USB drive under *Device*. Click *SELECT* and pick `lfs-disk.img` (set the file filter to *All files*). Click *START*. If asked, choose **Write in DD Image mode**.
- **balenaEtcher:** *Flash from file* > `lfs-disk.img`, *Select target* > the USB drive, then *Flash!*

When it finishes, Windows may say it can't read the drive and offer to format it. **Click Cancel.** Windows simply can't read Linux filesystems.

### 10.5 Boot the USB drive on the target PC

1. Plug the USB drive into the target PC, ideally a port directly on the computer.
2. In the firmware setup (usually F2 or Del at power-on): **Secure Boot off**, **Fast Boot off**, and USB boot enabled. For older PCs, enable **Legacy/CSM** boot.
3. Power on and open the one-time boot menu (often F12, F11, F8 or Esc). Choose the USB drive. It may appear as **"UEFI: <brand>"** for UEFI, and without "UEFI" for BIOS.
4. You should see the GRUB menu, then boot messages, then `login:`.

### 10.6 First login and quick checks

You'll see a text `login:` prompt. Log in as `root` with the password you set. Then run a few checks:

```bash
cat /etc/os-release        # shows your system name
uname -r                   # 7.1.8
ip addr                    # an IP address appears only if the kernel has the PC's network driver
ping -c 3 linuxfromscratch.org
systemctl --failed         # ideally lists 0 failed units
```

Create an everyday user account and don't work as root:

```bash
useradd -m -G users,wheel -s /bin/bash <yourname>
passwd <yourname>
```

> **Pro tip:** To use the rest of the USB drive's space, see **Appendix E**.

> **Checkpoint:** **Congratulations — you've built Linux from scratch.** Consider registering at https://www.linuxfromscratch.org/cgi-bin/lfscounter.php (the book's "Get Counted" page).

---

## Phase 11 — From LFS to Your Own Distribution (Beyond the Book)

LFS gives you a *foundation*. A distribution that other people can install and use needs more: useful software, a way to install and update packages, a way to install the system itself, and license compliance. This phase is a roadmap. The details come from the companion book, **Beyond Linux From Scratch (BLFS)**, at https://www.linuxfromscratch.org/blfs/.

### 11.1 Give it an identity

Choose a name and ID for your distribution, and put it in `/etc/os-release`. Many tools read this file.

```bash
cat > /etc/os-release << "EOF"
NAME="MyDistro"
VERSION="1.0"
ID=mydistro
ID_LIKE=lfs
PRETTY_NAME="MyDistro 1.0"
VERSION_CODENAME="<codename>"
HOME_URL="https://example.com/"
EOF
```

> **Side note:** Also update `/etc/lsb-release` and `/etc/hostname`, and optionally create `/etc/issue` (the text shown above the login prompt). Don't present your distro as the official "Linux From Scratch." LFS is the method you used, not your product's name.

### 11.2 Add the software people expect (BLFS)

A good first set of BLFS packages for a usable base system:

| Need | BLFS packages to look for |
|---|---|
| Admin rights for normal users | `sudo` |
| HTTPS downloads and certificates | `make-ca` (with `p11-kit`), `curl` or `wget` |
| Remote login | `openssh` |
| Wi-Fi | `wpa_supplicant` or `iwd`, plus firmware from `linux-firmware` |
| Easier network setup | `NetworkManager` (optional) |
| Hardware support | `pciutils`, `usbutils`, firmware |
| Broad hardware support at boot | an **initramfs** (BLFS "About initramfs" page) |
| Desktop (optional) | Xorg or Wayland, then a desktop such as Xfce, KDE or GNOME |

> **Pro tip:** Install `make-ca` and `wget` early. Without trusted CA certificates, HTTPS downloads fail, and you'll have to download everything on the host and copy it over.

### 11.3 Add package management

Your users need a way to install, upgrade and remove software cleanly. The book's "Package Management" section (8.2) describes several approaches. The most practical one for a small distro is **"install into a staging directory, then package it"**:

```bash
./configure --prefix=/usr
make
make DESTDIR=/tmp/pkg-foo-1.0 install      # install into a staging area
tar -C /tmp/pkg-foo-1.0 -cJpf foo-1.0.pkg.tar.xz .   # this archive is your "package"
tar -C / -xpf foo-1.0.pkg.tar.xz                     # installing = extracting at /
```

> **Side note:** Real package managers add dependency tracking, file lists (for clean removal) and upgrade handling. Options range from simple file-tracking tools (for example `porg`) to full systems. As a Debian user, you already know `dpkg`/`apt` and `.deb` packages. Building `dpkg` for your LFS system is an advanced but popular project. None of these are in the LFS book, so plan on studying each tool's own documentation.

### 11.4 Make builds repeatable

A distribution has to be rebuilt for every new release and every security fix. Doing that by hand doesn't scale.

- **jhalfs (Automated LFS):** extracts the commands from the LFS/BLFS book XML and runs them as scripts. See https://www.linuxfromscratch.org/alfs/.
- **Your own scripts:** turn each package section of this guide into a script (`build-binutils-pass1.sh`, and so on) and keep them in Git.

### 11.5 Make it generic enough for other computers

Some of what you built is tuned to *your* machine:

- **GMP** optimizes itself for your CPU. For distribution, rebuild it with the book's generic option (`--host=none-linux-gnu`).
- **The kernel** only includes drivers for your hardware (or VM). For other machines, enable a much broader set of drivers as modules and add an **initramfs** (BLFS) so those modules can load at boot.
- **Machine identity:** every installation needs its own machine ID. Before packaging your system for others, empty it so each machine generates a new one on first boot: `echo uninitialized > /etc/machine-id`. Remove SSH host keys (if you installed OpenSSH) and your personal passwords and user accounts.

### 11.6 Ways to distribute your system

| Method | How it works | Difficulty |
|---|---|---|
| **Virtual disk image** | Build in a VM, clean it up (11.5), then share the disk file (`.qcow2`, `.vdi`, `.vmdk`, or raw `.img` via `qemu-img convert`) | Easiest |
| **Root filesystem tarball** | Users partition a disk, extract your tarball, edit `fstab`, and install GRUB (a manual install, done by hand) | Moderate |
| **Installable / live ISO** | A bootable ISO with an initramfs, a compressed root filesystem (squashfs) and an installer script. Built with `grub-mkrescue` and `xorriso` (BLFS `libisoburn`) | Advanced |

A root filesystem tarball can be created on the host from an **unmounted-from-chroot** LFS partition, leaving out the sources and the virtual filesystems:

```bash
cd $LFS
tar --exclude=./sources --exclude=./lost+found \
    --exclude=./dev/* --exclude=./proc/* --exclude=./sys/* --exclude=./run/* \
    -cJpf $HOME/mydistro-1.0-rootfs.tar.xz .
```

### 11.7 Licensing responsibilities

When you give other people binaries, you take on legal obligations. **This is general information, not legal advice.**

- Much of LFS is under the **GPL** or **LGPL**. If you distribute binaries, you must also provide the **corresponding source code** (or a written offer for it). Keep an archive of `$LFS/sources` (tarballs and patches) and your build scripts for **every** release you publish.
- Include each package's license files (usually `COPYING` or `LICENSE` in its source tree).
- The LFS **book text** is under a Creative Commons license. The **commands** in the book can be reused under the MIT license, so scripts based on them are fine to share.
- "Linux" is a registered trademark of Linus Torvalds. If you use "Linux" in your distro's *name*, read the Linux Foundation's trademark guidance.

### 11.8 Keep it secure

You are now the security team. Watch the LFS and BLFS security advisories (https://www.linuxfromscratch.org/advisories/), rebuild affected packages, and publish updates for your users.

---

## Appendix A — Resuming After a Reboot (Copy-and-Paste Checklist)

Use this whenever you come back to the build after a WSL restart, a Windows reboot, or in a new terminal. In WSL, the first step is always to **reattach the image**.

**If you're in Phases 1–3:**

```bash
sudo -i
echo $LFS                       # must print /mnt/lfs (set it in /root/.profile)
losetup -j /root/lfs-disk.img | grep -q . || losetup -fP /root/lfs-disk.img
mountpoint $LFS || mount -v UUID=<root-UUID> $LFS
```

**If you're in Phases 4–5:**

```bash
sudo -i
losetup -j /root/lfs-disk.img | grep -q . || losetup -fP /root/lfs-disk.img
mountpoint $LFS || mount -v UUID=<root-UUID> $LFS
su - lfs
echo $LFS $LFS_TGT              # /mnt/lfs x86_64-lfs-linux-gnu
```

**If you're in Phases 6–9:** save this script as `/root/lfs-enter.sh` in Debian, put your root partition's UUID on the `LFS_UUID=` line (from `/root/lfs-disk-ids.txt`), and run it as root with `bash /root/lfs-enter.sh`:

```bash
#!/bin/bash
# Reattaches the LFS image, mounts it + the virtual filesystems, then enters the chroot.
export LFS=/mnt/lfs
umask 022
IMG=/root/lfs-disk.img
LFS_UUID=<root-UUID>            # <-- the long UUID of loop0p3

losetup -j $IMG | grep -q . || losetup -fP $IMG
mountpoint -q $LFS         || mount -v UUID=$LFS_UUID $LFS
mountpoint -q $LFS/dev     || mount -v --bind /dev $LFS/dev
mountpoint -q $LFS/dev/pts || mount -vt devpts devpts -o gid=5,mode=0620 $LFS/dev/pts
mountpoint -q $LFS/proc    || mount -vt proc proc $LFS/proc
mountpoint -q $LFS/sys     || mount -vt sysfs sysfs $LFS/sys
mountpoint -q $LFS/run     || mount -vt tmpfs tmpfs $LFS/run
if [ -h $LFS/dev/shm ]; then
  install -v -d -m 1777 $LFS$(realpath /dev/shm)
else
  mountpoint -q $LFS/dev/shm || mount -vt tmpfs -o nosuid,nodev tmpfs $LFS/dev/shm
fi

chroot "$LFS" /usr/bin/env -i   \
    HOME=/root                  \
    TERM="$TERM"                \
    PS1='(lfs chroot) \u:\w\$ ' \
    PATH=/usr/bin:/usr/sbin     \
    MAKEFLAGS="-j$(nproc)"      \
    TESTSUITEFLAGS="-j$(nproc)" \
    /bin/bash --login
```

> **Side note:** The mount commands and the `chroot` command are the same ones used in Phase 6. The script just checks what's already mounted first, so it's safe to run more than once.

> **Pro tip:** In Phase 7, keep a simple progress file on the LFS partition, for example `echo "done: gcc" >> /sources/PROGRESS`. After a break you'll know exactly where you stopped. If you're not sure whether the last package finished, delete its source directory and rebuild that package from the start.

## Appendix B — Troubleshooting Common Problems

| Symptom | Likely cause | Fix |
|---|---|---|
| `configure: error: C compiler cannot create executables` (Phases 4–5) | Not the `lfs` user, or the environment isn't loaded | `su - lfs`, then check `echo $LFS_TGT` and `which $LFS_TGT-gcc` |
| Files appeared in the host's `/usr` | `$LFS` was empty during an install | Stop. Check `/root/.profile` and restore from backup if needed. Always `echo $LFS` first |
| `chroot: failed to run command '/bin/bash': No such file or directory` | Phase 5 isn't finished, or the partition isn't mounted | Mount `$LFS`, then check `ls $LFS/usr/bin/bash` |
| Expect's PTY check doesn't print `ok`; many tests fail | `/dev/pts` isn't mounted | Remount the virtual filesystems (Appendix A) |
| A build fails randomly with `-j` | A parallel-build race | Rerun with `make -j1` |
| `No space left on device` | LFS partition is full | `df -h $LFS`. Delete old extracted source directories |
| Test failures | Some are expected | Compare with https://www.linuxfromscratch.org/lfs/build-logs/13.1/ |
| Kernel panic: `VFS: Unable to mount root fs` | Wrong `root=` or disk driver not built in | Fix `root=PARTUUID=` in `grub.cfg`, and build the disk/filesystem drivers as `[*]` |
| Boot stops at the `grub>` prompt | GRUB can't find its files or config | At the prompt: `ls` to list disks, `search --fs-uuid --set=root <UUID>`, `configfile /boot/grub/grub.cfg` |
| No network after boot | `.network` file doesn't match the interface | `ip link` to see the name, edit `/etc/systemd/network/*.network`, then `systemctl restart systemd-networkd` |
| Version check: `sh is NOT Bash` or `awk is NOT GNU` | Debian defaults to dash and mawk | Apply the Debian fixes in Phase 1.2 |
| `mkfs`, `groupadd` or `sfdisk`: command not found | Not a root login shell, or `fdisk` package missing | `exit`, then `sudo -i`; `apt install fdisk` |
| `/mnt/lfs` is empty, or `chroot: failed to run command '/usr/bin/env'` | WSL restarted and the image is detached | Reattach and remount (Appendix A) |
| `lsblk` shows `loop0` but no `loop0p1`–`loop0p4` | Partitions weren't scanned | `partx -a /dev/loop0`, or detach and reattach with `losetup -fP` |
| `grub-install`: "failed to get canonical path of /dev/loop0p3" | `/dev` isn't bind-mounted in the chroot, or the loop number changed | Remount the virtual filesystems; check `losetup -a` |
| WSL shows mount errors at startup | LFS's fstab was written into Debian's `/etc/fstab` | Appendix D |
| Build stopped overnight | Windows Update restarted the PC, or WSL was shut down | Pause updates; resume with Appendix A and redo the interrupted package from a fresh extraction |
| Target PC doesn't list the USB drive, or says "no boot file found" | Old signatures on the USB drive, Fast Boot, or Secure Boot | Clean the drive with `diskpart` > `clean` before writing; turn off Fast Boot and Secure Boot; try another port |
| Clock skew warnings during build | The host clock changed | Harmless. Rerun `make` if a build stops |

> **Pro tip:** When asking for help (for example on the `lfs-support` mailing list or the IRC channel `#lfs-support` on irc.libera.chat), include the book version (13.1-systemd), your host (Debian version, with GCC and Binutils versions), the version-check output, the package and step, the **full** error message, and any changes you made.

## Appendix C — Quick Reference

| Item | Value |
|---|---|
| Book version | LFS 13.1-systemd (September 1, 2026) |
| Disk image | `/root/lfs-disk.img` (40 GB), attached as `/dev/loop0` |
| Partition IDs | `/root/lfs-disk-ids.txt` |
| Mount point | `/mnt/lfs` (`$LFS`) |
| Target triplet | `x86_64-lfs-linux-gnu` (`$LFS_TGT`) |
| Sources directory | `$LFS/sources` on the host, `/sources` in the chroot |
| Key versions | Linux 7.1.8, GCC 16.2.0, Glibc 2.44, Binutils 2.47, Systemd 261.2, GRUB 2.14 |
| Build user | `lfs` (Phases 4–5 only) |
| Test user | `tester` (Phases 6–7, deleted afterward) |
| Official book | https://www.linuxfromscratch.org/lfs/downloads/stable-systemd/LFS-BOOK-13.1-NOCHUNKS.html |
| Errata | https://www.linuxfromscratch.org/lfs/errata/13.1-systemd/ |
| Next steps | https://www.linuxfromscratch.org/blfs/ |

## Appendix D — Fixing WSL After an fstab Mix-up

If an LFS `cat > /etc/fstab` command was run in a Debian window instead of the chroot, it replaces WSL Debian's own `/etc/fstab`. WSL then shows mount errors each time it starts, and some paths may be missing. Debian's files are fine; only that one text file is wrong.

1. Open Debian and check the file: `cat /etc/fstab`. If it shows LFS lines (UUIDs, `/boot/efi`, `swap`), that's the problem.
2. If you saved the original (see the tip below), restore it:
   ```bash
   sudo cp -v /root/fstab.debian-original /etc/fstab
   ```
   Otherwise, put back WSL Debian's default, which is just a comment:
   ```bash
   echo "# UNCONFIGURED FSTAB FOR BASE SYSTEM" | sudo tee /etc/fstab
   ```
3. In PowerShell, run `wsl --shutdown`, then reopen Debian. The errors should be gone.

> **Pro tip:** Before starting LFS, save WSL Debian's fstab: `sudo cp -v /etc/fstab /root/fstab.debian-original`.

## Appendix E — Growing LFS to Fill the USB Drive

The image was 40 GB, so on a larger USB drive the rest of the space is unused. You can grow the LFS root partition **from LFS itself**, after it has booted from the USB drive. Do this only after LFS boots and works.

> **Warning:** Partition changes can destroy data if mistyped. Keep your backup image (`lfs-disk-v1.img` in WSL), and double-check every disk name.

1. Find the USB drive's name in LFS (as root):
   ```bash
   lsblk -o NAME,SIZE,PARTLABEL
   ```
   It's the disk with the `EFI`, `BIOS boot`, `lfs` and `swap` partitions, for example `sda`. Below it's written as `sdX`.
2. Move the GPT backup copy to the real end of the drive:
   ```bash
   sfdisk --relocate gpt-bak-std /dev/sdX
   ```
3. Remove the swap partition (it's in the way), grow partition 3, and recreate swap at the end. This example leaves 4 GiB for swap. Replace `<size>` with the drive size in GiB minus about 5, for example `220GiB` on a 232 GB drive:
   ```bash
   swapoff -a
   sfdisk --delete /dev/sdX 4
   echo ",<size>" | sfdisk -N 3 --no-reread --force /dev/sdX
   echo ",,S"     | sfdisk -N 4 --no-reread --force /dev/sdX
   partx -u /dev/sdX
   ```
4. Grow the filesystem. ext4 can do this while mounted:
   ```bash
   resize2fs /dev/sdX3
   df -h /
   ```
5. Set up the new swap partition, and put its **new** UUID into `/etc/fstab`:
   ```bash
   mkswap /dev/sdX4
   blkid /dev/sdX4
   ```
   Edit the swap line in `/etc/fstab` with the new UUID, then run `swapon -a` and check with `swapon --show`.

> **Side note:** The root partition's UUID and PARTUUID don't change when it grows, so `fstab`'s root line and `grub.cfg` stay valid. Only the swap UUID changes, because swap was recreated.

---

*Credits: This guide follows **Linux From Scratch, Version 13.1-systemd**, created by Gerard Beekmans (managing editor Bruce Dubbs) and the LFS team. Commands are taken from the book under the MIT License; the LFS book text itself is under a Creative Commons license. The explanations, notes, tips and Debian/WSL-specific guidance in this guide are original. Please support the project at https://www.linuxfromscratch.org/.*
