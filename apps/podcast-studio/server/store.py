# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Storage layer: JSON files on disk, no database required."""
import json, os, re, shutil, threading, time, uuid, secrets

LOCK = threading.RLock()
APP_NAME = "iprps-podcast-studio"
VERSION = "1.0.0"
ID_RE = re.compile(r"^[a-z0-9_]{3,40}$")


def data_dir():
    d = os.environ.get("IPRPS_PODCAST_DATA")
    if not d:
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
        d = os.path.join(base, APP_NAME)
    os.makedirs(d, exist_ok=True)
    return d


def config_path():
    d = os.environ.get("IPRPS_PODCAST_CONFIG")
    if not d:
        base = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
        d = os.path.join(base, APP_NAME)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "config.json")


def sub(*parts):
    p = os.path.join(data_dir(), *parts)
    return p


def now():
    return int(time.time() * 1000)


def new_id(prefix):
    return prefix + uuid.uuid4().hex[:10]


def check_id(i):
    if not isinstance(i, str) or not ID_RE.match(i):
        raise ValueError("bad id")
    return i


def slugify(s, fallback="untitled"):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (s or "").strip().lower()).strip("-")
    return s[:60] or fallback


def safe_name(name):
    name = os.path.basename(name or "file")
    name = re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip(" .")
    return name[:120] or "file"


def read_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, obj, mode=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp%d" % threading.get_ident()
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
    if mode is not None:
        os.chmod(tmp, mode)
    os.replace(tmp, path)


# ---------------------------------------------------------------- config
KEY_NAMES = ["gemini", "xai", "elevenlabs", "anthropic", "podcastindexKey", "podcastindexSecret"]

DEFAULT_CONFIG = {
    "hostPort": 8765,
    "guestPort": 8766,
    "guestEnabled": True,
    "guestTls": True,
    "publicUrl": "",
    "iceServers": [{"urls": "stun:stun.cloudflare.com:3478"}, {"urls": "stun:stun.l.google.com:19302"}],
    "keys": {k: "" for k in KEY_NAMES},
    "ollamaUrl": "http://127.0.0.1:11434",
    "sttProvider": "gemini",
    "geminiTtsModel": "gemini-3.8-flash-tts",
    "elevenModel": "eleven_multilingual_v2",
    "backupDir": "",
}


def load_config():
    with LOCK:
        cfg = json.loads(json.dumps(DEFAULT_CONFIG))
        saved = read_json(config_path(), {}) or {}
        for k, v in saved.items():
            if k == "keys" and isinstance(v, dict):
                cfg["keys"].update({a: b for a, b in v.items() if a in KEY_NAMES})
            elif k in cfg:
                cfg[k] = v
        return cfg


def save_config(patch):
    """Merge a patch. Keys are write-only: an empty/absent key leaves the stored one alone;
    the literal string "-" clears it."""
    with LOCK:
        cfg = load_config()
        for k, v in (patch or {}).items():
            if k == "keys" and isinstance(v, dict):
                for a, b in v.items():
                    if a in KEY_NAMES and isinstance(b, str) and b.strip():
                        cfg["keys"][a] = "" if b.strip() == "-" else b.strip()
            elif k in DEFAULT_CONFIG and k != "keys":
                cfg[k] = v
        write_json(config_path(), cfg, mode=0o600)
        return cfg


def public_config(cfg=None):
    cfg = cfg or load_config()
    out = {k: v for k, v in cfg.items() if k != "keys"}
    out["hasKey"] = {k: bool(v) for k, v in cfg["keys"].items()}
    out["keyHint"] = {k: ("…" + v[-4:] if len(v) > 8 else ("set" if v else "")) for k, v in cfg["keys"].items()}
    return out


# ---------------------------------------------------------------- shows
DIRECTORY_IDS = ["apple", "spotify", "youtube", "amazon", "iheart", "podcastindex", "pocketcasts",
                 "tunein", "pandora", "deezer", "listennotes", "playerfm", "podchaser", "goodpods"]


