import type { Enter, GenSpec, Header, MediaManifest, Row, Shot } from "./spec";
import { normalise, type Word } from "./words";

/**
 * Formats: structured content in, a whole shotlist out.
 *
 * A reel with nobody on screen is a voice and a run of sections, each section a
 * header and a clip (or a few), each starting on the word that names it. That
 * shape is the same whether it is "five tools" or "how TLS works", so it is
 * written once here (`sections`) and the named formats are presets over it.
 *
 * The point is the same as `anchors()`: nothing is timed by hand. A section
 * says *which phrase it starts on*, a scene item says *which word it appears
 * on*, and the numbers fall out of the transcript, so a re-record or a
 * re-transcribe moves everything with it. Every phrase that cannot be found
 * throws, naming what was heard there, rather than quietly landing at zero.
 *
 * Pure: no remotion, no look. Colours arrive as input (`accents`), never from
 * here.
 */

/** One recorded take and its word timings, as `words.json` holds them. */
export type Voice = {
  /** The media key the take was ingested under. */
  key: string;
  words: Word[];
  /** Its length. Optional when `media` is passed to the builder. */
  seconds?: number;
};

/**
 * Anywhere a shotlist takes seconds, a format also takes a phrase: `"server"`,
 * `"the server"`, `"server#2"` (second time it is said), `"server+0.2s"` (a
 * little after it). A phrase is searched for *inside the clip it sits in*, so
 * the same word spoken in an earlier section never captures it.
 */
export type Loose<T> = T extends readonly (infer U)[]
  ? Loose<U>[]
  : T extends object
    ? { [K in keyof T]: K extends "at" | "until" | "pressAt" ? T[K] | string : Loose<T[K]> }
    : T;

/** A clip inside a section: what is drawn, and from which word it takes over. */
export type Clip = {
  src: Loose<GenSpec>;
  /**
   * Where this clip takes over inside the section — a phrase, or seconds into
   * the section. Leave out on the first clip, which opens the section.
   */
  at?: string | number;
  /** Anything else on this shot: slams, marks, impacts, emphasis, a custom `enter`. */
  shot?: Loose<Partial<Shot>>;
};

export type SectionInput = {
  /**
   * The phrase the section begins on, in the shared take. Leave out for the
   * first section (it opens the take) and for a section with its own `voice`.
   */
  starts?: string;
  /** A separate take for this section (cleaner than one long take). */
  voice?: Voice;
  /** Seconds into its own take to start reading. Only with `voice`. Default 0. */
  in?: number;
  header?: Loose<Header>;
  /** A name from the look's palette or a CSS colour: tints the glow and the header. */
  accent?: string;
  /** Soft glows behind generated clips. Default true; a look without `backdrop` ignores it. */
  backdrop?: boolean;
  clips: Clip[];
};

export type SectionsOptions = {
  /** The shared take, for sections that name a `starts` phrase. */
  voice?: Voice;
  fps: number;
  /** For the length of a separate take when its `Voice` omits `seconds`. */
  media?: MediaManifest;
  sections: SectionInput[];
  /** On every shot: `captionStyle: "headline"`, `captions: false`, a shared `emphasis`… */
  common?: Loose<Partial<Shot>>;
  /** Entering every section after the first (a clip's own `shot.enter` wins). */
  enter?: Enter;
  /** Seconds a section opens before its first word, so no breath is clipped. Default 0.12. */
  lead?: number;
  /** Seconds the last section runs past the final word. Default 0.4. */
  tail?: number;
};

/** One line of the plan: where a section landed, for reading before a render. */
export type SectionPlan = {
  index: number;
  label: string;
  voice: string;
  /** Seconds into the take. */
  from: number;
  to: number;
  frames: number;
  /** The shot indexes it produced, in the shots returned. */
  shots: number[];
};

// ---------------------------------------------------------------------------
// Finding phrases in a transcript

const tokens = (s: string) => s.split(/\s+/).map(normalise).filter(Boolean);

