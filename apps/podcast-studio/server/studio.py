#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""IPRPS Podcast Studio — local server.

Two listeners:
  * host   http://127.0.0.1:8765   the Session Master's studio (full control, this machine only)
  * guest  https://0.0.0.0:8766    join pages for remote co-hosts/guests (invite-token gated, nothing else)

Only Python's standard library is used; ffmpeg does the media work.
"""
import argparse, base64, json, mimetypes, os, queue, re, shutil, socket, ssl, subprocess, sys, threading, time
import urllib.parse, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai, backup, feed, media, rooms, store  # noqa: E402

WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")
ROUTES = []
RUNTIME = {"hostPort": 8765, "guestPort": 8766, "guestTls": False, "guestUp": False}
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("audio/webm", ".weba")
mimetypes.add_type("video/webm", ".webm")


class HTTPError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code, self.msg = code, msg


def route(method, pattern, scope="host"):
    rx = re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>[^/]+)", pattern) + "$")

    def deco(fn):
        ROUTES.append((method, rx, scope, fn))
        return fn
    return deco


def lan_ips():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for ip in subprocess.run(["hostname", "-I"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3).stdout.decode().split():
            if ":" not in ip and ip not in ips:
                ips.append(ip)
    except (OSError, subprocess.SubprocessError):
        pass
    return [i for i in ips if not i.startswith("127.")]


def guest_bases():
    cfg = store.load_config()
    out = []
    if cfg.get("publicUrl"):
        out.append({"label": "Internet", "url": cfg["publicUrl"].rstrip("/")})
    scheme = "https" if RUNTIME["guestTls"] else "http"
    for ip in lan_ips():
        out.append({"label": "Local network", "url": "%s://%s:%d" % (scheme, ip, RUNTIME["guestPort"])})
    out.append({"label": "This computer", "url": "http://127.0.0.1:%d" % RUNTIME["hostPort"]})
    return out


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "IPRPSPodcastStudio/" + store.VERSION

    def log_message(self, fmt, *args):
        if os.environ.get("IPRPS_PODCAST_DEBUG"):
            sys.stderr.write("%s %s\n" % (self.server.scope, fmt % args))

    # ---- helpers
    def send_json(self, obj, code=200):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def send_bytes(self, raw, ctype, code=200, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(raw)

    def send_file(self, path, download=None, cache="no-cache"):
        if not os.path.isfile(path):
            raise HTTPError(404, "not found")
        size = os.path.getsize(path)
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        start, end, code = 0, size - 1, 200
        rng = self.headers.get("Range")
        if rng and rng.startswith("bytes="):
            a, _, b = rng[6:].split(",")[0].partition("-")
            try:
                if a == "":
                    start = max(0, size - int(b))
                else:
                    start = int(a)
                    end = min(size - 1, int(b)) if b else size - 1
                if start > end or start >= size:
                    raise ValueError
                code = 206
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", "bytes */%d" % size)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", cache)
        if code == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        if download:
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % download.replace('"', ""))
        self.end_headers()
        if self.command == "HEAD":
            return
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                buf = f.read(min(1 << 18, left))
                if not buf:
                    break
                self.wfile.write(buf)
                left -= len(buf)

    def body_len(self):
        try:
            return int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return 0

    def json_body(self):
        n = self.body_len()
        if n > 64 << 20:
            raise HTTPError(413, "too large")
        raw = self.rfile.read(n) if n else b""
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except ValueError:
            raise HTTPError(400, "bad JSON")

    def body_to_file(self, path, limit=None):
        n = self.body_len()
        if limit and n > limit:
            raise HTTPError(413, "too large")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        left = n
        with open(path, "wb") as f:
            while left > 0:
                buf = self.rfile.read(min(1 << 20, left))
                if not buf:
                    break
                f.write(buf)
                left -= len(buf)
        return n

    def sse(self, room, info):
        q, gen = rooms.join(room, info)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        try:
            while True:
                try:
                    msg = q.get(timeout=10)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    continue
                if msg is None:
                    self.wfile.write(b'data: {"type":"replaced"}\n\n')
                    self.wfile.flush()
                    break
                self.wfile.write(b"data: " + msg.encode("utf-8") + b"\n\n")
                self.wfile.flush()
        except (OSError, ssl.SSLError):
            pass
        finally:
            rooms.leave(room, info["id"], gen)

    # ---- dispatch
    def handle_one(self):
        u = urllib.parse.urlsplit(self.path)
        self.q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        path = urllib.parse.unquote(u.path)
        scope = self.server.scope
        method = "GET" if self.command == "HEAD" else self.command
        if scope == "host":
            # Only this machine's own pages may drive the studio (blocks DNS-rebinding and cross-site requests).
            host = (self.headers.get("Host") or "").split(":")[0]
            if host not in ("127.0.0.1", "localhost", "[::1]"):
                raise HTTPError(403, "The studio is only available on this computer.")
            origin = self.headers.get("Origin")
            if origin and urllib.parse.urlsplit(origin).hostname not in ("127.0.0.1", "localhost", "::1"):
                raise HTTPError(403, "cross-site request refused")
        for m, rx, sc, fn in ROUTES:
            if m != method:
                continue
            if sc == "host" and scope != "host":
                continue
            mt = rx.match(path)
            if mt:
                return fn(self, **mt.groupdict())
        if method == "GET":
            return self.static(path, scope)
        raise HTTPError(404, "not found")

    def static(self, path, scope):
        if scope == "host" and path in ("/", "/index.html"):
            return self.send_file(os.path.join(WEB, "index.html"))
        if re.match(r"^/(css|js|img)/[A-Za-z0-9_.-]+$", path):
            return self.send_file(os.path.join(WEB, path.lstrip("/")))
        raise HTTPError(404, "not found")

    def _do(self):
        try:
            self.handle_one()
        except HTTPError as e:
            self._fail(e.code, e.msg)
        except KeyError as e:
            self._fail(404, str(e).strip("'\""))
        except (ValueError, ai.AIError) as e:
            self._fail(400, str(e))
        except (BrokenPipeError, ConnectionResetError, ssl.SSLError):
            self.close_connection = True
        except Exception as e:  # noqa
            import traceback
            traceback.print_exc()
            self._fail(500, "%s: %s" % (type(e).__name__, e))

    def _fail(self, code, msg):
        try:
            # drain unread body so keep-alive stays in sync
            self.close_connection = True
            self.send_json({"error": msg}, code)
        except OSError:
            pass

    do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = _do


# =============================================================== host API
@route("GET", "/api/state")
def state(h):
    h.send_json({"version": store.VERSION, "ffmpeg": media.have("ffmpeg"), "ffprobe": media.have("ffprobe"),
                 "rsync": media.have("rsync"), "dataDir": store.data_dir(), "config": store.public_config(),
                 "guest": {"up": RUNTIME["guestUp"], "tls": RUNTIME["guestTls"], "port": RUNTIME["guestPort"],
                           "bases": guest_bases()},
                 "directories": feed.DIRECTORIES, "formats": list(media.FORMATS)})


@route("GET", "/api/time", "both")
@route("GET", "/g/time", "both")
def now(h):
    h.send_json({"now": store.now()})


@route("PUT", "/api/config")
def put_config(h):
    store.save_config(h.json_body())
    ai._cache.clear()
    h.send_json(store.public_config())


@route("GET", "/api/shows")
def shows(h):
    h.send_json(store.list_shows())


@route("POST", "/api/shows")
def new_show(h):
    h.send_json(store.create_show(h.json_body()))


@route("GET", "/api/shows/:sid")
def get_show(h, sid):
    h.send_json(store.get_show(sid))


@route("PUT", "/api/shows/:sid")
def put_show(h, sid):
    h.send_json(store.update_show(sid, h.json_body()))


@route("DELETE", "/api/shows/:sid")
def del_show(h, sid):
    store.delete_show(sid)
    h.send_json({"ok": True})


@route("POST", "/api/shows/:sid/duplicate")
def dup_show(h, sid):
    h.send_json(store.duplicate_show(sid))


@route("POST", "/api/shows/:sid/assets")
def add_asset(h, sid):
    show = store.get_show(sid)
    name = store.safe_name(h.q.get("name", "file"))
    ext = os.path.splitext(name)[1].lower()
    if not re.match(r"^\.[a-z0-9]{1,5}$", ext):
        raise HTTPError(400, "File needs an extension such as .png or .mp3")
    aid = store.new_id("a_")
    path = os.path.join(store.show_dir(sid), "assets", aid + ext)
    h.body_to_file(path)
    info = media.probe(path)
    kind = "image" if media.is_image(path) else ("audio" if info["hasAudio"] else "other")
    if kind == "other":
        os.remove(path)
        raise HTTPError(400, "Use an image (PNG/JPEG) or an audio file.")
    asset = {"id": aid, "name": name, "file": aid + ext, "kind": kind, "duration": info["duration"],
             "width": info["width"], "height": info["height"], "size": os.path.getsize(path)}
    with store.LOCK:
        show = store.get_show(sid)
        show["assets"].append(asset)
        role = h.q.get("role")
        if role in ("coverAsset", "logoAsset", "introAsset", "outroAsset"):
            show[role] = aid
        store.save_show(show)
    h.send_json({"asset": asset, "show": show})


@route("DELETE", "/api/shows/:sid/assets/:aid")
def del_asset(h, sid, aid):
    with store.LOCK:
        show = store.get_show(sid)
        p, a = store.asset_path(show, aid)
        if a:
            show["assets"] = [x for x in show["assets"] if x["id"] != aid]
            for role in ("coverAsset", "logoAsset", "introAsset", "outroAsset"):
                if show.get(role) == aid:
                    show[role] = ""
            for pad in show.get("pads", []):
                if pad.get("assetId") == aid:
                    pad["assetId"] = ""
            store.save_show(show)
            try:
                os.remove(p)
            except OSError:
                pass
    h.send_json(show)


@route("GET", "/api/shows/:sid/episodes")
def episodes(h, sid):
    h.send_json(store.list_episodes(sid))


@route("POST", "/api/shows/:sid/episodes")
def new_episode(h, sid):
    h.send_json(store.create_episode(sid, h.json_body()))


@route("GET", "/api/shows/:sid/episodes/:eid")
def get_episode(h, sid, eid):
    h.send_json(store.get_episode(sid, eid))


@route("PUT", "/api/shows/:sid/episodes/:eid")
def put_episode(h, sid, eid):
    h.send_json(store.update_episode(sid, eid, h.json_body()))


@route("DELETE", "/api/shows/:sid/episodes/:eid")
def del_episode(h, sid, eid):
    store.delete_episode(sid, eid)
    h.send_json({"ok": True})


@route("POST", "/api/shows/:sid/episodes/:eid/media")
def add_media(h, sid, eid):
    store.get_episode(sid, eid)
    name = store.safe_name(h.q.get("name", "upload.bin"))
    tmp = os.path.join(store.sub("tmp"), store.new_id("u_") + os.path.splitext(name)[1])
    h.body_to_file(tmp)
    try:
        entry = media.ingest(sid, eid, tmp, name, h.q.get("participant", ""), "upload")
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    h.send_json(entry)


@route("POST", "/api/shows/:sid/episodes/:eid/media-from-asset")
def media_from_asset(h, sid, eid):
    show = store.get_show(sid)
    p, a = store.asset_path(show, h.json_body().get("assetId"))
    if not a or a["kind"] != "audio":
        raise HTTPError(404, "audio asset not found")
    tmp = os.path.join(store.sub("tmp"), store.new_id("u_") + os.path.splitext(a["file"])[1])
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    shutil.copy2(p, tmp)
    h.send_json(media.ingest(sid, eid, tmp, a["name"], "", "brand"))


@route("DELETE", "/api/shows/:sid/episodes/:eid/media/:mid")
def del_media(h, sid, eid, mid):
    media.delete_media(sid, eid, mid)
    h.send_json(store.get_episode(sid, eid))


@route("POST", "/api/shows/:sid/episodes/:eid/place")
def place(h, sid, eid):
    b = h.json_body()
    h.send_json(store.place_clip(sid, eid, b["mediaId"], b.get("track") or "Track", b.get("start") or 0, rank=2 if b.get("ai") else 3))


@route("POST", "/api/shows/:sid/episodes/:eid/append")
def append(h, sid, eid):
    """Append to a list field (chapters / transcript) without racing the recorder."""
    b = h.json_body()
    field = b.get("field")
    if field not in ("chapters", "transcript"):
        raise HTTPError(400, "bad field")
    with store.LOCK:
        ep = store.get_episode(sid, eid)
        ep[field].append(b.get("item"))
        if field == "chapters":
            ep[field].sort(key=lambda c: c.get("t", 0))
        store.save_episode(ep)
    h.send_json({"ok": True})


@route("POST", "/api/shows/:sid/episodes/:eid/render")
def render(h, sid, eid):
    h.send_json(media.public_job(media.start_render(sid, eid, h.json_body())))


@route("DELETE", "/api/shows/:sid/episodes/:eid/exports/:xid")
def del_export(h, sid, eid, xid):
    media.delete_export(sid, eid, xid)
    h.send_json(store.get_episode(sid, eid))


@route("GET", "/api/jobs/:jid")
def job(h, jid):
    j = media.JOBS.get(jid)
    if not j:
        raise HTTPError(404, "job not found")
    h.send_json(media.public_job(j))


@route("DELETE", "/api/jobs/:jid")
def job_cancel(h, jid):
    media.cancel_job(jid)
    h.send_json({"ok": True})


# ---- publishing
@route("GET", "/api/shows/:sid/feed")
def get_feed(h, sid):
    show = store.get_show(sid)
    h.send_json({"xml": feed.build_feed(show), "checks": feed.validate(show), "feedUrl": feed.feed_url(show),
                 "guid": feed.podcast_guid(show), "episodes": len(feed.published_items(show))})


@route("POST", "/api/shows/:sid/publish")
def do_publish(h, sid):
    h.send_json(feed.publish(sid))


@route("POST", "/api/shows/:sid/podcastindex")
def do_pi(h, sid):
    h.send_json(feed.submit_podcastindex(store.get_show(sid)))


# ---- backups
@route("POST", "/api/shows/:sid/backup")
def do_backup(h, sid):
    h.send_json(backup.create(sid, h.json_body().get("includeMedia", True)))


@route("GET", "/api/backups")
def backups(h):
    h.send_json(backup.listing())


@route("DELETE", "/api/backups/:name")
def del_backup(h, name):
    backup.delete(name)
    h.send_json(backup.listing())


@route("POST", "/api/backups/:name/restore")
def restore_backup(h, name):
    h.send_json(backup.restore(backup.path_of(name)))


@route("POST", "/api/restore")
def restore_upload(h):
    tmp = os.path.join(store.sub("tmp"), store.new_id("b_") + ".tar.gz")
    h.body_to_file(tmp)
    try:
        h.send_json(backup.restore(tmp))
    finally:
        os.remove(tmp)


@route("GET", "/backups/:name")
def dl_backup(h, name):
    h.send_file(backup.path_of(name), download=os.path.basename(name))


# ---- files (host only)
@route("GET", "/files/(?P<rel>.+)")
def files(h, rel):
    root = os.path.realpath(store.sub("shows"))
    path = os.path.realpath(os.path.join(root, rel))
    if not path.startswith(root + os.sep):
        raise HTTPError(403, "forbidden")
    h.send_file(path, download=os.path.basename(path) if h.q.get("dl") else None)


# ---- AI
@route("GET", "/api/ai/voices")
def ai_voices(h):
    h.send_json(ai.voices(h.q.get("provider", "gemini")))


@route("GET", "/api/ai/models")
def ai_models(h):
    h.send_json(ai.models(h.q.get("provider", "gemini")))


@route("POST", "/api/ai/tts")
def ai_tts(h):
    b = h.json_body()
    raw, ext = ai.tts(b.get("provider", "gemini"), b.get("text", ""), b.get("voiceId", ""), b.get("style", ""), b.get("model", ""))
    h.send_bytes(raw, "audio/wav" if ext == "wav" else "audio/mpeg")


@route("POST", "/api/ai/turn")
def ai_turn(h):
    b = h.json_body()
    sid, eid = b["sid"], b["eid"]
    show, ep = store.get_show(sid), store.get_episode(sid, eid)
    cast = next((c for c in show["cast"] if c["id"] == b.get("castId") and c.get("kind") == "ai"), None)
    if not cast:
        raise HTTPError(404, "AI cast member not found")
    heard = ""
    if b.get("audio"):
        heard = ai.stt(ai.to_mp3(base64.b64decode(b["audio"])))
    mode = b.get("mode", "reply")
    if mode == "reply" and not heard and not b.get("cue") and b.get("audio"):
        raise HTTPError(400, "I couldn't make out any speech in that — try again a little closer to the mic.")
    text, audio, ext = ai.turn(show, ep, cast, mode, b.get("cue", ""), heard, b.get("history"))
    tmp = os.path.join(store.sub("tmp"), store.new_id("ai_") + "." + ext)
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    with open(tmp, "wb") as f:
        f.write(audio)
    entry = media.ingest(sid, eid, tmp, "%s %s.%s" % (cast["name"], time.strftime("%H.%M.%S"), ext), cast["name"], "ai")
    h.send_json({"heard": heard, "text": text, "media": entry,
                 "url": "/files/%s/episodes/%s/media/%s" % (sid, eid, entry["file"])})


# =============================================================== rooms (host side)
def host_info(show):
    hc = next((c for c in show["cast"] if c.get("role") == "host"), None)
    return {"id": "host", "name": hc["name"] if hc else "Host", "role": "host"}


@route("GET", "/api/room/:sid/:eid/events")
def room_events(h, sid, eid):
    show = store.get_show(sid)
    store.get_episode(sid, eid)
    h.sse(rooms.get_room(sid, eid), host_info(show))


@route("GET", "/api/room/:sid/:eid/invites")
def room_invites(h, sid, eid):
    show = store.get_show(sid)
    if store._ensure_cast(show):
        store.save_show(show)
    bases = guest_bases()
    out = []
    for c in show["cast"]:
        if c.get("kind") != "ai" and c.get("role") != "host":
            out.append({"castId": c["id"], "name": c["name"], "role": c.get("role", "guest"),
                        "links": [{"label": b["label"], "url": "%s/join/%s/%s?t=%s" % (b["url"], sid, eid, c["inviteToken"])} for b in bases]})
    h.send_json({"invites": out, "ice": store.load_config().get("iceServers", []), "guestUp": RUNTIME["guestUp"]})


def _signal(h, room, me):
    b = h.json_body()
    if "app" in b:
        room.send(b.get("to") or "*", {"type": "app", "from": me["id"], "role": me["role"], "name": me["name"], "app": b["app"]})
    else:
        room.send(b.get("to") or "*", {"type": "signal", "from": me["id"], "data": b.get("data")})
    h.send_json({"ok": True})


@route("POST", "/api/room/:sid/:eid/signal")
def room_signal(h, sid, eid):
    _signal(h, rooms.get_room(sid, eid), host_info(store.get_show(sid)))


@route("POST", "/api/room/:sid/:eid/rec")
def room_rec(h, sid, eid):
    h.send_json({"rec": rooms.rec_action(rooms.get_room(sid, eid), h.json_body().get("action"))})


@route("POST", "/api/room/:sid/:eid/begin")
def room_begin(h, sid, eid):
    b = h.json_body()
    show = store.get_show(sid)
    rooms.begin_upload(rooms.get_room(sid, eid), b["up"], {"peer": "host", "name": host_info(show)["name"], "offset": b.get("offset", 0),
                                                           "kind": b.get("kind", "cam"), "recId": b.get("recId", "")})
    h.send_json({"ok": True})


@route("POST", "/api/room/:sid/:eid/chunk")
def room_chunk(h, sid, eid):
    rooms.save_chunk(rooms.get_room(sid, eid), h.q["up"], h.q.get("seq", 0), h.rfile, h.body_len())
    h.send_json({"ok": True})


@route("POST", "/api/room/:sid/:eid/finish")
def room_finish(h, sid, eid):
    b = h.json_body()
    h.send_json({"media": rooms.finish_upload(rooms.get_room(sid, eid), b["up"], b.get("offset"), bool(b.get("discard")))})


# =============================================================== guest gateway (token gated)
def guest_auth(h):
    sid, eid, tok = h.q.get("sid", ""), h.q.get("eid", ""), h.q.get("t", "")
    try:
        show = store.get_show(sid)
        ep = store.get_episode(sid, eid)
    except (KeyError, ValueError):
        raise HTTPError(403, "This invite link is not valid.")
    cast = next((c for c in show["cast"] if tok and c.get("inviteToken") == tok and c.get("kind") != "ai"), None)
    if not cast:
        raise HTTPError(403, "This invite link is not valid (it may have been replaced).")
    me = {"id": "p_" + cast["id"], "name": cast["name"], "role": cast.get("role", "guest")}
    return show, ep, me


@route("GET", "/join/:sid/:eid", "both")
def join_page(h, sid, eid):
    h.send_file(os.path.join(WEB, "guest.html"))


@route("GET", "/g/info", "both")
def g_info(h):
    show, ep, me = guest_auth(h)
    h.send_json({"me": me, "show": {"title": show["title"], "brand": show["brand"], "hasCover": bool(show.get("coverAsset")),
                                    "tagline": show["brand"].get("tagline") or show.get("subtitle", "")},
                 "episode": {"title": ep["title"]}, "ice": store.load_config().get("iceServers", []), "now": store.now()})


@route("GET", "/g/cover", "both")
def g_cover(h):
    show, _, _ = guest_auth(h)
    p, a = store.asset_path(show, show.get("coverAsset"))
    if not a:
        raise HTTPError(404, "no cover")
    h.send_file(p, cache="max-age=300")


@route("GET", "/g/events", "both")
def g_events(h):
    show, ep, me = guest_auth(h)
    h.sse(rooms.get_room(show["id"], ep["id"]), me)


@route("POST", "/g/signal", "both")
def g_signal(h):
    show, ep, me = guest_auth(h)
    _signal(h, rooms.get_room(show["id"], ep["id"]), me)


@route("POST", "/g/begin", "both")
def g_begin(h):
    show, ep, me = guest_auth(h)
    b = h.json_body()
    room = rooms.get_room(show["id"], ep["id"])
    if not room.rec:
        raise HTTPError(409, "not recording")
    rooms.begin_upload(room, me["id"] + "_" + rooms._safe(b.get("up", "")), {"peer": me["id"], "name": me["name"], "offset": b.get("offset", 0),
                                                                             "kind": "cam", "recId": room.rec["id"]})
    h.send_json({"ok": True})


@route("POST", "/g/chunk", "both")
def g_chunk(h):
    show, ep, me = guest_auth(h)
    n = h.body_len()
    if n > 256 << 20:
        raise HTTPError(413, "chunk too large")
    rooms.save_chunk(rooms.get_room(show["id"], ep["id"]), me["id"] + "_" + rooms._safe(h.q.get("up", "")), h.q.get("seq", 0), h.rfile, n)
    h.send_json({"ok": True})


@route("POST", "/g/finish", "both")
def g_finish(h):
    show, ep, me = guest_auth(h)
    b = h.json_body()
    m = rooms.finish_upload(rooms.get_room(show["id"], ep["id"]), me["id"] + "_" + rooms._safe(b.get("up", "")), b.get("offset"))
    h.send_json({"ok": bool(m)})


# =============================================================== startup
def ensure_cert():
    d = store.sub("certs")
    os.makedirs(d, exist_ok=True)
    crt, key = os.path.join(d, "guest.crt"), os.path.join(d, "guest.key")
    ips = lan_ips()
    stamp = os.path.join(d, "ips.txt")
    have = open(stamp).read() if os.path.exists(stamp) else ""
    want = ",".join(sorted(ips))
    if os.path.exists(crt) and os.path.exists(key) and have == want:
        return crt, key
    if not shutil.which("openssl"):
        return None, None
    san = ",".join(["DNS:localhost", "DNS:" + socket.gethostname(), "IP:127.0.0.1"] + ["IP:" + i for i in ips])
    r = subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825", "-keyout", key, "-out", crt,
                        "-subj", "/CN=IPRPS Podcast Studio", "-addext", "subjectAltName=" + san],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        return None, None
    os.chmod(key, 0o600)
    with open(stamp, "w") as f:
        f.write(want)
    return crt, key


def open_window(url):
    """Open the studio as its own app window in Chromium when available, else the default browser."""
    for b in ("chromium", "ungoogled-chromium", "chromium-browser", "google-chrome"):
        if shutil.which(b):
            subprocess.Popen([b, "--app=" + url, "--class=iprps-podcast-studio", "--autoplay-policy=no-user-gesture-required"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            return
    webbrowser.open(url)


@route("POST", "/api/quit")
def quit_app(h):
    if any(r.rec for r in rooms.ROOMS.values()):
        raise HTTPError(409, "A recording is in progress — stop it first.")
    h.send_json({"ok": True})
    RUNTIME["quit"] = True


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64


def serve(scope, addr, port, tls=None):
    srv = Server((addr, port), Handler)
    srv.scope = scope
    if tls:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(*tls)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True, do_handshake_on_connect=False)
    threading.Thread(target=srv.serve_forever, daemon=True, name=scope).start()
    return srv


def main():
    cfg = store.load_config()
    ap = argparse.ArgumentParser(description="IPRPS Podcast Studio")
    ap.add_argument("--port", type=int, default=int(os.environ.get("IPRPS_PODCAST_PORT") or cfg["hostPort"]))
    ap.add_argument("--guest-port", type=int, default=int(os.environ.get("IPRPS_PODCAST_GUEST_PORT") or cfg["guestPort"]))
    ap.add_argument("--no-guests", action="store_true", help="do not open the guest gateway")
    ap.add_argument("--guest-http", action="store_true", help="plain HTTP guest gateway (when a tunnel/proxy adds HTTPS)")
    ap.add_argument("--open", action="store_true", help="open the studio in a browser window")
    args = ap.parse_args()
    shutil.rmtree(store.sub("tmp"), ignore_errors=True)
    os.makedirs(store.sub("tmp"), exist_ok=True)
    RUNTIME.update(hostPort=args.port, guestPort=args.guest_port)
    try:
        serve("host", "127.0.0.1", args.port)
    except OSError as e:
        if args.open:           # already running: just bring up a window on it
            open_window("http://127.0.0.1:%d" % args.port)
            return
        sys.exit("Could not start on port %d (%s). Is the studio already running?" % (args.port, e))
    print("IPRPS Podcast Studio %s" % store.VERSION)
    print("  Studio:  http://127.0.0.1:%d" % args.port)
    if cfg.get("guestEnabled", True) and not args.no_guests:
        tls = None
        if cfg.get("guestTls", True) and not args.guest_http:
            crt, key = ensure_cert()
            tls = (crt, key) if crt else None
            if not tls:
                print("  ! openssl not found — guest gateway is plain HTTP; browsers will refuse camera/mic for LAN guests.")
        try:
            serve("guest", "0.0.0.0", args.guest_port, tls)
            RUNTIME.update(guestUp=True, guestTls=bool(tls))
            for b in guest_bases()[:-1]:
                print("  Guests (%s):  %s" % (b["label"], b["url"]))
        except OSError as e:
            print("  ! guest gateway not started on port %d: %s" % (args.guest_port, e))
    print("  Data:    %s" % store.data_dir())
    if not media.have("ffmpeg"):
        print("  ! ffmpeg not found — recording works, but waveforms and exports need it.")
    if args.open:
        open_window("http://127.0.0.1:%d" % args.port)
    try:
        while not RUNTIME.get("quit"):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    print("bye")


if __name__ == "__main__":
    main()
