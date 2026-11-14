# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""RSS feed (Apple/iTunes + Podcasting 2.0 tags), publish bundle, deployment and directories."""
import hashlib, html, json, os, shutil, subprocess, time, uuid
from email.utils import formatdate
from xml.sax.saxutils import escape, quoteattr

import ai, media, store

DIRECTORIES = [
    {"id": "apple", "name": "Apple Podcasts", "url": "https://podcastsconnect.apple.com/",
     "how": "Sign in with an Apple Account → + → New Show → Add a show with an RSS feed. Apple reviews new shows (usually a few days). Many other apps read Apple's catalog, so do this one first."},
    {"id": "spotify", "name": "Spotify", "url": "https://creators.spotify.com/",
     "how": "Spotify for Creators → Get started → Find an existing show → paste the feed. Spotify emails a code to the feed's owner address to verify."},
    {"id": "youtube", "name": "YouTube / YouTube Music", "url": "https://studio.youtube.com/",
     "how": "YouTube Studio → Content → Podcasts → New podcast → Submit RSS feed. Audio episodes become static-image videos; upload your MP4 exports directly for true video episodes."},
    {"id": "amazon", "name": "Amazon Music & Audible", "url": "https://podcasters.amazon.com/",
     "how": "Amazon Music for Podcasters → Add or claim your podcast → paste the feed → confirm by email."},
    {"id": "iheart", "name": "iHeartRadio", "url": "https://podcasters.iheart.com/",
     "how": "Create an account → Submit your podcast → paste the feed."},
    {"id": "podcastindex", "name": "Podcast Index", "url": "https://podcastindex.org/add",
     "how": "Open index used by Fountain, Podverse, Podcast Addict, AntennaPod and others. Paste the feed — or use the Submit button here if you saved Podcast Index API keys."},
    {"id": "pocketcasts", "name": "Pocket Casts", "url": "https://pocketcasts.com/submit/",
     "how": "Paste the feed URL; listed almost immediately."},
    {"id": "tunein", "name": "TuneIn", "url": "https://help.tunein.com/contact/add-podcast-S19TR3Sdf",
     "how": "Fill in the Add Podcast form with the feed URL."},
    {"id": "pandora", "name": "Pandora", "url": "https://amp.pandora.com/",
     "how": "Pandora AMP → Podcasts → submit the feed. Curated: approval is not guaranteed."},
    {"id": "deezer", "name": "Deezer", "url": "https://podcasters.deezer.com/submission",
     "how": "Paste the feed and confirm ownership by email."},
    {"id": "listennotes", "name": "Listen Notes", "url": "https://www.listennotes.com/submit/",
     "how": "Podcast search engine — paste the feed."},
    {"id": "playerfm", "name": "Player FM", "url": "https://player.fm/importer/feed",
     "how": "Paste the feed URL."},
    {"id": "podchaser", "name": "Podchaser", "url": "https://www.podchaser.com/add",
     "how": "Usually picked up automatically from Apple; add manually if missing, then claim the show."},
    {"id": "goodpods", "name": "Goodpods", "url": "https://www.goodpods.com/",
     "how": "Picked up from Apple/Podcast Index automatically; claim the show in the app."},
]
PODCAST_NS = uuid.UUID("ead4c236-bf58-58c6-a2c6-a6b28d128cb6")
MIME = {".mp3": "audio/mpeg", ".m4a": "audio/x-m4a", ".mp4": "video/mp4", ".wav": "audio/wav", ".flac": "audio/flac"}


def base_url(show):
    return (show.get("feed", {}).get("publicBaseUrl") or "").strip().rstrip("/")


def feed_url(show):
    b = base_url(show)
    return b + "/feed.xml" if b else ""


def podcast_guid(show):
    u = feed_url(show) or show["id"]
    u = u.split("://", 1)[-1].rstrip("/")
    return str(uuid.uuid5(PODCAST_NS, u))


