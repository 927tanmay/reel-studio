# Restraint: which move, and how often

The engine can do a great deal. That is the risk. Every effect says "this
moment matters", and a reel where everything matters has no moments at all.
This file is for whoever is choosing moves — an agent proposing a shotlist, or a
person reading one — and it answers the question the rules in `AGENTS.md`
deliberately don't: *how much*.

Read it before proposing effects, then check the result with
`npm run critique <post>`, which counts them against these numbers.

**These are defaults, not findings.** They come from editing convention and from
rendering this engine's own output, not from measured audience data — none of
the retention claims in circulation for short-form are strong enough to build
on. When the user wants something louder, quieter, or odder, they are right and
this file is wrong. Offer the comparison; do not choose for them.

---

## 1. Three loudnesses

| Loudness | What | Rule of thumb |
|---|---|---|
| **Quiet** — always fine | captions, cuts, matched-zoom punches, blends and pushes, audio crossfades, J/L-cuts, titles, badges, lower thirds | Use freely. This is the texture of the reel. |
| **Medium** — earns its place | `marks`, `pointer` (rings, spotlight), click `zoom`, `card`, ribbon, section headers and glows, diagram steps, travelling dots, code morphs, speed ramps, lottie icons, chat mockups, the hidden-text page reveal | One at a time. Each should answer "where do I look?" |
| **Loud** — a beat that should hurt | `slams`, `impacts` (shake, flash, glitch), the orb | **Two or three in a 30-second reel.** Never two at once, unless they are one beat (see §2). |

If you can't say what a moment would lose without the effect, it didn't need it.
The test for a loud effect is stricter: *remove it and the line should be
visibly weaker*, not merely plainer.

## 2. Pairings

**Works**
- **Slam + shake on the same word.** One beat on two channels — the word lands
  and the picture takes the hit. Counts as one loud moment.
- **Flash on a cut or a punch** (not a blend — the fade dims it). The cut hides
  under the white.
- **Pointer click + mark** is redundant — pick one. A ring says "here was
  clicked"; a mark says "look at this". A static thing wants a mark, a thing
  that was *done* wants a ring.
- **Card + auto-zoom** for a small target on a screen recording. The card gives
  the whole screen context, the zoom gives the detail, in that order.
- **`audio: "hold"` under any loud effect on B-roll.** The voice carries the
  beat; the effect decorates it.

**Clashes**
- **Marks + auto-zoom on one beat.** Marks are fixed to the frame and slide off
  their target as the picture moves. Choose which one explains the moment.
- **Slam + title on one shot** — two things said at once. Keep the slam.
- **Flash + glitch together** — both blow the frame out; you get mush.
- **Impact on every cut.** Then none of them is an impact.
- **Orb as filler.** It is for a line that says an AI is working, searching or
  listening, with nothing real to show. Nothing else.
- **Card tilt with marks or a click in the first second.** They're measured on
  the flat frame; wait for the card to settle (`verify.ts` warns).
- **Drawn pointer arrow over a recording that already shows a cursor.** Two
  cursors.
- **Headline captions with a header's title or subtitle.** Both sit under the
  top of the frame and print over each other (`npm run check` fails it). Keep the
  header to its kicker pill, or use the box caption style.

## 3. Where in the reel

- **The first three seconds** are for *one* thing. A slam on the opening claim,
  or a flash-cut into the first B-roll — not both, and not a mark or pointer
  (the viewer hasn't found the picture yet). `critique` flags a first change
  later than two seconds; that is the opposite problem, don't solve it by
  stacking.
- **The body** is where medium effects live: a card for a recording, a mark or
  zoom when the script names a specific thing, a diagram when it lists things,
  a code morph when it says "now change".
- **The payoff** gets the reel's loudest moment: one slam or one shake. The
  hook promised something; this is where it lands.
- **The ending** is quiet. A ribbon or a lower third for the ask, a freeze
  frame. A loud effect on the call to action reads as shouting.

## 4. By kind of reel

**Talking head with a screen recording** (the common one)
- Talking head: quiet only — matched-zoom punches on jump cuts, captions with
  two or three `emphasis` words.
- Recording: a `card` (tilt on the first, flat or opposite after), one `mark`
  or `pointer` ring per thing the script names, auto-`zoom` only if the target
  is small on a phone. Event sounds on, quiet.
- Loud: one slam on the claim, one shake or flash at the reveal. Total two.

**Explainer built from generated clips**
- Diagram with word-anchored steps carries the reel; icons draw on by default.
- A code morph for "before → after". `compare` for two states.
- Loud: usually none; one slam at the conclusion if the line is short enough.
  An orb, if and only if a line is about an AI working.

**Announcement or news**
- Slam the one fact (`FREE`, `V6`, the number); a counter (`data`) for the
  figure; a lower third for who is speaking.
- Loud: two — the slam, and a flash on the cut into the proof.

**Code walkthrough**
- Shiki-highlighted `code`, highlight lines stepping with the voice, a morph
  at each change. Marks on a single token only when a line has too many to
  scan. No loud effects until the end, if at all.

## 5. Spacing and rhythm

- **Loud moments at least about three seconds apart.** Closer, and they stop
  being separate events and become a texture. `critique` reports the gap.
- **Most cuts are plain.** Of every four or five transitions, one is a blend or
  push; the rest are cuts. A reel of nothing but transitions has no transitions.
- **Alternate card tilt direction**, and don't tilt every card — a card that
  swings in every time stops being an arrival.
- **Silence is an effect.** The event sounds are deliberately small. A reel with
  a sound on every beat has none; let some moments land in near-quiet.
- **A slow stretch is allowed.** The pacing numbers in `critique` are rules of
  thumb; a deliberate hold on one face is a choice, not a defect. Say so in the
  shotlist and leave it.

## 6. Before handing it over

Watch it on a phone with the sound on, once, without stopping, and note where
you winced. A wince is an effect that is too loud, too long, or too close to
another one. Then:

1. `npm run critique <post>` — read the *loud moments* and *spacing* lines, not
   just the pacing ones.
2. For anything flagged, the first fix is to **remove**, not to retune. Retuning
   a wrong effect rarely rescues it.
3. Show the user the shotlist with each loud effect and the word it lands on
   named, so overriding one costs a sentence.
