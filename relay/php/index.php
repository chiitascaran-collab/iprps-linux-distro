<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Link relay (PHP) - the public address remote players open, for ordinary web hosting.
//
//  Upload this folder (index.php, .htaccess, config.php) to your site, e.g. https://example.com/play/
//  Players:  https://example.com/play/t/<table>/     The Session Master's computer dials in on /_link/.
//  Needs PHP 7.4+ and a writable "data" folder. No database. It stores nothing about the game: requests
//  wait in the data folder for a moment until the Session Master's computer collects and answers them.
//  The Node.js relay (relay/node) speaks the same protocol and is faster; use it where you can run a service.

declare(strict_types=1);
const LINK_VERSION = '1.0.0';
$CFG = [
    'public_url' => '',                                   // '' = work it out from the request
    'auth_url' => 'https://infiniteplane.space/auth/',    // where Infinite Plane accounts are checked
    'auth_check' => '',                                   // path to auth-check.php when this site has the shared /auth/ folder ('' = look for it)
    'owners' => [],                                       // usernames or emails allowed to connect a table; [] = the first account that connects
    'data_dir' => __DIR__ . '/data',
    'max_upload_mb' => 20,
    'stream_seconds' => 50,                               // how long one live-events response may stay open
    'trust_proxy' => false,
    'base_path' => null,                                  // null = work it out; '' or '/play' to say where this folder is on the site
];
if (is_file(__DIR__ . '/config.php')) $CFG = array_merge($CFG, (array) require __DIR__ . '/config.php');
$DATA = rtrim($CFG['data_dir'], '/');
@ini_set('zlib.output_compression', '0');
@ini_set('display_errors', '0');
if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');

// ---------------------------------------------------------------- helpers
function out_json(int $status, array $obj, array $headers = []): void {
    http_response_code($status);
    header('Content-Type: application/json'); header('Cache-Control: no-store');
    foreach ($headers as $h) header($h);
    echo json_encode($obj); exit;
}
function page(int $status, string $title, string $body, int $refresh = 0): void {
    http_response_code($status); header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
    $meta = $refresh ? "<meta http-equiv=\"refresh\" content=\"$refresh\">" : '';
    echo "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">$meta<title>$title</title>"
       . "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0e1a;color:#e6e3d6;font:16px/1.5 system-ui,sans-serif}main{max-width:520px;padding:24px;text-align:center}h1{font:600 26px Georgia,serif;color:#f1d58c}p{color:#b9b6a8}</style>"
       . "</head><body><main><h1>✦ $title</h1>$body</main></body></html>"; exit;
}
function put(string $file, string $data): void { $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp'; file_put_contents($tmp, $data); rename($tmp, $file); }
function get_json(string $file): ?array { $s = @file_get_contents($file); if ($s === false) return null; $j = json_decode($s, true); return is_array($j) ? $j : null; }
function rmtree(string $dir): void { foreach ((array) @scandir($dir) as $f) { if ($f === '.' || $f === '..' || $f === false) continue; $p = "$dir/$f"; is_dir($p) ? rmtree($p) : @unlink($p); } @rmdir($dir); }
function client_ip(): string { global $CFG; if ($CFG['trust_proxy'] && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]); return $_SERVER['REMOTE_ADDR'] ?? ''; }
function limited(string $key, int $max, int $seconds): bool {
    global $DATA; $f = "$DATA/rl/" . hash('sha256', $key);
    $now = time(); $a = array_values(array_filter((array) (get_json($f) ?? []), fn($t) => $now - $t < $seconds));
    $a[] = $now; put($f, json_encode($a)); return count($a) > $max;
}
function no_buffering(): void { while (ob_get_level() > 0) @ob_end_flush(); header('X-Accel-Buffering: no'); }
function is_console(string $p): bool {
    $n = strtolower(preg_replace('#/+#', '/', rawurldecode(parse_url($p, PHP_URL_PATH) ?: '/')));
    return $n === '/sm' || strpos($n, '/sm/') === 0 || strpos($n, '/api/sm') === 0 || strpos($n, '..') !== false;
}

