import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";
import { currentStep } from "./index";

type DiagramSpec = Extract<GenSpec, { type: "diagram" }>;

/**
 * Nodes that assemble, with the frame panning between them.
 *
 * A full flow shrunk to fit a phone screen makes its labels illegible, so this
 * keeps a small window of nodes at readable size and moves across instead.
 */
export const Diagram: React.FC<GenProps<DiagramSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const tokens = reel.style;
  const P = tokens.palette;
  const g = tokens.generators?.textScale ?? 1;

  const column = spec.layout === "column";
  const windowSize = spec.window ?? (column ? 3 : 2);

  const cardW = column ? reel.frame.w * 0.76 : reel.frame.w * (0.78 / windowSize) * 1.15;
  const cardH = column ? reel.frame.h * (0.5 / windowSize) : reel.frame.h * 0.17 * g;
  const gap = column ? cardH * 0.42 : cardW * 0.3;

  const position = (i: number) => i * ((column ? cardH : cardW) + gap);
  const stripLength = position(Math.max(0, spec.nodes.length - 1));

  const steps = spec.steps ?? [];
  const stepIndex = steps.length > 0 ? currentStep(steps, seconds) : -1;
  const shown =
    stepIndex >= 0 ? new Set(steps[stepIndex].show) : new Set(spec.nodes.map((n) => n.id));

  // Centre on whatever the current step is showing.
  const shownIndexes = spec.nodes
    .map((n, i) => (shown.has(n.id) ? i : -1))
    .filter((i) => i >= 0);
  const wholeStrip = (spec.nodes.length - 1) / 2;
  const panning = spec.pan !== false;
  const focus =
    panning && shownIndexes.length > 0
      ? shownIndexes.reduce((a, b) => a + b, 0) / shownIndexes.length
      : wholeStrip;

  const glide = spring({
    frame: frame - (stepIndex >= 0 ? (steps[stepIndex].at ?? 0) * fps : 0),
    fps,
    config: { damping: 200, stiffness: 80 },
    durationInFrames: Math.round(fps * 0.9),
  });

  const previousFocus =
    panning && stepIndex > 0
      ? (() => {
          const prev = steps[stepIndex - 1].show;
          const idx = spec.nodes.map((n, i) => (prev.includes(n.id) ? i : -1)).filter((i) => i >= 0);
          return idx.length > 0 ? idx.reduce((a, b) => a + b, 0) / idx.length : focus;
        })()
      : focus;

  const eased = previousFocus + (focus - previousFocus) * glide;
  const offset = position(eased) - stripLength / 2;

  const strokeW = px(tokens, reel.frame, 3);

  return (
    <AbsoluteFill style={{ backgroundColor: tokens.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: column ? `translateY(${-offset}px)` : `translateX(${-offset}px)`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: column ? cardW : stripLength + cardW,
            height: column ? stripLength + cardH : cardH,
          }}
        >
          {(spec.edges ?? []).map((edge, i) => {
            const from = spec.nodes.findIndex((n) => n.id === edge.from);
            const to = spec.nodes.findIndex((n) => n.id === edge.to);
            if (from < 0 || to < 0) return null;
            const visible = shown.has(edge.from) && shown.has(edge.to);
            const a = position(from) + (column ? cardH : cardW);
            const len = position(to) - position(from) - (column ? cardH : cardW);

            return (
              <div
                key={`e${i}`}
                style={{
                  position: "absolute",
                  backgroundColor: P.chrome ?? "#555",
                  opacity: visible ? 1 : 0.15,
                  transition: "opacity 120ms",
                  ...(column
                    ? { left: cardW / 2 - strokeW / 2, top: a, width: strokeW, height: len }
                    : { top: cardH / 2 - strokeW / 2, left: a, height: strokeW, width: len }),
                }}
              />
            );
          })}

          {spec.nodes.map((node, i) => {
            const visible = shown.has(node.id);
            const appearAt = steps.find((s) => s.show.includes(node.id))?.at ?? 0;
            const rise = spring({
              frame: frame - appearAt * fps,
              fps,
              config: { damping: 200 },
              durationInFrames: Math.round(fps * 0.4),
            });

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  ...(column
                    ? { top: position(i), left: 0 }
                    : { left: position(i), top: 0 }),
                  width: cardW,
                  height: cardH,
                  borderRadius: px(tokens, reel.frame, 18),
                  border: `${strokeW}px solid ${node.color ?? P.chrome ?? "#555"}`,
                  backgroundColor: P.surface ?? "rgba(255,255,255,.04)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: px(tokens, reel.frame, 8),
                  padding: px(tokens, reel.frame, 20),
                  textAlign: "center",
                  opacity: visible ? interpolate(rise, [0, 1], [0, 1]) : 0.18,
                  transform: `translateY(${(1 - (visible ? rise : 1)) * cardH * 0.15}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: tokens.fonts.display,
                    fontWeight: 700,
                    fontSize: px(tokens, reel.frame, 44 * g),
                    color: node.color ?? tokens.title.color,
                    lineHeight: 1.1,
                  }}
                >
                  {node.label}
                </div>
                {node.sub ? (
                  <div
                    style={{
                      fontFamily: tokens.fonts.mono,
                      fontSize: px(tokens, reel.frame, 26 * g),
                      color: P.muted ?? "#9aa",
                    }}
                  >
                    {node.sub}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
