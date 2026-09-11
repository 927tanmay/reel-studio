import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { ReelSpec } from "./spec";
import { resolveTimeline, shotLabel } from "./spec";
import { ShotView } from "./ShotView";
import { Bed } from "./moves/Bed";
import { Hits } from "./moves/Hits";
import { useFonts } from "./fonts";

export const Reel: React.FC<{ spec: ReelSpec }> = ({ spec }) => {
  useFonts(spec.style);
  const timeline = resolveTimeline(spec);

  return (
    <AbsoluteFill style={{ backgroundColor: spec.style.bg }}>
      {timeline.shots.map((resolved) => (
        <Sequence
          key={resolved.key}
          from={resolved.startFrame}
          durationInFrames={resolved.durationInFrames}
          name={`${resolved.index}. ${shotLabel(resolved.shot)}`}
        >
          <ShotView resolved={resolved} spec={spec} />
        </Sequence>
      ))}

      <Hits spec={spec} hits={timeline.hits} />
      {spec.bed ? <Bed spec={spec} timeline={timeline} /> : null}
    </AbsoluteFill>
  );
};
