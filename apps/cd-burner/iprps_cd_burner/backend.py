"""IPRPS CD Burner: the burning engine.

Everything here is plain Python with no GUI, so it can be tested and reused
from the command line. The real work is done by the standard IPRPS OS tools:

  * xorriso  (libisoburn)  data discs, ISO images, erasing, disc info, verify
  * cdrskin  (libburn)     audio CDs
  * ffmpeg / ffprobe       converting music files to CD audio, track lengths

Copyright (C) 2026 Mythical Legends Publishing, LLC
License: GNU GPL v2 (see LICENSE)
"""

from __future__ import annotations

import glob
import os
import re
import shutil
import signal
import struct
import subprocess
import tempfile
import threading
import wave
from dataclasses import dataclass, field
from typing import Callable, Iterable, List, Optional

SECTOR = 2048                     # bytes in one data sector
CD_AUDIO_SECTORS_PER_SEC = 75     # CD audio sectors per second of music
CD_AUDIO_BYTES_PER_SEC = 44100 * 2 * 2

AUDIO_EXTENSIONS = (".mp3", ".flac", ".ogg", ".oga", ".opus", ".wav", ".m4a",
                    ".aac", ".wma", ".aiff", ".aif")

# Standard capacities, used when no disc is in the drive.
CAPACITIES = {
    "CD 700 MB": 359_846 * SECTOR,
    "DVD 4.7 GB": 2_295_104 * SECTOR,
    "DVD DL 8.5 GB": 4_173_824 * SECTOR,
    "Blu-ray 25 GB": 12_219_392 * SECTOR,
}
AUDIO_CAPACITIES_MIN = {"74 minutes": 74, "80 minutes": 80}


# --------------------------------------------------------------------------
# Tools
# --------------------------------------------------------------------------

def find_tool(name: str) -> Optional[str]:
    """Path of a command-line tool, or None if it isn't installed."""
    override = os.environ.get("IPRPS_BURNER_" + name.upper().replace("-", "_"))
    if override:
        return override if os.access(override, os.X_OK) else None
    return shutil.which(name)


def missing_tools() -> dict:
    """{tool: what it is needed for} for every tool that isn't installed."""
    needs = {
        "xorriso": "data discs, disc images, erasing and disc info (BLFS: libisoburn)",
        "cdrskin": "audio CDs (BLFS: libburn)",
        "ffmpeg": "converting MP3/FLAC/OGG files for audio CDs (BLFS: FFmpeg)",
        "ffprobe": "reading track lengths (comes with FFmpeg)",
    }
    return {t: why for t, why in needs.items() if not find_tool(t)}


# --------------------------------------------------------------------------
# Drives and discs
# --------------------------------------------------------------------------

@dataclass
class Drive:
    dev: str            # e.g. /dev/sr0
    label: str          # e.g. "HL-DT-ST DVDRAM GH24NSD1 (/dev/sr0)"
    accessible: bool    # can this user read and write it?


def _sysfs(path: str) -> str:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read().strip()
    except OSError:
        return ""


def list_drives() -> List[Drive]:
    """Optical drives on this computer (/dev/sr*), with their model names."""
    drives = []
    pattern = os.environ.get("IPRPS_BURNER_DEV_GLOB", "/dev/sr[0-9]*")
    for dev in sorted(glob.glob(pattern)):
        name = os.path.basename(dev)
        vendor = _sysfs(f"/sys/block/{name}/device/vendor")
        model = _sysfs(f"/sys/block/{name}/device/model")
        title = " ".join(x for x in (vendor, model) if x) or "Optical drive"
        drives.append(Drive(dev, f"{title} ({dev})",
                            os.access(dev, os.R_OK | os.W_OK)))
    return drives


