import { test } from "node:test";
import assert from "node:assert/strict";
import tokens from "../projects/default/tokens";
import { buildSections, describePlan, findPhrase, howItWorks, listicle, mythFact, parseWhen, sections, versus, whenSeconds } from "../engine/formats";
import { reel, resolveTimeline } from "../engine/spec";
import type { Word } from "../engine/words";

/** A transcript from a script: every word 0.3s, a 0.1s gap after each. */
const speak = (script: string, startAt = 0): Word[] =>
  script.split(/\s+/).map((text, i) => {
    const startMs = Math.round((startAt + i * 0.4) * 1000);
    return { text, startMs, endMs: startMs + 300, timestampMs: null, confidence: null };
  });

const FPS = 30;
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const script =
  "Five tools worth a look. Number one Jam. It records the bug. Number two Replay. Go back to any state. Number three Trace. See every request.";
const words = speak(script);
const voice = { key: "voice", words };
const rows = [{ icon: "play" as const, title: "Recording" }];

test("parseWhen reads an occurrence and an offset", () => {
  assert.deepEqual(parseWhen("server"), { phrase: "server", nth: 0, offset: 0 });
  assert.deepEqual(parseWhen("server#2"), { phrase: "server", nth: 1, offset: 0 });
  assert.deepEqual(parseWhen("the server+0.2s"), { phrase: "the server", nth: 0, offset: 0.2 });
  assert.deepEqual(parseWhen("end-to-end"), { phrase: "end-to-end", nth: 0, offset: 0 });
});

test("findPhrase matches a run of words, ignoring case and punctuation, inside a window", () => {
  const first = words.find((w) => w.text === "Number")!.startMs / 1000;
  const second = words.filter((w) => w.text === "Number")[1].startMs / 1000;
  assert.equal(findPhrase(words, "number one", 0, 99), first);
  assert.equal(findPhrase(words, "NUMBER, two", 0, 99), second);
  // Outside the window it is not found, even though it is in the take.
  assert.equal(findPhrase(words, "Replay", 0, 3), undefined);
  // The second occurrence of a word.
  const n = words.filter((w) => /^number$/i.test(w.text));
  assert.equal(findPhrase(words, "number", 0, 99, 2), n[2].startMs / 1000);
  assert.equal(findPhrase(words, "number", 0, 99, 3), undefined);
});

test("a number written as a word finds the digit the transcript wrote, and the other way round", () => {
  const w = speak("you must drink 8 glasses and twenty minutes of sun");
  const at = (phrase: string) => findPhrase(w, phrase, 0, 99);
  near(at("eight glasses")!, 0.4 * 3, 1e-9);
  near(at("8")!, 0.4 * 3, 1e-9);
  near(at("20 minutes")!, 0.4 * 6, 1e-9);
  assert.equal(findPhrase(w, "nine", 0, 99), undefined);
});

test("a phrase that is not spoken throws, and says what was heard", () => {
  assert.throws(() => whenSeconds("blockchain", { words, from: 0, to: 4, base: 0, where: "x" }), /Heard there: Five tools worth/);
});

const three = () =>
  buildSections({
    voice,
    fps: FPS,
    sections: [
      { header: { title: "Intro" }, clips: [{ src: { type: "data", style: "counter", items: [{ label: "tools", value: 5 }] } }] },
      { starts: "number one", header: { title: "Jam" }, clips: [{ src: { type: "rows", rows } }] },
      { starts: "number two", header: { title: "Replay" }, clips: [{ src: { type: "rows", rows } }] },
    ],
  });

test("sections start on their phrase and abut with no gap or overlap", () => {
  const { shots, plan } = three();
  assert.equal(shots.length, 3);
  const frames = shots.map((s) => Math.round((s.seconds ?? 0) * FPS));
  const ins = shots.map((s) => Math.round((s.in ?? 0) * FPS));
  assert.equal(ins[0], 0);
  assert.equal(ins[1], ins[0] + frames[0]);
  assert.equal(ins[2], ins[1] + frames[1]);
  // "number one" is spoken at word 4 (1.6s); the section opens a lead before it.
  const numberOne = words.findIndex((w) => w.text === "Number") * 0.4;
  assert.ok(Math.abs(ins[1] / FPS - (numberOne - 0.12)) < 1 / FPS);
  // The last section runs to the final word plus the tail.
  const last = words[words.length - 1].endMs / 1000 + 0.4;
  assert.ok(Math.abs((ins[2] + frames[2]) / FPS - last) < 1 / FPS);
  assert.equal(plan.length, 3);
  assert.match(describePlan(plan, FPS), /Replay/);
});

