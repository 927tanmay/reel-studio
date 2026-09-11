import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { BandSpec, ReelSpec, ResolvedShot, Source } from "./spec";
import { coverRegion, fullFrame, lerpRect, px } from "./scale";
import { enterScale, enterOpacity, exitScale, ease } from "./moves/punch";
import { Captions, primaryMediaKey } from "./moves/Captions";
import { Title } from "./moves/Title";
import { Badge } from "./moves/Badge";
import { Generated, generatedSize } from "./generators";

/** Shown instead of a black hole when a shotlist names media that is not there. */
const Missing: React.FC<{ what: string }> = ({ what }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#2A0F14",
      color: "#FF9AA6",
      fontFamily: "monospace",
      fontSize: 32,
      padding: 60,
      textAlign: "center",
    }}
  >
    {`Missing source: ${what}\nRun "npm run ingest <post>" or fix the key in shotlist.ts`}
  </AbsoluteFill>
);

const SourceView: React.FC<{
  source: Source;
  spec: ReelSpec;
  resolved: ResolvedShot;
  reframe?: { from: ReturnType<typeof fullFrame>; to?: ReturnType<typeof fullFrame> };
  inSeconds: number;
}> = ({ source, spec, resolved, reframe, inSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = spec.frame;
  const progress = resolved.durationInFrames <= 1 ? 0 : frame / (resolved.durationInFrames - 1);

  if (typeof source !== "string") {
    const size = generatedSize(source, spec.frame);
    const region = reframe
      ? lerpRect(reframe.from, reframe.to ?? reframe.from, progress)
      : fullFrame(size.width, size.height);
    const box = coverRegion(size.width, size.height, region, spec.frame);

    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div style={{ position: "absolute", ...box, width: box.width, height: box.height }}>
          <Generated spec={source} reel={spec} durationInFrames={resolved.durationInFrames} />
        </div>
      </AbsoluteFill>
    );
  }

  const entry = spec.media?.[source];
  if (!entry) return <Missing what={source} />;

  const region = reframe
    ? lerpRect(reframe.from, reframe.to ?? reframe.from, progress)
    : fullFrame(entry.width, entry.height);
  const box = coverRegion(entry.width, entry.height, region, spec.frame);
  const trimFrames = Math.round(inSeconds * fps);
  const useCleanAudio = Boolean(entry.cleanAudio);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(entry.file)}
        trimBefore={trimFrames > 0 ? trimFrames : undefined}
        muted={useCleanAudio || !entry.hasAudio}
        style={{
          position: "absolute",
          width: box.width,
          height: box.height,
          left: box.left,
          top: box.top,
        }}
      />
      {useCleanAudio ? (
        <Audio
          src={staticFile(entry.cleanAudio as string)}
          trimBefore={Math.max(
            0,
            Math.round((inSeconds + (entry.audioOffset ?? 0)) * fps),
          )}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const Bands: React.FC<{ spec: ReelSpec; resolved: ResolvedShot }> = ({ spec, resolved }) => {
  const frame = useCurrentFrame();
  const bands = resolved.shot.bands;
  if (!bands) return null;

  const openFrames = resolved.shot.enter?.kind === "bands" ? resolved.shot.enter.frames : 0;
  const t = openFrames > 0 ? ease(Math.min(1, frame / openFrames), resolved.shot.enter?.kind === "bands" ? resolved.shot.enter.easing : "easeOut") : 1;

  const dividerPx = bands.divider ? px(spec.style, spec.frame, bands.divider.weight) : 0;
  let offsetY = 0;

  return (
    <AbsoluteFill>
      {bands.regions.map((band: BandSpec, i: number) => {
        const height = band.height * spec.frame.h;
        const top = offsetY;
        offsetY += height + dividerPx;

        const slide =
          band.from === "top"
            ? -height * (1 - t)
            : band.from === "bottom"
              ? height * (1 - t)
              : 0;

        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: top + slide,
                width: spec.frame.w,
                height,
                overflow: "hidden",
              }}
            >
              <SourceView
                source={band.source}
                spec={{ ...spec, frame: { ...spec.frame, h: height } }}
                resolved={resolved}
                reframe={band.reframe}
                inSeconds={0}
              />
            </div>
            {bands.divider && i < bands.regions.length - 1 ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: top + height,
                  width: spec.frame.w,
                  height: dividerPx,
                  backgroundColor: bands.divider.color,
                  opacity: t,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export const ShotView: React.FC<{ resolved: ResolvedShot; spec: ReelSpec }> = ({
  resolved,
  spec,
}) => {
  const frame = useCurrentFrame();
  const { shot } = resolved;

  // Picture scales; text does not. Scaling type produces soft, wobbling edges.
  const scale =
    enterScale(frame, shot.enter) * exitScale(frame, resolved.durationInFrames, shot.exit);

  // A blend fades this whole shot in on top of whatever is still playing
  // underneath it — the previous shot needs no changes of its own, since
  // rendering a later shot later in this array already paints it on top.
  const opacity = enterOpacity(frame, shot.enter);

  // Captions default to on wherever a transcript exists; a shotlist opts out
  // with `captions: false` rather than opting in.
  const captionKey = primaryMediaKey(resolved);
  const hasTranscript = Boolean(captionKey && spec.words?.[captionKey]?.length);
  const showCaptions = shot.captions !== false && hasTranscript;

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
        {shot.bands ? (
          <Bands spec={spec} resolved={resolved} />
        ) : (
          <SourceView
            source={shot.src}
            spec={spec}
            resolved={resolved}
            reframe={shot.reframe}
            inSeconds={shot.in ?? 0}
          />
        )}
      </AbsoluteFill>

      {showCaptions ? <Captions spec={spec} resolved={resolved} /> : null}
      {shot.title ? <Title spec={spec} title={shot.title} /> : null}
      {shot.badge ? <Badge spec={spec} badge={shot.badge} /> : null}
    </AbsoluteFill>
  );
};
