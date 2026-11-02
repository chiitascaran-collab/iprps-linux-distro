<?php
// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// IPRPS Oracle - the Session Master voice and the quick generators.

const ORACLE_SYSTEM = <<<'TXT'
You are the IPRPS Oracle, a creative assistant for the Session Master of an Infinite Plane Role Playing System (IPRPS) game. You help run sessions at the table: improvising NPCs, describing scenes, inventing locations, loot, encounters and plot hooks, and answering questions about the campaign.

Rules you always follow:
- IPRPS terminology: difficulty is a BTN (Base Target Number) and defense is AR (Armor Rating). Never use "DC" or "AC".
- The Session Master is in charge. Offer ideas and options; never decide outcomes for the players.
- Stay consistent with the campaign memory you are given. If something isn't in it, you may invent it, but never contradict it.
- Be vivid and concise: short paragraphs, concrete sensory detail, names that fit the setting. Use headings and short lists when they help the Session Master scan at the table.
- When asked for text to read aloud to players, write it in second person ("you"), present tense, and reveal nothing the characters couldn't perceive.
- Keep content suitable for a general table unless the Session Master's campaign memory says otherwise.
TXT;

// Quick generators: label, button icon, and the request sent to the model.
// {details} is replaced by what the Session Master typed (or "none").
const ORACLE_GENERATORS = [
    'npc' => ['NPC', '🧙', <<<'TXT'
Create one NPC for the current scene. Extra details from the Session Master: {details}.
Use exactly this format:
Name: <name>
Role: <occupation or place in the story>
Look: <one or two sentences>
Manner: <how they talk and act; one quirk>
Wants: <what they want right now>
Secret: <something the players don't know>
Hook: <how they could pull the party into trouble or adventure>
Game note: <a short IPRPS note, using BTN and AR where useful>
TXT],
    'location' => ['Location', '🏰', <<<'TXT'
Describe one location the party could visit. Extra details: {details}.
Format:
Name: <name>
Read-aloud: <3-4 sentences in second person, present tense>
Details: <3-5 bullet points: features, people, dangers, opportunities>
Secret: <one hidden thing worth discovering>
TXT],
    'loot' => ['Loot', '💰', <<<'TXT'
Generate a treasure find appropriate to the campaign. Extra details: {details}.
List 4-6 items: for each, a name, a one-line description, and why it might matter later. Include at least one curiosity with a story hook. Keep values and powers modest unless the details ask otherwise.
TXT],
    'encounter' => ['Encounter', '⚔️', <<<'TXT'
Design one encounter. Extra details: {details}.
Format:
Title: <short title>
Setup: <what the characters see, 2-3 sentences>
Opposition: <who or what, with motives; IPRPS notes using BTN and AR>
Terrain and twists: <2-3 bullet points>
If it goes badly: <a fallback that keeps the story moving>
Resolution options: <fight, talk, sneak, or something clever>
TXT],
    'hook' => ['Plot hook', '🪝', <<<'TXT'
Give three distinct plot hooks that fit the campaign. Extra details: {details}.
For each: Title, a two-sentence hook, and who in the campaign it involves (use existing NPCs, quests or places from the campaign memory when you can).
Start the first line of each hook with "Title:".
TXT],
    'names' => ['Names', '📜', <<<'TXT'
Give 12 names that fit the setting. Extra details (people, places, ships, taverns...): {details}.
Return a numbered list; after each name, three to six words on who or what it could be.
TXT],
    'readaloud' => ['Read-aloud', '🎭', <<<'TXT'
Write a read-aloud description for the players, in second person and present tense, 80-140 words, rich in sight, sound and smell. Reveal nothing the characters couldn't perceive. The scene: {details}.
TXT],
];

function oracle_generator_prompt(string $key, string $details): ?string {
    if (!isset(ORACLE_GENERATORS[$key])) return null;
    $d = trim($details) === '' ? 'none' : trim($details);
    return str_replace('{details}', $d, ORACLE_GENERATORS[$key][2]);
}

