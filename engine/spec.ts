/**
 * The shotlist contract.
 *
 * A reel is a frame size, a look, and an ordered list of shots. Everything
 * creative is in here as data. The engine's job is to turn this into frames
 * without adding opinions of its own.
 */

import type { Tokens } from "./tokens";

export type Frame = { w: number; h: number; fps: number };

/** A rectangle in *source* pixels. Used to crop before scaling, never after. */
export type Rect = { x: number; y: number; w: number; h: number };

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export type Easing = "linear" | "ease" | "easeIn" | "easeOut" | "easeInOut";

/** A scale ramp. `to` is the starting scale; the shot settles back to 1. */
export type Punch = {
  kind: "punch";
  to: number;
  frames: number;
  easing?: Easing;
  /** A sound effect key from public/assets/sfx, landing on the first frame. */
  hit?: string;
  hitVolume?: number;
};

export type Cut = { kind: "cut" };

/** The frame divides into regions, and they slide into place. */
export type BandsOpen = { kind: "bands"; frames: number; easing?: Easing };

/**
 * A cross-dissolve. The incoming shot starts `frames` before the previous one
 * would have ended, fading in on top of it while zooming from `to` down to 1 —
 * both shots visible and moving at once, rather than meeting at a hard edge.
 *
 * Pair it with `exit: exitPunch({...})` on the *previous* shot if you also want
 * the outgoing side to keep pushing in through the overlap; a blend by itself
 * only animates the incoming side. Using it shortens the reel: total runtime
 * drops by `frames` for every blend, the same way a crossfade shortens a
 * timeline in a conventional editor.
 */
export type Blend = { kind: "blend"; frames: number; to: number; easing?: Easing };

/**
 * A slide. The incoming shot enters fully opaque from off-frame and covers
 * the previous one as it crosses in — a different read from `blend`: no
 * zoom, no cross-dissolve, a clean directional sweep. Like `blend`, it
 * overlaps the previous shot's tail rather than waiting for a cut.
 */
export type Push = {
  kind: "push";
  frames: number;
  direction: "left" | "right" | "up" | "down";
  easing?: Easing;
  /**
   * Motion blur on the incoming picture, along its direction of travel.
   * On by default and needing nothing from a shotlist — the same way an
   * audio crossfade needs nothing from a shotlist wherever a blend or push
   * overlaps (rule 7). A sweep that snaps into focus at every frame reads as
   * a slideshow rather than a camera move; smearing it slightly the way a
   * real shutter would is what sells the motion. 1 is the engine's own
   * calibration; 0 turns it off, for a push carrying legible text or a UI
   * that has to stay readable mid-slide; anything else scales it.
   */
  blur?: number;
};

export type Enter = Punch | Cut | BandsOpen | Blend | Push;

export const punch = (o: Omit<Punch, "kind">): Punch => ({ kind: "punch", ...o });
export const cut = (): Cut => ({ kind: "cut" });
export const bandsOpen = (o: Omit<BandsOpen, "kind">): BandsOpen => ({ kind: "bands", ...o });
export const blend = (o: Omit<Blend, "kind">): Blend => ({ kind: "blend", ...o });
export const push = (o: Omit<Push, "kind">): Push => ({ kind: "push", ...o });

/** An exit ramp on the outgoing shot. Pair with an enter punch for a full swap. */
export type Exit = { kind: "punch"; to: number; frames: number; easing?: Easing };
export const exitPunch = (o: Omit<Exit, "kind">): Exit => ({ kind: "punch", ...o });

/**
 * A banner that flies in from an edge, lands with a spring, and holds.
 *
 * Distinct from `title`, which fades a line of type in place: a ribbon
 * travels. Use it where the graphic is the point — a follow ask, a handle, a
 * result — and the type alone would read as a caption. The look, including
 * the spring, is in the tokens; what's here is the copy and the timing, which
 * are per-shot decisions.
 */
export type Ribbon = {
  text: string;
  /** A second, smaller line under the first. */
  sub?: string;
  /** Which edge it flies in from. Defaults to the top. */
  from?: "top" | "bottom";
  /** Seconds into the shot when it arrives. Defaults to the shot's first frame. */
  at?: number;
  /** Frames the fly-in takes. Defaults to the look's `ribbon.frames`. */
  frames?: number;
  /**
   * Seconds it holds after landing before flying back out. Omit and it stays
   * for the rest of the shot, which is usually what a closing ask wants.
   */
  hold?: number;
  /** Distance from the frame edge it settles at, as a fraction of height. */
  offset?: number;
};

// ---------------------------------------------------------------------------
// Generated sources
// ---------------------------------------------------------------------------

