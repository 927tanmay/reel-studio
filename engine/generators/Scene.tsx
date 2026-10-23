import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import { ICONS, segmentProgress } from "../icons";
import { linkEnds, presence, typedText } from "../scene";
import { packetAt } from "../packet";
import { resolveColour } from "../backdrop";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type SceneSpec = Extract<GenSpec, { type: "scene" }>;

/**
 * A stage for "how it works" explainers. Everything is a function of the frame:
 * a glyph draws itself on from its `at`, a link appears once both its ends have,
 * a dot rides a link on the same eased trip a diagram arrow uses, and a note
 * types or fades in on its own clock. Nothing is stateful, so any frame renders
 * alone and the same shotlist is the same scene every time.
 */
export const Scene: React.FC<GenProps<SceneSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const style = tokens.scene;
  if (!style) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const { w, h } = reel.frame;
  const P = tokens.palette;
  const seconds = frame / fps;
  const u = (n: number) => px(tokens, reel.frame, n);
  const tone = (name?: string) => (name ? (style.tones[name] ?? P[name] ?? name) : resolveColour("accent", P, accent));

  const items = new Map(spec.items.map((i) => [i.id, i]));
  const sizeOf = (id: string) => (items.get(id)!.size ?? style.glyphSize) * w;
  const centre = (id: string) => ({ x: items.get(id)!.x * w, y: items.get(id)!.y * h });
  const here = (item: SceneSpec["items"][number]) => presence(frame, fps, item.at, item.until, style.drawFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      {/* Links, underneath everything */}
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        {(spec.links ?? []).map((link, i) => {
          if (!items.has(link.from) || !items.has(link.to)) return null;
          const a = items.get(link.from)!;
          const b = items.get(link.to)!;
          const seen = Math.min(here(a), here(b)) * presence(frame, fps, link.at, link.until, style.drawFrames);
          if (seen <= 0) return null;
          const ends = linkEnds(centre(link.from), centre(link.to), Math.max(sizeOf(link.from), sizeOf(link.to)) * 0.55);
          if (ends.length <= 0) return null;
          const colour = link.tone ? tone(link.tone) : style.link;
          return (
            <line
              key={i}
              x1={ends.x1}
              y1={ends.y1}
              x2={ends.x2}
              y2={ends.y2}
              stroke={colour}
              strokeWidth={u(4)}
              strokeLinecap="round"
              strokeDasharray={link.style === "solid" ? undefined : `${u(1)} ${u(14)}`}
              opacity={0.85 * seen}
            />
          );
        })}
      </svg>

      {/* Glyphs */}
      {spec.items.map((item) => {
        const size = (item.size ?? style.glyphSize) * w;
        const draw = presence(frame, fps, item.at, undefined, style.drawFrames);
        if (draw <= 0) return null;
        const alpha = here(item) / Math.max(draw, 1e-6);
        const colour = tone(item.tone);
        return (
          <div
            key={item.id}
            style={{
              position: "absolute",
              left: item.x * w - size / 2,
              top: item.y * h - size / 2,
              width: size,
              height: size,
              opacity: Math.min(1, alpha),
            }}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 48 48"
              style={{ filter: `drop-shadow(0 0 ${u(style.glow)}px ${colour})`, overflow: "visible" }}
            >
              <g fill="none" stroke={colour} strokeWidth={style.stroke} strokeLinecap="round" strokeLinejoin="round">
                {ICONS[item.kind].map((seg, i) => {
                  const p = segmentProgress(draw, seg);
                  if (seg.dot) return p > 0 ? <circle key={i} cx={seg.dot.cx} cy={seg.dot.cy} r={seg.dot.r + 0.6} fill={colour} opacity={p} /> : null;
                  if (p <= 0) return null;
                  return <path key={i} d={seg.d} {...(p < 1 ? evolvePath(p, seg.d) : {})} />;
                })}
              </g>
            </svg>
            {item.label ? (
              <div
                style={{
                  position: "absolute",
                  top: size * 1.02,
                  left: -size,
                  width: size * 3,
                  textAlign: "center",
                  fontFamily: tokens.fonts.mono,
                  fontSize: u(style.labelSize),
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: P.muted ?? "#8A959F",
                  opacity: 0.9,
                }}
              >
                {item.label}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Dots riding the links */}
      {tokens.packet
        ? (spec.links ?? []).flatMap((link, li) => {
            if (!items.has(link.from) || !items.has(link.to)) return [];
            const ends = linkEnds(centre(link.from), centre(link.to), Math.max(sizeOf(link.from), sizeOf(link.to)) * 0.55);
            if (ends.length <= 0) return [];
            const packet = tokens.packet!;
            const dot = u(packet.size);
            return (link.travel ?? []).flatMap((trip, ti) => {
              const state = packetAt(frame, fps, trip, packet.seconds, packet.fadeFrames);
              if (!state) return [];
              const colour = trip.color ? tone(trip.color) : (P[packet.color] ?? packet.color);
              const at = (p: number) => ({ x: ends.x1 + (ends.x2 - ends.x1) * p, y: ends.y1 + (ends.y2 - ends.y1) * p });
              const head = at(state.progress);
              const ghosts = Array.from({ length: packet.trail + 1 }, (_, g) => {
                const earlier = packetAt(Math.round(trip.at * fps) + Math.max(0, state.local - g * 2), fps, trip, packet.seconds, packet.fadeFrames);
                return { g, ...at(earlier ? earlier.progress : 0) };
              });
              return [
                ...ghosts.map(({ g, x, y }) => (
                  <div
                    key={`d${li}-${ti}-${g}`}
                    style={{
                      position: "absolute",
                      left: x - (dot * (1 - g * 0.14)) / 2,
                      top: y - (dot * (1 - g * 0.14)) / 2,
                      width: dot * (1 - g * 0.14),
                      height: dot * (1 - g * 0.14),
                      borderRadius: "50%",
                      backgroundColor: colour,
                      opacity: state.opacity * (g === 0 ? 1 : 0.5 / g),
                      boxShadow: g === 0 ? `0 0 ${u(packet.glow)}px ${colour}` : undefined,
                    }}
                  />
                )),
                trip.label ? (
                  <div
                    key={`t${li}-${ti}`}
                    style={{
                      position: "absolute",
                      left: head.x,
                      top: head.y - dot * 1.9,
                      transform: "translateX(-50%)",
                      fontFamily: tokens.fonts.mono,
                      fontSize: u(packet.labelSize),
                      color: colour,
                      whiteSpace: "nowrap",
                      opacity: state.opacity,
                    }}
                  >
                    {trip.label}
                  </div>
                ) : null,
              ];
            });
          })
        : null}

      {/* Notes */}
      {(spec.notes ?? []).map((note, i) => {
        const shown = presence(frame, fps, note.at, note.until, 6);
        if (shown <= 0) return null;
        const near = note.near ? items.get(note.near) : undefined;
        const x = (near ? near.x : (note.x ?? 0.5)) * w;
        const y = near ? near.y * h - ((near.size ?? style.glyphSize) * w) * 0.7 : (note.y ?? 0.5) * h;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              fontFamily: tokens.fonts.mono,
              fontSize: u(style.noteSize),
              color: tone(note.tone),
              whiteSpace: "pre",
              opacity: shown,
              textShadow: `0 0 ${u(10)}px ${tone(note.tone)}55`,
            }}
          >
            {typedText(note, seconds)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
