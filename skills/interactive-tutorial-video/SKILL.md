---
name: interactive-tutorial-video
description: Record interactive full HD tutorial videos with dynamic visual HUD overlays (spotlight rings, smart virtual cursor, animated ripple waves, tooltip pills, glassmorphism banners), synchronize localized neural voiceovers (edge-tts + ffmpeg), and autonomously upload and manage unlisted playlists on YouTube Studio using active macOS browser sessions.
license: MIT
metadata:
  author: yasircs4
  repository: https://github.com/yasircs4/interactive-tutorial-video
---

# Interactive Tutorial Video

An open Agent Skill for autonomously producing production-grade, interactive tutorial videos from browser applications and publishing them directly to YouTube with automated playlist organization.

Traditional automated screen recordings often suffer from two major problems: viewers get lost without clear visual focal points, and voiceovers feel mechanical or poorly timed. This skill solves both challenges through a three-layer pipeline:

1. **Visual HUD Engine:** Injects animated spotlight halos, a virtual vector cursor, expanding click ripples, pointing tooltip pills, and frosted-glass step banners directly into the DOM during Playwright recordings.
2. **Localized Neural Voiceover Muxer:** Synthesizes natural speech across multiple dialects (such as Libyan Arabic, Saudi Arabic, Egyptian Arabic, or English) using high-fidelity neural voices, then aligns every phrase with video actions using ffmpeg timestamp filters.
3. **Autonomous YouTube Studio Session Uploader:** Utilizes active browser sessions on macOS by deriving decryption keys from Keychain to upload Full HD videos and organize them into unlisted or public playlists without tedious API quotas or OAuth setup.

---

## When to use this skill

Activate this skill when:
- Creating software walk-throughs, onboarding guides, or feature demos for clients and end users.
- Explaining complex flows (such as checkout, invoicing, settings, inventory, or reports) where visual clarity is paramount.
- Generating localized Arabic or multilingual training suites with native dialect accents.
- Automating the end-to-end publishing pipeline from code execution to unlisted YouTube playlists ready to send via WhatsApp, email, or client portals.

---

## Architecture & Components

```text
+-----------------------------------------------------------------------------------+
| 1. RECORDING PHASE (Playwright + DOM Overlay Injection)                           |
|    - Inject CSS animations (pulseHalo, rippleEffect, glassmorphic HUD)            |
|    - Smart Virtual Cursor follows actions smoothly via cubic-bezier transitions   |
|    - Pulsating Spotlight Rings frame target elements                              |
|    - Tooltip pills display action hints ("Click here to confirm")                 |
|    - Output: Raw Full HD 1080p MP4 recording                                      |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| 2. AUDIO SYNTHESIS & TIMELINE MUXING (edge-tts + ffmpeg)                          |
|    - Synthesize discrete voice segments (e.g. ar-LY-ImanNeural, ar-SA-Zariyah)    |
|    - Construct ffmpeg filter_complex with adelay & amix (zero dropout)            |
|    - Apply loudness normalization & AAC audio encoding                            |
|    - Output: High-fidelity Voiced 1080p MP4 video                                 |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| 3. AUTONOMOUS YOUTUBE STUDIO DISTRIBUTION (Playwright + macOS Keychain)           |
|    - Read encrypted Chrome cookie store via PBKDF2 + AES-128-CBC                  |
|    - Launch authenticated browser context into YouTube Studio                     |
|    - Upload MP4, fill metadata, set "Not made for kids", choose unlisted          |
|    - Automatically create and populate unlisted playlist in sequence              |
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
- Python 3.9+ with `edge-tts`
- `ffmpeg` and `ffprobe`
- macOS Google Chrome (for zero-auth session uploads)

```bash
# Install Playwright
npm install -g playwright
# or in local project
pnpm add -D playwright

# Install edge-tts in a lightweight virtual environment
python3 -m venv /tmp/tts_venv
/tmp/tts_venv/bin/pip install edge-tts
```

---

## Step-by-Step Usage Guide

### Step 1: Record Interactive Flow with Visual Overlays

Import `tutorial_engine.js` into your Playwright script:

```javascript
import { chromium } from "playwright";
import {
  setupInteractiveEngine,
  highlightAndClick,
  typeWithFocus,
  showBanner,
  sleep,
} from "./scripts/tutorial_engine.js";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: {
    dir: "./videos",
    size: { width: 1920, height: 1080 },
  },
  viewport: { width: 1920, height: 1080 },
});

const page = await context.newPage();
await page.goto("https://app.example.com/pos");

// Initialize the HUD engine with your brand accent color
await setupInteractiveEngine(page, { accentColor: "#10b981" });

// Display step introduction banner
await showBanner(
  page,
  "Step 1 of 4",
  "Product Selection",
  "Click any item to immediately append it to the sales ticket",
  2000
);

// Highlight target element, move virtual cursor, click with ripple animation
await highlightAndClick(page, ".product-card:first-child", {
  label: "Add Bluetooth Headphones",
  highlightDuration: 1200,
});

// Focus an input field with spotlight and type text naturally
await typeWithFocus(page, "input#discount-input", "10", {
  label: "Apply 10% Discount",
});

await context.close();
await browser.close();
```

### Step 2: Synthesize & Mux Localized Voiceovers

Create a timeline manifest mapping millisecond delays to speech segments:

```json
{
  "segments": [
    {
      "delay_ms": 0,
      "text": "Welcome. In this tutorial we will review the complete checkout flow."
    },
    {
      "delay_ms": 9500,
      "text": "Click on any product card to add it directly to the customer ticket."
    },
    {
      "delay_ms": 22000,
      "text": "Next, click Validate to record payment and print the store receipt."
    }
  ]
}
```

Run the muxer script:

```bash
python3 ./scripts/mux_voiceover.py \
  --video ./videos/tutorial_01.mp4 \
  --manifest ./manifests/tutorial_01.json \
  --voice "ar-LY-ImanNeural" \
  --rate "+10%"
```

Supported popular voices:
- Libyan Arabic: `ar-LY-ImanNeural`
- Saudi Arabic: `ar-SA-ZariyahNeural` / `ar-SA-HamedNeural`
- Egyptian Arabic: `ar-EG-SalmaNeural` / `ar-EG-ShakirNeural`
- UAE Arabic: `ar-AE-FatimaNeural` / `ar-AE-HamdanNeural`
- English (US): `en-US-JennyNeural` / `en-US-GuyNeural`
- English (UK): `en-GB-SoniaNeural`

### Step 3: Upload & Group into Playlists Autonomously

Prepare an upload manifest `upload_plan.json`:

```json
{
  "channelId": "UCKfnpnZhtsqSIX-jMandGPg",
  "videos": [
    {
      "file": "./videos/tutorial_01.mp4",
      "title": "01 - Point of Sale & Invoicing | Store Tutorial",
      "description": "Full guide to cash payments, customer tickets, and change calculation.",
      "visibility": "unlisted"
    },
    {
      "file": "./videos/tutorial_02.mp4",
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

---

## Quality Checklist for Produced Tutorials

- **Resolution:** Full HD 1080p (1920x1080) at 30 or 60 fps.
- **Audio:** AAC 192kbps stereo, normalized volume, zero clipping or dropout.
- **Pacing:** Allow at least 1000ms pause after major screen transitions so viewers can orient themselves.
- **HUD Visibility:** Ensure the spotlight ring does not obscure critical buttons or text inputs.
- **Target Pill Alignment:** Use `pillPos: "bottom"` when target elements are located in the top 15% of the viewport to prevent off-screen clipping.
- **File Size:** Target under 10MB per minute of video for seamless WhatsApp and mobile sharing.
