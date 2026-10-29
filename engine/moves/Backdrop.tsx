import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { ReelSpec } from "../spec";
import { blobCentre, resolveColour } from "../backdrop";
import { px } from "../scale";

/**
 * Soft glows drifting behind a generated clip. Each is a radial gradient that
 * fades to nothing, placed from the look and nudged by a slow wander, so the
 * flat background gets depth without anything competing with the content.
 *
 * `frameOffset` is where this shot starts in the reel: the drift runs on reel
 * time, not shot time, so shots of one section share one continuous glow
 * instead of each cut snapping the blobs back to their starting points.
 */
export const Backdrop: React.FC<{ spec: ReelSpec; accent?: string; frameOffset: number }> = ({
  spec,
  accent,
  frameOffset,
}) => {
  const frame = useCurrentFrame();
  const style = spec.style.backdrop;
  if (!style) return null; // verify.ts says why.

  const { w, h, fps } = spec.frame;
  const t = (frame + frameOffset) / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: spec.style.bg, overflow: "hidden" }}>
      {style.blobs.map((blob, i) => {
        const centre = blobCentre(blob, i, t, style.speed);
        const radius = blob.size * w;
        const colour = resolveColour(blob.color, spec.style.palette, accent);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: centre.x * w - radius,
              top: centre.y * h - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colour} 0%, transparent 68%)`,
              opacity: blob.opacity,
            }}
          />
        );
      })}
      {style.grid ? (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(circle, ${style.grid.color} ${px(spec.style, spec.frame, style.grid.dot)}px, transparent ${px(spec.style, spec.frame, style.grid.dot) + 1}px)`,
            backgroundSize: `${px(spec.style, spec.frame, style.grid.size)}px ${px(spec.style, spec.frame, style.grid.size)}px`,
            backgroundPosition: "center",
            opacity: style.grid.opacity,
            WebkitMaskImage: `radial-gradient(ellipse at center, black ${style.grid.fade * 100}%, transparent 100%)`,
            maskImage: `radial-gradient(ellipse at center, black ${style.grid.fade * 100}%, transparent 100%)`,
          }}
        />
      ) : null}
      {style.vignette ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 45%, ${spec.style.bg} 135%)`,
            opacity: style.vignette,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
