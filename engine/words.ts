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

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

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
