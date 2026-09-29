import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { DiagramNode, Frame, GenSpec } from "../spec";
import type { Tokens } from "../tokens";
import { px } from "../scale";
import type { GenProps } from "./index";
import { currentStep } from "./index";

type DiagramSpec = Extract<GenSpec, { type: "diagram" }>;

/**
 * The mockups and icons a node's `visual` can draw, in place of a third line
 * of text, or a custom image when `visual` is `{ src }`. Plain line-art in
 * the accent colour so it reads as the same kind of mark as the card's own
 * border and edges, not a second illustration style. Every size below is a
 * `px()` call, so it scales with `textScale` and the frame the same way the
 * label text next to it does.
 */
const NodeVisual: React.FC<{
  variant: NonNullable<DiagramNode["visual"]>;
  frame: number;
  tokens: Tokens;
  frameSize: Frame;
  scale: number;
}> = ({ variant, frame, tokens, frameSize, scale }) => {
  const P = tokens.palette;
  const accent = P.accent ?? "#4FD1C5";
  const u = (n: number) => px(tokens, frameSize, n * scale);

  if (typeof variant === "object") {
    // A custom mark — a logo, a brand icon — drawn at the same footprint the
    // built-in icons use, so swapping between them moves nothing else.
    const size = u(52);
    return <Img src={staticFile(variant.src)} style={{ width: size, height: size, objectFit: "contain" }} />;
  }

  // The general icon set: single-colour line-art, one viewBox size and
  // stroke weight shared across all eight, so none of them reads heavier or
  // lighter than the rest sitting in the same row of nodes.
  const ICON_STROKE = 3.6;
  const iconSvg = (children: React.ReactNode, viewBox = "0 0 48 48") => (
    <svg width={u(44)} height={u(44)} viewBox={viewBox}>
      <g
        fill="none"
        stroke={accent}
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </svg>
  );

  switch (variant) {
    case "check":
      return iconSvg(<path d="M10 25 L19 34 L38 13" />);
    case "cross":
      return iconSvg(
        <>
          <path d="M12 12 L36 36" />
          <path d="M36 12 L12 36" />
        </>,
      );
    case "arrow-right":
      return iconSvg(
        <>
          <path d="M8 24 L40 24" />
          <path d="M27 11 L40 24 L27 37" />
        </>,
      );
    case "star":
      return iconSvg(
        <path d="M24 5 L29.5 18 L43 19.5 L33 29 L36 43 L24 36 L12 43 L15 29 L5 19.5 L18.5 18 Z" strokeLinejoin="round" />,
      );
    case "lock":
      return iconSvg(
        <>
          <rect x="10" y="21" width="28" height="20" rx="4" />
          <path d="M15 21 V14 a9 9 0 0 1 18 0 V21" />
        </>,
      );
    case "warning":
      return iconSvg(
        <>
          <path d="M24 6 L44 40 L4 40 Z" strokeLinejoin="round" />
          <path d="M24 19 V29" />
          <circle cx="24" cy="34.5" r="0.6" fill={accent} />
        </>,
      );
    case "info":
      return iconSvg(
        <>
          <circle cx="24" cy="24" r="18" />
          <path d="M24 22 V33" />
          <circle cx="24" cy="14.5" r="0.6" fill={accent} />
        </>,
      );
    case "trend-up":
      return iconSvg(
        <>
          <path d="M6 34 L18 22 L26 28 L42 10" />
          <path d="M30 10 L42 10 L42 22" />
        </>,
      );
  }

  if (variant === "button" || variant === "debounce") {
    const active = variant === "debounce";
    return (
      <div style={{ position: "relative", width: u(100), height: u(56), display: "flex", alignItems: "center", justifyContent: "center" }}>
        {active &&
          [0, 0.34, 0.67].map((offset) => {
            const p = ((frame / 30 + offset) % 1) * 1; // one ripple every ~1s, staggered
            return (
              <div
                key={offset}
                style={{
                  position: "absolute",
                  width: u(72 + p * 40),
                  height: u(32 + p * 18),
                  borderRadius: u(8),
                  border: `${u(2)}px solid ${accent}`,
                  opacity: (1 - p) * 0.7,
                }}
              />
            );
          })}
        <div
          style={{
            width: u(72),
            height: u(32),
            borderRadius: u(6),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? accent : "rgba(255,255,255,0.10)",
            border: active ? "none" : `${u(1.5)}px solid rgba(255,255,255,0.2)`,
          }}
        >
          <span
            style={{
              fontFamily: tokens.fonts.display,
              fontWeight: 700,
              fontSize: u(18),
              color: active ? tokens.bg : "rgba(255,255,255,0.45)",
            }}
          >
            Pay
          </span>
        </div>
      </div>
    );
  }

  if (variant === "spinner") {
    const angle = (frame * 9) % 360;
    const size = u(44);
    return (
      <svg width={size} height={size} viewBox="0 0 44 44" style={{ transform: `rotate(${angle}deg)` }}>
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
        <path d="M22 4 A18 18 0 0 1 40 22" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === "checkout") {
    return (
      <svg width={u(76)} height={u(52)} viewBox="0 0 76 52">
        <rect x="2" y="2" width="72" height="48" rx="8" fill="none" stroke={accent} strokeWidth="3" />
        <rect x="2" y="15" width="72" height="10" fill={accent} opacity="0.5" />
        <circle cx="16" cy="38" r="4" fill={accent} />
        <circle cx="28" cy="38" r="4" fill={accent} opacity="0.5" />
      </svg>
    );
  }

  if (variant === "receipt") {
    return (
      <svg width={u(52)} height={u(58)} viewBox="0 0 52 58">
        <path
          d="M6 2h40v50l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4z"
          fill="none"
          stroke={accent}
          strokeWidth="3"
        />
        <line x1="14" y1="16" x2="38" y2="16" stroke={accent} strokeWidth="3" />
        <line x1="14" y1="25" x2="38" y2="25" stroke={accent} strokeWidth="3" opacity="0.6" />
        <line x1="14" y1="34" x2="30" y2="34" stroke={accent} strokeWidth="3" opacity="0.6" />
      </svg>
    );
  }

  // booking
  return (
    <svg width={u(58)} height={u(54)} viewBox="0 0 58 54">
      <rect x="2" y="8" width="54" height="44" rx="6" fill="none" stroke={accent} strokeWidth="3" />
      <line x1="2" y1="21" x2="56" y2="21" stroke={accent} strokeWidth="3" />
      <line x1="15" y1="2" x2="15" y2="13" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="2" x2="43" y2="13" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <rect x="32" y="30" width="14" height="14" rx="3" fill={accent} />
    </svg>
  );
};

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
                {node.visual ? (
                  <NodeVisual variant={node.visual} frame={frame} tokens={tokens} frameSize={reel.frame} scale={g} />
                ) : null}
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
