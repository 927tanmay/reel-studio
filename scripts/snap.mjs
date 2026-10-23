#!/usr/bin/env node
/**
 * Stage 02b (optional) — Screenshot a web page for a reel.
 *
 * A hot-topic reel is about a thing — an article, a repo, a post, a changelog —
 * and the viewer wants to see it as they would meet it. This captures a URL into
 * the post's raw/ folder at twice its pixel density, so it stays sharp when the
 * reel scrolls or pushes into it, and prints the `image` clip that shows it.
 *
 *   npm run snap 011-my-reel https://example.com/article
 *   npm run snap 011-my-reel https://example.com -- --full --name article
 *   npm run snap 011-my-reel https://example.com -- --mobile --dark
 *   npm run snap 011-my-reel https://example.com -- --selector "main article"
 *   npm run snap 011-my-reel https://example.com -- --hide ".cookie-banner, #chat"
 *
 * Flags: --name <file>  --width <css px, 1280>  --height <css px, 800>
 *        --scale <density, 2>  --full (the whole page)  --max-height <css px, 7000>
 *        --mobile (390 wide, touch)  --dark  --selector <css> (just that element)
 *        --hide <css selectors, comma separated>  --wait <ms, 1500>  --chrome <path>
 *
 * It uses the headless Chrome Remotion already downloads for rendering, driven
 * over the DevTools protocol — no new dependency. Only http and https.
 *
 * What you capture is somebody's page. Whether you may show it is your call, not
 * the tool's; a sidecar `<name>.snap.json` records where and when it came from.
 */
