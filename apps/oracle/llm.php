<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Oracle - the AI models: local (Ollama, on this computer) and online (Claude, Anthropic's API).
//
// A model value is either an Ollama name ("iprps-storyteller:latest") or "claude:<model id>".
// Claude needs internet and the Session Master's own Anthropic API key, kept in the IPRPS key vault
// (the same vault as IPRPS Welcome → API keys, provider "anthropic"). The key never reaches the browser.
//
// New Claude models: claude_check() asks Anthropic's Models API which models the key can use and keeps the
// newest Haiku, Sonnet, Opus and Fable. The Oracle runs it from "Check for new models" and once a week by itself,
// so new releases appear without a code change. CLAUDE_FAMILIES below is only the starting list.

defined('ANTHROPIC_URL')     || define('ANTHROPIC_URL', getenv('ORACLE_ANTHROPIC_URL') ?: 'https://api.anthropic.com');   // the variable: tests only
defined('ANTHROPIC_VERSION') || define('ANTHROPIC_VERSION', '2023-06-01');
defined('CLAUDE_MAX_TOKENS') || define('CLAUDE_MAX_TOKENS', 2048);   // a reply; sheets get twice this
defined('CLAUDE_CHECK_DAYS') || define('CLAUDE_CHECK_DAYS', 7);       // automatic check for new models

// family => [name, starting model id, what it's for]
const CLAUDE_FAMILIES = [
    'haiku'  => ['Claude Haiku',  'claude-haiku-5-5',  'fastest, lowest cost'],
    'sonnet' => ['Claude Sonnet', 'claude-sonnet-5-5', 'fast and very capable'],
    'opus'   => ['Claude Opus',   'claude-opus-5-5',   'richer writing, higher cost'],
    'fable'  => ['Claude Fable',  'claude-fable-5-1',  'most capable, highest cost'],
];

class LlmError extends RuntimeException {}

// ---------------------------------------------------------------- settings (per Session Master)
function llm_tables(PDO $db): void {
    static $done = false;
    if ($done) return;
    $db->exec("CREATE TABLE IF NOT EXISTS user_settings (
        user_id INT NOT NULL, name VARCHAR(60) NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY (user_id, name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS user_secrets (
        user_id INT NOT NULL, provider VARCHAR(40) NOT NULL, label VARCHAR(80), secret_enc TEXT NOT NULL,
        hint VARCHAR(12), updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, provider)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $done = true;
}
function setting_get(PDO $db, int $uid, string $name, ?string $default = null): ?string {
    llm_tables($db);
    $st = $db->prepare('SELECT value FROM user_settings WHERE user_id = ? AND name = ?');
    $st->execute([$uid, $name]);
    $v = $st->fetchColumn();
    return $v === false ? $default : $v;
}
function setting_set(PDO $db, int $uid, string $name, string $value): void {
    llm_tables($db);
    $db->prepare('REPLACE INTO user_settings (user_id, name, value) VALUES (?, ?, ?)')->execute([$uid, $name, $value]);
}

// ---------------------------------------------------------------- the key vault (same format as IPRPS Welcome)
function vault_key(bool $create): ?string {
    $dir = getenv('IPRPS_VAULT_DIR') ?: '/var/lib/iprps-vault';
    $f = "$dir/vault.key";
    if (is_file($f)) {
        $k = @file_get_contents($f);
        if ($k !== false && strlen($k) === 32) return $k;
        throw new LlmError("The key vault ($f) is damaged. Delete that file, then add your API key again.");
    }
    if (!$create) return null;
    if (!is_dir($dir) || !is_writable($dir)) throw new LlmError("The key vault folder $dir is missing or not writable by the web server.");
    $k = random_bytes(32);
    $old = umask(0077);
    $ok = file_put_contents("$f.tmp", $k) === 32 && rename("$f.tmp", $f);
    umask($old);
    if (!$ok) throw new LlmError('Could not create the key vault.');
    return $k;
}
function vault_get(PDO $db, int $uid, string $prov): ?string {
    llm_tables($db);
    $st = $db->prepare('SELECT secret_enc FROM user_secrets WHERE user_id = ? AND provider = ?');
    $st->execute([$uid, $prov]);
    $box = $st->fetchColumn();
    if ($box === false) return null;
    $key = vault_key(false);
    $raw = base64_decode(substr($box, 3), true);
    if (!$key || !str_starts_with($box, 'v1:') || $raw === false || strlen($raw) < 29)
        throw new LlmError('Your stored API key can\'t be read. Remove it and add it again.');
    $p = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), "$uid|$prov");
    if ($p === false) throw new LlmError('Your stored API key can\'t be read (the vault changed). Remove it and add it again.');
    return $p;
}
function vault_put(PDO $db, int $uid, string $prov, string $label, string $secret): string {
    llm_tables($db);
    if (!function_exists('openssl_encrypt')) throw new LlmError('PHP was built without OpenSSL: the key vault needs it.');
    $iv = random_bytes(12); $tag = '';
    $ct = openssl_encrypt($secret, 'aes-256-gcm', vault_key(true), OPENSSL_RAW_DATA, $iv, $tag, "$uid|$prov");
    $hint = '…' . substr($secret, -4);
    $db->prepare('REPLACE INTO user_secrets (user_id, provider, label, secret_enc, hint) VALUES (?, ?, ?, ?, ?)')
       ->execute([$uid, $prov, $label, 'v1:' . base64_encode($iv . $tag . $ct), $hint]);
    return $hint;
}
function vault_hint(PDO $db, int $uid, string $prov): ?string {
    llm_tables($db);
    $st = $db->prepare('SELECT hint FROM user_secrets WHERE user_id = ? AND provider = ?');
    $st->execute([$uid, $prov]);
    $h = $st->fetchColumn();
    return $h === false ? null : (string)$h;
}

// ---------------------------------------------------------------- which model
function is_claude(?string $model): bool { return is_string($model) && str_starts_with($model, 'claude:'); }

// The Session Master's Claude models: the stored list from the last check, or the starting list.
function claude_models(PDO $db, int $uid): array {
    $list = json_decode((string)setting_get($db, $uid, 'oracle.claude_models', ''), true);
    $out = [];
    foreach (CLAUDE_FAMILIES as $fam => [$name, $id, $what]) {
        $m = is_array($list) && isset($list[$fam]['id']) ? $list[$fam] : ['id' => $id, 'display_name' => null];
        $out[] = ['family' => $fam, 'value' => 'claude:' . $m['id'], 'id' => $m['id'],
                  'label' => $m['display_name'] ?: $name, 'what' => $what];
    }
    return $out;
}

// Ask Anthropic which models this key can use; keep the newest of each family. Returns [models, new names].
function claude_check(PDO $db, int $uid, ?string $key = null): array {
    $key = $key ?? vault_get($db, $uid, 'anthropic');
    if (!$key) throw new LlmError('Add your Anthropic API key first.');
    $all = []; $after = null;
    for ($page = 0; $page < 10; $page++) {
        $r = anthropic_request('GET', '/v1/models?limit=1000' . ($after ? '&after_id=' . rawurlencode($after) : ''), $key, null, 20);
        foreach ($r['data'] ?? [] as $m) if (isset($m['id'])) $all[] = $m;
        if (empty($r['has_more']) || empty($r['last_id'])) break;
        $after = $r['last_id'];
    }
    if (!$all) throw new LlmError('Anthropic returned no models for this key.');
    $old = json_decode((string)setting_get($db, $uid, 'oracle.claude_models', ''), true) ?: [];
    $best = [];
    foreach ($all as $m) {
        $id = (string)$m['id'];
        if (!preg_match('/^claude-(haiku|sonnet|opus|fable)-/', $id, $mm)) continue;   // e.g. Mythos: not offered here
        if (str_ends_with($id, '-latest')) continue;
        $fam = $mm[1];
        $t = strtotime((string)($m['created_at'] ?? '')) ?: 0;
        $cur = $best[$fam] ?? null;
        // newest release wins; for the same release, the short alias (no date) wins
        if (!$cur || $t > $cur['t'] || ($t === $cur['t'] && strlen($id) < strlen($cur['id'])))
            $best[$fam] = ['id' => $id, 'display_name' => $m['display_name'] ?? null, 't' => $t];
    }
    $new = [];
    $keep = [];
    foreach (CLAUDE_FAMILIES as $fam => [$name, $id]) {
        if (isset($best[$fam])) {
            $keep[$fam] = ['id' => $best[$fam]['id'], 'display_name' => $best[$fam]['display_name'], 'created_at' => $best[$fam]['t']];
            $was = $old[$fam]['id'] ?? $id;
            if ($best[$fam]['id'] !== $was) $new[] = $best[$fam]['display_name'] ?: $best[$fam]['id'];
        } elseif (isset($old[$fam])) {
            $keep[$fam] = $old[$fam];
        }
    }
    setting_set($db, $uid, 'oracle.claude_models', json_encode($keep));
    setting_set($db, $uid, 'oracle.claude_checked', (string)time());
    // A chosen model that was replaced moves to its family's newest
    $chosen = setting_get($db, $uid, 'oracle.model');
    if (is_claude($chosen)) {
        foreach (claude_models($db, $uid) as $m) {
            if (preg_match('/^claude:claude-' . $m['family'] . '-/', $chosen) && $chosen !== $m['value']) setting_set($db, $uid, 'oracle.model', $m['value']);
        }
    }
    return [claude_models($db, $uid), $new];
}

// ---------------------------------------------------------------- Anthropic HTTP
function anthropic_error(int $code, string $body): string {
    $j = json_decode($body, true);
    $msg = trim((string)($j['error']['message'] ?? ''));
    $type = (string)($j['error']['type'] ?? '');
    return match (true) {
        $code === 401 => 'Anthropic refused the API key. Check it in the Oracle\'s Online AI settings (or IPRPS Welcome → API keys).',
        $code === 403 => 'This API key isn\'t allowed to use that model' . ($msg ? ": $msg" : '.'),
        $code === 404 => 'That Claude model isn\'t available to your key. Open Online AI and choose Check for new models.',
        $code === 429 => 'Anthropic\'s rate limit was reached. Wait a minute and try again' . ($msg ? " ($msg)" : '.'),
        $code === 529 || $type === 'overloaded_error' => 'Claude is busy right now (overloaded). Try again in a moment, or use the local model.',
        $code === 400 && stripos($msg, 'credit') !== false => 'Your Anthropic account is out of credit: ' . $msg,
        $code === 0 => 'Can\'t reach Anthropic. Is this computer online? The local model works without internet.',
        default => "Claude answered with an error (HTTP $code)" . ($msg ? ": $msg" : '.'),
    };
}
function anthropic_request(string $method, string $path, string $key, ?array $body, int $timeout = 300): array {
    $ch = curl_init(ANTHROPIC_URL . $path);
    $h = ['x-api-key: ' . $key, 'anthropic-version: ' . ANTHROPIC_VERSION, 'content-type: application/json'];
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 10,
                            CURLOPT_HTTPHEADER => $h, CURLOPT_CUSTOMREQUEST => $method]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    $r = curl_exec($ch);
    $code = $r === false ? 0 : (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code < 200 || $code >= 300) throw new LlmError(anthropic_error($code, (string)$r));
    $j = json_decode((string)$r, true);
    if (!is_array($j)) throw new LlmError('Claude sent an answer the Oracle could not read.');
    return $j;
}

