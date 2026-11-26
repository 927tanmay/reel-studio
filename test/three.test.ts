import { test } from "node:test";
import assert from "node:assert/strict";
import {
  arcPoints,
  deviceAngles,
  distanceFor,
  fibonacciSphere,
  glBackend,
  globeFacing,
  latLon,
  polylinePrefix,
  project,
  rotate,
  screenCover,
  usesWebGL,
} from "../engine/three";

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const len = (v: number[]) => Math.hypot(...v);

test("latitude and longitude land on the sphere, longitude 0 facing the camera", () => {
  const front = latLon(0, 0);
  near(front[0], 0);
  near(front[1], 0);
  near(front[2], 1);
  const north = latLon(90, 40);
  near(north[1], 1);
  near(len(latLon(37.7, -122.4, 2)), 2);
});

test("an arc starts and ends on its places and climbs in the middle", () => {
  const a = latLon(12.97, 77.59);
  const b = latLon(50.11, 8.68);
  const pts = arcPoints(a, b, 33, 0.25);
  assert.equal(pts.length, 33);
  pts[0].forEach((v, k) => near(v, a[k]));
  pts[32].forEach((v, k) => near(v, b[k]));
  assert.ok(len(pts[16]) > 1.05, "lifted at the middle");
  assert.ok(len(pts[16]) <= 1.25 + 1e-9, "never past its lift");
  // Even spacing along the great circle.
  const step = (i: number) => len(pts[i + 1].map((v, k) => v - pts[i][k]));
  assert.ok(Math.abs(step(0) - step(31)) < step(0) * 0.25);
});

test("a Fibonacci sphere is the requested number of unit points, spread over both poles", () => {
  const pts = fibonacciSphere(500);
  assert.equal(pts.length, 500);
  for (const p of pts) near(len(p), 1);
  assert.ok(Math.max(...pts.map((p) => p[1])) > 0.99);
  assert.ok(Math.min(...pts.map((p) => p[1])) < -0.99);
});

test("a globe spins freely, then turns a focused place to face the camera", () => {
  // Free spin: 10 degrees a second, tilted 15.
  const free = globeFacing(2, [], 10, 15);
  near(free.y, (-20 * Math.PI) / 180);
  near(free.x, (15 * Math.PI) / 180);
  // Long after a focus, the place sits in the middle of the frame, facing us.
  const f = globeFacing(30, [{ at: 1, lat: 35, lon: -120 }], 10, 15);
  const p = rotate(latLon(35, -120), f.x, f.y);
  near(p[0], 0, 1e-3);
  near(p[1], 0, 1e-3);
  near(p[2], 1, 1e-3);
  // It turns the short way: never more than half a turn from where it was.
  const before = globeFacing(1, [{ at: 1, lat: 0, lon: 170 }], 10, 0);
  const after = globeFacing(30, [{ at: 1, lat: 0, lon: 170 }], 10, 0);
  assert.ok(Math.abs(after.y - before.y) <= Math.PI + 1e-9);
});

test("a device starts at its angle and comes flat, or turns on cue", () => {
  const start = deviceAngles(0, { x: 14, y: -32 }, []);
  near(start.y, (-32 * Math.PI) / 180);
  const late = deviceAngles(6, { x: 14, y: -32 }, []);
  near(late.x, 0);
  near(late.y, 0);
  // Critically damped: it never swings past flat.
  for (let t = 0; t < 4; t += 0.05) assert.ok(deviceAngles(t, { x: 14, y: -32 }, []).y <= 1e-9);
  const turned = deviceAngles(9, { x: 0, y: 0 }, [{ at: 0, y: 0 }, { at: 2, y: 25 }]);
  near(turned.y, (25 * Math.PI) / 180);
});

test("the camera distance makes an object fill the asked share of the frame", () => {
  const d = distanceFor(2, 0.5, 30, 1080 / 1920);
  const left = project([-1, 0, 0], d, 30, 1080 / 1920);
  const right = project([1, 0, 0], d, 30, 1080 / 1920);
  near(right.x - left.x, 0.5);
  near((left.x + right.x) / 2, 0.5);
  assert.ok(project([0, 1, 0], d, 30, 1080 / 1920).y < 0.5, "up is up the frame");
});

test("a stroke drawn partway ends exactly on the cut", () => {
  const line: [number, number, number][] = [[0, 0, 0], [3, 0, 0], [3, 1, 0]];
  assert.deepEqual(polylinePrefix(line, 1), line);
  assert.deepEqual(polylinePrefix(line, 0), []);
  const half = polylinePrefix(line, 0.5);
  assert.equal(half.length, 2);
  near(half[1][0], 2);
  const most = polylinePrefix(line, 0.875);
  assert.equal(most.length, 3);
  near(most[2][1], 0.5);
});

test("a picture covers a screen: wide ones crop their sides, tall ones scroll", () => {
  const wide = screenCover(2, 0.5);
  near(wide.repeat[0], 0.25);
  near(wide.offset[0], 0.375);
  const top = screenCover(0.25, 0.5, 0);
  near(top.repeat[1], 0.5);
  near(top.offset[1], 0.5); // texture v runs up, so the top half starts halfway
  const bottom = screenCover(0.25, 0.5, 1);
  near(bottom.offset[1], 0);
});

test("only a reel with a 3D clip asks for a GL backend", () => {
  assert.equal(usesWebGL([{ src: "hook" }, { src: { type: "stat" } }]), false);
  assert.equal(usesWebGL([{ src: "hook", overlay: { src: { type: "globe" } } }]), true);
  assert.equal(usesWebGL([{ src: { type: "extrude" } }]), true);
  assert.equal(glBackend("darwin"), "angle");
  assert.equal(glBackend("linux"), "swangle");
});
