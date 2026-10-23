/**
 * The shotlist contract.
 *
 * A reel is a frame size, a look, and an ordered list of shots. Everything
 * creative is in here as data. The engine's job is to turn this into frames
 * without adding opinions of its own.
 */

import type { Tokens } from "./tokens";
import { nearestBeat, type BeatGrid } from "./beats";
import { rampDuration, rampSource, type RampPoint } from "./ramp";
import { zoomStartFrame, zoomTarget } from "./zoom";

export type Frame = { w: number; h: number; fps: number };

/** A rectangle in *source* pixels. Used to crop before scaling, never after. */
export type Rect = { x: number; y: number; w: number; h: number };

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export type Easing =
  | "linear"
  | "ease"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  /**
   * Overshoots past 1 before settling back — a graphic that lands with a
   * touch of bounce rather than just decelerating into rest. Reach for this
   * on a ribbon, a title accent, or a logo sting; it reads as too playful
   * for a hard cut's own punch, which is why `punch`/`exitPunch` keep their
   * default rather than gaining this as an option.
   */
  | "easeOutBack"
  /** The same overshoot on both ends — a settle, then a small departure. */
  | "easeInOutBack"
  /**
   * Very fast off the mark, then a long, gentle tail into rest — reads as
   * more energetic than the standard `easeOut`, which decelerates evenly
   * throughout. Good for something that should feel like it's snapping into
   * place rather than gliding there.
   */
  | "easeOutExpo";

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


/**
 * A hand-drawn annotation over the picture: a circle round a number, an
 * underline under a line of code, a marker highlight over a button. It draws
 * itself on, holds, and fades.
 *
 * `region` is where on the *frame* to mark — fractions of the output frame's
 * width and height from the top-left, i.e. what the viewer sees after any
 * reframe, not a position in the source file. The engine cannot read a screen
 * recording, so finding the thing to mark (look at a frame) is the author's
 * job; the engine's is making the stroke land on the word that names it:
 * pass `at` from `anchors()`, never a timecode.
 *
 * The stroke (colour, weight, roughness, draw-on length) is the look's, in
 * `Tokens.marks`; what's here is what to mark, where, and when.
 */
export type Mark = {
  kind: "circle" | "underline" | "box" | "highlight" | "bracket" | "strike" | "cross";
  region: { x: number; y: number; w: number; h: number };
  /** Seconds into the shot it starts drawing. Defaults to the shot's first frame. */
  at?: number;
  /** Frames the draw-on takes. Defaults to the look's `marks.frames`. */
  frames?: number;
  /**
   * Seconds it stays fully drawn before fading. Omit and it stays for the rest
   * of the shot.
   */
  hold?: number;
  /** A palette name or a CSS colour. Defaults to the look's `marks.color`. */
  color?: string;
  /**
   * Which hand-drawn variation to use. Strokes are seeded, so the same number
   * always draws the same wobble; change it to get a different take on the
   * same shape.
   */
  seed?: number;
  /** Silence the look's automatic sound for this stroke. */
  silent?: boolean;
};

/**
 * A pointer moving over the picture, with click rings and an optional
 * spotlight — for a screen recording where the viewer has to see *what was
 * clicked* on a phone-sized screen.
 *
 * Positions are fractions of the output frame, like `Mark.region`, and times
 * are seconds into the shot; the engine cannot read the recording, so the
 * author measures where the thing is. Anchor `at` to a spoken word through
 * `anchors()`, not a timecode.
 *
 * Most screen recordings already show a real cursor. Leave `arrow` off and
 * only the click rings and spotlight are drawn, at the points listed;
 * turn it on for a capture with no visible cursor, or a generated source.
 */
export type Pointer = {
  /** Waypoints in time order. The pointer glides between them and holds on the last. */
  path: { at: number; x: number; y: number; click?: boolean }[];
  /** Draw a pointer arrow gliding along the path. Defaults to off. */
  arrow?: boolean;
  /** Dim the rest of the picture around each click, so the eye lands on it. */
  spotlight?: boolean;
  /**
   * Push the picture in toward each click, hold, and ease back out — the
   * screen-recording zoom that makes a small target legible on a phone. `true`
   * uses the look's magnification; a number overrides it for this shot.
   *
   * The picture scales *about the click point*, so the clicked thing stays put
   * while its surroundings grow. A real cursor in the recording scales with it,
   * which is why the drawn `arrow` should stay off here; and `marks` are fixed
   * to the frame, so a mark showing while the picture zooms would slide off its
   * target (`verify.ts` warns about both). Only video is genuinely enlarged:
   * `verify.ts` warns when the zoom would push a source past its native size.
   */
  zoom?: boolean | number;
  /** Silence the look's automatic click/zoom sounds for this shot. */
  silent?: boolean;
};

/**
 * A short, hard emphasis on the picture at one moment: the camera takes a hit
 * (`shake`), the frame blows out and recovers (`flash`), or the picture tears
 * and its colour channels part (`glitch`). For a beat that wants to land
 * physically — a number revealed, a cut that should hurt — not for pacing:
 * used on every line they stop meaning anything.
 *
 * Only the picture moves. Captions, titles and every other overlay stay put,
 * because type that shakes or tears is unreadable and, at the edges, soft.
 * Time one with `at` from `anchors()`; `0` is the shot's first frame, which is
 * how a flash or glitch covers a hard cut. The look sets what each one looks
 * like (`Tokens.impact`); here is only which, when, and how hard.
 */
