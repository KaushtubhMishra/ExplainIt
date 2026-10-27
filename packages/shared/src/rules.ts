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
// Does a change request ask for a different colour theme? Two separate ways to trigger it:
// (1) An explicit theme word ("theme", थीम) anywhere, together with a theme name anywhere
//     in the request.
// (2) "colour"/"color" directly next to a theme name ("sunset colours", "colour to forest",
//     "colour scheme: sky") — "next to" means immediately adjacent, with only a short,
//     specific connector word allowed between them (to/as/like/scheme/a colon or dash).
// A theme name on its own ("the sky is blue", "a forest fire") never triggers this, since
// those are ordinary words describing something, not a request to change the app's look —
// including when "colour"/"रंग" appears elsewhere in the same sentence rather than right
// next to the name ("the sky changes colour at sunset", "आसमान का रंग रात में काला").
const EXPLICIT_THEME_WORD = /\btheme\b|थीम/;
const THEME_NAMES: Record<string, "sky" | "forest" | "sunset" | "night"> = {
  sky: "sky", forest: "forest", sunset: "sunset", night: "night",
  "आकाश": "sky", "जंगल": "forest", "सूर्यास्त": "sunset", "रात": "night",
};
// English only: "रंग" alone is deliberately not a trigger (see note above) — only an
// explicit "theme"/थीम mention is, for Hindi.
const COLOUR_THEN_THEME = /\bcolou?rs?\b\s*(?:scheme)?\s*[:-]?\s*(?:to|as|like)?\s*(sky|forest|sunset|night)\b/i;
const THEME_THEN_COLOUR = /\b(sky|forest|sunset|night)\b\s*colou?rs?\b/i;

export function requestedTheme(request: string): "sky" | "forest" | "sunset" | "night" | null {
  const text = request.toLowerCase();
  if (EXPLICIT_THEME_WORD.test(text)) {
    for (const [word, theme] of Object.entries(THEME_NAMES)) {
      if (new RegExp(`(^|[^\\p{L}\\p{M}])${word}($|[^\\p{L}\\p{M}])`, "u").test(text)) return theme;
    }
    return null;
  }
  const m = COLOUR_THEN_THEME.exec(text) ?? THEME_THEN_COLOUR.exec(text);
  return m ? (m[1].toLowerCase() as "sky" | "forest" | "sunset" | "night") : null;
}

// Scene numbers a change request explicitly names ("scene 4", "scenes 2 and 3", "scenes
// 2-4", "दृश्य 3"). Only numbers that are part of the scene reference itself count — a
// number elsewhere in the same sentence ("scene 2 mentions 5G", "say it takes 2 minutes")
// is never picked up, because the match stops as soon as it hits a word that isn't part of
// a number, a range (2-4, 2 to 4), or a list joined by "," / "and" / "&". Returns null when
// no scene is named, meaning the request is free to touch the whole plan.
const NUMBER_LIST = /\s*(?:#|no\.?|number)?\s*(\d+(?:\s*(?:-|–|to)\s*\d+)?(?:\s*(?:,|and|&)\s*\d+(?:\s*(?:-|–|to)\s*\d+)?)*)/.source;
const SCENE_NUMBERS_EN = new RegExp(`\\bscenes?\\b${NUMBER_LIST}`, "gi");
const SCENE_NUMBERS_HI = new RegExp(`दृश्य${NUMBER_LIST}`, "g");

function addNumbersFromList(listText: string, into: Set<number>) {
  for (const part of listText.split(/\s*(?:,|and|&)\s*/i)) {
    const range = part.match(/^(\d+)\s*(?:-|–|to)\s*(\d+)$/);
    if (range) {
      const [lo, hi] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
      for (let n = lo; n <= hi; n++) into.add(n);
    } else if (/^\d+$/.test(part)) {
      into.add(Number(part));
    }
  }
}

export function targetedSceneNumbers(request: string): number[] | null {
  const nums = new Set<number>();
  for (const m of request.matchAll(SCENE_NUMBERS_EN)) addNumbersFromList(m[1], nums);
  for (const m of request.matchAll(SCENE_NUMBERS_HI)) addNumbersFromList(m[1], nums);
  return nums.size ? [...nums].sort((a, b) => a - b) : null;
}

// Is a change request ONLY about the colour theme, with nothing else asked for? If it also
// asks for a content change ("use the sunset theme and make it shorter"), the content part
// must not be silently dropped, so scene content is left free in that case (matching how
// "shorten the intro" alone is already free) while the theme still switches.
const THEME_REQUEST_STOPWORDS = new Set([
  "use", "the", "a", "an", "to", "switch", "change", "set", "it", "its", "please", "now",
  "this", "that", "my", "our", "video", "project", "theme", "themes", "colour", "colours",
  "color", "colors", "scheme", "like", "as", "with", "of", "for", "and", "also",
  "करो", "कर", "दो", "की", "का", "के", "को", "वाली", "वाला", "जैसा", "बदलो", "बदल", "से", "में", "है", "थीम", "रंग",
]);
export function isPureThemeRequest(request: string, theme: "sky" | "forest" | "sunset" | "night"): boolean {
  const themeWordsToStrip = new Set([theme, ...Object.entries(THEME_NAMES).filter(([, t]) => t === theme).map(([w]) => w)]);
  const leftover = request
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w && !THEME_REQUEST_STOPWORDS.has(w) && !themeWordsToStrip.has(w));
  return leftover.length === 0;
}

// After a revision, force every scene the user did NOT name back to its exact original
// content. The model is told to leave other scenes untouched, but does not reliably do
// so on its own, so this is enforced here rather than trusted to the prompt alone.
// Returns null, instead of silently accepting the model's full (unrestored) answer, when
// it added or removed a scene: positions would no longer line up with the original, so
// there is no safe way to tell which of its scenes were meant to replace which.
export function mergeTargetedScenes(
  original: ScenePlanType, candidate: ScenePlanType, targetNumbers: number[],
): ScenePlanType | null {
  if (candidate.scenes.length !== original.scenes.length) return null;
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
