import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { arrivals, progress } from "../blocks";
import { resolveColour } from "../backdrop";
import { arrive, BlockFrame, blockKit } from "./blockKit";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type TimelineSpec = Extract<GenSpec, { type: "timeline" }>;

/**
 * Dated events down a line. Each event owns the stretch of line below its dot,
 * which draws itself down when the *next* event arrives — so the line always
 * ends at the newest event, and no measuring of where the dots landed is needed.
 */
export const Timeline: React.FC<GenProps<TimelineSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const kit = blockKit(tokens, reel.frame, accent);
  if (!kit) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.
  const { u, style, ink } = kit;
  const font = tokens.fonts.display;
  const tones = tokens.scene?.tones ?? {};
  const toneOf = (t?: string) => (t ? (tones[t] ?? resolveColour(t, tokens.palette, accent)) : kit.accent);

  const starts = arrivals(spec.events, style.stagger).map((s) => Math.round(s * fps));
  const dot = u(26);
  const line = u(4);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <BlockFrame kit={kit} frame={reel.frame} style={{ display: "flex", flexDirection: "column" }}>
        {spec.events.map((event, i) => {
          const colour = toneOf(event.tone);
          const next = starts[i + 1];
          const drawn = next === undefined ? 0 : progress(frame, next - Math.round(style.enterFrames / 2), style.enterFrames);
          return (
            <div key={i} style={{ display: "flex", gap: u(30) }}>
              <div style={{ width: dot, flex: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: dot,
                    height: dot,
                    marginTop: u(10),
                    borderRadius: "50%",
                    backgroundColor: colour,
                    boxShadow: `0 0 ${u(18)}px ${colour}`,
                    transform: `scale(${progress(frame, starts[i], style.enterFrames)})`,
                    flex: "none",
                  }}
                />
                {next !== undefined ? (
                  <div
                    style={{
                      width: line,
                      flex: 1,
                      marginTop: u(6),
                      borderRadius: line,
                      backgroundColor: ink.muted,
                      opacity: 0.55,
                      transform: `scaleY(${drawn})`,
                      transformOrigin: "top",
                    }}
                  />
                ) : null}
              </div>
              <div style={{ ...arrive(frame, starts[i], kit), flex: 1, minWidth: 0, paddingBottom: next === undefined ? 0 : u(38), display: "flex", flexDirection: "column", gap: u(6) }}>
                <div style={{ fontFamily: tokens.fonts.mono, fontSize: u(style.sizes.meta), color: event.tone ? colour : ink.muted, letterSpacing: "0.04em" }}>{event.date}</div>
                <div style={{ fontFamily: font, fontWeight: 700, fontSize: u(style.sizes.event), lineHeight: 1.2, color: ink.text }}>{event.title}</div>
                {event.sub ? <div style={{ fontFamily: font, fontSize: u(style.sizes.meta), lineHeight: 1.35, color: ink.muted }}>{event.sub}</div> : null}
              </div>
            </div>
          );
        })}
      </BlockFrame>
    </AbsoluteFill>
  );
};
