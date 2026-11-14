# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Checks the AI provider code paths against a local mock of the Gemini, xAI and ElevenLabs HTTP APIs."""
import base64, json, os, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
tmp = tempfile.mkdtemp(); os.environ.update(IPRPS_PODCAST_DATA=tmp + "/d", IPRPS_PODCAST_CONFIG=tmp + "/c")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))
import ai, store
PCM = b"\x00\x01" * 12000
seen = []

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, body, ctype="application/json"):
        raw = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_GET(self):
        seen.append(("GET", self.path))
        if "/gem/voices" in self.path: return self._send(404, {"error": {"message": "nope"}})
        if "/gem/models" in self.path: return self._send(200, {"models": [{"name": "models/gemini-9-flash", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-9-flash-tts"}]})
        if "/xai/tts/voices" in self.path: return self._send(200, {"voices": [{"voice_id": "eve", "name": "Eve", "language": "multilingual"}]})
        if "/xai/models" in self.path: return self._send(200, {"data": [{"id": "grok-9-fast"}, {"id": "grok-imagine"}]})
        if "/v2/voices" in self.path: return self._send(200, {"voices": [{"voice_id": "abc", "name": "Rachel", "category": "premade", "labels": {"accent": "american"}}], "has_more": False})
        self._send(404, {})
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        seen.append(("POST", self.path))
        if ":generateContent" in self.path:
            j = json.loads(body)
            if "3.8" in self.path and "tts" in self.path: return self._send(404, {"error": {"message": "model not found"}})
            if "tts" in self.path:
                if "prebuiltVoiceConfig" not in json.dumps(j): return self._send(400, {"error": {"message": "bad shape"}})
                return self._send(200, {"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": base64.b64encode(PCM).decode()}}]}}]})
            if "inlineData" in json.dumps(j): return self._send(200, {"candidates": [{"content": {"parts": [{"text": "what did the dragon say"}]}}]})
            return self._send(200, {"candidates": [{"content": {"parts": [{"text": "Great question, let me think.", }]}}]})
        if self.path.endswith("/xai/tts"): return self._send(200, {"audio": base64.b64encode(b"ID3xai").decode(), "content_type": "audio/mpeg", "duration": 1})
        if "/xai/chat/completions" in self.path: return self._send(200, {"choices": [{"message": {"content": "Grok here."}}]})
        if "/xai/stt" in self.path: assert b"filename=\"talk.mp3\"" in body; return self._send(200, {"text": "hello grok"})
        if "/v1/text-to-speech/abc" in self.path: assert self.headers["xi-api-key"] == "k3"; return self._send(200, b"ID3eleven", "audio/mpeg")
        if "/v1/speech-to-text" in self.path: return self._send(200, {"text": "hello eleven"})
        self._send(404, {})

srv = HTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d" % srv.server_port
ai.GEMINI, ai.XAI, ai.ELEVEN = base + "/gem", base + "/xai", base
for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"): os.environ.pop(k, None)
store.save_config({"keys": {"gemini": "k1", "xai": "k2", "elevenlabs": "k3"}})
assert len(ai.voices("gemini")) == 30
wav, ext = ai.tts("gemini", "Hello there", "Kore", "warm"); assert ext == "wav" and wav[:4] == b"RIFF" and len(wav) == 44 + len(PCM), "gemini fallback chain"
print("gemini TTS: model + request-shape fallback OK ->", [p for m, p in seen if "tts" in p and m == "POST"])
assert ai.tts("xai", "Hi", "eve") == (b"ID3xai", "mp3")
assert ai.tts("elevenlabs", "Hi", "abc") == (b"ID3eleven", "mp3")
assert ai.voices("xai")[0]["id"] == "eve" and ai.voices("elevenlabs")[0]["name"] == "Rachel"
assert ai.models("gemini") == ["gemini-9-flash"] and ai.models("xai") == ["grok-9-fast"]
assert ai.chat("gemini", "", "sys", [{"role": "user", "text": "hi"}]).startswith("Great")
assert ai.chat("xai", "", "sys", [{"role": "user", "text": "hi"}]) == "Grok here."
assert ai.stt(b"mp3", "gemini") == "what did the dragon say" and ai.stt(b"mp3", "xai") == "hello grok" and ai.stt(b"mp3", "elevenlabs") == "hello eleven"
show = store.create_show({"title": "T"}); cast = {"id": "c1", "name": "Nova", "role": "cohost", "kind": "ai", "ai": {"voice": {"provider": "xai", "voiceId": "eve"}, "brain": {"provider": "gemini"}}}
text, audio, ext = ai.turn(show, {"title": "E", "description": ""}, cast, "reply", "", "what did the dragon say", [{"who": "Host", "text": "Welcome back"}])
assert text.startswith("Great") and audio == b"ID3xai"
try: store.save_config({"keys": {"elevenlabs": "-"}}); ai.tts("elevenlabs", "x", "abc"); raise SystemExit("should fail")
except ai.AIError as e: print("missing key message:", e)
print("AI provider paths OK")
