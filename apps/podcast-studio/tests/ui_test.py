# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Browser test: host + remote guest record a short take, then edit and export. Needs playwright + Chrome."""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get("SHOTS", "/tmp/shots"); os.makedirs(SHOTS, exist_ok=True)
tmp = tempfile.mkdtemp()
env = dict(os.environ, IPRPS_PODCAST_DATA=tmp + "/data", IPRPS_PODCAST_CONFIG=tmp + "/cfg")
PORT = 18801; B = "http://127.0.0.1:%d" % PORT
srv = subprocess.Popen([sys.executable, ROOT + "/tests/mock_studio.py", "--port", str(PORT), "--guest-port", str(PORT + 1)], env=env)
time.sleep(1.2)

def api(method, path, body=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))

errors = []
try:
    show = api("POST", "/api/shows", {"title": "Tales from the Infinite Plane", "description": "Actual play and design talk from the Infinite Plane.", "author": "J. Carrell Jones"})
    show["cast"] += [{"name": "Riley", "role": "guest", "kind": "human"}, {"name": "Nova", "role": "cohost", "kind": "ai", "ai": {"voice": {"provider": "gemini", "voiceId": "Kore"}, "brain": {"provider": "gemini"}}}]
    show["pads"] = [{"id": "p1", "label": "Applause", "color": "#ff4d5e", "assetId": "", "loop": False, "gain": 1}]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=1.5", tmp + "/clap.mp3"], check=True)
    req = urllib.request.Request(B + "/api/shows/%s/assets?name=clap.mp3" % show["id"], method="POST", data=open(tmp + "/clap.mp3", "rb").read())
    show["pads"][0]["assetId"] = json.load(urllib.request.urlopen(req))["asset"]["id"]
    show = api("PUT", "/api/shows/" + show["id"], {"cast": show["cast"], "pads": show["pads"]})
    ep = api("POST", "/api/shows/%s/episodes" % show["id"], {"title": "Session Zero"})
    sid, eid = show["id"], ep["id"]
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--ignore-certificate-errors", "--no-proxy-server"])
        host = br.new_context(viewport={"width": 1500, "height": 950}).new_page()
        host.on("pageerror", lambda e: errors.append("host: %s" % e))
        host.on("console", lambda m: m.type == "error" and errors.append("host console: " + m.text))
        host.goto(B + "/"); host.wait_for_selector(".show-card"); host.screenshot(path=SHOTS + "/1-library.png")
        for tab in ("details", "brand", "cast", "soundboard", "publish", "backup"):
            host.goto(B + "/#/show/%s/%s" % (sid, tab)); host.wait_for_selector(".tab-body > *"); time.sleep(0.4)
            host.screenshot(path=SHOTS + "/2-show-%s.png" % tab)
        host.goto(B + "/#/settings"); host.wait_for_selector("h1"); time.sleep(0.3); host.screenshot(path=SHOTS + "/3-settings.png")
        host.goto(B + "/#/show/%s/ep/%s/studio" % (sid, eid))
        host.click("#enter-studio"); host.wait_for_selector("#rec-btn"); time.sleep(1)
        inv = api("GET", "/api/room/%s/%s/invites" % (sid, eid))
        link = [l for l in inv["invites"][0]["links"] if l["label"] == "Local network"] or inv["invites"][0]["links"]
        print("guest link:", link[0]["url"])
        guest = br.new_context(viewport={"width": 1100, "height": 800}, ignore_https_errors=True).new_page()
        guest.on("pageerror", lambda e: errors.append("guest: %s" % e))
        guest.on("console", lambda m: m.type == "error" and errors.append("guest console: " + m.text))
        guest.goto(link[0]["url"]); guest.wait_for_selector("#join-btn:not([disabled])"); guest.screenshot(path=SHOTS + "/4-guest-lobby.png")
        guest.click("#join-btn"); time.sleep(4)
        tiles_h = host.locator(".tile").count(); tiles_g = guest.locator(".tile").count()
        print("tiles host/guest:", tiles_h, tiles_g)
        gv = guest.evaluate("[...document.querySelectorAll('.tile video')].map(v => v.videoWidth)")
        hv = host.evaluate("[...document.querySelectorAll('.tile video')].map(v => v.videoWidth)")
        print("video widths host:", hv, "guest:", gv)
        host.click("#rec-btn"); time.sleep(3.2)
        host.keyboard.press("m"); host.keyboard.press("1"); time.sleep(1)
        host.click(".side .tabs button[data-k=ai]"); host.fill(".ai-card input", "Introduce yourself"); host.click(".ai-card button:text('Respond')")
        host.wait_for_selector(".ai-status:text('Speaking')", timeout=20000); host.wait_for_selector(".ai-status:text('Ready')", timeout=20000); time.sleep(1)
        host.click(".side .tabs button[data-k=guests]"); time.sleep(0.5)
        host.screenshot(path=SHOTS + "/5-studio-recording.png"); guest.screenshot(path=SHOTS + "/6-guest-recording.png")
        host.click("#rec-btn"); time.sleep(6)
        e2 = api("GET", "/api/shows/%s/episodes/%s" % (sid, eid))
        print("media:", [(m["name"][:28], m["duration"], m["hasVideo"]) for m in e2["media"]])
        print("tracks:", [(t["name"], t["mute"], [(round(c["start"], 2), round(c["out"], 2)) for c in t["clips"]]) for t in e2["timeline"]["tracks"]])
        print("chapters:", e2["chapters"])
        names = [t["name"] for t in e2["timeline"]["tracks"]]
        assert "Nova (AI)" in names and "Decks & soundboard" in names and "Riley" in names, names
        print("transcript:", e2["transcript"])
        assert len(e2["media"]) >= 3, "expected host, guest and program takes"
        host.goto(B + "/#/show/%s/ep/%s/editor" % (sid, eid)); host.wait_for_selector(".clip"); time.sleep(1.5)
        host.click(".ruler", position={"x": 150, "y": 10}); host.click("#ed-split"); time.sleep(0.4)
        n1 = host.locator(".clip").count()
        host.click("#ed-play"); time.sleep(2.5); host.screenshot(path=SHOTS + "/7-editor.png"); host.click("#ed-play")
        print("clips after split:", n1, "playhead:", host.inner_text(".ed-monitor .timer"))
        host.goto(B + "/#/show/%s/ep/%s/export" % (sid, eid)); host.click("#render-btn"); host.wait_for_selector("table audio", timeout=60000)
        host.select_option(".tab-body select", "mp4"); host.click("#render-btn"); host.wait_for_selector("table video", timeout=120000)
        host.screenshot(path=SHOTS + "/8-export.png")
        e3 = api("GET", "/api/shows/%s/episodes/%s" % (sid, eid))
        print("exports:", [(x["format"], x["duration"], x["size"]) for x in e3["exports"]])
        shutil.copy(os.path.join(tmp, "data/shows", sid, "episodes", eid, "exports", e3["exports"][-1]["file"]), SHOTS + "/out.mp4")
        br.close()
    print("JS errors:", errors or "none")
finally:
    srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
