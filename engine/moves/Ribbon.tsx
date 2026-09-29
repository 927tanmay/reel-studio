import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import type { ReelSpec, Shot } from "../spec";
import { px } from "../scale";
import { textStyle } from "./text";
import { surfaceStyle } from "./surface";

/**
 * A banner that arrives.
 *
 * `Title` fades type in where it already sits; this travels in from an edge,
 * overshoots, settles, and draws its accent rule as it lands. That difference
 * — motion that resolves, rather than opacity that ramps — is the whole reason
 * it exists as its own move rather than another title variant.
 *
 * Everything visual comes from `tokens.ribbon`, including the spring. What the
 * shot supplies is the copy and the timing.
 */
export const Ribbon: React.FC<{ spec: ReelSpec; ribbon: NonNullable<Shot["ribbon"]> }> = ({
  spec,
  ribbon,
}) => {
  const frame = useCurrentFrame();
  const { fps } = spec.frame;
  const style = spec.style.ribbon;

  const startFrame = Math.round((ribbon.at ?? 0) * fps);
  const local = frame - startFrame;
  if (local < 0) return null;

  const fromTop = (ribbon.from ?? "top") === "top";
  const inFrames = ribbon.frames ?? style.frames;

  const arrive = spring({
    frame: local,
    fps,
    config: style.spring,
    durationInFrames: inFrames,
  });

  // Flying back out is the same spring played against a second clock, so the
  // exit carries the same weight as the entrance instead of snapping off.
  const leaveAt = ribbon.hold === undefined ? null : Math.round(ribbon.hold * fps) + inFrames;
  const leave =
    leaveAt === null
      ? 0
      : spring({
          frame: local - leaveAt,
          fps,
          config: style.spring,
          durationInFrames: inFrames,
        });

  const settled = arrive - leave;
  if (leaveAt !== null && local > leaveAt + inFrames * 2) return null;

  // Travel is measured from the frame edge, so a ribbon starts genuinely
  // off-screen rather than at some inset that happens to look off-screen.
  const offset = ribbon.offset ?? (fromTop ? style.top : style.bottom) ?? 0.12;
  const travel = spec.frame.h * (offset + 0.2);
  const shift = (1 - settled) * travel * (fromTop ? -1 : 1);

  // The rule draws only once the plate is most of the way home; starting it
  // earlier reads as two things moving at once rather than one landing.
  const rule = interpolate(settled, [0.6, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const base = textStyle(spec.style, spec.frame, style);
  const pad = `${px(spec.style, spec.frame, style.plate.padY)}px ${px(
    spec.style,
    spec.frame,
    style.plate.padX,
  )}px`;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          ...(fromTop ? { top: `${offset * 100}%` } : { bottom: `${offset * 100}%` }),
          width: "100%",
          display: "flex",
          justifyContent: "center",
          transform: `translateY(${shift}px)`,
          opacity: interpolate(settled, [0, 0.25], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            ...surfaceStyle(spec.style, spec.frame, style.plate),
            padding: pad,
            borderRadius: px(spec.style, spec.frame, style.plate.radius),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: px(spec.style, spec.frame, 6),
            // The width limit belongs on the plate, where the percentage
            // resolves against the frame. Left on the text it resolves
            // against this box instead, which is itself sized by that text —
            // circular, and it wraps a three-word banner onto two lines.
            maxWidth: `${(style.maxWidth ?? 0.8) * 100}%`,
          }}
        >
          <span style={{ ...base, margin: 0, maxWidth: "none", whiteSpace: "nowrap" }}>
            {ribbon.text}
          </span>

          <div
            style={{
              height: px(spec.style, spec.frame, style.accent.weight),
              width: `${rule * 100}%`,
              minWidth: rule > 0 ? px(spec.style, spec.frame, style.accent.inset) : 0,
              backgroundColor: style.accent.color,
              borderRadius: px(spec.style, spec.frame, style.accent.weight),
            }}
          />

          {ribbon.sub ? (
            <span
              style={{
                ...base,
                margin: 0,
                maxWidth: "none",
                whiteSpace: "nowrap",
                color: style.sub.color,
                fontSize: px(spec.style, spec.frame, style.sub.size),
                fontWeight: style.sub.weight,
                letterSpacing: style.sub.tracking ? `${style.sub.tracking}em` : undefined,
                opacity: rule,
              }}
            >
              {ribbon.sub}
            </span>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