/** Splits `"server#2+0.2s"` into the phrase, which occurrence, and an offset. */
export const parseWhen = (s: string): { phrase: string; nth: number; offset: number } => {
  const m = /^(.+?)(?:#(\d+))?(?:\s*([+-]\d+(?:\.\d+)?)s)?$/.exec(s.trim());
  if (!m) return { phrase: s, nth: 0, offset: 0 };
  return { phrase: m[1].trim(), nth: m[2] ? Math.max(0, Number(m[2]) - 1) : 0, offset: m[3] ? Number(m[3]) : 0 };
};

/** What was said between two moments, for an error message that points somewhere. */
const heard = (words: Word[], from: number, to: number, limit = 24): string => {
  const inside = words.filter((w) => w.startMs / 1000 >= from - 0.02 && w.startMs / 1000 < to).map((w) => w.text);
  const text = inside.slice(0, limit).join(" ");
  return inside.length > limit ? `${text} …` : text || "(nothing)";
};

/**
 * Seconds at which a phrase begins, searching only inside `[from, to)`.
 * `undefined` when it is not there.
 */
export const findPhrase = (words: Word[], phrase: string, from: number, to: number, nth = 0): number | undefined => {
  const want = tokens(phrase);
  if (want.length === 0) return undefined;
  const heardWords = words.map((w) => ({ w, n: normalise(w.text) })).filter((x) => x.n);
  let seen = 0;
  for (let i = 0; i + want.length <= heardWords.length; i++) {
    const start = heardWords[i].w.startMs / 1000;
    if (start < from - 0.02 || start >= to) continue;
    if (want.every((t, k) => heardWords[i + k].n === t)) {
      if (seen === nth) return start;
      seen++;
    }
  }
  return undefined;
};

/**
 * Resolves `when` to seconds *relative to `base`*, searching `[from, to)` of the
 * take. A number is already relative and passes through.
 */
export const whenSeconds = (
  when: number | string,
  ctx: { words: Word[]; from: number; to: number; base: number; where: string },
): number => {
  if (typeof when === "number") return when;
  const { phrase, nth, offset } = parseWhen(when);
  const found = findPhrase(ctx.words, phrase, ctx.from, ctx.to, nth);
  if (found === undefined) {
    throw new Error(
      `${ctx.where}: "${when}" is not spoken between ${ctx.from.toFixed(2)}s and ${ctx.to.toFixed(2)}s. ` +
        `Heard there: ${heard(ctx.words, ctx.from, ctx.to)}`,
    );
  }
  return Math.max(0, Math.round((found + offset - ctx.base) * 1000) / 1000);
};

const TIME_KEYS = new Set(["at", "until", "pressAt"]);

/** Deep copy with every phrase in a time field turned into seconds. */
const resolveWhens = <T>(value: T, toSeconds: (when: string, where: string) => number, path = ""): T => {
  if (Array.isArray(value)) return value.map((v, i) => resolveWhens(v, toSeconds, `${path}[${i}]`)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const here = path ? `${path}.${k}` : k;
      out[k] = TIME_KEYS.has(k) && typeof v === "string" ? toSeconds(v, here) : resolveWhens(v, toSeconds, here);
    }
    return out as T;
  }
  return value;
};

// ---------------------------------------------------------------------------
// The core

type Placed = {
  section: SectionInput;
  index: number;
  voice: Voice;
  /** Frames into the take. */
  startFrame: number;
  endFrame: number;
};

const sameHeader = (a?: Header, b?: Header) =>
  !!a && !!b && a.kicker === b.kicker && a.title === b.title && JSON.stringify(a.step) === JSON.stringify(b.step);

/** The subtitle as it stands `offset` seconds into the section, swaps shifted to the shot. */
const subtitleAt = (sub: Header["subtitle"], offset: number): Header["subtitle"] => {
  if (!Array.isArray(sub)) return sub;
  const swaps = [...sub].sort((a, b) => a.at - b.at);
  const current = [...swaps].reverse().find((s) => s.at <= offset + 1e-6) ?? swaps[0];
  const later = swaps.filter((s) => s.at > offset + 1e-6).map((s) => ({ at: Math.round((s.at - offset) * 1000) / 1000, text: s.text }));
  return later.length === 0 ? current.text : [{ at: 0, text: current.text }, ...later];
};

