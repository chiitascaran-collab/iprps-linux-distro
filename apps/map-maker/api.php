<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Map Maker - the Session Master's map library in the IPRPS database, and "Show to players".
//   GET  ?action=list[&campaign=ID]      the signed-in Session Master's maps (no map data, with thumbnails)
//   GET  ?action=get&id=ID               one map
//   POST ?action=save   {id?, name, kind, campaign_id?, data, thumb?}
//   POST ?action=delete {id}
//   POST ?action=show   {title, image, campaign_id?}   a JPEG/PNG data URL for the player display
// The table is created on first use. Maps are JSON documents (format "iprps-map"), so they can also be
// exported and imported as .ipmap files.

require __DIR__ . '/../iprps-lib/lib.php';
$user = ip_user();
$uid = (int)($user['id'] ?? 0);
if (!$uid) ip_fail('Sign in first.', 401);
$db = ip_db();
$db->exec("CREATE TABLE IF NOT EXISTS maps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    campaign_id INT UNSIGNED NULL,
    name VARCHAR(160) NOT NULL,
    kind VARCHAR(20) NOT NULL,
    data MEDIUMTEXT NOT NULL,
    thumb MEDIUMTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY user_campaign (user_id, campaign_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

const MM_KINDS = ['travel', 'battle', 'dungeon', 'settlement'];
const MM_MAX_DATA = 6 * 1024 * 1024;     // a map document (a 300 x 300 map is well under 1 MB)
const MM_MAX_IMAGE = 8 * 1024 * 1024;    // a picture for the player display

function mm_own(PDO $db, int $id, int $uid): array {
    $st = $db->prepare('SELECT * FROM maps WHERE id = ? AND user_id = ?');
    $st->execute([$id, $uid]);
    $r = $st->fetch();
    if (!$r) ip_fail('That map is not in your library.', 404);
    return $r;
}
function mm_image(?string $s, int $max): ?string {
    if ($s === null || $s === '') return null;
    if (strlen($s) > $max) ip_fail('The picture is too large.', 413);
    if (!preg_match('#^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$#', $s)) ip_fail('The picture must be a PNG or JPEG.');
    return $s;
}

$action = $_GET['action'] ?? '';
$in = ip_input();
switch ($action) {
case 'list':
    $c = ip_id($_GET['campaign'] ?? null);
    $sql = 'SELECT m.id, m.name, m.kind, m.campaign_id, c.name AS campaign_name, m.thumb, m.updated_at, LENGTH(m.data) AS size
            FROM maps m LEFT JOIN campaigns c ON c.id = m.campaign_id WHERE m.user_id = ?' . ($c ? ' AND m.campaign_id = ?' : '') . ' ORDER BY m.updated_at DESC, m.id DESC';
    $st = $db->prepare($sql);
    $st->execute($c ? [$uid, $c] : [$uid]);
    ip_out(['ok' => true, 'maps' => array_map(fn($r) => array_merge($r, ['id' => (int)$r['id'], 'campaign_id' => $r['campaign_id'] === null ? null : (int)$r['campaign_id'], 'size' => (int)$r['size']]), $st->fetchAll())]);

case 'get':
    $r = mm_own($db, (int)($_GET['id'] ?? 0), $uid);
    $data = json_decode($r['data'], true);
    if (!is_array($data)) ip_fail('This map is damaged and cannot be opened.', 500);
    ip_out(['ok' => true, 'id' => (int)$r['id'], 'campaign_id' => $r['campaign_id'] ? (int)$r['campaign_id'] : null, 'map' => $data]);

case 'save':
    $data = $in['data'] ?? null;
    if (!is_array($data) || ($data['format'] ?? '') !== 'iprps-map') ip_fail('Not an IPRPS map.');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (strlen($json) > MM_MAX_DATA) ip_fail('This map is too large to save (over 6 MB).', 413);
    $name = ip_txt($in['name'] ?? ($data['name'] ?? ''), 160) ?: 'Untitled map';
    $kind = in_array($in['kind'] ?? $data['kind'] ?? '', MM_KINDS, true) ? ($in['kind'] ?? $data['kind']) : 'battle';
    $camp = ip_id($in['campaign_id'] ?? null);
    if ($camp && !ip_campaign_exists($db, $camp)) $camp = null;
    $thumb = mm_image($in['thumb'] ?? null, 400000);
    $id = ip_id($in['id'] ?? null);
    if ($id) {
        mm_own($db, $id, $uid);
        $db->prepare('UPDATE maps SET name = ?, kind = ?, campaign_id = ?, data = ?, thumb = COALESCE(?, thumb) WHERE id = ? AND user_id = ?')
           ->execute([$name, $kind, $camp, $json, $thumb, $id, $uid]);
    } else {
        $db->prepare('INSERT INTO maps (user_id, campaign_id, name, kind, data, thumb) VALUES (?, ?, ?, ?, ?, ?)')->execute([$uid, $camp, $name, $kind, $json, $thumb]);
        $id = (int)$db->lastInsertId();
    }
    ip_out(['ok' => true, 'id' => $id]);

case 'delete':
    $id = (int)($in['id'] ?? 0);
    mm_own($db, $id, $uid);
    $db->prepare('DELETE FROM maps WHERE id = ? AND user_id = ?')->execute([$id, $uid]);
    ip_out(['ok' => true]);

case 'show':
    $img = mm_image($in['image'] ?? null, MM_MAX_IMAGE);
    if (!$img) ip_fail('No picture to show.');
    $camp = ip_id($in['campaign_id'] ?? null);
    $db->prepare("INSERT INTO display_items (campaign_id, kind, title, body, shown_by) VALUES (?, 'image', ?, ?, ?)")
       ->execute([$camp, ip_txt($in['title'] ?? 'Map', 160), $img, $uid]);
    ip_out(['ok' => true, 'id' => (int)$db->lastInsertId()]);

default:
    ip_fail('Unknown action.', 404);
}
