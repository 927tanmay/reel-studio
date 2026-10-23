import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type TerminalSpec = Extract<GenSpec, { type: "terminal" }>;

/**
 * A shell session that runs at the pace you set.
 *
 * Faster to iterate on than a real screen recording, and it cannot leak a home
 * directory, a hostname or a token the way a real one can.
 */
export const Terminal: React.FC<GenProps<TerminalSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const P = tokens.palette;

  const speed = spec.typeSpeed ?? 22;
  const fontSize = px(tokens, reel.frame, 32);
  const pad = px(tokens, reel.frame, 44);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, padding: pad, justifyContent: "center" }}>
      <div
        style={{
          fontFamily: tokens.fonts.mono,
          fontSize,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {spec.lines.map((line, i) => {
          const at = line.at ?? i * 1.2;
          if (seconds < at) return null;

          const elapsed = seconds - at;
          const command = line.command ?? "";
          const typed = command.slice(0, Math.floor(elapsed * speed));
          const done = typed.length >= command.length;
          const showCursor = !done && Math.floor(elapsed * 2) % 2 === 0;

          return (
            <div key={i} style={{ marginBottom: px(tokens, reel.frame, 8) }}>
              {line.command !== undefined ? (
                <div>
                  <span style={{ color: P.prompt ?? P.accent ?? "#5ad" }}>
                    {line.prompt ?? "$"}{" "}
                  </span>
                  <span style={{ color: P.code ?? tokens.title.color }}>{typed}</span>
                  {showCursor ? (
                    <span style={{ color: P.accent ?? "#5ad" }}>▍</span>
                  ) : null}
                </div>
              ) : null}

              {line.output !== undefined && (done || line.command === undefined) ? (
                <div style={{ color: P.muted ?? "#8a939c" }}>{line.output}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
