# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Starts the studio with the AI providers pointed at a local mock (for the browser test — no real keys needed)."""
import base64, json, math, os, struct, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))
import ai, store, studio
PCM = b"".join(struct.pack("<h", int(9000 * math.sin(i * 2 * math.pi * 330 / 24000))) for i in range(24000 * 2))

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, body):
        raw = json.dumps(body).encode(); self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_GET(self): self._send({"models": [{"name": "models/gemini-mock-flash", "supportedGenerationMethods": ["generateContent"]}], "voices": []})
    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if "tts" in self.path: return self._send({"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;rate=24000", "data": base64.b64encode(PCM).decode()}}]}}]})
        self._send({"candidates": [{"content": {"parts": [{"text": "Roll for initiative — I have thoughts on that."}]}}]})

srv = HTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
ai.GEMINI = "http://127.0.0.1:%d" % srv.server_port
for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"): os.environ.pop(k, None)
store.save_config({"keys": {"gemini": "mock"}})
studio.main()
