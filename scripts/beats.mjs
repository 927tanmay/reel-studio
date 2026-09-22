#!/usr/bin/env node
/**
 * A track's beat grid, and where in it a reel should actually start.
 *
 * The point of this is what happens *after* the analysis, not the analysis
 * itself: `bed.startShot` + `bed.trackIn` let a shotlist begin the music on
 * a real beat, at a real moment in the track — not file offset 0, which for
 * a stock track is usually a quiet intro nobody wants under the hook. This
 * prints the grid, and a shortlist of moments the track's own energy rises,
 * each snapped to the nearest beat, as candidates for `trackIn`.
 *
 * Detection is a plain energy-flux autocorrelation — no model, no dependency
 * beyond ffmpeg. It gets an exact answer on a synthetic click track and a
 * confident one on rhythmic music; on anything without a hard beat (strings,
 * ambience) the confidence number drops and should be believed accordingly —
 * this reports a number either way, but a low confidence means "there may
 * not be a beat here to sync to," not "trust this less precisely."
 *
 *   npm run beats pulse.wav
 *   npm run beats mixkit-tech-house-vibes-130.mp3
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { ROOT, fmt, requireFfmpeg, writeJson } from "./lib.mjs";

const name = process.argv[2];
if (!name) {
  console.error("Usage: npm run beats <file in public/assets/music>");
  process.exit(1);
}

await requireFfmpeg();

const dir = path.join(ROOT, "public", "assets", "music");
const file = path.join(dir, name);
if (!existsSync(file)) {
  console.error(`No ${name} in public/assets/music/. Files there: ${(await import("node:fs/promises").then((m) => m.readdir(dir))).join(", ")}`);
  process.exit(1);
}

const SR = 22050;

const decode = (file) =>
  new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"]);
    const chunks = [];
    ff.stdout.on("data", (d) => chunks.push(d));
    let err = "";
    ff.stderr.on("data", (d) => (err += d));
    ff.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(err))));
  });

fmt.head(`Analysing ${name}`);
const buf = await decode(file);
const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
const seconds = samples.length / SR;

// RMS envelope at a fine hop, for tempo; a coarse one, for section energy.
const WIN = 1024;
const HOP = 256;
const nFrames = Math.floor((samples.length - WIN) / HOP);
const env = new Float32Array(nFrames);
for (let i = 0; i < nFrames; i++) {
  let s = 0;
  const off = i * HOP;
  for (let j = 0; j < WIN; j++) {
    const v = samples[off + j];
    s += v * v;
  }
  env[i] = Math.sqrt(s / WIN);
}
const frameRate = SR / HOP;

// Onset strength: half-wave rectified energy flux. Cheap, and enough to find
// a percussive grid — a real spectral-flux onset detector would separate
// pitch changes from hits, but nothing here needs that distinction.
const flux = new Float32Array(nFrames);
for (let i = 1; i < nFrames; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);

// Tempo: autocorrelation of the flux over the 60-200bpm range.
const minLag = Math.round(frameRate * 60 / 200);
const maxLag = Math.round(frameRate * 60 / 60);
const scores = [];
let bestLag = minLag;
let bestScore = -Infinity;
for (let lag = minLag; lag <= maxLag; lag++) {
  let s = 0;
  let n = 0;
  for (let i = lag; i < nFrames; i++) {
    s += flux[i] * flux[i - lag];
    n++;
  }
  const score = n > 0 ? s / n : 0;
  scores.push(score);
  if (score > bestScore) {
    bestScore = score;
    bestLag = lag;
  }
}

// Octave correction. A regular pulse train autocorrelates strongly at every
// integer multiple of its true period, and which multiple has the single
// largest score is sensitive to noise — verified against a synthetic
// 0.5s/120bpm click track, where the raw argmax picked its own 1.0s/60bpm
// octave by roughly 4%. Fix: take the smallest lag whose score still clears
// most of the peak, since a real faster beat also shows up (weaker) at its
// own multiples, but a spurious slow "beat" does not show up at a faster
// sub-period unless one genuinely exists.
const OCTAVE_TOLERANCE = 0.85;
for (let lag = minLag; lag < bestLag; lag++) {
  if (scores[lag - minLag] >= OCTAVE_TOLERANCE * bestScore) {
    bestLag = lag;
    break;
  }
}
bestScore = scores[bestLag - minLag];

const bpm = (60 * frameRate) / bestLag;
const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
const confidence = meanScore > 0 ? bestScore / meanScore : 0;

// Phase: a comb filter over one period finds which offset the beats actually
// fall on, not just how far apart they are.
const periodFrames = bestLag;
let bestPhase = 0;
let bestPhaseScore = -Infinity;
for (let p = 0; p < periodFrames; p++) {
  let s = 0;
  let n = 0;
  for (let i = p; i < nFrames; i += periodFrames) {
    s += flux[i];
    n++;
  }
  const sc = n > 0 ? s / n : 0;
  if (sc > bestPhaseScore) {
    bestPhaseScore = sc;
    bestPhase = p;
  }
}
const periodSec = 60 / bpm;
const firstBeatSec = ((bestPhase / frameRate) % periodSec + periodSec) % periodSec;

fmt.ok(`${bpm.toFixed(1)} BPM, first beat at ${firstBeatSec.toFixed(3)}s`);
const confidenceWord = confidence > 3 ? "clear" : confidence > 2 ? "workable" : "weak — likely no hard beat to sync to";
fmt.ok(`confidence ${confidence.toFixed(2)} (${confidenceWord})`);

// Section energy: a coarse envelope, to find where the track actually lifts
// rather than just how fast it ticks.
const COARSE = Math.max(1, Math.round(frameRate * 1.5));
const nCoarse = Math.floor(nFrames / COARSE);
const coarseEnv = new Float32Array(nCoarse);
for (let i = 0; i < nCoarse; i++) {
  let s = 0;
  for (let j = 0; j < COARSE; j++) s += env[i * COARSE + j];
  coarseEnv[i] = s / COARSE;
}
// A stock "background" track, checked on the real files this was built
// against, rarely has one dramatic drop — it has a quiet intro, then a level
// body it spends most of its length at. A fixed ratio above the *median*
// missed that real transition entirely on a track whose body only ever
// reached 1.26x its median, under the 1.35x this first used. What actually
// works: the body's own level, found robustly (a percentile, so a short
// intro or outro can't pull it down), and the first point that reaches and
// *holds* close to it — a short lookahead against one noisy window
// reading as a rise on its own.
const sortedCoarse = [...coarseEnv].sort((a, b) => a - b);
const bodyLevel = sortedCoarse[Math.floor(sortedCoarse.length * 0.7)] || 0;
const threshold = bodyLevel * 0.85;
const HOLD = Math.min(4, nCoarse);

// Snapping to the *global* grid — firstBeatSec plus a whole number of
// periods — looks right near the start of the track, where that grid was
// measured, but a tempo estimate only has to be off by a fraction of a
// percent for the error to compound over the dozens of bars between there
// and a candidate late in the track. Checked directly on the tech-house
// track: the global grid put a candidate at 28.467s; the nearest real onset
// was at 28.613s — 146ms away, close to a third of a beat, from accumulated
// drift rather than a wrong tempo.
//
// The fix is a *local* re-anchor, and it has to run at real onset
// resolution — the first attempt reused the flux already computed for tempo
// detection (a ~46ms window, fine for finding beats hundreds of ms apart)
// and made things worse, not better (284ms away, checked the same way).
// That buffer is too blurred in time to point at one transient; this reruns
// the onset math at roughly 12ms resolution (a 256-sample window, 64-sample
// hop) on a short slice of the same decoded samples, matching the
// resolution the check above used to catch the problem in the first place.
// Two fine-resolution attempts at this both failed, and the second failure
// is the more useful one to have on record. Picking "the single loudest
// transient near this timestamp" sounds like the right local re-anchor, but
// in real percussive music several nearby beats are often comparably loud —
// checked directly: widening the search window from 1.4s to 3s changed the
// winner from one real beat to a different real beat 1.5s away, entirely
// because of which few beats the window happened to include, not because
// either answer was wrong. A method that disagrees with itself depending on
// where you draw the window is not a local re-anchor, it is noise wearing
// the shape of one.
//
// What's actually robust: the same comb filter already used for the whole
// track's phase (validated against a known 120bpm/phase-0 test track),
// run again but only over the handful of real beats nearest this candidate
// instead of extrapolated from the track's start. Averaging several real
// hits is far less sensitive to any one of them being unusually loud or
// quiet than picking a single "winning" sample ever was, and it never needs
// to know the track's tempo any more precisely than the global estimate
// already gives it, because it is only trusted a few periods either side of
// where it is centred.
const LOCAL_PERIODS = 3;
const localBeat = (aroundSec) => {
  const centreFrame = Math.round(aroundSec * frameRate);
  const base = centreFrame - (((centreFrame % periodFrames) + periodFrames) % periodFrames);

  let bestPhase = 0;
  let bestScore = -1;
  for (let p = 0; p < periodFrames; p++) {
    let s = 0;
    let n = 0;
    for (let k = -LOCAL_PERIODS; k <= LOCAL_PERIODS; k++) {
      const f = base + p + k * periodFrames;
      if (f >= 0 && f < nFrames) {
        s += flux[f];
        n++;
      }
    }
    const score = n > 0 ? s / n : 0;
    if (score > bestScore) {
      bestScore = score;
      bestPhase = p;
    }
  }

  const phaseSec = bestPhase / frameRate;
  const k = Math.round((aroundSec - phaseSec) / periodSec);
  return phaseSec + k * periodSec;
};

const candidates = [];
for (let i = 1; i < nCoarse - HOLD; i++) {
  if (coarseEnv[i - 1] >= threshold) continue; // only the moment it first rises
  let holds = true;
  for (let j = 0; j < HOLD; j++) if (coarseEnv[i + j] < threshold) holds = false;
  if (holds) {
    const t = (i * COARSE) / frameRate;
    candidates.push({ atSeconds: Number(localBeat(t).toFixed(3)), rawSeconds: Number(t.toFixed(2)) });
  }
}

fmt.head("Candidate start points (energy rise, snapped to the nearest beat)");
if (candidates.length === 0) {
  console.log("  None found — the track's energy never settles into a body clearly above its");
  console.log("  own intro/outro level. It may be fairly even throughout. 0s, or a moment");
  console.log("  picked by ear, is as good a choice as any here.");
} else {
  for (const c of candidates.slice(0, 8)) {
    console.log(`  ${c.atSeconds.toFixed(3)}s  (rise detected near ${c.rawSeconds}s)`);
  }
}

const out = {
  file: name,
  seconds: Number(seconds.toFixed(2)),
  bpm: Number(bpm.toFixed(2)),
  confidence: Number(confidence.toFixed(2)),
  firstBeatSeconds: Number(firstBeatSec.toFixed(3)),
  periodSeconds: Number(periodSec.toFixed(4)),
  candidateStarts: candidates.map((c) => c.atSeconds),
};
await writeJson(`${file}.beats.json`, out);

fmt.head("Using it in a shotlist");
console.log(
  `  bed: { track: "${name}", trackIn: ${out.candidateStarts[0] ?? 0}, startShot: 0 }\n\n` +
    "  trackIn is seconds into the file to start reading; startShot is which shot\n" +
    "  the music enters on. Together they put a real beat under the first frame\n" +
    "  music plays, instead of file offset 0. Re-run this after swapping tracks —\n" +
    `  ${name}.beats.json is written next to the file and is not committed.`,
);
