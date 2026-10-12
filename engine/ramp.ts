/**
 * Speed ramps: a picture whose rate changes *within* one shot — racing
 * through a build log, then easing down to land on the line that matters.
 *
 * `speed` on a shot is one number for the whole shot. A ramp is keyframes:
 * `{ at, speed }`, with `at` in seconds on screen. Between two keyframes the
 * speed eases (smoothstep) from one value to the next; before the first it
 * holds the first, after the last it holds the last. Easing, not a straight
 * line, because a rate that changes at a constant slope shows a visible
 * corner at each keyframe — the eye reads the change in acceleration.
 *
 * Everything here is pure arithmetic on those keyframes, so the timeline and
 * the renderer cannot disagree about where in the source any frame lands.
 */

export type RampPoint = { at: number; speed: number };

const sorted = (ramp: RampPoint[]): RampPoint[] => [...ramp].sort((a, b) => a.at - b.at);

/** ∫₀ᵘ smoothstep(v) dv, for u in 0..1 — the closed form that makes the maths exact. */
const smoothArea = (u: number): number => u ** 3 - u ** 4 / 2;

/**
 * Seconds of *source* consumed after `t` seconds on screen — the integral of
 * the speed curve from 0 to `t`.
 */
export const rampSource = (ramp: RampPoint[], t: number): number => {
  const pts = sorted(ramp);
  if (pts.length === 0 || t <= 0) return Math.max(0, t);

  // Before the first keyframe the speed holds the first value.
  let total = 0;
  const first = pts[0];
  if (t <= first.at) return first.speed * t;
  total += first.speed * first.at;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const length = b.at - a.at;
    if (length <= 0) continue;
    if (t >= b.at) {
      total += length * (a.speed + (b.speed - a.speed) * 0.5);
      continue;
    }
    const u = (t - a.at) / length;
    return total + length * (a.speed * u + (b.speed - a.speed) * smoothArea(u));
  }

  // After the last keyframe the speed holds the last value.
  const last = pts[pts.length - 1];
  return total + last.speed * (t - last.at);
};

/**
 * Seconds on screen it takes a ramp to consume `sourceSeconds` of source —
 * the inverse of `rampSource`, found by bisection since the curve has no
 * closed-form inverse. This is how a ramped shot with no `seconds` gets its
 * length measured from the file instead of assumed.
 */
export const rampDuration = (ramp: RampPoint[], sourceSeconds: number): number => {
  const slowest = Math.min(...ramp.map((p) => p.speed));
  let lo = 0;
  let hi = sourceSeconds / slowest;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (rampSource(ramp, mid) < sourceSeconds) lo = mid;
    else hi = mid;
  }
  return hi;
};

/** One stretch of a ramped shot that plays at a single rate. */
export type RampPiece = {
  /** Shot-local frame this piece starts on, and how many frames it runs. */
  startFrame: number;
  frames: number;
  /** Seconds into the source it starts reading from. */
  sourceStart: number;
  /** The rate to hand the video element for this piece. */
  rate: number;
};

/**
 * Breaks a ramped shot into pieces a video element can play, each at one
 * constant rate. A video element only takes a single playback rate, so a
 * continuous ramp is approximated by short pieces — `stepFrames` long while
 * the speed is changing, one long piece wherever it is flat. At two frames a
 * piece the steps are far below what the eye resolves.
 */
export const rampPieces = (
  ramp: RampPoint[],
  fps: number,
  durationInFrames: number,
  inSeconds: number,
  stepFrames = 2,
): RampPiece[] => {
  const pieces: RampPiece[] = [];
  for (let f = 0; f < durationInFrames; f += stepFrames) {
    const end = Math.min(durationInFrames, f + stepFrames);
    const from = rampSource(ramp, f / fps);
    const to = rampSource(ramp, end / fps);
    const rate = (to - from) / ((end - f) / fps);
    const last = pieces[pieces.length - 1];
    // Flat stretches merge: same rate and already contiguous in the source.
    if (last && Math.abs(last.rate - rate) < 1e-6) {
      last.frames += end - f;
      continue;
    }
    pieces.push({ startFrame: f, frames: end - f, sourceStart: inSeconds + from, rate });
  }
  return pieces;
};