@dataclass
class DiscInfo:
    present: bool = False
    media: str = ""             # "CD-R", "DVD+RW", ...
    status: str = ""            # "is blank", "is written , is appendable", ...
    blank: bool = False
    appendable: bool = False
    rewritable: bool = False
    free_sectors: int = 0
    used_sectors: int = 0
    sessions: list = field(default_factory=list)   # [(start, size, volid)]
    volume_id: str = ""
    summary: str = ""
    error: str = ""

    @property
    def free_bytes(self) -> int:
        return self.free_sectors * SECTOR

    @property
    def is_cd(self) -> bool:
        return self.media.upper().startswith("CD")

    @property
    def audio_free_seconds(self) -> float:
        # A blank CD's free sectors convert straight to audio time.
        return self.free_sectors / CD_AUDIO_SECTORS_PER_SEC

    def describe(self) -> str:
        if self.error:
            return self.error
        if not self.present:
            return "No disc in the drive."
        state = "blank" if self.blank else ("written, can add more" if self.appendable
                                              else "written and closed")
        text = f"{self.media or 'Disc'}: {state}"
        if self.free_sectors:
            text += f"; {human_size(self.free_bytes)} free"
            if self.is_cd and self.blank:
                text += f" ({format_duration(self.audio_free_seconds)} of music)"
        if self.volume_id:
            text += f"; label '{self.volume_id}'"
        return text


_MEDIA_RE = re.compile(r"^Media current:\s*(.+)$", re.M)
_STATUS_RE = re.compile(r"^Media status\s*:\s*(.+)$", re.M)
_SUMMARY_RE = re.compile(r"^Media summary:\s*(.+)$", re.M)
_SPACE_RE = re.compile(r"^Media space\s*:\s*(\d+)s", re.M)
_BLOCKS_RE = re.compile(r"^Media blocks\s*:\s*(\d+) readable\s*,\s*(\d+) writable", re.M)
_SESSION_RE = re.compile(r"^ISO session\s*:\s*\d+\s*,\s*(\d+)\s*,\s*(\d+)s\s*,\s*(.*)$", re.M)
_VOLID_RE = re.compile(r"^Volume id\s*:\s*'(.*)'", re.M)


def parse_disc_info(text: str) -> DiscInfo:
    """Turn the output of `xorriso -outdev DEV -toc -tell_media_space` into DiscInfo."""
    info = DiscInfo()
    m = _MEDIA_RE.search(text)
    if not m or "is not present" in m.group(1).lower() or "no media" in text.lower():
        return info
    info.present = True
    info.media = m.group(1).split(",")[0].strip()
    up = m.group(1).upper()
    info.rewritable = any(k in up for k in ("RW", "BD-RE", "DVD-RAM"))
    s = _STATUS_RE.search(text)
    info.status = s.group(1).strip() if s else ""
    info.blank = "is blank" in info.status
    info.appendable = "is appendable" in info.status or info.blank
    sm = _SUMMARY_RE.search(text)
    info.summary = sm.group(1).strip() if sm else ""
    sp = _SPACE_RE.search(text)
    if sp:
        info.free_sectors = int(sp.group(1))
    else:
        b = _BLOCKS_RE.search(text)
        if b:
            info.free_sectors = int(b.group(2))
    for start, size, vol in _SESSION_RE.findall(text):
        info.sessions.append((int(start), int(size), vol.strip()))
    if info.sessions:
        info.used_sectors = max(a + b for a, b, _ in info.sessions)
    v = _VOLID_RE.search(text)
    info.volume_id = v.group(1) if v else (info.sessions[-1][2] if info.sessions else "")
    return info


