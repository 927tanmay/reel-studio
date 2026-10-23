/**
 * The built-in line-art icons as paths, so they can draw themselves on.
 *
 * Each icon is a list of segments, each with a window `[from, to]` of the icon's
 * overall progress in which that segment is drawn: a check is one stroke, a
 * cross is two drawn one after the other, a lock draws its body and then its
 * shackle. A segment marked `dot` is a point that pops in at the end rather
 * than a stroke. At progress 1 every segment is fully drawn, which is the same
 * picture the static icons always were — so a look with no draw-on is
 * unchanged.
 *
 * Pure data in a 48×48 viewBox, shared by the renderer and anything that wants
 * to reason about an icon without drawing it.
 */

export type IconSegment = {
  /** SVG path data. For a `dot`, ignored — see `at`. */
  d: string;
  /** The slice of the icon's 0..1 progress in which this is drawn. */
  from: number;
  to: number;
  /** A point rather than a stroke: where it sits, in the viewBox. */
  dot?: { cx: number; cy: number; r: number };
};

export type IconName =
  | "check"
  | "cross"
  | "arrow-right"
  | "star"
  | "lock"
  | "warning"
  | "info"
  | "trend-up"
  | "phone"
  | "bluetooth"
  | "map-pin"
  | "key"
  | "cloud"
  | "document"
  | "globe"
  | "image"
  | "eye-off"
  | "server"
  | "sparkle"
  | "shield"
  | "user"
  | "clock"
  | "database"
  | "play"
  | "terminal"
  | "network";

