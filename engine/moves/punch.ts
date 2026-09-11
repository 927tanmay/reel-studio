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
