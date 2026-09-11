import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";

type CalloutSpec = Extract<GenSpec, { type: "callout" }>;

/**
 * Attention on one part of a busy still. Everything outside the focus dims, so
 * the detail you are describing becomes the only readable thing on screen.
 *
 * `focus` is in the image's own pixels, same as every other rectangle here.
 */
export const Callout: React.FC<GenProps<CalloutSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const P = tokens.palette;

  const t = interpolate(frame, [0, Math.round(fps * 0.4)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dim = (spec.dim ?? 0.72) * t;
  const accent = P.accent ?? "#4FD1C5";
  const border = px(tokens, reel.frame, 4);

  return (
    <AbsoluteFill style={{ backgroundColor: tokens.bg, overflow: "hidden" }}>
      <Img
        src={staticFile(spec.image)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />

      <div
        style={{
          position: "absolute",
          left: spec.focus.x,
          top: spec.focus.y,
          width: spec.focus.w,
          height: spec.focus.h,
          border: `${border}px solid ${accent}`,
          borderRadius: px(tokens, reel.frame, 10),
          boxShadow: `0 0 0 9999px rgba(0,0,0,${dim * 0.45})`,
          opacity: t,
        }}
      />

      {spec.label ? (
        <div
          style={{
            position: "absolute",
            left: spec.focus.x,
            top: spec.focus.y + spec.focus.h + px(tokens, reel.frame, 14),
            fontFamily: tokens.fonts.mono,
            fontSize: px(tokens, reel.frame, 30),
            color: accent,
            opacity: t,
          }}
        >
          {spec.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
