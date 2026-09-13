/**
 * Interactive Tutorial Video HUD Overlay Engine
 * 
 * Provides dynamic in-browser visual overlays during Playwright video recordings:
 * - Smart Virtual Cursor (SVG vector pointer with smooth easing)
 * - Pulsating Spotlight Rings (accent-colored target highlighting)
 * - Click Ripple Waves (expanding animated pulses on interaction)
 * - Target Tooltip Pills (floating badges pointing directly to elements)
 * - Glassmorphism Step Banner (bottom frosted HUD banner for step info)
 * 
 * Compliant with agentskills.io specifications.
 */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Setup and inject the visual HUD styles and virtual cursor into the page.
 * @param {import('playwright').Page} page
 * @param {Object} options
 * @param {string} options.accentColor Primary accent color (default: #10b981)
 * @param {string} options.secondaryColor Secondary accent (default: #34d399)
 * @param {string} options.fontFamily Font stack (default: system-ui)
 */
export async function setupInteractiveEngine(page, options = {}) {
  const {
    accentColor = "#10b981",
    secondaryColor = "#34d399",
    fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  } = options;

  await page.evaluate(({ accent, secondary, font }) => {
    if (document.getElementById("tutorial-engine-styles")) return;

    const style = document.createElement("style");
    style.id = "tutorial-engine-styles";
    style.innerHTML = `
      @keyframes tutorialPulseHalo {
        0% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.85), 0 0 25px rgba(16, 185, 129, 0.5); }
        70% { transform: scale(1.02); box-shadow: 0 0 0 16px rgba(16, 185, 129, 0), 0 0 40px rgba(16, 185, 129, 0.8); }
        100% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.85), 0 0 25px rgba(16, 185, 129, 0.5); }
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
        background: rgba(16, 185, 129, 0.12);
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
        font-size: 16px;
        font-weight: 700;
        padding: 6px 18px;
        border-radius: 30px;
        white-space: nowrap;
        direction: rtl;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        pointer-events: none;
        letter-spacing: 0.3px;
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
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
        border: 2px solid ${accent};
        border-radius: 14px;
        color: #ffffff;
        padding: 14px 32px;
        font-family: ${font};
        text-align: center;
        direction: rtl;
        box-shadow: 0 12px 35px rgba(0,0,0,0.65);
        z-index: 9999999;
        min-width: 520px;
        max-width: 85%;
        pointer-events: none;
        animation: tutorialFadeIn 0.35s ease-out forwards;
      }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement("div");
    cursor.id = "tutorial-virtual-cursor";
    cursor.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 3L23 12.5L13.5 15.5L9.5 24.5L4 3Z" fill="${accent}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
    `;
    cursor.style.left = "960px";
    cursor.style.top = "540px";
    document.body.appendChild(cursor);

    window.__tutorialHighlightBox = (box, label, shape = "rect", pos = "top") => {
      let ring = document.getElementById("tutorial-active-ring");
      if (!ring) {
        ring = document.createElement("div");
        ring.id = "tutorial-active-ring";
        document.body.appendChild(ring);
      }
      const pad = 8;
      ring.style.left = `${box.x - pad}px`;
      ring.style.top = `${box.y - pad}px`;
      ring.style.width = `${box.width + pad * 2}px`;
      ring.style.height = `${box.height + pad * 2}px`;
      ring.className = `tutorial-spotlight-ring ${shape}`;
      
      const pillClass = pos === "bottom" ? "tutorial-target-pill bottom" : "tutorial-target-pill";
      ring.innerHTML = label ? `<div class="${pillClass}">${label}</div>` : "";
    };

    window.__tutorialClearHighlight = () => {
      const ring = document.getElementById("tutorial-active-ring");
      if (ring) ring.remove();
    };

    window.__tutorialMoveCursor = (x, y) => {
      const c = document.getElementById("tutorial-virtual-cursor");
      if (c) {
        c.style.left = `${x}px`;
        c.style.top = `${y}px`;
      }
    };

    window.__tutorialClickRipple = (x, y) => {
      const rip = document.createElement("div");
      rip.className = "tutorial-click-ripple";
      rip.style.left = `${x}px`;
      rip.style.top = `${y}px`;
      document.body.appendChild(rip);
      setTimeout(() => rip.remove(), 700);
    };

    window.__tutorialShowBanner = (badge, title, subtitle) => {
      let el = document.getElementById("tutorial-hud-banner");
      if (!el) {
        el = document.createElement("div");
        el.id = "tutorial-hud-banner";
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <div style="font-size: 14px; font-weight: 700; color: ${secondary}; margin-bottom: 4px; letter-spacing: 0.5px;">${badge}</div>
        <div style="font-size: 19px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 15px; font-weight: 500; color: #cbd5e1; line-height: 1.4;">${subtitle}</div>
      `;
    };
  }, { accent: accentColor, secondary: secondaryColor, font: fontFamily });
}

/**
 * Highlights an element with a spotlight halo and tooltip, moves cursor, clicks, and animates ripple.
 * @param {import('playwright').Page} page
 * @param {string|import('playwright').Locator} selectorOrLocator
 * @param {Object} options
 */
export async function highlightAndClick(page, selectorOrLocator, options = {}) {
  const {
    label = "",
    shape = "rect",
    pillPos = "top",
    highlightDuration = 1200,
    postClickDelay = 400,
    force = true,
  } = options;

  let loc = typeof selectorOrLocator === "string" ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await loc.waitFor({ state: "visible", timeout: 15000 });
  const box = await loc.boundingBox();
  if (!box) {
    await loc.click({ force });
    return;
  }

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  // 1. Highlight target bounding box with pulsating ring and label
  await page.evaluate(({ box, label, shape, pillPos }) => {
    window.__tutorialHighlightBox(box, label, shape, pillPos);
  }, { box, label, shape, pillPos });

  // 2. Move virtual cursor smoothly to target
  await page.evaluate(({ x, y }) => {
    window.__tutorialMoveCursor(x, y);
  }, { x: targetX, y: targetY });

  await sleep(highlightDuration);

  // 3. Trigger ripple effect and perform the native click
  await page.evaluate(({ x, y }) => {
    window.__tutorialClickRipple(x, y);
  }, { x: targetX, y: targetY });

  await loc.click({ force });
  await sleep(postClickDelay);

  // 4. Clear spotlight highlight
  await page.evaluate(() => {
    window.__tutorialClearHighlight();
  });
}

/**
 * Focuses and types text into an input field while displaying spotlight highlight.
 * @param {import('playwright').Page} page
 * @param {string|import('playwright').Locator} selectorOrLocator
 * @param {string} text
 * @param {Object} options
 */
export async function typeWithFocus(page, selectorOrLocator, text, options = {}) {
  const {
    label = "",
    highlightDuration = 800,
    delayBetweenChars = 45,
    clearExisting = true
  } = options;

  let loc = typeof selectorOrLocator === "string" ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await loc.waitFor({ state: "visible", timeout: 15000 });
  const box = await loc.boundingBox();

  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    await page.evaluate(({ box, label }) => {
      window.__tutorialHighlightBox(box, label, "rect", "top");
      window.__tutorialMoveCursor(box.x + 20, box.y + box.height / 2);
    }, { box, label });

    await sleep(highlightDuration);
  }

  if (clearExisting) {
    await loc.fill("");
  }
  await loc.type(text, { delay: delayBetweenChars });

  await page.evaluate(() => {
    window.__tutorialClearHighlight();
  });
}

/**
 * Displays or updates the bottom HUD banner.
 * @param {import('playwright').Page} page
 * @param {string} badge Short step badge (e.g. "خطوة 1 من 5")
 * @param {string} title Main action title
 * @param {string} subtitle Explanatory subtitle
 * @param {number} durationMs Time to wait after showing banner
 */
export async function showBanner(page, badge, title, subtitle, durationMs = 2500) {
  await page.evaluate(({ badge, title, subtitle }) => {
    window.__tutorialShowBanner(badge, title, subtitle);
  }, { badge, title, subtitle });
  if (durationMs > 0) {
    await sleep(durationMs);
  }
}

/**
 * Clears any active highlight rings or tooltips.
 * @param {import('playwright').Page} page
 */
export async function clearHighlights(page) {
  await page.evaluate(() => {
    window.__tutorialClearHighlight();
  });
}
