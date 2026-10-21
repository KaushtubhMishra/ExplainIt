// Compare voices by reading the same scenes with each one, so you can listen side by side.
//
// Free voices (default):
//   npm run compare-voices
//   npm run compare-voices -- --voices en-IN-NeerjaNeural,en-IN-PrabhatNeural,hi-IN-SwaraNeural
// ElevenLabs (paid plans only for library voices):
//   npm run compare-voices -- --tts elevenlabs --voices id1,id2
//
// Options: --en <run> --hi <run> (which plans to read; default: latest of each language),
//          --scenes 2 (how many scenes per plan)
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  config, countWords, EdgeTtsProvider, ElevenLabsProvider, ScenePlan,
  type ScenePlanType, type VoiceProvider,
} from "../packages/shared/src/index";
import { findRun, parseArgs, readJson, saveJson } from "./lib";

const { flags } = parseArgs(process.argv.slice(2));
const DEFAULT_EDGE_VOICES = ["en-IN-NeerjaNeural", "en-IN-PrabhatNeural", "hi-IN-SwaraNeural", "hi-IN-MadhurNeural"];

async function main() {
  const useEleven = (flags.tts ?? "edge").startsWith("eleven");
  const provider: VoiceProvider & { voiceName?: (id: string) => Promise<string> } =
    useEleven ? new ElevenLabsProvider() : new EdgeTtsProvider();
  const voices = (flags.voices ?? (useEleven ? "" : DEFAULT_EDGE_VOICES.join(",")))
    .split(",").map((v) => v.trim()).filter(Boolean);
  if (!voices.length) throw new Error("Give voice IDs: npm run compare-voices -- --tts elevenlabs --voices id1,id2");
  const sceneCount = Number(flags.scenes ?? 2);

  const plans: ScenePlanType[] = [];
  for (const [lang, flag] of [["en-IN", flags.en], ["hi-IN", flags.hi]] as const) {
    try {
      plans.push(ScenePlan.parse(readJson(path.join(findRun(flag, lang), "plan.json"))));
    } catch {
      console.log(`(No ${lang} plan found, skipping that language.)`);
    }
  }

  if (useEleven && provider.remainingCredits) {
    const chars = plans.reduce((s, p) => s + p.scenes.slice(0, sceneCount).reduce((a, x) => a + x.narration.length, 0), 0);
    const needed = Math.ceil(chars * voices.length * provider.creditsPerCharacter);
    const left = await provider.remainingCredits();
    console.log(`About ${needed} credits needed, ${left ?? "unknown"} left this month.`);
    if (left != null && left < needed) throw new Error("Not enough credits. Try fewer voices or --scenes 1.");
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outDir = path.join(config.mediaDir(), "voice-compare", stamp);
  mkdirSync(outDir, { recursive: true });
  const rows: Record<string, unknown>[] = [];
  const totals: Record<string, { words: number; seconds: number }> = {};

  for (const voiceId of voices) {
    const name = useEleven && provider.voiceName ? await provider.voiceName(voiceId) : voiceId;
    const safe = name.replace(/[^a-z0-9-]+/gi, "-").slice(0, 40);
    for (const plan of plans) {
      // Free voices speak one language each: en-IN voices read the English plan, hi-IN voices the Hindi one.
      if (!useEleven && !voiceId.startsWith(plan.language)) continue;
      for (const scene of plan.scenes.slice(0, sceneCount)) {
        const file = path.join(outDir, `${safe}_${plan.language}_${scene.id}.mp3`);
        try {
          const r = await provider.synthesize({ text: scene.narration, language: plan.language, voiceId, mp3Path: file });
          const words = countWords(scene.narration);
          const key = `${name} (${plan.language})`;
          totals[key] = { words: (totals[key]?.words ?? 0) + words, seconds: (totals[key]?.seconds ?? 0) + r.seconds };
          rows.push({ voice: name, lang: plan.language, scene: scene.id, seconds: r.seconds.toFixed(1), wpm: Math.round((words / r.seconds) * 60) });
          console.log(`  ${name} ${scene.id}: ${r.seconds.toFixed(1)}s`);
        } catch (e) {
          rows.push({ voice: name, lang: plan.language, scene: scene.id, seconds: "error", wpm: (e as Error).message.slice(0, 60) });
          console.log(`  ${name} ${scene.id}: ${(e as Error).message}`);
        }
      }
    }
  }

  console.table(rows);
  const summary = Object.entries(totals).map(([voice, t]) => ({ voice, wordsPerMinute: Math.round((t.words / t.seconds) * 60) }));
  if (summary.length) {
    console.log("\nAverage pace per voice:");
    console.table(summary);
  }
  saveJson(outDir, "compare.json", { rows, summary });
  console.log(`\nListen to the files in: ${outDir}`);
}

main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exitCode = 1; });
