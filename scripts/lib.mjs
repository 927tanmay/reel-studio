import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const postsDir = () => path.join(ROOT, "public", "posts");
export const postDir = (id) => path.join(postsDir(), id);

export const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv"]);
export const AUDIO_EXT = new Set([".wav", ".m4a", ".mp3", ".aac", ".flac"]);
export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export const run = async (cmd, args) => {
  const { stdout, stderr } = await exec(cmd, args, { maxBuffer: 64 * 1024 * 1024 });
  return { stdout, stderr };
};

export const has = async (cmd) => {
  try {
    await exec("which", [cmd]);
    return true;
  } catch {
    return false;
  }
};

export const requireFfmpeg = async () => {
  if (!(await has("ffmpeg")) || !(await has("ffprobe"))) {
    console.error("ffmpeg and ffprobe are required.\n  brew install ffmpeg");
    process.exit(1);
  }
};

/** Everything ffprobe knows about a file, in the shape the engine wants. */
export const probe = async (file) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const data = JSON.parse(stdout);
  const video = data.streams.find((s) => s.codec_type === "video");
  const audio = data.streams.find((s) => s.codec_type === "audio");

  // Phone footage regularly reports landscape dimensions plus a rotation flag.
  // Trusting width and height alone is how footage ends up sideways.
  const rotation = Math.abs(
    Number(video?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? 0),
  );
  const swap = rotation === 90 || rotation === 270;

  return {
    seconds: Number(data.format.duration ?? 0),
    width: swap ? Number(video?.height ?? 0) : Number(video?.width ?? 0),
    height: swap ? Number(video?.width ?? 0) : Number(video?.height ?? 0),
    fps: video?.avg_frame_rate ? evalFraction(video.avg_frame_rate) : 0,
    hasAudio: Boolean(audio),
    rotation,
    codec: video?.codec_name ?? null,
  };
};

const evalFraction = (s) => {
  const [a, b] = String(s).split("/").map(Number);
  return b ? Number((a / b).toFixed(3)) : a;
};

export const listFiles = async (dir, exts) => {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .filter((e) => (exts ? exts.has(path.extname(e.name).toLowerCase()) : true))
    .map((e) => path.join(dir, e.name))
    .sort();
};

export const readJson = async (file, fallback = null) => {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
};

export const writeJson = async (file, data) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
};

/** A media key from a filename: "hook take 2.MOV" becomes "hook-take-2". */
export const keyFor = (file) =>
  path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const requirePost = (id) => {
  if (!id) {
    console.error("Which post? e.g. npm run ingest 001-first-cut");
    process.exit(1);
  }
  if (!existsSync(postDir(id))) {
    console.error(`No post at public/posts/${id}. Create one with: npm run new ${id}`);
    process.exit(1);
  }
  return id;
};

export const relToPublic = (abs) => path.relative(path.join(ROOT, "public"), abs);

export const fmt = {
  ok: (s) => console.log(`  ✓ ${s}`),
  warn: (s) => console.log(`  ! ${s}`),
  fail: (s) => console.log(`  ✗ ${s}`),
  head: (s) => console.log(`\n${s}`),
};
