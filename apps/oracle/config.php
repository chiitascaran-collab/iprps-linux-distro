<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Oracle - settings. Change these here, not in api.php.

// The model the Oracle talks to. IPRPS ships "iprps-storyteller" (built from a small
// open model plus the IPRPS Modelfile). Replace it with a custom-trained IPRPS model
// using:  sudo iprps-ai-model install <file.gguf>   (the name stays the same).
const ORACLE_MODEL = 'iprps-storyteller';

// Ollama listens on this machine only.
const OLLAMA_URL = 'http://127.0.0.1:11434';

// Context window and how much campaign memory and chat history go into each request.
const ORACLE_NUM_CTX     = 8192;
const ORACLE_MEMORY_MAX  = 9000;   // characters of campaign memory
const ORACLE_HISTORY_MAX = 6000;   // characters of recent chat
const ORACLE_HISTORY_MSG = 12;     // at most this many recent messages

// Database settings come from the file iprps-db-init writes on first boot.
// ORACLE_DB_CONFIG may point elsewhere for testing.
function oracle_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $file = getenv('ORACLE_DB_CONFIG') ?: '/etc/iprps/db.php';
    $c = require $file;
    $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4";
    if (!empty($c['socket'])) $dsn = "mysql:unix_socket={$c['socket']};dbname={$c['name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    oracle_schema($pdo);
    return $pdo;
}

// The Oracle's own tables, created on first use in the IPRPS core database.
// display_items is shared with the Session Master Hub's player display.
function oracle_schema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS oracle_messages (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        campaign_id INT UNSIGNED NULL,
        role        ENUM('user','assistant') NOT NULL,
        content     MEDIUMTEXT NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_campaign (user_id, campaign_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS oracle_memory (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        campaign_id INT UNSIGNED NULL,
        text        TEXT NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_campaign (user_id, campaign_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS display_items (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT UNSIGNED NULL,
        kind        ENUM('text','image','clear') NOT NULL DEFAULT 'text',
        title       VARCHAR(160),
        body        MEDIUMTEXT,
        shown_by    INT NULL,
        shown_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
