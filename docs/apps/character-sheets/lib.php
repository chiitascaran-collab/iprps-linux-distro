<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Character Sheets - shared code: the character_sheets table, cleaning sheets before they're
// stored (imports come from players' computers), IPRPS derived values, and text summaries.
// Used by api.php in this folder and by the IPRPS Oracle (Medium and Advanced).

const CS_FORMAT = 'iprps-character-sheet';
const CS_FORMAT_VERSION = 1;
const CS_KINDS = ['pc' => 'Player character', 'npc' => 'NPC', 'creature' => 'Creature'];
const CS_STATS = ['int' => 'INT', 'str' => 'STR', 'dex' => 'DEX', 'wis' => 'WIS', 'con' => 'CON', 'wil' => 'WIL', 'cha' => 'CHA'];
const CS_MAX_SHEET = 2 * 1024 * 1024;        // sheet JSON without the portrait
const CS_MAX_AVATAR = 3 * 1024 * 1024;       // portrait (data: URL)
const CS_MAX_THUMB = 64 * 1024;              // list thumbnail (data: URL)

// The Character Creator's races (value => [label, Mana Pool race modifier]).
const CS_RACES = [
    'human' => ['Human', 0], 'humankin' => ['Humankin', 0], 'dwarf' => ['Dwarf', 1], 'elf' => ['Elf', -1],
    'dark-elf' => ['Dark Elf', -1], 'gemp' => ['Gemp', 0], 'orc' => ['Orc', 2], 'catfolk' => ['Catfolk', -1],
    'wolffolk' => ['Wolffolk', 0], 'dogfolk' => ['Dogfolk', 0], 'bearfolk' => ['Bearfolk', 2], 'foxfolk' => ['Foxfolk', -1],
    'rabbitfolk' => ['Rabbitfolk', -2], 'lizardfolk' => ['Lizardfolk', 1], 'birdfolk' => ['Birdfolk', -2],
    'dragonborn' => ['Dragonborn', 3], 'demon' => ['Demon', 0], 'halfling' => ['Halfling', -1], 'gnome' => ['Gnome', -2],
    'fairy' => ['Fairy', -3],
];
const CS_CLASSES = [
    'warrior' => 'Warrior', 'tank' => 'Tank', 'mage' => 'Mage', 'wizard' => 'Wizard', 'sorcerer' => 'Sorcerer',
    'necromancer' => 'Necromancer', 'rogue' => 'Rogue', 'assassin' => 'Assassin', 'ranger' => 'Ranger', 'ninja' => 'Ninja',
    'scout' => 'Scout', 'healer' => 'Healer', 'cleric' => 'Cleric', 'paladin' => 'Paladin', 'bard' => 'Bard',
    'beast-tamer' => 'Beast Tamer',
];
const CS_ARMOR = [0 => 'None', 1 => 'Leather', 2 => 'Studded Leather', 3 => 'Chain Mail', 4 => 'Scale Mail', 5 => 'Plate Mail', 6 => 'Full Plate'];

// Creatures: IPRPS size table (size => [examples, damage adjustment, grapple, Mana Pool modifier]).
const CS_SIZES = [
    -3 => ['Pixies, Fairies', -6, -3, -300], -2 => ['Goblins', -4, -2, -200], -1 => ['Catfolk, Birdfolk, Gemps', -2, -1, -100],
    0 => ['Humans, Elves, Wolffolk', 0, 0, 0], 1 => ['Orcs, Bearfolk', 2, 1, 100], 2 => ['Ogres, large Reptilians', 4, 2, 200],
    3 => ['Giants', 6, 3, 300], 4 => ['Young Dragons', 8, 4, 400], 5 => ['Adult Dragons', 10, 5, 500],
    6 => ['Ancient Dragons, Primordials', 12, 6, 600],
];
const CS_CREATURE_TYPES = ['Beast', 'Monstrosity', 'Undead', 'Construct', 'Dragon', 'Elemental', 'Spirit', 'Demon',
    'Aberration', 'Plant', 'Insectoid', 'Aquatic', 'Humanoid', 'Other'];
const CS_THREATS = ['Minion', 'Standard', 'Elite', 'Boss', 'Apex'];

