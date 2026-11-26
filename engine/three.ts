/**
 * The geometry behind the 3D clips (globe, device, extrude), as pure functions
 * of time, so a frame can be computed alone and the renderer, verify.ts and the
 * tests agree. No three.js import: plain `[x, y, z]` triples, y up, z toward the
 * camera, the same convention three.js uses.
 */
import { SPRINGS, track } from "./spring";

export type Vec3 = [number, number, number];

const DEG = Math.PI / 180;

/** A point on a sphere of radius `r` from latitude and longitude in degrees. Longitude 0 faces the camera. */
export const latLon = (lat: number, lon: number, r = 1): Vec3 => {
  const phi = lat * DEG;
  const lam = lon * DEG;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
};

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];

/**
 * `n` points along the great circle from `a` to `b` (both on the unit sphere),
 * lifted off the surface by up to `lift` at the middle so the arc reads as a
 * flight path rather than a line painted on the ground. Spherical
 * interpolation, so the spacing is even whatever the distance.
 */
export const arcPoints = (a: Vec3, b: Vec3, n: number, lift = 0.25): Vec3[] => {
  const ua = scale(a, 1 / len(a));
  const ub = scale(b, 1 / len(b));
  const dot = Math.min(1, Math.max(-1, ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2]));
  const omega = Math.acos(dot);
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    const p: Vec3 =
      omega < 1e-6
        ? ua
        : ([0, 1, 2].map((k) => (Math.sin((1 - u) * omega) * ua[k] + Math.sin(u * omega) * ub[k]) / Math.sin(omega)) as Vec3);
    // A longer flight climbs higher, as a real one does, but never past `lift`.
    out.push(scale(p, 1 + lift * Math.min(1, omega / 1.5) * Math.sin(Math.PI * u)));
  }
  return out;
};

/** Eased 0..1 progress of something that starts at `at` and takes `seconds`. */
export const progress = (t: number, at: number, seconds: number): number => {
  const x = Math.min(1, Math.max(0, (t - at) / Math.max(1e-6, seconds)));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/**
 * `n` points spread evenly over the unit sphere (a Fibonacci lattice): the
 * dotted globe's surface, the same on every frame and every render.
 */
export const fibonacciSphere = (n: number): Vec3[] => {
  const out: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    out.push([r * Math.sin(a), y, r * Math.cos(a)]);
  }
  return out;
};

/**
 * Which way the globe faces at `t`: it turns slowly on its own (`spin`, degrees
 * a second) until a `focus` key, then springs round so that latitude and
 * longitude face the camera, and holds there until the next. The result is the
 * rotation to apply to the globe, in radians, about x (tilt) and y (turn).
 */
export const globeFacing = (
  t: number,
  focus: { at: number; lat: number; lon: number }[],
  spin: number,
  tilt: number,
): { x: number; y: number } => {
  const keys = [...focus].sort((a, b) => a.at - b.at);
  // Free spin until the first focus; after it the globe is held by the springs.
  const first = keys[0];
  const spinUntil = first ? first.at : Infinity;
  const free = -spin * DEG * Math.min(t, spinUntil);
  if (!first) return { x: tilt * DEG, y: free };
  // Turning to face a longitude means rotating the globe by its negative. Take
  // the short way round from wherever the free spin left it.
  let current = -spin * DEG * spinUntil;
  const ys = keys.map((k) => {
    let target = -k.lon * DEG;
    while (target - current > Math.PI) target -= 2 * Math.PI;
    while (target - current < -Math.PI) target += 2 * Math.PI;
    current = target;
    return { at: k.at, value: target, spring: SPRINGS.camera };
  });
  const xs = keys.map((k) => ({ at: k.at, value: k.lat * DEG, spring: SPRINGS.camera }));
  const y = track(-spin * DEG * spinUntil, ys)(t);
  const x = track(tilt * DEG, xs)(t);
  return { x, y: t < spinUntil ? free : y };
};

/**
 * A device swinging in and coming flat: it starts turned by `from` (degrees
 * about x and y) and springs to each `turns` key in order, the last of which is
 * usually flat (0, 0). Without keys it settles flat over its spring from 0 s.
 * Degrees in, radians out.
 */
