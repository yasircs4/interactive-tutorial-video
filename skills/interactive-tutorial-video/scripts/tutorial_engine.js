/**
 * Interactive Tutorial Video HUD Overlay Engine
 * 
 * Provides dynamic in-browser visual overlays during Playwright video recordings:
 * - Smart Virtual Cursor (SVG vector pointer with smooth easing)
 * - Pulsating Spotlight Rings (accent-colored target highlighting with dynamic halo)
 * - Click Ripple Waves (expanding animated pulses on interaction)
 * - Target Tooltip Pills (floating badges with collision detection and auto-placement)
 * - Glassmorphism Step Banner (responsive frosted HUD banner for step info)
 * - Navigation-safe persistence via page.addInitScript
 * - Duration-aware narration pacing via TutorialSession and narrate()
 * 
 * Compliant with agentskills.io specifications.
 */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Parses color string (hex or rgb) into comma-separated RGB values "R, G, B".
 * @param {string} colorStr
 * @returns {string}
 */
export function colorToRgb(colorStr) {
  if (!colorStr) return "16, 185, 129";
  colorStr = colorStr.trim();
  if (colorStr.startsWith("#")) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
    }
  }
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) return `${match[1]}, ${match[2]}, ${match[3]}`;
  return "16, 185, 129";
}

/**
 * Checks if a string contains Arabic or RTL characters.
 * @param {string} text
 * @returns {"rtl"|"ltr"}
 */
export function detectDirection(text) {
  if (!text) return "ltr";
  const rtlPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return rtlPattern.test(text) ? "rtl" : "ltr";
}

/**
 * In-browser engine initializer script function.
 * Injected via page.addInitScript and executed in browser context.
 */