// The Character Creator's built-in lists (anything else on a sheet is kept as a custom entry).
const CS_BASE_SKILLS = [
    'Melee Weapons' => 'STR', 'Ranged Weapons' => 'DEX', 'Martial Arts' => 'DEX', 'Parry' => 'DEX',
    'Dodge' => 'DEX', 'Weapon Specialization' => 'STR', 'Shield Combat' => 'STR', 'Shield Bash' => 'STR',
    'Dual Wielding' => 'DEX', 'Archery' => 'DEX', 'Throwing' => 'DEX', 'Athletics' => 'STR',
    'Climbing' => 'STR', 'Stealth' => 'DEX', 'Swimming' => 'STR', 'Acrobatics' => 'DEX',
    'Endurance' => 'CON', 'Running' => 'CON', 'Jumping' => 'STR', 'Balance' => 'DEX',
    'Escape Artist' => 'DEX', 'Investigation' => 'INT', 'Lore' => 'INT', 'Perception' => 'WIS',
    'Insight' => 'WIS', 'Survival' => 'WIS', 'Tracking' => 'WIS', 'Medicine' => 'WIS',
    'Nature' => 'WIS', 'Animal Handling' => 'WIS', 'Navigation' => 'INT', 'Negotiation' => 'CHA',
    'Persuasion' => 'CHA', 'Deception' => 'CHA', 'Streetwise' => 'INT', 'Leadership' => 'CHA',
    'Public Speaking' => 'CHA', 'Intimidation' => 'CHA', 'Diplomacy' => 'CHA', 'Bluff' => 'CHA',
    'Etiquette' => 'INT', 'Concentration' => 'WIL', 'Meditation' => 'WIL', 'Resistance' => 'WIL',
    'Mental Focus' => 'WIL', 'Engineering' => 'INT', 'Crafting' => 'INT', 'Piloting' => 'DEX',
    'Repair' => 'INT', 'Alchemy' => 'INT', 'Magick Theory' => 'INT', 'Magick Recovery' => 'CON',
    'Lock Picking' => 'DEX', 'Trap Detection' => 'WIS', 'Disguise' => 'CHA', 'Forgery' => 'INT',
    'Gambling' => 'INT', 'Sleight of Hand' => 'DEX',
];
const CS_BASE_ADVANTAGES = [
    'Increased Strength', 'Enhanced Dexterity', 'Enhanced Constitution', 'Enhanced Senses',
    'Night Vision', 'Damage Resistance', 'Immunity to Disease', 'Immunity to Poison',
    'Regeneration', 'Increased Movement Speed', 'Climbing Limbs', 'Built-in Armor or Exoskeleton',
    'High Intelligence', 'Perfect Memory', 'Rapid Learning', 'Strong Will',
    'Iron Will', 'Danger Sense', 'Intuition', 'Precision Logic',
    'Resistance to Fear', 'Resistance to Mind Control', 'Charisma', 'Voice (clear, pleasant, commanding)',
    'Reputation', 'Status', 'Rank', 'Wealth',
    'Fame', 'Allies', 'Contacts', 'Followers',
    'Leadership Ability', 'Social Privilege', 'Aptitude Bonuses', 'Skill Talent Groups',
    'Expertise Dice', 'Proficiency Bonuses', 'Reduced Penalties in Specialization', 'Advantage on Specific Skill Checks',
    'Combat Reflexes', 'Improved Initiative', 'Extra Attacks', 'Weapon Mastery',
    'Critical Hit Bonuses', 'Improved Defenses', 'Evasion', 'Uncanny Dodge',
    'Tactical Awareness', 'Magick Affinity', 'Mana Sense', 'Energy Reserve',
    'True Faith', 'Destiny', 'Universal Supernatural Regeneration', 'Natural Climber',
    'Silent Movement', 'Integrated Tools', 'Damage Immunities',
];
const CS_BASE_DISADVANTAGES = [
    'Low Strength', 'Low Dexterity', 'Low Constitution', 'Frailty',
    'Chronic Pain', 'Missing Limbs', 'Blindness', 'Deafness',
    'Bad Vision', 'Slow Healing', 'Susceptibility to Disease', 'Susceptibility to Poison',
    'Vulnerability to Damage Types', 'Low Intelligence', 'Weak Will', 'Poor Perception',
    'Phobias', 'Compulsions', 'Addictions', 'Paranoia',
    'Overconfidence', 'Cowardice', 'Depression', 'Madness',
    'Confusion Effects', 'Low Status', 'Infamy', 'Criminal Record',
    'Social Stigma', 'Dishonor', 'Bad Reputation', 'Enemy Factions',
    'Outcast Status', 'Hated Ancestry', 'Cursed Lineage', 'Poverty',
    'Debt', 'Lack of Property', 'Dependent Obligations', 'Loss of Income',
    'Restricted Equipment Access', 'Maintenance Costs', 'Low Skill Caps', 'Lack of Proficiency',
    'Learning Penalties', 'Cultural Unfamiliarity', 'Illiteracy', 'Technological Ignorance',
    'Inability to Use Certain Tools or Magick', 'Odious Personal Habits', 'Impulsiveness', 'Arrogance',
    'Obsession', 'Greed', 'Honesty Codes', 'Vows',
    'Taboos', 'Compulsive Behaviors', 'Reduced Initiative', 'Limited Actions',
    'Slower Reactions', 'Poor Defenses', 'Vulnerability to Surprise', 'Exhaustion Penalties',
    'Clumsiness', 'Weapon or Armor Restrictions', 'Cursed Items', 'Wild Magick Surges',
    'Mana Sensitivity', 'Spell Failure Chance', 'Divine Restrictions', 'Magickal Dependency',
    'Supernatural Enemies', 'Cold Blooded', 'Territorial Aggression', 'Scaled Rigidity',
    'Hive Conditioning', 'Alien Morality', 'Sensory Narrowness', 'Maintenance Dependency',
    'Emotion Simulation', 'EMP Vulnerability', 'Binding Vulnerability', 'Planar Instability',
    'Incorporeal Limitation', 'Anchor Dependence', 'Disruption Vulnerability', 'Bad Luck',
    'Narrative Burden', 'Temporal Displacement', 'Existential Instability', 'Plot Vulnerability',
    'Heat Intolerance', 'Cold Intolerance', 'Need for Frequent Rest', 'Breathing Limits',
    'Pressure Sensitivity', 'Environmental Dependence',
];
const CS_BASE_QUIRKS = [
    'Nervous habits', 'Avoiding eye contact', 'Formal speech patterns', 'Inappropriate laughter',
    'Collecting trivial objects', 'Distinct accents', 'Sarcasm', 'Literal interpretation',
    'Frequent pauses', 'Excessive politeness', 'Quoting sayings', 'Optimism',
    'Cynicism', 'Impatience', 'Stubbornness', 'Excessive caution',
    'Curiosity', 'Distrust of authority', 'Refusal to lie', 'Always helping children',
    'Dislike of cruelty', 'Insistence on fair payment', 'Discomfort in crowds', 'Preference for solitude',
    'Eagerness to impress', 'Avoidance of certain classes', 'Deference to elders', 'Strict meal routines',
    'Pre-danger superstitions', 'Meticulous note taking', 'Ritual cleaning of gear', 'Refusal to sleep without light',
    'Mild paranoia', 'Nervous humor under stress', 'Fear of silence', 'Attachment to lucky items',
    'Avoidance of reminders of failure', 'Unfamiliar customs', 'Reliance on old traditions', 'Unusual greetings',
    'Homeland food taboos', 'Stress-induced limp', 'Sensitivity to loud noise', 'Poor night vision',
    'Distinctive scars', 'Constant squinting', 'Obsessive tool organization', 'Correcting technical errors',
    'Puzzle-oriented thinking', 'Freezing when surprised', 'Over-talking under pressure', 'Retreating into silence',
    'Hyper-focus on minor tasks', 'Lucky numbers', 'Color distrust', 'Reverence for omens',
    'Belief in destiny', 'Letter writing to absent family', 'Protecting rivals', 'Refusal to abandon companions',
    'Harmless grudges', 'Bad timing', 'Arriving late', 'Overhearing gossip',
    'Finding trouble unintentionally',
];

