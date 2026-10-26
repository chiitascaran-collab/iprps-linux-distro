# LFS 13.1-systemd — Build Checklist (Debian Host)

Every command from the *LFS 13.1-systemd Companion Guide (Debian Host Edition)*, in order, with a checkbox for each command block. Tick a box when that block has finished **without errors**. The last ticked box is where you stopped.

**How to use it**

- In VS Code, Obsidian, Typora or on GitHub you can tick boxes by clicking. In any plain text editor, change `- [ ]` to `- [x]`.
- The bold line above each block is the guide's own label. Labels such as *Option A / Option B*, *Optional*, *Situational* or *Test suite* mean that block may not apply to you. Tick it anyway (or add "skipped") so your place stays clear.
- Replace every `<placeholder>` with your own value before running.
- Commands under "Phases 4–5" run as the **`lfs`** user; "Phases 6–9" run **inside the chroot**; everything else runs as **root on Debian**. Check your prompt before every block.

## Where I Left Off

| Date | Last completed step | Notes |
|---|---|---|
| | | |
| | | |
| | | |

## My LFS Disk

The disk letter (`sda`) can change after a reboot or when other drives are plugged in. The IDs never change.

| Partition | Use | ID |
|---|---|---|
| `sda1` | EFI System (FAT32) | `UUID=33D7-AA12` |
| `sda3` | LFS root (ext4) | `UUID=fbbd561f-b13c-4f67-abeb-c663d89a578d` |
| `sda3` | LFS root, for the kernel line | `PARTUUID=d220fcd1-5dad-45bb-9058-09ec13a2a6bb` |
| `sda4` | Swap | `UUID=73d316c7-9d43-4bf7-a3a2-accb75b232c0` |

Saved copy on Debian: `/root/lfs-disk-ids.txt`

---

## Phase 0 — Build Inside a Virtual Machine (Optional but Recommended)

### 0.1 Check that your CPU supports virtualization

- [ ] **`grep -Ec '(vmx|svm)' /proc/cpuinfo`**

    ```bash
    grep -Ec '(vmx|svm)' /proc/cpuinfo
    ```

### 0.2 Install QEMU/KVM and virt-manager on the physical computer

- [ ] **QEMU/KVM is the fastest option on Linux, and virt-manager gives it a friendly graphical interface. Run these as root on the physical computer.**

    ```bash
    apt install qemu-system-x86 qemu-utils virt-manager libvirt-daemon-system ovmf
    adduser <yourname> libvirt
    ```

### 0.3 Create the build VM

### 0.4 Snapshots: your safety net

- [ ] **Take a snapshot at every checkpoint. The most important ones are after Phase 5, after the Phase 6 backup, and after Phase 7. The most reliable method works on any VM, including UEFI ones. Shut the VM down, then run…**

    ```bash
    qemu-img snapshot -c after-phase6 /var/lib/libvirt/images/lfs-builder-1.qcow2   # create
    qemu-img snapshot -l /var/lib/libvirt/images/lfs-builder-1.qcow2                # list
    qemu-img snapshot -a after-phase6 /var/lib/libvirt/images/lfs-builder-1.qcow2   # roll back
    ```

### 0.5 VM-specific notes for later phases

### 0.6 Boot-test the LFS disk in its own VM

### 0.7 Turn the VM disk into a distributable image

- [ ] **Convert the LFS disk to a raw image. People can boot that in their own VMs or write it to a USB drive to boot real hardware:**

    ```bash
    qemu-img convert -p -O raw /var/lib/libvirt/images/lfs-builder-1.qcow2 mydistro.img
    ```

- [ ] **Write it to a USB drive for a real-hardware test (replace `/dev/sdX` with the USB drive, and check it with `lsblk` first, because everything on that drive is erased):**

    ```bash
    dd if=mydistro.img of=/dev/sdX bs=4M status=progress conv=fsync
    ```

## Phase 1 — Prepare the Host (Book Chapter 2)

### 1.1 Update the host and install the build requirements

- [ ] **Open a terminal (or your SSH session) and become root with a login shell:**

    ```bash
    su -
    ```

- [ ] **Update the system and install everything LFS expects on the host:**

    ```bash
    apt update
    apt full-upgrade
    apt install build-essential bison gawk m4 texinfo perl python3 \
                patch xz-utils gzip tar wget dosfstools tmux
    ```

### 1.2 Run the host version check

- [ ] **If you already ran the OS check, run it once more after the package step above, because installing or updating packages can change the result. Save this script and run it as your normal user or as root:**

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

- [ ] **Fix `sh is NOT Bash`. Debian uses dash as `/bin/sh`. Point it at Bash, and tell the package system to leave that choice alone when dash is updated:**

    ```bash
    dpkg-divert --remove --no-rename /bin/sh
    ln -sfv bash /bin/sh
    dpkg-divert --add --local --no-rename /bin/sh
    ```

- [ ] **Fix `awk is NOT GNU`. Debian's default `awk` is mawk. Select gawk instead:**

    ```bash
    update-alternatives --set awk /usr/bin/gawk
    ```

- [ ] **Fix `yacc is NOT Bison`. First see what the alternatives system offers, then select Bison's version:**

    ```bash
    update-alternatives --display yacc
    update-alternatives --set yacc /usr/bin/bison.yacc
    ```

- [ ] **If no `yacc` alternative exists at all, create a small wrapper instead:**

    ```bash
    cat > /usr/bin/yacc << "EOF"
    #!/bin/sh
    exec /usr/bin/bison -y "$@"
    EOF
    chmod 755 /usr/bin/yacc
    ```

### 1.3 Understand "building in stages" (read before you start)

### 1.4 Create partitions for LFS

- [ ] **First, identify your disks:**

    ```bash
    lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS
    ```

- [ ] **Find out whether your machine boots with UEFI or legacy BIOS:**

    ```bash
    [ -d /sys/firmware/efi ] && echo "UEFI" || echo "BIOS"
    ```

- [ ] **First, wipe every old signature from the disk. USB sticks and SD cards that once held an installer image (Debian, Mint, Zorin, and so on) keep hidden leftovers, such as an old ISO filesystem signature or a hybrid…**

    ```bash
    lsblk -o NAME,SIZE,TRAN,MODEL      # be 100% sure which disk is the LFS disk
    wipefs --all /dev/sdX
    wipefs /dev/sdX                    # should print nothing
    ```

- [ ] **Option B — one command (creates the whole recommended layout; double-check the disk name first!):**

    ```bash
    sfdisk /dev/sdX << "EOF"
    label: gpt
    size=512MiB, type=U, name="EFI"
    size=1MiB,   type=21686148-6449-6E6F-744E-656564454649, name="BIOS boot"
    size=30GiB,  type=L, name="lfs"
    size=4GiB,   type=S, name="swap"
    EOF
    ```

### 1.5 Create the filesystems

- [ ] **Format the LFS root partition as ext4:**

    ```bash
    mkfs -v -t ext4 /dev/<xxx>
    ```

- [ ] **If you created a new swap partition, initialize it:**

    ```bash
    mkswap /dev/<yyy>
    ```

- [ ] **If you created an EFI System Partition, format it as FAT32 (replace the placeholder with your ESP name):**

    ```bash
    mkfs.fat -F 32 /dev/<yyy>
    ```

### 1.6 Set the `LFS` variable and the umask

- [ ] **`LFS` is the most important variable in the whole build. It holds the directory where the new system lives.**

    ```bash
    export LFS=/mnt/lfs
    ```

- [ ] **`umask 022`**

    ```bash
    umask 022
    ```

- [ ] **Check both values:**

    ```bash
    echo $LFS     # must print: /mnt/lfs
    umask         # must print: 0022
    ```

- [ ] **Make both settings permanent for root so a new root login shell always has them:**

    ```bash
    cat >> /root/.profile << "EOF"
    export LFS=/mnt/lfs
    umask 022
    EOF
    ```

### 1.7 Mount the new partition

- [ ] **`mkdir -pv $LFS`**

    ```bash
    mkdir -pv $LFS
    mount -v -t ext4 /dev/<xxx> $LFS
    ```

- [ ] **Set the owner and permissions of the LFS root directory:**

    ```bash
    chown root:root $LFS
    chmod 755 $LFS
    ```

- [ ] **Check that it isn't mounted with restrictive options:**

    ```bash
    findmnt $LFS     # the OPTIONS column must NOT contain nosuid or nodev
    ```

- [ ] **If you created swap, turn it on:**

    ```bash
    /sbin/swapon -v /dev/<zzz>
    ```

## Phase 2 — Download Packages and Patches (Book Chapter 3)

### 2.1 Create the sources directory

- [ ] **As root, with `LFS` set:**

    ```bash
    mkdir -v $LFS/sources
    ```

- [ ] **Make it writable by everyone but "sticky," so users can only delete their own files:**

    ```bash
    chmod -v a+wt $LFS/sources
    ```

### 2.2 Download everything

- [ ] **The LFS project publishes a ready-made download list (`wget-list-systemd`) and a checksum file (`md5sums`) next to the online book. Download both, then download all packages:**

    ```bash
    cd $LFS/sources
    wget https://www.linuxfromscratch.org/lfs/view/stable-systemd/wget-list-systemd
    wget https://www.linuxfromscratch.org/lfs/view/stable-systemd/md5sums
    ```

- [ ] **`wget --input-file=wget-list-systemd --continue --directory-prefix=$LFS/sources`**

    ```bash
    wget --input-file=wget-list-systemd --continue --directory-prefix=$LFS/sources
    ```

### 2.3 Verify the downloads

- [ ] **`pushd $LFS/sources`**

    ```bash
    pushd $LFS/sources
      md5sum -c md5sums
    popd
    ```

- [ ] **Because you downloaded as root, the files already belong to root. If you ever download as a normal user, fix the ownership:**

    ```bash
    chown root:root $LFS/sources/*
    ```

### 2.4 Check the errata and security advisories

## Phase 3 — Final Preparations (Book Chapter 4)

### 3.1 Create a minimal directory layout

- [ ] **As root, with `LFS` set:**

    ```bash
    mkdir -pv $LFS/{etc,var} $LFS/usr/{bin,lib,sbin}

    for i in bin lib sbin; do
      ln -sv usr/$i $LFS/$i
    done

    case $(uname -m) in
      x86_64) mkdir -pv $LFS/lib64 ;;
    esac
    ```

- [ ] **Create the directory that will hold the cross-compiler:**

    ```bash
    mkdir -pv $LFS/tools
    ```

### 3.2 Add the unprivileged `lfs` user

- [ ] **Building as an ordinary user means a typo can't wreck your host. As root:**

    ```bash
    groupadd lfs
    useradd -s /bin/bash -g lfs -m -k /dev/null lfs
    ```

- [ ] **Optionally set a password (only needed if you want to log in as `lfs` directly):**

    ```bash
    passwd lfs
    ```

- [ ] **Give `lfs` ownership of the LFS directories:**

    ```bash
    chown -v lfs $LFS/{usr{,/*},var,etc,tools}
    case $(uname -m) in
      x86_64) chown -v lfs $LFS/lib64 ;;
    esac
    ```

### 3.3 Move Debian's global bashrc out of the way

- [ ] **Debian ships `/etc/bash.bashrc`, which would "pollute" the clean build environment. As root:**

    ```bash
    [ ! -e /etc/bash.bashrc ] || mv -v /etc/bash.bashrc /etc/bash.bashrc.NOUSE
    ```

