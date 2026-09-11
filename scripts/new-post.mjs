#!/usr/bin/env node
/**
 * Scaffolds a post and registers it.
 *
 *   npm run new 001-first-cut
 *   npm run new 002-square -- --frame 1080x1350 --max 60
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ROOT, fmt, postDir, writeJson } from "./lib.mjs";

const id = process.argv[2];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error("Usage: npm run new <id>    (lowercase, digits and dashes)\n  e.g. npm run new 001-first-cut");
  process.exit(1);
}

const args = process.argv.slice(3);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : fallback;
};

const [w, h] = flag("frame", "1080x1920").split("x").map(Number);
const fps = Number(flag("fps", "30"));
const maxSeconds = Number(flag("max", "45"));

const dir = postDir(id);
if (existsSync(dir)) {
  console.error(`public/posts/${id} already exists.`);
  process.exit(1);
}

await mkdir(path.join(dir, "raw"), { recursive: true });
await mkdir(path.join(dir, "clean"), { recursive: true });

await writeJson(path.join(dir, "post.json"), {
  frame: { w, h, fps },
  target: { maxSeconds },
  targetLufs: -14,
  maxMegabytes: 250,
});

await writeFile(
  path.join(dir, "brief.md"),
  `# ${id}

Fill this in before cutting. Specific direction produces an edit; vague
direction produces filler. The templates are in DIRECTION.md.

## The reel

A {length} {frame} reel that {one-sentence promise}.
Opens on {hook}, turns at {the shift}, lands on {payoff}.
Feels {two adjectives}. Text is {captions | titles | both | none}.
Bed is {mood}.

## Shots

- {source}, framed {full | on the region that matters}, {holding | pushing | panning},
  entering on {a cut | a punch | a band opening}, carrying {caption | title | badge | nothing}.

## Moments

- On the word {word}, {cut | punch | reveal | dip the bed}.
`,
);

await writeFile(
  path.join(dir, "shotlist.ts"),
  `import { punch, reel } from "../../../engine/spec";
import tokens from "../../../projects/default/tokens";
import config from "./post.json";
// Uncomment once ingest and transcribe have run:
// import media from "./media.json";
// import words from "./words.json";
// import { anchors } from "../../../engine/words";
// const at = anchors(words["<media-key>"] ?? []);

export default reel({
  id: "${id}",
  frame: config.frame,
  target: config.target,
  style: tokens,
  // media,
  // words,

  shots: [
    {
      src: { type: "data", items: [{ label: "replace me", value: 1 }], seconds: 2 },
      title: "First shot",
    },
    {
      src: { type: "terminal", lines: [{ command: "npm run render ${id}" }], seconds: 3 },
      enter: punch({ to: 1.08, frames: 5 }),
    },
  ],
});
`,
);

// Register it so the studio picks it up.
const postsFile = path.join(ROOT, "posts.ts");
const source = await readFile(postsFile, "utf8");
const varName = "post" + id.replace(/[^a-z0-9]/gi, "_");
const withImport = source.replace(
  /(\nimport .*\n)(?![\s\S]*\nimport )/,
  `$1import ${varName} from "./public/posts/${id}/shotlist";\n`,
);
const withEntry = withImport.replace(
  /(export const posts[^{]*\{\n)/,
  `$1  "${id}": ${varName},\n`,
);
await writeFile(postsFile, withEntry);

fmt.head(`Created public/posts/${id}`);
console.log(
  `  ${w}x${h} at ${fps}fps, ceiling ${maxSeconds}s\n\n` +
    `  1. Write brief.md\n` +
    `  2. Drop footage into raw/\n` +
    `  3. npm run ingest ${id}\n` +
    `  4. npm run transcribe ${id}\n` +
    `  5. Edit shotlist.ts, then: npm run render ${id}`,
);