// Claude wants a separate system prompt, and messages that start with the user and alternate.
function claude_messages(array $messages): array {
    $sys = []; $out = [];
    foreach ($messages as $m) {
        if ($m['role'] === 'system') { $sys[] = $m['content']; continue; }
        $role = $m['role'] === 'assistant' ? 'assistant' : 'user';
        if (!$out && $role === 'assistant') continue;
        if ($out && end($out)['role'] === $role) { $out[count($out) - 1]['content'] .= "\n\n" . $m['content']; continue; }
        $out[] = ['role' => $role, 'content' => (string)$m['content']];
    }
    return [implode("\n\n", $sys), $out];
}

// ---------------------------------------------------------------- one interface for both
// Stream a chat reply: $emit(text) for each piece. Returns the full text; throws LlmError.
function llm_stream(PDO $db, int $uid, string $model, array $messages, callable $emit, array $opts = []): string {
    return is_claude($model) ? claude_stream($db, $uid, substr($model, 7), $messages, $emit, $opts)
                             : ollama_stream($model, $messages, $emit, $opts);
}
// A whole answer at once (recaps). Returns the text.
function llm_complete(PDO $db, int $uid, string $model, array $messages, array $opts = []): string {
    if (is_claude($model)) {
        [$system, $msgs] = claude_messages($messages);
        $req = ['model' => substr($model, 7), 'max_tokens' => $opts['max_tokens'] ?? CLAUDE_MAX_TOKENS, 'system' => $system, 'messages' => $msgs];
        if (isset($opts['temperature'])) $req['temperature'] = min(1.0, (float)$opts['temperature']);
        $r = anthropic_request('POST', '/v1/messages', claude_key($db, $uid), $req);
        $t = '';
        foreach ($r['content'] ?? [] as $b) if (($b['type'] ?? '') === 'text') $t .= $b['text'];
        return trim($t);
    }
    $req = ['model' => $model, 'stream' => false, 'messages' => $messages,
            'options' => ['num_ctx' => ORACLE_NUM_CTX] + (isset($opts['temperature']) ? ['temperature' => $opts['temperature']] : [])];
    ollama_no_think($model, $req);
    $r = ollama('/api/chat', $req, 900);
    if ($r === null) throw new LlmError('The local AI stopped or timed out (Ollama). Try again.');
    return trim(preg_replace('/<think>.*?<\/think>/s', '', (string)($r['message']['content'] ?? '')));
}
// A JSON object that follows $schema (character sheets). Returns the decoded array.
function llm_json(PDO $db, int $uid, string $model, array $messages, array $schema, array $opts = []): array {
    if (is_claude($model)) {
        [$system, $msgs] = claude_messages($messages);
        // A forced tool call is how Claude returns an object that fits a schema.
        $req = ['model' => substr($model, 7), 'max_tokens' => 2 * CLAUDE_MAX_TOKENS, 'system' => $system, 'messages' => $msgs,
                'tools' => [['name' => 'save_sheet', 'description' => 'Save the finished IPRPS character sheet.', 'input_schema' => $schema]],
                'tool_choice' => ['type' => 'tool', 'name' => 'save_sheet']];
        if (isset($opts['temperature'])) $req['temperature'] = min(1.0, (float)$opts['temperature']);
        $r = anthropic_request('POST', '/v1/messages', claude_key($db, $uid), $req);
        foreach ($r['content'] ?? [] as $b) if (($b['type'] ?? '') === 'tool_use' && is_array($b['input'] ?? null)) return $b['input'];
        throw new LlmError('Claude didn\'t return a sheet. Try again, or describe it differently.');
    }
    $req = ['model' => $model, 'stream' => false, 'format' => $schema, 'messages' => $messages,
            'options' => ['num_ctx' => ORACLE_NUM_CTX] + (isset($opts['temperature']) ? ['temperature' => $opts['temperature']] : [])];
    ollama_no_think($model, $req);
    $r = ollama('/api/chat', $req, 900);
    if ($r === null) throw new LlmError('The Oracle could not answer (Ollama stopped or timed out). Try again.');
    $raw = trim(preg_replace('/<think>.*?<\/think>/s', '', (string)($r['message']['content'] ?? '')));
    if (preg_match('/\{.*\}/s', $raw, $m)) $raw = $m[0];
    $j = json_decode($raw, true);
    if (!is_array($j) || array_is_list($j)) throw new LlmError('The Oracle\'s answer was not a usable sheet. Try again, or describe it differently.');
    return $j;
}

