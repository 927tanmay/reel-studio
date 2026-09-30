/**
 * A "look" — everything about how a reel appears, with no opinion about what a
 * reel *is*. One of these lives per project under projects/<name>/tokens.ts.
 *
 * Nothing in engine/ hardcodes a colour, a size or a position. If you find
 * yourself writing a literal into a move or a generator, it belongs here.
 */

export type ShadowLayer = { color: string; blur: number; x?: number; y?: number };

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
  /**
   * One shadow, or several stacked. A single layer reads as a CSS default —
   * legible, not designed. What actually reads as depth is two: a tight, dark
   * one close to the glyph for edge contrast, and a soft, larger one further
   * out for the sense the text is sitting slightly off the background. An
   * array applies every layer in order; a bare object is exactly one layer,
   * unchanged from before this existed.
   */
  shadow?: ShadowLayer | ShadowLayer[] | null;
  /** Vertical placement as a fraction of frame height, 0 = top, 1 = bottom. */
  top?: number;
  bottom?: number;
};

/**
 * A gradient behind a plate or a card — an angle and two or more colour
 * stops. Kept separate from a plain `color` rather than folded into it:
 * a flat colour is still the common case and shouldn't need a one-stop
 * gradient to express it.
 */
export type Gradient = { angle: number; stops: { color: string; at: number }[] };

/**
 * Frosted glass: a blur of whatever sits behind the element, a colour tint
 * over it, and a hairline border to sell the edge of the pane. Needs the
 * element to actually have something visually busy behind it to read as
 * glass rather than as a plain translucent plate — over a flat background
 * the two look the same.
 */
export type Glass = { blur: number; tint?: string; borderColor?: string };

/** A soft, spread glow in one colour — a glow is a shadow with no offset. */
export type Glow = { color: string; radius: number; spread?: number };

/**
 * A background treatment: `color` is what's applied when a look declares
 * nothing else, and stays the fallback even when the others are set — a
 * generator resolving this doesn't need to know whether gradient or glass
 * won, only that `color` is safe to paint first, unconditionally.
 */
export type Surface = {
  color: string;
  gradient?: Gradient;
  glass?: Glass;
  glow?: Glow;
};

/**
 * A `Surface` sized as a padded rectangle behind text — what `plate` has
 * always been, plus the option of a gradient, glass or glow. Every existing
 * plate (a flat `color`, `padX`, `padY`, `radius`) is already a valid one of
 * these with nothing else set; adding this changed no look's rendered output.
 */
export type Plate = Surface & { padX: number; padY: number; radius: number };

export type CaptionStyle = TextStyle & {
  /** Colour applied to the word currently being spoken. */
  activeColor: string;
  /** Milliseconds of speech to gather onto one card. */
  windowMs: number;
  /** Frames of cross-fade when a card changes. Keep this small. */
  fadeFrames: number;
  /** Optional plate behind the text, for legibility over bright footage. */
  plate?: Plate | null;
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
  plate: Plate;
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
 * The look of a feed thumbnail — deliberately its own block rather than a
 * reuse of `title`. A thumbnail is a poster, not an in-video caption: it can
 * run a heavier display font than reads well over several seconds of
 * motion, and it has to sit centred rather than near an edge, because a
 * profile grid crops a 9:16 reel to roughly 3:4 and only the centre is
 * guaranteed to survive that crop. Every field is optional and falls back to
 * `title`'s own value — a look with no `thumbnail` block still gets a
 * usable, if plainer, thumbnail.
 */
export type ThumbnailStyle = {
  fontFamily?: string;
  size?: number;
  weight?: number;
  color?: string;
  /** Fraction of frame height from the top. Centred by default — see above —
   *  rather than inheriting `title.top`, which is tuned for full-frame
   *  playback, not a grid-cropped still. */
  top?: number;
  accent?: { color: string; weight: number; width: number };
  /**
   * A dark gradient behind the title, rising from the bottom, guaranteeing
   * legibility regardless of whatever's behind it. An in-video title can
   * lean on a whole shot's worth of chances to land over a plain patch of
   * frame; a thumbnail gets exactly one frame and no such luck.
   */
  scrim?: { color: string; height: number };
  /** A contrast/saturation lift on the picture alone, behind the scrim. 1 (or
   *  omitted) leaves the picture exactly as graded for the reel itself. */
  contrast?: number;
  saturate?: number;
  /**
   * The standing colour for a thumbnail's own emphasised word(s) — see
   * `ThumbnailSpec.emphasize` in spec.ts. Falls back to `title.accent`'s
   * colour when omitted, so an emphasis-less look still gets *something*
   * distinct from the base colour if it's ever added later.
   */
  emphasis?: { color: string; scale?: number };
};

/**
 * The look of a `ribbon` — a banner that travels in and lands, rather than
 * fading in place like a title. The spring is part of the look, not the
 * engine: overshoot and settle are exactly the numbers that decide whether a
 * graphic reads as designed or as a box that moved, so they live here with
 * every other decision.
 */
export type RibbonStyle = TextStyle & {
  plate: Plate;
  /** Frames the fly-in takes when a shot doesn't name its own. */
  frames: number;
  spring: { damping: number; stiffness: number; mass: number };
  /** The rule that draws under the text once the plate lands. */
  accent: { color: string; weight: number; inset: number };
  /** The second line, when a ribbon carries one. */
  sub: { color: string; size: number; weight: number; tracking?: number };
};

/**
 * A broadcast-style name/role identification card — distinct from `ribbon`,
 * which is a message banner (a follow ask, a result) that overshoots in and
 * holds; this is quieter on purpose: a slide-up and a fade, an accent bar on
 * its leading edge rather than a rule beneath the text, because identifying
 * who is on screen should read as information, not as an event.
 */
export type LowerThirdStyle = TextStyle & {
  plate: Plate;
  accent: { color: string; weight: number };
  sub: { color: string; size: number; weight: number; tracking?: number };
  /** Frames the slide-up and fade take when a shot doesn't name its own. */
  frames: number;
};

/**
 * A persistent mark — a corner logo, a channel bug — present for the whole
 * reel rather than tied to any one shot. Optional: a look with no watermark
 * renders exactly as it did before this existed.
 */
export type Watermark = {
  /** Path under public/, e.g. "assets/brand/mark.png". */
  src: string;
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Width in design pixels; height follows the source's own aspect. */
  width: number;
  /** Distance from both frame edges, in design pixels. */
  margin: number;
  opacity?: number;
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
  lowerThird: LowerThirdStyle;
  /** The look for a feed thumbnail. Optional — see ThumbnailStyle. */
  thumbnail?: ThumbnailStyle;
  /** A corner logo present for the whole reel. Omit and nothing renders. */
  watermark?: Watermark;
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
