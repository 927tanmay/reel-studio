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

/** Bundles the post's shotlist with the checks and runs it, returning what they found. */
export const check = async (id) => {
  if (!existsSync(path.join(postDir(id), "shotlist.ts"))) throw new Error(`public/posts/${id}/shotlist.ts does not exist.`);
  const outDir = path.join(ROOT, "out", ".check");
  await mkdir(outDir, { recursive: true });
  const outfile = path.join(outDir, `${id}.mjs`);
  const at = (...p) => JSON.stringify(path.join(ROOT, ...p));

  await build({
    stdin: {
      contents: `
        import { resolveTimeline } from ${at("engine", "spec.ts")};
        import { verifySpec } from ${at("engine", "verify.ts")};
        import spec from ${JSON.stringify(path.join(postDir(id), "shotlist.ts"))};
        const timeline = resolveTimeline(spec);
        console.log(${JSON.stringify(MARK)} + JSON.stringify({ warnings: timeline.warnings, findings: verifySpec(spec, timeline) }));
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
  if (!line) throw new Error("The check produced no result.");
  return JSON.parse(line.slice(MARK.length));
};

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
