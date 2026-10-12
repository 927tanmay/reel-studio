#!/usr/bin/env node
/**
 * Stage 06c (optional) — Pacing, measured.
 *
 * Reads the resolved timeline — the same frames the renderer will use — and
 * reports how the reel actually moves: when the picture first changes, the
 * longest stretch where nothing does, how much of the runtime has someone
 * talking, and the dead air between. It reports; it never edits, and it never
 * says a reel is good. The thresholds below are rules of thumb for short-form
 * (a visual change every couple of seconds, no silence a viewer notices) —
 * flags are arguments, because what is too slow depends on the reel.
 *
 *   npm run critique 001-my-reel
 *   npm run critique 001-my-reel -- --max-gap 4 --hook 3 --dead-air 0.6
 */
import { spawn } from "node:child_process";
import { ROOT, fmt, requirePost } from "./lib.mjs";

const id = requirePost(process.argv[2]);

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};

// Rules of thumb, not findings. Every one is overridable above.
const maxGap = flag("max-gap", 3); // seconds the picture may sit unchanged
const hook = flag("hook", 3); // seconds that count as the opening
const deadAir = flag("dead-air", 0.5); // a silence longer than this is not breathing
const firstChangeBy = flag("first-change", 2); // seconds until something should happen
const coalesce = 0.25; // a cut that also starts a mark is one change, not two

const dump = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      [
        "--experimental-strip-types",
        "--experimental-loader",
        "./scripts/ts-resolve-hook.mjs",
        "--disable-warning=ExperimentalWarning",
        "scripts/dump-critique.ts",
        id,
        String(coalesce),
        String(hook),
        String(deadAir),
      ],
      { cwd: ROOT },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code === 0) resolve(JSON.parse(out));
      else reject(new Error(err || `dump-critique exited ${code}`));
    });
  });

const r = await dump();
const s = (n) => `${n.toFixed(1)}s`;

fmt.head(`Pacing: ${id}`);
console.log(
  `  ${s(r.runtimeSeconds)} across ${r.shots.count} shots — mean ${s(r.shots.meanSeconds)}, ` +
    `shortest ${s(r.shots.shortest.seconds)} (shot ${r.shots.shortest.shot}), ` +
    `longest ${s(r.shots.longest.seconds)} (shot ${r.shots.longest.shot})`,
);

fmt.head("Opening");
if (r.timeToFirstChange === null) {
  fmt.warn("Nothing on screen ever changes.");
} else if (r.timeToFirstChange > firstChangeBy) {
  fmt.warn(`First visible change at ${s(r.timeToFirstChange)} (flagged past ${s(firstChangeBy)}).`);
} else {
  fmt.ok(`First visible change at ${s(r.timeToFirstChange)}.`);
}
console.log(`  ${r.changesInHook} change${r.changesInHook === 1 ? "" : "s"} in the first ${s(hook)}.`);
if (r.speech) {
  console.log(`  First word at ${s(r.speech.timeToFirstWord)}.`);
}

fmt.head("Rhythm");
console.log(`  ${r.changesPer10s.toFixed(1)} visible changes per 10 seconds.`);
const long = r.gaps.filter((g) => g.seconds > maxGap);
if (long.length === 0) {
  fmt.ok(`No stretch longer than ${s(maxGap)} without a change.`);
}
for (const g of long.slice(0, 5)) {
  const after = g.startsAfter ? `after ${g.startsAfter.label}` : "from the start";
  fmt.warn(`${s(g.seconds)} with no change, ${s(g.from)} → ${s(g.to)} (${after}).`);
}
if (long.length > 5) console.log(`  …and ${long.length - 5} more.`);

if (r.speech) {
  fmt.head("Speech");
  const sp = r.speech;
  console.log(
    `  ${sp.words} words, ~${sp.wordsPerMinute} wpm while speaking; ` +
      `${Math.round(sp.coverage * 100)}% of the runtime has someone talking.`,
  );
  if (sp.deadAir.length === 0) {
    fmt.ok(`No silence longer than ${s(deadAir)} between words.`);
  }
  for (const d of sp.deadAir.slice(0, 5)) {
    fmt.warn(`${s(d.seconds)} of silence, ${s(d.from)} → ${s(d.to)}.`);
  }
  if (sp.trailingSilence > deadAir) console.log(`  ${s(sp.trailingSilence)} of silence after the last word.`);
}

fmt.head("What this cannot see");
for (const b of r.blind) console.log(`  · ${b}`);
console.log("");
