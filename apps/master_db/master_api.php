<?php
/**
 * IPRPS Master Database — unified API
 * Mythical Legends Publishing, LLC © 2026
 *
 * Auth: central login (auth/). Any signed-in user may READ + EXPORT.
 * Only admins (config.php $ADMIN_EMAILS) may create / update / delete / import.
 */

require getenv('IPRPS_AUTH_CHECK') ?: __DIR__ . '/../auth/auth-check.php';
$IP_USER = ip_require_login_api();          // 401 JSON if not signed in

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');   // never serve stale list/get data

// Import field maps — declared here (before the dispatch below exits) because
// top-level `const` is defined by sequential execution, not hoisted like
// functions. The import helpers further down reference these.
// Keys that are metadata / handled separately — never stored inside attributes.
const IMPORT_META_KEYS = [
    'id','attributes','module','summary','owner_id','owner_email','source',
    'created_at','updated_at','createdAt','updatedAt','updatedAtUtc',
    'image_filename','image_data_embedded','imageData','image_data','avatar','isCustom',
    'version','exported_at','trap_count','count',
];
// Candidate keys for the display name, in priority order.
const IMPORT_NAME_KEYS    = ['name','entity_name','recipe_name','className','weaponName','trap_name','profileName','title'];
// Candidate keys for the list-view summary, in priority order.
const IMPORT_SUMMARY_KEYS = ['summary','description','trap_description','result','proc','effect','weaponType','desc'];

/** True if $a is a sequential (list) array. Works on PHP < 8.1. */
function arr_is_list(array $a): bool {
    if (function_exists('array_is_list')) return array_is_list($a);
    $i = 0;
    foreach ($a as $k => $_) { if ($k !== $i++) return false; }
    return true;
}

/**
 * Pull the array of records out of a decoded JSON payload. Handles:
 *   - a bare JSON array of records
 *   - a wrapper object with entries/traps/items/records/data (e.g. {traps:[...]})
 *   - any wrapper object whose first list-valued property holds the records
 *   - a single record object
 */
function import_extract_list($data): ?array {
    if (!is_array($data)) return null;
    if (arr_is_list($data)) return $data;
    foreach (['entries','traps','items','records','data'] as $k) {
        if (isset($data[$k]) && is_array($data[$k]) && arr_is_list($data[$k])) return $data[$k];
    }
    foreach ($data as $v) {
        if (is_array($v) && arr_is_list($v) && ($v === [] || is_array($v[0]))) return $v;
    }
    return [$data]; // treat the object itself as one record
}

$pdo    = master_db();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'list';
        switch ($action) {
            case 'whoami':      out_whoami($IP_USER); break;
            case 'modules':     out_modules($pdo); break;
            case 'list':        out_list($pdo); break;
            case 'get':         out_get($pdo, (int)($_GET['id'] ?? 0)); break;
            case 'seedList':    out_seed_list(); break;
            case 'export':      out_export($pdo); break;          // ?ids=1,2  or ?module=x  or all
            default:            fail('Unknown action');
        }
        exit;
    }

    if ($method === 'POST') {
        $action = $_POST['action'] ?? '';
        // --- everything below mutates data: admins only ---
        require_admin($IP_USER);
        switch ($action) {
            case 'create':      do_create($pdo, $IP_USER); break;
            case 'update':      do_update($pdo); break;
            case 'delete':      do_delete($pdo, (int)($_POST['id'] ?? 0)); break;
            case 'saveModule':  do_save_module($pdo); break;
            case 'import':      do_import($pdo, $IP_USER); break;
            case 'seedImport':  do_seed_import($pdo, $IP_USER); break;
            default:            fail('Unknown action');
        }
        exit;
    }

    fail('Unsupported method');
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}

// ---------------------------------------------------------------------------
function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit;
}

function out_whoami(array $u): void {
    echo json_encode([
        'success' => true,
        'user'    => ['name' => trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? '')), 'email' => $u['email'] ?? ''],
        'is_admin'=> is_admin($u),
    ]);
}

