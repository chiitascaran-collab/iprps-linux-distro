<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS session tools - shared JSON API (Universal Login).
//
// GET  ?action=campaigns                         all campaigns
// POST ?action=campaign_save {id?, name, setting, description, status}
// GET  ?action=sessions&campaign=ID              the campaign's sessions (newest first)
// POST ?action=session_save  {id?, campaign_id, title, scheduled_at, played_at}   a new one gets the next number
// POST ?action=log_add       {session_id, kind, text}
// POST ?action=show          {title, text, campaign, display: bool, table: bool}   player display and/or IPRPS Table
// GET  ?action=status                            this user's settings, installed apps, Table open or not
// POST ?action=prefs_save    {theme}

require __DIR__ . '/lib.php';
$USER = ip_user();
$UID = (int)$USER['id'];
$db = ip_db();
$in = ip_input();
const THEMES = ['night', 'parchment', 'contrast', 'forest'];

switch ($_GET['action'] ?? '') {
case 'campaigns':
    $rows = $db->query("SELECT id, name, setting, description, status, created_at FROM campaigns
                        ORDER BY FIELD(status,'active','planning','paused','finished'), name")->fetchAll();
    foreach ($rows as &$r) $r['id'] = (int)$r['id'];
    ip_out(['ok' => true, 'campaigns' => $rows]);

case 'campaign_save':
    $name = ip_txt($in['name'] ?? '', 160);
    if ($name === '') ip_fail('Give the campaign a name.');
    $status = in_array($in['status'] ?? '', ['planning', 'active', 'paused', 'finished'], true) ? $in['status'] : 'active';
    $vals = [$name, ip_txt($in['setting'] ?? '', 160) ?: null, ip_txt($in['description'] ?? '', 20000) ?: null, $status];
    if ($id = ip_id($in['id'] ?? 0)) {
        if (!ip_campaign_exists($db, $id)) ip_fail('That campaign no longer exists.', 404);
        $db->prepare('UPDATE campaigns SET name = ?, setting = ?, description = ?, status = ? WHERE id = ?')->execute([...$vals, $id]);
    } else {
        $db->prepare('INSERT INTO campaigns (name, setting, description, status) VALUES (?, ?, ?, ?)')->execute($vals);
        $id = (int)$db->lastInsertId();
    }
    ip_out(['ok' => true, 'id' => $id]);

case 'sessions':
    $c = ip_id($_GET['campaign'] ?? 0);
    if (!$c) ip_out(['ok' => true, 'sessions' => []]);
    $st = $db->prepare('SELECT s.id, s.session_no, s.title, s.scheduled_at, s.played_at,
                               (SELECT COUNT(*) FROM session_log l WHERE l.session_id = s.id) AS entries,
                               (s.recap IS NOT NULL AND s.recap <> \'\') AS has_recap
                        FROM sessions s WHERE s.campaign_id = ? ORDER BY s.session_no DESC');
    $st->execute([$c]);
    $rows = array_map(fn($r) => ['id' => (int)$r['id'], 'session_no' => (int)$r['session_no'], 'entries' => (int)$r['entries'],
        'has_recap' => (bool)$r['has_recap']] + $r, $st->fetchAll());
    ip_out(['ok' => true, 'sessions' => $rows]);

case 'session_save':
    $date = fn($v) => ($v = ip_txt($v ?? '', 25)) !== '' && strtotime($v) ? date('Y-m-d H:i:s', strtotime($v)) : null;
    if ($id = ip_id($in['id'] ?? 0)) {
        if (!ip_session($db, $id)) ip_fail('That session no longer exists.', 404);
        $db->prepare('UPDATE sessions SET title = ?, scheduled_at = ?, played_at = ? WHERE id = ?')
           ->execute([ip_txt($in['title'] ?? '', 160) ?: null, $date($in['scheduled_at'] ?? ''), $date($in['played_at'] ?? ''), $id]);
        ip_out(['ok' => true, 'id' => $id]);
    }
    $c = ip_id($in['campaign_id'] ?? 0);
    if (!ip_campaign_exists($db, $c)) ip_fail('Choose a campaign first.');
    $db->beginTransaction();
    $st = $db->prepare('SELECT COALESCE(MAX(session_no), 0) + 1 FROM sessions WHERE campaign_id = ? FOR UPDATE');
    $st->execute([$c]);
    $no = (int)$st->fetchColumn();
    $db->prepare('INSERT INTO sessions (campaign_id, session_no, title, scheduled_at, played_at) VALUES (?, ?, ?, ?, ?)')
       ->execute([$c, $no, ip_txt($in['title'] ?? '', 160) ?: null, $date($in['scheduled_at'] ?? ''), $date($in['played_at'] ?? '') ?? date('Y-m-d H:i:s')]);
    $id = (int)$db->lastInsertId();
    $db->commit();
    ip_out(['ok' => true, 'id' => $id, 'session_no' => $no]);

case 'log_add':
    $s = ip_session($db, ip_id($in['session_id'] ?? 0));
    if (!$s) ip_fail('Choose a session first.');
    ip_out(['ok' => true, 'id' => ip_log($db, (int)$s['id'], (string)($in['kind'] ?? 'note'), (string)($in['text'] ?? ''))]);

case 'show':
    $title = ip_txt($in['title'] ?? '', 160); $text = ip_txt($in['text'] ?? '', 8000);
    if ($text === '') ip_fail('Nothing to show.');
    $res = [];
    if (!empty($in['display'])) $res['display'] = ['ok' => true, 'id' => ip_display($db, ip_id($in['campaign'] ?? 0), $title, $text, $UID)];
    if (!empty($in['table'])) $res['table'] = ip_table_push($title, $text);
    ip_out(['ok' => true] + $res);

case 'status':
    $apps = [];
    foreach (['hub', 'character-sheets', 'character-creator', 'combat', 'dice', 'soundboard', 'session-log', 'welcome', 'file-viewer', 'oracle', 'writer', 'table'] as $a)
        $apps[$a] = is_file(__DIR__ . "/../$a/index.html") || is_file(__DIR__ . "/../$a/index.php");
    $theme = ip_setting($db, $UID, 'theme', 'night');
    ip_out(['ok' => true, 'user' => $USER, 'theme' => in_array($theme, THEMES, true) ? $theme : 'night', 'apps' => $apps,
            'table_open' => ip_table_open(), 'sheets' => ip_sheets_available($db)]);

case 'prefs_save':
    if (isset($in['theme'])) {
        if (!in_array($in['theme'], THEMES, true)) ip_fail('Unknown color scheme.');
        ip_set_setting($db, $UID, 'theme', $in['theme']);
    }
    ip_out(['ok' => true]);

default:
    ip_fail('Unknown action.', 404);
}
