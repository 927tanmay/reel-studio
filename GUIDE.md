# Cutting your first reel

A walkthrough with a talking-head recording and a script. Every command is run
from the repository root.

---

## Once, before the first reel

```bash
brew install uv
```

Only transcription needs it. `ffmpeg` and `npm install` are already done.

---

## 1. Create the post

```bash
npm run new 001-first -- --frame 1080x1920 --max 45
```

Pick the frame and the ceiling now. They change what every later decision means.
A square carousel slide would be `--frame 1080x1350`.

This creates `public/posts/001-first/` with `raw/`, `clean/`, `post.json`,
`brief.md` and a starter `shotlist.ts`, and registers the post so the studio
sees it.

---

## 2. Drop your footage into `raw/`

```
public/posts/001-first/raw/
  hook.mov          ← you, to camera
  middle.mov        ← you, to camera
  cta.mov           ← you, to camera
  screen-demo.mov   ← screen recording
```

**Filenames become the names you use in the shotlist.** `hook.mov` becomes the
key `hook`. Name them for what they are, not `IMG_4821.MOV`.

**Several takes of one line:** name them `hook-1.mov`, `hook-2.mov`. Both get
ingested; you choose which key goes in the shotlist. Nothing picks for you.

**Screen recordings:** do not pre-crop them to vertical. Leave them at whatever
the Mac recorded. Cropping happens at edit time so there is room to pan.

---

## 3. Write the brief

Open `public/posts/001-first/brief.md` and fill in every slot. Paste your script
underneath. The templates are in `DIRECTION.md`.

If your scripts come from somewhere else, give that project `HANDOFF.md`. It is
the full specification for a brief, including the word-count budget and the
checklist, so what arrives here is already complete.

A slot you cannot fill is a decision nobody has made yet. Better to notice that
now than halfway through the edit.

---

## 4. Ingest

```bash
npm run ingest 001-first
```

Reads what each file actually is and writes `media.json`.

```
  ✓ hook          1080x1920 vertical  8.42s  audio
  ✓ screen-demo   3456x2234 horizontal  11.80s  silent
```

Check the orientation line. Phone footage often reports landscape with a
rotation flag, and this is where you find out. Anything wildly oversized gets
conformed; everything else is left alone.

---

## 5. Transcribe

```bash
npm run transcribe 001-first
```

Writes two files from the same data. `words.json` is for the engine, which
imports it when building the composition. `transcript.md` is the readable one,
about fifteen times smaller, and it is what you and I both read when deciding
where to cut. Nothing is uploaded.

The first run downloads the Whisper model, roughly 1.5 GB, and takes a few
minutes. Every run after that is fast.

It also reports your real speaking pace. If the takes already exceed the
ceiling, you find out here rather than after cutting.

---

## 6. Build the shotlist

Either open the folder in Claude Code and say:

```
/cut 001-first
```

and I will read the manifest, the transcript and the brief, propose the shotlist
as text, and wait for your approval. Or write it yourself.

Here is a real one for a talking head plus a screen recording:

```ts
import { blend, punch, reel } from "../../../engine/spec";
import { regionAt } from "../../../engine/scale";
import { anchors } from "../../../engine/words";
import tokens from "../../../projects/default/tokens";
import config from "./post.json";
import media from "./media.json";
import words from "./words.json";

// Word anchoring for the hook take.
const at = anchors(words["hook"] ?? []);

// Two frame-shaped crops of the screen recording, to pan between.
const demo = media["screen-demo"];
const wide  = regionAt(demo.width, demo.height, config.frame, { zoom: 1.0 });
const tight = regionAt(demo.width, demo.height, config.frame, {
  zoom: 1.4,
  centreX: demo.width * 0.62,
});

export default reel({
  id: "001-first",
  frame: config.frame,
  target: config.target,
  style: tokens,
  media,
  words,

  shots: [
    // A word-anchored punch inside one take: split the take at the word.
    // No `captions: true` needed — the hook clip has a transcript, so it
    // gets captions on its own.
    { src: "hook", seconds: at.start("everything") },
    {
      src: "hook",
      in: at.start("everything"),
      enter: punch({ to: 1.05, frames: 9 }),
    },

    // Screen recording, cropped tight and pushing in. Never scaled alone.
    // No transcript on this clip, so no captions appear — just the badge.
    {
      src: "screen-demo",
      in: 2.0,
      seconds: 3.4,
      reframe: { from: wide, to: tight },
      badge: "the generated component",
      enter: punch({ to: 1.08, frames: 5, hit: "snap" }),
    },

    // A diagram that advances on the words you say.
    {
      src: {
        type: "diagram",
        layout: "row",
        window: 2,
        nodes: [
          { id: "prompt", label: "Prompt" },
          { id: "model", label: "Model" },
          { id: "code", label: "Code" },
        ],
        edges: [
          { from: "prompt", to: "model" },
          { from: "model", to: "code" },
        ],
        steps: [
          { at: 0, show: ["prompt"] },
          { at: 1.5, show: ["prompt", "model"] },
          { at: 3.0, show: ["model", "code"] },
        ],
        seconds: 4.5,
      },
      // A real cross-dissolve from the screen recording, not a hard cut: this
      // shot fades in on top of it while both zoom together.
      enter: blend({ to: 1.1, frames: 8 }),
    },

    // Closing line. No seconds, so it runs as long as the take.
    { src: "cta" },
  ],

  bed: { track: "your-track.mp3" },
});
```

