import { test } from "node:test";
import assert from "node:assert/strict";
import { medianLoudness, takeGain } from "../engine/level";

const take = (key: string, loudness?: number, hasAudio = true) => ({
  key,
  file: `raw/${key}.wav`,
  seconds: 5,
  width: 0,
  height: 0,
  fps: 0,
  hasAudio,
  ...(loudness === undefined ? {} : { loudness }),
});
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const db = (gain: number) => 20 * Math.log10(gain);

test("each take is brought to the median of the post's takes", () => {
  const media = { a: take("a", -20), b: take("b", -26), c: take("c", -22) };
  assert.equal(medianLoudness(media), -22);
  near(db(takeGain(media, "a")), -2); // a little loud: down 2 dB
  near(db(takeGain(media, "b")), 4); // quiet: up 4 dB
  near(takeGain(media, "c"), 1); // the typical take is untouched
});

test("with an even count the median is the middle pair's average", () => {
  const media = { a: take("a", -20), b: take("b", -24), c: take("c", -22), d: take("d", -30) };
  assert.equal(medianLoudness(media), -23);
});

test("the correction is capped at 9 dB either way", () => {
  const media = { a: take("a", -14), b: take("b", -40), c: take("c", -20) };
  near(db(takeGain(media, "b")), 9);
  near(db(takeGain(media, "a")), -6);
});

test("nothing changes until there is something to compare, or when it is turned off", () => {
  assert.equal(takeGain({ a: take("a", -30) }, "a"), 1); // one take: no reference
  assert.equal(takeGain({ a: take("a"), b: take("b") }, "a"), 1); // never measured
  const media = { a: take("a", -20), b: take("b", -26), c: take("c", -22) };
  assert.equal(takeGain(media, "b", false), 1);
  assert.equal(takeGain(media, "missing"), 1);
  // A silent clip or an image does not pull the median.
  assert.equal(medianLoudness({ a: take("a", -20), b: take("b", -26), s: take("s", -60, false) }), -23);
});
