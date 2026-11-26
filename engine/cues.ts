import type { GenSpec } from "./spec";
import type { Tokens } from "./tokens";
import { rowStarts } from "./rows";
import { arrivals } from "./blocks";

/**
 * When things land inside a generated clip, in seconds into the shot — the
 * moments a sound pass gives a small sound ("appear": a pop as a row, a logo or
 * a timeline event arrives), and when a stat's number finishes counting
 * ("count"). Read from the same arrival rules the generators draw with, so a
 * pop cannot land a frame before the thing it is for.
 *
 * Cues closer together than `mergeSeconds` become one: three rows landing in a
 * quarter-second are one beat to the ear, and three pops would be a rattle.
 * Pure.
 */
export type Cue = { at: number; kind: "appear" | "count" | "click" };

export const clipCues = (src: GenSpec, tokens: Tokens, fps: number, mergeSeconds = 0.12): Cue[] => {
  const out: Cue[] = [];
  const appear = (at: number | undefined) => at !== undefined && Number.isFinite(at) && out.push({ at, kind: "appear" });
  const blocks = tokens.blocks;
  switch (src.type) {
    case "rows":
      rowStarts(src.rows, tokens.rows?.stagger ?? 0.45).forEach(appear);
      break;
    case "logos":
      arrivals(src.items, blocks?.stagger ?? 0.45).forEach(appear);
      break;
    case "timeline":
      arrivals(src.events, blocks?.stagger ?? 0.45).forEach(appear);
      break;
    case "post":
      appear(src.at ?? 0);
      if (src.reply) appear(src.reply.at);
      break;
    case "headline":
      appear(src.at ?? 0);
      break;
    case "stat":
      out.push({ at: (src.at ?? 0.2) + (blocks?.countFrames ?? 0) / fps, kind: "count" });
      break;
    case "scene":
      src.items.forEach((item) => appear(item.at ?? 0));
      break;
    case "globe":
      // Each place lighting up; an arc's landing is usually a place lighting too.
      (src.points ?? []).forEach((p) => appear(p.at));
      break;
    case "extrude":
      appear(src.at ?? 0.3);
      break;
    case "morph":
      // Each state the shape lands in, and each click of its cursor.
      src.states.forEach((s) => appear(s.at));
      (src.cursor?.clicks ?? []).forEach((c) => out.push({ at: c.at, kind: "click" }));
      break;
    case "chat":
      src.messages.forEach((m) => appear(m.at ?? 0));
      break;
    default:
      break;
  }
  out.sort((a, b) => a.at - b.at);
  const merged: Cue[] = [];
  for (const c of out) {
    const last = merged[merged.length - 1];
    if (last && last.kind === c.kind && c.at - last.at < mergeSeconds) continue;
    merged.push(c);
  }
  return merged;
};
