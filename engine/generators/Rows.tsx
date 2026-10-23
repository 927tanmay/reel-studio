import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import { ease } from "../moves/punch";
import { rowStarts } from "../rows";
import { resolveColour } from "../backdrop";
import { StaticIcon } from "./StaticIcon";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type RowsSpec = Extract<GenSpec, { type: "rows" }>;

/** A hex colour with an alpha, falling back to a translucent white for anything else. */
const tint = (colour: string, alpha: number) =>
  /^#[0-9a-fA-F]{6}$/.test(colour) ? `${colour}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : `rgba(255,255,255,${alpha})`;

/**
 * Rows that arrive one by one. A row's state is a function of the frame: it
 * slides up and fades in from its start, and nothing about it depends on the
 * rows around it, so re-timing one never moves another.
 */
export const Rows: React.FC<GenProps<RowsSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const style = tokens.rows;
  if (!style) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const P = tokens.palette;
  const u = (n: number) => px(tokens, reel.frame, n);
  const tones = tokens.scene?.tones ?? {};
  const tone = (name?: string) => (name ? (tones[name] ?? P[name] ?? name) : resolveColour("accent", P, accent));
  const ok = tones.ok ?? "#4ADE80";
  const warn = tones.warn ?? P.warn ?? "#F97583";

  const statusNode = (status: NonNullable<RowsSpec["rows"][number]["status"]>) => {
    const icon = status === "check" ? "check" : status === "warn" ? "warning" : status === "error" ? "cross" : "clock";
    const colour = status === "check" ? ok : status === "pending" ? (P.muted ?? "#8A959F") : warn;
    return <StaticIcon name={icon} size={u(40)} colour={colour} stroke={4} />;
  };

  const starts = rowStarts(spec.rows, style.stagger);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <div
        style={{
          position: "absolute",
          top: `${style.top * 100}%`,
          left: (reel.frame.w * (1 - style.width)) / 2,
          width: reel.frame.w * style.width,
          display: "flex",
          flexDirection: "column",
          gap: u(style.gap),
        }}
      >
        {spec.frame ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: u(12),
              padding: `${u(12)}px ${u(20)}px`,
              borderRadius: u(style.radius),
              backgroundColor: P.surface ?? "rgba(255,255,255,0.05)",
              border: `${u(2)}px solid ${P.chrome ?? "#3E6E6A"}`,
            }}
          >
            {["#F97583", "#C9A227", "#4ADE80"].map((c) => (
              <div key={c} style={{ width: u(14), height: u(14), borderRadius: "50%", backgroundColor: c, opacity: 0.8 }} />
            ))}
            <div style={{ flex: 1, marginLeft: u(8), fontFamily: tokens.fonts.mono, fontSize: u(23), color: P.muted ?? "#8A959F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {spec.frame.url}
            </div>
            {spec.frame.badge ? (
              <div style={{ width: u(34), height: u(34), borderRadius: u(9), backgroundColor: tone(), color: tokens.bg, display: "grid", placeItems: "center", fontFamily: tokens.fonts.display, fontWeight: 800, fontSize: u(22) }}>
                {spec.frame.badge}
              </div>
            ) : null}
          </div>
        ) : null}

        {spec.rows.map((row, i) => {
          const start = Math.round(starts[i] * fps);
          const arrive = ease((frame - start) / Math.max(1, style.enterFrames), "easeOut");
          if (arrive <= 0) return null;
          const colour = tone(row.tone);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: u(22),
                padding: `${u(18)}px ${u(22)}px`,
                borderRadius: u(style.radius),
                backgroundColor: tint(colour, 0.08),
                border: `${u(2)}px solid ${tint(colour, 0.45)}`,
                opacity: arrive,
                transform: `translateY(${(1 - arrive) * u(26)}px)`,
              }}
            >
              {row.icon ? (
                <div
                  style={{
                    width: u(style.tile),
                    height: u(style.tile),
                    borderRadius: u(style.radius * 0.6),
                    backgroundColor: tint(colour, 0.2),
                    display: "grid",
                    placeItems: "center",
                    flex: "none",
                  }}
                >
                  <StaticIcon name={row.icon} size={u(style.tile * 0.58)} colour={colour} stroke={3.4} />
                </div>
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: tokens.fonts.display, fontWeight: 700, fontSize: u(style.titleSize), color: tokens.title.color, lineHeight: 1.15 }}>
                  {row.title}
                </div>
                {row.sub ? (
                  <div
                    style={{
                      fontFamily: tokens.fonts.mono,
                      fontSize: u(style.subSize),
                      color: row.status === "error" || row.status === "warn" ? warn : (P.muted ?? "#8A959F"),
                      marginTop: u(4),
                    }}
                  >
                    {row.sub}
                  </div>
                ) : null}
              </div>
              {row.status ? statusNode(row.status) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
