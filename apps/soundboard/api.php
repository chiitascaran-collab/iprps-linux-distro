<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Soundboard - JSON API. Each Session Master has their own boards (pads) and sound files.
// Files live in /var/lib/iprps-sounds/<account>/ (readable by the web server only) and are fetched
// with the sign-in token; the built-in sounds are made in the browser and need no files.
//
// GET  ?action=state                       boards and files
// POST ?action=boards_save {boards}        the pads, as the page keeps them
// POST ?action=upload   (raw body; headers X-Filename, Content-Type)   a sound file, up to 50 MB
// GET  ?action=file&id=N                   the audio itself
// POST ?action=file_rename {id, name}
// POST ?action=file_delete {id}
// POST ?action=table_play {id, loop, volume}   play a file on the players' devices (IPRPS Table)
// POST ?action=table_stop

require __DIR__ . '/../iprps-lib/lib.php';
$USER = ip_user();
$UID = (int)$USER['id'];
$db = ip_db();
const MAX_FILE = 50 * 1024 * 1024;
const MAX_TOTAL = 2048 * 1024 * 1024;
const TYPES = ['audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav', 'audio/wave' => 'wav',
               'audio/webm' => 'weba', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/aac' => 'aac', 'audio/flac' => 'flac', 'audio/x-flac' => 'flac'];
const EXTS = ['mp3' => 'audio/mpeg', 'ogg' => 'audio/ogg', 'oga' => 'audio/ogg', 'opus' => 'audio/ogg', 'wav' => 'audio/wav', 'weba' => 'audio/webm',
              'm4a' => 'audio/mp4', 'aac' => 'audio/aac', 'flac' => 'audio/flac'];

$db->exec("CREATE TABLE IF NOT EXISTS sound_files (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(120) NOT NULL,
    file        VARCHAR(40) NOT NULL,
    mime        VARCHAR(40) NOT NULL,
    size        INT UNSIGNED NOT NULL,
    table_media VARCHAR(40) NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

function dir_for(int $uid): string {
    $base = getenv('IPRPS_SOUNDS_DIR') ?: '/var/lib/iprps-sounds';
    if (!is_dir($base) || !is_writable($base)) ip_fail("The sound folder $base is missing or not writable by the web server (guide 12.11).", 500);
    $d = "$base/$uid";
    if (!is_dir($d) && !mkdir($d, 0700)) ip_fail('Could not create your sound folder.', 500);
    return $d;
}
function row(PDO $db, int $uid, int $id): array {
    $st = $db->prepare('SELECT * FROM sound_files WHERE id = ? AND user_id = ?');
    $st->execute([$id, $uid]);
    $r = $st->fetch();
    if (!$r) ip_fail('That sound is no longer in your library.', 404);
    return $r;
}
function files(PDO $db, int $uid): array {
    $st = $db->prepare('SELECT id, name, mime, size, created_at FROM sound_files WHERE user_id = ? ORDER BY name');
    $st->execute([$uid]);
    return array_map(fn($r) => ['id' => (int)$r['id'], 'size' => (int)$r['size']] + $r, $st->fetchAll());
}
// Send a file to the IPRPS Table's media library (on this computer); returns its media id or an error.
function table_upload(string $path, string $name, string $mime): array {
    $ch = curl_init((getenv('IPRPS_TABLE_URL') ?: IP_TABLE_URL) . '/api/sm/upload');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => file_get_contents($path),
        CURLOPT_HTTPHEADER => ['Host: localhost', 'X-IPRPS-SM: 1', 'X-IPRPS: 1', "Content-Type: $mime", 'X-Filename: ' . rawurlencode($name)]]);
    $r = curl_exec($ch); curl_close($ch);
    $j = $r === false ? null : json_decode($r, true);
    return $j ?: ['ok' => false, 'error' => 'The IPRPS Table did not answer.'];
}

$in = in_array($_GET['action'] ?? '', ['upload', 'file'], true) ? [] : ip_input();