export const deviceAngles = (
  t: number,
  from: { x: number; y: number },
  turns: { at: number; x?: number; y?: number }[],
): { x: number; y: number } => {
  const keys = turns.length ? [...turns].sort((a, b) => a.at - b.at) : [{ at: 0, x: 0, y: 0 }];
  // Critically damped and slow (about a second and a half to settle): a device
  // turning is the camera coming round to it, never a snap.
  const swing: [number, number] = [4.5, 1];
  const x = track(from.x, keys.map((k) => ({ at: k.at, value: k.x ?? 0, spring: swing })))(t);
  const y = track(from.y, keys.map((k) => ({ at: k.at, value: k.y ?? 0, spring: swing })))(t);
  return { x: x * DEG, y: y * DEG };
};

/**
 * The camera distance that makes an object `size` world units across fill
 * `fraction` of a frame `aspect` (width / height) wide, at a vertical field of
 * view `fov` degrees. So a look can say "a third of the frame" and mean it.
 */
export const distanceFor = (size: number, fraction: number, fov: number, aspect: number): number => {
  const visibleWidth = size / Math.max(1e-6, fraction);
  const visibleHeight = visibleWidth / aspect;
  return visibleHeight / 2 / Math.tan((fov * DEG) / 2);
};

/** Where on screen (fractions of the frame, y down) a world point lands, for a camera on +z looking at the origin. */
export const project = (p: Vec3, distance: number, fov: number, aspect: number): { x: number; y: number; behind: boolean } => {
  const depth = distance - p[2];
  const half = Math.tan((fov * DEG) / 2);
  return {
    x: 0.5 + p[0] / (depth * half * aspect) / 2,
    y: 0.5 - p[1] / (depth * half) / 2,
    behind: depth <= 0,
  };
};

/** Rotate a point about x, then y (radians): the order the globe group applies them in. */
export const rotate = ([x, y, z]: Vec3, rx: number, ry: number): Vec3 => {
  // three.js applies a group's Euler XYZ as Rx * Ry * Rz to the vector, so y first.
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
};

/**
 * The first `fraction` of a polyline by length: an icon's stroke drawn partway,
 * ending exactly on the cut rather than at the last whole vertex.
 */
export const polylinePrefix = <P extends number[]>(points: P[], fraction: number): P[] => {
  if (points.length < 2 || fraction >= 1) return points;
  if (fraction <= 0) return [];
  const seg = points.slice(1).map((p, i) => Math.hypot(...p.map((v, k) => v - points[i][k])));
  const total = seg.reduce((a, b) => a + b, 0);
  let left = total * fraction;
  const out: P[] = [points[0]];
  for (let i = 0; i < seg.length; i++) {
    if (left >= seg[i]) {
      out.push(points[i + 1]);
      left -= seg[i];
      continue;
    }
    const u = seg[i] === 0 ? 0 : left / seg[i];
    out.push(points[i].map((v, k) => v + (points[i + 1][k] - v) * u) as P);
    break;
  }
  return out;
};

/**
 * How a picture of `imageAspect` (width / height) covers a screen of
 * `screenAspect`: the share of the picture visible across and down (texture
 * repeat), and the offset that shows the part `scroll` (0 top, 1 bottom) of the
 * way down a tall one. Texture coordinates run bottom-up, as three.js's do.
 */
export const screenCover = (imageAspect: number, screenAspect: number, scroll = 0) => {
  if (imageAspect > screenAspect) {
    // Wider than the screen: fill its height, crop the sides evenly.
    const rx = screenAspect / imageAspect;
    return { repeat: [rx, 1] as [number, number], offset: [(1 - rx) / 2, 0] as [number, number] };
  }
  const ry = imageAspect / screenAspect;
  const s = Math.min(1, Math.max(0, scroll));
  return { repeat: [1, ry] as [number, number], offset: [0, (1 - ry) * (1 - s)] as [number, number] };
};

/** The clips drawn with WebGL, which a render has to be given a GL backend for. */
export const WEBGL_CLIPS = new Set(["globe", "device", "extrude"]);

/** Whether any shot (or its overlay) is a WebGL clip: the render scripts pass `--gl` only then. */
export const usesWebGL = (shots: { src: unknown; overlay?: { src: unknown } }[]): boolean =>
  shots.some((s) => [s.src, s.overlay?.src].some((g) => typeof g === "object" && g !== null && WEBGL_CLIPS.has((g as { type?: string }).type ?? "")));

/**
 * The GL backend for a render that needs one: ANGLE over Metal on a Mac, and
 * SwiftShader (software, slower, needs no GPU) anywhere else, which is what a
 * CI machine has. Chrome's headless default has no WebGL at all.
 */
export const glBackend = (platform: string): "angle" | "swangle" => (platform === "darwin" ? "angle" : "swangle");
