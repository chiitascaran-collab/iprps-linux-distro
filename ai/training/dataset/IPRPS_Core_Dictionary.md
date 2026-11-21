# IPRPS Core Dictionary

Core terms of the Infinite Plane Role Playing System, from the First Edition rulebook, the Master AI Profile v6.0 and the hand-checked core concepts of the IPRPS Glossary.

## Architecture & Session Control

- **IPRPS** — Infinite Plane Role Playing System. The tabletop and AI-run role-playing system published by Mythical Legends Publishing, LLC, set on the Infinite Plane disc.
- **Infinite Plane** — A constructed disc-world built by the Necronian Elder Adruqu as an alternate reality for reincarnated souls drawn from Earth and other worlds. 700,000 km in diameter, 650 km thick, about 1,265 light-years from Earth, with ~500 million sapient inhabitants in 500 regions and ~65 clusters.
- **Session Master (SM)** — The person (or AI) who runs an IPRPS game session: sets the scene, adjudicates rolls, voices NPCs and selects the combat mode. IPRPS's term for a game master.
- **IPSM-AI** — Infinite Plane Session Master AI (pronounced "IPS-MY"). The AI persona that acts as Session Master or co-referee, lore-keeper and rules expert. Also a legacy command prefix, normalized to ^.
- **Master AI Profile** — Tier 1 of the AI architecture. The permanent foundational document holding all core rules, formulas, combat systems, species and world constants. Never deleted; every other layer builds on it. Current version 6.0.
- **AI Profile** — A text document that instructs an AI model how to behave in an IPRPS session: its role, rules, tone and procedures.
- **Profile Patch (Campaign Patch)** — Tier 2 of the AI architecture. An expansion document (numbered Parts 51–99+) that adds a world, era, culture or system on top of the Master Profile. Swappable per campaign; the last patch applied overrides overlapping sections of earlier ones.
- **Part (numbered patch)** — The numbering used for Profile Patches, e.g. Part 74 (Genre Overlay), Part 84 (Session Zero), Part 96 (Character Forge), Part 97 (NPC Personality Engine), Part 99 (Trigger Weave).
- **Overlay** — A patch that sits on top of whatever campaign is loaded and adds mechanics, tone or behavior without replacing the setting. Activated by a phrase such as "Overlay: <name>" and suspended with "Overlay suspended — return to base flavor."
- **Trigger Overlay** — A passive background overlay that monitors session events and injects content when trigger conditions are met. Example: the Whoo hoo! Bird.
- **Session Run Patch (.srpatch)** — Tier 3 of the AI architecture. The SM's mission briefing for a session or arc: objectives, pacing, NPCs, milestones and scenario design. IDs follow the form SRP-YYYY-NAME-###.
- **Capstone (.capstone)** — Tier 4A of the AI architecture. The SM's persistent world HUD: party status, NPC dispositions, conditions, inventory, quests, combat state, SM notes and session summary. Updated continuously and read by the AI before every response.
- **Player Capstone (.pcapstone)** — Tier 4B of the AI architecture. One character's live HUD and sheet: attributes, HP/MP, inventory, active effects and notes.
- **Session HUD** — A status block prepended to AI responses. It shows the scene, location, time pressure, tension, players and NPCs in focus, conditions, risks, outstanding choices and the last significant change.
- **.ipai** — File extension for IPRPS AI instruction files (profiles, patches and machine-ingestion versions). Related extensions: .iprps (character files), .srpatch, .capstone, .pcapstone.
- **Living Session Master (LSM)** — A patch (iprps.patch.lsm.v1) that gives the AI full Session Master autonomy for 1–8 players. It runs with a required HUD, archives and summaries, autosave, spotlight equalization and anti-stall behavior.
- **Autonomous Master** — The fully autonomous AI Session Master defined in the autonomous_master patch/omnibus. It runs sessions with a human Field Assistant who approves transmissions.
- **Field Assistant** — The human helper in Autonomous/Living Session Master play. Relays, approves or modifies the AI's messages to players.
- **Patch Loader** — A lightweight, always-on utility patch that manages other patches: list, load, unload, enable, disable and inspect, without taking over play.
- **Cerebrum** — The patch registry/loader system that tracks patches in a Manifest with filename, type, tier, dependencies, conflicts, tags and estimated token cost. Initialized with commands such as ^cerebrum.quickstart.
- **Scene Orchestrator** — An AI profile (v1.3.0) that acts as a structured scene interpreter, quest-lane scheduler and persistent JSON state writer, storing lane and scheduler state under /data so the app and AI share durable state across turns. An extended version adds autonomous session direction, auto lane tagging and end-of-session wrap-up.
- **Eternal Session Sovereign** — Part 78. An overlay that transfers Session Master authority to the AI. Deactivation (Sovereign Protocol) returns control to the human SM immediately.
- **Session Zero** — Part 84. Onboarding patch: walkthrough and quickstart for new Session Masters and players before the campaign begins.
- **SM Command Language (^)** — Commands the Session Master types with the ^ prefix to control the AI (e.g. ^save, ^ windset, ^ moonset, ^ rp_retire). Normalizes legacy IPSM-AI commands.
- **Player Command Language (&)** — Commands players type with the & prefix, for example to view their own Player Capstone.
- **Unified Command Language** — Version 4 of the merged SM (^) and Player (&) command sets.
- **Genre Overlay** — Part 74. Adds genre-specific narrative mechanics (Mystery, Horror, Action, Fantasy, Drama) on top of any campaign, each tracked with its own track.
- **Revelation Track** — Genre Overlay (Mystery) track measuring investigative progress from 0 — Ignorance through Suspicion, Investigation and onward as clues are found.
- **Dread Track** — Genre Overlay (Horror) track measuring the party's psychological state through five stages, starting from 0 — Calm (then Unease, etc.), with growing mechanical penalties.
- **Momentum Track** — Genre Overlay (Action) track measuring tempo and energy, e.g. the roar of an arena crowd.
- **Wonder Track** — Genre Overlay (Fantasy) track measuring how deeply the party has engaged with the world's fantastical elements.
- **Stakes Track** — Genre Overlay (Drama) track measuring what characters stand to lose.
- **Trigger Weave** — Part 99. A system of trigger conditions (e.g. message arrives, food spoils, communication fails) that fire narrative events.
- **AI Response Personality Override** — SM-selectable speaking styles for the AI that don't alter world logic: Help Dad, Dry Humor, Professional, Actor, Comedian, Flamboyant, Depressed Android, Noir, Royal We, Flirtatious, Seductive, Submissive, Neutral, Engaging, Eager, Curious, Boyfriend/Girlfriend.
- **Game Tone (Difficulty Scale)** — Seven difficulty levels: Easy, Moderate, Default, Hard (social BTNs +2), Extreme (social BTNs +4), Hell Mode and Abandon Hope.
- **Solo Player Mode** — Rules for one-player games: Player-Support Bias, Failure Is an Opportunity (rolls of 1–6 redirect rather than halt), and Encounter Scaling.

