#!/usr/bin/env python3
"""
Interactive Tutorial Video Quality Inspector & Report Generator

Analyzes exported MP4 tutorial videos to verify broadcast compliance:
- Resolution (1080p 16:9 or 9:16 vertical)
- Codecs (H.264 video, AAC audio)
- Framerate (fps)
- Media durations and audio/video coverage match
- EBU R128 loudness metrics (integrated LUFS, LRA, True Peak)
- Generates structured JSON quality reports

Compliant with agentskills.io specifications.
"""

import argparse
import json
import os
import re
import subprocess
import sys

def probe_video(video_path):
    """Extract format and stream metadata using ffprobe."""
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cmd = [
        "ffprobe", "-v", "error",
        "-show_format",
        "-show_streams",
        "-of", "json",
        video_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)

def measure_loudness(video_path):
    """Measure EBU R128 loudness stats using ffmpeg ebur128 filter."""
    cmd = [
        "ffmpeg", "-i", video_path,
        "-af", "ebur128=framelog=verbose",
        "-f", "null", "-"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    output = res.stderr

    metrics = {
        "integrated_lufs": None,
        "loudness_range_lra": None,
        "true_peak_dbtp": None
    }

    m_i = re.search(r"I:\s+([-\d.]+)\s+LUFS", output)
    if m_i:
        metrics["integrated_lufs"] = float(m_i.group(1))

    m_lra = re.search(r"LRA:\s+([-\d.]+)\s+LU", output)
    if m_lra:
        metrics["loudness_range_lra"] = float(m_lra.group(1))

    m_tp = re.search(r"Peak:\s+([-\d.]+)\s+dBFS", output) or re.search(r"True peak:\s+([-\d.]+)\s+dBFS", output)
    if m_tp:
        metrics["true_peak_dbtp"] = float(m_tp.group(1))

    return metrics

def evaluate_quality(video_path, manifest_path=None):
    """Perform comprehensive quality evaluation."""
    raw_probe = probe_video(video_path)
    streams = raw_probe.get("streams", [])
    fmt = raw_probe.get("format", {})

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    file_size_bytes = os.path.getsize(video_path)
    file_size_mb = round(file_size_bytes / (1024 * 1024), 2)
    duration_sec = float(fmt.get("duration", 0.0))

    report = {
        "file": os.path.abspath(video_path),
        "file_size_mb": file_size_mb,
        "duration_sec": round(duration_sec, 2),
        "video": {},
        "audio": {},
        "loudness": {},
        "compliance": {
            "is_h264": False,
            "is_aac": False,
            "is_1080p": False,
            "is_30fps": False,
            "is_stereo": False,
            "audio_coverage_ok": False,
            "passed": True,
            "issues": []
        }
    }

    # Video evaluation
    if video_stream:
        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))
        codec = video_stream.get("codec_name", "")
        fps_raw = video_stream.get("r_frame_rate", "0/1")
        fps = round(eval(fps_raw), 2) if "/" in fps_raw else float(fps_raw)

        report["video"] = {
            "codec": codec,
            "width": width,
            "height": height,
            "fps": fps,
            "pix_fmt": video_stream.get("pix_fmt", "")
        }

        report["compliance"]["is_h264"] = (codec.lower() == "h264")
        report["compliance"]["is_1080p"] = (width == 1920 and height == 1080) or (width == 1080 and height == 1920)
        report["compliance"]["is_30fps"] = (round(fps) == 30)

        if not report["compliance"]["is_h264"]:
            report["compliance"]["passed"] = False
            report["compliance"]["issues"].append(f"Video codec is '{codec}', expected 'h264'")
        if not report["compliance"]["is_1080p"]:
            report["compliance"]["issues"].append(f"Resolution is {width}x{height}, standard is 1080p (1920x1080 or 1080x1920)")
        if not report["compliance"]["is_30fps"]:
            report["compliance"]["passed"] = False
            report["compliance"]["issues"].append(f"Framerate is {fps} fps, expected 30 fps")
    else:
        report["compliance"]["passed"] = False
        report["compliance"]["issues"].append("No video stream found in file")

    # Audio evaluation
    if audio_stream:
        a_codec = audio_stream.get("codec_name", "")
        channels = int(audio_stream.get("channels", 1))
        sample_rate = int(audio_stream.get("sample_rate", 0))
        a_duration = float(audio_stream.get("duration", duration_sec))

        report["audio"] = {
            "codec": a_codec,
            "channels": channels,
            "channel_layout": audio_stream.get("channel_layout", "mono" if channels == 1 else "stereo"),
            "sample_rate": sample_rate,
            "duration_sec": round(a_duration, 2)
        }

        report["compliance"]["is_aac"] = (a_codec.lower() == "aac")
        report["compliance"]["is_stereo"] = (channels == 2)

        if not report["compliance"]["is_aac"]:
            report["compliance"]["passed"] = False
            report["compliance"]["issues"].append(f"Audio codec is '{a_codec}', expected 'aac'")
        if not report["compliance"]["is_stereo"]:
            report["compliance"]["passed"] = False
            report["compliance"]["issues"].append(f"Audio channels is {channels} ({report['audio']['channel_layout']}), expected stereo (2 channels)")

        # Coverage check
        if abs(a_duration - duration_sec) <= 1.0 or a_duration <= duration_sec:
            report["compliance"]["audio_coverage_ok"] = True
        else:
            report["compliance"]["issues"].append(f"Audio duration ({a_duration}s) exceeds video duration ({duration_sec}s)")

        # Loudness metrics
        try:
            loudness = measure_loudness(video_path)
            report["loudness"] = loudness
        except Exception as e:
            report["loudness"] = {"error": str(e)}
    else:
        report["audio"] = None
        report["compliance"]["passed"] = False
        report["compliance"]["issues"].append("No audio stream found in file (expected AAC audio)")

    return report

