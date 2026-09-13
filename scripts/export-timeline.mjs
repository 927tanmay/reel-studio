#!/usr/bin/env node
/**
 * Stage 09 (optional) — Export a timeline.
 *
 * Turns the finished render into a CMX3600 EDL: the same shot boundaries the
 * engine already computed, as separate, independently editable clips in a
 * real NLE timeline, instead of one flattened file. Import it into DaVinci
 * Resolve (free, and the best EDL support of the free options) and every cut
 * point becomes something you can select, trim, delete, reorder, or grade on
 * its own — small manual tweaks, on top of what the shotlist already built.
 *
 * Deliberately conservative for now: every clip references the *rendered*
 * reel.mp4, not the original raw footage, and audio and video travel
 * together as one clip per shot. That means you can rearrange and trim the
 * cuts that already exist, but not yet reveal more of a real clip than the
 * shotlist chose to show. A version that references raw source footage
 * directly is a reasonable next step, once this simpler one is confirmed
 * to actually import the way it's meant to — verified here as much as an
 * EDL's own arithmetic allows, not by opening it in Resolve, which isn't
 * available in the environment that built this.
 *
 *   npm run export-timeline 001-my-reel
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { ROOT, fmt, postDir, probe, requireFfmpeg, requirePost, writeJson } from "./lib.mjs";
import { writeFile } from "node:fs/promises";

const id = requirePost(process.argv[2]);
await requireFfmpeg();

const reelPath = path.join(ROOT, "out", id, "reel.mp4");
if (!existsSync(reelPath)) {
  console.error(`No render yet. Run: npm run render ${id}`);
  process.exit(1);
}

// dump-timeline.ts imports the real shotlist and resolveTimeline directly —
// the same boundaries the engine renders from, not a re-derived guess.
// Node's native loader needs the resolve hook because every shotlist and
// engine file imports relatively without an extension, which Remotion's own
// bundler resolves but Node's does not.
const dump = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      [
        "--experimental-strip-types",
        "--experimental-loader",
        "./scripts/ts-resolve-hook.mjs",
        "scripts/dump-timeline.ts",
        id,
      ],
      { cwd: ROOT },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code === 0) resolve(JSON.parse(out));
      else reject(new Error(err || `dump-timeline exited ${code}`));
    });
  });

const timeline = await dump();
const info = await probe(reelPath);

if (Math.abs(info.fps - timeline.fps) > 0.5) {
  fmt.warn(
    `The shotlist's frame rate (${timeline.fps}) and the rendered file's (${info.fps}) disagree. ` +
      `Re-render before exporting, so the timecodes below actually match reel.mp4.`,
  );
}

const fps = Math.round(timeline.fps);

/** HH:MM:SS:FF at a whole-number frame rate. Drop-frame timecode (29.97,
 * 59.94) isn't handled — every post so far renders at a clean 30 or 60, and
 * treating those rates as non-drop is exactly correct, not an approximation. */
const timecode = (frame) => {
  const s = Math.floor(frame / fps);
  const f = frame % fps;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ff = String(f).padStart(2, "0");
  return `${hh}:${mm}:${ss}:${ff}`;
};

const lines = [`TITLE: ${id}`, `FCM: NON-DROP FRAME`, ""];

// A blend or push starts its shot before the previous one's own listed
// duration ends, so consecutive shots can genuinely overlap in the resolved
// timeline — correct for rendering, but a CMX3600 "cut" event has to own a
// non-overlapping stretch of record time, or the EDL is ambiguous about who
// owns those frames. Every clip here is a slice of the same rendered file
// regardless, so nothing is lost by resolving the overlap in favour of
// whichever shot enters it: its predecessor's event simply ends where the
// next one's begins, and the blended frames themselves stay exactly as
// rendered, inside the incoming clip.
timeline.shots.forEach((shot, i) => {
  const next = timeline.shots[i + 1];
  const naturalEnd = shot.startFrame + shot.durationInFrames;
  const clippedEnd = next ? Math.min(naturalEnd, next.startFrame) : naturalEnd;

  const num = String(i + 1).padStart(3, "0");
  const inTc = timecode(shot.startFrame);
  const outTc = timecode(clippedEnd);
  // Same file for source and record: this event is a slice of reel.mp4 at
  // the position it already plays, given a boundary of its own to select,
  // trim or delete independently of its neighbours.
  lines.push(`${num}  REEL1    AA/V  C        ${inTc} ${outTc} ${inTc} ${outTc}`);
  lines.push(`* FROM CLIP NAME: reel.mp4`);
  lines.push(`* SHOT ${shot.index}: ${shot.label}`);
  lines.push("");
});

const edlPath = path.join(ROOT, "out", id, "timeline.edl");
await writeFile(edlPath, lines.join("\n"));

// A manifest alongside it, for anything that wants the same boundaries
// without parsing EDL syntax back out again — the hand-back workflow, or a
// future raw-source version of this same export.
await writeJson(path.join(ROOT, "out", id, "timeline.json"), timeline);

fmt.head(`Exported ${timeline.shots.length} clips`);
console.log(`  ${path.relative(ROOT, edlPath)}`);
console.log(
  "\n  In DaVinci Resolve (free): File → Import → Timeline, pick this .edl, and place\n" +
    `  reel.mp4 in the same folder first so it can locate the source by name.\n` +
    "  Each shot lands as its own clip — select, trim, delete, reorder or grade\n" +
    "  any of them without touching the rest.\n\n" +
    "  This wasn't opened in Resolve to confirm it imports the way it's meant to —\n" +
    "  that tool isn't available here. If something's off on your end, say what\n" +
    "  you saw and it gets fixed from there.",
);
