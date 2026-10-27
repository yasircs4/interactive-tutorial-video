#!/usr/bin/env python3
"""
Multilingual Tutorial Video Generator

Orchestrates batch localization of a base tutorial video across multiple
languages and dialect accents using edge-tts and mux_voiceover.

Compliant with agentskills.io specifications.
"""

import argparse
import json
import os
import subprocess
import sys

DEFAULT_LANGUAGES = {
    "ar": {
        "voice": "ar-SA-ZariyahNeural",
        "rate": "+5%",
        "label": "Arabic"
    },
    "en": {
        "voice": "en-US-JennyNeural",
        "rate": "+5%",
        "label": "English"
    },
    "zh": {
        "voice": "zh-CN-XiaoxiaoNeural",
        "rate": "+5%",
        "label": "Chinese"
    },
    "hi": {
        "voice": "hi-IN-SwaraNeural",
        "rate": "+5%",
        "label": "Hindi"
    },
    "fil": {
        "voice": "fil-PH-BlessicaNeural",
        "rate": "+5%",
        "label": "Filipino"
    }
}

def generate_multilingual_suite(base_video, manifest_path, output_dir, selected_langs=None, allow_fallback=False):
    """
    Generates voiced videos for each configured language in manifest.
    """
    if not os.path.exists(base_video):
        raise FileNotFoundError(f"Base video not found: {base_video}")
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    os.makedirs(output_dir, exist_ok=True)
    languages = manifest.get("languages", DEFAULT_LANGUAGES)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    mux_script = os.path.join(current_dir, "mux_voiceover.py")

    results = []

    for lang_code, lang_cfg in languages.items():
        if selected_langs and lang_code not in selected_langs:
            continue

        voice = lang_cfg.get("voice", "ar-LY-ImanNeural")
        rate = lang_cfg.get("rate", "+10%")
        segments = lang_cfg.get("segments", [])
        if not segments:
            print(f"[multilingual_generator] Skipping {lang_code}: No segments found.")
            continue

        base_name = os.path.splitext(os.path.basename(base_video))[0]
        out_filename = f"{base_name}_{lang_code}.mp4"
        out_video = os.path.join(output_dir, out_filename)

        # Write temporary manifest for this language
        lang_manifest_path = os.path.join(output_dir, f".manifest_{lang_code}.json")
        with open(lang_manifest_path, "w", encoding="utf-8") as f:
            json.dump({"segments": segments}, f, ensure_ascii=False, indent=2)

        print(f"\n[multilingual_generator] Localizing for {lang_code.upper()} ({voice})...")
        cmd = [
            sys.executable, mux_script,
            "--video", base_video,
            "--manifest", lang_manifest_path,
            "--output", out_video,
            "--voice", voice,
            "--rate", rate,
            "--export-captions"
        ]
        if allow_fallback:
            cmd.append("--allow-synthetic-fallback")

        try:
            subprocess.run(cmd, check=True)
            results.append({
                "language": lang_code,
                "video": out_video,
                "captions_srt": os.path.splitext(out_video)[0] + ".srt",
                "captions_vtt": os.path.splitext(out_video)[0] + ".vtt"
            })
        finally:
            if os.path.exists(lang_manifest_path):
                os.remove(lang_manifest_path)

    print(f"\n[multilingual_generator] Generated {len(results)} localized videos.")
    return results

def main():
    parser = argparse.ArgumentParser(description="Batch generate multilingual voiced tutorial videos.")
    parser.add_argument("--video", required=True, help="Path to base tutorial MP4 video.")
    parser.add_argument("--manifest", required=True, help="Multilingual scenario manifest JSON.")
    parser.add_argument("--outdir", default="./output/multilingual", help="Output directory for generated videos.")
    parser.add_argument("--langs", nargs="*", help="Subset of language codes to generate (e.g. ar en).")
    parser.add_argument("--allow-synthetic-fallback", action="store_true", help="Allow synthetic tone fallback in headless offline CI.")
    args = parser.parse_args()

    generate_multilingual_suite(
        base_video=args.video,
        manifest_path=args.manifest,
        output_dir=args.outdir,
        selected_langs=args.langs,
        allow_fallback=args.allow_synthetic_fallback
    )

if __name__ == "__main__":
    main()
