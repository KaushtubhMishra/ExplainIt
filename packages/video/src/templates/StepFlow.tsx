import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { appear, bob, pulse } from "../anim";
import { IconBadge } from "../Icon";
import { StepHeader } from "../StepHeader";
import type { Content, TemplateProps } from "../types";

// Focus mode: one big step at a time; the header shows progress across the whole how-to.
export const StepFlow: React.FC<TemplateProps<Content<"StepFlow">>> = ({ content, timing, colors, hindi, stepOffset, stepTotal }) => {
  const frame = useCurrentFrame();
  const steps = content.steps;
  const beatAt = (i: number) => timing.beats[i]?.frame ?? i * 45;
  const active = steps.reduce((acc, _, i) => (frame >= beatAt(i) ? i : acc), 0);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <StepHeader current={stepOffset + active + 1} total={stepTotal} colors={colors} hindi={hindi} />
      <div style={{ position: "relative", flex: 1, width: "100%" }}>
        {steps.map((step, i) => {
          const enter = appear(frame, beatAt(i));
          const exit = i < steps.length - 1 ? appear(frame, beatAt(i + 1)) : 0;
          if (enter <= 0.001 || exit >= 0.999) return null;
          const x = interpolate(enter, [0, 1], [320, 0]) - interpolate(exit, [0, 1], [0, 320]);
          return (
            <div key={i} style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 60, opacity: enter * (1 - exit), transform: `translateX(${x}px)`,
            }}>
              <div style={{ translate: `0 ${bob(frame, 14)}px` }}>
                <IconBadge name={step.icon} size={400} bg={colors.accent} color={colors.accentText} scale={pulse(frame)} ring={colors.muted} ringRotation={frame * 0.7} />
              </div>
              <div style={{
                fontSize: hindi ? 72 : 78, fontWeight: 700, color: colors.text, textAlign: "center", lineHeight: hindi ? 1.35 : 1.15,
                padding: "26px 44px", borderRadius: 40, background: colors.card, border: `4px solid ${colors.accent}`, maxWidth: 940,
              }}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
