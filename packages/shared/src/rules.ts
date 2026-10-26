import type { DurationTargetType, LanguageType, ScenePlanType, SceneType } from "./schema";

// Word ranges per language and chosen length, from measured edge-tts pace:
// English (Neerja, +10%) about 140 words per minute, Hindi (Swara, +10%) about 158.
export const WORD_RANGES: Record<LanguageType, Record<DurationTargetType, { min: number; max: number }>> = {
  "en-IN": { 60: { min: 125, max: 155 }, 90: { min: 190, max: 215 } },
  "hi-IN": { 60: { min: 140, max: 170 }, 90: { min: 210, max: 235 } },
};
const LEGACY_RANGE = { min: 150, max: 225 }; // plans made before the length choice existed

export const wordRangeFor = (language: LanguageType, target?: DurationTargetType) =>
  target ? WORD_RANGES[language][target] : LEGACY_RANGE;

// Above these lengths the voice step warns that the video came out long.
export const LENGTH_WARNING_SECONDS: Record<DurationTargetType, { min: number; max: number }> = {
  60: { min: 50, max: 75 },
  90: { min: 75, max: 100 },
};

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeWord(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, "").trim();
}

function cuesOf(scene: SceneType): string[] {
  const c = scene.content;
  switch (c.template) {
    case "StepFlow": return c.steps.map((s) => s.cue ?? "");
    case "CycleDiagram": return c.nodes.map((n) => n.cue ?? "");
    case "Comparison": return [...c.left.points, ...c.right.points].map((p) => p.cue ?? "");
    case "Recap": return c.points.map((p) => p.cue ?? "");
    case "PhoneScreen": return c.actions.map((a) => a.cue ?? "");
    default: return [];
  }
}

export function totalWords(plan: ScenePlanType): number {
  return plan.scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
}

// Errors make the plan fail (and trigger a repair retry). Warnings are only reported.
// Does the user's topic actually ask about differences? (English and Hindi wording.)
const CONTRAST_WORDS = /\b(vs\.?|versus|differ\w*|compar\w*|contrast\w*|better than)\b|बनाम|अंतर|फ़?फर्क|तुलना/i;
export const topicAsksForComparison = (topicText: string) => CONTRAST_WORDS.test(topicText);

export function checkPlanRules(plan: ScenePlanType, opts: { topicText?: string } = {}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Comparison only when the topic is about differences, and never more than once.
  const comparisons = plan.scenes.filter((s) => s.content.template === "Comparison").length;
  if (comparisons > 1) errors.push(`The plan uses Comparison ${comparisons} times; use it at most once.`);
  if (comparisons > 0 && opts.topicText !== undefined && !topicAsksForComparison(opts.topicText)) {
    errors.push("This topic is not about how two things differ, so do not use the Comparison template. Use other templates instead.");
  }
  const first = plan.scenes[0];
  const last = plan.scenes[plan.scenes.length - 1];

  if (!["TitleCard", "IconScene"].includes(first.content.template)) {
    errors.push(`Scene 1 must be a hook using TitleCard or IconScene, not ${first.content.template}.`);
  }
  if (last.content.template !== "Recap") {
    errors.push(`The last scene must use the Recap template, not ${last.content.template}.`);
  }

  const words = totalWords(plan);
  const range = wordRangeFor(plan.language, plan.durationTarget);
  if (words < range.min || words > range.max) {
    errors.push(`Total narration is ${words} words; it must be between ${range.min} and ${range.max}.`);
  }

  const ids = plan.scenes.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push("Scene ids must be unique.");

  for (const scene of plan.scenes) {
    const n = countWords(scene.narration);
    if (n > 45) warnings.push(`Scene ${scene.id} has ${n} words; long scenes can feel slow on screen.`);
  }

  for (const scene of plan.scenes) {
    const spoken = ` ${normalizeWord(scene.narration)} `;
    for (const cue of cuesOf(scene)) {
      if (!cue) continue;
      if (!spoken.includes(` ${normalizeWord(cue)}`)) {
        warnings.push(`Scene ${scene.id}: cue "${cue}" is not in its narration (will use even timing).`);
      }
    }
  }
  return { errors, warnings };
}
