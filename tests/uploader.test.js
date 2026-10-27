import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  getFileSha256,
  loadLedger,
  saveLedger,
  queryCookiesFromDb,
  verifyVideoInStudio
} from "../skills/interactive-tutorial-video/scripts/youtube_session_uploader.js";
import { chromium } from "playwright";

test("uploader ledger records and deduplicates by sha256 with verified status", () => {
  const tmpLedger = path.join(os.tmpdir(), `test_ledger_${Date.now()}.json`);
  try {
    const hash1 = getFileSha256("package.json");
    assert.ok(hash1 && hash1.length === 64, "Must generate 64-char sha256 hex string");

    const initialLedger = loadLedger(tmpLedger);
    assert.deepEqual(initialLedger, {}, "Non-existent ledger should load as empty object");

    initialLedger[hash1] = {
      filePath: "package.json",
      fileHash: hash1,
      videoId: "dQw4w9WgXcQ",
      url: "https://youtu.be/dQw4w9WgXcQ",
      title: "Interactive Tutorial Demo",
      readTitle: "Interactive Tutorial Demo",
      verified: true,
      readbackStatus: "confirmed",
      uploadedAt: new Date().toISOString()
    };

    saveLedger(tmpLedger, initialLedger);
    const reloaded = loadLedger(tmpLedger);
    assert.equal(reloaded[hash1].videoId, "dQw4w9WgXcQ");
    assert.equal(reloaded[hash1].url, "https://youtu.be/dQw4w9WgXcQ");
    assert.equal(reloaded[hash1].verified, true);
    assert.equal(reloaded[hash1].readbackStatus, "confirmed");
  } finally {
    if (fs.existsSync(tmpLedger)) fs.unlinkSync(tmpLedger);
  }
});

test("verifyVideoInStudio performs reliable DOM readback of video title and id", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    // Setup mock YouTube Studio video edit DOM
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="title-textarea">
            <div id="textbox" aria-label="Add a title that describes your video">
              Cashier POS Full Workflow Tutorial (Taiba Pharmacy)
            </div>
          </div>
          <ytcp-video-metadata-playlists>
            <span>Staff Training 2026</span>
          </ytcp-video-metadata-playlists>
        </body>
      </html>
    `);

    // 1. Missing videoId throws
    await assert.rejects(async () => {
      await verifyVideoInStudio(page, { videoId: "", expectedTitle: "Any" });
    }, /Missing videoId/);

    // 2. Successful readback
    const result = await verifyVideoInStudio(page, {
      videoId: "abc123xyz89",
      expectedTitle: "Cashier POS Full Workflow Tutorial",
      playlistTitle: "Staff Training 2026",
      timeoutMs: 1000
    });

    assert.equal(result.verified, true);
    assert.equal(result.videoId, "abc123xyz89");
    assert.ok(result.readTitle.includes("Cashier POS Full Workflow Tutorial"));
    assert.equal(result.playlistVerified, true);
    assert.equal(result.readbackStatus, "confirmed");

    // 3. Failing readback on empty/unmatched page returns verified: false
    await page.setContent("<html><body><div>404 Studio Error</div></body></html>");
    const failedResult = await verifyVideoInStudio(page, {
      videoId: "xyz999missing",
      expectedTitle: "Non Existent Video",
      timeoutMs: 300,
      skipNavigation: true
    });
    assert.equal(failedResult.verified, false, "Failed readback must return verified: false");
    assert.equal(failedResult.readbackStatus, "unverified");
    assert.equal(failedResult.readTitle, null);

    // 4. Failing readback throws error when failOnError is true
    await assert.rejects(async () => {
      await verifyVideoInStudio(page, {
        videoId: "xyz999missing",
        expectedTitle: "Non Existent Video",
        timeoutMs: 300,
        skipNavigation: true,
        failOnError: true
      });
    }, /Post-upload readback verification failed/);
  } finally {
    await page.close();
    await browser.close();
  }
});

test("queryCookiesFromDb handles missing and valid sqlite databases gracefully", async () => {
  const nonExistentDb = path.join(os.tmpdir(), `non_existent_${Date.now()}.db`);
  await assert.rejects(async () => {
    await queryCookiesFromDb(nonExistentDb);
  });

  const validDb = path.join(os.tmpdir(), `test_cookies_${Date.now()}.db`);
  try {
    const { execFileSync } = await import("child_process");
    execFileSync("python3", [
      "-c",
      `import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
cur = conn.cursor()
cur.execute("CREATE TABLE cookies (host_key TEXT, name TEXT, path TEXT, is_secure INTEGER, is_httponly INTEGER, encrypted_value BLOB)")
cur.execute("INSERT INTO cookies VALUES ('.youtube.com', 'SID', '/', 1, 1, X'01020304')")
conn.commit()
conn.close()
`,
      validDb
    ]);

    const cookies = await queryCookiesFromDb(validDb);
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0].name, "SID");
    assert.equal(cookies[0].domain || cookies[0].host_key, ".youtube.com");
  } finally {
    if (fs.existsSync(validDb)) fs.unlinkSync(validDb);
  }
});

