import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";
import { currentStep } from "./index";

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

export const Code: React.FC<GenProps<CodeSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const tokens = reel.style;
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
        backgroundColor: tokens.bg,
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
