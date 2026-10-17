import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric, type ThemeRegistration } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { placeTokens, type CodeToken } from "../codeMorph";

/**
 * Real syntax highlighting for the `code` generator, coloured from the look.
 *
 * Shiki loads its grammars asynchronously, so the render is held with
 * `delayRender` until the tokens exist — the same way fonts are. Once they do,
 * everything downstream is a pure function of the frame, as before. The
 * highlighter and each snippet's tokens are cached for the life of the page,
 * so a shot re-mounting does not highlight again.
 */

type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>;
let highlighterPromise: Promise<Highlighter> | null = null;

const getHighlighter = (): Promise<Highlighter> => {
  // The JavaScript regex engine needs no WASM, so there is nothing extra to
  // load or to go missing in a render. Grammars are fetched per language, on
  // demand, from the package itself.
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [], langs: [], engine: createJavaScriptRegexEngine() });
  }
  return highlighterPromise;
};

/**
 * A TextMate theme built from the look's palette, so highlighted code reads as
 * part of the same graphic system as every other plate on screen. Palette keys
 * `keyword`, `string`, `number`, `muted`, `code` and `accent` are the look's
 * own; `function` and `type` fall back to the accent and neutral colours.
 */
export const themeFromPalette = (palette: Record<string, string>): ThemeRegistration => {
  const base = palette.code ?? "#E6EDF3";
  const keyword = palette.keyword ?? palette.accent ?? base;
  const string = palette.string ?? palette.accent ?? base;
  const number = palette.number ?? palette.neutral ?? base;
  const muted = palette.muted ?? "#7a8590";
  const fn = palette.function ?? palette.accent ?? base;
  const type = palette.type ?? palette.neutral ?? base;

  return {
    name: `reel-${[base, keyword, string, number, muted, fn, type].join("").replace(/[^a-zA-Z0-9]/g, "")}`,
    type: "dark",
    colors: { "editor.foreground": base, "editor.background": "#00000000" },
    tokenColors: [
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: muted } },
      { scope: ["keyword", "storage", "storage.type", "keyword.operator.new", "keyword.control"], settings: { foreground: keyword } },
      { scope: ["string", "string.quoted", "punctuation.definition.string", "string.template"], settings: { foreground: string } },
      { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: number } },
      { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: fn } },
      { scope: ["entity.name.type", "entity.name.class", "support.class", "support.type"], settings: { foreground: type } },
      { scope: ["punctuation", "meta.brace"], settings: { foreground: base } },
    ],
  };
};

const cache = new Map<string, Promise<CodeToken[]>>();

const tokensFor = (code: string, lang: string, palette: Record<string, string>): Promise<CodeToken[]> => {
  const theme = themeFromPalette(palette);
  const key = `${theme.name}\u0000${lang}\u0000${code}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const work = (async () => {
    const highlighter = await getHighlighter();
    let language = lang;
    try {
      await highlighter.loadLanguage(lang as BundledLanguage);
    } catch {
      // An unknown language still renders, uncoloured, rather than failing the
      // whole render over a typo in a shotlist.
      language = "text";
    }
    const { tokens } = highlighter.codeToTokens(code, { lang: language as BundledLanguage, theme });
    return placeTokens(tokens, palette.code ?? "#E6EDF3");
  })();
  cache.set(key, work);
  return work;
};

/**
 * The tokens of each snippet, or null until they are ready. Holds the render
 * until then, and releases it even if highlighting throws — a render that
 * hangs on an exception is worse than one with plain code.
 */
export const useTokens = (
  codes: string[],
  lang: string,
  palette: Record<string, string>,
): CodeToken[][] | null => {
  const [result, setResult] = useState<CodeToken[][] | null>(null);
  const [handle] = useState(() => delayRender("Highlighting code"));
  const key = `${lang}\u0000${codes.join("\u0001")}\u0000${JSON.stringify(palette)}`;

  useEffect(() => {
    let live = true;
    Promise.all(codes.map((c) => tokensFor(c, lang, palette)))
      .then((tokens) => {
        if (!live) return;
        setResult(tokens);
        continueRender(handle);
      })
      .catch((error) => {
        console.error("Shiki failed; code will render without highlighting", error);
        if (!live) return;
        setResult(codes.map(() => []));
        continueRender(handle);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return result;
};
