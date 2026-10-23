/**
 * The pieces of a section header that depend on time, as pure functions.
 */

export type Subtitle = string | { at: number; text: string }[] | undefined;

/**
 * Which subtitle is showing at `seconds`, which one it replaced, and how far
 * through the swap it is (0 at the moment of change, 1 once settled). A plain
 * string never swaps.
 */
export const subtitleAt = (
  subtitle: Subtitle,
  seconds: number,
  swapSeconds: number,
): { text: string; previous: string | null; swap: number } | null => {
  if (!subtitle) return null;
  if (typeof subtitle === "string") return { text: subtitle, previous: null, swap: 1 };
  const list = [...subtitle].sort((a, b) => a.at - b.at);
  let index = -1;
  list.forEach((s, i) => {
    if (s.at <= seconds) index = i;
  });
  if (index < 0) return null;
  const swap = index === 0 ? 1 : Math.min(1, (seconds - list[index].at) / Math.max(1e-6, swapSeconds));
  return { text: list[index].text, previous: index > 0 ? list[index - 1].text : null, swap };
};

/** The dashes of a "n of m" tag: which are filled. */
export const dashStates = (step: [number, number]): boolean[] =>
  Array.from({ length: Math.max(1, step[1]) }, (_, i) => i < step[0]);

/** Whether a blinking caret is lit this frame. */
export const caretOn = (frame: number, blinkFrames: number): boolean =>
  Math.floor(frame / Math.max(1, blinkFrames)) % 2 === 0;