def published_items(show):
    """Episodes marked published that have an export chosen for the feed."""
    items = []
    for e in store.list_episodes(show["id"], full=True):
        if not e.get("published"):
            continue
        x = next((x for x in e.get("exports", []) if x["id"] == e.get("feedExportId")), None)
        if not x:
            continue
        ext = os.path.splitext(x["file"])[1].lower()
        fname = "s%02de%03d-%s%s" % (e.get("season") or 1, e.get("number") or 1, store.slugify(e["title"]), ext)
        items.append({"ep": e, "export": x, "fname": fname,
                      "src": os.path.join(store.ep_dir(show["id"], e["id"]), "exports", x["file"])})
    items.sort(key=lambda i: -(i["ep"].get("pubDate") or 0))
    return items


def _dur(sec):
    sec = int(round(sec or 0))
    return "%02d:%02d:%02d" % (sec // 3600, sec % 3600 // 60, sec % 60)


def _notes_html(text):
    paras = [p.strip() for p in (text or "").replace("\r", "").split("\n\n") if p.strip()]
    return "".join("<p>%s</p>" % html.escape(p).replace("\n", "<br/>") for p in paras)


def build_feed(show, items=None):
    items = published_items(show) if items is None else items
    b = base_url(show) or "https://example.invalid/set-your-public-url"
    cover_path, cover = store.asset_path(show, show.get("coverAsset"))
    cover_url = "%s/cover%s" % (b, os.path.splitext(cover["file"])[1].lower()) if cover else ""
    fd = show.get("feed", {})
    e = escape
    o = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" '
         'xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:atom="http://www.w3.org/2005/Atom" '
         'xmlns:content="http://purl.org/rss/1.0/modules/content/">', "<channel>",
         "<title>%s</title>" % e(show.get("title", "")),
         "<link>%s</link>" % e(show.get("website") or b),
         '<atom:link href=%s rel="self" type="application/rss+xml"/>' % quoteattr(b + "/feed.xml"),
         "<description>%s</description>" % e(show.get("description", "")),
         "<language>%s</language>" % e(show.get("language") or "en"),
         "<copyright>%s</copyright>" % e(show.get("copyright") or "© %s %s" % (time.strftime("%Y"), show.get("author", ""))),
         "<lastBuildDate>%s</lastBuildDate>" % formatdate(usegmt=True),
         "<generator>IPRPS Podcast Studio %s</generator>" % store.VERSION,
         "<itunes:author>%s</itunes:author>" % e(show.get("author", "")),
         "<itunes:type>%s</itunes:type>" % ("serial" if show.get("showType") == "serial" else "episodic"),
         "<itunes:explicit>%s</itunes:explicit>" % ("true" if show.get("explicit") else "false"),
         "<podcast:guid>%s</podcast:guid>" % podcast_guid(show),
         "<podcast:medium>podcast</podcast:medium>"]
    if show.get("subtitle"):
        o.append("<itunes:subtitle>%s</itunes:subtitle>" % e(show["subtitle"]))
    if show.get("ownerEmail"):
        o.append("<itunes:owner><itunes:name>%s</itunes:name><itunes:email>%s</itunes:email></itunes:owner>"
                 % (e(show.get("ownerName") or show.get("author", "")), e(show["ownerEmail"])))
        o.append('<podcast:locked owner=%s>%s</podcast:locked>' % (quoteattr(show["ownerEmail"]), "yes" if fd.get("locked", True) else "no"))
    if cover_url:
        o.append("<itunes:image href=%s/>" % quoteattr(cover_url))
        o.append("<image><url>%s</url><title>%s</title><link>%s</link></image>" % (e(cover_url), e(show.get("title", "")), e(show.get("website") or b)))
    if show.get("category"):
        if show.get("subcategory"):
            o.append("<itunes:category text=%s><itunes:category text=%s/></itunes:category>" % (quoteattr(show["category"]), quoteattr(show["subcategory"])))
        else:
            o.append("<itunes:category text=%s/>" % quoteattr(show["category"]))
    if fd.get("fundingUrl"):
        o.append("<podcast:funding url=%s>Support the show</podcast:funding>" % quoteattr(fd["fundingUrl"]))
    for c in show.get("cast", []):
        role = {"host": "host", "cohost": "co-host", "guest": "guest"}.get(c.get("role"), "guest")
        if c.get("role") in ("host", "cohost"):
            o.append('<podcast:person role=%s>%s</podcast:person>' % (quoteattr(role), e(c["name"])))
    footer = show.get("brand", {}).get("footer", "")
    for it in items:
        ep, x = it["ep"], it["export"]
        url = "%s/media/%s" % (b, it["fname"])
        notes = ep.get("description", "") + (("\n\n" + footer) if footer else "")
        o += ["<item>", "<title>%s</title>" % e(ep.get("title", "")),
              "<itunes:title>%s</itunes:title>" % e(ep.get("title", "")),
              "<description>%s</description>" % e(notes),
              "<content:encoded><![CDATA[%s]]></content:encoded>" % _notes_html(notes).replace("]]>", "]]&gt;"),
              '<guid isPermaLink="false">%s</guid>' % e("%s-%s" % (show["id"], ep["id"])),
              "<pubDate>%s</pubDate>" % formatdate((ep.get("pubDate") or ep.get("createdAt") or 0) / 1000, usegmt=True),
              "<enclosure url=%s length=\"%d\" type=%s/>" % (quoteattr(url), x.get("size", 0), quoteattr(MIME.get(os.path.splitext(it["fname"])[1], "audio/mpeg"))),
              "<itunes:duration>%s</itunes:duration>" % _dur(x.get("duration")),
              "<itunes:episodeType>%s</itunes:episodeType>" % e(ep.get("episodeType") or "full"),
              "<itunes:explicit>%s</itunes:explicit>" % ("true" if (ep.get("explicit") or show.get("explicit")) else "false")]
        if ep.get("season"):
            o.append("<itunes:season>%d</itunes:season>" % int(ep["season"]))
            o.append("<podcast:season>%d</podcast:season>" % int(ep["season"]))
        if ep.get("number") and (ep.get("episodeType") or "full") == "full":
            o.append("<itunes:episode>%d</itunes:episode>" % int(ep["number"]))
            o.append("<podcast:episode>%d</podcast:episode>" % int(ep["number"]))
        if ep.get("chapters"):
            o.append('<podcast:chapters url=%s type="application/json+chapters"/>' % quoteattr("%s/chapters/%s.json" % (b, ep["id"])))
        o.append("</item>")
    o += ["</channel>", "</rss>"]
    return "\n".join(o) + "\n"


