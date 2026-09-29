# Engine playbook

Everything the engine can actually do, and what using it on a real reel — many
rounds of feedback, many re-renders — taught about which capability fits which
moment in a script. `CLAUDE.md` is the rules and stays authoritative; this is
the practical layer on top: a capability catalog, and the judgment calls that
came out of applying it.

Written to travel — feed this whole file to a fresh Claude session working on
a different post, in this repo or a copy of it, so it doesn't have to
re-derive any of this from scratch.

---

## 1. Transitions — what actually reads as smooth

Five `Enter` kinds exist: `cut`, `punch`, `bandsOpen`, `blend`, `push`. Picking
between them is the single highest-leverage decision in a shotlist, and the
wrong one doesn't fail loudly — it just reads as "off" in a way that's hard to
name. The lessons below came from getting it wrong first.

### Two different takes of the same person, same background

**`blend` ghosts.** A cross-dissolve overlaps two shots' pixels for the
overlap window. If both shots are a moving person and their poses don't match
at the overlap instant — which they never will, across two separate takes —
the overlap is a literal double-exposure: two faces at once, however brief.
Confirmed by pulling frames mid-transition, not by assumption. This is true
regardless of overlap length; a longer blend just makes the ghost last longer.

**`push` reads as B-roll-fast.** It's opaque (no ghosting risk), but a
full-frame directional sweep is a lot of motion for two shots that are
already nearly the same picture — same person, same room. It reads as the
same style of cut used for flashing between screen recordings, not as an
A-roll beat.

**What actually works: a hard cut with matched zoom on both sides, no
overlap.** `exitPunch` on the outgoing shot (zooms in over its own last few
frames), `punch` on the incoming shot (starts at that same zoomed level,
eases back to rest over its own first few frames). Neither shot ever touches
the other's pixels — there is structurally nothing to ghost. Tune the two
sides independently:

```ts
const AROLL_ZOOM_PEAK = 1.06;

// The outgoing shot's build can be slow — a linear creep across its whole
// duration reads as ambient, ken-burns-like, not accented. Pass `frames`
// larger than the shot could ever run for; exitScale clamps its own start
// to frame 0 once frames >= durationInFrames, so it becomes one continuous
// ramp across the entire shot rather than a ramp confined to the tail.
const OUTGOING_ZOOM = { to: AROLL_ZOOM_PEAK, frames: 9999, easing: "easeOut" as const };

// The incoming shot's release should be shorter than the build — matching
// lengths on both sides sounds right but doesn't look right: an equally
// long release drags on a cut that's supposed to keep moving forward.
// 20-30 frames with easeOut (fast at first, decelerating into rest) reads
// as a deliberate release rather than a snap or a second slow build.
const INCOMING_RELEASE = { to: AROLL_ZOOM_PEAK, frames: 24, easing: "easeOut" as const };
```

A subtlety that cost a full round to find: `linear` easing on a long build
sounds like the textbook Ken Burns choice (constant velocity), but spread
across ~7 seconds the first second of a linear ramp moves so little that it
reads as the video pausing before it starts, not as a slow zoom. `easeOut`
front-loads the visible motion — legible from frame one — while still
landing exactly on the target value at the cut.

### Same take, split just to land a beat on a word

Not a transition between two things — one continuous shot with a percussive
moment marked on it. `blend` is actively wrong here (overlapping the same
footage against a slightly time-shifted copy of itself is its own kind of
ghost). The instinct is `punch`+`exitPunch` with a `hit` sound, matching the
A-roll pattern above — but if the split is close together in the same take,
there may not be enough picture change to sell a zoom on either side, and it
reads as an unmotivated wobble no matter how the frame count is tuned.
**Check whether the zoom is actually contributing anything by comparing
frames right before and after the cut.** If they already look near-identical,
drop the zoom to a plain `cut()` and keep only the sound:

```ts
enter: cut(),
hits: [{ at: 0, sfx: "snap", volume: 1 }],
```

The `hits` field fires a sound at an offset independent of `enter` — it
doesn't need a `punch` to exist. This is generally the more flexible way to
land a beat: use it whenever the sound is doing the work and a picture
change isn't needed to sell it.

### Two clearly different B-roll beats

`push` is the right default — the sweep itself signals "new idea," which is
exactly what two separate B-roll shots need. Motion blur along the direction
of travel is automatic (rule 7b), no shotlist field needed unless the
incoming shot carries text or UI that must stay legible mid-slide (`blur: 0`
in that case).

