# IPRPS Podcast Studio

A podcast studio for IPRPS OS and Debian. The Session Master records audio and video shows with a
live mixer, brings in co-hosts and guests from the local network or the internet, adds an AI
co-host or guest, edits on a multitrack timeline, exports, and publishes a feed the podcast
directories accept.

© 2026 Mythical Legends Publishing, LLC. GPL-2.0-only, like the rest of the IPRPS OS repository.

## What it needs

| Needed | Why |
|---|---|
| Python 3.9+ (standard library only, with the `ssl` module) | the studio server |
| ffmpeg + ffprobe | waveforms, ingest, every export |
| openssl | the self-signed certificate for the guest gateway |
| Chromium (ungoogled-chromium is fine) or Firefox | the studio window; guests use any current browser |
| rsync (optional) | publishing to a web server over SSH |
| fontconfig + a TrueType font (optional) | name lower-thirds and audiogram titles on video |

No pip or npm packages, no database.

**IPRPS OS (LFS) note:** the ffmpeg build needs `libx264`, `libmp3lame`, `libopus`, `libvpx` and
`freetype` enabled (`--enable-gpl --enable-libx264 --enable-libmp3lame --enable-libopus
--enable-libvpx --enable-libfreetype`). Debian's ffmpeg package already has them.

## Install

**IPRPS OS:** install **IPRPS Podcast Studio** from IPRPS Updates (package `iprps-podcast-studio`,
recipe in `packages/iprps-podcast-studio/`). It installs to `/opt/iprps/podcast-studio`.

**Debian** (from this folder):

    sudo ./install.sh          # installs missing packages with apt, adds the menu entry
    # or, without root:  ./install.sh --user

**Run without installing**

    python3 server/studio.py --open

Start it from the applications menu ("IPRPS Podcast Studio") or with `iprps-podcast-studio`.
Options: `--port 8765`, `--guest-port 8766`, `--no-guests`, `--guest-http`.

## How it is laid out

| Part | Where | What it holds |
|---|---|---|
| Studio (host) | `http://127.0.0.1:8765` | everything; answers only on this computer |
| Guest gateway | `https://<this-machine>:8766` | join pages only, each behind a personal invite token |
| Shows and recordings | `~/.local/share/iprps-podcast-studio/` | one folder per show, plain JSON + media files |
| Settings and API keys | `~/.config/iprps-podcast-studio/config.json` | mode 600 |

## Using it

1. **Create a show** — title, description, category, owner email (Show details); cover art, logo,
   colors, intro/outro (Brand); co-hosts, guests and AI cast (Cast & AI); pads and music (Soundboard).
2. **Create an episode** and open its **Studio** tab → *Enter studio*.
3. **Invite people** — Studio → Guests gives each person their own link. Co-hosts can also drop
   markers and fire soundboard pads from their page.
4. **Record** — 3-2-1 countdown, pause/resume, `M` drops a chapter marker, keys `1 2 3 … 0 - =`
   fire pads. Every participant is recorded on their own machine at full quality and uploaded in
   3-second chunks, so each person arrives in the editor as a separate, synced track. The studio
   also records the decks/soundboard, each AI line, any screen share, and a full program mix as a
   muted safety track.
5. **Edit** — split (`S`), trim, move between tracks, ripple delete, mark in/out (`I`/`O`) and cut a
   section out of every track at once (`X`), fades, clip levels, per-track 10-band EQ, high-pass,
   compressor, gate and noise reduction, master EQ and loudness target, chapters, video layout,
   undo/redo, branded intro/outro.
6. **Export** — MP3, M4A, WAV, FLAC, MP4 video (grid, spotlight, picture-in-picture, single; 480p to
   1080p, square, vertical) or an MP4 audiogram. Exports are loudness-normalized (−16 LUFS by
   default, −1.5 dB true peak) and tagged with title, cover art and chapters.
7. **Publish** — mark the episode published, then Show → Publish builds `feed.xml`, the media, a
   chapters file and a branded landing page, and copies or uploads them to your web host.

### Mixer and decks

Channel strips for the mic, every remote guest, the AI voice, Deck A, Deck B and the soundboard,
plus a master: fader, mute, pan, peak-hold meter with clip light, and a 10-band graphic equalizer
(31 Hz–16 kHz, ±12 dB, presets) with high-pass filter and compressor on each. Two decks with
play/cue/loop/seek/tempo and a crossfader, a 12-pad soundboard, headphone level, “hear my own
mic”, and auto-ducking of music under voice. Guests receive a mix-minus (they never hear
themselves back).

### Remote guests

* **Same network:** send the *Local network* link. The gateway uses a self-signed certificate, so
  the guest's browser shows a warning once — *Advanced → Proceed*. Open TCP 8766 if a firewall is on.
* **Over the internet:** the guest port has to be reachable from outside. Use any one of: a router
  port-forward to 8766 with a domain name, a VPN/overlay network address, or a tunnel that
  terminates HTTPS (then start with `--guest-http`). Put that address in Settings → *Public address
  for internet guests* and the invite links use it.
* Audio and video travel peer-to-peer (WebRTC). STUN servers are preset; add a TURN server in
  Settings if a guest behind a strict firewall cannot connect.
* Remote guests only ever reach their join page. Shows, files and keys are not served on that port.

### AI co-host or guest

Add one under Cast & AI, choose a **voice** (Gemini TTS by default, Grok, or ElevenLabs) and what it
**thinks with** (Gemini, Grok, Claude, or a local Ollama model such as the IPRPS Oracle), and write a
persona. Paste the API keys in Settings; voices are listed from each service once its key is saved.

In the studio the AI is turn-based: hold **Hold to talk** while anyone speaks (it is transcribed and
answered), type a cue and press **Respond**, or type a line and press **Say exactly**. Its voice
goes to your guests and onto its own track.

### Podcast directories

Directories do not take uploads — they read your RSS feed. The Publish tab checks the feed against
what they require (square 1400–3000 px cover, owner email, category, https address, at least one
episode), gives you the feed address, and lists Apple Podcasts, Spotify, YouTube, Amazon
Music/Audible, iHeartRadio, Podcast Index, Pocket Casts, TuneIn, Pandora, Deezer, Listen Notes,
Player FM, Podchaser and Goodpods with the submission page, steps and a status you track. Each one
needs your own sign-in on its site, once; after that new episodes appear whenever you publish.
Podcast Index can also be submitted directly from the app if you save its API key and secret.

### Backup and archive

Show → Backup & archive makes a single `.ipod.tar.gz` with everything (or settings only), restores
it here or on another machine, archives finished shows out of the library, and duplicates a show's
setup. Set the backup folder in Settings to keep backups on another drive.

## Tests

    tests/smoke.sh                # server: shows, media, renders, feed, backup, access rules
    python3 tests/ai_mock_test.py # AI provider code paths against a local mock
    python3 tests/ui_test.py      # Chrome: host + remote guest + AI + soundboard record, edit, export
                                  # (needs: pip install playwright, and Chrome/Chromium)

## Known limits

* The AI services were exercised against local mocks, not live accounts. Gemini TTS has two request
  formats across model generations; the studio tries the configured model, then the others.
* Noise gate and noise reduction are applied on export, not in the live preview.
* Everyone pauses at slightly different instants over the network; after a pause, nudge a track in
  the editor if it drifts.
* The server keeps running after the window is closed so guests stay connected — use Settings →
  *Quit Podcast Studio* to stop it.