export type Impact = {
  kind: "shake" | "flash" | "glitch";
  /** Seconds into the shot. Defaults to its first frame. */
  at?: number;
  /** Overrides how long it lasts, in frames. */
  frames?: number;
  /** Multiplies the look's amount. Defaults to 1. */
  strength?: number;
  /** Silence the look's automatic sound for this impact. */
  silent?: boolean;
};

/**
 * A section header at the top of the frame: a small label, a big title, and a
 * line under it that can change as the section goes on. It is the *title* role
 * of the layout (rule 15) with more in it, so a shot carries a header or a
 * `title`, never both. For a listicle ("TOOL 02 of 3") or an explainer ("//
 * how TLS works"). Put the same header on every shot of a section and mark the
 * later ones `continued` so it stays still while the picture below changes.
 */
export type Header = {
  /** The label: "TOOL 02", or a comment like "// how TLS works". */
  kicker?: string;
  /**
   * `"pill"` — a rounded tag, with progress dashes when `step` is set.
   * `"comment"` — monospace, with a blinking caret. Defaults to a pill when
   * `step` is given, else a comment.
   */
  kickerStyle?: "pill" | "comment";
  /** Step n of m, drawn as dashes in the pill. */
  step?: [number, number];
  title?: string;
  /** One line, or a list that swaps at the given seconds into the shot. */
  subtitle?: string | { at: number; text: string }[];
  /** Skip the entrance: this header is carrying on from the shot before. */
  continued?: boolean;
};

/**
 * One big word (or two or three) landing in the middle of the frame on the
 * moment the script names it: the punchline, the number, the verdict. It
 * arrives with a stamp — larger and soft, snapping to size with a small
 * bounce — rests for a beat over a dimmed picture, and goes. A run of them
 * ("NO. CODE. NO. TEST.") is a rhythm in its own right.
 *
 * This is the one place type deliberately scales (rule 9 holds everywhere
 * else): only during the few frames of arrival, ending at exactly 1, so it is
 * never resting on a fractional scale. Captions and titles are untouched. The
 * size is fitted to the frame width from the word's own length, so a short
 * word is big and a long one still fits. Time it with `at` from `anchors()`;
 * the look (`Tokens.slam`) sets the type, the fit, the stamp and the dim.
 */
export type Slam = {
  /** The word(s). A line break splits it over lines; keep it to a few words. */
  text: string;
  /** Seconds into the shot it lands. Defaults to the shot's first frame. */
  at?: number;
  /** Seconds it rests after landing. Defaults to the look's. */
  hold?: number;
  /** A palette name or CSS colour for this word. Defaults to the look's. */
  color?: string;
  /** Vertical centre as a fraction of frame height, for this word only. */
  centre?: number;
  /** Silence the look's automatic sound for this slam. */
  silent?: boolean;
};

// ---------------------------------------------------------------------------
// Generated sources
// ---------------------------------------------------------------------------

/**
 * A small illustrative mockup drawn above a node's label instead of leaving
 * the card as text-only. Line-art in the look's accent colour, drawn to sit
 * inside the same card shell every other node uses, so a band mixing plain
 * and illustrated nodes still reads as one system rather than two different
 * generators. Two families: UI-state mockups (a disabled button, a checkout
 * card — for a script naming a specific interface behaviour), and a general
 * icon set (for a script naming a plain concept: done, blocked, a warning,
 * a trend) that has no reason to be tied to any one kind of UI.
 */
export type DiagramVisual =
  | "button"
  | "spinner"
  | "debounce"
  | "checkout"
  | "receipt"
  | "booking"
  | "check"
  | "cross"
  | "arrow-right"
  | "star"
  | "lock"
  | "warning"
  | "info"
  | "trend-up"
  | "phone"
  | "bluetooth"
  | "map-pin"
  | "key"
  | "cloud"
  | "document"
  | "globe"
  | "image"
  | "eye-off"
  | "server"
  | "sparkle"
  | "shield"
  | "user"
  | "clock"
  | "database"
  | "play"
  | "terminal"
  | "network"
  | "laptop"
  | "rack"
  | "hacker";

export type DiagramNode = {
  id: string;
  label: string;
  sub?: string;
  color?: string;
  /**
   * One of the built-in mockups/icons above, or a custom mark — a logo, a
   * brand icon, anything not already covered — as `{ src: "assets/..." }`,
   * a path under public/. A custom image is drawn at the same size and
   * position the built-in icons use, so swapping one for the other moves
   * nothing else in the layout. `{ lottie: "assets/..." }` plays an imported
   * Lottie animation there, starting when the node arrives; it keeps the
   * colours it was drawn with, which a look cannot change.
   */
  visual?: DiagramVisual | { src: string } | { lottie: string; loop?: boolean };
};
/**
 * One trip of a dot along an arrow, from the edge's `from` node to its `to`
 * node — the data going somewhere. The arrow has to be showing (both its nodes
 * on screen) for the dot to be drawn. A round trip is two trips on the same
 * edge, the second starting after the first ends.
 */
