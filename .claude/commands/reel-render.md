---
description: Render a post, normalise loudness, run every gate, and inspect the frames
---

Render the post `$1`.

```bash
npm run render $1
```

Then:

- Report each gate result with its number: frame size, rate, runtime against the
  ceiling, codec, file size, measured loudness.
- Read the frames in `out/$1/frames` yourself and say what they show.
- Name any gate that failed and what would fix it. Do not summarise failures
  away.
- Close by telling the user to watch it on a phone.

If `$1` is empty, list the posts under `public/posts/` and ask which one.