function out_seed_list(): void {
    $manifest = require __DIR__ . '/seed_data/manifest.php';
    foreach ($manifest as &$m) {
        $path = __DIR__ . '/seed_data/' . basename($m['file']);
        $m['available'] = is_file($path);
    }
    echo json_encode(['success' => true, 'datasets' => $manifest]);
}

function out_modules(PDO $pdo): void {
    $rows = $pdo->query("SELECT module_key, label, icon, name_label, fields, sort_order FROM modules ORDER BY sort_order, label")->fetchAll();
    // attach live counts
    $counts = [];
    foreach ($pdo->query("SELECT module, COUNT(*) c FROM catalog GROUP BY module") as $r) {
        $counts[$r['module']] = (int)$r['c'];
    }
    foreach ($rows as &$m) {
        $m['fields'] = json_decode($m['fields'], true) ?: [];
        $m['count']  = $counts[$m['module_key']] ?? 0;
    }
    echo json_encode(['success' => true, 'modules' => $rows]);
}

function out_list(PDO $pdo): void {
    $module = $_GET['module'] ?? '';
    $search = trim($_GET['search'] ?? '');
    $where  = [];
    $params = [];
    if ($module !== '') { $where[] = 'module = ?'; $params[] = $module; }
    if ($search !== '') {
        $where[] = '(name LIKE ? OR summary LIKE ?)';
        $params[] = "%$search%"; $params[] = "%$search%";
    }
    $sql = "SELECT id, module, name, summary, image_filename, updated_at,
                   JSON_UNQUOTE(JSON_EXTRACT(attributes, '\$.category')) AS category
            FROM catalog";
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY name ASC LIMIT 2000';
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) {
        $r['image_url'] = $r['image_filename'] ? IMAGE_URL . $r['image_filename'] : null;
    }
    echo json_encode(['success' => true, 'entries' => $rows]);
}

function out_get(PDO $pdo, int $id): void {
    $st = $pdo->prepare("SELECT * FROM catalog WHERE id = ?");
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) fail('Entry not found', 404);
    $row['attributes'] = master_decode_attrs($row);
    $row['image_url']  = $row['image_filename'] ? IMAGE_URL . $row['image_filename'] : null;
    echo json_encode(['success' => true, 'entry' => $row]);
}

/** Export selected / module / all as JSON with embedded base64 images. */
function out_export(PDO $pdo): void {
    $ids    = trim($_GET['ids'] ?? '');
    $module = $_GET['module'] ?? '';
    if ($ids !== '') {
        $list  = array_filter(array_map('intval', explode(',', $ids)));
        if (!$list) fail('No valid ids');
        $ph    = implode(',', array_fill(0, count($list), '?'));
        $st    = $pdo->prepare("SELECT * FROM catalog WHERE id IN ($ph) ORDER BY module, name");
        $st->execute($list);
    } elseif ($module !== '') {
        $st = $pdo->prepare("SELECT * FROM catalog WHERE module = ? ORDER BY name");
        $st->execute([$module]);
    } else {
        $st = $pdo->query("SELECT * FROM catalog ORDER BY module, name");
    }
    $rows = $st->fetchAll();
    foreach ($rows as &$r) {
        $r['attributes']          = master_decode_attrs($r);
        $r['image_data_embedded'] = master_embed_image($r['image_filename']);
    }
    // inline=1 → return JSON to the app (used to build the printable report);
    // otherwise force a .iprps file download.
    if (($_GET['inline'] ?? '') !== '1') {
        header('Content-Disposition: attachment; filename="iprps_master_export_' . date('Y-m-d') . '.iprps"');
    }
    echo json_encode(['exported_at' => date('c'), 'count' => count($rows), 'entries' => $rows], JSON_PRETTY_PRINT);
}