// ---------------------------------------------------------------- character sheets (needs the Character Sheets app)
// The model answers in JSON that matches a schema (Ollama "structured outputs"); character-sheets/lib.php
// then checks every value, works out HP, Mana Pool, Speed and Dodge, and stores the sheet.
const ORACLE_SHEET_RULES = <<<'TXT'
IPRPS character sheet rules (use them for every number):
- Seven attributes: INT, STR, DEX, WIS, CON, WIL, CHA. 10 is average, 8-9 below average, 11-12 above, 13-14 exceptional, 15+ amazing. Ordinary people are mostly 8-12.
- Species defaults (STR DEX CON INT WIS CHA WIL): Human 10s; Elf 8 14 8 14 12 14 12; Dwarf 14 8 16 10 12 8 14; Catfolk 8 16 10 12 14 14 10; Wolffolk 14 12 14 8 14 10 12; Bearfolk 18 6 16 8 12 8 14; Birdfolk 6 16 8 12 14 14 10; Rabbitfolk 6 16 10 12 14 12 10; Demon 12 12 12 14 10 16 8; Gemp 6 10 8 18 14 10 12; Orc 18 10 16 6 8 8 12; Goblin 6 14 8 10 12 10 6; Fairy 2 18 4 14 14 16 8.
- Skills run 0-100: 10 trained professional, 20 expert, 30 master, 40 grandmaster, 50 legendary. Most people have 3-8 skills, mostly 5-25.
- Level runs from 1 (novice) upward; 1-5 for ordinary people, 6-15 for veterans, higher only for legends.
- Armor Rating (AR) is subtracted from damage: 0 none, 1 leather, 2 studded leather, 3 chain mail, 4 scale mail, 5 plate mail, 6 full plate.
- Damage uses dice notation such as 1d6, 2d6+1, 3d6. Difficulty is a BTN (Base Target Number); never use DC or AC.
- Character Creator races: human, humankin, dwarf, elf, dark-elf, gemp, orc, catfolk, wolffolk, dogfolk, bearfolk, foxfolk, rabbitfolk, lizardfolk, birdfolk, dragonborn, demon, halfling, gnome, fairy. Classes: warrior, tank, mage, wizard, sorcerer, necromancer, rogue, assassin, ranger, ninja, scout, healer, cleric, paladin, bard, beast-tamer, or any other job title (a merchant, a guard captain...).
- Common skills: Melee Weapons, Ranged Weapons, Martial Arts, Parry, Dodge, Archery, Throwing, Athletics, Climbing, Stealth, Swimming, Acrobatics, Endurance, Investigation, Lore, Perception, Insight, Survival, Tracking, Medicine, Nature, Animal Handling, Navigation, Negotiation, Persuasion, Deception, Streetwise, Leadership, Intimidation, Diplomacy, Etiquette, Concentration, Resistance, Engineering, Crafting, Alchemy, Magick Theory, Lock Picking, Trap Detection, Disguise, Forgery, Gambling, Sleight of Hand.
- Creature size: -3 pixie, -2 goblin, -1 catfolk, 0 human, +1 orc or bear, +2 ogre, +3 giant, +4 young dragon, +5 adult dragon, +6 ancient dragon. Threat: Minion, Standard, Elite, Boss or Apex. Big creatures can have STR and CON well above 20 and natural AR above 6.
TXT;

