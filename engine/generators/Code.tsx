import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";
import { currentStep, useGeneratorBg } from "./index";
import { matchTokens, type CodeToken } from "../codeMorph";
import { useTokens } from "./shiki";
import { ease } from "../moves/punch";

type CodeSpec = Extract<GenSpec, { type: "code" }>;

const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|import|from|export|default|async|await|class|extends|new|type|interface|public|private|def|fn|pub|use|match|impl|struct)\b/;

/**
 * A deliberately small highlighter. Enough structure to read a snippet at a
 * glance on a phone, with no dependency to keep current. Colours come from the
 * look's palette so code matches everything else on screen.
 */
const highlight = (line: string, palette: Record<string, string>, base: string) => {
  const parts: { text: string; color: string }[] = [];
  const commentAt = line.search(/(\/\/|#\s)/);

  const body = commentAt >= 0 ? line.slice(0, commentAt) : line;
  const comment = commentAt >= 0 ? line.slice(commentAt) : "";

  const re = /("[^"]*"|'[^']*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\w+|\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const t = m[0];
    let color = base;
    if (/^["'`]/.test(t)) color = palette.string ?? palette.accent ?? base;
    else if (/^\d/.test(t)) color = palette.number ?? palette.neutral ?? base;
    else if (KEYWORDS.test(t)) color = palette.keyword ?? palette.accent ?? base;
    parts.push({ text: t, color });
  }
  if (comment) parts.push({ text: comment, color: palette.muted ?? "#7a8590" });
  return parts;
};

export const Code: React.FC<GenProps<CodeSpec>> = (props) =>
  props.spec.highlighter === "shiki" ? <ShikiCode {...props} /> : <SimpleCode {...props} />;

const SimpleCode: React.FC<GenProps<CodeSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const P = tokens.palette;

  const lines = spec.code.replace(/\t/g, "  ").split("\n");
  const total = spec.code.length;

  // Typing is a reveal, not an animation for its own sake: 0 shows it at once.
  const speed = spec.typeSpeed ?? 0;
  const revealed = speed > 0 ? Math.min(total, Math.floor(seconds * speed)) : total;

  const steps = spec.highlight ?? [];
  const active = steps.length > 0 ? new Set(steps[currentStep(steps, seconds)].lines) : null;

  const fontSize = px(tokens, reel.frame, 34);
  const pad = px(tokens, reel.frame, 48);
  let consumed = 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        padding: pad,
        justifyContent: "center",
      }}
    >
      {spec.title ? (
        <div
          style={{
            fontFamily: tokens.fonts.mono,
            fontSize: px(tokens, reel.frame, 26),
            color: P.muted ?? "#7a8590",
            marginBottom: px(tokens, reel.frame, 24),
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {spec.title}
        </div>
      ) : null}

      <div
        style={{
          fontFamily: tokens.fonts.mono,
          fontSize,
          lineHeight: 1.55,
          whiteSpace: "pre",
        }}
      >
        {lines.map((line, i) => {
          const start = consumed;
          consumed += line.length + 1;
          const visibleChars = Math.max(0, Math.min(line.length, revealed - start));
          if (visibleChars <= 0 && revealed <= start) return null;

          const shown = line.slice(0, visibleChars);
          const lit = active === null || active.has(i + 1);

          return (
            <div
              key={i}
              style={{
                opacity: lit ? 1 : 0.32,
                backgroundColor:
                  active !== null && active.has(i + 1)
                    ? (P.highlight ?? "rgba(255,255,255,.06)")
                    : undefined,
                borderRadius: px(tokens, reel.frame, 6),
                paddingLeft: px(tokens, reel.frame, 10),
                marginLeft: px(tokens, reel.frame, -10),
              }}
            >
              {highlight(shown, P, P.code ?? tokens.title.color).map((part, j) => (
                <span key={j} style={{ color: part.color }}>
                  {part.text}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * The Shiki path: every token is its own absolutely positioned span, placed in
 * `ch` units so a monospace font lands each one exactly, which is what lets a
 * token slide from its old position to its new one between versions.
 */
const ShikiCode: React.FC<GenProps<CodeSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const P = tokens.palette;
  const style = tokens.code;

  const clean = (c: string) => c.replace(/\t/g, "  ");
  const states = [{ at: 0, code: clean(spec.code) }, ...(spec.states ?? []).map((s) => ({ at: s.at, code: clean(s.code) }))].sort(
    (a, b) => a.at - b.at,
  );
  const tokenSets = useTokens(
    states.map((s) => s.code),
    spec.language ?? "typescript",
    P,
  );
  if (!tokenSets) return <AbsoluteFill style={{ backgroundColor: bg }} />;

  const morphFrames = style?.morphFrames ?? 1;
  const dim = style?.dim ?? 0.32;

  // Which version we are in, and how far into the morph toward the next one.
  // A version is "current" from its own `at`; its morph runs over the frames
  // that follow, easing the pair together.
  let index = 0;
  states.forEach((s, i) => {
    if (s.at <= seconds) index = i;
  });
  const sinceStart = (seconds - states[index].at) * fps;
  const morph = index === 0 ? 1 : ease(sinceStart / Math.max(1, morphFrames), "easeInOut");
  const from = index === 0 ? tokenSets[0] : tokenSets[index - 1];
  const to = tokenSets[index];

  // The typing reveal belongs to the first version only: once something morphs,
  // the previous version is assumed to have finished typing.
  const typeSpeed = spec.typeSpeed ?? 0;
  const total = states[0].code.length;
  const revealed = index > 0 || typeSpeed <= 0 ? total : Math.min(total, Math.floor(seconds * typeSpeed));

  const steps = spec.highlight ?? [];
  const activeLines = steps.length > 0 ? new Set(steps[currentStep(steps, seconds)].lines) : null;
  const lit = (line: number) => (activeLines === null || activeLines.has(line + 1) ? 1 : dim);

  const fontSize = px(tokens, reel.frame, 34);
  const lineHeight = fontSize * 1.55;
  const pad = px(tokens, reel.frame, 48);
  const rows = Math.max(...tokenSets.map((set) => set.reduce((n, t) => Math.max(n, t.line + 1), 0)));

  type Drawn = { key: string; token: CodeToken; x: number; y: number; opacity: number; text: string };
  const drawn: Drawn[] = [];
  const mono = (t: CodeToken, key: string, x: number, y: number, opacity: number): Drawn => {
    // Typing reveals characters of the *first* version by their offset.
    const visible = index === 0 ? Math.max(0, Math.min(t.text.length, revealed - t.offset)) : t.text.length;
    return { key, token: t, x, y, opacity, text: t.text.slice(0, visible) };
  };

  if (index === 0 || morph >= 1) {
    to.forEach((t, i) => drawn.push(mono(t, `n${i}`, t.col, t.line, lit(t.line))));
  } else {
    const { pairs, removed, added } = matchTokens(from, to);
    for (const [a, b] of pairs) {
      const x = from[a].col + (to[b].col - from[a].col) * morph;
      const y = from[a].line + (to[b].line - from[a].line) * morph;
      const o = lit(from[a].line) + (lit(to[b].line) - lit(from[a].line)) * morph;
      drawn.push(mono(to[b], `m${a}-${b}`, x, y, o));
    }
    // Leaving tokens fade over the first half, arriving ones over the second,
    // so the two never sit on top of each other at the same strength.
    for (const a of removed) {
      drawn.push(mono(from[a], `r${a}`, from[a].col, from[a].line, lit(from[a].line) * Math.max(0, 1 - morph * 2)));
    }
    for (const b of added) {
      drawn.push(mono(to[b], `a${b}`, to[b].col, to[b].line, lit(to[b].line) * Math.max(0, morph * 2 - 1)));
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: bg, padding: pad, justifyContent: "center" }}>
      {spec.title ? (
        <div
          style={{
            fontFamily: tokens.fonts.mono,
            fontSize: px(tokens, reel.frame, 26),
            color: P.muted ?? "#7a8590",
            marginBottom: px(tokens, reel.frame, 24),
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {spec.title}
        </div>
      ) : null}

      <div style={{ position: "relative", height: rows * lineHeight, fontFamily: tokens.fonts.mono, fontSize }}>
        {activeLines
          ? [...activeLines].map((line) => (
              <div
                key={`row-${line}`}
                style={{
                  position: "absolute",
                  left: px(tokens, reel.frame, -10),
                  right: 0,
                  top: (line - 1) * lineHeight,
                  height: lineHeight,
                  backgroundColor: P.highlight ?? "rgba(255,255,255,.06)",
                  borderRadius: px(tokens, reel.frame, 6),
                }}
              />
            ))
          : null}
        {drawn.map((d) =>
          d.text.length === 0 || d.opacity <= 0 ? null : (
            <span
              key={d.key}
              style={{
                position: "absolute",
                left: `${d.x}ch`,
                top: d.y * lineHeight,
                lineHeight: `${lineHeight}px`,
                whiteSpace: "pre",
                color: d.token.color,
                opacity: d.opacity,
              }}
            >
              {d.text}
            </span>
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};
