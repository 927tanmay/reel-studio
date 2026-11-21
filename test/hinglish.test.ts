import { test } from "node:test";
import assert from "node:assert/strict";
import { hasDevanagari, romanize } from "../engine/translit";
import { alignScript, comparable, similarity } from "../engine/scriptAlign";
import { anchors, normalise } from "../engine/words";

test("Devanagari comes out the way Hinglish is typed", () => {
  assert.equal(romanize("कैसे फिट हो जाता है"), "kaise phit ho jaata hai");
  assert.equal(romanize("असल में गेम पूरा लोड नहीं होता"), "asal mein gem poora lod nahi hota");
  assert.equal(romanize("कमरा समझना हिस्सा ज़रूरी"), "kamra samajhna hissa zaroori");
  assert.equal(romanize("क्या बात है। दुनिया"), "kya baat hai. duniya");
  // Anything not Devanagari passes through untouched.
  assert.equal(romanize("16 GB का game"), "16 GB ka game");
  assert.equal(romanize("२५६"), "256");
});

test("a post's own spellings win over the table and the rules", () => {
  assert.equal(romanize("में गेम", { "में": "mai", "गेम": "game" }), "mai game");
  assert.ok(hasDevanagari("game में"));
  assert.ok(!hasDevanagari("game mein"));
});

test("two spellings of one Hinglish word are alike; two different words are not", () => {
  assert.equal(comparable("Game?"), "game");
  assert.equal(comparable("में"), "mein");
  assert.ok(similarity("hissa", "hisa") >= 0.6);
  assert.ok(similarity("woh", "wo") >= 0.6);
  assert.ok(similarity("jo", "jho") >= 0.6);
  assert.ok(similarity("poora", "pura") >= 0.6);
  assert.ok(similarity("game", "गेम") >= 0.6);
  assert.ok(similarity("kaise", "memory") < 0.4);
});

const heard = (s: string, gapMs = 400) =>
  s.split(" ").map((text, i) => ({ text, startMs: i * gapMs, endMs: i * gapMs + 300, confidence: 0.9 }));

test("typed words take the timing of what was heard, spelled as typed", () => {
  const typed = "16 gb mai kaise fit ho jaata hai 256 gb ka game?";
  const r = alignScript(typed, heard("16 GB में कैसे फित हो जाता है 256 GB का गेम,"));
  assert.deepEqual(r.words.map((w) => w.text), typed.split(" "));
  assert.deepEqual(r.words.map((w) => w.startMs), [0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000, 4400]);
  assert.equal(r.total, 12);
  assert.ok(r.matched >= 11);
});

test("an extra heard word is passed over, and a typed word nobody said is placed between its neighbours", () => {
  const r = alignScript("game poora load nahi hota", heard("game um pura load hota"));
  assert.deepEqual(r.words.map((w) => w.text), ["game", "poora", "load", "nahi", "hota"]);
  assert.equal(r.words[1].startMs, 800); // "poora" skips the "um"
  assert.equal(r.words[2].startMs, 1200);
  // "nahi" was not heard: it sits after "load" ends and before "hota" starts.
  assert.ok(r.words[3].startMs >= r.words[2].endMs && r.words[3].endMs <= r.words[4].startMs);
  assert.equal(r.words[3].confidence, null);
});

test("one word heard where two were typed, and two heard where one was typed", () => {
  const joined = alignScript("256 gb ka game", [
    { text: "256GB", startMs: 0, endMs: 600 },
    { text: "ka", startMs: 700, endMs: 800 },
    { text: "game", startMs: 900, endMs: 1200 },
  ]);
  assert.deepEqual(joined.words.map((w) => [w.text, w.startMs]), [["256", 0], ["gb", 360], ["ka", 700], ["game", 900]]);
  const split = alignScript("smartphone hai", [
    { text: "smart", startMs: 0, endMs: 300 },
    { text: "phone", startMs: 300, endMs: 600 },
    { text: "hai", startMs: 700, endMs: 900 },
  ]);
  assert.deepEqual(split.words.map((w) => [w.text, w.startMs, w.endMs]), [["smartphone", 0, 600], ["hai", 700, 900]]);
});

test("timings never go backwards, and nothing heard still gives every word a place", () => {
  const r = alignScript("ek do teen", [], 3000);
  assert.deepEqual(r.words.map((w) => w.text), ["ek", "do", "teen"]);
  assert.ok(r.words.every((w, i) => i === 0 || w.startMs >= r.words[i - 1].startMs));
  assert.equal(r.matched, 0);
  assert.deepEqual(alignScript("  ", heard("a b")).words, []);
});

test("anchors work on Hindi words in either script", () => {
  assert.equal(normalise("चाहिए।"), "चाहिए");
  assert.equal(normalise("Game?"), "game");
  const a = anchors([
    { text: "सिर्फ", startMs: 100, endMs: 300, timestampMs: null, confidence: null },
    { text: "memory", startMs: 400, endMs: 700, timestampMs: null, confidence: null },
  ]);
  assert.equal(a.start("सिर्फ"), 0.1);
  assert.equal(a.start("Memory"), 0.4);
});
