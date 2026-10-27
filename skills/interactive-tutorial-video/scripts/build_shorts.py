#!/usr/bin/env python3
"""
YouTube Shorts & Mobile Vertical Video Builder (CLI Wrapper)

Delegates to build_shorts.js which renders 1080x1920 HTML glassmorphism
overlays via Playwright and composites with FFmpeg.

Compliant with agentskills.io specifications.
"""

import argparse
import os
import subprocess
import sys

def main():
    parser = argparse.ArgumentParser(description="Convert 16:9 tutorial video into 9:16 vertical short.")
    parser.add_argument("--video", required=True, help="Input 16:9 MP4 video.")
    parser.add_argument("--output", required=True, help="Output 9:16 MP4 short.")
    parser.add_argument("--tag", default="AI TUTORIAL", help="Header badge tag.")
    parser.add_argument("--title", default="Step-by-Step Guide", help="Header title.")
    parser.add_argument("--sub", default="Interactive Tutorial", help="Header subtitle.")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    js_script = os.path.join(script_dir, "build_shorts.js")

    cmd = [
        "node", js_script,
        args.video,
        args.output,
        "--tag", args.tag,
        "--title", args.title,
        "--sub", args.sub
    ]

    res = subprocess.run(cmd)
    sys.exit(res.returncode)

if __name__ == "__main__":
    main()
