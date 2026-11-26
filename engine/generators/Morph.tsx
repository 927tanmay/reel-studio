import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec, MorphState } from "../spec";
import type { MorphStyle } from "../tokens";
import { px } from "../scale";
import { resolveColour } from "../backdrop";
import { SPRINGS, colourTrack, pointerAt, pressAt, spring, swap, track } from "../spring";
import { StaticIcon } from "./StaticIcon";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type MorphSpec = Extract<GenSpec, { type: "morph" }>;

/**
 * One shape that never cuts. Its size, corners, colour and the camera are each
 * a spring track over the states, so a change of state mid-move carries the
 * motion on rather than restarting it; the content of each state is laid out
 * at that state's own size and swapped with a short blur, so text never reflows
 * while the shape is changing. Everything is a function of the frame.
 */
export const Morph: React.FC<GenProps<MorphSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const style = tokens.morph;
  const states = [...spec.states].sort((a, b) => a.at - b.at);
  if (!style || states.length === 0) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const u = (n: number) => px(tokens, reel.frame, n);
  const t = frame / fps;
  const P = tokens.palette;
  const colour = (c: string) => resolveColour(c, P, accent);
  const size = (s: MorphState) => ({ ...style.shapes[s.shape], ...(s.width ? { width: s.width } : {}), ...(s.height ? { height: s.height } : {}), ...(s.radius !== undefined ? { radius: s.radius } : {}) });
  const fillOf = (s: MorphState) => colour(s.fill ?? (s.shape === "terminal" ? style.terminal.fill : style.fill));

  const first = states[0];
  const keys = (get: (s: MorphState) => number) => states.slice(1).map((s) => ({ at: s.at, value: get(s) }));
  const w = track(size(first).width, keys((s) => size(s).width))(t);
  const h = track(size(first).height, keys((s) => size(s).height))(t);
  const r = track(size(first).radius, keys((s) => size(s).radius))(t);
  const zoom = track(first.zoom ?? 1, keys((s) => s.zoom ?? 1), SPRINGS.camera)(t);
  const fill = colourTrack(fillOf(first), states.slice(1).map((s) => ({ at: s.at, value: fillOf(s) })))(t);

  // The shape pops in on the first state, and dips a little under each press.
  const intro = 0.55 + 0.45 * spring(t - first.at, [13, 0.78]);
  const shown = Math.min(1, Math.max(0, (t - first.at) / 0.12));
  const clicks = (spec.cursor?.clicks ?? []).map((c) => c.at);
  const drags = (spec.cursor?.drags ?? []).map((d) => [d.at, d.until] as [number, number]);
  const press = pressAt(t, clicks, drags);
  const scale = zoom * intro * (1 - 0.035 * press);

  const cx = reel.frame.w / 2;
  const cy = style.top * reel.frame.h;
  const radius = Math.min(u(r), u(h) / 2, u(w) / 2);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <div
        style={{
          position: "absolute",
          left: cx - u(w) / 2,
          top: cy - u(h) / 2,
          width: u(w),
          height: u(h),
          borderRadius: radius,
          backgroundColor: fill,
          boxShadow: style.shadow ? `0 ${u(style.shadow.y)}px ${u(style.shadow.blur)}px ${style.shadow.color}` : undefined,
          transform: `scale(${scale})`,
          opacity: shown,
          overflow: "hidden",
        }}
      >
        {states.map((s, i) => {
          const v = swap(t, s.at, states[i + 1]?.at ?? null, u(12));
          if (v.opacity < 0.002) return null;
          const own = size(s);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: u(own.width),
                height: u(own.height),
                marginLeft: -u(own.width) / 2,
                marginTop: -u(own.height) / 2,
                opacity: v.opacity,
                filter: v.blur > 0.05 ? `blur(${v.blur.toFixed(2)}px)` : undefined,
                transform: `scale(${v.scale})`,
              }}
            >
              <Content state={s} t={t - s.at} style={style} u={u} colour={colour} fonts={tokens.fonts} />
            </div>
          );
        })}
      </div>

      {spec.cursor?.path.length ? <Cursor spec={spec} t={t} press={press} style={style} u={u} frame={reel.frame} /> : null}
    </AbsoluteFill>
  );
};

