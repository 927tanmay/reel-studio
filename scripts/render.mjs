#!/usr/bin/env node
/**
 * Stage 08 — Render.
 *
 * Renders the composition, brings the mix to the target loudness, then verifies
 * the file rather than trusting it.
 *
 *   npm run render 001-first-cut
 *   npm run render 001-first-cut -- --still 3.2     (one frame, for a cover)
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { ROOT, fmt, postDir, probe, readJson, requireFfmpeg, requirePost, run, writeJson } from "./lib.mjs";

const id = requirePost(process.argv[2]);
const args = process.argv.slice(3);
const stillAt = args.includes("--still") ? Number(args[args.indexOf("--still") + 1]) : null;

// Consumed here, not forwarded to `remotion render` — a label for this take,
// for when `npm run takes` lists ten of them and "3" alone doesn't say which
// one mattered.
const noteIndex = args.indexOf("--note");
const note = noteIndex > -1 ? (args[noteIndex + 1] ?? null) : null;
const forwardArgs = args.filter((_, i) => i !== noteIndex && i !== noteIndex + 1);

await requireFfmpeg();

const config = (await readJson(path.join(postDir(id), "post.json"), null)) ?? {};
// null disables normalisation — right for a reel with no dialogue, where an
// integrated target would just amplify the silence around one sound effect.
const targetLufs = config.targetLufs === null ? null : (config.targetLufs ?? -14);

const outDir = path.join(ROOT, "out", id);
await mkdir(outDir, { recursive: true });

const shell = (cmd, cmdArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

if (stillAt !== null) {
  const out = path.join(outDir, "cover.jpg");
  fmt.head(`Still at ${stillAt}s`);
  await shell("npx", ["remotion", "still", id, out, "--frame", String(Math.round(stillAt * 30))]);
  fmt.ok(out);
  process.exit(0);
}

const raw = path.join(outDir, "reel.raw.mp4");
const final = path.join(outDir, "reel.mp4");

fmt.head(`Rendering ${id}`);
await shell("npx", ["remotion", "render", id, raw, ...forwardArgs]);

const info = await probe(raw);

if (info.hasAudio && targetLufs !== null) {
  fmt.head(`Normalising loudness to ${targetLufs} LUFS`);

  // Two passes: measure, then apply. One pass guesses and lands close but not on.
  const { stderr } = await run("ffmpeg", [
    "-i", raw,
    "-af", `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`,
    "-f", "null", "-",
  ]);

  const match = stderr.match(/\{[\s\S]*\}/);
  const m = match ? JSON.parse(match[0]) : null;

  const filter = m
    ? `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:` +
      `measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`;

  await run("ffmpeg", [
    "-y", "-i", raw,
    "-af", filter,
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
    final,
  ]);
  await rm(raw, { force: true });
  fmt.ok(m ? `measured ${Number(m.input_i).toFixed(1)} LUFS in, ${targetLufs} out` : "normalised");
} else {
  await rename(raw, final);
  fmt.warn(
    info.hasAudio
      ? "Loudness normalisation disabled for this post (targetLufs is null)."
      : "No audio track. Nothing to normalise.",
  );
}

fmt.head("Verifying");
let gatesPassed = true;
try {
  await shell("node", [path.join(ROOT, "scripts", "verify.mjs"), id]);
} catch {
  gatesPassed = false;
}

if (existsSync(final)) {
  console.log(`\n  ${path.relative(ROOT, final)}`);
  console.log("  Watch it on a phone before you post. No gate replaces that.");

  // A render overwrites reel.mp4 the same way it always has — nothing about
  // that changes — but every one of them is also kept here, so an edit that
  // turns out to be a mistake is a `--restore` away, not gone the moment the
  // next render finishes. Nothing under takes/ is ever deleted by this
  // script; pruning is `npm run takes <post> -- --forget <n>`, asked for.
  const takesDir = path.join(outDir, "takes");
  await mkdir(takesDir, { recursive: true });
  const existing = (await readdir(takesDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => Number(e.name));
  const number = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  const takeDir = path.join(takesDir, String(number));
  await mkdir(takeDir, { recursive: true });

  await copyFile(final, path.join(takeDir, "reel.mp4"));
  const shotlistSrc = path.join(postDir(id), "shotlist.ts");
  if (existsSync(shotlistSrc)) await copyFile(shotlistSrc, path.join(takeDir, "shotlist.ts"));

  const finalInfo = await probe(final);
  const bytes = (await stat(final)).size;
  await writeJson(path.join(takeDir, "meta.json"), {
    number,
    createdAt: new Date().toISOString(),
    seconds: finalInfo.seconds,
    bytes,
    gatesPassed,
    note,
  });

  fmt.ok(`Saved as take ${number} (${path.relative(ROOT, takeDir)}) — npm run takes ${id}`);
}

if (!gatesPassed) {
  console.error("\nThe file was written but did not pass every gate. Fix the failures above.");
  process.exit(1);
}
