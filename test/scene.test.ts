import { test } from "node:test";
import assert from "node:assert/strict";
import { linkEnds, missingRefs, presence, typedText } from "../engine/scene";
import { rowStarts } from "../engine/rows";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("rows with no time count on from the row before, and never arrive out of order", () => {
  assert.deepEqual(rowStarts([{ at: 0.4 }, { at: 1.2 }, { at: 2 }, {}], 0.45), [0.4, 1.2, 2, 2.45]);
  assert.deepEqual(rowStarts([{}, {}, {}], 0.5), [0, 0.5, 1]);
  // a named time later than the stagger still anchors what follows it
  assert.deepEqual(rowStarts([{}, { at: 3 }, {}], 0.5), [0, 3, 3.5]);
});

test("an item draws in after its time and holds, and fades after it leaves", () => {
  const fps = 30;
  assert.equal(presence(29, fps, 1, undefined, 18), 0);
  assert.ok(presence(35, fps, 1, undefined, 18) > 0 && presence(35, fps, 1, undefined, 18) < 1);
  assert.equal(presence(60, fps, 1, undefined, 18), 1);
  assert.equal(presence(60, fps, 1, 2, 18), 1); // still there at the moment it is due to leave
  assert.ok(presence(63, fps, 1, 2, 18) < 1);
  assert.equal(presence(100, fps, 1, 2, 18), 0);
});

test("a link stops at the glyphs' edges, and a link too short for its padding has no length", () => {
  const e = linkEnds({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
  assert.deepEqual([e.x1, e.x2, e.length], [20, 80, 60]);
  const d = linkEnds({ x: 0, y: 0 }, { x: 30, y: 40 }, 10); // length 50 along a 3-4-5
  near(d.length, 30);
  near(d.x1, 6);
  near(d.y1, 8);
  assert.equal(linkEnds({ x: 0, y: 0 }, { x: 30, y: 0 }, 20).length, 0);
});

test("a typed note shows what the clock has reached, and all of it when not typed", () => {
  const note = { text: "hello", at: 1, typeSpeed: 10 };
  assert.equal(typedText(note, 0.5), "");
  assert.equal(typedText(note, 1.25), "he");
  assert.equal(typedText(note, 9), "hello");
  assert.equal(typedText({ text: "hello", at: 1 }, 0), "hello");
});

test("a scene's links and notes may only point at items that exist", () => {
  const items = [{ id: "a", kind: "laptop", x: 0, y: 0 }, { id: "b", kind: "rack", x: 1, y: 1 }] as any;
  assert.deepEqual(missingRefs(items, [{ from: "a", to: "b" }], [{ text: "x", near: "a", at: 0 }]), []);
  assert.deepEqual(missingRefs(items, [{ from: "a", to: "zzz" }], [{ text: "x", near: "nope", at: 0 }]), ["zzz", "nope"]);
});
