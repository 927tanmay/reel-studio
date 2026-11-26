import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useLoader } from "@react-three/fiber";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import * as THREE from "three";
import type { GenSpec } from "../spec";
import { px } from "../scale";
import { resolveColour } from "../backdrop";
import { ICONS, segmentProgress, type IconName } from "../icons";
import { deviceAngles, distanceFor, polylinePrefix } from "../three";
import { spring } from "../spring";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type ExtrudeSpec = Extract<GenSpec, { type: "extrude" }>;

const FOV = 30;
/** World width the mark is fitted to; the camera distance makes that the look's `size`. */
const WIDTH = 2;

/**
 * A mark in real 3D. A built-in icon becomes glowing tubes along its strokes,
 * drawn on in the icon's own order; a filled SVG (a logo) is extruded with a
 * bevel and keeps its own colours. Either turns in from the look's angle and
 * comes to face the camera on its word, then sways a little so it stays alive.
 */
export const Extrude: React.FC<GenProps<ExtrudeSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const style = tokens.three?.extrude;
  if (!style) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const { w, h } = reel.frame;
  const t = frame / fps;
  const at = spec.at ?? 0.3;
  const colour = (c: string) => resolveColour(c, tokens.palette, accent);
  const distance = distanceFor(WIDTH, style.size, FOV, w / h);
  const angles = deviceAngles(t, style.from, [{ at, x: 0, y: 0 }]);
  const settled = spring(t - at, [6, 1]);
  const sway = settled * 0.06 * Math.sin((t - at) * 1.3);
  const pop = 0.6 + 0.4 * spring(t, [10, 0.75]);
  const label = Math.min(1, Math.max(0, (t - at - 0.2) / 0.3));
  const markHalf = (style.size * w) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {style.glow ? (
        <div
          style={{
            position: "absolute",
            left: w / 2 - markHalf * 1.6,
            top: style.top * h - markHalf * 1.6,
            width: markHalf * 3.2,
            height: markHalf * 3.2,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colour(style.glow)} 0%, transparent 62%)`,
            opacity: Math.min(1, t / 0.3),
          }}
        />
      ) : null}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(style.top - 0.5) * h}px)` }}>
        <ThreeCanvas width={w} height={h} camera={{ fov: FOV, position: [0, 0, distance], near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[-3, 4, 5]} intensity={1.8} />
          <directionalLight position={[4, -2, 2]} intensity={0.7} />
          <group rotation={[angles.x, angles.y + sway, 0]} scale={pop}>
            {spec.svg ? (
              <SvgMark src={spec.svg} depth={style.depth} metalness={style.metalness} roughness={style.roughness} />
            ) : spec.icon ? (
              <IconMark
                name={spec.icon as IconName}
                drawn={Math.min(1, Math.max(0, t / Math.max(0.3, at)))}
                tube={style.tube}
                colour={colour(style.color)}
                metalness={style.metalness}
                roughness={style.roughness}
              />
            ) : null}
          </group>
        </ThreeCanvas>
      </div>
      {spec.label ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: style.top * h + markHalf * 1.15,
            textAlign: "center",
            fontFamily: style.label.mono ? tokens.fonts.mono : tokens.fonts.display,
            fontWeight: style.label.weight ?? 800,
            fontSize: px(tokens, reel.frame, style.label.size),
            color: colour(style.label.color),
            opacity: label,
            transform: `translateY(${(1 - label) * px(tokens, reel.frame, 16)}px)`,
          }}
        >
          {spec.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** An icon's strokes as tubes, each drawn on in its own window of `drawn`, with round caps. */
const IconMark: React.FC<{ name: IconName; drawn: number; tube: number; colour: string; metalness: number; roughness: number }> = ({
  name,
  drawn,
  tube,
  colour,
  metalness,
  roughness,
}) => {
  // Each segment's path, sampled to points once, in world units: the 48-unit
  // grid centred and fitted to WIDTH, y up.
  const strokes = useMemo(() => {
    const k = WIDTH / 48;
    const loader = new SVGLoader();
    return (ICONS[name] ?? []).map((seg) => {
      if (seg.dot) return { seg, points: [] as [number, number, number][] };
      const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="${seg.d}"/></svg>`);
      const points = data.paths.flatMap((p) =>
        p.subPaths.flatMap((sp) => sp.getPoints(16).map((v) => [(v.x - 24) * k, (24 - v.y) * k, 0] as [number, number, number])),
      );
      return { seg, points };
    });
  }, [name]);
  const radius = (tube * WIDTH) / 48;
  const material = <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.45} metalness={metalness} roughness={roughness} />;
  return (
    <group>
      {strokes.map(({ seg, points }, i) => {
        const p = segmentProgress(drawn, seg);
        if (p <= 0) return null;
        if (seg.dot) {
          const k = WIDTH / 48;
          return (
            <mesh key={i} position={[(seg.dot.cx - 24) * k, (24 - seg.dot.cy) * k, 0]} scale={p}>
              <sphereGeometry args={[Math.max(radius * 1.2, seg.dot.r * k), 24, 16]} />
              {material}
            </mesh>
          );
        }
        const part = polylinePrefix(points, p);
        if (part.length < 2) return null;
        const path = new THREE.CurvePath<THREE.Vector3>();
        for (let j = 1; j < part.length; j++) path.add(new THREE.LineCurve3(new THREE.Vector3(...part[j - 1]), new THREE.Vector3(...part[j])));
        return (
          <group key={i}>
            <mesh>
              <tubeGeometry args={[path, Math.max(8, part.length * 4), radius, 12, false]} />
              {material}
            </mesh>
            {[part[0], part[part.length - 1]].map((c, j) => (
              <mesh key={j} position={c}>
                <sphereGeometry args={[radius, 16, 12]} />
                {material}
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

/** A filled SVG extruded with a bevel, centred and fitted to WIDTH, keeping its own fill colours. */
const SvgMark: React.FC<{ src: string; depth: number; metalness: number; roughness: number }> = ({ src, depth, metalness, roughness }) => {
  const data = useLoader(SVGLoader, staticFile(src));
  const parts = useMemo(() => {
    // Each path is a layer in paint order; a later one sits a little in front,
    // so shapes drawn over others (a dot on a tile) never fight for the same depth.
    const shapes = data.paths.flatMap((p, layer) => SVGLoader.createShapes(p).map((s) => ({ shape: s, colour: p.color, layer })));
    const box = new THREE.Box2();
    for (const { shape } of shapes) for (const v of shape.getPoints(8)) box.expandByPoint(v);
    const size = box.getSize(new THREE.Vector2());
    const centre = box.getCenter(new THREE.Vector2());
    const k = WIDTH / Math.max(size.x, size.y * 0.8, 1e-6);
    const d = (depth * WIDTH) / k;
    return {
      k,
      centre,
      geometries: shapes.map(({ shape, colour, layer }) => ({
        geometry: new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: d * 0.12, bevelSize: d * 0.08, bevelSegments: 3, curveSegments: 16 }),
        colour,
        d,
        z: layer * d * 0.12,
      })),
    };
  }, [data, depth]);
  return (
    // SVG y runs down; flipping it turns the faces inside out, so draw both sides.
    <group scale={[parts.k, -parts.k, parts.k]}>
      {parts.geometries.map(({ geometry, colour, d, z }, i) => (
        <mesh key={i} geometry={geometry} position={[-parts.centre.x, -parts.centre.y, -d / 2 + z]}>
          <meshStandardMaterial color={colour} metalness={metalness} roughness={roughness} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};
