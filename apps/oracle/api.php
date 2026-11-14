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
// POST ?action=recap  {session_id, model}   a players' recap of a session from its log (Session Log app)
// POST ?action=sheet_generate {kind: npc|creature, details, level, campaign, model}   a character sheet, saved to Character Sheets
// GET  ?action=online                      Claude: key stored?, models, last check
// POST ?action=claude_key   {secret}       check the Anthropic API key with Anthropic, then store it in the key vault
// POST ?action=claude_key_delete
// POST ?action=claude_check                ask Anthropic for the newest Claude models
// POST ?action=set_model    {model}        remember this Session Master's model (recaps and sheets use it too)
//
// "model" is an Ollama name, or "claude:<id>" for Claude (online, the Session Master's own API key; llm.php).

require __DIR__ . '/config.php';
require __DIR__ . '/prompts.php';
require __DIR__ . '/llm.php';
// Character Sheets (character-sheets/lib.php): the Oracle reads the Session Master's sheets and writes NPC and creature sheets.
$CS_LIB = getenv('ORACLE_SHEETS_LIB') ?: __DIR__ . '/../character-sheets/lib.php';
if (is_file($CS_LIB)) require_once $CS_LIB;
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

// The model to use: the one asked for, else this Session Master's last choice, else the IPRPS model.
// Claude models need no local service; local ones must be installed.
function pick_model(PDO $db, int $uid, ?string $want): string {
    $want = $want ?: setting_get($db, $uid, 'oracle.model');
    if (is_claude($want)) {
        if (!preg_match('/^claude:claude-[a-z0-9.-]{3,60}$/', $want)) throw new LlmError('Unknown Claude model.');
        return $want;
    }
    $models = installed_models();
    if ($models === null) throw new LlmError('The local AI service (Ollama) is not running. Start it with: sudo systemctl start ollama (or choose a Claude model).');
    $m = resolve_model($want, $models);
    if (!$m) throw new LlmError('No local AI model is installed. Run: sudo iprps-ai-model status (or choose a Claude model).');
    return $m;
}
// The base model the IPRPS model should be built from (ai/Modelfile), if it isn't downloaded yet.
function local_upgrade(?array $models): ?string {
    $mf = (getenv('ORACLE_AI_SHARE') ?: '/usr/share/iprps/ai') . '/Modelfile';
    if ($models === null || !is_readable($mf) || !preg_match('/^FROM\s+(\S+)/m', (string)file_get_contents($mf), $m)) return null;
    $base = $m[1];
    if (str_starts_with($base, '/') || str_starts_with($base, '.')) return null;          // a custom .gguf
    foreach ($models as $have) if ($have === $base || $have === "$base:latest") return null;
    return $base;
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

        // Character sheets in this campaign: one line each (full sheets are added when a name is mentioned)
        if (function_exists('cs_summary')) {
            try {
                $st = $db->prepare("SELECT kind, sheet_json FROM character_sheets WHERE user_id = ? AND campaign_id = ?
                                    ORDER BY FIELD(kind,'pc','npc','creature'), name LIMIT 30");
                $st->execute([$uid, $campaign]);
                $lines = [];
                foreach ($st->fetchAll() as $r) {
                    $s = json_decode($r['sheet_json'], true);
                    if (is_array($s)) $lines[] = '- ' . cs_summary($s, $r['kind']);
                }
                if ($lines) $parts[] = "CHARACTER SHEETS (IPRPS stats of player characters, NPCs and creatures):\n" . implode("\n", $lines);
            } catch (Throwable $e) { /* Character Sheets not used yet */ }
        }
    }
    $mem = implode("\n\n", $parts);
    if (mb_strlen($mem) > ORACLE_MEMORY_MAX) $mem = mb_substr($mem, 0, ORACLE_MEMORY_MAX) . "\n[…memory trimmed]";
    return $mem;
}

