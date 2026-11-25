import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { keyOf, parseBrief } from "../engine/brief";

const hinglish = `# 016-gta-lod

## Delivery
Frame: 1080x1920 at 30fps
Language: Hinglish (captions exactly as typed)
Ceiling: 40s

## Script
Word count: 30 / 70

### hook.mov — 2 takes
"16 gb mai kaise fit ho jaata hai 256 gb ka game?"

### lod.mov — 1 take
"Door wali cheezein low detail mein, paas wali 4K mein.
Browser mein bhi yahi trick hai: srcset."

### Cta Take.MP4 – 1 take
“Follow karo, next part kal.”

If the cut runs long, drop "next part kal" from cta.

## B-roll
### gta-clip.mov — capture
"not a spoken line"
`;

test("a Hinglish brief's lines are read, quotes stripped, spelling untouched", () => {
  const b = parseBrief(hinglish);
  assert.equal(b.fromScript, true);
  assert.equal(b.hinglish, true);
  assert.match(b.because ?? "", /Language: Hinglish/);
  assert.deepEqual(b.lines, {
    hook: "16 gb mai kaise fit ho jaata hai 256 gb ka game?",
    lod: "Door wali cheezein low detail mein, paas wali 4K mein. Browser mein bhi yahi trick hai: srcset.",
    "cta-take": "Follow karo, next part kal.",
  });
});

test("a note after a line is not part of it, and B-roll headings are not script", () => {
  const b = parseBrief(hinglish);
  assert.ok(!b.lines["cta-take"].includes("next part kal\" from"));
  assert.equal(b.lines["gta-clip"], undefined);
});

test("an English brief does not opt in unless it says Captions: from script", () => {
  const english = hinglish.replace("Language: Hinglish (captions exactly as typed)", "Language: English");
  const off = parseBrief(english);
  assert.equal(off.fromScript, false);
  assert.equal(off.hinglish, false);
  assert.equal(off.lines.hook, "16 gb mai kaise fit ho jaata hai 256 gb ka game?"); // still read, just not used
  const on = parseBrief(english.replace("Ceiling: 40s", "Ceiling: 40s\nCaptions: from script"));
  assert.equal(on.fromScript, true);
  assert.equal(on.hinglish, false);
  assert.equal(on.because, "Captions: from script");
});

test("keys match the ones ingest gives the files", () => {
  assert.equal(keyOf("hook.mov"), "hook");
  assert.equal(keyOf("Cta Take.MP4"), "cta-take");
  assert.equal(keyOf("gta_clip"), "gta-clip");
});

test("no brief, no Script section, or a heading without a quote gives no lines", () => {
  assert.deepEqual(parseBrief("").lines, {});
  assert.deepEqual(parseBrief("## Delivery\nFrame: x\n").lines, {});
  assert.deepEqual(parseBrief("## Script\n### hook.mov — 1 take\nTBD\n").lines, {});
});

// The real briefs in this repository, where present (reels are not committed).
for (const [post, take, starts] of [
  ["010-find-my-offline", "cta", "That's public-key encryption."],
  ["013-chat-box-interview", "streaming", "First, streaming."],
  ["015-gta-virtualization", "hook", "GTA 6 is around 200 GB."],
] as const) {
  const file = `public/posts/${post}/brief.md`;
  test(`reads every take of ${post}'s real brief`, { skip: !existsSync(file) && "reel not on this machine" }, () => {
    const b = parseBrief(readFileSync(file, "utf8"));
    assert.ok(b.lines[take]?.startsWith(starts), b.lines[take]);
    assert.equal(b.fromScript, false); // English reels: read, not used
  });
}

test("010's trim note does not leak into its last line", { skip: !existsSync("public/posts/010-find-my-offline/brief.md") && "reel not on this machine" }, () => {
  const b = parseBrief(readFileSync("public/posts/010-find-my-offline/brief.md", "utf8"));
  assert.equal(b.lines.cta, "That's public-key encryption. Secure websites run on the same idea.");
  assert.equal(Object.keys(b.lines).length, 5);
});