const labelOf = (s: SectionInput, i: number) => s.header?.title ?? s.header?.kicker ?? `section ${i + 1}`;

export const buildSections = (opts: SectionsOptions): { shots: Shot[]; plan: SectionPlan[] } => {
  const { fps, sections } = opts;
  const lead = opts.lead ?? 0.12;
  const tail = opts.tail ?? 0.4;
  if (sections.length === 0) throw new Error("A format needs at least one section.");

  const voiceOf = (s: SectionInput, i: number): Voice => {
    const v = s.voice ?? opts.voice;
    if (!v) throw new Error(`Section ${i} ("${labelOf(s, i)}") has no voice: give the format a \`voice\` or the section its own.`);
    return v;
  };
  const lengthOf = (v: Voice): number => {
    const last = v.words.length ? v.words[v.words.length - 1].endMs / 1000 : 0;
    const measured = v.seconds ?? opts.media?.[v.key]?.seconds;
    return measured === undefined ? last + tail : Math.min(measured, last + tail);
  };

  // Where each section starts in its take, in seconds. A shared-take section is
  // found by its phrase, searching forward from the section before, so a phrase
  // said twice in the reel lands on the right one and two sections can never
  // find the same word.
  const starts: number[] = [];
  const reached: Record<string, number> = {};
  sections.forEach((s, i) => {
    const v = voiceOf(s, i);
    if (s.voice) {
      starts[i] = s.in ?? 0;
      return;
    }
    if (s.starts === undefined) {
      if (i > 0) throw new Error(`Section ${i} ("${labelOf(s, i)}") needs \`starts\`: the phrase it begins on.`);
      starts[i] = 0;
      reached[v.key] = 0;
      return;
    }
    const when = parseWhen(s.starts);
    const from = reached[v.key] ?? 0;
    const found = findPhrase(v.words, when.phrase, from, Infinity, when.nth);
    if (found === undefined) {
      throw new Error(
        `Section ${i} ("${labelOf(s, i)}") starts on "${s.starts}", which is not spoken after ${from.toFixed(2)}s. ` +
          `Heard from there: ${heard(v.words, from, Infinity)}`,
      );
    }
    // The first section of a take opens it: whatever was said before its phrase
    // belongs to it, so naming the phrase checks it exists but never trims.
    starts[i] = reached[v.key] === undefined ? 0 : Math.max(starts[i - 1] ?? 0, found + when.offset - lead);
    reached[v.key] = found + 0.05;
  });

  const placed: Placed[] = sections.map((section, index) => {
    const voice = voiceOf(section, index);
    const next = sections[index + 1];
    const sharesNext = next && !next.voice && !section.voice && voiceOf(next, index + 1).key === voice.key;
    const to = sharesNext ? starts[index + 1] : lengthOf(voice);
    const startFrame = Math.round(starts[index] * fps);
    const endFrame = Math.round(to * fps);
    if (endFrame <= startFrame) {
      throw new Error(
        `Section ${index} ("${labelOf(section, index)}") would be ${(endFrame - startFrame) / fps}s long ` +
          `(${starts[index].toFixed(2)}s → ${to.toFixed(2)}s of "${voice.key}"). Check its \`starts\` phrase.`,
      );
    }
    return { section, index, voice, startFrame, endFrame };
  });

  const shots: Shot[] = [];
  const plan: SectionPlan[] = [];
  let previousHeader: Header | undefined;

  for (const p of placed) {
    const { section, index, voice } = p;
    const where = `Section ${index} ("${labelOf(section, index)}")`;
    if (section.clips.length === 0) throw new Error(`${where} has no clips.`);
    const sectionFrom = p.startFrame / fps;
    const sectionTo = p.endFrame / fps;

    // Where each clip takes over, as frames into the take.
    const cuts = section.clips.map((clip, j) => {
      if (j === 0) return p.startFrame;
      if (clip.at === undefined) throw new Error(`${where}: clip ${j} needs \`at\` (the phrase or seconds it takes over on).`);
      const seconds =
        typeof clip.at === "number"
          ? sectionFrom + clip.at
          : sectionFrom +
            whenSeconds(clip.at, { words: voice.words, from: sectionFrom, to: sectionTo, base: sectionFrom, where: `${where}, clip ${j}` }) -
            lead;
      return Math.round(seconds * fps);
    });
    cuts.forEach((c, j) => {
      if (j > 0 && (c <= cuts[j - 1] || c >= p.endFrame)) {
        throw new Error(`${where}: clip ${j} takes over at ${(c / fps).toFixed(2)}s, outside the section or not after the clip before it.`);
      }
    });

    // The header, with its subtitle swaps resolved against the section.
    const headerSrc = section.header;
    const headerAbs: Header | undefined = headerSrc
      ? (resolveWhens(
          headerSrc,
          (w, k) => whenSeconds(w, { words: voice.words, from: sectionFrom, to: sectionTo, base: sectionFrom, where: `${where}, header.${k}` }),
          "header",
        ) as Header)
      : undefined;

    const shotIndexes: number[] = [];
    section.clips.forEach((clip, j) => {
      const fromFrame = cuts[j];
      const toFrame = j + 1 < cuts.length ? cuts[j + 1] : p.endFrame;
      const from = fromFrame / fps;
      const to = toFrame / fps;
      const length = (toFrame - fromFrame) / fps;
      const toSeconds = (w: string, k: string) =>
        whenSeconds(w, { words: voice.words, from, to, base: from, where: `${where}, clip ${j}, ${k}` });

      const src = { ...resolveWhens(clip.src, toSeconds, "src"), seconds: length } as GenSpec;
      const own = resolveWhens(clip.shot ?? {}, toSeconds, "shot") as Partial<Shot>;
      const common = resolveWhens(opts.common ?? {}, toSeconds, "common") as Partial<Shot>;

      let header: Header | undefined;
      if (headerAbs) {
        header = { ...headerAbs, subtitle: subtitleAt(headerAbs.subtitle, from - sectionFrom) };
        if (sameHeader(previousHeader, header)) header.continued = true;
        previousHeader = header;
      } else previousHeader = undefined;

      const shot: Shot = {
        ...common,
        src,
        in: from,
        seconds: length,
        audio: { from: voice.key },
        ...(header ? { header } : {}),
        ...(section.accent ? { accent: section.accent } : {}),
        ...(section.backdrop === false ? {} : { backdrop: true }),
        ...(opts.enter && index > 0 && j === 0 ? { enter: opts.enter } : {}),
        ...own,
      };
      shotIndexes.push(shots.length);
      shots.push(shot);
    });

    plan.push({
      index,
      label: labelOf(section, index),
      voice: voice.key,
      from: sectionFrom,
      to: sectionTo,
      frames: p.endFrame - p.startFrame,
      shots: shotIndexes,
    });
  }

  return { shots, plan };
};