export type Travel = {
  /** Seconds into the shot it sets off. Pin it to the word that names it. */
  at: number;
  /** How long the trip takes. Defaults to the look's `packet.seconds`. */
  seconds?: number;
  /** A small tag riding with the dot, like `?data=…`. */
  label?: string;
  /** A palette name or CSS colour for this trip. Defaults to the look's. */
  color?: string;
};
export type DiagramEdge = { from: string; to: string; label?: string; travel?: Travel[] };

/** A step the generator advances to, optionally pinned to a spoken word. */
export type Step = { at?: number; show: string[] };

/** One line of a `rows` clip. */
export type Row = {
  icon?: SceneKind;
  title: string;
  /** A second line in monospace: a duration, an error, a value. */
  sub?: string;
  /** Drawn at the right: a tick, a warning, a cross, or a clock for "working". */
  status?: "check" | "warn" | "error" | "pending";
  /** A name from the look's `scene.tones`, a palette name, or a CSS colour. */
  tone?: string;
  /** Seconds the row arrives. Defaults to a stagger after the one before. */
  at?: number;
};

/** A plain icon (not a UI mockup) — the glyphs a `scene` can place. */
export type SceneKind = Exclude<DiagramVisual, "button" | "spinner" | "debounce" | "checkout" | "receipt" | "booking">;

/** One thing standing in a `scene`: a glowing wireframe glyph at a place in the frame. */
export type SceneItem = {
  id: string;
  kind: SceneKind;
  /** The small monospace caption under it: "CLIENT", "SERVER", "OBSERVER". */
  label?: string;
  /** Centre, as fractions of the frame. */
  x: number;
  y: number;
  /** Width as a fraction of frame width. Defaults to the look's. */
  size?: number;
  /** A name from the look's `scene.tones` ("client", "server", "threat"), a palette name, or a CSS colour. */
  tone?: string;
  /** Seconds into the shot it appears, drawing itself on. Defaults to the start. */
  at?: number;
  /** Seconds it leaves. Omit and it stays. */
  until?: number;
};

/** A line between two items, optionally carrying dots. */
export type SceneLink = {
  from: string;
  to: string;
  style?: "dotted" | "solid";
  /** Seconds it appears. Defaults to when both ends have. */
  at?: number;
  until?: number;
  tone?: string;
  /** Dots riding it, from `from` to `to` — the same trips as on a diagram arrow. */
  travel?: Travel[];
};

/** A line of monospace text in a `scene`: a value caught on the wire, a thought. */
export type SceneNote = {
  text: string;
  /** Sits above this item. Or give `x`/`y` (fractions of the frame) instead. */
  near?: string;
  x?: number;
  y?: number;
  at: number;
  until?: number;
  tone?: string;
  /** Characters per second to type it in. 0 or absent fades it in whole. */
  typeSpeed?: number;
};

/** One message in a `chat` clip. */
export type ChatMessage = {
  from: "user" | "ai";
  text: string;
  /** Seconds into the shot the bubble arrives. Defaults to the start. */
  at?: number;
  /**
   * An image slot in an AI reply that asks before it loads — the click-to-load
   * placeholder: a picture icon, "Load image from {host}?" and a button. The
   * button is pressed at `pressAt`, and `outcome` says what happens next.
   */
  image?: {
    host: string;
    /** Replaces the default "Load image from {host}?". */
    prompt?: string;
    /** Seconds the slot appears. Defaults to just after the bubble. */
    at?: number;
    /** Seconds the button is pressed. Omit and it waits, unpressed. */
    pressAt?: number;
    /** What the press does: load the image, or refuse it. Defaults to loaded. */
    outcome?: "loaded" | "blocked";
  };
  /**
   * Buttons under the reply — an approval prompt, a confirmation. One may be
   * pressed at `pressAt`; the others dim.
   */
  buttons?: { label: string; kind?: "primary" | "danger" | "neutral"; pressAt?: number }[];
};

