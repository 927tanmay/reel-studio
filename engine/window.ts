import type { Frame } from "./spec";
import type { Tokens } from "./tokens";

/**
 * Where a screenshot sits in its browser window, in frame pixels.
 *
 * The picture is laid at the window's width, so its height follows its own
 * aspect. A short one makes a short window; one taller than the look allows
 * (a full-page capture of an article) makes a window of the maximum height and
 * leaves `range` pixels of picture below the fold, to be scrolled through.
 * Nothing is ever shrunk to fit — a tall page shrunk to the frame would be
 * unreadable, which is the whole reason to scroll it instead.
 *
 * Pure, and shared by the renderer and `verify.ts`.
 */
export type WindowLayout = {
  /** The whole window, bar included. */
  box: { left: number; top: number; width: number; height: number };
  /** Height of the bar, 0 when the window has none. */
  bar: number;
  /** The visible area below the bar. */
  viewport: { left: number; top: number; width: number; height: number };
  /** The picture's full size at this width (taller than the viewport when it scrolls). */
  image: { width: number; height: number };
  /** Pixels of picture hidden below the viewport: how far there is to scroll. 0 for a short picture. */
  range: number;
};

export const windowLayout = (
  frame: Frame,
  tokens: Pick<Tokens, "window" | "designWidth">,
  aspect: number,
  withBar = true,
): WindowLayout | null => {
  const style = tokens.window;
  if (!style || !(aspect > 0)) return null;

  const scale = frame.w / tokens.designWidth;
  const width = style.width * frame.w;
  const bar = withBar ? style.bar.height * scale : 0;
  const imageHeight = width / aspect;
  const room = Math.max(1, style.maxHeight * frame.h - bar);
  const visible = Math.min(imageHeight, room);
  const height = bar + visible;
  const left = (frame.w - width) / 2;
  const top = style.top * frame.h - height / 2;

  return {
    box: { left, top, width, height },
    bar,
    viewport: { left, top: top + bar, width, height: visible },
    image: { width, height: imageHeight },
    range: Math.max(0, imageHeight - visible),
  };
};

/**
 * How far the picture has scrolled, in pixels, `t` of the way (0..1, already
 * eased) through a shot. `from` and `to` are fractions of `range`.
 */
export const scrollOffset = (layout: WindowLayout, scroll: { from?: number; to?: number } | undefined, t: number): number => {
  if (layout.range <= 0) return 0;
  const from = clamp01(scroll?.from ?? 0);
  const to = clamp01(scroll?.to ?? 1);
  return (from + (to - from) * clamp01(t)) * layout.range;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
