# The editor, for people writing scripts and briefs

> Paste this into the context of whatever project writes your scripts and
> briefs. It says what the reel editor can do, what it cannot, and what that
> means for how you write. It is a digest: the full rules are in the editor's
> own repository (`AGENTS.md`), and the exact brief format is `HANDOFF.md`.
> Read `STYLE.md` for how many effects a reel can carry.

## 1. What it is

A short-form video editor driven by text. You hand it footage and a **brief**; it
produces a finished, verified vertical video. It is a general tool: it knows how
to cut, caption, zoom, annotate, animate and mix, and knows nothing about any
particular channel. Every creative choice arrives as input — in your brief, or
in a per-channel *look* (colours, fonts, sizes) that is set once.

What that means for you: **you decide what the reel says and where its beats
fall. The editor decides nothing creative on its own and measures everything it
can.** A brief that names moments precisely gets cut in one pass.

## 2. Facts that shape a script

- **Durations are measured from the recordings, never taken from the script.**
  Scripts under-budget speaking time badly. Budget *words*, not seconds
  (about 140 words a minute; `HANDOFF.md` §1 has the table).
- **Edits are pinned to spoken words.** A beat lands on a word, not a timecode,
  so it survives a re-cut. The word must appear **exactly once** in its line —
  "libraries" is a good anchor, "the" is not. If a line has no distinctive word
  where you want a beat, rewrite the line.
- **Dead air and "um"s are removed automatically.** Record naturally.
- **Captions are automatic** wherever there is speech. Never ask for them; only
  ask to *turn them off* somewhere. Names and jargon you will speak must be
  listed spelled as they should print (the transcript is where they go wrong).
- **Three text roles, one place each.** Captions at the bottom, titles at the
  top, and on B-roll a badge *or* a lower third at the bottom — never alongside
  captions. A shot that wants a fourth text is trying to say two things.
- **Frame size is a choice.** Vertical 1080×1920 is usual; the footage's own
  native resolution is what decides whether more is worth asking for.
- **Screen recordings stay native.** Do not pre-crop them to vertical; the
  editor crops, cards or zooms them. It never enlarges a picture past what was
  captured, and warns when a zoom would.
- **Position is measured, not given.** You cannot know where a button sits in
  the frame, so describe it ("the Deploy button, top right", "the third row").
  The editor measures the real position from a frame.

## 3. What you can ask for

Grouped by how loud they are (see §4). Each line is a thing a brief can say.

### Quiet — use freely
- **Cut** — the default. Most cuts should be plain.
- **Sharp punch / quiet punch** — a small push-in on a word; sharp for emphasis,
  quiet to hide a jump cut. A sharp one can carry a sound: *snap, whoosh, tick*.
- **Matched zoom** — between two takes of *you* talking: the outgoing take zooms
  in a little, the incoming starts there and eases back. Smoother than a blend.
- **Blend** — two shots overlap and zoom together. For two **B-roll** shots on
  one idea, never for two takes of a person (it double-exposes faces).
- **Slide** — one shot sweeps in over another, no zoom. For two clearly separate
  B-roll beats. A blend or slide crossfades its audio on its own.
