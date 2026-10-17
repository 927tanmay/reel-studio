import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { ReelSpec, Shot } from "../spec";
import { px } from "../scale";
import { textStyle } from "./text";
import { ease } from "./punch";

/**
 * Key words landing big in the middle of the frame.
 *
 * Every value here is a function of the frame. The size comes from the word's
 * own length: `fitText` finds the largest type that keeps the longest line
 * inside the look's width, capped at the look's `size` so a three-letter word
 * is big but not absurd. Type scales only while it arrives, and rests at
 * exactly 1 — no transform at all once landed — which is what keeps the glyph
 * edges sharp that rule 9 is protecting.
 */
export const Slams: React.FC<{ spec: ReelSpec; slams: NonNullable<Shot["slams"]> }> = ({ spec, slams }) => {
  if (!spec.style.slam) return null; // verify.ts reports it.
  return (
    <>
      {slams.map((slam, i) => (
        <OneSlam key={i} spec={spec} slam={slam} />
      ))}
    </>
  );
};

const OneSlam: React.FC<{ spec: ReelSpec; slam: NonNullable<Shot["slams"]>[number] }> = ({ spec, slam }) => {
  const frame = useCurrentFrame();
  const { fps } = spec.frame;
  const style = spec.style.slam!;

  const lines = slam.text.split("\n");
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");

  // Fitted once per word and look, not per frame: measuring text is the
  // expensive part and its answer does not change.
  const fontSize = useMemo(() => {
    const fitted = fitText({
      text: longest,
      withinWidth: style.width * spec.frame.w,
      fontFamily: style.fontFamily,
      fontWeight: style.weight,
      letterSpacing: style.tracking ? `${style.tracking}em` : undefined,
      textTransform: style.uppercase ? "uppercase" : "none",
    }).fontSize;
    return Math.min(px(spec.style, spec.frame, style.size), fitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [longest, spec.frame.w, style.width, style.fontFamily, style.weight, style.tracking, style.uppercase, style.size]);

  const start = Math.round((slam.at ?? 0) * fps);
  const local = frame - start;
  const hold = slam.hold !== undefined ? Math.round(slam.hold * fps) : style.holdFrames;
  const total = style.enterFrames + hold + style.exitFrames;
  if (local < 0 || local >= total) return null;

  // Arrival: larger and soft, snapping to size with a small bounce. easeOutBack
  // overshoots, so the scale dips just under 1 before it settles.
  const arrive = ease(local / Math.max(1, style.enterFrames), "easeOutBack");
  const arrived = Math.min(1, local / Math.max(1, style.enterFrames));
  let scale = style.enterScale + (1 - style.enterScale) * arrive;
  const blur = px(spec.style, spec.frame, style.enterBlur) * (1 - arrived);

  // Departure: a little bigger and gone, the opposite of arriving.
  const leaving = ease((local - style.enterFrames - hold) / Math.max(1, style.exitFrames), "easeIn");
  let opacity = Math.min(1, (local + 1) / 2);
  if (leaving > 0) {
    scale *= 1 + 0.06 * leaving;
    opacity *= 1 - leaving;
  }

  const resting = local >= style.enterFrames && leaving === 0;
  const colour = spec.style.palette[slam.color ?? ""] ?? slam.color ?? style.color;
  const centre = slam.centre ?? style.centre;

  const base = textStyle(spec.style, spec.frame, style);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {style.scrim ? (
        <AbsoluteFill
          style={{
            backgroundColor: style.scrim.color,
            opacity: style.scrim.opacity * arrived * (1 - leaving),
          }}
        />
      ) : null}
      {/* Centred without a transform: a box whose own centre is the target, so
          a word at rest has no translate to put its edges on a half pixel. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: `${centre * 2 * 100}%`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            ...base,
            fontSize,
            color: colour,
            maxWidth: undefined,
            whiteSpace: "pre",
            opacity,
            transform: resting ? undefined : `scale(${scale})`,
            filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
          }}
        >
          {slam.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