/** The shots for a list of sections. */
export const sections = (opts: SectionsOptions): Shot[] => buildSections(opts).shots;

/** The plan as text, for reading before a render: where each section landed. */
export const describePlan = (plan: SectionPlan[], fps: number): string =>
  plan
    .map(
      (p) =>
        `${String(p.index).padStart(2)}  ${p.from.toFixed(2).padStart(6)}s → ${p.to.toFixed(2).padStart(6)}s  ` +
        `${(p.frames / fps).toFixed(2).padStart(5)}s  ${p.shots.length} shot${p.shots.length === 1 ? " " : "s"}  ${p.label}`,
    )
    .join("\n");

// ---------------------------------------------------------------------------
// Listicle: "five tools", "three mistakes", "four settings"

export type ListItem = {
  /** The phrase it begins on. Defaults to `name`; "number two" is usually better. */
  starts?: string;
  name: string;
  /** One line, or a list that swaps at phrases/seconds: [{ at: "free", text: "…" }]. */
  subtitle?: Header["subtitle"] | { at: string | number; text: string }[];
  accent?: string;
  /** The clips, or `rows` as a shorthand for a single row list. */
  clips?: Clip[];
  rows?: Loose<Row>[];
  /** The address bar over a `rows` list. */
  frame?: { url: string; badge?: string };
  shot?: Clip["shot"];
};

