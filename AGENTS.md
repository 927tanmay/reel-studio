# Reel Studio

A general-purpose short-form video editor driven by a coding agent — Claude
Code, Codex, Gemini CLI, Cursor, or anything else that reads `AGENTS.md`. The
engine knows how to cut, punch, caption, reframe, band and mix. It knows
nothing about any particular show. Every creative decision arrives as input,
per reel.

Read this file, then `DIRECTION.md` when a brief arrives. Read `STYLE.md` before
proposing effects: it is the one place that says *how much* — which moves are
quiet, medium or loud, which pair and which clash, and how many a reel can
carry. The rules below say what exists; that file says how to resist using it.

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
| 01b | Colour measurement (optional) | `npm run grade <post>` | `media.json` |
| 02 | Choose | human | — |
| 03 | Clean | human, external | `clean/*.wav` |
| 04 | Align | `npm run align <post>` | `media.json` |
| 05 | Word timings | `npm run transcribe <post>` | `words.json`, `transcript.md` |
| 05b | Tightening report (optional) | `npm run tighten <post>` | — |
| 06 | Shotlist | you, with the user | `shotlist.ts` |
| 06b | Beat check (optional) | `npm run beatcheck <post>` | — |
| 06c | Pacing check (optional) | `npm run critique <post>` | — |
| 06d | Shotlist check (every render runs it first) | `npm run check <post>` | — |
| 07 | Compose | `npm run studio` | — |
| 08 | Render and verify | `npm run render <post>` | `out/<post>/reel.mp4`, a take |
| 08b | Thumbnail (optional) | `npm run thumbnail <post>` | `out/<post>/thumbnail.jpg` |
| 09 | Export timeline (optional) | `npm run export-timeline <post>` | `out/<post>/timeline.edl` |

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
7b. **A push always carries motion blur, on the incoming picture, along its
   own direction of travel.** Same reasoning as the rule above: a sweep that
   snaps sharp on every frame reads as a slideshow rather than a camera move.
   Sized to the picture's actual speed each instant, not a fixed amount, so
   it's strongest mid-slide and gone at rest. Needs nothing from a shotlist;
   set `blur: 0` on the push only where the incoming shot carries legible
   text or UI that has to stay readable mid-slide.
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
12. **A take plays as recorded until something cuts it.** `drop` removes
   ranges of a source and closes the gap — dead air, an "um", a false start.
   Build the ranges with `pauses()`, `fillers()` or `tighten()` from
   `words.ts`, never by hand: they are derived from the same word timings the
   cuts are anchored to, so they survive a re-transcribe. Run
   `npm run tighten <post>` first to see what a threshold would actually
   remove, and propose it the way you propose transitions. Captions follow on
   their own.
13. **B-roll goes *on* a sentence, not after it.** A shot with `audio: "hold"`
   keeps the previous take's voice running underneath it, continuing from
   exactly where it left off, at its own rate whatever `speed` is doing to the
   picture. Captions follow the voice, not the picture. Without it, cutting to
   a silent screen recording stops the speaker dead — which is a choice worth
   making deliberately as a montage break, and a mistake everywhere else.
   Check for a badge on the same shot: captions now arrive there too, and the
   two share the lower third. `hold` continues whatever played *last*, which
   is the wrong voice when B-roll opens a take before its speaker starts —
   `audio: { from: "hook" }` puts a named clip's sound under the whole shot
   instead, read off the shot's own `in`, `seconds` and `drop`. Under a blend
   or push, held sound starts where the previous shot's sound ends, not where
   the overlapping picture does; that is automatic, and without it the
   overlap plays the same words twice.
14. **The sound does not have to change where the picture does.** `audio:
   { trail: n }` keeps the outgoing sound for this shot's first `n` frames
   (an L-cut); `audio: { lead: n }` starts this shot's sound `n` frames early,
   over the tail of the one before (a J-cut). Six to twelve frames is the
   usual range — enough to stop a cut landing flat, not enough to notice as
   an effect. A J-cut is the stronger of the two, because hearing where you
   are going before you see it is what makes a cut feel motivated. Both keep
   sound locked to its own picture; only the switch moves. Propose one at
   dialogue cuts the same way you propose transitions, and remember `lead`
   needs `in` to be at least `n` frames into the source.
15. **Three text roles, and each has one place.** Captions are automatic and
   live at the bottom. Titles are authored and live at the top, *because*
   the bottom is spoken for. B-roll carries a title and nothing else. That
   is the whole layout: there is no fourth position, and a shot needing one
   is a shot trying to say two things at once. It follows that a `badge` has
   nowhere to go — the bottom belongs to captions and `verify.ts` fails any
   shot holding both — so label B-roll with `title`, not `badge`. Where the
   voice should keep running under that B-roll, `audio: "hold"` with
   `captions: false` gives exactly this: speech continuing, one title on
   screen, nothing in the lower third. `ReelSpec.allowCaptionsWithBadge` is
   the explicit opt-out when a look genuinely keeps the two apart (a badge
   sitting just above the caption band, say) — off by default, so this stays
   a look-level decision made on purpose, not a shotlist quietly working
   around a gate that exists for a reason.