type ContentProps = {
  state: MorphState;
  /** Seconds since this state arrived. */
  t: number;
  style: MorphStyle;
  u: (n: number) => number;
  colour: (c: string) => string;
  fonts: { display: string; mono: string };
};

const Content: React.FC<ContentProps> = ({ state, t, style, u, colour, fonts }) => {
  const accent = colour(style.accent);
  const ink = style.ink;
  const pad = u(44);
  const label = { fontFamily: fonts.display, fontWeight: 700, fontSize: u(style.sizes.label), color: ink, letterSpacing: "-0.01em" } as const;

  switch (state.shape) {
    case "pill":
      return (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: u(20) }}>
          {state.icon ? <StaticIcon name={state.icon} size={u(56)} colour={accent} stroke={4} /> : null}
          <span style={{ ...label, whiteSpace: "nowrap" }}>{state.label}</span>
        </div>
      );

    case "card":
      return (
        <div style={{ position: "absolute", inset: 0, padding: pad, display: "flex", flexDirection: "column", gap: u(22) }}>
          <div style={{ display: "flex", alignItems: "center", gap: u(18) }}>
            {state.icon ? <StaticIcon name={state.icon} size={u(54)} colour={accent} stroke={4} /> : null}
            <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: u(style.sizes.title), color: ink, lineHeight: 1.15 }}>{state.title}</span>
          </div>
          {(state.lines ?? ["", "", ""]).map((line, i) => {
            // An empty line is a skeleton bar: a placeholder for text not yet supplied, never invented copy.
            const appear = Math.min(1, Math.max(0, (t - 0.25 - i * 0.08) / 0.2));
            return line.trim() ? (
              <div key={i} style={{ fontFamily: fonts.display, fontSize: u(style.sizes.body), color: style.muted, lineHeight: 1.35, opacity: appear }}>
                {line}
              </div>
            ) : (
              <div key={i} style={{ height: u(26), width: `${[88, 72, 80, 64][i % 4]}%`, borderRadius: u(13), backgroundColor: style.skeleton, opacity: appear }} />
            );
          })}
        </div>
      );

    case "terminal": {
      // Typed in, line after line, at a steady speed from when the state lands.
      const cps = 38;
      let budget = Math.max(0, (t - 0.25) * cps);
      return (
        <div style={{ position: "absolute", inset: 0, padding: pad, fontFamily: fonts.mono, fontSize: u(style.sizes.mono), lineHeight: 1.5, color: style.terminal.text }}>
          <div style={{ display: "flex", gap: u(10), marginBottom: u(22) }}>
            {[0.9, 0.6, 0.35].map((o, i) => (
              <div key={i} style={{ width: u(16), height: u(16), borderRadius: "50%", backgroundColor: style.terminal.text, opacity: o * 0.4 }} />
            ))}
            {state.title ? <span style={{ marginLeft: u(12), opacity: 0.5, fontSize: u(style.sizes.mono * 0.8) }}>{state.title}</span> : null}
          </div>
          {state.lines.map((line, i) => {
            const shown = Math.min(line.length, Math.floor(budget));
            budget -= line.length;
            if (shown <= 0 && i > 0) return null;
            const prompt = line.startsWith("$ ");
            const text = line.slice(0, shown);
            const typing = shown < line.length || i === state.lines.length - 1;
            return (
              <div key={i} style={{ whiteSpace: "pre-wrap" }}>
                {prompt ? <span style={{ color: style.terminal.prompt }}>{text.slice(0, 2)}</span> : null}
                {prompt ? text.slice(2) : text}
                {typing && Math.floor(t * 2) % 2 === 0 ? <span style={{ opacity: 0.8 }}>▍</span> : null}
              </div>
            );
          })}
        </div>
      );
    }

    case "chart": {
      const max = Math.max(1e-9, ...state.bars.map((b) => b.value));
      return (
        <div style={{ position: "absolute", inset: 0, padding: pad, display: "flex", flexDirection: "column", gap: u(24) }}>
          {state.title ? <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: u(style.sizes.title), color: ink }}>{state.title}</div> : null}
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: u(28) }}>
            {state.bars.map((b, i) => {
              const grow = spring(t - 0.2 - i * 0.1, SPRINGS.morph);
              return (
                <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: u(10) }}>
                  <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: u(style.sizes.body), color: ink, opacity: Math.min(1, grow) }}>{b.value}</span>
                  <div style={{ width: "100%", height: `${Math.max(0, grow) * (b.value / max) * 70}%`, borderRadius: u(14), backgroundColor: i === state.bars.length - 1 ? accent : style.muted }} />
                  <span style={{ fontFamily: fonts.display, fontSize: u(style.sizes.body * 0.85), color: style.muted, whiteSpace: "nowrap" }}>{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case "toast":
      return (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: u(20), padding: `0 ${pad}px` }}>
          <div style={{ width: u(68), height: u(68), borderRadius: "50%", backgroundColor: accent, display: "grid", placeItems: "center", flex: "none", transform: `scale(${0.6 + 0.4 * spring(t - 0.1, [18, 0.6])})` }}>
            <StaticIcon name={state.icon ?? "check"} size={u(40)} colour={style.fill} stroke={5} />
          </div>
          <span style={{ ...label, whiteSpace: "nowrap" }}>{state.text}</span>
        </div>
      );

    case "toggle": {
      const on = spring(t - 0.35, SPRINGS.fast);
      const trackW = u(150);
      const knob = u(64);
      return (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${pad}px` }}>
          <span style={{ ...label, whiteSpace: "nowrap" }}>{state.label}</span>
          <div style={{ position: "relative", width: trackW, height: u(80), borderRadius: u(40), backgroundColor: on > 0.5 ? accent : style.skeleton, flex: "none" }}>
            <div style={{ position: "absolute", top: u(8), left: u(8) + on * (trackW - knob - u(16)), width: knob, height: knob, borderRadius: "50%", backgroundColor: style.fill, boxShadow: style.shadow ? `0 ${u(3)}px ${u(8)}px ${style.shadow.color}` : undefined }} />
          </div>
        </div>
      );
    }

    case "progress": {
      const fillTo = Math.min(1, Math.max(0, state.value)) * Math.min(1.02, spring(t - 0.2, SPRINGS.slow));
      return (
        <div style={{ position: "absolute", inset: 0, padding: `${u(34)}px ${pad}px`, display: "flex", flexDirection: "column", justifyContent: "center", gap: u(18) }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={label}>{state.label}</span>
            <span style={{ ...label, color: style.muted, fontVariantNumeric: "tabular-nums" }}>{Math.round(fillTo * 100)}%</span>
          </div>
          <div style={{ height: u(26), borderRadius: u(13), backgroundColor: style.skeleton, overflow: "hidden" }}>
            <div style={{ width: `${fillTo * 100}%`, height: "100%", borderRadius: u(13), backgroundColor: accent }} />
          </div>
        </div>
      );
    }
  }
};

/** An arrow pointer, constant size on screen, squashing a little when pressed. */
const Cursor: React.FC<{ spec: MorphSpec; t: number; press: number; style: MorphStyle; u: (n: number) => number; frame: { w: number; h: number } }> = ({ spec, t, press, style, u, frame }) => {
  const p = pointerAt(spec.cursor!.path, t);
  const first = Math.min(...spec.cursor!.path.map((k) => k.at));
  const shown = Math.min(1, Math.max(0, (t - first) / 0.15));
  const s = u(style.cursor.size);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      style={{ position: "absolute", left: p.x * frame.w - s * 0.12, top: p.y * frame.h - s * 0.08, opacity: shown, transform: `scale(${1 - 0.13 * press})`, transformOrigin: "12% 8%", overflow: "visible" }}
    >
      <path d="M3 2 L3 19 L7.6 14.6 L10.6 21.4 L13.4 20.2 L10.5 13.5 L17 13.5 Z" fill={style.cursor.fill} stroke={style.cursor.stroke} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
};
