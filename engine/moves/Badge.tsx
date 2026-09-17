import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReelSpec, Shot } from "../spec";
import { px } from "../scale";
import { textStyle, verticalPlacement } from "./text";
import { ease } from "./punch";

/** A small persistent label naming what is on screen. */
export const Badge: React.FC<{ spec: ReelSpec; badge: NonNullable<Shot["badge"]> }> = ({
  spec,
  badge,
}) => {
  const frame = useCurrentFrame();
  const style = spec.style.badge;

  const text = typeof badge === "string" ? badge : badge.text;
  const bottom = typeof badge === "string" ? style.bottom : (badge.bottom ?? style.bottom);

  const enterFrames = 6;
  const opacity = interpolate(frame, [0, enterFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // A small rise-in to match Title's — a badge that just appears reads as a
  // label; one that settles into place reads as a graphic.
  const lift = (1 - opacity) * spec.frame.h * 0.008;

  // Same accent-sweep timing as Title: the mark trails the text in by a
  // couple of frames rather than arriving with it, so it reads as landing
  // after the text rather than as one flat pop.
  const accent = style.accent;
  const accentDelay = 2;
  const accentFrames = enterFrames + 8;
  const accentT = accent ? ease((frame - accentDelay) / accentFrames, "easeOut") : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          ...verticalPlacement({ ...style, bottom }),
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity,
          transform: `translateY(${lift}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: style.plate.color,
            padding: `${px(spec.style, spec.frame, style.plate.padY)}px ${px(
              spec.style,
              spec.frame,
              style.plate.padX,
            )}px`,
            borderRadius: px(spec.style, spec.frame, style.plate.radius),
          }}
        >
          <span style={textStyle(spec.style, spec.frame, style)}>{text}</span>
          {accent ? (
            <div
              style={{
                marginTop: px(spec.style, spec.frame, 10),
                width: "55%",
                height: px(spec.style, spec.frame, accent.weight),
                backgroundColor: accent.color,
                borderRadius: px(spec.style, spec.frame, accent.weight),
                transform: `scaleX(${accentT})`,
              }}
            />
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