// -------------------------- admin writes -----------------------------------
function do_create(PDO $pdo, array $u): void {
    $module = trim($_POST['module'] ?? '');
    $name   = trim($_POST['name'] ?? '');
    if ($module === '' || $name === '') fail('module and name are required');
    $attrs  = json_decode($_POST['attributes'] ?? '{}', true);
    if (!is_array($attrs)) $attrs = [];
    $img    = master_save_image($_POST['image_data'] ?? null);
    $imageError = !empty($_POST['image_data']) && $img === null;

    $st = $pdo->prepare(
        "INSERT INTO catalog (module, name, summary, attributes, image_filename, owner_id, owner_email, source)
         VALUES (?,?,?,?,?,?,?, 'manual')");
    $st->execute([
        $module, $name, trim($_POST['summary'] ?? ''),
        json_encode($attrs, JSON_UNESCAPED_UNICODE), $img,
        $u['id'] ?? null, $u['email'] ?? null,
    ]);
    if ($imageError) fail('Entry saved, but the image could not be stored (too large or unreadable). Try a smaller image.', 422);
    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId(), 'message' => 'Entry created']);
}

function do_update(PDO $pdo): void {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) fail('id required');
    $st = $pdo->prepare("SELECT image_filename FROM catalog WHERE id = ?");
    $st->execute([$id]);
    $cur = $st->fetch();
    if (!$cur) fail('Entry not found', 404);

    $img = $cur['image_filename'];
    $imageError = false;
    if (!empty($_POST['image_data'])) {
        $new = master_save_image($_POST['image_data']);
        if ($new) { master_delete_image($img); $img = $new; }
        else { $imageError = true; }   // image sent but rejected (too large/invalid)
    } elseif (($_POST['remove_image'] ?? '') === '1') {
        master_delete_image($img); $img = null;
    }
    $attrs = json_decode($_POST['attributes'] ?? '{}', true);
    if (!is_array($attrs)) $attrs = [];

    $st = $pdo->prepare(
        "UPDATE catalog SET name=?, summary=?, attributes=?, image_filename=? WHERE id=?");
    $st->execute([
        trim($_POST['name'] ?? ''), trim($_POST['summary'] ?? ''),
        json_encode($attrs, JSON_UNESCAPED_UNICODE), $img, $id,
    ]);
    if ($imageError) fail('Entry saved, but the image could not be stored (too large or unreadable). Try a smaller image.', 422);
    echo json_encode(['success' => true, 'message' => 'Entry updated']);
}

function do_delete(PDO $pdo, int $id): void {
    if (!$id) fail('id required');
    $st = $pdo->prepare("SELECT image_filename FROM catalog WHERE id = ?");
    $st->execute([$id]);
    $row = $st->fetch();
    if ($row) master_delete_image($row['image_filename']);
    $pdo->prepare("DELETE FROM catalog WHERE id = ?")->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Entry deleted']);
}

