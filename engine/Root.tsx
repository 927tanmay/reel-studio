import React from "react";
import { Composition } from "remotion";
import { posts } from "../posts";
import { Reel } from "./Reel";
import { Thumbnail } from "./Thumbnail";
import { resolveTimeline } from "./spec";
import { formatFindings, verifySpec } from "./verify";

/**
 * Every post in posts.ts becomes a composition, sized and timed from its own
 * shotlist. Nothing here is configured per reel; add a post to posts.ts and it
 * appears in the studio and on the render command.
 */
export const Root: React.FC = () => {
  return (
    <>
      {Object.entries(posts).map(([id, spec]) => {
        const timeline = resolveTimeline(spec);

        // Surfaced here so problems appear when the studio opens, not at render.
        const report = formatFindings(id, verifySpec(spec, timeline));
        if (report) console.warn(report);

        return (
          <React.Fragment key={id}>
            <Composition
              id={id}
              component={Reel}
              durationInFrames={timeline.durationInFrames}
              fps={spec.frame.fps}
              width={spec.frame.w}
              height={spec.frame.h}
              defaultProps={{ spec }}
            />
            {spec.thumbnail ? (
              <Composition
                id={`${id}-thumbnail`}
                component={Thumbnail}
                durationInFrames={1}
                fps={spec.frame.fps}
                width={spec.frame.w}
                height={spec.frame.h}
                defaultProps={{ spec }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
};