// ---------------------------------------------------------------- table
function cs_schema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS character_sheets (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        campaign_id INT UNSIGNED NULL,
        kind        ENUM('pc','npc','creature') NOT NULL DEFAULT 'pc',
        name        VARCHAR(120) NOT NULL,
        player_name VARCHAR(100),
        race        VARCHAR(80),
        class       VARCHAR(80),
        level       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
        hp          INT,
        mp          BIGINT,
        armor       SMALLINT,
        sheet_json  LONGTEXT NOT NULL,
        avatar      MEDIUMTEXT,
        thumb       TEXT,
        source      ENUM('import','editor','oracle','table') NOT NULL DEFAULT 'import',
        file_name   VARCHAR(200),
        notes       TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_owner (user_id, kind, name),
        INDEX idx_campaign (campaign_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

// ---------------------------------------------------------------- cleaning
// Text kept as text (shown with textContent or in form fields).
function cs_txt($v, int $max): string {
    if (is_array($v) || is_object($v)) $v = '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$v) ?? '';
    $s = trim($s);
    return mb_strlen($s) > $max ? mb_substr($s, 0, $max) : $s;
}
// Names that the Character Creator puts into its page markup (skills, advantages, spells...):
// no characters that could break out of HTML or a quoted attribute.
function cs_label($v, int $max = 80): string {
    $s = cs_txt($v, $max * 2);
    $s = str_replace(['<', '>', '"', "'", '`', '\\', '&', "\n", "\r", "\t"], ['', '', '', '’', '', '', ' and ', ' ', ' ', ' '], $s);
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_strlen($s) > $max ? trim(mb_substr($s, 0, $max)) : $s;
}
function cs_int($v, int $min, int $max, int $def): int {
    if (!is_numeric($v)) return $def;
    return max($min, min($max, (int)round((float)$v)));
}
function cs_list($v, int $maxItems = 200, int $len = 80): array {
    $out = [];
    foreach (is_array($v) ? $v : [] as $x) {
        $l = cs_label(is_array($x) ? ($x['name'] ?? '') : $x, $len);
        if ($l !== '' && !in_array($l, $out, true)) $out[] = $l;
        if (count($out) >= $maxItems) break;
    }
    return $out;
}
function cs_image($v, int $max): ?string {
    if (!is_string($v) || $v === '' || strlen($v) > $max) return null;
    return preg_match('#^data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$#', $v) ? $v : null;
}
function cs_slug_or_label(string $v, array $known): string {
    $k = strtolower(trim($v));
    if (isset($known[$k])) return $k;
    foreach ($known as $slug => $lab) {
        $name = is_array($lab) ? $lab[0] : $lab;
        if (strtolower($name) === $k || str_replace(' ', '-', strtolower($name)) === $k) return $slug;
    }
    return cs_label($v, 60);
}

// ---------------------------------------------------------------- IPRPS values (same formulas as the Character Creator)
function cs_attr_cost(string $a, int $lvl): int {
    if ($lvl === 10) return 0;
    $per = in_array($a, ['int', 'dex'], true) ? 10 : 5;
    return $lvl > 10 ? ($lvl - 10) * $per : -((10 - $lvl) * 2);
}
function cs_skill_cost(int $lvl): int {
    $c = 0;
    for ($i = 1; $i <= min($lvl, 100); $i++) {
        if ($i <= 3) $c += 1; elseif ($i <= 9) $c += 2; elseif ($i === 10) $c += 5; elseif ($i <= 14) $c += 3;
        elseif ($i === 15) $c += 10; elseif ($i <= 19) $c += 5; elseif ($i === 20) $c += 15; elseif ($i <= 49) $c += 10;
        elseif ($i === 50) $c += 50; elseif ($i <= 99) $c += 20; else $c += 100;
    }
    return $c;
}
function cs_spent(array $s): int {
    $t = 0;
    foreach (CS_STATS as $k => $_) $t += cs_attr_cost($k, (int)($s['stats'][$k] ?? 10));
    foreach ($s['skills'] ?? [] as $lvl) $t += cs_skill_cost((int)$lvl);
    foreach ($s['spells'] ?? [] as $sp) if (!empty($sp['acquired'])) $t += 10 + cs_skill_cost((int)($sp['skillLevel'] ?? 0));
    return $t;
}
function cs_derive(array $s, int $raceMod, bool $magick = true): array {
    $st = $s['stats']; $lvl = (int)$s['level'];
    $hp = 50 + $st['con'] * 10 + $lvl * 5;
    $mp = $magick ? max(0, (int)floor((($s['manaRoll'] * $hp) + ($st['int'] / 3) + ($raceMod * 100)) * 3)) : 0;
    $speed = intdiv($st['dex'] + $st['con'], 4);
    $str = $st['str'];
    return [
        'hp' => $hp, 'mp' => $mp, 'speed' => $speed, 'dodge' => $speed + (int)floor(($st['dex'] - 10) / 2),
        'reach' => '5ft', 'jump' => ($str + intdiv($st['dex'], 2)) . 'ft', 'throw' => ($str * 2) . 'ft',
        'punch' => $str <= 10 ? '1d4' : ($str <= 15 ? '1d6' : '1d8'),
        'kick' => $str <= 10 ? '1d6' : ($str <= 15 ? '1d8' : '1d10'),
        'swing' => $str <= 10 ? '1d8' : ($str <= 15 ? '1d10' : '2d6'),
        'carry' => ($str * 12) . 'lb', 'lift' => ($str * 20) . 'lb',
    ];
}

// ---------------------------------------------------------------- normalize one sheet
// Returns ['sheet' => array (without portrait), 'avatar' => ?string, 'kind' => pc|npc|creature, 'cols' => [...], 'warnings' => []].
function cs_normalize($in, ?string $kind = null): array {
    if (!is_array($in) || array_is_list($in)) throw new InvalidArgumentException('This file is not an IPRPS character sheet.');
    if (!isset($in['stats']) && !isset($in['characterName']) && !isset($in['skills']) && !isset($in['creature']))
        throw new InvalidArgumentException('This file is not an IPRPS character sheet (no character name or attributes).');
    $warn = [];
    $type = $kind ?: (string)($in['sheetType'] ?? (isset($in['creature']) ? 'creature' : 'pc'));
    if (!isset(CS_KINDS[$type])) $type = 'pc';

    $s = ['format' => CS_FORMAT, 'formatVersion' => CS_FORMAT_VERSION, 'sheetType' => $type];
    $s['characterName'] = cs_txt($in['characterName'] ?? $in['name'] ?? '', 120) ?: ($type === 'creature' ? 'Unnamed creature' : 'Unnamed character');
    $s['level'] = cs_int($in['level'] ?? 1, 1, 110, 1);
    $s['stats'] = [];
    foreach (CS_STATS as $k => $_) $s['stats'][$k] = cs_int($in['stats'][$k] ?? 10, 1, 100, 10);
    $s['manaRoll'] = cs_int($in['manaRoll'] ?? 0, 0, 1000, 0) ?: random_int(1, 1000);

    // Skills: base skills by name (any case), the rest become custom skills.
    $skills = []; $custom = [];
    foreach ((is_array($in['customSkills'] ?? null) ? $in['customSkills'] : []) as $cs) {
        $n = cs_label(is_array($cs) ? ($cs['name'] ?? '') : $cs, 60);
        if ($n === '' || isset(CS_BASE_SKILLS[$n])) continue;
        $a = strtoupper(cs_label(is_array($cs) ? ($cs['attr'] ?? 'INT') : 'INT', 3));
        $custom[$n] = in_array($a, CS_STATS, true) ? $a : 'INT';
    }
    $lower = array_change_key_case(array_combine(array_keys(CS_BASE_SKILLS), array_keys(CS_BASE_SKILLS)));
    $rawSkills = $in['skills'] ?? [];
    if (is_array($rawSkills) && array_is_list($rawSkills)) {          // [{name, level}] (the Oracle's format)
        $tmp = [];
        foreach ($rawSkills as $x) if (is_array($x)) $tmp[(string)($x['name'] ?? '')] = $x['level'] ?? 0;
        $rawSkills = $tmp;
    }
    foreach (is_array($rawSkills) ? $rawSkills : [] as $name => $lvl) {
        $n = cs_label($name, 60); $l = cs_int($lvl, 0, 100, 0);
        if ($n === '' || $l <= 0) continue;
        $base = $lower[strtolower($n)] ?? null;
        if ($base) { $skills[$base] = $l; continue; }
        if (!isset($custom[$n])) $custom[$n] = 'INT';
        $skills[$n] = $l;
        if (count($skills) >= 120) break;
    }
    $s['skills'] = $skills;
    $s['customSkills'] = array_map(fn($n, $a) => ['name' => $n, 'attr' => $a], array_keys($custom), $custom);
    $s['armor'] = cs_int($in['armor'] ?? 0, 0, 99, 0);
    $s['notes'] = cs_txt($in['notes'] ?? '', 20000);
    $s['background'] = cs_txt($in['background'] ?? '', 20000);

    // Spells
    $s['spells'] = [];
    foreach (array_slice(is_array($in['spells'] ?? null) ? $in['spells'] : [], 0, 100) as $sp) {
        if (!is_array($sp)) continue;
        $s['spells'][] = ['name' => cs_label($sp['name'] ?? '', 80), 'damage' => cs_label($sp['damage'] ?? '', 40),
            'manaCost' => cs_int($sp['manaCost'] ?? 0, 0, 100000000, 0), 'acquired' => !empty($sp['acquired']),
            'skillLevel' => cs_int($sp['skillLevel'] ?? 0, 0, 100, 0)];
    }

    $avatar = null;
    if (isset($in['avatar']) && $in['avatar'] !== null && $in['avatar'] !== '') {
        $avatar = cs_image($in['avatar'], CS_MAX_AVATAR);
        if (!$avatar) $warn[] = 'The portrait was left out (not a PNG, JPEG, GIF or WebP picture, or larger than 3 MB).';
    }

    if ($type === 'creature') {
        $c = is_array($in['creature'] ?? null) ? $in['creature'] : [];
        $size = cs_int($c['size'] ?? 0, -3, 6, 0);
        $threat = cs_label($c['threat'] ?? 'Standard', 20);
        $ctype = cs_label($c['type'] ?? 'Beast', 40);
        $s['creature'] = [
            'type' => $ctype ?: 'Beast',
            'size' => $size,
            'threat' => in_array(ucfirst(strtolower($threat)), CS_THREATS, true) ? ucfirst(strtolower($threat)) : 'Standard',
            'habitat' => cs_txt($c['habitat'] ?? '', 300), 'movement' => cs_txt($c['movement'] ?? '', 300),
            'senses' => cs_txt($c['senses'] ?? '', 300), 'behavior' => cs_txt($c['behavior'] ?? '', 2000),
            'tactics' => cs_txt($c['tactics'] ?? '', 2000), 'loot' => cs_txt($c['loot'] ?? '', 2000),
            'magick' => !empty($c['magick']) || (bool)array_filter($s['spells'], fn($x) => $x['acquired']),
            'attacks' => [], 'abilities' => [],
            'weaknesses' => cs_list($c['weaknesses'] ?? [], 20, 120),
        ];
        foreach (array_slice(is_array($c['attacks'] ?? null) ? $c['attacks'] : [], 0, 16) as $a) {
            if (!is_array($a) || cs_label($a['name'] ?? '', 60) === '') continue;
            $s['creature']['attacks'][] = ['name' => cs_label($a['name'], 60), 'damage' => cs_label($a['damage'] ?? '', 40), 'notes' => cs_txt($a['notes'] ?? '', 400)];
        }
        foreach (array_slice(is_array($c['abilities'] ?? null) ? $c['abilities'] : [], 0, 20) as $a) {
            if (is_string($a)) $a = ['name' => $a, 'text' => ''];
            if (!is_array($a) || cs_label($a['name'] ?? '', 80) === '') continue;
            $s['creature']['abilities'][] = ['name' => cs_label($a['name'], 80), 'text' => cs_txt($a['text'] ?? '', 800)];
        }
        $s['derived'] = cs_derive($s, $size, $s['creature']['magick']);
        $cols = ['name' => $s['characterName'], 'player_name' => null, 'race' => mb_substr($s['creature']['type'], 0, 80),
                 'class' => $s['creature']['threat']];
    } else {
        $s['playerName'] = cs_txt($in['playerName'] ?? '', 100);
        $s['username'] = cs_txt($in['username'] ?? '', 100);
        $s['race'] = cs_slug_or_label(cs_txt($in['race'] ?? '', 60), CS_RACES);
        $s['class'] = cs_slug_or_label(cs_txt($in['class'] ?? '', 60), CS_CLASSES + ['custom' => 'Custom']);
        $s['customClass'] = cs_label($in['customClass'] ?? '', 60);
        if ($s['class'] !== '' && !isset(CS_CLASSES[$s['class']]) && $s['class'] !== 'custom') { $s['customClass'] = $s['customClass'] ?: $s['class']; $s['class'] = 'custom'; }
        $s['xp'] = cs_int($in['xp'] ?? 0, 0, 100000000, 0);
        $s['xpPool'] = cs_int($in['xpPool'] ?? 0, 0, 100000000, 0);
        $s['equipment'] = cs_txt($in['equipment'] ?? '', 20000);
        $s['money'] = cs_txt($in['money'] ?? '', 20000);
        foreach ([['advantages', 'customAdvantages', CS_BASE_ADVANTAGES], ['disadvantages', 'customDisadvantages', CS_BASE_DISADVANTAGES],
                  ['quirks', 'customQuirks', CS_BASE_QUIRKS]] as [$sel, $cust, $base]) {
            $picked = cs_list($in[$sel] ?? []);
            $own = array_values(array_filter(cs_list($in[$cust] ?? []), fn($x) => !in_array($x, $base, true)));
            foreach ($picked as $p) if (!in_array($p, $base, true) && !in_array($p, $own, true)) $own[] = $p;   // keep them visible in the Creator
            $s[$sel] = $picked; $s[$cust] = $own;
        }
        $spent = cs_spent($s);
        $s['characterPoints'] = cs_int($in['characterPoints'] ?? 100, 0, 1000000, 100);
        if (empty($in['characterPoints']) && $spent > $s['characterPoints']) $s['characterPoints'] = $spent;   // e.g. the Oracle's NPCs
        $s['totalSpent'] = $spent;
        $s['remainingPoints'] = $s['characterPoints'] + $s['xpPool'] - $spent;
        $s['derived'] = cs_derive($s, CS_RACES[$s['race']][1] ?? 0);
        $raceLabel = CS_RACES[$s['race']][0] ?? $s['race'];
        $classLabel = $s['class'] === 'custom' ? $s['customClass'] : (CS_CLASSES[$s['class']] ?? $s['class']);
        $cols = ['name' => $s['characterName'], 'player_name' => $type === 'pc' ? (mb_substr($s['playerName'], 0, 100) ?: null) : null,
                 'race' => mb_substr($raceLabel, 0, 80) ?: null, 'class' => mb_substr((string)$classLabel, 0, 80) ?: null];
    }
    $cols += ['level' => $s['level'], 'hp' => $s['derived']['hp'], 'mp' => $s['derived']['mp'], 'armor' => $s['armor']];
    $cols['name'] = mb_substr($cols['name'], 0, 120);
    return ['sheet' => $s, 'avatar' => $avatar, 'kind' => $type, 'cols' => $cols, 'warnings' => $warn];
}

// ---------------------------------------------------------------- store
// $o: id (update), campaign_id, kind, source, file_name, thumb, notes
function cs_save(PDO $db, int $uid, $sheet, array $o = []): array {
    $n = cs_normalize($sheet, isset($o['kind']) && isset(CS_KINDS[$o['kind']]) ? $o['kind'] : null);
    $json = json_encode($n['sheet'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (strlen($json) > CS_MAX_SHEET) throw new InvalidArgumentException('This sheet is too large (2 MB without the portrait).');
    $camp = isset($o['campaign_id']) && (int)$o['campaign_id'] > 0 ? (int)$o['campaign_id'] : null;
    if ($camp) { $st = $db->prepare('SELECT 1 FROM campaigns WHERE id = ?'); $st->execute([$camp]); if (!$st->fetch()) $camp = null; }
    $thumb = $n['avatar'] ? cs_image($o['thumb'] ?? null, CS_MAX_THUMB) : null;
    $src = in_array($o['source'] ?? '', ['import', 'editor', 'oracle', 'table'], true) ? $o['source'] : 'import';
    $c = $n['cols'];
    $id = (int)($o['id'] ?? 0);
    if ($id) {
        $chk = $db->prepare('SELECT campaign_id FROM character_sheets WHERE id = ? AND user_id = ?');
        $chk->execute([$id, $uid]);
        $old = $chk->fetch();
        if (!$old) throw new RuntimeException('That character sheet was not found.', 404);
        if (!array_key_exists('campaign_id', $o)) $camp = $old['campaign_id'] !== null ? (int)$old['campaign_id'] : null;
        $st = $db->prepare('UPDATE character_sheets SET kind = ?, name = ?, player_name = ?, race = ?, class = ?, level = ?, hp = ?, mp = ?, armor = ?,
                            sheet_json = ?, avatar = ?, thumb = ?, campaign_id = ? WHERE id = ? AND user_id = ?');
        $st->execute([$n['kind'], $c['name'], $c['player_name'], $c['race'], $c['class'], $c['level'], $c['hp'], $c['mp'], $c['armor'],
                      $json, $n['avatar'], $thumb, $camp, $id, $uid]);
    } else {
        $st = $db->prepare('INSERT INTO character_sheets (user_id, campaign_id, kind, name, player_name, race, class, level, hp, mp, armor,
                            sheet_json, avatar, thumb, source, file_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $st->execute([$uid, $camp, $n['kind'], $c['name'], $c['player_name'], $c['race'], $c['class'], $c['level'], $c['hp'], $c['mp'], $c['armor'],
                      $json, $n['avatar'], $thumb, $src, cs_txt($o['file_name'] ?? '', 200) ?: null, cs_txt($o['notes'] ?? '', 5000) ?: null]);
        $id = (int)$db->lastInsertId();
    }
    return ['id' => $id, 'name' => $c['name'], 'kind' => $n['kind'], 'warnings' => $n['warnings']];
}

// ---------------------------------------------------------------- text summaries (the Oracle, the IPRPS Table)
function cs_shift(int $v): string { return ($v >= 0 ? '+' : '') . $v; }
function cs_clip(string $s, int $n): string {
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s;
}
function cs_top_skills(array $s, int $n): array {
    $sk = array_filter($s['skills'] ?? [], fn($l) => (int)$l > 0);
    arsort($sk);
    return array_slice($sk, 0, $n, true);
}
// $row: a character_sheets row (kind, player_name, notes) or null; $detail: the full sheet, not one line.
function cs_summary(array $s, string $kind, bool $detail = false, ?array $row = null): string {
    $d = $s['derived'] ?? [];
    $name = $s['characterName'] ?? 'Unnamed';
    $stats = implode(' ', array_map(fn($k, $lab) => "$lab " . ($s['stats'][$k] ?? 10), array_keys(CS_STATS), CS_STATS));
    $skills = cs_top_skills($s, $detail ? 40 : 6);
    $skillTxt = implode(', ', array_map(fn($k, $v) => $detail ? "$k $v (" . cs_shift(intdiv((int)$v, 10)) . ')' : "$k $v", array_keys($skills), $skills));
    if ($kind === 'creature') {
        $c = $s['creature'] ?? [];
        $sz = (int)($c['size'] ?? 0); $szr = CS_SIZES[$sz] ?? CS_SIZES[0];
        $head = "$name — creature: {$c['type']}, size " . cs_shift($sz) . ", {$c['threat']}, level {$s['level']}. HP {$d['hp']}"
              . (!empty($c['magick']) ? ', MP ' . number_format((int)$d['mp']) : '') . ", natural AR {$s['armor']}, speed {$d['speed']}, dodge {$d['dodge']}.";
        if (!$detail) {
            $atk = implode('; ', array_map(fn($a) => $a['name'] . ($a['damage'] ? " {$a['damage']}" : ''), array_slice($c['attacks'] ?? [], 0, 3)));
            return $head . ($atk ? " Attacks: $atk." : '') . ($skillTxt ? " Skills: $skillTxt." : '');
        }
        $L = [$head, "Attributes: $stats.",
              'Size ' . cs_shift($sz) . " ({$szr[0]}): damage " . cs_shift($szr[1]) . ', grapple ' . cs_shift($szr[2]) . '.'];
        foreach (['habitat' => 'Habitat', 'movement' => 'Movement', 'senses' => 'Senses'] as $k => $lab) if (!empty($c[$k])) $L[] = "$lab: " . cs_clip($c[$k], 300);
        if (!empty($c['attacks'])) $L[] = "Attacks:\n" . implode("\n", array_map(fn($a) => "- {$a['name']}" . ($a['damage'] ? ": {$a['damage']}" : '') . ($a['notes'] ? " — " . cs_clip($a['notes'], 200) : ''), $c['attacks']));
        if (!empty($c['abilities'])) $L[] = "Abilities:\n" . implode("\n", array_map(fn($a) => "- {$a['name']}" . ($a['text'] ? ": " . cs_clip($a['text'], 300) : ''), $c['abilities']));
        if (!empty($c['weaknesses'])) $L[] = 'Weaknesses: ' . implode(', ', $c['weaknesses']) . '.';
        if ($skillTxt) $L[] = "Skills: $skillTxt.";
        $sp = array_filter($s['spells'] ?? [], fn($x) => $x['acquired'] && $x['name'] !== '');
        if ($sp) $L[] = 'Spells: ' . implode('; ', array_map(fn($x) => $x['name'] . ($x['damage'] ? " ({$x['damage']})" : '') . ($x['manaCost'] ? ", {$x['manaCost']} MP" : ''), $sp)) . '.';
        foreach (['behavior' => 'Behavior', 'tactics' => 'Tactics', 'loot' => 'Loot'] as $k => $lab) if (!empty($c[$k])) $L[] = "$lab: " . cs_clip($c[$k], 500);
        if (!empty($s['background'])) $L[] = 'Lore: ' . cs_clip($s['background'], 600);
        if (!empty($s['notes'])) $L[] = 'Notes: ' . cs_clip($s['notes'], 400);
        if ($row && !empty($row['notes'])) $L[] = 'Session Master notes: ' . cs_clip($row['notes'], 400);
        return implode("\n", $L);
    }
    $race = CS_RACES[$s['race'] ?? ''][0] ?? ($s['race'] ?? '');
    $class = ($s['class'] ?? '') === 'custom' ? ($s['customClass'] ?? '') : (CS_CLASSES[$s['class'] ?? ''] ?? ($s['class'] ?? ''));
    $who = trim("$race $class");
    $player = $kind === 'pc' && !empty($s['playerName']) ? " (player: {$s['playerName']})" : '';
    $armor = (int)($s['armor'] ?? 0);
    $head = "$name — " . ($kind === 'npc' ? 'NPC' : 'player character') . ($who !== '' ? ", $who" : '') . ", level {$s['level']}$player."
          . " HP {$d['hp']}, MP " . number_format((int)($d['mp'] ?? 0)) . ", AR $armor" . (isset(CS_ARMOR[$armor]) && $armor ? ' (' . CS_ARMOR[$armor] . ')' : '') . ".";
    if (!$detail) return "$head $stats." . ($skillTxt ? " Skills: $skillTxt." : '');
    $L = [$head,
          'Attributes (shift): ' . implode(' ', array_map(fn($k, $lab) => "$lab " . ($s['stats'][$k] ?? 10) . ' (' . cs_shift(($s['stats'][$k] ?? 10) - 10) . ')', array_keys(CS_STATS), CS_STATS)) . '.',
          "Speed {$d['speed']}, dodge {$d['dodge']}, punch {$d['punch']}, kick {$d['kick']}, swing {$d['swing']}, carry {$d['carry']}."];
    if ($skillTxt) $L[] = "Skills: $skillTxt.";
    foreach (['advantages' => 'Advantages', 'disadvantages' => 'Disadvantages', 'quirks' => 'Quirks'] as $k => $lab)
        if (!empty($s[$k])) $L[] = "$lab: " . implode(', ', $s[$k]) . '.';
    $sp = array_filter($s['spells'] ?? [], fn($x) => $x['acquired'] && $x['name'] !== '');
    if ($sp) $L[] = 'Spells: ' . implode('; ', array_map(fn($x) => $x['name'] . ($x['damage'] ? " ({$x['damage']})" : '') . ($x['manaCost'] ? ", {$x['manaCost']} MP" : '') . ($x['skillLevel'] ? ", skill {$x['skillLevel']}" : ''), $sp)) . '.';
    if (!empty($s['equipment'])) $L[] = 'Equipment: ' . cs_clip($s['equipment'], 500);
    if (!empty($s['money'])) $L[] = 'Money and items: ' . cs_clip($s['money'], 300);
    if (!empty($s['background'])) $L[] = 'Background: ' . cs_clip($s['background'], 700);
    if (!empty($s['notes'])) $L[] = 'Notes: ' . cs_clip($s['notes'], 400);
    if ($row && !empty($row['notes'])) $L[] = 'Session Master notes: ' . cs_clip($row['notes'], 400);
    return implode("\n", $L);
}
