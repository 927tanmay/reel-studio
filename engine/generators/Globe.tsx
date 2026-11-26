import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import { resolveColour } from "../backdrop";
import { arcPoints, distanceFor, fibonacciSphere, globeFacing, latLon, progress, project, rotate, type Vec3 } from "../three";
import { spring } from "../spring";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type GlobeSpec = Extract<GenSpec, { type: "globe" }>;

const FOV = 30;
const ARC_SEGMENTS = 64;

/**
 * A dotted globe in real 3D. The surface is a Fibonacci lattice of dots over a
 * dim core that hides most of the far side; places pulse on their words; arcs
 * draw themselves along a lifted great circle with a dot at the head. All of it
 * is a function of the frame: the canvas holds no state between frames.
 */
export const Globe: React.FC<GenProps<GlobeSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const style = tokens.three?.globe;
  const { w, h } = reel.frame;
  const dots = useMemo(() => fibonacciSphere(style?.dots ?? 0), [style?.dots]);
  if (!style) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const t = frame / fps;
  const colour = (c: string) => resolveColour(c, tokens.palette, accent);
  const aspect = w / h;
  const distance = distanceFor(2, style.size, FOV, aspect);
  const facing = globeFacing(t, spec.focus ?? [], style.spin, style.tilt);
  const points = new Map((spec.points ?? []).map((p) => [p.id, p]));
  const offsetY = (style.top - 0.5) * h;

  // The globe pops in over its first half-second rather than being there on frame 0.
  const intro = 0.7 + 0.3 * spring(t, [9, 0.8]);
  const shown = Math.min(1, t / 0.25);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {style.glow ? (
        <div
          style={{
            position: "absolute",
            left: w / 2 - (style.size * w * 0.9),
            top: style.top * h - (style.size * w * 0.9),
            width: style.size * w * 1.8,
            height: style.size * w * 1.8,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colour(style.glow)} 0%, transparent 62%)`,
            opacity: shown,
          }}
        />
      ) : null}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${offsetY}px)`, opacity: shown }}>
        <ThreeCanvas width={w} height={h} camera={{ fov: FOV, position: [0, 0, distance], near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
          <group rotation={[facing.x, facing.y, 0]} scale={intro}>
            <mesh>
              <sphereGeometry args={[0.985, 64, 48]} />
              <meshBasicMaterial color={colour(style.core)} transparent opacity={style.coreOpacity} />
            </mesh>
            <Dots dots={dots} radius={style.dotSize} colour={colour(style.dot)} />
            {(spec.points ?? []).map((p) => {
              const lit = p.at === undefined ? 1 : spring(t - p.at, [14, 0.6]);
              if (lit <= 0) return null;
              const pos = latLon(p.lat, p.lon, 1.005);
              const ring = p.at === undefined ? 0 : Math.max(0, Math.min(1, (t - p.at) / 0.8));
              return (
                <group key={p.id} position={pos} quaternion={facingQuat(pos)}>
                  <mesh scale={lit}>
                    <circleGeometry args={[0.028, 24]} />
                    <meshBasicMaterial color={colour(p.tone ?? style.point)} />
                  </mesh>
                  {ring > 0 && ring < 1 ? (
                    <mesh scale={0.6 + 2.4 * ring}>
                      <ringGeometry args={[0.03, 0.038, 32]} />
                      <meshBasicMaterial color={colour(p.tone ?? style.point)} transparent opacity={1 - ring} />
                    </mesh>
                  ) : null}
                </group>
              );
            })}
            {(spec.arcs ?? []).map((a, i) => {
              const from = points.get(a.from);
              const to = points.get(a.to);
              if (!from || !to) return null; // verify.ts says which.
              const drawn = progress(t, a.at, a.seconds ?? 1.2);
              if (drawn <= 0) return null;
              return (
                <Arc
                  key={i}
                  from={latLon(from.lat, from.lon)}
                  to={latLon(to.lat, to.lon)}
                  drawn={drawn}
                  width={style.arcWidth}
                  colour={colour(a.tone ?? style.arc)}
                />
              );
            })}
          </group>
        </ThreeCanvas>
      </div>
      {(spec.points ?? []).map((p) => {
        if (!p.label) return null;
        const lit = p.at === undefined ? 1 : Math.min(1, Math.max(0, (t - p.at) / 0.25));
        // Where the place is now, after the globe's turn and pop: a label only
        // shows on the near side, fading as it rounds the edge.
        const world = rotate(latLon(p.lat, p.lon, 1.06 * intro), facing.x, facing.y);
        const near = Math.min(1, Math.max(0, world[2] / 0.35));
        const at = project(world, distance, FOV, aspect);
        if (lit * near <= 0) return null;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: at.x * w + px(tokens, reel.frame, 26),
              top: at.y * h + offsetY,
              transform: "translateY(-50%)",
              fontFamily: style.label.mono ? tokens.fonts.mono : tokens.fonts.display,
              fontWeight: style.label.weight ?? 700,
              fontSize: px(tokens, reel.frame, style.label.size),
              color: colour(style.label.color),
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              opacity: lit * near * shown,
            }}
          >
            {p.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** A rotation that turns a flat disc at `pos` on the unit sphere to face outward. */
const facingQuat = (pos: Vec3) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...pos).normalize());

/** The surface dots as one instanced mesh: a few thousand spheres, one draw call. */
const Dots: React.FC<{ dots: Vec3[]; radius: number; colour: string }> = ({ dots, radius, colour }) => {
  const mesh = useMemo(() => {
    const geometry = new THREE.SphereGeometry(radius, 6, 4);
    const material = new THREE.MeshBasicMaterial({ color: colour });
    const m = new THREE.InstancedMesh(geometry, material, dots.length);
    const matrix = new THREE.Matrix4();
    dots.forEach((d, i) => m.setMatrixAt(i, matrix.makeTranslation(d[0], d[1], d[2])));
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [dots, radius, colour]);
  return <primitive object={mesh} />;
};

/** An arc drawn on to `drawn` (0..1), as a tube, with a bright dot riding its head until it lands. */
const Arc: React.FC<{ from: Vec3; to: Vec3; drawn: number; width: number; colour: string }> = ({ from, to, drawn, width, colour }) => {
  const all = useMemo(() => arcPoints(from, to, ARC_SEGMENTS + 1), [from, to]);
  const upto = Math.max(2, Math.round(drawn * ARC_SEGMENTS) + 1);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(all.slice(0, upto).map((p) => new THREE.Vector3(...p))), [all, upto]);
  const head = all[upto - 1];
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, Math.max(2, upto * 2), width, 8, false]} />
        <meshBasicMaterial color={colour} transparent opacity={0.9} />
      </mesh>
      {drawn < 1 ? (
        <mesh position={head}>
          <sphereGeometry args={[width * 2.6, 16, 12]} />
          <meshBasicMaterial color={colour} />
        </mesh>
      ) : null}
    </group>
  );
};