export type DiagramNode = { id: string; label: string; sub?: string; color?: string };
export type DiagramEdge = { from: string; to: string; label?: string };

/** A step the generator advances to, optionally pinned to a spoken word. */
export type Step = { at?: number; show: string[] };

export type GenSpec =
  | {
      type: "diagram";
      nodes: DiagramNode[];
      edges?: DiagramEdge[];
      layout?: "row" | "column" | "grid";
      steps?: Step[];
      /** Keep this many nodes in frame at once; the rest are panned to. */
      window?: number;
      /**
       * Set false to hold the frame still on the whole strip instead of gliding
       * to whichever nodes the current step shows — for two alternatives side
       * by side, which arrive without the picture moving.
       */
      pan?: boolean;
      seconds?: number;
    }
  | {
      type: "code";
      code: string;
      language?: string;
      /** Characters per second while typing. 0 means appear instantly. */
      typeSpeed?: number;
      highlight?: { at?: number; lines: number[] }[];
      title?: string;
      seconds?: number;
    }
  | {
      type: "terminal";
      lines: { prompt?: string; command?: string; output?: string; at?: number }[];
      typeSpeed?: number;
      seconds?: number;
    }
  | {
      type: "compare";
      left: { title: string; body: string[] };
      right: { title: string; body: string[] };
      wipeAt?: number;
      seconds?: number;
    }
  | {
      type: "data";
      items: {
        label: string;
        value: number;
        suffix?: string;
        color?: string;
        /**
         * Seconds into the shot when this figure starts to grow. Omit and
         * items start together, staggered slightly. Pin it to a word with
         * `at.start("hundred") - shotStart` to land a number on the word.
         */
        at?: number;
      }[];
      style?: "counter" | "bars";
      seconds?: number;
    }
  | {
      type: "callout";
      image: string;
      focus: Rect;
      label?: string;
      dim?: number;
      seconds?: number;
    }
  | {
      /**
      * A plain still, full-bleed. Distinct from `callout`, which always draws
      * a focus box and dims everything else — this is for when the picture
      * itself is the point, like a freeze-frame closing a reel, and any
      * added emphasis would just be in the way.
      */
      type: "image";
      src: string;
      seconds?: number;
    };

export type Source = string | GenSpec;

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

export type BandSpec = {
  /** Height as a fraction of the frame. Bands must sum to 1 minus dividers. */
  height: number;
  source: Source;
  reframe?: { from: Rect; to?: Rect };
  /** Bands slide in from this edge when the shot opens. */
  from?: "top" | "bottom" | "left" | "right" | "none";
};

/**
 * A range of *source* seconds, used to say which parts of a clip to remove.
 *
 * Produced by `pauses()` and `fillers()` in words.ts rather than written by
 * hand: both are derived from the same word timings the cuts are anchored to,
 * so they survive a re-transcription the way a timecode never would.
 */
export type Gap = { from: number; to: number };

/** See `Shot.audio`. A split edit's `n` is in frames, like every other move. */
export type ShotAudio =
  | "hold"
  | { trail: number }
  | { lead: number }
  | { from: string };

/**
 * A colour correction on a shot's picture. Every field is a multiplier, and
 * 1 means untouched, so a partly-specified grade only does what it names.
 *
 * Text is never graded — a caption is not part of the photograph, and dimming
 * one to match a dark take makes it harder to read for no reason.
 */
export type Grade = {
  /** Overall brightness. */
  exposure?: number;
  contrast?: number;
  saturation?: number;
  /**
   * Per-channel gain — white balance. This is the one that actually makes a
   * phone take and a screen recording look like they belong in the same reel;
   * exposure alone leaves one of them blue.
   */
  gain?: { r: number; g: number; b: number };
};

/** Mean channel levels across a clip, 0–255. Measured by scripts/grade.mjs. */
export type Colour = { r: number; g: number; b: number };

