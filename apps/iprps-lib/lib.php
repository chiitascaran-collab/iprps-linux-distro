<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS session tools - shared PHP: database, sign-in, the core-schema additions, the session log,
// the player display, and the bridge to the IPRPS Table. Used by the Combat Tracker, Dice Roller,
// Session Log, IPRPS Welcome and api.php in this folder.

require_once getenv('IPRPS_AUTH_CHECK') ?: __DIR__ . '/../auth/auth-check.php';

const IP_LOG_KINDS = ['note', 'roll', 'combat', 'loot', 'xp', 'event'];
const IP_TABLE_URL = 'http://127.0.0.1:7777';          // the IPRPS Table service on this computer (12.7)

function ip_out($d, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function ip_fail(string $m, int $code = 400): void { ip_out(['ok' => false, 'error' => $m], $code); }
function ip_input(): array {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return [];
    $j = json_decode((string)file_get_contents('php://input'), true);
    return is_array($j) ? $j : [];
}
function ip_txt($v, int $max): string {
    if (is_array($v) || is_object($v)) return '';
    $s = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$v) ?? '');
    return mb_strlen($s) > $max ? mb_substr($s, 0, $max) : $s;
}
function ip_id($v): ?int { $v = (int)$v; return $v > 0 ? $v : null; }

// The signed-in Session Master (Universal Login).
function ip_user(): array { return ip_require_login_api(); }

function ip_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    try {
        $c = require (getenv('IPRPS_DB_CONFIG') ?: '/etc/iprps/db.php');
        $dsn = !empty($c['socket']) ? "mysql:unix_socket={$c['socket']};dbname={$c['name']};charset=utf8mb4"
                                    : "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    } catch (Throwable $e) {
        ip_fail('The IPRPS database is not reachable. Is MariaDB running?', 503);
    }
    ip_schema($pdo);
    return $pdo;
}

