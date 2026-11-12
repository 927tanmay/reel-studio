import type { MediaManifest } from "./spec";

/**
 * Takes recorded at different times are rarely at the same level: one closer to
 * the microphone, one on a different day. Cut together, the voice jumps in
 * volume at every section. `npm run ingest` measures each clip's integrated
 * loudness (LUFS) into `media.json`; this turns those measurements into a gain
 * per clip that brings each take to the *median* of the post's takes.
 *
 * The median, not a fixed target, so a typical take is untouched and only the
 * outliers move — which keeps the voice where it sat against the music bed. The
 * render's own loudness pass still sets the level of the whole mix afterwards.
 * The correction is capped at ±9 dB: a take further out than that has a problem
 * a gain will not fix, and boosting it that far would raise its noise too.
 */
const CAP_DB = 9;

export const medianLoudness = (media: MediaManifest | undefined): number | null => {
  const values = Object.values(media ?? {})
    .filter((m) => m.hasAudio && typeof m.loudness === "number" && Number.isFinite(m.loudness))
    .map((m) => m.loudness as number)
    .sort((a, b) => a - b);
  if (values.length < 2) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
};

/** The linear gain for one clip's sound. 1 when it was not measured, or leveling is off. */
export const takeGain = (media: MediaManifest | undefined, key: string, enabled = true): number => {
  if (!enabled) return 1;
  const own = media?.[key]?.loudness;
  const reference = medianLoudness(media);
  if (typeof own !== "number" || !Number.isFinite(own) || reference === null) return 1;
  const db = Math.max(-CAP_DB, Math.min(CAP_DB, reference - own));
  return Math.pow(10, db / 20);
};