export type ListBookend = {
  starts?: string;
  kicker?: string;
  title?: string;
  subtitle?: Header["subtitle"] | { at: string | number; text: string }[];
  accent?: string;
  clips: Clip[];
};

export type ListicleOptions = Omit<SectionsOptions, "sections"> & {
  /** "TOOL" gives "TOOL 01", "TOOL 02"… */
  label?: string;
  /** Digits in the number. Default 2. */
  pad?: number;
  /** Accents cycled over items that name none. Colours are the look's business, so none are built in. */
  accents?: string[];
  /** The hook, from the start of the take to the first item. */
  intro?: ListBookend;
  items: ListItem[];
  /** The close: a verdict, a call to action. Runs to the end of the take. */
  outro?: ListBookend;
};

export const listicle = (opts: ListicleOptions): Shot[] => buildSections(listicleSections(opts)).shots;
export const planListicle = (opts: ListicleOptions) => buildSections(listicleSections(opts));

export const listicleSections = (opts: ListicleOptions): SectionsOptions => {
  const { label = "TOOL", pad = 2, accents, intro, items, outro, ...rest } = opts;
  if (items.length === 0) throw new Error("A listicle needs at least one item.");
  const out: SectionInput[] = [];

  const bookend = (b: ListBookend): SectionInput => ({
    starts: b.starts,
    accent: b.accent,
    header: b.kicker || b.title || b.subtitle ? { kicker: b.kicker, title: b.title, subtitle: b.subtitle as Header["subtitle"] } : undefined,
    clips: b.clips,
  });

  if (intro) out.push({ ...bookend(intro), starts: undefined });

  items.forEach((item, i) => {
    const clips =
      item.clips ??
      (item.rows
        ? [{ src: { type: "rows", rows: item.rows, ...(item.frame ? { frame: item.frame } : {}) } as Loose<GenSpec>, shot: item.shot }]
        : undefined);
    if (!clips) throw new Error(`Item "${item.name}" needs \`clips\` or \`rows\`: what is on screen while it is explained.`);
    out.push({
      // With no intro the first item opens the take; otherwise it begins on its name.
      starts: item.starts ?? (i === 0 && !intro ? undefined : item.name),
      accent: item.accent ?? accents?.[i % (accents.length || 1)],
      header: {
        kicker: `${label} ${String(i + 1).padStart(pad, "0")}`.trim(),
        step: [i + 1, items.length],
        title: item.name,
        subtitle: item.subtitle as Header["subtitle"],
      },
      clips,
    });
  });

  if (outro) out.push(bookend(outro));
  return { ...rest, sections: out };
};

// ---------------------------------------------------------------------------
// How it works: a few scenes, one header carrying through them

export type Step = {
  starts?: string;
  /** Overrides the shared title for this step. */
  title?: string;
  /** What the header says while this step is up. */
  subtitle?: Header["subtitle"] | { at: string | number; text: string }[];
  accent?: string;
  clips: Clip[];
};

export type HowItWorksOptions = Omit<SectionsOptions, "sections"> & {
  /** "how TLS works" → the typed comment `// how TLS works`. */
  topic: string;
  /** A big title under the comment, shared by every step. */
  title?: string;
  steps: Step[];
  accents?: string[];
};

export const howItWorksSections = (opts: HowItWorksOptions): SectionsOptions => {
  const { topic, title, steps, accents, ...rest } = opts;
  if (steps.length === 0) throw new Error("A how-it-works reel needs at least one step.");
  return {
    ...rest,
    sections: steps.map((s, i) => ({
      starts: s.starts,
      accent: s.accent ?? accents?.[i % (accents.length || 1)],
      header: { kicker: `// ${topic}`, kickerStyle: "comment" as const, title: s.title ?? title, subtitle: s.subtitle as Header["subtitle"] },
      clips: s.clips,
    })),
  };
};

export const howItWorks = (opts: HowItWorksOptions): Shot[] => buildSections(howItWorksSections(opts)).shots;
export const planHowItWorks = (opts: HowItWorksOptions) => buildSections(howItWorksSections(opts));
