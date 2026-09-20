import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";

type CompareSpec = Extract<GenSpec, { type: "compare" }>;

/** Two states, stacked, with the second wiping in on a beat. */
export const Compare: React.FC<GenProps<CompareSpec>> = ({ spec, reel, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const P = tokens.palette;
  const g = tokens.generators?.textScale ?? 1;

  const wipeFrame = (spec.wipeAt ?? durationInFrames / fps / 2) * fps;
  const wipe = interpolate(frame, [wipeFrame, wipeFrame + fps * 0.35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panel = (
    side: CompareSpec["left"],
    accent: string,
    opacity: number,
  ) => (
    <div
      style={{
        flex: "none",
        display: "flex",
        flexDirection: "column",
        gap: px(tokens, reel.frame, 18),
        padding: px(tokens, reel.frame, 44),
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: tokens.fonts.display,
          fontWeight: 700,
          fontSize: px(tokens, reel.frame, 46 * g),
          color: accent,
        }}
      >
        {side.title}
      </div>
      {side.body.map((item, i) => (
        <div
          key={i}
          style={{
            fontFamily: tokens.fonts.mono,
            fontSize: px(tokens, reel.frame, 30 * g),
            color: P.muted ?? "#9aa4ae",
            lineHeight: 1.4,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.bg,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "stretch",
        // The lower third belongs to the badge (and captions), so the two
        // states are centred in the space above it rather than in the frame.
        paddingBottom: reel.frame.h * (tokens.badge.bottom ?? 0),
      }}
    >
      {panel(spec.left, P.muted ?? "#9aa4ae", 1 - wipe * 0.5)}

      <div
        style={{
          height: px(tokens, reel.frame, 3),
          backgroundColor: P.chrome ?? "#3a4450",
          width: `${wipe * 100}%`,
          flex: "none",
          marginLeft: px(tokens, reel.frame, 44),
        }}
      />

      <div
        style={{
          opacity: wipe,
          transform: `translateY(${(1 - wipe) * px(tokens, reel.frame, 40)}px)`,
        }}
      >
        {panel(spec.right, P.accent ?? "#4FD1C5", 1)}
      </div>
    </AbsoluteFill>
  );
};
