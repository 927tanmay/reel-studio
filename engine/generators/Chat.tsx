import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChatMessage, GenSpec } from "../spec";
import { px } from "../scale";
import { ease } from "../moves/punch";
import { StaticIcon } from "./StaticIcon";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type ChatSpec = Extract<GenSpec, { type: "chat" }>;

/** A hex colour with an alpha, falling back to the palette's own tint for anything else. */
const tint = (colour: string, alpha: number, fallback: string) =>
  /^#[0-9a-fA-F]{6}$/.test(colour)
    ? `${colour}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`
    : fallback;

/**
 * A chat window. Every state is a function of the frame: a bubble arrives on
 * an ease, a pressed button dips for a few frames, an image slot swaps from its
 * prompt to its outcome. Space is reserved for bubbles that have not arrived,
 * so nothing already on screen moves when a new one lands.
 */
export const Chat: React.FC<GenProps<ChatSpec>> = ({ spec, reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const P = tokens.palette;
  const g = tokens.generators?.textScale ?? 1;
  const u = (n: number) => px(tokens, reel.frame, n * g);
  const accent = P.accent ?? "#4FD1C5";
  const warn = P.warn ?? "#F97583";
  const ink = tokens.title.color;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <div
        style={{
          position: "absolute",
          left: reel.frame.w * 0.06,
          right: reel.frame.w * 0.06,
          top: reel.frame.h * 0.17,
          display: "flex",
          flexDirection: "column",
          gap: u(30),
        }}
      >
        {spec.messages.map((m, i) => (
          <Bubble key={i} m={m} frame={frame} fps={fps} u={u} tokens={tokens} accent={accent} warn={warn} ink={ink} reel={reel} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Bubble: React.FC<{
  m: ChatMessage;
  frame: number;
  fps: number;
  u: (n: number) => number;
  tokens: GenProps<ChatSpec>["reel"]["style"];
  accent: string;
  warn: string;
  ink: string;
  reel: GenProps<ChatSpec>["reel"];
}> = ({ m, frame, fps, u, tokens, accent, warn, ink, reel }) => {
  const P = tokens.palette;
  const at = Math.round((m.at ?? 0) * fps);
  const arrive = ease((frame - at) / 10, "easeOut");
  const user = m.from === "user";
  const maxW = reel.frame.w * 0.78;

  return (
    <div
      style={{
        alignSelf: user ? "flex-end" : "flex-start",
        maxWidth: maxW,
        opacity: arrive,
        transform: `translateY(${(1 - arrive) * u(24)}px)`,
        backgroundColor: user ? tint(accent, 0.18, P.highlight ?? "rgba(79,209,197,0.12)") : (P.surface ?? "rgba(255,255,255,0.05)"),
        border: `${u(2)}px solid ${user ? accent : (P.chrome ?? "#3E6E6A")}`,
        borderRadius: u(26),
        borderBottomRightRadius: user ? u(8) : u(26),
        borderBottomLeftRadius: user ? u(26) : u(8),
        padding: `${u(22)}px ${u(28)}px`,
      }}
    >
      <div style={{ fontFamily: tokens.fonts.display, fontSize: u(38), lineHeight: 1.35, color: ink, fontWeight: 600 }}>{m.text}</div>

      {m.image ? <ImageSlot m={m} frame={frame} fps={fps} u={u} tokens={tokens} accent={accent} warn={warn} ink={ink} width={maxW - u(56)} /> : null}

      {m.buttons?.length ? (
        <div style={{ display: "flex", gap: u(14), marginTop: u(18), flexWrap: "wrap" }}>
          {m.buttons.map((b, i) => {
            const pressFrame = b.pressAt === undefined ? null : Math.round(b.pressAt * fps);
            const anyPressed = m.buttons!.some((x) => x.pressAt !== undefined && frame >= Math.round(x.pressAt * fps));
            const pressed = pressFrame !== null && frame >= pressFrame;
            const dip = pressFrame !== null && frame >= pressFrame && frame < pressFrame + 5 ? 0.92 : 1;
            const colour = b.kind === "danger" ? warn : b.kind === "neutral" ? (P.muted ?? "#8A959F") : accent;
            return (
              <div
                key={i}
                style={{
                  fontFamily: tokens.fonts.display,
                  fontWeight: 700,
                  fontSize: u(32),
                  padding: `${u(12)}px ${u(30)}px`,
                  borderRadius: u(14),
                  color: b.kind === "neutral" && !pressed ? ink : tokens.bg,
                  backgroundColor: b.kind === "neutral" && !pressed ? "transparent" : colour,
                  border: `${u(2)}px solid ${colour}`,
                  opacity: anyPressed && !pressed ? 0.35 : 1,
                  transform: `scale(${dip})`,
                }}
              >
                {b.label}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const ImageSlot: React.FC<{
  m: ChatMessage;
  frame: number;
  fps: number;
  u: (n: number) => number;
  tokens: GenProps<ChatSpec>["reel"]["style"];
  accent: string;
  warn: string;
  ink: string;
  width: number;
}> = ({ m, frame, fps, u, tokens, accent, warn, ink, width }) => {
  const image = m.image!;
  const P = tokens.palette;
  const appear = Math.round((image.at ?? (m.at ?? 0) + 0.4) * fps);
  const arrive = ease((frame - appear) / 8, "easeOut");
  const press = image.pressAt === undefined ? null : Math.round(image.pressAt * fps);
  // The outcome shows a few frames after the press, so the press reads as the cause.
  const done = press !== null && frame >= press + 6;
  const dip = press !== null && frame >= press && frame < press + 5 ? 0.92 : 1;
  const outcome = image.outcome ?? "loaded";
  const height = width * 0.56;

  return (
    <div
      style={{
        marginTop: u(18),
        width,
        height,
        opacity: arrive,
        borderRadius: u(18),
        overflow: "hidden",
        position: "relative",
        border: `${u(2)}px ${done ? "solid" : "dashed"} ${done && outcome === "blocked" ? warn : (P.chrome ?? "#3E6E6A")}`,
        background: done && outcome === "loaded" ? `linear-gradient(135deg, ${P.chrome ?? "#3E6E6A"}, ${accent})` : tokens.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: u(14),
        textAlign: "center",
        padding: u(20),
      }}
    >
      {done && outcome === "loaded" ? (
        <>
          <StaticIcon name="image" size={u(96)} colour={tokens.bg} />
          <div style={{ fontFamily: tokens.fonts.mono, fontSize: u(26), color: tokens.bg, fontWeight: 600 }}>{image.host}</div>
        </>
      ) : done ? (
        <>
          <StaticIcon name="shield" size={u(84)} colour={warn} />
          <div style={{ fontFamily: tokens.fonts.display, fontSize: u(34), color: warn, fontWeight: 700 }}>Blocked</div>
          <div style={{ fontFamily: tokens.fonts.mono, fontSize: u(24), color: P.muted ?? "#8A959F" }}>{image.host}</div>
        </>
      ) : (
        <>
          <StaticIcon name="image" size={u(72)} colour={P.muted ?? "#8A959F"} />
          <div style={{ fontFamily: tokens.fonts.display, fontSize: u(32), color: ink, fontWeight: 600, lineHeight: 1.25 }}>
            {image.prompt ?? (
              <>
                Load image from <span style={{ color: warn, fontFamily: tokens.fonts.mono }}>{image.host}</span>?
              </>
            )}
          </div>
          <div
            style={{
              fontFamily: tokens.fonts.display,
              fontWeight: 700,
              fontSize: u(30),
              padding: `${u(10)}px ${u(34)}px`,
              borderRadius: u(12),
              backgroundColor: accent,
              color: tokens.bg,
              transform: `scale(${dip})`,
            }}
          >
            Load
          </div>
        </>
      )}
    </div>
  );
};