function browserInitScript({ accent, secondary, font, accentRgb, defaultDirection }) {
  window.__tutorialEngineConfig = { accent, secondary, font, accentRgb, defaultDirection };

  function ensureStylesAndCursor() {
    if (!document.head || !document.body) return;

    if (!document.getElementById("tutorial-engine-styles")) {
      const style = document.createElement("style");
      style.id = "tutorial-engine-styles";
      style.innerHTML = `
        @keyframes tutorialPulseHalo {
          0% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(${accentRgb}, 0.85), 0 0 25px rgba(${accentRgb}, 0.5); }
          70% { transform: scale(1.02); box-shadow: 0 0 0 16px rgba(${accentRgb}, 0), 0 0 40px rgba(${accentRgb}, 0.8); }
          100% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(${accentRgb}, 0.85), 0 0 25px rgba(${accentRgb}, 0.5); }
        }
        @keyframes tutorialRipple {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; border-width: 4px; }
          100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; border-width: 1px; }
        }
        @keyframes tutorialFadeIn {
          from { opacity: 0; transform: translateY(12px) translateX(-50%); }
          to { opacity: 1; transform: translateY(0) translateX(-50%); }
        }

        /* Spotlight Ring */
        .tutorial-spotlight-ring {
          position: fixed;
          border: 3.5px solid ${accent};
          border-radius: 12px;
          pointer-events: none;
          z-index: 9999990;
          animation: tutorialPulseHalo 1.8s infinite ease-in-out;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: rgba(${accentRgb}, 0.12);
          box-sizing: border-box;
        }
        .tutorial-spotlight-ring.circle {
          border-radius: 50%;
        }

        /* Target Tooltip Pill */
        .tutorial-target-pill {
          position: absolute;
          bottom: calc(100% + 14px);
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #0f172a, #1e293b);
          border: 2px solid ${accent};
          color: #ffffff;
          font-family: ${font};
          font-size: 15px;
          font-weight: 700;
          padding: 6px 18px;
          border-radius: 30px;
          white-space: nowrap;
          box-shadow: 0 8px 25px rgba(0,0,0,0.5);
          pointer-events: none;
          letter-spacing: 0.3px;
          max-width: 88vw;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tutorial-target-pill::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 7px;
          border-style: solid;
          border-color: ${accent} transparent transparent transparent;
        }

        .tutorial-target-pill.bottom {
          bottom: auto;
          top: calc(100% + 14px);
        }
        .tutorial-target-pill.bottom::after {
          top: auto;
          bottom: 100%;
          border-color: transparent transparent ${accent} transparent;
        }

        /* Virtual Cursor */
        #tutorial-virtual-cursor {
          position: fixed;
          width: 40px;
          height: 40px;
          pointer-events: none;
          z-index: 9999998;
          transform: translate(-3px, -3px);
          transition: left 0.45s cubic-bezier(0.25, 1, 0.5, 1), top 0.45s cubic-bezier(0.25, 1, 0.5, 1);
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.7));
        }

        /* Click Ripple */
        .tutorial-click-ripple {
          position: fixed;
          width: 48px;
          height: 48px;
          border: 4px solid ${accent};
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999997;
          animation: tutorialRipple 0.7s cubic-bezier(0, 0.2, 0.8, 1) forwards;
        }

        /* Bottom Glassmorphism HUD Banner */
        #tutorial-hud-banner {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
          border: 2px solid ${accent};
          border-radius: 14px;
          color: #ffffff;
          padding: 12px 16px;
          font-family: ${font};
          text-align: center;
          box-shadow: 0 12px 35px rgba(0,0,0,0.65);
          z-index: 9999999;
          width: clamp(240px, calc(100% - 32px), 680px);
          max-width: calc(100% - 32px);
          min-width: 0;
          box-sizing: border-box;
          pointer-events: none;
          animation: tutorialFadeIn 0.35s ease-out forwards;
          word-break: break-word;
        }
      `;
      document.head.appendChild(style);
    }

    const overlayRoot = document.documentElement || document.body;

    if (!document.getElementById("tutorial-virtual-cursor")) {
      const cursor = document.createElement("div");
      cursor.id = "tutorial-virtual-cursor";
      cursor.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 3L23 12.5L13.5 15.5L9.5 24.5L4 3Z" fill="${accent}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>
      `;
      cursor.style.left = "960px";
      cursor.style.top = "540px";
      overlayRoot.appendChild(cursor);
    }
  }

  function detectRtl(text) {
    if (!text) return "ltr";
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text) ? "rtl" : "ltr";
  }

  window.__tutorialHighlightBox = (box, label, shape = "rect", pos = "top", dir = "auto") => {
    ensureStylesAndCursor();
    const overlayRoot = document.documentElement || document.body;
    let ring = document.getElementById("tutorial-active-ring");
    if (!ring) {
      ring = document.createElement("div");
      ring.id = "tutorial-active-ring";
      overlayRoot.appendChild(ring);
    }
    const pad = 8;
    ring.style.left = `${box.x - pad}px`;
    ring.style.top = `${box.y - pad}px`;
    ring.style.width = `${box.width + pad * 2}px`;
    ring.style.height = `${box.height + pad * 2}px`;
    ring.className = `tutorial-spotlight-ring ${shape}`;

    // Collision detection: flip tooltip if near viewport top edge
    let effectivePos = pos;
    if (effectivePos === "top" && box.y < 70) {
      effectivePos = "bottom";
    } else if (effectivePos === "bottom" && (box.y + box.height + 60) > window.innerHeight) {
      effectivePos = "top";
    }

    ring.replaceChildren();
    if (label) {
      const pill = document.createElement("div");
      pill.className = effectivePos === "bottom" ? "tutorial-target-pill bottom" : "tutorial-target-pill";
      pill.textContent = label;
      pill.dir = dir === "auto" ? detectRtl(label) : dir;
      ring.appendChild(pill);
    }
  };

  window.__tutorialClearHighlight = () => {
    const ring = document.getElementById("tutorial-active-ring");
    if (ring) ring.remove();
  };

  window.__tutorialMoveCursor = (x, y) => {
    ensureStylesAndCursor();
    const c = document.getElementById("tutorial-virtual-cursor");
    if (c) {
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
    }
  };

  window.__tutorialClickRipple = (x, y) => {
    ensureStylesAndCursor();
    const overlayRoot = document.documentElement || document.body;
    const rip = document.createElement("div");
    rip.className = "tutorial-click-ripple";
    rip.style.left = `${x}px`;
    rip.style.top = `${y}px`;
    overlayRoot.appendChild(rip);
    setTimeout(() => rip.remove(), 700);
  };

  window.__tutorialShowBanner = (badge, title, subtitle, dir = "auto") => {
    ensureStylesAndCursor();
    const overlayRoot = document.documentElement || document.body;
    let el = document.getElementById("tutorial-hud-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "tutorial-hud-banner";
      overlayRoot.appendChild(el);
    }

    const effectiveDir = dir === "auto" ? (defaultDirection === "auto" ? detectRtl(badge + title + subtitle) : defaultDirection) : dir;
    el.dir = effectiveDir;
    el.replaceChildren();

    if (badge) {
      const b = document.createElement("div");
      b.style.cssText = `font-size: clamp(11px, 2.8vw, 13px); font-weight: 700; color: ${secondary}; margin-bottom: 3px; letter-spacing: 0.5px;`;
      b.textContent = badge;
      el.appendChild(b);
    }

    if (title) {
      const t = document.createElement("div");
      t.style.cssText = "font-size: clamp(15px, 4vw, 19px); font-weight: 800; color: #ffffff; margin-bottom: 3px; line-height: 1.3;";
      t.textContent = title;
      el.appendChild(t);
    }

    if (subtitle) {
      const s = document.createElement("div");
      s.style.cssText = "font-size: clamp(12px, 3.2vw, 15px); font-weight: 500; color: #cbd5e1; line-height: 1.4;";
      s.textContent = subtitle;
      el.appendChild(s);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureStylesAndCursor);
  } else {
    ensureStylesAndCursor();
  }
}

/**
 * Setup and inject the visual HUD styles and virtual cursor into the page.
 * Uses page.addInitScript to guarantee overlays persist across navigation.
 * 
 * @param {import('playwright').Page} page
 * @param {Object} options
 * @param {string} options.accentColor Primary accent color (default: #10b981)
 * @param {string} options.secondaryColor Secondary accent (default: #34d399)
 * @param {string} options.fontFamily Font stack (default: system-ui)
 * @param {"auto"|"rtl"|"ltr"} options.direction Default text direction (default: auto)
 */
export async function setupInteractiveEngine(page, options = {}) {
  const {
    accentColor = "#10b981",
    secondaryColor = "#34d399",
    fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    direction = "auto"
  } = options;

  const accentRgb = colorToRgb(accentColor);
  const initPayload = {
    accent: accentColor,
    secondary: secondaryColor,
    font: fontFamily,
    accentRgb,
    defaultDirection: direction
  };

  // 1. Register init script for all future navigations & documents (both context & page)
  try {
    if (page.context && typeof page.context().addInitScript === "function") {
      await page.context().addInitScript(browserInitScript, initPayload);
    }
  } catch (e) {}

  await page.addInitScript(browserInitScript, initPayload);

  // 2. Evaluate immediately for current document
  try {
    await page.evaluate(browserInitScript, initPayload);
  } catch (e) {
    if (!isNavigationError(e)) {
      // Page might not be navigated yet; addInitScript handles it on load
    }
  }
}

/**
 * Checks if an error is a non-fatal navigation or frame detachment error during recording.
 */
function isNavigationError(err) {
  if (!err) return false;
  const msg = err.message || "";
  return msg.includes("Execution context was destroyed") ||
         msg.includes("Target page, context or browser has been closed") ||
         msg.includes("frame was detached");
}

/**
 * Ensures the interactive engine styles and virtual cursor are injected in the page.
 * If setupInteractiveEngine was not explicitly called, automatically initializes with default options.
 */
export async function ensureInteractiveEngine(page, options = {}) {
  try {
    const isReady = await page.evaluate(() => Boolean(window.__tutorialEngineConfig));
    if (isReady) return;
  } catch (e) {
    if (isNavigationError(e)) return;
  }
  await setupInteractiveEngine(page, options);
}

/**
 * Validates that an action achieved its intended result via predicate or expected selector.
 * Fails loudly with an explicit Error if verification fails within the timeout.
 */
async function runActionVerification(page, { actionName, target, verify, expectSelector, timeout = 10000 }) {
  const targetSelector = expectSelector || (typeof verify === "string" ? verify : null);
  const verifyPredicate = typeof verify === "function" ? verify : null;

  if (targetSelector) {
    try {
      await page.locator(targetSelector).first().waitFor({ state: "visible", timeout });
    } catch (err) {
      throw new Error(`[${actionName}] Action verification failed for ${String(target)}: expected selector "${targetSelector}" was not visible within ${timeout}ms.`);
    }
  }

  if (verifyPredicate) {
    const start = Date.now();
    let passed = false;
    let lastError = null;
    while (Date.now() - start < timeout) {
      try {
        const res = await verifyPredicate(page);
        // If undefined (e.g. assertion function that throws on failure) or truthy: passed
        if (typeof res === "undefined" || (Boolean(res) && res !== false)) {
          passed = true;
          break;
        }
      } catch (err) {
        lastError = err;
      }
      await sleep(100);
    }
    if (!passed) {
      const errDetail = lastError ? ` (Last error: ${lastError.message})` : " (Predicate returned false or falsy)";
      throw new Error(`[${actionName}] Action verification failed for ${String(target)}: verify predicate did not pass within ${timeout}ms${errDetail}.`);
    }
  }
}

/**
 * Highlights an element with a spotlight halo and tooltip pill, and moves virtual cursor to it.
 * Automatically scrolls element into view before measuring bounding box.
 * Unlike highlightAndClick, this leaves the highlight visible (ideal for visual proofs or holding attention).
 * 
 * @param {import('playwright').Page} page
 * @param {string|import('playwright').Locator} selectorOrLocator
 * @param {Object} [options]
 * @param {string} [options.label]
 * @param {"rect"|"circle"} [options.shape="rect"]
 * @param {"top"|"bottom"} [options.pillPos="top"]
 * @param {"auto"|"rtl"|"ltr"} [options.direction="auto"]
 * @returns {Promise<{x: number, y: number, width: number, height: number}>}
 */
export async function highlight(page, selectorOrLocator, options = {}) {
  await ensureInteractiveEngine(page, options);
  const {
    label = "",
    shape = "rect",
    pillPos = "top",
    direction = "auto"
  } = options;

  let loc = typeof selectorOrLocator === "string" ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await loc.waitFor({ state: "visible", timeout: 15000 });
  await loc.scrollIntoViewIfNeeded({ timeout: 15000 });
  await sleep(100);

  const box = await loc.boundingBox();
  if (!box) {
    throw new Error(`highlight failed: Could not determine bounding box for target ${String(selectorOrLocator)}`);
  }

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  try {
    await page.evaluate(({ box, label, shape, pillPos, direction }) => {
      window.__tutorialHighlightBox?.(box, label, shape, pillPos, direction);
      window.__tutorialMoveCursor?.(box.x + box.width / 2, box.y + box.height / 2);
    }, { box, label, shape, pillPos, direction });
  } catch (err) {
    if (!isNavigationError(err)) throw err;
  }

  return box;
}

/**
 * Highlights an element with a spotlight halo and tooltip, moves cursor, clicks, and animates ripple.
 * Automatically scrolls element into view before measuring to prevent misplaced overlays.
 * Supports action verification via options.verify predicate or options.expectSelector.
 * 
 * @param {import('playwright').Page} page
 * @param {string|import('playwright').Locator} selectorOrLocator
 * @param {Object} options
 * @param {string} [options.label]
 * @param {"rect"|"circle"} [options.shape="rect"]
 * @param {"top"|"bottom"} [options.pillPos="top"]
 * @param {number} [options.highlightDuration=1200]
 * @param {number} [options.postClickDelay=400]
 * @param {boolean} [options.force=false]
 * @param {"auto"|"rtl"|"ltr"} [options.direction="auto"]
 * @param {((page: import('playwright').Page) => Promise<boolean|void>|boolean|void)|string} [options.verify]
 * @param {string} [options.expectSelector]
 * @param {number} [options.verifyTimeout=10000]
 */
export async function highlightAndClick(page, selectorOrLocator, options = {}) {
  await ensureInteractiveEngine(page, options);
  const {
    label = "",
    shape = "rect",
    pillPos = "top",
    highlightDuration = 1200,
    postClickDelay = 400,
    force = false,
    direction = "auto",
    verify = null,
    expectSelector = null,
    verifyTimeout = 10000
  } = options;

  let loc = typeof selectorOrLocator === "string" ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await loc.waitFor({ state: "visible", timeout: 15000 });

  // Critical fix: Scroll target into viewport BEFORE measuring bounding box!
  await loc.scrollIntoViewIfNeeded({ timeout: 15000 });
  await sleep(100);

  const box = await loc.boundingBox();
  if (!box) {
    await loc.click({ force });
    await runActionVerification(page, {
      actionName: "highlightAndClick",
      target: selectorOrLocator,
      verify,
      expectSelector,
      timeout: verifyTimeout
    });
    return;
  }

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  // 1. Highlight target bounding box with spotlight ring and safe tooltip
  try {
    await page.evaluate(({ box, label, shape, pillPos, direction }) => {
      window.__tutorialHighlightBox?.(box, label, shape, pillPos, direction);
    }, { box, label, shape, pillPos, direction });
  } catch (err) {
    if (!isNavigationError(err)) throw err;
  }

  // 2. Move virtual cursor smoothly to target
  try {
    await page.evaluate(({ x, y }) => {
      window.__tutorialMoveCursor?.(x, y);
    }, { x: targetX, y: targetY });
  } catch (err) {
    if (!isNavigationError(err)) throw err;
  }

  await sleep(highlightDuration);

  // 3. Trigger ripple effect and perform the native click
  try {
    await page.evaluate(({ x, y }) => {
      window.__tutorialClickRipple?.(x, y);
    }, { x: targetX, y: targetY });
  } catch (err) {
    if (!isNavigationError(err)) throw err;
  }

  await loc.click({ force });
  await sleep(postClickDelay);

  // 4. Safely clear spotlight highlight (wrapping in try/catch to handle page navigations)
  try {
    await page.evaluate(() => {
      window.__tutorialClearHighlight?.();
    });
  } catch (e) {
    if (!isNavigationError(e)) throw e;
  }

  // 5. Verification if specified (predicate or expected selector)
  await runActionVerification(page, {
    actionName: "highlightAndClick",
    target: selectorOrLocator,
    verify,
    expectSelector,
    timeout: verifyTimeout
  });
}

/**
 * Focuses and types text into an input field while displaying spotlight highlight.
 * Automatically scrolls target into view before measuring bounding box.
 * Supports action verification via options.verify predicate or options.expectSelector.
 * 
 * @param {import('playwright').Page} page
 * @param {string|import('playwright').Locator} selectorOrLocator
 * @param {string} text
 * @param {Object} options
 * @param {string} [options.label]
 * @param {number} [options.highlightDuration=800]
 * @param {number} [options.delayBetweenChars=45]
 * @param {boolean} [options.clearExisting=true]
 * @param {"auto"|"rtl"|"ltr"} [options.direction="auto"]
 * @param {((page: import('playwright').Page) => Promise<boolean|void>|boolean|void)|string} [options.verify]
 * @param {string} [options.expectSelector]
 * @param {number} [options.verifyTimeout=10000]
 */
export async function typeWithFocus(page, selectorOrLocator, text, options = {}) {
  await ensureInteractiveEngine(page, options);
  const {
    label = "",
    highlightDuration = 800,
    delayBetweenChars = 45,
    clearExisting = true,
    direction = "auto",
    verify = null,
    expectSelector = null,
    verifyTimeout = 10000
  } = options;

  let loc = typeof selectorOrLocator === "string" ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await loc.waitFor({ state: "visible", timeout: 15000 });

  // Scroll into view before measurement
  await loc.scrollIntoViewIfNeeded({ timeout: 15000 });
  await sleep(100);

  const box = await loc.boundingBox();
  if (box) {
    try {
      await page.evaluate(({ box, label, direction }) => {
        window.__tutorialHighlightBox?.(box, label, "rect", "top", direction);
        window.__tutorialMoveCursor?.(box.x + 20, box.y + box.height / 2);
      }, { box, label, direction });
    } catch (err) {
      if (!isNavigationError(err)) throw err;
    }

    await sleep(highlightDuration);
  }

  if (clearExisting) {
    await loc.fill("");
  }
  if (typeof loc.pressSequentially === "function") {
    await loc.pressSequentially(text, { delay: delayBetweenChars });
  } else {
    await loc.type(text, { delay: delayBetweenChars });
  }

  try {
    await page.evaluate(() => {
      window.__tutorialClearHighlight?.();
    });
  } catch (e) {
    if (!isNavigationError(e)) throw e;
  }

  // Action result verification
  await runActionVerification(page, {
    actionName: "typeWithFocus",
    target: selectorOrLocator,
    verify,
    expectSelector,
    timeout: verifyTimeout
  });
}

/**
 * Displays or updates the bottom HUD banner.
 * 
 * @param {import('playwright').Page} page
 * @param {string} badge Short step badge (e.g. "خطوة 1 من 5")
 * @param {string} title Main action title
 * @param {string} subtitle Explanatory subtitle
 * @param {number} durationMs Time to wait after showing banner
 * @param {Object} options
 * @param {"auto"|"rtl"|"ltr"} [options.direction="auto"] Text direction
 */
export async function showBanner(page, badge, title, subtitle, durationMs = 2500, options = {}) {
  await ensureInteractiveEngine(page, options);
  const dir = options.direction || "auto";
  try {
    await page.evaluate(({ badge, title, subtitle, dir }) => {
      window.__tutorialShowBanner?.(badge, title, subtitle, dir);
    }, { badge, title, subtitle, dir });
  } catch (err) {
    if (!isNavigationError(err)) throw err;
  }

  if (durationMs > 0) {
    await sleep(durationMs);
  }
}

/**
 * Clears any active highlight rings or tooltips.
 * @param {import('playwright').Page} page
 */
export async function clearHighlights(page) {
  try {
    await page.evaluate(() => {
      window.__tutorialClearHighlight?.();
    });
  } catch (e) {
    if (!isNavigationError(e)) throw e;
  }
}

/**
 * Estimates spoken duration in milliseconds based on text length and language.
 * Default speech rate is ~140-160 WPM for English, ~12-14 chars/sec for Arabic.
 * 
 * @param {string} text
 * @param {string} [locale="ar"]
 * @returns {number}
 */
export function estimateSpeechDurationMs(text, locale = "ar") {
  if (!text) return 1000;
  const isArabic = /[\u0600-\u06FF]/.test(text) || locale.startsWith("ar");
  if (isArabic) {
    // Arabic neural speech average ~9.5 chars per second plus punctuation pauses
    const clean = text.replace(/\s+/g, "");
    const punctuationCount = (text.match(/[,،.:؛!?]/g) || []).length;
    return Math.max(1500, Math.round((clean.length / 9.5) * 1000) + (punctuationCount * 350) + 600);
  } else {
    // English words per minute approx 135 plus punctuation pauses
    const words = text.trim().split(/\s+/).length;
    const punctuationCount = (text.match(/[,.:;!?]/g) || []).length;
    return Math.max(1500, Math.round((words / 135) * 60 * 1000) + (punctuationCount * 300) + 500);
  }
}

/**
 * Unified Tutorial Timeline Session.
 * Drives action timing directly from narration speech duration, eliminating manual delay guessing.
 */
export class TutorialSession {
  /**
   * @param {import('playwright').Page} page
   * @param {Object} options
   */
  constructor(page, options = {}) {
    this.page = page;
    this.options = options;
    this.segments = [];
    this.startTime = 0;
    if (page) {
      page.__tutorialSession = this;
    }
  }

  async start() {
    this.startTime = Date.now();
    await setupInteractiveEngine(this.page, this.options);
  }

  /**
   * Narrates a cue: logs timing, displays optional banner, and waits for speech duration.
   * 
   * @param {string} text Speech text for narration
   * @param {Object} options
   * @param {number} [options.durationMs] Explicit duration in ms
   * @param {string} [options.voice] Voice identifier
   * @param {Object} [options.banner] Optional { badge, title, subtitle } banner to display
   * @returns {Promise<number>} Spoken duration elapsed in ms
   */
  async narrate(text, options = {}) {
    const delay_ms = Math.max(0, Date.now() - this.startTime);
    const duration_ms = options.durationMs || estimateSpeechDurationMs(text, options.voice || this.options.voice || "ar");

    this.segments.push({
      delay_ms,
      text,
      voice: options.voice || this.options.voice || "ar-LY-ImanNeural",
      duration_ms
    });

    if (options.banner) {
      await showBanner(
        this.page,
        options.banner.badge || "",
        options.banner.title || "",
        options.banner.subtitle || "",
        duration_ms,
        { direction: options.direction || this.options.direction }
      );
    } else {
      await sleep(duration_ms);
    }

    return duration_ms;
  }

  getTimeline() {
    return {
      recordedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - this.startTime,
      segments: this.segments
    };
  }
}

/**
 * Standalone narration driver.
 * Drives action timing directly from narration duration: logs timing, displays
 * optional HUD banner, and waits for speech duration.
 * 
 * @param {import('playwright').Page} page
 * @param {string} text Speech text for narration
 * @param {Object} [options]
 * @param {number} [options.durationMs] Explicit duration in ms
 * @param {string} [options.voice] Voice identifier (default: ar-LY-ImanNeural)
 * @param {Object} [options.banner] Optional { badge, title, subtitle } banner to display
 * @param {"auto"|"rtl"|"ltr"} [options.direction] Text direction
 * @returns {Promise<number>} Elapsed duration in ms
 */
export async function narrate(page, text, options = {}) {
  if (!page.__tutorialSession) {
    page.__tutorialSession = new TutorialSession(page, options);
    await page.__tutorialSession.start();
  }
  return page.__tutorialSession.narrate(text, options);
}

/**
 * Retrieves the recorded tutorial timeline from a page or session.
 * @param {import('playwright').Page} page
 * @returns {Object}
 */
export function getTimeline(page) {
  if (page && page.__tutorialSession) {
    return page.__tutorialSession.getTimeline();
  }
  return {
    recordedAt: new Date().toISOString(),
    totalDurationMs: 0,
    segments: []
  };
}

/**
 * Selective Zoom & Pan Helper.
 * Zooms into a specific element or bounding box during a tutorial to focus viewer attention
 * on dense or small UI elements, or smoothly resets zoom when scale is 1 or target is null.
 * 
 * @param {import('playwright').Page} page
 * @param {string|import('playwright').Locator|{x: number, y: number, width: number, height: number}|null} selectorOrBox
 * @param {number} [scale=1.5] Target zoom scale factor (use 1 to reset)
 * @param {Object} [options]
 * @param {number} [options.durationMs=500] Transition animation duration in ms
 * @param {boolean} [options.reset=false] Explicitly reset zoom
 */
export async function zoomTo(page, selectorOrBox, scale = 1.5, options = {}) {
  const durationMs = options.durationMs !== undefined ? options.durationMs : (options.duration || 500);
  const isReset = options.reset || scale === 1 || !selectorOrBox;

  if (isReset) {
    await page.evaluate(({ durationMs }) => {
      if (!document.body) return;
      document.body.style.transition = durationMs > 0 ? `transform ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1)` : "none";
      document.body.style.transform = "none";
      document.body.style.transformOrigin = "0 0";
    }, { durationMs });
    if (durationMs > 0) {
      await sleep(durationMs + 60);
    }
    return;
  }

  let selectorStr = null;
  let explicitBox = null;

  if (typeof selectorOrBox === "string") {
    selectorStr = selectorOrBox;
    const loc = page.locator(selectorStr).first();
    await loc.waitFor({ state: "visible", timeout: 10000 });
  } else if (selectorOrBox && typeof selectorOrBox.boundingBox === "function") {
    await selectorOrBox.waitFor({ state: "visible", timeout: 10000 });
    explicitBox = await selectorOrBox.boundingBox();
  } else if (selectorOrBox && typeof selectorOrBox.x === "number" && typeof selectorOrBox.y === "number") {
    explicitBox = selectorOrBox;
  }

  try {
    await page.evaluate(({ selectorStr, explicitBox, scale, durationMs }) => {
      if (!document.body) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const prevTransform = document.body.style.transform;
      document.body.style.transition = "none";
      document.body.style.transform = "none";

      const bodyRect = document.body.getBoundingClientRect();
      let cx, cy;
      if (selectorStr) {
        const el = document.querySelector(selectorStr);
        if (!el) throw new Error(`zoomTo failed: Element not found for selector "${selectorStr}"`);
        const r = el.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      } else if (explicitBox) {
        cx = explicitBox.x + explicitBox.width / 2;
        cy = explicitBox.y + explicitBox.height / 2;
      } else {
        throw new Error("zoomTo failed: Invalid target selector or bounding box.");
      }

      const tx = (vw / 2) - bodyRect.left - (cx - bodyRect.left) * scale;
      const ty = (vh / 2) - bodyRect.top - (cy - bodyRect.top) * scale;

      if (prevTransform && prevTransform !== "none") {
        document.body.style.transform = prevTransform;
        void document.body.offsetHeight; // force reflow
      }

      document.body.style.transition = durationMs > 0 ? `transform ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1)` : "none";
      document.body.style.transformOrigin = "0 0";
      document.body.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }, { selectorStr, explicitBox, scale, durationMs });
  } catch (err) {
    if (!isNavigationError(err)) throw err;
  }

  if (durationMs > 0) {
    await sleep(durationMs + 60);
  }
}

/**
 * Creates a Playwright browser context pre-configured for standard 1080p 30fps tutorial recording.
 * 
 * @param {import('playwright').Browser} browser
 * @param {Object} [options]
 * @returns {Promise<import('playwright').BrowserContext>}
 */
export async function createTutorialContext(browser, options = {}) {
  const {
    width = 1920,
    height = 1080,
    recordDir = "./output/videos",
    ...rest
  } = options;

  return await browser.newContext({
    recordVideo: {
      dir: recordDir,
      size: { width, height }
    },
    viewport: { width, height },
    ...rest
  });
}

export { convertToH264 } from "./convert_video.js";

