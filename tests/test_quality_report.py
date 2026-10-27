#!/usr/bin/env python3
"""
Unit tests for Video Quality Inspector (quality_report.py)
"""

import importlib.util
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
REPORT_SCRIPT = ROOT_DIR / "skills" / "interactive-tutorial-video" / "scripts" / "quality_report.py"

spec = importlib.util.spec_from_file_location("quality_report", str(REPORT_SCRIPT))
qr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qr)

class TestQualityReport(unittest.TestCase):
    def setUp(self):
        self.temp_dir = pathlib.Path(tempfile.mkdtemp(prefix="test_qr_"))

    def tearDown(self):
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_compliant_video_passes(self):
        """Verify video with H.264 video, 30fps, 1080p, and stereo AAC audio passes compliance."""
        test_video = self.temp_dir / "compliant.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=30:d=1",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ac", "2",
            str(test_video)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        report = qr.evaluate_quality(str(test_video))
        self.assertTrue(report["compliance"]["passed"], f"Compliant video must pass: {report['compliance']['issues']}")
        self.assertTrue(report["compliance"]["is_h264"])
        self.assertTrue(report["compliance"]["is_aac"])
        self.assertTrue(report["compliance"]["is_1080p"])
        self.assertTrue(report["compliance"]["is_30fps"])
        self.assertTrue(report["compliance"]["is_stereo"])
        self.assertEqual(len(report["compliance"]["issues"]), 0)

    def test_25fps_fails_compliance(self):
        """Verify video with 25 fps fails compliance (must be 30 fps)."""
        test_video = self.temp_dir / "video_25fps.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=25:d=1",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ac", "2",
            str(test_video)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        report = qr.evaluate_quality(str(test_video))
        self.assertFalse(report["compliance"]["passed"], "25 fps video must fail compliance")
        self.assertFalse(report["compliance"]["is_30fps"])
        self.assertTrue(any("expected 30 fps" in i for i in report["compliance"]["issues"]))

    def test_mono_audio_fails_compliance(self):
        """Verify video with mono audio fails compliance (must be stereo channels == 2)."""
        test_video = self.temp_dir / "mono_audio.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=30:d=1",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ac", "1",
            str(test_video)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        report = qr.evaluate_quality(str(test_video))
        self.assertFalse(report["compliance"]["passed"], "Mono audio video must fail compliance")
        self.assertFalse(report["compliance"]["is_stereo"])
        self.assertTrue(any("expected stereo" in i for i in report["compliance"]["issues"]))

    def test_missing_audio_fails_compliance(self):
        """Verify video without audio fails compliance check."""
        test_video = self.temp_dir / "no_audio.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=30:d=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            str(test_video)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        report = qr.evaluate_quality(str(test_video))
        self.assertFalse(report["compliance"]["passed"], "Video with no audio must fail compliance")
        self.assertIsNone(report["audio"])
        self.assertTrue(any("No audio stream found" in i for i in report["compliance"]["issues"]))

if __name__ == "__main__":
    unittest.main()
