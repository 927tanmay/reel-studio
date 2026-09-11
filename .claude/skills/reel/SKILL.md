---
name: reel
description: Cut a short-form video in this repository — ingest footage, transcribe, build a shotlist, compose and render. Use whenever the user wants to edit, cut, assemble, caption or render a reel, short, or vertical video here, or asks to add a generated diagram, code, terminal or callout clip to one.
---

# Cutting a reel

The engine is general. Every creative decision is input. Your job is to turn a
brief and a folder of footage into a shotlist the user agrees with, then render
and verify it.

Read `CLAUDE.md` for the rules and `DIRECTION.md` for the brief templates.

## Order of work

### 1. Establish the post

If it does not exist: `npm run new <id> -- --frame 1080x1920 --max 45`.

Confirm the frame size and runtime ceiling with the user before anything else.
They change what every later decision means.

### 2. Ingest

`npm run ingest <id>`

Read back what the footage actually is — orientation, real durations, which
clips have audio. Phone footage frequently reports landscape dimensions with a
rotation flag, so report the corrected numbers, not the raw ones.

### 3. Take selection — theirs, not yours

When a slot has several candidates, lay them out with duration and transcript
side by side and ask which to use. Never pick. Which of three reads is best is a
delivery judgement.

### 4. Repaired audio, if any

If `clean/` has files, run `npm run align <id>`, report the measured offset per
clip in milliseconds and frames, then re-run transcribe so timings match the
audio the viewer will hear.

### 5. Word timings

`npm run transcribe <id>`

Read `transcript.md`. **Never read `words.json`** — it holds the same data in a
form written for the engine, and reading it costs roughly fifteen times more for
no extra information.

Report the word count and the speaking pace. If the measured runtime already
exceeds the ceiling, say so now and name which line to trim. Do not proceed to a
shotlist that cannot fit.

### 6. Shotlist — the reviewable artefact

Write `shotlist.ts` and show it to the user as text before rendering. A render
costs minutes; a read costs seconds.

While writing it:

- Omit `seconds` wherever a duration should be measured.
- Anchor moments to words with `anchors()`, never to numbers.
- Crop before scaling. Build rectangles with `regionAt()` so the aspect matches.
- Leave `captions` unset. It defaults to on for any shot with a transcript;
  only set `captions: false` to turn it off somewhere it would otherwise show.
  Never write `captions: true` — it does nothing.
- Keep badges off any shot that will show captions; they share the lower third.
- Reach for captured footage first, generated second, stock third, a video model
  last.
- **When the brief does not name a transition, propose one — do not default
  everything to a silent cut.** Reach for `blend` between two B-roll shots that
  share a subject or continue one idea; `punch` (sharp, with a sound) where a
  talking-head take was split across a boundary that needs energy; `punch`
  (quiet, no sound) where it was split purely to fix a jump cut; a plain cut at
  most A-roll-to-B-roll boundaries. Put your reasoning in each shot's `note`
  field so the choice is visible when the user reads the shotlist, and expect
  them to override any of it.

If the brief is vague about *content* — what a shot should show, what a line
says — ask for the concrete version rather than guessing. "Some B-roll here"
produces filler; "the file tree, cropped tight, pushing in, landing on the word
*generated*" produces an edit. Vagueness about *transitions* is different: that
is exactly the case above, where proposing is the right response, not asking.

### 7. Preview

`npm run studio` and tell the user the composition name to open. The studio
prints `engine/verify.ts` findings on load. Report them verbatim.

### 8. Render and verify

`npm run render <id>`

This renders, normalises loudness and runs the file gates. Report the gate
results and the frames written to `out/<id>/frames`. Look at those frames
yourself before saying anything about how it turned out.

Always close by telling the user to watch it on a phone. No gate replaces that.

## Extending the engine

A new generator needs a variant in `GenSpec` (`engine/spec.ts`), a component in
`engine/generators/`, and a case in `engine/generators/index.tsx`. It renders at
frame size and may read `reel.words` so it can advance on a spoken word.

A new move needs a component in `engine/moves/` and a field on `Shot`.

Never hardcode a colour, size or duration in `engine/`. It belongs in a look or
a shotlist.

After any engine change run `npm run render 000-smoke-test`, which proves the
chain with no footage.

## Reporting

Say what the numbers are, not that it went well. Measured runtime against the
ceiling, measured loudness against the target, gate failures named individually.
If something could not be verified, lead with that.
