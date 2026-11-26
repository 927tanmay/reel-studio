#!/usr/bin/env node
/**
 * File-level gates.
 *
 * Checks the finished file rather than the intention. The gates that can be
 * settled before rendering — text inside a covered zone, a crop that would
 * enlarge a source — live in engine/verify.ts and run in the studio.
 *
 *   npm run verify 001-first-cut
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { ROOT, fmt, postDir, probe, readJson, requireFfmpeg, requirePost, run } from "./lib.mjs";

const id = requirePost(process.argv[2]);
await requireFfmpeg();

const config = (await readJson(path.join(postDir(id), "post.json"), null)) ?? {};
const frame = config.frame ?? { w: 1080, h: 1920, fps: 30 };
const target = config.target ?? {};
const targetLufs = config.targetLufs === null ? null : (config.targetLufs ?? -14);
const maxBytes = (config.maxMegabytes ?? 250) * 1024 * 1024;

const file = path.join(ROOT, "out", id, "reel.mp4");
if (!existsSync(file)) {
  console.error(`Nothing rendered yet. Run: npm run render ${id}`);
  process.exit(1);
}

const info = await probe(file);
const size = (await stat(file)).size;
let failures = 0;

const check = (ok, good, bad) => {
  if (ok) fmt.ok(good);
  else {
    fmt.fail(bad);
    failures++;
  }
};

check(
  info.width === frame.w && info.height === frame.h,
  `Frame  ${info.width}x${info.height}`,
  `Frame  ${info.width}x${info.height}, expected ${frame.w}x${frame.h}`,
);

check(
  Math.abs(info.fps - frame.fps) < 0.5,
  `Rate   ${info.fps} fps`,
  `Rate   ${info.fps} fps, expected ${frame.fps}`,
);

if (target.maxSeconds) {
  check(
    info.seconds <= target.maxSeconds + 0.05,
    `Length ${info.seconds.toFixed(2)}s, under the ${target.maxSeconds}s ceiling`,
    `Length ${info.seconds.toFixed(2)}s, over the ${target.maxSeconds}s ceiling by ${(info.seconds - target.maxSeconds).toFixed(2)}s`,
  );
} else {
  fmt.ok(`Length ${info.seconds.toFixed(2)}s`);
}

check(size <= maxBytes, `Size   ${(size / 1024 / 1024).toFixed(1)} MB`, `Size   ${(size / 1024 / 1024).toFixed(1)} MB, over the limit`);

check(info.codec === "h264", `Codec  ${info.codec}`, `Codec  ${info.codec}, expected h264`);

if (info.hasAudio && targetLufs !== null) {
  const { stderr } = await run("ffmpeg", [
    "-i", file,
    "-af", "loudnorm=print_format=json",
    "-f", "null", "-",
  ]);
  const m = stderr.match(/\{[\s\S]*\}/);
  if (m) {
    const measured = Number(JSON.parse(m[0]).input_i);
    check(
      Math.abs(measured - targetLufs) <= 1.5,
      `Loud   ${measured.toFixed(1)} LUFS`,
      `Loud   ${measured.toFixed(1)} LUFS, off target ${targetLufs} by ${Math.abs(measured - targetLufs).toFixed(1)}`,
    );
  }
}

// True peak and the mono fold-down, measured on the file itself (a sound pass
// measures the export, never the mix before encoding). Peaks above -1 dBTP can
// clip once a platform re-encodes or a phone speaker plays it; a mono fold-down
// much quieter than the stereo means something is out of phase and vanishes on
// a single speaker. Both are warnings: a reel can choose to be loud.
if (info.hasAudio) {
  const ebur = async (extra) => {
    const { stderr } = await run("ffmpeg", ["-nostats", "-i", file, ...extra, "-af", "ebur128=peak=true", "-f", "null", "-"]);
    const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
    const i = /I:\s*(-?[\d.]+) LUFS/.exec(summary);
    const p = /Peak:\s*(-?[\d.]+|-inf) dBFS/.exec(summary);
    return { lufs: i ? Number(i[1]) : null, peak: p && p[1] !== "-inf" ? Number(p[1]) : null };
  };
  const stereo = await ebur([]);
  const mono = await ebur(["-ac", "1"]);
  if (stereo.peak !== null) {
    if (stereo.peak > -1) fmt.warn(`Peak   ${stereo.peak.toFixed(1)} dBTP, above -1: may clip after a platform re-encodes it`);
    else fmt.ok(`Peak   ${stereo.peak.toFixed(1)} dBTP`);
  }
  if (stereo.lufs !== null && mono.lufs !== null) {
    const drop = stereo.lufs - mono.lufs;
    if (drop > 3) fmt.warn(`Mono   ${drop.toFixed(1)} LU quieter folded to mono: something is out of phase and thins on one speaker`);
    else fmt.ok(`Mono   ${mono.lufs.toFixed(1)} LUFS folded down (${drop >= 0 ? "-" : "+"}${Math.abs(drop).toFixed(1)} LU)`);
  }
}

if (targetLufs === null) {
  fmt.warn("Loud   not checked (targetLufs is null in post.json)");
} else if (!info.hasAudio) {
  fmt.warn("Audio  none");
}

// Frames to look at, including the two the platform will crop into a cover.
const contact = path.join(ROOT, "out", id, "frames");
await mkdir(contact, { recursive: true });
const marks = [0.4, info.seconds / 2, Math.max(0, info.seconds - 0.6)];
for (const [i, t] of marks.entries()) {
  await run("ffmpeg", [
    "-y", "-ss", String(t), "-i", file, "-frames:v", "1",
    "-q:v", "3",
    path.join(contact, `${String(i + 1).padStart(2, "0")}.jpg`),
  ]);
}
fmt.ok(`Frames out/${id}/frames — open these before posting`);

console.log("");
if (failures > 0) {
  console.error(`${failures} gate(s) failed.`);
  process.exit(1);
}
console.log("All gates passed.");
