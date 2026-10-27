import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import {
  setupInteractiveEngine,
  highlightAndClick,
  showBanner,
  typeWithFocus,
  sleep,
  narrate,
  getTimeline
} from "../skills/interactive-tutorial-video/scripts/tutorial_engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function recordTutorial() {
  const outputDir = path.join(__dirname, "../output/videos");
  fs.mkdirSync(outputDir, { recursive: true });

  const fixtureUrl = "file://" + path.resolve(__dirname, "fixture/demo_app.html");

  console.log("[recordTutorial] Launching Chromium to record tutorial from local fixture...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: outputDir,
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  await page.goto(fixtureUrl);

  await setupInteractiveEngine(page, {
    accentColor: "#10b981",
    secondaryColor: "#34d399",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  });

  // Step 1: Login
  await narrate(page, "مرحباً بكم. الخطوة الأولى: تسجيل دخول الكاشير للوصول إلى نقطة البيع.", {
    banner: {
      badge: "الخطوة 1 من 4",
      title: "تسجيل الدخول / Authentication",
      subtitle: "أدخل بيانات الكاشير المعتمدة لفتح الوردية"
    }
  });

  await typeWithFocus(page, "input#email", "cashier@taiba.ly", {
    label: "Cashier Email / البريد الإلكتروني",
    highlightDuration: 600
  });

  await typeWithFocus(page, "input#password", "12345678", {
    label: "Security PIN / الرقم السري",
    highlightDuration: 600
  });

  await highlightAndClick(page, "button#login-btn", {
    label: "فتح الوردية / Authorize",
    shape: "rect",
    highlightDuration: 800,
    verify: "#pos-section"
  });

  // Step 2: Select Product
  await narrate(page, "الخطوة الثانية: اختيار المنتجات لإضافتها مباشرة إلى الفاتورة.", {
    banner: {
      badge: "الخطوة 2 من 4",
      title: "اختيار المنتجات / Product Catalog",
      subtitle: "انقر على أي صنف لإدراجه في تذكرة العميل"
    }
  });

  await highlightAndClick(page, ".product-card:first-child", {
    label: "Wireless Headphones (45.00 LYD)",
    highlightDuration: 900
  });

  // Step 3: Apply Discount
  await narrate(page, "الخطوة الثالثة: تطبيق نسبة الخصم المعتمدة للعميل.", {
    banner: {
      badge: "الخطوة 3 من 4",
      title: "تطبيق الخصم / Discount",
      subtitle: "تحديد نسبة الخصم وإعادة احتساب الإجمالي تلقائياً"
    }
  });

  await typeWithFocus(page, "input#discount-input", "10", {
    label: "خصم 10% / Apply 10% Discount",
    highlightDuration: 700
  });

  // Step 4: Scroll & Payment (Testing below-the-fold target at y > 1000px)
  await narrate(page, "الخطوة الرابعة: سداد القيمة وطباعة إيصال الدفع النهائي.", {
    banner: {
      badge: "الخطوة 4 من 4",
      title: "الدفع وطباعة الفاتورة / Checkout",
      subtitle: "اعتماد الدفع النقدي وإصدار الفاتورة للعميل"
    }
  });

  await highlightAndClick(page, "button#pay-button", {
    label: "Validate Payment / تأكيد الدفع",
    pillPos: "top",
    highlightDuration: 1000,
    verify: "#receipt-modal"
  });

  await sleep(1500);

  // Save timeline manifest
  const timeline = getTimeline(page);
  const timelinePath = path.join(outputDir, "demo_timeline.json");
  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2), "utf-8");
  console.log(`[recordTutorial] Timeline manifest exported to: ${timelinePath}`);

  // Retrieve recorded video file path before context closes
  const videoObj = page.video();
  const rawVideoPath = await videoObj.path();

  await context.close();
  await browser.close();

  console.log(`[recordTutorial] Raw video recorded at: ${rawVideoPath}`);

  // Synthesize voiceover, duration-guard, and transcode WebM to standardized 1080p H.264/AAC MP4
  const finalMp4Path = path.join(outputDir, "demo_tutorial.mp4");
  const muxScript = path.join(__dirname, "../skills/interactive-tutorial-video/scripts/mux_voiceover.py");

  console.log(`[recordTutorial] Muxing synchronized voiceover and transcoding to H.264/AAC...`);
  execFileSync("python3", [
    muxScript,
    "--video", rawVideoPath,
    "--manifest", timelinePath,
    "--output", finalMp4Path,
    "--voice", "ar-LY-ImanNeural",
    "--rate", "+10%",
    "--export-captions"
  ], { stdio: "inherit" });

  console.log(`\n=================================================`);
  console.log(` Tutorial Recorded and Transcoded Successfully!`);
  console.log(` Video: ${finalMp4Path}`);
  console.log(` Timeline: ${timelinePath}`);
  console.log(` Captions: ${finalMp4Path.replace(/\.mp4$/, ".srt")} and .vtt`);
  console.log(`=================================================`);
}

recordTutorial()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Recording error:", err);
    process.exit(1);
  });