## Core Mechanics

- **d20** — The primary IPRPS resolution die, used for all skill checks, success rolls, combat rolls and effectiveness determinations.
- **Base Target Number (BTN)** — The threshold a roll must meet or exceed. Replaces Difficulty Class (DC), which IPRPS prohibits.
- **Guard Value** — A defender's number that an attack total must equal or exceed to hit in opposed checks and combat.
- **Armor Rating (AR)** — Direct damage reduction (Damage − AR). Replaces Armor Class (AC). AR is NOT a threshold to hit.
- **Prohibited Mechanics** — DC (Difficulty Class) and AC (Armor Class) are never used in IPRPS. They are replaced by BTN/Guard Value and Armor Rating.
- **Success Bands (Band System A)** — The three-zone reading of a d20 result: 1–6 Failure, 7–12 Zone of Uncertainty (the SM decides partial success, success with consequences, or failure with some benefit), 13–20 Success. In the First Edition rulebook, damage is then scaled by a separate Effectiveness Roll (13–20 full, 7–12 half, 1–6 quarter). In the Master AI Profile v6.0, the same bands double as damage multipliers (×0.25, ×0.50, ×1.00).
- **Effectiveness Bands (Band System B)** — The four-tier degree-of-success reading of the raw d20: 1–6 Weak, 7–14 Standard, 15–19 Strong, 20 Peak. The standard for all Profile Patches.
- **Weak (band)** — Effectiveness Band 1–6: minimal effect. Quarter damage, the spell fizzles, the social attempt offends.
- **Standard (band)** — Effectiveness Band 7–14: competent execution, normal result.
- **Strong (band)** — Effectiveness Band 15–19: exceptional execution. Full damage plus bonus effects.
- **Peak (band)** — Effectiveness Band 20: perfect execution and the best possible outcome. Maximum damage.
- **Zone of Uncertainty** — Success Band 7–12. Ambiguous result; the SM chooses partial success, success with consequences, or failure with some benefit.
- **Skill Check Formula** — Skill Check Total = 1d20 + Skill Shift + Attribute Shift, compared against BTN or Guard Value.
- **Skill Shift** — FLOOR(Skill ÷ 10). The bonus a skill (0–100) adds to a roll.
- **Attribute Shift** — The bonus or penalty an attribute adds to a skill check. First Edition rulebook: Attribute − 10, clamped by the Attribute Shift Table (1 → −3, 5 → −2, 8–9 → −1, 10 → 0, 11–12 → +1, 15 → +2, 20 → +3, 50 → +4, 100 → +5). Master AI Profile v6.0: Attribute − 10 without clamping.
- **Shift Roll** — A d20 roll read on the Effectiveness Band.
- **Complete newbie (proficiency tier)** — Proficiency (Skill Level + attributing attribute) of 0 or less.
- **Some competency (proficiency tier)** — Proficiency (Skill Level + attributing attribute) of 1–9.
- **Competent (proficiency tier)** — Proficiency (Skill Level + attributing attribute) of 10–12.
- **Highly trained (proficiency tier)** — Proficiency (Skill Level + attributing attribute) of 13–15.
- **Expert (proficiency tier)** — Proficiency (Skill Level + attributing attribute) of 16–20.
- **Genius (proficiency tier)** — Proficiency (Skill Level + attributing attribute) of 21–30.
- **Extraordinary (proficiency tier)** — Proficiency (Skill Level + attributing attribute) of 31–50+.

## Character Building

