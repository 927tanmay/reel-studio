/**
 * What to listen to. An agent cannot hear a render, so instead of saying it
 * sounds right this names the few moments most likely to sound wrong, for a
 * person to check with headphones: long sounds (a riser that has to end on its
 * word, typing under speech), sounds that duck the music, the loudest ones,
 * sounds stacked within a few frames of each other, and hard cuts furthest off
 * the beat. After the "five timestamps to check" in Barty-Bart/motion-graphics'
 * sound pass (MIT), which credits Vox (@Voxyz_ai).
 */
import { nearestBeat, type BeatGrid } from "./beats";
import type { ReelSpec, Timeline } from "./spec";

/** A reel's hard moments, in reel frames: every cut after the first shot, every slam, every impact. */
export const hardMoments = (timeline: Timeline, fps: number): { frame: number; what: string }[] => {
  const out: { frame: number; what: string }[] = [];
  for (const r of timeline.shots) {
    if (r.index > 0) out.push({ frame: r.startFrame, what: `cut into shot ${r.index} (${r.shot.enter?.kind ?? "cut"})` });
    for (const s of r.shot.slams ?? []) out.push({ frame: r.startFrame + Math.round((s.at ?? 0) * fps), what: `slam ${JSON.stringify(s.text)} in shot ${r.index}` });
    for (const im of r.shot.impacts ?? []) out.push({ frame: r.startFrame + Math.round((im.at ?? 0) * fps), what: `${im.kind} in shot ${r.index}` });
  }
  // A slam and a shake on one word are one moment.
  const merged: { frame: number; what: string }[] = [];
  for (const m of out.sort((a, b) => a.frame - b.frame)) {
    const last = merged[merged.length - 1];
    if (last && last.frame === m.frame) last.what += ` + ${m.what}`;
    else merged.push({ ...m });
  }
  return merged;
};

/**
 * How far a reel frame sits from the nearest beat, in seconds (signed: positive
 * is after the beat), or null when there is no grid or the bed has not started.
 */
export const beatOffset = (spec: Pick<ReelSpec, "beatGrid" | "bed" | "frame">, timeline: Timeline, frame: number): number | null => {
  const grid: BeatGrid | undefined = spec.beatGrid;
  if (!grid || !spec.bed) return null;
  const bedStart = timeline.shots[spec.bed.startShot ?? 0]?.startFrame ?? 0;
  if (frame < bedStart) return null;
  const t = (spec.bed.trackIn ?? 0) + (frame - bedStart) / spec.frame.fps;
  return t - nearestBeat(grid, t);
};

export type ListenAt = { at: number; why: string[]; score: number };

const LONG = /riser|typing|(^|\/)type$|ambience|room/i;
const LOUD = /impact|glitch|slam|boom|hit/i;

/**
 * The `n` moments (default 5) most worth hearing, in time order, each with the
 * reasons it was picked. Moments within a quarter second merge, their reasons
 * and scores added, so one busy beat is one thing to check rather than three.
 */
export const listenList = (spec: Pick<ReelSpec, "beatGrid" | "bed" | "frame">, timeline: Timeline, n = 5): ListenAt[] => {
  const fps = spec.frame.fps;
  const raw: ListenAt[] = [];
  const hits = [...timeline.hits].sort((a, b) => a.frame - b.frame);
  hits.forEach((h, i) => {
    const at = h.frame / fps;
    if (LONG.test(h.sfx)) raw.push({ at, why: [`${h.sfx} is a long sound: check it ends where it should and doesn't run under the voice`], score: 3 });
    if (h.duck) raw.push({ at, why: [`${h.sfx} ducks the music: check the bed comes back smoothly`], score: 2 });
    if (LOUD.test(h.sfx) && h.volume >= 0.8) raw.push({ at, why: [`${h.sfx} is one of the loudest: check it doesn't startle or crackle`], score: 2.5 });
    const next = hits[i + 1];
    if (next && next.frame - h.frame <= Math.round(0.15 * fps) && next.sfx !== h.sfx)
      raw.push({ at, why: [`${h.sfx} and ${next.sfx} ${Math.round(((next.frame - h.frame) / fps) * 1000)} ms apart: check they don't smear into one`], score: 2 });
  });
  for (const m of hardMoments(timeline, fps)) {
    const off = beatOffset(spec, timeline, m.frame);
    if (off !== null && Math.abs(off) > 0.06)
      raw.push({ at: m.frame / fps, why: [`${m.what} is ${Math.round(Math.abs(off) * 1000)} ms ${off > 0 ? "after" : "before"} the beat: check it still feels on it`], score: 2 + Math.abs(off) * 10 });
  }
  raw.sort((a, b) => a.at - b.at);
  const merged: ListenAt[] = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.at - last.at < 0.25) {
      for (const w of r.why) if (!last.why.includes(w)) last.why.push(w);
      last.score += r.score;
    } else merged.push({ at: r.at, why: [...r.why], score: r.score });
  }
  return merged
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, n)
    .sort((a, b) => a.at - b.at)
    .map((m) => ({ ...m, at: Math.round(m.at * 1000) / 1000, score: Math.round(m.score * 100) / 100 }));
};
