<?php
/**
 * IPRPS Master Database — shared helpers (connection, role, images)
 * Mythical Legends Publishing, LLC © 2026
 */

require_once __DIR__ . '/config.php';

/** PDO connection to the master catalog DB. Creates the database and its tables on first use. */
function master_db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    global $IPRPS_DB;
    $c = $IPRPS_DB;
    $server = !empty($c['socket']) ? "mysql:unix_socket={$c['socket']}" : "mysql:host={$c['host']}";
    $opts = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    try {
        try {
            $pdo = new PDO("$server;dbname=" . DB_NAME . ";charset=utf8mb4", $c['user'], $c['pass'], $opts);
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? $e->getCode()) !== 1049 && stripos($e->getMessage(), 'Unknown database') === false) throw $e;   // first use
            $boot = new PDO("$server;charset=utf8mb4", $c['user'], $c['pass'], $opts);
            $boot->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            $pdo = new PDO("$server;dbname=" . DB_NAME . ";charset=utf8mb4", $c['user'], $c['pass'], $opts);
        }
        master_schema($pdo);
        return $pdo;
    } catch (Throwable $e) {
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'The IPRPS database is not reachable. Is MariaDB running?']);
        exit;
    }
}

/** Create the tables and the catalog templates (schema.sql) the first time, and again after an update changes schema.sql. */
function master_schema(PDO $pdo): void {
    $file = __DIR__ . '/schema.sql';
    $ver  = md5_file($file);
    $have = $pdo->query("SHOW TABLES LIKE 'catalog'")->fetchColumn();
    if ($have) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(40) PRIMARY KEY, v VARCHAR(100)) ENGINE=InnoDB");
        $st = $pdo->prepare("SELECT v FROM app_meta WHERE k = 'schema'");
        $st->execute();
        if ($st->fetchColumn() === $ver) return;
    }
    $sql = preg_replace('/^--.*$/m', '', (string)file_get_contents($file));
    foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
        $stmt = trim($stmt);
        if ($stmt === '' || preg_match('/^(CREATE DATABASE|USE|SELECT)\b/i', $stmt)) continue;
        $pdo->exec($stmt);   // CREATE TABLE IF NOT EXISTS, and the module templates (INSERT ... ON DUPLICATE KEY UPDATE)
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(40) PRIMARY KEY, v VARCHAR(100)) ENGINE=InnoDB");
    $pdo->prepare("REPLACE INTO app_meta (k, v) VALUES ('schema', ?)")->execute([$ver]);
}

/** True if the signed-in central-login user is an admin (full CRUD). */
function is_admin(array $ipUser): bool {
    global $ADMIN_EMAILS;
    if (!$ADMIN_EMAILS) return true;          // IPRPS OS: no admin list = every account on this computer is an admin
    $email = strtolower(trim($ipUser['email'] ?? ''));
    if ($email === '') return false;
    foreach ($ADMIN_EMAILS as $a) {
        if (strtolower(trim($a)) === $email) return true;
    }
    return false;
}

/** Enforce admin for write actions; 403 JSON otherwise. */
function require_admin(array $ipUser): void {
    if (!is_admin($ipUser)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Read-only access. Admin sign-in required to modify entries.']);
        exit;
    }
}

/** Save a base64 data-URL image to disk, return the filename (or null). */
function master_save_image(?string $dataUrl): ?string {
    if (empty($dataUrl)) return null;
    $parts = explode(',', $dataUrl);
    if (count($parts) < 2) return null;
    $bytes = base64_decode($parts[1]);
    if ($bytes === false || strlen($bytes) === 0) return null;
    if (strlen($bytes) > MAX_IMAGE_SIZE) return null;
    // sniff extension from the mime prefix
    $ext = 'jpg';
    if (preg_match('#data:image/(\w+)#', $parts[0], $m)) {
        $ext = strtolower($m[1]) === 'png' ? 'png' : (strtolower($m[1]) === 'webp' ? 'webp' : 'jpg');
    }
    $filename = uniqid('cat_', true) . '.' . $ext;
    if (file_put_contents(IMAGE_DIR . $filename, $bytes) !== false) {
        return $filename;
    }
    return null;
}

/** Delete an image file by filename. */
function master_delete_image(?string $filename): void {
    if (empty($filename)) return;
    $path = IMAGE_DIR . basename($filename);
    if (is_file($path)) @unlink($path);
}

/** Embed an image file as a base64 data-URL (for exports/reports). */
function master_embed_image(?string $filename): ?string {
    if (empty($filename)) return null;
    $path = IMAGE_DIR . basename($filename);
    if (!is_file($path)) return null;
    $mime = function_exists('mime_content_type') ? mime_content_type($path) : 'image/jpeg';
    return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path));
}

/** Decode a catalog row's JSON attributes into an array (safe). */
function master_decode_attrs($row): array {
    if (is_array($row) && isset($row['attributes']) && is_string($row['attributes'])) {
        $a = json_decode($row['attributes'], true);
        return is_array($a) ? $a : [];
    }
    return [];
}
