/**
 * Prints a post's resolved timeline as JSON — the same shot boundaries the
 * engine renders from, gotten by importing the real shotlist and
 * `resolveTimeline` directly rather than re-deriving them.
 *
 * Run with `node --experimental-strip-types`, not compiled: this repository
 * has no build step, and a one-off diagnostic script is exactly the case
 * Node's native TypeScript support exists for.
 *
 *   node --experimental-strip-types scripts/dump-timeline.ts 001-my-reel
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveTimeline, shotLabel } from "../engine/spec.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];

if (!id) {
  console.error("Usage: node --experimental-strip-types scripts/dump-timeline.ts <post>");
  process.exit(1);
}

const shotlistPath = path.join(ROOT, "public", "posts", id, "shotlist.ts");
const { default: spec } = await import(pathToFileURL(shotlistPath).href);
const timeline = resolveTimeline(spec);

const shots = timeline.shots.map((resolved) => ({
  index: resolved.index,
  label: shotLabel(resolved.shot),
  // A string src with a real media entry is a real, re-trimmable clip; a
  // generated or banded shot has no underlying file at all, and the export
  // step needs to tell those two cases apart.
  mediaKey: typeof resolved.shot.src === "string" ? resolved.shot.src : null,
  startFrame: resolved.startFrame,
  durationInFrames: resolved.durationInFrames,
}));

console.log(
  JSON.stringify(
    { fps: spec.frame.fps, durationInFrames: timeline.durationInFrames, shots },
    null,
    2,
  ),
);
