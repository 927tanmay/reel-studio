/**
 * The newer transitions — zoom-through and wipe — as pure functions of the
 * frame. No remotion import, so they are unit-tested directly; `punch.ts`
 * holds the older ones (punch, blend, push) and calls into these for the new.
 *
 * Both overlap the previous shot exactly as a blend does: `resolveTimeline`
 * starts the incoming shot `frames` early, crossfades the sound under the
 * overlap, and gives the outgoing shot an exit if it has none of its own.
 */

/** Cubic in-out: slow, fast, slow — a camera move rather than a fade. */
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Cubic out: fast off the mark, settling. */
const out = (t: number) => 1 - Math.pow(1 - t, 3);
/** Cubic in: gathering speed into the cut. */
const into = (t: number) => t * t * t;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const t01 = (frame: number, frames: number) => clamp01(frames > 0 ? frame / frames : 1);

/** Zoom-through defaults: how far the picture travels, and how soft at the peak (design px). */
export const ZOOM_TO = 1.6;
export const ZOOM_BLUR = 22;

/**
 * The incoming side of a zoom-through: it arrives already enlarged and soft,
 * as if the camera is still flying into it, and settles to rest and focus.
 * Opacity comes up in the first half, so the hand-over happens while both
 * pictures are moving fastest and the eye cannot follow either.
 */
export const zoomEnter = (frame: number, frames: number, to = ZOOM_TO, blur = ZOOM_BLUR) => {
  const t = t01(frame, frames);
  const settle = out(t);
  return {
    scale: to + (1 - to) * settle,
    opacity: clamp01(out(t01(frame, frames * 0.5))),
    blur: blur * (1 - settle),
  };
};

/**
 * The outgoing side: it zooms in toward the camera and loses focus, faster and
 * faster into the cut. Applied over the last `frames` of the outgoing shot.
 */
export const zoomExit = (frame: number, durationInFrames: number, frames: number, to = ZOOM_TO, blur = ZOOM_BLUR) => {
  const start = durationInFrames - frames;
  const t = frame <= start ? 0 : t01(frame - start, frames);
  const g = into(t);
  return { scale: 1 + (to - 1) * g, blur: blur * g };
};

/**
 * A wipe: an edge crosses the frame in `direction` and the new picture is
 * revealed behind it. Returned as a CSS `inset()` clip for the incoming
 * picture: what is not yet uncovered is clipped away. `feather` is not done
 * with a mask (expensive per frame); a wipe here is a clean, hard edge.
 */
export const wipeClip = (frame: number, frames: number, direction: "left" | "right" | "up" | "down"): string => {
  const shown = inOut(t01(frame, frames)) * 100;
  const hidden = `${(100 - shown).toFixed(3)}%`;
  // "left" means the edge travels left: the new picture comes in from the right.
  switch (direction) {
    case "left":
      return `inset(0 0 0 ${hidden})`;
    case "right":
      return `inset(0 ${hidden} 0 0)`;
    case "up":
      return `inset(${hidden} 0 0 0)`;
    case "down":
      return `inset(0 0 ${hidden} 0)`;
  }
};

/** Where the wipe's edge is, as a fraction of the frame along its travel (0 at the start, 1 at the end). */
export const wipeEdge = (frame: number, frames: number): number => inOut(t01(frame, frames));
