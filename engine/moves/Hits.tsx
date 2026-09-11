import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { ReelSpec, ResolvedHit } from "../spec";

/**
 * Sound effects landing on exact frames.
 *
 * The frame numbers come from the same timeline that placed the cut, which is
 * why a hit cannot drift off its cut the way a hand-placed one does.
 */
export const Hits: React.FC<{ spec: ReelSpec; hits: ResolvedHit[] }> = ({ spec, hits }) => {
  if (hits.length === 0) return null;

  return (
    <>
      {hits.map((hit, i) => (
        <Sequence key={`${hit.sfx}-${hit.frame}-${i}`} from={hit.frame} name={`hit ${hit.sfx}`}>
          <Audio src={staticFile(`assets/sfx/${hit.sfx}.wav`)} volume={hit.volume} />
        </Sequence>
      ))}
    </>
  );
};