/** Create or update a module definition (field template). */
function do_save_module(PDO $pdo): void {
    $key = trim($_POST['module_key'] ?? '');
    if ($key === '') fail('module_key required');
    $fields = json_decode($_POST['fields'] ?? '[]', true);
    if (!is_array($fields)) $fields = [];
    $st = $pdo->prepare(
        "INSERT INTO modules (module_key, label, icon, name_label, fields, sort_order)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE label=VALUES(label), icon=VALUES(icon),
             name_label=VALUES(name_label), fields=VALUES(fields), sort_order=VALUES(sort_order)");
    $st->execute([
        $key, trim($_POST['label'] ?? $key), trim($_POST['icon'] ?? '📦'),
        trim($_POST['name_label'] ?? 'Name'),
        json_encode($fields, JSON_UNESCAPED_UNICODE), (int)($_POST['sort_order'] ?? 0),
    ]);
    echo json_encode(['success' => true, 'message' => 'Module saved']);
}

/** Normalise one raw record into a catalog row. Returns null if unusable. */
function import_map_entry(array $e, string $moduleOverride): ?array {
    $name = '';
    foreach (IMPORT_NAME_KEYS as $k) { if (!empty($e[$k]) && is_string($e[$k])) { $name = trim($e[$k]); break; } }
    if ($name === '') return null;

    $module = $moduleOverride !== '' ? $moduleOverride : (is_string($e['module'] ?? null) ? $e['module'] : 'manual');

    // attributes = every field that isn't metadata or the chosen name field
    $nameKeyUsed = null;
    foreach (IMPORT_NAME_KEYS as $k) { if (isset($e[$k]) && trim((string)$e[$k]) === $name) { $nameKeyUsed = $k; break; } }
    $attrs = $e['attributes'] ?? $e;
    if (!is_array($attrs)) $attrs = [];
    foreach (IMPORT_META_KEYS as $k) unset($attrs[$k]);
    if ($nameKeyUsed) unset($attrs[$nameKeyUsed]);

    // summary
    $summary = '';
    foreach (IMPORT_SUMMARY_KEYS as $k) { if (!empty($e[$k]) && is_string($e[$k])) { $summary = $e[$k]; break; } }

    // image from any embedded base64 data-URL variant
    $img = null;
    foreach (['image_data_embedded','imageData','image_data'] as $k) {
        if (!empty($e[$k]) && is_string($e[$k]) && strpos($e[$k], 'data:image') === 0) {
            $img = master_save_image($e[$k]);
            if ($img) break;
        }
    }
    return [$module, $name, mb_substr($summary, 0, 500), $attrs, $img];
}

/** Insert mapped records, skipping (module,name) duplicates. Returns [inserted,skipped]. */
function import_insert(PDO $pdo, array $entries, string $moduleOverride, array $u): array {
    $ins = 0; $skip = 0;
    $dupe = $pdo->prepare("SELECT 1 FROM catalog WHERE module=? AND name=? LIMIT 1");
    $put  = $pdo->prepare(
        "INSERT INTO catalog (module, name, summary, attributes, image_filename, owner_id, owner_email, source)
         VALUES (?,?,?,?,?,?,?, 'import')");
    foreach ($entries as $e) {
        if (!is_array($e)) { continue; }
        $m = import_map_entry($e, $moduleOverride);
        if (!$m) { continue; }
        [$module, $name, $summary, $attrs, $img] = $m;
        $dupe->execute([$module, $name]);
        if ($dupe->fetch()) { $skip++; continue; }
        $put->execute([$module, $name, $summary, json_encode($attrs, JSON_UNESCAPED_UNICODE),
                       $img, $u['id'] ?? null, $u['email'] ?? null]);
        $ins++;
    }
    return [$ins, $skip];
}

/** Import an uploaded .iprps/.json file. Optional ?module override. */
function do_import(PDO $pdo, array $u): void {
    if (!isset($_FILES['file'])) fail('No file uploaded');
    $data = json_decode(file_get_contents($_FILES['file']['tmp_name']), true);
    if ($data === null) fail('File is not valid JSON');
    $entries = import_extract_list($data);
    if (!is_array($entries)) fail('Unrecognised format — expected a JSON array of records');
    [$ins, $skip] = import_insert($pdo, $entries, trim($_POST['module'] ?? ''), $u);
    echo json_encode(['success' => true, 'message' => "Imported $ins new" . ($skip ? ", skipped $skip duplicate(s)" : '')]);
}

/** One-click import of a bundled starter dataset listed in seed_data/manifest.php. */
function do_seed_import(PDO $pdo, array $u): void {
    $manifest = require __DIR__ . '/seed_data/manifest.php';
    $only = trim($_POST['file'] ?? '');   // empty = import all bundled files
    $results = [];
    foreach ($manifest as $item) {
        if ($only !== '' && $item['file'] !== $only) continue;
        $path = __DIR__ . '/seed_data/' . basename($item['file']);
        if (!is_file($path)) { $results[] = ['file'=>$item['file'],'error'=>'not found']; continue; }
        $data = json_decode(file_get_contents($path), true);
        $list = import_extract_list($data);
        if (!is_array($list)) { $results[] = ['file'=>$item['file'],'error'=>'invalid JSON']; continue; }
        [$ins, $skip] = import_insert($pdo, $list, $item['module'], $u);
        $results[] = ['file'=>$item['file'],'module'=>$item['module'],'imported'=>$ins,'skipped'=>$skip];
    }
    if (!$results) fail('No matching bundled dataset');
    $total = array_sum(array_column($results, 'imported'));
    echo json_encode(['success' => true, 'message' => "Imported $total new record(s)", 'results' => $results]);
}
