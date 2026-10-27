<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Writer - document storage. Every document belongs to one Universal Login account.
//   GET  ?action=list              this user's documents (id, title, updated)
//   GET  ?action=get&id=N          one document
//   POST ?action=save   {id?, title, html}   create or update; returns id
//   POST ?action=delete {id}

require getenv('WRITER_AUTH_CHECK') ?: __DIR__ . '/../auth/auth-check.php';
$USER = ip_require_login_api();
$UID = (int)$USER['id'];

function out($d, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($d, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $m, int $code = 400): void { out(['ok' => false, 'error' => $m], $code); }

try {
    $c = require (getenv('WRITER_DB_CONFIG') ?: '/etc/iprps/db.php');
    $db = new PDO("mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['pass'],
                  [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec("CREATE TABLE IF NOT EXISTS writer_docs (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        title      VARCHAR(200) NOT NULL,
        html       MEDIUMTEXT NOT NULL,
        words      INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    fail('The IPRPS database is not reachable. Is MariaDB running?', 503);
}

$action = $_GET['action'] ?? '';
$in = $_SERVER['REQUEST_METHOD'] === 'POST' ? (json_decode(file_get_contents('php://input'), true) ?: []) : [];

switch ($action) {
case 'list':
    $st = $db->prepare('SELECT id, title, words, updated_at FROM writer_docs WHERE user_id = ? ORDER BY updated_at DESC, id DESC');
    $st->execute([$UID]);
    out(['ok' => true, 'docs' => $st->fetchAll()]);

case 'get':
    $st = $db->prepare('SELECT id, title, html, updated_at FROM writer_docs WHERE id = ? AND user_id = ?');
    $st->execute([(int)($_GET['id'] ?? 0), $UID]);
    $d = $st->fetch();
    $d ? out(['ok' => true, 'doc' => $d]) : fail('Document not found.', 404);

case 'save':
    $title = trim((string)($in['title'] ?? '')) ?: 'Untitled document';
    $html = (string)($in['html'] ?? '');
    if (strlen($html) > 8 * 1024 * 1024) fail('This document is too large to save (8 MB limit).', 413);
    $words = (int)($in['words'] ?? 0);
    $id = (int)($in['id'] ?? 0);
    if ($id) {
        $st = $db->prepare('UPDATE writer_docs SET title = ?, html = ?, words = ? WHERE id = ? AND user_id = ?');
        $st->execute([mb_substr($title, 0, 200), $html, $words, $id, $UID]);
        $chk = $db->prepare('SELECT 1 FROM writer_docs WHERE id = ? AND user_id = ?');
        $chk->execute([$id, $UID]);
        if (!$chk->fetch()) fail('Document not found.', 404);
    } else {
        $st = $db->prepare('INSERT INTO writer_docs (user_id, title, html, words) VALUES (?, ?, ?, ?)');
        $st->execute([$UID, mb_substr($title, 0, 200), $html, $words]);
        $id = (int)$db->lastInsertId();
    }
    out(['ok' => true, 'id' => $id]);

case 'delete':
    $st = $db->prepare('DELETE FROM writer_docs WHERE id = ? AND user_id = ?');
    $st->execute([(int)($in['id'] ?? 0), $UID]);
    out(['ok' => true, 'deleted' => $st->rowCount()]);

default:
    fail('Unknown action.', 404);
}
