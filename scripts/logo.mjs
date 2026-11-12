#!/usr/bin/env node
/**
 * Fetch a site's own icon into a post, for a `logos` wall or a post's `logo`.
 *
 *   npm run logo 012-my-reel vercel.com
 *   npm run logo 012-my-reel https://github.com -- --name github
 *
 * Reads the page the site serves and takes the best icon it declares itself: a
 * scalable SVG first, then the largest PNG (an apple-touch icon is usually
 * 180px), then /favicon.ico as a last resort, converted to PNG. Nothing is
 * fetched from anyone but the site named. A logo is somebody's trademark; using
 * one to say what a reel is about is common, but whether you may is your call.
 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fmt, postDir, probe, requireFfmpeg, requirePost, run } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : null;
};
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--name");

const id = requirePost(positional[0]);
const target = positional[1];
if (!target) {
  console.error("Usage: npm run logo <post> <domain or url> [-- --name <file>]\n  e.g. npm run logo 012-my-reel vercel.com");
  process.exit(1);
}

let base;
try {
  base = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`);
  if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error();
} catch {
  console.error(`"${target}" is not a site address.`);
  process.exit(1);
}
const name = (flag("name") ?? base.hostname.replace(/^www\./, "").split(".")[0]).replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

const get = async (url) => {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "reel-studio logo fetch (+https://github.com/927tanmay/reel-studio)" },
  });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res;
};

/** Every icon the page declares, best first. */
const declaredIcons = (html, pageUrl) => {
  const icons = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attr = (n) => (new RegExp(`\\b${n}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag) ?? [])[2];
    const rel = (attr("rel") ?? "").toLowerCase();
    const href = attr("href");
    if (!href || !/icon/.test(rel) || /mask-icon/.test(rel)) continue;
    const sizes = (attr("sizes") ?? "").toLowerCase();
    const type = (attr("type") ?? "").toLowerCase();
    const svg = type.includes("svg") || /\.svg(\?|$)/i.test(href);
    const size = sizes === "any" ? 1024 : Math.max(0, ...sizes.split(/\s+/).map((s) => Number(s.split("x")[0]) || 0));
    const score = svg ? 10_000 : size || (rel.includes("apple-touch") ? 180 : 32);
    try {
      icons.push({ url: new URL(href, pageUrl).href, score, svg });
    } catch {
      /* an href that is not a URL */
    }
  }
  return icons.sort((a, b) => b.score - a.score);
};

await requireFfmpeg();
fmt.head(`Fetching the icon for ${base.hostname}`);

let pageUrl = base.href;
let candidates = [];
try {
  const page = await get(base.href);
  pageUrl = page.url;
  candidates = declaredIcons(await page.text(), pageUrl);
} catch (e) {
  fmt.warn(`Could not read the page (${e.message}); trying the usual icon addresses.`);
}
const origin = new URL(pageUrl).origin;
candidates.push({ url: `${origin}/apple-touch-icon.png`, score: 180, svg: false }, { url: `${origin}/favicon.ico`, score: 16, svg: false });

const dir = path.join(postDir(id), "raw");
await mkdir(dir, { recursive: true });

for (const c of candidates) {
  let res;
  try {
    res = await get(c.url);
  } catch {
    continue;
  }
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("image/") && !/\.(svg|png|ico|jpe?g|webp)(\?|$)/i.test(c.url)) continue;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 64) continue;

  const svg = c.svg || type.includes("svg");
  const ico = type.includes("icon") || /\.ico(\?|$)/i.test(c.url);
  const ext = svg ? "svg" : type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  const file = path.join(dir, `${name}.${ext}`);
  if (ico) {
    // An .ico holds several sizes; ffmpeg takes the largest frame and writes a PNG.
    const tmp = path.join(dir, `.${name}.ico`);
    await writeFile(tmp, bytes);
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-frames:v", "1", file]);
    await run("rm", ["-f", tmp]);
  } else {
    await writeFile(file, bytes);
  }

  const rel = path.relative(path.join(postDir(id), "..", ".."), file).split(path.sep).join("/");
  if (svg) {
    fmt.ok(`${rel}  (SVG, sharp at any size)`);
  } else {
    const info = await probe(file).catch(() => null);
    const w = info?.width ?? 0;
    fmt.ok(`${rel}  ${w}x${info?.height ?? 0}`);
    if (w && w < 120) fmt.warn(`It is only ${w}px wide, so it will look soft on a logo wall. Supply a larger one if you have it.`);
  }
  console.log(`\n  On a logo wall:  { name: ${JSON.stringify(base.hostname.replace(/^www\./, ""))}, src: ${JSON.stringify(rel)} }\n`);
  process.exit(0);
}

fmt.fail(`No icon could be fetched from ${base.hostname}. Save one into public/posts/${id}/raw/ by hand.`);
process.exit(1);
