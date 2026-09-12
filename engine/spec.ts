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
export type Push = { kind: "push"; frames: number; direction: "left" | "right" | "up" | "down"; easing?: Easing };

export type Enter = Punch | Cut | BandsOpen | Blend | Push;

export const punch = (o: Omit<Punch, "kind">): Punch => ({ kind: "punch", ...o });
export const cut = (): Cut => ({ kind: "cut" });
export const bandsOpen = (o: Omit<BandsOpen, "kind">): BandsOpen => ({ kind: "bands", ...o });
export const blend = (o: Omit<Blend, "kind">): Blend => ({ kind: "blend", ...o });
export const push = (o: Omit<Push, "kind">): Push => ({ kind: "push", ...o });

/** An exit ramp on the outgoing shot. Pair with an enter punch for a full swap. */
export type Exit = { kind: "punch"; to: number; frames: number; easing?: Easing };
export const exitPunch = (o: Omit<Exit, "kind">): Exit => ({ kind: "punch", ...o });

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
      items: { label: string; value: number; suffix?: string; color?: string }[];
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
  /** Crop a region of the source and scale it to fill. Never scales alone. */
  reframe?: { from: Rect; to?: Rect };
  /**
   * Playback rate for a video source. 1 is native. `seconds` is still the
   * on-screen duration you author explicitly — raising `speed` compresses
   * more of the source's timeline into that same on-screen time, which is
   * how a shot covers its full source window in less runtime without
   * cutting any of it away. Has no effect on a generated source.
   */
  speed?: number;
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
  /** Authored text, not from speech. */
  title?: string | { text: string; top?: number; enterFrames?: number };
  /** A small persistent label. */
  badge?: string | { text: string; bottom?: number };
  /** Extra sound effects at offsets within this shot, in seconds. */
  hits?: { at: number; sfx: string; volume?: number }[];
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
};

export type MediaManifest = Record<string, MediaEntry>;

export const reel = (spec: ReelSpec): ReelSpec => spec;

// ---------------------------------------------------------------------------
// Timeline resolution
// ---------------------------------------------------------------------------

export type ResolvedShot = {
  shot: Shot;
  index: number;
  key: string;
  startFrame: number;
  durationInFrames: number;
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
};

export type ResolvedHit = { frame: number; sfx: string; volume: number };

export type Timeline = {
  shots: ResolvedShot[];
  durationInFrames: number;
  hits: ResolvedHit[];
  warnings: string[];
};

const DEFAULT_GEN_SECONDS = 3;

/** A short diagnostic label for a shot — its source, or "bands" when it has none. */
export const shotLabel = (shot: Shot): string => {
  if (shot.src === undefined) return shot.bands ? "bands" : "no source";
  return typeof shot.src === "string" ? shot.src : shot.src.type;
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
  const shots: ResolvedShot[] = [];

  // Tracks where the *next* shot would start under a plain cut. A blend moves
  // its own startFrame earlier than this without moving anyone else's.
  let cursor = 0;

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

    const durationInFrames = Math.max(1, Math.round(seconds * fps));

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
        previous.audioFadeOutFrames = overlap;
      }
    }

    const key = `${index}-${shotLabel(shot)}`;

    if (shot.src === undefined && !shot.bands) {
      warnings.push(`Shot ${index} has neither \`src\` nor \`bands\` — it will render nothing.`);
    }
    shots.push({ shot, index, key, startFrame, durationInFrames, effectiveExit: shot.exit });

    if (shot.enter?.kind === "punch" && shot.enter.hit) {
      hits.push({ frame: startFrame, sfx: shot.enter.hit, volume: shot.enter.hitVolume ?? 1 });
    }
    for (const h of shot.hits ?? []) {
      hits.push({ frame: startFrame + Math.round(h.at * fps), sfx: h.sfx, volume: h.volume ?? 1 });
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

  return { shots, durationInFrames: Math.max(1, cursor), hits, warnings };
};
