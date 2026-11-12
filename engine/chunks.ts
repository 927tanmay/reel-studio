/**
 * Caption cards of a fixed number of words, for the punchy two-or-three-word
 * style short-form uses: each card holds at most `n` words, whatever the time
 * between them, and a card never runs past the end of a sentence when the
 * caller has already split the words into sentences.
 *
 * Returns cards in the same shape `@remotion/captions` builds, so the caption
 * renderer draws them the same way. Pure; no remotion import.
 */
export type ChunkWord = { text: string; startMs: number; endMs: number };
export type ChunkCard = {
  text: string;
  startMs: number;
  durationMs: number;
  tokens: { text: string; fromMs: number; toMs: number }[];
};

export const chunkCards = (runs: ChunkWord[][], n: number): ChunkCard[] => {
  const size = Math.max(1, Math.floor(n));
  const cards: ChunkCard[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.length; i += size) {
      const words = run.slice(i, i + size);
      cards.push({
        text: words.map((w) => w.text).join(""),
        startMs: words[0].startMs,
        durationMs: 0,
        tokens: words.map((w) => ({ text: w.text, fromMs: w.startMs, toMs: w.endMs })),
      });
    }
  }
  // Each card holds until the next one starts, so the screen is never empty
  // mid-sentence; the last holds until its last word ends.
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    const end = next ? next.startMs : card.tokens[card.tokens.length - 1].toMs;
    card.durationMs = Math.max(1, end - card.startMs);
  });
  return cards;
};

/**
 * A word popping in: hidden until it starts, then scaling from `from` to 1 and
 * fading in over `frames`. Rests at exactly scale 1 with no transform, so the
 * glyph edges are sharp once it lands (rule 9 holds everywhere but arrival).
 */
export const popState = (nowMs: number, fromMs: number, frames: number, fps: number, from: number) => {
  const span = Math.max(1, (frames / fps) * 1000);
  const t = (nowMs - fromMs) / span;
  if (t < 0) return { opacity: 0, scale: from };
  if (t >= 1) return { opacity: 1, scale: 1 };
  // Back-out: overshoots a touch past 1 and settles, which is what reads as a pop.
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const e = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  return { opacity: Math.min(1, t * 2.5), scale: from + (1 - from) * e };
};
