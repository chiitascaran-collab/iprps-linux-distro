<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Oracle - JSON API. Every action needs the IPRPS Universal Login.
//
// GET  ?action=status                      Ollama and model status, generator list
// GET  ?action=campaigns                   campaigns from the IPRPS core database
// GET  ?action=memory&campaign=ID          the campaign memory the model will see
// GET  ?action=history&campaign=ID         this user's recent Oracle chat
// POST ?action=chat      {campaign, message | generator+details, model, use_memory}  (streams NDJSON)
// POST ?action=clear     {campaign}        delete this user's chat for the campaign
// POST ?action=pin       {campaign, text}  add to campaign memory
// POST ?action=unpin     {id}
// POST ?action=save      {campaign, type: npc|quest|log, text}
// POST ?action=display   {campaign, title, body}   show on the player display
// POST ?action=display_clear

require __DIR__ . '/config.php';
require __DIR__ . '/prompts.php';
require getenv('ORACLE_AUTH_CHECK') ?: __DIR__ . '/../auth/auth-check.php';

$USER = ip_require_login_api();
$UID  = (int)$USER['id'];
$action = $_GET['action'] ?? '';
$in = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
}

function out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $msg, int $code = 400): void { out(['ok' => false, 'error' => $msg], $code); }
function cid($v): ?int { $v = (int)$v; return $v > 0 ? $v : null; }

function ollama(string $path, ?array $body = null, int $timeout = 10): ?array {
    $ch = curl_init(OLLAMA_URL . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 3]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $r = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($r === false || $code >= 400) return null;
    return json_decode($r, true);
}

function installed_models(): ?array {
    $t = ollama('/api/tags');
    if ($t === null) return null;
    return array_values(array_map(fn($m) => $m['name'], $t['models'] ?? []));
}

// Ollama names "iprps-storyteller" as "iprps-storyteller:latest".
function resolve_model(?string $want, array $models): ?string {
    foreach ([$want, ORACLE_MODEL] as $m) {
        if (!$m) continue;
        foreach ($models as $have) {
            if ($have === $m || $have === "$m:latest") return $have;
        }
    }
    return $models[0] ?? null;
}

function clip(string $s, int $n): string {
    $s = trim(preg_replace('/\s+/u', ' ', $s));
    return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s;
}

