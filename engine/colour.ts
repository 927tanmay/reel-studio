/**
 * Matching one clip's colour to another's.
 *
 * Two clips cut together should look like they were shot for the same reel.
 * A phone take and a screen recording never are: one is lit by a room and
 * encoded by a camera, the other is a display captured by software, and the
 * gap between them is obvious the instant they sit next to each other.
 *
 * What is fixable here is the part that is genuinely a difference in
 * rendering rather than in content — overall level, and the balance between
 * channels. What is not fixable here is that the two clips are *pictures of
 * different things*, which is why nothing in this file matches all the way by
 * default. See `matchGrade`.
 */

import type { Colour, Grade, MediaManifest } from "./spec";

/** Rec. 709 luma. The weights are the standard's, not a choice. */
export const luma = (c: Colour): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * How far apart two clips are, as a rough percentage.
 *
 * Only ever used to report. A large number is a prompt to look at the two
 * clips, not a value to correct away.
 */
export const distance = (a: Colour, b: Colour): number => {
  const spread = (x: number, y: number) => Math.abs(x - y) / Math.max(1, (x + y) / 2);
  return ((spread(a.r, b.r) + spread(a.g, b.g) + spread(a.b, b.b)) / 3) * 100;
};

/**
 * A grade that moves `clip` toward `reference`.
 *
 * `strength` is the whole design. At 1 the two clips' mean channel levels are
 * made equal, which is almost never right: a screen recording of a dark
 * editor and a lit face have different means because they are pictures of
 * different things, and forcing those to agree grades the *content* away —
 * the editor comes out grey and the face comes out wrong. A partial
 * correction takes out the part that reads as a mismatch in rendering and
 * leaves the part that is genuinely the subject. The default is deliberately
 * short of full for that reason; raise it when the two clips really are the
 * same subject shot twice.
 *
 * Returns gains only. Exposure, contrast and saturation stay where the
 * shotlist puts them, because those are taste and this is measurement.
 */
export const matchGrade = (
  media: MediaManifest,
  clip: string,
  reference: string,
  strength = 0.5,
): Grade => {
  const from = media[clip]?.colour;
  const to = media[reference]?.colour;

  // A missing measurement means `npm run grade` has not run, or has not run
  // since this clip arrived. Neutral is the honest answer: silently inventing
  // a correction from nothing would be worse than doing nothing.
  if (!from || !to) return {};

  const k = Math.max(0, Math.min(1, strength));
  const channel = (a: number, b: number) => {
    if (a <= 0) return 1;
    return 1 + (b / a - 1) * k;
  };

  return {
    gain: {
      r: channel(from.r, to.r),
      g: channel(from.g, to.g),
      b: channel(from.b, to.b),
    },
  };
};

/**
 * The CSS `filter` value for a grade, and whether it needs a colour matrix.
 *
 * Brightness, contrast and saturation are ordinary CSS filter functions.
 * Per-channel gain is not — CSS has no way to scale one channel — so that
 * part goes through an SVG `feColorMatrix`, which does it exactly rather than
 * approximating it with a hue rotation.
 */
export const gradeFilter = (grade: Grade | undefined, matrixId: string): string | undefined => {
  if (!grade) return undefined;

  const parts: string[] = [];
  if (grade.exposure !== undefined && grade.exposure !== 1) parts.push(`brightness(${grade.exposure})`);
  if (grade.contrast !== undefined && grade.contrast !== 1) parts.push(`contrast(${grade.contrast})`);
  if (grade.saturation !== undefined && grade.saturation !== 1) parts.push(`saturate(${grade.saturation})`);
  if (grade.gain && (grade.gain.r !== 1 || grade.gain.g !== 1 || grade.gain.b !== 1)) {
    parts.push(`url(#${matrixId})`);
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
};

/** True when this grade needs the SVG matrix rendered alongside it. */
export const needsMatrix = (grade: Grade | undefined): boolean =>
  Boolean(grade?.gain && (grade.gain.r !== 1 || grade.gain.g !== 1 || grade.gain.b !== 1));
