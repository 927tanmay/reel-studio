#!/usr/bin/env node
/**
 * Stage 06d — Check the shotlist before it renders.
 *
 * Runs the gates that need no render (engine/verify.ts) and the timeline's own
 * warnings against a post's real shotlist, and prints every one. Until now
 * those only appeared in the studio's console; a render could finish, pass its
 * file gates, and still carry two things printed over each other. A failure
 * here stops `npm run render` before it spends minutes.
 *
 *   npm run check 001-my-reel
 *
 * Exits 1 if any finding is a failure. Warnings are printed and do not stop it.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { build } from "esbuild";
import { ROOT, fmt, postDir, requirePost } from "./lib.mjs";

const MARK = "@@CHECK@@";

/**
 * Bundles the post's shotlist with a few lines of `body` that end in
 * `emit(value)`, runs it, and returns the value. The engine's modules are in
 * scope as `engine.*`; the shotlist is `spec`. Shared by `check` and `review`.
 */
export const runWithShotlist = async (id, body, name = "check") => {
  if (!existsSync(path.join(postDir(id), "shotlist.ts"))) throw new Error(`public/posts/${id}/shotlist.ts does not exist.`);
  const outDir = path.join(ROOT, "out", ".check");
  await mkdir(outDir, { recursive: true });
  const outfile = path.join(outDir, `${id}.${name}.mjs`);
  const at = (...p) => JSON.stringify(path.join(ROOT, ...p));

  await build({
    stdin: {
      contents: `
        import * as spec_ from ${at("engine", "spec.ts")};
        import * as verify_ from ${at("engine", "verify.ts")};
        import * as critique_ from ${at("engine", "critique.ts")};
        import * as sfx_ from ${at("engine", "sfx.ts")};
        import * as three_ from ${at("engine", "three.ts")};
        import spec from ${JSON.stringify(path.join(postDir(id), "shotlist.ts"))};
        const engine = { ...spec_, ...verify_, ...critique_, ...sfx_, ...three_ };
        const emit = (value) => console.log(${JSON.stringify(MARK)} + JSON.stringify(value));
        ${body}
      `,
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
  });

  const stdout = await new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    const child = spawn("node", [outfile], { cwd: ROOT });
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `exited ${code}`))));
  });

  const line = stdout.split("\n").find((l) => l.startsWith(MARK));
  if (!line) throw new Error("The shotlist produced no result.");
  return JSON.parse(line.slice(MARK.length));
};

/** Runs the gates that need no render against a post's shotlist. */
export const check = (id) =>
  runWithShotlist(
    id,
    `const timeline = engine.resolveTimeline(spec);
     const sounds = [...new Set(timeline.hits.map((h) => h.sfx))].map((name) => ({ name, path: engine.sfxPath(name) }));
     const gl = engine.usesWebGL(spec.shots) ? engine.glBackend(process.platform) : null;
     emit({ warnings: timeline.warnings, findings: engine.verifySpec(spec, timeline), sounds, gl });`,
  ).then((result) => {
    // A sound named but not on disk would render as silence, with nothing to say so.
    for (const s of result.sounds) {
      if (!existsSync(path.join(ROOT, "public", s.path))) {
        result.findings.push({ level: "fail", message: `The sound "${s.name}" is used but public/${s.path} does not exist. Check the name against public/assets/sfx/lib/manifest.json.` });
      }
    }
    return result;
  });

/** Prints a result the way the rest of the pipeline does. Returns the failure count. */
export const report = ({ warnings, findings }) => {
  for (const w of warnings) fmt.warn(w);
  for (const f of findings) (f.level === "fail" ? fmt.fail : fmt.warn)(f.message);
  return findings.filter((f) => f.level === "fail").length;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = requirePost(process.argv[2]);
  fmt.head(`Checking ${id}`);
  let result;
  try {
    result = await check(id);
  } catch (e) {
    fmt.fail(`Could not load the shotlist: ${e.message}`);
    process.exit(1);
  }
  const failures = report(result);
  if (result.warnings.length + result.findings.length === 0) fmt.ok("Nothing to report.");
  if (failures > 0) {
    console.error(`\n${failures} failure${failures === 1 ? "" : "s"}. Fix the shotlist, then render.`);
    process.exit(1);
  }
}
