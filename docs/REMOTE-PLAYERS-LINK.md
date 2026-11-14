# Remote players with IPRPS Link

Players in another city or state open a link in any browser and sit at your IPRPS Table like everyone
else. They install nothing. You change nothing on your router. IPRPS OS itself is not changed: IPRPS Link
is one more app, installed through IPRPS Updates.

(The Tailscale method in `REMOTE-PLAYERS.md` still works. Use it when players are willing to install an
app; use IPRPS Link when they are not.)

## How it works

```
 remote player's browser ──https──▶  your RELAY  ◀──https── IPRPS Link ──▶ IPRPS Table
   (phone, tablet, laptop)        (public address)        (on your IPRPS OS computer, port 7777)
```

- **The relay** is a small program at a public address you control. Players open it.
- **IPRPS Link** runs on your IPRPS OS computer. It calls *out* to the relay, collects what players ask
  for, asks the IPRPS Table on the same computer, and sends the answers back.
- The Table sees each remote player as one more player, with their own address (`127.77.x.y`), join
  code, name, chat, dice, pictures and sound.
- The Session Master console (`/sm/`) is never passed along. It stays on your computer only.
- Only **your Infinite Plane account** can connect a table to your relay.

## Pick a relay

| | **A. Node.js relay** (`relay/node`) | **B. PHP relay** (`relay/php`) |
|---|---|---|
| Runs on | a server where you can run a service (a small VPS or AWS instance) | ordinary web hosting (PHP 7.4+, no database) |
| Speed | chat and dice arrive at once | a fraction of a second later; about half a second on hosts that hold responses back |
| Setup | Node.js + HTTPS (Caddy or nginx) | upload one folder |
| Best address | `https://play.example.com` | `https://play.example.com` or `https://example.com/play` |

Both speak the same language to IPRPS Link, so you can switch later by changing one address.

> **Use a subdomain if you can** (`play.example.com`, not `example.com/play`). Game pages then cannot
> touch anything else on your site, such as a signed-in session.

## One time: the sign-in hand-off page

**WHERE: your Infinite Plane site (file manager or FTP)**

Upload `relay/auth/link.html` into the shared `/auth/` folder, beside `auth-client.js`:

```
/auth/link.html
```

IPRPS Link sends you to this page to sign in. It hands your session back only to a page on your own
computer (`http://localhost:.../auth/callback`) and to nothing else.

## A. Node.js relay on a server

**WHERE: RELAY SERVER (as root)**

```
mkdir -p /opt/iprps-link-relay
cp relay.js relay.env.sample /opt/iprps-link-relay/
cd /opt/iprps-link-relay && cp relay.env.sample relay.env
nano relay.env          # set PUBLIC_URL=https://play.example.com
cp iprps-link-relay.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now iprps-link-relay
```

Point the name `play.example.com` at the server, then put HTTPS in front. With Caddy
(`Caddyfile.sample`) the certificate is automatic:

```
play.example.com {
	reverse_proxy 127.0.0.1:8787 {
		flush_interval -1
	}
}
```

For nginx see `nginx.sample.conf` (`proxy_buffering off` matters). Check it:

```
curl https://play.example.com/_link/health        # {"ok":true,"relay":"node",...}
```

## B. PHP relay on web hosting

**WHERE: your web host (file manager or FTP)**

1. Make a folder for it, for example `play` (or a subdomain `play.example.com` that points to a folder).
2. Upload `relay/php/index.php` and `relay/php/.htaccess` into it.
3. Optional: copy `config.sample.php` to `config.php` and edit it.
4. Open `https://example.com/play/_link/health` in a browser. You should see `{"ok":true,"relay":"php",...}`.

The relay makes its own `data` folder and locks it. If the health page says it cannot write, make the
folder writable. On the Infinite Plane site itself the relay finds `/auth/` and checks accounts directly.

## On your IPRPS OS computer

**WHERE: IPRPS OS**

1. Open **IPRPS Updates** and install **IPRPS Link** (or `sudo pacman -S iprps-link`).
2. Open **IPRPS Link** from the IPRPS menu or the Hub.
3. **Sign in with Infinite Plane.** Your browser opens the sign-in page; choose **Allow**.
4. Type your **relay address** and **Save**.
5. **Turn on.** The first account to connect becomes the relay's owner.
6. Copy the link (or show the QR code) and send it to your remote players.
7. Open the table in **IPRPS Table** and give players the join code, as always.

The link is the same every session. Turn remote play off when the session ends; players then see a
waiting page.

## What remote players can and cannot do

They can do everything a player on your Wi-Fi can: join with the code, chat (also privately), roll IPRPS
dice, send pictures and audio, fill in and send a character sheet, and see and hear what you push to
their screen. They cannot open the Session Master console, and they cannot reach anything else on your
computer or network: IPRPS Link only ever talks to the Table's port.

## Safety

- Everything between players, relay and your computer travels over HTTPS. Use an `https://` relay address.
- The join code still guards the table. The relay also slows down guessing (12 tries per 5 minutes per visitor).
- Your Infinite Plane sign-in is kept in `/var/lib/iprps-link/config.json`, readable only by the
  `iprps-link` service account. The relay never stores it; it checks it and hands back a one-session key.
- To let a co-Session Master use your relay, list both accounts: `OWNERS=name1,name2` (Node) or
  `'owners' => ['name1', 'name2']` (PHP).
- To give the relay to another account, delete `data/owner.json` on the relay.

## If something is not working

| What you see | What to do |
|---|---|
| "No IPRPS Link relay answered" | Open `<relay address>/_link/health` in a browser. Fix the relay first. |
| "This relay belongs to another Session Master" | Another account connected first. Delete `data/owner.json` on the relay, or set the owners list. |
| "Your Infinite Plane sign-in has ended" | Sign in again in IPRPS Link. |
| Players see "The Session Master's table isn't connected" | Remote play is off, or your computer is offline. |
| Players see "No table is open yet" | Open the table in the IPRPS Table console. |
| Chat arrives late on the PHP relay | Normal on hosts that hold responses back. Move to the Node.js relay for instant chat. |
| Long videos stall on the PHP relay | Your host stops long requests. Use the Node.js relay for video. |
| Service state | `systemctl status iprps-link` and `journalctl -u iprps-link -e` |

## For the maintainer: publishing the update

**WHERE: BUILDER (in the build image)**

```
cd /build/src/iprps-os/packages/iprps-link
makepkg -f --nodeps
```

**WHERE: DEBIAN ROOT**

Sign and publish with `build-host/iprps-repo.sh` as for any app update (`add`, `check`, `stage`, upload,
`online`). The Hub tile is named in `apps/hub/app-names.json` (`link`).

## Tests

```
node tests/iprps-link/e2e.js node          # real Table + Link + Node relay
node tests/iprps-link/e2e.js php           # ... + PHP relay (needs php)
node tests/iprps-link/e2e.js php burst     # ... as on a host that holds responses back
python3 tests/iprps-link/browser_test.py node   # Chrome: sign in, turn on, join, chat, roll
```