// ---------------------------------------------------------------- where am I
$sn = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
$script = substr($sn, -10) === '/index.php' ? dirname($sn) : '/';
$base = rtrim($script === '/' || $script === '.' ? '' : $script, '/');
if ($CFG['base_path'] !== null) $base = rtrim((string) $CFG['base_path'], '/');
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';
$query = parse_url($uri, PHP_URL_QUERY); $search = $query !== null && $query !== false && $query !== '' ? '?' . $query : '';
if ($base !== '' && strpos($path, $base) === 0) $path = substr($path, strlen($base)) ?: '/';
if (strpos($path, '/index.php') === 0) $path = substr($path, 10) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
function public_url(): string {
    global $CFG, $base;
    if ($CFG['public_url']) return rtrim($CFG['public_url'], '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($CFG['trust_proxy'] && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base;
}

// ---------------------------------------------------------------- storage
if (!is_dir("$DATA/t")) {
    @mkdir("$DATA/t", 0700, true); @mkdir("$DATA/rl", 0700, true);
    @file_put_contents("$DATA/.htaccess", "Require all denied\nDeny from all\n"); @file_put_contents("$DATA/index.html", '');
    if (!is_dir("$DATA/t")) out_json(500, ['ok' => false, 'error' => 'The relay cannot write to its data folder. Make "data" writable.']);
}
if (!is_file("$DATA/secret")) { put("$DATA/secret", bin2hex(random_bytes(32))); @chmod("$DATA/secret", 0600); }
$SECRET = trim((string) file_get_contents("$DATA/secret"));
function tdir(string $id): string { global $DATA; return "$DATA/t/$id"; }
function table_online(string $id): bool { clearstatcache(true, tdir($id) . '/seen'); $m = @filemtime(tdir($id) . '/seen'); return $m && time() - $m < 45; }
function sweep(string $id): void {
    $now = time();
    foreach ((array) @glob(tdir($id) . '/r/*', GLOB_ONLYDIR) as $d) {
        $age = $now - (int) @filemtime($d);
        if ($age > 900 || ($age > 90 && (is_file("$d/gone") || is_file("$d/end")))) rmtree($d);
    }
    foreach ((array) @glob(tdir($id) . '/q/*.json') as $f) if ($now - (int) @filemtime($f) > 60) @unlink($f);
}

// ---------------------------------------------------------------- Infinite Plane accounts
function who_is(string $token): array {
    global $CFG;
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) out_json(401, ['ok' => false, 'error' => 'Sign in with your Infinite Plane account.']);
    $local = $CFG['auth_check'] ?: (($_SERVER['DOCUMENT_ROOT'] ?? '') . '/auth/auth-check.php');
    if (is_file($local)) {                                  // this site has the shared /auth/ folder: ask it directly
        $_SERVER['HTTP_X_AUTH_TOKEN'] = $token;
        require_once $local;
        $u = ip_current_user();
        if (!$u) out_json(401, ['ok' => false, 'error' => 'Your Infinite Plane sign-in has ended. Sign in again.']);
        return $u;
    }
    $url = rtrim($CFG['auth_url'], '/') . '/auth.php'; $body = json_encode(['action' => 'me']); $raw = false;
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Auth-Token: ' . $token, 'User-Agent: IPRPS-Link-Relay/' . LINK_VERSION]]);
        $raw = curl_exec($c); curl_close($c);
    } else {
        $raw = @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'POST', 'timeout' => 15, 'ignore_errors' => true, 'content' => $body,
            'header' => "Content-Type: application/json\r\nX-Auth-Token: $token\r\nUser-Agent: IPRPS-Link-Relay/" . LINK_VERSION . "\r\n"]]));
    }
    if ($raw === false) out_json(502, ['ok' => false, 'error' => 'The relay could not reach the Infinite Plane sign-in service.']);
    $j = json_decode((string) $raw, true);
    if (!is_array($j) || empty($j['ok']) || !isset($j['user']['id'])) out_json(401, ['ok' => false, 'error' => 'Your Infinite Plane sign-in has ended. Sign in again.']);
    return $j['user'];
}
function allowed(array $user): bool {
    global $CFG, $DATA;
    $names = array_filter([strtolower((string) ($user['username'] ?? '')), strtolower((string) ($user['email'] ?? ''))]);
    $owners = array_map('strtolower', (array) $CFG['owners']);
    if ($owners) return (bool) array_intersect($names, $owners);
    $o = get_json("$DATA/owner.json");
    if (!$o) { put("$DATA/owner.json", json_encode(['id' => $user['id'], 'username' => $user['username'] ?? '', 'claimed' => gmdate('c')])); return true; }
    return (string) $o['id'] === (string) $user['id'];
}