export type GenSpec =
  | {
      /**
       * A list of rows landing one by one — an icon tile, a title, a monospace
       * second line and a status mark — for "what you get": a tool's features,
       * the contents of a bug report, the steps of a process. Rows arrive on
       * their `at` (pin each to the word that names it), or a stagger apart when
       * `at` is left out. An optional `frame` puts a browser bar above them,
       * with an address and a small badge (an extension's icon, say).
       */
      type: "rows";
      rows: Row[];
      frame?: { url: string; badge?: string };
      seconds?: number;
    }
  | {
      /**
       * A stage for "how it works" explainers: glowing wireframe things placed
       * in the frame (a laptop, a server rack, a hooded observer), dotted links
       * between them, dots riding the links, and monospace notes that appear and
       * change — the client sends a password, an observer reads it, TLS turns it
       * into `9c1f 7a0e…`. Things draw themselves on when they arrive (`at`), so
       * the scene builds as the voice explains it, and leave (`until`) when the
       * story moves on. Positions are fractions of the frame; colours come from
       * the look's `scene.tones`.
       */
      type: "scene";
      items: SceneItem[];
      links?: SceneLink[];
      notes?: SceneNote[];
      seconds?: number;
    }
  | {
      /**
       * A chat window: user and AI bubbles arriving in order, with an optional
       * click-to-load image slot or approval buttons inside an AI reply. For
       * showing a safeguard as the real interface rather than as code — an
       * assistant asking before it loads a remote image, an approval prompt.
       * Colours and type come from the look's palette; there is nothing to
       * configure beyond the content.
       */
      type: "chat";
      messages: ChatMessage[];
      seconds?: number;
    }
  | {
      /**
       * A plain web page in a browser frame with text that is there but
       * cannot be seen — until a scan sweeps down the page and reveals it.
       * "An attacker hid a note in invisible text", shown literally. `lines`
       * are the visible paragraphs; `hidden` is the concealed sentence, placed
       * after line `hiddenAfter` (the last by default). The scan starts at `at`
       * seconds and takes `sweep` seconds; what it has passed stays revealed.
       */
      type: "page";
      url: string;
      title?: string;
      lines: string[];
      hidden: string;
      hiddenAfter?: number;
      at?: number;
      sweep?: number;
      seconds?: number;
    }
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
      /**
       * Size the cards from what is written on them, not from fixed fractions
       * of the frame. A label that wraps makes its card taller instead of
       * spilling out of it, an oversize word shrinks the type (never below 75%),
       * the icon keeps its size, and a row's `window` cards fit inside the
       * frame instead of running off both edges. Off by default, so a diagram
       * cut before this renders exactly as it did.
       */
      fit?: boolean;
      seconds?: number;
    }
  | {
      type: "code";
      code: string;
      language?: string;
      /**
       * `"shiki"` highlights with a real grammar (any language Shiki knows,
       * coloured from the look's palette) and unlocks `states`. `"simple"` — the
       * default, so a reel cut earlier renders as it did — is the small built-in
       * highlighter. Prefer `"shiki"` for new reels and name the `language`.
       */
      highlighter?: "simple" | "shiki";
      /**
       * Later versions of the snippet, each reached at `at` seconds by morphing
       * the code you already have: tokens that survive glide to their new
       * place, new ones fade in, removed ones fade out — so the viewer sees
       * *what changed*, which two swapped screenfuls of code never show. `code`
       * is the first version. Needs `highlighter: "shiki"`.
       */
      states?: { at: number; code: string }[];
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
      /**
       * `counter`/`bars` treat each item as its own independent quantity —
       * each can carry its own colour. `line`/`area` treat the whole list as
       * one series in order, plotted against `label` on the x-axis: a trend
       * ("usage over time," "before vs after" as more than two points), not
       * a set of named figures. A series has one colour, from its first
       * item; per-point colour is what `counter`/`bars` are for.
       */
      style?: "counter" | "bars" | "line" | "area";
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
       * An imported Lottie animation — an animated check, a burst, a loader —
       * centred in the frame at the look's size (`Tokens.lottie`). `src` is a
       * `.json` under public/. It plays from the start of the shot and, unless
       * `loop` is false, repeats to fill it; set `seconds` to what the shot
       * needs, since the file's own length is not measured for you. A Lottie
       * keeps its own colours — a look cannot recolour it. Check the licence
       * of any file you did not draw: most free Lottie libraries differ per file.
       */
      type: "lottie";
      src: string;
      loop?: boolean;
      seconds?: number;
    }
  | {
      /**
       * A dotted "thinking" orb for the line that says an AI is working,
       * searching or listening and there is nothing real to show. `state`
       * picks the motion: `working` (particles on tilted orbits), `searching`
       * (a scan sweeping a dotted globe), `listening` (rings pushed like a
       * waveform), `connecting` (a constellation wiring itself together) or
       * `breathing` (a ring that swells and settles). `reactToSpeech` makes it
       * pulse with whatever voice is audible under this shot — pair it with
       * `audio: "hold"` or `audio: { from }`. Colour, size, dot size, density
       * and spin are the look's, in `Tokens.orb`.
       */
      type: "orb";
      state: "working" | "searching" | "listening" | "connecting" | "breathing";
      reactToSpeech?: boolean;
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
      /**
       * A slow push across the whole shot: the picture scales from `from`
       * (default 1) to `to`, eased in and out, about the point `x`, `y` (fractions
       * of the picture, default the centre). It never starts or stops with a jolt.
       * Keep `to` modest (1.05-1.12): the aim is life, not a zoom you notice.
       */
      push?: { to: number; from?: number; x?: number; y?: number };
      /**
       * Show the whole picture as a floating card (the look's `card`: rounded,
       * shadowed, over a blurred copy of itself) at its own aspect, instead of
       * cropping it to fill the frame. For a screenshot or a diagram whose edges
       * matter. `true` uses the look's placement; give `width` or `top` (fractions
       * of the frame) to override it. A `push` then happens inside the card.
       */
      card?: boolean | { width?: number; top?: number };
      /**
       * Show the picture as a page in a browser window: a bar with the address,
       * the picture below it, over the look's own background (`Tokens.window`).
       * For a screenshot of an article, a repo, a post — the thing the script is
       * about, as the viewer would meet it. `true` is a bar with no address;
       * `{ url }` writes one. A picture taller than the window allows is not
       * shrunk: it scrolls (`scroll`). Replaces `card`.
       */
      window?: boolean | { url?: string; badge?: string };
      /**
       * Scroll down a picture taller than its window, across the whole shot,
       * eased. `from` and `to` are fractions of how far there is to go (default
       * 0 to 1, the whole page). Ignored when the picture fits. Time a scroll's
       * *end* to a word by choosing the shot's length, not by guessing.
       */
      scroll?: { from?: number; to?: number };
      /**
       * Hand-drawn marks on the picture. Unlike `Shot.marks`, `region` is in
       * fractions of the *picture* (measure on the screenshot itself), and the
       * mark travels with it through a scroll or a push, so it stays on what it
       * marks. Same kinds, same timing, same look (`Tokens.marks`).
       */
      marks?: Mark[];
      seconds?: number;
    };

