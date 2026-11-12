-- ============================================================================
-- IPRPS Master Database — consolidated catalog schema
-- Mythical Legends Publishing, LLC © 2026  (infiniteplane.space)
--
-- ONE table holds every module's records. Shared columns are typed; each
-- module's unique fields live in the JSON `attributes` column. A companion
-- `modules` table defines the field template + label/icon for each module so
-- the web app is fully data-driven (add a new catalog with no schema change).
--
-- Run this ONCE against the master database (see README deploy runbook).
-- ============================================================================

CREATE DATABASE IF NOT EXISTS iprps_master
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iprps_master;

-- ---------------------------------------------------------------------------
-- Module registry — defines each catalog (bestiary, tavern, weapons, ...)
-- `fields` is a JSON array of {key,label,type} describing the admin form.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modules (
    module_key   VARCHAR(50)  PRIMARY KEY,
    label        VARCHAR(120) NOT NULL,
    icon         VARCHAR(16)  DEFAULT '📦',
    name_label   VARCHAR(60)  DEFAULT 'Name',   -- what the primary name is called
    fields       JSON         NOT NULL,          -- [{key,label,type}]
    sort_order   INT          DEFAULT 0,
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- The single master catalog table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    module         VARCHAR(50)  NOT NULL,               -- FK-ish to modules.module_key
    name           VARCHAR(255) NOT NULL,               -- display name for lists/search
    summary        TEXT,                                -- short blurb for the list view
    attributes     JSON         NOT NULL,               -- all domain-specific fields
    image_filename VARCHAR(255),
    owner_id       INT,                                 -- ip_users.id of creator (nullable)
    owner_email    VARCHAR(255),
    source         VARCHAR(60)  DEFAULT 'manual',       -- 'bestiary','tavern','species','manual',...
    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_module (module),
    INDEX idx_name (name),
    INDEX idx_module_name (module, name),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Seed the module registry with the known IPRPS catalogs.
-- Field templates for the three server-backed modules mirror their live
-- schemas exactly; the browser-catalog modules get sensible starter fields
-- that the admin can extend in-app.
-- ---------------------------------------------------------------------------
INSERT INTO modules (module_key, label, icon, name_label, fields, sort_order) VALUES
('bestiary', 'Bestiary', '🐉', 'Entity name', JSON_ARRAY(
    JSON_OBJECT('key','threat_tier','label','Threat Tier','type','text'),
    JSON_OBJECT('key','habitat','label','Habitat','type','text'),
    JSON_OBJECT('key','description','label','Description','type','textarea'),
    JSON_OBJECT('key','damage_range','label','Damage Range','type','text'),
    JSON_OBJECT('key','kill_threshold','label','Kill Threshold','type','text'),
    JSON_OBJECT('key','strengths','label','Strengths','type','textarea'),
    JSON_OBJECT('key','weaknesses','label','Weaknesses','type','textarea'),
    JSON_OBJECT('key','dangers','label','Dangers','type','textarea'),
    JSON_OBJECT('key','solutions','label','Solutions','type','textarea'),
    JSON_OBJECT('key','known_for','label','Known For','type','textarea'),
    JSON_OBJECT('key','applications','label','Applications','type','textarea')
), 10),
('tavern', 'Tavern Ledger', '🍺', 'Recipe name', JSON_ARRAY(
    JSON_OBJECT('key','category','label','Category','type','text'),
    JSON_OBJECT('key','crafted_by','label','Crafted By','type','text'),
    JSON_OBJECT('key','alcohol_content','label','Alcohol %','type','number'),
    JSON_OBJECT('key','proof','label','Proof','type','number'),
    JSON_OBJECT('key','cost_amount','label','Cost','type','number'),
    JSON_OBJECT('key','cost_coin','label','Coin','type','text'),
    JSON_OBJECT('key','culture_main','label','Culture','type','text'),
    JSON_OBJECT('key','beastfolk_type','label','Beastfolk Type','type','text'),
    JSON_OBJECT('key','ingredients','label','Ingredients','type','textarea'),
    JSON_OBJECT('key','result','label','Result','type','textarea')
), 20),
('species', 'Humanoid Species', '🧬', 'Species name', JSON_ARRAY(
    JSON_OBJECT('key','category','label','Category','type','text'),
    JSON_OBJECT('key','description','label','Description','type','textarea'),
    JSON_OBJECT('key','traits','label','Traits','type','textarea'),
    JSON_OBJECT('key','habitat','label','Habitat','type','text'),
    JSON_OBJECT('key','culture','label','Culture','type','textarea')
), 30),
('weapons_physical', 'Physical Weapons', '⚔️', 'Weapon name', JSON_ARRAY(
    JSON_OBJECT('key','category','label','Category','type','text'),
    JSON_OBJECT('key','weaponType','label','Weapon Type','type','text'),
    JSON_OBJECT('key','range','label','Range','type','text'),
    JSON_OBJECT('key','attackDamage','label','Attack Damage','type','text'),
    JSON_OBJECT('key','defensePoints','label','Defense Points','type','text'),
    JSON_OBJECT('key','materials','label','Materials','type','textarea'),
    JSON_OBJECT('key','techniques','label','Techniques','type','textarea'),
    JSON_OBJECT('key','species','label','Species','type','text'),
    JSON_OBJECT('key','classes','label','Classes','type','text')
), 40),
('weapons_armory', 'Weapon Armory', '🛡️', 'Weapon name', JSON_ARRAY(
    JSON_OBJECT('key','category','label','Category','type','text'),
    JSON_OBJECT('key','damage','label','Damage','type','text'),
    JSON_OBJECT('key','description','label','Description','type','textarea')
), 50),
('grimoire', 'Grimoire', '📖', 'Spell name', JSON_ARRAY(
    JSON_OBJECT('key','school','label','School','type','text'),
    JSON_OBJECT('key','tier','label','Tier','type','text'),
    JSON_OBJECT('key','mana','label','Mana','type','text'),
    JSON_OBJECT('key','createdBy','label','Created By','type','text'),
    JSON_OBJECT('key','inc','label','Incantation','type','textarea'),
    JSON_OBJECT('key','proc','label','Effect','type','textarea'),
    JSON_OBJECT('key','fail','label','On Failure','type','textarea'),
    JSON_OBJECT('key','cSucc','label','Critical Success','type','textarea'),
    JSON_OBJECT('key','cFail','label','Critical Failure','type','textarea')
), 60),
('flora_fauna', 'Flora & Fauna', '🌿', 'Specimen name', JSON_ARRAY(
    JSON_OBJECT('key','threatTier','label','Threat Tier','type','text'),
    JSON_OBJECT('key','habitat','label','Habitat','type','text'),
    JSON_OBJECT('key','description','label','Description','type','textarea'),
    JSON_OBJECT('key','attackDamage','label','Attack Damage','type','text'),
    JSON_OBJECT('key','killThreshold','label','Kill Threshold','type','text'),
    JSON_OBJECT('key','damageNotes','label','Damage Notes','type','textarea'),
    JSON_OBJECT('key','strengths','label','Strengths','type','textarea'),
    JSON_OBJECT('key','weaknesses','label','Weaknesses','type','textarea'),
    JSON_OBJECT('key','handlingTips','label','Handling Tips','type','textarea'),
    JSON_OBJECT('key','applications','label','Applications','type','textarea')
), 70),
('gear', 'Gear', '🎒', 'Class / item name', JSON_ARRAY(
    JSON_OBJECT('key','category','label','Category','type','text'),
    JSON_OBJECT('key','clothing','label','Clothing','type','textarea'),
    JSON_OBJECT('key','materials','label','Materials','type','textarea'),
    JSON_OBJECT('key','defenses','label','Defenses','type','textarea'),
    JSON_OBJECT('key','accessories','label','Accessories','type','textarea'),
    JSON_OBJECT('key','weapons','label','Weapons','type','textarea'),
    JSON_OBJECT('key','speciesPref','label','Species Preference','type','textarea'),
    JSON_OBJECT('key','skills','label','Skills','type','textarea')
), 80),
('covenant', 'Covenants', '📜', 'Covenant name', JSON_ARRAY(
    JSON_OBJECT('key','type','label','Type','type','text'),
    JSON_OBJECT('key','description','label','Description','type','textarea')
), 90),
('traps', 'Dungeon Traps', '🪤', 'Trap name', JSON_ARRAY(
    JSON_OBJECT('key','trap_type','label','Trap Type','type','text'),
    JSON_OBJECT('key','trap_dimensions','label','Dimensions','type','text'),
    JSON_OBJECT('key','damage_points','label','Damage','type','text'),
    JSON_OBJECT('key','trap_description','label','Description','type','textarea'),
    JSON_OBJECT('key','trap_effect','label','Effect','type','textarea'),
    JSON_OBJECT('key','damage_method','label','Damage Method','type','textarea'),
    JSON_OBJECT('key','countermeasures','label','Countermeasures','type','textarea')
), 95)
ON DUPLICATE KEY UPDATE
    label = VALUES(label), icon = VALUES(icon),
    name_label = VALUES(name_label), fields = VALUES(fields),
    sort_order = VALUES(sort_order);

SELECT 'IPRPS master schema ready.' AS Status;
SELECT COUNT(*) AS modules_registered FROM modules;
