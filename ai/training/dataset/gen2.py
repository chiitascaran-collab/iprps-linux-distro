# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Second set of IPRPS example generators: formulas (with many Mana Pool examples), species in
unconventional roles, NPC reactions and behavior, weather effects on skills and spellcasting,
and dungeon creatures against solo and group players.

Rules come from the First Edition rulebook, the Master AI Profile v6.0, the Weather Engine patch,
the Spellcasting Weather Interaction profile, the NPC Social Behavior Engine, the Dungeon Creation
profile and the Solo Play profile. Every number a scenario needs is stated in the question.
"""
import math, random, re
import gen
from gen import sg, cap, art, name_for, build_character, attr_desc, ATTR_NAMES
from rules import *

# ------------------------------------------------------------------ species
gen.SPECIES += [("Fairy", -3, ["DEX", "CHA", "INT"], ["STR", "CON"]), ("Insectoid", 0, ["CON", "STR", "WIL"], ["CHA"]),
                ("Dragonkin", 4, ["STR", "CON", "INT", "WIL"], [])]
gen.SYL.update({"Fairy": (["Lys", "Pim", "Ael", "Fen", "Twi", "Bri"], ["ra", "wyn", "bell", "ith", "lin", "sy"]),
                "Insectoid": (["Klick", "Zzar", "Thrax", "Vik", "Chit", "Ix"], ["a", "ik", "or", "ex", "ith", "ul"]),
                "Dragonkin": (["Ig", "Vor", "Thrax", "Sar", "Ky", "Aur"], ["nis", "athan", "ion", "eth", "rax", "ora"])})
SPECIES = {s[0]: s for s in gen.SPECIES}

# What each species is known for (Master AI Profile species table), and the roles people expect of them.
KNOWN = {"Human": ("the adaptive baseline of the Plane", "almost anything"),
         "Elf": ("high magic affinity and seven-century lifespans", "mages, diplomats and archers"),
         "Dwarf": ("forge mastery, tunnel warfare and endurance", "smiths, miners and shield-wall soldiers"),
         "Catfolk": ("stealth, ambush, night vision and the fastest reflexes", "thieves, scouts and duelists"),
         "Wolffolk": ("pack tactics, endurance pursuit and keen senses", "hunters, trackers and mercenaries"),
         "Bearfolk": ("immense strength and shock-troop tradition", "front-line brawlers and guardians"),
         "Birdfolk": ("aerial reconnaissance and tonal magick — singing is casting", "scouts, messengers and spellsingers"),
         "Rabbitfolk": ("speed, tunnel defense and three-second ward inscription", "sentries, couriers and ward-scribes"),
         "Gemp": ("brilliant bureaucracy, field medicine and investigation", "clerks, medics and investigators"),
         "Orc": ("overwhelming aggression and a 92% warrior population", "berserkers and raiders"),
         "Goblin": ("ambush, sabotage and traps", "scouts, saboteurs and expendable skirmishers"),
         "Demon (Lilitu)": ("psychological warfare, blood magick and contract society", "deal-makers and blood-witches"),
         "Angelicus": ("holy warfare, radiant power and healing", "templars and healers"),
         "Lamia": ("constriction, venom, heat-sensing and night operations", "assassins and night guards"),
         "Merfolk": ("aquatic superiority and naval control", "sailors, pilots and sea-guards"),
         "Fairy": ("dust-mediated innate casting and being nearly impossible to hit", "tricksters and wild casters"),
         "Insectoid": ("hive warfare and perfect coordination", "soldiers and workers of the hive"),
         "Dragonkin": ("aerial superiority, breath weapons and apex casting", "warlords and archmages")}

# ------------------------------------------------------------------ roles (skills from the First Edition skill lists)
R = lambda d, sk, cat: (d, sk, cat)
ROLES = {
    # administrative / clerical
    "Guild Registrar": R("Keeps the guild's quest board, contracts and member rolls in order.", ["Guild Administration", "Quest Assessment", "Record Keeping", "Party Assignment", "Risk Analysis"], "administrative"),
    "Guild Treasurer": R("Balances the guild's books and values every contract.", ["Accounting", "Treasury Management", "Contract Valuation", "Fraud Detection", "Tradecraft"], "administrative"),
    "Town Clerk": R("Runs city hall's daily business, charters and public notices.", ["Town Administration", "Law and Charter Knowledge", "Public Communication", "Record Keeping", "Crisis Governance"], "administrative"),
    "Tax Assessor": R("Collects levies and audits merchants, guilds and dungeon income.", ["Tax Collection", "Budgeting", "Trade Regulation", "Anti Corruption Auditing", "Dungeon Economy Oversight"], "administrative"),
    "Academy Registrar": R("Administers an academy's enrollment, policy and discipline.", ["Academic Administration", "Policy and Discipline", "Institutional Leadership", "Strategic Planning", "Crisis Management"], "administrative"),
    "Archivist": R("Curates the library, controls restricted texts and supports researchers.", ["Library Administration", "Lore Curation", "Archival Preservation", "Research Support", "Restricted Knowledge Control"], "administrative"),
    "Quartermaster": R("Procures, stores and moves supplies for a garrison, guild or ship.", ["Logistics", "Procurement", "Storage Management", "Transport Coordination", "Quality Control"], "administrative"),
    "Court Scribe": R("Records testimony, handles evidence and drafts legal writs.", ["Legal Knowledge", "Evidence Handling", "Record Keeping", "Internal Investigation", "Information Control"], "administrative"),
    "Diplomatic Attaché": R("Negotiates on behalf of a guild, city or crown.", ["Diplomacy", "Negotiation", "Cultural Awareness", "Reputation Management", "Information Control"], "administrative"),
    # religious
    "Temple Priest": R("Leads worship and interprets doctrine for a congregation.", ["Doctrine Knowledge", "Ritual Leadership", "Scriptural Interpretation", "Chanting and Recitation", "Pastoral Care"], "religious"),
    "Temple Administrator": R("Runs a temple's records, stores and succession.", ["Religious Administration", "Record Keeping", "Resource Stewardship", "Succession Planning", "Rank Authority"], "religious"),
    "Almoner": R("Organizes charity, mediates disputes and cares for the poor.", ["Charitable Organization", "Pastoral Care", "Conflict Mediation", "Community Leadership", "Counseling"], "religious"),
    "Ascetic Monk": R("Masters body and mind through discipline and denial.", ["Self-Denial", "Mind Body Alignment", "Inner Stillness", "Detachment", "Meditative Practice"], "religious"),
    "Cleric": R("Channels divine power in the field.", ["Invocation", "Divine Favor", "Sacred Rituals", "Faith Resistance", "Religious Lore"], "religious"),
    "Interfaith Envoy": R("Speaks for a faith among rival temples and peoples.", ["Interfaith Dialogue", "Public Representation", "Cultural Preservation", "Comparative Theology", "Ethical Philosophy"], "religious"),
    "Temple Healer": R("Restores the sick and wounded through sacred magick.", ["Restoration Casting", "Life Energy Regulation", "Medical Lore", "Condition Removal", "Sustained Healing"], "religious"),
    # combat
    "City Watch Sergeant": R("Keeps the peace and commands a squad of the watch.", ["Town Guard Command", "Law Enforcement", "Crowd Control", "Investigation", "Detention Management"], "combat"),
    "Militia Captain": R("Trains townsfolk and holds the walls against monsters.", ["Town Militia Training", "Fortification Management", "Rapid Response Units", "Monster Defense Tactics", "Leadership"], "combat"),
    "Dungeon Warden": R("Guards a dungeon mouth and regulates who goes in.", ["Dungeon Watch", "Threat Assessment", "Containment Planning", "Adventurer Regulation", "Artifact Handling"], "combat"),
    "Tavern Bouncer": R("Keeps order at the door and in the taproom.", ["Door Security", "Restraint Handling", "Conflict De-escalation", "Security Awareness", "Emergency Response"], "combat"),
}
for name in ["Warrior", "Knight/Paladin", "Barbarian/Berserker"]:
    if name in gen.CLASSES: ROLES[name] = R(gen.CLASSES[name][0], gen.CLASSES[name][1], "combat")
for name in gen.CLASSES:
    if name not in ROLES and name not in ("Warrior", "Knight/Paladin", "Barbarian/Berserker"):
        ROLES[name] = R(gen.CLASSES[name][0], gen.CLASSES[name][1], "adventurer")
SKILL_ATTR = {"Leadership": "CHA", "Counseling": "WIS", "Record Keeping": "INT", "Crisis Management": "WIL", "Accounting": "INT",
              "Reputation Management": "CHA", "Strategic Planning": "INT", "Meditative Practice": "WIL", "Comparative Theology": "INT",
              "Ethical Philosophy": "WIS", "Rank Authority": "CHA", "Information Control": "INT", "Investigation": "INT"}
for role, (d, sk, c) in ROLES.items():
    gen.CLASSES.setdefault(role, (d, sk))
for s, a in [("Guild Administration", "INT"), ("Quest Assessment", "INT"), ("Party Assignment", "WIS"), ("Risk Analysis", "INT"),
             ("Treasury Management", "INT"), ("Contract Valuation", "INT"), ("Fraud Detection", "WIS"), ("Tradecraft", "CHA"),
             ("Town Administration", "INT"), ("Law and Charter Knowledge", "INT"), ("Public Communication", "CHA"), ("Crisis Governance", "WIL"),
             ("Tax Collection", "INT"), ("Budgeting", "INT"), ("Trade Regulation", "INT"), ("Anti Corruption Auditing", "WIS"),
             ("Dungeon Economy Oversight", "INT"), ("Academic Administration", "INT"), ("Policy and Discipline", "WIL"),
             ("Institutional Leadership", "CHA"), ("Library Administration", "INT"), ("Lore Curation", "INT"), ("Archival Preservation", "INT"),
             ("Research Support", "INT"), ("Restricted Knowledge Control", "WIL"), ("Logistics", "INT"), ("Procurement", "INT"),
             ("Storage Management", "INT"), ("Transport Coordination", "INT"), ("Quality Control", "WIS"), ("Legal Knowledge", "INT"),
             ("Evidence Handling", "INT"), ("Internal Investigation", "WIS"), ("Diplomacy", "CHA"), ("Negotiation", "CHA"),
             ("Cultural Awareness", "WIS"), ("Doctrine Knowledge", "INT"), ("Ritual Leadership", "WIS"), ("Scriptural Interpretation", "INT"),
             ("Chanting and Recitation", "WIL"), ("Pastoral Care", "WIS"), ("Religious Administration", "INT"), ("Resource Stewardship", "WIS"),
             ("Succession Planning", "INT"), ("Charitable Organization", "INT"), ("Conflict Mediation", "WIS"), ("Community Leadership", "CHA"),
             ("Self-Denial", "WIL"), ("Mind Body Alignment", "WIS"), ("Inner Stillness", "WIL"), ("Detachment", "WIL"), ("Invocation", "WIL"),
             ("Divine Favor", "WIS"), ("Sacred Rituals", "WIS"), ("Faith Resistance", "WIL"), ("Religious Lore", "INT"),
             ("Interfaith Dialogue", "CHA"), ("Public Representation", "CHA"), ("Cultural Preservation", "WIS"), ("Restoration Casting", "WIS"),
             ("Life Energy Regulation", "WIS"), ("Medical Lore", "INT"), ("Condition Removal", "WIS"), ("Sustained Healing", "WIL"),
             ("Town Guard Command", "CHA"), ("Law Enforcement", "STR"), ("Crowd Control", "STR"), ("Detention Management", "INT"),
             ("Town Militia Training", "STR"), ("Fortification Management", "INT"), ("Rapid Response Units", "DEX"),
             ("Monster Defense Tactics", "INT"), ("Dungeon Watch", "WIS"), ("Threat Assessment", "INT"), ("Containment Planning", "INT"),
             ("Adventurer Regulation", "INT"), ("Artifact Handling", "INT"), ("Door Security", "STR"), ("Restraint Handling", "STR"),
             ("Conflict De-escalation", "CHA"), ("Security Awareness", "WIS"), ("Emergency Response", "WIL")] + list(SKILL_ATTR.items()):
    gen.SKILLS.setdefault(s, a)
gen.CASTERS.update({"Cleric", "Temple Healer"})

# Roles that run against each species' reputation (shown as "unconventional" in the build).
EXPECTED = {"Orc": {"Warrior", "Barbarian/Berserker"}, "Bearfolk": {"Warrior", "Barbarian/Berserker", "Tavern Bouncer"},
            "Gemp": {"Guild Registrar", "Archivist", "Court Scribe", "Tax Assessor", "Temple Healer"},
            "Goblin": {"Rogue/Thief", "Scout"}, "Angelicus": {"Cleric", "Temple Healer", "Knight/Paladin", "Temple Priest"},
            "Elf": {"Mage", "Wizard", "Diplomatic Attaché"}, "Dwarf": {"Warrior", "Quartermaster"}, "Catfolk": {"Rogue/Thief", "Scout"},
            "Wolffolk": {"Scout", "Warrior"}, "Birdfolk": {"Scout", "Bard"}, "Rabbitfolk": {"Scout"}, "Demon (Lilitu)": {"Warlock"},
            "Lamia": {"Rogue/Thief"}, "Merfolk": {"Quartermaster"}, "Fairy": {"Sorcerer"}, "Insectoid": {"Warrior", "Militia Captain"},
            "Dragonkin": {"Warrior", "Mage", "Sorcerer"}}

def gen_role_build(rng, species_name, role, points):
    d, sk, cat = ROLES[role]
    sp = SPECIES[species_name]
    c = build_character(rng, points, sp, role)
    nm = name_for(rng, species_name)
    known, typical = KNOWN[species_name]
    unconventional = role not in EXPECTED.get(species_name, set()) and species_name != "Human"
    a = c["attrs"]
    attr_total = sum(attr_cost(k, v) for k, v in a.items())
    attr_lines = [f"- {ATTR_NAMES[k]} ({k}): {v} ({attr_desc(v)}) — {'Cost' if attr_cost(k, v) > 0 else 'Gain'}: {abs(attr_cost(k, v))} DP"
                  for k, v in a.items() if v != 10] + ["- All other attributes: 10 (Average) — 0 DP"]
    sk_total = sum(skill_cost(l) for l in c["skills"].values())
    hp_base, hp_val = hp(a["CON"], 1, c["size"])
    spd, raw = basic_speed(a["DEX"], a["CON"]); dg = dodge(spd, a["DEX"])
    concept = (f"{species_name} are known for {known}, and most people expect them as {typical}. {nm} is {art(role.lower())} instead: {d[0].lower() + d[1:]}"
               if unconventional else f"{nm} is {art(role.lower())}: {d[0].lower() + d[1:]}")
    out = [f"## {nm} — {species_name} {role}", "", f"**Points:** {points} DP ({point_tier(points)} tier) · **Role type:** {cat} · **Size:** {sg(c['size']).replace(' ', '')}", "",
           f"**Concept:** {concept}"]
    if unconventional:
        out.append(f"**Playing against type:** let the species show through the job — {species_name.lower()} instincts ({known.split(',')[0]}) color how {nm} handles the work, and NPCs who expect {typical} may react with surprise.")
    out += ["", f"### Attributes ({attr_total} DP)"] + attr_lines
    if c["adv"]: out += ["", "### Advantages"] + [f"- {n} — {x} DP" for n, x in c["adv"]]
    if c["dis"] or c["quirks"]:
        out += ["", "### Disadvantages and Quirks"] + [f"- {n} — −{abs(x)} DP" for n, x in c["dis"]] + [f"- Quirk: {q} — −1 DP" for q in rng.sample(gen.QUIRK_EXAMPLES, c["quirks"])]
    out += ["", f"### Skills ({sk_total} DP)"] + [f"- {s} ({gen.SKILLS.get(s, '—')}): Level {l} ({skill_rank(l)}) — {skill_cost(l)} DP"
                                              for s, l in sorted(c["skills"].items(), key=lambda x: -x[1])]
    parts = [attr_total, sum(x for _, x in c["adv"]), sum(x for _, x in c["dis"]) - c["quirks"], sk_total]
    out += ["", "**Total:** " + " + ".join(str(x) for x in parts if x >= 0) + "".join(f" − {abs(x)}" for x in parts if x < 0) + f" = **{points} DP**", "",
            "### Derived values",
            f"- HP: 50 + (CON {a['CON']} × 10) + (Level 1 × 5) = {hp_base}" + (f" × {1 + SIZE_HP[c['size']]:.2f} (Size {sg(c['size']).replace(' ', '')}) = {hp_val}" if c["size"] else ""),
            f"- Basic Speed: (DEX {a['DEX']} + CON {a['CON']}) ÷ 4 = {raw:g} → {spd}; Basic Move {spd}; Dodge {spd} + ((DEX {a['DEX']} − 10) ÷ 2) = {dg}",
            f"- Will {a['INT']} · Perception {a['INT']}"]
    if role in gen.CASTERS:
        roll = rng.randint(1, 1000); mp = mana_pool(roll, hp_val, a["INT"], c["size"])
        out.append(f"- Mana Pool: ((d1000 {roll} × HP {hp_val} + INT {a['INT']}÷3) + (Size {c['size']} × 100)) × 3 = {mp:,} MP")
    q = rng.choice([f"Build a {points}-point {species_name} {role}.", f"I want to play against type: a {species_name} working as a {role}. {points} DP.",
                    f"Make an NPC sheet for a {species_name} {role.lower()} at {points} points.",
                    f"Create a {cat} character: {species_name}, {role}, {points} Development Points."])
    return q, "\n".join(out)

def role_builds(rng, per_combo=1):
    out = []
    by_cat = {}
    for r, (d, sk, c) in ROLES.items(): by_cat.setdefault(c, []).append(r)
    for sp in SPECIES:
        for cat, roles in by_cat.items():
            choices = [r for r in roles if r not in EXPECTED.get(sp, set())] or roles
            for r in rng.sample(choices, min(per_combo, len(choices))):
                pts = rng.choice([75, 100, 120, 150, 150, 200, 250, 300])
                if sp == "Dragonkin": pts = rng.choice([350, 400, 500])
                out.append(("character_build_role",) + gen_role_build(rng, sp, r, pts))
    return out

# ------------------------------------------------------------------ formulas
def gen_formula(rng):
    kind = rng.choice(["mana"] * 12 + ["hp", "speed", "skill_raise", "attr_raise", "proficiency", "threat_rating", "response_budget",
                                     "room_budget", "trap_budget", "hfi", "hybrid_mod", "hybrid_life", "swarm", "morale", "travel", "fatigue"])
    if kind == "mana":
        sp = rng.choice(list(SPECIES.values())); intel = rng.choice([8, 10, 12, 14, 15, 16, 18, 20]); con = rng.choice([8, 10, 12, 14, 16])
        lvl = rng.choice([1, 1, 2, 3, 5, 8]); roll = rng.randint(1, 1000)
        base, hpv = hp(con, lvl, sp[1])
        use_level = rng.random() < 0.25
        mod = lvl if use_level else sp[1]
        mp = mana_pool(roll, hpv, intel, mod)
        variant = rng.choice(["full", "full", "given_hp", "casts"])
        if variant == "given_hp":
            q = f"Calculate the Mana Pool: HP {hpv}, INT {intel}, Race Modifier {mod}{' (class level used at the SM’s discretion)' if use_level else ''}, d1000 roll {roll}."
            steps = []
        else:
            q = rng.choice([f"Work out the Mana Pool for a level {lvl} {sp[0]} (Size {sg(sp[1]).replace(' ', '')}) with CON {con} and INT {intel}. The d1000 roll was {roll}."
                            + (" Use class level as the race modifier." if use_level else ""),
                            f"Mana Pool please: {sp[0]}, level {lvl}, CON {con}, INT {intel}, d1000 = {roll}" + (", SM uses class level for the modifier." if use_level else ".")])
            steps = [f"1. HP = 50 + (CON {con} × 10) + (Level {lvl} × 5) = {base}" + (f"; Size {sg(sp[1]).replace(' ', '')} HP adjustment × {1 + SIZE_HP[sp[1]]:.2f} = {hpv}" if sp[1] else "")]
        n = len(steps) + 1
        steps += [f"{n}. d1000 × HP = {roll} × {hpv} = {roll * hpv:,}",
                  f"{n + 1}. INT ÷ 3 = {intel} ÷ 3 = {intel // 3} (round down)",
                  f"{n + 2}. Race Modifier × 100 = {mod} × 100 = {mod * 100:,}" + (" (class level)" if use_level else f" (Size {sg(sp[1]).replace(' ', '')})"),
                  f"{n + 3}. ({roll * hpv:,} + {intel // 3}) + {mod * 100:,} = {roll * hpv + intel // 3 + mod * 100:,}",
                  f"{n + 4}. × 3 = **{mp:,} MP**"]
        out = ["**Mana Pool** = ((d1000 × HP + INT/3) + (Race Modifier × 100)) × 3", ""] + steps
        if variant == "casts":
            cost = rng.choice([25, 80, 150, 500, 2000])
            out += ["", f"At {cost} MP per casting, that pool covers {mp // cost:,} castings before resting (MP ÷ cost, rounded down)."]
            q += f" How many {cost}-MP spells can they cast from a full pool?"
        out += ["", "The d1000 is rolled once at character creation and stays permanent."]
        return "formula_mana_pool", q, "\n".join(out)
    if kind == "hp":
        con, lvl, sp = rng.choice([7, 9, 11, 13, 15, 18]), rng.choice([1, 2, 4, 6, 10, 15]), rng.choice(list(SPECIES.values()))
        base, hpv = hp(con, lvl, sp[1])
        q = f"What is the HP of a level {lvl} {sp[0]} with CON {con}?"
        a = [f"HP = 50 + (CON × 10) + (Level × 5) = 50 + {con * 10} + {lvl * 5} = {base}"]
        if sp[1]: a.append(f"{sp[0]} are Size {sg(sp[1]).replace(' ', '')}, so HP is adjusted by {SIZE_HP[sp[1]] * 100:+.0f}%: {base} × {1 + SIZE_HP[sp[1]]:.2f} = **{hpv}** (round down).")
        else: a[0] = a[0].replace(f"= {base}", f"= **{base}**")
        return "formula", q, "\n".join(a)
    if kind == "speed":
        dex, con = rng.randint(6, 20), rng.randint(6, 20)
        spd, raw = basic_speed(dex, con)
        frac = raw - math.floor(raw)
        q = f"DEX {dex}, CON {con}: what are Basic Speed, Basic Move and Dodge?"
        a = [f"- Basic Speed = (DEX + CON) ÷ 4 = ({dex} + {con}) ÷ 4 = {raw:g}. " +
             (f"The remainder {frac:.2f} is 0.85 or more, so round up to **{spd}**." if frac >= 0.85 else f"Drop the decimals: **{spd}**." if frac else f"**{spd}**."),
             f"- Basic Move = Basic Speed = **{spd}** yards per second (×0.9 = {spd * 0.9:.1f} m/s).",
             f"- Dodge = Basic Speed + ((DEX − 10) ÷ 2) = {spd} + ({dex - 10} ÷ 2) = {spd + (dex - 10) / 2:g} → **{dodge(spd, dex)}** (drop decimals)."]
        return "formula", q, "\n".join(a)
    if kind == "skill_raise":
        a0 = rng.choice([0, 5, 10, 12, 15, 20, 30]); a1 = a0 + rng.choice([1, 3, 5, 8, 10])
        c = skill_cost(a1) - skill_cost(a0)
        q = f"How many DP does it cost to raise a skill from level {a0} to level {a1}?"
        return "formula", q, (f"Pay the difference in cumulative cost on the Ascendant Skill Cost Table:\n- Level {a1}: {skill_cost(a1)} DP\n- Level {a0}: {skill_cost(a0)} DP\n"
                              f"- Cost: {skill_cost(a1)} − {skill_cost(a0)} = **{c} DP**\n\nLevel {a1} is {skill_rank(a1)} rank.")
    if kind == "attr_raise":
        at = rng.choice(ATTRS); v = rng.choice([1, 5, 7, 9, 11, 13, 15, 18, 20])
        c = attr_cost(at, v)
        q = f"What does setting {ATTR_NAMES[at]} to {v} do to my DP?"
        if v >= 10:
            return "formula", q, f"{at} costs {10 if at in ('INT', 'DEX') else 5} DP per level above 10: ({v} − 10) × {10 if at in ('INT', 'DEX') else 5} = **{c} DP spent**. {v} is {attr_desc(v)}; Attribute Shift {sg(attr_shift(v)).replace(' ', '')}."
        return "formula", q, f"Lowering an attribute below 10 refunds 2 DP per level: (10 − {v}) × 2 = **{-c} DP gained**. {v} is {attr_desc(v)}; Attribute Shift {sg(attr_shift(v)).replace(' ', '')}."
    if kind == "proficiency":
        s, at = rng.choice([("Climbing", "STR"), ("Ranged Weapons", "DEX"), ("Persuasion", "CHA"), ("Lockpicking", "DEX"), ("Arcana", "INT")])
        lv, av = rng.choice([0, 2, 3, 5, 8, 12, 20, 30]), rng.choice([8, 10, 12, 15, 18])
        p = lv + av
        return "formula", f"What is the proficiency for {s} {lv} with {at} {av}, and what tier is that?", f"Proficiency = Skill Level + attributing attribute = {lv} + {av} = **{p}** → **{proficiency_tier(p)}**."
    if kind == "threat_rating":
        attrs = [rng.randint(9, 18) for _ in range(3)]; best = rng.choice([10, 15, 20, 25, 30]); size = rng.choice([-2, -1, 0, 1, 2, 3]); eq = rng.choice([0, 1, 2, 3, 5])
        avg = sum(attrs) / 3; tr = math.floor(avg) + best + size + eq
        return "formula", (f"Threat Rating for a creature with combat attributes STR {attrs[0]}, DEX {attrs[1]}, CON {attrs[2]}, best combat skill {best}, Size {sg(size).replace(' ', '')}, equipment bonus +{eq}?"),
        (f"TR = (Average Combat Attributes + Best Combat Skill) + Size Mod + Equipment Bonus\n- Average: ({attrs[0]} + {attrs[1]} + {attrs[2]}) ÷ 3 = {avg:.2f} → {math.floor(avg)}\n"
         f"- TR = ({math.floor(avg)} + {best}) {sg(size)} + {eq} = **{tr}**")
    if kind == "response_budget":
        v = [rng.randint(0, 30) for _ in range(5)]; b = sum(v) / 3
        return "formula", f"The party's dungeon signals are Noise Spike {v[0]}, Magic Signature {v[1]}, Blood Scent {v[2]}, Loot Disturbance {v[3]}, Time Drift {v[4]}. What is the Response Budget?", \
            f"Response Budget = (NS + MS + BS + LD + TD) ÷ 3 = ({' + '.join(map(str, v))}) ÷ 3 = {sum(v)} ÷ 3 = **{b:.1f}** (round down to {math.floor(b)} points to spend this round on traps, spawns and hazards)."
    if kind in ("room_budget", "trap_budget"):
        dens, aggr, att, esc = rng.randint(0, 100), rng.randint(0, 100), rng.randint(0, 100), rng.randint(1, 5)
        spawn, trap = ESC[esc][1], ESC[esc][2]
        if kind == "room_budget":
            bb = 1 + math.floor(dens / 100 * 6); ab = math.floor(aggr / 100 * 4); eb = esc - 1; rb = math.floor((bb + ab + eb) * spawn)
            return "formula", f"Dungeon room spawn budget: density {dens}, aggression {aggr}, escalation level {esc}.", \
                (f"- BaseBudget = 1 + floor({dens / 100:.2f} × 6) = {bb}\n- AggroBudget = floor({aggr / 100:.2f} × 4) = {ab}\n- EscBudget = {esc} − 1 = {eb}\n"
                 f"- spawnMult at escalation {esc} = {spawn}\n- RoomBudget = floor(({bb} + {ab} + {eb}) × {spawn}) = **{rb} points**\n\n"
                 "Spend it on units: 1 point scouts/vermin/small fliers, 2 workers/skirmishers/ambushers, 3 elites/casters/brutes, 4 mini boss/hive captain/armored sentinel, 6 boss phase marker/floor guardian.")
        tb = math.floor((2 + dens / 100 * 4 + att / 100 * 2) * trap)
        return "formula", f"Trap budget for a room: density {dens}, attention {att}, escalation {esc}.", \
            f"TrapBudget = floor((2 + {dens / 100:.2f} × 4 + {att / 100:.2f} × 2) × trapMult {trap}) = floor({(2 + dens / 100 * 4 + att / 100 * 2):.2f} × {trap}) = **{tb}**"
    if kind == "hfi":
        g, n, m = rng.randint(10, 100), rng.randint(10, 100), rng.randint(10, 100)
        h = g * 0.4 + n * 0.35 + m * 0.25
        cls = next(c for lo, c, r in HFI if h >= lo)
        rate = next(r for lo, c, r in HFI if h >= lo)
        return "formula", f"Hybrid Fertility Index: Genetic Proximity {g}, Nanyte Interface {n}, Mana Resonance {m}?", \
            f"HFI = ({g} × 0.4) + ({n} × 0.35) + ({m} × 0.25) = {g * 0.4:g} + {n * 0.35:g} + {m * 0.25:g} = **{h:.2f}** → {cls} (natural conception rate {rate})."
    if kind == "hybrid_mod":
        a1, a2, d4 = rng.randint(-3, 4), rng.randint(-3, 4), rng.randint(1, 4)
        v = math.floor((a1 + a2) / 2) + d4 - 2
        return "formula", f"Hybrid attribute modifier: parent species mods {sg(a1).replace(' ', '')} and {sg(a2).replace(' ', '')}, d4 roll {d4}.", \
            f"Hybrid Modifier = FLOOR((A + B) ÷ 2) + d4 − 2 = FLOOR({(a1 + a2) / 2:g}) + {d4} − 2 = {math.floor((a1 + a2) / 2)} + {d4 - 2} = **{sg(v).replace(' ', '')}**"
    if kind == "hybrid_life":
        pairs = [("Human", 80), ("Elf", 700), ("Dwarf", 350), ("Catfolk", 90), ("Wolffolk", 70), ("Bearfolk", 100), ("Orc", 60), ("Merfolk", 120), ("Lamia", 150), ("Birdfolk", 60)]
        (s1, l1), (s2, l2) = rng.sample(pairs, 2); d = rng.randint(1, 20)
        life = math.sqrt(l1 * l2) * (0.9 + d * 0.01)
        return "formula", f"Expected lifespan of a {s1}–{s2} hybrid ({s1} {l1} yrs, {s2} {l2} yrs) with a d20 roll of {d}?", \
            f"Hybrid Lifespan = √(Lifespan A × Lifespan B) × (0.9 + d20 × 0.01) = √({l1} × {l2}) × {0.9 + d * 0.01:.2f} = {math.sqrt(l1 * l2):.1f} × {0.9 + d * 0.01:.2f} ≈ **{life:.0f} years**"
    if kind == "swarm":
        n = rng.choice([5, 8, 12, 20, 40]); base = rng.randint(3, 9); e = rng.randint(1, 20); bn, mult = eff_band(e)
        return "formula", f"A swarm of {n} giant rats attacks as one unit. Base damage roll is {base}, Effectiveness Roll {e}. Attack bonus and damage?", \
            (f"- Swarm Attack Bonus: +1 per creature beyond the first = +{n - 1} (capped by Size limits; the SM may cap it lower for tiny vermin)\n"
             f"- Effectiveness {e} → {bn}: {base} × {mult:g} = {math.floor(base * mult)}\n- Damage Multiplier: × N after the Effectiveness Band = {math.floor(base * mult)} × {n} = **{math.floor(base * mult) * n}**")
    if kind == "morale":
        tot = rng.choice([40, 60, 100, 200, 500]); lost = rng.randint(1, tot - 1); pct = lost / tot * 100; pen = math.floor(pct / 25)
        return "formula", f"A unit of {tot} has lost {lost}. What is its morale penalty?", \
            f"Casualties: {lost} ÷ {tot} = {pct:.0f}%. Morale Penalty = −1 per full 25% casualties → **{sg(-pen).replace(' ', '') if pen else '0'}** to all rolls."
    if kind == "travel":
        w, mult = rng.choice([("Clear", 1.0), ("Fog", 0.8), ("Moderate rain", 0.8), ("Heavy rain", 0.7), ("Thunderstorm", 0.5), ("Snowfall", 0.7), ("Blizzard", 0.2), ("Gale", 0.7), ("Heatwave", 0.7), ("Sandstorm", 0.2)])
        dist = rng.choice([20, 30, 40, 50])
        return "formula", f"The party normally covers {dist} km a day overland. How far can they go in {w.lower()}?", \
            f"Weather Engine overland multiplier for {w.lower()}: ×{mult:g}. {dist} km × {mult:g} = **{dist * mult:g} km** for the day."
    if kind == "fatigue":
        hrs = rng.randint(2, 9); con_fail = rng.random() < 0.5
        return "formula", f"How much HP does {hrs} hours of foot travel cost, then one more hour of forced march with a {'failed' if con_fail else 'successful'} CON roll?", \
            f"- Foot travel: 10 HP per hour × {hrs} = {10 * hrs} HP\n- Forced march: 10 HP per hour on a failed CON roll only → {10 if con_fail else 0} HP\n- Total: **{10 * hrs + (10 if con_fail else 0)} HP** (natural loss is suspended during combat)."

ESC = {1: (0.8, 0.8, 0.7), 2: (1.0, 1.0, 1.0), 3: (1.2, 1.2, 1.2), 4: (1.45, 1.45, 1.45), 5: (1.8, 1.8, 1.9)}  # response, spawn, trap
HFI = [(80, "Fully Compatible", "70–90%"), (60, "High Compatibility", "40–69%"), (40, "Moderate Compatibility", "15–39%"),
       (20, "Low Compatibility", "2–14%"), (1, "Minimal Compatibility", "<2%"), (0, "Incompatible", "0%")]

# ------------------------------------------------------------------ NPC reactions and behavior
SPECIES_BIAS = [("Human", 0, "baseline, no bias"), ("Elf", 1, "seen as refined and guarded: cautious respect"),
                ("Dwarf", 1, "seen as reliable: professional respect"), ("Wolffolk", -1, "Beastfolk: guarded distance"),
                ("Catfolk", 0, "Beastfolk: alert curiosity"), ("Birdfolk", 0, "light respect mixed with suspicion"),
                ("Demon (Lilitu)", -2, "seen as dangerous or transactional: fear or enforced politeness"),
                ("an undead-marked Human", -3, "marked by death: distrust or avoidance"), ("Gemp", 1, "respected as clerks and medics"),
                ("Orc", -2, "an old regional rivalry"), ("Goblin", -2, "loyal to whoever is winning, so not trusted")]
CLASS_THREAT = [("Wizard", -1, "threat rises over time; NPCs watch for patterns"), ("Sorcerer", -2, "threat spikes fast; NPCs react defensively"),
                ("Necromancer", -3, "threat persists; NPCs remember longer"), ("Enchanter", -1, "unease without clear cause"),
                ("Cleric", 2, "low threat; NPCs relax and open dialogue"), ("Healer", 3, "harmless and useful"),
                ("Beast Tamer with a war-wolf", -1, "NPCs track the beast more than the tamer"),
                ("heavily armed Warrior", -2, "visible arms and scars"), ("unarmed traveler", 1, "no visible threat")]
SOCIAL = [("respected noble", 3), ("guild member in good standing", 1), ("unknown outsider", 0), ("commoner", 0), ("known smuggler", -2), ("wanted criminal", -3)]
REPUT = [("trusted ally (Competent tag)", 2), ("no history", 0), ("tagged Dangerous after a brawl", -2), ("tagged Untrustworthy after a broken deal", -3), ("helped their family last month", 3)]
ATTENTION = [("polite greeting and a fair offer", 1), ("generous gift and respect for local custom", 3), ("plain request", 0),
             ("impatient demand", -2), ("open insult", -3), ("flattery that lands", 2)]
WEATHER_NPC = [("Clear skies", 0, "normal behavior, good mood"), ("Rain", -1, "grumpy; people seek shelter"), ("Thunderstorm", -2, "streets empty, only essential guards"),
               ("Blizzard", 1, "shared danger bonds people"), ("Heatwave", -1, "tempers are short"), ("Fog", 0, "cautious; guards on high alert")]
NPCS = ["a tavern keeper", "a city gate sergeant", "a guild registrar", "a temple almoner", "a dock foreman", "a merchant-prince's steward",
        "a dwarven forge master", "a Catfolk information broker", "a village elder", "a magistrate's clerk", "a Wolffolk pack elder", "a noble's bodyguard"]

def stance(res):
    if res in ("Disastrous", "Very Bad", "Bad"): return "hostile stance"
    if res in ("Poor", "Neutral"): return "neutral stance"
    return "ally stance"

def gen_npc_reaction(rng):
    npc = rng.choice(NPCS)
    sb = rng.choice(SPECIES_BIAS); ct = rng.choice(CLASS_THREAT); so = rng.choice(SOCIAL); rp = rng.choice(REPUT); at = rng.choice(ATTENTION)
    w = rng.choice(WEATHER_NPC) if rng.random() < 0.5 else None
    raw = rng.randint(1, 20)
    mods = [("Species Bias", sb[1], f"{sb[0]} — {sb[2]}"), ("Class Threat", ct[1], f"{ct[0]} — {ct[2]}"), ("Social Position", so[1], so[0]),
            ("Reputation Memory", rp[1], rp[0]), ("Personal Attention", at[1], at[0])]
    if w and w[1]: mods.append(("Weather", w[1], f"{w[0]} — {w[2]}"))
    tot = raw + sum(m[1] for m in mods)
    res, desc = reaction(tot)
    q = (f"{cap(npc)} meets {art(sb[0] if not sb[0].startswith('an ') else sb[0][3:])} {ct[0].lower()} ({so[0]}, {rp[0]}) who opens with {art(at[0])}."
         + (f" Weather: {w[0].lower()}." if w else "") + f" Reaction roll is {raw}. How does the NPC react?")
    out = ["The NPC Social Behavior Engine's five inputs (each −3 to +3) become the Reaction Roll modifiers:", ""]
    out += [f"- {n}: {sg(v).replace(' ', '')} ({why})" for n, v, why in mods]
    out += ["", f"**Reaction Roll:** {raw} {' '.join(sg(v) for _, v, _ in mods if v)} = **{tot}** → **{res}**: {desc}.", "",
            f"**Reaction phases:** after Observation (posture, gear, spell residue, beasts) and Testing (low-risk questions), {npc} commits to a **{stance(res)}**.",
            "**Memory:** " + ("the encounter shifts the Competent tag one step up." if res in ("Good", "Very Good", "Excellent") else
                               "the encounter shifts the Untrustworthy or Dangerous tag one step." if stance(res) == "hostile stance" else
                               "nothing changes yet — the NPC files the meeting away and waits.")]
    return "npc_reaction", q, "\n".join(out)

DISPO = [(-100, -75, "Hateful", "will attack on sight and actively seeks the character's destruction"), (-74, -50, "Hostile", "will not cooperate, may attack if provoked, and works against them"),
         (-49, -25, "Cold", "dismissive, minimal interaction, will not help"), (-24, -1, "Wary", "cautious; will interact but watches for betrayal"),
         (0, 0, "Neutral", "no opinion; evaluates each interaction freshly"), (1, 24, "Warm", "positively disposed; helps with simple requests"),
         (25, 49, "Friendly", "cooperative; offers information and help willingly"), (50, 74, "Trusting", "deep confidence; shares secrets and takes risks for the character"),
         (75, 100, "Devoted", "unconditional loyalty; will sacrifice for the character")]
def dispo(v): return next((n, d) for lo, hi, n, d in DISPO if lo <= v <= hi)
TRIGGERS = [("draws a weapon in the hall", "Weapons Drawn", 4), ("casts a glowing spell to light the room", "Visible Magic Signature", 2),
            ("walks in still bleeding from a fight", "Blood Scent", 3), ("spills a sack of looted gold on the table", "Open Loot Display", 2),
            ("contradicts the NPC's captain in front of the troops", "Authority Challenged", 3)]
AXES = {"Confidence": ["timid", "steady", "assertive", "dominant"], "Impulse Control": ["controlled", "measured", "reactive", "volatile"],
        "Sociability": ["reserved", "selective", "social", "gregarious"], "Ethical Frame": ["lawful", "pragmatic", "flexible"]}

def gen_npc_behavior(rng):
    npc = rng.choice(NPCS); v = rng.choice([-60, -30, -10, 0, 10, 20, 35, 55, 80])
    label, desc = dispo(v)
    ax = {k: rng.choice(opts) for k, opts in AXES.items()}
    act, trig, tension = rng.choice(TRIGGERS)
    who = rng.choice(["the party's orc warrior", "the elven mage", "the Catfolk rogue", "the human paladin", "the Gemp medic", "the party leader"])
    q = (f"{cap(npc)} has Disposition {v:+d} toward the party ({', '.join(f'{k} {x}' for k, x in ax.items())}). {cap(who)} {act}. How does the NPC respond?")
    impulse = {"controlled": "keeps their voice level and lets procedure handle it", "measured": "pauses, weighs it, and answers firmly",
               "reactive": "reacts sharply and immediately", "volatile": "flares up at once — this can turn physical"}[ax["Impulse Control"]]
    conf = {"timid": "look for someone else to take charge", "steady": "hold their ground", "assertive": "take control of the moment",
            "dominant": "dominate the room and give orders"}[ax["Confidence"]]
    out = [f"**Current Disposition:** {v:+d} → **{label}** — {desc}.", "",
           f"**Escalation Trigger:** {trig} (+{tension} tension). Escalation means shorter patience, more guards present and harder negotiation checks.", "",
           f"**Behavioral axes in play:** Impulse Control {ax['Impulse Control']} — the NPC {impulse}. Confidence {ax['Confidence']} — they {conf}. "
           f"Ethical Frame {ax['Ethical Frame']} — " + {"lawful": "they cite the rules and may call the watch.", "pragmatic": "they think about what it costs them.",
                                                       "flexible": "they may let it slide if it benefits them."}[ax["Ethical Frame"]], ""]
    if v >= 50:
        out.append(f"At {label}, trust absorbs the shock: the NPC is alarmed but gives {who} the benefit of the doubt — and expects an explanation.")
    elif v >= 1:
        out.append(f"At {label}, goodwill thins fast: expect Disposition to slip toward Wary, and the NPC will ask {who} to stop now.")
    elif v >= -24:
        out.append(f"At {label}, this confirms their suspicion: Disposition likely drops into Cold, and they stop offering help.")
    else:
        out.append(f"At {label}, this is the excuse they wanted: they escalate — guards are called, prices double or a fight starts.")
    out += ["", f"**Memory:** {'Dangerous' if tension >= 3 else 'Untrustworthy' if trig == 'Open Loot Display' else 'Dangerous'} tag shifts one step for {who}; "
            "repeated behavior locks the tag, and locked tags need a major event to change. The change carries forward through the Capstone."]
    return "npc_behavior", q, "\n".join(out)

# ------------------------------------------------------------------ weather and skills
WEATHER_SKILL = [("Rain", "Ranged Weapons", "DEX", -1, "ranged attacks −1 in rain; bowstrings need waxing, fire arrows fail"),
                 ("Heavy rain", "Ranged Weapons", "DEX", -2, "ranged attacks −2 in heavy rain"),
                 ("Thunderstorm", "Ranged Weapons", "DEX", -3, "ranged attacks −3 in a thunderstorm"),
                 ("Gale", "Ranged Weapons", "DEX", -2, "wind deflection: ranged −2; thrown weapons are useless"),
                 ("Heavy rain", "Melee Weapons", "STR", -1, "footing: melee −1 in heavy rain"),
                 ("Blizzard", "Melee Weapons", "STR", -2, "melee −2 in a blizzard"),
                 ("Ice storm", "Melee Weapons", "STR", -2, "footing: melee −2 on ice; a critical failure means falling prone"),
                 ("Sandstorm", "Melee Weapons", "STR", -3, "melee −3 in a sandstorm"),
                 ("Blizzard", "Survival", "WIS", -2, "all checks −2 in a blizzard"),
                 ("Blizzard", "Navigation", "INT", -2, "all checks −2 in a blizzard"),
                 ("Moderate rain", "Tracking", "WIS", -2, "tracking −2: tracks washed away or covered"),
                 ("Snowfall", "Tracking", "WIS", -2, "tracking −2: tracks covered by snow"),
                 ("Light drizzle", "Survival", "WIS", -1, "fire starting at −1 on damp ground"),
                 ("Fog", "Stealth", "DEX", 3, "fog gives Stealth +3 and Ambush +3"),
                 ("Moderate wind (16–40 km/h)", "Ranged Weapons", "DEX", -1, "ranged −1 beyond 50 m in moderate wind"),
                 ("Strong wind (41–60 km/h)", "Ranged Weapons", "DEX", -2, "ranged −2 in strong wind; torches go out"),
                 ("Clear skies", "Stealth", "DEX", 0, "no weather modifier"), ("Heatwave", "Endurance", "CON", 0, "heavy armor: CON check every hour or exhaustion")]

def gen_weather_skill(rng):
    w, skill, at, mod, why = rng.choice(WEATHER_SKILL)
    lvl, av, raw = rng.choice([0, 5, 10, 12, 15, 20, 25, 35]), rng.choice([8, 10, 11, 12, 14, 15, 17]), rng.randint(1, 20)
    tot = raw + skill_shift(lvl) + attr_shift(av) + mod; band = base_band(tot)
    task = {"Ranged Weapons": "hit the target", "Melee Weapons": "land the blow", "Survival": "make camp and start a fire", "Navigation": "keep the party on course",
            "Tracking": "follow the trail", "Stealth": "slip past the sentries", "Endurance": "keep marching in armor"}[skill]
    solo = rng.random() < 0.2
    q = f"Weather: {w.lower()}. {skill} {lvl}, {at} {av}, natural roll {raw}. I try to {task}." + (" (Solo play.)" if solo else "")
    out = ["**Skill check with weather** (First Edition check + Weather Engine modifiers):", "",
           f"- d20 {raw} {sg(skill_shift(lvl))} (Skill Shift) {sg(attr_shift(av))} ({at} Shift)" + (f" {sg(mod)} (weather)" if mod else "") + f" = **{tot}** → {band}",
           f"- Weather effect: {why}.", ""]
    out.append({"Success": f"You {task}.", "Uncertain": "Uncertain — the Session Master decides, and the weather is the obvious complication.",
                "Fail": f"You fail to {task}; the weather wins this round."}[band])
    if solo and band != "Success":
        out.append("Solo Play: failure redirects instead of halting — turn it into a partial success, a manageable setback or another path forward.")
    return "weather_skill", q, "\n".join(out)

# ------------------------------------------------------------------ weather and spellcasting
def load_matrix(path):
    lines = [l.strip() for l in open(path, encoding="utf8").read().split("\n")]
    m, el = {}, None
    i = lines.index("ELEMENT BY WEATHER MATRIX") + 1
    while i < len(lines):
        l = lines[i]
        if l == "AI SM usage": break
        if l and l.upper() == l and not l.startswith(("POTENCY", "STABILITY")) and re.match(r"^[A-Z ]+$", l): el = l.title(); i += 1; continue
        if el and l and i + 2 < len(lines) and lines[i + 1].startswith("Potency"):
            p = int(lines[i + 1].split()[1].replace("−", "-").replace("+", "")); s = int(lines[i + 2].split()[1].replace("−", "-").replace("+", ""))
            eff = lines[i + 3][7:] if i + 3 < len(lines) and lines[i + 3].startswith("Effect") else ""
            m.setdefault(el, {})[l] = (p, s, eff); i += 4; continue
        i += 1
    return m
MATRIX = load_matrix(gen.os.path.join(gen.SRC_DIR, "SPELLCASTING WEATHER INTERACTION AI Profile.txt"))
PRECIP_WIND = {"Rain", "Heavy rain", "Storm thunder", "Snow", "Blizzard", "Wind", "Gale"}
ELEMENT_SPELLS = {"Fire": ("Ember Lance", "2d6", 40), "Water": ("Tidal Whip", "2d6", 35), "Air": ("Cutting Gust", "1d6+2", 30),
                  "Lightning": ("Arc Bolt", "3d6", 60), "Ice": ("Frost Spike", "2d6+1", 45), "Light": ("Radiant Beam", "2d6", 50),
                  "Shadow": ("Gloom Grasp", "1d6+1", 30), "Earth": ("Stone Fist", "2d6+1", 40), "Nature": ("Thorn Lash", "1d6+2", 30),
                  "Metal": ("Iron Shards", "2d6", 45), "Arcane Neutral": ("Mana Dart", "1d6+1", 20)}

def gen_weather_cast(rng):
    el = rng.choice([e for e in MATRIX if e in ELEMENT_SPELLS]); weather = rng.choice(list(MATRIX[el]))
    p, s, eff = MATRIX[el][weather]
    spell, dmg, cost = ELEMENT_SPELLS[el]
    lvl, intel, raw = rng.choice([12, 15, 20, 25, 30, 40]), rng.choice([12, 14, 15, 16, 18]), rng.randint(1, 20)
    mastery = rng.random() < 0.3; ritual = weather in PRECIP_WIND and rng.random() < 0.3
    q = (f"My caster uses {spell} ({el}, {cost} MP, {dmg} damage) in {weather.lower()} weather. Spell skill {lvl}, INT {intel}, d20 = {raw}."
         + (" They have weather mastery." if mastery else "") + (" They prepared a ritual first." if ritual else ""))
    adj_p, adj_s = p, s
    notes = []
    if mastery and (p < 0 or s < 0):
        off_p = min(2, max(0, -p)); off_s = min(2 - off_p, max(0, -s)) if off_p < 2 else 0
        adj_p += off_p; adj_s += off_s
        notes.append(f"Mastery offsets up to +2 total: Potency {sg(off_p).replace(' ', '')}, Stability {sg(off_s).replace(' ', '')}.")
    if ritual and (adj_p < 0 or adj_s < 0):
        if adj_s < 0: adj_s += 1; notes.append("Prepared ritual offsets precipitation or wind by +1 (applied to Stability).")
        else: adj_p += 1; notes.append("Prepared ritual offsets precipitation or wind by +1 (applied to Potency).")
    tot = raw + skill_shift(lvl) + attr_shift(intel); band = base_band(tot)
    out = [f"**Weather interaction** ({el} in {weather.lower()}, Spellcasting Weather Interaction profile): Potency {sg(p).replace(' ', '')}, Stability {sg(s).replace(' ', '')} — side effect: {eff}."]
    out += notes
    if notes: out.append(f"Adjusted: Potency {sg(adj_p).replace(' ', '')}, Stability {sg(adj_s).replace(' ', '')}.")
    out += ["", f"**Casting check:** d20 {raw} {sg(skill_shift(lvl))} (Skill {lvl}) {sg(attr_shift(intel))} (INT {intel}) = **{tot}** → {band}"]
    if band == "Fail":
        out += ["", f"The spell fails. The Session Master decides whether the {cost} MP is lost; the weather still shows its side effect ({eff})."]
        return "weather_casting", q, "\n".join(out)
    if adj_s < -2:
        m = rng.randint(1, 20)
        out += ["", f"Stability {adj_s} is below −2, so the Session Master rolls for a miscast: d20 {m} → " +
                ("1–6: **miscast** — the spell drifts, disperses or backfires as the weather dictates." if m <= 6 else "it holds together this time.")]
        if m <= 6:
            out.append(f"Mana spent: {cost} MP."); return "weather_casting", q, "\n".join(out)
    if band == "Uncertain": out.append("Uncertain — the Session Master rules the spell takes hold, but imperfectly.")
    e = rng.randint(1, 20); bn, mult = eff_band(e)
    rolls, d, mod = roll_dice(rng, dmg)
    base = math.floor(d * mult); final = max(0, base + adj_p)
    out += ["", f"**Effectiveness:** d20 {e} → {bn}. Damage {fmt_roll(dmg, rolls, d, mod)} × {mult:g} = {base}.",
            f"**Potency {sg(adj_p).replace(' ', '')}** raises or lowers magnitude, range or duration; applied here to damage: {base} {sg(adj_p)} = **{final}**.",
            f"Side effect in the scene: {eff}. Mana spent: {cost} MP."]
    return "weather_casting", q, "\n".join(out)

WEATHER_SPELLS = [("Predict Weather", 1, 5, "accurate forecast for 24 hours within 50 km"), ("Wind Gust", 1, 8, "a burst of Wind level 3 in a 10 m cone"),
                  ("Fog Bank", 2, 12, "FOGGY conditions in a 500 m radius for 1 hour"), ("Call Rain", 3, 25, "rain within 1 km for 2 hours — needs existing clouds"),
                  ("Wind Wall", 3, 20, "a 20 m wall of level 5 wind for 10 minutes that deflects projectiles"),
                  ("Lightning Call", 4, 25, "a 4d20 lightning strike on a target — auto-success, but only during a STORM"),
                  ("Control Wind", 5, 40, "set wind direction and strength (up to level 4) within 2 km for 2 hours"),
                  ("Summon Storm", 6, 60, "STORM conditions within 5 km after 30 minutes, lasting 4 hours"),
                  ("Clear Skies", 6, 60, "force CLEAR conditions within 5 km for 8 hours")]
def gen_weather_spell(rng):
    name, lv, cost, eff = rng.choice(WEATHER_SPELLS)
    water = rng.random() < 0.3
    mp = rng.choice([cost - 3, cost * 2, cost * 10, cost * 50]) if cost > 3 else cost * 10
    cur = rng.choice(["clear skies", "overcast", "a thunderstorm", "heavy rain", "a heatwave"])
    q = f"Can my weather-mage cast {name} right now? Current weather: {cur}. They have {mp} MP."
    out = [f"**{name}** (Weather Engine, level {lv}): {eff}. Cost {cost} MP."]
    if mp < cost:
        out.append(f"With {mp} MP the caster is {cost - mp} MP short — not yet."); return "weather_casting", q, "\n".join(out)
    if name == "Lightning Call" and cur != "a thunderstorm":
        out.append(f"No: Lightning Call only works during a STORM, and right now it is {cur}. Cast Summon Storm first (60 MP, 30 minutes to form)."); return "weather_casting", q, "\n".join(out)
    if name == "Call Rain" and cur in ("clear skies", "a heatwave"):
        out.append(f"Not yet: Call Rain needs existing moisture (clouds), and the sky is {cur}. Cast Cloud Cover first (15 MP)."); return "weather_casting", q, "\n".join(out)
    out.append(f"Yes. {mp} MP − {cost} MP = **{mp - cost} MP** remaining. Make the casting check as usual.")
    if name == "Lightning Call": out.append("Lightning Call auto-succeeds — the storm does the aiming. Roll 4d20 damage. Metal armor conducts: +2 damage from lightning in a storm.")
    return "weather_casting", q, "\n".join(out)

# ------------------------------------------------------------------ dungeon creatures vs solo and group
# Example dungeon stock, sorted by the Dungeon Creation profile's spawn styles and point costs.
BY_TRIGGER = {
    "Noise": [("Screamer Bat flock", 1, "scouts/small fliers", "Swarm Brain"), ("Tunnel Runner", 2, "fast flanker", "Predator Brain"),
              ("Howler Brute", 3, "brute", "Ward Breaker Brain"), ("Echo Captain", 4, "mini boss", "Swarm Brain")],
    "Magic": [("Mana Mite cloud", 1, "vermin", "Swarm Brain"), ("Spell Mirror", 2, "skirmisher", "Sentinel Brain"),
              ("Null Wraith", 3, "caster", "Hunter-Killer Brain"), ("Obsidian Sentinel", 4, "armored sentinel", "Sentinel Brain")],
    "Blood": [("Leech swarm", 1, "vermin", "Swarm Brain"), ("Bloodhound Stalker", 2, "tracker", "Predator Brain"),
              ("Carrion Brute", 3, "brute", "Predator Brain"), ("Parasite Queen", 4, "mini boss", "Hunter-Killer Brain")],
    "Loot": [("Coin Sprite", 1, "small flier", "Swarm Brain"), ("Mimic Chest", 2, "ambusher", "Predator Brain"),
             ("Vault Sentry", 3, "elite", "Sentinel Brain"), ("Hoard Warden", 4, "armored sentinel", "Sentinel Brain")],
    "Reality": [("Echo Mote", 1, "scout", "Swarm Brain"), ("Echo Double", 2, "skirmisher", "Hunter-Killer Brain"),
                ("Phase Stalker", 3, "elite", "Predator Brain"), ("Time Wraith", 4, "mini boss", "Hunter-Killer Brain")]}
GUARDIAN = ("Floor Guardian", 6, "boss phase marker", "Sentinel Brain")
BRAIN = {"Predator Brain": "flanks, focus-fires the most-bleeding target and retreats when wounded to fetch reinforcements",
         "Hunter-Killer Brain": "ignores summons and assassinates healers and controllers first",
         "Ward Breaker Brain": "throws bodies at shields and triggers traps to break concentration",
         "Swarm Brain": "floods lanes, climbs walls and triggers Loot Disturbance to escalate the dungeon",
         "Sentinel Brain": "holds ground, punishes magic users and fights defensively"}
CREATURES = [c + (BRAIN[c[3]],) for v in BY_TRIGGER.values() for c in v]
ROLES_PARTY = {"Anchor (tank)": "Guard", "Lifeline (healer)": "Restoration Casting", "Hammer (damage)": "Melee Weapons", "Swiss Army Knife (scout/utility)": "Stealth"}

def gen_dungeon_encounter(rng):
    dens, aggr, esc = rng.randint(10, 90), rng.randint(10, 90), rng.randint(1, 5)
    spawn = ESC[esc][1]
    bb = 1 + math.floor(dens / 100 * 6); ab = math.floor(aggr / 100 * 4); rb = math.floor((bb + ab + esc - 1) * spawn)
    solo = rng.random() < 0.4
    meters = {"Noise": rng.randint(5, 80), "Magic": rng.randint(5, 80), "Blood": rng.randint(5, 80), "Loot": rng.randint(5, 80), "Reality": rng.randint(0, 40)}
    prim = max(meters, key=meters.get)
    style = {"Noise": "fast flankers, screamers, runners", "Magic": "null units, ward breakers, spell mirrors", "Blood": "trackers, scavengers, parasites",
             "Loot": "mimics, coin sprites, vault sentries", "Reality": "phase stalkers, echo doubles, time wraiths"}[prim]
    budget = rb if not solo else max(1, rb // 2)
    pool = [c + (BRAIN[c[3]],) for c in BY_TRIGGER[prim]] + ([GUARDIAN + (BRAIN[GUARDIAN[3]],)] if esc >= 4 and not solo else [])
    picks, left = [], budget
    for c in sorted(pool, key=lambda c: -c[1]):
        while c[1] <= left and len(picks) < 6:
            picks.append(c); left -= c[1]
            if rng.random() < 0.5: break
    party = "a solo adventurer" if solo else f"a party of {rng.randint(3, 6)}"
    q = (f"Stock the next dungeon room for {party}. Density {dens}, aggression {aggr}, escalation {esc}. Meters: "
         + ", ".join(f"{k} {v}" for k, v in meters.items()) + ".")
    out = [f"**Room budget:** floor(({bb} BaseBudget + {ab} AggroBudget + {esc - 1} EscBudget) × spawnMult {spawn}) = **{rb} points**."]
    if solo:
        out.append(f"**Solo Play scaling:** enemy numbers reduced, damage moderated, an escape route always present. Spend about half: **{budget} points**, no floor guardians.")
    out += [f"**Primary trigger:** {prim} ({meters[prim]}) → spawn style: {style}.", "", "**Spawns:**"]
    out += [f"- {c[0]} ({c[1]} pt, {c[2]}) — {c[3]}: {c[4]}." for c in picks] or ["- Nothing affordable — the room stays quiet, but the meters keep climbing."]
    out.append(f"\nPoints spent: {budget - left} of {budget}" + (f"; {left} left over to arm a trap or hold in reserve." if left else "."))
    if not solo:
        tgt = {"Hunter-Killer Brain": "the Lifeline (healer)", "Predator Brain": "whoever is bleeding most", "Ward Breaker Brain": "the Anchor's shield and any caster holding concentration",
               "Sentinel Brain": "the spellcasters", "Swarm Brain": "everyone at once, through the widest lane"}
        out += ["", "**Target priority against the group:**"] + [f"- {c[0]} goes for {tgt[c[3]]}." for c in {c[0]: c for c in picks}.values()]
    else:
        out += ["", "**Against one player:** creatures that would focus a healer or caster simply press the solo hero, but the room shows a side passage or collapsing wall as an escape route, and any 1–6 roll redirects the story rather than ending it."]
    return "dungeon_encounter", q, "\n".join(out)

def gen_dungeon_check(rng):
    c = rng.choice(CREATURES)
    per_lvl, per_attr = rng.choice([5, 10, 15, 20]), rng.choice([10, 12, 14, 16])
    solo = rng.random() < 0.35
    members = [("Kaelen", rng.choice([0, 5, 10]), rng.choice([9, 10, 11])), ("Nyx", rng.choice([15, 20, 25]), rng.choice([14, 15, 16])),
               ("Borin", rng.choice([0, 3]), rng.choice([8, 9])), ("Lyra", rng.choice([10, 12]), rng.choice([12, 13]))]
    members = members[:1] if solo else rng.sample(members, rng.randint(2, 4))
    q = (f"{'A solo hero' if solo else 'The party'} tries to sneak past {art(c[0])} (Perception {per_lvl}, INT {per_attr}). "
         + "; ".join(f"{n}: Stealth {s}, DEX {d}" for n, s, d in members) + ". Roll it out.")
    cr = rng.randint(1, 20); ct = cr + skill_shift(per_lvl) + attr_shift(per_attr)
    out = ["Each sneaker makes a **Quick Contest** of Stealth against the creature's Perception. A better band beats a worse one; in the same band the higher total wins.", "",
           f"- {c[0]} Perception: d20 {cr} {sg(skill_shift(per_lvl))} {sg(attr_shift(per_attr))} = **{ct}** ({base_band(ct)})"]
    spotted = []
    order = {"Fail": 0, "Uncertain": 1, "Success": 2}
    for n, s, d in members:
        r = rng.randint(1, 20); t = r + skill_shift(s) + attr_shift(d)
        win = order[base_band(t)] > order[base_band(ct)] or (order[base_band(t)] == order[base_band(ct)] and t > ct)
        out.append(f"- {n} Stealth: d20 {r} {sg(skill_shift(s))} {sg(attr_shift(d))} = **{t}** ({base_band(t)}) → {'unseen' if win else 'spotted'}")
        if not win: spotted.append(n)
    out.append("")
    if not spotted: out.append(f"Everyone slips past. The {c[0]} never knows.")
    elif solo:
        out.append(f"{spotted[0]} is spotted — but under Solo Play the failure becomes a warning: the {c[0]} turns toward the noise, giving one round to hide, flee or strike first.")
    else:
        out.append(f"{', '.join(spotted)} {'is' if len(spotted) == 1 else 'are'} spotted. With its {c[3]}, the {c[0]} {c[4]}. Noise Spike rises for the dungeon's next round.")
    return "dungeon_check", q, "\n".join(out)

GENERATORS2 = {"formula": (gen_formula, 560), "reaction_roll": (gen.gen_reaction, 120), "npc_reaction": (gen_npc_reaction, 220),
               "npc_behavior": (gen_npc_behavior, 160), "weather_skill": (gen_weather_skill, 170), "weather_casting": (gen_weather_cast, 190),
               "weather_spell": (gen_weather_spell, 50), "dungeon_encounter": (gen_dungeon_encounter, 140), "dungeon_check": (gen_dungeon_check, 130)}

def generate(seed=4242):
    rng = random.Random(seed)
    out, seen = [], set()
    for x in role_builds(rng, per_combo=4):
        if x[1] not in seen: seen.add(x[1]); out.append(x)
    for cat, (fn, n) in GENERATORS2.items():
        made = tries = 0
        while made < n and tries < n * 8:
            tries += 1
            r = fn(rng)
            c, q, a = (r if len(r) == 3 else (cat,) + r)
            if q in seen: continue
            seen.add(q); out.append((c, q, a)); made += 1
    return out

if __name__ == "__main__":
    import collections
    ex = generate()
    print(len(ex), collections.Counter(c for c, _, _ in ex))
    rng = random.Random(1)
    for cat in sorted({c for c, _, _ in ex}):
        c, q, a = rng.choice([x for x in ex if x[0] == cat])
        print("=" * 20, cat, "\nQ:", q, "\nA:", a[:1400])
