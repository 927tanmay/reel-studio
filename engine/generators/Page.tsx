import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import { ease } from "../moves/punch";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type PageSpec = Extract<GenSpec, { type: "page" }>;

/**
 * A web page with text you cannot see, and a scan that finds it.
 *
 * The page body is drawn twice with identical layout. The first layer is what a
 * visitor sees: the visible paragraphs, and the hidden sentence at a contrast
 * so low it vanishes. The second is the reveal: the same layout with only the
 * hidden sentence visible, in the warning colour, clipped to the part of the
 * page the scan has already passed. Clipping rather than measuring means the
 * reveal needs no knowledge of where the hidden text landed, and it stays
 * exactly aligned with the faint copy underneath it.
 */
export const Page: React.FC<GenProps<PageSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const P = tokens.palette;
  const g = tokens.generators?.textScale ?? 1;
  const u = (n: number) => px(tokens, reel.frame, n * g);
  const warn = P.warn ?? "#F97583";
  const accent = P.accent ?? "#4FD1C5";
  const ink = tokens.title.color;

  const start = (spec.at ?? 0.5) * fps;
  const sweep = Math.max(1, (spec.sweep ?? 1.6) * fps);
  const p = ease((frame - start) / sweep, "easeInOut");
  const scanning = frame >= start && p < 1;

  const hiddenAfter = Math.min(spec.hiddenAfter ?? spec.lines.length - 1, spec.lines.length - 1);

  const body = (layer: "base" | "reveal") => (
    <div style={{ display: "flex", flexDirection: "column", gap: u(22) }}>
      {spec.title ? (
        <div
          style={{
            fontFamily: tokens.fonts.display,
            fontSize: u(46),
            fontWeight: 800,
            color: ink,
            lineHeight: 1.15,
            visibility: layer === "reveal" ? "hidden" : "visible",
          }}
        >
          {spec.title}
        </div>
      ) : null}
      {spec.lines.flatMap((line, i) => {
        const parts = [
          <div
            key={`l${i}`}
            style={{
              fontFamily: tokens.fonts.display,
              fontSize: u(32),
              lineHeight: 1.45,
              color: ink,
              opacity: 0.82,
              visibility: layer === "reveal" ? "hidden" : "visible",
            }}
          >
            {line}
          </div>,
        ];
        if (i === hiddenAfter) {
          parts.push(
            <div
              key="hidden"
              style={
                layer === "base"
                  ? { fontFamily: tokens.fonts.display, fontSize: u(32), lineHeight: 1.45, color: ink, opacity: 0.03 }
                  : {
                      fontFamily: tokens.fonts.display,
                      fontSize: u(32),
                      lineHeight: 1.45,
                      color: warn,
                      fontWeight: 700,
                      backgroundColor: "rgba(249,117,131,0.14)",
                      borderLeft: `${u(6)}px solid ${warn}`,
                      padding: `${u(6)}px ${u(14)}px`,
                      margin: `0 ${u(-14)}px`,
                    }
              }
            >
              {spec.hidden}
            </div>,
          );
        }
        return parts;
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <div
        style={{
          position: "absolute",
          left: reel.frame.w * 0.06,
          right: reel.frame.w * 0.06,
          top: reel.frame.h * 0.17,
          borderRadius: u(22),
          overflow: "hidden",
          border: `${u(2)}px solid ${P.chrome ?? "#3E6E6A"}`,
          backgroundColor: P.surface ?? "rgba(255,255,255,0.05)",
        }}
      >
        {/* Browser chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: u(10), padding: `${u(16)}px ${u(22)}px`, borderBottom: `${u(2)}px solid ${P.chrome ?? "#3E6E6A"}` }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: u(16), height: u(16), borderRadius: "50%", backgroundColor: P.muted ?? "#8A959F", opacity: 0.5 }} />
          ))}
          <div
            style={{
              marginLeft: u(14),
              flex: 1,
              fontFamily: tokens.fonts.mono,
              fontSize: u(24),
              color: P.muted ?? "#8A959F",
              backgroundColor: tokens.bg,
              borderRadius: u(10),
              padding: `${u(8)}px ${u(16)}px`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {spec.url}
          </div>
        </div>

        {/* Page body, drawn twice with the same layout */}
        <div style={{ position: "relative", padding: `${u(34)}px ${u(34)}px ${u(40)}px` }}>
          {body("base")}
          <div style={{ position: "absolute", inset: 0, padding: `${u(34)}px ${u(34)}px ${u(40)}px`, clipPath: `inset(0 0 ${(1 - p) * 100}% 0)` }}>
            {body("reveal")}
          </div>
          {scanning ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${p * 100}%`,
                height: u(4),
                backgroundColor: accent,
                boxShadow: `0 0 ${u(26)}px ${u(6)}px ${accent}`,
                opacity: 0.9,
              }}
            />
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