// ================================================================ the Session Master's side (/_link/)
if (strpos($path, '/_link/') === 0) {
    $op = substr($path, 7);
    if ($op === 'health') out_json(200, ['ok' => true, 'relay' => 'php', 'version' => LINK_VERSION]);
    if ($op === 'streamtest') {
        header('Content-Type: text/plain'); header('Cache-Control: no-store'); no_buffering();
        echo "1\n"; flush(); usleep(500000); echo "2\n"; flush(); usleep(500000); echo "3\n"; exit;
    }
    if ($op === 'open' && $method === 'POST') {
        if (limited('open:' . client_ip(), 20, 60)) out_json(429, ['ok' => false, 'error' => 'Too many tries. Wait a minute.']);
        $user = who_is(trim((string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '')));
        if (!allowed($user)) out_json(403, ['ok' => false, 'error' => 'This relay belongs to another Session Master. Use your own relay\'s address.']);
        $id = substr(hash_hmac('sha256', 'table:' . $user['id'], $SECRET), 0, 12); $key = bin2hex(random_bytes(32));
        @mkdir(tdir($id) . '/q', 0700, true); @mkdir(tdir($id) . '/r', 0700, true);
        foreach ((array) @glob(tdir($id) . '/q/*.json') as $f) @unlink($f);
        foreach ((array) @glob(tdir($id) . '/r/*', GLOB_ONLYDIR) as $d) rmtree($d);
        put(tdir($id) . '/table.json', json_encode(['id' => $id, 'user' => ['id' => $user['id'], 'username' => $user['username'] ?? ''], 'keyHash' => hash('sha256', $key), 'burst' => false]));
        touch(tdir($id) . '/seen');
        out_json(200, ['ok' => true, 'relay' => 'php', 'version' => LINK_VERSION, 'table' => $id, 'key' => $key, 'url' => public_url() . "/t/$id/"]);
    }
    $id = preg_replace('/[^a-z0-9]/', '', (string) ($_GET['table'] ?? ''));
    $T = $id !== '' ? get_json(tdir($id) . '/table.json') : null;
    $keyOk = fn(?array $t) => $t && hash_equals((string) $t['keyHash'], hash('sha256', (string) ($_SERVER['HTTP_X_LINK_KEY'] ?? '')));
    if (!$keyOk($T)) out_json(401, ['ok' => false, 'error' => 'Not connected']);
    $dir = tdir($id);
    $rid = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['id'] ?? ''));

    if ($op === 'poll') {
        @set_time_limit(60); ignore_user_abort(false);
        $until = microtime(true) + min(max((int) ($_GET['wait'] ?? 20), 1), 25); $n = 0;
        if (random_int(0, 40) === 0) sweep($id);
        while (true) {
            if ($n % 30 === 0) { touch("$dir/seen"); if ($n && !$keyOk(get_json("$dir/table.json"))) out_json(401, ['ok' => false, 'error' => 'Replaced by a newer connection']); }
            $out = [];
            $files = (array) @glob("$dir/q/*.json"); sort($files);
            foreach ($files as $f) {
                $meta = get_json($f); if (!$meta) continue;
                if (!@rename($f, "$dir/r/{$meta['id']}/meta.json")) continue;          // another poll took it
                $out[] = $meta;
            }
            if ($out || microtime(true) >= $until) out_json(200, ['ok' => true, 'requests' => $out]);
            usleep(60000); $n++;
        }
    }
    if ($op === 'body') {
        $f = "$dir/r/$rid/body"; if ($rid === '' || !is_file($f)) out_json(404, ['ok' => false]);
        header('Content-Type: application/octet-stream'); header('Content-Length: ' . filesize($f)); readfile($f); @unlink($f); exit;
    }
    if ($op === 'chunk' && $method === 'POST') {
        $d = "$dir/r/$rid"; $seq = (int) ($_GET['seq'] ?? 0);
        $consumed = fn() => is_file("$d/consumed") ? (int) file_get_contents("$d/consumed") : -1;
        if ($rid === '' || !is_dir($d)) out_json(200, ['ok' => true, 'gone' => true, 'consumed' => -1]);
        if (is_file("$d/gone")) out_json(200, ['ok' => true, 'gone' => true, 'consumed' => $consumed()]);
        if (!empty($_SERVER['HTTP_X_LINK_HEAD']) && !is_file("$d/head.json")) put("$d/head.json", (string) base64_decode($_SERVER['HTTP_X_LINK_HEAD']));
        put(sprintf('%s/c%08d', $d, $seq), (string) file_get_contents('php://input'));
        if (($_GET['end'] ?? '') === '1') touch("$d/end");
        $until = microtime(true) + 20;                                               // slow player: hold the next chunk back
        while (count((array) @glob("$d/c0*")) > 12 && microtime(true) < $until && !is_file("$d/gone")) usleep(80000);
        clearstatcache();
        out_json(200, ['ok' => true, 'gone' => is_file("$d/gone"), 'consumed' => $consumed()]);
    }
    if ($op === 'set' && $method === 'POST') { $T['burst'] = ($_GET['burst'] ?? '') === '1'; put("$dir/table.json", json_encode($T)); out_json(200, ['ok' => true]); }
    if ($op === 'close' && $method === 'POST') { @unlink("$dir/seen"); foreach ((array) @glob("$dir/r/*", GLOB_ONLYDIR) as $x) @touch("$x/gone"); out_json(200, ['ok' => true]); }
    out_json(404, ['ok' => false, 'error' => 'Not found']);
}

