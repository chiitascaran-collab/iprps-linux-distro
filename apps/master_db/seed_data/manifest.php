<?php
/**
 * Bundled starter datasets → target module.
 * Used by master_api.php action=seedImport (admin only).
 * Add a line here to make a new file one-click importable.
 */
return [
    ['file' => 'bestiary_creatures.json',      'module' => 'bestiary',    'label' => 'Bestiary — Creature List Four'],
    ['file' => 'grimoire_defense_spells.json', 'module' => 'grimoire',    'label' => 'Grimoire — Defense Spells (125)'],
    ['file' => 'gear_classes.json',            'module' => 'gear',        'label' => 'Gear — Class Loadouts'],
    ['file' => 'flora_fauna_harvest.json',     'module' => 'flora_fauna', 'label' => 'Flora & Fauna — Harvest Crops'],
    ['file' => 'weapons_list_1100.json',       'module' => 'weapons_physical', 'label' => 'Weapons — Master List (1100)'],
    ['file' => 'gear_ancient_civilizations.json','module' => 'gear',       'label' => 'Gear — Ancient Civilization Loadouts'],
    ['file' => 'traps_advanced.json',          'module' => 'traps',       'label' => 'Dungeon Traps — Advanced Collection'],
    ['file' => 'traps_elemental.json',         'module' => 'traps',       'label' => 'Dungeon Traps — Elemental Collection'],
];
