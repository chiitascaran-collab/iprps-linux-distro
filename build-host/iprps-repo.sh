#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# iprps-repo.sh - the IPRPS OS package repository on the build host (guide 12.12 and Part 17)
#   iprps-repo.sh key                       create the signing key (once), back it up, export the public part
#   iprps-repo.sh add <repo> <pkg files>    sign packages and add them to iprps-core, iprps-apps or iprps-extra
#   iprps-repo.sh remove <repo> <names>     take packages out of a repository
#   iprps-repo.sh init                      an empty, signed list for each repository that has none yet
#   iprps-repo.sh check                     signatures, overlapping files, /etc files, dependencies
#   iprps-repo.sh list                      what each repository holds
#   iprps-repo.sh stage                     copy the repository to G:\IPRPS\repo-upload for uploading
#   iprps-repo.sh serve                     serve it on port 8080, for a test VM (Server = http://10.0.2.2:8080/$repo/$arch)
#   iprps-repo.sh online                    check what infiniteplane.space serves against the local copy
# The private signing key lives only in Debian root's GnuPG keyring and its backup on D:.
# Never in the image, never in Git.
set -u
REPO=${IPRPS_REPO_DIR:-/root/iprps-repo/1}
UPLOAD=${IPRPS_REPO_UPLOAD:-/mnt/g/IPRPS/repo-upload/1}
KEYBACKUP=${IPRPS_KEY_BACKUP:-/mnt/d/IPRPS/keys}
SRC=${IPRPS_SRC:-/mnt/g/IPRPS/iprps-os}
URL=${IPRPS_REPO_URL:-https://infiniteplane.space/downloads/iprps/repo/1}
UID_NAME=${IPRPS_KEY_UID:-IPRPS OS Packages <packages@infiniteplane.space>}
REPOS="iprps-core iprps-apps iprps-extra"
ARCH=x86_64

die() { printf '\033[1;31mSTOPPED: %s\033[0m\n' "$*" >&2; exit 1; }
ok()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33mWARNING: %s\033[0m\n' "$*"; }
need() { command -v "$1" >/dev/null || die "$1 is missing: apt install $2"; }
fpr() {
  [ -s /root/.iprps-signing-key ] || die "no signing key yet: run  $0 key"
  cat /root/.iprps-signing-key
}
valid_repo() { case " $REPOS " in *" $1 "*) ;; *) die "repository must be one of: $REPOS" ;; esac; }

cmd_key() {
  need gpg gnupg
  if [ -s /root/.iprps-signing-key ]; then
    echo "The signing key already exists: $(cat /root/.iprps-signing-key)"
  else
    echo "Creating the IPRPS signing key for: $UID_NAME"
    echo "Choose a strong passphrase when asked, and keep it somewhere safe (a password manager)."
    gpg --quick-gen-key "$UID_NAME" ed25519 sign 5y || die "gpg could not create the key"
    gpg --list-secret-keys --with-colons "$UID_NAME" | awk -F: '/^fpr:/ {print $10; exit}' > /root/.iprps-signing-key
    chmod 600 /root/.iprps-signing-key
  fi
  local F; F=$(fpr)
  # Back up the private key (still protected by its passphrase) and a revocation certificate
  mkdir -p "$KEYBACKUP" || die "cannot create $KEYBACKUP"
  gpg --export-secret-keys --armor "$F" > "$KEYBACKUP/iprps-signing-key-PRIVATE.asc" || die "export failed"
  cp -f "/root/.gnupg/openpgp-revocs.d/$F.rev" "$KEYBACKUP/iprps-signing-key-revoke.rev" 2>/dev/null || true
  # The public part goes into the keyring package
  local K=$SRC/packages/iprps-keyring
  [ -d "$K" ] || die "$K not found: unzip the newest repository to G:\\IPRPS\\iprps-os first"
  gpg --export --armor "$F" > "$K/iprps.gpg"
  echo "$F:4:" > "$K/iprps-trusted"
  ok "Signing key $F"
  echo "  private key backup: $KEYBACKUP/iprps-signing-key-PRIVATE.asc  (keep it off the internet; copy it to a USB stick too)"
  echo "  public key:         $K/iprps.gpg and iprps-trusted (these go into Git)"
}

