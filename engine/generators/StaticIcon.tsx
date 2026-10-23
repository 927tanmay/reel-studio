import React from "react";
import { ICONS, type IconName } from "../icons";

/** A plain icon, fully drawn, in a colour — for clips that don't animate the drawing. */
export const StaticIcon: React.FC<{ name: IconName; size: number; colour: string; stroke?: number }> = ({
  name,
  size,
  colour,
  stroke = 3.6,
}) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <g fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((seg, i) =>
        seg.dot ? (
          <circle key={i} cx={seg.dot.cx} cy={seg.dot.cy} r={seg.dot.r} fill={colour} />
        ) : (
          <path key={i} d={seg.d} />
        ),
      )}
    </g>
  </svg>
);
