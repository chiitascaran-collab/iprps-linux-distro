<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Link relay (PHP) - the public address remote players open, for ordinary web hosting.
//
//  Upload this folder (index.php, .htaccess, config.php) to your site, e.g. https://play.example.com/
//  Players:  https://play.example.com/<name>/  (or /t/<table>/)     The Session Master's computer dials in on /_link/.
//  Needs PHP 7.4+ and a writable "data" folder. No database. It stores nothing about the game: requests
//  wait in the data folder for a moment until the Session Master's computer collects and answers them.
//
//  Who may connect a table ("access" in config.php):
//    owners    only the accounts in 'owners' (or, with no list, the first account that connects)
//    open      any Infinite Plane account; each Session Master is added the first time IPRPS Link connects
//    approval  like open, but new Session Masters wait until an admin approves them
//  The relay dashboard (relay/admin, on the main site) shows and manages the Session Masters through /_admin/.
//  The Node.js relay (relay/node) speaks the same Link protocol; the service features (open sign-up, plans,
//  dashboard) are in this PHP relay.

declare(strict_types=1);
const LINK_VERSION = '1.1.0';
$CFG = [
    'public_url' => '',                                   // '' = work it out from the request
    'auth_url' => 'https://infiniteplane.space/auth/',    // where Infinite Plane accounts are checked
    'auth_check' => '',                                   // path to auth-check.php when this site has the shared /auth/ folder ('' = look for it)
    'access' => 'owners',                                 // owners | open | approval (see above)
    'owners' => [],                                       // access 'owners': usernames or emails allowed to connect; [] = the first account that connects
    'admins' => [],                                       // usernames or emails that may use the relay dashboard
    'dashboard_origins' => ['https://infiniteplane.space'], // where the relay dashboard page is served from
    'contact' => '',                                      // shown to Session Masters who are refused, e.g. 'support@example.com'
    'friendly_links' => true,                             // players' link https://play.example.com/<name>/ instead of /t/<table>/
    'max_online_tables' => 0,                             // tables connected at the same time; 0 = no limit (shared hosting: about 8)
    'default_plan' => 'free',
    'plans' => [                                          // 0 = no limit
        'free'    => ['label' => 'Free',          'hours_per_month' => 0, 'gb_per_month' => 0, 'max_upload_mb' => 20],
        'monthly' => ['label' => 'Monthly',       'hours_per_month' => 0, 'gb_per_month' => 0, 'max_upload_mb' => 20],
        'payg'    => ['label' => 'Pay as you go', 'hours_per_month' => 0, 'gb_per_month' => 0, 'max_upload_mb' => 20],
    ],
    'data_dir' => __DIR__ . '/data',
    'max_upload_mb' => 20,
    'stream_seconds' => 50,                               // how long one live-events response may stay open
    'trust_proxy' => false,
    'base_path' => null,                                  // null = work it out; '' or '/play' to say where this folder is on the site
];
if (is_file(__DIR__ . '/config.php')) $CFG = array_merge($CFG, (array) require __DIR__ . '/config.php');
$DATA = rtrim($CFG['data_dir'], '/');
// Settings the dashboard can change (data/settings.json) override config.php. Admins and the secret never come from there.
const SETTABLE = ['access', 'contact', 'friendly_links', 'max_online_tables', 'default_plan', 'plans'];
$SET = is_file("$DATA/settings.json") ? (array) json_decode((string) file_get_contents("$DATA/settings.json"), true) : [];
foreach (SETTABLE as $k) if (array_key_exists($k, $SET)) $CFG[$k] = $SET[$k];
if (!in_array($CFG['access'], ['owners', 'open', 'approval'], true)) $CFG['access'] = 'owners';
@ini_set('zlib.output_compression', '0');
@ini_set('display_errors', '0');
if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
header('X-Robots-Tag: noindex, nofollow');

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
    echo "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\">$meta<title>$title</title>"
       . "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0e1a;color:#e6e3d6;font:16px/1.5 system-ui,sans-serif}main{max-width:520px;padding:24px;text-align:center}h1{font:600 26px Georgia,serif;color:#f1d58c}p{color:#b9b6a8}</style>"
       . "</head><body><main><h1>✦ $title</h1>$body</main></body></html>"; exit;
}
// glob() and file() can return false; with strict types that must not reach the code that walks the list
function gl(string $pattern, int $flags = 0): array { $r = @glob($pattern, $flags); return is_array($r) ? $r : []; }
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function put(string $file, string $data): void { $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp'; file_put_contents($tmp, $data); rename($tmp, $file); }
function get_json(string $file): ?array { $s = @file_get_contents($file); if ($s === false) return null; $j = json_decode($s, true); return is_array($j) ? $j : null; }
function rmtree(string $dir): void { foreach ((array) @scandir($dir) as $f) { if ($f === '.' || $f === '..' || $f === false) continue; $p = "$dir/$f"; is_dir($p) ? rmtree($p) : @unlink($p); } @rmdir($dir); }
// The proxy in front adds the visitor's address at the END of X-Forwarded-For; earlier entries can say anything.
function client_ip(): string { global $CFG; if ($CFG['trust_proxy'] && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) { $a = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']); return trim((string) end($a)); } return $_SERVER['REMOTE_ADDR'] ?? ''; }
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
function lower_names(array $user): array { return array_values(array_filter([strtolower((string) ($user['username'] ?? '')), strtolower((string) ($user['email'] ?? ''))])); }
function in_list(array $user, $list): bool { return (bool) array_intersect(lower_names($user), array_map('strtolower', (array) $list)); }
function contact_line(): string { global $CFG; return $CFG['contact'] ? ' Contact ' . $CFG['contact'] . '.' : ''; }

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
foreach (['sm', 'names', 'invites', 'usage', 'log'] as $d) if (!is_dir("$DATA/$d")) @mkdir("$DATA/$d", 0700, true);
if (!is_file("$DATA/secret")) { put("$DATA/secret", bin2hex(random_bytes(32))); @chmod("$DATA/secret", 0600); }
$SECRET = trim((string) file_get_contents("$DATA/secret"));
function tdir(string $id): string { global $DATA; return "$DATA/t/$id"; }
function table_id($uid): string { global $SECRET; return substr(hash_hmac('sha256', 'table:' . $uid, $SECRET), 0, 12); }
function table_online(string $id): bool { clearstatcache(true, tdir($id) . '/seen'); $m = @filemtime(tdir($id) . '/seen'); return $m && time() - $m < 45; }
function online_tables(): array { global $DATA; $o = []; foreach (gl("$DATA/t/*", GLOB_ONLYDIR) as $d) { $id = basename($d); if (table_online($id)) $o[] = $id; } return $o; }
function sweep(string $id): void {
    $now = time();
    foreach (gl(tdir($id) . '/r/*', GLOB_ONLYDIR) as $d) {
        $age = $now - (int) @filemtime($d);
        if ($age > 900 || ($age > 90 && (is_file("$d/gone") || is_file("$d/end")))) rmtree($d);
    }
    foreach (gl(tdir($id) . '/q/*.json') as $f) if ($now - (int) @filemtime($f) > 60) @unlink($f);
}
// Tell a connected table to let go: IPRPS Link's next poll is refused and it reconnects (and is refused if no longer allowed).
function disconnect_table(string $id): void { $f = tdir($id) . '/table.json'; $T = get_json($f); if ($T) { $T['keyHash'] = ''; put($f, json_encode($T)); } @unlink(tdir($id) . '/seen'); foreach (gl(tdir($id) . '/r/*', GLOB_ONLYDIR) as $x) @touch("$x/gone"); }

// ---------------------------------------------------------------- Session Masters, usage and the activity log
function safe_id($uid): string { return preg_replace('/[^A-Za-z0-9_-]/', '', (string) $uid); }
function sm_file($uid): string { global $DATA; return "$DATA/sm/" . safe_id($uid) . '.json'; }
function sm_get($uid): ?array { return get_json(sm_file($uid)); }
function sm_put(array $r): void { put(sm_file($r['id']), json_encode($r)); }
function month(): string { return gmdate('Y-m'); }
function usage_get($uid, ?string $m = null): array { global $DATA; return (get_json("$DATA/usage/" . safe_id($uid) . '-' . ($m ?? month()) . '.json') ?? []) + ['sec' => 0, 'in' => 0, 'out' => 0, 'sessions' => 0]; }
function usage_add($uid, array $add): void {
    global $DATA; if ((string) $uid === '') return;
    $f = "$DATA/usage/" . safe_id($uid) . '-' . month() . '.json';
    $h = @fopen($f, 'c+'); if (!$h) return;
    if (flock($h, LOCK_EX)) {
        $u = json_decode((string) stream_get_contents($h), true); if (!is_array($u)) $u = [];
        foreach ($add as $k => $v) $u[$k] = (int) ($u[$k] ?? 0) + (int) $v;
        ftruncate($h, 0); rewind($h); fwrite($h, json_encode($u)); fflush($h); flock($h, LOCK_UN);
    }
    fclose($h);
}
function log_event(string $type, array $data = []): void {
    global $DATA;
    @file_put_contents("$DATA/log/" . month() . '.jsonl', json_encode(['t' => gmdate('c'), 'type' => $type] + $data) . "\n", FILE_APPEND | LOCK_EX);
}
function plan_of(array $r): array {
    global $CFG; $plans = (array) $CFG['plans']; $p = $plans[$r['plan'] ?? ''] ?? $plans[$CFG['default_plan']] ?? reset($plans) ?: [];
    $lim = (array) ($r['limits'] ?? []);
    foreach (['hours_per_month', 'gb_per_month', 'max_upload_mb'] as $k) if (isset($lim[$k]) && $lim[$k] !== '' && $lim[$k] !== null) $p[$k] = $lim[$k];
    $p += ['hours_per_month' => 0, 'gb_per_month' => 0, 'max_upload_mb' => $CFG['max_upload_mb']];
    return $p;
}
const RESERVED = ['t', '_link', '_admin', 'admin', 'data', 'index-php', 'api', 'assets', 'auth', 'media', 'sheet', 'play', 'join', 'www',
    'help', 'about', 'static', 'health', 'login', 'signin', 'logout', 'dashboard', 'status', 'support', 'iprps', 'infiniteplane', 'relay'];
function valid_name(string $s): bool { return (bool) preg_match('/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/', $s) && !in_array($s, RESERVED, true); }
function name_owner(string $s): ?string { global $DATA; if (!valid_name($s)) return null; $v = @file_get_contents("$DATA/names/$s"); return $v === false ? null : trim($v); }
function claim_name(string $s, $uid): bool {
    global $DATA; if (!valid_name($s)) return false;
    $cur = name_owner($s); if ($cur !== null) return $cur === (string) $uid;
    $h = @fopen("$DATA/names/$s", 'x'); if (!$h) return name_owner($s) === (string) $uid;
    fwrite($h, (string) $uid); fclose($h); return true;
}
function release_name(string $s, $uid): void { global $DATA; if ($s !== '' && name_owner($s) === (string) $uid) @unlink("$DATA/names/$s"); }
function auto_name(array $user): string {
    $b = trim(preg_replace('/-+/', '-', preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($user['username'] ?? '')))), '-');
    $b = substr($b, 0, 28); if (strlen($b) < 3 || !valid_name($b)) $b = 'sm-' . substr(hash('sha256', 'n' . $user['id']), 0, 6);
    for ($i = 1; $i < 200; $i++) { $s = $i === 1 ? $b : rtrim(substr($b, 0, 26), '-') . "-$i"; if (claim_name($s, $user['id'])) return $s; }
    return '';
}
// A Session Master's record: made the first time their IPRPS Link connects (or found again), kept up to date
function register(array $user): array {
    global $CFG, $DATA;
    $r = sm_get($user['id']); $new = !$r;
    if ($new) {
        $r = ['id' => (string) $user['id'], 'created' => gmdate('c'), 'status' => $CFG['access'] === 'approval' ? 'pending' : 'active',
              'plan' => $CFG['default_plan'], 'note' => '', 'limits' => (object) [], 'name' => ''];
        foreach (lower_names($user) as $n) {                    // pre-approved by an admin?
            $inv = get_json("$DATA/invites/" . hash('sha256', $n) . '.json');
            if ($inv) { foreach (['status', 'plan', 'note'] as $k) if (!empty($inv[$k])) $r[$k] = $inv[$k]; if (!empty($inv['name'])) $r['want'] = $inv['name']; @unlink("$DATA/invites/" . hash('sha256', $n) . '.json'); $r['invited'] = true; break; }
        }
    }
    $r['username'] = (string) ($user['username'] ?? ''); $r['email'] = (string) ($user['email'] ?? '');
    $r['display'] = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
    if ($CFG['friendly_links'] && empty($r['name'])) { $want = (string) ($r['want'] ?? ''); $r['name'] = ($want !== '' && claim_name($want, $user['id'])) ? $want : auto_name($user); unset($r['want']); }
    sm_put($r);
    if ($new) log_event('register', ['id' => $r['id'], 'user' => $r['username'], 'status' => $r['status'], 'plan' => $r['plan']]);
    return $r;
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
// access 'owners': the list, or the first account that connects
function owner_allowed(array $user): bool {
    global $CFG, $DATA;
    if ($CFG['owners']) return in_list($user, $CFG['owners']);
    $o = get_json("$DATA/owner.json");
    if (!$o) { put("$DATA/owner.json", json_encode(['id' => $user['id'], 'username' => $user['username'] ?? '', 'claimed' => gmdate('c')])); return true; }
    return (string) $o['id'] === (string) $user['id'];
}

// ================================================================ the relay dashboard's side (/_admin/)
if (strpos($path, '/_admin/') === 0) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, (array) $CFG['dashboard_origins'], true)) {
        header("Access-Control-Allow-Origin: $origin"); header('Vary: Origin'); header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token'); header('Access-Control-Allow-Methods: GET, POST, OPTIONS'); header('Access-Control-Max-Age: 600');
    } elseif ($origin !== '') out_json(403, ['ok' => false, 'error' => 'This page may not manage the relay. Add its address to dashboard_origins in config.php.']);
    if ($method === 'OPTIONS') { http_response_code(204); exit; }
    if (limited('admin:' . client_ip(), 240, 60)) out_json(429, ['ok' => false, 'error' => 'Too many requests. Wait a minute.']);
    $me = who_is(trim((string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '')));
    if (!$CFG['admins']) out_json(403, ['ok' => false, 'error' => 'No relay admins are set. Add your username to admins in config.php.']);
    if (!in_list($me, $CFG['admins'])) { log_event('admin-refused', ['user' => $me['username'] ?? '']); out_json(403, ['ok' => false, 'error' => 'Your account is not an admin of this relay.']); }
    $op = substr($path, 8);
    $in = $method === 'POST' ? (array) json_decode((string) file_get_contents('php://input'), true) : [];
    $by = (string) ($me['username'] ?? $me['email'] ?? $me['id']);
    $view = function (array $r, array $online): array {
        global $CFG; $id = table_id($r['id']); $u = usage_get($r['id']); $p = plan_of($r);
        return ['id' => $r['id'], 'username' => $r['username'] ?? '', 'email' => $r['email'] ?? '', 'display' => $r['display'] ?? '', 'status' => $r['status'] ?? 'active',
            'plan' => $r['plan'] ?? $CFG['default_plan'], 'note' => $r['note'] ?? '', 'limits' => (object) ($r['limits'] ?? []), 'name' => $r['name'] ?? '',
            'link' => public_url() . (($CFG['friendly_links'] && !empty($r['name'])) ? '/' . $r['name'] . '/' : "/t/$id/"),
            'created' => $r['created'] ?? '', 'last_seen' => $r['last_seen'] ?? '', 'online' => in_array($id, $online, true), 'invited' => !empty($r['invited']),
            'usage' => $u, 'usage_last' => usage_get($r['id'], gmdate('Y-m', strtotime('first day of last month'))), 'effective' => $p];
    };
    $all = function (): array { global $DATA; $o = []; foreach (gl("$DATA/sm/*.json") as $f) { $r = get_json($f); if ($r) $o[] = $r; } return $o; };
    $find = function () use ($in): array { $r = sm_get($in['id'] ?? ''); if (!$r) out_json(404, ['ok' => false, 'error' => 'No such Session Master.']); return $r; };

    if ($op === 'overview') {
        $online = online_tables(); $rows = $all(); $count = ['active' => 0, 'pending' => 0, 'suspended' => 0, 'blocked' => 0]; $tot = ['sec' => 0, 'in' => 0, 'out' => 0, 'sessions' => 0]; $activeMonth = 0;
        foreach ($rows as $r) { $s = $r['status'] ?? 'active'; $count[$s] = ($count[$s] ?? 0) + 1; $u = usage_get($r['id']); foreach ($tot as $k => $_) $tot[$k] += $u[$k]; if ($u['sessions'] > 0) $activeMonth++; }
        $settings = []; foreach (SETTABLE as $k) $settings[$k] = $CFG[$k];
        out_json(200, ['ok' => true, 'version' => LINK_VERSION, 'relay' => public_url(), 'month' => month(), 'you' => $by, 'registered' => count($rows), 'status' => $count,
            'online' => count($online), 'active_this_month' => $activeMonth, 'usage' => $tot, 'settings' => $settings, 'owners' => array_values((array) $CFG['owners']),
            'php' => PHP_VERSION, 'invites' => count(gl("$DATA/invites/*.json"))]);
    }
    if ($op === 'list') { $online = online_tables(); out_json(200, ['ok' => true, 'month' => month(), 'masters' => array_map(fn($r) => $view($r, $online), $all())]); }
    if ($op === 'update' && $method === 'POST') {
        $r = $find(); $changes = [];
        if (isset($in['status'])) { if (!in_array($in['status'], ['active', 'pending', 'suspended', 'blocked'], true)) out_json(400, ['ok' => false, 'error' => 'Unknown status.']); if ($in['status'] !== ($r['status'] ?? '')) { $changes['status'] = $in['status']; $r['status'] = $in['status']; } }
        if (isset($in['plan'])) { if (!isset($CFG['plans'][$in['plan']])) out_json(400, ['ok' => false, 'error' => 'Unknown plan.']); if ($in['plan'] !== ($r['plan'] ?? '')) { $changes['plan'] = $in['plan']; $r['plan'] = $in['plan']; } }
        if (isset($in['note'])) { $r['note'] = substr(trim((string) $in['note']), 0, 1000); $changes['note'] = true; }
        if (isset($in['limits'])) {
            $lim = [];
            foreach (['hours_per_month', 'gb_per_month', 'max_upload_mb'] as $k) { $v = $in['limits'][$k] ?? ''; if ($v !== '' && $v !== null) { if (!is_numeric($v) || $v < 0) out_json(400, ['ok' => false, 'error' => 'Limits are numbers, 0 or more.']); $lim[$k] = $v + 0; } }
            $r['limits'] = (object) $lim; $changes['limits'] = $lim;
        }
        if (isset($in['name']) && $in['name'] !== ($r['name'] ?? '')) {
            $n = strtolower(trim((string) $in['name']));
            if (!valid_name($n)) out_json(400, ['ok' => false, 'error' => 'Addresses use 3–32 lowercase letters, digits and dashes, and some words are kept for the relay.']);
            if (!claim_name($n, $r['id'])) out_json(409, ['ok' => false, 'error' => 'Another Session Master already has that address.']);
            release_name((string) ($r['name'] ?? ''), $r['id']); $changes['name'] = $n; $r['name'] = $n;
        }
        sm_put($r);
        if (isset($changes['status']) && $changes['status'] !== 'active') disconnect_table(table_id($r['id']));
        log_event('admin-update', ['by' => $by, 'id' => $r['id'], 'user' => $r['username'] ?? ''] + $changes);
        out_json(200, ['ok' => true, 'master' => $view($r, online_tables())]);
    }
    if ($op === 'disconnect' && $method === 'POST') { $r = $find(); disconnect_table(table_id($r['id'])); log_event('admin-disconnect', ['by' => $by, 'id' => $r['id'], 'user' => $r['username'] ?? '']); out_json(200, ['ok' => true]); }
    if ($op === 'delete' && $method === 'POST') {
        $r = $find(); $id = table_id($r['id']);
        disconnect_table($id); rmtree(tdir($id)); release_name((string) ($r['name'] ?? ''), $r['id']); @unlink(sm_file($r['id']));
        foreach (gl("$DATA/usage/" . safe_id($r['id']) . '-*.json') as $f) @unlink($f);
        log_event('admin-delete', ['by' => $by, 'id' => $r['id'], 'user' => $r['username'] ?? '']); out_json(200, ['ok' => true]);
    }
    if ($op === 'invites') {
        $o = []; foreach (gl("$DATA/invites/*.json") as $f) { $i = get_json($f); if ($i) $o[] = $i + ['key' => basename($f, '.json')]; }
        out_json(200, ['ok' => true, 'invites' => $o]);
    }
    if ($op === 'invite' && $method === 'POST') {
        $who = strtolower(trim((string) ($in['who'] ?? '')));
        if ($who === '' || strlen($who) > 190) out_json(400, ['ok' => false, 'error' => 'Type the Session Master\'s Infinite Plane username or email.']);
        foreach ($all() as $r) if (in_array($who, [strtolower($r['username'] ?? ''), strtolower($r['email'] ?? '')], true)) out_json(409, ['ok' => false, 'error' => 'That Session Master is already on the list. Change them there.']);
        $status = in_array($in['status'] ?? 'active', ['active', 'suspended', 'blocked'], true) ? $in['status'] ?? 'active' : 'active';
        $plan = isset($CFG['plans'][$in['plan'] ?? '']) ? $in['plan'] : $CFG['default_plan'];
        $name = strtolower(trim((string) ($in['name'] ?? ''))); if ($name !== '' && (!valid_name($name) || name_owner($name) !== null)) out_json(400, ['ok' => false, 'error' => 'That address isn\'t available.']);
        put("$DATA/invites/" . hash('sha256', $who) . '.json', json_encode(['who' => $who, 'status' => $status, 'plan' => $plan, 'note' => substr((string) ($in['note'] ?? ''), 0, 1000), 'name' => $name, 'by' => $by, 'created' => gmdate('c')]));
        log_event('admin-invite', ['by' => $by, 'who' => $who, 'status' => $status, 'plan' => $plan]); out_json(200, ['ok' => true]);
    }
    if ($op === 'uninvite' && $method === 'POST') { $k = preg_replace('/[^a-f0-9]/', '', (string) ($in['key'] ?? '')); @unlink("$DATA/invites/$k.json"); log_event('admin-uninvite', ['by' => $by]); out_json(200, ['ok' => true]); }
    if ($op === 'settings' && $method === 'POST') {
        $s = $SET; $v = (array) ($in['settings'] ?? []);
        if (isset($v['access'])) { if (!in_array($v['access'], ['owners', 'open', 'approval'], true)) out_json(400, ['ok' => false, 'error' => 'Unknown access setting.']); $s['access'] = $v['access']; }
        if (isset($v['contact'])) $s['contact'] = substr(trim((string) $v['contact']), 0, 200);
        if (isset($v['friendly_links'])) $s['friendly_links'] = (bool) $v['friendly_links'];
        if (isset($v['max_online_tables'])) { if (!is_numeric($v['max_online_tables']) || $v['max_online_tables'] < 0) out_json(400, ['ok' => false, 'error' => 'Tables at once is a number, 0 or more.']); $s['max_online_tables'] = (int) $v['max_online_tables']; }
        if (isset($v['plans'])) {
            $plans = [];
            foreach ((array) $v['plans'] as $key => $p) {
                if (!preg_match('/^[a-z0-9_-]{1,20}$/', (string) $key)) out_json(400, ['ok' => false, 'error' => 'Plan names use lowercase letters, digits, - and _.']);
                $plans[$key] = ['label' => substr(trim((string) ($p['label'] ?? $key)), 0, 40)];
                foreach (['hours_per_month', 'gb_per_month', 'max_upload_mb'] as $k) { $n = $p[$k] ?? 0; if (!is_numeric($n) || $n < 0) out_json(400, ['ok' => false, 'error' => 'Plan limits are numbers, 0 or more.']); $plans[$key][$k] = $n + 0; }
            }
            if (!$plans) out_json(400, ['ok' => false, 'error' => 'Keep at least one plan.']);
            $s['plans'] = $plans;
        }
        if (isset($v['default_plan'])) $s['default_plan'] = (string) $v['default_plan'];
        if (!isset(($s['plans'] ?? $CFG['plans'])[$s['default_plan'] ?? $CFG['default_plan']])) out_json(400, ['ok' => false, 'error' => 'The default plan must be one of the plans.']);
        put("$DATA/settings.json", json_encode($s));
        log_event('admin-settings', ['by' => $by, 'changed' => array_keys($v)]); out_json(200, ['ok' => true]);
    }
    if ($op === 'log') {
        $lines = [];
        foreach ([gmdate('Y-m', strtotime('first day of last month')), month()] as $m) { $l = @file("$DATA/log/$m.jsonl", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES); if (is_array($l)) $lines = array_merge($lines, $l); }
        out_json(200, ['ok' => true, 'events' => array_values(array_filter(array_reverse(array_map(fn($l) => json_decode((string) $l, true), array_slice($lines, -400)))))]);
    }
    out_json(404, ['ok' => false, 'error' => 'Not found']);
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
        // 403, not 401: IPRPS Link keeps the sign-in, shows the reason and tries again later
        if ($CFG['access'] === 'owners' && !owner_allowed($user)) out_json(403, ['ok' => false, 'error' => 'This relay belongs to another Session Master. Use your own relay\'s address.']);
        $R = register($user);
        // IPRPS Link retries a refused connection every minute or so: log each reason once an hour, not every try
        $refuse = function (string $why, string $msg) use ($R): void { if (!limited("reflog:{$R['id']}:$why", 1, 3600)) log_event('refused', ['id' => $R['id'], 'user' => $R['username'] ?? '', 'why' => $why]); out_json(403, ['ok' => false, 'error' => $msg]); };
        if ($R['status'] === 'blocked') $refuse('blocked', 'This Infinite Plane account can\'t use this relay.' . contact_line());
        if ($R['status'] === 'suspended') $refuse('suspended', 'Remote play on this relay is paused for your account.' . contact_line());
        if ($R['status'] === 'pending') $refuse('pending', 'Thanks for signing up. Your account is waiting for the relay\'s owner to approve it; IPRPS Link keeps trying and connects once you are approved.' . contact_line());
        $P = plan_of($R); $U = usage_get($R['id']);
        if ($P['hours_per_month'] > 0 && $U['sec'] >= $P['hours_per_month'] * 3600) $refuse('hours', 'You have used this month\'s ' . $P['hours_per_month'] . ' hours of remote play on your plan.' . contact_line());
        if ($P['gb_per_month'] > 0 && ($U['in'] + $U['out']) >= $P['gb_per_month'] * 1073741824) $refuse('data', 'You have used this month\'s ' . $P['gb_per_month'] . ' GB of remote play on your plan.' . contact_line());
        $id = table_id($user['id']); $key = bin2hex(random_bytes(32));
        if ((int) $CFG['max_online_tables'] > 0 && count(array_diff(online_tables(), [$id])) >= (int) $CFG['max_online_tables']) {
            log_event('full', ['id' => $R['id'], 'user' => $R['username'] ?? '']);
            out_json(503, ['ok' => false, 'error' => 'The relay is full right now. IPRPS Link tries again by itself.']);
        }
        @mkdir(tdir($id) . '/q', 0700, true); @mkdir(tdir($id) . '/r', 0700, true);
        foreach (gl(tdir($id) . '/q/*.json') as $f) @unlink($f);
        foreach (gl(tdir($id) . '/r/*', GLOB_ONLYDIR) as $d) rmtree($d);
        put(tdir($id) . '/table.json', json_encode(['id' => $id, 'user' => ['id' => $user['id'], 'username' => $user['username'] ?? ''], 'uid' => (string) $user['id'],
            'keyHash' => hash('sha256', $key), 'burst' => false, 'upload_mb' => (float) ($P['max_upload_mb'] ?: $CFG['max_upload_mb'])]));
        touch(tdir($id) . '/seen'); @unlink(tdir($id) . '/meter');
        $R['last_seen'] = gmdate('c'); sm_put($R); usage_add($R['id'], ['sessions' => 1]); log_event('connect', ['id' => $R['id'], 'user' => $R['username'] ?? '']);
        $url = ($CFG['friendly_links'] && !empty($R['name'])) ? public_url() . '/' . $R['name'] . '/' : public_url() . "/t/$id/";
        out_json(200, ['ok' => true, 'relay' => 'php', 'version' => LINK_VERSION, 'table' => $id, 'key' => $key, 'url' => $url]);
    }
    $id = preg_replace('/[^a-z0-9]/', '', (string) ($_GET['table'] ?? ''));
    $T = $id !== '' ? get_json(tdir($id) . '/table.json') : null;
    $keyOk = fn(?array $t) => $t && $t['keyHash'] !== '' && hash_equals((string) $t['keyHash'], hash('sha256', (string) ($_SERVER['HTTP_X_LINK_KEY'] ?? '')));
    if (!$keyOk($T)) out_json(401, ['ok' => false, 'error' => 'Not connected']);
    $dir = tdir($id);
    $rid = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['id'] ?? ''));

    if ($op === 'poll') {
        @set_time_limit(60); ignore_user_abort(false);
        // connected time, for the dashboard and plan limits: the time since the previous poll, if it was recent
        $now = time(); $last = (int) @file_get_contents("$dir/meter"); @file_put_contents("$dir/meter", (string) $now);
        if ($last && $now - $last > 0 && $now - $last < 90) usage_add($T['uid'] ?? ($T['user']['id'] ?? ''), ['sec' => $now - $last]);
        $until = microtime(true) + min(max((int) ($_GET['wait'] ?? 20), 1), 25); $n = 0;
        if (random_int(0, 40) === 0) sweep($id);
        while (true) {
            if ($n % 30 === 0) { touch("$dir/seen"); if ($n && !$keyOk(get_json("$dir/table.json"))) out_json(401, ['ok' => false, 'error' => 'Replaced by a newer connection']); }
            $out = [];
            $files = gl("$dir/q/*.json"); sort($files);
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
        $data = (string) file_get_contents('php://input');
        put(sprintf('%s/c%08d', $d, $seq), $data);
        if (strlen($data) > 0) usage_add($T['uid'] ?? ($T['user']['id'] ?? ''), ['out' => strlen($data)]);
        if (($_GET['end'] ?? '') === '1') touch("$d/end");
        $until = microtime(true) + 20;                                               // slow player: hold the next chunk back
        while (count(gl("$d/c0*")) > 12 && microtime(true) < $until && !is_file("$d/gone")) usleep(80000);
        clearstatcache();
        out_json(200, ['ok' => true, 'gone' => is_file("$d/gone"), 'consumed' => $consumed()]);
    }
    if ($op === 'set' && $method === 'POST') { $T['burst'] = ($_GET['burst'] ?? '') === '1'; put("$dir/table.json", json_encode($T)); out_json(200, ['ok' => true]); }
    if ($op === 'close' && $method === 'POST') { @unlink("$dir/seen"); foreach (gl("$dir/r/*", GLOB_ONLYDIR) as $x) @touch("$x/gone"); out_json(200, ['ok' => true]); }
    out_json(404, ['ok' => false, 'error' => 'Not found']);
}

