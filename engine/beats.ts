/**
 * A track's beat grid — the tempo and phase `npm run beats <track>` already
 * measures, turned into "what's the nearest beat to this moment." A hit or a
 * dip that wants to land on the music rather than wherever its own `at`
 * happens to fall reads this; nothing here re-detects anything.
 */
export type BeatGrid = {
  bpm: number;
  firstBeatSeconds: number;
  periodSeconds: number;
};

/** The nearest beat, in the track file's own seconds, to `aroundSeconds`. */
export const nearestBeat = (grid: BeatGrid, aroundSeconds: number): number => {
  const k = Math.round((aroundSeconds - grid.firstBeatSeconds) / grid.periodSeconds);
  return grid.firstBeatSeconds + k * grid.periodSeconds;
};

/** Every beat of `grid` from `from` to `to` seconds of the track. */
export const beatsBetween = (grid: BeatGrid, from: number, to: number): number[] => {
  const out: number[] = [];
  const first = Math.ceil((from - grid.firstBeatSeconds) / grid.periodSeconds - 1e-9);
  for (let k = first; ; k++) {
    const t = grid.firstBeatSeconds + k * grid.periodSeconds;
    if (t > to + 1e-9) break;
    out.push(t);
  }
  return out;
};

/** `x` wrapped into -period/2..period/2. */
const wrap = (x: number, period: number) => x - period * Math.round(x / period);

/**
 * Whether a detected grid sits on the kick drum, and the grid that does. Beat
 * detection that finds the right tempo can still lock onto the off-beat (the
 * hi-hat between the kicks), and a tempo a fraction of a percent out drifts a
 * third of a beat over a track: either way every `onBeat` hit lands wrong and
 * nothing says so. `kicks` are the attacks of the track below about 120 Hz,
 * found by the caller.
 *
 * The phase comes from the kicks of the first four bars (a circular mean, so a
 * grid on the off-beat is found as such rather than averaging to nothing);
 * then the grid is fitted to the kicks by least squares over a window that
 * doubles until it covers the track, each kick numbered by the beat it falls
 * nearest and any more than a quarter-beat from one (a bass note between kicks)
 * left out. `offsetSeconds` and `driftSeconds` are how far the detected beats
 * sit from the fitted ones at the first and the last kick (positive: the kick
 * comes later). `spreadSeconds` is the middle half of the kicks' distances to
 * the fitted grid: wide, or few kicks matched, means there is no steady kick
 * and the fit should not be trusted (`steady: false`).
 */
export const kickCheck = (
  grid: BeatGrid,
  kicks: number[],
  { tolerance = 0.03 }: { tolerance?: number } = {},
): {
  offsetSeconds: number;
  driftSeconds: number;
  spreadSeconds: number;
  matched: number;
  steady: boolean;
  shift: boolean;
  offBeat: boolean;
  corrected: BeatGrid;
} => {
  const ks = [...kicks].sort((a, b) => a - b);
  const p0 = grid.periodSeconds;
  const none = { offsetSeconds: 0, driftSeconds: 0, spreadSeconds: 0, matched: 0, steady: false, shift: false, offBeat: false, corrected: grid };
  if (ks.length < 8) return none;
  // Phase from the first four bars.
  const early = ks.filter((t) => t <= ks[0] + 16 * p0);
  let cx = 0;
  let cy = 0;
  for (const t of early) {
    const a = (2 * Math.PI * (t - grid.firstBeatSeconds)) / p0;
    cx += Math.cos(a);
    cy += Math.sin(a);
  }
  let first = grid.firstBeatSeconds + (Math.atan2(cy, cx) / (2 * Math.PI)) * p0;
  let period = p0;
  // Least squares over a growing window.
  const fit = (until: number) => {
    let n = 0, sk = 0, st = 0, skk = 0, skt = 0;
    for (const t of ks) {
      if (t > until) break;
      const k = Math.round((t - first) / period);
      if (Math.abs(t - first - k * period) > period / 4) continue;
      n++; sk += k; st += t; skk += k * k; skt += k * t;
    }
    const den = n * skk - sk * sk;
    if (n < 4 || Math.abs(den) < 1e-9) return;
    period = (n * skt - sk * st) / den;
    first = (st - period * sk) / n;
  };
  for (let until = ks[0] + 16 * p0; ; until *= 2) {
    fit(until);
    if (until >= ks[ks.length - 1]) break;
  }
  fit(Infinity);
  const fitted: BeatGrid = { bpm: 60 / period, periodSeconds: period, firstBeatSeconds: ((first % period) + period) % period };
  const res = ks.map((t) => wrap(t - fitted.firstBeatSeconds, period)).filter((r) => Math.abs(r) <= period / 4).sort((a, b) => a - b);
  const q = (f: number) => res[Math.min(res.length - 1, Math.floor(f * res.length))];
  const spread = res.length ? q(0.75) - q(0.25) : Infinity;
  const at = (t: number) => wrap(nearestBeat(fitted, t) - nearestBeat(grid, t), p0);
  const offset = at(ks[0]);
  const drift = at(ks[ks.length - 1]);
  const steady = res.length >= Math.max(8, ks.length * 0.4) && spread < period / 8;
  const shift = steady && (Math.abs(offset) > tolerance || Math.abs(drift) > tolerance);
  return {
    offsetSeconds: offset,
    driftSeconds: drift,
    spreadSeconds: spread,
    matched: res.length,
    steady,
    shift,
    offBeat: steady && Math.abs(Math.abs(offset) - p0 / 2) < p0 / 8,
    corrected: shift ? { ...fitted, bpm: Math.round(fitted.bpm * 100) / 100 } : grid,
  };
};

/**
 * Where to start reading the track (`bed.trackIn`) so the reel's hard moments
 * land on beats. `moments` are seconds after the bed starts playing. The grid
 * is regular, so only `trackIn` within half a beat of the current one matters:
 * the search stays there, which keeps the part of the track that was chosen
 * and only slides its phase. It never goes below 0. Ties keep the smaller move.
 * Errors are the distance from each moment to its nearest beat, in seconds.
 */
export const fitTrackIn = (
  grid: BeatGrid,
  moments: number[],
  trackIn: number,
  step = 0.001,
): { trackIn: number; before: number[]; after: number[] } => {
  const errors = (s: number) => moments.map((m) => Math.abs(s + m - nearestBeat(grid, s + m)));
  const total = (s: number) => errors(s).reduce((a, b) => a + b, 0);
  const half = grid.periodSeconds / 2;
  let best = trackIn;
  let bestTotal = total(trackIn);
  for (let d = step; d <= half + 1e-9; d += step) {
    for (const s of [trackIn - d, trackIn + d]) {
      if (s < 0) continue;
      const e = total(s);
      if (e < bestTotal - 1e-9) {
        best = s;
        bestTotal = e;
      }
    }
  }
  return { trackIn: Math.round(best * 1000) / 1000, before: errors(trackIn), after: errors(Math.round(best * 1000) / 1000) };
};
