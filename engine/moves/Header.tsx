import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Header as HeaderSpec, ReelSpec, Shot } from "../spec";
import { px } from "../scale";
import { ease } from "./punch";
import { resolveColour } from "../backdrop";
import { caretOn, dashStates, subtitleAt } from "../header";

/**
 * A section header: a small label, a big title, a line that can change.
 *
 * It sits where a title does (the top, clear of the platform interface) and is
 * the same role — a shot carries a header or a title, not both. The label is
 * either a pill with progress dashes ("TOOL 02 ▬▬▬") or a monospace comment
 * with a blinking caret ("// how TLS works"). When a section spans several
 * shots, the later ones set `continued` so the header does not re-enter on every
 * cut and the viewer's eye stays on the content changing below it.
 */
export const Header: React.FC<{ spec: ReelSpec; header: HeaderSpec; shot: Shot }> = ({ spec, header, shot }) => {
  const frame = useCurrentFrame();
  const { fps } = spec.frame;
  const style = spec.style.header;
  if (!style) return null; // verify.ts says why.

  const tokens = spec.style;
  const P = tokens.palette;
  const u = (n: number) => px(tokens, spec.frame, n);
  const accent = resolveColour("accent", P, shot.accent);
  const muted = P.muted ?? "#8A959F";

  const arrive = header.continued ? 1 : ease(frame / Math.max(1, style.enterFrames), "easeOut");
  const sub = subtitleAt(header.subtitle, frame / fps, style.swapFrames / fps);

  const kickerStyle = header.kickerStyle ?? (header.step ? "pill" : "comment");
  const kicker = header.kicker ?? "";

  const kickerNode =
    kickerStyle === "pill" ? (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: u(14),
          padding: `${u(8)}px ${u(20)}px`,
          borderRadius: 999,
          backgroundColor: P.surface ?? "rgba(255,255,255,0.06)",
          border: `${u(2)}px solid ${P.chrome ?? "#3E6E6A"}`,
          fontFamily: tokens.fonts.mono,
          fontSize: u(style.kickerSize),
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        <span>{kicker}</span>
        {header.step ? (
          <span style={{ display: "inline-flex", gap: u(style.dash.gap) }}>
            {dashStates(header.step).map((on, i) => (
              <span
                key={i}
                style={{
                  width: u(style.dash.width),
                  height: u(style.dash.height),
                  borderRadius: u(style.dash.height),
                  backgroundColor: on ? accent : muted,
                  opacity: on ? 1 : 0.35,
                }}
              />
            ))}
          </span>
        ) : null}
      </div>
    ) : (
      <div style={{ fontFamily: tokens.fonts.mono, fontSize: u(style.kickerSize), color: muted, display: "inline-flex", alignItems: "center" }}>
        {kicker.startsWith("//") ? (
          <>
            <span style={{ color: accent }}>//</span>
            <span style={{ whiteSpace: "pre" }}>{kicker.slice(2)}</span>
          </>
        ) : (
          <span style={{ whiteSpace: "pre" }}>{kicker}</span>
        )}
        <span
          style={{
            display: "inline-block",
            width: "0.55em",
            height: "1.05em",
            marginLeft: "0.3em",
            backgroundColor: tokens.title.color,
            opacity: caretOn(frame, style.caretBlinkFrames) ? 0.9 : 0,
          }}
        />
      </div>
    );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: `${style.top * 100}%`,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: u(style.gap),
          opacity: arrive,
          transform: `translateY(${(1 - arrive) * u(14)}px)`,
          textAlign: "center",
          padding: `0 ${u(48)}px`,
        }}
      >
        {header.kicker ? kickerNode : null}
        {header.title ? (
          <div
            style={{
              fontFamily: tokens.title.fontFamily,
              fontSize: u(style.titleSize),
              fontWeight: style.titleWeight,
              letterSpacing: style.tracking ? `${style.tracking}em` : undefined,
              lineHeight: 1.08,
              color: tokens.title.color,
              textShadow: "0 2px 18px rgba(0,0,0,0.5)",
            }}
          >
            {header.title}
          </div>
        ) : null}
        {sub ? (
          // Both lines share one grid cell, so a swap never moves what is below.
          <div style={{ display: "grid", justifyItems: "center" }}>
            {sub.previous !== null && sub.swap < 1 ? (
              <div
                style={{
                  gridArea: "1 / 1",
                  fontFamily: tokens.title.fontFamily,
                  fontSize: u(style.subtitleSize),
                  fontWeight: 600,
                  color: muted,
                  opacity: 1 - sub.swap,
                  transform: `translateY(${-sub.swap * u(10)}px)`,
                }}
              >
                {sub.previous}
              </div>
            ) : null}
            <div
              style={{
                gridArea: "1 / 1",
                fontFamily: tokens.title.fontFamily,
                fontSize: u(style.subtitleSize),
                fontWeight: 600,
                color: muted,
                opacity: sub.swap,
                transform: `translateY(${(1 - sub.swap) * u(10)}px)`,
              }}
            >
              {sub.text}
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
