import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { BandSpec, ReelSpec, ResolvedShot, Source } from "./spec";
import { coverRegion, fullFrame, lerpRect, px } from "./scale";
import {
  enterScale,
  enterOpacity,
  enterTranslate,
  enterAudioFade,
  exitScale,
  exitAudioFade,
  ease,
} from "./moves/punch";
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
  source: Source | undefined;
  spec: ReelSpec;
  resolved: ResolvedShot;
  reframe?: { from: ReturnType<typeof fullFrame>; to?: ReturnType<typeof fullFrame> };
  inSeconds: number;
  /** Crossfades this shot's own audio across a blend or push overlap. */
  audioVolume: number;
}> = ({ source, spec, resolved, reframe, inSeconds, audioVolume }) => {
  const frame = useCurrentFrame();
  const { fps } = spec.frame;
  const progress = resolved.durationInFrames <= 1 ? 0 : frame / (resolved.durationInFrames - 1);

  // A shot with neither `src` nor `bands` is malformed rather than silent —
  // resolveTimeline already warned about it; this is what that warning looks
  // like on screen instead of a blank frame nobody notices.
  if (source === undefined) return <Missing what="(no src or bands set on this shot)" />;

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
  const playbackRate = resolved.shot.speed ?? 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(entry.file)}
        trimBefore={trimFrames > 0 ? trimFrames : undefined}
        muted={useCleanAudio || !entry.hasAudio}
        playbackRate={playbackRate}
        volume={audioVolume}
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
          playbackRate={playbackRate}
          volume={audioVolume}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const Bands: React.FC<{ spec: ReelSpec; resolved: ResolvedShot; bandAudioVolume: number }> = ({
  spec,
  resolved,
  bandAudioVolume,
}) => {
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

        // Each region opens by sliding in from whichever edge it names. Top
        // and bottom travel by their own height, so a region only ever has
        // to cross the distance it's actually offset by; left and right
        // travel the full frame width, since a band spans it edge to edge.
        let dx = 0;
        let dy = 0;
        if (band.from === "top") dy = -height * (1 - t);
        else if (band.from === "bottom") dy = height * (1 - t);
        else if (band.from === "left") dx = -spec.frame.w * (1 - t);
        else if (band.from === "right") dx = spec.frame.w * (1 - t);

        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: dx,
                top: top + dy,
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
                audioVolume={bandAudioVolume}
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
  // Exit reads `effectiveExit`, not `shot.exit` directly — a blend defaults
  // one in when the shotlist didn't set its own, so a plain `enter: blend()`
  // on the next shot alone is enough to animate both sides of the cut.
  const scale =
    enterScale(frame, shot.enter) * exitScale(frame, resolved.durationInFrames, resolved.effectiveExit);

  // A blend fades this whole shot in on top of whatever is still playing
  // underneath it — the previous shot needs no changes of its own, since
  // rendering a later shot later in this array already paints it on top. A
  // push stays fully opaque throughout; it reveals by sliding, not fading.
  const opacity = enterOpacity(frame, shot.enter);

  const translate = enterTranslate(frame, shot.enter, spec.frame.w, spec.frame.h);

  // Audio crossfades independently of picture: this shot's own sound fades
  // in across an incoming blend or push, and fades back out across its own
  // final frames if the *next* shot overlaps it the same way — regardless of
  // whether either side's picture also fades.
  const audioVolume =
    enterAudioFade(frame, shot.enter) *
    exitAudioFade(frame, resolved.durationInFrames, resolved.audioFadeOutFrames);

  // Captions default to on wherever a transcript exists; a shotlist opts out
  // with `captions: false` rather than opting in.
  const captionKey = primaryMediaKey(resolved);
  const hasTranscript = Boolean(captionKey && spec.words?.[captionKey]?.length);
  const showCaptions = shot.captions !== false && hasTranscript;

  return (
    <AbsoluteFill style={{ opacity, transform: `translate(${translate.x}px, ${translate.y}px)` }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
        {shot.bands ? (
          <Bands spec={spec} resolved={resolved} bandAudioVolume={audioVolume} />
        ) : (
          <SourceView
            source={shot.src}
            spec={spec}
            resolved={resolved}
            reframe={shot.reframe}
            inSeconds={shot.in ?? 0}
            audioVolume={audioVolume}
          />
        )}
      </AbsoluteFill>

      {showCaptions ? <Captions spec={spec} resolved={resolved} /> : null}
      {shot.title ? <Title spec={spec} title={shot.title} /> : null}
      {shot.badge ? <Badge spec={spec} badge={shot.badge} /> : null}
    </AbsoluteFill>
  );
};
