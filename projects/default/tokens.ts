import type { Tokens } from "../../engine/tokens";

/**
 * The default look.
 *
 * This is a starting point, not a house style. Copy this file to
 * projects/<your-channel>/tokens.ts, change everything in it, and point your
 * shotlists at that instead. Nothing in engine/ reads this file by name.
 *
 * Sizes are authored against `designWidth` and scale to whatever frame a reel
 * declares, so the same look works vertical and square without a second set of
 * numbers.
 */
export const tokens: Tokens = {
  name: "default",
  designWidth: 1080,
  bg: "#0A0E12",

  palette: {
    accent: "#4FD1C5",
    chrome: "#3E6E6A",
    warn: "#F97583",
    neutral: "#C9A227",
    surface: "rgba(255,255,255,0.05)",
    muted: "#8A959F",
    highlight: "rgba(79,209,197,0.10)",
    // Used by the code generator.
    code: "#E6EDF3",
    keyword: "#4FD1C5",
    string: "#C9A227",
    number: "#F97583",
    prompt: "#4FD1C5",
  },

  fonts: {
    display: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    // One variable file, registered three times at the weights the roles
    // below actually use (600/700/800) — the browser renders each request
    // as that exact instance from the file's own weight axis, so this
    // isn't three downloads pretending to be different weights.
    files: [
      { family: "Inter", file: "assets/fonts/Inter-Variable.woff2", weight: "600" },
      { family: "Inter", file: "assets/fonts/Inter-Variable.woff2", weight: "700" },
      { family: "Inter", file: "assets/fonts/Inter-Variable.woff2", weight: "800" },
      // For thumbnail.fontFamily below only — a static file (not variable),
      // registered once at the one weight it's used at. SIL OFL, licence
      // text alongside it, same as Inter's own.
      { family: "Poppins", file: "assets/fonts/Poppins-ExtraBold.woff2", weight: "800" },
    ],
  },

  title: {
    fontFamily: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 72,
    weight: 800,
    color: "#FFFFFF",
    tracking: -0.015,
    lineHeight: 1.1,
    textAlign: "center",
    maxWidth: 0.85,
    // Raised from 0.28: a tech-intro headline reads as a kicker near the top
    // of frame, not a mid-frame caption. 0.14 clears the 0.1 safe-top gate
    // with room for a two-line block.
    top: 0.14,
    // Footage brightness varies shot to shot; a shadow is insurance, not
    // decoration. Deepened from blur:10/0.55 — against the paler wall and
    // curtain highlights in this footage the old value read as barely there.
    shadow: { color: "rgba(0,0,0,0.7)", blur: 16, y: 3 },
    // A short mark that sweeps in under every headline, trailing the text by
    // a couple of frames — the same accent colour the ribbon uses, so a
    // viewer reads it as one recurring graphic device across the reel rather
    // than two unrelated flourishes.
    accent: { color: "#4FD1C5", weight: 4, width: 0.22 },
  },

  caption: {
    fontFamily: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 40,
    weight: 700,
    color: "#FFFFFF",
    tracking: -0.005,
    lineHeight: 1.25,
    textAlign: "center",
    maxWidth: 0.8,
    bottom: 0.2,
    shadow: { color: "rgba(0,0,0,0.55)", blur: 10, y: 2 },
    // The word being spoken pops in a bright yellow rather than the palette's
    // teal accent — teal barely lifts off white caption text, yellow reads as
    // a highlight at a glance instead of a subtle recolor.
    activeColor: "#FFD60A",
    windowMs: 900,
    // Captions refresh every few words, so anything noticeable becomes noise.
    fadeFrames: 2,
    // The card shows 100ms before its first word is spoken — reads as in sync
    // rather than a hair late. The yellow highlight still follows the voice.
    leadMs: 100,
    plate: null,
    // A deliberately different color from activeColor: emphasis is a standing
    // choice about which words carry the claim, not a transient one about
    // which word is playing right now, and the two should read as distinct
    // kinds of "marked" rather than melting into each other.
    emphasis: { color: "#F97583", scale: 1.3, weight: 800 },
  },

  badge: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    // 28 was legible on a desktop preview and small on a phone, which is the
    // only screen that counts; raised to 38, then 44, then here again after
    // it still read as small on the B-roll flashes specifically. The plate
    // grows with it so the padding stays proportional rather than
    // shrink-wrapping bigger type.
    size: 50,
    weight: 600,
    color: "#FFFFFF",
    tracking: 0.02,
    lineHeight: 1.15,
    textAlign: "center",
    maxWidth: 0.8,
    // One shared position for every badge in a reel, deliberately — a badge
    // that jumps around the frame from shot to shot reads as unplanned even
    // when each individual placement was reasoned about on its own.
    //
    // Captions occupy 0.20–0.25, and the bottom 15% is under the platform's
    // own interface. A badge inside either is wrong in a different way: down
    // in the interface it is partly hidden, and inside the caption band it
    // reads as a caption that slipped, which looks like a mistake rather than
    // a choice.
    //
    // 0.27 puts its lower edge about 2% of frame height above the caption
    // band — close enough to belong to the same corner of the frame, far
    // enough that the two never read as one element. Sitting immediately
    // above is the point; clearing the band by a wide margin would make a
    // B-roll label float mid-frame instead of anchoring to the bottom.
    bottom: 0.27,
    uppercase: false,
    shadow: null,
    // Slightly denser than 0.55: these badges sit over bright screen
    // recordings as often as dark ones, and the plate is the only thing
    // holding the type off a busy background.
    plate: { color: "rgba(0,0,0,0.62)", padX: 26, padY: 14, radius: 12 },
    // The same accent colour the title and ribbon already use, so a viewer
    // reads this as the same recurring graphic device across the whole reel
    // rather than a third, unrelated flourish for B-roll specifically.
    accent: { color: "#4FD1C5", weight: 4 },
  },

  ribbon: {
    fontFamily: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 56,
    weight: 800,
    color: "#FFFFFF",
    tracking: -0.01,
    lineHeight: 1.1,
    textAlign: "center",
    maxWidth: 0.8,
    top: 0.12,
    bottom: 0.22,
    // The plate is the primary contrast device, but a shadow still adds
    // depth to the glyphs themselves rather than leaving them looking flat
    // and pasted-on against a solid card.
    shadow: { color: "rgba(0,0,0,0.5)", blur: 8, y: 2 },
    plate: { color: "rgba(10,14,18,0.82)", padX: 34, padY: 20, radius: 18 },
    frames: 18,
    // Underdamped on purpose: the overshoot on arrival is what reads as a
    // graphic landing rather than a box sliding to a stop.
    spring: { damping: 13, stiffness: 140, mass: 0.9 },
    accent: { color: "#4FD1C5", weight: 6, inset: 64 },
    sub: { color: "#C9D3DD", size: 30, weight: 600, tracking: 0.01 },
  },

  thumbnail: {
    // A different, heavier display face than the in-video title's Inter —
    // a thumbnail is a poster, not type the eye reads while something
    // moves, and a distinct font is part of what makes a channel's covers
    // recognisable as a set before a single word is read.
    fontFamily: '"Poppins", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 104,
    weight: 800,
    color: "#FFFFFF",
    // Centred, not title's 0.14: Instagram's profile grid crops a 9:16 reel
    // to roughly 3:4, keeping only the centre ~75% of frame height. 0.14
    // is exactly the top line that crop cuts first.
    top: 0.4,
    accent: { color: "#4FD1C5", weight: 6, width: 0.28 },
    // Guarantees legibility regardless of what's behind it — unlike an
    // in-video title, a thumbnail gets exactly one frame and no chance to
    // land somewhere plainer a few frames later.
    scrim: { color: "rgba(0,0,0,0.6)", height: 0.55 },
    // A slight lift so the picture itself competes better at thumbnail
    // size, where a phone screen already lit at full brightness is what
    // everything else in a feed is also doing.
    contrast: 1.08,
    saturate: 1.15,
    // Same red as caption/title emphasis elsewhere in this look — reads as
    // "the one thing this cover is claiming" rather than a fourth, unrelated
    // colour.
    emphasis: { color: "#F97583" },
  },

  lowerThird: {
    fontFamily: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 38,
    weight: 700,
    color: "#FFFFFF",
    tracking: -0.005,
    lineHeight: 1.15,
    textAlign: "left",
    maxWidth: 0.7,
    // Same band the badge uses, on purpose — the two are mutually exclusive
    // on one shot (verify.ts), so sharing a position keeps every piece of
    // bottom-third graphics in this look landing in the one place a viewer
    // learns to expect it.
    bottom: 0.27,
    shadow: { color: "rgba(0,0,0,0.5)", blur: 8, y: 2 },
    plate: { color: "rgba(10,14,18,0.82)", padX: 24, padY: 14, radius: 10 },
    frames: 14,
    accent: { color: "#4FD1C5", weight: 5 },
    sub: { color: "#C9D3DD", size: 26, weight: 600, tracking: 0.01 },
  },

  marks: {
    // The same yellow the caption's active word uses: a mark and the word that
    // triggered it read as one device. Teal (the accent) disappears against
    // the dark editors these usually sit on.
    color: "#FFD60A",
    highlightColor: "rgba(255,214,10,0.38)",
    strokeWidth: 7,
    roughness: 1.4,
    bowing: 1.2,
    padding: 14,
    frames: 12,
    fadeFrames: 6,
  },

  pointer: {
    color: "#FFD60A",
    ringRadius: 56,
    ringWidth: 6,
    rippleFrames: 14,
    arrowSize: 64,
    dim: 0.55,
    spotlightRadius: 190,
    spotlightFrames: 8,
    fadeFrames: 5,
    lingerFrames: 18,
    // Reaches its peak 4 frames before the click so the eye is already on the
    // target when it lands; holds long enough to read, then eases out.
    zoom: { to: 1.6, lead: 4, inFrames: 14, holdFrames: 28, outFrames: 16 },
  },

  // A screen recording as a floating card over a blurred copy of itself,
  // instead of cropped to fill a vertical frame. 0.46 down puts a 16:9 card
  // between the title (top) and the caption band (bottom).
  card: {
    width: 0.92,
    top: 0.46,
    maxHeight: 0.62,
    radius: 28,
    shadow: { color: "rgba(0,0,0,0.55)", blur: 60, y: 24 },
    border: { color: "rgba(255,255,255,0.14)", weight: 2 },
    background: { blur: 40, dim: 0.55, scale: 1.25, saturate: 1.2 },
    enterFrames: 10,
    enterScale: 0.94,
  },

  // Shake, flash and glitch. Short and hard: a shake settles in about a third
  // of a second, a flash is gone in 8 frames, a glitch in 7. The flash is
  // warm white rather than pure, so it reads as light and not a missing frame.
  impact: {
    shake: { frames: 10, amount: 26, rotation: 1.2 },
    flash: { color: "#FFF6E0", peak: 0.9, frames: 8 },
    glitch: { frames: 7, slice: 38, split: 14 },
  },

  // Sounds the engine plays by itself on screen events, so a shotlist never
  // has to name them. Small and quiet: a tap on a click, a tick as a mark
  // draws, a soft whoosh as the picture pushes toward a click.
  sounds: {
    click: { sfx: "tap", volume: 0.75 },
    mark: { sfx: "tick", volume: 0.4 },
    zoom: { sfx: "whoosh", volume: 0.3 },
    // An impact is a heavier event than a click: the shake gets the punch
    // sound and does duck the music, the flash a whoosh, the glitch a switch.
    shake: { sfx: "snap", volume: 0.8, duck: true },
    flash: { sfx: "whoosh", volume: 0.45 },
    glitch: { sfx: "switch", volume: 0.5 },
    // A slam is the loudest thing a reel does on screen, so it gets the punch
    // sound and ducks the music.
    slam: { sfx: "snap", volume: 0.8, duck: true },
  },

  // A key word landing big in the middle of the frame. 230 is the size a short
  // word gets; longer ones are fitted down to 86% of the frame width. It lands
  // larger and soft (1.5x, blurred) with a bounce, rests a beat over a dimmed
  // picture, and is gone in five frames.
  slam: {
    fontFamily: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 230,
    weight: 800,
    color: "#FFFFFF",
    tracking: -0.025,
    lineHeight: 1,
    textAlign: "center",
    uppercase: true,
    shadow: [
      { color: "rgba(0,0,0,0.65)", blur: 6, y: 3 },
      { color: "rgba(0,0,0,0.45)", blur: 40, y: 14 },
    ],
    width: 0.86,
    centre: 0.42,
    enterFrames: 7,
    enterScale: 1.5,
    enterBlur: 14,
    holdFrames: 14,
    exitFrames: 5,
    scrim: { color: "#000000", opacity: 0.45 },
  },

  // Built-in diagram icons draw themselves on over about half a second when
  // their node arrives; leave this out and they simply appear.
  generators: { iconDrawFrames: 14 },

  // Where a standalone Lottie sits: half the frame wide, above the caption band.
  lottie: { size: 0.5, top: 0.42 },

  // The code generator's morphs: long enough to follow the tokens that move,
  // short enough that the change still feels like it lands on the word.
  code: { morphFrames: 16, dim: 0.32 },

  orb: {
    // The accent, not the caption yellow: the orb is a standing graphic that
    // fills the frame for seconds, and the warmer colours are reserved for
    // the small things that point at something.
    color: "accent",
    size: 0.62,
    // Centred above the caption band rather than dead centre.
    top: 0.4,
    dot: 6,
    density: 1,
    spin: 0.12,
    glow: 0.6,
  },

  // A corner logo for the whole reel. Point `src` at a real mark under
  // public/assets/brand/ to turn this on; omit the whole block for none.
  // watermark: { src: "assets/brand/mark.png", corner: "bottom-right", width: 90, margin: 36, opacity: 0.85 },

  // Fractions of the frame the platform interface covers. Verified, not trusted.
  safe: { top: 0.1, bottom: 0.15, left: 0.05, right: 0.05 },

  punches: {
    /** Short and strong, returns. Reads as a beat. */
    signature: { to: 1.08, frames: 5, hit: "snap" },
    /** Long and gentle, holds. Reads as a repair on a jump cut. */
    soft: { to: 1.05, frames: 9 },
  },

  blends: {
    /** Quick cross-zoom between two B-roll clips — the default transition. */
    standard: { to: 1.12, frames: 8 },
    /** Slower, for a moment that should feel unhurried. */
    slow: { to: 1.06, frames: 14 },
  },

  mix: {
    underSpeech: 0.28,
    underSilence: 0.45,
    dipTo: 0.1,
    dipFrames: 3,
    tailFade: 0.75,
    targetLufs: -14,
  },
};

export default tokens;
