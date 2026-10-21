// Usage: npm run voice [-- <run folder | latest>] [--tts edge|elevenlabs] [--voice <id>] [--force]
import { findRun, parseArgs } from "./lib";
import { voiceStep } from "./steps";

const { flags, positional } = parseArgs(process.argv.slice(2));

async function main() {
  const runDir = findRun(positional[0]);
  console.log(`Run: ${runDir}`);
  await voiceStep(runDir, { tts: flags.tts, voice: flags.voice, force: flags.force === "true" });
}

main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exitCode = 1; });