export type Source = string | GenSpec;

/**
 * Every mark a shot draws: its own (fractions of the frame) and those on a
 * screenshot it shows (fractions of the picture). For anything that counts or
 * times them — sounds, pacing — where *which* space they are in is no matter.
 */
export const allMarks = (shot: Shot): Mark[] => [
  ...(shot.marks ?? []),
  ...(typeof shot.src === "object" && shot.src.type === "image" ? (shot.src.marks ?? []) : []),
];

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
   * A rate that changes *within* the shot: keyframes of `{ at, speed }`, `at`
   * in seconds on screen. The speed eases between keyframes and holds the
   * first before it and the last after it — race through a build log at 4x,
   * ease down to 1x to land on the line that matters. Replaces `speed` for
   * this shot (setting both warns).
   *
   * `seconds` is still on-screen time; leave it out and the length is
   * measured from the file by finding when the ramp has consumed the whole
   * source window. A ramped shot has no sound of its own — a voice pitched
   * and warped by a changing rate is never wanted — so bring one in with
   * `audio: "hold"` or `audio: { from }`, which plays at its natural rate.
   * Drops and `bands` don't compose with it and are ignored with a warning.
   * Footage slowed below about half speed repeats source frames; no ramp
   * invents the in-between ones.
   */
  speedRamp?: RampPoint[];
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
  emphasis?: string[] | Record<string, string[]>;
  /**
   * Which caption look this shot's words use. `"caption"` (the default) is the
   * bottom caption; `"headline"` is the look's big, word-by-word headline
   * (`Tokens.headline`) — the voice written across the top of the frame as it
   * is spoken, for a reel with nobody on screen.
   */
  captionStyle?: "caption" | "headline";
  /**
   * A colour that belongs to this section: the backdrop's accent glow, the
   * header's label and dashes, and a caption box set to `"accent"` all follow
   * it. A palette name or a CSS colour; defaults to the look's accent.
   */
  accent?: string;
  /**
   * Soft glow behind a *generated* clip, in the look's backdrop style, tinted by
   * `accent`. A video covers it, so it does nothing over footage (`verify.ts`
   * warns). Keeps drifting across cuts, so shots of one section share a glow.
   */
  backdrop?: boolean;
  /** A section header: label, title, and a subtitle that can change. See `Header`. */
  header?: Header;
  /** Authored text, not from speech. */
  title?: string | { text: string; top?: number; enterFrames?: number };
  /** A small persistent label. */
  badge?: string | { text: string; bottom?: number };
  /** A banner that flies in and lands. Motion graphics, not type. */
  ribbon?: Ribbon;
  /**
   * Hand-drawn annotations over the picture — see `Mark`. Unlike every other
   * overlay these point at something *in* the frame, so they are not subject to
   * the safe-zone gate; `verify.ts` only checks they fit in the frame and that
   * the look defines a `marks` style.
   */
  marks?: Mark[];
  /**
   * A pointer, click rings and optional spotlight over the picture — see
   * `Pointer`. Like `marks`, it points at something *in* the frame, so the
   * safe-zone gate does not apply; `verify.ts` checks positions and the look.
   */
  pointer?: Pointer;
  /**
   * Key words that land big in the centre of the frame on a spoken beat — see
   * `Slam`. The picture behind is dimmed while one is up; captions stay where
   * they are, above the dim.
   */
  slams?: Slam[];
  /**
   * Shake, flash or glitch the picture at a moment — see `Impact`. Overlays
   * are not touched.
   */
  impacts?: Impact[];
  /**
   * Present the picture as a floating card — rounded, shadowed, over a blurred
   * copy of itself — instead of edge to edge. The look for a screen recording:
   * a 16:9 capture in a 9:16 frame otherwise has to be cropped hard or sit in
   * dead bars. The card takes the aspect of what it shows (the reframe's
   * `from`, or the whole source), at the look's width and height limit.
   * `true` uses the look's placement; give `width` or `top` (fractions of the
   * frame) to override it for this shot. Overlays, marks and the pointer are
   * still positioned against the *frame*, not the card. Needs `Tokens.card`
   * and a single source — it does nothing on a banded shot.
   */
  card?:
    | boolean
    | {
        width?: number;
        top?: number;
        /**
         * The 3D swing: `false` keeps this card flat; `{ x, y }` (degrees)
         * starts it turned that far instead of the look's angles and eases it
         * flat. Turn alternate cards opposite ways (`y` positive, then
         * negative) so a run of them doesn't all swing the same way. Marks and
         * pointer positions are measured on the flat frame, so they line up
         * only once the card has settled — `verify.ts` warns if one lands first.
         */
        tilt?: false | { x?: number; y?: number };
      };
  /**
   * A name/role identification card — who is on screen, quieter than a
   * `ribbon`. Shares the badge's zone: `verify.ts` fails a shot carrying
   * both. `at` is seconds into the shot it arrives; omit `hold` to keep it
   * up for the rest of the shot, the usual choice for introducing a speaker.
   */
  lowerThird?: { name: string; role?: string; at?: number; hold?: number; frames?: number };
  /**
   * Extra sound effects at offsets within this shot, in seconds. `onBeat`
   * nudges `at` to whichever real beat falls nearest it instead of playing
   * at exactly the second written — needs `ReelSpec.beatGrid` and `bed` both
   * set, and only reaches as far as this shot's own frames; either missing,
   * and it plays at its own `at` with a warning explaining why.
   *
   * A hit ducks the music bed for a few frames so it lands clear. `duck: false`
   * turns that off for a small sound (a tap, a tick) that sits fine on top of
   * the music — a run of them would otherwise pump the bed in time with
   * themselves.
   */
  hits?: { at: number; sfx: string; volume?: number; onBeat?: boolean; duck?: boolean }[];
  /**
   * Duck the music bed to near-silence for `frames` frames, `at` seconds into
   * this shot. A `hit` already ducks the bed for a moment as a side effect;
   * this is the dip on its own, with no sound effect, for a beat that wants
   * the music out of the way for as long as a word takes to land. `to`
   * overrides the look's `mix.dipTo`. `onBeat` snaps `at` the same way it
   * does on a hit.
   */
  dips?: { at: number; frames: number; to?: number; onBeat?: boolean }[];
  /** Anything you want to read back later. Ignored by the engine. */
  note?: string;
};

