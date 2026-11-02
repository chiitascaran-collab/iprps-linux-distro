<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Initiative and Combat Tracker - JSON API. Encounters belong to a session (core tables
// encounters and initiative, 10.2, with the columns iprps-lib adds).
//
// GET  ?action=encounters&session=ID
// GET  ?action=encounter&id=ID                 the encounter and its combatants, in turn order
// POST ?action=encounter_save {id?, session_id, name, mode, notes}
// POST ?action=encounter_delete {id}
// POST ?action=add     {encounter_id, items: [{label, hp, hp_max, ar, init_mod, side, sheet_id, notes}]}
// POST ?action=update  {id, label?, hp?, hp_max?, ar?, init_mod?, side?, conditions?, defeated?, initiative?, notes?}
// POST ?action=order   {encounter_id, rows: [{id, initiative, rolled}]}   new initiative values; sorts the turn order
// POST ?action=remove  {id}
// POST ?action=state   {id, active, round_no, turn_idx}
// GET  ?action=sheets&campaign=ID              Character Sheets the Session Master can add (campaign + library)

require __DIR__ . '/../iprps-lib/lib.php';
$USER = ip_user();
$UID = (int)$USER['id'];
$db = ip_db();
$in = ip_input();
const MODES = ['standard', 'trinity', 'rps', 'dual', 'convergence'];
const SIDES = ['party', 'ally', 'foe', 'neutral'];

function enc(PDO $db, ?int $id): array {
    $st = $db->prepare('SELECT e.*, s.campaign_id, s.session_no FROM encounters e JOIN sessions s ON s.id = e.session_id WHERE e.id = ?');
    $st->execute([$id ?: 0]);
    $e = $st->fetch();
    if (!$e) ip_fail('That encounter no longer exists.', 404);
    foreach (['id', 'session_id', 'round_no', 'turn_idx', 'campaign_id', 'session_no'] as $k) $e[$k] = (int)$e[$k];
    $e['active'] = (bool)$e['active'];
    return $e;
}
function combatants(PDO $db, int $enc): array {
    $st = $db->prepare('SELECT id, label, initiative, hp, hp_max, ar, init_mod, side, sheet_id, conditions, defeated, rolled, notes, sort_order
                        FROM initiative WHERE encounter_id = ? ORDER BY sort_order, id');
    $st->execute([$enc]);
    return array_map(function ($r) {
        foreach (['id', 'initiative', 'ar', 'init_mod', 'sort_order'] as $k) $r[$k] = (int)$r[$k];
        foreach (['hp', 'hp_max', 'sheet_id'] as $k) $r[$k] = $r[$k] === null ? null : (int)$r[$k];
        $r['defeated'] = (bool)$r['defeated']; $r['rolled'] = (bool)$r['rolled'];
        $r['conditions'] = $r['conditions'] ? array_values(array_filter(explode('|', $r['conditions']))) : [];
        return $r;
    }, $st->fetchAll());
}
function cond_str($v): ?string {
    $out = [];
    foreach (is_array($v) ? $v : [] as $c) { $c = ip_txt(str_replace('|', '/', (string)$c), 40); if ($c !== '' && !in_array($c, $out, true)) $out[] = $c; }
    $s = implode('|', $out);
    return $s === '' ? null : mb_substr($s, 0, 255);
}
// Initiative order: highest first; ties by modifier, then the order they were added.
function resort(PDO $db, int $enc): void {
    $st = $db->prepare('SELECT id FROM initiative WHERE encounter_id = ? ORDER BY initiative DESC, init_mod DESC, id');
    $st->execute([$enc]);
    $u = $db->prepare('UPDATE initiative SET sort_order = ? WHERE id = ?');
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $i => $id) $u->execute([$i, $id]);
}
function owner_of(PDO $db, int $combatant): int {
    $st = $db->prepare('SELECT encounter_id FROM initiative WHERE id = ?'); $st->execute([$combatant]);
    $e = $st->fetchColumn();
    if (!$e) ip_fail('That combatant is no longer in the encounter.', 404);
    return (int)$e;
}

switch ($_GET['action'] ?? '') {
case 'encounters':
    $st = $db->prepare('SELECT e.id, e.name, e.round_no, e.active, e.mode, e.created_at,
                               (SELECT COUNT(*) FROM initiative i WHERE i.encounter_id = e.id) AS combatants
                        FROM encounters e WHERE e.session_id = ? ORDER BY e.id DESC');
    $st->execute([(int)($_GET['session'] ?? 0)]);
    $rows = array_map(fn($r) => ['id' => (int)$r['id'], 'round_no' => (int)$r['round_no'], 'active' => (bool)$r['active'], 'combatants' => (int)$r['combatants']] + $r, $st->fetchAll());
    ip_out(['ok' => true, 'encounters' => $rows]);

case 'encounter':
    $e = enc($db, ip_id($_GET['id'] ?? 0));
    ip_out(['ok' => true, 'encounter' => $e, 'combatants' => combatants($db, $e['id'])]);

case 'encounter_save':
    $name = ip_txt($in['name'] ?? '', 160) ?: 'Encounter';
    $mode = in_array($in['mode'] ?? '', MODES, true) ? $in['mode'] : 'standard';
    if ($id = ip_id($in['id'] ?? 0)) {
        enc($db, $id);
        $db->prepare('UPDATE encounters SET name = ?, mode = ?, notes = ? WHERE id = ?')->execute([$name, $mode, ip_txt($in['notes'] ?? '', 5000) ?: null, $id]);
    } else {
        $s = ip_session($db, ip_id($in['session_id'] ?? 0));
        if (!$s) ip_fail('Choose or start a session first.');
        $db->prepare('INSERT INTO encounters (session_id, name, mode, notes) VALUES (?, ?, ?, ?)')->execute([$s['id'], $name, $mode, ip_txt($in['notes'] ?? '', 5000) ?: null]);
        $id = (int)$db->lastInsertId();
    }
    ip_out(['ok' => true, 'id' => $id]);

case 'encounter_delete':
    $db->prepare('DELETE FROM encounters WHERE id = ?')->execute([(int)($in['id'] ?? 0)]);
    ip_out(['ok' => true]);

case 'add':
    $e = enc($db, ip_id($in['encounter_id'] ?? 0));
    $items = array_slice(is_array($in['items'] ?? null) ? $in['items'] : [], 0, 60);
    $ins = $db->prepare('INSERT INTO initiative (encounter_id, label, initiative, hp, hp_max, ar, init_mod, side, sheet_id, notes, sort_order, rolled)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $n = 0;
    $next = (int)$db->query('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM initiative WHERE encounter_id = ' . $e['id'])->fetchColumn();
    foreach ($items as $it) {
        $label = ip_txt($it['label'] ?? '', 120); if ($label === '') continue;
        $max = isset($it['hp_max']) && $it['hp_max'] !== '' && $it['hp_max'] !== null ? max(1, min(10000000, (int)$it['hp_max'])) : null;
        $hp = isset($it['hp']) && $it['hp'] !== '' && $it['hp'] !== null ? max(-10000000, min(10000000, (int)$it['hp'])) : $max;
        $rolled = isset($it['initiative']) && $it['initiative'] !== '' && $it['initiative'] !== null;
        $ins->execute([$e['id'], $label, $rolled ? max(-999, min(999, (int)$it['initiative'])) : 0, $hp, $max, max(0, min(999, (int)($it['ar'] ?? 0))),
                       max(-99, min(99, (int)($it['init_mod'] ?? 0))), in_array($it['side'] ?? '', SIDES, true) ? $it['side'] : 'foe',
                       ip_id($it['sheet_id'] ?? 0), ip_txt($it['notes'] ?? '', 500) ?: null, $next++, $rolled ? 1 : 0]);
        $n++;
    }
    if (!$n) ip_fail('Give each combatant a name.');
    ip_out(['ok' => true, 'added' => $n, 'combatants' => combatants($db, $e['id'])]);

case 'update':
    $id = (int)($in['id'] ?? 0); $encId = owner_of($db, $id);
    $sets = []; $args = [];
    $num = function (string $k, int $lo, int $hi) use (&$sets, &$args, $in) {
        if (!array_key_exists($k, $in)) return;
        $sets[] = "$k = ?"; $args[] = $in[$k] === null || $in[$k] === '' ? null : max($lo, min($hi, (int)$in[$k]));
    };
    $num('hp', -10000000, 10000000); $num('hp_max', 1, 10000000); $num('ar', 0, 999); $num('init_mod', -99, 99); $num('initiative', -999, 999);
    if (array_key_exists('label', $in)) { $l = ip_txt($in['label'], 120); if ($l === '') ip_fail('A combatant needs a name.'); $sets[] = 'label = ?'; $args[] = $l; }
    if (isset($in['side']) && in_array($in['side'], SIDES, true)) { $sets[] = 'side = ?'; $args[] = $in['side']; }
    if (array_key_exists('conditions', $in)) { $sets[] = 'conditions = ?'; $args[] = cond_str($in['conditions']); }
    if (array_key_exists('defeated', $in)) { $sets[] = 'defeated = ?'; $args[] = $in['defeated'] ? 1 : 0; }
    if (array_key_exists('notes', $in)) { $sets[] = 'notes = ?'; $args[] = ip_txt($in['notes'], 500) ?: null; }
    if (array_key_exists('initiative', $in)) { $sets[] = 'rolled = 1'; }
    if ($sets) { $args[] = $id; $db->prepare('UPDATE initiative SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args); }
    if (array_key_exists('initiative', $in)) resort($db, $encId);
    ip_out(['ok' => true, 'combatants' => combatants($db, $encId)]);

case 'order':
    $e = enc($db, ip_id($in['encounter_id'] ?? 0));
    $u = $db->prepare('UPDATE initiative SET initiative = ?, rolled = 1 WHERE id = ? AND encounter_id = ?');
    foreach (array_slice(is_array($in['rows'] ?? null) ? $in['rows'] : [], 0, 200) as $r)
        $u->execute([max(-999, min(999, (int)($r['initiative'] ?? 0))), (int)($r['id'] ?? 0), $e['id']]);
    resort($db, $e['id']);
    ip_out(['ok' => true, 'combatants' => combatants($db, $e['id'])]);

case 'remove':
    $encId = owner_of($db, (int)($in['id'] ?? 0));
    $db->prepare('DELETE FROM initiative WHERE id = ?')->execute([(int)$in['id']]);
    ip_out(['ok' => true, 'combatants' => combatants($db, $encId)]);

case 'state':
    $e = enc($db, ip_id($in['id'] ?? 0));
    $db->prepare('UPDATE encounters SET active = ?, round_no = ?, turn_idx = ? WHERE id = ?')
       ->execute([!empty($in['active']) ? 1 : 0, max(0, min(9999, (int)($in['round_no'] ?? 0))), max(0, min(999, (int)($in['turn_idx'] ?? 0))), $e['id']]);
    ip_out(['ok' => true, 'encounter' => enc($db, $e['id'])]);

case 'sheets':
    if (!ip_sheets_available($db)) ip_out(['ok' => true, 'sheets' => [], 'installed' => false]);
    $c = ip_id($_GET['campaign'] ?? 0);
    $st = $db->prepare("SELECT id, kind, name, player_name, level, hp, armor, campaign_id, sheet_json FROM character_sheets
                        WHERE user_id = ? AND (campaign_id <=> ? OR campaign_id IS NULL)
                        ORDER BY FIELD(kind,'pc','npc','creature'), name");
    $st->execute([$UID, $c]);
    $rows = [];
    foreach ($st->fetchAll() as $r) {
        $s = json_decode($r['sheet_json'], true) ?: [];
        $rows[] = ['id' => (int)$r['id'], 'kind' => $r['kind'], 'name' => $r['name'], 'player_name' => $r['player_name'], 'level' => (int)$r['level'],
                   'hp' => $r['hp'] === null ? null : (int)$r['hp'], 'ar' => (int)$r['armor'], 'dex' => (int)($s['stats']['dex'] ?? 10),
                   'in_campaign' => $r['campaign_id'] !== null, 'size' => $r['kind'] === 'creature' ? (int)($s['creature']['size'] ?? 0) : null];
    }
    ip_out(['ok' => true, 'sheets' => $rows, 'installed' => true]);

default:
    ip_fail('Unknown action.', 404);
}
