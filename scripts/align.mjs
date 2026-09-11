#!/usr/bin/env node
/**
 * Stage 04 — Align.
 *
 * Audio that makes a round trip through an external repair tool comes back
 * slightly out of step, usually by a frame or two. Rather than nudging it by
 * hand on every clip, this measures the offset by correlating the returning
 * track against the original and writes it into media.json.
 *
 * Drop repaired files into clean/ named after their media key, then:
 *   npm run align 001-first-cut
 */
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import {
  AUDIO_EXT, ROOT, fmt, keyFor, listFiles, postDir, readJson,
  requireFfmpeg, requirePost, run, writeJson,
} from "./lib.mjs";

const id = requirePost(process.argv[2]);
await requireFfmpeg();

const SAMPLE_RATE = 8000;
/** One envelope bin per millisecond — finer than a frame at any sane frame rate. */
const BIN = SAMPLE_RATE / 1000;
/** How far out of step the two tracks could plausibly be. */
const MAX_LAG_MS = 2000;
/** Correlating the first minute is plenty and keeps this instant. */
const WINDOW_MS = 60_000;

const toEnvelope = async (file, work, name) => {
  const raw = path.join(work, `${name}.pcm`);
  await run("ffmpeg", [
    "-y", "-i", file,
    "-ac", "1", "-ar", String(SAMPLE_RATE),
    "-f", "s16le", "-acodec", "pcm_s16le",
    raw,
  ]);

  const buf = await readFile(raw);
  const samples = buf.length / 2;
  const bins = Math.min(WINDOW_MS, Math.floor(samples / BIN));
  const env = new Float64Array(bins);

  for (let b = 0; b < bins; b++) {
    let sum = 0;
    for (let s = 0; s < BIN; s++) sum += Math.abs(buf.readInt16LE((b * BIN + s) * 2));
    env[b] = sum / BIN;
  }

  // Remove the mean so correlation measures shape, not loudness.
  let mean = 0;
  for (const v of env) mean += v;
  mean /= bins || 1;
  for (let i = 0; i < bins; i++) env[i] -= mean;

  return env;
};

/** Milliseconds by which `b` lags `a`. Positive means b is late. */
const bestLag = (a, b) => {
  let best = 0;
  let bestScore = -Infinity;

  for (let lag = -MAX_LAG_MS; lag <= MAX_LAG_MS; lag++) {
    let score = 0;
    const start = Math.max(0, -lag);
    const end = Math.min(a.length, b.length - lag);
    if (end - start < 1000) continue;

    for (let i = start; i < end; i += 2) score += a[i] * b[i + lag];
    score /= (end - start) / 2;

    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  return { lagMs: best, score: bestScore };
};

const dir = postDir(id);
const media = await readJson(path.join(dir, "media.json"), null);
if (!media) {
  console.error(`No media.json. Run: npm run ingest ${id}`);
  process.exit(1);
}

const cleanFiles = await listFiles(path.join(dir, "clean"), AUDIO_EXT);
if (cleanFiles.length === 0) {
  fmt.warn(`Nothing in public/posts/${id}/clean. Skipping — the engine will use camera audio.`);
  process.exit(0);
}

const work = path.join(dir, ".align");
await mkdir(work, { recursive: true });

fmt.head(`Aligning ${cleanFiles.length} repaired track(s) in ${id}`);

for (const file of cleanFiles) {
  const key = keyFor(file);
  const entry = media[key];
  if (!entry) {
    fmt.fail(`${key}: no media with this key. Name clean files after their source.`);
    continue;
  }

  const original = path.join(ROOT, "public", entry.file);
  const [a, b] = await Promise.all([
    toEnvelope(original, work, `${key}-orig`),
    toEnvelope(file, work, `${key}-clean`),
  ]);

  const { lagMs } = bestLag(a, b);
  const frames = lagMs / (1000 / (entry.fps || 30));

  entry.cleanAudio = path.relative(path.join(ROOT, "public"), file);
  entry.audioOffset = Number((lagMs / 1000).toFixed(4));

  fmt.ok(
    `${key}: repaired audio is ${lagMs >= 0 ? "late" : "early"} by ` +
      `${Math.abs(lagMs)}ms (${Math.abs(frames).toFixed(2)} frames) — corrected`,
  );
}

await rm(work, { recursive: true, force: true });
await writeJson(path.join(dir, "media.json"), media);

fmt.head("Written: media.json");
console.log("  Re-run transcribe so word timings come from the audio you will actually hear.");
