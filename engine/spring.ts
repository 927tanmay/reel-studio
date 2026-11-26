/**
 * Springs as pure functions of time, for things that change target many times
 * and must never jerk: a card that becomes a pill that becomes a chart.
 *
 * `spring` is the closed-form step response of a damped spring, 0 to 1 with no
 * initial velocity: any instant can be computed alone, which is what lets any
 * frame render alone. `track` sums one spring per change of target, so a value
 * already in motion toward one target carries that motion into the next instead
 * of restarting — the reason a morph reads as one continuous object.
 *
 * The approach (and the presets' feel) follows the motion engine in
 * Barty-Bart/motion-graphics (MIT). Pure; no remotion import.
 */

/** Stiffness ω (radians per second) and damping ratio ζ. */
export type Spring = [number, number];

/** Shape changes, a fast leading edge, a slow trailing one, gentle settles, the camera, and an instant reset. */
export const SPRINGS = {
  morph: [15, 0.84] as Spring,
  fast: [27, 0.86] as Spring,
  slow: [12.5, 0.9] as Spring,
  soft: [10, 0.95] as Spring,
  camera: [7.5, 1] as Spring,
  instant: [Infinity, 1] as Spring,
};

/** 0 to 1, `seconds` after the step. Under-damped overshoots a little; critically damped does not. */
export const spring = (seconds: number, [w, z]: Spring): number => {
  if (seconds <= 0) return 0;
  if (!Number.isFinite(w)) return 1;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * seconds) * (Math.cos(wd * seconds) + ((z * w) / wd) * Math.sin(wd * seconds));
  }
  if (z > 1 + 1e-6) {
    const q = w * Math.sqrt(z * z - 1);
    const r1 = -z * w + q;
    const r2 = -z * w - q;
    return 1 - (r2 * Math.exp(r1 * seconds) - r1 * Math.exp(r2 * seconds)) / (r2 - r1);
  }
  return 1 - Math.exp(-w * seconds) * (1 + w * seconds);
};

/** A change of target: at `at` seconds, head for `value`, on this spring (or the track's). */
export type Key = { at: number; value: number; spring?: Spring };

/** The value at `t` seconds of something that starts at `v0` and changes target at each key. */
export const track = (v0: number, keys: Key[], fallback: Spring = SPRINGS.morph) => {
  const steps: { at: number; delta: number; spring: Spring }[] = [];
  let previous = v0;
  for (const k of [...keys].sort((a, b) => a.at - b.at)) {
    const delta = k.value - previous;
    previous = k.value;
    if (delta !== 0) steps.push({ at: k.at, delta, spring: k.spring ?? fallback });
  }
  return (t: number): number => steps.reduce((v, s) => v + s.delta * spring(t - s.at, s.spring), v0);
};

/** `#RRGGBB` as three channels, for colours that spring too. Anything else is returned unchanged by `colourTrack`. */
const hex = (c: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};

/** A colour that springs between hex values; a non-hex colour switches at its key instead. */
export const colourTrack = (c0: string, keys: { at: number; value: string }[], s: Spring = [20, 1]) => {
  const rgb0 = hex(c0);
  const all = keys.every((k) => hex(k.value));
  if (!rgb0 || !all) {
    const sorted = [...keys].sort((a, b) => a.at - b.at);
    return (t: number) => sorted.reduce((c, k) => (t >= k.at ? k.value : c), c0);
  }
  const channels = [0, 1, 2].map((i) => track(rgb0[i], keys.map((k) => ({ at: k.at, value: hex(k.value)![i], spring: s }))));
  return (t: number) => `rgb(${channels.map((f) => Math.round(Math.min(255, Math.max(0, f(t))))).join(",")})`;
};

/**
 * Content swapping in a morph: what leaves blurs out fast; what arrives waits a
 * beat, then blurs in — their own timings, so the two never cross-dissolve into
 * mush. Opacity, blur (design px) and scale at `t`.
 */
export const swap = (t: number, tin: number | null, tout: number | null, blur = 12) => {
  const eo = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const a = tin === null ? 1 : eo((t - tin - 0.07) / 0.26);
  const b = tout === null ? 0 : eo((t - tout) / 0.12);
  return { opacity: a * (1 - b), blur: (1 - a) * blur + b * blur * 0.8, scale: (0.94 + 0.06 * a) * (1 - 0.03 * b) };
};

/**
 * A pointer gliding between waypoints with a slight human arc: eased in and
 * out (quintic), bowing sideways by a few percent of the distance at the middle.
 */
export const pointerAt = (keys: { at: number; x: number; y: number }[], t: number): { x: number; y: number } => {
  if (keys.length === 0) return { x: 0.5, y: 0.5 };
  const k = [...keys].sort((a, b) => a.at - b.at);
  if (t <= k[0].at) return { x: k[0].x, y: k[0].y };
  const last = k[k.length - 1];
  if (t >= last.at) return { x: last.x, y: last.y };
  let i = 0;
  while (t >= k[i + 1].at) i++;
  const a = k[i];
  const b = k[i + 1];
  const x = Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)));
  const u = x * x * x * (x * (6 * x - 15) + 10);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const arc = Math.sin(Math.PI * u) * 0.06;
  return { x: a.x + dx * u - dy * arc, y: a.y + dy * u + dx * arc };
};

/** How pressed a pointer is at `t` (0 up, 1 down): down just before each click, up just after, and held through a drag. */
export const pressAt = (t: number, clicks: number[] = [], drags: [number, number][] = []): number => {
  const keys: Key[] = [];
  for (const c of clicks) keys.push({ at: c - 0.07, value: 1, spring: [45, 1] }, { at: c + 0.035, value: 0, spring: [22, 0.72] });
  for (const [a, b] of drags) keys.push({ at: a - 0.04, value: 1, spring: [45, 1] }, { at: b, value: 0, spring: [22, 0.72] });
  return track(0, keys)(t);
};
