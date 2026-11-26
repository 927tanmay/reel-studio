#!/usr/bin/env node
/**
 * Stage 08c — Review the cut as a storyboard.
 *
 *   npm run review 001-my-reel
 *   npm run review 001-my-reel -- --open      (open it in the browser too)
 *
 * Writes out/<post>/review/index.html: the render beside a track of its shots
 * (drawn from their own frames), an event lane coloured by loudness (STYLE.md),
 * the pacing numbers, and a card per shot with a filmstrip, its transition and
 * effects, the words spoken under it, and any finding about it. Click anything
 * to jump the video there.
 *
 * It also writes out/<post>/review/sheet.jpg, every shot's middle frame in one
 * image, in shot order — for an agent to look at the whole cut at once after a
 * render instead of trusting it, and for you to skim. Without a render yet, the
 * page still shows the plan; the pictures arrive with `npm run render`.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { ROOT, fmt, postDir, readJson, requireFfmpeg, requirePost, run } from "./lib.mjs";
import { runWithShotlist } from "./check.mjs";

const id = requirePost(process.argv[2]);
const open = process.argv.includes("--open");

const BODY = `
  const timeline = engine.resolveTimeline(spec);
  const fps = spec.frame.fps;
  const LOUD = new Set(["slam", "shake", "flash", "glitch"]);
  const flat = (e) => (Array.isArray(e) ? e : e ? Object.values(e).flat() : []);
  const shots = timeline.shots.map((r) => {
    const s = r.shot;
    const src = s.src;
    const start = r.startFrame / fps;
    const kind = typeof src === "object" ? src.type : s.bands ? "bands" : "footage";
    const key = engine.dominantSound(r)?.key;
    const all = key && spec.words ? spec.words[key] : null;
    const words = all ? engine.wordsInShot(r, fps, all).map((w) => ({ t: w.text, s: +(start + w.startMs / 1000).toFixed(3) })) : [];
    const events = [];
    const add = (at, kind, label, loud) => events.push({ at: +(start + (at ?? 0)).toFixed(3), kind, label, loud });
    for (const m of engine.allMarks(s)) add(m.at, "mark", m.kind + " mark", "medium");
    for (const sl of s.slams ?? []) add(sl.at, "slam", "slam " + JSON.stringify(sl.text), "loud");
    for (const im of s.impacts ?? []) add(im.at, im.kind, im.kind, LOUD.has(im.kind) ? "loud" : "medium");
    for (const p of s.pointer?.path ?? []) if (p.click) add(p.at, "click", "click", "medium");
    if (s.ribbon) add(s.ribbon.at, "ribbon", "ribbon", "medium");
    if (s.lowerThird) add(s.lowerThird.at, "lower-third", "lower third", "quiet");
    if (typeof src === "object" && Array.isArray(src.highlights)) for (const h of src.highlights) add(h.at, "highlight", "highlight " + JSON.stringify(h.phrase), "medium");
    const e = s.enter;
    const enterLoud = !e ? "quiet" : e.kind === "zoom" || (e.kind === "push" && (e.blur ?? 1) >= 2) ? "loud" : "quiet";
    const enterName = !e ? "cut" : e.kind === "push" && (e.blur ?? 1) >= 2 ? "whip" : e.kind === "zoom" ? "zoom-through" : e.kind;
    return {
      index: r.index,
      start: +start.toFixed(3),
      seconds: +(r.durationInFrames / fps).toFixed(3),
      label: engine.shotLabel(s),
      kind,
      source: typeof src === "string" ? src : null,
      enter: { name: enterName, frames: e && "frames" in e ? e.frames : 0, hit: e && "hit" in e ? e.hit ?? null : null, loud: enterLoud },
      header: s.header ? [s.header.kicker, s.header.title].filter(Boolean).join(" · ") : null,
      title: s.title ?? null,
      accent: s.accent ?? null,
      card: Boolean(s.card),
      emphasis: flat(s.emphasis),
      captions: s.captions !== false && words.length > 0,
      words,
      events,
      note: s.note ?? null,
      soundKey: key ?? null,
    };
  });
  emit({
    id: spec.id,
    fps,
    frame: spec.frame,
    duration: timeline.durationInFrames / fps,
    shots,
    hits: timeline.hits.map((h) => ({ at: +(h.frame / fps).toFixed(3), sfx: h.sfx })),
    findings: engine.verifySpec(spec, timeline),
    listen: engine.listenList(spec, timeline),
    critique: engine.critiqueTimeline(spec, timeline, { coalesceSeconds: 0.25, hookSeconds: 3, deadAirSeconds: 0.5 }),
  });
`;

await requireFfmpeg();
fmt.head(`Reviewing ${id}`);

let data;
try {
  data = await runWithShotlist(id, BODY, "review");
} catch (e) {
  fmt.fail(`Could not load the shotlist: ${e.message}`);
  process.exit(1);
}

// Where each take's caption text came from, as transcribe recorded it.
data.captionSources = (await readJson(path.join(postDir(id), "captions.json"), {})) ?? {};

const outDir = path.join(ROOT, "out", id, "review");
await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (/\.(jpg|png)$/.test(f)) await rm(path.join(outDir, f));

const video = path.join(ROOT, "out", id, "reel.mp4");
const rendered = existsSync(video);

/** One frame of the render at `seconds`, to a small jpg. */
const grab = (seconds, file) =>
  run("ffmpeg", ["-y", "-loglevel", "error", "-ss", Math.max(0, seconds).toFixed(3), "-i", video, "-frames:v", "1", "-vf", "scale=270:-2", "-q:v", "4", path.join(outDir, file)]);

