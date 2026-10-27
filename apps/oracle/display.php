<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS player display - full-screen page for the players' monitor or projector.
// Shows what the Session Master sends with "Show on player display".
// No sign-in (it runs in its own kiosk window), so it only answers this computer.

$remote = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remote, ['127.0.0.1', '::1'], true) && !getenv('ORACLE_DISPLAY_ANY')) {
    http_response_code(403);
    exit('The player display is only available on this computer.');
}

if (isset($_GET['poll'])) {
    require __DIR__ . '/config.php';
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    try {
        $r = oracle_db()->query('SELECT id, kind, title, body FROM display_items ORDER BY id DESC LIMIT 1')->fetch();
        echo json_encode(['ok' => true, 'item' => $r ?: null], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        echo json_encode(['ok' => false]);
    }
    exit;
}
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IPRPS Player Display</title>
<link rel="stylesheet" href="oracle.css">
</head>
<body class="display">
<main id="stage" class="stage idle">
  <div class="sigil" aria-hidden="true">✦</div>
  <h1 id="title"></h1>
  <div id="body" class="prose"></div>
</main>
<script src="markdown.js"></script>
<script>
(() => {
  let last = 0;
  const stage = document.getElementById('stage');
  async function poll() {
    try {
      const r = await fetch('display.php?poll=1', {cache: 'no-store'});
      const j = await r.json();
      const it = j.item;
      if (it && +it.id !== last) {
        last = +it.id;
        stage.classList.add('fade');
        setTimeout(() => {
          if (it.kind === 'clear') {
            stage.className = 'stage idle';
            document.getElementById('title').textContent = '';
            document.getElementById('body').innerHTML = '';
          } else {
            stage.className = 'stage';
            document.getElementById('title').textContent = it.title || '';
            document.getElementById('body').innerHTML = IPMarkdown.render(it.body || '');
          }
        }, 400);
      }
    } catch (e) { /* server restarting: try again */ }
    setTimeout(poll, 1500);
  }
  poll();
})();
</script>
</body>
</html>
