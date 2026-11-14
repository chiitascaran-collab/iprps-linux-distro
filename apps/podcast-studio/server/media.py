# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Media handling: probing, ingest, waveform peaks and ffmpeg rendering."""
import array, json, math, os, re, shutil, subprocess, threading, time

import store

EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
PEAKS_PER_SEC = 20
JOBS = {}


def have(tool):
    return shutil.which(tool) is not None


def run(cmd, timeout=None):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)


def probe(path):
    info = {"duration": 0.0, "hasAudio": False, "hasVideo": False, "width": 0, "height": 0}
    if not have("ffprobe"):
        return info
    r = run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", path], timeout=120)
    try:
        j = json.loads(r.stdout.decode("utf-8", "replace") or "{}")
    except ValueError:
        return info
    for s in j.get("streams", []):
        if s.get("codec_type") == "audio":
            info["hasAudio"] = True
        elif s.get("codec_type") == "video":
            if s.get("disposition", {}).get("attached_pic"):
                continue
            info["hasVideo"] = True
            info["width"], info["height"] = s.get("width", 0), s.get("height", 0)
        try:
            info["duration"] = max(info["duration"], float(s.get("duration") or 0))
        except ValueError:
            pass
    try:
        info["duration"] = max(info["duration"], float(j.get("format", {}).get("duration") or 0))
    except ValueError:
        pass
    info["duration"] = round(info["duration"], 3)
    return info


def is_image(path):
    return os.path.splitext(path)[1].lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif")


