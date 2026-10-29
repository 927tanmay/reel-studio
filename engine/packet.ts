import type { Travel } from "./spec";

/**
 * A dot riding an arrow between two nodes — the data going somewhere.
 *
 * Pure arithmetic on the frame, so the renderer and the checks agree on where
 * the dot is and when it exists. `p` is how far along the arrow it has got,
 * eased so it leaves and arrives gently rather than at a constant speed (a
 * constant-speed dot reads as a progress bar, not a thing being sent).
 */
export type PacketState = {
  /** 0 at the first node's edge, 1 at the second's. */
  progress: number;
  /** Fades in over the first frames and out over the last. */
  opacity: number;
  /** Frames since it set off, for a trail. */
  local: number;
  frames: number;
};

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export const travelFrames = (travel: Travel, fps: number, defaultSeconds: number): number =>
  Math.max(1, Math.round((travel.seconds ?? defaultSeconds) * fps));

/** The dot's state at a frame, or null when it is not on screen. */
export const packetAt = (
  frame: number,
  fps: number,
  travel: Travel,
  defaultSeconds: number,
  fadeFrames: number,
): PacketState | null => {
  const start = Math.round(travel.at * fps);
  const frames = travelFrames(travel, fps, defaultSeconds);
  const local = frame - start;
  if (local < 0 || local > frames) return null;

  const t = Math.min(1, Math.max(0, local / frames));
  const fadeIn = Math.min(1, (local + 1) / Math.max(1, fadeFrames));
  const fadeOut = Math.min(1, (frames - local + 1) / Math.max(1, fadeFrames));
  return { progress: easeInOut(t), opacity: Math.min(fadeIn, fadeOut), local, frames };
};

/** How far along a link a dot is, counted from the end it set off from: a `back` trip rides to → from. */
export const alongLink = (progress: number, back?: boolean): number => (back ? 1 - progress : progress);
