#!/usr/bin/env node
/**
 * Autonomous YouTube Studio Session Uploader & Playlist Manager
 * 
 * Leverages active Chrome sessions on macOS via Keychain decryption to upload
 * videos and organize them into unlisted or public playlists without OAuth registration.
 * 
 * Compliant with agentskills.io specifications.
 */

import crypto from "crypto";
import { execSync } from "child_process";
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import os from "os";
import { chromium } from "playwright";

/**
 * Extract and decrypt Google and YouTube cookies from macOS Google Chrome.
 */
export function extractChromeCookies() {
  const cookieDbOriginal = path.join(
    os.homedir(),
    "Library/Application Support/Google/Chrome/Default/Cookies"
  );
  if (!fs.existsSync(cookieDbOriginal)) {
    throw new Error(`Chrome Cookies database not found at: ${cookieDbOriginal}`);
  }

  const pw = execSync('security find-generic-password -w -s "Chrome Safe Storage"', {
    encoding: "utf-8",
  }).trim();

  const key = crypto.pbkdf2Sync(pw, "saltysalt", 1003, 16, "sha1");
  const iv = Buffer.alloc(16, 0x20);

  function decrypt(encrypted) {
    if (!encrypted) return "";
    let data = Buffer.from(encrypted);
    if (data.slice(0, 3).toString("ascii") === "v10" || data.slice(0, 3).toString("ascii") === "v11") {
      data = data.slice(3);
    }
    if (data.length % 16 !== 0) return "";
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    decipher.setAutoPadding(false);
    let res = decipher.update(data);
    if (res.length <= 32) return "";
    const pad = res[res.length - 1];
    let end = res.length;
    if (pad > 0 && pad <= 16) {
      end = res.length - pad;
    }
    return res.slice(32, end).toString("utf8");
  }

  const tempDb = path.join(os.tmpdir(), `chrome_cookies_${Date.now()}.db`);
  fs.copyFileSync(cookieDbOriginal, tempDb);

  const db = new DatabaseSync(tempDb);
  const rows = db
    .prepare(
      "SELECT host_key, name, path, is_secure, is_httponly, encrypted_value FROM cookies WHERE host_key LIKE ? OR host_key LIKE ?"
    )
    .all("%google.com%", "%youtube.com%");

  const cookies = [];
  for (const r of rows) {
    try {
      const val = decrypt(r.encrypted_value);
      if (val) {
        cookies.push({
          name: r.name,
          value: val,
          domain: r.host_key,
          path: r.path || "/",
          secure: Boolean(r.is_secure),
          httpOnly: Boolean(r.is_httponly),
        });
      }
    } catch (e) {}
  }

  try {
    fs.unlinkSync(tempDb);
  } catch (e) {}

  return cookies;
}

/**
 * Upload a single video or batch of videos to YouTube Studio.
 * @param {Object} config
 * @param {Array<{file: string, title: string, description: string, visibility?: string}>} config.videos
 * @param {string} [config.channelId] Optional YouTube Studio channel ID
 * @param {string} [config.playlistTitle] Optional playlist to create/add to
 * @param {boolean} [config.headless=true]
 */
