import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type OrbSpec = Extract<GenSpec, { type: "orb" }>;

const TAU = Math.PI * 2;

/** A seeded PRNG, so the same orb is the same on every frame and every worker. */
const rng = (seed: number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Vec = [number, number, number];
type Dot = { x: number; y: number; depth: number; boost?: number };

const rotateY = ([x, y, z]: Vec, a: number): Vec => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotateX = ([x, y, z]: Vec, a: number): Vec => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];

/**
 * 0..1 — how much someone is speaking right now, as a smooth pulse rather
 * than a switch: it is 1 inside a word and falls away over `tailMs` either
 * side, so the orb breathes with the voice instead of flickering on every gap
 * between syllables. A pure function of time, like everything else here.
 */
const speechEnergy = (words: { startMs: number; endMs: number }[], ms: number, tailMs: number): number => {
  let best = 0;
  for (const w of words) {
    const distance = ms < w.startMs ? w.startMs - ms : ms > w.endMs ? ms - w.endMs : 0;
    if (distance < tailMs) best = Math.max(best, 1 - distance / tailMs);
  }
  return best;
};

/**
 * A dotted "thinking" orb: a handful of states, each a few hundred dots drawn
 * as a pure function of the frame. Inspired by the dotted thought-orb loaders
 * used in AI interfaces; the maths here is our own.
 *
 * It exists for the line that says an AI is working, searching or listening
 * and has nothing real to show — and, because it can read the words spoken
 * under it, it can move *with* that voice, which a stock loop cannot.
 */
