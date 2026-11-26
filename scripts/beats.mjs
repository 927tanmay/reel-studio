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
import { writeFile } from "node:fs/promises";
import { ROOT, fmt, requireFfmpeg, writeJson } from "./lib.mjs";
import { beatsBetween, kickCheck, nearestBeat } from "../engine/beats.ts";

const name = process.argv[2];
const applyShift = process.argv.includes("--shift");
if (!name) {
  console.error("Usage: npm run beats <file in public/assets/music> [--shift]");
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
const detectedFirstBeat = ((bestPhase / frameRate) % periodSec + periodSec) % periodSec;

fmt.ok(`${bpm.toFixed(1)} BPM, first beat at ${detectedFirstBeat.toFixed(3)}s`);
const confidenceWord = confidence > 3 ? "clear" : confidence > 2 ? "workable" : "weak — likely no hard beat to sync to";
fmt.ok(`confidence ${confidence.toFixed(2)} (${confidenceWord})`);

// Is the grid on the kick, or on the off-beat? The tempo above can be right and
// the phase still lock onto the hi-hat between kicks, which puts every onBeat
// hit half a beat wrong. Keep only what sits below about 120 Hz (two passes of a
// second-order low-pass), and find where that bass energy *rises* — the attack
// of each kick, not its peak, which a low note reaches 10-20 ms later — then
// compare those with the grid. After Barty-Bart/motion-graphics' sound pass.
const lowpass = (x, cutoff) => {
  const w0 = (2 * Math.PI * cutoff) / SR;
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b0 = (1 - Math.cos(w0)) / 2 / a0;
  const b1 = (1 - Math.cos(w0)) / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
};
const low = lowpass(lowpass(samples, 120), 120);
const KHOP = 110; // 5 ms
const nK = Math.floor(low.length / KHOP);
const kEnv = new Float32Array(nK);
for (let i = 0; i < nK; i++) {
  let m = 0;
  for (let j = 0; j < KHOP; j++) m = Math.max(m, Math.abs(low[i * KHOP + j]));
  kEnv[i] = m;
}
const kRate = SR / KHOP;
// Smooth over ~15 ms, then the rise of it.
const kSmooth = new Float32Array(nK);
for (let i = 0; i < nK; i++) {
  let s = 0, n = 0;
  for (let j = Math.max(0, i - 1); j <= Math.min(nK - 1, i + 1); j++) { s += kEnv[j]; n++; }
  kSmooth[i] = s / n;
}
const kRise = new Float32Array(nK);
for (let i = 1; i < nK; i++) kRise[i] = Math.max(0, kSmooth[i] - kSmooth[i - 1]);
const sortedRise = [...kRise].sort((a, b) => a - b);
const riseFloor = sortedRise[Math.floor(sortedRise.length * 0.99)] * 0.4;
const minGap = Math.round(periodSec * 0.6 * kRate);
const kicks = [];
for (let i = 1; i < nK - 1; i++) {
  if (kRise[i] < riseFloor || kRise[i] < kRise[i - 1] || kRise[i] < kRise[i + 1]) continue;
  const last = kicks.length ? kicks[kicks.length - 1] : null;
  if (last && i - last.i < minGap) {
    if (kRise[i] > last.v) kicks[kicks.length - 1] = { i, v: kRise[i] };
    continue;
  }
  kicks.push({ i, v: kRise[i] });
}
const kickTimes = kicks.map((k) => k.i / kRate);
const detected = { bpm, firstBeatSeconds: detectedFirstBeat, periodSeconds: periodSec };
const kc = kickCheck(detected, kickTimes);
const ms = (s) => `${s >= 0 ? "+" : ""}${Math.round(s * 1000)} ms`;
let firstBeatSec = detectedFirstBeat;
let finalPeriod = periodSec;
let finalBpm = bpm;
const drift = `${ms(kc.offsetSeconds)} at the first kick, ${ms(kc.driftSeconds)} at the last`;
if (kickTimes.length < 8) {
  fmt.warn(`kick check: only ${kickTimes.length} kicks found below 120 Hz — no steady kick to check the grid against`);
} else if (!kc.steady) {
  fmt.warn(
    `kick check: ${kickTimes.length} bass hits, only ${kc.matched} on one steady grid (spread ${Math.round(kc.spreadSeconds * 1000)} ms) — ` +
      "no steady kick here; check the graph before trusting onBeat",
  );
} else if (!kc.shift) {
  fmt.ok(`kick check: grid sits on the kick (${drift}; ${kc.matched} kicks)`);
} else {
  const what = kc.offBeat ? "the grid is on the OFF-beat" : "the grid is off the kick";
  if (applyShift) {
    firstBeatSec = kc.corrected.firstBeatSeconds;
    finalPeriod = kc.corrected.periodSeconds;
    finalBpm = kc.corrected.bpm;
    fmt.warn(`kick check: ${what} (${drift}) — fitted to the kicks (--shift): ${finalBpm.toFixed(2)} BPM, first beat ${firstBeatSec.toFixed(3)}s`);
  } else {
    fmt.warn(
      `kick check: ${what} (${drift}; ${kc.matched} kicks). Fitted to the kicks it is ${kc.corrected.bpm.toFixed(2)} BPM, ` +
        `first beat ${kc.corrected.firstBeatSeconds.toFixed(3)}s. Not changed: re-run with --shift to use it.\n` +
        "    A post that already imports this grid moves its onBeat hits when it is next rendered.",
    );
  }
}

// The graph: the first four bars of bass energy, the detected beats in red, the
// kicks as dots, and (when they differ) the checked grid in green. Open it.
const svgFile = `${file}.beatgrid.svg`;
{
  const W = 1200, H = 220, pad = 24;
  const from = Math.max(0, (kickTimes[0] ?? detectedFirstBeat) - periodSec / 2);
  const to = Math.min(seconds, from + 16 * periodSec);
  const x = (t) => (pad + ((t - from) / (to - from)) * (W - 2 * pad)).toFixed(1);
  const i0 = Math.floor(from * kRate), i1 = Math.min(nK - 1, Math.ceil(to * kRate));
  let peak = 1e-9;
  for (let i = i0; i <= i1; i++) peak = Math.max(peak, kSmooth[i]);
  const pts = [];
  for (let i = i0; i <= i1; i++) pts.push(`${x(i / kRate)},${(H - pad - (kSmooth[i] / peak) * (H - 2 * pad)).toFixed(1)}`);
  const line = (t, colour, y0, y1, dash) => `<line x1="${x(t)}" x2="${x(t)}" y1="${y0}" y2="${y1}" stroke="${colour}" stroke-width="1.5"${dash ? ' stroke-dasharray="4 3"' : ""}/>`;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-monospace,monospace" font-size="11">`,
    `<rect width="${W}" height="${H}" fill="#0B0D12"/>`,
    ...beatsBetween(detected, from, to).map((t) => line(t, "#F2555A", pad, H - pad)),
    ...(kc.shift ? beatsBetween(kc.corrected, from, to).map((t) => line(t, "#3DBE83", pad, H - pad, true)) : []),
    `<polyline fill="none" stroke="#9AA3B5" stroke-width="1" points="${pts.join(" ")}"/>`,
    ...kickTimes.filter((t) => t >= from && t <= to).map((t) => `<circle cx="${x(t)}" cy="${pad - 8}" r="3.5" fill="#E3A33B"/>`),
    `<text x="${pad}" y="${H - 6}" fill="#9AA3B5">${name}: bass below 120 Hz, first 4 bars. red = detected beats, orange = kicks${kc.shift ? ", green dashed = checked grid" : ""}. ${drift}</text>`,
    "</svg>",
  ];
  await writeFile(svgFile, parts.join("\n"));
  fmt.ok(`graph: public/assets/music/${path.basename(svgFile)}`);
}

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
    candidates.push({ atSeconds: Number((applyShift && kc.shift ? nearestBeat(kc.corrected, t) : localBeat(t)).toFixed(3)), rawSeconds: Number(t.toFixed(2)) });
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
  bpm: Number(finalBpm.toFixed(2)),
  confidence: Number(confidence.toFixed(2)),
  firstBeatSeconds: Number(firstBeatSec.toFixed(3)),
  periodSeconds: Number(finalPeriod.toFixed(applyShift && kc.shift ? 6 : 4)),
  candidateStarts: candidates.map((c) => c.atSeconds),
  kickCheck: {
    kicks: kickTimes.length,
    matched: kc.matched,
    offsetMs: Math.round(kc.offsetSeconds * 1000),
    driftMs: Math.round(kc.driftSeconds * 1000),
    steady: kc.steady,
    spreadMs: Math.round(kc.spreadSeconds * 1000),
    offBeat: kc.offBeat,
    shifted: applyShift && kc.shift,
    detectedFirstBeatSeconds: Number(detectedFirstBeat.toFixed(3)),
  },
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
