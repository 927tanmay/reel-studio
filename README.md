# Reel Studio

A general-purpose short-form video editor you drive from Claude Code. Footage
and a brief go in; a verified, delivery-spec MP4 comes out. Every creative
decision is input, so it cuts a hook reel one week and a split-screen
walkthrough the next without changing the tool.

Nothing in it costs money.

## Requirements

- macOS or Linux, Node 22 or newer
- `ffmpeg` — `brew install ffmpeg`
- `uv`, only for transcription — `brew install uv`

## Setup

```bash
npm install
node scripts/make-sfx.mjs
npm run render 000-smoke-test
```

The smoke test uses only generated sources, so it renders on a clean checkout
with no footage. If it produces an MP4, everything works.

## Cutting a reel

```bash
npm run new 001-my-reel
```

Then drop footage into `public/posts/001-my-reel/raw/`, write `brief.md` using
the templates in `DIRECTION.md`, and:

```bash
npm run ingest 001-my-reel
npm run transcribe 001-my-reel
npm run studio                 # live preview while you iterate
npm run render 001-my-reel     # render, normalise loudness, verify
```

Or open the folder in Claude Code and say "cut post 001". `CLAUDE.md` carries
the whole procedure, so any session knows it without you explaining anything.

## Where briefs come from

If scripts are written somewhere else, hand that project `HANDOFF.md`. It
specifies exactly what a complete brief contains, including the word-count
budget that keeps a script inside its runtime, and a checklist to run before
handing anything over. A complete brief is cut in one pass; an incomplete one
becomes three rounds of questions.

## What it does

**Measures instead of assuming.** Shot durations come from the files. Scripts
under-budget speaking time badly, so no scripted timing is ever trusted.

**Anchors edits to spoken words.** `at.start("generated")` survives a re-cut; a
timecode does not.

**Fixes round-trip drift.** Audio that went through an external repair tool comes
back a frame or two out. `npm run align` measures the offset by correlation and
corrects it.

**Generates picture when you have none.** Diagrams, code, terminals,
comparisons, counters and callouts, all rendered from the same program as the
word timings, so a diagram can advance on the word you say it.

**Verifies the file, not the intention.** Frame size, rate, runtime ceiling,
codec, file size and measured loudness, plus frames pulled out to look at.

## Making it yours

Copy `projects/default/tokens.ts`, change every value in it, and point your
shotlists at the copy. That file holds the whole look: palette, type, caption
style, safe zones, punch presets, mix levels. One repository can serve several
channels without them contaminating each other.

## Documentation

Six files, each for a different reader:

- **`README.md`** (this file) — setup, and the shortest path to a rendered file.
- **`GUIDE.md`** — a full worked walkthrough, one real reel start to finish.
- **`CLAUDE.md`** — the rules an agent driving this repo follows; read this
  first if you're pairing with one.
- **`STYLE.md`** — restraint: which moves are quiet, medium or loud, which pair
  and which clash, and how many a reel can carry. Read before proposing effects.
- **`ENGINE_PLAYBOOK.md`** — practical detail found by rendering, for an agent
  mid-edit.
- **`HANDOFF.md`** and **`DIRECTION.md`** — for whoever writes briefs upstream,
  even if that's a different project entirely.

## Licence

MIT — see `LICENSE`. Two things it doesn't cover:

- **Remotion**, which does the compositing, is free for individuals and
  organisations up to three people; see `remotion.dev/license`.
- **The bundled font** (`public/assets/fonts/Inter-Variable.woff2`) ships
  under the SIL Open Font License; see `Inter-OFL.txt` in the same folder.
