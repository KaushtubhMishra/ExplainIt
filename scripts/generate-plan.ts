// Usage: npm run plan -- "How does water evaporate?" [--length 60|90] [--theme auto|sky|forest|sunset|night] [--lang en-IN|hi-IN] [--llm gemini|ollama] [--notes notes.txt]
import { readFileSync } from "node:fs";
import { Language } from "../packages/shared/src/index";
import { parseArgs, parseLength, parseTheme } from "./lib";
import { planStep } from "./steps";

const { flags, positional } = parseArgs(process.argv.slice(2));
const topic = positional.join(" ").trim();

async function main() {
  if (!topic) throw new Error('Give a topic, for example: npm run plan -- "How does water evaporate?"');
  await planStep({
    topic,
    language: Language.parse(flags.lang ?? "en-IN"),
    durationTarget: parseLength(flags.length),
    themeChoice: parseTheme(flags.theme),
    llm: flags.llm === "ollama" ? "ollama" : "gemini",
    notes: flags.notes ? readFileSync(flags.notes, "utf8") : undefined,
  });
}

main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exitCode = 1; });
