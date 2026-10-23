import { test } from "node:test";
import assert from "node:assert/strict";
import tokens from "../projects/default/tokens";
import { allMarks, reel, resolveTimeline } from "../engine/spec";
import { critiqueTimeline } from "../engine/critique";
import { scrollOffset, windowLayout } from "../engine/window";

const frame = { w: 1080, h: 1920, fps: 30 };
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("a short picture makes a short window: the bar plus the picture at the window's width", () => {
  const l = windowLayout(frame, tokens, 16 / 10)!;
  const w = tokens.window!;
  near(l.box.width, w.width * 1080);
  near(l.image.height, l.box.width / 1.6);
  near(l.box.height, l.bar + l.image.height);
  assert.equal(l.range, 0);
  // Centred on the look's `top`.
  near(l.box.top + l.box.height / 2, w.top * 1920);
  near(l.viewport.top, l.box.top + l.bar);
});

test("a picture taller than the look allows scrolls inside a capped window instead of shrinking", () => {
  const l = windowLayout(frame, tokens, 1 / 4)!; // a long article
  near(l.box.height, tokens.window!.maxHeight * 1920);
  assert.ok(l.range > 0);
  near(l.image.height, l.box.width * 4);
  // The whole picture is the viewport plus what is below the fold.
  near(l.image.height, l.viewport.height + l.range);
  // Never narrower than the window: nothing was shrunk to fit.
  near(l.image.width, l.box.width);
});

test("a window without bar spends that height on the picture", () => {
  const withBar = windowLayout(frame, tokens, 1 / 4)!;
  const bare = windowLayout(frame, tokens, 1 / 4, false)!;
  assert.equal(bare.bar, 0);
  assert.ok(bare.viewport.height > withBar.viewport.height);
});

test("no window in the look, or no aspect, is no layout", () => {
  assert.equal(windowLayout(frame, { ...tokens, window: undefined }, 1.6), null);
  assert.equal(windowLayout(frame, tokens, 0), null);
});

test("sizes follow the frame, not the pixels the look was drawn at", () => {
  const big = windowLayout({ w: 2160, h: 3840, fps: 30 }, tokens, 1 / 4)!;
  const small = windowLayout(frame, tokens, 1 / 4)!;
  near(big.bar, small.bar * 2);
  near(big.range, small.range * 2, 0.1);
});

test("scrolling goes from a fraction to a fraction of the way, and a short picture never moves", () => {
  const l = windowLayout(frame, tokens, 1 / 4)!;
  near(scrollOffset(l, undefined, 0), 0);
  near(scrollOffset(l, undefined, 1), l.range);
  near(scrollOffset(l, { from: 0.25, to: 0.75 }, 0.5), 0.5 * l.range);
  near(scrollOffset(l, { to: 2 }, 1), l.range); // clamped
  near(scrollOffset(windowLayout(frame, tokens, 1.6)!, undefined, 1), 0);
});

const shot = {
  src: {
    type: "image" as const,
    src: "posts/x/raw/a.png",
    window: { url: "example.com" },
    marks: [{ kind: "box" as const, region: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 }, at: 1 }],
    seconds: 4,
  },
};

test("marks on a picture count with the shot's own, for sounds and pacing", () => {
  const spec = reel({ id: "t", frame, style: tokens, shots: [{ ...shot, marks: [{ kind: "circle", region: { x: 0.4, y: 0.4, w: 0.1, h: 0.1 }, at: 2 }] }] });
  assert.equal(allMarks(spec.shots[0]).length, 2);
  const t = resolveTimeline(spec);
  const placed = t.hits.map((h) => `${h.sfx}@${h.frame}`);
  assert.ok(placed.includes(`${tokens.sounds!.mark!.sfx}@30`), placed.join()); // on the picture, 1s in
  assert.ok(placed.includes(`${tokens.sounds!.mark!.sfx}@60`), placed.join()); // on the frame, 2s in
  const c = critiqueTimeline(spec, t, { coalesceSeconds: 0.25, hookSeconds: 3, deadAirSeconds: 0.5 });
  assert.equal(c.emphasis.medium.marks, 2);
});

test("a silent picture mark plays nothing", () => {
  const silent = { ...shot, src: { ...shot.src, marks: [{ ...shot.src.marks[0], silent: true }] } };
  assert.equal(resolveTimeline(reel({ id: "t", frame, style: tokens, shots: [silent] })).hits.length, 0);
});
