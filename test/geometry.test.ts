import { test } from "node:test";
import assert from "node:assert/strict";
import tokens from "../projects/default/tokens";
import { cardBox, cardTilt, tiltAt } from "../engine/card";
import { zoomStartFrame, zoomState, zoomTarget } from "../engine/zoom";
import { ICONS, iconProgress, segmentProgress } from "../engine/icons";
import { impactEnvelope, impactState, noise } from "../engine/impact";

const spec: any = { id: "t", frame: { w: 1080, h: 1920, fps: 30 }, style: tokens, shots: [] };
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// --- card ------------------------------------------------------------------
test("a 16:9 card takes the look's width and the picture's own height", () => {
  const box = cardBox(spec, { card: true } as any, 16 / 9)!;
  near(box.width, tokens.card!.width * 1080);
  near(box.height, box.width / (16 / 9));
  near(box.left, (1080 - box.width) / 2);
});

test("a card too tall for the look shrinks proportionally instead of cropping", () => {
  const box = cardBox(spec, { card: true } as any, 9 / 16)!;
  near(box.height, tokens.card!.maxHeight * 1920);
  near(box.width / box.height, 9 / 16, 1e-6);
});

test("no card on the shot, or no card in the look, is no box", () => {
  assert.equal(cardBox(spec, {} as any, 1), null);
  assert.equal(cardBox({ ...spec, style: { ...tokens, card: undefined } }, { card: true } as any, 1), null);
});

test("tilt: the shot can turn it off or set its own angles", () => {
  assert.equal(cardTilt(spec, { card: { tilt: false } } as any), null);
  assert.equal(cardTilt(spec, { card: { tilt: { y: 20 } } } as any)!.y, 20);
  assert.equal(cardTilt(spec, { card: true } as any)!.y, tokens.card!.tilt!.y);
});

test("tilt eases to exactly flat once it settles, and holds if it never does", () => {
  const t = cardTilt(spec, { card: true } as any)!;
  const flat = tiltAt(t, t.settleFrames!);
  near(flat.x, 0);
  near(flat.y, 0); // may be -0, which is the same angle
  assert.ok(Math.abs(tiltAt(t, 0).y) > 0);
  assert.deepEqual(tiltAt({ ...t, settleFrames: null }, 500), { x: t.x, y: t.y });
});

// --- zoom ------------------------------------------------------------------
const pointer = { path: [{ at: 2, x: 0.3, y: 0.6, click: true }], zoom: true } as any;
const pstyle = tokens.pointer!;
const z = pstyle.zoom!;

test("zoom target is the shot's number, else the look's; off without either", () => {
  assert.equal(zoomTarget({ ...pointer, zoom: 2.2 }, pstyle), 2.2);
  assert.equal(zoomTarget(pointer, pstyle), z.to);
  assert.equal(zoomTarget({ ...pointer, zoom: false }, pstyle), null);
});

test("no zoom before it starts, full zoom at the click, none after it eases out", () => {
  const click = 60;
  assert.equal(zoomState(zoomStartFrame(click, z) - 1, 30, pointer, pstyle), null);
  const peak = zoomState(click, 30, pointer, pstyle)!;
  near(peak.scale, z.to);
  near(peak.x, 0.3);
  near(peak.y, 0.6);
  assert.equal(zoomState(click + z.holdFrames + z.outFrames + 1, 30, pointer, pstyle), null);
});

test("it reaches its peak before the click so the eye is already there", () => {
  const click = 60;
  near(zoomState(click - z.lead, 30, pointer, pstyle)!.scale, z.to);
});

test("two close clicks glide: the focus sits between them while both are active", () => {
  const two = { ...pointer, path: [{ at: 2, x: 0.2, y: 0.2, click: true }, { at: 2.5, x: 0.8, y: 0.8, click: true }] };
  const s = zoomState(70, 30, two, pstyle)!;
  assert.ok(s.x > 0.2 && s.x < 0.8);
  assert.ok(s.scale > 1);
});

// --- icons -----------------------------------------------------------------
test("every icon finishes drawing by progress 1, and a look with no draw-on is drawn at once", () => {
  for (const [name, segments] of Object.entries(ICONS)) {
    assert.equal(Math.max(...segments.map((s) => s.to)), 1, name);
    for (const s of segments) assert.equal(segmentProgress(1, s), 1, `${name} segment`);
  }
  assert.equal(iconProgress(0, 0, undefined), 1);
  assert.equal(iconProgress(0, 0, 14), 0);
  assert.equal(iconProgress(14, 0, 14), 1);
});

// --- impacts ---------------------------------------------------------------
test("an impact is full strength on its first frame and gone after its length", () => {
  assert.equal(impactEnvelope(10, 10, 8), 1);
  assert.equal(impactEnvelope(9, 10, 8), 0);
  assert.equal(impactEnvelope(18, 10, 8), 0);
  assert.ok(impactEnvelope(14, 10, 8) < impactEnvelope(11, 10, 8));
});

test("noise is deterministic and stays in range", () => {
  for (let i = 0; i < 200; i++) {
    const n = noise(i);
    assert.ok(n >= -1 && n <= 1);
    assert.equal(n, noise(i));
  }
});

test("impact state: shakes add, the strongest flash wins, nothing outside the window", () => {
  const style = tokens.impact!;
  const id = (c: string) => c;
  const none = impactState(0, 30, [{ kind: "shake", at: 1 }], style, 1, id);
  assert.equal(none.shake, null);
  const hit = impactState(30, 30, [{ kind: "shake", at: 1 }, { kind: "flash", at: 1 }, { kind: "glitch", at: 1 }], style, 1, id);
  assert.ok(hit.shake && hit.flash && hit.glitch);
  assert.ok(hit.flash!.opacity > 0 && hit.flash!.opacity <= 1);
  const doubled = impactState(30, 30, [{ kind: "flash", at: 1 }, { kind: "flash", at: 1, strength: 0.2 }], style, 1, id);
  near(doubled.flash!.opacity, hit.flash!.opacity);
});
