# Producing a reel brief

> Paste this file into the context of whatever project writes your scripts. It
> describes exactly what that project must hand over so the reel can be cut in
> one pass. It is the contract between "here is the idea" and "here is the cut".

You are the upstream. Your output is not a script, it is a **brief**: a script
plus every decision the edit depends on. A brief that is missing decisions turns
into three rounds of questions, and each round costs real time and tokens.

Deliver one file per reel: `brief.md`. The template is at the bottom.

---

## 0. Frame size is a real choice, not a default

`1080x1920` is the usual pick, not a ceiling. The editor renders whatever
frame you state — vertical, square, a different aspect, or a higher
resolution — with no extra work. What decides whether a higher resolution is
worth asking for is your **footage's own native resolution**, not the
platform: state it if you know it (`ffprobe` on the raw file, or just note
"shot on an iPhone 15" and let the editor check). Talking-head footage shot
on a recent phone is often native 4K vertical and has real headroom above
1080p; a screen recording is whatever the screen actually was, and asking
for a delivery frame bigger than that source makes it softer, not sharper.
Most platforms re-encode down to roughly 1080x1920 regardless of what you
upload, so a bigger frame mainly pays off if the master gets reused
somewhere else, not for how it looks once posted — say so if that's the
goal.

---

## 1. Budget the words, not the seconds

Speaking pace is the single thing scripts get wrong. Measure your own once, then
plan against it. A reasonable starting number is **140 words per minute**.

| Speaking time | Words you can fit |
|---|---|
| 20s | ~47 |
| 30s | ~70 |
| 40s | ~93 |
| 50s | ~117 |

**Speaking time is not runtime.** If a 40-second reel has 10 seconds of silent
B-roll, you have 30 seconds of speech, which is ~70 words, not 93.

So budget like this:

```
runtime ceiling  −  silent B-roll seconds  =  speaking seconds
speaking seconds  ×  (your wpm ÷ 60)       =  your word ceiling
```

Write to that number. Going over is not a rounding error; it is the most common
reason a reel has to be re-planned after recording.

**Dead air and fillers get removed automatically — don't budget around them.**
A real pause, an "um", a false start: the editor measures these from the
actual recording and tightens them without being asked. Record naturally
rather than trying to speak without pausing; the edit will read as tighter
than the take did.

---

## 2. Split the script into named lines

A-roll is recorded one line at a time, so the script must arrive already split,
and each piece must have the **exact filename** it will be recorded as.

```
hook.mov      "Everything you know about component libraries is about to change."
middle.mov    "The model writes the whole thing now. You just review it."
cta.mov       "Follow for the parts nobody tells you."
```

Rules for those names:

- Lowercase, hyphens, no spaces. `screen-demo`, not `Screen Demo`.
- The filename without its extension becomes the name used throughout the edit.
  Name things for what they are.
- Several takes of one line are `hook-1.mov`, `hook-2.mov`. Take selection is a
  human call made later; just say how many to shoot.

---

## 3. Choose anchor words deliberately

Edits are pinned to spoken words rather than timecodes, because a word survives
a re-cut and a timecode does not. That only works if the word you name is
findable.

**An anchor word must appear exactly once in its line.** If you want a punch on
"change" and "change" is said three times in that take, the anchor is ambiguous
and the edit will land in the wrong place.

Good: `On the word "libraries", cut to the screen recording.`
Bad: `On the word "the", cut to the screen recording.`

The beats you can ask for at a moment are: a plain cut, a sharp punch, a quiet
punch, a **blend** (two shots overlap and zoom together instead of meeting at a
hard edge), a **slide** (one shot sweeps in and covers the other, no zoom), a
band opening, or a dip in the music. Both blend and slide crossfade their own
audio automatically, even if the picture doesn't. A punch can carry a sound;
the ones that exist are **snap**, **whoosh** and **tick**. Ask for any other
sound and someone has to go find it first.

**Blend is for B-roll, not for two takes of you talking.** Ask for it between
two B-roll moments that share a subject and should feel like one continuous
idea — two screenshots, two states of the same UI. Between two different
takes of a person (hook cutting to middle, say), a blend overlaps two moving
faces mid-motion and the overlap reads as a literal double exposure, however
brief. If you want two A-roll takes to feel smooth into each other, ask for
**matched zoom** instead: the outgoing take zooms in a little over its last
stretch, the incoming take starts at that same zoomed level and eases back to
normal — no overlap, so nothing to ghost. Slide is the right default between
two *clearly separate* B-roll beats — the sweep itself signals "new idea."

