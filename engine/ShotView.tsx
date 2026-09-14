import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { BandSpec, ReelSpec, ResolvedShot, Segment, Sound, Source } from "./spec";
import { coverRegion, fullFrame, lerpRect, px } from "./scale";
import {
  enterScale,
  enterOpacity,
  enterTranslate,
  enterAudioFade,
  exitScale,
  exitAudioFade,
  exitOverlayVisible,
  pushMotionBlur,
  ease,
} from "./moves/punch";
import { Captions, primaryMediaKey } from "./moves/Captions";
import { Title } from "./moves/Title";
import { Badge } from "./moves/Badge";
import { Ribbon } from "./moves/Ribbon";
import { Generated, generatedSize } from "./generators";
import { gradeFilter, needsMatrix } from "./colour";

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
  /**
   * The stretches of source to play, in order. Usually `resolved.segments`,
   * which is a single entry unless the shot dropped something out of the
   * middle of its take.
   */
  segments: Segment[];
  /**
   * Whether this picture's own track is what you hear. False when something
   * else is playing underneath — a voice held across a cut to B-roll — in
   * which case this source is seen and not heard.
   */
  carryAudio: boolean;
  /** Crossfades this shot's own audio across a blend or push overlap. */
  audioVolume: number;
}> = ({ source, spec, resolved, reframe, segments, carryAudio, audioVolume }) => {
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
  const useCleanAudio = Boolean(entry.cleanAudio);
  const playbackRate = resolved.shot.speed ?? 1;

  // One clip per surviving stretch of the take. A shot that dropped nothing
  // has exactly one segment starting at its own `in`, which is the same
  // single video element this rendered before segments existed — the
  // untightened path is not a special case, it is the one-segment case.
  //
  // The crop is computed above, outside these sequences, so it keeps easing
  // across the shot as a whole rather than restarting at every join.
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {segments.map((segment, i) => (
        <Sequence
          key={i}
          from={segment.startFrame}
          durationInFrames={segment.frames}
          layout="none"
        >
          <OffthreadVideo
            src={staticFile(entry.file)}
            trimBefore={segment.sourceStart > 0 ? Math.round(segment.sourceStart * fps) : undefined}
            muted={!carryAudio || useCleanAudio || !entry.hasAudio}
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
          {carryAudio && useCleanAudio ? (
            <Audio
              src={staticFile(entry.cleanAudio as string)}
              trimBefore={Math.max(
                0,
                Math.round((segment.sourceStart + (entry.audioOffset ?? 0)) * fps),
              )}
              playbackRate={playbackRate}
              volume={audioVolume}
            />
          ) : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/**
 * One source under a shot, played as sound alone.
 *
 * Used whenever the picture cannot carry its own track — a voice continuing
 * across a cut to B-roll, or either half of a split edit, where the sound
 * changes a few frames off the picture. A borrowed source plays at its own
 * natural rate: the picture above it may be running at 1.5x, and a voice
 * pitched up to match a screen recording has never been what anybody wanted.
 */
const SoundLayer: React.FC<{ spec: ReelSpec; sound: Sound; volume: number }> = ({
  spec,
  sound,
  volume,
}) => {
  const { fps } = spec.frame;
  const entry = spec.media?.[sound.key];
  if (!entry) return null;

  const file = entry.cleanAudio ?? entry.file;
  const offset = entry.cleanAudio ? (entry.audioOffset ?? 0) : 0;

  return (
    <>
      {sound.segments.map((segment, i) => (
        <Sequence key={i} from={segment.startFrame} durationInFrames={segment.frames} layout="none">
          <Audio
            src={staticFile(file)}
            trimBefore={Math.max(0, Math.round((segment.sourceStart + offset) * fps))}
            volume={volume}
          />
        </Sequence>
      ))}
    </>
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
                // Each region plays its own source from its own start, so a
                // banded shot has no single timeline to drop ranges out of —
                // resolveTimeline says the same thing by refusing to segment
                // one, and warns if a shotlist asks it to.
                segments={[{ sourceStart: 0, startFrame: 0, frames: resolved.durationInFrames }]}
                carryAudio
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

  // Sound carried from a neighbour skips the *enter* fade on purpose. A
  // crossfade exists to stop two different clips clashing under a transition;
  // carried sound is not a second clip arriving, it is the same one still
  // going, and fading it in would dip a voice mid-word for no reason. The exit
  // fade still applies — that one marks the voice genuinely ending.
  const carriedVolume = exitAudioFade(frame, resolved.durationInFrames, resolved.audioFadeOutFrames);

  // The video element keeps carrying its own track in the ordinary case, which
  // is every shot that does nothing clever with sound. Anything else — a
  // borrowed voice, or a split edit where this shot's own sound starts a few
  // frames late — mutes the picture and plays every source as its own layer,
  // because a video element cannot start its audio partway through itself.
  const only = resolved.sounds.length === 1 ? resolved.sounds[0] : undefined;
  const carryAudio = Boolean(only?.own && only.segments[0]?.startFrame === 0);

  // Grading and push motion blur both sit on the picture layer, inside the
  // scale and outside the overlays — a correction or a blur that touched a
  // caption sitting on top of the picture would make it harder to read for
  // no reason. Two independent SVG filters, combined into one CSS `filter`
  // list, each skipped when it has nothing to do.
  const matrixId = `grade-${resolved.key}`;
  const gradeFilterValue = gradeFilter(shot.grade, matrixId);
  const gain = shot.grade?.gain;

  const blurId = `blur-${resolved.key}`;
  const blur = pushMotionBlur(frame, shot.enter, spec.frame.w, spec.frame.h);
  const hasBlur = blur.x > 0.5 || blur.y > 0.5;

  const filter = [gradeFilterValue, hasBlur ? `url(#${blurId})` : null].filter(Boolean).join(" ") || undefined;

  // Captions default to on wherever a transcript exists; a shotlist opts out
  // with `captions: false` rather than opting in.
  const captionKey = primaryMediaKey(resolved);
  const hasTranscript = Boolean(captionKey && spec.words?.[captionKey]?.length);
  const showCaptions = shot.captions !== false && hasTranscript;

  return (
    <AbsoluteFill style={{ opacity, transform: `translate(${translate.x}px, ${translate.y}px)` }}>
      {needsMatrix(shot.grade) && gain ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <filter id={matrixId} colorInterpolationFilters="sRGB">
              {/* Diagonal gains: each channel scaled on its own, which is what
                  white balance is and what no CSS filter function can express. */}
              <feColorMatrix
                type="matrix"
                values={`${gain.r} 0 0 0 0  0 ${gain.g} 0 0 0  0 0 ${gain.b} 0 0  0 0 0 1 0`}
              />
            </filter>
          </defs>
        </svg>
      ) : null}

      {hasBlur ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            {/* A generous filter region: the default clips at ~10% past the
                element's own box, which cuts off a blur wide enough to matter
                right as a full-frame push needs it most. */}
            <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${blur.x} ${blur.y}`} />
            </filter>
          </defs>
        </svg>
      ) : null}

      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "center center", filter }}>
        {shot.bands ? (
          <Bands spec={spec} resolved={resolved} bandAudioVolume={audioVolume} />
        ) : (
          <SourceView
            source={shot.src}
            spec={spec}
            resolved={resolved}
            reframe={shot.reframe}
            segments={resolved.segments}
            carryAudio={carryAudio}
            audioVolume={audioVolume}
          />
        )}
      </AbsoluteFill>

      {carryAudio
        ? null
        : resolved.sounds.map((sound, i) => (
            <SoundLayer
              key={`${sound.key}-${i}`}
              spec={spec}
              sound={sound}
              volume={sound.own ? audioVolume : carriedVolume}
            />
          ))}

      {exitOverlayVisible(frame, resolved.durationInFrames, resolved.overlayFadeOutFrames) ? (
        <>
          {showCaptions ? <Captions spec={spec} resolved={resolved} /> : null}
          {shot.title ? <Title spec={spec} title={shot.title} /> : null}
          {shot.badge ? <Badge spec={spec} badge={shot.badge} /> : null}
          {shot.ribbon ? <Ribbon spec={spec} ribbon={shot.ribbon} /> : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};