function claude_key(PDO $db, int $uid): string {
    $k = vault_get($db, $uid, 'anthropic');
    if (!$k) throw new LlmError('Claude needs your Anthropic API key. Open Online AI (next to the Model menu) and add it.');
    return $k;
}
function ollama_no_think(string $model, array &$req): void {
    $show = ollama('/api/show', ['model' => $model]);
    if (in_array('thinking', $show['capabilities'] ?? [], true)) $req['think'] = false;   // answer directly
}

function ollama_stream(string $model, array $messages, callable $emit, array $opts): string {
    $req = ['model' => $model, 'messages' => $messages, 'stream' => true, 'options' => ['num_ctx' => ORACLE_NUM_CTX]];
    ollama_no_think($model, $req);
    $answer = ''; $buf = ''; $err = null;
    $ch = curl_init(OLLAMA_URL . '/api/chat');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($req), CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 900,
        CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$answer, &$buf, &$err, $emit) {
            if (connection_aborted()) return -1;                 // Stop pressed: stop generating
            $buf .= $data;
            while (($p = strpos($buf, "\n")) !== false) {
                $line = substr($buf, 0, $p); $buf = substr($buf, $p + 1);
                $j = json_decode(trim($line), true);
                if (!is_array($j)) continue;
                if (isset($j['error'])) { $err = $j['error']; continue; }
                $t = $j['message']['content'] ?? '';
                if ($t !== '') { $answer .= $t; $emit($t); }
            }
            return strlen($data);
        },
    ]);
    curl_exec($ch);
    $cerr = curl_errno($ch) && !connection_aborted() ? curl_error($ch) : null;
    curl_close($ch);
    if ($err || $cerr) throw new LlmError($err ?: "Connection to Ollama lost: $cerr", 0, null);
    return $answer;
}

