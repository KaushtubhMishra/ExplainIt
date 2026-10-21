import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { appear, fadeUp, popIn } from "../anim";
import { Icon } from "../Icon";
import type { Content, TemplateProps } from "../types";

type Action = Content<"PhoneScreen">["actions"][number];

const PHONE_W = 600;
const PHONE_H = 820;
const BEZEL = 16;
const SCREEN_W = PHONE_W - BEZEL * 2;
const BLUE = "#1A73E8";
const INK = "#1F2328";
const GREY = "#E8EAED";
const ELEMENT_TOP = 170; // first element's top, inside the screen
const ROW = 130; // vertical space per element

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// One on-screen element, drawn according to what the viewer does with it.
const Element: React.FC<{ action: Action; frame: number; at: number; next: number; active: boolean }> = ({ action, frame, at, next, active }) => {
  const done = frame >= at;
  const outline = active ? `0 0 0 6px ${BLUE}55` : "none";
  switch (action.type) {
    case "type": {
      const chars = Math.max(0, Math.floor((frame - at - 6) / 2));
      const text = action.target.slice(0, chars);
      const caret = active && Math.floor(frame / 15) % 2 === 0;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 16, height: 84, padding: "0 26px", borderRadius: 42, background: GREY, boxShadow: outline }}>
          <Icon name="search" size={38} color="#5F6368" />
          <div style={{ fontSize: 36, color: text ? INK : "#80868B" }}>{text || "Search"}{caret ? "|" : ""}</div>
        </div>
      );
    }
    case "toggle": {
      const on = interpolate(frame, [at + 4, at + 12], [0, 1], clamp);
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 92, padding: "0 26px", borderRadius: 24, background: "#FFFFFF", boxShadow: outline }}>
          <div style={{ fontSize: 36, color: INK, fontWeight: 600 }}>{action.target}</div>
          <div style={{ width: 92, height: 50, borderRadius: 25, background: on > 0.5 ? BLUE : "#BDC1C6", position: "relative" }}>
            <div style={{ position: "absolute", top: 5, left: 5 + on * 42, width: 40, height: 40, borderRadius: 20, background: "#FFFFFF" }} />
          </div>
        </div>
      );
    }
    case "wait": {
      const progress = interpolate(frame, [at, Math.max(at + 10, Math.min(at + 50, next - 16))], [0, 1], clamp);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 26px", borderRadius: 24, background: "#FFFFFF", boxShadow: outline }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 30, color: INK, fontWeight: 600 }}>{action.target}</div>
            {progress >= 1 ? <Icon name="circle-check" size={40} color="#188038" /> : <div style={{ fontSize: 28, color: "#5F6368" }}>{Math.round(progress * 100)}%</div>}
          </div>
          <div style={{ height: 14, borderRadius: 7, background: GREY, overflow: "hidden" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", background: BLUE }} />
          </div>
        </div>
      );
    }
    case "scroll": {
      const shift = interpolate(frame, [at, at + 24], [0, -60], clamp);
      return (
        <div style={{ height: 110, overflow: "hidden", borderRadius: 24, background: "#FFFFFF", boxShadow: outline }}>
          <div style={{ transform: `translateY(${shift}px)`, padding: "14px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ height: 24, width: "70%", borderRadius: 12, background: GREY }} />
            <div style={{ fontSize: 30, color: done ? INK : "#80868B", fontWeight: 600 }}>{action.target}</div>
            <div style={{ height: 24, width: "55%", borderRadius: 12, background: GREY }} />
          </div>
        </div>
      );
    }
    default: {
      // tap: a button that presses down when tapped
      const press = interpolate(frame, [at, at + 4, at + 10], [1, 0.94, 1], clamp);
      return (
        <div style={{ height: 88, borderRadius: 44, background: done ? BLUE : "#FFFFFF", color: done ? "#FFFFFF" : BLUE, border: `3px solid ${BLUE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 700, transform: `scale(${press})`, boxShadow: outline }}>
          {action.target}
        </div>
      );
    }
  }
};

export const PhoneScreen: React.FC<TemplateProps<Content<"PhoneScreen">>> = ({ content, timing, colors, hindi, stepOffset, stepTotal }) => {
  const frame = useCurrentFrame();
  const actions = content.actions;
  const beatAt = (i: number) => timing.beats[i]?.frame ?? 12 + i * 45;
  const active = actions.reduce((acc, _, i) => (frame >= beatAt(i) - 12 ? i : acc), 0);
  const centerY = (i: number) => ELEMENT_TOP + i * ROW + 44;

  // The finger glides to each element shortly before its action happens.
  let fingerY = centerY(0);
  for (let i = 1; i < actions.length; i++) {
    const move = interpolate(frame, [beatAt(i) - 14, beatAt(i) - 2], [0, 1], clamp);
    fingerY += (centerY(i) - centerY(i - 1)) * move;
  }
  const current = actions[active];
  const tapAt = beatAt(active);
  const fingerPress = interpolate(frame, [tapAt - 2, tapAt + 2, tapAt + 8], [1, 0.85, 1], clamp);
  const swipe = current.type === "scroll" ? interpolate(frame, [tapAt, tapAt + 24], [0, -60], clamp) : 0;
  const fingerVisible = current.type !== "wait" || frame < tapAt;
  const ripple = interpolate(frame, [tapAt, tapAt + 16], [0, 1], clamp);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      {/* Instruction for the current action, with the step number across the whole how-to */}
      <div style={{ height: 130, width: "100%", position: "relative" }}>
        {actions.map((a, i) => {
          // The old instruction fades out before the new one fades in, so they never overlap.
          const enter = i === 0 ? appear(frame, 0) : interpolate(frame, [beatAt(i) - 8, beatAt(i)], [0, 1], clamp);
          const exit = i < actions.length - 1 ? interpolate(frame, [beatAt(i + 1) - 16, beatAt(i + 1) - 9], [0, 1], clamp) : 0;
          if (enter <= 0.001 || exit >= 0.999) return null;
          return (
            <div key={i} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 24, opacity: enter * (1 - exit), transform: `translateY(${(1 - enter) * 30 - exit * 30}px)` }}>
              <div style={{ width: 88, height: 88, borderRadius: 44, background: colors.accent, color: colors.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, fontWeight: 700, flexShrink: 0 }}>
                {stepOffset + i + 1}
              </div>
              <div style={{ fontSize: hindi ? 54 : 58, fontWeight: 700, color: colors.text, lineHeight: 1.25, maxWidth: 820 }}>{a.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 34, color: colors.muted, marginTop: -16 }}>
        {hindi ? `स्टेप ${stepOffset + active + 1} / ${stepTotal}` : `Step ${stepOffset + active + 1} of ${stepTotal}`}
      </div>

      {/* The phone */}
      <div style={{ ...popIn(appear(frame, 0)), position: "relative", width: PHONE_W, height: PHONE_H, borderRadius: 72, background: "#0F1115", padding: BEZEL, boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
        <div style={{ position: "relative", width: SCREEN_W, height: PHONE_H - BEZEL * 2, borderRadius: 58, background: "#F1F3F4", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 36px 0", fontSize: 24, color: INK, fontFamily: "Poppins, sans-serif" }}>
            <span>9:41</span>
            <span style={{ display: "flex", gap: 8 }}><Icon name="signal" size={26} color={INK} /><Icon name="wifi" size={26} color={INK} /><Icon name="battery-charging" size={26} color={INK} /></span>
          </div>
          <div style={{ margin: "24px 32px 0", fontSize: 40, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{content.title}</div>
          {actions.map((a, i) => (
            <div key={i} style={{ position: "absolute", left: 30, right: 30, top: ELEMENT_TOP + i * ROW, ...fadeUp(appear(frame, 2 + i * 4), 20) }}>
              <Element action={a} frame={frame} at={beatAt(i)} next={i < actions.length - 1 ? beatAt(i + 1) : beatAt(i) + 60} active={i === active} />
            </div>
          ))}
          {/* placeholder rows below the elements, so the screen looks like a real app */}
          {Array.from({ length: 4 - Math.min(actions.length, 3) }, (_, k) => (
            <div key={`row${k}`} style={{ position: "absolute", left: 32, right: 32, top: ELEMENT_TOP + (actions.length + k) * ROW + 20, display: "flex", gap: 20, alignItems: "center", opacity: 0.7 }}>
              <div style={{ width: 72, height: 72, borderRadius: 18, background: GREY }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ height: 20, width: `${70 - k * 10}%`, borderRadius: 10, background: GREY }} />
                <div style={{ height: 20, width: `${45 + k * 8}%`, borderRadius: 10, background: GREY }} />
              </div>
            </div>
          ))}
          {/* tap ripple */}
          {current.type !== "wait" && current.type !== "scroll" ? (
            <div style={{ position: "absolute", left: SCREEN_W / 2 - 60, top: centerY(active) - 60, width: 120, height: 120, borderRadius: 60, border: `6px solid ${BLUE}`, opacity: ripple > 0 && ripple < 1 ? 1 - ripple : 0, transform: `scale(${0.4 + ripple})` }} />
          ) : null}
        </div>
        {/* finger */}
        <div style={{ position: "absolute", left: PHONE_W / 2 - 10, top: BEZEL + fingerY - 6 + swipe, opacity: fingerVisible ? appear(frame, 6) : 0, transform: `scale(${fingerPress})`, transformOrigin: "20px 6px", filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.35))" }}>
          <Icon name="pointer" size={110} color="#1F2328" fill="#FFFFFF" strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
};
