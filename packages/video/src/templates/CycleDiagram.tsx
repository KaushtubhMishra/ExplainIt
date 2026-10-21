import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { appear, popIn } from "../anim";
import { Icon, IconBadge } from "../Icon";
import type { Content, TemplateProps } from "../types";

const W = 960;
const H = 1060;
const CX = W / 2;
const CY = H / 2;
const R = 350;

const point = (deg: number, r = R) => ({ x: CX + r * Math.cos((deg * Math.PI) / 180), y: CY + r * Math.sin((deg * Math.PI) / 180) });

export const CycleDiagram: React.FC<TemplateProps<Content<"CycleDiagram">>> = ({ content, timing, colors, hindi }) => {
  const frame = useCurrentFrame();
  const nodes = content.nodes;
  const n = nodes.length;
  const angle = (i: number) => -90 + (360 / n) * i;
  const beatAt = (i: number) => timing.beats[i]?.frame ?? i * 30;
  const gap = 360 / n / 2 - 14; // keep arrows clear of the node cards
  return (
    <div style={{ position: "relative", width: W, height: H }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="cycle-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L10 5L0 10z" fill={colors.accent} />
          </marker>
        </defs>
        {nodes.map((_, i) => {
          const from = angle(i) + gap;
          const to = angle(i) + 360 / n - gap;
          const a = point(from);
          const b = point(to);
          // Arrow i draws after node i appears and finishes as node i+1 appears (the last closes the loop).
          const start = beatAt(i) + 8;
          const end = i < n - 1 ? Math.max(start + 10, beatAt(i + 1)) : start + 24;
          const p = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <path key={i} d={`M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`} fill="none" stroke={colors.accent}
              strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p}
              markerEnd={p > 0.97 ? "url(#cycle-head)" : undefined} opacity={p > 0 ? 1 : 0} />
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: CX - 70, top: CY - 70, opacity: appear(frame, beatAt(n - 1) + 20), transform: `rotate(${frame * 1.5}deg)` }}>
        <Icon name="refresh-cw" size={140} color={colors.muted} strokeWidth={1.5} />
      </div>
      {nodes.map((node, i) => {
        const c = point(angle(i));
        const p = appear(frame, beatAt(i));
        return (
          <div key={i} style={{ position: "absolute", left: c.x - 150, top: c.y - 110, width: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, ...popIn(p) }}>
            <IconBadge name={node.icon} size={150} bg={colors.accent} color={colors.accentText} />
            <div style={{ fontSize: hindi ? 44 : 46, fontWeight: 600, color: colors.text, textAlign: "center", lineHeight: hindi ? 1.3 : 1.15, background: "rgba(0,0,0,0.28)", padding: "8px 18px", borderRadius: 20 }}>
              {node.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