cmd_add() {
  need repo-add pacman-package-manager; need gpg gnupg
  local repo=${1:-}; shift || true
  valid_repo "$repo"; [ $# -gt 0 ] || die "name the package files to add"
  local F d; F=$(fpr); d=$REPO/$repo/$ARCH
  mkdir -p "$d"
  local added=()
  for p in "$@"; do
    [ -f "$p" ] || die "$p not found"
    case "$p" in *.pkg.tar.zst) ;; *) die "$p is not a package (.pkg.tar.zst)" ;; esac
    cp -f "$p" "$d/" || die "copy failed: $p"
    rm -f "$d/${p##*/}.sig"
    gpg --batch --yes --detach-sign --no-armor -u "$F" "$d/${p##*/}" || die "signing failed: $p (wrong passphrase?)"
    added+=("$d/${p##*/}")
  done
  # --remove deletes the replaced older version of each package; --sign signs the database too
  repo-add --sign --key "$F" --verify --remove "$d/$repo.db.tar.zst" "${added[@]}" || die "repo-add failed"
  ok "Added to $repo: ${#added[@]} package(s). Next: $0 check, then test (serve), then stage and upload."
}

cmd_init() {
  need repo-add pacman-package-manager
  local F; F=$(fpr)
  for repo in $REPOS; do
    local d=$REPO/$repo/$ARCH
    if [ -f "$d/$repo.db.tar.zst" ]; then echo "$repo: has a list"; continue; fi
    mkdir -p "$d"
    # Every computer asks for all three lists: an empty repository still needs its (signed) list
    repo-add --sign --key "$F" "$d/$repo.db.tar.zst" >/dev/null || die "repo-add failed for $repo"
    ok "$repo: empty list created"
  done
}

cmd_remove() {
  need repo-remove pacman-package-manager
  local repo=${1:-}; shift || true
  valid_repo "$repo"; [ $# -gt 0 ] || die "name the packages to remove"
  local d=$REPO/$repo/$ARCH
  repo-remove --sign --key "$(fpr)" "$d/$repo.db.tar.zst" "$@" || die "repo-remove failed"
  for n in "$@"; do rm -fv "$d/$n"-[0-9]*.pkg.tar.zst "$d/$n"-[0-9]*.pkg.tar.zst.sig; done
}

# Package files listed in a repository database (newest versions only)
db_pkgs() { tar -xOf "$1" --wildcards '*/desc' 2>/dev/null | awk '/^%FILENAME%/{getline; print}'; }

cmd_check() {
  need bsdtar libarchive-tools; need gpg gnupg
  local bad=0 tmp; tmp=$(mktemp -d)
  for repo in $REPOS; do
    local d=$REPO/$repo/$ARCH db=$REPO/$repo/$ARCH/$repo.db.tar.zst
    [ -f "$db" ] || continue
    gpg --verify "$db.sig" "$db" 2>/dev/null || { warn "$repo: the database signature is bad or missing"; bad=1; }
    for f in $(db_pkgs "$db"); do
      [ -f "$d/$f" ] || { warn "$repo: $f is in the database but not in the folder"; bad=1; continue; }
      gpg --verify "$d/$f.sig" "$d/$f" 2>/dev/null || { warn "$repo: $f: signature bad or missing"; bad=1; }
      local name; name=$(bsdtar -xOf "$d/$f" .PKGINFO | awk -F' = ' '$1=="pkgname"{print $2}')
      bsdtar -tf "$d/$f" | grep -v '^\.\|/$' | sed "s|^|$name |" >> "$tmp/files"
      local backup; backup=$(bsdtar -xOf "$d/$f" .PKGINFO | awk -F' = ' '$1=="backup"{print $2}')
      for e in $(bsdtar -tf "$d/$f" | grep '^etc/.*[^/]$'); do
        grep -qx "$e" <<< "$backup" || warn "$name: $e is in /etc but not in backup=() (users' changes would be lost)"
      done
      bsdtar -xOf "$d/$f" .PKGINFO | grep -q '^depend = iprps-base' || \
        case "$name" in iprps-base|iprps-keyring|iprps-lib|iprps-hub|iprps-writer|iprps-table|iprps-character-*|iprps-combat|iprps-dice|iprps-session-log|iprps-welcome|iprps-file-viewer|iprps-soundboard|iprps-oracle) ;;
          *) warn "$name doesn't depend on iprps-base (rule 1, packages/README.md)" ;; esac
    done
  done
  if [ -s "$tmp/files" ]; then
    local dup; dup=$(awk '{print $2}' "$tmp/files" | sort | uniq -d)
    if [ -n "$dup" ]; then
      bad=1; warn "files in more than one package:"
      grep -F -w -f <(echo "$dup") "$tmp/files" | sort -k2 | head -40
    fi
  fi
  rm -rf "$tmp"
  [ $bad = 0 ] && ok "Repository check passed." || die "fix the problems above before publishing"
}

