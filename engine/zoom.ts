import type { Pointer } from "./spec";
import type { PointerStyle } from "./tokens";

/**
 * Linear piecewise interpolation, clamped at both ends. Written out rather than
 * imported from Remotion so this file — which the timeline reads to place the
 * sound that marks a zoom — stays free of the renderer and loads in plain Node.
 */
const piecewise = (x: number, inputs: number[], outputs: number[]): number => {
  if (x <= inputs[0]) return outputs[0];
  for (let i = 1; i < inputs.length; i++) {
    if (x <= inputs[i]) {
      const span = inputs[i] - inputs[i - 1];
      if (span <= 0) return outputs[i];
      return outputs[i - 1] + ((x - inputs[i - 1]) / span) * (outputs[i] - outputs[i - 1]);
    }
  }
  return outputs[outputs.length - 1];
};

export type ZoomState = {
  /** 1 means no zoom. */
  scale: number;
  /** The point the picture scales about, as fractions of the frame. */
  x: number;
  y: number;
};

/** The magnification a pointer asks for: the shot's own number, else the look's. */
export const zoomTarget = (pointer: Pointer, style: PointerStyle): number | null => {
  if (!pointer.zoom || !style.zoom) return null;
  return typeof pointer.zoom === "number" ? pointer.zoom : style.zoom.to;
};

/**
 * Frame, in shot-local frames, at which a click's zoom starts easing in —
 * shared with the sound that marks it, so the two cannot drift apart.
 */
export const zoomStartFrame = (clickFrame: number, style: NonNullable<PointerStyle["zoom"]>): number =>
  clickFrame - style.lead - style.inFrames;

/**
 * The picture's zoom at one frame: a pure function of the frame, built from
 * each click's own ramp (in, hold, out). Where ramps overlap — two clicks close
 * together — the scale follows the stronger and the focus blends between them
 * by strength, so the camera glides from one target to the next instead of
 * zooming all the way out between them.
 */
export const zoomState = (
  frame: number,
  fps: number,
  pointer: Pointer,
  style: PointerStyle,
): ZoomState | null => {
  const to = zoomTarget(pointer, style);
  const z = style.zoom;
  if (to === null || !z) return null;

  let strongest = 0;
  let weight = 0;
  let fx = 0;
  let fy = 0;
  for (const c of pointer.path) {
    if (!c.click) continue;
    const click = Math.round(c.at * fps);
    const start = zoomStartFrame(click, z);
    const peakStart = click - z.lead;
    const peakEnd = click + z.holdFrames;
    const linear = piecewise(frame, [start, peakStart, peakEnd, peakEnd + z.outFrames], [0, 1, 1, 0]);
    const s = linear * linear * (3 - 2 * linear); // smoothstep: no corner at either end
    if (s <= 0) continue;
    strongest = Math.max(strongest, s);
    weight += s;
    fx += s * c.x;
    fy += s * c.y;
  }
  if (strongest <= 0) return null;
  return { scale: 1 + (to - 1) * strongest, x: fx / weight, y: fy / weight };
};