function claude_stream(PDO $db, int $uid, string $id, array $messages, callable $emit, array $opts): string {
    [$system, $msgs] = claude_messages($messages);
    $req = ['model' => $id, 'max_tokens' => $opts['max_tokens'] ?? CLAUDE_MAX_TOKENS, 'system' => $system, 'messages' => $msgs, 'stream' => true];
    $answer = ''; $buf = ''; $err = null; $code = 0; $body = '';
    $ch = curl_init(ANTHROPIC_URL . '/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($req, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['x-api-key: ' . claude_key($db, $uid), 'anthropic-version: ' . ANTHROPIC_VERSION, 'content-type: application/json'],
        CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 600,
        CURLOPT_HEADERFUNCTION => function ($ch, $h) use (&$code) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];
            return strlen($h);
        },
        CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$answer, &$buf, &$err, &$code, &$body, $emit) {
            if (connection_aborted()) return -1;
            if ($code >= 400) { $body .= $data; return strlen($data); }    // an error answer is plain JSON
            $buf .= $data;
            // Server-sent events: "event: …" and "data: {json}" lines; text arrives in content_block_delta
            while (($p = strpos($buf, "\n")) !== false) {
                $line = rtrim(substr($buf, 0, $p), "\r"); $buf = substr($buf, $p + 1);
                if (!str_starts_with($line, 'data:')) continue;
                $j = json_decode(trim(substr($line, 5)), true);
                if (!is_array($j)) continue;
                $type = $j['type'] ?? '';
                if ($type === 'content_block_delta' && ($j['delta']['type'] ?? '') === 'text_delta') {
                    $t = (string)$j['delta']['text'];
                    if ($t !== '') { $answer .= $t; $emit($t); }
                } elseif ($type === 'error') {
                    $err = anthropic_error(($j['error']['type'] ?? '') === 'overloaded_error' ? 529 : 500, json_encode($j));
                }
            }
            return strlen($data);
        },
    ]);
    $ok = curl_exec($ch);
    $cerr = curl_errno($ch) && !connection_aborted() ? curl_error($ch) : null;
    curl_close($ch);
    if ($code >= 400) throw new LlmError(anthropic_error($code, $body));
    if ($ok === false && $code === 0 && $cerr) throw new LlmError(anthropic_error(0, ''));
    if ($err) throw new LlmError($err);
    if ($cerr) throw new LlmError("The connection to Claude was cut off: $cerr");
    return $answer;
}

// What the Oracle tells the Session Master about a model
function model_label(PDO $db, int $uid, string $model): string {
    if (!is_claude($model)) return preg_replace('/:latest$/', '', $model);
    foreach (claude_models($db, $uid) as $m) if ($m['value'] === $model) return $m['label'];
    return substr($model, 7);
}