export type Bed = {
  /** A file under public/assets/music. */
  track: string;
  /**
   * Seconds into the track file to start reading from — the file's own
   * timeline, not the reel's. File offset 0 is wherever a stock track
   * happens to begin, usually a quiet intro built for a loop point, not for
   * landing on a reel's hook. `npm run beats <track>` finds real candidates:
   * a beat grid, and the moments the track's own energy settles into a
   * sustained run above its intro/outro level. Combine with `startShot` so
   * the moment picked lands on the frame the music actually enters on.
   */
  trackIn?: number;
  underSpeech?: number;
  underSilence?: number;
  /** Shot indexes that count as speech. Defaults to every shot with captions. */
  speechShots?: number[];
  /**
   * Index of the shot the music comes in on. The track starts from its own
   * beginning on that shot's first frame and is silent before it. Omit and it
   * plays from the reel's first frame.
   */
  startShot?: number;
  /** Frames the music takes to come up at `startShot`. Defaults to 6, enough to avoid a click. */
  fadeInFrames?: number;
  /**
   * Index of the shot the music starts fading out on, ramping to silence over
   * `fadeOutFrames`. Omit and only the reel's closing tail fade applies.
   */
  fadeOutShot?: number;
  /** Frames that fade takes. Defaults to the look's `mix.tailFade`. */
  fadeOutFrames?: number;
};

export type ReelSpec = {
  id: string;
  frame: Frame;
  style: Tokens;
  shots: Shot[];
  bed?: Bed;
  /**
   * Let a shot carry captions and a badge together. Off by default, and
   * `verify.ts` fails the reel while it is: the lower third is one zone and two
   * things in it usually read as a mistake. Set it when the look keeps them
   * apart on purpose (the badge sits just above the caption band) and the
   * reel wants both on the same shot.
   */
  allowCaptionsWithBadge?: boolean;
  /** Checked when the timeline is built, so a long reel fails before it renders. */
  target?: { maxSeconds?: number; minSeconds?: number };
  /** Durations and dimensions written by scripts/ingest.mjs. */
  media?: MediaManifest;
  /** Word timings per media key, written by scripts/transcribe.mjs. */
  words?: Record<string, WordTiming[]>;
  /**
   * The `bed.track`'s tempo and phase, written by `npm run beats <track>` to
   * `<track>.beats.json` next to the file. Import it the same way `media`/
   * `words` come in once their own stage has run — uncomment the line, no
   * different from any other optional per-machine file. A shot's `hits` or
   * `dips` reads this (with `onBeat: true`) to land on the music instead of
   * wherever its own `at` falls; `npm run beatcheck <post>` reports how far
   * every shot's own cut sits from the nearest beat too, for the moves this
   * can't safely nudge on its own — a cut is anchored to a measured duration
   * or a spoken word, never to music.
   */
  beatGrid?: BeatGrid;
  /**
   * One extra still, alongside the reel itself — a feed thumbnail.
   * `npm run thumbnail <post>` renders it. It reuses the exact picture
   * pipeline a real shot uses (crop, grade, scale), so it can never drift
   * from what the reel actually looks like the way a separately-composed
   * image would.
   */
  thumbnail?: ThumbnailSpec;
};

