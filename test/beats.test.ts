import { test } from "node:test";
import assert from "node:assert/strict";
import { beatsBetween, fitTrackIn, kickCheck, nearestBeat, type BeatGrid } from "../engine/beats";
import { hardMoments, listenList } from "../engine/listen";
import type { Timeline } from "../engine/spec";

const near = (a: number, b: number, eps = 2e-3) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const grid = (bpm: number, first: number): BeatGrid => ({ bpm, firstBeatSeconds: first, periodSeconds: 60 / bpm });
/** Kicks every `period` from `first` for `seconds`, with a little seeded jitter. */
const kicksAt = (first: number, period: number, seconds: number, jitter = 0.004) => {
  const out: number[] = [];
  let seed = 7;
  for (let t = first; t < seconds; t += period) {
    seed = (seed * 16807) % 2147483647;
    out.push(t + ((seed / 2147483647) * 2 - 1) * jitter);
  }
  return out;
};

test("every beat between two times, on the grid", () => {
  const b = beatsBetween(grid(120, 0.25), 1, 2.3);
  assert.deepEqual(b.map((x) => +x.toFixed(3)), [1.25, 1.75, 2.25]);
});

test("a grid on the kick is left alone", () => {
  const r = kickCheck(grid(120, 0.5), kicksAt(0, 0.5, 60));
  assert.equal(r.steady, true);
  assert.equal(r.shift, false);
  near(r.offsetSeconds, 0, 0.01);
});

test("a grid locked onto the off-beat is found, and moved onto the kick", () => {
  const r = kickCheck(grid(120, 0.25), kicksAt(0, 0.5, 60));
  assert.equal(r.shift, true);
  assert.equal(r.offBeat, true);
  near(nearestBeat(r.corrected, 30.1), 30, 0.01);
});

test("a tempo a fraction of a percent out is refitted, so beats late in the track land too", () => {
  // Detected 120.2 BPM; the kicks are really 120. By a minute in the detected
  // grid has drifted a tenth of a second.
  const detected = grid(120.2, 0);
  const kicks = kicksAt(0, 0.5, 90);
  assert.ok(Math.abs(nearestBeat(detected, 80) - 80) > 0.05);
  const r = kickCheck(detected, kicks);
  assert.equal(r.shift, true);
  assert.equal(r.offBeat, false);
  near(r.corrected.periodSeconds, 0.5, 1e-4);
  near(nearestBeat(r.corrected, 80.1), 80, 0.01);
  assert.ok(Math.abs(r.driftSeconds) > 0.05, "the drift is reported");
});

test("bass with no steady kick is called unsteady and changes nothing", () => {
  let seed = 3;
  const random = Array.from({ length: 120 }, () => ((seed = (seed * 16807) % 2147483647), (seed / 2147483647) * 60));
  const g = grid(120, 0.1);
  const r = kickCheck(g, random);
  assert.equal(r.steady, false);
  assert.equal(r.shift, false);
  assert.deepEqual(r.corrected, g);
});

test("too few kicks to judge changes nothing", () => {
  assert.equal(kickCheck(grid(120, 0), [0, 0.5, 1]).shift, false);
});

test("trackIn slides by part of a beat so the cuts land on beats", () => {
  const g = grid(120, 0);
  // Cuts every two beats, but the music starts 0.12 s off.
  const moments = [1, 2, 3.5, 5];
  const r = fitTrackIn(g, moments, 10.12);
  near(r.trackIn, 10, 1e-3);
  for (const e of r.before) near(e, 0.12);
  for (const e of r.after) near(e, 0);
  // It stays within half a beat: the same part of the track plays.
  assert.ok(Math.abs(r.trackIn - 10.12) <= 0.25);
});

test("trackIn already on the beat stays, and never goes below zero", () => {
  const g = grid(120, 0);
  assert.equal(fitTrackIn(g, [1, 2], 4).trackIn, 4);
  assert.ok(fitTrackIn(g, [1.2, 2.2], 0.05).trackIn >= 0);
});

// A timeline small enough to read: three shots at 30 fps, and some sounds.
const shot = (index: number, startFrame: number, extra: object = {}) =>
  ({ index, startFrame, durationInFrames: 60, key: "", segments: [], shot: { src: "a", ...extra } }) as unknown as Timeline["shots"][number];
const timeline = (hits: Timeline["hits"]): Timeline => ({
  shots: [shot(0, 0), shot(1, 60, { slams: [{ text: "NO", at: 1 }], impacts: [{ kind: "shake", at: 1 }] }), shot(2, 120)],
  durationInFrames: 180,
  hits,
  dips: [],
  warnings: [],
});

test("hard moments are the cuts, slams and impacts, one per frame", () => {
  const m = hardMoments(timeline([]), 30);
  assert.deepEqual(m.map((x) => x.frame), [60, 90, 120]);
  assert.match(m[1].what, /slam "NO".*\+ shake/);
});

test("the listening list names long, ducking, loud and stacked sounds, and cuts off the beat", () => {
  const spec = { frame: { w: 1080, h: 1920, fps: 30 }, bed: { track: "x", trackIn: 0.1 }, beatGrid: grid(120, 0) } as never;
  const list = listenList(
    spec,
    timeline([
      { frame: 30, sfx: "kit/riser", volume: 0.6 },
      { frame: 90, sfx: "kit/impact", volume: 1, duck: true },
      { frame: 150, sfx: "kit/pop", volume: 0.5 },
      { frame: 152, sfx: "kit/click", volume: 0.5 },
    ]),
  );
  const at = (s: number) => list.find((m) => Math.abs(m.at - s) < 0.01);
  assert.match(at(1)!.why.join(" "), /long sound/);
  assert.match(at(3)!.why.join(" "), /ducks the music/);
  assert.match(at(3)!.why.join(" "), /loudest/);
  assert.match(at(3)!.why.join(" "), /100 ms before the beat|100 ms after the beat/);
  assert.match(at(5)!.why.join(" "), /67 ms apart/);
  assert.ok(list.length <= 5);
  assert.deepEqual([...list].sort((a, b) => a.at - b.at), list, "in time order");
});

test("without a beat grid nothing is said about beats", () => {
  const spec = { frame: { w: 1080, h: 1920, fps: 30 } } as never;
  const list = listenList(spec, timeline([{ frame: 30, sfx: "kit/pop", volume: 0.5 }]));
  assert.ok(list.every((m) => !m.why.join(" ").includes("beat")));
});
