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
  /**
   * A soft UI tap: a dry transient on a short, low body, like a finger on glass
   * over wood. Quieter and rounder than `tick`, which is a pitched beep.
   */
  tap: [
    "-f", "lavfi",
    "-i", "aevalsrc=exprs='0.9*sin(2*PI*210*t)*exp(-90*t)+0.35*sin(2*PI*1500*t)*exp(-420*t)':d=0.09:s=48000",
    "-af", "afade=t=out:st=0.05:d=0.04,volume=0.95",
  ],
  /**
   * A toggle switch: two clicks a few milliseconds apart, the second a little
   * lower and heavier — the throw, then the stop. For a state flipping from
   * one thing to another.
   */
  switch: [
    "-f", "lavfi",
    "-i",
      "aevalsrc=exprs='0.8*sin(2*PI*2600*t)*exp(-700*t)+0.5*sin(2*PI*320*t)*exp(-110*t)" +
      "+if(gte(t,0.055),0.9*sin(2*PI*1700*(t-0.055))*exp(-600*(t-0.055))+0.7*sin(2*PI*190*(t-0.055))*exp(-85*(t-0.055)),0)':d=0.2:s=48000",
    "-af", "afade=t=out:st=0.14:d=0.06,volume=0.9",
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
