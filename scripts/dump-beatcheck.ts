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
import { nearestBeat, type BeatGrid } from "../engine/beats.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];

if (!id) {
  console.error("Usage: node --experimental-strip-types scripts/dump-beatcheck.ts <post>");
  process.exit(1);
}

const shotlistPath = path.join(ROOT, "public", "posts", id, "shotlist.ts");
const { default: spec } = await import(pathToFileURL(shotlistPath).href);

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

console.log(
  JSON.stringify(
    {
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
