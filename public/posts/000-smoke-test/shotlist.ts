import { blend, exitPunch, push, punch, reel } from "../../../engine/spec";
import tokens from "../../../projects/default/tokens";
import config from "./post.json";

/**
 * The smoke test.
 *
 * Uses only generated sources, so it renders on a clean checkout with no
 * footage, no transcript and no sound effects. If this produces an MP4, the
 * whole chain works. Delete it once you have real posts, or keep it as the
 * thing you run after changing the engine.
 */
export default reel({
  id: "000-smoke-test",
  frame: config.frame,
  target: config.target,
  style: tokens,

  shots: [
    {
      src: {
        type: "data",
        style: "counter",
        items: [{ label: "every move is a parameter", value: 11, suffix: "" }],
        seconds: 2.5,
      },
      title: "The engine knows how to edit.",
      note: "Opening card. Title is authored text, not from speech.",
    },

    {
      src: {
        type: "diagram",
        layout: "row",
        window: 2,
        nodes: [
          { id: "ingest", label: "Ingest", sub: "measure" },
          { id: "cut", label: "Shotlist", sub: "decide" },
          { id: "compose", label: "Compose", sub: "render" },
        ],
        edges: [
          { from: "ingest", to: "cut" },
          { from: "cut", to: "compose" },
        ],
        steps: [
          { at: 0, show: ["ingest"] },
          { at: 1.4, show: ["ingest", "cut"] },
          { at: 2.8, show: ["cut", "compose"] },
        ],
        seconds: 4.5,
      },
      enter: punch({ to: 1.08, frames: 5, hit: "snap" }),
      // Pairs with the next shot's blend: this one keeps pushing in through
      // its final frames instead of sitting still while the next fades over it.
      exit: exitPunch({ to: 1.1, frames: 8 }),
      badge: "steps advance on cue",
      note: "In a real reel these steps would be pinned to spoken words.",
    },

    {
      src: {
        type: "code",
        title: "shotlist.ts",
        typeSpeed: 34,
        code: [
          "{",
          "  src: 'screen-a',",
          "  reframe: { from: wide, to: tight },",
          "  enter: blend({ to: 1.12, frames: 8 }),",
          "  badge: 'the generated file',",
          "}",
        ].join("\n"),
        highlight: [
          { at: 0, lines: [] },
          { at: 2.6, lines: [3] },
        ],
        seconds: 4.5,
      },
      // A real cross-dissolve: starts 8 frames before the diagram would have
      // ended, fades in on top of it while zooming from 1.12 down to 1.
      enter: blend({ to: 1.12, frames: 8 }),
      // Proves the pointer: an arrow glides to a line and clicks it, with a
      // ring and a spotlight. Positions are measured off a still.
      pointer: {
        path: [
          { at: 0.8, x: 0.8, y: 0.75 },
          { at: 2.0, x: 0.3, y: 0.5, click: true },
        ],
        arrow: true,
        spotlight: true,
      },
      note: "Blend, not a punch: two shots overlap and zoom together instead of meeting at a hard edge.",
    },

    {
      src: {
        type: "compare",
        left: { title: "By hand", body: ["Re-applied every time", "Drifts across a series"] },
        right: { title: "As code", body: ["Written once", "Identical every render"] },
        wipeAt: 1.6,
        seconds: 4,
      },
      // No `exit` on the code shot above — this proves the default. The
      // engine mirrors this blend's own zoom onto the outgoing side on its
      // own, so both shots move even though only one line of code asked for it.
      enter: blend({ to: 1.06, frames: 8 }),
      // Proves hand-drawn marks: a stroke that draws itself on after the wipe
      // lands, then fades. Region is a guess at first and corrected by looking.
      marks: [{ kind: "circle", region: { x: 0.06, y: 0.385, w: 0.15, h: 0.04 }, at: 2.2, hold: 1 }],
      note: "Unpaired blend: the previous shot gets its zoom-out for free, not because anyone wrote it.",
    },

    {
      src: {
        type: "terminal",
        typeSpeed: 20,
        lines: [
          { at: 0, prompt: "$", command: "npm run render 000-smoke-test" },
          { at: 2.4, output: "out/000-smoke-test/reel.mp4" },
        ],
        seconds: 4,
      },
      // A slide, not a zoom: this shot sweeps in from the right and covers
      // the compare shot as it crosses, no cross-dissolve, no scale change.
      enter: push({ direction: "left", frames: 10 }),
      badge: "1080x1920 · 30fps",
      marks: [{ kind: "underline", region: { x: 0.04, y: 0.5, w: 0.5, h: 0.028 }, at: 2.8 }],
    },

    {
      // Proves the orb generator: dots drawn as a pure function of the frame,
      // no footage and no transcript needed.
      src: { type: "orb", state: "working", seconds: 3 },
      enter: blend({ to: 1.06, frames: 8 }),
      title: "Generated, not recorded.",
    },
  ],
});
