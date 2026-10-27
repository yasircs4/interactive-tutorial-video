#!/usr/bin/env node
/**
 * YouTube Shorts & Mobile Vertical Video Builder (HTML Overlay Engine)
 * 
 * Transforms 16:9 tutorial videos into 9:16 (1080x1920) vertical videos
 * with blurred motion background, centered video frame, and high-fidelity
 * HTML/CSS glassmorphic badges, titles, and calls-to-action.
 * 
 * Does not require ffmpeg drawtext or font dependencies.
 * 
 * Compliant with agentskills.io specifications.
 */

import { chromium } from "playwright";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

function generateOverlayHtml({
  tag = "AI TUTORIAL",
  tagBg = "#6366F1",
  title = "Step-by-Step Guide",
  sub = "Interactive Tutorial",
  badges = [
    { text: "✨ In-Browser Visual HUD Overlay", color: "#38BDF8" },
    { text: "🎙️ Localized Neural Voiceovers", color: "#34D399" },
    { text: "🚀 Autonomous Publishing", color: "#F472B6" }
  ],
  footer = "Open Source on GitHub",
  rtl = false
}) {
  return `<!DOCTYPE html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1080px;
      height: 1920px;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Geeza Pro", "Segoe UI", Roboto, sans-serif;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 100px 50px;
    }
    
    .glass-card {
      background: rgba(15, 23, 42, 0.82);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 2px solid rgba(255, 255, 255, 0.16);
      border-radius: 36px;
      padding: 44px 48px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    }
    
    .tag {
      display: inline-block;
      padding: 10px 24px;
      border-radius: 9999px;
      background: ${tagBg};
      color: white;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 1px;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    
    h1 {
      font-size: 48px;
      font-weight: 900;
      color: #FFFFFF;
      line-height: 1.25;
      margin-bottom: 16px;
    }
    
    p.subtitle {
      font-size: 28px;
      color: #94A3B8;
      line-height: 1.4;
      font-weight: 500;
    }
    
    .badges {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 32px;
    }
    
    .badge-item {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 32px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 18px 24px;
      border-radius: 20px;
    }
    
    .footer {
      font-size: 24px;
      font-weight: 600;
      color: #60A5FA;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      padding-top: 24px;
    }
  </style>
</head>
<body>
  <!-- Header Card -->
  <div class="glass-card">
    <div class="tag">${tag}</div>
    <h1>${title}</h1>
    <p class="subtitle">${sub}</p>
  </div>

  <!-- Space in center for 1080x608 video -->
  <div style="height: 608px;"></div>

  <!-- Bottom Card -->
  <div class="glass-card">
    <div class="badges">
      ${badges.map((b) => `<div class="badge-item" style="color: ${b.color};">${b.text}</div>`).join("")}
    </div>
    <div class="footer">${footer}</div>
  </div>
</body>
</html>`;
}

/**
 * Builds a 9:16 vertical short from an input 16:9 tutorial video.
 */
export async function buildVerticalShort(inputVideo, outputShort, config = {}) {
  if (!fs.existsSync(inputVideo)) {
    throw new Error(`Input video not found: ${inputVideo}`);
  }

  const outDir = path.dirname(path.resolve(outputShort));
  fs.mkdirSync(outDir, { recursive: true });

  const tempOverlayPath = path.join(os.tmpdir(), `short_overlay_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);

  console.log(`[build_shorts] Rendering 1080x1920 overlay via Playwright...`);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1
    });

    const isRtl = Boolean(config.rtl || /[\u0600-\u06FF]/.test(config.title || ""));
    const html = generateOverlayHtml({
      tag: config.tag || "AI TUTORIAL",
      tagBg: config.tagBg || "#10B981",
      title: config.title || "Step-by-Step Guide",
      sub: config.sub || "Interactive Tutorial",
      badges: config.badges || [
        { text: "✨ In-Browser Visual HUD", color: "#38BDF8" },
        { text: "🎙️ Localized Voiceovers", color: "#34D399" },
        { text: "🚀 Autonomous Publishing", color: "#F472B6" }
      ],
      footer: config.footer || "github.com/yasircs4/interactive-tutorial-video",
      rtl: isRtl
    });

    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: tempOverlayPath, omitBackground: true });
  } finally {
    await browser.close();
  }

  console.log(`[build_shorts] Compositing vertical short via FFmpeg...`);
  // FFmpeg compositing:
  // 1. in_bg: scale and blur original video
  // 2. in_fg: scale video to 1080x608, center vertically at y=656
  // 3. overlay rendered PNG on top
  const filterComplex = [
    "[0:v]split=2[in_bg][in_fg];",
    "[in_bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5,eq=brightness=-0.3:contrast=1.25[bg];",
    "[in_fg]scale=1080:608[fg];",
    "[bg][fg]overlay=0:656[base];",
    "[base][1:v]overlay=0:0[out_v]"
  ].join("");

  const ffmpegArgs = [
    "-y",
    "-i", inputVideo,
    "-i", tempOverlayPath,
    "-filter_complex", filterComplex,
    "-map", "[out_v]",
    "-map", "0:a?",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-ac", "2",
    "-b:a", "192k",
    outputShort
  ];

  try {
    execFileSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
    console.log(`[build_shorts] Success: Created 1080x1920 short at: ${outputShort}`);
  } finally {
    if (fs.existsSync(tempOverlayPath)) {
      fs.unlinkSync(tempOverlayPath);
    }
  }
}

// CLI Execution Support
if (process.argv[1] && process.argv[1].endsWith("build_shorts.js")) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node build_shorts.js <input.mp4> <output_short.mp4> [--title '...'] [--tag '...']");
    process.exit(1);
  }

  const [inputVideo, outputShort] = args;
  const config = {};

  const titleIdx = args.indexOf("--title");
  if (titleIdx !== -1 && args[titleIdx + 1]) config.title = args[titleIdx + 1];

  const tagIdx = args.indexOf("--tag");
  if (tagIdx !== -1 && args[tagIdx + 1]) config.tag = args[tagIdx + 1];

  const subIdx = args.indexOf("--sub");
  if (subIdx !== -1 && args[subIdx + 1]) config.sub = args[subIdx + 1];

  buildVerticalShort(inputVideo, outputShort, config)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[build_shorts] Failed:", err.message);
      process.exit(1);
    });
}
