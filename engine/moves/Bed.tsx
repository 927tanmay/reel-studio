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

    // A named dip is longer than a hit's, so it ramps in and out rather than
    // stepping, which would click on a sustained track.
    for (const dip of timeline.dips) {
      if (frame < dip.frame || frame >= dip.frame + dip.frames) continue;
      const ramp = Math.max(1, Math.min(mix.dipFrames + 3, Math.floor(dip.frames / 2)));
      const depth = interpolate(
        frame,
        [dip.frame, dip.frame + ramp, dip.frame + dip.frames - ramp, dip.frame + dip.frames],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      const floor = Math.min(level, dip.to ?? mix.dipTo);
      level = level + (floor - level) * depth;
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

  // `extend`, not the default `repeat`: with `repeat`, each pass of a looping
  // track restarts the frame count handed to `volume`, so a reel longer than
  // its track has every dip, duck and the closing fade land on the wrong
  // frame — or never, since the tail fade sits past the end of one pass.
  // This curve is written against the whole reel, so it needs the reel's frame.
  return (
    <Audio
      src={staticFile(`assets/music/${bed.track}`)}
      volume={volume}
      loop
      loopVolumeCurveBehavior="extend"
    />
  );
};
