<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS player display - full screen on the players' monitor or projector (Session Master Mode).
// Shows the newest item in display_items (sent by the Hub's tools or the IPRPS Oracle).
// No sign-in (it runs in its own kiosk window), so it only answers this computer.
$remote = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remote, ['127.0.0.1', '::1'], true) && !getenv('HUB_DISPLAY_ANY')) {
    http_response_code(403); exit('The player display is only available on this computer.');
}
if (isset($_GET['poll'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    try {
        $c = require (getenv('HUB_DB_CONFIG') ?: '/etc/iprps/db.php');
        $db = new PDO("mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['pass'],
                      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        $db->exec("CREATE TABLE IF NOT EXISTS display_items (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, campaign_id INT UNSIGNED NULL,
            kind ENUM('text','image','clear') NOT NULL DEFAULT 'text', title VARCHAR(160), body MEDIUMTEXT,
            shown_by INT NULL, shown_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $r = $db->query('SELECT id, kind, title, body FROM display_items ORDER BY id DESC LIMIT 1')->fetch();
        echo json_encode(['ok' => true, 'item' => $r ?: null], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) { echo json_encode(['ok' => false]); }
    exit;
}
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IPRPS Player Display</title>
<link rel="stylesheet" href="hub.css">
</head>
<body class="display">
<main id="stage" class="stage idle"><div class="sigil" aria-hidden="true">✦</div><h1 id="title"></h1><div id="body" class="prose"></div></main>
<script>
(() => {
  let last = 0; const stage = document.getElementById('stage');
  async function poll() {
    try {
      const it = (await (await fetch('display.php?poll=1', {cache: 'no-store'})).json()).item;
      if (it && +it.id !== last) {
        last = +it.id; stage.classList.add('fade');
        setTimeout(() => {
          const clear = it.kind === 'clear';
          stage.className = clear ? 'stage idle' : 'stage';
          document.getElementById('title').textContent = clear ? '' : (it.title || '');
          document.getElementById('body').textContent = clear ? '' : (it.body || '').replace(/\*\*/g, '');
        }, 400);
      }
    } catch (e) {}
    setTimeout(poll, 1500);
  }
  poll();
})();
</script>
</body>
</html>