def validate(show):
    """Checks every major directory applies before accepting a feed."""
    checks = []
    add = lambda ok, level, msg: checks.append({"ok": bool(ok), "level": level, "msg": msg})
    add(len(show.get("title", "").strip()) > 1 and show.get("title") != "New Show", "error", "Show title")
    add(len(show.get("description", "").strip()) >= 20, "error", "Show description (a couple of sentences)")
    add(show.get("author", "").strip(), "error", "Author / host name")
    add("@" in show.get("ownerEmail", ""), "error", "Owner email (Spotify, Amazon and others send a verification code to it)")
    add(show.get("language"), "error", "Language")
    add(show.get("category"), "error", "Apple Podcasts category")
    p, a = store.asset_path(show, show.get("coverAsset"))
    if not a:
        add(False, "error", "Cover art — square JPEG or PNG, 1400×1400 to 3000×3000 px")
    else:
        w, h = a.get("width", 0), a.get("height", 0)
        add(w == h and 1400 <= w <= 3000, "error", "Cover art is square and 1400–3000 px (yours: %d×%d)" % (w, h))
        add(os.path.splitext(a["file"])[1].lower() in (".jpg", ".jpeg", ".png"), "error", "Cover art is JPEG or PNG")
    b = base_url(show)
    add(b.startswith("https://"), "error", "Public feed address starts with https:// (directories reject plain http)")
    items = published_items(show)
    add(len(items) >= 1, "error", "At least one published episode with an audio export chosen for the feed")
    add(all(os.path.splitext(i["fname"])[1] in (".mp3", ".m4a", ".mp4") for i in items), "warn", "Episodes are MP3, M4A or MP4 (accepted everywhere)")
    add(show.get("feed", {}).get("lastPublished"), "warn", "Feed has been published at least once")
    add(bool(show.get("website")), "warn", "Show website (optional but recommended)")
    return checks


