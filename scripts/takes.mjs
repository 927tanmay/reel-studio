#!/usr/bin/env node
/**
 * Working with the history `npm run render` builds automatically.
 *
 * Every render is kept under out/<post>/takes/<n>/ — its file, the shotlist
 * that produced it, and a little metadata — never deleted by this script,
 * only by --forget, which you have to ask for by number. This is what makes
 * "a previous draft is lost" the user's decision rather than a side effect
 * of the next render finishing.
 *
 *   npm run takes 001-my-reel                    # list every take
 *   npm run takes 001-my-reel -- --restore 3      # bring take 3's shotlist back
 *   npm run takes 001-my-reel -- --diff 2 3        # what changed between them
 *   npm run takes 001-my-reel -- --forget 1        # delete one, for good
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, readdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { ROOT, fmt, postDir, readJson, requirePost } from "./lib.mjs";

const id = requirePost(process.argv[2]);
const args = process.argv.slice(3);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : undefined;
};

const takesDir = path.join(ROOT, "out", id, "takes");

const numbered = async () => {
  if (!existsSync(takesDir)) return [];
  const entries = await readdir(takesDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => Number(e.name))
    .sort((a, b) => a - b);
};

const takeDir = (n) => path.join(takesDir, String(n));
const requireTake = async (n) => {
  const dir = takeDir(n);
  if (!existsSync(dir)) {
    const have = await numbered();
    console.error(
      `No take ${n} for ${id}.` +
        (have.length > 0 ? ` Have: ${have.join(", ")}.` : " Nothing has been rendered yet."),
    );
    process.exit(1);
  }
  return dir;
};

const restoreArg = flag("restore");
const diffArgIndex = args.indexOf("--diff");
const forgetArg = flag("forget");

if (restoreArg !== undefined) {
  const n = Number(restoreArg);
  const dir = await requireTake(n);
  const snapshot = path.join(dir, "shotlist.ts");
  if (!existsSync(snapshot)) {
    console.error(`Take ${n} has no shotlist.ts saved with it.`);
    process.exit(1);
  }

  const currentPath = path.join(postDir(id), "shotlist.ts");
  const current = existsSync(currentPath) ? await readFile(currentPath, "utf8") : null;
  const incoming = await readFile(snapshot, "utf8");

  if (current !== null && current !== incoming) {
    // The current shotlist is about to be overwritten and was never itself
    // saved as a take — it may be mid-edit, not yet rendered. A dotfile
    // rescue copy, outside the numbered list, so restoring is never the
    // one operation in this whole feature that can actually lose something.
    const rescue = path.join(takesDir, `.before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.ts`);
    await copyFile(currentPath, rescue);
    fmt.warn(`Current shotlist.ts differed and was not itself a take — saved to ${path.relative(ROOT, rescue)}`);
  }

  await copyFile(snapshot, currentPath);
  fmt.ok(`Restored take ${n}'s shotlist.ts as the current one for ${id}.`);
  console.log("  Nothing has been re-rendered — run npm run render when you're ready to.");
  process.exit(0);
}

if (diffArgIndex > -1) {
  const a = Number(args[diffArgIndex + 1]);
  const b = Number(args[diffArgIndex + 2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    console.error("Usage: npm run takes <post> -- --diff <a> <b>");
    process.exit(1);
  }
  const dirA = await requireTake(a);
  const dirB = await requireTake(b);
  const fileA = path.join(dirA, "shotlist.ts");
  const fileB = path.join(dirB, "shotlist.ts");
  if (!existsSync(fileA) || !existsSync(fileB)) {
    console.error("One of those takes has no shotlist.ts saved with it.");
    process.exit(1);
  }

  fmt.head(`Take ${a} → take ${b}`);
  const code = await new Promise((resolve) => {
    const child = spawn("diff", ["-u", fileA, fileB], { stdio: "inherit" });
    child.on("close", resolve);
  });
  // diff exits 1 when the files differ, which is the ordinary case here, not
  // a failure — only 2+ means diff itself couldn't do its job.
  if (code === 0) console.log("  Identical shotlists.");
  else if (code !== 1) process.exit(code ?? 1);
  process.exit(0);
}

if (forgetArg !== undefined) {
  const n = Number(forgetArg);
  const dir = await requireTake(n);
  await rm(dir, { recursive: true, force: true });
  fmt.ok(`Take ${n} deleted.`);
  process.exit(0);
}

// No flag: list every take.
const nums = await numbered();
if (nums.length === 0) {
  console.log(`No takes yet for ${id}. Run: npm run render ${id}`);
  process.exit(0);
}

fmt.head(`Takes for ${id}`);
for (const n of nums) {
  const meta = await readJson(path.join(takeDir(n), "meta.json"), {});
  const when = meta.createdAt ? new Date(meta.createdAt).toLocaleString() : "unknown time";
  const secs = meta.seconds !== undefined ? `${meta.seconds.toFixed(1)}s` : "?";
  const mb = meta.bytes !== undefined ? `${(meta.bytes / 1024 / 1024).toFixed(1)}MB` : "?";
  const gates = meta.gatesPassed === false ? "gates failed" : "gates passed";
  const note = meta.note ? `  "${meta.note}"` : "";
  console.log(`  ${String(n).padStart(3)}  ${when.padEnd(22)} ${secs.padStart(7)}  ${mb.padStart(8)}  ${gates}${note}`);
}
console.log(
  `\n  npm run takes ${id} -- --restore <n>   bring a take's shotlist back\n` +
    `  npm run takes ${id} -- --diff <a> <b>  what changed between two\n` +
    `  npm run takes ${id} -- --forget <n>    delete one, for good`,
);
