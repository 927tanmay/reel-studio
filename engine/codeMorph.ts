/**
 * Code as positioned tokens, and how one version of a snippet becomes the
 * next. Pure data and arithmetic — no Shiki, no React — so the matching can be
 * checked on its own and the renderer cannot disagree with it.
 *
 * The idea is Keynote's Magic Move applied to code: a token that exists in both
 * versions glides from where it was to where it is now; one that only exists
 * in the old version fades out; one that only exists in the new fades in. What
 * the viewer sees is *what changed*, instead of two screenfuls of text
 * swapping.
 */

export type CodeToken = {
  text: string;
  color: string;
  /** Zero-based line, and zero-based column in characters. */
  line: number;
  col: number;
  /** Character offset in the whole snippet, for the typing reveal. */
  offset: number;
};

export type TokenMatch = {
  /** Pairs of indices: [index in the old tokens, index in the new tokens]. */
  pairs: [number, number][];
  removed: number[];
  added: number[];
};

/**
 * Which old tokens became which new tokens. A longest-common-subsequence over
 * the token text, so order is preserved — a `const` never "moves" past the
 * identifier after it — and the result is what a diff would call unchanged.
 * Quadratic in token count, which is a few hundred for anything that fits on a
 * phone screen.
 */
export const matchTokens = (a: CodeToken[], b: CodeToken[]): TokenMatch => {
  const n = a.length;
  const m = b.length;
  // lengths[i][j]: LCS length of a[i..] and b[j..].
  const lengths: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i].text === b[j].text ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const pairs: [number, number][] = [];
  const removed: number[] = [];
  const added: number[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].text === b[j].text) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      removed.push(i++);
    } else {
      added.push(j++);
    }
  }
  while (i < n) removed.push(i++);
  while (j < m) added.push(j++);
  return { pairs, removed, added };
};

/**
 * Turns a highlighter's per-line tokens into positioned ones. Whitespace-only
 * tokens are dropped from the result — they draw nothing and would only give
 * the matcher spaces to "move" — but they are counted when working out the
 * column of what follows them, which is what keeps the layout exact.
 */
export const placeTokens = (lines: { content: string; color?: string }[][], fallbackColor: string): CodeToken[] => {
  const out: CodeToken[] = [];
  let offset = 0;
  lines.forEach((line, lineIndex) => {
    let col = 0;
    for (const token of line) {
      if (token.content.trim().length > 0) {
        // A token can carry leading whitespace; draw it where its text starts.
        const lead = token.content.length - token.content.trimStart().length;
        out.push({
          text: token.content.trim(),
          color: token.color ?? fallbackColor,
          line: lineIndex,
          col: col + lead,
          offset: offset + lead,
        });
      }
      col += token.content.length;
      offset += token.content.length;
    }
    offset += 1; // the newline
  });
  return out;
};
