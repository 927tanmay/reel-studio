import type { ReelSpec, ResolvedShot, Timeline } from "./spec";
import type { TextStyle, Tokens } from "./tokens";
import { primaryMediaKey } from "./moves/Captions";
import { normalise } from "./words";

/** Mirrors ShotView's own decision, so this gate can't drift from what renders. */
const willShowCaptions = (spec: ReelSpec, shot: ReelSpec["shots"][number], index: number): boolean => {
  if (shot.captions === false) return false;
  const key = primaryMediaKey({ shot, index, key: "", startFrame: 0, durationInFrames: 0 } as ResolvedShot);
  return Boolean(key && spec.words?.[key]?.length);
};

/**
 * Gates that can be settled without rendering a frame.
 *
 * These run when the studio opens and again at render, so a reel with text
 * sitting under the platform's interface fails while you can still do something
 * about it. File-level gates — dimensions, loudness, size — live in
 * scripts/verify.mjs, because they need the finished file.
 */

export type Finding = { level: "fail" | "warn"; message: string };

/** Where a block sits, as fractions of frame height from the top edge. */
const extent = (style: TextStyle): { top: number; bottom: number } => {
  // A rough but deliberately generous block height: one line plus leading.
  const lines = 2;
  const height = (style.size * (style.lineHeight ?? 1.1) * lines) / 1920;

  if (style.bottom !== undefined) {
    const bottomEdge = 1 - style.bottom;
    return { top: bottomEdge - height, bottom: bottomEdge };
  }
  const topEdge = style.top ?? 0.3;
  return { top: topEdge, bottom: topEdge + height };
};

const checkSafe = (name: string, style: TextStyle, tokens: Tokens): Finding[] => {
  const { top, bottom } = extent(style);
  const out: Finding[] = [];

  if (top < tokens.safe.top) {
    out.push({
      level: "fail",
      message:
        `${name} reaches ${(top * 100).toFixed(1)}% from the top, inside the ` +
        `${(tokens.safe.top * 100).toFixed(0)}% the interface covers. Move it down.`,
    });
  }
  if (bottom > 1 - tokens.safe.bottom) {
    out.push({
      level: "fail",
      message:
        `${name} reaches ${((1 - bottom) * 100).toFixed(1)}% from the bottom, inside the ` +
        `${(tokens.safe.bottom * 100).toFixed(0)}% the interface covers. Move it up.`,
    });
  }
  return out;
};

export const verifySpec = (spec: ReelSpec, timeline: Timeline): Finding[] => {
  const findings: Finding[] = timeline.warnings.map((message) => ({ level: "warn", message }));
  const t = spec.style;

  const used = {
    captions: spec.shots.some((s, i) => willShowCaptions(spec, s, i)),
    title: spec.shots.some((s) => s.title),
    badge: spec.shots.some((s) => s.badge),
  };

  if (used.title) findings.push(...checkSafe("Title", t.title, t));
  if (used.captions) findings.push(...checkSafe("Captions", t.caption, t));
  if (used.badge) findings.push(...checkSafe("Badge", t.badge, t));

  // Captions and badges share the lower third. Two things competing for one
  // zone holds for most of a series and then quietly breaks on one post.
  // Captions are on by default wherever a transcript exists, so this has to
  // check the same way ShotView decides it, not just an explicit `true`.
  for (const [index, shot] of spec.shots.entries()) {
    if (willShowCaptions(spec, shot, index) && shot.badge) {
      findings.push({
        level: "fail",
        message:
          `A shot carries both captions and a badge. They share the lower third; ` +
          `give one of them a different position or drop it from this shot.`,
      });
      break;
    }
  }

  // An emphasis word that never actually occurs in this shot's spoken range
  // is silently inert — nothing renders differently, and nothing else would
  // ever tell you. That's a worse failure mode than an error, so it gets a
  // warning instead of staying quiet.
  for (const [index, shot] of spec.shots.entries()) {
    if (!shot.emphasis || shot.emphasis.length === 0) continue;
    if (!willShowCaptions(spec, shot, index)) continue;

    const key = primaryMediaKey({ shot, index, key: "", startFrame: 0, durationInFrames: 0 } as ResolvedShot);
    const allWords = key ? spec.words?.[key] : undefined;
    const resolvedShot = timeline.shots[index];
    if (!allWords || !resolvedShot) continue;

    const inSeconds = shot.in ?? 0;
    const outSeconds = inSeconds + resolvedShot.durationInFrames / spec.frame.fps;
    const spoken = new Set(
      allWords
        .filter((w) => w.endMs / 1000 > inSeconds && w.startMs / 1000 < outSeconds)
        .map((w) => normalise(w.text)),
    );

    for (const word of shot.emphasis) {
      if (!spoken.has(normalise(word))) {
        findings.push({
          level: "warn",
          message:
            `Shot ${index} marks "${word}" for emphasis, but it is not spoken in this ` +
            `shot's range. Check the spelling, or that it belongs on a different shot.`,
        });
      }
    }
  }

  // Cropping is correctness, not taste: enlarging a region past what was
  // captured invents detail, and scaling without cropping first distorts.
  for (const shot of spec.shots) {
    const frames = [shot.reframe, ...(shot.bands?.regions ?? []).map((r) => r.reframe)];
    for (const rf of frames) {
      if (!rf) continue;
      for (const r of [rf.from, rf.to].filter(Boolean)) {
        if (r!.w < spec.frame.w || r!.h < spec.frame.h) {
          findings.push({
            level: "warn",
            message:
              `A reframe crops to ${Math.round(r!.w)}x${Math.round(r!.h)}, smaller than the ` +
              `${spec.frame.w}x${spec.frame.h} frame. That enlarges the source past what was captured.`,
          });
        }
      }
    }
  }

  return findings;
};

export const formatFindings = (id: string, findings: Finding[]): string | null => {
  if (findings.length === 0) return null;
  const lines = findings.map((f) => `  ${f.level === "fail" ? "✗" : "!"} ${f.message}`);
  return `[${id}]\n${lines.join("\n")}`;
};