- **Development Points (DP)** — The character-building currency (also "Character Points"). Budgets: Average 30–70, Competent 70–100, Heroic 150–250, Legendary/Divine 300–1000+.
- **Ascendant Economy** — The DP-based character-building system.
- **Seven Basic Attributes** — STR (Strength), DEX (Dexterity), CON (Constitution), INT (Intelligence), WIS (Wisdom), CHA (Charisma), WIL (Willpower). Human average is 10. DEX and INT cost 10 DP/level, the others 5. Lowering below 10 refunds 2 DP/level.
- **Strength (STR)** — Physical power, carrying capacity, melee damage. 5 DP/level.
- **Dexterity (DEX)** — Agility, reflexes, ranged accuracy, initiative. 10 DP/level.
- **Constitution (CON)** — Endurance, health, poison resistance, HP foundation. 5 DP/level.
- **Intelligence (INT)** — Reasoning, memory, arcane aptitude, mana foundation. 10 DP/level.
- **Wisdom (WIS)** — Perception, intuition, environmental awareness. 5 DP/level.
- **Charisma (CHA)** — Social influence, leadership, persuasion, appearance. 5 DP/level.
- **Willpower (WIL)** — Mental discipline, fear resistance, mana control, psychic defense. 5 DP/level.
- **Hit Points (HP)** — 50 + (CON × 10) + (LEVEL × 5), where LEVEL is the Job Class level.
- **Mana Pool (MP)** — ((d1000 × HP + INT/3) + (Race Modifier × 100)) × 3. The d1000 is rolled once at creation and is permanent (innate mana capacity).
- **Basic Speed** — (DEX + CON) / 4. Drop decimals; round up only if the remainder is ≥ 0.85.
- **Dodge** — Basic Speed + ((DEX − 10) / 2). Active defense against attacks.
- **Will Save** — Equal to INT. Resistance to psychic effects, fear and mana corruption.
- **Perception** — Equal to INT. Baseline awareness, modified by WIS in specific checks.
- **Threat Rating (TR)** — (Avg Combat Attributes + Best Combat Skill) + Size Mod + Equipment Bonus. Used for encounter scaling and NPC threat assessment.
- **Ascendant Scale** — The 0–100 skill scale: 0 Untrained, 10 Average professional (+1), 20 Expert, 30 Master, 40 Grandmaster, 50 Legendary, 60–100 Mythic (+6 to +10). 57 skills in six categories: Combat, Physical, Mental, Social, Craft, Wilderness.
- **Advantages** — Positive traits bought with DP (e.g. Acute Senses, Combat Reflexes, Magick Affinity, Eidetic Memory). No cap.
- **Disadvantages** — Flaws that return DP (e.g. Phobias, Code of Honor, Bad Temper, Debt, Enemy). Capped at half the starting DP total.
- **Quirks** — Minor habits, prejudices or tics worth exactly −1 DP each. Maximum 5.
- **Character Forge** — Part 96. The definitive character-creation reference: skills, advantages, disadvantages, quirks, formulas and point costs.
- **Technology Level (TL)** — The technology scale from TL 1 (Primitive) to TL 9 (Post-Singularity). Low TL is −5 pts/level below the campaign TL; High TL is +5 pts/level above it.
- **Size Tier** — Size from −3 (pixies) to +6 (ancient dragons). Each step adjusts damage by ±2, grapple by ±1 and Mana Pool by ±100.

## Combat Systems

- **Five Combat Systems** — The five combat resolution modes the SM chooses per encounter: Standard, Trinity, Rock-Paper-Scissors, Dual-Die and Infinite Convergence. Characters are unchanged between modes.
- **Standard Combat (Mode 1)** — Turn-based tactical combat: Initiative (d20 + DEX Shift) → Attack (1d20 + Skill Shift + Attribute Shift) → defender's Dodge → damage. First Edition rulebook: after a hit, roll a separate Effectiveness Roll (13–20 full, 7–12 half, 1–6 quarter) and subtract Armor Rating. Master AI Profile v6.0: Damage = (Weapon Dice + STR mod) × the Effectiveness Band of the attack roll − AR.
- **Trinity Combat (Mode 2)** — Boss and deep tactical combat where combatants roll The Hand simultaneously. Fastest Velocity strikes first; Impact Total vs Guard Total decides the hit.
- **The Hand** — Trinity's three-die roll: 1d3 Velocity Die (strike order), 1d20 Impact Die (attack power), 1d12 Guard Die (active defense). Total = Die + Attribute + Skill.
- **Velocity Die** — 1d3 in Trinity Combat: 3 Fast, 2 Normal, 1 Slow.
- **Impact Die** — 1d20 in Trinity Combat. Attack power; its raw value sets the Effectiveness Band.
- **Guard Die** — 1d12 in Trinity Combat. Active defense.
- **Hydra Hand** — The Trinity boss variant: one Impact die per attack (e.g. 1d3 + 3d20 + 1d12 for a dragon with three attacks).
- **Titan Hand** — The Trinity boss-vs-boss variant: both roll 1d3 Velocity, 1d12 Guard and 2d20 Impact, getting two attacks each.
- **Rock-Paper-Scissors Combat (Mode 3)** — Fast narrative skirmishes on the Eternal Triangle (Rock beats Scissors, Paper beats Rock, Scissors beats Paper). First Edition rulebook (Mode A): the winner deals damage × 1.5 and the loser × 0.5; on a tie both deal normal damage; defense is subtracted. Master AI Profile v6.0 (Mode 3): the winner deals Base Damage × 1.5 − Defense, a tie means both deal × 0.5, and the loser deals nothing.
- **Eternal Triangle** — Rock (Heavy/Defensive) beats Scissors (Precision/Melee), Scissors beats Paper (Magical/Ranged), Paper beats Rock.
- **Dual-Die Combat (Mode 4)** — Gritty wound-based combat: 1d20 + Attribute + Skill vs Guard Value, then 1d6 Impact on a hit. First Edition rulebook (Mode C): Impact 1–2 Glancing (×0.25), 3–4 Solid (×0.50), 5–6 Critical (×1.00) damage, with Light, Serious and Critical Wounds triggered by hits of at least 1/4 (or 1/2) of max HP. Master AI Profile v6.0 (Mode 4): Impact 1–2 Glancing (−1 to next action), 3–4 Solid (−2 for 1d6 rounds, bleeding), 5–6 Critical (incapacitated unless CON Effectiveness 15+).
- **Infinite Convergence (Mode 5)** — Single-roll decisive combat for duels, chases and climaxes. Each side picks a Blur Level die; the die maximum caps the skill bonus; the highest total wins outright.
- **Blur Level** — Infinite Convergence fighting-style die: Glacial 1d50, Heavy 1d30, Balanced 1d20, Rapid 3d8, Flurry 6d4.
- **Mass Combat Tiers** — Skirmish 10–49 (individual turns), Swarm 50–999 (wave actions), Horde 1,000–9,999 (block control), Army 10,000–100,000 (division strategy).
- **Hero Decimation** — At Horde/Army scale, a hero's massive strike kills 10–50 creatures in one swing instead of tracking individual HP.
- **Morale Penalty** — −1 to all rolls per 25% casualties (75% casualties = −3).