**A split edit** — the sound changes a few frames before or after the
picture, instead of both cutting at once — is worth asking for at a dialogue
cut specifically, when you want the cut to feel motivated rather than
abrupt: *hearing where you're going before you see it.* Say which side leads:
"lead the sound into screen-demo a few frames early" (you hear it starting
before the picture cuts) or "let the hook audio trail a beat into the next
shot" (the picture's already changed, the old sound hasn't caught up yet).
Six to twelve frames is the usual range; more than that stops reading as a
seam and starts reading as its own effect.

**Three more things you can ask for at a moment, each worth it only when the
picture needs it:**

- **A hand-drawn mark** — a circle, underline, box, highlight, bracket or
  strike that draws itself on over a spot in the picture, then fades.
  Ask for one on a screen recording or a still, where the viewer has to
  find *one* line, number or button on a phone-sized screen: "on the word
  'timeout', circle the 30s value in the config." **Describe what to mark
  in words, not coordinates** — "the third row of the table", "the Run
  button, top right". The editor measures where that is from a still;
  you cannot know it from here. One mark at a time per beat.
- **A click highlight** — a ring (and optionally a dimmed spotlight, and an
  arrow if the recording shows no cursor) landing on whatever was clicked:
  "on 'deploy', ring the Deploy button." Say whether the recording already
  shows a real cursor; if it does, the arrow is left off.
- **Show the recording as a card** — instead of cropping a landscape screen
  recording to fill the vertical frame, show the whole thing as a rounded
  card floating over a soft blurred copy of itself. Ask for it on any
  screen capture where the viewer needs to see more than a slice of it —
  "show screen-demo as a card." Nothing else is needed from you. The card
  swings in with a slight 3D turn and comes flat; the editor alternates the
  direction between cards, so no need to ask for it.
- **Zoom in on the click** — the picture pushes in toward a click so a small
  target is legible on a phone, then eases back out: "on 'deploy', zoom in
  on the Deploy button click." It needs a recording with real resolution
  (the editor will say if the zoom would blur it), and it replaces drawing a
  mark at the same moment — the two don't mix on one beat, so choose which.
  Clicks, marks and zooms each get a small sound automatically; you don't
  ask for those.
- **A physical hit** — the picture shakes, the frame flashes white, or the
  picture glitches and tears, for one beat: "on 'obsolete', shake," "flash
  as the screen-demo cuts in," "glitch on 'broken'." Reserve these for the
  two or three moments in a reel that should *hurt* — a reveal, a
  punchline, a failure. Said on every line they stop landing. Only the
  picture moves; the text stays readable. Each gets a matching sound
  automatically.