// Full sheets for characters the message names (by full name, or a first name of 4+ letters).
function sheet_details(PDO $db, int $uid, string $message, ?int $campaign): string {
    if (!function_exists('cs_summary')) return '';
    try {
        $st = $db->prepare('SELECT id, kind, name, notes, sheet_json, campaign_id FROM character_sheets WHERE user_id = ?
                            ORDER BY (campaign_id <=> ?) DESC, updated_at DESC LIMIT 500');
        $st->execute([$uid, $campaign]);
    } catch (Throwable $e) { return ''; }
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $name = trim($r['name']);
        if (mb_strlen($name) < 3) continue;
        $hit = mb_stripos($message, $name) !== false;
        if (!$hit) {
            $first = preg_split('/[\s,]+/u', $name)[0] ?? '';
            $hit = mb_strlen($first) >= 4 && preg_match('/(?<![\p{L}\p{N}])' . preg_quote($first, '/') . '(?![\p{L}\p{N}])/iu', $message);
        }
        if (!$hit) continue;
        $s = json_decode($r['sheet_json'], true);
        if (is_array($s)) $out[] = cs_summary($s, $r['kind'], true, $r);
        if (count($out) >= 3) break;
    }
    return implode("\n\n", $out);
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
    $chosen = setting_get($db, $UID, 'oracle.model');
    $checked = (int)setting_get($db, $UID, 'oracle.claude_checked', '0');
    $hint = vault_hint($db, $UID, 'anthropic');
    out(['ok' => true, 'user' => $USER, 'ollama' => $ver['version'] ?? null, 'models' => $models,
         'default_model' => resolve_model(null, $models), 'iprps_model' => ORACLE_MODEL, 'generators' => $gens,
         'sheets' => function_exists('cs_save'), 'chosen' => $chosen, 'local_upgrade' => $ver ? local_upgrade($models) : null,
         'claude' => ['key' => $hint, 'models' => claude_models($db, $UID), 'checked' => $checked ?: null,
                      'check_due' => $hint !== null && time() - $checked > CLAUDE_CHECK_DAYS * 86400]]);

case 'online':
    $checked = (int)setting_get($db, $UID, 'oracle.claude_checked', '0');
    out(['ok' => true, 'key' => vault_hint($db, $UID, 'anthropic'), 'models' => claude_models($db, $UID), 'checked' => $checked ?: null]);

case 'claude_key':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
    $secret = trim((string)($in['secret'] ?? ''));
    if ($secret === '' || strlen($secret) > 400 || preg_match('/\s/', $secret)) fail('Paste the key exactly as the Anthropic Console shows it (no spaces).');
    try {
        [$models, $new] = claude_check($db, $UID, $secret);           // proves the key works before it is stored
        $hint = vault_put($db, $UID, 'anthropic', 'Anthropic (Claude)', $secret);
    } catch (LlmError $e) { fail($e->getMessage(), 400); }
    out(['ok' => true, 'key' => $hint, 'models' => $models, 'checked' => time()]);

case 'claude_key_delete':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
    llm_tables($db);
    $db->prepare("DELETE FROM user_secrets WHERE user_id = ? AND provider = 'anthropic'")->execute([$UID]);
    if (is_claude(setting_get($db, $UID, 'oracle.model'))) $db->prepare("DELETE FROM user_settings WHERE user_id = ? AND name = 'oracle.model'")->execute([$UID]);
    out(['ok' => true]);

case 'claude_check':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
    try { [$models, $new] = claude_check($db, $UID); } catch (LlmError $e) { fail($e->getMessage(), 502); }
    out(['ok' => true, 'models' => $models, 'new' => $new, 'checked' => time(), 'chosen' => setting_get($db, $UID, 'oracle.model')]);

case 'set_model':
    $m = (string)($in['model'] ?? '');
    if ($m === '' || strlen($m) > 120 || preg_match('/\s/', $m)) fail('Choose a model.');
    setting_set($db, $UID, 'oracle.model', $m);
    out(['ok' => true]);

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
    try {
        $model = pick_model($db, $UID, $in['model'] ?? null);
        if (is_claude($model)) claude_key($db, $UID);                     // fail now, not halfway
    } catch (LlmError $e) { fail($e->getMessage(), 503); }
    if (!empty($in['model'])) setting_set($db, $UID, 'oracle.model', $model);

    $system = ORACLE_SYSTEM;
    if (($in['use_memory'] ?? true) && $c) {
        $mem = campaign_memory($db, $UID, $c);
        if ($mem !== '') $system .= "\n\n=== CAMPAIGN MEMORY ===\n" . $mem . "\n=== END OF CAMPAIGN MEMORY ===";
    }
    if ($in['use_memory'] ?? true) {
        $det = sheet_details($db, $UID, $message, $c);
        if ($det !== '') $system .= "\n\n=== CHARACTER SHEETS NAMED IN THIS MESSAGE ===\n" . $det . "\n=== END OF CHARACTER SHEETS ===";
    }
    $messages = array_merge([['role' => 'system', 'content' => $system]], recent_history($db, $UID, $c),
                            [['role' => 'user', 'content' => $message]]);
    $shown = $gen !== '' ? '⟡ ' . ORACLE_GENERATORS[$gen][0] . (trim((string)($in['details'] ?? '')) !== '' ? ': ' . trim($in['details']) : '') : $message;
    // Store the request as the model sees it, so later turns keep the format instructions.
    $db->prepare("INSERT INTO oracle_messages (user_id, campaign_id, role, content) VALUES (?, ?, 'user', ?)")
       ->execute([$UID, $c, $message]);
    $askId = (int)$db->lastInsertId();

    // Stream: one JSON object per line -> {"t":"text"} ... {"done":true}
    set_time_limit(0);
    @ini_set('zlib.output_compression', '0');
    while (ob_get_level()) ob_end_flush();
    ob_implicit_flush(true);
    header('Content-Type: application/x-ndjson; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Accel-Buffering: no');
    $emit = function (array $o) { echo json_encode($o, JSON_UNESCAPED_UNICODE), "\n"; flush(); };
    $emit(['start' => true, 'model' => $model, 'label' => model_label($db, $UID, $model), 'online' => is_claude($model), 'shown' => $shown]);

    $answer = ''; $err = null;
    try {
        $answer = llm_stream($db, $UID, $model, $messages, function (string $t) use ($emit) { $emit(['t' => $t]); });
    } catch (LlmError $e) { $err = $e->getMessage(); }

    $answer = trim(preg_replace('/<think>.*?<\/think>/s', '', $answer));
    $id = null;
    if ($answer !== '') {
        $db->prepare("INSERT INTO oracle_messages (user_id, campaign_id, role, content) VALUES (?, ?, 'assistant', ?)")
           ->execute([$UID, $c, $answer]);
        $id = (int)$db->lastInsertId();
    }
    // A question that got no answer leaves the history, so it isn't sent again with the next one
    if ($answer === '') $db->prepare('DELETE FROM oracle_messages WHERE id = ? AND user_id = ?')->execute([$askId, $UID]);
    if ($err) $emit(['error' => $err]);
    $emit(['done' => true, 'id' => $id]);
    exit;

case 'recap':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
    $st = $db->prepare('SELECT s.*, c.name AS campaign_name FROM sessions s JOIN campaigns c ON c.id = s.campaign_id WHERE s.id = ?');
    $st->execute([(int)($in['session_id'] ?? 0)]);
    $sess = $st->fetch();
    if (!$sess) fail('That session no longer exists.', 404);
    $st = $db->prepare('SELECT kind, text FROM session_log WHERE session_id = ? ORDER BY logged_at, id');
    $st->execute([$sess['id']]);
    $lines = array_map(fn($r) => "- [{$r['kind']}] " . clip($r['text'], 400), $st->fetchAll());
    if (!$lines) fail('The session log is empty: there is nothing to recap yet.');
    $logText = implode("\n", $lines);
    if (mb_strlen($logText) > 9000) $logText = mb_substr($logText, -9000);          // the end of a long session matters most
    try { $model = pick_model($db, $UID, $in['model'] ?? null); } catch (LlmError $e) { fail($e->getMessage(), 503); }
    $system = ORACLE_SYSTEM;
    $mem = campaign_memory($db, $UID, (int)$sess['campaign_id']);
    if ($mem !== '') $system .= "\n\n=== CAMPAIGN MEMORY ===\n" . $mem . "\n=== END OF CAMPAIGN MEMORY ===";
    $ask = "Write the recap of session {$sess['session_no']}" . ($sess['title'] ? " (\"{$sess['title']}\")" : '') . " of the campaign {$sess['campaign_name']}, for the players.\n"
         . "Use only what the session log below says happened; don't invent events. Past tense, vivid but short: two to four paragraphs, naming the characters.\n"
         . "Leave out anything the players' characters couldn't know, and never reveal the Session Master's notes or secrets.\n"
         . "End with a short list headed \"Threads to follow\" (2-4 open questions or leads).\n\nSESSION LOG:\n" . $logText;
    set_time_limit(0);
    try {
        $text = llm_complete($db, $UID, $model, [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $ask]], ['temperature' => 0.7]);
    } catch (LlmError $e) { fail($e->getMessage(), 502); }
    if ($text === '') fail('The Oracle could not write the recap. Try again.', 502);
    out(['ok' => true, 'text' => $text, 'model' => $model, 'label' => model_label($db, $UID, $model)]);

