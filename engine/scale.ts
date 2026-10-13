/**
 * Two things every visual element needs: a size that survives a change of
 * frame, and a crop that never distorts.
 */

import type { Frame, Rect } from "./spec";
import type { Tokens } from "./tokens";

/**
 * Token sizes are authored against `designWidth`. This converts them to the
 * actual frame, so the same look works at 1080x1920 and 1080x1350 without a
 * second set of numbers.
 */
export const px = (tokens: Tokens, frame: Frame, value: number) =>
  (value * frame.w) / tokens.designWidth;

/**
 * Crop-then-scale, as one transform.
 *
 * Returns what the *inner* element needs so that `region` of a `sourceW` by
 * `sourceH` source exactly covers the frame. The region is covered, not
 * stretched: if its aspect differs from the frame's, the overflow is centred
 * and clipped rather than squashed.
 */
export const coverRegion = (
  sourceW: number,
  sourceH: number,
  region: Rect,
  frame: Frame,
) => {
  const scale = Math.max(frame.w / region.w, frame.h / region.h);
  const regionCentreX = region.x + region.w / 2;
  const regionCentreY = region.y + region.h / 2;

  return {
    width: sourceW * scale,
    height: sourceH * scale,
    left: frame.w / 2 - regionCentreX * scale,
    top: frame.h / 2 - regionCentreY * scale,
    /** Output pixels per source pixel. Above 1, the source is enlarged past what was captured. */
    sourceScale: scale,
  };
};

/** The whole source, covering the frame. What you get when no reframe is set. */
export const fullFrame = (sourceW: number, sourceH: number): Rect => ({
  x: 0,
  y: 0,
  w: sourceW,
  h: sourceH,
});

/**
 * A correct-aspect rectangle centred on a point, at a given zoom.
 * Saves hand-computing rectangles that match the delivery aspect.
 */
export const regionAt = (
  sourceW: number,
  sourceH: number,
  frame: Frame,
  opts: { centreX?: number; centreY?: number; zoom?: number } = {},
): Rect => {
  const zoom = opts.zoom ?? 1;
  const frameAspect = frame.w / frame.h;

  // Largest frame-shaped rectangle that fits the source, then zoomed in.
  let w = Math.min(sourceW, sourceH * frameAspect);
  let h = w / frameAspect;
  w /= zoom;
  h /= zoom;

  const cx = opts.centreX ?? sourceW / 2;
  const cy = opts.centreY ?? sourceH / 2;

  return {
    x: Math.max(0, Math.min(sourceW - w, cx - w / 2)),
    y: Math.max(0, Math.min(sourceH - h, cy - h / 2)),
    w,
    h,
  };
};

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});
