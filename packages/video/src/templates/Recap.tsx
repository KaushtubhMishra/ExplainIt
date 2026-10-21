import React from "react";
import { useCurrentFrame } from "remotion";
import { appear, fadeUp, pulse, slideIn } from "../anim";
import { Icon } from "../Icon";
import type { Content, TemplateProps } from "../types";

export const Recap: React.FC<TemplateProps<Content<"Recap">>> = ({ content, timing, colors, hindi }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 50 }}>
      <div style={{ ...fadeUp(appear(frame, 0)), fontSize: hindi ? 82 : 88, fontWeight: 700, color: colors.text, textAlign: "center", lineHeight: hindi ? 1.35 : 1.12 }}>
        {content.headline}
      </div>
      {content.points.map((pt, i) => {
        const at = timing.beats[i]?.frame ?? 12 + i * 30;
        const p = appear(frame, at);
        const ticked = appear(frame, at + 8);
        return (
          <div key={i} style={{ ...slideIn(p), display: "flex", alignItems: "center", gap: 34, padding: "34px 40px", borderRadius: 38, background: colors.card, border: `3px solid ${colors.cardBorder}` }}>
            <div style={{ width: 104, height: 104, borderRadius: 52, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transform: `scale(${ticked * pulse(frame + i * 10, 0.04)})` }}>
              <Icon name="check" size={64} color={colors.accentText} strokeWidth={3} />
            </div>
            <div style={{ fontSize: hindi ? 58 : 62, fontWeight: 600, color: colors.text, lineHeight: hindi ? 1.35 : 1.2 }}>{pt.text}</div>
          </div>
        );
      })}
    </div>
  );
};
