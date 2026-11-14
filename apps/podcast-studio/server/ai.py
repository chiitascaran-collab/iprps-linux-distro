# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""AI co-host / guest: text "brains", text-to-speech voices and speech-to-text.

Voices:  Gemini TTS (default), Grok (xAI) TTS, ElevenLabs.
Brains:  Gemini, Grok, Claude, or a local Ollama model (the IPRPS Oracle).
All requests go straight from this machine to the provider with the Session Master's own keys.
"""
import base64, json, os, struct, subprocess, tempfile, time, urllib.error, urllib.request, uuid

import store

GEMINI = "https://generativelanguage.googleapis.com/v1beta"
XAI = "https://api.x.ai/v1"
ELEVEN = "https://api.elevenlabs.io"
ANTHROPIC = "https://api.anthropic.com/v1"

GEMINI_VOICES = [
    ("Zephyr", "Bright"), ("Puck", "Upbeat"), ("Charon", "Informative"), ("Kore", "Firm"), ("Fenrir", "Excitable"),
    ("Leda", "Youthful"), ("Orus", "Firm"), ("Aoede", "Breezy"), ("Callirrhoe", "Easy-going"), ("Autonoe", "Bright"),
    ("Enceladus", "Breathy"), ("Iapetus", "Clear"), ("Umbriel", "Easy-going"), ("Algieba", "Smooth"),
    ("Despina", "Smooth"), ("Erinome", "Clear"), ("Algenib", "Gravelly"), ("Rasalgethi", "Informative"),
    ("Laomedeia", "Upbeat"), ("Achernar", "Soft"), ("Alnilam", "Firm"), ("Schedar", "Even"), ("Gacrux", "Mature"),
    ("Pulcherrima", "Forward"), ("Achird", "Friendly"), ("Zubenelgenubi", "Casual"), ("Vindemiatrix", "Gentle"),
    ("Sadachbia", "Lively"), ("Sadaltager", "Knowledgeable"), ("Sulafat", "Warm"),
]
GEMINI_TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview",
                     "gemini-2.5-flash-preview-tts"]
XAI_VOICES = [("eve", "Eve"), ("ara", "Ara"), ("leo", "Leo"), ("rex", "Rex"), ("sal", "Sal")]
_cache = {}


class AIError(Exception):
    pass


def _key(name, label):
    k = store.load_config()["keys"].get(name, "")
    if not k:
        raise AIError("No %s API key saved yet — add it in Settings → AI services." % label)
    return k


def http(method, url, headers=None, body=None, timeout=180):
    data = None
    headers = dict(headers or {})
    if isinstance(body, (dict, list)):
        data = json.dumps(body).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")
    elif body is not None:
        data = body
    headers.setdefault("User-Agent", "IPRPS-Podcast-Studio/" + store.VERSION)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read()
    except urllib.error.HTTPError as e:
        raw = e.read()[:2000].decode("utf-8", "replace")
        msg = raw
        try:
            j = json.loads(raw)
            err = j.get("error", j.get("detail", j))
            msg = err.get("message", err) if isinstance(err, dict) else err
        except ValueError:
            pass
        ex = AIError("%s → HTTP %d: %s" % (url.split("?")[0].split("/")[2], e.code, str(msg)[:400]))
        ex.status = e.code
        raise ex
    except (urllib.error.URLError, OSError) as e:
        raise AIError("Could not reach %s (%s)" % (url.split("/")[2], getattr(e, "reason", e)))


def _json(method, url, headers=None, body=None, timeout=180):
    _, _, raw = http(method, url, headers, body, timeout)
    try:
        return json.loads(raw.decode("utf-8"))
    except ValueError:
        raise AIError("Unexpected (non-JSON) reply from %s" % url.split("/")[2])


def _cached(name, fn, ttl=600):
    hit = _cache.get(name)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _cache[name] = (time.time(), val)
    return val


def multipart(fields, files):
    b = "----iprps" + uuid.uuid4().hex
    out = []
    for k, v in fields.items():
        out.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (b, k, v)).encode())
    for k, (fname, mime, data) in files.items():
        out.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n"
                    % (b, k, fname, mime)).encode() + data + b"\r\n")
    out.append(("--%s--\r\n" % b).encode())
    return b"".join(out), "multipart/form-data; boundary=" + b


def pcm_to_wav(pcm, rate=24000, channels=1):
    hdr = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + len(pcm), b"WAVE", b"fmt ", 16, 1, channels, rate,
                      rate * channels * 2, channels * 2, 16, b"data", len(pcm))
    return hdr + pcm


# ---------------------------------------------------------------- voices
def voices(provider):
    if provider == "gemini":
        out = [{"id": n, "name": n, "desc": d} for n, d in GEMINI_VOICES]
        key = store.load_config()["keys"].get("gemini")
        if key:
            try:  # extended voice library (newer TTS models); ignore if the endpoint is not there
                j = _cached("gv", lambda: _json("GET", GEMINI + "/voices?pageSize=1000", {"x-goog-api-key": key}, timeout=20))
                seen = {v["id"].lower() for v in out}
                for v in j.get("voices", []):
                    vid = (v.get("name") or v.get("voiceId") or v.get("id") or "").split("/")[-1]
                    if vid and vid.lower() not in seen:
                        out.append({"id": vid, "name": v.get("displayName") or vid,
                                    "desc": v.get("description") or ", ".join(v.get("languageCodes", [])[:2])})
            except AIError:
                pass
        return out
    if provider == "xai":
        key = store.load_config()["keys"].get("xai")
        if key:
            try:
                j = _cached("xv", lambda: _json("GET", XAI + "/tts/voices", {"Authorization": "Bearer " + key}, timeout=20))
                vs = [{"id": v.get("voice_id") or v.get("id"), "name": v.get("name") or v.get("voice_id"),
                       "desc": v.get("language") or ""} for v in j.get("voices", [])]
                if vs:
                    return vs
            except AIError:
                pass
        return [{"id": i, "name": n, "desc": "built-in"} for i, n in XAI_VOICES]
    if provider == "elevenlabs":
        key = _key("elevenlabs", "ElevenLabs")

        def load():
            out, token = [], ""
            for _ in range(10):
                j = _json("GET", ELEVEN + "/v2/voices?page_size=100" + ("&next_page_token=" + token if token else ""),
                          {"xi-api-key": key}, timeout=30)
                for v in j.get("voices", []):
                    lab = v.get("labels") or {}
                    out.append({"id": v["voice_id"], "name": v.get("name", v["voice_id"]),
                                "desc": ", ".join(x for x in (v.get("category"), lab.get("gender"), lab.get("accent")) if x),
                                "preview": v.get("preview_url") or ""})
                token = j.get("next_page_token") or ""
                if not j.get("has_more") or not token:
                    break
            return out
        return _cached("ev", load)
    raise AIError("unknown voice provider")


# ---------------------------------------------------------------- text to speech
def _gemini_tts(text, voice, style, model):
    key = _key("gemini", "Gemini")
    cfg_model = model or store.load_config().get("geminiTtsModel") or GEMINI_TTS_MODELS[0]
    models = [cfg_model] + [m for m in GEMINI_TTS_MODELS if m != cfg_model]
    voice = voice or "Kore"

    def new_style():
        part = {"text": text}
        if style:
            part["speech_metadata"] = {"style": style}
        return {"contents": [{"role": "user", "parts": [part]}],
                "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"voice": voice}}}}

    def classic():
        t = ("Say in a %s voice: %s" % (style, text)) if style else text
        return {"contents": [{"parts": [{"text": t}]}],
                "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {
                    "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}

    last = None
    for m in models:
        bodies = [new_style, classic] if "3.8" in m else [classic, new_style]
        for mk in bodies:
            try:
                j = _json("POST", "%s/models/%s:generateContent" % (GEMINI, m), {"x-goog-api-key": key}, mk())
            except AIError as e:
                last = e
                if getattr(e, "status", 0) == 400:
                    continue        # request shape differs between model generations → try the other one
                if getattr(e, "status", 0) == 404:
                    break           # model not available on this key → next model
                raise
            for cand in j.get("candidates", []):
                for part in cand.get("content", {}).get("parts", []):
                    d = part.get("inlineData") or part.get("inline_data")
                    if d and d.get("data"):
                        raw = base64.b64decode(d["data"])
                        mime = (d.get("mimeType") or d.get("mime_type") or "").lower()
                        if "wav" in mime:
                            return raw, "wav"
                        if "mpeg" in mime or "mp3" in mime:
                            return raw, "mp3"
                        rate = 24000
                        if "rate=" in mime:
                            try:
                                rate = int(mime.split("rate=")[1].split(";")[0])
                            except ValueError:
                                pass
                        return pcm_to_wav(raw, rate), "wav"
            last = AIError("Gemini returned no audio (the text may have been blocked).")
    raise last or AIError("Gemini TTS failed")


def _xai_tts(text, voice, style, model):
    key = _key("xai", "xAI (Grok)")
    body = {"text": text[:15000], "voice_id": voice or "eve", "language": "auto",
            "output_format": {"codec": "mp3", "sample_rate": 44100, "bit_rate": 128000}}
    try:
        _, ctype, raw = http("POST", XAI + "/tts", {"Authorization": "Bearer " + key}, body)
    except AIError as e:
        if getattr(e, "status", 0) not in (400, 422):
            raise
        body = {"text": text[:15000], "voice_id": voice or "eve", "language": "en"}
        _, ctype, raw = http("POST", XAI + "/tts", {"Authorization": "Bearer " + key}, body)
    if "json" in ctype:
        j = json.loads(raw.decode("utf-8"))
        raw = base64.b64decode(j.get("audio", ""))
        ctype = j.get("content_type", "audio/mpeg")
    if not raw:
        raise AIError("Grok returned no audio.")
    return raw, ("wav" if "wav" in ctype else "mp3")


def _eleven_tts(text, voice, style, model):
    key = _key("elevenlabs", "ElevenLabs")
    if not voice:
        raise AIError("Pick an ElevenLabs voice for this cast member first.")
    body = {"text": text, "model_id": model or store.load_config().get("elevenModel") or "eleven_multilingual_v2"}
    _, _, raw = http("POST", "%s/v1/text-to-speech/%s?output_format=mp3_44100_128" % (ELEVEN, voice),
                     {"xi-api-key": key, "Accept": "audio/mpeg"}, body)
    return raw, "mp3"


def tts(provider, text, voice="", style="", model=""):
    text = (text or "").strip()
    if not text:
        raise AIError("Nothing to say.")
    fn = {"gemini": _gemini_tts, "xai": _xai_tts, "elevenlabs": _eleven_tts}.get(provider)
    if not fn:
        raise AIError("unknown voice provider")
    return fn(text, voice, style, model)


# ---------------------------------------------------------------- brains
def models(provider):
    cfg = store.load_config()
    if provider == "gemini":
        key = _key("gemini", "Gemini")
        j = _cached("gm", lambda: _json("GET", GEMINI + "/models?pageSize=1000", {"x-goog-api-key": key}, timeout=20))
        out = []
        for m in j.get("models", []):
            n = m.get("name", "").split("/")[-1]
            if "generateContent" in m.get("supportedGenerationMethods", ["generateContent"]) and \
                    not any(x in n for x in ("tts", "image", "embedding", "live", "audio", "veo", "imagen", "aqa", "robotics")):
                out.append(n)
        return sorted(set(out), reverse=True)
    if provider == "xai":
        key = _key("xai", "xAI (Grok)")
        j = _cached("xm", lambda: _json("GET", XAI + "/models", {"Authorization": "Bearer " + key}, timeout=20))
        return sorted([m["id"] for m in j.get("data", []) if not any(x in m["id"] for x in ("image", "imagine", "video", "voice"))], reverse=True)
    if provider == "anthropic":
        key = _key("anthropic", "Anthropic (Claude)")
        j = _cached("am", lambda: _json("GET", ANTHROPIC + "/models?limit=100",
                                        {"x-api-key": key, "anthropic-version": "2023-06-01"}, timeout=20))
        return [m["id"] for m in j.get("data", [])]
    if provider == "ollama":
        j = _json("GET", cfg["ollamaUrl"].rstrip("/") + "/api/tags", timeout=8)
        return [m["name"] for m in j.get("models", [])]
    raise AIError("unknown brain provider")


def _pick(provider, model, prefer):
    if model:
        return model
    ms = models(provider)
    if not ms:
        raise AIError("No %s models are available to this key." % provider)
    for p in prefer:
        for m in ms:
            if p in m:
                return m
    return ms[0]


def chat(provider, model, system, turns, max_tokens=500):
    """turns: [{'role': 'user'|'assistant', 'text': str}] → reply text."""
    cfg = store.load_config()
    if provider == "gemini":
        key = _key("gemini", "Gemini")
        model = _pick("gemini", model, ["flash"])
        body = {"systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "model" if t["role"] == "assistant" else "user", "parts": [{"text": t["text"]}]} for t in turns],
                "generationConfig": {"maxOutputTokens": max(max_tokens, 2000), "temperature": 0.9}}
        j = _json("POST", "%s/models/%s:generateContent" % (GEMINI, model), {"x-goog-api-key": key}, body)
        parts = (j.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
        txt = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    elif provider == "xai":
        key = _key("xai", "xAI (Grok)")
        model = _pick("xai", model, ["fast", "grok"])
        body = {"model": model, "messages": [{"role": "system", "content": system}] +
                [{"role": t["role"], "content": t["text"]} for t in turns]}
        j = _json("POST", XAI + "/chat/completions", {"Authorization": "Bearer " + key}, body)
        txt = j["choices"][0]["message"].get("content") or ""
    elif provider == "anthropic":
        key = _key("anthropic", "Anthropic (Claude)")
        model = _pick("anthropic", model, ["haiku", "sonnet"])
        body = {"model": model, "max_tokens": max_tokens, "system": system,
                "messages": [{"role": t["role"], "content": t["text"]} for t in turns]}
        j = _json("POST", ANTHROPIC + "/messages", {"x-api-key": key, "anthropic-version": "2023-06-01"}, body)
        txt = "".join(b.get("text", "") for b in j.get("content", []) if b.get("type") == "text")
    elif provider == "ollama":
        model = _pick("ollama", model, [])
        body = {"model": model, "stream": False, "messages": [{"role": "system", "content": system}] +
                [{"role": t["role"], "content": t["text"]} for t in turns]}
        j = _json("POST", cfg["ollamaUrl"].rstrip("/") + "/api/chat", None, body, timeout=300)
        txt = j.get("message", {}).get("content", "")
    else:
        raise AIError("unknown brain provider")
    txt = (txt or "").strip()
    if not txt:
        raise AIError("The model returned an empty reply.")
    return txt


# ---------------------------------------------------------------- speech to text
def to_mp3(raw):
    """Browser push-to-talk audio (webm/opus) → small mono mp3 every provider accepts."""
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "in.bin"), os.path.join(d, "out.mp3")
        with open(src, "wb") as f:
            f.write(raw)
        r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", dst],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode != 0:
            raise AIError("Could not read the push-to-talk audio.")
        with open(dst, "rb") as f:
            return f.read()


def stt(mp3, provider=None):
    provider = provider or store.load_config().get("sttProvider") or "gemini"
    if provider == "gemini":
        key = _key("gemini", "Gemini")
        model = _pick("gemini", "", ["flash"])
        body = {"contents": [{"role": "user", "parts": [
            {"text": "Transcribe this audio verbatim. Output only the spoken words, nothing else. "
                     "If there is no speech, output an empty line."},
            {"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3).decode()}}]}],
            "generationConfig": {"temperature": 0}}
        j = _json("POST", "%s/models/%s:generateContent" % (GEMINI, model), {"x-goog-api-key": key}, body)
        parts = (j.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
    if provider == "xai":
        key = _key("xai", "xAI (Grok)")
        body, ctype = multipart({}, {"file": ("talk.mp3", "audio/mpeg", mp3)})
        j = _json("POST", XAI + "/stt", {"Authorization": "Bearer " + key, "Content-Type": ctype}, body)
        return (j.get("text") or "").strip()
    if provider == "elevenlabs":
        key = _key("elevenlabs", "ElevenLabs")
        body, ctype = multipart({"model_id": "scribe_v1"}, {"file": ("talk.mp3", "audio/mpeg", mp3)})
        j = _json("POST", ELEVEN + "/v1/speech-to-text", {"xi-api-key": key, "Content-Type": ctype}, body)
        return (j.get("text") or "").strip()
    raise AIError("unknown speech-to-text provider")


# ---------------------------------------------------------------- a full turn
def system_prompt(show, ep, cast):
    ai = cast.get("ai") or {}
    others = [c for c in show.get("cast", []) if c["id"] != cast["id"]]
    who = ", ".join("%s (%s%s)" % (c["name"], c.get("role", "guest"), ", AI" if c.get("kind") == "ai" else "") for c in others)
    return "\n".join(x for x in [
        "You are %s, the %s of the podcast \"%s\"." % (cast["name"], {"cohost": "co-host"}.get(cast.get("role"), "guest"), show.get("title", "")),
        ("About the show: " + show["description"]) if show.get("description") else "",
        ("Today's episode: \"%s\". %s" % (ep.get("title", ""), (ep.get("description") or "")[:600])) if ep else "",
        ("Also on the show: " + who + ".") if who else "",
        ("Your persona and background: " + ai["persona"]) if ai.get("persona") else "",
        "You are speaking live on air and your words are converted to speech, so: talk naturally and conversationally, "
        "keep most turns to 1–4 sentences unless asked for more, never use markdown, lists, emoji, stage directions "
        "or speaker labels, and never read out URLs symbol by symbol. React to what was just said, add something of "
        "your own, and hand the conversation back. You are an AI and say so plainly if anyone asks.",
    ] if x)


def turn(show, ep, cast, mode, cue, heard, history):
    """Returns (text, audio_bytes, ext)."""
    ai = cast.get("ai") or {}
    voice = ai.get("voice") or {}
    if mode == "say":
        text = cue
    else:
        lines = []
        for h in (history or [])[-40:]:
            lines.append("%s: %s" % (h.get("who", "?"), h.get("text", "")))
        convo = "\n".join(lines) or "(nothing yet — this is the start of the recording)"
        ask = "Conversation so far:\n%s\n\n" % convo
        if heard:
            ask += "Just said on air: \"%s\"\n" % heard
        if cue:
            ask += "Producer note (not heard by listeners): %s\n" % cue
        ask += "\nReply with only %s's next spoken line." % cast["name"]
        brain = ai.get("brain") or {}
        text = chat(brain.get("provider") or "gemini", brain.get("model") or "", system_prompt(show, ep, cast),
                    [{"role": "user", "text": ask}])
    audio, ext = tts(voice.get("provider") or "gemini", text, voice.get("voiceId") or "", voice.get("style") or "",
                     voice.get("model") or "")
    return text, audio, ext
