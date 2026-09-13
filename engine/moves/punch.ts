import { Easing as RemotionEasing, interpolate } from "remotion";
import type { Easing, Enter, Exit } from "../spec";

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

  const distance = enter.direction === "left" || enter.direction === "right" ? frameW : frameH;
  // "left" reads as "the new shot arrives moving left" — so it enters from
  // the right (a positive starting offset that eases down to zero).
  const sign = enter.direction === "left" || enter.direction === "up" ? 1 : -1;

  const t = interpolate(frame, [0, enter.frames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: curve(enter.easing),
  });

  const offset = sign * distance * t;
  const horizontal = enter.direction === "left" || enter.direction === "right";
  return horizontal ? { x: offset, y: 0 } : { x: 0, y: offset };
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
