import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Captions } from "./Captions";
import { fontFor } from "./fonts";
import { theme, type ThemeColors } from "./themes";
import type { ScenePlanType, SceneTimeline, SceneType, Timeline } from "./types";
import { TitleCard } from "./templates/TitleCard";
import { IconScene } from "./templates/IconScene";
import { StepFlow } from "./templates/StepFlow";
import { CycleDiagram } from "./templates/CycleDiagram";
import { Comparison } from "./templates/Comparison";
import { Recap } from "./templates/Recap";
import { PhoneScreen } from "./templates/PhoneScreen";

export type ExplainerProps = { plan: ScenePlanType; timeline: Timeline };

// Shorts and Reels draw their own buttons here, so content stays clear of these areas.
const SAFE_TOP = 220;
const SAFE_BOTTOM = 460;
const CONTENT_HEIGHT = 1060;

const Background: React.FC<{ colors: ThemeColors }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const drift = (speed: number, range: number) => Math.sin(frame / speed) * range;
  const [a, b, c] = colors.gradient;
  const angle = 165 + Math.sin(frame / 120) * 12; // the light slowly shifts
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${a} 0%, ${b} 55%, ${c} 100%)` }}>
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: 350, left: -220 + drift(90, 40), top: 160 + drift(70, 30), background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 260, right: -160 + drift(80, 30), bottom: 260 + drift(100, 40), background: "rgba(255,255,255,0.05)" }} />
    </AbsoluteFill>
  );
};

type StepInfo = { stepOffset: number; stepTotal: number };

const SceneView: React.FC<{ scene: SceneType; timing: SceneTimeline; colors: ThemeColors; font: string; hindi: boolean; steps: StepInfo }> = ({ scene, timing, colors, font, hindi, steps }) => {
  const frame = useCurrentFrame();
  const props = { timing, colors, font, hindi, ...steps };
  // A slow push-in, so the shot is never completely still.
  const zoom = interpolate(frame, [0, timing.durationFrames], [1, 1.045]);
  const c = scene.content;
  let body: React.ReactNode;
  switch (c.template) {
    case "TitleCard": body = <TitleCard content={c} {...props} />; break;
    case "IconScene": body = <IconScene content={c} {...props} />; break;
    case "StepFlow": body = <StepFlow content={c} {...props} />; break;
    case "CycleDiagram": body = <CycleDiagram content={c} {...props} />; break;
    case "Comparison": body = <Comparison content={c} {...props} />; break;
    case "Recap": body = <Recap content={c} {...props} />; break;
    case "PhoneScreen": body = <PhoneScreen content={c} {...props} />; break;
  }
  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <div style={{ position: "absolute", top: SAFE_TOP, left: 60, width: 960, height: CONTENT_HEIGHT, transform: `scale(${zoom})` }}>{body}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: SAFE_BOTTOM }}>
        <Captions chunks={timing.captions} colors={colors} hindi={hindi} />
      </div>
      {timing.audioSrc ? <Audio src={staticFile(timing.audioSrc)} /> : null}
    </AbsoluteFill>
  );
};

// Number steps continuously across back-to-back StepFlow and PhoneScreen scenes.
function stepNumbering(plan: ScenePlanType): StepInfo[] {
  const count = (s: SceneType) =>
    s.content.template === "StepFlow" ? s.content.steps.length : s.content.template === "PhoneScreen" ? s.content.actions.length : 0;
  const info: StepInfo[] = plan.scenes.map(() => ({ stepOffset: 0, stepTotal: 0 }));
  let i = 0;
  while (i < plan.scenes.length) {
    if (!count(plan.scenes[i])) { i++; continue; }
    let j = i;
    let total = 0;
    while (j < plan.scenes.length && count(plan.scenes[j])) total += count(plan.scenes[j++]);
    let offset = 0;
    for (let k = i; k < j; k++) {
      info[k] = { stepOffset: offset, stepTotal: total };
      offset += count(plan.scenes[k]);
    }
    i = j;
  }
  return info;
}

// Vary the cuts between scenes.
const transitionFor = (i: number) => {
  const kind = i % 3;
  const t = kind === 1 ? slide({ direction: "from-right" }) : kind === 2 ? wipe({ direction: "from-bottom" }) : fade();
  return t as unknown as ReturnType<typeof fade>; // the three presentations share the same runtime shape
};

export const ExplainerVideo: React.FC<ExplainerProps> = ({ plan, timeline }) => {
  const steps = stepNumbering(plan);
  const frame = useCurrentFrame();
  const colors = theme(plan.theme);
  const hindi = plan.language === "hi-IN";
  const font = fontFor(plan.language);
  const musicVolume = interpolate(frame, [timeline.totalFrames - 45, timeline.totalFrames], [0.12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Background colors={colors} />
      <TransitionSeries>
        {plan.scenes.map((scene, i) => {
          const timing = timeline.scenes[i];
          return (
            <React.Fragment key={scene.id}>
              {i > 0 ? <TransitionSeries.Transition presentation={transitionFor(i)} timing={linearTiming({ durationInFrames: timeline.transitionFrames })} /> : null}
              <TransitionSeries.Sequence durationInFrames={timing.durationFrames}>
                <SceneView scene={scene} timing={timing} colors={colors} font={font} hindi={hindi} steps={steps[i]} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>
      {timeline.musicSrc ? <Audio src={staticFile(timeline.musicSrc)} volume={musicVolume} loop /> : null}
    </AbsoluteFill>
  );
};
