import React from "react";
import { useCurrentFrame } from "remotion";
import { appear, bob, fadeUp, popIn, pulse } from "../anim";
import { Icon, IconBadge } from "../Icon";
import type { Content, TemplateProps } from "../types";

type Side = Content<"Comparison">["left"];

export const Comparison: React.FC<TemplateProps<Content<"Comparison">>> = ({ content, timing, colors, hindi }) => {
  const frame = useCurrentFrame();
  const leftCount = content.left.points.length;
  const beatAt = (i: number, fallback: number) => timing.beats[i]?.frame ?? fallback;

  const column = (side: Side, at: number, beatOffset: number, phase: number) => (
    <div style={{ ...fadeUp(appear(frame, at)), flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, padding: "50px 26px", borderRadius: 44, background: colors.card, border: `3px solid ${colors.cardBorder}` }}>
      <div style={{ translate: `0 ${bob(frame + phase, 10)}px` }}>
        <IconBadge name={side.icon} size={210} bg={colors.accent} color={colors.accentText} scale={pulse(frame + phase)} />
      </div>
      <div style={{ fontSize: hindi ? 58 : 62, fontWeight: 700, color: colors.text, textAlign: "center", lineHeight: 1.2 }}>{side.title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 26, width: "100%" }}>
        {side.points.map((pt, i) => {
          const p = appear(frame, beatAt(beatOffset + i, at + 20 + i * 25));
          return (
            <div key={i} style={{ ...fadeUp(p, 24), display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ marginTop: 8 }}><Icon name="check" size={46} color={colors.accent} strokeWidth={3} /></div>
              <div style={{ fontSize: hindi ? 44 : 46, color: colors.text, lineHeight: hindi ? 1.35 : 1.25 }}>{pt.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "stretch", gap: 30, position: "relative", padding: "40px 0" }}>
      {column(content.left, 0, 0, 0)}
      {column(content.right, 6, leftCount, 20)}
      <div style={{ position: "absolute", left: "50%", top: 190, marginLeft: -66, width: 132, height: 132, borderRadius: 66, background: colors.text, color: colors.gradient[1], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, fontWeight: 700, ...popIn(appear(frame, 10)), scale: `${pulse(frame, 0.06, 10)}` }}>
        VS
      </div>
    </div>
  );
};