export const Orb: React.FC<GenProps<OrbSpec>> = ({ spec, reel, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const style = tokens.orb;
  if (!style) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const color = tokens.palette[style.color] ?? style.color;
  const t = frame / fps;
  const w = reel.frame.w;
  const h = reel.frame.h;
  const R = (style.size * w) / 2;
  const cx = w / 2;
  const cy = style.top * h;
  const dotR = px(tokens, reel.frame, style.dot);
  const count = (n: number) => Math.max(4, Math.round(n * style.density));
  const spin = t * style.spin * TAU;

  // 0..1; stays at 1 when the orb doesn't follow speech, so every state reads
  // identically with it off.
  const energy =
    spec.reactToSpeech && words && words.length > 0 ? 0.25 + 0.75 * speechEnergy(words, t * 1000, 140) : 1;
  const breathe = 1 + 0.05 * energy * (spec.reactToSpeech ? 1 : 0);

  const dots: Dot[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number; a: number }[] = [];

  /** Perspective: nearer dots are larger and brighter. */
  const place = (p: Vec, boost = 0): Dot => {
    const scale = 1 + p[2] * 0.22;
    return { x: cx + p[0] * R * scale * breathe, y: cy + p[1] * R * scale * breathe, depth: (p[2] + 1) / 2, boost };
  };

  switch (spec.state) {
    case "working": {
      // Particles on tilted orbits: three rings, each at its own tilt and
      // speed, so the paths cross and the whole reads as something in motion.
      const rings = 3;
      for (let k = 0; k < rings; k++) {
        const n = count(34);
        const tilt = (k / rings) * Math.PI * 0.9 + 0.35;
        const yaw = (k / rings) * TAU * 0.5;
        const speed = (k % 2 === 0 ? 1 : -1) * (0.6 + 0.25 * k);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + spin * speed;
          let p: Vec = [Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0];
          p = rotateX(p, tilt);
          p = rotateY(p, yaw + spin * 0.15);
          dots.push(place(p, i === 0 ? 1 : 0));
        }
      }
      for (let i = 0; i < count(10); i++) {
        const a = (i / count(10)) * TAU + spin * 0.4;
        dots.push(place([Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0]));
      }
      break;
    }

    case "searching": {
      // A dotted sphere with a bright meridian sweeping round it.
      const n = count(240);
      const golden = Math.PI * (3 - Math.sqrt(5));
      const sweep = (spin * 1.6) % TAU;
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const lon = i * golden;
        let p: Vec = [Math.cos(lon) * r, y, Math.sin(lon) * r];
        p = rotateY(p, spin * 0.3);
        p = rotateX(p, 0.35);
        // Angular distance (in longitude) from the sweeping plane, 0..π.
        const d = Math.abs(((lon - sweep + Math.PI * 3) % TAU) - Math.PI);
        dots.push(place(p, Math.max(0, 1 - d / 0.5)));
      }
      break;
    }

    case "listening": {
      // Concentric rings of dots, each pushed in and out like a waveform.
      const rings = 6;
      for (let k = 0; k < rings; k++) {
        const radius = (k + 1) / rings;
        const n = count(10 + k * 9);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const wave = Math.sin(a * 3 + t * 3.2 - k * 0.7) * 0.5 + Math.sin(a * 5 - t * 2.1 + k) * 0.5;
          const r = radius + wave * 0.07 * energy;
          dots.push(place([Math.cos(a) * r, Math.sin(a) * r, 0], Math.max(0, wave) * 0.6));
        }
      }
      break;
    }

    case "connecting": {
      // A constellation that wires itself together, then holds, then starts over.
      const random = rng(1337);
      const n = count(20);
      const nodes: Vec[] = [];
      for (let i = 0; i < n; i++) {
        const a = random() * TAU;
        const r = Math.sqrt(random()) * 0.92;
        nodes.push([Math.cos(a) * r, Math.sin(a) * r, (random() - 0.5) * 0.8]);
      }
      const turned = nodes.map((p) => rotateY(p, spin * 0.25));
      const edges: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        let nearest = -1;
        let best = Infinity;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1], nodes[i][2] - nodes[j][2]);
          if (d < best) {
            best = d;
            nearest = j;
          }
        }
        if (nearest > i || !edges.some(([a, b]) => a === nearest && b === i)) edges.push([i, nearest]);
      }
      const period = 6;
      const progress = Math.min(1, ((t % period) / period) * 1.25);
      const shown = Math.floor(progress * edges.length);
      const fade = (t % period) / period > 0.9 ? 1 - ((t % period) / period - 0.9) / 0.1 : 1;
      turned.forEach((p, i) => dots.push(place(p, i < shown ? 0.7 : 0)));
      edges.slice(0, shown).forEach(([a, b]) => {
        const pa = place(turned[a]);
        const pb = place(turned[b]);
        lines.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, a: 0.5 * fade });
      });
      break;
    }

    case "breathing": {
      // One ring that swells and settles; an inner ring a half-beat behind.
      for (let k = 0; k < 2; k++) {
        const n = count(48 - k * 14);
        const phase = Math.sin(t * 1.6 - k * 1.1) * 0.5 + 0.5;
        const radius = (k === 0 ? 0.62 : 0.34) + phase * (k === 0 ? 0.3 : 0.18);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + spin * (k === 0 ? 0.2 : -0.3);
          dots.push(place([Math.cos(a) * radius, Math.sin(a) * radius, 0], phase * 0.5));
        }
      }
      break;
    }
  }

  // Far dots first, so the near ones sit on top of them.
  dots.sort((a, b) => a.depth - b.depth);

  const glow = style.glow;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      {glow > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${cx}px ${cy}px, ${color} 0%, rgba(0,0,0,0) ${R * 1.5}px)`,
            opacity: glow * 0.18 * energy,
          }}
        />
      ) : null}
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        {lines.map((l, i) => (
          <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={color} strokeWidth={dotR * 0.5} opacity={l.a} />
        ))}
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={dotR * (0.55 + 0.75 * d.depth + 0.9 * (d.boost ?? 0))}
            fill={color}
            opacity={Math.min(1, (0.25 + 0.6 * d.depth + 0.5 * (d.boost ?? 0)) * (0.7 + 0.3 * energy))}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
