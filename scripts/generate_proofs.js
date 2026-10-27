#!/usr/bin/env node
/**
 * Visual Proof Generator for Interactive Tutorial Video Skill
 * 
 * Captures real visual proof artifacts across desktop, mobile (390px),
 * and vertical (1080x1920) short formats to verify zero overflow,
 * crisp HUD overlays, and broadcast dimensions.
 */

import { chromium } from "playwright";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  setupInteractiveEngine,
  showBanner,
  highlight,
  sleep
} from "../skills/interactive-tutorial-video/scripts/tutorial_engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PROOFS_DIR = path.join(ROOT_DIR, "output/proofs");
const FIXTURE_PATH = "file://" + path.join(ROOT_DIR, "examples/fixture/demo_app.html");

fs.mkdirSync(PROOFS_DIR, { recursive: true });

function getImageDimensions(filePath) {
  const probeRaw = execFileSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "json",
    filePath
  ], { encoding: "utf-8" });
  const probe = JSON.parse(probeRaw);
  const stream = probe.streams && probe.streams[0];
  if (!stream) throw new Error(`Could not read streams from ${filePath}`);
  return { width: stream.width, height: stream.height };
}

async function generateProofs() {
  console.log("=================================================");
  console.log(" Generating Real Visual Screenshot Proofs");
  console.log("=================================================\n");

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop 1920x1080 Tutorial HUD In Action
    console.log("[1/3] Rendering Desktop 1920x1080 Tutorial HUD...");
    const desktopPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await desktopPage.goto(FIXTURE_PATH, { waitUntil: "networkidle" });
    await setupInteractiveEngine(desktopPage, {
      accentColor: "#10b981",
      secondaryColor: "#34d399"
    });

    // Authorize & advance to step 2 in demo fixture
    await desktopPage.fill("input#email", "cashier@taiba.ly");
    await desktopPage.fill("input#password", "12345678");
    await desktopPage.click("button#login-btn");
    await desktopPage.waitForSelector("#pos-section", { state: "visible" });
    await sleep(200);

    // Show HUD Banner
    await showBanner(
      desktopPage,
      "الخطوة 2 من 4 • Step 2 of 4",
      "اختيار المنتجات / Product Catalog",
      "انقر على أي صنف لإدراجه مباشرة في تذكرة العميل",
      0
    );

    // Spotlight on first product card using first-class highlight API
    const firstProduct = desktopPage.locator(".product-card").first();
    const box = await highlight(desktopPage, firstProduct, {
      label: "Wireless Headphones (45.00 LYD)",
      shape: "rect",
      pillPos: "top"
    });
    await desktopPage.evaluate(({ box }) => {
      window.__tutorialClickRipple?.(box.x + box.width / 2, box.y + box.height / 2);
    }, { box });
    await sleep(400);

    const desktopPath = path.join(PROOFS_DIR, "desktop_hud_1920x1080.png");
    await desktopPage.screenshot({ path: desktopPath });
    await desktopPage.close();

    const desktopDims = getImageDimensions(desktopPath);
    console.log(`  -> Saved: ${desktopPath}`);
    console.log(`  -> Dimensions: ${desktopDims.width}x${desktopDims.height} (Expected: 1920x1080)`);
    if (desktopDims.width !== 1920 || desktopDims.height !== 1080) {
      throw new Error(`Desktop proof dimension mismatch: ${desktopDims.width}x${desktopDims.height}`);
    }

    // 2. Mobile 390x844 Responsive HUD Banner (Zero Overflow)
    console.log("\n[2/3] Rendering Mobile 390x844 Responsive HUD Banner...");
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobilePage.goto(FIXTURE_PATH, { waitUntil: "networkidle" });
    await setupInteractiveEngine(mobilePage, {
      accentColor: "#10b981",
      secondaryColor: "#34d399"
    });

    // Show responsive banner with long Arabic & English strings
    await showBanner(
      mobilePage,
      "الخطوة 1 من 4 • Step 1 of 4",
      "تسجيل الدخول / Authentication",
      "أدخل بيانات الكاشير المعتمدة لفتح الوردية اليومية في النظام",
      0
    );

    // Spotlight email input using first-class highlight API
    await highlight(mobilePage, "input#email", {
      label: "Cashier Email / البريد",
      shape: "rect",
      pillPos: "top"
    });
    await sleep(400);

    // Measure banner bounds in 390px viewport
    const bannerMetrics = await mobilePage.evaluate(() => {
      const banner = document.querySelector("#tutorial-hud-banner");
      const r = banner.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        width: r.width,
        left: r.left,
        right: r.right,
        overflowsLeft: r.left < 0,
        overflowsRight: r.right > window.innerWidth
      };
    });

    console.log(`  -> Mobile Banner Metrics in 390px Viewport:`, bannerMetrics);
    if (bannerMetrics.width > 358) {
      throw new Error(`Mobile banner width (${bannerMetrics.width}px) exceeds max allowed (358px)`);
    }
    if (bannerMetrics.overflowsLeft || bannerMetrics.overflowsRight) {
      throw new Error(`Mobile banner overflows screen: left=${bannerMetrics.left}, right=${bannerMetrics.right}`);
    }

    const mobilePath = path.join(PROOFS_DIR, "mobile_hud_390x844.png");
    await mobilePage.screenshot({ path: mobilePath });
    await mobilePage.close();

    const mobileDims = getImageDimensions(mobilePath);
    console.log(`  -> Saved: ${mobilePath}`);
    console.log(`  -> Dimensions: ${mobileDims.width}x${mobileDims.height} (Expected: 390x844)`);
    if (mobileDims.width !== 390 || mobileDims.height !== 844) {
      throw new Error(`Mobile proof dimension mismatch: ${mobileDims.width}x${mobileDims.height}`);
    }

    // 3. Vertical Short Composite 1080x1920
    console.log("\n[3/3] Rendering 1080x1920 Vertical Short Composite...");
    const shortVideoPath = path.join(ROOT_DIR, "output/videos/demo_tutorial_short.mp4");
    const verticalPath = path.join(PROOFS_DIR, "vertical_short_1080x1920.png");

    if (fs.existsSync(shortVideoPath)) {
      // Extract frame from the real composited short video at t=14s (during POS product selection)
      execFileSync("ffmpeg", [
        "-y",
        "-ss", "00:00:14",
        "-i", shortVideoPath,
        "-frames:v", "1",
        verticalPath
      ], { stdio: "ignore" });
    } else {
      throw new Error(`Vertical short video not found at: ${shortVideoPath}. Run build_shorts.js first.`);
    }

    const verticalDims = getImageDimensions(verticalPath);
    console.log(`  -> Saved: ${verticalPath}`);
    console.log(`  -> Dimensions: ${verticalDims.width}x${verticalDims.height} (Expected: 1080x1920)`);
    if (verticalDims.width !== 1080 || verticalDims.height !== 1920) {
      throw new Error(`Vertical short dimension mismatch: ${verticalDims.width}x${verticalDims.height}`);
    }

    console.log("\n=================================================");
    console.log(" All 3 Real Proof Screenshots Verified 100%!");
    console.log("=================================================");
  } finally {
    await browser.close();
  }
}

generateProofs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Proof generation error:", err);
    process.exit(1);
  });