def compute_peaks(path):
    """Decode to 2 kHz mono and keep the peak of every 1/20 s bucket (0..100)."""
    if not have("ffmpeg"):
        return []
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "2000",
                          "-f", "s16le", "-"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    raw = p.stdout.read()
    p.wait()
    a = array.array("h")
    a.frombytes(raw[: len(raw) // 2 * 2])
    step = 2000 // PEAKS_PER_SEC
    out = []
    for i in range(0, len(a), step):
        seg = a[i:i + step]
        out.append(min(100, int(max(max(seg), -min(seg)) / 327.67)))
    return out


def ingest(sid, eid, src_path, name, participant="", source="upload", remux=False):
    """Move a file into the episode's media folder and register it. Returns the media entry."""
    mid = store.new_id("m_")
    ext = os.path.splitext(name)[1].lower() or os.path.splitext(src_path)[1].lower() or ".bin"
    if not re.match(r"^\.[a-z0-9]{1,5}$", ext):
        ext = ".bin"
    mdir = os.path.join(store.ep_dir(sid, eid), "media")
    os.makedirs(mdir, exist_ok=True)
    dest = os.path.join(mdir, mid + ext)
    done = False
    if remux and have("ffmpeg"):
        # Browser recordings have no duration/cues; a stream copy makes them seekable.
        r = run(["ffmpeg", "-y", "-v", "error", "-fflags", "+genpts", "-i", src_path, "-c", "copy", dest])
        done = r.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 0
        if done:
            os.remove(src_path)
    if not done:
        shutil.move(src_path, dest)
    info = probe(dest)
    if not info["hasAudio"] and not info["hasVideo"]:
        os.remove(dest)
        raise ValueError("That file has no audio or video the studio can read.")
    peaks = compute_peaks(dest) if info["hasAudio"] else []
    store.write_json(os.path.join(mdir, mid + ".peaks.json"), {"pps": PEAKS_PER_SEC, "peaks": peaks})
    entry = {"id": mid, "name": store.safe_name(name), "file": mid + ext, "source": source,
             "participant": participant, "size": os.path.getsize(dest), "createdAt": store.now(), **info}
    with store.LOCK:
        ep = store.get_episode(sid, eid)
        ep["media"].append(entry)
        store.save_episode(ep)
    return entry


def delete_media(sid, eid, mid):
    with store.LOCK:
        ep = store.get_episode(sid, eid)
        m = next((x for x in ep["media"] if x["id"] == mid), None)
        if not m:
            return
        ep["media"] = [x for x in ep["media"] if x["id"] != mid]
        for t in ep["timeline"]["tracks"]:
            t["clips"] = [c for c in t["clips"] if c["mediaId"] != mid]
        store.save_episode(ep)
    mdir = os.path.join(store.ep_dir(sid, eid), "media")
    for f in (m["file"], mid + ".peaks.json"):
        try:
            os.remove(os.path.join(mdir, f))
        except OSError:
            pass


# ---------------------------------------------------------------- render
def layout_rects(layout, n, W, H):
    """Tile rectangles (x, y, w, h) for n video tracks. Mirrors web/js/editor.js layoutRects()."""
    ev = lambda v: max(2, int(v) & ~1)
    g = ev(H / 90)
    if n <= 0:
        return []
    if layout == "single" or n == 1:
        return [(0, 0, W, H)]
    if layout == "spotlight":
        sw = ev(W * 0.24)
        mw = ev(W - sw - 3 * g)
        rects = [(g, g, mw, ev(H - 2 * g))]
        m = n - 1
        th = ev(min((H - g * (m + 1)) / m, sw * 9 / 16 * 1.4))
        y0 = ev((H - (th * m + g * (m - 1))) / 2)
        for i in range(m):
            rects.append((mw + 2 * g, y0 + i * (th + g), sw, th))
        return rects
    if layout == "pip":
        rects = [(0, 0, W, H)]
        pw, ph = ev(W / 5), ev(H / 5)
        for i in range(n - 1):
            rects.append((W - (i + 1) * (pw + g), H - ph - g, pw, ph))
        return rects
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    tw = ev((W - g * (cols + 1)) / cols)
    th = ev((H - g * (rows + 1)) / rows)
    rects = []
    for i in range(n):
        r, c = divmod(i, cols)
        in_row = cols if r < rows - 1 else n - cols * (rows - 1)
        x0 = (W - (in_row * tw + (in_row - 1) * g)) / 2
        rects.append((ev(x0 + c * (tw + g)), g + r * (th + g), tw, th))
    return rects


def _f(v):
    return ("%.3f" % float(v)).rstrip("0").rstrip(".") or "0"


def _color(c, default="0x101418"):
    return "0x" + c[1:] if isinstance(c, str) and re.match(r"^#[0-9a-fA-F]{6}$", c) else default


def _fx_chain(fx, vol=1, pan=0):
    f = []
    fx = fx or {}
    if fx.get("hp"):
        f.append("highpass=f=80")
    if fx.get("denoise"):
        f.append("afftdn=nr=12:nf=-40")
    if fx.get("gate"):
        f.append("agate=threshold=0.015:ratio=3:attack=10:release=200")
    for freq, g in zip(EQ_FREQS, fx.get("eq") or []):
        if abs(g or 0) >= 0.1:
            f.append("equalizer=f=%d:t=o:w=1:g=%.1f" % (freq, g))
    if fx.get("comp"):
        f.append("acompressor=threshold=-18dB:ratio=3:attack=8:release=150:makeup=2")
    if abs((vol if vol is not None else 1) - 1) > 0.001:
        f.append("volume=%.3f" % vol)
    if pan:
        f.append("pan=stereo|c0=%.3f*c0|c1=%.3f*c1" % (min(1, 1 - pan), min(1, 1 + pan)))
    return f


def find_font():
    if have("fc-match"):
        r = run(["fc-match", "-f", "%{file}", "sans:bold"])
        p = r.stdout.decode().strip()
        if p and os.path.exists(p):
            return p
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return p
    return ""


def timeline_duration(ep):
    total = 0.0
    for t in ep["timeline"]["tracks"]:
        for c in t["clips"]:
            total = max(total, c["start"] + c["out"] - c["in"])
    return total


FORMATS = {
    "mp3": {"ext": "mp3", "video": False, "mime": "audio/mpeg"},
    "m4a": {"ext": "m4a", "video": False, "mime": "audio/x-m4a"},
    "wav": {"ext": "wav", "video": False, "mime": "audio/wav"},
    "flac": {"ext": "flac", "video": False, "mime": "audio/flac"},
    "mp4": {"ext": "mp4", "video": True, "mime": "video/mp4"},
    "audiogram": {"ext": "mp4", "video": True, "mime": "video/mp4"},
}


def build_render(show, ep, opts, out_path, workdir):
    """Return the ffmpeg argument list that renders the episode timeline to out_path."""
    fmt = opts.get("format", "mp3")
    spec = FORMATS[fmt]
    tl = ep["timeline"]
    tracks = tl["tracks"]
    media = {m["id"]: m for m in ep["media"]}
    mdir = os.path.join(store.ep_dir(ep["showId"], ep["id"]), "media")
    total = timeline_duration(ep)
    if total < 0.2:
        raise ValueError("The timeline is empty — record or add clips first.")
    solo = any(t.get("solo") for t in tracks)
    inputs, fg = [], []

    def add_input(args):
        inputs.append(args)
        return len(inputs) - 1

    # ---- audio
    track_labels = []
    for ti, t in enumerate(tracks):
        if t.get("mute") or (solo and not t.get("solo")):
            continue
        labels = []
        for ci, c in enumerate(t["clips"]):
            m = media.get(c["mediaId"])
            dur = c["out"] - c["in"]
            if not m or not m.get("hasAudio") or c.get("mute") or dur < 0.02:
                continue
            i = add_input(["-ss", _f(c["in"]), "-t", _f(dur), "-i", os.path.join(mdir, m["file"])])
            ch = ["aresample=48000", "aformat=sample_fmts=fltp:channel_layouts=stereo", "asetpts=PTS-STARTPTS"]
            if abs(c.get("gain", 1) - 1) > 0.001:
                ch.append("volume=%.3f" % c["gain"])
            fi, fo = min(c.get("fadeIn") or 0, dur), min(c.get("fadeOut") or 0, dur)
            if fi > 0.01:
                ch.append("afade=t=in:st=0:d=%s" % _f(fi))
            if fo > 0.01:
                ch.append("afade=t=out:st=%s:d=%s" % (_f(dur - fo), _f(fo)))
            ch.append("adelay=%d:all=1" % int(round(c["start"] * 1000)))
            lab = "a%d_%d" % (ti, ci)
            fg.append("[%d:a]%s[%s]" % (i, ",".join(ch), lab))
            labels.append(lab)
        if not labels:
            continue
        chain = ["amix=inputs=%d:normalize=0:dropout_transition=0" % len(labels)] if len(labels) > 1 else []
        chain += _fx_chain(t.get("fx"), t.get("vol", 1), t.get("pan", 0)) or []
        if not chain:
            chain = ["anull"]
        fg.append("%s%s[t%d]" % ("".join("[%s]" % l for l in labels), ",".join(chain), ti))
        track_labels.append("t%d" % ti)

    master = tl.get("master") or {}
    mchain = []
    if track_labels:
        src = "".join("[%s]" % l for l in track_labels)
        if len(track_labels) > 1:
            mchain.append("amix=inputs=%d:normalize=0:dropout_transition=0" % len(track_labels))
    else:
        src = ""
        mchain.append("anullsrc=r=48000:cl=stereo")
    mchain += _fx_chain({"eq": master.get("eq")}, master.get("vol", 1), 0)
    loud = opts.get("loudness", master.get("loudness", -16))
    if loud and track_labels:
        mchain.append("loudnorm=I=%d:TP=-1.5:LRA=11" % int(loud))
    rate = 48000 if spec["video"] else 44100
    mchain += ["alimiter=limit=0.891:level=disabled", "aresample=%d" % rate, "apad", "atrim=0:%s" % _f(total)]
    aout_idx = len(fg)
    fg.append("%s%s[aout]" % (src, ",".join(mchain)))

    args_out = []
    brand = show.get("brand", {})
    cover_path, _ = store.asset_path(show, show.get("coverAsset"))
    logo_path, _ = store.asset_path(show, show.get("logoAsset"))
    maps = ["-map", "[aout]"]

    # ---- video
    if spec["video"]:
        res = opts.get("resolution", "720p")
        W, H = {"1080p": (1920, 1080), "720p": (1280, 720), "480p": (854, 480),
                "square": (1080, 1080), "vertical": (1080, 1920)}.get(res, (1280, 720))
        W, H = W & ~1, H & ~1
        fps = int(opts.get("fps", 30))
        bg = _color(brand.get("bg"))
        font = find_font()
        fg.append("color=c=%s:s=%dx%d:r=%d:d=%s,format=yuv420p[bg]" % (bg, W, H, fps, _f(total)))
        last = "bg"
        vtracks = []
        if fmt == "mp4":
            for t in tracks:
                if t.get("hideVideo"):
                    continue
                clips = sorted([c for c in t["clips"] if media.get(c["mediaId"], {}).get("hasVideo")
                                and not is_image(media[c["mediaId"]]["file"])], key=lambda c: c["start"])
                if clips:
                    vtracks.append((t, clips))
        layout = opts.get("layout") or tl.get("video", {}).get("layout") or "grid"
        if layout == "single":
            vtracks = vtracks[:1]
        rects = layout_rects(layout, len(vtracks), W, H)
        for vi, ((t, clips), (x, y, tw, th)) in enumerate(zip(vtracks, rects)):
            segs, pos = [], 0.0
            for ci, c in enumerate(clips):
                st = max(c["start"], pos)
                skip = st - c["start"]
                dur = (c["out"] - c["in"]) - skip
                if dur < 0.04:
                    continue
                if st > pos + 0.02:
                    lab = "g%d_%d" % (vi, ci)
                    fg.append("color=c=black:s=%dx%d:r=%d:d=%s,format=yuv420p,setsar=1[%s]" % (tw, th, fps, _f(st - pos), lab))
                    segs.append(lab)
                i = add_input(["-ss", _f(c["in"] + skip), "-t", _f(dur), "-i", os.path.join(mdir, media[c["mediaId"]]["file"])])
                lab = "v%d_%d" % (vi, ci)
                fg.append("[%d:v]setpts=PTS-STARTPTS,fps=%d,scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
                          "setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=2,trim=duration=%s,setpts=PTS-STARTPTS[%s]"
                          % (i, fps, tw, th, tw, th, _f(dur), lab))
                segs.append(lab)
                pos = st + dur
            if not segs:
                continue
            if total > pos + 0.02:
                lab = "g%d_end" % vi
                fg.append("color=c=black:s=%dx%d:r=%d:d=%s,format=yuv420p,setsar=1[%s]" % (tw, th, fps, _f(total - pos), lab))
                segs.append(lab)
            tile = "vt%d" % vi
            post = []
            if len(segs) > 1:
                post.append("concat=n=%d:v=1:a=0" % len(segs))
            if brand.get("lowerThirds", True) and opts.get("lowerThirds", True) and font and len(vtracks) > 0:
                tf = os.path.join(workdir, "name%d.txt" % vi)
                with open(tf, "w", encoding="utf-8") as fh:
                    fh.write(t["name"])
                fs = max(14, int(th / 16))
                post.append("drawtext=fontfile='%s':textfile='%s':fontcolor=white:fontsize=%d:x=%d:y=h-%d:box=1:"
                            "boxcolor=%s@0.85:boxborderw=%d" % (font, tf, fs, fs, int(fs * 2.4),
                                                                 _color(brand.get("primary"), "0x7c5cff"), int(fs / 2.2)))
            fg.append("%s%s[%s]" % ("".join("[%s]" % s for s in segs), ",".join(post) or "null", tile))
            nxt = "o%d" % vi
            fg.append("[%s][%s]overlay=x=%d:y=%d:shortest=0:eof_action=pass[%s]" % (last, tile, x, y, nxt))
            last = nxt
        if fmt == "audiogram" or not vtracks:
            # Cover art + animated waveform + episode title.
            side = (min(W, H) * 0.56)
            side = int(side) & ~1
            if cover_path and os.path.exists(cover_path):
                ci = add_input(["-loop", "1", "-framerate", str(fps), "-t", _f(total), "-i", cover_path])
                fg.append("[%d:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setsar=1,format=yuv420p[cov]"
                          % (ci, side, side, side, side))
                fg.append("[%s][cov]overlay=x=(W-w)/2:y=%d:shortest=0[oc]" % (last, int(H * 0.08)))
                last = "oc"
            fg[aout_idx] = fg[aout_idx][:-6] + ",asplit[aout][awav]"
            wh = int(H * 0.16) & ~1
            fg.append("[awav]showwaves=s=%dx%d:mode=cline:rate=%d:colors=%s,format=rgba[wave]"
                      % (int(W * 0.8) & ~1, wh, fps, _color(brand.get("accent"), "0xffb347")))
            fg.append("[%s][wave]overlay=x=(W-w)/2:y=%d:shortest=0[ow]" % (last, int(H * 0.70)))
            last = "ow"
            if font:
                tf = os.path.join(workdir, "title.txt")
                with open(tf, "w", encoding="utf-8") as fh:
                    fh.write("%s — %s" % (show.get("title", ""), ep.get("title", "")))
                fs = max(18, int(H / 28))
                fg.append("[%s]drawtext=fontfile='%s':textfile='%s':fontcolor=%s:fontsize=%d:x=(w-text_w)/2:y=%d[ot]"
                          % (last, font, tf, _color(brand.get("text"), "0xf2f4f8"), fs, int(H * 0.90)))
                last = "ot"
        if brand.get("watermark", True) and opts.get("watermark", True) and logo_path and os.path.exists(logo_path) \
                and fmt == "mp4" and vtracks:
            li = add_input(["-loop", "1", "-framerate", str(fps), "-t", _f(total), "-i", logo_path])
            fg.append("[%d:v]scale=-1:%d,format=rgba,colorchannelmixer=aa=0.85[wm]" % (li, int(H / 9)))
            fg.append("[%s][wm]overlay=x=W-w-%d:y=%d:shortest=0[owm]" % (last, int(H / 36), int(H / 36)))
            last = "owm"
        fg.append("[%s]format=yuv420p[vout]" % last)
        maps = ["-map", "[vout]", "-map", "[aout]"]
        args_out += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", str(fps),
                     "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]
    elif fmt == "mp3":
        args_out += ["-c:a", "libmp3lame", "-b:a", str(opts.get("bitrate", "128k")), "-id3v2_version", "3"]
        if cover_path and os.path.exists(cover_path):
            ci = add_input(["-i", cover_path])
            fg.append("[%d:v]scale=1400:1400:force_original_aspect_ratio=decrease[cov]" % ci)
            maps += ["-map", "[cov]"]
            args_out += ["-c:v", "mjpeg", "-q:v", "3", "-disposition:v:0", "attached_pic",
                         "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)"]
    elif fmt == "m4a":
        args_out += ["-c:a", "aac", "-b:a", str(opts.get("bitrate", "128k")), "-movflags", "+faststart"]
    elif fmt == "wav":
        args_out += ["-c:a", "pcm_s16le"]
    elif fmt == "flac":
        args_out += ["-c:a", "flac"]

    # ---- metadata + chapters
    meta = os.path.join(workdir, "meta.txt")
    esc = lambda s: re.sub(r"([=;#\\\n])", r"\\\1", str(s or ""))
    lines = [";FFMETADATA1"]
    chapters = sorted([c for c in ep.get("chapters", []) if 0 <= c.get("t", -1) < total], key=lambda c: c["t"])
    if chapters and spec["ext"] in ("mp3", "m4a", "mp4"):
        if chapters[0]["t"] > 0.5:
            chapters = [{"t": 0, "title": "Start"}] + chapters
        for i, c in enumerate(chapters):
            end = chapters[i + 1]["t"] if i + 1 < len(chapters) else total
            lines += ["[CHAPTER]", "TIMEBASE=1/1000", "START=%d" % int(c["t"] * 1000), "END=%d" % int(end * 1000),
                      "title=" + esc(c.get("title") or "Chapter %d" % (i + 1))]
    with open(meta, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    mi = add_input(["-f", "ffmetadata", "-i", meta])
    tags = {"title": ep.get("title", ""), "artist": show.get("author") or show.get("title", ""),
            "album": show.get("title", ""), "genre": "Podcast", "track": str(ep.get("number") or ""),
            "date": time.strftime("%Y"), "comment": (ep.get("description") or "")[:500]}
    cmd = ["ffmpeg", "-y", "-hide_banner", "-nostats", "-progress", "pipe:1"]
    for a in inputs:
        cmd += a
    script = os.path.join(workdir, "graph.txt")
    with open(script, "w", encoding="utf-8") as fh:
        fh.write(";\n".join(fg))
    cmd += ["-filter_complex_script", script] + maps + ["-map_metadata", str(mi), "-map_chapters", str(mi)]
    for k, v in tags.items():
        if v:
            cmd += ["-metadata", "%s=%s" % (k, v)]
    cmd += args_out + ["-t", _f(total), out_path]
    return cmd, total


def start_render(sid, eid, opts):
    if not have("ffmpeg"):
        raise ValueError("ffmpeg is not installed — install it to export episodes.")
    show, ep = store.get_show(sid), store.get_episode(sid, eid)
    fmt = opts.get("format", "mp3")
    if fmt not in FORMATS:
        raise ValueError("unknown format")
    job_id = store.new_id("j_")
    exp_dir = os.path.join(store.ep_dir(sid, eid), "exports")
    work = os.path.join(store.sub("tmp"), job_id)
    os.makedirs(exp_dir, exist_ok=True)
    os.makedirs(work, exist_ok=True)
    fname = "%s-s%02de%02d-%s%s.%s" % (store.slugify(ep["title"]), ep.get("season") or 1, ep.get("number") or 1,
                                       time.strftime("%Y%m%d-%H%M%S"), "-audiogram" if fmt == "audiogram" else "",
                                       FORMATS[fmt]["ext"])
    out = os.path.join(exp_dir, fname)
    cmd, total = build_render(show, ep, opts, out, work)
    job = {"id": job_id, "status": "running", "progress": 0, "error": "", "file": fname, "format": fmt}
    JOBS[job_id] = job

    def worker():
        try:
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            job["_proc"] = p
            err = []
            threading.Thread(target=lambda: err.append(p.stderr.read()), daemon=True).start()
            for line in p.stdout:
                line = line.decode("utf-8", "replace").strip()
                if line.startswith("out_time_ms=") or line.startswith("out_time_us="):
                    try:
                        job["progress"] = max(0, min(99, int(int(line.split("=")[1]) / 1e6 / total * 100)))
                    except ValueError:
                        pass
            p.wait()
            if job["status"] == "cancelled":
                raise RuntimeError("cancelled")
            if p.returncode != 0 or not os.path.exists(out):
                time.sleep(0.1)
                raise RuntimeError((err[0].decode("utf-8", "replace") if err else "ffmpeg failed")[-1500:])
            info = probe(out)
            entry = {"id": store.new_id("x_"), "file": fname, "format": fmt, "mime": FORMATS[fmt]["mime"],
                     "size": os.path.getsize(out), "duration": info["duration"], "hasVideo": info["hasVideo"],
                     "createdAt": store.now()}
            with store.LOCK:
                e2 = store.get_episode(sid, eid)
                e2["exports"].append(entry)
                if not e2.get("feedExportId") and fmt in ("mp3", "m4a"):
                    e2["feedExportId"] = entry["id"]
                if e2.get("status") in ("draft", "recorded"):
                    e2["status"] = "edited"
                store.save_episode(e2)
            job.update(status="done", progress=100, export=entry)
        except Exception as ex:  # noqa
            if job["status"] != "cancelled":
                job.update(status="error", error=str(ex))
            try:
                os.remove(out)
            except OSError:
                pass
        finally:
            job.pop("_proc", None)
            shutil.rmtree(work, ignore_errors=True)

    threading.Thread(target=worker, daemon=True).start()
    return job


def cancel_job(job_id):
    job = JOBS.get(job_id)
    if job and job.get("_proc"):
        job["status"] = "cancelled"
        job["_proc"].kill()


def public_job(job):
    return {k: v for k, v in job.items() if not k.startswith("_")}


def delete_export(sid, eid, xid):
    with store.LOCK:
        ep = store.get_episode(sid, eid)
        x = next((e for e in ep["exports"] if e["id"] == xid), None)
        if not x:
            return
        ep["exports"] = [e for e in ep["exports"] if e["id"] != xid]
        if ep.get("feedExportId") == xid:
            ep["feedExportId"] = ""
        store.save_episode(ep)
    try:
        os.remove(os.path.join(store.ep_dir(sid, eid), "exports", x["file"]))
    except OSError:
        pass
