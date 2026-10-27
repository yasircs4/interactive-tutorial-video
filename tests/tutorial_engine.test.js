import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  setupInteractiveEngine,
  ensureInteractiveEngine,
  highlight,
  highlightAndClick,
  showBanner,
  typeWithFocus,
  colorToRgb,
  detectDirection,
  estimateSpeechDurationMs,
  TutorialSession,
  narrate,
  getTimeline,
  zoomTo,
  createTutorialContext
} from "../skills/interactive-tutorial-video/scripts/tutorial_engine.js";

test("colorToRgb utility correctly converts hex and rgb strings", () => {
  assert.equal(colorToRgb("#10b981"), "16, 185, 129");
  assert.equal(colorToRgb("#7c3aed"), "124, 58, 237");
  assert.equal(colorToRgb("#fff"), "255, 255, 255");
  assert.equal(colorToRgb("rgb(100, 200, 50)"), "100, 200, 50");
});

test("detectDirection detects Arabic RTL and English LTR", () => {
  assert.equal(detectDirection("تسجيل الدخول"), "rtl");
  assert.equal(detectDirection("Cashier Authentication"), "ltr");
  assert.equal(detectDirection("Product #1 (المنتج الأول)"), "rtl");
});

test("estimateSpeechDurationMs provides realistic duration bounds", () => {
  const arDur = estimateSpeechDurationMs("مرحباً بكم في الشرح", "ar");
  assert.ok(arDur >= 1500, `Duration ${arDur} should be at least 1500ms`);

  const enDur = estimateSpeechDurationMs("Welcome to the interactive tutorial video guide", "en");
  assert.ok(enDur >= 1500, `Duration ${enDur} should be at least 1500ms`);
});

