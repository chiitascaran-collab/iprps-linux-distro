<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Updates Hub tile: what the last update check found (guide 12.12). Read-only.
header('Content-Type: application/json');
header('Cache-Control: no-store');
$f = '/var/lib/iprps-updates/status.json';
$s = is_readable($f) ? json_decode((string)file_get_contents($f), true) : null;
if (!is_array($s)) { echo json_encode(['ok' => true, 'known' => false]); exit; }
$ups = array_values(array_map(fn($u) => ['name' => (string)($u['name'] ?? ''), 'old' => (string)($u['old'] ?? ''), 'new' => (string)($u['new'] ?? '')],
       array_filter((array)($s['updates'] ?? []), 'is_array')));
echo json_encode(['ok' => true, 'known' => true, 'checked' => (int)($s['checked'] ?? 0), 'check_ok' => ($s['ok'] ?? null) !== false,
                  'error' => (string)($s['error'] ?? ''), 'updates' => $ups, 'restart' => !empty($s['restart'])]);
