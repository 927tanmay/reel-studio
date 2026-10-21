#!/usr/bin/env node
/**
 * Is this machine ready to cut a reel?
 *
 * Checks what the pipeline needs before it needs it, and says exactly what to
 * run when something is missing, instead of letting a stage fail halfway with
 * a stack trace. Nothing here changes anything.
 *
 *   npm run doctor
 *
 * Exits 1 only when something *required* is missing. Transcription and music
 * are optional until you reach those stages, so they warn.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ROOT, fmt, has } from "./lib.mjs";

const exec = promisify(execFile);
let failed = false;

const version = async (cmd, args) => {
  try {
    const { stdout, stderr } = await exec(cmd, args);
    return (stdout || stderr).split("\n")[0].trim();
  } catch {
    return null;
  }
};

fmt.head("Reel Studio — environment check");

// Node: the TypeScript scripts rely on native type stripping.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major > 22 || (major === 22 && minor >= 6)) {
  fmt.ok(`Node ${process.versions.node}`);
} else {
  fmt.fail(`Node ${process.versions.node} — 22.6 or newer is required (the scripts run TypeScript directly).`);
  failed = true;
}

if (existsSync(path.join(ROOT, "node_modules", "remotion"))) {
  fmt.ok("Dependencies installed");
} else {
  fmt.fail("Dependencies are not installed. Run: npm install");
  failed = true;
}

// ffmpeg and ffprobe: measuring, conforming, loudness and the final encode.
for (const tool of ["ffmpeg", "ffprobe"]) {
  if (await has(tool)) {
    fmt.ok(`${tool} — ${(await version(tool, ["-version"])) ?? "found"}`);
  } else {
    fmt.fail(`${tool} not found. Install it: brew install ffmpeg   (Linux: sudo apt-get install ffmpeg)`);
    failed = true;
  }
}

// uv runs Whisper for transcription: optional until stage 05.
if (await has("uv")) {
  fmt.ok(`uv — ${(await version("uv", ["--version"])) ?? "found"} (transcription)`);
} else {
  fmt.warn("uv not found — only needed for `npm run transcribe`. Install it: brew install uv");
}

// Sound effects are committed; a missing one means an incomplete checkout.
const sfx = ["snap", "whoosh", "tick", "tap", "switch"];
const missing = sfx.filter((name) => !existsSync(path.join(ROOT, "public", "assets", "sfx", `${name}.wav`)));
if (missing.length === 0) {
  fmt.ok("Sound effects present");
} else {
  fmt.warn(`Missing sound effects (${missing.join(", ")}). Regenerate: node scripts/make-sfx.mjs`);
}

// Music is deliberately not committed.
const music = path.join(ROOT, "public", "assets", "music");
const hasTrack =
  existsSync(music) &&
  (await import("node:fs/promises")).readdir(music).then((f) => f.some((n) => /\.(wav|mp3|m4a|aac|flac)$/i.test(n)));
if (await hasTrack) {
  fmt.ok("A music track is available");
} else {
  fmt.warn("No music track in public/assets/music — only needed if a reel has a bed. Write a default: node scripts/make-music.mjs");
}

console.log("");
if (failed) {
  console.log("  Not ready — fix the ✗ items above, then run `npm run doctor` again.\n");
  process.exit(1);
}
console.log("  Ready. Prove the whole chain with: npm run render 000-smoke-test\n");
