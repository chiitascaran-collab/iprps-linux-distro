# IPRPS Master Database (IPRPS OS)

One web app over one catalog database for the Infinite Plane Role Playing System: bestiary,
tavern ledger, humanoid species, physical weapons, weapon armory, grimoire, flora and fauna,
gear, covenants and dungeon traps, in one searchable place, with printable reports and
`.iprps` exports. Mythical Legends Publishing, LLC © 2026.

This is the IPRPS OS version of `https://infiniteplane.space/master_db/`. The differences:

| | infiniteplane.space | IPRPS OS |
|---|---|---|
| Database | The site's hosted database | This computer's MariaDB: database `iprps_master`, created on first use with its tables and catalog templates (`schema.sql`) |
| Password | In `config.php` | None in the app: it reads `/etc/iprps/db.php`, which first boot writes (guide 13.1) |
| Admins | Emails listed in `config.php` | **Every account on this computer**, unless `/etc/iprps/master-db-admins.php` lists emails (`<?php return ['you@example.com'];`); then those accounts edit and everyone else reads |
| Sign-in | The site's central login | The Universal Login (`/srv/www/iprps/auth`) |
| Migration from the old tools | `migrate.php` | Not included (it held the site's database passwords) |

**Starter data:** the catalog starts empty. An admin opens **⭳ Import** and chooses
**Import ALL starter datasets** (about 2,500 entries from `seed_data/`), or imports single
files. Duplicates are skipped, so importing again is safe.

**Images** that admins upload are kept in `images/` (owned by the web server, and kept when the
app is updated).

Installed by the `iprps-master-db` package to `/srv/www/iprps/master_db/`; opens from the
Session Master Hub and the IPRPS menu.
