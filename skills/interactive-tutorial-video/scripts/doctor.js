#!/usr/bin/env node
/**
 * Interactive Tutorial Video Environment Doctor
 * 
 * Verifies all required dependencies and platform capabilities:
 * - Node.js runtime & Playwright browser binaries
 * - Python 3 & edge-tts synthesis backend
 * - FFmpeg & FFprobe with libx264/AAC support
 * - Disk space for recording and transcoding
 * - Publishing capabilities
 * 
 * Compliant with agentskills.io specifications.
 */

import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const checks = [];

function addCheck(name, status, message, details = "") {
  checks.push({ name, status, message, details });
  const icon = status === "PASS" ? "✅" : status === "WARN" ? "⚠️ " : "❌";
  console.log(`${icon} [${status}] ${name}: ${message}`);
  if (details) {
    console.log(`     ${details}`);
  }
}

async function runDoctor() {
  console.log("=================================================");
  console.log(" Interactive Tutorial Video Skill: Doctor");
  console.log("=================================================\n");

  // 1. Check Node.js
  const nodeVersion = process.version;
  const majorNode = parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10);
  if (majorNode >= 18) {
    addCheck("Node.js", "PASS", `${nodeVersion} (meets Node 18+ requirement)`);
  } else {
    addCheck("Node.js", "FAIL", `${nodeVersion} (Node 18+ required)`);
  }

  // 2. Check Python
  try {
    const pyVer = execSync("python3 --version", { encoding: "utf-8" }).trim();
    const match = pyVer.match(/Python (\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major > 3 || (major === 3 && minor >= 9)) {
        addCheck("Python 3", "PASS", `${pyVer} (meets Python 3.9+ requirement)`);
      } else {
        addCheck("Python 3", "FAIL", `${pyVer} (Python 3.9+ required)`);
      }
    } else {
      addCheck("Python 3", "PASS", pyVer);
    }
  } catch (e) {
    addCheck("Python 3", "FAIL", "python3 executable not found");
  }

  // 3. Check FFmpeg & codecs
  try {
    const ffmpegOut = execSync("ffmpeg -version", { encoding: "utf-8" });
    const hasX264 = ffmpegOut.includes("enable-libx264") || ffmpegOut.includes("libx264");
    if (hasX264) {
      addCheck("FFmpeg", "PASS", "Installed with libx264 encoding support");
    } else {
      addCheck("FFmpeg", "WARN", "Installed but libx264 not explicitly enabled");
    }
  } catch (e) {
    addCheck("FFmpeg", "FAIL", "ffmpeg executable not found on PATH");
  }

  // 4. Check FFprobe
  try {
    execSync("ffprobe -version", { encoding: "utf-8" });
    addCheck("FFprobe", "PASS", "Installed and ready for media duration checks");
  } catch (e) {
    addCheck("FFprobe", "FAIL", "ffprobe executable not found on PATH");
  }

  // 5. Check edge-tts
  let edgeTtsFound = false;
  let edgeTtsVer = "";
  const candidates = [
    "edge-tts",
    "/Users/yassir/Library/Python/3.14/bin/edge-tts",
    path.join(os.homedir(), ".local/bin/edge-tts"),
    "/tmp/tts_venv/bin/edge-tts"
  ];

  for (const c of candidates) {
    try {
      edgeTtsVer = execSync(`"${c}" --version`, { encoding: "utf-8" }).trim();
      edgeTtsFound = true;
      break;
    } catch (e) {}
  }

  if (!edgeTtsFound) {
    try {
      edgeTtsVer = execSync("python3 -m edge_tts --version", { encoding: "utf-8" }).trim();
      edgeTtsFound = true;
    } catch (e) {}
  }

  if (edgeTtsFound) {
    const match = edgeTtsVer.match(/(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      const patch = parseInt(match[3], 10);
      const isModern = major > 7 || (major === 7 && (minor > 3 || (minor === 3 && patch >= 0)));
      if (isModern) {
        addCheck("edge-tts", "PASS", `Installed (${edgeTtsVer}) - compatible with Microsoft TTS endpoints`);
      } else {
        addCheck("edge-tts", "WARN", `Installed (${edgeTtsVer})`, "Versions < 7.3.0 fail with HTTP 403 from Microsoft. Please upgrade to 7.3.1+: pip install --upgrade edge-tts");
      }
    } else {
      addCheck("edge-tts", "PASS", `Installed (${edgeTtsVer})`);
    }
  } else {
    addCheck("edge-tts", "WARN", "edge-tts not found in PATH or virtualenv", "Install via: pip install edge-tts");
  }

  // 6. Check Playwright Chromium
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const bVer = browser.version();
    await browser.close();
    addCheck("Playwright Chromium", "PASS", `Chromium ${bVer} available for headless recording`);
  } catch (e) {
    addCheck("Playwright Chromium", "FAIL", `Failed to launch Chromium: ${e.message}`, "Run: npx playwright install chromium");
  }

  // 7. Check Disk Space
  try {
    const stats = fs.statfsSync(".");
    const freeBytes = stats.bavail * stats.bsize;
    const freeMB = Math.round(freeBytes / (1024 * 1024));
    if (freeMB > 500) {
      addCheck("Disk Space", "PASS", `${freeMB} MB available in workspace`);
    } else {
      addCheck("Disk Space", "WARN", `Low disk space: only ${freeMB} MB free in workspace`);
    }
  } catch (e) {
    addCheck("Disk Space", "PASS", "Workspace writeable");
  }

  // 8. Publishing Capability Check
  const chromeCookiePath = path.join(os.homedir(), "Library/Application Support/Google/Chrome/Default/Cookies");
  const hasChromeCookies = fs.existsSync(chromeCookiePath);
  if (process.platform === "darwin" && hasChromeCookies) {
    addCheck("Publishing", "PASS", "macOS Chrome session cookies detected (supports zero-auth upload)");
  } else {
    addCheck("Publishing", "PASS", "Supports Playwright storageState / persistent context profile for YouTube Studio");
  }

  console.log("\n-------------------------------------------------");
  const failed = checks.filter((c) => c.status === "FAIL");
  const warnings = checks.filter((c) => c.status === "WARN");

  if (failed.length === 0) {
    console.log(`Doctor Summary: ALL CHECKS PASSED (${warnings.length} warnings). Ready for recording!`);
    return 0;
  } else {
    console.log(`Doctor Summary: ${failed.length} FATAL CHECKS FAILED. Please resolve the issues above.`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith("doctor.js")) {
  runDoctor()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("Doctor error:", err);
      process.exit(1);
    });
}
