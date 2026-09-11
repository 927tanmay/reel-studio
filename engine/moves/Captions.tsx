import React from "react";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReelSpec, ResolvedShot } from "../spec";
import { px } from "../scale";
import { textStyle, verticalPlacement } from "./text";

/** Which media key's transcript this shot should caption from. */
export const primaryMediaKey = (resolved: ResolvedShot): string | null => {
  const { shot } = resolved;
  if (typeof shot.src === "string") return shot.src;
  const banded = shot.bands?.regions.find((r) => typeof r.source === "string");
  return banded ? (banded.source as string) : null;
};

/**
 * Spoken words, burned in, paged the way short-form platforms have trained
 * people to read. Timing comes from the same file the cuts are anchored to, so
 * re-cutting cannot desync them.
 */
export const Captions: React.FC<{ spec: ReelSpec; resolved: ResolvedShot }> = ({
  spec,
  resolved,
}) => {
  const frame = useCurrentFrame();
  const { fps } = spec.frame;
  const style = spec.style.caption;

  const key = primaryMediaKey(resolved);
  const allWords = key ? spec.words?.[key] : undefined;
  if (!allWords || allWords.length === 0) return null;

  const inSeconds = resolved.shot.in ?? 0;
  const outSeconds = inSeconds + resolved.durationInFrames / fps;

  // Trim to this shot, then rebase onto shot-local time.
  //
  // words.json stores each word trimmed, with no leading space (so
  // transcript.md can join them with its own separator). createTikTokStyleCaptions
  // detects word boundaries — and decides where a page can break — entirely by
  // checking whether a token's text starts with a space. Feed it trimmed text
  // and every word looks like a continuation of the last: no spaces between
  // rendered words, and no page ever breaks.
  const captions: Caption[] = allWords
    .filter((w) => w.endMs / 1000 > inSeconds && w.startMs / 1000 < outSeconds)
    .map((w) => ({
      text: ` ${w.text}`,
      startMs: w.startMs - inSeconds * 1000,
      endMs: w.endMs - inSeconds * 1000,
      timestampMs: w.timestampMs === null ? null : w.timestampMs - inSeconds * 1000,
      confidence: w.confidence,
    }));

  if (captions.length === 0) return null;

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: style.windowMs,
  });

  const nowMs = (frame / fps) * 1000;
  const pageIndex = pages.findIndex(
    (p) => nowMs >= p.startMs && nowMs < p.startMs + p.durationMs,
  );
  if (pageIndex === -1) return null;
  const page = pages[pageIndex];

  const pageStartFrame = (page.startMs / 1000) * fps;
  const opacity = interpolate(
    frame,
    [pageStartFrame, pageStartFrame + style.fadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const base = textStyle(spec.style, spec.frame, style);
  const plate = style.plate;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: style.bottom !== undefined ? "flex-end" : "flex-start",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          ...verticalPlacement(style),
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity,
        }}
      >
        <div
          style={{
            ...base,
            ...(plate
              ? {
                  backgroundColor: plate.color,
                  padding: `${px(spec.style, spec.frame, plate.padY)}px ${px(
                    spec.style,
                    spec.frame,
                    plate.padX,
                  )}px`,
                  borderRadius: px(spec.style, spec.frame, plate.radius),
                }
              : {}),
          }}
        >
          {page.tokens.map((token, i) => {
            const active = nowMs >= token.fromMs && nowMs < token.toMs;
            return (
              <span key={i} style={{ color: active ? style.activeColor : style.color }}>
                {token.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
