#!/usr/bin/env node
/**
 * Stage 08b (optional) — Thumbnail.
 *
 * Renders the still declared in a post's own `thumbnail` field in
 * shotlist.ts: a chosen shot, frozen past its title's own entrance, with
 * just that title held on screen. Same picture pipeline as the reel itself
 * (crop, grade, scale) — see engine/Thumbnail.tsx — so it never drifts from
 * what the reel actually looks like.
 *
 *   npm run thumbnail 001-my-reel
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT, fmt, requirePost } from "./lib.mjs";

const id = requirePost(process.argv[2]);

const node = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("node", args, { cwd: ROOT });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code === 0) resolve(JSON.parse(out));
      else reject(new Error(err || `dump-thumbnail exited ${code}`));
    });
  });

const shell = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

let info;
try {
  info = await node([
    "--experimental-strip-types",
    "--experimental-loader",
    "./scripts/ts-resolve-hook.mjs",
    "scripts/dump-thumbnail.ts",
    id,
  ]);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

fmt.head(`Thumbnail for ${id}`);
console.log(`  Shot ${info.shot} (${info.label}) at ${info.at}s${info.text ? ` — "${info.text}"` : ""}`);

const out = path.join(ROOT, "out", id, "thumbnail.jpg");
await shell("npx", ["remotion", "still", `${id}-thumbnail`, out, "--frame=0"]);
fmt.ok(out);
