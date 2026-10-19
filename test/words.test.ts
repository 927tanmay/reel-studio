import { test } from "node:test";
import assert from "node:assert/strict";
import { anchors, MissingWordError, pauses } from "../engine/words";
import { nearestBeat } from "../engine/beats";

const w = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs, timestampMs: null, confidence: null });
const words = [w("Everything", 0, 600), w("you", 700, 800), w("know", 850, 1100), w("is", 2000, 2100), w("Everything", 2200, 2800)];

test("anchors find a word case- and punctuation-insensitively", () => {
  const at = anchors(words);
  assert.equal(at.start("know"), 0.85);
  assert.equal(at.end("know"), 1.1);
  assert.equal(at.start("EVERYTHING", 1), 2.2);
});

test("a word spoken twice says so, and a missing one throws", () => {
  const at = anchors(words);
  assert.equal(at.count("everything"), 2);
  assert.throws(() => at.start("nowhere"), MissingWordError);
  assert.throws(() => at.start("know", 3), MissingWordError);
});

test("pauses returns ranges inside the gap, padded off both words", () => {
  const gaps = pauses(words, { longerThan: 0.4, pad: 0.08 });
  assert.equal(gaps.length, 1); // only 1.1s -> 2.0s is longer than 0.4s
  assert.ok(Math.abs(gaps[0].from - 1.18) < 1e-9 && Math.abs(gaps[0].to - 1.92) < 1e-9);
});

test("a gap too short to survive its own padding is not removed", () => {
  assert.equal(pauses(words, { longerThan: 0.05, pad: 0.5 }).filter((g) => g.to <= g.from).length, 0);
});

test("nearestBeat snaps to the closest beat of the grid", () => {
  const grid = { bpm: 120, firstBeatSeconds: 0.1, periodSeconds: 0.5 };
  assert.ok(Math.abs(nearestBeat(grid, 0.3) - 0.1) < 1e-9 || Math.abs(nearestBeat(grid, 0.3) - 0.6) < 1e-9);
  assert.ok(Math.abs(nearestBeat(grid, 1.58) - 1.6) < 1e-9);
  assert.ok(Math.abs(nearestBeat(grid, 0.1) - 0.1) < 1e-9);
});
