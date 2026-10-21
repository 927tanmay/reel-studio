import { test } from "node:test";
import assert from "node:assert/strict";
import { packetAt, travelFrames } from "../engine/packet";

const trip = { at: 1 };
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("a trip's length is its own seconds, else the look's", () => {
  assert.equal(travelFrames({ at: 1, seconds: 2 }, 30, 0.9), 60);
  assert.equal(travelFrames({ at: 1 }, 30, 0.9), 27);
});

test("the dot does not exist before it sets off or after it arrives", () => {
  assert.equal(packetAt(29, 30, trip, 1, 4), null);
  assert.ok(packetAt(30, 30, trip, 1, 4));
  assert.ok(packetAt(60, 30, trip, 1, 4)); // arrival frame still draws
  assert.equal(packetAt(61, 30, trip, 1, 4), null);
});

test("it starts at the first node, ends at the second, and never goes backwards", () => {
  near(packetAt(30, 30, trip, 1, 4)!.progress, 0);
  near(packetAt(60, 30, trip, 1, 4)!.progress, 1);
  let last = -1;
  for (let f = 30; f <= 60; f++) {
    const p = packetAt(f, 30, trip, 1, 4)!.progress;
    assert.ok(p >= last);
    last = p;
  }
});

test("it eases: slower at the ends than in the middle", () => {
  const early = packetAt(33, 30, trip, 1, 4)!.progress - packetAt(32, 30, trip, 1, 4)!.progress;
  const mid = packetAt(46, 30, trip, 1, 4)!.progress - packetAt(45, 30, trip, 1, 4)!.progress;
  assert.ok(mid > early * 3);
});

test("it fades in and out at the ends", () => {
  const first = packetAt(30, 30, trip, 1, 4)!.opacity;
  const middle = packetAt(45, 30, trip, 1, 4)!.opacity;
  const last = packetAt(60, 30, trip, 1, 4)!.opacity;
  assert.ok(first < middle && last < middle);
  assert.equal(middle, 1);
});
