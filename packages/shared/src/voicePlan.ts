import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { countWords } from "./rules";
import type { ScenePlanType } from "./schema";
import { saveTiming, type VoiceProvider, type WordTiming } from "./providers/voice";

export type SceneVoice = {
  sceneId: string;
  file: string;
  seconds: number;
  words: number;
  wordsPerMinute: number;
  characters: number;
  reused: boolean;
};

export type VoiceReport = {
  provider: string;
  voice: string;
  language: string;
  characters: number;
  estimatedCredits: number;
  narrationSeconds: number;
  estimatedVideoSeconds: number; // audio + 0.3 s padding per scene
  wordsPerMinute: number;
  synthesisSeconds: number;
  scenes: SceneVoice[];
};

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

export async function voicePlan(args: {
  plan: ScenePlanType;
  runDir: string;
  provider: VoiceProvider;
  voiceId?: string;
  force?: boolean;
  log?: (line: string) => void;
}): Promise<VoiceReport> {
  const log = args.log ?? (() => {});
  const { plan, runDir, provider } = args;
  const voiceId = args.voiceId ?? provider.voiceFor(plan.language);
  const audioDir = path.join(runDir, "audio");
  const timingDir = path.join(runDir, "timing");
  mkdirSync(audioDir, { recursive: true });
  mkdirSync(timingDir, { recursive: true });
  const started = Date.now();
  const scenes: SceneVoice[] = [];

  for (const scene of plan.scenes) {
    const mp3 = path.join(audioDir, `${scene.id}.mp3`);
    const timingFile = path.join(timingDir, `${scene.id}.json`);
    const speed = provider.name === "edge-tts" ? process.env.EDGE_RATE ?? "+10%" : "";
    const key = hash(`${provider.name}|${voiceId}|${speed}|${plan.language}|${scene.narration}`);
    const words = countWords(scene.narration);

    // Reuse audio made earlier for exactly the same text and voice.
    if (!args.force && existsSync(mp3) && existsSync(timingFile)) {
      const saved = JSON.parse(readFileSync(timingFile, "utf8")) as { key: string; seconds: number };
      if (saved.key === key) {
        scenes.push({ sceneId: scene.id, file: mp3, seconds: saved.seconds, words, wordsPerMinute: Math.round((words / saved.seconds) * 60), characters: 0, reused: true });
        log(`  ${scene.id}: reused (${saved.seconds.toFixed(1)}s)`);
        continue;
      }
    }

    const t0 = Date.now();
    const result = await provider.synthesize({ text: scene.narration, language: plan.language, voiceId, mp3Path: mp3 });
    saveTiming(timingFile, {
      key, provider: provider.name, voice: voiceId, seconds: result.seconds, words: result.words as WordTiming[],
    });
    const wpm = Math.round((words / result.seconds) * 60);
    scenes.push({ sceneId: scene.id, file: mp3, seconds: result.seconds, words, wordsPerMinute: wpm, characters: result.characters, reused: false });
    log(`  ${scene.id}: ${result.seconds.toFixed(1)}s, ${result.words.length} timed words, ${wpm} wpm (${((Date.now() - t0) / 1000).toFixed(1)}s to make)`);
  }

  const narrationSeconds = scenes.reduce((s, x) => s + x.seconds, 0);
  const totalWords = scenes.reduce((s, x) => s + x.words, 0);
  const characters = scenes.reduce((s, x) => s + x.characters, 0);
  return {
    provider: provider.name,
    voice: voiceId,
    language: plan.language,
    characters,
    estimatedCredits: Math.round(characters * provider.creditsPerCharacter),
    narrationSeconds: Math.round(narrationSeconds * 10) / 10,
    estimatedVideoSeconds: Math.round((narrationSeconds + 0.3 * scenes.length) * 10) / 10,
    wordsPerMinute: Math.round((totalWords / narrationSeconds) * 60),
    synthesisSeconds: Math.round((Date.now() - started) / 1000),
    scenes,
  };
}

export function narrationCharacters(plan: ScenePlanType): number {
  return plan.scenes.reduce((s, x) => s + x.narration.length, 0);
}
