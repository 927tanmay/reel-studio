import { test } from "node:test";
import assert from "node:assert/strict";
import { rampDuration, rampPieces, rampSource } from "../engine/ramp";

const ramp = [
  { at: 1, speed: 4 },
  { at: 3, speed: 1 },
];
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("holds the first speed before the first keyframe", () => {
  near(rampSource(ramp, 0.5), 2);
  near(rampSource(ramp, 1), 4);
});

test("eases between keyframes: the integral of a smoothstep, exactly", () => {
  // Halfway through the interval the eased speed is the mean, but the area is
  // not the linear one — this is the closed form the renderer also uses.
  near(rampSource(ramp, 2), 7.4375);
  near(rampSource(ramp, 3), 9); // a full interval: the mean speed times its length
});

test("holds the last speed after the last keyframe", () => {
  near(rampSource(ramp, 4), 10);
  near(rampSource(ramp, 10), 16);
});

test("rampDuration inverts rampSource", () => {
  near(rampDuration(ramp, 10), 4, 1e-6);
  for (const t of [0.3, 1.7, 2.9, 5]) {
    near(rampDuration(ramp, rampSource(ramp, t)), t, 1e-6);
  }
});

test("pieces tile the shot exactly and are contiguous in the source", () => {
  const fps = 30;
  const frames = 120;
  const pieces = rampPieces(ramp, fps, frames, 0);
  assert.equal(pieces[0].startFrame, 0);
  assert.equal(pieces.reduce((n, p) => n + p.frames, 0), frames);
  for (let i = 1; i < pieces.length; i++) {
    const prev = pieces[i - 1];
    assert.equal(pieces[i].startFrame, prev.startFrame + prev.frames);
    near(pieces[i].sourceStart, prev.sourceStart + (prev.rate * prev.frames) / fps, 1e-6);
  }
});

test("a flat stretch is one piece, not many", () => {
  const pieces = rampPieces([{ at: 0, speed: 2 }], 30, 90, 0);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].frames, 90);
  near(pieces[0].rate, 2);
});
