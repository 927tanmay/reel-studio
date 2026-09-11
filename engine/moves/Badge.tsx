import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReelSpec, Shot } from "../spec";
import { px } from "../scale";
import { textStyle, verticalPlacement } from "./text";

/** A small persistent label naming what is on screen. */
export const Badge: React.FC<{ spec: ReelSpec; badge: NonNullable<Shot["badge"]> }> = ({
  spec,
  badge,
}) => {
  const frame = useCurrentFrame();
  const style = spec.style.badge;

  const text = typeof badge === "string" ? badge : badge.text;
  const bottom = typeof badge === "string" ? style.bottom : (badge.bottom ?? style.bottom);

  const opacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        }}
      >
        <span
          style={{
            ...textStyle(spec.style, spec.frame, style),
            backgroundColor: style.plate.color,
            padding: `${px(spec.style, spec.frame, style.plate.padY)}px ${px(
              spec.style,
              spec.frame,
              style.plate.padX,
            )}px`,
            borderRadius: px(spec.style, spec.frame, style.plate.radius),
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
