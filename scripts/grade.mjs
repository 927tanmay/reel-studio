#!/usr/bin/env node
/**
 * Stage 01b (optional) — How far apart your clips look.
 *
 * Footage shot on a phone and a recording taken off a screen are lit by
 * different things and encoded by different software. Cut together untouched
 * they read as two different videos, and it is one of those faults nobody
 * names correctly — the edit just feels thrown together.
 *
 * This measures the mean channel levels of every clip, writes them into
 * media.json for `matchGrade()` to use, and prints how far apart they are
 * against whichever clip you are treating as the reference. It changes no
 * pictures; the correction is a decision, and it belongs in the shotlist.
 *
 *   npm run grade 001-my-reel
 *   npm run grade 001-my-reel -- --reference hook
 */
import path from "node:path";
import { ROOT, fmt, postDir, readJson, requireFfmpeg, requirePost, writeJson } from "./lib.mjs";
import { spawn } from "node:child_process";

const id = requirePost(process.argv[2]);
await requireFfmpeg();

const refFlag = process.argv.indexOf("--reference");
const chosenReference = refFlag > -1 ? process.argv[refFlag + 1] : null;

const dir = postDir(id);
const media = await readJson(path.join(dir, "media.json"), null);
if (!media) {
  console.error(`No media.json. Run: npm run ingest ${id}`);
  process.exit(1);
}

/**
 * Mean red, green and blue across the clip.
 *
 * Two frames a second, each scaled down to a single pixel by ffmpeg, which is
 * an exact average of that frame rather than a sample of it. Averaging those
 * gives the clip's overall level without decoding every frame at full size.
 */
const measure = (file) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-v", "error", "-i", file, "-vf", "fps=2,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const chunks = [];
    let err = "";
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(err || `ffmpeg exited ${code}`));
      const buf = Buffer.concat(chunks);
      const n = Math.floor(buf.length / 3);
      if (n === 0) return reject(new Error("no frames read"));

      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < n; i++) {
        r += buf[i * 3];
        g += buf[i * 3 + 1];
        b += buf[i * 3 + 2];
      }
      resolve({ r: r / n, g: g / n, b: b / n, frames: n });
    });
  });

const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const round = (c) => ({
  r: Number(c.r.toFixed(1)),
  g: Number(c.g.toFixed(1)),
  b: Number(c.b.toFixed(1)),
});

fmt.head(`Measuring ${id}`);

const entries = Object.values(media);
for (const entry of entries) {
  const colour = await measure(path.join(ROOT, "public", entry.file));
  entry.colour = round(colour);
  fmt.ok(
    `${entry.key.padEnd(24)} R ${entry.colour.r.toFixed(0).padStart(3)}  ` +
      `G ${entry.colour.g.toFixed(0).padStart(3)}  B ${entry.colour.b.toFixed(0).padStart(3)}   ` +
      `luma ${luma(entry.colour).toFixed(0).padStart(3)}  (${colour.frames} samples)`,
  );
}

await writeJson(path.join(dir, "media.json"), media);

// The reference is whichever clip everything else should look like. Left
// unstated, the longest one with audio — which for a talking-head reel is
// the take the viewer spends most of their time looking at, and therefore
// the one whose skin tone is the thing every cut is judged against.
const reference =
  (chosenReference && media[chosenReference]) ??
  [...entries].sort((a, b) => Number(b.hasAudio) - Number(a.hasAudio) || b.seconds - a.seconds)[0];

if (chosenReference && !media[chosenReference]) {
  fmt.warn(`No clip called "${chosenReference}". Falling back to "${reference.key}".`);
}

const spread = (x, y) => Math.abs(x - y) / Math.max(1, (x + y) / 2);
const distance = (a, b) => ((spread(a.r, b.r) + spread(a.g, b.g) + spread(a.b, b.b)) / 3) * 100;

fmt.head(`Against "${reference.key}"`);

for (const entry of entries) {
  if (entry.key === reference.key) continue;
  const off = distance(entry.colour, reference.colour);
  const line = `  ${entry.key.padEnd(24)} ${off.toFixed(0).padStart(3)}% apart`;
  if (off < 15) console.log(`${line}   — reads as the same reel already`);
  else if (off < 40) console.log(`${line}   — worth matching`);
  else console.log(`${line}   — far apart; look at both before correcting`);
}

fmt.head("Putting it in the shotlist");
console.log(
  "  Derive the correction rather than pasting numbers, so it moves when the\n" +
    "  footage does:\n\n" +
    '    import { matchGrade } from "../../../engine/colour";\n\n' +
    `    { src: "screen-demo", grade: matchGrade(media, "screen-demo", "${reference.key}") }\n\n` +
    "  The third argument is strength, and it defaults to 0.5 rather than 1 on\n" +
    "  purpose. A large percentage above usually means the two clips are pictures\n" +
    "  of different things — a dark editor against a lit face — not that one of\n" +
    "  them is graded wrong. Correcting that all the way grades the content away:\n" +
    "  the editor comes out grey. Raise it only where the subject really matches.",
);