def _landing(show, items, cover_name):
    br = show.get("brand", {})
    e = html.escape
    eps = "".join(
        "<article><h3>%s</h3><p class='m'>S%d · E%d · %s · %s</p>%s<%s controls preload='none' src='media/%s'></%s></article>"
        % (e(i["ep"]["title"]), i["ep"].get("season") or 1, i["ep"].get("number") or 1,
           time.strftime("%b %d, %Y", time.gmtime((i["ep"].get("pubDate") or 0) / 1000)), _dur(i["export"].get("duration")),
           _notes_html(i["ep"].get("description", "")), "video" if i["fname"].endswith(".mp4") else "audio", e(i["fname"]),
           "video" if i["fname"].endswith(".mp4") else "audio") for i in items)
    return """<!doctype html><html lang="%s"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title><link rel="alternate" type="application/rss+xml" title="%s" href="feed.xml">
<style>body{margin:0;background:%s;color:%s;font:16px/1.6 system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:40px 20px}
header{display:flex;gap:24px;align-items:center;flex-wrap:wrap}header img{width:180px;height:180px;border-radius:14px;object-fit:cover}
h1{margin:0 0 6px;font-size:2rem}a.btn{display:inline-block;margin-top:10px;padding:8px 16px;border-radius:999px;background:%s;color:#fff;text-decoration:none;font-weight:600}
article{border-top:1px solid #ffffff22;padding:22px 0}article h3{margin:0}.m{opacity:.65;font-size:.85rem;margin:2px 0 8px}audio,video{width:100%%;margin-top:8px}
.tag{color:%s;font-weight:600}footer{opacity:.5;font-size:.8rem;padding:30px 0}</style></head><body><main>
<header>%s<div><h1>%s</h1><div class="tag">%s</div><p>%s</p><a class="btn" href="feed.xml">RSS feed</a></div></header>
%s<footer>%s · Made with IPRPS Podcast Studio</footer></main></body></html>""" % (
        e(show.get("language") or "en"), e(show.get("title", "")), e(show.get("title", "")), e(br.get("bg", "#0f1218")),
        e(br.get("text", "#f2f4f8")), e(br.get("primary", "#7c5cff")), e(br.get("accent", "#ffb347")),
        "<img src='%s' alt='Cover art'>" % e(cover_name) if cover_name else "", e(show.get("title", "")),
        e(br.get("tagline") or show.get("subtitle", "")), e(show.get("description", "")), eps,
        e(show.get("copyright") or show.get("author", "")))


