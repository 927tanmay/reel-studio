import React from "react";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ReelSpec, ResolvedShot } from "../spec";
import { dominantSound, wordsInShot } from "../spec";
import { normalise } from "../words";
import { emphasisGroups, wordReveal } from "../emphasis";
import { resolveColour } from "../backdrop";
import { px } from "../scale";
import { textStyle, verticalPlacement } from "./text";
import { surfaceStyle } from "./surface";

/**
 * Which media key's transcript this shot should caption from.
 *
 * Whatever is audible, which is not always what is visible: a shot holding the
 * previous take's voice under B-roll keeps captioning that take, because the
 * captions belong to the speech and the speech has not stopped.
 */
export const primaryMediaKey = (resolved: ResolvedShot): string | null => {
  const sound = dominantSound(resolved);
  if (sound) return sound.key;

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
  // The bottom caption, or — for a reel with nobody on screen — the headline
  // look: the same words, set big across the top and built as they are spoken.
  const style =
    resolved.shot.captionStyle === "headline" && spec.style.headline ? spec.style.headline : spec.style.caption;

  const key = primaryMediaKey(resolved);
  const allWords = key ? spec.words?.[key] : undefined;
  if (!allWords || allWords.length === 0) return null;

  // Trim to this shot and rebase onto shot-local time, through whatever the
  // shot actually plays — so a tightened take's captions close up exactly as
  // its audio does, and a word removed with its pause is removed here too.
  //
  // words.json stores each word trimmed, with no leading space (so
  // transcript.md can join them with its own separator). createTikTokStyleCaptions
  // detects word boundaries — and decides where a page can break — entirely by
  // checking whether a token's text starts with a space. Feed it trimmed text
  // and every word looks like a continuation of the last: no spaces between
  // rendered words, and no page ever breaks.
  const captions: Caption[] = wordsInShot(resolved, fps, allWords).map((w) => ({
    text: ` ${w.text}`,
    startMs: w.startMs,
    endMs: w.endMs,
    timestampMs: w.timestampMs,
    confidence: w.confidence,
  }));

  if (captions.length === 0) return null;

  // Cards are built from time windows, which know nothing about sentences. A
  // headline wants each card to be one thought, so the words are split where a
  // sentence ends and each run is paged on its own; the pages keep their
  // absolute times, so they concatenate cleanly.
  const runs: Caption[][] = [[]];
  for (const c of captions) {
    runs[runs.length - 1].push(c);
    if (style.breakOnSentence && /[.?!…]["')\]]*\s*$/.test(c.text)) runs.push([]);
  }
  const pages = runs
    .filter((run) => run.length > 0)
    .flatMap(
      (run) =>
        createTikTokStyleCaptions({ captions: run, combineTokensWithinMilliseconds: style.windowMs }).pages,
    );

  const nowMs = (frame / fps) * 1000;
  // The card leads the voice; the active-word highlight does not. Pages are
  // chosen on the shifted clock, tokens are lit on the real one.
  const cardMs = nowMs + (style.leadMs ?? 0);
  const pageIndex = pages.findIndex(
    (p) => cardMs >= p.startMs && cardMs < p.startMs + p.durationMs,
  );
  if (pageIndex === -1) return null;
  const page = pages[pageIndex];

  const pageStartFrame = ((page.startMs - (style.leadMs ?? 0)) / 1000) * fps;
  const cardFade = interpolate(
    frame,
    [pageStartFrame, pageStartFrame + style.fadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const base = textStyle(spec.style, spec.frame, style);
  const plate = style.plate;

  // Emphasis is a standing choice, not a transient one — it applies wherever
  // a marked word appears in this shot, independent of which word happens to
  // be mid-utterance right now. It takes priority over the active-word color:
  // a word the editor deliberately marked stays marked even while it's being
  // spoken, rather than flashing to the ordinary highlight and back.
  const groups = emphasisGroups(resolved.shot.emphasis);
  const emphasis = style.emphasis;
  // When words reveal themselves, each carries its own fade and the card
  // must not fade as well or the first words arrive twice.
  const opacity = style.reveal ? 1 : cardFade;
  const box = style.activeBox;
  const boxColour = box ? resolveColour(box.color, spec.style.palette, resolved.shot.accent) : undefined;

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
                  ...surfaceStyle(spec.style, spec.frame, plate),
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
            const group = groups.get(normalise(token.text));
            // The token's text carries its leading space; the box and the
            // reveal belong on the word alone.
            const lead = token.text.match(/^\s*/)?.[0] ?? "";
            const word = token.text.slice(lead.length);

            const defaultMarked = group === "default" && emphasis;
            const groupColour =
              group && group !== "default"
                ? (style.colours?.[group] ?? spec.style.palette[group] ?? group)
                : undefined;
            const boxed = Boolean(box && active);

            const color = boxed
              ? box!.textColor
              : (groupColour ??
                (defaultMarked
                  ? emphasis!.color
                  : active && !box
                    ? style.activeColor
                    : style.color));

            const reveal = style.reveal
              ? wordReveal(
                  nowMs,
                  token.fromMs - (style.leadMs ?? 0),
                  style.reveal.frames,
                  fps,
                  px(spec.style, spec.frame, style.reveal.blur),
                )
              : null;

            return (
              <React.Fragment key={i}>
                {lead}
                <span
                  style={{
                    color,
                    ...(defaultMarked
                      ? { fontSize: `${emphasis!.scale}em`, fontWeight: emphasis!.weight ?? base.fontWeight }
                      : {}),
                    ...(box
                      ? {
                          padding: `${px(spec.style, spec.frame, box.padY)}px ${px(spec.style, spec.frame, box.padX)}px`,
                          borderRadius: px(spec.style, spec.frame, box.radius),
                          backgroundColor: boxed ? boxColour : "transparent",
                          boxDecorationBreak: "clone",
                          WebkitBoxDecorationBreak: "clone",
                        }
                      : {}),
                    ...(reveal
                      ? { opacity: reveal.opacity, filter: reveal.blur > 0.2 ? `blur(${reveal.blur}px)` : undefined }
                      : {}),
                  }}
                >
                  {word}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
