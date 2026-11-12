import type { Tokens } from "../../engine/tokens";
import base from "../explainer/tokens";

/**
 * The explainer look with punchy short-form captions: two words a card,
 * uppercase, each word popping in as it is spoken, the spoken word boxed in
 * the accent. For hot-topic reels read fast. Everything else is the explainer
 * look, so a fix there reaches this one too.
 */
export const tokens: Tokens = {
  ...base,
  name: "punchy",
  caption: {
    ...base.caption,
    size: 78,
    weight: 900,
    uppercase: true,
    tracking: -0.01,
    bottom: 0.25,
    maxWords: 2,
    // A card never spans two sentences: a hidden next word would hold its space
    // on a second line and lift the card.
    breakOnSentence: true,
    pop: { frames: 6, from: 0.62 },
    leadMs: 0,
  },
  // The captions are bigger here and start higher (about 65% down), so the block
  // and window spaces end higher to clear them.
  blocks: { ...base.blocks!, top: 0.44, maxHeight: 0.42 },
  window: { ...base.window!, top: 0.445, maxHeight: 0.4 },
};

export default tokens;
