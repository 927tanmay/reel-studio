/**
 * Resolves a colour that may be "accent" (the shot's own), a palette name, or a
 * CSS colour. One place, so the backdrop, the header and the caption box can't
 * disagree about what "accent" means.
 */
export const resolveColour = (
  colour: string,
  palette: Record<string, string>,
  accent: string | undefined,
): string => {
  if (colour === "accent") return palette[accent ?? "accent"] ?? accent ?? palette.accent ?? "#4FD1C5";
  return palette[colour] ?? colour;
};

/**
 * Where a glow's centre is at a moment: its home position plus a slow wander on
 * two out-of-phase sine waves, so it drifts in a loose loop rather than back
 * and forth on one line. `t` is in seconds of *reel* time (not shot time), which
 * is what keeps a glow continuous across the cuts of one section.
 */
export const blobCentre = (
  blob: { x: number; y: number; drift: number },
  index: number,
  t: number,
  speed: number,
): { x: number; y: number } => {
  const phase = index * 2.1;
  const a = t * speed * Math.PI * 2;
  return {
    x: blob.x + Math.sin(a + phase) * blob.drift,
    y: blob.y + Math.cos(a * 0.8 + phase * 1.3) * blob.drift * 0.6,
  };
};
