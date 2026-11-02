# LFS 13.1-systemd — Step Checklist (Debian Host)

A compact progress tracker for the *LFS 13.1-systemd Companion Guide (Debian Host Edition)*. It lists every step in order, with **no commands**. Use the guide (or the full command checklist) for the commands, and tick each step here when it finishes without errors.

- Steps marked *Option*, *Optional*, *Situational* or *Test suite* may not apply to you. Tick them anyway (or write "skipped") so your place stays clear.
- Phases 4–5 run as the **lfs** user, Phases 6–9 **inside the chroot**, everything else as **root on Debian**.

## Where I Left Off

| Date | Last completed step | Notes |
|---|---|---|
| | | |
| | | |
| | | |

## My LFS Disk

| Partition | Use | ID |
|---|---|---|
| `sda1` | EFI System (FAT32) | `UUID=33D7-AA12` |
| `sda3` | LFS root (ext4) | `UUID=fbbd561f-b13c-4f67-abeb-c663d89a578d` |
| `sda3` | LFS root, for the kernel line | `PARTUUID=d220fcd1-5dad-45bb-9058-09ec13a2a6bb` |
| `sda4` | Swap | `UUID=73d316c7-9d43-4bf7-a3a2-accb75b232c0` |

---

## Phase 0 — Build Inside a Virtual Machine (Optional but Recommended)

*Optional: set up a Debian VM with a second disk for LFS, snapshots and boot testing.*

### 0.1 Check that your CPU supports virtualization
- [ ] grep -Ec '(vmx|svm)' /proc/cpuinfo

### 0.2 Install QEMU/KVM and virt-manager on the physical computer
- [ ] apt install qemu-system-x86 qemu-utils virt-manager…

### 0.3 Create the build VM

### 0.4 Snapshots: your safety net
- [ ] Take a snapshot at every checkpoint

### 0.5 VM-specific notes for later phases

### 0.6 Boot-test the LFS disk in its own VM

### 0.7 Turn the VM disk into a distributable image
- [ ] Convert the LFS disk to a raw image
- [ ] Write it to a USB drive for a real-hardware test

## Phase 1 — Prepare the Host (Book Chapter 2)

*Prepare Debian: install build tools, apply the three Debian fixes, pass the version check, partition, format and mount the LFS disk. Runs as root on Debian.*

### 1.1 Update the host and install the build requirements
- [ ] Open a terminal and become root with a login shell
- [ ] Update the system and install everything LFS expects on the host

### 1.2 Run the host version check
- [ ] Create version-check.sh
- [ ] Fix sh is NOT Bash
- [ ] Fix awk is NOT GNU
- [ ] Fix yacc is NOT Bison
- [ ] If no yacc alternative exists at all, create a small wrapper instead

### 1.3 Understand "building in stages" (read before you start)

### 1.4 Create partitions for LFS
- [ ] First, identify your disks
- [ ] Find out whether your machine boots with UEFI or legacy BIOS
- [ ] First, wipe every old signature from the disk
- [ ] Option B — one command

### 1.5 Create the filesystems
- [ ] Format the LFS root partition as ext4
- [ ] If you created a new swap partition, initialize it
- [ ] If you created an EFI System Partition, format it as FAT32

### 1.6 Set the `LFS` variable and the umask
- [ ] LFS is the most important variable in the whole build
- [ ] umask 022
- [ ] Check both values
- [ ] Append to /root/.profile

### 1.7 Mount the new partition
- [ ] mkdir -pv $LFS
- [ ] Set the owner and permissions of the LFS root directory
- [ ] Check that it isn't mounted with restrictive options
- [ ] If you created swap, turn it on

## Phase 2 — Download Packages and Patches (Book Chapter 3)

*Download every package and patch into $LFS/sources and verify the checksums. Runs as root on Debian.*

### 2.1 Create the sources directory
- [ ] As root, with LFS set
- [ ] chmod -v a+wt $LFS/sources

### 2.2 Download everything
- [ ] cd $LFS/sources
- [ ] wget --input-file=wget-list-systemd --continue…

### 2.3 Verify the downloads
- [ ] pushd $LFS/sources
- [ ] Because you downloaded as root, the files already belong to root

