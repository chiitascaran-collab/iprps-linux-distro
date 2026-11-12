<?php
/**
 * IPRPS Master Database — configuration (IPRPS OS edition)
 * Mythical Legends Publishing, LLC © 2026
 *
 * On IPRPS OS the app uses this computer's own MariaDB, with the database user and the
 * password that first boot writes to /etc/iprps/db.php (guide 13.1). No password is
 * stored in the app. The catalog lives in its own database, iprps_master, which the app
 * creates (with its tables and catalog templates) the first time it's opened.
 */

// This computer's database settings (written by iprps-db-init). IPRPS_DB_CONFIG overrides it for tests.
$IPRPS_DB = require (getenv('IPRPS_DB_CONFIG') ?: '/etc/iprps/db.php');
define('DB_NAME', 'iprps_master');

// -- Who is an ADMIN (full CRUD). Everyone else who is signed in is read-only.
// Match against the Universal Login email. Case-insensitive.
// On IPRPS OS the computer belongs to its Session Master, so by default EVERY account on this
// computer is an admin. To limit editing to some accounts, list their emails in
// /etc/iprps/master-db-admins.php:  <?php return ['you@example.com'];
$ADMIN_EMAILS = is_file('/etc/iprps/master-db-admins.php') ? (array)(require '/etc/iprps/master-db-admins.php') : [];

// -- Image storage -----------------------------------------------------------
define('IMAGE_DIR', __DIR__ . '/images/');   // absolute path for file ops (owned by the web server)
define('IMAGE_URL', 'images/');               // relative URL for the browser
define('MAX_IMAGE_SIZE', 4000000);            // 4MB per image (backstop; the app downscales client-side)

if (!is_dir(IMAGE_DIR)) {
    @mkdir(IMAGE_DIR, 0755, true);
}
