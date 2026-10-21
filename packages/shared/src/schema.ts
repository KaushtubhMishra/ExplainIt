import { z } from "zod";
import { ICON_NAMES } from "./icons";

export const Language = z.enum(["en-IN", "hi-IN"]);
export const Theme = z.enum(["sky", "forest", "sunset", "night"]);
export const DurationTarget = z.union([z.literal(60), z.literal(90)]);
export const ThemeChoice = z.enum(["auto", "sky", "forest", "sunset", "night"]); // what the user picks
export const IconName = z.enum(ICON_NAMES);

// cue = the narration word at which this item should appear (prototype experiment).
const Item = z.object({
  icon: IconName,
  label: z.string().min(1).max(32),
  cue: z.string().optional(),
});
const Point = z.object({
  text: z.string().min(1).max(40),
  cue: z.string().optional(),
});
const Side = z.object({
  title: z.string().min(1).max(24),
  icon: IconName,
  points: z.array(Point).max(3),
});

// One thing the viewer does on the phone screen.
const PhoneAction = z.object({
  type: z.enum(["tap", "type", "scroll", "toggle", "wait"]),
  target: z.string().min(1).max(28), // text of the on-screen element, e.g. "Install" or the typed text
  label: z.string().min(1).max(44), // instruction shown above the phone, e.g. "Tap Install"
  cue: z.string().optional(),
});

export const SceneContent = z.discriminatedUnion("template", [
  z.object({ template: z.literal("PhoneScreen"), title: z.string().min(1).max(24), actions: z.array(PhoneAction).min(1).max(4) }),
  z.object({ template: z.literal("TitleCard"), headline: z.string().min(1).max(40), subtitle: z.string().max(60).optional(), icon: IconName }),
  z.object({ template: z.literal("IconScene"), icon: IconName, label: z.string().min(1).max(32), caption: z.string().max(80) }),
  z.object({ template: z.literal("StepFlow"), steps: z.array(Item).min(3).max(5) }),
  z.object({ template: z.literal("CycleDiagram"), nodes: z.array(Item).min(3).max(5) }),
  z.object({ template: z.literal("Comparison"), left: Side, right: Side }),
  z.object({ template: z.literal("Recap"), headline: z.string().min(1).max(40), points: z.array(Point).min(1).max(3) }),
]);

export const Scene = z.object({
  id: z.string().regex(/^s\d+$/, "Scene id must look like s1, s2, s3"),
  narration: z.string().min(5).max(400),
  captionOverride: z.string().optional(),
  content: SceneContent,
});

export const ScenePlan = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(70),
  language: Language,
  theme: Theme,
  durationTarget: DurationTarget.optional(), // seconds the user chose; older plans may not have it
  scenes: z.array(Scene).min(5).max(10),
});

export type LanguageType = z.infer<typeof Language>;
export type DurationTargetType = z.infer<typeof DurationTarget>;
export type ThemeChoiceType = z.infer<typeof ThemeChoice>;
export type SceneType = z.infer<typeof Scene>;
export type ScenePlanType = z.infer<typeof ScenePlan>;
export const TEMPLATE_NAMES = ["TitleCard", "IconScene", "StepFlow", "CycleDiagram", "Comparison", "Recap", "PhoneScreen"] as const;