// Additions to the core schema (10.2), applied once per database: combat-tracker columns,
// per-user settings, the API key vault, and the player display table.
const IP_SCHEMA_VERSION = 1;
function ip_schema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS iprps_meta (k VARCHAR(40) PRIMARY KEY, v VARCHAR(100) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $st = $db->query("SELECT v FROM iprps_meta WHERE k = 'session_tools'");
    if ((int)($st->fetchColumn() ?: 0) >= IP_SCHEMA_VERSION) return;
    $db->exec("ALTER TABLE encounters
        ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'standard',
        ADD COLUMN IF NOT EXISTS turn_idx SMALLINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    $db->exec("ALTER TABLE initiative
        ADD COLUMN IF NOT EXISTS hp_max INT NULL,
        ADD COLUMN IF NOT EXISTS ar SMALLINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS init_mod SMALLINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS side ENUM('party','ally','foe','neutral') NOT NULL DEFAULT 'foe',
        ADD COLUMN IF NOT EXISTS sheet_id INT UNSIGNED NULL,
        ADD COLUMN IF NOT EXISTS defeated BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS rolled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS notes VARCHAR(500) NULL");
    $db->exec("CREATE TABLE IF NOT EXISTS user_settings (
        user_id INT NOT NULL, name VARCHAR(60) NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY (user_id, name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS user_secrets (
        user_id INT NOT NULL, provider VARCHAR(40) NOT NULL, label VARCHAR(80), secret_enc TEXT NOT NULL,
        hint VARCHAR(12), updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, provider)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS display_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, campaign_id INT UNSIGNED NULL,
        kind ENUM('text','image','clear') NOT NULL DEFAULT 'text', title VARCHAR(160), body MEDIUMTEXT,
        shown_by INT NULL, shown_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->prepare("REPLACE INTO iprps_meta (k, v) VALUES ('session_tools', ?)")->execute([(string)IP_SCHEMA_VERSION]);
}

// ---------------------------------------------------------------- campaigns and sessions
function ip_campaign_exists(PDO $db, ?int $id): bool {
    if (!$id) return false;
    $st = $db->prepare('SELECT 1 FROM campaigns WHERE id = ?'); $st->execute([$id]);
    return (bool)$st->fetch();
}
function ip_session(PDO $db, ?int $id): ?array {
    if (!$id) return null;
    $st = $db->prepare('SELECT s.*, c.name AS campaign_name FROM sessions s JOIN campaigns c ON c.id = s.campaign_id WHERE s.id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}
// The newest session of a campaign (what "the current session" means everywhere).
function ip_latest_session(PDO $db, ?int $campaign): ?array {
    if (!$campaign) return null;
    $st = $db->prepare('SELECT * FROM sessions WHERE campaign_id = ? ORDER BY session_no DESC LIMIT 1');
    $st->execute([$campaign]);
    return $st->fetch() ?: null;
}
function ip_log(PDO $db, int $session, string $kind, string $text): int {
    $kind = in_array($kind, IP_LOG_KINDS, true) ? $kind : 'note';
    $text = ip_txt($text, 20000);
    if ($text === '') ip_fail('Nothing to log.');
    $db->prepare('INSERT INTO session_log (session_id, kind, text) VALUES (?, ?, ?)')->execute([$session, $kind, $text]);
    return (int)$db->lastInsertId();
}

// ---------------------------------------------------------------- showing things to the players
// The player display (Session Master Mode, second screen or projector).
function ip_display(PDO $db, ?int $campaign, string $title, string $body, int $uid): int {
    $db->prepare("INSERT INTO display_items (campaign_id, kind, title, body, shown_by) VALUES (?, 'text', ?, ?, ?)")
       ->execute([$campaign, mb_substr($title, 0, 160) ?: null, $body, $uid]);
    return (int)$db->lastInsertId();
}
// The IPRPS Table (players' own devices). The Table only takes Session Master requests from this
// computer, so the web server asks it on the Session Master's behalf.
function ip_table(string $path, ?array $body = null): ?array {
    if (!function_exists('curl_init')) return null;
    $ch = curl_init((getenv('IPRPS_TABLE_URL') ?: IP_TABLE_URL) . $path);
    $h = ['Host: localhost', 'X-IPRPS-SM: 1', 'X-IPRPS: 1'];
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5, CURLOPT_CONNECTTIMEOUT => 2]);
    if ($body !== null) {
        $h[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $h);
    $r = curl_exec($ch);
    curl_close($ch);
    return $r === false ? null : (json_decode($r, true) ?: null);
}
function ip_table_open(): bool { $i = ip_table('/api/info'); return (bool)($i['open'] ?? false); }
function ip_table_push(string $title, string $text): array {
    $i = ip_table('/api/info');
    if ($i === null) return ['ok' => false, 'error' => 'The IPRPS Table service is not running.'];
    if (empty($i['open'])) return ['ok' => false, 'error' => 'The IPRPS Table is closed: open it in the Table console first.'];
    $r = ip_table('/api/sm/push', ['kind' => 'text', 'title' => mb_substr($title, 0, 120), 'text' => mb_substr($text, 0, 4000), 'target' => ['type' => 'all']]);
    return $r ?: ['ok' => false, 'error' => 'The IPRPS Table did not answer.'];
}

// ---------------------------------------------------------------- per-user settings
function ip_setting(PDO $db, int $uid, string $name, ?string $default = null): ?string {
    $st = $db->prepare('SELECT value FROM user_settings WHERE user_id = ? AND name = ?');
    $st->execute([$uid, $name]);
    $v = $st->fetchColumn();
    return $v === false ? $default : $v;
}
function ip_set_setting(PDO $db, int $uid, string $name, string $value): void {
    $db->prepare('REPLACE INTO user_settings (user_id, name, value) VALUES (?, ?, ?)')->execute([$uid, $name, $value]);
}

// Character sheets (12.9), if that app is installed: the Session Master's own sheets.
function ip_sheets_available(PDO $db): bool {
    try { $db->query('SELECT 1 FROM character_sheets LIMIT 0'); return true; } catch (Throwable $e) { return false; }
}
