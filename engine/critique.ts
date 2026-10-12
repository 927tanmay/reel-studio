import { dominantSound, shotLabel, wordsInShot, type ReelSpec, type Timeline } from "./spec";

/**
 * Pacing, measured from the resolved timeline — the same frames the renderer
 * uses, with no render needed. This reports numbers and where they came from;
 * it never says a reel is good or bad. What counts as too long a gap is a
 * judgement about *this* reel, so every threshold is an argument the caller
 * supplies, not something fixed here.
 */

export type ChangeKind = "cut" | "mark" | "pointer" | "ribbon" | "lower-third" | "step" | "wipe";

export type Change = { seconds: number; kind: ChangeKind; shot: number; label: string };

export type Gap = { from: number; to: number; seconds: number };

export type Critique = {
  runtimeSeconds: number;
  shots: {
    count: number;
    meanSeconds: number;
    shortest: { shot: number; seconds: number };
    longest: { shot: number; seconds: number };
  };
  /** Every moment the picture visibly changes, in order, with near-duplicates merged. */
  changes: Change[];
  /** Seconds until the first change after the opening frame, or null for a reel with none. */
  timeToFirstChange: number | null;
  /** How many changes land inside the first `hookSeconds`. */
  changesInHook: number;
  changesPer10s: number;
  /** Stretches between changes, longest first — including the lead-in and the tail. */
  gaps: (Gap & { startsAfter: Change | null })[];
  /** Present only when a shot's sound has a transcript. */
  speech: null | {
    words: number;
    wordsPerMinute: number;
    timeToFirstWord: number;
    /** Share of the runtime with speech in it, bridging pauses shorter than `deadAirSeconds`. */
    coverage: number;
    /** Silent stretches longer than `deadAirSeconds`, not counting the lead-in or the tail. */
    deadAir: Gap[];
    trailingSilence: number;
  };
  /** Things this report cannot see, so its absence of a finding is not read as a clean bill. */
  blind: string[];
};

export type CritiqueOptions = {
  /** Changes closer together than this are one change (a cut that also starts a mark). */
  coalesceSeconds: number;
  /** How much of the opening counts as the hook. */
  hookSeconds: number;
  /** A silence longer than this is dead air; shorter ones are just the speaker breathing. */
  deadAirSeconds: number;
};

