import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import tokens from "../projects/default/tokens";
import { clipCues } from "../engine/cues";
import { sfxPath } from "../engine/sfx";
import { reel, resolveTimeline, wipe, zoomThrough } from "../engine/spec";

test("a plain name is a generated .wav, a path is a recording from the library", () => {
  assert.equal(sfxPath("tick"), "assets/sfx/tick.wav");
  assert.equal(sfxPath("kit/whoosh"), "assets/sfx/lib/kit/whoosh.ogg");
  assert.equal(sfxPath("pop/fs527522"), "assets/sfx/lib/pop/fs527522.ogg");
  assert.equal(sfxPath("mine/boom.mp3"), "assets/sfx/mine/boom.mp3");
});

test("every sound the default look plays is a file that exists, and every library file is CC0 and listed", () => {
  for (const [event, s] of Object.entries(tokens.sounds ?? {})) {
    assert.ok(existsSync(`public/${sfxPath(s!.sfx)}`), `${event}: ${s!.sfx}`);
  }
  const manifest = JSON.parse(readFileSync("public/assets/sfx/lib/manifest.json", "utf8"));
  for (const s of manifest.sounds) {
    assert.match(s.license, /^CC0/);
    assert.ok(existsSync(`public/assets/sfx/${s.file}`), s.file);
    assert.equal(sfxPath(s.name), `assets/sfx/${s.file}`);
  }
});

test("things landing in a clip become cues, from the same arrival rules the generator draws with", () => {
  const rows = clipCues({ type: "rows", rows: [{ title: "a", at: 0.5 }, { title: "b" }, { title: "c", at: 2 }] }, tokens, 30);
  assert.deepEqual(rows.map((c) => c.at), [0.5, 0.5 + tokens.rows!.stagger, 2]);
  const stat = clipCues({ type: "stat", value: 4, label: "x", at: 1 }, tokens, 30);
  assert.deepEqual(stat, [{ at: 1 + tokens.blocks!.countFrames / 30, kind: "count" }]);
  const post = clipCues({ type: "post", author: { name: "a" }, text: "t", at: 0.2, reply: { author: { name: "b" }, text: "r", at: 2 } }, tokens, 30);
  assert.deepEqual(post.map((c) => c.at), [0.2, 2]);
  assert.deepEqual(clipCues({ type: "terminal", lines: [] } as never, tokens, 30), []);
});

test("cues closer than a beat merge into one", () => {
  const close = clipCues({ type: "logos", items: [{ name: "a", at: 1 }, { name: "b", at: 1.05 }, { name: "c", at: 1.5 }] }, tokens, 30);
  assert.deepEqual(close.map((c) => c.at), [1, 1.5]);
});

test("the look's whoosh leads an overlapping transition, a transition's own hit replaces it, and pops follow the clip", () => {
  const gen = (s: number) => ({ type: "data" as const, style: "counter" as const, items: [], seconds: s });
  const spec = reel({
    id: "t",
    frame: { w: 1080, h: 1920, fps: 30 },
    style: tokens,
    shots: [
      { src: gen(3) },
      { src: { type: "rows", rows: [{ title: "a", at: 1 }], seconds: 3 }, enter: wipe({ frames: 10, direction: "left" }) },
      { src: gen(3), enter: zoomThrough({ frames: 12, hit: "kit/impact" }) },
    ],
  });
  const t = resolveTimeline(spec);
  const s = tokens.sounds!;
  const hits = t.hits.map((h) => `${h.sfx}@${h.frame}`);
  const wipeStart = t.shots[1].startFrame;
  assert.ok(hits.includes(`${s.transition!.sfx}@${wipeStart - s.transition!.lead!}`), hits.join());
  assert.ok(hits.includes(`${s.appear!.sfx}@${wipeStart + 30}`), hits.join());
  // The zoom-through named its own sound: no whoosh on top of it.
  const zoomStart = t.shots[2].startFrame;
  assert.ok(hits.includes(`kit/impact@${zoomStart}`), hits.join());
  assert.ok(!hits.includes(`${s.transition!.sfx}@${zoomStart - s.transition!.lead!}`), hits.join());
});
