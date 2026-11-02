<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Session Master Hub - app list API.
//   GET  ?action=icon&app=FOLDER   the app's icon (public: images can't send the sign-in token)
//   GET  ?action=apps              every app in the IPRPS folder, with this user's on/off choice
//   POST ?action=save   {enabled: [folders]}   save this user's choice
//   POST ?action=reset             back to the defaults (default-apps.json)

const IPRPS_WEB = '/srv/www/iprps';
const SKIP = ['auth', 'hub', 'sql', 'shared', 'assets', 'includes', 'vendor', 'node_modules'];
const ICON_DIRS = ['/usr/share/icons/IPRPS/256x256/apps', '/usr/share/iprps/icons'];

function web_root(): string { return rtrim(getenv('HUB_WEB_ROOT') ?: IPRPS_WEB, '/'); }
function valid_folder(string $f): bool { return (bool)preg_match('/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}$/', $f) && strpos($f, '..') === false; }

// ---------------------------------------------------------------- icons (no sign-in)
if (($_GET['action'] ?? '') === 'icon') {
    $app = (string)($_GET['app'] ?? '');
    $file = null;
    if (valid_folder($app)) {
        $dir = web_root() . '/' . $app;
        foreach (['favicon.svg', 'icon.svg', 'logo.svg', 'favicon.png', 'icon.png', 'logo.png', 'assets/icon.png',
                  'assets/logo.png', 'assets/favicon.png', 'images/icon.png', 'img/icon.png', 'favicon.ico'] as $c) {
            if (is_file("$dir/$c")) { $file = "$dir/$c"; break; }
        }
        if (!$file) foreach (ICON_DIRS as $d) {
            foreach (["$d/$app.png", "$d/$app.svg"] as $c) if (is_file($c)) { $file = $c; break 2; }
        }
    }
    if (!$file) { http_response_code(404); exit; }
    $types = ['svg' => 'image/svg+xml', 'png' => 'image/png', 'ico' => 'image/x-icon'];
    header('Content-Type: ' . ($types[strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? 'application/octet-stream'));
    header('Cache-Control: max-age=3600');
    readfile($file);
    exit;
}

require getenv('HUB_AUTH_CHECK') ?: __DIR__ . '/../auth/auth-check.php';
$USER = ip_require_login_api();
$UID = (int)$USER['id'];

function out($d, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $m, int $code = 400): void { out(['ok' => false, 'error' => $m], $code); }

function hub_db(): PDO {
    $c = require (getenv('HUB_DB_CONFIG') ?: '/etc/iprps/db.php');
    $pdo = new PDO("mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['pass'],
                   [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec("CREATE TABLE IF NOT EXISTS hub_app_prefs (
        user_id  INT NOT NULL,
        folder   VARCHAR(100) NOT NULL,
        enabled  BOOLEAN NOT NULL,
        PRIMARY KEY (user_id, folder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    return $pdo;
}

function json_file(string $name): array {
    $f = __DIR__ . "/$name";
    $j = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($j) ? $j : [];
}

function pretty(string $folder): string {
    $s = ucwords(str_replace(['-', '_'], ' ', $folder));
    return preg_replace_callback('/\b(Iprps|Sfx|Crt|Ai|Ui|Db)\b/', fn($m) => strtoupper($m[1]), $s);
}

// Every app folder that has a start page.
function scan_apps(): array {
    $names = json_file('app-names.json');
    $apps = [];
    foreach (scandir(web_root()) ?: [] as $f) {
        if ($f[0] === '.' || in_array($f, SKIP, true) || !valid_folder($f) || !is_dir(web_root() . "/$f")) continue;
        $start = null;
        foreach (['index.php', 'index.html', 'index.htm'] as $i) if (is_file(web_root() . "/$f/$i")) { $start = $i; break; }
        if (!$start) continue;
        $name = $names[$f]['name'] ?? null;
        if (!$name) {
            $head = (string)@file_get_contents(web_root() . "/$f/$start", false, null, 0, 6000);
            if (preg_match('/<title>([^<]{2,60})<\/title>/i', $head, $m) && strpos($m[1], '<?') === false && strpos($m[1], '{{') === false)
                $name = html_entity_decode(trim($m[1]), ENT_QUOTES);
        }
        $apps[$f] = ['folder' => $f, 'name' => $name ?: pretty($f), 'description' => $names[$f]['description'] ?? ''];
    }
    return $apps;
}

try { $db = hub_db(); } catch (Throwable $e) { fail('The IPRPS database is not reachable. Is MariaDB running?', 503); }
$defaults = json_file('default-apps.json')['apps'] ?? [];
$action = $_GET['action'] ?? '';
$in = $_SERVER['REQUEST_METHOD'] === 'POST' ? (json_decode(file_get_contents('php://input'), true) ?: []) : [];

switch ($action) {
case 'apps':
    $apps = scan_apps();
    $st = $db->prepare('SELECT folder, enabled FROM hub_app_prefs WHERE user_id = ?');
    $st->execute([$UID]);
    $mine = [];
    foreach ($st->fetchAll() as $r) $mine[$r['folder']] = (bool)$r['enabled'];
    $list = [];
    foreach ($apps as $f => $a) {
        $a['default'] = in_array($f, $defaults, true);
        $a['enabled'] = $mine[$f] ?? $a['default'];       // apps added later follow the defaults
        $list[] = $a;
    }
    $order = array_flip($defaults);
    usort($list, fn($x, $y) => [$order[$x['folder']] ?? 999, strtolower($x['name'])] <=> [$order[$y['folder']] ?? 999, strtolower($y['name'])]);
    $missing = array_values(array_filter($defaults, fn($f) => !isset($apps[$f])));
    out(['ok' => true, 'user' => $USER, 'apps' => $list, 'missing_defaults' => $missing, 'customised' => (bool)$mine]);

case 'save':
    $apps = scan_apps();
    $on = array_flip(array_filter((array)($in['enabled'] ?? []), 'is_string'));
    $db->beginTransaction();
    $db->prepare('DELETE FROM hub_app_prefs WHERE user_id = ?')->execute([$UID]);
    $ins = $db->prepare('INSERT INTO hub_app_prefs (user_id, folder, enabled) VALUES (?, ?, ?)');
    foreach ($apps as $f => $a) $ins->execute([$UID, $f, isset($on[$f]) ? 1 : 0]);
    $db->commit();
    out(['ok' => true, 'enabled' => count(array_intersect_key($on, $apps))]);

case 'reset':
    $db->prepare('DELETE FROM hub_app_prefs WHERE user_id = ?')->execute([$UID]);
    out(['ok' => true]);

default:
    fail('Unknown action.', 404);
}
