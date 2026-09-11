import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReelSpec, Shot } from "../spec";
import { textStyle, verticalPlacement } from "./text";
import { ease } from "./punch";

/** Authored text, as opposed to captions, which come from speech. */
export const Title: React.FC<{ spec: ReelSpec; title: NonNullable<Shot["title"]> }> = ({
  spec,
  title,
}) => {
  const frame = useCurrentFrame();
  const style = spec.style.title;

  const text = typeof title === "string" ? title : title.text;
  const enterFrames = typeof title === "string" ? 6 : (title.enterFrames ?? 6);
  const top = typeof title === "string" ? style.top : (title.top ?? style.top);

  const t = enterFrames > 0 ? ease(frame / enterFrames, "easeOut") : 1;
  const opacity = interpolate(t, [0, 1], [0, 1]);
  const lift = (1 - t) * spec.frame.h * 0.012;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          ...verticalPlacement({ ...style, top }),
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity,
          transform: `translateY(${lift}px)`,
        }}
      >
        <h1 style={textStyle(spec.style, spec.frame, style)}>{text}</h1>
      </div>
    </AbsoluteFill>
  );
};