export type ThumbnailSpec = {
  /** Index into `shots` (0-based) — which shot's picture to freeze on. */
  shot: number;
  /**
   * Seconds into that shot to freeze at. Defaults to 0.8s: late enough that
   * a title's own entrance animation (a few frames) has settled, early
   * enough to still be near the shot's own start.
   */
  at?: number;
  /**
   * Overrides the shot's own title text for the thumbnail specifically.
   * Falls back to that shot's `title`, if it has one; a thumbnail with
   * neither shows the picture alone.
   */
  text?: string;
  /**
   * Overrides the shot's own crop for the thumbnail specifically. A still
   * viewed small in a feed can afford to sit tighter on the subject than
   * the crop that shot uses while playing — build it with `regionAt` the
   * same way any other shot's `reframe` is built. Falls back to that shot's
   * own `reframe`, or no crop at all if it has none.
   */
  reframe?: { from: Rect; to?: Rect };
  /**
   * Word(s) from `text` (or the shot's own title, whichever applies) to
   * render in the look's thumbnail-emphasis colour — the two or three words
   * actually carrying the cover's claim, the same standing-choice idea
   * `Shot.emphasis` already is for captions. Matched case-insensitively,
   * punctuation stripped; a word that never occurs is silently inert.
   */
  emphasize?: string[];
  /**
   * Overrides `Tokens.thumbnail.top` for this reel specifically. The look's
   * own default is centred for an average frame, but where the chosen shot
   * puts the subject's head is a fact about that footage, not the channel —
   * a tighter crop that clears background clutter can leave less (or more)
   * headroom above it than another reel's does.
   */
  top?: number;
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

/**
 * Whether a shot's `speedRamp` can actually be played: present, every
 * keyframe a positive rate, and not on a banded shot. An unusable ramp is
 * left alone here — `verify.ts` is what says why — rather than fed to the
 * duration solver, which a zero speed would send nowhere.
 */
const usableRamp = (shot: Shot): boolean =>
  Boolean(shot.speedRamp && shot.speedRamp.length > 0 && !shot.bands && shot.speedRamp.every((p) => p.speed > 0));

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

export type ResolvedHit = { frame: number; sfx: string; volume: number; duck?: boolean };
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

  /**
   * The nearest beat-aligned frame to `frame`, or null when there's nothing
   * to snap to yet — no `beatGrid`, no `bed`, or a moment before the bed's
   * own `startShot` even starts playing. `bed.trackIn` is the track-file
   * second the bed's `startShot` begins on, so any later frame converts to a
   * track-file second the same way, gets pulled to the nearest beat, and
   * converts back.
   */
  const snapToBeat = (frame: number): number | null => {
    const beatGrid = spec.beatGrid;
    const bed = spec.bed;
    if (!beatGrid || !bed) return null;
    const bedStartFrame = shots[bed.startShot ?? 0]?.startFrame;
    if (bedStartFrame === undefined || frame < bedStartFrame) return null;
    const trackIn = bed.trackIn ?? 0;
    const trackSeconds = trackIn + (frame - bedStartFrame) / fps;
    const snapped = nearestBeat(beatGrid, trackSeconds);
    return bedStartFrame + Math.round((snapped - trackIn) * fps);
  };

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
      } else if (typeof primary === "object") {
        // A generated clip states its own length. `in` on such a shot is where
        // a borrowed voice (`audio: { from }`) starts reading, not a point to
        // trim the clip from — subtracting it would shrink a 5s diagram that
        // sits over seconds 6–11 of a voiceover to nothing.
        seconds = measured;
      } else if (usableRamp(shot)) {
        // A ramp with no `seconds`: find when it has consumed the whole window.
        seconds = rampDuration(shot.speedRamp!, measured - (shot.in ?? 0));
      } else {
        seconds = measured - (shot.in ?? 0);
      }
    }

    // `seconds` keeps the meaning it has always had — time on screen — so a
    // shot carrying `speed` consumes proportionally more of its source across
    // that same stretch, and one without it consumes exactly as much as it
    // shows. Everything below works in source seconds, then converts once.
    const ramp = usableRamp(shot) ? shot.speedRamp! : null;
    if (shot.speedRamp && shot.speedRamp.length > 0) {
      if (shot.bands) {
        warnings.push(`Shot ${index} sets \`speedRamp\` alongside \`bands\`. Each region plays its own source; the ramp is ignored.`);
      }
      if (ramp && shot.speed !== undefined) {
        warnings.push(`Shot ${index} sets both \`speed\` and \`speedRamp\`. The ramp replaces it; \`speed\` is ignored.`);
      }
      if (ramp && shot.drop && shot.drop.length > 0) {
        warnings.push(`Shot ${index} sets \`drop\` alongside \`speedRamp\`. A ramp has no single rate to close a gap at; the drops are ignored.`);
      }
    }
    // Under a ramp, `speed` is 1 everywhere below: borrowed sound plays at its
    // natural rate, and the picture's own rate is the ramp's business alone.
    const speed = ramp ? 1 : (shot.speed ?? 1);
    const inSeconds = shot.in ?? 0;
    const windowEnd = ramp ? inSeconds + rampSource(ramp, seconds) : inSeconds + seconds * speed;

    const drops = ramp ? [] : mergeGaps(shot.drop ?? []);
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
    // A ramped shot is one stretch of source whose on-screen length is `seconds`
    // exactly — the ramp, not a division by a constant rate, sets the mapping.
    for (const range of ramp ? [] : kept) {
      elapsed += (range.to - range.from) / speed;
      const frames = Math.max(1, Math.round(elapsed * fps) - frameCursor);
      segments.push({ sourceStart: range.from, startFrame: frameCursor, frames });
      frameCursor += frames;
    }
    if (ramp) {
      frameCursor = Math.max(1, Math.round(seconds * fps));
      segments.push({ sourceStart: inSeconds, startFrame: 0, frames: frameCursor });
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
    // A banded shot has no single `src`, but one region is usually the same
    // take still talking, played live inside `Bands` — that region's key is
    // this shot's "own" audio the same way `shot.src` is for an ordinary one,
    // so a `hold` on the *next* shot resumes from it instead of falling back
    // to whatever played before this band and replaying it.
    const bandAudioKey = shot.bands?.regions.find(
      (region): region is BandSpec & { source: string } =>
        typeof region.source === "string" && Boolean(spec.media?.[region.source]?.hasAudio),
    )?.source;
    // A ramped shot has no sound of its own: a rate that keeps changing would
    // warp it, so what is audible under it is whatever `audio` borrows.
    const ownKey = ramp
      ? null
      : shot.bands
        ? (bandAudioKey ?? null)
        : typeof shot.src === "string" && spec.media?.[shot.src]?.hasAudio
          ? shot.src
          : null;
    if (ramp && typeof shot.src === "string" && spec.media?.[shot.src]?.hasAudio && !shot.audio) {
      warnings.push(
        `Shot ${index} ("${shot.src}") ramps its speed, so its own sound is dropped. ` +
          `Use \`audio: "hold"\` or \`audio: { from }\` to put a voice under it.`,
      );
    }

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

    // `onBeat` only ever nudges a hit or dip within the shot that asked for
    // it — never onto a neighbour's frames, which would mean a sound firing
    // before or after the picture it belongs to.
    const onBeatFrame = (asked: number, label: string): number => {
      const snapped = snapToBeat(asked);
      if (snapped === null) {
        warnings.push(
          `Shot ${index}'s ${label} asks to land on a beat, but there's no beatGrid and bed both ` +
            `active yet to snap to. Playing at its own \`at\` instead.`,
        );
        return asked;
      }
      if (snapped < startFrame || snapped >= startFrame + durationInFrames) {
        warnings.push(
          `Shot ${index}'s ${label} would snap to a beat outside this shot's own frames. ` +
            `Playing at its own \`at\` instead.`,
        );
        return asked;
      }
      return snapped;
    };

    for (const h of shot.hits ?? []) {
      const asked = startFrame + Math.round(h.at * fps);
      const frame = h.onBeat ? onBeatFrame(asked, `hit "${h.sfx}"`) : asked;
      hits.push({ frame, sfx: h.sfx, volume: h.volume ?? 1, duck: h.duck });
    }
    for (const d of shot.dips ?? []) {
      const asked = startFrame + Math.round(d.at * fps);
      const frame = d.onBeat ? onBeatFrame(asked, "dip") : asked;
      dips.push({ frame, frames: d.frames, to: d.to });
    }

    // Sounds the look plays on its own when something happens on screen. They
    // are ordinary hits by the time they leave here, placed from the same
    // frames the picture uses, so a ring and its tap cannot drift apart.
    // Clamped into the shot: an auto-zoom starts easing in before its click,
    // and on a click in the shot's first moments that is before frame 0.
    const events = spec.style.sounds;
    if (events) {
      const fire = (kind: keyof typeof events, atFrame: number) => {
        const e = events[kind];
        if (!e) return;
        const frame = Math.min(startFrame + durationInFrames - 1, Math.max(startFrame, atFrame));
        hits.push({ frame, sfx: e.sfx, volume: e.volume ?? 1, duck: e.duck ?? false });
      };
      if (shot.pointer && !shot.pointer.silent) {
        const zoomStyle = spec.style.pointer?.zoom;
        const zooming = spec.style.pointer ? zoomTarget(shot.pointer, spec.style.pointer) !== null : false;
        // Two clicks close together are one continuous camera move — the zoom
        // glides from one target to the next without easing out — so the sound
        // of zooming plays once, for the first, not again for each.
        let zoomedUntil = -Infinity;
        for (const p of [...shot.pointer.path].sort((a, b) => a.at - b.at)) {
          if (!p.click) continue;
          const clickFrame = Math.round(p.at * fps);
          fire("click", startFrame + clickFrame);
          if (zooming && zoomStyle) {
            const start = zoomStartFrame(clickFrame, zoomStyle);
            if (start >= zoomedUntil) fire("zoom", startFrame + start);
            zoomedUntil = clickFrame + zoomStyle.holdFrames + zoomStyle.outFrames;
          }
        }
      }
      for (const m of allMarks(shot)) {
        if (!m.silent) fire("mark", startFrame + Math.round((m.at ?? 0) * fps));
      }
      for (const sl of shot.slams ?? []) {
        if (!sl.silent) fire("slam", startFrame + Math.round((sl.at ?? 0) * fps));
      }
      for (const i of shot.impacts ?? []) {
        if (!i.silent) fire(i.kind, startFrame + Math.round((i.at ?? 0) * fps));
      }
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