if (rendered) {
  // Three frames a shot — just in, the middle, just before it ends — so a jump at
  // a cut or a picture that never settles shows on the strip.
  const jobs = [];
  data.shots.forEach((s, i) => {
    const pad = Math.min(0.15, s.seconds / 4);
    const n = String(i).padStart(3, "0");
    jobs.push(() => grab(s.start + pad, `s${n}-a.jpg`), () => grab(s.start + s.seconds / 2, `mid-${n}.jpg`), () => grab(s.start + s.seconds - pad, `s${n}-c.jpg`));
  });
  for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map((j) => j()));

  const cols = Math.min(8, data.shots.length);
  const rows = Math.ceil(data.shots.length / cols);
  await run("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(outDir, "mid-%03d.jpg"),
    "-vf", `tile=${cols}x${rows}:padding=6:margin=6:color=0x0B0D12`, "-frames:v", "1", "-q:v", "3",
    path.join(outDir, "sheet.jpg"),
  ]);
} else {
  fmt.warn("Not rendered yet, so the page shows the plan without pictures. Run npm run render first for frames.");
}

await writeFile(path.join(outDir, "index.html"), page(data, rendered));

const fails = data.findings.filter((f) => f.level === "fail").length;
const warns = data.findings.length - fails;
fmt.ok(`out/${id}/review/index.html  ${data.shots.length} shots, ${data.duration.toFixed(1)}s, ${fails} failure${fails === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}`);
if (rendered) fmt.ok(`out/${id}/review/sheet.jpg  every shot's middle frame, in order`);
if (data.listen.length) {
  fmt.head("Listen to these with headphones (nothing here hears the mix)");
  for (const m of data.listen) console.log(`  ${m.at.toFixed(2)}s  ${m.why.join("; ")}`);
}
if (open) spawn(process.platform === "darwin" ? "open" : "xdg-open", [path.join(outDir, "index.html")], { stdio: "ignore", detached: true }).unref();

// ---------------------------------------------------------------------------

function page(data, rendered) {
  const json = JSON.stringify({ ...data, rendered }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.id)} · review</title>
