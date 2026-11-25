# IPRPS Link relay dashboard

For a PHP relay (`relay/php`, 1.1 or newer) run as a **relay service** for many Session Masters. It shows who is
online and lets you approve, suspend, block, re-address, limit and delete Session Masters, pre-set accounts, change
the relay's settings and plans, and read its activity.

**Where it goes:** the main site, the one with the shared `/auth/` folder, one folder deep, for example
`https://infiniteplane.space/play-admin/`. It signs you in with your Infinite Plane account (`../auth/auth-client.js`).
**Not** on the relay's own address: with open sign-up, pages there come from strangers' computers.

1. Set the relay's address in `config.js`.
2. On the relay, in `config.php`: your username in `admins`, and this site in `dashboard_origins`
   (`https://infiniteplane.space` by default).
3. Upload `index.html`, `admin.js`, `admin.css` and `config.js`, and open the folder's address.

Everything it shows comes from the relay's `/_admin/` API, which answers only admins' sign-ins and only pages from
`dashboard_origins`. See `docs/REMOTE-PLAYERS-LINK.md`, section C, and the build guide, 12.13.