### 2.4 Check the errata and security advisories

## Phase 3 — Final Preparations (Book Chapter 4)

*Create the directory layout and the lfs build user, and set up its clean build environment.*

### 3.1 Create a minimal directory layout
- [ ] As root, with LFS set
- [ ] Create the directory that will hold the cross-compiler

### 3.2 Add the unprivileged `lfs` user
- [ ] Building as an ordinary user means a typo can't wreck your host
- [ ] Optionally set a password: passwd lfs
- [ ] Give lfs ownership of the LFS directories

### 3.3 Move Debian's global bashrc out of the way
- [ ] Run the shell loop/check block

### 3.4 Switch to the `lfs` user
- [ ] su - lfs

### 3.5 Set up the `lfs` user's environment
- [ ] As lfs, create .bash_profile
- [ ] Create .bashrc
- [ ] Use all your CPU cores for building
- [ ] Load the new environment

### 3.6 About SBUs and test suites

## Phase 4 — Build the Cross-Toolchain (Book Chapter 5)

*Build the cross-compiler (Binutils, GCC, Linux headers, Glibc, Libstdc++) in $LFS/tools. Runs as the lfs user. No test suites.*

### 4.0 The package routine (read this once, then repeat it for every package)

### Binutils-2.47 — Pass 1
<sub>Book §5.2 · 1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ../configure
- [ ] make
- [ ] make install
- [ ] Clean up

### GCC-16.2.0 — Pass 1
<sub>Book §5.3 · 4.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] Create architecture-specific symlinks
- [ ] mkdir -v build
- [ ] ../configure
- [ ] make
- [ ] make install
- [ ] Create the complete limits.h header
- [ ] Clean up

### Linux-7.1.8 API Headers
<sub>Book §5.4 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make headers
- [ ] Clean up

### Glibc-2.44
<sub>Book §5.5 · 1.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] Apply patch glibc-fhs-1.patch
- [ ] Apply patch glibc-2.44-upstream_fixes-1.patch
- [ ] mkdir -v build
- [ ] echo … (write a setting)
- [ ] ../configure
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] sed edit ($LFS/usr/bin/ldd)
- [ ] Test suite: echo … (write a setting)
- [ ] grep -E -o "$LFS/lib.*/S?crt[1in].*succeeded" dummy.log
- [ ] grep -B3 "^ $LFS/usr/include" dummy.log
- [ ] grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'
- [ ] grep "/lib.*/libc.so.6 " dummy.log
- [ ] grep found dummy.log
- [ ] Remove unneeded files
- [ ] Clean up

### Libstdc++ from GCC-16.2.0
<sub>Book §5.6 · 0.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Remove unneeded files
- [ ] Clean up

## Phase 5 — Cross-Compile the Temporary Tools (Book Chapter 6)

*Cross-compile the basic temporary tools into $LFS. Runs as the lfs user.*

### M4-1.4.21
<sub>Book §6.2 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Ncurses-6.6
<sub>Book §6.3 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Bash-5.3
<sub>Book §6.4 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] ln -sv bash $LFS/bin/sh
- [ ] Clean up

### Coreutils-9.11
<sub>Book §6.5 · 0.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Move files ($LFS/usr/sbin)
- [ ] Clean up

### Diffutils-3.12
<sub>Book §6.6 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### File-5.48
<sub>Book §6.7 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make FILE_COMPILE=$(pwd)/build/src/file
- [ ] make DESTDIR=$LFS install
- [ ] Remove unneeded files
- [ ] Clean up

### Findutils-4.11.0
<sub>Book §6.8 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Gawk-5.4.1
<sub>Book §6.9 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Grep-3.12
<sub>Book §6.10 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Gzip-1.14
<sub>Book §6.11 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Make-4.4.1
<sub>Book §6.12 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Patch-2.8
<sub>Book §6.13 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Sed-4.10
<sub>Book §6.14 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Tar-1.35
<sub>Book §6.15 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Clean up

### Xz-5.8.3
<sub>Book §6.16 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Remove unneeded files
- [ ] Clean up

### Binutils-2.47 — Pass 2
<sub>Book §6.17 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] mkdir -v build
- [ ] ../configure
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] Remove unneeded files
- [ ] Clean up

