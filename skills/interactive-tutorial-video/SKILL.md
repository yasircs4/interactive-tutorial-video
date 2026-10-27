---
name: interactive-tutorial-video
description: Record interactive full HD tutorial videos with dynamic visual HUD overlays (spotlight rings, smart virtual cursor, animated ripple waves, collision-safe tooltip pills, glassmorphism banners), synchronize localized neural voiceovers (edge-tts + ffmpeg), generate automated captions, and autonomously upload and manage unlisted playlists on YouTube Studio using active macOS browser sessions or Playwright profiles.
license: MIT
metadata:
  author: yasircs4
  repository: https://github.com/yasircs4/interactive-tutorial-video
---

# Interactive Tutorial Video

An open Agent Skill for autonomously producing production-grade, interactive tutorial videos from browser applications, synchronizing localized neural voiceovers, generating captions, and publishing them directly to YouTube with automated playlist organization.

Traditional automated screen recordings often suffer from two major problems: viewers get lost without clear visual focal points, and voiceovers feel mechanical, poorly timed, or truncated. This skill solves both challenges through a dependable five-layer pipeline:

1. **Navigation-Safe Visual HUD Engine:** Injects animated spotlight halos, a virtual vector cursor, expanding click ripples, pointing tooltip pills, and frosted-glass step banners directly into the DOM during Playwright recordings. Automatically re-injects across page loads and form navigations via `page.addInitScript`, scrolls off-screen elements into view before measuring, and automatically flips tooltips to avoid viewport edge clipping.
2. **Unified Timeline & Duration-Aware Narration:** Drives recording pacing directly from narration duration (`TutorialSession` / `narrate`). Prevents audio truncation by automatically holding the last video frame if narration exceeds recording duration. Generates synchronized `.srt` and `.vtt` captions and enforces broadcast EBU R128 loudness normalization (`-16 LUFS`).
3. **Universal H.264 MP4 Transcoding:** Transcodes raw Playwright WebM (VP8/VP9) into standardized, QuickTime/Safari/iOS-compatible 1080p H.264/AAC MP4 with `yuv420p` pixel format and `+faststart` web streaming flags.
4. **Autonomous YouTube Studio Session Uploader:** Utilizes active browser sessions on macOS via Keychain decryption or dedicated Playwright profiles to upload Full HD videos, verify publication status via provider readback, organize videos into unlisted playlists, and track video file hashes in a local ledger to prevent duplicate uploads.
5. **Mobile 9:16 Shorts Generator:** Converts 16:9 tutorial videos into vertical 9:16 (1080x1920) YouTube Shorts, TikToks, and Instagram Reels with blurred motion background and glassmorphic branding overlays.

---

## When to use this skill

Activate this skill when:
- Creating software walk-throughs, onboarding guides, or feature demos for clients and end users.
- Explaining complex flows (such as checkout, invoicing, settings, inventory, or reports) where visual clarity is paramount.
- Generating localized Arabic or multilingual training suites with native dialect accents (Libyan, Saudi, Egyptian, Gulf, or English).
- Automating the end-to-end publishing pipeline from code execution to unlisted YouTube playlists ready to send via WhatsApp, email, or client portals.
- Producing vertical 9:16 video shorts for mobile social marketing.

---

## Architecture & Components

