import { normalizeWord } from "./rules";
import type { ScenePlanType, SceneType } from "./schema";
import type { WordTiming } from "./providers/voice";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const TRANSITION_FRAMES = 10;
const TAIL_SECONDS = 0.3; // breathing room after the last word
const CUE_LEAD_SECONDS = 0.2; // items appear just before they are named
const MIN_BEAT_GAP = 18; // 0.6 s between items appearing
const FIRST_BEAT_MAX = 12; // the first item is on screen within 0.4 s, so a scene never starts empty

export type Beat = { frame: number; fromCue: boolean };
export type CaptionWord = { text: string; startFrame: number; endFrame: number };
export type CaptionChunk = { startFrame: number; endFrame: number; words: CaptionWord[] };
export type SceneTimeline = {
  id: string;
  startFrame: number;
  durationFrames: number;
  audioSrc: string; // path inside Remotion's public folder
  audioSeconds: number;
  beats: Beat[];
  captions: CaptionChunk[];
};
export type Timeline = {
  fps: number;
  width: number;
  height: number;
  transitionFrames: number;
  totalFrames: number;
  musicSrc?: string;
  scenes: SceneTimeline[];
};

const toFrame = (s: number) => Math.max(0, Math.round(s * FPS));

// The cue word of every item that appears one by one, in order.
export function itemCues(scene: SceneType): string[] {
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

export function computeBeats(cues: string[], words: WordTiming[], audioSeconds: number, durationFrames: number): Beat[] {
  if (!cues.length) return [];
  const first = words[0]?.start ?? 0;
  const spanEnd = Math.max(first + 0.5, audioSeconds * 0.8);
  const even = (i: number) => toFrame(first + (i * (spanEnd - first)) / cues.length);
  const normalized = words.map((w) => normalizeWord(w.word));
  let searchFrom = 0;
  const beats: Beat[] = cues.map((cue, i) => {
    const target = normalizeWord(cue);
    if (target) {
      const idx = normalized.findIndex((w, j) => j >= searchFrom && (w === target || w.startsWith(target)));
      if (idx !== -1) {
        searchFrom = idx + 1;
        return { frame: toFrame(words[idx].start - CUE_LEAD_SECONDS), fromCue: true };
      }
    }
    return { frame: even(i), fromCue: false };
  });
  beats[0].frame = Math.min(beats[0].frame, FIRST_BEAT_MAX);
  // Keep items in order and at least MIN_BEAT_GAP apart, and inside the scene.
  for (let i = 1; i < beats.length; i++) {
    beats[i].frame = Math.max(beats[i].frame, beats[i - 1].frame + MIN_BEAT_GAP);
  }
  const last = durationFrames - 15;
  for (let i = beats.length - 1; i >= 0; i--) {
    const limit = i === beats.length - 1 ? last : beats[i + 1].frame - MIN_BEAT_GAP;
    beats[i].frame = Math.max(0, Math.min(beats[i].frame, limit));
  }
  return beats;
}

// Group words into caption chunks of up to 4 words, breaking early at pauses.
export function buildCaptions(words: WordTiming[], override?: string): CaptionChunk[] {
  let timed = words;
  if (override?.trim() && words.length) {
    // Spread the edited caption words evenly across the spoken time span.
    const texts = override.trim().split(/\s+/);
    const start = words[0].start;
    const step = (words[words.length - 1].end - start) / texts.length;
    timed = texts.map((t, i) => ({ word: t, start: start + i * step, end: start + (i + 1) * step }));
  }
  const chunks: CaptionChunk[] = [];
  let current: WordTiming[] = [];
  const flush = () => {
    if (!current.length) return;
    chunks.push({
      startFrame: toFrame(current[0].start),
      endFrame: toFrame(current[current.length - 1].end),
      words: current.map((w) => ({ text: w.word, startFrame: toFrame(w.start), endFrame: toFrame(w.end) })),
    });
    current = [];
  };
  timed.forEach((w, i) => {
    const prev = timed[i - 1];
    if (current.length >= 4 || (prev && w.start - prev.end > 0.3)) flush();
    current.push(w);
  });
  flush();
  // Keep each chunk on screen until the next one starts, to avoid flicker.
  for (let i = 0; i < chunks.length - 1; i++) {
    chunks[i].endFrame = Math.max(chunks[i].endFrame, Math.min(chunks[i + 1].startFrame, chunks[i].endFrame + 15));
  }
  return chunks;
}

export function buildTimeline(
  plan: ScenePlanType,
  voices: Record<string, { seconds: number; words: WordTiming[]; audioSrc: string }>,
  musicSrc?: string,
): Timeline {
  let start = 0;
  const scenes: SceneTimeline[] = plan.scenes.map((scene, i) => {
    const v = voices[scene.id];
    if (!v) throw new Error(`No audio for scene ${scene.id}. Run the voice step first.`);
    const isLast = i === plan.scenes.length - 1;
    const durationFrames = Math.ceil((v.seconds + TAIL_SECONDS) * FPS) + (isLast ? 15 : TRANSITION_FRAMES);
    const st: SceneTimeline = {
      id: scene.id,
      startFrame: start,
      durationFrames,
      audioSrc: v.audioSrc,
      audioSeconds: v.seconds,
      beats: computeBeats(itemCues(scene), v.words, v.seconds, durationFrames),
      captions: buildCaptions(v.words, scene.captionOverride),
    };
    start += durationFrames - (isLast ? 0 : TRANSITION_FRAMES);
    return st;
  });
  return {
    fps: FPS, width: WIDTH, height: HEIGHT, transitionFrames: TRANSITION_FRAMES,
    totalFrames: start, musicSrc, scenes,
  };
}
