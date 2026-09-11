import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./engine/index.ts");

// JPEG frames are meaningfully faster than PNG and the difference is invisible
// once the file is H.264. Switch to "png" only if a composition needs alpha.
Config.setVideoImageFormat("jpeg");

Config.setOverwriteOutput(true);

// Delivery defaults. Any reel can override these on the command line; the
// values that matter per reel live in its shotlist, not here.
Config.setCodec("h264");
Config.setCrf(20);
