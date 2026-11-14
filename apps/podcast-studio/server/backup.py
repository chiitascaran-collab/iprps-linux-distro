# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Backup, restore and archive of shows (tar.gz with everything needed to rebuild a show)."""
import json, os, shutil, tarfile, time

import store


def backup_dir():
    d = os.path.expanduser((store.load_config().get("backupDir") or "").strip()) or store.sub("backups")
    os.makedirs(d, exist_ok=True)
    return d


def create(sid, include_media=True):
    show = store.get_show(sid)
    name = "%s-%s%s.ipod.tar.gz" % (store.slugify(show["title"]), time.strftime("%Y%m%d-%H%M%S"), "" if include_media else "-lite")
    path = os.path.join(backup_dir(), name)
    root = store.show_dir(sid)

    def filt(ti):
        parts = ti.name.split("/")
        if not include_media and len(parts) > 3 and parts[1] == "episodes" and parts[3] in ("media", "exports"):
            return None if len(parts) > 4 else ti
        return ti
    with store.LOCK:
        manifest = {"app": store.APP_NAME, "version": store.VERSION, "showId": sid, "title": show["title"],
                    "createdAt": store.now(), "includesMedia": include_media}
    tmp = path + ".part"
    with tarfile.open(tmp, "w:gz", compresslevel=3) as tar:
        mpath = os.path.join(store.sub("tmp"), "manifest-%s.json" % sid)
        store.write_json(mpath, manifest)
        tar.add(mpath, arcname="manifest.json")
        tar.add(root, arcname="show", filter=filt)
        os.remove(mpath)
    os.replace(tmp, path)
    return info(name)


def info(name):
    p = os.path.join(backup_dir(), name)
    return {"name": name, "size": os.path.getsize(p), "createdAt": int(os.path.getmtime(p) * 1000)}


def listing():
    d = backup_dir()
    out = [info(f) for f in os.listdir(d) if f.endswith(".tar.gz")]
    out.sort(key=lambda b: -b["createdAt"])
    return {"dir": d, "backups": out}


def path_of(name):
    name = os.path.basename(name)
    p = os.path.join(backup_dir(), name)
    if not name.endswith(".tar.gz") or not os.path.isfile(p):
        raise KeyError("backup not found")
    return p


def delete(name):
    os.remove(path_of(name))


def restore(path):
    """Restore a backup as a show. If the original show still exists the restore becomes a copy."""
    work = os.path.join(store.sub("tmp"), store.new_id("r_"))
    os.makedirs(work)
    try:
        with tarfile.open(path, "r:*") as tar:
            for m in tar.getmembers():
                if m.name.startswith(("/", "..")) or ".." in m.name.split("/") or not (m.isfile() or m.isdir()):
                    raise ValueError("This archive is not a Podcast Studio backup.")
            tar.extractall(work, filter="data")
        src = os.path.join(work, "show")
        show = store.read_json(os.path.join(src, "show.json"))
        if not show or "id" not in show:
            raise ValueError("This archive is not a Podcast Studio backup.")
        with store.LOCK:
            sid = show["id"]
            copy = False
            try:
                store.check_id(sid)
            except ValueError:
                sid = store.new_id("s_")
            if os.path.exists(os.path.join(store.sub("shows"), sid)):
                sid = store.new_id("s_")
                copy = True
            show["id"] = sid
            if copy:
                show["title"] = show.get("title", "Show") + " (restored)"
            store.write_json(os.path.join(src, "show.json"), show)
            edir = os.path.join(src, "episodes")
            if os.path.isdir(edir):
                for eid in os.listdir(edir):
                    ej = os.path.join(edir, eid, "episode.json")
                    ep = store.read_json(ej)
                    if ep:
                        ep["showId"] = sid
                        present = set(os.listdir(os.path.join(edir, eid, "media"))) if os.path.isdir(os.path.join(edir, eid, "media")) else set()
                        for m in ep.get("media", []):
                            m["missing"] = m["file"] not in present
                        xs = set(os.listdir(os.path.join(edir, eid, "exports"))) if os.path.isdir(os.path.join(edir, eid, "exports")) else set()
                        ep["exports"] = [x for x in ep.get("exports", []) if x["file"] in xs]
                        store.write_json(ej, ep)
            os.makedirs(store.sub("shows"), exist_ok=True)
            shutil.move(src, os.path.join(store.sub("shows"), sid))
        return store.get_show(sid)
    finally:
        shutil.rmtree(work, ignore_errors=True)