export const critiqueTimeline = (
  spec: ReelSpec,
  timeline: Timeline,
  opts: CritiqueOptions,
): Critique => {
  const { fps } = spec.frame;
  const runtimeSeconds = timeline.durationInFrames / fps;

  // --- Picture changes ----------------------------------------------------
  const raw: Change[] = [];
  const push = (seconds: number, kind: ChangeKind, shot: number, label: string) => {
    if (seconds >= 0 && seconds < runtimeSeconds) raw.push({ seconds, kind, shot, label });
  };

  for (const r of timeline.shots) {
    const start = r.startFrame / fps;
    const label = shotLabel(r.shot);
    if (r.index > 0) push(start, "cut", r.index, label);

    const at = (seconds: number | undefined) => start + (seconds ?? 0);
    for (const m of r.shot.marks ?? []) push(at(m.at), "mark", r.index, `${m.kind} mark`);
    for (const p of r.shot.pointer?.path ?? []) if (p.click) push(at(p.at), "pointer", r.index, "click");
    if (r.shot.ribbon) push(at(r.shot.ribbon.at), "ribbon", r.index, "ribbon");
    if (r.shot.lowerThird) push(at(r.shot.lowerThird.at), "lower-third", r.index, "lower third");

    const src = r.shot.src;
    if (src && typeof src === "object") {
      if (src.type === "diagram") for (const s of src.steps ?? []) push(at(s.at), "step", r.index, "diagram step");
      if (src.type === "code") for (const h of src.highlight ?? []) push(at(h.at), "step", r.index, "code highlight");
      if (src.type === "terminal") for (const l of src.lines) push(at(l.at), "step", r.index, "terminal line");
      if (src.type === "compare" && src.wipeAt !== undefined) push(at(src.wipeAt), "wipe", r.index, "compare wipe");
    }
  }

  raw.sort((a, b) => a.seconds - b.seconds);
  const changes: Change[] = [];
  for (const c of raw) {
    const last = changes[changes.length - 1];
    // A cut that also starts a mark is one change to the viewer, not two.
    if (last && c.seconds - last.seconds < opts.coalesceSeconds) continue;
    changes.push(c);
  }

  // Shot-start events at t=0 are not changes; the first event after it is the
  // first thing that happened to the viewer.
  const firstChange = changes.find((c) => c.seconds > 0) ?? null;

  const gaps: Critique["gaps"] = [];
  let prev: Change | null = null;
  let cursor = 0;
  for (const c of changes) {
    if (c.seconds > cursor) gaps.push({ from: cursor, to: c.seconds, seconds: c.seconds - cursor, startsAfter: prev });
    cursor = c.seconds;
    prev = c;
  }
  if (runtimeSeconds > cursor) {
    gaps.push({ from: cursor, to: runtimeSeconds, seconds: runtimeSeconds - cursor, startsAfter: prev });
  }
  gaps.sort((a, b) => b.seconds - a.seconds);

  const lengths = timeline.shots.map((r) => ({ shot: r.index, seconds: r.durationInFrames / fps }));
  const byLength = [...lengths].sort((a, b) => a.seconds - b.seconds);

  // --- Speech -------------------------------------------------------------
  const intervals: [number, number][] = [];
  let wordCount = 0;
  for (const r of timeline.shots) {
    const key = dominantSound(r)?.key;
    const words = key ? spec.words?.[key] : undefined;
    if (!words) continue;
    const shotStartMs = (r.startFrame / fps) * 1000;
    const shotEndMs = shotStartMs + (r.durationInFrames / fps) * 1000;
    for (const w of wordsInShot(r, fps, words)) {
      const from = (shotStartMs + w.startMs) / 1000;
      const to = Math.min(shotStartMs + w.endMs, shotEndMs) / 1000;
      if (to > from) {
        intervals.push([from, to]);
        wordCount++;
      }
    }
  }

  let speech: Critique["speech"] = null;
  if (intervals.length > 0) {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [from, to] of intervals) {
      const last = merged[merged.length - 1];
      if (last && from <= last[1]) last[1] = Math.max(last[1], to);
      else merged.push([from, to]);
    }
    const deadAir: Gap[] = [];
    let covered = 0;
    let runStart = merged[0][0];
    let runEnd = merged[0][1];
    for (let i = 1; i < merged.length; i++) {
      const gap = merged[i][0] - runEnd;
      if (gap > opts.deadAirSeconds) {
        deadAir.push({ from: runEnd, to: merged[i][0], seconds: gap });
        covered += runEnd - runStart;
        runStart = merged[i][0];
      }
      runEnd = merged[i][1];
    }
    covered += runEnd - runStart;

    const spoken = merged.reduce((n, [a, b]) => n + (b - a), 0);
    speech = {
      words: wordCount,
      wordsPerMinute: Math.round(wordCount / (spoken / 60)),
      timeToFirstWord: merged[0][0],
      coverage: covered / runtimeSeconds,
      deadAir: deadAir.sort((a, b) => b.seconds - a.seconds),
      trailingSilence: Math.max(0, runtimeSeconds - merged[merged.length - 1][1]),
    };
  }

  const blind = [
    "Continuous motion — a slow reframe, a typing animation — is not counted as a change, so a long gap over one is not necessarily dead.",
    "Which line is the strongest, and whether the hook earns the next five seconds, is an editorial call this cannot make.",
  ];
  if (!speech) blind.push("No transcript was attached to any shot's sound, so speech and silence were not measured.");

  return {
    runtimeSeconds,
    shots: {
      count: lengths.length,
      meanSeconds: lengths.reduce((n, l) => n + l.seconds, 0) / lengths.length,
      shortest: byLength[0],
      longest: byLength[byLength.length - 1],
    },
    changes,
    timeToFirstChange: firstChange ? firstChange.seconds : null,
    changesInHook: changes.filter((c) => c.seconds > 0 && c.seconds <= opts.hookSeconds).length,
    changesPer10s: (changes.filter((c) => c.seconds > 0).length / runtimeSeconds) * 10,
    gaps,
    speech,
    blind,
  };
};
