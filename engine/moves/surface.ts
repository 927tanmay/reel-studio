import type { CSSProperties } from "react";
import type { Frame } from "../spec";
import type { PanelStyle, Surface, Tokens } from "../tokens";
import { px } from "../scale";

/**
 * Turns a `Surface` into CSS. `color` always applies — it is the base layer
 * a gradient paints over and glass tints, not an alternative to either, so a
 * card with only `color` set (every plate before this existed) renders
 * exactly as it always has.
 */
export const surfaceStyle = (tokens: Tokens, frame: Frame, surface: Surface): CSSProperties => {
  const style: CSSProperties = { backgroundColor: surface.color };

  if (surface.gradient) {
    const stops = surface.gradient.stops
      .map((s) => `${s.color} ${s.at * 100}%`)
      .join(", ");
    // Paints over backgroundColor, which stays as the fallback if this
    // ever fails to parse — never the reverse.
    style.backgroundImage = `linear-gradient(${surface.gradient.angle}deg, ${stops})`;
  }

  if (surface.glass) {
    // A tint is what makes blur read as *glass* rather than as the
    // background simply being out of focus — without one, a transparent
    // blur over a flat background looks identical to no blur at all.
    if (surface.glass.tint) style.backgroundColor = surface.glass.tint;
    const blurPx = px(tokens, frame, surface.glass.blur);
    style.backdropFilter = `blur(${blurPx}px)`;
    style.WebkitBackdropFilter = `blur(${blurPx}px)`;
    if (surface.glass.borderColor) {
      style.border = `${px(tokens, frame, 1.5)}px solid ${surface.glass.borderColor}`;
    }
  }

  if (surface.border && !surface.glass?.borderColor) {
    style.border = `${px(tokens, frame, 1.5)}px solid ${surface.border}`;
  }

  // One box-shadow list, so a glow, a top highlight and a drop shadow can sit
  // on the same card instead of the last one set winning.
  const shadows: string[] = [];
  if (surface.glow) {
    const radiusPx = px(tokens, frame, surface.glow.radius);
    const spreadPx = surface.glow.spread ? `${px(tokens, frame, surface.glow.spread)}px ` : "";
    shadows.push(`0 0 ${radiusPx}px ${spreadPx}${surface.glow.color}`);
  }
  if (surface.specular) shadows.push(`inset 0 ${px(tokens, frame, 1.5)}px 0 0 ${surface.specular}`);
  if (surface.shadow) {
    const s = surface.shadow;
    shadows.push(
      `0 ${px(tokens, frame, s.y)}px ${px(tokens, frame, s.blur)}px ${s.spread ? `${px(tokens, frame, s.spread)}px ` : ""}${s.color}`,
    );
  }
  if (shadows.length > 0) style.boxShadow = shadows.join(", ");

  return style;
};

/**
 * The look's elevated card, as CSS, or undefined when the look has none — so a
 * generator can write `...panelStyle(...)` and keep its own card otherwise.
 * `hot` is the highlighted card; `edge` replaces the hairline (a node's own colour).
 */
export const panelStyle = (
  tokens: Tokens,
  frame: Frame,
  opts: { hot?: boolean; edge?: string } = {},
): CSSProperties | undefined => {
  const panel: PanelStyle | undefined = tokens.panel;
  if (!panel) return undefined;
  const u = (n: number) => px(tokens, frame, n);
  const style: CSSProperties = {
    backgroundColor: opts.hot ? panel.hot : panel.color,
    border: `${u(1.5)}px solid ${opts.edge ?? panel.border}`,
    borderRadius: u(panel.radius),
    boxShadow: [
      `inset 0 ${u(1.5)}px 0 0 ${panel.specular}`,
      `0 ${u(panel.shadow.y)}px ${u(panel.shadow.blur)}px ${panel.shadow.spread ? `${u(panel.shadow.spread)}px ` : ""}${panel.shadow.color}`,
    ].join(", "),
  };
  if (panel.blur) {
    style.backdropFilter = `blur(${u(panel.blur)}px)`;
    style.WebkitBackdropFilter = `blur(${u(panel.blur)}px)`;
  }
  return style;
};

/** Every `shadow` on a `TextStyle` layer, applied as one `text-shadow` list. */
export const textShadow = (
  tokens: Tokens,
  frame: Frame,
  shadow: { color: string; blur: number; x?: number; y?: number } | { color: string; blur: number; x?: number; y?: number }[] | null | undefined,
): string | undefined => {
  if (!shadow) return undefined;
  const layers = Array.isArray(shadow) ? shadow : [shadow];
  if (layers.length === 0) return undefined;
  return layers
    .map(
      (l) =>
        `${px(tokens, frame, l.x ?? 0)}px ${px(tokens, frame, l.y ?? 0)}px ${px(tokens, frame, l.blur)}px ${l.color}`,
    )
    .join(", ");
};
