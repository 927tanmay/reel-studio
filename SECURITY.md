# Security

## Reporting a vulnerability

Please report privately through GitHub: on the repository, **Security →
Report a vulnerability**. Don't open a public issue for something exploitable.
You'll get a reply within a few days; this is a small project maintained by one
person, so please be patient, and tell me if you intend to publish so we can
agree a date.

## What this project is, for the purpose of scope

Reel Studio is a **local command-line tool**. It runs no server, opens no
network port and sends nothing anywhere; it shells out to `ffmpeg` and (for
transcription) `uv`/Whisper on your machine.

The things worth knowing:

- **A shotlist is TypeScript that runs on your machine.** Don't open a shotlist,
  `post.json` or brief you wouldn't be willing to run as code. The same goes
  for a third-party look (`projects/*/tokens.ts`).
- **Imported assets are parsed, not sandboxed.** Lottie JSON, fonts, images and
  media are read by the browser engine and ffmpeg. Take them from sources you
  trust, and keep ffmpeg and Node up to date.
- **Dependencies are installed from npm.** Dependabot proposes updates weekly,
  and `npm audit` is clean at the time of each release.

## Supported versions

Only the latest release and `main` get fixes.
