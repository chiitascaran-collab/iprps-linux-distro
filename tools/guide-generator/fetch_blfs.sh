#!/bin/bash
# Usage: fetch_blfs.sh <tag e.g. r13.1> <version e.g. 13.1>
# Resolves the BLFS book (systemd edition) into /home/claude/blfs-full.xml.
set -e
TAG=$1; VER=$2; WD=/home/claude/blfswork
mkdir -p $WD && cd $WD
[ -d blfs-$TAG ] || { curl -sL -o b.tgz https://codeload.github.com/lfs-book/blfs/tar.gz/refs/tags/$TAG && tar xzf b.tgz; }
cd blfs-$TAG
dpkg -s docbook-xml >/dev/null 2>&1 || { apt-get update >/dev/null 2>&1; apt-get install -y docbook-xml >/dev/null 2>&1; }
bash git-version.sh systemd >/dev/null 2>&1 || true
sed -i "s/\"unknown\">/\"$VER\">/" version.ent
xmllint --noent --xinclude index.xml > /home/claude/blfs-full.xml
echo "Resolved BLFS -> /home/claude/blfs-full.xml"
