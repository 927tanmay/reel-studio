import { test } from "node:test";
import assert from "node:assert/strict";
import { irisClip, irisRadius, wipeClip, wipeEdge, zoomEnter, zoomExit, ZOOM_BLUR, ZOOM_TO } from "../engine/transition";
import { chunkCards, popState } from "../engine/chunks";
import { iris, overlaps, reel, resolveTimeline, whip, wipe, zoomThrough } from "../engine/spec";
import tokens from "../projects/default/tokens";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("a zoom-through's incoming side arrives enlarged, soft and clear, and settles exactly", () => {
  const first = zoomEnter(0, 12);
  near(first.scale, ZOOM_TO);
  near(first.blur, ZOOM_BLUR);
  near(first.opacity, 0);
  const half = zoomEnter(6, 12);
  near(half.opacity, 1); // fully opaque by the halfway hand-over
  assert.ok(half.scale > 1 && half.scale < ZOOM_TO);
  const end = zoomEnter(12, 12);
  near(end.scale, 1);
  near(end.blur, 0);
  near(zoomEnter(40, 12).scale, 1); // and stays at rest
});

test("its outgoing side is still until the overlap, then flies in and goes soft into the cut", () => {
  near(zoomExit(50, 100, 12).scale, 1);
  near(zoomExit(88, 100, 12).blur, 0); // the overlap starts at 88
  const late = zoomExit(99, 100, 12);
  assert.ok(late.scale > 1.3 && late.blur > ZOOM_BLUR * 0.6);
  near(zoomExit(100, 100, 12, 2, 10).scale, 2);
  near(zoomExit(100, 100, 12, 2, 10).blur, 10);
  // Gathers speed: the second half travels further than the first.
  const a = zoomExit(94, 100, 12).scale - 1;
  const b = zoomExit(100, 100, 12).scale - zoomExit(94, 100, 12).scale;
  assert.ok(b > a);
});

test("a wipe uncovers the picture from the side the edge leaves", () => {
  assert.equal(wipeClip(0, 10, "left"), "inset(0 0 0 100.000%)");
  assert.equal(wipeClip(10, 10, "left"), "inset(0 0 0 0.000%)");
  assert.equal(wipeClip(5, 10, "right"), "inset(0 50.000% 0 0)");
  assert.equal(wipeClip(5, 10, "up"), "inset(50.000% 0 0 0)");
  assert.equal(wipeClip(5, 10, "down"), "inset(0 0 50.000% 0)");
  near(wipeEdge(0, 10), 0);
  near(wipeEdge(10, 10), 1);
  assert.ok(wipeEdge(2, 10) < 0.2); // eased: slow off the mark
});

test("the new transitions overlap like a blend, crossfade the sound and carry their hit", () => {
  assert.ok(overlaps(zoomThrough({ frames: 12 })));
  assert.ok(overlaps(wipe({ frames: 10, direction: "left" })));
  assert.ok(overlaps(whip({ direction: "left" })));
  const w = whip({ direction: "up", hit: "whoosh" });
  assert.equal(w.kind, "push");
  assert.equal(w.frames, 8);
  assert.ok((w.blur ?? 1) > 1);

  const gen = (s: number) => ({ type: "data" as const, style: "counter" as const, items: [], seconds: s });
  const spec = reel({
    id: "t",
    frame: { w: 1080, h: 1920, fps: 30 },
    style: tokens,
    shots: [{ src: gen(3) }, { src: gen(3), enter: zoomThrough({ frames: 12, hit: "whoosh" }) }, { src: gen(3), enter: wipe({ frames: 10, direction: "left", hit: "tick" }) }],
  });
  const t = resolveTimeline(spec);
  assert.deepEqual(t.warnings, []);
  assert.equal(t.shots[1].startFrame, 90 - 12);
  assert.equal(t.shots[2].startFrame, t.shots[1].startFrame + 90 - 10);
  // The shot zoomed out of gets the matching exit, blur and all.
  assert.equal(t.shots[0].effectiveExit?.to, 1.6);
  assert.equal(t.shots[0].effectiveExit?.blur, 22);
  assert.equal(t.shots[0].effectiveExit?.frames, 12);
  // A wipe gives the outgoing shot no exit: it stands still while the edge crosses it.
  assert.equal(t.shots[1].effectiveExit, undefined);
  const hits = t.hits.map((h) => `${h.sfx}@${h.frame}`);
  assert.ok(hits.includes(`whoosh@${90 - 12}`), hits.join());
  assert.ok(hits.includes(`tick@${t.shots[2].startFrame}`), hits.join());
});

const w = (text: string, startMs: number) => ({ text, startMs, endMs: startMs + 300 });

test("chunked captions hold at most n words a card, and hold until the next card", () => {
  const cards = chunkCards([[w(" one", 0), w(" two", 400), w(" three", 800)], [w(" four", 2000)]], 2);
  assert.deepEqual(cards.map((c) => c.text), [" one two", " three", " four"]);
  assert.deepEqual(cards.map((c) => c.startMs), [0, 800, 2000]);
  assert.deepEqual(cards.map((c) => c.durationMs), [800, 1200, 300]);
  assert.deepEqual(cards[0].tokens.map((t) => [t.fromMs, t.toMs]), [[0, 300], [400, 700]]);
  // A sentence break is respected: "three" does not join "four" across runs.
  assert.equal(cards[1].tokens.length, 1);
  assert.equal(chunkCards([[w(" a", 0)]], 0).length, 1); // never fewer than one word a card
});

test("a popping word is hidden before it starts, overshoots, and rests at exactly 1", () => {
  assert.deepEqual(popState(900, 1000, 6, 30, 0.6), { opacity: 0, scale: 0.6 });
  assert.deepEqual(popState(1000 + 200, 1000, 6, 30, 0.6), { opacity: 1, scale: 1 });
  const mid = popState(1000 + 120, 1000, 6, 30, 0.6);
  assert.ok(mid.scale > 1, "overshoots past 1 on the way in");
  assert.ok(popState(1010, 1000, 6, 30, 0.6).scale < 1);
});

test("an iris opens from its point to past the farthest corner, eased", () => {
  near(irisRadius(0, 12, 0.5, 0.5, 1080, 1920), 0);
  // From the centre, the farthest corner is half the diagonal.
  assert.ok(irisRadius(12, 12, 0.5, 0.5, 1080, 1920) > Math.hypot(540, 960));
  // From a point near the top-left, it has to reach the bottom-right corner.
  assert.ok(irisRadius(12, 12, 0.1, 0.1, 1080, 1920) > Math.hypot(1080 * 0.9, 1920 * 0.9));
  assert.ok(irisRadius(2, 12, 0.5, 0.5, 1080, 1920) < 0.1 * Math.hypot(540, 960), "a pinpoint at first");
  assert.equal(irisClip(0, 12, 0.25, 0.75, 1080, 1920), "circle(0.00px at 270.00px 1440.00px)");
  assert.ok(overlaps(iris({ frames: 12 })));
  const gen = (s: number) => ({ type: "data" as const, style: "counter" as const, items: [], seconds: s });
  const t = resolveTimeline(
    reel({ id: "t", frame: { w: 1080, h: 1920, fps: 30 }, style: tokens, shots: [{ src: gen(3) }, { src: gen(3), enter: iris({ frames: 12, x: 0.3, hit: "tick" }) }] }),
  );
  assert.equal(t.shots[1].startFrame, 90 - 12);
  assert.equal(t.shots[0].effectiveExit, undefined, "the old shot stands still round the opening circle");
  assert.ok(t.hits.some((h) => h.sfx === "tick" && h.frame === 78));
});
