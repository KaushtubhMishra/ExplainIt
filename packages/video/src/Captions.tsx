import React from "react";
import { useCurrentFrame } from "remotion";
import type { CaptionChunk } from "../../shared/src/timeline";
import type { ThemeColors } from "./themes";

export const Captions: React.FC<{ chunks: CaptionChunk[]; colors: ThemeColors; hindi: boolean }> = ({ chunks, colors, hindi }) => {
  const frame = useCurrentFrame();
  const chunk = chunks.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!chunk) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 18px", maxWidth: 940, padding: "18px 32px", borderRadius: 28, background: "rgba(0,0,0,0.55)" }}>
        {chunk.words.map((w, i) => {
          const next = chunk.words[i + 1];
          const active = frame >= w.startFrame && frame < (next ? next.startFrame : chunk.endFrame);
          return (
            <span key={i} style={{ fontSize: hindi ? 58 : 62, fontWeight: 700, lineHeight: hindi ? 1.45 : 1.3, color: active ? colors.accent : "#FFFFFF", transform: active ? "scale(1.06)" : "none", display: "inline-block" }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