def default_show():
    return {
        "title": "New Show", "subtitle": "", "description": "", "author": "", "ownerName": "",
        "ownerEmail": "", "language": "en", "category": "Leisure", "subcategory": "Games",
        "explicit": False, "showType": "episodic", "copyright": "", "website": "",
        "coverAsset": "", "logoAsset": "", "introAsset": "", "outroAsset": "",
        "brand": {"primary": "#7c5cff", "accent": "#ffb347", "bg": "#0f1218", "text": "#f2f4f8",
                  "tagline": "", "lowerThirds": True, "watermark": True, "footer": ""},
        "assets": [], "pads": [],
        "cast": [{"id": new_id("c_"), "name": "Host", "role": "host", "kind": "human"}],
        "feed": {"publicBaseUrl": "", "deployMode": "folder", "deployFolder": "", "sshTarget": "",
                 "locked": True, "fundingUrl": "", "lastPublished": 0},
        "directories": {d: {"status": "none", "url": "", "notes": ""} for d in DIRECTORY_IDS},
        "archived": False,
    }


def show_dir(sid):
    return sub("shows", check_id(sid))


def ep_dir(sid, eid):
    return os.path.join(show_dir(sid), "episodes", check_id(eid))


def _ensure_cast(show):
    changed = False
    for c in show.get("cast", []):
        if not c.get("id"):
            c["id"] = new_id("c_"); changed = True
        if c.get("kind") != "ai" and c.get("role") != "host" and not c.get("inviteToken"):
            c["inviteToken"] = secrets.token_urlsafe(18); changed = True
    return changed


def list_shows():
    out = []
    root = sub("shows")
    if os.path.isdir(root):
        for sid in sorted(os.listdir(root)):
            s = read_json(os.path.join(root, sid, "show.json"))
            if s:
                s["episodeCount"] = len(list_episode_ids(sid))
                out.append(s)
    out.sort(key=lambda s: -s.get("updatedAt", 0))
    return out


def get_show(sid):
    s = read_json(os.path.join(show_dir(sid), "show.json"))
    if not s:
        raise KeyError("show not found")
    base = default_show()
    for k, v in base.items():
        if k not in s:
            s[k] = v
        elif isinstance(v, dict) and k in ("brand", "feed"):
            for a, b in v.items():
                s[k].setdefault(a, b)
    for d in DIRECTORY_IDS:
        s["directories"].setdefault(d, {"status": "none", "url": "", "notes": ""})
    return s


def save_show(show):
    with LOCK:
        _ensure_cast(show)
        show["updatedAt"] = now()
        show.pop("episodeCount", None)
        write_json(os.path.join(show_dir(show["id"]), "show.json"), show)
        return show


def create_show(data=None):
    with LOCK:
        show = default_show()
        for k, v in (data or {}).items():
            if k in show and k not in ("assets",):
                show[k] = v
        show["id"] = new_id("s_")
        show["createdAt"] = now()
        os.makedirs(os.path.join(show_dir(show["id"]), "assets"), exist_ok=True)
        return save_show(show)


def update_show(sid, patch):
    with LOCK:
        show = get_show(sid)
        for k, v in (patch or {}).items():
            if k in ("id", "createdAt", "assets", "episodeCount"):
                continue
            show[k] = v
        return save_show(show)


def delete_show(sid):
    with LOCK:
        shutil.rmtree(show_dir(sid), ignore_errors=True)


def duplicate_show(sid):
    with LOCK:
        src = get_show(sid)
        new = json.loads(json.dumps(src))
        new["id"] = new_id("s_")
        new["title"] = src["title"] + " (copy)"
        new["createdAt"] = now()
        new["feed"]["lastPublished"] = 0
        new["directories"] = {d: {"status": "none", "url": "", "notes": ""} for d in DIRECTORY_IDS}
        for c in new["cast"]:
            c.pop("inviteToken", None)
        os.makedirs(show_dir(new["id"]), exist_ok=True)
        a = os.path.join(show_dir(sid), "assets")
        if os.path.isdir(a):
            shutil.copytree(a, os.path.join(show_dir(new["id"]), "assets"))
        return save_show(new)


def asset_path(show, asset_id):
    for a in show.get("assets", []):
        if a["id"] == asset_id:
            return os.path.join(show_dir(show["id"]), "assets", a["file"]), a
    return None, None


# ---------------------------------------------------------------- episodes
def default_timeline():
    return {"tracks": [], "master": {"eq": [0] * 10, "vol": 1, "loudness": -16},
            "video": {"layout": "grid"}}


