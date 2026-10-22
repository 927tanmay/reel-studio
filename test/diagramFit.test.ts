import { test } from "node:test";
import assert from "node:assert/strict";
import { fitDiagram, wrapLines, ROW_GAP, ROW_USABLE } from "../engine/diagramFit";

// A fake ruler: every character is half the type size wide, mono or not.
const measure = (text: string, size: number) => text.length * size * 0.5;

const base = {
  layout: "row" as const,
  window: 3,
  count: 3,
  frameW: 1080,
  frameH: 1920,
  labelSize: 44,
  subSize: 26,
  iconSize: 52,
  padding: 20,
  border: 3,
  innerGap: 8,
  minCardH: 100,
  measure,
};

test("a row's windowed cards, and the gaps between them, fit inside the frame", () => {
  for (const window of [2, 3, 4]) {
    const fit = fitDiagram({ ...base, window, count: window, nodes: [{ label: "A", visual: false }] });
    const total = window * fit.cardW + (window - 1) * fit.gap;
    assert.ok(total <= 1080 * ROW_USABLE + 1e-6, `window ${window}: ${total}`);
    assert.ok(Math.abs(fit.gap - fit.cardW * ROW_GAP) < 1e-9);
  }
});

test("greedy wrapping counts the lines a phrase takes", () => {
  assert.equal(wrapLines("one two three", 10, false, 1000, measure), 1);
  // 5 chars a word at 10px is 25px; "aaaaa bbbbb" is 55px, so a 40px line takes one word each.
  assert.equal(wrapLines("aaaaa bbbbb ccccc", 10, false, 40, measure), 3);
  assert.equal(wrapLines("", 10, false, 40, measure), 0);
});

test("text that wraps makes its card taller, not overflow", () => {
  const short = fitDiagram({ ...base, nodes: [{ label: "Key", sub: "a", visual: true }] });
  const long = fitDiagram({
    ...base,
    nodes: [{ label: "A stranger's iPhone", sub: "no internet, Bluetooth on", visual: true }],
  });
  assert.ok(long.cardH > short.cardH, `${long.cardH} should exceed ${short.cardH}`);
});

test("the card is never shorter than the layout's own height", () => {
  const fit = fitDiagram({ ...base, minCardH: 400, nodes: [{ label: "Key", visual: false }] });
  assert.equal(fit.cardH, 400);
});

test("a word wider than the card shrinks the type, but not below 75%", () => {
  const word = { label: "Extraordinarily", visual: false };
  const fit = fitDiagram({ ...base, nodes: [word] });
  assert.ok(fit.labelSize < 44 && fit.labelSize >= 44 * 0.75 - 1e-9);
  const hopeless = fitDiagram({ ...base, frameW: 200, nodes: [word] });
  assert.ok(Math.abs(hopeless.labelSize - 44 * 0.75) < 1e-9);
});

test("a column is as wide as it always was, and its gap follows its height", () => {
  const fit = fitDiagram({ ...base, layout: "column", nodes: [{ label: "Key", visual: false }] });
  assert.ok(Math.abs(fit.cardW - 1080 * 0.76) < 1e-9);
  assert.ok(Math.abs(fit.gap - fit.cardH * 0.42) < 1e-9);
});

test("a label that would take three lines is shrunk until it takes two", () => {
  const nodes = [{ label: "aaaa bbbb cccc dddd", visual: false }];
  // At 44px the fake ruler gives 22px a character; an inner width of ~150px takes four words in three lines.
  const fit = fitDiagram({ ...base, frameW: 480, window: 1, count: 1, nodes });
  assert.ok(wrapLines(nodes[0].label, fit.labelSize, false, 480 * 0.92 - 46, measure) <= 2 || fit.labelSize <= 44 * 0.75 + 1e-9);
});
