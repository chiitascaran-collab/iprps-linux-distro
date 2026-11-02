<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Character Sheets - JSON API. Every sheet belongs to one Universal Login account.
//
// GET  ?action=info                                   which companion apps are installed
// GET  ?action=campaigns                              campaigns from the IPRPS core database
// GET  ?action=list[&kind=pc|npc|creature][&campaign=ID|none][&q=text]
// GET  ?action=get&id=N                               one sheet (with its portrait) and its details
// GET  ?action=export&id=N                            the sheet as a .json download (fetch it: it needs the sign-in token)
// GET  ?action=summary&id=N                           the sheet as text (IPRPS Table text cards)
// POST ?action=save    {id?, sheet, campaign_id?, kind?, source?, file_name?, thumb?}   import, or save from an editor
// POST ?action=meta    {id, campaign_id?, kind?, notes?}
// POST ?action=delete  {id}

require __DIR__ . '/lib.php';
require getenv('CS_AUTH_CHECK') ?: __DIR__ . '/../auth/auth-check.php';
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

try {
    $c = require (getenv('CS_DB_CONFIG') ?: '/etc/iprps/db.php');
    $dsn = !empty($c['socket']) ? "mysql:unix_socket={$c['socket']};dbname={$c['name']};charset=utf8mb4"
                                : "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4";
    $db = new PDO($dsn, $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    cs_schema($db);
} catch (Throwable $e) {
    fail('The IPRPS database is not reachable. Is MariaDB running?', 503);
}

$action = $_GET['action'] ?? '';
$in = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $in = json_decode($raw, true);
    if (!is_array($in)) fail($raw === '' ? 'The sheet was too large to send (the limit is 16 MB).' : 'Bad request.', $raw === '' ? 413 : 400);
}

