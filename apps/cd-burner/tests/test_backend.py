"""Tests for the IPRPS CD Burner engine.

Real xorriso writes to "stdio:" image files, which behave like a blank
rewritable disc, so the data, verify, erase and image jobs run for real.
Audio burning uses a stand-in cdrskin that checks its arguments.

Run:  python3 -m unittest discover -s tests -v
"""

import os
import shutil
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from iprps_cd_burner import backend as B  # noqa: E402

HAVE_XORRISO = bool(shutil.which("xorriso"))
HAVE_FFMPEG = bool(shutil.which("ffmpeg"))


class Collect:
    def __init__(self):
        self.lines, self.fracs = [], []

    def runner(self):
        return B.JobRunner(self.lines.append, self.fracs.append)


SAMPLE_TOC = textwrap.dedent("""\
    Drive current: -outdev '/dev/sr0'
    Media current: CD-RW
    Media status : is written , is appendable
    Media blocks : 1536 readable , 300000 writable , 359847 overall
    TOC layout   : Idx ,  sbsector ,       Size , Volume Id
    ISO session  :   1 ,         0 ,      1499s , IPRPS_TEST
    Media summary: 1 session, 1499 data blocks, 2998k data,  585m free
    Volume id    : 'IPRPS_TEST'
    Media space  : 299700s
    """)


class ParsingTests(unittest.TestCase):
    def test_parse_written_cdrw(self):
        d = B.parse_disc_info(SAMPLE_TOC)
        self.assertTrue(d.present and d.appendable and d.rewritable and d.is_cd)
        self.assertFalse(d.blank)
        self.assertEqual(d.free_sectors, 299700)
        self.assertEqual(d.used_sectors, 1499)
        self.assertEqual(d.volume_id, "IPRPS_TEST")

    def test_parse_blank_cdr(self):
        d = B.parse_disc_info("Media current: CD-R\nMedia status : is blank\nMedia space  : 359846s\n")
        self.assertTrue(d.blank and d.appendable and d.is_cd)
        self.assertFalse(d.rewritable)
        self.assertAlmostEqual(d.audio_free_seconds / 60, 79.97, places=1)

    def test_parse_dvd_plus_rw_and_closed(self):
        d = B.parse_disc_info("Media current: DVD+RW\nMedia status : is written , is closed\n")
        self.assertTrue(d.rewritable)
        self.assertFalse(d.appendable)

    def test_parse_no_disc(self):
        d = B.parse_disc_info("Media current: is not present\n")
        self.assertFalse(d.present)
        self.assertEqual(d.describe(), "No disc in the drive.")

    def test_progress_parsers(self):
        self.assertEqual(B.xorriso_progress(
            "xorriso : UPDATE : Writing:      35623s   24.0%   fifo   0%  buf  50%  135.0xD"), 24.0)
        self.assertIsNone(B.xorriso_progress("Media current: CD-R"))
        self.assertAlmostEqual(B.cdrskin_progress("Track 02:   5 of  10 MB written (fifo 100%)",
                                                  [10, 10]), 75.0)

    def test_volume_id_and_targets(self):
        self.assertEqual(B.clean_volume_id("Iron City: Session 3!"), "IRON_CITY_SESSION_3")
        self.assertEqual(B.clean_volume_id(""), "IPRPS_DISC")
        self.assertEqual(len(B.clean_volume_id("x" * 50)), 32)
        with tempfile.TemporaryDirectory() as t:
            a = os.path.join(t, "a", "map.png")
            b = os.path.join(t, "b", "map.png")
            for p in (a, b):
                os.makedirs(os.path.dirname(p))
                open(p, "w").close()
            self.assertEqual([d for _, d in B.unique_targets([a, b])], ["/map.png", "/map (2).png"])

    def test_audio_command(self):
        cmd = B.audio_burn_command("/dev/sr0", ["1.wav", "2.wav"], simulate=True, gap_seconds=0,
                                   cdtext_sheet="/tmp/s.v07t")
        self.assertIn("-dummy", cmd)
        self.assertIn("-dao", cmd)
        self.assertIn("input_sheet_v07t=/tmp/s.v07t", cmd)
        self.assertEqual(cmd[cmd.index("2.wav") - 1], "sao_pregap=off")
        cmd = B.audio_burn_command("/dev/sr0", ["1.wav", "2.wav"])
        self.assertEqual(cmd[cmd.index("2.wav") - 1], "sao_pregap=150")
        self.assertEqual(cmd[cmd.index("1.wav") - 1], "-pad")

    def test_cdtext_sheet(self):
        with tempfile.TemporaryDirectory() as t:
            p = os.path.join(t, "s.v07t")
            B.write_cdtext_sheet(p, "Iron City\nBlues", "IPRPS",
                                 [B.Track("x", "Fog on Pier Nine", 60), B.Track("y", "", 60, "Guest")])
            text = open(p, encoding="latin-1").read()
            self.assertIn("Album Title = Iron City Blues", text)
            self.assertIn("Track 01 Artist = IPRPS", text)
            self.assertIn("Track 02 Title = Track 2", text)
            self.assertIn("Track 02 Artist = Guest", text)

    def test_audio_time(self):
        tracks = [B.Track("a", "a", 60), B.Track("b", "b", 60)]
        self.assertEqual(B.audio_total_seconds(tracks, 2), 124)
        self.assertEqual(B.format_duration(3725), "1:02:05")


