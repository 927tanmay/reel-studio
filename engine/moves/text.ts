import type { CSSProperties } from "react";
import type { Frame } from "../spec";
import type { TextStyle, Tokens } from "../tokens";
import { px } from "../scale";

/** Turns a look's text tokens into CSS at the current frame size. */
export const textStyle = (
  tokens: Tokens,
  frame: Frame,
  style: TextStyle,
): CSSProperties => {
  const size = px(tokens, frame, style.size);

  return {
    fontFamily: style.fontFamily,
    fontSize: size,
    fontWeight: style.weight,
    color: style.color,
    letterSpacing: style.tracking ? `${style.tracking}em` : undefined,
    lineHeight: style.lineHeight ?? 1.1,
    textAlign: style.textAlign ?? "center",
    maxWidth: `${(style.maxWidth ?? 0.85) * 100}%`,
    textTransform: style.uppercase ? "uppercase" : undefined,
    textShadow: style.shadow
      ? `${px(tokens, frame, style.shadow.x ?? 0)}px ${px(tokens, frame, style.shadow.y ?? 0)}px ${px(
          tokens,
          frame,
          style.shadow.blur,
        )}px ${style.shadow.color}`
      : undefined,
    margin: 0,
    whiteSpace: "pre-wrap",
  };
};

/**
 * Where a block sits vertically, expressed as a fraction of frame height.
 * `top` measures from the top edge, `bottom` from the bottom.
 */
export const verticalPlacement = (style: TextStyle): CSSProperties => {
  if (style.bottom !== undefined) {
    return { bottom: `${style.bottom * 100}%`, top: "auto" };
  }
  return { top: `${(style.top ?? 0.3) * 100}%`, bottom: "auto" };
};