test("every shot borrows the voice and states its own length", () => {
  const { shots } = three();
  for (const s of shots) {
    assert.deepEqual(s.audio, { from: "voice" });
    assert.equal(typeof s.src === "object" && s.src.seconds, s.seconds);
    assert.equal(s.backdrop, true);
  }
});

test("a phrase inside a clip is timed from that clip's own start", () => {
  const shots = sections({
    voice,
    fps: FPS,
    sections: [
      { clips: [{ src: { type: "data", style: "counter", items: [] } }] },
      {
        starts: "number two",
        clips: [{ src: { type: "rows", rows: [{ title: "Go back", at: "Go back" }, { title: "State", at: "state+0.5s" }] } }],
      },
    ],
  });
  const src = shots[1].src as { rows: { at: number }[] };
  const startOfShot = shots[1].in!;
  const goBack = words.find((w) => w.text === "Go")!.startMs / 1000;
  const state = words.find((w) => w.text === "state.")!.startMs / 1000;
  assert.ok(Math.abs(src.rows[0].at - (goBack - startOfShot)) < 0.01);
  assert.ok(Math.abs(src.rows[1].at - (state + 0.5 - startOfShot)) < 0.01);
});

test("a phrase said earlier in the reel never captures a later section", () => {
  const w = speak("one thing. two thing. one thing again.");
  const shots = sections({
    voice: { key: "v", words: w },
    fps: FPS,
    sections: [
      { clips: [{ src: { type: "data", style: "counter", items: [] } }] },
      { starts: "thing", clips: [{ src: { type: "data", style: "counter", items: [] } }] },
      { starts: "thing", clips: [{ src: { type: "data", style: "counter", items: [] } }] },
    ],
  });
  assert.ok(shots[1].in! < shots[2].in!);
  assert.ok(shots[2].in! > w[3].startMs / 1000 - 0.2);
});

test("a missing start phrase names what is there instead", () => {
  assert.throws(
    () => sections({ voice, fps: FPS, sections: [{ clips: [{ src: { type: "rows", rows } }] }, { starts: "number nine", clips: [{ src: { type: "rows", rows } }] }] }),
    /not spoken.*Heard from there: Five tools/s,
  );
  assert.throws(() => sections({ fps: FPS, sections: [{ clips: [{ src: { type: "rows", rows } }] }] }), /no voice/);
  assert.throws(() => sections({ voice, fps: FPS, sections: [{ clips: [{ src: { type: "rows", rows } }] }, { clips: [{ src: { type: "rows", rows } }] }] }), /needs `starts`/);
});

test("a section with several clips splits at the phrase and keeps one header still", () => {
  const shots = sections({
    voice,
    fps: FPS,
    sections: [
      {
        header: { kicker: "TOOL", title: "Jam", subtitle: [{ at: 0, text: "first" }, { at: "bug", text: "second" }] },
        clips: [
          { src: { type: "rows", rows } },
          { at: "bug", src: { type: "rows", rows }, shot: { impacts: [{ kind: "flash", at: 0 }] } },
        ],
      },
    ],
  });
  assert.equal(shots.length, 2);
  assert.equal(shots[1].in! * FPS, Math.round(shots[0].in! * FPS) + Math.round(shots[0].seconds! * FPS));
  assert.equal(shots[0].header?.continued, undefined);
  assert.equal(shots[1].header?.continued, true);
  assert.equal(shots[1].impacts?.[0].kind, "flash");
  // The clip opens a lead before the word "bug", so the swap on it lands just inside the second clip.
  const second = shots[1].header?.subtitle as { at: number; text: string }[];
  assert.deepEqual(second.map((x) => x.text), ["first", "second"]);
  assert.ok(Math.abs(second[1].at - 0.12) < 0.02);
  assert.ok(Array.isArray(shots[0].header?.subtitle));
});

