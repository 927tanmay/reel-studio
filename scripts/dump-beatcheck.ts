/**
 * Prints a post's shot cuts, hits and dips against its bed's beat grid, as
 * JSON — the same resolved frames the engine renders from, gotten by
 * importing the real shotlist and `resolveTimeline` directly, the same way
 * dump-timeline.ts does for export-timeline.
 *
 *   node --experimental-strip-types scripts/dump-beatcheck.ts 001-my-reel
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveTimeline, shotLabel } from "../engine/spec.ts";
import { fitTrackIn, nearestBeat, type BeatGrid } from "../engine/beats.ts";
import { hardMoments } from "../engine/listen.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];

if (!id) {
  console.error("Usage: node --experimental-strip-types scripts/dump-beatcheck.ts <post>");
  process.exit(1);
}

const shotlistPath = path.join(ROOT, "public", "posts", id, "shotlist.ts");
// Whatever the shotlist prints while it loads (a format's plan, say) would land
// in the JSON this script writes to stdout, so it goes to stderr instead.
const log = console.log;
console.log = (...args: unknown[]) => console.error(...args);
const { default: spec } = await import(pathToFileURL(shotlistPath).href);
console.log = log;

if (!spec.bed) {
  console.log(JSON.stringify({ error: "no-bed" }));
  process.exit(0);
}

const beatsFile = path.join(ROOT, "public", "assets", "music", `${spec.bed.track}.beats.json`);
if (!existsSync(beatsFile)) {
  console.log(JSON.stringify({ error: "no-beats-json", track: spec.bed.track }));
  process.exit(0);
}
const grid: BeatGrid & { confidence: number } = JSON.parse(await readFile(beatsFile, "utf8"));

const timeline = resolveTimeline(spec);
const { fps } = spec.frame;
const bedStartFrame = timeline.shots[spec.bed.startShot ?? 0]?.startFrame ?? 0;
const trackIn = spec.bed.trackIn ?? 0;

/** How far `frame` sits from the nearest beat, or null before the bed plays. */
const check = (frame: number): { offsetFrames: number; nearestBeatFrame: number } | null => {
  if (frame < bedStartFrame) return null;
  const trackSeconds = trackIn + (frame - bedStartFrame) / fps;
  const snappedSeconds = nearestBeat(grid, trackSeconds);
  const nearestBeatFrame = bedStartFrame + Math.round((snappedSeconds - trackIn) * fps);
  return { offsetFrames: frame - nearestBeatFrame, nearestBeatFrame };
};

const annotate = (frame: number) => {
  const c = check(frame);
  return c ? { offsetFrames: c.offsetFrames, nearestBeatFrame: c.nearestBeatFrame } : { beforeBed: true };
};

const cuts = timeline.shots
  .filter((s) => s.index > 0)
  .map((s) => ({
    index: s.index,
    label: shotLabel(s.shot),
    enter: s.shot.enter?.kind ?? "cut",
    frame: s.startFrame,
    seconds: Number((s.startFrame / fps).toFixed(3)),
    ...annotate(s.startFrame),
  }));

const hits = timeline.hits.map((h) => ({
  sfx: h.sfx,
  frame: h.frame,
  seconds: Number((h.frame / fps).toFixed(3)),
  ...annotate(h.frame),
}));

const dips = timeline.dips.map((d) => ({
  frame: d.frame,
  seconds: Number((d.frame / fps).toFixed(3)),
  ...annotate(d.frame),
}));

// Where to start reading the track so the hard moments (cuts, slams, impacts)
// land on beats: only slides the phase, within half a beat of the current trackIn.
const moments = hardMoments(timeline, fps).filter((m) => m.frame >= bedStartFrame);
const fitted = fitTrackIn(grid, moments.map((m) => (m.frame - bedStartFrame) / fps), trackIn);
const fit = {
  trackIn: fitted.trackIn,
  moments: moments.map((m, i) => ({
    what: m.what,
    seconds: Number((m.frame / fps).toFixed(3)),
    beforeMs: Math.round(fitted.before[i] * 1000),
    afterMs: Math.round(fitted.after[i] * 1000),
  })),
};

console.log(
  JSON.stringify(
    {
      fit,
      fps,
      bpm: grid.bpm,
      confidence: grid.confidence,
      track: spec.bed.track,
      trackIn,
      startShot: spec.bed.startShot ?? 0,
      bedStartFrame,
      engineWarnings: timeline.warnings,
      cuts,
      hits,
      dips,
    },
    null,
    2,
  ),
);
