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
 *
 * Captions exactly as typed: when the brief says so (`Language: Hinglish` or
 * `Captions: from script` in its Delivery), each take's quoted line under its
 * `### <key>.mov` heading in `## Script` is the caption text; `raw/<key>.txt`
 * beside a take overrides it (an improvised take). Whisper is steered by that text and used only for *when* each word was
 * said; the words themselves are the typed ones (engine/scriptAlign.ts). This
 * is how a Hinglish line comes out as "16 gb mai kaise fit ho jaata hai" and not
 * in Devanagari or in someone else's spelling.
 *
 * `post.json` can also say `"language": "hinglish"` (Hindi and English mixed,
 * captioned in Roman letters: Whisper is told it is Hindi and steered to Roman
 * script, and any Devanagari left is romanized, engine/translit.ts), or any
 * Whisper language code ("hi", "en", "ta"…) to stop it guessing. `"spellings":
 * { "mein": "mai" }` respells words the way you write them, in either script.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { ROOT, fmt, has, postDir, readJson, requireFfmpeg, requirePost, run, writeJson } from "./lib.mjs";
import { alignScript } from "../engine/scriptAlign.ts";
import { hasDevanagari, romanize } from "../engine/translit.ts";
import { parseBrief } from "../engine/brief.ts";

const id = requirePost(process.argv[2]);
const modelFlag = process.argv.indexOf("--model");
const MODEL = modelFlag > -1 ? process.argv[modelFlag + 1] : "mlx-community/whisper-large-v3-turbo";

await requireFfmpeg();

// The model runs through mlx-whisper, which is built on Apple's MLX and needs an
// Apple Silicon Mac. Say so up front rather than letting uv fail somewhere inside.
// Everything else in the engine runs anywhere; only this stage is tied to the chip.
if ((process.platform !== "darwin" || process.arch !== "arm64") && !process.argv.includes("--force")) {
  console.error(
    `Transcription uses mlx-whisper, which needs an Apple Silicon Mac (this is ${process.platform}/${process.arch}).\n` +
      "Everything else works here. To get word timings, make words.json with any Whisper tool and put it in\n" +
      "the post's folder as { \"<media key>\": [{ text, startMs, endMs, timestampMs, confidence }] }; the README\n" +
      "has the shape. Pass --force to try mlx-whisper anyway.",
  );
  process.exit(1);
}

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
const vocabularyPrompt = vocabulary.length > 0 ? `Vocabulary: ${vocabulary.join(", ")}.` : null;

// Hinglish is Hindi as far as the model is concerned, written in Roman letters
// as far as the captions are. Told only "Hindi", Whisper writes Devanagari;
// left to guess, it may translate into English. A prompt already in Roman
// Hinglish is what steers its spelling (measured: auto and "hi" gave
// Devanagari, "en" gave a wrong translation, "hi" with this prompt gave Roman).
// The brief's own script: each take's quoted line, used as its typed captions
// when the brief says the reel's captions come from its script.
const briefFile = path.join(dir, "brief.md");
const brief = existsSync(briefFile) ? parseBrief(await readFile(briefFile, "utf8")) : { fromScript: false, because: null, hinglish: false, lines: {} };

const hinglish =
  String(config.language ?? "").toLowerCase() === "hinglish" || (config.language === undefined && brief.hinglish);
const whisperLanguage = hinglish ? "hi" : typeof config.language === "string" && config.language ? config.language : null;
const HINGLISH_PROMPT = "Hinglish, Roman script mein: yeh kaise kaam karta hai, aur kyun zaroori hai, game load nahi hota.";
const spellings = config.spellings && typeof config.spellings === "object" ? config.spellings : {};

/** A word in the post's own spelling: Devanagari romanized (for Hinglish), then `spellings` applied. */
const respell = (text) => {
  let t = hinglish && hasDevanagari(text) ? romanize(text, spellings) : text;
  const core = t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const own = spellings[core] ?? spellings[core.toLowerCase()];
  if (core && own !== undefined) t = t.replace(core, own);
  return t;
};

/** Whisper's initial prompt for one take: what was typed for it, or the Hinglish steer, plus the vocabulary. */
const promptFor = (script) => {
  // Whisper reads at most about 220 tokens of prompt; the start of the script is
  // what sets the spelling for what follows.
  const lead = script ? script.slice(0, 600) : hinglish ? HINGLISH_PROMPT : null;
  return [vocabularyPrompt, lead].filter(Boolean).join(" ") || null;
};

const work = path.join(dir, ".transcribe");
await mkdir(work, { recursive: true });

const existing = (await readJson(path.join(dir, "words.json"), {})) ?? {};
const only = process.argv.slice(3).filter((a) => !a.startsWith("--") && a !== MODEL);

