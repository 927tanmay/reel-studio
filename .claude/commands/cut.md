---
description: Cut a reel end to end — ingest, transcribe, shotlist, render, verify
---

Cut the reel `$1` in this repository.

Follow the `reel` skill. In short:

1. Ingest and report what the footage actually is.
2. If several takes fill one slot, lay them out and ask which to use.
3. Transcribe, and report the pace and whether the runtime already busts the
   ceiling.
4. Write `shotlist.ts` and show it as text for approval before rendering.
5. Render, then report the gate results and look at the extracted frames
   yourself.

If `$1` is empty, list the posts under `public/posts/` and ask which one.

If `brief.md` is empty or vague, ask for the concrete version first. Use the
templates in `DIRECTION.md`.