export const ICONS: Record<IconName, IconSegment[]> = {
  check: [{ d: "M10 25 L19 34 L38 13", from: 0, to: 1 }],
  cross: [
    { d: "M12 12 L36 36", from: 0, to: 0.55 },
    { d: "M36 12 L12 36", from: 0.45, to: 1 },
  ],
  "arrow-right": [
    { d: "M8 24 L40 24", from: 0, to: 0.65 },
    { d: "M27 11 L40 24 L27 37", from: 0.55, to: 1 },
  ],
  star: [{ d: "M24 5 L29.5 18 L43 19.5 L33 29 L36 43 L24 36 L12 43 L15 29 L5 19.5 L18.5 18 Z", from: 0, to: 1 }],
  lock: [
    {
      d: "M14 21 H34 a4 4 0 0 1 4 4 V37 a4 4 0 0 1 -4 4 H14 a4 4 0 0 1 -4 -4 V25 a4 4 0 0 1 4 -4 Z",
      from: 0,
      to: 0.65,
    },
    { d: "M15 21 V14 a9 9 0 0 1 18 0 V21", from: 0.5, to: 1 },
  ],
  warning: [
    { d: "M24 6 L44 40 L4 40 Z", from: 0, to: 0.6 },
    { d: "M24 19 V29", from: 0.55, to: 0.85 },
    { d: "", from: 0.85, to: 1, dot: { cx: 24, cy: 34.5, r: 0.6 } },
  ],
  info: [
    { d: "M24 6 a18 18 0 1 1 0 36 a18 18 0 1 1 0 -36", from: 0, to: 0.6 },
    { d: "M24 22 V33", from: 0.55, to: 0.85 },
    { d: "", from: 0.85, to: 1, dot: { cx: 24, cy: 14.5, r: 0.6 } },
  ],
  phone: [
    { d: "M17 5 H31 a4 4 0 0 1 4 4 V39 a4 4 0 0 1 -4 4 H17 a4 4 0 0 1 -4 -4 V9 a4 4 0 0 1 4 -4 Z", from: 0, to: 0.7 },
    { d: "M21 9.5 H27", from: 0.65, to: 0.85 },
    { d: "", from: 0.85, to: 1, dot: { cx: 24, cy: 38, r: 0.6 } },
  ],
  bluetooth: [{ d: "M14 16 L34 32 L24 42 L24 6 L34 16 L14 32", from: 0, to: 1 }],
  "map-pin": [
    { d: "M24 43 C24 43 10 30 10 19 a14 14 0 0 1 28 0 C38 30 24 43 24 43 Z", from: 0, to: 0.7 },
    { d: "M24 14 a5 5 0 1 1 0 10 a5 5 0 1 1 0 -10", from: 0.6, to: 1 },
  ],
  key: [
    { d: "M15 16 a8 8 0 1 1 0 16 a8 8 0 1 1 0 -16", from: 0, to: 0.5 },
    { d: "M23 24 H42", from: 0.45, to: 0.8 },
    { d: "M36 24 V31", from: 0.75, to: 0.9 },
    { d: "M42 24 V29", from: 0.85, to: 1 },
  ],
  cloud: [
    {
      d: "M14 36 C8 36 5 32 5 28 C5 24 8 21 12 20.5 C12.5 14 17 9 24 9 C30 9 34.5 13 35.5 18.5 C40.5 19 43 23 43 27.5 C43 32.5 39.5 36 35 36 Z",
      from: 0,
      to: 1,
    },
  ],
  document: [
    { d: "M12 5 H28 L38 15 V41 a2 2 0 0 1 -2 2 H12 a2 2 0 0 1 -2 -2 V7 a2 2 0 0 1 2 -2 Z", from: 0, to: 0.5 },
    { d: "M28 5 V15 H38", from: 0.45, to: 0.62 },
    { d: "M17 25 H31", from: 0.6, to: 0.76 },
    { d: "M17 31 H31", from: 0.72, to: 0.88 },
    { d: "M17 37 H25", from: 0.85, to: 1 },
  ],
  globe: [
    { d: "M24 6 a18 18 0 1 1 0 36 a18 18 0 1 1 0 -36", from: 0, to: 0.5 },
    { d: "M24 6 C16 14 16 34 24 42 C32 34 32 14 24 6", from: 0.4, to: 0.75 },
    { d: "M6 24 H42", from: 0.7, to: 1 },
  ],
  image: [
    { d: "M10 8 H38 a3 3 0 0 1 3 3 V37 a3 3 0 0 1 -3 3 H10 a3 3 0 0 1 -3 -3 V11 a3 3 0 0 1 3 -3 Z", from: 0, to: 0.55 },
    { d: "M32 14 a3 3 0 1 1 0 6 a3 3 0 1 1 0 -6", from: 0.5, to: 0.7 },
    { d: "M7 34 L18 22 L27 31 L32 26 L41 35", from: 0.65, to: 1 },
  ],
  "eye-off": [
    { d: "M4 24 C9 14 16 10 24 10 C32 10 39 14 44 24 C39 34 32 38 24 38 C16 38 9 34 4 24 Z", from: 0, to: 0.5 },
    { d: "M24 19 a5 5 0 1 1 0 10 a5 5 0 1 1 0 -10", from: 0.45, to: 0.65 },
    { d: "M9 40 L39 8", from: 0.65, to: 1 },
  ],
  server: [
    { d: "M9 8 H39 a2 2 0 0 1 2 2 V20 a2 2 0 0 1 -2 2 H9 a2 2 0 0 1 -2 -2 V10 a2 2 0 0 1 2 -2 Z", from: 0, to: 0.4 },
    { d: "M9 26 H39 a2 2 0 0 1 2 2 V38 a2 2 0 0 1 -2 2 H9 a2 2 0 0 1 -2 -2 V28 a2 2 0 0 1 2 -2 Z", from: 0.35, to: 0.75 },
    { d: "", from: 0.8, to: 0.9, dot: { cx: 14, cy: 15, r: 0.6 } },
    { d: "", from: 0.9, to: 1, dot: { cx: 14, cy: 33, r: 0.6 } },
  ],
  sparkle: [
    { d: "M24 6 C25 16 32 23 42 24 C32 25 25 32 24 42 C23 32 16 25 6 24 C16 23 23 16 24 6 Z", from: 0, to: 0.7 },
    { d: "M39 6 V12", from: 0.65, to: 0.82 },
    { d: "M36 9 H42", from: 0.8, to: 1 },
  ],
  shield: [
    { d: "M24 5 L39 11 V23 C39 33 32 39 24 43 C16 39 9 33 9 23 V11 Z", from: 0, to: 0.65 },
    { d: "M17 24 L22 29 L31 19", from: 0.6, to: 1 },
  ],
  user: [
    { d: "M24 8 a8 8 0 1 1 0 16 a8 8 0 1 1 0 -16", from: 0, to: 0.5 },
    { d: "M8 42 C8 32 15 28 24 28 C33 28 40 32 40 42", from: 0.45, to: 1 },
  ],
  clock: [
    { d: "M24 6 a18 18 0 1 1 0 36 a18 18 0 1 1 0 -36", from: 0, to: 0.6 },
    { d: "M24 14 V24 L31 28", from: 0.55, to: 1 },
  ],
  database: [
    { d: "M10 12 a14 5 0 1 1 28 0 a14 5 0 1 1 -28 0", from: 0, to: 0.4 },
    { d: "M10 12 V36 a14 5 0 0 0 28 0 V12", from: 0.35, to: 0.8 },
    { d: "M10 24 a14 5 0 0 0 28 0", from: 0.75, to: 1 },
  ],
  play: [
    { d: "M18 10 L38 24 L18 38 Z", from: 0, to: 1 },
  ],
  terminal: [
    { d: "M9 9 H39 a3 3 0 0 1 3 3 V36 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 V12 a3 3 0 0 1 3 -3 Z", from: 0, to: 0.55 },
    { d: "M14 19 L21 24 L14 29", from: 0.5, to: 0.8 },
    { d: "M25 30 H33", from: 0.75, to: 1 },
  ],
  network: [
    { d: "M24 14 L12 33", from: 0, to: 0.3 },
    { d: "M24 14 L36 33", from: 0.25, to: 0.55 },
    { d: "M15 38 H33", from: 0.5, to: 0.75 },
    { d: "M24 6 a4 4 0 1 1 0 8 a4 4 0 1 1 0 -8", from: 0.7, to: 0.85 },
    { d: "M10 33 a4 4 0 1 1 0 8 a4 4 0 1 1 0 -8", from: 0.8, to: 0.93 },
    { d: "M38 33 a4 4 0 1 1 0 8 a4 4 0 1 1 0 -8", from: 0.88, to: 1 },
  ],
  "trend-up": [
    { d: "M6 34 L18 22 L26 28 L42 10", from: 0, to: 0.75 },
    { d: "M30 10 L42 10 L42 22", from: 0.7, to: 1 },
  ],
};

/** A segment's own 0..1 progress, given the icon's overall progress. */
export const segmentProgress = (overall: number, segment: IconSegment): number => {
  if (segment.to <= segment.from) return overall >= segment.to ? 1 : 0;
  return Math.max(0, Math.min(1, (overall - segment.from) / (segment.to - segment.from)));
};

/**
 * The icon's draw-on progress at a frame. With no `drawFrames` — a look that
 * has not asked for it — an icon is simply drawn, as it always was.
 */
export const iconProgress = (frame: number, startFrame: number, drawFrames: number | undefined): number => {
  if (!drawFrames || drawFrames <= 0) return 1;
  return Math.max(0, Math.min(1, (frame - startFrame) / drawFrames));
};
