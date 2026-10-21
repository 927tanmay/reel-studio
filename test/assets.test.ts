import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ICONS } from "../engine/icons";

const dir = path.join(import.meta.dirname ?? ".", "..", "public", "assets", "lottie");

test("every shipped Lottie file is a well-formed animation", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 4, `expected at least four, found ${files.join(", ")}`);
  for (const file of files) {
    const data = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    for (const key of ["fr", "ip", "op", "w", "h"]) assert.equal(typeof data[key], "number", `${file}.${key}`);
    assert.ok(data.op > data.ip, `${file} has no duration`);
    assert.ok(Array.isArray(data.layers) && data.layers.length > 0, `${file} has no layers`);
    for (const layer of data.layers) {
      assert.ok(layer.ip >= data.ip && layer.op <= data.op, `${file} layer "${layer.nm}" outside the composition`);
    }
  }
});

test("the plain icon set includes the phone, Bluetooth, map-pin, key and cloud", () => {
  for (const name of ["phone", "bluetooth", "map-pin", "key", "cloud"]) {
    assert.ok(name in ICONS, name);
    assert.ok(ICONS[name as keyof typeof ICONS].length > 0);
  }
});
