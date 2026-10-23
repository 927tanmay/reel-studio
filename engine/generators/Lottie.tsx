import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import type { GenSpec } from "../spec";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type LottieSpec = Extract<GenSpec, { type: "lottie" }>;

const cache = new Map<string, Promise<LottieAnimationData>>();

const load = (path: string): Promise<LottieAnimationData> => {
  const cached = cache.get(path);
  if (cached) return cached;
  const work = fetch(staticFile(path)).then((r) => {
    if (!r.ok) throw new Error(`Could not load Lottie "${path}" (${r.status})`);
    return r.json() as Promise<LottieAnimationData>;
  });
  cache.set(path, work);
  return work;
};

/**
 * A Lottie file's data, or null until it has loaded. Holds the render until it
 * has, like fonts, and releases it even on failure — a missing file renders as
 * nothing rather than hanging the whole render.
 */
export const useLottieData = (path: string): LottieAnimationData | null => {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`Loading Lottie ${path}`));

  useEffect(() => {
    let live = true;
    load(path)
      .then((d) => {
        if (!live) return;
        setData(d);
        continueRender(handle);
      })
      .catch((error) => {
        console.error(error);
        if (live) continueRender(handle);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return data;
};

/** A Lottie sized to a box. Time comes from the surrounding Sequence's frame. */
export const LottieIcon: React.FC<{ path: string; width: number; height: number; loop?: boolean }> = ({
  path,
  width,
  height,
  loop = false,
}) => {
  const data = useLottieData(path);
  if (!data) return <div style={{ width, height }} />;
  return <Lottie animationData={data} loop={loop} style={{ width, height }} />;
};

/** An imported animation, centred in the frame at the look's size. */
export const LottieGen: React.FC<GenProps<LottieSpec>> = ({ spec, reel }) => {
  const style = reel.style.lottie;
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  if (!style) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.

  const width = style.size * reel.frame.w;
  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <div
        style={{
          position: "absolute",
          left: (reel.frame.w - width) / 2,
          top: style.top * reel.frame.h - width / 2,
          width,
          height: width,
        }}
      >
        <LottieIcon path={spec.src} width={width} height={width} loop={spec.loop !== false} />
      </div>
    </AbsoluteFill>
  );
};