function row(PDO $db, int $uid, int $id): array {
    $st = $db->prepare('SELECT s.*, c.name AS campaign_name FROM character_sheets s LEFT JOIN campaigns c ON c.id = s.campaign_id
                        WHERE s.id = ? AND s.user_id = ?');
    $st->execute([$id, $uid]);
    $r = $st->fetch();
    if (!$r) fail('That character sheet was not found.', 404);
    return $r;
}
function meta(array $r): array {
    unset($r['sheet_json'], $r['avatar']);
    foreach (['id', 'level', 'hp', 'armor', 'campaign_id', 'user_id'] as $k) if ($r[$k] !== null) $r[$k] = (int)$r[$k];
    if ($r['mp'] !== null) $r['mp'] = (int)$r['mp'];
    return $r;
}
function full(array $r): array {
    $s = json_decode($r['sheet_json'], true) ?: [];
    $s['avatar'] = $r['avatar'] ?: null;
    return $s;
}

try {
    switch ($action) {
    case 'info':
        out(['ok' => true, 'user' => $USER,
             'oracle' => is_file(__DIR__ . '/../oracle/api.php'),
             'creator' => is_file(__DIR__ . '/../character-creator/index.html')]);

    case 'campaigns':
        $rows = $db->query("SELECT id, name, setting, status FROM campaigns ORDER BY FIELD(status,'active','planning','paused','finished'), name")->fetchAll();
        out(['ok' => true, 'campaigns' => $rows]);

    case 'list':
        $sql = 'SELECT s.id, s.kind, s.name, s.player_name, s.race, s.class, s.level, s.hp, s.mp, s.armor, s.campaign_id,
                       c.name AS campaign_name, s.thumb, s.source, s.file_name, s.updated_at, (s.avatar IS NOT NULL) AS has_avatar
                FROM character_sheets s LEFT JOIN campaigns c ON c.id = s.campaign_id WHERE s.user_id = ?';
        $args = [$UID];
        $k = $_GET['kind'] ?? '';
        if (isset(CS_KINDS[$k])) { $sql .= ' AND s.kind = ?'; $args[] = $k; }
        $camp = $_GET['campaign'] ?? '';
        if ($camp === 'none') $sql .= ' AND s.campaign_id IS NULL';
        elseif ((int)$camp > 0) { $sql .= ' AND s.campaign_id = ?'; $args[] = (int)$camp; }
        $q = trim((string)($_GET['q'] ?? ''));
        if ($q !== '') {
            $sql .= ' AND (s.name LIKE ? OR s.player_name LIKE ? OR s.race LIKE ? OR s.class LIKE ?)';
            $like = '%' . addcslashes($q, '%_\\') . '%';
            array_push($args, $like, $like, $like, $like);
        }
        $sql .= " ORDER BY FIELD(s.kind,'pc','npc','creature'), s.name, s.id";
        $st = $db->prepare($sql); $st->execute($args);
        $rows = array_map(function ($r) {
            foreach (['id', 'level', 'hp', 'armor', 'campaign_id', 'has_avatar'] as $k) if ($r[$k] !== null) $r[$k] = (int)$r[$k];
            if ($r['mp'] !== null) $r['mp'] = (int)$r['mp'];
            return $r;
        }, $st->fetchAll());
        out(['ok' => true, 'sheets' => $rows]);

    case 'get':
        $r = row($db, $UID, (int)($_GET['id'] ?? 0));
        out(['ok' => true, 'sheet' => full($r), 'meta' => meta($r)]);

    case 'export':
        $r = row($db, $UID, (int)($_GET['id'] ?? 0));
        $name = trim(preg_replace('/[^\p{L}\p{N} _-]+/u', '', $r['name'])) ?: 'character';
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode(str_replace(' ', '_', $name) . '_infinite_plane.json'));
        echo json_encode(full($r), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;

    case 'summary':
        $r = row($db, $UID, (int)($_GET['id'] ?? 0));
        $s = json_decode($r['sheet_json'], true) ?: [];
        out(['ok' => true, 'title' => $r['name'], 'text' => cs_clip_lines(cs_summary($s, $r['kind'], true, $r), 3900)]);

    case 'save':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
        $res = cs_save($db, $UID, $in['sheet'] ?? null, array_intersect_key($in, array_flip(['id', 'campaign_id', 'kind', 'source', 'file_name', 'thumb'])));
        out(['ok' => true] + $res);

    case 'meta':
        $r = row($db, $UID, (int)($in['id'] ?? 0));
        $sets = []; $args = [];
        if (array_key_exists('campaign_id', $in)) {
            $camp = (int)$in['campaign_id'] > 0 ? (int)$in['campaign_id'] : null;
            if ($camp) { $st = $db->prepare('SELECT 1 FROM campaigns WHERE id = ?'); $st->execute([$camp]); if (!$st->fetch()) fail('That campaign no longer exists.'); }
            $sets[] = 'campaign_id = ?'; $args[] = $camp;
        }
        if (array_key_exists('notes', $in)) { $sets[] = 'notes = ?'; $args[] = cs_txt($in['notes'], 5000) ?: null; }
        if (isset($in['kind']) && $in['kind'] !== $r['kind']) {
            if (!in_array($in['kind'], ['pc', 'npc'], true) || $r['kind'] === 'creature')
                fail('Only player character and NPC sheets can be switched (a creature sheet has its own layout).');
            $s = json_decode($r['sheet_json'], true) ?: [];
            $s['sheetType'] = $in['kind'];
            $sets[] = 'kind = ?'; $args[] = $in['kind'];
            $sets[] = 'sheet_json = ?'; $args[] = json_encode($s, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($in['kind'] === 'npc') $sets[] = 'player_name = NULL';
            else { $sets[] = 'player_name = ?'; $args[] = mb_substr((string)($s['playerName'] ?? ''), 0, 100) ?: null; }
        }
        if ($sets) {
            $args[] = (int)$r['id']; $args[] = $UID;
            $db->prepare('UPDATE character_sheets SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?')->execute($args);
        }
        out(['ok' => true, 'meta' => meta(row($db, $UID, (int)$r['id']))]);

    case 'delete':
        $st = $db->prepare('DELETE FROM character_sheets WHERE id = ? AND user_id = ?');
        $st->execute([(int)($in['id'] ?? 0), $UID]);
        out(['ok' => true, 'deleted' => $st->rowCount()]);

    default:
        fail('Unknown action.', 404);
    }
} catch (InvalidArgumentException $e) {
    fail($e->getMessage());
} catch (PDOException $e) {
    fail(str_contains($e->getMessage(), 'max_allowed_packet') ? 'This sheet is too large for the database.' : 'Database error: ' . $e->getMessage(), 500);
} catch (RuntimeException $e) {
    fail($e->getMessage(), $e->getCode() === 404 ? 404 : 400);
}

function cs_clip_lines(string $s, int $n): string { return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s; }
