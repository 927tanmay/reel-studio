/**
 * How big a diagram's cards have to be so that what is written on them fits.
 *
 * A diagram's cards used to be fixed fractions of the frame, drawn for short
 * labels. A longer label or a two-line sub-label overflowed its card, the flex
 * layout squeezed the icon to a few pixels, and at `window: 3` a row's cards
 * were wider than the frame, so the outer two ran off both edges. With
 * `fit: true` the cards are sized from their own content instead.
 *
 * Pure: it is handed a function that measures one line of text, so the maths
 * can be tested without a browser and the renderer can pass the real one.
 */

export type FitNode = { label: string; sub?: string; visual: boolean };

export type FitInput = {
  layout: "row" | "column" | "grid";
  /** How many nodes are meant to be in frame at once. */
  window: number;
  count: number;
  frameW: number;
  frameH: number;
  /** Type sizes and spacing, in output pixels. */
  labelSize: number;
  subSize: number;
  iconSize: number;
  padding: number;
  border: number;
  innerGap: number;
  /** The tallest a card is allowed to be shorter than: the layout's own height. */
  minCardH: number;
  nodes: FitNode[];
  /** Width of a single line of text at a size, in output pixels. */
  measure: (text: string, size: number, mono: boolean) => number;
};

export type Fit = {
  cardW: number;
  cardH: number;
  gap: number;
  labelSize: number;
  subSize: number;
};

/** Share of the frame width a row's cards, and the gaps between them, may take up. */
export const ROW_USABLE = 0.92;
/** Gap between row cards, as a share of a card's width. */
export const ROW_GAP = 0.22;
/** Smallest a label or sub-label is shrunk to, as a share of its asked size. */
export const MIN_SHRINK = 0.75;

/** How many lines a greedy word wrap gives `text` in `width` pixels. */
export const wrapLines = (
  text: string,
  size: number,
  mono: boolean,
  width: number,
  measure: FitInput["measure"],
): number => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let lines = 1;
  let line = words[0];
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (measure(next, size, mono) <= width) {
      line = next;
    } else {
      lines += 1;
      line = word;
    }
  }
  return lines;
};

/** Most lines a label or sub-label is allowed before the type is shrunk to pull it in. */
export const MAX_LINES = 2;

/**
 * The size at which the widest single word fits one line and no text wraps to
 * more than `MAX_LINES`, never below the floor. One size for every node, so a
 * row of cards reads as one system rather than each card its own.
 */
const shrinkToFit = (
  texts: string[],
  asked: number,
  mono: boolean,
  width: number,
  measure: FitInput["measure"],
): number => {
  const words = texts.flatMap((t) => t.split(/\s+/).filter(Boolean));
  let size = asked;
  const floor = asked * MIN_SHRINK;
  const tooBig = (at: number) =>
    words.some((w) => measure(w, at, mono) > width) ||
    texts.some((t) => wrapLines(t, at, mono, width, measure) > MAX_LINES);
  while (size > floor && tooBig(size)) {
    size = Math.max(floor, size * 0.95);
  }
  return size;
};

export const fitDiagram = (input: FitInput): Fit => {
  const { layout, window, count, frameW, padding, border, innerGap, measure } = input;
  const column = layout === "column";

  const shown = Math.max(1, Math.min(window, count));
  const cardW = column
    ? frameW * 0.76
    : (frameW * ROW_USABLE) / (shown + ROW_GAP * (shown - 1));
  // 5% short of the true inner width: a browser wraps a hair earlier than a measurement says.
  const inner = (cardW - 2 * (padding + border)) * 0.95;

  const labelSize = shrinkToFit(input.nodes.map((n) => n.label), input.labelSize, false, inner, measure);
  const subSize = shrinkToFit(
    input.nodes.flatMap((n) => (n.sub ? [n.sub] : [])),
    input.subSize,
    true,
    inner,
    measure,
  );

  let needed = 0;
  for (const node of input.nodes) {
    const labelLines = wrapLines(node.label, labelSize, false, inner, measure);
    const subLines = node.sub ? wrapLines(node.sub, subSize, true, inner, measure) : 0;
    const parts =
      (node.visual ? input.iconSize + innerGap : 0) +
      labelLines * labelSize * 1.1 +
      (subLines > 0 ? innerGap + subLines * subSize * 1.25 : 0);
    needed = Math.max(needed, parts + 2 * (padding + border));
  }

  const cardH = Math.max(needed, input.minCardH);
  const gap = column ? cardH * 0.42 : cardW * ROW_GAP;
  return { cardW, cardH, gap, labelSize, subSize };
};
