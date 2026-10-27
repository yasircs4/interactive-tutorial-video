import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";

test("doctor CLI runs and outputs diagnostic summary", () => {
  const output = execSync("node skills/interactive-tutorial-video/scripts/doctor.js", {
    encoding: "utf-8"
  });
  assert.ok(output.includes("Interactive Tutorial Video Skill: Doctor"), "Should contain doctor banner");
  assert.ok(output.includes("Node.js"), "Should check Node.js");
  assert.ok(output.includes("FFmpeg"), "Should check FFmpeg");
  assert.ok(output.includes("Doctor Summary"), "Should contain summary");
});