def disc_info(dev: str, timeout: int = 60) -> DiscInfo:
    """Ask the drive what disc is in it."""
    xorriso = find_tool("xorriso")
    if not xorriso:
        return DiscInfo(error="xorriso isn't installed, so the disc can't be read.")
    try:
        p = subprocess.run([xorriso, "-outdev", dev, "-toc", "-tell_media_space"],
                           capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return DiscInfo(error="The drive didn't answer in time. Wait for it to settle and try again.")
    out = p.stdout + "\n" + p.stderr
    if "Permission denied" in out or (os.path.exists(dev) and not os.access(dev, os.R_OK | os.W_OK)):
        return DiscInfo(error=permission_hint(dev))
    if "Cannot open busy device" in out or "is busy" in out.lower():
        return DiscInfo(error="The drive is busy. Close any app that is using the disc and try again.")
    return parse_disc_info(out)


def permission_hint(dev: str) -> str:
    return (f"You don't have permission to use {dev}. Add your account to the "
            f"'cdrom' group (sudo usermod -aG cdrom $USER), then log out and back in.")


# --------------------------------------------------------------------------
# Sizes and times
# --------------------------------------------------------------------------

def human_size(n: float) -> str:
    for unit in ("bytes", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "bytes" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def format_duration(seconds: float) -> str:
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def path_size(path: str) -> int:
    """Bytes a file or folder will take, rounded up to whole sectors per file."""
    def rounded(n):
        return -(-n // SECTOR) * SECTOR
    if os.path.isfile(path):
        return rounded(os.path.getsize(path))
    total = 0
    for root, dirs, files in os.walk(path):
        total += SECTOR * (1 + len(dirs) // 40)       # directory records
        for f in files:
            try:
                total += rounded(os.lstat(os.path.join(root, f)).st_size)
            except OSError:
                pass
    return total


def estimate_image_size(paths: Iterable[str]) -> int:
    """Rough size of an ISO image holding these files (plus file-system overhead)."""
    return sum(path_size(p) for p in paths) + 600 * 1024


# --------------------------------------------------------------------------
# Volume labels and disc layout
# --------------------------------------------------------------------------

def clean_volume_id(text: str) -> str:
    """A disc label that every computer can read: A-Z, 0-9 and _, up to 32 characters."""
    text = re.sub(r"[^A-Za-z0-9_]+", "_", text.strip()).strip("_").upper()
    return (text or "IPRPS_DISC")[:32]


def unique_targets(paths: Iterable[str]) -> List[tuple]:
    """[(source, /name on disc)], renaming duplicates as 'name (2)'."""
    used, out = set(), []
    for p in paths:
        base = os.path.basename(os.path.normpath(p)) or "disc"
        name, ext = os.path.splitext(base) if os.path.isfile(p) else (base, "")
        target, n = base, 2
        while target.lower() in used:
            target = f"{name} ({n}){ext}"
            n += 1
        used.add(target.lower())
        out.append((p, "/" + target))
    return out


# --------------------------------------------------------------------------
# Command builders (kept separate so they can be tested)
# --------------------------------------------------------------------------

def _speed(fastest: bool) -> str:
    return "max" if fastest else "min"


def data_disc_command(dev: str, paths: List[str], volume_id: str, *,
                      simulate=False, close=False, fastest=True,
                      to_image: Optional[str] = None) -> List[str]:
    """xorriso command that burns files to a disc, or writes them to an ISO image file.

    On a disc that already has files and isn't closed, the files are added as a
    new session; what is already there stays readable.
    """
    cmd = [find_tool("xorriso") or "xorriso", "-abort_on", "FAILURE",
           "-return_with", "SORRY", "32", "-md5", "on"]
    if to_image:
        cmd += ["-outdev", "stdio:" + to_image, "-blank", "as_needed"]
    else:
        cmd += ["-dev", dev, "-speed", _speed(fastest)]
        if simulate:
            cmd += ["-dummy", "on"]
        cmd += ["-close", "on" if close else "off"]
    cmd += ["-volid", clean_volume_id(volume_id), "-joliet", "on",
            "-compliance", "iso_9660_level=3:long_names",
            "-publisher", "IPRPS OS", "-application_id", "IPRPS CD Burner"]
    for src, dest in unique_targets(paths):
        cmd += ["-map", src, dest]
    cmd += ["-commit"]
    return cmd


def verify_command(dev: str) -> List[str]:
    """xorriso command that checks every file on a disc against its MD5 checksum."""
    return [find_tool("xorriso") or "xorriso", "-md5", "on", "-indev", dev,
            "-check_md5_r", "SORRY", "/", "--"]


def image_burn_command(dev: str, image: str, *, simulate=False, fastest=True) -> List[str]:
    """xorriso (cdrecord mode) command that writes an ISO image to a disc as-is."""
    cmd = [find_tool("xorriso") or "xorriso", "-as", "cdrecord", "-v", f"dev={dev}",
           "blank=as_needed"]
    if simulate:
        cmd.append("-dummy")
    if not fastest:
        cmd.append("speed=1")
    cmd.append(image)
    return cmd


def erase_command(dev: str, full=False) -> List[str]:
    return [find_tool("xorriso") or "xorriso", "-outdev", dev,
            "-blank", "all" if full else "as_needed"]


def eject_command(dev: str) -> List[str]:
    return [find_tool("xorriso") or "xorriso", "-outdev", dev, "-eject", "all"]


def audio_burn_command(dev: str, wavs: List[str], *, simulate=False, fastest=True,
                       gap_seconds: int = 2, cdtext_sheet: Optional[str] = None) -> List[str]:
    """cdrskin command that burns CD audio WAV files as an audio CD (disc-at-once).

    The first track always gets the standard 2-second lead-in. gap_seconds is the
    silence before each later track (0 for live albums and DJ mixes).
    """
    cmd = [find_tool("cdrskin") or "cdrskin", "-v", f"dev={dev}", "-dao",
           "blank=as_needed"]
    if simulate:
        cmd.append("-dummy")
    cmd.append("speed=0" if fastest else "speed=1")
    if cdtext_sheet:
        cmd.append(f"input_sheet_v07t={cdtext_sheet}")
    cmd += ["-audio", "-pad"]
    for i, w in enumerate(wavs):
        if i > 0:
            cmd.append(f"sao_pregap={gap_seconds * CD_AUDIO_SECTORS_PER_SEC}"
                       if gap_seconds else "sao_pregap=off")
        cmd.append(w)
    return cmd


def _cdtext_value(s: str) -> str:
    s = re.sub(r"[\r\n\t]+", " ", s).strip()
    return s.encode("latin-1", "replace").decode("latin-1")[:120]


def write_cdtext_sheet(path: str, album: str, artist: str, tracks: List["Track"]):
    """Write a Sony v07t CD-TEXT sheet so players show the album and song names."""
    lines = ["Input Sheet Version = 0.7T", "Text Code = 8859", "Language Code = English",
             f"Album Title = {_cdtext_value(album) or 'IPRPS Audio'}",
             f"Artist Name = {_cdtext_value(artist) or 'Unknown'}"]
    for i, t in enumerate(tracks, 1):
        lines.append(f"Track {i:02d} Title = {_cdtext_value(t.title) or f'Track {i}'}")
        lines.append(f"Track {i:02d} Artist = {_cdtext_value(t.artist or artist) or 'Unknown'}")
    with open(path, "w", encoding="latin-1", errors="replace") as f:
        f.write("\n".join(lines) + "\n")


def ffmpeg_to_cd_command(src: str, dest: str, normalize=False) -> List[str]:
    cmd = [find_tool("ffmpeg") or "ffmpeg", "-nostdin", "-hide_banner", "-y",
           "-i", src, "-vn", "-map_metadata", "-1"]
    if normalize:
        cmd += ["-af", "loudnorm=I=-14:TP=-1.0:LRA=11"]
    cmd += ["-ac", "2", "-ar", "44100", "-sample_fmt", "s16", "-f", "wav",
            "-progress", "pipe:1", "-nostats", dest]
    return cmd


# --------------------------------------------------------------------------
# Audio tracks
# --------------------------------------------------------------------------

@dataclass
class Track:
    path: str
    title: str
    seconds: float
    artist: str = ""


def is_cd_wav(path: str) -> bool:
    """True if a file is already 44.1 kHz, 16-bit stereo WAV (no conversion needed)."""
    try:
        with wave.open(path, "rb") as w:
            return (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (2, 2, 44100)
    except (wave.Error, EOFError, OSError):
        return False


def probe_track(path: str) -> Track:
    """Title and length of a music file (ffprobe, or Python's wave module for WAV)."""
    title = os.path.splitext(os.path.basename(path))[0]
    artist = ""
    seconds = 0.0
    ffprobe = find_tool("ffprobe")
    if ffprobe:
        try:
            p = subprocess.run(
                [ffprobe, "-v", "error", "-show_entries", "format=duration:format_tags=title,artist",
                 "-of", "default=noprint_wrappers=1", path],
                capture_output=True, text=True, timeout=30)
            tags = {}
            for line in p.stdout.splitlines():
                k, _, v = line.partition("=")
                tags[k.strip().lower()] = v.strip()
            seconds = float(tags.get("duration") or 0)
            title = tags.get("tag:title") or tags.get("title") or title
            artist = tags.get("tag:artist") or tags.get("artist") or ""
        except (subprocess.TimeoutExpired, ValueError, OSError):
            pass
    if not seconds:
        try:
            with wave.open(path, "rb") as w:
                seconds = w.getnframes() / float(w.getframerate())
        except (wave.Error, EOFError, OSError):
            pass
    return Track(path, title, seconds, artist)


def audio_total_seconds(tracks: List[Track], gap_seconds: int = 2) -> float:
    if not tracks:
        return 0.0
    return sum(t.seconds for t in tracks) + 2 + gap_seconds * (len(tracks) - 1)


# --------------------------------------------------------------------------
# Disc to image copy (data discs)
# --------------------------------------------------------------------------

def iso_size_from_device(dev: str, info: Optional[DiscInfo] = None) -> int:
    """Bytes to copy from a data disc: the end of its last session, or the
    size recorded in the ISO 9660 volume descriptor."""
    if info and info.used_sectors:
        return info.used_sectors * SECTOR
    with open(dev, "rb") as f:
        f.seek(16 * SECTOR)
        pvd = f.read(SECTOR)
    if pvd[1:6] != b"CD001":
        raise ValueError("This disc doesn't hold a data file system (is it an audio CD?).")
    return struct.unpack_from("<I", pvd, 80)[0] * SECTOR


# --------------------------------------------------------------------------
# Running jobs
# --------------------------------------------------------------------------

_PCT_RE = re.compile(r"(\d{1,3}(?:\.\d+)?)\s*%")
_CDRSKIN_RE = re.compile(r"Track\s+(\d+):\s+(\d+)\s+of\s+(\d+)\s+MB written")
_FFMPEG_TIME_RE = re.compile(r"out_time_(?:us|ms)=(\d+)")


def xorriso_progress(line: str) -> Optional[float]:
    """Percent done (0-100) from an xorriso progress line, or None."""
    if "UPDATE" in line and ("Writing" in line or "Blanking" in line or "Formatting" in line
                             or "Checking" in line or "%" in line):
        m = _PCT_RE.search(line)
        if m:
            return min(100.0, float(m.group(1)))
    return None


def cdrskin_progress(line: str, track_mb: List[int]) -> Optional[float]:
    """Overall percent done from a cdrskin 'Track 03: 12 of 45 MB written' line."""
    m = _CDRSKIN_RE.search(line)
    if not m:
        return None
    n, done, size = int(m.group(1)), int(m.group(2)), int(m.group(3))
    total = sum(track_mb) or 1
    before = sum(track_mb[: n - 1])
    return min(100.0, 100.0 * (before + min(done, size)) / total)


class Cancelled(Exception):
    pass


class JobRunner:
    """Runs one external command at a time and reports its output line by line.

    log(text) and progress(fraction or None) are called from the worker thread;
    the GUI wraps them with GLib.idle_add.
    """

    def __init__(self, log: Callable[[str], None], progress: Callable[[Optional[float]], None]):
        self.log = log
        self.progress = progress
        self._proc: Optional[subprocess.Popen] = None
        self._cancel = threading.Event()

    def cancel(self):
        self._cancel.set()
        p = self._proc
        if p and p.poll() is None:
            try:
                p.send_signal(signal.SIGINT)   # xorriso and cdrskin stop cleanly on SIGINT
            except OSError:
                pass

    @property
    def cancelled(self) -> bool:
        return self._cancel.is_set()

    def check(self):
        if self._cancel.is_set():
            raise Cancelled()

    def run(self, cmd: List[str], parse: Optional[Callable[[str], Optional[float]]] = None,
            scale=(0.0, 1.0)) -> int:
        """Run cmd; map parse()'s 0-100 values into the [scale] part of the bar."""
        self.check()
        self.log("$ " + " ".join(_quote(c) for c in cmd))
        self._proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                      stdin=subprocess.DEVNULL, text=True, bufsize=1,
                                      errors="replace")
        lo, hi = scale
        assert self._proc.stdout is not None
        buf = ""
        while True:
            ch = self._proc.stdout.read(1)
            if not ch:
                break
            if ch in "\r\n":
                line, buf = buf.strip(), ""
                if not line:
                    continue
                pct = parse(line) if parse else None
                if pct is not None:
                    self.progress(lo + (hi - lo) * pct / 100.0)
                if not _is_noise(line):
                    self.log(line)
            else:
                buf += ch
        rc = self._proc.wait()
        self._proc = None
        if self._cancel.is_set():
            raise Cancelled()
        return rc


def _is_noise(line: str) -> bool:
    # ffmpeg -progress key=value lines and repeated progress lines would flood the log.
    if re.match(r"^[a-z_]+=", line):
        return True
    return bool(_CDRSKIN_RE.search(line)) and not line.endswith("written.")


def _quote(s: str) -> str:
    return s if re.match(r"^[\w@%+=:,./-]+$", s) else "'" + s.replace("'", "'\\''") + "'"


# --------------------------------------------------------------------------
# High-level jobs (each runs in a worker thread)
# --------------------------------------------------------------------------

class JobError(Exception):
    pass


def job_burn_data(r: JobRunner, dev: str, paths: List[str], volume_id: str, *,
                  simulate: bool, close: bool, fastest: bool, verify: bool, eject: bool):
    burn_part = (0.0, 0.85 if verify and not simulate else 1.0)
    rc = r.run(data_disc_command(dev, paths, volume_id, simulate=simulate, close=close,
                                 fastest=fastest), xorriso_progress, burn_part)
    if rc != 0:
        raise JobError("Burning failed. See the log for the drive's message.")
    if verify and not simulate:
        r.log("Checking every file on the disc against its checksum...")
        rc = r.run(verify_command(dev), xorriso_progress, (0.85, 1.0))
        if rc != 0:
            raise JobError("The disc was written, but some files didn't match. Don't trust this disc.")
    if eject:
        r.run(eject_command(dev))
    r.progress(1.0)
    return "Simulation finished; nothing was written." if simulate else "The disc is ready."


def job_make_image(r: JobRunner, image: str, paths: List[str], volume_id: str):
    if os.path.exists(image):
        os.unlink(image)
    rc = r.run(data_disc_command("", paths, volume_id, to_image=image), xorriso_progress)
    if rc != 0:
        raise JobError("The disc image couldn't be made. See the log.")
    r.progress(1.0)
    return f"Saved {os.path.basename(image)} ({human_size(os.path.getsize(image))})."


def job_burn_image(r: JobRunner, dev: str, image: str, *, simulate: bool, fastest: bool,
                   eject: bool):
    rc = r.run(image_burn_command(dev, image, simulate=simulate, fastest=fastest),
               xorriso_progress)
    if rc != 0:
        raise JobError("Burning the image failed. See the log.")
    if eject:
        r.run(eject_command(dev))
    r.progress(1.0)
    return "Simulation finished; nothing was written." if simulate else "The disc is ready."


def job_burn_audio(r: JobRunner, dev: str, tracks: List[Track], *, simulate: bool,
                   fastest: bool, normalize: bool, eject: bool, gap_seconds: int = 2,
                   cdtext: bool = True, album: str = "", artist: str = ""):
    work = tempfile.mkdtemp(prefix="iprps-cd-")
    try:
        sheet = None
        if cdtext:
            sheet = os.path.join(work, "cdtext.v07t")
            write_cdtext_sheet(sheet, album, artist, tracks)
        wavs = []
        n = len(tracks)
        for i, t in enumerate(tracks, 1):
            r.check()
            if is_cd_wav(t.path) and not normalize:
                wavs.append(t.path)
                continue
            if not find_tool("ffmpeg"):
                raise JobError(f"'{os.path.basename(t.path)}' needs converting, but FFmpeg isn't installed.")
            dest = os.path.join(work, f"track{i:02d}.wav")
            r.log(f"Preparing track {i} of {n}: {t.title}")
            total_us = max(t.seconds, 0.1) * 1_000_000
            lo, hi = 0.4 * (i - 1) / n, 0.4 * i / n

            def parse(line, total_us=total_us):
                m = _FFMPEG_TIME_RE.search(line)
                return min(100.0, 100.0 * int(m.group(1)) / total_us) if m else None

            if r.run(ffmpeg_to_cd_command(t.path, dest, normalize), parse, (lo, hi)) != 0:
                raise JobError(f"Couldn't convert '{os.path.basename(t.path)}'. See the log.")
            wavs.append(dest)
        track_mb = [max(1, os.path.getsize(w) // (1024 * 1024)) for w in wavs]
        rc = r.run(audio_burn_command(dev, wavs, simulate=simulate, fastest=fastest,
                                      gap_seconds=gap_seconds, cdtext_sheet=sheet),
                   lambda line: cdrskin_progress(line, track_mb), (0.4, 1.0))
        if rc != 0:
            raise JobError("Burning the audio CD failed. See the log.")
        if eject:
            r.run(eject_command(dev))
        r.progress(1.0)
        return ("Simulation finished; nothing was written." if simulate
                else f"Audio CD ready: {n} track{'s' if n != 1 else ''}.")
    finally:
        shutil.rmtree(work, ignore_errors=True)


def job_copy_to_image(r: JobRunner, dev: str, image: str):
    info = disc_info(dev)
    if info.error:
        raise JobError(info.error)
    if not info.present:
        raise JobError("There's no disc in the drive.")
    try:
        total = iso_size_from_device(dev, info)
    except (OSError, ValueError) as e:
        raise JobError(str(e))
    r.log(f"Copying {human_size(total)} from {dev} to {image}")
    done, chunk = 0, 64 * SECTOR
    with open(dev, "rb") as src, open(image, "wb") as dst:
        while done < total:
            r.check()
            data = src.read(min(chunk, total - done))
            if not data:
                raise JobError(f"The disc stopped reading after {human_size(done)}. "
                               "It may be scratched; try cleaning it.")
            dst.write(data)
            done += len(data)
            r.progress(done / total)
    return f"Saved {os.path.basename(image)} ({human_size(total)})."


def job_erase(r: JobRunner, dev: str, full: bool, eject: bool):
    rc = r.run(erase_command(dev, full), xorriso_progress)
    if rc != 0:
        raise JobError("Erasing failed. Only rewritable discs (CD-RW, DVD-RW, DVD+RW, BD-RE) can be erased.")
    if eject:
        r.run(eject_command(dev))
    r.progress(1.0)
    return "The disc is erased and ready to use."
