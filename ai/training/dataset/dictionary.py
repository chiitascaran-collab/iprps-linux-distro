# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Builds the IPRPS Core Dictionary: the hand-checked core concepts from the glossary (Part I)
plus definitions taken straight from the First Edition and Master AI Profile reference tables."""
import re, json, collections

def table_after(text, marker):
    """Rows (list of dicts) of the first Markdown table after `marker`."""
    i = text.index(marker)
    lines = text[i:].split("\n")
    rows, hdr, started = [], None, False
    for l in lines[1:]:
        s = l.strip()
        if s.startswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if hdr is None: hdr = cells
            elif set(s.replace("|", "").strip()) <= set("-: "): continue
            else: rows.append(dict(zip(hdr, cells)))
            started = True
        elif started: break
    return rows

def part_one(glossary):
    a = glossary.index("PART I — CORE CONCEPTS"); b = glossary.index("PART II — A–Z GLOSSARY")
    cat, out = None, []
    paras = [p.strip() for p in re.split(r"\n\s*\n", glossary[a:b]) if p.strip()]
    for p in paras:
        m = re.match(r"^([^\n]+)\n-{3,}$", p)
        if m: cat = m.group(1).strip(); continue
        if " — " in p and cat:
            t, d = p.split(" — ", 1)
            out.append((cat, t.strip(), " ".join(d.split())))
    return out

# Where the Master AI Profile v6.0 and the First Edition rulebook disagree, give both versions.
OVERRIDES = {
    "Attribute Shift": "The bonus or penalty an attribute adds to a skill check. First Edition rulebook: Attribute − 10, clamped by the Attribute Shift Table (1 → −3, 5 → −2, 8–9 → −1, 10 → 0, 11–12 → +1, 15 → +2, 20 → +3, 50 → +4, 100 → +5). Master AI Profile v6.0: Attribute − 10 without clamping.",
    "Success Bands (Band System A)": "The three-zone reading of a d20 result: 1–6 Failure, 7–12 Zone of Uncertainty (the SM decides partial success, success with consequences, or failure with some benefit), 13–20 Success. In the First Edition rulebook, damage is then scaled by a separate Effectiveness Roll (13–20 full, 7–12 half, 1–6 quarter). In the Master AI Profile v6.0, the same bands double as damage multipliers (×0.25, ×0.50, ×1.00).",
    "Rock-Paper-Scissors Combat (Mode 3)": "Fast narrative skirmishes on the Eternal Triangle (Rock beats Scissors, Paper beats Rock, Scissors beats Paper). First Edition rulebook (Mode A): the winner deals damage × 1.5 and the loser × 0.5; on a tie both deal normal damage; defense is subtracted. Master AI Profile v6.0 (Mode 3): the winner deals Base Damage × 1.5 − Defense, a tie means both deal × 0.5, and the loser deals nothing.",
    "Dual-Die Combat (Mode 4)": "Gritty wound-based combat: 1d20 + Attribute + Skill vs Guard Value, then 1d6 Impact on a hit. First Edition rulebook (Mode C): Impact 1–2 Glancing (×0.25), 3–4 Solid (×0.50), 5–6 Critical (×1.00) damage, with Light, Serious and Critical Wounds triggered by hits of at least 1/4 (or 1/2) of max HP. Master AI Profile v6.0 (Mode 4): Impact 1–2 Glancing (−1 to next action), 3–4 Solid (−2 for 1d6 rounds, bleeding), 5–6 Critical (incapacitated unless CON Effectiveness 15+).",
    "Standard Combat (Mode 1)": "Turn-based tactical combat: Initiative (d20 + DEX Shift) → Attack (1d20 + Skill Shift + Attribute Shift) → defender's Dodge → damage. First Edition rulebook: after a hit, roll a separate Effectiveness Roll (13–20 full, 7–12 half, 1–6 quarter) and subtract Armor Rating. Master AI Profile v6.0: Damage = (Weapon Dice + STR mod) × the Effectiveness Band of the attack roll − AR.",
}

def build(fe, master, glossary):
    entries = []  # (category, term, definition)
    for c, t, d in part_one(glossary):
        entries.append((c, t, OVERRIDES.get(t, d)))
    add = lambda cat, t, d: entries.append((cat, t, " ".join(d.split())))

    for r in table_after(master, "### 2.2 — The Seven Basic Attributes"):
        add("Attributes", f"{r['Attribute']} ({r['Abbreviation']})", f"Basic attribute: {r['Description']}. Costs {r['DP Cost per Level']} above 10 (human average is 10, which is free); lowering it below 10 refunds 2 DP per level.")
    for r in table_after(master, "## SECTION 6 — CURRENCY"):
        add("Currency", r["Name"], f"Tier {r['Tier']} coin of the Numismata Plani Infiniti: {r['Material'].lower()}, worth about {r['Approximate Value (USD equivalent)']}. Typical purchase: {r['Common Purchase'].lower()}.")
    for r in table_after(master, "### 5.1 — Species Master Table"):
        add("Species", r["Species"], f"Size {r['Size']}, base lifespan {r['Base Lifespan']}, {r['Numeral Base']} numbers, script {r['Writing Script']}. Typical attributes STR {r['STR']}, DEX {r['DEX']}, CON {r['CON']}, INT {r['INT']}, WIS {r['WIS']}, CHA {r['CHA']}, WIL {r['WIL']}. {r['Primary Traits']}")
    for r in table_after(fe, "4.1 Starting Point Tiers"):
        add("Character Creation", f"{r['Tier']} (point tier)", f"A starting budget of {r['Points']} Development Points: {r['Description'].lower()}.")
    for r in table_after(fe, "3.1 The Ascendant Skill Cost Table"):
        add("Skills", f"{r['Rank Name']} (skill rank)", f"Skill levels {r['Level']} on the Ascendant Scale. Each level in this range costs {r['Upgrade Cost/Lvl']}; reaching the end of the range costs {r['Total Cumulative DP']} DP in total.")
    for r in table_after(fe, "1.4 Proficiency Interpretation"):
        add("Core Mechanics", f"{r['Tier']} (proficiency tier)", f"Proficiency (Skill Level + attributing attribute) of {r['Proficiency Value']}.")
    for r in table_after(fe, "5.1 Reaction Table"):
        add("Social", f"{r['Result']} (reaction)", f"Reaction Roll result of {r['Roll']} on the d20 after modifiers. The NPC: {r['NPC Behavior'].lower()}.")
    for r in table_after(fe, "4.3 Wealth Levels"):
        add("Character Creation", f"{r['Wealth Level']} (wealth level)", f"Wealth trait worth {r['Points']} points: {r['Description'].lower()}.")
    for r in table_after(fe, "4.2 Appearance & Reaction Modifiers"):
        add("Character Creation", f"{r['Appearance']} (appearance)", f"Appearance trait worth {r['Points']} points; reaction modifier {r['Reaction Mod']}. {r['Effect']}.")
    for r in table_after(fe, "6.2 Size Modifier Table"):
        add("Size", f"Size {r['Size']}", f"Size tier for creatures {r['Height']} tall ({r['Examples']}). Attack {r['Attack']}, reach {r['Reach']}, HP {r['HP']}. {r['Notes']}.")
    for r in table_after(fe, "## 12. Technology Levels"):
        add("World", f"TL {r['TL']} — {r['Era']}", f"Technology Level {r['TL']} ({r['Era']}): {r['Key Technologies'].lower()}.")
    for r in table_after(fe, "## 10. Combat Maneuvers"):
        add("Combat", r["Maneuver"], f"Combat maneuver: {r['Effect']}")
    for r in table_after(fe, "11.1 Hit Point Thresholds & Conditions"):
        add("Injury", f"{r['HP Status']} (HP threshold)", r["Effects"])
    for r in table_after(fe, "9.8 Wound System (Dual-Die)"):
        add("Combat", r["Wound Tier"], f"Dual-Die wound tier. Trigger: {r['Trigger'].lower()}. Effect: {r['Effect'].lower()}.")
    for r in table_after(fe, "9.2 Trinity System — The Hand"):
        add("Combat", r["Name"], f"Trinity Combat die ({r['Die']}). {r['Purpose']}")
    for r in table_after(fe, "9.4 Rock-Paper-Scissors — The Three Stances"):
        add("Combat", f"{r['Stance']} (RPS stance)", f"{r['Description']}. Beats {r['Beats']}.")
    for r in table_after(master, "### 3.5 — Infinite Convergence (Mode 5)"):
        add("Combat", f"{r['Blur Level']} Blur", f"Infinite Convergence Blur Level using {r['Die']} ({r['Style'].lower()}); skill bonus capped at {r['Skill Cap']}. {r['Risk Profile']}")
    for r in table_after(fe, "11.2 Fatigue & Exertion HP Costs"):
        add("Injury", f"{r['Activity']} (fatigue)", f"HP cost: {r['HP Cost']}.")
    for r in table_after(fe, "11.3 Recovery & Healing Rates"):
        add("Injury", f"{r['Method']} (recovery)", f"Restores: {r['HP Restored']}")
    for r in table_after(fe, "13.1 Language Comprehension Levels"):
        add("Character Creation", f"{r['Level']} (language)", r["Description"])
    for r in table_after(fe, "## 15. Core Formulas Quick Reference"):
        add("Formulas", r["Value"], f"Formula: {r['Formula']}")
    for r in table_after(fe, "6.4 Typical Weapon Damage by Type"):
        add("Equipment", r["Weapon Type"], f"Typical weapon damage {r['Damage']}. {r['Notes']}.")

    # de-duplicate (Part I wins)
    seen, final = set(), []
    for c, t, d in entries:
        k = re.sub(r"[^a-z0-9]", "", t.lower())
        if k in seen: continue
        seen.add(k); final.append((c, t, d))
    return final

def to_markdown(entries):
    by = collections.OrderedDict()
    for c, t, d in entries: by.setdefault(c, []).append((t, d))
    out = ["# IPRPS Core Dictionary", "",
           "Core terms of the Infinite Plane Role Playing System, from the First Edition rulebook, the Master AI Profile v6.0 and the hand-checked core concepts of the IPRPS Glossary.", ""]
    for c, items in by.items():
        out += [f"## {c}", ""] + [f"- **{t}** — {d}" for t, d in items] + [""]
    return "\n".join(out)

if __name__ == "__main__":
    fe = open("first_edition.md", encoding="utf8").read()
    master = open("src/IPRPS_MASTER_AI_PROFILE_v6.md", encoding="utf8").read()
    glossary = open("src/IPRPS_Glossary.txt", encoding="utf8").read()
    e = build(fe, master, glossary)
    print(len(e), collections.Counter(c for c, _, _ in e))
    for x in e[::25]: print(x)