- **A key-word slam** — one word (or two or three) lands huge in the middle
  of the frame on the beat that names it: the punchline, the number, the
  verdict. "On 'free', slam FREE." A run of short ones is a rhythm ("No code.
  No test. No problem."). Use it for the one or two lines that *are* the
  point; the type is sized to fit the frame, so keep the words few. It
  isn't for a sentence — that's a caption — and it doesn't share a shot with
  a title.
- **A speed ramp** — a stretch of footage racing and then easing to normal
  speed to land on one line: "run the build log at 4x, ease down to normal
  on 'failed'." Ask for it when part of a capture is dull but you want the
  viewer to see that time passed. Name the word it should be at normal
  speed by. The footage's own sound is dropped under a ramp, so say which
  voice continues under it (see section 4).

When writing the script, notice which words are distinctive and put your beats
on those. If a line has no distinctive word where you need a beat, rewrite the
line. That is cheaper than fixing it in the edit.

**Naming a beat is optional.** If you leave the Moments section thin or empty,
the reel gets cut anyway — the editor proposes reasonable placements from the
transcript and shows them for approval before rendering. Name a beat yourself
only where you actually care which one lands there; the checklist in section 7
does not require this section to be exhaustive.

---

## 4. Say where every picture comes from

For each non-talking-head moment, state the source. In order of preference:

| Source | Use it for | You must supply |
|---|---|---|
| **capture** | The real tool, terminal or page | What to record, and roughly how long |
| **generate** | Diagrams, code, terminals, data, comparisons | The full content, see section 5 |
| **stock** | Atmosphere between technical beats | What it should show |

Never write "add some B-roll here". That produces filler. Write the concrete
version: *the file tree, cropped tight, pushing in, landing on the word
"generated"*.

Capture notes worth including:

- Record 8 to 10 seconds with a couple of seconds of buffer at each end.
- Do not pre-crop screen recordings to vertical. Leave them at native size so
  there is room to crop and pan in the edit.

**A sentence can keep running underneath B-roll that fills the whole frame.**
A cutaway to a screen recording or a generated clip doesn't have to stop you
mid-thought — say "keep the voice from hook going under this" and your voice
continues, uninterrupted, while the picture is entirely the B-roll, for as
long as that shot runs. This is the default worth reaching for: write your
sentence at its natural length and let the B-roll cover as much of it as it
needs to, rather than cramming the line into a pause so it fits before a
cutaway. Only decide separately whether captions should still show during
that stretch — usually yes; say to drop them if the B-roll itself already
displays the words (a code snippet, a terminal output) and repeating them as
captions would be redundant.

**If the B-roll opens a line before its speaker starts it** — a graphic that
comes up first, with your voice arriving inside it — the voice that was last
heard is the wrong one to continue. Name the take instead: "play the voice of
middle under this diagram". It works the same way as above, from the start of
that shot.

**A stronger, rarer version: keep you visibly talking *and* show a generated
graphic at the same time**, split across the frame — you in the bottom band,
the graphic in the top, advancing on your words. Ask for this specifically
when the viewer needs to see your face *and* the graphic together, not just
hear you over it; the plain version above is the right default otherwise,
since it puts the picture fully on the B-roll instead of splitting it. Say
which take continues under it and roughly what fraction of the frame the
graphic should get; the rest works the same as any other generated clip
(section 5).

---

## 5. Write generated clips out in full

Nine kinds of clip can be generated. If you ask for one, supply all of its
content. Half a diagram is a question, not a brief.

**diagram** — nodes that assemble and pan. The one worth reaching for
proactively: if a line in your script is literally a list — two or three
named things — say so and ask for a diagram rather than leaving it as another
few seconds of talking head.
> Nodes, each with a label and optional sub-label. Which nodes connect. Which
> nodes are visible at each step, and the word each step lands on. If it is
> two alternatives shown together rather than a sequence, say "side by side"
> and the picture holds still while the second arrives, instead of gliding
> across to it. A node can carry a small icon instead of being text-only —
> either a plain one (a checkmark, a cross, an arrow, a star, a lock, a
> warning, an info mark, a trend line, a phone, Bluetooth, a map pin, a key,
> a cloud — for a node naming a concept, which
> is most of them) or a UI mockup (a button, a loading spinner, a debouncing
> button, a checkout card, a receipt, a booking calendar — for a node naming
> a *specific interface state* a label alone would leave abstract). A custom
> logo or brand mark can go on a node too, if you have the file.

**code** — a snippet that types itself
> The exact code, the language, which lines highlight and on which word, and an
> optional heading. If the script says "now change this to…", give the
> *second* version too and the word it appears on: the code morphs into it,
> so the viewer sees what changed rather than two screens swapping.

**terminal** — a shell session
> Each line: the prompt, the command typed, the output that follows.

**compare** — two states
> A title and up to four bullet points for each side, and the word the second
> side wipes in on.

**data** — numbers that move, or a trend across several of them
> Each figure: its value, its label, an optional suffix. Say whether you want
> plain counters, bars, or — for a claim tracked across more than two points
> ("usage over time," not just a before-and-after) — a line or a filled
> trend line. And, if a number should land as you say it, the word it lands
> on. Without one the figures start together, slightly staggered.

**callout** — attention on a still, with a focus box and everything else
dimmed
> Which image, which region to highlight, and the label. Ask for this when
> the viewer's eye needs directing to one part of a busier image.

**image** — a plain still, full-bleed, no focus box or dimming
> Which image (or which frame of which take, by timestamp). Use this instead
> of callout when the picture itself is the point and any added emphasis
> would just be in the way — most commonly a freeze-frame closing a reel
> instead of cutting to black or holding on a title card. Ask for this
> explicitly as a closing option; the default without it is the reel simply
> ending on the last word.

**lottie** — an imported animation (an animated check, a burst, a loader)
> Supply the `.json` file and say it is yours or give its licence — free
> Lottie libraries differ file by file. It keeps its own colours, so choose
> one that already suits the channel, and say how long it should be on
> screen. A node in a diagram can also carry one instead of a plain icon.
> The plain built-in icons now draw themselves on as their node arrives; that
> needs nothing from you. Four animations ship ready to use, in the default
> cyan: a radar pulse (for "your lost phone"), a padlock snapping shut, a
> key swap (for key rotation) and a single expanding ring.

**orb** — a dotted sphere of light that reads as "an AI is working"
> Which of five motions: *working* (particles on orbits), *searching* (a
> scan sweeping a globe), *listening* (rings pushed like a waveform),
> *connecting* (a constellation wiring itself together), *breathing* (a ring
> swelling and settling). Ask for one **only** where a line says "thinking",
> "searching", "the agent is…" and there is nothing real to show — it is
> decoration with one job, not filler. It can pulse with the voice speaking
> under it; say so, and say which take continues under it. Colour and size
> belong to the channel's look, not the brief.

Example of a complete diagram request:

> Diagram, row layout, two nodes visible at a time.
> Nodes: Prompt, Model, Code.
> Prompt connects to Model, Model connects to Code.
> Show Prompt on the word "ask", add Model on "generates", move to Model and
> Code on "ships".

---

## 6. Name the text on screen

**Captions happen on their own.** Any shot with a transcript gets them
automatically — you do not need to ask, and there is nothing to specify unless
you want them turned *off* somewhere they would otherwise appear (rare; note it
under "Do not" if so).

Three other kinds.

- **Titles** are authored text, not from speech, and sit at the *top* of
  frame — because the bottom is spoken for. A title works fine alongside
  captions on the same shot; they're in different places on purpose. Supply
  the exact copy.
- **Badges** are small labels naming what is on screen, at the bottom.
  **A badge never appears with captions on the same shot** — they'd share
  one zone. These belong on B-roll, which is naturally where captions are
  absent. Every badge in a reel sits in the same spot automatically — you
  name the copy per shot, not the position.
- **A lower third** names who is on screen — a person's name, optionally
  their role — also at the bottom. Ask for one the moment a new speaker is
  introduced, rather than leaving the viewer to work out who they're
  looking at. It shares its position with a badge, so **a shot never gets
  both**; say which one it needs.

**Spell out the words a transcript will get wrong.** Captions are built from a
transcript of what you actually say, and that is where names and jargon slip:
a product heard as a similar-sounding common word, a filename split into two.
List every proper noun, tool, and filename you will speak, spelled exactly as
it should print (`Vercel`, `AGENTS.md`), or say there are none. The editor
hands that list to the transcription step before it runs, which makes the
right spelling likelier, and the transcript is still read back before
anything renders.

Keep title copy short enough to read at phone size in the time it is up. Two
lines is comfortable; four is not.

**A fourth thing worth naming: which words carry the reel.** Captions render
every word the same way except for the one currently being said. Separately
from that, two or three words across the whole reel — the actual claim, the
number, the payoff — can be marked to render larger and in a different colour
wherever they land, as a standing choice rather than a passing one. Name them
if you know which they are. If you don't, say so and the editor will propose
candidates from the transcript for you to approve.

---

## 7. The checklist

A brief is ready to hand over when every one of these is true.

- [ ] Frame size and frames per second are stated
- [ ] Runtime ceiling is stated, in seconds
- [ ] Word count is under the budget from section 1
- [ ] Every script line has a filename and a take count
- [ ] Every anchor word appears exactly once in its line
- [ ] Every B-roll moment names its source and its content
- [ ] Every generated clip is specified in full
- [ ] Title, badge and lower-third copy is written out (captions need no
      copy — automatic)
- [ ] No more than two or three *loud* moments (slam, shake, flash, glitch, orb)
      for a 30-second reel — `STYLE.md` explains why, and what to use instead
- [ ] Any mark, click highlight, zoom, card or speed ramp names *what* it points at or
      *where it settles*, in words and against a spoken word — not coordinates
- [ ] Every name, tool and filename you will speak is listed as it should
      print, or there are none
- [ ] Music mood is stated, or explicitly none
- [ ] The ending is decided: freeze on the last frame, a generated close, or
      just ending on the last word (the default if you don't say)

Anything unticked will come back as a question before the cut starts.

---

## The template

```markdown
# <post id, e.g. 012-ai-writes-components>

## Delivery
Frame: 1080x1920 at 30fps
Ceiling: 40s
Speaking budget: 30s of speech → 70 words at 140wpm

## The reel
Promise: <one sentence — what the viewer gets>
Hook: <what the first three seconds do>
Turn: <where it shifts>
Payoff: <where it lands>
Feels: <two adjectives>
Music: <mood, or none>
Ending: <freeze on the last frame / a generated close / leave blank to just end on the last word>

## Script
Word count: <n> / <budget>

### hook.mov  — 2 takes
"<line one>"

### middle.mov — 3 takes
"<line two>"

### cta.mov — 2 takes
"<line three>"

## B-roll
### screen-demo.mov — capture
What: <what to record, and for how long>
Note: record native resolution, do not pre-crop

### diagram-request-path — generate, diagram
Nodes: <...>
Edges: <...>
Steps: <node set> on the word "<word>", ...

## Moments (optional — unnamed beats are proposed by the editor)
- On the word "<word>" in hook, cut to screen-demo
- On the word "<word>" in middle, punch, sharp, with a snap
- On the word "<word>" in middle, punch, quiet, no sound
- On the word "<word>" in screen-demo, circle <what, in words>      (optional)
- On the word "<word>" in screen-demo, ring the click on <what>     (optional)
- On the word "<word>" in screen-demo, zoom in on the click on <what> (optional)
- On the word "<word>" in <take>, shake / flash / glitch                (optional)
- On the word "<word>" in <take>, slam "<the big word(s)>"              (optional)
- Show screen-demo as a card                                        (optional)
- In screen-demo, run <stretch> at <n>x, ease to normal on "<word>" (optional)

## Text
Title on hook: "<exact copy>"
Badge on screen-demo: "<exact copy>"
Badge on diagram-request-path: "<exact copy>"
Emphasis: "<word>", "<word>" — or leave blank for the editor to propose
Vocabulary: "<name or filename as it should print>", ... — or "none"

## Do not
<anything specifically unwanted for this reel>
```

---

## A worked example

```markdown
# 012-ai-writes-components

## Delivery
Frame: 1080x1920 at 30fps
Ceiling: 40s
Speaking budget: 29s of speech → 68 words at 140wpm

## The reel
Promise: The component library is becoming a prompt, and review is the new skill.
Hook: Flat claim that a familiar tool is finished.
Turn: Show the generated component appearing.
Payoff: Name what the job becomes instead.
Feels: certain, unhurried
Music: sustained tension, no drop
Ending: freeze on the last frame of cta.mov instead of cutting to black

## Script
Word count: 64 / 68

### hook.mov — 2 takes
"Everything you know about component libraries is about to be obsolete."

### middle.mov — 3 takes
"You describe the component. The model ships it. Your entire job becomes
reviewing something you did not write, which nobody has taught you to do."

### cta.mov — 2 takes
"Follow for the parts nobody warns you about."

## B-roll
### screen-demo.mov — capture
What: generating a card component, from empty editor to rendered result.
Record 10 seconds with buffer at both ends.
Note: native resolution, do not pre-crop

### diagram-review-loop — generate, diagram
Nodes: Describe, Generate, Review
Edges: Describe → Generate, Generate → Review
Steps: Describe on "describe", add Generate on "ships", move to Generate and
Review on "reviewing"

## Moments
- On the word "obsolete" in hook, cut to screen-demo
- On the word "ships" in middle, punch, sharp, with a snap
- On the word "reviewing" in middle, punch, quiet, no sound

## Text
Title on hook: "Component libraries are finished"
Badge on screen-demo: "one prompt, one component"
Badge on diagram-review-loop: "the new loop"
Emphasis: "obsolete" in hook, "reviewing" in middle
Vocabulary: none — no product names or filenames are spoken

## Do not
No stock footage. No generated video.
```

---

## What happens next

The brief and the footage go to the reel repository. Durations are measured from
the recordings rather than taken from this document, so if a take runs long the
edit says so before anything renders. Everything above is the starting point, not
a promise the footage has to keep.
