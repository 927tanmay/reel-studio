import type { Impact } from "./spec";
import type { ImpactStyle } from "./tokens";

/**
 * How strong an impact is `frame` frames into the shot: 1 on its first frame,
 * falling to 0 over its length, and 0 before it starts. A squared ease-out, so
 * it hits hard and then trails — a linear fall reads as a fade, not a blow.
 */
export const impactEnvelope = (frame: number, startFrame: number, frames: number): number => {
  const local = frame - startFrame;
  if (local < 0 || local >= frames) return 0;
  const t = 1 - local / frames;
  return t * t;
};

/** Deterministic noise in -1..1 — the same on every frame, render and worker. */
export const noise = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/** Frames an impact lasts: the shot's own override, else the look's for that kind. */
export const impactFrames = (impact: Impact, style: ImpactStyle): number =>
  impact.frames ?? style[impact.kind].frames;

export type ImpactState = {
  /** Picture translation in design-width-relative pixels (already scaled by `pxScale`), and tilt. */
  shake: { x: number; y: number; rotate: number; cover: number } | null;
  /** 0..peak opacity and its colour. */
  flash: { opacity: number; color: string } | null;
  /** Filter parameters in output pixels, and a per-frame seed for the tear. */
  glitch: { slice: number; split: number; seed: number } | null;
};

/**
 * Everything the impacts do to the picture at one frame, summed: overlapping
 * shakes add, the strongest flash wins, the strongest glitch wins. `pxScale`
 * turns the look's design pixels into this frame's pixels.
 */
export const impactState = (
  frame: number,
  fps: number,
  impacts: Impact[],
  style: ImpactStyle,
  pxScale: number,
  resolveColour: (c: string) => string,
): ImpactState => {
  let sx = 0;
  let sy = 0;
  let sr = 0;
  let cover = 0;
  let shaken = false;
  let flash: ImpactState["flash"] = null;
  let glitch: ImpactState["glitch"] = null;

  impacts.forEach((impact, index) => {
    const start = Math.round((impact.at ?? 0) * fps);
    const frames = impactFrames(impact, style);
    const env = impactEnvelope(frame, start, frames);
    if (env <= 0) return;
    const k = impact.strength ?? 1;
    const local = frame - start;

    if (impact.kind === "shake") {
      const a = style.shake.amount * pxScale * k * env;
      // Different seeds per axis so x and y don't move in lockstep, which reads
      // as a diagonal wobble rather than a hit.
      sx += noise(local * 2 + index * 17 + 1) * a;
      sy += noise(local * 2 + index * 17 + 2) * a;
      sr += noise(local * 2 + index * 17 + 3) * style.shake.rotation * k * env;
      cover += a;
      shaken = true;
    } else if (impact.kind === "flash") {
      const opacity = Math.min(1, style.flash.peak * k) * env;
      if (!flash || opacity > flash.opacity) flash = { opacity, color: resolveColour(style.flash.color) };
    } else {
      // A tear that flickers: every other frame is a little weaker, so it
      // stutters instead of sliding smoothly, which is what makes it a glitch.
      const flicker = 0.55 + 0.45 * Math.abs(noise(local * 3.1 + index));
      const slice = style.glitch.slice * pxScale * k * env * flicker;
      if (!glitch || slice > glitch.slice) {
        glitch = {
          slice,
          split: style.glitch.split * pxScale * k * env * flicker,
          seed: 1 + local + index * 13,
        };
      }
    }
  });

  return {
    shake: shaken ? { x: sx, y: sy, rotate: sr, cover } : null,
    flash,
    glitch,
  };
};