### 3.4 Switch to the `lfs` user

- [ ] **`su - lfs`**

    ```bash
    su - lfs
    ```

### 3.5 Set up the `lfs` user's environment

- [ ] **As `lfs`, create `.bash_profile`. It replaces the login shell with a new shell that has an almost empty environment:**

    ```bash
    cat > ~/.bash_profile << "EOF"
    exec env -i HOME=$HOME TERM=$TERM PS1='\u:\w\$ ' /bin/bash
    EOF
    ```

- [ ] **Create `.bashrc`. This is where the key build variables live:**

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

- [ ] **Use all your CPU cores for building:**

    ```bash
    cat >> ~/.bashrc << "EOF"
    export MAKEFLAGS=-j$(nproc)
    EOF
    ```

- [ ] **Load the new environment:**

    ```bash
    source ~/.bash_profile
    ```

### 3.6 About SBUs and test suites

## Phase 4 — Build the Cross-Toolchain (Book Chapter 5)

### 4.0 The package routine (read this once, then repeat it for every package)

### Binutils-2.47 — Pass 1

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf binutils-2.47.tar.xz
    cd binutils-2.47
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure --prefix=$LFS/tools`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf binutils-2.47
    ```

### GCC-16.2.0 — Pass 1

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf gcc-16.2.0.tar.xz
    cd gcc-16.2.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    tar -xf ../mpfr-4.2.2.tar.xz
    mv -v mpfr-4.2.2 mpfr
    tar -xf ../gmp-6.3.0.tar.xz
    mv -v gmp-6.3.0 gmp
    tar -xf ../mpc-1.4.1.tar.xz
    mv -v mpc-1.4.1 mpc
    ```

- [ ] **`case $(uname -m) in`**

    ```bash
    case $(uname -m) in
      x86_64)
        sed -e '/m64=/s/lib64/lib/' \
            -i.orig gcc/config/i386/t-linux64
     ;;
    esac
    ```

- [ ] **`mkdir -v build`**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **`cat ../gcc/{limitx,glimits,limity}.h >`**

    ```bash
    cat ../gcc/{limitx,glimits,limity}.h  > \
      $($LFS_TGT-gcc -print-file-name=include)/limits.h
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf gcc-16.2.0
    ```

### Linux-7.1.8 API Headers

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf linux-7.1.8.tar.xz
    cd linux-7.1.8
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    make mrproper
    ```

- [ ] **`make headers`**

    ```bash
    make headers
    find usr/include -type f ! -name '*.h' -delete

    cp -rv usr/include $LFS/usr
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf linux-7.1.8
    ```

### Glibc-2.44

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf glibc-2.44.tar.xz
    cd glibc-2.44
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    case $(uname -m) in
        i?86)   ln -sfv ld-linux.so.2 $LFS/lib/ld-lsb.so.3
        ;;
        x86_64) ln -sfv ../lib/ld-linux-x86-64.so.2 $LFS/lib64
                ln -sfv ../lib/ld-linux-x86-64.so.2 $LFS/lib64/ld-lsb-x86-64.so.3
        ;;
    esac
    ```

- [ ] **`patch -Np1 -i ../glibc-fhs-1.patch`**

    ```bash
    patch -Np1 -i ../glibc-fhs-1.patch
    ```

- [ ] **`patch -Np1 -i ../glibc-2.44-upstream_fixes-1.patch`**

    ```bash
    patch -Np1 -i ../glibc-2.44-upstream_fixes-1.patch
    ```

- [ ] **`mkdir -v build`**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`echo "rootsbindir=/usr/sbin" > configparms`**

    ```bash
    echo "rootsbindir=/usr/sbin" > configparms
    ```

- [ ] **`../configure`**

    ```bash
    ../configure                             \
          --prefix=/usr                      \
          --host=$LFS_TGT                    \
          --build=$(../scripts/config.guess) \
          --disable-nscd                     \
          libc_cv_slibdir=/usr/lib           \
          --enable-kernel=5.10
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`sed '/RTLDLIST=/s@/usr@@g' -i $LFS/usr/bin/ldd`**

    ```bash
    sed '/RTLDLIST=/s@/usr@@g' -i $LFS/usr/bin/ldd
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    echo 'int main(){}' | $LFS_TGT-gcc -x c - -v -Wl,--verbose &> dummy.log
    $LFS_TGT-readelf -l a.out | grep ': /lib'
    ```

- [ ] **`grep -E -o "$LFS/lib.*/S?crt[1in].*succeeded" dummy.log`**

    ```bash
    grep -E -o "$LFS/lib.*/S?crt[1in].*succeeded" dummy.log
    ```

- [ ] **`grep -B3 "^ $LFS/usr/include" dummy.log`**

    ```bash
    grep -B3 "^ $LFS/usr/include" dummy.log
    ```

- [ ] **`grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'`**

    ```bash
    grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'
    ```

- [ ] **`grep "/lib.*/libc.so.6 " dummy.log`**

    ```bash
    grep "/lib.*/libc.so.6 " dummy.log
    ```

- [ ] **`grep found dummy.log`**

    ```bash
    grep found dummy.log
    ```

- [ ] **`rm -v a.out dummy.log`**

    ```bash
    rm -v a.out dummy.log
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf glibc-2.44
    ```

### Libstdc++ from GCC-16.2.0

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf gcc-16.2.0.tar.xz
    cd gcc-16.2.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../libstdc++-v3/configure`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`rm -v $LFS/usr/lib/lib{stdc++{,exp,fs},supc++}.la`**

    ```bash
    rm -v $LFS/usr/lib/lib{stdc++{,exp,fs},supc++}.la
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf gcc-16.2.0
    ```

## Phase 5 — Cross-Compile the Temporary Tools (Book Chapter 6)

### M4-1.4.21

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf m4-1.4.21.tar.xz
    cd m4-1.4.21
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    cat > $LFS/usr/share/config.site << EOF
    ac_cv_func_posix_spawn_file_actions_addchdir=yes
    ac_cv_func_posix_spawn_file_actions_addfchdir=yes
    EOF
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                --build=$(build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf m4-1.4.21
    ```

### Ncurses-6.6

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf ncurses-6.6.tar.gz
    cd ncurses-6.6
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir build
    pushd build
      ../configure --prefix=$LFS/tools AWK=gawk
      make -C include
      make -C progs tic
      install progs/tic $LFS/tools/bin
    popd
    ```

- [ ] **`./configure --prefix=/usr`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ln -sv libncursesw.so $LFS/usr/lib/libncurses.so
    sed -e 's/^#if.*XOPEN.*$/#if 1/' \
        -i $LFS/usr/include/curses.h
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf ncurses-6.6
    ```

### Bash-5.3

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf bash-5.3.tar.gz
    cd bash-5.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr                      \
                --build=$(sh support/config.guess) \
                --host=$LFS_TGT                    \
                --without-bash-malloc              \
                --docdir=/usr/share/doc/bash-5.3
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`ln -sv bash $LFS/bin/sh`**

    ```bash
    ln -sv bash $LFS/bin/sh
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf bash-5.3
    ```

### Coreutils-9.11

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf coreutils-9.11.tar.xz
    cd coreutils-9.11
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr                     \
                --host=$LFS_TGT                   \
                --build=$(build-aux/config.guess) \
                --enable-install-program=hostname
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`mv -v $LFS/usr/bin/chroot $LFS/usr/sbin`**

    ```bash
    mv -v $LFS/usr/bin/chroot              $LFS/usr/sbin
    mkdir -pv $LFS/usr/share/man/man8
    mv -v $LFS/usr/share/man/man1/chroot.1 $LFS/usr/share/man/man8/chroot.8
    sed -i 's/"1"/"8"/'                    $LFS/usr/share/man/man8/chroot.8
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf coreutils-9.11
    ```

