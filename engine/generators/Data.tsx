import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";

type DataSpec = Extract<GenSpec, { type: "data" }>;

/**
 * A number that moves. On a small screen a figure that lands reads instantly
 * where a static chart does not.
 */
export const Data: React.FC<GenProps<DataSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const P = tokens.palette;
  const bars = spec.style === "bars";
  const max = Math.max(...spec.items.map((i) => i.value), 1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.bg,
        justifyContent: "center",
        gap: px(tokens, reel.frame, bars ? 34 : 64),
        padding: px(tokens, reel.frame, 60),
      }}
    >
      {spec.items.map((item, i) => {
        const grow = spring({
          frame: frame - i * Math.round(fps * 0.18),
          fps,
          config: { damping: 200, stiffness: 90 },
          durationInFrames: Math.round(fps * 0.9),
        });
        const shown = Math.round(item.value * grow);
        const color = item.color ?? P.accent ?? "#4FD1C5";

        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: px(tokens, reel.frame, 12) }}>
            <div
              style={{
                fontFamily: tokens.fonts.display,
                fontWeight: 700,
                fontSize: px(tokens, reel.frame, bars ? 54 : 132),
                color,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {shown.toLocaleString()}
              {item.suffix ?? ""}
            </div>

            {bars ? (
              <div
                style={{
                  height: px(tokens, reel.frame, 18),
                  borderRadius: px(tokens, reel.frame, 9),
                  backgroundColor: P.surface ?? "rgba(255,255,255,.07)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(item.value / max) * grow * 100}%`,
                    height: "100%",
                    backgroundColor: color,
                  }}
                />
              </div>
            ) : null}

            <div
              style={{
                fontFamily: tokens.fonts.mono,
                fontSize: px(tokens, reel.frame, 30),
                color: P.muted ?? "#9aa4ae",
                letterSpacing: "0.04em",
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
