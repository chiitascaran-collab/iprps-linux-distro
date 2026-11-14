"""Chrome test: sign in on the Link console, turn remote play on, then join the real IPRPS Table through the relay as a remote player.
   python3 tests/iprps-link/browser_test.py node|php      (needs playwright + Chrome)"""
import json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TABLE_DIR = os.environ.get("TABLE_DIR", ROOT + "/apps/table"); KIND = sys.argv[1] if len(sys.argv) > 1 else "node"
SHOTS = os.environ.get("SHOTS", "/tmp/linkshots"); os.makedirs(SHOTS, exist_ok=True)
tmp = tempfile.mkdtemp(); TOK = "a" * 64
FAKE_CLIENT = "window.IPAuth={user:{username:'james',email:'j@example.com'},token:function(){return '%s'}};" % TOK

class Auth(BaseHTTPRequestHandler):          # stand-in for infiniteplane.space/auth/
    def log_message(self, *a): pass
    def _send(self, body, ctype):
        self.send_response(200); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path.startswith("/link.html"): return self._send(open(ROOT + "/relay/auth/link.html", "rb").read(), "text/html")
        if self.path.startswith("/auth-client.js"): return self._send(FAKE_CLIENT.encode(), "text/javascript")
        self._send(b"", "text/plain")
    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self._send(json.dumps({"ok": True, "user": {"id": 7, "username": "james"}} if self.headers.get("X-Auth-Token") == TOK else {"ok": False}).encode(), "application/json")
threading.Thread(target=HTTPServer(("127.0.0.1", 18700), Auth).serve_forever, daemon=True).start()
AUTH = "http://127.0.0.1:18700/"
env = dict(os.environ); kids = []
def run(cmd, extra, cwd=None): kids.append(subprocess.Popen(cmd, env={**env, **extra}, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
run(["node", TABLE_DIR + "/server.js"], {"IPRPS_TABLE_PORT": "18777", "IPRPS_TABLE_STATE": tmp + "/table", "STATE_DIRECTORY": ""})
if KIND == "node":
    RELAY = "http://127.0.0.1:18787/play"; run(["node", ROOT + "/relay/node/relay.js"], {"PORT": "18787", "PUBLIC_URL": RELAY, "AUTH_URL": AUTH, "DATA_DIR": tmp + "/relay"})
else:
    RELAY = "http://127.0.0.1:18787"; d = tmp + "/php"; os.mkdir(d); shutil.copy(ROOT + "/relay/php/index.php", d)
    open(d + "/config.php", "w").write("<?php return ['auth_url' => '%s', 'data_dir' => '%s/phpdata', 'base_path' => ''];" % (AUTH, tmp))
    run(["php", "-S", "127.0.0.1:18787", "-t", d, d + "/index.php"], {"PHP_CLI_SERVER_WORKERS": "32"}, d)
run(["node", ROOT + "/apps/link/agent.js"], {"IPRPS_LINK_PORT": "18778", "IPRPS_LINK_TABLE": "http://127.0.0.1:18777", "IPRPS_LINK_STATE": tmp + "/agent", "STATE_DIRECTORY": "", "IPRPS_LINK_QR": TABLE_DIR + "/public/qr.js"})
time.sleep(1.5)
def sm(path, body):
    req = urllib.request.Request("http://localhost:18777" + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-iprps-sm": "1"}); return json.load(urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req))
errors = []
try:
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-proxy-server"])
        con = br.new_context(viewport={"width": 900, "height": 1000}).new_page()
        con.on("pageerror", lambda e: errors.append("console page: %s" % e)); con.on("console", lambda m: m.type == "error" and errors.append("console page: " + m.text))
        con.goto("http://localhost:18778/"); con.wait_for_selector("#toggle"); con.screenshot(path=SHOTS + "/1-link-off.png")
        con.fill("#relay", RELAY); con.click("summary:text('Advanced')"); con.fill("#auth", AUTH); con.click("#save"); time.sleep(0.5)
        con.click("#signin"); con.wait_for_selector("#allow"); con.screenshot(path=SHOTS + "/2-signin.png"); con.click("#allow")
        con.wait_for_selector("#who:text('james')"); con.click("#toggle"); con.wait_for_selector("#share:not([hidden])", timeout=15000); time.sleep(0.5)
        url = con.input_value("#url"); print("player link:", url)
        sm("/api/sm/table", {"open": True, "name": "Fog on Pier Nine"})
        smp = br.new_context(viewport={"width": 1300, "height": 850}).new_page(); smp.goto("http://localhost:18777/sm/"); time.sleep(1.5)
        ev = urllib.request.build_opener(urllib.request.ProxyHandler({})).open("http://localhost:18777/api/sm/events")
        code = next(json.loads(l[6:])["table"]["code"] for l in iter(lambda: ev.readline().decode(), "") if l.startswith("data: ")); ev.close(); print("join code:", code)
        pl = br.new_context(viewport={"width": 420, "height": 860}, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile").new_page()
        pl.on("pageerror", lambda e: errors.append("player: %s" % e)); pl.on("console", lambda m: m.type == "error" and errors.append("player: " + m.text))
        pl.goto(url); pl.wait_for_selector("#join:not([hidden])"); pl.fill("#code", code); pl.fill("#name", "Riley"); pl.fill("#character", "Vex"); pl.screenshot(path=SHOTS + "/3-player-join.png")
        pl.press("#character", "Enter"); pl.wait_for_url("**/play"); pl.wait_for_selector("#composer textarea, #composer input"); time.sleep(1)
        box = pl.locator("#composer textarea, #composer input[type=text]").first; box.fill("Hello from three states away"); box.press("Enter")
        smp.wait_for_selector("text=Hello from three states away", timeout=8000)
        sm("/api/sm/send", {"text": "Welcome to Pier Nine, Vex.", "to": "all"})
        pl.wait_for_selector("text=Welcome to Pier Nine, Vex.", timeout=8000)
        pl.locator("#dice button").first.click(); time.sleep(1.2)
        pl.screenshot(path=SHOTS + "/4-player-table.png"); smp.screenshot(path=SHOTS + "/5-sm-console.png"); con.reload(); time.sleep(1); con.screenshot(path=SHOTS + "/6-link-on.png")
        print("player page address:", pl.url); print("player sees 'Riley' in SM console:", smp.locator("text=Riley").count() > 0)
        br.close()
    print("JS errors:", errors or "none")
finally:
    for k in kids: k.terminate()
    shutil.rmtree(tmp, ignore_errors=True)
