import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useLoader } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import * as THREE from "three";
import type { GenSpec } from "../spec";
import { resolveColour } from "../backdrop";
import { deviceAngles, distanceFor, progress, screenCover } from "../three";
import { spring } from "../spring";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type DeviceSpec = Extract<GenSpec, { type: "device" }>;

const FOV = 30;

/** World sizes: a phone 1 unit wide, a laptop 1.6. The screen sits inside a bezel. */
const PHONE = { w: 1, h: 2.06, d: 0.085, r: 0.13, screen: { w: 0.92, h: 1.98, r: 0.095 } };
const LAPTOP = { w: 1.6, lid: { h: 1.04, d: 0.035 }, base: { h: 0.05, d: 1.08 }, screen: { w: 1.5, h: 0.94, r: 0.02 } };

/**
 * A phone or a laptop in real 3D with a picture on its screen. It rises in,
 * swings flat from the look's angle (or turns on cue), and the screen can
 * scroll a tall picture; a laptop's lid opens as it arrives. Lit for its body;
 * the screen is unlit, so the picture keeps its own colours.
 */
export const Device: React.FC<GenProps<DeviceSpec>> = ({ spec, reel, durationInFrames, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const style = tokens.three?.device;
  if (!style) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const { w, h } = reel.frame;
  const t = frame / fps;
  const colour = (c: string) => resolveColour(c, tokens.palette, accent);
  const laptop = spec.kind === "laptop";
  const width = laptop ? LAPTOP.w : PHONE.w;
  const distance = distanceFor(width, style.size, FOV, w / h);
  const angles = deviceAngles(t, style.from, spec.turns ?? []);
  const rise = spring(t, [8, 0.9]);
  const scroll = spec.scroll ? progress(t, 0.6, Math.max(0.5, durationInFrames / fps - 1.2)) : 0;
  const scrollAt = spec.scroll ? (spec.scroll.from ?? 0) + ((spec.scroll.to ?? 1) - (spec.scroll.from ?? 0)) * scroll : 0;
  const lid = laptop ? spring(t - 0.15, [7, 0.85]) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {style.shadow ? (
        <div
          style={{
            position: "absolute",
            left: w / 2 - style.size * w * 0.55,
            top: style.top * h + (laptop ? 0.17 : 0.6) * style.size * w,
            width: style.size * w * 1.1,
            height: style.size * w * 0.16,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, ${style.shadow} 0%, transparent 70%)`,
            opacity: rise,
          }}
        />
      ) : null}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(style.top - 0.5) * h}px)`, opacity: Math.min(1, t / 0.2) }}>
        <ThreeCanvas width={w} height={h} camera={{ fov: FOV, position: [0, 0, distance], near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[-2, 3, 4]} intensity={1.6} />
          <directionalLight position={[3, -1, -2]} intensity={0.6} />
          <group position={[0, -0.35 * (1 - rise), 0]} rotation={[angles.x, angles.y, 0]}>
            {laptop ? (
              <Laptop src={spec.src} body={colour(style.body)} edge={colour(style.edge)} open={lid} scroll={scrollAt} />
            ) : (
              <Phone src={spec.src} body={colour(style.body)} edge={colour(style.edge)} scroll={scrollAt} />
            )}
          </group>
        </ThreeCanvas>
      </div>
    </AbsoluteFill>
  );
};

/** A rounded rectangle in the xy plane whose texture coordinates run 0..1 across it. */
const roundedScreen = (sw: number, sh: number, r: number) => {
  const s = new THREE.Shape();
  const x = -sw / 2;
  const y = -sh / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + sw - r, y);
  s.quadraticCurveTo(x + sw, y, x + sw, y + r);
  s.lineTo(x + sw, y + sh - r);
  s.quadraticCurveTo(x + sw, y + sh, x + sw - r, y + sh);
  s.lineTo(x + r, y + sh);
  s.quadraticCurveTo(x, y + sh, x, y + sh - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 12);
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - x) / sw;
    uv[i * 2 + 1] = (pos.getY(i) - y) / sh;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};

/** The picture on a screen, covering it and scrolled `scroll` of the way down. */
const Screen: React.FC<{ src: string; sw: number; sh: number; r: number; z: number; scroll: number }> = ({ src, sw, sh, r, z, scroll }) => {
  const loaded = useLoader(THREE.TextureLoader, staticFile(src));
  const texture = useMemo(() => {
    const tex = loaded.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, [loaded]);
  const image = texture.image as { width: number; height: number };
  const cover = screenCover(image.width / image.height, sw / sh, scroll);
  texture.repeat.set(...cover.repeat);
  texture.offset.set(...cover.offset);
  const geometry = useMemo(() => roundedScreen(sw, sh, r), [sw, sh, r]);
  return (
    <mesh geometry={geometry} position={[0, 0, z]}>
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

const Phone: React.FC<{ src: string; body: string; edge: string; scroll: number }> = ({ src, body, edge, scroll }) => {
  const shell = useMemo(() => new RoundedBoxGeometry(PHONE.w, PHONE.h, PHONE.d, 6, PHONE.r), []);
  const rim = useMemo(() => new RoundedBoxGeometry(PHONE.w + 0.012, PHONE.h + 0.012, PHONE.d * 0.6, 6, PHONE.r + 0.006), []);
  return (
    <group>
      <mesh geometry={rim}>
        <meshStandardMaterial color={edge} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh geometry={shell}>
        <meshStandardMaterial color={body} metalness={0.2} roughness={0.55} />
      </mesh>
      <Screen src={src} sw={PHONE.screen.w} sh={PHONE.screen.h} r={PHONE.screen.r} z={PHONE.d / 2 + 0.002} scroll={scroll} />
    </group>
  );
};

const Laptop: React.FC<{ src: string; body: string; edge: string; open: number; scroll: number }> = ({ src, body, edge, open, scroll }) => {
  const { w, lid, base, screen } = LAPTOP;
  const lidBox = useMemo(() => new RoundedBoxGeometry(w, lid.h, lid.d, 4, 0.03), [w, lid.h, lid.d]);
  const baseBox = useMemo(() => new RoundedBoxGeometry(w, base.h, base.d, 4, 0.025), [w, base.h, base.d]);
  // The lid hinges on the base's back edge: lying shut over the base (a quarter
  // turn forward) at 0, a little past upright at 1.
  const lidTurn = (1 - open) * (Math.PI / 2) - open * 0.17;
  const hingeY = -lid.h / 2 + 0.06;
  return (
    <group position={[0, -0.12, 0]}>
      <mesh geometry={baseBox} position={[0, hingeY - base.h / 2, base.d / 2 - 0.02]}>
        <meshStandardMaterial color={edge} metalness={0.7} roughness={0.35} />
      </mesh>
      <group position={[0, hingeY, 0]} rotation={[lidTurn, 0, 0]}>
        <mesh geometry={lidBox} position={[0, lid.h / 2, 0]}>
          <meshStandardMaterial color={body} metalness={0.3} roughness={0.5} />
        </mesh>
        <group position={[0, lid.h / 2, lid.d / 2 + 0.002]}>
          <Screen src={src} sw={screen.w} sh={screen.h} r={screen.r} z={0} scroll={scroll} />
        </group>
      </group>
    </group>
  );
};
