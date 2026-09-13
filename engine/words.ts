/**
 * Word anchoring.
 *
 * Pin edits to spoken words, never to timecodes. "Punch on the word generated"
 * survives every re-cut, take swap and trim, because these timings move with
 * the audio. "Punch at 4.2 seconds" is wrong the moment anything upstream
 * changes, and upstream always changes.
 *
 * The shape matches @remotion/captions so the same file drives captions too.
 */

import type { Gap } from "./spec";

export type Word = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

export type WordsFile = {
  /** Which media key these words were transcribed from. */
  source: string;
  words: Word[];
};

/** Case- and punctuation-insensitive matching, shared with caption emphasis. */
export const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

export class MissingWordError extends Error {}

/**
 * Anchors for one clip's words. Every lookup throws rather than silently
 * returning zero, because a cut landing at the start of a shot when you asked
 * for a word in the middle is the kind of mistake that survives review.
 */
export const anchors = (file: WordsFile | Word[]) => {
  const words = Array.isArray(file) ? file : file.words;

  const matches = (needle: string) => {
    const target = normalise(needle);
    return words.filter((w) => normalise(w.text) === target);
  };

  const pick = (needle: string, nth: number) => {
    const found = matches(needle);
    if (found.length === 0) {
      throw new MissingWordError(
        `The word "${needle}" is not in this transcript. ` +
          `Check spelling against words.json, or use seconds if it is genuinely not spoken.`,
      );
    }
    if (nth >= found.length) {
      throw new MissingWordError(
        `"${needle}" is spoken ${found.length} time(s); you asked for occurrence ${nth + 1}.`,
      );
    }
    return found[nth];
  };

  return {
    /** Seconds at which a word begins. */
    start: (word: string, nth = 0) => pick(word, nth).startMs / 1000,
    /** Seconds at which a word finishes. */
    end: (word: string, nth = 0) => pick(word, nth).endMs / 1000,
    /** Seconds, offset from where a word begins. Negative values lead it. */
    after: (word: string, offsetSeconds: number, nth = 0) =>
      pick(word, nth).startMs / 1000 + offsetSeconds,
    /** How many seconds elapse between two words. */
    span: (from: string, to: string) => (pick(to, 0).startMs - pick(from, 0).startMs) / 1000,
    /** How often a word is spoken. Useful before reaching for `nth`. */
    count: (word: string) => matches(word).length,
    /** Every word, for anything the helpers above do not cover. */
    all: () => words,
  };
};

/** Words that fall inside a time range, for per-shot captioning. */
export const wordsBetween = (words: Word[], startSeconds: number, endSeconds: number): Word[] =>
  words.filter((w) => w.endMs / 1000 > startSeconds && w.startMs / 1000 < endSeconds);

// ---------------------------------------------------------------------------
// Tightening
// ---------------------------------------------------------------------------

/**
 * Sounds that carry no meaning, only hesitation.
 *
 * Deliberately short. "like", "so", "actually" and "right" are filler often
 * enough that every commercial tool removes them by default, and they are
 * also ordinary words doing ordinary work often enough that removing them
 * blindly mangles a sentence. Pass your own list when you want them gone —
 * having looked at where they actually fall in the transcript.
 */
export const FILLERS = ["um", "uh", "uhh", "umm", "er", "erm", "ah", "mm", "mmm", "hmm"];

/**
 * The dead air between words, as ranges to remove.
 *
 * A take with its pauses left in plays as a recording. The same take with
 * them closed up plays as an edit, and it is the single largest difference
 * between footage and a cut — worth more than any transition.
 *
 * `pad` is what stops it sounding clipped: the drop stops short of the words
 * on either side, so a breath's worth of room survives and consonants keep
 * their attack. A gap is only removed if it is still longer than nothing once
 * both pads are taken off it.
 *
 * Ranges come back in the source's own seconds, ready for `Shot.drop`.
 */
export const pauses = (
  words: Word[],
  options: { longerThan?: number; pad?: number } = {},
): Gap[] => {
  const longerThan = options.longerThan ?? 0.4;
  const pad = options.pad ?? 0.08;
  const out: Gap[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const from = words[i].endMs / 1000;
    const to = words[i + 1].startMs / 1000;
    if (to - from <= longerThan) continue;

    const padded = { from: from + pad, to: to - pad };
    if (padded.to > padded.from) out.push(padded);
  }

  return out;
};

/**
 * Filler words, as ranges to remove.
 *
 * Padding runs the opposite way to `pauses`: outward, to take the small
 * silence that surrounds a hesitation along with it, since leaving that
 * behind is what makes a removed "um" still sound like a removed "um". It
 * never reaches past the neighbouring words, so nothing real is clipped.
 */
export const fillers = (
  words: Word[],
  options: { list?: string[]; pad?: number } = {},
): Gap[] => {
  const list = new Set((options.list ?? FILLERS).map(normalise));
  const pad = options.pad ?? 0.06;
  const out: Gap[] = [];

  words.forEach((w, i) => {
    if (!list.has(normalise(w.text))) return;

    const previousEnd = i > 0 ? words[i - 1].endMs / 1000 : -Infinity;
    const nextStart = i < words.length - 1 ? words[i + 1].startMs / 1000 : Infinity;

    out.push({
      from: Math.max(w.startMs / 1000 - pad, previousEnd),
      to: Math.min(w.endMs / 1000 + pad, nextStart),
    });
  });

  return out;
};

/**
 * Both of the above, for the common case.
 *
 * `drop: tighten(words.hook)` is the whole tightening pass for a shot. Reach
 * for `pauses` and `fillers` separately when one of them needs its own
 * threshold, or when you want only one of the two.
 */
export const tighten = (
  words: Word[],
  options: { longerThan?: number; pad?: number; fillers?: string[] } = {},
): Gap[] => [
  ...pauses(words, { longerThan: options.longerThan, pad: options.pad }),
  ...fillers(words, { list: options.fillers }),
];
