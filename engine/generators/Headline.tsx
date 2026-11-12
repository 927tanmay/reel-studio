import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { Marked, Mark, arrive, BlockFrame, blockKit } from "./blockKit";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type HeadlineSpec = Extract<GenSpec, { type: "headline" }>;

/**
 * A news story as a card. The masthead line is small and set apart, the
 * headline is the largest type on it, and the highlighter does the pointing —
 * a reader on a phone should get the claim from the marked words alone.
 */
export const Headline: React.FC<GenProps<HeadlineSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const kit = blockKit(tokens, reel.frame, accent, spec.theme);
  if (!kit) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.
  const { u, style, ink } = kit;
  const font = tokens.fonts.display;
  const start = Math.round((spec.at ?? 0) * fps);
  const landed = start + style.enterFrames;
  const marked = (text: string) => (
    <Marked text={text} highlights={spec.highlights} frame={frame} fps={fps} defaultFrame={landed + 6} kit={kit} palette={tokens.palette} />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <BlockFrame kit={kit} frame={reel.frame}>
        <div style={{ ...kit.card, ...arrive(frame, start, kit), padding: u(44), display: "flex", flexDirection: "column", gap: u(24) }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: u(14),
              paddingBottom: u(18),
              borderBottom: `${u(1.5)}px solid ${kit.rule}`,
              fontFamily: font,
              fontSize: u(style.sizes.meta),
              color: ink.muted,
            }}
          >
            {spec.logo ? <Mark src={spec.logo} height={u(44)} /> : null}
            <span style={{ fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: ink.text }}>{spec.publication}</span>
            <span style={{ flex: 1 }} />
            {spec.date ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{spec.date}</span> : null}
          </div>
          {spec.kicker ? (
            <div
              style={{
                alignSelf: "flex-start",
                padding: `${u(6)}px ${u(14)}px`,
                borderRadius: u(8),
                backgroundColor: kit.accent,
                color: kit.onAccent,
                fontFamily: font,
                fontWeight: 800,
                fontSize: u(style.sizes.meta * 0.85),
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {spec.kicker}
            </div>
          ) : null}
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: u(style.sizes.headline), lineHeight: 1.12, letterSpacing: "-0.015em", color: ink.text }}>
            {marked(spec.title)}
          </div>
          {spec.dek ? (
            <div style={{ fontFamily: font, fontSize: u(style.sizes.dek), lineHeight: 1.4, color: ink.muted }}>{marked(spec.dek)}</div>
          ) : null}
          {spec.image ? (
            <Img src={staticFile(spec.image)} style={{ width: "100%", height: u(400), objectFit: "cover", borderRadius: u(18), display: "block" }} />
          ) : null}
          {spec.byline ? <div style={{ fontFamily: font, fontSize: u(style.sizes.meta), color: ink.muted }}>{spec.byline}</div> : null}
        </div>
      </BlockFrame>
    </AbsoluteFill>
  );
};
