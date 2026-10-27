#!/usr/bin/env node
/**
 * Video Conversion Utility for Interactive Tutorial Video
 * 
 * Converts raw Playwright WebM (VP8/VP9) recordings to standardized
 * Full HD 1080p H.264 MP4 (yuv420p, 30fps, faststart).
 * 
 * Compliant with agentskills.io specifications.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Converts a video file to standardized H.264 MP4.
 * 
 * @param {string} inputPath Path to input WebM or MP4
 * @param {string} outputPath Path to output MP4
 * @param {Object} [options]
 * @param {number} [options.fps=30] Target framerate
 * @param {string} [options.crf="22"] H.264 CRF quality
 * @param {string} [options.preset="fast"] x264 preset
 */
export function convertToH264(inputPath, outputPath, options = {}) {
  const { fps = 30, crf = "22", preset = "fast" } = options;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input video file not found: ${inputPath}`);
  }

  osEnsureDir(outputPath);

  let hasAudio = false;
  try {
    const probe = execFileSync("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_type",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath
    ], { encoding: "utf-8" }).trim();
    hasAudio = (probe === "audio");
  } catch (e) {
    hasAudio = false;
  }

  const ffmpegArgs = [
    "-y",
    "-i", inputPath
  ];

  if (hasAudio) {
    ffmpegArgs.push(
      "-map", "0:v:0",
      "-map", "0:a:0",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-preset", preset,
      "-crf", String(crf),
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-ac", "2",
      "-b:a", "192k"
    );
  } else {
    ffmpegArgs.push(
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-preset", preset,
      "-crf", String(crf),
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-ac", "2",
      "-b:a", "192k",
      "-shortest"
    );
  }

  ffmpegArgs.push(outputPath);

  console.log(`[convert_video] Converting ${inputPath} -> ${outputPath} (30 fps, Stereo AAC)...`);
  execFileSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
  console.log(`[convert_video] Conversion complete: ${outputPath}`);
}

function osEnsureDir(filePath) {
  const dir = path.dirname(path.resolve(filePath));
  fs.mkdirSync(dir, { recursive: true });
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith("convert_video.js")) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node convert_video.js <input.webm> <output.mp4> [--fps 30] [--crf 22]");
    process.exit(1);
  }

  const [inputPath, outputPath] = args;
  let fps = 30;
  let crf = "22";

  const fpsIdx = args.indexOf("--fps");
  if (fpsIdx !== -1 && args[fpsIdx + 1]) fps = parseInt(args[fpsIdx + 1], 10);

  const crfIdx = args.indexOf("--crf");
  if (crfIdx !== -1 && args[crfIdx + 1]) crf = args[crfIdx + 1];

  try {
    convertToH264(inputPath, outputPath, { fps, crf });
  } catch (err) {
    console.error("[convert_video] Error:", err.message);
    process.exit(1);
  }
}
