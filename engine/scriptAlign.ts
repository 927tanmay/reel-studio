import { romanize } from "./translit";

/**
 * Captions exactly as the speaker typed them, timed by what the transcriber
 * heard.
 *
 * A transcriber decides spelling itself, and for Hinglish there is no right
 * spelling to decide: "mai", "mein" and "me" are all in use, and a Hindi model
 * may write the line in Devanagari. So the typed script is the text, and the
 * transcript only supplies *when* each word was said. The two word lists are
 * aligned (a global alignment that allows a misheard word, an extra heard word
 * such as an "um", a typed word that was not heard, and one word split or
 * joined differently on either side — "256GB" against "256 gb"); every typed
 * word takes the timing of what it was matched to, and a typed word with no
 * match is placed between its neighbours, shared out by length.
 *
 * Pure; the transcribe stage calls it when `raw/<key>.txt` exists.
 */

export type Heard = { text: string; startMs: number; endMs: number; confidence?: number | null };
export type Timed = { text: string; startMs: number; endMs: number; timestampMs: number; confidence: number | null };

/** Letters and digits only, in Roman script, lower case — what two spellings of one word share. */
export const comparable = (s: string): string =>
  romanize(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * The consonant outline of a word, with Hinglish's interchangeable spellings
 * folded together: vowels dropped after the first letter, doubled letters
 * single, and ph/f, w/v, z/j, q/k, "sh"/"s" treated as one.
 */
const skeleton = (s: string): string => {
  const folded = s.replace(/ph/g, "f").replace(/w/g, "v").replace(/z/g, "j").replace(/q/g, "k").replace(/sh/g, "s");
  const head = folded.slice(0, 1);
  const tail = folded.slice(1).replace(/[aeiouy]/g, "");
  return (head + tail).replace(/(.)\1+/g, "$1");
};

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

const ratio = (a: string, b: string) => (a.length || b.length ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 1);

/** How alike two words are, 0..1, by spelling or by consonant outline, whichever is kinder. */
export const similarity = (a: string, b: string): number => {
  const x = comparable(a);
  const y = comparable(b);
  if (!x || !y) return x === y ? 1 : 0;
  return Math.max(ratio(x, y), ratio(skeleton(x), skeleton(y)) * 0.95);
};

/** A pair at this similarity or above counts as heard, for the report. */
export const CONFIDENT = 0.6;

const pairScore = (sim: number) => sim * 2 - 0.8;
const SKIP = -0.5;
const MERGE = 0.1;

type Step = { kind: "pair" | "typed" | "heard" | "split" | "join"; sim?: number };

export type Alignment = {
  words: Timed[];
  /** Typed words matched to a heard word at `CONFIDENT` or better. */
  matched: number;
  total: number;
};

/**
 * Times every word of `script` from `heard`. `fallbackMs` is the length to
 * spread over when nothing at all was heard.
 */
export const alignScript = (script: string, heard: Heard[], fallbackMs = 0): Alignment => {
  const typed = script.split(/\s+/).filter(Boolean);
  const n = typed.length;
  const m = heard.length;
  if (n === 0) return { words: [], matched: 0, total: 0 };

  // Best score aligning the first i typed words with the first j heard ones.
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-Infinity));
  const back: (Step | null)[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  score[0][0] = 0;
  const offer = (i: number, j: number, from: number, step: Step) => {
    if (from > score[i][j]) {
      score[i][j] = from;
      back[i][j] = step;
    }
  };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (i === 0 && j === 0) continue;
      if (i > 0 && j > 0) {
        const sim = similarity(typed[i - 1], heard[j - 1].text);
        offer(i, j, score[i - 1][j - 1] + pairScore(sim), { kind: "pair", sim });
      }
      if (i > 0) offer(i, j, score[i - 1][j] + SKIP, { kind: "typed" });
      if (j > 0) offer(i, j, score[i][j - 1] + SKIP, { kind: "heard" });
      if (i > 0 && j > 1) {
        const sim = similarity(typed[i - 1], heard[j - 2].text + heard[j - 1].text);
        offer(i, j, score[i - 1][j - 2] + pairScore(sim) - MERGE, { kind: "split", sim });
      }
      if (i > 1 && j > 0) {
        const sim = similarity(typed[i - 2] + typed[i - 1], heard[j - 1].text);
        offer(i, j, score[i - 2][j - 1] + pairScore(sim) - MERGE, { kind: "join", sim });
      }
    }
  }

  // Walk back, giving each typed word the span it was paired with.
  const spans: ({ startMs: number; endMs: number; confidence: number | null; sim: number } | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const step = back[i][j]!;
    if (step.kind === "pair") {
      const h = heard[j - 1];
      spans[i - 1] = { startMs: h.startMs, endMs: h.endMs, confidence: h.confidence ?? null, sim: step.sim! };
      i--;
      j--;
    } else if (step.kind === "split") {
      const a = heard[j - 2];
      const b = heard[j - 1];
      spans[i - 1] = { startMs: a.startMs, endMs: b.endMs, confidence: a.confidence ?? null, sim: step.sim! };
      i--;
      j -= 2;
    } else if (step.kind === "join") {
      // Two typed words said as one heard word: share its span by length.
      const h = heard[j - 1];
      const la = typed[i - 2].length;
      const lb = typed[i - 1].length;
      const mid = Math.round(h.startMs + ((h.endMs - h.startMs) * la) / (la + lb));
      spans[i - 2] = { startMs: h.startMs, endMs: mid, confidence: h.confidence ?? null, sim: step.sim! };
      spans[i - 1] = { startMs: mid, endMs: h.endMs, confidence: h.confidence ?? null, sim: step.sim! };
      i -= 2;
      j--;
    } else if (step.kind === "typed") {
      i--;
    } else {
      j--;
    }
  }

  // Typed words nobody heard: place each run between the words around it,
  // shared out by length, so every typed word is on screen in order.
  const firstMs = heard.length ? heard[0].startMs : 0;
  const lastMs = heard.length ? heard[heard.length - 1].endMs : fallbackMs;
  let k = 0;
  while (k < n) {
    if (spans[k]) {
      k++;
      continue;
    }
    let end = k;
    while (end < n && !spans[end]) end++;
    const left = k > 0 ? spans[k - 1]!.endMs : firstMs;
    const right = end < n ? spans[end]!.startMs : Math.max(lastMs, left);
    // The gap there is, however short; only when there is none at all (the
    // neighbours touch) do the placed words borrow a little time past it.
    const span = right > left ? right - left : 120 * (end - k);
    const lengths = typed.slice(k, end).map((w) => Math.max(1, comparable(w).length));
    const sum = lengths.reduce((a, b) => a + b, 0);
    let at = left;
    for (let x = k; x < end; x++) {
      const d = (span * lengths[x - k]) / sum;
      spans[x] = { startMs: Math.round(at), endMs: Math.round(at + d), confidence: null, sim: 0 };
      at += d;
    }
    k = end;
  }

  // Never let a word start before the one before it.
  let floor = 0;
  const words: Timed[] = typed.map((text, x) => {
    const s = spans[x]!;
    const startMs = Math.max(s.startMs, floor);
    const endMs = Math.max(s.endMs, startMs + 1);
    floor = startMs;
    return { text, startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: s.confidence };
  });

  return { words, matched: spans.filter((s) => s && s.sim >= CONFIDENT).length, total: n };
};
