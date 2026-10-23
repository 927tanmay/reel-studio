# Contributing

Thanks for looking. This is a small, opinionated project, so a few minutes with
the ground rules below will save us both a round trip.

## Set up

```bash
npm install
npm run doctor                 # Node, ffmpeg, uv — says what to install (transcription also needs Apple Silicon; nothing else here does)
npm test                       # the pure maths, no render, under a second
npm run render 000-smoke-test  # the whole chain, no footage needed
```

`npm run typecheck` is the other check. CI runs all of these on every push and
pull request, so a red CI is the first thing to fix.

## What fits here

The engine is a **general** short-form editor: it knows how to cut, caption,
zoom, annotate, animate and mix, and knows nothing about any particular show.
Everything creative arrives as input. In practice:

- **No colour, size, duration or structural assumption in `engine/`.** If a
  number feels like a decision, it belongs in a look (`projects/*/tokens.ts`) or
  in a shotlist.
- **Nothing that costs money or needs an account.** No hosted APIs, no keys, no
  paid services as a dependency. It runs offline after `npm install`.
- **Everything is a pure function of the frame.** Remotion renders frames in
  parallel, so no timers, no wall-clock animation libraries, no unseeded
  randomness. Anything that loads asynchronously (fonts, Shiki, Lottie) holds
  the render with `delayRender`.
- **Measured, not assumed.** Durations come from files, positions are verified,
  output is checked by `verify`, not trusted.

## Adding a move or a generator

A new visual feature is not done until it has all of these. The existing ones
(marks, pointer, impacts, slams, card, orb) are the pattern to copy:

1. **Types** in `engine/spec.ts` (the shotlist field) and `engine/tokens.ts`
   (its look) — optional in the look, so a look without it simply can't use it.
2. **The renderer**, in `engine/moves/` or `engine/generators/`, wired into
   `ShotView.tsx` or `generators/index.tsx`.
3. **A gate in `engine/verify.ts`** for what a render would only show you late:
   a missing look, a position off the frame, a clash with another feature.
4. **The pure maths in its own file**, with **unit tests** in `test/`. Check a
   test can fail: break the code on purpose once and watch it go red.
5. **Coverage in `000-smoke-test`**, then render it and **look at stills** —
   one frame before and one inside the effect. Typecheck and a passing render
   have both missed bugs that a still showed at once.
6. **Docs:** a numbered rule in `AGENTS.md`, a section in `ENGINE_PLAYBOOK.md`
   for what you learned by rendering it, and — if a brief can ask for it —
   `ENGINE.md` and `HANDOFF.md`. If it is loud, say so in `STYLE.md`.

Keep new effects from changing how existing reels render: a new default that
alters an old post is a decision, not a side effect (the Shiki highlighter is
opt-in for exactly this reason).

## What not to commit

Real reels. `public/posts/*` is ignored except `000-smoke-test`, and
`posts.ts` will show as modified while you have a real post registered — leave it
out of your commits. Footage, transcripts, music and rendered output stay local.

## Pull requests

Small and focused is easier to review than large and broad. Say what changed and
why, what you checked (and how: tests, a still, a render), and what you did not
check. The PR template has the short list.

By contributing you agree your work is released under the repository's MIT
licence. Remotion, which does the compositing, has its own licence terms — see
the README.

## Bugs and ideas

Use the issue templates. For a rendering bug, a one-line shotlist that
reproduces it on generated sources is worth a page of description.
