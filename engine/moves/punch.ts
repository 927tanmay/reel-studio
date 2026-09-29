import { Easing as RemotionEasing, interpolate } from "remotion";
import type { Easing, Enter, Exit, Push } from "../spec";

// Standard overshoot/exponential formulas (Penner-style), not Remotion
// built-ins — `interpolate`'s `easing` only needs to be a `t => number`
// function, so these plug in exactly like the named curves above do.
const BACK_C1 = 1.70158;
const BACK_C3 = BACK_C1 + 1;
const easeOutBack = (t: number) => 1 + BACK_C3 * (t - 1) ** 3 + BACK_C1 * (t - 1) ** 2;

const BACK_C2 = BACK_C1 * 1.525;
const easeInOutBack = (t: number) =>
  t < 0.5
    ? ((2 * t) ** 2 * ((BACK_C2 + 1) * 2 * t - BACK_C2)) / 2
    : ((2 * t - 2) ** 2 * ((BACK_C2 + 1) * (t * 2 - 2) + BACK_C2) + 2) / 2;

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

const curve = (name?: Easing) => {
  switch (name) {
    case "linear":
      return RemotionEasing.linear;
    case "easeIn":
      return RemotionEasing.in(RemotionEasing.ease);
    case "easeInOut":
      return RemotionEasing.inOut(RemotionEasing.ease);
    case "ease":
      return RemotionEasing.ease;
    case "easeOutBack":
      return easeOutBack;
    case "easeInOutBack":
      return easeInOutBack;
    case "easeOutExpo":
      return easeOutExpo;
    case "easeOut":
    default:
      // A punch that decelerates into rest reads as a hit. Linear reads as a
      // machine, and easeIn reads as a mistake.
      return RemotionEasing.out(RemotionEasing.ease);
  }
};

/** Applies an easing curve to a 0..1 progress value. */
export const ease = (t: number, name?: Easing) => curve(name)(Math.max(0, Math.min(1, t)));

/**
 * The incoming shot starts enlarged and settles to rest. A blend uses the same
 * shape as a punch — start at `to`, ease down to 1 — so this covers both.
 * Returns 1 when the shot has no punch or blend, so it is always safe to
 * multiply by.
 */
export const enterScale = (frame: number, enter?: Enter): number => {
  if (!enter || (enter.kind !== "punch" && enter.kind !== "blend")) return 1;
  return interpolate(frame, [0, enter.frames], [enter.to, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: curve(enter.easing),
  });
};

/**
 * Opacity for a blend's incoming fade — 0 at the first frame, 1 once the
 * overlap finishes. Every other enter kind is a hard cut and stays fully
 * opaque throughout, which is what makes this safe to apply unconditionally.
 */
export const enterOpacity = (frame: number, enter?: Enter): number => {
  if (!enter || enter.kind !== "blend") return 1;
  return interpolate(frame, [0, enter.frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: curve(enter.easing),
  });
};

/** The outgoing shot pushes in over its final frames, handing off to the next. */
export const exitScale = (frame: number, durationInFrames: number, exit?: Exit): number => {
  if (!exit) return 1;
  const start = Math.max(0, durationInFrames - exit.frames);
  return interpolate(frame, [start, durationInFrames], [1, exit.to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: curve(exit.easing),
  });
};

/**
 * A push's signed pixel offset at a given frame — shared by `enterTranslate`,
 * which reads its position, and `pushMotionBlur`, which reads how fast that
 * position is changing. Both need to agree on the exact same curve, or the
 * blur would smear a path the picture was not actually following.
 *
 * `frame` is not rounded to an integer on purpose: the blur samples this half
 * a frame either side of where the picture actually is, and `interpolate`
 * accepts a fractional input the same as it accepts frame numbers, evaluating
 * the eased curve continuously rather than only at whole frames.
 */
const pushOffset = (frame: number, enter: Push, frameW: number, frameH: number): number => {
  const distance = enter.direction === "left" || enter.direction === "right" ? frameW : frameH;
  // "left" reads as "the new shot arrives moving left" — so it enters from
  // the right (a positive starting offset that eases down to zero).
  const sign = enter.direction === "left" || enter.direction === "up" ? 1 : -1;

  const t = interpolate(frame, [0, enter.frames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: curve(enter.easing),
  });

  return sign * distance * t;
};

/**
 * Pixel offset for a `push` — starts fully off-frame in `direction` and
 * settles to (0, 0). Zero for every other enter kind, so this is always safe
 * to add to a shot's position.
 */
