import React from "react";
import type { ThemeColors } from "./themes";

// "Step 3 of 9" with a row of progress dots.
export const StepHeader: React.FC<{ current: number; total: number; colors: ThemeColors; hindi: boolean }> = ({ current, total, colors, hindi }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
    <div style={{ fontSize: 40, fontWeight: 600, color: colors.muted, letterSpacing: 1 }}>
      {hindi ? `स्टेप ${current} / ${total}` : `Step ${current} of ${total}`}
    </div>
    {total <= 12 ? (
      <div style={{ display: "flex", gap: 14 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            width: i + 1 === current ? 56 : 22, height: 22, borderRadius: 11,
            background: i + 1 <= current ? colors.accent : "rgba(255,255,255,0.28)",
          }} />
        ))}
      </div>
    ) : null}
  </div>
);
