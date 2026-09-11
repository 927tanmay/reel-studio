import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import type { Tokens } from "./tokens";

const loaded = new Set<string>();

/**
 * Loads any local font files a look declares, from public/assets/fonts.
 *
 * Fonts are committed to the repository rather than fetched, so a render is
 * reproducible and works offline. A look that names only system families
 * loads nothing and costs nothing.
 */
export const useFonts = (tokens: Tokens) => {
  const files = tokens.fonts.files ?? [];
  const [handle] = useState(() => (files.length > 0 ? delayRender("Loading fonts") : null));

  useEffect(() => {
    if (handle === null) return;

    const pending = files.map(async (f) => {
      const id = `${f.family}-${f.weight ?? "400"}-${f.style ?? "normal"}`;
      if (loaded.has(id)) return;

      const face = new FontFace(f.family, `url(${staticFile(f.file)})`, {
        weight: f.weight ?? "400",
        style: f.style ?? "normal",
      });
      await face.load();
      (document.fonts as FontFaceSet & { add(f: FontFace): void }).add(face);
      loaded.add(id);
    });

    Promise.all(pending)
      .catch((err) => {
        console.error(
          "A font failed to load. Check the path under public/assets/fonts.",
          err,
        );
      })
      .finally(() => continueRender(handle));
  }, [handle, files]);
};