export type Shot = {
  /**
   * A media key from media.json, or an inline generated clip. Omit only when
   * `bands` is set — a banded shot takes its picture from each region's own
   * `source` instead, and `src` is ignored if present alongside `bands`.
   */
  src?: Source;
  /** Skip this many seconds into the source. */
  in?: number;
  /** Explicit length. Omit and the length is measured from the file. */
  seconds?: number;
  /**
   * Ranges of the source to remove, in the source's own seconds — the dead
   * air between sentences, an "um", a false start. What is left closes up,
   * so this shot ends up shorter on screen than the window `in` and `seconds`
   * describe; nothing else on the timeline moves except by that shortening.
   *
   * This is the difference between a take playing as recorded and a take that
   * has been *cut*. Overlapping or unordered ranges are fine — they are sorted
   * and merged before anything is measured — so concatenating two sources of
   * gaps needs no care:
   *
   *   drop: [...pauses(words.hook, { longerThan: 0.4 }), ...fillers(words.hook)]
   *
   * Captions follow automatically: a word inside a dropped range is gone with
   * it, and everything after slides earlier by exactly what was removed.
   */
  drop?: Gap[];
  /** Crop a region of the source and scale it to fill. Never scales alone. */
  reframe?: { from: Rect; to?: Rect };
  /**
   * Colour correction on this shot's picture, and only its picture.
   *
   * Footage shot on a phone and a recording taken off a screen are lit by
   * different things and encoded by different software; cut together
   * untouched, they read as two different videos rather than two parts of
   * one. Build this with `matchGrade()` from `colour.ts` after running
   * `npm run grade <post>`, which measures every clip and says how far apart
   * they actually are, or set the multipliers directly when you know what
   * you want.
   */
  grade?: Grade;
  /**
   * Playback rate for a video source. 1 is native. `seconds` is still the
   * on-screen duration you author explicitly — raising `speed` compresses
   * more of the source's timeline into that same on-screen time, which is
   * how a shot covers its full source window in less runtime without
   * cutting any of it away. Has no effect on a generated source.
   */
  speed?: number;
  /**
   * What happens to the sound at this shot's cut, when it should not simply
   * change with the picture.
   *
   * All three are declared on the *incoming* shot, because all three describe
   * the same thing: how far the sound edit sits from the picture edit.
   *
   * - `"hold"` — the previous sound runs under this whole shot, continuing
   *   from exactly where it left off. This is what puts B-roll *on* a sentence
   *   instead of *after* it: the speaker keeps talking, uninterrupted and
   *   uncut, while the picture shows the thing being described. Several shots
   *   in a row can hold, each continuing from the last.
   * - `{ trail: n }` — an L-cut. The previous sound stays for this shot's
   *   first `n` frames, then this shot's own takes over. The picture changes
   *   before the sound does.
   * - `{ lead: n }` — a J-cut. This shot's sound starts `n` frames early,
   *   over the tail of the shot before it. The sound changes before the
   *   picture does, which is the one that makes a cut feel motivated rather
   *   than abrupt: you hear where you are going before you see it.
   *
   * - `{ from }` — a different clip's sound under this whole shot, read off
   *   this shot's own `in`, `seconds` and `drop` as if that clip were its
   *   source. For B-roll that *opens* a take: `hold` continues whatever played
   *   last, which is the wrong voice when the next line's picture is a graphic
   *   that starts before its speaker does. Later shots that `hold` continue
   *   from wherever this one stops.
   *
   * Both split edits keep sound locked to its own picture — only the moment
   * of the switch moves — so a J-cut needs `in` to be at least `n` frames
   * into its source, since that is the material it plays early.
   *
   * Sound from elsewhere always plays at its natural rate, whatever `speed`
   * is doing to the picture above it: a voice pitched up to match a 1.5x
   * screen recording is never what anybody wanted.
   */
  audio?: ShotAudio;
  /** Divide the frame. When present, `src` is ignored. */
  bands?: { divider?: { weight: number; color: string }; regions: BandSpec[] };
  enter?: Enter;
  exit?: Exit;
  /**
   * Burn the spoken words from words.json over this shot. Defaults to on for
   * any shot whose primary source has a transcript — set `false` to turn
   * captions off for a shot that would otherwise get them.
   */
  captions?: boolean;
  /**
   * Words that read as the point of the sentence, given the look's
   * `caption.emphasis` treatment wherever they appear in this shot's
   * captions — matched the same case- and punctuation-insensitive way
   * `anchors()` matches. A standing editorial choice: which two or three
   * words in the whole reel actually carry the claim, not which word is
   * currently being said. Every entry should actually occur in this shot's
   * spoken range; one that never matches is silently inert, which is worth
   * checking for, not assuming.
   */
  emphasis?: string[];
  /** Authored text, not from speech. */
  title?: string | { text: string; top?: number; enterFrames?: number };
  /** A small persistent label. */
  badge?: string | { text: string; bottom?: number };
  /** A banner that flies in and lands. Motion graphics, not type. */
  ribbon?: Ribbon;
  /** Extra sound effects at offsets within this shot, in seconds. */
  hits?: { at: number; sfx: string; volume?: number }[];
  /**
   * Duck the music bed to near-silence for `frames` frames, `at` seconds into
   * this shot. A `hit` already ducks the bed for a moment as a side effect;
   * this is the dip on its own, with no sound effect, for a beat that wants
   * the music out of the way for as long as a word takes to land. `to`
   * overrides the look's `mix.dipTo`.
   */
  dips?: { at: number; frames: number; to?: number }[];
  /** Anything you want to read back later. Ignored by the engine. */
  note?: string;
};

