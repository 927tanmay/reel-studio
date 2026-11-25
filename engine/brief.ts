/**
 * The spoken lines a brief already holds, for captions spelled as typed.
 *
 * A brief's `## Script` gives each take as a heading and its line in double
 * quotes under it:
 *
 *   ### hook.mov — 1 take
 *   "16 gb mai kaise fit ho jaata hai 256 gb ka game?"
 *
 * That line is exactly what a `raw/<key>.txt` would hold, so the transcribe
 * stage can use it without anyone copying it into a file. It only does so when
 * the brief says the reel's captions come from its script — a `Language:
 * Hinglish` line, or `Captions: from script` — because an English reel's
 * captions have always followed what was actually said, and a script line is a
 * plan, not a record.
 *
 * Only the quoted paragraph(s) directly under a heading are the line. A note
 * after it ("drop "walking past" from beacon") is not, even though it quotes.
 * Pure; no imports.
 */

export type BriefScript = {
  /** True when the brief says captions come from its script. */
  fromScript: boolean;
  /** The line that said so, for the log. */
  because: string | null;
  /** True when the brief's `Language:` says Hinglish. */
  hinglish: boolean;
  /** Each take's typed line, by media key (the file name as ingest keys it). */
  lines: Record<string, string>;
};

const MEDIA = /\.(mov|mp4|m4v|webm|mkv|wav|m4a|mp3|aac|flac)\b/i;

/** The same key ingest gives a file: its name, lower case, runs of anything else as one dash. */
export const keyOf = (name: string): string =>
  name
    .replace(MEDIA, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The lines under one `## ` heading, up to the next. Empty when the brief has none. */
const section = (lines: string[], title: RegExp): string[] => {
  const start = lines.findIndex((l) => /^##\s/.test(l) && title.test(l.replace(/^##\s+/, "")));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end);
};

const OPEN = /^["“”]/;
const CLOSE = /["“”]\s*$/;

export const parseBrief = (md: string): BriefScript => {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");

  // Whether captions come from the script: a Language that says Hinglish, or a
  // Captions field saying so, in Delivery (or, for the Captions field, anywhere
  // a brief writer might have put it).
  const delivery = section(lines, /^delivery\b/i);
  const languageLine = delivery.find((l) => /^\s*language\s*:/i.test(l)) ?? null;
  const hinglish = Boolean(languageLine && /hinglish/i.test(languageLine));
  const captionsLine = lines.find((l) => /^\s*captions\s*:\s*from\s+(the\s+)?script\b/i.test(l)) ?? null;
  const fromScript = hinglish || Boolean(captionsLine);
  const because = captionsLine?.trim() ?? (hinglish ? languageLine!.trim() : null);

  const out: Record<string, string> = {};
  const script = section(lines, /^script\b/i);
  for (let i = 0; i < script.length; i++) {
    const heading = /^###\s+(.+)$/.exec(script[i]);
    if (!heading || !MEDIA.test(heading[1])) continue;
    // The file is everything up to its media extension, spaces and all:
    // "hook.mov — 1 take", "Cta Take.MP4 – 1 take".
    const file = /^(.+?)\.(mov|mp4|m4v|webm|mkv|wav|m4a|mp3|aac|flac)\b/i.exec(heading[1].trim());
    if (!file) continue;
    const key = keyOf(file[1]);

    // The quoted paragraphs straight under the heading, until a line that is
    // not part of one (a note, a blank-then-unquoted line, the next heading).
    const quoted: string[] = [];
    let j = i + 1;
    while (j < script.length && script[j].trim() === "") j++;
    while (j < script.length && OPEN.test(script[j].trim())) {
      let para = script[j].trim();
      while (!CLOSE.test(para.slice(1)) && j + 1 < script.length && script[j + 1].trim() !== "" && !/^#/.test(script[j + 1])) {
        j++;
        para += " " + script[j].trim();
      }
      quoted.push(para.replace(/^["“”]/, "").replace(/["“”]\s*$/, ""));
      j++;
      while (j < script.length && script[j].trim() === "") j++;
    }
    if (quoted.length) out[key] = quoted.join(" ").replace(/\s+/g, " ").trim();
  }

  return { fromScript, because, hinglish, lines: out };
};
