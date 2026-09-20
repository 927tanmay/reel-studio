#!/usr/bin/env node
/**
 * Synthesises a default music bed with ffmpeg: a soft sub pulse over a slow,
 * breathing fifth.
 *
 * Like the sound effects, it is generated rather than downloaded so a render
 * stays reproducible and nothing here carries a licence. It is a stand-in as
 * much as a default — drop any track into public/assets/music and point a
 * reel's `bed.track` at it; the file name is all the engine cares about.
 *
 * Every period divides the length exactly (a beat every 0.5s, the pad and its
 * swell a whole number of cycles in 16s), so the file loops without a click.
 *
 *   node scripts/make-music.mjs
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { ROOT, fmt, requireFfmpeg, run } from "./lib.mjs";

await requireFfmpeg();

const dir = path.join(ROOT, "public", "assets", "music");
await mkdir(dir, { recursive: true });

const beat = "mod(t,0.5)";
// A pitched thump that falls as it decays, once per beat.
const pulse = `0.55*sin(2*PI*(48*${beat}+2.4*(1-exp(-25*${beat}))))*exp(-7*${beat})`;
// A root and a fifth above it, swelling slowly, so the bed is never just a beat.
const pad =
  "(0.75+0.25*sin(2*PI*t/8))*(0.11*sin(2*PI*55*t)+0.07*sin(2*PI*82.5*t)+0.03*sin(2*PI*165*t))";

fmt.head("Generating default music bed");

const out = path.join(dir, "pulse.wav");
await run("ffmpeg", [
  "-y",
  "-f", "lavfi", "-i", `aevalsrc=exprs='${pulse}+${pad}':d=16:s=48000`,
  "-af", "lowpass=f=700,volume=1.6",
  "-ac", "2", "-c:a", "pcm_s16le", out,
]);
fmt.ok("assets/music/pulse.wav");

console.log('\n  Use it from a shotlist: bed: { track: "pulse.wav" }');