Four things worth noticing:

- **No `seconds` on the talking-head shots.** Their length comes from the files.
  Never write a duration a script implied.
- **`at.start("everything")`** survives a re-cut, a take swap and a trim. A
  number like `4.2` is wrong the moment anything upstream changes.
- **`regionAt`** builds rectangles that already match the delivery aspect, so a
  crop can never distort.
- **No `captions` field anywhere.** Any shot with a transcript gets captions
  automatically; the screen recording has none, so it stays silent-on-screen
  except for its badge. Write `captions: false` only to turn them off somewhere
  they would otherwise show.

---

## 7. Preview while you iterate

```bash
npm run studio
```

Pick `001-first`, scrub, change the shotlist, watch it reload. Findings from the
pre-render checks print in the terminal when it loads — text inside a zone the
interface covers, a crop that would enlarge the source, a runtime over the
ceiling.

---

## 8. Render

```bash
npm run render 001-first
```

Renders, brings the mix to the loudness target, then checks the file:

```
  ✓ Frame  1080x1920
  ✓ Rate   30 fps
  ✓ Length 41.20s, under the 45s ceiling
  ✓ Size   14.8 MB
  ✓ Codec  h264
  ✓ Loud   -14.2 LUFS
  ✓ Frames out/001-first/frames
```

The file is `out/001-first/reel.mp4`. Frames are pulled out next to it so you
can look at what actually rendered.

---

## 9. Watch it on your phone

AirDrop it. Nothing in step 8 tells you whether a crop reads at phone size, or
whether the cut lands. That judgement is yours and no gate replaces it.

---

## Optional extras

**Repaired audio.** Export the audio, run it through whatever you use, drop the
result into `clean/` named after its key (`hook.wav` for the `hook` clip), then:

```bash
npm run align 001-first
npm run transcribe 001-first
```

Align measures how far the returned track slipped and corrects it, so the
one-or-two-frame drift stops being something you fix by hand. Re-transcribe
afterwards so the word timings match the audio the viewer will hear.

**Music.** Drop a file into `public/assets/music/` and name it in `bed`. It sits
low under speech, comes up in the gaps, ducks on every hit and fades at the end.

**Your own look.** Copy `projects/default/` to `projects/<your-channel>/`, change
every value, and import that in your shotlists instead. Palette, type, caption
style, safe zones, punch presets and mix levels all live in that one file, and
every reel pointed at it inherits changes.

**A cover frame.**

```bash
npm run render 001-first -- --still 3.2
```

**Manual tweaks in a real editor.** Some things are just faster by hand — a
frame trimmed by eye, a shot dropped, a quick color pass. After rendering:

```bash
npm run export-timeline 001-first
```

This writes `out/001-first/timeline.edl`. Open DaVinci Resolve (free — the
best option that doesn't gate export behind a paid tier), put `reel.mp4` in
the same folder as the `.edl` first, then File → Import → Timeline and pick
it. Every shot lands as its own clip: select, trim, delete, reorder, or grade
any one of them without touching the rest.

This first version keeps things simple on purpose: every clip is a slice of
the already-rendered `reel.mp4`, not the original raw footage, so you can
rearrange and trim the cuts that exist but not yet reveal more of a take than
the shotlist chose to show. Once you export from Resolve, that new file is
just a video like any other — `npm run ingest` on it as a new post's raw
footage, and it re-enters the pipeline from there. Nothing about round-
tripping through a manual pass requires the shotlist to have been perfect the
first time.

---

## The second reel onward

```bash
npm run new 002-next -- --frame 1080x1920 --max 45
# footage into raw/, brief.md filled in
npm run ingest 002-next && npm run transcribe 002-next
# /cut 002-next  in Claude Code
npm run render 002-next
```
