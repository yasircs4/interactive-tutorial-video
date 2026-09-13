# Interactive Tutorial Video

[![skills.sh installs](https://skills.sh/b/yasircs4/interactive-tutorial-video)](https://skills.sh/yasircs4/interactive-tutorial-video)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Format: Agent Skills](https://img.shields.io/badge/Agent_Skills-Compliant-blue.svg)](https://agentskills.io/specification)

An open Agent Skill for autonomously recording interactive full HD tutorial videos from web applications, synchronizing localized neural voiceovers, and publishing them directly to YouTube with automated playlist organization.

Built for AI coding agents (Claude Code, OpenAI Codex, Cursor, Windsurf, Trae, Roo, Qoder, and others) to transform routine software walkthroughs into engaging, high-retention video guides.

---

## Live Interactive Showcase

<div align="center">
  <video src="assets/showcase_demo.mp4" controls width="100%" poster="assets/cover.svg">
    Your browser does not support the video tag.
  </video>
  <p><em>Full HD 1080p interactive tutorial demonstrating pulsating spotlight rings, smart virtual cursor, click ripple waves, floating tooltip pills, and synchronized neural voiceover.</em></p>
</div>

---

## Why this skill?

Automated browser recordings typically look flat: viewers struggle to locate which button was pressed or why a certain menu opened, and synthetic voices often sound unnatural or out of sync.

`interactive-tutorial-video` delivers a complete three-pillar solution:

1. **In-Browser Visual HUD Engine:** Dynamically injects pulsing spotlight halos, a virtual vector cursor with smooth bezier curves, expanding click ripple waves, pointing tooltip pills, and frosted-glass step banners.
2. **Synchronized Neural Voiceovers:** Generates natural speech across multiple dialects (including Libyan Arabic, Saudi Arabic, Egyptian Arabic, Gulf Arabic, and English) and aligns each audio cue to the exact millisecond using ffmpeg filters.
3. **Autonomous YouTube Studio Distribution:** Extracts active Chrome sessions on macOS via Keychain decryption to upload Full HD videos and organize them into unlisted or public playlists without OAuth registration or API quota bottlenecks.

---

## Live Case Study: Taiba Store (Soluq, Libya)

This pipeline was used in production to produce and deliver a complete 5-video training suite for an Odoo point-of-sale deployment in Soluq, Libya. All videos were recorded in 1080p, voiced in Libyan Arabic (`ar-LY-ImanNeural`), and automatically uploaded to an unlisted playlist:

- **Unlisted YouTube Playlist:** [Watch on YouTube](https://www.youtube.com/playlist?list=PLE7Mvo3W8zQY)
- **Included Guides:**
  1. Point of Sale & Invoicing (`https://youtu.be/pYSKsM36a6U`)
  2. Adding Products & Barcodes (`https://youtu.be/Fk6MNPHcovY`)
  3. Daily Sales Reports & Inventory (`https://youtu.be/i09uR8dsTK8`)
  4. Cash Drawer Closing & Expenses (`https://youtu.be/UgEeuq5iZ0I`)
  5. Returns & Exchanges (`https://youtu.be/Tlv0EqR5l1s`)

---

## Installation

### Install globally for all agents

```bash
npx skills add yasircs4/interactive-tutorial-video -g -a '*' -y
```

### Install for specific agents

For Codex:
```bash
npx skills add yasircs4/interactive-tutorial-video -g -a codex -y
```

For Claude Code:
```bash
npx skills add yasircs4/interactive-tutorial-video -g -a claude-code -y
```

For Cursor, Windsurf, Trae, and others:
```bash
npx skills add yasircs4/interactive-tutorial-video -g -a cursor -y
```

---

## Quick Start

### 1. In-Browser Recording with Visual Overlays

```javascript
import { chromium } from "playwright";
import { setupInteractiveEngine, highlightAndClick, showBanner } from "./skills/interactive-tutorial-video/scripts/tutorial_engine.js";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: "./videos", size: { width: 1920, height: 1080 } },
  viewport: { width: 1920, height: 1080 }
});
const page = await context.newPage();
await page.goto("https://my-app.example.com");

// Setup the HUD engine
await setupInteractiveEngine(page, { accentColor: "#10b981" });

// Display HUD banner
await showBanner(page, "Step 1", "Create Invoice", "Click here to initialize customer order", 2000);

// Focus and click target with spotlight & animated ripple
await highlightAndClick(page, "button#new-order", { label: "New Order" });

await context.close();
await browser.close();
```

### 2. Add Synchronized Neural Voiceover

```bash
python3 ./skills/interactive-tutorial-video/scripts/mux_voiceover.py \
  --video ./videos/tutorial.mp4 \
  --manifest ./timeline.json \
  --voice "ar-LY-ImanNeural"
```

### 3. Upload to YouTube & Create Playlist

```bash
node ./skills/interactive-tutorial-video/scripts/youtube_session_uploader.js manifest.json
```

---

## Technical Details: Zero-Auth macOS Session Extraction

On macOS, Google Chrome encrypts session cookies using AES-128-CBC with a master password stored securely in Keychain.

`youtube_session_uploader.js` automates the following sequence:
1. Queries the Keychain for `Chrome Safe Storage` via the macOS `security` CLI.
2. Derives the 16-byte key using PBKDF2 (`saltysalt`, 1003 iterations, SHA1).
3. Safely clones the locked cookie database from `~/Library/Application Support/Google/Chrome/Default/Cookies`.
4. Decrypts `google.com` and `youtube.com` cookies by stripping the 32-byte HMAC prefix and removing PKCS7 padding.
5. Injects active authentication state into Playwright, granting instant access to YouTube Studio without SMS codes or OAuth permissions.

---

## Project Structure

```text
interactive-tutorial-video/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── package.json
├── SKILL.md
├── skills/
│   └── interactive-tutorial-video/
│       ├── SKILL.md
│       ├── agents/
│       │   └── openai.yaml
│       └── scripts/
│           ├── tutorial_engine.js
│           ├── mux_voiceover.py
│           └── youtube_session_uploader.js
└── examples/
    ├── full_tutorial_flow.js
    ├── manifest_example.json
    └── prompts.md
```

---

## Author & License

Created by **Yasir Najeep** ([yasirnajeep.com](https://yasirnajeep.com) | `info@maisra.net`).

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
