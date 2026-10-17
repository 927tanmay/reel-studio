import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { BandSpec, ReelSpec, ResolvedShot, Segment, Shot, Sound, Source } from "./spec";
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
import { wordsInShot } from "./spec";
import { Title } from "./moves/Title";
import { Badge } from "./moves/Badge";
import { Ribbon } from "./moves/Ribbon";
import { LowerThird } from "./moves/LowerThird";
import { Marks } from "./moves/Marks";
import { Pointer } from "./moves/Pointer";
import { Slams } from "./moves/Slams";
import { Generated, generatedSize } from "./generators";
import { gradeFilter, needsMatrix } from "./colour";
import { rampPieces } from "./ramp";
import { cardBox, cardTilt, tiltAt } from "./card";
import { zoomState } from "./zoom";
import { impactState } from "./impact";

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
          <Generated
            spec={source}
            reel={spec}
            durationInFrames={resolved.durationInFrames}
            words={(() => {
              // Only a generator that follows the voice reads these, so only
              // an orb that asked pays for working them out.
              if (source.type !== "orb" || !source.reactToSpeech) return undefined;
              const key = primaryMediaKey(resolved);
              const all = key ? spec.words?.[key] : undefined;
              return all ? wordsInShot(resolved, fps, all) : undefined;
            })()}
          />
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

  // A speed ramp plays as short constant-rate pieces, since a video element
  // takes one playback rate; everything else is its own segments at the
  // shot's single rate. Same shape either way, so one render path.
  const ramp = resolved.shot.speedRamp;
  const parts: { startFrame: number; frames: number; sourceStart: number; rate: number }[] =
    ramp && ramp.length > 0 && ramp.every((p) => p.speed > 0)
      ? rampPieces(ramp, fps, resolved.durationInFrames, resolved.shot.in ?? 0)
      : segments.map((s) => ({ ...s, rate: playbackRate }));

  // One clip per surviving stretch of the take. A shot that dropped nothing
  // has exactly one segment starting at its own `in`, which is the same
  // single video element this rendered before segments existed — the
  // untightened path is not a special case, it is the one-segment case.
  //
  // The crop is computed above, outside these sequences, so it keeps easing
  // across the shot as a whole rather than restarting at every join.
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {parts.map((segment, i) => (
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
            playbackRate={segment.rate}
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
              playbackRate={segment.rate}
              volume={audioVolume}
            />
          ) : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/**
 * Scales its children about one point — the click an auto-zoom is heading for —
 * so the clicked thing stays where it is while its surroundings grow. With no
 * zoom it is a plain pass-through.
 */
const Zoomed: React.FC<{
  zoom: { scale: number } | null;
  originX: number;
  originY: number;
  children: React.ReactNode;
}> = ({ zoom, originX, originY, children }) => {
  if (!zoom) return <>{children}</>;
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom.scale})`, transformOrigin: `${originX}px ${originY}px` }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * The picture as a floating card: a blurred, dimmed copy of itself fills the
 * frame behind, and the picture sits in front as a rounded, shadowed card at
 * the look's size. The copy behind is muted and plays no sound; only the card
 * carries audio. An auto-zoom happens *inside* the card, clipped by its
 * corners, rather than scaling the card itself.
 */
const CardPicture: React.FC<{
  spec: ReelSpec;
  shot: Shot;
  box: { left: number; top: number; width: number; height: number };
  zoom: { scale: number; x: number; y: number } | null;
  view: (spec: ReelSpec, carryAudio: boolean, volume: number) => React.ReactNode;
  carryAudio: boolean;
  audioVolume: number;
}> = ({ spec, shot, box, zoom, view, carryAudio, audioVolume }) => {
  const frame = useCurrentFrame();
  const style = spec.style.card!;
  const size = (n: number) => px(spec.style, spec.frame, n);

  const t = ease(frame / Math.max(1, style.enterFrames), "easeOut");
  const enter = style.enterScale + (1 - style.enterScale) * t;

  // The 3D swing: a perspective camera at the card's own centre, so it turns
  // about itself rather than swinging round the frame, and the blurred copy
  // behind slides the opposite way a little — depth from parallax, nothing more.
  const tiltSpec = cardTilt(spec, shot);
  const tilt = tiltSpec ? tiltAt(tiltSpec, frame) : null;
  const parallax = tiltSpec && tilt ? -tilt.y * size(tiltSpec.parallax) : 0;

  // The focus is in frame coordinates; inside the card it is relative to the
  // card's own corner, and clamped to the card so a click near the frame edge
  // cannot send the zoom's origin off the picture.
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const ox = zoom ? clamp(zoom.x * spec.frame.w - box.left, 0, box.width) : 0;
  const oy = zoom ? clamp(zoom.y * spec.frame.h - box.top, 0, box.height) : 0;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <AbsoluteFill
          style={{
            transform: `translateX(${parallax}px) scale(${style.background.scale})`,
            filter: `blur(${size(style.background.blur)}px) brightness(${1 - style.background.dim}) saturate(${style.background.saturate})`,
          }}
        >
          {view(spec, false, 0)}
        </AbsoluteFill>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          perspective: tiltSpec ? size(tiltSpec.perspective) : undefined,
          perspectiveOrigin: `${box.left + box.width / 2}px ${box.top + box.height / 2}px`,
        }}
      >
      <div
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          borderRadius: size(style.radius),
          boxShadow: `0 ${size(style.shadow.y)}px ${size(style.shadow.blur)}px ${style.shadow.color}`,
          opacity: t,
          transform: tilt && (tilt.x !== 0 || tilt.y !== 0)
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${enter})`
            : `scale(${enter})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: size(style.radius) }}>
          <Zoomed zoom={zoom} originX={ox} originY={oy}>
            {view({ ...spec, frame: { ...spec.frame, w: box.width, h: box.height } }, carryAudio, audioVolume)}
          </Zoomed>
        </div>
        {style.border ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: size(style.radius),
              boxShadow: `inset 0 0 0 ${size(style.border.weight)}px ${style.border.color}`,
            }}
          />
        ) : null}
      </div>
      </AbsoluteFill>
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
                // one, and warns if a shotlist asks it to. All regions share
                // the shot's own `in`, the same offset resolveTimeline already
                // used to build `resolved.segments` — a generated region
                // ignores it (it has no source-time concept), and a video
                // region picks up mid-clip instead of always restarting at
                // its own frame 0, which is what lets a band show the same
                // take that's still talking, continuing from where a
                // preceding full-frame shot on that take left off.
                segments={[
                  { sourceStart: resolved.shot.in ?? 0, startFrame: 0, frames: resolved.durationInFrames },
                ]}
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

export const ShotView: React.FC<{
  resolved: ResolvedShot;
  spec: ReelSpec;
  /**
   * "none" is for a still frame outside the reel — a thumbnail. It keeps the
   * exact picture pipeline (crop, grade, scale, bands) but drops every text
   * overlay: captions, title, badge, ribbon, lower third. A caption frozen
   * mid-word reads as a mistake, the others name a beat that only makes
   * sense in motion, and a thumbnail draws its own title on top separately
   * (see Thumbnail.tsx) rather than reusing the in-video one as-is.
   */
  overlays?: "full" | "none";
  /**
   * Overrides the shot's own crop — a thumbnail is one still, not a shot the
   * eye tracks for several seconds, so it can afford to sit tighter than the
   * crop that shot uses in motion.
   */
  reframeOverride?: Shot["reframe"];
  /** Appended to the picture's own filter list — a contrast/saturation lift
   *  behind everything else, for a thumbnail punching up the picture. */
  extraFilter?: string;
}> = ({ resolved, spec, overlays = "full", reframeOverride, extraFilter }) => {
  const frame = useCurrentFrame();
  const { shot } = resolved;
  const reframe = reframeOverride !== undefined ? reframeOverride : shot.reframe;

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
  // (pictureTransform is built below, once the impacts are known.)

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

  // Shake, flash and glitch: what every impact on this shot does at this
  // frame, summed. Pure functions of the frame, like everything else here.
  const impact =
    shot.impacts?.length && spec.style.impact
      ? impactState(
          frame,
          spec.frame.fps,
          shot.impacts,
          spec.style.impact,
          spec.frame.w / spec.style.designWidth,
          (c) => spec.style.palette[c] ?? c,
        )
      : null;

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

  const glitchId = `glitch-${resolved.key}`;
  const glitchOn = Boolean(impact?.glitch);

  const filter =
    [gradeFilterValue, hasBlur ? `url(#${blurId})` : null, glitchOn ? `url(#${glitchId})` : null, extraFilter ?? null]
      .filter(Boolean)
      .join(" ") || undefined;

  // The picture's auto-zoom toward a click, and — when the shot is a floating
  // card — the card's own box, from the aspect of what it shows. Both are pure
  // functions of the frame and the look, so any frame renders alone.
  const zoom =
    shot.pointer && spec.style.pointer
      ? zoomState(frame, spec.frame.fps, shot.pointer, spec.style.pointer)
      : null;
  const aspect = (() => {
    if (typeof shot.src !== "string") return spec.frame.w / spec.frame.h;
    const entry = spec.media?.[shot.src];
    if (!entry) return null;
    const region = reframe?.from ?? fullFrame(entry.width, entry.height);
    return region.w / region.h;
  })();
  const card = shot.card && !shot.bands && aspect ? cardBox(spec, shot, aspect) : null;

  // A shake moves the picture only, and enlarges it just enough that the
  // travel and tilt never uncover an edge — by exactly what the current frame
  // needs, so there is no pop in scale as the shake begins.
  const shaken = impact?.shake;
  const coverFactor = shaken
    ? 1 +
      (2 * shaken.cover) / spec.frame.w +
      ((Math.abs(shaken.rotate) * Math.PI) / 180) * Math.max(spec.frame.h / spec.frame.w, spec.frame.w / spec.frame.h)
    : 1;
  const pictureTransform = shaken
    ? `translate(${shaken.x}px, ${shaken.y}px) rotate(${shaken.rotate}deg) scale(${scale * coverFactor})`
    : `scale(${scale})`;

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

      {impact?.glitch ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            {/* A horizontal tear — noise stretched along x, so it displaces in
                bands — and the red and blue channels pulled apart. The seed
                changes every frame, so the tear jumps instead of drifting. */}
            <filter id={glitchId} x="-6%" y="0%" width="112%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.002 0.045" numOctaves={1} seed={impact.glitch.seed} result="noise" />
              <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="tear" />
              <feDisplacementMap in="SourceGraphic" in2="tear" scale={impact.glitch.slice * 2} xChannelSelector="R" yChannelSelector="G" result="torn" />
              <feColorMatrix in="torn" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
              <feColorMatrix in="torn" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
              <feColorMatrix in="torn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
              <feOffset in="red" dx={impact.glitch.split} dy={0} result="redShift" />
              <feOffset in="blue" dx={-impact.glitch.split} dy={0} result="blueShift" />
              <feBlend in="redShift" in2="green" mode="screen" result="rg" />
              <feBlend in="rg" in2="blueShift" mode="screen" />
            </filter>
          </defs>
        </svg>
      ) : null}

      <AbsoluteFill style={{ transform: pictureTransform, transformOrigin: "center center", filter }}>
        {shot.bands ? (
          <Bands spec={spec} resolved={resolved} bandAudioVolume={audioVolume} />
        ) : card ? (
          <CardPicture
            spec={spec}
            shot={shot}
            box={card}
            zoom={zoom}
            view={(viewSpec, carry, volume) => (
              <SourceView
                source={shot.src}
                spec={viewSpec}
                resolved={resolved}
                reframe={reframe}
                segments={resolved.segments}
                carryAudio={carry}
                audioVolume={volume}
              />
            )}
            carryAudio={carryAudio}
            audioVolume={audioVolume}
          />
        ) : (
          <Zoomed zoom={zoom} originX={zoom ? zoom.x * spec.frame.w : 0} originY={zoom ? zoom.y * spec.frame.h : 0}>
            <SourceView
              source={shot.src}
              spec={spec}
              resolved={resolved}
              reframe={reframe}
              segments={resolved.segments}
              carryAudio={carryAudio}
              audioVolume={audioVolume}
            />
          </Zoomed>
        )}
      </AbsoluteFill>

      {impact?.flash ? (
        <AbsoluteFill style={{ backgroundColor: impact.flash.color, opacity: impact.flash.opacity, pointerEvents: "none" }} />
      ) : null}

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

      {overlays === "full" && exitOverlayVisible(frame, resolved.durationInFrames, resolved.overlayFadeOutFrames) ? (
        <>
          {shot.slams ? <Slams spec={spec} slams={shot.slams} /> : null}
          {showCaptions ? <Captions spec={spec} resolved={resolved} /> : null}
          {shot.title ? <Title spec={spec} title={shot.title} /> : null}
          {shot.badge ? <Badge spec={spec} badge={shot.badge} /> : null}
          {shot.ribbon ? <Ribbon spec={spec} ribbon={shot.ribbon} /> : null}
          {shot.pointer ? <Pointer spec={spec} pointer={shot.pointer} /> : null}
          {shot.marks ? <Marks spec={spec} marks={shot.marks} /> : null}
          {shot.lowerThird ? <LowerThird spec={spec} lowerThird={shot.lowerThird} /> : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};