export type Bed = {
  /** A file under public/assets/music. */
  track: string;
  underSpeech?: number;
  underSilence?: number;
  /** Shot indexes that count as speech. Defaults to every shot with captions. */
  speechShots?: number[];
};

export type ReelSpec = {
  id: string;
  frame: Frame;
  style: Tokens;
  shots: Shot[];
  bed?: Bed;
  /** Checked when the timeline is built, so a long reel fails before it renders. */
  target?: { maxSeconds?: number; minSeconds?: number };
  /** Durations and dimensions written by scripts/ingest.mjs. */
  media?: MediaManifest;
  /** Word timings per media key, written by scripts/transcribe.mjs. */
  words?: Record<string, WordTiming[]>;
};

export type WordTiming = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

export type MediaEntry = {
  key: string;
  /** Path relative to public/, for staticFile(). */
  file: string;
  seconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  /** A repaired audio file to use instead of the clip's own track. */
  cleanAudio?: string;
  /** Seconds to shift the clean audio by, measured by scripts/align.mjs. */
  audioOffset?: number;
  /** Mean channel levels, written by scripts/grade.mjs. Feeds `matchGrade()`. */
  colour?: Colour;
};

export type MediaManifest = Record<string, MediaEntry>;

export const reel = (spec: ReelSpec): ReelSpec => spec;

// ---------------------------------------------------------------------------
// Timeline resolution
// ---------------------------------------------------------------------------

/**
 * One continuous stretch of source that survives into the cut.
 *
 * A shot with no `drop` has exactly one of these, which is why every reader
 * can go through `segments` unconditionally rather than branching on whether
 * this shot was tightened. `sourceStart` is in the source's own seconds;
 * `startFrame` and `frames` are on screen, inside the shot.
 */
export type Segment = { sourceStart: number; startFrame: number; frames: number };

/**
 * The sound under a shot, which is not always the shot's own picture.
 *
 * `own` is the ordinary case — the clip you can see is the clip you can hear,
 * and the video element carries its own track. When it is false the picture is
 * muted and this source is played beneath it instead, which is how a voice
 * continues across a cut to B-roll.
 *
 * `segments` maps that source onto shot-local frames exactly the way a shot's
 * own `segments` do, so captions and playback read one shape either way.
 */
export type Sound = { key: string; own: boolean; segments: Segment[] };

/**
 * Restricts segments to a window of shot-local frames, moving each one's
 * source position by however much was cut off its front.
 *
 * This is what makes a split edit compose with everything else: the window
 * is applied to whatever the shot already resolved to, so a shot that was
 * tightened keeps its drops, and a shot running at `speed` stays in sync.
 */
export const clipSegments = (
  segments: Segment[],
  fromFrame: number,
  toFrame: number,
  fps: number,
  speed: number,
): Segment[] => {
  const out: Segment[] = [];
  for (const s of segments) {
    const start = Math.max(s.startFrame, fromFrame);
    const end = Math.min(s.startFrame + s.frames, toFrame);
    if (end <= start) continue;
    out.push({
      sourceStart: s.sourceStart + ((start - s.startFrame) / fps) * speed,
      startFrame: start,
      frames: end - start,
    });
  }
  return out;
};

export type ResolvedShot = {
  shot: Shot;
  index: number;
  key: string;
  startFrame: number;
  durationInFrames: number;
  /**
   * The parts of the source this shot actually plays, in order, with the
   * dropped ranges already removed. Always at least one entry. Read this
   * rather than `shot.in`/`shot.seconds` anywhere the mapping between source
   * time and screen time matters — captions, playback and verification all
   * go through it, so none of them can disagree about where a word landed.
   */
  segments: Segment[];
  /**
   * What is audible under this shot, and where in each source it is playing.
   * Usually one entry, or none at all under a silent generated clip. A split
   * edit makes it two: the neighbour's sound for part of the shot, this
   * shot's own for the rest.
   */
  sounds: Sound[];
  /**
   * This shot's exit, defaulted from the *next* shot's blend when this shot
   * didn't declare its own. Read this instead of `shot.exit` — an explicit
   * exit always wins, so this only ever fills a gap, never overrides one.
   * Without it, a plain `enter: blend(...)` on the next shot only animates
   * the incoming side, which looks lopsided rather than like one motion.
   */
  effectiveExit?: Exit;
  /**
   * How many of this shot's own final frames the next shot's blend or push
   * covers. Used to fade this shot's own audio out in step with the overlap,
   * so two clips that both carry sound don't clash or double up underneath
   * a visual transition that's otherwise seamless.
   */
  audioFadeOutFrames?: number;
  /**
   * Same overlap, applied to this shot's own captions/title/badge/ribbon
   * instead of its audio. A blend or push crossfades *pictures* — text has no
   * such treatment of its own, so without this the outgoing shot's title
   * stays fully opaque for its whole declared duration while the incoming
   * shot's title fades in on top of it, and for the overlap both are legible
   * and directly overlapping. Fading text out quickly, rather than letting it
   * ride the full picture dissolve, reads as one title replacing another
   * rather than two competing for the same line.
   */
  overlayFadeOutFrames?: number;
};

