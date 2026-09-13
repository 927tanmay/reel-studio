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
    display: '-apple-system, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    // Drop a .woff2 into public/assets/fonts and declare it here to stop
    // depending on what happens to be installed:
    // files: [{ family: "Poppins", file: "assets/fonts/Poppins-Bold.woff2", weight: "700" }],
  },

  title: {
    fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif',
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
  },

  caption: {
    fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif',
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
    // only screen that counts. The plate grows with it so the padding stays
    // proportional rather than shrink-wrapping bigger type.
    size: 38,
    weight: 600,
    color: "#FFFFFF",
    tracking: 0.02,
    lineHeight: 1.15,
    textAlign: "center",
    maxWidth: 0.8,
    // One shared position for every badge in a reel, deliberately — a badge
    // that jumps around the frame from shot to shot reads as unplanned even
    // when each individual placement was reasoned about on its own.
    bottom: 0.12,
    uppercase: false,
    shadow: null,
    // Slightly denser than 0.55: these badges sit over bright screen
    // recordings as often as dark ones, and the plate is the only thing
    // holding the type off a busy background.
    plate: { color: "rgba(0,0,0,0.62)", padX: 26, padY: 14, radius: 12 },
  },

  ribbon: {
    fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif',
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
