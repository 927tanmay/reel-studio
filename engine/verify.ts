import type { ReelSpec, ResolvedShot, Timeline } from "./spec";
import { wordsInShot } from "./spec";
import type { TextStyle, Tokens } from "./tokens";
import { primaryMediaKey } from "./moves/Captions";
import { normalise } from "./words";
import { cardBox } from "./card";
import { coverRegion } from "./scale";

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

  // Marks point at something in the picture, so they may sit anywhere the
  // picture does — the safe zones are for readable text. What can go wrong is
  // asking for one the look cannot draw, or one that lands off the frame.
  for (const resolved of timeline.shots) {
    const { shot, index, durationInFrames } = resolved;
    if (!shot.marks?.length) continue;
    if (!t.marks) {
      findings.push({
        level: "fail",
        message: `Shot ${index} has marks, but the look defines no \`marks\` style. Add one to the look's tokens.`,
      });
      continue;
    }
    shot.marks.forEach((m, i) => {
      const { x, y, w, h } = m.region;
      if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) {
        findings.push({
          level: "fail",
          message:
            `Shot ${index} mark ${i} (${m.kind}) has a region outside the frame ` +
            `(x ${x}, y ${y}, w ${w}, h ${h}) — these are fractions of the frame, 0 to 1.`,
        });
      }
      if ((m.at ?? 0) * spec.frame.fps >= durationInFrames) {
        findings.push({
          level: "warn",
          message: `Shot ${index} mark ${i} (${m.kind}) starts at ${m.at}s, after the shot has ended — it will never show.`,
        });
      }
    });
  }

  // An orb is drawn from the look's own style, so a look without one has
  // nothing to draw it with.
  if (!t.orb) {
    const orbShot = timeline.shots.find((r) => typeof r.shot.src === "object" && r.shot.src.type === "orb");
    if (orbShot) {
      findings.push({
        level: "fail",
        message: `Shot ${orbShot.index} uses an orb, but the look defines no \`orb\` style. Add one to the look's tokens.`,
      });
    }
  }

  // A ramp's keyframes are rates: zero or negative never advances the source
  // (and the duration solver would never finish), so they fail up front.
  for (const resolved of timeline.shots) {
    const ramp = resolved.shot.speedRamp;
    if (!ramp) continue;
    if (ramp.some((p) => !(p.speed > 0) || p.at < 0)) {
      findings.push({
        level: "fail",
        message:
          `Shot ${resolved.index} has a speedRamp keyframe with a speed of zero or less, or a negative time. ` +
          `Every keyframe needs \`speed\` above 0 and \`at\` from 0.`,
      });
    }
  }

  // A standalone Lottie is placed by the look.
  if (!t.lottie) {
    const lottieShot = timeline.shots.find((r) => typeof r.shot.src === "object" && r.shot.src.type === "lottie");
    if (lottieShot) {
      findings.push({
        level: "fail",
        message: `Shot ${lottieShot.index} uses a lottie, but the look defines no \`lottie\` style. Add one to the look's tokens.`,
      });
    }
  }

  // Code morphs need the Shiki highlighter (they work on real tokens) and the
  // look's morph timing.
  for (const resolved of timeline.shots) {
    const { shot, index, durationInFrames } = resolved;
    const src = shot.src;
    if (!src || typeof src !== "object" || src.type !== "code" || !src.states?.length) continue;
    if (src.highlighter !== "shiki") {
      findings.push({
        level: "fail",
        message: `Shot ${index} has code \`states\` but not \`highlighter: "shiki"\`. Morphing works on real tokens; set it.`,
      });
    }
    if (!t.code) {
      findings.push({
        level: "fail",
        message: `Shot ${index} has code \`states\`, but the look defines no \`code\` style. Add one to the look's tokens.`,
      });
    }
    src.states.forEach((st, i) => {
      if (Math.round(st.at * spec.frame.fps) >= durationInFrames) {
        findings.push({
          level: "warn",
          message: `Shot ${index} code state ${i} is at ${st.at}s, after the shot has ended — it will never show.`,
        });
      }
    });
  }

  // A slam is one big word, so it needs the look that sizes it, a word, a
  // place inside the safe zones, a moment inside the shot, and — the one thing
  // that goes wrong in use — room not to be stacked on another slam or a title.
  for (const resolved of timeline.shots) {
    const { shot, index, durationInFrames } = resolved;
    if (!shot.slams?.length) continue;
    if (!t.slam) {
      findings.push({
        level: "fail",
        message: `Shot ${index} has slams, but the look defines no \`slam\` style. Add one to the look's tokens.`,
      });
      continue;
    }
    const fps = spec.frame.fps;
    const style = t.slam;
    const windows: { from: number; to: number }[] = [];
    shot.slams.forEach((sl, i) => {
      if (sl.text.trim().length === 0) {
        findings.push({ level: "fail", message: `Shot ${index} slam ${i} has no text.` });
        return;
      }
      const from = Math.round((sl.at ?? 0) * fps);
      const hold = sl.hold !== undefined ? Math.round(sl.hold * fps) : style.holdFrames;
      const to = from + style.enterFrames + hold + style.exitFrames;
      if (from >= durationInFrames) {
        findings.push({
          level: "warn",
          message: `Shot ${index} slam ${i} ("${sl.text}") is at ${sl.at}s, after the shot has ended — it will never show.`,
        });
      }
      windows.push({ from, to });

      // The word's block, in frame fractions: its centre, plus half its lines.
      const lines = sl.text.split("\n").length;
      const half = (style.size * (style.lineHeight ?? 1) * lines * (spec.frame.w / t.designWidth)) / spec.frame.h / 2;
      const centre = sl.centre ?? style.centre;
      if (centre - half < t.safe.top || centre + half > 1 - t.safe.bottom) {
        findings.push({
          level: "fail",
          message:
            `Shot ${index} slam ${i} ("${sl.text}") spans ${((centre - half) * 100).toFixed(0)}%–` +
            `${((centre + half) * 100).toFixed(0)}% of the frame height at its largest, reaching into the area ` +
            `the platform interface covers. Move its centre or shorten the word.`,
        });
      }
    });
    windows.sort((a, b) => a.from - b.from);
    for (let i = 1; i < windows.length; i++) {
      if (windows[i].from < windows[i - 1].to) {
        findings.push({
          level: "warn",
          message: `Shot ${index} has two slams on screen at once. One word at a time; give the second a later \`at\`.`,
        });
        break;
      }
    }
    if (shot.title) {
      findings.push({
        level: "warn",
        message: `Shot ${index} has both a title and a slam. That is two things said at once — keep the slam, or the title.`,
      });
    }
  }

  // Impacts need the look that says what they look like, and a moment that
  // happens inside the shot.
  for (const resolved of timeline.shots) {
    const { shot, index, durationInFrames } = resolved;
    if (!shot.impacts?.length) continue;
    if (!t.impact) {
      findings.push({
        level: "fail",
        message: `Shot ${index} has impacts, but the look defines no \`impact\` style. Add one to the look's tokens.`,
      });
      continue;
    }
    shot.impacts.forEach((im, i) => {
      if ((im.strength ?? 1) <= 0 || (im.frames ?? 1) <= 0) {
        findings.push({
          level: "fail",
          message: `Shot ${index} impact ${i} (${im.kind}) has a strength or length of zero or less.`,
        });
      }
      if (Math.round((im.at ?? 0) * spec.frame.fps) >= durationInFrames) {
        findings.push({
          level: "warn",
          message: `Shot ${index} impact ${i} (${im.kind}) is at ${im.at}s, after the shot has ended — it will never show.`,
        });
      }
      // A flash is drawn over the shot, and a blend or push fades the whole
      // shot in — flash included — so a flash inside that fade is dimmed by it.
      const enter = shot.enter;
      if (
        im.kind === "flash" &&
        (enter?.kind === "blend" || enter?.kind === "push") &&
        Math.round((im.at ?? 0) * spec.frame.fps) < enter.frames
      ) {
        findings.push({
          level: "warn",
          message:
            `Shot ${index}'s flash lands inside its own ${enter.kind} fade-in and will be dimmed by it. ` +
            `Put a flash on a cut or a punch, or start it after the ${enter.kind} finishes.`,
        });
      }
    });
  }

  // A floating card needs its look, a single source to show, and — checked
  // here rather than discovered on screen — somewhere to draw.
  for (const resolved of timeline.shots) {
    const { shot, index } = resolved;
    if (!shot.card) continue;
    if (!t.card) {
      findings.push({
        level: "fail",
        message: `Shot ${index} asks for a card, but the look defines no \`card\` style. Add one to the look's tokens.`,
      });
    }
    if (shot.bands) {
      findings.push({
        level: "warn",
        message: `Shot ${index} sets \`card\` alongside \`bands\`. A banded shot has no single picture to float; the card is ignored.`,
      });
    }
  }

  // An auto-zoom needs the look's zoom, and has three ways to look wrong that
  // a render would only show: enlarging a source past what was captured,
  // marks that slide off their target, and a drawn arrow that doesn't scale
  // with the picture it points at.
  for (const resolved of timeline.shots) {
    const { shot, index } = resolved;
    const pointer = shot.pointer;
    if (!pointer?.zoom) continue;
    if (!t.pointer?.zoom) {
      findings.push({
        level: "fail",
        message: `Shot ${index} asks for an auto-zoom, but the look's \`pointer\` style has no \`zoom\`. Add one to the look's tokens.`,
      });
      continue;
    }
    if (!pointer.path.some((p) => p.click)) {
      findings.push({
        level: "warn",
        message: `Shot ${index} asks for an auto-zoom but its pointer has no click — the zoom heads for clicks, so nothing will happen.`,
      });
    }
    if (shot.marks?.length) {
      findings.push({
        level: "warn",
        message: `Shot ${index} has marks and an auto-zoom. Marks are fixed to the frame, so any showing while the picture zooms will slide off what they mark.`,
      });
    }
    if (pointer.arrow) {
      findings.push({
        level: "warn",
        message: `Shot ${index} draws a pointer arrow under an auto-zoom. The arrow doesn't scale with the picture, so it drifts off its target; leave it off over a recording that already shows a cursor.`,
      });
    }

    // Magnification past native: how many frame pixels each source pixel is
    // already stretched to, times the zoom. Above 1 the picture is invented.
    const source = typeof shot.src === "string" ? spec.media?.[shot.src] : undefined;
    const target = typeof pointer.zoom === "number" ? pointer.zoom : t.pointer.zoom.to;
    if (source && !shot.bands) {
      const aspect = (shot.reframe?.from ?? { w: source.width, h: source.height });
      const box = shot.card ? cardBox(spec, shot, aspect.w / aspect.h) : null;
      const frame = box ? { ...spec.frame, w: box.width, h: box.height } : spec.frame;
      const regions = [shot.reframe?.from, shot.reframe?.to].filter(Boolean) as { x: number; y: number; w: number; h: number }[];
      if (regions.length === 0) regions.push({ x: 0, y: 0, w: source.width, h: source.height });
      const worst = Math.max(...regions.map((r) => coverRegion(source.width, source.height, r, frame).sourceScale));
      if (worst * target > 1) {
        findings.push({
          level: "warn",
          message:
            `Shot ${index}'s auto-zoom (${target}x) magnifies "${shot.src}" to ${(worst * target).toFixed(2)}x its native ` +
            `size at the peak. That enlarges the source past what was captured; lower the zoom, or use a source with more resolution.`,
        });
      }
    }
  }

  // A pointer is the same kind of overlay as a mark: it points into the
  // picture, so the safe zones don't apply, but its positions must be real.
  for (const resolved of timeline.shots) {
    const { shot, index, durationInFrames } = resolved;
    if (!shot.pointer) continue;
    if (!t.pointer) {
      findings.push({
        level: "fail",
        message: `Shot ${index} has a pointer, but the look defines no \`pointer\` style. Add one to the look's tokens.`,
      });
      continue;
    }
    if (shot.pointer.path.length === 0) {
      findings.push({ level: "fail", message: `Shot ${index} has a pointer with an empty path.` });
      continue;
    }
    shot.pointer.path.forEach((p, i) => {
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
        findings.push({
          level: "fail",
          message:
            `Shot ${index} pointer waypoint ${i} (x ${p.x}, y ${p.y}) is outside the frame — ` +
            `these are fractions of the frame, 0 to 1.`,
        });
      }
      if (p.at * spec.frame.fps >= durationInFrames) {
        findings.push({
          level: "warn",
          message: `Shot ${index} pointer waypoint ${i} is at ${p.at}s, after the shot has ended — it will never show.`,
        });
      }
    });
    if (shot.pointer.spotlight && !shot.pointer.path.some((p) => p.click)) {
      findings.push({
        level: "warn",
        message: `Shot ${index} pointer asks for a spotlight but has no click — the spotlight only lights on a click, so nothing will show.`,
      });
    }
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