export type ResolvedHit = { frame: number; sfx: string; volume: number };
export type ResolvedDip = { frame: number; frames: number; to?: number };

/** The source-time range one segment plays, in the source's own seconds. */
export const segmentSource = (segment: Segment, fps: number, speed = 1): Gap => ({
  from: segment.sourceStart,
  to: segment.sourceStart + (segment.frames / fps) * speed,
});

/**
 * How fast the audible source runs under a shot, and which segments it uses.
 *
 * Held sound runs at 1x whatever the picture is doing, so these two travel
 * together — reading one without the other is how captions end up timed to a
 * sped-up screen recording instead of to the voice actually playing.
 */
export const soundTrack = (resolved: ResolvedShot): { segments: Segment[]; speed: number } => {
  const sound = dominantSound(resolved);
  if (sound && !sound.own) return { segments: sound.segments, speed: 1 };
  return { segments: sound?.segments ?? resolved.segments, speed: resolved.shot.speed ?? 1 };
};

/**
 * The sound covering most of this shot.
 *
 * Captions belong to one transcript at a time, and a split edit briefly has
 * two sources playing across one shot. Whichever holds the shot for longer is
 * the one the shot is *about* — a six-frame J-cut does not make the shot
 * belong to the clip it borrowed six frames from.
 */
export const dominantSound = (resolved: ResolvedShot): Sound | undefined => {
  const frames = (s: Sound) => s.segments.reduce((n, seg) => n + seg.frames, 0);
  return [...resolved.sounds].sort((a, b) => frames(b) - frames(a))[0];
};

/**
 * The words this shot actually plays, rebased onto shot-local milliseconds.
 *
 * Anything inside a dropped range is gone, and everything after it moves
 * earlier by exactly what was removed — so captions stay locked to the audio
 * through a tightening pass without the shotlist restating a single timing.
 * A word only partly removed keeps whichever part survives.
 *
 * Every reader of word timings goes through this, which is the point: if it
 * were reimplemented next to the renderer, the two would eventually disagree
 * and the symptom would be captions drifting a few frames late.
 */
export const wordsInShot = (
  resolved: ResolvedShot,
  fps: number,
  words: WordTiming[],
): WordTiming[] => {
  const { segments, speed } = soundTrack(resolved);
  const out: WordTiming[] = [];

  for (const w of words) {
    const startS = w.startMs / 1000;
    const endS = w.endMs / 1000;

    const segment = segments.find((s) => {
      const { from, to } = segmentSource(s, fps, speed);
      return endS > from && startS < to;
    });
    if (!segment) continue;

    const { from, to } = segmentSource(segment, fps, speed);
    const localStartMs = (segment.startFrame / fps) * 1000;
    const toLocal = (ms: number) =>
      localStartMs + ((Math.min(Math.max(ms / 1000, from), to) - from) / speed) * 1000;

    out.push({
      text: w.text,
      startMs: toLocal(w.startMs),
      endMs: toLocal(w.endMs),
      timestampMs: w.timestampMs === null ? null : toLocal(w.timestampMs),
      confidence: w.confidence,
    });
  }

  return out;
};

export type Timeline = {
  shots: ResolvedShot[];
  durationInFrames: number;
  hits: ResolvedHit[];
  dips: ResolvedDip[];
  warnings: string[];
};

const DEFAULT_GEN_SECONDS = 3;

/** A short diagnostic label for a shot — its source, or "bands" when it has none. */
export const shotLabel = (shot: Shot): string => {
  if (shot.src === undefined) return shot.bands ? "bands" : "no source";
  return typeof shot.src === "string" ? shot.src : shot.src.type;
};

/**
 * Sorts ranges and merges any that overlap or touch, discarding empty ones.
 *
 * Doing this before anything is measured is what lets a shotlist concatenate
 * gaps from two different sources — long pauses and filler words — without
 * checking whether an "um" happens to sit inside a pause it already found.
 */
