import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { GenSpec } from "../spec";
import { compactNumber, countValue, formatFigure, progress } from "../blocks";
import { arrive, blockFrame, blockKit } from "./blockKit";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type StatSpec = Extract<GenSpec, { type: "stat" }>;

/**
 * One number, as big as the frame allows. The size is fitted once to the
 * *final* figure, so the type does not change size as the count climbs; digits
 * are tabular, so the number does not shimmy sideways either.
 */
export const Stat: React.FC<GenProps<StatSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const kit = blockKit(tokens, reel.frame, accent);
  const write = (n: number) => `${spec.prefix ?? ""}${spec.compact ? compactNumber(n) : formatFigure(n, spec.decimals ?? 0)}${spec.suffix ?? ""}`;
  const final = write(spec.value);
  const font = tokens.fonts.display;

  const fontSize = useMemo(() => {
    if (!kit) return 0;
    const fitted = fitText({ text: final, withinWidth: reel.frame.w * kit.style.width, fontFamily: font, fontWeight: 800 }).fontSize;
    return Math.min(kit.u(kit.style.sizes.stat), fitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final, reel.frame.w, font, kit?.style.width, kit?.style.sizes.stat]);

  if (!kit) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.
  const { u, style, ink } = kit;
  const start = Math.round((spec.at ?? 0.2) * fps);
  const p = progress(frame, start, style.countFrames);
  const shown = write(countValue(spec.from ?? 0, spec.value, p, spec.decimals ?? 0));
  const landed = start + style.countFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <div style={{ ...blockFrame(kit, reel.frame), display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: u(18) }}>
        <div
          style={{
            ...arrive(frame, Math.max(0, start - style.enterFrames), kit),
            fontFamily: font,
            fontWeight: 800,
            fontSize,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
            color: kit.accent,
            whiteSpace: "nowrap",
          }}
        >
          {shown}
        </div>
        <div style={{ ...arrive(frame, start, kit), fontFamily: font, fontWeight: 700, fontSize: u(style.sizes.label), color: ink.text, lineHeight: 1.2 }}>
          {spec.label}
        </div>
        {spec.context ? (
          <div style={{ ...arrive(frame, start + 4, kit), fontFamily: tokens.fonts.mono, fontSize: u(style.sizes.meta), color: ink.muted }}>{spec.context}</div>
        ) : null}
        {spec.delta ? (
          <div
            style={{
              ...arrive(frame, landed, kit),
              display: "flex",
              alignItems: "center",
              gap: u(10),
              marginTop: u(8),
              padding: `${u(8)}px ${u(18)}px`,
              borderRadius: u(40),
              border: `${u(2)}px solid ${spec.delta.direction === "up" ? style.up : style.down}`,
              color: spec.delta.direction === "up" ? style.up : style.down,
              fontFamily: font,
              fontWeight: 700,
              fontSize: u(style.sizes.meta),
            }}
          >
            <svg width={u(20)} height={u(20)} viewBox="0 0 20 20">
              <path d={spec.delta.direction === "up" ? "M10 3 L18 16 L2 16 Z" : "M10 17 L18 4 L2 4 Z"} fill="currentColor" />
            </svg>
            {spec.delta.text}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
