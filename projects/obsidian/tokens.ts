import type { Tokens } from "../../engine/tokens";
import base from "../default/tokens";

/**
 * A developer-product look: obsidian ground, a faint dot grid, frosted glass
 * tiles with a hairline border, indigo and teal light behind them, and a
 * colour for each role so the viewer reads who is who before a word is said.
 *
 * Written from a brief the editor supplied (the Linear / Vercel family: dark
 * `#090A0F`, indigo `#6366F1` and cyan `#06B6D4` ambient light, Inter bold with
 * tight tracking for the hook, monospace badges for the technical strings, and
 * a fixed colour per role). It is the default look with colour, type and
 * surfaces changed, so a fix to the default still reaches it.
 *
 * Colour roles: cyan is the client (the card, the code leaving it), violet is
 * a system that processes (the machine, the bank), emerald is success, a muted
 * rose is the threat. Rose, not red, and nothing yellow: oversaturated red and
 * yellow were on the editor's list of things to avoid.
 *
 * Not in this look: Geist and JetBrains Mono (not bundled here; Inter and the
 * system monospace stack stand in), and any 3D, depth of field or camera move,
 * which a generated clip would carry and this engine's scene does not.
 */
const bg = "#090A0F";
const indigo = "#6366F1";
const cyan = "#06B6D4";

export const tokens: Tokens = {
  ...base,
  name: "obsidian",
  bg,

  palette: {
    ...base.palette,
    // Text and dots in the brighter cyan: #06B6D4 itself is a touch dim as type.
    accent: "#22D3EE",
    chrome: "rgba(99,102,241,0.4)",
    surface: "rgba(99,102,241,0.15)",
    warn: "#FB7185",
    muted: "#9AA3C7",
    highlight: "rgba(99,102,241,0.14)",
  },

  headline: {
    ...base.headline!,
    fontFamily: '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif',
    size: 80,
    weight: 800,
    lineHeight: 1.1,
    // -0.03em, as the brief asks for the hook.
    tracking: -0.03,
    shadow: [
      { color: "rgba(0,0,0,0.6)", blur: 4, y: 3 },
      { color: "rgba(99,102,241,0.35)", blur: 28, y: 0 },
    ],
    emphasis: { color: "#22D3EE", scale: 1, weight: 800 },
    colours: { cool: "#22D3EE", warm: "#FB7185", amber: "#A5B4FC" },
  },

  header: { ...base.header!, top: 0.115 },

  // Indigo light up left, teal low right, under a dot grid that dissolves
  // toward the edges, and a vignette to the ground colour.
  backdrop: {
    blobs: [
      { x: 0.12, y: 0.18, size: 1.0, color: "#4F46E5", opacity: 0.42, drift: 0.05 },
      { x: 0.9, y: 0.84, size: 1.0, color: "#0D9488", opacity: 0.3, drift: 0.06 },
    ],
    speed: 0.05,
    grid: { size: 38, dot: 1.4, color: "rgba(255,255,255,0.9)", opacity: 0.1, fade: 0.28 },
    vignette: 0.55,
  },

  scene: {
    ...base.scene!,
    glyphSize: 0.2,
    stroke: 1.8,
    glow: 7,
    labelSize: 22,
    noteSize: 27,
    tones: { client: cyan, server: "#A78BFA", threat: "#FB7185", ok: "#34D399", warn: "#FB7185" },
    link: "#8B93C9",
    // A frosted dark tile behind each thing, with a hairline specular border
    // and a faint indigo glow under it.
    tile: {
      color: "rgba(255,255,255,0.03)",
      glass: { blur: 18, tint: "rgba(20,22,38,0.62)", borderColor: "rgba(255,255,255,0.2)" },
      glow: { color: "rgba(99,102,241,0.22)", radius: 44 },
      pad: 0.06,
      radius: 30,
    },
    // The monospace string as a badge: indigo wash, indigo hairline.
    notePlate: {
      color: "rgba(99,102,241,0.15)",
      glass: { blur: 10, tint: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.45)" },
      padX: 18,
      padY: 9,
      radius: 999,
    },
  },

  // The dots are the card's code, so they are the card's colour.
  packet: { ...base.packet!, color: "accent", seconds: 0.8, labelSize: 26, size: 22, glow: 18, trail: 1 },

  // The ask as a glass pill, the brightest hairline on screen.
  ribbon: {
    ...base.ribbon,
    size: 44,
    maxWidth: 0.9,
    color: "#FFFFFF",
    shadow: { color: "rgba(0,0,0,0.5)", blur: 8, y: 2 },
    plate: {
      ...base.ribbon.plate,
      color: "rgba(99,102,241,0.22)",
      glass: { blur: 22, tint: "rgba(99,102,241,0.2)", borderColor: "rgba(255,255,255,0.4)" },
      glow: { color: "rgba(99,102,241,0.4)", radius: 36 },
    },
    accent: { color: "#22D3EE", weight: 6, inset: 64 },
    sub: { ...base.ribbon.sub!, color: "#C7D2FE" },
  },

  marks: { ...base.marks!, color: "#FB7185" },

  // The default flash is warm white at 0.9, which over a dark ground reads as a
  // milky grey wash rather than light (the reveal at 12.9s looked muddy). Here
  // it is the look's own indigo, lighter and a touch shorter, so it reads as a
  // pulse of the brand's light rather than a missing frame.
  impact: { ...base.impact!, flash: { color: "#6366F1", peak: 0.5, frames: 8 } },
};

export default tokens;
