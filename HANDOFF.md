# Producing a reel brief

> Paste this file into the context of whatever project writes your scripts. It
> describes exactly what that project must hand over so the reel can be cut in
> one pass. It is the contract between "here is the idea" and "here is the cut".

You are the upstream. Your output is not a script, it is a **brief**: a script
plus every decision the edit depends on. A brief that is missing decisions turns
into three rounds of questions, and each round costs real time and tokens.

Deliver one file per reel: `brief.md`. The template is at the bottom.

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
hard edge — ask for this between two B-roll moments that share a subject and
should feel like one continuous idea), a **slide** (one shot sweeps in and
covers the other, no zoom — ask for this between two moments that are more
clearly separate beats), a band opening, or a dip in the music. Both blend and
slide crossfade their own audio automatically, even if the picture doesn't. A
punch can carry a sound; the ones that exist are **snap**, **whoosh** and
**tick**. Ask for any other sound and someone has to go find it first.

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

---

## 5. Write generated clips out in full

Six kinds of clip can be generated. If you ask for one, supply all of its
content. Half a diagram is a question, not a brief.

**diagram** — nodes that assemble and pan
> Nodes, each with a label and optional sub-label. Which nodes connect. Which
> nodes are visible at each step, and the word each step lands on.

**code** — a snippet that types itself
> The exact code, the language, which lines highlight and on which word, and an
> optional heading.

**terminal** — a shell session
> Each line: the prompt, the command typed, the output that follows.

**compare** — two states
> A title and up to four bullet points for each side, and the word the second
> side wipes in on.

**data** — numbers that move
> Each figure: its value, its label, an optional suffix. Say whether you want
> plain counters or bars.

**callout** — attention on a still
> Which image, which region to highlight, and the label.

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

Two other kinds, and **neither appears alongside captions on the same shot**
because all three share the lower third.

- **Titles** are authored text, not from speech. Supply the exact copy.
- **Badges** are small labels naming what is on screen. Supply the exact copy.
  These belong on B-roll, which is naturally where captions are absent.

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
- [ ] Title and badge copy is written out (captions need no copy — automatic)
- [ ] Music mood is stated, or explicitly none

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

## Text
Title on hook: "<exact copy>"
Badge on screen-demo: "<exact copy>"
Badge on diagram-request-path: "<exact copy>"
Emphasis: "<word>", "<word>" — or leave blank for the editor to propose

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

## Do not
No stock footage. No generated video.
```

---

## What happens next

The brief and the footage go to the reel repository. Durations are measured from
the recordings rather than taken from this document, so if a take runs long the
edit says so before anything renders. Everything above is the starting point, not
a promise the footage has to keep.