export const mergeGaps = (gaps: Gap[]): Gap[] => {
  const sorted = gaps
    .map((g) => ({ from: Math.min(g.from, g.to), to: Math.max(g.from, g.to) }))
    .filter((g) => g.to > g.from)
    .sort((a, b) => a.from - b.from);

  const out: Gap[] = [];
  for (const g of sorted) {
    const last = out[out.length - 1];
    if (last && g.from <= last.to) last.to = Math.max(last.to, g.to);
    else out.push({ ...g });
  }
  return out;
};

/** What is left of [start, end] once merged gaps are taken out of it. */
const keptRanges = (start: number, end: number, gaps: Gap[]): Gap[] => {
  const out: Gap[] = [];
  let cursor = start;
  for (const g of gaps) {
    const from = Math.max(g.from, start);
    const to = Math.min(g.to, end);
    if (to <= from) continue;
    if (from > cursor) out.push({ from: cursor, to: from });
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) out.push({ from: cursor, to: end });
  return out;
};

const sourceSeconds = (src: Source, media: MediaManifest | undefined): number | null => {
  if (typeof src === "string") {
    const entry = media?.[src];
    return entry ? entry.seconds : null;
  }
  return src.seconds ?? DEFAULT_GEN_SECONDS;
};

/**
 * Turns a spec into frame positions. Durations left unstated are measured from
 * the media manifest — never assumed from a script, which is the single most
 * common cause of a timeline that has to be rebuilt after recording.
 */