### GCC-16.2.0 — Pass 2
<sub>Book §6.18 · 5.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] Create architecture-specific symlinks
- [ ] mkdir -v build
- [ ] ../configure
- [ ] make
- [ ] make DESTDIR=$LFS install
- [ ] ln -sv gcc $LFS/usr/bin/cc
- [ ] Clean up

## Phase 6 — Enter the Chroot and Build More Temporary Tools (Book Chapter 7)

*Hand ownership to root, mount the virtual filesystems, enter the chroot, create the system files, build extra temporary tools, clean up and back up.*

### 6.1 Become root again and hand ownership to root
- [ ] Leave the lfs user's shell
- [ ] Check that $LFS is still set (echo $LFS)
- [ ] Hand the files back to root
- [ ] You can now restore the host's global bashrc if you want to

### 6.2 Mount the virtual kernel filesystems
- [ ] mkdir -pv $LFS/{dev,proc,sys,run}
- [ ] Bind-mount the host's /dev so the chroot can see devices
- [ ] Mount the other virtual filesystems
- [ ] Handle shared memory

### 6.3 Enter the chroot
- [ ] Enter the chroot

### 6.4 Create the full directory tree
- [ ] mkdir -pv /{boot,home,mnt,opt,srv}
- [ ] mkdir -pv /etc/{opt,sysconfig}

### 6.5 Create essential files and users
- [ ] Create the mounted-filesystems link
- [ ] Create a basic /etc/hosts
- [ ] Create the user list, including the system accounts that systemd needs
- [ ] Create the group list
- [ ] Add a temporary unprivileged tester user
- [ ] Start a new shell so the prompt picks up the new user name
- [ ] Create log files that login, agetty and init expect

### 6.6 Build the additional temporary tools

### Gettext-1.0
<sub>Book §7.7 · 1.5 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] cp -v gettext-tools/src/{msgfmt,msgmerge,xgettext} /usr/bin
- [ ] Clean up

### Bison-3.8.2
<sub>Book §7.8 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make install
- [ ] Clean up

### Perl-5.44.0
<sub>Book §7.9 · 0.6 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make install
- [ ] Clean up

### Zlib-1.3.2
<sub>Book §7.10 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make install
- [ ] Remove unneeded files
- [ ] Clean up

### mpdecimal-4.0.1
<sub>Book §7.11 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make install
- [ ] Clean up

### Python-3.14.7
<sub>Book §7.12 · 0.5 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make install
- [ ] Clean up

### Texinfo-7.3
<sub>Book §7.13 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make install
- [ ] Clean up

### Util-linux-2.42.2
<sub>Book §7.14 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] make install
- [ ] Clean up

### 6.7 Clean up and make a backup
- [ ] Remove documentation and libtool files you don't need
- [ ] Remove unneeded files
- [ ] Remove the cross-toolchain, which is no longer needed
- [ ] To make a backup, leave the chroot
- [ ] mountpoint -q $LFS/dev/shm && umount $LFS/dev/shm
- [ ] Create the backup archive

## Phase 7 — Build the Final LFS System (Book Chapter 8)

*Build the ~80 packages of the final system inside the chroot, with test suites. The longest phase.*

### Man-pages-6.18
<sub>Book §8.3 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make -R GIT=false prefix=/usr install
- [ ] Clean up

### Iana-Etc-20260805
<sub>Book §8.4 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] Clean up

### Glibc-2.44
<sub>Book §8.5 · 11 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] Apply patch glibc-2.44-upstream_fixes-1.patch
- [ ] mkdir -v build
- [ ] ../configure
- [ ] make
- [ ] Test suite: make check
- [ ] grep "Timed out" $(find -name \*.out)
- [ ] Continue with the installation: touch /etc/ld.so.conf
- [ ] sed edit (../Makefile)
- [ ] make install
- [ ] sed edit (/usr/bin/ldd)
- [ ] Option A — install the recommended set of locales
- [ ] Option B — install every supported locale instead
- [ ] Then continue: Create /etc/nsswitch.conf
- [ ] tar -xf ../../tzdata2026c.tar.gz
- [ ] Helper: find the correct name for your time zone: tzselect
- [ ] Set the local time zone: ln -sfv /usr/share/zoneinfo/<xxx> /etc/localtime
- [ ] Then continue: Create /etc/ld.so.conf
- [ ] Optional: Append to /etc/ld.so.conf
- [ ] Clean up

