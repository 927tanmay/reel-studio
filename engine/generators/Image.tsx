import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getImageDimensions } from "@remotion/media-utils";
import type { GenSpec, Shot } from "../spec";
import { cardBox } from "../card";
import { px } from "../scale";
import type { GenProps } from "./index";

type ImageSpec = Extract<GenSpec, { type: "image" }>;

/**
 * A still. By default full-bleed with no emphasis added: where `callout` always
 * draws a focus box and dims the rest of the frame, this is for when the
 * picture doesn't need help making its point — a freeze-frame closing a reel, a
 * screenshot that's already legible on its own.
 *
 * Two things make a still feel like part of an edit rather than a slide:
 *
 * - `push` moves it slowly across the whole shot, eased in and out, so it is
 *   never completely dead and never jolts.
 * - `card` shows the whole picture at its own aspect as the look's floating
 *   card over a blurred copy of itself, instead of cropping it to fill a
 *   9:16 frame. The push then happens inside the card, clipped by its corners.
 */
export const ImageGen: React.FC<GenProps<ImageSpec>> = ({ spec, reel, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = reel.style.card;
  const wantsCard = Boolean(spec.card) && Boolean(style);

  // The picture's own aspect decides the card's height, so it is read before
  // the first frame is drawn.
  const [aspect, setAspect] = useState<number | null>(null);
  const [handle] = useState(() => (wantsCard ? delayRender(`image size: ${spec.src}`) : null));
  useEffect(() => {
    if (handle === null) return;
    getImageDimensions(staticFile(spec.src))
      .then((d) => setAspect(d.width / d.height))
      .catch(() => setAspect(reel.frame.w / reel.frame.h))
      .finally(() => continueRender(handle));
  }, [handle, spec.src, reel.frame.w, reel.frame.h]);

  const push = spec.push;
  const from = push?.from ?? 1;
  const t = durationInFrames > 1 ? frame / (durationInFrames - 1) : 1;
  const eased = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, t)));
  const scale = push ? from + (push.to - from) * eased : 1;
  const origin = `${(push?.x ?? 0.5) * 100}% ${(push?.y ?? 0.5) * 100}%`;
  const src = staticFile(spec.src);

  if (!wantsCard || !style || aspect === null) {
    return (
      <AbsoluteFill style={{ backgroundColor: reel.style.bg, overflow: "hidden" }}>
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, transformOrigin: origin }}
        />
      </AbsoluteFill>
    );
  }

  const over = typeof spec.card === "object" ? spec.card : {};
  const box = cardBox(reel, { card: Object.keys(over).length ? over : true } as Shot, aspect)!;
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: style.enterFrames });
  const enterScale = interpolate(enter, [0, 1], [style.enterScale, 1]);
  const bg = style.background;

  return (
    <AbsoluteFill style={{ backgroundColor: reel.style.bg, overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bg.scale})`,
          filter: `blur(${px(reel.style, reel.frame, bg.blur)}px) brightness(${1 - bg.dim}) saturate(${bg.saturate})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          boxSizing: "border-box",
          borderRadius: px(reel.style, reel.frame, style.radius),
          overflow: "hidden",
          opacity: enter,
          transform: `scale(${enterScale})`,
          boxShadow: `0 ${px(reel.style, reel.frame, style.shadow.y)}px ${px(reel.style, reel.frame, style.shadow.blur)}px ${style.shadow.color}`,
          ...(style.border
            ? { border: `${px(reel.style, reel.frame, style.border.weight)}px solid ${style.border.color}` }
            : {}),
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            transformOrigin: origin,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
