import { test } from "node:test";
import assert from "node:assert/strict";
import { arrivals, compactNumber, countValue, formatFigure, highlightRuns, logoColumns, missingPhrases, monogram, progress } from "../engine/blocks";

test("numbers are written the way a feed writes them", () => {
  assert.equal(compactNumber(980), "980");
  assert.equal(compactNumber(1240), "1.2K");
  assert.equal(compactNumber(52400), "52.4K");
  assert.equal(compactNumber(152400), "152K");
  assert.equal(compactNumber(4200000), "4.2M");
  assert.equal(compactNumber(3000000000), "3B");
  assert.equal(compactNumber(999950), "1M"); // never "1000K"
  assert.equal(compactNumber(-1500), "-1.5K");
});

test("figures keep their separators and decimals", () => {
  assert.equal(formatFigure(4200), "4,200");
  assert.equal(formatFigure(1250000), "1,250,000");
  assert.equal(formatFigure(3.14159, 2), "3.14");
  assert.equal(formatFigure(-12000.5, 1), "-12,000.5");
});

test("a count runs from its start to exactly its value", () => {
  assert.equal(countValue(0, 4200, 0), 0);
  assert.equal(countValue(0, 4200, 0.5), 2100);
  assert.equal(countValue(0, 4200, 1), 4200);
  assert.equal(countValue(0, 10, 0.333, 1), 3.3);
  assert.equal(countValue(0, 7, 2), 7); // past the end is the end
});

test("progress eases from 0 to 1 and holds", () => {
  assert.equal(progress(5, 10, 10), 0);
  assert.equal(progress(10, 10, 10), 0);
  assert.equal(progress(20, 10, 10), 1);
  assert.ok(progress(15, 10, 10) > 0.5); // eased out: past half by halfway
  assert.equal(progress(10, 10, 0), 0);
  assert.equal(progress(11, 10, 0), 1);
});

test("highlighted phrases are found in order, case-insensitively, without overlapping", () => {
  const text = "The model wrote the code; we wrote the tests.";
  const runs = highlightRuns(text, ["WE WROTE", "the tests"]);
  assert.equal(runs.map((r) => r.text).join(""), text); // nothing lost or doubled
  assert.deepEqual(
    runs.filter((r) => r.highlight !== undefined).map((r) => [r.text, r.highlight]),
    [["we wrote", 0], ["the tests", 1]],
  );
  // "the" appears earlier too; the second phrase is searched after the first.
  const again = highlightRuns("the cat and the dog", ["cat", "the"]);
  assert.deepEqual(again.filter((r) => r.highlight !== undefined).map((r) => r.text), ["cat", "the"]);
  assert.equal(again.find((r) => r.highlight === 1)?.text, "the");
  assert.equal(again.map((r) => r.text).join(""), "the cat and the dog");
});

test("a phrase that is not in the text is reported, and overlapping ones are not drawn twice", () => {
  assert.deepEqual(missingPhrases("ask before it fills", ["ask before", "blockchain"]), ["blockchain"]);
  const runs = highlightRuns("ask before it fills", ["ask before", "before it"]);
  assert.equal(runs.filter((r) => r.highlight !== undefined).length, 1);
  assert.deepEqual(missingPhrases("x", ["  "]), []);
});

test("a logo wall fills its rows before starting a new one", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9, 10].map((n) => logoColumns(n)), [1, 2, 3, 2, 3, 3, 3, 4]);
  assert.equal(logoColumns(6, 2), 2);
  assert.equal(logoColumns(2, 5), 2); // never more columns than logos
});

test("monograms take one letter from each of two words, or two from one", () => {
  assert.equal(monogram("Ana Ruiz"), "AR");
  assert.equal(monogram("ffmpeg"), "FF");
  assert.equal(monogram("  "), "?");
});

test("list entries arrive on their own time or a stagger after the one before, never before it", () => {
  assert.deepEqual(arrivals([{}, {}, {}], 0.5), [0.2, 0.7, 1.2]);
  assert.deepEqual(arrivals([{ at: 1 }, {}, { at: 3 }], 0.5), [1, 1.5, 3]);
  assert.deepEqual(arrivals([{ at: 2 }, { at: 1 }], 0.5), [2, 2]);
});