test("a clip that takes over outside the section is refused", () => {
  assert.throws(
    () =>
      sections({
        voice,
        fps: FPS,
        sections: [{ clips: [{ src: { type: "rows", rows } }, { at: 999, src: { type: "rows", rows } }] }],
      }),
    /outside the section/,
  );
});

test("a listicle numbers its items, fills the progress pill and opens on the first item without an intro", () => {
  const shots = listicle({
    voice,
    fps: FPS,
    label: "TOOL",
    accents: ["#111", "#222"],
    items: [
      { starts: "number one", name: "Jam", subtitle: "bugs", rows },
      { starts: "number two", name: "Replay", rows },
      { starts: "number three", name: "Trace", rows },
    ],
  });
  assert.equal(shots.length, 3);
  assert.equal(shots[0].in, 0);
  assert.deepEqual(shots.map((s) => s.header?.kicker), ["TOOL 01", "TOOL 02", "TOOL 03"]);
  assert.deepEqual(shots.map((s) => s.header?.step), [[1, 3], [2, 3], [3, 3]]);
  assert.deepEqual(shots.map((s) => s.accent), ["#111", "#222", "#111"]);
  assert.equal((shots[0].src as { type: string }).type, "rows");
});

test("a listicle with an intro and an outro puts the item on its name by default", () => {
  const shots = listicle({
    voice,
    fps: FPS,
    intro: { title: "Five tools", clips: [{ src: { type: "data", style: "counter", items: [] } }] },
    items: [{ name: "Jam", rows }, { name: "Replay", rows }],
    outro: { starts: "number three", clips: [{ src: { type: "data", style: "counter", items: [] } }] },
  });
  assert.equal(shots.length, 4);
  assert.equal(shots[0].in, 0);
  const jam = words.find((w) => w.text === "Jam.")?.startMs ?? words.find((w) => w.text === "Jam")!.startMs;
  assert.ok(Math.abs(shots[1].in! - (jam / 1000 - 0.12)) < 1 / FPS);
  assert.equal(shots[0].header?.step, undefined);
});

test("an item with no clips and no rows is refused", () => {
  assert.throws(() => listicle({ voice, fps: FPS, items: [{ name: "Jam" }] }), /needs `clips` or `rows`/);
});

test("how-it-works keeps one header still across steps and swaps only the subtitle", () => {
  const shots = howItWorks({
    voice,
    fps: FPS,
    topic: "how it works",
    title: "A tour",
    steps: [
      { subtitle: "one", clips: [{ src: { type: "rows", rows } }] },
      { starts: "number two", subtitle: "two", clips: [{ src: { type: "rows", rows } }] },
    ],
  });
  assert.equal(shots[0].header?.kicker, "// how it works");
  assert.equal(shots[0].header?.kickerStyle, "comment");
  assert.equal(shots[0].header?.continued, undefined);
  assert.equal(shots[1].header?.continued, true);
  assert.equal(shots[1].header?.subtitle, "two");
});

test("separate takes each start at their own zero and run their measured length", () => {
  const a = speak("first take here");
  const b = speak("second take");
  const media = {
    a: { key: "a", file: "raw/a.wav", seconds: 3, width: 0, height: 0, fps: 0, hasAudio: true },
    b: { key: "b", file: "raw/b.wav", seconds: 2, width: 0, height: 0, fps: 0, hasAudio: true },
  };
  const shots = sections({
    fps: FPS,
    media,
    sections: [
      { voice: { key: "a", words: a }, clips: [{ src: { type: "rows", rows } }] },
      { voice: { key: "b", words: b }, clips: [{ src: { type: "rows", rows } }] },
    ],
  });
  assert.deepEqual(shots.map((s) => s.in), [0, 0]);
  assert.deepEqual(shots.map((s) => (s.audio as { from: string }).from), ["a", "b"]);
  // Capped at the take's own length, and no more than the speech plus the tail.
  assert.ok(Math.abs(shots[0].seconds! - (a[2].endMs / 1000 + 0.4)) < 1 / FPS);
  assert.ok(Math.abs(shots[1].seconds! - (b[1].endMs / 1000 + 0.4)) < 1 / FPS);
});

