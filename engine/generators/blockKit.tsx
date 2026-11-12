import React, { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import type { Frame, Highlight, PostAuthor } from "../spec";
import type { BlocksStyle, Tokens } from "../tokens";
import { px } from "../scale";
import { panelStyle } from "../moves/surface";
import { resolveColour } from "../backdrop";
import { highlightRuns, monogram, progress } from "../blocks";

/**
 * What the hot-topic blocks share: one card, one way of arriving, one
 * highlighter, one avatar. Kept together so the five read as a family and a
 * change to one (the card's corner, the arrival's distance) reaches all of them.
 */

export type Kit = {
  style: BlocksStyle;
  u: (n: number) => number;
  /** The colours for this block's theme. */
  ink: { text: string; muted: string };
  card: CSSProperties;
  accent: string;
  /** Type on the accent (a monogram): the look's own ground. */
  onAccent: string;
  /** A hairline inside a card, in this theme. */
  rule: string;
};

export const blockKit = (tokens: Tokens, frame: Frame, accent: string | undefined, theme: "dark" | "light" = "dark"): Kit | null => {
  const style = tokens.blocks;
  if (!style) return null;
  const u = (n: number) => px(tokens, frame, n);
  const light = theme === "light";
  const own: CSSProperties = {
    backgroundColor: light ? style.light.card : style.card.color,
    border: `${u(1.5)}px solid ${light ? style.light.border : style.card.border}`,
    borderRadius: u(style.card.radius),
    boxShadow: style.card.shadow ? `0 ${u(style.card.shadow.y)}px ${u(style.card.shadow.blur)}px ${style.card.shadow.color}` : undefined,
  };
  // A light card is its own thing; a dark one wears the look's shared panel when it has one.
  const panel = light ? undefined : panelStyle(tokens, frame);
  return {
    style,
    u,
    ink: light ? { text: style.light.text, muted: style.light.muted } : { text: style.text, muted: style.muted },
    card: panel ?? own,
    accent: resolveColour("accent", tokens.palette, accent),
    onAccent: tokens.bg,
    rule: light ? style.light.border : style.card.border,
  };
};

/**
 * Where a block sits: centred on the look's `top`, at its width, and never
 * taller than the look's `maxHeight` — a block that would be (a post with a
 * picture and a reply, a long timeline) shrinks to fit about its centre rather
 * than running under the header above or the captions below.
 *
 * The height is measured from layout, which a transform does not change, so
 * the shrink cannot feed back into the measurement. It is the same on every
 * frame because every block keeps the space of what has not arrived yet and
 * gives its pictures a fixed height: nothing about its size waits on a load.
 */
export const BlockFrame: React.FC<{ kit: Kit; frame: Frame; style?: CSSProperties; children: React.ReactNode }> = ({
  kit,
  frame,
  style,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const max = kit.style.maxHeight * frame.h;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.offsetHeight > max ? max / el.offsetHeight : 1;
    if (Math.abs(next - scale) > 0.001) setScale(next);
  });
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: (frame.w * (1 - kit.style.width)) / 2,
        width: frame.w * kit.style.width,
        top: kit.style.top * frame.h,
        ...style,
        transform: scale === 1 ? "translateY(-50%)" : `translateY(-50%) scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};

/** Rises and fades in from `startFrame`. Before it, invisible but still taking its space. */
export const arrive = (frame: number, startFrame: number, kit: Kit): CSSProperties => {
  const p = progress(frame, startFrame, kit.style.enterFrames);
  return { opacity: p, transform: p >= 1 ? undefined : `translateY(${(1 - p) * kit.u(28)}px)` };
};

/**
 * Text with phrases swept by a highlighter. The marker grows left to right
 * across each phrase from its `at`; `box-decoration-break: clone` gives every
 * line of a wrapped phrase its own sweep, so a phrase that breaks across two
 * lines is marked on both.
 */
export const Marked: React.FC<{
  text: string;
  highlights?: Highlight[];
  frame: number;
  fps: number;
  /** When a highlight with no `at` sweeps, in frames. */
  defaultFrame: number;
  kit: Kit;
  palette: Record<string, string>;
}> = ({ text, highlights, frame, fps, defaultFrame, kit, palette }) => {
  if (!highlights?.length) return <>{text}</>;
  const runs = highlightRuns(text, highlights.map((h) => h.phrase));
  return (
    <>
      {runs.map((run, i) => {
        if (run.highlight === undefined) return <React.Fragment key={i}>{run.text}</React.Fragment>;
        const h = highlights[run.highlight];
        const start = h.at !== undefined ? Math.round(h.at * fps) : defaultFrame;
        const p = progress(frame, start, kit.style.sweepFrames);
        const colour = h.color ? resolveColour(h.color, palette, undefined) : kit.style.highlight;
        return (
          <span
            key={i}
            style={{
              backgroundImage: `linear-gradient(${colour}, ${colour})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${p * 100}% 100%`,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              borderRadius: kit.u(6),
              padding: `0 ${kit.u(4)}px`,
              margin: `0 ${-kit.u(4)}px`,
              color: p > 0 && kit.style.highlightText ? kit.style.highlightText : undefined,
            }}
          >
            {run.text}
          </span>
        );
      })}
    </>
  );
};

/** A round picture, or a monogram on the accent when there is none. */
export const Avatar: React.FC<{ author: PostAuthor; size: number; kit: Kit; font: string }> = ({ author, size, kit, font }) =>
  author.avatar ? (
    <Img src={staticFile(author.avatar)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "none",
        display: "grid",
        placeItems: "center",
        backgroundColor: kit.accent,
        color: kit.onAccent,
        fontFamily: font,
        fontWeight: 800,
        fontSize: size * 0.38,
      }}
    >
      {monogram(author.name)}
    </div>
  );

/** A small filled circle with a tick, beside a name. A generic mark, not any platform's badge. */
export const Verified: React.FC<{ size: number; colour: string; tick: string }> = ({ size, colour, tick }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}>
    <circle cx="12" cy="12" r="11" fill={colour} />
    <path d="M7 12.5 L10.5 16 L17 9" fill="none" stroke={tick} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A small picture under `public/` at a given height, keeping its own width. */
export const Mark: React.FC<{ src: string; height: number }> = ({ src, height }) => (
  <Img src={staticFile(src)} style={{ height, width: "auto", flex: "none", objectFit: "contain" }} />
);
