#!/usr/bin/env node
/**
 * Synthesises the default sound effects with ffmpeg.
 *
 * Committing generated sounds rather than downloading them keeps a render
 * reproducible and keeps the repository free of licence questions. Replace any
 * of these with a real recording whenever you find one you prefer — the file
 * names are all the engine cares about.
 *
 *   node scripts/make-sfx.mjs
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { ROOT, fmt, requireFfmpeg, run } from "./lib.mjs";

await requireFfmpeg();

const dir = path.join(ROOT, "public", "assets", "sfx");
await mkdir(dir, { recursive: true });

const sounds = {
  /** A tight transient for a hard cut. */
  snap: [
    "-f", "lavfi", "-i", "anoisesrc=d=0.14:c=pink:a=0.7:r=48000",
    "-af", "highpass=f=1400,lowpass=f=9000,afade=t=out:st=0.005:d=0.12:curve=exp,volume=2.2",
  ],
  /** Air moving, for a transition that travels. */
  whoosh: [
    "-f", "lavfi", "-i", "anoisesrc=d=0.40:c=white:a=0.5:r=48000",
    "-af",
    "highpass=f=300,lowpass=f=5000,afade=t=in:st=0:d=0.18:curve=qsin," +
      "afade=t=out:st=0.18:d=0.22:curve=qsin,volume=1.8",
  ],
  /** A small marker, for a step landing or a counter settling. */
  tick: [
    "-f", "lavfi", "-i", "sine=frequency=2200:duration=0.05:sample_rate=48000",
    "-af", "afade=t=out:st=0.004:d=0.045:curve=exp,volume=0.6",
  ],
};

fmt.head("Generating default sound effects");

for (const [name, args] of Object.entries(sounds)) {
  const out = path.join(dir, `${name}.wav`);
  await run("ffmpeg", ["-y", ...args, "-ac", "2", "-c:a", "pcm_s16le", out]);
  fmt.ok(`assets/sfx/${name}.wav`);
}

console.log(
  '\n  Use one from a shotlist: enter: punch({ to: 1.08, frames: 5, hit: "snap" })',
);
