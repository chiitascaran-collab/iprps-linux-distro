#!/bin/sh
# SPDX-License-Identifier: GPL-2.0-only
# IPRPS Podcast Studio installer for Debian (IPRPS OS installs the iprps-podcast-studio package instead).
#   sudo ./install.sh            system-wide: /opt + applications menu
#   ./install.sh --user          current user only, no root needed
#   sudo ./install.sh --remove   uninstall (your shows in ~/.local/share are kept)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
NAME=iprps-podcast-studio
if [ "$1" = "--user" ]; then
  APP="$HOME/.local/opt/$NAME"; BIN="$HOME/.local/bin"; SHARE="$HOME/.local/share"
else
  APP="/opt/$NAME"; BIN="/usr/local/bin"; SHARE="/usr/share"
  [ "$(id -u)" = 0 ] || { echo "Run with sudo for a system-wide install, or use: ./install.sh --user"; exit 1; }
fi
if [ "$1" = "--remove" ]; then
  rm -rf "$APP" "$BIN/$NAME" "$SHARE/applications/$NAME.desktop" "$SHARE/icons/hicolor/scalable/apps/$NAME.svg"
  echo "Removed. Shows and recordings remain in ~/.local/share/$NAME"; exit 0
fi
MISSING=""
for t in python3 ffmpeg ffprobe openssl; do command -v $t >/dev/null 2>&1 || MISSING="$MISSING $t"; done
if [ -n "$MISSING" ]; then
  echo "Missing:$MISSING"
  if command -v apt-get >/dev/null 2>&1 && [ "$(id -u)" = 0 ]; then
    apt-get update && apt-get install -y python3 ffmpeg openssl rsync fontconfig fonts-dejavu-core
  else
    echo "Install them first, e.g.:  sudo apt install python3 ffmpeg openssl rsync"; exit 1
  fi
fi
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || { echo "Python 3.9 or newer is required."; exit 1; }
mkdir -p "$APP" "$BIN" "$SHARE/applications" "$SHARE/icons/hicolor/scalable/apps"
rm -rf "$APP/server" "$APP/web"
cp -r "$HERE/server" "$HERE/web" "$HERE/README.md" "$APP/"
printf '#!/bin/sh\nexec python3 "%s/server/studio.py" --open "$@"\n' "$APP" > "$BIN/$NAME"; chmod 755 "$BIN/$NAME"
cat > "$SHARE/applications/$NAME.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=IPRPS Podcast Studio
Comment=Record, edit and publish audio and video podcasts with remote and AI guests
Exec=$BIN/$NAME
Icon=$NAME
Terminal=false
Categories=AudioVideo;Audio;Video;Recorder;
StartupWMClass=iprps-podcast-studio
DESKTOP
cp "$HERE/web/img/icon.svg" "$SHARE/icons/hicolor/scalable/apps/$NAME.svg"
echo "Installed. Start IPRPS Podcast Studio from the applications menu, or run: $NAME"
echo "Remote guests connect on TCP port 8766: allow it through the firewall if you use one."
