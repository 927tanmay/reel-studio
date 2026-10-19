import { test } from "node:test";
import assert from "node:assert/strict";
import tokens from "../projects/default/tokens";
import smoke from "../public/posts/000-smoke-test/shotlist";
import { critiqueTimeline } from "../engine/critique";
import { reel, resolveTimeline } from "../engine/spec";

const media = {
  screen: { key: "screen", file: "raw/screen.mp4", seconds: 10, width: 1920, height: 1080, fps: 30, hasAudio: false },
};
const base = { id: "t", frame: { w: 1080, h: 1920, fps: 30 }, style: tokens, media };

test("the smoke test resolves with no warnings", () => {
  const t = resolveTimeline(smoke);
  assert.deepEqual(t.warnings, []);
  assert.ok(t.shots.length >= 7);
  assert.ok(t.durationInFrames > 0);
});

test("a speed ramp with no seconds measures its length from the file", () => {
  const spec = reel({ ...base, shots: [{ src: "screen", speedRamp: [{ at: 1, speed: 4 }, { at: 3, speed: 1 }] }] });
  const t = resolveTimeline(spec);
  assert.equal(t.shots[0].durationInFrames, 120); // 10s of source at that ramp is 4s on screen
  assert.equal(t.shots[0].segments.length, 1);
});

test("a ramp with a non-positive speed is left alone rather than solved", () => {
  const spec = reel({ ...base, shots: [{ src: "screen", seconds: 2, speedRamp: [{ at: 0, speed: 0 }] }] });
  const t = resolveTimeline(spec);
  assert.equal(t.shots[0].durationInFrames, 60); // falls back to the authored seconds
});

test("a click, a mark and an impact each place a hit on their own frame", () => {
  const spec = reel({
    ...base,
    shots: [
      {
        src: "screen",
        seconds: 5,
        pointer: { path: [{ at: 2, x: 0.5, y: 0.5, click: true }] },
        marks: [{ kind: "circle", region: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, at: 3 }],
        impacts: [{ kind: "shake", at: 4 }],
        slams: [{ text: "Hi", at: 1 }],
      },
    ],
  });
  const placed = resolveTimeline(spec).hits.map((h) => `${h.sfx}@${h.frame}`);
  const s = tokens.sounds!;
  assert.ok(placed.includes(`${s.click!.sfx}@60`), placed.join());
  assert.ok(placed.includes(`${s.mark!.sfx}@90`), placed.join());
  assert.ok(placed.includes(`${s.slam!.sfx}@30`), placed.join()); // the slam, 1s in
  assert.ok(placed.includes(`${s.shake!.sfx}@120`), placed.join()); // the shake, 4s in
});

test("event sounds are silent where the shot asks, and where the look names none", () => {
  const shot = { src: "screen", seconds: 5, pointer: { path: [{ at: 2, x: 0.5, y: 0.5, click: true }], silent: true } };
  assert.equal(resolveTimeline(reel({ ...base, shots: [shot] })).hits.length, 0);
  const quiet = reel({ ...base, style: { ...tokens, sounds: undefined }, shots: [{ ...shot, pointer: { ...shot.pointer, silent: false } }] });
  assert.equal(resolveTimeline(quiet).hits.length, 0);
});

test("critique counts a slam and a shake on one word as a single loud beat", () => {
  const spec = reel({
    ...base,
    shots: [
      { src: "screen", seconds: 6, slams: [{ text: "Hi", at: 2 }], impacts: [{ kind: "shake", at: 2.05 }, { kind: "flash", at: 5 }] },
    ],
  });
  const c = critiqueTimeline(spec, resolveTimeline(spec), { coalesceSeconds: 0.25, hookSeconds: 3, deadAirSeconds: 0.5 });
  assert.equal(c.emphasis.loud.length, 2);
  assert.deepEqual(c.emphasis.loud[0].kinds.sort(), ["shake", "slam"]);
  assert.ok(c.emphasis.closestLoudGap! > 2.9);
});
