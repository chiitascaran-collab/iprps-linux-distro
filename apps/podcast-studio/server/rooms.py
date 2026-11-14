# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Live session rooms: WebRTC signalling over Server-Sent Events, recording state and chunk uploads."""
import json, os, queue, shutil, threading, time

import media, store

ROOMS = {}
LOCK = threading.RLock()


class Room:
    def __init__(self, sid, eid):
        self.sid, self.eid = sid, eid
        self.peers = {}          # peerId -> {"info": {...}, "q": Queue, "gen": int}
        self.rec = None          # {"id", "t0", "paused", "pausedAt", "pausedMs"}
        self.recs = {}           # upload id -> {"peer", "name", "offset", "kind", "dir", "done"}
        self.gen = 0

    def state(self):
        return {"peers": [p["info"] for p in self.peers.values()], "rec": self.rec}

    def send(self, to, msg):
        raw = json.dumps(msg)
        for pid, p in list(self.peers.items()):
            if to in ("*", pid) and pid != msg.get("from"):
                p["q"].put(raw)

    def broadcast(self, msg):
        raw = json.dumps(msg)
        for p in list(self.peers.values()):
            p["q"].put(raw)


def get_room(sid, eid):
    with LOCK:
        key = sid + "/" + eid
        if key not in ROOMS:
            ROOMS[key] = Room(sid, eid)
        return ROOMS[key]


def join(room, info):
    """Register a peer; returns (queue, generation). A re-join replaces the old connection."""
    with LOCK:
        room.gen += 1
        gen = room.gen
        old = room.peers.get(info["id"])
        if old:
            old["q"].put(None)
        q = queue.Queue()
        others = [p["info"] for pid, p in room.peers.items() if pid != info["id"]]
        room.peers[info["id"]] = {"info": info, "q": q, "gen": gen}
        q.put(json.dumps({"type": "hello", "you": info, "peers": others, "rec": room.rec, "now": store.now()}))
        room.send("*", {"type": "peer-join", "from": info["id"], "peer": info})
        return q, gen


def leave(room, peer_id, gen):
    with LOCK:
        p = room.peers.get(peer_id)
        if p and p["gen"] == gen:
            del room.peers[peer_id]
            room.broadcast({"type": "peer-leave", "from": peer_id})


def rec_action(room, action):
    with LOCK:
        now = store.now()
        if action == "start":
            room.rec = {"id": store.new_id("r_"), "t0": now, "paused": False, "pausedAt": 0, "pausedMs": 0}
        elif not room.rec:
            return None
        elif action == "pause" and not room.rec["paused"]:
            room.rec.update(paused=True, pausedAt=now)
        elif action == "resume" and room.rec["paused"]:
            room.rec["pausedMs"] += now - room.rec["pausedAt"]
            room.rec.update(paused=False, pausedAt=0)
        elif action == "stop":
            rec, room.rec = room.rec, None
            room.broadcast({"type": "rec", "action": "stop", "rec": rec, "now": now})
            threading.Timer(25, finalize_leftovers, args=(room, rec["id"])).start()
            return rec
        room.broadcast({"type": "rec", "action": action, "rec": room.rec, "now": now})
        return room.rec


# ---- chunked uploads of each participant's local recording -----------------------------------
def _safe(s):
    return "".join(ch for ch in str(s) if ch.isalnum() or ch in "_-")[:80]


def upload_dir(room, up_id):
    return os.path.join(store.sub("tmp"), "up_" + _safe(room.eid) + "_" + _safe(up_id))


def begin_upload(room, up_id, meta):
    with LOCK:
        d = upload_dir(room, up_id)
        os.makedirs(d, exist_ok=True)
        room.recs[up_id] = {"peer": meta.get("peer", ""), "name": meta.get("name", "Guest"),
                            "offset": float(meta.get("offset") or 0), "kind": meta.get("kind", "cam"),
                            "ext": ".webm", "dir": d, "done": False, "recId": meta.get("recId", "")}


def save_chunk(room, up_id, seq, stream, length):
    info = room.recs.get(up_id)
    if not info or info["done"]:
        raise KeyError("unknown upload")
    path = os.path.join(info["dir"], "%06d.part" % int(seq))
    left = length
    with open(path + ".tmp", "wb") as f:
        while left > 0:
            buf = stream.read(min(1 << 20, left))
            if not buf:
                break
            f.write(buf)
            left -= len(buf)
    os.replace(path + ".tmp", path)


def finish_upload(room, up_id, offset=None, discard=False):
    with LOCK:
        info = room.recs.get(up_id)
        if not info or info["done"]:
            return None
        info["done"] = True
    if discard:
        shutil.rmtree(info["dir"], ignore_errors=True)
        return None
    if offset is not None:
        try:
            info["offset"] = max(0.0, float(offset))
        except (TypeError, ValueError):
            pass
    parts = sorted(f for f in os.listdir(info["dir"]) if f.endswith(".part"))
    if not parts:
        shutil.rmtree(info["dir"], ignore_errors=True)
        return None
    raw = os.path.join(info["dir"], "joined" + info["ext"])
    with open(raw, "wb") as out:
        for p in parts:
            with open(os.path.join(info["dir"], p), "rb") as f:
                shutil.copyfileobj(f, out)
    labels = {"cam": info["name"], "program": "Program mix (safety)", "fx": "Decks & soundboard",
              "screen": "Screen share"}
    track = labels.get(info["kind"], info["name"])
    try:
        entry = media.ingest(room.sid, room.eid, raw, "%s %s.webm" % (track, time.strftime("%Y-%m-%d %H.%M")),
                             participant=info["name"], source="rec", remux=True)
        rank = {"cam": 0 if info["peer"] == "host" else 1, "screen": 4, "fx": 5, "program": 6}.get(info["kind"], 3)
        store.place_clip(room.sid, room.eid, entry["id"], track, info["offset"], mute_track=(info["kind"] == "program"), rank=rank)
        room.broadcast({"type": "media", "media": entry, "track": track})
        return entry
    except Exception as ex:  # noqa
        room.broadcast({"type": "error", "msg": "Could not save %s's recording: %s" % (info["name"], ex)})
        return None
    finally:
        shutil.rmtree(info["dir"], ignore_errors=True)


def finalize_leftovers(room, rec_id):
    """A participant who dropped mid-recording never calls finish — keep what they uploaded."""
    for up_id, info in list(room.recs.items()):
        if info.get("recId") == rec_id and not info["done"]:
            finish_upload(room, up_id)
