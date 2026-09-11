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
    // Footage brightness varies shot to shot; a shadow is insurance, not decoration.
    shadow: { color: "rgba(0,0,0,0.55)", blur: 10, y: 2 },
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
    activeColor: "#4FD1C5",
    windowMs: 900,
    // Captions refresh every few words, so anything noticeable becomes noise.
    fadeFrames: 2,
    plate: null,
  },

  badge: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    size: 28,
    weight: 600,
    color: "#FFFFFF",
    tracking: 0.02,
    textAlign: "center",
    maxWidth: 0.8,
    bottom: 0.18,
    uppercase: false,
    shadow: null,
    plate: { color: "rgba(0,0,0,0.55)", padX: 22, padY: 12, radius: 10 },
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
