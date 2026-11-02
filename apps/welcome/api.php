<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Welcome - the tour's progress and each Session Master's API key vault.
//
// The vault keeps API keys for the online AI apps (Genesis, the Writing Assistant...) in one place,
// per Universal Login account, encrypted (AES-256-GCM) with a key that stays on this computer
// (/var/lib/iprps-vault/vault.key, readable by the web server only). Keys never leave the computer.
//
// GET  ?action=vault                       this account's stored keys (provider, label, last characters)
// POST ?action=vault_save   {provider, label?, secret}
// POST ?action=vault_delete {provider}
// GET  ?action=secret&provider=NAME        one key in full, for this account (apps fetch it with the sign-in token)
// POST ?action=tour         {step?, done?}  remember where the tour is

require __DIR__ . '/../iprps-lib/lib.php';
$USER = ip_user();
$UID = (int)$USER['id'];
$db = ip_db();
$in = ip_input();

const PROVIDERS = [
    'anthropic' => 'Anthropic (Claude)', 'google' => 'Google (Gemini)', 'openai' => 'OpenAI', 'xai' => 'xAI (Grok)',
    'leonardo' => 'Leonardo.Ai', 'elevenlabs' => 'ElevenLabs', 'kling' => 'Kling AI',
];

function vault_key(): string {
    $dir = getenv('IPRPS_VAULT_DIR') ?: '/var/lib/iprps-vault';
    $f = "$dir/vault.key";
    if (is_file($f)) {
        $k = file_get_contents($f);
        if ($k !== false && strlen($k) === 32) return $k;
        ip_fail("The vault key ($f) is damaged. Stored keys can't be read; delete the file to start a new vault.", 500);
    }
    if (!is_dir($dir) || !is_writable($dir)) ip_fail("The key vault folder $dir is missing or not writable by the web server (guide 12.10).", 500);
    $k = random_bytes(32);
    $old = umask(0077);
    $ok = file_put_contents("$f.tmp", $k) === 32 && rename("$f.tmp", $f);
    umask($old);
    if (!$ok) ip_fail('Could not create the vault key.', 500);
    return $k;
}
function seal(string $plain, string $aad): string {
    if (!function_exists('openssl_encrypt')) ip_fail('PHP was built without OpenSSL: the vault needs it.', 500);
    $iv = random_bytes(12); $tag = '';
    $ct = openssl_encrypt($plain, 'aes-256-gcm', vault_key(), OPENSSL_RAW_DATA, $iv, $tag, $aad);
    return 'v1:' . base64_encode($iv . $tag . $ct);
}
function unseal(string $box, string $aad): string {
    $raw = base64_decode(substr($box, 3), true);
    if (!str_starts_with($box, 'v1:') || $raw === false || strlen($raw) < 29) ip_fail('That stored key is damaged.', 500);
    $p = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', vault_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), $aad);
    if ($p === false) ip_fail('That stored key can\'t be read (the vault key changed). Delete it and add it again.', 500);
    return $p;
}
function provider_id($v): string {
    $p = strtolower(trim((string)$v));
    if (isset(PROVIDERS[$p])) return $p;
    $p = trim(preg_replace('/[^a-z0-9]+/', '-', $p), '-');
    if ($p === '' || strlen($p) > 40) ip_fail('Name the service (letters and numbers).');
    return $p;
}

switch ($_GET['action'] ?? '') {
case 'vault':
    $st = $db->prepare('SELECT provider, label, hint, updated_at FROM user_secrets WHERE user_id = ? ORDER BY provider');
    $st->execute([$UID]);
    ip_out(['ok' => true, 'keys' => $st->fetchAll(), 'providers' => PROVIDERS,
            'tour' => json_decode(ip_setting($db, $UID, 'welcome', '{}'), true) ?: new stdClass()]);

case 'vault_save':
    $prov = provider_id($in['provider'] ?? '');
    $secret = trim((string)($in['secret'] ?? ''));
    if ($secret === '' || strlen($secret) > 4000 || preg_match('/\s/', $secret)) ip_fail('Paste the key exactly as the service shows it (no spaces).');
    $label = ip_txt($in['label'] ?? '', 80) ?: (PROVIDERS[$prov] ?? $prov);
    $db->prepare('REPLACE INTO user_secrets (user_id, provider, label, secret_enc, hint) VALUES (?, ?, ?, ?, ?)')
       ->execute([$UID, $prov, $label, seal($secret, "$UID|$prov"), '…' . substr($secret, -4)]);
    ip_out(['ok' => true, 'provider' => $prov]);

case 'vault_delete':
    $db->prepare('DELETE FROM user_secrets WHERE user_id = ? AND provider = ?')->execute([$UID, provider_id($in['provider'] ?? '')]);
    ip_out(['ok' => true]);

case 'secret':
    $prov = provider_id($_GET['provider'] ?? '');
    $st = $db->prepare('SELECT secret_enc FROM user_secrets WHERE user_id = ? AND provider = ?');
    $st->execute([$UID, $prov]);
    $box = $st->fetchColumn();
    if ($box === false) ip_fail('No key stored for that service. Add it in IPRPS Welcome → API keys.', 404);
    ip_out(['ok' => true, 'provider' => $prov, 'secret' => unseal($box, "$UID|$prov")]);

case 'tour':
    $t = json_decode(ip_setting($db, $UID, 'welcome', '{}'), true) ?: [];
    if (isset($in['step'])) $t['step'] = max(0, min(20, (int)$in['step']));
    if (!empty($in['done'])) $t['done'] = date('c');
    ip_set_setting($db, $UID, 'welcome', json_encode($t));
    ip_out(['ok' => true]);

default:
    ip_fail('Unknown action.', 404);
}
