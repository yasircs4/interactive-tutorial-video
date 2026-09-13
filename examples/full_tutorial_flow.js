import { chromium } from "playwright";
import { setupInteractiveEngine, highlightAndClick, showBanner, typeWithFocus, sleep } from "../skills/interactive-tutorial-video/scripts/tutorial_engine.js";

async function recordTutorial() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: "./output/videos",
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  await page.goto("https://example.com/login");

  // Initialize visual HUD engine
  await setupInteractiveEngine(page, { accentColor: "#10b981" });

  // Step 1: Login
  await showBanner(page, "Step 1 of 3", "System Authentication", "Enter your credentials to access the POS terminal", 2000);
  await typeWithFocus(page, "input#email", "cashier@example.com", { label: "Enter Cashier Email" });
  await typeWithFocus(page, "input#password", "••••••••••••", { label: "Enter Password" });
  await highlightAndClick(page, "button#login-btn", { label: "Click Login to Continue", shape: "rect" });

  // Step 2: Select Product
  await showBanner(page, "Step 2 of 3", "Order Creation", "Click on any product card to add it to the cart", 2000);
  await highlightAndClick(page, ".product-card:first-child", { label: "Select Wireless Headphones" });

  // Step 3: Checkout
  await showBanner(page, "Step 3 of 3", "Payment & Receipt", "Validate cash payment and issue printed customer ticket", 2500);
  await highlightAndClick(page, "button#pay-button", { label: "Open Payment Dialog" });
  await sleep(3000);

  await context.close();
  await browser.close();
  console.log("Tutorial video recorded successfully in 1080p!");
}

recordTutorial().catch(console.error);
