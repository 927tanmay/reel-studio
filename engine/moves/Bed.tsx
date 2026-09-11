import React from "react";
import { Audio, interpolate, staticFile } from "remotion";
import type { ReelSpec, Timeline } from "../spec";

/**
 * Music or ambience under the whole reel.
 *
 * The level is a function of the frame rather than a set of hand-drawn
 * keyframes: it sits low under speech, comes up in the gaps, ducks briefly on
 * every marked hit, and fades out at the end. Change the rule once and every
 * reel obeys it.
 */
export const Bed: React.FC<{ spec: ReelSpec; timeline: Timeline }> = ({ spec, timeline }) => {
  const bed = spec.bed;
  if (!bed) return null;

  const { fps } = spec.frame;
  const mix = spec.style.mix;
  const speechLevel = bed.underSpeech ?? mix.underSpeech;
  const silenceLevel = bed.underSilence ?? mix.underSilence;

  const speechShots = new Set(
    bed.speechShots ?? timeline.shots.filter((s) => s.shot.captions).map((s) => s.index),
  );

  const speechRanges = timeline.shots
    .filter((s) => speechShots.has(s.index))
    .map((s) => [s.startFrame, s.startFrame + s.durationInFrames] as const);

  const tailFrames = Math.max(1, Math.round(mix.tailFade * fps));

  const volume = (frame: number) => {
    const speaking = speechRanges.some(([a, b]) => frame >= a && frame < b);
    let level = speaking ? speechLevel : silenceLevel;

    for (const hit of timeline.hits) {
      if (frame >= hit.frame && frame < hit.frame + mix.dipFrames) {
        level = Math.min(level, mix.dipTo);
      }
    }

    const fadeStart = timeline.durationInFrames - tailFrames;
    if (frame >= fadeStart) {
      level *= interpolate(frame, [fadeStart, timeline.durationInFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }

    return level;
  };

  return <Audio src={staticFile(`assets/music/${bed.track}`)} volume={volume} loop />;
};
