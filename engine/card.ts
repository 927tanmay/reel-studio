import type { ReelSpec, Shot } from "./spec";

export type CardBox = { left: number; top: number; width: number; height: number };

/**
 * Where a floating card sits, from the look and the aspect of what it shows.
 * Width is the look's (or the shot's override), the height follows the
 * picture's own aspect, and a card too tall for the look's limit shrinks
 * proportionally rather than cropping — the whole picture is the point of
 * showing it as a card. Returns null when the look defines no card.
 *
 * Pure and shared by the renderer and `verify.ts`, so the size a zoom is
 * checked against is the size it is actually drawn at.
 */
export const cardBox = (spec: ReelSpec, shot: Shot, aspect: number): CardBox | null => {
  const style = spec.style.card;
  if (!style || !shot.card) return null;
  const over = typeof shot.card === "object" ? shot.card : {};

  const { w, h } = spec.frame;
  let width = (over.width ?? style.width) * w;
  let height = width / aspect;
  const limit = style.maxHeight * h;
  if (height > limit) {
    width *= limit / height;
    height = limit;
  }
  const centreY = (over.top ?? style.top) * h;
  return { left: (w - width) / 2, top: centreY - height / 2, width, height };
};

export type CardTilt = {
  x: number;
  y: number;
  perspective: number;
  /** Frames to come flat, or null if it never does. */
  settleFrames: number | null;
  parallax: number;
};

/**
 * A card's starting tilt: the look's, overridden by the shot, or null when the
 * card stays flat. The angle at any frame is this scaled by how far the card
 * has settled — `tiltAt` — kept separate so `verify.ts` can reason about when
 * the card is flat without drawing anything.
 */
export const cardTilt = (spec: ReelSpec, shot: Shot): CardTilt | null => {
  const style = spec.style.card?.tilt;
  if (!style || !shot.card) return null;
  const over = typeof shot.card === "object" ? shot.card.tilt : undefined;
  if (over === false) return null;
  return {
    x: over?.x ?? style.x,
    y: over?.y ?? style.y,
    perspective: style.perspective,
    settleFrames: style.settleFrames ?? null,
    parallax: style.parallax,
  };
};

/** The remaining turn, in degrees, at a shot-local frame. Reaches exactly 0 once settled. */
export const tiltAt = (tilt: CardTilt, frame: number): { x: number; y: number } => {
  if (tilt.settleFrames === null) return { x: tilt.x, y: tilt.y };
  const t = Math.min(1, Math.max(0, frame / Math.max(1, tilt.settleFrames)));
  const remaining = (1 - t) * (1 - t) * (1 - t); // an ease-out: fast at first, long gentle finish
  return { x: tilt.x * remaining, y: tilt.y * remaining };
};
