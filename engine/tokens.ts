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
};

export type BadgeStyle = TextStyle & {
  plate: { color: string; padX: number; padY: number; radius: number };
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
  title: TextStyle;
  caption: CaptionStyle;
  badge: BadgeStyle;
  /**
   * Regions the platform interface covers, as fractions of frame height.
   * Nothing readable is allowed to land inside them; verify.ts enforces it.
   */
  safe: { top: number; bottom: number; left: number; right: number };
  /** Named punch presets. Shotlists may use these or pass their own numbers. */
  punches?: Record<string, { to: number; frames: number; hit?: string }>;
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
