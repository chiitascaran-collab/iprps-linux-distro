#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
# iprps-remote-play.sh - let players in other cities join the IPRPS Table, through Tailscale.
#
# Installs Tailscale's official static build into /opt/tailscale and starts it as a service.
# It changes nothing that belongs to IPRPS OS: no packages, no IPRPS files, no firewall, no DNS.
# Everything it adds:  /opt/tailscale  /etc/systemd/system/tailscaled.service  /var/lib/tailscale
#
#   sudo bash iprps-remote-play.sh            install (or update) and sign in
#   sudo bash iprps-remote-play.sh status     address, sign-in state, connected peers
#   sudo bash iprps-remote-play.sh remove     stop it and remove everything it added
#
# TS_VERSION=1.104.5 picks a version (default below; see https://pkgs.tailscale.com/stable/#static).
set -euo pipefail
VER=${TS_VERSION:-1.104.5}
DIR=/opt/tailscale
UNIT=/etc/systemd/system/tailscaled.service
URL=https://pkgs.tailscale.com/stable/tailscale_${VER}_amd64.tgz
TS="$DIR/tailscale"

[ "$(id -u)" = 0 ] || { echo "Run it with sudo."; exit 1; }

case "${1:-install}" in
status)
  systemctl is-active tailscaled || true
  "$TS" ip -4 2>/dev/null && echo "Players join at:  http://$("$TS" ip -4 | head -1):7777/"
  "$TS" status || true
  exit 0 ;;
remove)
  "$TS" logout 2>/dev/null || true
  systemctl disable --now tailscaled 2>/dev/null || true
  rm -rf "$UNIT" "$DIR" /var/lib/tailscale /run/tailscale
  systemctl daemon-reload
  echo "Tailscale removed. Also delete this computer under Machines at https://login.tailscale.com/admin/machines"
  exit 0 ;;
install) ;;
*) echo "Usage: sudo bash $0 [install|status|remove]"; exit 1 ;;
esac

# 1. The kernel's TUN device. Tailscale must use it: its "userspace" mode would hand players'
#    connections to the Table as if they came from this computer itself.
modprobe tun 2>/dev/null || true
[ -c /dev/net/tun ] || { echo "No /dev/net/tun: this kernel has no TUN support (CONFIG_TUN). Stopping."; exit 1; }

# 2. Download and check the official build.
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
echo "Downloading Tailscale $VER..."
curl -fL --proto '=https' --tlsv1.2 -o "$T/ts.tgz" "$URL"
want=$(curl -fsSL --proto '=https' --tlsv1.2 "$URL.sha256" | tr -d '[:space:]')
have=$(sha256sum "$T/ts.tgz" | cut -d' ' -f1)
[[ "$want" =~ ^[0-9a-f]{64}$ ]] && [ "$want" = "$have" ] || { echo "Checksum does not match. Nothing was installed."; exit 1; }
echo "Checksum OK."
tar -xzf "$T/ts.tgz" -C "$T"
install -d -m755 "$DIR"
install -m755 "$T/tailscale_${VER}_amd64/tailscale" "$T/tailscale_${VER}_amd64/tailscaled" "$DIR/"

# 3. The service. No firewall rules and no DNS changes: IPRPS OS keeps its own settings.
cat > "$UNIT" <<EOF
[Unit]
Description=Tailscale (IPRPS remote players)
Wants=network-online.target
After=network-online.target

[Service]
ExecStartPre=-/usr/sbin/modprobe tun
ExecStart=$DIR/tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/run/tailscale/tailscaled.sock --port=41641
ExecStopPost=$DIR/tailscaled --cleanup
StateDirectory=tailscale
StateDirectoryMode=0700
RuntimeDirectory=tailscale
RuntimeDirectoryMode=0755
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable tailscaled
systemctl restart tailscaled
for _ in $(seq 1 20); do [ -S /run/tailscale/tailscaled.sock ] && break; sleep 0.5; done

# 4. Sign in (prints a link the first time; open it in Firefox and log in).
"$TS" up --accept-dns=false --netfilter-mode=off --hostname="${TS_HOSTNAME:-iprps-table}"
ip4=$("$TS" ip -4 | head -1)
echo
echo "Done. This computer's private address: $ip4"
echo "Remote players join the IPRPS Table at:  http://$ip4:7777/"
echo "Next: share this computer with each player (Machines → iprps-table → Share) and limit them to port 7777."