@unittest.skipUnless(HAVE_XORRISO, "xorriso not installed")
class XorrisoJobs(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.mkdtemp()
        self.src = os.path.join(self.t, "Campaigns")
        os.makedirs(os.path.join(self.src, "Maps"))
        with open(os.path.join(self.src, "Maps", "harbor.png"), "wb") as f:
            f.write(os.urandom(500_000))
        with open(os.path.join(self.t, "notes.txt"), "w") as f:
            f.write("Fog on Pier Nine\n")
        self.disc = os.path.join(self.t, "disc.img")
        self.dev = "stdio:" + self.disc

    def tearDown(self):
        shutil.rmtree(self.t, ignore_errors=True)

    def ls(self, dev):
        p = subprocess.run(["xorriso", "-indev", dev, "-find", "/", "-type", "f"],
                           capture_output=True, text=True)
        return sorted(l.strip().strip("'") for l in p.stdout.splitlines() if l.startswith("'"))

    def test_burn_verify_then_add_session(self):
        c = Collect()
        msg = B.job_burn_data(c.runner(), self.dev, [self.src], "First Session", simulate=False,
                              close=False, fastest=True, verify=True, eject=False)
        self.assertEqual(msg, "The disc is ready.")
        self.assertIn("File contents and their MD5 checksums match.", "\n".join(c.lines))
        self.assertEqual(c.fracs[-1], 1.0)
        info = B.parse_disc_info(subprocess.run(["xorriso", "-outdev", self.dev, "-toc",
                                                 "-tell_media_space"], capture_output=True,
                                                text=True).stdout)
        self.assertEqual(info.volume_id, "FIRST_SESSION")
        # Second burn adds a file and keeps the first one.
        B.job_burn_data(Collect().runner(), self.dev, [os.path.join(self.t, "notes.txt")], "Second",
                        simulate=False, close=False, fastest=True, verify=True, eject=False)
        self.assertEqual(self.ls(self.dev), ["/Campaigns/Maps/harbor.png", "/notes.txt"])

    def test_make_image_and_copy_back(self):
        iso = os.path.join(self.t, "out.iso")
        B.job_make_image(Collect().runner(), iso, [self.src, os.path.join(self.t, "notes.txt")],
                         "Archive")
        self.assertEqual(self.ls("stdio:" + iso), ["/Campaigns/Maps/harbor.png", "/notes.txt"])
        # Treat the ISO file as the "disc in the drive" and copy it to a new image.
        copy = os.path.join(self.t, "copy.iso")
        msg = B.job_copy_to_image(Collect().runner(), iso, copy)
        self.assertTrue(msg.startswith("Saved copy.iso"), msg)
        self.assertEqual(self.ls("stdio:" + copy), self.ls("stdio:" + iso))

    def test_burn_image_and_erase(self):
        iso = os.path.join(self.t, "out.iso")
        B.job_make_image(Collect().runner(), iso, [self.src], "IMG")
        B.job_burn_image(Collect().runner(), self.dev, iso, simulate=False, fastest=True, eject=False)
        self.assertEqual(self.ls(self.dev), ["/Campaigns/Maps/harbor.png"])
        B.job_erase(Collect().runner(), self.dev, full=False, eject=False)
        info = B.parse_disc_info(subprocess.run(["xorriso", "-outdev", self.dev, "-toc"],
                                                capture_output=True, text=True).stdout)
        self.assertTrue(info.blank)


class AudioJob(unittest.TestCase):
    @unittest.skipUnless(HAVE_FFMPEG, "ffmpeg not installed")
    def test_audio_job_with_fake_cdrskin(self):
        t = tempfile.mkdtemp()
        try:
            mp3 = os.path.join(t, "fog.mp3")
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                            "sine=f=440:d=3", "-ar", "48000", "-ac", "1", mp3], check=True)
            wav = os.path.join(t, "bell.wav")
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                            "sine=f=880:d=2", "-ar", "44100", "-ac", "2", "-sample_fmt", "s16", wav],
                           check=True)
            self.assertTrue(B.is_cd_wav(wav))
            self.assertFalse(B.is_cd_wav(mp3))
            argfile = os.path.join(t, "args")
            fake = os.path.join(t, "cdrskin")
            with open(fake, "w") as f:
                f.write(textwrap.dedent(f"""\
                    #!/bin/sh
                    printf '%s\\n' "$@" > {argfile}
                    for a in "$@"; do case "$a" in input_sheet_v07t=*) cp "${{a#*=}}" {argfile}.v07t;; esac; done
                    printf 'Track 01:   0 of   1 MB written (fifo 100%%)\\r'
                    printf 'Track 02:   1 of   1 MB written (fifo 100%%)\\n'
                    echo 'cdrskin: burning done'
                    """))
            os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
            os.environ["IPRPS_BURNER_CDRSKIN"] = fake
            tracks = [B.probe_track(mp3), B.probe_track(wav)]
            self.assertAlmostEqual(tracks[0].seconds, 3, delta=0.2)
            c = Collect()
            msg = B.job_burn_audio(c.runner(), "/dev/sr0", tracks, simulate=True, fastest=False,
                                   normalize=False, eject=False, album="Iron City", artist="IPRPS")
            self.assertIn("Simulation", msg)
            args = open(argfile).read().split("\n")
            self.assertIn("-dummy", args)
            self.assertIn("speed=1", args)
            wavs = [a for a in args if a.endswith(".wav")]
            self.assertEqual(len(wavs), 2)
            self.assertTrue(wavs[0].endswith("track01.wav"))   # converted mp3
            self.assertEqual(wavs[1], wav)                      # already CD audio, used as is
            self.assertIn("Album Title = Iron City", open(argfile + ".v07t", encoding="latin-1").read())
            self.assertEqual(c.fracs[-1], 1.0)
            self.assertFalse(os.path.exists(os.path.dirname(wavs[0])))   # temp files removed
        finally:
            os.environ.pop("IPRPS_BURNER_CDRSKIN", None)
            shutil.rmtree(t, ignore_errors=True)


class CancelTest(unittest.TestCase):
    def test_cancel_stops_command(self):
        import threading
        import time
        c = Collect()
        r = c.runner()
        threading.Timer(0.5, r.cancel).start()
        start = time.time()
        with self.assertRaises(B.Cancelled):
            r.run(["sleep", "10"])
        self.assertLess(time.time() - start, 5)


if __name__ == "__main__":
    unittest.main()
