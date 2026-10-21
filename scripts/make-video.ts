// Usage: npm run make-video -- "How does water evaporate?" [--length 60|90] [--theme auto|sky|forest|sunset|night] [--lang hi-IN] [--tts elevenlabs] [--music none] [--scale 0.5]
//        npm run make-video -- --resume <run folder>   (continue a run: voice and render)
import { Language } from "../packages/shared/src/index";
import { findRun, parseArgs, parseLength, parseTheme } from "./lib";
import { planStep, renderStep, voiceStep } from "./steps";

const { flags, positional } = parseArgs(process.argv.slice(2));

async function main() {
  const started = Date.now();
  let runDir: string;
  if (flags.resume) {
    runDir = findRun(flags.resume);
    console.log(`Resuming: ${runDir}`);
  } else {
    const topic = positional.join(" ").trim();
    if (!topic) throw new Error('Give a topic, for example: npm run make-video -- "How does water evaporate?"');
    console.log("== Step 1 of 3: script ==");
    runDir = await planStep({ topic, language: Language.parse(flags.lang ?? "en-IN"), durationTarget: parseLength(flags.length), themeChoice: parseTheme(flags.theme), llm: flags.llm === "ollama" ? "ollama" : "gemini" });
  }
  console.log("\n== Step 2 of 3: voice ==");
  await voiceStep(runDir, { tts: flags.tts, voice: flags.voice });
  console.log("\n== Step 3 of 3: video ==");
  await renderStep(runDir, {
    concurrency: flags.concurrency ? Number(flags.concurrency) : undefined,
    music: flags.music,
    scale: flags.scale ? Number(flags.scale) : undefined,
  });
  const total = Math.round((Date.now() - started) / 1000);
  console.log(`\nAll steps finished in ${Math.floor(total / 60)}m ${total % 60}s.`);
}

main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exitCode = 1; });
