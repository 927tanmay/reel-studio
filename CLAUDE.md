# Reel Studio

A general-purpose short-form video editor driven from Claude Code. The engine
knows how to cut, punch, caption, reframe, band and mix. It knows nothing about
any particular show. Every creative decision arrives as input, per reel.

Read this file, then `DIRECTION.md` when a brief arrives.

`HANDOFF.md` is the contract for whoever writes the briefs upstream. When a brief
arrives incomplete, point at the checklist in it rather than guessing.

## The separation that matters

**Fixed, in `engine/`:** the stages and their order, what each stage reads and
writes, the moves available and their parameters, that output is verified rather
than trusted, that durations are measured rather than assumed.

**Input, per reel:** frame size, frame rate, runtime target, colours, fonts,
sizes, positions, structure, which move sits at each cut and how strong,
caption look, overlay look, music and levels.

Never put a colour, a size, a duration or a structural assumption into
`engine/`. If a number feels like a decision, it belongs in a look
(`projects/*/tokens.ts`) or in a shotlist.

## Pipeline

| # | Stage | Command | Writes |
|---|-------|---------|--------|
| 01 | Ingest | `npm run ingest <post>` | `media.json` |
| 02 | Choose | human | — |
| 03 | Clean | human, external | `clean/*.wav` |
| 04 | Align | `npm run align <post>` | `media.json` |
| 05 | Word timings | `npm run transcribe <post>` | `words.json`, `transcript.md` |
| 06 | Shotlist | you, with the user | `shotlist.ts` |
| 07 | Compose | `npm run studio` | — |
| 08 | Render and verify | `npm run render <post>` | `out/<post>/reel.mp4` |

Each stage writes a file the next one reads. Stopping after any of them, editing
by hand, and resuming is expected and supported.

## Rules that are not negotiable

1. **Crop before you scale, and never scale past native size.** Scaling alone
   distorts; enlarging invents detail that was not captured. `coverRegion` in
   `engine/scale.ts` is the only correct path, and `engine/verify.ts` flags
   reframes that would enlarge.
2. **Durations are measured, never assumed.** A shot with no `seconds` takes its
   length from `media.json`. Scripts consistently under-budget speaking time, so
   never write a duration a script implied.
3. **Anchor edits to spoken words, not timecodes.** Use `anchors()` from
   `engine/words.ts`. A word survives a re-cut, a take swap and a trim. A
   timecode is wrong the moment anything upstream changes.
4. **Read `transcript.md`, never `words.json`.** They hold the same data.
   `words.json` is written for the engine, which imports it at build time; as
   something to *read* it costs roughly fifteen times more for no extra
   information. Reading it is the single most expensive mistake available here.
5. **Captions default to on.** Any shot whose source has a transcript gets
   captions automatically; a shotlist only needs `captions: false` to opt a
   shot *out*. Never write `captions: true` — it is a no-op — and never treat
   "add captions" as something a brief has to ask for.
6. **A blend defaults its own exit.** Write `enter: blend(...)` on the
   incoming shot alone and the outgoing shot automatically mirrors the same
   zoom, unless it already has its own `exit`, which always wins. Only add an
   explicit `exit` on the outgoing shot when you want it to move *differently*
   from the blend, not merely to make it move at all.
7. **Audio always crossfades across a blend or push, regardless of the
   picture.** Two clips' sound clashing under a visual transition that's
   otherwise seamless is a rough edge nobody names correctly, they just feel
   the cut is "off." This needs nothing from a shotlist — it happens from the
   overlap alone.
8. **Emphasis is a standing choice, not a transient one.** A shot's
   `emphasis` list marks the two or three words that actually carry the
   claim; they render bigger and in a different colour wherever they appear,
   whether or not that word happens to be mid-utterance. This is different
   from the karaoke `activeColor`, which follows speech automatically and
   needs no shotlist input at all. When a brief doesn't name emphasis words,
   propose them yourself from the transcript — the load-bearing noun, verb or
   number in each line — the same way you already propose transitions.
   Verify every entry actually occurs in that shot's spoken range; one that
   doesn't is silently inert, and `engine/verify.ts` will say so.
9. **Text never scales with a punch.** Picture scales, type does not. Scaling
   type produces soft, wobbling edges.
10. **Verify the file, not the intention.** `npm run render` always ends in
   `verify`. Do not report a reel as finished on the strength of the render
   succeeding.
11. **Nothing replaces watching it on a phone.** Say so every time you hand one
   over.

## What stays human

Take selection, where a cut lands emotionally, whether a crop reads at phone
size, and final playback. Offer comparisons and measurements; never choose.

## Working with the user

- When a brief is vague, ask for the concrete version before cutting. "Add some
  B-roll here" produces filler. "The file tree, cropped tight, pushing in,
  landing on the word *generated*" produces an edit.
- The shotlist is the reviewable artefact. Show it as text and get agreement
  before rendering; a render takes minutes and a read takes seconds.
- Report `engine/verify.ts` findings verbatim rather than summarising them away.
- Prefer captured footage over generated. Prefer generated over stock. Reach for
  a video model last, and say plainly that it cannot render legible code or a
  real interface.
- When the brief does not name a transition, propose one instead of defaulting
  everything to a plain cut: `blend` between two B-roll shots that share a
  subject and should feel like one continuous idea, `push` between two that
  are more clearly separate beats, `punch` when a talking-head take was split
  for a jump-cut fix, a plain `cut` at every A-roll-to-B-roll boundary. Show
  the shotlist with these filled in and let the user override any of them —
  propose, do not silently decide and hide the choice.

## Layout

```
engine/          the moves and the contract — general, never show-specific
  spec.ts        the shotlist contract and timeline resolution
  scale.ts       crop-then-scale, and size tokens that survive a frame change
  words.ts       word anchoring
  verify.ts      gates that need no render
  moves/         punch · blend · push · captions · title · badge · bed · hits
  generators/    diagram · code · terminal · compare · data · callout
projects/        one look per channel; copy default/ and change everything
public/posts/    one folder per reel, self-contained
public/assets/   fonts, sound effects, music — committed, so renders are offline
scripts/         ingest · transcribe · align · render · verify · new-post
posts.ts         the register; every reel needs a line here
out/             renders, not committed
```

## Commands

```bash
npm run new 001-my-reel      # scaffold and register a post
npm run ingest 001-my-reel   # measure and conform
npm run transcribe 001-my-reel
npm run align 001-my-reel    # only if clean/ has repaired audio
npm run studio               # live preview
npm run render 001-my-reel   # render, normalise, verify
npm run typecheck
node scripts/make-sfx.mjs    # regenerate the default sound effects
```

## Adding to the engine

New moves go in `engine/moves/`, new generators in `engine/generators/` plus a
case in its `index.tsx` and a variant in `GenSpec`. A generator takes content and
returns a clip at frame size; it may read `reel.words` so it can advance on a
spoken word, which is the thing no conventional editor makes easy.

After any engine change, run `npm run render 000-smoke-test`. It uses only
generated sources, so it proves the chain with no footage.