switch ($_GET['action'] ?? '') {
case 'state':
    $b = ip_setting($db, $UID, 'soundboard');
    ip_out(['ok' => true, 'boards' => $b ? json_decode($b, true) : null, 'files' => files($db, $UID), 'table_open' => ip_table_open()]);

case 'boards_save':
    $boards = $in['boards'] ?? null;
    if (!is_array($boards)) ip_fail('Nothing to save.');
    $json = json_encode($boards, JSON_UNESCAPED_UNICODE);
    if (strlen($json) > 256 * 1024) ip_fail('Too many pads to save (256 KB of settings).');
    ip_set_setting($db, $UID, 'soundboard', $json);
    ip_out(['ok' => true]);

case 'upload':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') ip_fail('Use POST.', 405);
    $name = ip_txt(rawurldecode($_SERVER['HTTP_X_FILENAME'] ?? 'sound'), 200) ?: 'sound';
    $mime = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!isset(TYPES[$mime])) $mime = EXTS[$ext] ?? '';
    if (!$mime) ip_fail('Use an audio file: MP3, OGG/Opus, WAV, M4A/AAC, FLAC or WebM.', 415);
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > MAX_FILE) ip_fail('That file is larger than 50 MB.', 413);
    $st = $db->prepare('SELECT COALESCE(SUM(size), 0) FROM sound_files WHERE user_id = ?'); $st->execute([$UID]);
    if ((int)$st->fetchColumn() + $len > MAX_TOTAL) ip_fail('Your sound library is full (2 GB). Delete some sounds first.', 507);
    $dir = dir_for($UID);
    $file = bin2hex(random_bytes(8)) . '.' . (TYPES[$mime] ?? 'bin');
    $src = fopen('php://input', 'rb'); $dst = fopen("$dir/$file", 'wb');
    $size = stream_copy_to_stream($src, $dst, MAX_FILE + 1);
    fclose($src); fclose($dst);
    if (!$size || $size > MAX_FILE) { @unlink("$dir/$file"); ip_fail($size ? 'That file is larger than 50 MB.' : 'The file was empty (or larger than the upload limit).', 413); }
    chmod("$dir/$file", 0600);
    $label = preg_replace('/\.[A-Za-z0-9]{2,5}$/', '', $name);
    $label = trim(str_replace(['_', '-'], ' ', $label)) ?: 'Sound';
    $db->prepare('INSERT INTO sound_files (user_id, name, file, mime, size) VALUES (?, ?, ?, ?, ?)')->execute([$UID, mb_substr($label, 0, 120), $file, $mime, $size]);
    ip_out(['ok' => true, 'file' => ['id' => (int)$db->lastInsertId(), 'name' => mb_substr($label, 0, 120), 'mime' => $mime, 'size' => $size]]);

case 'file':
    $r = row($db, $UID, (int)($_GET['id'] ?? 0));
    $path = dir_for($UID) . '/' . basename($r['file']);
    if (!is_file($path)) ip_fail('The sound file is missing from the computer.', 404);
    header('Content-Type: ' . $r['mime']);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, max-age=86400');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;

case 'file_rename':
    $r = row($db, $UID, (int)($in['id'] ?? 0));
    $name = ip_txt($in['name'] ?? '', 120);
    if ($name === '') ip_fail('Give the sound a name.');
    $db->prepare('UPDATE sound_files SET name = ? WHERE id = ?')->execute([$name, $r['id']]);
    ip_out(['ok' => true]);

case 'file_delete':
    $r = row($db, $UID, (int)($in['id'] ?? 0));
    @unlink(dir_for($UID) . '/' . basename($r['file']));
    $db->prepare('DELETE FROM sound_files WHERE id = ?')->execute([$r['id']]);
    ip_out(['ok' => true]);

case 'table_play':
    $r = row($db, $UID, (int)($in['id'] ?? 0));
    if (!ip_table_open()) ip_fail('The IPRPS Table is closed (or not running): open it in the Table console first.');
    $body = fn($media) => ['action' => 'play', 'media' => $media, 'loop' => !empty($in['loop']), 'volume' => max(0, min(1, (float)($in['volume'] ?? 0.8))), 'target' => ['type' => 'all']];
    $res = $r['table_media'] ? ip_table('/api/sm/audio', $body($r['table_media'])) : null;
    if (!$res || empty($res['ok'])) {                 // not on the Table yet, or the Table's media was cleared
        $up = table_upload(dir_for($UID) . '/' . basename($r['file']), $r['name'] . '.' . pathinfo($r['file'], PATHINFO_EXTENSION), $r['mime']);
        if (empty($up['ok'])) ip_fail('The IPRPS Table did not take the sound: ' . ($up['error'] ?? 'no answer'), 502);
        $db->prepare('UPDATE sound_files SET table_media = ? WHERE id = ?')->execute([$up['media']['id'], $r['id']]);
        $res = ip_table('/api/sm/audio', $body($up['media']['id']));
    }
    if (!$res || empty($res['ok'])) ip_fail($res['error'] ?? 'The IPRPS Table did not answer.', 502);
    ip_out(['ok' => true, 'sent' => $res['sent'] ?? 0]);

case 'table_stop':
    $res = ip_table('/api/sm/audio', ['action' => 'stop', 'target' => ['type' => 'all']]);
    ip_out(['ok' => (bool)($res['ok'] ?? false), 'error' => $res['error'] ?? null]);

default:
    ip_fail('Unknown action.', 404);
}
