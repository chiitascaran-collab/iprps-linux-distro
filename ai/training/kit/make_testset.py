#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Builds iprps_testset.jsonl: questions with answer keys for scoring an IPRPS model.

Part 1 is hand-written from the Master AI Profile v6.0, the First Edition rulebook and the
profile patches. Part 2 is computed with the First Edition rules (rules.py), using numbers that
do not appear in the training data. Each check lists what a correct answer must contain:
  all     every item must appear (an item may list alternatives separated by "|")
  numbers every number must appear (commas ignored)
  none    none of these may appear
"""
import json, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rules import *

T = []
def q(cat, question, reference, source, all=(), numbers=(), none=()):
    T.append({"category": cat, "question": question, "reference": reference, "source": source,
              "check": {"all": list(all), "numbers": [str(n) for n in numbers], "none": list(none)}})

M, FE = "Master AI Profile v6.0", "First Edition rulebook"

# ---------------- core rules ----------------
q("core_rules", "Does IPRPS use DC or AC? What replaces them?", "No. DC is replaced by the Base Target Number (BTN) or Guard Value; AC is replaced by Armor Rating (AR), which reduces damage rather than setting a number to hit.", M,
  all=["BTN|Base Target Number", "AR|Armor Rating", "reduc"])
q("core_rules", "What does Armor Rating (AR) do in IPRPS?", "AR is direct damage reduction: damage minus AR. It is not a threshold to hit.", M, all=["reduc|subtract|minus|−"], none=["Armor Class"])
q("core_rules", "What is the skill check formula?", "Skill Check Total = 1d20 + Skill Shift + Attribute Shift.", f"{M}; {FE}", all=["d20", "Skill Shift", "Attribute Shift"])
q("core_rules", "How is Skill Shift calculated?", "Skill Shift = floor(Skill ÷ 10). Skill 25 gives +2.", f"{M}; {FE}", all=["10", "floor|round down|divide"])
q("core_rules", "What are the three base bands for reading a d20 result?", "1–6 Fail, 7–12 Uncertain (the Session Master decides), 13–20 Success.", f"{M}; {FE}", all=["fail", "uncertain|uncertainty", "success"], numbers=[6, 7, 12, 13])
q("core_rules", "In the First Edition, what does the Effectiveness Roll do to damage?", "After a hit, roll d20: 13–20 full damage, 7–12 half damage, 1–6 quarter damage.", FE, all=["full", "half", "quarter"], numbers=[13, 12, 6])
q("core_rules", "What are the four Effectiveness Bands in the Master AI Profile?", "1–6 Weak, 7–14 Standard, 15–19 Strong, 20 Peak.", M, all=["Weak", "Standard", "Strong", "Peak"], numbers=[14, 15, 19, 20])
q("core_rules", "What is the Zone of Uncertainty?", "A d20 result of 7–12. The Session Master decides: partial success, success with consequences, or failure with some benefit.", M, all=["Session Master|SM"], numbers=[7, 12])
q("core_rules", "What does a Reaction Roll of 15 to 17 mean?", "Good: the NPC is favorable and provides reasonable assistance.", FE, all=["Good", "assist|help"])
q("core_rules", "What does a Reaction Roll of 0 or less mean?", "Disastrous: betrayal, violence, or deliberate sabotage.", FE, all=["Disastrous", "betray|sabotage|violence"])

# ---------------- character creation ----------------
q("character_creation", "How much does it cost to raise Intelligence or Dexterity above 10?", "10 DP per level. The other attributes cost 5 DP per level.", f"{M}; {FE}", all=["10 DP|10 points|10 per"], numbers=[10, 5])
q("character_creation", "What happens if I lower an attribute below 10?", "You gain 2 DP for each level below 10. Level 1 is the minimum for a functional character.", FE, numbers=[2])
q("character_creation", "What is the HP formula?", "HP = 50 + (CON × 10) + (Level × 5).", f"{M}; {FE}", all=["CON", "Level"], numbers=[50, 10, 5])
q("character_creation", "How is Basic Speed calculated, and how is it rounded?", "(DEX + CON) ÷ 4. Drop decimals; round up only if the remainder is 0.85 or more.", f"{M}; {FE}", all=["DEX", "CON"], numbers=[4, "0.85"])
q("character_creation", "How is Dodge calculated?", "Dodge = Basic Speed + ((DEX − 10) ÷ 2).", f"{M}; {FE}", all=["Basic Speed", "DEX"], numbers=[10, 2])
q("character_creation", "What are Will and Perception equal to?", "Both equal Intelligence (INT).", f"{M}; {FE}", all=["INT|Intelligence"])
q("character_creation", "What is the Mana Pool formula?", "((d1000 × HP + INT/3) + (Race Modifier × 100)) × 3. The d1000 is rolled once at creation.", f"{M}; {FE}", all=["d1000", "HP", "INT"], numbers=[3, 100])
q("character_creation", "How many DP does it take to raise a skill from 0 to level 10?", "20 DP in total (levels 1–3 cost 1 each, 4–9 cost 2 each, level 10 costs 5).", FE, numbers=[20])
q("character_creation", "What is the total DP cost of a level 20 skill?", "77 DP cumulative.", FE, numbers=[77])
q("character_creation", "What is the cumulative cost of a level 15 skill?", "42 DP.", FE, numbers=[42])
q("character_creation", "How many quirks can a character take, and what are they worth?", "Up to 5 quirks, each worth −1 DP (returns 1 DP).", M, numbers=[5, 1])
q("character_creation", "Is there a limit on disadvantages?", "Yes: disadvantages are capped at half of the starting DP total.", M, all=["half"])
q("character_creation", "What point range is the Heroic tier?", "150–250 points.", f"{M}; {FE}", numbers=[150, 250])
q("character_creation", "What point range is the Competent tier?", "70–100 points.", f"{M}; {FE}", numbers=[70, 100])
q("character_creation", "Name the seven basic attributes.", "Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma, Will Power (STR, DEX, CON, INT, WIS, CHA, WIL).", M,
  all=["STR|Strength", "DEX|Dexterity", "CON|Constitution", "INT|Intelligence", "WIS|Wisdom", "CHA|Charisma", "WIL|Will"])
q("character_creation", "What skill level is Heroic on the Ascendant Scale, and what is Demigod?", "Heroic is level 20; Demigod is level 50.", FE, numbers=[20, 50])

# ---------------- combat ----------------
q("combat", "Name the five IPRPS combat systems.", "Standard, Trinity, Rock-Paper-Scissors, Dual-Die and Infinite Convergence.", M,
  all=["Standard", "Trinity", "Rock|RPS", "Dual-Die|Dual Die", "Infinite Convergence"])
q("combat", "What dice make up The Hand in Trinity Combat?", "1d3 Velocity Die, 1d20 Impact Die, 1d12 Guard Die.", f"{M}; {FE}", all=["Velocity", "Impact", "Guard", "d3", "d20", "d12"])
q("combat", "In Trinity Combat, what do the Velocity Die results mean?", "3 = Fast, 2 = Normal, 1 = Slow.", f"{M}; {FE}", all=["Fast", "Normal", "Slow"])
q("combat", "What is the Hydra Hand?", "The Trinity boss variant: the boss rolls one Impact die per attack, each resolved separately.", M, all=["boss", "Impact"])
q("combat", "In Rock-Paper-Scissors combat, what beats what?", "Rock beats Scissors, Paper beats Rock, Scissors beats Paper.", f"{M}; {FE}", all=["Rock beats Scissors", "Paper beats Rock", "Scissors beats Paper"])
q("combat", "In Dual-Die combat, what is rolled after a hit?", "1d6 for Impact (1–2 Glancing, 3–4 Solid, 5–6 Critical).", f"{M}; {FE}", all=["d6", "Glancing", "Solid", "Critical"])
q("combat", "What are the Blur Levels in Infinite Convergence?", "Glacial 1d50, Heavy 1d30, Balanced 1d20, Rapid 3d8, Flurry 6d4.", M,
  all=["Glacial", "Heavy", "Balanced", "Rapid", "Flurry", "1d50|d50", "3d8", "6d4"])
q("combat", "What caps the skill bonus in Infinite Convergence?", "The maximum face of the chosen Blur die (for example +20 for Balanced 1d20, +8 for Rapid 3d8).", M, all=["cap|maximum|max"])
q("combat", "How long is one combat turn?", "One second of in-game time.", FE, all=["second"])
q("combat", "What happens to a character below 1/3 of their HP?", "All rolls are at −2; the character is wounded and slowed.", FE, numbers=[2])
q("combat", "What happens at 0 HP?", "A collapse check is required; the character risks unconsciousness.", FE, all=["collapse|unconscious"])
q("combat", "What damage does a longsword deal in the First Edition weapon table?", "2d6.", FE, all=["2d6"])
q("combat", "What damage does a greatsword deal?", "3d6 (two-handed, slow).", FE, all=["3d6"])
q("combat", "What is the Morale Penalty in mass combat?", "−1 to all rolls per 25% casualties (75% casualties = −3).", M, numbers=[1, 25, 3])
q("combat", "What are the mass combat tiers?", "Skirmish 10–49, Swarm 50–999, Horde 1,000–9,999, Army 10,000–100,000.", M, all=["Skirmish", "Swarm", "Horde", "Army"])

# ---------------- world and lore ----------------
q("world", "How big is the Infinite Plane disc?", "700,000 km in diameter and 650 km thick.", M, numbers=[700000, 650])
q("world", "What is the population of the Infinite Plane and how is it divided?", "About 500 million, across 500 regions in about 65 clusters.", M, numbers=[500, 65])
q("world", "What is the surface gravity of the Infinite Plane?", "0.88g, maintained by exotic materials and Higgs Boson Wave Generators.", M, numbers=["0.88"])
q("world", "How far is the Infinite Plane from Earth?", "1,265 light-years.", M, numbers=[1265])
q("world", "What is the source of magick on the Infinite Plane?", "Necronian nanotechnology (nanytes) permeating all matter.", M, all=["nanyte|nanotech"])
q("world", "Name the eight coins of the Numismata Plani Infiniti from lowest to highest.", "Lignum, Ferrum, Chalybs, Argentum, Aurum, Titanus, Corona, Aeternum.", M,
  all=["Lignum", "Ferrum", "Chalybs", "Argentum", "Aurum", "Titanus", "Corona", "Aeternum"])
q("world", "What is an Aurum worth and what can it buy?", "About $500: a house, a business, or a minor magical item.", M, numbers=[500])
q("world", "What is a Ferrum made of and worth?", "Iron coin, about $0.50 — ale, a simple meal, common tools.", M, all=["iron"], numbers=["0.50|.50"])
q("world", "What range does the technology scale cover?", "TL 1 (Primitive) through TL 9 (Post-Singularity).", M, all=["Primitive", "Post-Singularity"], numbers=[1, 9])
q("world", "What size tier are Bearfolk and Orcs?", "Size +1.", M, numbers=[1])
q("world", "What size tier are Catfolk, Birdfolk and Rabbitfolk?", "Size −1.", M, numbers=[1], all=["-1|−1|minus 1|negative"])
q("world", "What are Gemps?", "Genetically Engineered ChiMPs: brilliant bureaucrats, field medics and investigators (not crystalline).", M, all=["chimp|ChiMP", "genetic"])
q("world", "What base number system do Elves use?", "Base-12.", M, numbers=[12])
q("world", "How long do Elves live?", "About 700 years.", M, numbers=[700])
q("world", "What is special about Birdfolk magick?", "It is tonal: singing is casting. Nearly all Birdfolk are casual casters.", M, all=["sing|song|tonal"])
q("world", "Who built the Infinite Plane?", "The Necronians; the Elder Adruqu (Mother Goddess) built it as an alternate reality for reincarnated souls.", "Glossary Part I; Master AI Profile", all=["Necronian|Adruqu"])
q("world", "What are the Five Signals a dungeon tracks?", "Noise Spike, Magic Signature, Blood Scent, Loot Disturbance, Time Drift.", M,
  all=["Noise", "Magic Signature", "Blood Scent", "Loot", "Time Drift"])
q("world", "What is the dungeon Threat Budget formula?", "Response Budget = (NS + MS + BS + LD + TD) / 3.", M, all=["NS", "MS", "BS", "LD", "TD"], numbers=[3])
q("world", "What is Pattern Lock?", "When the same spell or school is used 3 times in 5 rounds, the dungeon gives enemies advantage against that magic for the rest of the encounter.", M, numbers=[3, 5])
q("world", "What is the NPC Disposition Scale range and what is 75 to 100 called?", "−100 to +100. 75 to 100 is Devoted: unconditional loyalty.", M, all=["Devoted"], numbers=[100])
q("world", "What are the three NPC memory tags?", "Competent, Dangerous, Untrustworthy.", M, all=["Competent", "Dangerous", "Untrustworthy"])

# ---------------- AI architecture and patches ----------------
q("architecture", "What are the tiers of the IPRPS AI architecture?", "Tier 1 Master AI Profile, Tier 2 Campaign Patches, Tier 3 Session Run Patches (.srpatch), Tier 4A SM Capstone (.capstone), Tier 4B Player Capstone (.pcapstone).", M,
  all=["Master", "Patch", "srpatch|Session Run", "Capstone"])
q("architecture", "What must the AI read before every response?", "The Capstone (Tier 4), which says what is true right now.", M, all=["Capstone"])
q("architecture", "Can the Master AI Profile be deleted?", "No. It is permanent Tier 1 architecture and is never deleted unless the user explicitly asks.", M, all=["never|not|permanent"])
q("architecture", "Which patch number is The Wayward Flagon and what does it cover?", "Part 86: taverns, inns and hospitality operations.", "Patch 86", all=["tavern|inn"], numbers=[86])
q("architecture", "How many establishment classes does The Wayward Flagon define?", "Seven, from Flophouse to Exclusive Private Club.", "Patch 86", all=["Flophouse", "Exclusive"], numbers=[7])
q("architecture", "How does the SM activate The Wayward Flagon?", "By saying \"Overlay: The Wayward Flagon\" — or automatically when the party enters a tavern, inn or similar.", "Patch 86", all=["Overlay"])
q("architecture", "What is Part 90?", "Iron City Blues: noir, hard-boiled detective overlay.", "Patch 90", all=["Iron City|noir"])
q("architecture", "What is Part 82?", "The Guild: operations, administration and internal intrigue overlay.", "Patch 82", all=["Guild"])
q("architecture", "What is Part 89?", "The Deep Blue: naval combat, fleet tactics and maritime warfare.", "Patch 89", all=["naval|Deep Blue"])
q("architecture", "What is Part 96?", "The Character Forge: the definitive skills, advantages, disadvantages, quirks and formulas reference.", "Patch 96", all=["Character Forge"])
q("architecture", "What is Part 84 and when does it activate?", "Session Zero: onboarding and walkthrough; it activates automatically when a new SM or player loads IPRPS for the first time.", "Patch 84", all=["Session Zero", "automatic|first time|new"])
q("architecture", "What is Part 95?", "The Black Tide: pirate campaign overlay.", "Patch 95", all=["Black Tide|pirate"])
q("architecture", "What is Part 93?", "The Ledger: economic systems, business operations, trade networks and wealth.", "Patch 93", all=["Ledger|econom"])
q("architecture", "What does the Hard tone level change?", "Social BTNs +2, NPCs hold grudges, moderate to high lethality.", M, all=["BTN|grudge"], numbers=[2])
q("architecture", "In Solo Player Mode, what does a roll of 1–6 do?", "It redirects the story rather than halting progress (a partial success, manageable injury or alternate path).", M, all=["redirect|partial|alternate"])

# ---------------- computed (First Edition rules) ----------------
rng = random.Random(8675309)
SK = [("Stealth", "DEX"), ("Athletics", "STR"), ("Persuasion", "CHA"), ("Perception", "INT"), ("Lockpicking", "DEX"), ("Survival", "WIS"), ("Arcana", "INT")]
for i in range(24):
    s, a = rng.choice(SK); lvl = rng.choice([0, 7, 13, 18, 22, 34, 47, 55, 61]); av = rng.choice([6, 8, 11, 13, 16, 17, 21, 24]); raw = rng.randint(1, 20)
    tot = raw + skill_shift(lvl) + attr_shift(av); band = base_band(tot)
    q("computation", f"Using First Edition rules: {s} {lvl}, {a} {av}, natural d20 roll {raw}. What is the check total and band?",
      f"Skill Shift {skill_shift(lvl):+d}, Attribute Shift {attr_shift(av):+d}, total {tot}: {band}.", FE,
      all=[{"Fail": "fail", "Uncertain": "uncertain", "Success": "success|succeed"}[band]], numbers=[tot])
for i in range(8):
    a = rng.choice(ATTRS); lv = rng.choice([7, 9, 12, 13, 14, 16, 18])
    c = attr_cost(a, lv)
    q("computation", f"How many DP does {ATTR_NAMES[a]} {lv} cost (or give back)?", f"{abs(c)} DP {'cost' if c > 0 else 'gained'}.", FE, numbers=[abs(c)])
for lv in rng.sample([5, 8, 12, 14, 17, 19, 25, 30], 6):
    q("computation", f"What is the total DP cost of a level {lv} skill?", f"{skill_cost(lv)} DP.", FE, numbers=[skill_cost(lv)])
for i in range(6):
    con, dex = rng.choice([8, 11, 13, 15, 17]), rng.choice([9, 12, 14, 16, 18])
    base, _ = hp(con)
    spd, raw = basic_speed(dex, con)
    q("computation", f"A level 1 human has CON {con} and DEX {dex}. What are their HP, Basic Speed and Dodge?",
      f"HP {base}; Basic Speed {spd} ({raw:g} before rounding); Dodge {dodge(spd, dex)}.", FE, numbers=[base, spd, dodge(spd, dex)])
for i in range(8):
    w = rng.choice(list(WEAPONS)); rolled = rng.randint(4, 17); e = rng.randint(1, 20); ar = rng.choice([0, 1, 2, 4])
    name, mult = eff_band(e); dmg = max(0, math.floor(rolled * mult) - ar)
    q("computation", f"Standard combat, First Edition: a hit with a {w} rolls {rolled} damage, the Effectiveness Roll is {e}, and the target has AR {ar}. How much damage is dealt?",
      f"Effectiveness {e} → ×{mult:g}; floor({rolled} × {mult:g}) − {ar} = {dmg}.", FE, numbers=[dmg])
for i in range(4):
    raw = rng.randint(1, 20); mod = rng.choice([-3, -1, 2, 3, 5]); tot = raw + mod; res, _ = reaction(tot)
    q("computation", f"Reaction roll: d20 shows {raw} with a total modifier of {mod:+d}. What is the result?", f"Total {tot}: {res}.", FE, all=[res], numbers=[tot])
for i in range(4):
    hs, fs = rng.choice(["Rock", "Paper", "Scissors"]), rng.choice(["Rock", "Paper", "Scissors"])
    beats = {"Rock": "Scissors", "Paper": "Rock", "Scissors": "Paper"}
    if hs == fs: ans, keys = "Tie: both deal normal damage (First Edition).", ["tie"]
    elif beats[hs] == fs: ans, keys = f"{hs} wins: deals ×1.5; the loser deals ×0.5 (First Edition).", [hs, "1.5"]
    else: ans, keys = f"{fs} wins: deals ×1.5; the loser deals ×0.5 (First Edition).", [fs, "1.5"]
    q("computation", f"RPS combat: I choose {hs}, the enemy chooses {fs}. Who wins and what are the damage multipliers?", ans, FE, all=keys)

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "iprps_testset.jsonl"
    with open(out, "w", encoding="utf8") as f:
        for i, t in enumerate(T, 1):
            f.write(json.dumps({"id": f"T{i:03d}", **t}, ensure_ascii=False) + "\n")
    import collections
    print(f"{len(T)} questions:", dict(collections.Counter(t["category"] for t in T)))