```text
+-----------------------------------------------------------------------------------+
| 1. RECORDING PHASE (Playwright + page.addInitScript DOM Overlay Injection)         |
|    - Inject CSS animations (pulseHalo, rippleEffect, glassmorphic HUD)            |
|    - Smart Virtual Cursor follows actions smoothly via cubic-bezier transitions   |
|    - Scroll-before-measurement prevents off-screen misplaced highlights          |
|    - Collision detection automatically flips tooltips near screen edges           |
|    - Responsive HUD banners stay within mobile (390px) and desktop boundaries     |
|    - Output: Raw 1080p WebM recording + timeline manifest                         |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| 2. AUDIO SYNTHESIS & TIMELINE MUXING (edge-tts + ffmpeg)                          |
|    - Synthesize discrete voice segments (e.g. ar-LY-ImanNeural, ar-SA-Zariyah)    |
|    - Construct ffmpeg filter_complex with adelay & amix (zero dropout)            |
|    - Duration guard: holds final video frame if narration exceeds recording time  |
|    - Apply EBU R128 loudness normalization (-16 LUFS) & AAC audio encoding        |
|    - Export synchronized WebVTT & SubRip (.srt) caption files                     |
|    - Output: Universal High-fidelity Voiced 1080p H.264 MP4 video                 |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| 3. AUTONOMOUS YOUTUBE STUDIO DISTRIBUTION (Playwright + Profile / Keychain)       |
|    - Read encrypted Chrome cookie store via PBKDF2 + AES-128-CBC or profile       |
|    - Universal SQLite support across Node 18, 20, 22, 24+ (built-in fallback)     |
|    - Upload MP4, fill metadata, set "Not made for kids", choose unlisted          |
|    - Automatically create and populate unlisted playlist in sequence              |
|    - Deduplicate uploads via SHA-256 upload ledger                                |
|    - Confirm published video ID via provider readback before exit                 |
|    - Output: Shareable video URLs & playlist link ready for client delivery       |
+-----------------------------------------------------------------------------------+
```

---

## Installation & Setup

### Install via the skills CLI

```bash
npx skills add yasircs4/interactive-tutorial-video -g -a '*' -y
```

### Dependencies

Ensure the following tools are present in your environment:
- Node.js 18+ with `playwright`
- Python 3.9+ with `edge-tts` (v7.3.1+)
- `ffmpeg` (with `libx264` and `aac` enabled) and `ffprobe`
- macOS Google Chrome or Brave (for zero-auth session uploads) or Playwright profile

```bash
# Install Playwright
npm install -g playwright
# or in local project
pnpm add -D playwright

# Install edge-tts
pip install edge-tts
```

### Verify Environment with Doctor

```bash
npm run doctor
```

---

## Step-by-Step Usage Guide

### Step 1: Record Interactive Flow with Visual Overlays

Import `tutorial_engine.js` into your Playwright script:

```javascript
import { chromium } from "playwright";
import {
  setupInteractiveEngine,
  highlight,
  highlightAndClick,
  typeWithFocus,
  showBanner,
  zoomTo,
  narrate,
  getTimeline,
  sleep,
} from "./scripts/tutorial_engine.js";
import { convertToH264 } from "./scripts/convert_video.js";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: {
    dir: "./output/videos",
    size: { width: 1920, height: 1080 },
  },
  viewport: { width: 1920, height: 1080 },
});

const page = await context.newPage();
await page.goto("https://app.example.com/pos");

// Initialize in-browser HUD overlays
await setupInteractiveEngine(page, { accentColor: "#10b981" });

// Narration automatically controls HUD banner and video pacing without manual delays
await narrate(page, "مرحباً بكم. سنشرح اليوم دورة البيع الكاملة.", {
  banner: {
    badge: "الخطوة 1 من 4",
    title: "اختيار المنتجات",
    subtitle: "انقر على أي صنف لإضافته مباشرة إلى تذكرة العميل",
  },
  durationMs: 2500,
});

// Highlight target element, move virtual cursor, click with ripple animation
// Target is automatically scrolled into view before measurement
// Optional verification predicate or expectSelector guarantees action succeeded
await highlightAndClick(page, ".product-card:first-child", {
  label: "Add Bluetooth Headphones",
  highlightDuration: 1200,
  verify: "#pos-cart-badge"
});

// Selective zoom into dense interface elements
await zoomTo(page, "input#discount-input", 1.5);

// Focus an input field with spotlight and type text naturally
await typeWithFocus(page, "input#discount-input", "10", {
  label: "Apply 10% Discount",
  verify: async (p) => (await p.inputValue("input#discount-input")) === "10"
});

// Reset zoom back to normal view
await zoomTo(page, null, 1);

const videoPath = await page.video().path();
const timeline = getTimeline(page);
await context.close();
await browser.close();

// Transcode raw WebM to universal H.264 MP4 (30 fps, Stereo AAC)
convertToH264(videoPath, "./output/videos/tutorial.mp4");
```