function oracle_sheet_schema(string $kind): array {
    $str = ['type' => 'string']; $int = ['type' => 'integer'];
    $strs = ['type' => 'array', 'items' => $str];
    $stats = ['type' => 'object', 'properties' => array_fill_keys(['int', 'str', 'dex', 'wis', 'con', 'wil', 'cha'], $int),
              'required' => ['int', 'str', 'dex', 'wis', 'con', 'wil', 'cha']];
    $skills = ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['name' => $str, 'level' => $int], 'required' => ['name', 'level']]];
    $spells = ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['name' => $str, 'damage' => $str, 'manaCost' => $int, 'skillLevel' => $int],
               'required' => ['name', 'damage', 'manaCost', 'skillLevel']]];
    if ($kind === 'creature') {
        return ['type' => 'object', 'required' => ['characterName', 'level', 'stats', 'armor', 'skills', 'creature', 'background'],
            'properties' => ['characterName' => $str, 'level' => $int, 'stats' => $stats, 'armor' => $int, 'skills' => $skills, 'spells' => $spells,
                'background' => $str, 'notes' => $str,
                'creature' => ['type' => 'object',
                    'required' => ['type', 'size', 'threat', 'habitat', 'movement', 'senses', 'attacks', 'abilities', 'weaknesses', 'behavior', 'tactics', 'loot', 'magick'],
                    'properties' => ['type' => ['type' => 'string', 'enum' => ['Beast', 'Monstrosity', 'Undead', 'Construct', 'Dragon', 'Elemental', 'Spirit', 'Demon', 'Aberration', 'Plant', 'Insectoid', 'Aquatic', 'Humanoid', 'Other']],
                        'size' => $int, 'threat' => ['type' => 'string', 'enum' => ['Minion', 'Standard', 'Elite', 'Boss', 'Apex']],
                        'habitat' => $str, 'movement' => $str, 'senses' => $str,
                        'attacks' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['name' => $str, 'damage' => $str, 'notes' => $str], 'required' => ['name', 'damage', 'notes']]],
                        'abilities' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['name' => $str, 'text' => $str], 'required' => ['name', 'text']]],
                        'weaknesses' => $strs, 'behavior' => $str, 'tactics' => $str, 'loot' => $str, 'magick' => ['type' => 'boolean']]]]];
    }
    return ['type' => 'object', 'required' => ['characterName', 'race', 'class', 'level', 'stats', 'armor', 'skills', 'advantages', 'disadvantages', 'quirks', 'equipment', 'money', 'background', 'notes'],
        'properties' => ['characterName' => $str, 'race' => $str, 'class' => $str, 'level' => $int, 'stats' => $stats, 'armor' => $int,
            'skills' => $skills, 'advantages' => $strs, 'disadvantages' => $strs, 'quirks' => $strs, 'spells' => $spells,
            'equipment' => $str, 'money' => $str, 'background' => $str, 'notes' => $str]];
}

// What the Session Master asked for, as stored in the chat history (the Oracle's chat shows it short).
function oracle_sheet_request(string $kind, string $details, ?int $level): string {
    $d = trim($details) === '' ? 'none' : trim($details);
    return ($kind === 'creature' ? 'Create a creature character sheet' : 'Create an NPC character sheet')
         . ($level ? " at level $level" : '') . ". Extra details from the Session Master: $d.";
}

function oracle_sheet_prompt(string $kind, string $details, ?int $level): string {
    $ask = oracle_sheet_request($kind, $details, $level);
    if ($kind === 'creature') return $ask . "\n" . <<<'TXT'
Fill in the creature sheet as JSON. Fit the campaign. characterName is what the players would call it.
attacks: 1-4 natural or weapon attacks with dice damage and short notes (reach, poison, the BTN to resist).
abilities: 1-4 special abilities with what they do in play. weaknesses: 0-3 short items.
behavior: how it acts and what it wants; tactics: how it fights and when it flees; loot: what can be taken from it or its lair.
background: two to four sentences of lore. magick: true only if it casts spells (then list them in spells).
TXT;
    return $ask . "\n" . <<<'TXT'
Fill in the NPC sheet as JSON. Fit the campaign and its setting; give the NPC a name that fits.
advantages, disadvantages and quirks: 1-3 each, short names (for example "Night Vision", "Greed", "Formal speech patterns").
equipment and money: short lists. background: three to five sentences, including what they want and one secret.
notes: how the Session Master can play them (voice, manner) and one hook. spells only if they use magick.
TXT;
}
