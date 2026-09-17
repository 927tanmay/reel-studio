import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./engine/index.ts");

// PNG frames, not JPEG: JPEG's own lossy artifacts show up on a talking-head
// take — skin tone and gradients — before the file ever reaches H.264, in a
// way flatter B-roll (screen recordings, generated UI) hides. Slower to
// render; worth it for final delivery quality.
Config.setVideoImageFormat("png");

Config.setOverwriteOutput(true);

// Delivery defaults. Any reel can override these on the command line; the
// values that matter per reel live in its shotlist, not here.
Config.setCodec("h264");
// Lower is higher quality. 20 was visibly soft on A-roll; 16 is close to
// visually lossless for x264 and the file size cap (250MB default) has
// enormous headroom at this runtime — a ~40s reel lands well under it.
Config.setCrf(16);