16. **A render never destroys the one before it.** Every `npm run render`
   also saves a take — the file, the shotlist that produced it, its
   runtime and gate result — into `out/<post>/takes/<n>/`, automatically,
   needing nothing from you. `npm run takes <post>` lists them;
   `--restore <n>` brings that take's shotlist back as the current one
   (rescuing whatever was there first if it was never itself a take);
   `--diff <a> <b>` shows exactly what changed; `--forget <n>` deletes one,
   which is the only way anything here is ever actually lost. Whether a
   draft survives is the user's decision, not a side effect of the next
   render finishing.
17. **Match colour, do not correct content.** Phone footage and a screen
   recording are lit and encoded by different things, and cut together
   untouched they read as two videos rather than one. `npm run grade <post>`
   measures every clip and says how far apart they are; `matchGrade()` from
   `colour.ts` turns two measurements into a `Shot.grade`. Its strength
   defaults to 0.5 and should stay low across a cut between different
   *subjects* — a dark editor matched to a lit face at full strength grades
   the editor grey, which is correcting the content, not the colour. Raise it
   only between takes of the same thing. Grading touches the picture only;
   text is never graded.
18. **The music gets out of the way on purpose.** `dips: [{ at, frames, to? }]`
   on a shot ducks the bed for a beat that wants the music gone for as long
   as a word takes to land — a `hit` ducks it as a side effect, this is the
   dip on its own, and it ramps so a sustained track does not click. The bed
   loops, and its level curve is written against the whole reel, so it must
   count the reel's frames rather than restart with each pass (`Bed.tsx` sets
   `loopVolumeCurveBehavior="extend"`); a reel longer than its track once had
   every dip land on the wrong frame. `node scripts/make-music.mjs` writes a
   default bed to `public/assets/music/pulse.wav`; any track dropped in that
   folder works, and it is not committed.
19. **Tell the stages what they cannot know.** Two optional keys in a post's
   `post.json`. `vocabulary: ["Vercel", "AGENTS.md"]` is handed to Whisper as
   its initial prompt, so proper nouns and jargon are transcribed as spelled
   and stay that way across every re-transcribe, instead of being hand-fixed
   in `words.json` and lost; it makes a right spelling likelier, not certain,
   so still read `transcript.md`. `conform: { width: 1440, keys: [...] }`
   brings the named clips (all of them if `keys` is omitted) down to that
   width at ingest, for 4K phone footage whose extra resolution no crop will
   ever use and which is expensive to decode. Set both before running the
   stage they belong to; neither changes anything already ingested.
20. **A stock track doesn't start where a reel needs it to.** File offset 0
   is wherever the track happens to begin — usually a quiet intro built for
   a loop point, not for landing on a hook. `npm run beats <track>` reports
   its tempo, a confidence score, and real candidate start points: moments
   the track's own energy settles into a sustained run, each snapped to an
   actual beat. `bed.trackIn` is seconds into the *file* to start reading
   from; `bed.startShot` is which *shot* the music enters the reel on.
   Together they put a real beat under the exact frame the music starts
   playing. `bed.fadeOutShot` (with `fadeOutFrames`) fades the bed out
   starting on a shot rather than a frame count, so it follows the picture
   through a re-cut the same way `startShot` does. Low confidence from
   `npm run beats` is real information, not a weaker version of the same
   answer — it means the track likely has no hard beat to sync to at all
   (ambient, orchestral), and a candidate start point chosen by its section
   energy is still worth using even then.
21. **A plate is a `Surface`, and a flat colour is the simplest one.** Every
   `plate` (badge, ribbon, caption) can carry a `gradient`, a `glass` blur or
   a `glow` on top of its `color`, which always applies first and stays the
   fallback. `glass` needs something visually busy *behind* the plate to
   read as glass rather than as a plain translucent colour — over a flat
   background the two look identical. These are look decisions, not shotlist
   ones: put them in `projects/*/tokens.ts`, the same as every other plate
   property already there.
22. **A node's `visual` is an icon, a UI mockup, or a custom mark — never
   guess which fits.** The built-in set is two families: `button` /
   `spinner` / `debounce` / `checkout` / `receipt` / `booking` for a script
   naming a specific interface state, and `check` / `cross` / `arrow-right`
   / `star` / `lock` / `warning` / `info` / `trend-up` / `phone` / `bluetooth`
   / `map-pin` / `key` / `cloud` / `document` / `globe` / `image` / `eye-off`
   / `server` / `sparkle` / `shield` / `user` / `clock` / `database` for a
   plain concept with no UI attached. `{ src: "assets/..." }` drops in anything else — a
   logo, a brand mark — at the same footprint the built-ins use, so swapping
   one for another moves nothing else in the layout.
