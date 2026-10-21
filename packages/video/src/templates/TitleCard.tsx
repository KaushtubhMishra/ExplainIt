import React from "react";
import { useCurrentFrame } from "remotion";
import { appear, bob, fadeUp, popIn, pulse } from "../anim";
import { IconBadge } from "../Icon";
import type { Content, TemplateProps } from "../types";

export const TitleCard: React.FC<TemplateProps<Content<"TitleCard">>> = ({ content, colors, hindi }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 70, textAlign: "center" }}>
      <div style={{ ...popIn(appear(frame, 0)), translate: `0 ${bob(frame, 14)}px` }}>
        <IconBadge name={content.icon} size={360} bg={colors.accent} color={colors.accentText} scale={pulse(frame)} ring={colors.muted} ringRotation={frame * 0.6} />
      </div>
      <div style={{ ...fadeUp(appear(frame, 6)), fontSize: hindi ? 92 : 100, fontWeight: 700, lineHeight: hindi ? 1.35 : 1.1, color: colors.text, textShadow: "0 6px 24px rgba(0,0,0,0.3)" }}>
        {content.headline}
      </div>
      {content.subtitle ? (
        <div style={{ ...fadeUp(appear(frame, 14)), fontSize: hindi ? 50 : 52, color: colors.muted, lineHeight: 1.3 }}>{content.subtitle}</div>
      ) : null}
    </div>
  );
};
