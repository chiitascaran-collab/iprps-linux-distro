# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Builds the IPRPS training and eval JSONL files.

Usage: python build_jsonl.py <AI Training Files folder> <output folder>
Needs rules.py, gen.py, gen2.py and dictionary.py next to this script.
"""
import collections, os, re, json, zipfile, hashlib, html, sys, csv
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

SPELL_KEYS = {"createdBy":"Created by","school":"School","tier":"Tier","mana":"Mana cost","inc":"Manifestation",
 "proc":"Procedure / effect","fail":"On failure","cSucc":"Critical success","cFail":"Critical failure","name":"Name"}
DROP_KEYS = {"sources","isCustom","citation","moduleId"}

def render(o, ind=0):
    pad = "  "*ind; out=[]
    if isinstance(o, dict):
        for k,v in o.items():
            if k in DROP_KEYS: continue
            lab = SPELL_KEYS.get(k, k)
            if isinstance(v,list) and v and all(not isinstance(i,(dict,list)) for i in v):
                out.append(f"{pad}{lab}: {', '.join(map(str,v))}")
            elif isinstance(v,(dict,list)) and v:
                out.append(f"{pad}{lab}:"); out.append(render(v, ind+1))
            else:
                out.append(f"{pad}{lab}: {v}")
    elif isinstance(o, list):
        for i in o:
            if isinstance(i, dict):
                r = render(i, ind+1).split("\n")
                if r: r[0] = pad + "- " + r[0].lstrip()
                out.append("\n".join(r))
            else: out.append(f"{pad}- {i}")
    else: out.append(f"{pad}{o}")
    return "\n".join(out)

def json_to_text(obj):
    parts=[]
    if isinstance(obj, list):
        for it in obj:
            if isinstance(it, dict) and "name" in it:
                d = {k:v for k,v in it.items() if k!="name"}
                parts.append(f"### {it['name']}\n{render(d)}")
            else: parts.append(render(it))
    elif isinstance(obj, dict):
        for k,v in obj.items():
            if k in DROP_KEYS: continue
            parts.append(f"## {k}\n" + (render(v) if isinstance(v,(dict,list)) else str(v)))
    else: parts.append(str(obj))
    return "\n\n".join(parts)

import xml.etree.ElementTree as ET
W="{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
def ptext(p):
    out=[]
    for el in p.iter():
        if el.tag==W+"t" and el.text: out.append(el.text)
        elif el.tag==W+"tab": out.append(" ")
        elif el.tag in (W+"br",W+"cr"): out.append("\n")
    return "".join(out).replace("\u200b","").strip()
def docx_text(path):
    root=ET.fromstring(zipfile.ZipFile(path).read("word/document.xml"))
    body=root.find(W+"body"); lines=[]
    for ch in body:
        if ch.tag==W+"p":
            st=ch.find(f"{W}pPr/{W}pStyle"); st=st.get(W+"val") if st is not None else ""
            if st.startswith("TOC"): continue
            t=ptext(ch)
            if not t: continue
            m=re.match(r"Heading(\d)",st)
            if m: t="#"*int(m.group(1))+" "+t.replace("\n"," ")
            elif st=="ListParagraph": t="- "+t
            lines.append(t); lines.append("")
        elif ch.tag==W+"tbl":
            rows=[]
            for tr in ch.iter(W+"tr"):
                cells=[" ".join(ptext(pp) for pp in tc.iter(W+"p") if ptext(pp)).replace("|","/").replace("\n"," ") for tc in tr.findall(W+"tc")]
                if any(cells): rows.append("| "+" | ".join(cells)+" |")
            if rows:
                n=rows[0].count(" | ")+1
                lines += [rows[0], "|"+"---|"*n] + rows[1:] + [""]
    first=next((i for i,l in enumerate(lines) if l.startswith("# ")), 0)
    if len("".join(lines[:first])) < 4000: lines=lines[first:]   # drop title/copyright front matter
    return "\n".join(lines)

def read_file(p):
    if p.lower().endswith(".docx"):
        return docx_text(p), "docx"
    raw = open(p, "rb").read().decode("utf-8", "replace").replace("\r\n","\n").replace("\ufeff","")
    s = raw.strip()
    if s[:1] in "[{":
        try: return json_to_text(json.loads(s)), "json"
        except Exception: pass
    return raw, "text"

META = re.compile(r"^(#+\s*)?(\*\*|\")?(system|publisher|version|profile id|patch id|patch_id|patch number|patch_number|module ?id|id|library version|last updated|date created|created|output folder|output extensions|isbn)(\*\*|\")?\s*[:=]", re.I)
def clean(text):
    lines = text.split("\n"); out=[]; i=0; n=len(lines)
    while i < n:
        l = lines[i]; s = l.strip()
        # table of contents / master index blocks
        if re.match(r"^(#+\s*)?(\*\*)?(table of contents|contents|(section \d+ — )?master index entry)(\*\*)?:?$", s, re.I):
            i += 1; seen=False
            while i < n:
                t = lines[i].strip()
                if seen and (re.match(r"^([=\-_*~]{3,})$", t) or (t.startswith("#") and not re.match(r"^#+\s*(table|contents)", t, re.I))): break
                if t: seen=True
                i += 1
            continue
        if re.match(r"^[=\-_*~#]{3,}$", s) or re.match(r"^[=]{3,}.*[=]{3,}$", s): i+=1; continue
        if ("©" in s or re.search(r"all rights reserved", s, re.I)) and len(s) < 220: i+=1; continue
        if re.match(r"^(#+\s*)?(\*\*)?END OF\b", s): i+=1; continue
        if re.match(r"^IPRPS_First_edition_\d+\w*$", s): i+=1; continue
        if i < 45 and META.match(s) and len(s) > 150:
            s2 = re.sub(r"(System:\s*Infinite Plane Role Playing System( \(IPRPS\))?|Patch ID:\s*\S+|Version:\s*\S+)\s*", "", s).strip()
            if s2: out.append(s2)
            i+=1; continue
        if i < 45 and (META.match(s) or re.match(r"^(#+\s*)?INFINITE PLANE ROLE PLAYING SYSTEM$", s, re.I)): i+=1; continue
        if re.search(r"[═─━]{3,}", s):
            l = re.sub(r"[═─━]{2,}","",l).rstrip(); s=l.strip()
            if not s.strip("# "): i+=1; continue
        if i < 45 and re.match(r"^(#\s*)?(ISBN|PATCH_ID=|VERSION=)", s): i+=1; continue
        if i < 80 and re.match(r"^(Copyright|Published by|ISBN|Library of Congress|Publication Date|Edition|Publisher Contact|Printed in|No part of this publication|For updates, resources|Infinite Plane Roleplaying System is a trademark|The Infinite Plane Roleplaying System is a work of fiction|This book is intended for free distribution)", s, re.I): i+=1; continue
        out.append(l.rstrip()); i+=1
    t = "\n".join(out)
    t = re.sub(r":contentReference\[oaicite:\d+\]\{index=\d+\}", "", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()

SEEN=set(); TITLES=[]; CODE=[False]
def dedupe(text):
    blocks = re.split(r"\n\s*\n", text); keep=[]
    for b in blocks:
        key = re.sub(r"\s+"," ", b).strip().lower()
        if len(key) >= 100:
            if key in SEEN: continue
            SEEN.add(key)
        keep.append(b)
    return "\n\n".join(keep)

def est(t):
    return int(max(len(t)/3.4, len(re.findall(r"\w+|[^\w\s]", t))*1.15)) + 1

def heading(line):
    s=line.strip()
    m = re.match(r"^(#{1,6})\s+(.+)$", s)
    if m: return len(m.group(1)), m.group(2).strip("*# ").strip()
    if 3 <= len(s) <= 90 and not s.startswith("|") and re.search(r"[A-Z]{3}", s) and s == s.upper() \
       and not s.endswith((".", ",")) and len(re.findall(r"[A-Z]", s)) >= 4:
        return 2, s.rstrip(":")
    return None

TARGET, MAX = 1900, 2900
def split_big(text):
    """split an oversized text by blocks then lines, repeating table headers."""
    pieces=[]; cur=[]; table_hdr=None
    for line in text.split("\n"):
        st=line.strip()
        if st.startswith("|"):
            if table_hdr is None and re.match(r"^\|[\s:\-|]+\|$", st) and cur and cur[-1].strip().startswith("|"):
                table_hdr=[cur[-1], line]
        else: table_hdr=None if st else table_hdr
        cand="\n".join(cur+[line])
        if cur and est(cand) > TARGET:
            pieces.append("\n".join(cur).strip()); cur=[]
            if st.startswith("|") and table_hdr and line not in table_hdr: cur=list(table_hdr)
        if est(line) > MAX:  # pathological single line: hard wrap by sentences
            for sent in re.split(r"(?<=[.!?])\s+", line):
                if cur and est("\n".join(cur+[sent]))>TARGET: pieces.append("\n".join(cur).strip()); cur=[]
                cur.append(sent)
        else: cur.append(line)
    if "\n".join(cur).strip(): pieces.append("\n".join(cur).strip())
    return [p for p in pieces if p.strip()]

def chunk(text):
    if CODE[0]:
        return [([], p) for p in split_big(text)]
    secs=[]; path=[]; cur=[]; curpath=[]
    for line in text.split("\n"):
        h=heading(line)
        if h:
            if "\n".join(cur).strip(): secs.append((list(curpath), h[0], "\n".join(cur).strip()))
            lvl, title = h
            path = [p for p in path if p[0] < lvl] + [(lvl, title)]
            curpath = [p[1] for p in path]
            cur = [line if line.strip().startswith("#") else "#"*min(lvl+1,6)+" "+line.strip()]
        else: cur.append(line)
    if "\n".join(cur).strip(): secs.append((list(curpath), 9, "\n".join(cur).strip()))
    secs=[x for x in secs if len([l for l in x[2].split("\n") if l.strip()])>1 or not heading(x[2].split("\n")[0])]
    chunks=[]; buf=[]; bufpath=None
    def flush():
        nonlocal buf, bufpath
        if buf: chunks.append((bufpath, "\n\n".join(buf)))
        buf=[]; bufpath=None
    for pth, lvl, body in secs:
        if est(body) > MAX:
            flush()
            parts = split_big(body)
            for k,p in enumerate(parts):
                chunks.append((pth + ([f"part {k+1} of {len(parts)}"] if len(parts)>1 else []), p))
            continue
        joined = "\n\n".join(buf+[body])
        if buf and (est(joined) > TARGET or (lvl <= 2 and est("\n\n".join(buf)) > 700)):
            flush()
        if not buf: bufpath = pth
        buf.append(body)
    flush()
    return chunks

GENERIC = re.compile(r"^(IPRPS UNIFIED AI PROFILE|INFINITE PLANE|AI PROFILE PATCH\s*$|AI PROFILE\s*$|AI PROFILE PATCH\s*&|.*— PATCH \d+$|PATCH \d+$)", re.I)
TITLE_OVERRIDE = {
 "IPSM_AI_COMPLETE_PROFILE_v3.md":"IPSM-AI Session Master System Profile v3 (Complete Edition)",
 "AI PROFILE Guard response times.txt":"Civic and Military Guard Response and Patrol System",
 "AI Profile patch on content and adult behavior.ipai":"Companionship, Escort, Intimacy, and Care Services Patch",
 "AI Profile patch on etiquette and manners.ipai":"Manners and Etiquette Systems of the Infinite Plane",
 "AI PROFILE REFERENCE LIBRARY.json":"Official Reference Retriever (JSON Reference Library) Profile",
 "AI PROFILE SCENE ORCHESTRATOR AND AI SESSION CONTROL.ipai":"Autonomous Session Director and Scene Orchestrator Profile",
 "AI PROFILE SCENE ORCHESTRATOR.ipai":"Scene Orchestrator Profile",
 "AI_preset_profile_magic_battles.txt":"Magic Battle AI Preset Profiles",
 "AI_PROFILE_DUNGEON_NAMED_BOSSES_Templates.txt":"Dungeon Named Boss Templates",
 "AI_Personalities_NPC_Social_behavior.txt":"NPC Social Behavior Engine",
 "AI_PROFILE_PET_BEHAVIOR.txt":"Pet Behavior and Species Reaction Engine",
 "archivists_enigma_patch_v2.md":"The Archivist's Enigma (Library and Museum Mystery Campaign)",
 "armageddon2419_campaign.json":"Armageddon 2419 Campaign App",
 "armageddon2419_patch.md":"Armageddon 2419 A.D.: Embers of America Patch",
 "atlantis_drowned_throne.ipai.txt":"The Drowned Throne — Atlantis Protocol",
 "autonomous_master_omnibus_v1.md":"Autonomous Master Omnibus Patch",
 "autonomous_master_patch_v2.md":"Autonomous Master High Adventure and Intrigue Patch",
 "iprps_ai_interspecies_relationship_profile.ipai":"Interspecies Relationships Profile",
 "iprps_airship combat_ai_profile.txt":"Steam/Diesel Airship Combat Math Module",
 "iprps_airship combat_flight_behavior_ai_profile.json":"Steam/Diesel Airship Combat Pack",
 "IPRPS_BLOOD_AND_SAND_GLADIATOR_ARENA_CAMPAIGN.md":"The Blood and Sand Engine (Gladiator Arena Campaign)",
 "IPRPS_COMPANION_HEART_PATCH.md":"Companion Heart: Persistent Romantic Partner AI",
 "IPRPS_GRID_TRAVELER_PATCH.md":"GRID Traveler: The Stellar Expanse",
 "IPRPS_MAPLEWOOD_HEIGHTS_PATCH.md":"Maplewood Heights: Life in the Golden Age",
 "IPRPS_ROLEPLAY_PARTNER_MEMORY_ENGINE_PATCH.md":"Roleplay Partner and Persistent Memory Engine",
 "IPRPS_ROTTEN_APPLE_PATCH.md":"The Rotten Apple: Maplewood Heights After Dark",
 "IPRPS_SPECIES_AI_PROFILE_PATCH.md":"IPRPS Species Compendium",
 "IPRPS_STELLAR_CONCORD_PATCH.md":"The Stellar Concord: Infinite Frontiers",
 "IPRPS_WHOO_HOO_BIRD_TRIGGER_OVERLAY.md":"The Whoo Hoo! Bird Trigger Overlay",
 "iprps_combat_ai_profile.txt":"Session Master Combat System Profile",
 "official_trap_anti_magick_spells_edition_one_03102026a.ipai":"Official Trap and Anti-Magick Spells (Edition One)",
 "official_trap_anti_magick_spells_edition_two_03102026a.ipai":"Official Trap and Anti-Magick Spells (Edition Two)",
 "patch_42_rayguns_radium_punk_v2.md":"Patch 42: Rayguns and Radium Punk",
 "shadows_lamplit_age_v1.md":"Shadows of the Lamplit Age",
 "starfall_exiles_campaign_v1.md":"Starfall Exiles Campaign",
 "iprps_ai_personality_profile.ipai":"Response Personality Override Profile",
 "AI Profile for swarms mobs and group combat rules.txt":"Swarms, Mobs, and Group Combat Rules",
 "SESSION HUD_start.ipai":"Session HUD Start Template",
 "IPRPS_First_edition_11102026.docx":"Infinite Plane Role Playing System First Edition Core Rulebook",
}
def doc_title(fname, text):
    if fname in TITLE_OVERRIDE: return TITLE_OVERRIDE[fname]
    for l in text.split("\n")[:25]:
        s=l.strip().lstrip("#").strip().strip("*").strip()
        if not s or len(s)>110: continue
        m=re.search(r"PATCH(?: \d+)?\s*[:—-]\s*(.{4,})$", s, re.I)
        if GENERIC.match(s):
            if m: return m.group(1).strip()
            continue
        if re.match(r"^(SECTION|PART|TABLE|CHAPTER)\b", s, re.I): break
        s=re.sub(r"^(AI PROFILE( PATCH)?|AI Profile Patch)\s*[:—-]\s*","",s,flags=re.I)
        if len(s) >= 4: return s
    b=os.path.splitext(fname)[0].replace(".ipai","")
    return re.sub(r"[_]+"," ",b).strip()

SYSTEM = ("You are the AI Session Master and rules assistant for the Infinite Plane Role Playing System (IPRPS) "
          "by Mythical Legends Publishing, LLC. You apply the official IPRPS AI profiles, profile patches, "
          "campaign patches and rules accurately, completely and in their intended tone.")
TEMPL = ["What does the {doc} say about {sec}? Give me the full details.",
         "Explain {sec} from the {doc}.",
         "As the Session Master, how should I run {sec} under the {doc}?",
         "Give me the complete rules and guidance for {sec} in the {doc}.",
         "I'm running an IPRPS game. Walk me through {sec} as defined in the {doc}.",
         "Load the {doc} and lay out {sec} for me."]

def glossary(text):
    paras=[p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    on=False; entries=collections.OrderedDict(); pending=None
    def add(term, d):
        d=re.sub(r"\s*Appears in \d+ files?\.\s*$","",d).strip()
        if d: entries.setdefault(term.strip(), []).append(d)
    for p in paras:
        if p.startswith("PART I — CORE CONCEPTS") or p.endswith("PART I — CORE CONCEPTS") or "PART I — CORE CONCEPTS" in p: on=True; continue
        if "APPENDIX — SOURCE INDEX" in p: break
        if not on: continue
        if pending and re.match(r"^1\. ", p):
            for sense in re.split(r"\n(?=\d+\. )", p): add(pending, re.sub(r"^\d+\. ","",sense))
            pending=None; continue
        pending=None
        m=re.match(r"^(.+?) Appears in \d+ files?\.$", p)
        if m and " — " not in p: pending=m.group(1); continue
        if " — " in p and not re.match(r"^[=\-]{3,}", p):
            term, d = p.split(" — ", 1); add(term, d.replace("\n"," "))
    return entries
GTEMPL=["What does \"{t}\" mean in IPRPS?","Define the IPRPS term \"{t}\".","In the Infinite Plane Role Playing System, what is {t}?","Explain {t} as used in IPRPS."]

def h(s): return int(hashlib.sha1(s.encode()).hexdigest(), 16)


import random as _random, sys as _sys, tempfile as _tf
_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_fe = [x for x in os.listdir(SRC) if x.lower().startswith("iprps_first_edition") and x.lower().endswith(".docx")]
FE_MD = os.path.join(_tf.gettempdir(), "iprps_first_edition.md")
open(FE_MD, "w", encoding="utf8").write(docx_text(os.path.join(SRC, sorted(_fe)[-1])))
os.environ["IPRPS_FIRST_EDITION"] = FE_MD; os.environ["IPRPS_SRC"] = SRC
import dictionary as DICT, gen as GEN, gen2 as GEN2

SKIP = {"iprps_glossary.txt", "chat_template.txt"}
order = sorted(os.listdir(SRC), key=lambda f: (0 if "MASTER_AI_PROFILE" in f else 1 if "IPSM_AI_COMPLETE" in f else 2, f.lower()))
rows = []   # (split, category, source, section, example)
seen_chunks=set(); stats={"files":0,"maxtok":0,"skipped_files":[]}

def add(split, cat, src, sec, user, body):
    ex={"messages":[{"role":"system","content":SYSTEM},{"role":"user","content":user},{"role":"assistant","content":body}]}
    tok=est(SYSTEM+user+body)+12
    stats["maxtok"]=max(stats["maxtok"],tok)
    rows.append((split, cat, src, sec, tok, ex))

for f in order:
    p=os.path.join(SRC,f)
    if not os.path.isfile(p) or f.lower() in SKIP: continue
    try: raw,kind=read_file(p)
    except Exception as e: stats["skipped_files"].append(f"{f}: {e}"); continue
    CODE[0] = bool(re.match(r'\s*(import |const |function |<!DOCTYPE|<html)', raw))
    text = raw.strip() if CODE[0] else dedupe(clean(raw))
    if not text.strip(): stats["skipped_files"].append(f+": empty after cleaning"); continue
    stats["files"]+=1
    doc = doc_title(f, text)
    chs = chunk(text)
    for idx,(pth,body) in enumerate(chs):
        body=body.strip()
        key=re.sub(r"\s+"," ",body).lower()
        if len(key)<40 or key in seen_chunks: continue
        seen_chunks.add(key)
        sec = " > ".join(pth[-2:]) if pth else "the overview and core premise"
        norm=lambda x: re.sub(r"[^a-z0-9]","",x.lower())
        if pth and len(pth)<=2 and (norm(doc) in norm(pth[-1]) or norm(pth[-1]) in norm(doc) or idx==0 and len(pth)==1):
            sec="the overview and core premise"
        if CODE[0]: user = f'Show me the source code of the {doc} (part {idx+1} of {len(chs)}).'
        else: user = TEMPL[h(f+str(idx)) % len(TEMPL)].format(doc=doc, sec=sec)
        split = "eval" if (len(chs)>=4 and h("split"+key)%10==0) else "train"
        add(split, "document", f, sec, user, body)

# ---- Core Dictionary
fe_text = open(FE_MD, encoding="utf8").read()
entries = DICT.build(fe_text, open(os.path.join(SRC,"IPRPS_MASTER_AI_PROFILE_v6.md"),encoding="utf8").read(),
                     open(os.path.join(SRC,"IPRPS_Glossary.txt"),encoding="utf8").read())
open(os.path.join(OUT,"IPRPS_Core_Dictionary.md"),"w",encoding="utf8").write(DICT.to_markdown(entries))
DQ = ["What is {t} in IPRPS?", "Define the IPRPS term \"{t}\".", "Quick rules lookup: {t}.", "In the Infinite Plane Role Playing System, what does {t} mean?"]
for c,t,d in entries:
    add("eval" if h("d"+t)%10==0 else "train", "dictionary", "IPRPS Core Dictionary", t, DQ[h(t)%len(DQ)].format(t=t), f"**{t}** — {d}")
bycat = collections.OrderedDict()
for c,t,d in entries: bycat.setdefault(c,[]).append((t,d))
for c,items in bycat.items():
    add("train", "dictionary", "IPRPS Core Dictionary", c, f"List the core IPRPS terms for {c} with their definitions.",
        f"## {c}\n\n" + "\n".join(f"- **{t}** — {d}" for t,d in items))

# ---- Rule-grounded worked examples
for cat, q, a in GEN.generate() + GEN2.generate():
    add("eval" if h("s"+q)%10==0 else "train", cat, "generated (IPRPS rules)", cat, q, a)

# ---- write (shuffled, deterministic)
_random.Random(7).shuffle(rows)
train=open(f"{OUT}/iprps_train.jsonl","w",encoding="utf8"); evalf=open(f"{OUT}/iprps_eval.jsonl","w",encoding="utf8")
man=csv.writer(open(f"{OUT}/manifest.csv","w",newline="",encoding="utf8")); man.writerow(["id","split","category","source_file","section","est_tokens"])
cnt=collections.Counter()
for split,cat,src,sec,tok,ex in rows:
    (evalf if split=="eval" else train).write(json.dumps(ex,ensure_ascii=False)+"\n")
    cnt[split]+=1; cnt[(split,cat)]+=1
    man.writerow([f"{split}-{cnt[split]:05d}",split,cat,src,sec,tok])
stats["train"]=cnt["train"]; stats["eval"]=cnt["eval"]; stats["dictionary_terms"]=len(entries)
stats["by_category"]={c: [cnt[("train",c)], cnt[("eval",c)]] for c in sorted({r[1] for r in rows})}
print(json.dumps(stats,indent=1))