<style>
/* A cutting-room storyboard: the reel on the left, its track and its shots on the right. */
:root {
  --bg: #F3F4F7; --panel: #FFFFFF; --ink: #14161C; --ink-2: #545B6B; --line: #DCE0E8;
  --quiet: #9AA3B5; --medium: #2F6FEB; --loud: #E5484D; --warn: #B7791F; --ok: #2F9E6B; --chip: #EEF1F6;
  --track: #E6E9EF;
  --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0B0D12; --panel: #13161D; --ink: #E7EAF0; --ink-2: #9AA3B5; --line: #252A35; --quiet: #5E6779; --medium: #5B8DEF; --loud: #F2555A; --warn: #E3A33B; --ok: #3DBE83; --chip: #1B1F28; --track: #1A1E27; color-scheme: dark; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 var(--sans); }
header { padding: 18px 24px; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; }
h1 { font-size: 18px; margin: 0; letter-spacing: -0.01em; }
.meta { color: var(--ink-2); font-family: var(--mono); font-size: 12px; }
.legend { margin-left: auto; display: flex; gap: 14px; font-size: 12px; color: var(--ink-2); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
main { display: grid; grid-template-columns: minmax(240px, 380px) 1fr; gap: 24px; padding: 20px 24px 60px; align-items: start; }
@media (max-width: 860px) { main { grid-template-columns: 1fr; } .player { position: static !important; } }
.player { position: sticky; top: 16px; }
video, .noVideo { width: 100%; aspect-ratio: var(--aspect); background: #000; border-radius: 12px; display: block; }
.noVideo { display: grid; place-items: center; color: #8a93a6; font-size: 13px; text-align: center; padding: 20px; }
.now { margin-top: 10px; font-family: var(--mono); font-size: 12px; color: var(--ink-2); }
section { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; min-width: 0; }
h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-2); margin: 0 0 10px; font-weight: 600; }
.track { position: relative; height: 92px; background: var(--track); border-radius: 8px; overflow: hidden; cursor: pointer; }
.seg { position: absolute; top: 0; bottom: 0; border-right: 2px solid var(--bg); background-size: cover; background-position: center; }
.seg span { position: absolute; left: 4px; top: 3px; font: 600 10px var(--mono); color: #fff; text-shadow: 0 1px 2px #000; }
.seg.loud { box-shadow: inset 3px 0 0 var(--loud); }
.lane { position: relative; height: 22px; margin-top: 6px; cursor: pointer; }
.tick { position: absolute; top: 3px; width: 3px; height: 16px; border-radius: 2px; transform: translateX(-1px); }
.tick.quiet { background: var(--quiet); } .tick.medium { background: var(--medium); } .tick.loud { background: var(--loud); height: 18px; top: 2px; }
.tick.sound { background: transparent; border: 1.5px solid var(--quiet); width: 7px; height: 7px; border-radius: 50%; top: 8px; transform: translateX(-3px); }
.ruler { display: flex; justify-content: space-between; font: 11px var(--mono); color: var(--ink-2); margin-top: 2px; }
.playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ink); pointer-events: none; }
.wrapTrack { position: relative; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px 18px; }
.stat b { display: block; font: 600 18px var(--mono); font-variant-numeric: tabular-nums; }
.stat small { color: var(--ink-2); }
.stat.flag b { color: var(--warn); }
.finding.listen { cursor: pointer; } .finding.listen .lvl { color: var(--medium); font-variant-numeric: tabular-nums; }
.finding { display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 13px; }
.finding:first-of-type { border-top: 0; }
.finding .lvl { font: 700 11px var(--mono); flex: none; padding-top: 2px; }
.lvl.fail { color: var(--loud); } .lvl.warn { color: var(--warn); }
.shots { display: grid; gap: 12px; }
.shot { display: grid; grid-template-columns: auto 1fr; gap: 14px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; background: var(--panel); }
.shot.current { border-color: var(--medium); box-shadow: 0 0 0 1px var(--medium); }
.strip { display: flex; gap: 3px; }
.strip img, .strip .ph { width: 54px; aspect-ratio: var(--aspect); object-fit: cover; border-radius: 4px; background: var(--track); display: block; }
.shot h3 { margin: 0; font-size: 14px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
.shot h3 .tc { font: 12px var(--mono); color: var(--ink-2); font-weight: 400; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 7px 0; }
.chip { font: 11px var(--mono); padding: 2px 7px; border-radius: 99px; background: var(--chip); color: var(--ink-2); white-space: nowrap; }
.chip.loud { color: var(--loud); box-shadow: inset 0 0 0 1px var(--loud); background: transparent; }
.chip.medium { color: var(--medium); }
.words { color: var(--ink-2); font-size: 13px; overflow-wrap: anywhere; }
.words .w { cursor: pointer; border-radius: 3px; }
.words .w:hover { background: var(--chip); color: var(--ink); }
.words .em { color: var(--ink); font-weight: 700; }
.words .on { background: var(--medium); color: #fff; }
.label { color: var(--ink-2); font-size: 12px; }
.shotFinding { font-size: 12px; margin-top: 6px; }
.shotFinding.fail { color: var(--loud); } .shotFinding.warn { color: var(--warn); }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>
</head>
<body>
<header>
  <h1 id="title"></h1>
  <span class="meta" id="meta"></span>
  <span class="legend"><span><i style="background:var(--quiet)"></i>quiet</span><span><i style="background:var(--medium)"></i>medium</span><span><i style="background:var(--loud)"></i>loud</span><span><i style="border:1.5px solid var(--quiet);border-radius:50%"></i>sound</span></span>
</header>
<main>
  <div class="player">
    <div id="screen"></div>
    <div class="now" id="now">0.00s</div>
  </div>
  <div>
    <section>
      <h2>Track</h2>
      <div class="wrapTrack" id="wrapTrack">
        <div class="track" id="track"></div>
        <div class="lane" id="lane"></div>
        <div class="playhead" id="playhead"></div>
      </div>
      <div class="ruler" id="ruler"></div>
    </section>
    <section>
      <h2>Pacing</h2>
      <div class="stats" id="stats"></div>
    </section>
    <section>
      <h2>Listen to these</h2>
      <div class="label">Nothing here hears the mix. These are the moments most likely to sound wrong: check them with headphones.</div>
      <div id="listen"></div>
    </section>
    <section id="findingsBox">
      <h2>Findings</h2>
      <div id="findings"></div>
    </section>
    <section>
      <h2>Shots</h2>
      <div class="shots" id="shots"></div>
    </section>
  </div>
</main>
<script id="data" type="application/json">${json}</script>
<script>
(function () {
  var D = JSON.parse(document.getElementById("data").textContent);
  var dur = D.duration;
  document.documentElement.style.setProperty("--aspect", D.frame.w + " / " + D.frame.h);
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var pad = function (i) { return String(i).padStart(3, "0"); };
  var t = function (s) { return s.toFixed(2) + "s"; };
  var pct = function (s) { return (100 * s / dur) + "%"; };

  var fails = D.findings.filter(function (f) { return f.level === "fail"; }).length;
  $("title").textContent = D.id;
  $("meta").textContent = dur.toFixed(2) + "s · " + D.shots.length + " shots · " + D.frame.w + "x" + D.frame.h + " · " + fails + " failures, " + (D.findings.length - fails) + " warnings";

  // The player, or a note saying why there is none yet.
  var video = null;
  if (D.rendered) {
    video = el("video"); video.src = "../reel.mp4"; video.controls = true; video.preload = "auto"; video.playsInline = true;
    $("screen").appendChild(video);
  } else {
    $("screen").appendChild(el("div", "noVideo", "Not rendered yet. Run npm run render " + D.id + ", then npm run review again."));
  }
  var seek = function (s) { if (!video) return; video.currentTime = Math.max(0, Math.min(dur, s)); };

  // The track: every shot at its place and length, drawn from its own middle frame.
  var track = $("track");
  D.shots.forEach(function (s, i) {
    var seg = el("div", "seg" + (s.enter.loud === "loud" ? " loud" : ""));
    seg.style.left = pct(s.start); seg.style.width = pct(s.seconds);
    if (D.rendered) seg.style.backgroundImage = "url(mid-" + pad(i) + ".jpg)";
    seg.title = "#" + s.index + " " + s.label + " · " + s.enter.name;
    seg.appendChild(el("span", null, String(s.index)));
    track.appendChild(seg);
  });
  var lane = $("lane");
  D.shots.forEach(function (s) {
    s.events.forEach(function (e) {
      var k = el("div", "tick " + e.loud); k.style.left = pct(e.at); k.title = t(e.at) + " " + e.label + " (#" + s.index + ")"; lane.appendChild(k);
    });
    if (s.enter.loud === "loud") { var k = el("div", "tick loud"); k.style.left = pct(s.start); k.title = t(s.start) + " " + s.enter.name; lane.appendChild(k); }
  });
  D.hits.forEach(function (h) { var k = el("div", "tick sound"); k.style.left = pct(h.at); k.title = t(h.at) + " sound: " + h.sfx; lane.appendChild(k); });
  [0, 0.25, 0.5, 0.75, 1].forEach(function (f) { $("ruler").appendChild(el("span", null, t(f * dur))); });
  $("wrapTrack").addEventListener("click", function (ev) {
    var r = track.getBoundingClientRect(); seek(dur * (ev.clientX - r.left) / r.width);
  });

  // Pacing, from the same numbers npm run critique prints.
  var c = D.critique;
  var stats = [];
  var longest = c.gaps && c.gaps.length ? c.gaps.reduce(function (a, b) { return b.seconds > a.seconds ? b : a; }) : null;
  stats.push(["first change", c.timeToFirstChange == null ? "none" : t(c.timeToFirstChange), c.timeToFirstChange != null && c.timeToFirstChange > 2]);
  stats.push(["changes in the hook", String(c.changesInHook), c.changesInHook < 1]);
  stats.push(["longest still stretch", longest ? t(longest.seconds) : "none", longest && longest.seconds > 3]);
  stats.push(["loud beats", String(c.emphasis.loud.length) + " in " + t(c.runtimeSeconds), c.emphasis.loud.length > Math.max(1, Math.round(3 * c.runtimeSeconds / 30))]);
  stats.push(["closest loud beats", c.emphasis.closestLoudGap == null ? "n/a" : t(c.emphasis.closestLoudGap), c.emphasis.closestLoudGap != null && c.emphasis.closestLoudGap < 3]);
  if (c.speech) {
    stats.push(["speaking pace", Math.round(c.speech.wordsPerMinute) + " wpm", false]);
    stats.push(["speech coverage", Math.round(c.speech.coverage * 100) + "%", false]);
    stats.push(["dead air", c.speech.deadAir.length + " gaps", c.speech.deadAir.length > 0]);
  }
  stats.forEach(function (s) {
    var d = el("div", "stat" + (s[2] ? " flag" : "")); d.appendChild(el("b", null, s[1])); d.appendChild(el("small", null, s[0])); $("stats").appendChild(d);
  });

  // What to hear: the riskiest moments, each a button that jumps the video there.
  if (!D.listen.length) $("listen").appendChild(el("div", "label", "No sound here stands out as risky."));
  D.listen.forEach(function (m) {
    var row = el("div", "finding listen"); row.appendChild(el("span", "lvl", t(m.at)));
    var why = el("span"); m.why.forEach(function (w, i) { if (i) why.appendChild(el("br")); why.appendChild(document.createTextNode(w)); }); row.appendChild(why);
    row.addEventListener("click", function () { seek(Math.max(0, m.at - 1)); if (video) video.play(); });
    $("listen").appendChild(row);
  });

  // Findings: those about one shot go on its card; the rest are listed here.
  var byShot = {};
  var general = [];
  D.findings.forEach(function (f) {
    var m = /\\bShot (\\d+)/.exec(f.message);
    if (m) (byShot[m[1]] = byShot[m[1]] || []).push(f); else general.push(f);
  });
  if (!general.length) $("findings").appendChild(el("div", "label", D.findings.length ? "Every finding is about one shot; see its card." : "Nothing to report."));
  general.forEach(function (f) {
    var row = el("div", "finding"); row.appendChild(el("span", "lvl " + f.level, f.level === "fail" ? "FAIL" : "WARN")); row.appendChild(el("span", null, f.message)); $("findings").appendChild(row);
  });

  // A card per shot.
  var cards = [];
  D.shots.forEach(function (s, i) {
    var card = el("div", "shot"); card.dataset.i = i;
    var strip = el("div", "strip");
    ["s" + pad(i) + "-a.jpg", "mid-" + pad(i) + ".jpg", "s" + pad(i) + "-c.jpg"].forEach(function (f) {
      if (D.rendered) { var img = el("img"); img.src = f; img.alt = ""; img.loading = "lazy"; strip.appendChild(img); } else strip.appendChild(el("div", "ph"));
    });
    card.appendChild(strip);
    var body = el("div"); body.style.minWidth = "0";
    var h = el("h3"); h.appendChild(el("span", null, "#" + s.index + " " + s.label)); h.appendChild(el("span", "tc", t(s.start) + " → " + t(s.start + s.seconds) + " · " + t(s.seconds)));
    body.appendChild(h);
    var chips = el("div", "chips");
    var add = function (text, cls) { chips.appendChild(el("span", "chip" + (cls ? " " + cls : ""), text)); };
    add(s.kind);
    add((s.enter.name === "cut" ? "cut" : s.enter.name + " " + s.enter.frames + "f") + (s.enter.hit ? " + " + s.enter.hit : ""), s.enter.loud === "loud" ? "loud" : "");
    if (s.card) add("card", "medium");
    if (s.accent) add("accent " + s.accent);
    var counts = {};
    s.events.forEach(function (e) { var key = e.kind + "|" + e.loud; counts[key] = (counts[key] || 0) + 1; });
    Object.keys(counts).forEach(function (k) { var p = k.split("|"); add(p[0] + (counts[k] > 1 ? " ×" + counts[k] : ""), p[1]); });
    if (!s.captions) add("no captions");
    var cs = s.soundKey && D.captionSources[s.soundKey];
    if (s.captions && cs) add(cs.source === "transcript" ? "captions: as transcribed" : "captions: typed (" + (cs.source === "txt" ? s.soundKey + ".txt" : "brief") + ", " + cs.matched + "/" + cs.total + ")", cs.source === "transcript" ? "" : "medium");
    body.appendChild(chips);
    if (s.header) body.appendChild(el("div", "label", "header: " + s.header));
    if (s.title) body.appendChild(el("div", "label", "title: " + s.title));
    if (s.words.length) {
      var em = s.emphasis.map(function (w) { return w.toLowerCase().replace(/[^a-z0-9']/g, ""); });
      var words = el("div", "words");
      s.words.forEach(function (w) {
        var span = el("span", "w" + (em.indexOf(w.t.toLowerCase().replace(/[^a-z0-9']/g, "")) >= 0 ? " em" : ""), w.t);
        span.dataset.s = w.s;
        span.addEventListener("click", function (ev) { ev.stopPropagation(); seek(w.s); });
        words.appendChild(span); words.appendChild(document.createTextNode(" "));
      });
      body.appendChild(words);
    }
    if (s.note) body.appendChild(el("div", "label", s.note));
    (byShot[s.index] || []).forEach(function (f) { body.appendChild(el("div", "shotFinding " + f.level, (f.level === "fail" ? "FAIL " : "WARN ") + f.message)); });
    card.appendChild(body);
    card.addEventListener("click", function () { seek(s.start + 0.01); });
    $("shots").appendChild(card);
    cards.push(card);
  });

  // Follow the video: the playhead, the current shot, the word being spoken.
  var wordEls = Array.prototype.slice.call(document.querySelectorAll(".words .w"));
  var lastShot = -1, lastWord = null;
  var follow = function () {
    var now = video ? video.currentTime : 0;
    $("playhead").style.left = pct(now);
    $("now").textContent = t(now);
    var cur = -1;
    D.shots.forEach(function (s, i) { if (now >= s.start && now < s.start + s.seconds) cur = i; });
    if (cur !== lastShot) { if (cards[lastShot]) cards[lastShot].classList.remove("current"); if (cards[cur]) cards[cur].classList.add("current"); lastShot = cur; }
    var w = null;
    for (var i = 0; i < wordEls.length; i++) { var s = +wordEls[i].dataset.s; if (s <= now) w = wordEls[i]; else break; }
    if (w !== lastWord) { if (lastWord) lastWord.classList.remove("on"); if (w) w.classList.add("on"); lastWord = w; }
  };
  if (video) {
    var loop = function () { follow(); if (!video.paused) requestAnimationFrame(loop); };
    video.addEventListener("play", function () { requestAnimationFrame(loop); });
    video.addEventListener("seeked", follow);
    video.addEventListener("timeupdate", follow);
  }
  follow();
})();
</script>
</body>
</html>
`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