### Step 2: Synthesize & Mux Localized Voiceovers with Captions

Run the muxer script to synthesize neural voiceover, apply loudness normalization, hold the last frame if needed, and export captions:

```bash
python3 ./scripts/mux_voiceover.py \
  --video ./output/videos/tutorial.mp4 \
  --manifest ./output/videos/demo_timeline.json \
  --output ./output/videos/tutorial_voiced.mp4 \
  --voice "ar-LY-ImanNeural" \
  --rate "+10%" \
  --export-captions
```

Supported popular voices:
- Libyan Arabic: `ar-LY-ImanNeural`
- Saudi Arabic: `ar-SA-ZariyahNeural` / `ar-SA-HamedNeural`
- Egyptian Arabic: `ar-EG-SalmaNeural` / `ar-EG-ShakirNeural`
- UAE Arabic: `ar-AE-FatimaNeural` / `ar-AE-HamdanNeural`
- English (US): `en-US-JennyNeural` / `en-US-GuyNeural`
- English (UK): `en-GB-SoniaNeural`

### Step 3: Inspect Video Quality & Broadcast Standards

```bash
python3 ./scripts/quality_report.py --video ./output/videos/tutorial_voiced.mp4
```

### Step 4: Upload & Group into Playlists Autonomously

Prepare an upload manifest `upload_plan.json`:

```json
{
  "playlistTitle": "Taiba Store - Point of Sale Training",
  "videos": [
    {
      "file": "./output/videos/tutorial_01.mp4",
      "title": "01 - Point of Sale & Invoicing | Store Tutorial",
      "description": "Full guide to cash payments, customer tickets, and change calculation.",
      "visibility": "unlisted"
    },
    {
      "file": "./output/videos/tutorial_02.mp4",
      "title": "02 - Product Creation & Barcodes | Store Tutorial",
      "description": "Guide to creating products, entering purchase costs, and printing barcodes.",
      "visibility": "unlisted"
    }
  ]
}
```

Execute the session uploader:

```bash
node ./scripts/youtube_session_uploader.js upload_plan.json
```

---

## Technical Highlights: macOS Chrome Session Decryption

On macOS, Google Chrome secures stored session cookies using Keychain services:
1. The master password is retrieved from Keychain using the generic password query for `Chrome Safe Storage`.
2. A 128-bit encryption key is derived via PBKDF2 using the static salt `saltysalt`, 1003 iterations, and SHA1 digest.
3. The cookie SQLite file (`~/Library/Application Support/Google/Chrome/Default/Cookies`) is copied to a temporary location to prevent SQLite lock contention.
4. Encrypted cookies starting with version tag `v10` are decrypted using AES-128-CBC with an initialization vector consisting of 16 space characters (`0x20`).
5. On modern Chromium releases, the decrypted payload contains a 32-byte HMAC prefix followed by the UTF-8 cookie value and PKCS7 padding.
6. The script extracts valid `google.com` and `youtube.com` session cookies and injects them directly into Playwright, completely bypassing login screens and 2FA prompts.
7. Compatible with Node 18, 20, 22, and 24+ via native SQLite or automated Python fallback.

---

## Quality Checklist for Produced Tutorials

- **Resolution:** Full HD 1080p (1920x1080 horizontal or 1080x1920 vertical).
- **Video Codec:** H.264 (`yuv420p`, high profile, `+faststart` web-optimized, 25–60 fps).
- **Audio:** AAC 192kbps (mono or stereo), normalized volume (`-16 LUFS`), zero clipping.
- **Pacing:** Allow at least 1000ms pause after major screen transitions; narration drives timing.
- **HUD Visibility:** Ensure the spotlight ring does not obscure critical buttons or text inputs.
- **Target Pill Alignment:** Automatic collision detection flips tooltips located in top 70px to bottom position.
- **Deduplication:** Upload ledger records file hashes to guarantee idempotent runs.
- **File Size:** Target under 10MB per minute of video for seamless WhatsApp and mobile sharing.