def build_bundle(show):
    """Write feed.xml, cover, media, chapters and a landing page to data/publish/<slug>/."""
    out = store.sub("publish", store.slugify(show.get("title")) + "-" + show["id"][-4:])
    os.makedirs(os.path.join(out, "media"), exist_ok=True)
    os.makedirs(os.path.join(out, "chapters"), exist_ok=True)
    items = published_items(show)
    keep = set()
    for it in items:
        dst = os.path.join(out, "media", it["fname"])
        keep.add(it["fname"])
        if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(it["src"]) \
                or os.path.getmtime(dst) < os.path.getmtime(it["src"]):
            shutil.copy2(it["src"], dst)
        ep = it["ep"]
        cp = os.path.join(out, "chapters", ep["id"] + ".json")
        if ep.get("chapters"):
            store.write_json(cp, {"version": "1.2.0", "chapters": [
                {"startTime": round(c["t"], 2), "title": c.get("title") or "Chapter"} for c in sorted(ep["chapters"], key=lambda c: c["t"])]})
        elif os.path.exists(cp):
            os.remove(cp)
    for f in os.listdir(os.path.join(out, "media")):
        if f not in keep:
            os.remove(os.path.join(out, "media", f))
    cover_name = ""
    p, a = store.asset_path(show, show.get("coverAsset"))
    if a and os.path.exists(p):
        cover_name = "cover" + os.path.splitext(a["file"])[1].lower()
        shutil.copy2(p, os.path.join(out, cover_name))
    with open(os.path.join(out, "feed.xml"), "w", encoding="utf-8") as f:
        f.write(build_feed(show, items))
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
        f.write(_landing(show, items, cover_name))
    return out, items


def deploy(show, bundle):
    fd = show.get("feed", {})
    mode = fd.get("deployMode") or "folder"
    src = bundle.rstrip("/") + "/"
    if mode == "none":
        return "Bundle built at %s — upload that folder to your web host yourself." % bundle
    if mode == "folder":
        dst = os.path.expanduser((fd.get("deployFolder") or "").strip())
        if not dst:
            return "Bundle built at %s. Set a deploy folder (or SSH target) to copy it to your web server automatically." % bundle
        os.makedirs(dst, exist_ok=True)
        if media.have("rsync"):
            r = media.run(["rsync", "-a", "--delete", src, dst.rstrip("/") + "/"])
            if r.returncode != 0:
                raise ValueError("rsync failed: " + r.stderr.decode("utf-8", "replace")[-400:])
        else:
            shutil.copytree(bundle, dst, dirs_exist_ok=True)
        return "Copied to %s" % dst
    if mode == "ssh":
        target = (fd.get("sshTarget") or "").strip()
        if not target or ":" not in target or target.startswith("-"):
            raise ValueError("SSH target should look like user@host:/var/www/podcasts/my-show")
        ssh = "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
        if media.have("rsync"):
            r = media.run(["rsync", "-az", "--delete", "-e", ssh, src, target.rstrip("/") + "/"], timeout=3600)
        else:
            r = media.run(["scp", "-r", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15"] +
                          [os.path.join(bundle, f) for f in os.listdir(bundle)] + [target.rstrip("/") + "/"], timeout=3600)
        if r.returncode != 0:
            raise ValueError("Upload failed (is your SSH key set up for this server?): " + r.stderr.decode("utf-8", "replace")[-400:])
        return "Uploaded to %s" % target
    raise ValueError("unknown deploy mode")


def publish(sid):
    show = store.get_show(sid)
    bundle, items = build_bundle(show)
    log = deploy(show, bundle)
    with store.LOCK:
        show = store.get_show(sid)
        show["feed"]["lastPublished"] = store.now()
        store.save_show(show)
    return {"bundle": bundle, "episodes": len(items), "log": log, "feedUrl": feed_url(show)}


def submit_podcastindex(show):
    cfg = store.load_config()["keys"]
    key, secret = cfg.get("podcastindexKey"), cfg.get("podcastindexSecret")
    if not key or not secret:
        raise ValueError("Save a Podcast Index API key and secret in Settings first (free at api.podcastindex.org).")
    url = feed_url(show)
    if not url:
        raise ValueError("Set the public feed address first.")
    ts = str(int(time.time()))
    auth = hashlib.sha1((key + secret + ts).encode()).hexdigest()
    import urllib.parse
    j = ai._json("GET", "https://api.podcastindex.org/api/1.0/add/byfeedurl?url=" + urllib.parse.quote(url, safe=""),
                 {"X-Auth-Key": key, "X-Auth-Date": ts, "Authorization": auth})
    return j
