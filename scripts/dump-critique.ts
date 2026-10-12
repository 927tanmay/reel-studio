/**
 * Prints a post's pacing numbers as JSON, from the real shotlist and
 * `resolveTimeline` — the same pattern as dump-beatcheck.ts.
 *
 *   node --experimental-strip-types scripts/dump-critique.ts 001-my-reel <coalesce> <hook> <deadAir>
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { critiqueTimeline } from "../engine/critique.ts";
import { resolveTimeline } from "../engine/spec.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [id, coalesce, hook, deadAir] = process.argv.slice(2);

if (!id) {
  console.error("Usage: dump-critique.ts <post> <coalesceSeconds> <hookSeconds> <deadAirSeconds>");
  process.exit(1);
}

const { default: spec } = await import(
  pathToFileURL(path.join(ROOT, "public", "posts", id, "shotlist.ts")).href
);
const timeline = resolveTimeline(spec);

console.log(
  JSON.stringify(
    critiqueTimeline(spec, timeline, {
      coalesceSeconds: Number(coalesce),
      hookSeconds: Number(hook),
      deadAirSeconds: Number(deadAir),
    }),
  ),
);