cmd_list() {
  for repo in $REPOS; do
    local db=$REPO/$repo/$ARCH/$repo.db.tar.zst
    echo "== $repo"
    [ -f "$db" ] && db_pkgs "$db" | sed 's/^/  /' || echo "  (empty)"
  done
}

cmd_stage() {
  need rsync rsync
  cmd_init
  cmd_check || exit 1
  mkdir -p "$UPLOAD" || die "cannot create $UPLOAD"
  # -L: the server gets real files instead of repo-add's .db -> .db.tar.zst links
  rsync -rtL --delete --info=stats1 "$REPO/" "$UPLOAD/" || die "copy failed"
  ok "Staged in $UPLOAD"
  echo "Upload its CONTENTS (the iprps-core, iprps-apps, iprps-extra folders) to the server folder"
  echo "  /downloads/iprps/repo/1/   (so that $URL/iprps-core/x86_64/iprps-core.db exists)"
  echo "with your FTP/SFTP program (FileZilla, WinSCP). Upload the packages first and the .db/.files/.sig files last."
  echo "Then: $0 online"
}

cmd_serve() {
  echo "Serving $REPO on port 8080. In a test VM (QEMU): Server = http://10.0.2.2:8080/\$repo/\$arch"
  echo "Stop with Ctrl+C."
  cd "$REPO" && exec python3 -m http.server 8080
}

cmd_online() {
  need curl curl
  local bad=0
  for repo in $REPOS; do
    local d=$REPO/$repo/$ARCH
    [ -f "$d/$repo.db.tar.zst" ] || { warn "$repo: no list here yet (run $0 stage, then upload)"; bad=1; continue; }
    local l r; l=$(sha256sum < "$d/$repo.db.tar.zst" | cut -c1-64)
    r=$(curl -fsSL "$URL/$repo/$ARCH/$repo.db" | sha256sum | cut -c1-64)
    if [ "$l" = "$r" ]; then ok "$repo: the server has the current database"; else warn "$repo: the server's database differs (not uploaded yet?)"; bad=1; fi
    curl -fsSI "$URL/$repo/$ARCH/$repo.db.sig" >/dev/null || { warn "$repo: $repo.db.sig is missing on the server"; bad=1; }
    for f in $(db_pkgs "$d/$repo.db.tar.zst"); do
      curl -fsSI "$URL/$repo/$ARCH/$f" >/dev/null || { warn "$repo: $f is missing on the server"; bad=1; }
    done
  done
  [ $bad = 0 ] && ok "Online repository matches." || exit 1
}

[ "$(id -u)" = 0 ] || die "run as root in Debian"
case "${1:-}" in
  key) cmd_key ;;
  init) cmd_init ;;
  add) shift; cmd_add "$@" ;;
  remove) shift; cmd_remove "$@" ;;
  check) cmd_check ;;
  list) cmd_list ;;
  stage) cmd_stage ;;
  serve) cmd_serve ;;
  online) cmd_online ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