test("built shots resolve through the timeline with no warnings and cover the whole take", () => {
  const shots = listicle({
    voice,
    fps: FPS,
    items: [
      { starts: "number one", name: "Jam", rows },
      { starts: "number two", name: "Replay", rows },
    ],
    common: { captionStyle: "headline" },
  });
  const total = words[words.length - 1].endMs / 1000 + 0.4;
  const spec = reel({
    id: "t",
    frame: { w: 1080, h: 1920, fps: FPS },
    style: tokens,
    media: { voice: { key: "voice", file: "raw/voice.wav", seconds: total + 1, width: 0, height: 0, fps: 0, hasAudio: true } },
    words: { voice: words },
    shots,
  });
  const t = resolveTimeline(spec);
  assert.deepEqual(t.warnings, []);
  assert.ok(Math.abs(t.durationInFrames - Math.round(total * FPS)) <= 1);
  // The voice plays unbroken: each shot reads the take from where the last stopped.
  const reads = t.shots.map((r) => r.sounds[0].segments[0].sourceStart);
  const lens = t.shots.map((r) => r.durationInFrames / FPS);
  assert.ok(Math.abs(reads[1] - (reads[0] + lens[0])) < 1 / FPS);
  assert.equal(shots[0].captionStyle, "headline");
});

// ---------------------------------------------------------------------------
// versus and myth-or-fact

const vs = speak(
  "Cloud or local, which one wins. Speed. Cloud is instant, local takes a minute. Price. Cloud costs monthly, local is free. So the winner is local.",
);
const vsVoice = { key: "voice", words: vs };
type RowOut = { title: string; sub?: string; status?: string; tone?: string; at?: number; icon?: string };
const rowsOf = (shot: { src?: unknown }) => (shot.src as { rows: RowOut[] }).rows;

test("a versus reel makes a round per topic: two rows, the winner ticked, each on its own word", () => {
  const shots = versus({
    voice: vsVoice,
    fps: FPS,
    a: { name: "Cloud", icon: "cloud", tone: "client" },
    b: { name: "Local", icon: "database", tone: "server" },
    intro: { title: "Cloud or local" },
    rounds: [
      { topic: "Speed", a: { text: "Instant", at: "instant" }, b: { text: "A minute", at: "minute" }, winner: "a" },
      { topic: "Price", a: { text: "Monthly", at: "monthly" }, b: { text: "Free", at: "free" }, winner: "b" },
    ],
    verdict: { starts: "so the winner", title: "Verdict", winner: "b", text: "Local wins" },
  });
  assert.equal(shots.length, 4);
  assert.deepEqual(shots.map((s) => s.header?.kicker), [undefined, "ROUND 01", "ROUND 02", undefined]);
  assert.deepEqual(shots[1].header?.step, [1, 2]);
  assert.equal(shots[1].header?.title, "Speed");
  assert.equal(shots[1].header?.subtitle, "Cloud vs Local");

  const [a, b] = rowsOf(shots[1]);
  assert.equal(a.status, "check");
  assert.equal(b.status, undefined);
  assert.equal(a.sub, "Cloud");
  assert.equal(a.tone, "client");
  assert.equal(b.tone, "server");
  // Each row lands on its own word, in shot time, in the order they are said.
  assert.ok(typeof a.at === "number" && typeof b.at === "number" && a.at < b.at);
  assert.equal(rowsOf(shots[2])[1].status, "check");

  // The intro with no clips shows the two sides; the verdict shows the winner.
  assert.deepEqual(rowsOf(shots[0]).map((r) => r.title), ["Cloud", "Local"]);
  const v = rowsOf(shots[3]);
  assert.equal(v.length, 1);
  assert.equal(v[0].title, "Local wins");
  assert.equal(v[0].status, "check");
});

test("a draw ticks neither, and the first round opens the take when there is no intro", () => {
  const shots = versus({
    voice: vsVoice,
    fps: FPS,
    a: { name: "Cloud", icon: "cloud" },
    b: { name: "Local", icon: "database" },
    rounds: [
      { topic: "Speed", a: { text: "Instant" }, b: { text: "A minute" } },
      { topic: "Price", a: { text: "Monthly" }, b: { text: "Free" } },
    ],
  });
  assert.equal(shots[0].in, 0);
  assert.ok(rowsOf(shots[0]).every((r) => r.status === undefined));
  assert.equal(shots[1].in! > 0, true);
});

