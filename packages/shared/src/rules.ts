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
// Does a change request ask for a different colour theme? Only an EXPLICIT theme word
// ("theme", "colour"/"color", "colour scheme", थीम, रंग) counts as asking to change the
// look; a theme name on its own ("the sky is blue", "a forest fire") never does, since
// those are ordinary words. Phrases like "make it", "switch to", or "change to" are not
// enough by themselves either.
const THEME_WORD = /\b(theme|colou?r|colou?rs|colou?r scheme)\b|थीम|रंग/;
const THEME_NAMES: Record<string, "sky" | "forest" | "sunset" | "night"> = {
  sky: "sky", forest: "forest", sunset: "sunset", night: "night",
  "आकाश": "sky", "जंगल": "forest", "सूर्यास्त": "sunset", "रात": "night",
};
export function requestedTheme(request: string): "sky" | "forest" | "sunset" | "night" | null {
  const text = request.toLowerCase();
  if (!THEME_WORD.test(text)) return null;
  for (const [word, theme] of Object.entries(THEME_NAMES)) {
    if (new RegExp(`(^|[^\\p{L}\\p{M}])${word}($|[^\\p{L}\\p{M}])`, "u").test(text)) return theme;
  }
  return null;
}

// Scene numbers a change request explicitly names ("scene 4", "scenes 2 and 3"). Matches
// the "Scene N" convention used in the revise prompt (1-based, by position). Returns null
// when no scene is named, meaning the request is free to touch the whole plan.
export function targetedSceneNumbers(request: string): number[] | null {
  const nums = new Set<number>();
  for (const m of request.matchAll(/\bscenes?\b[^.?!]{0,60}/gi)) {
    for (const numStr of m[0].match(/\d+/g) ?? []) nums.add(Number(numStr));
  }
  return nums.size ? [...nums].sort((a, b) => a - b) : null;
}

// After a revision, force every scene the user did NOT name back to its exact original
// content. The model is told to leave other scenes untouched, but does not reliably do
// so on its own, so this is enforced here rather than trusted to the prompt alone.
export function mergeTargetedScenes(
  original: ScenePlanType, candidate: ScenePlanType, targetNumbers: number[],
): ScenePlanType {
  if (candidate.scenes.length !== original.scenes.length) return candidate; // too different to merge safely
  const targetIdx = new Set(targetNumbers.map((n) => n - 1));
  const scenes = original.scenes.map((origScene, i) => (targetIdx.has(i) ? candidate.scenes[i] : origScene));
  return { ...candidate, scenes };
}

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
  if (words < range.min) {
    errors.push(`Total narration is ${words} words; it must be between ${range.min} and ${range.max}. Add about ${range.min - words} to ${range.max - words} more words, spread across the scenes.`);
  } else if (words > range.max) {
    errors.push(`Total narration is ${words} words; it must be between ${range.min} and ${range.max}. Remove about ${words - range.max} to ${words - range.min} words, spread across the scenes.`);
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
