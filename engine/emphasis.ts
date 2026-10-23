import { normalise } from "./words";

/**
 * A shot's emphasis words and the group each belongs to. An array is one
 * unnamed group (`"default"`, which takes the look's `caption.emphasis`
 * treatment); an object gives each group a name, and that name picks its
 * colour. Matching is the same case- and punctuation-insensitive way
 * `anchors()` matches.
 */
export const emphasisGroups = (emphasis: string[] | Record<string, string[]> | undefined): Map<string, string> => {
  const out = new Map<string, string>();
  if (!emphasis) return out;
  if (Array.isArray(emphasis)) {
    for (const word of emphasis) out.set(normalise(word), "default");
    return out;
  }
  for (const [group, words] of Object.entries(emphasis)) {
    for (const word of words) out.set(normalise(word), group);
  }
  return out;
};

/** Every emphasis word, however it was written — for checks that don't care about groups. */
export const emphasisWords = (emphasis: string[] | Record<string, string[]> | undefined): string[] =>
  Array.isArray(emphasis) ? emphasis : Object.values(emphasis ?? {}).flat();

/**
 * How far a word has come in: 0 before it is spoken, 1 once its reveal has
 * finished, and the blur it still carries on the way. Pure, so a word's state
 * at any frame is the same on every render.
 */
export const wordReveal = (
  nowMs: number,
  fromMs: number,
  frames: number,
  fps: number,
  blur: number,
): { opacity: number; blur: number } => {
  const t = Math.min(1, Math.max(0, (nowMs - fromMs) / Math.max(1, (frames / fps) * 1000)));
  const eased = 1 - (1 - t) * (1 - t); // ease-out: arrives fast, settles slowly
  return { opacity: eased, blur: (1 - eased) * blur };
};