// Campaign memory: what the model knows about the campaign, newest and most useful first.
function campaign_memory(PDO $db, int $uid, ?int $campaign): string {
    $parts = [];
    if ($campaign) {
        $st = $db->prepare('SELECT name, setting, description, status FROM campaigns WHERE id = ?');
        $st->execute([$campaign]);
        if ($c = $st->fetch()) {
            $parts[] = "CAMPAIGN: {$c['name']}" . ($c['setting'] ? " (setting: {$c['setting']})" : '') . " [{$c['status']}]"
                     . ($c['description'] ? "\n" . clip($c['description'], 1200) : '');
        }
        $st = $db->prepare('SELECT text FROM oracle_memory WHERE user_id = ? AND campaign_id = ? ORDER BY id');
        $st->execute([$uid, $campaign]);
        $pins = array_map(fn($r) => '- ' . clip($r['text'], 400), $st->fetchAll());
        if ($pins) $parts[] = "PINNED FACTS (always true in this campaign):\n" . implode("\n", $pins);

        $st = $db->prepare('SELECT id, session_no, title, recap, sm_notes FROM sessions WHERE campaign_id = ? ORDER BY session_no DESC LIMIT 3');
        $st->execute([$campaign]);
        $sessions = $st->fetchAll();
        foreach (array_reverse($sessions) as $s) {
            $t = "SESSION {$s['session_no']}" . ($s['title'] ? ": {$s['title']}" : '');
            if ($s['recap'])    $t .= "\nRecap: " . clip($s['recap'], 900);
            if ($s['sm_notes']) $t .= "\nSession Master notes: " . clip($s['sm_notes'], 600);
            $parts[] = $t;
        }
        if ($sessions) {
            $st = $db->prepare('SELECT kind, text FROM session_log WHERE session_id = ? ORDER BY id DESC LIMIT 30');
            $st->execute([$sessions[0]['id']]);
            $log = array_reverse($st->fetchAll());
            if ($log) $parts[] = "CURRENT SESSION LOG:\n" . implode("\n", array_map(fn($r) => "- [{$r['kind']}] " . clip($r['text'], 200), $log));
        }
        $st = $db->prepare('SELECT name, role, notes FROM npcs WHERE campaign_id = ? ORDER BY id DESC LIMIT 25');
        $st->execute([$campaign]);
        $npcs = $st->fetchAll();
        if ($npcs) $parts[] = "NPCS:\n" . implode("\n", array_map(fn($r) => "- {$r['name']}" . ($r['role'] ? " ({$r['role']})" : '') . ($r['notes'] ? ': ' . clip($r['notes'], 160) : ''), $npcs));

        $st = $db->prepare("SELECT title, status, notes FROM quests WHERE campaign_id = ? AND status IN ('open','active') ORDER BY id DESC LIMIT 15");
        $st->execute([$campaign]);
        $q = $st->fetchAll();
        if ($q) $parts[] = "OPEN QUESTS:\n" . implode("\n", array_map(fn($r) => "- {$r['title']} [{$r['status']}]" . ($r['notes'] ? ': ' . clip($r['notes'], 160) : ''), $q));

        $st = $db->prepare("SELECT name, species, role, level FROM characters WHERE campaign_id = ? AND status = 'active' LIMIT 12");
        $st->execute([$campaign]);
        $pc = $st->fetchAll();
        if ($pc) $parts[] = "PLAYER CHARACTERS:\n" . implode("\n", array_map(fn($r) => "- {$r['name']}" . ($r['species'] ? ", {$r['species']}" : '') . ($r['role'] ? " {$r['role']}" : '') . " (level {$r['level']})", $pc));
    }
    $mem = implode("\n\n", $parts);
    if (mb_strlen($mem) > ORACLE_MEMORY_MAX) $mem = mb_substr($mem, 0, ORACLE_MEMORY_MAX) . "\n[…memory trimmed]";
    return $mem;
}

function recent_history(PDO $db, int $uid, ?int $campaign): array {
    $st = $db->prepare('SELECT role, content FROM oracle_messages WHERE user_id = ? AND campaign_id <=> ? ORDER BY id DESC LIMIT ' . ORACLE_HISTORY_MSG);
    $st->execute([$uid, $campaign]);
    $rows = $st->fetchAll();
    $out = []; $len = 0;
    foreach ($rows as $r) {                       // newest first, stop at the budget
        $len += mb_strlen($r['content']);
        if ($len > ORACLE_HISTORY_MAX && $out) break;
        $out[] = ['role' => $r['role'], 'content' => $r['content']];
    }
    return array_reverse($out);
}

try {
    $db = oracle_db();
} catch (Throwable $e) {
    fail('The IPRPS database is not reachable. Is MariaDB running? (' . $e->getMessage() . ')', 503);
}

