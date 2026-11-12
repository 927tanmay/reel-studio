import type { Tokens } from "../../engine/tokens";
import base from "../default/tokens";

/**
 * A "Linear / Vercel / Raycast dark mode" look, written from a design spec the
 * editor supplied for reel 013: deep obsidian ground with a faint sky glow at
 * the top and a dot matrix, elevated slate cards with a hairline and a lit top
 * edge, crisp white and slate type, sky as the one brand accent, and a fixed
 * colour per meaning (rose for an attack or a broken state, amber for a
 * warning, emerald for success) so the viewer reads the meaning before the word.
 *
 * It replaces `obsidian` for this reel, not the other way round: obsidian's
 * glass tiles and indigo light are still there for the reels that use them.
 *
 * Not in this look: Geist and JetBrains Mono (not bundled here; Inter and the
 * system monospace stack stand in, as they do in obsidian).
 */
const bg = "#090A0F";
const sky = "#38BDF8";
const emerald = "#10B981";
const rose = "#FB7185";
const amber = "#FBBF24";
const slate = "#94A3B8";
const ink = "#F8FAFC";

const shadow = { color: "rgba(0,0,0,0.5)", blur: 24, y: 8, spread: -4 };

export const tokens: Tokens = {
  ...base,
  name: "linear",
  bg,

  palette: {
    ...base.palette,
    accent: sky,
    // Connector lines and hairlines that must stay visible; the cards' own
    // border (1px, 8% white) is `panel.border`.
    chrome: "rgba(255,255,255,0.22)",
    surface: "#12141C",
    warn: rose,
    muted: slate,
    highlight: "rgba(56,189,248,0.12)",
    // Code, in the same family.
    code: ink,
    keyword: sky,
    string: amber,
    number: rose,
    prompt: emerald,
  },

  // Tight tracking and a bold weight; no underline mark under a title.
  title: {
    ...base.title,
    color: ink,
    weight: 700,
    tracking: -0.025,
    accent: undefined,
  },

  caption: {
    ...base.caption,
    activeColor: amber,
    emphasis: { color: rose, scale: 1.3, weight: 800 },
  },

  // The step counter is a small mono pill, the title sits beside it. Inline, so
  // the title strip over the graphic stays thin.
  header: {
    ...base.header!,
    top: 0.1,
    kickerSize: 25,
    titleSize: 46,
    titleWeight: 700,
    tracking: -0.025,
    gap: 18,
    // Progress dashes inside the pill: five segments, the first n lit.
    dash: { width: 22, height: 6, gap: 6 },
    layout: "inline",
    pill: {
      color: "rgba(56,189,248,0.12)",
      border: "rgba(56,189,248,0.3)",
      text: sky,
      padX: 18,
      padY: 8,
      tracking: 0.06,
    },
  },

  // One continuous canvas: a faint sky glow from the top centre and a dot
  // matrix across the whole thing, no corner darkening.
  backdrop: {
    blobs: [{ x: 0.5, y: 0, size: 1.1, color: sky, opacity: 0.1, drift: 0.04 }],
    speed: 0.05,
    grid: { size: 24, dot: 1, color: "#FFFFFF", opacity: 0.06, fade: 1 },
    vignette: 0,
  },

  // The elevated card every list row, bubble, page and diagram card shares.
  panel: {
    color: "#12141C",
    hot: "#181B26",
    border: "rgba(255,255,255,0.08)",
    specular: "rgba(255,255,255,0.12)",
    shadow,
    blur: 12,
    radius: 12,
    iconTile: "#1E2230",
  },

  rows: {
    ...base.rows!,
    top: 0.26,
    width: 0.9,
    gap: 14,
    radius: 12,
    tile: 46,
    titleSize: 38,
    subSize: 25,
    pending: "dot",
  },

  scene: {
    ...base.scene!,
    glyphSize: 0.2,
    stroke: 1.8,
    glow: 5,
    labelSize: 22,
    noteSize: 27,
    tones: { client: sky, server: "#A78BFA", threat: rose, ok: emerald, warn: amber },
    link: "#64748B",
    tile: {
      color: "#12141C",
      glass: { blur: 12, tint: "rgba(18,20,28,0.92)", borderColor: "rgba(255,255,255,0.08)" },
      specular: "rgba(255,255,255,0.12)",
      shadow,
      pad: 0.06,
      radius: 20,
    },
    notePlate: {
      color: "rgba(56,189,248,0.12)",
      glass: { blur: 8, tint: "rgba(56,189,248,0.12)", borderColor: "rgba(56,189,248,0.3)" },
      padX: 16,
      padY: 8,
      radius: 999,
    },
  },

  chat: {
    user: { color: "#1E293B", border: "rgba(255,255,255,0.1)", radii: [16, 16, 4, 16] },
    ai: { color: "#12141C", border: "rgba(255,255,255,0.08)", radii: [16, 16, 16, 4] },
    prompt: {
      color: "rgba(244,63,94,0.08)",
      border: "rgba(244,63,94,0.4)",
      host: { color: "rgba(244,63,94,0.2)", text: "#FDA4AF" },
      button: { color: amber, text: bg },
    },
  },

  // The graphic docks above the picture: a shadow up its last stretch and a
  // hairline at the join.
  seam: { height: 16, color: "rgba(0,0,0,0.8)", line: { weight: 2, color: "rgba(255,255,255,0.1)" } },

  // The dots are the client's, so they are the client's colour.
  packet: { ...base.packet!, color: "accent", seconds: 0.8, labelSize: 26, size: 22, glow: 14, trail: 1 },

  // The ask as a dark slate pill with a lit top edge.
  ribbon: {
    ...base.ribbon,
    size: 44,
    maxWidth: 0.9,
    color: ink,
    shadow: { color: "rgba(0,0,0,0.5)", blur: 8, y: 2 },
    plate: {
      ...base.ribbon.plate,
      color: "#12141C",
      glass: { blur: 12, tint: "rgba(18,20,28,0.94)", borderColor: "rgba(255,255,255,0.14)" },
      specular: "rgba(255,255,255,0.14)",
      shadow,
    },
    accent: { color: sky, weight: 4, inset: 64 },
    sub: { ...base.ribbon.sub!, color: slate },
  },

  // A strike or circle: rose reads as "this is the problem" on obsidian.
  marks: { ...base.marks!, color: rose },

  impact: { ...base.impact!, flash: { color: sky, peak: 0.45, frames: 8 } },

  code: { ...base.code!, dim: 0.5 },
};

export default tokens;
