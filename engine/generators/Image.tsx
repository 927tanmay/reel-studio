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
import { Marks } from "../moves/Marks";
import { px } from "../scale";
import { scrollOffset, windowLayout } from "../window";
import { useGeneratorBg, type GenProps } from "./index";

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
  const wantsWindow = Boolean(spec.window) && Boolean(reel.style.window);
  // A window replaces a card: one picture, one frame round it.
  const wantsCard = Boolean(spec.card) && Boolean(style) && !wantsWindow;

  // The picture's own aspect decides the card's or window's height, so it is
  // read before the first frame is drawn.
  const [aspect, setAspect] = useState<number | null>(null);
  const [handle] = useState(() => (wantsCard || wantsWindow ? delayRender(`image size: ${spec.src}`) : null));
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

  if (wantsWindow && aspect !== null) {
    return <WindowedImage spec={spec} reel={reel} aspect={aspect} scale={scale} eased={eased} origin={{ x: push?.x ?? 0.5, y: push?.y ?? 0.5 }} />;
  }

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

/**
 * The picture as a page in a browser window. From the outside in: the window
 * (rounded, shadowed, settling in like the card does), the bar, then a
 * viewport that clips what is below the fold. The push scales the viewport;
 * inside it a layer carries the picture *and its marks* up the page together,
 * so a circle drawn on a headline is still on that headline when the page has
 * scrolled past it. Marks are laid out at the picture's own size, so a region
 * measured on the screenshot is exact.
 */
const WindowedImage: React.FC<{
  spec: ImageSpec;
  reel: GenProps<ImageSpec>["reel"];
  aspect: number;
  scale: number;
  eased: number;
  origin: { x: number; y: number };
}> = ({ spec, reel, aspect, scale, eased, origin }) => {
  const frame = useCurrentFrame();
  const style = reel.style.window!;
  const bg = useGeneratorBg(reel.style.bg);
  const u = (n: number) => px(reel.style, reel.frame, n);
  const over = typeof spec.window === "object" ? spec.window : {};
  const layout = windowLayout(reel.frame, reel.style, aspect, true)!;

  const t = Math.min(1, Math.max(0, frame / Math.max(1, style.enterFrames)));
  const enter = 1 - Math.pow(1 - t, 3);
  const enterScale = style.enterScale + (1 - style.enterScale) * enter;
  const offset = scrollOffset(layout, spec.scroll, eased);

  const { box, viewport, image } = layout;
  const marksSpec = { ...reel, frame: { ...reel.frame, w: image.width, h: image.height } };
  const bar = style.bar;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          boxSizing: "border-box",
          borderRadius: u(style.radius),
          overflow: "hidden",
          opacity: enter,
          transform: `scale(${enterScale})`,
          boxShadow: `0 ${u(style.shadow.y)}px ${u(style.shadow.blur)}px ${style.shadow.color}`,
          backgroundColor: style.page,
        }}
      >
        <div
          style={{
            height: layout.bar,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: u(10),
            padding: `0 ${u(22)}px`,
            backgroundColor: bar.fill,
            borderBottom: bar.divider ? `${Math.max(1, u(2))}px solid ${bar.divider}` : undefined,
          }}
        >
          {bar.dots.map((c, i) => (
            <div key={i} style={{ width: u(bar.dotSize), height: u(bar.dotSize), borderRadius: "50%", backgroundColor: c }} />
          ))}
          <div
            style={{
              flex: 1,
              marginLeft: u(14),
              height: layout.bar * 0.58,
              display: "flex",
              alignItems: "center",
              padding: `0 ${u(18)}px`,
              borderRadius: u(bar.url.radius),
              backgroundColor: bar.url.fill,
              color: bar.url.color,
              fontFamily: reel.style.fonts.mono,
              fontSize: u(bar.url.fontSize),
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {over.url ?? ""}
          </div>
          {over.badge ? (
            <div
              style={{
                width: layout.bar * 0.5,
                height: layout.bar * 0.5,
                borderRadius: u(9),
                backgroundColor: bar.url.color,
                color: bar.fill,
                display: "grid",
                placeItems: "center",
                fontFamily: reel.style.fonts.display,
                fontWeight: 800,
                fontSize: u(22),
              }}
            >
              {over.badge}
            </div>
          ) : null}
        </div>

        <div style={{ position: "relative", width: viewport.width, height: viewport.height, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(${scale})`,
              transformOrigin: `${origin.x * 100}% ${origin.y * 100}%`,
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, width: image.width, height: image.height, transform: `translateY(${-offset}px)` }}>
              <Img src={staticFile(spec.src)} style={{ width: image.width, height: image.height, display: "block" }} />
              {spec.marks?.length ? <Marks spec={marksSpec} marks={spec.marks} /> : null}
            </div>
          </div>
        </div>

        {style.border ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: u(style.radius),
              boxShadow: `inset 0 0 0 ${u(style.border.weight)}px ${style.border.color}`,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
