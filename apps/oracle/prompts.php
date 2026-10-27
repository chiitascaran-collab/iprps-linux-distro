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