import path from "node:path";
import os from "node:os";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { ROOT, fmt, postDir, requirePost } from "./lib.mjs";

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && flagTakesValue(args[i - 1])));
function flagTakesValue(f) {
  return ["--name", "--width", "--height", "--scale", "--max-height", "--selector", "--hide", "--wait", "--chrome"].includes(f);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const id = requirePost(positional[0]);
const url = positional[1];
try {
  const u = new URL(url ?? "");
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("not http");
} catch {
  console.error("Usage: npm run snap <post> <http(s) url> [-- flags]\n  e.g. npm run snap 011-my-reel https://example.com/article -- --full");
  process.exit(1);
}

const mobile = has("mobile");
const width = Number(flag("width", mobile ? 390 : 1280));
const height = Number(flag("height", mobile ? 844 : 800));
const scale = Number(flag("scale", mobile ? 3 : 2));
const maxHeight = Number(flag("max-height", 7000));
const wait = Number(flag("wait", 1500));
const selector = flag("selector", null);
const hide = flag("hide", null);
const full = has("full");

const slug = (s) => s.toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const name = (flag("name", null) ?? slug(url)).replace(/\.png$/i, "");

// ---------------------------------------------------------------------------
// Find a browser. Remotion's own headless shell first: it is what renders the
// reel, so it is already here for anyone who has rendered once.

const SHELL_ROOT = path.join(ROOT, "node_modules", ".remotion", "chrome-headless-shell");
const findShell = () => {
  if (!existsSync(SHELL_ROOT)) return null;
  for (const platform of readdirSync(SHELL_ROOT, { withFileTypes: true })) {
    if (!platform.isDirectory()) continue;
    const dir = path.join(SHELL_ROOT, platform.name);
    for (const inner of readdirSync(dir, { withFileTypes: true })) {
      if (!inner.isDirectory()) continue;
      for (const bin of ["chrome-headless-shell", "chrome-headless-shell.exe"]) {
        const p = path.join(dir, inner.name, bin);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
};

const SYSTEM = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

let chrome = flag("chrome", null) ?? process.env.CHROME_PATH ?? findShell();
if (!chrome) {
  fmt.warn("No headless Chrome yet; fetching the one Remotion uses (a one-time download).");
  const { ensureBrowser } = await import("@remotion/renderer");
  await ensureBrowser();
  chrome = findShell();
}
chrome ??= SYSTEM.find((p) => existsSync(p)) ?? null;
if (!chrome) {
  fmt.fail("Could not find a Chrome. Run `npm run render 000-smoke-test` once, or pass --chrome <path>.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// A small DevTools client: send a command, await its reply, wait for an event.

const profile = await mkdtemp(path.join(os.tmpdir(), "reel-snap-"));
const child = spawn(
  chrome,
  ["--headless", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: ["ignore", "ignore", "pipe"] },
);

const cleanup = async () => {
  child.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
};
const die = async (message) => {
  fmt.fail(message);
  await cleanup();
  process.exit(1);
};
const overall = setTimeout(() => die("Timed out after 90 seconds."), 90_000);

const port = await new Promise((resolve, reject) => {
  let buf = "";
  child.stderr.on("data", (d) => {
    buf += d;
    const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(buf);
    if (m) resolve(Number(m[1]));
  });
  child.on("exit", (code) => reject(new Error(`Chrome exited (${code}) before it was ready.`)));
}).catch((e) => die(e.message));

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const pageTarget = targets.find((t) => t.type === "page");
if (!pageTarget) await die("Chrome opened no page.");

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", () => reject(new Error("Could not talk to Chrome.")), { once: true });
}).catch((e) => die(e.message));

let next = 1;
const pending = new Map();
const waiters = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = next++;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
const once = (method, ms) =>
  new Promise((resolve) => {
    const w = { method, resolve };
    waiters.push(w);
    setTimeout(() => resolve(null), ms);
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "The page script failed.");
  return r.result.value;
};

try {
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
  if (mobile) {
    await send("Emulation.setUserAgentOverride", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  }
  if (has("dark")) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });

  fmt.head(`Capturing ${url}`);
  const loaded = once("Page.loadEventFired", 30_000);
  const nav = await send("Page.navigate", { url });
  if (nav.errorText) await die(`Could not load the page: ${nav.errorText}.`);
  if (!(await loaded)) fmt.warn("The page was slow to finish loading; capturing what is there.");
  await new Promise((r) => setTimeout(r, wait));

  if (hide) {
    await evaluate(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(`${hide} { display: none !important; }`)}; document.head.appendChild(s); })()`);
  }

  let clip;
  if (selector) {
    clip = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: "start" });
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 };
    })()`);
    if (!clip) await die(`Nothing on the page matches "${selector}".`);
  } else if (full) {
    // Scroll through once so lazy images load, then measure.
    await evaluate(`(async () => {
      const step = Math.max(300, innerHeight * 0.8);
      for (let y = 0; y < document.documentElement.scrollHeight && y < ${maxHeight}; y += step) {
        scrollTo(0, y); await new Promise((r) => setTimeout(r, 120));
      }
      scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300));
    })()`);
    const pageHeight = await evaluate("Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)");
    if (pageHeight > maxHeight) fmt.warn(`The page is ${pageHeight}px tall; capturing the first ${maxHeight}px (--max-height changes that).`);
    clip = { x: 0, y: 0, width, height: Math.min(pageHeight, maxHeight), scale: 1 };
  } else {
    clip = { x: 0, y: 0, width, height, scale: 1 };
  }

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  const png = Buffer.from(shot.data, "base64");

  const dir = path.join(postDir(id), "raw");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await writeFile(file, png);

  const pxW = Math.round(clip.width * scale);
  const pxH = Math.round(clip.height * scale);
  const aspect = clip.width / clip.height;
  await writeFile(
    path.join(dir, `${name}.snap.json`),
    JSON.stringify({ url, capturedAt: new Date().toISOString(), width: pxW, height: pxH, density: scale, mobile, full, selector }, null, 2) + "\n",
  );

  fmt.ok(`${path.relative(ROOT, file)}  ${pxW}x${pxH}`);
  const host = new URL(url).host + (new URL(url).pathname === "/" ? "" : new URL(url).pathname);
  console.log(
    `\n  The clip (the address is what the bar shows; edit it freely):\n\n` +
      `    { type: "image", src: "posts/${id}/raw/${name}.png", window: { url: ${JSON.stringify(host)} }, seconds: 4 }\n`,
  );
  if (aspect < 0.6) {
    console.log(`  It is tall (about ${(1 / aspect).toFixed(1)}x as high as wide), so in a window it scrolls down the page across the shot.`);
  }
  console.log("  Marks on it use fractions of the picture: measure on the PNG, not on the frame.");
} catch (e) {
  await die(e.message);
} finally {
  clearTimeout(overall);
  ws.close();
  await cleanup();
}
process.exit(0);
