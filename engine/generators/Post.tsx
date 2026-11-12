import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { GenSpec, PostAuthor } from "../spec";
import { compactNumber, countValue, progress } from "../blocks";
import { Avatar, Marked, Mark, Verified, arrive, BlockFrame, blockKit, type Kit } from "./blockKit";
import type { GenProps } from "./index";
import { useGeneratorBg } from "./index";

type PostSpec = Extract<GenSpec, { type: "post" }>;

/**
 * A post, rebuilt as a card: author, text, picture, counts, and a reply that
 * lands under it. The reply's space is kept from the first frame, so the post
 * does not jump when it arrives. Counts with a `from` run up as the post lands.
 */
export const Post: React.FC<GenProps<PostSpec>> = ({ spec, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = reel.style;
  const bg = useGeneratorBg(tokens.bg);
  const kit = blockKit(tokens, reel.frame, accent, spec.theme);
  if (!kit) return <AbsoluteFill style={{ backgroundColor: bg }} />; // verify.ts says why.
  const { u, style, ink } = kit;
  const font = tokens.fonts.display;

  const start = Math.round((spec.at ?? 0) * fps);
  const landed = start + style.enterFrames;
  const count = progress(frame, landed, style.countFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <BlockFrame kit={kit} frame={reel.frame} style={{ display: "flex", flexDirection: "column", gap: u(22) }}>
        <div style={{ ...kit.card, ...arrive(frame, start, kit), padding: u(40), display: "flex", flexDirection: "column", gap: u(26) }}>
          <Byline author={spec.author} kit={kit} font={font} size={u(88)} source={spec.source} logo={spec.logo} time={spec.time} />
          <div style={{ fontFamily: font, fontSize: u(style.sizes.body), lineHeight: 1.32, color: ink.text, fontWeight: 500, whiteSpace: "pre-wrap" }}>
            <Marked text={spec.text} highlights={spec.highlights} frame={frame} fps={fps} defaultFrame={landed + 6} kit={kit} palette={tokens.palette} />
          </div>
          {spec.image ? (
            <Img src={staticFile(spec.image)} style={{ width: "100%", height: u(340), objectFit: "cover", borderRadius: u(20), display: "block" }} />
          ) : null}
          {spec.metrics?.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: u(36), rowGap: u(8), fontFamily: font, fontSize: u(style.sizes.meta), color: ink.muted }}>
              {spec.metrics.map((m, i) => (
                <span key={i} style={{ fontVariantNumeric: "tabular-nums" }}>
                  <b style={{ color: ink.text, fontWeight: 700 }}>{compactNumber(countValue(m.from ?? m.value, m.value, count))}</b> {m.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {spec.reply ? (
          <div
            style={{
              ...kit.card,
              ...arrive(frame, Math.round(spec.reply.at * fps), kit),
              marginLeft: u(56),
              padding: u(30),
              display: "flex",
              flexDirection: "column",
              gap: u(16),
            }}
          >
            <Byline author={spec.reply.author} kit={kit} font={font} size={u(64)} />
            <div style={{ fontFamily: font, fontSize: u(style.sizes.body * 0.82), lineHeight: 1.32, color: ink.text, whiteSpace: "pre-wrap" }}>{spec.reply.text}</div>
          </div>
        ) : null}
      </BlockFrame>
    </AbsoluteFill>
  );
};

const Byline: React.FC<{
  author: PostAuthor;
  kit: Kit;
  font: string;
  size: number;
  source?: string;
  logo?: string;
  time?: string;
}> = ({ author, kit, font, size, source, logo, time }) => {
  const { u, style, ink } = kit;
  const meta = [author.handle, time].filter(Boolean).join(" · ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: u(22) }}>
      <Avatar author={author} size={size} kit={kit} font={font} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: u(4) }}>
        <div style={{ display: "flex", alignItems: "center", gap: u(10), fontFamily: font, fontWeight: 700, fontSize: u(style.sizes.name), color: ink.text }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{author.name}</span>
          {author.verified ? <Verified size={u(style.sizes.name * 0.9)} colour={style.verified} tick={style.light.card} /> : null}
        </div>
        {meta ? <div style={{ fontFamily: font, fontSize: u(style.sizes.meta), color: ink.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div> : null}
      </div>
      {source || logo ? (
        <div style={{ display: "flex", alignItems: "center", gap: u(10), fontFamily: font, fontSize: u(style.sizes.meta), color: ink.muted, flex: "none" }}>
          {logo ? <Mark src={logo} height={u(40)} /> : null}
          {source ? <span>{source}</span> : null}
        </div>
      ) : null}
    </div>
  );
};