// ================================================================ the players' side (/t/<table>/...)
if (preg_match('#^/t/([a-z0-9]{6,20})(/.*)?$#', $path, $m)) {
    $id = $m[1]; $rest = $m[2] ?? '';
    if ($rest === '') { header("Location: $base/t/$id/$search", true, 302); exit; }
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $wantsPage = $method === 'GET' && strpos($accept, 'text/html') !== false && strpos($rest, '/api/') !== 0;
    $T = get_json(tdir($id) . '/table.json');
    if (!$T || !table_online($id)) {
        $msg = 'The Session Master\'s table isn\'t connected right now.';
        if ($wantsPage) page(503, 'IPRPS Table', "<p>$msg</p><p>This page tries again by itself. Ask your Session Master to turn on remote play.</p>", 6);
        out_json(503, ['ok' => false, 'error' => $msg]);
    }
    if (is_console($rest)) out_json(403, ['ok' => false, 'error' => 'The Session Master console only opens on the Session Master\'s computer.']);
    $ip = client_ip();
    if ($method === 'POST' && $rest === '/api/join' && limited("join:$id:$ip", 12, 300)) out_json(429, ['ok' => false, 'error' => 'Too many tries. Wait a few minutes and try again.']);
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0); $max = (int) $CFG['max_upload_mb'] << 20;
    if ($len > $max) out_json(413, ['ok' => false, 'error' => "That file is too big (limit {$CFG['max_upload_mb']} MB)."]);

    $rid = bin2hex(random_bytes(9)); $d = tdir($id) . "/r/$rid";
    if (!@mkdir($d, 0700, true)) out_json(503, ['ok' => false, 'error' => 'The table is busy. Try again in a moment.']);
    $hasBody = false;
    if ($method !== 'GET' && $method !== 'HEAD') {
        $in = fopen('php://input', 'rb'); $out = fopen("$d/body", 'wb'); $n = stream_copy_to_stream($in, $out, $max + 1); fclose($in); fclose($out);
        if ($n > $max) { rmtree($d); out_json(413, ['ok' => false, 'error' => "That file is too big (limit {$CFG['max_upload_mb']} MB)."]); }
        $hasBody = $n > 0; if (!$hasBody) @unlink("$d/body");
    }
    $drop = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'accept-encoding', 'content-length', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'x-real-ip', 'x-auth-token', 'x-link-key', 'x-link-head', 'authorization'];
    $headers = [];
    foreach ($_SERVER as $k => $v) if (strpos($k, 'HTTP_') === 0) { $name = strtolower(str_replace('_', '-', substr($k, 5))); if (!in_array($name, $drop, true)) $headers[$name] = $v; }
    if (!empty($_SERVER['CONTENT_TYPE'])) $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
    // Only the Table's own cookie travels on: any other cookie of this site (a sign-in, for one) stays here.
    unset($headers['cookie']);
    if (preg_match('/(?:^|;\s*)iprps_table=([^;]*)/', $_SERVER['HTTP_COOKIE'] ?? '', $ck)) $headers['cookie'] = 'iprps_table=' . $ck[1];
    $meta = ['id' => $rid, 'method' => $method, 'path' => $rest . $search, 'headers' => $headers, 'hasBody' => $hasBody,
        'client' => substr(hash('sha256', $ip . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 16)];
    put(sprintf('%s/q/%015.4f_%s.json', tdir($id), microtime(true), $rid), json_encode($meta));

    ignore_user_abort(true); @set_time_limit(0);
    $leave = function () use ($d) { @touch("$d/gone"); exit; };
    // wait for the Session Master's computer to answer
    $until = microtime(true) + 45;
    while (!is_file("$d/head.json")) {
        if (microtime(true) >= $until) { @touch("$d/gone"); out_json(504, ['ok' => false, 'error' => 'The Session Master\'s computer did not answer.']); }
        if (connection_aborted()) $leave();
        usleep(30000); clearstatcache();
    }
    $head = get_json("$d/head.json") ?? ['status' => 502, 'headers' => []];
    http_response_code((int) ($head['status'] ?? 502));
    $live = false;
    header_remove('X-Powered-By');
    foreach ((array) ($head['headers'] ?? []) as $k => $v) {
        if (preg_match('/^(connection|keep-alive|transfer-encoding|upgrade)$/i', (string) $k)) continue;
        if (strtolower((string) $k) === 'content-type' && strpos((string) (is_array($v) ? $v[0] : $v), 'event-stream') !== false) $live = true;
        foreach ((array) $v as $i => $one) header("$k: $one", $i === 0);
    }
    no_buffering();
    $seq = 0; $started = microtime(true); $lastData = 0.0; $sent = false;
    $burst = $live && !empty((get_json(tdir($id) . '/table.json') ?? [])['burst']);
    while (true) {
        $f = sprintf('%s/c%08d', $d, $seq);
        if (is_file($f)) {
            $size = filesize($f);
            if ($size) { readfile($f); flush(); $sent = true; $lastData = microtime(true); }
            @unlink($f);
            if (connection_aborted()) $leave();
            put("$d/consumed", (string) $seq); $seq++;
            continue;
        }
        if (is_file("$d/end") && !is_file($f)) { clearstatcache(); if (!is_file($f)) break; continue; }
        if (connection_aborted()) $leave();
        if ($live) {
            $now = microtime(true);
            // Hosts that hold a response back until it ends: end it right after each burst of events; the browser reconnects at once.
            if (($burst && $sent && $now - $lastData > 0.2) || $now - $started > (int) $CFG['stream_seconds']) {
                @touch("$d/gone"); usleep(30000); clearstatcache();              // refuse new chunks, then deliver any that slipped in
                while (is_file($f = sprintf('%s/c%08d', $d, $seq))) { if (filesize($f)) { readfile($f); flush(); } @unlink($f); put("$d/consumed", (string) $seq); $seq++; clearstatcache(); }
                exit;
            }
            if (!$burst && $now - $lastData > 15) { echo ": ping\n\n"; flush(); $lastData = $now; if (connection_aborted()) $leave(); }
        }
        usleep($live ? 40000 : 15000); clearstatcache();
    }
    @touch("$d/gone");
    exit;
}
if ($path === '/' || $path === '') page(200, 'IPRPS Link relay', '<p>This address connects remote players to a Session Master\'s IPRPS Table. Players: use the link your Session Master sent you.</p>');
http_response_code(404); header('Content-Type: text/plain'); echo 'Not found';
