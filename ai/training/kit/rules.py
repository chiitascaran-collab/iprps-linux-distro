# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""IPRPS core rules used by the example generators.

Every number here comes from the IPRPS First Edition core rulebook (Complete Tables & Charts
Reference and Core Formulas Quick Reference), except where noted as Master AI Profile v6.0.
"""
import math, random, re

ATTRS = ["STR", "DEX", "CON", "INT", "WIS", "CHA", "WIL"]
ATTR_NAMES = {"STR": "Strength", "DEX": "Dexterity", "CON": "Constitution", "INT": "Intelligence",
              "WIS": "Wisdom", "CHA": "Charisma", "WIL": "Will Power"}

# ---------- character economy ----------
def attr_cost(attr, level):
    """DP cost (positive) or gain (negative) of an attribute level. Base 10 is free."""
    if level >= 10:
        return (level - 10) * (10 if attr in ("INT", "DEX") else 5)
    return -2 * (10 - level)

def _skill_level_cost(l):
    if l <= 3: return 1
    if l <= 9: return 2
    if l == 10: return 5
    if l <= 14: return 3
    if l == 15: return 10
    if l <= 19: return 5
    if l == 20: return 15
    if l <= 49: return 10
    if l == 50: return 50
    if l <= 99: return 20
    return 100

def skill_cost(level):
    """Total cumulative DP for a skill level (Ascendant Skill Cost Table)."""
    return sum(_skill_level_cost(l) for l in range(1, level + 1))

RANKS = [(0, "Instinctual"), (1, "Natural"), (4, "Competent"), (10, "Average"), (11, "Honed"), (15, "Exceptional"),
         (16, "Elite"), (20, "Heroic"), (21, "Master"), (50, "Demigod"), (51, "Mythic"), (100, "Divine")]
def skill_rank(level):
    name = "Instinctual"
    for lv, n in RANKS:
        if level >= lv: name = n
    return name

ATTR_DESC = [(1, "Feeble"), (5, "Poor"), (8, "Below Avg"), (9, "Weak"), (10, "Average"), (11, "Above Avg"),
             (12, "Honed"), (15, "Exceptional"), (20, "Heroic"), (50, "Demigod"), (100, "Divine")]
def attr_desc(level):
    name = "Feeble"
    for lv, n in ATTR_DESC:
        if level >= lv: name = n
    return name

POINT_TIERS = [(0, 29, "Feeble"), (30, 70, "Average"), (71, 100, "Competent"), (101, 150, "Exceptional"),
               (151, 250, "Heroic"), (251, 300, "Larger than Life"), (301, 500, "Legendary"),
               (501, 700, "Blessed"), (1000, 2000, "Divine")]
def point_tier(p):
    for lo, hi, n in POINT_TIERS:
        if lo <= p <= hi: return n
    return "Legendary"

# ---------- checks ----------
def skill_shift(skill):
    return min(skill // 10, 10)

def attr_shift(a):
    """Attribute Shift, clamped per the Attribute Shift Table."""
    if a >= 100: return 5
    if a >= 50: return 4
    if a >= 20: return 3
    if a >= 15: return 2
    if a >= 11: return 1
    if a == 10: return 0
    if a >= 8: return -1
    if a >= 5: return -2
    return -3

def base_band(total):
    if total <= 6: return "Fail"
    if total <= 12: return "Uncertain"
    return "Success"

def eff_band(roll):
    """Effectiveness Roll band and damage multiplier."""
    if roll >= 13: return "Critical Impact (full damage)", 1.0
    if roll >= 7: return "Solid Hit (half damage)", 0.5
    return "Glancing Blow (quarter damage)", 0.25

def crit(raw):
    """First Edition quick reference: critical success on 18-20, critical failure on 1-3 (raw d20)."""
    if raw >= 18: return "critical success"
    if raw <= 3: return "critical failure"
    return None

REACTION = [(-99, 0, "Disastrous", "betrayal, violence, or deliberate sabotage"),
            (1, 4, "Very Bad", "strongly dislikes the PCs and works against them when possible"),
            (5, 8, "Bad", "indifferent to hostile; helps only for clear personal gain"),
            (9, 11, "Poor", "little interest; suspicion, delays, unreasonable demands"),
            (12, 14, "Neutral", "detached; business proceeds if customs are followed"),
            (15, 17, "Good", "favorable; provides reasonable assistance"),
            (18, 19, "Very Good", "respect; generous help, fair deals, useful information"),
            (20, 999, "Excellent", "strong admiration or loyalty; acts in the PCs' best interest at personal risk")]
def reaction(total):
    for lo, hi, n, d in REACTION:
        if lo <= total <= hi: return n, d

PROFICIENCY = [(-99, 0, "Complete newbie"), (1, 9, "Some competency"), (10, 12, "Competent"), (13, 15, "Highly trained"),
               (16, 20, "Expert"), (21, 30, "Genius"), (31, 9999, "Extraordinary")]
def proficiency_tier(v):
    for lo, hi, n in PROFICIENCY:
        if lo <= v <= hi: return n

# ---------- derived stats ----------
SIZE_HP = {-3: -0.50, -2: -0.30, -1: -0.15, 0: 0.0, 1: 0.25, 2: 0.50, 3: 1.00, 4: 2.00, 5: 3.00, 6: 5.00}

def hp(con, level=1, size=0):
    base = 50 + con * 10 + level * 5
    return base, int(base * (1 + SIZE_HP.get(size, 0)))

def basic_speed(dex, con):
    raw = (dex + con) / 4
    frac = raw - math.floor(raw)
    return (math.ceil(raw) if frac >= 0.85 else math.floor(raw)), raw

def dodge(speed, dex):
    return math.floor(speed + (dex - 10) / 2)

def mana_pool(roll, hp_val, intel, size):
    return ((roll * hp_val + intel // 3) + size * 100) * 3

# ---------- dice ----------
def parse_dice(expr):
    m = re.match(r"(\d+)d(\d+)\s*([+-]\s*\d+)?$", expr.replace(" ", ""))
    n, d = int(m.group(1)), int(m.group(2))
    mod = int(m.group(3).replace(" ", "")) if m.group(3) else 0
    return n, d, mod

def roll_dice(rng, expr):
    n, d, mod = parse_dice(expr)
    rolls = [rng.randint(1, d) for _ in range(n)]
    return rolls, max(0, sum(rolls) + mod), mod

def fmt_roll(expr, rolls, total, mod):
    inner = " + ".join(map(str, rolls))
    if mod: inner += f" {'+' if mod > 0 else '−'} {abs(mod)}"
    return f"{expr} → {inner} = {total}" if (len(rolls) > 1 or mod) else f"{expr} → {total}"

WEAPONS = {  # Typical Weapon Damage by Type (First Edition table 6.4)
    "unarmed strike": "1d6-1", "dagger": "1d6", "shortsword": "1d6+1", "longsword": "2d6", "greatsword": "3d6",
    "bow": "1d6+1", "crossbow": "2d6", "spear": "1d6+2", "warhammer": "2d6+1", "pistol": "2d6", "rifle": "3d6+2",
}
RANGED = {"bow", "crossbow", "pistol", "rifle"}
