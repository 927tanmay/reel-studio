# Changelog

## 0.1.0 — first public release

A general-purpose short-form video editor driven by a coding agent. Footage and
a brief in; a verified vertical video out. Local, free, no accounts.

**The pipeline.** Ingest and measure, transcribe with local Whisper, anchor
edits to spoken words, resolve a shotlist into a timeline, render with Remotion
and ffmpeg, normalise loudness, and verify the file (frame size, rate, runtime,
codec, size, loudness, safe areas). Every render is saved as a take you can list,
diff and restore. Beat detection, colour matching, tightening reports, a
Resolve-compatible EDL export and a feed thumbnail render are included.

**Cutting.** Cuts, punches, matched zooms, blends and pushes (with motion blur
and crossfaded audio), split edits, B-roll that keeps the voice running, dead
air and fillers removed from the real recording, music that ducks under speech
and can start on a real beat, hits and dips that land on beats.

**Presenting screen recordings.** A floating card over a blurred copy, swinging
in with a 3D turn; hand-drawn marks; click rings, spotlight and arrow; click
zoom that refuses to enlarge past native size; speed ramps with an exact source
mapping; small automatic sounds on clicks, marks and zooms.

**Making moments land.** Key-word slams sized to the frame; shake, flash and
glitch on the picture.

**Generated picture.** Diagrams with icons that draw themselves on, code with
Shiki highlighting and token-level morphs between versions, terminals,
comparisons, counters and trends, callouts, imported Lottie animations, and a
dotted "thinking" orb that can move with the voice.

**Around it.** `STYLE.md` (how many effects a reel can carry) and
`npm run critique` (pacing and emphasis against it); `ENGINE.md` and
`HANDOFF.md` for whoever writes scripts and briefs; `npm run doctor`; unit tests
for the pure maths; CI on Linux.

**Known limits.**
- macOS and Linux only; Windows is untested.
- The newer screen-recording and emphasis features (marks, click zoom, card,
  ramps, impacts, slams, Shiki code, Lottie) were verified on generated sources
  and synthetic clips, not yet on real footage — expect small fixes.
- The simple code highlighter is still the default so older reels render
  unchanged; set `highlighter: "shiki"` for the new one.
- `AGENTS.md` has been exercised with Claude Code only.
- Remotion, which does the compositing, is free for individuals and
  organisations up to three people; see the README.
