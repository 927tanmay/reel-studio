#!/usr/bin/env node
/**
 * Stage 01 — Ingest.
 *
 * Reads what every file in raw/ actually is, conforms anything wastefully
 * oversized, and writes media.json. Durations here are the ones the timeline is
 * built from; nothing downstream assumes a length from a script.
 *
 *   npm run ingest 001-first-cut
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import {
  AUDIO_EXT, IMAGE_EXT, VIDEO_EXT, fmt, keyFor, listFiles, postDir,
  probe, readJson, relToPublic, requireFfmpeg, requirePost, run, writeJson,
} from "./lib.mjs";

const id = requirePost(process.argv[2]);
await requireFfmpeg();

const dir = postDir(id);
const config = (await readJson(path.join(dir, "post.json"), null)) ?? {
  frame: { w: 1080, h: 1920, fps: 30 },
};
const frame = config.frame;

/**
 * Footage that will be cropped or panned needs headroom, so it is kept larger
 * than the delivery frame on purpose. Only genuinely oversized sources — a
 * Retina screen capture at twice its logical size, say — are brought down.
 */
const MAX_WIDTH = frame.w * 2;

const rawDir = path.join(dir, "raw");
const outDir = path.join(dir, "conformed");
await mkdir(outDir, { recursive: true });

const manifest = (await readJson(path.join(dir, "media.json"), {})) ?? {};
const videos = await listFiles(rawDir, VIDEO_EXT);
const audios = await listFiles(rawDir, AUDIO_EXT);
const images = await listFiles(rawDir, IMAGE_EXT);

if (videos.length + audios.length + images.length === 0) {
  fmt.warn(`Nothing in public/posts/${id}/raw. Drop footage there and run this again.`);
}

fmt.head(`Ingesting ${id} at ${frame.w}x${frame.h}@${frame.fps}`);

for (const file of videos) {
  const key = keyFor(file);
  const info = await probe(file);
  let use = file;

  if (info.width > MAX_WIDTH) {
    const target = path.join(outDir, `${key}.mp4`);
    if (!existsSync(target)) {
      fmt.ok(`${key}: ${info.width}px is oversized, conforming to ${MAX_WIDTH}px`);
      await run("ffmpeg", [
        "-y", "-i", file,
        "-vf", `scale=${MAX_WIDTH}:-2:flags=lanczos`,
        "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        target,
      ]);
    }
    use = target;
  } else if (info.rotation !== 0) {
    // Bake the rotation so no downstream tool has to honour a flag.
    const target = path.join(outDir, `${key}.mp4`);
    if (!existsSync(target)) {
      fmt.ok(`${key}: baking ${info.rotation}° rotation`);
      await run("ffmpeg", [
        "-y", "-i", file,
        "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        target,
      ]);
    }
    use = target;
  }

  const final = await probe(use);
  manifest[key] = {
    key,
    file: relToPublic(use),
    seconds: Number(final.seconds.toFixed(3)),
    width: final.width,
    height: final.height,
    fps: final.fps,
    hasAudio: final.hasAudio,
    ...(manifest[key]?.cleanAudio ? { cleanAudio: manifest[key].cleanAudio } : {}),
    ...(manifest[key]?.audioOffset !== undefined ? { audioOffset: manifest[key].audioOffset } : {}),
  };

  const orientation = final.height > final.width ? "vertical" : "horizontal";
  fmt.ok(`${key}  ${final.width}x${final.height} ${orientation}  ${final.seconds.toFixed(2)}s  ${final.hasAudio ? "audio" : "silent"}`);
}

for (const file of images) {
  const key = keyFor(file);
  manifest[key] = { key, file: relToPublic(file), seconds: 0, width: 0, height: 0, fps: 0, hasAudio: false };
  fmt.ok(`${key}  image`);
}

await writeJson(path.join(dir, "media.json"), manifest);

fmt.head("Written: media.json");
console.log(
  `  Keys available to the shotlist: ${Object.keys(manifest).join(", ") || "(none)"}\n` +
    `  Next: npm run transcribe ${id}`,
);
