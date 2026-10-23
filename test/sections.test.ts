import { test } from "node:test";
import assert from "node:assert/strict";
import { emphasisGroups, emphasisWords, wordReveal } from "../engine/emphasis";
import { caretOn, dashStates, subtitleAt } from "../engine/header";
import { blobCentre, resolveColour } from "../engine/backdrop";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// --- emphasis --------------------------------------------------------------
test("an array is one default group; an object names its groups", () => {
  const flat = emphasisGroups(["TLS", "network"]);
  assert.equal(flat.get("tls"), "default");
  assert.equal(flat.get("network"), "default");
  const grouped = emphasisGroups({ cool: ["TLS"], warm: ["network", "Encrypted!"] });
  assert.equal(grouped.get("tls"), "cool");
  assert.equal(grouped.get("encrypted"), "warm"); // punctuation and case don't matter
  assert.equal(emphasisGroups(undefined).size, 0);
});

test("emphasisWords flattens either form", () => {
  assert.deepEqual(emphasisWords(["a", "b"]), ["a", "b"]);
  assert.deepEqual(emphasisWords({ x: ["a"], y: ["b", "c"] }), ["a", "b", "c"]);
  assert.deepEqual(emphasisWords(undefined), []);
});

test("a word is invisible before it is spoken, fully in after its reveal, and sharpens on the way", () => {
  const fps = 30;
  assert.deepEqual(wordReveal(900, 1000, 7, fps, 14), { opacity: 0, blur: 14 });
  const mid = wordReveal(1000 + 100, 1000, 7, fps, 14);
  assert.ok(mid.opacity > 0 && mid.opacity < 1 && mid.blur > 0 && mid.blur < 14);
  const done = wordReveal(1000 + 300, 1000, 7, fps, 14);
  near(done.opacity, 1);
  near(done.blur, 0);
});

// --- header ----------------------------------------------------------------
test("a plain subtitle never swaps; a list swaps at its times", () => {
  assert.deepEqual(subtitleAt("Hello", 5, 0.3), { text: "Hello", previous: null, swap: 1 });
  const list = [{ at: 0, text: "one" }, { at: 3, text: "two" }];
  assert.equal(subtitleAt(list, 1, 0.3)!.text, "one");
  const during = subtitleAt(list, 3.1, 0.3)!;
  assert.equal(during.text, "two");
  assert.equal(during.previous, "one");
  assert.ok(during.swap > 0 && during.swap < 1);
  assert.equal(subtitleAt(list, 4, 0.3)!.swap, 1);
  assert.equal(subtitleAt([{ at: 2, text: "late" }], 1, 0.3), null);
  assert.equal(subtitleAt(undefined, 1, 0.3), null);
});

test("progress dashes fill up to the step", () => {
  assert.deepEqual(dashStates([2, 3]), [true, true, false]);
  assert.deepEqual(dashStates([1, 1]), [true]);
});

test("the caret blinks on a fixed period", () => {
  assert.equal(caretOn(0, 16), true);
  assert.equal(caretOn(15, 16), true);
  assert.equal(caretOn(16, 16), false);
  assert.equal(caretOn(32, 16), true);
});

// --- backdrop --------------------------------------------------------------
test("'accent' resolves to the shot's accent, then the palette's", () => {
  const palette = { accent: "#4FD1C5", warn: "#F97583" };
  assert.equal(resolveColour("accent", palette, "#FF4D6D"), "#FF4D6D");
  assert.equal(resolveColour("accent", palette, undefined), "#4FD1C5");
  assert.equal(resolveColour("accent", palette, "warn"), "#F97583");
  assert.equal(resolveColour("warn", palette, "#000"), "#F97583");
  assert.equal(resolveColour("#123456", palette, "#000"), "#123456");
});

test("a glow wanders inside its drift of home, and runs on reel time", () => {
  const blob = { x: 0.5, y: 0.5, drift: 0.05 };
  for (let t = 0; t < 40; t += 0.7) {
    const c = blobCentre(blob, 1, t, 0.05);
    assert.ok(Math.abs(c.x - 0.5) <= 0.05 + 1e-9);
    assert.ok(Math.abs(c.y - 0.5) <= 0.05 * 0.6 + 1e-9);
  }
  // deterministic, and different blobs are out of phase
  assert.deepEqual(blobCentre(blob, 0, 3, 0.05), blobCentre(blob, 0, 3, 0.05));
  assert.notDeepEqual(blobCentre(blob, 0, 3, 0.05), blobCentre(blob, 1, 3, 0.05));
});