case 'sheet_generate':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
    if (!function_exists('cs_save')) fail('Character Sheets is not installed (/srv/www/iprps/character-sheets).', 503);
    $kind = ($in['kind'] ?? '') === 'creature' ? 'creature' : 'npc';
    $c = cid($in['campaign'] ?? 0);
    $details = mb_substr(trim((string)($in['details'] ?? '')), 0, 1000);
    $level = isset($in['level']) && (int)$in['level'] > 0 ? min(110, (int)$in['level']) : null;
    try { $model = pick_model($db, $UID, $in['model'] ?? null); } catch (LlmError $e) { fail($e->getMessage(), 503); }

    $system = ORACLE_SYSTEM . "\n\n" . ORACLE_SHEET_RULES;
    if ($c) {
        $mem = campaign_memory($db, $UID, $c);
        if ($mem !== '') $system .= "\n\n=== CAMPAIGN MEMORY ===\n" . $mem . "\n=== END OF CAMPAIGN MEMORY ===";
    }
    if (!is_claude($model)) $system .= "\n\nAnswer with the JSON object only.";
    set_time_limit(0);
    try {
        $sheet = llm_json($db, $UID, $model, [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => oracle_sheet_prompt($kind, $details, $level)]],
                          oracle_sheet_schema($kind), ['temperature' => 0.8]);
    } catch (LlmError $e) { fail($e->getMessage(), 502); }
    $sheet['sheetType'] = $kind;
    if ($level) $sheet['level'] = $level;
    unset($sheet['characterPoints'], $sheet['avatar'], $sheet['playerName']);
    try {
        $saved = cs_save($db, $UID, $sheet, ['kind' => $kind, 'source' => 'oracle', 'campaign_id' => $c]);
    } catch (Throwable $e) { fail('The Oracle\'s sheet could not be saved: ' . $e->getMessage(), 502); }
    $st = $db->prepare('SELECT kind, notes, sheet_json FROM character_sheets WHERE id = ? AND user_id = ?');
    $st->execute([$saved['id'], $UID]);
    $row = $st->fetch();
    $summary = cs_summary(json_decode($row['sheet_json'], true), $kind, true);
    $label = $kind === 'creature' ? 'creature' : 'NPC';
    $text = "**Character sheet saved: {$saved['name']}** ($label, sheet #{$saved['id']})\n\n" . preg_replace('/\n(?!- )/', "\n\n", $summary);
    $db->prepare("INSERT INTO oracle_messages (user_id, campaign_id, role, content) VALUES (?, ?, 'user', ?)")
       ->execute([$UID, $c, oracle_sheet_request($kind, $details, $level)]);
    $db->prepare("INSERT INTO oracle_messages (user_id, campaign_id, role, content) VALUES (?, ?, 'assistant', ?)")
       ->execute([$UID, $c, $text]);
    out(['ok' => true, 'id' => $saved['id'], 'name' => $saved['name'], 'kind' => $kind, 'message' => $text,
         'message_id' => (int)$db->lastInsertId(), 'model' => $model]);

default:
    fail('Unknown action.', 404);
}