23. **A `data` shot is either independent figures or one trend — the
   `style` says which, and they don't mix.** `counter`/`bars` are named
   quantities that can each carry their own colour. `line`/`area` are one
   series in order, plotted against `label`; the whole line takes its colour
   from the first item, because a trend is one thing being tracked, not
   several. Reach for `line`/`area` on a script line making a comparison
   across more than two points ("usage over time," not just "before and
   after") — two points is still better served by `compare`.
24. **Two more things share the badge's zone, and neither is optional to
   check.** `Shot.lowerThird` (a name/role card) and `Tokens.watermark` (a
   persistent corner mark for the whole reel) both exist now. A lower third
   is quieter than `ribbon` on purpose — a slide-up and a fade, not a spring
   overshoot — because identifying who is on screen should read as
   information arriving, not an event. `verify.ts` fails a shot carrying
   both a badge and a lower third, same reasoning as captions-plus-badge:
   propose one or the other, never assume they can share a shot because
   nothing crashed. A watermark is `Tokens`-level, not a shot: one mark, the
   whole reel, the same way a channel's fonts and palette are.
25. **Text shadow can stack, and easing has three louder options now.**
   `TextStyle.shadow` takes an array — a tight, dark layer close to the
   glyph plus a soft, larger one further out reads as depth; one layer reads
   as a CSS default. `easeOutBack`/`easeInOutBack` overshoot past the target
   before settling, for a graphic that should land with a touch of bounce —
   reach for them on a ribbon or a lower third, not on `punch`/`exitPunch`,
   where the existing default is deliberately restrained. `easeOutExpo` is
   fast off the mark with a long gentle tail, for something that should
   read as snapping into place rather than gliding there.
26. **A hit or a dip can land on the beat, not just at its own `at`.**
   Import a track's `<track>.beats.json` (written by `npm run beats
   <track>`) into `ReelSpec.beatGrid` the same way `media`/`words` come in,
   and set `onBeat: true` on a `hits` or `dips` entry — `resolveTimeline`
   nudges it to whichever real beat falls nearest, automatically, never
   past the edges of its own shot. A shot's own cut can't do this: its
   length comes from a measured duration or a spoken word, never from
   music, so moving a cut to chase a beat is an editorial call, not
   something the engine makes silently. `npm run beatcheck <post>` reports
   the distance instead — every cut, hit and dip against the grid, so a
   `seconds` nudge that would close the gap is visible without guessing at
   the arithmetic by hand.
27. **A look can name its own fonts, not just what's installed.** `fonts.files`
   loads `.woff2` files from `public/assets/fonts` (committed, unlike music) at
   startup, and delays the render until they're in; a role's `fontFamily`
   still has to name the family, system stack kept as a real fallback. A
   variable font file — check for an `fvar` table before assuming otherwise —
   covers every weight a look needs from one download; register it once per
   weight in `fonts.files` rather than sourcing separate static files. Pick a
   font whose licence allows embedding and redistribution with no per-render
   fee (SIL Open Font License is the safe default), since this folder ships
   in the repository.

28. **A thumbnail is a frozen shot plus a poster, not a separate image.**
   `ReelSpec.thumbnail` (`{ shot, at?, text?, emphasize?, top?, reframe? }`)
   names a shot by its 0-based index and a moment inside it; `npm run
   thumbnail <post>` freezes that instant through the exact same picture
   pipeline the reel itself uses — crop, grade, scale — so the picture can
   never drift out of sync the way a separately-composed image would. Every
   other overlay is dropped unconditionally: a caption frozen mid-word reads
   as a mistake, and a badge or ribbon names a beat that only makes sense in
   motion. The title itself is *not* a reuse of the in-video `Title` — it's
   its own look, `Tokens.thumbnail`, because a thumbnail is a poster
   competing for a thumb mid-scroll, not type the eye reads over several
   seconds: a heavier display font, centred rather than near an edge (a
   profile grid crops a 9:16 reel to roughly 3:4, and `verify.ts` fails a
   thumbnail title sitting outside the centre ~75% that crop keeps), a dark
   scrim rising from the bottom so it reads over anything behind it, and a
   contrast/saturation lift on the picture. `text` is a short cover line —
   3-5 words reads better than the in-video sentence — and `emphasize` marks
   which word(s) in it carry the claim, the same standing-choice idea
   `Shot.emphasis` already is for captions. `reframe` and `top` both fall
   back to the look's defaults but exist per-reel because they're facts about
   *that* footage: how tightly a crop can go before it clips the subject, and
   how much headroom that crop leaves above the head for the title sitting
   over it — get one without the other and the title either floats in dead
   curtain or lands on a forehead. Pick `at`, `reframe` and `top` together by
   comparing candidates the same way a badge position gets compared: render a
   few, look, choose.

29. **A mark points at something in the picture, and lands on the word that
   names it.** `Shot.marks` draws a hand-drawn circle, underline, box,
   highlight, bracket, strike or cross over a region of the frame, drawing
   itself on and then fading. Use it on screen recordings, where the viewer
   has to find one line or button on a phone-sized screen; it is a pointer,
   not decoration, so mark one thing at a time. `region` is fractions of the
   *output frame* (what the viewer sees after any reframe), which means the
   engine cannot find the thing for you — look at a frame and measure, then
   leave a little room, because the stroke sits outside the region by
   `marks.padding`. Time it with `at` from `anchors()`, never a timecode.
   The stroke itself (colour, weight, wobble, draw-on frames) is the look's,
   `Tokens.marks`; a look without one cannot be annotated and `verify.ts`
   says so. Strokes are seeded and held still, so every render is identical;
   `seed` picks a different take on the same shape. Marks are exempt from the
   safe-zone gate — they point at picture, not readable text — but must stay
   inside the frame.

30. **Measure the pacing before the render, and say what it can't see.** `npm
   run critique <post>` reads the resolved timeline — no render — and reports
   when the picture first changes, how many changes land in the hook, the
   longest stretch with none, and (where a transcript is attached) speech
   coverage, wpm and dead air. A cut, a mark, a ribbon, a lower third, a
   diagram step, a code highlight, a terminal line and a compare wipe each
   count as a change; ones within a quarter-second merge. Its thresholds
   (a change every ~3 s, something in the first 2 s, silence over 0.5 s) are
   rules of thumb for short-form, not findings, and are flags precisely so a
   reel that is deliberately slow can say so. Continuous motion — a slow
   reframe, typing — is invisible to it, so a flagged gap over one is a
   question, not a defect. It also counts *emphasis* against `STYLE.md`: loud beats (slams,
   shakes, flashes, glitches, the orb — a slam and a shake on one word are one
   beat), how close two of them sit, and a tally of the medium effects. Its
   defaults (three loud beats per 30 s, three seconds apart) are flags like the
   rest. Offer the numbers; whether the opening earns the
   next five seconds stays the human's call.

31. **Show what was clicked, and let the caption arrive just ahead of its
   word.** `Shot.pointer` draws a click ring, an optional arrow and an
   optional spotlight over a screen recording: `path` is waypoints
   (`{ at, x, y, click? }`, fractions of the output frame, seconds into the
   shot), the pointer glides between them, and each `click` rings and, with
   `spotlight: true`, dims everything else around it. A real recording
   usually already shows its cursor, so leave `arrow` off there and take
   only the ring and spotlight; turn it on for a capture with no cursor or a
   generated source. Positions are measured, not guessed — pull a still —
   and `at` anchors to the word that names the click. Style is `Tokens.
   pointer`. Separately, `caption.leadMs` (default look: 100) shows each
   caption card that long before its first word is spoken, because words
   that arrive just *after* the voice read as late; only the card leads, the
   active-word highlight stays on the voice. Both are look-level numbers.

32. **A shot can change speed partway through.** `speedRamp: [{ at, speed }]`
   (`at` in seconds on screen) races through the dull stretch and eases down
   to land on the thing that matters — a build log at 4×, settling to 1× on
   the error. The speed eases between keyframes rather than turning a corner
   at each one. Leave `seconds` out and the length is measured by finding
   when the ramp has consumed the whole source window, not assumed. A ramped
   shot has no sound of its own, because a changing rate warps it: bring a
   voice in with `audio: "hold"` or `{ from }`, which plays at its natural
   rate. It replaces `speed`, and does not compose with `drop` or `bands`
   (both warn). Footage slowed below about half speed repeats source frames
   — nothing invents the ones between. `engine/ramp.ts` holds the arithmetic,
   shared by the timeline and the renderer so they cannot disagree about
   where in the source a frame lands.

33. **An orb is for a line about an AI working, and it can move with the
   voice.** `src: { type: "orb", state }` draws a dotted sphere of light —
   `working` (particles on tilted orbits), `searching` (a scan sweeping a
   globe), `listening` (rings pushed like a waveform), `connecting` (a
   constellation wiring itself together) or `breathing`. It is decoration with
   a purpose: reach for it where a script says "thinking", "searching" or
   "the agent is…" and there is nothing real to show, never as general filler.
   `reactToSpeech: true` pulses it with whatever voice is audible under the
   shot — pair it with `audio: "hold"` or `audio: { from }`. Colour, size,
   position, dot size, density and spin are `Tokens.orb`; a look without one
   cannot show an orb and `verify.ts` says so. Every dot is a pure function of
   the frame, seeded, so it is identical on every render.

34. **A screen recording is a card, not a crop.** A 16:9 capture in a 9:16
   frame has two bad options: crop it hard to fill the frame (losing most of
   what was on screen) or leave dead bars. `card: true` on a shot gives the
   third: the whole picture as a rounded, shadowed card over a blurred, dimmed
   copy of itself. The card takes the aspect of what it shows (the reframe's
   `from`, or the whole source) at the look's width, shrinking if it would
   exceed the look's height limit; `card: { width, top }` overrides placement.
   It is for video — on a generated clip, which is already frame-shaped, it
   only shrinks the clip — and does nothing on a banded shot. Everything
   positioned against the frame (marks, pointer, captions, titles) stays
   against the *frame*, not the card, so measure those on a still of the
   finished card. The look is `Tokens.card`; the blurred copy plays muted, so
   a card costs a second video decode, which is worth knowing on a long shot.
35. **Zoom toward the click, and don't let it invent detail.** `pointer:
   { zoom: true }` (or `zoom: 2.2` to override the look's magnification)
   pushes the picture in about each click, holds, and eases back out, ending
   its ramp-in a few frames *before* the click so the eye is already there;
   two clicks close together glide from one target to the next instead of
   zooming out between them. It scales about the click point, so the clicked
   thing stays put. Inside a card the zoom is clipped by the card's corners.
   Three things `verify.ts` warns about, because each is invisible until you
   look: a zoom that magnifies a source past its native size (the real limit
   — a 1080-wide card of a 1920 recording has headroom, a 1920 recording
   cropped to fill a vertical frame already doesn't); `marks`, which are fixed
   to the frame and slide off their target as the picture moves; and a drawn
   `arrow`, which doesn't scale with the picture under it. Over a recording
   that shows its own cursor, leave `arrow` off — the real one zooms with the
   picture. Shape and speed are `Tokens.pointer.zoom`.
36. **The look can play a sound on an event, so a shotlist never names it.**
   `Tokens.sounds: { click, mark, zoom }`, each `{ sfx, volume?, duck? }`,
   turns a pointer click, a mark drawing on and an auto-zoom starting into
   ordinary hits, placed from the same frames the picture uses, so a ring and
   its tap cannot drift apart. They default to `duck: false` — small sounds
   sit fine on music, and a run of them would otherwise pump the bed. A shot's
   `pointer.silent` or a mark's `silent` opts out; omit a key in the look and
   that event is silent everywhere. Two clicks inside one zoom play its sound
   once. Any name in `public/assets/sfx` works (`tap`, `tick`, `switch`,
   `snap`, `whoosh`); picking which sound fits an event is a look decision.

37. **A beat can land physically: shake, flash, glitch.** `impacts: [{ kind,
   at?, frames?, strength? }]` on a shot hits the *picture* — `shake` jolts it
   (travel and a little tilt, settling over about ten frames), `flash` blows
   the frame out and recovers, `glitch` tears it in horizontal bands and parts
   the red and blue channels. For a number revealed, a punchline, a cut that
   should hurt; used on every line they stop meaning anything, so propose a
   few per reel, not one per shot. Captions, titles and every other overlay
   are untouched — type that shakes or tears is unreadable. `at: 0` is the
   shot's first frame, which is how a flash or glitch covers a hard cut; time
   any other one from `anchors()`. A shake enlarges the picture by exactly what
   the current frame's travel needs, so no edge is ever uncovered and there is
   no pop at its start. Put a flash on a cut or a punch: on a blend or push the
   shot's own fade-in dims it, and `verify.ts` warns. What each looks like is
   `Tokens.impact`; each also plays its look's sound (`Tokens.sounds.shake/
   flash/glitch`) unless `silent`, and a shake's sound ducks the music.

38. **Code reads as code, and a change reads as a change.** A `code` generator
   with `highlighter: "shiki"` colours the snippet with a real grammar (any
   language Shiki knows — set `language`; an unknown one falls back to plain
   text rather than failing) using the *look's* palette: `keyword`, `string`,
   `number`, `muted`, `code`, `accent`, and optional `function`/`type`. That is
   what keeps code from looking pasted in from another tool. `states: [{ at,
   code }]` then morphs the snippet into a later version at `at`: tokens that
   survive glide to their new place, new ones fade in, removed ones fade out,
   matched by a longest-common-subsequence over token text so order is kept.
   Use it where the script says "now change this to…" — the viewer sees *what
   changed* instead of two screens of code swapping. Anchor `at` to the word
   that names the change. `highlight` line steps refer to lines of the
   version showing at that moment. Needs `Tokens.code` (`morphFrames`, `dim`);
   `verify.ts` fails `states` without the highlighter or the look. The default
   highlighter is still `"simple"`, so a reel cut before this renders as it
   did; prefer `"shiki"` for new ones. Highlighting loads asynchronously, so
   the render is held with `delayRender`, like fonts.

39. **Icons draw themselves on, and an imported animation plays where an icon
   would sit.** With `Tokens.generators.iconDrawFrames` set, the twenty-three
   plain built-in diagram icons draw on when their node arrives — a check as one
   stroke, a cross as two in turn, a lock body then shackle, a warning's
   triangle then bar then a dot that pops — using path data in
   `engine/icons.ts` and `evolvePath` from `@remotion/paths`. Left out of the
   look, icons simply appear, as they always did; fully drawn they are
   identical either way. `visual: { lottie: "assets/….json" }` on a node plays
   an imported Lottie at the icon footprint from the moment the node arrives
   (once; add `loop: true` for one that should keep going),
   and `src: { type: "lottie", src, seconds }` plays one centred in the frame
   at `Tokens.lottie`'s size (looping unless `loop: false`). A Lottie keeps the
   colours it was drawn with — a look cannot recolour it — and its own length
   is not measured for you, so set `seconds`. Check the licence of any file you
   did not draw: free Lottie libraries differ file by file. The repository
   ships six we drew ourselves, in the default look's cyan, under the MIT
   licence: `ring-pulse` (one ring expanding), `radar-pulse` (a dot with rings
   pulsing out, loops well), `lock-snap` (a padlock's shackle dropping shut),
   `key-swap` (a new key taking an old key's place, the old one dimming),
   `shield-close` (two halves closing, then a tick drawn inside) and
   `check-tick` (a ring and a tick that draw themselves).

40. **A key word can land big, on the beat that names it.** `slams: [{ text,
   at?, hold?, color?, centre? }]` puts a word (or two or three) in the middle
   of the frame — the punchline, the number, the verdict — arriving larger and
   soft, snapping to size with a small bounce, resting over a dimmed picture,
   and going. A run of them with later `at`s ("NO CODE. NO TEST.") is a rhythm
   of its own; time each from `anchors()`. Its size is *fitted*: `fitText` (from
   `@remotion/layout-utils`) finds the largest type that keeps the longest line
   inside the look's `width`, capped at the look's `size`, so a short word is
   big and a long one still fits — leave the font size alone and keep the copy
   to a few words. It is the one place type scales on purpose (rule 9 holds
   everywhere else), and only during the seven frames of arrival: it ends at
   exactly 1 and carries no transform once it rests, so edges stay sharp.
   Captions stay where they are, above the dim; `verify.ts` warns on a slam
   beside a title (two things said at once) or on two at once, and fails one
   whose block reaches the platform's covered zones. Plays the look's `slam`
   sound, which ducks the music, unless `silent`. Look: `Tokens.slam`.

41. **A card can swing in from an angle and come flat.** `Tokens.card.tilt`
   (`{ x, y, perspective, settleFrames, parallax }`) turns the floating card in
   3D — as if the camera is coming round to face it — and eases it flat over
   `settleFrames`, with the blurred copy behind sliding the opposite way for
   depth. It is CSS perspective on the card alone, no 3D library. A shot turns
   it off with `card: { tilt: false }` or sets its own angles with `card: {
   tilt: { x, y } }`; turn alternate cards opposite ways (`y` positive, then
   negative) so a run of them does not all swing the same direction. Marks and
   pointer positions are measured on the *flat* frame, so they line up only
   once the card has settled: `verify.ts` warns if one starts before then, or
   if the look's tilt never settles (omit `settleFrames`) and the shot has any.
   Leave a tilt that stays angled for a card with nothing pinned to it.

42. **Data can ride an arrow.** `edges: [{ from, to, travel: [{ at, seconds?,
   label?, color? }] }]` on a diagram sends a dot from the `from` node's edge to
   the `to` node's, with a short glowing trail and an optional tag riding with
   it (`label: "?data=…"`) — the request leaving, the user's data going
   somewhere it should not. Time each trip from `anchors()` so it sets off on the
   word that names it; a round trip is two trips on one edge, the second after
   the first ends. The arrow is only drawn while both its nodes are, so a dot
   sent earlier is invisible — `verify.ts` warns, as it does for a trip after
   the shot ends or an edge to a node that does not exist. It eases (leaves and
   arrives gently; constant speed reads as a progress bar). Style, trip length
   and trail are `Tokens.packet`, warn-coloured by default so it reads as the
   thing worth watching rather than part of the chrome.
43. **A safeguard can be shown as the real interface.** `src: { type: "chat",
   messages }` draws a chat window: user and AI bubbles arriving in order
   (`at`), and inside an AI reply either an image slot that asks before it loads
   (`image: { host, pressAt, outcome }` — the placeholder, "Load image from
   {host}?", a button pressed at `pressAt`, then `"loaded"` or `"blocked"`) or
   buttons (`buttons: [{ label, kind, pressAt }]`, the pressed one lit and the
   others dimmed). Use it where the fix is something the user *sees* — an
   assistant asking before it fetches a remote image, an approve/deny prompt —
   instead of narrating code. Colours and type come from the look's palette.
   Space is reserved for bubbles not yet arrived, so nothing already on screen
   moves when a new one lands.
44. **Text that is there but cannot be seen, until something finds it.**
   `src: { type: "page", url, title?, lines, hidden, at?, sweep? }` draws a web
   page in a browser frame with a sentence concealed in it at near-zero
   contrast, then a scan sweeps down the page and reveals it in the warning
   colour, the revealed part staying revealed. It is "an attacker hid a note in
   invisible text" shown literally, and works for any prompt-injection line. The
   reveal is a clipped second copy of the body laid out identically, so it needs
   no measuring of where the hidden text landed and cannot drift from the faint
   copy beneath it. `verify.ts` fails a page with no visible lines or no hidden
   text and warns if the scan outlasts the shot.

45. **A diagram's cards can be sized from their text, and a still can move.**
   `fit: true` on a `diagram` sizes the cards from what is on them
   (`engine/diagramFit.ts`): the type shrinks, never below 75%, until no label
   or sub-label takes more than two lines, a card grows tall enough for what
   wraps, the icon keeps its size, and a row's `window` cards fit inside the
   frame (without it a row's cards are wider than the frame at `window: 3` and
   the outer two run off both edges). Reach for it on any row, and on any
   diagram whose labels the brief supplies and you cannot shorten. Off by
   default, so older reels render exactly as they did. `Tokens.generators.
   edgeDrawFrames` makes each arrow draw itself on, first node to second, once
   both are up. An `image` clip takes `push: { to, from?, x?, y? }`, a slow
   eased scale across the whole shot (keep `to` between 1.05 and 1.12), and
   `card: true`, the whole picture at its own aspect as the look's floating
   card over a blurred copy of itself, with the push happening inside it. Use
   `card` for a screenshot whose edges matter; leave it off for a photograph
   that should fill the frame.

45. **A section can have its own glow and its own header.** For a reel with
   nobody on screen — a tools roundup, an explainer — each section can carry
   `backdrop: true` (soft glows drifting behind a *generated* clip, in
   `Tokens.backdrop`), an `accent` (a palette name or CSS colour that tints the
   glow, the header's label and dashes, and a caption box set to `"accent"`), and
   `header: { kicker, step, title, subtitle, continued }`. The kicker is a pill
   with progress dashes (`step: [2, 3]` fills two of three) or, with
   `kickerStyle: "comment"`, a monospace `// how TLS works` with a blinking
   caret. The subtitle is a string or a list that swaps at given seconds
   (`[{ at: 0, text }, { at: 3, text }]`), crossfading in one grid cell so nothing
   below it moves. Put the same header on every shot of a section and mark the
   later ones `continued: true`, so it stays still while the picture changes. A
   header is the title role of rule 15: `verify.ts` fails a shot with both, fails
   a header starting inside the platform's covered top, and warns on a backdrop
   over footage (a video covers it). The glow drifts on *reel* time, not shot
   time, so shots of one section share one continuous glow instead of snapping
   back at each cut. Generators paint nothing over a backdrop (they read
   `useGeneratorBg`), so a new generator must use that hook for its root
   background, never `tokens.bg` directly. The look is `Tokens.backdrop` and
   `Tokens.header`; `projects/explainer` is a look built for this style.
46. **Captions can be the headline, and the spoken word can sit in a box.**
   `captionStyle: "headline"` sets the shot's words in `Tokens.headline`: big, at
   the top, built word by word as they are spoken (`reveal`: each fades in from
   a blur, unspoken words hold their space invisible so lines never re-wrap), a
   card per sentence (`breakOnSentence`), and `emphasis` as an object
   (`{ cool: ["TLS"], warm: ["network"] }`) so each group takes its own colour
   from `caption.colours`, the palette, or a CSS value. Separately,
   `caption.activeBox` puts the word being spoken in a filled box instead of only
   recolouring it, with the same padding on every word so nothing shifts as the
   box moves along the line; pair it with a short `windowMs` (about 650) for two
   or three words a card. Neither changes a look that doesn't set them, so
   existing reels render as they did. A generated clip with `in` keeps its own
   `src.seconds`: `in` there is where a borrowed voice starts reading, not a
   point to trim from (an early version subtracted it and collapsed the shot).

47. **A scene explains how a thing works, and builds as the voice explains
   it.** `src: { type: "scene", items, links?, notes? }` is a stage of glowing
   wireframes: `items` are plain icons (`laptop`, `rack`, `hacker`, `phone`,
   `database`, `lock`, `key`…) at fractions of the frame, each with a `tone`
   from `Tokens.scene.tones` (`client`, `server`, `threat`, `ok`…), a mono
   `label` ("CLIENT"), and an `at` when it draws itself on and an optional
   `until` when it leaves; `links` join two items (dotted by default, solid on
   request) and carry `travel` trips — the same eased, trailing dots as a diagram
   arrow, with a tag riding along (`password: hunter2`); `notes` are monospace
   lines that appear, type in (`typeSpeed`) and change — two notes in one place
   one after the other is a value being transformed. Use it for client/server,
   request lifecycles, an eavesdropper, a cache, a queue: anything with a few
   things, the wires between them, and something travelling. Pin every `at` to
   the word that names it so the scene builds on the voice. `verify.ts` fails an
   item id used twice, a link or note pointing at a missing item, and a dot with
   no `Tokens.packet`; it warns on anything after the shot ends. Look:
   `Tokens.scene`. The glyphs are the same path data the diagram icons use, so
   any new plain icon is available to a scene for free.
48. **A row list shows what you get, one line at a time.** `src: { type: "rows",
   rows, frame? }`: each row is an icon tile, a title, an optional monospace
   second line (red when its status is an error or warning) and a status mark
   (`check`, `warn`, `error`, `pending`), landing on its `at` — pin it to the
   word that names it — or a stagger after the row above when `at` is left out
   (a row can never arrive before the one above it by accident). `frame`
   adds a browser bar with an address and a small badge. A row's default tone
   follows the shot's `accent`, so a section's rows match its glow. Use it for a
   tool's features, the contents of a report, the steps of a process. Look:
   `Tokens.rows`.

49. **A reel with nobody on screen is built from its content, not cut by
   hand.** `engine/formats.ts` turns structured content and a voice's words
   into the whole shotlist: `sections()` is the core, `listicle()` ("five
   tools": a `TOOL 01` pill filling as it goes, the name, a subtitle, a row
   list or any clip) and `howItWorks()` (a typed `// how TLS works` comment and
   one title carried across a few scenes) are presets over it. Each section
   says *which phrase it starts on* (`starts: "number two"`), and inside a clip
   every `at` / `until` / `pressAt` may be a phrase instead of seconds:
   `"server"`, `"the server"`, `"server#2"` (second time it is said),
   `"server+0.2s"` (a little after). A phrase is searched for inside the clip it
   sits in, so a word said in an earlier section never captures it, and one that
   is not spoken throws, naming what *was* heard there. Sections abut on whole
   frames, every shot borrows the voice (`audio: { from }`, `in` = its offset)
   and states its own length, so the voice plays unbroken and captions follow it.
   Rules: the first section of a take opens it at 0 (its `starts` is checked,
   never used to trim); `lead` (default 0.12 s) opens a section a breath before
   its word; headers on consecutive shots with the same kicker, title and step
   are marked `continued`; a subtitle swap list is re-based onto each shot.
   Colours are never built in: pass `accents`. `buildSections` also returns a
   `plan` and `describePlan` prints where each section landed — read it before
   rendering. A voice recorded on its own (`raw/voice.wav`, `.m4a`) is
   ingested as an audio-only media key; give each section its own take
   (`voice: { key, words }`) where you can, and it starts at that take's zero.
   Headline captions and a header's title or subtitle share the top of the frame:
   with `captionStyle: "headline"` keep the header to its kicker.
50. **The shotlist is checked before it renders.** `npm run check <post>` runs
   `engine/verify.ts` and the timeline's own warnings against the real shotlist
   and prints every one; a `fail` exits 1, and `npm run render` runs it first and
   stops before spending the render (`--no-check` renders anyway). Until this,
   those findings only appeared in the studio console. Warnings print and do not
   stop it. It bundles the shotlist with esbuild into `out/.check/`, so a
   shotlist that cannot load is reported there too, in plain words.

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
- Manual tweaks after a render are real and expected, not a failure of the
  shotlist. Two paths, and they're not mutually exclusive: `npm run
  export-timeline <post>` turns the render into a DaVinci Resolve EDL where
  every shot is its own clip to trim, delete, reorder or grade by hand; or the
  user hands back whatever they exported from there (or from anywhere else)
  as a new raw file, which re-enters this pipeline exactly like any other
  footage — `npm run ingest` on it, and go again. Neither path needs the
  shotlist to have gotten everything right the first time.

## Layout

```
engine/          the moves and the contract — general, never show-specific
  spec.ts        the shotlist contract and timeline resolution
  icons.ts       the built-in icons as drawable path segments
  codeMorph.ts   code as positioned tokens, and how one version becomes the next
  formats.ts     sections, listicle, how-it-works: structured content + a voice → a shotlist
  scene.ts · rows.ts · header.ts · backdrop.ts · emphasis.ts · card.ts · zoom.ts · ramp.ts · impact.ts · packet.ts   pure geometry for cards, click zooms, speed ramps and impacts,
                 shared by the renderer, the timeline and verify.ts
  scale.ts       crop-then-scale, and size tokens that survive a frame change
  words.ts       word anchoring, and the pauses/fillers a cut removes
  colour.ts      matching one clip's colour to another's
  verify.ts      gates that need no render
  moves/         punch · blend · push · captions · title · badge · marks · pointer · bed · hits
  generators/    diagram · code · terminal · compare · data · callout · chat · page · rows · scene · lottie · orb
projects/        one look per channel; copy default/ and change everything
                 (explainer/ is the default plus a glow-and-header, box-caption style)
public/posts/    one folder per reel, self-contained
public/assets/   fonts and sound effects are committed, so those renders are
                 offline; music is not (public/assets/music/*.gitkeep aside)
                 — each machine generates or supplies its own
scripts/         ingest · transcribe · align · render · thumbnail · verify · new-post ·
                 takes (lists, restores, diffs and forgets past renders) ·
                 grade (measures colour) · beats (tempo, confidence and real
                 start points for a music file) · beatcheck (every cut, hit
                 and dip against the beat grid; dump-beatcheck.ts is its own
                 internal, not run directly) · critique (pacing numbers from
                 the resolved timeline; engine/critique.ts is the analysis,
                 dump-critique.ts its internal) · tighten (reports what a
                 tightening pass would remove) ·
                 check (shotlist gates before a render; render runs it) ·
                 export-timeline (writes an EDL; dump-timeline.ts and
                 ts-resolve-hook.mjs are shared internals, not run directly)
posts.ts         the register; every reel needs a line here
out/             renders, not committed
out/<post>/takes/  every past render, kept until you say to forget it
```

## Commands

```bash
npm run new 001-my-reel      # scaffold and register a post
npm run ingest 001-my-reel   # measure and conform
npm run grade 001-my-reel    # how far apart the clips look
npm run transcribe 001-my-reel
npm run tighten 001-my-reel  # what dead air and fillers a pass would remove
npm run align 001-my-reel    # only if clean/ has repaired audio
npm run studio               # live preview
npm run render 001-my-reel   # render, normalise, verify — auto-saves a take
npm run thumbnail 001-my-reel  # freeze a shot's own picture pipeline into a feed thumbnail
npm run takes 001-my-reel    # list, restore, diff or forget past takes
npm run doctor                # is this machine ready: Node, ffmpeg, uv
npm run typecheck
npm test                     # unit tests for the pure maths, no render
node scripts/make-sfx.mjs    # regenerate the default sound effects
node scripts/make-music.mjs  # write the default music bed (not committed)
npm run beats <track>        # tempo, confidence, real start points for a music file
npm run beatcheck 001-my-reel  # how far every cut, hit and dip sits from the beat grid
npm run critique 001-my-reel   # pacing: first change, longest gap, speech coverage, dead air
npm run check 001-my-reel      # the shotlist's own gates, before any render (render runs it too)
```

## Adding to the engine

New moves go in `engine/moves/`, new generators in `engine/generators/` plus a
case in its `index.tsx` and a variant in `GenSpec`. A generator takes content and
returns a clip at frame size; it may read `reel.words` so it can advance on a
spoken word, which is the thing no conventional editor makes easy.

After any engine change, run `npm run render 000-smoke-test`. It uses only
generated sources, so it proves the chain with no footage. Run `npm test` too:
it checks the pure maths (speed ramps, code morph matching, click zoom, card
geometry, impact envelopes, event-sound placement, the pacing counts) in under a
second, with no render. Both run in CI on every push.