### Zlib-1.3.2
<sub>Book §8.6 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Remove unneeded files
- [ ] Clean up

### Bzip2-1.0.8
<sub>Book §8.7 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] sed edit (Makefile)
- [ ] sed edit (Makefile)
- [ ] make -f Makefile-libbz2_so
- [ ] make
- [ ] make PREFIX=/usr install
- [ ] cp -av libbz2.so.* /usr/lib
- [ ] ln -sfv libbz2.so.1.0.8 /usr/lib/libbz2.so.1
- [ ] cp -v bzip2-shared /usr/bin/bzip2
- [ ] Remove unneeded files
- [ ] Clean up

### Xz-5.8.3
<sub>Book §8.8 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Lz4-1.10.0
<sub>Book §8.9 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] Test suite: make -j1 check
- [ ] Continue with the installation: make BUILD_STATIC=no PREFIX=/usr install
- [ ] Clean up

### Zstd-1.5.7
<sub>Book §8.10 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] Test suite: make check
- [ ] Continue with the installation: make prefix=/usr install
- [ ] Remove unneeded files
- [ ] Clean up

### File-5.48
<sub>Book §8.11 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Readline-8.3
<sub>Book §8.12 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] sed edit (support/shobj-conf)
- [ ] sed edit
- [ ] ./configure
- [ ] make SHLIB_LIBS="-lncursesw"
- [ ] make install
- [ ] install -v -m644 doc/*.{ps,pdf,html,dvi}…
- [ ] Clean up

### Pcre2-10.47
<sub>Book §8.13 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### M4-1.4.21
<sub>Book §8.14 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Bc-7.0.3
<sub>Book §8.15 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make test
- [ ] Continue with the installation: make install
- [ ] Clean up

### Flex-2.6.4
<sub>Book §8.16 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Create symlinks
- [ ] Clean up

### Tcl-8.6.18
<sub>Book §8.17 · 2.9 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: LC_ALL=C.UTF-8 make test
- [ ] Continue with the installation: make install
- [ ] chmod -v u+w /usr/lib/libtcl8.6.so
- [ ] make install-private-headers
- [ ] ln -sfv tclsh8.6 /usr/bin/tclsh
- [ ] Move files (/usr/share/man/man3/{Thread,Tcl_Thread}.3)
- [ ] cd ..
- [ ] Clean up

### Expect-5.45.4
<sub>Book §8.18 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Required check: python3 -c 'from pty import spawn; spawn(["echo", "ok"])'
- [ ] Then continue: Apply patch expect-5.45.4-gcc15-1.patch
- [ ] ./configure
- [ ] make
- [ ] Test suite: make test
- [ ] Continue with the installation: make install
- [ ] Clean up

### DejaGNU-1.6.3
<sub>Book §8.19 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ../configure
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Ninja-1.13.2
<sub>Book §8.20 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] sed edit (Guess/a)
- [ ] python3 configure.py --bootstrap --verbose
- [ ] install -vm755 ninja /usr/bin/
- [ ] Clean up

### Pkgconf-3.0.5
<sub>Book §8.21 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] mkdir build
- [ ] ninja
- [ ] Test suite: ninja test
- [ ] Continue with the installation: ninja install
- [ ] Create symlinks
- [ ] Clean up

### Binutils-2.47
<sub>Book §8.22 · 1.7 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ../configure
- [ ] make tooldir=/usr
- [ ] Test suite: make -k check
- [ ] grep '^FAIL:' $(find -name '*.log')
- [ ] Continue with the installation: make tooldir=/usr install
- [ ] Remove unneeded files
- [ ] Clean up

### GMP-6.3.0
<sub>Book §8.23 · 0.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] Test suite: make check
- [ ] Combine files with cat
- [ ] Continue with the installation: make install
- [ ] Clean up

### MPFR-4.2.2
<sub>Book §8.24 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### MPC-1.4.1
<sub>Book §8.25 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Attr-2.6.0
<sub>Book §8.26 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Acl-2.4.0
<sub>Book §8.27 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Libcap-2.78
<sub>Book §8.28 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make prefix=/usr lib=lib
- [ ] Test suite: make test
- [ ] Continue with the installation: make prefix=/usr lib=lib install
- [ ] Clean up

### Libxcrypt-4.5.2
<sub>Book §8.29 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Optional — skip unless you must run old binary-only programs: make distclean
- [ ] Clean up

### Shadow-4.20.2
<sub>Book §8.30 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] sed edit (YESCRYPT:')
- [ ] touch /usr/bin/passwd
- [ ] make
- [ ] make exec_prefix=/usr install
- [ ] pwconv
- [ ] grpconv
- [ ] mkdir -p /etc/default
- [ ] sed edit (/etc/default/useradd)
- [ ] touch /etc/sub{u,g}id
- [ ] Required: set the root password: passwd root
- [ ] Clean up

### Gawk-5.4.1
<sub>Book §8.31 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] Test suite: chown -R tester .
- [ ] Continue with the installation: Remove unneeded files
- [ ] ln -sv gawk.1 /usr/share/man/man1/awk.1
- [ ] install -vDm644 doc/{awkforai.txt,*.{eps,pdf,jpg}} -t…
- [ ] Clean up

### GCC-16.2.0
<sub>Book §8.32 · 53 SBU (with tests)</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] mkdir -v build
- [ ] ../configure
- [ ] make
- [ ] Test suite: ulimit -s -H unlimited
- [ ] chown -R tester .
- [ ] ../contrib/test_summary -t
- [ ] Continue with the installation: make install
- [ ] chown -v -R root:root $(gcc…
- [ ] ln -svr /usr/bin/cpp /usr/lib
- [ ] ln -sv gcc.1 /usr/share/man/man1/cc.1
- [ ] Create symlinks
- [ ] Test suite: echo … (write a setting)
- [ ] grep -E -o '/usr/lib.*/S?crt[1in].*succeeded' dummy.log
- [ ] grep -B4 '^ /usr/include' dummy.log
- [ ] grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'
- [ ] grep "/lib.*/libc.so.6 " dummy.log
- [ ] grep found dummy.log
- [ ] Remove unneeded files
- [ ] Continue with the installation: mkdir -pv /usr/share/gdb/auto-load/usr/lib
- [ ] Clean up