def default_track(name, **kw):
    t = {"id": new_id("t_"), "name": name, "vol": 1, "pan": 0, "mute": False, "solo": False,
         "hideVideo": False, "clips": [],
         "fx": {"eq": [0] * 10, "hp": False, "comp": False, "gate": False, "denoise": False}}
    t.update(kw)
    return t


def default_episode():
    return {"title": "Untitled Episode", "description": "", "season": 1, "number": 1,
            "episodeType": "full", "explicit": False, "status": "draft", "published": False,
            "pubDate": 0, "script": "", "chapters": [], "transcript": [], "media": [],
            "exports": [], "feedExportId": "", "timeline": default_timeline()}


def list_episode_ids(sid):
    d = os.path.join(show_dir(sid), "episodes")
    return sorted(os.listdir(d)) if os.path.isdir(d) else []


def list_episodes(sid, full=False):
    out = []
    for eid in list_episode_ids(sid):
        e = read_json(os.path.join(show_dir(sid), "episodes", eid, "episode.json"))
        if e:
            if not full:
                e = {k: e.get(k) for k in ("id", "showId", "title", "season", "number", "episodeType",
                                           "status", "published", "pubDate", "createdAt", "updatedAt",
                                           "feedExportId", "description")} | {
                    "mediaCount": len(e.get("media", [])), "exportCount": len(e.get("exports", []))}
            out.append(e)
    out.sort(key=lambda e: (-(e.get("season") or 0), -(e.get("number") or 0), -(e.get("createdAt") or 0)))
    return out


def get_episode(sid, eid):
    e = read_json(os.path.join(ep_dir(sid, eid), "episode.json"))
    if not e:
        raise KeyError("episode not found")
    for k, v in default_episode().items():
        e.setdefault(k, v)
    return e


def save_episode(ep):
    with LOCK:
        ep["updatedAt"] = now()
        write_json(os.path.join(ep_dir(ep["showId"], ep["id"]), "episode.json"), ep)
        return ep


def create_episode(sid, data=None):
    with LOCK:
        get_show(sid)
        ep = default_episode()
        existing = list_episodes(sid)
        ep["number"] = max([e.get("number") or 0 for e in existing] + [0]) + 1
        if existing:
            ep["season"] = existing[0].get("season") or 1
        for k, v in (data or {}).items():
            if k in ep and k not in ("media", "exports"):
                ep[k] = v
        ep["id"] = new_id("e_")
        ep["showId"] = sid
        ep["createdAt"] = now()
        for s in ("media", "exports"):
            os.makedirs(os.path.join(ep_dir(sid, ep["id"]), s), exist_ok=True)
        return save_episode(ep)


def update_episode(sid, eid, patch):
    with LOCK:
        ep = get_episode(sid, eid)
        for k, v in (patch or {}).items():
            if k in ("id", "showId", "media", "exports", "createdAt"):
                continue
            ep[k] = v
        return save_episode(ep)


def delete_episode(sid, eid):
    with LOCK:
        shutil.rmtree(ep_dir(sid, eid), ignore_errors=True)


def place_clip(sid, eid, media_id, track_name, start, mute_track=False, rank=3):
    """Put a whole media item on the named track (created if missing) at `start` seconds."""
    with LOCK:
        ep = get_episode(sid, eid)
        m = next((x for x in ep["media"] if x["id"] == media_id), None)
        if not m:
            raise KeyError("media not found")
        tl = ep["timeline"]
        tr = next((t for t in tl["tracks"] if t["name"] == track_name), None)
        if not tr:
            tr = default_track(track_name, mute=bool(mute_track), rank=rank)
            at = next((i for i, t in enumerate(tl["tracks"]) if t.get("rank", 3) > rank), len(tl["tracks"]))
            tl["tracks"].insert(at, tr)      # host first, then guests, AI, screen share, decks, safety mix
        clip = {"id": new_id("k_"), "mediaId": media_id, "in": 0, "out": round(m.get("duration") or 0, 3),
                "start": round(max(0.0, float(start or 0)), 3), "gain": 1, "fadeIn": 0, "fadeOut": 0, "mute": False}
        tr["clips"].append(clip)
        if ep.get("status") == "draft":
            ep["status"] = "recorded"
        save_episode(ep)
        return clip
