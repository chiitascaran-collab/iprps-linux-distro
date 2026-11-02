<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Dice Roller - the IPRPS roll buttons, from the same file as the IPRPS Table's dice
// (/etc/iprps-table/presets.json if the Session Master changed it, else the Table's own file).
//   GET ?action=presets

require __DIR__ . '/../iprps-lib/lib.php';
ip_user();
if (($_GET['action'] ?? '') !== 'presets') ip_fail('Unknown action.', 404);
foreach (array_filter([getenv('IPRPS_DICE_PRESETS'), '/etc/iprps-table/presets.json', '/opt/iprps/table/dice-presets.json', __DIR__ . '/dice-presets.json']) as $f) {
    if (!is_readable($f)) continue;
    $j = json_decode((string)file_get_contents($f), true);
    if (is_array($j) && isset($j['presets'])) ip_out(['ok' => true, 'presets' => $j['presets'], 'weapons' => $j['weapons'] ?? [], 'from' => $f]);
}
ip_fail('No dice presets file found.', 500);
