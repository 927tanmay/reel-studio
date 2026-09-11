# Direction

Prompt templates for generating footage rest on a real idea: name the subject,
the shot, the light, the lens, the motion, and you get a shot instead of stock.
The same discipline works on footage that already exists, and it works better
here, because this direction is compiled rather than requested. A model may or
may not honour "slow push-in". A keyframe always does.

Use these templates to brief a reel. Fill every slot. A slot you cannot fill is
a decision nobody has made yet, which is worth noticing before the cut rather
than after.

---

## The reel

> A **{length}** **{frame}** reel that **{one-sentence promise}**.
> Opens on **{hook}**, turns at **{the shift}**, lands on **{payoff}**.
> Feels **{two adjectives}**. Titles are **{yes, on these shots | none}**.
> Bed is **{mood}**, **{level under speech}**.

Captions are not a slot here. Any shot with a transcript gets them without
being asked; say `captions: false` on a specific shot only to turn them off.

## The shot

> **{source}**, framed **{full | on the region that matters}**,
> **{holding | pushing | pulling | panning across}**,
> entering on **{a cut | a punch | a blend | a band opening}**,
> carrying **{title | badge | nothing}**,
> for **{measured | n seconds}**.

## The moment

> On the word **{word}**, **{cut | punch | blend | reveal | dip the bed}**.

The third template is the most valuable and the least obvious. Anchor edits to
spoken words. `at.start("generated")` survives every re-cut, take swap and trim,
because word timings move with the audio. `4.2` does not.

A moment is optional, not mandatory. If the brief names none, the agent cutting
the reel proposes reasonable ones from the transcript — a blend where two
B-roll shots share a subject, a punch where a talking-head take was split —
and shows them in the shotlist for you to approve or override. Naming a moment
yourself is how you take that decision back for a specific beat; leaving all of
them unnamed is a legitimate brief, not an incomplete one.

---

## Slots to moves

| Slot says | Becomes |
|---|---|
| holding | nothing; the default |
| pushing in | `reframe: { from: wide, to: tight }` |
| panning across | `reframe` with two rectangles at the same zoom |
| a cut | nothing; the default |
| a punch, sharp | `enter: punch({ to: 1.08, frames: 5, hit: "snap" })` |
| a punch, quiet | `enter: punch({ to: 1.05, frames: 9 })` |
| a blend | `enter: blend({ to: 1.12, frames: 8 })` — two shots overlap and zoom together instead of meeting at an edge; pair with `exit: exitPunch({...})` on the *previous* shot if it should keep pushing in too |
| a band opening | `bands: {...}` with `enter: bandsOpen({ frames: 12 })` |
| a title card | `title: "…"` |
| a label | `badge: "…"` |
| measured | omit `seconds` |

Captions are not in this table because there is nothing to translate — they
happen on their own wherever a transcript exists.

Numbers in that table are examples, not defaults. The two punches are the same
function with different arguments; the difference between a beat and a repair is
entirely yours to place. A blend shortens the reel slightly — the incoming shot
starts before the outgoing one would have ended — the same way a cross-dissolve
shortens a timeline in a conventional editor.

---

## Directing a generated clip

The same grammar works when there is nothing to cut to:

> The request path, three nodes, advancing on the words **client**, **edge** and
> **origin**, pushing gently throughout.

```ts
{
  src: {
    type: "diagram",
    layout: "row",
    window: 2,
    nodes: [
      { id: "client", label: "Client" },
      { id: "edge", label: "Edge" },
      { id: "origin", label: "Origin" },
    ],
    edges: [{ from: "client", to: "edge" }, { from: "edge", to: "origin" }],
    steps: [
      { at: at.start("client"), show: ["client"] },
      { at: at.start("edge"), show: ["client", "edge"] },
      { at: at.start("origin"), show: ["edge", "origin"] },
    ],
  },
}
```

## Where picture comes from

In the order worth reaching for.

1. **Capture.** The real tool, the real terminal, the real page. Nothing beats
   the actual thing on screen.
2. **Render.** Diagrams, code, data, anything abstract. Exact text, on your
   palette, revisable forever, and able to move on a spoken word.
3. **Stock.** Atmosphere between technical beats. Free libraries only,
   downloaded once and committed.
4. **A video model.** Last. It cannot render legible code or a real interface,
   and the local models that would keep it free are slow on this machine.

## Vague in, filler out

> Vague prompts give you stock; a concrete noun gives you a shot.

The editing form of the same rule. "Add some B-roll here" produces filler. "The
file tree, cropped tight, pushing in, landing on the word *generated*" produces
an edit. Expect to be asked for the second version.
