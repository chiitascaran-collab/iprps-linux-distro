# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Generates rule-grounded IPRPS training examples: character builds, skill checks,
reaction rolls, combat in every system, and spellcasting with the official spell lists.

All stats a scenario needs are stated in the question, and the answer applies the First
Edition rules step by step, so the model learns the procedure without invented canon.
"""
import json, math, random, re
from rules import *

# ---------------------------------------------------------------- book data
import os
FE_PATH = os.environ.get("IPRPS_FIRST_EDITION", "first_edition.md")
SRC_DIR = os.environ.get("IPRPS_SRC", "src")

def load_book(path=None):
    path = path or FE_PATH
    fe = open(path, encoding="utf8").read()
    fl = fe.split("\n")
    skills = {}
    for i, l in enumerate(fl):
        if l.startswith("Attribute:"):
            j, buf = i - 1, []
            while j > 0 and len(buf) < 3:
                if fl[j].strip(): buf.append(fl[j].strip())
                j -= 1
            if len(buf) >= 2:
                m = re.search(r"\b(STR|DEX|CON|INT|WIS|CHA|WIL)\b", l)
                if m and buf[1] not in skills: skills[buf[1]] = m.group(1)
    skills.update({"Backstab Techniques": "DEX", "Ballistics or Trajectory Reading": "INT", "Battle Discipline": "WIL",
                   "Divine Invocation": "WIS", "Entity Negotiation": "CHA", "Escape and Evasion": "DEX",
                   "Explosives or Fabrication": "INT", "Inspiration": "CHA", "Nature Lore": "INT", "Pact Binding": "WIL",
                   "Poison Use": "INT", "Riding or Mounted Combat": "DEX", "Security": "DEX", "Stealth": "DEX",
                   "Systems Diagnostics": "INT", "Target Analysis": "INT", "Riding": "DEX", "Carousing": "CON",
                   "Haggling": "CHA", "Gambling": "INT"})
    sec = fe[fe.index("## Recommended Skills by Character Class"):fe.index("# The Beginner’s Guide")]
    L = [l.strip() for l in sec.split("\n")[1:]]
    is_head = lambda i: L[i] and i + 1 < len(L) and L[i + 1].endswith(".") and not L[i].endswith(".")
    classes, i = {}, 0
    while i < len(L):
        if is_head(i):
            name, desc, i, sk = L[i], L[i + 1], i + 2, []
            while i < len(L) and not is_head(i):
                if L[i]: sk.append(L[i])
                i += 1
            classes[name] = (desc, sk)
        else: i += 1
    def costs(a, b, neg):
        out = []
        for k in range(a, b):
            m = re.match(r"^(-?\d+) points?$", fl[k].strip())
            if m and (int(m.group(1)) < 0) == neg:
                j = k - 1
                while not fl[j].strip(): j -= 1
                out.append((fl[j].strip(), int(m.group(1))))
        return out
    s_adv = fe[:fe.index("# Disadvantages")].count("\n")
    s_dis = s_adv; e_dis = fe[:fe.index("## Quirks")].count("\n")
    advantages = [a for a in costs(fe[:fe.index("## Advantages List")].count("\n"), s_adv, False) if 5 <= a[1] <= 50]
    disadvantages = [d for d in costs(s_dis, e_dis, True) if -30 <= d[1] <= -5]
    return skills, classes, advantages, disadvantages

SKILLS, CLASSES, ADVANTAGES, DISADVANTAGES = load_book()

COMMON_SKILLS = ["Athletics", "Perception", "Stealth", "Climbing", "Swimming", "First Aid", "Riding", "Survival", "Carousing",
                 "Navigation", "Endurance", "Etiquette", "Haggling", "Cooking", "Gambling", "Streetwise"]

CASTERS = {"Mage", "Wizard", "Sorcerer", "Warlock", "Cleric", "Druid", "Necromancer", "Enchanter/Artificer", "Healer", "Knight/Paladin", "Bard", "Beast Tamer"}

# Species: (name, size, favored attributes, weak attributes) — from the Master AI Profile species table.
SPECIES = [("Human", 0, [], []), ("Elf", 0, ["DEX", "INT", "CHA"], ["STR", "CON"]),
           ("Dwarf", 0, ["STR", "CON", "WIL"], ["DEX", "CHA"]), ("Catfolk", -1, ["DEX", "WIS", "CHA"], ["STR"]),
           ("Wolffolk", 0, ["STR", "CON", "WIS"], ["INT"]), ("Bearfolk", 1, ["STR", "CON", "WIL"], ["DEX", "INT"]),
           ("Birdfolk", -1, ["DEX", "WIS", "CHA"], ["STR", "CON"]), ("Rabbitfolk", -1, ["DEX", "WIS"], ["STR"]),
           ("Gemp", -1, ["INT", "WIS"], ["STR", "CON"]), ("Orc", 1, ["STR", "CON"], ["INT", "WIS"]),
           ("Goblin", -2, ["DEX"], ["STR", "WIL"]), ("Demon (Lilitu)", 0, ["CHA", "INT"], ["WIL"]),
           ("Angelicus", 0, ["WIS", "WIL", "INT"], []), ("Lamia", 1, ["STR", "WIS"], []), ("Merfolk", 0, ["DEX", "CON"], [])]

SYL = {"Human": (["Ka", "Ma", "Ro", "Li", "Be", "Ta", "Jo", "El", "Da", "Wi"], ["len", "ris", "ra", "son", "na", "vin", "lia", "dric"]),
       "Elf": (["Ae", "Lu", "Sy", "Ela", "Ith", "Fae", "Vae"], ["rien", "thil", "wyn", "lara", "dor", "niel"]),
       "Dwarf": (["Bor", "Thra", "Dur", "Gim", "Kha", "Bru"], ["in", "grim", "dak", "rek", "nar", "li"]),
       "Catfolk": (["Ny", "Mi", "Rr", "Sha", "Pu", "Ki"], ["x", "ri", "ssa", "rra", "li", "va"]),
       "Wolffolk": (["Var", "Gre", "Ul", "Fen", "Rok", "Ash"], ["ric", "ka", "an", "ra", "wulf", "dyn"]),
       "Bearfolk": (["Ur", "Ber", "Gro", "Mau", "Hal", "Tor"], ["sa", "nok", "dun", "ga", "mund", "bo"]),
       "Birdfolk": (["Ky", "Lyr", "Pip", "Ae", "Swi", "Ree"], ["ra", "ri", "lo", "fa", "ka", "sel"]),
       "Rabbitfolk": (["Thu", "Bri", "Hop", "Clo", "Fen", "Pi"], ["mble", "ar", "ver", "ny", "skit", "lo"]),
       "Gemp": (["Sub", "Cel", "Nim", "Ori", "Vex", "Tal"], ["ject", "ra", "bo", "ex", "in", "is"]),
       "Orc": (["Gro", "Krag", "Ur", "Zug", "Mok", "Thar"], ["nak", "gul", "ok", "ash", "dar", "ruk"]),
       "Goblin": (["Snik", "Zib", "Krik", "Nob", "Gix", "Rat"], ["ble", "zit", "et", "nik", "ka", "tle"]),
       "Demon (Lilitu)": (["Vor", "Lil", "Mal", "Xer", "Ash", "Ze"], ["gath", "ith", "eth", "ara", "vex", "ra"]),
       "Angelicus": (["Sera", "Ura", "Ael", "Cael", "Ori", "Lum"], ["phina", "iel", "on", "ara", "is", "en"]),
       "Lamia": (["Ssa", "Ves", "Nag", "Sye", "Ha", "Iss"], ["ri", "ssa", "ira", "va", "eth", "ka"]),
       "Merfolk": (["Ma", "Cor", "Nai", "Thal", "Pe", "Ri"], ["rel", "ina", "ad", "assa", "rin", "lo"])}

def name_for(rng, species):
    a, b = SYL.get(species, SYL["Human"])
    return rng.choice(a) + rng.choice(b)

GENRES = ["high fantasy", "steampunk", "Western", "space opera", "horror", "urban fantasy", "Feudal Japan",
          "pirate", "Classical Antiquity", "dungeon crawl", "Royal Court intrigue", "post-apocalyptic zombie survival"]

def money_tier(points):
    for lo, hi, n in POINT_TIERS:
        if lo <= points <= hi: return n

# ---------------------------------------------------------------- character builds
def primary_attrs(cls, species_fav):
    counts = {}
    for s in CLASSES[cls][1]:
        a = SKILLS.get(s)
        if a: counts[a] = counts.get(a, 0) + 1
    ranked = sorted(counts, key=lambda a: -counts[a])
    if cls in CASTERS and "INT" not in ranked[:2]: ranked.insert(1, "INT")
    out = []
    for a in ranked + species_fav + ["CON"]:
        if a not in out: out.append(a)
    return out[:4]

def build_character(rng, points, species, cls):
    sname, size, fav, weak = species
    attrs = {a: 10 for a in ATTRS}
    lines_adv, lines_dis = [], []
    spent = 0
    # disadvantages (capped at half the starting points) and lowered attributes
    dis_total = 0
    for d, c in rng.sample(DISADVANTAGES, rng.choice([0, 1, 1, 2])):
        if dis_total + (-c) <= points // 2 and -c <= points * 0.25:
            lines_dis.append((d, c)); dis_total += -c
    if weak and rng.random() < 0.7:
        a = rng.choice(weak)
        if a not in primary_attrs(cls, fav):
            attrs[a] = rng.choice([8, 9])
    quirks = rng.randint(0, 3)
    budget = points + dis_total + quirks + sum(-attr_cost(a, v) for a, v in attrs.items() if v < 10)
    # advantages
    for a, c in rng.sample(ADVANTAGES, rng.choice([0, 1, 1, 2])):
        if c <= budget * 0.15:
            lines_adv.append((a, c)); budget -= c
    # attributes
    prim = primary_attrs(cls, fav)
    attr_budget = int(budget * rng.uniform(0.28, 0.42))
    used = 0
    for _ in range(60):
        a = prim[0] if rng.random() < 0.45 else rng.choice(prim)
        step = 10 if a in ("INT", "DEX") else 5
        if attrs[a] >= 10 and used + step <= attr_budget and attrs[a] < 18:
            attrs[a] += 1; used += step
    budget -= used
    # skills
    sk_pool = [s for s in CLASSES[cls][1]]
    rng.shuffle(sk_pool)
    sk_pool = sk_pool[:rng.randint(4, min(6, len(sk_pool)))]
    levels = {}
    shares = sorted([rng.uniform(0.6, 1.6) for _ in sk_pool], reverse=True)
    tot = sum(shares)
    targets = [20, 18, 16, 15, 14, 12, 11, 10, 9, 7, 6, 5, 4, 3, 2, 1] + list(range(48, 20, -1))
    remaining = budget
    for s, sh in zip(sk_pool, shares):
        cap = budget * sh / tot
        best = 0
        for t in sorted(set(targets), reverse=True):
            if skill_cost(t) <= min(cap, remaining): best = t; break
        if best: levels[s] = best; remaining -= skill_cost(best)
    # spend leftover exactly by raising skills (largest marginal cost that fits)
    extra_pool = [x for x in COMMON_SKILLS if x not in levels]
    guard = 0
    while remaining > 0 and guard < 200:
        guard += 1
        opts = [(skill_cost(lv + 1) - skill_cost(lv), s) for s, lv in levels.items() if skill_cost(lv + 1) - skill_cost(lv) <= remaining]
        if opts:
            c, s = max(opts); levels[s] += 1; remaining -= c
        else:
            s = rng.choice(extra_pool); extra_pool.remove(s); levels[s] = 1; remaining -= 1
    total = (sum(attr_cost(a, v) for a, v in attrs.items()) + sum(c for _, c in lines_adv)
             + sum(c for _, c in lines_dis) - quirks + sum(skill_cost(l) for l in levels.values()))
    assert total == points, (total, points)
    return dict(attrs=attrs, adv=lines_adv, dis=lines_dis, quirks=quirks, skills=levels, size=size)

QUIRK_EXAMPLES = ["hums old marching songs when nervous", "collects smooth river stones", "never sits with their back to a door",
                  "insists on fair payment, always", "superstitious about crossing thresholds left foot first",
                  "quotes proverbs at awkward moments", "ritually cleans gear before sleep", "distrusts anyone in uniform",
                  "eats dessert first", "talks to their weapon", "refuses to sleep without a light", "keeps meticulous notes"]

def gen_build(rng):
    species = rng.choice(SPECIES)
    cls = rng.choice(list(CLASSES))
    points = rng.choice([60, 75, 100, 100, 120, 125, 150, 150, 175, 200, 200, 250, 300, 350, 400])
    genre = rng.choice(GENRES)
    c = build_character(rng, points, species, cls)
    nm = name_for(rng, species[0])
    tier = point_tier(points)
    a = c["attrs"]
    attr_lines = []
    attr_total = 0
    for k in ATTRS:
        v = a[k]; cost = attr_cost(k, v); attr_total += cost
        if v == 10: continue
        attr_lines.append(f"- {ATTR_NAMES[k]} ({k}): {v} ({attr_desc(v)}) — {'Cost' if cost > 0 else 'Gain'}: {abs(cost)} DP")
    attr_lines.append("- All other attributes: 10 (Average) — 0 DP")
    sk_total = sum(skill_cost(l) for l in c["skills"].values())
    sk_lines = [f"- {s} ({SKILLS.get(s, '—')}): Level {l} ({skill_rank(l)}) — {skill_cost(l)} DP"
                for s, l in sorted(c["skills"].items(), key=lambda x: -x[1])]
    hp_base, hp_val = hp(a["CON"], 1, c["size"])
    spd, raw = basic_speed(a["DEX"], a["CON"])
    dg = dodge(spd, a["DEX"])
    quirk_txt = rng.sample(QUIRK_EXAMPLES, c["quirks"])
    out = [f"## {nm} — {species[0]} {cls}", "",
           f"**Points:** {points} DP ({tier} tier) · **Campaign:** {genre} · **Size:** {sg(c['size']).replace(' ', '')}" if c["size"] else
           f"**Points:** {points} DP ({tier} tier) · **Campaign:** {genre} · **Size:** 0",
           f"**Role:** {CLASSES[cls][0]}", "", f"### Attributes ({attr_total} DP)"] + attr_lines
    if c["adv"]:
        out += ["", f"### Advantages ({sum(x for _, x in c['adv'])} DP)"] + [f"- {n} — {x} DP" for n, x in c["adv"]]
    if c["dis"] or c["quirks"]:
        out += ["", f"### Disadvantages and Quirks (−{abs(sum(x for _, x in c['dis']) - c['quirks'])} DP)"]
        out += [f"- {n} — −{abs(x)} DP" for n, x in c["dis"]]
        out += [f"- Quirk: {q} — −1 DP" for q in quirk_txt]
    out += ["", f"### Skills ({sk_total} DP)"] + sk_lines
    check = [attr_total, sum(x for _, x in c["adv"]), sum(x for _, x in c["dis"]) - c["quirks"], sk_total]
    out += ["", f"**Total:** {' + '.join(str(x) for x in check if x >= 0)}"
            + "".join(f" − {abs(x)}" for x in check if x < 0) + f" = **{points} DP**", "", "### Derived values"]
    size_note = f" × {1 + SIZE_HP[c['size']]:.2f} (Size {sg(c['size']).replace(' ', '')}) = {hp_val}" if c["size"] else ""
    out.append(f"- HP: 50 + (CON {a['CON']} × 10) + (Level 1 × 5) = {hp_base}{size_note}")
    out.append(f"- Basic Speed: (DEX {a['DEX']} + CON {a['CON']}) ÷ 4 = {raw:g} → {spd}")
    out.append(f"- Basic Move: {spd} yards/second")
    out.append(f"- Dodge: {spd} + ((DEX {a['DEX']} − 10) ÷ 2) = {dg}")
    out.append(f"- Will: {a['INT']} · Perception: {a['INT']} (both equal INT)")
    if cls in CASTERS:
        roll = rng.randint(1, 1000)
        mp = mana_pool(roll, hp_val, a["INT"], c["size"])
        out.append(f"- Mana Pool: d1000 roll {roll} → (({roll} × {hp_val} + {a['INT']}÷3) + ({c['size']} × 100)) × 3 = {mp:,} MP")
    top = sorted(c["skills"].items(), key=lambda x: -x[1])[:3]
    out += ["", "### Quick roll reference"]
    for s, l in top:
        at = SKILLS.get(s, "DEX")
        out.append(f"- {s}: d20 + {skill_shift(l)} (Skill Shift) {'+' if attr_shift(a[at]) >= 0 else '−'} {abs(attr_shift(a[at]))} ({at} Shift) "
                   f"= d20 {'+' if skill_shift(l) + attr_shift(a[at]) >= 0 else '−'} {abs(skill_shift(l) + attr_shift(a[at]))}")
    prompts = [f"Build a {points}-point {species[0]} {cls} for my {genre} campaign.",
               f"Make me an IPRPS character: {species[0]}, {cls}, {points} DP.",
               f"I need a {tier.lower()}-tier {species[0]} {cls} NPC ({points} points) with full derived stats.",
               f"Create a {cls} character sheet for a {species[0]} at {points} Development Points.",
               f"Roll up a {species[0]} {cls} for a {genre} game. Starting budget is {points} DP."]
    return rng.choice(prompts), "\n".join(out)

# ---------------------------------------------------------------- skill checks
TASKS = [("Athletics", "STR", "leap the gap between two rooftops"), ("Athletics", "STR", "force open a swollen wooden door"),
         ("Climbing", "DEX", "scale the crumbling tower wall"), ("Stealth", "DEX", "slip past the sleeping guards"),
         ("Lockpicking", "DEX", "pick the lock on the merchant's strongbox"), ("Perception", "INT", "spot the tripwire in the corridor"),
         ("Persuasion", "CHA", "convince the gate captain to let us through after curfew"), ("Intimidation", "CHA", "scare the bandit into talking"),
         ("Deception", "CHA", "pass off forged papers at the checkpoint"), ("Swimming", "STR", "swim across the flooded culvert"),
         ("Tracking", "WIS", "follow the raider tracks through the rain"), ("Survival", "WIS", "find shelter before the blizzard hits"),
         ("First Aid", "INT", "stop an ally's bleeding"), ("Riding", "DEX", "keep the spooked horse under control"),
         ("Navigation", "INT", "find the old road through the fog"), ("Balance", "DEX", "cross the icy rope bridge"),
         ("Acrobatics", "DEX", "tumble under the closing portcullis"), ("Lore (Arcana)", "INT", "identify the runes on the sealed door"),
         ("Endurance", "CON", "keep marching through the desert heat"), ("Seduction", "CHA", "charm the noble's steward into gossiping"),
         ("Engineering", "INT", "jury-rig the airship's pressure valve"), ("Piloting", "DEX", "thread the airship between the cliffs"),
         ("Streetwise", "CHA", "find out who fences stolen relics in this district"), ("Meditation", "WIL", "clear my mind to resist the whispering idol")]

UNC = ["The Session Master decides: partial success, success with a cost, or a near miss.",
       "It could go either way, so the Session Master calls it — often success with a complication."]

def outcome_text(rng, band, task):
    if band == "Success":
        return rng.choice([f"You {task} cleanly.", f"Success: you manage to {task}.", f"Done — you {task} without trouble."])
    if band == "Fail":
        return rng.choice([f"You fail to {task}.", f"The attempt to {task} clearly fails.", f"No luck: you can't {task} this time."])
    return rng.choice(UNC)

def gen_skill_check(rng):
    skill, at, task = rng.choice(TASKS)
    lvl = rng.choice([0, 0, 3, 5, 8, 10, 10, 12, 15, 16, 20, 25, 30, 40, 50])
    av = rng.choice([7, 8, 9, 10, 10, 11, 12, 13, 14, 15, 16, 18, 20])
    raw = rng.randint(1, 20)
    ss, ash = skill_shift(lvl), attr_shift(av)
    tot = raw + ss + ash
    band = base_band(tot)
    who = rng.choice(["My character", "My rogue", "Our scout", "My ranger", "The fighter", "My bard", "My mage"])
    q = rng.choice([f"{who} has {skill} {lvl} and {at} {av}. I want to {task}. I rolled a {raw} on the d20. What happens?",
                    f"Skill check: {skill} {lvl}, {ATTR_NAMES[at]} {av}. Natural roll {raw}. Goal: {task}.",
                    f"Resolve this for me — {skill} level {lvl}, {at} {av}, d20 shows {raw}. I'm trying to {task}."])
    lines = ["**Skill Check** (First Edition rules): 1d20 + Skill Shift + Attribute Shift", "",
             f"- Skill Shift: floor({lvl} ÷ 10) = {sg(ss).replace(' ', '')}",
             f"- Attribute Shift ({at} {av}, from the Attribute Shift table): {sg(ash).replace(' ', '')}",
             f"- Total: {raw} {'+' if ss >= 0 else '−'} {abs(ss)} {'+' if ash >= 0 else '−'} {abs(ash)} = **{tot}**", "",
             f"**Base Band:** {'1–6 Fail' if band == 'Fail' else '7–12 Uncertain' if band == 'Uncertain' else '13+ Success'}"]
    c = crit(raw)
    if c: lines.append(f"The raw d20 of {raw} is a {c}" + (" — the result is especially favorable." if c == "critical success" else " — expect a serious complication."))
    lines += ["", outcome_text(rng, band, task)]
    if lvl == 0:
        lines.append("Untrained (Skill 0): even on a success, the Session Master may add side effects — slower, sloppier, or riskier.")
    if band == "Success" and rng.random() < 0.5:
        e = rng.randint(1, 20); bn, mult = eff_band(e)
        lines += ["", f"**Effectiveness Roll:** d20 → {e} → {bn.split(' (')[0]}: " +
                  {1.0: "a clean, full-strength result.", 0.5: "it works, but not perfectly.", 0.25: "it barely works."}[mult]]
    return q, "\n".join(lines)

def gen_contest(rng):
    a_name, b_name = rng.sample(["the thief", "the guard", "the wrestler", "the courier", "the hunter", "the scholar", "the duelist"], 2)
    skill, at, _ = rng.choice([("Athletics", "STR", 0), ("Stealth", "DEX", 0), ("Persuasion", "CHA", 0), ("Perception", "INT", 0), ("Brawling", "STR", 0)])
    def side():
        l, av, r = rng.choice([5, 10, 12, 15, 20, 25]), rng.choice([9, 10, 11, 12, 14, 15]), rng.randint(1, 20)
        return l, av, r, r + skill_shift(l) + attr_shift(av)
    la, aa, ra, ta = side(); lb, ab, rb, tb = side()
    q = (f"Quick contest of {skill}: {a_name} (Skill {la}, {at} {aa}) rolls {ra}; {b_name} (Skill {lb}, {at} {ab}) rolls {rb}. Who wins?")
    ba, bb = base_band(ta), base_band(tb)
    lines = [f"Each side rolls d20 + Skill Shift + {at} Shift.",
             f"- {cap(a_name)}: {ra} {sg(skill_shift(la))} {sg(attr_shift(aa))} = **{ta}** ({ba})",
             f"- {cap(b_name)}: {rb} {sg(skill_shift(lb))} {sg(attr_shift(ab))} = **{tb}** ({bb})", ""]
    order = {"Fail": 0, "Uncertain": 1, "Success": 2}
    if order[ba] != order[bb]:
        w = a_name if order[ba] > order[bb] else b_name
        lines.append(f"In a Quick Contest a better result beats a worse one, so **{w}** wins.")
    elif ta != tb:
        w = a_name if ta > tb else b_name
        lines.append(f"Both land in the same band; the higher margin wins, so **{w}** wins ({max(ta, tb)} vs {min(ta, tb)}).")
    else:
        lines.append("Exact tie: neither side gains the advantage this moment.")
    return q, "\n".join(lines)

def gen_reaction(rng):
    npc = rng.choice(["a wary innkeeper", "a dwarven border guard", "a Catfolk fence", "a temple acolyte", "a merchant prince's steward",
                      "a Wolffolk pack elder", "a goblin trader", "a city magistrate", "a ship's quartermaster", "a Gemp records clerk"])
    mods = []
    for label, opts in [("appearance", [("Attractive", 2), ("Unattractive", -1), ("Average", 0), ("Handsome", 3), ("Ugly", -3)]),
                        ("reputation", [("known hero", 2), ("unknown", 0), ("wanted poster", -3), ("guild member", 1)]),
                        ("species bias", [("none", 0), ("old rivalry", -2), ("kinship", 2)]),
                        ("roleplay", [("polite greeting and a gift", 2), ("rude demand", -3), ("plain request", 0), ("shared joke", 1)])]:
        n, v = rng.choice(opts); mods.append((label, n, v))
    raw = rng.randint(1, 20)
    tot = raw + sum(v for _, _, v in mods)
    res, desc = reaction(tot)
    q = rng.choice([f"Reaction roll for {npc}: I rolled {raw}. Modifiers — " + ", ".join(f"{l}: {n}" for l, n, _ in mods) + ". How do they react?",
                    f"The party approaches {npc}. d20 = {raw}. " + "; ".join(f"{l} {n} ({v:+d})" for l, n, v in mods) + ". Resolve the reaction."])
    lines = [f"**Reaction Roll:** {raw} " + " ".join(f"{'+' if v >= 0 else '−'} {abs(v)} ({l})" for l, _, v in mods if v) + f" = **{tot}**", "",
             f"**Result: {res}** — {desc}.", "",
             rng.choice([f"Play {npc} accordingly.", f"{cap(npc)} behaves that way until the party gives them a reason to change."])]
    return q, "\n".join(lines)

# ---------------------------------------------------------------- combat
FOES = [("Goblin Scout", 9, 14, 8, "dagger", 1, 10, "Melee Weapons"), ("Bandit", 12, 11, 11, "shortsword", 1, 10, "Melee Weapons"),
        ("Orc Raider", 15, 10, 14, "warhammer", 2, 15, "Melee Weapons"), ("Cultist", 10, 11, 10, "dagger", 0, 5, "Melee Weapons"),
        ("Skeleton Warrior", 11, 10, 12, "longsword", 2, 12, "Melee Weapons"), ("Wolffolk Mercenary", 14, 12, 14, "spear", 1, 15, "Melee Weapons"),
        ("Dwarf Sentry", 14, 9, 15, "warhammer", 4, 15, "Melee Weapons"), ("Highwayman", 11, 13, 11, "pistol", 1, 15, "Ranged Weapons"),
        ("Crossbow Guard", 11, 12, 12, "crossbow", 4, 12, "Ranged Weapons"), ("Ogre Brute", 18, 8, 18, "greatsword", 2, 10, "Melee Weapons")]
HEROES = [("Kaelen the guard", 13, 11, 13, "spear", 4, "Melee Weapons", 15), ("Lyra the archer", 10, 15, 11, "bow", 1, "Ranged Weapons", 20),
          ("Borin the shieldbreaker", 14, 9, 14, "warhammer", 4, "Melee Weapons", 18), ("Nyx the skirmisher", 9, 14, 10, "shortsword", 1, "Melee Weapons", 16),
          ("Valerius the paladin", 14, 11, 14, "longsword", 4, "Melee Weapons", 20), ("Marrow the gunslinger", 10, 14, 11, "pistol", 1, "Ranged Weapons", 25),
          ("Ursa the berserker", 17, 9, 16, "greatsword", 1, "Melee Weapons", 22), ("Sable the duelist", 11, 15, 11, "longsword", 1, "Melee Weapons", 25)]

def art(n):
    return ('an ' if n[0].upper() in 'AEIOU' else 'a ') + n

def cap(t):
    return t[0].upper() + t[1:]

def sg(x):
    return f"+ {x}" if x >= 0 else f"− {abs(x)}"

def attack_line(name, skill, lvl, attr, av, raw):
    ss, ash = skill_shift(lvl), attr_shift(av)
    tot = raw + ss + ash
    return tot, f"{name} attacks: d20 {raw} {sg(ss)} (Skill {lvl}) {sg(ash)} ({attr} {av}) = **{tot}** → {base_band(tot)}"

def gen_standard_combat(rng):
    h = rng.choice(HEROES); f = rng.choice(FOES)
    hname, hstr, hdex, hcon, hw, har, hsk, hlvl = h
    fname, fstr, fdex, fcon, fw, far, flvl, fsk = f
    h_hp = 50 + hcon * 10 + 5; f_hp = 50 + fcon * 10 + 5
    h_dodge = dodge(basic_speed(hdex, hcon)[0], hdex); f_dodge = dodge(basic_speed(fdex, fcon)[0], fdex)
    q = (f"Run {rng.choice(['two rounds', 'a short exchange', 'the opening rounds'])} of Standard Combat: {hname} (STR {hstr}, DEX {hdex}, CON {hcon}, "
         f"{hsk} {hlvl}, {hw} {WEAPONS[hw]}, AR {har}) vs {art(fname)} (STR {fstr}, DEX {fdex}, CON {fcon}, {fsk} {flvl}, {fw} {WEAPONS[fw]}, AR {far}).")
    out = ["**Standard Combat** (First Edition rules) — Initiative → Skill Roll → Defense → Effectiveness Roll → Damage − AR.", "",
           f"- {hname}: HP 50 + ({hcon} × 10) + 5 = {h_hp}, Dodge {h_dodge}",
           f"- {fname}: HP 50 + ({fcon} × 10) + 5 = {f_hp}, Dodge {f_dodge}", ""]
    ih, if_ = rng.randint(1, 20), rng.randint(1, 20)
    ti, tf = ih + attr_shift(hdex), if_ + attr_shift(fdex)
    first_h = ti >= tf
    out.append(f"**Initiative** (d20 + DEX Shift): {hname} {ih} {sg(attr_shift(hdex))} = {ti}; {fname} {if_} {sg(attr_shift(fdex))} = {tf}. "
               f"{hname if first_h else 'The ' + fname} acts first.")
    hpv = {"h": h_hp, "f": f_hp}
    order = ["h", "f"] if first_h else ["f", "h"]
    for rnd in (1, 2):
        out += ["", f"### Round {rnd}"]
        for side in order:
            if hpv["h"] <= 0 or hpv["f"] <= 0: break
            if side == "h":
                nm, sk, lvl, at, av, wpn, tgt, tdodge, tar = hname, hsk, hlvl, ("DEX" if hw in RANGED else "STR"), (hdex if hw in RANGED else hstr), hw, "f", f_dodge, far
            else:
                nm, sk, lvl, at, av, wpn, tgt, tdodge, tar = "The " + fname, fsk, flvl, ("DEX" if fw in RANGED else "STR"), (fdex if fw in RANGED else fstr), fw, "h", h_dodge, har
            raw = rng.randint(1, 20)
            tot, line = attack_line(nm, sk, lvl, at, av, raw)
            out.append(f"- {line}.")
            if base_band(tot) == "Fail":
                out.append("  The attack misses. No Effectiveness or damage roll."); continue
            if base_band(tot) == "Uncertain":
                if rng.random() < 0.5:
                    out.append("  Uncertain — the Session Master rules the swing goes wide."); continue
                out.append("  Uncertain — the Session Master rules it still connects.")
            d = rng.randint(1, 20)
            while d == tdodge: d = rng.randint(1, 20)
            if d < tdodge:
                out.append(f"  Defender's Dodge: rolls {d}, under Dodge {tdodge} — avoided!"); continue
            out.append(f"  Defender's Dodge: rolls {d}, not under Dodge {tdodge} — the hit lands.")
            e = rng.randint(1, 20); bn, mult = eff_band(e)
            rolls, dmg, mod = roll_dice(rng, WEAPONS[wpn])
            scaled = math.floor(dmg * mult)
            final = max(0, scaled - tar)
            hpv[tgt] -= final
            out.append(f"  Effectiveness: {e} → {bn}. Damage {fmt_roll(WEAPONS[wpn], rolls, dmg, mod)} × {mult:g} = {scaled} − AR {tar} = **{final}**.")
            out.append(f"  {(fname if tgt == 'f' else hname)} HP: {hpv[tgt] + final} → {hpv[tgt]}")
    out += ["", f"**After {rnd} round{'s' if rnd > 1 else ''}:** {hname} {hpv['h']}/{h_hp} HP · {fname} {hpv['f']}/{f_hp} HP."]
    for k, mx, nm in (("h", h_hp, hname), ("f", f_hp, fname)):
        if hpv[k] <= 0: out.append(f"{nm} is at {hpv[k]} HP — at 0 or below they must make a collapse check or fall unconscious.")
        elif hpv[k] < mx / 3: out.append(f"{nm} is below 1/3 HP: all rolls at −2.")
    return q, "\n".join(out)

def gen_trinity(rng):
    h = rng.choice(HEROES); f = rng.choice(FOES)
    hname, hstr, hdex, hcon, hw, har, hsk, hlvl = h
    fname, fstr, fdex, fcon, fw, far, flvl, fsk = f
    hpar, fpar = rng.choice([5, 10, 12, 15]), rng.choice([3, 5, 8, 10])
    boss = rng.random() < 0.3
    q = (f"Trinity Combat (The Hand): {hname} (STR {hstr}, DEX {hdex}, Fighting {hlvl}, Parry {hpar}, {hw} {WEAPONS[hw]}, AR {har}) vs "
         f"{'a boss ' if boss else art(fname) + ' '}{fname + ' ' if boss else ''}(STR {fstr}, DEX {fdex}, Fighting {flvl}, Parry {fpar}, {fw} {WEAPONS[fw]}, AR {far}"
         f"{', 2 attacks (Hydra Hand)' if boss else ''}). Resolve one exchange.")
    def hand(n_imp):
        return rng.randint(1, 3), [rng.randint(1, 20) for _ in range(n_imp)], rng.randint(1, 12)
    hv, hi, hg = hand(1); fv, fi, fg = hand(2 if boss else 1)
    vel = {3: "Fast", 2: "Normal", 1: "Slow"}
    h_imp = hi[0] + hstr + hlvl; h_grd = hg + hdex + hpar
    f_imps = [x + fstr + flvl for x in fi]; f_grd = fg + fdex + fpar
    out = ["**Trinity Combat** (Mode B, First Edition) — each side rolls The Hand: 1d3 Velocity, 1d20 Impact, 1d12 Guard. Total = Die + Attribute + Skill.", "",
           f"- {hname}: Velocity {hv} ({vel[hv]}), Impact {hi[0]} + STR {hstr} + Fighting {hlvl} = **{h_imp}**, Guard {hg} + DEX {hdex} + Parry {hpar} = **{h_grd}**",
           f"- {fname}: Velocity {fv} ({vel[fv]}), Impact " + ", ".join(f"{x} + {fstr} + {flvl} = **{x + fstr + flvl}**" for x in fi)
           + f", Guard {fg} + DEX {fdex} + Parry {fpar} = **{f_grd}**", ""]
    seq = [("h", hi[0], h_imp)] + [("f", r, t) for r, t in zip(fi, f_imps)]
    if fv > hv: seq = seq[1:] + seq[:1]; out.append(f"The {fname} is faster (Velocity {fv} vs {hv}) and strikes first.")
    elif hv > fv: out.append(f"{hname} is faster (Velocity {hv} vs {fv}) and strikes first.")
    else: out.append("Velocity is tied, so the strikes land in the same phase.")
    for side, raw, imp in seq:
        att, tgt_g, wpn, ar = (hname, f_grd, hw, far) if side == "h" else ("The " + fname, h_grd, fw, har)
        if imp > tgt_g:
            bn, mult = eff_band(raw)
            rolls, dmg, mod = roll_dice(rng, WEAPONS[wpn])
            sc = math.floor(dmg * mult); fin = max(0, sc - ar)
            out.append(f"- {att}: Impact {imp} > Guard {tgt_g} — hit. Raw d20 {raw} → {bn}. "
                       f"Damage {fmt_roll(WEAPONS[wpn], rolls, dmg, mod)} × {mult:g} = {sc} − AR {ar} = **{fin}**.")
        else:
            out.append(f"- {att}: Impact {imp} vs Guard {tgt_g} — not strictly greater, so the strike is turned aside.")
    return q, "\n".join(out)

def gen_rps(rng):
    h = rng.choice(HEROES); f = rng.choice(FOES)
    hname, hw, har = h[0], h[4], h[5]; fname, fw, far = f[0], f[4], f[5]
    beats = {"Rock": "Scissors", "Paper": "Rock", "Scissors": "Paper"}
    flavor = {"Rock": ["shield bash", "heavy overhead blow", "braced stance"], "Paper": ["counter", "block", "ward"],
              "Scissors": ["quick strike", "feint", "precise lunge"]}
    hs, fs = rng.choice(list(beats)), rng.choice(list(beats))
    hfl, ffl = rng.choice(flavor[hs]), rng.choice(flavor[fs])
    q = (f"RPS combat: {hname} ({hw} {WEAPONS[hw]}, DEF {har}) picks {hs} ({hfl}); the {fname} ({fw} {WEAPONS[fw]}, DEF {far}) picks {fs} ({ffl}). Resolve the round.")
    if hs == fs: hm, fm, res = 1.0, 1.0, f"Tie ({hs} vs {fs}): both deal normal damage."
    elif beats[hs] == fs: hm, fm, res = 1.5, 0.5, f"{hs} beats {fs}: {hname} wins the exchange (×1.5); the {fname} deals ×0.5."
    else: hm, fm, res = 0.5, 1.5, f"{fs} beats {hs}: the {fname} wins the exchange (×1.5); {hname} deals ×0.5."
    out = ["**Rock-Paper-Scissors Combat** (Mode A, First Edition) — Rock beats Scissors, Paper beats Rock, Scissors beats Paper.", "", res, ""]
    for nm, wpn, m, dfn in ((hname, hw, hm, far), (f"The {fname}", fw, fm, har)):
        rolls, dmg, mod = roll_dice(rng, WEAPONS[wpn])
        sc = math.floor(dmg * m); fin = max(0, sc - dfn)
        out.append(f"- {nm}: {fmt_roll(WEAPONS[wpn], rolls, dmg, mod)} × {m:g} = {sc} − DEF {dfn} = **{fin}** damage" + (" (blocked)" if fin == 0 else ""))
    return q, "\n".join(out)

def gen_dualdie(rng):
    h = rng.choice(HEROES); f = rng.choice(FOES)
    hname, hstr, hdex, hcon, hw, har, hsk, hlvl = h
    fname, fstr, fdex, fcon, fw, far, flvl, fsk = f
    fdodge_skill = rng.choice([2, 3, 5, 8])
    at, av = ("DEX", hdex) if hw in RANGED else ("STR", hstr)
    raw = rng.randint(1, 20); tot = raw + av + hlvl
    gv = fdex + fdodge_skill
    f_max = 50 + fcon * 10 + 5
    q = (f"Dual-Die combat: {hname} ({at} {av}, {hsk} {hlvl}, {hw} {WEAPONS[hw]}) attacks {art(fname)} (DEX {fdex}, Dodge skill {fdodge_skill}, "
         f"max HP {f_max}). d20 roll is {raw}.")
    out = ["**Dual-Die Combat** (Mode C, First Edition) — 1d20 + Attribute + Skill vs Guard Value; on a hit roll 1d6 for Impact.", "",
           f"- Resolution: {raw} + {at} {av} + {hsk} {hlvl} = **{tot}**",
           f"- Guard Value ({'Ranged' if hw in RANGED else 'Melee'}): DEX {fdex} + Dodge {fdodge_skill} = **{gv}**"]
    if tot < gv:
        out += ["", f"{tot} is below {gv}: a miss. No Impact roll."]
        return q, "\n".join(out)
    d6 = rng.randint(1, 6)
    name, mult = (("Glancing Blow", 0.25) if d6 <= 2 else ("Solid Hit", 0.5) if d6 <= 4 else ("Critical Impact", 1.0))
    rolls, dmg, mod = roll_dice(rng, WEAPONS[hw])
    sc = math.floor(dmg * mult)
    out += ["", f"{tot} ≥ {gv}: hit.", f"- Impact d6: {d6} → {name} (×{mult:g})",
            f"- Damage: {fmt_roll(WEAPONS[hw], rolls, dmg, mod)} × {mult:g} = **{sc}**"]
    q4, q2 = f_max / 4, f_max / 2
    if sc >= q2: out.append(f"{sc} is at least half of max HP ({f_max}), so it is a **Critical Wound**: the {fname} is incapacitated — unconscious or dying.")
    elif sc >= q4: out.append(f"{sc} is at least 1/4 of max HP ({q4:g}): this counts as a wounding hit. If it is their first, it is a **Light Wound** (−1 to all rolls).")
    else: out.append(f"{sc} is under 1/4 of max HP ({q4:g}), so it does not trigger a wound tier. The {fname} keeps fighting without a wound penalty.")
    return q, "\n".join(out)

BLUR = [("Glacial", "1d50", 50, 1, 50), ("Heavy", "1d30", 30, 1, 30), ("Balanced", "1d20", 20, 1, 20), ("Rapid", "3d8", 8, 3, 8), ("Flurry", "6d4", 4, 6, 4)]
def ic_roll(rng, n, d):
    total, parts = 0, []
    for _ in range(n):
        r = rng.randint(1, d); chain = [r]
        while r == d and len(chain) < 4:
            r = rng.randint(1, d); chain.append(r)
        total += sum(chain); parts.append("+".join(map(str, chain)) + (" (exploded)" if len(chain) > 1 else ""))
    return total, parts

def gen_ic(rng):
    a, b = rng.sample(["a samurai", "a bandit chief", "a Catfolk duelist", "an orc champion", "a knight", "a gunslinger", "a sky-pirate captain", "an elven blademaster"], 2)
    ba, bb = rng.choice(BLUR), rng.choice(BLUR)
    sa, sb = rng.choice([4, 8, 12, 18, 25, 35, 45]), rng.choice([4, 8, 12, 18, 25, 35, 45])
    q = f"Infinite Convergence duel: {a} (skill {sa}) commits at {ba[0]} Blur; {b} (skill {sb}) commits at {bb[0]} Blur. Roll it out."
    ta, pa = ic_roll(rng, ba[3], ba[4]); tb, pb = ic_roll(rng, bb[3], bb[4])
    ca, cb = min(sa, ba[2]), min(sb, bb[2])
    fa, fb = ta + ca, tb + cb
    out = ["**Infinite Convergence** (Mode 5, Master AI Profile) — one roll decides it. Total = dice + skill, with skill capped by the Blur die; maximum faces explode.", "",
           f"- {cap(a)}: {ba[0]} ({ba[1]}, skill cap +{ba[2]}). Dice: {', '.join(pa)} = {ta}. Skill {sa} → +{ca}{' (capped)' if sa > ba[2] else ''}. **Total {fa}**",
           f"- {cap(b)}: {bb[0]} ({bb[1]}, skill cap +{bb[2]}). Dice: {', '.join(pb)} = {tb}. Skill {sb} → +{cb}{' (capped)' if sb > bb[2] else ''}. **Total {fb}**", ""]
    if fa == fb: out.append("Dead even — the clash ends in mutual destruction or a stalemate, as the Session Master narrates.")
    else: out.append(f"**{cap(a if fa > fb else b)} wins** in a single decisive exchange.")
    return q, "\n".join(out)

# ---------------------------------------------------------------- spellcasting
def load_spells():
    sp = []
    for f in ["official_trap_anti_magick_spells_edition_one_03102026a.ipai", "official_trap_anti_magick_spells_edition_two_03102026a.ipai"]:
        sp += json.load(open(os.path.join(SRC_DIR, f), encoding="utf8"))
    return sp
SPELLS = load_spells()
TIER_SKILL = {"Novice": [10, 12, 15], "Standard": [15, 18, 20, 25], "Advanced": [25, 30, 40, 50]}

def gen_cast(rng):
    s = rng.choice(SPELLS)
    cost = int(re.search(r"\d+", s["mana"]).group())
    lvl = rng.choice(TIER_SKILL[s["tier"]]); intel = rng.choice([12, 13, 14, 15, 16, 18, 20])
    mp = rng.choice([cost * 3, cost * 10, cost * 50, cost - rng.randint(1, max(1, cost // 3))]) if rng.random() < 0.15 else rng.choice([cost * 4, cost * 20, cost * 200])
    raw = rng.randint(1, 20)
    caster = rng.choice(["my wizard", "our Gemp arcanist", "the elven glyphwright", "my Birdfolk spellsinger", "the academy adept", "my warlock"])
    skill = "Glyph Magick" if s["school"] == "Glyph Magick" else "Anti-Magick"
    q = rng.choice([f"{cap(caster)} casts {s['name']} ({s['tier']}, {s['mana']}). {skill} {lvl}, INT {intel}, {mp:,} MP available. d20 = {raw}.",
                    f"Cast {s['name']}: caster has {skill} {lvl}, INT {intel}, current Mana Pool {mp:,}. I rolled {raw}. What happens?"])
    out = [f"**{s['name']}** — {s['school']}, {s['tier']} tier, {s['mana']}.", f"*{s['inc']}*", ""]
    if mp < cost:
        out.append(f"{cap(caster)} has only {mp:,} MP but the spell needs {cost} MP. The spell can't be cast — choose a cheaper spell or recover mana first.")
        return q, "\n".join(out)
    ss, ash = skill_shift(lvl), attr_shift(intel)
    tot = raw + ss + ash; band = base_band(tot)
    out += [f"**Casting check:** d20 {raw} {sg(ss)} (Skill {lvl}) {sg(ash)} (INT {intel}) = **{tot}** → {band}"]
    c = crit(raw)
    if c == "critical failure":
        out += ["", f"Raw {raw} is a **critical failure**: {s['cFail']}", f"Mana spent: {cost} MP → {mp - cost:,} MP remaining."]
    elif band == "Fail":
        out += ["", f"The casting fails: {s['fail']} The Session Master decides whether the {cost} MP is lost."]
    else:
        if band == "Uncertain": out.append("Uncertain — the Session Master rules the spell takes hold, but imperfectly.")
        out += ["", f"**Effect:** {s['proc']}"]
        if c == "critical success": out.append(f"Raw {raw} is a **critical success**: {s['cSucc']}")
        m = re.search(r"(\d+d\d+)", s["cSucc"] if c == "critical success" else s["proc"])
        if m:
            e = rng.randint(1, 20); bn, mult = eff_band(e)
            rolls, dmg, mod = roll_dice(rng, m.group(1))
            out.append(f"Effectiveness when it triggers: d20 {e} → {bn}. Damage {m.group(1)} → {dmg} × {mult:g} = **{math.floor(dmg * mult)}**.")
        out.append(f"Mana spent: {cost} MP → {mp - cost:,} MP remaining.")
    return q, "\n".join(out)

def gen_magick_duel(rng):
    a = rng.choice(["a battle mage", "an elven archmage", "a Lilitu blood-witch", "a Birdfolk spellsinger", "a necromancer"])
    b = rng.choice(["a knight with a warded shield", "a dwarven runepriest", "an Angelicus templar", "a Wolffolk shaman", "a goblin hex-tinker"])
    ai, asp, bw, bres = rng.choice([13, 15, 16, 18]), rng.choice([10, 15, 20, 25]), rng.choice([10, 12, 14, 16]), rng.choice([5, 8, 12, 15])
    dmg = rng.choice(["2d6", "3d6", "2d6+1", "3d6+2"])
    q = f"Trinity Combat, Magick domain: {a} (INT {ai}, Spell {asp}, bolt {dmg}) blasts {b} (WIL {bw}, Resistance {bres}, AR 2). Resolve it."
    vi, ii, gi = rng.randint(1, 3), rng.randint(1, 20), rng.randint(1, 12)
    gb = rng.randint(1, 12)
    imp = ii + ai + asp; grd = gb + bw + bres
    out = ["**Trinity Combat, Magick domain** (First Edition): Impact = d20 + INT + Spell; Guard = d12 + WIL + Resistance.", "",
           f"- Impact: {ii} + {ai} + {asp} = **{imp}**", f"- Guard: {gb} + {bw} + {bres} = **{grd}**", ""]
    if imp > grd:
        bn, mult = eff_band(ii); rolls, d, mod = roll_dice(rng, dmg)
        sc = math.floor(d * mult); fin = max(0, sc - 2)
        out.append(f"{imp} > {grd}: the spell breaks through. Raw d20 {ii} → {bn}. Damage {fmt_roll(dmg, rolls, d, mod)} × {mult:g} = {sc} − AR 2 = **{fin}**.")
    else:
        out.append(f"{imp} does not exceed {grd}: the ward holds and the bolt splashes harmlessly away.")
    return q, "\n".join(out)

GENERATORS = {"character_build": (gen_build, 260), "skill_check": (gen_skill_check, 260), "contest": (gen_contest, 60),
              "reaction_roll": (gen_reaction, 90), "combat_standard": (gen_standard_combat, 200), "combat_trinity": (gen_trinity, 120),
              "combat_rps": (gen_rps, 80), "combat_dual_die": (gen_dualdie, 120), "combat_infinite_convergence": (gen_ic, 70),
              "spellcasting": (gen_cast, 260), "magick_duel": (gen_magick_duel, 70)}

def generate(seed=2611):
    rng = random.Random(seed)
    out, seen = [], set()
    for cat, (fn, n) in GENERATORS.items():
        made = 0; tries = 0
        while made < n and tries < n * 5:
            tries += 1
            q, a = fn(rng)
            if q in seen: continue
            seen.add(q); out.append((cat, q, a)); made += 1
    return out

if __name__ == "__main__":
    ex = generate()
    import collections
    print(collections.Counter(c for c, _, _ in ex))
    rng = random.Random(5)
    for cat in GENERATORS:
        c, q, a = next(x for x in ex if x[0] == cat)
        print("=" * 30, cat, "\nQ:", q, "\nA:", a)