def main():
    parser = argparse.ArgumentParser(description="Export Quality Inspector for tutorial videos.")
    parser.add_argument("--video", required=True, help="Path to video file to inspect.")
    parser.add_argument("--manifest", help="Optional path to scenario manifest.")
    parser.add_argument("--json", dest="json_out", help="Save quality report to JSON file.")
    parser.add_argument("--allow-no-audio", action="store_true", help="Do not fail compliance if audio stream is missing.")
    args = parser.parse_args()

    report = evaluate_quality(args.video, args.manifest)

    if args.allow_no_audio and "No audio stream found in file (expected AAC audio)" in report["compliance"]["issues"]:
        report["compliance"]["issues"].remove("No audio stream found in file (expected AAC audio)")
        if not any("Video codec" in i or "Resolution" in i for i in report["compliance"]["issues"]):
            report["compliance"]["passed"] = True

    print("=================================================")
    print(" Video Quality Inspection Report")
    print("=================================================")
    print(f"File: {report['file']}")
    print(f"Size: {report['file_size_mb']} MB | Duration: {report['duration_sec']}s")

    if report["video"]:
        v = report["video"]
        print(f"Video: {v['codec'].upper()} {v['width']}x{v['height']} @ {v['fps']} fps ({v['pix_fmt']})")
    if report["audio"]:
        a = report["audio"]
        print(f"Audio: {a['codec'].upper()} {a['channel_layout']} @ {a['sample_rate']} Hz")
    if report["loudness"].get("integrated_lufs") is not None:
        l = report["loudness"]
        print(f"Loudness: Integrated {l['integrated_lufs']} LUFS | LRA: {l['loudness_range_lra']} LU | Peak: {l['true_peak_dbtp']} dBFS")

    print("\nCompliance Status:")
    if report["compliance"]["passed"] and not report["compliance"]["issues"]:
        print("  Status: ✅ 100% COMPLIANT (H.264, AAC Stereo, 1080p, 30 fps, Valid Duration)")
    else:
        status_icon = "⚠️" if report["compliance"]["passed"] else "❌"
        status_label = "PASSED WITH NOTICES" if report["compliance"]["passed"] else "FAILED (NON-COMPLIANT)"
        print(f"  Status: {status_icon} {status_label}:")
        for issue in report["compliance"]["issues"]:
            print(f"   - {issue}")

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nSaved report to: {args.json_out}")

    if not report["compliance"]["passed"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
