/**
 * Prints a post's `thumbnail` field as JSON, gotten by importing the real
 * shotlist directly rather than re-deriving it — the same object
 * `Thumbnail.tsx` reads at render time.
 *
 * Run with `node --experimental-strip-types`, not compiled: this repository
 * has no build step, and a one-off diagnostic script is exactly the case
 * Node's native TypeScript support exists for.
 *
 *   node --experimental-strip-types scripts/dump-thumbnail.ts 001-my-reel
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveTimeline, shotLabel } from "../engine/spec.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];

if (!id) {
  console.error("Usage: node --experimental-strip-types scripts/dump-thumbnail.ts <post>");
  process.exit(1);
}

const shotlistPath = path.join(ROOT, "public", "posts", id, "shotlist.ts");
const { default: spec } = await import(pathToFileURL(shotlistPath).href);

if (!spec.thumbnail) {
  console.error(
    `No "thumbnail" field on ${id}'s shotlist. Add one, e.g.:\n\n` +
      `  thumbnail: { shot: 0, text: "Your hook line" },\n\n` +
      `"shot" is the 0-based index into this post's own shots array.`,
  );
  process.exit(1);
}

const timeline = resolveTimeline(spec);
const resolved = timeline.shots[spec.thumbnail.shot];

if (!resolved) {
  console.error(
    `thumbnail.shot is ${spec.thumbnail.shot}, but ${id} only has ${timeline.shots.length} shots.`,
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      shot: spec.thumbnail.shot,
      label: shotLabel(resolved.shot),
      at: spec.thumbnail.at ?? 0.8,
      text: spec.thumbnail.text ?? (typeof resolved.shot.title === "string"
        ? resolved.shot.title
        : (resolved.shot.title?.text ?? null)),
    },
    null,
    2,
  ),
);
