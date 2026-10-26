import { buildTimeline, type Timeline } from "@shared/timeline";
import type { ScenePlanType } from "@shared/schema";
import type { WordTiming } from "@shared/providers/voice";

// Before any voice exists, estimate when each word would be spoken (measured pace:
// about 140 words a minute in English, 158 in Hindi), so the preview animates on cue.
export function estimatedTimeline(plan: ScenePlanType): Timeline {
  const perWord = 60 / (plan.language === "hi-IN" ? 158 : 140);
  const voices: Record<string, { seconds: number; words: WordTiming[]; audioSrc: string }> = {};
  for (const scene of plan.scenes) {
    const words = scene.narration.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{M}\p{N}]/gu, "")).filter(Boolean);
    voices[scene.id] = {
      seconds: Math.max(1.5, words.length * perWord + 0.2),
      audioSrc: "", // no audio in the storyboard preview
      words: words.map((word, i) => ({ word, start: 0.1 + i * perWord, end: 0.1 + (i + 0.85) * perWord })),
    };
  }
  return buildTimeline(plan, voices);
}
