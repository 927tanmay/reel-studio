/**
 * A track's beat grid — the tempo and phase `npm run beats <track>` already
 * measures, turned into "what's the nearest beat to this moment." A hit or a
 * dip that wants to land on the music rather than wherever its own `at`
 * happens to fall reads this; nothing here re-detects anything.
 */
export type BeatGrid = {
  bpm: number;
  firstBeatSeconds: number;
  periodSeconds: number;
};

/** The nearest beat, in the track file's own seconds, to `aroundSeconds`. */
export const nearestBeat = (grid: BeatGrid, aroundSeconds: number): number => {
  const k = Math.round((aroundSeconds - grid.firstBeatSeconds) / grid.periodSeconds);
  return grid.firstBeatSeconds + k * grid.periodSeconds;
};