- **Split edit** — the sound changes a few frames before the picture
  ("lead the sound into the screen demo") or after it ("let the hook audio trail
  a beat"). Six to twelve frames. Makes a dialogue cut feel motivated.
- **Voice under B-roll** — "keep the voice from `hook` going under this". Write
  the sentence at its natural length and let the picture cover it, instead of
  cramming it into a pause.
- **Title** (top, authored copy), **badge** (small label, bottom, B-roll only),
  **lower third** (name and role when someone is introduced), **ribbon** (a
  banner that flies in: a follow ask, a handle), and **emphasis words** — two or
  three words across the reel rendered bigger and in a second colour wherever
  they appear.
- **Music** — say the mood, or none. It ducks under speech by itself, and can
  start on a real beat of the track.
- **Ending** — freeze on the last frame, a generated close, or just end on the
  last word (the default).

### Medium — each should answer "where do I look?"; one at a time
- **Screen recording as a card** — the whole recording as a rounded, shadowed
  card floating over a blurred copy of itself, instead of cropped to fill the
  frame. It swings in with a slight 3D turn and comes flat.
- **Hand-drawn mark** — a circle, underline, box, highlight, bracket, strike or
  cross that draws itself over *one* thing, then fades. "On 'timeout', circle
  the 30s value in the config."
- **Click highlight** — a ring (optionally a dimmed spotlight, and an arrow if
  the recording shows no cursor) on whatever was clicked.
- **Click zoom** — the picture pushes in on a click so a small target is legible
  on a phone, then eases out. Needs a recording with real resolution. Don't
  combine with a mark on the same beat — pick which explains it.
- **Speed ramp** — part of a capture races, then eases to normal speed to land
  on one line ("run the build log at 4×, normal speed on 'failed'"). The
  footage's own sound is dropped under it, so say which voice continues.
- **Generated clips** (full content in `HANDOFF.md` §5):
  - **diagram** — nodes that assemble on your words; each can carry a plain icon
    (these draw themselves on; there are twenty-three, including phone,
    Bluetooth, map pin, key, cloud, document, globe, image, hidden-eye, server,
    AI sparkle, shield, user, clock and database), a UI mockup, a logo, or an
    imported animation (a radar pulse, a padlock snapping shut, a key swap, a
    shield closing and a self-ticking check ship ready to use); a **dot can
    travel along an arrow** between nodes, carrying a tag like `?data=…`, to
    trace how data moves;
  - **code** — a snippet that types itself with real syntax colouring; give a
    *second version* and the word it appears on and the code morphs into it,
    showing what changed;
  - **terminal**, **compare** (two states, wipe on a word), **data** (counters,
    bars, or a line/area trend), **callout** (focus box on a still), **image**
    (a freeze-frame close), **lottie** (an imported animation; supply the file
    and its licence), **chat** (a chat window with an AI reply that asks before
    loading an image, or shows approve/deny buttons — a safeguard as the real
    interface) and **page** (a web page with invisible text that a scan sweeps
    across and reveals — "an attacker hid a note", shown literally).
- **Split frame** — you visible in a band while a generated graphic advances in
  another, for when the viewer must see your face *and* the graphic.
- **Faceless reels (voice only).** Everything on screen is generated under your
  recorded voice. Each *section* can have a header (a pill like "TOOL 02" with
  progress dashes, or a typed `// how TLS works` comment with a blinking
  caret; a big title; a subtitle that changes on a word), its own accent colour,
  and a soft drifting glow behind its clips. Captions come in two looks: the
  usual lines with the spoken word in a coloured box, or "headline" captions
  that write the words big across the top as they are spoken, one sentence at a
  time, with chosen words in named colours.
- **A scene for "how it works".** Glowing wireframe things (laptop, server rack,
  hooded observer, phone, database…) placed in the frame, dotted wires between
  them, dots carrying a tag along the wires, and monospace notes that appear and
  change — each drawing itself on at the word that names it. For client/server,
  eavesdroppers, request journeys.
- **A row list.** Icon, title, a second line and a status mark, landing one by
  one under an optional browser bar — "what you get".

### Loud — a beat that should hurt. Two or three in a 30-second reel
- **Key-word slam** — one to three words land huge in the middle of the frame on
  the beat that names them: the punchline, the number, the verdict. "On 'free',
  slam FREE." A run of short ones is a rhythm. Not for a sentence.
- **Shake**, **flash**, **glitch** — the picture takes a hit, blows out, or
  tears. For a reveal, a punchline, a failure. Only the picture moves; text stays
  readable. A slam plus a shake on one word is one beat.
- **Orb** — a dotted sphere of light that reads as "an AI is working". Only for a
  line that says an AI is thinking, searching or listening with nothing real to
  show. It can pulse with the voice under it.

## 4. Restraint

The editor will do whatever the brief asks, so restraint is the brief-writer's
job. In short (the full guide, with pairings and recipes, is `STYLE.md`):

- **Loud moments: two or three per 30 seconds, at least three seconds apart,
  never two at once.** Quiet effects are free; medium ones one at a time.
- **First three seconds get one thing.** Not a mark or a click yet — the viewer
  hasn't found the picture.
- **The payoff gets the loudest moment; the ending is quiet.**
- **Clashes to avoid:** a slam on a shot that also has a title; a mark and a
  click zoom on one beat; flash plus glitch together; an effect on every cut;
  the orb as filler.
- Small event sounds (a tap on a click, a tick as a mark draws) play on their own
  in the editor's look. Don't ask for them.

## 5. What it cannot do

- **No generated video of a real interface or legible code.** Prefer captured
  footage, then generated clips from this list, then stock; reach for a video
  model last and say plainly it cannot render real UI.
- **Coordinates from you.** Describe things in words; the editor measures.
- **Recolour an imported animation.** It keeps the colours it was drawn with.
- **Slow footage below about half speed smoothly.** Source frames repeat.
- **Pick the take.** Which take is best, and whether a cut lands emotionally, is a
  human call made after the first cut. Say how many takes to shoot.
- **Replace watching it on a phone.** Every render ends with automatic checks of
  frame size, runtime, loudness and safe areas — they do not replace a viewing.

## 6. What a complete brief gives the editor

The checklist is in `HANDOFF.md` §7. In one breath: frame size and rate; a
runtime ceiling; a script split into named lines (exact filenames, take counts)
under the word budget; every anchor word appearing once in its line; every B-roll
moment with its source and its content; every generated clip written out in full;
the exact title/badge/lower-third copy; every name you will speak, spelled as it
should print; music mood or none; the ending; and — only where you care — the
moments you want, each pinned to a word. Anything left out comes back as a
question, or is proposed by the editor and shown for approval before it renders.

## 7. Phrases that work

- "On the word *libraries* in `hook`, cut to `screen-demo`."
- "On *obsolete*, sharp punch with a snap." / "On *ships*, quiet punch, no sound."
- "Show `screen-demo` as a card. On *timeout*, circle the 30s value in the config."
- "On *deploy*, ring the click on the Deploy button and zoom in on it."
- "Run the build log at 4×, ease to normal on *failed*; keep the voice from
  `middle` under it."
- "On *free*, slam FREE." / "On *broken*, shake."
- "Code, TypeScript: [snippet]. On *now*, change it to: [second snippet]."
- "Diagram, row, two nodes at a time: Prompt, Model, Code; show Prompt on *ask*,
  add Model on *generates*, move to Model and Code on *ships*."
- "Lower third on *Priya* — name and role: Priya Nair, platform engineer."
- "Keep the voice from `hook` under this B-roll; no captions here — the code on
  screen already says it."