fmt.head(`Transcribing ${id} with ${MODEL}`);

/** Where each take's caption text came from: "txt", "brief" or "transcript". */
const sources = (await readJson(path.join(dir, "captions.json"), {})) ?? {};
if (brief.fromScript) fmt.ok(`Captions from the brief's script (${brief.because})`);

for (const entry of Object.values(media)) {
  if (!entry.hasAudio && !entry.cleanAudio) continue;
  if (only.length > 0 && !only.includes(entry.key)) continue;

  // Always transcribe the audio the viewer will hear, so timings match the mix.
  const source = path.join(ROOT, "public", entry.cleanAudio ?? entry.file);
  const wav = path.join(work, `${entry.key}.wav`);

  await run("ffmpeg", ["-y", "-i", source, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

  // What the speaker typed for this take, if anything: then the captions are
  // that text, timed by what Whisper hears.
  // Precedence: a .txt beside the take (an improvised take, corrected by hand),
  // else the brief's line when the brief opts in, else Whisper's own spelling.
  const scriptFile = path.join(dir, "raw", `${entry.key}.txt`);
  const fromBrief = brief.fromScript ? brief.lines[entry.key] : undefined;
  const captionSource = existsSync(scriptFile) ? "txt" : fromBrief ? "brief" : "transcript";
  const script = captionSource === "txt" ? (await readFile(scriptFile, "utf8")).trim() : captionSource === "brief" ? fromBrief : null;
  if (brief.fromScript && captionSource === "transcript") {
    fmt.warn(`${entry.key}: brief.md has no "### ${entry.key}.mov" line under ## Script, so its captions use the transcriber's own spelling.`);
  }
  const initialPrompt = promptFor(script);

  fmt.ok(`${entry.key}: running whisper${whisperLanguage ? ` (${hinglish ? "hinglish" : whisperLanguage})` : ""}${script ? `, captions from ${captionSource === "txt" ? `raw/${entry.key}.txt` : "brief.md"}` : ""}`);
  await run("uv", [
    "tool", "run", "--from", "mlx-whisper", "mlx_whisper",
    wav,
    "--model", MODEL,
    "--word-timestamps", "True",
    "--output-format", "json",
    "--output-dir", work,
    "--verbose", "False",
    ...(initialPrompt ? ["--initial-prompt", initialPrompt] : []),
    ...(whisperLanguage ? ["--language", whisperLanguage] : []),
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

  const seconds = entry.seconds || 1;
  if (script) {
    const aligned = alignScript(script, words, seconds * 1000);
    sources[entry.key] = { source: captionSource, matched: aligned.matched, total: aligned.total };
    // Exactly as typed: no romanizing, no respelling. What was typed is the point.
    existing[entry.key] = aligned.words;
    const share = aligned.total ? aligned.matched / aligned.total : 1;
    fmt.ok(`${entry.key}: ${aligned.total} typed words, ${aligned.matched} matched to what was heard`);
    if (share < 0.7) {
      fmt.warn(
        `${entry.key}: only ${Math.round(share * 100)}% of ${captionSource === "txt" ? `raw/${entry.key}.txt` : "its line in brief.md"} was heard where expected. ` +
          `What was said may differ from what was typed; the unheard words are placed between their neighbours. ` +
          `Check transcript.md, and put what was actually said in raw/${entry.key}.txt to override.`,
      );
    }
  } else {
    existing[entry.key] = words.map((w) => ({ ...w, text: respell(w.text) }));
    sources[entry.key] = { source: "transcript" };
    const left = existing[entry.key].filter((w) => hasDevanagari(w.text)).length;
    fmt.ok(`${entry.key}: ${words.length} words, ${Math.round((words.length / seconds) * 60)} wpm`);
    if (!hinglish && left > 0) {
      fmt.warn(`${entry.key}: ${left} words came back in Devanagari. For Roman captions set "language": "hinglish" in post.json, or type the line into raw/${entry.key}.txt.`);
    }
  }
}

await rm(work, { recursive: true, force: true });
await writeJson(path.join(dir, "words.json"), existing);
await writeJson(path.join(dir, "captions.json"), sources);

// A line in the brief with no take to go with it is worth knowing before a render.
if (brief.fromScript) {
  for (const key of Object.keys(brief.lines)) {
    if (!media[key]) fmt.warn(`brief.md has a line for "${key}", but there is no take called that in raw/.`);
  }
}

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
  const from = sources[key];
  if (from) {
    lines.push(
      from.source === "transcript"
        ? "Captions: as transcribed."
        : `Captions: as typed in ${from.source === "txt" ? `raw/${key}.txt` : "brief.md"} (${from.matched} of ${from.total} words matched to what was heard).`,
      "",
    );
  }

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