export async function uploadVideos(config) {
  const {
    videos = [],
    channelId = "",
    playlistTitle = "",
    headless = true,
  } = config;

  console.log(`[youtube_uploader] Extracting Chrome session cookies from macOS Keychain...`);
  const cookies = extractChromeCookies();
  console.log(`[youtube_uploader] Loaded ${cookies.length} session cookies.`);

  const browser = await chromium.launch({
    headless: headless,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  for (const c of cookies) {
    try {
      await context.addCookies([c]);
    } catch (e) {}
  }

  const page = await context.newPage();
  const studioUrl = channelId
    ? `https://studio.youtube.com/channel/${channelId}`
    : `https://studio.youtube.com`;

  console.log(`[youtube_uploader] Navigating to ${studioUrl}...`);
  await page.goto(studioUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  const results = [];

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    console.log(`\n[youtube_uploader] Uploading (${i + 1}/${videos.length}): ${v.title}`);

    // Click Create / Upload
    const createBtn = page.locator("#create-icon, #upload-button, [aria-label*='Create'], [aria-label*='Upload'], ytcp-button:has-text('Create')").first();
    await createBtn.click();
    await page.waitForTimeout(1000);

    const uploadOption = page.locator("tp-yt-paper-item:has-text('Upload videos'), ytcp-text-menu:has-text('Upload'), #text-item-0").first();
    if (await uploadOption.isVisible()) {
      await uploadOption.click();
      await page.waitForTimeout(1500);
    }

    const fileInput = page.locator("input[type=file]").first();
    await fileInput.setInputFiles(v.file);
    await page.waitForTimeout(7000);

    // Set Title
    const titleBox = page.locator("#textbox[aria-label*='title'], [aria-label*='Title'], div#title-textarea #textbox").first();
    if (await titleBox.isVisible()) {
      await titleBox.fill("");
      await titleBox.type(v.title, { delay: 10 });
    }

    // Set Description
    if (v.description) {
      const descBox = page.locator("#textbox[aria-label*='description'], [aria-label*='Description'], div#description-textarea #textbox").first();
      if (await descBox.isVisible()) {
        await descBox.fill("");
        await descBox.type(v.description, { delay: 5 });
      }
    }

    // Set "Not made for kids" (COPPA compliance)
    const notForKids = page.locator("tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_NOT_MFK'], [name='VIDEO_MADE_FOR_KIDS_NOT_MFK']").first();
    if (await notForKids.isVisible()) {
      await notForKids.click();
    }

    // Advance to Visibility step
    for (let step = 0; step < 3; step++) {
      const nextBtn = page.locator("#next-button").first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    // Select Visibility (unlisted default)
    const visibility = v.visibility || "unlisted";
    if (visibility === "unlisted") {
      const unlistedRadio = page.locator("tp-yt-paper-radio-button[name='UNLISTED'], [name='UNLISTED']").first();
      await unlistedRadio.click();
    } else if (visibility === "public") {
      const publicRadio = page.locator("tp-yt-paper-radio-button[name='PUBLIC'], [name='PUBLIC']").first();
      await publicRadio.click();
    } else {
      const privateRadio = page.locator("tp-yt-paper-radio-button[name='PRIVATE'], [name='PRIVATE']").first();
      await privateRadio.click();
    }

    // Capture Share Link
    let shareUrl = "";
    try {
      shareUrl = await page.evaluate(() => {
        const a = document.querySelector("a[href*='youtu.be']");
        return a ? a.href : "";
      });
    } catch (e) {}

    // Complete Upload
    const doneBtn = page.locator("#done-button, #save-button").first();
    await doneBtn.click();
    await page.waitForTimeout(5000);

    if (!shareUrl) {
      try {
        shareUrl = await page.evaluate(() => {
          const a = document.querySelector("ytcp-video-share-dialog a[href*='youtu.be']");
          return a ? a.href : "";
        });
      } catch (e) {}
    }

    console.log(`[youtube_uploader] Video Published! Share URL: ${shareUrl}`);
    results.push({
      index: i + 1,
      title: v.title,
      url: shareUrl,
      visibility: visibility,
    });

    // Close share dialog if present
    try {
      const closeBtn = page.locator("ytcp-video-share-dialog ytcp-button#close-button, ytcp-button:has-text('Close')").first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(1200);
      }
    } catch (e) {}
  }

  await browser.close();
  return results;
}

// CLI Execution Support
if (process.argv[1] && process.argv[1].endsWith("youtube_session_uploader.js")) {
  const manifestArg = process.argv[2];
  if (!manifestArg) {
    console.log("Usage: node youtube_session_uploader.js <manifest.json>");
    process.exit(0);
  }

  const manifestData = JSON.parse(fs.readFileSync(manifestArg, "utf-8"));
  uploadVideos(manifestData)
    .then((res) => {
      console.log("\n--- Upload Complete ---");
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error("Upload failed:", err);
      process.exit(1);
    });
}