### Two B-roll shots that share a subject and continue one idea

`blend` is *for* this case specifically — the ghosting problem above only
applies to moving people with mismatched poses. Two static screenshots, or
two frames of the same UI mid-interaction, cross-dissolve cleanly.

### A-roll to B-roll, or back

A plain `cut()` almost always. The picture is already changing completely
(different subject, different framing), so a cut alone reads as a clean,
motivated edit — anything more is decoration with nothing to attach to.

---

## 2. Text roles and the shared motion language

Four roles, and each renders through its own component: `Title` (authored
claims, top of frame), `Badge` (small persistent B-roll labels, bottom of
frame), `Ribbon` (a banner that travels in and lands — motion graphics, not
type), `LowerThird` (a name/role card, quieter than `Ribbon` on purpose — a
slide-up and a fade, not a spring overshoot, because identifying who is on
screen should read as information arriving, not an event). Captions are
automatic wherever a transcript exists.

All three now share the same accent-sweep motif: a short rule that trails the
text in by a couple of frames, sweeping to full width/scale as it lands. It
started on `Title` (`engine/moves/Title.tsx`, `TitleStyle.accent`), and was
extended to `Badge` (`engine/moves/Badge.tsx`, `BadgeStyle.accent`) once
badges needed to read as the same *kind* of graphic as titles instead of a
plainer, unrelated style. `Ribbon` had its own accent from the start
(`RibbonStyle.accent`), timed off its spring settling rather than a fixed
delay.

```ts
// engine/tokens.ts — same shape, present on TitleStyle and BadgeStyle
accent?: { color: string; weight: number; width?: number };
```

Practical differences worth knowing before reusing this:

- **Title's accent width is frame-relative** (`accent.width * frame.w`) — a
  fixed-width mark under type of varying length. Right for a headline: one or
  two lines, roughly centred, a short rule under it reads as a flourish
  rather than a literal underline.
- **Badge's accent has no `width` field at all** — it's hardcoded to 55% of
  the plate's own content width in `Badge.tsx`, because badge text length
  varies far more than a title's (a five-word label next to a two-word one),
  and a frame-relative bar would look arbitrary against a tightly-wrapped
  plate. If a future look wants this configurable, add it back as a
  plate-relative fraction, not a frame-relative one — copying Title's
  approach verbatim onto Badge produces a bar that's sometimes wider than the
  badge itself.
- **Never scale text.** Both accents scale (`transform: scaleX(...)`); the
  text itself only ever fades and lifts (`opacity`, `translateY`). This is
  rule 9, and it's why the accent exists as a *separate* element rather than
  a border or underline styled onto the text node directly — those would
  inherit any scale applied to the text.

### One shared badge position, deliberately

Every badge in a reel should sit at the same `bottom` fraction — a badge that
jumps around from shot to shot reads as unplanned even when each placement
was individually reasoned about. Resist the urge to special-case one shot's
badge position to dodge a collision; first check whether the *crop* is
landing the content somewhere unusual relative to the other shots. Often the
fix is one shared position landing in that shot's own natural whitespace
gap, once you go looking for it — not a bespoke offset. (In practice: one
badge collided with a card's checklist after a recrop; the fix that stuck
wasn't a special position, it was noticing the shared default already landed
cleanly in a *different* gap on that same card — between the description and
the checklist, rather than between the checklist and the button.)

When a collision is real and a shared position genuinely can't clear it,
**compute the fix, don't eyeball it** — see §5.

### Captions and a badge on the same shot, on purpose

`verify.ts` fails a shot carrying both by default — the lower third is one
zone, and rule 15 already covers why. `ReelSpec.allowCaptionsWithBadge: true`
is the explicit opt-out, for a look where the badge genuinely sits clear of
the caption band (the default look's does, at `bottom: 0.27` against
captions at `0.20–0.25`) and the reel wants both on one shot rather than
choosing. It's a `ReelSpec`-level flag, not per-shot — checked both states on
a fixture before trusting it: fails without it, passes with it set, nothing
in between.

### A badge and a lower third, on the same shot