// ================================================================ the players' side (/<name>/... or /t/<table>/...)
$tid = null; $tbase = '';
if (preg_match('#^/t/([a-z0-9]{6,20})(/.*)?$#', $path, $m)) { $tid = $m[1]; $rest = $m[2] ?? ''; $tbase = "$base/t/$tid"; }
elseif ($CFG['friendly_links'] && preg_match('#^/([a-z0-9][a-z0-9-]{1,30}[a-z0-9])(/.*)?$#', $path, $m) && ($owner = name_owner($m[1])) !== null) { $tid = table_id($owner); $rest = $m[2] ?? ''; $tbase = "$base/{$m[1]}"; }
if ($tid !== null) {
    $id = $tid;
    if ($rest === '') { header("Location: $tbase/$search", true, 302); exit; }
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
    $mb = (float) ($T['upload_mb'] ?? $CFG['max_upload_mb']); $max = (int) ($mb * 1048576); $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $max) out_json(413, ['ok' => false, 'error' => "That file is too big (limit {$mb} MB)."]);

    $rid = bin2hex(random_bytes(9)); $d = tdir($id) . "/r/$rid";
    if (!@mkdir($d, 0700, true)) out_json(503, ['ok' => false, 'error' => 'The table is busy. Try again in a moment.']);
    $hasBody = false;
    if ($method !== 'GET' && $method !== 'HEAD') {
        $in = fopen('php://input', 'rb'); $out = fopen("$d/body", 'wb'); $n = stream_copy_to_stream($in, $out, $max + 1); fclose($in); fclose($out);
        if ($n > $max) { rmtree($d); out_json(413, ['ok' => false, 'error' => "That file is too big (limit {$mb} MB)."]); }
        $hasBody = $n > 0; if (!$hasBody) @unlink("$d/body"); else usage_add($T['uid'] ?? ($T['user']['id'] ?? ''), ['in' => $n]);
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
if ($path === '/' || $path === '') page(200, 'IPRPS Link relay', '<p>This address connects remote players to a Session Master\'s IPRPS Table. Players: use the link your Session Master sent you.</p>'
    . ($CFG['contact'] ? '<p>Questions, or something here that shouldn\'t be? Contact ' . h((string) $CFG['contact']) . '.</p>' : ''));
http_response_code(404); header('Content-Type: text/plain'); echo 'Not found';
