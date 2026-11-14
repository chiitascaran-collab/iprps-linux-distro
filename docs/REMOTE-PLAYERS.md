# Remote players on IPRPS OS

> Players who cannot or will not install an app can join from a plain browser with **IPRPS Link**: see `REMOTE-PLAYERS-LINK.md`.

*For Session Masters with players in another city or state. From Appendix G of the build guide.*

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

## G.1 The Session Master's computer

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

## G.2 Invite a player

In the admin console, open the **⋯** menu next to **iprps-table** and choose **Share…**. Copy the invite link (or enter the player's email) and send it to the player. One invite per player: you can see and revoke them under **Share…** later.

A shared computer is **quarantined**: the player can connect to it, but it can't connect to the player's devices, and the player sees none of your other devices.

## G.3 Allow players only the Table

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

## G.4 The player's side

1. Install Tailscale from https://tailscale.com/download and sign in with their own free account. On IPRPS OS, use the same script (G.1).
2. Open the invite link from the Session Master and click **Accept**. **iprps-table** appears in their Tailscale app.
3. At game time, the Session Master opens the table (**IPRPS Table → Open the table**). The console now lists the `100.x.y.z` address too, beside the local one. The player opens `http://100.x.y.z:7777/` in their browser and joins with the code.

The connection is encrypted end to end by Tailscale, so the Table's plain `http://` address is safe here: nothing crosses the internet unencrypted.

## G.5 Test it before game night

Use a phone as the "remote" player: install the Tailscale app on it, sign in with a **second** account (not the Session Master's), and accept the invite. Turn the phone's **Wi-Fi off** so it uses mobile data, open the table, and join at `http://100.x.y.z:7777/`. Send a message, roll a skill check, and **Show** an image from the console.

On the Session Master's computer:

```bash
sudo bash ~/Downloads/iprps-remote-play.sh status
```

It shows `active`, the address, and the connected devices. `direct` next to the player means a direct connection; `relay "…"` means Tailscale passes the traffic through one of its relay servers (still encrypted, a little slower), which happens when both sides are behind strict routers.

## G.6 Remove it

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