### Ncurses-6.6
<sub>Book §8.33 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make DESTDIR=$PWD/dest install
- [ ] Run the shell loop/check block
- [ ] ln -sfv libncursesw.so /usr/lib/libcurses.so
- [ ] cp -v -R doc -T /usr/share/doc/ncurses-6.6
- [ ] Optional — skip unless you need old binary-only programs: make distclean
- [ ] Clean up

### Sed-4.10
<sub>Book §8.34 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: chown -R tester .
- [ ] Continue with the installation: make install
- [ ] Clean up

### Psmisc-23.7
<sub>Book §8.35 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Gettext-1.0
<sub>Book §8.36 · 2.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Bison-3.8.2
<sub>Book §8.37 · 2.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Grep-3.12
<sub>Book §8.38 · 0.5 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Bash-5.3
<sub>Book §8.39 · 1.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: chown -R tester .
- [ ] LC_ALL=C.UTF-8 su -s /usr/bin/expect tester << "EOF"
- [ ] Continue with the installation: make install
- [ ] Required: exec /usr/bin/bash --login
- [ ] Clean up

### Libtool-2.6.2
<sub>Book §8.40 · 0.6 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Remove unneeded files
- [ ] Clean up

### GDBM-1.26
<sub>Book §8.41 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Gperf-3.3
<sub>Book §8.42 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Expat-2.8.3
<sub>Book §8.43 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] install -v -m644 doc/*.{html,css} /usr/share/doc/expat-2.8.3
- [ ] Clean up

### Inetutils-2.8
<sub>Book §8.44 · 0.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Move files (/usr/{,s}bin/ifconfig)
- [ ] Clean up

### Less-704
<sub>Book §8.45 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Perl-5.44.0
<sub>Book §8.46 · 1.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] sh Configure -des
- [ ] make
- [ ] TEST_JOBS=$(nproc) make test_harness
- [ ] make install
- [ ] Clean up

### Autoconf-2.73
<sub>Book §8.47 · less than 0.1 SBU (about 0.4 SBU with tests)</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Automake-1.18.1
<sub>Book §8.48 · less than 0.1 SBU (about 1.1 SBU with tests)</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make -j$(($(nproc)>4?$(nproc):4)) check
- [ ] Continue with the installation: make install
- [ ] Clean up

### OpenSSL-4.0.1
<sub>Book §8.49 · 1.9 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make test
- [ ] Continue with the installation: make INSTALL_LIBS= MANSUFFIX=ssl install
- [ ] Move files (/usr/share/doc/openssl-4.0.1)
- [ ] cp -vfr doc/* /usr/share/doc/openssl-4.0.1
- [ ] Clean up

### Libelf from Elfutils-0.195
<sub>Book §8.50 · 0.3 SBU</sub>

- [ ] Unpack the package
- [ ] Test suite: ./configure
- [ ] Continue with the installation: make -C lib
- [ ] Test suite: make -k check
- [ ] Continue with the installation: make -C libelf install
- [ ] Clean up

### Libffi-3.8.0
<sub>Book §8.51 · 1.7 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Sqlite-3530400
<sub>Book §8.52 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make LDFLAGS.rpath=""
- [ ] make install
- [ ] cp -v -R sqlite-doc-3530400 -T /usr/share/doc/sqlite-3.53.4
- [ ] Clean up

### mpdecimal-4.0.1
<sub>Book §8.53 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make check_local
- [ ] make install
- [ ] Clean up

### Python-3.14.7
<sub>Book §8.54 · 2.7 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] Test suite: make test TESTOPTS="--timeout 120"
- [ ] Continue with the installation: make install
- [ ] Create /etc/pip.conf
- [ ] install -v -dm755 /usr/share/doc/python-3.14.7/html
- [ ] Clean up

### Flit-Core-4.0.2
<sub>Book §8.55 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] pip3 install --no-index --find-links dist flit_core
- [ ] Clean up

### Packaging-26.3
<sub>Book §8.56 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] pip3 install --no-index --find-links dist packaging
- [ ] Clean up

### Wheel-0.48.0
<sub>Book §8.57 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] pip3 install --no-index --find-links dist wheel
- [ ] Clean up

### Setuptools-84.0.0
<sub>Book §8.58 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] pip3 install --no-index --find-links dist setuptools
- [ ] Clean up

### Meson-1.12.0
<sub>Book §8.59 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] pip3 install --no-index --find-links dist meson
- [ ] Clean up

### Kmod-34.2
<sub>Book §8.60 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ninja
- [ ] ninja install
- [ ] Clean up

### Coreutils-9.11
<sub>Book §8.61 · 1.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] autoreconf -fv
- [ ] make
- [ ] Test suite: make NON_ROOT_USERNAME=tester check-root
- [ ] groupadd -g 102 dummy -U tester
- [ ] chown -R tester .
- [ ] su tester -c "PATH=$PATH make -k RUN_EXPENSIVE_TESTS=yes…
- [ ] groupdel dummy
- [ ] Continue with the installation: make install
- [ ] Move files (/usr/sbin)
- [ ] Clean up

### Diffutils-3.12
<sub>Book §8.62 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Findutils-4.11.0
<sub>Book §8.63 · 0.9 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: chown -R tester .
- [ ] Continue with the installation: make install
- [ ] Clean up

### Groff-1.24.1
<sub>Book §8.64 · 0.6 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make -j1
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### GRUB-2.14
- [ ] GRUB can be built for BIOS, 64-bit UEFI, and 32-bit UEFI
- [ ] unset {C,CPP,CXX,LD}FLAGS
- [ ] sed edit (configure)
- [ ] GRUB for BIOS
- [ ] make
- [ ] make install
- [ ] GRUB for 64-bit UEFI
- [ ] make
- [ ] make install
- [ ] GRUB for 32-bit UEFI
- [ ] make
- [ ] make install
- [ ] Clean up

### Gzip-1.14
<sub>Book §8.66 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### IPRoute2-7.1.0
<sub>Book §8.67 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make NETNS_RUN_DIR=/run/netns
- [ ] make SBINDIR=/usr/sbin install
- [ ] install -vDm644 COPYING README* -t…
- [ ] Clean up

### Kbd-2.10.0
<sub>Book §8.68 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] sed edit (configure)
- [ ] ./configure
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] cp -R -v docs/doc -T /usr/share/doc/kbd-2.10.0
- [ ] Clean up

### Libpipeline-1.5.8
<sub>Book §8.69 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] make install
- [ ] Clean up

### Make-4.4.1
<sub>Book §8.70 · 0.6 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: chown -R tester .
- [ ] Continue with the installation: make install
- [ ] Clean up

### Patch-2.8
<sub>Book §8.71 · 0.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Tar-1.35
<sub>Book §8.72 · 0.5 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] FORCE_UNSAFE_CONFIGURE=1
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Texinfo-7.3
<sub>Book §8.73 · 0.4 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] make TEXMF=/usr/share/texmf install-tex
- [ ] Clean up

### Vim-9.2.1025
<sub>Book §8.74 · 3.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ./configure
- [ ] make
- [ ] Test suite: chown -R tester .
- [ ] su tester -c "TERM=xterm-256color LANG=en_US.UTF-8 make…
- [ ] Continue with the installation: make install
- [ ] ln -sv vim /usr/bin/vi
- [ ] ln -sv ../vim/vim92/doc /usr/share/doc/vim-9.2.1025
- [ ] Create /etc/vimrc
- [ ] Clean up

### MarkupSafe-3.0.3
<sub>Book §8.75 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] pip3 install --no-index --find-links dist Markupsafe
- [ ] Clean up

### Jinja2-3.1.6
<sub>Book §8.76 · less than 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] pip3 install --no-index --find-links dist Jinja2
- [ ] Clean up

### Systemd-261.2
<sub>Book §8.77 · 1.2 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] mkdir -p build
- [ ] ninja
- [ ] Test suite: echo … (write a setting)
- [ ] Continue with the installation: ninja install
- [ ] tar -xf ../../systemd-man-pages-261.2.tar.xz
- [ ] systemd-machine-id-setup
- [ ] systemctl preset-all
- [ ] Clean up

### D-Bus-1.16.2
<sub>Book §8.78 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ninja
- [ ] Test suite: ninja test
- [ ] Continue with the installation: ninja install
- [ ] ln -sfv /etc/machine-id /var/lib/dbus
- [ ] Clean up

### Man-DB-2.13.1
<sub>Book §8.79 · 0.3 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Clean up

### Procps-ng-4.0.7
<sub>Book §8.80 · 0.1 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: chown -R tester .
- [ ] Continue with the installation: make install
- [ ] Clean up

### Util-linux-2.42.2
<sub>Book §8.81 · 0.5 SBU</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] make
- [ ] Test suite: touch /etc/fstab
- [ ] Continue with the installation: make install
- [ ] Clean up

### E2fsprogs-1.47.4
<sub>Book §8.82 · 2.4 SBU on a spinning disk, 0.4 SBU on an SSD</sub>

- [ ] Unpack the package
- [ ] Build and install
- [ ] ../configure
- [ ] make
- [ ] Test suite: make check
- [ ] Continue with the installation: make install
- [ ] Remove unneeded files
- [ ] gunzip -v /usr/share/info/libext2fs.info.gz
- [ ] makeinfo -o      doc/com_err.info ../lib/et/com_err.texinfo
- [ ] sed edit (/etc/mke2fs.conf)
- [ ] Clean up

### Stripping Debugging Symbols (Optional)
- [ ] save_usrlib="$(cd /usr/lib; ls ld-linux*[^g])

### Cleaning Up
- [ ] Remove temporary files
- [ ] Remove libtool archive files
- [ ] Remove leftovers from the temporary cross-toolchain
- [ ] Remove the temporary tester user

## Phase 8 — Configure the System (Book Chapter 9)

*Configure networking, clock, console, locale and shell files. Inside the chroot.*

### 8.1 Networking
- [ ] Recommended for beginners: DHCP
- [ ] Alternative: static IP address
- [ ] Hostname: Give your system a name
- [ ] The hosts file (DHCP version)
- [ ] OR: /etc/hosts, static-IP version

### 8.2 Device management (udev)

### 8.3 System clock
- [ ] Create /etc/adjtime

### 8.4 Console keyboard and font (optional)
- [ ] With a US keyboard and the default font, you can skip this step

### 8.5 Locale (language settings)
- [ ] Choose your locale
- [ ] Create /etc/profile

### 8.6 The `/etc/inputrc` file
- [ ] Create /etc/inputrc

### 8.7 The `/etc/shells` file
- [ ] This file lists the valid login shells

### 8.8 Optional systemd tweaks
- [ ] Keep boot messages on screen, which is handy for troubleshooting
- [ ] Optional: limit crash-dump disk space

## Phase 9 — Make the System Bootable (Book Chapter 10)

*Create fstab, build the kernel, install GRUB (UEFI and BIOS) and write grub.cfg. Inside the chroot.*

### 9.1 Create `/etc/fstab`
- [ ] fstab, book's version (device names), OR the next step
- [ ] fstab, UUID version (recommended)
- [ ] If you use UEFI, also add the EFI System Partition
- [ ] Then create the mount point and mount the ESP inside the chroot

### 9.2 Build the Linux kernel
- [ ] Unpack the kernel source
- [ ] Make sure the source tree is completely clean
- [ ] make defconfig
- [ ] make kvm_guest.config (VM only; skip on real hardware)
- [ ] make menuconfig: required, UEFI, x2APIC and USB settings
- [ ] Save as .config and verify the settings with grep
- [ ] Compile the kernel
- [ ] Install the kernel modules
- [ ] Copy the kernel, its symbol map and its configuration to /boot
- [ ] cp -iv System.map /boot/System.map-7.1.8
- [ ] cp -iv .config /boot/config-7.1.8
- [ ] Optionally install the kernel documentation: cp -r Documentation -T /usr/share/doc/linux-7.1.8

### 9.3 Install GRUB and create its menu
- [ ] Option A — install GRUB for BIOS boot
- [ ] Option B — install GRUB for UEFI boot
- [ ] grub.cfg, book's version (fixed disk numbers), OR the next step
- [ ] grub.cfg, recommended UUID version with rootwait
- [ ] Option C — dual boot through Debian's GRUB (only if LFS stays inside the Debian machine)

## Phase 10 — The End and First Boot (Book Chapter 11)

*Create release files, leave the chroot, unmount everything and boot LFS.*

### 10.1 Create release files
- [ ] Create /etc/lfs-release
- [ ] Create /etc/lsb-release
- [ ] Create /etc/os-release

### 10.2 Final checklist before rebooting
- [ ] Root password set (passwd root, done in the Shadow step)
- [ ] /etc/fstab uses the correct UUIDs or partitions
- [ ] Kernel is in /boot, and grub.cfg points to it with the correct root=
- [ ] Temporary /etc/resolv.conf (if you created one) is deleted
- [ ] Disk and filesystem drivers are **built into** the kernel
- [ ] grub.cfg has rootwait if the LFS disk is USB
- [ ] /boot/efi/EFI/BOOT/BOOTX64.EFI exists (UEFI)
- [ ] Secure Boot is off
- [ ] You have a backup or VM snapshot

### 10.3 Leave the chroot and unmount everything
- [ ] logout
- [ ] Unmount the EFI partition (if mounted)
- [ ] umount -v $LFS/dev/pts
- [ ] umount -v $LFS
- [ ] Now reboot

### 10.4 First login and quick checks
- [ ] Log in as root and run the quick checks
- [ ] Create an everyday user account and don't work as root

## Phase 11 — From LFS to Your Own Distribution (Beyond the Book)

*Reference: turning LFS into IPRPS Linux. Tick only what you actually do.*

### 11.1 Give it an identity
- [ ] Create /etc/os-release

### 11.2 Add the software people expect (BLFS)

### 11.3 Add package management
- [ ] Your users need a way to install, upgrade and remove software cleanly

### 11.4 Make builds repeatable

### 11.5 Make it generic enough for other computers

### 11.6 Ways to distribute your system
- [ ] cd $LFS

### 11.7 Licensing responsibilities

### 11.8 Keep it secure

---

- [ ] **LFS boots on its own, and I can log in. Done!**
