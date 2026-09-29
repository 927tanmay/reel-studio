#!/usr/bin/env node
/**
 * Stage 06b (optional) — How far a shotlist's cuts, hits and dips sit from
 * the bed's real beat grid.
 *
 * `npm run beats <track>` finds the tempo and phase; `hits`/`dips` marked
 * `onBeat: true` already snap themselves to it, automatically, inside
 * `resolveTimeline`. A shot's own cut can't do that — its length comes from
 * a measured duration or a spoken word, never from music, so nudging it to
 * land on a beat is an editorial call, not something the engine should make
 * silently. This reports the distance instead of closing it: which cuts
 * already fall near a beat by chance, which are off by a frame or two a
 * `seconds` tweak could close, and which aren't close enough to be worth
 * chasing.
 *
 *   npm run beatcheck 001-my-reel
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT, fmt, requirePost } from "./lib.mjs";

const id = requirePost(process.argv[2]);

const dump = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      [
        "--experimental-strip-types",
        "--experimental-loader",
        "./scripts/ts-resolve-hook.mjs",
        "scripts/dump-beatcheck.ts",
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
      else reject(new Error(err || `dump-beatcheck exited ${code}`));
    });
  });

const report = await dump();

fmt.head(`Beat check: ${id}`);

if (report.error === "no-bed") {
  console.log("  This post has no `bed` — nothing to check against.");
  process.exit(0);
}
if (report.error === "no-beats-json") {
  console.log(
    `  No beat grid for "${report.track}" yet. Run: npm run beats ${report.track}\n` +
      "  (it writes <track>.beats.json next to the file, and it's not committed —\n" +
      "  re-run it on any machine that doesn't have it.)",
  );
  process.exit(0);
}

const confidenceWord =
  report.confidence > 3 ? "clear" : report.confidence > 2 ? "workable" : "weak — treat distances loosely";
console.log(
  `  ${report.bpm} BPM, confidence ${report.confidence} (${confidenceWord}) — "${report.track}", ` +
    `trackIn ${report.trackIn}s, entering on shot ${report.startShot} (frame ${report.bedStartFrame})`,
);

for (const w of report.engineWarnings ?? []) fmt.warn(w);

// Within this many frames of a beat counts as "on it" for reporting purposes
// — a viewer doesn't feel a sub-frame difference, and this repository
// renders at 30 or 60fps, where 2 frames is under 70ms either way.
const ON_BEAT = 2;

const row = (label, entry) => {
  if (entry.beforeBed) {
    console.log(`  · ${label} at ${entry.seconds.toFixed(2)}s — before the bed starts, not checked`);
    return;
  }
  const off = entry.offsetFrames;
  if (Math.abs(off) <= ON_BEAT) {
    fmt.ok(`${label} at ${entry.seconds.toFixed(2)}s — on beat`);
  } else {
    const nearestSeconds = (entry.nearestBeatFrame / report.fps).toFixed(2);
    fmt.warn(
      `${label} at ${entry.seconds.toFixed(2)}s — ${off > 0 ? "+" : ""}${off}f off beat ` +
        `(nearest beat lands at ${nearestSeconds}s, frame ${entry.nearestBeatFrame})`,
    );
  }
};

fmt.head("Shot cuts (not auto-snapped — a cut is anchored to duration or speech, never music)");
if (report.cuts.length === 0) console.log("  No cuts after shot 0.");
for (const c of report.cuts) {
  row(`shot ${c.index} (${c.enter}) "${c.label}"`, c);
}

if (report.hits.length > 0) {
  fmt.head("Hits (onBeat: true already snaps these — shown here to confirm, or to flag ones that don't have it set)");
  for (const h of report.hits) row(`"${h.sfx}"`, h);
}

if (report.dips.length > 0) {
  fmt.head("Dips");
  for (const d of report.dips) row("dip", d);
}

fmt.head("Using it in a shotlist");
console.log(
  "  A hit or dip that's off: add `onBeat: true` and resolveTimeline snaps it\n" +
    "  itself. A cut that's off: nudge the shot before it — `seconds`, `drop` — by\n" +
    "  the frame count above and re-run this, or leave it if the beat isn't the\n" +
    "  thing that cut is actually serving.",
);
