import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { ReelSpec } from "./spec";
import { resolveTimeline } from "./spec";
import { ShotView } from "./ShotView";
import { px } from "./scale";
import { textShadow } from "./moves/surface";
import { useFonts } from "./fonts";

/** case/punctuation-insensitive match, same normalisation `Captions` and
 *  `verify.ts` already use for `Shot.emphasis`. */
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

/**
 * One frame, held still, for use outside the reel itself — a feed thumbnail.
 *
 * The picture reuses the exact pipeline a real shot uses (crop, grade,
 * scale, bands) via `ShotView` itself, so it can never drift from what the
 * reel actually looks like. The title is its own thing, deliberately not a
 * reuse of the in-video `Title`: a thumbnail is a poster competing for a
 * thumb mid-scroll, not type the eye reads while something moves, so it can
 * run bigger, in a heavier display font, sitting centred rather than near an
 * edge — a profile grid crops a 9:16 reel to roughly 3:4, and only the
 * centre survives that. `Tokens.thumbnail` carries all of that; a look with
 * none of it still gets a usable, plainer version built from `title` alone.
 *
 * Only registered as a composition when a post's shotlist sets `thumbnail`
 * — see `ThumbnailSpec` in spec.ts.
 *
 * `<Sequence from={-atFrame}>` is the same trick a still render of the reel
 * itself relies on: it shifts `useCurrentFrame()` inside to `atFrame` at
 * this composition's own frame 0, so the chosen shot renders already in
 * progress rather than at its own start.
 */
export const Thumbnail: React.FC<{ spec: ReelSpec }> = ({ spec }) => {
  useFonts(spec.style);
  const thumb = spec.thumbnail;
  if (!thumb) return null;

  const timeline = resolveTimeline(spec);
  const resolved = timeline.shots[thumb.shot];
  if (!resolved) return null;

  const atFrame = Math.max(
    0,
    Math.min(resolved.durationInFrames - 1, Math.round((thumb.at ?? 0.8) * spec.frame.fps)),
  );

  const baseTitle = resolved.shot.title;
  const text = thumb.text ?? (typeof baseTitle === "string" ? baseTitle : baseTitle?.text);

  const style = spec.style.thumbnail;
  const title = spec.style.title;
  const fontFamily = style?.fontFamily ?? title.fontFamily;
  const size = style?.size ?? title.size;
  const weight = style?.weight ?? title.weight;
  const color = style?.color ?? title.color;
  const top = thumb.top ?? style?.top ?? 0.4;
  const accent = style?.accent ?? title.accent;
  const emphasis = style?.emphasis ?? (title.accent ? { color: title.accent.color } : undefined);

  const filterParts = [
    style?.contrast ? `contrast(${style.contrast})` : null,
    style?.saturate ? `saturate(${style.saturate})` : null,
  ].filter(Boolean);

  const emphasizeSet = new Set((thumb.emphasize ?? []).map(normalise));

  return (
    <AbsoluteFill style={{ backgroundColor: spec.style.bg }}>
      <Sequence from={-atFrame} durationInFrames={Infinity} layout="none">
        <ShotView
          resolved={resolved}
          spec={spec}
          overlays="none"
          reframeOverride={thumb.reframe ?? resolved.shot.reframe}
          extraFilter={filterParts.length > 0 ? filterParts.join(" ") : undefined}
        />
      </Sequence>

      {style?.scrim ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${style.scrim.height * 100}%`,
            background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${style.scrim.color} 100%)`,
          }}
        />
      ) : null}

      {text ? (
        <div
          style={{
            position: "absolute",
            top: `${top * 100}%`,
            left: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              fontFamily,
              fontSize: px(spec.style, spec.frame, size),
              fontWeight: weight,
              color,
              letterSpacing: title.tracking ? `${title.tracking}em` : undefined,
              lineHeight: title.lineHeight ?? 1.1,
              textAlign: "center",
              maxWidth: `${(title.maxWidth ?? 0.85) * 100}%`,
              textShadow: textShadow(spec.style, spec.frame, title.shadow),
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {emphasizeSet.size === 0
              ? text
              : text.split(/(\s+)/).map((word, i) =>
                  emphasizeSet.has(normalise(word)) && emphasis ? (
                    <span
                      key={i}
                      style={{
                        color: emphasis.color,
                        fontSize: emphasis.scale ? `${emphasis.scale}em` : undefined,
                      }}
                    >
                      {word}
                    </span>
                  ) : (
                    <React.Fragment key={i}>{word}</React.Fragment>
                  ),
                )}
          </h1>
          {accent ? (
            <div
              style={{
                marginTop: px(spec.style, spec.frame, 14),
                width: accent.width * spec.frame.w,
                height: px(spec.style, spec.frame, accent.weight),
                backgroundColor: accent.color,
                borderRadius: px(spec.style, spec.frame, accent.weight),
              }}
            />
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
