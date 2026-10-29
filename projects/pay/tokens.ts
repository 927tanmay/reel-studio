import type { Tokens } from "../../engine/tokens";
import base from "../default/tokens";

/**
 * A look for faceless explainers that has to stop a thumb.
 *
 * The explainer look is near-black with a teal glow, which is what most tech
 * reels in a feed already look like. This one goes the other way: a saturated
 * ultramarine ground, white type, one hot yellow for the thing that matters,
 * and a coral for the threat. It is the default look with the colour, the type
 * and the glow changed, not a second copy, so a fix to the default still
 * reaches it.
 *
 * What was chosen, and why (judgement, not measured audience data):
 *   - Colour: blue and yellow are the most separated pair on the wheel, so the
 *     two things the eye must find (the highlighted word, the card) are the
 *     only yellow in a frame that is otherwise blue and white.
 *   - Type: Poppins ExtraBold for the headline, chunkier and rounder than
 *     Inter, so the hook reads at thumbnail size and feels like a payment app
 *     rather than a terminal. Notes stay monospace: they are the "code" voice.
 *   - Glyphs: thicker strokes and a soft glow instead of a neon one, because a
 *     glow barely shows on a light ground.
 */
const ink = "#071033";
const blue = "#1536E6";

export const tokens: Tokens = {
  ...base,
  name: "pay",
  bg: blue,

  palette: {
    ...base.palette,
    accent: "#FFD60A",
    chrome: "#7C93FF",
    warn: "#FF5C7A",
    muted: "#C3D0FF",
    highlight: "rgba(255,214,10,0.16)",
  },

  // Poppins is registered by the default look at weight 800 only.
  headline: {
    ...base.headline!,
    fontFamily: '"Poppins", "Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 80,
    weight: 800,
    lineHeight: 1.12,
    tracking: -0.01,
    shadow: [
      { color: "rgba(7,16,51,0.55)", blur: 4, y: 3 },
      { color: "rgba(7,16,51,0.45)", blur: 22, y: 8 },
    ],
    // The emphasised word is the one yellow thing in the headline.
    emphasis: { color: "#FFD60A", scale: 1, weight: 800 },
    colours: { cool: "#FFD60A", warm: "#FF5C7A", amber: "#FFB23E" },
  },

  header: { ...base.header!, top: 0.115 },

  // A glow that is a colour, not a spotlight: a lighter blue up left, a violet
  // low right, both drifting slowly, so the ground is never one flat blue.
  backdrop: {
    blobs: [
      { x: 0.15, y: 0.2, size: 0.95, color: "#5C8DFF", opacity: 0.55, drift: 0.05 },
      { x: 0.88, y: 0.82, size: 1.0, color: "#8A3DFF", opacity: 0.5, drift: 0.06 },
    ],
    speed: 0.05,
  },

  // Thicker wireframes, a soft glow, and a note and a label big enough for a
  // phone. White is the system (machine, bank), yellow is the card, coral is
  // the observer.
  scene: {
    ...base.scene!,
    glyphSize: 0.2,
    stroke: 2.2,
    glow: 5,
    labelSize: 22,
    noteSize: 28,
    tones: { client: "#FFD60A", server: "#FFFFFF", threat: "#FF5C7A", ok: "#46F0A8", warn: "#FF5C7A" },
    link: "#C9D6FF",
  },

  // The dots are the card's power and its code: yellow like the card, smaller,
  // with one ghost. The observer's trip names its own colour.
  packet: { ...base.packet!, color: "accent", seconds: 0.8, labelSize: 26, size: 22, glow: 16, trail: 1 },

  // A white plate with dark type, so the ask is the brightest thing on screen.
  ribbon: {
    ...base.ribbon,
    size: 44,
    maxWidth: 0.9,
    color: ink,
    shadow: { color: "rgba(7,16,51,0.25)", blur: 10, y: 3 },
    plate: { ...base.ribbon.plate, color: "#FFFFFF" },
    accent: { color: blue, weight: 6, inset: 64 },
    sub: { ...base.ribbon.sub!, color: "#33407A" },
  },

  // A strike or circle drawn over the picture: coral reads as "no" on blue.
  marks: { ...base.marks!, color: "#FF5C7A" },
};

export default tokens;
