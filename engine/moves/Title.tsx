import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReelSpec, Shot } from "../spec";
import { px } from "../scale";
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

  // The rule trails the text by a couple of frames and takes longer to land —
  // text arrives, then the mark sweeps in under it, rather than both hitting
  // at once and reading as a single blunt pop. Text never scales (rule 9);
  // this scales instead, because it's a graphic, not the words.
  const accent = style.accent;
  const accentDelay = 2;
  const accentFrames = enterFrames + 8;
  const accentT = accent
    ? ease((frame - accentDelay) / accentFrames, "easeOut")
    : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          ...verticalPlacement({ ...style, top }),
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity,
          transform: `translateY(${lift}px)`,
        }}
      >
        <h1 style={textStyle(spec.style, spec.frame, style)}>{text}</h1>
        {accent ? (
          <div
            style={{
              marginTop: px(spec.style, spec.frame, 14),
              width: accent.width * spec.frame.w,
              height: px(spec.style, spec.frame, accent.weight),
              backgroundColor: accent.color,
              borderRadius: px(spec.style, spec.frame, accent.weight),
              transform: `scaleX(${accentT})`,
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
