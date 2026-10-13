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
