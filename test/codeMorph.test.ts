import { test } from "node:test";
import assert from "node:assert/strict";
import { matchTokens, placeTokens } from "../engine/codeMorph";

const line = (...parts: string[]) => parts.map((content) => ({ content }));

test("places tokens by column, counting the whitespace they skip", () => {
  const tokens = placeTokens([line("const", " ", "x", " = ", "1", ";")], "#fff");
  assert.deepEqual(
    tokens.map((t) => [t.text, t.line, t.col]),
    [["const", 0, 0], ["x", 0, 6], ["=", 0, 8], ["1", 0, 10], [";", 0, 11]],
  );
});

test("a token's offset is its character position in the whole snippet", () => {
  const tokens = placeTokens([line("a", " ", "b"), line("c")], "#fff");
  assert.deepEqual(tokens.map((t) => t.offset), [0, 2, 4]);
});

test("whitespace carried inside a token is positioned, not drawn", () => {
  const [t] = placeTokens([[{ content: "   hi" }]], "#fff");
  assert.equal(t.text, "hi");
  assert.equal(t.col, 3);
});

test("an inserted line moves what follows it instead of deleting and retyping", () => {
  const a = placeTokens([line("const", " ", "x", " = ", "1", ";"), line("return", " ", "x")], "#fff");
  const b = placeTokens(
    [line("const", " ", "x", " = ", "2", ";"), line("log", "(", "x", ")"), line("return", " ", "x")],
    "#fff",
  );
  const m = matchTokens(a, b);
  const kept = m.pairs.map(([i, j]) => `${a[i].text}->${b[j].text}`);
  assert.ok(kept.includes("return->return"));
  assert.deepEqual(m.removed.map((i) => a[i].text), ["1"]);
  assert.deepEqual(m.added.map((j) => b[j].text), ["2", "log", "(", "x", ")"]);
});

test("pairs never cross: order is preserved", () => {
  const a = placeTokens([line("a", " ", "b", " ", "c")], "#fff");
  const b = placeTokens([line("c", " ", "b", " ", "a")], "#fff");
  const { pairs } = matchTokens(a, b);
  for (let i = 1; i < pairs.length; i++) {
    assert.ok(pairs[i][0] > pairs[i - 1][0] && pairs[i][1] > pairs[i - 1][1]);
  }
});

test("identical snippets match completely", () => {
  const a = placeTokens([line("x", " ", "=", " ", "1")], "#fff");
  const m = matchTokens(a, a);
  assert.equal(m.pairs.length, a.length);
  assert.equal(m.removed.length + m.added.length, 0);
});