test("tutorial_engine in-browser HUD overlays and navigation resilience", async (t) => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body style="margin:0; background:#0f172a; height:3000px;">
        <button id="top-btn" style="position:absolute; top:10px; left:20px; padding:10px 20px;">Top Target</button>
        <input id="input-field" style="position:absolute; top:200px; left:20px; padding:10px;" value="" />
        <button id="deep-btn" style="position:absolute; top:1800px; left:20px; padding:12px 24px;">Deep Below Fold</button>
      </body>
      </html>
    `);

    // 1. Setup HUD engine with custom purple accent
    await setupInteractiveEngine(page, { accentColor: "#7c3aed" });

    // 2. Test dynamic accent glow in injected CSS
    const styleContent = await page.evaluate(() => document.getElementById("tutorial-engine-styles")?.innerHTML || "");
    assert.ok(styleContent.includes("rgba(124, 58, 237, 0.85)"), "Box shadow should use purple accent RGB");
    assert.ok(styleContent.includes("rgba(124, 58, 237, 0.12)"), "Ring background should use purple accent RGB");

    // 3. Test top target tooltip collision flip
    await page.evaluate(() => window.__tutorialHighlightBox({ x: 20, y: 10, width: 120, height: 40 }, "Top Label", "rect", "top"));
    const topPillState = await page.evaluate(() => {
      const pill = document.querySelector(".tutorial-target-pill");
      const rect = pill.getBoundingClientRect();
      return {
        isBottomFlipped: pill.classList.contains("bottom"),
        top: rect.top,
        bottom: rect.bottom
      };
    });
    assert.ok(topPillState.isBottomFlipped, "Tooltip pill should flip to 'bottom' when element is near top edge");
    assert.ok(topPillState.top >= 0, `Tooltip top (${topPillState.top}) must not be negative`);

    // 4. Test below-the-fold target scrolling before measurement
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    await highlightAndClick(page, "#deep-btn", { label: "Deep Action", highlightDuration: 200, postClickDelay: 0 });
    const scrollYAfter = await page.evaluate(() => window.scrollY);
    assert.ok(scrollYAfter > 500, `Page should scroll to deep target (current scrollY: ${scrollYAfter})`);

    // 5. Test typeWithFocus
    await typeWithFocus(page, "#input-field", "Hello World", { highlightDuration: 150 });
    const typedVal = await page.inputValue("#input-field");
    assert.equal(typedVal, "Hello World");

    // 6. Test responsive mobile HUD banner sizing (390px viewport, zero overflow)
    await page.setViewportSize({ width: 390, height: 844 });
    await showBanner(page, "Step 1", "Very Long Responsive Step Title Testing Viewport Wrapping", "Detailed subtitle explanation", 0);
    const bannerBox = await page.evaluate(() => {
      const b = document.querySelector("#tutorial-hud-banner");
      const r = b.getBoundingClientRect();
      return { width: r.width, left: r.left, right: r.right };
    });
    assert.ok(bannerBox.width <= 358, `Banner width (${bannerBox.width}px) must comfortably fit inside 390px viewport (<= 358px)`);
    assert.ok(bannerBox.left >= 15, `Banner left (${bannerBox.left}px) must have at least 16px margin from left edge`);
    assert.ok(bannerBox.right <= 375, `Banner right (${bannerBox.right}px) must not overflow 390px viewport`);

    // 7. Test selective zoom helper (zoomTo)
    // 7a. Single zoomTo
    await zoomTo(page, "#input-field", 1.8, { durationMs: 50 });
    const zoomedTransform = await page.evaluate(() => document.body.style.transform);
    assert.ok(zoomedTransform.includes("scale(1.8)"), "document.body should have scale(1.8) transform applied");

    // 7b. Consecutive zoomTo without reset: must unproject existing transform and center second target
    await zoomTo(page, "#top-btn", 2.0, { durationMs: 50 });
    const secondZoom = await page.evaluate(() => {
      const r = document.querySelector("#top-btn").getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, vw: window.innerWidth, vh: window.innerHeight };
    });
    // In 390x844 viewport, top-btn center should be within 2px of viewport center (195, 422)
    assert.ok(Math.abs(secondZoom.cx - secondZoom.vw / 2) <= 3, `Consecutive zoomTo must center X (expected ~${secondZoom.vw / 2}, got ${secondZoom.cx})`);
    assert.ok(Math.abs(secondZoom.cy - secondZoom.vh / 2) <= 3, `Consecutive zoomTo must center Y (expected ~${secondZoom.vh / 2}, got ${secondZoom.cy})`);

    // Reset zoom
    await zoomTo(page, null, 1, { durationMs: 50 });
    const resetTransform = await page.evaluate(() => document.body.style.transform);
    assert.equal(resetTransform, "none", "document.body transform should be reset to 'none'");

    // 7c. Standalone highlight method (without clicking)
    const hlBox = await highlight(page, "#top-btn", { label: "Standing Highlight", shape: "circle", pillPos: "bottom" });
    assert.ok(hlBox && hlBox.width > 0, "highlight must return valid bounding box");
    const ringExists = await page.evaluate(() => Boolean(document.getElementById("tutorial-active-ring")));
    assert.equal(ringExists, true, "Spotlight ring must be active after highlight()");

    // 8. Test Action Result Verification (highlightAndClick and typeWithFocus)
    // 8a. Successful verify predicate
    await highlightAndClick(page, "#deep-btn", {
      label: "Click With Verify",
      highlightDuration: 50,
      postClickDelay: 0,
      verify: async (p) => (await p.isVisible("#deep-btn")) === true
    });

    // 8b. Successful expectSelector
    await highlightAndClick(page, "#deep-btn", {
      label: "Click With ExpectSelector",
      highlightDuration: 50,
      postClickDelay: 0,
      expectSelector: "#deep-btn"
    });

    // 8c. Failing verify predicate throws loud error within timeout
    await assert.rejects(async () => {
      await highlightAndClick(page, "#deep-btn", {
        highlightDuration: 50,
        postClickDelay: 0,
        verifyTimeout: 300,
        verify: async () => false
      });
    }, /Action verification failed/);

    // 8d. Falsy return value (e.g. count === 0) fails within timeout
    await assert.rejects(async () => {
      await highlightAndClick(page, "#deep-btn", {
        highlightDuration: 50,
        postClickDelay: 0,
        verifyTimeout: 300,
        verify: async () => 0
      });
    }, /Action verification failed/);

    // 8e. Truthy non-boolean return value (e.g. count > 0) passes immediately
    await highlightAndClick(page, "#deep-btn", {
      label: "Click With Count",
      highlightDuration: 50,
      postClickDelay: 0,
      verify: async () => 1
    });

    // 8f. typeWithFocus successful verification
    await typeWithFocus(page, "#input-field", "Tested", {
      highlightDuration: 50,
      verify: async (p) => (await p.inputValue("#input-field")) === "Tested"
    });
    assert.equal(await page.inputValue("#input-field"), "Tested");

    // 8g. typeWithFocus failing expectSelector throws loud error
    await assert.rejects(async () => {
      await typeWithFocus(page, "#input-field", "Invalid", {
        highlightDuration: 50,
        verifyTimeout: 300,
        expectSelector: "#non-existent-selector-12345"
      });
    }, /Action verification failed/);

    // 9. Test XSS protection in labels and banners
    await page.evaluate(() => {
      window.__tutorialShowBanner("<script>window.__xss1=true</script>", "<b>Title</b>", "<img src=x onerror=window.__xss2=true>");
      window.__tutorialHighlightBox({ x: 10, y: 10, width: 50, height: 50 }, "<script>window.__xss3=true</script>");
    });
    const xssTriggered = await page.evaluate(() => Boolean(window.__xss1 || window.__xss2 || window.__xss3));
    assert.equal(xssTriggered, false, "XSS script injection must not execute");

    // 10. Test Navigation Persistence via addInitScript
    await page.goto("data:text/html,<html><body><h1>Navigated Page</h1><button id='new-btn'>Click Next</button></body></html>");
    let bannerOnNewPageWorked = false;
    try {
      await showBanner(page, "Step 2", "Page 2 Action", "Working on new document", 0);
      bannerOnNewPageWorked = await page.evaluate(() => Boolean(document.getElementById("tutorial-hud-banner")));
    } catch (e) {
      bannerOnNewPageWorked = false;
    }
    assert.ok(bannerOnNewPageWorked, "HUD overlay methods must remain functional across navigation");

    // 11. Test standalone narrate and getTimeline
    const elapsed = await narrate(page, "Test standalone narration", { durationMs: 50, banner: { title: "Narrated Step" } });
    assert.equal(elapsed, 50, "Should return elapsed narration duration");
    const timeline = getTimeline(page);
    assert.ok(Array.isArray(timeline.segments), "Timeline should contain segments array");
    assert.ok(timeline.segments.length >= 1, "Timeline should have at least 1 segment");
    assert.equal(timeline.segments[timeline.segments.length - 1].text, "Test standalone narration");

    // 12. Test createTutorialContext helper
    const testCtx = await createTutorialContext(browser, { recordDir: "/tmp" });
    assert.ok(testCtx, "createTutorialContext should return a valid BrowserContext");
    await testCtx.close();

  } finally {
    await context.close();
    await browser.close();
  }
});