Same zone, same reasoning, but this one is a hard fail with no opt-out —
`verify.ts` treats the collision as certain, not a matter of where a look
happens to place things (unlike captions-plus-badge, which can genuinely
clear each other depending on the look's numbers). If a shot needs both a
persistent label and a name card, that's two shots or a rewrite, not a
position to hunt for.

### A watermark is reel-wide, not per-shot

`Tokens.watermark` (`src`, `corner`, `width`, `margin`, `opacity?`) renders
once in `Reel.tsx`, alongside `Hits`/`Bed`, not inside `ShotView` — it has to
survive every cut, so it can't be shot-scoped the way everything else in
this section is. `Img` from Remotion, not a plain `<img>`, so the render
waits for it to actually load rather than risking a blank first frame.

### A plate is a `Surface` now — gradient, glass, glow

`engine/moves/surface.ts` turns a `Surface` (`color`, plus optional
`gradient`/`glass`/`glow`) into CSS, and every plate (`Badge`, `Ribbon`,
`Caption`, `LowerThird`) is one. `color` always applies first and stays the
fallback — a plate with nothing else set renders exactly as every plate did
before this existed, which is how the whole existing look survived this
change with zero rendered difference.

- **`glass` needs something visually busy behind the plate to read as
  glass**, not just a translucent colour. Over a flat background the two
  are indistinguishable — checked directly: a glass plate over the look's
  own solid `bg` shows nothing `backdrop-filter` is doing, because there's
  no detail behind it to blur. Verified the blur itself is real (not
  silently dropped by the render pipeline, which is a genuine risk with
  `backdrop-filter` in some headless-Chromium setups) by rendering a glass
  plate directly over a high-contrast checkerboard: the pattern is visibly
  softened under the plate, sharp outside it.
- **`gradient` is opaque by default** (each stop is a solid colour), so it
  paints over whatever `glass` blur is doing beneath it — a plate with both
  set shows the gradient, not a blurred backdrop, unless the gradient's own
  stops carry transparency.
- **`glow` is a shadow with no offset** — `boxShadow: 0 0 <radius> <color>`.
  Subtle at small radii; a radius comparable to the plate's own size reads
  as a genuine halo rather than a thicker border.

### Text shadow can stack

`TextStyle.shadow` accepts one layer (unchanged from before) or an array.
Two layers is what actually reads as depth rather than a CSS default: a
tight, dark layer close to the glyph for edge contrast, a soft, larger one
further out for the sense the text is sitting slightly off the background.
`engine/moves/surface.ts`'s `textShadow()` joins every layer into one
`text-shadow` list; `text.ts` calls it unconditionally now, so a single
`shadow` object still works exactly as it always did.

### Three new easing curves, and where they don't belong

`easeOutBack` / `easeInOutBack` (a standard Penner-style overshoot,
implemented as a plain `t => number` function — Remotion's `interpolate`
`easing` option needs nothing more, no spring-specific handling) and
`easeOutExpo` (fast off the mark, long gentle tail). Validated against their
formulas directly before use: `easeOutBack(0) = 0`, `easeOutBack(1) = 1`,
peak overshoot `1.10` at `t = 0.58` — matches the closed-form expectation to
four decimal places.

`punch`/`exitPunch` accept these through the same `easing?: Easing` field
every other option uses (checked end to end: a punch with `easing:
"easeOutBack"` renders and settles correctly), but the *existing* default on
`punch` is deliberately restrained — `curve()`'s own comment says a punch
that decelerates into rest reads as a hit, and overshoot undercuts that.
Reach for the new curves on a `Ribbon` or `LowerThird` instead, where a
touch of bounce on arrival is the point rather than a distraction from a
percussive edit.

---

## 3. Generators — one clip, one job each

`engine/generators/`: `diagram`, `code`, `terminal`, `compare`, `data`,
`callout`, `image`. Each is a `GenSpec` variant, rendered exactly like
footage — cut, punched, reframed, captioned, banded.

- **`diagram`** — nodes and edges that assemble as the reel plays, and can
  advance on a spoken word. This is the one generator worth reaching for
  proactively: **any script line that's literally a list (two or three named
  things) is a diagram candidate**, not just another second of talking head.
  `steps[].at` is *shot-local* seconds — compute it as the word's absolute
  time in the source minus the shot's own start point, so a re-transcribe
  keeps it in sync automatically:

  ```ts
  const listStart = anchors(words.middle).start("first-item-word");
  // ...
  steps: [
    { at: 0, show: ["a"] },
    { at: anchors(words.middle).start("second-item-word") - listStart, show: ["a", "b"] },
  ],
  ```

  `layout: "column"` for a vertical short; `window` caps how many nodes are
  on screen at once before it pans (defaults to 3 for column, 2 for row).
  `pan: false` holds the frame on the whole strip instead of gliding to
  whichever nodes the current step shows — the right call for two
  alternatives side by side, which should arrive without the picture moving.
  It only works while the whole strip fits the `window`, because nothing ever
  pans to the rest: at `window: 2` (row) two nodes both sit in frame, three
  leave the outer cards mostly clipped, and four leave them off-screen
  entirely. For more than two, raise `window` or leave `pan` on.

  A node's `visual` draws a small mockup above its label instead of leaving
  the card as text only — line-art in the look's accent colour, so it reads
  as one system with the card's own border rather than a second
  illustration style dropped on top. Two families, don't mix them up:
  `button` / `spinner` / `debounce` / `checkout` / `receipt` / `booking` are
  UI-state mockups — reach for one where the script names a *specific*
  interface behaviour ("the button stays disabled until it debounces" is a
  `debounce` node, not three more seconds of talking head explaining what a
  debounced button does). `check` / `cross` / `arrow-right` / `star` /
  `lock` / `warning` / `info` / `trend-up` are a plain icon set with no UI
  attached, for a concept a script names directly ("done," "blocked," "a
  warning") — reach for these far more often; most nodes name a concept, not
  a UI. `debounce` specifically animates (ripples radiating outward); every
  other built-in is static. `{ src: "assets/..." }` is the escape hatch for
  anything not in either set — a logo, a brand mark — drawn at the same
  footprint (`u(52)`, `objectFit: "contain"`) so it slots into a row of
  built-ins without shifting the layout.

  Rendered all of this in a fixture before trusting it: four nodes in one
  row — three icons and a custom image — all distinct, legible, and the
  active/inactive UI pair (`button` vs `debounce`) reading as two different
  states rather than the same icon twice.

- **`data` with `style: "line"` or `"area"`** — a real trend, not independent
  figures. `counter`/`bars` treat `items` as separate quantities, each with
  its own colour; `line`/`area` treat the same array as one series in order,
  plotted against `label`, with the *whole line* taking its colour from
  `items[0].color` — a trend is one thing being tracked, and per-point
  colour is what the other two styles are for. Reach for it on a script line
  making a comparison across more than two points ("usage over time"); two
  points alone is still better served by `compare`.

  The reveal draws the line on rather than showing it whole: point
  geometry (x from index, y from value against the series' own min/max) is
  known directly in JS, so the path length for `strokeDashoffset` is summed
  from the segments rather than read via `getTotalLength()` — nothing here
  needs a DOM measurement to find out what it already has. `area` adds an
  SVG `linearGradient` fill fading to transparent under the same path, not a
  `Surface` gradient — SVG fills and CSS `background-image` gradients are
  different mechanisms, and forcing the token-level `Gradient` type into an
  SVG context would need its own translation layer for one generator.
  Rendered against a five-point series before trusting it: the zigzag shape
  matched the data, dots landed in step with the stroke as it drew on, and
  the final point's value highlighted correctly once the line reached it.

- **`image`** — a plain full-bleed still. Distinct from `callout`, which
  *always* draws a focus box and dims everything else. Reach for `image`
  specifically when the picture itself is the point and any added emphasis
  would be in the way — a freeze-frame closing a reel, most obviously.
  Extract the still with ffmpeg at the exact timestamp the last shot ends,
  not a round number: `ffmpeg -ss <precise-cut-point> -frames:v 1 -update 1
  out.jpg`.

- **`callout`** — the right choice specifically when a viewer's eye needs to
  be *directed* to one region of a busier image (a focus box + dim), not just
  shown a still.

- **`code` / `terminal` / `compare` / `data`** — reach for these when the
  script names something abstract that has no footage of it (a metric, a
  before/after, a snippet) rather than trying to screen-record it. Per
  `CLAUDE.md`: captured footage first, generated second, stock third, a video
  model last — a generator is what fills the gap when nothing was captured
  and stock would be generic.

  Two things worth knowing for `data`: each item takes `at`, seconds into the
  shot when that figure starts to grow, so a number can land on the word that
  says it (`anchors(words.x).start("hundred") - shotStart`, the same
  shot-local arithmetic as a diagram's `steps[].at`); omit it and the items
  start together, staggered slightly. And `compare` centres itself in the
  space above the badge band, not the whole frame, so it stays clear of a
  label.

- **`tokens.generators.textScale`** — multiplies the type in `diagram`,
  `compare` and `data` (1 is unchanged, and absent means 1). Those clips were
  drawn for a full frame and read small on a phone once one sits in a band or
  carries little text. It is a property of the look, so it applies to every
  generated clip in every reel that uses that look; a `diagram` card grows in
  height with it and keeps its width, so the layout does not move.

### Split-screen: a talking head plus a generator, at once

`bands` divides the frame into regions, each with its own `source`. The
useful case for a script that has a "while I'm saying this, show that"
moment: top band a generated diagram, bottom band the *same take* still
talking, live.

```ts
{
  in: cutawayStart,
  seconds: cutawayEnd - cutawayStart,
  bands: {
    regions: [
      { height: 0.44, from: "top", source: { type: "diagram", /* ... */ } },
      { height: 0.56, from: "bottom", source: "middle" }, // same key as the shot before it
    ],
  },
  enter: bandsOpen({ frames: 12, easing: "easeOut" }),
  captions: false, // the diagram's own labels already show the words
}
```

Two things that aren't obvious from the type signature:

- **All regions share the shot's own top-level `in`.** A band used to always
  play its source from frame 0 regardless of `in` — meaning a live-talking
  band would restart the take from 0:00 instead of picking up where a
  preceding full-frame shot on the same take left off. Fixed in
  `engine/ShotView.tsx`'s `Bands` component to pass `resolved.shot.in`
  through as each region's `sourceStart`. A generated region ignores it (no
  source-time concept); a video region uses it to continue mid-clip. If this
  regresses, it'll look like a talking-head band jumping back to the start of
  the raw file instead of continuing the sentence.
- **No `audio: "hold"` needed for the live band** — it's not standing in for
  the take, it *is* the take, still playing, so it carries its own native
  audio directly like any ordinary shot. `audio: "hold"` is for a *different*
  shot pretending to be silent B-roll over someone else's voice; a banded
  region showing the actual speaker doesn't need the pretense.
- **A `hold` straight after a band replays the band's words.** The band's
  live region carries its own sound inside its video element, which the
  timeline does not track, so a following `audio: "hold"` resumes from where
  the shot *before* the band stopped and plays the band's speech a second time
  (found on 007: "body like POST" heard twice, "fetch call…" never). After a
  band, give the next shot `audio: { from: "<take>" }` with its `in` set to
  the band's last frame, and dump the timeline's sound segments to confirm the
  source time runs on without overlap.
- **Reframe the video region.** A talking-head take cropped from its native
  vertical framing down into a short, wide band needs its own `regionAt` —
  the default center-crop from source-center rarely lands on the actual face
  position once the region is this much shorter. See §5 for how to compute
  it without guessing.

---

## 4. Sound

- **`hits`** — a sound at an offset within a shot, independent of any `enter`.
  Use this whenever a beat needs marking but a zoom isn't earning its keep
  (§1). `{ at: 0, sfx: "whoosh"|"snap"|..., volume: 0.5–1 }`.
- **`audio: "hold"`** — the previous shot's voice keeps running under this
  one. Rule 13's whole point: B-roll goes *on* a sentence, not after it.
  Check whether captions should follow (they follow the voice automatically)
  or whether the picture already shows the words being said, in which case
  `captions: false` on that shot avoids saying the same three words twice on
  screen at once.
- **`audio: { lead: n }` / `{ trail: n }`** — split edits (J-cut/L-cut), 6-12
  frames. A J-cut (`lead`) is the stronger of the two — hearing where you're
  going before you see it is what makes a cut feel motivated.
- **`audio: { from: "hook" }`** — a named clip's sound under this whole shot,
  read off the shot's own `in`, `seconds` and `drop` as if that clip were its
  source. `hold` continues whatever played *last*, which is the wrong voice
  when B-roll *opens* a take: a graphic that starts before its speaker does.
  A later `hold` continues from wherever this one stops. Because it follows
  the shot's own timeline, a `drop` on the shot tightens the voice with it.
- **`hold` under a `blend` or `push`** needs nothing from you. The overlap
  puts this shot's picture on screen early, over a previous shot whose sound
  is still playing those frames, so held sound begins where the previous
  sound *ends*, not where the picture does; starting it with the picture
  plays that stretch of speech twice.
- **`dips: [{ at, frames, to? }]`** — duck the music bed for `frames` frames,
  `at` seconds into the shot, to the look's `mix.dipTo` unless `to` says
  otherwise. A `hit` already ducks the bed briefly as a side effect; use a
  dip when the music should be out of the way for as long as a word takes to
  land, with no sound effect. It ramps in and out, so a sustained track does
  not click.
- **The bed and looping.** `bed.track` loops when the reel outlasts it, and
  the level curve counts the *reel's* frames (`loopVolumeCurveBehavior:
  "extend"`), which is what keeps a dip or the closing fade on the frame you
  asked for. A reel that seems to ignore its dips or never fades out is the
  first thing to check against this. `node scripts/make-music.mjs` writes a
  16-second default to `public/assets/music/pulse.wav`; that folder is not
  committed, so each machine generates or supplies its own.
- **A bed that enters and leaves on a shot.** By default the bed plays from
  the reel's first frame and fades only over its last `tailFade`. `bed:
  { startShot, fadeInFrames?, fadeOutShot, fadeOutFrames? }` pins the
  entrance and a mid-reel exit to shot *indexes*, so they follow the picture
  through any re-cut: the track starts from its own first bar on that shot's
  first frame (silent before), and ramps to silence over `fadeOutFrames`
  starting on the exit shot. Measured on a rendered file, not assumed. Levels
  are still set by `underSpeech`; check them against the voice's loudness (a
  -12.5 LUFS track under a -11 LUFS voice needed ~0.13), and give a `dips`
  entry its own `to` when the bed already sits below the look's `dipTo`.
- **`bed.trackIn` — where in the *file* the bed starts reading, independent
  of `startShot`.** File offset 0 is wherever the track happens to begin,
  usually a quiet intro built for a loop point rather than for landing on a
  reel's hook. `npm run beats <track>` writes a `<track>.beats.json` next to
  the file (not committed, like the music folder itself) with BPM, a
  confidence score, and candidate start points already snapped to a real
  beat — pass the one that fits as `trackIn`, paired with `startShot` so the
  beat lands on the exact frame the music enters.

  The detector is a plain energy-flux autocorrelation, nothing more —
  validated against a synthetic click track with a known, exact grid before
  it was trusted on real audio, which caught a real octave error (the raw
  peak was the track's own half-time echo). Locating one precise beat deep
  into a real track needed a different approach than locating tempo: the
  global phase, extrapolated from the track's start, drifts across the
  dozens of bars to a late candidate even with a near-exact tempo estimate
  (measured: 146ms off, close to a third of a beat, forty-some seconds in).
  Picking "the single loudest transient nearby" as a local fix isn't
  reliable either — real percussive music has several beats of comparable
  loudness close together, so the answer changes with the search window's
  width, which is what a genuinely local fix should never do. What holds up:
  a local comb filter, averaging several real beats around the candidate
  instead of trusting either one extrapolated beat or one single loudest
  sample — cross-checked with an independent reimplementation at a different
  window and hop, landing within 31ms.

  Confidence below roughly 2 means the track probably has no hard beat at
  all (strings, ambience) — a real finding, not a weaker version of the same
  number. Its section-energy candidates are still worth using; they're about
  where the track gets louder, which needs no beat grid to be meaningful.
- **`matchGrade()`** — keep strength at or below the 0.5 default between
  *different-subject* clips (a screen recording vs. a face); push it higher
  only between two takes of the literal same subject (matching a CTA take
  back to an earlier A-roll take of the same speaker, same setup). Read
  `npm run grade`'s own percentage-apart figure before deciding — it
  explicitly flags when a number reads as "far apart, look at both before
  correcting" vs. "already reads as the same reel."

---

## 5. Cropping — compute it, verify it, don't eyeball it

`regionAt(sourceW, sourceH, frame, { centreX, centreY, zoom })` builds a
frame-aspect rectangle in source pixels, centred and zoomed. Three traps,
each one found by a crop looking wrong after rendering rather than by
reading the code:

### Raw dimensions vs. conformed dimensions

`npm run ingest` may conform an oversized source down to different pixel
dimensions than the raw file reports. **`regionAt`'s `sourceW`/`sourceH` must
match `media.json`'s `width`/`height` for that key — not whatever `ffprobe`
says about the raw file.** Using the raw file's stream dimensions against a
conformed source puts the crop rectangle in the wrong coordinate space
entirely; the symptom is a crop that's positioned nowhere near where it
should be — centred on the wrong region and/or clipped to black past the
source's own bounds — and it will look *plausible enough* at a glance that it
takes a side-by-side frame comparison to catch. Always check
`media.json[key].width/height` before writing the `regionAt` call, and if a
frame looks off after rendering, check this first.

### Measure the actual pixels, don't estimate from a description

Extract the frame the crop will start from (`ffmpeg -ss <in-point> -frames:v
1 -update 1 out.jpg` on the exact source file `media.json` points at), read
it back, and get real pixel coordinates for whatever the crop needs to
center on or avoid — a face, a UI panel's edge, a piece of chrome to exclude.
A crop tuned from a rough description of "the sidebar" or "her face" needs
one or two more rounds than a crop tuned from measured pixels on the actual
frame.

### Enlargement past capture is a warning, not a wall

`verify.ts` flags any crop smaller than the delivery frame ("enlarges the
source past what was captured") — real information, not a failure. Zooming
in past native resolution is sometimes exactly the right call (removing a
distracting background element, tightening on the actual content) even
though it costs some sharpness. Make that trade-off consciously, note *why*
in the shotlist, and expect the warning to keep appearing — it's not a bug to
silence, it's confirmation the trade-off is still the one you're taking.

### Computing a collision fix instead of trial-and-error

When a badge (or any positioned text) needs to clear specific content —
"land in the gap between X and Y" — trial-and-error on the position value
burns a render cycle per guess and doesn't converge reliably, especially once
more than one variable is changing between attempts (a font size bump *and*
a crop change at the same time will make manual position tuning actively
misleading — a value that looked wrong for one reason might actually be
wrong for a completely different reason). Compute it instead:

1. Badge/text block height = `lineHeight * fontSize + 2 * platePadY` (in
   design pixels — same units as `designWidth`, so this equals delivered
   pixels when `frame.w === designWidth`).
2. Map the two content anchors (X's bottom edge, Y's top edge) from source
   pixels through the crop's own `coverRegion` scale into delivered-frame
   coordinates: `scale = max(frame.w / region.w, frame.h / region.h)`,
   `delivered_y = (source_y - region.y) * scale`.
3. Center the text block in the resulting gap; convert back to a `bottom`
   fraction: `bottom = (frame.h - text_bottom_edge) / frame.h`.

This lands correctly on the first render essentially every time, versus
several rounds of eyeballed misses. Worth doing as soon as a second guess
would otherwise be needed — the arithmetic takes less time than one extra
render-and-check cycle.

---

## 6. Pacing — pauses, breaths, and slivers

- **`tighten()` / `pauses()` / `fillers()`** (`engine/words.ts`) — never
  guess a `longerThan` threshold; run `npm run tighten <post>` and use
  exactly what it reports as actually removable. It shows three preset
  thresholds and the longest silences by name, so the choice is which real
  gap to cut, not a number pulled from nowhere.
- **A word's own transcribed start time can be wrong, especially the very
  first word of a take.** Forced alignment sometimes clamps the first
  token's start to `0` regardless of what's actually there — a real bug seen
  in practice, not a hypothetical: a take began with a short breath/click,
  then genuine silence, then real speech, and the transcript nonetheless
  reported the first word starting at exactly `0.000`. If a `LEAD`-style
  trim (`anchors().start(word) - pad`) still leaves audible room-tone or a
  breath at the very start of a shot, don't trust the word timestamp —
  confirm the true onset with `ffmpeg -i file.mp4 -af
  silencedetect=noise=-30dB:d=0.1 -f null -` and set `in` from the measured
  silence boundary instead.
- **`pad` can leave a sub-threshold sliver.** `tighten()`'s default `pad`
  (0.08s) protects the words on either side of a drop, but if a drop lands
  close to the shot's *own* boundary (not another word), the small leftover
  stretch between the drop and the boundary can end up shorter than
  `verify.ts`'s own 6-frame stutter floor — which reads as a glitch, not a
  clean cut. `verify.ts` catches this ("keeps N stretch(es) shorter than 6
  frames") but **only prints at composition load, not necessarily inside a
  full render's tail-checked output** — see §7. Widen `pad` for that specific
  `tighten()` call until the math clears 6 frames; it can be computed exactly
  the same way as §5, working from the known word gap and the shot's cut
  point rather than guessed.

---

## 7. Workflow

- **`npx remotion still ./engine/index.ts <post-id> out.jpg --frame=<n>`**
  renders one frame in a few seconds, versus a full render taking minutes.
  Use it for every crop/position/motion iteration; save the full `npm run
  render` for once a shotlist change is believed correct. This is the
  single biggest speed multiplier for the kind of tuning in §2 and §5.
- **`verify.ts` findings print when the composition loads** (bundling, before
  any frame renders) — via `console.warn` in `engine/Root.tsx`. A full render
  reprints file-based gates at the end but doesn't necessarily re-surface
  these load-time warnings in the same tail of output; check the *whole* log,
  or just run `remotion still` on any frame, which reliably reprints them
  every time. Don't conclude a shotlist is clean just because the last 50
  lines of a render looked clean.
- **Every render saves a take automatically** (`out/<post>/takes/<n>/`,
  rule 16). Nothing is ever silently lost by rendering over a previous
  version — `npm run takes <post> -- --diff <a> <b>` is the fastest way to
  understand *why* a duration or a frame changed between two renders, faster
  than re-deriving it from memory.
- **Two `post.json` keys, set before the stage they belong to.**
  `"vocabulary": ["Vercel", "AGENTS.md"]` goes to Whisper as its initial
  prompt at `transcribe`, so a proper noun that would otherwise be heard as
  something common ("Vercel" as "Varsal") comes out as spelled and stays that
  way across re-transcribes — the fix to reach for instead of editing
  `words.json` by hand, which the next transcribe erases. It raises the odds
  rather than guaranteeing them, so read `transcript.md` afterwards.
  Separately, transcribe now rejoins an extension Whisper splits off
  (`AGENTS` + `.md`) into one word, so a caption does not print a space
  inside a filename; it leaves a sentence-ending period, and a `.md` that
  follows a word already ending in one, alone.
  `"conform": { "width": 1440, "keys": ["hook-1"] }` brings the named clips
  (every clip, if `keys` is omitted) down to that width at `ingest`. Use it
  for 4K phone footage that a crop will never use the extra resolution of and
  that is expensive to decode; clips it does not name keep the default limit
  of twice the frame width. Conforming changes a clip's dimensions, so
  `regionAt` must be given the *conformed* width and height from
  `media.json` (§5), and ingest will not redo a clip it has already
  conformed — delete `conformed/` to apply a new width.

---

## 8. Reading a script for engine fit

A rough pass to make before writing a shotlist, beyond the moment-by-moment
transition/emphasis calls `CLAUDE.md` already asks for:

- **Any line that names a short list of things** (two or three named items,
  a sequence of steps) — candidate for `diagram` with word-anchored steps,
  live under a banded talking-head region if the speaker shouldn't
  disappear while saying it.
- **Any line making an abstract claim with no footage of it** (a number, a
  comparison, a before/after) — candidate for `data`/`compare`/`terminal`
  rather than stretching captured footage to cover something it doesn't
  show. A claim tracked across more than two points ("usage over time," not
  just "before and after") is specifically `data` with `style: "line"` or
  `"area"` — §3.
- **The moment a new speaker is introduced** — candidate for
  `Shot.lowerThird`, not a title card. A title states a claim; a lower third
  identifies a person, and doing that with a title reads as the reel making
  a statement about someone rather than naming who they are.
- **The closing line** — if it ends on a beat worth freezing on rather than
  cutting to black, `image` with a still pulled from the exact last frame of
  the final take is close to free (no new footage, no generator content to
  design) and reads as a deliberate close rather than the video just
  stopping.
- **Every A-roll-to-A-roll cut** (different takes, same speaker) — decide up
  front whether it's getting the matched-zoom treatment from §1, and budget
  for it looking wrong on the first attempt; this took the most iteration of
  anything in this playbook to get right, twice (once during initial cutting,
  once more after motion was reconsidered on feedback).
- **Every place text is about to go up a fourth time in one shot** — rule 15
  already says there's no fourth position; if a shot wants a title *and* a
  badge *and* a ribbon, that's the shot trying to say more than one thing,
  and the fix is almost always splitting it rather than finding room.
