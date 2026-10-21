import React from "react";
import { icons, Sparkles } from "lucide-react";

// Names in the allowlist that lucide renamed.
const ALIASES: Record<string, string> = { waves: "WavesHorizontal", "circle-help": "CircleQuestionMark" };
const toPascal = (name: string) => name.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join("");

export const Icon: React.FC<{ name: string; size: number; color: string; strokeWidth?: number; fill?: string }> = ({
  name, size, color, strokeWidth = 2, fill = "none",
}) => {
  const Component = (icons as Record<string, React.ComponentType<Record<string, unknown>>>)[ALIASES[name] ?? toPascal(name)] ?? Sparkles;
  return <Component size={size} color={color} strokeWidth={strokeWidth} fill={fill} />;
};

export const IconBadge: React.FC<{ name: string; size: number; bg: string; color: string; scale?: number; ring?: string; ringRotation?: number }> = ({
  name, size, bg, color, scale = 1, ring, ringRotation = 0,
}) => (
  <div style={{ position: "relative", width: size, height: size, flexShrink: 0, transform: `scale(${scale})` }}>
    {ring ? (
      <div style={{ position: "absolute", inset: -size * 0.09, borderRadius: "50%", border: `${Math.max(4, size * 0.02)}px dashed ${ring}`, transform: `rotate(${ringRotation}deg)` }} />
    ) : null}
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 40px rgba(0,0,0,0.28)" }}>
      <Icon name={name} size={size * 0.56} color={color} />
    </div>
  </div>
);
