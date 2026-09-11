---
description: Scaffold a new post and collect its brief
---

Create a new post called `$1`.

Before running anything, ask for the two things that change every later
decision, unless the user has already said them:

- The frame. Vertical 1080x1920, or something else.
- The runtime ceiling in seconds.

Then:

```bash
npm run new $1 -- --frame <WxH> --max <seconds>
```

Afterwards, walk the user through the brief using the templates in
`DIRECTION.md`, and write their answers into `public/posts/$1/brief.md`. Fill
every slot. A slot nobody can fill is a decision that has not been made yet,
which is worth surfacing now rather than mid-edit.

Finish by telling them where to drop footage and what to run next.