switch ($action) {

case 'status':
    $ver = ollama('/api/version');
    $models = $ver ? (installed_models() ?? []) : [];
    $gens = [];
    foreach (ORACLE_GENERATORS as $k => $g) $gens[] = ['key' => $k, 'label' => $g[0], 'icon' => $g[1]];
    out(['ok' => true, 'user' => $USER, 'ollama' => $ver['version'] ?? null, 'models' => $models,
         'default_model' => resolve_model(null, $models), 'iprps_model' => ORACLE_MODEL, 'generators' => $gens]);

case 'campaigns':
    $rows = $db->query("SELECT id, name, setting, status FROM campaigns ORDER BY FIELD(status,'active','planning','paused','finished'), name")->fetchAll();
    out(['ok' => true, 'campaigns' => $rows]);

case 'memory':
    $c = cid($_GET['campaign'] ?? 0);
    $st = $db->prepare('SELECT id, text FROM oracle_memory WHERE user_id = ? AND campaign_id <=> ? ORDER BY id');
    $st->execute([$UID, $c]);
    out(['ok' => true, 'memory' => campaign_memory($db, $UID, $c), 'pins' => $st->fetchAll()]);

case 'history':
    $c = cid($_GET['campaign'] ?? 0);
    $st = $db->prepare('SELECT id, role, content FROM oracle_messages WHERE user_id = ? AND campaign_id <=> ? ORDER BY id DESC LIMIT 60');
    $st->execute([$UID, $c]);
    out(['ok' => true, 'messages' => array_reverse($st->fetchAll())]);

case 'clear':
    $st = $db->prepare('DELETE FROM oracle_messages WHERE user_id = ? AND campaign_id <=> ?');
    $st->execute([$UID, cid($in['campaign'] ?? 0)]);
    out(['ok' => true, 'deleted' => $st->rowCount()]);

case 'pin':
    $text = trim((string)($in['text'] ?? ''));
    if ($text === '') fail('Nothing to pin.');
    $st = $db->prepare('INSERT INTO oracle_memory (user_id, campaign_id, text) VALUES (?, ?, ?)');
    $st->execute([$UID, cid($in['campaign'] ?? 0), mb_substr($text, 0, 4000)]);
    out(['ok' => true, 'id' => (int)$db->lastInsertId()]);

case 'unpin':
    $st = $db->prepare('DELETE FROM oracle_memory WHERE id = ? AND user_id = ?');
    $st->execute([(int)($in['id'] ?? 0), $UID]);
    out(['ok' => true, 'deleted' => $st->rowCount()]);

case 'save':
    $c = cid($in['campaign'] ?? 0);
    $text = trim((string)($in['text'] ?? ''));
    $type = $in['type'] ?? '';
    if (!$c) fail('Choose a campaign first.');
    if ($text === '') fail('Nothing to save.');
    $field = function (string $label) use ($text): ?string {
        return preg_match('/^\W*' . $label . '\W*:\s*(.+)$/mi', $text, $m) ? trim($m[1], " *_#\t") : null;
    };
    if ($type === 'npc') {
        $name = trim((string)($in['name'] ?? '')) ?: ($field('Name') ?? '');
        if ($name === '') fail('Give the NPC a name.');
        $st = $db->prepare('INSERT INTO npcs (campaign_id, name, role, notes) VALUES (?, ?, ?, ?)');
        $st->execute([$c, mb_substr($name, 0, 120), mb_substr($field('Role') ?? '', 0, 120) ?: null, $text]);
        out(['ok' => true, 'saved' => "NPC “{$name}” added to the campaign."]);
    }
    if ($type === 'quest') {
        $title = trim((string)($in['name'] ?? '')) ?: ($field('Title') ?? $field('Name') ?? '');
        if ($title === '') fail('Give the quest a title.');
        $st = $db->prepare('INSERT INTO quests (campaign_id, title, notes) VALUES (?, ?, ?)');
        $st->execute([$c, mb_substr($title, 0, 160), $text]);
        out(['ok' => true, 'saved' => "Quest “{$title}” added."]);
    }
    if ($type === 'log') {
        $st = $db->prepare('SELECT id, session_no FROM sessions WHERE campaign_id = ? ORDER BY session_no DESC LIMIT 1');
        $st->execute([$c]);
        $s = $st->fetch();
        if (!$s) fail('This campaign has no session yet. Create one in the Session Master Hub first.');
        $kind = in_array($in['kind'] ?? '', ['note','roll','combat','loot','xp','event'], true) ? $in['kind'] : 'note';
        $st = $db->prepare('INSERT INTO session_log (session_id, kind, text) VALUES (?, ?, ?)');
        $st->execute([$s['id'], $kind, $text]);
        out(['ok' => true, 'saved' => "Added to the log of session {$s['session_no']}."]);
    }
    fail('Unknown save type.');

case 'display':
    $body = trim((string)($in['body'] ?? ''));
    if ($body === '') fail('Nothing to show.');
    $st = $db->prepare("INSERT INTO display_items (campaign_id, kind, title, body, shown_by) VALUES (?, 'text', ?, ?, ?)");
    $st->execute([cid($in['campaign'] ?? 0), mb_substr(trim((string)($in['title'] ?? '')), 0, 160) ?: null, $body, $UID]);
    out(['ok' => true, 'id' => (int)$db->lastInsertId()]);

case 'display_clear':
    $db->prepare("INSERT INTO display_items (kind, shown_by) VALUES ('clear', ?)")->execute([$UID]);
    out(['ok' => true]);

case 'chat':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
    $c = cid($in['campaign'] ?? 0);
    $gen = (string)($in['generator'] ?? '');
    $message = $gen !== '' ? oracle_generator_prompt($gen, (string)($in['details'] ?? '')) : trim((string)($in['message'] ?? ''));
    if (!$message) fail('Type a message, or pick a generator.');
    $models = installed_models();
    if ($models === null) fail('The local AI service (Ollama) is not running. Start it with: sudo systemctl start ollama', 503);
    $model = resolve_model($in['model'] ?? null, $models);
    if (!$model) fail('No AI model is installed. See “AI models” in the IPRPS guide, or run: sudo iprps-ai-model status', 503);

    $system = ORACLE_SYSTEM;
    if (($in['use_memory'] ?? true) && $c) {
        $mem = campaign_memory($db, $UID, $c);
        if ($mem !== '') $system .= "\n\n=== CAMPAIGN MEMORY ===\n" . $mem . "\n=== END OF CAMPAIGN MEMORY ===";
    }
    $messages = array_merge([['role' => 'system', 'content' => $system]], recent_history($db, $UID, $c),
                            [['role' => 'user', 'content' => $message]]);
    $shown = $gen !== '' ? '⟡ ' . ORACLE_GENERATORS[$gen][0] . (trim((string)($in['details'] ?? '')) !== '' ? ': ' . trim($in['details']) : '') : $message;
    // Store the request as the model sees it, so later turns keep the format instructions.
    $db->prepare("INSERT INTO oracle_messages (user_id, campaign_id, role, content) VALUES (?, ?, 'user', ?)")
       ->execute([$UID, $c, $message]);

    $show = ollama('/api/show', ['model' => $model]);
    $req = ['model' => $model, 'messages' => $messages, 'stream' => true,
            'options' => ['num_ctx' => ORACLE_NUM_CTX]];
    if (in_array('thinking', $show['capabilities'] ?? [], true)) $req['think'] = false;   // answer directly

    // Stream: one JSON object per line -> {"t":"text"} ... {"done":true}
    set_time_limit(0);
    @ini_set('zlib.output_compression', '0');
    while (ob_get_level()) ob_end_flush();
    ob_implicit_flush(true);
    header('Content-Type: application/x-ndjson; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Accel-Buffering: no');
    $emit = function (array $o) { echo json_encode($o, JSON_UNESCAPED_UNICODE), "\n"; flush(); };
    $emit(['start' => true, 'model' => $model, 'shown' => $shown]);

    $answer = ''; $buf = ''; $err = null;
    $ch = curl_init(OLLAMA_URL . '/api/chat');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($req),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 900,
        CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$answer, &$buf, &$err, $emit) {
            if (connection_aborted()) return -1;                 // Stop pressed: stop generating
            $buf .= $data;
            while (($p = strpos($buf, "\n")) !== false) {
                $line = substr($buf, 0, $p); $buf = substr($buf, $p + 1);
                if (trim($line) === '') continue;
                $j = json_decode($line, true);
                if (!is_array($j)) continue;
                if (isset($j['error'])) { $err = $j['error']; continue; }
                $t = $j['message']['content'] ?? '';
                if ($t !== '') { $answer .= $t; $emit(['t' => $t]); }
            }
            return strlen($data);
        },
    ]);
    curl_exec($ch);
    $cerr = curl_errno($ch) && !connection_aborted() ? curl_error($ch) : null;
    curl_close($ch);

    $answer = trim(preg_replace('/<think>.*?<\/think>/s', '', $answer));
    $id = null;
    if ($answer !== '') {
        $db->prepare("INSERT INTO oracle_messages (user_id, campaign_id, role, content) VALUES (?, ?, 'assistant', ?)")
           ->execute([$UID, $c, $answer]);
        $id = (int)$db->lastInsertId();
    }
    if ($err || $cerr) $emit(['error' => $err ?: "Connection to Ollama lost: $cerr"]);
    $emit(['done' => true, 'id' => $id]);
    exit;

default:
    fail('Unknown action.', 404);
}