## NPCs, Dungeons & World Systems

- **Disposition Scale** — NPC attitude from −100 to +100: Hateful, Hostile, Cold, Wary, Neutral (0), Warm, Friendly, Trusting, Devoted.
- **Five Core Inputs** — NPC evaluation inputs, each −3 to +3: Species Bias Index, Class Threat Index, Social Position Index, Reputation Memory, Personal Attention Vector.
- **Behavioral Axes** — Six NPC scales: Disposition, Confidence, Sociability, Impulse Control, Attachment Style, Ethical Frame.
- **Reputation Tags** — Memory tags NPCs store about characters: Competent, Dangerous or Untrustworthy. They persist via the Capstone.
- **Escalation Triggers** — Events that raise NPC tension: Visible Magic Signature +2, Blood Scent +3, Open Loot Display +2, Authority Challenged +3, Weapons Drawn +4.
- **Five Signals** — Party-generated signals a living dungeon tracks: Noise Spike (NS), Magic Signature (MS), Blood Scent (BS), Loot Disturbance (LD), Time Drift (TD).
- **Response Budget (Threat Budget)** — (NS + MS + BS + LD + TD) / 3. Points the dungeon spends each round on traps, spawns and hazards.
- **Pattern Lock** — When the same spell or school is used 3 times in 5 rounds, the dungeon grants enemies advantage against that magic.
- **Scar Flag** — Casting forbidden or necromantic spells permanently raises the dungeon's Threat Budget until the party leaves.
- **Creature-to-Boss Lifecycle** — Seven stages by which a dungeon evolves a boss: Surface Entry, Environmental Adaptation, Territorial Imprinting, Ecological Dominance, Node Symbiosis, Final Boss State, Post-Defeat Cascade.
- **Enemy Brains** — Boss AI types: Predator, Hunter-Killer, Ward Breaker, Swarm, Sentinel.
- **Visual Mutation Markers** — Visible signs of nanotech and mana exposure on dungeon creatures (fire-, wind-, earth-, water-influenced, multi-element, boss proximity).
- **Guard Response System** — City-guard response time set by Position, Standing and Reputation. During siege or disaster, Position dominates.
- **Hybrid Fertility Index (HFI)** — (Genetic Proximity × 0.4) + (Nanyte Interface × 0.35) + (Mana Resonance × 0.25). Ranges from Incompatible (0) to Fully Compatible (80–100).
- **Pet Behavior Engine** — Pet stats on a 1–5 scale (Bond, Training, Temperament, Courage, Hunger, Sensitivity) and states (Calm, Alert, Playful, Protective, Fearful, Aggressive, Hungry, Injured).
- **Slime Evolution** — Slimes evolve by diet: Poison, Arcane and Metal slimes. Starving a slime limits evolution but raises aggression.

## World, Lore & Magick

