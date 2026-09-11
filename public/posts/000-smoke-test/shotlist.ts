import { blend, exitPunch, punch, reel } from "../../../engine/spec";
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
      enter: punch({ to: 1.08, frames: 5 }),
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
      enter: punch({ to: 1.05, frames: 9 }),
      badge: "1080x1920 · 30fps",
    },
  ],
});
