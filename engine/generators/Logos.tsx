import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { arrivals, logoColumns, monogram, progress } from "../blocks";
import { arrive, BlockFrame, blockKit } from "./blockKit";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type LogosSpec = Extract<GenSpec, { type: "logos" }>;

/** Frames a focus change takes to light one tile and dim the rest. */
const FOCUS_FRAMES = 8;

/**
 * A wall of logos. Each tile lands on its word; a `focus` step then lights one
 * and dims the rest, easing between steps so one tile hands over to the next
 * rather than snapping. Every tile's space is held from the start, so the wall
 * never re-flows as it fills.
 */
export const Logos: React.FC<GenProps<LogosSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const kit = blockKit(tokens, reel.frame, accent);
  if (!kit) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.
  const { u, style, ink } = kit;
  const font = tokens.fonts.display;

  const columns = logoColumns(spec.items.length, spec.columns);
  const starts = arrivals(spec.items, style.stagger).map((s) => Math.round(s * fps));
  const showNames = spec.names !== false;

  // Which step of focus is current, and how far into it; the step before it, to ease from.
  const steps = [...(spec.focus ?? [])].sort((a, b) => a.at - b.at);
  const seconds = frame / fps;
  let current = -1;
  steps.forEach((s, i) => {
    if (s.at <= seconds) current = i;
  });
  const lit = (step: number, name: string) => (step < 0 || !steps[step].name ? 1 : steps[step].name === name ? 1 : 0);
  const stepP = current < 0 ? 1 : progress(frame, Math.round(steps[current].at * fps), FOCUS_FRAMES);
  const level = (name: string) => {
    const from = lit(current - 1, name);
    const to = lit(current, name);
    return from + (to - from) * stepP;
  };
  const focused = (name: string) => current >= 0 && steps[current].name === name;

  const tile = (reel.frame.w * style.width - u(28) * (columns - 1)) / columns;
  const logoSize = Math.min(u(style.sizes.logo), tile * 0.62);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <BlockFrame kit={kit} frame={reel.frame} style={{ display: "flex", flexDirection: "column", gap: u(30) }}>
        {spec.title ? (
          <div
            style={{
              ...arrive(frame, 0, kit),
              textAlign: "center",
              fontFamily: tokens.fonts.mono,
              fontSize: u(style.sizes.meta),
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ink.muted,
            }}
          >
            {spec.title}
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: u(28) }}>
          {spec.items.map((item, i) => {
            const on = level(item.name);
            const hot = focused(item.name);
            return (
              <div key={i} style={{ ...arrive(frame, starts[i], kit) }}>
                <div
                  style={{
                    ...kit.card,
                    ...(hot ? { borderColor: kit.accent } : {}),
                    opacity: 0.28 + 0.72 * on,
                    transform: hot ? `scale(${1 + 0.05 * stepP})` : undefined,
                    aspectRatio: "1",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: u(16),
                    padding: u(18),
                    boxSizing: "border-box",
                  }}
                >
                  {item.src ? (
                    spec.plates ? (
                      <div
                        style={{
                          width: logoSize,
                          height: logoSize,
                          borderRadius: u(28),
                          backgroundColor: style.light.card,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Img src={staticFile(item.src)} style={{ width: logoSize * 0.68, height: logoSize * 0.68, objectFit: "contain" }} />
                      </div>
                    ) : (
                      <Img src={staticFile(item.src)} style={{ width: logoSize, height: logoSize, objectFit: "contain" }} />
                    )
                  ) : (
                    <div
                      style={{
                        width: logoSize,
                        height: logoSize,
                        borderRadius: u(24),
                        display: "grid",
                        placeItems: "center",
                        backgroundColor: kit.accent,
                        color: kit.onAccent,
                        fontFamily: font,
                        fontWeight: 800,
                        fontSize: logoSize * 0.38,
                      }}
                    >
                      {monogram(item.name)}
                    </div>
                  )}
                  {showNames ? (
                    <div
                      style={{
                        fontFamily: font,
                        fontWeight: 700,
                        fontSize: u(style.sizes.meta),
                        color: ink.text,
                        textAlign: "center",
                        maxWidth: "100%",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.name}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </BlockFrame>
    </AbsoluteFill>
  );
};