export const resolveTimeline = (spec: ReelSpec): Timeline => {
  const { fps } = spec.frame;
  const warnings: string[] = [];
  const hits: ResolvedHit[] = [];
  const dips: ResolvedDip[] = [];
  const shots: ResolvedShot[] = [];

  // Tracks where the *next* shot would start under a plain cut. A blend moves
  // its own startFrame earlier than this without moving anyone else's.
  let cursor = 0;

  // What is currently audible, and how far into it we are. A shot that holds
  // picks this up and carries it forward; a silent shot leaves it alone, so a
  // voice interrupted by B-roll can still be resumed after it.
  let audible: { key: string; sourceEnd: number } | null = null;

  spec.shots.forEach((shot, index) => {
    let seconds = shot.seconds ?? null;

    if (seconds === null) {
      const primary = shot.bands ? shot.bands.regions[0]?.source : shot.src;
      const measured = primary === undefined ? null : sourceSeconds(primary, spec.media);
      if (measured === null) {
        warnings.push(
          `Shot ${index} ("${shotLabel(shot)}") has no measured duration. ` +
            `Run "npm run ingest" for this post, or set seconds explicitly.`,
        );
        seconds = DEFAULT_GEN_SECONDS;
      } else {
        seconds = measured - (shot.in ?? 0);
      }
    }

    // `seconds` keeps the meaning it has always had — time on screen — so a
    // shot carrying `speed` consumes proportionally more of its source across
    // that same stretch, and one without it consumes exactly as much as it
    // shows. Everything below works in source seconds, then converts once.
    const speed = shot.speed ?? 1;
    const inSeconds = shot.in ?? 0;
    const windowEnd = inSeconds + seconds * speed;

    const drops = mergeGaps(shot.drop ?? []);
    if (drops.length > 0) {
      if (shot.bands) {
        warnings.push(
          `Shot ${index} sets \`drop\` alongside \`bands\`. Each region plays its own source, ` +
            `so there is no single timeline to remove ranges from; the drops are ignored.`,
        );
      }
      const outside = drops.filter((g) => g.to <= inSeconds || g.from >= windowEnd);
      if (outside.length === drops.length) {
        warnings.push(
          `Shot ${index} ("${shotLabel(shot)}") drops ${drops.length} range(s), none of which fall ` +
            `inside the ${inSeconds.toFixed(2)}s–${windowEnd.toFixed(2)}s window it plays. ` +
            `Check they were derived from this shot's own source.`,
        );
      }
    }

    const kept = shot.bands ? [{ from: inSeconds, to: windowEnd }] : keptRanges(inSeconds, windowEnd, drops);

    // Frame boundaries accumulate against the running total rather than being
    // rounded one segment at a time, so a long run of short segments cannot
    // drift away from the duration they actually add up to.
    const segments: Segment[] = [];
    let elapsed = 0;
    let frameCursor = 0;
    for (const range of kept) {
      elapsed += (range.to - range.from) / speed;
      const frames = Math.max(1, Math.round(elapsed * fps) - frameCursor);
      segments.push({ sourceStart: range.from, startFrame: frameCursor, frames });
      frameCursor += frames;
    }
    if (segments.length === 0) {
      warnings.push(
        `Shot ${index} ("${shotLabel(shot)}") drops everything it was going to play. ` +
          `Remove the shot, or narrow the ranges in \`drop\`.`,
      );
      segments.push({ sourceStart: inSeconds, startFrame: 0, frames: 1 });
      frameCursor = 1;
    }

    const durationInFrames = Math.max(1, frameCursor);

    let startFrame = cursor;
    if (shot.enter?.kind === "blend" || shot.enter?.kind === "push") {
      const overlapping = shot.enter;
      const previous = shots[shots.length - 1];
      if (!previous) {
        warnings.push(
          `Shot 0 has a ${overlapping.kind} enter, but there is nothing before it to ${overlapping.kind} from. Rendered as a cut.`,
        );
      } else {
        const requested = overlapping.frames;
        // Either move can only overlap as much of either neighbour as
        // actually exists; asking for more just means "as much as this pair
        // allows".
        const overlap = Math.max(0, Math.min(requested, previous.durationInFrames, durationInFrames));
        if (overlap < requested) {
          warnings.push(
            `Shot ${index}'s ${overlapping.kind} asked for ${requested} frames of overlap; clamped to ${overlap}, ` +
              `the shorter of its own length and shot ${previous.index}'s.`,
          );
        }
        startFrame = Math.max(0, cursor - overlap);

        // A blend with no exit on the shot it blends over only animates the
        // incoming side — technically correct, visually lopsided. Default the
        // outgoing side to mirror the same zoom, unless it already has its
        // own exit, which always wins.
        if (overlapping.kind === "blend" && previous.effectiveExit === undefined) {
          previous.effectiveExit = exitPunch({
            to: overlapping.to,
            frames: overlap,
            easing: overlapping.easing,
          });
        }

        // Audio crossfades across the overlap regardless of whether the
        // picture does — two clips' sound clashing underneath a visual
        // transition that's otherwise seamless is the kind of rough edge
        // that reads as amateur even when nobody can say exactly what's wrong.
        // ...unless this shot is carrying that very audio onward, in which
        // case there is nothing to crossfade: it is one continuous take of
        // sound with a picture change over the top of it.
        const carriesOn = shot.audio === "hold" || (shot.audio && "trail" in shot.audio);
        if (!carriesOn) previous.audioFadeOutFrames = overlap;
        // Text gets the same overlap window, but as a hard cut rather than a
        // ramp — see exitOverlayVisible for why a gradual fade can't avoid
        // legible double text here regardless of how it's tuned.
        previous.overlayFadeOutFrames = overlap;
      }
    }

    const overlapFrames = Math.max(0, cursor - startFrame);

    const key = `${index}-${shotLabel(shot)}`;

    if (shot.src === undefined && !shot.bands) {
      warnings.push(`Shot ${index} has neither \`src\` nor \`bands\` — it will render nothing.`);
    }
    // What is audible under this shot, and from where. A shot's own picture is
    // the ordinary answer; carrying a neighbour's sound across the cut — for
    // the whole shot, or for a handful of frames either side of it — is what
    // the three `audio` settings buy.
    const sounds: Sound[] = [];
    const ownKey =
      typeof shot.src === "string" && spec.media?.[shot.src]?.hasAudio ? shot.src : null;

    /** Plays the running source onward from where it stopped, for `frames`. */
    const carryOn = (asked: number, why: string): Sound | null => {
      if (!audible) {
        warnings.push(`Shot ${index} asks to ${why}, but nothing has played yet.`);
        return null;
      }
      // Under a blend or push this shot's picture starts `overlapFrames` early,
      // on top of the previous shot, whose sound is still playing those frames.
      // Carried sound is the same take continuing, so it begins where the
      // previous shot's sound *ends*, not where this shot's picture does —
      // otherwise the overlap plays that stretch of speech twice.
      const offset = Math.min(overlapFrames, asked);
      const frames = asked - offset;
      if (frames <= 0) return null;
      const wanted = frames / fps;
      const total = spec.media?.[audible.key]?.seconds;
      const left = total === undefined ? wanted : Math.max(0, total - audible.sourceEnd);

      if (left < wanted - 1 / fps) {
        warnings.push(
          `Shot ${index} carries "${audible.key}" on, but only ${left.toFixed(2)}s of it remain ` +
            `against the ${wanted.toFixed(2)}s asked for. The rest plays silent.`,
        );
      }

      const playable = Math.min(frames, Math.max(0, Math.round(left * fps)));
      if (playable <= 0) return null;

      const sound: Sound = {
        key: audible.key,
        own: false,
        segments: [{ sourceStart: audible.sourceEnd, startFrame: offset, frames: playable }],
      };
      audible = { key: audible.key, sourceEnd: audible.sourceEnd + playable / fps };
      return sound;
    };

    const trail =
      shot.audio === "hold"
        ? durationInFrames
        : shot.audio && "trail" in shot.audio
          ? Math.max(0, Math.min(Math.round(shot.audio.trail), durationInFrames))
          : 0;

    if (trail > 0) {
      const carried = carryOn(trail, shot.audio === "hold" ? "hold the previous sound" : "trail the previous sound");
      if (carried) sounds.push(carried);
    }

    // Another clip's voice under this whole shot, on this shot's own timeline —
    // so a tightening pass on the shot tightens the voice with it.
    if (shot.audio && typeof shot.audio === "object" && "from" in shot.audio) {
      const from = shot.audio.from;
      if (!spec.media?.[from]?.hasAudio) {
        warnings.push(`Shot ${index} plays the sound of "${from}", which has none or is not in media.json.`);
      } else {
        sounds.push({ key: from, own: false, segments });
        const last = segments[segments.length - 1];
        audible = { key: from, sourceEnd: last.sourceStart + (last.frames / fps) * speed };
      }
    }

    // This shot's own sound picks up wherever the carried sound left off —
    // still locked to its own picture, which is the whole point of a split
    // edit: only the moment of the switch moves, never the sync.
    if (ownKey && trail < durationInFrames) {
      const own = clipSegments(segments, trail, durationInFrames, fps, speed);
      if (own.length > 0) {
        sounds.push({ key: ownKey, own: true, segments: own });
        const last = own[own.length - 1];
        audible = { key: ownKey, sourceEnd: last.sourceStart + (last.frames / fps) * speed };
      }
    }

    // A J-cut reaches backwards: this shot's sound starts early, over the tail
    // of the shot before it, which therefore loses that much of its own.
    const lead =
      shot.audio && typeof shot.audio === "object" && "lead" in shot.audio
        ? Math.max(0, Math.round(shot.audio.lead))
        : 0;

    if (lead > 0) {
      const previous = shots[shots.length - 1];
      const head = segments[0];
      if (!previous) {
        warnings.push(`Shot ${index} leads its sound in, but there is nothing before it to lead over.`);
      } else if (!ownKey) {
        warnings.push(`Shot ${index} leads its sound in, but it has no sound of its own to lead with.`);
      } else {
        const over = Math.min(lead, previous.durationInFrames);
        const early = head.sourceStart - over / fps;

        if (early < 0) {
          warnings.push(
            `Shot ${index} leads ${over} frames of "${ownKey}" in early, but starts only ` +
              `${head.sourceStart.toFixed(2)}s into it — there is not that much before the in-point. ` +
              `Raise \`in\`, or shorten the lead.`,
          );
        } else {
          const cutoff = previous.durationInFrames - over;
          previous.sounds = previous.sounds.flatMap((s) => {
            const kept = clipSegments(s.segments, 0, cutoff, fps, s.own ? (previous.shot.speed ?? 1) : 1);
            return kept.length > 0 ? [{ ...s, segments: kept }] : [];
          });
          previous.sounds.push({
            key: ownKey,
            own: false,
            segments: [{ sourceStart: early, startFrame: cutoff, frames: over }],
          });
        }
      }
    }

    shots.push({
      shot,
      index,
      key,
      startFrame,
      durationInFrames,
      segments,
      sounds,
      effectiveExit: shot.exit,
    });

    if (shot.enter?.kind === "punch" && shot.enter.hit) {
      hits.push({ frame: startFrame, sfx: shot.enter.hit, volume: shot.enter.hitVolume ?? 1 });
    }
    for (const h of shot.hits ?? []) {
      hits.push({ frame: startFrame + Math.round(h.at * fps), sfx: h.sfx, volume: h.volume ?? 1 });
    }
    for (const d of shot.dips ?? []) {
      dips.push({ frame: startFrame + Math.round(d.at * fps), frames: d.frames, to: d.to });
    }

    cursor = startFrame + durationInFrames;
  });

  const totalSeconds = cursor / fps;
  if (spec.target?.maxSeconds && totalSeconds > spec.target.maxSeconds) {
    warnings.push(
      `Runtime is ${totalSeconds.toFixed(1)}s against a ceiling of ${spec.target.maxSeconds}s. ` +
        `Trim ${(totalSeconds - spec.target.maxSeconds).toFixed(1)}s.`,
    );
  }
  if (spec.target?.minSeconds && totalSeconds < spec.target.minSeconds) {
    warnings.push(`Runtime is ${totalSeconds.toFixed(1)}s, under the floor of ${spec.target.minSeconds}s.`);
  }

  return { shots, durationInFrames: Math.max(1, cursor), hits, dips, warnings };
};
