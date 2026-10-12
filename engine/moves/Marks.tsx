import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Box,
  Bracket,
  Circle,
  CrossedOff,
  Highlight,
  StrikeThrough,
  Underline,
} from "@remotion/rough-notation";
import type { Mark, ReelSpec, Shot } from "../spec";
import { px } from "../scale";
import { ease } from "./punch";

/**
 * Hand-drawn annotations over the picture. Each stroke is a pure function of
 * the frame: `progress` runs 0..1 as it draws on, and the wobble is seeded, so
 * it is identical on every render and in every parallel worker — which is the
 * whole reason this is not a live drawing library.
 *
 * The seed stays fixed across frames on purpose. Changing it every frame makes
 * a stroke "boil" like a cartoon outline; a held mark should sit still.
 */
export const Marks: React.FC<{ spec: ReelSpec; marks: NonNullable<Shot["marks"]> }> = ({
  spec,
  marks,
}) => {
  const style = spec.style.marks;
  if (!style) return null; // verify.ts reports it; render nothing rather than guess a look.

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {marks.map((mark, i) => (
        <OneMark key={i} spec={spec} mark={mark} index={i} />
      ))}
    </AbsoluteFill>
  );
};

const OneMark: React.FC<{ spec: ReelSpec; mark: Mark; index: number }> = ({ spec, mark, index }) => {
  const frame = useCurrentFrame();
  const { fps, w, h } = spec.frame;
  const style = spec.style.marks!;

  const start = Math.round((mark.at ?? 0) * fps);
  const local = frame - start;
  if (local < 0) return null;

  const drawFrames = mark.frames ?? style.frames;
  const progress = ease(local / Math.max(1, drawFrames), "easeOut");

  // Hold is counted from when the stroke finishes drawing, then it fades.
  let opacity = 1;
  if (mark.hold !== undefined) {
    const fadeStart = drawFrames + Math.round(mark.hold * fps);
    opacity = interpolate(local, [fadeStart, fadeStart + style.fadeFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (opacity <= 0) return null;
  }

  const named = (c: string) => spec.style.palette[c] ?? c;
  const stroke = named(mark.color ?? style.color);
  const strokeWidth = px(spec.style, spec.frame, style.strokeWidth);
  const gap = px(spec.style, spec.frame, style.padding);
  const padding = { left: gap, right: gap, top: gap, bottom: gap };
  // A mark with no colour of its own gets the translucent marker for a
  // highlight; one that names a colour gets exactly that colour, nothing
  // second-guessed about its alpha.
  const fill = mark.color ? stroke : style.highlightColor;

  const common = {
    progress,
    seed: (mark.seed ?? 1) + index,
    roughness: style.roughness,
    bowing: style.bowing,
  };

  // The library measures a shrink-to-fit inline-block around its child, so a
  // percentage size would resolve to nothing and the stroke would silently not
  // draw. The region has to be spelled out in pixels.
  const inner = <div style={{ width: mark.region.w * w, height: mark.region.h * h }} />;

  const drawn = (() => {
    switch (mark.kind) {
      case "circle":
        return (
          <Circle {...common} color={stroke} strokeWidth={strokeWidth} padding={padding}>
            {inner}
          </Circle>
        );
      case "underline":
        return (
          <Underline {...common} color={stroke} strokeWidth={strokeWidth} padding={{ top: gap }}>
            {inner}
          </Underline>
        );
      case "box":
        return (
          <Box {...common} color={stroke} strokeWidth={strokeWidth} padding={padding}>
            {inner}
          </Box>
        );
      case "highlight":
        return (
          <Highlight {...common} color={fill} padding={padding}>
            {inner}
          </Highlight>
        );
      case "bracket":
        return (
          <Bracket {...common} color={stroke} strokeWidth={strokeWidth} padding={padding}>
            {inner}
          </Bracket>
        );
      case "strike":
        return (
          <StrikeThrough {...common} color={stroke} strokeWidth={strokeWidth}>
            {inner}
          </StrikeThrough>
        );
      case "cross":
        return (
          <CrossedOff {...common} color={stroke} strokeWidth={strokeWidth}>
            {inner}
          </CrossedOff>
        );
    }
  })();

  return (
    <div
      style={{
        position: "absolute",
        left: mark.region.x * w,
        top: mark.region.y * h,
        opacity,
      }}
    >
      {drawn}
    </div>
  );
};
