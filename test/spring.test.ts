import { test } from "node:test";
import assert from "node:assert/strict";
import { SPRINGS, colourTrack, pointerAt, pressAt, spring, swap, track } from "../engine/spring";

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("a spring starts at 0 with no velocity and settles at 1", () => {
  for (const s of Object.values(SPRINGS)) {
    near(spring(0, s), 0);
    near(spring(10, s), 1);
  }
  // No initial velocity: the first few milliseconds barely move.
  assert.ok(spring(0.005, SPRINGS.morph) < 0.01);
  near(spring(0.001, SPRINGS.instant), 1);
});

test("under-damped overshoots a little, critically damped and over-damped never do", () => {
  const peak = (s: [number, number]) => Math.max(...Array.from({ length: 400 }, (_, i) => spring(i / 200, s)));
  assert.ok(peak(SPRINGS.morph) > 1 && peak(SPRINGS.morph) < 1.1);
  assert.ok(peak(SPRINGS.camera) <= 1 + 1e-9);
  assert.ok(peak([10, 1.5]) <= 1 + 1e-9);
});

test("a track sums one spring per change, so a new target keeps the motion it already has", () => {
  const f = track(0, [{ at: 0, value: 100 }, { at: 0.2, value: 50 }]);
  near(f(0), 0);
  near(f(10), 50, 1e-6);
  // Identical to two springs added by hand.
  const t = 0.35;
  near(f(t), 100 * spring(t, SPRINGS.morph) - 50 * spring(t - 0.2, SPRINGS.morph), 1e-9);
  // Continuous through the change of target: no jump at 0.2.
  near(f(0.2 - 1e-4), f(0.2 + 1e-4), 0.1);
  // A key to the value it already holds adds nothing.
  near(track(5, [{ at: 1, value: 5 }])(2), 5);
});

test("colours spring channel by channel; a non-hex colour switches at its key", () => {
  const c = colourTrack("#000000", [{ at: 0, value: "#FF0000" }]);
  assert.equal(c(10), "rgb(255,0,0)");
  assert.equal(c(-1), "rgb(0,0,0)");
  const named = colourTrack("white", [{ at: 1, value: "accent" }]);
  assert.equal(named(0.5), "white");
  assert.equal(named(1.5), "accent");
});

test("content swaps: invisible before it arrives, gone after it leaves, never both at full", () => {
  near(swap(0, 1, null).opacity, 0);
  near(swap(5, 1, null).opacity, 1);
  near(swap(5, 0, 2).opacity, 0);
  assert.ok(swap(1.1, 1, null).blur > 0);
});

test("the pointer holds at its ends, arcs between, and is pressed only around a click", () => {
  const keys = [{ at: 0, x: 0.2, y: 0.5 }, { at: 1, x: 0.8, y: 0.5 }];
  assert.deepEqual(pointerAt(keys, -1), { x: 0.2, y: 0.5 });
  assert.deepEqual(pointerAt(keys, 2), { x: 0.8, y: 0.5 });
  const mid = pointerAt(keys, 0.5);
  near(mid.x, 0.5);
  assert.ok(mid.y > 0.5, "bows off the straight line");
  near(pressAt(0.5, [2]), 0);
  assert.ok(pressAt(2, [2]) > 0.5);
  near(pressAt(3, [2]), 0, 0.01);
  assert.ok(pressAt(1.5, [], [[1, 2]]) > 0.9);
});
