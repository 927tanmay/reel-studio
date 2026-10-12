import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { Pointer as PointerSpec, ReelSpec } from "../spec";
import { px } from "../scale";
import { ease } from "./punch";

/**
 * A pointer, click rings and an optional spotlight. Every position is a pure
 * function of the frame: the pointer glides between waypoints on an ease, the
 * rings expand by frames since their click, and the spotlight's strength is a
 * ramp around it — nothing is stateful, so any frame renders alone.
 */
export const Pointer: React.FC<{ spec: ReelSpec; pointer: PointerSpec }> = ({ spec, pointer }) => {
  const frame = useCurrentFrame();
  const { fps, w, h } = spec.frame;
  const style = spec.style.pointer;
  if (!style || pointer.path.length === 0) return null; // verify.ts reports a missing look.

  const color = spec.style.palette[style.color] ?? style.color;
  const size = (n: number) => px(spec.style, spec.frame, n);
  const path = [...pointer.path].sort((a, b) => a.at - b.at);
  const at = (p: { at: number }) => Math.round(p.at * fps);

  // Where the pointer is now: held on the first waypoint until it arrives,
  // gliding between waypoints, held on the last.
  const position = (): { x: number; y: number } => {
    if (frame <= at(path[0])) return path[0];
    for (let i = 1; i < path.length; i++) {
      if (frame <= at(path[i])) {
        const from = path[i - 1];
        const to = path[i];
        const t = ease((frame - at(from)) / Math.max(1, at(to) - at(from)), "easeInOut");
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      }
    }
    return path[path.length - 1];
  };

  const firstFrame = at(path[0]);
  const lastFrame = at(path[path.length - 1]);
  const clicks = path.filter((p) => p.click);

  // --- Spotlight: the strongest of any click's ramp --------------------------
  let spot: { x: number; y: number; strength: number } | null = null;
  if (pointer.spotlight) {
    for (const c of clicks) {
      const start = at(c) - style.spotlightFrames;
      const end = at(c) + style.rippleFrames;
      const strength = interpolate(
        frame,
        [start, start + style.spotlightFrames, end, end + style.spotlightFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      if (strength > (spot?.strength ?? 0)) spot = { x: c.x, y: c.y, strength };
    }
  }

  // --- Arrow -----------------------------------------------------------------
  const arrowOpacity = interpolate(
    frame,
    [firstFrame, firstFrame + style.fadeFrames, lastFrame + style.lingerFrames, lastFrame + style.lingerFrames + style.fadeFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // A click presses the arrow in for a few frames and lets it back out.
  const press = clicks.reduce((m, c) => {
    const local = frame - at(c);
    return local >= 0 && local < 6 ? Math.max(m, 1 - Math.abs(local - 2) / 4) : m;
  }, 0);
  const pos = position();
  const arrowH = size(style.arrowSize);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {spot ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${spot.x * w}px ${spot.y * h}px, rgba(0,0,0,0) ${size(
              style.spotlightRadius,
            )}px, rgba(0,0,0,${style.dim * spot.strength}) ${size(style.spotlightRadius) * 1.7}px)`,
          }}
        />
      ) : null}

      {clicks.map((c, i) => {
        const local = frame - at(c);
        if (local < 0 || local >= style.rippleFrames) return null;
        // Two rings, the second trailing the first, so a click reads as a
        // pulse instead of a single flash.
        return [0, 4].map((delay) => {
          const t = ease((local - delay) / style.rippleFrames, "easeOut");
          if (local < delay) return null;
          const r = size(style.ringRadius) * (0.4 + 1.2 * t);
          return (
            <div
              key={`${i}-${delay}`}
              style={{
                position: "absolute",
                left: c.x * w - r,
                top: c.y * h - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                border: `${size(style.ringWidth)}px solid ${color}`,
                opacity: 1 - t,
              }}
            />
          );
        });
      })}

      {pointer.arrow ? (
        <svg
          width={arrowH * 0.65}
          height={arrowH}
          viewBox="0 0 13 20"
          style={{
            position: "absolute",
            left: pos.x * w,
            top: pos.y * h,
            opacity: arrowOpacity,
            transform: `scale(${1 - 0.14 * press})`,
            transformOrigin: "0 0",
            overflow: "visible",
            filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.45))",
          }}
        >
          <path
            d="M0 0 L0 17 L4.5 13 L7.5 20 L10 19 L7 12 L13 12 Z"
            fill="#FFFFFF"
            stroke="#000000"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