- **Necronians** — An ancient civilization (~3 million years old) that achieved immortality, galaxy-wide travel and mastery of time, space and nanotechnology. They administer the Infinite Plane disc.
- **Adruqu** — The Necronian Elder (over 100,000 years old) who built the Infinite Plane. The disc's Overlord Goddess, worshipped as the Mother Goddess. Established the IP²TC.
- **Nanytes** — Necronian nanotechnology permeating all matter on the disc. The source of Magick: they make the impossible obey physics.
- **Magick** — IPRPS spelling of magic. On the Infinite Plane, magick is Necronian nanotechnology interacting with the disc's infrastructure.
- **Mana** — Magickal energy drawn on for spellcasting, measured by the Mana Pool (MP).
- **Higgs Boson Wave Generators** — Disc infrastructure that, with ultra-dense exotic materials, keeps gravity at 0.88g and stops the disc collapsing into a sphere.
- **Region / Cluster** — The disc's political-geographic divisions: 500 regions (~1 million people each) grouped into ~65 clusters, from the core to the Rim Zone (Clusters 61–65).
- **Numismata Plani Infiniti** — The disc's currency of eight circular coins: Lignum (wood, ~$0.05), Ferrum (iron, $0.50), Chalybs (steel, $5), Argentum (silver, $50), Aurum (gold, $500), Titanus (titanium, $5,000), Corona (platinum, $50,000), Aeternum (aetheric crystal, $500,000+).
- **Old Arcane (Veth'Thaan)** — The academic runic script (27 glyphs, Base-9), synthesized from Dragon Flame-Script and Fairy Bloom-Script. Covers all five magical channels.
- **Paradox Index (PI)** — Tracks timeline damage from machine time travel. Backward jumps raise it; PI 20+ = Timeline Annihilation.
- **Paradox Debt** — The chronomancy equivalent of the Paradox Index: spiritual weight on the caster. Debt 20 = Temporal Dissolution (erased from history).
- **Chronomancy** — Part 70. Magick-based time travel by a Temporal Weaver using the Mana Pool and the Chronomantic Tongue.
- **Gyro-Magnetic Relativistic Time Travel** — Part 62. Dieselpunk time machines using counter-rotating tungsten flywheels (TL 6+).
- **IP²TC** — Infinite Plane Time Travel Coordinators. Temporal law enforcement established by Adruqu; prohibits pre-Disc and post-1950s travel.
- **Beastfolk** — The collective term for the animal-folk species (Catfolk, Wolffolk, Bearfolk, Birdfolk, Rabbitfolk, etc.), 65% of a standard city's population.
- **Gemps** — Genetically Engineered ChiMPs (not crystalline). Size −1, INT 18; brilliant bureaucrats, field medics and investigators with a three-tier cognitive architecture.
- **Lilitu** — The demon species (Demons). Psychological warfare, blood magick, a contract-based society.
- **Angelicus** — An indefinitely lived holy species: radiant damage and healing-offensive dual capability.
- **Whoo hoo! Bird** — A colorful bird native to the disc, used by the Whoo hoo! Bird Trigger Overlay as passive session punctuation. Its absence signals that something is deeply wrong.

## Currency

- **Lignum** — Tier 1 coin of the Numismata Plani Infiniti: treated hardwood token, worth about $0.05. Typical purchase: bread, candle, basic supplies.
- **Ferrum** — Tier 2 coin of the Numismata Plani Infiniti: iron coin, worth about $0.50. Typical purchase: ale, simple meal, common tools.
- **Chalybs** — Tier 3 coin of the Numismata Plani Infiniti: steel coin, worth about $5.00. Typical purchase: quality tools, a day's skilled labor.
- **Argentum** — Tier 4 coin of the Numismata Plani Infiniti: silver coin, worth about $50.00. Typical purchase: fine weapons, a horse, professional services.
- **Aurum** — Tier 5 coin of the Numismata Plani Infiniti: gold coin, worth about $500.00. Typical purchase: a house, a business, a minor magical item.
- **Titanus** — Tier 6 coin of the Numismata Plani Infiniti: titanium coin, worth about $5,000.00. Typical purchase: airships, estates, rare enchantments.
- **Corona** — Tier 7 coin of the Numismata Plani Infiniti: platinum coin, worth about $50,000.00. Typical purchase: nobility budgets, military contracts, regional investments.
- **Aeternum** — Tier 8 coin of the Numismata Plani Infiniti: aetheric-infused crystal, worth about $500,000.00+. Typical purchase: kingdoms, world-scale transactions, divine artifacts.

## Species

- **Humans** — Size 0, base lifespan 80 yrs, Base-10 numbers, script Common (26 glyphs). Typical attributes STR 10, DEX 10, CON 10, INT 10, WIS 10, CHA 10, WIL 10. Adaptive baseline. All combat systems. Largest total population (~75M).
- **Elves** — Size 0, base lifespan 700 yrs, Base-12 numbers, script Tirith Elenath (24 glyphs). Typical attributes STR 8, DEX 14, CON 8, INT 14, WIS 12, CHA 14, WIL 12. High magic affinity. Twelve-tone temporal mathematics. Hear time as music (+2 Chronomancy).
- **Dwarves** — Size 0, base lifespan 350 yrs, Base-8 numbers, script Khazad-Run (16 glyphs). Typical attributes STR 14, DEX 8, CON 16, INT 10, WIS 12, CHA 8, WIL 14. Forge mastery. Tunnel warfare. Endurance. Temporally "heavy" (+2 Anchor creation, −1 displacement).
- **Catfolk** — Size −1, base lifespan 90 yrs, Base-20 numbers, script Mrr-Keth (microscopic, moon-reactive). Typical attributes STR 8, DEX 16, CON 10, INT 12, WIS 14, CHA 14, WIL 10. Stealth, ambush, night vision. Fluid social structures. Fastest reflexes.
- **Wolffolk** — Size 0, base lifespan 70 yrs, Base-7 numbers, script Varn'Aul (14 glyphs). Typical attributes STR 14, DEX 12, CON 14, INT 8, WIS 14, CHA 10, WIL 12. Pack tactics. Endurance pursuit. Enhanced senses. Pack-resonance magick amplification.
- **Bearfolk** — Size +1, base lifespan 100 yrs, Base-5 numbers, script Ursa-Mark (10 glyphs). Typical attributes STR 18, DEX 6, CON 16, INT 8, WIS 12, CHA 8, WIL 14. Immense strength. Shock troops. Solitary or small family. Temporally anchored (−2 Chronomancy).
- **Birdfolk** — Size −1, base lifespan 60 yrs, Base-6 numbers, script Lyr-Avis (12 glyphs). Typical attributes STR 6, DEX 16, CON 8, INT 12, WIS 14, CHA 14, WIL 10. Aerial reconnaissance. Tonal magick (singing = casting). ~100% casual casters.
- **Rabbitfolk** — Size −1, base lifespan 50 yrs, Base-12 numbers, script Thuun'Skritt (24 glyphs). Typical attributes STR 6, DEX 16, CON 10, INT 12, WIS 14, CHA 12, WIL 10. Fastest species. Defensive tunnel warfare. Ward magick inscription in under 3 seconds.
- **Demons (Lilitu)** — Size 0, base lifespan Indefinite, Base-6 numbers, script Khar-Vexis (18 glyphs). Typical attributes STR 12, DEX 12, CON 12, INT 14, WIS 10, CHA 16, WIL 8. Psychological warfare. Blood magick. Contract-based society. +2 backward time displacement, −2 Paradox resistance.
- **Orcs** — Size +1, base lifespan 60 yrs, Base-8 numbers, script Krash-Glot (12 glyphs). Typical attributes STR 18, DEX 10, CON 16, INT 6, WIS 8, CHA 8, WIL 12. Overwhelming aggression. Berserker charges. 92% warrior population. No retreat doctrine.
- **Goblins** — Size −2, base lifespan 40 yrs, Base-6 numbers, script Skrit-Scratch (8 glyphs). Typical attributes STR 6, DEX 14, CON 8, INT 10, WIS 12, CHA 10, WIL 6. Ambush, sabotage, traps. Expendable scouts. Loyal to whoever is winning.
- **Dragonkin** — Size +4 (young) / +5 (adult) / +6 (ancient), base lifespan 5,000+ yrs, Base-20 numbers, script Threnn'Veth'Gorr (40 glyphs). Typical attributes STR 26+, DEX 10, CON 24+, INT 18+, WIS 16, CHA 14, WIL 18. Aerial superiority. Breath weapons. Semi-temporal beings (+4 Chronomancy). Apex magical casters.
- **Fairies** — Size −3, base lifespan 200 yrs, Base-6 numbers, script Lys'Veth'Ael (36 glyphs). Typical attributes STR 2, DEX 18, CON 4, INT 14, WIS 14, CHA 16, WIL 8. Dust-mediated innate casting. Bloom-Script. Near-impossible to hit. +3 displacement, −3 Paradox resistance.
- **Insectoids** — Size −2 to +2, base lifespan 5–30 yrs (workers) / Indefinite (Queen), Varies numbers, script Chemical/Pheromone. Typical attributes STR 12–18, DEX 14, CON 16, INT 4–14 (by caste), WIS 8, CHA 4, WIL 14. Hive warfare. Perfect coordination. Expendable individuals. Zero hybrid compatibility with non-Insectoids.
- **Merfolk** — Size 0, base lifespan 120 yrs, Base-8 numbers, script Tidal-Script (20 glyphs). Typical attributes STR 12, DEX 14, CON 14, INT 12, WIS 12, CHA 12, WIL 10. Aquatic superiority. Naval control. TR 16–22 in water, TR 8 on land without adaptation.
- **Lamia** — Size +1, base lifespan 150 yrs, Base-6 numbers, script Serpent-Glyph (14 glyphs). Typical attributes STR 16, DEX 14, CON 14, INT 12, WIS 14, CHA 14, WIL 10. Constriction, venom, heat-sensing. Night operations. Serpentine agility.

## Character Creation

- **Feeble (point tier)** — A starting budget of < 30 Development Points: children, helpless dependents, mindless servants.
- **Average (point tier)** — A starting budget of 30–70 Development Points: everyday people: clerks, drivers, laborers.
- **Competent (point tier)** — A starting budget of 70–100 Development Points: trained or experienced individuals with a clear edge.
- **Exceptional (point tier)** — A starting budget of 100–150 Development Points: highly trained professionals and standout performers.
- **Heroic (point tier)** — A starting budget of 150–250 Development Points: peak of realistic achievement in physical, mental, or social fields.
- **Larger than Life (point tier)** — A starting budget of 250–300 Development Points: central figures suited for cinematic or mythic stories.
- **Legendary (point tier)** — A starting budget of 300–500 Development Points: icons of epic tales, folklore, and grand sagas.
- **Blessed (point tier)** — A starting budget of 500–700 Development Points: blessed by adruqu with extraordinary abilities.
- **Divine (point tier)** — A starting budget of 1,000–2,000 Development Points: deity level; tremendous power, can level towns and cities.
- **Dead Broke (wealth level)** — Wealth trait worth -20 points: owns nothing beyond what is carried.
- **Poor (wealth level)** — Wealth trait worth -15 points: 1/5 average starting wealth; limited jobs.
- **Struggling (wealth level)** — Wealth trait worth -10 points: half average wealth; income barely covers needs.
- **Average (wealth level)** — Wealth trait worth 0 points: baseline wealth level for the setting.
- **Comfortable (wealth level)** — Wealth trait worth +15 points: higher quality of life; 2× average starting wealth.
- **Wealthy (wealth level)** — Wealth trait worth +40 points: lives well; 5× average starting wealth.
- **Very Wealthy (wealth level)** — Wealth trait worth +50 points: extensive financial freedom; 20× average.
- **Filthy Rich (wealth level)** — Wealth trait worth +70 points: vast resources; 100× average.
- **Mega Rich (wealth level)** — Wealth trait worth +90 points: worth of a small country.
- **Ultra Rich (wealth level)** — Wealth trait worth +100 points: worth of a medium country; governments seek you out.
- **Uber Rich (wealth level)** — Wealth trait worth +200 points: the region is your piggy bank; own everything.
- **Royalty (wealth level)** — Wealth trait worth +500 points: own everything, receive taxes, considered royalty.
- **Hideous (appearance)** — Appearance trait worth -10 points; reaction modifier -5. Provokes strong disgust.
- **Ugly (appearance)** — Appearance trait worth -6 points; reaction modifier -3. Clearly unpleasant.
- **Unattractive (appearance)** — Appearance trait worth -4 points; reaction modifier -1. Mildly off-putting.
- **Average (appearance)** — Appearance trait worth 0 points; reaction modifier 0. Default; no modifier.
- **Attractive (appearance)** — Appearance trait worth +5 points; reaction modifier +2. Stands out as good-looking.
- **Handsome/Beautiful (appearance)** — Appearance trait worth +10 points; reaction modifier +3/+5. +5 from attracted, +3 from others.
- **Very Handsome/Beautiful (appearance)** — Appearance trait worth +15 points; reaction modifier +5/+8. +8 from attracted, +5 from others.
- **None (-1 pt) (language)** — Cannot understand or speak the language at all.
- **Broken (1 pt) (language)** — Basic communication; -2 penalty on language-dependent skills.
- **Heavy Accent (2 pts) (language)** — Communicates clearly with minor errors; -1 penalty.
- **Light Accent (3 pts) (language)** — +1 on Charisma and Persuasion rolls.
- **Native (5 pts) (language)** — Fluent, educated speaker. One native language is free.

## Skills

- **Instinctual (skill rank)** — Skill levels 0 on the Ascendant Scale. Each level in this range costs 0 DP; reaching the end of the range costs 0 DP in total.
- **Natural (skill rank)** — Skill levels 1–3 on the Ascendant Scale. Each level in this range costs 1 DP; reaching the end of the range costs 3 DP in total.
- **Competent (skill rank)** — Skill levels 4–9 on the Ascendant Scale. Each level in this range costs 2 DP; reaching the end of the range costs 15 DP in total.
- **Average (skill rank)** — Skill levels 10 on the Ascendant Scale. Each level in this range costs 5 DP; reaching the end of the range costs 20 DP in total.
- **Honed (skill rank)** — Skill levels 11–14 on the Ascendant Scale. Each level in this range costs 3 DP; reaching the end of the range costs 32 DP in total.
- **Exceptional (skill rank)** — Skill levels 15 on the Ascendant Scale. Each level in this range costs 10 DP; reaching the end of the range costs 42 DP in total.
- **Elite (skill rank)** — Skill levels 16–19 on the Ascendant Scale. Each level in this range costs 5 DP; reaching the end of the range costs 62 DP in total.
- **Heroic (skill rank)** — Skill levels 20 on the Ascendant Scale. Each level in this range costs 15 DP; reaching the end of the range costs 77 DP in total.
- **Master (skill rank)** — Skill levels 21–49 on the Ascendant Scale. Each level in this range costs 10 DP; reaching the end of the range costs 367 DP in total.
- **Demigod (skill rank)** — Skill levels 50 on the Ascendant Scale. Each level in this range costs 50 DP; reaching the end of the range costs 417 DP in total.
- **Mythic (skill rank)** — Skill levels 51–99 on the Ascendant Scale. Each level in this range costs 20 DP; reaching the end of the range costs 1,397 DP in total.
- **Divine (skill rank)** — Skill levels 100 on the Ascendant Scale. Each level in this range costs 100 DP; reaching the end of the range costs 1,497 DP in total.

## Social

- **Disastrous (reaction)** — Reaction Roll result of 0 or less on the d20 after modifiers. The NPC: betrayal, violence, or deliberate sabotage.
- **Very Bad (reaction)** — Reaction Roll result of 1–4 on the d20 after modifiers. The NPC: strongly dislikes pcs; works against them when possible.
- **Bad (reaction)** — Reaction Roll result of 5–8 on the d20 after modifiers. The NPC: indifferent/hostile; helps only for clear personal gain.
- **Poor (reaction)** — Reaction Roll result of 9–11 on the d20 after modifiers. The NPC: little interest; suspicion, delays, unreasonable demands.
- **Neutral (reaction)** — Reaction Roll result of 12–14 on the d20 after modifiers. The NPC: detached; business proceeds if customs are followed.
- **Good (reaction)** — Reaction Roll result of 15–17 on the d20 after modifiers. The NPC: favorable; provides reasonable assistance.
- **Very Good (reaction)** — Reaction Roll result of 18–19 on the d20 after modifiers. The NPC: respect; generous help, fair deals, useful information.
- **Excellent (reaction)** — Reaction Roll result of 20+ on the d20 after modifiers. The NPC: strong admiration/loyalty; acts in pcs' best interest at personal risk.

## Size

- **Size -3** — Size tier for creatures Under 2 ft tall (Pixies, small spirits). Attack -3, reach -2, HP -50%. Hard to hit.
- **Size -2** — Size tier for creatures 2–4 ft tall (Goblins, small insectoids). Attack -2, reach -1, HP -30%. Agile but fragile.
- **Size -1** — Size tier for creatures 4–5 ft tall (Cat Beastfolk, small reptilians). Attack -1, reach 0, HP -15%. Quick, lower mass.
- **Size 0** — Size tier for creatures 5–7 ft tall (Humans, Elves, Dragonoids). Attack 0, reach 0, HP 0. Baseline.
- **Size +4** — Size tier for creatures 30–60 ft tall (Young dragons). Attack +4, reach +4, HP +200%. Area control.
- **Size +5** — Size tier for creatures 60+ ft tall (Adult dragons, titans). Attack +5, reach +5, HP +300%. Siege-scale threat.
- **Size +6** — Size tier for creatures Mythic tall (Ancient dragons, world spirits). Attack +6, reach +6, HP +500%. Narrative entities.

## World

- **TL 0 — Stone Age** — Technology Level 0 (Stone Age): stone tools, fire, basic shelters, oral tradition.
- **TL 1 — Bronze Age** — Technology Level 1 (Bronze Age): metal working, writing, irrigation, basic architecture.
- **TL 2 — Iron Age** — Technology Level 2 (Iron Age): iron tools, coins, paved roads, advanced agriculture.
- **TL 3 — Medieval** — Technology Level 3 (Medieval): castles, knights, crossbows, water mills, universities.
- **TL 4 — Renaissance** — Technology Level 4 (Renaissance): printing press, firearms, ocean navigation, scientific method.
- **TL 5 — Industrial** — Technology Level 5 (Industrial): steam power, factories, telegraphs, railroads.
- **TL 6 — Mechanized** — Technology Level 6 (Mechanized): automobiles, aircraft, radio, electricity widespread.
- **TL 7 — Nuclear** — Technology Level 7 (Nuclear): computers, nuclear power, satellites, television.
- **TL 8 — Digital** — Technology Level 8 (Digital): internet, robotics, genetic engineering, renewable energy.
- **TL 9+ — Advanced** — Technology Level 9+ (Advanced): ai, nanotechnology, fusion power, space colonization.

## Combat

- **All-Out Attack** — Combat maneuver: Bonus to attack, no defense this turn. High risk, high reward.
- **All-Out Defense** — Combat maneuver: Bonus to defense, no attack this turn. Useful when outnumbered.
- **Aim** — Combat maneuver: Spend turn aiming for bonus on next attack. Ranged combat.
- **Feint** — Combat maneuver: Contested roll. Success reduces opponent's defense.
- **Grapple** — Combat maneuver: Contested STR or skill. Winner controls opponent.
- **Move and Attack** — Combat maneuver: Move up to full movement and make one attack at penalty.
- **Wait** — Combat maneuver: Delay action. Can interrupt another character's turn.
- **Light Wound** — Dual-Die wound tier. Trigger: first hit dealing ≥1/4 max hp. Effect: -1 to all rolls.
- **Serious Wound** — Dual-Die wound tier. Trigger: 2nd hit dealing ≥1/4 max hp. Effect: -2 to all rolls, movement halved, bleeding (1 hp/round).
- **Critical Wound** — Dual-Die wound tier. Trigger: 3rd hit ≥1/4 max hp, or single hit ≥1/2 max hp. Effect: incapacitated: unconscious or dying.
- **Rock (RPS stance)** — Heavy attack, defensive stance, shield bash, magick blast. Beats Scissors.
- **Paper (RPS stance)** — Block, counter, ward, defensive magic, control spells. Beats Rock.
- **Scissors (RPS stance)** — Fast strike, feint, precise spell, quick attack. Beats Paper.
- **Glacial Blur** — Infinite Convergence Blur Level using 1d50 (wild, explosive, all-or-nothing); skill bonus capped at +50. Highest ceiling, lowest floor. One-hit-kill or total miss.
- **Heavy Blur** — Infinite Convergence Blur Level using 1d30 (powerful, deliberate swings); skill bonus capped at +30. High ceiling, low floor.
- **Balanced Blur** — Infinite Convergence Blur Level using 1d20 (controlled, professional); skill bonus capped at +20. Standard risk/reward.
- **Rapid Blur** — Infinite Convergence Blur Level using 3d8 (fast, multiple strikes averaged); skill bonus capped at +8. Consistent damage, low ceiling.
- **Flurry Blur** — Infinite Convergence Blur Level using 6d4 (overwhelming quantity of small strikes); skill bonus capped at +4. Very consistent, very low ceiling. Against heavy armor, ineffective.

## Injury

- **Full HP (HP threshold)** — No penalties. Character operates normally.
- **Below 1/3 HP (HP threshold)** — All rolls at -2. Character is wounded and slowed.
- **0 to -1× HP (HP threshold)** — Collapse check required. Risk of unconsciousness.
- **Below -1× HP (HP threshold)** — Major wounds. Character is unconscious and dying.
- **Below -5× HP (HP threshold)** — Death occurs. Character cannot be revived by normal means.
- **Foot Travel (fatigue)** — HP cost: 10 HP per hour (standard; suspended during combat).
- **Extended Combat (fatigue)** — HP cost: 20 HP after fights longer than 10 turns.
- **Forced March (fatigue)** — HP cost: 10 HP per hour (CON roll; failure only).
- **Sprinting (fatigue)** — HP cost: 10 HP per 15 seconds (CON roll; failure only).
- **Hard Swimming (fatigue)** — HP cost: 10 HP per minute (CON roll; failure only).
- **Starvation (fatigue)** — HP cost: 50 HP per day without food/water; 5 HP with water only.
- **Sleep Deprivation (fatigue)** — HP cost: 10 HP every 4 hours after 16 hours awake (CON roll; failure only).
- **Natural Rest (recovery)** — Restores: Roll CON daily. Success = 10 HP restored.
- **First Aid (recovery)** — Restores: 10 HP immediately. Stops bleeding and stabilizes.
- **Medical Treatment (recovery)** — Restores: Varies by TL and equipment. Roll Medicine skill.
- **Magickal Healing (recovery)** — Restores: Depends on spell. Can be instant and significant.
- **Exertion Recovery (recovery)** — Restores: 1 HP per 10 minutes of quiet rest (if not injured).

## Formulas

- **Basic Move** — Formula: Basic Speed with fractions dropped; ×0.9 for meters/sec
- **Perception (Per)** — Formula: Per = Intelligence
- **Will** — Formula: Will = Intelligence
- **Skill Check Total** — Formula: 1d20 + Skill Shift + Attribute Shift; read vs Base Bands
- **Rule of 5 Bonus** — Formula: floor(Skill Level ÷ 5)
- **Proficiency** — Formula: Skill Level + Attributing Attribute
- **Knockback Distance** — Formula: Base Knockback - Target Size (min 0)
- **Trinity Total Score** — Formula: Die Result + Attribute + Skill
- **Dual-Die Resolution** — Formula: 1d20 + Attribute + Skill ≥ Guard Value
- **Flight Speed** — Formula: Basic Move × 2 (unless modified)
- **Standing Long Jump** — Formula: STR in feet
- **Running Long Jump** — Formula: STR × 2 in feet
- **Vertical Jump** — Formula: STR / 4 in feet

## Equipment

- **Unarmed/Fist** — Typical weapon damage 1d6-1. Based on Strength.
- **Knife/Dagger** — Typical weapon damage 1d6. Concealable, quick.
- **Shortsword** — Typical weapon damage 1d6+1. Balanced, versatile.
- **Longsword** — Typical weapon damage 2d6. Standard melee weapon.
- **Greatsword** — Typical weapon damage 3d6. Two-handed, slow.
- **Bow** — Typical weapon damage 1d6+1. Ranged, requires arrows.
- **Crossbow** — Typical weapon damage 2d6. Armor piercing, slow reload.
- **Spear** — Typical weapon damage 1d6+2. Reach, can throw.
- **Warhammer** — Typical weapon damage 2d6+1. Crushing damage.
- **Pistol** — Typical weapon damage 2d6. Modern, limited ammo.
- **Rifle** — Typical weapon damage 3d6+2. Long range, accurate.
