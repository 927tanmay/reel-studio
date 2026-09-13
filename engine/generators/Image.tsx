import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { GenSpec } from "../spec";
import type { GenProps } from "./index";

type ImageSpec = Extract<GenSpec, { type: "image" }>;

/**
 * A plain still, full-bleed, no emphasis added. Where `callout` always draws
 * a focus box and dims the rest of the frame, this is for when the picture
 * doesn't need help making its point — a freeze-frame closing a reel, a
 * screenshot that's already legible on its own.
 */
export const ImageGen: React.FC<GenProps<ImageSpec>> = ({ spec, reel }) => (
  <AbsoluteFill style={{ backgroundColor: reel.style.bg, overflow: "hidden" }}>
    <Img src={staticFile(spec.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </AbsoluteFill>
);