export const enterTranslate = (
  frame: number,
  enter: Enter | undefined,
  frameW: number,
  frameH: number,
): { x: number; y: number } => {
  if (!enter || enter.kind !== "push") return { x: 0, y: 0 };

  const offset = pushOffset(frame, enter, frameW, frameH);
  const horizontal = enter.direction === "left" || enter.direction === "right";
  return horizontal ? { x: offset, y: 0 } : { x: 0, y: offset };
};

/**
 * Motion blur for a `push`, sized to how fast the picture is moving at this
 * exact instant rather than a fixed amount for the whole transition. An eased
 * push moves fastest partway through and comes to rest at the end; a constant
 * blur would either be too weak mid-slide or still visible on a frame that
 * has already stopped.
 *
 * Only the incoming shot ever has a `push` enter — the outgoing shot beneath
 * it stays static and fully sharp, which is correct: a push is a hard sweep
 * revealing a new picture, not two pictures both in motion.
 *
 * Returns a stdDeviation pair for an SVG `feGaussianBlur`: nonzero along the
 * axis of travel, zero across it, so a left/right push blurs horizontally
 * without softening vertical edges it never crossed, and a wipe up/down does
 * the reverse.
 */
export const pushMotionBlur = (
  frame: number,
  enter: Enter | undefined,
  frameW: number,
  frameH: number,
): { x: number; y: number } => {
  if (!enter || enter.kind !== "push" || enter.blur === 0) return { x: 0, y: 0 };
  const strength = enter.blur ?? 1;

  // Central difference over one frame, sampled half a frame either side of
  // now: the picture's speed at this instant, in pixels per frame.
  const before = pushOffset(frame - 0.5, enter, frameW, frameH);
  const after = pushOffset(frame + 0.5, enter, frameW, frameH);
  const speed = Math.abs(after - before);

  // A 180-degree shutter — the cinema default — exposes for half of each
  // frame's duration, so what it captures blurs across roughly half the
  // distance travelled in that frame. Capped well short of a full smear: a
  // push crosses the whole frame in a handful of frames, and blurring the
  // full distance covered would read as a streak rather than a fast move.
  const radius = Math.min(48, speed * 0.5 * strength);

  const horizontal = enter.direction === "left" || enter.direction === "right";
  return horizontal ? { x: radius, y: 0 } : { x: 0, y: radius };
};

/**
 * Audio crossfade across an overlap — 0 to 1 on the way in for both `blend`
 * and `push`. Kept separate from `enterOpacity`, which stays visual-only and
 * blend-specific: a push's picture is a hard sweep with no fade, but its
 * audio still crossfades, the same way a professional cut often carries a
 * quick audio crossfade under a hard visual cut to avoid a pop.
 */
export const enterAudioFade = (frame: number, enter?: Enter): number => {
  if (!enter || (enter.kind !== "blend" && enter.kind !== "push")) return 1;
  return interpolate(frame, [0, enter.frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: curve(enter.easing),
  });
};

/**
 * The mirror of `enterAudioFade`, applied to the shot being overlapped rather
 * than the one doing the overlapping — 1 down to 0 across its own final
 * `fadeFrames`, driven by `ResolvedShot.audioFadeOutFrames` rather than
 * anything the shot declared itself.
 */
export const exitAudioFade = (frame: number, durationInFrames: number, fadeFrames?: number): number => {
  if (!fadeFrames) return 1;
  const start = Math.max(0, durationInFrames - fadeFrames);
  return interpolate(frame, [start, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/**
 * Whether this shot's own captions/title/badge/ribbon should still be drawn,
 * given `ResolvedShot.overlayFadeOutFrames`.
 *
 * This is a hard cut, not a ramp, and that's deliberate rather than a
 * simplification. `exitAudioFade`'s interpolation always reaches 0 exactly at
 * `durationInFrames` — it cannot finish earlier, because that's what makes it
 * line up with the picture dissolve ending at the same instant. But the
 * incoming shot's own title starts rising from its first frame, at the same
 * instant this shot's overlap window begins. Any gradual fade on this side is
 * therefore guaranteed to overlap a rising fade on the other side — there is
 * no window length that avoids it, only different amounts of it. Cutting
 * instead of fading means the outgoing text is gone at the exact frame the
 * incoming text starts from zero, so there is never a frame where both are
 * legible. The picture keeps dissolving underneath regardless; only the text
 * needs this.
 */
export const exitOverlayVisible = (frame: number, durationInFrames: number, cutFrames?: number): boolean => {
  if (!cutFrames) return true;
  return frame < durationInFrames - cutFrames;
};
