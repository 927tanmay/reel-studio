import type { SceneItem, SceneLink, SceneNote } from "./spec";

/**
 * The arithmetic of a scene, apart from drawing it, so the renderer and the
 * checks agree on what is on screen and where.
 */

/** 0..1: how visible an item is — drawing in after `at`, fading out after `until`. */
export const presence = (
  frame: number,
  fps: number,
  at: number | undefined,
  until: number | undefined,
  inFrames: number,
  outFrames = 6,
): number => {
  const start = Math.round((at ?? 0) * fps);
  const enter = Math.min(1, Math.max(0, (frame - start) / Math.max(1, inFrames)));
  if (until === undefined) return enter;
  const end = Math.round(until * fps);
  const leave = Math.min(1, Math.max(0, (frame - end) / Math.max(1, outFrames)));
  return enter * (1 - leave);
};

/**
 * Where a link runs: centre to centre, trimmed at each end so it stops at the
 * glyphs' edges instead of running under them. `pad` is the trim in the same
 * units as the points.
 */
export const linkEnds = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  pad: number,
): { x1: number; y1: number; x2: number; y2: number; length: number } => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length <= pad * 2) return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, length: 0 };
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: a.x + ux * pad,
    y1: a.y + uy * pad,
    x2: b.x - ux * pad,
    y2: b.y - uy * pad,
    length: length - pad * 2,
  };
};

/** The part of a note typed so far, by the clock: all of it when it isn't typed. */
export const typedText = (note: SceneNote, seconds: number): string => {
  if (!note.typeSpeed || note.typeSpeed <= 0) return note.text;
  const chars = Math.floor(Math.max(0, seconds - note.at) * note.typeSpeed);
  return note.text.slice(0, chars);
};

/** Every id a scene's links and notes refer to that no item defines. */
export const missingRefs = (items: SceneItem[], links: SceneLink[], notes: SceneNote[]): string[] => {
  const ids = new Set(items.map((i) => i.id));
  const out: string[] = [];
  for (const l of links) {
    if (!ids.has(l.from)) out.push(l.from);
    if (!ids.has(l.to)) out.push(l.to);
  }
  for (const n of notes) if (n.near && !ids.has(n.near)) out.push(n.near);
  return out;
};
