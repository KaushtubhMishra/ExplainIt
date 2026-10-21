import { ICON_NAMES } from "../icons";
import type { DurationTargetType, LanguageType, ThemeChoiceType } from "../schema";
import { WORD_RANGES } from "../rules";

export const SCRIPT_PROMPT_VERSION = "script.v1";

const EXAMPLE = `{
  "version": 1,
  "title": "How Does Water Evaporate?",
  "language": "en-IN",
  "theme": "sky",
  "scenes": [
    { "id": "s1", "narration": "Ever wondered where a puddle goes on a sunny day?",
      "content": { "template": "TitleCard", "headline": "Where does a puddle go?", "icon": "droplet" } },
    { "id": "s2", "narration": "First, the sun heats the water. Then the molecules speed up. Finally, some escape into the air as vapour.",
      "content": { "template": "StepFlow", "steps": [
        { "icon": "sun", "label": "Sun heats water", "cue": "heats" },
        { "icon": "zap", "label": "Molecules speed up", "cue": "molecules" },
        { "icon": "cloud", "label": "Escape as vapour", "cue": "escape" } ] } }
  ]
}`;

const TEMPLATES = `
- TitleCard: { "template": "TitleCard", "headline": max 40 chars, "subtitle"?: max 60 chars, "icon" }
- IconScene: { "template": "IconScene", "icon", "label": max 32 chars, "caption": max 80 chars }
- StepFlow: { "template": "StepFlow", "steps": 3-5 items of { "icon", "label": max 32 chars, "cue" } }
- CycleDiagram: { "template": "CycleDiagram", "nodes": 3-5 items of { "icon", "label": max 32 chars, "cue" } }
- Comparison: { "template": "Comparison", "left": { "title": max 24, "icon", "points": up to 3 of { "text": max 40, "cue" } }, "right": same shape }
- Recap: { "template": "Recap", "headline": max 40 chars, "points": 1-3 of { "text": max 40, "cue" } }
- PhoneScreen: { "template": "PhoneScreen", "title": max 24 chars (the app or screen name shown at the top of the phone), "actions": 1-4 of { "type": "tap" | "type" | "scroll" | "toggle" | "wait", "target": max 28 chars (the exact on-screen text: a button name, a menu item, or the text being typed), "label": max 44 chars (a short instruction, e.g. "Tap Install"), "cue" } }. "wait" is for progress like downloading. Use one PhoneScreen scene per screen the user sees.`;

export function buildScriptPrompt(args: { topic: string; language: LanguageType; durationTarget: DurationTargetType; themeChoice?: ThemeChoiceType; notes?: string }) {
  const themeChoice = args.themeChoice ?? "auto";
  const hindi = args.language === "hi-IN";
  const range = WORD_RANGES[args.language][args.durationTarget];
  const sceneHint = args.durationTarget === 60 ? "5-7 scenes" : "6-10 scenes";
  const system = `You write scripts for ${args.durationTarget}-second vertical educational explainer videos for a general audience.
Return ONLY a JSON object (no markdown, no commentary) that follows the structure of this example:
${EXAMPLE}

Rules:
1. Total narration across all scenes: ${range.min}-${range.max} words, for a video of about ${args.durationTarget} seconds. Count carefully.
2. ${sceneHint} (never fewer than 5 or more than 10). Scene ids are "s1", "s2", ... in order.
3. Scene 1 is a hook question using TitleCard or IconScene. The last scene uses Recap and sums up in one line.
4. Narration is spoken text: short, clear sentences, no lists, no symbols, no markdown, no emoji. Each scene's narration is 15-40 words, so the picture changes every few seconds.
5. Stick to well-established facts. If unsure about a claim, leave it out.
6. Use only these templates, with exactly these fields:${TEMPLATES}
7. "icon" must be one of: ${ICON_NAMES.join(", ")}. Pick the icon that best matches its own label, and avoid reusing the same icon for different ideas.
8. Every step, node, and point has a "cue": one single word copied exactly from that scene's narration, at the moment the item is mentioned. Cues follow the order of the narration.
9. Every label, headline, and point must restate something the narration actually says. Never add facts on screen that are not spoken.
10. Use CycleDiagram only for processes that loop back to their starting point. Use StepFlow for one-way sequences. A Comparison contrasts two different things (for example liquid water vs ice), never two moments of the same thing.
11. For how-to topics (using a phone, an app, or a setting), show the actions with PhoneScreen scenes, one action per item, in the order the user does them; use StepFlow only for steps that do not happen on a phone screen. Name buttons and menus exactly as they appear on screen, in English letters (for example "Install", "Settings", "Wi-Fi"), even in a Hindi script. Describe steps that work on most phones, and say when an option's name or place can differ between phones.
12. Icons are generic symbols from the list above; never try to show brand logos.
${themeChoice === "auto" ? `13. "theme" is one of: sky, forest, sunset, night. Pick the one that suits the topic.` : `13. "theme" is "${themeChoice}".`}
14. "version" is 1 and "language" is "${args.language}".
${hindi ? `15. Write all narration, labels, headlines, and points in natural, simple spoken Hindi in Devanagari script, the way a friendly Indian teacher explains. Keep common scientific and technical terms in English (written in Devanagari) where Indians usually say them in English. Button and menu names stay in English letters, as rule 11 says. Cues are written in Devanagari exactly as in the narration.` : `15. Write in clear Indian English.`}`;

  const user = args.notes
    ? `Topic: ${args.topic}\n\nBase the script on these notes. Do not add facts that contradict them:\n${args.notes}`
    : `Topic: ${args.topic}`;
  return { system, user };
}
