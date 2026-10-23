import type { Tokens } from "../../engine/tokens";
import base from "../default/tokens";

/**
 * A look for faceless explainers and tool roundups: a near-black ground with
 * soft coloured glows, a header on every section, and captions that put the
 * spoken word in a filled box, set big and two or three words at a time.
 *
 * It is the default look with the things that make that style different
 * overridden, not a second copy of everything — so a fix to the default
 * (a safe zone, a font) reaches this one too. Copy this file, not the default,
 * when starting a channel that looks like this.
 */
export const tokens: Tokens = {
  ...base,
  name: "explainer",
  bg: "#04060A",

  caption: {
    ...base.caption,
    size: 66,
    weight: 800,
    tracking: -0.015,
    lineHeight: 1.18,
    maxWidth: 0.84,
    // Centred a little above the bottom third, as a spoken line is read: high
    // enough to stay clear of the platform's own controls.
    bottom: 0.23,
    shadow: { color: "rgba(0,0,0,0.55)", blur: 12, y: 3 },
    // Two or three words a card, so the box has a short line to move along.
    windowMs: 650,
    fadeFrames: 2,
    leadMs: 80,
    activeBox: { color: "#27D9F5", textColor: "#04141A", radius: 12, padX: 12, padY: 3 },
  },

  // A screenshot window has to fit between the header (which ends about 22%
  // down) and the captions (which start about 69% down), so it is shorter than
  // the default's; a full-page capture scrolls inside it.
  window: { ...base.window!, top: 0.465, maxHeight: 0.42 },
};

export default tokens;
