/**
 * A narrow module-resolution hook, for dump-timeline.ts only.
 *
 * Every shotlist and engine file imports relatively without an extension
 * (`"../../../engine/spec"`), which Remotion's own bundler resolves happily
 * but Node's native ESM loader does not. Rewriting every import across the
 * engine to satisfy a one-off diagnostic script would be a change with a far
 * wider blast radius than the script itself justifies — this hook confines
 * the accommodation to the one place that actually needs it: try the plain
 * specifier first, and if Node can't resolve it, retry with `.ts` appended.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && (specifier.startsWith("./") || specifier.startsWith("../"))) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}

// A plain `import x from "./post.json"`, with no `with { type: "json" }`
// attribute, is exactly what every shotlist already writes, matching how
// Remotion's own bundler treats JSON imports. Node's own JSON loader still
// enforces that attribute even when told the format up front, so this reads
// the file itself and hands back a short-circuited JSON module — bypassing
// that check rather than trying to satisfy it.
export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "json", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
