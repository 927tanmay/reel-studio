#!/usr/bin/env node
/**
 * Stage 05b (optional) — What a tightening pass would remove.
 *
 * A take played as recorded is footage. The same take with its dead air and
 * its hesitations closed up is an edit, and the difference is larger than any
 * transition you could put between the cuts.
 *
 * This reports; it does not change anything. It runs the engine's own
 * `pauses()` and `fillers()` over each clip's words at a few thresholds and
 * prints what each one would cost you in runtime and cuts, so the threshold is
 * chosen by looking at this transcript rather than by taste. The shotlist then
 * calls those same helpers, so the numbers stay derived from the words rather
 * than pasted in — re-transcribe and the cuts move with the audio.
 *
 *   npm run tighten 001-my-reel
 *   npm run tighten 001-my-reel -- --longer-than 0.5
 */
import path from "node:path";
import { fmt, postDir, readJson, requirePost } from "./lib.mjs";
import { FILLERS, fillers, normalise, pauses } from "../engine/words.ts";

const id = requirePost(process.argv[2]);

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};

const dir = postDir(id);
const words = await readJson(path.join(dir, "words.json"), null);
if (!words) {
  console.error(`No words.json. Run: npm run transcribe ${id}`);
  process.exit(1);
}

const media = (await readJson(path.join(dir, "media.json"), {})) ?? {};
const chosen = flag("longer-than", null);
const thresholds = chosen === null ? [0.3, 0.4, 0.6] : [chosen];
const total = (gaps) => gaps.reduce((sum, g) => sum + (g.to - g.from), 0);

/** Merged the same way resolveTimeline merges them, so the totals are real. */
const merged = (gaps) => {
  const sorted = gaps
    .map((g) => ({ from: Math.min(g.from, g.to), to: Math.max(g.from, g.to) }))
    .filter((g) => g.to > g.from)
    .sort((a, b) => a.from - b.from);
  const out = [];
  for (const g of sorted) {
    const last = out[out.length - 1];
    if (last && g.from <= last.to) last.to = Math.max(last.to, g.to);
    else out.push({ ...g });
  }
  return out;
};

fmt.head(`Tightening ${id}`);

let any = false;

for (const [key, list] of Object.entries(words)) {
  if (!Array.isArray(list) || list.length < 2) continue;
  any = true;

  const clip = media[key];
  const spoken = list[list.length - 1].endMs / 1000;
  const length = clip?.seconds ?? spoken;

  console.log(`\n  ${key} — ${length.toFixed(2)}s, ${list.length} words`);

  const found = fillers(list);
  for (const t of thresholds) {
    const p = pauses(list, { longerThan: t });
    const both = merged([...p, ...found]);
    const saved = total(both);
    const after = length - saved;
    const percent = length > 0 ? Math.round((saved / length) * 100) : 0;

    console.log(
      `    pauses > ${t.toFixed(2)}s + fillers   ` +
        `${String(both.length).padStart(3)} cuts   ` +
        `−${saved.toFixed(2)}s   →  ${after.toFixed(2)}s  (${percent}% shorter)`,
    );
  }

  // The longest pauses, with the words on either side, because a threshold
  // is a guess until you can see which silence it is actually removing.
  const ranked = pauses(list, { longerThan: Math.min(...thresholds), pad: 0 })
    .map((g) => {
      const before = list.filter((w) => w.endMs / 1000 <= g.from + 1e-6).slice(-3);
      const after = list.filter((w) => w.startMs / 1000 >= g.to - 1e-6).slice(0, 3);
      return { ...g, before, after };
    })
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, 5);

  if (ranked.length > 0) {
    console.log("\n    Longest silences");
    for (const g of ranked) {
      const before = g.before.map((w) => w.text).join(" ");
      const after = g.after.map((w) => w.text).join(" ");
      console.log(
        `      ${(g.to - g.from).toFixed(2)}s at ${g.from.toFixed(2)}s   ` +
          `…${before} ▸◂ ${after}…`,
      );
    }
  }

  const counts = new Map();
  for (const w of list) {
    const n = normalise(w.text);
    if (FILLERS.includes(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  if (counts.size > 0) {
    const summary = [...counts.entries()].map(([w, n]) => `${w} ×${n}`).join(", ");
    console.log(`\n    Fillers  ${summary}`);
  } else {
    console.log(`\n    Fillers  none of ${FILLERS.join(", ")}`);
  }
}

if (!any) {
  fmt.warn("No transcribed clips with enough words to measure.");
  process.exit(0);
}

fmt.head("Putting it in the shotlist");
console.log(
  "  Call the helpers rather than pasting the numbers above — they are derived\n" +
    "  from words.json, so they survive a re-transcribe the way a timecode cannot:\n\n" +
    '    import { tighten } from "../../../engine/words";\n\n' +
    '    { src: "hook", drop: tighten(words.hook, { longerThan: 0.4 }) }\n\n' +
    "  `tighten` is pauses and fillers together. Use `pauses` or `fillers` on their\n" +
    "  own when only one of them should apply, and check the render: this measures\n" +
    "  silence, and silence is not the same thing as a pause that was doing work.",
);
