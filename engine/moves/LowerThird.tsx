import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReelSpec, Shot } from "../spec";
import { px } from "../scale";
import { textStyle } from "./text";
import { surfaceStyle } from "./surface";
import { ease } from "./punch";

/**
 * Who is on screen — a name, optionally a role, left-aligned near the safe
 * margin with an accent bar on its own leading edge. Quieter than `Ribbon`
 * on purpose: a slide-up and a fade rather than a spring overshoot, because
 * identifying a speaker should read as information arriving, not an event.
 *
 * Shares the badge's zone in the frame — a shot carrying both is a
 * `verify.ts` fail, the same reasoning as captions-plus-badge.
 */
export const LowerThird: React.FC<{ spec: ReelSpec; lowerThird: NonNullable<Shot["lowerThird"]> }> = ({
  spec,
  lowerThird,
}) => {
  const frame = useCurrentFrame();
  const { fps } = spec.frame;
  const style = spec.style.lowerThird;

  const startFrame = Math.round((lowerThird.at ?? 0) * fps);
  const local = frame - startFrame;
  if (local < 0) return null;

  const inFrames = lowerThird.frames ?? style.frames;
  const arrive = ease(Math.min(1, local / inFrames), "easeOut");

  const leaveAt = lowerThird.hold === undefined ? null : Math.round(lowerThird.hold * fps) + inFrames;
  const leave = leaveAt === null ? 0 : ease(Math.min(1, Math.max(0, local - leaveAt) / inFrames), "easeIn");
  if (leaveAt !== null && local > leaveAt + inFrames) return null;

  const settled = arrive - leave;
  const shift = (1 - settled) * px(spec.style, spec.frame, 40);

  const base = textStyle(spec.style, spec.frame, style);
  const bottom = style.bottom ?? 0.27;
  const left = px(spec.style, spec.frame, 48);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          bottom: `${bottom * 100}%`,
          left,
          display: "flex",
          alignItems: "stretch",
          opacity: interpolate(settled, [0, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          transform: `translateY(${shift}px)`,
        }}
      >
        <div
          style={{
            width: px(spec.style, spec.frame, style.accent.weight),
            backgroundColor: style.accent.color,
            borderRadius: px(spec.style, spec.frame, style.accent.weight / 2),
            marginRight: px(spec.style, spec.frame, 14),
            flexShrink: 0,
          }}
        />
        <div
          style={{
            ...surfaceStyle(spec.style, spec.frame, style.plate),
            padding: `${px(spec.style, spec.frame, style.plate.padY)}px ${px(
              spec.style,
              spec.frame,
              style.plate.padX,
            )}px`,
            borderRadius: px(spec.style, spec.frame, style.plate.radius),
            display: "flex",
            flexDirection: "column",
            gap: px(spec.style, spec.frame, 2),
          }}
        >
          <span style={{ ...base, margin: 0, maxWidth: "none", whiteSpace: "nowrap", textAlign: "left" }}>
            {lowerThird.name}
          </span>
          {lowerThird.role ? (
            <span
              style={{
                ...base,
                margin: 0,
                maxWidth: "none",
                whiteSpace: "nowrap",
                textAlign: "left",
                color: style.sub.color,
                fontSize: px(spec.style, spec.frame, style.sub.size),
                fontWeight: style.sub.weight,
                letterSpacing: style.sub.tracking ? `${style.sub.tracking}em` : undefined,
              }}
            >
              {lowerThird.role}
            </span>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