### Diffutils-3.12

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf diffutils-3.12.tar.xz
    cd diffutils-3.12
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                gl_cv_func_strcasecmp_works=yes \
                --build=$(./build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf diffutils-3.12
    ```

### File-5.48

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf file-5.48.tar.gz
    cd file-5.48
    ```

- [ ] **Build and install. Run each block in order:**

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

- [ ] **`./configure --prefix=/usr --host=$LFS_TGT --build=$(./config.guess)`**

    ```bash
    ./configure --prefix=/usr --host=$LFS_TGT --build=$(./config.guess)
    ```

- [ ] **`make FILE_COMPILE=$(pwd)/build/src/file`**

    ```bash
    make FILE_COMPILE=$(pwd)/build/src/file
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`rm -v $LFS/usr/lib/libmagic.la`**

    ```bash
    rm -v $LFS/usr/lib/libmagic.la
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf file-5.48
    ```

### Findutils-4.11.0

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf findutils-4.11.0.tar.xz
    cd findutils-4.11.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr                   \
                --localstatedir=/var/lib/locate \
                --host=$LFS_TGT                 \
                --build=$(build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf findutils-4.11.0
    ```

### Gawk-5.4.1

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf gawk-5.4.1.tar.xz
    cd gawk-5.4.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i 's/extras//' Makefile.in
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                --build=$(build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf gawk-5.4.1
    ```

### Grep-3.12

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf grep-3.12.tar.xz
    cd grep-3.12
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                --build=$(./build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf grep-3.12
    ```

### Gzip-1.14

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf gzip-1.14.tar.xz
    cd gzip-1.14
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr --host=$LFS_TGT
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf gzip-1.14
    ```

### Make-4.4.1

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf make-4.4.1.tar.gz
    cd make-4.4.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                --build=$(build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf make-4.4.1
    ```

### Patch-2.8

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf patch-2.8.tar.xz
    cd patch-2.8
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                --build=$(build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf patch-2.8
    ```

### Sed-4.10

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf sed-4.10.tar.xz
    cd sed-4.10
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                --build=$(./build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf sed-4.10
    ```

### Tar-1.35

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf tar-1.35.tar.xz
    cd tar-1.35
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr   \
                --host=$LFS_TGT \
                --build=$(build-aux/config.guess)
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf tar-1.35
    ```

### Xz-5.8.3

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf xz-5.8.3.tar.xz
    cd xz-5.8.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr                     \
                --host=$LFS_TGT                   \
                --build=$(build-aux/config.guess) \
                --disable-static                  \
                --docdir=/usr/share/doc/xz-5.8.3
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`rm -v $LFS/usr/lib/liblzma.la`**

    ```bash
    rm -v $LFS/usr/lib/liblzma.la
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf xz-5.8.3
    ```

### Binutils-2.47 — Pass 2

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf binutils-2.47.tar.xz
    cd binutils-2.47
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed '6031s/$add_dir//' -i ltmain.sh
    ```

- [ ] **`mkdir -v build`**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`rm -v $LFS/usr/lib/lib{bfd,ctf,ctf-nobfd,opcodes,sframe}.{a,la}`**

    ```bash
    rm -v $LFS/usr/lib/lib{bfd,ctf,ctf-nobfd,opcodes,sframe}.{a,la}
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf binutils-2.47
    ```

### GCC-16.2.0 — Pass 2

- [ ] **Unpack the package:**

    ```bash
    cd $LFS/sources
    tar -xf gcc-16.2.0.tar.xz
    cd gcc-16.2.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    tar -xf ../mpfr-4.2.2.tar.xz
    mv -v mpfr-4.2.2 mpfr
    tar -xf ../gmp-6.3.0.tar.xz
    mv -v gmp-6.3.0 gmp
    tar -xf ../mpc-1.4.1.tar.xz
    mv -v mpc-1.4.1 mpc
    ```

- [ ] **`case $(uname -m) in`**

    ```bash
    case $(uname -m) in
      x86_64)
        sed -e '/m64=/s/lib64/lib/' \
            -i.orig gcc/config/i386/t-linux64
      ;;
    esac
    ```

- [ ] **`mkdir -v build`**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$LFS install`**

    ```bash
    make DESTDIR=$LFS install
    ```

- [ ] **`ln -sv gcc $LFS/usr/bin/cc`**

    ```bash
    ln -sv gcc $LFS/usr/bin/cc
    ```

- [ ] **Clean up:**

    ```bash
    cd $LFS/sources
    rm -rf gcc-16.2.0
    ```

## Phase 6 — Enter the Chroot and Build More Temporary Tools (Book Chapter 7)

### 6.1 Become root again and hand ownership to root

- [ ] **Leave the `lfs` user's shell:**

    ```bash
    exit
    ```

- [ ] **You're now back in your root shell on the host. From this phase on, every command runs as root. Check that `LFS` is still set:**

    ```bash
    echo $LFS    # must print /mnt/lfs
    ```

- [ ] **Hand the files back to root. In the finished system, the `lfs` user won't exist, so its files shouldn't belong to it:**

    ```bash
    chown --from lfs -R root:root $LFS/{usr,var,etc,tools}
    case $(uname -m) in
      x86_64) chown --from lfs -R root:root $LFS/lib64 ;;
    esac
    ```

- [ ] **You can now restore the host's global bashrc if you want to:**

    ```bash
    [ -e /etc/bash.bashrc.NOUSE ] && mv -v /etc/bash.bashrc.NOUSE /etc/bash.bashrc
    ```

### 6.2 Mount the virtual kernel filesystems

- [ ] **Programs inside the chroot need `/dev`, `/proc`, `/sys` and `/run`, just like a running system. Create the mount points:**

    ```bash
    mkdir -pv $LFS/{dev,proc,sys,run}
    ```

- [ ] **Bind-mount the host's `/dev` so the chroot can see devices:**

    ```bash
    mount -v --bind /dev $LFS/dev
    ```

- [ ] **Mount the other virtual filesystems:**

    ```bash
    mount -vt devpts devpts -o gid=5,mode=0620 $LFS/dev/pts
    mount -vt proc proc $LFS/proc
    mount -vt sysfs sysfs $LFS/sys
    mount -vt tmpfs tmpfs $LFS/run
    ```

- [ ] **Handle shared memory (`/dev/shm`):**

    ```bash
    if [ -h $LFS/dev/shm ]; then
      install -v -d -m 1777 $LFS$(realpath /dev/shm)
    else
      mount -vt tmpfs -o nosuid,nodev tmpfs $LFS/dev/shm
    fi
    ```

### 6.3 Enter the chroot

- [ ] **`chroot "$LFS" /usr/bin/env -i`**

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

### 6.4 Create the full directory tree

- [ ] **`mkdir -pv /{boot,home,mnt,opt,srv}`**

    ```bash
    mkdir -pv /{boot,home,mnt,opt,srv}
    ```

- [ ] **`mkdir -pv /etc/{opt,sysconfig}`**

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

### 6.5 Create essential files and users

- [ ] **Create the mounted-filesystems link:**

    ```bash
    ln -sv /proc/self/mounts /etc/mtab
    ```

- [ ] **Create a basic `/etc/hosts`:**

    ```bash
    cat > /etc/hosts << EOF
    127.0.0.1  localhost $(hostname)
    ::1        localhost
    EOF
    ```

- [ ] **Create the user list, including the system accounts that systemd needs:**

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

- [ ] **Create the group list:**

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

- [ ] **Add a temporary unprivileged `tester` user. Some test suites refuse to run as root. You'll delete this user at the end of Phase 7.**

    ```bash
    echo "tester:x:101:101::/home/tester:/bin/bash" >> /etc/passwd
    echo "tester:x:101:" >> /etc/group
    install -o tester -d /home/tester
    ```

- [ ] **Start a new shell so the prompt picks up the new user name ("I have no name!" goes away):**

    ```bash
    exec /usr/bin/bash --login
    ```

- [ ] **Create log files that `login`, `agetty` and `init` expect:**

    ```bash
    touch /var/log/{btmp,lastlog,faillog,wtmp}
    chgrp -v utmp /var/log/lastlog
    chmod -v 664  /var/log/lastlog
    chmod -v 600  /var/log/btmp
    ```

### 6.6 Build the additional temporary tools

### Gettext-1.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gettext-1.0.tar.xz
    cd gettext-1.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --disable-shared
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`cp -v gettext-tools/src/{msgfmt,msgmerge,xgettext} /usr/bin`**

    ```bash
    cp -v gettext-tools/src/{msgfmt,msgmerge,xgettext} /usr/bin
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gettext-1.0
    ```

### Bison-3.8.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf bison-3.8.2.tar.xz
    cd bison-3.8.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr \
                --docdir=/usr/share/doc/bison-3.8.2
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf bison-3.8.2
    ```

### Perl-5.44.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf perl-5.44.0.tar.xz
    cd perl-5.44.0
    ```

- [ ] **Build and install. Run each block in order:**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf perl-5.44.0
    ```

### Zlib-1.3.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf zlib-1.3.2.tar.gz
    cd zlib-1.3.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **`rm -fv /usr/lib/libz.a`**

    ```bash
    rm -fv /usr/lib/libz.a
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf zlib-1.3.2
    ```

### mpdecimal-4.0.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf mpdecimal-4.0.1.tar.gz
    cd mpdecimal-4.0.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/mpdecimal-4.0.1
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf mpdecimal-4.0.1
    ```

### Python-3.14.7

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf Python-3.14.7.tar.xz
    cd Python-3.14.7
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr       \
                --enable-shared     \
                --without-ensurepip \
                --without-static-libpython
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf Python-3.14.7
    ```

### Texinfo-7.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf texinfo-7.3.tar.xz
    cd texinfo-7.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf texinfo-7.3
    ```

### Util-linux-2.42.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf util-linux-2.42.2.tar.xz
    cd util-linux-2.42.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir -pv /var/lib/hwclock
    ```

- [ ] **`./configure --libdir=/usr/lib`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf util-linux-2.42.2
    ```

### 6.7 Clean up and make a backup

- [ ] **Remove documentation and libtool files you don't need:**

    ```bash
    rm -rf /usr/share/{info,man,doc}/*
    ```

- [ ] **`find /usr/{lib,libexec} -name \*.la -delete`**

    ```bash
    find /usr/{lib,libexec} -name \*.la -delete
    ```

- [ ] **Remove the cross-toolchain, which is no longer needed:**

    ```bash
    rm -rf /tools
    ```

- [ ] **To make a backup, leave the chroot:**

    ```bash
    exit
    ```

- [ ] **On the host, as root, check that `LFS` is set and unmount the virtual filesystems:**

    ```bash
    mountpoint -q $LFS/dev/shm && umount $LFS/dev/shm
    umount $LFS/dev/pts
    umount $LFS/{sys,proc,run,dev}
    ```

- [ ] **Create the backup archive (about 1 GB; make sure you have space in `$HOME`):**

    ```bash
    cd $LFS
    tar -cJpf $HOME/lfs-temp-tools-13.1-systemd.tar.xz .
    ```

## Phase 7 — Build the Final LFS System (Book Chapter 8)

### Man-pages-6.18

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf man-pages-6.18.tar.xz
    cd man-pages-6.18
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    rm -v man3/crypt*
    ```

- [ ] **`make -R GIT=false prefix=/usr install`**

    ```bash
    make -R GIT=false prefix=/usr install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf man-pages-6.18
    ```

### Iana-Etc-20260805

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf iana-etc-20260805.tar.gz
    cd iana-etc-20260805
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    cp -v services protocols /etc
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf iana-etc-20260805
    ```

### Glibc-2.44

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf glibc-2.44.tar.xz
    cd glibc-2.44
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    patch -Np1 -i ../glibc-fhs-1.patch
    ```

- [ ] **`patch -Np1 -i ../glibc-2.44-upstream_fixes-1.patch`**

    ```bash
    patch -Np1 -i ../glibc-2.44-upstream_fixes-1.patch
    ```

- [ ] **`mkdir -v build`**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure --prefix=/usr`**

    ```bash
    ../configure --prefix=/usr                   \
                 --disable-werror                \
                 --disable-nscd                  \
                 libc_cv_slibdir=/usr/lib        \
                 --enable-stack-protector=strong \
                 --enable-kernel=5.10
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (critical, do not skip):**

    ```bash
    make check
    ```

- [ ] **`grep "Timed out" $(find -name \*.out)`**

    ```bash
    grep "Timed out" $(find -name \*.out)
    ```

- [ ] **Continue with the installation:**

    ```bash
    touch /etc/ld.so.conf
    ```

- [ ] **`sed '/test-installation/s@$(PERL)@echo not running@' -i ../Makefile`**

    ```bash
    sed '/test-installation/s@$(PERL)@echo not running@' -i ../Makefile
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **`sed '/RTLDLIST=/s@/usr@@g' -i /usr/bin/ldd`**

    ```bash
    sed '/RTLDLIST=/s@/usr@@g' -i /usr/bin/ldd
    ```

- [ ] **Option A — install the recommended set of locales (quick, and enough for the test suites):**

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

- [ ] **Option B — install every supported locale instead (slow). Choose A or B:**

    ```bash
    make localedata/install-locales
    ```

- [ ] **Then continue:**

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

- [ ] **`tar -xf ../../tzdata2026c.tar.gz`**

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

- [ ] **Helper (interactive): find the correct name for your time zone:**

    ```bash
    tzselect
    ```

- [ ] **Set the local time zone. Replace `<xxx>` with your zone, for example `America/New_York`:**

    ```bash
    ln -sfv /usr/share/zoneinfo/<xxx> /etc/localtime
    ```

- [ ] **Then continue:**

    ```bash
    cat > /etc/ld.so.conf << "EOF"
    # Begin /etc/ld.so.conf
    /usr/local/lib
    /opt/lib

    EOF
    ```

- [ ] **Optional: allow extra library-path files in `/etc/ld.so.conf.d`:**

    ```bash
    cat >> /etc/ld.so.conf << "EOF"
    # Add an include directory
    include /etc/ld.so.conf.d/*.conf

    EOF
    mkdir -pv /etc/ld.so.conf.d
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf glibc-2.44
    ```

### Zlib-1.3.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf zlib-1.3.2.tar.gz
    cd zlib-1.3.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`rm -fv /usr/lib/libz.a`**

    ```bash
    rm -fv /usr/lib/libz.a
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf zlib-1.3.2
    ```

### Bzip2-1.0.8

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf bzip2-1.0.8.tar.gz
    cd bzip2-1.0.8
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    patch -Np1 -i ../bzip2-1.0.8-install_docs-1.patch
    ```

- [ ] **`sed -i 's@\(ln -s -f \)$(PREFIX)/bin/@\1@' Makefile`**

    ```bash
    sed -i 's@\(ln -s -f \)$(PREFIX)/bin/@\1@' Makefile
    ```

- [ ] **`sed -i "s@(PREFIX)/man@(PREFIX)/share/man@g" Makefile`**

    ```bash
    sed -i "s@(PREFIX)/man@(PREFIX)/share/man@g" Makefile
    ```

- [ ] **`make -f Makefile-libbz2_so`**

    ```bash
    make -f Makefile-libbz2_so
    make clean
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make PREFIX=/usr install`**

    ```bash
    make PREFIX=/usr install
    ```

- [ ] **`cp -av libbz2.so.* /usr/lib`**

    ```bash
    cp -av libbz2.so.* /usr/lib
    ln -sfv libbz2.so.1.0.8 /usr/lib/libbz2.so
    ```

- [ ] **`ln -sfv libbz2.so.1.0.8 /usr/lib/libbz2.so.1`**

    ```bash
    ln -sfv libbz2.so.1.0.8 /usr/lib/libbz2.so.1
    ```

- [ ] **`cp -v bzip2-shared /usr/bin/bzip2`**

    ```bash
    cp -v bzip2-shared /usr/bin/bzip2
    for i in /usr/bin/{bzcat,bunzip2}; do
      ln -sfv bzip2 $i
    done
    ```

- [ ] **`rm -fv /usr/lib/libbz2.a`**

    ```bash
    rm -fv /usr/lib/libbz2.a
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf bzip2-1.0.8
    ```

### Xz-5.8.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf xz-5.8.3.tar.xz
    cd xz-5.8.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/xz-5.8.3
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf xz-5.8.3
    ```

### Lz4-1.10.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf lz4-1.10.0.tar.gz
    cd lz4-1.10.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    make BUILD_STATIC=no PREFIX=/usr
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make -j1 check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make BUILD_STATIC=no PREFIX=/usr install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf lz4-1.10.0
    ```

### Zstd-1.5.7

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf zstd-1.5.7.tar.gz
    cd zstd-1.5.7
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    make prefix=/usr
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make prefix=/usr install
    ```

- [ ] **`rm -v /usr/lib/libzstd.a`**

    ```bash
    rm -v /usr/lib/libzstd.a
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf zstd-1.5.7
    ```

### File-5.48

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf file-5.48.tar.gz
    cd file-5.48
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf file-5.48
    ```

### Readline-8.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf readline-8.3.tar.gz
    cd readline-8.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i '/MV.*old/d' Makefile.in
    sed -i '/{OLDSUFF}/c:' support/shlib-install
    ```

- [ ] **`sed -i 's/-Wl,-rpath,[^ ]*//' support/shobj-conf`**

    ```bash
    sed -i 's/-Wl,-rpath,[^ ]*//' support/shobj-conf
    ```

- [ ] **`sed -e '270a`**

    ```bash
    sed -e '270a\
         else\
           chars_avail = 1;'      \
        -e '288i\   result = -1;' \
        -i.orig input.c
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --with-curses    \
                --docdir=/usr/share/doc/readline-8.3
    ```

- [ ] **`make SHLIB_LIBS="-lncursesw"`**

    ```bash
    make SHLIB_LIBS="-lncursesw"
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **`install -v -m644 doc/*.{ps,pdf,html,dvi} /usr/share/doc/readline-8.3`**

    ```bash
    install -v -m644 doc/*.{ps,pdf,html,dvi} /usr/share/doc/readline-8.3
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf readline-8.3
    ```

### Pcre2-10.47

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf pcre2-10.47.tar.bz2
    cd pcre2-10.47
    ```

- [ ] **Build and install. Run each block in order:**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf pcre2-10.47
    ```

### M4-1.4.21

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf m4-1.4.21.tar.xz
    cd m4-1.4.21
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf m4-1.4.21
    ```

### Bc-7.0.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf bc-7.0.3.tar.xz
    cd bc-7.0.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    CC='gcc -std=c99' ./configure --prefix=/usr -G -O3 -r
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make test
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf bc-7.0.3
    ```

### Flex-2.6.4

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf flex-2.6.4.tar.gz
    cd flex-2.6.4
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/flex-2.6.4
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`ln -sv flex /usr/bin/lex`**

    ```bash
    ln -sv flex   /usr/bin/lex
    ln -sv flex.1 /usr/share/man/man1/lex.1
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf flex-2.6.4
    ```

### Tcl-8.6.18

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf tcl8.6.18-src.tar.gz
    cd tcl8.6.18
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    SRCDIR=$(pwd)
    cd unix
    ./configure --prefix=/usr           \
                --mandir=/usr/share/man \
                --disable-rpath
    ```

- [ ] **`make`**

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

- [ ] **Test suite (recommended, but optional):**

    ```bash
    LC_ALL=C.UTF-8 make test
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install 
    chmod 644 /usr/lib/libtclstub8.6.a
    ```

- [ ] **`chmod -v u+w /usr/lib/libtcl8.6.so`**

    ```bash
    chmod -v u+w /usr/lib/libtcl8.6.so
    ```

- [ ] **`make install-private-headers`**

    ```bash
    make install-private-headers
    ```

- [ ] **`ln -sfv tclsh8.6 /usr/bin/tclsh`**

    ```bash
    ln -sfv tclsh8.6 /usr/bin/tclsh
    ```

- [ ] **`mv -v /usr/share/man/man3/{Thread,Tcl_Thread}.3`**

    ```bash
    mv -v /usr/share/man/man3/{Thread,Tcl_Thread}.3
    ```

- [ ] **`cd ..`**

    ```bash
    cd ..
    tar -xf ../tcl8.6.18-html.tar.gz --strip-components=1
    mkdir -v -p /usr/share/doc/tcl-8.6.18
    cp -v -r  ./html/* /usr/share/doc/tcl-8.6.18
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf tcl8.6.18
    ```

### Expect-5.45.4

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf expect5.45.4.tar.gz
    cd expect5.45.4
    ```

- [ ] **Required check: confirm pseudo-terminals work in the chroot (must print `ok`):**

    ```bash
    python3 -c 'from pty import spawn; spawn(["echo", "ok"])'
    ```

- [ ] **Then continue:**

    ```bash
    patch -Np1 -i ../expect-5.45.4-gcc15-1.patch
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr           \
                --with-tcl=/usr/lib     \
                --enable-shared         \
                --disable-rpath         \
                --mandir=/usr/share/man \
                --with-tclinclude=/usr/include
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make test
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ln -svf expect5.45.4/libexpect5.45.4.so /usr/lib
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf expect5.45.4
    ```

### DejaGNU-1.6.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf dejagnu-1.6.3.tar.gz
    cd dejagnu-1.6.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure --prefix=/usr`**

    ```bash
    ../configure --prefix=/usr
    makeinfo --html --no-split -o doc/dejagnu.html ../doc/dejagnu.texi
    makeinfo --plaintext       -o doc/dejagnu.txt  ../doc/dejagnu.texi
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    install -v -dm755  /usr/share/doc/dejagnu-1.6.3
    install -v -m644   doc/dejagnu.{html,txt} /usr/share/doc/dejagnu-1.6.3
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf dejagnu-1.6.3
    ```

### Ninja-1.13.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf ninja-1.13.2.tar.gz
    cd ninja-1.13.2
    ```

- [ ] **`sed -i '/int Guess/a`**

    ```bash
    sed -i '/int Guess/a \
      int   j = 0;\
      char* jobs = getenv( "NINJAJOBS" );\
      if ( jobs != NULL ) j = atoi( jobs );\
      if ( j > 0 ) return j;\
    ' src/ninja.cc
    ```

- [ ] **`python3 configure.py --bootstrap --verbose`**

    ```bash
    python3 configure.py --bootstrap --verbose
    ```

- [ ] **`install -vm755 ninja /usr/bin/`**

    ```bash
    install -vm755 ninja /usr/bin/
    install -vDm644 misc/bash-completion /usr/share/bash-completion/completions/ninja
    install -vDm644 misc/zsh-completion  /usr/share/zsh/site-functions/_ninja
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf ninja-1.13.2
    ```

### Pkgconf-3.0.5

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf pkgconf-3.0.5.tar.xz
    cd pkgconf-3.0.5
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    tar -xf ../meson-1.12.0.tar.gz
    ```

- [ ] **`mkdir build`**

    ```bash
    mkdir build
    cd    build

    python3 ../meson-1.12.0/meson.py setup --prefix=/usr --buildtype=release ..
    ```

- [ ] **`ninja`**

    ```bash
    ninja
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    ninja test
    ```

- [ ] **Continue with the installation:**

    ```bash
    ninja install
    mv /usr/share/doc/pkgconf{,-3.0.5}
    ```

- [ ] **`ln -sv pkgconf /usr/bin/pkg-config`**

    ```bash
    ln -sv pkgconf   /usr/bin/pkg-config
    ln -sv pkgconf.1 /usr/share/man/man1/pkg-config.1
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf pkgconf-3.0.5
    ```

### Binutils-2.47

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf binutils-2.47.tar.xz
    cd binutils-2.47
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure --prefix=/usr`**

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

- [ ] **`make tooldir=/usr`**

    ```bash
    make tooldir=/usr
    ```

- [ ] **Test suite (critical, do not skip):**

    ```bash
    make -k check
    ```

- [ ] **`grep '^FAIL:' $(find -name '*.log')`**

    ```bash
    grep '^FAIL:' $(find -name '*.log')
    ```

- [ ] **Continue with the installation:**

    ```bash
    make tooldir=/usr install
    ```

- [ ] **`rm -rfv /usr/lib/lib{bfd,ctf,ctf-nobfd,gprofng,opcodes,sframe}.a`**

    ```bash
    rm -rfv /usr/lib/lib{bfd,ctf,ctf-nobfd,gprofng,opcodes,sframe}.a \
            /usr/share/doc/gprofng/
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf binutils-2.47
    ```

### GMP-6.3.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gmp-6.3.0.tar.xz
    cd gmp-6.3.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i '/long long t1;/,+1s/()/(...)/' configure
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr    \
                --enable-cxx     \
                --disable-static \
                --docdir=/usr/share/doc/gmp-6.3.0
    ```

- [ ] **`make`**

    ```bash
    make
    make html
    ```

- [ ] **Test suite (critical, do not skip):**

    ```bash
    make check
    ```

- [ ] **`cat $(find -name '*.log') | grep -c ^PASS`**

    ```bash
    cat $(find -name '*.log') | grep -c ^PASS
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    make install-html
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gmp-6.3.0
    ```

### MPFR-4.2.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf mpfr-4.2.2.tar.xz
    cd mpfr-4.2.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr        \
                --disable-static     \
                --enable-thread-safe \
                --docdir=/usr/share/doc/mpfr-4.2.2
    ```

- [ ] **`make`**

    ```bash
    make
    make html
    ```

- [ ] **Test suite (critical, do not skip):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    make install-html
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf mpfr-4.2.2
    ```

### MPC-1.4.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf mpc-1.4.1.tar.xz
    cd mpc-1.4.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/mpc-1.4.1
    ```

- [ ] **`make`**

    ```bash
    make
    make html
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    make install-html
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf mpc-1.4.1
    ```

### Attr-2.6.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf attr-2.6.0.tar.gz
    cd attr-2.6.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr     \
                --disable-static  \
                --sysconfdir=/etc \
                --docdir=/usr/share/doc/attr-2.6.0
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf attr-2.6.0
    ```

### Acl-2.4.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf acl-2.4.0.tar.xz
    cd acl-2.4.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/acl-2.4.0
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf acl-2.4.0
    ```

### Libcap-2.78

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf libcap-2.78.tar.xz
    cd libcap-2.78
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i '/install -m.*STA/d' libcap/Makefile
    ```

- [ ] **`make prefix=/usr lib=lib`**

    ```bash
    make prefix=/usr lib=lib
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make test
    ```

- [ ] **Continue with the installation:**

    ```bash
    make prefix=/usr lib=lib install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf libcap-2.78
    ```

### Libxcrypt-4.5.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf libxcrypt-4.5.2.tar.xz
    cd libxcrypt-4.5.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i '/strchr/s/const//' lib/crypt-{sm3,gost}-yescrypt.c
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr                \
                --enable-hashes=strong,glibc \
                --enable-obsolete-api=no     \
                --disable-static             \
                --disable-failure-tokens
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Optional — skip unless you must run old binary-only programs. Builds the legacy `libcrypt.so.1`:**

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

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf libxcrypt-4.5.2
    ```

### Shadow-4.20.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf shadow-4.20.2.tar.xz
    cd shadow-4.20.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    find man -name Makefile.in -exec sed -i 's/getspnam\.3 / /' {} \;
    find man -name Makefile.in -exec sed -i 's/passwd\.5 / /'   {} \;
    ```

- [ ] **`sed -e 's:#ENCRYPT_METHOD SHA512:ENCRYPT_METHOD YESCRYPT:'`**

    ```bash
    sed -e 's:#ENCRYPT_METHOD SHA512:ENCRYPT_METHOD YESCRYPT:' \
        -e 's:/var/spool/mail:/var/mail:'                      \
        -e '/PATH=/{s@/sbin:@@;s@/bin:@@}'                     \
        -i etc/login.defs
    ```

- [ ] **`touch /usr/bin/passwd`**

    ```bash
    touch /usr/bin/passwd
    ./configure --sysconfdir=/etc   \
                --disable-static    \
                --with-{b,yes}crypt \
                --without-libbsd    \
                --disable-logind    \
                --with-group-name-max-length=32
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make exec_prefix=/usr install`**

    ```bash
    make exec_prefix=/usr install
    make -C man install-man
    ```

- [ ] **`pwconv`**

    ```bash
    pwconv
    ```

- [ ] **`grpconv`**

    ```bash
    grpconv
    ```

- [ ] **`mkdir -p /etc/default`**

    ```bash
    mkdir -p /etc/default
    useradd -D --gid 999
    ```

- [ ] **`sed -i '/MAIL/s/yes/no/' /etc/default/useradd`**

    ```bash
    sed -i '/MAIL/s/yes/no/' /etc/default/useradd
    ```

- [ ] **`touch /etc/sub{u,g}id`**

    ```bash
    touch /etc/sub{u,g}id
    ```

- [ ] **Required: set the root password. You will need it to log in on first boot:**

    ```bash
    passwd root
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf shadow-4.20.2
    ```

### Gawk-5.4.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gawk-5.4.1.tar.xz
    cd gawk-5.4.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i 's/extras//' Makefile.in
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    chown -R tester .
    su tester -c "PATH=$PATH make check"
    ```

- [ ] **Continue with the installation:**

    ```bash
    rm -f /usr/bin/gawk-5.4.1
    make install
    ```

- [ ] **`ln -sv gawk.1 /usr/share/man/man1/awk.1`**

    ```bash
    ln -sv gawk.1 /usr/share/man/man1/awk.1
    ```

- [ ] **`install -vDm644 doc/{awkforai.txt,*.{eps,pdf,jpg}} -t /usr/share/doc/gawk-5.4.1`**

    ```bash
    install -vDm644 doc/{awkforai.txt,*.{eps,pdf,jpg}} -t /usr/share/doc/gawk-5.4.1
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gawk-5.4.1
    ```

### GCC-16.2.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gcc-16.2.0.tar.xz
    cd gcc-16.2.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    case $(uname -m) in
      x86_64)
        sed -e '/m64=/s/lib64/lib/' \
            -i.orig gcc/config/i386/t-linux64
      ;;
    esac
    ```

- [ ] **`mkdir -v build`**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure --prefix=/usr`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (critical, do not skip):**

    ```bash
    ulimit -s -H unlimited
    ```

- [ ] **`chown -R tester .`**

    ```bash
    chown -R tester .
    su tester -c "PATH=$PATH make -k check"
    ```

- [ ] **`../contrib/test_summary -t`**

    ```bash
    ../contrib/test_summary -t
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`chown -v -R root:root $(gcc -print-file-name=include){,-fixed}`**

    ```bash
    chown -v -R root:root $(gcc -print-file-name=include){,-fixed}
    ```

- [ ] **`ln -svr /usr/bin/cpp /usr/lib`**

    ```bash
    ln -svr /usr/bin/cpp /usr/lib
    ```

- [ ] **`ln -sv gcc.1 /usr/share/man/man1/cc.1`**

    ```bash
    ln -sv gcc.1 /usr/share/man/man1/cc.1
    ```

- [ ] **`ln -sfvr $(gcc -print-prog-name=liblto_plugin.so) /usr/lib/bfd-plugins/`**

    ```bash
    ln -sfvr $(gcc -print-prog-name=liblto_plugin.so) /usr/lib/bfd-plugins/
    ```

- [ ] **Test suite (critical, do not skip):**

    ```bash
    echo 'int main(){}' | cc -x c - -v -Wl,--verbose &> dummy.log
    readelf -l a.out | grep ': /lib'
    ```

- [ ] **`grep -E -o '/usr/lib.*/S?crt[1in].*succeeded' dummy.log`**

    ```bash
    grep -E -o '/usr/lib.*/S?crt[1in].*succeeded' dummy.log
    ```

- [ ] **`grep -B4 '^ /usr/include' dummy.log`**

    ```bash
    grep -B4 '^ /usr/include' dummy.log
    ```

- [ ] **`grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'`**

    ```bash
    grep 'SEARCH.*/usr/lib' dummy.log |sed 's|; |\n|g'
    ```

- [ ] **`grep "/lib.*/libc.so.6 " dummy.log`**

    ```bash
    grep "/lib.*/libc.so.6 " dummy.log
    ```

- [ ] **`grep found dummy.log`**

    ```bash
    grep found dummy.log
    ```

- [ ] **`rm -v a.out dummy.log`**

    ```bash
    rm -v a.out dummy.log
    ```

- [ ] **Continue with the installation:**

    ```bash
    mkdir -pv /usr/share/gdb/auto-load/usr/lib
    mv -v /usr/lib/*gdb.py /usr/share/gdb/auto-load/usr/lib
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gcc-16.2.0
    ```

### Ncurses-6.6

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf ncurses-6.6.tar.gz
    cd ncurses-6.6
    ```

- [ ] **Build and install. Run each block in order:**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make DESTDIR=$PWD/dest install`**

    ```bash
    make DESTDIR=$PWD/dest install
    sed -e 's/^#if.*XOPEN.*$/#if 1/' \
        -i dest/usr/include/curses.h
    cp --remove-destination -av dest/* /
    ```

- [ ] **`for lib in ncurses form panel menu ; do`**

    ```bash
    for lib in ncurses form panel menu ; do
        ln -sfv lib${lib}w.so /usr/lib/lib${lib}.so
        ln -sfv ${lib}w.pc    /usr/lib/pkgconfig/${lib}.pc
    done
    ```

- [ ] **`ln -sfv libncursesw.so /usr/lib/libcurses.so`**

    ```bash
    ln -sfv libncursesw.so /usr/lib/libcurses.so
    ```

- [ ] **`cp -v -R doc -T /usr/share/doc/ncurses-6.6`**

    ```bash
    cp -v -R doc -T /usr/share/doc/ncurses-6.6
    ```

- [ ] **Optional — skip unless you need old binary-only programs. Builds legacy `libncurses.so.5`:**

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

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf ncurses-6.6
    ```

### Sed-4.10

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf sed-4.10.tar.xz
    cd sed-4.10
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    make html
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    chown -R tester .
    su tester -c "PATH=$PATH make check"
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    install -vDm644 doc/sed.html -t /usr/share/doc/sed-4.10
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf sed-4.10
    ```

### Psmisc-23.7

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf psmisc-23.7.tar.xz
    cd psmisc-23.7
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf psmisc-23.7
    ```

### Gettext-1.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gettext-1.0.tar.xz
    cd gettext-1.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/gettext-1.0
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    chmod -v 0755 /usr/lib/preloadable_libintl.so
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gettext-1.0
    ```

### Bison-3.8.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf bison-3.8.2.tar.xz
    cd bison-3.8.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr --docdir=/usr/share/doc/bison-3.8.2
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf bison-3.8.2
    ```

### Grep-3.12

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf grep-3.12.tar.xz
    cd grep-3.12
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i "s/echo/#echo/" src/egrep.sh
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf grep-3.12
    ```

### Bash-5.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf bash-5.3.tar.gz
    cd bash-5.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr             \
                --without-bash-malloc     \
                --with-installed-readline \
                --docdir=/usr/share/doc/bash-5.3
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    chown -R tester .
    ```

- [ ] **`LC_ALL=C.UTF-8 su -s /usr/bin/expect tester << "EOF"`**

    ```bash
    LC_ALL=C.UTF-8 su -s /usr/bin/expect tester << "EOF"
    set timeout -1
    spawn make tests
    expect eof
    lassign [wait] _ _ _ value
    exit $value
    EOF
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Required: replace the running shell with the brand-new Bash:**

    ```bash
    exec /usr/bin/bash --login
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf bash-5.3
    ```

### Libtool-2.6.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf libtool-2.6.2.tar.xz
    cd libtool-2.6.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`rm -fv /usr/lib/libltdl.a`**

    ```bash
    rm -fv /usr/lib/libltdl.a
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf libtool-2.6.2
    ```

### GDBM-1.26

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gdbm-1.26.tar.gz
    cd gdbm-1.26
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --enable-libgdbm-compat
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gdbm-1.26
    ```

### Gperf-3.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gperf-3.3.tar.gz
    cd gperf-3.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr --docdir=/usr/share/doc/gperf-3.3
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gperf-3.3
    ```

### Expat-2.8.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf expat-2.8.3.tar.xz
    cd expat-2.8.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/expat-2.8.3
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`install -v -m644 doc/*.{html,css} /usr/share/doc/expat-2.8.3`**

    ```bash
    install -v -m644 doc/*.{html,css} /usr/share/doc/expat-2.8.3
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf expat-2.8.3
    ```

### Inetutils-2.8

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf inetutils-2.8.tar.gz
    cd inetutils-2.8
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i 's/def HAVE_TERMCAP_TGETENT/ 1/' telnet/telnet.c
    ```

- [ ] **`./configure --prefix=/usr`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`mv -v /usr/{,s}bin/ifconfig`**

    ```bash
    mv -v /usr/{,s}bin/ifconfig
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf inetutils-2.8
    ```

### Less-704

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf less-704.tar.gz
    cd less-704
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr --sysconfdir=/etc
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf less-704
    ```

### Perl-5.44.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf perl-5.44.0.tar.xz
    cd perl-5.44.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    export BUILD_ZLIB=False
    export BUILD_BZIP2=0
    ```

- [ ] **`sh Configure -des`**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`TEST_JOBS=$(nproc) make test_harness`**

    ```bash
    TEST_JOBS=$(nproc) make test_harness
    ```

- [ ] **`make install`**

    ```bash
    make install
    unset BUILD_ZLIB BUILD_BZIP2
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf perl-5.44.0
    ```

### Autoconf-2.73

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf autoconf-2.73.tar.xz
    cd autoconf-2.73
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf autoconf-2.73
    ```

### Automake-1.18.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf automake-1.18.1.tar.xz
    cd automake-1.18.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr --docdir=/usr/share/doc/automake-1.18.1
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make -j$(($(nproc)>4?$(nproc):4)) check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf automake-1.18.1
    ```

### OpenSSL-4.0.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf openssl-4.0.1.tar.gz
    cd openssl-4.0.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./config --prefix=/usr         \
             --openssldir=/etc/ssl \
             --libdir=lib          \
             shared                \
             zlib-dynamic
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make test
    ```

- [ ] **Continue with the installation:**

    ```bash
    make INSTALL_LIBS= MANSUFFIX=ssl install
    ```

- [ ] **`mv -v /usr/share/doc/openssl /usr/share/doc/openssl-4.0.1`**

    ```bash
    mv -v /usr/share/doc/openssl /usr/share/doc/openssl-4.0.1
    ```

- [ ] **`cp -vfr doc/* /usr/share/doc/openssl-4.0.1`**

    ```bash
    cp -vfr doc/* /usr/share/doc/openssl-4.0.1
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf openssl-4.0.1
    ```

### Libelf from Elfutils-0.195

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf elfutils-0.195.tar.bz2
    cd elfutils-0.195
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    ./configure --prefix=/usr        \
                --disable-debuginfod \
                --enable-libdebuginfod=dummy
    ```

- [ ] **Continue with the installation:**

    ```bash
    make -C lib
    make -C libelf
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make -k check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make -C libelf install
    install -vm644 config/libelf.pc /usr/lib/pkgconfig
    rm /usr/lib/libelf.a
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf elfutils-0.195
    ```

### Libffi-3.8.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf libffi-3.8.0.tar.gz
    cd libffi-3.8.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --with-gcc-arch=native
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf libffi-3.8.0
    ```

### Sqlite-3530400

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf sqlite-autoconf-3530400.tar.gz
    cd sqlite-autoconf-3530400
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    python3 -m zipfile -e ../sqlite-doc-3530400.zip .
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr     \
                --disable-static  \
                --enable-fts{4,5} \
                CPPFLAGS="-D SQLITE_ENABLE_COLUMN_METADATA=1 \
                          -D SQLITE_ENABLE_UNLOCK_NOTIFY=1   \
                          -D SQLITE_ENABLE_DBSTAT_VTAB=1     \
                          -D SQLITE_SECURE_DELETE=1"
    ```

- [ ] **`make LDFLAGS.rpath=""`**

    ```bash
    make LDFLAGS.rpath=""
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **`cp -v -R sqlite-doc-3530400 -T /usr/share/doc/sqlite-3.53.4`**

    ```bash
    cp -v -R sqlite-doc-3530400 -T /usr/share/doc/sqlite-3.53.4
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf sqlite-autoconf-3530400
    ```

### mpdecimal-4.0.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf mpdecimal-4.0.1.tar.gz
    cd mpdecimal-4.0.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr    \
                --disable-static \
                --docdir=/usr/share/doc/mpdecimal-4.0.1
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make check_local`**

    ```bash
    make check_local
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf mpdecimal-4.0.1
    ```

### Python-3.14.7

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf Python-3.14.7.tar.xz
    cd Python-3.14.7
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    patch -Np1 -i ../Python-3.14.7-openssl_4-1.patch
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr          \
                --enable-shared        \
                --with-system-expat    \
                --enable-optimizations \
                --without-static-libpython
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make test TESTOPTS="--timeout 120"
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`cat > /etc/pip.conf << EOF`**

    ```bash
    cat > /etc/pip.conf << EOF
    [global]
    root-user-action = ignore
    disable-pip-version-check = true
    EOF
    ```

- [ ] **`install -v -dm755 /usr/share/doc/python-3.14.7/html`**

    ```bash
    install -v -dm755 /usr/share/doc/python-3.14.7/html

    tar --strip-components=1  \
        --no-same-owner       \
        --no-same-permissions \
        -C /usr/share/doc/python-3.14.7/html \
        -xvf ../python-3.14.7-docs-html.tar.bz2
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf Python-3.14.7
    ```

### Flit-Core-4.0.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf flit_core-4.0.2.tar.gz
    cd flit_core-4.0.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
    ```

- [ ] **`pip3 install --no-index --find-links dist flit_core`**

    ```bash
    pip3 install --no-index --find-links dist flit_core
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf flit_core-4.0.2
    ```

### Packaging-26.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf packaging-26.3.tar.gz
    cd packaging-26.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
    ```

- [ ] **`pip3 install --no-index --find-links dist packaging`**

    ```bash
    pip3 install --no-index --find-links dist packaging
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf packaging-26.3
    ```

### Wheel-0.48.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf wheel-0.48.0.tar.gz
    cd wheel-0.48.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
    ```

- [ ] **`pip3 install --no-index --find-links dist wheel`**

    ```bash
    pip3 install --no-index --find-links dist wheel
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf wheel-0.48.0
    ```

### Setuptools-84.0.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf setuptools-84.0.0.tar.gz
    cd setuptools-84.0.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
    ```

- [ ] **`pip3 install --no-index --find-links dist setuptools`**

    ```bash
    pip3 install --no-index --find-links dist setuptools
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf setuptools-84.0.0
    ```

### Meson-1.12.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf meson-1.12.0.tar.gz
    cd meson-1.12.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
    ```

- [ ] **`pip3 install --no-index --find-links dist meson`**

    ```bash
    pip3 install --no-index --find-links dist meson
    install -vDm644 data/shell-completions/bash/meson /usr/share/bash-completion/completions/meson
    install -vDm644 data/shell-completions/zsh/_meson /usr/share/zsh/site-functions/_meson
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf meson-1.12.0
    ```

### Kmod-34.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf kmod-34.2.tar.xz
    cd kmod-34.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir -p build
    cd       build

    meson setup --prefix=/usr ..    \
                --buildtype=release \
                -D manpages=false
    ```

- [ ] **`ninja`**

    ```bash
    ninja
    ```

- [ ] **`ninja install`**

    ```bash
    ninja install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf kmod-34.2
    ```

### Coreutils-9.11

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf coreutils-9.11.tar.xz
    cd coreutils-9.11
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    patch -Np1 -i ../coreutils-9.11-i18n-1.patch
    ```

- [ ] **`autoreconf -fv`**

    ```bash
    autoreconf -fv
    automake -af
    FORCE_UNSAFE_CONFIGURE=1 ./configure \
                --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make NON_ROOT_USERNAME=tester check-root
    ```

- [ ] **`groupadd -g 102 dummy -U tester`**

    ```bash
    groupadd -g 102 dummy -U tester
    ```

- [ ] **`chown -R tester .`**

    ```bash
    chown -R tester .
    ```

- [ ] **`su tester -c "PATH=$PATH make -k RUN_EXPENSIVE_TESTS=yes check"`**

    ```bash
    su tester -c "PATH=$PATH make -k RUN_EXPENSIVE_TESTS=yes check" \
       < /dev/null
    ```

- [ ] **`groupdel dummy`**

    ```bash
    groupdel dummy
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`mv -v /usr/bin/chroot /usr/sbin`**

    ```bash
    mv -v /usr/bin/chroot /usr/sbin
    mv -v /usr/share/man/man1/chroot.1 /usr/share/man/man8/chroot.8
    sed -i 's/"1"/"8"/' /usr/share/man/man8/chroot.8
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf coreutils-9.11
    ```

### Diffutils-3.12

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf diffutils-3.12.tar.xz
    cd diffutils-3.12
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf diffutils-3.12
    ```

### Findutils-4.11.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf findutils-4.11.0.tar.xz
    cd findutils-4.11.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr --localstatedir=/var/lib/locate
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    chown -R tester .
    su tester -c "PATH=$PATH make check -k"
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf findutils-4.11.0
    ```

### Groff-1.24.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf groff-1.24.1.tar.gz
    cd groff-1.24.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    PAGE=<paper_size> ./configure --prefix=/usr
    ```

- [ ] **`make -j1`**

    ```bash
    make -j1
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf groff-1.24.1
    ```

### GRUB-2.14

- [ ] **GRUB can be built for BIOS, 64-bit UEFI, and 32-bit UEFI (rare). Build the ones you need. For a disk you plan to share or distribute, build BIOS and 64-bit UEFI.**

    ```bash
    cd /sources
    tar -xf grub-2.14.tar.xz
    cd grub-2.14
    ```

- [ ] **First, remove any custom compiler flags and apply a small fix for a bug in this GRUB release:**

    ```bash
    unset {C,CPP,CXX,LD}FLAGS
    ```

- [ ] **`sed 's/--image-base/--nonexist-linker-option/' -i configure`**

    ```bash
    sed 's/--image-base/--nonexist-linker-option/' -i configure
    ```

- [ ] **GRUB for BIOS (skip if you only boot with UEFI):**

    ```bash
    ./configure --prefix=/usr     \
                --sysconfdir=/etc \
                --disable-efiemu  \
                --disable-werror
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **GRUB for 64-bit UEFI (most modern PCs and VMs with UEFI firmware). If you built the BIOS version above, clean the tree first with `make clean`. Then:**

    ```bash
    ./configure --prefix=/usr       \
                --sysconfdir=/etc   \
                --target=x86_64     \
                --with-platform=efi \
                --disable-efiemu    \
                --disable-werror
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **GRUB for 32-bit UEFI (very rare; skip unless you know you need it). Run `make clean` first, then:**

    ```bash
    ./configure --prefix=/usr       \
                --sysconfdir=/etc   \
                --target=i386       \
                --with-platform=efi \
                --disable-efiemu    \
                --disable-werror
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf grub-2.14
    ```

### Gzip-1.14

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf gzip-1.14.tar.xz
    cd gzip-1.14
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf gzip-1.14
    ```

### IPRoute2-7.1.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf iproute2-7.1.0.tar.xz
    cd iproute2-7.1.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -i /ARPD/d Makefile
    rm -fv man/man8/arpd.8
    ```

- [ ] **`make NETNS_RUN_DIR=/run/netns`**

    ```bash
    make NETNS_RUN_DIR=/run/netns
    ```

- [ ] **`make SBINDIR=/usr/sbin install`**

    ```bash
    make SBINDIR=/usr/sbin install
    ```

- [ ] **`install -vDm644 COPYING README* -t /usr/share/doc/iproute2-7.1.0`**

    ```bash
    install -vDm644 COPYING README* -t /usr/share/doc/iproute2-7.1.0
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf iproute2-7.1.0
    ```

### Kbd-2.10.0

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf kbd-2.10.0.tar.xz
    cd kbd-2.10.0
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    patch -Np1 -i ../kbd-2.10.0-backspace-1.patch
    ```

- [ ] **`sed -i '/RESIZECONS_PROGS=/s/yes/no/' configure`**

    ```bash
    sed -i '/RESIZECONS_PROGS=/s/yes/no/' configure
    sed -i 's/resizecons.8 //' docs/man/man8/Makefile.in
    ```

- [ ] **`./configure --prefix=/usr --disable-vlock`**

    ```bash
    ./configure --prefix=/usr --disable-vlock
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`cp -R -v docs/doc -T /usr/share/doc/kbd-2.10.0`**

    ```bash
    cp -R -v docs/doc -T /usr/share/doc/kbd-2.10.0
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf kbd-2.10.0
    ```

### Libpipeline-1.5.8

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf libpipeline-1.5.8.tar.gz
    cd libpipeline-1.5.8
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **`make install`**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf libpipeline-1.5.8
    ```

### Make-4.4.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf make-4.4.1.tar.gz
    cd make-4.4.1
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    chown -R tester .
    su tester -c "PATH=$PATH make check"
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf make-4.4.1
    ```

### Patch-2.8

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf patch-2.8.tar.xz
    cd patch-2.8
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf patch-2.8
    ```

### Tar-1.35

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf tar-1.35.tar.xz
    cd tar-1.35
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    patch -Np1 -i ../tar-1.35-acl_fix-1.patch
    ```

- [ ] **`FORCE_UNSAFE_CONFIGURE=1`**

    ```bash
    FORCE_UNSAFE_CONFIGURE=1  \
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    make -C doc install-html docdir=/usr/share/doc/tar-1.35
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf tar-1.35
    ```

### Texinfo-7.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf texinfo-7.3.tar.xz
    cd texinfo-7.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`make TEXMF=/usr/share/texmf install-tex`**

    ```bash
    make TEXMF=/usr/share/texmf install-tex
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf texinfo-7.3
    ```

### Vim-9.2.1025

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf vim-9.2.1025.tar.gz
    cd vim-9.2.1025
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    echo '#define SYS_VIMRC_FILE "/etc/vimrc"' >> src/feature.h
    ```

- [ ] **`./configure --prefix=/usr`**

    ```bash
    ./configure --prefix=/usr
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    chown -R tester .
    sed '/test_plugin_glvs/d' -i src/testdir/Make_all.mak
    ```

- [ ] **`su tester -c "TERM=xterm-256color LANG=en_US.UTF-8 make -j1 test"`**

    ```bash
    su tester -c "TERM=xterm-256color LANG=en_US.UTF-8 make -j1 test" \
       &> vim-test.log
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`ln -sv vim /usr/bin/vi`**

    ```bash
    ln -sv vim /usr/bin/vi
    for L in  /usr/share/man/{,*/}man1/vim.1; do
        ln -sv vim.1 $(dirname $L)/vi.1
    done
    ```

- [ ] **`ln -sv ../vim/vim92/doc /usr/share/doc/vim-9.2.1025`**

    ```bash
    ln -sv ../vim/vim92/doc /usr/share/doc/vim-9.2.1025
    ```

- [ ] **`cat > /etc/vimrc << "EOF"`**

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

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf vim-9.2.1025
    ```

### MarkupSafe-3.0.3

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf markupsafe-3.0.3.tar.gz
    cd markupsafe-3.0.3
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
    ```

- [ ] **`pip3 install --no-index --find-links dist Markupsafe`**

    ```bash
    pip3 install --no-index --find-links dist Markupsafe
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf markupsafe-3.0.3
    ```

### Jinja2-3.1.6

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf jinja2-3.1.6.tar.gz
    cd jinja2-3.1.6
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    pip3 wheel -w dist --no-cache-dir --no-build-isolation --no-deps $PWD
    ```

- [ ] **`pip3 install --no-index --find-links dist Jinja2`**

    ```bash
    pip3 install --no-index --find-links dist Jinja2
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf jinja2-3.1.6
    ```

### Systemd-261.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf systemd-261.2.tar.gz
    cd systemd-261.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    sed -e 's/GROUP="render"/GROUP="video"/' \
        -e 's/GROUP="sgx", //'               \
        -i rules.d/50-udev-default.rules.in
    ```

- [ ] **`mkdir -p build`**

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

- [ ] **`ninja`**

    ```bash
    ninja
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    echo 'NAME="Linux From Scratch"' > /etc/os-release
    unshare -m ninja test
    ```

- [ ] **Continue with the installation:**

    ```bash
    ninja install
    ```

- [ ] **`tar -xf ../../systemd-man-pages-261.2.tar.xz`**

    ```bash
    tar -xf ../../systemd-man-pages-261.2.tar.xz \
        --no-same-owner --strip-components=1     \
        -C /usr/share/man
    ```

- [ ] **`systemd-machine-id-setup`**

    ```bash
    systemd-machine-id-setup
    ```

- [ ] **`systemctl preset-all`**

    ```bash
    systemctl preset-all
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf systemd-261.2
    ```

### D-Bus-1.16.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf dbus-1.16.2.tar.xz
    cd dbus-1.16.2
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir build
    cd    build

    meson setup --prefix=/usr --buildtype=release --wrap-mode=nofallback ..
    ```

- [ ] **`ninja`**

    ```bash
    ninja
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    ninja test
    ```

- [ ] **Continue with the installation:**

    ```bash
    ninja install
    ```

- [ ] **`ln -sfv /etc/machine-id /var/lib/dbus`**

    ```bash
    ln -sfv /etc/machine-id /var/lib/dbus
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf dbus-1.16.2
    ```

### Man-DB-2.13.1

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf man-db-2.13.1.tar.xz
    cd man-db-2.13.1
    ```

- [ ] **Build and install. Run each block in order:**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf man-db-2.13.1
    ```

### Procps-ng-4.0.7

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf procps-ng-4.0.7.tar.xz
    cd procps-ng-4.0.7
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    ./configure --prefix=/usr                           \
                --docdir=/usr/share/doc/procps-ng-4.0.7 \
                --disable-static                        \
                --disable-kill                          \
                --enable-watch8bit                      \
                --with-systemd
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    chown -R tester .
    su tester -c "PATH=$PATH make check"
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf procps-ng-4.0.7
    ```

### Util-linux-2.42.2

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf util-linux-2.42.2.tar.xz
    cd util-linux-2.42.2
    ```

- [ ] **Build and install. Run each block in order:**

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

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    touch /etc/fstab
    chown -R tester .
    su tester -c "make -k check"
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf util-linux-2.42.2
    ```

### E2fsprogs-1.47.4

- [ ] **Unpack the package:**

    ```bash
    cd /sources
    tar -xf e2fsprogs-1.47.4.tar.gz
    cd e2fsprogs-1.47.4
    ```

- [ ] **Build and install. Run each block in order:**

    ```bash
    mkdir -v build
    cd       build
    ```

- [ ] **`../configure --prefix=/usr`**

    ```bash
    ../configure --prefix=/usr       \
                 --sysconfdir=/etc   \
                 --enable-elf-shlibs \
                 --disable-libblkid  \
                 --disable-libuuid   \
                 --disable-uuidd     \
                 --disable-fsck
    ```

- [ ] **`make`**

    ```bash
    make
    ```

- [ ] **Test suite (recommended, but optional):**

    ```bash
    make check
    ```

- [ ] **Continue with the installation:**

    ```bash
    make install
    ```

- [ ] **`rm -fv /usr/lib/{libcom_err,libe2p,libext2fs,libss}.a`**

    ```bash
    rm -fv /usr/lib/{libcom_err,libe2p,libext2fs,libss}.a
    ```

- [ ] **`gunzip -v /usr/share/info/libext2fs.info.gz`**

    ```bash
    gunzip -v /usr/share/info/libext2fs.info.gz
    install-info --dir-file=/usr/share/info/dir /usr/share/info/libext2fs.info
    ```

- [ ] **`makeinfo -o doc/com_err.info ../lib/et/com_err.texinfo`**

    ```bash
    makeinfo -o      doc/com_err.info ../lib/et/com_err.texinfo
    install -v -m644 doc/com_err.info /usr/share/info
    install-info --dir-file=/usr/share/info/dir /usr/share/info/com_err.info
    ```

- [ ] **Optional — only if an *older* bootloader or tool can't read new ext4 filesystems:**

    ```bash
    sed 's/metadata_csum_seed,//' -i /etc/mke2fs.conf
    ```

- [ ] **Clean up:**

    ```bash
    cd /sources
    rm -rf e2fsprogs-1.47.4
    ```

### Stripping Debugging Symbols (Optional)

- [ ] **Most programs and libraries contain debugging symbols that make them several times larger. Removing ("stripping") them saves hundreds of megabytes. The book's command strips everything safely: it keeps separate debug…**

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

### Cleaning Up

- [ ] **Remove temporary files:**

    ```bash
    rm -rf /tmp/{*,.*}
    ```

- [ ] **Remove libtool archive files:**

    ```bash
    find /usr/lib /usr/libexec -name \*.la -delete
    ```

- [ ] **Remove leftovers from the temporary cross-toolchain:**

    ```bash
    find /usr -depth -name $(uname -m)-lfs-linux-gnu\* | xargs rm -rf
    ```

- [ ] **Remove the temporary `tester` user:**

    ```bash
    userdel -r tester
    ```

## Phase 8 — Configure the System (Book Chapter 9)

### 8.1 Networking

- [ ] **Recommended for beginners (and VMs): DHCP. This version uses `Name=en*`, which matches any wired interface with a "predictable" name (`enp0s3`, `ens33`, `eno1`, and so on). That way you don't need to know the exact…**

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

- [ ] **Alternative: static IP address. Use this instead of DHCP if your network needs a fixed address. Replace the placeholders and the example addresses:**

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

- [ ] **Hostname: Give your system a name. Replace `<lfs>` with your choice, for example `mydistro`:**

    ```bash
    echo "<lfs>" > /etc/hostname
    ```

- [ ] **The hosts file. For DHCP, a simple version is enough. Replace `mydistro` with your hostname:**

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

- [ ] **`cat > /etc/hosts << "EOF"`**

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

### 8.3 System clock

- [ ] **systemd assumes your hardware clock is set to UTC, which is the right choice for Linux-only machines and for VMs. Only if the machine dual-boots with Windows (which keeps the clock in *local* time), create this file:**

    ```bash
    cat > /etc/adjtime << "EOF"
    0.0 0 0.0
    0
    LOCAL
    EOF
    ```

### 8.4 Console keyboard and font (optional)

- [ ] **With a US keyboard and the default font, you can skip this step. For other layouts, create `/etc/vconsole.conf`. For example, for a German keyboard:**

    ```bash
    cat > /etc/vconsole.conf << "EOF"
    KEYMAP=de-latin1
    FONT=Lat2-Terminus16
    EOF
    ```

### 8.5 Locale (language settings)

- [ ] **Choose your locale. For US English with UTF-8:**

    ```bash
    cat > /etc/locale.conf << "EOF"
    LANG=en_US.UTF-8
    EOF
    ```

- [ ] **Create the system-wide shell profile, which loads the locale for login shells:**

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

### 8.6 The `/etc/inputrc` file

- [ ] **This file makes keys such as Home, End, Delete and PageUp work correctly in Bash:**

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

- [ ] **This file lists the valid login shells:**

    ```bash
    cat > /etc/shells << "EOF"
    # Begin /etc/shells

    /bin/sh
    /bin/bash

    # End /etc/shells
    EOF
    ```

### 8.8 Optional systemd tweaks

- [ ] **Keep boot messages on screen (otherwise they're cleared when the login prompt appears), which is handy for troubleshooting:**

    ```bash
    mkdir -pv /etc/systemd/system/getty@tty1.service.d

    cat > /etc/systemd/system/getty@tty1.service.d/noclear.conf << EOF
    [Service]
    TTYVTDisallocate=no
    EOF
    ```

- [ ] **`mkdir -pv /etc/systemd/coredump.conf.d`**

    ```bash
    mkdir -pv /etc/systemd/coredump.conf.d

    cat > /etc/systemd/coredump.conf.d/maxuse.conf << EOF
    [Coredump]
    MaxUse=5G
    EOF
    ```

## Phase 9 — Make the System Bootable (Book Chapter 10)

### 9.1 Create `/etc/fstab`

- [ ] **The book's version, using device names:**

    ```bash
    cat > /etc/fstab << "EOF"
    # Begin /etc/fstab

    # file system  mount-point  type     options             dump  fsck
    #                                                              order

    /dev/<xxx>     /            <fff>    defaults            1     1
    /dev/<yyy>     swap         swap     pri=1               0     0

    # End /etc/fstab
    EOF
    ```

- [ ] **The same thing using UUIDs (recommended). Replace the UUIDs with your own:**

    ```bash
    cat > /etc/fstab << "EOF"
    # Begin /etc/fstab

    # file system                               mount-point  type  options   dump fsck
    UUID=<uuid-of-lfs-root-partition>           /            ext4  defaults  1    1
    UUID=<uuid-of-swap-partition>               swap         swap  pri=1     0    0

    # End /etc/fstab
    EOF
    ```

- [ ] **If you use UEFI, also add the EFI System Partition (replace the placeholder with `/dev/<zzz>` or `UUID=...`):**

    ```bash
    cat >> /etc/fstab << "EOF"
    /dev/<zzz>  /boot/efi  vfat  rw,relatime,codepage=437,iocharset=iso8859-1   0   2
    EOF
    ```

- [ ] **Then create the mount point and mount the ESP inside the chroot:**

    ```bash
    mkdir -pv /boot/efi
    mount -v /boot/efi
    ```

### 9.2 Build the Linux kernel

- [ ] **What it is: The kernel is the core of the operating system. It manages memory and processes and talks to your hardware.**

    ```bash
    cd /sources
    tar -xf linux-7.1.8.tar.xz
    cd linux-7.1.8
    ```

- [ ] **Make sure the source tree is completely clean:**

    ```bash
    make mrproper
    ```

- [ ] **Start from the kernel's default configuration for your architecture:**

    ```bash
    make defconfig
    ```

- [ ] **If you're building in a QEMU/KVM virtual machine, add the VM drivers (virtio disk, network, and so on) as built-in options:**

    ```bash
    make kvm_guest.config
    ```

- [ ] **Open the menu editor and check the required settings listed below:**

    ```bash
    make menuconfig
    ```

- [ ] **When you exit `menuconfig`, choose Yes to save. The file must be named `.config` (the default). Then confirm your key settings:**

    ```bash
    grep -E '^CONFIG_(EXT4_FS|EFI_STUB|USB_STORAGE|USB_XHCI_HCD|BLK_DEV_SD)=' .config
    ```

- [ ] **Compile the kernel:**

    ```bash
    make
    ```

- [ ] **Install the kernel modules:**

    ```bash
    make modules_install
    ```

- [ ] **Copy the kernel, its symbol map and its configuration to `/boot`. The file name is up to you, but it must start with `vmlinuz`:**

    ```bash
    cp -iv arch/x86/boot/bzImage /boot/vmlinuz-7.1.8-lfs-13.1-systemd
    ```

- [ ] **`cp -iv System.map /boot/System.map-7.1.8`**

    ```bash
    cp -iv System.map /boot/System.map-7.1.8
    ```

- [ ] **`cp -iv .config /boot/config-7.1.8`**

    ```bash
    cp -iv .config /boot/config-7.1.8
    ```

- [ ] **Optionally install the kernel documentation:**

    ```bash
    cp -r Documentation -T /usr/share/doc/linux-7.1.8
    ```

### 9.3 Install GRUB and create its menu

- [ ] **Option A — BIOS boot. This writes GRUB to the LFS disk. Check the disk name with `lsblk` inside the chroot (the same name Debian uses), for example `/dev/sdX`:**

    ```bash
    grub-install /dev/sdX --target=i386-pc
    ```

- [ ] **Option B — UEFI boot. Make sure the LFS disk's ESP is mounted at `/boot/efi`: `findmnt /boot/efi` must show the LFS disk's first partition, not the Debian machine's own EFI partition. Then:**

    ```bash
    grub-install --target=x86_64-efi --removable
    ```

- [ ] **Create the GRUB menu (`/boot/grub/grub.cfg`). The book's version uses fixed disk numbers:**

    ```bash
    cat > /boot/grub/grub.cfg << "EOF"
    # Begin /boot/grub/grub.cfg
    set default=0
    set timeout=5

    insmod part_gpt
    insmod ext2

    set root=(hd0,2)
    set gfxpayload=1024x768x32

    menuentry "GNU/Linux, Linux 7.1.8-lfs-13.1-systemd" {
            linux   /boot/vmlinuz-7.1.8-lfs-13.1-systemd root=/dev/sda2 ro
    }
    EOF
    ```

- [ ] **Recommended version: find the partition by UUID, so it keeps working no matter how disks are numbered. Replace `<UUID>` with the filesystem UUID and `<PARTUUID>` with the partition UUID of the LFS root partition…**

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

- [ ] **Use this when LFS is on a disk that stays inside the Debian machine. On Debian (a host window, not the chroot), add an entry to `/etc/grub.d/40_custom` and regenerate Debian's menu:**

    ```bash
    cat >> /etc/grub.d/40_custom << "EOF"
    menuentry "LFS 13.1-systemd" {
            insmod part_gpt
            insmod ext2
            search --no-floppy --fs-uuid --set=root <UUID>
            linux   /boot/vmlinuz-7.1.8-lfs-13.1-systemd root=PARTUUID=<PARTUUID> rootwait ro
    }
    EOF
    update-grub
    ```

## Phase 10 — The End and First Boot (Book Chapter 11)

### 10.1 Create release files

- [ ] **These files identify your system. Many programs read `/etc/os-release`. You'll customize them for your own distro in Phase 11.**

    ```bash
    echo 13.1-systemd > /etc/lfs-release
    ```

- [ ] **`cat > /etc/lsb-release << "EOF"`**

    ```bash
    cat > /etc/lsb-release << "EOF"
    DISTRIB_ID="Linux From Scratch"
    DISTRIB_RELEASE="13.1-systemd"
    DISTRIB_CODENAME="<your name here>"
    DISTRIB_DESCRIPTION="Linux From Scratch"
    EOF
    ```

- [ ] **`cat > /etc/os-release << "EOF"`**

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

### 10.3 Leave the chroot and unmount everything

- [ ] **`logout`**

    ```bash
    logout
    ```

- [ ] **On the host, as root (check `echo $LFS` first). If you mounted the ESP, unmount it before the others:**

    ```bash
    mountpoint -q $LFS/boot/efi && umount -v $LFS/boot/efi
    ```

- [ ] **`umount -v $LFS/dev/pts`**

    ```bash
    umount -v $LFS/dev/pts
    mountpoint -q $LFS/dev/shm && umount -v $LFS/dev/shm
    umount -v $LFS/dev
    umount -v $LFS/run
    umount -v $LFS/proc
    umount -v $LFS/sys
    ```

- [ ] **`umount -v $LFS`**

    ```bash
    umount -v $LFS
    ```

- [ ] **Now reboot. In a VM, set the LFS disk as the first boot device (or, better, boot-test in a separate VM as in Phase 0.6). On a physical machine, choose LFS from your boot menu.**

    ```bash
    systemctl reboot
    ```

### 10.4 First login and quick checks

- [ ] **You'll see a text `login:` prompt. Log in as `root` with the password you set. Then run a few checks:**

    ```bash
    cat /etc/os-release        # shows your system name
    uname -r                   # 7.1.8
    ip addr                    # your network interface should have an IP address
    ping -c 3 linuxfromscratch.org
    systemctl --failed         # ideally lists 0 failed units
    ```

- [ ] **Create an everyday user account and don't work as root:**

    ```bash
    useradd -m -G users,wheel -s /bin/bash <yourname>
    passwd <yourname>
    ```

## Phase 11 — From LFS to Your Own Distribution (Beyond the Book)

*Reference section: tick these only when you actually use them.*

### 11.1 Give it an identity

- [ ] **Choose a name and ID for your distribution, and put it in `/etc/os-release`. Many tools read this file.**

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

### 11.2 Add the software people expect (BLFS)

### 11.3 Add package management

- [ ] **Your users need a way to install, upgrade and remove software cleanly. The book's "Package Management" section (8.2) describes several approaches. The most practical one for a small distro is "install into a staging…**

    ```bash
    ./configure --prefix=/usr
    make
    make DESTDIR=/tmp/pkg-foo-1.0 install      # install into a staging area
    tar -C /tmp/pkg-foo-1.0 -cJpf foo-1.0.pkg.tar.xz .   # this archive is your "package"
    tar -C / -xpf foo-1.0.pkg.tar.xz                     # installing = extracting at /
    ```

### 11.4 Make builds repeatable

### 11.5 Make it generic enough for other computers

### 11.6 Ways to distribute your system

- [ ] **A root filesystem tarball can be created on the host from an unmounted-from-chroot LFS partition, leaving out the sources and the virtual filesystems:**

    ```bash
    cd $LFS
    tar --exclude=./sources --exclude=./lost+found \
        --exclude=./dev/* --exclude=./proc/* --exclude=./sys/* --exclude=./run/* \
        -cJpf $HOME/mydistro-1.0-rootfs.tar.xz .
    ```

### 11.7 Licensing responsibilities

### 11.8 Keep it secure

## Appendix A — Resuming After a Reboot (Copy-and-Paste Checklist)

*Reference section: tick these only when you actually use them.*

- [ ] **If you're in Phases 1–3:**

    ```bash
    su -
    echo $LFS                       # must print /mnt/lfs (set it in /root/.profile)
    mountpoint $LFS || mount -v -t ext4 /dev/<xxx> $LFS
    ```

- [ ] **If you're in Phases 4–5:**

    ```bash
    su -
    mountpoint $LFS || mount -v -t ext4 /dev/<xxx> $LFS
    su - lfs
    echo $LFS $LFS_TGT              # /mnt/lfs x86_64-lfs-linux-gnu
    ```

- [ ] **If you're in Phases 6–9: save this script as `/root/lfs-enter.sh` on the host, edit the partition name, and run it as root with `bash /root/lfs-enter.sh`:**

    ```bash
    #!/bin/bash
    # Mounts the LFS partition + virtual filesystems, then enters the chroot.
    export LFS=/mnt/lfs
    umask 022
    LFS_PART=/dev/<xxx>             # <-- your LFS root partition

    mountpoint -q $LFS         || mount -v -t ext4 $LFS_PART $LFS
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

## Appendix B — Troubleshooting Common Problems

*Reference section: tick these only when you actually use them.*

## Appendix C — Quick Reference

*Reference section: tick these only when you actually use them.*

## Appendix D — Recovering Debian After an fstab Mix-up

*Reference section: tick these only when you actually use them.*

- [ ] **Look at the damage and at Debian's real partitions:**

    ```bash
    cat /etc/fstab
    lsblk -f
    findmnt /
    ```

- [ ] **Keep a copy with `cp -v /etc/fstab /etc/fstab.broken`, then rewrite the file with Debian's real partitions. Name them by device path so there are no IDs to mistype. For example, for a typical single-disk UEFI install:**

    ```bash
    cat > /etc/fstab << "EOF"
    /dev/nvme0n1p2  /          ext4  errors=remount-ro  0 1
    /dev/nvme0n1p1  /boot/efi  vfat  umask=0077         0 1
    EOF
    ```

---

- [ ] **LFS boots on its own, and I can log in. Done!**
