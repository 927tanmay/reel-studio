/**
 * Where a sound effect's file is, from its name. A plain name ("tick", "snap")
 * is one of the sounds `scripts/make-sfx.mjs` generates, a .wav in
 * `public/assets/sfx`. A name with a slash ("kit/whoosh", "pop/fs527522") is a
 * recording from the CC0 library in `public/assets/sfx/lib`, an .ogg; its
 * creator and source are in that folder's `manifest.json`. A name with its own
 * extension is taken as a path under `public/assets/sfx` exactly. Pure.
 */
export const sfxPath = (name: string): string => {
  if (/\.(wav|ogg|mp3|m4a|aac|flac)$/i.test(name)) return `assets/sfx/${name}`;
  if (name.includes("/")) return `assets/sfx/lib/${name}.ogg`;
  return `assets/sfx/${name}.wav`;
};
