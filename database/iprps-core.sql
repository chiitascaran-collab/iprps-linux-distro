-- SPDX-License-Identifier: GPL-2.0-only
-- Copyright (C) 2026 Mythical Legends Publishing, LLC
-- IPRPS core schema: campaigns, players, characters, sessions and play tracking
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS campaigns (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(160) NOT NULL,
  setting       VARCHAR(160),
  description   TEXT,
  status        ENUM('planning','active','paused','finished') NOT NULL DEFAULT 'planning',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS players (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  display_name  VARCHAR(100) NOT NULL,
  contact       VARCHAR(200),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS characters (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  player_id     INT UNSIGNED NULL,
  name          VARCHAR(120) NOT NULL,
  species       VARCHAR(80),
  role          VARCHAR(80),
  level         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  xp            INT UNSIGNED NOT NULL DEFAULT 0,
  hp_current    INT,
  hp_max        INT,
  sheet_json    JSON,
  portrait_path VARCHAR(255),
  status        ENUM('active','retired','dead','npc') NOT NULL DEFAULT 'active',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id)   REFERENCES players(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  session_no    SMALLINT UNSIGNED NOT NULL,
  title         VARCHAR(160),
  scheduled_at  DATETIME,
  played_at     DATETIME,
  recap         TEXT,
  sm_notes      TEXT,
  UNIQUE KEY (campaign_id, session_no),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance (
  session_id    INT UNSIGNED NOT NULL,
  player_id     INT UNSIGNED NOT NULL,
  character_id  INT UNSIGNED NULL,
  present       BOOLEAN NOT NULL DEFAULT TRUE,
  xp_awarded    INT NOT NULL DEFAULT 0,
  notes         TEXT,
  PRIMARY KEY (session_id, player_id),
  FOREIGN KEY (session_id)   REFERENCES sessions(id)   ON DELETE CASCADE,
  FOREIGN KEY (player_id)    REFERENCES players(id)    ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS encounters (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id    INT UNSIGNED NOT NULL,
  name          VARCHAR(160) NOT NULL,
  round_no      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS initiative (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  encounter_id  INT UNSIGNED NOT NULL,
  character_id  INT UNSIGNED NULL,
  label         VARCHAR(120) NOT NULL,
  initiative    SMALLINT NOT NULL DEFAULT 0,
  hp            INT,
  conditions    VARCHAR(255),
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS npcs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          VARCHAR(120),
  notes         TEXT,
  portrait_path VARCHAR(255),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quests (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  title         VARCHAR(160) NOT NULL,
  status        ENUM('open','active','done','failed') NOT NULL DEFAULT 'open',
  notes         TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS handouts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  title         VARCHAR(160) NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  revealed      BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS session_log (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id    INT UNSIGNED NOT NULL,
  logged_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kind          ENUM('note','roll','combat','loot','xp','event') NOT NULL DEFAULT 'note',
  text          TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
