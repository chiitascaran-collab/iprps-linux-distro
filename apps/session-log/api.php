<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Session Log and Recap - JSON API (core tables sessions, session_log, players, attendance).
//
// GET  ?action=session&id=ID          the session, its log, the previous session's recap, attendance
// POST ?action=entry_add    {session_id, kind, text}
// POST ?action=entry_update {id, kind?, text?}
// POST ?action=entry_delete {id}
// POST ?action=recap_save   {id, recap?, sm_notes?}
// POST ?action=session_delete {id}    the session with its log and encounters
// POST ?action=player_save  {id?, display_name, contact, notes}
// POST ?action=attendance   {session_id, player_id, present, xp_awarded, notes}

require __DIR__ . '/../iprps-lib/lib.php';
ip_user();
$db = ip_db();
$in = ip_input();

function entry_session(PDO $db, int $id): int {
    $st = $db->prepare('SELECT session_id FROM session_log WHERE id = ?'); $st->execute([$id]);
    $s = $st->fetchColumn();
    if (!$s) ip_fail('That log entry no longer exists.', 404);
    return (int)$s;
}

switch ($_GET['action'] ?? '') {
case 'session':
    $s = ip_session($db, ip_id($_GET['id'] ?? 0));
    if (!$s) ip_fail('That session no longer exists.', 404);
    foreach (['id', 'campaign_id', 'session_no'] as $k) $s[$k] = (int)$s[$k];
    $st = $db->prepare('SELECT id, logged_at, kind, text FROM session_log WHERE session_id = ? ORDER BY logged_at, id');
    $st->execute([$s['id']]);
    $log = array_map(fn($r) => ['id' => (int)$r['id']] + $r, $st->fetchAll());
    $st = $db->prepare('SELECT session_no, title, recap FROM sessions WHERE campaign_id = ? AND session_no < ? AND recap IS NOT NULL AND recap <> \'\' ORDER BY session_no DESC LIMIT 1');
    $st->execute([$s['campaign_id'], $s['session_no']]);
    $prev = $st->fetch() ?: null;
    $st = $db->prepare('SELECT p.id, p.display_name, p.contact, p.notes, a.present, a.xp_awarded, a.notes AS att_notes
                        FROM players p LEFT JOIN attendance a ON a.player_id = p.id AND a.session_id = ? ORDER BY p.display_name');
    $st->execute([$s['id']]);
    $players = array_map(fn($r) => ['id' => (int)$r['id'], 'present' => $r['present'] === null ? null : (bool)$r['present'],
        'xp_awarded' => $r['xp_awarded'] === null ? 0 : (int)$r['xp_awarded']] + $r, $st->fetchAll());
    ip_out(['ok' => true, 'session' => $s, 'log' => $log, 'previous' => $prev, 'players' => $players]);

case 'entry_add':
    $s = ip_session($db, ip_id($in['session_id'] ?? 0));
    if (!$s) ip_fail('Choose a session first.');
    ip_out(['ok' => true, 'id' => ip_log($db, (int)$s['id'], (string)($in['kind'] ?? 'note'), (string)($in['text'] ?? ''))]);

case 'entry_update':
    $id = (int)($in['id'] ?? 0); entry_session($db, $id);
    if (isset($in['text'])) { $t = ip_txt($in['text'], 20000); if ($t === '') ip_fail('An entry needs text (or delete it).'); $db->prepare('UPDATE session_log SET text = ? WHERE id = ?')->execute([$t, $id]); }
    if (isset($in['kind']) && in_array($in['kind'], IP_LOG_KINDS, true)) $db->prepare('UPDATE session_log SET kind = ? WHERE id = ?')->execute([$in['kind'], $id]);
    ip_out(['ok' => true]);

case 'entry_delete':
    $db->prepare('DELETE FROM session_log WHERE id = ?')->execute([(int)($in['id'] ?? 0)]);
    ip_out(['ok' => true]);

case 'recap_save':
    $s = ip_session($db, ip_id($in['id'] ?? 0));
    if (!$s) ip_fail('That session no longer exists.', 404);
    if (array_key_exists('recap', $in)) $db->prepare('UPDATE sessions SET recap = ? WHERE id = ?')->execute([ip_txt($in['recap'], 60000) ?: null, $s['id']]);
    if (array_key_exists('sm_notes', $in)) $db->prepare('UPDATE sessions SET sm_notes = ? WHERE id = ?')->execute([ip_txt($in['sm_notes'], 60000) ?: null, $s['id']]);
    ip_out(['ok' => true]);

case 'session_delete':
    $s = ip_session($db, ip_id($in['id'] ?? 0));
    if (!$s) ip_fail('That session no longer exists.', 404);
    $db->prepare('DELETE FROM sessions WHERE id = ?')->execute([$s['id']]);
    ip_out(['ok' => true]);

case 'player_save':
    $name = ip_txt($in['display_name'] ?? '', 100);
    if ($name === '') ip_fail('Type the player\'s name.');
    $vals = [$name, ip_txt($in['contact'] ?? '', 200) ?: null, ip_txt($in['notes'] ?? '', 5000) ?: null];
    if ($id = ip_id($in['id'] ?? 0)) $db->prepare('UPDATE players SET display_name = ?, contact = ?, notes = ? WHERE id = ?')->execute([...$vals, $id]);
    else { $db->prepare('INSERT INTO players (display_name, contact, notes) VALUES (?, ?, ?)')->execute($vals); $id = (int)$db->lastInsertId(); }
    ip_out(['ok' => true, 'id' => $id]);

case 'attendance':
    $s = ip_session($db, ip_id($in['session_id'] ?? 0));
    if (!$s) ip_fail('That session no longer exists.', 404);
    $p = ip_id($in['player_id'] ?? 0);
    $st = $db->prepare('SELECT 1 FROM players WHERE id = ?'); $st->execute([$p ?: 0]);
    if (!$st->fetch()) ip_fail('That player no longer exists.', 404);
    $db->prepare('INSERT INTO attendance (session_id, player_id, present, xp_awarded, notes) VALUES (?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE present = VALUES(present), xp_awarded = VALUES(xp_awarded), notes = VALUES(notes)')
       ->execute([$s['id'], $p, !empty($in['present']) ? 1 : 0, max(-1000000, min(1000000, (int)($in['xp_awarded'] ?? 0))), ip_txt($in['notes'] ?? '', 2000) ?: null]);
    ip_out(['ok' => true]);

default:
    ip_fail('Unknown action.', 404);
}
