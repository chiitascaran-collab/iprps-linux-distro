#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
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

# IPRPS Updates needs the IPRPS repositories in pacman.conf. 12.12 step 7 takes the packaged
# version from /etc/pacman.conf.pacnew; a build that skipped it keeps the temporary file
# ("no usable package repositories configured" on the released computer).
if ! grep -q '^\[iprps-core\]' "$MNT/etc/pacman.conf" 2>/dev/null; then
  if grep -q '^\[iprps-core\]' "$MNT/etc/pacman.conf.pacnew" 2>/dev/null; then
    mv -f "$MNT/etc/pacman.conf.pacnew" "$MNT/etc/pacman.conf"
    echo "Fixed in the copy: /etc/pacman.conf now has the IPRPS repositories (from pacman.conf.pacnew)."
    echo "Fix the build image too (12.12 step 7's .pacnew line), or the next release repeats this."
  elif grep -q '^\[iprps-core\]' "$MNT/build/src/iprps-os/packages/iprps-base/pacman.conf" 2>/dev/null; then
    install -m644 "$MNT/build/src/iprps-os/packages/iprps-base/pacman.conf" "$MNT/etc/pacman.conf"
    echo "Fixed in the copy: /etc/pacman.conf restored from the iprps-base package source (packages/iprps-base/pacman.conf)."
    echo "Fix the build image too (Appendix B), or the next release repeats this."
  else
    die "the image's /etc/pacman.conf has no IPRPS repositories, so IPRPS Updates can't work: restore it in the build image (Appendix B, \"no usable package repositories\")"
  fi
fi
grep -q '^Server *= *https://' "$MNT/etc/pacman.d/iprps-mirrorlist" 2>/dev/null \
  || die "the image's /etc/pacman.d/iprps-mirrorlist has no https Server line (a test line from 12.12 left in?): put the real line back (12.12)"
PN=$(find "$MNT/etc" "$MNT/srv/www/iprps" -name '*.pacnew' 2>/dev/null | sed "s|^$MNT||")
[ -z "$PN" ] || { echo "Note: these package files are waiting (12.12 step 7 takes them):"; echo "$PN"; }

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
# Fresh system caches, so nothing is rebuilt per user at the first login
command -v fc-cache >/dev/null && fc-cache -sf
command -v update-mime-database >/dev/null && update-mime-database /usr/share/mime
command -v glib-compile-schemas >/dev/null && glib-compile-schemas /usr/share/glib-2.0/schemas
for t in /usr/share/icons/*/; do [ -f "$t/index.theme" ] && gtk-update-icon-cache -qf "$t"; done
command -v update-desktop-database >/dev/null && update-desktop-database -q /usr/share/applications
ldconfig
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
