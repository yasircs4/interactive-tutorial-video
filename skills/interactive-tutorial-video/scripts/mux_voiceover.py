#!/usr/bin/env python3
"""
Interactive Tutorial Video Voiceover Muxer

Synthesizes high-fidelity neural voiceover segments (via edge-tts)
and muxes them synchronously into Playwright-recorded tutorial videos (WebM/MP4)
using ffmpeg adelay and amix filters.

Transcodes to standard H.264/AAC MP4 (yuv420p) for universal playback in
Safari, QuickTime, iOS, WhatsApp, and YouTube.
Guarantees narration is never cut off by holding the last video frame if needed.
Produces synchronized SRT and WebVTT captions from the single timeline.

Compliant with agentskills.io specifications.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

DEFAULT_VOICE = "ar-LY-ImanNeural"
DEFAULT_RATE = "+10%"

def parse_semver(ver_str):
    m = re.search(r"(\d+)\.(\d+)\.(\d+)", ver_str)
    return tuple(map(int, m.groups())) if m else (0, 0, 0)

def find_edge_tts():
    """Find edge-tts executable, prioritizing versions >= 7.3.0 to prevent HTTP 403 errors."""
    candidates = []

    # Check python -m edge_tts
    try:
        res = subprocess.run([sys.executable, "-m", "edge_tts", "--version"], capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            ver = parse_semver(res.stdout)
            candidates.append(([sys.executable, "-m", "edge_tts"], ver, f"python3 -m edge_tts ({res.stdout.strip()})"))
    except Exception:
        pass

    path_list = [
        shutil.which("edge-tts"),
        "/Users/yassir/Library/Python/3.14/bin/edge-tts",
        os.path.expanduser("~/.local/bin/edge-tts"),
        "/tmp/tts_venv/bin/edge-tts"
    ]
    for p in path_list:
        if p and os.path.isfile(p) and os.access(p, os.X_OK):
            try:
                res = subprocess.run([p, "--version"], capture_output=True, text=True, timeout=5)
                if res.returncode == 0:
                    ver = parse_semver(res.stdout)
                    candidates.append(([p], ver, f"{p} ({res.stdout.strip()})"))
            except Exception:
                pass

    if candidates:
        # Sort so modern >= 7.3.0 comes first
        candidates.sort(key=lambda c: c[1], reverse=True)
        best_cmd, best_ver, best_desc = candidates[0]
        if best_ver < (7, 3, 0):
            print(f"[mux_voiceover] Warning: selected {best_desc} is < 7.3.0 and may receive HTTP 403 from Microsoft.", file=sys.stderr)
        return best_cmd

    return ["edge-tts"]

def get_media_duration(file_path):
    """Return media duration in seconds via ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        # Fallback to streams duration
        cmd = [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(res.stdout.strip())
    except Exception:
        return 0.0

def synthesize_segment(edge_tts_cmd, text, out_path, voice=DEFAULT_VOICE, rate=DEFAULT_RATE, allow_fallback=False):
    """Generate audio MP3 for a single text segment.
    In development, fails loudly if edge-tts fails unless allow_fallback is explicitly True.
    """
    if isinstance(edge_tts_cmd, str):
        edge_tts_cmd = [edge_tts_cmd]
    cmd = list(edge_tts_cmd) + [
        "--voice", voice,
        "--rate", rate,
        "--text", text,
        "--write-media", out_path
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if res.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            return
        err_msg = res.stderr.strip() or f"exit code {res.returncode}"
    except Exception as e:
        err_msg = str(e)

    if allow_fallback:
        is_ar = bool(re.search(r"[\u0600-\u06FF]", text))
        dur_sec = max(1.5, len(text.replace(" ", "")) / 13.0 + 0.6) if is_ar else max(1.5, len(text.split()) / 2.5 + 0.6)
        print(f"[mux_voiceover] Notice: edge-tts unavailable ({err_msg}). Generating {dur_sec:.1f}s tone fallback for '{text[:30]}...'")
        fb_cmd = [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", f"sine=frequency=523.25:duration={dur_sec:.2f}",
            "-ac", "2",
            "-c:a", "libmp3lame", "-b:a", "128k",
            out_path
        ]
        subprocess.run(fb_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    else:
        raise RuntimeError(f"edge-tts synthesis failed ({err_msg}). Pass --allow-synthetic-fallback for headless offline CI.")

def format_timestamp_srt(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def format_timestamp_vtt(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

def export_captions(segments_with_timing, srt_path=None, vtt_path=None):
    """Write SRT and WebVTT caption files from timed segments."""
    if srt_path:
        with open(srt_path, "w", encoding="utf-8") as f:
            for i, seg in enumerate(segments_with_timing, start=1):
                start_ts = format_timestamp_srt(seg["start"])
                end_ts = format_timestamp_srt(seg["end"])
                f.write(f"{i}\n{start_ts} --> {end_ts}\n{seg['text']}\n\n")
    if vtt_path:
        with open(vtt_path, "w", encoding="utf-8") as f:
            f.write("WEBVTT\n\n")
            for i, seg in enumerate(segments_with_timing, start=1):
                start_ts = format_timestamp_vtt(seg["start"])
                end_ts = format_timestamp_vtt(seg["end"])
                f.write(f"{i}\n{start_ts} --> {end_ts}\n{seg['text']}\n\n")

def mux_voiceover(input_video, segments, output_video, voice=DEFAULT_VOICE, rate=DEFAULT_RATE,
                   temp_dir=None, export_captions_flag=False, loudnorm=True, allow_fallback=False):
    """
    Synthesizes and muxes audio segments into a target video.
    In development, fails loudly if edge-tts fails or if narration segments overlap,
    unless allow_fallback is explicitly set to True.
    
    segments: list of dicts with {"delay_ms": int, "text": str}
    """
    is_temp_dir_created = False
    if not temp_dir:
        temp_dir = tempfile.mkdtemp(prefix="tts_mux_")
        is_temp_dir_created = True
    else:
        os.makedirs(temp_dir, exist_ok=True)

    try:
        edge_tts_cmd = find_edge_tts()

        print(f"[mux_voiceover] Processing: {input_video}")
        print(f"[mux_voiceover] Voice: {voice} (rate: {rate}), Segments: {len(segments)}")

        video_duration = get_media_duration(input_video)
        print(f"[mux_voiceover] Input video duration: {video_duration:.2f}s")

        audio_files = []
        timed_segments = []

        for idx, seg in enumerate(segments):
            delay_ms = seg.get("delay_ms", 0)
            text = seg.get("text", "")
            audio_name = f"seg_{idx}.mp3"
            audio_path = os.path.join(temp_dir, audio_name)
            print(f"  - Segment {idx + 1}: delay={delay_ms}ms, text='{text[:45]}...'")
            synthesize_segment(edge_tts_cmd, text, audio_path, voice=voice, rate=rate, allow_fallback=allow_fallback)
            clip_dur = get_media_duration(audio_path)
            audio_files.append((delay_ms, audio_path, clip_dur, text))
            timed_segments.append({
                "start": delay_ms / 1000.0,
                "end": delay_ms / 1000.0 + clip_dur,
                "text": text
            })

        # Check for segment overlaps - fail loudly in development if narration clashes
        for i in range(len(timed_segments) - 1):
            curr = timed_segments[i]
            nxt = timed_segments[i + 1]
            if curr["end"] > nxt["start"]:
                overlap = curr["end"] - nxt["start"]
                msg = f"Audio timeline overlap detected: Segment {i + 1} ('{curr['text'][:30]}...') overlaps with Segment {i + 2} ('{nxt['text'][:30]}...') by {overlap:.2f}s."
                if not allow_fallback:
                    raise RuntimeError(f"{msg} Voiceover narration would clash. Adjust timeline pacing or pass --allow-synthetic-fallback.")
                else:
                    print(f"[mux_voiceover] WARNING: {msg}")

        max_audio_end = max((s["end"] for s in timed_segments), default=0.0)
        print(f"[mux_voiceover] Total audio timeline reaches: {max_audio_end:.2f}s")

        # Determine video pad if audio exceeds video duration
        pad_sec = 0.0
        if max_audio_end > video_duration and video_duration > 0:
            pad_sec = (max_audio_end - video_duration) + 0.5
            print(f"[mux_voiceover] Notice: Extending video by holding last frame for {pad_sec:.2f}s to avoid truncating narration.")

        inputs = ["-i", input_video]
        filter_parts = []
        mix_inputs = []

        for idx, (delay_ms, a_path, clip_dur, _) in enumerate(audio_files):
            inputs.extend(["-i", a_path])
            filter_parts.append(f"[{idx+1}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
            mix_inputs.append(f"[a{idx}]")

        num_inputs = len(audio_files)
        if num_inputs == 0:
            print("[mux_voiceover] Warning: No audio segments provided, ensuring 30 fps video with stereo AAC audio track.")
            has_audio = False
            try:
                probe_res = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "a:0",
                    "-show_entries", "stream=codec_type", "-of", "default=noprint_wrappers=1:nokey=1",
                    input_video
                ], capture_output=True, text=True)
                has_audio = (probe_res.stdout.strip() == "audio")
            except Exception:
                has_audio = False

            if has_audio:
                cmd = [
                    "ffmpeg", "-y", "-i", input_video,
                    "-map", "0:v:0",
                    "-map", "0:a:0",
                    "-r", "30",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    "-c:a", "aac", "-ac", "2", "-b:a", "192k",
                    output_video
                ]
            else:
                cmd = [
                    "ffmpeg", "-y", "-i", input_video,
                    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    "-r", "30",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    "-c:a", "aac", "-ac", "2", "-b:a", "192k",
                    "-shortest",
                    output_video
                ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            return

        # Audio filter: mix and optional loudnorm
        loudnorm_filter = ",loudnorm=I=-16:TP=-1.5:LRA=11" if loudnorm else ""
        filter_str = ";".join(filter_parts) + ";" + "".join(mix_inputs) + f"amix=inputs={num_inputs}:dropout_transition=0:normalize=0{loudnorm_filter},apad[aout]"

        # Video filter: apply tpad if audio exceeds video
        video_map = "0:v:0"
        if pad_sec > 0:
            filter_str = f"[0:v]tpad=stop_mode=clone:stop_duration={pad_sec:.3f}[vpad];" + filter_str
            video_map = "[vpad]"

        temp_out = os.path.join(temp_dir, "temp_muxed.mp4")
        cmd = ["ffmpeg", "-y"] + inputs + [
            "-filter_complex", filter_str,
            "-map", video_map,
            "-map", "[aout]",
            "-r", "30",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-crf", "22",
            "-movflags", "+faststart",
            "-c:a", "aac",
            "-ac", "2",
            "-b:a", "192k",
            "-shortest",
            temp_out
        ]

        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        os.makedirs(os.path.dirname(os.path.abspath(output_video)), exist_ok=True)
        shutil.move(temp_out, output_video)
        print(f"[mux_voiceover] Successfully exported: {output_video}")

        # Export captions if requested
        if export_captions_flag:
            base_path = os.path.splitext(output_video)[0]
            srt_path = base_path + ".srt"
            vtt_path = base_path + ".vtt"
            export_captions(timed_segments, srt_path=srt_path, vtt_path=vtt_path)
            print(f"[mux_voiceover] Exported captions: {srt_path} and {vtt_path}")

    finally:
        if is_temp_dir_created and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

def main():
    parser = argparse.ArgumentParser(description="Synchronized neural voiceover generator & muxer.")
    parser.add_argument("--video", required=True, help="Path to input MP4/WebM video recorded by Playwright.")
    parser.add_argument("--manifest", required=True, help="Path to JSON file containing timeline segments.")
    parser.add_argument("--output", help="Path to output MP4 video (default: overwrites input or safe export).")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Neural voice name (default: ar-LY-ImanNeural).")
    parser.add_argument("--rate", default=DEFAULT_RATE, help="Speech speed rate (default: +10%%).")
    parser.add_argument("--export-captions", action="store_true", help="Generate .srt and .vtt caption files.")
    parser.add_argument("--no-loudnorm", action="store_true", help="Disable EBU R128 loudness normalization.")
    parser.add_argument("--allow-synthetic-fallback", action="store_true", help="Allow synthetic tone fallback and timeline overlap for headless offline CI.")
    parser.add_argument("--no-fallback", action="store_true", help="Disable synthetic tone fallback (default behavior).")
    parser.add_argument("--keep-temp", action="store_true", help="Preserve temporary synthesis directory.")
    args = parser.parse_args()

    with open(args.manifest, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    segments = manifest_data.get("segments", manifest_data)
    out_video = args.output if args.output else args.video

    temp_dir = tempfile.mkdtemp(prefix="tts_mux_") if args.keep_temp else None

    allow_fallback = args.allow_synthetic_fallback and not args.no_fallback

    try:
        mux_voiceover(
            input_video=args.video,
            segments=segments,
            output_video=out_video,
            voice=args.voice,
            rate=args.rate,
            temp_dir=temp_dir,
            export_captions_flag=args.export_captions,
            loudnorm=not args.no_loudnorm,
            allow_fallback=allow_fallback
        )
    except RuntimeError as err:
        print(f"[mux_voiceover] Fatal Error: {err}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
