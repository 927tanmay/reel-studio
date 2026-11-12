/**
 * The arithmetic behind the hot-topic blocks (`post`, `headline`, `stat`,
 * `logos`, `timeline`): how a number is written and counted, where a
 * highlighted phrase sits in a run of text, how a wall of logos is laid out.
 *
 * Pure, and shared by the generators and `verify.ts`, so a phrase the check
 * says is missing is exactly one the renderer would fail to highlight.
 */

/** 0..1 eased (cubic out) between two frames; 0 before, 1 after. */
export const progress = (frame: number, start: number, frames: number): number => {
  if (frame <= start) return 0;
  if (frames <= 0 || frame >= start + frames) return 1;
  const t = (frame - start) / frames;
  return 1 - Math.pow(1 - t, 3);
};

/**
 * A number as a feed writes it: 980, 12.4K, 1.2M, 3B. One decimal below a
 * hundred of a unit, none above, and never a trailing ".0".
 */
export const compactNumber = (n: number): string => {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (a >= size) {
      const v = a / size;
      const text = v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString();
      // 999.95K rounds up to 1000K: say 1M instead.
      if (text === "1000" && size < 1e12) return compactNumber(sign === "-" ? -size * 1000 : size * 1000);
      return `${sign}${text}${suffix}`;
    }
  }
  return `${sign}${Math.round(a)}`;
};

/** A figure with its decimals and thousands separators: 4,200 · 3.14 · 1,250,000. */
export const formatFigure = (n: number, decimals = 0): string => {
  const fixed = Math.abs(n).toFixed(Math.max(0, decimals));
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
};

/** The value a count-up shows `t` (0..1, already eased) of the way from `from` to `to`. */
export const countValue = (from: number, to: number, t: number, decimals = 0): number => {
  const raw = from + (to - from) * Math.min(1, Math.max(0, t));
  const k = Math.pow(10, Math.max(0, decimals));
  // Land exactly on the target, never a hair short of it.
  return t >= 1 ? to : Math.round(raw * k) / k;
};

export type TextRun = { text: string; highlight?: number };

/**
 * Splits `text` into runs, marking where each phrase sits (case-insensitive,
 * the first occurrence after the previous phrase, so several highlights read
 * in order). A phrase that is not in the text is skipped; `missingPhrases`
 * names them for the check.
 */
export const highlightRuns = (text: string, phrases: string[]): TextRun[] => {
  const lower = text.toLowerCase();
  const spans: { start: number; end: number; index: number }[] = [];
  let from = 0;
  phrases.forEach((phrase, index) => {
    const p = phrase.trim().toLowerCase();
    if (!p) return;
    let at = lower.indexOf(p, from);
    if (at < 0) at = lower.indexOf(p); // allow an earlier one if it does not overlap
    if (at < 0) return;
    const end = at + p.length;
    if (spans.some((s) => at < s.end && end > s.start)) return;
    spans.push({ start: at, end, index });
    from = end;
  });
  spans.sort((a, b) => a.start - b.start);
  const runs: TextRun[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) runs.push({ text: text.slice(cursor, s.start) });
    runs.push({ text: text.slice(s.start, s.end), highlight: s.index });
    cursor = s.end;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor) });
  return runs;
};

export const missingPhrases = (text: string, phrases: string[]): string[] => {
  const found = new Set(highlightRuns(text, phrases).filter((r) => r.highlight !== undefined).map((r) => r.highlight!));
  return phrases.filter((p, i) => p.trim() && !found.has(i));
};

/**
 * Columns for a wall of `n` logos when the shot does not say: a row of up to
 * three, then two rows of two, then threes, then fours. Rows fill before a
 * new one starts, so nothing sits alone on a row it could have shared.
 */
export const logoColumns = (n: number, columns?: number): number => {
  if (columns && columns > 0) return Math.min(columns, Math.max(1, n));
  if (n <= 3) return Math.max(1, n);
  if (n === 4) return 2;
  if (n <= 9) return 3;
  return 4;
};

/** A monogram for something with no picture: the first letter of its first one or two words. */
export const monogram = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
};

/**
 * When each of a list's entries arrives: its own `at`, or `stagger` after the
 * one before, and never before the one above it.
 */
export const arrivals = (items: { at?: number }[], stagger: number, first = 0.2): number[] => {
  const out: number[] = [];
  items.forEach((item, i) => {
    const prev = i === 0 ? undefined : out[i - 1];
    const own = item.at;
    const t = own !== undefined ? own : prev === undefined ? first : prev + stagger;
    out.push(prev === undefined ? t : Math.max(prev, t));
  });
  return out;
};
