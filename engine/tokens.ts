/**
 * A "look" — everything about how a reel appears, with no opinion about what a
 * reel *is*. One of these lives per project under projects/<name>/tokens.ts.
 *
 * Nothing in engine/ hardcodes a colour, a size or a position. If you find
 * yourself writing a literal into a move or a generator, it belongs here.
 */

export type TextStyle = {
  fontFamily: string;
  /** Size in pixels, measured against `designWidth`. Scales with the frame. */
  size: number;
  weight: number;
  color: string;
  /** Fraction of font size. -0.01 is a 1% tighten. */
  tracking?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  /** Fraction of frame width the text may occupy before wrapping. */
  maxWidth?: number;
  uppercase?: boolean;
  shadow?: { color: string; blur: number; x?: number; y?: number } | null;
  /** Vertical placement as a fraction of frame height, 0 = top, 1 = bottom. */
  top?: number;
  bottom?: number;
};

export type CaptionStyle = TextStyle & {
  /** Colour applied to the word currently being spoken. */
  activeColor: string;
  /** Milliseconds of speech to gather onto one card. */
  windowMs: number;
  /** Frames of cross-fade when a card changes. Keep this small. */
  fadeFrames: number;
  /** Optional plate behind the text, for legibility over bright footage. */
  plate?: { color: string; padX: number; padY: number; radius: number } | null;
  /**
   * The standing treatment for a shot's `emphasis` words — the two or three
   * words per reel that carry the actual claim, marked deliberately rather
   * than by which word happens to be mid-utterance. Distinct from
   * `activeColor`: that's transient and follows speech automatically; this is
   * an editorial choice that holds regardless of which word is playing.
   * `scale` multiplies the base caption size (1.3 reads as noticeably larger
   * without breaking the line).
   */
  emphasis?: { color: string; scale: number; weight?: number };
};

export type BadgeStyle = TextStyle & {
  plate: { color: string; padX: number; padY: number; radius: number };
  /**
   * The same sweep-in rule Title uses, so a B-roll label reads as the same
   * graphic language as an A-roll headline rather than a plainer style of
   * its own. Optional — a badge with no `accent` behaves exactly as before.
   * Unlike Title's, this has no `width`: it's drawn inside the plate (Badge
   * has one, Title doesn't) at a fixed proportion of the plate's own content
   * width rather than the frame's, because badge text length varies far more
   * than a title's does — a frame-relative bar would look arbitrary against
   * a tightly-wrapped plate.
   */
  accent?: { color: string; weight: number };
};

export type TitleStyle = TextStyle & {
  /**
   * A short rule that sweeps in under the headline once it lands, trailing
   * it by a few frames. Optional — a title with no `accent` behaves exactly
   * as before. `width` is a fraction of frame width, independent of the
   * text's own length: a fixed-width mark under a two-line headline reads as
   * a designed flourish, whereas underlining the text's actual (variable)
   * width would look like a literal underline that happens to not quite fit.
   */
  accent?: { color: string; weight: number; width: number };
};

/**
 * The look of a `ribbon` — a banner that travels in and lands, rather than
 * fading in place like a title. The spring is part of the look, not the
 * engine: overshoot and settle are exactly the numbers that decide whether a
 * graphic reads as designed or as a box that moved, so they live here with
 * every other decision.
 */
export type RibbonStyle = TextStyle & {
  plate: { color: string; padX: number; padY: number; radius: number };
  /** Frames the fly-in takes when a shot doesn't name its own. */
  frames: number;
  spring: { damping: number; stiffness: number; mass: number };
  /** The rule that draws under the text once the plate lands. */
  accent: { color: string; weight: number; inset: number };
  /** The second line, when a ribbon carries one. */
  sub: { color: string; size: number; weight: number; tracking?: number };
};

export type Tokens = {
  name: string;
  /** The width these pixel sizes were designed against. Everything scales from it. */
  designWidth: number;
  bg: string;
  /** Free-form palette. Reference entries by name from shotlists and generators. */
  palette: Record<string, string>;
  fonts: {
    display: string;
    mono: string;
    /** Optional local .woff2 files under public/assets/fonts, loaded at startup. */
    files?: { family: string; file: string; weight?: string; style?: string }[];
  };
  title: TitleStyle;
  caption: CaptionStyle;
  badge: BadgeStyle;
  ribbon: RibbonStyle;
  /**
   * Regions the platform interface covers, as fractions of frame height.
   * Nothing readable is allowed to land inside them; verify.ts enforces it.
   */
  safe: { top: number; bottom: number; left: number; right: number };
  /**
   * Generated clips (diagram, compare, data). Optional: absent, every generator
   * keeps its built-in proportions, which were drawn for a full frame and read
   * small on a phone once a clip sits in a band or carries little text.
   */
  generators?: {
    /** Multiplies the type in diagram, compare and data clips. 1 is unchanged. */
    textScale?: number;
  };
  /** Named punch presets. Shotlists may use these or pass their own numbers. */
  punches?: Record<string, { to: number; frames: number; hit?: string }>;
  /** Named blend presets — cross-dissolve overlap length and zoom. */
  blends?: Record<string, { to: number; frames: number }>;
  mix: {
    /** Bed level while someone is speaking. */
    underSpeech: number;
    /** Bed level when nobody is. */
    underSilence: number;
    /** Level the bed drops to on a marked hit, and for how many frames. */
    dipTo: number;
    dipFrames: number;
    /** Seconds of fade at the very end. */
    tailFade: number;
    /** Integrated loudness target for the final mix, in LUFS. */
    targetLufs: number;
  };
};
