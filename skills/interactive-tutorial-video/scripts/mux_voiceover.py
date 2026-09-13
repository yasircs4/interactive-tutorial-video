#!/usr/bin/env python3
"""
Interactive Tutorial Video Voiceover Muxer

Synthesizes high-fidelity neural voiceover segments (via edge-tts)
and muxes them synchronously into Playwright-recorded tutorial MP4 videos
using ffmpeg adelay and amix filters.

Compliant with agentskills.io specifications.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

DEFAULT_VOICE = "ar-LY-ImanNeural"
DEFAULT_RATE = "+10%"

def find_edge_tts():
    """Find edge-tts executable in common virtualenvs or system PATH."""
    venv_paths = [
        "/tmp/tts_venv/bin/edge-tts",
        os.path.expanduser("~/.local/bin/edge-tts"),
        shutil.which("edge-tts")
    ]
    for p in venv_paths:
        if p and os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return "edge-tts"

def synthesize_segment(edge_tts_bin, text, out_path, voice=DEFAULT_VOICE, rate=DEFAULT_RATE):
    """Generate audio MP3 for a single text segment."""
    cmd = [
        edge_tts_bin,
        "--voice", voice,
        "--rate", rate,
        "--text", text,
        "--write-media", out_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"edge-tts failed: {res.stderr.strip()}")

def mux_voiceover(input_video, segments, output_video, voice=DEFAULT_VOICE, rate=DEFAULT_RATE, temp_dir="/tmp/tts_mux_build"):
    """
    Synthesizes and muxes audio segments into a target video.
    
    segments: list of dicts with {"delay_ms": int, "text": str}
    """
    os.makedirs(temp_dir, exist_ok=True)
    edge_tts_bin = find_edge_tts()

    print(f"[mux_voiceover] Processing: {input_video}")
    print(f"[mux_voiceover] Voice: {voice} (rate: {rate}), Segments: {len(segments)}")

    audio_files = []
    for idx, seg in enumerate(segments):
        delay_ms = seg.get("delay_ms", 0)
        text = seg.get("text", "")
        audio_name = f"seg_{idx}.mp3"
        audio_path = os.path.join(temp_dir, audio_name)
        print(f"  - Segment {idx + 1}: delay={delay_ms}ms, text='{text[:45]}...'")
        synthesize_segment(edge_tts_bin, text, audio_path, voice=voice, rate=rate)
        audio_files.append((delay_ms, audio_path))

    inputs = ["-i", input_video]
    filter_parts = []
    mix_inputs = []

    for idx, (delay_ms, a_path) in enumerate(audio_files):
        inputs.extend(["-i", a_path])
        filter_parts.append(f"[{idx+1}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
        mix_inputs.append(f"[a{idx}]")

    num_inputs = len(audio_files)
    if num_inputs == 0:
        print("[mux_voiceover] Warning: No audio segments provided, skipping mux.")
        return

    filter_str = ";".join(filter_parts) + ";" + "".join(mix_inputs) + f"amix=inputs={num_inputs}:dropout_transition=0:normalize=0,apad[aout]"

    temp_out = os.path.join(temp_dir, "temp_muxed.mp4")
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_str,
        "-map", "0:v:0",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        temp_out
    ]

    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    shutil.move(temp_out, output_video)
    print(f"[mux_voiceover] Successfully exported: {output_video}")

def main():
    parser = argparse.ArgumentParser(description="Synchronized neural voiceover generator & muxer.")
    parser.add_argument("--video", required=True, help="Path to input MP4 video recorded by Playwright.")
    parser.add_argument("--manifest", required=True, help="Path to JSON file containing timeline segments.")
    parser.add_argument("--output", help="Path to output MP4 video (default: overwrites input).")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Neural voice name (default: ar-LY-ImanNeural).")
    parser.add_argument("--rate", default=DEFAULT_RATE, help="Speech speed rate (default: +10%).")
    args = parser.parse_args()

    with open(args.manifest, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    segments = manifest_data.get("segments", manifest_data)
    out_video = args.output if args.output else args.video

    mux_voiceover(
        input_video=args.video,
        segments=segments,
        output_video=out_video,
        voice=args.voice,
        rate=args.rate
    )

if __name__ == "__main__":
    main()
