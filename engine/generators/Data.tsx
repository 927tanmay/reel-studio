import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Frame, GenSpec } from "../spec";
import type { Tokens } from "../tokens";
import { px } from "../scale";
import type { GenProps } from "./index";

type DataSpec = Extract<GenSpec, { type: "data" }>;

/**
 * A number that moves. On a small screen a figure that lands reads instantly
 * where a static chart does not.
 */
export const Data: React.FC<GenProps<DataSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const P = tokens.palette;
  const g = tokens.generators?.textScale ?? 1;
  const bars = spec.style === "bars";
  const trend = spec.style === "line" || spec.style === "area";
  const max = Math.max(...spec.items.map((i) => i.value), 1);

  if (trend) {
    return <TrendChart spec={spec} tokens={tokens} frame={frame} fps={fps} frameSize={reel.frame} />;
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.bg,
        justifyContent: "center",
        gap: px(tokens, reel.frame, bars ? 34 : 64),
        padding: px(tokens, reel.frame, 60),
      }}
    >
      {spec.items.map((item, i) => {
        const start = item.at !== undefined ? Math.round(item.at * fps) : i * Math.round(fps * 0.18);
        const grow = spring({
          frame: frame - start,
          fps,
          config: { damping: 200, stiffness: 90 },
          durationInFrames: Math.round(fps * 0.9),
        });
        const shown = Math.round(item.value * grow);
        const color = item.color ?? P.accent ?? "#4FD1C5";

        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: px(tokens, reel.frame, 12) }}>
            <div
              style={{
                fontFamily: tokens.fonts.display,
                fontWeight: 700,
                fontSize: px(tokens, reel.frame, (bars ? 54 : 132) * g),
                color,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {shown.toLocaleString()}
              {item.suffix ?? ""}
            </div>

            {bars ? (
              <div
                style={{
                  height: px(tokens, reel.frame, 18),
                  borderRadius: px(tokens, reel.frame, 9),
                  backgroundColor: P.surface ?? "rgba(255,255,255,.07)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(item.value / max) * grow * 100}%`,
                    height: "100%",
                    backgroundColor: color,
                  }}
                />
              </div>
            ) : null}

            <div
              style={{
                fontFamily: tokens.fonts.mono,
                fontSize: px(tokens, reel.frame, 30 * g),
                color: P.muted ?? "#9aa4ae",
                letterSpacing: "0.04em",
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * "Usage over time" as an actual trend — one line, drawn on rather than
 * appearing whole, plotted against a fixed 900x420 unit box that the SVG's
 * own `viewBox` scales onto whatever the wrapper's real pixel size is.
 * Labels sit as HTML underneath, at the same fractional x as their point on
 * the curve, sized through `px()` the same as every other generator's text.
 *
 * Reveal is by `strokeDashoffset` against a length computed directly from
 * the known points, not `getTotalLength()` — there is nothing to measure
 * that this component doesn't already know.
 */
const TrendChart: React.FC<{
  spec: DataSpec;
  tokens: Tokens;
  frame: number;
  fps: number;
  frameSize: Frame;
}> = ({ spec, tokens, frame, fps, frameSize }) => {
  const P = tokens.palette;
  const g = tokens.generators?.textScale ?? 1;
  const area = spec.style === "area";
  const color = spec.items[0]?.color ?? P.accent ?? "#4FD1C5";

  const values = spec.items.map((i) => i.value);
  const max = Math.max(...values, 1);
  const min = Math.min(0, ...values);
  const n = spec.items.length;

  const W = 900;
  const H = 420;
  const PAD_X = 24;
  const PAD_Y = 24;

  const xAt = (i: number) => (n <= 1 ? W / 2 : PAD_X + (i / (n - 1)) * (W - PAD_X * 2));
  const yAt = (v: number) => PAD_Y + (H - PAD_Y * 2) * (1 - (v - min) / (max - min || 1));

  const points = spec.items.map((item, i) => ({ x: xAt(i), y: yAt(item.value) }));

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const baselineY = yAt(min);
  const areaPath =
    points.length > 0
      ? `${path} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      : "";

  const revealFrames = Math.max(1, Math.round((spec.seconds ?? 3) * fps * 0.55));
  const reveal = Math.min(
    1,
    spring({ frame, fps, config: { damping: 200, stiffness: 90 }, durationInFrames: revealFrames }),
  );
  const gradId = React.useId();

  return (
    <AbsoluteFill style={{ backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "82%", aspectRatio: `${W} / ${H}` }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          {area ? (
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
          ) : null}

          {/* A flat baseline the line/area reads against — otherwise a
              single-point or near-flat series has nothing to sit on. */}
          <line
            x1={PAD_X}
            y1={baselineY}
            x2={W - PAD_X}
            y2={baselineY}
            stroke={P.surface ?? "rgba(255,255,255,.12)"}
            strokeWidth={2}
          />

          {area ? <path d={areaPath} fill={`url(#${gradId})`} stroke="none" opacity={reveal} /> : null}

          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={total}
            strokeDashoffset={total * (1 - reveal)}
          />

          {points.map((p, i) => {
            // A point is "reached" once the reveal has drawn at least as far
            // as its own cumulative distance along the line, so dots land in
            // step with the stroke rather than all appearing at once.
            let cumulative = 0;
            for (let j = 1; j <= i; j++) {
              cumulative += Math.hypot(points[j].x - points[j - 1].x, points[j].y - points[j - 1].y);
            }
            const reached = total === 0 || cumulative / total <= reveal;
            return reached ? <circle key={i} cx={p.x} cy={p.y} r={9} fill={color} /> : null;
          })}
        </svg>

        {spec.items.map((item, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "100%",
              left: `${(points[i].x / W) * 100}%`,
              transform: "translate(-50%, 12px)",
              fontFamily: tokens.fonts.mono,
              fontSize: px(tokens, frameSize, 26 * g),
              color: P.muted ?? "#9aa4ae",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </div>
        ))}

        {/* The payoff number: the last point's value, emphasised, the same
            way a counter or a bar's own figure reads as the point of the
            shot rather than a chart being decorative. */}
        {points.length > 0 ? (
          <div
            style={{
              position: "absolute",
              left: `${(points[points.length - 1].x / W) * 100}%`,
              top: `${(points[points.length - 1].y / H) * 100}%`,
              transform: "translate(-50%, -140%)",
              fontFamily: tokens.fonts.display,
              fontWeight: 700,
              fontSize: px(tokens, frameSize, 56 * g),
              color,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              opacity: reveal > 0.92 ? 1 : 0,
              whiteSpace: "nowrap",
            }}
          >
            {Math.round(values[values.length - 1] * Math.min(1, reveal / 0.92 || 0)).toLocaleString()}
            {spec.items[spec.items.length - 1].suffix ?? ""}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
