import React from "react";
import type { CSSProperties } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { ReelSpec } from "../spec";
import { px } from "../scale";

/**
 * A corner mark present for the whole reel — a logo, a channel bug — not
 * tied to any shot. Reads `spec.style.watermark`; a look with none of this
 * renders nothing, at no cost.
 */
export const Watermark: React.FC<{ spec: ReelSpec }> = ({ spec }) => {
  const wm = spec.style.watermark;
  if (!wm) return null;

  const width = px(spec.style, spec.frame, wm.width);
  const margin = px(spec.style, spec.frame, wm.margin);

  const style: CSSProperties = {
    position: "absolute",
    width,
    height: "auto",
    opacity: wm.opacity ?? 0.85,
  };
  if (wm.corner.startsWith("top")) style.top = margin;
  else style.bottom = margin;
  if (wm.corner.endsWith("left")) style.left = margin;
  else style.right = margin;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Img src={staticFile(wm.src)} style={style} />
    </AbsoluteFill>
  );
};
