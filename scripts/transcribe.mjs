#!/usr/bin/env node
/**
 * Stage 05 — Word timings.
 *
 * Every spoken word gets a start and an end, locally, on this machine. One
 * file feeds three things: captions that cannot drift, the real durations the
 * timeline is built from, and the named moments cuts are pinned to.
 *
 *   npm run transcribe 001-first-cut
 *   npm run transcribe 001-first-cut -- --model mlx-community/whisper-small.en-mlx
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { ROOT, fmt, has, postDir, readJson, requireFfmpeg, requirePost, run, writeJson } from "./lib.mjs";

const id = requirePost(process.argv[2]);
const modelFlag = process.argv.indexOf("--model");
const MODEL = modelFlag > -1 ? process.argv[modelFlag + 1] : "mlx-community/whisper-large-v3-turbo";

await requireFfmpeg();

if (!(await has("uv"))) {
  console.error(
    "uv is required to run Whisper locally.\n" +
      "  brew install uv\n" +
      "Nothing is uploaded; the model runs on this machine.",
  );
  process.exit(1);
}

const dir = postDir(id);
const media = await readJson(path.join(dir, "media.json"), null);
if (!media) {
  console.error(`No media.json. Run: npm run ingest ${id}`);
  process.exit(1);
}

// Proper nouns and jargon Whisper would otherwise hear as something common
// ("Vercel" as "Varsal", "skill" as "kill"). Listed in post.json as
// `"vocabulary": ["Vercel", "AGENTS.md"]` and passed as Whisper's initial
// prompt, so the fix survives every re-transcribe instead of being hand-edited
// into words.json and lost.
const config = (await readJson(path.join(dir, "post.json"), null)) ?? {};
const vocabulary = Array.isArray(config.vocabulary) ? config.vocabulary : [];
const initialPrompt = vocabulary.length > 0 ? `Vocabulary: ${vocabulary.join(", ")}.` : null;

const work = path.join(dir, ".transcribe");
await mkdir(work, { recursive: true });

const existing = (await readJson(path.join(dir, "words.json"), {})) ?? {};
const only = process.argv.slice(3).filter((a) => !a.startsWith("--") && a !== MODEL);

fmt.head(`Transcribing ${id} with ${MODEL}`);

for (const entry of Object.values(media)) {
  if (!entry.hasAudio && !entry.cleanAudio) continue;
  if (only.length > 0 && !only.includes(entry.key)) continue;

  // Always transcribe the audio the viewer will hear, so timings match the mix.
  const source = path.join(ROOT, "public", entry.cleanAudio ?? entry.file);
  const wav = path.join(work, `${entry.key}.wav`);

  await run("ffmpeg", ["-y", "-i", source, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

  fmt.ok(`${entry.key}: running whisper`);
  await run("uv", [
    "tool", "run", "--from", "mlx-whisper", "mlx_whisper",
    wav,
    "--model", MODEL,
    "--word-timestamps", "True",
    "--output-format", "json",
    "--output-dir", work,
    "--verbose", "False",
    ...(initialPrompt ? ["--initial-prompt", initialPrompt] : []),
  ]);

  const produced = path.join(work, `${entry.key}.json`);
  if (!existsSync(produced)) {
    fmt.fail(`${entry.key}: whisper produced no output`);
    continue;
  }

  const raw = JSON.parse(await readFile(produced, "utf8"));
  const words = [];
  for (const segment of raw.segments ?? []) {
    for (const w of segment.words ?? []) {
      const text = String(w.word ?? "").trim();
      if (!text) continue;

      // Whisper hears "agents dot md" as two words, "AGENTS" and ".md", and a
      // caption would print them with a space between. A token that starts
      // with a dot and a letter is an extension: rejoin it to the word before.
      const previous = words[words.length - 1];
      if (previous && /^\.[a-z]/i.test(text) && /[a-z0-9]$/i.test(previous.text)) {
        previous.text += text;
        previous.endMs = Math.round(w.end * 1000);
        previous.timestampMs = Math.round((previous.startMs + previous.endMs) / 2);
        continue;
      }

      words.push({
        text,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
        confidence: w.probability ?? null,
      });
    }
  }

  existing[entry.key] = words;
  const spoken = words.length;
  const seconds = entry.seconds || 1;
  fmt.ok(`${entry.key}: ${spoken} words, ${Math.round((spoken / seconds) * 60)} wpm`);
}

await rm(work, { recursive: true, force: true });
await writeJson(path.join(dir, "words.json"), existing);

/**
 * A compact, readable rendering of the same data.
 *
 * words.json is written for the engine, which imports it at build time and
 * costs nothing to hold. It is a terrible thing to *read*: every word is an
 * object, so a few hundred spoken words become tens of thousands of tokens.
 * This file carries the same information at roughly a tenth the size, which is
 * what an agent should read when it is choosing where to cut.
 */
const lines = ["# Transcript", ""];
for (const [key, words] of Object.entries(existing)) {
  if (!words.length) continue;
  const seconds = words[words.length - 1].endMs / 1000;
  const wpm = Math.round((words.length / Math.max(seconds, 0.1)) * 60);
  lines.push(`## ${key}  —  ${seconds.toFixed(2)}s, ${words.length} words, ${wpm} wpm`, "");

  let out = "";
  words.forEach((w, i) => {
    // A timestamp every eight words is enough to find any word's neighbourhood;
    // exact millisecond timings stay in words.json where anchors() reads them.
    if (i % 8 === 0) out += `\n[${(w.startMs / 1000).toFixed(2)}] `;
    out += `${w.text} `;
  });
  lines.push(out.trim(), "");
}
await writeFile(path.join(dir, "transcript.md"), lines.join("\n") + "\n");

fmt.head("Written: words.json, transcript.md");
console.log(
  "  Read transcript.md when deciding where to cut; words.json is for the engine.\n" +
    "  Anchor edits to words rather than timecodes. A word survives a re-cut; a\n" +
    "  timecode does not.",
);
