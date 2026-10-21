import React from "react";
import { useCurrentFrame } from "remotion";
import { appear, bob, fadeUp, popIn, pulse } from "../anim";
import { IconBadge } from "../Icon";
import type { Content, TemplateProps } from "../types";

export const IconScene: React.FC<TemplateProps<Content<"IconScene">>> = ({ content, colors, hindi }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 70, textAlign: "center" }}>
      <div style={{ ...fadeUp(appear(frame, 0)), fontSize: hindi ? 78 : 84, fontWeight: 700, color: colors.text, lineHeight: hindi ? 1.35 : 1.12 }}>
        {content.label}
      </div>
      <div style={{ ...popIn(appear(frame, 4)), translate: `0 ${bob(frame, 16)}px` }}>
        <IconBadge name={content.icon} size={440} bg={colors.accent} color={colors.accentText} scale={pulse(frame, 0.03, 16)} ring={colors.muted} ringRotation={-frame * 0.5} />
      </div>
      <div style={{ ...fadeUp(appear(frame, 14)), fontSize: hindi ? 52 : 56, color: colors.muted, lineHeight: 1.35, maxWidth: 920 }}>{content.caption}</div>
    </div>
  );
};
