import React from "react";
import type { Frame, GenSpec, ReelSpec } from "../spec";
import { Diagram } from "./Diagram";
import { Code } from "./Code";
import { Terminal } from "./Terminal";
import { Compare } from "./Compare";
import { Data } from "./Data";
import { Callout } from "./Callout";
import { ImageGen } from "./Image";
import { Orb } from "./Orb";
import type { WordTiming } from "../spec";

/**
 * Generated clips are sources, not a special case. They render at the delivery
 * frame size and are then treated exactly like footage: cut, punched, reframed,
 * captioned, banded.
 *
 * Each generator can read the reel's word timings, which is the thing no
 * conventional editor makes easy and no video model can do at all. A diagram
 * advances on the word you say, because the animation and the transcript are
 * the same program.
 */
export const generatedSize = (_spec: GenSpec, frame: Frame) => ({
  width: frame.w,
  height: frame.h,
});

export type GenProps<T extends GenSpec = GenSpec> = {
  spec: T;
  reel: ReelSpec;
  durationInFrames: number;
  /**
   * The words audible under this shot, in shot-local milliseconds, for a
   * generator that moves with the voice. Absent when no transcript is under it.
   */
  words?: WordTiming[];
};

export const Generated: React.FC<GenProps> = ({ spec, reel, durationInFrames, words }) => {
  switch (spec.type) {
    case "diagram":
      return <Diagram spec={spec} reel={reel} durationInFrames={durationInFrames} />;
    case "code":
      return <Code spec={spec} reel={reel} durationInFrames={durationInFrames} />;
    case "terminal":
      return <Terminal spec={spec} reel={reel} durationInFrames={durationInFrames} />;
    case "compare":
      return <Compare spec={spec} reel={reel} durationInFrames={durationInFrames} />;
    case "data":
      return <Data spec={spec} reel={reel} durationInFrames={durationInFrames} />;
    case "callout":
      return <Callout spec={spec} reel={reel} durationInFrames={durationInFrames} />;
    case "image":
      return <ImageGen spec={spec} reel={reel} durationInFrames={durationInFrames} />;
    case "orb":
      return <Orb spec={spec} reel={reel} durationInFrames={durationInFrames} words={words} />;
  }
};

/** Which step of a stepped generator is current, given seconds elapsed. */
export const currentStep = <T extends { at?: number }>(steps: T[], seconds: number): number => {
  let index = 0;
  steps.forEach((s, i) => {
    if ((s.at ?? 0) <= seconds) index = i;
  });
  return index;
};
