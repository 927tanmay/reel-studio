import type { ReelSpec, ResolvedShot, Timeline } from "./spec";
import { wordsInShot } from "./spec";
import type { TextStyle, Tokens } from "./tokens";
import { primaryMediaKey } from "./moves/Captions";
import { normalise } from "./words";

/** Mirrors ShotView's own decision, so this gate can't drift from what renders. */
const willShowCaptions = (spec: ReelSpec, resolved: ResolvedShot): boolean => {
  if (resolved.shot.captions === false) return false;
  const key = primaryMediaKey(resolved);
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
    captions: timeline.shots.some((r) => willShowCaptions(spec, r)),
    title: spec.shots.some((s) => s.title),
    badge: spec.shots.some((s) => s.badge),
    ribbon: spec.shots.some((s) => s.ribbon),
    lowerThird: spec.shots.some((s) => s.lowerThird),
  };

  if (used.title) findings.push(...checkSafe("Title", t.title, t));
  if (used.captions) findings.push(...checkSafe("Captions", t.caption, t));
  if (used.badge) findings.push(...checkSafe("Badge", t.badge, t));
  if (used.lowerThird) findings.push(...checkSafe("Lower third", t.lowerThird, t));

  // A ribbon settles wherever the shot puts it, so each one is checked where
  // it actually lands rather than at the look's default.
  for (const shot of spec.shots) {
    if (!shot.ribbon) continue;
    const fromTop = (shot.ribbon.from ?? "top") === "top";
    const offset = shot.ribbon.offset ?? (fromTop ? t.ribbon.top : t.ribbon.bottom);
    findings.push(
      ...checkSafe(
        "Ribbon",
        fromTop
          ? { ...t.ribbon, top: offset, bottom: undefined }
          : { ...t.ribbon, bottom: offset, top: undefined },
        t,
      ),
    );
  }

  // Captions and badges share the lower third. Two things competing for one
  // zone holds for most of a series and then quietly breaks on one post.
  // Captions are on by default wherever a transcript exists, so this has to
  // check the same way ShotView decides it, not just an explicit `true`.
  for (const resolved of timeline.shots) {
    if (!spec.allowCaptionsWithBadge && willShowCaptions(spec, resolved) && resolved.shot.badge) {
      findings.push({
        level: "fail",
        message:
          `A shot carries both captions and a badge. They share the lower third; ` +
          `give one of them a different position or drop it from this shot.`,
      });
      break;
    }
  }

  // A badge and a lower third share the same zone above the caption band —
  // the same reasoning as captions-plus-badge, and it fails the same way
  // rather than warning, since the collision is certain, not a matter of
  // where a look happens to place things.
  for (const shot of spec.shots) {
    if (shot.badge && shot.lowerThird) {
      findings.push({
        level: "fail",
        message: `Shot carries both a badge and a lower third. They share the same zone; drop one of them from this shot.`,
      });
      break;
    }
  }

  // An emphasis word that never actually occurs in this shot's spoken range
  // is silently inert — nothing renders differently, and nothing else would
  // ever tell you. That's a worse failure mode than an error, so it gets a
  // warning instead of staying quiet.
  for (const resolvedShot of timeline.shots) {
    const { shot, index } = resolvedShot;
    if (!shot.emphasis || shot.emphasis.length === 0) continue;
    if (!willShowCaptions(spec, resolvedShot)) continue;

    const key = primaryMediaKey(resolvedShot);
    const allWords = key ? spec.words?.[key] : undefined;
    if (!allWords) continue;

    // Through the segments, not the shot's raw window: a word that a
    // tightening pass removed is no longer spoken here, and marking it for
    // emphasis is exactly as inert as misspelling it.
    const spoken = new Set(
      wordsInShot(resolvedShot, spec.frame.fps, allWords).map((w) => normalise(w.text)),
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

  // Tightening too hard leaves slivers. A stretch of picture a few frames
  // long between two cuts does not read as a tight edit, it reads as a
  // glitch — and it is invisible in a shotlist, because nothing there says
  // how long any one surviving piece turned out to be.
  const STUTTER_FRAMES = 6;
  for (const resolvedShot of timeline.shots) {
    if (resolvedShot.segments.length < 2) continue;
    const slivers = resolvedShot.segments.filter((s) => s.frames < STUTTER_FRAMES);
    if (slivers.length === 0) continue;

    findings.push({
      level: "warn",
      message:
        `Shot ${resolvedShot.index} keeps ${slivers.length} stretch(es) shorter than ` +
        `${STUTTER_FRAMES} frames after dropping ${resolvedShot.segments.length - 1} range(s). ` +
        `Raise \`longerThan\`, or widen \`pad\`, so the cuts land further apart.`,
    });
  }

  // Captions and badges never share a shot — the check above sees to that —
  // but they do share a reel, and a viewer watching one shot after another
  // reads them as the same kind of thing if they land in the same place. A
  // B-roll label sitting where captions sit on the next shot does not look
  // like a label, it looks like a caption that failed to change.
  if (used.captions && used.badge) {
    const caption = extent(t.caption);
    const badge = extent(t.badge);
    const overlap = Math.min(caption.bottom, badge.bottom) - Math.max(caption.top, badge.top);

    if (overlap > 0) {
      findings.push({
        level: "warn",
        message:
          `This reel uses both captions and badges, and they occupy the same band ` +
          `(${(badge.top * 100).toFixed(0)}–${(badge.bottom * 100).toFixed(0)}% against ` +
          `${(caption.top * 100).toFixed(0)}–${(caption.bottom * 100).toFixed(0)}% from the top). ` +
          `Shot to shot they will read as the same element. Move the badge clear of the caption band.`,
      });
    }
  }

  // A grade is meant to reconcile how two clips were rendered, not what they
  // are pictures of. Past a certain size it stops being a correction and
  // starts being a look — which is fine if it was chosen, and is usually a
  // sign of matching a dark screen recording to a lit face at full strength,
  // which grades the content away rather than the mismatch.
  for (const shot of spec.shots) {
    const g = shot.grade;
    if (!g) continue;

    const extremes = [
      ["exposure", g.exposure],
      ["contrast", g.contrast],
      ["saturation", g.saturation],
      ["red gain", g.gain?.r],
      ["green gain", g.gain?.g],
      ["blue gain", g.gain?.b],
    ].filter(([, v]) => typeof v === "number" && (v < 0.6 || v > 1.6));

    for (const [name, value] of extremes) {
      findings.push({
        level: "warn",
        message:
          `A shot grades ${name} to ${(value as number).toFixed(2)}. That is a look rather than a ` +
          `match — check it against the ungraded frame, and lower the strength on matchGrade() ` +
          `if the two clips are pictures of different things.`,
      });
    }
  }

  // A thumbnail's title sits wherever `Tokens.thumbnail.top` (or `title.top`,
  // its fallback) puts it — right for full-frame playback, not necessarily
  // for a profile grid, which crops a 9:16 reel to roughly 3:4 and keeps
  // only the centre ~75% of frame height. A title landing in the cropped
  // 12.5% at either edge is invisible in the one place a thumbnail is
  // actually seen most: someone's profile grid, before they've tapped in.
  if (spec.thumbnail) {
    const thumbStyle = t.thumbnail;
    const top = spec.thumbnail.top ?? thumbStyle?.top ?? 0.4;
    const size = thumbStyle?.size ?? t.title.size;
    const lineHeight = t.title.lineHeight ?? 1.1;
    const height = (size * lineHeight * 2) / 1920;
    const bottom = top + height;
    const GRID_SAFE = 0.125;

    if (top < GRID_SAFE || bottom > 1 - GRID_SAFE) {
      findings.push({
        level: "warn",
        message:
          `This reel's thumbnail title sits at ${(top * 100).toFixed(1)}%–` +
          `${(bottom * 100).toFixed(1)}% from the top, outside the centre ` +
          `${(GRID_SAFE * 100).toFixed(0)}–${((1 - GRID_SAFE) * 100).toFixed(0)}% a profile grid's ` +
          `3:4 crop keeps. Move Tokens.thumbnail.top closer to the middle.`,
      });
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
