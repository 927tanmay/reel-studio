import type { ReelSpec } from "./engine/spec";
import smokeTest from "./public/posts/000-smoke-test/shotlist";

/**
 * Every reel the studio knows about.
 *
 * Add one line per post. Keeping this explicit rather than scanning the folder
 * means a half-finished shotlist never breaks the studio for everything else.
 */
export const posts: Record<string, ReelSpec> = {
  "000-smoke-test": smokeTest,
};