test("a verdict with nothing to show is refused, and a round's topic that is not spoken says what was heard", () => {
  assert.throws(
    () => versus({ voice: vsVoice, fps: FPS, a: { name: "A", icon: "cloud" }, b: { name: "B", icon: "key" }, rounds: [{ topic: "Speed", a: { text: "x" }, b: { text: "y" } }], verdict: { starts: "so the winner" } }),
    /needs `clips`, or a `winner`/,
  );
  assert.throws(
    () => versus({ voice: vsVoice, fps: FPS, a: { name: "A", icon: "cloud" }, b: { name: "B", icon: "key" }, intro: { title: "x" }, rounds: [{ topic: "Latency", a: { text: "x" }, b: { text: "y" } }] }),
    /not spoken.*Heard from there/s,
  );
});

const mf = speak(
  "Everyone says cold showers burn fat. In fact the effect is tiny. Another one, you must drink eight glasses. Actually water needs vary a lot.",
);

test("myth or fact makes a claim per section: the myth crossed, the fact ticked, the fact on its word", () => {
  const shots = mythFact({
    voice: { key: "voice", words: mf },
    fps: FPS,
    claims: [
      { myth: { text: "Cold showers burn fat" }, fact: { text: "The effect is tiny", at: "tiny" } },
      { starts: "another one", myth: { text: "Drink eight glasses", at: "eight" }, fact: { text: "Needs vary", at: "vary" } },
    ],
  });
  assert.equal(shots.length, 2);
  assert.equal(shots[0].in, 0);
  assert.deepEqual(shots.map((s) => s.header?.kicker), ["MYTH 01", "MYTH 02"]);
  const [myth, fact] = rowsOf(shots[0]);
  assert.equal(myth.icon, "cross");
  assert.equal(myth.status, "error");
  assert.equal(myth.sub, "MYTH");
  assert.equal(myth.tone, "warn");
  assert.equal(fact.status, "check");
  assert.equal(fact.sub, "FACT");
  assert.equal(fact.tone, "ok");
  assert.ok((fact.at ?? 0) > 0, "the fact lands on its word, after the section opens");
  // The second claim's rows are timed from the second section's own start.
  const second = rowsOf(shots[1]);
  assert.ok(second[0].at! < second[1].at!);
});

test("labels and tones are the look's to name, not the engine's", () => {
  const shots = mythFact({
    voice: { key: "voice", words: mf },
    fps: FPS,
    labels: { myth: "BUNK", fact: "TRUE" },
    tones: { myth: "#111111", fact: "#222222" },
    claims: [{ myth: { text: "a" }, fact: { text: "b" } }],
  });
  const [m, f] = rowsOf(shots[0]);
  assert.deepEqual([m.sub, f.sub, m.tone, f.tone], ["BUNK", "TRUE", "#111111", "#222222"]);
  assert.equal(shots[0].header?.kicker, "BUNK 01");
});

test("versus and myth-or-fact shots resolve through the timeline with no warnings", () => {
  const shots = mythFact({
    voice: { key: "voice", words: mf },
    fps: FPS,
    claims: [
      { myth: { text: "Cold showers burn fat" }, fact: { text: "The effect is tiny", at: "tiny" } },
      { starts: "another one", myth: { text: "Drink eight glasses" }, fact: { text: "Needs vary", at: "vary" } },
    ],
  });
  const total = mf[mf.length - 1].endMs / 1000 + 0.4;
  const t = resolveTimeline(
    reel({
      id: "t",
      frame: { w: 1080, h: 1920, fps: FPS },
      style: tokens,
      media: { voice: { key: "voice", file: "raw/voice.wav", seconds: total + 1, width: 0, height: 0, fps: 0, hasAudio: true } },
      words: { voice: mf },
      shots,
    }),
  );
  assert.deepEqual(t.warnings, []);
  assert.ok(Math.abs(t.durationInFrames - Math.round(total * FPS)) <= 1);
});
