#!/usr/bin/env python3
"""
Unit and Integration Tests for Voiceover Muxer (mux_voiceover.py)
"""

import importlib.util
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
MUX_SCRIPT = ROOT_DIR / "skills" / "interactive-tutorial-video" / "scripts" / "mux_voiceover.py"

# Load mux_voiceover module dynamically
spec = importlib.util.spec_from_file_location("mux_voiceover", str(MUX_SCRIPT))
mux = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mux)

class TestMuxVoiceover(unittest.TestCase):
    def setUp(self):
        self.temp_dir = pathlib.Path(tempfile.mkdtemp(prefix="test_mux_"))

    def tearDown(self):
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_python314_argparse_help(self):
        """Verify argparse help string does not crash under Python 3.14."""
        cmd = [sys.executable, str(MUX_SCRIPT), "--help"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"--help failed: {res.stderr}")
        self.assertIn("Speech speed rate (default: +10%)", res.stdout)

    def test_transcode_vp8_webm_to_h264_mp4(self):
        """Verify VP8 WebM input is converted to H.264 MP4."""
        source_webm = self.temp_dir / "test_vp8.webm"
        out_mp4 = self.temp_dir / "test_out.mp4"

        # Create 1-second VP8 WebM video
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:r=25:d=1",
            "-c:v", "libvpx", str(source_webm)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        # Mock synthesis with synthetic 1s audio tone
        def mock_synth(_bin, _text, out_path, **kwargs):
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                "-c:a", "libmp3lame", str(out_path)
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        old_synth = mux.synthesize_segment
        mux.synthesize_segment = mock_synth
        try:
            mux.mux_voiceover(
                str(source_webm),
                [{"delay_ms": 0, "text": "Test segment"}],
                str(out_mp4),
                temp_dir=str(self.temp_dir / "build"),
                export_captions_flag=True
            )
        finally:
            mux.synthesize_segment = old_synth

        # Verify output with ffprobe
        probe_raw = subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_streams", "-of", "json",
            str(out_mp4)
        ])
        probe = json.loads(probe_raw)
        streams = probe.get("streams", [])
        v_stream = next((s for s in streams if s["codec_type"] == "video"), None)
        a_stream = next((s for s in streams if s["codec_type"] == "audio"), None)

        self.assertIsNotNone(v_stream, "Must contain video stream")
        self.assertIsNotNone(a_stream, "Must contain audio stream")
        self.assertEqual(v_stream["codec_name"], "h264", "Video must be transcoded to H.264")
        self.assertEqual(a_stream["codec_name"], "aac", "Audio must be encoded to AAC")

        # Verify captions exported
        srt_file = self.temp_dir / "test_out.srt"
        vtt_file = self.temp_dir / "test_out.vtt"
        self.assertTrue(srt_file.exists(), "SRT caption file must exist")
        self.assertTrue(vtt_file.exists(), "VTT caption file must exist")

    def test_audio_duration_hold_last_frame(self):
        """Verify video is padded with tpad when audio ends after video duration."""
        source_mp4 = self.temp_dir / "short_1s.mp4"
        out_mp4 = self.temp_dir / "extended_out.mp4"

        # 1-second video
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:r=25:d=1",
            "-c:v", "libx264", str(source_mp4)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        # 2-second audio cue starting at 800ms -> ends at 2.8s
        def mock_synth(_bin, _text, out_path, **kwargs):
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                "-c:a", "libmp3lame", str(out_path)
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        old_synth = mux.synthesize_segment
        mux.synthesize_segment = mock_synth
        try:
            mux.mux_voiceover(
                str(source_mp4),
                [{"delay_ms": 800, "text": "Synthetic narration exceeding video"}],
                str(out_mp4),
                temp_dir=str(self.temp_dir / "build_ext")
            )
        finally:
            mux.synthesize_segment = old_synth

        # Verify duration extended
        dur = mux.get_media_duration(str(out_mp4))
        self.assertGreaterEqual(dur, 2.8, f"Output video duration ({dur}s) must not truncate 2.8s narration")

    def test_offline_fallback_tone_generation(self):
        """Verify fallback tone is generated when edge-tts is unavailable or offline if allow_fallback=True."""
        out_audio = self.temp_dir / "fallback_tone.mp3"
        # Pass non-existent command to simulate failure
        mux.synthesize_segment(
            edge_tts_cmd=["/nonexistent/bin/edge-tts"],
            text="مرحباً بكم في الشرح التعليمي",
            out_path=str(out_audio),
            allow_fallback=True
        )
        self.assertTrue(out_audio.exists(), "Fallback audio tone must be created")
        dur = mux.get_media_duration(str(out_audio))
        self.assertGreater(dur, 1.0, f"Fallback audio tone must have positive duration (got {dur}s)")

    def test_edge_tts_failure_fails_loudly_without_fallback(self):
        """Verify RuntimeError is raised loudly when edge-tts fails and fallback is not allowed."""
        out_audio = self.temp_dir / "failing_audio.mp3"
        with self.assertRaises(RuntimeError) as ctx:
            mux.synthesize_segment(
                edge_tts_cmd=["/nonexistent/bin/edge-tts"],
                text="فشل التوليد بدون خيار بديل",
                out_path=str(out_audio),
                allow_fallback=False
            )
        self.assertIn("Pass --allow-synthetic-fallback", str(ctx.exception))

    def test_timeline_overlap_fails_loudly_without_fallback(self):
        """Verify overlapping audio segments raise RuntimeError unless fallback is allowed."""
        source_mp4 = self.temp_dir / "base_overlap.mp4"
        out_mp4 = self.temp_dir / "overlap_out.mp4"

        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:r=30:d=5",
            "-c:v", "libx264", str(source_mp4)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        # Mock synth that produces 2-second clips
        def mock_synth(_bin, _text, out_path, **kwargs):
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                "-ac", "2", "-c:a", "libmp3lame", str(out_path)
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        old_synth = mux.synthesize_segment
        mux.synthesize_segment = mock_synth
        try:
            # Segment 1 starts at 0, lasts 2s (ends at 2s). Segment 2 starts at 1s -> overlaps by 1s!
            segments = [
                {"delay_ms": 0, "text": "Segment one playing"},
                {"delay_ms": 1000, "text": "Segment two clashing"}
            ]
            with self.assertRaises(RuntimeError) as ctx:
                mux.mux_voiceover(
                    str(source_mp4),
                    segments,
                    str(out_mp4),
                    temp_dir=str(self.temp_dir / "overlap_test"),
                    allow_fallback=False
                )
            self.assertIn("Audio timeline overlap detected", str(ctx.exception))
        finally:
            mux.synthesize_segment = old_synth

    def test_zero_segments_generates_30fps_stereo_aac(self):
        """Verify mux_voiceover with zero segments still generates 30fps video with stereo AAC audio."""
        source_mp4 = self.temp_dir / "zero_seg_source.mp4"
        out_mp4 = self.temp_dir / "zero_seg_out.mp4"

        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:r=25:d=1",
            "-c:v", "libx264", str(source_mp4)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        mux.mux_voiceover(
            str(source_mp4),
            [],
            str(out_mp4),
            temp_dir=str(self.temp_dir / "zero_seg_dir")
        )

        probe_raw = subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_streams", "-of", "json",
            str(out_mp4)
        ])
        probe = json.loads(probe_raw)
        streams = probe.get("streams", [])
        v_stream = next((s for s in streams if s["codec_type"] == "video"), None)
        a_stream = next((s for s in streams if s["codec_type"] == "audio"), None)

        self.assertIsNotNone(v_stream, "Must contain video stream")
        self.assertIsNotNone(a_stream, "Must contain audio stream")
        self.assertEqual(v_stream["codec_name"], "h264")
        self.assertEqual(a_stream["codec_name"], "aac")
        self.assertEqual(a_stream["channels"], 2, "Audio must be stereo (channels == 2)")

if __name__ == "__main__":
    unittest.main()
